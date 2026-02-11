import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { storage } from '../storage';

/**
 * If the API tells us the token is invalid/expired (401),
 * clear local storage and send the user to /login.
 *
 * NOTE: 403 means "forbidden" (permissions) and MUST NOT log the user out.
 */
export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        storage.clear();
        // Avoid infinite navigation loops if we are already on /login
        if (!router.url.startsWith('/login')) {
          router.navigateByUrl('/login');
        }
      }
      return throwError(() => err);
    })
  );
};
