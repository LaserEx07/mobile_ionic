import { Component, OnInit } from '@angular/core';
import { IonicModule, Platform, AlertController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { FcmService } from '../../services/fcm.service';

@Component({
  standalone: true,
  imports: [IonicModule, FormsModule],
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage implements OnInit {
  // ... rest of your class code ...
  user = {
    full_name: '',
    email: '',
    password: '',
    confirmPassword: ''
  };

  fcmToken: string = '';
  private fcmTokenReady = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
    private platform: Platform,
    private fcmService: FcmService,
    private alertController: AlertController
  ) {}

  async ngOnInit() {
    console.log('🔥 Register page initializing...');
    // Initialize FCM and get token
    await this.initializeFCM();
  }

  /**
   * Initialize FCM service and get token
   */
  async initializeFCM() {
    try {
      console.log('🔥 Initializing FCM for registration...');

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

      // For real devices, use the FCM service
      console.log('Getting FCM token from service...');
      this.fcmToken = await this.fcmService.getToken();
      console.log('✅ FCM Token obtained:', this.fcmToken.substring(0, 20) + '...');

    } catch (error) {
      console.error('❌ Error getting FCM token from service:', error);
      // Continue without token - app should still work
      this.fcmToken = '';
    }
  }

  async onRegister() {
    if (this.user.password !== this.user.confirmPassword) {
      await this.presentAlert('Registration Failed', 'Passwords do not match!');
      return;
    }

    this.authService.register({
      full_name: this.user.full_name,
      email: this.user.email,
      password: this.user.password,
      password_confirmation: this.user.confirmPassword
    }).subscribe({
      next: async res => {
        console.log('Registration successful:', res);

        // Try to register the FCM token immediately after registration
        if (this.fcmToken) {
          console.log('Registering FCM token after registration:', this.fcmToken);

          // Include Firebase project ID in the request
          const payload = {
            token: this.fcmToken,
            device_type: this.platform.is('ios') ? 'ios' : 'android',
            project_id: environment.firebase.projectId
            // Note: We don't have user_id yet since we're not logged in
          };

          console.log('Token registration payload:', payload);

          // Use the FCM service to register the token
          this.fcmService.registerTokenWithBackend(this.fcmToken);
        } else {
          console.warn('No FCM token available to register after registration');
        }

        await this.presentAlert('Registration Successful', 'Your account has been created successfully. Please log in.');
        this.router.navigate(['/login']);
      },
      error: async err => {
        console.error('Registration error:', err);
        await this.presentAlert('Registration Failed', 'Registration failed: ' + (err.error?.message || 'Unknown error'));
      }
    });
  }

  /**
   * Helper method to register a token with multiple endpoints
   * @param payload The token payload to send
   */
  async registerTokenWithEndpoints(payload: any) {
    const endpoints = [
      `${environment.apiUrl}/device-token`,
      'http://localhost:8000/api/device-token',
      'https://7af9-43-226-6-217.ngrok-free.app/api/device-token'
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

  async presentAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: ['OK']
    });

    await alert.present();
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}