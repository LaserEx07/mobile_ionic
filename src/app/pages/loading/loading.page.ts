import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-loading',
  templateUrl: './loading.page.html',
  styleUrls: ['./loading.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class LoadingPage implements OnInit {
  isOnline: boolean = false;

  constructor(private router: Router) {}

  ngOnInit() {
    // Add debug logging
    console.log('LoadingPage ngOnInit');
    const win = window as any;
    if (win.appDebug) {
      win.appDebug('LoadingPage ngOnInit');
    }
    this.checkInternetConnection();
  }

  checkInternetConnection() {
    this.isOnline = navigator.onLine;
    // Add debug logging
    console.log('LoadingPage checkInternetConnection, isOnline:', this.isOnline);
    const win = window as any;
    if (win.appDebug) {
      win.appDebug('LoadingPage checkInternetConnection, isOnline: ' + this.isOnline);
    }

    // Check authentication and onboarding status regardless of internet connection
    const token = localStorage.getItem('token');
    const onboardingComplete = localStorage.getItem('onboardingComplete');

    console.log('Auth status - Token:', !!token, 'Onboarding complete:', onboardingComplete === 'true', 'Online:', this.isOnline);

    setTimeout(() => {
      if (token && onboardingComplete === 'true') {
        // User is returning and has completed onboarding - go directly to tabs
        console.log('User is authenticated and onboarding complete - navigating to tabs/home');
        if (win.appDebug) {
          win.appDebug('LoadingPage navigating to tabs/home (authenticated & onboarded)');
        }
        this.router.navigate(['/tabs/home']);
      } else if (token) {
        // User is authenticated but hasn't completed onboarding
        console.log('User is authenticated but onboarding incomplete - navigating to welcome');
        if (win.appDebug) {
          win.appDebug('LoadingPage navigating to welcome (authenticated but not onboarded)');
        }
        this.router.navigate(['/welcome']);
      } else {
        // New or logged out user - go to login
        console.log('User is not authenticated - navigating to login');
        if (win.appDebug) {
          win.appDebug('LoadingPage navigating to login (not authenticated)');
        }
        this.router.navigate(['/login']);
      }
    }, 1000); // Reduced wait time to 1 second for better UX
  }

  ionViewWillEnter() {
    // Add event listeners for online/offline status
    window.addEventListener('online', this.updateOnlineStatus.bind(this));
    window.addEventListener('offline', this.updateOnlineStatus.bind(this));
  }

  ionViewWillLeave() {
    // Remove event listeners
    window.removeEventListener('online', this.updateOnlineStatus.bind(this));
    window.removeEventListener('offline', this.updateOnlineStatus.bind(this));
  }

  private updateOnlineStatus() {
    this.isOnline = navigator.onLine;
    const win = window as any;
    if (win.appDebug) {
      win.appDebug('LoadingPage updateOnlineStatus, isOnline: ' + this.isOnline);
    }
    // Always check connection status, regardless of online/offline state
    this.checkInternetConnection();
  }
}