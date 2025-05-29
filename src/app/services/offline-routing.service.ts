import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { OfflineStorageService, OfflineRoute } from './offline-storage.service';
import { MapboxRoutingService } from './mapbox-routing.service';
import * as L from 'leaflet';

export interface RouteResult {
  coordinates: [number, number][];
  distance: number; // in meters
  duration: number; // in seconds
  isOffline: boolean;
  travelMode: string;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineRoutingService {

  constructor(
    private http: HttpClient,
    private offlineStorage: OfflineStorageService,
    private mapboxRouting: MapboxRoutingService
  ) {}

  /**
   * Get route with offline fallback
   */
  async getRoute(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    travelMode: 'walking' | 'cycling' | 'driving' = 'walking'
  ): Promise<RouteResult | null> {

    // First try to get cached route
    const cachedRoute = await this.offlineStorage.getRoute(
      startLat, startLng, endLat, endLng, travelMode
    );

    if (cachedRoute) {
      console.log('📍 Using cached route');
      return {
        coordinates: JSON.parse(cachedRoute.route_data),
        distance: cachedRoute.distance,
        duration: cachedRoute.duration,
        isOffline: true,
        travelMode: cachedRoute.travel_mode
      };
    }

    // If online, try to get fresh route
    if (this.offlineStorage.isOnline() && !this.offlineStorage.isOfflineMode()) {
      try {
        const onlineRoute = await this.getOnlineRoute(
          startLat, startLng, endLat, endLng, travelMode
        );

        if (onlineRoute) {
          // Cache the route for offline use
          await this.cacheRoute(
            startLat, startLng, endLat, endLng,
            onlineRoute, travelMode
          );

          return {
            ...onlineRoute,
            isOffline: false
          };
        }
      } catch (error) {
        console.warn('⚠️ Online routing failed, falling back to offline:', error);
      }
    }

    // In offline mode, we don't provide routing - just show evacuation centers
    console.log('⚠️ Offline mode: No routing available. Show evacuation centers only.');
    return null;
  }

  /**
   * Get route from online service (Mapbox)
   */
  private async getOnlineRoute(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    travelMode: string
  ): Promise<RouteResult | null> {
    try {
      const response = await this.mapboxRouting.getDirections(
        startLng, startLat, endLng, endLat,
        travelMode as any
      );

      if (response.routes && response.routes.length > 0) {
        const route = response.routes[0];
        const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]] as [number, number]);

        return {
          coordinates,
          distance: route.distance,
          duration: route.duration,
          isOffline: false,
          travelMode
        };
      }
    } catch (error) {
      console.error('❌ Mapbox routing error:', error);
    }

    return null;
  }

  /**
   * Cache route for offline use
   */
  private async cacheRoute(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    route: RouteResult,
    travelMode: string
  ): Promise<void> {
    const offlineRoute: OfflineRoute = {
      start_lat: startLat,
      start_lng: startLng,
      end_lat: endLat,
      end_lng: endLng,
      disaster_type: 'general', // Can be updated based on context
      route_data: JSON.stringify(route.coordinates),
      distance: route.distance,
      duration: route.duration,
      travel_mode: travelMode
    };

    await this.offlineStorage.saveRoute(offlineRoute);
  }

  /**
   * Generate offline route - NO ROUTING, just show distance and direction
   */
  private generateOfflineRoute(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    travelMode: string
  ): RouteResult | null {
    // In offline mode, we DON'T provide routing
    // Instead, we just calculate distance and let users navigate manually
    console.log('⚠️ No routing available in offline mode - showing distance only');

    return null; // No route provided - users must navigate manually
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Estimate travel duration based on distance and mode
   */
  private estimateDuration(distanceMeters: number, travelMode: string): number {
    const distanceKm = distanceMeters / 1000;

    // Average speeds (km/h)
    const speeds = {
      walking: 5,
      cycling: 15,
      driving: 40
    };

    const speed = speeds[travelMode as keyof typeof speeds] || speeds.walking;
    return (distanceKm / speed) * 3600; // Convert hours to seconds
  }

  /**
   * Add route to Leaflet map
   */
  addRouteToMap(
    map: L.Map,
    route: RouteResult,
    color: string = '#007bff',
    weight: number = 4
  ): L.Polyline {
    const polyline = L.polyline(route.coordinates, {
      color: color,
      weight: weight,
      opacity: route.isOffline ? 0.7 : 1.0,
      dashArray: route.isOffline ? '10, 5' : undefined // Dashed line for offline routes
    }).addTo(map);

    // Add popup with route info
    const distanceKm = (route.distance / 1000).toFixed(1);
    const durationMin = Math.round(route.duration / 60);
    const routeType = route.isOffline ? 'Offline Route' : 'Online Route';

    polyline.bindPopup(`
      <div class="route-popup">
        <strong>${routeType}</strong><br>
        Distance: ${distanceKm} km<br>
        Duration: ${durationMin} min<br>
        Mode: ${route.travelMode}
      </div>
    `);

    return polyline;
  }

  /**
   * Pre-cache routes for common evacuation centers
   */
  async preCacheRoutes(
    userLat: number,
    userLng: number,
    evacuationCenters: any[],
    travelModes: string[] = ['walking', 'cycling']
  ): Promise<void> {
    if (!this.offlineStorage.isOnline()) {
      console.log('⚠️ Cannot pre-cache routes while offline');
      return;
    }

    console.log('🔄 Pre-caching routes for evacuation centers...');
    let cachedCount = 0;

    for (const center of evacuationCenters) {
      for (const mode of travelModes) {
        try {
          await this.getRoute(
            userLat, userLng,
            center.latitude, center.longitude,
            mode as any
          );
          cachedCount++;

          // Add delay to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.warn(`Failed to cache route to ${center.name}:`, error);
        }
      }
    }

    console.log(`✅ Pre-cached ${cachedCount} routes`);
  }
}
