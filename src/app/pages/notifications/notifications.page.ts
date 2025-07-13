import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Subscription } from 'rxjs';

export interface AppNotification {
  id: number;
  type: 'evacuation_center_added' | 'evacuation_center_full' | 'emergency_alert' | 'system_update' | 'general';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  created_at: string;
  updated_at: string;
  reactions?: number;
  user_id?: number;
}

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class NotificationsPage implements OnInit, OnDestroy {
  notifications: AppNotification[] = [];
  filteredNotifications: AppNotification[] = [];
  activeTab: 'all' | 'unread' = 'all';
  unreadCount = 0;
  isLoading = false;
  hasMoreNotifications = false;
  currentPage = 1;
  private notificationSubscription: Subscription | null = null;

  constructor(
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.loadNotifications();
    // FCM subscription temporarily disabled
    // this.subscribeToNewNotifications();
  }

  ngOnDestroy() {
    if (this.notificationSubscription) {
      this.notificationSubscription.unsubscribe();
    }
  }

  async loadNotifications() {
    this.isLoading = true;
    try {
      const response = await this.http.get<{
        notifications: AppNotification[],
        unread_count: number,
        has_more: boolean
      }>(`${environment.apiUrl}/notifications?page=${this.currentPage}`).toPromise();

      if (response) {
        if (this.currentPage === 1) {
          this.notifications = response.notifications;
        } else {
          this.notifications.push(...response.notifications);
        }
        this.unreadCount = response.unread_count;
        this.hasMoreNotifications = response.has_more;
        this.filterNotifications();
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      this.isLoading = false;
    }
  }

  subscribeToNewNotifications() {
    // FCM functionality temporarily disabled
    console.log('FCM subscription temporarily disabled');
    // TODO: Re-enable when FCM service is restored
  }

  mapFCMTypeToAppType(category?: string): AppNotification['type'] {
    switch (category?.toLowerCase()) {
      case 'evacuation':
      case 'evacuation_center':
        return 'evacuation_center_added';
      case 'emergency':
      case 'earthquake':
      case 'typhoon':
      case 'flood':
        return 'emergency_alert';
      case 'system':
        return 'system_update';
      default:
        return 'general';
    }
  }

  setActiveTab(tab: 'all' | 'unread') {
    this.activeTab = tab;
    this.filterNotifications();
  }

  filterNotifications() {
    if (this.activeTab === 'unread') {
      this.filteredNotifications = this.notifications.filter(n => !n.read);
    } else {
      this.filteredNotifications = this.notifications;
    }
  }

  async onNotificationClick(notification: AppNotification) {
    // Mark as read if unread
    if (!notification.read) {
      await this.markAsRead(notification);
    }

    // Navigate based on notification type
    switch (notification.type) {
      case 'evacuation_center_added':
        // Extract center data from notification
        const centerData = notification.data ? JSON.parse(notification.data) : null;
        if (centerData && centerData.center_id) {
          // Navigate to map with specific center highlighted
          this.router.navigate(['/tabs/map'], {
            queryParams: {
              centerId: centerData.center_id,
              highlight: true,
              disasterType: 'all'
            }
          });
        } else {
          // Fallback to general map
          this.router.navigate(['/tabs/map'], {
            queryParams: {
              disasterType: 'all',
              showNewCenters: true
            }
          });
        }
        break;
      case 'emergency_alert':
        const disasterType = this.extractDisasterType(notification);
        this.router.navigate(['/tabs/map'], {
          queryParams: {
            disasterType: disasterType
          }
        });
        break;
      default:
        // Handle other notification types
        break;
    }
  }

  extractDisasterType(notification: AppNotification): string {
    const message = notification.message.toLowerCase();
    if (message.includes('earthquake')) return 'Earthquake';
    if (message.includes('typhoon')) return 'Typhoon';
    if (message.includes('flood')) return 'Flood';
    return 'all';
  }

  async markAsRead(notification: AppNotification) {
    try {
      await this.http.put(`${environment.apiUrl}/notifications/${notification.id}/read`, {}).toPromise();
      notification.read = true;
      this.unreadCount = Math.max(0, this.unreadCount - 1);
      this.filterNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  async markAllAsRead() {
    try {
      await this.http.put(`${environment.apiUrl}/notifications/mark-all-read`, {}).toPromise();
      this.notifications.forEach(n => n.read = true);
      this.unreadCount = 0;
      this.filterNotifications();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }

  loadMoreNotifications() {
    if (!this.isLoading && this.hasMoreNotifications) {
      this.currentPage++;
      this.loadNotifications();
    }
  }

  seeAllNotifications() {
    this.setActiveTab('all');
  }

  goBack() {
    this.router.navigate(['/tabs/home']);
  }

  trackByNotificationId(index: number, notification: AppNotification): number {
    return notification.id;
  }

  getNotificationIcon(notification: AppNotification): string {
    switch (notification.type) {
      case 'evacuation_center_added':
        return 'assets/evacuation-center-icon.png';
      case 'emergency_alert':
        return 'assets/emergency-icon.png';
      case 'system_update':
        return 'assets/system-icon.png';
      default:
        return 'assets/alerto_icon.png';
    }
  }

  getBadgeIcon(notification: AppNotification): string {
    switch (notification.type) {
      case 'evacuation_center_added':
        return 'add-circle';
      case 'emergency_alert':
        return 'warning';
      case 'system_update':
        return 'settings';
      default:
        return 'notifications';
    }
  }

  getIconBadgeClass(notification: AppNotification): string {
    switch (notification.type) {
      case 'evacuation_center_added':
        return 'badge-success';
      case 'emergency_alert':
        return 'badge-danger';
      case 'system_update':
        return 'badge-info';
      default:
        return 'badge-primary';
    }
  }

  getNotificationTitle(notification: AppNotification): string {
    switch (notification.type) {
      case 'evacuation_center_added':
        const data = notification.data ? JSON.parse(notification.data) : null;
        if (data && data.center_name) {
          return `New Evacuation Center: ${data.center_name}`;
        }
        return 'New evacuation center added.';
      case 'emergency_alert':
        return notification.title;
      default:
        return notification.title;
    }
  }

  getNotificationDescription(notification: AppNotification): string {
    if (notification.type === 'evacuation_center_added') {
      const data = notification.data ? JSON.parse(notification.data) : null;
      if (data) {
        const disasterTypes = Array.isArray(data.disaster_types)
          ? data.disaster_types.join(', ')
          : data.disaster_types || 'Emergency';
        return `Added in ${data.barangay || 'your area'} for ${disasterTypes} emergencies. Tap to view on map.`;
      }
    }
    return notification.message;
  }

  getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    return `${Math.floor(diffInSeconds / 604800)}w`;
  }
}
