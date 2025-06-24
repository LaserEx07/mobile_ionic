import { Component, OnInit } from '@angular/core';
import { OpenStreetMapRoutingService } from '../../services/openstreetmap-routing.service';

@Component({
  selector: 'app-ors-test',
  templateUrl: './ors-test.page.html',
  styleUrls: ['./ors-test.page.scss'],
})
export class OrsTestPage implements OnInit {
  testResults: any = {};
  logs: string[] = [];
  isLoading = false;

  constructor(private orsService: OpenStreetMapRoutingService) {}

  // Helper method to check if testResults has any keys
  hasTestResults(): boolean {
    return Object.keys(this.testResults).length > 0;
  }

  ngOnInit() {
    this.addLog('🚀 OpenRouteService Test Page Initialized');
  }

  addLog(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    this.logs.push(`[${timestamp}] ${message}`);
    console.log(message);
  }

  async runTests() {
    this.isLoading = true;
    this.logs = [];
    this.testResults = {};

    this.addLog('🧪 Starting OpenRouteService Tests...');

    // Test 1: API Connection
    this.addLog('🔌 Test 1: Testing API connection...');
    try {
      const connectionTest = await this.orsService.testConnection();
      this.testResults.connectionWorks = connectionTest.success;
      
      if (connectionTest.success) {
        this.addLog('✅ API connection successful!');
        this.addLog(`📊 Details: ${JSON.stringify(connectionTest.details)}`);
      } else {
        this.addLog('❌ API connection failed!');
        this.addLog(`❗ Error: ${connectionTest.message}`);
        if (connectionTest.details) {
          this.addLog(`📊 Details: ${JSON.stringify(connectionTest.details)}`);
        }
      }
    } catch (error: any) {
      this.testResults.connectionWorks = false;
      this.addLog(`❌ Connection test error: ${error.message || error}`);
    }

    // Test 2: Route Calculation
    this.addLog('🗺️ Test 2: Testing route calculation...');
    try {
      // Test route in Philippines (Cebu area)
      const startLng = 123.8854;
      const startLat = 10.3157;
      const endLng = 123.8954;
      const endLat = 10.3257;

      this.addLog(`📍 Testing route from [${startLat}, ${startLng}] to [${endLat}, ${endLng}]`);
      
      const response = await this.orsService.getDirections(
        startLng, startLat, endLng, endLat, 
        'foot-walking',
        {
          geometries: 'geojson',
          overview: 'simplified'
        }
      );

      if (response.routes && response.routes.length > 0) {
        this.testResults.routingWorks = true;
        const route = response.routes[0];
        const summary = this.orsService.getRouteSummary(route);
        
        this.addLog('✅ Route calculation successful!');
        this.addLog(`📏 Distance: ${summary.distanceText}`);
        this.addLog(`⏱️ Duration: ${summary.durationText}`);
        this.addLog(`🛣️ Route coordinates: ${route.geometry.coordinates.length} points`);
      } else {
        this.testResults.routingWorks = false;
        this.addLog('❌ No routes returned from OpenRouteService');
      }
    } catch (error: any) {
      this.testResults.routingWorks = false;
      this.addLog(`❌ Route calculation failed: ${error.message || error}`);
    }

    // Test 3: Different Travel Modes
    this.addLog('🚶‍♂️🚴‍♂️🚗 Test 3: Testing different travel modes...');
    const modes: ('foot-walking' | 'cycling-regular' | 'driving-car')[] = ['foot-walking', 'cycling-regular', 'driving-car'];
    
    for (const mode of modes) {
      try {
        this.addLog(`Testing ${mode} mode...`);
        
        const response = await this.orsService.getDirections(
          123.8854, 10.3157, 123.8954, 10.3257,
          mode
        );

        if (response.routes && response.routes.length > 0) {
          const route = response.routes[0];
          const summary = this.orsService.getRouteSummary(route);
          this.addLog(`✅ ${mode}: ${summary.distanceText}, ${summary.durationText}`);
          this.testResults[`${mode}Works`] = true;
        } else {
          this.addLog(`❌ ${mode}: No route found`);
          this.testResults[`${mode}Works`] = false;
        }
      } catch (error: any) {
        this.addLog(`❌ ${mode}: ${error.message || error}`);
        this.testResults[`${mode}Works`] = false;
      }
    }

    // Test 4: Profile Conversion
    this.addLog('🔄 Test 4: Testing profile conversion...');
    const testModes = ['walking', 'cycling', 'driving', 'foot', 'bicycle', 'car'];
    
    testModes.forEach(mode => {
      const profile = this.orsService.convertTravelModeToProfile(mode);
      this.addLog(`${mode} → ${profile}`);
    });

    this.addLog('🏁 All tests completed!');
    this.isLoading = false;
  }

  clearLogs() {
    this.logs = [];
    this.testResults = {};
  }
}
