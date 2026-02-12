import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { LeaveWorkflowService } from '../../core/api/leave-workflow.service';

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
        <a class="btn btn-outline-secondary" routerLink="/daily-reports">
          <i class="bi bi-pencil-square me-1"></i>
          Compte-rendu
        </a>
      </div>
    </div>

    <!-- Quick stats -->
    <div class="row g-3 mb-3">
      <div class="col-12 col-md-6 col-xl-3" *ngIf="auth.hasRole('ROLE_SUPERIOR') || auth.hasRole('ROLE_ADMIN')">
        <div class="card h-100 shadow-sm border-0" style="border-radius:16px">
          <div class="card-body">
            <div class="text-muted">En attente</div>
            <div class="fs-4 fw-bold">{{pendingManagerTotal()}}</div>
            <div class="text-muted">Congés à valider (Manager)</div>
            <div class="mt-2">
              <a class="btn btn-sm btn-outline-primary" routerLink="/leaves/pending-manager">Ouvrir</a>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-6 col-xl-3" *ngIf="auth.hasRole('ROLE_HR') || auth.hasRole('ROLE_ADMIN')">
        <div class="card h-100 shadow-sm border-0" style="border-radius:16px">
          <div class="card-body">
            <div class="text-muted">En attente</div>
            <div class="fs-4 fw-bold">{{pendingHrTotal()}}</div>
            <div class="text-muted">Congés à valider (RH)</div>
            <div class="mt-2">
              <a class="btn btn-sm btn-outline-primary" routerLink="/leaves/pending-hr">Ouvrir</a>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-6 col-xl-6" *ngIf="auth.hasRole('ROLE_HR') || auth.hasRole('ROLE_ADMIN')">
        <div class="card h-100 shadow-sm border-0" style="border-radius:16px">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between">
              <div>
                <div class="text-muted">Statistiques congés</div>
                <div class="fw-bold">Répartition par type</div>
              </div>
              <i class="bi bi-bar-chart"></i>
            </div>

            <div class="mt-2" *ngIf="stats()?.items?.length; else noStats">
              <div class="d-flex flex-wrap gap-2">
                <span class="badge text-bg-light" style="border:1px solid #eee" *ngFor="let s of stats().items">
                  {{s.type}}: <b>{{s.total}}</b>
                </span>
              </div>
            </div>

            <ng-template #noStats>
              <div class="text-muted">(Aucune statistique disponible)</div>
            </ng-template>
          </div>
        </div>
      </div>
    </div>

    <!-- Modules -->
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
            <div class="mt-3 d-flex gap-2 flex-wrap">
              <a class="btn btn-sm btn-outline-primary" routerLink="/leaves/my">Mes demandes</a>
              <a class="btn btn-sm btn-outline-secondary" routerLink="/admin/team-calendar" *ngIf="auth.hasRole('ROLE_ADMIN')">Calendrier équipe</a>
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
            <div class="mt-2 text-muted">Saisie quotidienne des tâches, heures, blocages + historique.</div>
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
export class DashboardPageComponent implements OnInit {
  stats = signal<any | null>(null);
  pendingManagerTotal = signal<number>(0);
  pendingHrTotal = signal<number>(0);

  constructor(public auth: AuthService, private leaves: LeaveWorkflowService) {}

  async ngOnInit() {
    try {
      this.stats.set(await this.leaves.statsLeaves());
    } catch {}

    try {
      const res = await this.leaves.pendingManager(1, 1);
      this.pendingManagerTotal.set(res?.meta?.total ?? 0);
    } catch {}

    try {
      const res = await this.leaves.pendingHr(1, 1);
      this.pendingHrTotal.set(res?.meta?.total ?? 0);
    } catch {}
  }
}
