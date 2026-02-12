import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { animate, group, query, style, transition, trigger } from '@angular/animations';

import { AlertService } from '../../core/ui/alert.service';

import { AuthService } from '../../core/auth.service';
import { NotificationService } from '../../core/api/notification.service';
import { NotificationStoreService } from '../../core/api/notification-store.service';
import { NotificationItem } from '../../core/models';

@Component({
  standalone: true,
  selector: 'app-shell',
  imports: [
    CommonModule, RouterOutlet, RouterLink, RouterLinkActive,
  ],
  animations: [
    trigger('routeFade', [
      transition('* <=> *', [
        // Use absolute (not fixed) to avoid covering the whole UI and hiding content.
        query(':enter, :leave', [style({ position: 'absolute', inset: '0 0 auto 0', width: '100%' })], { optional: true }),
        group([
          query(':leave', [
            animate('180ms cubic-bezier(.2,.8,.2,1)', style({ opacity: 0, transform: 'translateY(8px) scale(.99)' }))
          ], { optional: true }),
          query(':enter', [
            style({ opacity: 0, transform: 'translateY(10px) scale(.99)' }),
            animate('240ms cubic-bezier(.2,.8,.2,1)', style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
          ], { optional: true }),
        ])
      ])
    ])
  ],
  styles: [`
    :host { display:block; }

    .app-container {
      height: 100vh;
      /* Background is managed globally in styles.css for consistent readability */
      background: transparent;
    }

    .sidebar {
      width: 290px;
      background: linear-gradient(180deg, var(--surface), var(--surface-2));
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border-right: 1px solid var(--stroke);
    }

    .brandbar {
      display:flex;
      align-items:center;
      gap: 12px;
      padding: 14px 16px;
      height: 68px;
      box-sizing: border-box;
    }

    .logo {
      width: 40px;
      height: 40px;
      border-radius: 14px;
      display:grid;
      place-items:center;
      color: rgba(255,255,255,0.92);
      background: linear-gradient(135deg, rgba(37,99,235,.65), rgba(124,58,237,.55));
      box-shadow: 0 14px 35px rgba(0,0,0,.35);
      transform: translateZ(0);
      transition: transform var(--dur-2) var(--ease), filter var(--dur-2) var(--ease);
    }
    .logo:hover { transform: translateY(-1px) scale(1.02); filter: brightness(1.08); }

    .brand { font-weight: 800; letter-spacing: .3px; line-height: 1.05; color: var(--text); }
    .brand-sub { font-size: 12px; color: var(--text-2); margin-top: 3px; }

    .nav-section { padding: 8px 10px 12px; }
    .nav-title { font-size: 11px; font-weight: 800; letter-spacing: .6px; text-transform: uppercase; color: var(--text-2); padding: 12px 12px 8px; }

    .navlink {
      position: relative;
      display:flex;
      align-items:center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 14px;
      margin: 4px 6px;
      color: var(--text);
      transition: transform var(--dur-2) var(--ease), background var(--dur-2) var(--ease), border var(--dur-2) var(--ease);
    }
    .navlink:hover { transform: translateY(-1px); background: rgba(29,78,216,0.08); }
    .navlink.active {
      background: linear-gradient(90deg, rgba(37,99,235,.28), rgba(124,58,237,.18));
      border: 1px solid var(--stroke);
    }
    .navlink.active::before {
      content: '';
      position: absolute;
      inset: 10px auto 10px 10px;
      width: 3px;
      border-radius: 99px;
      background: linear-gradient(180deg, rgba(6,182,212,.95), rgba(37,99,235,.95));
      box-shadow: 0 0 0 6px rgba(6,182,212,.10);
    }

    .icon-btn {
      width: 40px; height: 40px;
      border-radius: 999px;
      display:inline-grid;
      place-items:center;
      border: 1px solid var(--stroke);
      background: var(--surface-2);
      color: var(--text);
      transition: transform var(--dur-2) var(--ease), background var(--dur-2) var(--ease);
    }
    .icon-btn:hover { transform: translateY(-1px); background: var(--surface); }

    .topbar {
      position: sticky;
      top: 0;
      z-index: 1050;
      background: linear-gradient(180deg, var(--surface), var(--surface-2));
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--stroke);
    }

    .dropdown-menu { z-index: 1060; }

    .content { padding: 18px; }

    .route-host {
      position: relative;
      min-height: calc(100vh - 68px - 36px);
    }
    .spacer { flex: 1 1 auto; }

    .pill {
      display:inline-flex;
      align-items:center;
      gap: 10px;
      padding: 6px 10px;
      border-radius: 999px;
      background: var(--surface);
      border: 1px solid var(--stroke);
      color: var(--text);
      cursor: pointer;
    }

    .avatar {
      width: 34px; height: 34px; border-radius: 999px;
      background: linear-gradient(135deg, rgba(6,182,212,.35), rgba(37,99,235,.35));
      border: 1px solid var(--stroke);
      display:grid; place-items:center;
      font-weight: 800; font-size: 12px;
      color: var(--text);
    }

    .user-meta { display:flex; flex-direction: column; line-height: 1.05; }
    .user-name { font-size: 13px; font-weight: 800; color: var(--text); }
    .user-role { font-size: 11px; color: var(--text-2); }

    .title {
      display:flex;
      align-items:center;
      gap: 10px;
      font-weight: 800;
      letter-spacing: .2px;
      color: var(--text);
    }

    .title .crumb { opacity: .65; font-weight: 700; }
    .title .sep { opacity: .35; }

    .route-host { animation: fadeUp var(--dur-3) var(--ease) both; }

    @media (max-width: 980px) {
      .sidebar { width: 86px; }
      .brand-text { display:none; }
      .nav-title { display:none; }
      .user-meta { display:none; }
      .navlink span.label { display:none; }
      .navlink.active::before { left: 6px; }
    }
  `],
  template: `
  <div class="app-container d-flex">
    <aside class="sidebar">
      <div class="brandbar">
        <div class="logo"><i class="bi bi-building"></i></div>
        <div class="brand-text">
          <div class="brand">ALTRACALL HRMS</div>
          <div class="brand-sub">Portail RH interne</div>
        </div>
      </div>
      <hr class="border-opacity-25 my-0" style="border-color: rgba(255,255,255,.18)">

      <div class="nav-section">
        <div class="nav-title">Général</div>
        <a class="navlink" routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">
          <i class="bi bi-speedometer2"></i>
          <span class="label">Tableau de bord</span>
        </a>
        <!-- Notifications: only keep the bell icon in the top navbar (less clutter) -->

        <div class="nav-title" style="margin-top:10px">RH</div>
        <a class="navlink" routerLink="/leaves" routerLinkActive="active">
          <i class="bi bi-umbrella-beach"></i>
          <span class="label">Congés</span>
        </a>
        <a class="navlink" routerLink="/advances" routerLinkActive="active">
          <i class="bi bi-cash-coin"></i>
          <span class="label">Avances / acompte</span>
        </a>
        <a class="navlink" routerLink="/exit-permissions" routerLinkActive="active">
          <i class="bi bi-person-walking"></i>
          <span class="label">Autorisations de sortie</span>
        </a>
        <a class="navlink" routerLink="/daily-reports" routerLinkActive="active">
          <i class="bi bi-clipboard-check"></i>
          <span class="label">Compte-rendu journalier</span>
        </a>

        <div *ngIf="auth.hasRole('ROLE_ADMIN')">
          <div class="nav-title" style="margin-top:10px">Administration</div>
          <a class="navlink" routerLink="/admin/users" routerLinkActive="active">
            <i class="bi bi-shield-lock"></i>
            <span class="label">Utilisateurs</span>
          </a>
          <a class="navlink" routerLink="/admin/departments" routerLinkActive="active">
            <i class="bi bi-building-gear"></i>
            <span class="label">Départements</span>
          </a>
        </div>
      </div>
    </aside>

    <div class="flex-grow-1 d-flex flex-column" style="min-width: 0;">
      <div class="topbar">
        <div class="d-flex align-items-center px-3" style="height: 68px;">
          <div class="title">
            <span class="crumb">ALTRACALL</span>
            <span class="sep">/</span>
            <span>{{pageTitle()}}</span>
          </div>
          <div class="spacer"></div>

          <a class="icon-btn me-2 position-relative" routerLink="/notifications" title="Notifications">
            <i class="bi bi-bell"></i>
            <span *ngIf="unreadCount()" class="position-absolute top-0 start-100 translate-middle badge rounded-pill text-bg-danger" style="font-size: 10px;">{{unreadCount()}}</span>
          </a>

          <button class="icon-btn me-2" type="button" (click)="toggleUiMode()" [title]="uiMode() === 'dark' ? 'Mode clair' : 'Mode sombre'">
            <i class="bi" [ngClass]="uiMode() === 'dark' ? 'bi-sun' : 'bi-moon'"></i>
          </button>

          <div class="dropdown" *ngIf="auth.me() as me">
            <button class="pill dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
              <span class="avatar">{{initials()}}</span>
              <span class="user-meta">
                <span class="user-name">{{me.fullName}}</span>
                <span class="user-role">{{roleLabel()}}</span>
              </span>
            </button>
            <ul class="dropdown-menu dropdown-menu-end" style="min-width: 220px;">
              <li><a class="dropdown-item" routerLink="/profile"><i class="bi bi-person me-2"></i>Profil</a></li>
              <li *ngIf="isAdmin()"><a class="dropdown-item" routerLink="/settings"><i class="bi bi-gear me-2"></i>Paramètres</a></li>
              <li><hr class="dropdown-divider"></li>
              <li><button class="dropdown-item" type="button" (click)="logout()"><i class="bi bi-box-arrow-right me-2"></i>Déconnexion</button></li>
            </ul>
          </div>
        </div>
      </div>

      <div class="content">
        <div class="route-host" [@routeFade]="routeAnimKey()">
          <router-outlet></router-outlet>
        </div>
      </div>
    </div>
  </div>
  `
})
export class ShellComponent implements OnInit, OnDestroy {
  unreadCount = this.notifStore.unreadCount;
  pageTitle = signal<string>('Tableau de bord');
  // Initialize with a stable value to avoid NG0100 on first render.
  routeAnimKey = signal<string>('dashboard');
  // Light-first for maximum readability (users reported content not visible with dark tokens).
  uiMode = signal<'dark' | 'light'>('light');
  private stopSse: (() => void) | null = null;

  constructor(
    public auth: AuthService,
    private notif: NotificationService,
    public notifStore: NotificationStoreService,
    private alert: AlertService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Set the initial animation key synchronously (prevents ExpressionChangedAfterItHasBeenCheckedError)
    // because the first navigation can happen in the same change-detection tick.
    this.routeAnimKey.set((this.router.url || '').replace(/^\//, '') || 'dashboard');
    // UI mode (dark/light) — stored locally
    const saved = (localStorage.getItem('hrms-ui-mode') || 'light') as 'dark' | 'light';
    this.uiMode.set(saved);
    this.applyUiMode();

    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      // Prefer route title (Routes.title), fallback to URL heuristics.
      const t = this.deepestTitle();
      if (t) this.pageTitle.set(t);
      else {
        const url = this.router.url;
        if (url.startsWith('/notifications')) this.pageTitle.set('Notifications');
        else this.pageTitle.set('Tableau de bord');
      }

      // Update route animation key synchronously. Initial value is already set above.
      const urlKey = (this.router.url || '').replace(/^\//, '') || 'dashboard';
      this.routeAnimKey.set(urlKey);
    });
    // Notifications (unread badge is derived from backend read/unread state)
    this.notifStore.start();

    // Toast for live notifications
    this.stopSse = this.notif.subscribeMercure((n: NotificationItem) => {
      this.alert.toast({ icon: 'info', title: n.title, text: n.body });
    });
     
  }

  ngOnDestroy(): void {
    if (this.stopSse) this.stopSse();
    this.notifStore.stop();
  }

  // NOTE: routeKey(outlet) removed to avoid NG04012 + NG0100 issues.

  toggleUiMode(): void {
    const next = this.uiMode() === 'dark' ? 'light' : 'dark';
    this.uiMode.set(next);
    localStorage.setItem('hrms-ui-mode', next);
    this.applyUiMode();
  }

  private applyUiMode(): void {
    // Tokens are handled in global CSS using [data-ui-mode].
    document.documentElement.setAttribute('data-ui-mode', this.uiMode());
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  initials = computed(() => {
    const me = this.auth.me();
    const name = (me?.fullName || me?.email || '').trim();
    if (!name) return 'U';
    const parts = name.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] || 'U';
    const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] || '') : '';
    return (a + b).toUpperCase();
  });

  isAdmin(): boolean { return (this.auth.me()?.roles || []).includes('ROLE_ADMIN'); }

  roleLabel = computed(() => {
    const roles = this.auth.me()?.roles || [];
    if (roles.includes('ROLE_ADMIN')) return 'Administrateur';
    if (roles.includes('ROLE_SUPERIOR')) return 'Manager';
    return 'Employé';
  });

  private deepestTitle(): string | null {
    let r: ActivatedRoute | null = this.route;
    while (r?.firstChild) r = r.firstChild;
    const title = r?.snapshot?.title;
    return typeof title === 'string' && title.trim() ? title : null;
  }
}
