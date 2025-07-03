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
import * as L from 'leaflet';

import { EvacuationCenter } from '../../interfaces/evacuation-center.interface';
import { RealTimeNavigationComponent } from '../../components/real-time-navigation/real-time-navigation.component';

@Component({
  selector: 'app-fire-map',
  templateUrl: './fire-map.page.html',
  styleUrls: ['./fire-map.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RealTimeNavigationComponent]
})
export class FireMapPage implements OnInit, AfterViewInit {
  private map!: L.Map;
  private userMarker: L.Marker<any> | null = null;
  private routeLayer: L.LayerGroup | null = null;
  private nearestMarkers: L.Marker[] = [];
  private evacuationMarkers: L.Marker[] = [];

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

  // UI panel properties
  public showAllCentersPanel = false;
  public showRouteFooter = false;

  // Travel mode for routing (like all-maps)
  public travelMode: 'walking' | 'cycling' | 'driving' = 'walking';
  public routeTime: number = 0;
  public routeDistance: number = 0;

  // Real-time navigation properties
  public isRealTimeNavigationActive = false;
  public navigationDestination: { lat: number; lng: number; name?: string } | null = null;
  public currentNavigationRoute: Route | null = null;

  // Emergency notification properties
  public shouldAutoRouteEmergency = false;

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
    console.log('🔥 FIRE MAP: Component initialized...');
    // Don't initialize map here - wait for view to be ready

    // Check for query parameters to highlight new center or emergency navigation
    this.route.queryParams.subscribe((params: any) => {
      if (params['newCenterId']) {
        this.newCenterId = params['newCenterId'];
        this.highlightCenter = params['highlightCenter'] === 'true';
        this.centerLat = params['centerLat'] ? parseFloat(params['centerLat']) : null;
        this.centerLng = params['centerLng'] ? parseFloat(params['centerLng']) : null;
        console.log('🔥 FIRE MAP: New center to highlight:', this.newCenterId);
      }

      // Handle emergency navigation from notifications
      if (params['emergency'] === 'true' && params['autoRoute'] === 'true') {
        console.log('🚨 Emergency navigation triggered for fire map');

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
    console.log('🔥 FIRE MAP: View initialized, loading map...');
    // Small delay to ensure DOM is fully rendered
    setTimeout(async () => {
      await this.loadFireMap();
    }, 100);
  }

  async loadFireMap() {
    const loading = await this.loadingCtrl.create({
      message: 'Loading fire evacuation centers...',
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

      console.log(`🔥 FIRE MAP: User location [${userLat}, ${userLng}]`);

      // Initialize map
      this.initializeMap(userLat, userLng);

      // Load ONLY fire centers and auto-route
      await this.loadFireCenters(userLat, userLng);

      await loading.dismiss();

      // Show success message
      const toast = await this.toastCtrl.create({
        message: `🔥 Showing ${this.evacuationCenters.length} fire evacuation centers`,
        duration: 3000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();

    } catch (error) {
      await loading.dismiss();
      console.error('🔥 FIRE MAP: Error loading map', error);

      const alert = await this.alertCtrl.create({
        header: 'Location Error',
        message: 'Unable to get your location. Please enable GPS and try again.',
        buttons: [
          {
            text: 'Retry',
            handler: () => this.loadFireMap()
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
    console.log(`🔥 FIRE MAP: Initializing map at [${lat}, ${lng}]`);

    // Check if container exists
    const container = document.getElementById('fire-map');
    if (!container) {
      console.error('🔥 FIRE MAP: Container #fire-map not found!');
      throw new Error('Map container not found. Please ensure the view is properly loaded.');
    }

    if (this.map) {
      this.map.remove();
    }

    this.map = L.map('fire-map', {
      zoomControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: false,
      keyboard: true,
      dragging: true,
      touchZoom: true,
      zoomAnimation: true,
      zoomAnimationThreshold: 4,
      fadeAnimation: true,
      markerZoomAnimation: true,
      transform3DLimit: 2^23,
      zoomSnap: 1,
      zoomDelta: 1,
      trackResize: true,
      inertia: true,
      inertiaDeceleration: 3000,
      inertiaMaxSpeed: Infinity,
      easeLinearity: 0.2,
      worldCopyJump: false,
      maxBoundsViscosity: 0.0
    }).setView([lat, lng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'OpenStreetMap contributors'
    }).addTo(this.map);

    // Add user marker with stability options
    const preciseLat = parseFloat(Number(lat).toFixed(8));
    const preciseLng = parseFloat(Number(lng).toFixed(8));

    this.userMarker = L.marker([preciseLat, preciseLng], {
      icon: L.icon({
        iconUrl: 'assets/myLocation.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      }),
      // Add marker stability options
      riseOnHover: false,
      riseOffset: 0,
      zIndexOffset: 1000,
      opacity: 1,
      interactive: true,
      bubblingMouseEvents: true
    }).addTo(this.map);

    this.userMarker.bindPopup('📍 You are here!').openPopup();
  }

  async loadFireCenters(userLat: number, userLng: number) {
    try {
      console.log('🔥 FIRE MAP: Fetching fire centers...');

      let allCenters: EvacuationCenter[] = [];

      // Fetch data from API
      try {
        const apiResponse = await firstValueFrom(
          this.http.get<{success: boolean, data: EvacuationCenter[], count: number}>(`${environment.apiUrl}/evacuation-centers`)
        );
        allCenters = apiResponse.data || [];
        console.log('🔥 FIRE MAP: Total centers received from API:', allCenters?.length || 0);
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

      // Filter for FIRE ONLY - handle both array and string formats
      this.evacuationCenters = allCenters.filter(center => {
        if (Array.isArray(center.disaster_type)) {
          // Check if the array contains exactly 'Fire' (case-sensitive)
          return center.disaster_type.some(type => type === 'Fire');
        }
        return center.disaster_type === 'Fire';
      });

      console.log(`🔥 FIRE MAP: Filtered to ${this.evacuationCenters.length} fire centers`);
      console.log('🔥 FIRE MAP: Filtered centers:', this.evacuationCenters.map(c => `${c.name} (${JSON.stringify(c.disaster_type)})`));

      console.log(`🔥 FIRE MAP: Filtered to ${this.evacuationCenters.length} fire centers`);

      if (this.evacuationCenters.length === 0) {
        const alert = await this.alertCtrl.create({
          header: 'No Fire Centers',
          message: 'No fire evacuation centers found in the data.',
          buttons: ['OK']
        });
        await alert.present();
        return;
      }

      // Add markers and routes
      await this.addMarkersAndRoutes(userLat, userLng);

    } catch (error) {
      console.error('🔥 FIRE MAP: Error loading centers', error);

      const toast = await this.toastCtrl.create({
        message: 'Error loading fire centers. Please check your internet connection.',
        duration: 4000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  // Add markers and routes to map
  async addMarkersAndRoutes(userLat: number, userLng: number) {
    // Clear existing evacuation markers to prevent duplicates
    this.evacuationMarkers.forEach(marker => this.map.removeLayer(marker));
    this.evacuationMarkers = [];

    // Add fire markers (red)
    this.evacuationCenters.forEach(center => {
      const lat = Number(center.latitude);
      const lng = Number(center.longitude);

      if (!isNaN(lat) && !isNaN(lng)) {
        // Create fire icon marker for fire evacuation centers
        const marker = L.marker([lat, lng], {
          icon: L.icon({
            iconUrl: 'assets/forFire.png',
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, -40]
          })
        });

        const distance = this.calculateDistance(userLat, userLng, lat, lng);

        // Make marker clickable with navigation panel
        marker.on('click', () => {
          console.log('🔥 FIRE: Marker clicked for center:', center.name);
          this.showNavigationPanel(center);
        });

        // Check if this is the new center to highlight
        const isNewCenter = this.newCenterId && center.id.toString() === this.newCenterId;

        marker.bindPopup(`
          <div class="evacuation-popup">
            <h3>🔥 ${center.name} ${isNewCenter ? '⭐ NEW!' : ''}</h3>
            <p><strong>Type:</strong> Fire Center</p>
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
            message: `🆕 New fire evacuation center: ${center.name}`,
            duration: 5000,
            color: 'danger',
            position: 'top'
          }).then(toast => toast.present());
        }

        marker.addTo(this.map);
        this.evacuationMarkers.push(marker);
        console.log(`🔥 Added fire marker: ${center.name}`);
      }
    });

    // Handle emergency auto-routing
    if (this.shouldAutoRouteEmergency) {
      console.log('🚨 Performing emergency auto-routing to nearest fire evacuation centers');
      await this.performEmergencyRouting();
      this.shouldAutoRouteEmergency = false; // Reset flag
    } else {
      // Don't auto-route - just show simple markers like "See Whole Map"
      console.log('🔥 Showing simple markers without auto-routing...');
      // await this.routeToTwoNearestCenters();
    }

    // Fit map to show all fire centers
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
      console.log('🚨 Starting emergency routing to nearest fire evacuation centers');

      // Show emergency routing toast
      const emergencyToast = await this.toastCtrl.create({
        message: '🚨 EMERGENCY: Routing to nearest fire evacuation centers',
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

  // Auto-route to 2 nearest fire centers
  async routeToTwoNearestCenters() {
    if (!this.userLocation || this.evacuationCenters.length === 0) {
      console.log('🔥 FIRE MAP: No user location or evacuation centers available');
      return;
    }

    try {
      console.log('🔥 FIRE MAP: Finding 2 nearest fire centers...');

      // Find 2 nearest centers
      const nearestCenters = this.getTwoNearestCenters(
        this.userLocation.lat,
        this.userLocation.lng
      );

      if (nearestCenters.length === 0) {
        const toast = await this.toastCtrl.create({
          message: 'No fire evacuation centers found nearby',
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
        message: `🔥 Showing routes to ${nearestCenters.length} nearest fire centers`,
        duration: 4000,
        color: 'danger'
      });
      await toast.present();

    } catch (error) {
      console.error('🔥 FIRE MAP: Error calculating routes', error);
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

    // Hide regular evacuation markers to avoid duplication
    this.evacuationMarkers.forEach(marker => this.map.removeLayer(marker));

    centers.forEach((center, index) => {
      const lat = Number(center.latitude);
      const lng = Number(center.longitude);

      if (!isNaN(lat) && !isNaN(lng)) {
        // Create pulsing marker with fire styling
        const pulsingIcon = L.divIcon({
          className: '', // Leave empty to avoid default leaflet styles
          html: `
            <div class="pulse-marker">
              <div class="pulse-circle fire smooth"></div>
              <img src="assets/forFire.png" />
              <div class="marker-label fire">${index + 1}</div>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });

        const marker = L.marker([lat, lng], { icon: pulsingIcon });

        // Add click handler for navigation panel
        marker.on('click', () => {
          console.log('🔥 FIRE: Pulsing marker clicked for center:', center.name);
          this.showNavigationPanel(center);
        });

        marker.bindPopup(`
          <div class="evacuation-popup nearest-popup">
            <h3>🎯 Nearest Center #${index + 1}</h3>
            <h4>${center.name}</h4>
            <p><strong>Type:</strong> Fire</p>
            <p><strong>Distance:</strong> ${((center as any).distance / 1000).toFixed(2)} km</p>
            <p><strong>Capacity:</strong> ${center.capacity || 'N/A'}</p>
            <p><em>Click marker for route options</em></p>
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
          console.log(`🔥 FIRE MAP: Creating Mapbox route to center ${i + 1}: ${center.name}`);

          // Use Mapbox routing for accurate routes with selected travel mode
          const mapboxProfile = this.mapboxRouting.convertTravelModeToProfile(this.travelMode);

          const routeData = await this.mapboxRouting.getDirections(
            this.userLocation.lng, this.userLocation.lat,
            lng, lat,
            mapboxProfile
          );

          if (routeData && routeData.routes && routeData.routes.length > 0) {
            const route = routeData.routes[0];

            // Draw route with fire color
            const routeLine = L.polyline(
              route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]),
              {
                color: '#dc3545', // Red for fire
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

            console.log(`✅ FIRE MAP: Added Mapbox route to ${center.name} (${(route.distance/1000).toFixed(2)}km, ${(route.duration/60).toFixed(0)}min)`);
          }
        } catch (error) {
          console.error(`🔥 Error calculating Mapbox route to center ${i + 1}:`, error);
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

    // Restore regular evacuation markers if they were hidden
    this.evacuationMarkers.forEach(marker => {
      if (!this.map.hasLayer(marker)) {
        marker.addTo(this.map);
      }
    });

    // Clear any remaining route layers by checking all map layers
    this.map.eachLayer((layer: any) => {
      if (layer instanceof L.GeoJSON ||
          layer instanceof L.Polyline ||
          (layer.options && (
            layer.options.color === '#ef4444' ||
            layer.options.color === '#dc3545' ||
            layer.isRouteLayer ||
            layer.isNavigationRoute
          ))) {
        this.map.removeLayer(layer);
      }
    });
  }



  // Show navigation panel for online mode
  async showNavigationPanel(center: EvacuationCenter) {
    console.log('🔥 FIRE: showNavigationPanel called for:', center.name);
    console.log('🔥 FIRE: Setting selectedCenter to:', center);

    this.selectedCenter = center;
    this.selectedTransportMode = 'walking'; // Default to walking
    this.routeInfo = {};
    this.showRouteFooter = true;

    console.log('🔥 FIRE: selectedCenter is now:', this.selectedCenter);
    console.log('🔥 FIRE: showRouteFooter is now:', this.showRouteFooter);

    // Calculate routes for all transport modes
    await this.calculateAllRoutes(center);
  }

  // Calculate routes for all transport modes
  async calculateAllRoutes(center: EvacuationCenter) {
    if (!this.userLocation) return;

    console.log('🔥 FIRE: Calculating routes for center:', center.name);
    const modes: ('walking' | 'cycling' | 'driving')[] = ['walking', 'cycling', 'driving'];

    for (const mode of modes) {
      try {
        const mapboxProfile = this.mapboxRouting.convertTravelModeToProfile(mode);
        const routeData = await this.mapboxRouting.getDirections(
          this.userLocation.lng, this.userLocation.lat,
          Number(center.longitude), Number(center.latitude),
          mapboxProfile
        );

        if (routeData && routeData.routes && routeData.routes.length > 0) {
          const route = routeData.routes[0];
          this.routeInfo[mode] = {
            duration: route.duration,
            distance: route.distance
          };
        }
      } catch (error) {
        console.error(`🔥 Error calculating ${mode} route:`, error);
      }
    }
    console.log('🔥 FIRE: Route calculation completed. RouteInfo:', this.routeInfo);
  }

  // Navigate with selected transport mode
  async navigateWithMode(mode: 'walking' | 'cycling' | 'driving') {
    if (!this.selectedCenter || !this.userLocation) return;

    this.selectedTransportMode = mode;

    // Clear previous routes
    this.clearRoutes();

    try {
      const mapboxProfile = this.mapboxRouting.convertTravelModeToProfile(mode);

      const routeData = await this.mapboxRouting.getDirections(
        this.userLocation.lng, this.userLocation.lat,
        Number(this.selectedCenter.longitude), Number(this.selectedCenter.latitude),
        mapboxProfile
      );

      if (routeData && routeData.routes && routeData.routes.length > 0) {
        const route = routeData.routes[0];

        // Use fire color (red)
        const routeColor = '#dc3545';

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
          message: `🔥 Route: ${(route.distance/1000).toFixed(2)}km, ${(route.duration/60).toFixed(0)}min via ${mode}`,
          duration: 4000,
          color: 'danger'
        });
        await toast.present();

        // Fit map to route
        this.map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
      }
    } catch (error) {
      console.error('🔥 Error showing route:', error);
      const toast = await this.toastCtrl.create({
        message: 'Error calculating route. Please try again.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  // Close navigation panel
  closeNavigationPanel() {
    this.selectedCenter = null;
    this.selectedTransportMode = null;
    this.routeInfo = {};
    this.showRouteFooter = false;
    this.clearRoutes();
  }

  // Go back to home
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
      message: `🔥 Travel mode changed to ${mode}`,
      duration: 2000,
      color: 'danger'
    });
    await toast.present();

    // Recalculate routes with new travel mode
    if (this.userLocation && this.evacuationCenters.length > 0) {
      await this.routeToTwoNearestCenters();
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
        'fire-map',
        this.map,
        'Fire',
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



  // Show all centers panel
  showAllCenters() {
    this.showAllCentersPanel = true;
  }

  // Close all centers panel
  closeAllCentersPanel() {
    this.showAllCentersPanel = false;
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
      const toast = await this.toastCtrl.create({
        message: '🔥 Calculating routes to nearest fire centers...',
        duration: 2000,
        color: 'danger'
      });
      await toast.present();

      await this.routeToTwoNearestCenters();
    } catch (error) {
      console.error('🔥 Error routing to nearest centers:', error);
      const errorToast = await this.toastCtrl.create({
        message: 'Failed to calculate routes. Please try again.',
        duration: 3000,
        color: 'danger'
      });
      await errorToast.present();
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

  // Select center from all centers list
  selectCenterFromList(center: EvacuationCenter) {
    this.closeAllCentersPanel();
    this.showNavigationPanel(center);

    // Pan map to selected center
    const lat = Number(center.latitude);
    const lng = Number(center.longitude);
    this.map.setView([lat, lng], 15);
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

  // Select transport mode and show route
  selectTransportMode(mode: 'walking' | 'cycling' | 'driving') {
    this.selectedTransportMode = mode;
    if (this.selectedCenter) {
      this.navigateWithMode(mode);
    }
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

  // Route to specific center with chosen transportation mode
  async routeToCenter(center: EvacuationCenter, travelMode: 'walking' | 'cycling' | 'driving') {
    if (!this.userLocation) return;

    try {
      // Clear existing routes
      this.clearRoutes();

      const lat = Number(center.latitude);
      const lng = Number(center.longitude);

      if (!isNaN(lat) && !isNaN(lng)) {
        console.log(`🔥 FIRE: Creating Mapbox route to ${center.name} via ${travelMode}`);

        // Use Mapbox routing for accurate routes
        const mapboxProfile = this.mapboxRouting.convertTravelModeToProfile(travelMode);

        const routeData = await this.mapboxRouting.getDirections(
          this.userLocation.lng, this.userLocation.lat,
          lng, lat,
          mapboxProfile
        );

        if (routeData && routeData.routes && routeData.routes.length > 0) {
          const route = routeData.routes[0];

          // Use fire color (red)
          const routeColor = '#ef4444';

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
            message: `🔥 Route: ${(route.distance/1000).toFixed(2)}km, ${(route.duration/60).toFixed(0)}min via ${travelMode}`,
            duration: 4000,
            color: 'danger'
          });
          await toast.present();

          // Fit map to route
          this.map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });

          console.log(`✅ FIRE: Successfully created route with ${route.geometry.coordinates.length} points`);
        }
      }
    } catch (error) {
      console.error('🔥 Error routing to fire center:', error);

      const toast = await this.toastCtrl.create({
        message: 'Error calculating route. Please try again.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  // Real-time navigation methods
  async startRealTimeNavigation(center: EvacuationCenter) {
    console.log('🧭 Starting real-time navigation to fire center:', center.name);

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

    console.log('✅ Fire map real-time navigation setup complete');
  }

  onNavigationRouteUpdated(route: Route) {
    console.log('🔄 Fire map navigation route updated');
    this.currentNavigationRoute = route;

    // Update the map with the new route
    this.updateMapWithNavigationRoute(route);
  }

  onNavigationStopped() {
    console.log('⏹️ Fire map real-time navigation stopped');
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

    // Add new navigation route to map with fire color
    if (route.geometry && route.geometry.coordinates) {
      const routeGeoJSON = this.osmRouting.convertToGeoJSON(route);

      const navigationRoute = L.geoJSON(routeGeoJSON, {
        style: {
          color: '#dc3545', // Fire red color
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

  /**
   * Show emergency alert for notification-triggered navigation
   */
  private async showNotificationEmergencyAlert(params: any): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '🔥 FIRE EMERGENCY',
      subHeader: params['title'] || 'Emergency Notification',
      message: `
        <div style="text-align: left;">
          <p><strong>Alert:</strong> ${params['message'] || 'Fire emergency detected'}</p>
          <p><strong>Severity:</strong> ${(params['severity'] || 'medium').toUpperCase()}</p>
          <p><strong>Action:</strong> Routing to nearest fire evacuation centers</p>
        </div>
      `,
      buttons: [
        {
          text: 'Navigate Now',
          role: 'confirm',
          cssClass: 'alert-button-confirm',
          handler: () => {
            console.log('🚨 User confirmed emergency navigation for fire');
            // Emergency routing will be triggered by shouldAutoRouteEmergency flag
          }
        },
        {
          text: 'View Map Only',
          role: 'cancel',
          cssClass: 'alert-button-cancel',
          handler: () => {
            console.log('📍 User chose to view fire map without auto-routing');
            this.shouldAutoRouteEmergency = false;
          }
        }
      ],
      cssClass: 'emergency-alert'
    });

    await alert.present();
  }
}
