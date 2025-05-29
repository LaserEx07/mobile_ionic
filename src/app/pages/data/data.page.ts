import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { MobileUserService } from '../../services/mobile-user.service';

@Component({
  selector: 'app-data',
  templateUrl: './data.page.html',
  styleUrls: ['./data.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class DataPage {
  userData = {
    full_name: '',
    mobile_number: '',
    age: '',
    gender: '',
    address: ''
  };

  // Philippines mobile number format: +63 + 10 digits (total 11 digits)
  acceptedTerms = false;
  showError = false;
  errorMessage = '';
  isTermsModalOpen = false;

  constructor(private router: Router, private mobileUserService: MobileUserService) {}

  /**
   * Open Terms and Conditions modal
   */
  openTermsModal() {
    this.isTermsModalOpen = true;
  }

  /**
   * Close Terms and Conditions modal
   */
  closeTermsModal() {
    this.isTermsModalOpen = false;
  }

  /**
   * Accept terms from modal and close it
   */
  acceptTerms() {
    this.acceptedTerms = true;
    this.closeTermsModal();
  }

  /**
   * Get current date for terms display
   */
  getCurrentDate(): string {
    return new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }



  /**
   * Handle mobile number input and format validation
   * Philippines format: +63 + 10 digits (total 11 digits)
   */
  onMobileNumberInput(event: any) {
    let value = event.target.value;

    // Remove any non-numeric characters
    value = value.replace(/\D/g, '');

    // Limit to exactly 10 digits (after +63)
    if (value.length > 10) {
      value = value.substring(0, 10);
    }

    // For Philippine mobile numbers, ensure it starts with 9
    if (value.length > 0 && !value.startsWith('9')) {
      // If user types a number that doesn't start with 9, prepend 9
      if (value.length === 1 && value !== '9') {
        value = '9' + value;
      }
    }

    // Update the model
    this.userData.mobile_number = value;

    // Clear any previous error when user starts typing
    if (this.showError && this.errorMessage.includes('Mobile number')) {
      this.showError = false;
      this.errorMessage = '';
    }
  }

  /**
   * Get the complete mobile number with country code
   * Returns format: +63-917-123-4567
   */
  getCompletePhoneNumber(): string {
    if (!this.userData.mobile_number) return '';
    return `+63${this.userData.mobile_number}`;
  }

  /**
   * Validate Philippine mobile number format
   * Must be exactly 10 digits starting with 9 (after +63)
   * Total: +63 + 10 digits = 11 digits
   */
  isValidPhilippineMobile(): boolean {
    const mobileNumber = this.userData.mobile_number;

    // Must be exactly 10 digits starting with 9
    return /^9[0-9]{9}$/.test(mobileNumber) && mobileNumber.length === 10;
  }

  onSave() {
    console.log(this.userData); // Debug

    const requiredFields = ['full_name', 'mobile_number', 'age', 'gender', 'address'];
    for (const field of requiredFields) {
      const value = (this.userData as any)[field];
      if (value === undefined || value === null || value.toString().trim() === '') {
        this.showError = true;
        this.errorMessage = 'All fields are required.';
        return;
      }
    }

    // Validate Philippine mobile number format
    if (!this.isValidPhilippineMobile()) {
      this.showError = true;
      this.errorMessage = 'Mobile number must be exactly 10 digits starting with 9 (e.g., +63-917-123-4567).';
      return;
    }

    if (isNaN(Number(this.userData.age)) || Number(this.userData.age) <= 0) {
      this.showError = true;
      this.errorMessage = 'Age must be a positive number.';
      return;
    }

    if (!this.acceptedTerms) {
      this.showError = true;
      this.errorMessage = 'You must accept the Terms and Conditions.';
      return;
    }

    this.mobileUserService.createUser({
      full_name: this.userData.full_name,
      mobile_number: this.userData.mobile_number,
      age: Number(this.userData.age),
      gender: this.userData.gender,
      address: this.userData.address
    }).subscribe({
      next: () => {
        const userData = {
          full_name: this.userData.full_name,
          mobile_number: this.userData.mobile_number,
          age: this.userData.age,
          gender: this.userData.gender,
          address: this.userData.address,
        };
        localStorage.setItem('userData', JSON.stringify(userData));
        localStorage.setItem('onboardingComplete', 'true');
        this.router.navigate(['/tabs/home']);
      },
      error: (err: any) => {
        this.showError = true;
        this.errorMessage = err.error?.message || 'Failed to save user.';
      }
    });
  }

}

