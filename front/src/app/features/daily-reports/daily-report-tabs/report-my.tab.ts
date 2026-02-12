import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { DailyReportService } from '../../../core/api/daily-report.service';

@Component({
  standalone: true,
  selector: 'app-daily-report-my-tab',
  imports: [CommonModule, RouterModule],
  template: `
    <div class="p-2 p-md-3">
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <div class="fw-semibold">Mes compte-rendus</div>
          <div class="muted">Historique personnel (paginé). Cliquer pour voir le détail.</div>
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

      <div class="card border-0 shadow-sm" style="border-radius:16px">
        <div class="card-body">
          <div class="text-muted" *ngIf="items().length===0">Aucun compte-rendu.</div>

          <div class="table-responsive" *ngIf="items().length>0">
            <table class="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Tâches</th>
                  <th class="text-end">Heures</th>
                  <th class="text-end">Créé le</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let r of items()">
                  <td class="fw-semibold">{{r.date | date:'mediumDate'}}</td>
                  <td>
                    <div class="text-truncate" style="max-width:640px">{{r.tasks}}</div>
                    <div class="muted" *ngIf="r.blockers">Blocages: {{r.blockers}}</div>
                  </td>
                  <td class="text-end">{{r.hours ?? '—'}}</td>
                  <td class="text-end muted">{{r.createdAt | date:'short'}}</td>
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
export class DailyReportMyTab implements OnChanges {
  @Input() refreshKey = 0;

  pageIndex = signal(0);
  pageSize = signal(10);
  total = signal(0);
  items = signal<any[]>([]);

  constructor(private api: DailyReportService) {
    void this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['refreshKey'] && !changes['refreshKey'].firstChange) {
      this.pageIndex.set(0);
      void this.load();
    }
  }

  async load() {
    const res = await this.api.my(this.pageIndex() + 1, this.pageSize());
    this.items.set(res?.items || []);
    this.total.set(res?.meta?.total ?? (res?.items?.length || 0));
  }

  reload() { void this.load(); }

  setPageSize(v: any) {
    const n = parseInt(v, 10);
    this.pageSize.set(Number.isFinite(n) && n > 0 ? n : 10);
    this.pageIndex.set(0);
    void this.load();
  }
  prev() { if (this.pageIndex() === 0) return; this.pageIndex.set(this.pageIndex() - 1); void this.load(); }
  next() { if ((this.pageIndex() + 1) * this.pageSize() >= this.total()) return; this.pageIndex.set(this.pageIndex() + 1); void this.load(); }
}
