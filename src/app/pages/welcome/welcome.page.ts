import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.page.html',
  styleUrls: ['./welcome.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class WelcomePage {
  constructor(private router: Router) {}

  nextPage() {
    this.router.navigate(['/onboarding-2']);
  }

  previousPage() {
    this.router.navigate(['/intro']);
  }

  skipOnboarding() {
    // Mark onboarding as complete and go to main app
    localStorage.setItem('onboardingComplete', 'true');
    this.router.navigate(['/tabs/home']);
  }
}