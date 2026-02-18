import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { ExitPermissionService } from '../../core/api/exit-permission.service';
import { AuthService } from '../../core/auth.service';
import { ExitPermission } from '../../core/models';
import { AlertService } from '../../core/ui/alert.service';
// NOTE: We intentionally use native date/time pickers here.
// In some Docker/remote setups, flatpickr CDN can be blocked, resulting in no calendar.

type PageMeta = { page: number; limit: number; total: number; pages: number };

@Component({
  standalone: true,
  selector: 'app-exit-permissions-page',
  imports: [CommonModule, ReactiveFormsModule],
  template: `
  <div class="container">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div>
        <h2 class="m-0">Autorisation de sortie</h2>
        <div class="muted">Onglets : nouvelle demande · mes demandes · à valider.</div>
      </div>
    </div>

    <ul class="nav nav-tabs mb-3">
      <li class="nav-item"><button class="nav-link" [class.active]="tab()==='new'" (click)="tab.set('new')">Nouvelle demande</button></li>
      <li class="nav-item"><button class="nav-link" [class.active]="tab()==='my'" (click)="tab.set('my'); reloadMy()">Mes demandes</button></li>
      <li class="nav-item" *ngIf="canValidate()"><button class="nav-link" [class.active]="tab()==='pending'" (click)="tab.set('pending'); reloadPending()">À valider</button></li>
    </ul>

    <!-- NEW -->
    <div *ngIf="tab()==='new'" class="form-card anim-fadeUp">
      <div class="form-card__header">
        <div class="form-section-title">Nouvelle demande</div>
        <div class="muted mt-1">Saisie : <b>date</b> + <b>heure début</b> + <b>heure fin</b>.</div>
      </div>
      <div class="form-card__body">
        <form [formGroup]="form" (ngSubmit)="submit()" class="row g-3" style="max-width: 860px;">
          <div class="col-12 col-md-5">
            <label class="form-label">Date</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-calendar2-week"></i></span>
              <input type="date" class="form-control" [attr.min]="minDate" formControlName="date" />
            </div>
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label">Heure début</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-clock"></i></span>
              <input type="time" class="form-control" formControlName="startTime" />
            </div>
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label">Heure fin</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-clock"></i></span>
              <input type="time" class="form-control" formControlName="endTime" />
            </div>
          </div>

          <div class="col-12" *ngIf="timeInvalid()">
            <div class="alert alert-warning py-2 mb-0">
              <i class="bi bi-exclamation-triangle me-1"></i>
              Heure fin doit être <b>après</b> heure début.
            </div>
          </div>

          <div class="col-12">
            <label class="form-label">Motif (optionnel)</label>
            <textarea class="form-control" rows="2" placeholder="Ex: rendez-vous, urgence, démarche..." formControlName="reason"></textarea>
          </div>

          <div class="col-12 d-flex gap-2">
            <button class="btn btn-primary" [disabled]="form.invalid || loading()">
              <i class="bi bi-send me-1"></i>Envoyer
            </button>
            <button type="button" class="btn btn-outline-primary" (click)="resetForm()">
              <i class="bi bi-eraser me-1"></i>Vider
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MY -->
    <div *ngIf="tab()==='my'" class="form-card">
      <div class="form-card__header d-flex align-items-center justify-content-between gap-2">
        <div>
          <div class="form-section-title">Historique</div>
          <h3 class="m-0">Mes demandes</h3>
        </div>
        <button class="btn btn-sm btn-outline-secondary" (click)="reloadMy()" [disabled]="loading()"><i class="bi bi-arrow-clockwise"></i></button>
      </div>
      <div class="form-card__body">
        <div *ngIf="my().length===0" class="muted">Aucune demande.</div>

        <div class="table-responsive" *ngIf="my().length>0">
          <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>#</th>
                <th>Période</th>
                <th>Motif</th>
                <th>Statut</th>
                <th class="text-end">Créé</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let e of my()">
                <td class="fw-semibold">{{e.id}}</td>
                <td>{{e.startAt | date:'short'}} → {{e.endAt | date:'short'}}</td>
                <td class="text-truncate" style="max-width: 320px">{{e.reason || '—'}}</td>
                <td>
                  <span class="badge" [class.text-bg-warning]="e.status==='SUBMITTED' || e.status==='MANAGER_APPROVED'" [class.text-bg-success]="e.status==='APPROVED'" [class.text-bg-danger]="e.status==='REJECTED'" [class.text-bg-secondary]="e.status!=='SUBMITTED' && e.status!=='MANAGER_APPROVED' && e.status!=='APPROVED' && e.status!=='REJECTED'">
                    {{ statusLabel(e.status) }}
                  </span>
                </td>
                <td class="text-end text-muted small">{{e.createdAt | date:'short'}}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <nav class="mt-3" *ngIf="myMeta().pages>1">
          <ul class="pagination pagination-sm mb-0">
            <li class="page-item" [class.disabled]="myMeta().page<=1"><button class="page-link" (click)="goMy(myMeta().page-1)">Préc</button></li>
            <li class="page-item disabled"><span class="page-link">{{myMeta().page}} / {{myMeta().pages}}</span></li>
            <li class="page-item" [class.disabled]="myMeta().page>=myMeta().pages"><button class="page-link" (click)="goMy(myMeta().page+1)">Suiv</button></li>
          </ul>
        </nav>
      </div>
    </div>

    <!-- PENDING -->
    <div *ngIf="tab()==='pending' && canValidate()" class="form-card">
      <div class="form-card__header d-flex align-items-center justify-content-between gap-2">
        <div>
          <div class="form-section-title">Manager</div>
          <h3 class="m-0">À valider</h3>
        </div>
        <button class="btn btn-sm btn-outline-secondary" (click)="reloadPending()" [disabled]="loading()"><i class="bi bi-arrow-clockwise"></i></button>
      </div>
      <div class="form-card__body">
        <div *ngIf="pending().length===0" class="muted">Rien à valider.</div>

        <div class="table-responsive" *ngIf="pending().length>0">
          <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>#</th>
                <th>Employé</th>
                <th>Période</th>
                <th>Motif</th>
                <th>Statut</th>
                <th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let e of pending()">
                <td class="fw-semibold">{{e.id}}</td>
                <td>{{e.user.fullName || e.user.email}}</td>
                <td>{{e.startAt | date:'short'}} → {{e.endAt | date:'short'}}</td>
                <td class="text-truncate" style="max-width: 280px">{{e.reason || '—'}}</td>
                <td><span class="badge text-bg-warning">{{ statusLabel(e.status) }}</span></td>
                <td class="text-end">
                  <button class="btn btn-sm btn-outline-danger me-2" type="button" (click)="decide(e,'REJECT')"><i class="bi bi-x-circle"></i></button>
                  <button class="btn btn-sm btn-primary" type="button" (click)="decide(e,'APPROVE')"><i class="bi bi-check-circle"></i></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <nav class="mt-3" *ngIf="pendingMeta().pages>1">
          <ul class="pagination pagination-sm mb-0">
            <li class="page-item" [class.disabled]="pendingMeta().page<=1"><button class="page-link" (click)="goPending(pendingMeta().page-1)">Préc</button></li>
            <li class="page-item disabled"><span class="page-link">{{pendingMeta().page}} / {{pendingMeta().pages}}</span></li>
            <li class="page-item" [class.disabled]="pendingMeta().page>=pendingMeta().pages"><button class="page-link" (click)="goPending(pendingMeta().page+1)">Suiv</button></li>
          </ul>
        </nav>
      </div>
    </div>

  </div>
  `
})
export class ExitPermissionsPageComponent implements OnInit {
  tab = signal<'new'|'my'|'pending'>('new');

