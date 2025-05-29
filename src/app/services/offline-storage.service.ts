import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface EvacuationCenter {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  capacity?: number;
  status?: string;
  disaster_type?: string;
  contact?: string;
  image_url?: string;
  last_updated?: string;
}

export interface OfflineRoute {
  id?: string;
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  disaster_type: string;
  route_data: string; // JSON string of route coordinates
  distance: number;
  duration: number;
  travel_mode: string;
  created_at?: string;
}

export interface OfflineMapTile {
  key: string; // z_x_y format
  z: number;
  x: number;
  y: number;
  tile_data: string; // Base64 encoded image
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineStorageService {
  private readonly STORAGE_KEYS = {
    EVACUATION_CENTERS: 'offline_evacuation_centers',
    ROUTES: 'offline_routes',
    MAP_TILES: 'offline_map_tiles',
    LAST_SYNC: 'last_data_sync',
    OFFLINE_MODE: 'offline_mode_enabled',
    USER_LOCATION: 'last_user_location'
  };

  private readonly MAX_STORAGE_SIZE = 50 * 1024 * 1024; // 50MB limit
  private readonly TILE_CACHE_LIMIT = 1000; // Maximum tiles to cache

  constructor(private http: HttpClient) {
    this.initializeStorage();
  }

  private initializeStorage() {
    // Initialize storage with empty arrays if not exists
    if (!localStorage.getItem(this.STORAGE_KEYS.EVACUATION_CENTERS)) {
      localStorage.setItem(this.STORAGE_KEYS.EVACUATION_CENTERS, JSON.stringify([]));
    }
    if (!localStorage.getItem(this.STORAGE_KEYS.ROUTES)) {
      localStorage.setItem(this.STORAGE_KEYS.ROUTES, JSON.stringify([]));
    }
    if (!localStorage.getItem(this.STORAGE_KEYS.MAP_TILES)) {
      localStorage.setItem(this.STORAGE_KEYS.MAP_TILES, JSON.stringify({}));
    }
    console.log('✅ Offline storage initialized');
  }

  // ===== EVACUATION CENTERS MANAGEMENT =====

  /**
   * Sync evacuation centers from backend to local storage
   */
  async syncEvacuationCenters(): Promise<boolean> {
    try {
      console.log('🔄 Syncing evacuation centers from backend...');

      const response = await firstValueFrom(
        this.http.get<{success: boolean, data: EvacuationCenter[], count: number, sync_timestamp: string}>
        (`${environment.apiUrl}/offline/evacuation-centers`)
      );

      if (response.success && response.data) {
        await this.saveEvacuationCenters(response.data);
        localStorage.setItem(this.STORAGE_KEYS.LAST_SYNC, response.sync_timestamp);

        console.log(`✅ Synced ${response.count} evacuation centers`);
        return true;
      } else {
        console.error('❌ Invalid response from server');
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to sync evacuation centers:', error);
      return false;
    }
  }

  /**
   * Save evacuation centers to local storage
   */
  async saveEvacuationCenters(centers: EvacuationCenter[]): Promise<void> {
    try {
      const centersWithTimestamp = centers.map(center => ({
        ...center,
        last_updated: new Date().toISOString()
      }));

      localStorage.setItem(
        this.STORAGE_KEYS.EVACUATION_CENTERS,
        JSON.stringify(centersWithTimestamp)
      );

      console.log(`💾 Saved ${centers.length} evacuation centers to local storage`);
    } catch (error) {
      console.error('❌ Error saving evacuation centers:', error);
      throw error;
    }
  }

  /**
   * Get evacuation centers from local storage
   */
  async getEvacuationCenters(disasterType?: string): Promise<EvacuationCenter[]> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.EVACUATION_CENTERS);
      if (!stored) return [];

      const centers: EvacuationCenter[] = JSON.parse(stored);

      if (disasterType) {
        return centers.filter(center => center.disaster_type === disasterType);
      }

      return centers;
    } catch (error) {
      console.error('❌ Error fetching evacuation centers:', error);
      return [];
    }
  }

  /**
   * Get nearest evacuation centers
   */
  async getNearestCenters(
    userLat: number,
    userLng: number,
    disasterType?: string,
    limit: number = 2
  ): Promise<EvacuationCenter[]> {
    const centers = await this.getEvacuationCenters(disasterType);

    const centersWithDistance = centers.map(center => ({
      ...center,
      distance: this.calculateDistance(userLat, userLng, center.latitude, center.longitude)
    }));

    return centersWithDistance
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
  }

  // ===== ROUTE CACHING =====

  /**
   * Save route to local storage
   */
  async saveRoute(route: OfflineRoute): Promise<void> {
    try {
      const routes = this.getStoredRoutes();
      const routeWithId = {
        ...route,
        id: `${route.start_lat}_${route.start_lng}_${route.end_lat}_${route.end_lng}_${route.travel_mode}`,
        created_at: new Date().toISOString()
      };

      // Remove existing route with same parameters
      const filteredRoutes = routes.filter(r => r.id !== routeWithId.id);
      filteredRoutes.push(routeWithId);

      // Keep only recent routes (limit to 100)
      const limitedRoutes = filteredRoutes.slice(-100);

      localStorage.setItem(this.STORAGE_KEYS.ROUTES, JSON.stringify(limitedRoutes));
      console.log('💾 Route saved to cache');
    } catch (error) {
      console.error('❌ Error saving route:', error);
    }
  }

  /**
   * Get cached route
   */
  async getRoute(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    travelMode: string
  ): Promise<OfflineRoute | null> {
    try {
      const routes = this.getStoredRoutes();
      const routeId = `${startLat}_${startLng}_${endLat}_${endLng}_${travelMode}`;

      const route = routes.find(r => r.id === routeId);

      // Check if route is not too old (24 hours)
      if (route && route.created_at) {
        const routeAge = Date.now() - new Date(route.created_at).getTime();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (routeAge < maxAge) {
          return route;
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Error fetching route:', error);
      return null;
    }
  }

  private getStoredRoutes(): OfflineRoute[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.ROUTES);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ Error parsing stored routes:', error);
      return [];
    }
  }

  // ===== MAP TILES CACHING =====

  /**
   * Save map tile to cache
   */
  async saveMapTile(z: number, x: number, y: number, tileData: string): Promise<void> {
    try {
      const tiles = this.getStoredTiles();
      const tileKey = `${z}_${x}_${y}`;

      tiles[tileKey] = {
        key: tileKey,
        z, x, y,
        tile_data: tileData,
        created_at: new Date().toISOString()
      };

      // Limit cache size
      const tileKeys = Object.keys(tiles);
      if (tileKeys.length > this.TILE_CACHE_LIMIT) {
        // Remove oldest tiles
        const sortedTiles = tileKeys
          .map(key => ({ key, created_at: tiles[key].created_at }))
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        const tilesToRemove = sortedTiles.slice(0, tileKeys.length - this.TILE_CACHE_LIMIT);
        tilesToRemove.forEach(tile => delete tiles[tile.key]);
      }

      localStorage.setItem(this.STORAGE_KEYS.MAP_TILES, JSON.stringify(tiles));
    } catch (error) {
      console.error('❌ Error saving map tile:', error);
    }
  }

  /**
   * Get cached map tile
   */
  async getMapTile(z: number, x: number, y: number): Promise<OfflineMapTile | null> {
    try {
      const tiles = this.getStoredTiles();
      const tileKey = `${z}_${x}_${y}`;
      return tiles[tileKey] || null;
    } catch (error) {
      console.error('❌ Error getting map tile:', error);
      return null;
    }
  }

  private getStoredTiles(): { [key: string]: OfflineMapTile } {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.MAP_TILES);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('❌ Error parsing stored tiles:', error);
      return {};
    }
  }

  // ===== OFFLINE MODE MANAGEMENT =====

  /**
   * Enable offline mode
   */
  setOfflineMode(enabled: boolean): void {
    localStorage.setItem(this.STORAGE_KEYS.OFFLINE_MODE, enabled.toString());
    console.log(`🔄 Offline mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if offline mode is enabled
   */
  isOfflineMode(): boolean {
    return localStorage.getItem(this.STORAGE_KEYS.OFFLINE_MODE) === 'true';
  }

  /**
   * Save user location for offline use
   */
  saveUserLocation(lat: number, lng: number): void {
    const location = { lat, lng, timestamp: new Date().toISOString() };
    localStorage.setItem(this.STORAGE_KEYS.USER_LOCATION, JSON.stringify(location));
  }

  /**
   * Get last known user location
   */
  getLastUserLocation(): { lat: number; lng: number; timestamp: string } | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.USER_LOCATION);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('❌ Error getting user location:', error);
      return null;
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Check if offline data is available
   */
  async isDataAvailable(): Promise<boolean> {
    const centers = await this.getEvacuationCenters();
    return centers.length > 0;
  }

  /**
   * Get last sync time
   */
  getLastSyncTime(): string | null {
    return localStorage.getItem(this.STORAGE_KEYS.LAST_SYNC);
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
   * Clear all offline data
   */
  clearOfflineData(): void {
    Object.values(this.STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    this.initializeStorage();
    console.log('🗑️ All offline data cleared');
  }

  /**
   * Get storage usage information
   */
  getStorageInfo(): { used: number; available: number; percentage: number } {
    let used = 0;

    Object.values(this.STORAGE_KEYS).forEach(key => {
      const item = localStorage.getItem(key);
      if (item) {
        used += new Blob([item]).size;
      }
    });

    const available = this.MAX_STORAGE_SIZE - used;
    const percentage = (used / this.MAX_STORAGE_SIZE) * 100;

    return { used, available, percentage };
  }

  /**
   * Check if device is online
   */
  isOnline(): boolean {
    return navigator.onLine;
  }
}
