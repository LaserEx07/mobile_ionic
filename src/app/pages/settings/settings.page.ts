import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FcmRefreshComponent } from '../../components/fcm-refresh/fcm-refresh.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FcmRefreshComponent]
})
export class SettingsPage implements OnInit {

  constructor(private router: Router) { }

  ngOnInit() {
  }

  goBack() {
    this.router.navigate(['/tabs/home']);
  }

  logout() {
    // Clear authentication token
    localStorage.removeItem('token');
    
    // Navigate to login page
    this.router.navigate(['/login']);
  }
}
