import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private get apiUrl(): string {
    return this.apiConfig.getApiUrl();
  }

  constructor(
    private http: HttpClient,
    private apiConfig: ApiConfigService
  ) {
    console.log('Auth Service initialized');
    console.log('API URL:', this.apiUrl);
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    });
  }

  login(credentials: { email: string, password: string }): Observable<any> {
    console.log('🔐 Making login request to:', `${this.apiUrl}/auth/login`);
    console.log('📧 Credentials:', { email: credentials.email, password: '***' });

    return this.http.post(`${this.apiUrl}/auth/login`, credentials, {
      headers: this.getHeaders()
    });
  }

  register(data: { email: string, password: string, password_confirmation?: string }): Observable<any> {
    console.log('📝 Making registration request to:', `${this.apiUrl}/auth/signup`);
    console.log('👤 Registration data:', { ...data, password: '***', password_confirmation: '***' });

    return this.http.post(`${this.apiUrl}/auth/signup`, data, {
      headers: this.getHeaders()
    });
  }

  setToken(token: string) {
    localStorage.setItem('token', token);
    console.log('🔑 Token stored successfully');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  logout() {
    // Clear all authentication and user data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('offline_credentials');

    // Note: We keep onboardingComplete so user doesn't have to go through onboarding again
    console.log('🚪 Auth service - User logged out');
  }
}