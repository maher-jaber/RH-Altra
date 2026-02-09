import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { storage } from '../storage';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const key = storage.getApiKey();
  if (!key) {
    router.navigateByUrl('/login');
    return false;
  }
  return true;
};
