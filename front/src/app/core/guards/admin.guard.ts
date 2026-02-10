import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const me = auth.me();
  if (me && me.roles?.includes('ROLE_ADMIN')) return true;
  return router.parseUrl('/dashboard');
};
