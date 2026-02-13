import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { HrPeopleHubService, HrEmployee, HrCalendarEvent } from '../../core/api/hr-people-hub.service';

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
  selector: 'app-people-hub',
  imports: [CommonModule, FormsModule],
  styles: [`
    .muted{opacity:.75;font-size:12px}
    .cardx{border-radius:18px}
    .pill{border:1px solid var(--stroke); background: var(--surface); border-radius:999px; padding:6px 10px;}
    .grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}
    .dow{font-size:12px;opacity:.7;padding:0 6px}
    .cell{border:1px solid #eee;border-radius:14px;padding:8px;min-height:118px;background:#fff}
    .cell.out{background:#fafafa;opacity:.75}
    .day{font-size:12px;opacity:.75;display:flex;justify-content:flex-end}
    .evt{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12px;white-space:nowrap;overflow:hidden}
    .dot{width:8px;height:8px;border-radius:999px;flex:0 0 auto}
    .more{margin-top:6px;font-size:12px;opacity:.65}
    .kpi{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid #eee;border-radius:16px;background:#fff}
    .kpi .label{font-size:12px;opacity:.7}
    .kpi .value{font-weight:900;font-size:18px}
    .table thead th{font-size:12px;opacity:.7}
    .badge-soft{border:1px solid #eee;background:#fff}
  `],
  template: `
  <div class="d-flex flex-wrap align-items-end justify-content:space-between gap-2 mb-3">
    <div>
      <h2 class="mb-1">Vue 360° · Employés</h2>
      <div class="muted">Admin / RH · Congés + sorties + avances + compte-rendu, avec calendrier global.</div>
    </div>

    <div class="d-flex flex-wrap gap-2 align-items-center">
      <div class="pill d-flex align-items-center gap-2">
        <i class="bi bi-search"></i>
        <input class="form-control form-control-sm" style="border:0; background:transparent; min-width: 220px" placeholder="Rechercher un employé..." [(ngModel)]="employeeSearch" (ngModelChange)="loadEmployees()" />
      </div>
      <select class="form-select form-select-sm" style="min-width:260px" [(ngModel)]="selectedEmployeeId" (change)="onEmployeeChange()">
        <option [ngValue]="null">Tous les employés</option>
        <option *ngFor="let e of employees()" [ngValue]="e.id">{{e.fullName || e.email}}{{e.department?.name ? (' · ' + e.department?.name) : ''}}</option>
      </select>
    </div>
  </div>

  <div class="row g-3 mb-3">
    <div class="col-12 col-md-4">
      <div class="kpi">
        <div>
          <div class="label">Période (mois / année)</div>
          <div class="d-flex align-items-center gap-2">
            <input class="form-control form-control-sm" type="month" style="max-width:180px" [ngModel]="monthInput()" (ngModelChange)="setMonthFromInput($event)" />
            <div class="value" style="text-transform:capitalize">{{monthTitle()}}</div>
          </div>
        </div>
        <div class="d-flex gap-1">
          <button class="btn btn-sm btn-outline-secondary" (click)="prevMonth()"><i class="bi bi-chevron-left"></i></button>
          <button class="btn btn-sm btn-outline-secondary" (click)="nextMonth()"><i class="bi bi-chevron-right"></i></button>
        </div>
      </div>
    </div>
    <div class="col-12 col-md-8">
      <div class="d-flex flex-wrap gap-2 align-items-center justify-content-end">
        <label class="form-check form-switch m-0">
          <input class="form-check-input" type="checkbox" [(ngModel)]="showLeaves" (change)="reloadAll()">
          <span class="form-check-label">Congés</span>
        </label>
        <label class="form-check form-switch m-0">
          <input class="form-check-input" type="checkbox" [(ngModel)]="showExits" (change)="reloadAll()">
          <span class="form-check-label">Sorties</span>
        </label>
        <label class="form-check form-switch m-0">
          <input class="form-check-input" type="checkbox" [(ngModel)]="showAdvances" (change)="reloadAll()">
          <span class="form-check-label">Avances</span>
        </label>
        <label class="form-check form-switch m-0">
          <input class="form-check-input" type="checkbox" [(ngModel)]="showReports" (change)="reloadAll()">
          <span class="form-check-label">CR</span>
        </label>
      </div>
    </div>
  </div>

  <ul class="nav nav-tabs">
    <li class="nav-item"><button class="nav-link" [class.active]="tab() === 'calendar'" (click)="tab.set('calendar')">Calendrier global</button></li>
    <li class="nav-item"><button class="nav-link" [class.active]="tab() === 'leaves'" (click)="tab.set('leaves')">Congés</button></li>
    <li class="nav-item"><button class="nav-link" [class.active]="tab() === 'advances'" (click)="tab.set('advances')">Avances</button></li>
    <li class="nav-item"><button class="nav-link" [class.active]="tab() === 'exits'" (click)="tab.set('exits')">Sorties</button></li>
    <li class="nav-item"><button class="nav-link" [class.active]="tab() === 'reports'" (click)="tab.set('reports')">Compte-rendu</button></li>
  </ul>

  <div class="card border-0 shadow-sm cardx">
    <div class="card-body">
      <!-- CALENDAR -->
      <div *ngIf="tab() === 'calendar'">
        <div class="grid">
          <div class="dow" *ngFor="let d of dows">{{d}}</div>
          <ng-container *ngFor="let c of cells()">
            <div class="cell" [class.out]="c.out">
              <div class="day">{{c.day}}</div>

              <div class="evt" *ngFor="let e of c.events; let i=index" [title]="e.title">
                <span class="dot" [style.background]="e.color"></span>
                <span class="text-truncate">{{e.title}}</span>
              </div>
              <div class="more" *ngIf="c.more > 0">+{{c.more}} autres</div>
            </div>
          </ng-container>
        </div>
        <div class="muted mt-2" *ngIf="loadingCalendar()">Chargement calendrier...</div>
      </div>

      <!-- LEAVES -->
      <div *ngIf="tab() === 'leaves'">
        <div class="d-flex flex-wrap gap-2 align-items-center justify-content:space-between mb-2">
          <div class="muted">Liste des congés sur la période (filtrable).</div>
          <select class="form-select form-select-sm" style="max-width: 220px" [(ngModel)]="leaveStatus" (change)="reloadLeaves()">
            <option [ngValue]="''">Tous statuts</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="MANAGER_APPROVED">MANAGER_APPROVED</option>
            <option value="HR_APPROVED">HR_APPROVED</option>
            <option value="RH_APPROVED">RH_APPROVED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>

        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <thead>
              <tr>
                <th>Employé</th>
                <th>Département</th>
                <th>Type</th>
                <th>Période</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let it of leavesItems()">
                <td><b>{{it.user?.fullName || it.user?.email}}</b><div class="muted">#{{it.id}}</div></td>
                <td>{{it.user?.department?.name || '-'}}</td>
                <td>{{it.typeLabel || it.type || '-'}}</td>
                <td>{{it.startDate}} → {{it.endDate}}</td>
                <td><span class="badge badge-soft">{{it.status}}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="muted" *ngIf="loadingLeaves()">Chargement congés...</div>
      </div>

      <!-- ADVANCES -->
      <div *ngIf="tab() === 'advances'">
        <div class="muted mb-2">Liste des avances / acomptes sur la période.</div>
        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <thead>
              <tr>
                <th>Employé</th>
                <th>Département</th>
                <th>Montant</th>
                <th>Période</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let it of advancesItems()">
                <td><b>{{it.user?.fullName || it.user?.email}}</b><div class="muted">#{{it.id}}</div></td>
                <td>{{it.user?.department?.name || '-'}}</td>
                <td><b>{{it.amount}}</b> {{it.currency}}</td>
                <td>{{it.periodYear}}/{{it.periodMonth}}</td>
                <td><span class="badge badge-soft">{{it.status}}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="muted" *ngIf="loadingAdvances()">Chargement avances...</div>
      </div>

      <!-- EXITS -->
      <div *ngIf="tab() === 'exits'">
        <div class="muted mb-2">Liste des autorisations de sortie sur la période.</div>
        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <thead>
              <tr>
                <th>Employé</th>
                <th>Département</th>
                <th>Début</th>
                <th>Fin</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let it of exitsItems()">
                <td><b>{{it.user?.fullName || it.user?.email}}</b><div class="muted">#{{it.id}}</div></td>
                <td>{{it.user?.department?.name || '-'}}</td>
                <td>{{it.startAt}}</td>
                <td>{{it.endAt}}</td>
                <td><span class="badge badge-soft">{{it.status}}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="muted" *ngIf="loadingExits()">Chargement sorties...</div>
      </div>

      <!-- REPORTS -->
      <div *ngIf="tab() === 'reports'">
        <div class="muted mb-2">Compte-rendu journalier (optionnel).</div>
        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <thead>
              <tr>
                <th>Employé</th>
                <th>Département</th>
                <th>Date</th>
                <th>Heures</th>
                <th>Résumé</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let it of reportsItems()">
                <td><b>{{it.user?.fullName || it.user?.email}}</b><div class="muted">#{{it.id}}</div></td>
                <td>{{it.user?.department?.name || '-'}}</td>
                <td>{{it.date}}</td>
                <td>{{it.hours}}</td>
                <td class="text-truncate" style="max-width: 520px">{{it.summary || it.content || ''}}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="muted" *ngIf="loadingReports()">Chargement compte-rendu...</div>
      </div>
    </div>
  </div>
  `
})
export class PeopleHubPage implements OnInit {
  dows = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  employeeSearch = '';
  employees = signal<HrEmployee[]>([]);
  selectedEmployeeId: number | null = null;

