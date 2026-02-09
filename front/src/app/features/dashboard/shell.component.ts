import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';

import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService } from '../../core/auth.service';
import { NotificationService } from '../../core/api/notification.service';
import { NotificationItem } from '../../core/models';

@Component({
  standalone: true,
  selector: 'app-shell',
  imports: [
    CommonModule, RouterOutlet, RouterLink,
    MatSidenavModule, MatToolbarModule, MatButtonModule, MatIconModule, MatListModule, MatBadgeModule,
    MatSnackBarModule
  ],
  styles: [`
    .app-container { height: 100vh; }
    .content { padding: 16px; }
    .spacer { flex: 1 1 auto; }
    .brand { font-weight: 600; letter-spacing: .2px; }
  `],
  template: `
  <mat-sidenav-container class="app-container">
    <mat-sidenav mode="side" opened>
      <mat-toolbar class="brand">Altra Call HRMS</mat-toolbar>
      <mat-nav-list>
        <a mat-list-item routerLink="/dashboard"><mat-icon>dashboard</mat-icon>&nbsp;Dashboard</a>
        <a mat-list-item routerLink="/leave/new"><mat-icon>add_circle</mat-icon>&nbsp;Demander un congé</a>
        <a mat-list-item routerLink="/leave/my"><mat-icon>event</mat-icon>&nbsp;Mes demandes</a>
        <a mat-list-item routerLink="/notifications">
          <mat-icon>notifications</mat-icon>&nbsp;Notifications
          <span class="spacer"></span>
          <span [matBadge]="unreadCount()" matBadgeOverlap="false"></span>
        </a>
      </mat-nav-list>
    </mat-sidenav>

    <mat-sidenav-content>
      <mat-toolbar>
        <span>{{pageTitle()}}</span>
        <span class="spacer"></span>
        <span style="font-size: 13px; opacity: .85;" *ngIf="auth.me() as me">{{me.fullName}}</span>
        <button mat-button (click)="logout()"><mat-icon>logout</mat-icon>&nbsp;Déconnexion</button>
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
  pageTitle = signal<string>('Dashboard');
  private stopSse: (() => void) | null = null;

  constructor(
    public auth: AuthService,
    private notif: NotificationService,
    private snack: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      const url = this.router.url;
      if (url.startsWith('/leave/new')) this.pageTitle.set('Demande de congé');
      else if (url.startsWith('/leave/my')) this.pageTitle.set('Mes demandes');
      else if (url.startsWith('/notifications')) this.pageTitle.set('Notifications');
      else this.pageTitle.set('Dashboard');
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
}
