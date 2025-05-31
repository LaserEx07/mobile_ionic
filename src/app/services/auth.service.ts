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

  register(data: { full_name: string, email: string, password: string, password_confirmation?: string }): Observable<any> {
    console.log('📝 Making registration request to:', `${this.apiUrl}/auth/signup`);
    console.log('👤 Registration data:', { ...data, password: '***', password_confirmation: '***' });

    return this.http.post(`${this.apiUrl}/auth/signup`, data, {
      headers: this.getHeaders()
    });
  }

  setToken(token: string) {
    // Store token consistently as 'token' to match what's used in authGuard
    localStorage.setItem('token', token);
    console.log('🔑 Token stored successfully');
  }
}