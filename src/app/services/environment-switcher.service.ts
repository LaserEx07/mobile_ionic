import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';

export interface ApiEndpoint {
  name: string;
  url: string;
  type: 'ngrok' | 'local-ip' | 'localhost';
  description: string;
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class EnvironmentSwitcherService {
  private currentApiUrlSubject = new BehaviorSubject<string>('');
  public currentApiUrl$ = this.currentApiUrlSubject.asObservable();

  // Available API endpoints for testing
  private apiEndpoints: ApiEndpoint[] = [
    {
      name: 'ngrok (Recommended)',
      url: 'https://2xGdwnDAvorrvfTYkPJwFdH0bl8_7EG3njhPc7viiNrH5QWVN.ngrok-free.app/api',
      type: 'ngrok',
      description: 'Secure tunnel, works from anywhere'
    },
    {
      name: 'Home IP (Current)',
      url: 'http://192.168.112.244:8000/api',
      type: 'local-ip',
      description: '🏠 Home network IP - current location'
    },
    {
      name: 'School IP',
      url: 'http://172.30.11.217:8000/api',
      type: 'local-ip',
      description: '🏫 School network IP - when at school'
    },
    {
      name: 'Localhost (Web Only)',
      url: 'http://localhost:8000/api',
      type: 'localhost',
      description: 'Only works in web browser'
    }
  ];

  constructor(private http: HttpClient) {
    // Initialize with the first endpoint
    this.setApiUrl(this.apiEndpoints[1].url); // Start with local IP
  }

  /**
   * Get all available API endpoints
   */
  getApiEndpoints(): ApiEndpoint[] {
    return this.apiEndpoints.map(endpoint => ({
      ...endpoint,
      isActive: endpoint.url === this.getCurrentApiUrl()
    }));
  }

  /**
   * Set the current API URL
   */
  setApiUrl(url: string): void {
    this.currentApiUrlSubject.next(url);
    localStorage.setItem('selectedApiUrl', url);
    console.log('🔄 API URL switched to:', url);
  }

  /**
   * Get the current API URL
   */
  getCurrentApiUrl(): string {
    const stored = localStorage.getItem('selectedApiUrl');
    if (stored) {
      this.currentApiUrlSubject.next(stored);
      return stored;
    }
    return this.currentApiUrlSubject.value || this.apiEndpoints[1].url;
  }

  /**
   * Test connectivity to an API endpoint
   */
  async testEndpoint(url: string): Promise<{ success: boolean; message: string; responseTime?: number }> {
    const startTime = Date.now();

    try {
      // Test the health endpoint
      const healthUrl = url.replace('/api', '/up');

      await this.http.get(healthUrl, {
        responseType: 'text'
      }).toPromise();

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        message: `✅ Connected successfully (${responseTime}ms)`,
        responseTime
      };

    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      let message = '❌ Connection failed';

      if (error.status === 0) {
        message = '❌ Network error - Cannot reach server';
      } else if (error.status === 404) {
        message = '❌ Server found but endpoint not available';
      } else if (error.status >= 500) {
        message = '❌ Server error';
      } else {
        message = `❌ Error ${error.status}: ${error.statusText}`;
      }

      return {
        success: false,
        message: `${message} (${responseTime}ms)`,
        responseTime
      };
    }
  }

  /**
   * Test all endpoints and return results
   */
  async testAllEndpoints(): Promise<(ApiEndpoint & { testResult: any })[]> {
    const results = [];

    for (const endpoint of this.apiEndpoints) {
      const testResult = await this.testEndpoint(endpoint.url);
      results.push({
        ...endpoint,
        testResult
      });
    }

    return results;
  }

  /**
   * Auto-detect the best working endpoint
   */
  async autoDetectBestEndpoint(): Promise<ApiEndpoint | null> {
    console.log('🔍 Auto-detecting best API endpoint...');

    // Test endpoints in order of preference
    const preferredOrder = ['ngrok', 'local-ip', 'localhost'];

    for (const type of preferredOrder) {
      const endpoints = this.apiEndpoints.filter(e => e.type === type);

      for (const endpoint of endpoints) {
        const result = await this.testEndpoint(endpoint.url);

        if (result.success) {
          console.log('✅ Found working endpoint:', endpoint.name);
          this.setApiUrl(endpoint.url);
          return endpoint;
        }
      }
    }

    console.log('❌ No working endpoints found');
    return null;
  }

  /**
   * Get connection diagnostics
   */
  getConnectionDiagnostics(): string[] {
    const diagnostics = [];
    const currentUrl = this.getCurrentApiUrl();
    const currentEndpoint = this.apiEndpoints.find(e => e.url === currentUrl);

    diagnostics.push('🔗 CONNECTION DIAGNOSTICS');
    diagnostics.push('========================');
    diagnostics.push('');
    diagnostics.push(`📡 Current API: ${currentUrl}`);
    diagnostics.push(`🏷️ Type: ${currentEndpoint?.type || 'unknown'}`);
    diagnostics.push('');

    if (currentEndpoint?.type === 'ngrok') {
      diagnostics.push('🔧 NGROK TROUBLESHOOTING:');
      diagnostics.push('1. Check if ngrok is running: http://127.0.0.1:4040');
      diagnostics.push('2. Verify Laravel backend: php artisan serve --host=0.0.0.0 --port=8000');
      diagnostics.push('3. Update ngrok URL if expired');
    } else if (currentEndpoint?.type === 'local-ip') {
      diagnostics.push('🔧 LOCAL IP TROUBLESHOOTING:');
      diagnostics.push('1. Both devices must be on same WiFi');
      diagnostics.push('2. Check Windows Firewall settings');
      diagnostics.push('3. Verify backend server is running');
      diagnostics.push('4. Try switching to ngrok for easier setup');
    }

    diagnostics.push('');
    diagnostics.push('💡 QUICK ACTIONS:');
    diagnostics.push('- Use Environment Switcher to test different URLs');
    diagnostics.push('- Run auto-detection to find working endpoint');
    diagnostics.push('- Check network diagnostics page');

    return diagnostics;
  }
}
