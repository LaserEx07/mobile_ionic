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
import { RealTimeNavigationComponent } from '../../components/real-time-navigation/real-time-navigation.component';

import { EnhancedDownloadService } from '../../services/enhanced-download.service';
import * as L from 'leaflet';

import { EvacuationCenter } from '../../interfaces/evacuation-center.interface';

@Component({
  selector: 'app-landslide-map',
  templateUrl: './landslide-map.page.html',
  styleUrls: ['./landslide-map.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RealTimeNavigationComponent]
})
export class LandslideMapPage implements OnInit, AfterViewInit {
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

  // UI panel properties
  public showAllCentersPanel = false;
  public showRouteFooter = false;

  // Travel mode for routing (like all-maps)
  public travelMode: 'walking' | 'cycling' | 'driving' = 'walking';
  public routeTime: number = 0;
  public routeDistance: number = 0;

  // Navigation properties
  public selectedCenter: EvacuationCenter | null = null;
  public selectedTransportMode: 'walking' | 'cycling' | 'driving' = 'walking';
  public routeInfo: {
    walking?: { duration: number; distance: number };
    cycling?: { duration: number; distance: number };
    driving?: { duration: number; distance: number };
  } = {};

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
    console.log('🏔️ LANDSLIDE MAP: Component initialized...');
    // Don't initialize map here - wait for view to be ready

    // Check for query parameters to highlight new center or emergency navigation
    this.route.queryParams.subscribe((params: any) => {
      if (params['newCenterId']) {
        this.newCenterId = params['newCenterId'];
        this.highlightCenter = params['highlightCenter'] === 'true';
        this.centerLat = params['centerLat'] ? parseFloat(params['centerLat']) : null;
        this.centerLng = params['centerLng'] ? parseFloat(params['centerLng']) : null;
        console.log('🏔️ LANDSLIDE MAP: New center to highlight:', this.newCenterId);
      }

      // Handle emergency navigation from notifications
      if (params['emergency'] === 'true' && params['autoRoute'] === 'true') {
        console.log('🚨 Emergency navigation triggered for landslide map');

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
    console.log('🏔️ LANDSLIDE MAP: View initialized, loading map...');
    // Small delay to ensure DOM is fully rendered
    setTimeout(async () => {
      await this.loadLandslideMap();
    }, 100);
  }

  async loadLandslideMap() {
    const loading = await this.loadingCtrl.create({
      message: 'Loading landslide evacuation centers...',
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

      console.log(`🏔️ LANDSLIDE MAP: User location [${userLat}, ${userLng}]`);

      // Initialize map
      this.initializeMap(userLat, userLng);

      // Load ONLY landslide centers and auto-route
      await this.loadLandslideCenters(userLat, userLng);

      await loading.dismiss();

      // Show success message
      const toast = await this.toastCtrl.create({
        message: `🏔️ Showing ${this.evacuationCenters.length} landslide evacuation centers`,
        duration: 3000,
        color: 'tertiary',
        position: 'top'
      });
      await toast.present();

    } catch (error) {
      await loading.dismiss();
      console.error('🏔️ LANDSLIDE MAP: Error loading map', error);

      const alert = await this.alertCtrl.create({
        header: 'Location Error',
        message: 'Unable to get your location. Please enable GPS and try again.',
        buttons: [
          {
            text: 'Retry',
            handler: () => this.loadLandslideMap()
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
    console.log(`🏔️ LANDSLIDE MAP: Initializing map at [${lat}, ${lng}]`);

    // Check if container exists
    const container = document.getElementById('landslide-map');
    if (!container) {
      console.error('🏔️ LANDSLIDE MAP: Container #landslide-map not found!');
      throw new Error('Map container not found. Please ensure the view is properly loaded.');
    }

    if (this.map) {
      this.map.remove();
    }

    this.map = L.map('landslide-map').setView([lat, lng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'OpenStreetMap contributors'
    }).addTo(this.map);

    // Add user marker
    this.userMarker = L.marker([lat, lng], {
      icon: L.icon({
        iconUrl: 'assets/myLocation.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      })
    }).addTo(this.map);

    this.userMarker.bindPopup('📍 You are here!').openPopup();
  }

  async loadLandslideCenters(userLat: number, userLng: number) {
    try {
      console.log('🏔️ LANDSLIDE MAP: Fetching landslide centers...');

      let allCenters: EvacuationCenter[] = [];

      // Fetch data from API
      try {
        const apiResponse = await firstValueFrom(
          this.http.get<{success: boolean, data: EvacuationCenter[], count: number}>(`${environment.apiUrl}/evacuation-centers`)
        );
        allCenters = apiResponse.data || [];
        console.log('🏔️ LANDSLIDE MAP: Total centers received from API:', allCenters?.length || 0);
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

      // Filter for LANDSLIDE ONLY - handle both array and string formats
      this.evacuationCenters = allCenters.filter(center => {
        if (Array.isArray(center.disaster_type)) {
          // Check if the array contains exactly 'Landslide' (case-sensitive)
          return center.disaster_type.some(type => type === 'Landslide');
        }
        return center.disaster_type === 'Landslide';
      });

      console.log(`🏔️ LANDSLIDE MAP: Filtered to ${this.evacuationCenters.length} landslide centers`);
      console.log('🏔️ LANDSLIDE MAP: Filtered centers:', this.evacuationCenters.map(c => `${c.name} (${JSON.stringify(c.disaster_type)})`));

      console.log(`🏔️ LANDSLIDE MAP: Filtered to ${this.evacuationCenters.length} landslide centers`);

      if (this.evacuationCenters.length === 0) {
        const alert = await this.alertCtrl.create({
          header: 'No Landslide Centers',
          message: 'No landslide evacuation centers found in the data.',
          buttons: ['OK']
        });
        await alert.present();
        return;
      }

      // Add markers and routes
      await this.addMarkersAndRoutes(userLat, userLng);

    } catch (error) {
      console.error('🏔️ LANDSLIDE MAP: Error loading centers', error);

      const toast = await this.toastCtrl.create({
        message: 'Error loading landslide centers. Please check your internet connection.',
        duration: 4000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  // Add markers and routes to map
  async addMarkersAndRoutes(userLat: number, userLng: number) {

    // Add landslide markers (brown)
    this.evacuationCenters.forEach(center => {
      const lat = Number(center.latitude);
      const lng = Number(center.longitude);

      if (!isNaN(lat) && !isNaN(lng)) {
        const marker = L.marker([lat, lng], {
          icon: L.icon({
            iconUrl: 'assets/forLandslide.png',
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, -40]
          })
        });

        const distance = this.calculateDistance(userLat, userLng, lat, lng);

        // Make marker clickable with navigation panel
        marker.on('click', () => {
          console.log('🏔️ LANDSLIDE: Marker clicked for center:', center.name);
          if (center.routing_available === false) {
            // Show alert for full centers
            this.alertCtrl.create({
              header: 'Center Full',
              message: `${center.name} is currently full. Routing is not available.`,
              buttons: ['OK']
            }).then(alert => alert.present());
          } else {
            this.showNavigationPanel(center);
          }
        });

        // Check if this is the new center to highlight
        const isNewCenter = this.newCenterId && center.id.toString() === this.newCenterId;

        // Determine status display and routing availability
        const statusDisplay = center.status || 'Active';
        const isFullCenter = center.routing_available === false;
        const statusIcon = isFullCenter ? '🔴' : '🏔️';
        const routingText = isFullCenter ?
          '<p><em>⚠️ Center is Full - No routing available</em></p>' :
          '<p><em>Click marker for route options</em></p>';

        marker.bindPopup(`
          <div class="evacuation-popup">
            <h3>${statusIcon} ${center.name} ${isNewCenter ? '⭐ NEW!' : ''}</h3>
            <p><strong>Type:</strong> Landslide Center</p>
            <p><strong>Status:</strong> ${statusDisplay}</p>
            <p><strong>Distance:</strong> ${(distance / 1000).toFixed(2)} km</p>
            <p><strong>Capacity:</strong> ${center.capacity || 'N/A'}</p>
            ${routingText}
            ${isNewCenter ? '<p><strong>🆕 Recently Added!</strong></p>' : ''}
          </div>
        `);

        // If this is the new center, open its popup and center map on it
        if (isNewCenter) {
          marker.openPopup();
          this.map.setView([lat, lng], 15); // Zoom in on the new center

          // Show a toast notification
          this.toastCtrl.create({
            message: `🆕 New landslide evacuation center: ${center.name}`,
            duration: 5000,
            color: 'tertiary',
            position: 'top'
          }).then(toast => toast.present());
        }

        marker.addTo(this.map);
        console.log(`🏔️ Added landslide marker: ${center.name}`);
      }
    });

    // Don't auto-route - just show simple markers like "See Whole Map"
    console.log('🏔️ Showing simple markers without auto-routing...');
    // await this.routeToTwoNearestCenters();

    // Fit map to show all landslide centers
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

  // Auto-route to 2 nearest landslide centers
  async routeToTwoNearestCenters() {
    if (!this.userLocation || this.evacuationCenters.length === 0) {
      console.log('🏔️ LANDSLIDE MAP: No user location or evacuation centers available');
      return;
    }

    try {
      console.log('🏔️ LANDSLIDE MAP: Finding 2 nearest landslide centers...');

      // Find 2 nearest centers
      const nearestCenters = this.getTwoNearestCenters(
        this.userLocation.lat,
        this.userLocation.lng
      );

      if (nearestCenters.length === 0) {
        const toast = await this.toastCtrl.create({
          message: 'No landslide evacuation centers found nearby',
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
        message: `🏔️ Showing routes to ${nearestCenters.length} nearest landslide centers`,
        duration: 4000,
        color: 'tertiary'
      });
      await toast.present();

    } catch (error) {
      console.error('🏔️ LANDSLIDE MAP: Error calculating routes', error);
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
        // Create pulsing marker with landslide styling
        const pulsingIcon = L.divIcon({
          className: 'pulsing-marker',
          html: `
            <div class="pulse-container">
              <div class="pulse" style="background-color: #8b5a2b"></div>
              <img src="assets/forLandslide.png" class="marker-icon" />
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
            <p><strong>Type:</strong> Landslide</p>
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
          console.log(`🏔️ LANDSLIDE MAP: Creating Mapbox route to center ${i + 1}: ${center.name}`);

          // Use Mapbox routing for accurate routes with selected travel mode
          const mapboxProfile = this.mapboxRouting.convertTravelModeToProfile(this.travelMode);

          const routeData = await this.mapboxRouting.getDirections(
            this.userLocation.lng, this.userLocation.lat,
            lng, lat,
            mapboxProfile
          );

          if (routeData && routeData.routes && routeData.routes.length > 0) {
            const route = routeData.routes[0];

            // Draw route with landslide color
            const routeLine = L.polyline(
              route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]),
              {
                color: '#8b5a2b', // Brown for landslide
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

            console.log(`✅ LANDSLIDE MAP: Added Mapbox route to ${center.name} (${(route.distance/1000).toFixed(2)}km, ${(route.duration/60).toFixed(0)}min)`);
          }
        } catch (error) {
          console.error(`🏔️ Error calculating Mapbox route to center ${i + 1}:`, error);
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
            layer.options.color === '#8b5a2b' ||
            layer.options.color === '#8b5a2b' ||
            layer.isRouteLayer ||
            layer.isNavigationRoute
          ))) {
        this.map.removeLayer(layer);
      }
    });
  }

  // Show offline marker information when clicked in offline mode
  async showOfflineMarkerInfo(center: EvacuationCenter, distance: number) {
    const alert = await this.alertCtrl.create({
      header: `📱 ${center.name}`,
      message: `
        <div style="text-align: left;">
          <p><strong>Type:</strong> Landslide Center</p>
          <p><strong>Distance:</strong> ${(distance / 1000).toFixed(2)} km</p>
          <p><strong>Capacity:</strong> ${center.capacity || 'N/A'}</p>
          <p><strong>Address:</strong> ${center.address || 'N/A'}</p>
          <br>
          <p><em>📱 Offline Mode: Navigation features are limited</em></p>
        </div>
      `,
      buttons: ['OK']
    });
    await alert.present();
  }

  // Show navigation panel for online mode
  async showNavigationPanel(center: EvacuationCenter) {
    console.log('🏔️ LANDSLIDE: showNavigationPanel called for:', center.name);
    console.log('🏔️ LANDSLIDE: Setting selectedCenter to:', center);

    this.selectedCenter = center;
    this.selectedTransportMode = 'walking';
    this.routeInfo = {};

    console.log('🏔️ LANDSLIDE: selectedCenter is now:', this.selectedCenter);

    // Calculate routes for all transport modes
    await this.calculateAllRoutes(center);
  }

  // Calculate routes for all transport modes
  async calculateAllRoutes(center: EvacuationCenter) {
    if (!this.userLocation) return;

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
        console.error(`🏔️ Error calculating ${mode} route:`, error);
      }
    }
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

        // Use landslide color (brown)
        const routeColor = '#8b5a2b';

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
          message: `🏔️ Route: ${(route.distance/1000).toFixed(2)}km, ${(route.duration/60).toFixed(0)}min via ${mode}`,
          duration: 4000,
          color: 'tertiary'
        });
        await toast.present();

        // Fit map to route
        this.map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
      }
    } catch (error) {
      console.error('🏔️ Error showing route:', error);
      const toast = await this.toastCtrl.create({
        message: 'Error calculating route. Please try again.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
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
      message: `🏔️ Travel mode changed to ${mode}`,
      duration: 2000,
      color: 'tertiary'
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
        'landslide-map',
        this.map,
        'Landslide',
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
      // Clear existing routes
      this.clearRoutes();

      // Find and route to 2 nearest centers
      await this.routeToTwoNearestCenters();

      const toast = await this.toastCtrl.create({
        message: '🏔️ Routes calculated to 2 nearest landslide evacuation centers',
        duration: 4000,
        color: 'tertiary'
      });
      await toast.present();
    } catch (error) {
      console.error('Error calculating routes:', error);
      const toast = await this.toastCtrl.create({
        message: 'Failed to calculate routes. Please try again.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  // Select center from all centers list
  selectCenterFromList(center: EvacuationCenter) {
    this.closeAllCentersPanel();
    this.openNavigationPanel(center);
  }

  // Calculate distance in km for display
  calculateDistanceInKm(center: EvacuationCenter): string {
    if (!this.userLocation) return 'N/A';

    const distance = this.calculateDistance(
      this.userLocation.lat,
      this.userLocation.lng,
      Number(center.latitude),
      Number(center.longitude)
    );

    return (distance / 1000).toFixed(1);
  }

  // Open navigation panel when marker is clicked
  openNavigationPanel(center: EvacuationCenter) {
    this.selectedCenter = center;
    this.showRouteFooter = true;
    this.calculateRouteInfo(center);
  }

  // Close navigation panel
  closeNavigationPanel() {
    this.selectedCenter = null;
    this.showRouteFooter = false;
    this.routeInfo = {};
  }

  // Select transport mode
  selectTransportMode(mode: 'walking' | 'cycling' | 'driving') {
    this.selectedTransportMode = mode;
    if (this.selectedCenter) {
      this.showRouteOnMap(this.selectedCenter, mode);
    }
  }

  // Calculate route info for all transport modes
  async calculateRouteInfo(center: EvacuationCenter) {
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
          console.log(`🏔️ LANDSLIDE: ${mode} route calculated - ${(route.distance/1000).toFixed(2)}km, ${Math.round(route.duration/60)}min`);
        }
      } catch (error) {
        console.error(`🏔️ LANDSLIDE: Error calculating ${mode} route:`, error);
        // Fallback to straight-line distance
        const distance = this.calculateDistance(
          this.userLocation.lat, this.userLocation.lng,
          Number(center.latitude), Number(center.longitude)
        );
        this.routeInfo[mode] = {
          duration: distance / (mode === 'walking' ? 5000 : mode === 'cycling' ? 15000 : 50000) * 3600,
          distance: distance
        };
      }
    }
  }

  // Show route on map for selected transport mode
  async showRouteOnMap(center: EvacuationCenter, mode: 'walking' | 'cycling' | 'driving') {
    if (!this.userLocation) return;

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
        const routeGeoJSON = this.mapboxRouting.convertToGeoJSON(route);

        // Clear existing routes
        this.clearRoutes();

        // Create route layer if it doesn't exist
        if (!this.routeLayer) {
          this.routeLayer = L.layerGroup().addTo(this.map);
        }

        // Add route to route layer with landslide color (brown)
        const routeLayer = L.geoJSON(routeGeoJSON as any, {
          style: {
            color: '#8b5a2b', // Brown for landslide
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



  ionViewWillEnter() {
    console.log('🏔️ LANDSLIDE MAP: View will enter - refreshing data...');
    // Refresh evacuation centers data when entering the page
    if (this.map && this.userLocation) {
      this.loadLandslideCenters(this.userLocation.lat, this.userLocation.lng);
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
        console.log(`🏔️ LANDSLIDE: Creating Mapbox route to ${center.name} via ${travelMode}`);

        // Use Mapbox routing for accurate routes
        const mapboxProfile = this.mapboxRouting.convertTravelModeToProfile(travelMode);

        const routeData = await this.mapboxRouting.getDirections(
          this.userLocation.lng, this.userLocation.lat,
          lng, lat,
          mapboxProfile
        );

        if (routeData && routeData.routes && routeData.routes.length > 0) {
          const route = routeData.routes[0];

          // Use landslide color (brown)
          const routeColor = '#8b5a2b';

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
            message: `🏔️ Route: ${(route.distance/1000).toFixed(2)}km, ${(route.duration/60).toFixed(0)}min via ${travelMode}`,
            duration: 4000,
            color: 'warning'
          });
          await toast.present();

          // Fit map to route
          this.map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });

          console.log(`✅ LANDSLIDE: Successfully created route with ${route.geometry.coordinates.length} points`);
        }
      }
    } catch (error) {
      console.error('🏔️ Error routing to landslide center:', error);

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
    console.log('🧭 Starting real-time navigation to landslide center:', center.name);

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

    console.log('✅ Landslide map real-time navigation setup complete');
  }

  onNavigationRouteUpdated(route: Route) {
    console.log('🔄 Landslide map navigation route updated');
    this.currentNavigationRoute = route;
    this.updateMapWithNavigationRoute(route);
  }

  onNavigationStopped() {
    console.log('⏹️ Landslide map real-time navigation stopped');
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
          color: '#8b5a2b', // Landslide brown color
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

  /**
   * Show emergency alert for notification-triggered navigation
   */
  private async showNotificationEmergencyAlert(params: any): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '⛰️ LANDSLIDE EMERGENCY',
      subHeader: params['title'] || 'Emergency Notification',
      message: `
        <div style="text-align: left;">
          <p><strong>Alert:</strong> ${params['message'] || 'Landslide emergency detected'}</p>
          <p><strong>Severity:</strong> ${(params['severity'] || 'medium').toUpperCase()}</p>
          <p><strong>Action:</strong> Routing to nearest landslide evacuation centers</p>
        </div>
      `,
      buttons: [
        {
          text: 'Navigate Now',
          role: 'confirm',
          cssClass: 'alert-button-confirm',
          handler: () => {
            console.log('🚨 User confirmed emergency navigation for landslide');
            // Emergency routing will be triggered by shouldAutoRouteEmergency flag
          }
        },
        {
          text: 'View Map Only',
          role: 'cancel',
          cssClass: 'alert-button-cancel',
          handler: () => {
            console.log('📍 User chose to view landslide map without auto-routing');
            this.shouldAutoRouteEmergency = false;
          }
        }
      ],
      cssClass: 'emergency-alert'
    });

    await alert.present();
  }
}
