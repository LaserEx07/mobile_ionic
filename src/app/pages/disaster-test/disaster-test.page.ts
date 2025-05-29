import { Component, OnInit } from '@angular/core';
import { IonicModule, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

interface EvacuationCenter {
  id: number;
  name: string;
  disaster_type: string;
  latitude: number;
  longitude: number;
  status: string;
}

@Component({
  selector: 'app-disaster-test',
  templateUrl: './disaster-test.page.html',
  styleUrls: ['./disaster-test.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class DisasterTestPage implements OnInit {

  allCenters: EvacuationCenter[] = [];
  earthquakeCenters: EvacuationCenter[] = [];
  typhoonCenters: EvacuationCenter[] = [];
  floodCenters: EvacuationCenter[] = [];
  
  testResults = {
    totalCenters: 0,
    earthquakeCount: 0,
    typhoonCount: 0,
    floodCount: 0,
    unknownCount: 0
  };

  isLoading = false;

  constructor(
    private http: HttpClient,
    private toastCtrl: ToastController
  ) { }

  ngOnInit() {
    this.loadAndTestData();
  }

  async loadAndTestData() {
    this.isLoading = true;
    
    try {
      console.log('🔍 Testing disaster-specific filtering...');
      
      // Load all evacuation centers
      const centers = await firstValueFrom(
        this.http.get<EvacuationCenter[]>(`${environment.apiUrl}/evacuation-centers`)
      );
      
      this.allCenters = centers || [];
      this.testResults.totalCenters = this.allCenters.length;
      
      console.log(`📊 Total centers loaded: ${this.allCenters.length}`);
      
      // Test filtering for each disaster type
      this.testEarthquakeFiltering();
      this.testTyphoonFiltering();
      this.testFloodFiltering();
      this.analyzeDataQuality();
      
      const toast = await this.toastCtrl.create({
        message: `✅ Test completed! Found ${this.testResults.totalCenters} centers`,
        duration: 3000,
        color: 'success'
      });
      await toast.present();
      
    } catch (error) {
      console.error('❌ Error loading evacuation centers:', error);
      
      const toast = await this.toastCtrl.create({
        message: '❌ Failed to load evacuation centers',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    } finally {
      this.isLoading = false;
    }
  }

  testEarthquakeFiltering() {
    console.log('\n🔍 Testing Earthquake filtering...');
    
    this.earthquakeCenters = this.allCenters.filter(center => {
      const isMatch = center.disaster_type === 'Earthquake';
      if (isMatch) {
        console.log(`✅ Earthquake center: ${center.name} (${center.disaster_type})`);
      }
      return isMatch;
    });
    
    this.testResults.earthquakeCount = this.earthquakeCenters.length;
    console.log(`📊 Earthquake centers found: ${this.earthquakeCenters.length}`);
  }

  testTyphoonFiltering() {
    console.log('\n🔍 Testing Typhoon filtering...');
    
    this.typhoonCenters = this.allCenters.filter(center => {
      const isMatch = center.disaster_type === 'Typhoon';
      if (isMatch) {
        console.log(`✅ Typhoon center: ${center.name} (${center.disaster_type})`);
      }
      return isMatch;
    });
    
    this.testResults.typhoonCount = this.typhoonCenters.length;
    console.log(`📊 Typhoon centers found: ${this.typhoonCenters.length}`);
  }

  testFloodFiltering() {
    console.log('\n🔍 Testing Flood filtering...');
    
    this.floodCenters = this.allCenters.filter(center => {
      const isMatch = center.disaster_type === 'Flood';
      if (isMatch) {
        console.log(`✅ Flood center: ${center.name} (${center.disaster_type})`);
      }
      return isMatch;
    });
    
    this.testResults.floodCount = this.floodCenters.length;
    console.log(`📊 Flood centers found: ${this.floodCenters.length}`);
  }

  analyzeDataQuality() {
    console.log('\n📊 Data Quality Analysis...');
    
    const unknownCenters = this.allCenters.filter(center => {
      const hasValidType = ['Earthquake', 'Typhoon', 'Flood'].includes(center.disaster_type);
      if (!hasValidType) {
        console.log(`⚠️ Unknown disaster type: ${center.name} (${center.disaster_type || 'null'})`);
      }
      return !hasValidType;
    });
    
    this.testResults.unknownCount = unknownCenters.length;
    
    console.log('\n📈 Summary:');
    console.log(`Total Centers: ${this.testResults.totalCenters}`);
    console.log(`Earthquake: ${this.testResults.earthquakeCount}`);
    console.log(`Typhoon: ${this.testResults.typhoonCount}`);
    console.log(`Flood: ${this.testResults.floodCount}`);
    console.log(`Unknown/Invalid: ${this.testResults.unknownCount}`);
    
    // Verify totals match
    const sum = this.testResults.earthquakeCount + this.testResults.typhoonCount + 
                this.testResults.floodCount + this.testResults.unknownCount;
    
    if (sum === this.testResults.totalCenters) {
      console.log('✅ Data integrity check passed');
    } else {
      console.log(`❌ Data integrity check failed: ${sum} !== ${this.testResults.totalCenters}`);
    }
  }

  getDisasterTypeColor(type: string): string {
    switch (type) {
      case 'Earthquake': return 'warning';
      case 'Typhoon': return 'success';
      case 'Flood': return 'primary';
      default: return 'medium';
    }
  }

  getDisasterTypeIcon(type: string): string {
    switch (type) {
      case 'Earthquake': return 'pulse';
      case 'Typhoon': return 'cloudy';
      case 'Flood': return 'water';
      default: return 'help-circle';
    }
  }

  async testNavigation(disasterType: string) {
    const toast = await this.toastCtrl.create({
      message: `🧪 Testing navigation to ${disasterType} map...`,
      duration: 2000,
      color: 'primary'
    });
    await toast.present();
    
    // Simulate the navigation that would happen from home page
    console.log(`🧪 Testing navigation to ${disasterType} map`);
    console.log(`Expected centers to show: ${this.getCenterCountForType(disasterType)}`);
  }

  getCenterCountForType(type: string): number {
    switch (type) {
      case 'Earthquake': return this.testResults.earthquakeCount;
      case 'Typhoon': return this.testResults.typhoonCount;
      case 'Flood': return this.testResults.floodCount;
      default: return 0;
    }
  }

  getCentersForType(type: string): EvacuationCenter[] {
    switch (type) {
      case 'Earthquake': return this.earthquakeCenters;
      case 'Typhoon': return this.typhoonCenters;
      case 'Flood': return this.floodCenters;
      default: return [];
    }
  }
}
