import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MobileUserService {
  private apiUrl = 'http://192.168.112.244:8000/api/mobile-users';

  constructor(private http: HttpClient) {}

  createUser(data: any): Observable<any> {
    return this.http.post(this.apiUrl, data);
  }

}