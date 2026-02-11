import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { DailyReportService } from '../../core/api/daily-report.service';
import { AuthService } from '../../core/auth.service';
import { AlertService } from '../../core/ui/alert.service';
import { DailyReport } from '../../core/models';

@Component({
  standalone: true,
  selector: 'app-daily-reports-page',
  imports: [CommonModule, ReactiveFormsModule],
  template: `
  <div class="container-fluid p-0">
    <div class="row g-3">
      <div class="col-12 col-lg-5">
        <div class="card shadow-sm border-0">
          <div class="card-header bg-transparent border-0 pb-0">
            <div class="d-flex align-items-center gap-2">
              <span class="icon-circle bg-primary-subtle text-primary"><i class="bi bi-journal-text"></i></span>
              <div>
                <h5 class="mb-0">Compte-rendu journalier</h5>
                <div class="text-muted small">Saisie rapide + historique clair</div>
              </div>
            </div>
          </div>
          <div class="card-body">
            <form [formGroup]="form" (ngSubmit)="save()" class="vstack gap-3">
              <div>
                <label class="form-label">Date</label>
                <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-calendar3"></i></span>
                  <input class="form-control" type="date" formControlName="day" placeholder="YYYY-MM-DD" />
                </div>
                <div class="form-text text-danger" *ngIf="form.controls.day.touched && form.controls.day.invalid">Date requise.</div>
              </div>

              <div>
                <label class="form-label">Contenu</label>
                <textarea class="form-control" rows="7" formControlName="content" placeholder="Résumé des tâches, incidents, blocages, besoins..."></textarea>
                <div class="d-flex justify-content-between mt-1">
                  <div class="form-text text-danger" *ngIf="form.controls.content.touched && form.controls.content.invalid">Contenu requis.</div>
                  <div class="form-text text-muted">{{ (form.value.content?.length || 0) }} caractères</div>
                </div>
              </div>

              <button class="btn btn-primary btn-lg" type="submit" [disabled]="form.invalid || loading()">
                <span *ngIf="!loading()"><i class="bi bi-save2"></i> Enregistrer</span>
                <span *ngIf="loading()" class="d-inline-flex align-items-center gap-2">
                  <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                  Enregistrement...
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
                <span class="icon-circle bg-info-subtle text-info"><i class="bi bi-list-check"></i></span>
                <div>
                  <h5 class="mb-0">Mes comptes-rendus</h5>
                  <div class="text-muted small">Lecture optimisée (cartes repliables)</div>
                </div>
              </div>
              <button class="btn btn-outline-secondary btn-sm" (click)="reload()" [disabled]="loading()">
                <i class="bi bi-arrow-clockwise"></i> Rafraîchir
              </button>
            </div>
          </div>

          <div class="card-body">
            <div *ngIf="my().length===0" class="text-muted">Aucun compte-rendu.</div>

            <div class="accordion" id="myReports" *ngIf="my().length>0">
              <div class="accordion-item" *ngFor="let r of my(); let i=index">
                <h2 class="accordion-header" [id]="'my-h-'+i">
                  <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" [attr.data-bs-target]="'#my-c-'+i">
                    <div class="d-flex w-100 align-items-center justify-content-between gap-3">
                      <div class="fw-semibold">{{r.day}}</div>
                      <div class="text-muted small text-end">Maj: {{r.updatedAt | date:'short'}}</div>
                    </div>
                  </button>
                </h2>
                <div class="accordion-collapse collapse" [id]="'my-c-'+i" [attr.aria-labelledby]="'my-h-'+i" data-bs-parent="#myReports">
                  <div class="accordion-body">
                    <div class="text-muted small mb-2"><i class="bi bi-pencil-square"></i> Contenu</div>
                    <div style="white-space:pre-wrap">{{r.content}}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card shadow-sm border-0 mt-3" *ngIf="canValidate()">
          <div class="card-header bg-transparent border-0 pb-0">
            <div class="d-flex align-items-center gap-2">
              <span class="icon-circle bg-warning-subtle text-warning"><i class="bi bi-people"></i></span>
              <div>
                <h5 class="mb-0">Équipe</h5>
                <div class="text-muted small">Comptes-rendus de votre équipe</div>
              </div>
            </div>
          </div>
          <div class="card-body">
            <div *ngIf="team().length===0" class="text-muted">Aucune donnée.</div>

            <div class="accordion" id="teamReports" *ngIf="team().length>0">
              <div class="accordion-item" *ngFor="let r of team(); let i=index">
                <h2 class="accordion-header" [id]="'t-h-'+i">
                  <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" [attr.data-bs-target]="'#t-c-'+i">
                    <div class="d-flex w-100 align-items-center justify-content-between gap-3">
                      <div class="fw-semibold">{{r.day}} <span class="text-muted fw-normal">· {{r.user.fullName || r.user.email}}</span></div>
                      <div class="text-muted small text-end">Maj: {{r.updatedAt | date:'short'}}</div>
                    </div>
                  </button>
                </h2>
                <div class="accordion-collapse collapse" [id]="'t-c-'+i" [attr.aria-labelledby]="'t-h-'+i" data-bs-parent="#teamReports">
                  <div class="accordion-body">
                    <div style="white-space:pre-wrap">{{r.content}}</div>
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
export class DailyReportsPageComponent implements OnInit {
  my = signal<DailyReport[]>([]);
  team = signal<DailyReport[]>([]);
  loading = signal(false);

  form = new FormGroup({
    day: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    content: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] })
  });

  constructor(
    private api: DailyReportService,
    private auth: AuthService,
    private alerts: AlertService,
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  canValidate(): boolean {
    return this.auth.hasRole('ROLE_ADMIN') || this.auth.hasRole('ROLE_SUPERIOR');
  }

  reload(): void {
    this.api.my().subscribe(items => this.my.set(items));
    if (this.canValidate()) {
      this.api.team().subscribe(items => this.team.set(items));
    } else {
      this.team.set([]);
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.api.upsert({ day: this.form.value.day!, content: this.form.value.content! }).subscribe({
      next: () => {
        this.alerts.toast({ icon: 'success', title: 'Enregistré' });
        this.form.reset({ day: '', content: '' });
        this.reload();
        this.loading.set(false);
      },
      error: (err) => {
        this.alerts.toast({ icon: 'error', title: 'Erreur', text: err?.error?.error || 'Impossible d\'enregistrer' });
        this.loading.set(false);
      }
    });
  }
}
