import { Component } from '@angular/core';
import { IonicModule, ModalController, AlertController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterModule]
})
export class ProfilePage {
  userData: any = {};

  constructor(
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private http: HttpClient,
    private router: Router
  ) {
    this.loadUserData();
  }

  goToSettings() {
    this.router.navigate(['/settings']);
  }

  loadUserData() {
    const data = localStorage.getItem('userData');
    if (data) {
      this.userData = JSON.parse(data);
    }
  }

  async openTermsModal() {
    const modal = await this.modalCtrl.create({
      component: TermsModalComponent,
      cssClass: 'terms-modal'
    });
    await modal.present();
  }

  async openPrivacyModal() {
    const modal = await this.modalCtrl.create({
      component: PrivacyModalComponent,
      cssClass: 'terms-modal'
    });
    await modal.present();
  }

  async openEmergencyContactsModal() {
    const modal = await this.modalCtrl.create({
      component: EmergencyContactsModalComponent,
      cssClass: 'terms-modal'
    });
    await modal.present();
  }

  async openSafetyTipsModal() {
    const modal = await this.modalCtrl.create({
      component: SafetyTipsModalComponent,
      cssClass: 'terms-modal'
    });
    await modal.present();
  }

  async openGuideModal() {
    const modal = await this.modalCtrl.create({
      component: GuideModalComponent,
      cssClass: 'terms-modal'
    });
    await modal.present();
  }

  async openAccountInfoModal() {
    const modal = await this.modalCtrl.create({
      component: AccountInfoModalComponent,
      cssClass: 'account-info-modal'
    });
    await modal.present();
  }

  async testFCM() {
    // First, check if Google Play Services is missing
    const googlePlayMissing = localStorage.getItem('google_play_services_missing');
    if (googlePlayMissing === 'true') {
      const alert = await this.alertCtrl.create({
        header: 'Google Play Services Required',
        message: 'Push notifications require Google Play Services. Would you like to install or update Google Play Services?',
        buttons: [
          {
            text: 'Install/Update',
            handler: () => {
              // Open Google Play Store to Google Play Services
              window.open('market://details?id=com.google.android.gms', '_system');
            }
          },
          {
            text: 'Continue Anyway',
            handler: () => {
              this.checkFCMToken();
            }
          }
        ]
      });
      await alert.present();
      return;
    }

    await this.checkFCMToken();
  }

