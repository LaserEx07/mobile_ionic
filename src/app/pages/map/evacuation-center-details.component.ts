import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { MapboxRoutingService } from '../../services/mapbox-routing.service';

interface EvacuationCenter {
  name: string;
  latitude: number;
  longitude: number;
  disaster_type?: string;
  address?: string;
  capacity?: number;
  status?: string;
  contact?: string;
}

interface TravelTimeEstimate {
  mode: string;
  time: number; // in seconds
  distance: number; // in meters
  icon: string;
  color: string;
}

@Component({
  selector: 'app-evacuation-center-details',
  templateUrl: './evacuation-center-details.component.html',
  styleUrls: ['./evacuation-center-details.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class EvacuationCenterDetailsComponent implements OnInit {
  @Input() center!: EvacuationCenter;
  @Input() userLat!: number;
  @Input() userLng!: number;

  travelEstimates: TravelTimeEstimate[] = [];
  selectedMode: string = 'foot-walking';
  isLoading: boolean = true;

  constructor(
    private modalCtrl: ModalController,
    private http: HttpClient,
    private toastCtrl: ToastController,
    private mapboxRouting: MapboxRoutingService
  ) {}

  async ngOnInit() {
    this.isLoading = true;

    // Calculate travel times for different modes
    await this.calculateTravelTimes();

    this.isLoading = false;
  }

  async calculateTravelTimes() {
    const modes = [
      { id: 'foot-walking', name: 'Walking', icon: 'walk-outline', color: 'primary' },
      { id: 'cycling-regular', name: 'Cycling', icon: 'bicycle-outline', color: 'success' },
      { id: 'driving-car', name: 'Driving', icon: 'car-outline', color: 'danger' }
    ];

    this.travelEstimates = [];

    // Ensure center coordinates are properly converted to numbers
    const centerLat = Number(this.center.latitude);
    const centerLng = Number(this.center.longitude);

    console.log('Calculating travel times with coordinates:', {
      userLat: this.userLat,
      userLng: this.userLng,
      centerLat: centerLat,
      centerLng: centerLng
    });

    // Validate coordinates before proceeding
    if (isNaN(centerLat) || isNaN(centerLng) || isNaN(this.userLat) || isNaN(this.userLng)) {
      console.error('Invalid coordinates for travel time calculations:', {
        userLat: this.userLat,
        userLng: this.userLng,
        centerLat: centerLat,
        centerLng: centerLng
      });

      // Show error toast
      this.toastCtrl.create({
        message: 'Invalid coordinates. Using estimated travel times.',
        duration: 3000,
        color: 'warning',
        position: 'bottom'
      }).then(toast => toast.present());

      // Use fallback calculations for all modes
      this.useFallbackCalculations(modes);
      return;
    }

    for (const mode of modes) {
      try {
        const estimate = await this.getTravelTimeEstimate(
          this.userLat,
          this.userLng,
          centerLat,
          centerLng,
          mode.id
        );

        this.travelEstimates.push({
          mode: mode.id,
          time: estimate.time,
          distance: estimate.distance,
          icon: mode.icon,
          color: mode.color
        });
      } catch (error: any) {
        console.error(`Error calculating ${mode.name} time:`, error);

        // Show a toast for API errors but continue with fallback calculation
        if (this.travelEstimates.length === 0) {
          // Only show the toast for the first error to avoid multiple toasts
          let errorMessage = 'Using estimated travel times due to connection issues';

          // Try to extract more specific error message
          if (error.message) {
            if (error.message.includes('Invalid coordinates')) {
              errorMessage = 'Invalid coordinates. Using estimated travel times.';
            } else if (error.message.includes('API Error')) {
              errorMessage = `${error.message}. Using estimated travel times.`;
            }
          }

          this.toastCtrl.create({
            message: errorMessage,
            duration: 3000,
            color: 'warning',
            position: 'bottom'
          }).then(toast => toast.present());
        }

        // Add a fallback estimate based on straight-line distance
        const distance = this.calculateStraightLineDistance(
          this.userLat, this.userLng,
          centerLat, centerLng
        );

        // Rough estimates: walking 5km/h, cycling 15km/h, driving 40km/h
        let speed;
        switch(mode.id) {
          case 'foot-walking': speed = 5000 / 3600; break; // meters per second
          case 'cycling-regular': speed = 15000 / 3600; break;
          case 'driving-car': speed = 40000 / 3600; break;
          default: speed = 5000 / 3600;
        }

        const time = distance / speed;

        this.travelEstimates.push({
          mode: mode.id,
          time: time,
          distance: distance,
          icon: mode.icon,
          color: mode.color
        });
      }
    }
  }

  // Helper method to use fallback calculations for all travel modes
  private useFallbackCalculations(modes: {id: string, name: string, icon: string, color: string}[]) {
    // Ensure center coordinates are properly converted to numbers
    const centerLat = Number(this.center.latitude);
    const centerLng = Number(this.center.longitude);

    // Use default coordinates if invalid
    const validUserLat = isNaN(this.userLat) ? 10.3157 : this.userLat;
    const validUserLng = isNaN(this.userLng) ? 123.8854 : this.userLng;
    const validCenterLat = isNaN(centerLat) ? 10.3257 : centerLat;
    const validCenterLng = isNaN(centerLng) ? 123.8954 : centerLng;

    // Calculate straight-line distance
    const distance = this.calculateStraightLineDistance(
      validUserLat, validUserLng,
      validCenterLat, validCenterLng
    );

    console.log(`Using fallback calculation with distance: ${distance} meters`);

    // Add fallback estimates for all modes
    for (const mode of modes) {
      // Rough estimates: walking 5km/h, cycling 15km/h, driving 40km/h
      let speed;
      switch(mode.id) {
        case 'foot-walking': speed = 5000 / 3600; break; // meters per second
        case 'cycling-regular': speed = 15000 / 3600; break;
        case 'driving-car': speed = 40000 / 3600; break;
        default: speed = 5000 / 3600;
      }

      const time = distance / speed;

      this.travelEstimates.push({
        mode: mode.id,
        time: time,
        distance: distance,
        icon: mode.icon,
        color: mode.color
      });
    }
  }

  async getTravelTimeEstimate(startLat: number, startLng: number, endLat: number, endLng: number, mode: string): Promise<{time: number, distance: number}> {
    // Validate coordinates first
    if ([startLat, startLng, endLat, endLng].some(val => typeof val !== 'number' || isNaN(val))) {
      console.error('Invalid coordinates for travel time estimate:', { startLat, startLng, endLat, endLng });
      throw new Error('Invalid coordinates');
    }

    if (
      Math.abs(startLat) > 90 || Math.abs(endLat) > 90 ||
      Math.abs(startLng) > 180 || Math.abs(endLng) > 180
    ) {
      console.error('Coordinates out of range for travel time estimate:', { startLat, startLng, endLat, endLng });
      throw new Error('Coordinates out of range');
    }

    console.log(`Calculating Mapbox route from [${startLat}, ${startLng}] to [${endLat}, ${endLng}] using mode: ${mode}`);

    try {
      // Convert travel mode to Mapbox profile
      const mapboxProfile = this.mapboxRouting.convertTravelModeToProfile(mode);

      // Get directions from Mapbox
      const response = await this.mapboxRouting.getDirections(
        startLng, startLat, endLng, endLat,
        mapboxProfile,
        {
          geometries: 'geojson',
          overview: 'simplified', // Use simplified for faster response
          steps: false // Don't need detailed steps for time estimation
        }
      );

      if (!response.routes || response.routes.length === 0) {
        throw new Error('No routes found');
      }

      const route = response.routes[0];
      console.log(`Received Mapbox response for ${mode} route:`, {
        duration: route.duration,
        distance: route.distance
      });

      return {
        time: route.duration, // Mapbox returns duration in seconds
        distance: route.distance // Mapbox returns distance in meters
      };
    } catch (error: any) {
      console.error(`Failed to fetch ${mode} route from Mapbox:`, error);

      // Provide more specific error messages for Mapbox
      if (error.message) {
        if (error.message.includes('Invalid Mapbox access token')) {
          throw new Error('Invalid Mapbox access token. Please check your token configuration.');
        } else if (error.message.includes('Rate limit exceeded')) {
          throw new Error('Too many requests to Mapbox. Please wait a moment and try again.');
        } else if (error.message.includes('Network error')) {
          throw new Error('Network error. Please check your internet connection.');
        } else if (error.message.includes('No routes found')) {
          throw new Error('No route could be calculated between these points.');
        } else {
          throw new Error(`Mapbox routing error: ${error.message}`);
        }
      }

      throw error;
    }
  }

  calculateStraightLineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  formatTime(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours} hr ${remainingMinutes} min`;
    }
  }

  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    } else {
      return `${(meters / 1000).toFixed(2)} km`;
    }
  }

  selectTravelMode(mode: string) {
    this.selectedMode = mode;
    this.dismiss(mode);
  }

  dismiss(selectedMode?: string) {
    this.modalCtrl.dismiss({
      selectedMode: selectedMode || null
    });
  }

  getDisasterTypeIcon(type: string | undefined): string {
    if (!type) return 'alert-circle-outline';

    const normalizedType = type.toLowerCase();

    if (normalizedType.includes('earthquake') || normalizedType.includes('quake')) {
      return 'earth-outline';
    } else if (normalizedType.includes('flood') || normalizedType.includes('flash')) {
      return 'water-outline';
    } else if (normalizedType.includes('typhoon') || normalizedType.includes('storm')) {
      return 'thunderstorm-outline';
    } else if (normalizedType.includes('fire')) {
      return 'flame-outline';
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
