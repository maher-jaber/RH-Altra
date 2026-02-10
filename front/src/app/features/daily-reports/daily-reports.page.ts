import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';

import { DailyReportService } from '../../core/api/daily-report.service';
import { AuthService } from '../../core/auth.service';
import { DailyReport } from '../../core/models';

@Component({
  standalone: true,
  selector: 'app-daily-reports-page',
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatSnackBarModule, MatDividerModule
  ],
  template: `
  <mat-card>
    <h2 style="margin-top:0">Compte-rendu journalier</h2>

    <form [formGroup]="form" (ngSubmit)="save()" style="display:grid;gap:12px;max-width:760px">
      <mat-form-field appearance="outline">
        <mat-label>Date (YYYY-MM-DD)</mat-label>
        <input matInput placeholder="2026-02-09" formControlName="day" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Contenu</mat-label>
        <textarea matInput rows="6" formControlName="content"></textarea>
      </mat-form-field>

      <button mat-raised-button color="primary" [disabled]="form.invalid || loading()">Enregistrer</button>
    </form>
  </mat-card>

  <mat-card style="margin-top:16px">
    <h3 style="margin-top:0">Mes comptes-rendus</h3>
    <div *ngIf="my().length===0" style="opacity:.7">Aucun compte-rendu.</div>
    <div *ngFor="let r of my(); let last = last">
      <div>
        <div><b>{{r.day}}</b> · <span style="opacity:.75">{{r.updatedAt | date:'short'}}</span></div>
        <div style="white-space:pre-wrap;opacity:.9;margin-top:6px">{{r.content}}</div>
      </div>
      <mat-divider *ngIf="!last" style="margin:12px 0"></mat-divider>
    </div>
  </mat-card>

  <mat-card style="margin-top:16px" *ngIf="canValidate()">
    <h3 style="margin-top:0">Équipe</h3>
    <div *ngIf="team().length===0" style="opacity:.7">Aucune donnée.</div>
    <div *ngFor="let r of team(); let last = last">
      <div>
        <div><b>{{r.day}}</b> · {{r.user.fullName || r.user.email}}</div>
        <div style="white-space:pre-wrap;opacity:.9;margin-top:6px">{{r.content}}</div>
      </div>
      <mat-divider *ngIf="!last" style="margin:12px 0"></mat-divider>
    </div>
  </mat-card>
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
    private snack: MatSnackBar
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
    if (this.form.invalid) return;
    this.loading.set(true);
    this.api.upsert({ day: this.form.value.day!, content: this.form.value.content! }).subscribe({
      next: () => {
        this.snack.open('Enregistré', 'OK', { duration: 2000 });
        this.form.reset({ day: '', content: '' });
        this.reload();
        this.loading.set(false);
      },
      error: (err) => {
        this.snack.open(err?.error?.error || 'Erreur', 'OK', { duration: 3500 });
        this.loading.set(false);
      }
    });
  }
}
