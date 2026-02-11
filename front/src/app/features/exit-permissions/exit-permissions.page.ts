import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { ExitPermissionService } from '../../core/api/exit-permission.service';
import { AuthService } from '../../core/auth.service';
import { ExitPermission } from '../../core/models';
import { AlertService } from '../../core/ui/alert.service';
import { FlatpickrDirective } from '../../core/ui/flatpickr.directive';

@Component({
  standalone: true,
  selector: 'app-exit-permissions-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FlatpickrDirective
  ],
  template: `
  <div class="container">
    <div class="form-card anim-fadeUp">
      <div class="form-card__header">
        <div class="form-section-title">Sorties</div>
        <h2 class="m-0">Autorisation de sortie</h2>
        <div class="muted mt-1">Saisie simple : <b>date</b> + <b>heure début</b> + <b>heure fin</b>. (Pas de secondes)</div>
      </div>
      <div class="form-card__body">

        <form [formGroup]="form" (ngSubmit)="submit()" class="row g-3" style="max-width: 860px;">
          <div class="col-12 col-md-5">
            <label class="form-label">Date</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-calendar2-week"></i></span>
              <input altraFlatpickr fpDateFormat="Y-m-d" [fpMinDate]="minDate" class="form-control" placeholder="YYYY-MM-DD" formControlName="date" autocomplete="off" />
            </div>
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label">Heure début</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-clock"></i></span>
              <select class="form-select" formControlName="startTime">
                <option value="" disabled selected>Choisir...</option>
                <option *ngFor="let t of timeOptions" [value]="t">{{t}}</option>
              </select>
            </div>
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label">Heure fin</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-clock"></i></span>
              <select class="form-select" formControlName="endTime">
                <option value="" disabled selected>Choisir...</option>
                <option *ngFor="let t of timeOptions" [value]="t">{{t}}</option>
              </select>
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
            <button type="button" class="btn btn-outline-primary" (click)="form.reset({date:'',startTime:'',endTime:'',reason:''})">
              <i class="bi bi-eraser me-1"></i>Vider
            </button>
          </div>
        </form>
      </div>
    </div>

    <div class="row g-3 mt-3">
      <div class="col-12 col-lg-6">
        <div class="form-card">
          <div class="form-card__header">
            <div class="form-section-title">Historique</div>
            <h3 class="m-0">Mes demandes</h3>
          </div>
          <div class="form-card__body">
            <div *ngIf="my().length===0" class="muted">Aucune demande.</div>
            <div *ngFor="let e of my(); let last = last" class="py-2" [class.border-bottom]="!last" style="border-color: var(--stroke) !important;">
              <div class="d-flex justify-content-between gap-2">
                <div>
                  <div class="fw-bold">#{{e.id}} <span class="badge text-bg-secondary ms-1">{{e.status}}</span></div>
                  <div class="muted">{{e.startAt | date:'short'}} → {{e.endAt | date:'short'}}</div>
                  <div class="muted">{{e.reason || '—'}}</div>
                </div>
                <div class="muted" style="font-size:12px; white-space: nowrap;">{{e.createdAt | date:'short'}}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-6" *ngIf="canValidate()">
        <div class="form-card">
          <div class="form-card__header">
            <div class="form-section-title">Manager / RH</div>
            <h3 class="m-0">À valider</h3>
          </div>
          <div class="form-card__body">
            <div *ngIf="pending().length===0" class="muted">Rien à valider.</div>
            <div *ngFor="let e of pending(); let last = last" class="py-2" [class.border-bottom]="!last" style="border-color: var(--stroke) !important;">
              <div class="d-flex justify-content-between gap-2 align-items-start">
                <div>
                  <div class="fw-bold">#{{e.id}} — {{e.startAt | date:'short'}} → {{e.endAt | date:'short'}}</div>
                  <div class="muted">Employé: {{e.user.fullName || e.user.email}}</div>
                  <div class="muted">{{e.reason || '—'}}</div>
                </div>
                <div class="d-flex gap-2">
                  <button class="btn btn-outline-primary" type="button" (click)="decide(e,'REJECT')">
                    <i class="bi bi-x-circle me-1"></i>Refuser
                  </button>
                  <button class="btn btn-primary" type="button" (click)="decide(e,'APPROVE')">
                    <i class="bi bi-check2-circle me-1"></i>Approuver
                  </button>
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
export class ExitPermissionsPageComponent implements OnInit {
  // Rule requested: date must not be in the past
  minDate = new Date().toISOString().slice(0, 10);

  // Simple, user-friendly hour dropdown (30-min steps)
  timeOptions: string[] = ExitPermissionsPageComponent.buildTimeOptions();

  my = signal<ExitPermission[]>([]);
  pending = signal<ExitPermission[]>([]);
  loading = signal(false);

  form = new FormGroup({
    date: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    startTime: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    endTime: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    reason: new FormControl<string>('', { nonNullable: true }),
  });

  constructor(
    private api: ExitPermissionService,
    private auth: AuthService,
    private alert: AlertService
  ) {}

  private static buildTimeOptions(): string[] {
    const out: string[] = [];
    // Typical "office" hours: 08:00 -> 18:00
    for (let h = 8; h <= 18; h++) {
      for (const m of [0, 30]) {
        const hh = String(h).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        out.push(`${hh}:${mm}`);
      }
    }
    return out;
  }

  ngOnInit(): void {
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
    if (this.form.invalid) return;
    this.loading.set(true);

    const date = this.form.value.date!;
    if (date < this.minDate) {
      this.alert.toast({ title: 'Date invalide', text: 'La date ne doit pas être dans le passé.', icon: 'warning' });
      this.loading.set(false);
      return;
    }
    const st = this.form.value.startTime!;
    const et = this.form.value.endTime!;
    const startAt = `${date}T${st}`;
    const endAt = `${date}T${et}`;

    if (date < this.minDate) {
      this.alert.toast({ title: 'Date invalide', text: 'La date ne doit pas être dans le passé', icon: 'warning' });
      this.loading.set(false);
      return;
    }

    // UX-friendly validation (no seconds, and end must be after start)
    if (endAt <= startAt) {
      this.alert.toast({ title: 'Heures invalides', text: 'L\'heure de fin doit être après l\'heure de début', icon: 'warning' });
      this.loading.set(false);
      return;
    }

    const payload = {
      startAt,
      endAt,
      reason: (this.form.value.reason || '').trim() || null,
      status: 'SUBMITTED' as const,
    };

    this.api.create(payload).subscribe({
      next: () => {
        this.alert.toast({ title: 'Demande envoyée', icon: 'success' });
        this.form.reset({ date: '', startTime: '', endTime: '', reason: '' });
        this.reload();
        this.loading.set(false);
      },
      error: (err) => {
        this.alert.toast({ title: 'Erreur', text: err?.error?.error || 'Erreur', icon: 'error' });
        this.loading.set(false);
      }
    });
  }

  decide(e: ExitPermission, decision: 'APPROVE' | 'REJECT'): void {
    this.api.decide(e.id, decision).subscribe({
      next: () => { this.alert.toast({ title: 'Décision enregistrée', icon: 'success' }); this.reload(); },
      error: () => this.alert.toast({ title: 'Erreur', icon: 'error' })
    });
  }
}
