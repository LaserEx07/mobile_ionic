import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { OpenStreetMapRoutingService, Route, NavigationInstruction } from '../../services/openstreetmap-routing.service';
import { Geolocation } from '@capacitor/geolocation';

@Component({
  selector: 'app-real-time-navigation',
  templateUrl: './real-time-navigation.component.html',
  styleUrls: ['./real-time-navigation.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class RealTimeNavigationComponent implements OnInit, OnDestroy {
  @Input() destination!: { lat: number; lng: number; name?: string };
  @Input() travelMode: 'foot-walking' | 'cycling-regular' | 'driving-car' = 'foot-walking';
  @Input() autoStart = false;
  
  @Output() routeUpdated = new EventEmitter<Route>();
  @Output() navigationStarted = new EventEmitter<void>();
  @Output() navigationStopped = new EventEmitter<void>();
  @Output() instructionChanged = new EventEmitter<NavigationInstruction>();

  isNavigating = false;
  currentRoute: Route | null = null;
  currentInstruction: NavigationInstruction | null = null;
  instructions: NavigationInstruction[] = [];
  
  userPosition: { lat: number; lng: number } | null = null;
  eta: Date | null = null;
  remainingDistance = 0;
  remainingTime = 0;
  
  private positionWatcher: any = null;

  constructor(private routingService: OpenStreetMapRoutingService) {}

  ngOnInit() {
    if (this.autoStart && this.destination) {
      this.startNavigation();
    }
  }

  ngOnDestroy() {
    this.stopNavigation();
  }

  async startNavigation() {
    if (!this.destination) {
      console.error('No destination provided for navigation');
      return;
    }

    console.log('🧭 Starting real-time navigation to:', this.destination);
    this.isNavigating = true;
    this.navigationStarted.emit();

    try {
      // Get initial position
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      });

      this.userPosition = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      // Start position tracking
      this.startPositionTracking();

      // Start real-time routing
      this.routingService.startRealTimeRouting(
        this.destination,
        this.travelMode,
        (route: Route) => this.onRouteUpdated(route),
        15000 // Update every 15 seconds
      );

      // Update initial position
      this.routingService.updateUserPosition(
        this.userPosition.lat,
        this.userPosition.lng
      );

    } catch (error) {
      console.error('❌ Failed to start navigation:', error);
      this.stopNavigation();
    }
  }

  stopNavigation() {
    console.log('⏹️ Stopping real-time navigation');
    this.isNavigating = false;
    this.currentRoute = null;
    this.currentInstruction = null;
    this.instructions = [];
    this.eta = null;
    this.remainingDistance = 0;
    this.remainingTime = 0;

    // Stop position tracking
    if (this.positionWatcher) {
      Geolocation.clearWatch({ id: this.positionWatcher });
      this.positionWatcher = null;
    }

    // Stop routing service
    this.routingService.stopRealTimeRouting();
    this.navigationStopped.emit();
  }

  private async startPositionTracking() {
    try {
      this.positionWatcher = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000
        },
        (position) => {
          if (position) {
            this.userPosition = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };

            // Update routing service with new position
            this.routingService.updateUserPosition(
              this.userPosition.lat,
              this.userPosition.lng
            );

            // Update current instruction
            this.updateCurrentInstruction();
          }
        }
      );
    } catch (error) {
      console.error('❌ Failed to start position tracking:', error);
    }
  }

  private onRouteUpdated(route: Route) {
    console.log('🔄 Route updated in navigation component');
    this.currentRoute = route;
    this.instructions = this.routingService.getNavigationInstructions(route);
    this.eta = this.routingService.getETA(route);
    this.remainingDistance = route.distance;
    this.remainingTime = route.duration;

    this.updateCurrentInstruction();
    this.routeUpdated.emit(route);
  }

  private updateCurrentInstruction() {
    if (this.userPosition && this.instructions.length > 0) {
      const newInstruction = this.routingService.getCurrentInstruction(
        this.userPosition.lat,
        this.userPosition.lng,
        this.instructions
      );

      if (newInstruction && newInstruction.id !== this.currentInstruction?.id) {
        this.currentInstruction = newInstruction;
        this.instructionChanged.emit(newInstruction);
        console.log('📍 Navigation instruction updated:', newInstruction.instruction);
      }
    }
  }

  // Helper methods for template
  formatDistance(meters: number): string {
    return this.routingService.formatDistance(meters);
  }

  formatDuration(seconds: number): string {
    return this.routingService.formatDuration(seconds);
  }

  formatETA(): string {
    if (!this.eta) return '';
    return this.eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  getManeuverIcon(maneuver: string): string {
    const iconMap: { [key: string]: string } = {
      'straight': 'arrow-up',
      'turn-left': 'arrow-back',
      'turn-right': 'arrow-forward',
      'u-turn': 'return-up-back',
      'roundabout': 'refresh-circle',
      'exit': 'exit',
      'merge': 'git-merge'
    };
    return iconMap[maneuver] || 'arrow-up';
  }

  getTravelModeIcon(): string {
    const iconMap = {
      'foot-walking': 'walk',
      'cycling-regular': 'bicycle',
      'driving-car': 'car'
    };
    return iconMap[this.travelMode] || 'walk';
  }
}
