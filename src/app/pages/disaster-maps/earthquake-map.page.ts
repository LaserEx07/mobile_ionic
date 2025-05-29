import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, LoadingController, ToastController, AlertController } from '@ionic/angular';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Geolocation } from '@capacitor/geolocation';
import { MapboxRoutingService } from '../../services/mapbox-routing.service';
import { OfflineStorageService } from '../../services/offline-storage.service';
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

  private loadingCtrl = inject(LoadingController);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private mapboxRouting = inject(MapboxRoutingService);
  private offlineStorage = inject(OfflineStorageService);

  ngOnInit() {
    console.log('🟠 EARTHQUAKE MAP: Component initialized...');
    // Don't initialize map here - wait for view to be ready

    // Check for query parameters to highlight new center
    this.route.queryParams.subscribe((params: any) => {
      if (params['newCenterId']) {
        this.newCenterId = params['newCenterId'];
        this.highlightCenter = params['highlightCenter'] === 'true';
        this.centerLat = params['centerLat'] ? parseFloat(params['centerLat']) : null;
        this.centerLng = params['centerLng'] ? parseFloat(params['centerLng']) : null;
        console.log('🟠 EARTHQUAKE MAP: New center to highlight:', this.newCenterId);
      }
    });
  }

  async ngAfterViewInit() {
    console.log('🟠 EARTHQUAKE MAP: View initialized, loading map...');
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
      // Get user location
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20000
      });

      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;

      this.userLocation = { lat: userLat, lng: userLng };

      console.log(`🟠 EARTHQUAKE MAP: User location [${userLat}, ${userLng}]`);

      // Initialize map
      this.initializeMap(userLat, userLng);

      // Load ONLY earthquake centers and auto-route
      await this.loadEarthquakeCenters(userLat, userLng);

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

      const alert = await this.alertCtrl.create({
        header: 'Location Error',
        message: 'Unable to get your location. Please enable GPS and try again.',
        buttons: [
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
    }
  }

  initializeMap(lat: number, lng: number) {
    console.log(`🟠 EARTHQUAKE MAP: Initializing map at [${lat}, ${lng}]`);

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

  async loadEarthquakeCenters(userLat: number, userLng: number) {
    try {
      console.log('🟠 EARTHQUAKE MAP: Fetching earthquake centers...');

      let allCenters: EvacuationCenter[] = [];

      // Check if offline mode is enabled or if we're offline
      if (this.offlineStorage.isOfflineMode() || !navigator.onLine) {
        console.log('🔄 Loading earthquake centers from offline storage');
        allCenters = await this.offlineStorage.getEvacuationCenters();
        console.log('📱 OFFLINE DATA:', allCenters);

        if (allCenters.length === 0) {
          console.warn('⚠️ No cached evacuation centers found');
          const alert = await this.alertCtrl.create({
            header: 'No Offline Data',
            message: 'No offline evacuation data available. Please sync data when online.',
            buttons: ['OK']
          });
          await alert.present();
          return;
        }
      } else {
        // Try to get data from API when online
        try {
          allCenters = await firstValueFrom(
            this.http.get<EvacuationCenter[]>(`${environment.apiUrl}/evacuation-centers`)
          );
          console.log('🟠 EARTHQUAKE MAP: Total centers received from API:', allCenters?.length || 0);
        } catch (apiError) {
          console.error('❌ API failed, falling back to offline data:', apiError);
          allCenters = await this.offlineStorage.getEvacuationCenters();

          if (allCenters.length === 0) {
            const alert = await this.alertCtrl.create({
              header: 'Connection Error',
              message: 'Cannot connect to server and no offline data available. Please check your connection or sync data when online.',
              buttons: ['OK']
            });
            await alert.present();
            return;
          }
        }
      }

      // Filter for EARTHQUAKE ONLY
      this.evacuationCenters = allCenters.filter(center =>
        center.disaster_type === 'Earthquake'
      );

      console.log(`🟠 EARTHQUAKE MAP: Filtered to ${this.evacuationCenters.length} earthquake centers`);

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

      // Try to load from offline storage as last resort
      try {
        console.log('🔄 Last resort: trying offline storage...');
        const offlineCenters = await this.offlineStorage.getEvacuationCenters();
        this.evacuationCenters = offlineCenters.filter(center =>
          center.disaster_type === 'Earthquake'
        );

        if (this.evacuationCenters.length > 0) {
          console.log(`🟠 Loaded ${this.evacuationCenters.length} earthquake centers from offline storage`);
          // Continue with adding markers...
          await this.addMarkersAndRoutes(userLat, userLng);
          return;
        }
      } catch (offlineError) {
        console.error('❌ Offline storage also failed:', offlineError);
      }

      const toast = await this.toastCtrl.create({
        message: 'Error loading earthquake centers. Please check your connection or sync offline data.',
        duration: 4000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  // Add markers and routes to map
  async addMarkersAndRoutes(userLat: number, userLng: number) {
    // Check if we're in offline mode
    const isOfflineMode = this.offlineStorage.isOfflineMode() || !navigator.onLine;

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

        // Make marker clickable with transportation options (only if online)
        marker.on('click', () => {
          if (isOfflineMode) {
            this.showOfflineMarkerInfo(center, distance);
          } else {
            this.showTransportationOptions(center);
          }
        });

        // Check if this is the new center to highlight
        const isNewCenter = this.newCenterId && center.id.toString() === this.newCenterId;

        // Create popup content based on online/offline status
        const offlineIndicator = isOfflineMode ? '<p><em>📱 Offline Mode - Limited functionality</em></p>' : '<p><em>Click marker for route options</em></p>';

        marker.bindPopup(`
          <div class="evacuation-popup">
            <h3>🟠 ${center.name} ${isNewCenter ? '⭐ NEW!' : ''}</h3>
            <p><strong>Type:</strong> Earthquake Center</p>
            <p><strong>Distance:</strong> ${(distance / 1000).toFixed(2)} km</p>
            <p><strong>Capacity:</strong> ${center.capacity || 'N/A'}</p>
            ${offlineIndicator}
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
        console.log(`🟠 Added earthquake marker: ${center.name}`);
      }
    });

    // Only auto-route if online
    if (!isOfflineMode) {
      console.log('🟠 Online mode: Auto-routing to 2 nearest earthquake centers...');
      await this.routeToTwoNearestCenters();
    } else {
      console.log('🟠 Offline mode: Showing markers only (no routing)');
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
          const mapboxProfile = this.mapboxRouting.convertTravelModeToProfile('walking');

          const routeData = await this.mapboxRouting.getDirections(
            this.userLocation.lng, this.userLocation.lat,
            lng, lat,
            mapboxProfile,
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

            console.log(`🟠 Route ${i + 1}: ${(route.distance/1000).toFixed(2)}km, ${(route.duration/60).toFixed(0)}min`);
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

  // Show offline marker information when clicked in offline mode
  async showOfflineMarkerInfo(center: EvacuationCenter, distance: number) {
    const alert = await this.alertCtrl.create({
      header: `📱 ${center.name}`,
      message: `
        <div style="text-align: left;">
          <p><strong>Type:</strong> Earthquake Center</p>
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

  // Show transportation options when marker is clicked (online mode)
  async showTransportationOptions(center: EvacuationCenter) {
    // Check if we're offline before showing transportation options
    const isOfflineMode = this.offlineStorage.isOfflineMode() || !navigator.onLine;

    if (isOfflineMode) {
      const distance = this.calculateDistance(
        this.userLocation?.lat || 0,
        this.userLocation?.lng || 0,
        Number(center.latitude),
        Number(center.longitude)
      );
      await this.showOfflineMarkerInfo(center, distance);
      return;
    }

    const alert = await this.alertCtrl.create({
      header: `Route to ${center.name}`,
      message: 'Choose your transportation mode:',
      buttons: [
        {
          text: '🚶‍♂️ Walk',
          handler: () => {
            this.routeToCenter(center, 'walking');
          }
        },
        {
          text: '🚴‍♂️ Cycle',
          handler: () => {
            this.routeToCenter(center, 'cycling');
          }
        },
        {
          text: '🚗 Drive',
          handler: () => {
            this.routeToCenter(center, 'driving');
          }
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });

    await alert.present();
  }

  // Route to specific center with chosen transportation mode
  async routeToCenter(center: EvacuationCenter, travelMode: 'walking' | 'cycling' | 'driving') {
    if (!this.userLocation) return;

    // Check if we're offline
    const isOfflineMode = this.offlineStorage.isOfflineMode() || !navigator.onLine;

    if (isOfflineMode) {
      console.log('🟠 Offline mode: Cannot calculate routes');
      const toast = await this.toastCtrl.create({
        message: '📱 Offline mode: Routing not available. Use external navigation apps.',
        duration: 4000,
        color: 'warning'
      });
      await toast.present();

      // Offer to open in external maps
      await this.openInExternalMaps(center);
      return;
    }

    try {
      // Clear existing routes
      this.clearRoutes();

      const lat = Number(center.latitude);
      const lng = Number(center.longitude);

      if (!isNaN(lat) && !isNaN(lng)) {
        const mapboxProfile = this.mapboxRouting.convertTravelModeToProfile(travelMode);

        const routeData = await this.mapboxRouting.getDirections(
          this.userLocation.lng, this.userLocation.lat,
          lng, lat,
          mapboxProfile,
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

  ionViewWillLeave() {
    this.clearRoutes();
    if (this.map) {
      this.map.remove();
    }
  }
}
