import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController, ToastController, LoadingController } from '@ionic/angular';
import { Router } from '@angular/router';
import { OfflineStorageService } from '../../services/offline-storage.service';
import { EmergencyContactsService, EmergencyContact, DisasterPreparednessInfo } from '../../services/emergency-contacts.service';

@Component({
  selector: 'app-offline-data',
  templateUrl: './offline-data.page.html',
  styleUrls: ['./offline-data.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class OfflineDataPage implements OnInit {
  public offlineDataSummary: any = null;
  public emergencyContacts: EmergencyContact[] = [];
  public disasterInfo: DisasterPreparednessInfo[] = [];
  public cacheMetadata: any[] = [];
  public isOnline = navigator.onLine;

  private offlineStorage = inject(OfflineStorageService);
  private emergencyContactsService = inject(EmergencyContactsService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);
  private router = inject(Router);

  async ngOnInit() {
    await this.loadOfflineData();
    this.setupNetworkListener();
  }

  private setupNetworkListener() {
    window.addEventListener('online', () => {
      this.isOnline = true;
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  async loadOfflineData() {
    const loading = await this.loadingCtrl.create({
      message: 'Loading offline data...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      // Load summary
      this.offlineDataSummary = await this.offlineStorage.getOfflineDataSummary();
      
      // Load emergency contacts
      this.emergencyContacts = await this.emergencyContactsService.getEmergencyContacts();
      
      // Load disaster info
      this.disasterInfo = await this.emergencyContactsService.getDisasterInfo();
      
      // Load cache metadata
      this.cacheMetadata = await this.offlineStorage.getCacheMetadata();

      console.log('Offline data loaded:', {
        summary: this.offlineDataSummary,
        contacts: this.emergencyContacts.length,
        disasterInfo: this.disasterInfo.length,
        metadata: this.cacheMetadata.length
      });
    } catch (error) {
      console.error('Failed to load offline data:', error);
      const toast = await this.toastCtrl.create({
        message: 'Failed to load offline data',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    } finally {
      await loading.dismiss();
    }
  }

  async clearAllCache() {
    const alert = await this.alertCtrl.create({
      header: 'Clear All Cache',
      message: 'This will remove all offline data including evacuation centers, emergency contacts, and user location. Are you sure?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Clear All',
          role: 'destructive',
          handler: async () => {
            await this.performClearCache();
          }
        }
      ]
    });
    await alert.present();
  }

  private async performClearCache() {
    const loading = await this.loadingCtrl.create({
      message: 'Clearing cache...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      await this.offlineStorage.clearAll();
      await this.loadOfflineData(); // Refresh the data
      
      const toast = await this.toastCtrl.create({
        message: 'All offline data cleared successfully',
        duration: 3000,
        color: 'success'
      });
      await toast.present();
    } catch (error) {
      console.error('Failed to clear cache:', error);
      const toast = await this.toastCtrl.create({
        message: 'Failed to clear cache',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    } finally {
      await loading.dismiss();
    }
  }

  async refreshOfflineData() {
    const loading = await this.loadingCtrl.create({
      message: 'Refreshing offline data...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      // Re-initialize emergency contacts (will fetch fresh data if online)
      await this.emergencyContactsService.initializeEmergencyContacts();
      
      // Reload all data
      await this.loadOfflineData();
      
      const toast = await this.toastCtrl.create({
        message: 'Offline data refreshed successfully',
        duration: 3000,
        color: 'success'
      });
      await toast.present();
    } catch (error) {
      console.error('Failed to refresh offline data:', error);
      const toast = await this.toastCtrl.create({
        message: 'Failed to refresh offline data',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    } finally {
      await loading.dismiss();
    }
  }

  formatCacheSize(sizeInKB: number): string {
    if (sizeInKB < 1024) {
      return `${sizeInKB} KB`;
    } else {
      return `${(sizeInKB / 1024).toFixed(1)} MB`;
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString();
  }

  getContactTypeIcon(type: string): string {
    const icons = {
      'police': 'shield-checkmark',
      'fire': 'flame',
      'medical': 'medical',
      'rescue': 'boat',
      'government': 'business',
      'utility': 'flash',
      'general': 'call'
    };
    return icons[type as keyof typeof icons] || 'call';
  }

  getContactTypeColor(type: string): string {
    const colors = {
      'police': 'primary',
      'fire': 'danger',
      'medical': 'success',
      'rescue': 'warning',
      'government': 'secondary',
      'utility': 'tertiary',
      'general': 'medium'
    };
    return colors[type as keyof typeof colors] || 'medium';
  }

  getDisasterIcon(disasterType: string): string {
    const icons = {
      'Earthquake': 'pulse',
      'Flood': 'water',
      'Typhoon': 'cloudy',
      'Fire': 'flame',
      'Landslide': 'triangle',
      'General': 'warning'
    };
    return icons[disasterType as keyof typeof icons] || 'warning';
  }

  async callEmergencyNumber(contact: EmergencyContact) {
    const alert = await this.alertCtrl.create({
      header: `Call ${contact.name}`,
      message: `Do you want to call ${contact.number}?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Call',
          handler: () => {
            window.open(`tel:${contact.number}`, '_system');
          }
        }
      ]
    });
    await alert.present();
  }

  goBack() {
    this.router.navigate(['/tabs/home']);
  }
}
