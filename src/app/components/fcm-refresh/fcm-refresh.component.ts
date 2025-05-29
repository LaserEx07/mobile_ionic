import { Component, OnInit } from '@angular/core';
import { IonicModule, AlertController, LoadingController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FcmService } from '../../services/fcm.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-fcm-refresh',
  templateUrl: './fcm-refresh.component.html',
  styleUrls: ['./fcm-refresh.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class FcmRefreshComponent implements OnInit {
  userId: number | null = null;

  constructor(
    private fcmService: FcmService,
    private authService: AuthService,
    private alertController: AlertController,
    private loadingController: LoadingController
  ) { }

  ngOnInit() {
    // Try to get user ID from local storage
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const tokenData = this.parseJwt(token);
        if (tokenData && tokenData.sub) {
          this.userId = tokenData.sub;
        }
      } catch (error) {
        console.error('Error parsing JWT token:', error);
      }
    }
  }

  /**
   * Parse a JWT token to get the payload
   * @param token The JWT token to parse
   * @returns The decoded token payload
   */
  private parseJwt(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error parsing JWT token:', error);
      return null;
    }
  }

  /**
   * Refresh the FCM token and re-register with the backend
   */
  async refreshFCMToken() {
    const loading = await this.loadingController.create({
      message: 'Refreshing notification settings...',
      spinner: 'circles'
    });
    
    await loading.present();
    
    try {
      const success = await this.fcmService.refreshFCMToken(this.userId || undefined);
      
      await loading.dismiss();
      
      if (success) {
        const alert = await this.alertController.create({
          header: 'Success',
          message: 'Notification settings refreshed successfully. You should now be able to receive notifications.',
          buttons: ['OK']
        });
        
        await alert.present();
      } else {
        const alert = await this.alertController.create({
          header: 'Error',
          message: 'Failed to refresh notification settings. Please try again later.',
          buttons: ['OK']
        });
        
        await alert.present();
      }
    } catch (error) {
      await loading.dismiss();
      
      const alert = await this.alertController.create({
        header: 'Error',
        message: 'An error occurred while refreshing notification settings. Please try again later.',
        buttons: ['OK']
      });
      
      await alert.present();
    }
  }
}
