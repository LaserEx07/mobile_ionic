import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { ModalController, AnimationController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { EmergencyNotification } from '../../services/emergency-overlay.service';

@Component({
  selector: 'app-emergency-overlay',
  templateUrl: './emergency-overlay.component.html',
  styleUrls: ['./emergency-overlay.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class EmergencyOverlayComponent implements OnInit, OnDestroy {
  @Input() notification!: EmergencyNotification;
  
  private pulseAnimation: any;
  public canDismiss: boolean = false;
  public countdownTime: number = 3;
  public timeRemaining: number = 0;
  private countdownInterval: any;
  private isDestroyed: boolean = false;

  constructor(
    private modalController: ModalController,
    private animationController: AnimationController
  ) {
    console.log('🚨 Emergency Overlay: Component constructor called');
  }

  ngOnInit() {
    console.log('🚨 Emergency Overlay: Component initialized with notification:', this.notification);
    this.startPulseAnimation();
    this.startCountdown();
  }

  ngOnDestroy() {
    console.log('🚨 Emergency Overlay: Component destroying');
    this.isDestroyed = true;
    this.stopPulseAnimation();
    this.clearCountdown();
  }

  /**
   * Start pulse animation for emergency effect
   */
  private startPulseAnimation() {
    // Delay animation start to avoid interference with initial rendering
    setTimeout(() => {
      const alertElement = document.querySelector('.emergency-alert-container');
      if (alertElement && !this.pulseAnimation) {
        this.pulseAnimation = this.animationController
          .create()
          .addElement(alertElement)
          .duration(2000) // Slower animation to reduce interference
          .iterations(Infinity)
          .keyframes([
            { offset: 0, transform: 'scale(1)', opacity: '1' },
            { offset: 0.5, transform: 'scale(1.01)', opacity: '0.95' }, // Reduced scale
            { offset: 1, transform: 'scale(1)', opacity: '1' }
          ]);
        
        this.pulseAnimation.play();
        console.log('🚨 Emergency Overlay: Pulse animation started');
      }
    }, 500);
  }

  /**
   * Stop pulse animation
   */
  private stopPulseAnimation() {
    if (this.pulseAnimation) {
      this.pulseAnimation.stop();
      this.pulseAnimation = null;
    }
  }

  /**
   * Start countdown timer (3 seconds like ads)
   */
  private startCountdown() {
    console.log('🚨 Emergency Overlay: Starting countdown timer');
    this.canDismiss = false;
    this.countdownTime = 3;
    this.timeRemaining = this.countdownTime;
    
    this.countdownInterval = setInterval(() => {
      if (this.isDestroyed) {
        console.log('🚨 Emergency Overlay: Component destroyed, stopping countdown');
        this.clearCountdown();
        return;
      }
      
      this.countdownTime--;
      this.timeRemaining = this.countdownTime;
      console.log(`🚨 Emergency Overlay: Countdown: ${this.countdownTime} seconds remaining`);
      
      if (this.countdownTime <= 0) {
        this.canDismiss = true;
        console.log('🚨 Emergency Overlay: Countdown complete, dismiss button now available');
        this.clearCountdown();
      }
    }, 1000);
  }

  /**
   * Clear countdown timer
   */
  private clearCountdown() {
    if (this.countdownInterval) {
      console.log('🚨 Emergency Overlay: Clearing countdown timer');
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  /**
   * Get disaster icon based on category
   */
  getDisasterIcon(): string {
    const iconMap = {
      'Earthquake': 'assets/earthquake.png',
      'Flood': 'assets/flood.png',
      'Typhoon': 'assets/icon/bagyo.png',
      'Fire': 'assets/icon/fire.jpg',
      'Landslide': 'assets/icon/lanslide.jpg',
      'Others': 'assets/otherdisasterIcon.png',
      'General': 'assets/emergency-icon.png'
    };

    return iconMap[this.notification.category] || iconMap['General'];
  }

  /**
   * Get severity color class
   */
  getSeverityClass(): string {
    return `severity-${this.notification.severity}`;
  }

  /**
   * Get disaster type color class
   */
  getDisasterClass(): string {
    return `disaster-${this.notification.category.toLowerCase()}`;
  }

  /**
   * Handle view map button click
   */
  async viewMap() {
    console.log('🚨 Emergency Overlay: View Map button clicked for', this.notification.category);
    
    // Stop animation during interaction
    this.stopPulseAnimation();
    
    await this.dismissModal('view_map');
  }

  /**
   * Handle dismiss button click - allows immediate dismissal
   */
  async dismiss(event?: Event) {
    console.log('🚨 Emergency Overlay: Dismiss button clicked');
    
    // Stop event propagation
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
    
    // Stop animation during interaction
    this.stopPulseAnimation();
    
    await this.dismissModal('dismiss');
  }

  /**
   * Dismiss modal with action data
   */
  private async dismissModal(action: string) {
    console.log(`🚨 Emergency Overlay: Dismissing modal with action: ${action}`);
    
    // Stop all animations and cleanup
    this.stopPulseAnimation();
    this.clearCountdown();

    const dismissData = {
      action: action,
      timestamp: new Date().toISOString()
    };

    console.log('🚨 Emergency Overlay: Dismiss data:', dismissData);
    
    try {
      // Use a more reliable dismissal approach
      await this.modalController.dismiss(dismissData);
      console.log('🚨 Emergency Overlay: Modal dismissed successfully');
    } catch (error) {
      console.error('⚠️ Emergency Overlay: Error dismissing modal', error);
      
      // Fallback: try to get and dismiss the top modal
      try {
        const topModal = await this.modalController.getTop();
        if (topModal) {
          await topModal.dismiss(dismissData);
          console.log('🚨 Emergency Overlay: Top modal dismissed as fallback');
        }
      } catch (fallbackError) {
        console.error('⚠️ Emergency Overlay: Fallback dismissal also failed', fallbackError);
      }
    }
  }

  /**
   * Get emergency message with enhanced formatting
   */
  getFormattedMessage(): string {
    return this.notification.message;
  }

  /**
   * Get severity level text
   */
  getSeverityText(): string {
    const severityMap = {
      'low': 'Advisory',
      'medium': 'Warning',
      'high': 'Alert',
      'critical': 'CRITICAL EMERGENCY'
    };
    
    return severityMap[this.notification.severity] || 'Alert';
  }

  /**
   * Get action button text based on disaster type
   */
  getActionButtonText(): string {
    return `View ${this.notification.category} Map & Routes`;
  }

  /**
   * Get formatted time remaining for countdown
   */
  getFormattedTimeRemaining(): string {
    const seconds = Math.max(this.timeRemaining, 0);
    const minutes = Math.floor(seconds / 60);
    const rem = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  }

  /**
   * Check if this is a critical emergency
   */
  isCritical(): boolean {
    return this.notification.severity === 'critical';
  }

  /**
   * Get emergency instructions based on disaster type
   */
  getEmergencyInstructions(): string {
    const instructions = {
      'Earthquake': 'Drop, Cover, and Hold On. Stay away from windows and heavy objects.',
      'Flood': 'Move to higher ground immediately. Avoid walking or driving through flood waters.',
      'Typhoon': 'Stay indoors. Secure loose objects and avoid windows.',
      'Fire': 'Evacuate immediately. Stay low to avoid smoke. Do not use elevators.',
      'Landslide': 'Move away from the slide area. Get to higher, stable ground.',
      'General': 'Follow emergency procedures and stay alert for further instructions.'
    };
    
    return instructions[this.notification.category] || instructions['General'];
  }
}
