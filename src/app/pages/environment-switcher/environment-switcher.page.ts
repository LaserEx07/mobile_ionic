import { Component, OnInit } from '@angular/core';
import { IonicModule, AlertController, LoadingController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { EnvironmentSwitcherService, ApiEndpoint } from '../../services/environment-switcher.service';

@Component({
  standalone: true,
  imports: [IonicModule, CommonModule],
  selector: 'app-environment-switcher',
  templateUrl: './environment-switcher.page.html',
  styleUrls: ['./environment-switcher.page.scss']
})
export class EnvironmentSwitcherPage implements OnInit {
  endpoints: (ApiEndpoint & { testResult?: any })[] = [];
  currentApiUrl = '';
  isLoading = false;

  constructor(
    private envSwitcher: EnvironmentSwitcherService,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadEndpoints();
    this.currentApiUrl = this.envSwitcher.getCurrentApiUrl();
  }

  loadEndpoints() {
    this.endpoints = this.envSwitcher.getApiEndpoints();
  }

  async selectEndpoint(endpoint: ApiEndpoint) {
    const alert = await this.alertController.create({
      header: 'Switch API Endpoint',
      message: `Switch to ${endpoint.name}?\n\n${endpoint.description}`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Switch',
          handler: () => {
            this.envSwitcher.setApiUrl(endpoint.url);
            this.currentApiUrl = endpoint.url;
            this.loadEndpoints();
            this.presentSuccessAlert('API endpoint switched successfully!');
          }
        }
      ]
    });

    await alert.present();
  }

  async testEndpoint(endpoint: ApiEndpoint) {
    const loading = await this.loadingController.create({
      message: `Testing ${endpoint.name}...`,
      duration: 10000
    });
    await loading.present();

    try {
      const result = await this.envSwitcher.testEndpoint(endpoint.url);
      
      // Update the endpoint with test result
      const index = this.endpoints.findIndex(e => e.url === endpoint.url);
      if (index !== -1) {
        this.endpoints[index].testResult = result;
      }

      await loading.dismiss();

      // Show result
      const alert = await this.alertController.create({
        header: 'Connection Test',
        message: `${endpoint.name}\n\n${result.message}`,
        buttons: ['OK']
      });
      await alert.present();

    } catch (error) {
      await loading.dismiss();
      this.presentErrorAlert('Test failed', 'Unable to test endpoint');
    }
  }

  async testAllEndpoints() {
    const loading = await this.loadingController.create({
      message: 'Testing all endpoints...',
      duration: 30000
    });
    await loading.present();

    try {
      const results = await this.envSwitcher.testAllEndpoints();
      this.endpoints = results;
      await loading.dismiss();

      // Find working endpoints
      const workingEndpoints = results.filter(r => r.testResult.success);
      
      if (workingEndpoints.length > 0) {
        const message = `Found ${workingEndpoints.length} working endpoint(s):\n\n` +
          workingEndpoints.map(e => `✅ ${e.name}`).join('\n');
        
        this.presentSuccessAlert(message);
      } else {
        this.presentErrorAlert('No Working Endpoints', 'All endpoints failed connectivity test');
      }

    } catch (error) {
      await loading.dismiss();
      this.presentErrorAlert('Test Failed', 'Unable to test endpoints');
    }
  }

  async autoDetect() {
    const loading = await this.loadingController.create({
      message: 'Auto-detecting best endpoint...',
      duration: 30000
    });
    await loading.present();

    try {
      const bestEndpoint = await this.envSwitcher.autoDetectBestEndpoint();
      await loading.dismiss();

      if (bestEndpoint) {
        this.currentApiUrl = bestEndpoint.url;
        this.loadEndpoints();
        this.presentSuccessAlert(`Auto-detected and switched to: ${bestEndpoint.name}`);
      } else {
        this.presentErrorAlert('Auto-Detection Failed', 'No working endpoints found');
      }

    } catch (error) {
      await loading.dismiss();
      this.presentErrorAlert('Auto-Detection Failed', 'Unable to detect working endpoint');
    }
  }

  getStatusIcon(endpoint: ApiEndpoint & { testResult?: any }): string {
    if (!endpoint.testResult) return 'help-circle-outline';
    return endpoint.testResult.success ? 'checkmark-circle' : 'close-circle';
  }

  getStatusColor(endpoint: ApiEndpoint & { testResult?: any }): string {
    if (!endpoint.testResult) return 'medium';
    return endpoint.testResult.success ? 'success' : 'danger';
  }

  goBack() {
    this.router.navigate(['/login']);
  }

  private async presentSuccessAlert(message: string) {
    const alert = await this.alertController.create({
      header: 'Success',
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  private async presentErrorAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }
}
