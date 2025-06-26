import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';

interface UserData {
  full_name: string;
  mobile_number: string;
  age: number;
  gender: string;
  address: string;
}

@Injectable({
  providedIn: 'root'
})
export class MobileUserService {
  private get apiUrl(): string {
    return this.apiConfig.getEndpoint('mobile-users');
  }

  constructor(
    private http: HttpClient,
    private apiConfig: ApiConfigService
  ) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    const headers: any = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return new HttpHeaders(headers);
  }

  saveUserData(data: UserData): Observable<any> {
    return this.http.post(this.apiUrl, data, {
      headers: this.getHeaders()
    });
  }

  createUser(userData: any): Observable<any> {
    return this.http.post(this.apiUrl, userData, {
      headers: this.getHeaders()
    });
  }
}
