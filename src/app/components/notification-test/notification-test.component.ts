import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FCMService } from '../../services/fcm.service';
import { NotificationPayloadService } from '../../services/notification-payload.service';

@Component({
  selector: 'app-notification-test',
  templateUrl: './notification-test.component.html',
  styleUrls: ['./notification-test.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class NotificationTestComponent {

  constructor(
    private fcmService: FCMService,
    private notificationPayloadService: NotificationPayloadService
  ) {}

  /**
   * Test regular hardcoded notification
   */
  async testRegularNotification() {
    try {
      console.log('🧪 Testing regular hardcoded notification...');
      await this.fcmService.displayHardcodedNotification('regular');
    } catch (error) {
      console.error('❌ Error testing regular notification:', error);
    }
  }

  /**
   * Test emergency hardcoded notification
   */
  async testEmergencyNotification() {
    try {
      console.log('🚨 Testing emergency hardcoded notification...');
      await this.fcmService.displayHardcodedNotification('emergency');
    } catch (error) {
      console.error('❌ Error testing emergency notification:', error);
    }
  }

  /**
   * Test payload notification
   */
  async testPayloadNotification() {
    try {
      console.log('📦 Testing payload notification...');
      
      // Simulate a payload notification
      const mockPayload = {
        id: `test_payload_${Date.now()}`,
        title: 'Test Payload Notification',
        body: 'This is a test notification with payload data',
        data: {
          notification_id: `test_${Date.now()}`,
          category: 'test',
          severity: 'medium',
          type: 'payload_test',
          action: 'view_details'
        },
        timestamp: new Date().toISOString(),
        source: 'local' as const
      };

      // Process through notification payload service
      await this.notificationPayloadService.processNotificationPayload(mockPayload);
      
    } catch (error) {
      console.error('❌ Error testing payload notification:', error);
    }
  }

  /**
   * Test complete notification system
   */
  async testCompleteSystem() {
    try {
      console.log('🔄 Testing complete notification system...');
      await this.fcmService.testNotificationSystem();
    } catch (error) {
      console.error('❌ Error testing complete system:', error);
    }
  }
}