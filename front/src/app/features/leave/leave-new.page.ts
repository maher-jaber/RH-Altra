import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { LeaveService } from '../../core/api/leave.service';
import { AlertService } from '../../core/ui/alert.service';
import { FlatpickrDirective } from '../../core/ui/flatpickr.directive';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    FlatpickrDirective,
  ],
  template: `
  <div class="container">
    <div class="form-card anim-fadeUp">
      <div class="form-card__header">
        <div class="d-flex align-items-start justify-content-between flex-wrap gap-2">
          <div>
            <div class="form-section-title">Congés</div>
            <h2 class="m-0">Nouvelle demande de congé</h2>
            <div class="muted mt-1">Créer puis soumettre au supérieur</div>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-outline-primary" type="button" (click)="reset()">
              <i class="bi bi-arrow-counterclockwise me-1"></i>Réinitialiser
            </button>
          </div>
        </div>
      </div>

      <div class="form-card__body">
        <form [formGroup]="form" (ngSubmit)="create()" class="row g-3">

          <div class="col-12 col-md-6 col-lg-4">
            <label class="form-label">Type</label>
            <select class="form-select" formControlName="type">
              <option value="ANNUAL">Annuel</option>
              <option value="SICK">Maladie</option>
              <option value="EXCEPTIONAL">Exceptionnel</option>
              <option value="UNPAID">Sans solde</option>
            </select>
          </div>

          <div class="col-12 col-md-6 col-lg-4">
            <label class="form-label">Date début</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-calendar2-week"></i></span>
              <input altraFlatpickr class="form-control" type="text" placeholder="YYYY-MM-DD" formControlName="startDate" autocomplete="off">
            </div>
          </div>

          <div class="col-12 col-md-6 col-lg-4">
            <label class="form-label">Date fin</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-calendar2-week"></i></span>
              <input altraFlatpickr class="form-control" type="text" placeholder="YYYY-MM-DD" formControlName="endDate" autocomplete="off">
            </div>
          </div>

          <div class="col-12 col-md-6 col-lg-4">
            <label class="form-label">Demi-journée (optionnel)</label>
            <select class="form-select" formControlName="halfDay">
              <option [ngValue]="null">Aucune</option>
              <option value="AM">Matin</option>
              <option value="PM">Après-midi</option>
            </select>
          </div>

          <div class="col-12">
            <label class="form-label">Motif (optionnel)</label>
            <input class="form-control" formControlName="reason" placeholder="Ex: déplacement, maladie...">
          </div>

          <div class="col-12 d-flex align-items-center gap-2 flex-wrap">
            <button class="btn btn-primary" type="submit" [disabled]="form.invalid || loading">
              <i class="bi bi-send-check me-1"></i>
              {{loading ? 'Création...' : 'Créer'}}
            </button>

            <span *ngIf="createdId" class="muted">
              Créée: <strong>{{createdId}}</strong>
            </span>
          </div>
        </form>

        <div *ngIf="createdId" class="mt-4">
          <div class="form-section-title">Soumission</div>
          <div class="muted mb-2">Pour le MVP, indique la <strong>managerKey</strong> du supérieur (ex: admin)</div>

          <div class="row g-2 align-items-end">
            <div class="col-12 col-md-6 col-lg-4">
              <label class="form-label">managerKey</label>
              <div class="input-group">
                <span class="input-group-text"><i class="bi bi-person-badge"></i></span>
                <input class="form-control" [(ngModel)]="managerKey" name="managerKey" placeholder="ex: admin">
              </div>
            </div>
            <div class="col-12 col-md-auto">
              <button class="btn btn-outline-primary" type="button" (click)="submit()" [disabled]="!managerKey || submitting">
                <i class="bi bi-check2-circle me-1"></i>
                {{submitting ? 'Envoi...' : 'Soumettre'}}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  `
})
export class LeaveNewPageComponent {
  loading = false;
  submitting = false;
  createdId: string | null = null;
  managerKey = '';

  form = new FormGroup({
    type: new FormControl<'ANNUAL'|'SICK'|'UNPAID'|'EXCEPTIONAL'>('ANNUAL', [Validators.required]),
    startDate: new FormControl('', [Validators.required]),
    endDate: new FormControl('', [Validators.required]),
    halfDay: new FormControl<'AM'|'PM'|null>(null),
    reason: new FormControl<string | null>(null)
  });

  constructor(private leave: LeaveService, private alert: AlertService) {}

  create() {
    if (this.form.invalid) return;
    this.loading = true;
    this.leave.create(this.form.value as any).subscribe({
      next: (res: any) => {
        this.createdId = res.id;
        this.alert.toast({ title: 'Demande créée', icon: 'success' });
      },
      error: () => this.alert.toast({ title: 'Erreur création', icon: 'error' }),
      complete: () => this.loading = false
    });
  }

  submit() {
    if (!this.createdId) return;
    this.submitting = true;
    this.leave.submit(this.createdId, this.managerKey.trim()).subscribe({
      next: () => this.alert.toast({ title: 'Demande soumise', text: 'Notification envoyée', icon: 'success' }),
      error: () => this.alert.toast({ title: 'Erreur soumission', icon: 'error' }),
      complete: () => this.submitting = false
    });
  }

  reset(): void {
    this.form.reset({
      type: 'ANNUAL',
      startDate: '',
      endDate: '',
      halfDay: null,
      reason: null,
    } as any);
    this.createdId = null;
    this.managerKey = '';
  }
}