  tab = signal<'calendar' | 'leaves' | 'advances' | 'exits' | 'reports'>('calendar');

  // calendar
  month = signal<Date>(startOfMonth(new Date()));

  monthInput = computed(() => {
    const d = this.month();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${m}`;
  });
  calendarEvents = signal<HrCalendarEvent[]>([]);
  loadingCalendar = signal(false);

  // filters
  showLeaves = true;
  showExits = true;
  showAdvances = true;
  showReports = false;

  // lists
  leaveStatus: string = '';
  leavesItems = signal<any[]>([]);
  advancesItems = signal<any[]>([]);
  exitsItems = signal<any[]>([]);
  reportsItems = signal<any[]>([]);
  loadingLeaves = signal(false);
  loadingAdvances = signal(false);
  loadingExits = signal(false);
  loadingReports = signal(false);

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

  cells = computed(() => {
    const { start, end } = this.monthRange();
    const startDow = (start.getDay() + 6) % 7; // Monday=0
    const gridStart = new Date(start);
    gridStart.setDate(start.getDate() - startDow);

    const map = this.indexEvents();
    const out: Array<{ date: Date; key: string; day: number; out: boolean; events: { title: string; color: string }[]; more: number }> = [];

    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      const key = fmtYmd(d);
      const inMonth = d.getMonth() === start.getMonth();
      const all = map.get(key) ?? [];
      const events = all.slice(0, 3);
      const more = Math.max(0, all.length - events.length);
      out.push({ date: d, key, day: d.getDate(), out: !inMonth, events, more });
    }
    return out;
  });

  constructor(private api: HrPeopleHubService) {}

  async ngOnInit(): Promise<void> {
    await this.loadEmployees();
    await this.reloadAll();
  }

  async loadEmployees(): Promise<void> {
    try {
      const res = await this.api.employees(this.employeeSearch || undefined).toPromise();
      this.employees.set(res?.items || []);
    } catch {
      this.employees.set([]);
    }
  }

  async onEmployeeChange(): Promise<void> {
    await this.reloadAll();
  }

  prevMonth(): void { this.month.set(addMonths(this.month(), -1)); this.reloadAll(); }
  nextMonth(): void { this.month.set(addMonths(this.month(), 1)); this.reloadAll(); }

  setMonthFromInput(value: string): void {
    if (!value) return;
    const [y, m] = value.split('-').map(v => Number(v));
    if (!y || !m) return;
    this.month.set(new Date(y, m - 1, 1));
    this.reloadAll();
  }

  async reloadAll(): Promise<void> {
    await Promise.all([
      this.reloadCalendar(),
      this.reloadLeaves(),
      this.reloadAdvances(),
      this.reloadExits(),
      this.reloadReports(),
    ]);
  }

  async reloadCalendar(): Promise<void> {
    const { start, end } = this.monthRange();
    this.loadingCalendar.set(true);
    try {
      const res = await this.api.calendar(fmtYmd(start), fmtYmd(end), this.selectedEmployeeId || undefined).toPromise();
      this.calendarEvents.set(res?.items || []);
    } finally {
      this.loadingCalendar.set(false);
    }
  }

  async reloadLeaves(): Promise<void> {
    if (!this.showLeaves) { this.leavesItems.set([]); return; }
    const { start, end } = this.monthRange();
    this.loadingLeaves.set(true);
    try {
      const res = await this.api.leaves({ from: fmtYmd(start), to: fmtYmd(end), status: this.leaveStatus || undefined, userId: this.selectedEmployeeId || undefined, page: 1, limit: 300 }).toPromise();
      this.leavesItems.set(res?.items || []);
    } finally {
      this.loadingLeaves.set(false);
    }
  }

  async reloadAdvances(): Promise<void> {
    if (!this.showAdvances) { this.advancesItems.set([]); return; }
    const { start, end } = this.monthRange();
    this.loadingAdvances.set(true);
    try {
      const res = await this.api.advances({ from: fmtYmd(start), to: fmtYmd(end), userId: this.selectedEmployeeId || undefined, page: 1, limit: 300 }).toPromise();
      this.advancesItems.set(res?.items || []);
    } finally {
      this.loadingAdvances.set(false);
    }
  }

  async reloadExits(): Promise<void> {
    if (!this.showExits) { this.exitsItems.set([]); return; }
    const { start, end } = this.monthRange();
    this.loadingExits.set(true);
    try {
      const res = await this.api.exits({ from: fmtYmd(start), to: fmtYmd(end), userId: this.selectedEmployeeId || undefined, page: 1, limit: 300 }).toPromise();
      this.exitsItems.set(res?.items || []);
    } finally {
      this.loadingExits.set(false);
    }
  }

  async reloadReports(): Promise<void> {
    if (!this.showReports) { this.reportsItems.set([]); return; }
    const { start, end } = this.monthRange();
    this.loadingReports.set(true);
    try {
      const res = await this.api.reports({ from: fmtYmd(start), to: fmtYmd(end), userId: this.selectedEmployeeId || undefined, page: 1, limit: 300 }).toPromise();
      this.reportsItems.set(res?.items || []);
    } finally {
      this.loadingReports.set(false);
    }
  }

  private indexEvents(): Map<string, { title: string; color: string }[]> {
    const { start, end } = this.monthRange();
    const items = this.calendarEvents();
    const map = new Map<string, { title: string; color: string }[]>();

    const monthStart = new Date(start);
    const monthEnd = new Date(end);

    const kindColor = (k: string) => {
      if (k === 'LEAVE') return '#0d6efd';
      if (k === 'EXIT') return '#198754';
      if (k === 'ADVANCE') return '#fd7e14';
      return '#6f42c1';
    };

    for (const it of items) {
      const s = new Date(it.start);
      const e = new Date(it.end);
      const curStart = s < monthStart ? monthStart : s;
      const curEnd = e > monthEnd ? monthEnd : e;
      if (curEnd < monthStart || curStart > monthEnd) continue;

      const title = it.title;
      const color = kindColor(it.kind);

      const d = new Date(curStart);
      // If it contains time, normalize to date increments.
      d.setHours(0,0,0,0);
      const endDate = new Date(curEnd);
      endDate.setHours(0,0,0,0);

      while (d <= endDate) {
        const key = fmtYmd(d);
        const arr = map.get(key) || [];
        arr.push({ title, color });
        map.set(key, arr);
        d.setDate(d.getDate() + 1);
      }
    }
    return map;
  }
}
