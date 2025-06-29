import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { OfflineStorageService } from '../../services/offline-storage.service';

@Component({
  selector: 'app-offline-status',
  templateUrl: './offline-status.component.html',
  styleUrls: ['./offline-status.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class OfflineStatusComponent implements OnInit, OnDestroy {
  public isOnline = navigator.onLine;
  public hasOfflineData = false;
  public offlineDataSummary: any = null;
  public showDetails = false;

  private onlineSubscription?: Subscription;
  private offlineDataSubscription?: Subscription;
  private offlineStorage = inject(OfflineStorageService);

  ngOnInit() {
    this.setupNetworkListeners();
    this.setupOfflineDataListener();
    this.loadOfflineDataSummary();
  }

  ngOnDestroy() {
    this.onlineSubscription?.unsubscribe();
    this.offlineDataSubscription?.unsubscribe();
    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('offline', this.onOffline);
  }

  private setupNetworkListeners() {
    // Listen for network status changes
    window.addEventListener('online', this.onOnline);
    window.addEventListener('offline', this.onOffline);
  }

  private onOnline = () => {
    this.isOnline = true;
    console.log('📶 Network status: ONLINE');
  };

  private onOffline = () => {
    this.isOnline = false;
    console.log('📵 Network status: OFFLINE');
  };

  private setupOfflineDataListener() {
    this.offlineDataSubscription = this.offlineStorage.offlineDataAvailable$.subscribe(
      hasData => {
        this.hasOfflineData = hasData;
        if (hasData) {
          this.loadOfflineDataSummary();
        }
      }
    );
  }

  private async loadOfflineDataSummary() {
    try {
      this.offlineDataSummary = await this.offlineStorage.getOfflineDataSummary();
    } catch (error) {
      console.error('Failed to load offline data summary:', error);
    }
  }

  public toggleDetails() {
    this.showDetails = !this.showDetails;
    if (this.showDetails) {
      this.loadOfflineDataSummary();
    }
  }

  public getStatusText(): string {
    if (this.isOnline) {
      return this.hasOfflineData ? 'Online (Cached data available)' : 'Online';
    } else {
      return this.hasOfflineData ? 'Offline (Using cached data)' : 'Offline (No cached data)';
    }
  }

  public getStatusColor(): string {
    if (this.isOnline) {
      return 'success';
    } else {
      return this.hasOfflineData ? 'warning' : 'danger';
    }
  }

  public getStatusIcon(): string {
    if (this.isOnline) {
      return 'wifi';
    } else {
      return this.hasOfflineData ? 'cloud-offline' : 'cloud-offline-outline';
    }
  }

  public async clearOfflineData() {
    try {
      await this.offlineStorage.clearAll();
      this.hasOfflineData = false;
      this.offlineDataSummary = null;
      console.log('🧹 Cleared all offline data');
    } catch (error) {
      console.error('Failed to clear offline data:', error);
    }
  }

  public formatCacheSize(sizeInKB: number): string {
    if (sizeInKB < 1024) {
      return `${sizeInKB} KB`;
    } else {
      return `${(sizeInKB / 1024).toFixed(1)} MB`;
    }
  }
}
