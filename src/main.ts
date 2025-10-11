import { enableProdMode, importProvidersFrom } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules, withHashLocation } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { IonicModule } from '@ionic/angular';
import { provideHttpClient, withInterceptorsFromDi, HTTP_INTERCEPTORS } from '@angular/common/http';
import { IonicStorageModule } from '@ionic/storage-angular';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { environment } from './environments/environment';
import { registerIcons } from './app/icons';
import { ErrorHandlerService } from './app/services/error-handler.service';
import { HttpErrorInterceptor } from './app/services/http-error.interceptor';
import { AuthTokenInterceptor } from './app/services/auth-token.interceptor';
import { NotificationBannerService } from './app/services/notification-banner.service';
import { ErrorHandler } from '@angular/core';

// Register Ionic icons
registerIcons();

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: ErrorHandler, useClass: ErrorHandlerService },
    { provide: HTTP_INTERCEPTORS, useClass: AuthTokenInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: HttpErrorInterceptor, multi: true },
    NotificationBannerService,
    provideIonicAngular({}),
    importProvidersFrom(IonicModule.forRoot()),
    importProvidersFrom(IonicStorageModule.forRoot()),
    provideRouter(routes, withHashLocation(), withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptorsFromDi()),
  ],
}).catch(err => console.log(err));
