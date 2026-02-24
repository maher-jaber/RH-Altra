import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { DashboardStats, DashboardStatsService } from '../../core/api/dashboard-stats.service';
import { LeaveWorkflowService } from '../../core/api/leave-workflow.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  styles: [`
    .kpi-card{
      border: 1px solid var(--stroke);
      border-radius: 18px;
      background: linear-gradient(180deg, var(--surface), var(--surface-2));
      box-shadow: 0 16px 40px rgba(0,0,0,.10);
    }
    .kpi-top{ display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .kpi-title{ font-weight: 900; letter-spacing:.1px; margin:0; }
    .kpi-sub{ color: var(--text-2); font-size: 12px; margin-top: 2px; }
    .kpi-value{ font-size: 28px; font-weight: 900; letter-spacing: .2px; margin-top: 10px; }
    .mini{
      display:flex; align-items:flex-end; gap: 4px;
      height: 82px;
      padding: 10px 8px 6px;
      border-radius: 14px;
      border: 1px solid var(--stroke);
      background: var(--surface);
      overflow: hidden;
    }
    .mini .bar{ width: 10px; border-radius: 10px; background: rgba(37,99,235,.35); border: 1px solid rgba(37,99,235,.35); }
    .mini .bar.exits{ background: rgba(16,185,129,.28); border-color: rgba(16,185,129,.30); }
    .mini .bar.adv{ background: rgba(245,158,11,.28); border-color: rgba(245,158,11,.30); }
    .legend{ display:flex; gap: 12px; align-items:center; flex-wrap:wrap; color: var(--text-2); font-size: 12px; }
    .dot{ width: 10px; height:10px; border-radius: 999px; display:inline-block; margin-right:6px; }
    .dot.l{ background: rgba(37,99,235,.55); }
    .dot.e{ background: rgba(16,185,129,.55); }
    .dot.a{ background: rgba(245,158,11,.55); }
  `],
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
        <a class="btn btn-outline-secondary" routerLink="/exit-permissions">
          <i class="bi bi-clock-history me-1"></i>
          Autorisation sortie
        </a>
        <a class="btn btn-outline-secondary" routerLink="/daily-reports">
          <i class="bi bi-pencil-square me-1"></i>
          Compte-rendu
        </a>
      </div>
    </div>

    <!-- KPI cards -->
    <div class="row g-3 mb-3" *ngIf="stats() as s; else loadingTpl">
      <div class="col-12 col-md-6 col-xl-3" *ngIf="auth.hasRole('ROLE_ADMIN')">
        <div class="kpi-card h-100 p-3">
          <div class="kpi-top">
            <div>
              <div class="kpi-title">Employés</div>
              <div class="kpi-sub">Total enregistré</div>
            </div>
            <i class="bi bi-people fs-4"></i>
          </div>
          <div class="kpi-value">{{s.kpis.employeesTotal ?? '—'}}</div>
          <div class="mt-2">
            <a class="btn btn-sm btn-outline-primary" routerLink="/admin/users">Gérer</a>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-6 col-xl-3" *ngIf="auth.hasRole('ROLE_ADMIN')">
        <div class="kpi-card h-100 p-3">
          <div class="kpi-top">
            <div>
              <div class="kpi-title">Départements</div>
              <div class="kpi-sub">Structure interne</div>
            </div>
            <i class="bi bi-diagram-3 fs-4"></i>
          </div>
          <div class="kpi-value">{{s.kpis.departmentsTotal ?? '—'}}</div>
          <div class="mt-2">
            <a class="btn btn-sm btn-outline-primary" routerLink="/admin/departments">Ouvrir</a>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-6 col-xl-3" *ngIf="auth.isManager()">
        <div class="kpi-card h-100 p-3">
          <div class="kpi-top">
            <div>
              <div class="kpi-title">Congés</div>
              <div class="kpi-sub">En attente (Manager)</div>
            </div>
            <i class="bi bi-calendar2-week fs-4"></i>
          </div>
          <div class="kpi-value">{{s.kpis.pendingLeavesManager}}</div>
          <div class="mt-2">
            <a class="btn btn-sm btn-outline-primary" routerLink="/leaves/pending-manager">Valider</a>
          </div>
        </div>
      </div>

      <!-- RH removed: no second step besides manager2 -->

      <div class="col-12 col-md-6 col-xl-3" *ngIf="auth.isManager()">
        <div class="kpi-card h-100 p-3">
          <div class="kpi-top">
            <div>
              <div class="kpi-title">Sorties</div>
              <div class="kpi-sub">À valider</div>
            </div>
            <i class="bi bi-clock-history fs-4"></i>
          </div>
          <div class="kpi-value">{{s.kpis.pendingExits}}</div>
          <div class="mt-2">
            <a class="btn btn-sm btn-outline-primary" routerLink="/exit-permissions" [queryParams]="{tab:'pending'}">Valider</a>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-6 col-xl-3" *ngIf="auth.hasRole('ROLE_SUPERIOR') || auth.hasRole('ROLE_ADMIN')">
        <div class="kpi-card h-100 p-3">
          <div class="kpi-top">
            <div>
              <div class="kpi-title">Avances</div>
              <div class="kpi-sub">À valider</div>
            </div>
            <i class="bi bi-cash-coin fs-4"></i>
          </div>
          <div class="kpi-value">{{s.kpis.pendingAdvances}}</div>
          <div class="mt-2">
            <a class="btn btn-sm btn-outline-primary" routerLink="/advances" [queryParams]="{tab:'pending'}">Valider</a>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-6 col-xl-3">
        <div class="kpi-card h-100 p-3">
          <div class="kpi-top">
            <div>
              <div class="kpi-title">Compte-rendus</div>
              <div class="kpi-sub">Aujourd’hui</div>
            </div>
            <i class="bi bi-journal-text fs-4"></i>
          </div>
          <div class="kpi-value">{{s.kpis.dailyReportsToday}}</div>
          <div class="mt-2">
            <a class="btn btn-sm btn-outline-primary" routerLink="/daily-reports" [queryParams]="{tab: defaultDailyReportsTab()}">Ouvrir</a>
          </div>
        </div>
      </div>

      <!-- Activity + stats -->
      <div class="col-12 col-xl-6">
        <div class="kpi-card h-100 p-3">
          <div class="d-flex align-items-start justify-content-between gap-3">
            <div>
              <div class="kpi-title">Activité</div>
              <div class="kpi-sub">12 derniers mois (congés, sorties, avances)</div>
            </div>
            <button class="btn btn-sm btn-outline-secondary" (click)="refresh()" [disabled]="loading()">
              <i class="bi bi-arrow-clockwise"></i>
            </button>
          </div>

          <div class="mt-3 legend">
            <span><span class="dot l"></span>Congés</span>
            <span><span class="dot e"></span>Sorties</span>
            <span><span class="dot a"></span>Avances</span>
          </div>

          <div class="mt-2 mini" *ngIf="s.series?.length">
            <ng-container *ngFor="let m of s.series">
              <div class="bar" [style.height.%]="barHeight(m.leaves)" title="Congés {{m.month}}: {{m.leaves}}"></div>
              <div class="bar exits" [style.height.%]="barHeight(m.exits)" title="Sorties {{m.month}}: {{m.exits}}"></div>
              <div class="bar adv" [style.height.%]="barHeight(m.advances)" title="Avances {{m.month}}: {{m.advances}}"></div>
            </ng-container>
          </div>

          <div class="mt-2 text-muted" *ngIf="!s.series?.length">(Aucune donnée sur la période)</div>
        </div>
      </div>

      <div class="col-12 col-xl-6" *ngIf="auth.hasRole('ROLE_ADMIN')">
        <div class="kpi-card h-100 p-3">
          <div class="d-flex align-items-start justify-content-between gap-3">
            <div>
              <div class="kpi-title">Congés par type</div>
              <div class="kpi-sub">Vue globale</div>
            </div>
            <i class="bi bi-bar-chart fs-4"></i>
          </div>

          <div class="mt-3" *ngIf="s.leaveTypes?.length; else noTypes">
            <div class="d-flex flex-wrap gap-2">
              <span class="badge text-bg-light" style="border:1px solid #eee" *ngFor="let t of s.leaveTypes">
                {{t.type || '—'}}: <b>{{t.total}}</b>
              </span>
            </div>
          </div>

          <ng-template #noTypes>
            <div class="text-muted">(Aucune statistique disponible)</div>
          </ng-template>
        </div>
      </div>
    </div>

    <ng-template #loadingTpl>
      <div class="text-muted">Chargement statistiques…</div>
    </ng-template>


    
  </div>
  `
})
export class DashboardPageComponent implements OnInit {
  stats = signal<DashboardStats | null>(null);
  loading = signal(false);

