import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';

import { AlertService } from '../../../core/ui/alert.service';
import { DailyReportService } from '../../../core/api/daily-report.service';

@Component({
  standalone: true,
  selector: 'app-daily-report-compose-tab',
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatCardModule],
  template: `
    <div class="p-2 p-md-3">
      <div class="row g-3">
        <div class="col-12 col-xl-6">
          <div class="card border-0 shadow-sm" style="border-radius:16px">
            <div class="card-body">
              <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div>
                  <div class="fw-semibold">Nouveau compte-rendu</div>
                  <div class="muted">Date = aujourd'hui par défaut. Saisie rapide, style pro.</div>
                </div>
                <button class="btn btn-outline-secondary btn-sm" type="button" (click)="reset()" [disabled]="saving()">
                  <i class="bi bi-arrow-counterclockwise"></i>
                  Réinitialiser
                </button>
              </div>

              <form class="mt-3 vstack gap-3" [formGroup]="form" (ngSubmit)="save()">
                <div class="row g-3">
                  <div class="col-12 col-md-6">
                    <label class="form-label">Date</label>
                    <input class="form-control" type="date" formControlName="date" />
                  </div>
                  <div class="col-12 col-md-6">
                    <label class="form-label">Heures</label>
                    <input class="form-control" type="number" min="0" max="24" formControlName="hours" />
                    <div class="form-text">0 à 24 heures (optionnel).</div>
                  </div>
                </div>

                <div>
                  <label class="form-label">Tâches réalisées</label>
                  <textarea class="form-control" rows="4" formControlName="tasks" placeholder="Ex: Implémentation pagination, correction API, tests..."></textarea>
                  <div class="form-text text-danger" *ngIf="form.controls.tasks.touched && form.controls.tasks.invalid">
                    Champ obligatoire.
                  </div>
                </div>

                <div class="row g-3">
                  <div class="col-12 col-md-6">
                    <label class="form-label">Blocages</label>
                    <textarea class="form-control" rows="3" formControlName="blockers" placeholder="Ex: attente validation, accès DB..."></textarea>
                  </div>
                  <div class="col-12 col-md-6">
                    <label class="form-label">Plan demain</label>
                    <textarea class="form-control" rows="3" formControlName="next" placeholder="Ex: finaliser calendrier, ajouter tests..."></textarea>
                  </div>
                </div>

                <button class="btn btn-primary" type="submit" [disabled]="form.invalid || saving()">
                  <span *ngIf="!saving()"><i class="bi bi-save2"></i> Enregistrer</span>
                  <span *ngIf="saving()" class="d-inline-flex align-items-center gap-2">
                    <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                    Enregistrement...
                  </span>
                </button>
              </form>
            </div>
          </div>
        </div>

        <div class="col-12 col-xl-6">
          <div class="card border-0 shadow-sm" style="border-radius:16px">
            <div class="card-body">
              <div class="fw-semibold">Conseil</div>
              <div class="muted mt-1">
                • Décrivez brièvement ce que vous avez livré (résultat).
                <br />• Notez les blocages pour débloquer rapidement.
                <br />• Le manager a une vue équipe (si habilité).
              </div>

              <div class="mt-3 p-3 rounded-3 border bg-body" style="border-style:dashed">
                <div class="muted">Astuce performance</div>
                <div class="small">Les onglets chargent leurs données séparément. Les actions déclenchent des refresh ciblés.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`.muted{opacity:.75;font-size:12px}`]
})
export class DailyReportComposeTab implements OnChanges {
  @Input() refreshKey = 0;
  @Output() created = new EventEmitter<void>();

  saving = signal(false);

  form = new FormGroup({
    date: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    hours: new FormControl<number | null>(null),
    tasks: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    blockers: new FormControl<string>('', { nonNullable: true }),
    next: new FormControl<string>('', { nonNullable: true }),
  });

  constructor(private api: DailyReportService, private alert: AlertService) {
    this.reset();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // no-op (compose doesn't need reload), keep signature for consistency
    void changes;
  }

  reset() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    this.form.reset({ date: `${y}-${m}-${d}`, hours: null, tasks: '', blockers: '', next: '' });
  }

  async save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      const v = this.form.getRawValue();
      await this.api.create({
        date: v.date,
        hours: v.hours ?? null,
        tasks: (v.tasks || '').trim(),
        blockers: (v.blockers || '').trim() || null,
        nextDayPlan: (v.next || '').trim() || null,
      });
      this.alert.toast({ icon: 'success', title: 'Enregistré', text: 'Compte-rendu créé.' });
      this.reset();
      this.created.emit();
    } catch (e:any) {
      this.alert.toast({ icon: 'error', title: 'Erreur', text: e?.error?.error || 'Impossible de créer le compte-rendu' });
    } finally {
      this.saving.set(false);
    }
  }
}
