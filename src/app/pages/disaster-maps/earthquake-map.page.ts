import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, LoadingController, ToastController, AlertController } from '@ionic/angular';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Geolocation } from '@capacitor/geolocation';
import { OpenStreetMapRoutingService } from '../../services/openstreetmap-routing.service';

import { EnhancedDownloadService } from '../../services/enhanced-download.service';
import { EvacuationCenter } from '../../interfaces/evacuation-center.interface';

import * as L from 'leaflet';

@Component({
  selector: 'app-earthquake-map',
  templateUrl: './earthquake-map.page.html',
  styleUrls: ['./earthquake-map.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class EarthquakeMapPage implements OnInit, AfterViewInit {
  private map!: L.Map;
  private userMarker: L.Marker<any> | null = null;
  private routeLayer: L.LayerGroup | null = null;
  private nearestMarkers: L.Marker[] = [];

  public evacuationCenters: EvacuationCenter[] = [];
  public userLocation: { lat: number, lng: number } | null = null;

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

  // Emergency navigation flag
  private shouldAutoRouteEmergency = false;

  private loadingCtrl = inject(LoadingController);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private osmRouting = inject(OpenStreetMapRoutingService);

  private enhancedDownload = inject(EnhancedDownloadService);

  ngOnInit() {
    // Check for query parameters to highlight new center or emergency navigation
    this.route.queryParams.subscribe((params: any) => {
      if (params['newCenterId']) {
        this.newCenterId = params['newCenterId'];
        this.highlightCenter = params['highlightCenter'] === 'true';
        this.centerLat = params['centerLat'] ? parseFloat(params['centerLat']) : null;
        this.centerLng = params['centerLng'] ? parseFloat(params['centerLng']) : null;
      }

      // Handle emergency navigation
      if (params['emergency'] === 'true' && params['autoRoute'] === 'true') {
        console.log('🚨 Emergency navigation triggered for earthquake map');
        // Set flag to auto-route to nearest centers after map loads
        this.shouldAutoRouteEmergency = true;
      }
    });
  }

  async ngAfterViewInit() {
    // Small delay to ensure DOM is fully rendered
    setTimeout(async () => {
      await this.loadEarthquakeMap();
    }, 100);
  }

  async loadEarthquakeMap() {
    const loading = await this.loadingCtrl.create({
      message: 'Loading earthquake evacuation centers...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      console.log('🟠 EARTHQUAKE MAP: Starting to load map...');

      // Add timeout for the entire loading process
      const loadingTimeout = setTimeout(async () => {
        await loading.dismiss();
        console.error('🟠 EARTHQUAKE MAP: Loading timeout after 30 seconds');

        const alert = await this.alertCtrl.create({
          header: 'Loading Timeout',
          message: 'The map is taking too long to load. This might be due to network issues or GPS problems.',
          buttons: [
            {
              text: 'Try Offline Mode',
              handler: () => this.loadOfflineMode()
            },
            {
              text: 'Retry',
              handler: () => this.loadEarthquakeMap()
            },
            {
              text: 'Go Back',
              handler: () => this.router.navigate(['/tabs/home'])
            }
          ]
        });
        await alert.present();
      }, 30000); // 30 second timeout

      // Get user location with shorter timeout
      console.log('🟠 EARTHQUAKE MAP: Getting user location...');
      const position = await Promise.race([
        Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('GPS timeout')), 15000)
        )
      ]);

      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;
      console.log(`🟠 EARTHQUAKE MAP: Got location [${userLat}, ${userLng}]`);

      this.userLocation = { lat: userLat, lng: userLng };

      // Initialize map
      console.log('🟠 EARTHQUAKE MAP: Initializing map...');
      this.initializeMap(userLat, userLng);

      // Load ONLY earthquake centers and auto-route
      console.log('🟠 EARTHQUAKE MAP: Loading evacuation centers...');
      await this.loadEarthquakeCenters(userLat, userLng);

      // Clear timeout if we got here successfully
      clearTimeout(loadingTimeout);
      await loading.dismiss();

      // Show success message
      const toast = await this.toastCtrl.create({
        message: `🟠 Showing ${this.evacuationCenters.length} earthquake evacuation centers`,
        duration: 3000,
        color: 'warning',
        position: 'top'
      });
      await toast.present();

    } catch (error) {
      await loading.dismiss();
      console.error('🟠 EARTHQUAKE MAP: Error loading map', error);

      let errorMessage = 'Unable to load earthquake map.';
      let buttons: any[] = [];

      if (error instanceof Error) {
        if (error.message.includes('GPS') || error.message.includes('location') || error.message.includes('timeout')) {
          errorMessage = 'Unable to get your location. Please enable GPS and try again.';
          buttons = [
            {
              text: 'Use Default Location',
              handler: () => this.loadWithDefaultLocation()
            },
            {
              text: 'Retry',
              handler: () => this.loadEarthquakeMap()
            },
            {
              text: 'Go Back',
              handler: () => this.router.navigate(['/tabs/home'])
            }
          ];
        } else {
          errorMessage = 'Network connection issue. Try offline mode or check your connection.';
          buttons = [
            {
              text: 'Try Offline',
              handler: () => this.loadOfflineMode()
            },
            {
              text: 'Retry',
              handler: () => this.loadEarthquakeMap()
            },
            {
              text: 'Go Back',
              handler: () => this.router.navigate(['/tabs/home'])
            }
          ];
        }
      } else {
        buttons = [
          {
            text: 'Retry',
            handler: () => this.loadEarthquakeMap()
          },
          {
            text: 'Go Back',
            handler: () => this.router.navigate(['/tabs/home'])
          }
        ];
      }

      const alert = await this.alertCtrl.create({
        header: 'Loading Error',
        message: errorMessage,
        buttons: buttons
      });
      await alert.present();
    }
  }

  initializeMap(lat: number, lng: number) {
    // Check if container exists
    const container = document.getElementById('earthquake-map');
    if (!container) {
      console.error('🟠 EARTHQUAKE MAP: Container #earthquake-map not found!');
      throw new Error('Map container not found. Please ensure the view is properly loaded.');
    }

    if (this.map) {
      this.map.remove();
    }

    this.map = L.map('earthquake-map').setView([lat, lng], 13);

    // Add tile layer
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

  /**
   * Load with default Cebu City location when GPS fails
   */
  async loadWithDefaultLocation() {
    console.log('🟠 EARTHQUAKE MAP: Using default Cebu City location');
    const defaultLat = 10.3157;
    const defaultLng = 123.8854;

    this.userLocation = { lat: defaultLat, lng: defaultLng };
    this.initializeMap(defaultLat, defaultLng);
    await this.loadEarthquakeCenters(defaultLat, defaultLng);

    const toast = await this.toastCtrl.create({
      message: '📍 Using default location (Cebu City). Enable GPS for accurate location.',
      duration: 4000,
      color: 'warning'
    });
    await toast.present();
  }

  /**
   * Load in offline mode using cached data
   */
  async loadOfflineMode() {
    console.log('🟠 EARTHQUAKE MAP: Loading in offline mode');

    const loading = await this.loadingCtrl.create({
      message: 'Loading offline earthquake data...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      // Use default location for offline mode
      const defaultLat = 10.3157;
      const defaultLng = 123.8854;

      this.userLocation = { lat: defaultLat, lng: defaultLng };
      this.initializeMap(defaultLat, defaultLng);

      // Load earthquake centers from API
      await this.loadEarthquakeCenters(defaultLat, defaultLng);
      await loading.dismiss();
    } catch (error) {
      await loading.dismiss();
      console.error('🟠 EARTHQUAKE MAP: Offline mode failed', error);

      const toast = await this.toastCtrl.create({
        message: 'Failed to load offline data. Please try again.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  async loadEarthquakeCenters(userLat: number, userLng: number) {
    try {
      let allCenters: EvacuationCenter[] = [];

      // Fetch data from API
      try {
        console.log('🟠 EARTHQUAKE MAP: Fetching from API...');

        // Add timeout to API call
        allCenters = await Promise.race([
          firstValueFrom(
            this.http.get<EvacuationCenter[]>(`${environment.apiUrl}/evacuation-centers`)
          ),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('API timeout')), 15000)
          )
        ]);

        console.log(`🟠 EARTHQUAKE MAP: API returned ${allCenters?.length || 0} centers`);
      } catch (apiError) {
        console.error('❌ API failed:', apiError);
        const alert = await this.alertCtrl.create({
          header: 'Connection Error',
          message: 'Cannot connect to server. Please check your internet connection.',
          buttons: [
            {
              text: 'OK',
              handler: () => this.router.navigate(['/tabs/home'])
            }
          ]
        });
        await alert.present();
        return;
      }

      // Filter for EARTHQUAKE ONLY - handle both array and string formats
      this.evacuationCenters = allCenters.filter(center => {
        if (Array.isArray(center.disaster_type)) {
          return center.disaster_type.includes('Earthquake');
        }
        return center.disaster_type === 'Earthquake';
      });

      if (this.evacuationCenters.length === 0) {
        const alert = await this.alertCtrl.create({
          header: 'No Earthquake Centers',
          message: 'No earthquake evacuation centers found in the data.',
          buttons: ['OK']
        });
        await alert.present();
        return;
      }

      // Add markers and routes
      await this.addMarkersAndRoutes(userLat, userLng);

    } catch (error) {
      console.error('🟠 EARTHQUAKE MAP: Error loading centers', error);

      const toast = await this.toastCtrl.create({
        message: 'Error loading earthquake centers. Please check your internet connection.',
        duration: 4000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  // Add markers and routes to map
  async addMarkersAndRoutes(userLat: number, userLng: number) {
    // Add earthquake markers (orange)
    this.evacuationCenters.forEach(center => {
      const lat = Number(center.latitude);
      const lng = Number(center.longitude);

      if (!isNaN(lat) && !isNaN(lng)) {
        const marker = L.marker([lat, lng], {
          icon: L.icon({
            iconUrl: 'assets/forEarthquake.png',
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, -40]
          })
        });

        const distance = this.calculateDistance(userLat, userLng, lat, lng);

        // Make marker clickable with navigation panel
        marker.on('click', () => {
          this.showNavigationPanel(center);
        });

        // Check if this is the new center to highlight
        const isNewCenter = this.newCenterId && center.id.toString() === this.newCenterId;

        marker.bindPopup(`
          <div class="evacuation-popup">
            <h3>🟠 ${center.name} ${isNewCenter ? '⭐ NEW!' : ''}</h3>
            <p><strong>Type:</strong> Earthquake Center</p>
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
            message: `🆕 New earthquake evacuation center: ${center.name}`,
            duration: 5000,
            color: 'warning',
            position: 'top'
          }).then(toast => toast.present());
        }

        marker.addTo(this.map);
      }
    });

    // Auto-route to nearest centers
    await this.routeToTwoNearestCenters();

    // Handle emergency auto-routing
    if (this.shouldAutoRouteEmergency) {
      console.log('🚨 Performing emergency auto-routing to nearest earthquake evacuation centers');
      await this.performEmergencyRouting();
      this.shouldAutoRouteEmergency = false; // Reset flag
    }

    // Fit map to show all earthquake centers
    if (this.evacuationCenters.length > 0) {
      const bounds = L.latLngBounds([]);
      bounds.extend([userLat, userLng]);

      this.evacuationCenters.forEach(center => {
        bounds.extend([Number(center.latitude), Number(center.longitude)]);
      });

      this.map.fitBounds(bounds, { padding: [50, 50] });
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

  // Emergency auto-routing with enhanced notifications
  async performEmergencyRouting() {
    if (!this.userLocation || this.evacuationCenters.length === 0) {
      console.warn('Cannot perform emergency routing: missing user location or evacuation centers');
      return;
    }

    try {
      console.log('🚨 Starting emergency routing to nearest earthquake evacuation centers');

      // Show emergency routing toast
      const emergencyToast = await this.toastCtrl.create({
        message: '🚨 EMERGENCY: Routing to nearest earthquake evacuation centers',
        duration: 5000,
        color: 'danger',
        position: 'top',
        cssClass: 'emergency-toast'
      });
      await emergencyToast.present();

      // Perform the same routing as normal but with emergency styling
      await this.routeToTwoNearestCenters();

      // Show completion message
      const completionToast = await this.toastCtrl.create({
        message: '✅ Emergency routes calculated. Follow the highlighted paths to safety.',
        duration: 7000,
        color: 'success',
        position: 'bottom'
      });
      await completionToast.present();

    } catch (error) {
      console.error('Error in emergency routing:', error);

      const errorToast = await this.toastCtrl.create({
        message: '⚠️ Emergency routing failed. Please manually navigate to nearest evacuation center.',
        duration: 5000,
        color: 'warning',
        position: 'top'
      });
      await errorToast.present();
    }
  }

  // Auto-route to 2 nearest earthquake centers
  async routeToTwoNearestCenters() {
    if (!this.userLocation || this.evacuationCenters.length === 0) {
      return;
    }

    try {

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

      // Calculate and display routes with earthquake color (orange)
      await this.calculateRoutes(nearestCenters);

    } catch (error) {
      console.error('🟠 EARTHQUAKE MAP: Error calculating routes', error);
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

  // Calculate routes to nearest centers with earthquake color
  async calculateRoutes(centers: EvacuationCenter[]) {
    if (!this.userLocation) return;

    this.routeLayer = L.layerGroup().addTo(this.map);

    for (let i = 0; i < centers.length; i++) {
      const center = centers[i];
      const lat = Number(center.latitude);
      const lng = Number(center.longitude);

      if (!isNaN(lat) && !isNaN(lng)) {
        try {
          const osmProfile = this.osmRouting.convertTravelModeToProfile('walking');

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

            // Use earthquake color (orange)
            const routeColor = '#ff9500';

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
          }
        } catch (error) {
          console.error(`🟠 Error calculating route to center ${i + 1}:`, error);
        }
      }
    }
  }

  // Clear previous routes
  clearRoutes() {
    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }

    this.nearestMarkers.forEach(marker => {
      this.map.removeLayer(marker);
    });
    this.nearestMarkers = [];
  }



  // Open evacuation center in external maps app
  async openInExternalMaps(center: EvacuationCenter) {
    const lat = Number(center.latitude);
    const lng = Number(center.longitude);

    // Create maps URL that works on both Android and iOS
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;

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
      color: 'warning',
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

          // Use earthquake color (orange)
          const routeColor = '#ff9500';

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
            message: `🟠 Route: ${(route.distance/1000).toFixed(2)}km, ${(route.duration/60).toFixed(0)}min via ${travelMode}`,
            duration: 4000,
            color: 'warning'
          });
          await toast.present();

          // Fit map to route
          this.map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
        }
      }
    } catch (error) {
      console.error('🟠 Error routing to center:', error);

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
        'earthquake-map',
        this.map,
        'Earthquake',
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
