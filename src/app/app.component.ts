import { Component } from '@angular/core';
import { Platform } from '@ionic/angular';
import { registerIcons } from './icons';
import { FCMService } from './services/fcm.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: false
})
export class AppComponent {
  constructor(
    private platform: Platform,
    private fcmService: FCMService
  ) {
    // Register all Ionicons used in the app
    try {
      registerIcons();
    } catch (error) {
      console.log('Error registering icons:', error);
    }

    this.initializeApp();
  }

  initializeApp() {
    this.platform.ready().then(() => {
      try {
        console.log('App initialization started');

        // Check for notification in URL parameters
        this.checkForNotificationInUrl();

        // Initialize FCM
        this.initializeFCM();

        console.log('App initialization completed successfully');
      } catch (error) {
        console.error('Error during app initialization:', error);
      }
    }).catch(error => {
      console.error('Error in platform.ready():', error);
    });
  }

  /**
   * Initialize FCM service
   */
  private async initializeFCM() {
    try {
      console.log('Initializing FCM...');
      await this.fcmService.initializeFCM();
      console.log('FCM initialized successfully');

      // Retry token registration if it failed previously
      setTimeout(() => {
        this.fcmService.retryTokenRegistration();
      }, 2000); // Wait 2 seconds before retrying

    } catch (error) {
      console.error('Error initializing FCM:', error);
    }
  }

  /**
   * Check for notification data in URL parameters
   */
  private checkForNotificationInUrl() {
    try {
      const url = new URL(window.location.href);
      const notificationParam = url.searchParams.get('notification');

      if (notificationParam) {
        try {
          // Parse the notification data
          const notification = JSON.parse(decodeURIComponent(notificationParam));
          console.log('Notification received from URL:', notification);

          // Remove the parameter from the URL to prevent showing it again on refresh
          url.searchParams.delete('notification');
          window.history.replaceState({}, document.title, url.toString());
        } catch (e) {
          console.error('Error parsing notification from URL:', e);
        }
      }
    } catch (error) {
      console.error('Error checking for notification in URL:', error);
    }
  }
}