import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ModalController } from '@ionic/angular';
import { EmergencyOverlayComponent } from '../components/emergency-overlay/emergency-overlay.component';

export interface ActiveAlert {
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
export class NotificationBannerService {
  private activeAlertSubject = new BehaviorSubject<ActiveAlert | null>(null);
  public activeAlert$ = this.activeAlertSubject.asObservable();

  private alertHistory: ActiveAlert[] = [];
  private readonly MAX_HISTORY = 10;

  constructor(private modalController: ModalController) {
    // Load persisted alert from storage on service initialization
    this.loadPersistedAlert();
  }

  /**
   * Show a new alert in the banner
   */
  showAlert(alert: ActiveAlert): void {
    console.log('📢 [BANNER] Showing new alert:', alert);
    
    // Add to history
    this.addToHistory(alert);
    
    // Set as active alert
    this.activeAlertSubject.next(alert);
    
    // Persist to storage
    this.persistAlert(alert);
    
    // Auto-dismiss after a certain time based on severity
    this.scheduleAutoDismiss(alert);
  }

  /**
   * Dismiss the current active alert
   */
  dismissAlert(): void {
    console.log('❌ [BANNER] Dismissing active alert');
    
    this.activeAlertSubject.next(null);
    this.clearPersistedAlert();
  }

  /**
   * View the full alert details
   */
  async viewAlert(alert: ActiveAlert): Promise<void> {
    console.log('👁️ [BANNER] Viewing alert details:', alert);
    
    try {
      // Convert to emergency notification format
      const emergencyNotification = {
        id: alert.id,
        title: alert.title,
        message: alert.message,
        category: alert.category,
        severity: alert.severity,
        timestamp: alert.timestamp,
        data: alert.data
      };

      // Create and present emergency modal
      const modal = await this.modalController.create({
        component: EmergencyOverlayComponent,
        componentProps: {
          notification: emergencyNotification
        },
        cssClass: `emergency-overlay ${alert.category.toLowerCase()}-emergency ${alert.severity}-severity`,
        backdropDismiss: true,
        keyboardClose: false,
        showBackdrop: true,
        animated: true,
        mode: 'ios'
      });

      await modal.present();
      
      // Optionally dismiss the banner when viewing full details
      // this.dismissAlert();
      
    } catch (error) {
      console.error('❌ [BANNER] Error viewing alert:', error);
    }
  }

  /**
   * Get current active alert
   */
  getCurrentAlert(): ActiveAlert | null {
    return this.activeAlertSubject.value;
  }

  /**
   * Get alert history
   */
  getAlertHistory(): ActiveAlert[] {
    return [...this.alertHistory];
  }

  /**
   * Clear all alerts and history
   */
  clearAll(): void {
    console.log('🧹 [BANNER] Clearing all alerts and history');
    
    this.activeAlertSubject.next(null);
    this.alertHistory = [];
    this.clearPersistedAlert();
    localStorage.removeItem('alert_history');
  }

  /**
   * Check if there's an active alert
   */
  hasActiveAlert(): boolean {
    return this.activeAlertSubject.value !== null;
  }

  /**
   * Update an existing alert
   */
  updateAlert(updatedAlert: ActiveAlert): void {
    const currentAlert = this.activeAlertSubject.value;
    
    if (currentAlert && currentAlert.id === updatedAlert.id) {
      console.log('🔄 [BANNER] Updating active alert:', updatedAlert);
      
      this.activeAlertSubject.next(updatedAlert);
      this.persistAlert(updatedAlert);
      
      // Update in history as well
      const historyIndex = this.alertHistory.findIndex(alert => alert.id === updatedAlert.id);
      if (historyIndex !== -1) {
        this.alertHistory[historyIndex] = updatedAlert;
        this.persistHistory();
      }
    }
  }

  /**
   * Add alert to history
   */
  private addToHistory(alert: ActiveAlert): void {
    // Remove existing alert with same ID
    this.alertHistory = this.alertHistory.filter(a => a.id !== alert.id);
    
    // Add to beginning of array
    this.alertHistory.unshift(alert);
    
    // Limit history size
    if (this.alertHistory.length > this.MAX_HISTORY) {
      this.alertHistory = this.alertHistory.slice(0, this.MAX_HISTORY);
    }
    
    this.persistHistory();
  }

  /**
   * Schedule auto-dismiss based on severity
   */
  private scheduleAutoDismiss(alert: ActiveAlert): void {
    let dismissTime: number;
    
    switch (alert.severity) {
      case 'critical':
        dismissTime = 300000; // 5 minutes
        break;
      case 'high':
        dismissTime = 180000; // 3 minutes
        break;
      case 'medium':
        dismissTime = 120000; // 2 minutes
        break;
      case 'low':
        dismissTime = 60000; // 1 minute
        break;
      default:
        dismissTime = 120000; // 2 minutes default
    }
    
    setTimeout(() => {
      const currentAlert = this.activeAlertSubject.value;
      if (currentAlert && currentAlert.id === alert.id) {
        console.log('⏰ [BANNER] Auto-dismissing alert after timeout:', alert.id);
        this.dismissAlert();
      }
    }, dismissTime);
  }

  /**
   * Persist active alert to storage
   */
  private persistAlert(alert: ActiveAlert): void {
    try {
      localStorage.setItem('active_alert', JSON.stringify(alert));
    } catch (error) {
      console.error('❌ [BANNER] Error persisting alert:', error);
    }
  }

  /**
   * Load persisted alert from storage
   */
  private loadPersistedAlert(): void {
    try {
      const persistedAlert = localStorage.getItem('active_alert');
      if (persistedAlert) {
        const alert: ActiveAlert = JSON.parse(persistedAlert);
        
        // Check if alert is still recent (within last 24 hours)
        const alertTime = new Date(alert.timestamp);
        const now = new Date();
        const hoursDiff = (now.getTime() - alertTime.getTime()) / (1000 * 60 * 60);
        
        if (hoursDiff < 24) {
          console.log('📱 [BANNER] Loading persisted alert:', alert);
          this.activeAlertSubject.next(alert);
        } else {
          console.log('🗑️ [BANNER] Persisted alert too old, clearing:', alert);
          this.clearPersistedAlert();
        }
      }
    } catch (error) {
      console.error('❌ [BANNER] Error loading persisted alert:', error);
      this.clearPersistedAlert();
    }
  }

  /**
   * Clear persisted alert from storage
   */
  private clearPersistedAlert(): void {
    try {
      localStorage.removeItem('active_alert');
    } catch (error) {
      console.error('❌ [BANNER] Error clearing persisted alert:', error);
    }
  }

  /**
   * Persist alert history to storage
   */
  private persistHistory(): void {
    try {
      localStorage.setItem('alert_history', JSON.stringify(this.alertHistory));
    } catch (error) {
      console.error('❌ [BANNER] Error persisting history:', error);
    }
  }

  /**
   * Load alert history from storage
   */
  private loadHistory(): void {
    try {
      const persistedHistory = localStorage.getItem('alert_history');
      if (persistedHistory) {
        this.alertHistory = JSON.parse(persistedHistory);
      }
    } catch (error) {
      console.error('❌ [BANNER] Error loading history:', error);
      this.alertHistory = [];
    }
  }
}