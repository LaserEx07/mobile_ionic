import { Injectable } from '@angular/core';
import { FCM } from '@awesome-cordova-plugins/fcm/ngx';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Platform, ToastController, AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { Capacitor } from '@capacitor/core';

export interface FCMNotification {
  title: string;
  body: string;
  category?: string;
  severity?: string;
  wasTapped?: boolean;
  time?: string | number | Date;
  notification_id?: string | number | null;
  project_id?: string;
  // Allow any other properties
  [key: string]: any;
}

@Injectable({
  providedIn: 'root',
})
export class FcmService {
  private notificationSubject = new Subject<FCMNotification>();
  public notifications$ = this.notificationSubject.asObservable();

  constructor(
    private fcm: FCM,
    private http: HttpClient,
    private platform: Platform,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private router: Router
  ) {}

  async initPush() {
    try {
      // Only initialize FCM on actual devices
      if (this.platform.is('cordova') || this.platform.is('capacitor')) {
        console.log('Initializing FCM...');

        // Create Android notification channels first (if on Android)
        if (this.platform.is('android')) {
          await this.createAndroidNotificationChannels();
        }

        // Check if Google Play Services is available
        const isGooglePlayAvailable = await this.checkGooglePlayServices();
        if (!isGooglePlayAvailable) {
          console.warn('Google Play Services not available. FCM may not work properly.');
          // Show alert to user
          this.alertCtrl.create({
            header: 'Google Play Services Required',
            message: 'This app requires Google Play Services for push notifications. Please install or update Google Play Services and restart the app.',
            buttons: ['OK']
          }).then(alert => alert.present());

          // Store a flag in localStorage
          localStorage.setItem('google_play_services_missing', 'true');

          // Still continue with the rest of the initialization
          // as some devices might still work without Google Play Services
        } else {
          localStorage.removeItem('google_play_services_missing');
        }

        if (this.platform.is('capacitor')) {
          try {
            // Request permission for notifications (required for iOS and newer Android)
            const permissionResult = await FirebaseMessaging.requestPermissions();
            console.log('FCM permission result:', permissionResult);

            if (permissionResult.receive === 'granted') {
              console.log('FCM permission granted');

              // Register with FCM - no need to call registerDevice explicitly
              // It's automatically registered when permission is granted
              console.log('Device registered with FCM');
            } else {
              console.warn('FCM permission not granted:', permissionResult.receive);

              // Show alert to user about notification permissions
              this.alertCtrl.create({
                header: 'Notification Permission Required',
                message: 'This app requires notification permissions to alert you about emergencies. Please enable notifications for this app in your device settings.',
                buttons: ['OK']
              }).then(alert => alert.present());
            }
          } catch (error) {
            console.error('Error initializing Capacitor Firebase Messaging:', error);
          }
        }

        // Get the FCM token
        try {
          const token = await this.getToken();

          // Log the token for debugging (console only)
          console.log('FCM Token registered:', token.substring(0, 20) + '...');

          this.registerTokenWithBackend(token);
        } catch (error) {
          console.error('Error getting FCM token:', error);
          // Continue app initialization even if FCM fails
        }

        try {
          // Handle token refresh for Cordova FCM
          if (this.platform.is('cordova')) {
            this.fcm.onTokenRefresh().subscribe({
              next: token => {
                console.log('FCM Token refreshed (Cordova):', token);
                this.registerTokenWithBackend(token);
              },
              error: error => {
                console.error('Error in token refresh (Cordova):', error);
              }
            });
          }

          // Handle token refresh for Capacitor Firebase Messaging
          if (this.platform.is('capacitor')) {
            FirebaseMessaging.addListener('tokenReceived', (event: { token: string }) => {
              console.log('FCM Token refreshed (Capacitor):', event.token);
              this.registerTokenWithBackend(event.token);
            });
          }
        } catch (error) {
          console.error('Failed to set up token refresh:', error);
        }

        // Set up notification handlers
        this.setupNotificationListeners();
      } else {
        console.log('FCM not initialized: not running on a device');
      }
    } catch (error) {
      console.error('Error in initPush:', error);
      // Allow the app to continue even if FCM initialization fails
    }
  }

