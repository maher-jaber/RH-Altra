import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth.service';

/**
 * HR guard: allow ROLE_HR or ROLE_ADMIN.
 * If HR role is not used in an instance, Admin will still access the pages.
 */
export const hrGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const me = auth.me();

  if (me && (me.roles?.includes('ROLE_ADMIN') || (me.roles as any)?.includes('ROLE_HR'))) {
    return true;
  }
  return router.parseUrl('/dashboard');
};
