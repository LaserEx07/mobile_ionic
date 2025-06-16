import { Injectable } from '@angular/core';
import { ToastController, LoadingController } from '@ionic/angular';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import html2canvas from 'html2canvas';
import * as L from 'leaflet';

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
      // Step 1: Prepare map for capture (ensure all layers are visible)
      await this.prepareMapForCapture(mapInstance, includeRoutes);

      // Step 2: Capture the map with enhanced settings
      const canvas = await this.captureMapWithRoutes(mapElementId);

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
   * Prepare map for capture - ensure all overlays are visible
   */
  private async prepareMapForCapture(map: L.Map, includeRoutes: boolean): Promise<void> {
    return new Promise((resolve) => {
      // Force map to render all tiles
      map.invalidateSize();
      
      // Wait for tiles to load
      let tilesLoading = 0;
      let tilesLoaded = 0;

      map.eachLayer((layer: any) => {
        if (layer._tiles) {
          // Count tiles
          Object.keys(layer._tiles).forEach(() => {
            tilesLoading++;
          });
        }
      });

      // If no tiles to wait for, resolve immediately
      if (tilesLoading === 0) {
        setTimeout(resolve, 500); // Small delay to ensure rendering
        return;
      }

      // Wait for tiles to load
      const checkTilesLoaded = () => {
        tilesLoaded++;
        if (tilesLoaded >= tilesLoading) {
          setTimeout(resolve, 500); // Extra delay for route overlays
        }
      };

      map.eachLayer((layer: any) => {
        if (layer._tiles) {
          Object.values(layer._tiles).forEach((tile: any) => {
            if (tile.el && tile.el.complete) {
              checkTilesLoaded();
            } else if (tile.el) {
              tile.el.onload = checkTilesLoaded;
              tile.el.onerror = checkTilesLoaded;
            } else {
              checkTilesLoaded();
            }
          });
        }
      });

      // Fallback timeout
      setTimeout(resolve, 3000);
    });
  }

  /**
   * Capture map with enhanced settings to include routes and overlays
   */
  private async captureMapWithRoutes(mapElementId: string): Promise<HTMLCanvasElement> {
    const mapElement = document.getElementById(mapElementId);
    if (!mapElement) {
      throw new Error('Map element not found');
    }

    console.log('Capturing map with enhanced html2canvas settings...');

    // Use enhanced html2canvas with better settings for map capture
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
      // Capture all layers including SVG overlays (routes)
      ignoreElements: (element) => {
        // Only ignore zoom controls and attribution
        return element.classList.contains('leaflet-control-zoom') ||
               element.classList.contains('leaflet-control-attribution');
      }
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
