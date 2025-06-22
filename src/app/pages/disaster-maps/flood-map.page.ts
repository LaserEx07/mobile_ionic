import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, LoadingController, ToastController, AlertController } from '@ionic/angular';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Geolocation } from '@capacitor/geolocation';
import * as L from 'leaflet';
import { OpenStreetMapRoutingService } from '../../services/openstreetmap-routing.service';

import { EnhancedDownloadService } from '../../services/enhanced-download.service';

import { EvacuationCenter } from '../../interfaces/evacuation-center.interface';

@Component({
  selector: 'app-flood-map',
  templateUrl: './flood-map.page.html',
  styleUrls: ['./flood-map.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class FloodMapPage implements OnInit, AfterViewInit {
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

  private loadingCtrl = inject(LoadingController);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private osmRouting = inject(OpenStreetMapRoutingService);

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
        allCenters = await firstValueFrom(
          this.http.get<EvacuationCenter[]>(`${environment.apiUrl}/evacuation-centers`)
        );
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
          return center.disaster_type.includes('Flood');
        }
        return center.disaster_type === 'Flood';
      });

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
            this.openNavigationPanel(center);
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

      // Auto-route to nearest centers
      console.log('🔵 Auto-routing to 2 nearest flood centers...');
      await this.routeToTwoNearestCenters();

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
        return;
      }

      // Clear previous routes
      this.clearRoutes();

      // Calculate and display routes with flood color (blue)
      await this.calculateRoutes(nearestCenters);

    } catch (error) {
      console.error('🔵 FLOOD MAP: Error calculating routes', error);
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
    for (const center of centers) {
      await this.calculateRoute(center, 'walking'); // Default to walking
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

        // Add route to map with flood color (blue)
        L.geoJSON(routeGeoJSON as any, {
          style: {
            color: '#0066CC', // Blue for flood
            weight: 4,
            opacity: 0.8
          }
        }).addTo(this.map);

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

        // Add route to map with flood color (blue)
        L.geoJSON(routeGeoJSON as any, {
          style: {
            color: '#0066CC', // Blue for flood
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

      const osmProfile = this.osmRouting.convertTravelModeToProfile(travelMode);
      const routeData = await this.osmRouting.getDirections(
        this.userLocation.lng, this.userLocation.lat,
        Number(center.longitude), Number(center.latitude),
        osmProfile
      );

      if (routeData && routeData.routes && routeData.routes.length > 0) {
        const route = routeData.routes[0];

        // Use flood color (blue)
        const routeColor = '#0066CC';

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
          message: `🔵 Route: ${(route.distance/1000).toFixed(2)}km, ${(route.duration/60).toFixed(0)}min via ${travelMode}`,
          duration: 4000,
          color: 'primary'
        });
        await toast.present();

        // Fit map to route
        this.map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
      }
    } catch (error) {
      console.error('🔵 FLOOD MAP: Error calculating individual route:', error);

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
    if (this.map) {
      this.map.remove();
    }
  }
}
