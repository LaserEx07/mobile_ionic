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
    // Use the same alarm sound for all disaster types
    const alarmSoundPath = 'assets/sounds/NewAlarmForAll.mp3';

    const soundKeys = [
      'Earthquake', 'Flood', 'Typhoon', 'Fire', 'Landslide', 'General', 'critical'
    ];

    soundKeys.forEach(key => {
      const audio = new Audio(alarmSoundPath);
      audio.preload = 'auto';
      audio.loop = true;
      audio.volume = 1.0; // Valid range is 0.0 to 1.0

      // Add load event listener for debugging
      audio.onloadeddata = () => {
        console.log(`✅ Emergency sound loaded successfully: ${alarmSoundPath} for ${key}`);
      };

      // Fallback to default notification sound if emergency sound not found
      audio.onerror = (error) => {
        console.error(`❌ Emergency sound failed to load: ${alarmSoundPath} for ${key}`, error);
        audio.src = 'assets/sounds/notification.mp3';
      };

      this.emergencySounds[key] = audio;
    });

    console.log('🔊 Emergency sounds preloaded for keys:', soundKeys);
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
      // Enable audio interaction first
      await this.enableAudioInteraction();

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
        mode: 'ios', // Force iOS mode for consistent appearance
        canDismiss: true // Allow programmatic dismissal
      });

      // Handle modal dismissal
      this.currentModal.onDidDismiss().then((result) => {
        console.log('🚨 Emergency Service: Modal dismissed with result:', result);
        this.handleEmergencyDismissal(notification, result.data);
      }).catch((error) => {
        console.error('🚨 Emergency Service: Error in modal dismissal handler:', error);
        this.handleEmergencyDismissal(notification, { action: 'error_dismissed' });
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
   * Play emergency sound (same alarm for all disasters)
   */
  private async playEmergencySound(category: string, severity: string): Promise<void> {
    try {
      console.log(`🔊 Attempting to play emergency sound for ${category} (${severity})`);

      // Resume audio context if suspended (required by browser policies)
      if (this.audioContext && this.audioContext.state === 'suspended') {
        console.log('🔊 Resuming suspended audio context...');
        await this.audioContext.resume();
      }

      // Stop any currently playing emergency sounds
      this.stopAllEmergencySounds();

      // Use the same alarm sound for all disasters (onlyAlarm.mp3)
      let audio = this.emergencySounds['General']; // All keys point to the same sound

      if (!audio) {
        console.error('❌ No audio object found for emergency sound');
        return;
      }

      // Check if audio is loaded
      if (audio.readyState < 2) { // HAVE_CURRENT_DATA
        console.log('🔊 Audio not ready, waiting for load...');
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Audio load timeout'));
          }, 5000);

          audio.oncanplay = () => {
            clearTimeout(timeout);
            resolve(void 0);
          };

          audio.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Audio load error'));
          };
        });
      }

      // Set audio properties
      audio.currentTime = 0;
      audio.volume = 1.0; // Valid range is 0.0 to 1.0
      audio.loop = true;

      console.log('🔊 Playing emergency sound...');

      // Play the sound
      const playPromise = audio.play();

      if (playPromise !== undefined) {
        await playPromise;
        console.log(`✅ Emergency alarm sound playing for ${category} (${severity})`);
      } else {
        console.log('✅ Emergency sound started (no promise returned)');
      }

    } catch (error) {
      console.error('❌ Error playing emergency sound:', error);

      // Try to play a simple beep as fallback
      this.playFallbackSound();
    }
  }

  /**
   * Play fallback sound using Web Audio API
   */
  private playFallbackSound(): void {
    try {
      if (!this.audioContext) return;

      console.log('🔊 Playing fallback beep sound...');

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime); // 800Hz beep
      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);

      // Create beep pattern: beep for 0.2s, pause 0.1s, repeat 3 times
      let time = this.audioContext.currentTime;
      for (let i = 0; i < 3; i++) {
        gainNode.gain.setValueAtTime(0.3, time);
        gainNode.gain.setValueAtTime(0, time + 0.2);
        time += 0.3;
      }

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(time);

      console.log('✅ Fallback beep sound played');
    } catch (error) {
      console.error('❌ Fallback sound also failed:', error);
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
    console.log('🚨 Emergency Service: Handling dismissal with action:', actionData?.action);

    this.isShowingEmergency = false;
    this.stopAllEmergencySounds();
    this.currentModal = null;

    // Navigate to appropriate disaster map if user clicked "View Map"
    if (actionData?.action === 'view_map') {
      await this.navigateToDisasterMap(notification.category);
    }

    console.log('✅ Emergency Service: Dismissal handled successfully');
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
    console.log('🚨 Emergency Service: Dismissing current emergency overlay');

    if (this.currentModal) {
      this.isShowingEmergency = false;
      this.stopAllEmergencySounds();

      try {
        await this.currentModal.dismiss({ action: 'service_dismissed' });
        this.currentModal = null;
        console.log('✅ Emergency Service: Modal dismissed successfully');
      } catch (error) {
        console.error('❌ Emergency Service: Error dismissing emergency modal:', error);
        this.currentModal = null; // Clean up even if dismiss failed
      }
    } else {
      console.log('🚨 Emergency Service: No current modal to dismiss');
      this.isShowingEmergency = false;
      this.stopAllEmergencySounds();
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
   * Enable audio interaction (call this after user interaction)
   */
  async enableAudioInteraction(): Promise<void> {
    try {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('✅ Audio context resumed');
      }

      // Test play a silent sound to unlock audio
      const testAudio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
      testAudio.volume = 1.0;
      await testAudio.play();
      testAudio.pause();

      console.log('✅ Audio interaction enabled');
    } catch (error) {
      console.warn('⚠️ Could not enable audio interaction:', error);
    }
  }

  /**
   * Test emergency sound only (for debugging)
   */
  async testEmergencySound(): Promise<void> {
    console.log('🔊 Testing emergency sound...');
    await this.enableAudioInteraction();
    await this.playEmergencySound('Test', 'high');
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
