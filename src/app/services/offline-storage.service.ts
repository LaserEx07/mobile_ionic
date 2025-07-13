import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { BehaviorSubject, Observable } from 'rxjs';
import { EvacuationCenter } from '../interfaces/evacuation-center.interface';

export interface OfflineData {
  evacuationCenters: EvacuationCenter[];
  userLocation: { lat: number; lng: number } | null;
  lastSync: Date;
  mapData: any;
  emergencyContacts: any[];
  disasterInfo: any[];
}

export interface CacheMetadata {
  key: string;
  lastUpdated: Date;
  expiresAt: Date;
  size: number;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineStorageService {
  private _storage: Storage | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  // Cache expiration times (in milliseconds)
  private readonly CACHE_EXPIRY = {
    evacuationCenters: 24 * 60 * 60 * 1000, // 24 hours
    userLocation: 60 * 60 * 1000, // 1 hour
    mapData: 7 * 24 * 60 * 60 * 1000, // 7 days
    emergencyContacts: 30 * 24 * 60 * 60 * 1000, // 30 days
    disasterInfo: 24 * 60 * 60 * 1000 // 24 hours
  };

  // Observable for offline data status
  private offlineDataSubject = new BehaviorSubject<boolean>(false);
  public offlineDataAvailable$ = this.offlineDataSubject.asObservable();

  constructor(private storage: Storage) {
    this.init();
  }

  /**
   * Initialize the storage
   */
  private async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.initializeStorage();
    return this.initPromise;
  }

