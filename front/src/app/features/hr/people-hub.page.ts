import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { HrPeopleHubService, HrEmployee, HrCalendarEvent } from '../../core/api/hr-people-hub.service';

type CalendarUiEvent = {
  title: string;
  color: string;
  kind: HrCalendarEvent['kind'];
  status?: string;
  entityId?: number;
  start?: string;
  end?: string;
  userLabel?: string;
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
  selector: 'app-people-hub',
  imports: [CommonModule, FormsModule],
  styles: [`
    .muted{opacity:.75;font-size:12px}
    .cardx{border-radius:18px}
    .pill{border:1px solid var(--stroke); background: var(--surface); border-radius:999px; padding:6px 10px;}
    .grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}
    .dow{font-size:12px;opacity:.7;padding:0 6px}
    .cell{border:1px solid #eee;border-radius:14px;padding:8px;min-height:118px;background:#fff}
    .cell.clickable{cursor:pointer}
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

    /* Day modal (clean overlay) */
    .day-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.42);backdrop-filter: blur(2px);z-index:1050}
    .day-modal{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;z-index:1060}
    .day-modal-card{background:#fff;border-radius:18px;width:min(720px,92vw);max-height:80vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.18);border:1px solid rgba(0,0,0,.06)}
    .day-modal-header{position:sticky;top:0;background:#fff;border-bottom:1px solid #eee;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-top-left-radius:18px;border-top-right-radius:18px}
    .day-modal-title{font-weight:800;font-size:16px;margin:0}
    .day-modal-body{padding:14px 16px;overflow:auto}
    .day-modal-footer{border-top:1px solid #eee;padding:12px 16px;display:flex;justify-content:flex-end;gap:10px;border-bottom-left-radius:18px;border-bottom-right-radius:18px}
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
            <div class="cell" [class.out]="c.out" [class.clickable]="c.allEvents.length>0" (click)="openDayModal(c)">
              <div class="day">{{c.day}}</div>

              <div class="evt" *ngFor="let e of c.events; let i=index" [title]="e.title">
                <span class="dot" [style.background]="e.color"></span>
                <span class="text-truncate">{{e.title}}</span>
              </div>
              <button type="button" class="btn btn-link p-0 more" *ngIf="c.more > 0" (click)="$event.stopPropagation(); openDayModal(c)">+{{c.more}} autres</button>
            </div>
          </ng-container>
        </div>
        <div class="muted mt-2" *ngIf="loadingCalendar()">Chargement calendrier...</div>
      </div>

      <!-- Day details modal (calendar) -->
      <div *ngIf="dayModalOpen()">
        <div class="day-backdrop" (click)="closeDayModal()"></div>

        <div class="day-modal" (click)="closeDayModal()">
          <div class="day-modal-card" (click)="$event.stopPropagation()">
            <div class="day-modal-header">
              <h5 class="day-modal-title">{{dayModalDateLabel()}}</h5>
              <button type="button" class="btn btn-sm btn-light" (click)="closeDayModal()" aria-label="Fermer">
                <i class="bi bi-x-lg"></i>
              </button>
            </div>

            <div class="day-modal-body">
              <div class="muted mb-2">{{dayModalEvents().length}} événement(s)</div>

              <div class="list-group">
                <div class="list-group-item d-flex align-items-start justify-content-between gap-2" *ngFor="let e of dayModalEvents()">
                  <div class="d-flex align-items-start gap-2">
                    <span class="dot" [style.background]="e.color" style="margin-top:6px"></span>
                    <div>
                      <div class="d-flex flex-wrap align-items-center gap-2">
                        <b>{{e.title}}</b>
                        <span class="badge bg-light text-dark" style="border:1px solid #eee">{{e.kind}}</span>
                        <span *ngIf="e.status" class="badge bg-secondary">{{statusLabel(e.status)}}</span>
                        <span *ngIf="e.userLabel" class="badge badge-soft text-dark">{{e.userLabel}}</span>
                      </div>
                      <div class="muted mt-1" *ngIf="e.start || e.end">
                        <span *ngIf="e.start">Du {{e.start}}</span>
                        <span *ngIf="e.end"> au {{e.end}}</span>
                      </div>
                    </div>
                  </div>

                  <span *ngIf="e.entityId" class="badge bg-light text-dark" style="border:1px solid #eee">#{{e.entityId}}</span>
                </div>
              </div>
            </div>

            <div class="day-modal-footer">
              <button type="button" class="btn btn-outline-secondary" (click)="closeDayModal()">Fermer</button>
            </div>
          </div>
        </div>
      </div>

<!-- LEAVES -->
      <div *ngIf="tab() === 'leaves'">
        <div class="d-flex flex-wrap gap-2 align-items-center justify-content:space-between mb-2">
          <div class="muted">Liste des congés sur la période (filtrable).</div>
          <div class="d-flex align-items-center gap-2">
            <select class="form-select form-select-sm" style="max-width: 220px" [(ngModel)]="leaveStatus" (change)="reloadLeaves(0)">
              <option [ngValue]="''">Tous statuts</option>
              <option value="SUBMITTED">Soumis</option>
              <option value="MANAGER_APPROVED">Approuvé (Manager)</option>
              <option value="HR_APPROVED">Approuvé (RH)</option>
              <option value="RH_APPROVED">Approuvé (RH)</option>
              <option value="REJECTED">Refusé</option>
              <option value="CANCELLED">Annulé</option>
            </select>

            <select class="form-select form-select-sm" style="width:110px" [ngModel]="leavesPageSize()" (ngModelChange)="setLeavesPageSize($event)">
              <option [ngValue]="10">10</option><option [ngValue]="25">25</option><option [ngValue]="50">50</option><option [ngValue]="100">100</option>
            </select>
            <button class="btn btn-outline-secondary btn-sm" (click)="leavesPrev()" [disabled]="leavesPageIndex()===0">Précédent</button>
            <button class="btn btn-outline-secondary btn-sm" (click)="leavesNext()" [disabled]="(leavesPageIndex()+1)*leavesPageSize()>=leavesTotal()">Suivant</button>
            <div class="muted">Total: {{leavesTotal()}}</div>
          </div>
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
                <td><span class="badge badge-soft">{{statusLabel(it.status)}}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="muted" *ngIf="loadingLeaves()">Chargement congés...</div>
      </div>

      <!-- ADVANCES -->
      <div *ngIf="tab() === 'advances'">
        <div class="d-flex flex-wrap gap-2 align-items-center justify-content:space-between mb-2">
          <div class="muted">Liste des avances / acomptes sur la période.</div>
          <div class="d-flex align-items-center gap-2">
            <select class="form-select form-select-sm" style="width:110px" [ngModel]="advPageSize()" (ngModelChange)="setAdvPageSize($event)">
              <option [ngValue]="10">10</option><option [ngValue]="25">25</option><option [ngValue]="50">50</option><option [ngValue]="100">100</option>
            </select>
            <button class="btn btn-outline-secondary btn-sm" (click)="advPrev()" [disabled]="advPageIndex()===0">Précédent</button>
            <button class="btn btn-outline-secondary btn-sm" (click)="advNext()" [disabled]="(advPageIndex()+1)*advPageSize()>=advTotal()">Suivant</button>
            <div class="muted">Total: {{advTotal()}}</div>
          </div>
        </div>
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
                <td><span class="badge badge-soft">{{statusLabel(it.status)}}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="muted" *ngIf="loadingAdvances()">Chargement avances...</div>
      </div>

      <!-- EXITS -->
      <div *ngIf="tab() === 'exits'">
        <div class="d-flex flex-wrap gap-2 align-items-center justify-content:space-between mb-2">
          <div class="muted">Liste des autorisations de sortie sur la période.</div>
          <div class="d-flex align-items-center gap-2">
            <select class="form-select form-select-sm" style="width:110px" [ngModel]="exitPageSize()" (ngModelChange)="setExitPageSize($event)">
              <option [ngValue]="10">10</option><option [ngValue]="25">25</option><option [ngValue]="50">50</option><option [ngValue]="100">100</option>
            </select>
            <button class="btn btn-outline-secondary btn-sm" (click)="exitPrev()" [disabled]="exitPageIndex()===0">Précédent</button>
            <button class="btn btn-outline-secondary btn-sm" (click)="exitNext()" [disabled]="(exitPageIndex()+1)*exitPageSize()>=exitTotal()">Suivant</button>
            <div class="muted">Total: {{exitTotal()}}</div>
          </div>
        </div>
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
                <td><span class="badge badge-soft">{{statusLabel(it.status)}}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="muted" *ngIf="loadingExits()">Chargement sorties...</div>
      </div>

      <!-- REPORTS -->
      <div *ngIf="tab() === 'reports'">
        <div class="d-flex flex-wrap gap-2 align-items-center justify-content:space-between mb-2">
          <div class="muted">Compte-rendu journalier (optionnel).</div>
          <div class="d-flex align-items-center gap-2">
            <select class="form-select form-select-sm" style="width:110px" [ngModel]="repPageSize()" (ngModelChange)="setRepPageSize($event)">
              <option [ngValue]="10">10</option><option [ngValue]="25">25</option><option [ngValue]="50">50</option><option [ngValue]="100">100</option>
            </select>
            <button class="btn btn-outline-secondary btn-sm" (click)="repPrev()" [disabled]="repPageIndex()===0">Précédent</button>
            <button class="btn btn-outline-secondary btn-sm" (click)="repNext()" [disabled]="(repPageIndex()+1)*repPageSize()>=repTotal()">Suivant</button>
            <div class="muted">Total: {{repTotal()}}</div>
          </div>
        </div>
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

  // pagination (hub lists)
  leavesPageIndex = signal(0);
  leavesPageSize = signal(25);
  leavesTotal = signal(0);

  advPageIndex = signal(0);
  advPageSize = signal(25);
  advTotal = signal(0);

  exitPageIndex = signal(0);
  exitPageSize = signal(25);
  exitTotal = signal(0);

  repPageIndex = signal(0);
  repPageSize = signal(25);
  repTotal = signal(0);
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
    const out: Array<{ date: Date; key: string; day: number; out: boolean; events: CalendarUiEvent[]; allEvents: CalendarUiEvent[]; more: number }> = [];

    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      const key = fmtYmd(d);
      const inMonth = d.getMonth() === start.getMonth();
      const allEvents = map.get(key) ?? [];
      const events = allEvents.slice(0, 3);
      const more = Math.max(0, allEvents.length - events.length);
      out.push({ date: d, key, day: d.getDate(), out: !inMonth, events, allEvents, more });
    }
    return out;
  });

  // Day details modal (calendar)
  dayModalOpen = signal(false);
  dayModalKey = signal<string>('');
  dayModalDateLabel = signal<string>('');
  dayModalEvents = signal<CalendarUiEvent[]>([]);

  openDayModal(cell: { date: Date; key: string; allEvents: CalendarUiEvent[] }): void {
    if (!cell?.allEvents?.length) return;
    this.dayModalKey.set(cell.key);
    this.dayModalDateLabel.set(
      cell.date.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    );
    this.dayModalEvents.set(cell.allEvents);
    this.dayModalOpen.set(true);

    // lock page scroll while modal is open
    try { document.body.style.overflow = 'hidden'; } catch {}
  }
  closeDayModal(): void {
    this.dayModalOpen.set(false);

    // restore scroll
    try { document.body.style.overflow = ''; } catch {}
  }

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

  // Fire-and-forget: we don't need to block UI navigation on API calls.
  // Using `void` avoids unhandled-promise warnings in strict TS setups.
  prevMonth(): void { this.month.set(addMonths(this.month(), -1)); void this.reloadAll(); }
  nextMonth(): void { this.month.set(addMonths(this.month(), 1)); void this.reloadAll(); }

  setMonthFromInput(value: string): void {
    if (!value) return;
    const [y, m] = value.split('-').map(v => Number(v));
    if (!y || !m) return;
    this.month.set(new Date(y, m - 1, 1));
    void this.reloadAll();
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

  async reloadLeaves(resetPage?: number): Promise<void> {
    if (resetPage === 0) this.leavesPageIndex.set(0);
    if (!this.showLeaves) { this.leavesItems.set([]); return; }
    const { start, end } = this.monthRange();
    this.loadingLeaves.set(true);
    try {
      const res = await this.api.leaves({
        from: fmtYmd(start),
        to: fmtYmd(end),
        status: this.leaveStatus || undefined,
        userId: this.selectedEmployeeId || undefined,
        page: this.leavesPageIndex() + 1,
        limit: this.leavesPageSize(),
      }).toPromise();
      this.leavesItems.set(res?.items || []);
      this.leavesTotal.set(res?.meta?.total ?? (res?.items?.length || 0));
    } finally {
      this.loadingLeaves.set(false);
    }
  }

  async reloadAdvances(resetPage?: number): Promise<void> {
    if (resetPage === 0) this.advPageIndex.set(0);
    if (!this.showAdvances) { this.advancesItems.set([]); return; }
    const { start, end } = this.monthRange();
    this.loadingAdvances.set(true);
    try {
      const res = await this.api.advances({
        from: fmtYmd(start),
        to: fmtYmd(end),
        userId: this.selectedEmployeeId || undefined,
        page: this.advPageIndex() + 1,
        limit: this.advPageSize(),
      }).toPromise();
      this.advancesItems.set(res?.items || []);
      this.advTotal.set(res?.meta?.total ?? (res?.items?.length || 0));
    } finally {
      this.loadingAdvances.set(false);
    }
  }

  async reloadExits(resetPage?: number): Promise<void> {
    if (resetPage === 0) this.exitPageIndex.set(0);
    if (!this.showExits) { this.exitsItems.set([]); return; }
    const { start, end } = this.monthRange();
    this.loadingExits.set(true);
    try {
      const res = await this.api.exits({
        from: fmtYmd(start),
        to: fmtYmd(end),
        userId: this.selectedEmployeeId || undefined,
        page: this.exitPageIndex() + 1,
        limit: this.exitPageSize(),
      }).toPromise();
      this.exitsItems.set(res?.items || []);
      this.exitTotal.set(res?.meta?.total ?? (res?.items?.length || 0));
    } finally {
      this.loadingExits.set(false);
    }
  }

  async reloadReports(resetPage?: number): Promise<void> {
    if (resetPage === 0) this.repPageIndex.set(0);
    if (!this.showReports) { this.reportsItems.set([]); return; }
    const { start, end } = this.monthRange();
    this.loadingReports.set(true);
    try {
      const res = await this.api.reports({
        from: fmtYmd(start),
        to: fmtYmd(end),
        userId: this.selectedEmployeeId || undefined,
        page: this.repPageIndex() + 1,
        limit: this.repPageSize(),
      }).toPromise();
      this.reportsItems.set(res?.items || []);
      this.repTotal.set(res?.meta?.total ?? (res?.items?.length || 0));
    } finally {
      this.loadingReports.set(false);
    }
  }

  // UI helpers
  statusLabel(v: string): string {
    const s = (v || '').toUpperCase();
    if (s === 'DRAFT') return 'Brouillon';
    if (s === 'SUBMITTED') return 'Soumis';
    if (s === 'MANAGER_APPROVED') return 'Approuvé (Manager)';
    if (s === 'HR_APPROVED' || s === 'RH_APPROVED' || s === 'APPROVED') return 'Approuvé';
    if (s === 'REJECTED') return 'Refusé';
    if (s === 'CANCELLED') return 'Annulé';
    return v || '—';
  }

  // pagination actions
  setLeavesPageSize(v:any){ const n = parseInt(String(v),10) || 25; this.leavesPageSize.set(n); this.reloadLeaves(0); }
  leavesPrev(){ if(this.leavesPageIndex()===0) return; this.leavesPageIndex.set(this.leavesPageIndex()-1); this.reloadLeaves(); }
  leavesNext(){ if((this.leavesPageIndex()+1)*this.leavesPageSize()>=this.leavesTotal()) return; this.leavesPageIndex.set(this.leavesPageIndex()+1); this.reloadLeaves(); }

  setAdvPageSize(v:any){ const n = parseInt(String(v),10) || 25; this.advPageSize.set(n); this.reloadAdvances(0); }
  advPrev(){ if(this.advPageIndex()===0) return; this.advPageIndex.set(this.advPageIndex()-1); this.reloadAdvances(); }
  advNext(){ if((this.advPageIndex()+1)*this.advPageSize()>=this.advTotal()) return; this.advPageIndex.set(this.advPageIndex()+1); this.reloadAdvances(); }

  setExitPageSize(v:any){ const n = parseInt(String(v),10) || 25; this.exitPageSize.set(n); this.reloadExits(0); }
  exitPrev(){ if(this.exitPageIndex()===0) return; this.exitPageIndex.set(this.exitPageIndex()-1); this.reloadExits(); }
  exitNext(){ if((this.exitPageIndex()+1)*this.exitPageSize()>=this.exitTotal()) return; this.exitPageIndex.set(this.exitPageIndex()+1); this.reloadExits(); }

  setRepPageSize(v:any){ const n = parseInt(String(v),10) || 25; this.repPageSize.set(n); this.reloadReports(0); }
  repPrev(){ if(this.repPageIndex()===0) return; this.repPageIndex.set(this.repPageIndex()-1); this.reloadReports(); }
  repNext(){ if((this.repPageIndex()+1)*this.repPageSize()>=this.repTotal()) return; this.repPageIndex.set(this.repPageIndex()+1); this.reloadReports(); }

  private indexEvents(): Map<string, CalendarUiEvent[]> {
    const { start, end } = this.monthRange();
    const items = this.calendarEvents();
    const map = new Map<string, CalendarUiEvent[]>();

    const monthStart = new Date(start);
    const monthEnd = new Date(end);

    const kindColor = (k: string) => {
      if (k === 'LEAVE') return '#0d6efd';
      if (k === 'EXIT') return '#198754';
      if (k === 'ADVANCE') return '#fd7e14';
      return '#6f42c1';
    };

    // Apply UI toggles (filters) for calendar rendering.
    // Note: the /api/hr/calendar endpoint returns all kinds; filtering is done client-side.
    for (const it of items) {
      if (it.kind === 'LEAVE' && !this.showLeaves) continue;
      if (it.kind === 'EXIT' && !this.showExits) continue;
      if (it.kind === 'ADVANCE' && !this.showAdvances) continue;
      if (it.kind === 'REPORT' && !this.showReports) continue;

      const s = new Date(it.start);
      const e = new Date(it.end);
      const curStart = s < monthStart ? monthStart : s;
      const curEnd = e > monthEnd ? monthEnd : e;
      if (curEnd < monthStart || curStart > monthEnd) continue;

      const title = it.title;
      const color = kindColor(it.kind);

      const userLabel = it.user?.fullName || it.user?.email || undefined;

      const d = new Date(curStart);
      // If it contains time, normalize to date increments.
      d.setHours(0,0,0,0);
      const endDate = new Date(curEnd);
      endDate.setHours(0,0,0,0);

      while (d <= endDate) {
        const key = fmtYmd(d);
        const arr = map.get(key) || [];
        arr.push({
          title,
          color,
          kind: it.kind,
          status: it.status,
          entityId: it.entityId,
          start: it.start,
          end: it.end,
          userLabel,
        });
        map.set(key, arr);
        d.setDate(d.getDate() + 1);
      }
    }
    return map;
  }
}
