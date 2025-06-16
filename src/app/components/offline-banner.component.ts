import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController, LoadingController, ToastController } from '@ionic/angular';
import { OfflineStorageService } from '../services/offline-storage.service';
import { OfflineMapService } from '../services/offline-map.service';
import { OfflineRoutingService } from '../services/offline-routing.service';
import { Geolocation } from '@capacitor/geolocation';

@Component({
  selector: 'app-offline-banner',
  template: `
    <div class="offline-banner" [ngClass]="getBannerClass()">
      <div class="banner-content">
        <ion-icon [name]="getBannerIcon()" class="banner-icon"></ion-icon>
        <div class="banner-text">
          <div class="banner-title">{{ getBannerTitle() }}</div>
          <div class="banner-subtitle">{{ getBannerSubtitle() }}</div>
        </div>
        <div class="banner-actions">
          <ion-button
            *ngIf="showOfflineButton()"
            fill="clear"
            size="small"
            color="light"
            (click)="enableOfflineMode()">
            Continue Offline
          </ion-button>
          <ion-button
            *ngIf="showOnlineButton()"
            fill="clear"
            size="small"
            color="light"
            (click)="disableOfflineMode()">
            <ion-icon name="wifi-outline"></ion-icon>
            Go Online
          </ion-button>
        </div>
      </div>

      <!-- Progress bar for data preparation -->
      <div *ngIf="isPreparingData" class="preparation-progress">
        <ion-progress-bar [value]="preparationProgress"></ion-progress-bar>
        <div class="progress-text">{{ preparationStatus }}</div>
      </div>
    </div>
  `,
  styles: [`
    .offline-banner {
      padding: 12px 16px;
      margin: 8px 16px;
      border-radius: 8px;
      transition: all 0.3s ease;
    }

    .offline-banner.online {
      background: linear-gradient(135deg, #28a745, #20c997);
      color: white;
    }

    .offline-banner.offline {
      background: linear-gradient(135deg, #dc3545, #fd7e14);
      color: white;
    }

    .offline-banner.preparing {
      background: linear-gradient(135deg, #007bff, #6610f2);
      color: white;
    }

    .offline-banner.warning {
      background: linear-gradient(135deg, #ffc107, #fd7e14);
      color: #212529;
    }

    .banner-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .banner-icon {
      font-size: 24px;
      flex-shrink: 0;
    }

    .banner-text {
      flex: 1;
    }

    .banner-title {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 2px;
    }

    .banner-subtitle {
      font-size: 12px;
      opacity: 0.9;
    }

    .banner-actions {
      display: flex;
      gap: 8px;
    }

    .preparation-progress {
      margin-top: 12px;
    }

    .progress-text {
      font-size: 12px;
      text-align: center;
      margin-top: 4px;
      opacity: 0.9;
    }

    ion-progress-bar {
      height: 4px;
      border-radius: 2px;
    }
  `],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class OfflineBannerComponent implements OnInit, OnDestroy {
  @Output() offlineModeEnabled = new EventEmitter<void>();
  @Output() dataSynced = new EventEmitter<void>();

  isOnline = navigator.onLine;
  isOfflineMode = false;
  hasOfflineData = false;
  isPreparingData = false;
  preparationProgress = 0;
  preparationStatus = '';
  lastSyncTime: string | null = null;

  private onlineListener?: () => void;
  private offlineListener?: () => void;

  constructor(
    private offlineStorage: OfflineStorageService,
    private offlineMap: OfflineMapService,
    private offlineRouting: OfflineRoutingService,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController
  ) {}

  async ngOnInit() {
    // Set up network listeners
    this.onlineListener = () => {
      this.isOnline = true;
      this.checkDataStatus();
      // Auto-sync when coming back online
      this.autoSyncDataIfNeeded();
    };

    this.offlineListener = () => {
      this.isOnline = false;
      this.checkDataStatus();
    };

    window.addEventListener('online', this.onlineListener);
    window.addEventListener('offline', this.offlineListener);

    // Initial status check
    await this.checkDataStatus();

    // Auto-sync data when component initializes and user is online
    this.autoSyncDataIfNeeded();
  }

  ngOnDestroy() {
    if (this.onlineListener) {
      window.removeEventListener('online', this.onlineListener);
    }
    if (this.offlineListener) {
      window.removeEventListener('offline', this.offlineListener);
    }
  }

  private async checkDataStatus() {
    // Check actual network connectivity first
    this.isOnline = navigator.onLine;
    this.isOfflineMode = this.offlineStorage.isOfflineMode();
    this.hasOfflineData = await this.offlineStorage.isDataAvailable();
    this.lastSyncTime = this.offlineStorage.getLastSyncTime();

    // If we're online but offline mode is enabled, show that we're using offline mode by choice
    console.log('🔍 OFFLINE BANNER: Network status check:', {
      navigatorOnline: navigator.onLine,
      isOfflineMode: this.isOfflineMode,
      hasOfflineData: this.hasOfflineData
    });
  }

  getBannerClass(): string {
    if (this.isPreparingData) return 'preparing';

    // If we're actually offline (no network)
    if (!this.isOnline) return 'offline';

    // If we're online but offline mode is manually enabled
    if (this.isOnline && this.isOfflineMode) return 'offline';

    // If we're online and not in offline mode
    if (this.isOnline && !this.isOfflineMode && !this.hasOfflineData) return 'warning';
    if (this.isOnline && !this.isOfflineMode && this.hasOfflineData) return 'online';

    return 'online';
  }

  getBannerIcon(): string {
    if (this.isPreparingData) return 'download-outline';
    if (!this.isOnline) return 'wifi-outline';
    if (this.isOnline && !this.hasOfflineData) return 'warning-outline';
    return 'checkmark-circle-outline';
  }

  getBannerTitle(): string {
    if (this.isPreparingData) return 'Updating Offline Data';

    // If we're actually offline (no network)
    if (!this.isOnline && this.hasOfflineData) return 'Offline Mode Available';
    if (!this.isOnline && !this.hasOfflineData) return 'No Internet Connection';

    // If we're online but offline mode is manually enabled
    if (this.isOnline && this.isOfflineMode && this.hasOfflineData) return 'Offline Mode (Manual)';
    if (this.isOnline && this.isOfflineMode && !this.hasOfflineData) return 'Offline Mode (No Data)';

    // If we're online and not in offline mode
    if (this.isOnline && !this.isOfflineMode && !this.hasOfflineData) return 'Online - Preparing Data';
    if (this.isOnline && !this.isOfflineMode && this.hasOfflineData) return 'Online & Ready';

    return 'Connected & Ready';
  }

  getBannerSubtitle(): string {
    if (this.isPreparingData) return this.preparationStatus;
    if (!this.isOnline && this.hasOfflineData) return 'Emergency data is available offline';
    if (!this.isOnline && !this.hasOfflineData) return 'Limited functionality available';
    if (this.isOnline && !this.hasOfflineData) return 'Downloading data automatically...';

    if (this.lastSyncTime) {
      const syncDate = new Date(this.lastSyncTime);
      return `Last updated: ${syncDate.toLocaleDateString()} ${syncDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    }
    return 'All systems operational';
  }

  showOfflineButton(): boolean {
    return !this.isOnline && !this.isOfflineMode && this.hasOfflineData;
  }

  showOnlineButton(): boolean {
    return this.isOnline && this.isOfflineMode && !this.isPreparingData;
  }

  // Removed manual sync and prepare buttons - everything is automatic now

  async enableOfflineMode() {
    const alert = await this.alertCtrl.create({
      header: 'Enable Offline Mode',
      message: 'Switch to offline mode to access cached evacuation data and maps?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Continue Offline',
          handler: () => {
            this.offlineStorage.setOfflineMode(true);
            this.isOfflineMode = true;
            this.offlineModeEnabled.emit();
            this.showToast('Offline mode enabled. Using cached data.', 'success');
          }
        }
      ]
    });

    await alert.present();
  }

  async disableOfflineMode() {
    const alert = await this.alertCtrl.create({
      header: 'Go Online',
      message: 'Switch back to online mode to get live data from the server?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Go Online',
          handler: () => {
            this.offlineStorage.setOfflineMode(false);
            this.isOfflineMode = false;
            this.checkDataStatus();
            this.showToast('Online mode enabled. Getting live data.', 'success');
          }
        }
      ]
    });

    await alert.present();
  }

  // Manual sync methods removed - everything is automatic now

  /**
   * Automatically sync data when online without user intervention
   */
  private async autoSyncDataIfNeeded() {
    // Only auto-sync if online and not already preparing data
    if (!this.isOnline || this.isPreparingData) {
      return;
    }

    try {
      // Check if we need to sync (no data or data is old)
      const needsSync = await this.shouldAutoSync();

      if (needsSync) {
        console.log('🔄 Auto-syncing offline data in background...');
        await this.performBackgroundSync();
      }
    } catch (error) {
      console.error('❌ Auto-sync failed:', error);
      // Fail silently - don't bother user with sync errors
    }
  }

  /**
   * Check if auto-sync is needed
   */
  private async shouldAutoSync(): Promise<boolean> {
    const hasData = await this.offlineStorage.isDataAvailable();
    const lastSync = this.offlineStorage.getLastSyncTime();

    // Always sync if no data
    if (!hasData) {
      return true;
    }

    // Sync if data is older than 6 hours
    if (lastSync) {
      const lastSyncDate = new Date(lastSync);
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
      return lastSyncDate < sixHoursAgo;
    }

    return true; // Sync if no last sync time
  }

  /**
   * Perform background sync without showing loading indicators
   */
  private async performBackgroundSync() {
    this.isPreparingData = true;
    this.preparationProgress = 0;
    this.preparationStatus = 'Updating offline data...';

    try {
      // Step 1: Sync evacuation centers (silent)
      const syncSuccess = await this.offlineStorage.syncEvacuationCenters();
      this.preparationProgress = 0.4;

      if (!syncSuccess) {
        throw new Error('Failed to sync evacuation centers');
      }

      // Step 2: Get user location (silent)
      try {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 5000
        });
        this.preparationProgress = 0.5;

        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        // Step 3: Cache map tiles (silent, smaller radius for background)
        this.preparationStatus = 'Updating maps...';
        await this.offlineMap.preloadMapTiles(
          userLat, userLng, 15, // Smaller 15km radius for background sync
          (current, total) => {
            const mapProgress = 0.5 + (current / total) * 0.4;
            this.preparationProgress = mapProgress;
          }
        );

        // Step 4: Pre-cache routes (silent)
        this.preparationStatus = 'Updating routes...';
        const centers = await this.offlineStorage.getEvacuationCenters();
        await this.offlineRouting.preCacheRoutes(userLat, userLng, centers.slice(0, 5)); // Cache fewer routes for background
        this.preparationProgress = 1.0;

      } catch (locationError) {
        console.log('📍 Location not available for background sync, skipping map/route cache');
        this.preparationProgress = 1.0;
      }

      this.preparationStatus = 'Data updated!';
      await this.checkDataStatus();

      // Hide preparation status after short delay
      setTimeout(() => {
        this.isPreparingData = false;
      }, 1500);

      console.log('✅ Background sync completed successfully');

    } catch (error) {
      console.error('❌ Background sync failed:', error);
      this.isPreparingData = false;
      // Don't show error toast for background sync failures
    }
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
}
