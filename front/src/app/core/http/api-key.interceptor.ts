import { HttpInterceptorFn } from '@angular/common/http';
import { storage } from '../storage';

export const apiKeyInterceptor: HttpInterceptorFn = (req, next) => {
  const token = storage.getToken();
  if (!token) return next(req);

  const cloned = req.clone({
    setHeaders: {
      'X-API-KEY': token
    }
  });
  return next(cloned);
};