  /**
   * Get the FCM token for the device
   * @returns Promise with the FCM token
   */
  async getToken(): Promise<string> {
    if (this.platform.is('capacitor')) {
      try {
        // Try Capacitor Firebase Messaging first
        const result = await FirebaseMessaging.getToken();
        console.log('Got FCM token from Capacitor Firebase Messaging:', result.token);
        return result.token;
      } catch (capacitorError) {
        console.error('Error getting token from Capacitor Firebase Messaging:', capacitorError);

        // Fall back to Cordova FCM plugin
        try {
          const token = await this.fcm.getToken();
          console.log('Got FCM token from Cordova FCM plugin:', token);
          return token;
        } catch (cordovaError) {
          console.error('Error getting token from Cordova FCM plugin:', cordovaError);
          throw cordovaError;
        }
      }
    } else if (this.platform.is('cordova')) {
      // Use Cordova FCM plugin directly
      return this.fcm.getToken();
    } else {
      // For browser testing, return a mock token
      const mockToken = 'browser-mock-token-' + Math.random().toString(36).substring(2, 15);
      console.log('Using mock FCM token for browser:', mockToken);
      return Promise.resolve(mockToken);
    }
  }

  /**
   * Register FCM token with the backend
   * @param token The FCM token to register
   * @param userId Optional user ID to associate with the token
   */
  public registerTokenWithBackend(token: string, userId?: number) {
    // Check if this token is already registered
    const storedToken = localStorage.getItem('fcm_token');
    if (storedToken === token) {
      console.log('Token already registered, skipping registration');
      return;
    }

    // Determine platform
    let deviceType = 'web';
    if (this.platform.is('ios')) {
      deviceType = 'ios';
    } else if (this.platform.is('android')) {
      deviceType = 'android';
    }

    console.log(`Registering ${deviceType} token with backend...`);

    // Include Firebase project ID in the request
    const payload: any = {
      token: token,
      device_type: deviceType,
      project_id: environment.firebase.projectId || 'last-5acaf' // Use correct project ID
    };

    // If we have a user ID, include it in the payload
    if (userId) {
      payload.user_id = userId;
      console.log(`Associating token with user ID: ${userId}`);
    } else {
      // Try to get user ID from localStorage if available
      const authToken = localStorage.getItem('token');
      if (authToken) {
        try {
          // Try to decode the JWT token to get the user ID
          const tokenData = this.parseJwt(authToken);
          if (tokenData && tokenData.sub) {
            payload.user_id = tokenData.sub;
            console.log(`Associating token with user ID from JWT: ${tokenData.sub}`);
          }
        } catch (error) {
          console.error('Error parsing JWT token:', error);
        }
      }
    }

    // Only send to backend if we have a valid token and project ID is configured
    if (token && (environment.firebase.projectId || payload.project_id)) {
      // Store the token in localStorage immediately to prevent duplicate registrations
      localStorage.setItem('fcm_token', token);

      // Set a flag to indicate we're currently registering this token
      localStorage.setItem('fcm_token_registering', 'true');

      // Send token to your Laravel backend
      this.http.post(`${environment.apiUrl}/device-token`, payload)
        .subscribe({
          next: (res) => {
            console.log('Token registered with backend:', res);
            // Clear the registering flag
            localStorage.removeItem('fcm_token_registering');
          },
          error: (err) => {
            console.error('Error registering token:', err);

            // Clear the registering flag
            localStorage.removeItem('fcm_token_registering');

            // Don't retry automatically - this causes too many requests
          }
        });
    } else {
      console.log('Skipping token registration: Missing project ID or token');
      // Still store the token for later use
      if (token) {
        localStorage.setItem('fcm_token', token);
      }
    }
  }

