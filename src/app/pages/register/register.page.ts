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
  imports: [IonicModule, FormsModule, CommonModule],
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage implements OnInit {
  // ... rest of your class code ...
  user = {
    email: '',
    password: '',
    confirmPassword: ''
  };

  acceptTerms: boolean = false;
  hasReadTerms: boolean = false;
  isTermsModalOpen: boolean = false;
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
    // Check if email is provided and valid
    if (!this.user.email || !this.user.email.trim()) {
      await this.presentAlert('Registration Failed', 'Email is required.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.user.email)) {
      await this.presentAlert('Registration Failed', 'Please enter a valid email address.');
      return;
    }

    // Check password length
    if (!this.user.password || this.user.password.length < 8) {
      await this.presentAlert('Registration Failed', 'Password must be at least 8 characters long.');
      return;
    }

    if (this.user.password !== this.user.confirmPassword) {
      await this.presentAlert('Registration Failed', 'Passwords do not match!');
      return;
    }

    if (!this.hasReadTerms || !this.acceptTerms) {
      await this.presentAlert('Registration Failed', 'Please read and accept the Terms and Conditions to continue.');
      return;
    }

    this.authService.register({
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

        let errorMessage = 'Unknown error occurred';

        if (err.status === 0) {
          errorMessage = 'Cannot connect to server. Please check your network connection and ensure the backend server is running.';
        } else if (err.status === 422) {
          // Handle validation errors more gracefully
          if (err.error?.errors) {
            const errors = err.error.errors;
            if (errors.password && errors.password.length > 0) {
              errorMessage = errors.password[0]; // Show first password error
            } else if (errors.email && errors.email.length > 0) {
              errorMessage = errors.email[0]; // Show first email error
            } else {
              errorMessage = 'Validation failed: ' + JSON.stringify(errors);
            }
          } else {
            errorMessage = err.error?.message || 'Validation failed';
          }
        } else if (err.status === 500) {
          errorMessage = 'Server error: ' + (err.error?.message || 'Internal server error');
        } else if (err.error?.message) {
          errorMessage = err.error.message;
        }

        await this.presentAlert('Registration Failed', errorMessage);
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

  /**
   * Open Terms and Conditions modal
   */
  openTermsModal() {
    this.isTermsModalOpen = true;
  }

  /**
   * Close Terms and Conditions modal
   */
  closeTermsModal() {
    this.isTermsModalOpen = false;
  }

  /**
   * Accept terms from modal and close it
   */
  acceptTermsFromModal() {
    this.hasReadTerms = true;
    this.acceptTerms = true;
    this.closeTermsModal();
  }
}