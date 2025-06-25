import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Subscription, interval } from 'rxjs';
import { NotificationService } from '../../services/notification.service';
import { EmergencyOverlayService } from '../../services/emergency-overlay.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class HomePage implements OnInit, OnDestroy {
  unreadNotificationCount = 0;
  private notificationSubscription: Subscription | null = null;
  private pollSubscription: Subscription | null = null;

  constructor(
    private router: Router,
    private toastCtrl: ToastController,
    private http: HttpClient,
    private notificationService: NotificationService,
    private emergencyOverlay: EmergencyOverlayService
  ) {
    // Make emergency overlay service available for testing in browser console
    (window as any).testEmergency = this.emergencyOverlay;
  }

  ngOnInit() {
    // Subscribe to notification count updates
    this.notificationSubscription = this.notificationService.unreadCount$.subscribe(count => {
      this.unreadNotificationCount = count;
    });

    // Load initial unread count
    this.loadUnreadCount();

    // Poll for unread count every 30 seconds
    this.pollSubscription = interval(30000).subscribe(() => {
      this.notificationService.refreshUnreadCount();
    });
  }

  ngOnDestroy() {
    if (this.notificationSubscription) {
      this.notificationSubscription.unsubscribe();
    }
    if (this.pollSubscription) {
      this.pollSubscription.unsubscribe();
    }
  }



  openDisasterMap(disasterType: string) {
    console.log(`🏠 HOME: Opening disaster-specific map for: ${disasterType}`);

    // Map the disaster type to display names and routes
    let displayName = disasterType;
    let route = '';

    if (disasterType === 'earthquake') {
      displayName = 'Earthquake';
      route = '/earthquake-map';
    } else if (disasterType === 'typhoon') {
      displayName = 'Typhoon';
      route = '/typhoon-map';
    } else if (disasterType === 'flashflood') {
      displayName = 'Flash Flood';
      route = '/flood-map';
    } else if (disasterType === 'fire') {
      displayName = 'Fire';
      route = '/fire-map';
    } else if (disasterType === 'landslide') {
      displayName = 'Landslide';
      route = '/landslide-map';
    }

    console.log(`🏠 HOME: Navigating to ${route} for ${displayName}`);

    // Show loading toast
    this.toastCtrl.create({
      message: `🗺️ Opening ${displayName} evacuation centers...`,
      duration: 2000,
      color: 'primary'
    }).then(toast => toast.present());

    // Navigate to the disaster-specific map
    this.router.navigate([route]);
  }

  viewMap() {
    console.log(`🏠 HOME: Opening complete evacuation centers map`);

    // Show loading toast
    this.toastCtrl.create({
      message: '🗺️ Opening complete evacuation centers map...',
      duration: 2000,
      color: 'secondary'
    }).then(toast => toast.present());

    // Navigate to the all-maps page
    this.router.navigate(['/all-maps']);
  }

  async loadUnreadCount() {
    try {
      // Use the notification service instead of direct HTTP call
      await this.notificationService.refreshUnreadCount();

      // Subscribe to unread count updates
      this.notificationService.unreadCount$.subscribe(count => {
        this.unreadNotificationCount = count;
      });
    } catch (error) {
      console.error('Error loading unread notification count:', error);
    }
  }

  openNotifications() {
    this.router.navigate(['/notifications']);
  }




}