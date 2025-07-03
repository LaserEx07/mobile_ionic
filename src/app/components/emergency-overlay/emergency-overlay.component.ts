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
  
  public timeRemaining = 15; // Auto-dismiss countdown
  private countdownInterval: any;
  private pulseAnimation: any;

  constructor(
    private modalController: ModalController,
    private animationController: AnimationController
  ) {}

  ngOnInit() {
    this.startCountdown();
    this.startPulseAnimation();
  }

  ngOnDestroy() {
    this.clearCountdown();
    this.stopPulseAnimation();
  }

  /**
   * Start countdown timer for auto-dismiss
   */
  private startCountdown() {
    this.countdownInterval = setInterval(() => {
      this.timeRemaining--;
      if (this.timeRemaining <= 0) {
        this.dismissModal('timeout');
      }
    }, 1000);
  }

  /**
   * Clear countdown timer
   */
  private clearCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  /**
   * Start pulse animation for emergency effect
   */
  private startPulseAnimation() {
    const alertElement = document.querySelector('.emergency-alert-container');
    if (alertElement) {
      this.pulseAnimation = this.animationController
        .create()
        .addElement(alertElement)
        .duration(1000)
        .iterations(Infinity)
        .keyframes([
          { offset: 0, transform: 'scale(1)', opacity: '1' },
          { offset: 0.5, transform: 'scale(1.02)', opacity: '0.9' },
          { offset: 1, transform: 'scale(1)', opacity: '1' }
        ]);
      
      this.pulseAnimation.play();
    }
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
      'General': 'assets/otherdisasterIcon.png' // Use others icon for general disasters too
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
   * Format time remaining for display
   */
  getFormattedTimeRemaining(): string {
    return `${this.timeRemaining}s`;
  }

  /**
   * Dismiss modal with action data (auto-dismiss only)
   */
  private async dismissModal(action: string) {
    console.log(`🚨 Emergency Overlay: Dismissing modal with action: ${action}`);
    this.clearCountdown();
    this.stopPulseAnimation();

    const dismissData = {
      action: action,
      timestamp: new Date().toISOString()
    };

    console.log('🚨 Emergency Overlay: Dismiss data:', dismissData);
    await this.modalController.dismiss(dismissData);
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
      'Typhoon': 'Store clean water and food that won\'t spoil. Prepare a small emergency kit with essentials. Wait for the official all-clear before going out.',
      'Fire': 'Evacuate immediately. Stay low to avoid smoke. Do not use elevators.',
      'Landslide': 'Move away from the slide area. Get to higher, stable ground.',
      'General': 'Follow emergency procedures and stay alert for further instructions.'
    };

    // For General category, try to get specific instructions based on disaster type from title
    if (this.notification.category === 'General' && this.notification.title) {
      const titleUpper = this.notification.title.toUpperCase();
      if (titleUpper.includes('TSUNAMI')) {
        return 'Move to higher ground immediately. Stay away from the coast and low-lying areas. Listen for official evacuation orders.';
      } else if (titleUpper.includes('VOLCANIC')) {
        return 'Stay indoors, close windows and doors. Avoid areas downwind from the volcano. Wear masks to protect from ash.';
      } else if (titleUpper.includes('STORM')) {
        return 'Stay indoors and away from windows. Avoid flooded roads and downed power lines. Have emergency supplies ready.';
      }
    }

    return instructions[this.notification.category] || instructions['General'];
  }

  /**
   * Get priority text based on severity level
   */
  getPriorityText(): string {
    const priorityMap = {
      'critical': 'Critical - Immediate Action Required',
      'high': 'High - Immediate Action Required',
      'medium': 'Medium - Take Precautions',
      'low': 'Low - Stay Alert'
    };

    return priorityMap[this.notification.severity] || 'Medium - Take Precautions';
  }

  /**
   * Get the display disaster type - extract from title if it's a General category
   */
  getDisplayDisasterType(): string {
    // If it's General category, try to extract disaster type from title
    if (this.notification.category === 'General' && this.notification.title) {
      // Extract disaster type from title (e.g., "TSUNAMI EMERGENCY" -> "TSUNAMI")
      const titleParts = this.notification.title.toUpperCase().split(' ');
      if (titleParts.length > 0 && titleParts[0] !== 'EMERGENCY') {
        // Return the first word if it's not "EMERGENCY"
        const disasterType = titleParts[0];
        if (disasterType && disasterType !== 'ALERT' && disasterType !== 'NOTIFICATION') {
          return disasterType;
        }
      }
    }

    return this.notification.category.toUpperCase();
  }
}
