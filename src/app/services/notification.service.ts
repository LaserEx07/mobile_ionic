import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

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

export interface NotificationResponse {
  notifications: AppNotification[];
  unread_count: number;
  has_more: boolean;
  current_page: number;
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  /**
   * Get notifications for the current user
   */
  getNotifications(page: number = 1, perPage: number = 20, type?: string): Observable<NotificationResponse> {
    let params: any = { page, per_page: perPage };
    if (type) {
      params.type = type;
    }

    return this.http.get<NotificationResponse>(`${environment.apiUrl}/notifications`, {
      headers: this.getHeaders(),
      params
    });
  }

  /**
   * Get unread notification count
   */
  getUnreadCount(): Observable<{ unread_count: number }> {
    return this.http.get<{ unread_count: number }>(`${environment.apiUrl}/notifications/unread-count`, {
      headers: this.getHeaders()
    });
  }

  /**
   * Mark a notification as read
   */
  markAsRead(notificationId: number): Observable<any> {
    return this.http.put(`${environment.apiUrl}/notifications/${notificationId}/read`, {}, {
      headers: this.getHeaders()
    });
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(): Observable<any> {
    return this.http.put(`${environment.apiUrl}/notifications/mark-all-read`, {}, {
      headers: this.getHeaders()
    });
  }

  /**
   * Delete a notification
   */
  deleteNotification(notificationId: number): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/notifications/${notificationId}`, {
      headers: this.getHeaders()
    });
  }

  /**
   * Add reaction to a notification
   */
  addReaction(notificationId: number): Observable<any> {
    return this.http.post(`${environment.apiUrl}/notifications/${notificationId}/reaction`, {}, {
      headers: this.getHeaders()
    });
  }

  /**
   * Get notification statistics
   */
  getStats(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/notifications/stats`, {
      headers: this.getHeaders()
    });
  }

  /**
   * Update the unread count
   */
  updateUnreadCount(count: number) {
    this.unreadCountSubject.next(count);
  }

  /**
   * Refresh unread count from server
   */
  async refreshUnreadCount() {
    try {
      const response = await this.getUnreadCount().toPromise();
      if (response) {
        this.updateUnreadCount(response.unread_count);
      }
    } catch (error) {
      console.error('Error refreshing unread count:', error);
    }
  }

  /**
   * Get notification icon based on type
   */
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

  /**
   * Get notification color based on type
   */
  getNotificationColor(notification: AppNotification): string {
    switch (notification.type) {
      case 'evacuation_center_added':
        return '#42b883';
      case 'emergency_alert':
        return '#e41e3f';
      case 'system_update':
        return '#1877f2';
      default:
        return '#03b2dd';
    }
  }

  /**
   * Format time ago
   */
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
