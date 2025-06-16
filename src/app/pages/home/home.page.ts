import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Subscription, interval } from 'rxjs';
import { OfflineBannerComponent } from '../../components/offline-banner.component';
import { OfflineStorageService } from '../../services/offline-storage.service';
import { NotificationService } from '../../services/notification.service';
import { EmergencyOverlayService } from '../../services/emergency-overlay.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, OfflineBannerComponent]
})
export class HomePage implements OnInit, OnDestroy {
  isOffline = false;
  unreadNotificationCount = 0;
  private notificationSubscription: Subscription | null = null;
  private pollSubscription: Subscription | null = null;

  constructor(
    private router: Router,
    private toastCtrl: ToastController,
    private http: HttpClient,
    private offlineStorage: OfflineStorageService,
    private notificationService: NotificationService,
    private emergencyOverlay: EmergencyOverlayService
  ) {
    // Make emergency overlay service available for testing in browser console
    (window as any).testEmergency = this.emergencyOverlay;
  }

  ngOnInit() {
    const savedOfflineStatus = localStorage.getItem('isOffline');
    this.isOffline = savedOfflineStatus === 'true';

    // Subscribe to notification count updates
    this.notificationSubscription = this.notificationService.unreadCount$.subscribe(count => {
      this.unreadNotificationCount = count;
    });

    // Load initial unread count
    this.loadUnreadCount();

    // Poll for unread count every 30 seconds
    this.pollSubscription = interval(30000).subscribe(() => {
      this.notificationService.refreshUnreadCount();
      // Also trigger background sync if needed
      this.triggerBackgroundSync();
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

  toggleStatus() {
    this.isOffline = !this.isOffline;
    localStorage.setItem('isOffline', String(this.isOffline));
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



  // Offline banner event handlers
  onOfflineModeEnabled() {
    console.log('🔄 Offline mode enabled from banner');
    this.isOffline = true;
    this.showToast('Offline mode enabled. Using cached data.', 'success');
  }

  onDataSynced() {
    console.log('🔄 Data synced from banner');
    this.showToast('Evacuation data updated successfully', 'success');
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  /**
   * Trigger background sync for offline data
   */
  private async triggerBackgroundSync() {
    if (navigator.onLine && !this.offlineStorage.isOfflineMode()) {
      try {
        const hasData = await this.offlineStorage.isDataAvailable();
        const lastSync = this.offlineStorage.getLastSyncTime();

        // Sync if no data or data is older than 1 hour
        let needsSync = !hasData;
        if (lastSync) {
          const lastSyncDate = new Date(lastSync);
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          needsSync = lastSyncDate < oneHourAgo;
        }

        if (needsSync) {
          console.log('🔄 Background sync triggered from home page');
          await this.offlineStorage.syncEvacuationCenters();
        }
      } catch (error) {
        console.log('Background sync failed silently:', error);
      }
    }
  }
}