import { Injectable } from '@angular/core';
import { ToastController, LoadingController } from '@ionic/angular';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import html2canvas from 'html2canvas';
import * as L from 'leaflet';


interface MarkerData {
  lat: number;
  lng: number;
  iconUrl: string;
  iconSize: [number, number];
  popupContent?: string;
}

interface RouteData {
  coordinates: [number, number][];
  color: string;
  weight: number;
}

@Injectable({
  providedIn: 'root'
})
export class EnhancedDownloadService {

  constructor(
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {}

  /**
   * Enhanced download that saves to device and includes routes
   */
  async downloadMapWithRoutes(
    mapElementId: string,
    mapInstance: L.Map,
    disasterType: string,
    includeRoutes: boolean = true
  ): Promise<void> {
    const loading = await this.loadingCtrl.create({
      message: `Capturing ${disasterType} map with routes...`,
      spinner: 'crescent'
    });
    await loading.present();

    try {
      let canvas: HTMLCanvasElement;

      // Try multiple approaches for better compatibility
      try {
        // Method 1: Composite canvas approach (best quality)
        console.log('Attempting composite canvas approach...');
        const mapData = await this.extractMapData(mapInstance);
        canvas = await this.createCompositeMapCanvas(mapElementId, mapInstance, mapData);
      } catch (compositeError) {
        console.warn('Composite approach failed, trying fallback:', compositeError);

        // Method 2: Enhanced html2canvas fallback
        canvas = await this.captureWithEnhancedHtml2Canvas(mapElementId);
      }

      // Step 3: Save to device properly
      const fileName = await this.saveToDevice(canvas, disasterType);

      await loading.dismiss();

      // Show success message
      const toast = await this.toastCtrl.create({
        message: `📱 ${disasterType} map with routes saved to device gallery!`,
        duration: 4000,
        color: 'success',
        buttons: [
          {
            text: 'View',
            handler: () => {
              this.openDeviceGallery();
            }
          }
        ]
      });
      await toast.present();

    } catch (error) {
      await loading.dismiss();
      console.error('Enhanced download error:', error);

      const toast = await this.toastCtrl.create({
        message: 'Failed to save map to device. Please try again.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  /**
   * Extract all map data including markers, routes, and bounds
   */
  private async extractMapData(map: L.Map): Promise<{markers: MarkerData[], routes: RouteData[], bounds: L.LatLngBounds}> {
    const markers: MarkerData[] = [];
    const routes: RouteData[] = [];

    // Extract markers and routes from map layers
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) {
        const latLng = layer.getLatLng();
        const icon = layer.options.icon;

        // Handle iconSize properly
        let iconSize: [number, number] = [30, 30];
        if (icon?.options?.iconSize) {
          if (Array.isArray(icon.options.iconSize)) {
            iconSize = icon.options.iconSize as [number, number];
          } else if (icon.options.iconSize instanceof L.Point) {
            iconSize = [icon.options.iconSize.x, icon.options.iconSize.y];
          }
        }

        // Handle popup content properly
        let popupContent: string | undefined;
        const popup = layer.getPopup();
        if (popup) {
          const content = popup.getContent();
          if (typeof content === 'string') {
            popupContent = content;
          } else if (content instanceof HTMLElement) {
            popupContent = content.innerHTML;
          }
        }

        markers.push({
          lat: latLng.lat,
          lng: latLng.lng,
          iconUrl: icon?.options?.iconUrl || 'assets/Location.png',
          iconSize: iconSize,
          popupContent: popupContent
        });
      } else if (layer instanceof L.Polyline) {
        const latLngs = layer.getLatLngs() as L.LatLng[];
        routes.push({
          coordinates: latLngs.map(ll => [ll.lat, ll.lng]),
          color: layer.options.color || '#3388ff',
          weight: layer.options.weight || 3
        });
      }
    });

    return {
      markers,
      routes,
      bounds: map.getBounds()
    };
  }

  /**
   * Create a composite canvas with map tiles and overlays
   */
  private async createCompositeMapCanvas(
    mapElementId: string,
    mapInstance: L.Map,
    mapData: {markers: MarkerData[], routes: RouteData[], bounds: L.LatLngBounds}
  ): Promise<HTMLCanvasElement> {
    const mapElement = document.getElementById(mapElementId);
    if (!mapElement) {
      throw new Error('Map element not found');
    }

    console.log('Creating composite map canvas...');

    // Step 1: Capture base map with html2canvas (fallback method)
    const baseCanvas = await this.captureBaseMap(mapElement);

    // Step 2: Create a new canvas for compositing
    const compositeCanvas = document.createElement('canvas');
    const ctx = compositeCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Set canvas size to match the map element
    const rect = mapElement.getBoundingClientRect();
    compositeCanvas.width = rect.width * 2; // Higher resolution
    compositeCanvas.height = rect.height * 2;
    ctx.scale(2, 2); // Scale for higher resolution

    // Step 3: Draw base map
    ctx.drawImage(baseCanvas, 0, 0, rect.width, rect.height);

    // Step 4: Draw routes
    await this.drawRoutesOnCanvas(ctx, mapInstance, mapData.routes, rect);

    // Step 5: Draw markers
    await this.drawMarkersOnCanvas(ctx, mapInstance, mapData.markers, rect);

    return compositeCanvas;
  }





  /**
   * Capture base map using html2canvas
   */
  private async captureBaseMap(mapElement: HTMLElement): Promise<HTMLCanvasElement> {
    return await html2canvas(mapElement, {
      useCORS: true,
      allowTaint: true,
      foreignObjectRendering: false, // Disable for better tile capture
      scrollX: 0,
      scrollY: 0,
      scale: 1, // Use 1x scale for base, we'll scale the composite
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 10000,
      ignoreElements: (element) => {
        // Ignore controls, markers, and overlays - we'll draw them separately
        return element.classList.contains('leaflet-control-zoom') ||
               element.classList.contains('leaflet-control-attribution') ||
               element.classList.contains('leaflet-marker-pane') ||
               element.classList.contains('leaflet-overlay-pane') ||
               element.classList.contains('leaflet-shadow-pane');
      }
    });
  }

  /**
   * Draw routes on canvas
   */
  private async drawRoutesOnCanvas(
    ctx: CanvasRenderingContext2D,
    map: L.Map,
    routes: RouteData[],
    _mapRect: DOMRect
  ): Promise<void> {
    routes.forEach(route => {
      if (route.coordinates.length < 2) return;

      ctx.strokeStyle = route.color;
      ctx.lineWidth = route.weight;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      route.coordinates.forEach((coord, index) => {
        const point = map.latLngToContainerPoint([coord[0], coord[1]]);
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.stroke();
    });
  }

  /**
   * Draw markers on canvas
   */
  private async drawMarkersOnCanvas(
    ctx: CanvasRenderingContext2D,
    map: L.Map,
    markers: MarkerData[],
    _mapRect: DOMRect
  ): Promise<void> {
    for (const marker of markers) {
      try {
        const point = map.latLngToContainerPoint([marker.lat, marker.lng]);

        // Load marker image
        const img = await this.loadImage(marker.iconUrl);
        const [width, height] = marker.iconSize;

        // Draw marker image
        ctx.drawImage(
          img,
          point.x - width / 2,
          point.y - height,
          width,
          height
        );
      } catch (error) {
        console.warn('Failed to load marker image:', marker.iconUrl, error);
        // Draw a simple circle as fallback
        const point = map.latLngToContainerPoint([marker.lat, marker.lng]);
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 8, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }

  /**
   * Load image as Promise
   */
  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  /**
   * Enhanced html2canvas fallback method
   */
  private async captureWithEnhancedHtml2Canvas(mapElementId: string): Promise<HTMLCanvasElement> {
    const mapElement = document.getElementById(mapElementId);
    if (!mapElement) {
      throw new Error('Map element not found');
    }

    console.log('Using enhanced html2canvas fallback...');

    // Wait for map to be fully rendered
    await this.waitForMapRender();

    return await html2canvas(mapElement as HTMLElement, {
      useCORS: true,
      allowTaint: true,
      foreignObjectRendering: true,
      scrollX: 0,
      scrollY: 0,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      scale: 2, // Higher resolution
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 15000,
      removeContainer: false,
      // Try to capture everything including overlays
      ignoreElements: (element) => {
        // Only ignore zoom controls and attribution
        return element.classList.contains('leaflet-control-zoom') ||
               element.classList.contains('leaflet-control-attribution');
      }
    });
  }

  /**
   * Wait for map tiles and overlays to render
   */
  private async waitForMapRender(): Promise<void> {
    return new Promise((resolve) => {
      // Wait for any pending animations or renders
      setTimeout(() => {
        // Additional wait for any async operations
        requestAnimationFrame(() => {
          setTimeout(resolve, 500);
        });
      }, 1000);
    });
  }

  /**
   * Create offline-compatible map canvas using cached tiles
   */
  async createOfflineMapCanvas(
    mapInstance: L.Map,
    mapData: {markers: MarkerData[], routes: RouteData[], bounds: L.LatLngBounds},
    width: number = 800,
    height: number = 600
  ): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    canvas.width = width;
    canvas.height = height;

    // Set background
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);

    try {
      // Get map bounds and zoom
      const bounds = mapInstance.getBounds();
      const zoom = mapInstance.getZoom();
      const center = mapInstance.getCenter();

      // Draw cached tiles if available
      await this.drawCachedTiles(ctx, bounds, zoom, width, height);

      // Create a temporary map instance for coordinate conversion
      const tempDiv = document.createElement('div');
      tempDiv.style.width = `${width}px`;
      tempDiv.style.height = `${height}px`;
      tempDiv.style.position = 'absolute';
      tempDiv.style.top = '-9999px';
      document.body.appendChild(tempDiv);

      const tempMap = L.map(tempDiv).setView([center.lat, center.lng], zoom);

      // Draw routes
      await this.drawRoutesOnCanvas(ctx, tempMap, mapData.routes, { width, height } as DOMRect);

      // Draw markers
      await this.drawMarkersOnCanvas(ctx, tempMap, mapData.markers, { width, height } as DOMRect);

      // Cleanup
      tempMap.remove();
      document.body.removeChild(tempDiv);

    } catch (error) {
      console.warn('Error creating offline map canvas:', error);
      // Draw fallback content
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Map data unavailable', width / 2, height / 2);
    }

    return canvas;
  }

  /**
   * Draw cached map tiles on canvas
   */
  private async drawCachedTiles(
    ctx: CanvasRenderingContext2D,
    bounds: L.LatLngBounds,
    zoom: number,
    _width: number,
    _height: number
  ): Promise<void> {
    // Calculate tile bounds
    const tileSize = 256;
    const northWest = bounds.getNorthWest();
    const southEast = bounds.getSouthEast();

    // Convert lat/lng to tile coordinates
    const nwTile = this.latLngToTile(northWest.lat, northWest.lng, zoom);
    const seTile = this.latLngToTile(southEast.lat, southEast.lng, zoom);

    const startX = Math.floor(nwTile.x);
    const endX = Math.ceil(seTile.x);
    const startY = Math.floor(nwTile.y);
    const endY = Math.ceil(seTile.y);

    // Draw tiles
    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        try {
          // For online-only app, we'll draw a placeholder for map tiles
          // since we can't access cached tiles anymore
          const tileX = (x - nwTile.x) * tileSize;
          const tileY = (y - nwTile.y) * tileSize;

          ctx.fillStyle = '#e8f4f8';
          ctx.fillRect(tileX, tileY, tileSize, tileSize);
          ctx.strokeStyle = '#b0d4e3';
          ctx.strokeRect(tileX, tileY, tileSize, tileSize);

          // Add text indicating map area
          ctx.fillStyle = '#666';
          ctx.font = '10px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('Map Area', tileX + tileSize/2, tileY + tileSize/2);
        } catch (error) {
          console.warn(`Failed to draw tile ${zoom}/${x}/${y}:`, error);
        }
      }
    }
  }

  /**
   * Convert lat/lng to tile coordinates
   */
  private latLngToTile(lat: number, lng: number, zoom: number): {x: number, y: number} {
    const n = Math.pow(2, zoom);
    const x = ((lng + 180) / 360) * n;
    const y = (1 - (Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI)) / 2 * n;
    return { x, y };
  }

  /**
   * Load image from base64 data
   */
  private loadImageFromBase64(base64Data: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = `data:image/png;base64,${base64Data}`;
    });
  }

