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

    console.log('🔍 Loading page - Auth status check:', {
      hasToken: !!token,
      onboardingComplete: onboardingComplete === 'true',
      isOnline: this.isOnline
    });

    setTimeout(() => {
      if (token && onboardingComplete === 'true') {
        // User is authenticated and has completed onboarding - go directly to tabs
        console.log('✅ User authenticated & onboarded → navigating to tabs/home');
        if (win.appDebug) {
          win.appDebug('LoadingPage navigating to tabs/home (authenticated & onboarded)');
        }
        this.router.navigate(['/tabs/home']);
      } else if (token && onboardingComplete !== 'true') {
        // User is authenticated but hasn't completed onboarding
        console.log('✅ User authenticated but not onboarded → navigating to welcome');
        if (win.appDebug) {
          win.appDebug('LoadingPage navigating to welcome (authenticated but not onboarded)');
        }
        this.router.navigate(['/welcome']);
      } else if (!token && onboardingComplete === 'true') {
        // User has completed onboarding before but is not authenticated - skip intro
        console.log('🔑 User not authenticated but has onboarded before → navigating to login');
        if (win.appDebug) {
          win.appDebug('LoadingPage navigating to login (not authenticated but onboarded)');
        }
        this.router.navigate(['/login']);
      } else {
        // New user - go to intro page
        console.log('👋 New user → navigating to intro');
        if (win.appDebug) {
          win.appDebug('LoadingPage navigating to intro (new user)');
        }
        this.router.navigate(['/intro']);
      }
    }, 1000); // Reduced wait time to 1 second for better UX

    // Safety timeout - if navigation hasn't happened after 5 seconds, force navigation
    setTimeout(() => {
      console.log('⚠️ Loading page safety timeout triggered - checking if still on loading page');
      if (this.router.url === '/loading') {
        console.log('🚨 Still on loading page after 5 seconds - forcing navigation');
        if (token) {
          console.log('🔄 Forcing navigation to welcome page');
          this.router.navigate(['/welcome']);
        } else {
          console.log('🔄 Forcing navigation to intro page');
          this.router.navigate(['/intro']);
        }
      }
    }, 5000);
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
    console.log('🌐 Online status changed:', this.isOnline);
    // Don't re-check connection on status change to avoid infinite loops
    // The initial check in ngOnInit is sufficient
  }
}