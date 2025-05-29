import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { ErrorHandlerService } from './error-handler.service';

@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {

  constructor(private errorHandlerService: ErrorHandlerService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request)
      .pipe(
        // Retry the request once before giving up
        retry(1),
        catchError((error: HttpErrorResponse) => {
          console.log('HTTP Error Interceptor caught an error:', error);
          
          // Use our error handler service to handle the error
          return this.errorHandlerService.handleError(error);
        })
      );
  }
}
