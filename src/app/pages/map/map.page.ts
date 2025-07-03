import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { environment } from 'src/environments/environment';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController, ToastController, ModalController } from '@ionic/angular';
import { LoadingService } from '../../services/loading.service';
import { OpenStreetMapRoutingService } from '../../services/openstreetmap-routing.service';
import { MapboxRoutingService } from '../../services/mapbox-routing.service';
import * as L from 'leaflet';
import { Geolocation } from '@capacitor/geolocation';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { EvacuationCenterDetailsComponent } from './evacuation-center-details.component';
import { DirectionsPanelComponent } from './directions-panel.component';
import html2canvas from 'html2canvas';

import { EvacuationCenter } from '../../interfaces/evacuation-center.interface';
import { OfflineStorageService } from '../../services/offline-storage.service';

// Define GeolocationPosition interface to match Capacitor's Geolocation plugin
interface GeolocationPosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null;
    altitudeAccuracy: number | null | undefined;  // Added undefined to match browser API
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
}

@Component({
  selector: 'app-map',
  templateUrl: './map.page.html',
  styleUrls: ['./map.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, DirectionsPanelComponent],
})
export class MapPage implements OnInit, OnDestroy {

  getTravelModeName(): string {
    switch(this.travelMode) {
      case 'foot-walking':
        return 'Walking';
      case 'cycling-regular':
        return 'Cycling';
      case 'driving-car':
        return 'Driving';
      default:
        return 'Traveling';
    }
  }
  // ...existing code...

  // Find the two nearest evacuation centers
  findTwoNearestCenters(userLat: number, userLng: number, centers: any[]) {
    if (!centers.length) return [];

    // Filter centers by disaster type if specified
    let filteredCenters = centers;
    if (this.currentDisasterType && this.currentDisasterType !== 'all') {
      console.log(`Filtering centers by disaster type: ${this.currentDisasterType}`);

      // Normalize the disaster type for comparison
      const normalizedDisasterType = this.currentDisasterType.toLowerCase();

      filteredCenters = centers.filter(center => {
        // Skip centers without a disaster type
        if (!center.disaster_type) return false;

        // Normalize the center's disaster type - handle both array and string formats
        let centerType: string;
        if (Array.isArray(center.disaster_type)) {
          centerType = center.disaster_type.join(' ').toLowerCase();
        } else {
          centerType = center.disaster_type.toLowerCase();
        }

        // Match based on the type of disaster
        if (normalizedDisasterType === 'earthquake' || normalizedDisasterType === 'earthquakes') {
          return centerType.includes('earthquake') || centerType.includes('quake');
        }
        else if (normalizedDisasterType === 'typhoon' || normalizedDisasterType === 'typhoons') {
          return centerType.includes('typhoon') || centerType.includes('storm') || centerType.includes('hurricane');
        }
        else if (normalizedDisasterType === 'flood' || normalizedDisasterType === 'floods') {
          return centerType.includes('flood') || centerType.includes('flash');
        }
        else {
          // Direct match if not one of the special cases
          return centerType === normalizedDisasterType;
        }
      });

      console.log(`Filtered to ${filteredCenters.length} centers for disaster type: ${this.currentDisasterType}`);

      // If no centers match the disaster type, show a message
      if (filteredCenters.length === 0) {
        console.log(`No centers found for disaster type: ${this.currentDisasterType}`);
        return [];
      }
    }

    // Clone and sort by distance
    const sorted = [...filteredCenters].sort((a, b) => {
      const distA = this.calculateDistance(userLat, userLng, Number(a.latitude), Number(a.longitude));
      const distB = this.calculateDistance(userLat, userLng, Number(b.latitude), Number(b.longitude));
      return distA - distB;
    });

    return sorted.slice(0, 2);
  }

  travelMode: string = 'foot-walking';
  routeTime: number | null = null;
  routeDistance: number | null = null;

  // Update the route when travel mode changes
  updateRoute() {
    this.routeToTwoNearestCenters();
  }

  /**
   * Explicitly request location access in response to a user gesture
   * This method is called when the user clicks the "Enable Location Access" button
   */
  async requestLocationExplicitly() {
    console.log('User explicitly requested location access via button click');

    // Hide the request button while we're processing
    this.showLocationRequestButton = false;

    // Show loading indicator
    await this.loadingService.showLoading('Getting your location...');

    try {
      // First check permissions
      try {
        const permissionStatus = await Geolocation.checkPermissions();
        console.log('Permission status:', permissionStatus);

        if (permissionStatus.location !== 'granted') {
          console.log('Requesting permissions explicitly...');
          const requestResult = await Geolocation.requestPermissions();
          console.log('Permission request result:', requestResult);

          if (requestResult.location !== 'granted') {
            throw new Error('Location permission denied');
          }
        }
      } catch (permError) {
        console.log('Permission check failed, might be in browser:', permError);
        // Continue anyway, as we'll try browser fallback
      }

      // Try to get position with increased timeout
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 30000, // 30 second timeout
        maximumAge: 0 // Always get fresh position
      });

      console.log('Successfully got position:', position);

      // Update the map with the new position
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      // Dismiss loading
      await this.loadingService.dismissLoading();

      // Show success message
      this.toastCtrl.create({
        message: 'Location access successful!',
        duration: 2000,
        color: 'success'
      }).then(toast => toast.present());



      // Update the map
      if (this.map) {
        if (this.userMarker) {
          this.userMarker.setLatLng([lat, lng]);
          this.map.setView([lat, lng], 15);
        } else {
          this.updateUserMarker(lat, lng);
        }

        // Start watching position
        this.startWatchingPosition();
      } else {
        // If map isn't initialized yet, initialize it
        this.initializeMap(lat, lng);
      }
    } catch (error) {
      console.error('Error getting location:', error);

      // Dismiss loading
      await this.loadingService.dismissLoading();

      // Show the request button again
      this.showLocationRequestButton = true;

      // Show error message with help option
      const alert = await this.alertCtrl.create({
        header: 'Location Access Failed',
        message: 'We couldn\'t access your location. Please enable location access in your browser settings and try again.',
        buttons: [
          {
            text: 'Try Again',
            handler: () => {
              this.requestLocationExplicitly();
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
  }



  // Route to the two nearest centers
  async routeToTwoNearestCenters() {
    try {


      // FORCE a fresh GPS position check instead of using potentially stale marker position
      console.log('Forcing fresh GPS position check for routing...');

      try {
        // Get a fresh GPS position
        const freshPosition = await this.getCurrentPositionWithFallback();
        const freshLat = freshPosition.coords.latitude;
        const freshLng = freshPosition.coords.longitude;

        console.log(`Got fresh GPS position: [${freshLat}, ${freshLng}]`);

        // Update the user marker with this fresh position
        if (this.userMarker) {
          this.userMarker.setLatLng([freshLat, freshLng]);
          this.map.setView([freshLat, freshLng], 15);
        } else {
          // Create directional user marker if it doesn't exist
          this.userMarker = this.createDirectionalUserMarker(freshLat, freshLng).addTo(this.map);
        }

        // Use these fresh coordinates for routing
        const userLat = freshLat;
        const userLng = freshLng;

        // Show a toast confirming we're using real-time location
        this.toastCtrl.create({
          message: 'Using your current real-time location',
          duration: 2000,
          color: 'success'
        }).then(toast => toast.present());

        console.log(`Using FRESH GPS coordinates for routing: [${userLat}, ${userLng}]`);

        // Ensure evacuation centers are loaded
        if (!this.evacuationCenters || this.evacuationCenters.length === 0) {
          await this.loadEvacuationCenters(userLat, userLng);
        }

        const nearestTwo = this.findTwoNearestCenters(userLat, userLng, this.evacuationCenters);
        if (nearestTwo.length === 0) {
          const toast = await this.toastCtrl.create({
            message: 'No evacuation centers found.',
            duration: 3000,
            color: 'danger'
          });
          toast.present();
          return;
        }

        // AGGRESSIVELY clear ALL existing routes and GeoJSON layers
        console.log('Aggressively clearing ALL existing routes');
        this.map.eachLayer(layer => {
          if (layer instanceof L.GeoJSON) {
            console.log('Removing existing route layer');
            this.map.removeLayer(layer);
          }
        });

        // Draw routes to both
        for (const center of nearestTwo) {
          // Ensure coordinates are properly converted to numbers
          const centerLat = Number(center.latitude);
          const centerLng = Number(center.longitude);

          console.log(`Calculating route from [${userLat}, ${userLng}] to center: ${center.name} with disaster type: ${center.disaster_type}`);
          console.log(`Center coordinates: [${centerLat}, ${centerLng}], types: [${typeof centerLat}, ${typeof centerLng}]`);

          // Validate coordinates before calling getRealRoute
          if (isNaN(centerLat) || isNaN(centerLng)) {
            console.error('Invalid center coordinates:', { centerLat, centerLng, center });
            continue; // Skip this center and try the next one
          }

          await this.getRealRoute(userLat, userLng, centerLat, centerLng, this.travelMode, center.disaster_type);
        }

        // Update user marker popup
        if (this.userMarker) {
          let popupMsg = `You are here!.`;
          nearestTwo.forEach((center, idx) => {
            const distanceInMeters = this.calculateDistance(userLat, userLng, Number(center.latitude), Number(center.longitude));
            popupMsg += `<br> • <strong>${center.name}</strong> <br> Distance: ${(distanceInMeters / 1000).toFixed(2)} km`;
          });
          this.userMarker.bindPopup(popupMsg).openPopup();
        }
      } catch (posError) {
        console.error('Failed to get fresh GPS position:', posError);
        const toast = await this.toastCtrl.create({
          message: 'Could not get your current location. Please check your GPS settings.',
          duration: 3000,
          color: 'danger'
        });
        toast.present();
        return;
      }
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: 'Failed to get your location or route.',
        duration: 3000,
        color: 'danger'
      });
      toast.present();
      console.error('Failed to route to two nearest centers', error);
    }
  }

  private map!: L.Map;
  private userMarker: L.Marker<any> | null = null;
  public evacuationCenters: EvacuationCenter[] = []; // Changed to public for template access
  private loadingService = inject(LoadingService);
  private osmRouting = inject(OpenStreetMapRoutingService);
  private mapboxRouting = inject(MapboxRoutingService);
  private toastController = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private modalCtrl = inject(ModalController);
  private http = inject(HttpClient);
  private offlineStorage = inject(OfflineStorageService);
  private watchId: string | number | null = null;

  // For disaster type filtering
  public currentDisasterType: string = 'all';
  public isFilterMode: boolean = false;

  // For turn-by-turn directions
  public currentDirections: any[] = [];
  public showDirectionsPanel: boolean = false;

  // For location request button
  public showLocationRequestButton: boolean = false;

  // For directional user marker
  public deviceHeading: number = 0; // Default pointing north
  private orientationWatcher: any = null;

  private ORS_API_KEY = environment.orsApiKey;

  // Add request management to prevent duplicate API calls
  private isLoadingCenters = false;
  private lastErrorToast: number = 0;
  private readonly ERROR_TOAST_DEBOUNCE = 5000; // 5 seconds between error toasts

  // Navigation panel properties
  public selectedCenter: EvacuationCenter | null = null;
  public selectedTransportMode: 'walking' | 'cycling' | 'driving' | null = null;
  public routeInfo: any = {};

  constructor() {
    // Initialize offline storage and clean expired cache
    this.initializeOfflineMode();
  }

  /**
   * Initialize offline mode functionality
   */
  private async initializeOfflineMode(): Promise<void> {
    try {
      // Clean expired cache items on startup
      await this.offlineStorage.cleanExpiredCache();

      // Subscribe to offline data availability
      this.offlineStorage.offlineDataAvailable$.subscribe(hasOfflineData => {
        console.log(`📱 Offline data available: ${hasOfflineData}`);
      });

      console.log('✅ Offline mode initialized');
    } catch (error) {
      console.error('❌ Failed to initialize offline mode:', error);
    }
  }

  /**
   * Cache essential map data for offline use
   */
  private async cacheMapData(userLat: number, userLng: number): Promise<void> {
    try {
      const mapData = {
        userLocation: { lat: userLat, lng: userLng },
        zoomLevel: this.map?.getZoom() || 15,
        mapBounds: this.map?.getBounds(),
        lastUpdated: new Date()
      };

      await this.offlineStorage.setItem('mapData', mapData);
      console.log('🗺️ Cached essential map data');
    } catch (error) {
      console.error('❌ Failed to cache map data:', error);
    }
  }

  /**
   * Load cached map data for offline use
   */
  private async loadCachedMapData(): Promise<any> {
    try {
      const cachedMapData = await this.offlineStorage.getItem('mapData');
      if (cachedMapData) {
        console.log('📦 Loaded cached map data');
        return cachedMapData;
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to load cached map data:', error);
      return null;
    }
  }

  /**
   * Set up network status monitoring for automatic data synchronization
   */
  private setupNetworkStatusMonitoring(): void {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      console.log('📶 Network came back online - starting data sync');
      this.syncDataWhenOnline();
    });

    window.addEventListener('offline', () => {
      console.log('📵 Network went offline - switching to cached data');
    });

    // Initial sync if online
    if (navigator.onLine) {
      console.log('📶 App started online - checking for data sync');
      this.syncDataWhenOnline();
    }
  }

  /**
   * Sync data when network becomes available
   */
  private async syncDataWhenOnline(): Promise<void> {
    try {
      console.log('🔄 Starting data synchronization...');

      // Get current user location for sync
      const cachedLocation = await this.offlineStorage.getCachedUserLocation();
      if (cachedLocation) {
        // Try to refresh evacuation centers data
        await this.syncEvacuationCenters(cachedLocation.lat, cachedLocation.lng);
      }

      console.log('✅ Data synchronization completed');
    } catch (error) {
      console.error('❌ Data synchronization failed:', error);
    }
  }

  /**
   * Sync evacuation centers data
   */
  private async syncEvacuationCenters(userLat: number, userLng: number): Promise<void> {
    try {
      console.log('🔄 Syncing evacuation centers...');

      const apiResponse = await firstValueFrom(
        this.http.get<{success: boolean, data: EvacuationCenter[], count: number}>(`${environment.apiUrl}/evacuation-centers`)
      );

      if (apiResponse.data && apiResponse.data.length > 0) {
        await this.offlineStorage.cacheEvacuationCenters(apiResponse.data);
        console.log(`✅ Synced ${apiResponse.data.length} evacuation centers`);

        // Show sync success toast
        this.toastCtrl.create({
          message: `🔄 Synced ${apiResponse.data.length} evacuation centers`,
          duration: 2000,
          color: 'success'
        }).then(toast => toast.present());
      }
    } catch (error) {
      console.error('❌ Failed to sync evacuation centers:', error);
    }
  }

  /**
   * Get offline data summary for debugging
   */
  async getOfflineDataSummary(): Promise<void> {
    try {
      const summary = await this.offlineStorage.getOfflineDataSummary();
      console.log('📊 Offline Data Summary:', summary);

      const toast = await this.toastCtrl.create({
        message: `📱 Offline: ${summary.evacuationCenters} centers, ${summary.cacheSize}KB cached`,
        duration: 3000,
        color: 'medium'
      });
      await toast.present();
    } catch (error) {
      console.error('❌ Failed to get offline data summary:', error);
    }
  }

  /**
   * Helper function to get the primary disaster type from string or array
   */
  private getPrimaryDisasterType(disasterType: string | string[] | undefined): string {
    if (!disasterType) return '';
    if (Array.isArray(disasterType)) {
      return disasterType[0] || '';
    }
    return disasterType;
  }















  /**
   * Get the appropriate icon for a disaster type
   * Uses exact match with backend enum values: 'Earthquake', 'Typhoon', 'Flood', 'Fire', 'Landslide', 'Others'
   */
  getDisasterIcon(disasterType: string): string {
    if (!disasterType) {
      return 'assets/forOthers.png'; // Default icon
    }

    // Check if it's an "Others:" type
    if (typeof disasterType === 'string' && disasterType.startsWith('Others:')) {
      return 'assets/forOthers.png';
    }

    // Exact match with backend enum values
    switch (disasterType) {
      case 'Earthquake':
        return 'assets/forEarthquake.png';
      case 'Flood':
        return 'assets/forFlood.png';
      case 'Typhoon':
        return 'assets/forTyphoon.png';
      case 'Fire':
        return 'assets/forFire.png';
      case 'Landslide':
        return 'assets/forLandslide.png';
      case 'Others':
        return 'assets/forOthers.png';
      default:
        console.warn(`Unknown disaster type: ${disasterType}, using Others icon`);
        return 'assets/forOthers.png';
    }
  }

  /**
   * Get the appropriate color for a disaster type
   * Uses exact match with backend enum values: 'Earthquake', 'Typhoon', 'Flood', 'Fire', 'Landslide', 'Others'
   */
  getDisasterColor(disasterType: string): string {
    if (!disasterType) {
      return '#9333ea'; // Default purple for Others
    }

    // Check if it's an "Others:" type
    if (typeof disasterType === 'string' && disasterType.startsWith('Others:')) {
      return '#9333ea'; // Purple
    }

    // Exact match with backend enum values
    switch (disasterType) {
      case 'Earthquake':
        return '#ffa500'; // Orange
      case 'Flood':
        return '#0000ff'; // Blue
      case 'Typhoon':
        return '#008000'; // Green
      case 'Fire':
        return '#ef4444'; // Red
      case 'Landslide':
        return '#8b5a2b'; // Brown
      case 'Others':
        return '#9333ea'; // Purple
      default:
        console.warn(`Unknown disaster type: ${disasterType}, using Others color`);
        return '#9333ea'; // Default purple
    }
  }



  // Helper methods for error management
  private hasRecentErrorToast(): boolean {
    return Date.now() - this.lastErrorToast < this.ERROR_TOAST_DEBOUNCE;
  }

  private setLastErrorToast(): void {
    this.lastErrorToast = Date.now();
  }

  // Navigation panel methods
  async showNavigationPanel(center: EvacuationCenter) {
    console.log('🗺️ MAP: showNavigationPanel called for:', center.name);

    this.selectedCenter = center;
    this.selectedTransportMode = null;
    this.routeInfo = {};

    // Calculate routes for all transport modes
    await this.calculateAllRoutes(center);
  }

  closeNavigationPanel() {
    this.selectedCenter = null;
    this.selectedTransportMode = null;
    this.routeInfo = {};
    this.clearRoutes();
  }

  async selectTransportMode(mode: 'walking' | 'cycling' | 'driving') {
    this.selectedTransportMode = mode;

    if (this.selectedCenter && this.routeInfo[mode]) {
      // Show route on map
      await this.routeToCenter(this.selectedCenter, mode);
    }
  }

  // Calculate routes for all transport modes
  async calculateAllRoutes(center: EvacuationCenter) {
    if (!this.userMarker) return;

    const userPos = this.userMarker.getLatLng();
    const lat = Number(center.latitude);
    const lng = Number(center.longitude);

    if (isNaN(lat) || isNaN(lng)) return;

    const modes: ('walking' | 'cycling' | 'driving')[] = ['walking', 'cycling', 'driving'];

    for (const mode of modes) {
      try {
        // Convert mode to profile format
        const profile = mode === 'walking' ? 'foot-walking' :
                       mode === 'cycling' ? 'cycling-regular' : 'driving-car';

        const routeData = await this.osmRouting.getDirections(
          userPos.lng, userPos.lat, lng, lat, profile
        );

        if (routeData && routeData.routes && routeData.routes.length > 0) {
          const route = routeData.routes[0];
          this.routeInfo[mode] = {
            distance: route.distance,
            duration: route.duration
          };
        }
      } catch (error) {
        console.error(`Error calculating ${mode} route:`, error);
      }
    }
  }

  // Route to specific center with chosen transportation mode
  async routeToCenter(center: EvacuationCenter, travelMode: 'walking' | 'cycling' | 'driving') {
    if (!this.userMarker) return;

    const userPos = this.userMarker.getLatLng();
    const lat = Number(center.latitude);
    const lng = Number(center.longitude);

    if (isNaN(lat) || isNaN(lng)) return;

    try {
      await this.loadingService.showLoading('Calculating route...');

      // Convert mode to profile format
      const profile = travelMode === 'walking' ? 'foot-walking' :
                     travelMode === 'cycling' ? 'cycling-regular' : 'driving-car';

      const routeData = await this.osmRouting.getDirections(
        userPos.lng, userPos.lat, lng, lat, profile
      );

      if (routeData && routeData.routes && routeData.routes.length > 0) {
        this.clearRoutes();

        const route = routeData.routes[0];
        const routeCoords = route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]] as [number, number]);

        // Get color based on disaster type
        let routeColor = '#3880ff';
        if (center.disaster_type === 'Fire') routeColor = '#dc3545';
        else if (center.disaster_type === 'Typhoon') routeColor = '#28a745';
        else if (center.disaster_type === 'Earthquake') routeColor = '#fd7e14';
        else if (center.disaster_type === 'Flood') routeColor = '#007bff';
        else if (center.disaster_type === 'Landslide') routeColor = '#8b5a2b';

        const routeLine = L.polyline(routeCoords, {
          color: routeColor,
          weight: 4,
          opacity: 0.8
        }).addTo(this.map);

        // Store route for cleanup
        if (!this.map.hasLayer(routeLine)) {
          this.map.addLayer(routeLine);
        }

        // Show success message
        const toast = await this.toastCtrl.create({
          message: `🧭 Route calculated to ${center.name}`,
          duration: 3000,
          color: 'success',
          position: 'top'
        });
        await toast.present();
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      const toast = await this.toastCtrl.create({
        message: 'Error calculating route. Please try again.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    } finally {
      await this.loadingService.dismissLoading();
    }
  }

  // Clear all routes from map
  clearRoutes() {
    this.map.eachLayer(layer => {
      if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        this.map.removeLayer(layer);
      }
    });
  }

  // Format time for display
  formatTime(seconds: number): string {
    if (!seconds) return '';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
  }

  // Format distance for display
  formatDistance(meters: number): string {
    if (!meters) return '';
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    } else {
      return `${(meters / 1000).toFixed(1)} km`;
    }
  }



  private route = inject(ActivatedRoute);

  async ngOnInit() {
    console.log('🗺️ MAIN MAP: Initializing clean map (tabs/map)...');

    // Set up network status monitoring for data sync
    this.setupNetworkStatusMonitoring();

    // Start orientation tracking for compass
    this.startOrientationTracking();

    // Check if we have query parameters from search page
    this.route.queryParams.subscribe((params: any) => {
      // Check for specific evacuation center from search
      if (params['centerId']) {
        const centerId = params['centerId'];
        console.log(`🔍 SEARCH NAVIGATION: Loading specific center ID: ${centerId}`);
        this.loadSpecificCenter(centerId);
        return;
      }

      // Check for location-based search with routing
      if (params['lat'] && params['lng']) {
        const lat = parseFloat(params['lat']);
        const lng = parseFloat(params['lng']);
        const name = params['name'] || 'Search Result';
        const directions = params['directions'] === 'true';
        const viewOnly = params['viewOnly'] === 'true';

        console.log(`🔍 SEARCH NAVIGATION: Loading location [${lat}, ${lng}] - ${name}, directions: ${directions}, viewOnly: ${viewOnly}`);

        if (directions) {
          this.loadSearchLocationWithRouting(lat, lng, name);
        } else if (viewOnly) {
          this.loadSearchLocation(lat, lng, name);
        }
        return;
      }

      // Check for legacy location-based search
      if (params['searchLat'] && params['searchLng']) {
        const lat = parseFloat(params['searchLat']);
        const lng = parseFloat(params['searchLng']);
        const name = params['searchName'] || 'Search Result';
        console.log(`🔍 SEARCH NAVIGATION: Loading location [${lat}, ${lng}] - ${name}`);
        this.loadSearchLocation(lat, lng, name);
        return;
      }

      // Check for emergency notification routing
      if (params['emergency'] === 'true' && params['notification'] === 'true') {
        console.log('🚨 EMERGENCY NOTIFICATION: Handling disaster notification routing');

        const category = params['category'] || 'unknown';
        const severity = params['severity'] || 'medium';
        const title = params['title'] || 'Emergency Alert';
        const message = params['message'] || 'Emergency notification received';

        console.log(`📱 Emergency notification details:`, {
          category,
          severity,
          title,
          autoRoute: params['autoRoute'] === 'true'
        });

        // Show emergency alert for non-earthquake disasters
        this.showDisasterEmergencyAlert({
          category,
          severity,
          title,
          message,
          autoRoute: params['autoRoute'] === 'true'
        });

        // Load map with all evacuation centers for emergency
        this.loadEmergencyMap();
        return;
      }

      // Default: Load clean map with user location only (NO evacuation centers)
      console.log('🗺️ MAIN MAP: Loading clean map with user location only');
      this.loadCleanMap();
    });
  }
  // Load clean map with user location only (NO evacuation centers)
  async loadCleanMap() {
    console.log('🗺️ CLEAN MAP: Loading map with user location only...');

    await this.loadingService.showLoading('Loading map...');

    try {
      // Get user location
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20000
      });

      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;

      console.log(`🗺️ CLEAN MAP: User location [${userLat}, ${userLng}]`);

      // Initialize map with user location only
      this.initializeMap(userLat, userLng);

      // Clear any existing evacuation centers
      this.evacuationCenters = [];
      this.isFilterMode = false;
      this.currentDisasterType = 'all';

      // Remove any existing evacuation markers (keep only user marker)
      this.map.eachLayer(layer => {
        if (layer instanceof L.Marker && layer !== this.userMarker) {
          this.map.removeLayer(layer);
        }
        if (layer instanceof L.GeoJSON) {
          this.map.removeLayer(layer);
        }
      });

      await this.loadingService.dismissLoading();

      // Show info message
      const toast = await this.toastCtrl.create({
        message: '📍 Map ready - Search for evacuation centers to view them here',
        duration: 3000,
        color: 'primary',
        position: 'top'
      });
      await toast.present();

    } catch (error) {
      await this.loadingService.dismissLoading();
      console.error('🗺️ CLEAN MAP: Error loading map', error);

      const alert = await this.alertCtrl.create({
        header: 'Location Error',
        message: 'Unable to get your location. Please enable GPS and try again.',
        buttons: [
          {
            text: 'Retry',
            handler: () => this.loadCleanMap()
          },
          {
            text: 'Use Default Location',
            handler: () => this.initializeMap(10.3157, 123.8854) // Default Cebu location
          }
        ]
      });
      await alert.present();
    }
  }

  // Load specific evacuation center from search
  async loadSpecificCenter(centerId: string) {
    console.log(`🔍 SPECIFIC CENTER: Loading center ID ${centerId}...`);

    await this.loadingService.showLoading('Loading evacuation center...');

    try {
      // Get all centers and find the specific one
      const allCenters = await firstValueFrom(
        this.http.get<EvacuationCenter[]>(`${environment.apiUrl}/evacuation-centers`)
      );

      const center = allCenters.find(c => c.id.toString() === centerId);

      if (!center) {
        await this.loadingService.dismissLoading();
        const alert = await this.alertCtrl.create({
          header: 'Center Not Found',
          message: 'The requested evacuation center could not be found.',
          buttons: ['OK']
        });
        await alert.present();
        this.loadCleanMap();
        return;
      }

      // Get user location for routing
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20000
      });

      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;
      const centerLat = Number(center.latitude);
      const centerLng = Number(center.longitude);

      // Initialize map
      this.initializeMap(userLat, userLng);

      // Add center marker
      const iconUrl = this.getDisasterIcon(this.getPrimaryDisasterType(center.disaster_type));
      const marker = L.marker([centerLat, centerLng], {
        icon: L.icon({
          iconUrl: iconUrl,
          iconSize: [40, 40],
          iconAnchor: [20, 40],
          popupAnchor: [0, -40]
        })
      });

      marker.bindPopup(`
        <div class="evacuation-popup">
          <h3>${center.name}</h3>
          <p><strong>Type:</strong> ${center.disaster_type || 'General'}</p>
          <p><strong>Address:</strong> ${center.address}</p>
          <p><strong>Capacity:</strong> ${center.capacity || 'N/A'}</p>
        </div>
      `).openPopup();

      marker.addTo(this.map);

      // Fit map to show both user and center
      const bounds = L.latLngBounds([
        [userLat, userLng],
        [centerLat, centerLng]
      ]);
      this.map.fitBounds(bounds, { padding: [50, 50] });

      await this.loadingService.dismissLoading();

      const toast = await this.toastCtrl.create({
        message: `📍 Showing ${center.name}`,
        duration: 3000,
        color: 'success'
      });
      await toast.present();

    } catch (error) {
      await this.loadingService.dismissLoading();
      console.error('🔍 SPECIFIC CENTER: Error loading center', error);

      const toast = await this.toastCtrl.create({
        message: 'Error loading evacuation center. Please try again.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();

      this.loadCleanMap();
    }
  }

  // Load search location with coordinates
  async loadSearchLocation(lat: number, lng: number, name: string) {
    console.log(`🔍 SEARCH LOCATION: Loading [${lat}, ${lng}] - ${name}...`);

    await this.loadingService.showLoading('Loading location...');

    try {
      // Get user location for reference
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20000
      });

      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;

      // Initialize map
      this.initializeMap(userLat, userLng);

      // Add search location marker
      const searchMarker = L.marker([lat, lng], {
        icon: L.icon({
          iconUrl: 'assets/myLocation.png',
          iconSize: [40, 40],
          iconAnchor: [20, 40],
          popupAnchor: [0, -40]
        })
      });

      searchMarker.bindPopup(`
        <div class="search-popup">
          <h3>📍 ${name}</h3>
          <p>Search result location</p>
        </div>
      `).openPopup();

      searchMarker.addTo(this.map);

      // Fit map to show both user and search location
      const bounds = L.latLngBounds([
        [userLat, userLng],
        [lat, lng]
      ]);
      this.map.fitBounds(bounds, { padding: [50, 50] });

      await this.loadingService.dismissLoading();

      const toast = await this.toastCtrl.create({
        message: `📍 Showing ${name}`,
        duration: 3000,
        color: 'primary'
      });
      await toast.present();

    } catch (error) {
      await this.loadingService.dismissLoading();
      console.error('🔍 SEARCH LOCATION: Error loading location', error);

      const toast = await this.toastCtrl.create({
        message: 'Error loading search location. Please try again.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();

      this.loadCleanMap();
    }
  }





  // Load map with coordinates from search
  async loadMapWithSearchLocation(lat: number, lng: number, name: string, getDirections: boolean = false) {
    await this.loadingService.showLoading('Loading selected location...');

    try {
      console.log(`Initializing map with search location: [${lat}, ${lng}], name: ${name}`);

      // Clear any existing filter mode
      this.isFilterMode = false;
      this.currentDisasterType = 'all';

      this.initializeMap(lat, lng);

      // Clear any existing markers and routes first
      this.map.eachLayer(layer => {
        if (layer instanceof L.Marker && layer !== this.userMarker) {
          this.map.removeLayer(layer);
        }
        if (layer instanceof L.GeoJSON) {
          this.map.removeLayer(layer);
        }
      });

      // Add a special marker for the searched location
      const searchMarker = L.marker([lat, lng], {
        icon: L.icon({
          iconUrl: 'assets/Location.png',
          iconSize: [32, 32],
          iconAnchor: [16, 32]
        })
      }).addTo(this.map);

      searchMarker.bindPopup(`<b>${name}</b><br>Selected evacuation center`).openPopup();

      // Try to get user location in background for routing
      try {
        const position = await this.getCurrentPositionWithFallback();
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        // Add user marker
        this.updateUserMarker(userLat, userLng);
        if (getDirections) {

          this.map.eachLayer(layer => {
            if (layer instanceof L.GeoJSON) {
              this.map.removeLayer(layer);
            }
          });

          await this.getRealRoute(userLat, userLng, lat, lng, this.travelMode);
          this.toastCtrl.create({
            message: `Showing directions to ${name}`,
            duration: 3000,
            color: 'success'
          }).then(toast => toast.present());
          const bounds = L.latLngBounds([
            [userLat, userLng],
            [lat, lng]
          ]);
          this.map.fitBounds(bounds, { padding: [50, 50] });
        } else {
          this.toastCtrl.create({
            message: `Showing ${name} on map`,
            duration: 2000,
            color: 'primary'
          }).then(toast => toast.present());
        }
      } catch (error) {
        console.error('Error getting user location for routing:', error);

        if (getDirections) {
          this.toastCtrl.create({
            message: 'Could not get your location to calculate directions. Please check your GPS settings.',
            duration: 3000,
            color: 'warning'
          }).then(toast => toast.present());
        }
      }

      await this.loadingService.dismissLoading();
    } catch (error) {
      console.error('Error loading search location:', error);
      await this.loadingService.dismissLoading();

      this.toastCtrl.create({
        message: 'Failed to load selected location. Please try again.',
        duration: 3000,
        color: 'danger'
      }).then(toast => toast.present());
      this.loadMapWithUserLocation();
    }
  }

  async loadSearchLocationWithRouting(lat: number, lng: number, name: string) {
    console.log(`🔍 SEARCH ROUTING: Loading search location with routing [${lat}, ${lng}] - ${name}`);

    try {
      // Get user location first
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20000
      });

      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;

      console.log(`🔍 SEARCH ROUTING: User location [${userLat}, ${userLng}]`);
      console.log(`🔍 SEARCH ROUTING: Target location [${lat}, ${lng}] - ${name}`);

      // Clear any existing filter mode
      this.isFilterMode = false;
      this.currentDisasterType = 'all';

      this.initializeMap(userLat, userLng);

      // Clear any existing markers and routes first
      this.map.eachLayer(layer => {
        if (layer instanceof L.Marker && layer !== this.userMarker) {
          this.map.removeLayer(layer);
        }
        if (layer instanceof L.GeoJSON) {
          this.map.removeLayer(layer);
        }
      });

      // Add directional user marker
      this.userMarker = this.createDirectionalUserMarker(userLat, userLng).addTo(this.map);
      this.userMarker.bindPopup('📍 You are here!');

      // Add destination marker
      const destinationMarker = L.marker([lat, lng], {
        icon: L.icon({
          iconUrl: 'assets/forEarthquake.png', // Default icon, will be updated based on disaster type
          iconSize: [40, 40],
          iconAnchor: [20, 40]
        })
      }).addTo(this.map);

      destinationMarker.bindPopup(`<b>${name}</b><br>Selected evacuation center`).openPopup();

      // Show transportation options
      await this.showTransportationOptionsForSearch(lat, lng, name);

      console.log(`🔍 SEARCH ROUTING: Successfully loaded search location with routing: ${name}`);

    } catch (error) {
      console.error('🔍 SEARCH ROUTING: Error loading search location with routing:', error);

      const toast = await this.toastCtrl.create({
        message: 'Error getting your location for routing. Please enable GPS and try again.',
        duration: 3000,
        color: 'danger'
      });
      toast.present();
    }
  }

  // Show transportation options for search results
  async showTransportationOptionsForSearch(lat: number, lng: number, name: string) {
    const alert = await this.alertCtrl.create({
      header: `Route to ${name}`,
      message: 'Choose your transportation mode:',
      buttons: [
        {
          text: '🚶‍♂️ Walk',
          handler: () => {
            this.routeToSearchLocation(lat, lng, name, 'walking');
          }
        },
        {
          text: '🚴‍♂️ Cycle',
          handler: () => {
            this.routeToSearchLocation(lat, lng, name, 'cycling');
          }
        },
        {
          text: '🚗 Drive',
          handler: () => {
            this.routeToSearchLocation(lat, lng, name, 'driving');
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

  // Route to search location with chosen transportation mode
  async routeToSearchLocation(lat: number, lng: number, name: string, travelMode: 'walking' | 'cycling' | 'driving') {
    if (!this.userMarker) return;

    try {
      const userLat = this.userMarker.getLatLng().lat;
      const userLng = this.userMarker.getLatLng().lng;

      const mapboxProfile = this.mapboxRouting.convertTravelModeToProfile(travelMode);

      const routeData = await this.mapboxRouting.getDirections(
        userLng, userLat,
        lng, lat,
        mapboxProfile
      );

      if (routeData && routeData.routes && routeData.routes.length > 0) {
        const route = routeData.routes[0];

        // Use primary color for search routes
        const routeColor = '#3880ff';

        // Clear existing routes
        this.map.eachLayer(layer => {
          if (layer instanceof L.GeoJSON) {
            this.map.removeLayer(layer);
          }
        });

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
          message: `🗺️ Route: ${(route.distance/1000).toFixed(2)}km, ${(route.duration/60).toFixed(0)}min via ${travelMode}`,
          duration: 4000,
          color: 'primary'
        });
        await toast.present();

        // Fit map to route
        this.map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
      }
    } catch (error) {
      console.error('🔍 Error routing to search location:', error);

      const toast = await this.toastCtrl.create({
        message: 'Error calculating route. Please try again.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  ngOnDestroy() {
    console.log('Map page destroyed, cleaning up resources');
    this.stopWatchingPosition();
    this.stopOrientationTracking();
    if (this.map) {
      this.map.remove();
    }
  }

  async getCurrentPositionWithFallback(): Promise<GeolocationPosition> {
    try {
      console.log('Trying Capacitor Geolocation...');
      try {
        const permissionStatus = await Geolocation.checkPermissions();
        console.log('Permission status:', permissionStatus);

        if (permissionStatus.location !== 'granted') {
          console.log('Requesting permissions explicitly...');
          const requestResult = await Geolocation.requestPermissions();
          console.log('Permission request result:', requestResult);

          if (requestResult.location !== 'granted') {
            throw new Error('Location permission denied');
          }
        }
      } catch (permError) {
        console.log('Permission check failed, might be in browser:', permError);
      }

      try {
        console.log('Getting current position via Capacitor...');
        const capPosition = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000
        });
        return capPosition as unknown as GeolocationPosition;
      } catch (capError) {
        console.log('Capacitor Geolocation failed, trying browser fallback:', capError);
        throw capError; // Throw to trigger browser fallback
      }
    } catch (error) {
      console.log('Trying browser geolocation fallback...');
      if (navigator.geolocation) {
        return new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              console.log('Browser geolocation succeeded:', position);
              resolve({
                coords: {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                  altitude: position.coords.altitude,
                  altitudeAccuracy: position.coords.altitudeAccuracy,
                  heading: position.coords.heading,
                  speed: position.coords.speed
                },
                timestamp: position.timestamp
              });
            },
            (error) => {
              console.error('Browser geolocation failed:', error);
              if (error.code === 1 && error.message.includes('secure origins')) {
                const secureError: any = new Error(
                  'Geolocation requires HTTPS. Please use a secure connection, ' +
                  'run on a real device, or enable insecure origins in Chrome flags.'
                );
                secureError.code = error.code;
                reject(secureError);
              } else {
                reject(error);
              }
            },
            { enableHighAccuracy: true, timeout: 10000 }
          );
        });
      } else {
        console.error('Geolocation not available in this browser');
        throw new Error('Geolocation not available in this browser');
      }
    }
  }

  async loadMapWithDisasterFilter(disasterType: string, fromNotification: boolean = false, autoRoute: boolean = false) {
    await this.loadingService.showLoading(
      `Loading ${disasterType === 'all' ? 'all evacuation centers' : disasterType + ' evacuation centers'}...`
    );

    try {
      console.log('Getting user location for disaster map...');
      try {
        const position = await this.getCurrentPositionWithFallback();
        console.log('Position received:', position);
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        console.log(`Initializing disaster map with real GPS coordinates: [${lat}, ${lng}]`);
        this.initializeMap(lat, lng);
        this.startWatchingPosition();
        await this.loadEvacuationCentersFiltered(lat, lng, disasterType);

        // Show different messages based on source
        if (fromNotification) {
          this.toastCtrl.create({
            message: `🚨 EMERGENCY: Showing nearest ${disasterType} evacuation centers with routes`,
            duration: 5000,
            color: 'danger',
            position: 'top'
          }).then(toast => toast.present());
        } else {
          this.toastCtrl.create({
            message: `Showing ${disasterType === 'all' ? 'all evacuation centers' : disasterType + ' evacuation centers'} near you`,
            duration: 3000,
            color: 'primary'
          }).then(toast => toast.present());
        }

        await this.loadingService.dismissLoading();
        return;
      } catch (gpsError) {
        console.error('Failed to get GPS position for disaster map:', gpsError);
        await this.loadingService.dismissLoading();
        const alert = await this.alertCtrl.create({
          header: 'GPS Required',
          message: 'We need your location to show nearby evacuation centers. Please enable GPS and try again.',
          buttons: [
            {
              text: 'Enable GPS',
              handler: () => {
                this.loadMapWithDisasterFilter(disasterType);
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
    } catch (error) {
      console.error('Error loading disaster map:', error);
      await this.loadingService.dismissLoading();

      this.toastCtrl.create({
        message: 'Failed to load evacuation centers. Please try again.',
        duration: 3000,
        color: 'danger'
      }).then(toast => toast.present());
    }
  }

  async loadMapWithOnlyUserLocation() {
    await this.loadingService.showLoading('Loading map...');

    try {
      console.log('Getting user location for map tab...');
      try {
        const position = await this.getCurrentPositionWithFallback();
        console.log('Position received:', position);
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        console.log(`Initializing map with only user location: [${lat}, ${lng}]`);

        this.isFilterMode = false;
        this.currentDisasterType = 'all';
        this.evacuationCenters = [];

        this.initializeMap(lat, lng);

        this.map.eachLayer(layer => {
          if (layer instanceof L.Marker && layer !== this.userMarker) {
            this.map.removeLayer(layer);
          }
          if (layer instanceof L.GeoJSON) {
            this.map.removeLayer(layer);
          }
        });
        this.startWatchingPosition();
        if (this.userMarker) {
          this.userMarker.bindPopup('You are here!').openPopup();
        }

        this.toastCtrl.create({
          message: 'Showing your current location',
          duration: 2000,
          color: 'success'
        }).then(toast => toast.present());

        await this.loadingService.dismissLoading();
        return;
      } catch (gpsError) {
        console.error('Failed to get GPS position for map tab:', gpsError);
        await this.loadingService.dismissLoading();
        const alert = await this.alertCtrl.create({
          header: 'Location Required',
          message: 'We need your location to show the map. Please enable GPS and try again.',
          buttons: [
            {
              text: 'Enable GPS',
              handler: () => {
                this.loadMapWithOnlyUserLocation();
              }
            },
            {
              text: 'Cancel',
              role: 'cancel'
            }
          ]
        });
        await alert.present();
        return;
      }
    } catch (error) {
      console.error('Error loading map:', error);
      await this.loadingService.dismissLoading();
      this.toastCtrl.create({
        message: 'Failed to load map. Please try again.',
        duration: 3000,
        color: 'danger'
      }).then(toast => toast.present());
    }
  }

  async loadMapWithUserLocation() {
    await this.loadingService.showLoading('Loading map...');

    try {
      console.log('Getting user location...');
      try {
        const position = await this.getCurrentPositionWithFallback();
        console.log('Position received:', position);
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        console.log(`Initializing map with real GPS coordinates: [${lat}, ${lng}]`);
        if (!this.isFilterMode) {
          this.currentDisasterType = 'all';
        }

        this.initializeMap(lat, lng);
        this.startWatchingPosition();
        this.toastCtrl.create({
          message: 'Using your real-time location',
          duration: 2000,
          color: 'success'
        }).then(toast => toast.present());

        await this.loadingService.dismissLoading();
        return;
      } catch (gpsError) {
        console.error('Failed to get GPS position, showing alert:', gpsError);
        throw gpsError;
      }
    } catch (error: any) {
      console.error('Error getting location', error);

      let errorMessage = 'Unable to access your location. ';

      if (error.code === 1) {
        if (navigator.userAgent.includes('Chrome')) {
          errorMessage += 'Location permission denied. Please click the lock icon in the address bar, ' +
                         'select "Site settings", and change Location permission to "Allow".';
        } else if (navigator.userAgent.includes('Firefox')) {
          errorMessage += 'Location permission denied. Please click the lock icon in the address bar, ' +
                         'select "Site Permissions", and change "Access Your Location" to "Allow".';
        } else if (navigator.userAgent.includes('Safari')) {
          errorMessage += 'Location permission denied. Please check Safari settings > Websites > Location ' +
                         'and ensure this website is set to "Allow".';
        } else {
          errorMessage += 'Location permission denied. Please enable location access for this website in your browser settings.';
        }
      } else if (error.code === 2) {
        errorMessage += 'Position unavailable. Your GPS signal might be weak or unavailable.';
      } else if (error.code === 3) {
        errorMessage += 'Location request timed out. Please try again.';
      } else {
        errorMessage += 'Please enable GPS or try again. ' + (error.message || '');
      }

      const alert = await this.alertCtrl.create({
        header: 'Location Error',
        message: errorMessage,
        buttons: [
          {
            text: 'Retry',
            handler: () => {
              this.loadMapWithUserLocation(); // Retry GPS
            }
          },
          {
            text: 'Load Default Map',
            role: 'cancel',
            handler: () => {
              this.initializeMap(10.3157, 123.8854); // Default Cebu
            }
          }
        ]
      });
      await alert.present();
    }

    await this.loadingService.dismissLoading();
  }
  stopWatchingPosition() {
    if (this.watchId) {
      console.log('Stopping position watch...');
      if (typeof this.watchId === 'string') {
        try {
          const capWatchId: string = this.watchId;
          Geolocation.clearWatch({ id: capWatchId });
        } catch (error) {
          console.log('Error clearing Capacitor watch:', error);
        }
      }
      else if (typeof this.watchId === 'number') {
        try {
          navigator.geolocation.clearWatch(this.watchId);
        } catch (error) {
          console.log('Error clearing browser watch:', error);
        }
      }

      this.watchId = null;
    }
  }

  startWatchingPosition() {
    this.stopWatchingPosition();

    console.log('🚗 Starting enhanced position watch for driving/movement tracking...');

    try {
      this.watchId = Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 5000,        // Reduced timeout for faster updates
          maximumAge: 1000      // Accept cached position up to 1 second old
        },
        (position, err) => {
          if (position) {
            console.log('🚗 Capacitor watch position update:', position);

            // Extract heading from GPS if available (for driving direction)
            const gpsHeading = position.coords.heading;
            if (gpsHeading !== null && gpsHeading !== undefined) {
              console.log('🧭 GPS heading detected:', gpsHeading);
              this.deviceHeading = gpsHeading;
            }

            this.updateUserMarkerWithMovement(
              position.coords.latitude,
              position.coords.longitude,
              position.coords.speed || 0,
              gpsHeading
            );
          }
          if (err) {
            console.error('Error watching position:', err);
            this.toastCtrl.create({
              message: 'GPS signal lost or weak. Please check your location settings.',
              duration: 3000,
              color: 'warning'
            }).then(toast => toast.present());
          }
        }
      ) as unknown as string;

      console.log('🚗 Capacitor watch started with ID:', this.watchId);
    } catch (error) {
      console.log('Capacitor watch failed, trying enhanced browser fallback:', error);

      if (navigator.geolocation) {
        this.watchId = navigator.geolocation.watchPosition(
          (position) => {
            console.log('🚗 Browser watch position update:', position);

            // Extract heading from GPS if available (for driving direction)
            const gpsHeading = position.coords.heading;
            if (gpsHeading !== null && gpsHeading !== undefined) {
              console.log('🧭 GPS heading detected:', gpsHeading);
              this.deviceHeading = gpsHeading;
            }

            this.updateUserMarkerWithMovement(
              position.coords.latitude,
              position.coords.longitude,
              position.coords.speed || 0,
              gpsHeading
            );
          },
          (error) => {
            console.error('Browser watch error:', error);
            this.toastCtrl.create({
              message: 'GPS signal lost or weak. Please check your location settings.',
              duration: 3000,
              color: 'warning'
            }).then(toast => toast.present());
          },
          {
            enableHighAccuracy: true,
            timeout: 5000,        // Reduced timeout for faster updates
            maximumAge: 1000      // Accept cached position up to 1 second old
          }
        );

        console.log('🚗 Browser watch started with ID:', this.watchId);
      } else {
        console.error('Geolocation watching not available');
      }
    }
  }

  initializeMap(lat: number, lng: number) {
    console.log(`Initializing map with coordinates: [${lat}, ${lng}]`);

    if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      console.error('Invalid coordinates for map initialization:', { lat, lng });

      lat = 12.8797;
      lng = 121.7740;
      console.log(`Using fallback coordinates for Philippines: [${lat}, ${lng}]`);
    }

    if (this.map) {
      console.log('Removing existing map');
      this.map.remove();
    }

    this.map = L.map('map', {
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
    }).setView([lat, lng], 15);
    console.log('Map initialized with stable zoom options');

    // Cache map data for offline use
    this.cacheMapData(lat, lng);

    // Load online map tiles
    console.log('🌐 Loading online map tiles...');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'OpenStreetMap contributors',
      maxZoom: 19,
      minZoom: 8
    }).addTo(this.map);

    console.log('Adding user marker');
    if (!this.userMarker) {
      this.userMarker = this.createDirectionalUserMarker(lat, lng).addTo(this.map).bindPopup('You are here!').openPopup();
      console.log('Created new directional user marker');
    } else {
      this.userMarker.setLatLng([lat, lng]);
      this.userMarker.addTo(this.map);
      console.log('Updated existing user marker');
    }

    this.toastCtrl.create({
      message: 'Using your real-time GPS location',
      duration: 2000,
      color: 'success'
    }).then(toast => toast.present());


    // Only load evacuation centers if explicitly in filter mode or search mode
    if (this.isFilterMode && this.currentDisasterType !== 'all') {
      console.log('Loading evacuation centers for filter mode');
      this.loadEvacuationCenters(lat, lng);
    } else {
      console.log('🗺️ CLEAN MAP: Skipping evacuation centers - showing only user location');
      // Clear any existing evacuation centers to ensure clean map
      this.evacuationCenters = [];
    }
  }

  updateUserMarker(lat: number, lng: number) {
    console.log(`Updating user marker to: [${lat}, ${lng}]`);

    if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      console.error('Invalid coordinates for user marker update:', { lat, lng });
      return;
    }

    if (this.userMarker) {
      const oldPosition = this.userMarker.getLatLng();
      this.userMarker.setLatLng([lat, lng]);
      this.map.setView([lat, lng]);
      console.log('Updated existing user marker position');

      const distanceMoved = this.calculateDistance(
        oldPosition.lat, oldPosition.lng,
        lat, lng
      );

      console.log(`User moved ${distanceMoved.toFixed(2)} meters from previous position`);

      if (distanceMoved > 20) {
        console.log(`Significant movement detected (${distanceMoved.toFixed(2)}m), recalculating routes`);

        this.map.eachLayer(layer => {
          if (layer instanceof L.GeoJSON) {
            console.log('Removing existing route layer');
            this.map.removeLayer(layer);
          }
        });

        if (this.evacuationCenters && this.evacuationCenters.length > 0) {
          console.log('Recalculating routes to nearest evacuation centers');
          this.routeToTwoNearestCenters();
        }
      }
    } else {
      // Always create directional marker for better navigation
      this.userMarker = this.createDirectionalUserMarker(lat, lng).addTo(this.map);
      this.userMarker.bindPopup('📍 You are here!<br>🧭 Heading: N (0°)').openPopup();
      console.log('Created new directional user marker');

      if (this.evacuationCenters && this.evacuationCenters.length > 0) {
        console.log('Calculating initial routes with real GPS data');
        this.routeToTwoNearestCenters();
      }
    }
  }

  /**
   * Enhanced user marker update with movement tracking and directional heading
   * Perfect for driving/walking navigation with real-time direction indication
   */
  updateUserMarkerWithMovement(lat: number, lng: number, speed: number = 0, gpsHeading: number | null = null) {
    console.log(`🚗 Updating user marker with movement: [${lat}, ${lng}], speed: ${speed?.toFixed(2)} m/s, heading: ${gpsHeading}°`);

    if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      console.error('Invalid coordinates for user marker update:', { lat, lng });
      return;
    }

    // Use high precision coordinates for stability
    const preciseLat = parseFloat(Number(lat).toFixed(8));
    const preciseLng = parseFloat(Number(lng).toFixed(8));

    // Update heading from GPS if available (more accurate when moving)
    if (gpsHeading !== null && gpsHeading !== undefined && speed > 1) {
      // Only use GPS heading when moving (speed > 1 m/s ≈ 3.6 km/h)
      this.deviceHeading = gpsHeading;
      console.log(`🧭 Using GPS heading for movement: ${gpsHeading}°`);
    }

    if (this.userMarker) {
      const oldPosition = this.userMarker.getLatLng();

      // Update marker position with smooth transition
      this.userMarker.setLatLng([preciseLat, preciseLng]);

      // Update directional arrow
      this.updateUserMarkerDirection();

      // Only center map if moving significantly (avoid constant map jumping)
      const distanceMoved = this.calculateDistance(
        oldPosition.lat, oldPosition.lng,
        preciseLat, preciseLng
      );

      console.log(`🚗 User moved ${distanceMoved.toFixed(2)} meters, speed: ${(speed * 3.6).toFixed(1)} km/h`);

      // Center map on user if moving significantly or if speed indicates driving
      if (distanceMoved > 5 || speed > 2) {
        this.map.setView([preciseLat, preciseLng], this.map.getZoom(), {
          animate: true,
          duration: 0.5 // Smooth animation
        });
      }

      // Recalculate routes if moved significantly
      if (distanceMoved > 20) {
        console.log(`🚗 Significant movement detected (${distanceMoved.toFixed(2)}m), recalculating routes`);

        this.map.eachLayer(layer => {
          if (layer instanceof L.GeoJSON) {
            console.log('Removing existing route layer');
            this.map.removeLayer(layer);
          }
        });

        if (this.evacuationCenters && this.evacuationCenters.length > 0) {
          console.log('Recalculating routes to nearest evacuation centers');
          this.routeToTwoNearestCenters();
        }
      }

      // Update popup with movement info
      const speedKmh = (speed * 3.6).toFixed(1);
      const headingDirection = this.getCompassDirection(this.deviceHeading);
      this.userMarker.bindPopup(`
        📍 You are here!<br>
        🚗 Speed: ${speedKmh} km/h<br>
        🧭 Heading: ${headingDirection} (${this.deviceHeading.toFixed(0)}°)
      `);

    } else {
      // Create new directional marker for first time
      this.userMarker = this.createDirectionalUserMarker(preciseLat, preciseLng).addTo(this.map);

      const speedKmh = (speed * 3.6).toFixed(1);
      const headingDirection = this.getCompassDirection(this.deviceHeading);
      this.userMarker.bindPopup(`
        📍 You are here!<br>
        🚗 Speed: ${speedKmh} km/h<br>
        🧭 Heading: ${headingDirection} (${this.deviceHeading.toFixed(0)}°)
      `).openPopup();

      console.log('🚗 Created new directional user marker with movement tracking');

      if (this.evacuationCenters && this.evacuationCenters.length > 0) {
        console.log('Calculating initial routes with real GPS data');
        this.routeToTwoNearestCenters();
      }
    }
  }


  async loadEvacuationCentersFiltered(userLat: number, userLng: number, disasterType: string) {
    // Prevent duplicate API calls
    if (this.isLoadingCenters) {
      console.log('Already loading evacuation centers, skipping duplicate request');
      return;
    }

    this.isLoadingCenters = true;

    try {
      console.log(`Loading evacuation centers for disaster type: ${disasterType}`);
      console.log(`User coordinates: [${userLat}, ${userLng}]`);


      if (isNaN(userLat) || isNaN(userLng) || Math.abs(userLat) > 90 || Math.abs(userLng) > 180) {
        console.error('Invalid user coordinates for loading evacuation centers:', { userLat, userLng });
        const toast = await this.toastCtrl.create({
          message: 'Invalid location coordinates. Please check your GPS settings.',
          duration: 3000,
          color: 'danger'
        });
        toast.present();
        return;
      }


      this.currentDisasterType = disasterType;

      let allCenters: EvacuationCenter[] = [];

      // Cache user location
      await this.offlineStorage.cacheUserLocation({ lat: userLat, lng: userLng });

      // Try to load from online API first
      console.log('🌐 Fetching evacuation centers from:', `${environment.apiUrl}/evacuation-centers`);
      try {
        const apiResponse = await firstValueFrom(
          this.http.get<{success: boolean, data: EvacuationCenter[], count: number}>(`${environment.apiUrl}/evacuation-centers`)
        );
        console.log('📡 RAW API RESPONSE:', apiResponse);
        allCenters = apiResponse.data || [];
        console.log('📊 TOTAL CENTERS RECEIVED:', allCenters?.length || 0);

        // Cache the fresh data for offline use
        if (allCenters.length > 0) {
          await this.offlineStorage.cacheEvacuationCenters(allCenters);
          console.log('💾 Cached evacuation centers for offline use');
        }
      } catch (error) {
        console.error('❌ Failed to fetch evacuation centers from API:', error);

        // Try to load from offline cache
        console.log('🔄 Attempting to load from offline cache...');
        const cachedCenters = await this.offlineStorage.getCachedEvacuationCenters();

        if (cachedCenters && cachedCenters.length > 0) {
          allCenters = cachedCenters;
          console.log(`📦 Loaded ${allCenters.length} evacuation centers from offline cache`);

          // Show offline mode toast
          this.toastCtrl.create({
            message: `📱 Offline mode: Using cached data for ${disasterType} centers`,
            duration: 3000,
            color: 'warning'
          }).then(toast => toast.present());
        } else {
          console.log('❌ No cached evacuation centers available');
          this.toastCtrl.create({
            message: 'No evacuation centers available. Please check your internet connection.',
            duration: 3000,
            color: 'danger'
          }).then(toast => toast.present());
          return;
        }
      }

      // Debug: Show all disaster types in the database
      if (allCenters && allCenters.length > 0) {
        const disasterTypes = [...new Set(allCenters.map(c => c.disaster_type))];
        console.log('🏷️ UNIQUE DISASTER TYPES IN DATABASE:', disasterTypes);

        // Count centers by disaster type
        disasterTypes.forEach(type => {
          const count = allCenters.filter(c => c.disaster_type === type).length;
          console.log(`   📈 ${type}: ${count} centers`);
        });

        // Show first few centers for debugging
        console.log('🔍 SAMPLE CENTERS:');
        allCenters.slice(0, 5).forEach((center, index) => {
          console.log(`   ${index + 1}. "${center.name}" - Type: "${center.disaster_type}" - Status: "${center.status}"`);
        });
      }


      this.map.eachLayer(layer => {
        if (layer instanceof L.Marker && layer !== this.userMarker) {
          this.map.removeLayer(layer);
        }
      });


      this.map.eachLayer(layer => {
        if (layer instanceof L.GeoJSON) {
          this.map.removeLayer(layer);
        }
      });

      let filteredCenters = allCenters || [];
      if (disasterType !== 'all') {
        console.log(`🔍 FILTERING centers for disaster type: "${disasterType}"`);
        console.log(`📊 Total centers before filtering: ${filteredCenters.length}`);
        console.log('📋 All centers disaster types:', allCenters.map(c => `${c.name}: "${c.disaster_type}"`));

        filteredCenters = filteredCenters.filter(center => {
          if (!center.disaster_type) {
            console.log(`❌ Center "${center.name}" has no disaster_type, excluding`);
            return false;
          }

          // Normalize both values for comparison (trim whitespace and handle case)
          const centerType = this.getPrimaryDisasterType(center.disaster_type).trim();
          const targetType = disasterType.trim();

          // Exact match with backend enum values: 'Earthquake', 'Typhoon', 'Flood'
          const isMatch = centerType === targetType;

          console.log(`🏢 Center "${center.name}"`);
          console.log(`   📍 Center Type: "${centerType}" (length: ${centerType.length})`);
          console.log(`   🎯 Looking for: "${targetType}" (length: ${targetType.length})`);
          console.log(`   ✅ Match: ${isMatch}`);

          return isMatch;
        });

        console.log(`🎯 FILTERED RESULT: ${filteredCenters.length} centers for disaster type: "${disasterType}"`);

        // Log the filtered centers for debugging
        console.log('✅ INCLUDED CENTERS:');
        filteredCenters.forEach((center, index) => {
          console.log(`   ${index + 1}. ${center.name} (${center.disaster_type})`);
        });

        // Log excluded centers for debugging
        const excludedCenters = allCenters.filter(center =>
          center.disaster_type && this.getPrimaryDisasterType(center.disaster_type).trim() !== disasterType.trim()
        );
        console.log('❌ EXCLUDED CENTERS:');
        excludedCenters.forEach((center, index) => {
          console.log(`   ${index + 1}. ${center.name} (${center.disaster_type})`);
        });

        // If no centers found, show detailed debug info
        if (filteredCenters.length === 0) {
          console.error('🚨 NO CENTERS FOUND FOR DISASTER TYPE!');
          console.error('🔍 Debug Info:');
          console.error(`   Target disaster type: "${disasterType}"`);
          console.error(`   Available disaster types:`, [...new Set(allCenters.map(c => c.disaster_type))]);
          console.error(`   Total centers in database: ${allCenters.length}`);
        }
      }

      // AGGRESSIVE MARKER CLEARING - Remove ALL markers except user marker
      console.log('🧹 AGGRESSIVE CLEARING: Removing ALL existing markers');
      const markersToRemove: L.Layer[] = [];

      this.map.eachLayer(layer => {
        if (layer instanceof L.Marker && layer !== this.userMarker) {
          console.log('🗑️ Marking marker for removal:', layer);
          markersToRemove.push(layer);
        }
        if (layer instanceof L.GeoJSON) {
          console.log('🗑️ Marking route for removal:', layer);
          markersToRemove.push(layer);
        }
      });

      // Remove all marked layers
      markersToRemove.forEach(layer => {
        console.log('🗑️ Removing layer from map');
        this.map.removeLayer(layer);
      });

      // Clear the evacuationCenters array to ensure clean state
      this.evacuationCenters = [];

      console.log(`🧹 CLEARED: Removed ${markersToRemove.length} layers from map`);

      this.evacuationCenters = filteredCenters;

      if (this.evacuationCenters.length === 0) {
        console.log(`🚨 NO EVACUATION CENTERS FOUND for disaster type: "${disasterType}"`);

        this.alertCtrl.create({
          header: 'No Evacuation Centers Found',
          message: `There are no evacuation centers stored for ${disasterType === 'all' ? 'any disaster type' : disasterType}. Please contact your administrator to add evacuation centers.`,
          buttons: ['OK']
        }).then(alert => alert.present());

        if (this.userMarker) {
          this.userMarker.bindPopup('You are here!').openPopup();
        }

        this.map.setView([userLat, userLng], 15);

        return;
      }

      console.log(`🎯 ADDING ${this.evacuationCenters.length} FILTERED MARKERS to map`);
      console.log(`📍 Disaster type filter: "${disasterType}"`);
      console.log(`🏢 Centers to display:`, this.evacuationCenters.map(c => `${c.name} (${c.disaster_type})`));

      this.evacuationCenters.forEach((center, index) => {
        // Use high precision coordinates and round to 8 decimal places for stability
        const lat = parseFloat(Number(center.latitude).toFixed(8));
        const lng = parseFloat(Number(center.longitude).toFixed(8));

        console.log(`🏢 Processing center ${index + 1}/${this.evacuationCenters.length}: ${center.name}`);
        console.log(`   📍 Coordinates: [${lat}, ${lng}]`);
        console.log(`   🏷️ Disaster Type: "${center.disaster_type}"`);
        console.log(`   🎯 Filter Type: "${disasterType}"`);

        if (!isNaN(lat) && !isNaN(lng)) {
          // Get icon based on disaster type - exact match with backend enum values
          let iconUrl = this.getDisasterIcon(this.getPrimaryDisasterType(center.disaster_type));
          console.log(`   🎨 Icon URL: ${iconUrl}`);

          const marker = L.marker([lat, lng], {
            icon: L.icon({
              iconUrl: iconUrl,
              iconSize: [40, 40],
              iconAnchor: [20, 40],
              popupAnchor: [0, -40]
            }),
            // Add marker stability options
            riseOnHover: false,
            riseOffset: 0,
            zIndexOffset: 0,
            opacity: 1,
            // Ensure marker stays fixed to coordinates during zoom
            interactive: true,
            bubblingMouseEvents: true
          });

          let popupContent = `
            <div class="evacuation-popup">
              <h3>${center.name || 'Evacuation Center'}</h3>
              <p><strong>Type:</strong> ${center.disaster_type || 'General'}</p>
              <p><strong>Distance:</strong> ${(this.calculateDistance(userLat, userLng, lat, lng) / 1000).toFixed(2)} km</p>
              <p><button class="popup-button">View Details</button></p>
            </div>
          `;

          marker.bindPopup(popupContent);
          marker.on('click', () => {
            setTimeout(() => {
              marker.closePopup();
              this.showNavigationPanel(center);
            }, 300);
          });

          marker.addTo(this.map);
          console.log(`   ✅ MARKER ADDED to map for: ${center.name} (${center.disaster_type})`);
        } else {
          console.error(`   ❌ Invalid coordinates for center: ${center.name}`);
        }
      });

      console.log(`🎉 COMPLETED: Added ${this.evacuationCenters.length} markers for disaster type "${disasterType}"`);

      // Verify markers on map
      let markerCount = 0;
      this.map.eachLayer(layer => {
        if (layer instanceof L.Marker && layer !== this.userMarker) {
          markerCount++;
        }
      });
      console.log(`🔍 VERIFICATION: ${markerCount} evacuation center markers currently on map`);

      if (this.userMarker && this.evacuationCenters.length > 0) {
        console.log('User marker exists, finding nearest centers');
        const nearestTwo = this.findTwoNearestCenters(userLat, userLng, this.evacuationCenters);

        if (nearestTwo.length > 0) {

          for (const center of nearestTwo) {
            const centerLat = Number(center.latitude);
            const centerLng = Number(center.longitude);

            console.log(`Calculating route to center: ${center.name}`);
            console.log(`Center coordinates: [${centerLat}, ${centerLng}], types: [${typeof centerLat}, ${typeof centerLng}]`);

            if (isNaN(centerLat) || isNaN(centerLng)) {
              console.error('Invalid center coordinates:', { centerLat, centerLng, center });
              continue; // Skip this center and try the next one
            }

            await this.getRealRoute(userLat, userLng, centerLat, centerLng, this.travelMode, center.disaster_type);
          }

          let popupMsg = `You are here!.`;
          nearestTwo.forEach((center, idx) => {
            const distanceInMeters = this.calculateDistance(userLat, userLng, Number(center.latitude), Number(center.longitude));
            popupMsg += `<br> • <strong>${idx+1}: ${center.name} </strong> <br> Distance: ${(distanceInMeters / 1000).toFixed(2)} km`;
          });

          this.userMarker.bindPopup(popupMsg).openPopup();

          const bounds = L.latLngBounds([]);

          bounds.extend([userLat, userLng]);

          nearestTwo.forEach(center => {
            bounds.extend([Number(center.latitude), Number(center.longitude)]);
          });

          this.map.fitBounds(bounds, { padding: [50, 50] });
        } else {
          console.log('No nearest centers found');
          this.map.setView([userLat, userLng], 15);
        }
      } else {
        console.log('No user marker or no centers found, skipping route calculation');
        this.map.setView([userLat, userLng], 15);
      }
    } catch (error) {
      console.error('Error loading filtered evacuation centers:', error);

      // DISABLED: Network errors are now handled by offline banner
      // Only show error if we haven't shown one recently
      // if (!this.hasRecentErrorToast()) {
      //   this.toastCtrl.create({
      //     message: 'Network error loading evacuation centers. Please check your connection.',
      //     duration: 3000,
      //     color: 'danger'
      //   }).then(toast => toast.present());
      //   this.setLastErrorToast();
      // }
      console.log('Network error loading evacuation centers - offline mode available');
    } finally {
      this.isLoadingCenters = false;
    }
  }

  async loadEvacuationCenters(userLat: number, userLng: number) {
    // Prevent duplicate API calls
    if (this.isLoadingCenters) {
      console.log('Already loading evacuation centers, skipping duplicate request');
      return;
    }

    this.isLoadingCenters = true;

    try {
      console.log(`Loading evacuation centers with user coordinates: [${userLat}, ${userLng}]`);

      if (isNaN(userLat) || isNaN(userLng) || Math.abs(userLat) > 90 || Math.abs(userLng) > 180) {
        console.error('Invalid user coordinates for loading evacuation centers:', { userLat, userLng });
        const toast = await this.toastCtrl.create({
          message: 'Invalid location coordinates. Please check your GPS settings.',
          duration: 3000,
          color: 'danger'
        });
        toast.present();
        return;
      }

      let centers: EvacuationCenter[] = [];

      // Cache user location
      await this.offlineStorage.cacheUserLocation({ lat: userLat, lng: userLng });

      // Try to load from online API first
      console.log('🌐 Fetching evacuation centers from:', `${environment.apiUrl}/evacuation-centers`);
      try {
        const apiResponse = await firstValueFrom(
          this.http.get<{success: boolean, data: EvacuationCenter[], count: number}>(`${environment.apiUrl}/evacuation-centers`)
        );
        centers = apiResponse.data || [];
        console.log('📡 Received centers from API:', centers);

        // Cache the fresh data for offline use
        if (centers.length > 0) {
          await this.offlineStorage.cacheEvacuationCenters(centers);
          console.log('💾 Cached evacuation centers for offline use');
        }
      } catch (error) {
        console.error('❌ Failed to fetch evacuation centers from API:', error);

        // Try to load from offline cache
        console.log('🔄 Attempting to load from offline cache...');
        const cachedCenters = await this.offlineStorage.getCachedEvacuationCenters();

        if (cachedCenters && cachedCenters.length > 0) {
          centers = cachedCenters;
          console.log(`📦 Loaded ${centers.length} evacuation centers from offline cache`);

          // Show offline mode toast
          this.toastCtrl.create({
            message: `📱 Offline mode: Loaded ${centers.length} cached evacuation centers`,
            duration: 3000,
            color: 'warning'
          }).then(toast => toast.present());
        } else {
          console.log('❌ No cached evacuation centers available');
          this.toastCtrl.create({
            message: 'No evacuation centers available. Please check your internet connection.',
            duration: 3000,
            color: 'danger'
          }).then(toast => toast.present());
          return;
        }
      }

      this.evacuationCenters = centers || [];

      this.map.eachLayer(layer => {
        if (layer instanceof L.Marker && layer !== this.userMarker) {
          this.map.removeLayer(layer);
        }
      });

      this.evacuationCenters.forEach(center => {
        // Use high precision coordinates and round to 8 decimal places for stability
        const lat = parseFloat(Number(center.latitude).toFixed(8));
        const lng = parseFloat(Number(center.longitude).toFixed(8));

        console.log(`Processing center: ${center.name}, coordinates: [${lat}, ${lng}]`);

        if (!isNaN(lat) && !isNaN(lng)) {
          // Get icon based on disaster type - exact match with backend enum values
          let iconUrl = this.getDisasterIcon(this.getPrimaryDisasterType(center.disaster_type));

          const marker = L.marker([lat, lng], {
            icon: L.icon({
              iconUrl: iconUrl,
              iconSize: [40, 40],
              iconAnchor: [20, 40],
              popupAnchor: [0, -40]
            }),
            // Add marker stability options
            riseOnHover: false,
            riseOffset: 0,
            zIndexOffset: 0,
            opacity: 1,
            // Ensure marker stays fixed to coordinates during zoom
            interactive: true,
            bubblingMouseEvents: true
          });

          let popupContent = `
            <div class="evacuation-popup">
              <h3>${center.name || 'Evacuation Center'}</h3>
              <p><strong>Distance:</strong> ${(this.calculateDistance(userLat, userLng, lat, lng) / 1000).toFixed(2)} km</p>
              <p><button class="popup-button">View Details</button></p>
            </div>
          `;

          marker.bindPopup(popupContent);
          marker.on('click', () => {
            setTimeout(() => {
              marker.closePopup();
              this.showNavigationPanel(center);
            }, 300);
          });

          marker.addTo(this.map);
          console.log(`Added marker for center: ${center.name}`);
        } else {
          console.error(`Invalid coordinates for center: ${center.name}`);
        }
      });
      if (this.userMarker) {
        console.log('User marker exists, finding nearest centers');
        const nearestTwo = this.findTwoNearestCenters(userLat, userLng, this.evacuationCenters);

        if (nearestTwo.length > 0) {

          this.map.eachLayer(layer => {
            if (layer instanceof L.GeoJSON) {
              this.map.removeLayer(layer);
            }
          });

          for (const center of nearestTwo) {
            const centerLat = Number(center.latitude);
            const centerLng = Number(center.longitude);

            console.log(`Calculating route to center: ${center.name}`);
            console.log(`Center coordinates: [${centerLat}, ${centerLng}], types: [${typeof centerLat}, ${typeof centerLng}]`);
            if (isNaN(centerLat) || isNaN(centerLng)) {
              console.error('Invalid center coordinates:', { centerLat, centerLng, center });
              continue; // Skip this center and try the next one
            }

            await this.getRealRoute(userLat, userLng, centerLat, centerLng, this.travelMode, center.disaster_type);
          }

          let popupMsg = `You are here!.`;
          nearestTwo.forEach((center, idx) => {
            const distanceInMeters = this.calculateDistance(userLat, userLng, Number(center.latitude), Number(center.longitude));
            popupMsg += `<br> •${idx+1}: ${center.name} <br> Distance: ${(distanceInMeters / 1000).toFixed(2)} km`;
          });

          this.userMarker.bindPopup(popupMsg).openPopup();
        } else {
          console.log('No nearest centers found');
          this.map.setView([userLat, userLng], 15);
        }
      } else {
        console.log('No user marker, skipping route calculation');
        this.map.setView([userLat, userLng], 15);
      }

    } catch (error) {
      console.error('Failed to load evacuation centers', error);

      // DISABLED: Network errors are now handled by offline banner
      // Only show error if we haven't shown one recently
      // if (!this.hasRecentErrorToast()) {
      //   this.toastCtrl.create({
      //     message: 'Network error loading evacuation centers. Please check your connection.',
      //     duration: 3000,
      //     color: 'danger'
      //   }).then(toast => toast.present());
      //   this.setLastErrorToast();
      // }
      console.log('Network error loading evacuation centers - offline mode available');
    } finally {
      this.isLoadingCenters = false;
    }
  }

  async getRealRoute(startLat: number, startLng: number, endLat: number, endLng: number, travelMode: string = this.travelMode, disasterType?: string) {
    console.log('Clearing all existing routes before calculating new route');
    this.map.eachLayer(layer => {
      if (layer instanceof L.GeoJSON) {
        console.log('Removing existing route layer');
        this.map.removeLayer(layer);
      }
    });

    console.log('Requesting Mapbox route with coordinates:', { startLat, startLng, endLat, endLng, travelMode });
    if ([startLat, startLng, endLat, endLng].some(val => typeof val !== 'number' || isNaN(val))) {
      const toast = await this.toastCtrl.create({
        message: 'Invalid route coordinates. Cannot request directions.',
        duration: 3000,
        color: 'danger'
      });
      toast.present();
      return;
    }
    if (
      Math.abs(startLat) > 90 || Math.abs(endLat) > 90 ||
      Math.abs(startLng) > 180 || Math.abs(endLng) > 180
    ) {
      const toast = await this.toastCtrl.create({
        message: 'Route coordinates out of range. Cannot request directions.',
        duration: 3000,
        color: 'danger'
      });
      toast.present();
      return;
    }

    try {
      console.log('Sending route request to OpenStreetMap');

      // Convert travel mode to Mapbox profile
      const mapboxProfile = this.mapboxRouting.convertTravelModeToProfile(travelMode);

      // Get directions from Mapbox
      const response = await this.mapboxRouting.getDirections(
        startLng, startLat, endLng, endLat,
        mapboxProfile
      );

      if (!response.routes || response.routes.length === 0) {
        throw new Error('No routes found');
      }

      const route = response.routes[0];
      const routeGeoJSON = this.osmRouting.convertToGeoJSON(route);
      let routeColor = '#3388ff'; // Default blue color

      if (disasterType) {
        // Use exact match with backend enum values
        switch (disasterType) {
          case 'Earthquake':
            routeColor = '#ffa500'; // Orange for earthquake
            break;
          case 'Flood':
            routeColor = '#0000ff'; // Blue for flood
            break;
          case 'Typhoon':
            routeColor = '#008000'; // Green for typhoon
            break;
          default:
            console.warn(`Unknown disaster type for route color: ${disasterType}`);
            break;
        }
      }
      console.log(`Route calculation - Disaster type: "${disasterType}", Normalized type: "${disasterType ? disasterType.toLowerCase() : 'none'}", Selected color: ${routeColor}`);

      if (this.currentDisasterType && this.currentDisasterType !== 'all') {
        // Use exact match with backend enum values
        if (this.currentDisasterType === 'Earthquake') {
          routeColor = '#ffa500'; // Orange for earthquake
        } else if (this.currentDisasterType === 'Typhoon') {
          routeColor = '#008000'; // Green for typhoon
        } else if (this.currentDisasterType === 'Flood') {
          routeColor = '#0000ff'; // Blue for flood
        }
        console.log(`Filter mode active: ${this.currentDisasterType}, forcing route color to: ${routeColor}`);
      }

      console.log(`Using route color: ${routeColor} for disaster type: ${disasterType || 'unknown'}`);

      const leafletRoute = L.geoJSON(routeGeoJSON, {
        style: {
          color: routeColor,
          weight: 5,
          opacity: 0.8
        }
      }).addTo(this.map);

      // Update route info from Mapbox response
      this.routeTime = route.duration; // Mapbox returns duration in seconds
      this.routeDistance = route.distance; // OpenStreetMap returns distance in meters

      const summary = this.osmRouting.getRouteSummary(route);
      console.log(`OpenStreetMap route summary: ${summary.duration}, ${summary.distance}`);

      this.map.fitBounds(leafletRoute.getBounds(), { padding: [50, 50] });

    } catch (error: any) {
      console.error('Failed to fetch route from Mapbox', error);
      let errorMessage = 'Failed to fetch route. Please check your internet connection or try again later.';

      // Provide more specific error messages for Mapbox
      if (error.message) {
        if (error.message.includes('Invalid Mapbox access token')) {
          errorMessage = 'Invalid Mapbox access token. Please check your token configuration.';
        } else if (error.message.includes('Rate limit exceeded')) {
          errorMessage = 'Too many requests to Mapbox. Please wait a moment and try again.';
        } else if (error.message.includes('Network error')) {
          errorMessage = 'Network error. Please check your internet connection.';
        } else if (error.message.includes('No routes found')) {
          errorMessage = 'No route could be calculated between these points.';
        } else {
          errorMessage = `Mapbox routing error: ${error.message}`;
        }
      } else if (error.status === 401) {
        errorMessage = 'Invalid Mapbox access token. Please check your token.';
      } else if (error.status === 422) {
        errorMessage = 'Invalid coordinates or routing parameters.';
      } else if (error.status === 429) {
        errorMessage = 'Rate limit exceeded. Please try again later.';
      } else if (error.status === 0) {
        errorMessage = 'Network error. Please check your internet connection.';
      }

      const modeName = travelMode === 'foot-walking' ? 'walking' :
                       travelMode === 'cycling-regular' ? 'cycling' :
                       travelMode === 'driving-car' ? 'driving' : travelMode;

      // Only show error if we haven't shown one recently
      if (!this.hasRecentErrorToast()) {
        const toast = await this.toastCtrl.create({
          message: `Failed to fetch ${modeName} route: ${errorMessage}`,
          duration: 5000,
          color: 'danger'
        });
        toast.present();
        this.setLastErrorToast();
      }
    }
  }

  findNearestCenter(userLat: number, userLng: number, centers: any[]) {
    if (!centers.length) return null;

    let nearest = centers[0];
    let minDistance = this.calculateDistance(userLat, userLng, Number(nearest.latitude), Number(nearest.longitude));

    for (const center of centers) {
      const dist = this.calculateDistance(userLat, userLng, Number(center.latitude), Number(center.longitude));
      if (dist < minDistance) {
        minDistance = dist;
        nearest = center;
      }
    }
    return nearest;
  }

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
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

  async downloadMap() {
    try {

      await this.loadingService.showLoading('Capturing map...');
      const mapElement = document.getElementById('map');

      if (!mapElement) {
        throw new Error('Map element not found');
      }

      console.log('Capturing map as image...');
      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth: document.documentElement.offsetWidth,
        windowHeight: document.documentElement.offsetHeight,
        scale: 1
      });

      await this.loadingService.dismissLoading();

      const imageData = canvas.toDataURL('image/png');

      const date = new Date();
      const dateString = date.toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const fileName = `evacuation-map-${dateString}.png`;

      const alert = await this.alertCtrl.create({
        header: 'Map Captured',
        message: 'Your map has been captured. What would you like to do with it?',
        buttons: [
          {
            text: 'Download',
            handler: () => {
              this.downloadImage(imageData, fileName);
            }
          },
          {
            text: 'Share',
            handler: () => {
              this.shareImage(imageData, fileName);
            }
          },
          {
            text: 'Cancel',
            role: 'cancel'
          }
        ]
      });

      await alert.present();

    } catch (error) {
      console.error('Error capturing map:', error);
      await this.loadingService.dismissLoading();

      const toast = await this.toastCtrl.create({
        message: 'Failed to capture map. Please try again.',
        duration: 3000,
        color: 'danger'
      });
      toast.present();
    }
  }


  private downloadImage(imageData: string, fileName: string) {

    const link = document.createElement('a');

    link.href = imageData;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.toastCtrl.create({
      message: 'Map downloaded successfully',
      duration: 2000,
      color: 'success'
    }).then(toast => toast.present());
  }

  private async shareImage(imageData: string, fileName: string) {
    try {
      if (navigator.share) {
        const blob = await (await fetch(imageData)).blob();

        const file = new File([blob], fileName, { type: 'image/png' });

        await navigator.share({
          title: 'Evacuation Map',
          text: 'Here is my evacuation map with routes to the nearest evacuation centers',
          files: [file]
        });

        console.log('Map shared successfully');
      } else {
        console.log('Web Share API not supported');

        const toast = await this.toastCtrl.create({
          message: 'Sharing not supported on this device. The map has been downloaded instead.',
          duration: 3000,
          color: 'warning'
        });
        toast.present();

        this.downloadImage(imageData, fileName);
      }
    } catch (error) {
      console.error('Error sharing map:', error);

      const toast = await this.toastCtrl.create({
        message: 'Failed to share map. The map has been downloaded instead.',
        duration: 3000,
        color: 'warning'
      });
      toast.present();

      this.downloadImage(imageData, fileName);
    }
  }

  async showEvacuationCenterDetails(center: EvacuationCenter, userLat: number, userLng: number) {
    console.log('Showing evacuation center details for:', center.name);

    const modal = await this.modalCtrl.create({
      component: EvacuationCenterDetailsComponent,
      componentProps: {
        center: center,
        userLat: userLat,
        userLng: userLng
      },
      cssClass: 'evacuation-details-modal',
      breakpoints: [0, 0.5, 0.75, 1],
      initialBreakpoint: 0.75
    });

    await modal.present();
    const { data } = await modal.onDidDismiss();

    if (data && data.selectedMode) {
      console.log('Selected travel mode:', data.selectedMode);

      this.travelMode = data.selectedMode;
      console.log('Clearing all existing routes before calculating new route');
      this.map.eachLayer(layer => {
        if (layer instanceof L.GeoJSON) {
          console.log('Removing existing route layer');
          this.map.removeLayer(layer);
        }
      });
      if (this.userMarker) {
        const userLatLng = this.userMarker.getLatLng();
        const centerLat = Number(center.latitude);
        const centerLng = Number(center.longitude);
        console.log('Recalculating route with new travel mode:', {
          userLat: userLatLng.lat,
          userLng: userLatLng.lng,
          centerLat: centerLat,
          centerLng: centerLng,
          travelMode: this.travelMode
        });
        if (isNaN(centerLat) || isNaN(centerLng)) {
          console.error('Invalid center coordinates:', { centerLat, centerLng });
          const toast = await this.toastCtrl.create({
            message: 'Invalid evacuation center coordinates. Cannot calculate route.',
            duration: 3000,
            color: 'danger'
          });
          toast.present();
          return;
        }

        this.toastCtrl.create({
          message: `Showing ${this.getTravelModeName().toLowerCase()} route to ${center.name}`,
          duration: 2000,
          color: 'primary'
        }).then(toast => toast.present());

        await this.getRealRoute(
          userLatLng.lat,
          userLatLng.lng,
          centerLat,
          centerLng,
          this.travelMode,
          this.getPrimaryDisasterType(center.disaster_type)
        );
      }
    }
  }

  /**
   * Show emergency alert for disaster notifications (non-earthquake)
   */
  private async showDisasterEmergencyAlert(params: any): Promise<void> {
    const disasterEmojis: { [key: string]: string } = {
      'flood': '🌊',
      'typhoon': '🌪️',
      'fire': '🔥',
      'landslide': '⛰️',
      'default': '⚠️'
    };

    const emoji = disasterEmojis[params.category] || disasterEmojis['default'];
    const disasterName = params.category.toUpperCase();

    const alert = await this.alertCtrl.create({
      header: `${emoji} ${disasterName} EMERGENCY`,
      subHeader: params.title || 'Emergency Notification',
      message: `
        <div style="text-align: left;">
          <p><strong>Alert:</strong> ${params.message || `${disasterName} emergency detected`}</p>
          <p><strong>Severity:</strong> ${(params.severity || 'medium').toUpperCase()}</p>
          <p><strong>Action:</strong> Showing all evacuation centers for ${params.category} emergency</p>
          <p><strong>Map View:</strong> General evacuation centers map</p>
        </div>
      `,
      buttons: [
        {
          text: 'Show All Centers',
          role: 'confirm',
          cssClass: 'alert-button-confirm',
          handler: () => {
            console.log(`🚨 User confirmed viewing all centers for ${params.category} emergency`);
            // Emergency map will be loaded automatically
          }
        },
        {
          text: 'View Map Only',
          role: 'cancel',
          cssClass: 'alert-button-cancel',
          handler: () => {
            console.log('📍 User chose to view map without emergency centers');
            // Load clean map instead
            this.loadCleanMap();
          }
        }
      ],
      cssClass: 'emergency-alert'
    });

    await alert.present();
  }

  /**
   * Load emergency map with all evacuation centers for disaster notifications
   */
  private async loadEmergencyMap(): Promise<void> {
    console.log('🚨 EMERGENCY MAP: Loading all evacuation centers for emergency...');

    await this.loadingService.showLoading('Loading emergency evacuation centers...');

    try {
      // Get user location
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20000
      });

      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;

      console.log(`📍 User location: [${userLat}, ${userLng}]`);

      // Initialize map
      this.initializeMap(userLat, userLng);

      // Load ALL evacuation centers for emergency
      await this.loadEvacuationCenters(userLat, userLng);

      // Show emergency toast
      const toast = await this.toastController.create({
        message: '🚨 Emergency mode: Showing all evacuation centers',
        duration: 3000,
        color: 'danger',
        position: 'top',
        cssClass: 'emergency-toast'
      });
      await toast.present();

      await this.loadingService.dismissLoading();

    } catch (error) {
      console.error('❌ Error loading emergency map:', error);
      await this.loadingService.dismissLoading();

      // Fallback to clean map
      this.loadCleanMap();

      const toast = await this.toastController.create({
        message: '⚠️ Could not load emergency centers. Showing basic map.',
        duration: 3000,
        color: 'warning',
        position: 'top'
      });
      await toast.present();
    }
  }

  /**
   * Start device orientation tracking for directional marker
   */
  private startOrientationTracking(): void {
    console.log('🧭 Starting orientation tracking...');

    if (typeof DeviceOrientationEvent !== 'undefined') {
      console.log('🧭 DeviceOrientationEvent is supported');

      // Check if we need to request permission (iOS 13+)
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        console.log('🧭 Requesting device orientation permission (iOS 13+)...');
        (DeviceOrientationEvent as any).requestPermission()
          .then((response: string) => {
            console.log('🧭 Permission response:', response);
            if (response === 'granted') {
              this.addOrientationListener();
            } else {
              console.log('🧭 Device orientation permission denied');
              // Show toast to user
              this.toastCtrl.create({
                message: 'Please allow device orientation access for compass direction',
                duration: 5000,
                color: 'warning'
              }).then(toast => toast.present());
            }
          })
          .catch((error: any) => {
            console.error('🧭 Error requesting device orientation permission:', error);
          });
      } else {
        // Permission not required, add listener directly
        console.log('🧭 No permission required, adding listener directly');
        this.addOrientationListener();
      }
    } else {
      console.log('🧭 Device orientation not supported on this device/browser');
      // Show toast to user
      this.toastCtrl.create({
        message: 'Device orientation not supported - direction arrow will point north',
        duration: 3000,
        color: 'medium'
      }).then(toast => toast.present());
    }
  }

  /**
   * Add device orientation event listener
   */
  private addOrientationListener(): void {
    console.log('🧭 Adding orientation event listeners...');

    // Try absolute orientation first (more accurate)
    window.addEventListener('deviceorientationabsolute', this.handleOrientation.bind(this), true);
    console.log('🧭 Added deviceorientationabsolute listener');

    // Fallback to regular orientation
    window.addEventListener('deviceorientation', this.handleOrientation.bind(this), true);
    console.log('🧭 Added deviceorientation listener');

    // Test if we can get initial orientation
    setTimeout(() => {
      console.log('🧭 Testing initial orientation after 2 seconds...');
      console.log('🧭 Current device heading:', this.deviceHeading);
      if (this.deviceHeading === 0) {
        console.log('🧭 No orientation data received yet - this might be normal on some devices');
      }
    }, 2000);
  }

  /**
   * Handle device orientation change
   */
  private handleOrientation(event: DeviceOrientationEvent): void {
    if (event.alpha !== null) {
      // Use webkitCompassHeading for iOS, alpha for Android
      const heading = (event as any).webkitCompassHeading || (360 - event.alpha);
      const oldHeading = this.deviceHeading;
      this.deviceHeading = heading;
      console.log('🧭 Device heading updated from', oldHeading, 'to', this.deviceHeading);
      console.log('🧭 Raw orientation data:', {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
        webkitCompassHeading: (event as any).webkitCompassHeading
      });
      // Update user marker rotation if it exists
      this.updateUserMarkerDirection();
    } else {
      console.log('🧭 No orientation data available (alpha is null)');
    }
  }

  /**
   * Stop orientation tracking
   */
  private stopOrientationTracking(): void {
    window.removeEventListener('deviceorientationabsolute', this.handleOrientation.bind(this), true);
    window.removeEventListener('deviceorientation', this.handleOrientation.bind(this), true);
  }

  /**
   * Create directional user marker with heading indicator
   * Enhanced for driving/movement tracking with better visibility
   */
  private createDirectionalUserMarker(lat: number, lng: number): L.Marker {
    console.log('🧭 Creating enhanced directional marker with heading:', this.deviceHeading);
    console.log('🧭 Marker will be created at coordinates:', [lat, lng]);

    const markerHtml = `
      <div class="directional-user-marker" style="position: relative; width: 44px; height: 44px;">
        <!-- Pulsing background circle for better visibility -->
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          width: 40px;
          height: 40px;
          margin-top: -20px;
          margin-left: -20px;
          background: rgba(59, 130, 246, 0.3);
          border-radius: 50%;
          z-index: 0;
          animation: pulse 2s infinite;
        "></div>

        <!-- Main location icon -->
        <img src="assets/myLocation.png" alt="Your location" style="
          width: 32px;
          height: 32px;
          position: absolute;
          top: 6px;
          left: 6px;
          z-index: 1;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        ">

        <!-- Direction arrow pointing north - ENHANCED VISIBILITY -->
        <div class="direction-arrow" style="
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%) rotate(${this.deviceHeading}deg);
          width: 0;
          height: 0;
          border-left: 10px solid transparent;
          border-right: 10px solid transparent;
          border-bottom: 20px solid #FF4444;
          z-index: 3;
          filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.6));
          transition: transform 0.3s ease;
        "></div>

        <!-- Secondary arrow for better visibility -->
        <div style="
          position: absolute;
          top: -6px;
          left: 50%;
          transform: translateX(-50%) rotate(${this.deviceHeading}deg);
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 12px solid #FFFFFF;
          z-index: 2;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.8));
        "></div>

        <!-- Compass ring for better direction indication -->
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          width: 42px;
          height: 42px;
          margin-top: -21px;
          margin-left: -21px;
          border: 2px solid rgba(59, 130, 246, 0.6);
          border-radius: 50%;
          z-index: 0;
        "></div>
      </div>
    `;

    console.log('🧭 Generated marker HTML:', markerHtml);

    const directionalIcon = L.divIcon({
      html: markerHtml,
      className: 'custom-directional-marker',
      iconSize: [44, 44],
      iconAnchor: [22, 38]
    });

    // Use high precision coordinates for user marker stability
    const preciseLat = parseFloat(Number(lat).toFixed(8));
    const preciseLng = parseFloat(Number(lng).toFixed(8));

    const marker = L.marker([preciseLat, preciseLng], {
      icon: directionalIcon,
      // Add stability options for user marker
      riseOnHover: false,
      riseOffset: 0,
      zIndexOffset: 1000, // Keep user marker on top
      opacity: 1,
      interactive: true,
      bubblingMouseEvents: true
    });

    console.log('🧭 Directional marker created successfully!');
    return marker;
  }

  /**
   * Update user marker direction based on device heading
   */
  private updateUserMarkerDirection(): void {
    console.log('🧭 Updating marker direction to:', this.deviceHeading);
    if (this.userMarker) {
      const markerElement = this.userMarker.getElement();
      console.log('🧭 Marker element found:', !!markerElement);
      if (markerElement) {
        const directionArrows = markerElement.querySelectorAll('.direction-arrow');
        console.log('🧭 Direction arrows found:', directionArrows.length);

        // Update all direction arrows (primary and secondary)
        directionArrows.forEach((arrow, index) => {
          (arrow as HTMLElement).style.transform = `translateX(-50%) rotate(${this.deviceHeading}deg)`;
          console.log(`🧭 Updated arrow ${index + 1} rotation to ${this.deviceHeading}deg`);
        });

        // Also update any other elements that might have the rotation
        const allRotatableElements = markerElement.querySelectorAll('[style*="rotate"]');
        allRotatableElements.forEach((element, index) => {
          const currentStyle = (element as HTMLElement).style.transform;
          if (currentStyle.includes('rotate')) {
            const newStyle = currentStyle.replace(/rotate\([^)]*\)/, `rotate(${this.deviceHeading}deg)`);
            (element as HTMLElement).style.transform = newStyle;
            console.log(`🧭 Updated rotatable element ${index + 1} to ${this.deviceHeading}deg`);
          }
        });
      } else {
        console.log('🧭 No marker element found - marker might not be created yet');
      }
    } else {
      console.log('🧭 No user marker exists to update direction');
    }
  }

  /**
   * Convert heading degrees to compass direction
   */
  private getCompassDirection(heading: number): string {
    const directions = [
      'N', 'NNE', 'NE', 'ENE',
      'E', 'ESE', 'SE', 'SSE',
      'S', 'SSW', 'SW', 'WSW',
      'W', 'WNW', 'NW', 'NNW'
    ];

    // Normalize heading to 0-360 range
    const normalizedHeading = ((heading % 360) + 360) % 360;

    // Calculate index (16 directions, so 360/16 = 22.5 degrees per direction)
    const index = Math.round(normalizedHeading / 22.5) % 16;

    return directions[index];
  }

  /**
   * Force recreate directional marker for testing
   */
  public forceRecreateDirectionalMarker(): void {
    console.log('🧭 FORCE RECREATE: Starting...');

    if (this.userMarker && this.map) {
      const currentPos = this.userMarker.getLatLng();
      console.log('🧭 FORCE RECREATE: Current position:', currentPos);

      // Remove existing marker
      this.map.removeLayer(this.userMarker);
      console.log('🧭 FORCE RECREATE: Removed old marker');

      // Set a test heading for visibility
      this.deviceHeading = 45; // Northeast
      console.log('🧭 FORCE RECREATE: Set test heading to 45°');

      // Create new directional marker
      this.userMarker = this.createDirectionalUserMarker(currentPos.lat, currentPos.lng).addTo(this.map);
      console.log('🧭 FORCE RECREATE: Created new directional marker');

      // Update popup
      this.userMarker.bindPopup(`
        📍 You are here! (FORCE RECREATED)<br>
        🧭 Test Heading: NE (45°)<br>
        <small>Arrow should point Northeast</small>
      `).openPopup();

      console.log('🧭 FORCE RECREATE: Complete!');

      // Show toast
      this.toastCtrl.create({
        message: '🧭 Directional marker recreated with test heading (45° NE)',
        duration: 5000,
        color: 'success'
      }).then(toast => toast.present());
    } else {
      console.log('🧭 FORCE RECREATE: No user marker or map available');
    }
  }
}