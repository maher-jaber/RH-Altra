import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { AdvanceService } from '../../core/api/advance.service';
import { AuthService } from '../../core/auth.service';
import { AlertService } from '../../core/ui/alert.service';
import { AdvanceRequest } from '../../core/models';

@Component({
  standalone: true,
  selector: 'app-advances-page',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
  <div class="container-fluid p-0">
    <div class="row g-3">
      <div class="col-12 col-lg-5">
        <div class="card shadow-sm border-0">
          <div class="card-header bg-transparent border-0 pb-0">
            <div class="d-flex align-items-center gap-2">
              <span class="icon-circle bg-primary-subtle text-primary"><i class="bi bi-cash-coin"></i></span>
              <div>
                <h5 class="mb-0">Demande d'avance / acompte</h5>
                <div class="text-muted small">Formulaire simple, lisible et professionnel</div>
              </div>
            </div>
          </div>
          <div class="card-body">
            <form [formGroup]="form" (ngSubmit)="submit()" class="vstack gap-3">
              
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
      </div>

      <div class="col-12 col-lg-7">
        <div class="card shadow-sm border-0">
          <div class="card-header bg-transparent border-0 pb-0">
            <div class="d-flex align-items-center justify-content-between">
              <div class="d-flex align-items-center gap-2">
                <span class="icon-circle bg-info-subtle text-info"><i class="bi bi-inbox"></i></span>
                <div>
                  <h5 class="mb-0">Mes demandes</h5>
                  <div class="text-muted small">Historique + statut</div>
                </div>
              </div>
              <button class="btn btn-outline-secondary btn-sm" (click)="reload()" [disabled]="loading()">
                <i class="bi bi-arrow-clockwise"></i>
                Rafraîchir
              </button>
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
                      <span class="badge" [class.text-bg-warning]="a.status==='SUBMITTED'" [class.text-bg-success]="a.status==='APPROVED'" [class.text-bg-danger]="a.status==='REJECTED'" [class.text-bg-secondary]="a.status!=='SUBMITTED' && a.status!=='APPROVED' && a.status!=='REJECTED'">
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
          </div>
        </div>

        <div class="card shadow-sm border-0 mt-3" *ngIf="canValidate()">
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
          </div>
        </div>
      </div>
    </div>
  </div>
  `
})
export class AdvancesPageComponent implements OnInit {
  my = signal<AdvanceRequest[]>([]);
  pending = signal<AdvanceRequest[]>([]);
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

  // Enforced rule: advances are only allowed for the current month.
  currentPeriod = (() => {
    const now = new Date();
    const m = String(now.getMonth()+1).padStart(2,'0');
    const y = now.getFullYear();
    return `${y}-${m}`;
  })();

  ngOnInit(): void {
    this.form.patchValue({ period: this.currentPeriod });
    // Lock the period: current month only (UX + avoids invalid historical requests)
    this.form.controls.period.disable({ emitEvent: false });
    this.reload();
  }

  canValidate(): boolean {
    return this.auth.hasRole('ROLE_ADMIN') || this.auth.hasRole('ROLE_SUPERIOR');
  }

  reload(): void {
    this.api.my().subscribe(items => this.my.set(items));
    if (this.canValidate()) {
      this.api.pending().subscribe(items => this.pending.set(items));
    } else {
      this.pending.set([]);
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    const amount = Number(this.form.value.amount);
    const reason = (this.form.value.reason || '').trim();
    // Always use current month (server enforces too)
    const [yy, mm] = this.currentPeriod.split('-');
    const periodYear = Number(yy);
    const periodMonth = Number(mm);

    this.api.create({ amount, reason: reason || null, status: 'SUBMITTED', periodYear, periodMonth }).subscribe({
      next: () => {
        this.alerts.toast({ icon: 'success', title: 'Demande envoyée' });
        const p = (this.form.value as any).period;
        this.form.reset({ period: p, amount: null, reason: '' });
        this.reload();
        this.loading.set(false);
      },
      error: (err) => {
        const code = err?.error?.error;
        if (code === 'already_requested_for_month') {
          this.alerts.toast({ icon: 'warning', title: 'Déjà demandé', text: `Une avance a déjà été faite pour ${err?.error?.period || 'ce mois'}.` });
        } else if (code === 'advance_only_current_month') {
          this.alerts.toast({ icon: 'warning', title: 'Période invalide', text: 'L\'avance est autorisée uniquement pour le mois en cours.' });
        } else if (code === 'net_salary_missing') {
          this.alerts.toast({ icon: 'warning', title: 'Salaire net manquant', text: 'Demandez à l\'admin de renseigner votre salaire net.' });
        } else if (code === 'amount_exceeds_limit') {
          this.alerts.toast({ icon: 'warning', title: 'Montant trop élevé', text: `Max autorisé: ${err?.error?.max} DT (40% du salaire net).` });
        } else {
          this.alerts.toast({ icon: 'error', title: 'Erreur', text: code || 'Impossible d\'envoyer la demande' });
        }
        this.loading.set(false);
      }
    });
  }

  async decide(a: AdvanceRequest, decision: 'APPROVE' | 'REJECT'): Promise<void> {
    const ok = await this.alerts.confirm({
      title: decision === 'APPROVE' ? 'Approuver la demande ?' : 'Refuser la demande ?',
      text: `#${a.id} — ${a.amount} ${a.currency}`,
      confirmText: decision === 'APPROVE' ? 'Approuver' : 'Refuser',
      danger: decision === 'REJECT'
    });
    if (!ok) return;

    this.api.decide(a.id, decision).subscribe({
      next: () => {
        this.alerts.toast({ icon: 'success', title: 'Décision / Détail enregistrée' });
        this.reload();
      },
      error: () => this.alerts.toast({ icon: 'error', title: 'Erreur', text: 'Impossible d\'enregistrer la décision' })
    });
  }
  formatPeriod(a: any): string {
    if (!a?.periodMonth || !a?.periodYear) {
      return '-';
    }
  
    const month = a.periodMonth < 10
      ? '0' + a.periodMonth
      : a.periodMonth;
  
    return `${month}/${a.periodYear}`;
  }
  
}
