import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiConfigService {
  
  constructor() {}

  /**
   * Get the base API URL from environment
   */
  getApiUrl(): string {
    return environment.apiUrl;
  }

  /**
   * Get the health check URL
   */
  getHealthCheckUrl(): string {
    return environment.healthCheckUrl || environment.apiUrl.replace('/api', '/up');
  }

  /**
   * Get a full API endpoint URL
   */
  getEndpoint(path: string): string {
    const baseUrl = this.getApiUrl();
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${baseUrl}/${cleanPath}`;
  }

  /**
   * Get auth endpoints
   */
  getAuthEndpoint(path: string = ''): string {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return this.getEndpoint(`auth/${cleanPath}`);
  }
}
