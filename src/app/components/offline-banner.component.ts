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
            *ngIf="showSyncButton()" 
            fill="clear" 
            size="small" 
            color="light"
            (click)="syncData()">
            <ion-icon name="sync-outline"></ion-icon>
            Sync
          </ion-button>
          <ion-button 
            *ngIf="showPrepareButton()" 
            fill="clear" 
            size="small" 
            color="light"
            (click)="prepareOfflineData()">
            <ion-icon name="download-outline"></ion-icon>
            Prepare
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
    };
    
    this.offlineListener = () => {
      this.isOnline = false;
      this.checkDataStatus();
    };

    window.addEventListener('online', this.onlineListener);
    window.addEventListener('offline', this.offlineListener);

    // Initial status check
    await this.checkDataStatus();
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
    this.isOfflineMode = this.offlineStorage.isOfflineMode();
    this.hasOfflineData = await this.offlineStorage.isDataAvailable();
    this.lastSyncTime = this.offlineStorage.getLastSyncTime();
  }

  getBannerClass(): string {
    if (this.isPreparingData) return 'preparing';
    if (!this.isOnline) return 'offline';
    if (this.isOnline && !this.hasOfflineData) return 'warning';
    return 'online';
  }

  getBannerIcon(): string {
    if (this.isPreparingData) return 'download-outline';
    if (!this.isOnline) return 'wifi-outline';
    if (this.isOnline && !this.hasOfflineData) return 'warning-outline';
    return 'checkmark-circle-outline';
  }

  getBannerTitle(): string {
    if (this.isPreparingData) return 'Preparing Offline Data';
    if (!this.isOnline && this.hasOfflineData) return 'Offline Mode Available';
    if (!this.isOnline && !this.hasOfflineData) return 'No Internet Connection';
    if (this.isOnline && !this.hasOfflineData) return 'Offline Data Not Ready';
    return 'Connected & Ready';
  }

  getBannerSubtitle(): string {
    if (this.isPreparingData) return this.preparationStatus;
    if (!this.isOnline && this.hasOfflineData) return 'Emergency data is available offline';
    if (!this.isOnline && !this.hasOfflineData) return 'Limited functionality available';
    if (this.isOnline && !this.hasOfflineData) return 'Prepare offline data for emergencies';
    
    if (this.lastSyncTime) {
      const syncDate = new Date(this.lastSyncTime);
      return `Last synced: ${syncDate.toLocaleDateString()}`;
    }
    return 'All systems operational';
  }

  showOfflineButton(): boolean {
    return !this.isOnline && !this.isOfflineMode && this.hasOfflineData;
  }

  showSyncButton(): boolean {
    return this.isOnline && this.hasOfflineData && !this.isPreparingData;
  }

  showPrepareButton(): boolean {
    return this.isOnline && !this.hasOfflineData && !this.isPreparingData;
  }

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

  async syncData() {
    const loading = await this.loadingCtrl.create({
      message: 'Syncing evacuation data...'
    });
    await loading.present();

    try {
      const success = await this.offlineStorage.syncEvacuationCenters();
      await loading.dismiss();

      if (success) {
        this.dataSynced.emit();
        this.checkDataStatus();
        this.showToast('Data synced successfully', 'success');
      } else {
        this.showToast('Sync failed. Please try again.', 'danger');
      }
    } catch (error) {
      await loading.dismiss();
      this.showToast('Sync error. Check your connection.', 'danger');
    }
  }

  async prepareOfflineData() {
    const alert = await this.alertCtrl.create({
      header: 'Prepare Offline Data',
      message: 'Download evacuation centers and map data for offline use? This may take a few minutes and use mobile data.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Download',
          handler: () => this.startDataPreparation()
        }
      ]
    });

    await alert.present();
  }

  private async startDataPreparation() {
    this.isPreparingData = true;
    this.preparationProgress = 0;

    try {
      // Step 1: Sync evacuation centers
      this.preparationStatus = 'Downloading evacuation centers...';
      const syncSuccess = await this.offlineStorage.syncEvacuationCenters();
      this.preparationProgress = 0.3;

      if (!syncSuccess) {
        throw new Error('Failed to sync evacuation centers');
      }

      // Step 2: Get user location for map caching
      this.preparationStatus = 'Getting your location...';
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      });
      this.preparationProgress = 0.4;

      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;

      // Step 3: Cache map tiles
      this.preparationStatus = 'Downloading map tiles...';
      await this.offlineMap.preloadMapTiles(
        userLat, userLng, 25, // 25km radius
        (current, total) => {
          const mapProgress = 0.4 + (current / total) * 0.4; // 40% of total progress
          this.preparationProgress = mapProgress;
          this.preparationStatus = `Downloading map tiles... ${current}/${total}`;
        }
      );

      // Step 4: Pre-cache routes
      this.preparationStatus = 'Pre-caching routes...';
      const centers = await this.offlineStorage.getEvacuationCenters();
      await this.offlineRouting.preCacheRoutes(userLat, userLng, centers.slice(0, 10)); // Cache routes to nearest 10 centers
      this.preparationProgress = 1.0;

      this.preparationStatus = 'Preparation complete!';
      await this.checkDataStatus();
      
      setTimeout(() => {
        this.isPreparingData = false;
        this.showToast('Offline data prepared successfully!', 'success');
      }, 1000);

    } catch (error) {
      console.error('Data preparation failed:', error);
      this.isPreparingData = false;
      this.showToast('Failed to prepare offline data. Please try again.', 'danger');
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
