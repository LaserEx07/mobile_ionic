import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-intro',
  templateUrl: './intro.page.html',
  styleUrls: ['./intro.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class IntroPage implements OnInit {

  constructor(private router: Router) {}

  ngOnInit() {
    // Check if user is already authenticated and has completed onboarding
    this.checkAuthenticationStatus();
  }

  private checkAuthenticationStatus() {
    const token = localStorage.getItem('token');
    const onboardingComplete = localStorage.getItem('onboardingComplete');

    console.log('🔍 Intro page - Auth status check:', {
      hasToken: !!token,
      onboardingComplete: onboardingComplete === 'true'
    });

    if (token && onboardingComplete === 'true') {
      // User is authenticated and has completed onboarding - go directly to tabs
      console.log('✅ User authenticated & onboarded → navigating to tabs/home');
      this.router.navigate(['/tabs/home']);
    } else if (token && onboardingComplete !== 'true') {
      // User is authenticated but hasn't completed onboarding
      console.log('✅ User authenticated but not onboarded → navigating to welcome');
      this.router.navigate(['/welcome']);
    } else if (!token && onboardingComplete === 'true') {
      // User has completed onboarding before but is not authenticated - skip intro
      console.log('🔑 User not authenticated but has onboarded before → navigating to login');
      this.router.navigate(['/login']);
    }
    // If none of the above conditions are met, stay on intro page (new user)
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  goToRegister() {
    this.router.navigate(['/register']);
  }
}
