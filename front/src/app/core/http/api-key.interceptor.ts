import { HttpInterceptorFn } from '@angular/common/http';
import { storage } from '../storage';

export const apiKeyInterceptor: HttpInterceptorFn = (req, next) => {
  const apiKey = storage.getApiKey();
  if (!apiKey) return next(req);

  const cloned = req.clone({
    setHeaders: {
      'X-API-KEY': apiKey
    }
  });
  return next(cloned);
};
