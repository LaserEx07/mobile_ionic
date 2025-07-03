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
  type: 'evacuation_center_added' | 'emergency_alert' | 'system_update' | 'general';
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
        await this.routeToDisasterMap(disasterType, notification);
        break;
      default:
        // Handle other notification types
        break;
    }
  }

  extractDisasterType(notification: AppNotification): string {
    const message = notification.message.toLowerCase();
    const title = notification.title.toLowerCase();
    const combinedText = `${message} ${title}`;

    if (combinedText.includes('earthquake')) return 'earthquake';
    if (combinedText.includes('typhoon')) return 'typhoon';
    if (combinedText.includes('flood')) return 'flood';
    if (combinedText.includes('fire')) return 'fire';
    if (combinedText.includes('landslide')) return 'landslide';
    if (combinedText.includes('others:') || combinedText.includes('other')) return 'others';

    return 'all';
  }

  /**
   * Route to appropriate disaster map based on disaster type
   */
  private async routeToDisasterMap(disasterType: string, notification: AppNotification): Promise<void> {
    try {
      console.log(`🗺️ Routing to ${disasterType} disaster map from notification...`);

      // Map specific disaster types to their dedicated maps
      const disasterRoutes: { [key: string]: string } = {
        'earthquake': '/tabs/earthquake-map',
        'flood': '/tabs/flood-map',
        'typhoon': '/tabs/typhoon-map',
        'landslide': '/tabs/landslide-map',
        'fire': '/tabs/fire-map'
      };

      let route: string;

      // Check if this disaster has a specific map, otherwise use general map
      if (disasterRoutes[disasterType]) {
        route = disasterRoutes[disasterType];
      } else {
        // "others" category and unknown disasters go to general map
        route = '/tabs/map';
      }

      // Navigate to the appropriate map with emergency parameters
      await this.router.navigate([route], {
        queryParams: {
          emergency: true,
          autoRoute: true,
          notification: true,
          category: disasterType,
          severity: 'high', // Default to high for emergency alerts
          timestamp: Date.now(),
          title: notification.title,
          message: notification.message
        }
      });

      console.log(`✅ Successfully routed to ${route} for ${disasterType} disaster`);
    } catch (error) {
      console.error('Error routing to disaster map:', error);

      // Fallback to general map if specific routing fails
      await this.router.navigate(['/tabs/map'], {
        queryParams: {
          disasterType: disasterType,
          emergency: true,
          notification: true
        }
      });
    }
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
