import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

interface Direction {
  instruction: string;
  distance: number;
  duration: number;
  name: string;
  type: number;
}

@Component({
  selector: 'app-directions-panel',
  templateUrl: './directions-panel.component.html',
  styleUrls: ['./directions-panel.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class DirectionsPanelComponent {
  @Input() directions: Direction[] = [];
  @Input() travelMode: string = 'foot-walking';
  @Input() totalDistance: number | null = null;
  @Input() totalDuration: number | null = null;
  
  @Output() close = new EventEmitter<void>();

  constructor() {}

  getTravelModeName(): string {
    switch(this.travelMode) {
      case 'foot-walking':
        return 'Walking';
      case 'cycling-regular':
        return 'Cycling';
      case 'driving-car':
        return 'Driving';
      default:
        return 'Traveling';
    }
  }

  getTravelModeIcon(): string {
    switch(this.travelMode) {
      case 'foot-walking':
        return 'walk-outline';
      case 'cycling-regular':
        return 'bicycle-outline';
      case 'driving-car':
        return 'car-outline';
      default:
        return 'navigate-outline';
    }
  }

  getTravelModeColor(): string {
    switch(this.travelMode) {
      case 'foot-walking':
        return 'primary';
      case 'cycling-regular':
        return 'success';
      case 'driving-car':
        return 'danger';
      default:
        return 'medium';
    }
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

  closePanel() {
    this.close.emit();
  }

  getDirectionIcon(type: number): string {
    // Direction types from OpenRouteService API
    switch(type) {
      case 0: return 'arrow-forward-outline'; // continue straight
      case 1: return 'arrow-forward-outline'; // slight right
      case 2: return 'arrow-forward-outline'; // right
      case 3: return 'arrow-forward-outline'; // sharp right
      case 4: return 'arrow-back-outline';    // reverse
      case 5: return 'arrow-back-outline';    // sharp left
      case 6: return 'arrow-back-outline';    // left
      case 7: return 'arrow-back-outline';    // slight left
      case 8: return 'arrow-down-outline';    // reach via point
      case 9: return 'flag-outline';          // reached destination
      case 10: return 'arrow-up-outline';     // start
      case 11: return 'arrow-forward-outline'; // enter roundabout
      case 12: return 'arrow-forward-outline'; // exit roundabout
      case 13: return 'arrow-forward-outline'; // stay on roundabout
      case 14: return 'arrow-forward-outline'; // start at end of street
      case 15: return 'flag-outline';          // destination reached
      default: return 'navigate-outline';
    }
  }
}
