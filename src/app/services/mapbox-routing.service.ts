import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface MapboxRouteResponse {
  routes: MapboxRoute[];
  waypoints?: any[];
  code?: string;
}

export interface MapboxRoute {
  geometry: {
    coordinates: number[][];
    type: string;
  };
  legs: MapboxRouteLeg[];
  distance: number;
  duration: number;
  weight_name?: string;
  weight?: number;
}

export interface MapboxRouteLeg {
  distance: number;
  duration: number;
  steps?: MapboxRouteStep[];
}

export interface MapboxRouteStep {
  distance: number;
  duration: number;
  geometry: {
    coordinates: number[][];
    type: string;
  };
  name: string;
  mode: string;
  maneuver?: {
    type: string;
    instruction: string;
    bearing_after: number;
    bearing_before: number;
    location: number[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class MapboxRoutingService {
  private readonly MAPBOX_ACCESS_TOKEN = environment.mapboxAccessToken;
  private readonly MAPBOX_BASE_URL = 'https://api.mapbox.com/directions/v5/mapbox';

  // Real-time routing properties
  private currentRoute: MapboxRoute | null = null;
  private isRealTimeActive = false;
  private realTimeInterval: any = null;
  private lastUserPosition: { lat: number; lng: number } | null = null;
  private routeUpdateCallback: ((route: MapboxRoute) => void) | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Get directions using Mapbox Directions API
   */
  async getDirections(
    startLng: number,
    startLat: number,
    endLng: number,
    endLat: number,
    profile: 'driving' | 'walking' | 'cycling' = 'walking',
    options: any = {}
  ): Promise<MapboxRouteResponse> {
    console.log(`🗺️ Mapbox: Calculating route from [${startLat}, ${startLng}] to [${endLat}, ${endLng}] using ${profile}`);

    try {
      // Convert profile to Mapbox format
      const mapboxProfile = this.convertToMapboxProfile(profile);
      
      // Build coordinates string
      const coordinates = `${startLng},${startLat};${endLng},${endLat}`;
      
      // Build URL with parameters
      const params = new URLSearchParams({
        access_token: this.MAPBOX_ACCESS_TOKEN,
        geometries: 'geojson',
        overview: 'full',
        steps: 'true',
        ...options
      });

      const url = `${this.MAPBOX_BASE_URL}/${mapboxProfile}/${coordinates}?${params.toString()}`;
      console.log(`🌐 Mapbox request URL: ${url.substring(0, 100)}...`);

      const response = await this.http.get<MapboxRouteResponse>(url).toPromise();
      console.log('📡 Mapbox response:', response);

      if (response && response.routes && response.routes.length > 0) {
        console.log('✅ Successfully got route from Mapbox');
        console.log(`📏 Distance: ${(response.routes[0].distance/1000).toFixed(2)} km, Duration: ${Math.round(response.routes[0].duration/60)} min`);
        return response;
      }

      throw new Error('No routes found in Mapbox response');
    } catch (error: any) {
      console.error('❌ Mapbox routing error:', error);
      
      // Log more detailed error information
      if (error.status) {
        console.error(`HTTP Status: ${error.status}`);
      }
      if (error.error) {
        console.error('Error details:', error.error);
      }

      // Fallback to straight line route
      console.log('🔄 Falling back to straight-line route');
      return this.createStraightLineRoute(startLng, startLat, endLng, endLat, profile);
    }
  }

  /**
   * Convert travel mode to Mapbox profile
   */
  convertToMapboxProfile(travelMode: string): string {
    switch (travelMode.toLowerCase()) {
      case 'walking':
      case 'foot':
      case 'foot-walking':
        return 'walking';
      case 'cycling':
      case 'bicycle':
      case 'bike':
      case 'cycling-regular':
        return 'cycling';
      case 'driving':
      case 'car':
      case 'driving-car':
        return 'driving';
      default:
        return 'walking';
    }
  }

  /**
   * Convert travel mode from OpenStreetMap format to Mapbox format
   */
  convertTravelModeToProfile(travelMode: string): 'walking' | 'cycling' | 'driving' {
    switch (travelMode.toLowerCase()) {
      case 'walking':
      case 'foot':
      case 'foot-walking':
        return 'walking';
      case 'cycling':
      case 'bicycle':
      case 'bike':
      case 'cycling-regular':
        return 'cycling';
      case 'driving':
      case 'car':
      case 'driving-car':
        return 'driving';
      default:
        return 'walking';
    }
  }

  /**
   * Convert route to GeoJSON format for Leaflet
   */
  convertToGeoJSON(route: MapboxRoute): any {
    return {
      type: 'Feature',
      geometry: route.geometry,
      properties: {
        distance: route.distance,
        duration: route.duration
      }
    };
  }

  /**
   * Get route summary information
   */
  getRouteSummary(route: MapboxRoute): { distance: string; duration: string; distanceText: string; durationText: string } {
    const distanceKm = (route.distance / 1000).toFixed(2);
    const durationMin = Math.round(route.duration / 60);

    return {
      distance: `${distanceKm} km`,
      duration: `${durationMin} min`,
      distanceText: `${distanceKm} km`,
      durationText: `${durationMin} min`
    };
  }

  /**
   * Simple routing fallback using straight line when API fails
   */
  createStraightLineRoute(
    startLng: number,
    startLat: number,
    endLng: number,
    endLat: number,
    profile: string = 'walking'
  ): MapboxRouteResponse {
    const coordinates = [[startLng, startLat], [endLng, endLat]];

    // Calculate approximate distance using Haversine formula
    const distance = this.calculateDistance(startLat, startLng, endLat, endLng);
    const duration = this.estimateDuration(distance, profile);

    console.log(`📏 Fallback route: ${(distance/1000).toFixed(2)} km, ${Math.round(duration/60)} min`);

    return {
      routes: [{
        geometry: {
          coordinates: coordinates,
          type: 'LineString'
        },
        distance: distance,
        duration: duration,
        legs: [{
          distance: distance,
          duration: duration
        }]
      }],
      code: 'Ok'
    };
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
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
   * Estimate duration based on distance and travel mode
   */
  private estimateDuration(distance: number, profile: string): number {
    // Speed estimates in m/s
    const speeds = {
      'walking': 1.4,     // ~5 km/h
      'cycling': 4.2,     // ~15 km/h
      'driving': 13.9     // ~50 km/h (urban average)
    };

    const speed = speeds[profile as keyof typeof speeds] || speeds['walking'];
    return distance / speed; // duration in seconds
  }

  /**
   * Format duration for display
   */
  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Format distance for display
   */
  formatDistance(meters: number): string {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    } else {
      return `${Math.round(meters)} m`;
    }
  }

  /**
   * Test Mapbox API connection
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      console.log('🧪 Testing Mapbox API connection...');

      // Test with a simple route in Philippines (Cebu area)
      const testResponse = await this.getDirections(
        123.8854, 10.3157, // Start point
        123.8954, 10.3257, // End point
        'walking'
      );

      if (testResponse && testResponse.routes && testResponse.routes.length > 0) {
        return {
          success: true,
          message: 'Mapbox API connection successful!',
          details: {
            routes: testResponse.routes.length,
            distance: testResponse.routes[0].distance,
            duration: testResponse.routes[0].duration
          }
        };
      } else {
        return {
          success: false,
          message: 'Mapbox API returned empty response',
          details: testResponse
        };
      }
    } catch (error: any) {
      console.error('❌ Mapbox connection test failed:', error);
      return {
        success: false,
        message: `Mapbox API connection failed: ${error.message || error}`,
        details: {
          status: error.status,
          error: error.error
        }
      };
    }
  }
}
