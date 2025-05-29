import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { catchError, timeout, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface CommunicationTestResult {
  endpoint: string;
  success: boolean;
  responseTime: number;
  message: string;
  data?: any;
  error?: string;
}

export interface CommunicationStatus {
  backendConnected: boolean;
  apiWorking: boolean;
  firebaseConfigured: boolean;
  databaseConnected: boolean;
  overallStatus: 'connected' | 'partial' | 'disconnected';
  lastChecked: Date;
  results: CommunicationTestResult[];
}

@Injectable({
  providedIn: 'root'
})
export class CommunicationTestService {
  private statusSubject = new BehaviorSubject<CommunicationStatus>({
    backendConnected: false,
    apiWorking: false,
    firebaseConfigured: false,
    databaseConnected: false,
    overallStatus: 'disconnected',
    lastChecked: new Date(),
    results: []
  });

  public status$ = this.statusSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Run comprehensive communication tests
   */
  async runFullCommunicationTest(): Promise<CommunicationStatus> {
    console.log('🔍 Starting comprehensive communication test...');
    
    const results: CommunicationTestResult[] = [];
    
    // Test 1: Basic API connectivity
    const apiTest = await this.testApiConnectivity();
    results.push(apiTest);
    
    // Test 2: Health check endpoint
    const healthTest = await this.testHealthCheck();
    results.push(healthTest);
    
    // Test 3: Evacuation centers endpoint
    const evacuationTest = await this.testEvacuationCenters();
    results.push(evacuationTest);
    
    // Test 4: Firebase configuration
    const firebaseTest = await this.testFirebaseConfig();
    results.push(firebaseTest);
    
    // Test 5: FCM token registration
    const fcmTest = await this.testFCMTokenRegistration();
    results.push(fcmTest);
    
    // Calculate overall status
    const status = this.calculateOverallStatus(results);
    
    console.log('📊 Communication test results:', status);
    this.statusSubject.next(status);
    
    return status;
  }

  /**
   * Test basic API connectivity
   */
  private async testApiConnectivity(): Promise<CommunicationTestResult> {
    const startTime = Date.now();
    
    try {
      const response = await this.http.get(`${environment.apiUrl}/test`)
        .pipe(
          timeout(environment.communication.timeoutMs),
          catchError(this.handleError)
        ).toPromise();
      
      const responseTime = Date.now() - startTime;
      
      return {
        endpoint: 'API Test',
        success: true,
        responseTime,
        message: 'API is responding correctly',
        data: response
      };
    } catch (error) {
      return {
        endpoint: 'API Test',
        success: false,
        responseTime: Date.now() - startTime,
        message: 'Failed to connect to API',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test health check endpoint
   */
  private async testHealthCheck(): Promise<CommunicationTestResult> {
    const startTime = Date.now();
    
    try {
      const response = await this.http.get(environment.healthCheckUrl)
        .pipe(
          timeout(environment.communication.timeoutMs),
          catchError(this.handleError)
        ).toPromise();
      
      const responseTime = Date.now() - startTime;
      
      return {
        endpoint: 'Health Check',
        success: true,
        responseTime,
        message: 'Server health check passed',
        data: response
      };
    } catch (error) {
      return {
        endpoint: 'Health Check',
        success: false,
        responseTime: Date.now() - startTime,
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test evacuation centers endpoint
   */
  private async testEvacuationCenters(): Promise<CommunicationTestResult> {
    const startTime = Date.now();
    
    try {
      const response = await this.http.get(`${environment.apiUrl}/evacuation-centers`)
        .pipe(
          timeout(environment.communication.timeoutMs),
          catchError(this.handleError)
        ).toPromise();
      
      const responseTime = Date.now() - startTime;
      
      return {
        endpoint: 'Evacuation Centers',
        success: true,
        responseTime,
        message: 'Evacuation centers endpoint working',
        data: response
      };
    } catch (error) {
      return {
        endpoint: 'Evacuation Centers',
        success: false,
        responseTime: Date.now() - startTime,
        message: 'Evacuation centers endpoint failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test Firebase configuration
   */
  private async testFirebaseConfig(): Promise<CommunicationTestResult> {
    const startTime = Date.now();
    
    try {
      // Check if Firebase config is properly set
      const config = environment.firebase;
      const isConfigured = config.projectId && config.messagingSenderId && config.appId;
      
      const responseTime = Date.now() - startTime;
      
      return {
        endpoint: 'Firebase Config',
        success: isConfigured,
        responseTime,
        message: isConfigured ? 'Firebase configuration is valid' : 'Firebase configuration is incomplete',
        data: { projectId: config.projectId, configured: isConfigured }
      };
    } catch (error) {
      return {
        endpoint: 'Firebase Config',
        success: false,
        responseTime: Date.now() - startTime,
        message: 'Firebase configuration check failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test FCM token registration
   */
  private async testFCMTokenRegistration(): Promise<CommunicationTestResult> {
    const startTime = Date.now();
    
    try {
      // Test with a mock token
      const mockToken = 'test-token-' + Date.now();
      const payload = {
        token: mockToken,
        platform: 'android',
        project_id: environment.firebase.projectId
      };
      
      const response = await this.http.post(`${environment.apiUrl}/device-token`, payload)
        .pipe(
          timeout(environment.communication.timeoutMs),
          catchError(this.handleError)
        ).toPromise();
      
      const responseTime = Date.now() - startTime;
      
      return {
        endpoint: 'FCM Token Registration',
        success: true,
        responseTime,
        message: 'FCM token registration endpoint working',
        data: response
      };
    } catch (error) {
      return {
        endpoint: 'FCM Token Registration',
        success: false,
        responseTime: Date.now() - startTime,
        message: 'FCM token registration failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Calculate overall communication status
   */
  private calculateOverallStatus(results: CommunicationTestResult[]): CommunicationStatus {
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    let overallStatus: 'connected' | 'partial' | 'disconnected';
    
    if (successCount === totalCount) {
      overallStatus = 'connected';
    } else if (successCount > 0) {
      overallStatus = 'partial';
    } else {
      overallStatus = 'disconnected';
    }
    
    return {
      backendConnected: results.find(r => r.endpoint === 'API Test')?.success || false,
      apiWorking: results.find(r => r.endpoint === 'Health Check')?.success || false,
      firebaseConfigured: results.find(r => r.endpoint === 'Firebase Config')?.success || false,
      databaseConnected: results.find(r => r.endpoint === 'Evacuation Centers')?.success || false,
      overallStatus,
      lastChecked: new Date(),
      results
    };
  }

  /**
   * Handle HTTP errors
   */
  private handleError = (error: HttpErrorResponse): Observable<any> => {
    console.error('HTTP Error:', error);
    throw error;
  };

  /**
   * Get current status
   */
  getCurrentStatus(): CommunicationStatus {
    return this.statusSubject.value;
  }

  /**
   * Quick connectivity test
   */
  async quickConnectivityTest(): Promise<boolean> {
    try {
      await this.http.get(`${environment.apiUrl}/test`)
        .pipe(timeout(5000))
        .toPromise();
      return true;
    } catch {
      return false;
    }
  }
}
