import { Component, OnInit } from '@angular/core';
import { IonicModule, AlertController, Platform } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FCM } from '@awesome-cordova-plugins/fcm/ngx';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { FcmService } from '../../services/fcm.service';
import { OfflineStorageService } from '../../services/offline-storage.service';
import { NetworkService } from '../../services/network.service';

@Component({
  standalone: true,
  imports: [IonicModule, FormsModule],
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  credentials = {
    email: '',
    password: ''
  };
  errorMessage = '';
  fcmToken: string = '';
  private fcmTokenReady = false;

  // Add the goToRegister method
  goToRegister() {
    this.router.navigate(['/register']);
  }

  openNetworkDiagnostics() {
    this.router.navigate(['/network-diagnostics']);
  }

  openEnvironmentSwitcher() {
    this.router.navigate(['/environment-switcher']);
  }

  constructor(
    private router: Router,
    private authService: AuthService,
    private fcm: FCM,
    private http: HttpClient,
    private alertController: AlertController,
    private platform: Platform,
    private fcmService: FcmService,
    private offlineStorage: OfflineStorageService,
    private networkService: NetworkService
  ) {}

  async ngOnInit() {
    console.log('🔥 Login page initializing...');
    // Initialize FCM and get token
    await this.initializeFCM();
  }

  /**
   * Initialize FCM service and get token
   */
  async initializeFCM() {
    try {
      console.log('🔥 Initializing FCM for login...');

      // Initialize FCM service first
      await this.fcmService.initPush();

      // Get FCM token
      await this.getFCMToken();

      console.log('✅ FCM initialization complete, token ready:', !!this.fcmToken);
      this.fcmTokenReady = true;
    } catch (error) {
      console.error('❌ FCM initialization failed:', error);
      // Continue without FCM - app should still work
      this.fcmTokenReady = false;
    }
  }

  async getFCMToken() {
    try {
      // For browser testing, create a mock token
      if (!this.platform.is('cordova') && !this.platform.is('capacitor')) {
        console.log('Running in browser, using mock FCM token');
        this.fcmToken = 'browser-mock-token-' + Math.random().toString(36).substring(2, 15);
        console.log('Mock FCM Token:', this.fcmToken);
        return;
      }

      // For real devices, use the FCM service (preferred method)
      console.log('Getting FCM token from service...');
      this.fcmToken = await this.fcmService.getToken();
      console.log('✅ FCM Token obtained:', this.fcmToken.substring(0, 20) + '...');

    } catch (error) {
      console.error('❌ Error getting FCM token from service:', error);

      // Fallback: try direct FCM plugin
      try {
        console.log('Trying direct FCM plugin as fallback...');
        this.fcmToken = await this.fcm.getToken();
        console.log('✅ FCM Token from direct plugin:', this.fcmToken.substring(0, 20) + '...');
      } catch (fallbackError) {
        console.error('❌ All FCM token methods failed:', fallbackError);
        // Continue without token - app should still work
        this.fcmToken = '';
      }
    }
  }

  /**
   * Helper method to register a token with a specific endpoint
   * @param endpoint The API endpoint to use
   * @param payload The token payload to send
   * @param onSuccess Callback for successful registration
   * @param onError Callback for failed registration
   */
  registerTokenWithEndpoint(endpoint: string, payload: any, onSuccess: () => void, onError: () => void) {
    // Check if this token is already registered
    const storedToken = localStorage.getItem('fcm_token');
    if (storedToken === this.fcmToken) {
      console.log('Token already registered, skipping registration');
      if (onSuccess) onSuccess();
      return;
    }

    // Check if we're currently registering this token
    if (localStorage.getItem('fcm_token_registering') === 'true') {
      console.log('Token registration already in progress, skipping');
      if (onSuccess) onSuccess();
      return;
    }

    // Set a flag to indicate we're currently registering this token
    localStorage.setItem('fcm_token_registering', 'true');

    this.http.post(endpoint, payload).subscribe({
      next: (res) => {
        console.log(`FCM token registered with ${endpoint}:`, res);
        // Store the token in localStorage for potential recovery
        localStorage.setItem('fcm_token', this.fcmToken);
        // Clear the registering flag
        localStorage.removeItem('fcm_token_registering');
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        console.error(`Error registering token with ${endpoint}:`, err);
        // Clear the registering flag
        localStorage.removeItem('fcm_token_registering');
        if (onError) onError();
      }
    });
  }

  async onLogin() {
    // Validate inputs
    if (!this.credentials.email || !this.credentials.password) {
      await this.presentAlert('Login Failed', 'Please enter both email and password.');
      return;
    }

    console.log('🔐 Login attempt started');
    console.log('📧 Email:', this.credentials.email);
    console.log('🌐 API URL:', environment.apiUrl);
    console.log('📱 Platform:', this.platform.is('android') ? 'Android' : this.platform.is('ios') ? 'iOS' : 'Browser');
    console.log('🌍 Network status:', navigator.onLine ? 'Online' : 'Offline');
    console.log('� Offline mode:', this.offlineStorage.isOfflineMode());
    console.log('�🔥 FCM Token ready:', this.fcmTokenReady, 'Token:', this.fcmToken ? this.fcmToken.substring(0, 20) + '...' : 'None');

    // Check if we're in offline mode or have no network connectivity
    const isOfflineMode = this.offlineStorage.isOfflineMode();
    const isNetworkAvailable = navigator.onLine;

    if (!isNetworkAvailable || isOfflineMode) {
      console.log('🔄 Attempting offline authentication...');
      const offlineLoginSuccess = await this.attemptOfflineLogin();
      if (offlineLoginSuccess) {
        return; // Successfully logged in offline
      }

      if (!isNetworkAvailable) {
        await this.presentOfflineAlert();
        return;
      }
    }

    // If FCM token is not ready yet, try to get it one more time (only when online)
    if (isNetworkAvailable && !isOfflineMode && !this.fcmTokenReady && !this.fcmToken) {
      console.log('🔥 FCM token not ready, attempting to get it now...');
      try {
        await this.getFCMToken();
      } catch (error) {
        console.warn('⚠️ Could not get FCM token, continuing without it:', error);
      }
    }

    // Test API connectivity first (only when online and not in offline mode)
    if (isNetworkAvailable && !isOfflineMode) {
      console.log('🧪 Testing API connectivity...');
      const backendConnected = await this.networkService.checkBackendConnectivity();
      if (!backendConnected) {
        await this.presentConnectionErrorAlert();
        return;
      }
    }

    this.authService.login(this.credentials).subscribe({
      next: async (response) => {
        console.log('✅ Login successful:', response);

        // Show success alert
        await this.presentSuccessAlert('Login Successful', 'Welcome, ' + response.user.full_name);

        // Store the authentication token using the auth service
        this.authService.setToken(response.token);

        // Register the FCM token with the backend
        if (this.fcmToken) {
          console.log('Registering FCM token with backend:', this.fcmToken);

          // Include Firebase project ID in the request
          const payload: any = {
            token: this.fcmToken,
            device_type: this.platform.is('ios') ? 'ios' : 'android',
            project_id: environment.firebase.projectId
          };

          // Only include user_id if it exists
          if (response.user && response.user.id) {
            payload.user_id = response.user.id; // Associate the token with the user
          }

          console.log('Token registration payload:', payload);
          console.log('API URL:', `${environment.apiUrl}/device-token`);

          // Use the FCM service to register the token with the user ID
          this.fcmService.registerTokenWithBackend(this.fcmToken, response.user.id);

          // Navigate to welcome page
          this.router.navigate(['/welcome']);
        } else {
          console.warn('No FCM token available to register');
          // If no FCM token, just navigate to welcome page
          this.router.navigate(['/welcome']);
        }
      },
      error: (error) => {
        console.error('❌ Login error:', error);
        console.error('📊 Error details:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          url: error.url,
          error: error.error
        });

        this.errorMessage = error.error?.message || 'Login failed';

        // Show detailed alert based on error type
        if (error.status === 0) {
          this.presentAlert('Network Error',
            'Cannot connect to the server. Please check:\n' +
            '• Your internet connection\n' +
            '• If you\'re on the same WiFi network as the server\n' +
            '• If the backend server is running\n\n' +
            `Server URL: ${environment.apiUrl}`);
        } else if (error.status === 401) {
          this.presentAlert('Login Failed', 'Invalid email or password. Please try again.');
        } else if (error.status === 404) {
          this.presentAlert('Server Error', 'Login endpoint not found. Please check server configuration.');
        } else if (error.status >= 500) {
          this.presentAlert('Server Error', 'The server encountered an error. Please try again later.');
        } else {
          this.presentAlert('Login Error',
            `An error occurred during login (${error.status}).\n\n` +
            'Please check the console for more details or try again later.');
        }
      }
    });
  }

  async presentAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: ['OK'],
      cssClass: 'login-alert'
    });

    await alert.present();
  }

  async presentSuccessAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: ['OK'],
      cssClass: 'login-success-alert'
    });

    await alert.present();
  }

  async attemptOfflineLogin(): Promise<boolean> {
    try {
      // Check if user credentials are stored offline
      const storedCredentials = localStorage.getItem('offline_credentials');
      if (!storedCredentials) {
        console.log('❌ No offline credentials stored');
        return false;
      }

      const credentials = JSON.parse(storedCredentials);

      // Simple credential check (in production, use proper hashing)
      if (credentials.email === this.credentials.email &&
          credentials.password === this.credentials.password) {

        console.log('✅ Offline login successful');

        // Set offline mode token
        this.authService.setToken('offline_token_' + Date.now());

        await this.presentSuccessAlert('Offline Login', 'Logged in using cached credentials');

        // Navigate to welcome page
        this.router.navigate(['/welcome']);
        return true;
      }

      console.log('❌ Offline credentials do not match');
      return false;
    } catch (error) {
      console.error('❌ Error during offline login:', error);
      return false;
    }
  }

  async presentOfflineAlert() {
    const alert = await this.alertController.create({
      header: 'No Internet Connection',
      message: 'You are currently offline. Please check your internet connection and try again, or continue in offline mode if you have previously logged in.',
      buttons: [
        {
          text: 'Retry',
          handler: () => {
            this.onLogin();
          }
        },
        {
          text: 'Continue Offline',
          handler: () => {
            this.attemptOfflineLogin();
          }
        }
      ],
      cssClass: 'offline-alert'
    });

    await alert.present();
  }

  async presentConnectionErrorAlert() {
    const alert = await this.alertController.create({
      header: 'Connection Error',
      message: `Cannot connect to the server at ${environment.apiUrl}.\n\nPlease check:\n• Your internet connection\n• If the backend server is running\n• If you're on the same network as the server`,
      buttons: [
        {
          text: 'Retry',
          handler: () => {
            this.onLogin();
          }
        },
        {
          text: 'Network Diagnostics',
          handler: () => {
            this.router.navigate(['/network-diagnostics']);
          }
        }
      ],
      cssClass: 'connection-error-alert'
    });

    await alert.present();
  }

}