import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class MobileUserService {
  private apiUrl = `${environment.apiUrl.replace(/\/api\/?$/, '')}/api/mobile-users`;

  constructor(private http: HttpClient) {}

  createUser(data: any): Observable<any> {
    return this.http.post(this.apiUrl, data);
  }

}