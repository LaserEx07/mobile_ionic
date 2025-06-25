import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { EnhancedDownloadService } from '../../services/enhanced-download.service';
import * as L from 'leaflet';

@Component({
  selector: 'app-download-test',
  templateUrl: './download-test.page.html',
  styleUrls: ['./download-test.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class DownloadTestPage implements OnInit, OnDestroy {
  private map!: L.Map;
  private userMarker: L.Marker | null = null;
  private testMarkers: L.Marker[] = [];
  private testRoute: L.Polyline | null = null;

  constructor(
    private router: Router,
    private enhancedDownload: EnhancedDownloadService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    // Initialize map after view loads
    setTimeout(() => {
      this.initializeTestMap();
    }, 500);
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  private initializeTestMap() {
    // Cebu City coordinates
    const lat = 10.3157;
    const lng = 123.8854;

    this.map = L.map('test-map').setView([lat, lng], 13);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'OpenStreetMap contributors'
    }).addTo(this.map);

    // Add user marker
    this.userMarker = L.marker([lat, lng], {
      icon: L.icon({
        iconUrl: 'assets/Location.png',
        iconSize: [30, 30],
        iconAnchor: [15, 30]
      })
    }).addTo(this.map);

    this.userMarker.bindPopup('📍 You are here (Test Location)').openPopup();

    // Add test evacuation centers
    this.addTestEvacuationCenters();

    // Add test route
    this.addTestRoute();
  }

  private addTestEvacuationCenters() {
    const testCenters = [
      {
        lat: 10.3200,
        lng: 123.8900,
        name: 'Test Fire Center',
        iconUrl: 'assets/forFire.png',
        type: 'Fire'
      },
      {
        lat: 10.3100,
        lng: 123.8800,
        name: 'Test Flood Center',
        iconUrl: 'assets/forFlood.png',
        type: 'Flood'
      },
      {
        lat: 10.3250,
        lng: 123.8750,
        name: 'Test Earthquake Center',
        iconUrl: 'assets/forEarthquake.png',
        type: 'Earthquake'
      }
    ];

    testCenters.forEach(center => {
      const marker = L.marker([center.lat, center.lng], {
        icon: L.icon({
          iconUrl: center.iconUrl,
          iconSize: [40, 40],
          iconAnchor: [20, 40],
          popupAnchor: [0, -40]
        })
      });

      marker.bindPopup(`
        <div class="evacuation-popup">
          <h3>${center.name}</h3>
          <p><strong>Type:</strong> ${center.type}</p>
          <p><strong>Status:</strong> Available</p>
          <p><em>Test evacuation center</em></p>
        </div>
      `);

      marker.addTo(this.map);
      this.testMarkers.push(marker);
    });
  }

  private addTestRoute() {
    // Create a test route from user location to nearest center
    const routeCoordinates: [number, number][] = [
      [10.3157, 123.8854], // User location
      [10.3170, 123.8870],
      [10.3185, 123.8885],
      [10.3200, 123.8900]  // Fire center
    ];

    this.testRoute = L.polyline(routeCoordinates, {
      color: '#ff9500',
      weight: 5,
      opacity: 0.8
    }).addTo(this.map);

    this.testRoute.bindPopup('Test Route to Fire Evacuation Center');
  }

  async testBasicDownload() {
    if (!this.map) {
      const toast = await this.toastCtrl.create({
        message: 'Map not loaded yet. Please wait and try again.',
        duration: 3000,
        color: 'warning'
      });
      await toast.present();
      return;
    }

    try {
      await this.enhancedDownload.downloadMapWithRoutes(
        'test-map',
        this.map,
        'Test-Basic',
        true
      );
    } catch (error) {
      console.error('Basic download test error:', error);
      const toast = await this.toastCtrl.create({
        message: 'Basic download test failed. Check console for details.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  async testOfflineDownload() {
    if (!this.map) {
      const toast = await this.toastCtrl.create({
        message: 'Map not loaded yet. Please wait and try again.',
        duration: 3000,
        color: 'warning'
      });
      await toast.present();
      return;
    }

    try {
      // Extract map data
      const mapData = await (this.enhancedDownload as any).extractMapData(this.map);
      
      // Create offline canvas
      const canvas = await (this.enhancedDownload as any).createOfflineMapCanvas(
        this.map,
        mapData,
        800,
        600
      );

      // Save to device
      await (this.enhancedDownload as any).saveToDevice(canvas, 'Test-Offline');

      const toast = await this.toastCtrl.create({
        message: 'Offline download test completed successfully!',
        duration: 3000,
        color: 'success'
      });
      await toast.present();

    } catch (error) {
      console.error('Offline download test error:', error);
      const toast = await this.toastCtrl.create({
        message: 'Offline download test failed. Check console for details.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  goBack() {
    this.router.navigate(['/tabs/home']);
  }
}
