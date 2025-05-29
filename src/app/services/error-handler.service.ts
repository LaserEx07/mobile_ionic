import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { AlertController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService {

  constructor(private alertCtrl: AlertController) { }

  /**
   * Handle HTTP errors globally
   * @param error The error to handle
   * @returns An observable with the error
   */
  public handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
      console.error('Client-side error:', error.error.message);
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      console.error(
        `Server-side error: Status: ${error.status}, ` +
        `Body: ${JSON.stringify(error.error)}`
      );
    }

    // Log the error
    console.error('HTTP error:', error);

    // Show an alert for critical errors - DISABLED FOR OFFLINE MODE
    // Network errors are now handled by the offline banner component
    // if (error.status === 0) {
    //   this.showErrorAlert('Network Error',
    //     'Could not connect to the server. Please check:\n' +
    //     '• Your WiFi connection\n' +
    //     '• Both devices are on the same network\n' +
    //     '• Backend server is running\n' +
    //     '• Windows Firewall settings\n\n' +
    //     'Server: http://192.168.112.244:8000/api');
    // } else if (error.status >= 500) {
    //   this.showErrorAlert('Server Error', 'The server encountered an error. Please try again later.');
    // }

    // Return the error for further handling
    return throwError(() => error);
  }

  /**
   * Show an error alert
   * @param header The alert header
   * @param message The alert message
   */
  public async showErrorAlert(header: string, message: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });

    await alert.present();
  }

  /**
   * Handle general application errors
   * @param error The error to handle
   * @param component The component where the error occurred
   */
  public handleAppError(error: any, component?: string): void {
    const componentName = component || 'Unknown component';
    console.error(`Error in ${componentName}:`, error);

    // Show a user-friendly message for critical errors
    if (error && error.isCritical) {
      this.showErrorAlert('Application Error', 'An unexpected error occurred. Please restart the application.');
    }
  }
}
