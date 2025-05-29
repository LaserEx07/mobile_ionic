import { Component } from '@angular/core';
import { IonicModule, AlertController, LoadingController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FcmService, FCMNotification } from '../../services/fcm.service';

@Component({
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
  selector: 'app-notification-test',
  templateUrl: './notification-test.page.html',
  styleUrls: ['./notification-test.page.scss']
})
export class NotificationTestPage {
  testNotifications = [
    {
      title: 'EARTHQUAKE ALERT',
      body: 'Magnitude 7.2 earthquake detected. Evacuate to nearest safe area immediately.',
      category: 'earthquake',
      severity: 'high'
    },
    {
      title: 'FLOOD WARNING',
      body: 'Flash flood warning in your area. Move to higher ground immediately.',
      category: 'flood',
      severity: 'high'
    },
    {
      title: 'TYPHOON ALERT',
      body: 'Typhoon approaching. Seek shelter in a sturdy building.',
      category: 'typhoon',
      severity: 'medium'
    },
    {
      title: 'FIRE EMERGENCY',
      body: 'Fire reported in your vicinity. Evacuate the area immediately.',
      category: 'fire',
      severity: 'high'
    },
    {
      title: 'GENERAL ALERT',
      body: 'Emergency situation detected. Follow local authorities instructions.',
      category: 'general',
      severity: 'medium'
    }
  ];

  constructor(
    private fcmService: FcmService,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private router: Router
  ) {}

  async testForegroundNotification(notification: any) {
    const loading = await this.loadingController.create({
      message: 'Testing foreground notification...',
      duration: 3000
    });
    await loading.present();

    try {
      // Create a mock FCM notification
      const mockNotification: FCMNotification = {
        title: notification.title,
        body: notification.body,
        category: notification.category,
        severity: notification.severity,
        wasTapped: false,
        data: {
          category: notification.category,
          severity: notification.severity
        }
      };

      // Simulate foreground notification
      await this.fcmService.simulateForegroundNotification(mockNotification);
      
      await loading.dismiss();
      
      const alert = await this.alertController.create({
        header: 'Test Complete',
        message: 'Foreground notification test completed. Check if the emergency modal appeared.',
        buttons: ['OK']
      });
      await alert.present();

    } catch (error) {
      await loading.dismiss();
      
      const alert = await this.alertController.create({
        header: 'Test Failed',
        message: `Error testing notification: ${error}`,
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  async testBackgroundNotification(notification: any) {
    const loading = await this.loadingController.create({
      message: 'Testing background notification...',
      duration: 3000
    });
    await loading.present();

    try {
      // Create a mock FCM notification
      const mockNotification: FCMNotification = {
        title: notification.title,
        body: notification.body,
        category: notification.category,
        severity: notification.severity,
        wasTapped: true, // Simulate background tap
        data: {
          category: notification.category,
          severity: notification.severity
        }
      };

      // Simulate background notification tap
      await this.fcmService.simulateBackgroundNotification(mockNotification);
      
      await loading.dismiss();
      
      const alert = await this.alertController.create({
        header: 'Test Complete',
        message: 'Background notification test completed. Check if the emergency modal appeared.',
        buttons: ['OK']
      });
      await alert.present();

    } catch (error) {
      await loading.dismiss();
      
      const alert = await this.alertController.create({
        header: 'Test Failed',
        message: `Error testing notification: ${error}`,
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  async testAllNotifications() {
    const loading = await this.loadingController.create({
      message: 'Testing all notification types...',
      duration: 15000
    });
    await loading.present();

    try {
      for (let i = 0; i < this.testNotifications.length; i++) {
        const notification = this.testNotifications[i];
        
        // Wait between notifications
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

        const mockNotification: FCMNotification = {
          title: notification.title,
          body: notification.body,
          category: notification.category,
          severity: notification.severity,
          wasTapped: false,
          data: {
            category: notification.category,
            severity: notification.severity
          }
        };

        await this.fcmService.simulateForegroundNotification(mockNotification);
      }
      
      await loading.dismiss();
      
      const alert = await this.alertController.create({
        header: 'All Tests Complete',
        message: 'All notification types have been tested. Check if emergency modals appeared for each.',
        buttons: ['OK']
      });
      await alert.present();

    } catch (error) {
      await loading.dismiss();
      
      const alert = await this.alertController.create({
        header: 'Test Failed',
        message: `Error during batch testing: ${error}`,
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  getDisasterIcon(category: string): string {
    switch (category.toLowerCase()) {
      case 'earthquake': return 'warning-outline';
      case 'flood': return 'water-outline';
      case 'typhoon': return 'cloudy-outline';
      case 'fire': return 'flame-outline';
      default: return 'notifications-outline';
    }
  }

  getDisasterColor(category: string): string {
    switch (category.toLowerCase()) {
      case 'earthquake': return 'warning';
      case 'flood': return 'primary';
      case 'typhoon': return 'success';
      case 'fire': return 'danger';
      default: return 'medium';
    }
  }

  goBack() {
    this.router.navigate(['/tabs/profile']);
  }
}
