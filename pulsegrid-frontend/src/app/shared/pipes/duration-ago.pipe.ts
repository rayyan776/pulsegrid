import { Pipe, PipeTransform } from '@angular/core';

// Impure pipe (pure: false): must recompute every change-detection run
// because "seconds ago" changes with the clock, not with its input
// reference. Use sparingly — this is the pipe type that costs the most
// under zoneless + OnPush, since nothing marks it dirty automatically;
// pair it with an interval-driven signal in the parent if you need it live.
@Pipe({ name: 'agoFrom', standalone: true, pure: false })
export class AgoFromPipe implements PipeTransform {
  transform(epochMs: number | undefined): string {
    if (!epochMs) return '—';
    const seconds = Math.max(0, Math.floor((Date.now() - epochMs) / 1000));
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  }
}
