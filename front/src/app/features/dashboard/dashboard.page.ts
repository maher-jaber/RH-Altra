import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatCardModule],
  template: `
  <div class="container-fluid p-0">
    <div class="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-3">
      <div>
        <h2 class="mb-1">Tableau de bord</h2>
        <div class="text-muted" *ngIf="auth.me() as me">Bienvenue, <b>{{me.fullName || me.email}}</b></div>
      </div>

      <div class="d-flex gap-2">
        <a class="btn btn-primary" routerLink="/leaves/create"><mat-icon class="me-1">add</mat-icon>Demande congé</a>
        <a class="btn btn-outline-secondary" routerLink="/daily-reports/new"><mat-icon class="me-1">edit</mat-icon>Compte-rendu</a>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-12 col-md-6 col-xl-3">
        <mat-card class="h-100" style="border-radius:16px">
          <mat-card-content>
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <div class="text-muted">Congés</div>
                <div class="fs-5 fw-bold">Demandes & soldes</div>
              </div>
              <mat-icon>event</mat-icon>
            </div>
            <div class="mt-2 text-muted">Créer, suivre, valider (manager → RH) et consulter l’historique.</div>
            <div class="mt-3 d-flex gap-2">
              <a class="btn btn-sm btn-outline-primary" routerLink="/leaves/my">Mes demandes</a>
              <a class="btn btn-sm btn-outline-secondary" routerLink="/leaves/team-calendar">Calendrier équipe</a>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <div class="col-12 col-md-6 col-xl-3">
        <mat-card class="h-100" style="border-radius:16px">
          <mat-card-content>
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <div class="text-muted">Avances</div>
                <div class="fs-5 fw-bold">Acomptes</div>
              </div>
              <mat-icon>payments</mat-icon>
            </div>
            <div class="mt-2 text-muted">Demande avec montant/motif + validation hiérarchique.</div>
            <div class="mt-3">
              <a class="btn btn-sm btn-outline-primary" routerLink="/advances">Voir</a>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <div class="col-12 col-md-6 col-xl-3">
        <mat-card class="h-100" style="border-radius:16px">
          <mat-card-content>
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <div class="text-muted">Autorisations</div>
                <div class="fs-5 fw-bold">Sorties</div>
              </div>
              <mat-icon>schedule</mat-icon>
            </div>
            <div class="mt-2 text-muted">Heure début/fin + validation rapide et traçable.</div>
            <div class="mt-3">
              <a class="btn btn-sm btn-outline-primary" routerLink="/exit-permissions">Voir</a>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <div class="col-12 col-md-6 col-xl-3">
        <mat-card class="h-100" style="border-radius:16px">
          <mat-card-content>
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <div class="text-muted">Compte-rendu</div>
                <div class="fs-5 fw-bold">Journalier</div>
              </div>
              <mat-icon>assignment</mat-icon>
            </div>
            <div class="mt-2 text-muted">Saisie quotidienne des tâches, heures, blocages + statistiques.</div>
            <div class="mt-3">
              <a class="btn btn-sm btn-outline-primary" routerLink="/daily-reports">Voir</a>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  </div>
  `
})
export class DashboardPageComponent {
  constructor(public auth: AuthService) {}
}
