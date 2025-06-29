import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, LoadingController, ToastController, AlertController } from '@ionic/angular';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Geolocation } from '@capacitor/geolocation';
import { OpenStreetMapRoutingService, Route } from '../../services/openstreetmap-routing.service';
import { MapboxRoutingService } from '../../services/mapbox-routing.service';

import { EnhancedDownloadService } from '../../services/enhanced-download.service';
import { EvacuationCenter } from '../../interfaces/evacuation-center.interface';
import { RealTimeNavigationComponent } from '../../components/real-time-navigation/real-time-navigation.component';

import * as L from 'leaflet';

@Component({
  selector: 'app-earthquake-map',
  templateUrl: './earthquake-map.page.html',
  styleUrls: ['./earthquake-map.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RealTimeNavigationComponent]
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

  // All centers panel properties
  public showAllCentersPanel: boolean = false;

  // Travel mode for routing (like all-maps)
  public travelMode: 'walking' | 'cycling' | 'driving' = 'walking';
  public routeTime: number = 0;
  public routeDistance: number = 0;

  // Emergency navigation flag
  private shouldAutoRouteEmergency = false;

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
  private osmRouting = inject(OpenStreetMapRoutingService);
  private mapboxRouting = inject(MapboxRoutingService);

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

        // Check if this came from a notification
        if (params['notification'] === 'true') {
          console.log('📱 Emergency triggered by notification:', {
            category: params['category'],
            severity: params['severity'],
            title: params['title'],
            message: params['message']
          });

          // Show notification-specific emergency alert
          this.showNotificationEmergencyAlert(params);
        }

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
        const apiResponse = await Promise.race([
          firstValueFrom(
            this.http.get<{success: boolean, data: EvacuationCenter[], count: number}>(`${environment.apiUrl}/evacuation-centers`)
          ),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('API timeout')), 15000)
          )
        ]);
        allCenters = apiResponse.data || [];

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
          // Check if the array contains exactly 'Earthquake' (case-sensitive)
          return center.disaster_type.some(type => type === 'Earthquake');
        }
        return center.disaster_type === 'Earthquake';
      });

      console.log(`🟠 EARTHQUAKE MAP: Filtered to ${this.evacuationCenters.length} earthquake centers`);
      console.log('🟠 EARTHQUAKE MAP: Filtered centers:', this.evacuationCenters.map(c => `${c.name} (${JSON.stringify(c.disaster_type)})`));

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
          console.log('🟠 EARTHQUAKE: Marker clicked for center:', center.name);
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

    // Don't auto-route - just show simple markers like "See Whole Map"
    // await this.routeToTwoNearestCenters();

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
      console.log('🟠 EARTHQUAKE MAP: No user location or evacuation centers available');
      return;
    }

    try {
      console.log('🟠 EARTHQUAKE MAP: Finding 2 nearest earthquake centers...');

      // Find 2 nearest centers
      const nearestCenters = this.getTwoNearestCenters(
        this.userLocation.lat,
        this.userLocation.lng
      );

      if (nearestCenters.length === 0) {
        const toast = await this.toastCtrl.create({
          message: 'No earthquake evacuation centers found nearby',
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

      // Calculate and display routes using Mapbox
      await this.calculateRoutes(nearestCenters);

      // Show success message
      const toast = await this.toastCtrl.create({
        message: `🟠 Showing routes to ${nearestCenters.length} nearest earthquake centers`,
        duration: 4000,
        color: 'warning'
      });
      await toast.present();

    } catch (error) {
      console.error('🟠 EARTHQUAKE MAP: Error calculating routes', error);
      const toast = await this.toastCtrl.create({
        message: 'Failed to calculate routes. Please try again.',
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

  // Add pulsing markers for nearest centers (like all-maps)
  addPulsingMarkers(centers: EvacuationCenter[]) {
    // Clear existing nearest markers
    this.nearestMarkers.forEach(marker => this.map.removeLayer(marker));
    this.nearestMarkers = [];

    centers.forEach((center, index) => {
      const lat = Number(center.latitude);
      const lng = Number(center.longitude);

      if (!isNaN(lat) && !isNaN(lng)) {
        // Create pulsing marker with earthquake styling
        const pulsingIcon = L.divIcon({
          className: 'pulsing-marker',
          html: `
            <div class="pulse-container">
              <div class="pulse" style="background-color: #ff9500"></div>
              <img src="assets/forEarthquake.png" class="marker-icon" />
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
            <p><strong>Type:</strong> Earthquake</p>
            <p><strong>Distance:</strong> ${((center as any).distance / 1000).toFixed(2)} km</p>
            <p><strong>Capacity:</strong> ${center.capacity || 'N/A'}</p>
          </div>
        `);

        marker.addTo(this.map);
        this.nearestMarkers.push(marker);
      }
    });
  }

  // Calculate routes to nearest centers using Mapbox (like all-maps)
  async calculateRoutes(centers: EvacuationCenter[]) {
    if (!this.userLocation) return;

    this.routeLayer = L.layerGroup().addTo(this.map);

    for (let i = 0; i < centers.length; i++) {
      const center = centers[i];
      const lat = Number(center.latitude);
      const lng = Number(center.longitude);

      if (!isNaN(lat) && !isNaN(lng)) {
        try {
          console.log(`🟠 EARTHQUAKE MAP: Creating Mapbox route to center ${i + 1}: ${center.name}`);

          // Use Mapbox routing for accurate routes with selected travel mode
          const mapboxProfile = this.mapboxRouting.convertTravelModeToProfile(this.travelMode);

          const routeData = await this.mapboxRouting.getDirections(
            this.userLocation.lng, this.userLocation.lat,
            lng, lat,
            mapboxProfile
          );

          if (routeData && routeData.routes && routeData.routes.length > 0) {
            const route = routeData.routes[0];

            // Draw route with earthquake color
            const routeLine = L.polyline(
              route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]),
              {
                color: '#ff9500', // Orange for earthquake
                weight: 4,
                opacity: 0.8,
                dashArray: i === 0 ? undefined : '10, 10' // Solid for first, dashed for second
              }
            );

            routeLine.addTo(this.routeLayer);

            // Store route info for first center (for display)
            if (i === 0) {
              this.routeTime = route.duration;
              this.routeDistance = route.distance;
            }

            console.log(`✅ EARTHQUAKE MAP: Added Mapbox route to ${center.name} (${(route.distance/1000).toFixed(2)}km, ${(route.duration/60).toFixed(0)}min)`);
          }
        } catch (error) {
          console.error(`🟠 Error calculating Mapbox route to center ${i + 1}:`, error);
          // Skip fallback straight line - only show proper Mapbox routes
        }
      }
    }
  }

  // Clear previous routes
  clearRoutes() {
    // Remove route layer
    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }

    // Remove nearest markers
    this.nearestMarkers.forEach(marker => {
      this.map.removeLayer(marker);
    });
    this.nearestMarkers = [];

    // Clear any remaining route layers by checking all map layers
    this.map.eachLayer((layer: any) => {
      if (layer instanceof L.GeoJSON ||
          layer instanceof L.Polyline ||
          (layer.options && (
            layer.options.color === '#ff9500' ||
            layer.options.color === '#ffa500' ||
            layer.isRouteLayer ||
            layer.isNavigationRoute
          ))) {
        this.map.removeLayer(layer);
      }
    });
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
    console.log('🟠 EARTHQUAKE: showNavigationPanel called for:', center.name);
    console.log('🟠 EARTHQUAKE: Setting selectedCenter to:', center);

    this.selectedCenter = center;
    this.selectedTransportMode = null;
    this.routeInfo = {};

    console.log('🟠 EARTHQUAKE: selectedCenter is now:', this.selectedCenter);

    // Calculate routes for all transport modes
    await this.calculateAllRoutes(center);
  }

  // Close navigation panel
  closeNavigationPanel() {
    this.selectedCenter = null;
    this.selectedTransportMode = null;
    this.routeInfo = {};
    // Also close all centers panel if open
    this.showAllCentersPanel = false;
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
        // Use Mapbox for route calculation
        const mapboxProfile = this.mapboxRouting.convertTravelModeToProfile(mode);

        const routeData = await this.mapboxRouting.getDirections(
          this.userLocation.lng, this.userLocation.lat,
          lng, lat,
          mapboxProfile
        );

        if (routeData && routeData.routes && routeData.routes.length > 0) {
          const route = routeData.routes[0];
          this.routeInfo[mode] = {
            duration: route.duration,
            distance: route.distance
          };
          console.log(`🟠 EARTHQUAKE: ${mode} route calculated - ${(route.distance/1000).toFixed(2)}km, ${Math.round(route.duration/60)}min`);
        }
      } catch (error) {
        console.error(`🟠 EARTHQUAKE: Error calculating ${mode} route:`, error);
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
        console.log(`🟠 EARTHQUAKE: Creating Mapbox route to ${center.name} via ${travelMode}`);

        // Use Mapbox routing for accurate routes
        const mapboxProfile = this.mapboxRouting.convertTravelModeToProfile(travelMode);

        const routeData = await this.mapboxRouting.getDirections(
          this.userLocation.lng, this.userLocation.lat,
          lng, lat,
          mapboxProfile
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

          // Mark as route layer for easier identification
          (routeLine as any).isRouteLayer = true;
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

          console.log(`✅ EARTHQUAKE: Successfully created route with ${route.geometry.coordinates.length} points`);
        }
      }
    } catch (error) {
      console.error('🟠 Error routing to earthquake center:', error);

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

  // Helper method for ion-segment change event
  onTravelModeChange(event: any) {
    const mode = event.detail.value as 'walking' | 'cycling' | 'driving';
    this.changeTravelMode(mode);
  }

  // Change travel mode (like all-maps)
  async changeTravelMode(mode: 'walking' | 'cycling' | 'driving') {
    this.travelMode = mode;

    const toast = await this.toastCtrl.create({
      message: `🟠 Travel mode changed to ${mode}`,
      duration: 2000,
      color: 'warning'
    });
    await toast.present();

    // Recalculate routes with new travel mode
    if (this.userLocation && this.evacuationCenters.length > 0) {
      await this.routeToTwoNearestCenters();
    }
  }

  // Show all centers panel
  showAllCenters() {
    this.showAllCentersPanel = true;
    // Close navigation panel if open
    this.selectedCenter = null;
  }

  // Close all centers panel
  closeAllCentersPanel() {
    this.showAllCentersPanel = false;
  }

  // Select center from list
  async selectCenterFromList(center: EvacuationCenter) {
    // Close all centers panel
    this.showAllCentersPanel = false;

    // Show navigation panel for selected center
    await this.showNavigationPanel(center);

    // Center map on selected center
    const lat = Number(center.latitude);
    const lng = Number(center.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      this.map.setView([lat, lng], 16);
    }
  }

  // Calculate distance in kilometers for display
  calculateDistanceInKm(center: EvacuationCenter): string {
    if (!this.userLocation) return 'N/A';

    const lat = Number(center.latitude);
    const lng = Number(center.longitude);

    if (isNaN(lat) || isNaN(lng)) return 'N/A';

    const distance = this.calculateDistance(
      this.userLocation.lat,
      this.userLocation.lng,
      lat,
      lng
    );

    return (distance / 1000).toFixed(1);
  }

  // Route to nearest centers (compass button functionality)
  async routeToNearestCenters() {
    if (!this.userLocation || this.evacuationCenters.length === 0) {
      const toast = await this.toastCtrl.create({
        message: 'Unable to calculate routes. Please ensure location is available.',
        duration: 3000,
        color: 'warning'
      });
      await toast.present();
      return;
    }

    try {
      // Show loading
      const loading = await this.loadingCtrl.create({
        message: 'Calculating routes to nearest centers...',
        spinner: 'crescent'
      });
      await loading.present();

      // Route to 2 nearest centers
      await this.routeToTwoNearestCenters();

      await loading.dismiss();

      // Show success message
      const toast = await this.toastCtrl.create({
        message: '🧭 Routes calculated to 2 nearest earthquake evacuation centers',
        duration: 4000,
        color: 'warning',
        position: 'top'
      });
      await toast.present();

    } catch (error) {
      console.error('Error routing to nearest centers:', error);

      const toast = await this.toastCtrl.create({
        message: 'Error calculating routes. Please try again.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
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



  /**
   * Show emergency alert for notification-triggered navigation
   */
  private async showNotificationEmergencyAlert(params: any): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '🚨 EARTHQUAKE EMERGENCY',
      subHeader: params['title'] || 'Emergency Notification',
      message: `
        <div style="text-align: left;">
          <p><strong>Alert:</strong> ${params['message'] || 'Earthquake emergency detected'}</p>
          <p><strong>Severity:</strong> ${(params['severity'] || 'medium').toUpperCase()}</p>
          <p><strong>Action:</strong> Routing to nearest earthquake evacuation centers</p>
        </div>
      `,
      buttons: [
        {
          text: 'Navigate Now',
          role: 'confirm',
          cssClass: 'alert-button-confirm',
          handler: () => {
            console.log('🚨 User confirmed emergency navigation');
            // Emergency routing will be triggered by shouldAutoRouteEmergency flag
          }
        },
        {
          text: 'View Map Only',
          role: 'cancel',
          cssClass: 'alert-button-cancel',
          handler: () => {
            console.log('📍 User chose to view map without auto-routing');
            this.shouldAutoRouteEmergency = false;
          }
        }
      ],
      cssClass: 'emergency-alert'
    });

    await alert.present();
  }

  ionViewWillLeave() {
    this.clearRoutes();
    // Stop real-time navigation if active
    if (this.isRealTimeNavigationActive) {
      this.osmRouting.stopRealTimeRouting();
    }
    if (this.map) {
      this.map.remove();
    }
  }

  // Real-time navigation methods
  async startRealTimeNavigation(center: EvacuationCenter) {
    console.log('🧭 Starting real-time navigation to:', center.name);

    if (!this.selectedTransportMode) {
      console.error('❌ No transport mode selected');
      return;
    }

    // First, route to the center with the selected transport mode
    await this.routeToCenter(center, this.selectedTransportMode);

    // Set up real-time navigation
    this.navigationDestination = {
      lat: Number(center.latitude),
      lng: Number(center.longitude),
      name: center.name
    };

    this.isRealTimeNavigationActive = true;

    // Close the navigation panel automatically
    this.closeNavigationPanel();

    // Show success toast
    this.toastCtrl.create({
      message: `🧭 Real-time navigation started to ${center.name} via ${this.selectedTransportMode}`,
      duration: 3000,
      color: 'primary'
    }).then(toast => toast.present());

    console.log('✅ Real-time navigation setup complete');
  }

  onNavigationRouteUpdated(route: Route) {
    console.log('🔄 Navigation route updated');
    this.currentNavigationRoute = route;

    // Update the map with the new route
    this.updateMapWithNavigationRoute(route);
  }

  onNavigationStopped() {
    console.log('⏹️ Real-time navigation stopped');
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

    // Add new navigation route to map
    if (route.geometry && route.geometry.coordinates) {
      const routeGeoJSON = this.osmRouting.convertToGeoJSON(route);

      const navigationRoute = L.geoJSON(routeGeoJSON, {
        style: {
          color: '#007bff',
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
