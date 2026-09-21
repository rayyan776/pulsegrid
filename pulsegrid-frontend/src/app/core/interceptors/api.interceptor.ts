import { HttpInterceptorFn } from '@angular/common/http';
import { finalize } from 'rxjs';

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
  // finalize() (not tap()) runs on success, error, AND unsubscription — a
  // tap-only version would silently skip logging any request that errors.
  return next(req).pipe(
    finalize(() => {
      const durationMs = Math.round(performance.now() - started);
      console.debug(`[HTTP] ${req.method} ${req.urlWithParams} — ${durationMs}ms`);
    }),
  );
};
