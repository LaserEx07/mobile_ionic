import { Component, OnInit } from '@angular/core';
import { IonicModule, ToastController, LoadingController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { MapboxRoutingService } from '../../services/mapbox-routing.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-mapbox-test',
  templateUrl: './mapbox-test.page.html',
  styleUrls: ['./mapbox-test.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class MapboxTestPage implements OnInit {

  testResults = {
    tokenValid: false,
    apiReachable: false,
    routingWorks: false
  };

  testLogs: string[] = [];
  isRunning = false;

  constructor(
    private mapboxRouting: MapboxRoutingService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) { }

  ngOnInit() {
    this.runTests();
  }

  async runTests() {
    this.isRunning = true;
    this.testLogs = [];
    
    const loading = await this.loadingCtrl.create({
      message: 'Testing Mapbox integration...'
    });
    await loading.present();

    try {
      this.addLog('🚀 Starting Mapbox integration tests...');
      
      // Test 1: Check if token is configured
      this.addLog('📋 Test 1: Checking Mapbox token configuration...');
      if (environment.mapboxAccessToken && environment.mapboxAccessToken.startsWith('pk.')) {
        this.testResults.tokenValid = true;
        this.addLog('✅ Mapbox token is properly configured');
        this.addLog(`🔑 Token: ${environment.mapboxAccessToken.substring(0, 20)}...`);
      } else {
        this.testResults.tokenValid = false;
        this.addLog('❌ Mapbox token is missing or invalid');
        return;
      }

      // Test 2: Check API availability
      this.addLog('🌐 Test 2: Checking Mapbox API availability...');
      try {
        const available = await this.mapboxRouting.checkAvailability();
        this.testResults.apiReachable = available;
        if (available) {
          this.addLog('✅ Mapbox API is reachable');
        } else {
          this.addLog('❌ Mapbox API is not reachable');
        }
      } catch (error) {
        this.testResults.apiReachable = false;
        this.addLog(`❌ Mapbox API test failed: ${error}`);
      }

      // Test 3: Test actual routing
      this.addLog('🗺️ Test 3: Testing route calculation...');
      try {
        // Test route in Philippines (Cebu area)
        const startLng = 123.8854;
        const startLat = 10.3157;
        const endLng = 123.8954;
        const endLat = 10.3257;

        this.addLog(`📍 Testing route from [${startLat}, ${startLng}] to [${endLat}, ${endLng}]`);
        
        const response = await this.mapboxRouting.getDirections(
          startLng, startLat, endLng, endLat, 
          'walking',
          {
            geometries: 'geojson',
            overview: 'simplified'
          }
        );

        if (response.routes && response.routes.length > 0) {
          this.testResults.routingWorks = true;
          const route = response.routes[0];
          const summary = this.mapboxRouting.getRouteSummary(route);
          
          this.addLog('✅ Route calculation successful!');
          this.addLog(`📏 Distance: ${summary.distanceText}`);
          this.addLog(`⏱️ Duration: ${summary.durationText}`);
          this.addLog(`🛣️ Route coordinates: ${route.geometry.coordinates.length} points`);
        } else {
          this.testResults.routingWorks = false;
          this.addLog('❌ No routes returned from Mapbox');
        }
      } catch (error: any) {
        this.testResults.routingWorks = false;
        this.addLog(`❌ Route calculation failed: ${error.message || error}`);
      }

      // Summary
      this.addLog('📊 Test Summary:');
      this.addLog(`Token Valid: ${this.testResults.tokenValid ? '✅' : '❌'}`);
      this.addLog(`API Reachable: ${this.testResults.apiReachable ? '✅' : '❌'}`);
      this.addLog(`Routing Works: ${this.testResults.routingWorks ? '✅' : '❌'}`);

      const allPassed = this.testResults.tokenValid && this.testResults.apiReachable && this.testResults.routingWorks;
      
      if (allPassed) {
        this.addLog('🎉 All tests passed! Mapbox integration is working correctly.');
        
        const toast = await this.toastCtrl.create({
          message: '🎉 Mapbox integration is working perfectly!',
          duration: 5000,
          color: 'success'
        });
        await toast.present();
      } else {
        this.addLog('⚠️ Some tests failed. Please check the logs above.');
        
        const toast = await this.toastCtrl.create({
          message: '⚠️ Some Mapbox tests failed. Check the logs for details.',
          duration: 5000,
          color: 'warning'
        });
        await toast.present();
      }

    } catch (error) {
      this.addLog(`💥 Unexpected error during testing: ${error}`);
    } finally {
      await loading.dismiss();
      this.isRunning = false;
    }
  }

  private addLog(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    this.testLogs.push(`[${timestamp}] ${message}`);
    console.log(message);
  }

  getTestIcon(result: boolean): string {
    return result ? 'checkmark-circle' : 'close-circle';
  }

  getTestColor(result: boolean): string {
    return result ? 'success' : 'danger';
  }
}
