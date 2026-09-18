import { HttpInterceptorFn } from '@angular/common/http';

// Functional interceptor (v22): a plain function, not a class implementing
// HttpInterceptor. Registered via provideHttpClient(withInterceptors([...])).
export const requestIdInterceptor: HttpInterceptorFn = (req, next) => {
  const cloned = req.clone({
    setHeaders: { 'X-Request-Id': crypto.randomUUID() },
  });
  return next(cloned);
};

export const timingInterceptor: HttpInterceptorFn = (req, next) => {
  const started = performance.now();
  return next(req);
  // Attach a tap() here if you want to log durations — kept minimal on purpose.
};
