import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, LoadingController, ToastController, AlertController } from '@ionic/angular';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Geolocation } from '@capacitor/geolocation';
import * as L from 'leaflet';
import { OpenStreetMapRoutingService, Route } from '../../services/openstreetmap-routing.service';
import { MapboxRoutingService } from '../../services/mapbox-routing.service';
import { RealTimeNavigationComponent } from '../../components/real-time-navigation/real-time-navigation.component';

import { EnhancedDownloadService } from '../../services/enhanced-download.service';

import { EvacuationCenter } from '../../interfaces/evacuation-center.interface';

@Component({
  selector: 'app-flood-map',
  templateUrl: './flood-map.page.html',
  styleUrls: ['./flood-map.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RealTimeNavigationComponent]
})
export class FloodMapPage implements OnInit, AfterViewInit {
  private map!: L.Map;
  private userMarker: L.Marker<any> | null = null;
  private routeLayer: L.LayerGroup | null = null;
  private nearestMarkers: L.Marker[] = [];
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
    console.log('🔵 FLOOD MAP: Component initialized...');
    // Don't initialize map here - wait for view to be ready

    // Check for query parameters to highlight new center
    this.route.queryParams.subscribe((params: any) => {
      if (params['newCenterId']) {
        this.newCenterId = params['newCenterId'];
        this.highlightCenter = params['highlightCenter'] === 'true';
        this.centerLat = params['centerLat'] ? parseFloat(params['centerLat']) : null;
        this.centerLng = params['centerLng'] ? parseFloat(params['centerLng']) : null;
        console.log('🔵 FLOOD MAP: New center to highlight:', this.newCenterId);
      }
    });
  }

  async ngAfterViewInit() {
    console.log('🔵 FLOOD MAP: View initialized, loading map...');
    // Small delay to ensure DOM is fully rendered
    setTimeout(async () => {
      await this.loadFloodMap();
    }, 100);
  }

  async loadFloodMap() {
    const loading = await this.loadingCtrl.create({
      message: 'Loading flood evacuation centers...',
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

      console.log(`🔵 FLOOD MAP: User location [${userLat}, ${userLng}]`);

      // Store user location
      this.userLocation = { lat: userLat, lng: userLng };

      // Initialize map
      this.initializeMap(userLat, userLng);

      // Load ONLY flood centers
      await this.loadFloodCenters(userLat, userLng);

      await loading.dismiss();

      // Show success message
      const toast = await this.toastCtrl.create({
        message: `🔵 Showing ${this.evacuationCenters.length} flood evacuation centers`,
        duration: 3000,
        color: 'primary',
        position: 'top'
      });
      await toast.present();

    } catch (error) {
      await loading.dismiss();
      console.error('🔵 FLOOD MAP: Error loading map', error);

      const alert = await this.alertCtrl.create({
        header: 'Location Error',
        message: 'Unable to get your location. Please enable GPS and try again.',
        buttons: [
          {
            text: 'Retry',
            handler: () => this.loadFloodMap()
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
    console.log(`🔵 FLOOD MAP: Initializing map at [${lat}, ${lng}]`);

    // Check if container exists
    const container = document.getElementById('flood-map');
    if (!container) {
      console.error('🔵 FLOOD MAP: Container #flood-map not found!');
      throw new Error('Map container not found. Please ensure the view is properly loaded.');
    }

    if (this.map) {
      this.map.remove();
    }

    this.map = L.map('flood-map').setView([lat, lng], 13);

    // Try multiple tile providers for better reliability
    this.addTileLayerWithFallback();

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

  async loadFloodCenters(userLat: number, userLng: number) {
    try {
      console.log('🔵 FLOOD MAP: Fetching flood centers...');

      let allCenters: EvacuationCenter[] = [];

      // Fetch data from API
      try {
        const apiResponse = await firstValueFrom(
          this.http.get<{success: boolean, data: EvacuationCenter[], count: number}>(`${environment.apiUrl}/evacuation-centers`)
        );
        allCenters = apiResponse.data || [];
        console.log('🔵 FLOOD MAP: Total centers received from API:', allCenters?.length || 0);
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

      // Filter for FLOOD ONLY - handle both array and string formats
      this.evacuationCenters = allCenters.filter(center => {
        if (Array.isArray(center.disaster_type)) {
          // Check if the array contains exactly 'Flood' (case-sensitive)
          return center.disaster_type.some(type => type === 'Flood');
        }
        return center.disaster_type === 'Flood';
      });

      console.log(`🔵 FLOOD MAP: Filtered to ${this.evacuationCenters.length} flood centers`);
      console.log('🔵 FLOOD MAP: Filtered centers:', this.evacuationCenters.map(c => `${c.name} (${JSON.stringify(c.disaster_type)})`));

      console.log(`🔵 FLOOD MAP: Filtered to ${this.evacuationCenters.length} flood centers`);

      if (this.evacuationCenters.length === 0) {
        const alert = await this.alertCtrl.create({
          header: 'No Flood Centers',
          message: 'No flood evacuation centers found in the database.',
          buttons: ['OK']
        });
        await alert.present();
        return;
      }

      // Online-only mode

      // Add flood markers (blue)
      this.evacuationCenters.forEach(center => {
        const lat = Number(center.latitude);
        const lng = Number(center.longitude);

        if (!isNaN(lat) && !isNaN(lng)) {
          const marker = L.marker([lat, lng], {
            icon: L.icon({
              iconUrl: 'assets/forFlood.png',
              iconSize: [40, 40],
              iconAnchor: [20, 40],
              popupAnchor: [0, -40]
            })
          });

          const distance = this.calculateDistance(userLat, userLng, lat, lng);

          // Make marker clickable with navigation panel
          marker.on('click', () => {
            console.log('🌊 FLOOD: Marker clicked for center:', center.name);
            this.showNavigationPanel(center);
          });

          // Check if this is the new center to highlight
          const isNewCenter = this.newCenterId && center.id.toString() === this.newCenterId;

          marker.bindPopup(`
            <div class="evacuation-popup">
              <h3>🔵 ${center.name} ${isNewCenter ? '⭐ NEW!' : ''}</h3>
              <p><strong>Type:</strong> Flood Center</p>
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
              message: `🆕 New flood evacuation center: ${center.name}`,
              duration: 5000,
              color: 'primary',
              position: 'top'
            }).then(toast => toast.present());
          }

          marker.addTo(this.map);
          console.log(`🔵 Added flood marker: ${center.name}`);
        }
      });

      // Don't auto-route - just show simple markers like "See Whole Map"
      console.log('🔵 Showing simple markers without auto-routing...');
      // await this.routeToTwoNearestCenters();

      // Fit map to show all flood centers
      if (this.evacuationCenters.length > 0) {
        const bounds = L.latLngBounds([]);
        bounds.extend([userLat, userLng]);

        this.evacuationCenters.forEach(center => {
          bounds.extend([Number(center.latitude), Number(center.longitude)]);
        });

        this.map.fitBounds(bounds, { padding: [50, 50] });
      }

    } catch (error) {
      console.error('🔵 FLOOD MAP: Error loading centers', error);

      const toast = await this.toastCtrl.create({
        message: 'Error loading flood centers. Please check your connection.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  // Auto-route to 2 nearest flood centers
  async routeToTwoNearestCenters() {
    if (!this.userLocation || this.evacuationCenters.length === 0) {
      console.log('🔵 FLOOD MAP: No user location or evacuation centers available');
      return;
    }

    try {
      console.log('🔵 FLOOD MAP: Finding 2 nearest flood centers...');

      // Find 2 nearest centers
      const nearestCenters = this.getTwoNearestCenters(
        this.userLocation.lat,
        this.userLocation.lng
      );

      if (nearestCenters.length === 0) {
        const toast = await this.toastCtrl.create({
          message: 'No flood evacuation centers found nearby',
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
        message: `🔵 Showing routes to ${nearestCenters.length} nearest flood centers`,
        duration: 4000,
        color: 'primary'
      });
      await toast.present();

    } catch (error) {
      console.error('🔵 FLOOD MAP: Error calculating routes', error);
      const toast = await this.toastCtrl.create({
        message: 'Failed to calculate routes. Please try again.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
  }

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
        // Create pulsing marker with flood styling
        const pulsingIcon = L.divIcon({
          className: 'pulsing-marker',
          html: `
            <div class="pulse-container">
              <div class="pulse" style="background-color: #0066CC"></div>
              <img src="assets/forFlood.png" class="marker-icon" />
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
            <p><strong>Type:</strong> Flood</p>
            <p><strong>Distance:</strong> ${((center as any).distance / 1000).toFixed(2)} km</p>
            <p><strong>Capacity:</strong> ${center.capacity || 'N/A'}</p>
          </div>
        `);

        marker.addTo(this.map);
        this.nearestMarkers.push(marker);
      }
    });
  }

  clearRoutes() {
    // Remove route layer
    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }

    // Remove nearest markers
    if (this.nearestMarkers) {
      this.nearestMarkers.forEach(marker => {
        this.map.removeLayer(marker);
      });
      this.nearestMarkers = [];
    }

    // Clear any remaining route layers by checking all map layers
    this.map.eachLayer((layer: any) => {
      if (layer instanceof L.GeoJSON ||
          layer instanceof L.Polyline ||
          (layer.options && (
            layer.options.color === '#0066CC' ||
            layer.options.color === '#17a2b8' ||
            layer.options.color === '#3880ff' ||
            layer.isRouteLayer
          ))) {
        this.map.removeLayer(layer);
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
          console.log(`🔵 FLOOD MAP: Creating Mapbox route to center ${i + 1}: ${center.name}`);

          // Use Mapbox routing for accurate routes with selected travel mode
          const mapboxProfile = this.mapboxRouting.convertTravelModeToProfile(this.travelMode);

          const routeData = await this.mapboxRouting.getDirections(
            this.userLocation.lng, this.userLocation.lat,
            lng, lat,
            mapboxProfile
          );

          if (routeData && routeData.routes && routeData.routes.length > 0) {
            const route = routeData.routes[0];

            // Draw route with flood color
            const routeLine = L.polyline(
              route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]),
              {
                color: '#0066CC', // Blue for flood
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

            console.log(`✅ FLOOD MAP: Added Mapbox route to ${center.name} (${(route.distance/1000).toFixed(2)}km, ${(route.duration/60).toFixed(0)}min)`);
          }
        } catch (error) {
          console.error(`🔵 Error calculating Mapbox route to center ${i + 1}:`, error);
          // Skip fallback straight line - only show proper Mapbox routes
        }
      }
    }
  }

  async calculateRoute(center: EvacuationCenter, travelMode: string) {
    try {
      if (!this.userLocation) {
        console.error('🔵 FLOOD MAP: No user location available for routing');
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

        // Clear existing routes first
        this.clearRoutes();

        // Create route layer if it doesn't exist
        if (!this.routeLayer) {
          this.routeLayer = L.layerGroup().addTo(this.map);
        }

        // Add route to route layer with flood color (blue)
        const routeLayer = L.geoJSON(routeGeoJSON as any, {
          style: {
            color: '#0066CC', // Blue for flood
            weight: 4,
            opacity: 0.8
          }
        });

        // Mark as route layer for easier identification
        (routeLayer as any).isRouteLayer = true;
        routeLayer.addTo(this.routeLayer);

        console.log(`🔵 FLOOD MAP: Route added to ${center.name}`);
      }
    } catch (error) {
      console.error('🔵 FLOOD MAP: Error calculating route:', error);
    }
  }

  // Show offline marker information when clicked in offline mode
  async showOfflineMarkerInfo(center: EvacuationCenter, distance: number) {
    const alert = await this.alertCtrl.create({
      header: `📱 ${center.name}`,
      message: `
        <div style="text-align: left;">
          <p><strong>Type:</strong> Flood Center</p>
          <p><strong>Distance:</strong> ${(distance / 1000).toFixed(2)} km</p>
          <p><strong>Address:</strong> ${center.address || 'N/A'}</p>
          <p><strong>Capacity:</strong> ${center.capacity || 'N/A'}</p>
          <p><strong>Status:</strong> ${center.status || 'N/A'}</p>
          <br>
          <p><em>📱 Offline Mode: Routing not available. Use external navigation apps for directions.</em></p>
        </div>
      `,
      buttons: [
        {
          text: 'Open in Maps',
          handler: () => {
            this.openInExternalMaps(center);
          }
        },
        {
          text: 'Close',
          role: 'cancel'
        }
      ]
    });

    await alert.present();
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

  // Show navigation panel when marker is clicked
  async showNavigationPanel(center: EvacuationCenter) {
    console.log('🌊 FLOOD: showNavigationPanel called for:', center.name);
    console.log('🌊 FLOOD: Setting selectedCenter to:', center);

    this.selectedCenter = center;
    this.selectedTransportMode = null;
    this.routeInfo = {};

    console.log('🌊 FLOOD: selectedCenter is now:', this.selectedCenter);

    // Calculate routes for all transport modes
    await this.calculateAllRoutes(center);
  }

  // Close navigation panel
  closeNavigationPanel() {
    this.selectedCenter = null;
    this.selectedTransportMode = null;
    this.showRouteFooter = false;
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
        // Use Mapbox for route calculation
        const mapboxProfile = this.mapboxRouting.convertTravelModeToProfile(mode);
        const response = await this.mapboxRouting.getDirections(
          this.userLocation.lng, this.userLocation.lat,
          Number(center.longitude), Number(center.latitude),
          mapboxProfile
        );

        if (response.routes && response.routes.length > 0) {
          const route = response.routes[0];
          this.routeInfo[mode] = {
            duration: route.duration,
            distance: route.distance
          };
          console.log(`🌊 FLOOD: ${mode} route calculated - ${(route.distance/1000).toFixed(2)}km, ${Math.round(route.duration/60)}min`);
        }
      } catch (error) {
        console.error(`🌊 FLOOD: Error calculating ${mode} route:`, error);
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

        // Create route layer if it doesn't exist
        if (!this.routeLayer) {
          this.routeLayer = L.layerGroup().addTo(this.map);
        }

        // Add route to route layer with flood color (blue)
        const routeLayer = L.geoJSON(routeGeoJSON as any, {
          style: {
            color: '#0066CC', // Blue for flood
            weight: 4,
            opacity: 0.8
          }
        });

        // Mark as route layer for easier identification
        (routeLayer as any).isRouteLayer = true;
        routeLayer.addTo(this.routeLayer);
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
      color: 'primary',
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

      console.log(`🌊 FLOOD: Creating Mapbox route to ${center.name} via ${travelMode}`);

      // Use Mapbox routing for accurate routes
      const mapboxProfile = this.mapboxRouting.convertTravelModeToProfile(travelMode);
      const routeData = await this.mapboxRouting.getDirections(
        this.userLocation.lng, this.userLocation.lat,
        Number(center.longitude), Number(center.latitude),
        mapboxProfile
      );

      if (routeData && routeData.routes && routeData.routes.length > 0) {
        const route = routeData.routes[0];

        // Use flood color (blue)
        const routeColor = '#0066CC';

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
          message: `🔵 Route: ${(route.distance/1000).toFixed(2)}km, ${(route.duration/60).toFixed(0)}min via ${travelMode}`,
          duration: 4000,
          color: 'primary'
        });
        await toast.present();

        // Fit map to route
        this.map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });

        console.log(`✅ FLOOD: Successfully created route with ${route.geometry.coordinates.length} points`);
      }
    } catch (error) {
      console.error('🌊 Error routing to flood center:', error);

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

  // Helper method for ion-segment change event
  onTravelModeChange(event: any) {
    const mode = event.detail.value as 'walking' | 'cycling' | 'driving';
    this.changeTravelMode(mode);
  }

  // Change travel mode (like all-maps)
  async changeTravelMode(mode: 'walking' | 'cycling' | 'driving') {
    this.travelMode = mode;

    const toast = await this.toastCtrl.create({
      message: `🔵 Travel mode changed to ${mode}`,
      duration: 2000,
      color: 'primary'
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
        'flood-map',
        this.map,
        'Flood',
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
        message: '🌊 Calculating routes to nearest flood centers...',
        duration: 2000,
        color: 'primary'
      });
      await toast.present();

      await this.routeToTwoNearestCenters();
    } catch (error) {
      console.error('🌊 Error routing to nearest centers:', error);
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



  // Add navigateWithMode method
  navigateWithMode(mode: 'walking' | 'cycling' | 'driving') {
    this.selectedTransportMode = mode;
    this.showRouteFooter = true;
    if (this.selectedCenter) {
      this.showRouteOnMap(this.selectedCenter, mode);
    }
  }

  // Add tile layer with fallback options for better reliability
  private addTileLayerWithFallback() {
    const tileProviders = [
      {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© OpenStreetMap contributors',
        name: 'OpenStreetMap'
      },
      {
        url: 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
        attribution: '© OpenStreetMap contributors, © CartoDB',
        name: 'CartoDB Light'
      },
      {
        url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
        attribution: '© OpenStreetMap contributors, © OpenStreetMap France',
        name: 'OpenStreetMap France'
      }
    ];

    let currentProviderIndex = 0;
    let tileLayer: L.TileLayer | null = null;

    const tryNextProvider = () => {
      if (currentProviderIndex >= tileProviders.length) {
        console.error('🔵 FLOOD MAP: All tile providers failed, using offline placeholder');
        this.addOfflinePlaceholder();
        return;
      }

      const provider = tileProviders[currentProviderIndex];
      console.log(`🔵 FLOOD MAP: Trying tile provider: ${provider.name}`);

      if (tileLayer) {
        this.map.removeLayer(tileLayer);
      }

      tileLayer = L.tileLayer(provider.url, {
        attribution: provider.attribution,
        maxZoom: 19,
        errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' // Transparent 1x1 pixel
      });

      tileLayer.on('tileerror', (e: any) => {
        console.warn(`🔵 FLOOD MAP: Tile error with ${provider.name}:`, e);
        currentProviderIndex++;
        setTimeout(tryNextProvider, 1000); // Wait 1 second before trying next provider
      });

      tileLayer.on('tileload', () => {
        console.log(`🔵 FLOOD MAP: Successfully loaded tiles from ${provider.name}`);
      });

      tileLayer.addTo(this.map);
    };

    tryNextProvider();
  }

  // Add offline placeholder when all tile providers fail
  private addOfflinePlaceholder() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#999';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Map tiles', 128, 120);
      ctx.fillText('unavailable', 128, 140);
    }

    const placeholderUrl = canvas.toDataURL();

    L.tileLayer(placeholderUrl, {
      attribution: 'Offline Mode - Map tiles unavailable'
    }).addTo(this.map);
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
  async startRealTimeNavigation(center: EvacuationCenter) {
    console.log('🧭 Starting real-time navigation to flood center:', center.name);

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

    console.log('✅ Flood map real-time navigation setup complete');
  }

  onNavigationRouteUpdated(route: Route) {
    console.log('🔄 Flood map navigation route updated');
    this.currentNavigationRoute = route;
    this.updateMapWithNavigationRoute(route);
  }

  onNavigationStopped() {
    console.log('⏹️ Flood map real-time navigation stopped');
    this.isRealTimeNavigationActive = false;
    this.navigationDestination = null;
    this.currentNavigationRoute = null;
    this.clearNavigationRoute();

    this.toastCtrl.create({
      message: '⏹️ Navigation stopped',
      duration: 2000,
      color: 'medium'
    }).then(toast => toast.present());
  }

  private updateMapWithNavigationRoute(route: Route) {
    this.clearNavigationRoute();

    if (route.geometry && route.geometry.coordinates) {
      const routeGeoJSON = this.osmRouting.convertToGeoJSON(route);

      const navigationRoute = L.geoJSON(routeGeoJSON, {
        style: {
          color: '#17a2b8', // Flood cyan color
          weight: 6,
          opacity: 0.8,
          dashArray: '10, 5'
        }
      }).addTo(this.map);

      (navigationRoute as any).isNavigationRoute = true;
    }
  }

  private clearNavigationRoute() {
    this.map.eachLayer((layer: any) => {
      if (layer.isNavigationRoute) {
        this.map.removeLayer(layer);
      }
    });
  }
}
