import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  template: `
  <div class="container">
    <h2 style="margin: 0 0 12px 0;">Bienvenue</h2>

    <div style="display:grid; grid-template-columns: repeat(auto-fit,minmax(240px,1fr)); gap: 12px;">
      <mat-card>
        <mat-card-header>
          <mat-card-title><mat-icon>event</mat-icon> Congés</mat-card-title>
        </mat-card-header>
        <mat-card-content>Créer et suivre les demandes de congés (workflow, statut, historique).</mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-header>
          <mat-card-title><mat-icon>payments</mat-icon> Avances</mat-card-title>
        </mat-card-header>
        <mat-card-content>Module prévu: demandes d'avances/acompte + validations.</mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-header>
          <mat-card-title><mat-icon>assignment</mat-icon> Compte-rendu</mat-card-title>
        </mat-card-header>
        <mat-card-content>Module prévu: compte-rendu journalier et suivi par supérieur.</mat-card-content>
      </mat-card>
    </div>

    <div style="margin-top: 16px;" *ngIf="auth.me() as me">
      <mat-card>
        <mat-card-header><mat-card-title>Profil</mat-card-title></mat-card-header>
        <mat-card-content>
          <div><strong>Nom:</strong> {{me.fullName}}</div>
          <div><strong>Rôles:</strong> {{me.roles.join(', ')}}</div>
        </mat-card-content>
      </mat-card>
    </div>
  </div>
  `
})
export class DashboardPageComponent {
  constructor(public auth: AuthService) {}
}
