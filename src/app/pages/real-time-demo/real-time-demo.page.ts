import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RealTimeNavigationComponent } from '../../components/real-time-navigation/real-time-navigation.component';
import { OpenStreetMapRoutingService, Route, NavigationInstruction } from '../../services/openstreetmap-routing.service';

@Component({
  selector: 'app-real-time-demo',
  templateUrl: './real-time-demo.page.html',
  styleUrls: ['./real-time-demo.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RealTimeNavigationComponent]
})
export class RealTimeDemoPage implements OnInit {
  
  // Demo destinations in Cebu City
  demoDestinations = [
    {
      name: 'Cebu City Hall',
      lat: 10.2935,
      lng: 123.9015
    },
    {
      name: 'Ayala Center Cebu',
      lat: 10.3181,
      lng: 123.9058
    },
    {
      name: 'SM City Cebu',
      lat: 10.3369,
      lng: 123.9233
    },
    {
      name: 'University of San Carlos',
      lat: 10.3017,
      lng: 123.8947
    }
  ];

  selectedDestination: { lat: number; lng: number; name?: string } | null = null;
  selectedTravelMode: 'foot-walking' | 'cycling-regular' | 'driving-car' = 'foot-walking';
  
  // Navigation state
  isNavigating = false;
  currentRoute: Route | null = null;
  currentInstruction: NavigationInstruction | null = null;
  
  // Demo logs
  logs: string[] = [];

  constructor(public routingService: OpenStreetMapRoutingService) {}

  ngOnInit() {
    this.addLog('🚀 Real-time Navigation Demo initialized');
  }

  selectDestination(destination: any) {
    this.selectedDestination = destination;
    this.addLog(`📍 Selected destination: ${destination.name}`);
  }

  selectTravelMode(mode: 'foot-walking' | 'cycling-regular' | 'driving-car') {
    this.selectedTravelMode = mode;
    this.addLog(`🚶‍♂️ Selected travel mode: ${mode}`);
  }

  onNavigationStarted() {
    this.isNavigating = true;
    this.addLog('🧭 Real-time navigation started');
  }

  onNavigationStopped() {
    this.isNavigating = false;
    this.currentRoute = null;
    this.currentInstruction = null;
    this.addLog('⏹️ Real-time navigation stopped');
  }

  onRouteUpdated(route: Route) {
    this.currentRoute = route;
    const summary = this.routingService.getRouteSummary(route);
    this.addLog(`🔄 Route updated: ${summary.distanceText}, ${summary.durationText}`);
  }

  onInstructionChanged(instruction: NavigationInstruction) {
    this.currentInstruction = instruction;
    this.addLog(`📍 Navigation instruction: ${instruction.instruction}`);
  }

  clearLogs() {
    this.logs = [];
  }

  private addLog(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    this.logs.unshift(`[${timestamp}] ${message}`);
    
    // Keep only last 20 logs
    if (this.logs.length > 20) {
      this.logs = this.logs.slice(0, 20);
    }
    
    console.log(message);
  }

  // Helper methods
  getTravelModeIcon(mode: string): string {
    const iconMap = {
      'foot-walking': 'walk',
      'cycling-regular': 'bicycle',
      'driving-car': 'car'
    };
    return iconMap[mode as keyof typeof iconMap] || 'walk';
  }

  getTravelModeLabel(mode: string): string {
    const labelMap = {
      'foot-walking': 'Walking',
      'cycling-regular': 'Cycling',
      'driving-car': 'Driving'
    };
    return labelMap[mode as keyof typeof labelMap] || 'Walking';
  }
}
