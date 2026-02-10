import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';

import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService } from '../../core/auth.service';
import { NotificationService } from '../../core/api/notification.service';
import { NotificationItem } from '../../core/models';

@Component({
  standalone: true,
  selector: 'app-shell',
  imports: [
    CommonModule, RouterOutlet, RouterLink, RouterLinkActive,
    MatSidenavModule, MatToolbarModule, MatButtonModule, MatIconModule, MatListModule, MatBadgeModule,
    MatDividerModule, MatExpansionModule, MatMenuModule, MatTooltipModule,
    MatSnackBarModule
  ],
  styles: [`
    .app-container { height: 100vh; background: var(--app-bg, #f5f6fa); }
    .sidenav { width: 280px; border-right: 1px solid rgba(0,0,0,.08); }
    .brandbar { display:flex; align-items:center; gap: 10px; padding: 14px 16px; height: 64px; box-sizing: border-box; }
    .logo {
      width: 34px; height: 34px; border-radius: 10px;
      display:grid; place-items:center;
      background: linear-gradient(135deg, rgba(25,118,210,.18), rgba(255,152,0,.18));
    }
    .brand { font-weight: 700; letter-spacing: .2px; line-height: 1.1; }
    .brand-sub { font-size: 12px; opacity: .7; margin-top: 2px; }
    .content { padding: 18px; }
    .spacer { flex: 1 1 auto; }
    .nav-section { padding: 6px 8px 10px; }
    .nav-title { font-size: 12px; font-weight: 700; opacity: .65; padding: 10px 12px 6px; }
    a.mat-mdc-list-item { border-radius: 10px; margin: 2px 6px; }
    a.mat-mdc-list-item.active { background: rgba(25,118,210,.10); }
    .topbar { position: sticky; top: 0; z-index: 5; }
    .user-pill { display:flex; align-items:center; gap: 10px; }
    .avatar {
      width: 32px; height: 32px; border-radius: 999px;
      background: rgba(0,0,0,.08);
      display:grid; place-items:center;
      font-weight: 700; font-size: 12px;
    }
    .user-meta { display:flex; flex-direction: column; line-height: 1.1; }
    .user-name { font-size: 13px; font-weight: 600; }
    .user-role { font-size: 11px; opacity: .7; }
    @media (max-width: 980px) {
      .sidenav { width: 84px; }
      .brand-text { display:none; }
      .nav-title { display:none; }
      .user-meta { display:none; }
      a.mat-mdc-list-item .mdc-list-item__primary-text { display:none; }
    }
  `],
  template: `
  <mat-sidenav-container class="app-container">
    <mat-sidenav class="sidenav" mode="side" opened>
      <div class="brandbar">
        <div class="logo"><mat-icon>corporate_fare</mat-icon></div>
        <div class="brand-text">
          <div class="brand">ALTRACALL HRMS</div>
          <div class="brand-sub">Portail RH interne</div>
        </div>
      </div>
      <mat-divider></mat-divider>

      <div class="nav-section">
        <div class="nav-title">Général</div>
        <mat-nav-list>
          <a mat-list-item routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">
            <mat-icon>dashboard</mat-icon>
            <span>Tableau de bord</span>
          </a>
          <a mat-list-item routerLink="/notifications" routerLinkActive="active">
            <mat-icon>notifications</mat-icon>
            <span>Notifications</span>
            <span class="spacer"></span>
            <span [matBadge]="unreadCount()" matBadgeOverlap="false"></span>
          </a>
        </mat-nav-list>

        <mat-accordion multi>
          <mat-expansion-panel [expanded]="true" hideToggle>
            <mat-expansion-panel-header>
              <mat-panel-title>RH</mat-panel-title>
              <mat-panel-description>Congés & demandes</mat-panel-description>
            </mat-expansion-panel-header>

            <mat-nav-list>
              <a mat-list-item routerLink="/leaves" routerLinkActive="active">
                <mat-icon>beach_access</mat-icon>
                <span>Congés</span>
              </a>
              <a mat-list-item routerLink="/advances" routerLinkActive="active">
                <mat-icon>payments</mat-icon>
                <span>Avances / acompte</span>
              </a>
              <a mat-list-item routerLink="/exit-permissions" routerLinkActive="active">
                <mat-icon>directions_walk</mat-icon>
                <span>Autorisations de sortie</span>
              </a>
              <a mat-list-item routerLink="/daily-reports" routerLinkActive="active">
                <mat-icon>fact_check</mat-icon>
                <span>Compte-rendu journalier</span>
              </a>
            </mat-nav-list>
          </mat-expansion-panel>

          <mat-expansion-panel *ngIf="auth.hasRole('ROLE_ADMIN')" [expanded]="false" hideToggle>
            <mat-expansion-panel-header>
              <mat-panel-title>Administration</mat-panel-title>
              <mat-panel-description>Paramètres</mat-panel-description>
            </mat-expansion-panel-header>

            <mat-nav-list>
              <a mat-list-item routerLink="/admin/users" routerLinkActive="active">
                <mat-icon>admin_panel_settings</mat-icon>
                <span>Utilisateurs</span>
              </a>
              <a mat-list-item routerLink="/admin/departments" routerLinkActive="active">
                <mat-icon>apartment</mat-icon>
                <span>Départements</span>
              </a>
            </mat-nav-list>
          </mat-expansion-panel>
        </mat-accordion>
      </div>
    </mat-sidenav>

    <mat-sidenav-content>
      <mat-toolbar class="topbar">
        <span>{{pageTitle()}}</span>
        <span class="spacer"></span>

        <button mat-icon-button routerLink="/notifications" matTooltip="Notifications">
          <mat-icon [matBadge]="unreadCount()" matBadgeOverlap="false">notifications</mat-icon>
        </button>

        <button mat-button [matMenuTriggerFor]="userMenu" class="user-pill" *ngIf="auth.me() as me">
          <span class="avatar">{{initials()}}</span>
          <span class="user-meta">
            <span class="user-name">{{me.fullName}}</span>
            <span class="user-role">{{roleLabel()}}</span>
          </span>
          <mat-icon>expand_more</mat-icon>
        </button>

        <mat-menu #userMenu="matMenu">
          <button mat-menu-item disabled>
            <mat-icon>person</mat-icon>
            <span>Mon profil</span>
          </button>
          <button mat-menu-item (click)="logout()">
            <mat-icon>logout</mat-icon>
            <span>Déconnexion</span>
          </button>
        </mat-menu>
      </mat-toolbar>

      <div class="content">
        <router-outlet></router-outlet>
      </div>
    </mat-sidenav-content>
  </mat-sidenav-container>
  `
})
export class ShellComponent implements OnInit, OnDestroy {
  unreadCount = signal<number>(0);
  pageTitle = signal<string>('Tableau de bord');
  private stopSse: (() => void) | null = null;

  constructor(
    public auth: AuthService,
    private notif: NotificationService,
    private snack: MatSnackBar,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      // Prefer route title (Routes.title), fallback to URL heuristics.
      const t = this.deepestTitle();
      if (t) this.pageTitle.set(t);
      else {
        const url = this.router.url;
        if (url.startsWith('/notifications')) this.pageTitle.set('Notifications');
        else this.pageTitle.set('Tableau de bord');
      }
    });

    // Load initial notifications count
    this.notif.list().subscribe(list => {
      this.unreadCount.set(list.filter(n => !n.readAt).length);
    });

    // Start SSE
    this.stopSse = this.notif.subscribeMercure((n: NotificationItem) => {
      this.unreadCount.set(this.unreadCount() + 1);
      this.snack.open(n.title, 'Voir', { duration: 3500 })
        .onAction().subscribe(() => this.router.navigateByUrl('/notifications'));
    });
  }

  ngOnDestroy(): void {
    if (this.stopSse) this.stopSse();
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
