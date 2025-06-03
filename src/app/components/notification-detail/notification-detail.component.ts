import { Component, Input, OnInit } from '@angular/core';
import { ModalController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

export interface NotificationDetail {
  id: number;
  title: string;
  body: string;
  category: string;
  severity: string;
  barangay?: string;
  affected_areas?: any[];
  timestamp: string;
  notification_id?: string;
}

@Component({
  standalone: true,
  imports: [IonicModule, CommonModule],
  selector: 'app-notification-detail',
  templateUrl: './notification-detail.component.html',
  styleUrls: ['./notification-detail.component.scss']
})
export class NotificationDetailComponent implements OnInit {
  @Input() notification!: NotificationDetail;

  constructor(private modalController: ModalController) {}

  ngOnInit() {
    console.log('Notification detail opened:', this.notification);
  }

  /**
   * Close the modal
   */
  async closeModal() {
    await this.modalController.dismiss();
  }

  /**
   * Get category display name
   */
  getCategoryDisplayName(category: string): string {
    switch (category.toLowerCase()) {
      case 'earthquake': return 'Earthquake Alert';
      case 'typhoon': return 'Typhoon Warning';
      case 'flood': return 'Flood Alert';
      case 'fire': return 'Fire Emergency';
      case 'emergency': return 'Emergency Alert';
      case 'evacuation': return 'Evacuation Notice';
      case 'general': return 'General Announcement';
      case 'announcement': return 'Public Announcement';
      default: return 'Alert';
    }
  }

  /**
   * Get category icon
   */
  getCategoryIcon(category: string): string {
    switch (category.toLowerCase()) {
      case 'earthquake': return 'earth-outline';
      case 'typhoon': return 'thunderstorm-outline';
      case 'flood': return 'water-outline';
      case 'fire': return 'flame-outline';
      case 'emergency': return 'warning-outline';
      case 'evacuation': return 'walk-outline';
      case 'general': return 'megaphone-outline';
      case 'announcement': return 'chatbubble-outline';
      default: return 'alert-circle-outline';
    }
  }

  /**
   * Get category color
   */
  getCategoryColor(category: string): string {
    switch (category.toLowerCase()) {
      case 'earthquake': return '#FFA500'; // Orange
      case 'typhoon': return '#008000'; // Green
      case 'flood': return '#0066CC'; // Blue
      case 'fire': return '#FF0000'; // Red
      case 'emergency': return '#FF0000'; // Red
      case 'evacuation': return '#FF6600'; // Orange-Red
      case 'general': return '#666666'; // Gray
      case 'announcement': return '#0066CC'; // Blue
      default: return '#666666'; // Gray
    }
  }

  /**
   * Get severity display name
   */
  getSeverityDisplayName(severity: string): string {
    switch (severity.toLowerCase()) {
      case 'high': return 'High Priority';
      case 'medium': return 'Medium Priority';
      case 'low': return 'Low Priority';
      default: return 'Normal Priority';
    }
  }

  /**
   * Get severity color
   */
  getSeverityColor(severity: string): string {
    switch (severity.toLowerCase()) {
      case 'high': return '#FF0000'; // Red
      case 'medium': return '#FFA500'; // Orange
      case 'low': return '#008000'; // Green
      default: return '#666666'; // Gray
    }
  }

  /**
   * Get formatted timestamp
   */
  getFormattedTimestamp(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (error) {
      return timestamp;
    }
  }

  /**
   * Get affected areas summary
   */
  getAffectedAreasSummary(): string {
    if (!this.notification.affected_areas || !Array.isArray(this.notification.affected_areas)) {
      return 'No specific areas defined';
    }

    const count = this.notification.affected_areas.length;
    if (count === 1) {
      return '1 area affected';
    } else {
      return `${count} areas affected`;
    }
  }

  /**
   * Check if notification has map data
   */
  hasMapData(): boolean {
    return !!(this.notification.affected_areas &&
           Array.isArray(this.notification.affected_areas) &&
           this.notification.affected_areas.length > 0);
  }

  /**
   * View affected areas on map
   */
  viewOnMap() {
    // TODO: Implement navigation to map with affected areas highlighted
    console.log('View on map clicked for areas:', this.notification.affected_areas);
    // You can implement navigation to your map page here
    // Example: this.router.navigate(['/map'], { queryParams: { areas: JSON.stringify(this.notification.affected_areas) } });
  }
}
