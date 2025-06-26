import { Component, OnInit } from '@angular/core';
import { IonicModule, AlertController, Platform } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

import { NetworkService } from '../../services/network.service';
import { FCMService } from '../../services/fcm.service';

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





  constructor(
    private router: Router,
    private authService: AuthService,
    private http: HttpClient,
    private alertController: AlertController,
    private platform: Platform,

    private networkService: NetworkService,
    private fcmService: FCMService
  ) {}

  async ngOnInit() {
    console.log('🔥 Login page initializing...');
    // Initialize FCM token
    await this.initializeFCMToken();
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
    console.log('🔥 FCM Token ready:', this.fcmTokenReady, 'Token:', this.fcmToken ? this.fcmToken.substring(0, 20) + '...' : 'None');

    // FCM functionality temporarily disabled
    console.log('🔥 FCM functionality temporarily disabled');

    // Test API connectivity first
    console.log('🧪 Testing API connectivity...');
    const backendConnected = await this.networkService.checkBackendConnectivity();
    if (!backendConnected) {
      await this.presentConnectionErrorAlert();
      return;
    }

    this.authService.login(this.credentials).subscribe({
      next: async (response) => {
        console.log('✅ Login successful:', response);

        // Show success alert
        await this.presentSuccessAlert('Login Successful', 'Welcome, ' + (response.user.first_name || response.user.email));

        // Store the authentication token using the auth service
        this.authService.setToken(response.token);

        // Store user data for FCM service
        localStorage.setItem('user', JSON.stringify(response.user));

        // Store server-side onboarding status (overrides any local storage)
        let onboardingComplete = false;
        if (response.onboarding_complete !== undefined) {
          onboardingComplete = response.onboarding_complete;
          localStorage.setItem('onboardingComplete', onboardingComplete ? 'true' : 'false');
          console.log('🎯 Server onboarding status:', onboardingComplete);
        }

        // Navigate directly based on onboarding status - no loading page needed
        if (onboardingComplete) {
          console.log('✅ User has completed onboarding → navigating to tabs/home');
          this.router.navigate(['/tabs/home']);
        } else {
          console.log('✅ User needs onboarding → navigating to welcome');
          this.router.navigate(['/welcome']);
        }

        // Register FCM token in background (non-blocking)
        this.registerFCMTokenInBackground(response.user.id);
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
          const errorMessage = error.error?.message || 'The email and password didn\'t match';
          this.presentAlert('Login Failed', errorMessage);
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

      ],
      cssClass: 'connection-error-alert'
    });

    await alert.present();
  }

  /**
   * Initialize FCM token
   */
  async initializeFCMToken() {
    try {
      if (this.platform.is('capacitor')) {
        console.log('Getting FCM token...');
        this.fcmToken = await this.fcmService.getFCMToken();
        if (this.fcmToken) {
          this.fcmTokenReady = true;
          console.log('FCM token ready:', this.fcmToken);
        } else {
          console.log('No FCM token available');
        }
      } else {
        console.log('FCM not available on this platform');
      }
    } catch (error) {
      console.error('Error initializing FCM token:', error);
    }
  }

  /**
   * Register FCM token in background without blocking navigation
   * @param userId The user ID to associate with the token
   */
  private async registerFCMTokenInBackground(userId: number) {
    try {
      console.log('🔥 Starting background FCM token registration...');

      if (this.fcmTokenReady && this.fcmToken) {
        await this.registerTokenWithEndpoints({
          token: this.fcmToken,
          device_type: 'android',
          project_id: environment.firebase.projectId,
          user_id: userId
        });
        console.log('✅ FCM token registered successfully in background');
      } else {
        console.log('⚠️ FCM token not ready, attempting to get token in background...');
        // Try to get FCM token if not ready
        await this.initializeFCMToken();
        if (this.fcmTokenReady && this.fcmToken) {
          await this.registerTokenWithEndpoints({
            token: this.fcmToken,
            device_type: 'android',
            project_id: environment.firebase.projectId,
            user_id: userId
          });
          console.log('✅ FCM token registered successfully in background after retry');
        } else {
          console.log('❌ Failed to get FCM token in background');
        }
      }
    } catch (error) {
      console.error('❌ Error registering FCM token in background:', error);
      // Don't throw error - this is background operation
    }
  }

  /**
   * Helper method to register a token with multiple endpoints
   * @param payload The token payload to send
   */
  async registerTokenWithEndpoints(payload: any) {
    // Ensure project_id is included
    if (!payload.project_id) {
      payload.project_id = environment.firebase.projectId;
    }

    const endpoints = [
      `${environment.apiUrl}/device-token`,
      `${environment.apiUrl}/device-token/register`
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.http.post(endpoint, payload).toPromise();
        console.log(`FCM token registered with ${endpoint}:`, response);
        // Store the token in localStorage for potential recovery
        localStorage.setItem('fcm_token', this.fcmToken);
        // Successfully registered, no need to try other endpoints
        break;
      } catch (error) {
        console.error(`Error registering token with ${endpoint}:`, error);
        // Continue to the next endpoint
      }
    }
  }

}