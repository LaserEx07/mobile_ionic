import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { environment } from 'src/environments/environment';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController, ToastController, ModalController } from '@ionic/angular';
import { LoadingService } from '../../services/loading.service';
import { NetworkService } from '../../services/network.service';
import { MapboxRoutingService } from '../../services/mapbox-routing.service';
import * as L from 'leaflet';
import { Geolocation } from '@capacitor/geolocation';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';

interface EvacuationCenter {
  name: string;
  latitude: number;
  longitude: number;
  disaster_type: string;
  address?: string;
  capacity?: number;
  status?: string;
}

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
  selector: 'app-disaster-map-modal',
  templateUrl: './disaster-map-modal.component.html',
  styleUrls: ['./disaster-map-modal.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class DisasterMapModalComponent implements OnInit, OnDestroy {
  private map!: L.Map;
  private userMarker: L.Marker<any> | null = null;
  private evacuationCenters: EvacuationCenter[] = [];
  public gpsEnabled = true;
  private loadingService = inject(LoadingService);
  private networkService = inject(NetworkService);
  private mapboxRouting = inject(MapboxRoutingService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private modalCtrl = inject(ModalController);
  private http = inject(HttpClient);
  private watchId: string | number | null = null;

  private ORS_API_KEY = environment.orsApiKey;
  travelMode: string = 'foot-walking';
  routeTime: number | null = null;
  routeDistance: number | null = null;
  disasterType: string = 'all'; // Default to 'all', will be set via input property

  constructor() {
    // The disasterType will be passed via componentProps in the modal creation
  }

  dismissModal() {
    this.modalCtrl.dismiss();
  }

  async ngOnInit() {
    // Normalize the disaster type
    if (this.disasterType) {
      this.disasterType = this.disasterType.toLowerCase();
      console.log(`Initializing map for disaster type: ${this.disasterType}`);
    }

    await this.loadMapWithUserLocation();
  }

  // Helper method to get position with fallback to browser API
  async getCurrentPositionWithFallback(): Promise<GeolocationPosition> {
    try {
      // Try Capacitor Geolocation first
      console.log('Trying Capacitor Geolocation...');

      // Check permissions first (only in native environment)
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

      try {
        console.log('Getting current position via Capacitor...');
        const capPosition = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 30000 // Increased timeout
        });
        // Convert to our GeolocationPosition type
        return capPosition as unknown as GeolocationPosition;
      } catch (capError) {
        console.log('Capacitor Geolocation failed, trying browser fallback:', capError);
        throw capError; // Throw to trigger browser fallback
      }
    } catch (error) {
      // If Capacitor fails, try browser's navigator.geolocation
      console.log('Trying browser geolocation fallback...');

      // Show alert to user about enabling location
      const alert = await this.alertCtrl.create({
        header: 'Location Access Required',
        message: 'This app needs access to your location to show nearby evacuation centers. ' +
                 'Please enable location access in your browser settings and try again.',
        buttons: ['OK']
      });
      await alert.present();

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
            async (error) => {
              console.error('Browser geolocation failed:', error);

              // Show more specific error message based on error code
              let errorMessage = 'Unable to access your location. ';

              if (error.code === 1) {
                errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
              } else if (error.code === 2) {
                errorMessage = 'Your location is currently unavailable. Please check your device\'s location settings.';
              } else if (error.code === 3) {
                errorMessage = 'Location request timed out. Please try again.';
              }

              const errorAlert = await this.alertCtrl.create({
                header: 'Location Error',
                message: errorMessage,
                buttons: ['OK']
              });
              await errorAlert.present();

              reject(error);
            },
            {
              enableHighAccuracy: true,
              timeout: 30000, // Increased timeout
              maximumAge: 0 // Always get fresh position
            }
          );
        });
      } else {
        console.error('Geolocation not available in this browser');

        const noGeoAlert = await this.alertCtrl.create({
          header: 'Geolocation Not Supported',
          message: 'Your browser does not support geolocation. Please try using a different browser.',
          buttons: ['OK']
        });
        await noGeoAlert.present();

        throw new Error('Geolocation not available in this browser');
      }
    }
  }

  ngOnDestroy() {
    if (this.watchId) {
      // Clear the appropriate watch based on type
      if (typeof this.watchId === 'string') {
        try {
          // We know watchId is a string here, so it's safe to pass to Capacitor
          const capWatchId: string = this.watchId;
          Geolocation.clearWatch({ id: capWatchId });
        } catch (error) {
          console.log('Error clearing Capacitor watch:', error);
        }
      } else if (typeof this.watchId === 'number') {
        try {
          navigator.geolocation.clearWatch(this.watchId);
        } catch (error) {
          console.log('Error clearing browser watch:', error);
        }
      }
      this.watchId = null;
    }
    if (this.map) {
      this.map.remove();
    }
  }

  async toggleGps(event: any) {
    console.log('GPS toggle:', event.detail.checked);
    this.gpsEnabled = event.detail.checked;

    if (!this.gpsEnabled) {
      console.log('Disabling GPS tracking...');
      if (this.userMarker) {
        this.userMarker.remove();
      }
      if (this.watchId) {
        // Clear the appropriate watch based on type
        if (typeof this.watchId === 'string') {
          try {
            // We know watchId is a string here, so it's safe to pass to Capacitor
            const capWatchId: string = this.watchId;
            Geolocation.clearWatch({ id: capWatchId });
          } catch (error) {
            console.log('Error clearing Capacitor watch:', error);
          }
        } else if (typeof this.watchId === 'number') {
          try {
            navigator.geolocation.clearWatch(this.watchId);
          } catch (error) {
            console.log('Error clearing browser watch:', error);
          }
        }
        this.watchId = null;
      }
    } else {
      console.log('Enabling GPS tracking...');

      try {
        // Get current position using our fallback method
        const position = await this.getCurrentPositionWithFallback();

        console.log('Position on toggle:', position);
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        // Update user marker
        if (this.userMarker) {
          this.userMarker.setLatLng([lat, lng]);
          this.userMarker.addTo(this.map);
        } else {
          this.updateUserMarker(lat, lng);
        }

        // Center map on user
        this.map.setView([lat, lng], 15);

        // Start watching position
        this.startWatchingPosition();
      } catch (error) {
        console.error('Error enabling GPS:', error);
        this.gpsEnabled = false;

        // Show error toast
        const toast = await this.toastCtrl.create({
          message: 'Failed to enable GPS. Please check your location settings.',
          duration: 3000,
          color: 'danger'
        });
        toast.present();
      }
    }
  }

  async loadMapWithUserLocation() {
    await this.loadingService.showLoading('Initializing map...');

    // Initialize empty map without any default location
    this.initializeEmptyMap();
    await this.loadingService.dismissLoading();

    // Ask user to enable GPS
    const alert = await this.alertCtrl.create({
      header: 'GPS Required',
      message: 'This app requires GPS to show evacuation routes. Please enable GPS to continue.',
      buttons: [
        {
          text: 'Enable GPS',
          handler: () => {
            this.enableGPS();
          }
        },
        {
          text: 'Cancel',
          role: 'cancel',
          handler: () => {
            console.log('User declined to enable GPS');
            this.showGPSRequiredMessage();
          }
        }
      ]
    });

    await alert.present();
  }

  // Show a message that GPS is required
  showGPSRequiredMessage() {
    this.toastCtrl.create({
      message: 'GPS is required to show evacuation routes. Please enable GPS when ready.',
      duration: 5000,
      color: 'warning',
      position: 'middle',
      buttons: [
        {
          text: 'Enable GPS',
          handler: () => {
            this.enableGPS();
          }
        }
      ]
    }).then(toast => toast.present());
  }

  // Enable GPS with user permission
  async enableGPS() {
    console.log('User granted permission to enable GPS');
    this.gpsEnabled = true;

    await this.loadingService.showLoading('Getting your location...');

    try {
      // Try to get actual user location
      console.log('Getting user location...');
      const position = await this.getCurrentPositionWithFallback();

      console.log('Position received:', position);
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      // Initialize map with real GPS location
      this.initializeMap(lat, lng);

      // Start watching position for continuous updates
      this.startWatchingPosition();

      this.toastCtrl.create({
        message: 'GPS enabled! Showing your real location',
        duration: 3000,
        color: 'success'
      }).then(toast => toast.present());
    } catch (error: any) {
      console.error('Error getting location', error);

      // More detailed error message
      let errorMessage = 'Unable to access your location. ';

      if (error.code === 1) {
        errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
      } else if (error.code === 2) {
        errorMessage = 'Position unavailable. Your GPS signal might be weak or unavailable.';
      } else if (error.code === 3) {
        errorMessage = 'Location request timed out. Please check your device\'s location settings.';
      } else {
        errorMessage = 'Please enable GPS or try again. ' + (error.message || '');
      }

      const alert = await this.alertCtrl.create({
        header: 'Location Access Required',
        message: errorMessage,
        buttons: [
          {
            text: 'Retry',
            handler: () => {
              this.enableGPS(); // Retry GPS
            }
          },
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => {
              this.gpsEnabled = false;
              this.showGPSRequiredMessage();
            }
          }
        ]
      });
      await alert.present();
    } finally {
      await this.loadingService.dismissLoading();
    }
  }

  startWatchingPosition() {
    if (this.watchId) {
      console.log('Clearing previous watch...');

      // Clear Capacitor watch if it's a string (Capacitor ID)
      if (typeof this.watchId === 'string') {
        try {
          // We know watchId is a string here, so it's safe to pass to Capacitor
          const capWatchId: string = this.watchId;
          Geolocation.clearWatch({ id: capWatchId });
        } catch (error) {
          console.log('Error clearing Capacitor watch:', error);
        }
      }
      // Clear browser watch if it's a number (Browser ID)
      else if (typeof this.watchId === 'number') {
        try {
          navigator.geolocation.clearWatch(this.watchId);
        } catch (error) {
          console.log('Error clearing browser watch:', error);
        }
      }

      this.watchId = null;
    }

    console.log('Starting position watch...');

    try {
      // Try to use Capacitor Geolocation first
      this.watchId = Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 10000
        },
        (position, err) => {
          if (position && this.gpsEnabled) {
            console.log('Capacitor watch position update:', position);
            this.updateUserMarker(position.coords.latitude, position.coords.longitude);
          }
          if (err) {
            console.error('Error watching position:', err);
            // Show a toast for persistent watch errors
            this.toastCtrl.create({
              message: 'GPS signal lost or weak. Please check your location settings.',
              duration: 3000,
              color: 'warning'
            }).then(toast => toast.present());
          }
        }
      ) as unknown as string;

      console.log('Capacitor watch started with ID:', this.watchId);
    } catch (error) {
      console.log('Capacitor watch failed, trying browser fallback:', error);

      // Fallback to browser geolocation
      if (navigator.geolocation) {
        // First get a single position to update the map immediately
        navigator.geolocation.getCurrentPosition(
          (position) => {
            console.log('Initial browser position:', position);
            this.updateUserMarker(position.coords.latitude, position.coords.longitude);

            // Then start watching for position changes
            this.watchId = navigator.geolocation.watchPosition(
              (position) => {
                if (this.gpsEnabled) {
                  console.log('Browser watch position update:', position);
                  this.updateUserMarker(position.coords.latitude, position.coords.longitude);
                }
              },
              (error) => {
                console.error('Browser watch error:', error);
                // Show a toast for persistent watch errors
                this.toastCtrl.create({
                  message: 'GPS signal lost or weak. Please check your location settings.',
                  duration: 3000,
                  color: 'warning'
                }).then(toast => toast.present());
              },
              {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0 // Always get fresh position
              }
            );

            console.log('Browser watch started with ID:', this.watchId);
          },
          (error) => {
            console.error('Error getting initial browser position:', error);

            // Fall back to just watching
            this.watchId = navigator.geolocation.watchPosition(
              (position) => {
                if (this.gpsEnabled) {
                  console.log('Browser watch position update:', position);
                  this.updateUserMarker(position.coords.latitude, position.coords.longitude);
                }
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
                timeout: 10000,
                maximumAge: 0
              }
            );

            console.log('Browser watch started with ID:', this.watchId);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      } else {
        console.error('Geolocation watching not available');
      }
    }
  }

  // Initialize an empty map without any default location or markers
  initializeEmptyMap() {
    if (this.map) {
      this.map.remove();
    }

    console.log('Initializing empty map without default location');

    // Initialize map centered on Philippines (no specific location)
    // Using a very zoomed out view of the Philippines
    this.map = L.map('map').setView([12.8797, 121.7740], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'OpenStreetMap contributors'
    }).addTo(this.map);

    // Add a message overlay to the map
    const messageDiv = L.DomUtil.create('div', 'map-message');
    messageDiv.innerHTML = '<div class="message-box">Please enable GPS to see evacuation routes</div>';
    document.getElementById('map')?.appendChild(messageDiv);

    // Load evacuation centers without calculating routes
    this.loadEvacuationCentersWithoutRoutes();
  }

  // Load evacuation centers without calculating routes to them
  async loadEvacuationCentersWithoutRoutes() {
    try {
      console.log('Fetching evacuation centers from:', `${environment.apiUrl}/evacuation-centers`);

      const apiResponse = await firstValueFrom(
        this.http.get<{success: boolean, data: EvacuationCenter[], count: number}>(`${environment.apiUrl}/evacuation-centers`)
      );

      console.log('Received centers from API:', apiResponse);
      this.evacuationCenters = apiResponse.data || [];

      // Add markers for evacuation centers
      this.evacuationCenters.forEach(center => {
        const lat = Number(center.latitude);
        const lng = Number(center.longitude);

        if (!isNaN(lat) && !isNaN(lng)) {
          // Choose icon based on disaster type
          let iconUrl = 'assets/forTyphoon.png'; // Default

          const centerType = this.getNormalizedDisasterType(center.disaster_type);

          if (centerType === 'earthquake') {
            iconUrl = 'assets/forEarthquake.png';
          } else if (centerType === 'flood' || centerType === 'flashflood') {
            iconUrl = 'assets/forFlood.png';
          } else if (centerType === 'typhoon') {
            iconUrl = 'assets/forTyphoon.png';
          } else if (centerType === 'fire') {
            iconUrl = 'assets/forFire.png';
          } else if (centerType === 'landslide') {
            iconUrl = 'assets/forLandslide.png';
          }

          // Create and add the marker
          const marker = L.marker([lat, lng], {
            icon: L.icon({
              iconUrl: iconUrl,
              iconSize: [32, 32],
              iconAnchor: [16, 32]
            })
          });

          // Add popup with center details
          marker.bindPopup(
            `<b>${center.name || 'Evacuation Center'}</b><br>` +
            `Type: ${center.disaster_type}<br>` +
            (center.capacity ? `Capacity: ${center.capacity} people<br>` : '') +
            (center.status ? `Status: ${center.status}` : '')
          );

          // Add marker to map
          marker.addTo(this.map);
        }
      });
    } catch (error) {
      console.error('Failed to load evacuation centers', error);
    }
  }

  // Initialize map with user's real GPS location
  initializeMap(lat: number, lng: number) {
    if (this.map) {
      this.map.remove();
    }

    console.log(`Initializing map with real GPS coordinates: [${lat}, ${lng}]`);
    this.map = L.map('map').setView([lat, lng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'OpenStreetMap contributors'
    }).addTo(this.map);

    // Create a real user marker with GPS data
    this.userMarker = L.marker([lat, lng], {
      icon: L.icon({
        iconUrl: 'assets/Location.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      })
    }).addTo(this.map).bindPopup('You are here (Real GPS location)').openPopup();

    // Load evacuation centers and calculate routes
    this.loadEvacuationCenters(lat, lng);
  }

  updateUserMarker(lat: number, lng: number) {
    console.log(`Updating user marker with real GPS coordinates: [${lat}, ${lng}]`);

    // Remove any temporary markers
    this.map.eachLayer(layer => {
      if (layer instanceof L.Marker && layer !== this.userMarker &&
          layer.getIcon().options.className === 'blinking') {
        console.log('Removing temporary marker');
        this.map.removeLayer(layer);
      }
    });

    // Show a toast to indicate we're now using real GPS
    if (!this.userMarker) {
      this.toastCtrl.create({
        message: 'GPS signal acquired! Showing your real location',
        duration: 3000,
        color: 'success',
        position: 'top'
      }).then(toast => toast.present());
    }

    if (this.userMarker) {
      // Get the old position
      const oldPosition = this.userMarker.getLatLng();

      // Set the new position
      this.userMarker.setLatLng([lat, lng]);
      this.map.setView([lat, lng]);

      // Calculate distance moved in meters
      const distanceMoved = this.calculateDistance(
        oldPosition.lat, oldPosition.lng,
        lat, lng
      );

      console.log(`User moved ${distanceMoved.toFixed(2)} meters from previous position`);

      // If moved more than 20 meters, recalculate routes
      if (distanceMoved > 20) {
        console.log(`Significant movement detected, recalculating routes`);
        // Clear existing routes
        this.map.eachLayer(layer => {
          if (layer instanceof L.GeoJSON) {
            this.map.removeLayer(layer);
          }
        });

        // Recalculate routes if we have evacuation centers
        if (this.evacuationCenters && this.evacuationCenters.length > 0) {
          this.routeToTwoNearestCenters();
        }
      }
    } else {
      // Create a new user marker with real GPS data
      this.userMarker = L.marker([lat, lng], {
        icon: L.icon({
          iconUrl: 'assets/myLocation.png',
          iconSize: [32, 32],
          iconAnchor: [16, 32]
        })
      }).addTo(this.map).bindPopup('You are here (Real GPS location)').openPopup();

      console.log('Created new user marker with real GPS data');

      // Calculate routes now that we have real GPS
      if (this.evacuationCenters && this.evacuationCenters.length > 0) {
        console.log('Calculating initial routes with real GPS data');
        this.routeToTwoNearestCenters();
      }
    }
  }

  async loadEvacuationCenters(userLat: number, userLng: number) {
    try {
      console.log('Fetching evacuation centers from:', `${environment.apiUrl}/evacuation-centers`);

      // Add debugging to see the raw API response
      this.http.get(`${environment.apiUrl}/evacuation-centers`).subscribe({
        next: (rawResponse) => {
          console.log('Raw API response:', rawResponse);
        },
        error: (error) => {
          console.error('API request error:', error);
        }
      });

      const apiResponse = await firstValueFrom(
        this.http.get<{success: boolean, data: EvacuationCenter[], count: number}>(`${environment.apiUrl}/evacuation-centers`)
      );

      console.log('Received centers from API:', apiResponse);
      const centers = apiResponse.data || [];
      console.log('Number of centers received:', centers ? centers.length : 0);

      // Filter centers by disaster type if specified
      if (this.disasterType && this.disasterType !== 'all') {
        // Convert to lowercase and normalize for comparison
        const normalizedType = this.getNormalizedDisasterType(this.disasterType);
        console.log('Filtering for normalized disaster type:', normalizedType);

        this.evacuationCenters = centers.filter(center => {
          const centerType = this.getNormalizedDisasterType(center.disaster_type);
          console.log(`Center: ${center.name}, Type: ${center.disaster_type}, Normalized: ${centerType}`);
          return centerType === normalizedType;
        });

        console.log(`Filtered ${this.evacuationCenters.length} centers for disaster type: ${this.disasterType}`);
      } else {
        this.evacuationCenters = centers || [];
        console.log('Using all centers, count:', this.evacuationCenters.length);
      }

      // Clear existing markers
      this.map.eachLayer(layer => {
        if (layer instanceof L.Marker && layer !== this.userMarker) {
          this.map.removeLayer(layer);
        }
      });

      // Add markers for evacuation centers
      console.log('Adding markers for evacuation centers:', this.evacuationCenters);

      if (this.evacuationCenters.length === 0) {
        console.warn('No evacuation centers to display!');
      }

      this.evacuationCenters.forEach(center => {
        console.log('Processing center:', center);

        // Check if latitude and longitude are valid
        const lat = Number(center.latitude);
        const lng = Number(center.longitude);

        console.log(`Center coordinates: lat=${lat}, lng=${lng}, valid=${!isNaN(lat) && !isNaN(lng)}`);

        if (!isNaN(lat) && !isNaN(lng)) {
          // Choose icon based on disaster type
          let iconUrl = 'assets/forOthers.png'; // Default

          const centerType = this.getNormalizedDisasterType(center.disaster_type);
          console.log(`Center disaster type: ${center.disaster_type}, normalized: ${centerType}`);

          // Check if it's an "Others:" type
          if (typeof center.disaster_type === 'string' && center.disaster_type.startsWith('Others:')) {
            iconUrl = 'assets/forOthers.png';
          } else if (centerType === 'Earthquake') {
            iconUrl = 'assets/forEarthquake.png';
          } else if (centerType === 'Flood') {
            iconUrl = 'assets/forFlood.png';
          } else if (centerType === 'Typhoon') {
            iconUrl = 'assets/forTyphoon.png';
          } else if (centerType === 'Fire') {
            iconUrl = 'assets/forFire.png';
          } else if (centerType === 'Landslide') {
            iconUrl = 'assets/forLandslide.png';
          } else if (centerType === 'Others') {
            iconUrl = 'assets/forOthers.png';
          }

          console.log(`Using icon: ${iconUrl}`);

          // Create and add the marker
          const marker = L.marker([lat, lng], {
            icon: L.icon({
              iconUrl: iconUrl,
              iconSize: [32, 32],
              iconAnchor: [16, 32]
            })
          });

          // Add popup with center details
          marker.bindPopup(
            `<b>${center.name || 'Evacuation Center'}</b><br>` +
            `Type: ${center.disaster_type}<br>` +
            (center.capacity ? `Capacity: ${center.capacity} people<br>` : '') +
            (center.status ? `Status: ${center.status}` : '')
          );

          // Add marker to map
          marker.addTo(this.map);
          console.log('Marker added to map');
        } else {
          console.error(`Invalid coordinates for center: ${center.name}`);
        }
      });

      // Only calculate routes if GPS is enabled and we have a real user marker
      if (this.gpsEnabled && this.userMarker) {
        const nearest = this.findNearestCenter(userLat, userLng, this.evacuationCenters);

        if (nearest) {
          // Get the actual user position from the marker (real GPS)
          const userPosition = this.userMarker.getLatLng();

          // Only calculate routes if we're using real GPS coordinates
          await this.getRealRoute(userPosition.lat, userPosition.lng, Number(nearest.latitude), Number(nearest.longitude));

          const distanceInMeters = this.calculateDistance(userPosition.lat, userPosition.lng, Number(nearest.latitude), Number(nearest.longitude));
          this.userMarker.bindPopup(
            `You are here. <br> Nearest: ${nearest.name} <br> Distance: ${(distanceInMeters / 1000).toFixed(2)} km`
          ).openPopup();
        }
      } else {
        // Just center the map without calculating routes
        console.log('GPS not enabled or no user marker, skipping route calculation');
        this.map.setView([userLat, userLng], 15);
      }

    } catch (error) {
      console.error('Failed to load evacuation centers', error);
    }
  }

  findTwoNearestCenters(userLat: number, userLng: number, centers: any[]) {
    if (!centers.length) return [];

    // Filter centers by disaster type if specified
    let filteredCenters = centers;
    if (this.disasterType && this.disasterType !== 'all') {
      const normalizedType = this.getNormalizedDisasterType(this.disasterType);
      filteredCenters = centers.filter(center => {
        const centerType = this.getNormalizedDisasterType(center.disaster_type);
        return centerType === normalizedType;
      });

      // If no centers match the disaster type, fall back to all centers
      if (filteredCenters.length === 0) {
        console.log(`No centers found for disaster type: ${this.disasterType}, using all centers`);
        filteredCenters = centers;
      }
    }

    // Sort by distance
    const sorted = [...filteredCenters].sort((a, b) => {
      const distA = this.calculateDistance(userLat, userLng, Number(a.latitude), Number(a.longitude));
      const distB = this.calculateDistance(userLat, userLng, Number(b.latitude), Number(b.longitude));
      return distA - distB;
    });

    return sorted.slice(0, 2);
  }

  updateRoute() {
    this.routeToTwoNearestCenters();
  }

  async routeToTwoNearestCenters() {
    try {
      // Only proceed if GPS is enabled
      if (!this.gpsEnabled) {
        console.log('GPS is disabled, not calculating routes');
        const toast = await this.toastCtrl.create({
          message: 'Please enable GPS to see evacuation routes',
          duration: 3000,
          color: 'warning'
        });
        toast.present();
        return;
      }

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
          // Create user marker if it doesn't exist
          this.userMarker = L.marker([freshLat, freshLng], {
            icon: L.icon({
              iconUrl: 'assets/myLocation.png',
              iconSize: [32, 32],
              iconAnchor: [16, 32]
            })
          }).addTo(this.map);
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

        // Calculate fresh routes from current position
        for (const center of nearestTwo) {
          console.log(`Calculating route from [${userLat}, ${userLng}] to center: ${center.name}`);
          await this.getRealRoute(userLat, userLng, Number(center.latitude), Number(center.longitude), this.travelMode);
        }

        if (this.userMarker) {
          let popupMsg = `You are here (Real-time GPS).`;
          nearestTwo.forEach((center, idx) => {
            const distanceInMeters = this.calculateDistance(userLat, userLng, Number(center.latitude), Number(center.longitude));
            popupMsg += `<br> #${idx+1}: ${center.name} <br> Distance: ${(distanceInMeters / 1000).toFixed(2)} km`;
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
      console.error('General error in routeToTwoNearestCenters:', error);
      const toast = await this.toastCtrl.create({
        message: 'Failed to get your location or route.',
        duration: 3000,
        color: 'danger'
      });
      toast.present();
      console.error('Failed to route to two nearest centers', error);
    }
  }

  async getRealRoute(startLat: number, startLng: number, endLat: number, endLng: number, travelMode: string = this.travelMode) {
    console.log(`Calculating route from [${startLat}, ${startLng}] to [${endLat}, ${endLng}] using ${travelMode}`);

    // Validate coordinates
    if ([startLat, startLng, endLat, endLng].some(val => typeof val !== 'number' || isNaN(val))) {
      console.error('Invalid route coordinates:', { startLat, startLng, endLat, endLng });
      const toast = await this.toastCtrl.create({
        message: 'Invalid route coordinates. Cannot request directions.',
        duration: 3000,
        color: 'danger'
      });
      toast.present();
      return null;
    }

    // Check coordinate ranges
    if (
      Math.abs(startLat) > 90 || Math.abs(endLat) > 90 ||
      Math.abs(startLng) > 180 || Math.abs(endLng) > 180
    ) {
      console.error('Route coordinates out of range:', { startLat, startLng, endLat, endLng });
      const toast = await this.toastCtrl.create({
        message: 'Route coordinates out of range. Cannot request directions.',
        duration: 3000,
        color: 'danger'
      });
      toast.present();
      return null;
    }

    // Calculate straight-line distance
    const directDistance = this.calculateDistance(startLat, startLng, endLat, endLng);
    console.log(`Direct distance: ${(directDistance/1000).toFixed(2)} km`);

    // If the distance is too short, don't calculate a route
    if (directDistance < 50) { // Less than 50 meters
      console.log('Distance too short, skipping route calculation');
      return null;
    }

    try {
      console.log('Sending route request to Mapbox');

      // Convert travel mode to Mapbox profile
      const mapboxProfile = this.mapboxRouting.convertTravelModeToProfile(travelMode);

      // Get directions from Mapbox
      const response = await this.mapboxRouting.getDirections(
        startLng, startLat, endLng, endLat,
        mapboxProfile,
        {
          geometries: 'geojson',
          overview: 'full',
          steps: true
        }
      );

      if (!response.routes || response.routes.length === 0) {
        throw new Error('No routes found');
      }

      const route = response.routes[0];
      const routeGeoJSON = this.mapboxRouting.convertToGeoJSON(route);
      console.log('Mapbox route received:', routeGeoJSON);

      // Set different colors for different travel modes
      let routeColor = 'blue';
      if (travelMode === 'cycling-regular') routeColor = 'green';
      if (travelMode === 'driving-car') routeColor = 'red';

      // Create route layer with unique ID for later reference
      const routeId = `route-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const leafletRoute = L.geoJSON(routeGeoJSON, {
        style: {
          color: routeColor,
          weight: 4,
          opacity: 0.7
        }
      });

      // Add custom property to identify this layer
      (leafletRoute as any).routeId = routeId;

      // Add to map
      leafletRoute.addTo(this.map);
      console.log(`Added Mapbox route to map with ID: ${routeId}`);

      // Update route info from Mapbox response
      this.routeTime = route.duration; // Mapbox returns duration in seconds
      this.routeDistance = route.distance; // Mapbox returns distance in meters

      const summary = this.mapboxRouting.getRouteSummary(route);
      console.log(`Route summary: ${summary.durationText}, ${summary.distanceText}`);

      // Adjust map view to include both user location and route
      // But don't zoom out too far
      const bounds = leafletRoute.getBounds();
      const currentZoom = this.map.getZoom();
      this.map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: Math.min(currentZoom, 15) // Don't zoom out further than level 15
      });

      return leafletRoute;
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

      const toast = await this.toastCtrl.create({
        message: errorMessage,
        duration: 5000,
        color: 'danger'
      });
      toast.present();
      return null;
    }
  }

  findNearestCenter(userLat: number, userLng: number, centers: any[]) {
    if (!centers.length) return null;

    // Filter centers by disaster type if specified
    let filteredCenters = centers;
    if (this.disasterType && this.disasterType !== 'all') {
      const normalizedType = this.getNormalizedDisasterType(this.disasterType);
      filteredCenters = centers.filter(center => {
        const centerType = this.getNormalizedDisasterType(center.disaster_type);
        return centerType === normalizedType;
      });

      // If no centers match the disaster type, fall back to all centers
      if (filteredCenters.length === 0) {
        console.log(`No centers found for disaster type: ${this.disasterType}, using all centers`);
        filteredCenters = centers;
      }
    }

    if (!filteredCenters.length) return null;

    let nearest = filteredCenters[0];
    let minDistance = this.calculateDistance(userLat, userLng, Number(nearest.latitude), Number(nearest.longitude));

    for (const center of filteredCenters) {
      const dist = this.calculateDistance(userLat, userLng, Number(center.latitude), Number(center.longitude));
      if (dist < minDistance) {
        minDistance = dist;
        nearest = center;
      }
    }
    return nearest;
  }

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3;
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

  /**
   * Normalizes disaster type strings for consistent comparison with backend enum values
   * @param type The disaster type string to normalize
   * @returns Normalized disaster type string matching backend enum
   */
  getNormalizedDisasterType(type: string): string {
    if (!type) return 'unknown';

    // Direct match with backend enum values: 'Earthquake', 'Typhoon', 'Flood'
    if (type === 'Earthquake' || type === 'earthquake') {
      return 'Earthquake';
    } else if (type === 'Flood' || type === 'flood' || type === 'flashflood') {
      return 'Flood';
    } else if (type === 'Typhoon' || type === 'typhoon') {
      return 'Typhoon';
    }

    // Fallback for legacy data
    const lowerType = type.toLowerCase();
    if (lowerType.includes('earthquake') || lowerType.includes('quake')) {
      return 'Earthquake';
    } else if (lowerType.includes('flood') || lowerType.includes('flash')) {
      return 'Flood';
    } else if (lowerType.includes('typhoon') || lowerType.includes('storm') || lowerType.includes('hurricane')) {
      return 'Typhoon';
    }

    return type; // Return as-is if no match
  }
}