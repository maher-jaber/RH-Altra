import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { LoadingService } from '../ui/loading.service';

// Global spinner for every HTTP call.
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loader = inject(LoadingService);
  loader.begin();
  return next(req).pipe(finalize(() => loader.end()));
};