  private async initializeStorage(): Promise<void> {
    try {
      const storage = await this.storage.create();
      this._storage = storage;
      this.isInitialized = true;
      console.log('✅ Offline Storage initialized successfully');
      
      // Check if we have offline data available
      await this.checkOfflineDataAvailability();
    } catch (error) {
      console.error('❌ Failed to initialize offline storage:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Ensure storage is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }
    if (!this._storage) {
      throw new Error('Storage not initialized');
    }
  }

  /**
   * Store data with expiration
   */
  async setItem<T>(key: string, value: T, customExpiry?: number): Promise<void> {
    await this.ensureInitialized();
    
    const expiry = customExpiry || this.CACHE_EXPIRY[key as keyof typeof this.CACHE_EXPIRY] || this.CACHE_EXPIRY.evacuationCenters;
    const expiresAt = new Date(Date.now() + expiry);
    
    const cacheItem = {
      data: value,
      metadata: {
        key,
        lastUpdated: new Date(),
        expiresAt,
        size: JSON.stringify(value).length
      }
    };

    await this._storage!.set(key, cacheItem);
    console.log(`💾 Cached ${key} (expires: ${expiresAt.toLocaleString()})`);
    
    // Update offline data availability
    await this.checkOfflineDataAvailability();
  }

  /**
   * Get data with expiration check
   */
  async getItem<T>(key: string): Promise<T | null> {
    await this.ensureInitialized();
    
    try {
      const cacheItem = await this._storage!.get(key);
      
      if (!cacheItem) {
        return null;
      }

      // Check if data has expired
      const now = new Date();
      const expiresAt = new Date(cacheItem.metadata.expiresAt);
      
      if (now > expiresAt) {
        console.log(`⏰ Cache expired for ${key}, removing...`);
        await this.removeItem(key);
        return null;
      }

      console.log(`📦 Retrieved cached ${key} (expires: ${expiresAt.toLocaleString()})`);
      return cacheItem.data;
    } catch (error) {
      console.error(`Error getting ${key} from cache:`, error);
      return null;
    }
  }

  /**
   * Remove item from storage
   */
  async removeItem(key: string): Promise<void> {
    await this.ensureInitialized();
    await this._storage!.remove(key);
    console.log(`🗑️ Removed ${key} from cache`);
    
    // Update offline data availability
    await this.checkOfflineDataAvailability();
  }

  /**
   * Clear all cached data
   */
  async clearAll(): Promise<void> {
    await this.ensureInitialized();
    await this._storage!.clear();
    console.log('🧹 Cleared all offline cache');
    this.offlineDataSubject.next(false);
  }

  /**
   * Get all cache metadata
   */
  async getCacheMetadata(): Promise<CacheMetadata[]> {
    await this.ensureInitialized();
    
    const metadata: CacheMetadata[] = [];
    await this._storage!.forEach((value, key) => {
      if (value && value.metadata) {
        metadata.push(value.metadata);
      }
    });
    
    return metadata;
  }

  /**
   * Check if offline data is available
   */
  private async checkOfflineDataAvailability(): Promise<void> {
    try {
      const evacuationCenters = await this.getItem<EvacuationCenter[]>('evacuationCenters');
      const hasOfflineData = !!(evacuationCenters && evacuationCenters.length > 0);
      this.offlineDataSubject.next(hasOfflineData);
    } catch (error) {
      console.error('Error checking offline data availability:', error);
      this.offlineDataSubject.next(false);
    }
  }

  /**
   * Cache evacuation centers
   */
  async cacheEvacuationCenters(centers: EvacuationCenter[]): Promise<void> {
    await this.setItem('evacuationCenters', centers);
    console.log(`💾 Cached ${centers.length} evacuation centers`);
  }

  /**
   * Get cached evacuation centers
   */
  async getCachedEvacuationCenters(): Promise<EvacuationCenter[] | null> {
    return await this.getItem<EvacuationCenter[]>('evacuationCenters');
  }

  /**
   * Cache user location
   */
  async cacheUserLocation(location: { lat: number; lng: number }): Promise<void> {
    await this.setItem('userLocation', location);
    console.log(`📍 Cached user location: [${location.lat}, ${location.lng}]`);
  }

  /**
   * Get cached user location
   */
  async getCachedUserLocation(): Promise<{ lat: number; lng: number } | null> {
    return await this.getItem<{ lat: number; lng: number }>('userLocation');
  }

  /**
   * Cache emergency contacts
   */
  async cacheEmergencyContacts(contacts: any[]): Promise<void> {
    await this.setItem('emergencyContacts', contacts);
    console.log(`📞 Cached ${contacts.length} emergency contacts`);
  }

  /**
   * Get cached emergency contacts
   */
  async getCachedEmergencyContacts(): Promise<any[] | null> {
    return await this.getItem<any[]>('emergencyContacts');
  }

  /**
   * Cache disaster information
   */
  async cacheDisasterInfo(info: any[]): Promise<void> {
    await this.setItem('disasterInfo', info);
    console.log(`🌪️ Cached ${info.length} disaster information items`);
  }

  /**
   * Get cached disaster information
   */
  async getCachedDisasterInfo(): Promise<any[] | null> {
    return await this.getItem<any[]>('disasterInfo');
  }

  /**
   * Get cache size in bytes
   */
  async getCacheSize(): Promise<number> {
    const metadata = await this.getCacheMetadata();
    return metadata.reduce((total, item) => total + item.size, 0);
  }

  /**
   * Clean expired cache items
   */
  async cleanExpiredCache(): Promise<void> {
    await this.ensureInitialized();
    
    const now = new Date();
    const keysToRemove: string[] = [];
    
    await this._storage!.forEach((value, key) => {
      if (value && value.metadata) {
        const expiresAt = new Date(value.metadata.expiresAt);
        if (now > expiresAt) {
          keysToRemove.push(key);
        }
      }
    });

    for (const key of keysToRemove) {
      await this.removeItem(key);
    }

    if (keysToRemove.length > 0) {
      console.log(`🧹 Cleaned ${keysToRemove.length} expired cache items`);
    }
  }

  /**
   * Check if we're in offline mode
   */
  isOfflineMode(): boolean {
    return !navigator.onLine;
  }

  /**
   * Get offline data summary
   */
  async getOfflineDataSummary(): Promise<any> {
    const evacuationCenters = await this.getCachedEvacuationCenters();
    const userLocation = await this.getCachedUserLocation();
    const emergencyContacts = await this.getCachedEmergencyContacts();
    const disasterInfo = await this.getCachedDisasterInfo();
    const cacheSize = await this.getCacheSize();

    return {
      evacuationCenters: evacuationCenters?.length || 0,
      userLocation: !!userLocation,
      emergencyContacts: emergencyContacts?.length || 0,
      disasterInfo: disasterInfo?.length || 0,
      cacheSize: Math.round(cacheSize / 1024), // KB
      isOffline: this.isOfflineMode()
    };
  }
}
