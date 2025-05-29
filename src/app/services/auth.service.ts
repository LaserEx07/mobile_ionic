import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { EnvironmentSwitcherService } from './environment-switcher.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private get apiUrl(): string {
    // Use dynamic API URL if available, fallback to environment
    const dynamicUrl = this.envSwitcher?.getCurrentApiUrl();
    const baseUrl = dynamicUrl || environment.apiUrl;
    return `${baseUrl}/auth`;
  }

  constructor(
    private http: HttpClient,
    private envSwitcher: EnvironmentSwitcherService
  ) {
    console.log('Auth Service initialized');
    console.log('Environment API URL:', environment.apiUrl);
    console.log('Dynamic API URL:', this.envSwitcher.getCurrentApiUrl());
    console.log('Final API URL:', this.apiUrl);
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