  async checkFCMToken() {
    // Check if we have a token
    const token = localStorage.getItem('fcm_token');

    if (!token) {
      const alert = await this.alertCtrl.create({
        header: 'No FCM Token',
        message: 'No FCM token found. Please restart the app to generate a token.',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    // Show token for debugging
    const tokenAlert = await this.alertCtrl.create({
      header: 'FCM Token',
      message: `Current token: ${token.substring(0, 20)}...`,
      buttons: [
        {
          text: 'Test Local Notification',
          handler: () => {
            this.showTestNotification();
          }
        },
        {
          text: 'Send from Backend',
          handler: () => {
            this.sendTestNotificationFromBackend(token);
          }
        },
        {
          text: 'Check Google Play',
          handler: () => {
            this.checkGooglePlayServices();
          }
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });
    await tokenAlert.present();
  }

  async checkGooglePlayServices() {
    try {
      // Open Google Play Store to check for Google Play Services
      window.open('market://details?id=com.google.android.gms', '_system');
    } catch (error) {
      console.error('Error opening Google Play Store:', error);
      const alert = await this.alertCtrl.create({
        header: 'Error',
        message: 'Could not open Google Play Store. Please check if Google Play Store is installed on your device.',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  async showTestNotification() {
    // Create a test notification directly in the app
    const notification = {
      title: 'Test Notification',
      body: 'This is a local test notification',
      category: 'General',
      severity: 'medium',
      wasTapped: false,
      time: new Date().toISOString()
    };

    // Vibrate the device
    if ('vibrate' in navigator) {
      navigator.vibrate([500, 100, 500]);
    }

    // Show an alert
    const alert = await this.alertCtrl.create({
      header: notification.title,
      subHeader: notification.category ? `${notification.category.toUpperCase()}` : '',
      message: notification.body,
      buttons: ['OK']
    });
    await alert.present();
  }

  async sendTestNotificationFromBackend(token: string) {
    const loading = await this.toastCtrl.create({
      message: 'Sending test notification from backend...',
      duration: 2000
    });
    await loading.present();

    // Send request to backend to send a test notification
    this.http.post(`${environment.apiUrl}/test-notification`, {
      token: token,
      title: 'Test from App',
      message: 'This is a test notification sent from the app',
      category: 'General',
      severity: 'medium'
    }).subscribe({
      next: () => {
        this.toastCtrl.create({
          message: 'Test notification sent successfully!',
          duration: 3000,
          color: 'success'
        }).then(toast => toast.present());
      },
      error: (error) => {
        this.alertCtrl.create({
          header: 'Error',
          message: `Failed to send test notification: ${error.message || JSON.stringify(error)}`,
          buttons: ['OK']
        }).then(alert => alert.present());
      }
    });
  }
}

// Terms and Conditions Modal
@Component({
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title class="modal-title"><strong>Terms and Conditions</strong></ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">Close</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="terms-content">
        <h1 class="modal-section-title"><strong>Terms and Conditions</strong></h1>
        <p class="effective-date">Effective Date: April 26, 2025</p>
        <p class="welcome">Welcome to Evacuation Mapping System ("we", "our", or "us"). These <strong>Terms and Conditions</strong> ("Terms") govern your access to and use of our online evacuation mapping system (the "Service"). By registering or using the Service, you agree to be bound by these Terms.</p>

        <section>
          <h2 class="modal-section-title">1. User Eligibility</h2>
          <p>To use this service, you must be at least 13 years old. By registering, you confirm that the information provided is accurate and complete.</p>
        </section>

        <section>
          <h2 class="modal-section-title">2. User Account</h2>
          <p>To access certain features of the Service, you must create an account. You agree to provide:</p>
          <ul>
            <li>Your full name</li>
            <li>A valid email address</li>
            <li>A password</li>
            <li>Your location data (for accurate evacuation mapping)</li>
          </ul>
          <p>You are responsible for maintaining the confidentiality of your account and for all activities that occur under your account.</p>
        </section>

        <section>
          <h2 class="modal-section-title">3. Use of Service</h2>
          <p>You agree to use the system solely for lawful purposes and in a way that does not infringe the rights of others. Misuse of the system, including providing false information or tampering with the mapping process, may result in suspension or termination of your account.</p>
        </section>

        <section>
          <h2 class="modal-section-title">4. Modifications</h2>
          <p>We reserve the right to modify or discontinue the Service at any time without notice. Continued use of the Service following changes means you accept those changes.</p>
        </section>

        <section>
          <h2 class="modal-section-title">5. Limitation of Liability</h2>
          <p>We strive to provide accurate evacuation data but do not guarantee the completeness, accuracy, or timeliness of the information provided. We are not liable for any loss or damage arising from the use or inability to use the Service.</p>
        </section>

        <section>
          <h2 class="modal-section-title">6. Termination</h2>
          <p>We may suspend or terminate your access to the Service if you violate these Terms.</p>
        </section>
      </div>
    </ion-content>
  `,
  styles: [`
    .modal-title {
      font-size: 1.2rem;
      font-weight: bold;
    }
    .modal-section-title {
      font-size: 0.9375rem;
      margin-bottom: 15px;
    }
  `],
  standalone: true,
  imports: [IonicModule]
})
export class TermsModalComponent {
  constructor(private modalCtrl: ModalController) {}

  dismiss() {
    this.modalCtrl.dismiss();
  }
}

// Privacy Policy Modal
@Component({
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title class="modal-title"><strong>Privacy Policy</strong></ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">Close</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <h2 class="modal-section-title"><strong>Privacy Policy</strong></h2>
      <p class="effective-date">Effective Date: April 26, 2025</p>

      <p>DisasterGuard is committed to protecting your privacy. This <strong>Privacy Policy</strong> outlines how we collect, use, and protect your information when you use our evacuation mapping system.</p>

      <h3 class="modal-section-title">1. Information We Collect</h3>
      <p>We collect the following personal information upon registration:</p>
      <ul>
        <li>Name</li>
        <li>Email address</li>
        <li>Password (stored securely)</li>
        <li>Location data (for evacuation mapping purposes)</li>
      </ul>

      <h3 class="modal-section-title">2. How We Use Your Information</h3>
      <p>Your data is used solely to:</p>
      <ul>
        <li>Provide personalized evacuation routes and mapping</li>
        <li>Contact you regarding urgent updates or emergencies</li>
        <li>Improve system functionality</li>
      </ul>
      <p>We do not sell, rent, or share your personal information with third parties, except as required by law or to ensure user safety during emergencies.</p>

      <h3 class="modal-section-title">3. Data Security</h3>
      <p>We implement appropriate security measures to protect your data. Your password is encrypted, and location data is only used to provide real-time evacuation support.</p>

      <h3 class="modal-section-title">4. Your Rights</h3>
      <p>You may:</p>
      <ul>
        <li>Access or update your personal data</li>
        <li>Request deletion of your account</li>
        <li>Opt-out of communications at any time</li>
      </ul>
      <p>To do so, contact us at: support&#64;disasterguard.com</p>

      <h3 class="modal-section-title">5. Changes to This Policy</h3>
      <p>We may update this Privacy Policy occasionally. You will be notified of any significant changes.</p>
    </ion-content>
  `,
  styles: [`
    .modal-title {
      font-size: 1.2rem;
      font-weight: bold;
    }
    .modal-section-title {
      font-size: 0.9375rem;
      margin-bottom: 15px;
    }
  `],
  standalone: true,
  imports: [IonicModule]
})
export class PrivacyModalComponent {
  constructor(private modalCtrl: ModalController) {}

  dismiss() {
    this.modalCtrl.dismiss();
  }
}

// Guide Modal
@Component({
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title class="modal-title">Map Symbols Guide</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">Close</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <h3 class="modal-section-title"><strong>Reference Guide for Map Symbols</strong></h3>
      <div class="legend-items">
        <div class="legend-item" *ngFor="let item of legendItems">
          <div class="legend-icon-container">
            <span class="legend-icon">{{ item.icon }}</span>
            <span class="legend-label">{{ item.label }}</span>
          </div>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .modal-title {
      font-size: 1.2rem;
      font-weight: bold;
    }
    .modal-section-title {
      font-size: 0.9375rem;
      margin-bottom: 15px;
    }
    .legend-items {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .legend-icon-container {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .legend-icon {
      font-size: 24px;
      width: 30px;
      text-align: center;
    }
    .legend-label {
      flex-grow: 1;
    }
  `],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class GuideModalComponent {
  legendItems = [
    { icon: '', label: 'Your Location', isCustom: true, iconType: 'diamond' },
    { icon: '', label: 'for Earthquake', isCustom: true, iconType: 'pin', color: '#ff9500' },
    { icon: '', label: 'for Typhoon', isCustom: true, iconType: 'pin', color: '#22c55e' },
    { icon: '', label: 'for Flash flood', isCustom: true, iconType: 'pin', color: '#3dc2ff' }
  ];

  constructor(private modalCtrl: ModalController) {}

  dismiss() {
    this.modalCtrl.dismiss();
  }
}

// Account Info Modal
@Component({
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Account Information</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">Close</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-list>
        <ion-item>
          <ion-icon name="person-outline" slot="start"></ion-icon>
          <ion-label>
            <h2>Full Name</h2>
            <p>{{ userData.full_name }}</p>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-icon name="call-outline" slot="start"></ion-icon>
          <ion-label>
            <h2>Contact Number</h2>
            <p>{{ userData.mobile_number }}</p>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-icon name="calendar-outline" slot="start"></ion-icon>
          <ion-label>
            <h2>Age</h2>
            <p>{{ userData.age }}</p>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-icon name="male-female-outline" slot="start"></ion-icon>
          <ion-label>
            <h2>Gender</h2>
            <p>{{ userData.gender }}</p>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-icon name="location-outline" slot="start"></ion-icon>
          <ion-label>
            <h2>Address</h2>
            <p>{{ userData.address }}</p>
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class AccountInfoModalComponent {
  userData: any = {};

  constructor(private modalCtrl: ModalController) {
    this.loadUserData();
  }

  loadUserData() {
    const data = localStorage.getItem('userData');
    if (data) {
      this.userData = JSON.parse(data);
    }
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }
}

// Emergency Contacts Modal
@Component({
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title class="modal-title">Emergency Contacts</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">Close</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-list>
        <ion-item>
          <ion-icon name="call-outline" slot="start"></ion-icon>
          <ion-label>
            <h2>National Emergency Hotline</h2>
            <p>911</p>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-icon name="call-outline" slot="start"></ion-icon>
          <ion-label>
            <h2>Fire Department</h2>
            <p>160</p>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-icon name="call-outline" slot="start"></ion-icon>
          <ion-label>
            <h2>Police</h2>
            <p>117</p>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-icon name="call-outline" slot="start"></ion-icon>
          <ion-label>
            <h2>Red Cross</h2>
            <p>143</p>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-icon name="call-outline" slot="start"></ion-icon>
          <ion-label>
            <h2>Local Disaster Office</h2>
            <p>Contact your LGU</p>
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
  styles: [`
    .modal-title {
      font-size: 1.2rem;
      font-weight: bold;
    }
    h2 {
      font-size: 1rem;
      margin-bottom: 4px;
    }
    p {
      font-size: 0.95rem;
      color: var(--ion-color-medium);
    }
  `],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class EmergencyContactsModalComponent {
  constructor(private modalCtrl: ModalController) {}

  dismiss() {
    this.modalCtrl.dismiss();
  }
}

// Safety Tips Modal
@Component({
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title class="modal-title">Safety Tips</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">Close</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-list>
        <ion-item>
          <ion-label>
            <h2>Earthquake</h2>
            <ul>
              <li>Drop, Cover, and Hold On.</li>
              <li>Stay away from windows and heavy objects.</li>
              <li>Evacuate only when safe.</li>
            </ul>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-label>
            <h2>Flood</h2>
            <ul>
              <li>Move to higher ground immediately.</li>
              <li>Avoid walking or driving through floodwaters.</li>
            </ul>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-label>
            <h2>Typhoon</h2>
            <ul>
              <li>Stay indoors and away from glass windows.</li>
              <li>Prepare an emergency kit.</li>
            </ul>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-label>
            <h2>General</h2>
            <ul>
              <li>Keep emergency contacts accessible.</li>
              <li>Prepare a Go Bag with essentials.</li>
              <li>Stay informed via official channels.</li>
            </ul>
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
  styles: [`
    .modal-title {
      font-size: 1.2rem;
      font-weight: bold;
    }
    h2 {
      font-size: 1rem;
      margin-bottom: 4px;
    }
    ul {
      margin: 0;
      padding-left: 18px;
      font-size: 0.95rem;
      color: var(--ion-color-medium);
    }
    li {
      margin-bottom: 4px;
    }
  `],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class SafetyTipsModalComponent {
  constructor(private modalCtrl: ModalController) {}

  dismiss() {
    this.modalCtrl.dismiss();
  }
}