import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

import { LeaveWorkflowService } from '../../core/api/leave-workflow.service';

type CalItem = {
  id: string;
  startDate: string;
  endDate: string;
  type?: { label?: string };
  user?: { fullName?: string };
};

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function fmtYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Component({
  standalone: true,
  selector: 'app-leave-team-calendar',
  imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule],
  template: `
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
      <div>
        <h2 style="margin:0">Calendrier d'équipe</h2>
        <div class="muted">Vue mensuelle des congés approuvés (RH_APPROVED).</div>
      </div>
      <div class="d-flex align-items-center gap-2">
        <a mat-stroked-button routerLink="/dashboard">Retour</a>
      </div>
    </div>

    <div style="height:12px"></div>

    <mat-card class="shell">
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div class="d-flex align-items-center gap-2">
          <button mat-stroked-button (click)="prevMonth()"><i class="bi bi-chevron-left"></i></button>
          <button mat-stroked-button (click)="nextMonth()"><i class="bi bi-chevron-right"></i></button>
          <button mat-stroked-button (click)="today()">Aujourd'hui</button>
        </div>
        <div class="fw-semibold">{{monthTitle()}}</div>
        <button mat-stroked-button (click)="reload()"><i class="bi bi-arrow-clockwise"></i></button>
      </div>

      <div style="height:10px"></div>

      <div class="grid">
        <div class="dow" *ngFor="let d of dows">{{d}}</div>

        <ng-container *ngFor="let c of cells()">
          <div class="cell" [class.out]="c.out">
            <div class="day">{{c.day}}</div>

            <div class="evt" *ngFor="let e of c.events; let i=index" [title]="e.title">
              <span class="dot"></span>
              <span class="text-truncate">{{e.title}}</span>
            </div>

            <div class="more" *ngIf="c.more > 0">+{{c.more}} autres</div>
          </div>
        </ng-container>
      </div>

      <div *ngIf="loading()" class="muted p-2">Chargement...</div>
    </mat-card>
  `,
  styles: [
    `.shell{border-radius:18px;padding:14px}`,
    `.muted{opacity:.75;font-size:12px}`,
    `.grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}`,
    `.dow{font-size:12px;opacity:.7;padding:0 6px}`,
    `.cell{border:1px solid #eee;border-radius:14px;padding:8px;min-height:110px;background:#fff}`,
    `.cell.out{background:#fafafa;opacity:.75}`,
    `.day{font-size:12px;opacity:.75;display:flex;justify-content:flex-end}`,
    `.evt{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12px;white-space:nowrap;overflow:hidden}`,
    `.dot{width:8px;height:8px;border-radius:999px;background:#0d6efd;flex:0 0 auto}`,
    `.more{margin-top:6px;font-size:12px;opacity:.65}`
  ]
})
export class LeaveTeamCalendarPage implements OnInit {
  dows = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  month = signal<Date>(startOfMonth(new Date()));
  items = signal<CalItem[]>([]);
  loading = signal(false);

  monthTitle = computed(() => {
    const d = this.month();
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  });

  private monthRange = computed(() => {
    const m = this.month();
    const start = startOfMonth(m);
    const end = endOfMonth(m);
    return { start, end };
  });

  /** Grid cells = 6 weeks max (42 cells) */
  cells = computed(() => {
    const { start, end } = this.monthRange();
    const startDow = (start.getDay() + 6) % 7; // Monday=0
    const gridStart = new Date(start);
    gridStart.setDate(start.getDate() - startDow);

    const map = this.indexEvents();

    const out: Array<{ date: Date; key: string; day: number; out: boolean; events: { title: string }[]; more: number }>=[];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      const key = fmtYmd(d);
      const inMonth = d.getMonth() === start.getMonth();
      const events = (map.get(key) ?? []).slice(0, 3).map(t => ({ title: t }));
      const more = Math.max(0, (map.get(key)?.length ?? 0) - events.length);
      out.push({ date: d, key, day: d.getDate(), out: !inMonth, events, more });
    }
    return out;
  });

  constructor(private api: LeaveWorkflowService) {}

  async ngOnInit() {
    await this.reload();
  }

  async reload() {
    this.loading.set(true);
    try {
      const res = await this.api.teamCalendar();
      this.items.set(res?.items ?? []);
    } finally {
      this.loading.set(false);
    }
  }

  prevMonth() {
    this.month.set(addMonths(this.month(), -1));
  }

  nextMonth() {
    this.month.set(addMonths(this.month(), 1));
  }

  today() {
    this.month.set(startOfMonth(new Date()));
  }

  private indexEvents(): Map<string, string[]> {
    const { start, end } = this.monthRange();
    const items = this.items();
    const map = new Map<string, string[]>();

    const monthStart = new Date(start);
    const monthEnd = new Date(end);

    for (const it of items) {
      const s = new Date(it.startDate);
      const e = new Date(it.endDate);
      // clamp to this month
      const curStart = s < monthStart ? monthStart : s;
      const curEnd = e > monthEnd ? monthEnd : e;
      if (curEnd < monthStart || curStart > monthEnd) continue;

      const title = `${it.user?.fullName || 'Employé'} · ${it.type?.label || 'Congé'}`;

      const d = new Date(curStart);
      while (d <= curEnd) {
        const key = fmtYmd(d);
        const arr = map.get(key) || [];
        arr.push(title);
        map.set(key, arr);
        d.setDate(d.getDate() + 1);
      }
    }
    return map;
  }
}
