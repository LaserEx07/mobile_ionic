import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController, AlertController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { OfflineStorageService } from '../../services/offline-storage.service';

interface EvacuationCenter {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  capacity?: number;
  status?: string;
  disaster_type?: string;
  contact?: string;
}

@Component({
  selector: 'app-data-debug',
  templateUrl: './data-debug.page.html',
  styleUrls: ['./data-debug.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class DataDebugPage implements OnInit {
  
  public apiData: EvacuationCenter[] = [];
  public offlineData: EvacuationCenter[] = [];
  public apiError: string = '';
  public offlineError: string = '';
  public isLoading = false;
  
  public stats = {
    api: {
      total: 0,
      earthquake: 0,
      typhoon: 0,
      flood: 0
    },
    offline: {
      total: 0,
      earthquake: 0,
      typhoon: 0,
      flood: 0
    }
  };

  constructor(
    private http: HttpClient,
    private offlineStorage: OfflineStorageService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    this.loadAllData();
  }

  async loadAllData() {
    this.isLoading = true;
    
    // Test API data
    await this.testApiData();
    
    // Test offline data
    await this.testOfflineData();
    
    this.isLoading = false;
    
    // Show summary
    await this.showSummary();
  }

  async testApiData() {
    try {
      console.log('🔍 Testing API data...');
      this.apiData = await firstValueFrom(
        this.http.get<EvacuationCenter[]>(`${environment.apiUrl}/evacuation-centers`)
      );
      
      this.stats.api.total = this.apiData.length;
      this.stats.api.earthquake = this.apiData.filter(c => c.disaster_type === 'Earthquake').length;
      this.stats.api.typhoon = this.apiData.filter(c => c.disaster_type === 'Typhoon').length;
      this.stats.api.flood = this.apiData.filter(c => c.disaster_type === 'Flood').length;
      
      console.log('✅ API Data loaded:', this.stats.api);
      this.apiError = '';
      
    } catch (error: any) {
      console.error('❌ API Error:', error);
      this.apiError = `API Error: ${error.message || 'Unknown error'}`;
      this.apiData = [];
    }
  }

  async testOfflineData() {
    try {
      console.log('🔍 Testing offline data...');
      this.offlineData = await this.offlineStorage.getEvacuationCenters();
      
      this.stats.offline.total = this.offlineData.length;
      this.stats.offline.earthquake = this.offlineData.filter(c => c.disaster_type === 'Earthquake').length;
      this.stats.offline.typhoon = this.offlineData.filter(c => c.disaster_type === 'Typhoon').length;
      this.stats.offline.flood = this.offlineData.filter(c => c.disaster_type === 'Flood').length;
      
      console.log('✅ Offline Data loaded:', this.stats.offline);
      this.offlineError = '';
      
    } catch (error: any) {
      console.error('❌ Offline Error:', error);
      this.offlineError = `Offline Error: ${error.message || 'Unknown error'}`;
      this.offlineData = [];
    }
  }

  async syncOfflineData() {
    const loading = await this.toastCtrl.create({
      message: 'Syncing offline data...',
      duration: 0
    });
    await loading.present();

    try {
      const success = await this.offlineStorage.syncEvacuationCenters();
      await loading.dismiss();
      
      if (success) {
        await this.testOfflineData(); // Reload offline data
        const toast = await this.toastCtrl.create({
          message: '✅ Offline data synced successfully!',
          duration: 3000,
          color: 'success'
        });
        await toast.present();
      } else {
        const toast = await this.toastCtrl.create({
          message: '❌ Failed to sync offline data',
          duration: 3000,
          color: 'danger'
        });
        await toast.present();
      }
    } catch (error) {
      await loading.dismiss();
      const toast = await this.toastCtrl.create({
        message: `❌ Sync error: ${error}`,
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  async showSummary() {
    const message = `
📊 Data Summary:

🌐 API Data:
• Total: ${this.stats.api.total}
• Earthquake: ${this.stats.api.earthquake}
• Typhoon: ${this.stats.api.typhoon}
• Flood: ${this.stats.api.flood}

📱 Offline Data:
• Total: ${this.stats.offline.total}
• Earthquake: ${this.stats.offline.earthquake}
• Typhoon: ${this.stats.offline.typhoon}
• Flood: ${this.stats.offline.flood}

${this.apiError ? `⚠️ API Issues: ${this.apiError}` : ''}
${this.offlineError ? `⚠️ Offline Issues: ${this.offlineError}` : ''}
    `;

    const alert = await this.alertCtrl.create({
      header: 'Data Debug Summary',
      message: message,
      buttons: ['OK']
    });
    await alert.present();
  }

  async addSampleData() {
    const alert = await this.alertCtrl.create({
      header: 'Add Sample Data',
      message: 'This will add sample evacuation centers to the database. Continue?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Add Sample Data',
          handler: async () => {
            await this.createSampleData();
          }
        }
      ]
    });
    await alert.present();
  }

  async createSampleData() {
    const loading = await this.toastCtrl.create({
      message: 'Adding sample data...',
      duration: 0
    });
    await loading.present();

    try {
      // Call the backend endpoint to add sample data
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/add-sample-centers`, {})
      );
      
      await loading.dismiss();
      
      // Reload data
      await this.loadAllData();
      
      const toast = await this.toastCtrl.create({
        message: '✅ Sample data added successfully!',
        duration: 3000,
        color: 'success'
      });
      await toast.present();
      
    } catch (error) {
      await loading.dismiss();
      const toast = await this.toastCtrl.create({
        message: `❌ Failed to add sample data: ${error}`,
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  getStatusColor(hasData: boolean, hasError: boolean): string {
    if (hasError) return 'danger';
    if (hasData) return 'success';
    return 'warning';
  }

  getStatusIcon(hasData: boolean, hasError: boolean): string {
    if (hasError) return 'close-circle';
    if (hasData) return 'checkmark-circle';
    return 'warning';
  }
}
