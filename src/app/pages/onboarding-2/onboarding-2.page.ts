import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-onboarding-2',
  templateUrl: './onboarding-2.page.html',
  styleUrls: ['./onboarding-2.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class Onboarding2Page {
  
  constructor(private router: Router) {}

  nextPage() {
    this.router.navigate(['/onboarding-3']);
  }

  previousPage() {
    this.router.navigate(['/welcome']);
  }

  skipOnboarding() {
    // Mark onboarding as complete and go to main app
    localStorage.setItem('onboardingComplete', 'true');
    this.router.navigate(['/tabs/home']);
  }
}
