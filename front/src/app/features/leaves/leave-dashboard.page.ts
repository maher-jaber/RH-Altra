import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';

import { AuthService } from '../../core/auth.service';

import { LeaveCreatePage } from './leave-create.page';
import { LeaveMyPage } from './leave-my.page';
import { LeavePendingManagerPage } from './leave-pending-manager.page';

@Component({
  standalone: true,
  selector: 'app-leave-dashboard',
  imports: [
    CommonModule,
    MatCardModule,
    MatTabsModule,
    MatButtonModule,
    RouterModule,
    LeaveCreatePage,
    LeaveMyPage,
    LeavePendingManagerPage,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h2 class="m-0">Congés</h2>
          <div class="muted">Demandes, suivi et validation manager — workflow manager 1 / manager 2.</div>
        </div>
        <div class="actions">
          <a mat-stroked-button routerLink="/dashboard">
            <span style="margin-right:6px">←</span> Retour
          </a>
        </div>
      </div>

      <mat-card class="panel">
        <mat-tab-group animationDuration="0ms">
          <mat-tab label="Nouvelle demande">
            <app-leave-create></app-leave-create>
          </mat-tab>

          <mat-tab label="Mes demandes">
            <app-leave-my></app-leave-my>
          </mat-tab>

          <mat-tab label="À valider" *ngIf="canValidate()">
            <app-leave-pending-manager></app-leave-pending-manager>
          </mat-tab>
        </mat-tab-group>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .page { max-width: 1200px; margin: 0 auto; }
      .page-header { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; margin-bottom: 12px; }
      .muted { opacity:.75; font-size:12px; }
      .panel { border-radius: 18px; padding: 8px; }
    `
  ]
})
export class LeaveDashboardPage {
  constructor(private auth: AuthService) {}

  canValidate(): boolean {
    return this.auth.hasRole('ROLE_ADMIN') || this.auth.isManager();
  }
}
