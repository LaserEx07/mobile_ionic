import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MapboxRoute {
  geometry: {
    coordinates: number[][];
    type: string;
  };
  legs: Array<{
    distance: number;
    duration: number;
    steps: Array<{
      distance: number;
      duration: number;
      geometry: {
        coordinates: number[][];
        type: string;
      };
      maneuver: {
        instruction: string;
        type: string;
        location: number[];
      };
    }>;
  }>;
  distance: number;
  duration: number;
  weight: number;
  weight_name: string;
}

export interface MapboxDirectionsResponse {
  routes: MapboxRoute[];
  waypoints: Array<{
    distance: number;
    name: string;
    location: number[];
  }>;
  code: string;
  uuid?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MapboxRoutingService {

  private readonly baseUrl = 'https://api.mapbox.com/directions/v5/mapbox';
  private readonly accessToken = environment.mapboxAccessToken;

  constructor(private http: HttpClient) {}

  /**
   * Get directions between two points using Mapbox Directions API
   * @param startLng Starting longitude
   * @param startLat Starting latitude
   * @param endLng Ending longitude
   * @param endLat Ending latitude
   * @param profile Travel profile: 'driving', 'walking', 'cycling', 'driving-traffic'
   * @param options Additional options
   */
  async getDirections(
    startLng: number,
    startLat: number,
    endLng: number,
    endLat: number,
    profile: 'driving' | 'walking' | 'cycling' | 'driving-traffic' = 'walking',
    options: {
      alternatives?: boolean;
      geometries?: 'geojson' | 'polyline' | 'polyline6';
      overview?: 'full' | 'simplified' | 'false';
      steps?: boolean;
      continue_straight?: boolean;
      waypoint_snapping?: string[];
    } = {}
  ): Promise<MapboxDirectionsResponse> {

    // Validate coordinates
    if ([startLng, startLat, endLng, endLat].some(val => typeof val !== 'number' || isNaN(val))) {
      throw new Error('Invalid coordinates provided');
    }

    if (Math.abs(startLat) > 90 || Math.abs(endLat) > 90) {
      throw new Error('Latitude values must be between -90 and 90');
    }

    if (Math.abs(startLng) > 180 || Math.abs(endLng) > 180) {
      throw new Error('Longitude values must be between -180 and 180');
    }

    // Build coordinates string
    const coordinates = `${startLng},${startLat};${endLng},${endLat}`;

    // Build URL
    const url = `${this.baseUrl}/${profile}/${coordinates}`;

    // Build query parameters
    const params = new URLSearchParams({
      access_token: this.accessToken,
      geometries: options.geometries || 'geojson',
      overview: options.overview || 'full',
      steps: (options.steps !== false).toString(), // Default to true
      alternatives: (options.alternatives || false).toString()
    });

    if (options.continue_straight !== undefined) {
      params.append('continue_straight', options.continue_straight.toString());
    }

    if (options.waypoint_snapping && options.waypoint_snapping.length > 0) {
      params.append('waypoint_snapping', options.waypoint_snapping.join(';'));
    }

    const fullUrl = `${url}?${params.toString()}`;

    console.log('Mapbox Directions API request:', {
      url: fullUrl.replace(this.accessToken, 'TOKEN_HIDDEN'),
      profile,
      coordinates: { startLng, startLat, endLng, endLat }
    });

    try {
      const response = await firstValueFrom(
        this.http.get<MapboxDirectionsResponse>(fullUrl, {
          headers: {
            'Content-Type': 'application/json'
          }
        })
      );

      if (response.code !== 'Ok') {
        throw new Error(`Mapbox API error: ${response.code}`);
      }

      if (!response.routes || response.routes.length === 0) {
        throw new Error('No routes found');
      }

      console.log('Mapbox Directions API response:', {
        routeCount: response.routes.length,
        distance: response.routes[0].distance,
        duration: response.routes[0].duration
      });

      return response;

    } catch (error: any) {
      console.error('Mapbox Directions API error:', error);

      // Handle specific HTTP errors
      if (error.status === 401) {
        throw new Error('Invalid Mapbox access token. Please check your token.');
      } else if (error.status === 422) {
        throw new Error('Invalid request parameters. Please check coordinates.');
      } else if (error.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else if (error.status === 0) {
        throw new Error('Network error. Please check your internet connection.');
      }

      throw error;
    }
  }

  /**
   * Convert travel mode from your app format to Mapbox profile
   */
  convertTravelModeToProfile(travelMode: string): 'driving' | 'walking' | 'cycling' | 'driving-traffic' {
    switch (travelMode) {
      case 'foot-walking':
      case 'walking':
        return 'walking';
      case 'cycling-regular':
      case 'cycling':
        return 'cycling';
      case 'driving-car':
      case 'driving':
        return 'driving';
      case 'driving-traffic':
        return 'driving-traffic';
      default:
        return 'walking'; // Default fallback
    }
  }

  /**
   * Convert Mapbox route to GeoJSON format for Leaflet
   */
  convertToGeoJSON(route: MapboxRoute): any {
    return {
      type: 'Feature',
      properties: {
        distance: route.distance,
        duration: route.duration,
        weight: route.weight
      },
      geometry: route.geometry
    };
  }

  /**
   * Get route summary information
   */
  getRouteSummary(route: MapboxRoute): {
    distance: number;
    duration: number;
    distanceText: string;
    durationText: string;
  } {
    const distanceKm = route.distance / 1000;
    const durationMin = route.duration / 60;

    return {
      distance: route.distance,
      duration: route.duration,
      distanceText: distanceKm < 1 ?
        `${Math.round(route.distance)} m` :
        `${distanceKm.toFixed(2)} km`,
      durationText: durationMin < 60 ?
        `${Math.round(durationMin)} min` :
        `${Math.floor(durationMin / 60)}h ${Math.round(durationMin % 60)}min`
    };
  }

  /**
   * Check if Mapbox service is available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      // Simple test request to check if the service is available
      const testUrl = `${this.baseUrl}/walking/0,0;0.001,0.001?access_token=${this.accessToken}&overview=simplified`;

      const response = await firstValueFrom(
        this.http.get(testUrl)
      );

      return true;
    } catch (error) {
      console.error('Mapbox availability check failed:', error);
      return false;
    }
  }
}
