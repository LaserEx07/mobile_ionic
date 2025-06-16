import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-onboarding-4',
  templateUrl: './onboarding-4.page.html',
  styleUrls: ['./onboarding-4.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class Onboarding4Page {
  
  constructor(private router: Router) {}

  completeOnboarding() {
    // Mark onboarding as complete and go to main app
    localStorage.setItem('onboardingComplete', 'true');
    this.router.navigate(['/tabs/home']);
  }

  previousPage() {
    this.router.navigate(['/onboarding-3']);
  }
}
