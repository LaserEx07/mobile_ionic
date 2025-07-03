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

  // Real-time routing properties
  private currentRoute: Route | null = null;
  private isRealTimeActive = false;
  private realTimeInterval: any = null;
  private lastUserPosition: { lat: number; lng: number } | null = null;
  private routeUpdateCallback: ((route: Route) => void) | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Get directions using OpenRouteService (OpenStreetMap-based) with fallback
   */
  async getDirections(
    startLng: number,
    startLat: number,
    endLng: number,
    endLat: number,
    profile: 'foot-walking' | 'cycling-regular' | 'driving-car' = 'foot-walking',
    options: any = {}
  ): Promise<RouteResponse> {
    console.log(`🗺️ Attempting route calculation from [${startLat}, ${startLng}] to [${endLat}, ${endLng}] using ${profile}`);

    try {
      const coordinates = [[startLng, startLat], [endLng, endLat]];

      const requestBody = {
        coordinates: coordinates,
        format: 'geojson',
        ...options
      };

      const url = `${this.ORS_BASE_URL}/${profile}/geojson`;
      console.log(`🌐 Making request to: ${url}`);
      console.log(`🔑 Using API key: ${this.ORS_API_KEY.substring(0, 10)}...`);

      const response = await this.http.post<any>(url, requestBody, {
        headers: {
          'Authorization': this.ORS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8'
        }
      }).toPromise();

      console.log('📡 OpenRouteService response:', response);

      if (response && response.features && response.features.length > 0) {
        const feature = response.features[0];

        // More robust parsing of OpenRouteService response
        let distance = 0;
        let duration = 0;

        if (feature.properties) {
          if (feature.properties.summary) {
            // Handle summary format
            distance = feature.properties.summary.distance || 0;
            duration = feature.properties.summary.duration || 0;
          } else if (feature.properties.segments && feature.properties.segments.length > 0) {
            // Handle segments format
            distance = feature.properties.segments[0].distance || 0;
            duration = feature.properties.segments[0].duration || 0;
          }
        }

        // If we still don't have distance/duration, calculate fallback
        if (!distance || !duration) {
          console.log('⚠️ Missing distance/duration in response, calculating fallback');
          distance = this.calculateDistance(startLat, startLng, endLat, endLng);
          duration = this.estimateDuration(distance, profile);
        }

        const result = {
          routes: [{
            geometry: feature.geometry,
            distance: distance,
            duration: duration,
            legs: [{
              distance: distance,
              duration: duration
            }]
          }],
          code: 'Ok'
        };

        console.log('✅ Successfully parsed route from OpenRouteService');
        console.log(`📏 Distance: ${(distance/1000).toFixed(2)} km, Duration: ${Math.round(duration/60)} min`);
        return result;
      }

      throw new Error('No routes found in response');
    } catch (error: any) {
      console.error('❌ OpenRouteService error:', error);

      // Log more detailed error information
      if (error.status) {
        console.error(`HTTP Status: ${error.status}`);
      }
      if (error.error) {
        console.error('Error details:', error.error);
      }

      // Try alternative approach with different parameters
      try {
        console.log('🔄 Retrying with simplified parameters...');
        const coordinates = [[startLng, startLat], [endLng, endLat]];

        const simpleRequestBody = {
          coordinates: coordinates
        };

        const url = `${this.ORS_BASE_URL}/${profile}`;

        const retryResponse = await this.http.post<any>(url, simpleRequestBody, {
          headers: {
            'Authorization': this.ORS_API_KEY,
            'Content-Type': 'application/json'
          }
        }).toPromise();

        console.log('📡 Retry response:', retryResponse);

        if (retryResponse && retryResponse.features && retryResponse.features.length > 0) {
          const feature = retryResponse.features[0];

          let distance = 0;
          let duration = 0;

          if (feature.properties) {
            if (feature.properties.summary) {
              distance = feature.properties.summary.distance || 0;
              duration = feature.properties.summary.duration || 0;
            } else if (feature.properties.segments && feature.properties.segments.length > 0) {
              distance = feature.properties.segments[0].distance || 0;
              duration = feature.properties.segments[0].duration || 0;
            }
          }

          if (!distance || !duration) {
            distance = this.calculateDistance(startLat, startLng, endLat, endLng);
            duration = this.estimateDuration(distance, profile);
          }

          const result = {
            routes: [{
              geometry: feature.geometry,
              distance: distance,
              duration: duration,
              legs: [{
                distance: distance,
                duration: duration
              }]
            }],
            code: 'Ok'
          };

          console.log('✅ Retry successful!');
          return result;
        }
      } catch (retryError) {
        console.error('❌ Retry also failed:', retryError);
      }

      // Don't fallback to straight line route - just throw the error
      console.log('🔄 All attempts failed, throwing error instead of fallback');
      throw error;
    }
  }

  /**
   * Convert travel mode to OpenRouteService profile
   */
  convertTravelModeToProfile(travelMode: string | any): 'foot-walking' | 'cycling-regular' | 'driving-car' {
    // Ensure travelMode is a string and handle null/undefined cases
    const mode = (travelMode || 'walking').toString().toLowerCase();

    switch (mode) {
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
        console.warn(`Unknown travel mode: ${travelMode}, defaulting to foot-walking`);
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
  getRouteSummary(route: Route): { distance: string; duration: string; distanceText: string; durationText: string } {
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
   * Estimate duration based on distance and travel mode
   */
  private estimateDuration(distance: number, profile: string): number {
    // Speed estimates in m/s
    const speeds = {
      'foot-walking': 1.4,     // ~5 km/h
      'cycling-regular': 4.2,  // ~15 km/h
      'driving-car': 13.9      // ~50 km/h (urban average)
    };

    const speed = speeds[profile as keyof typeof speeds] || speeds['foot-walking'];
    return distance / speed; // duration in seconds
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
   * Start real-time routing with automatic route updates
   */
  startRealTimeRouting(
    destination: { lat: number; lng: number },
    profile: 'foot-walking' | 'cycling-regular' | 'driving-car' = 'foot-walking',
    updateCallback: (route: Route) => void,
    updateIntervalMs: number = 30000 // Update every 30 seconds
  ): void {
    console.log('🔄 Starting real-time routing to:', destination);

    this.isRealTimeActive = true;
    this.routeUpdateCallback = updateCallback;

    // Clear any existing interval
    if (this.realTimeInterval) {
      clearInterval(this.realTimeInterval);
    }

    // Set up periodic route updates
    this.realTimeInterval = setInterval(async () => {
      if (this.lastUserPosition && this.isRealTimeActive) {
        try {
          const route = await this.getDirections(
            this.lastUserPosition.lng,
            this.lastUserPosition.lat,
            destination.lng,
            destination.lat,
            profile,
            {
              geometries: 'geojson',
              overview: 'full',
              steps: true,
              continue_straight: false,
              alternative_routes: {
                target_count: 2,
                weight_factor: 1.4
              }
            }
          );

          if (route.routes && route.routes.length > 0) {
            this.currentRoute = route.routes[0];
            this.routeUpdateCallback?.(this.currentRoute);
            console.log('🔄 Real-time route updated');
          }
        } catch (error) {
          console.error('❌ Real-time route update failed:', error);
        }
      }
    }, updateIntervalMs);
  }

  /**
   * Update user position for real-time routing
   */
  updateUserPosition(lat: number, lng: number): void {
    this.lastUserPosition = { lat, lng };

    // If real-time routing is active and this is a significant position change
    if (this.isRealTimeActive && this.shouldUpdateRoute(lat, lng)) {
      console.log('📍 Significant position change detected, updating route...');
      // Trigger immediate route update for significant position changes
      this.triggerImmediateRouteUpdate();
    }
  }

  /**
   * Stop real-time routing
   */
  stopRealTimeRouting(): void {
    console.log('⏹️ Stopping real-time routing');
    this.isRealTimeActive = false;
    this.currentRoute = null;
    this.routeUpdateCallback = null;
    this.lastUserPosition = null;

    if (this.realTimeInterval) {
      clearInterval(this.realTimeInterval);
      this.realTimeInterval = null;
    }
  }

  /**
   * Check if route should be updated based on position change
   */
  private shouldUpdateRoute(newLat: number, newLng: number): boolean {
    if (!this.lastUserPosition) return true;

    // Calculate distance moved (in meters)
    const distanceMoved = this.calculateDistance(
      this.lastUserPosition.lat,
      this.lastUserPosition.lng,
      newLat,
      newLng
    );

    // Update route if user moved more than 50 meters
    return distanceMoved > 50;
  }

  /**
   * Trigger immediate route update
   */
  private async triggerImmediateRouteUpdate(): Promise<void> {
    // This will be called when significant position change is detected
    // The actual update will happen in the next interval cycle
    console.log('⚡ Immediate route update triggered');
  }

  /**
   * Get current active route
   */
  getCurrentRoute(): Route | null {
    return this.currentRoute;
  }

  /**
   * Check if real-time routing is active
   */
  isRealTimeRoutingActive(): boolean {
    return this.isRealTimeActive;
  }

  /**
   * Get route with traffic information (if available)
   */
  async getRouteWithTraffic(
    startLng: number,
    startLat: number,
    endLng: number,
    endLat: number,
    profile: 'foot-walking' | 'cycling-regular' | 'driving-car' = 'driving-car'
  ): Promise<RouteResponse> {
    // For driving routes, request traffic-aware routing
    const options = profile === 'driving-car' ? {
      geometries: 'geojson',
      overview: 'full',
      steps: true,
      continue_straight: false,
      avoid_features: ['tollways'], // Avoid toll roads
      alternative_routes: {
        target_count: 2,
        weight_factor: 1.4
      }
    } : {
      geometries: 'geojson',
      overview: 'full',
      steps: true
    };

    return this.getDirections(startLng, startLat, endLng, endLat, profile, options);
  }

  /**
   * Test OpenRouteService API connection
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      console.log('🧪 Testing OpenRouteService API connection...');

      // Test with a simple route in Philippines (Cebu area)
      const testCoordinates = [
        [123.8854, 10.3157], // Start point
        [123.8954, 10.3257]  // End point
      ];

      const requestBody = {
        coordinates: testCoordinates,
        format: 'geojson'
      };

      const url = `${this.ORS_BASE_URL}/foot-walking/geojson`;

      const response = await this.http.post<any>(url, requestBody, {
        headers: {
          'Authorization': this.ORS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8'
        }
      }).toPromise();

      if (response && response.features && response.features.length > 0) {
        return {
          success: true,
          message: 'OpenRouteService API connection successful!',
          details: {
            features: response.features.length,
            apiKey: this.ORS_API_KEY.substring(0, 10) + '...'
          }
        };
      } else {
        return {
          success: false,
          message: 'OpenRouteService API returned empty response',
          details: response
        };
      }
    } catch (error: any) {
      console.error('❌ OpenRouteService connection test failed:', error);
      return {
        success: false,
        message: `OpenRouteService API connection failed: ${error.message || error}`,
        details: {
          status: error.status,
          error: error.error,
          apiKey: this.ORS_API_KEY.substring(0, 10) + '...'
        }
      };
    }
  }

  /**
   * Get turn-by-turn navigation instructions
   */
  getNavigationInstructions(route: Route): NavigationInstruction[] {
    const instructions: NavigationInstruction[] = [];

    if (route.legs && route.legs.length > 0) {
      route.legs.forEach((leg, legIndex) => {
        if (leg.steps) {
          leg.steps.forEach((step, stepIndex) => {
            instructions.push({
              id: `${legIndex}-${stepIndex}`,
              instruction: step.name || 'Continue',
              distance: step.distance,
              duration: step.duration,
              coordinates: step.geometry.coordinates,
              maneuver: this.getManeuverType(step.name || ''),
              bearing: this.calculateBearing(step.geometry.coordinates)
            });
          });
        }
      });
    }

    return instructions;
  }

  /**
   * Get current navigation instruction based on user position
   */
  getCurrentInstruction(
    userLat: number,
    userLng: number,
    instructions: NavigationInstruction[]
  ): NavigationInstruction | null {
    if (!instructions.length) return null;

    let closestInstruction = instructions[0];
    let minDistance = Infinity;

    for (const instruction of instructions) {
      if (instruction.coordinates && instruction.coordinates.length > 0) {
        const [lng, lat] = instruction.coordinates[0];
        const distance = this.calculateDistance(userLat, userLng, lat, lng);

        if (distance < minDistance) {
          minDistance = distance;
          closestInstruction = instruction;
        }
      }
    }

    // Return instruction if user is within 100 meters
    return minDistance < 100 ? closestInstruction : null;
  }

  /**
   * Calculate bearing between two points
   */
  private calculateBearing(coordinates: number[][]): number {
    if (coordinates.length < 2) return 0;

    const [lng1, lat1] = coordinates[0];
    const [lng2, lat2] = coordinates[1];

    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;

    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }

  /**
   * Determine maneuver type from instruction text
   */
  private getManeuverType(instruction: string): ManeuverType {
    const lowerInstruction = instruction.toLowerCase();

    if (lowerInstruction.includes('left')) return 'turn-left';
    if (lowerInstruction.includes('right')) return 'turn-right';
    if (lowerInstruction.includes('straight') || lowerInstruction.includes('continue')) return 'straight';
    if (lowerInstruction.includes('u-turn')) return 'u-turn';
    if (lowerInstruction.includes('roundabout')) return 'roundabout';
    if (lowerInstruction.includes('exit')) return 'exit';
    if (lowerInstruction.includes('merge')) return 'merge';

    return 'straight';
  }

  /**
   * Get estimated time of arrival
   */
  getETA(route: Route): Date {
    const now = new Date();
    const durationMs = route.duration * 1000; // Convert seconds to milliseconds
    return new Date(now.getTime() + durationMs);
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
}

// Additional interfaces for navigation
export interface NavigationInstruction {
  id: string;
  instruction: string;
  distance: number;
  duration: number;
  coordinates: number[][];
  maneuver: ManeuverType;
  bearing: number;
}

export type ManeuverType =
  | 'straight'
  | 'turn-left'
  | 'turn-right'
  | 'u-turn'
  | 'roundabout'
  | 'exit'
  | 'merge';