  my = signal<ExitPermission[]>([]);
  pending = signal<ExitPermission[]>([]);
  myMeta = signal<PageMeta>({ page: 1, limit: 10, total: 0, pages: 1 });
  pendingMeta = signal<PageMeta>({ page: 1, limit: 10, total: 0, pages: 1 });
  loading = signal(false);

  minDate = new Date().toISOString().slice(0, 10);

  timeOptions = (() => {
    const out: string[] = [];
    for (let h = 0; h < 24; h++) {
      for (let m of [0, 15, 30, 45]) {
        out.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
      }
    }
    return out;
  })();

  form = new FormGroup({
    date: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    startTime: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    endTime: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    reason: new FormControl<string>('', { nonNullable: true })
  });

  constructor(
    private api: ExitPermissionService,
    private auth: AuthService,
    private alerts: AlertService,
  ) {}

  ngOnInit(): void {
    this.reloadMy();
    if (this.canValidate()) this.reloadPending();
  }

  canValidate(): boolean {
    return this.auth.hasRole('ROLE_ADMIN') || this.auth.isManager();
  }

  resetForm(): void {
    this.form.reset({ date: '', startTime: '', endTime: '', reason: '' });
  }

  private normalizeListResponse(res: any): { items: ExitPermission[]; meta: PageMeta } {
    if (Array.isArray(res)) {
      return { items: res, meta: { page: 1, limit: res.length || 10, total: res.length, pages: 1 } };
    }
    const items = Array.isArray(res?.items) ? res.items : (Array.isArray(res?.data) ? res.data : []);
    const meta = res?.meta ? res.meta : { page: 1, limit: items.length || 10, total: items.length, pages: 1 };
    return { items, meta };
  }

