import { Component, OnInit } from '@angular/core';
import { IonicModule, Platform, AlertController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { FcmService } from '../../services/fcm.service';

interface DiagnosticResult {
  test: string;
  status: 'success' | 'error' | 'warning' | 'pending';
  message: string;
  details?: any;
}

@Component({
  selector: 'app-login-debug',
  templateUrl: './login-debug.page.html',
  styleUrls: ['./login-debug.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class LoginDebugPage implements OnInit {

  diagnostics: DiagnosticResult[] = [];
  isRunning = false;

  testCredentials = {
    email: 'test@example.com',
    password: 'password123'
  };

  constructor(
    private http: HttpClient,
    private platform: Platform,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private authService: AuthService,
    private fcmService: FcmService
  ) { }

  ngOnInit() {
    this.runDiagnostics();
  }

  async runDiagnostics() {
    this.isRunning = true;
    this.diagnostics = [];

    // Test 1: Platform Detection
    await this.testPlatform();

    // Test 2: Network Connectivity
    await this.testNetworkConnectivity();

    // Test 3: Backend Connectivity
    await this.testBackendConnectivity();

    // Test 4: API Endpoint Accessibility
    await this.testApiEndpoints();

    // Test 5: CORS Configuration
    await this.testCorsConfiguration();

    // Test 6: FCM Token Generation
    await this.testFcmToken();

    // Test 7: LocalStorage Functionality
    await this.testLocalStorage();

    // Test 8: Login API Call
    await this.testLoginApi();

    this.isRunning = false;

    // Show summary
    await this.showDiagnosticSummary();
  }

  async testPlatform() {
    const result: DiagnosticResult = {
      test: 'Platform Detection',
      status: 'pending',
      message: 'Detecting platform...'
    };
    this.diagnostics.push(result);

    try {
      const platformInfo = {
        isMobile: this.platform.is('mobile'),
        isAndroid: this.platform.is('android'),
        isIOS: this.platform.is('ios'),
        isCordova: this.platform.is('cordova'),
        isCapacitor: this.platform.is('capacitor'),
        isBrowser: !this.platform.is('cordova') && !this.platform.is('capacitor'),
        userAgent: navigator.userAgent
      };

      result.status = 'success';
      result.message = `Platform: ${this.platform.is('android') ? 'Android' : this.platform.is('ios') ? 'iOS' : 'Browser'}`;
      result.details = platformInfo;
    } catch (error) {
      result.status = 'error';
      result.message = `Platform detection failed: ${error}`;
    }
  }

  async testNetworkConnectivity() {
    const result: DiagnosticResult = {
      test: 'Network Connectivity',
      status: 'pending',
      message: 'Testing network connectivity...'
    };
    this.diagnostics.push(result);

    try {
      const isOnline = navigator.onLine;

      if (isOnline) {
        // Test external connectivity
        const response = await firstValueFrom(
          this.http.get('https://httpbin.org/get')
        );

        result.status = 'success';
        result.message = 'Network connectivity: Online';
        result.details = { online: isOnline, externalTest: 'success' };
      } else {
        result.status = 'error';
        result.message = 'Network connectivity: Offline';
        result.details = { online: isOnline };
      }
    } catch (error) {
      result.status = 'warning';
      result.message = `Network test failed: ${error}`;
      result.details = { online: navigator.onLine, error: error };
    }
  }

  async testBackendConnectivity() {
    const result: DiagnosticResult = {
      test: 'Backend Connectivity',
      status: 'pending',
      message: 'Testing backend server connectivity...'
    };
    this.diagnostics.push(result);

    try {
      console.log('Testing backend at:', environment.apiUrl);

      const testUrl = environment.apiUrl.replace('/api', '/up'); // Laravel health check
      const response = await firstValueFrom(
        this.http.get(testUrl)
      );

      result.status = 'success';
      result.message = `Backend server accessible at ${environment.apiUrl}`;
      result.details = { url: testUrl, response: response };
    } catch (error: any) {
      result.status = 'error';
      result.message = `Backend server not accessible: ${error.status || 'Network error'}`;
      result.details = {
        url: environment.apiUrl,
        error: error.message || error,
        status: error.status,
        statusText: error.statusText
      };
    }
  }

  async testApiEndpoints() {
    const result: DiagnosticResult = {
      test: 'API Endpoints',
      status: 'pending',
      message: 'Testing API endpoints...'
    };
    this.diagnostics.push(result);

    try {
      // Test evacuation centers endpoint (public)
      const centersResponse = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/evacuation-centers`)
      );

      result.status = 'success';
      result.message = 'API endpoints accessible';
      result.details = {
        evacuationCenters: Array.isArray(centersResponse) ? centersResponse.length : 'Invalid response'
      };
    } catch (error: any) {
      result.status = 'error';
      result.message = `API endpoints not accessible: ${error.status || 'Network error'}`;
      result.details = { error: error.message || error };
    }
  }

  async testCorsConfiguration() {
    const result: DiagnosticResult = {
      test: 'CORS Configuration',
      status: 'pending',
      message: 'Testing CORS configuration...'
    };
    this.diagnostics.push(result);

    try {
      // Make a preflight request to test CORS
      const response = await firstValueFrom(
        this.http.options(`${environment.apiUrl}/test`, {
          headers: { 'Content-Type': 'application/json' }
        })
      );

      result.status = 'success';
      result.message = 'CORS configuration working';
      result.details = { response: response };
    } catch (error: any) {
      if (error.status === 0) {
        result.status = 'error';
        result.message = 'CORS error: Request blocked by browser';
      } else {
        result.status = 'warning';
        result.message = `CORS test inconclusive: ${error.status}`;
      }
      result.details = { error: error };
    }
  }

  async testFcmToken() {
    const result: DiagnosticResult = {
      test: 'FCM Token Generation',
      status: 'pending',
      message: 'Testing FCM token generation...'
    };
    this.diagnostics.push(result);

    try {
      const token = await this.fcmService.getToken();

      if (token) {
        result.status = 'success';
        result.message = 'FCM token generated successfully';
        result.details = { tokenLength: token.length, tokenPreview: token.substring(0, 20) + '...' };
      } else {
        result.status = 'warning';
        result.message = 'FCM token generation returned empty';
        result.details = { token: token };
      }
    } catch (error) {
      result.status = 'error';
      result.message = `FCM token generation failed: ${error}`;
      result.details = { error: error };
    }
  }

  async testLocalStorage() {
    const result: DiagnosticResult = {
      test: 'LocalStorage Functionality',
      status: 'pending',
      message: 'Testing localStorage functionality...'
    };
    this.diagnostics.push(result);

    try {
      const testKey = 'diagnostic_test';
      const testValue = 'test_value_' + Date.now();

      // Test write
      localStorage.setItem(testKey, testValue);

      // Test read
      const retrievedValue = localStorage.getItem(testKey);

      // Test delete
      localStorage.removeItem(testKey);

      if (retrievedValue === testValue) {
        result.status = 'success';
        result.message = 'LocalStorage working correctly';
        result.details = { test: 'passed' };
      } else {
        result.status = 'error';
        result.message = 'LocalStorage read/write failed';
        result.details = { expected: testValue, actual: retrievedValue };
      }
    } catch (error) {
      result.status = 'error';
      result.message = `LocalStorage error: ${error}`;
      result.details = { error: error };
    }
  }

  async testLoginApi() {
    const result: DiagnosticResult = {
      test: 'Login API Call',
      status: 'pending',
      message: 'Testing login API call...'
    };
    this.diagnostics.push(result);

    try {
      // Make a test login call (this will likely fail with 401, but we're testing connectivity)
      const response = await firstValueFrom(
        this.http.post(`${environment.apiUrl}/auth/login`, this.testCredentials)
      );

      result.status = 'success';
      result.message = 'Login API call successful (unexpected!)';
      result.details = { response: response };
    } catch (error: any) {
      if (error.status === 401) {
        result.status = 'success';
        result.message = 'Login API reachable (401 expected for test credentials)';
        result.details = { status: error.status, message: 'API working correctly' };
      } else if (error.status === 0) {
        result.status = 'error';
        result.message = 'Login API not reachable (network error)';
        result.details = { error: 'Network connectivity issue' };
      } else {
        result.status = 'warning';
        result.message = `Login API returned unexpected status: ${error.status}`;
        result.details = { status: error.status, error: error.message };
      }
    }
  }

  async showDiagnosticSummary() {
    const successCount = this.diagnostics.filter(d => d.status === 'success').length;
    const errorCount = this.diagnostics.filter(d => d.status === 'error').length;
    const warningCount = this.diagnostics.filter(d => d.status === 'warning').length;

    let message = `Diagnostics Complete:\n✅ ${successCount} passed\n⚠️ ${warningCount} warnings\n❌ ${errorCount} failed`;

    if (errorCount > 0) {
      message += '\n\nCheck the failed tests to identify login issues.';
    }

    const alert = await this.alertCtrl.create({
      header: 'Diagnostic Results',
      message: message,
      buttons: ['OK']
    });

    await alert.present();
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'success': return 'checkmark-circle';
      case 'error': return 'close-circle';
      case 'warning': return 'warning';
      case 'pending': return 'time';
      default: return 'help-circle';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'success': return 'success';
      case 'error': return 'danger';
      case 'warning': return 'warning';
      case 'pending': return 'medium';
      default: return 'medium';
    }
  }

  async showDetails(diagnostic: DiagnosticResult) {
    const alert = await this.alertCtrl.create({
      header: diagnostic.test,
      message: `Status: ${diagnostic.message}\n\nDetails: ${JSON.stringify(diagnostic.details, null, 2)}`,
      buttons: ['OK']
    });

    await alert.present();
  }

  getApiUrl(): string {
    return environment.apiUrl;
  }

  isProduction(): boolean {
    return environment.production;
  }

  getPlatformInfo(): string {
    if (this.platform.is('android')) return 'Android';
    if (this.platform.is('ios')) return 'iOS';
    if (this.platform.is('capacitor')) return 'Capacitor';
    if (this.platform.is('cordova')) return 'Cordova';
    return 'Browser';
  }
}
