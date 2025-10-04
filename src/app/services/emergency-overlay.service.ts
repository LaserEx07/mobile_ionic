import { Injectable } from '@angular/core';
import { ModalController, Platform } from '@ionic/angular';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Router } from '@angular/router';
import { EmergencyOverlayComponent } from '../components/emergency-overlay/emergency-overlay.component';

export interface EmergencyNotification {
  id: string;
  title: string;
  message: string;
  category: 'Earthquake' | 'Flood' | 'Typhoon' | 'Fire' | 'Landslide' | 'General';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  data?: any;
}

@Injectable({
  providedIn: 'root'
})
export class EmergencyOverlayService {
  private currentModal: HTMLIonModalElement | null = null;
  private audioContext: AudioContext | null = null;
  private emergencySounds: { [key: string]: HTMLAudioElement } = {};
  private isShowingEmergency = false;

  constructor(
    private modalController: ModalController,
    private platform: Platform,
    private router: Router
  ) {
    this.initializeAudioContext();
    this.preloadEmergencySounds();
  }

  /**
   * Initialize audio context for emergency sounds
   */
  private initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('Audio context not supported:', error);
    }
  }

  /**
   * Preload emergency sound files
   */
  private preloadEmergencySounds() {
    const soundFiles = {
      'Earthquake': 'assets/sounds/emergency-earthquake.mp3',
      'Flood': 'assets/sounds/emergency-flood.mp3',
      'Typhoon': 'assets/sounds/emergency-typhoon.mp3',
      'Fire': 'assets/sounds/emergency-fire.mp3',
      'Landslide': 'assets/sounds/emergency-landslide.mp3',
      'General': 'assets/sounds/emergency-general.mp3',
      'critical': 'assets/sounds/emergency-critical.mp3'
    };

    Object.keys(soundFiles).forEach(key => {
      const audio = new Audio(soundFiles[key as keyof typeof soundFiles]);
      audio.preload = 'auto';
      audio.loop = true;
      audio.volume = 1.0;
      
      // Fallback to default notification sound if emergency sound not found
      audio.onerror = () => {
        console.warn(`Emergency sound not found: ${soundFiles[key as keyof typeof soundFiles]}, using fallback`);
        audio.src = 'assets/sounds/notification.mp3';
      };
      
      this.emergencySounds[key] = audio;
    });
  }

  /**
   * Show emergency overlay notification
   */
  async showEmergencyNotification(notification: EmergencyNotification): Promise<void> {
    // Prevent multiple emergency overlays
    if (this.isShowingEmergency) {
      await this.dismissCurrentEmergency();
    }

    this.isShowingEmergency = true;

    try {
      // Start emergency vibration pattern
      await this.startEmergencyVibration(notification.category, notification.severity);

      // Play emergency sound
      await this.playEmergencySound(notification.category, notification.severity);

      // Create and present emergency modal
      this.currentModal = await this.modalController.create({
        component: EmergencyOverlayComponent,
        componentProps: {
          notification: notification
        },
        cssClass: `emergency-overlay ${notification.category.toLowerCase()}-emergency ${notification.severity}-severity`,
        backdropDismiss: false,
        keyboardClose: false,
        showBackdrop: true,
        animated: true,
        mode: 'ios' // Force iOS mode for consistent appearance
      });

      // Handle modal dismissal
      this.currentModal.onDidDismiss().then((result) => {
        this.handleEmergencyDismissal(notification, result.data);
      });

      await this.currentModal.present();

    } catch (error) {
      console.error('Error showing emergency notification:', error);
      this.isShowingEmergency = false;
    }
  }

  /**
   * Start emergency vibration pattern based on disaster type and severity
   */
  private async startEmergencyVibration(category: string, severity: string): Promise<void> {
    if (!this.platform.is('capacitor')) {
      // Fallback for web/browser
      if ('vibrate' in navigator) {
        const pattern = this.getVibrationPattern(category, severity);
        navigator.vibrate(pattern);
        
        // Repeat vibration every 3 seconds
        const vibrationInterval = setInterval(() => {
          if (this.isShowingEmergency) {
            navigator.vibrate(pattern);
          } else {
            clearInterval(vibrationInterval);
          }
        }, 3000);
      }
      return;
    }

    try {
      // Use Capacitor Haptics for native devices
      const hapticPattern = this.getHapticPattern(severity);
      
      // Start continuous haptic feedback
      const hapticInterval = setInterval(async () => {
        if (this.isShowingEmergency) {
          await Haptics.impact({ style: hapticPattern });
          
          // Additional vibration for critical alerts
          if (severity === 'critical') {
            setTimeout(async () => {
              if (this.isShowingEmergency) {
                await Haptics.impact({ style: ImpactStyle.Heavy });
              }
            }, 200);
          }
        } else {
          clearInterval(hapticInterval);
        }
      }, 1000);

    } catch (error) {
      console.warn('Haptics not available:', error);
      // Fallback to navigator vibrate
      if ('vibrate' in navigator) {
        const pattern = this.getVibrationPattern(category, severity);
        navigator.vibrate(pattern);
      }
    }
  }

  /**
   * Get vibration pattern based on disaster type and severity
   */
  private getVibrationPattern(category: string, severity: string): number[] {
    const basePatterns = {
      'Earthquake': [300, 100, 300, 100, 300],
      'Flood': [500, 200, 500],
      'Typhoon': [200, 100, 200, 100, 200, 100, 200],
      'Fire': [100, 50, 100, 50, 100, 50, 100, 50, 100],
      'Landslide': [400, 150, 400, 150, 400],
      'General': [250, 100, 250, 100, 250]
    };

    let pattern = basePatterns[category as keyof typeof basePatterns] || basePatterns['General'];

    // Intensify pattern based on severity
    if (severity === 'critical') {
      pattern = pattern.map((duration: number) => duration * 1.5);
    } else if (severity === 'high') {
      pattern = pattern.map((duration: number) => duration * 1.2);
    }

    return pattern;
  }

  /**
   * Get haptic pattern based on severity
   */
  private getHapticPattern(severity: string): ImpactStyle {
    switch (severity) {
      case 'critical':
        return ImpactStyle.Heavy;
      case 'high':
        return ImpactStyle.Medium;
      case 'medium':
        return ImpactStyle.Light;
      default:
        return ImpactStyle.Light;
    }
  }

  /**
   * Play emergency sound based on disaster type and severity
   */
  private async playEmergencySound(category: string, severity: string): Promise<void> {
    try {
      // Stop any currently playing emergency sounds
      this.stopAllEmergencySounds();

      // Choose sound based on severity first, then category
      let soundKey = severity === 'critical' ? 'critical' : category;
      let audio = this.emergencySounds[soundKey];

      // Fallback to general emergency sound if specific sound not available
      if (!audio || audio.error) {
        audio = this.emergencySounds['General'];
      }

      if (audio) {
        audio.currentTime = 0;
        audio.volume = 1.0;

        // Play the sound
        const playPromise = audio.play();

        if (playPromise !== undefined) {
          await playPromise;
          console.log(`Emergency sound playing: ${soundKey}`);
        }
      }
    } catch (error) {
      console.warn('Error playing emergency sound:', error);
    }
  }

  /**
   * Stop all emergency sounds
   */
  private stopAllEmergencySounds(): void {
    Object.values(this.emergencySounds).forEach(audio => {
      if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
  }

  /**
   * Handle emergency notification dismissal
   */
  private async handleEmergencyDismissal(notification: EmergencyNotification, actionData?: any): Promise<void> {
    this.isShowingEmergency = false;
    this.stopAllEmergencySounds();

    // Navigate to appropriate disaster map if user clicked "View Map"
    if (actionData?.action === 'view_map') {
      await this.navigateToDisasterMap(notification.category);
    }
  }

  /**
   * Navigate to appropriate disaster map with routing to nearest evacuation centers
   */
  private async navigateToDisasterMap(category: string): Promise<void> {
    const routeMap = {
      'Earthquake': '/tabs/earthquake-map',
      'Flood': '/tabs/flood-map',
      'Typhoon': '/tabs/typhoon-map',
      'Fire': '/tabs/fire-map',
      'Landslide': '/tabs/landslide-map',
      'General': '/tabs/map'
    };

    const route = routeMap[category as keyof typeof routeMap] || '/tabs/map';

    try {
      console.log(`🚨 Emergency navigation: Navigating to ${route} for ${category} disaster`);
      await this.router.navigate([route], {
        queryParams: {
          emergency: true,
          autoRoute: true,
          timestamp: Date.now()
        }
      });
      console.log(`✅ Successfully navigated to ${route}`);
    } catch (error) {
      console.error('Error navigating to disaster map:', error);

      // Fallback to main map if specific disaster map fails
      try {
        console.log('🔄 Falling back to main map...');
        await this.router.navigate(['/tabs/map'], {
          queryParams: {
            emergency: true,
            autoRoute: true,
            timestamp: Date.now()
          }
        });
      } catch (fallbackError) {
        console.error('Fallback navigation also failed:', fallbackError);
      }
    }
  }

  /**
   * Dismiss current emergency overlay
   */
  async dismissCurrentEmergency(): Promise<void> {
    if (this.currentModal) {
      this.isShowingEmergency = false;
      this.stopAllEmergencySounds();

      try {
        await this.currentModal.dismiss();
        this.currentModal = null;
      } catch (error) {
        console.warn('Error dismissing emergency modal:', error);
      }
    }
  }

  /**
   * Check if emergency overlay is currently showing
   */
  isEmergencyShowing(): boolean {
    return this.isShowingEmergency;
  }

  /**
   * Force stop all emergency activities (for testing/debugging)
   */
  forceStopEmergency(): void {
    this.isShowingEmergency = false;
    this.stopAllEmergencySounds();

    if (this.currentModal) {
      this.currentModal.dismiss();
      this.currentModal = null;
    }
  }

  /**
   * Test emergency overlay with earthquake notification (for debugging)
   */
  async testEarthquakeEmergency(): Promise<void> {
    const testNotification: EmergencyNotification = {
      id: 'test-earthquake-' + Date.now(),
      title: 'EARTHQUAKE ALERT',
      message: 'A magnitude 7.2 earthquake has been detected in your area. Take immediate safety precautions.',
      category: 'Earthquake',
      severity: 'high',
      timestamp: new Date().toISOString(),
      data: {
        magnitude: 7.2,
        depth: '10km',
        location: 'Test Location'
      }
    };

    console.log('🧪 Testing earthquake emergency overlay...');
    await this.showEmergencyNotification(testNotification);
  }

  /**
   * Test emergency overlay with different disaster types (for debugging)
   */
  async testEmergencyOverlay(
    category: 'Earthquake' | 'Flood' | 'Typhoon' | 'Fire' | 'Landslide' | 'General' = 'Earthquake',
    severity: 'low' | 'medium' | 'high' | 'critical' = 'high'
  ): Promise<void> {
    const testNotification: EmergencyNotification = {
      id: `test-${category.toLowerCase()}-${Date.now()}`,
      title: `${category.toUpperCase()} ALERT`,
      message: `A ${severity} level ${category.toLowerCase()} emergency has been detected in your area. Take immediate safety precautions.`,
      category: category,
      severity: severity,
      timestamp: new Date().toISOString(),
      data: {
        testMode: true,
        location: 'Test Location'
      }
    };

    console.log(`🧪 Testing ${category} emergency overlay with ${severity} severity...`);
    await this.showEmergencyNotification(testNotification);
  }
}
