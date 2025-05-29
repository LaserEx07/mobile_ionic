import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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
  private apiUrl = `${environment.apiUrl}/mobile-users`;

  constructor(private http: HttpClient) {}

  saveUserData(data: UserData): Observable<any> {
    return this.http.post(this.apiUrl, data);
  }

  createUser(userData: any): Observable<any> {
    return this.http.post(this.apiUrl, userData);
  }
}
