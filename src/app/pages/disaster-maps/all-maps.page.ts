import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, LoadingController, ToastController, AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Geolocation } from '@capacitor/geolocation';
import { OpenStreetMapRoutingService } from '../../services/openstreetmap-routing.service';
import { EnhancedDownloadService } from '../../services/enhanced-download.service';
import * as L from 'leaflet';

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
  selector: 'app-all-maps',
  templateUrl: './all-maps.page.html',
  styleUrls: ['./all-maps.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class AllMapsPage implements OnInit {
  private map!: L.Map;
  private userMarker: L.Marker<any> | null = null;
  private routeLayer: L.LayerGroup | null = null;
  private nearestMarkers: L.Marker[] = [];

  public evacuationCenters: EvacuationCenter[] = [];
  public centerCounts = {
    earthquake: 0,
    typhoon: 0,
    flood: 0,
    total: 0
  };

  public travelMode: 'walking' | 'cycling' | 'driving' = 'walking';
  public routeTime: number = 0;
  public routeDistance: number = 0;
  public userLocation: { lat: number, lng: number } | null = null;

  // Navigation panel properties
  public selectedCenter: EvacuationCenter | null = null;
  public selectedTransportMode: 'walking' | 'cycling' | 'driving' | null = null;
  public routeInfo: {
    walking?: { duration: number; distance: number };
    cycling?: { duration: number; distance: number };
    driving?: { duration: number; distance: number };
  } = {};

  private loadingCtrl = inject(LoadingController);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private http = inject(HttpClient);
  private router = inject(Router);
  private osmRouting = inject(OpenStreetMapRoutingService);
  private enhancedDownload = inject(EnhancedDownloadService);

  async ngOnInit() {
    console.log('🗺️ ALL MAPS: Initializing...');
    await this.loadAllMaps();
  }

  async loadAllMaps() {
    const loading = await this.loadingCtrl.create({
      message: 'Loading all evacuation centers...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      // Get user location
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20000
      });

      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;

      this.userLocation = { lat: userLat, lng: userLng };

      console.log(`🗺️ ALL MAPS: User location [${userLat}, ${userLng}]`);

      // Initialize map
      this.initializeMap(userLat, userLng);

      // Load ALL evacuation centers with category-specific markers
      await this.loadAllCenters(userLat, userLng);

      await loading.dismiss();

      // Show success message
      const toast = await this.toastCtrl.create({
        message: `🗺️ Showing all ${this.centerCounts.total} evacuation centers`,
        duration: 3000,
        color: 'secondary',
        position: 'top'
      });
      await toast.present();

    } catch (error) {
      await loading.dismiss();
      console.error('🗺️ ALL MAPS: Error loading map', error);

      const alert = await this.alertCtrl.create({
        header: 'Location Error',
        message: 'Unable to get your location. Please enable GPS and try again.',
        buttons: [
          {
            text: 'Retry',
            handler: () => this.loadAllMaps()
          },
          {
            text: 'Go Back',
            handler: () => this.router.navigate(['/tabs/home'])
          }
        ]
      });
      await alert.present();
    }
  }

  initializeMap(lat: number, lng: number) {
    console.log(`🗺️ ALL MAPS: Initializing map at [${lat}, ${lng}]`);

    if (this.map) {
      this.map.remove();
    }

    this.map = L.map('all-maps').setView([lat, lng], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'OpenStreetMap contributors'
    }).addTo(this.map);

    // Add user marker
    this.userMarker = L.marker([lat, lng], {
      icon: L.icon({
        iconUrl: 'assets/icons/user-location.png',
        iconSize: [30, 30],
        iconAnchor: [15, 30]
      })
    }).addTo(this.map);

    this.userMarker.bindPopup('📍 You are here!').openPopup();
  }

  async loadAllCenters(userLat: number, userLng: number) {
    try {
      console.log('🗺️ ALL MAPS: Fetching all evacuation centers...');

      // Get all centers from API
      const allCenters = await firstValueFrom(
        this.http.get<EvacuationCenter[]>(`${environment.apiUrl}/evacuation-centers`)
      );

      console.log('🗺️ ALL MAPS: Total centers received:', allCenters?.length || 0);

      this.evacuationCenters = allCenters || [];

      // Count centers by disaster type
      this.centerCounts.earthquake = this.evacuationCenters.filter(c => c.disaster_type === 'Earthquake').length;
      this.centerCounts.typhoon = this.evacuationCenters.filter(c => c.disaster_type === 'Typhoon').length;
      this.centerCounts.flood = this.evacuationCenters.filter(c => c.disaster_type === 'Flash Flood').length;
      this.centerCounts.total = this.evacuationCenters.length;

      console.log('🗺️ ALL MAPS: Center counts:', this.centerCounts);

      if (this.evacuationCenters.length === 0) {
        const alert = await this.alertCtrl.create({
          header: 'No Evacuation Centers',
          message: 'No evacuation centers found in the database.',
          buttons: ['OK']
        });
        await alert.present();
        return;
      }

      // Add all markers with appropriate colors
      this.evacuationCenters.forEach(center => {
        const lat = Number(center.latitude);
        const lng = Number(center.longitude);

        if (!isNaN(lat) && !isNaN(lng)) {
          // Get icon based on disaster type
          let iconUrl = 'assets/Location.png';
          let colorEmoji = '⚪';

          switch(center.disaster_type) {
            case 'Earthquake':
              iconUrl = 'assets/forEarthquake.png';
              colorEmoji = '🟠';
              break;
            case 'Typhoon':
              iconUrl = 'assets/forTyphoon.png';
              colorEmoji = '🟢';
              break;
            case 'Flood':
              iconUrl = 'assets/forFlood.png';
              colorEmoji = '🔵';
              break;
          }

          const marker = L.marker([lat, lng], {
            icon: L.icon({
              iconUrl: iconUrl,
              iconSize: [40, 40],
              iconAnchor: [20, 40],
              popupAnchor: [0, -40]
            })
          });

          const distance = this.calculateDistance(userLat, userLng, lat, lng);

          // Make marker clickable to show navigation panel
          marker.on('click', () => {
            this.showNavigationPanel(center);
          });

          marker.bindPopup(`
            <div class="evacuation-popup">
              <h3>${colorEmoji} ${center.name}</h3>
              <p><strong>Type:</strong> ${center.disaster_type || 'General'}</p>
              <p><strong>Distance:</strong> ${(distance / 1000).toFixed(2)} km</p>
              <p><strong>Capacity:</strong> ${center.capacity || 'N/A'}</p>
              <p><em>Click marker for route options</em></p>
            </div>
          `);

          marker.addTo(this.map);
          console.log(`🗺️ Added ${center.disaster_type} marker: ${center.name}`);
        }
      });

      // No auto-routing for "See Whole Map" - only show markers

      // Fit map to show all centers
      if (this.evacuationCenters.length > 0) {
        const bounds = L.latLngBounds([]);
        bounds.extend([userLat, userLng]);

        this.evacuationCenters.forEach(center => {
          bounds.extend([Number(center.latitude), Number(center.longitude)]);
        });

        this.map.fitBounds(bounds, { padding: [50, 50] });
      }

    } catch (error) {
      console.error('🗺️ ALL MAPS: Error loading centers', error);

      const toast = await this.toastCtrl.create({
        message: 'Error loading evacuation centers. Please check your connection.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

  // Auto-route to 2 nearest evacuation centers
  async routeToTwoNearestCenters() {
    if (!this.userLocation || this.evacuationCenters.length === 0) {
      console.log('🗺️ ALL MAPS: No user location or evacuation centers available');
      return;
    }

    try {
      console.log('🗺️ ALL MAPS: Finding 2 nearest centers...');

      // Find 2 nearest centers
      const nearestCenters = this.getTwoNearestCenters(
        this.userLocation.lat,
        this.userLocation.lng
      );

      if (nearestCenters.length === 0) {
        const toast = await this.toastCtrl.create({
          message: 'No evacuation centers found nearby',
          duration: 3000,
          color: 'warning'
        });
        await toast.present();
        return;
      }

      // Clear previous routes and markers
      this.clearRoutes();

      // Add pulsing markers for nearest centers
      this.addPulsingMarkers(nearestCenters);

      // Calculate and display routes
      await this.calculateRoutes(nearestCenters);

      // Show success message
      const toast = await this.toastCtrl.create({
        message: `🗺️ Showing routes to ${nearestCenters.length} nearest centers via ${this.travelMode}`,
        duration: 3000,
        color: 'success',
        position: 'top'
      });
      await toast.present();

    } catch (error) {
      console.error('🗺️ ALL MAPS: Error calculating routes', error);

      const toast = await this.toastCtrl.create({
        message: 'Error calculating routes. Please try again.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  // Get 2 nearest evacuation centers
  getTwoNearestCenters(userLat: number, userLng: number): EvacuationCenter[] {
    const centersWithDistance = this.evacuationCenters.map(center => ({
      ...center,
      distance: this.calculateDistance(
        userLat, userLng,
        Number(center.latitude), Number(center.longitude)
      )
    }));

    // Sort by distance and take first 2
    return centersWithDistance
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2);
  }

  // Add pulsing markers for nearest centers
  addPulsingMarkers(centers: EvacuationCenter[]) {
    centers.forEach((center, index) => {
      const lat = Number(center.latitude);
      const lng = Number(center.longitude);

      if (!isNaN(lat) && !isNaN(lng)) {
        // Get disaster-specific icon and color
        let iconUrl = 'assets/Location.png';
        let pulseColor = '#3880ff';

        if (center.disaster_type === 'Earthquake') {
          iconUrl = 'assets/forEarthquake.png';
          pulseColor = '#ff9500';
        } else if (center.disaster_type === 'Typhoon') {
          iconUrl = 'assets/forTyphoon.png';
          pulseColor = '#2dd36f';
        } else if (center.disaster_type === 'Flood') {
          iconUrl = 'assets/forFlood.png';
          pulseColor = '#3dc2ff';
        }

        // Create pulsing marker
        const pulsingIcon = L.divIcon({
          className: 'pulsing-marker',
          html: `
            <div class="pulse-container">
              <div class="pulse" style="background-color: ${pulseColor}"></div>
              <img src="${iconUrl}" class="marker-icon" />
              <div class="marker-label">${index + 1}</div>
            </div>
          `,
          iconSize: [50, 50],
          iconAnchor: [25, 50]
        });

        const marker = L.marker([lat, lng], { icon: pulsingIcon });

        marker.bindPopup(`
          <div class="evacuation-popup nearest-popup">
            <h3>🎯 Nearest Center #${index + 1}</h3>
            <h4>${center.name}</h4>
            <p><strong>Type:</strong> ${center.disaster_type}</p>
            <p><strong>Distance:</strong> ${((center as any).distance / 1000).toFixed(2)} km</p>
            <p><strong>Capacity:</strong> ${center.capacity || 'N/A'}</p>
          </div>
        `);

        marker.addTo(this.map);
        this.nearestMarkers.push(marker);
      }
    });
  }

  // Calculate routes to nearest centers
  async calculateRoutes(centers: EvacuationCenter[]) {
    if (!this.userLocation) return;

    this.routeLayer = L.layerGroup().addTo(this.map);

    for (let i = 0; i < centers.length; i++) {
      const center = centers[i];
      const lat = Number(center.latitude);
      const lng = Number(center.longitude);

      if (!isNaN(lat) && !isNaN(lng)) {
        try {
          // Convert travel mode to OpenStreetMap profile
          const osmProfile = this.osmRouting.convertTravelModeToProfile(this.travelMode);

          const routeData = await this.osmRouting.getDirections(
            this.userLocation.lng, this.userLocation.lat,
            lng, lat,
            osmProfile,
            {
              geometries: 'geojson',
              overview: 'simplified',
              steps: false
            }
          );

          if (routeData && routeData.routes && routeData.routes.length > 0) {
            const route = routeData.routes[0];

            // Get color based on disaster type
            let routeColor = '#3880ff';
            if (center.disaster_type === 'Earthquake') routeColor = '#ff9500';
            else if (center.disaster_type === 'Typhoon') routeColor = '#2dd36f';
            else if (center.disaster_type === 'Flash Flood') routeColor = '#3dc2ff';

            // Draw route
            const routeLine = L.polyline(
              route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]),
              {
                color: routeColor,
                weight: 4,
                opacity: 0.8,
                dashArray: i === 0 ? undefined : '10, 10' // Solid for first, dashed for second
              }
            );

            routeLine.addTo(this.routeLayer);

            // Store route info for first center
            if (i === 0) {
              this.routeTime = route.duration;
              this.routeDistance = route.distance;
            }

            console.log(`🗺️ Route ${i + 1}: ${(route.distance/1000).toFixed(2)}km, ${(route.duration/60).toFixed(0)}min`);
          }
        } catch (error) {
          console.error(`🗺️ Error calculating route to center ${i + 1}:`, error);
        }
      }
    }
  }

  // Clear previous routes and markers
  clearRoutes() {
    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }

    this.nearestMarkers.forEach(marker => {
      this.map.removeLayer(marker);
    });
    this.nearestMarkers = [];

    this.routeTime = 0;
    this.routeDistance = 0;
  }

  // Handle travel mode change from ion-segment
  onTravelModeChange(event: any) {
    const value = event.detail.value;
    if (value === 'walking' || value === 'cycling' || value === 'driving') {
      this.changeTravelMode(value);
    }
  }

  // Change travel mode
  async changeTravelMode(mode: 'walking' | 'cycling' | 'driving') {
    this.travelMode = mode;

    const toast = await this.toastCtrl.create({
      message: `🚶‍♂️ Travel mode changed to ${mode}`,
      duration: 2000,
      color: 'primary'
    });
    await toast.present();

    // Recalculate routes with new travel mode
    if (this.userLocation && this.evacuationCenters.length > 0) {
      await this.routeToTwoNearestCenters();
    }
  }

  // Show navigation panel when marker is clicked
  async showNavigationPanel(center: EvacuationCenter) {
    this.selectedCenter = center;
    this.selectedTransportMode = null;
    this.routeInfo = {};

    // Calculate routes for all transport modes
    await this.calculateAllRoutes(center);
  }

  // Close navigation panel
  closeNavigationPanel() {
    this.selectedCenter = null;
    this.selectedTransportMode = null;
    this.routeInfo = {};
  }

  // Select transport mode and show route
  async selectTransportMode(mode: 'walking' | 'cycling' | 'driving') {
    this.selectedTransportMode = mode;

    if (this.selectedCenter && this.routeInfo[mode]) {
      // Show route on map
      await this.routeToCenter(this.selectedCenter, mode);
    }
  }

  // Calculate routes for all transport modes
  async calculateAllRoutes(center: EvacuationCenter) {
    if (!this.userLocation) return;

    const lat = Number(center.latitude);
    const lng = Number(center.longitude);

    if (isNaN(lat) || isNaN(lng)) return;

    const modes: ('walking' | 'cycling' | 'driving')[] = ['walking', 'cycling', 'driving'];

    for (const mode of modes) {
      try {
        const osmProfile = this.osmRouting.convertTravelModeToProfile(mode);

        const routeData = await this.osmRouting.getDirections(
          this.userLocation.lng, this.userLocation.lat,
          lng, lat,
          osmProfile,
          {
            geometries: 'geojson',
            overview: 'simplified',
            steps: false
          }
        );

        if (routeData && routeData.routes && routeData.routes.length > 0) {
          const route = routeData.routes[0];
          this.routeInfo[mode] = {
            duration: route.duration,
            distance: route.distance
          };
        }
      } catch (error) {
        console.error(`Error calculating ${mode} route:`, error);
      }
    }
  }

  // Format time for display
  formatTime(seconds?: number): string {
    if (!seconds) return '--';
    const minutes = Math.round(seconds / 60);
    return `${minutes} min`;
  }

  // Format distance for display
  formatDistance(meters?: number): string {
    if (!meters) return '--';
    const km = meters / 1000;
    return km < 1 ? `${Math.round(meters)} m` : `${km.toFixed(1)} km`;
  }

  // Start navigation
  async startNavigation() {
    if (!this.selectedCenter || !this.selectedTransportMode) return;

    // Route to the selected center with selected mode
    await this.routeToCenter(this.selectedCenter, this.selectedTransportMode);

    // Close the navigation panel
    this.closeNavigationPanel();

    // Show success message
    const toast = await this.toastCtrl.create({
      message: `🧭 Navigation started to ${this.selectedCenter.name}`,
      duration: 3000,
      color: 'success',
      position: 'top'
    });
    await toast.present();
  }

  // Route to specific center with chosen transportation mode
  async routeToCenter(center: EvacuationCenter, travelMode: 'walking' | 'cycling' | 'driving') {
    if (!this.userLocation) return;

    try {
      // Clear existing routes
      this.clearRoutes();

      const lat = Number(center.latitude);
      const lng = Number(center.longitude);

      if (!isNaN(lat) && !isNaN(lng)) {
        const osmProfile = this.osmRouting.convertTravelModeToProfile(travelMode);

        const routeData = await this.osmRouting.getDirections(
          this.userLocation.lng, this.userLocation.lat,
          lng, lat,
          osmProfile,
          {
            geometries: 'geojson',
            overview: 'full',
            steps: false
          }
        );

        if (routeData && routeData.routes && routeData.routes.length > 0) {
          const route = routeData.routes[0];

          // Use disaster-specific color
          let routeColor = '#3880ff'; // Default blue
          let colorEmoji = '🔵';

          if (center.disaster_type === 'Earthquake') {
            routeColor = '#ff9500'; // Orange
            colorEmoji = '🟠';
          } else if (center.disaster_type === 'Typhoon') {
            routeColor = '#2dd36f'; // Green
            colorEmoji = '🟢';
          } else if (center.disaster_type === 'Flash Flood') {
            routeColor = '#3dc2ff'; // Blue
            colorEmoji = '🔵';
          }

          this.routeLayer = L.layerGroup().addTo(this.map);

          // Draw route
          const routeLine = L.polyline(
            route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]),
            {
              color: routeColor,
              weight: 5,
              opacity: 0.8
            }
          );

          routeLine.addTo(this.routeLayer);

          // Show route info
          const toast = await this.toastCtrl.create({
            message: `${colorEmoji} Route: ${(route.distance/1000).toFixed(2)}km, ${(route.duration/60).toFixed(0)}min via ${travelMode}`,
            duration: 4000,
            color: 'primary'
          });
          await toast.present();

          // Fit map to route
          this.map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
        }
      }
    } catch (error) {
      console.error('🗺️ Error routing to center:', error);

      const toast = await this.toastCtrl.create({
        message: 'Error calculating route. Please try again.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  goBack() {
    this.router.navigate(['/tabs/home']);
  }

  // Enhanced download map functionality with routes
  async downloadMap() {
    if (!this.map) {
      const toast = await this.toastCtrl.create({
        message: 'Map not loaded yet. Please wait and try again.',
        duration: 3000,
        color: 'warning'
      });
      await toast.present();
      return;
    }

    try {
      await this.enhancedDownload.downloadMapWithRoutes(
        'all-maps',
        this.map,
        'All-Evacuation-Centers',
        true // Include routes
      );
    } catch (error) {
      console.error('Enhanced download error:', error);

      const toast = await this.toastCtrl.create({
        message: 'Failed to download map. Please try again.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
  }



  ionViewWillLeave() {
    this.clearRoutes();
    if (this.map) {
      this.map.remove();
    }
  }
}
