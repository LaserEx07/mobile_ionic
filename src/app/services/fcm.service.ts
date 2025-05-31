import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { LocalNotifications } from '@capacitor/local-notifications';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FCMService {
  private fcmToken: string = '';

  constructor(
    private platform: Platform,
    private http: HttpClient
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

        console.log('FCM initialized successfully');
      } else {
        console.log('FCM not available on this platform');
      }
    } catch (error) {
      console.error('Error initializing FCM:', error);
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
    // Listen for messages when app is in foreground
    FirebaseMessaging.addListener('notificationReceived', (notification) => {
      console.log('FCM notification received:', notification);
      this.showLocalNotification(notification);
    });

    // Listen for notification actions (when user taps notification)
    FirebaseMessaging.addListener('notificationActionPerformed', (action) => {
      console.log('FCM notification action performed:', action);
      this.handleNotificationAction(action);
    });
  }

  /**
   * Show local notification for foreground messages
   */
  private async showLocalNotification(notification: any): Promise<void> {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: notification.title || 'Alerto Notification',
            body: notification.body || 'You have a new notification',
            id: Date.now(),
            schedule: { at: new Date(Date.now() + 1000) },
            sound: 'beep.wav',
            attachments: [],
            actionTypeId: '',
            extra: notification.data || {}
          }
        ]
      });
    } catch (error) {
      console.error('Error showing local notification:', error);
    }
  }

  /**
   * Handle notification action (when user taps notification)
   */
  private handleNotificationAction(action: any): void {
    console.log('Handling notification action:', action);

    // You can add navigation logic here based on notification data
    const notificationData = action.notification?.data;
    if (notificationData) {
      // Example: Navigate to specific page based on notification type
      // this.router.navigate(['/some-page'], { queryParams: notificationData });
    }
  }

  /**
   * Register FCM token with backend
   */
  private async registerTokenWithBackend(token: string): Promise<void> {
    try {
      const payload = {
        token: token,
        device_type: 'android',
        project_id: environment.firebase.projectId,
        user_id: this.getCurrentUserId() // You'll need to implement this
      };

      const endpoints = [
        `${environment.apiUrl}/device-token`,
        `${environment.apiUrl}/device-token/register`
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await this.http.post(endpoint, payload).toPromise();
          console.log(`FCM token registered with ${endpoint}:`, response);

          // Store token locally for recovery
          localStorage.setItem('fcm_token', token);
          break; // Success, no need to try other endpoints
        } catch (error) {
          console.error(`Error registering token with ${endpoint}:`, error);
          // Continue to next endpoint
        }
      }
    } catch (error) {
      console.error('Error registering FCM token with backend:', error);
    }
  }

  /**
   * Get current user ID (implement based on your auth system)
   */
  private getCurrentUserId(): number | null {
    // Implement this based on your authentication system
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        return userData.id || null;
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
    return null;
  }

  /**
   * Get current FCM token
   */
  getCurrentToken(): string {
    return this.fcmToken;
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
}
