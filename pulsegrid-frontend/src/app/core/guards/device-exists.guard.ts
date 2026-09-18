import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

// Functional route guard (v22 style): a plain function returning boolean |
// UrlTree, provided directly in the route config — no class, no NgModule.
export const deviceExistsGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const id = route.paramMap.get('id');

  if (!id || !/^device\d+$/.test(id)) {
    return router.createUrlTree(['/dashboard']);
  }
  return true;
};
