import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { OfflineStorageService } from './offline-storage.service';

interface TileCoordinate {
  z: number;
  x: number;
  y: number;
}

interface CachedTile {
  z: number;
  x: number;
  y: number;
  tile_data: string; // Base64 encoded image data
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineMapService {
  private readonly TILE_CACHE_SIZE = 1000; // Maximum number of tiles to cache
  private readonly CACHE_EXPIRY_DAYS = 30; // Tiles expire after 30 days
  private readonly PHILIPPINES_BOUNDS = {
    north: 21.0,
    south: 4.5,
    east: 127.0,
    west: 116.0
  };

  constructor(
    private http: HttpClient,
    private offlineStorage: OfflineStorageService
  ) {}

  /**
   * Create an offline-capable tile layer for Leaflet
   */
  createOfflineTileLayer(): L.TileLayer {
    const offlineLayer = L.tileLayer('', {
      attribution: '© OpenStreetMap contributors (Offline Mode)',
      maxZoom: 18,
      minZoom: 8
    });

    // Override the createTile method to use cached tiles
    (offlineLayer as any).createTile = (coords: TileCoordinate, done: Function) => {
      const tile = document.createElement('img');

      this.getTileFromCache(coords.z, coords.x, coords.y)
        .then(cachedTile => {
          if (cachedTile) {
            tile.src = `data:image/png;base64,${cachedTile.tile_data}`;
            done(null, tile);
          } else {
            // Show placeholder for missing tiles
            tile.src = this.createPlaceholderTile(coords);
            done(null, tile);
          }
        })
        .catch(error => {
          console.error('Error loading cached tile:', error);
          tile.src = this.createPlaceholderTile(coords);
          done(null, tile);
        });

      return tile;
    };

    return offlineLayer;
  }

  /**
   * Pre-cache map tiles for Philippines region at multiple zoom levels
   */
  async preloadMapTiles(
    centerLat: number,
    centerLng: number,
    radiusKm: number = 50,
    onProgress?: (progress: number, total: number) => void
  ): Promise<void> {
    console.log('🗺️ Starting map tile preload...');

    const zoomLevels = [10, 11, 12, 13, 14, 15]; // Focus on useful zoom levels
    let totalTiles = 0;
    let processedTiles = 0;

    // Calculate total tiles to download
    for (const zoom of zoomLevels) {
      const bounds = this.calculateTileBounds(centerLat, centerLng, radiusKm, zoom);
      totalTiles += (bounds.maxX - bounds.minX + 1) * (bounds.maxY - bounds.minY + 1);
    }

    console.log(`📊 Total tiles to download: ${totalTiles}`);

    for (const zoom of zoomLevels) {
      const bounds = this.calculateTileBounds(centerLat, centerLng, radiusKm, zoom);

      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
          try {
            await this.downloadAndCacheTile(zoom, x, y);
            processedTiles++;

            if (onProgress) {
              onProgress(processedTiles, totalTiles);
            }

            // Add small delay to prevent overwhelming the server
            await this.delay(100);
          } catch (error) {
            console.warn(`Failed to cache tile ${zoom}/${x}/${y}:`, error);
            processedTiles++;
          }
        }
      }
    }

    console.log('✅ Map tile preload completed');
  }

  /**
   * Download and cache a single tile
   */
  private async downloadAndCacheTile(z: number, x: number, y: number): Promise<void> {
    // Check if tile already exists and is not expired
    const existingTile = await this.getTileFromCache(z, x, y);
    if (existingTile && !this.isTileExpired(existingTile.created_at)) {
      return; // Tile is already cached and fresh
    }

    const tileUrl = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

    try {
      const response = await this.http.get(tileUrl, { responseType: 'blob' }).toPromise();
      if (response) {
        const base64Data = await this.blobToBase64(response);
        await this.saveTileToCache(z, x, y, base64Data);
      }
    } catch (error) {
      throw new Error(`Failed to download tile: ${error}`);
    }
  }

  /**
   * Get tile from cache
   */
  private async getTileFromCache(z: number, x: number, y: number): Promise<CachedTile | null> {
    const cachedTile = await this.offlineStorage.getMapTile(z, x, y);
    if (cachedTile) {
      return {
        z: cachedTile.z,
        x: cachedTile.x,
        y: cachedTile.y,
        tile_data: cachedTile.tile_data,
        created_at: cachedTile.created_at
      };
    }
    return null;
  }

  /**
   * Save tile to cache
   */
  private async saveTileToCache(z: number, x: number, y: number, tileData: string): Promise<void> {
    await this.offlineStorage.saveMapTile(z, x, y, tileData);
  }

  /**
   * Calculate tile bounds for a given center point and radius
   */
  private calculateTileBounds(lat: number, lng: number, radiusKm: number, zoom: number) {
    const latRad = lat * Math.PI / 180;
    const n = Math.pow(2, zoom);

    // Convert radius to degrees (approximate)
    const latDelta = radiusKm / 111; // 1 degree ≈ 111 km
    const lngDelta = radiusKm / (111 * Math.cos(latRad));

    const minLat = Math.max(lat - latDelta, this.PHILIPPINES_BOUNDS.south);
    const maxLat = Math.min(lat + latDelta, this.PHILIPPINES_BOUNDS.north);
    const minLng = Math.max(lng - lngDelta, this.PHILIPPINES_BOUNDS.west);
    const maxLng = Math.min(lng + lngDelta, this.PHILIPPINES_BOUNDS.east);

    return {
      minX: Math.floor((minLng + 180) / 360 * n),
      maxX: Math.floor((maxLng + 180) / 360 * n),
      minY: Math.floor((1 - Math.log(Math.tan(maxLat * Math.PI / 180) + 1 / Math.cos(maxLat * Math.PI / 180)) / Math.PI) / 2 * n),
      maxY: Math.floor((1 - Math.log(Math.tan(minLat * Math.PI / 180) + 1 / Math.cos(minLat * Math.PI / 180)) / Math.PI) / 2 * n)
    };
  }

  /**
   * Create a placeholder tile for missing tiles
   */
  private createPlaceholderTile(coords: TileCoordinate): string {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Gray background
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, 256, 256);

      // Border
      ctx.strokeStyle = '#ccc';
      ctx.strokeRect(0, 0, 256, 256);

      // Text
      ctx.fillStyle = '#999';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Offline Mode', 128, 120);
      ctx.fillText(`${coords.z}/${coords.x}/${coords.y}`, 128, 140);
    }

    return canvas.toDataURL();
  }

  /**
   * Check if a tile is expired
   */
  private isTileExpired(createdAt: string): boolean {
    const created = new Date(createdAt);
    const now = new Date();
    const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > this.CACHE_EXPIRY_DAYS;
  }

  /**
   * Convert blob to base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // Remove data:image/png;base64, prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up old tiles to manage storage space
   */
  async cleanupOldTiles(): Promise<void> {
    console.log('🧹 Cleaning up old map tiles...');
    // The cleanup is now handled by the OfflineStorageService
    // when saving new tiles (automatic cache size management)
    console.log('✅ Tile cleanup completed');
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ tileCount: number; sizeEstimate: string }> {
    const storageInfo = this.offlineStorage.getStorageInfo();

    // Estimate tile count (rough calculation)
    const avgTileSize = 15000; // Average tile size in bytes
    const tileCount = Math.floor(storageInfo.used / avgTileSize);

    const sizeEstimate = this.formatBytes(storageInfo.used);

    return { tileCount, sizeEstimate };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