  /**
   * Save image to device using Capacitor Filesystem
   */
  private async saveToDevice(canvas: HTMLCanvasElement, disasterType: string): Promise<string> {
    // Convert canvas to base64
    const imageData = canvas.toDataURL('image/png', 1.0);
    const base64Data = imageData.split(',')[1]; // Remove data:image/png;base64, prefix

    // Generate filename
    const date = new Date();
    const dateString = date.toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const fileName = `${disasterType.toLowerCase()}-evacuation-map-${dateString}.png`;

    try {
      if (Capacitor.isNativePlatform()) {
        // Use Capacitor Filesystem for native platforms
        await this.saveToNativeDevice(base64Data, fileName);
      } else {
        // Use browser download for web
        this.fallbackBrowserDownload(imageData, fileName);
      }
      return fileName;
    } catch (error) {
      console.error('Download error:', error);
      // Fallback to browser download if native fails
      this.fallbackBrowserDownload(imageData, fileName);
      return fileName;
    }
  }

  /**
   * Save to native device using Capacitor Filesystem
   */
  private async saveToNativeDevice(base64Data: string, fileName: string): Promise<void> {
    try {
      // Save to Documents directory (accessible by user)
      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true
      });

      console.log('File saved to:', result.uri);

      // Also try to save to external storage if available (Android)
      if (this.isAndroid()) {
        try {
          await Filesystem.writeFile({
            path: `Download/${fileName}`,
            data: base64Data,
            directory: Directory.ExternalStorage,
            recursive: true
          });
          console.log('File also saved to Downloads folder');
        } catch (downloadError) {
          console.log('Could not save to Downloads folder:', downloadError);
        }
      }
    } catch (error) {
      console.error('Native file save error:', error);
      throw error;
    }
  }

  /**
   * Fallback to browser download if Capacitor fails
   */
  private fallbackBrowserDownload(imageData: string, fileName: string): void {
    const link = document.createElement('a');
    link.href = imageData;
    link.download = fileName;

    // For mobile browsers, try to trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('Used fallback browser download');
  }

  /**
   * Check if running on Android
   */
  private isAndroid(): boolean {
    return /Android/i.test(navigator.userAgent);
  }

  /**
   * Check if running on iOS
   */
  private isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  /**
   * Open device gallery (platform-specific)
   */
  private async openDeviceGallery(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        if (this.isAndroid()) {
          // Android: Try to open Downloads folder or file manager
          try {
            window.open('content://com.android.externalstorage.documents/document/primary%3ADownload', '_system');
          } catch (error) {
            // Fallback to generic file manager
            window.open('content://com.android.externalstorage.documents/', '_system');
          }
        } else if (this.isIOS()) {
          // iOS: Open Files app
          window.open('shareddocuments://', '_system');
        }
      } else {
        // Web: Show message about download location
        const toast = await this.toastCtrl.create({
          message: 'File downloaded to your browser\'s download folder',
          duration: 3000,
          color: 'primary'
        });
        await toast.present();
      }
    } catch (error) {
      console.error('Error opening gallery:', error);
      const toast = await this.toastCtrl.create({
        message: 'File saved successfully! Check your device\'s file manager.',
        duration: 3000,
        color: 'success'
      });
      await toast.present();
    }
  }

  /**
   * Get download statistics
   */
  async getDownloadStats(): Promise<{totalDownloads: number, lastDownload: string}> {
    try {
      if (Capacitor.isNativePlatform()) {
        // Try to read from Documents directory
        const result = await Filesystem.readdir({
          path: '',
          directory: Directory.Documents
        });

        // Filter for map files
        const mapFiles = result.files.filter((file: any) =>
          file.name.includes('evacuation-map') && file.name.endsWith('.png')
        );

        return {
          totalDownloads: mapFiles.length,
          lastDownload: mapFiles.length > 0 ? mapFiles[mapFiles.length - 1].name : 'None'
        };
      } else {
        // For web, return basic info
        return {
          totalDownloads: 0,
          lastDownload: 'Check browser downloads'
        };
      }
    } catch (error) {
      console.error('Error getting download stats:', error);
      return {
        totalDownloads: 0,
        lastDownload: 'None'
      };
    }
  }
}
