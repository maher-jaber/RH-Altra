import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { animate, group, query, style, transition, trigger } from '@angular/animations';

import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AlertService } from '../../core/ui/alert.service';
import { AuthService } from '../../core/auth.service';
import { NotificationService } from '../../core/api/notification.service';
import { NotificationStoreService } from '../../core/api/notification-store.service';
import { NotificationItem } from '../../core/models';

@Component({
  standalone: true,
  selector: 'app-shell',
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatButtonModule,
    MatMenuModule,
    MatBadgeModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  animations: [
    trigger('routeFade', [
      transition('* <=> *', [
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
      background: transparent;
    }

    .brand {
      font-weight: 900;
      letter-spacing: .2px;
      color: var(--text);
      line-height: 1.1;
    }
    .brand-sub {
      font-size: 12px;
      color: var(--text-2);
      margin-top: 3px;
    }

    .sidenav {
      width: 296px;
      border-right: 1px solid var(--stroke);
      background: linear-gradient(180deg, var(--surface), var(--surface-2));
      backdrop-filter: blur(14px);
    }

    .sidenav-inner { padding: 12px; }

    .brandbar {
      display:flex;
      align-items:center;
      gap: 12px;
      padding: 8px 10px 14px;
    }

    .logo {
      width: 42px;
      height: 42px;
      border-radius: 16px;
      display:grid;
      place-items:center;
      color: rgba(255,255,255,0.92);
      background: linear-gradient(135deg, rgba(37,99,235,.85), rgba(124,58,237,.75));
      box-shadow: 0 14px 35px rgba(0,0,0,.22);
    }

    .section-title {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .6px;
      text-transform: uppercase;
      color: var(--text-2);
      padding: 12px 12px 6px;
    }

    a.mat-mdc-list-item {
      border-radius: 14px;
      margin: 3px 0;
      --mdc-list-list-item-one-line-container-height: 44px;
    }

    a.mat-mdc-list-item.active {
      background: linear-gradient(90deg, rgba(37,99,235,.20), rgba(124,58,237,.12));
      border: 1px solid var(--stroke);
    }

    .item-icon {
      width: 34px;
      height: 34px;
      border-radius: 12px;
      display:grid;
      place-items:center;
      border: 1px solid var(--stroke);
      background: var(--surface);
      color: var(--text);
    }

    .topbar {
      position: sticky;
      top: 0;
      z-index: 1000;
      border-bottom: 1px solid var(--stroke);
      background: linear-gradient(180deg, var(--surface), var(--surface-2));
      backdrop-filter: blur(14px);
    }

    .toolbar {
      height: 68px;
      padding: 0 16px;
    }

    .title {
      display:flex;
      align-items:center;
      gap: 10px;
      font-weight: 900;
      letter-spacing: .2px;
      color: var(--text);
    }

    .title .crumb { opacity: .65; font-weight: 800; }
    .title .sep { opacity: .35; }

    .spacer { flex: 1 1 auto; }

    .icon-btn {
      width: 42px;
      height: 42px;
      border-radius: 999px;
      border: 1px solid var(--stroke);
      background: var(--surface);
      display:grid;
      place-items:center;
    }

    .pill {
      display:inline-flex;
      align-items:center;
      gap: 10px;
      padding: 6px 10px;
      border-radius: 999px;
      background: var(--surface);
      border: 1px solid var(--stroke);
      color: var(--text);
    }

    .avatar {
      width: 34px; height: 34px; border-radius: 999px;
      background: linear-gradient(135deg, rgba(6,182,212,.35), rgba(37,99,235,.35));
      border: 1px solid var(--stroke);
      display:grid; place-items:center;
      font-weight: 900; font-size: 12px;
      color: var(--text);
    }

    .user-meta { display:flex; flex-direction: column; line-height: 1.05; }
    .user-name { font-size: 13px; font-weight: 900; color: var(--text); }
    .user-role { font-size: 11px; color: var(--text-2); }

    .content {
      padding: 18px;
    }

    .route-host {
      position: relative;
      min-height: calc(100vh - 68px - 36px);
      animation: fadeUp var(--dur-3) var(--ease) both;
    }

    @media (max-width: 980px) {
      .sidenav { width: 84px; }
      .brand-text { display:none; }
      .section-title { display:none; }
      .label { display:none; }
    }
  `],
  template: `
  <mat-sidenav-container class="app-container">
    <mat-sidenav mode="side" opened class="sidenav">
      <div class="sidenav-inner">
        <div class="brandbar">
          <div class="logo"><i class="bi bi-building"></i></div>
          <div class="brand-text">
            <div class="brand">ALTRACALL HRMS</div>
            <div class="brand-sub">Portail RH interne</div>
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="section-title">Général</div>
        <mat-nav-list>
          <a mat-list-item routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">
            <span class="item-icon"><i class="bi bi-speedometer2"></i></span>
            <span class="label">Tableau de bord</span>
          </a>
        </mat-nav-list>

        <div class="section-title" style="margin-top:6px">RH</div>
        <mat-nav-list>
          <a mat-list-item routerLink="/leaves" routerLinkActive="active">
            <span class="item-icon"><i class="bi bi-umbrella-beach"></i></span>
            <span class="label">Congés</span>
          </a>
          <a mat-list-item routerLink="/advances" routerLinkActive="active">
            <span class="item-icon"><i class="bi bi-cash-coin"></i></span>
            <span class="label">Avances / acompte</span>
          </a>
          <a mat-list-item routerLink="/exit-permissions" routerLinkActive="active">
            <span class="item-icon"><i class="bi bi-person-walking"></i></span>
            <span class="label">Autorisations de sortie</span>
          </a>
          <a mat-list-item routerLink="/daily-reports" routerLinkActive="active">
            <span class="item-icon"><i class="bi bi-clipboard-check"></i></span>
            <span class="label">Compte-rendu journalier</span>
          </a>
        </mat-nav-list>

        <ng-container *ngIf="auth.hasRole('ROLE_ADMIN')">
          <div class="section-title" style="margin-top:6px">Administration</div>
          <mat-nav-list>
            <a mat-list-item routerLink="/admin/users" routerLinkActive="active">
              <span class="item-icon"><i class="bi bi-shield-lock"></i></span>
              <span class="label">Utilisateurs</span>
            </a>
            <a mat-list-item routerLink="/admin/departments" routerLinkActive="active">
              <span class="item-icon"><i class="bi bi-building-gear"></i></span>
              <span class="label">Départements</span>
            </a>
            <a mat-list-item routerLink="/admin/people-hub" routerLinkActive="active">
              <span class="item-icon"><i class="bi bi-people-fill"></i></span>
              <span class="label">Vue 360° employés</span>
            </a>
            <a mat-list-item *ngIf="isAdmin()" routerLink="/settings" routerLinkActive="active">
              <span class="item-icon"><i class="bi bi-gear"></i></span>
              <span class="label">Paramètres</span>
            </a>
          </mat-nav-list>
        </ng-container>
      </div>
    </mat-sidenav>

    <mat-sidenav-content>
      <div class="topbar">
        <mat-toolbar class="toolbar" color="transparent">
          <div class="title">
            <span class="crumb">ALTRACALL</span>
            <span class="sep">/</span>
            <span>{{pageTitle()}}</span>
          </div>
          <span class="spacer"></span>

          <a class="icon-btn" matTooltip="Notifications" routerLink="/notifications"
             [matBadge]="unreadCount()" matBadgeColor="warn" [matBadgeHidden]="!unreadCount()" matBadgeOverlap="true">
            <i class="bi bi-bell"></i>
          </a>

          <button class="icon-btn" style="margin-left:10px" type="button" matTooltip="Basculer le thème" (click)="toggleUiMode()">
            <i class="bi" [ngClass]="uiMode() === 'dark' ? 'bi-sun' : 'bi-moon'"></i>
          </button>

          <button class="pill" style="margin-left:10px" *ngIf="auth.me() as me" [matMenuTriggerFor]="menu">
            <span class="avatar">{{initials()}}</span>
            <span class="user-meta">
              <span class="user-name">{{me.fullName}}</span>
              <span class="user-role">{{roleLabel()}}</span>
            </span>
          </button>

          <mat-menu #menu="matMenu">
            <button mat-menu-item routerLink="/profile"><i class="bi bi-person me-2"></i> Profil</button>
            <button mat-menu-item *ngIf="isAdmin()" routerLink="/settings"><i class="bi bi-gear me-2"></i> Paramètres</button>
            <mat-divider></mat-divider>
            <button mat-menu-item (click)="logout()"><i class="bi bi-box-arrow-right me-2"></i> Déconnexion</button>
          </mat-menu>
        </mat-toolbar>
      </div>

      <div class="content">
        <div class="route-host" [@routeFade]="routeAnimKey()">
          <router-outlet></router-outlet>
        </div>
      </div>
    </mat-sidenav-content>
  </mat-sidenav-container>
  `
})
export class ShellComponent implements OnInit, OnDestroy {
  unreadCount = this.notifStore.unreadCount;
  pageTitle = signal<string>('Tableau de bord');
  routeAnimKey = signal<string>('dashboard');
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
    this.routeAnimKey.set((this.router.url || '').replace(/^\//, '') || 'dashboard');

    const saved = (localStorage.getItem('hrms-ui-mode') || 'light') as 'dark' | 'light';
    this.uiMode.set(saved);
    this.applyUiMode();

    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      const t = this.deepestTitle();
      if (t) this.pageTitle.set(t);
      else {
        const url = this.router.url;
        if (url.startsWith('/notifications')) this.pageTitle.set('Notifications');
        else this.pageTitle.set('Tableau de bord');
      }

      const urlKey = (this.router.url || '').replace(/^\//, '') || 'dashboard';
      this.routeAnimKey.set(urlKey);
    });

    this.notifStore.start();

    this.stopSse = this.notif.subscribeMercure((n: NotificationItem) => {
      this.alert.toast({ icon: 'info', title: n.title, text: n.body });
    });
  }

  ngOnDestroy(): void {
    if (this.stopSse) this.stopSse();
    this.notifStore.stop();
  }

  toggleUiMode(): void {
    const next = this.uiMode() === 'dark' ? 'light' : 'dark';
    this.uiMode.set(next);
    localStorage.setItem('hrms-ui-mode', next);
    this.applyUiMode();
  }

  private applyUiMode(): void {
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
