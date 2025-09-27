import { Injectable } from '@angular/core';
import { ToastController, AlertController } from '@ionic/angular';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export interface NotificationPayload {
  id: string;
  title: string;
  body: string;
  data?: {
    [key: string]: any;
  };
  timestamp: string;
  category?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  source: 'fcm' | 'local' | 'hardcoded';
}

export interface HardcodedNotification {
  id: string;
  title: string;
  message: string;
  type: 'emergency' | 'info' | 'warning' | 'success';
  duration?: number;
  showToast?: boolean;
  showAlert?: boolean;
  vibrate?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationPayloadService {
  private receivedNotifications: NotificationPayload[] = [];
  private hardcodedNotifications: HardcodedNotification[] = [];

  constructor(
    private toastController: ToastController,
    private alertController: AlertController
  ) {
    this.initializeHardcodedNotifications();
  }

  /**
   * Initialize hardcoded notifications for testing and demo purposes
   */
  private initializeHardcodedNotifications(): void {
    this.hardcodedNotifications = [
      {
        id: 'hardcoded-1',
        title: '🚨 Emergency Alert',
        message: 'This is a hardcoded emergency notification for testing purposes.',
        type: 'emergency',
        duration: 5000,
        showToast: true,
        showAlert: true,
        vibrate: true
      },
      {
        id: 'hardcoded-2',
        title: '📍 Evacuation Center Update',
        message: 'New evacuation center added in your area (Hardcoded notification).',
        type: 'info',
        duration: 4000,
        showToast: true,
        showAlert: false,
        vibrate: false
      },
      {
        id: 'hardcoded-3',
        title: '⚠️ Weather Warning',
        message: 'Severe weather conditions expected in your area (Hardcoded).',
        type: 'warning',
        duration: 4000,
        showToast: true,
        showAlert: true,
        vibrate: true
      },
      {
        id: 'hardcoded-4',
        title: '✅ System Update',
        message: 'Your app has been updated with new features (Hardcoded).',
        type: 'success',
        duration: 3000,
        showToast: true,
        showAlert: false,
        vibrate: false
      }
    ];
  }

  /**
   * Process incoming notification payload
   */
  async processNotificationPayload(payload: NotificationPayload): Promise<void> {
    console.log('🔔 Processing notification payload:', payload);

    // Store the notification
    this.receivedNotifications.unshift(payload);

    // Keep only last 50 notifications
    if (this.receivedNotifications.length > 50) {
      this.receivedNotifications = this.receivedNotifications.slice(0, 50);
    }

    // Display the notification
    await this.displayNotification(payload);

    // Log for debugging
    console.log('📱 Notification processed and displayed:', {
      id: payload.id,
      title: payload.title,
      source: payload.source,
      timestamp: payload.timestamp
    });
  }

  /**
   * Display notification based on its properties
   */
  private async displayNotification(payload: NotificationPayload): Promise<void> {
    try {
      // Determine display method based on severity and category
      const isEmergency = payload.severity === 'critical' || payload.severity === 'high';
      const isImportant = payload.category === 'emergency' || payload.category === 'evacuation';

      if (isEmergency || isImportant) {
        // Show alert for emergency/important notifications
        await this.showNotificationAlert(payload);
        // Also vibrate for emergency notifications
        if (isEmergency) {
          await this.triggerVibration('emergency');
        }
      } else {
        // Show toast for regular notifications
        await this.showNotificationToast(payload);
      }

      // Always try to show local notification in notification panel
      await this.showLocalNotification(payload);

    } catch (error) {
      console.error('Error displaying notification:', error);
    }
  }

  /**
   * Show notification as toast
   */
  private async showNotificationToast(payload: NotificationPayload): Promise<void> {
    const toast = await this.toastController.create({
      header: payload.title,
      message: payload.body,
      duration: this.getToastDuration(payload.severity),
      position: 'top',
      color: this.getToastColor(payload.severity),
      buttons: [
        {
          text: 'View',
          handler: () => {
            this.handleNotificationAction(payload);
          }
        },
        {
          text: 'Dismiss',
          role: 'cancel'
        }
      ]
    });

    await toast.present();
  }

  /**
   * Show notification as alert dialog
   */
  private async showNotificationAlert(payload: NotificationPayload): Promise<void> {
    const alert = await this.alertController.create({
      header: payload.title,
      message: payload.body,
      buttons: [
        {
          text: 'Dismiss',
          role: 'cancel'
        },
        {
          text: 'View Details',
          handler: () => {
            this.handleNotificationAction(payload);
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Show local notification in system notification panel
   */
  private async showLocalNotification(payload: NotificationPayload): Promise<void> {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: payload.title,
            body: payload.body,
            id: parseInt(payload.id.replace(/\D/g, '')) || Date.now(),
            schedule: { at: new Date(Date.now() + 100) },
            sound: this.getNotificationSound(payload.severity),
            extra: {
              ...payload.data,
              payload_id: payload.id,
              source: payload.source,
              timestamp: payload.timestamp
            }
          }
        ]
      });
    } catch (error) {
      console.error('Error showing local notification:', error);
    }
  }

  /**
   * Display hardcoded notification
   */
  async displayHardcodedNotification(notification: HardcodedNotification): Promise<void> {
    console.log('🔧 Displaying hardcoded notification:', notification);

    // Vibrate if enabled
    if (notification.vibrate) {
      await this.triggerVibration(notification.type);
    }

    // Show toast if enabled
    if (notification.showToast) {
      await this.showHardcodedToast(notification);
    }

    // Show alert if enabled
    if (notification.showAlert) {
      await this.showHardcodedAlert(notification);
    }

    // Convert to payload format and store
    const payload: NotificationPayload = {
      id: notification.id,
      title: notification.title,
      body: notification.message,
      timestamp: new Date().toISOString(),
      category: 'hardcoded',
      severity: this.mapTypeToSeverity(notification.type),
      source: 'hardcoded',
      data: {
        type: notification.type,
        hardcoded: true
      }
    };

    // Store in received notifications
    this.receivedNotifications.unshift(payload);

    // Show local notification
    await this.showLocalNotification(payload);
  }

  /**
   * Show hardcoded notification as toast
   */
  private async showHardcodedToast(notification: HardcodedNotification): Promise<void> {
    const toast = await this.toastController.create({
      header: notification.title,
      message: notification.message,
      duration: notification.duration || 4000,
      position: 'top',
      color: this.getHardcodedToastColor(notification.type),
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });

    await toast.present();
  }

  /**
   * Show hardcoded notification as alert
   */
  private async showHardcodedAlert(notification: HardcodedNotification): Promise<void> {
    const alert = await this.alertController.create({
      header: notification.title,
      message: notification.message,
      buttons: ['OK']
    });

    await alert.present();
  }

  /**
   * Trigger vibration based on notification type
   */
  private async triggerVibration(type: string): Promise<void> {
    try {
      if (type === 'emergency' || type === 'critical') {
        // Strong vibration pattern for emergencies
        await Haptics.impact({ style: ImpactStyle.Heavy });
        setTimeout(async () => {
          await Haptics.impact({ style: ImpactStyle.Heavy });
        }, 200);
        setTimeout(async () => {
          await Haptics.impact({ style: ImpactStyle.Heavy });
        }, 400);
      } else if (type === 'warning' || type === 'high') {
        // Medium vibration for warnings
        await Haptics.impact({ style: ImpactStyle.Medium });
        setTimeout(async () => {
          await Haptics.impact({ style: ImpactStyle.Medium });
        }, 150);
      } else {
        // Light vibration for regular notifications
        await Haptics.impact({ style: ImpactStyle.Light });
      }
    } catch (error) {
      console.error('Error triggering vibration:', error);
    }
  }

  /**
   * Handle notification action (when user interacts with notification)
   */
  private handleNotificationAction(payload: NotificationPayload): void {
    console.log('🔔 Notification action triggered:', payload);
    // Here you can implement navigation or other actions based on notification data
    // For example: navigate to specific pages, show detailed views, etc.
  }

  /**
   * Get toast duration based on severity
   */
  private getToastDuration(severity?: string): number {
    switch (severity) {
      case 'critical': return 8000;
      case 'high': return 6000;
      case 'medium': return 4000;
      case 'low': return 3000;
      default: return 4000;
    }
  }

  /**
   * Get toast color based on severity
   */
  private getToastColor(severity?: string): string {
    switch (severity) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'primary';
      case 'low': return 'medium';
      default: return 'primary';
    }
  }

  /**
   * Get hardcoded toast color based on type
   */
  private getHardcodedToastColor(type: string): string {
    switch (type) {
      case 'emergency': return 'danger';
      case 'warning': return 'warning';
      case 'success': return 'success';
      case 'info': return 'primary';
      default: return 'medium';
    }
  }

  /**
   * Get notification sound based on severity
   */
  private getNotificationSound(severity?: string): string {
    switch (severity) {
      case 'critical': return 'emergency';
      case 'high': return 'alert';
      default: return 'default';
    }
  }

  /**
   * Map hardcoded type to severity
   */
  private mapTypeToSeverity(type: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (type) {
      case 'emergency': return 'critical';
      case 'warning': return 'high';
      case 'info': return 'medium';
      case 'success': return 'low';
      default: return 'medium';
    }
  }

  /**
   * Get all received notifications
   */
  getReceivedNotifications(): NotificationPayload[] {
    return [...this.receivedNotifications];
  }

  /**
   * Get all hardcoded notifications
   */
  getHardcodedNotifications(): HardcodedNotification[] {
    return [...this.hardcodedNotifications];
  }

  /**
   * Trigger a specific hardcoded notification by ID
   */
  async triggerHardcodedNotification(id: string): Promise<void> {
    const notification = this.hardcodedNotifications.find(n => n.id === id);
    if (notification) {
      await this.displayHardcodedNotification(notification);
    } else {
      console.error('Hardcoded notification not found:', id);
    }
  }

  /**
   * Trigger all hardcoded notifications (for testing)
   */
  async triggerAllHardcodedNotifications(): Promise<void> {
    for (const notification of this.hardcodedNotifications) {
      await this.displayHardcodedNotification(notification);
      // Add delay between notifications
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Clear all received notifications
   */
  clearReceivedNotifications(): void {
    this.receivedNotifications = [];
  }

  /**
   * Get notification count
   */
  getNotificationCount(): number {
    return this.receivedNotifications.length;
  }
}