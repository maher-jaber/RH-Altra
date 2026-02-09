import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { NotificationService } from '../../core/api/notification.service';
import { NotificationItem } from '../../core/models';

@Component({
  standalone: true,
  imports: [CommonModule, MatCardModule, MatListModule, MatButtonModule, MatSnackBarModule],
  template: `
  <div class="container">
    <mat-card>
      <mat-card-header>
        <mat-card-title>Notifications</mat-card-title>
        <mat-card-subtitle>Temps réel via Mercure (SSE)</mat-card-subtitle>
      </mat-card-header>

      <mat-card-content>
        <mat-nav-list>
          <mat-list-item *ngFor="let n of list">
            <div style="width: 100%;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-weight:600;">{{n.title}}</div>
                  <div style="opacity:.8;">{{n.message}}</div>
                </div>
                <div style="text-align:right;">
                  <div style="opacity:.7; font-size:12px;">{{n.createdAt}}</div>
                  <button mat-button *ngIf="!n.readAt" (click)="read(n)">Marquer lu</button>
                </div>
              </div>
            </div>
          </mat-list-item>
        </mat-nav-list>

        <div *ngIf="list.length === 0" style="padding: 12px; opacity:.75;">Aucune notification.</div>
      </mat-card-content>
    </mat-card>
  </div>
  `
})
export class NotificationsPageComponent implements OnDestroy {
  list: NotificationItem[] = [];
  private stop: (() => void) | null = null;

  constructor(private notif: NotificationService, private snack: MatSnackBar) {
    this.reload();
    // live update
    this.stop = this.notif.subscribeMercure((n) => {
      this.list = [n, ...this.list];
    });
  }

  ngOnDestroy(): void {
    if (this.stop) this.stop();
  }

  reload() {
    this.notif.list().subscribe({
      next: (l) => this.list = l,
      error: () => this.snack.open('Erreur chargement notifications', 'OK', { duration: 3500 })
    });
  }

  read(n: NotificationItem) {
    this.notif.markAsRead(n.id).subscribe({
      next: () => { n.readAt = new Date().toISOString(); },
      error: () => this.snack.open('Erreur', 'OK', { duration: 3000 })
    });
  }
}
