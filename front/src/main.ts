import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import 'zone.js';
import { AppComponent } from './app/app.component';
import { APP_ROUTES } from './app/app.routes';
import { authTokenInterceptor } from './app/core/http/api-key.interceptor';
import { authErrorInterceptor } from './app/core/http/auth-error.interceptor';
import { loadingInterceptor } from './app/core/http/loading.interceptor';

bootstrapApplication(AppComponent, {
  providers: [
    provideAnimations(),
    provideHttpClient(withInterceptors([authTokenInterceptor, authErrorInterceptor, loadingInterceptor])),
    provideRouter(APP_ROUTES),
  ],
}).catch(err => console.error(err));
