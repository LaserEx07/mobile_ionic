import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';

interface EvacuationCenter {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  capacity?: number;
  status?: string;
  disaster_type?: string;
  contact?: string;
}

@Component({
  selector: 'app-evacuation-center-modal',
  templateUrl: './evacuation-center-modal.component.html',
  styleUrls: ['./evacuation-center-modal.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class EvacuationCenterModalComponent {
  @Input() center!: EvacuationCenter;

  constructor(
    private modalCtrl: ModalController,
    private router: Router,
    private toastCtrl: ToastController
  ) {}

  dismiss() {
    this.modalCtrl.dismiss();
  }

  viewOnMap() {
    this.modalCtrl.dismiss();

    // Navigate to map tab with center coordinates
    this.router.navigate(['/tabs/map'], {
      queryParams: {
        lat: this.center.latitude,
        lng: this.center.longitude,
        name: this.center.name,
        viewOnly: 'true'
      }
    });

    this.toastCtrl.create({
      message: `Showing ${this.center.name} on map`,
      duration: 2000,
      color: 'success'
    }).then(toast => toast.present());
  }

  getDirections() {
    this.modalCtrl.dismiss();

    // Navigate to map tab with center coordinates and directions flag
    this.router.navigate(['/tabs/map'], {
      queryParams: {
        lat: this.center.latitude,
        lng: this.center.longitude,
        name: this.center.name,
        directions: 'true'
      }
    });

    this.toastCtrl.create({
      message: `Getting directions to ${this.center.name}`,
      duration: 2000,
      color: 'success'
    }).then(toast => toast.present());
  }

  getDisasterTypeIcon(type: string | undefined): string {
    if (!type) return 'alert-circle-outline';

    const normalizedType = type.toLowerCase();

    // Check if it's an "Others:" type
    if (type.startsWith('Others:')) {
      return 'help-circle-outline';
    } else if (normalizedType.includes('earthquake') || normalizedType.includes('quake')) {
      return 'earth-outline';
    } else if (normalizedType.includes('flood') || normalizedType.includes('flash')) {
      return 'water-outline';
    } else if (normalizedType.includes('typhoon') || normalizedType.includes('storm')) {
      return 'thunderstorm-outline';
    } else if (normalizedType.includes('fire')) {
      return 'flame-outline';
    } else if (normalizedType.includes('landslide') || normalizedType.includes('slide')) {
      return 'triangle-outline';
    } else if (normalizedType.includes('others')) {
      return 'help-circle-outline';
    }

    return 'alert-circle-outline';
  }

  getStatusColor(status: string | undefined): string {
    if (!status) return 'medium';

    const normalizedStatus = status.toLowerCase();

    if (normalizedStatus.includes('active') || normalizedStatus.includes('open')) {
      return 'success';
    } else if (normalizedStatus.includes('inactive') || normalizedStatus.includes('closed')) {
      return 'warning';
    } else if (normalizedStatus.includes('full')) {
      return 'danger';
    }

    return 'medium';
  }
}
