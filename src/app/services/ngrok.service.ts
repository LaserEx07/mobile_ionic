import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface NgrokStatus {
  isActive: boolean;
  currentUrl: string;
  lastChecked: Date;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NgrokService {
  private ngrokStatusSubject = new BehaviorSubject<NgrokStatus>({
    isActive: false,
    currentUrl: environment.apiUrl,
    lastChecked: new Date()
  });

  public ngrokStatus$ = this.ngrokStatusSubject.asObservable();

  constructor(private http: HttpClient) {
    this.checkNgrokStatus();
  }

  /**
   * Check if the current ngrok URL is active
   */
  async checkNgrokStatus(): Promise<NgrokStatus> {
    const status: NgrokStatus = {
      isActive: false,
      currentUrl: environment.apiUrl,
      lastChecked: new Date()
    };

    try {
      // Try to reach the health endpoint
      const healthUrl = environment.apiUrl.replace('/api', '/up');
      
      const response = await this.http.get(healthUrl, { 
        timeout: 5000,
        responseType: 'text'
      }).toPromise();

      status.isActive = true;
      console.log('✅ ngrok connection active:', environment.apiUrl);
      
    } catch (error: any) {
      status.isActive = false;
      status.error = error.message || 'Connection failed';
      console.warn('❌ ngrok connection failed:', error);
    }

    this.ngrokStatusSubject.next(status);
    return status;
  }

  /**
   * Get ngrok tunnel information from local ngrok API
   */
  async getNgrokTunnels(): Promise<any> {
    try {
      // ngrok exposes a local API at http://127.0.0.1:4040/api/tunnels
      const response = await this.http.get('http://127.0.0.1:4040/api/tunnels').toPromise();
      return response;
    } catch (error) {
      console.warn('Could not fetch ngrok tunnels:', error);
      return null;
    }
  }

  /**
   * Get the current ngrok URL
   */
  getCurrentUrl(): string {
    return environment.apiUrl;
  }

  /**
   * Check if we're using ngrok
   */
  isUsingNgrok(): boolean {
    return environment.apiUrl.includes('ngrok');
  }

  /**
   * Get connection diagnostics
   */
  getConnectionDiagnostics(): string[] {
    const diagnostics: string[] = [];
    
    diagnostics.push('🔗 NGROK CONNECTION DIAGNOSTICS');
    diagnostics.push('================================');
    diagnostics.push('');
    
    if (this.isUsingNgrok()) {
      diagnostics.push('✅ Using ngrok tunnel');
      diagnostics.push(`📡 Current URL: ${environment.apiUrl}`);
      diagnostics.push('');
      diagnostics.push('🔧 TROUBLESHOOTING STEPS:');
      diagnostics.push('1. Check if ngrok is running: http://127.0.0.1:4040');
      diagnostics.push('2. Verify Laravel backend is running on port 8000');
      diagnostics.push('3. Make sure ngrok URL matches environment.ts');
      diagnostics.push('4. Try refreshing ngrok tunnel if URL expired');
      diagnostics.push('');
      diagnostics.push('💡 NGROK COMMANDS:');
      diagnostics.push('- Start: ngrok http 8000');
      diagnostics.push('- Dashboard: http://127.0.0.1:4040');
      diagnostics.push('- Status: curl [ngrok-url]/up');
    } else {
      diagnostics.push('ℹ️ Not using ngrok (using local IP)');
      diagnostics.push(`📡 Current URL: ${environment.apiUrl}`);
      diagnostics.push('');
      diagnostics.push('🔧 TROUBLESHOOTING STEPS:');
      diagnostics.push('1. Check if both devices are on same WiFi');
      diagnostics.push('2. Verify Windows Firewall allows port 8000');
      diagnostics.push('3. Make sure Laravel backend is running');
      diagnostics.push('4. Try switching to ngrok for easier setup');
    }
    
    return diagnostics;
  }

  /**
   * Test the current connection
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const healthUrl = environment.apiUrl.replace('/api', '/up');
      const startTime = Date.now();
      
      const response = await this.http.get(healthUrl, { 
        timeout: 10000,
        responseType: 'text'
      }).toPromise();
      
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        message: `✅ Connection successful (${responseTime}ms)`,
        details: {
          url: environment.apiUrl,
          responseTime,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error: any) {
      return {
        success: false,
        message: `❌ Connection failed: ${error.message}`,
        details: {
          url: environment.apiUrl,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}
