import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class SettingsPage implements OnInit {

  constructor(
    private router: Router,
    private authService: AuthService
  ) { }

  ngOnInit() {
  }

  goBack() {
    this.router.navigate(['/tabs/home']);
  }

  logout() {
    // Use auth service to properly logout
    this.authService.logout();

    // Navigate to loading page which will handle proper routing
    this.router.navigate(['/loading']);
  }
}
