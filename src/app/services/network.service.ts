import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Platform, ToastController } from '@ionic/angular';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class NetworkService {

  constructor(
    private http: HttpClient,
    private platform: Platform,
    private toastCtrl: ToastController
  ) {}

  /**
   * Check if the backend API is reachable
   */
  async checkBackendConnectivity(): Promise<boolean> {
    try {
      console.log('Checking backend connectivity to:', environment.apiUrl);

      // First try the test endpoint with timeout using RxJS
      const testResponse = await firstValueFrom(
        this.http.get(`${environment.apiUrl.replace('/api', '')}/api/test`).pipe(
          timeout(10000)
        )
      );
      console.log('Backend test endpoint successful:', testResponse);

      // Then try evacuation centers endpoint with timeout
      const response = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/evacuation-centers`).pipe(
          timeout(10000)
        )
      );
      console.log('Backend connectivity check successful');
      return true;
    } catch (error: any) {
      console.error('Backend connectivity check failed:', error);
      console.error('Error details:', {
        status: error.status,
        statusText: error.statusText,
        url: error.url,
        message: error.message
      });

      if (error.status === 0) {
        // DISABLED: Network errors are now handled by offline banner
        // this.showConnectivityError('Backend Server',
        //   'Cannot connect to the backend server.\n\n' +
        //   'Troubleshooting steps:\n' +
        //   '• Check if both devices are on the same WiFi\n' +
        //   '• Verify server is running on computer\n' +
        //   '• Check Windows Firewall settings\n' +
        //   '• Try restarting the backend server\n\n' +
        //   `Server: ${environment.apiUrl}`);
        console.log('Backend server not reachable - offline mode available');
      } else {
        console.log('Backend is reachable but returned an error:', error.status);
        return true; // Server is reachable, just returned an error
      }

      return false;
    }
  }

  /**
   * Check if Mapbox API is reachable
   */
  async checkMapboxConnectivity(): Promise<boolean> {
    try {
      console.log('Checking Mapbox connectivity...');

      // Simple test request to Mapbox API
      const testUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/121.7740,12.8797;121.7750,12.8807?access_token=${environment.mapboxAccessToken}&overview=simplified`;

      const response = await firstValueFrom(
        this.http.get(testUrl)
      );

      console.log('Mapbox connectivity check successful');
      return true;
    } catch (error: any) {
      console.error('Mapbox connectivity check failed:', error);

      if (error.status === 0) {
        this.showConnectivityError('Mapbox', 'Cannot connect to Mapbox API. Please check your internet connection.');
      } else if (error.status === 401) {
        this.showConnectivityError('Mapbox', 'Invalid Mapbox access token. Please check your token.');
      } else if (error.status === 403) {
        this.showConnectivityError('Mapbox', 'Mapbox access denied. Please check your token permissions.');
      } else if (error.status === 429) {
        this.showConnectivityError('Mapbox', 'Too many requests to Mapbox. Please wait and try again.');
      }

      return false;
    }
  }

  /**
   * Check overall network connectivity
   */
  async checkNetworkConnectivity(): Promise<{backend: boolean, routing: boolean}> {
    console.log('Starting comprehensive network connectivity check...');

    const results = {
      backend: false,
      routing: false
    };

    // Check backend connectivity
    results.backend = await this.checkBackendConnectivity();

    // Check routing service connectivity
    results.routing = await this.checkMapboxConnectivity();

    console.log('Network connectivity check results:', results);
    return results;
  }

  /**
   * Show connectivity error message
   */
  private async showConnectivityError(service: string, message: string) {
    const toast = await this.toastCtrl.create({
      header: `${service} Connection Error`,
      message: message,
      duration: 5000,
      color: 'danger',
      buttons: [
        {
          text: 'Dismiss',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }

  /**
   * Test network connectivity with a simple ping
   */
  async pingTest(): Promise<boolean> {
    try {
      // Use a reliable service for ping test
      const response = await firstValueFrom(
        this.http.get('https://httpbin.org/get')
      );
      return true;
    } catch (error) {
      console.error('Ping test failed:', error);
      return false;
    }
  }

  /**
   * Get network status information
   */
  getNetworkInfo(): any {
    if (this.platform.is('capacitor')) {
      // On mobile devices, you could use Capacitor Network plugin
      // For now, return basic info
      return {
        platform: 'mobile',
        userAgent: navigator.userAgent
      };
    } else {
      return {
        platform: 'web',
        online: navigator.onLine,
        userAgent: navigator.userAgent
      };
    }
  }
}