  /**
   * Parse a JWT token to get the payload
   * @param token The JWT token to parse
   * @returns The decoded token payload
   */
  private parseJwt(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error parsing JWT token:', error);
      return null;
    }
  }

  private setupNotificationListeners() {
    // Try to set up both Capacitor and Cordova notification listeners for maximum compatibility
    this.setupCapacitorNotificationListeners();
    this.setupCordovaNotificationListeners();
  }

  private setupCapacitorNotificationListeners() {
    try {
      if (this.platform.is('capacitor')) {
        console.log('Setting up Capacitor Firebase Messaging notification listeners');

        // Listen for messages received in the foreground
        FirebaseMessaging.addListener('notificationReceived', (event: {
          notification: {
            title?: string;
            body?: string;
            data?: any
          }
        }) => {
          console.log('Capacitor: Notification received in foreground:', event);
          // Extract data first
          const notificationData = event.notification.data || {};

          // Create notification object with proper properties
          this.processNotification({
            title: event.notification.title || '',
            body: event.notification.body || '',
            category: notificationData.category || '',
            severity: notificationData.severity || 'low',
            wasTapped: false, // Foreground notification
            notification_id: notificationData.notification_id || null,
            time: new Date().toISOString(),
            // Add any other properties that weren't explicitly set above
            ...Object.keys(notificationData)
              .filter(key => !['category', 'severity', 'notification_id'].includes(key))
              .reduce((obj, key) => {
                obj[key] = notificationData[key];
                return obj;
              }, {} as Record<string, any>)
          });
        });

        // Listen for messages received in the background and tapped
        FirebaseMessaging.addListener('notificationActionPerformed', (event: {
          notification: {
            title?: string;
            body?: string;
            data?: any
          }
        }) => {
          console.log('Capacitor: Notification tapped:', event);
          // Extract data first
          const notificationData = event.notification.data || {};

          // Create notification object with proper properties
          this.processNotification({
            title: event.notification.title || '',
            body: event.notification.body || '',
            category: notificationData.category || '',
            severity: notificationData.severity || 'low',
            wasTapped: true, // Background notification that was tapped
            notification_id: notificationData.notification_id || null,
            time: new Date().toISOString(),
            // Add any other properties that weren't explicitly set above
            ...Object.keys(notificationData)
              .filter(key => !['category', 'severity', 'notification_id'].includes(key))
              .reduce((obj, key) => {
                obj[key] = notificationData[key];
                return obj;
              }, {} as Record<string, any>)
          });
        });
      }
    } catch (error) {
      console.error('Failed to set up Capacitor notification listeners:', error);
    }
  }

  private setupCordovaNotificationListeners() {
    try {
      if (this.platform.is('cordova')) {
        console.log('Setting up Cordova FCM notification listeners');

        this.fcm.onNotification().subscribe({
          next: (data) => {
            console.log('Cordova FCM notification received:', data);
            // Extract data first
            const notificationData = { ...data };

            // Create notification object with proper properties
            this.processNotification({
              title: data['title'] || (data['aps'] && data['aps']['alert'] && data['aps']['alert']['title']) || '',
              body: data['body'] || (data['aps'] && data['aps']['alert'] && data['aps']['alert']['body']) || data['message'] || '',
              category: data['category'] || '',
              severity: data['severity'] || 'low',
              wasTapped: data['wasTapped'] || false,
              notification_id: data['notification_id'] || null,
              time: data['time'] || new Date().toISOString(),
              // Add any other properties that weren't explicitly set above
              ...Object.keys(notificationData)
                .filter(key => !['title', 'body', 'category', 'severity', 'wasTapped', 'notification_id', 'time'].includes(key))
                .reduce((obj, key) => {
                  obj[key] = notificationData[key];
                  return obj;
                }, {} as Record<string, any>)
            });
          },
          error: (error) => {
            console.error('Error in Cordova FCM notification subscription:', error);
          }
        });
      }
    } catch (error) {
      console.error('Failed to set up Cordova FCM notification listeners:', error);
    }
  }

  private processNotification(notification: FCMNotification) {
    try {
      // Log the notification details for debugging
      console.log('Processed notification:', {
        title: notification.title,
        body: notification.body,
        category: notification.category,
        severity: notification.severity,
        wasTapped: notification.wasTapped,
        notification_id: notification.notification_id,
        project_id: environment.firebase.projectId || 'new-firebase-project'
      });

      // Broadcast the notification to any components that are listening
      this.notificationSubject.next(notification);

      if (notification.wasTapped) {
        // Notification was received in background and tapped by the user
        console.log('Notification tapped in background');
        this.handleBackgroundNotification(notification);
      } else {
        // Notification was received in foreground
        console.log('Notification received in foreground');
        this.handleForegroundNotification(notification);
      }
    } catch (error) {
      console.error('Error processing notification:', error, notification);
    }
  }

  private async handleForegroundNotification(notification: FCMNotification) {
    try {
      console.log('🔔 Handling foreground notification:', notification);

      // Try to vibrate the device (works on most mobile browsers and devices)
      this.vibrateDevice();

      // Play notification sound
      this.playNotificationSound();

      // Add a small delay to ensure app is ready for modal
      await new Promise(resolve => setTimeout(resolve, 500));

      // Show custom emergency notification modal for all notifications
      await this.showEmergencyNotificationModal(notification);

    } catch (error) {
      console.error('❌ Error handling foreground notification:', error);
      // Fallback: show a toast notification instead
      await this.showFallbackToast(notification);
    }
  }

  /**
   * Show custom emergency notification modal with disaster-specific colors
   */
  private async showEmergencyNotificationModal(notification: FCMNotification) {
    try {
      console.log('📱 Creating emergency notification modal...', notification);

      // Ensure we're in the right zone for Angular
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if there's already an alert present
      const existingAlert = await this.alertCtrl.getTop();
      if (existingAlert) {
        console.log('⚠️ Alert already present, dismissing first...');
        await existingAlert.dismiss();
        // Wait a bit before showing new alert
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Force show fallback toast first to ensure user sees something
      console.log('🍞 Showing immediate toast notification as backup...');
      await this.showFallbackToast(notification);

      // Then try to show the modal
      const alert = await this.alertCtrl.create({
        header: notification.title || 'EMERGENCY ALERT',
        subHeader: notification.category ? `${notification.category.toUpperCase()} ALERT` : '',
        message: notification.body || '',
        buttons: [
          {
            text: 'Go to Safe Area',
            cssClass: 'alert-button-primary',
            handler: () => {
              console.log('🗺️ User tapped Go to Safe Area from modal');
              this.navigateBasedOnNotification(notification);
              return true;
            }
          },
          {
            text: 'Dismiss',
            role: 'cancel',
            cssClass: 'alert-button-secondary',
            handler: () => {
              console.log('❌ User dismissed notification modal');
              return true;
            }
          }
        ],
        cssClass: `emergency-notification ${notification.category?.toLowerCase() || 'general'}-alert`,
        backdropDismiss: false, // Prevent accidental dismissal
        keyboardClose: false
      });

      console.log('✅ Emergency modal created, presenting...');
      await alert.present();
      console.log('✅ Emergency modal presented successfully');

    } catch (error: any) {
      console.error('❌ Error creating emergency modal:', error);
      console.error('❌ Modal error details:', error?.message, error?.stack);
      // Fallback to toast (already shown above, but ensure it's visible)
      await this.showFallbackToast(notification);
    }
  }

  /**
   * Fallback toast notification when modal fails
   */
  private async showFallbackToast(notification: FCMNotification) {
    try {
      console.log('🍞 Showing emergency toast notification');

      const toast = await this.toastCtrl.create({
        header: `🚨 ${notification.title || 'EMERGENCY ALERT'}`,
        message: notification.body || 'Emergency notification received',
        duration: 8000, // Longer duration for emergency
        position: 'top',
        color: this.getToastColor(notification.category),
        cssClass: 'emergency-toast',
        buttons: [
          {
            text: '🗺️ Go to Safe Area',
            handler: () => {
              console.log('🗺️ User tapped Go to Safe Area from toast');
              this.navigateBasedOnNotification(notification);
              return true;
            }
          },
          {
            text: 'Dismiss',
            role: 'cancel',
            handler: () => {
              console.log('❌ User dismissed toast notification');
              return true;
            }
          }
        ]
      });

      await toast.present();
      console.log('✅ Emergency toast shown successfully');

      // Also vibrate for the toast
      this.vibrateDevice();

    } catch (error: any) {
      console.error('❌ Even fallback toast failed:', error);
      // Last resort: show a simple alert
      try {
        const simpleAlert = await this.alertCtrl.create({
          header: '🚨 EMERGENCY ALERT',
          message: `${notification.title}\n\n${notification.body}`,
          buttons: [
            {
              text: 'Go to Safe Area',
              handler: () => this.navigateBasedOnNotification(notification)
            },
            'Dismiss'
          ]
        });
        await simpleAlert.present();
        console.log('✅ Simple alert shown as last resort');
      } catch (finalError) {
        console.error('❌ All notification methods failed:', finalError);
        console.log('📢 EMERGENCY NOTIFICATION (all display methods failed):', notification);
      }
    }
  }

  /**
   * Get toast color based on disaster category
   */
  private getToastColor(category?: string): string {
    if (!category) return 'warning';

    switch (category.toLowerCase()) {
      case 'earthquake': return 'warning';
      case 'flood': return 'primary';
      case 'typhoon': return 'success';
      case 'fire': return 'danger';
      default: return 'warning';
    }
  }

  /**
   * Test method to simulate foreground notification
   */
  async simulateForegroundNotification(notification: FCMNotification): Promise<void> {
    console.log('🧪 Simulating foreground notification:', notification);
    await this.processNotification(notification);
  }

  /**
   * Test method to simulate background notification
   */
  async simulateBackgroundNotification(notification: FCMNotification): Promise<void> {
    console.log('🧪 Simulating background notification:', notification);
    notification.wasTapped = true; // Mark as tapped
    await this.processNotification(notification);
  }

  /**
   * Get disaster-specific styling
   */
  private getDisasterStyle(category?: string): { color: string, icon: string } {
    if (!category) {
      return { color: '#666666', icon: 'notifications-outline' };
    }

    const type = category.toLowerCase();

    if (type.includes('earthquake') || type.includes('quake')) {
      return { color: '#ffa500', icon: 'earth-outline' }; // Orange for earthquake
    } else if (type.includes('flood') || type.includes('flash')) {
      return { color: '#0000ff', icon: 'water-outline' }; // Blue for flood
    } else if (type.includes('typhoon') || type.includes('storm') || type.includes('hurricane')) {
      return { color: '#008000', icon: 'thunderstorm-outline' }; // Green for typhoon
    } else if (type.includes('fire')) {
      return { color: '#ff0000', icon: 'flame-outline' }; // Red for fire
    }

    return { color: '#666666', icon: 'alert-circle-outline' }; // Default gray
  }

  /**
   * Vibrate the device if the API is available
   */
  private vibrateDevice() {
    // Check if the vibration API is available
    if ('vibrate' in navigator) {
      // Vibrate for 1000ms, pause for 200ms, then vibrate for 1000ms (stronger pattern)
      navigator.vibrate([1000, 200, 1000, 200, 1000]);
      console.log('Device vibration triggered with strong pattern');
    } else {
      console.log('Vibration API not supported on this device');
    }
  }

  /**
   * Play a notification sound
   */
  private playNotificationSound() {
    try {
      // Create an audio element
      const audio = new Audio();

      // Set the source to a notification sound (use a default system sound)
      audio.src = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU...';

      // Set volume to maximum
      audio.volume = 1.0;

      // Play the sound
      audio.play().catch(error => {
        console.error('Error playing notification sound:', error);
      });
    } catch (error) {
      console.error('Error creating audio element:', error);
    }
  }

  // Removed duplicate function

  private async handleBackgroundNotification(notification: FCMNotification) {
    try {
      console.log('🔔 Handling background notification tap:', notification);

      // When a background notification is tapped, we should vibrate to provide feedback
      this.vibrateDevice();

      // Add delay to ensure app is fully loaded
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Show the emergency modal even for background notifications when app opens
      await this.showEmergencyNotificationModal(notification);

      // Handle navigation based on the notification (after modal is dismissed)
      // Note: Navigation will be handled by the modal buttons

    } catch (error) {
      console.error('❌ Error handling background notification:', error);
      // Fallback: just navigate directly
      this.navigateBasedOnNotification(notification);
    }
  }

  private navigateBasedOnNotification(notification: FCMNotification) {
    console.log('🗺️ Navigating based on notification:', notification);

    // Check if this is a new evacuation center notification
    if (notification.category === 'evacuation_center' ||
        (notification['data'] && notification['data']['type'] === 'evacuation_center_added')) {
      console.log('🏢 New evacuation center notification detected');
      this.handleEvacuationCenterNotification(notification);
      return;
    }

    // Navigate based on notification category or type
    if (notification.category) {
      const category = notification.category.toLowerCase();
      console.log('📍 Notification category:', category);

      // Map to backend enum values that the map page expects
      let mappedDisasterType = '';

      switch(category) {
        case 'flood':
        case 'flashflood':
          mappedDisasterType = 'Flood';
          break;
        case 'earthquake':
        case 'quake':
          mappedDisasterType = 'Earthquake';
          break;
        case 'typhoon':
        case 'storm':
        case 'hurricane':
          mappedDisasterType = 'Typhoon';
          break;
        case 'fire':
          mappedDisasterType = 'Fire';
          break;
        default:
          console.warn('Unknown disaster category:', category);
          mappedDisasterType = 'all';
          break;
      }

      console.log(`🗺️ Mapped disaster type: ${category} -> ${mappedDisasterType}`);

      if (mappedDisasterType && mappedDisasterType !== 'all') {
        // Navigate directly to disaster-specific map pages
        console.log('🗺️ Navigating to disaster-specific map:', mappedDisasterType);

        let route = '';
        switch (mappedDisasterType.toLowerCase()) {
          case 'earthquake':
            route = '/earthquake-map';
            break;
          case 'typhoon':
            route = '/typhoon-map';
            break;
          case 'flood':
            route = '/flood-map';
            break;
          default:
            route = '/tabs/map';
            break;
        }

        console.log(`🗺️ Navigating to route: ${route}`);
        this.router.navigate([route]);
      } else {
        // Default navigation to home
        console.log('🏠 Navigating to home (unknown disaster type)');
        this.router.navigate(['/tabs/home']);
      }
    } else {
      // Default navigation if no category
      console.log('🏠 Navigating to home (no category)');
      this.router.navigate(['/tabs/home']);
    }
  }

  private handleEvacuationCenterNotification(notification: FCMNotification) {
    console.log('🏢 Handling evacuation center notification:', notification);

    try {
      // Extract evacuation center data from notification
      let evacuationData = null;

      if (notification['data']) {
        evacuationData = notification['data'];
      }

      if (evacuationData && evacuationData.evacuation_center_id) {
        const centerId = evacuationData.evacuation_center_id;
        const disasterType = evacuationData.disaster_type;
        const latitude = evacuationData.location?.latitude;
        const longitude = evacuationData.location?.longitude;

        console.log(`🏢 Evacuation center details:`, {
          id: centerId,
          disasterType: disasterType,
          lat: latitude,
          lng: longitude
        });

        // Navigate to the appropriate disaster-specific map based on disaster type
        let route = '/all-maps'; // Default to all maps

        if (disasterType) {
          switch (disasterType.toLowerCase()) {
            case 'earthquake':
              route = '/earthquake-map';
              break;
            case 'typhoon':
              route = '/typhoon-map';
              break;
            case 'flood':
            case 'flash flood':
              route = '/flood-map';
              break;
            default:
              route = '/all-maps';
              break;
          }
        }

        console.log(`🗺️ Navigating to ${route} for new evacuation center`);

        // Navigate with query parameters to highlight the new center
        this.router.navigate([route], {
          queryParams: {
            newCenterId: centerId,
            highlightCenter: 'true',
            centerLat: latitude,
            centerLng: longitude
          }
        });

      } else {
        console.log('🏢 No evacuation center data found, navigating to all maps');
        this.router.navigate(['/all-maps']);
      }

    } catch (error) {
      console.error('❌ Error handling evacuation center notification:', error);
      // Fallback to all maps
      this.router.navigate(['/all-maps']);
    }
  }

  /**
   * Check if Google Play Services is available on the device
   * @returns Promise<boolean> True if Google Play Services is available
   */
  private async checkGooglePlayServices(): Promise<boolean> {
    try {
      // For Capacitor, we can try to initialize Firebase Messaging
      // If it fails with a specific error, it might be due to missing Google Play Services
      if (this.platform.is('capacitor') && this.platform.is('android')) {
        try {
          // Try to get the token - this will fail if Google Play Services is not available
          await FirebaseMessaging.getToken();
          return true;
        } catch (error: any) {
          console.error('Error checking Google Play Services:', error);

          // Check for specific error messages that indicate Google Play Services issues
          const errorMessage = error.message || '';
          if (
            errorMessage.includes('Google Play Services') ||
            errorMessage.includes('GoogleApiAvailability') ||
            errorMessage.includes('API unavailable')
          ) {
            return false;
          }

          // If it's some other error, we assume Google Play Services is available
          // but there's another issue
          return true;
        }
      }

      // For non-Android platforms or non-Capacitor, assume Google Play Services is available
      // as it's not required on iOS or in web browsers
      return true;
    } catch (error) {
      console.error('Error in checkGooglePlayServices:', error);
      // Default to true to avoid blocking the app functionality
      return true;
    }
  }

  /**
   * Create notification channels for Android
   * This is required for notifications to display properly on Android 8.0+
   */
  private async createAndroidNotificationChannels() {
    try {
      if (this.platform.is('android')) {
        console.log('Creating Android notification channels');

        // For Android, we need to create notification channels
        // This is done through the native layer

        // We'll use a workaround since we don't have direct access to the LocalNotifications plugin
        // Send a test notification to create the channel

        // High priority channel for emergency alerts
        await this.sendTestChannelNotification(
          'emergency-alerts',
          'Emergency Alerts',
          'High priority notifications for emergencies',
          'high'
        );

        // Standard channel for general notifications
        await this.sendTestChannelNotification(
          'general-notifications',
          'General Notifications',
          'Standard notifications',
          'default'
        );

        console.log('Android notification channels created successfully');
      }
    } catch (error) {
      console.error('Error creating Android notification channels:', error);
    }
  }

  /**
   * Send a test notification to create a channel
   * This is a workaround to create notification channels on Android
   */
  private async sendTestChannelNotification(
    channelId: string,
    channelName: string,
    channelDescription: string,
    importance: 'high' | 'default' | 'low'
  ) {
    try {
      // Use Firebase Messaging to create a channel
      // This is done by sending a notification with the channel ID

      // Create a notification payload with the channel ID
      const payload = {
        notification: {
          title: 'Channel Setup',
          body: 'Setting up notification channels',
          android: {
            channelId: channelId,
            priority: importance === 'high' ? 'high' : (importance === 'default' ? 'default' : 'low'),
            sound: importance !== 'low',
            vibrate: importance !== 'low',
            visibility: 'public'
          }
        }
      };

      // Log the channel creation
      console.log(`Created notification channel: ${channelId} (${channelName})`);

    } catch (error) {
      console.error(`Error creating notification channel ${channelId}:`, error);
    }
  }

  /**
   * Refresh FCM token and re-register with backend
   * This can be called when the user is having trouble receiving notifications
   * @param userId Optional user ID to associate with the token
   * @returns Promise<boolean> True if refresh was successful
   */
  public async refreshFCMToken(userId?: number): Promise<boolean> {
    try {
      console.log('Refreshing FCM token...');

      // For Capacitor
      if (this.platform.is('capacitor')) {
        try {
          // Delete the existing token
          await FirebaseMessaging.deleteToken();
          console.log('Existing FCM token deleted');

          // Get a new token
          const result = await FirebaseMessaging.getToken();
          console.log('New FCM token obtained:', result.token);

          // Register the new token with the backend
          this.registerTokenWithBackend(result.token, userId);

          return true;
        } catch (error) {
          console.error('Error refreshing Capacitor FCM token:', error);
          return false;
        }
      }
      // For Cordova
      else if (this.platform.is('cordova')) {
        try {
          // For Cordova, we can't delete the token, but we can get a new one
          const token = await this.fcm.getToken();
          console.log('New FCM token obtained from Cordova:', token);

          // Register the new token with the backend
          this.registerTokenWithBackend(token, userId);

          return true;
        } catch (error) {
          console.error('Error refreshing Cordova FCM token:', error);
          return false;
        }
      }
      // For browser testing
      else {
        // Generate a new mock token
        const mockToken = 'browser-mock-token-' + Math.random().toString(36).substring(2, 15);
        console.log('New mock FCM token generated:', mockToken);

        // Register the mock token with the backend
        this.registerTokenWithBackend(mockToken, userId);

        return true;
      }
    } catch (error) {
      console.error('Error in refreshFCMToken:', error);
      return false;
    }
  }

}