import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SocketService } from '../../core/services/socket.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'pg-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">
      <header class="topbar glass">
        <div class="brand">
          <span class="brand-mark"><span class="brand-mark-dot"></span></span>
          <h1>Pulse<span>Grid</span></h1>
        </div>

        <nav class="nav-pills">
          <a routerLink="/custom-dashboard" routerLinkActive="active">
            <svg viewBox="0 0 20 20" width="15" height="15" fill="none"><rect x="2.5" y="2.5" width="6" height="6" rx="1.4" stroke="currentColor" stroke-width="1.6"/><rect x="11.5" y="2.5" width="6" height="6" rx="1.4" stroke="currentColor" stroke-width="1.6"/><rect x="2.5" y="11.5" width="6" height="6" rx="1.4" stroke="currentColor" stroke-width="1.6"/><rect x="11.5" y="11.5" width="6" height="6" rx="1.4" stroke="currentColor" stroke-width="1.6"/></svg>
            Dashboard
          </a>
          <a routerLink="/settings" routerLinkActive="active">
            <svg viewBox="0 0 20 20" width="15" height="15" fill="none"><path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="currentColor" stroke-width="1.6"/><path d="M16.2 12.3c.1-.3.1-.6 0-.9l1-1.6-1.4-1.4-1.6 1c-.3-.1-.6-.2-.9-.3l-.4-1.8h-2l-.4 1.8c-.3.1-.6.2-.9.3l-1.6-1L6.6 9.8l1 1.6c-.1.3-.1.6 0 .9l-1 1.6 1.4 1.4 1.6-1c.3.1.6.2.9.3l.4 1.8h2l.4-1.8c.3-.1.6-.2.9-.3l1.6 1 1.4-1.4-1-1.6Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
            Settings
          </a>
        </nav>

        <div class="right-cluster">
          <button class="theme-toggle" (click)="theme.toggle()"
            [attr.aria-label]="theme.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
            [attr.aria-pressed]="theme.theme() === 'dark'"
            title="Toggle light / dark mode">
            @if (theme.theme() === 'dark') {
              <svg viewBox="0 0 20 20" width="15" height="15" fill="none"><circle cx="10" cy="10" r="4" stroke="currentColor" stroke-width="1.6"/><path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            } @else {
              <svg viewBox="0 0 20 20" width="15" height="15" fill="none"><path d="M17 11.5A7 7 0 1 1 8.5 3a5.5 5.5 0 0 0 8.5 8.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
            }
          </button>

          <div class="conn" [class.up]="socket.connected()">
            <span class="pulse"></span>
            {{ socket.connected() ? 'Live' : 'Disconnected' }}
          </div>
          <div class="avatar">PG</div>
        </div>
      </header>

      <main><router-outlet /></main>
    </div>
  `,
  styles: [`
    .shell { min-height: 100vh; display: flex; flex-direction: column; }

    .topbar {
      position: sticky; top: 0; z-index: 40;
      display: flex; align-items: center; gap: var(--space-6);
      padding: 12px var(--space-6);
      border-left: none; border-top: none; border-right: none;
      border-radius: 0;
      background: var(--topbar-bg);
    }

    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-mark {
      width: 30px; height: 30px; border-radius: 9px;
      background: var(--accent-grad);
      display: flex; align-items: center; justify-content: center;
      box-shadow: var(--shadow-glow);
    }
    .brand-mark-dot { width: 8px; height: 8px; border-radius: 50%; background: #fff; opacity: 0.9; }
    h1 { font-size: 17px; font-weight: 700; margin: 0; letter-spacing: -0.02em; }
    h1 span { color: var(--accent-3); }

    .nav-pills { display: flex; gap: 4px; background: var(--surface); border: 1px solid var(--border);
      border-radius: 999px; padding: 4px; margin-left: var(--space-4); }
    .nav-pills a {
      display: flex; align-items: center; gap: 7px;
      color: var(--text-muted); text-decoration: none;
      padding: 7px 15px; border-radius: 999px; font-size: 13px; font-weight: 500;
      transition: background 0.18s var(--ease), color 0.18s var(--ease);
    }
    .nav-pills a:hover { color: var(--text); }
    .nav-pills a.active { background: var(--accent-grad); color: #fff; box-shadow: var(--shadow-glow); }

    .right-cluster { margin-left: auto; display: flex; align-items: center; gap: var(--space-4); }

    .conn { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 500;
      color: var(--text-muted); background: var(--surface); border: 1px solid var(--border);
      padding: 6px 12px; border-radius: 999px; }
    .pulse { width: 7px; height: 7px; border-radius: 50%; background: var(--text-dim); }
    .conn.up { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 35%, transparent); }
    .conn.up .pulse { background: var(--ok); box-shadow: 0 0 8px var(--ok); animation: pulse 1.8s ease-in-out infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

    .avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--surface-raised);
      border: 1px solid var(--border); display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; color: var(--text-muted); }

    .theme-toggle { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px;
      background: var(--surface); border: 1px solid var(--border); border-radius: 50%;
      color: var(--text-muted); cursor: pointer; transition: color 0.18s ease, border-color 0.18s ease, transform 0.18s var(--ease); }
    .theme-toggle:hover { color: var(--accent); border-color: var(--border-hover); transform: rotate(12deg); }

    main { flex: 1; padding: var(--space-5) var(--space-6) var(--space-6); max-width: 1400px; width: 100%;
      margin: 0 auto; }

    @media (max-width: 720px) {
      .topbar { flex-wrap: wrap; gap: var(--space-3); }
      .nav-pills { margin-left: 0; order: 3; width: 100%; }
    }
  `],
})
export class ShellComponent {
  protected readonly socket = inject(SocketService);
  protected readonly theme = inject(ThemeService);
  constructor() { this.socket.connect(); }
}
