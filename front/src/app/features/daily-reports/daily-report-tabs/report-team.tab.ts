import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DailyReportService } from '../../../core/api/daily-report.service';
import { AuthService } from '../../../core/auth.service';

@Component({
  standalone: true,
  selector: 'app-daily-report-team-tab',
  imports: [CommonModule],
  template: `
    <div class="p-2 p-md-3">
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <div class="fw-semibold">Compte-rendus équipe</div>
          <div class="muted">Visible pour manager / admin — paginé.</div>
        </div>
        <div class="d-flex gap-2 align-items-center">
          <select class="form-select form-select-sm" style="width:120px" [value]="pageSize()" (change)="setPageSize($any($event.target).value)">
            <option [value]="10">10</option>
            <option [value]="20">20</option>
            <option [value]="50">50</option>
          </select>
          <button class="btn btn-outline-secondary btn-sm" (click)="reload()"><i class="bi bi-arrow-clockwise"></i> Rafraîchir</button>
        </div>
      </div>

      <div style="height:10px"></div>

      <div class="alert alert-warning" *ngIf="!canSee()">
        Accès manager / admin requis.
      </div>

      <div class="card border-0 shadow-sm" style="border-radius:16px" *ngIf="canSee()">
        <div class="card-body">
          <div class="text-muted" *ngIf="items().length===0">Aucun compte-rendu d'équipe.</div>

          <div class="table-responsive" *ngIf="items().length>0">
            <table class="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employé</th>
                  <th>Tâches</th>
                  <th class="text-end">Heures</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let r of items()">
                  <td class="fw-semibold">{{r.date | date:'mediumDate'}}</td>
                  <td>
                    <div class="fw-semibold">{{r.user?.fullName || r.user?.email || '—'}}</div>
                  </td>
                  <td>
                    <div class="text-truncate" style="max-width:640px">{{r.tasks}}</div>
                    <div class="muted" *ngIf="r.blockers">Blocages: {{r.blockers}}</div>
                  </td>
                  <td class="text-end">{{r.hours ?? '—'}}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="d-flex align-items-center justify-content-between mt-3" *ngIf="total()>0">
            <div class="muted">Total: {{total()}}</div>
            <div class="d-flex gap-2">
              <button class="btn btn-outline-secondary btn-sm" (click)="prev()" [disabled]="pageIndex()===0">Précédent</button>
              <button class="btn btn-outline-secondary btn-sm" (click)="next()" [disabled]="(pageIndex()+1)*pageSize()>=total()">Suivant</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`.muted{opacity:.75;font-size:12px}`]
})
export class DailyReportTeamTab implements OnChanges {
  @Input() refreshKey = 0;

  pageIndex = signal(0);
  pageSize = signal(10);
  total = signal(0);
  items = signal<any[]>([]);

  constructor(private api: DailyReportService, private auth: AuthService) {
    if (this.canSee()) void this.load();
  }

  canSee(): boolean {
    return this.auth.hasRole('ROLE_SUPERIOR') || this.auth.hasRole('ROLE_ADMIN');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['refreshKey'] && !changes['refreshKey'].firstChange) {
      this.pageIndex.set(0);
      if (this.canSee()) void this.load();
    }
  }

  async load() {
    const res = await this.api.team(this.pageIndex() + 1, this.pageSize());
    this.items.set(res?.items || []);
    this.total.set(res?.meta?.total ?? (res?.items?.length || 0));
  }

  reload() { if (this.canSee()) void this.load(); }

  setPageSize(v: any) {
    const n = parseInt(v, 10);
    this.pageSize.set(Number.isFinite(n) && n > 0 ? n : 10);
    this.pageIndex.set(0);
    if (this.canSee()) void this.load();
  }
  prev() { if (this.pageIndex() === 0) return; this.pageIndex.set(this.pageIndex() - 1); if (this.canSee()) void this.load(); }
  next() { if ((this.pageIndex() + 1) * this.pageSize() >= this.total()) return; this.pageIndex.set(this.pageIndex() + 1); if (this.canSee()) void this.load(); }
}