  reloadMy(page = this.myMeta().page): void {
    this.api.my(page, this.myMeta().limit).subscribe(res => {
      const norm = this.normalizeListResponse(res);
      this.my.set(norm.items);
      this.myMeta.set({ ...this.myMeta(), ...norm.meta });
    });
  }

  reloadPending(page = this.pendingMeta().page): void {
    if (!this.canValidate()) { this.pending.set([]); return; }
    this.api.pending(page, this.pendingMeta().limit).subscribe(res => {
      const norm = this.normalizeListResponse(res);
      this.pending.set(norm.items);
      this.pendingMeta.set({ ...this.pendingMeta(), ...norm.meta });
    });
  }

  goMy(page: number): void {
    if (page < 1 || page > this.myMeta().pages) return;
    this.myMeta.set({ ...this.myMeta(), page });
    this.reloadMy(page);
  }

  goPending(page: number): void {
    if (page < 1 || page > this.pendingMeta().pages) return;
    this.pendingMeta.set({ ...this.pendingMeta(), page });
    this.reloadPending(page);
  }

  timeInvalid(): boolean {
    const date = this.form.value.date as string;
    const s = this.form.value.startTime as string;
    const e = this.form.value.endTime as string;
    if (!date || !s || !e) return false;
    const startAt = new Date(`${date}T${s}:00`);
    const endAt = new Date(`${date}T${e}:00`);
    return !(endAt.getTime() > startAt.getTime());
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    const date = this.form.value.date as string;
    const startTime = this.form.value.startTime as string;
    const endTime = this.form.value.endTime as string;
    const reason = (this.form.value.reason || '').trim();

    const startAt = new Date(`${date}T${startTime}:00`);
    const endAt = new Date(`${date}T${endTime}:00`);

    if (!(endAt.getTime() > startAt.getTime())) {
      this.loading.set(false);
      this.alerts.error('Heure fin doit être après heure début.');
      return;
    }

    this.api.create({ startAt: startAt.toISOString(), endAt: endAt.toISOString(), reason }).subscribe({
      next: () => {
        this.alerts.success('Demande envoyée.');
        this.resetForm();
        this.reloadMy(1);
        this.tab.set('my');
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.alerts.error(err?.error?.error || err?.error?.message || 'Erreur lors de l\'envoi.');
      }
    });
  }

  decide(e: ExitPermission, decision: 'APPROVE' | 'REJECT'): void {
    this.api.decide(e.id, decision).subscribe({
      next: () => {
        this.alerts.success('Décision enregistrée.');
        this.reloadPending();
      },
      error: () => this.alerts.error('Erreur. Impossible d\'enregistrer la décision.')
    });
  }

statusLabel(status: string): string {
    const map: Record<string,string> = {
      SUBMITTED: 'Soumise',
      MANAGER_APPROVED: 'Validée (Manager 1)',
      APPROVED: 'Validée',
      REJECTED: 'Refusée',
      CANCELLED: 'Annulée',
      DRAFT: 'Brouillon',
    };
    return map[status] ?? status;
  }
}
