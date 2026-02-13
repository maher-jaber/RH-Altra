import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { AdvanceService } from '../../core/api/advance.service';
import { AuthService } from '../../core/auth.service';
import { AlertService } from '../../core/ui/alert.service';
import { AdvanceRequest } from '../../core/models';

type PageMeta = { page: number; limit: number; total: number; pages: number };

@Component({
  standalone: true,
  selector: 'app-advances-page',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
  <div class="container-fluid p-0">

    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div>
        <h3 class="mb-0">Avances / Acomptes</h3>
        <div class="text-muted small">Nouvelle demande · Mes demandes · À valider</div>
      </div>

      <div class="d-flex gap-2">
        <button class="btn btn-outline-secondary btn-sm" (click)="reloadAll()" [disabled]="loading()">
          <i class="bi bi-arrow-clockwise"></i> Rafraîchir
        </button>
      </div>
    </div>

    <ul class="nav nav-tabs mb-3">
      <li class="nav-item"><button class="nav-link" [class.active]="tab()==='new'" (click)="tab.set('new')">Nouvelle demande</button></li>
      <li class="nav-item"><button class="nav-link" [class.active]="tab()==='my'" (click)="tab.set('my'); loadMy(1)">Mes demandes</button></li>
      <li class="nav-item" *ngIf="canValidate()"><button class="nav-link" [class.active]="tab()==='pending'" (click)="tab.set('pending'); loadPending(1)">À valider</button></li>
    </ul>

    <!-- TAB: NEW -->
    <div *ngIf="tab()==='new'" class="card shadow-sm border-0">
      <div class="card-header bg-transparent border-0 pb-0">
        <div class="d-flex align-items-center gap-2">
          <span class="icon-circle bg-primary-subtle text-primary"><i class="bi bi-cash-coin"></i></span>
          <div>
            <h5 class="mb-0">Demande d'avance / acompte</h5>
            <div class="text-muted small">Période: mois actuel uniquement</div>
          </div>
        </div>
      </div>
      <div class="card-body">
        <form [formGroup]="form" (ngSubmit)="submit()" class="vstack gap-3" style="max-width:620px">
          <div>
            <label class="form-label">Mois / Année</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-calendar3"></i></span>
              <input class="form-control" type="month" formControlName="period" [min]="currentPeriod" [max]="currentPeriod" [disabled]="true" />
            </div>
            <div class="form-text">Règle: l'avance se fait uniquement pour le mois actuel ({{currentPeriod}}).</div>
          </div>

          <div>
            <label class="form-label">Montant (DT)</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-currency-dollar"></i></span>
              <input class="form-control" type="number" min="1" formControlName="amount" placeholder="Ex: 200" />
            </div>
            <div class="form-text text-danger" *ngIf="form.controls.amount.touched && form.controls.amount.invalid">
              Montant requis (minimum 1 DT).
            </div>
          </div>

          <div>
            <label class="form-label">Motif</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-chat-left-text"></i></span>
              <input class="form-control" formControlName="reason" placeholder="Ex: Avance sur salaire" />
            </div>
          </div>

          <button class="btn btn-primary btn-lg" type="submit" [disabled]="form.invalid || loading()">
            <span *ngIf="!loading()"><i class="bi bi-send"></i> Envoyer</span>
            <span *ngIf="loading()" class="d-inline-flex align-items-center gap-2">
              <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
              Envoi...
            </span>
          </button>
        </form>
      </div>
    </div>

    <!-- TAB: MY -->
    <div *ngIf="tab()==='my'" class="card shadow-sm border-0">
      <div class="card-header bg-transparent border-0 pb-0">
        <div class="d-flex align-items-center gap-2">
          <span class="icon-circle bg-info-subtle text-info"><i class="bi bi-inbox"></i></span>
          <div>
            <h5 class="mb-0">Mes demandes</h5>
            <div class="text-muted small">Historique + statut</div>
          </div>
        </div>
      </div>
      <div class="card-body">
        <div *ngIf="my().length===0" class="text-muted">Aucune demande.</div>

        <div *ngIf="my().length>0" class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>#</th>
                <th>Montant</th>
                <th>Période</th>
                <th>Motif</th>
                <th>Statut</th>
                <th class="text-end">Date</th>
                <th class="text-end"></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let a of my()">
                <td class="fw-semibold">{{a.id}}</td>
                <td>{{a.amount}} {{a.currency}}</td>
                <td class="text-muted small">{{ formatPeriod(a) }}</td>
                <td class="text-truncate" style="max-width: 280px">{{a.reason || '—'}}</td>
                <td>
                  <span class="badge"
                    [class.text-bg-warning]="a.status==='SUBMITTED'"
                    [class.text-bg-info]="a.status==='MANAGER_APPROVED'"
                    [class.text-bg-success]="a.status==='APPROVED'"
                    [class.text-bg-danger]="a.status==='REJECTED'"
                    [class.text-bg-secondary]="a.status!=='SUBMITTED' && a.status!=='MANAGER_APPROVED' && a.status!=='APPROVED' && a.status!=='REJECTED'">
                    {{a.status}}
                  </span>
                </td>
                <td class="text-end text-muted small">{{a.createdAt | date:'short'}}</td>
                <td class="text-end">
                  <a class="btn btn-sm btn-outline-primary" [routerLink]="['/advances/detail', a.id]">Détail</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="d-flex justify-content-between align-items-center mt-3" *ngIf="myMeta()">
          <div class="text-muted small">Page {{myMeta()!.page}} / {{myMeta()!.pages}} · Total: {{myMeta()!.total}}</div>
          <div class="btn-group">
            <button class="btn btn-outline-secondary btn-sm" (click)="loadMy(myMeta()!.page-1)" [disabled]="myMeta()!.page<=1 || loading()"><i class="bi bi-chevron-left"></i></button>
            <button class="btn btn-outline-secondary btn-sm" (click)="loadMy(myMeta()!.page+1)" [disabled]="myMeta()!.page>=myMeta()!.pages || loading()"><i class="bi bi-chevron-right"></i></button>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB: PENDING -->
    <div *ngIf="tab()==='pending' && canValidate()" class="card shadow-sm border-0">
      <div class="card-header bg-transparent border-0 pb-0">
        <div class="d-flex align-items-center gap-2">
          <span class="icon-circle bg-warning-subtle text-warning"><i class="bi bi-check2-square"></i></span>
          <div>
            <h5 class="mb-0">À valider</h5>
            <div class="text-muted small">Demandes en attente (manager / admin)</div>
          </div>
        </div>
      </div>
      <div class="card-body">
        <div *ngIf="pending().length===0" class="text-muted">Rien à valider.</div>

        <div *ngIf="pending().length>0" class="vstack gap-2">
          <div *ngFor="let a of pending()" class="p-3 rounded-3 border bg-body">
            <div class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
              <div>
                <div class="fw-semibold">#{{a.id}} — {{a.amount}} {{a.currency}}</div>
                <div class="text-muted small">Employé: {{a.user.fullName || a.user.email}}</div>
                <div class="text-muted small">Période: {{ formatPeriod(a) }}</div>
                <div class="small">{{a.reason || '—'}}</div>
              </div>
              <div class="d-flex gap-2">
                <button class="btn btn-outline-danger" (click)="decide(a,'REJECT')"><i class="bi bi-x-circle"></i> Refuser</button>
                <button class="btn btn-primary" (click)="decide(a,'APPROVE')"><i class="bi bi-check-circle"></i> Approuver</button>
              </div>
            </div>
          </div>
        </div>

        <div class="d-flex justify-content-between align-items-center mt-3" *ngIf="pendingMeta()">
          <div class="text-muted small">Page {{pendingMeta()!.page}} / {{pendingMeta()!.pages}} · Total: {{pendingMeta()!.total}}</div>
          <div class="btn-group">
            <button class="btn btn-outline-secondary btn-sm" (click)="loadPending(pendingMeta()!.page-1)" [disabled]="pendingMeta()!.page<=1 || loading()"><i class="bi bi-chevron-left"></i></button>
            <button class="btn btn-outline-secondary btn-sm" (click)="loadPending(pendingMeta()!.page+1)" [disabled]="pendingMeta()!.page>=pendingMeta()!.pages || loading()"><i class="bi bi-chevron-right"></i></button>
          </div>
        </div>

      </div>
    </div>

  </div>
  `
})
export class AdvancesPageComponent implements OnInit {
  tab = signal<'new'|'my'|'pending'>('new');

  my = signal<AdvanceRequest[]>([]);
  pending = signal<AdvanceRequest[]>([]);
  myMeta = signal<PageMeta | null>(null);
  pendingMeta = signal<PageMeta | null>(null);
  loading = signal(false);

  form = new FormGroup({
    period: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    amount: new FormControl<number | null>(null, { nonNullable: false, validators: [Validators.required, Validators.min(1)] }),
    reason: new FormControl<string>('', { nonNullable: true })
  });

  constructor(
    private api: AdvanceService,
    private auth: AuthService,
    private alerts: AlertService,
  ) {}

  currentPeriod = (() => {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    return `${y}-${m}`;
  })();

  ngOnInit(): void {
    this.form.patchValue({ period: this.currentPeriod });
    this.form.controls.period.disable({ emitEvent: false });
    this.loadMy(1);
    if (this.canValidate()) this.loadPending(1);
  }

  canValidate(): boolean {
    return this.auth.hasRole('ROLE_ADMIN') || this.auth.hasRole('ROLE_SUPERIOR');
  }

  private normalizeListResponse(res: any): { items: any[]; meta: PageMeta | null } {
    if (Array.isArray(res)) return { items: res, meta: null };
    if (Array.isArray(res?.items)) return { items: res.items, meta: res.meta ?? null };
    return { items: [], meta: null };
  }

  reloadAll(): void {
    this.loadMy(this.myMeta()?.page || 1);
    if (this.canValidate()) this.loadPending(this.pendingMeta()?.page || 1);
  }

  loadMy(page: number): void {
    if (page < 1) return;
    this.api.my(page, 10).subscribe(res => {
      const { items, meta } = this.normalizeListResponse(res);
      this.my.set(items as AdvanceRequest[]);
      this.myMeta.set(meta);
    });
  }

  loadPending(page: number): void {
    if (page < 1) return;
    this.api.pending(page, 10).subscribe(res => {
      const { items, meta } = this.normalizeListResponse(res);
      this.pending.set(items as AdvanceRequest[]);
      this.pendingMeta.set(meta);
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    const amount = Number(this.form.value.amount);
    const reason = (this.form.value.reason || '').trim();

    const [yy, mm] = this.currentPeriod.split('-');
    const periodYear = Number(yy);
    const periodMonth = Number(mm);

    this.api.create({ amount, reason: reason || null, status: 'SUBMITTED', periodYear, periodMonth }).subscribe({
      next: () => {
        this.alerts.success('Demande envoyée.');
        this.form.patchValue({ amount: null, reason: '' });
        this.loading.set(false);
        this.tab.set('my');
        this.loadMy(1);
        if (this.canValidate()) this.loadPending(1);
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err?.error?.error || err?.error?.message || 'Erreur lors de l’envoi.';
        this.alerts.error(msg);
      }
    });
  }

  decide(a: AdvanceRequest, decision: 'APPROVE' | 'REJECT'): void {
    this.loading.set(true);
    this.api.decide(a.id, decision).subscribe({
      next: () => {
        this.loading.set(false);
        this.alerts.success('Décision enregistrée.');
        this.loadPending(this.pendingMeta()?.page || 1);
      },
      error: () => {
        this.loading.set(false);
        this.alerts.error('Erreur lors de la décision.');
      }
    });
  }

  formatPeriod(a: any): string {
    const y = a.periodYear || new Date(a.createdAt).getFullYear();
    const m = String(a.periodMonth || (new Date(a.createdAt).getMonth() + 1)).padStart(2, '0');
    return `${m}/${y}`;
  }
}
