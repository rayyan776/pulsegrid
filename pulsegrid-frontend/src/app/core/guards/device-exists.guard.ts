import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DEVICE_IDS } from '../constants/device-ids';

// Functional route guard (v22 style): a plain function returning boolean |
// UrlTree, provided directly in the route config — no class, no NgModule.
//
// Checks membership in the known fleet rather than just the /^device\d+$/
// shape — the old regex let device999 (or any other well-formed but
// nonexistent id) through to a device-detail page with nothing to show.
export const deviceExistsGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const id = route.paramMap.get('id');

  if (!id || !(DEVICE_IDS as readonly string[]).includes(id)) {
    return router.createUrlTree(['/dashboard']);
  }
  return true;
};
