import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, LoadingController, ToastController, AlertController } from '@ionic/angular';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Geolocation } from '@capacitor/geolocation';
import * as L from 'leaflet';

import { EnhancedDownloadService } from '../../services/enhanced-download.service';
import { OpenStreetMapRoutingService, Route } from '../../services/openstreetmap-routing.service';
import { RealTimeNavigationComponent } from '../../components/real-time-navigation/real-time-navigation.component';
import { EvacuationCenter } from '../../interfaces/evacuation-center.interface';

@Component({
  selector: 'app-typhoon-map',
  templateUrl: './typhoon-map.page.html',
  styleUrls: ['./typhoon-map.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RealTimeNavigationComponent]
})
export class TyphoonMapPage implements OnInit, AfterViewInit {
  private map!: L.Map;
  private userMarker: L.Marker<any> | null = null;
  public evacuationCenters: EvacuationCenter[] = [];
  public userLocation: { lat: number; lng: number } | null = null;

  // Properties for highlighting new centers
  public newCenterId: string | null = null;
  public highlightCenter: boolean = false;
  public centerLat: number | null = null;
  public centerLng: number | null = null;

  // Navigation panel properties
  public selectedCenter: EvacuationCenter | null = null;
  public selectedTransportMode: 'walking' | 'cycling' | 'driving' | null = null;
  public routeInfo: {
    walking?: { duration: number; distance: number };
    cycling?: { duration: number; distance: number };
    driving?: { duration: number; distance: number };
  } = {};

  // Real-time navigation properties
  public isRealTimeNavigationActive = false;
  public navigationDestination: { lat: number; lng: number; name?: string } | null = null;
  public currentNavigationRoute: Route | null = null;

  private loadingCtrl = inject(LoadingController);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  private enhancedDownload = inject(EnhancedDownloadService);
  private osmRouting = inject(OpenStreetMapRoutingService);

  ngOnInit() {
    console.log('🟢 TYPHOON MAP: Component initialized...');
    // Don't initialize map here - wait for view to be ready

    // Check for query parameters to highlight new center
    this.route.queryParams.subscribe((params: any) => {
      if (params['newCenterId']) {
        this.newCenterId = params['newCenterId'];
        this.highlightCenter = params['highlightCenter'] === 'true';
        this.centerLat = params['centerLat'] ? parseFloat(params['centerLat']) : null;
        this.centerLng = params['centerLng'] ? parseFloat(params['centerLng']) : null;
        console.log('🟢 TYPHOON MAP: New center to highlight:', this.newCenterId);
      }
    });
  }

  async ngAfterViewInit() {
    console.log('🟢 TYPHOON MAP: View initialized, loading map...');
    // Small delay to ensure DOM is fully rendered
    setTimeout(async () => {
      await this.loadTyphoonMap();
    }, 100);
  }

  async loadTyphoonMap() {
    const loading = await this.loadingCtrl.create({
      message: 'Loading typhoon evacuation centers...',
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

      console.log(`🟢 TYPHOON MAP: User location [${userLat}, ${userLng}]`);

      // Store user location
      this.userLocation = { lat: userLat, lng: userLng };

      // Initialize map
      this.initializeMap(userLat, userLng);

      // Load ONLY typhoon centers
      await this.loadTyphoonCenters(userLat, userLng);

      await loading.dismiss();

      // Show success message
      const toast = await this.toastCtrl.create({
        message: `🟢 Showing ${this.evacuationCenters.length} typhoon evacuation centers`,
        duration: 3000,
        color: 'success',
        position: 'top'
      });
      await toast.present();

    } catch (error) {
      await loading.dismiss();
      console.error('🟢 TYPHOON MAP: Error loading map', error);

      const alert = await this.alertCtrl.create({
        header: 'Location Error',
        message: 'Unable to get your location. Please enable GPS and try again.',
        buttons: [
          {
            text: 'Retry',
            handler: () => this.loadTyphoonMap()
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
    console.log(`🟢 TYPHOON MAP: Initializing map at [${lat}, ${lng}]`);

    // Check if container exists
    const container = document.getElementById('typhoon-map');
    if (!container) {
      console.error('🟢 TYPHOON MAP: Container #typhoon-map not found!');
      throw new Error('Map container not found. Please ensure the view is properly loaded.');
    }

    if (this.map) {
      this.map.remove();
    }

    this.map = L.map('typhoon-map').setView([lat, lng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'OpenStreetMap contributors'
    }).addTo(this.map);

    // Add user marker
    this.userMarker = L.marker([lat, lng], {
      icon: L.icon({
        iconUrl: 'assets/Location.png',
        iconSize: [30, 30],
        iconAnchor: [15, 30]
      })
    }).addTo(this.map);

    this.userMarker.bindPopup('📍 You are here!').openPopup();
  }

  async loadTyphoonCenters(userLat: number, userLng: number) {
    try {
      console.log('🟢 TYPHOON MAP: Fetching typhoon centers...');

      let allCenters: EvacuationCenter[] = [];

      // Fetch data from API
      try {
        const apiResponse = await firstValueFrom(
          this.http.get<{success: boolean, data: EvacuationCenter[], count: number}>(`${environment.apiUrl}/evacuation-centers`)
        );
        allCenters = apiResponse.data || [];
        console.log('🟢 TYPHOON MAP: Total centers received from API:', allCenters?.length || 0);
      } catch (apiError) {
        console.error('❌ API failed:', apiError);
        const alert = await this.alertCtrl.create({
          header: 'Connection Error',
          message: 'Cannot connect to server. Please check your internet connection.',
          buttons: ['OK']
        });
        await alert.present();
        return;
      }

      // Filter for TYPHOON ONLY - handle both array and string formats
      this.evacuationCenters = allCenters.filter(center => {
        if (Array.isArray(center.disaster_type)) {
          // Check if the array contains exactly 'Typhoon' (case-sensitive)
          return center.disaster_type.some(type => type === 'Typhoon');
        }
        return center.disaster_type === 'Typhoon';
      });

      console.log(`🟢 TYPHOON MAP: Filtered to ${this.evacuationCenters.length} typhoon centers`);
      console.log('🟢 TYPHOON MAP: Filtered centers:', this.evacuationCenters.map(c => `${c.name} (${JSON.stringify(c.disaster_type)})`));

      console.log(`🟢 TYPHOON MAP: Filtered to ${this.evacuationCenters.length} typhoon centers`);

      if (this.evacuationCenters.length === 0) {
        const alert = await this.alertCtrl.create({
          header: 'No Typhoon Centers',
          message: 'No typhoon evacuation centers found in the database.',
          buttons: ['OK']
        });
        await alert.present();
        return;
      }

      // Add typhoon markers (green)
      this.evacuationCenters.forEach(center => {
        const lat = Number(center.latitude);
        const lng = Number(center.longitude);

        if (!isNaN(lat) && !isNaN(lng)) {
          const marker = L.marker([lat, lng], {
            icon: L.icon({
              iconUrl: 'assets/forTyphoon.png',
              iconSize: [40, 40],
              iconAnchor: [20, 40],
              popupAnchor: [0, -40]
            })
          });

          const distance = this.calculateDistance(userLat, userLng, lat, lng);

          // Make marker clickable with navigation panel
          marker.on('click', () => {
            this.openNavigationPanel(center);
          });

          // Check if this is the new center to highlight
          const isNewCenter = this.newCenterId && center.id.toString() === this.newCenterId;

          marker.bindPopup(`
            <div class="evacuation-popup">
              <h3>🟢 ${center.name} ${isNewCenter ? '⭐ NEW!' : ''}</h3>
              <p><strong>Type:</strong> Typhoon Center</p>
              <p><strong>Distance:</strong> ${(distance / 1000).toFixed(2)} km</p>
              <p><strong>Capacity:</strong> ${center.capacity || 'N/A'}</p>
              <p><em>Click marker for route options</em></p>
              ${isNewCenter ? '<p><strong>🆕 Recently Added!</strong></p>' : ''}
            </div>
          `);

          // If this is the new center, open its popup and center map on it
          if (isNewCenter) {
            marker.openPopup();
            this.map.setView([lat, lng], 15); // Zoom in on the new center

            // Show a toast notification
            this.toastCtrl.create({
              message: `🆕 New typhoon evacuation center: ${center.name}`,
              duration: 5000,
              color: 'success',
              position: 'top'
            }).then(toast => toast.present());
          }

          marker.addTo(this.map);
          console.log(`🟢 Added typhoon marker: ${center.name}`);
        }
      });

      // Auto-route to nearest centers
      console.log('🟢 Auto-routing to 2 nearest typhoon centers...');
      await this.routeToTwoNearestCenters();

      // Fit map to show all typhoon centers
      if (this.evacuationCenters.length > 0) {
        const bounds = L.latLngBounds([]);
        bounds.extend([userLat, userLng]);

        this.evacuationCenters.forEach(center => {
          bounds.extend([Number(center.latitude), Number(center.longitude)]);
        });

        this.map.fitBounds(bounds, { padding: [50, 50] });
      }

    } catch (error) {
      console.error('🟢 TYPHOON MAP: Error loading centers', error);

      const toast = await this.toastCtrl.create({
        message: 'Error loading typhoon centers. Please check your connection.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  // Auto-route to 2 nearest typhoon centers
  async routeToTwoNearestCenters() {
    if (!this.userLocation || this.evacuationCenters.length === 0) {
      console.log('🟢 TYPHOON MAP: No user location or evacuation centers available');
      return;
    }

    try {
      console.log('🟢 TYPHOON MAP: Finding 2 nearest typhoon centers...');

      // Find 2 nearest centers
      const nearestCenters = this.getTwoNearestCenters(
        this.userLocation.lat,
        this.userLocation.lng
      );

      if (nearestCenters.length === 0) {
        return;
      }

      // Clear previous routes
      this.clearRoutes();

      // Calculate and display routes with typhoon color (green)
      await this.calculateRoutes(nearestCenters);

    } catch (error) {
      console.error('🟢 TYPHOON MAP: Error calculating routes', error);
    }
  }

  getTwoNearestCenters(userLat: number, userLng: number) {
    // Sort by distance and get the 2 nearest
    const sorted = [...this.evacuationCenters].sort((a, b) => {
      const distA = this.calculateDistance(userLat, userLng, Number(a.latitude), Number(a.longitude));
      const distB = this.calculateDistance(userLat, userLng, Number(b.latitude), Number(b.longitude));
      return distA - distB;
    });

    return sorted.slice(0, 2);
  }

  clearRoutes() {
    this.map.eachLayer(layer => {
      if (layer instanceof L.GeoJSON) {
        this.map.removeLayer(layer);
      }
    });
  }

  async calculateRoutes(centers: EvacuationCenter[]) {
    if (!this.userLocation) return;

    // Clear previous routes
    this.clearRoutes();

    for (let i = 0; i < centers.length; i++) {
      const center = centers[i];
      const lat = Number(center.latitude);
      const lng = Number(center.longitude);

      if (!isNaN(lat) && !isNaN(lng)) {
        console.log(`🟢 TYPHOON MAP: Creating route to center ${i + 1}: ${center.name}`);

        // Create a simple straight-line route (always works)
        const routeColor = '#28a745'; // Green for typhoon

        const routeLine = L.polyline(
          [
            [this.userLocation.lat, this.userLocation.lng], // Start point
            [lat, lng] // End point
          ],
          {
            color: routeColor,
            weight: 4,
            opacity: 0.8,
            dashArray: i === 0 ? undefined : '10, 10' // Solid for first, dashed for second
          }
        );

        routeLine.addTo(this.map);

        // Calculate distance for display
        const distance = this.calculateDistance(this.userLocation.lat, this.userLocation.lng, lat, lng);
        console.log(`✅ TYPHOON MAP: Added route to ${center.name} (${(distance/1000).toFixed(2)}km)`);
      }
    }

    // Show success message
    const toast = await this.toastCtrl.create({
      message: `🟢 Routes calculated to ${centers.length} nearest typhoon centers`,
      duration: 3000,
      color: 'success',
      position: 'top'
    });
    await toast.present();
  }

  async calculateRoute(center: EvacuationCenter, travelMode: string) {
    try {
      if (!this.userLocation) {
        console.error('🟢 TYPHOON MAP: No user location available for routing');
        return;
      }

      const osmProfile = this.osmRouting.convertTravelModeToProfile(travelMode);
      const response = await this.osmRouting.getDirections(
        this.userLocation.lng, this.userLocation.lat,
        Number(center.longitude), Number(center.latitude),
        osmProfile
      );

      if (response.routes && response.routes.length > 0) {
        const route = response.routes[0];
        const routeGeoJSON = this.osmRouting.convertToGeoJSON(route);

        // Add route to map with typhoon color (green)
        L.geoJSON(routeGeoJSON as any, {
          style: {
            color: '#008000', // Green for typhoon
            weight: 4,
            opacity: 0.8
          }
        }).addTo(this.map);

        console.log(`🟢 TYPHOON MAP: Route added to ${center.name}`);
      }
    } catch (error) {
      console.error('🟢 TYPHOON MAP: Error calculating route:', error);
    }
  }



  // Open evacuation center in external maps app
  async openInExternalMaps(center: EvacuationCenter, travelMode?: 'walking' | 'cycling' | 'driving') {
    const lat = Number(center.latitude);
    const lng = Number(center.longitude);

    // Map travel modes to Google Maps format
    let googleTravelMode = 'walking';
    if (travelMode === 'driving') googleTravelMode = 'driving';
    else if (travelMode === 'cycling') googleTravelMode = 'bicycling';

    // Create maps URL that works on both Android and iOS
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${googleTravelMode}`;

    try {
      window.open(mapsUrl, '_system');
    } catch (error) {
      console.error('Error opening external maps:', error);
      const toast = await this.toastCtrl.create({
        message: 'Could not open external maps app',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  // Open navigation panel when marker is clicked
  async openNavigationPanel(center: EvacuationCenter) {
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
  selectTransportMode(mode: 'walking' | 'cycling' | 'driving') {
    this.selectedTransportMode = mode;
    if (this.selectedCenter) {
      this.showRouteOnMap(this.selectedCenter, mode);
    }
  }

  // Calculate routes for all transport modes
  async calculateAllRoutes(center: EvacuationCenter) {
    if (!this.userLocation) return;

    const modes: ('walking' | 'cycling' | 'driving')[] = ['walking', 'cycling', 'driving'];

    for (const mode of modes) {
      try {
        const osmProfile = this.osmRouting.convertTravelModeToProfile(mode);
        const response = await this.osmRouting.getDirections(
          this.userLocation.lng, this.userLocation.lat,
          Number(center.longitude), Number(center.latitude),
          osmProfile
        );

        if (response.routes && response.routes.length > 0) {
          const route = response.routes[0];
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

  // Show selected route on map
  async showRouteOnMap(center: EvacuationCenter, mode: 'walking' | 'cycling' | 'driving') {
    if (!this.userLocation) return;

    // Clear previous routes
    this.clearRoutes();

    try {
      const osmProfile = this.osmRouting.convertTravelModeToProfile(mode);
      const response = await this.osmRouting.getDirections(
        this.userLocation.lng, this.userLocation.lat,
        Number(center.longitude), Number(center.latitude),
        osmProfile
      );

      if (response.routes && response.routes.length > 0) {
        const route = response.routes[0];
        const routeGeoJSON = this.osmRouting.convertToGeoJSON(route);

        // Add route to map with typhoon color (green)
        L.geoJSON(routeGeoJSON as any, {
          style: {
            color: '#008000', // Green for typhoon
            weight: 4,
            opacity: 0.8
          }
        }).addTo(this.map);
      }
    } catch (error) {
      console.error('Error showing route on map:', error);
    }
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

  // Format time helper
  formatTime(seconds: number | undefined): string {
    if (!seconds) return '';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
  }

  // Format distance helper
  formatDistance(meters: number | undefined): string {
    if (!meters) return '';
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    } else {
      return `${(meters / 1000).toFixed(1)}km`;
    }
  }

  // Route to specific center with chosen transportation mode
  async routeToCenter(center: EvacuationCenter, travelMode: 'walking' | 'cycling' | 'driving') {
    if (!this.userLocation) return;

    try {
      // Clear existing routes
      this.clearRoutes();

      const osmProfile = this.osmRouting.convertTravelModeToProfile(travelMode);
      const routeData = await this.osmRouting.getDirections(
        this.userLocation.lng, this.userLocation.lat,
        Number(center.longitude), Number(center.latitude),
        osmProfile
      );

      if (routeData && routeData.routes && routeData.routes.length > 0) {
        const route = routeData.routes[0];

        // Use typhoon color (green)
        const routeColor = '#008000';

        // Draw route
        const routeLine = L.polyline(
          route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]),
          {
            color: routeColor,
            weight: 5,
            opacity: 0.8
          }
        );

        routeLine.addTo(this.map);

        // Show route info
        const toast = await this.toastCtrl.create({
          message: `🟢 Route: ${(route.distance/1000).toFixed(2)}km, ${(route.duration/60).toFixed(0)}min via ${travelMode}`,
          duration: 4000,
          color: 'success'
        });
        await toast.present();

        // Fit map to route
        this.map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
      }
    } catch (error) {
      console.error('🟢 TYPHOON MAP: Error calculating individual route:', error);

      const toast = await this.toastCtrl.create({
        message: 'Error calculating route. Please try again.',
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
        'typhoon-map',
        this.map,
        'Typhoon',
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
    // Stop real-time navigation if active
    if (this.isRealTimeNavigationActive) {
      this.osmRouting.stopRealTimeRouting();
    }
    if (this.map) {
      this.map.remove();
    }
  }

  // Real-time navigation methods
  startRealTimeNavigation(center: EvacuationCenter) {
    console.log('🧭 Starting real-time navigation to typhoon center:', center.name);

    this.navigationDestination = {
      lat: Number(center.latitude),
      lng: Number(center.longitude),
      name: center.name
    };

    this.isRealTimeNavigationActive = true;

    // Show success toast
    this.toastCtrl.create({
      message: `🧭 Real-time navigation started to ${center.name}`,
      duration: 3000,
      color: 'primary'
    }).then(toast => toast.present());
  }

  onNavigationRouteUpdated(route: Route) {
    console.log('🔄 Typhoon map navigation route updated');
    this.currentNavigationRoute = route;

    // Update the map with the new route
    this.updateMapWithNavigationRoute(route);
  }

  onNavigationStopped() {
    console.log('⏹️ Typhoon map real-time navigation stopped');
    this.isRealTimeNavigationActive = false;
    this.navigationDestination = null;
    this.currentNavigationRoute = null;

    // Clear navigation route from map
    this.clearNavigationRoute();

    // Show toast
    this.toastCtrl.create({
      message: '⏹️ Navigation stopped',
      duration: 2000,
      color: 'medium'
    }).then(toast => toast.present());
  }

  private updateMapWithNavigationRoute(route: Route) {
    // Clear existing navigation route
    this.clearNavigationRoute();

    // Add new navigation route to map with typhoon color
    if (route.geometry && route.geometry.coordinates) {
      const routeGeoJSON = this.osmRouting.convertToGeoJSON(route);

      const navigationRoute = L.geoJSON(routeGeoJSON, {
        style: {
          color: '#007bff', // Typhoon blue color
          weight: 6,
          opacity: 0.8,
          dashArray: '10, 5'
        }
      }).addTo(this.map);

      // Store reference for cleanup
      (navigationRoute as any).isNavigationRoute = true;
    }
  }

  private clearNavigationRoute() {
    // Remove existing navigation routes
    this.map.eachLayer((layer: any) => {
      if (layer.isNavigationRoute) {
        this.map.removeLayer(layer);
      }
    });
  }
}
