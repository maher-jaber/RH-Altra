import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';


import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
  <div class="container-fluid p-0">
    <div class="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-3">
      <div>
        <h2 class="mb-1">Tableau de bord</h2>
        <div class="text-muted" *ngIf="auth.me() as me">Bienvenue, <b>{{me.fullName || me.email}}</b></div>
      </div>

      <div class="d-flex flex-wrap gap-2">
        <a class="btn btn-primary" routerLink="/leaves/create">
          <i class="bi bi-plus-lg me-1"></i>
          Demande congé
        </a>
        <a class="btn btn-outline-secondary" routerLink="/daily-reports/new">
          <i class="bi bi-pencil-square me-1"></i>
          Compte-rendu
        </a>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-12 col-md-6 col-xl-3">
        <div class="card h-100 shadow-sm border-0" style="border-radius:16px">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <div class="text-muted">Congés</div>
                <div class="fs-5 fw-bold">Demandes & soldes</div>
              </div>
              <i class="bi bi-calendar2-week"></i>
            </div>
            <div class="mt-2 text-muted">Créer, suivre, valider (manager → RH) et consulter l’historique.</div>
            <div class="mt-3 d-flex gap-2">
              <a class="btn btn-sm btn-outline-primary" routerLink="/leaves/my">Mes demandes</a>
              <a class="btn btn-sm btn-outline-secondary" routerLink="/leaves/team-calendar">Calendrier équipe</a>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-6 col-xl-3">
        <div class="card h-100 shadow-sm border-0" style="border-radius:16px">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <div class="text-muted">Avances</div>
                <div class="fs-5 fw-bold">Acomptes</div>
              </div>
              <i class="bi bi-cash-coin"></i>
            </div>
            <div class="mt-2 text-muted">Demande avec montant/motif + validation hiérarchique.</div>
            <div class="mt-3">
              <a class="btn btn-sm btn-outline-primary" routerLink="/advances">Voir</a>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-6 col-xl-3">
        <div class="card h-100 shadow-sm border-0" style="border-radius:16px">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <div class="text-muted">Autorisations</div>
                <div class="fs-5 fw-bold">Sorties</div>
              </div>
              <i class="bi bi-clock-history"></i>
            </div>
            <div class="mt-2 text-muted">Heure début/fin + validation rapide et traçable.</div>
            <div class="mt-3">
              <a class="btn btn-sm btn-outline-primary" routerLink="/exit-permissions">Voir</a>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-6 col-xl-3">
        <div class="card h-100 shadow-sm border-0" style="border-radius:16px">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <div class="text-muted">Compte-rendu</div>
                <div class="fs-5 fw-bold">Journalier</div>
              </div>
              <i class="bi bi-journal-text"></i>
            </div>
            <div class="mt-2 text-muted">Saisie quotidienne des tâches, heures, blocages + statistiques.</div>
            <div class="mt-3">
              <a class="btn btn-sm btn-outline-primary" routerLink="/daily-reports">Voir</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  `
})
export class DashboardPageComponent {
  constructor(public auth: AuthService) {}
}
