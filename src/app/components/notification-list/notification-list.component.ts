import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FCMNotification, FcmService } from '../../services/fcm.service';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-notification-list',
  templateUrl: './notification-list.component.html',
  styleUrls: ['./notification-list.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class NotificationListComponent implements OnInit, OnDestroy {
  notifications: FCMNotification[] = [];
  private notificationSubscription: Subscription | null = null;

  constructor(
    private fcmService: FcmService,
    private router: Router
  ) {}

  ngOnInit() {
    // Subscribe to notifications
    this.notificationSubscription = this.fcmService.notifications$.subscribe(notification => {
      // Add new notifications to the top of the list
      this.notifications.unshift(notification);

      // Limit the list to the most recent 20 notifications
      if (this.notifications.length > 20) {
        this.notifications = this.notifications.slice(0, 20);
      }
    });
  }

  ngOnDestroy() {
    // Clean up subscription
    if (this.notificationSubscription) {
      this.notificationSubscription.unsubscribe();
    }
  }

  // Handle notification click
  onNotificationClick(notification: FCMNotification) {
    if (notification.category) {
      switch(notification.category.toLowerCase()) {
        case 'flood':
        case 'earthquake':
        case 'fire':
        case 'typhoon':
          // Navigate to home with the disaster type
          this.router.navigate(['/tabs/home'], {
            queryParams: {
              disasterType: notification.category,
              filterMode: 'true'
            }
          });
          break;
        default:
          // Default navigation
          this.router.navigate(['/tabs/home']);
          break;
      }
    } else {
      // Default navigation if no category
      this.router.navigate(['/tabs/home']);
    }
  }

  // Get appropriate icon based on notification category
  getNotificationIcon(notification: FCMNotification): string {
    if (!notification.category) return 'notifications-outline';

    switch(notification.category.toLowerCase()) {
      case 'flood':
        return 'water-outline';
      case 'earthquake':
        return 'pulse-outline';
      case 'fire':
        return 'flame-outline';
      case 'typhoon':
        return 'thunderstorm-outline';
      default:
        return 'notifications-outline';
    }
  }

  // Get color based on severity
  getSeverityColor(notification: FCMNotification): string {
    if (!notification.severity) return 'medium';

    switch(notification.severity.toLowerCase()) {
      case 'high':
        return 'danger';
      case 'medium':
        return 'warning';
      case 'low':
        return 'success';
      default:
        return 'medium';
    }
  }

  // Format the notification time
  formatTime(notification: FCMNotification): string {
    if (!notification['time']) return '';

    const date = new Date(notification['time']);
    return date.toLocaleString();
  }
}
