import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-onboarding-3',
  templateUrl: './onboarding-3.page.html',
  styleUrls: ['./onboarding-3.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class Onboarding3Page {
  
  constructor(private router: Router) {}

  nextPage() {
    this.router.navigate(['/onboarding-4']);
  }

  previousPage() {
    this.router.navigate(['/onboarding-2']);
  }

  skipOnboarding() {
    // Mark onboarding as complete and go to main app
    localStorage.setItem('onboardingComplete', 'true');
    this.router.navigate(['/tabs/home']);
  }
}
