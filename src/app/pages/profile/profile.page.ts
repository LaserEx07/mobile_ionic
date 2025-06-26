import { Component, OnInit } from '@angular/core';
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



  loadUserData() {
    const data = localStorage.getItem('userData');
    if (data) {
      this.userData = JSON.parse(data);
    }
  }

  async logout() {
    const alert = await this.alertCtrl.create({
      header: 'Confirm Logout',
      message: 'Are you sure you want to log out?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Log Out',
          handler: () => {
            this.performLogout();
          }
        }
      ]
    });
    await alert.present();
  }

  async performLogout() {
    try {
      // Show loading toast
      const loading = await this.toastCtrl.create({
        message: 'Logging out...',
        duration: 1000
      });
      await loading.present();

      // Clear all stored data
      localStorage.removeItem('token');
      localStorage.removeItem('userData');
      localStorage.removeItem('user');
      localStorage.removeItem('fcm_token');
      localStorage.removeItem('offline_credentials');

      // Optional: Call logout API endpoint to invalidate token on server
      const token = localStorage.getItem('token');
      if (token) {
        try {
          await this.http.post(`${environment.apiUrl}/auth/logout`, {}, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }).toPromise();
        } catch (error) {
          console.log('Server logout failed, but continuing with local logout:', error);
        }
      }

      // Navigate to intro page
      this.router.navigate(['/intro'], { replaceUrl: true });

      // Show success message
      const successToast = await this.toastCtrl.create({
        message: 'Successfully logged out',
        duration: 2000,
        color: 'success'
      });
      await successToast.present();

    } catch (error) {
      console.error('Logout error:', error);

      // Show error message
      const errorAlert = await this.alertCtrl.create({
        header: 'Logout Error',
        message: 'There was an error logging out. Please try again.',
        buttons: ['OK']
      });
      await errorAlert.present();
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

  async openUserGuideModal() {
    const modal = await this.modalCtrl.create({
      component: UserGuideModalComponent,
      cssClass: 'user-guide-modal'
    });
    await modal.present();
  }

  async openNotificationHistoryModal() {
    const modal = await this.modalCtrl.create({
      component: NotificationHistoryModalComponent,
      cssClass: 'notification-history-modal'
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
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="dismiss()">
            <ion-icon name="arrow-back"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title class="modal-title"><strong>Terms and Conditions</strong></ion-title>
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
    ion-header {
      background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);

      ion-toolbar {
        --background: transparent;
        --color: white;
      }
    }
    .modal-title {
      font-size: 1.2rem;
      font-weight: bold;
      color: white;
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

  async dismiss() {
    await this.modalCtrl.dismiss();
  }
}

// Privacy Policy Modal
@Component({
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="dismiss()">
            <ion-icon name="arrow-back"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title class="modal-title"><strong>Privacy Policy</strong></ion-title>
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
    ion-header {
      background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);

      ion-toolbar {
        --background: transparent;
        --color: white;
      }
    }
    .modal-title {
      font-size: 1.2rem;
      font-weight: bold;
      color: white;
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

  async dismiss() {
    await this.modalCtrl.dismiss();
  }
}

// Guide Modal
@Component({
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="dismiss()">
            <ion-icon name="arrow-back"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title class="modal-title">Map Symbols Guide</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <h3 class="modal-section-title"><strong>Reference Guide for Map Symbols</strong></h3>

      <!-- Location Markers Section -->
      <div class="legend-section">
        <h4 class="section-header">📍 Location Markers</h4>
        <div class="legend-items">
          <div class="legend-item">
            <img src="assets/Location.png" class="legend-icon-img" />
            <span class="legend-label">Your Current Location</span>
          </div>
        </div>
      </div>

      <!-- Disaster Evacuation Centers Section -->
      <div class="legend-section">
        <h4 class="section-header">🏠 Evacuation Centers by Disaster Type</h4>
        <div class="legend-items">
          <div class="legend-item">
            <img src="assets/forEarthquake.png" class="legend-icon-img" />
            <span class="legend-label">Earthquake Evacuation Centers</span>
          </div>
          <div class="legend-item">
            <img src="assets/forTyphoon.png" class="legend-icon-img" />
            <span class="legend-label">Typhoon Evacuation Centers</span>
          </div>
          <div class="legend-item">
            <img src="assets/forFlood.png" class="legend-icon-img" />
            <span class="legend-label">Flood Evacuation Centers</span>
          </div>
          <div class="legend-item">
            <img src="assets/forFire.png" class="legend-icon-img" />
            <span class="legend-label">Fire Evacuation Centers</span>
          </div>
          <div class="legend-item">
            <img src="assets/forLandslide.png" class="legend-icon-img" />
            <span class="legend-label">Landslide Evacuation Centers</span>
          </div>
          <div class="legend-item">
            <img src="assets/forOthers.png" class="legend-icon-img" />
            <span class="legend-label">Other Disaster Centers</span>
          </div>
          <div class="legend-item">
            <img src="assets/forMultiple.png" class="legend-icon-img" />
            <span class="legend-label">Multiple Disaster Centers</span>
          </div>
        </div>
      </div>

      <!-- Map Control Icons Section -->
      <div class="legend-section">
        <h4 class="section-header">🎛️ Map Control Icons</h4>
        <div class="legend-items">
          <div class="legend-item">
            <img src="assets/home-insuranceForEarthquake.png" class="legend-icon-img" />
            <span class="legend-label">Show All Evacuation Centers List</span>
          </div>
          <div class="legend-item">
            <img src="assets/downloadForEarthquake.png" class="legend-icon-img" />
            <span class="legend-label">Download Map with Routes</span>
          </div>
          <div class="legend-item">
            <img src="assets/compassForEarthquake.png" class="legend-icon-img" />
            <span class="legend-label">Route to 2 Nearest Centers</span>
          </div>
        </div>
      </div>

      <!-- Navigation Options Section -->
      <div class="legend-section">
        <h4 class="section-header">🚶 Navigation Options</h4>
        <div class="legend-items">
          <div class="legend-item">
            <img src="assets/walking.png" class="legend-icon-img" />
            <span class="legend-label">Walking Route</span>
          </div>
          <div class="legend-item">
            <img src="assets/bike.png" class="legend-icon-img" />
            <span class="legend-label">Cycling Route</span>
          </div>
          <div class="legend-item">
            <img src="assets/car.png" class="legend-icon-img" />
            <span class="legend-label">Driving Route</span>
          </div>
        </div>
      </div>

      <!-- App Features Section -->
      <div class="legend-section">
        <h4 class="section-header">📱 App Features</h4>
        <div class="legend-items">
          <div class="legend-item">
            <img src="assets/home1.png" class="legend-icon-img" />
            <span class="legend-label">Home - Disaster Selection</span>
          </div>
          <div class="legend-item">
            <img src="assets/search1.png" class="legend-icon-img" />
            <span class="legend-label">Search - Find Locations</span>
          </div>
          <div class="legend-item">
            <img src="assets/map1.png" class="legend-icon-img" />
            <span class="legend-label">Map - View All Centers</span>
          </div>
          <div class="legend-item">
            <img src="assets/lamp1.png" class="legend-icon-img" />
            <span class="legend-label">Tips - Safety Information</span>
          </div>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    ion-header {
      background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);

      ion-toolbar {
        --background: transparent;
        --color: white;
      }
    }
    .modal-title {
      font-size: 1.2rem;
      font-weight: bold;
      color: white;
    }
    .modal-section-title {
      font-size: 1rem;
      margin-bottom: 20px;
      text-align: center;
    }
    .legend-section {
      margin-bottom: 25px;
    }
    .section-header {
      font-size: 0.9rem;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--ion-color-primary);
      border-bottom: 1px solid var(--ion-color-light);
      padding-bottom: 5px;
    }
    .legend-items {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 8px;
      background: var(--ion-color-light);
      border-radius: 8px;
    }
    .legend-label {
      flex-grow: 1;
      font-size: 0.9rem;
    }
    .legend-icon-img {
      width: 24px;
      height: 24px;
      object-fit: contain;
      flex-shrink: 0;
    }
  `],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class GuideModalComponent {
  constructor(private modalCtrl: ModalController) {}

  async dismiss() {
    await this.modalCtrl.dismiss();
  }
}



// Emergency Contacts Modal
@Component({
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="dismiss()">
            <ion-icon name="arrow-back"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title class="modal-title">Emergency Contacts</ion-title>
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
            <h2>Bureau of Fire Protection</h2>
            <p>256-0541/42</p>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-icon name="call-outline" slot="start"></ion-icon>
          <ion-label>
            <h2>Cebu City Police Hotline</h2>
            <p>166</p>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-icon name="call-outline" slot="start"></ion-icon>
          <ion-label>
            <h2>Red Cross Cebu Chapter</h2>
            <p>(032) 253-4611</p>
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
    ion-header {
      background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);

      ion-toolbar {
        --background: transparent;
        --color: white;
      }
    }
    .modal-title {
      font-size: 1.2rem;
      font-weight: bold;
      color: white;
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

  async dismiss() {
    await this.modalCtrl.dismiss();
  }
}

// Safety Tips Modal
@Component({
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="dismiss()">
            <ion-icon name="arrow-back"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title class="modal-title">Helpful Tips to Prepare for Disasters</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="safety-tips-container">

        <!-- Earthquake Card -->
        <ion-card class="disaster-card earthquake-card">
          <ion-card-header (click)="toggleCard('earthquake')" class="card-header-clickable">
            <ion-card-title>
              <ion-icon name="pulse-outline" class="disaster-icon"></ion-icon>
              <span class="disaster-text">Earthquake</span>
              <ion-icon [name]="expandedCards.earthquake ? 'chevron-down-outline' : 'chevron-up-outline'" class="expand-icon"></ion-icon>
            </ion-card-title>
          </ion-card-header>
          <ion-card-content *ngIf="expandedCards.earthquake" class="disaster-content">
            <div class="disaster-image-header">
              <img src="assets/linogs.jpg" alt="Earthquake Safety" class="disaster-header-image">
            </div>
            <ul class="safety-tips-list">
              <li>Drop, Cover, and Hold On during shaking</li>
              <li>Stay away from windows, mirrors, and heavy objects</li>
              <li>If outdoors, move away from buildings and power lines</li>
              <li>Keep emergency supplies: water, food, flashlight, radio</li>
              <li>Secure heavy furniture and appliances to walls</li>
              <li>Know your evacuation routes and meeting points</li>
              <li>Practice earthquake drills regularly</li>
            </ul>
          </ion-card-content>
        </ion-card>

        <!-- Flood Card -->
        <ion-card class="disaster-card flood-card">
          <ion-card-header (click)="toggleCard('flood')" class="card-header-clickable">
            <ion-card-title>
              <span class="disaster-text">Flood</span>
              <ion-icon [name]="expandedCards.flood ? 'chevron-down-outline' : 'chevron-up-outline'" class="expand-icon"></ion-icon>
            </ion-card-title>
          </ion-card-header>
          <ion-card-content *ngIf="expandedCards.flood" class="disaster-content">
            <div class="disaster-image-header">
              <img src="assets/floods.jpg" alt="Flood Safety" class="disaster-header-image">
            </div>
            <ul class="safety-tips-list">
              <li>Move to higher ground immediately</li>
              <li>Never walk or drive through flood water</li>
              <li>Turn off utilities (gas, electricity, water) if instructed</li>
              <li>Keep important documents in waterproof containers</li>
              <li>Have a battery-powered radio for emergency updates</li>
              <li>Stock non-perishable food and clean water</li>
              <li>Know your area's flood risk and evacuation routes</li>
            </ul>
          </ion-card-content>
        </ion-card>

        <!-- Typhoon Card -->
        <ion-card class="disaster-card typhoon-card">
          <ion-card-header (click)="toggleCard('typhoon')" class="card-header-clickable">
            <ion-card-title>
              <ion-icon name="cloudy-outline" class="disaster-icon"></ion-icon>
              <span class="disaster-text">Typhoon</span>
              <ion-icon [name]="expandedCards.typhoon ? 'chevron-down-outline' : 'chevron-up-outline'" class="expand-icon"></ion-icon>
            </ion-card-title>
          </ion-card-header>
          <ion-card-content *ngIf="expandedCards.typhoon" class="disaster-content">
            <div class="disaster-image-header">
              <img src="assets/typhoons.jpg" alt="Typhoon Safety" class="disaster-header-image">
            </div>
            <ul class="safety-tips-list">
              <li>Monitor weather updates and warnings</li>
              <li>Secure or bring in outdoor furniture and objects</li>
              <li>Stock up on food, water, and medications</li>
              <li>Charge all electronic devices and have backup power</li>
              <li>Stay indoors and away from windows</li>
              <li>Prepare for power outages and flooding</li>
              <li>Have evacuation plan ready if in high-risk areas</li>
            </ul>
          </ion-card-content>
        </ion-card>

        <!-- Fire Card -->
        <ion-card class="disaster-card fire-card">
          <ion-card-header (click)="toggleCard('fire')" class="card-header-clickable">
            <ion-card-title>
              <ion-icon name="flame-outline" class="disaster-icon"></ion-icon>
              <span class="disaster-text">Fire</span>
              <ion-icon [name]="expandedCards.fire ? 'chevron-down-outline' : 'chevron-up-outline'" class="expand-icon"></ion-icon>
            </ion-card-title>
          </ion-card-header>
          <ion-card-content *ngIf="expandedCards.fire" class="disaster-content">
            <div class="disaster-image-header">
              <img src="assets/fires.jpg" alt="Fire Safety" class="disaster-header-image">
            </div>
            <ul class="safety-tips-list">
              <li>Install smoke detectors and check batteries regularly</li>
              <li>Create and practice a fire escape plan</li>
              <li>Keep fire extinguishers in key locations</li>
              <li>Stay low to avoid smoke when escaping</li>
              <li>Never use elevators during a fire</li>
              <li>Feel doors before opening - if hot, find another way</li>
              <li>Have a designated meeting point outside</li>
            </ul>
          </ion-card-content>
        </ion-card>

        <!-- Landslide Card -->
        <ion-card class="disaster-card landslide-card">
          <ion-card-header (click)="toggleCard('landslide')" class="card-header-clickable">
            <ion-card-title>
              <ion-icon name="triangle-outline" class="disaster-icon"></ion-icon>
              <span class="disaster-text">Landslide</span>
              <ion-icon [name]="expandedCards.landslide ? 'chevron-down-outline' : 'chevron-up-outline'" class="expand-icon"></ion-icon>
            </ion-card-title>
          </ion-card-header>
          <ion-card-content *ngIf="expandedCards.landslide" class="disaster-content">
            <div class="disaster-image-header">
              <img src="assets/landslides.jpg" alt="Landslide Safety" class="disaster-header-image">
            </div>
            <ul class="safety-tips-list">
              <li>Watch for warning signs: tilting trees, cracks in ground</li>
              <li>Listen for unusual sounds like trees cracking or boulders knocking</li>
              <li>Move away from the path of a landslide quickly</li>
              <li>Avoid river valleys and low-lying areas</li>
              <li>Stay alert during heavy rainfall</li>
              <li>Have evacuation routes planned from high-risk areas</li>
              <li>Report landslide hazards to local authorities</li>
            </ul>
          </ion-card-content>
        </ion-card>

        <!-- General Emergency Card -->
        <ion-card class="disaster-card general-card">
          <ion-card-header (click)="toggleCard('general')" class="card-header-clickable">
            <ion-card-title>
              <span class="disaster-text">General Emergency</span>
              <ion-icon [name]="expandedCards.general ? 'chevron-down-outline' : 'chevron-up-outline'" class="expand-icon"></ion-icon>
            </ion-card-title>
          </ion-card-header>
          <ion-card-content *ngIf="expandedCards.general" class="disaster-content">
            <div class="disaster-image-header">
              <img src="assets/icon/generalSettings.png" alt="General Emergency Safety" class="disaster-header-image">
            </div>
            <ul class="safety-tips-list">
              <li>Keep emergency contact numbers readily available</li>
              <li>Maintain a first aid kit and know basic first aid</li>
              <li>Store emergency supplies: water (1 gallon per person per day)</li>
              <li>Have non-perishable food for at least 3 days</li>
              <li>Keep flashlights, batteries, and portable radio</li>
              <li>Have copies of important documents in waterproof container</li>
              <li>Know your local emergency services and evacuation procedures</li>
            </ul>
          </ion-card-content>
        </ion-card>

      </div>
    </ion-content>
  `,
  styles: [`
    ion-header {
      background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);

      ion-toolbar {
        --background: transparent;
        --color: white;
      }
    }
    .modal-title {
      font-size: 1.1rem;
      font-weight: bold;
      color: white;
    }

    .safety-tips-container {
      padding: 0;
      max-width: 400px;
      margin: 0 auto;
    }

    .disaster-card {
      margin: 8px 0;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

      .card-header-clickable {
        cursor: pointer;
        padding: 12px 16px;
        transition: background-color 0.2s ease;

        ion-card-title {
          display: flex;
          align-items: center;
          font-size: 1.1rem;
          font-weight: 600;
          color: black !important;
          padding-left: 20px;

          .disaster-icon {
            width: 24px;
            margin-right: 12px;
            font-size: 1.3rem;
            text-align: center;
          }

          .disaster-text {
            flex: 1;
            margin-left: 36px;
          }

          .expand-icon {
            margin-left: auto;
            font-size: 1.2rem;
            transition: transform 0.3s ease;
          }
        }
        &:hover {
          background-color: var(--ion-color-light);
        }
      }

      .disaster-content {
        padding: 0 16px 16px 16px;

        .disaster-image-header {
          text-align: center;
          margin-bottom: 16px;

          .disaster-header-image {
            width: 100%;
            max-width: 300px;
            height: 180px;
            object-fit: cover;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }
        }

        .safety-tips-list {
          margin: 0;
          padding-left: 20px;

          li {
            margin-bottom: 8px;
            line-height: 1.4;
            color: var(--ion-color-dark);
            font-size: 0.95rem;

            &:last-child {
              margin-bottom: 0;
            }
          }
        }
      }
    }

    // For cards without icons, add consistent spacing
    .flood-card .card-header-clickable ion-card-title,
    .general-card .card-header-clickable ion-card-title {
      padding-left: 56px;
    }

    // All disaster types now have black text - removed individual color styling
  `],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class SafetyTipsModalComponent {
  expandedCards = {
    earthquake: false,
    flood: false,
    typhoon: false,
    fire: false,
    landslide: false,
    general: false
  };

  constructor(private modalCtrl: ModalController) {}

  toggleCard(cardType: string) {
    this.expandedCards[cardType as keyof typeof this.expandedCards] =
      !this.expandedCards[cardType as keyof typeof this.expandedCards];
  }

  async dismiss() {
    await this.modalCtrl.dismiss();
  }
}

// User Guide Modal Component
@Component({
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="dismiss()">
            <ion-icon name="arrow-back"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title class="modal-title">ALERTO User Guide</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <!-- App Purpose Section -->
      <div class="guide-section">
        <h3 class="section-title">🛡️ Welcome to ALERTO - The Safe Zone</h3>
        <p class="section-content">
          ALERTO is your comprehensive disaster preparedness and evacuation assistance app.
          Our mission is to keep you safe by providing real-time access to evacuation centers,
          emergency contacts, and safety information during natural disasters.
        </p>
      </div>

      <!-- Main Features Section -->
      <div class="guide-section">
        <h3 class="section-title">✨ Main Features</h3>
        <div class="feature-list">
          <div class="feature-item">
            <img src="assets/home1.png" class="feature-icon" />
            <div class="feature-text">
              <h4>Disaster Selection</h4>
              <p>Choose from 6 disaster types to find specific evacuation centers</p>
            </div>
          </div>
          <div class="feature-item">
            <img src="assets/map1.png" class="feature-icon" />
            <div class="feature-text">
              <h4>Interactive Maps</h4>
              <p>View evacuation centers with real-time navigation and routing</p>
            </div>
          </div>
          <div class="feature-item">
            <img src="assets/search1.png" class="feature-icon" />
            <div class="feature-text">
              <h4>Location Search</h4>
              <p>Find specific locations and nearby evacuation centers</p>
            </div>
          </div>
          <div class="feature-item">
            <img src="assets/lamp1.png" class="feature-icon" />
            <div class="feature-text">
              <h4>Safety Tips & Contacts</h4>
              <p>Access emergency contacts and disaster-specific safety information</p>
            </div>
          </div>
        </div>
      </div>

      <!-- How to Use Section -->
      <div class="guide-section">
        <h3 class="section-title">📱 How to Use ALERTO</h3>
        <div class="steps-list">
          <div class="step-item">
            <div class="step-number">1</div>
            <div class="step-content">
              <h4>Select Disaster Type</h4>
              <p>From the home screen, tap on the disaster type you need help with (Earthquake, Typhoon, Flood, Fire, Landslide, or General)</p>
            </div>
          </div>
          <div class="step-item">
            <div class="step-number">2</div>
            <div class="step-content">
              <h4>View Evacuation Centers</h4>
              <p>The map will show evacuation centers specific to your selected disaster type with your current location</p>
            </div>
          </div>
          <div class="step-item">
            <div class="step-number">3</div>
            <div class="step-content">
              <h4>Use Map Controls</h4>
              <p>• Tap the house icon to see all centers list<br>• Tap download to save map offline<br>• Tap compass to route to 2 nearest centers</p>
            </div>
          </div>
          <div class="step-item">
            <div class="step-number">4</div>
            <div class="step-content">
              <h4>Navigate to Safety</h4>
              <p>Choose walking, cycling, or driving routes to reach your selected evacuation center safely</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Disaster Types Section -->
      <div class="guide-section">
        <h3 class="section-title">🌪️ Supported Disaster Types</h3>
        <div class="disaster-grid">
          <div class="disaster-type">
            <img src="assets/earthquake-icon.svg" class="disaster-icon" />
            <span>Earthquake</span>
          </div>
          <div class="disaster-type">
            <img src="assets/icon/bagyo.png" class="disaster-icon" />
            <span>Typhoon</span>
          </div>
          <div class="disaster-type">
            <img src="assets/flood.png" class="disaster-icon" />
            <span>Flood</span>
          </div>
          <div class="disaster-type">
            <img src="assets/fireIcon.png" class="disaster-icon" />
            <span>Fire</span>
          </div>
          <div class="disaster-type">
            <img src="assets/landslideIcon.png" class="disaster-icon" />
            <span>Landslide</span>
          </div>
          <div class="disaster-type">
            <img src="assets/otherdisasterIcon.png" class="disaster-icon" />
            <span>General</span>
          </div>
        </div>
      </div>

      <!-- Emergency Tips Section -->
      <div class="guide-section">
        <h3 class="section-title">🚨 Emergency Tips</h3>
        <div class="tips-list">
          <div class="tip-item">
            <ion-icon name="call-outline" class="tip-icon"></ion-icon>
            <p>Always call 911 for immediate emergency assistance</p>
          </div>
          <div class="tip-item">
            <ion-icon name="location-outline" class="tip-icon"></ion-icon>
            <p>Enable location services for accurate evacuation center directions</p>
          </div>
          <div class="tip-item">
            <ion-icon name="download-outline" class="tip-icon"></ion-icon>
            <p>Download maps when you have internet for offline access during emergencies</p>
          </div>
          <div class="tip-item">
            <ion-icon name="notifications-outline" class="tip-icon"></ion-icon>
            <p>Keep notifications enabled to receive emergency alerts</p>
          </div>
        </div>
      </div>

      <!-- Contact Section -->
      <div class="guide-section">
        <h3 class="section-title">📞 Need Help?</h3>
        <p class="section-content">
          For technical support or questions about ALERTO, visit the Tips tab for emergency contacts
          and safety information. Stay safe and prepared!
        </p>
      </div>
    </ion-content>
  `,
  styles: [`
    ion-header {
      background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);

      ion-toolbar {
        --background: transparent;
        --color: white;
      }
    }
    .modal-title {
      font-size: 1.3rem;
      font-weight: bold;
      color: white;
    }
    .guide-section {
      margin-bottom: 25px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--ion-color-light);
    }
    .guide-section:last-child {
      border-bottom: none;
    }
    .section-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 15px;
      color: var(--ion-color-primary);
    }
    .section-content {
      font-size: 0.95rem;
      line-height: 1.5;
      color: var(--ion-color-medium-shade);
    }
    .feature-list, .steps-list {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    .feature-item, .step-item {
      display: flex;
      align-items: flex-start;
      gap: 15px;
      padding: 12px;
      background: var(--ion-color-light);
      border-radius: 10px;
    }
    .feature-icon {
      width: 32px;
      height: 32px;
      object-fit: contain;
      flex-shrink: 0;
    }
    .feature-text h4, .step-content h4 {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 5px;
      color: var(--ion-color-dark);
    }
    .feature-text p, .step-content p {
      font-size: 0.9rem;
      color: var(--ion-color-medium-shade);
      margin: 0;
      line-height: 1.4;
    }
    .step-number {
      width: 30px;
      height: 30px;
      background: var(--ion-color-primary);
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 0.9rem;
      flex-shrink: 0;
    }
    .disaster-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
    }
    .disaster-type {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 15px;
      background: var(--ion-color-light);
      border-radius: 10px;
      text-align: center;
    }
    .disaster-icon {
      width: 40px;
      height: 40px;
      object-fit: contain;
    }
    .disaster-type span {
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--ion-color-dark);
    }
    .tips-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .tip-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px;
      background: var(--ion-color-light);
      border-radius: 8px;
    }
    .tip-icon {
      color: var(--ion-color-primary);
      font-size: 1.2rem;
      flex-shrink: 0;
    }
    .tip-item p {
      margin: 0;
      font-size: 0.9rem;
      color: var(--ion-color-medium-shade);
    }
  `],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class UserGuideModalComponent {
  constructor(private modalCtrl: ModalController) {}

  async dismiss() {
    await this.modalCtrl.dismiss();
  }
}

// Notification History Modal Component
@Component({
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="dismiss()">
            <ion-icon name="arrow-back"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title class="modal-title">Push Notification History</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="history-section">
        <h3 class="section-title">📱 FCM Notifications</h3>
        <p class="section-content">
          This shows the history of push notifications sent via Firebase Cloud Messaging (FCM).
          These notifications include emergency alerts, evacuation center updates, and system notifications.
        </p>
      </div>

      <div class="history-section" *ngIf="notifications.length > 0">
        <h4 class="section-header">Recent Notifications</h4>
        <div class="notification-list">
          <div class="notification-item" *ngFor="let notification of notifications">
            <div class="notification-header">
              <h5 class="notification-title">{{ notification.title }}</h5>
              <span class="notification-time">{{ formatTime(notification.created_at) }}</span>
            </div>
            <p class="notification-message">{{ notification.message }}</p>
            <div class="notification-meta" *ngIf="notification.data">
              <span class="notification-category" [class]="'category-' + notification.type">
                {{ getCategoryLabel(notification.type) }}
              </span>
              <span class="notification-status" [class]="notification.read ? 'read' : 'unread'">
                {{ notification.read ? 'Read' : 'Unread' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="history-section" *ngIf="notifications.length === 0 && !isLoading">
        <div class="empty-state">
          <ion-icon name="notifications-off-outline" class="empty-icon"></ion-icon>
          <h4>No Notifications Yet</h4>
          <p>You haven't received any push notifications yet. When emergency alerts or evacuation center updates are sent, they will appear here.</p>
        </div>
      </div>

      <div class="history-section" *ngIf="isLoading">
        <div class="loading-state">
          <ion-spinner></ion-spinner>
          <p>Loading notification history...</p>
        </div>
      </div>

      <!-- Information Section -->
      <div class="info-section">
        <h4 class="section-header">ℹ️ About Push Notifications</h4>
        <div class="info-items">
          <div class="info-item">
            <ion-icon name="warning-outline" class="info-icon emergency"></ion-icon>
            <div class="info-content">
              <h5>Emergency Alerts</h5>
              <p>Critical notifications for fire and landslide disasters with sound and vibration</p>
            </div>
          </div>
          <div class="info-item">
            <ion-icon name="home-outline" class="info-icon evacuation"></ion-icon>
            <div class="info-content">
              <h5>Evacuation Centers</h5>
              <p>Updates when new evacuation centers are added to your area</p>
            </div>
          </div>
          <div class="info-item">
            <ion-icon name="information-circle-outline" class="info-icon system"></ion-icon>
            <div class="info-content">
              <h5>System Updates</h5>
              <p>App updates and important system announcements</p>
            </div>
          </div>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    ion-header {
      background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);

      ion-toolbar {
        --background: transparent;
        --color: white;
      }
    }
    .modal-title {
      font-size: 1.2rem;
      font-weight: bold;
      color: white;
    }
    .history-section {
      margin-bottom: 25px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--ion-color-light);
    }
    .history-section:last-child {
      border-bottom: none;
    }
    .section-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 15px;
      color: var(--ion-color-primary);
    }
    .section-header {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 15px;
      color: var(--ion-color-dark);
    }
    .section-content {
      font-size: 0.9rem;
      line-height: 1.5;
      color: var(--ion-color-medium-shade);
      margin: 0;
    }
    .notification-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .notification-item {
      background: var(--ion-color-light);
      border-radius: 8px;
      padding: 12px;
      border-left: 4px solid var(--ion-color-primary);
    }
    .notification-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    .notification-title {
      font-size: 0.95rem;
      font-weight: 600;
      margin: 0;
      color: var(--ion-color-dark);
      flex: 1;
    }
    .notification-time {
      font-size: 0.8rem;
      color: var(--ion-color-medium);
      margin-left: 8px;
    }
    .notification-message {
      font-size: 0.85rem;
      color: var(--ion-color-medium-shade);
      margin: 0 0 8px 0;
      line-height: 1.4;
    }
    .notification-meta {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .notification-category {
      font-size: 0.75rem;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 500;
    }
    .category-emergency_alert {
      background: #ffebee;
      color: #c62828;
    }
    .category-evacuation_center_added {
      background: #e8f5e8;
      color: #2e7d32;
    }
    .category-system_update {
      background: #e3f2fd;
      color: #1565c0;
    }
    .category-general {
      background: #f3e5f5;
      color: #7b1fa2;
    }
    .notification-status {
      font-size: 0.75rem;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 500;
    }
    .notification-status.read {
      background: #e8f5e8;
      color: #2e7d32;
    }
    .notification-status.unread {
      background: #fff3e0;
      color: #ef6c00;
    }
    .empty-state, .loading-state {
      text-align: center;
      padding: 32px 16px;
    }
    .empty-icon {
      font-size: 48px;
      color: var(--ion-color-medium);
      margin-bottom: 16px;
    }
    .empty-state h4 {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 0 0 8px 0;
      color: var(--ion-color-dark);
    }
    .empty-state p {
      font-size: 0.9rem;
      color: var(--ion-color-medium-shade);
      margin: 0;
      line-height: 1.5;
    }
    .loading-state p {
      margin-top: 16px;
      color: var(--ion-color-medium);
    }
    .info-section {
      background: var(--ion-color-light);
      border-radius: 8px;
      padding: 16px;
      margin-top: 16px;
    }
    .info-items {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .info-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .info-icon {
      font-size: 20px;
      margin-top: 2px;
    }
    .info-icon.emergency {
      color: #f44336;
    }
    .info-icon.evacuation {
      color: #4caf50;
    }
    .info-icon.system {
      color: #2196f3;
    }
    .info-content h5 {
      font-size: 0.9rem;
      font-weight: 600;
      margin: 0 0 4px 0;
      color: var(--ion-color-dark);
    }
    .info-content p {
      font-size: 0.8rem;
      color: var(--ion-color-medium-shade);
      margin: 0;
      line-height: 1.4;
    }
  `],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class NotificationHistoryModalComponent implements OnInit {
  notifications: any[] = [];
  isLoading = true;

  constructor(
    private modalCtrl: ModalController,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.loadNotificationHistory();
  }

  async loadNotificationHistory() {
    try {
      const response = await this.http.get<{
        notifications: any[],
        unread_count: number
      }>(`${environment.apiUrl}/notifications?limit=50`).toPromise();

      if (response) {
        this.notifications = response.notifications || [];
      }
    } catch (error) {
      console.error('Error loading notification history:', error);
    } finally {
      this.isLoading = false;
    }
  }

  formatTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }

  getCategoryLabel(type: string): string {
    switch (type) {
      case 'emergency_alert': return 'Emergency';
      case 'evacuation_center_added': return 'Evacuation';
      case 'system_update': return 'System';
      default: return 'General';
    }
  }

  async dismiss() {
    await this.modalCtrl.dismiss();
  }
}