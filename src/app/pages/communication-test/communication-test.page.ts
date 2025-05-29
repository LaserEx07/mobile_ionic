import { Component, OnInit } from '@angular/core';
import { CommunicationTestService, CommunicationStatus, CommunicationTestResult } from '../../services/communication-test.service';
import { LoadingController, ToastController, AlertController } from '@ionic/angular';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-communication-test',
  templateUrl: './communication-test.page.html',
  styleUrls: ['./communication-test.page.scss'],
})
export class CommunicationTestPage implements OnInit {
  status: CommunicationStatus | null = null;
  isLoading = false;
  environment = environment;

  constructor(
    private communicationTest: CommunicationTestService,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.communicationTest.status$.subscribe(status => {
      this.status = status;
    });
  }

  async runFullTest() {
    const loading = await this.loadingController.create({
      message: 'Testing communication...',
      spinner: 'crescent'
    });
    await loading.present();

    this.isLoading = true;

    try {
      const result = await this.communicationTest.runFullCommunicationTest();
      
      const toast = await this.toastController.create({
        message: `Communication test completed. Status: ${result.overallStatus}`,
        duration: 3000,
        color: result.overallStatus === 'connected' ? 'success' : 
               result.overallStatus === 'partial' ? 'warning' : 'danger',
        position: 'top'
      });
      await toast.present();
      
    } catch (error) {
      const toast = await this.toastController.create({
        message: 'Communication test failed',
        duration: 3000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
    } finally {
      this.isLoading = false;
      await loading.dismiss();
    }
  }

  async quickTest() {
    const loading = await this.loadingController.create({
      message: 'Quick connectivity test...',
      spinner: 'dots'
    });
    await loading.present();

    try {
      const isConnected = await this.communicationTest.quickConnectivityTest();
      
      const toast = await this.toastController.create({
        message: isConnected ? 'Backend is reachable!' : 'Backend is not reachable',
        duration: 2000,
        color: isConnected ? 'success' : 'danger',
        position: 'top'
      });
      await toast.present();
      
    } catch (error) {
      const toast = await this.toastController.create({
        message: 'Quick test failed',
        duration: 2000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
    } finally {
      await loading.dismiss();
    }
  }

  async showResultDetails(result: CommunicationTestResult) {
    const alert = await this.alertController.create({
      header: result.endpoint,
      subHeader: result.success ? 'Success' : 'Failed',
      message: `
        <strong>Message:</strong> ${result.message}<br>
        <strong>Response Time:</strong> ${result.responseTime}ms<br>
        ${result.error ? `<strong>Error:</strong> ${result.error}<br>` : ''}
        ${result.data ? `<strong>Data:</strong> ${JSON.stringify(result.data, null, 2)}` : ''}
      `,
      buttons: ['OK']
    });
    await alert.present();
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'connected': return 'success';
      case 'partial': return 'warning';
      case 'disconnected': return 'danger';
      default: return 'medium';
    }
  }

  getStatusIcon(success: boolean): string {
    return success ? 'checkmark-circle' : 'close-circle';
  }

  getStatusIconColor(success: boolean): string {
    return success ? 'success' : 'danger';
  }

  async showEnvironmentInfo() {
    const alert = await this.alertController.create({
      header: 'Environment Configuration',
      message: `
        <strong>API URL:</strong> ${environment.apiUrl}<br>
        <strong>Health Check URL:</strong> ${environment.healthCheckUrl}<br>
        <strong>Firebase Project:</strong> ${environment.firebase.projectId}<br>
        <strong>Timeout:</strong> ${environment.communication.timeoutMs}ms<br>
        <strong>Retry Attempts:</strong> ${environment.communication.retryAttempts}
      `,
      buttons: ['OK']
    });
    await alert.present();
  }
}
