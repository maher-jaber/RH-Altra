import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { storage } from '../storage';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = storage.getToken();
  if (!token) {
    router.navigateByUrl('/login');
    return false;
  }
  return true;
};
