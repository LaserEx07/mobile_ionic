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

import { EnhancedDownloadService } from '../../services/enhanced-download.service';
import { OpenStreetMapRoutingService, Route } from '../../services/openstreetmap-routing.service';
import { MapboxRoutingService } from '../../services/mapbox-routing.service';
import { RealTimeNavigationComponent } from '../../components/real-time-navigation/real-time-navigation.component';
import { EvacuationCenter } from '../../interfaces/evacuation-center.interface';

@Component({
  selector: 'app-typhoon-map',
  templateUrl: './typhoon-map.page.html',
  styleUrls: ['./typhoon-map.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RealTimeNavigationComponent]
})
export class TyphoonMapPage implements OnInit, AfterViewInit {
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

  // Emergency navigation flag
  public shouldAutoRouteEmergency: boolean = false;

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

  private loadingCtrl = inject(LoadingController);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  private enhancedDownload = inject(EnhancedDownloadService);
  private osmRouting = inject(OpenStreetMapRoutingService);
  private mapboxRouting = inject(MapboxRoutingService);

  ngOnInit() {
    console.log('🟢 TYPHOON MAP: Component initialized...');
    // Don't initialize map here - wait for view to be ready

    // Check for query parameters to highlight new center or emergency navigation
    this.route.queryParams.subscribe((params: any) => {
      if (params['newCenterId']) {
        this.newCenterId = params['newCenterId'];
        this.highlightCenter = params['highlightCenter'] === 'true';
        this.centerLat = params['centerLat'] ? parseFloat(params['centerLat']) : null;
        this.centerLng = params['centerLng'] ? parseFloat(params['centerLng']) : null;
        console.log('🟢 TYPHOON MAP: New center to highlight:', this.newCenterId);
      }

      // Handle emergency navigation
      if (params['emergency'] === 'true' && params['autoRoute'] === 'true') {
        console.log('🚨 Emergency navigation triggered for typhoon map');

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
        iconUrl: 'assets/myLocation.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32]
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
            console.log('🌀 TYPHOON: Marker clicked for center:', center.name);
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
          const statusIcon = isFullCenter ? '🔴' : '🟢';
          const routingText = isFullCenter ?
            '<p><em>⚠️ Center is Full - No routing available</em></p>' :
            '<p><em>Click marker for route options</em></p>';

          // Create contact info display
          let contactInfo = '';
          if (center.contact) {
            if (typeof center.contact === 'string') {
              contactInfo = `<p><strong>📞 Contact:</strong> ${center.contact}</p>`;
            } else if (Array.isArray(center.contact)) {
              const contacts = center.contact.map((c: any) => `${c.number} (${c.network})`).join(', ');
              contactInfo = `<p><strong>📞 Contact:</strong> ${contacts}</p>`;
            }
          }

          marker.bindPopup(`
            <div class="evacuation-popup">
              <h3>${statusIcon} ${center.name} ${isNewCenter ? '⭐ NEW!' : ''}</h3>
              <p><strong>Type:</strong> Typhoon Center</p>
              <p><strong>Status:</strong> ${statusDisplay}</p>
              <p><strong>Distance:</strong> ${(distance / 1000).toFixed(2)} km</p>
              <p><strong>Capacity:</strong> ${center.capacity || 'N/A'}</p>
              ${contactInfo}
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

      // Don't auto-route - just show simple markers like "See Whole Map"
      console.log('🟢 Showing simple markers without auto-routing...');
      // await this.routeToTwoNearestCenters();

      // Handle emergency auto-routing
      if (this.shouldAutoRouteEmergency) {
        console.log('🚨 Performing emergency auto-routing to nearest typhoon evacuation centers');
        await this.performEmergencyRouting();
        this.shouldAutoRouteEmergency = false; // Reset flag
      }

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
        const toast = await this.toastCtrl.create({
          message: 'No typhoon evacuation centers found nearby',
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
        message: `🟢 Showing routes to ${nearestCenters.length} nearest typhoon centers`,
        duration: 4000,
        color: 'success'
      });
      await toast.present();

    } catch (error) {
      console.error('🟢 TYPHOON MAP: Error calculating routes', error);
      const toast = await this.toastCtrl.create({
        message: 'Failed to calculate routes. Please try again.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  // Emergency routing method for FCM notifications
  async performEmergencyRouting() {
    try {
      console.log('🚨 Starting emergency routing to nearest typhoon evacuation centers');

      // Show emergency routing toast
      const emergencyToast = await this.toastCtrl.create({
        message: '🚨 EMERGENCY: Routing to nearest typhoon evacuation centers',
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
        // Create pulsing marker with typhoon styling
        const pulsingIcon = L.divIcon({
          className: 'pulsing-marker',
          html: `
            <div class="pulse-container">
              <img src="assets/forTyphoon.png" class="marker-icon" />
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
            <p><strong>Type:</strong> Typhoon</p>
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
            layer.options.color === '#2dd36f' ||
            layer.options.color === '#008000' ||
            layer.options.color === '#007bff' ||
            layer.isRouteLayer ||
            layer.isNavigationRoute
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

      // Skip routing if not available for this center
      if (center.routing_available === false) {
        console.log(`🟢 TYPHOON MAP: Skipping route to ${center.name} - routing not available`);
        continue;
      }

      const lat = Number(center.latitude);
      const lng = Number(center.longitude);

      if (!isNaN(lat) && !isNaN(lng)) {
        try {
          console.log(`🟢 TYPHOON MAP: Creating Mapbox route to center ${i + 1}: ${center.name}`);

          // Use Mapbox routing for accurate routes with selected travel mode
          const mapboxProfile = this.mapboxRouting.convertTravelModeToProfile(this.travelMode);

          const routeData = await this.mapboxRouting.getDirections(
            this.userLocation.lng, this.userLocation.lat,
            lng, lat,
            mapboxProfile
          );

          if (routeData && routeData.routes && routeData.routes.length > 0) {
            const route = routeData.routes[0];

            // Draw route with typhoon color
            const routeLine = L.polyline(
              route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]),
              {
                color: '#2dd36f', // Green for typhoon
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

            console.log(`✅ TYPHOON MAP: Added Mapbox route to ${center.name} (${(route.distance/1000).toFixed(2)}km, ${(route.duration/60).toFixed(0)}min)`);
          }
        } catch (error) {
          console.error(`🟢 Error calculating Mapbox route to center ${i + 1}:`, error);
          // Skip fallback straight line - only show proper Mapbox routes
        }
      }
    }
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
          console.log(`🌀 TYPHOON: ${mode} route calculated - ${(route.distance/1000).toFixed(2)}km, ${Math.round(route.duration/60)}min`);
        }
      } catch (error) {
        console.error(`🌀 TYPHOON: Error calculating ${mode} route:`, error);
      }
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



  // Route to specific center with chosen transportation mode
  async routeToCenter(center: EvacuationCenter, travelMode: 'walking' | 'cycling' | 'driving') {
    if (!this.userLocation) return;

    try {
      // Clear existing routes
      this.clearRoutes();

      console.log(`🌀 TYPHOON: Creating Mapbox route to ${center.name} via ${travelMode}`);

      // Use Mapbox routing for accurate routes
      const mapboxProfile = this.mapboxRouting.convertTravelModeToProfile(travelMode);
      const routeData = await this.mapboxRouting.getDirections(
        this.userLocation.lng, this.userLocation.lat,
        Number(center.longitude), Number(center.latitude),
        mapboxProfile
      );

      if (routeData && routeData.routes && routeData.routes.length > 0) {
        const route = routeData.routes[0];

        // Use typhoon color (green)
        const routeColor = '#008000';

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
          message: `🟢 Route: ${(route.distance/1000).toFixed(2)}km, ${(route.duration/60).toFixed(0)}min via ${travelMode}`,
          duration: 4000,
          color: 'success'
        });
        await toast.present();

        // Fit map to route
        this.map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });

        console.log(`✅ TYPHOON: Successfully created route with ${route.geometry.coordinates.length} points`);
      }
    } catch (error) {
      console.error('🌀 Error routing to typhoon center:', error);

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
      message: `🟢 Travel mode changed to ${mode}`,
      duration: 2000,
      color: 'success'
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
        message: '🟢 Routes calculated to 2 nearest typhoon evacuation centers',
        duration: 4000,
        color: 'success'
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
    this.showNavigationPanel(center);
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

  // Show navigation panel when marker is clicked
  showNavigationPanel(center: EvacuationCenter) {
    console.log('🌀 TYPHOON: showNavigationPanel called for:', center.name);
    console.log('🌀 TYPHOON: Setting selectedCenter to:', center);

    this.selectedCenter = center;
    this.showRouteFooter = true;

    console.log('🌀 TYPHOON: selectedCenter is now:', this.selectedCenter);
    console.log('🌀 TYPHOON: showRouteFooter is now:', this.showRouteFooter);

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
          console.log(`🌀 TYPHOON: ${mode} route info calculated - ${(route.distance/1000).toFixed(2)}km, ${Math.round(route.duration/60)}min`);
        }
      } catch (error) {
        console.error(`🌀 TYPHOON: Error calculating ${mode} route info:`, error);
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

        // Add route to route layer with typhoon color (green)
        const routeLayer = L.geoJSON(routeGeoJSON as any, {
          style: {
            color: '#2dd36f', // Green for typhoon
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
    console.log('🌀 TYPHOON MAP: View will enter - refreshing data...');
    // Refresh evacuation centers data when entering the page
    if (this.map && this.userLocation) {
      this.loadTyphoonCenters(this.userLocation.lat, this.userLocation.lng);
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
  async startRealTimeNavigation(center: EvacuationCenter) {
    console.log('🧭 Starting real-time navigation to typhoon center:', center.name);

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

    console.log('✅ Typhoon map real-time navigation setup complete');
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
          color: '#2dd36f', // Typhoon green color (consistent with other routes)
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
      header: '🌪️ TYPHOON EMERGENCY',
      subHeader: params['title'] || 'Emergency Notification',
      message: `
        <div style="text-align: left;">
          <p><strong>Alert:</strong> ${params['message'] || 'Typhoon emergency detected'}</p>
          <p><strong>Severity:</strong> ${(params['severity'] || 'medium').toUpperCase()}</p>
          <p><strong>Action:</strong> Routing to nearest typhoon evacuation centers</p>
        </div>
      `,
      buttons: [
        {
          text: 'Navigate Now',
          role: 'confirm',
          cssClass: 'alert-button-confirm',
          handler: () => {
            console.log('🚨 User confirmed emergency navigation for typhoon');
            // Emergency routing will be triggered by shouldAutoRouteEmergency flag
          }
        },
        {
          text: 'View Map Only',
          role: 'cancel',
          cssClass: 'alert-button-cancel',
          handler: () => {
            console.log('📍 User chose to view typhoon map without auto-routing');
            this.shouldAutoRouteEmergency = false;
          }
        }
      ],
      cssClass: 'emergency-alert'
    });

    await alert.present();
  }
}
