import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth.service';

/**
 * Adds Authorization: Bearer <token> to API requests.
 * Token is stored after login. We do not expose an "API key" concept in the UI.
 */
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token;
  if (!token) return next(req);

  // Only attach to API calls
  if (!req.url.includes('/api/')) return next(req);

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
