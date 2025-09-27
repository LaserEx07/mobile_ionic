import { Injectable } from '@angular/core';
import { Platform, ModalController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { LocalNotifications } from '@capacitor/local-notifications';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { NotificationDetailComponent } from '../components/notification-detail/notification-detail.component';
import { EmergencyOverlayService, EmergencyNotification } from './emergency-overlay.service';
import { NotificationPayloadService, HardcodedNotification } from './notification-payload.service';

@Injectable({
  providedIn: 'root'
})
export class FCMService {
  private fcmToken: string = '';
  private isInitialized: boolean = false;

  constructor(
    private platform: Platform,
    private http: HttpClient,
    private modalController: ModalController,
    private emergencyOverlay: EmergencyOverlayService,
    private router: Router,
    private toastController: ToastController,
    private notificationPayloadService: NotificationPayloadService
  ) {}

  /**
   * Initialize FCM service
   */
  async initializeFCM(): Promise<void> {
    try {
      if (this.platform.is('capacitor')) {
        // Request permissions
        await this.requestPermissions();

        // Get FCM token
        await this.getFCMToken();

        // Listen for token refresh
        this.listenForTokenRefresh();

        // Listen for incoming messages
        this.listenForMessages();

        // Listen for local notification actions
        this.listenForLocalNotificationActions();

        this.isInitialized = true;
        console.log('FCM initialized successfully');
      } else {
        console.log('FCM not available on this platform');
      }
    } catch (error) {
      console.error('Error initializing FCM:', error);
      this.isInitialized = false;
    }
  }



  /**
   * Request notification permissions
   */
  private async requestPermissions(): Promise<void> {
    try {
      const result = await FirebaseMessaging.requestPermissions();
      console.log('FCM permissions result:', result);

      if (result.receive === 'granted') {
        console.log('FCM permissions granted');
      } else {
        console.warn('FCM permissions denied');
      }
    } catch (error) {
      console.error('Error requesting FCM permissions:', error);
    }
  }

  /**
   * Get FCM token
   */
  async getFCMToken(): Promise<string> {
    try {
      const result = await FirebaseMessaging.getToken();
      this.fcmToken = result.token;
      console.log('FCM Token:', this.fcmToken);

      // Register token with backend
      await this.registerTokenWithBackend(this.fcmToken);

      return this.fcmToken;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return '';
    }
  }

  /**
   * Listen for token refresh
   */
  private listenForTokenRefresh(): void {
    FirebaseMessaging.addListener('tokenReceived', async (event) => {
      console.log('FCM token refreshed:', event.token);
      this.fcmToken = event.token;
      await this.registerTokenWithBackend(event.token);
    });
  }

  /**
   * Listen for incoming messages
   */
  private listenForMessages(): void {
    // Listen for messages (both foreground and background)
    FirebaseMessaging.addListener('notificationReceived', (event) => {
      console.log('📱 FCM notification received:', {
        notification: event.notification,
        timestamp: new Date().toISOString()
      });

      // Process notification through payload service
      const payload = {
        id: `fcm_${Date.now()}`,
        title: event.notification.title || 'Notification',
        body: event.notification.body || '',
        data: event.notification.data || {},
        timestamp: new Date().toISOString(),
        source: 'fcm' as const
      };
      this.notificationPayloadService.processNotificationPayload(payload);

      // Check if this is an emergency notification
      if (this.isEmergencyNotification(event.notification)) {
        this.handleEmergencyNotification(event.notification);
      } else {
        // For regular foreground messages, show local notification
        this.showLocalNotification(event.notification);
      }
    });

    // Listen for notification actions (when user taps notification)
    FirebaseMessaging.addListener('notificationActionPerformed', (action) => {
      console.log('📱 FCM notification action performed:', {
        action: action,
        timestamp: new Date().toISOString()
      });
      this.handleNotificationAction(action);
    });
  }

  /**
   * Listen for local notification actions
   */
  private listenForLocalNotificationActions(): void {
    // Listen for local notification actions (when user taps local notification)
    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      console.log('Local notification action performed:', {
        action: action,
        timestamp: new Date().toISOString()
      });
      this.handleNotificationAction(action);
    });
  }

  /**
   * Check if notification is an emergency notification
   */
  private isEmergencyNotification(notification: any): boolean {
    const data = notification.data || {};
    const category = data.category?.toLowerCase() || '';
    const severity = data.severity?.toLowerCase() || '';

    // Emergency categories
    const emergencyCategories = ['earthquake', 'flood', 'typhoon', 'fire', 'landslide'];

    // Check if it's an emergency category or high/critical severity
    return emergencyCategories.includes(category) ||
           severity === 'high' ||
           severity === 'critical' ||
           data.emergency === 'true' ||
           data.emergency === true;
  }

  /**
   * Handle emergency notification with overlay
   */
  private async handleEmergencyNotification(notification: any): Promise<void> {
    try {
      console.log('🚨 EMERGENCY NOTIFICATION RECEIVED:', notification);

      const data = notification.data || {};

      // Create emergency notification object
      const emergencyNotification: EmergencyNotification = {
        id: data.notification_id || `emergency_${Date.now()}`,
        title: notification.title || 'Emergency Alert',
        message: notification.body || 'Emergency notification received',
        category: this.mapToEmergencyCategory(data.category || 'General'),
        severity: this.mapToEmergencySeverity(data.severity || 'medium'),
        timestamp: new Date().toISOString(),
        data: data
      };

      // Show emergency overlay
      await this.emergencyOverlay.showEmergencyNotification(emergencyNotification);

    } catch (error) {
      console.error('Error handling emergency notification:', error);
      // Fallback to regular notification if emergency overlay fails
      this.showLocalNotification(notification);
    }
  }

  /**
   * Map category to emergency category type
   */
  private mapToEmergencyCategory(category: string): 'Earthquake' | 'Flood' | 'Typhoon' | 'Fire' | 'Landslide' | 'General' {
    const categoryMap: { [key: string]: 'Earthquake' | 'Flood' | 'Typhoon' | 'Fire' | 'Landslide' | 'General' } = {
      'earthquake': 'Earthquake',
      'flood': 'Flood',
      'typhoon': 'Typhoon',
      'fire': 'Fire',
      'landslide': 'Landslide',
      'general': 'General',
      'emergency': 'General'
    };

    return categoryMap[category.toLowerCase()] || 'General';
  }

  /**
   * Map severity to emergency severity type
   */
  private mapToEmergencySeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap: { [key: string]: 'low' | 'medium' | 'high' | 'critical' } = {
      'low': 'low',
      'medium': 'medium',
      'high': 'high',
      'critical': 'critical',
      'urgent': 'critical'
    };

    return severityMap[severity.toLowerCase()] || 'medium';
  }

  /**
   * Show local notification for foreground messages
   */
  private async showLocalNotification(notification: any): Promise<void> {
    try {
      console.log('� [FOREGROUND] Attempting to show notification:', JSON.stringify(notification, null, 2));

      // Check if we have notification permissions
      const permissionStatus = await LocalNotifications.checkPermissions();
      console.log('📋 [PERMISSIONS] Current status:', JSON.stringify(permissionStatus, null, 2));

      if (permissionStatus.display !== 'granted') {
        console.log('🔒 [PERMISSIONS] Requesting notification permissions...');
        const requestResult = await LocalNotifications.requestPermissions();
        console.log('📝 [PERMISSIONS] Request result:', JSON.stringify(requestResult, null, 2));

        if (requestResult.display !== 'granted') {
          console.error('❌ [PERMISSIONS] Notification permissions denied - cannot show foreground notifications');
          console.error('❌ [PERMISSIONS] User needs to enable notifications in Android settings');
          return;
        }
      }

      // Generate a unique notification ID to prevent conflicts
      const uniqueId = this.generateUniqueNotificationId();

      // Extract data from notification
      const data = notification.data || {};
      const category = data.category || 'general';
      const severity = data.severity || 'medium';
      const affectedAreas = data.affected_areas ? this.parseAffectedAreas(data.affected_areas) : null;
      const barangay = data.barangay || '';

      // Use the title and body from notification (already rich from backend)
      // If not rich, create rich content (fallback)
      let displayTitle = notification.title || 'New Alert';
      let displayBody = notification.body || 'You have received a new notification';

      // Check if title is already rich (contains emoji)
      if (!this.isRichTitle(displayTitle)) {
        displayTitle = this.createRichTitle(displayTitle, category, severity);
      }

      // Check if body is already rich (contains priority info)
      if (!this.isRichBody(displayBody)) {
        displayBody = this.createRichBody(displayBody, affectedAreas, barangay, severity);
      }

      console.log('📤 [SCHEDULING] Preparing local notification:', {
        id: uniqueId,
        title: displayTitle,
        body: displayBody,
        category: category,
        severity: severity,
        originalNotification: notification
      });

      const notificationPayload = {
        title: displayTitle,
        body: displayBody,
        id: uniqueId,
        schedule: { at: new Date(Date.now() + 500) }, // 500ms delay for Android
        sound: this.getNotificationSound(severity),
        attachments: [],
        actionTypeId: '',
        extra: {
          ...data,
          original_title: notification.title,
          original_body: notification.body,
          notification_id: data.notification_id,
          category: category,
          severity: severity,
          affected_areas: affectedAreas,
          barangay: barangay,
          timestamp: new Date().toISOString()
        }
      };

      console.log('📤 [SCHEDULING] Full notification payload:', JSON.stringify(notificationPayload, null, 2));

      // Schedule the notification
      await LocalNotifications.schedule({
        notifications: [notificationPayload]
      });

      console.log('✅ [SUCCESS] Local notification scheduled successfully with ID:', uniqueId);
      console.log('✅ [SUCCESS] Notification should appear in Android notification panel');
    } catch (error) {
      console.error('❌ [ERROR] Failed to show local notification:', error);
      console.error('❌ [ERROR] Error details:', JSON.stringify(error, null, 2));

      // Try a simpler notification without scheduling
      try {
        console.log('🔄 [FALLBACK] Attempting immediate notification...');

        await LocalNotifications.schedule({
          notifications: [
            {
              title: notification.title || 'New Alert',
              body: notification.body || 'You have a new notification',
              id: Date.now(),
              schedule: { at: new Date(Date.now() + 100) },
              sound: 'default'
            }
          ]
        });

        console.log('✅ [FALLBACK] Simple notification scheduled');
      } catch (fallbackError) {
        console.error('❌ [FALLBACK] Simple notification also failed:', fallbackError);
        console.error('❌ [FALLBACK] This indicates a deeper issue with local notifications on this device');
      }
    }
  }

  /**
   * Generate a unique notification ID to prevent conflicts
   */
  private generateUniqueNotificationId(): number {
    // Use timestamp + random number to ensure uniqueness
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return parseInt(`${timestamp}${random}`);
  }

  /**
   * Create rich notification title with category and severity
   */
  private createRichTitle(originalTitle: string, category: string, severity: string): string {
    const categoryEmoji = this.getCategoryEmoji(category);
    const severityText = this.getSeverityText(severity);

    return `${categoryEmoji} ${severityText}: ${originalTitle}`;
  }

  /**
   * Create rich notification body with priority and affected areas information
   */
  private createRichBody(originalBody: string, affectedAreas: any, barangay: string, severity?: string): string {
    let richBody = originalBody;

    // Add priority/severity information
    if (severity) {
      const priorityIcon = this.getPriorityIcon(severity);
      const priorityText = this.getPriorityDescription(severity);
      richBody += `\n${priorityIcon} Priority: ${priorityText}`;
    }

    // Add affected areas information
    const affectedAreasText = this.formatAffectedAreas(affectedAreas);
    if (affectedAreasText) {
      richBody += `\n🗺️ Affected Area/s: ${affectedAreasText}`;
    } else if (barangay && barangay !== 'All Areas') {
      // Fallback to barangay if no affected areas
      richBody += `\n� Area: ${barangay}`;
    }

    return richBody;
  }

  /**
   * Get category emoji
   */
  private getCategoryEmoji(category: string): string {
    switch (category.toLowerCase()) {
      case 'earthquake': return '🌍';
      case 'typhoon': return '🌪️';
      case 'flood': return '🌊';
      case 'fire': return '🔥';
      case 'emergency': return '🚨';
      case 'evacuation': return '🏃‍♂️';
      case 'general': return '📢';
      case 'announcement': return '📣';
      default: return '⚠️';
    }
  }

  /**
   * Get severity text
   */
  private getSeverityText(severity: string): string {
    switch (severity.toLowerCase()) {
      case 'high': return 'URGENT';
      case 'medium': return 'ALERT';
      case 'low': return 'INFO';
      default: return 'NOTICE';
    }
  }

  /**
   * Get priority icon based on severity
   */
  private getPriorityIcon(severity: string): string {
    switch (severity.toLowerCase()) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '🔵';
    }
  }

  /**
   * Get priority description based on severity
   */
  private getPriorityDescription(severity: string): string {
    switch (severity.toLowerCase()) {
      case 'high': return 'Critical - Immediate Action Required';
      case 'medium': return 'High - Action Required Soon';
      case 'low': return 'Normal - For Your Information';
      default: return 'Standard - General Notice';
    }
  }

  /**
   * Get notification sound based on severity
   */
  private getNotificationSound(severity: string): string {
    switch (severity.toLowerCase()) {
      case 'high': return 'emergency.wav';
      case 'medium': return 'alert.wav';
      case 'low': return 'beep.wav';
      default: return 'default';
    }
  }

  /**
   * Parse affected areas from JSON string
   */
  private parseAffectedAreas(affectedAreasString: string): any {
    try {
      return JSON.parse(affectedAreasString);
    } catch (error) {
      console.error('Error parsing affected areas:', error);
      return null;
    }
  }

  /**
   * Format affected areas for display in notifications
   */
  private formatAffectedAreas(affectedAreas: any): string | null {
    if (!affectedAreas) {
      return null;
    }

    try {
      let areas: any[] = [];

      // Handle different data formats
      if (typeof affectedAreas === 'string') {
        areas = JSON.parse(affectedAreas);
      } else if (Array.isArray(affectedAreas)) {
        areas = affectedAreas;
      } else {
        return null;
      }

      if (!Array.isArray(areas) || areas.length === 0) {
        return null;
      }

      // Extract area names
      const areaNames: string[] = [];
      for (const area of areas) {
        if (typeof area === 'object' && area.name) {
          areaNames.push(area.name);
        } else if (typeof area === 'string') {
          areaNames.push(area);
        }
      }

      if (areaNames.length === 0) {
        return null;
      }

      // Format the area names
      if (areaNames.length === 1) {
        return areaNames[0];
      } else if (areaNames.length === 2) {
        return areaNames.join(' and ');
      } else {
        // For 3 or more areas: "Area1, Area2, and Area3"
        const lastArea = areaNames.pop();
        return areaNames.join(', ') + ', and ' + lastArea;
      }

    } catch (error) {
      console.error('Error formatting affected areas:', error);
      return null;
    }
  }

  /**
   * Check if title is already rich (contains emoji)
   */
  private isRichTitle(title: string): boolean {
    // Check for common emojis used in rich titles
    const emojiPattern = /[🌍🌪️🌊🔥🚨🏃‍♂️📢📣⚠️]/;
    return emojiPattern.test(title);
  }

  /**
   * Check if body is already rich (contains priority info)
   */
  private isRichBody(body: string): boolean {
    // Check for priority indicators
    return body.includes('� Priority:') || body.includes('🟡 Priority:') || body.includes('🟢 Priority:') || body.includes('� Priority:');
  }

  /**
   * Handle notification action (when user taps notification)
   */
  private async handleNotificationAction(action: any): Promise<void> {
    console.log('🔔 Handling notification action:', action);

    // Extract notification data
    const notificationData = action.notification?.extra || action.notification?.data || {};

    if (notificationData) {
      const category = notificationData.category?.toLowerCase() || '';
      const severity = notificationData.severity?.toLowerCase() || '';

      console.log('📱 Notification data:', {
        category,
        severity,
        title: notificationData.title || notificationData.original_title,
        emergency: this.isEmergencyNotification({ data: notificationData })
      });

      // Check if this is a disaster notification that should route to specific map
      if (this.shouldRouteToDisasterMap(category, severity)) {
        await this.routeToDisasterMap(category, notificationData);
      } else {
        // Show detailed notification modal for non-disaster notifications
        await this.showNotificationDetail(notificationData);
      }
    }
  }

  /**
   * Check if notification should route to disaster map
   */
  private shouldRouteToDisasterMap(category: string, severity: string): boolean {
    const disasterCategories = ['earthquake', 'flood', 'typhoon', 'fire', 'landslide'];
    const emergencySeverities = ['high', 'critical', 'emergency'];

    return disasterCategories.includes(category) || emergencySeverities.includes(severity);
  }

  /**
   * Route to appropriate disaster map based on notification category
   */
  private async routeToDisasterMap(category: string, notificationData: any): Promise<void> {
    try {
      console.log(`🗺️ Routing for ${category} disaster notification...`);

      let route: string;
      let mapType: string;

      // Map specific disaster types to their dedicated maps
      const disasterRoutes: { [key: string]: string } = {
        'earthquake': '/tabs/earthquake-map',
        'flood': '/tabs/flood-map',
        'typhoon': '/tabs/typhoon-map',
        'landslide': '/tabs/landslide-map',
        'fire': '/tabs/fire-map'
      };

      // Check if this disaster has a specific map, otherwise use general map
      if (disasterRoutes[category]) {
        route = disasterRoutes[category];
        mapType = `${category} evacuation centers`;
      } else {
        // "other" category and unknown disasters go to general map
        route = '/tabs/map';
        mapType = 'evacuation centers';
      }

      // Navigate to the appropriate map with emergency parameters
      await this.router.navigate([route], {
        queryParams: {
          emergency: true,
          autoRoute: true,
          notification: true,
          category: category,
          severity: notificationData.severity || 'medium',
          timestamp: Date.now(),
          title: notificationData.title || notificationData.original_title,
          message: notificationData.message || notificationData.body
        }
      });

      // Show emergency toast with appropriate message
      const toast = await this.toastController.create({
        message: `🚨 Emergency: Navigating to ${mapType} for ${category} alert`,
        duration: 4000,
        color: 'danger',
        position: 'top',
        cssClass: 'emergency-toast'
      });
      await toast.present();

      console.log(`✅ Successfully routed to ${route} for ${category} emergency`);

    } catch (error) {
      console.error('❌ Error routing to disaster map:', error);

      // Fallback: show notification detail modal
      await this.showNotificationDetail(notificationData);
    }
  }

  /**
   * Show detailed notification modal
   */
  private async showNotificationDetail(data: any): Promise<void> {
    try {
      const modal = await this.modalController.create({
        component: NotificationDetailComponent,
        componentProps: {
          notification: {
            id: data.notification_id || Date.now(),
            title: data.title || 'Notification',
            body: data.body || 'No message content',
            category: data.category || 'general',
            severity: data.severity || 'medium',
            barangay: data.barangay || '',
            affected_areas: data.affected_areas || null,
            timestamp: data.timestamp || new Date().toISOString(),
            notification_id: data.notification_id || ''
          }
        },
        cssClass: 'notification-detail-modal'
      });

      await modal.present();
    } catch (error) {
      console.error('Error showing notification detail:', error);
    }
  }

  /**
   * Register FCM token with backend
   */
  private async registerTokenWithBackend(token: string): Promise<void> {
    try {
      const userId = this.getCurrentUserId();
      const payload = {
        token: token,
        device_type: 'android',
        project_id: environment.firebase.projectId,
        user_id: userId
      };

      console.log('Registering FCM token with backend:', {
        token: token.substring(0, 20) + '...',
        device_type: payload.device_type,
        project_id: payload.project_id,
        user_id: payload.user_id
      });

      // Try the public endpoint first (doesn't require authentication)
      const publicEndpoint = `${environment.apiUrl}/device-token`;

      try {
        const response = await firstValueFrom(this.http.post(publicEndpoint, payload));
        console.log('FCM token registered successfully:', response);

        // Store token locally for recovery
        localStorage.setItem('fcm_token', token);
        localStorage.setItem('fcm_token_registered', 'true');

        return;
      } catch (error) {
        console.error('Error registering token with public endpoint:', error);

        // If user is authenticated, try the protected endpoint
        if (userId) {
          try {
            const protectedEndpoint = `${environment.apiUrl}/device-token/register`;
            const authResponse = await firstValueFrom(this.http.post(protectedEndpoint, payload));
            console.log('FCM token registered with protected endpoint:', authResponse);

            localStorage.setItem('fcm_token', token);
            localStorage.setItem('fcm_token_registered', 'true');

            return;
          } catch (authError) {
            console.error('Error registering token with protected endpoint:', authError);
          }
        }

        // Store token locally even if registration failed, for retry later
        localStorage.setItem('fcm_token', token);
        localStorage.setItem('fcm_token_registered', 'false');

        throw error;
      }
    } catch (error) {
      console.error('Error registering FCM token with backend:', error);

      // Store token locally for retry later
      localStorage.setItem('fcm_token', token);
      localStorage.setItem('fcm_token_registered', 'false');
    }
  }

  /**
   * Get current user ID (implement based on your auth system)
   */
  private getCurrentUserId(): number | null {
    // Try multiple sources for user data
    const sources = ['user', 'currentUser', 'authUser', 'userData'];

    for (const source of sources) {
      const userData = localStorage.getItem(source);
      if (userData) {
        try {
          const parsed = JSON.parse(userData);
          if (parsed && (parsed.id || parsed.user_id || parsed.userId)) {
            return parsed.id || parsed.user_id || parsed.userId;
          }
        } catch (error) {
          console.error(`Error parsing ${source} data:`, error);
        }
      }
    }

    // If no user found, return null (anonymous registration)
    console.log('No authenticated user found, registering token anonymously');
    return null;
  }

  /**
   * Retry token registration if it failed previously
   */
  async retryTokenRegistration(): Promise<void> {
    const token = localStorage.getItem('fcm_token');
    const registered = localStorage.getItem('fcm_token_registered');

    if (token && registered === 'false') {
      console.log('Retrying FCM token registration...');
      await this.registerTokenWithBackend(token);
    }
  }

  /**
   * Get current FCM token
   */
  getCurrentToken(): string {
    // Return the in-memory token if available, otherwise check localStorage
    if (this.fcmToken) {
      return this.fcmToken;
    }

    const storedToken = localStorage.getItem('fcm_token');
    if (storedToken) {
      this.fcmToken = storedToken;
      return storedToken;
    }

    return '';
  }

  /**
   * Subscribe to topic
   */
  async subscribeToTopic(topic: string): Promise<void> {
    try {
      await FirebaseMessaging.subscribeToTopic({ topic });
      console.log(`Subscribed to topic: ${topic}`);
    } catch (error) {
      console.error(`Error subscribing to topic ${topic}:`, error);
    }
  }

  /**
   * Unsubscribe from topic
   */
  async unsubscribeFromTopic(topic: string): Promise<void> {
    try {
      await FirebaseMessaging.unsubscribeFromTopic({ topic });
      console.log(`Unsubscribed from topic: ${topic}`);
    } catch (error) {
      console.error(`Error unsubscribing from topic ${topic}:`, error);
    }
  }

  /**
   * Delete FCM token
   */
  async deleteToken(): Promise<void> {
    try {
      await FirebaseMessaging.deleteToken();
      this.fcmToken = '';
      localStorage.removeItem('fcm_token');
      console.log('FCM token deleted');
    } catch (error) {
      console.error('Error deleting FCM token:', error);
    }
  }



  /**
   * Check FCM service status
   */
  getServiceStatus(): any {
    return {
      isInitialized: this.isInitialized,
      hasToken: !!this.fcmToken,
      token: this.fcmToken ? this.fcmToken.substring(0, 20) + '...' : 'No token',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Display hardcoded notification for testing
   */
  async displayHardcodedNotification(type: 'emergency' | 'regular' = 'regular'): Promise<void> {
    try {
      if (type === 'emergency') {
        // Create hardcoded emergency notification
        const hardcodedEmergency: HardcodedNotification = {
          id: `emergency_${Date.now()}`,
          title: 'Emergency Alert Test',
          message: 'This is a test emergency notification with hardcoded content.',
          type: 'emergency',
          duration: 10000,
          showToast: true,
          showAlert: true,
          vibrate: true
        };

        // Process through notification payload service
        await this.notificationPayloadService.displayHardcodedNotification(hardcodedEmergency);
        
        // Also show emergency overlay
        await this.emergencyOverlay.showEmergencyNotification({
          id: `emergency_overlay_${Date.now()}`,
          title: hardcodedEmergency.title,
          message: hardcodedEmergency.message,
          category: 'General',
          severity: 'high',
          timestamp: new Date().toISOString()
        });
      } else {
        // Create hardcoded regular notification
        const hardcodedRegular: HardcodedNotification = {
          id: `regular_${Date.now()}`,
          title: 'Regular Notification Test',
          message: 'This is a test regular notification with hardcoded content.',
          type: 'info',
          duration: 5000,
          showToast: true,
          showAlert: false,
          vibrate: false
        };

        // Process through notification payload service
        await this.notificationPayloadService.displayHardcodedNotification(hardcodedRegular);
        
        // Show as local notification
        await this.showLocalNotification({
          title: hardcodedRegular.title,
          body: hardcodedRegular.message,
          data: { test: 'true' }
        });
      }

      console.log(`✅ Hardcoded ${type} notification displayed successfully`);
    } catch (error) {
      console.error(`❌ Error displaying hardcoded ${type} notification:`, error);
    }
  }

  /**
   * Test notification system with both types
   */
  async testNotificationSystem(): Promise<void> {
    try {
      console.log('🧪 Testing notification system...');
      
      // Test regular notification first
      await this.displayHardcodedNotification('regular');
      
      // Wait 3 seconds then test emergency notification
      setTimeout(async () => {
        await this.displayHardcodedNotification('emergency');
      }, 3000);
      
      console.log('✅ Notification system test initiated');
    } catch (error) {
      console.error('❌ Error testing notification system:', error);
    }
  }
}
