import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, IonButton } from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';
import { NotificationBannerService, ActiveAlert } from '../../services/notification-banner.service';

@Component({
  selector: 'app-notification-banner',
  templateUrl: './notification-banner.component.html',
  styleUrls: ['./notification-banner.component.scss'],
  standalone: true,
  imports: [CommonModule, IonIcon, IonButton]
})
export class NotificationBannerComponent implements OnInit, OnDestroy {
  activeAlert: ActiveAlert | null = null;
  private subscription: Subscription = new Subscription();

  constructor(private notificationBannerService: NotificationBannerService) {}

  ngOnInit() {
    // Subscribe to active alerts
    this.subscription.add(
      this.notificationBannerService.activeAlert$.subscribe((alert: ActiveAlert | null) => {
        this.activeAlert = alert;
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  /**
   * Dismiss the current alert banner
   */
  dismissAlert() {
    this.notificationBannerService.dismissAlert();
  }

  /**
   * View full alert details
   */
  viewAlert() {
    if (this.activeAlert) {
      this.notificationBannerService.viewAlert(this.activeAlert);
    }
  }

  /**
   * Get severity class for styling
   */
  getSeverityClass(): string {
    if (!this.activeAlert) return '';
    return `severity-${this.activeAlert.severity}`;
  }

  /**
   * Get category icon
   */
  getCategoryIcon(): string {
    if (!this.activeAlert) return 'alert-circle';
    
    const iconMap: { [key: string]: string } = {
      'Earthquake': 'pulse',
      'Flood': 'water',
      'Typhoon': 'cloudy',
      'Fire': 'flame',
      'Landslide': 'triangle',
      'General': 'alert-circle'
    };
    
    return iconMap[this.activeAlert.category] || 'alert-circle';
  }

  /**
   * Get formatted time since alert
   */
  getTimeSince(): string {
    if (!this.activeAlert) return '';
    
    const now = new Date();
    const alertTime = new Date(this.activeAlert.timestamp);
    const diffMs = now.getTime() - alertTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }
}