import { Component, OnInit } from '@angular/core';
import { IonicModule, ToastController, LoadingController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { NetworkService } from '../../services/network.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-network-diagnostics',
  templateUrl: './network-diagnostics.page.html',
  styleUrls: ['./network-diagnostics.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class NetworkDiagnosticsPage implements OnInit {

  diagnostics = {
    backend: { status: 'pending', message: 'Checking...' },
    routing: { status: 'pending', message: 'Checking...' },
    internet: { status: 'pending', message: 'Checking...' }
  };

  networkInfo: any = {};
  isRunning = false;

  constructor(
    private networkService: NetworkService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) { }

  ngOnInit() {
    this.networkInfo = this.networkService.getNetworkInfo();
    this.runDiagnostics();
  }

  async runDiagnostics() {
    this.isRunning = true;
    
    const loading = await this.loadingCtrl.create({
      message: 'Running network diagnostics...'
    });
    await loading.present();

    try {
      // Reset diagnostics
      this.diagnostics = {
        backend: { status: 'pending', message: 'Checking backend connectivity...' },
        routing: { status: 'pending', message: 'Checking routing service...' },
        internet: { status: 'pending', message: 'Checking internet connectivity...' }
      };

      // Test internet connectivity
      const internetOk = await this.networkService.pingTest();
      this.diagnostics.internet = {
        status: internetOk ? 'success' : 'error',
        message: internetOk ? 'Internet connection is working' : 'No internet connection detected'
      };

      // Test backend connectivity
      const backendOk = await this.networkService.checkBackendConnectivity();
      this.diagnostics.backend = {
        status: backendOk ? 'success' : 'error',
        message: backendOk ? 
          `Backend server is reachable at ${environment.apiUrl}` : 
          `Cannot connect to backend server at ${environment.apiUrl}`
      };

      // Test routing service connectivity
      const routingOk = await this.networkService.checkOpenRouteServiceConnectivity();
      this.diagnostics.routing = {
        status: routingOk ? 'success' : 'error',
        message: routingOk ? 
          'OpenRouteService API is working' : 
          'Cannot connect to OpenRouteService API'
      };

    } catch (error) {
      console.error('Error running diagnostics:', error);
      
      const toast = await this.toastCtrl.create({
        message: 'Error running network diagnostics',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    } finally {
      await loading.dismiss();
      this.isRunning = false;
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'success': return 'checkmark-circle';
      case 'error': return 'close-circle';
      case 'pending': return 'time';
      default: return 'help-circle';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'success': return 'success';
      case 'error': return 'danger';
      case 'pending': return 'warning';
      default: return 'medium';
    }
  }

  async showNetworkHelp() {
    const toast = await this.toastCtrl.create({
      header: 'Network Troubleshooting',
      message: `
        • Check your WiFi or mobile data connection
        • Make sure the backend server is running on ${environment.apiUrl}
        • Verify your OpenRouteService API key is valid
        • Try switching between WiFi and mobile data
      `,
      duration: 10000,
      buttons: ['OK']
    });
    await toast.present();
  }
}
