import { Component, OnInit } from '@angular/core';
import { IonicModule, Platform, AlertController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { FCMService } from '../../services/fcm.service';

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
    private alertController: AlertController,
    private fcmService: FCMService
  ) {}

  async ngOnInit() {
    console.log('🔥 Register page initializing...');
    // Initialize FCM token
    await this.initializeFCMToken();
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

        // Register FCM token if available
        if (this.fcmTokenReady && this.fcmToken) {
          await this.registerTokenWithEndpoints({
            token: this.fcmToken,
            device_type: 'android',
            user_id: res.user?.id
          });
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
   * Helper method to register a token with multiple endpoints
   * @param payload The token payload to send
   */
  async registerTokenWithEndpoints(payload: any) {
    // Ensure project_id is included
    if (!payload.project_id) {
      payload.project_id = environment.firebase.projectId;
    }

    const endpoints = [
      `${environment.apiUrl}/device-token`
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

  /**
   * Copy FCM token to clipboard
   */
  async copyToken() {
    try {
      await navigator.clipboard.writeText(this.fcmToken);
      const alert = await this.alertController.create({
        header: 'Copied!',
        message: 'FCM token copied to clipboard',
        buttons: ['OK']
      });
      await alert.present();
    } catch (error) {
      console.error('Error copying token:', error);
    }
  }
}