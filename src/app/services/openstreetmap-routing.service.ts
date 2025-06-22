import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface RouteResponse {
  routes: Route[];
  waypoints?: any[];
  code?: string;
}

export interface Route {
  geometry: {
    coordinates: number[][];
    type: string;
  };
  legs: RouteLeg[];
  distance: number;
  duration: number;
  weight_name?: string;
  weight?: number;
}

export interface RouteLeg {
  distance: number;
  duration: number;
  steps?: RouteStep[];
}

export interface RouteStep {
  distance: number;
  duration: number;
  geometry: {
    coordinates: number[][];
    type: string;
  };
  name: string;
  mode: string;
}

@Injectable({
  providedIn: 'root'
})
export class OpenStreetMapRoutingService {
  private readonly ORS_API_KEY = environment.orsApiKey;
  private readonly ORS_BASE_URL = 'https://api.openrouteservice.org/v2/directions';

  constructor(private http: HttpClient) {}

  /**
   * Get directions using OpenRouteService (OpenStreetMap-based)
   */
  async getDirections(
    startLng: number,
    startLat: number,
    endLng: number,
    endLat: number,
    profile: 'foot-walking' | 'cycling-regular' | 'driving-car' = 'foot-walking',
    options: any = {}
  ): Promise<RouteResponse> {
    try {
      const coordinates = [[startLng, startLat], [endLng, endLat]];
      
      const requestBody = {
        coordinates: coordinates,
        format: 'geojson',
        ...options
      };

      const url = `${this.ORS_BASE_URL}/${profile}/geojson`;
      
      const response = await this.http.post<any>(url, requestBody, {
        headers: {
          'Authorization': this.ORS_API_KEY,
          'Content-Type': 'application/json'
        }
      }).toPromise();

      if (response && response.features && response.features.length > 0) {
        const feature = response.features[0];
        
        return {
          routes: [{
            geometry: feature.geometry,
            distance: feature.properties.segments[0].distance,
            duration: feature.properties.segments[0].duration,
            legs: [{
              distance: feature.properties.segments[0].distance,
              duration: feature.properties.segments[0].duration
            }]
          }],
          code: 'Ok'
        };
      }

      throw new Error('No routes found');
    } catch (error) {
      console.error('OpenRouteService error:', error);
      throw error;
    }
  }

  /**
   * Convert travel mode to OpenRouteService profile
   */
  convertTravelModeToProfile(travelMode: string): 'foot-walking' | 'cycling-regular' | 'driving-car' {
    switch (travelMode.toLowerCase()) {
      case 'walking':
      case 'foot':
        return 'foot-walking';
      case 'cycling':
      case 'bicycle':
      case 'bike':
        return 'cycling-regular';
      case 'driving':
      case 'car':
        return 'driving-car';
      default:
        return 'foot-walking';
    }
  }

  /**
   * Convert route to GeoJSON format for Leaflet
   */
  convertToGeoJSON(route: Route): any {
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
  getRouteSummary(route: Route): { distance: string; duration: string } {
    const distanceKm = (route.distance / 1000).toFixed(2);
    const durationMin = Math.round(route.duration / 60);
    
    return {
      distance: `${distanceKm} km`,
      duration: `${durationMin} min`
    };
  }

  /**
   * Simple routing fallback using straight line when API fails
   */
  createStraightLineRoute(
    startLng: number,
    startLat: number,
    endLng: number,
    endLat: number
  ): RouteResponse {
    const coordinates = [[startLng, startLat], [endLng, endLat]];
    
    // Calculate approximate distance using Haversine formula
    const distance = this.calculateDistance(startLat, startLng, endLat, endLng);
    const duration = distance / 1.4; // Assume 1.4 m/s walking speed
    
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
}