  private maxSeries = computed(() => {
    const s = this.stats();
    if (!s?.series?.length) return 0;
    return Math.max(...s.series.map(x => Math.max(x.leaves, x.exits, x.advances)), 0);
  });

  constructor(
    public auth: AuthService,
    private dash: DashboardStatsService,
    // keep the old service injected in case other pages rely on it; also ensures backward compat
    private leaves: LeaveWorkflowService
  ) {}

  async ngOnInit() {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.dash.get().subscribe({
      next: (s) => { this.stats.set(s); this.loading.set(false); },
      error: () => {
        // fallback: keep old leave type stats if dashboard endpoint not accessible for a role
        this.leaves.statsLeaves().then((res: any) => {
          const current = this.stats();
          const mapped: DashboardStats = current ?? {
            kpis: {
              pendingLeavesManager: 0, pendingLeavesHr: 0, pendingExits: 0, pendingAdvances: 0,
              dailyReportsToday: 0, employeesTotal: null, departmentsTotal: null
            },
            series: [],
            leaveTypes: null
          };
          mapped.leaveTypes = res?.items ?? null;
          this.stats.set(mapped);
          this.loading.set(false);
        }).catch(() => this.loading.set(false));
      }
    });
  }


  defaultDailyReportsTab(): 'new' | 'my' | 'team' {
    // From dashboard we prefer the most useful tab:
    // - Manager: Team follow-up
    // - Others: My history
    return this.auth.isManager() ? 'team' : 'my';
  }

  barHeight(v: number): number {
    const max = this.maxSeries();
    if (!max || max <= 0) return 2;
    // Keep tiny bars visible
    return Math.max(4, Math.round((v / max) * 100));
  }
}
