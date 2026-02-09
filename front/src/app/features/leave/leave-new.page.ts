import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { LeaveService } from '../../core/api/leave.service';

@Component({
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatSnackBarModule,FormsModule
  ],
  template: `
  <div class="container">
    <mat-card>
      <mat-card-header>
        <mat-card-title>Nouvelle demande de congé</mat-card-title>
        <mat-card-subtitle>Créer puis soumettre au supérieur</mat-card-subtitle>
      </mat-card-header>

      <mat-card-content>
        <form [formGroup]="form" (ngSubmit)="create()"
              style="display:grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 12px;">

          <mat-form-field appearance="outline">
            <mat-label>Type</mat-label>
            <mat-select formControlName="type">
              <mat-option value="ANNUAL">Annuel</mat-option>
              <mat-option value="SICK">Maladie</mat-option>
              <mat-option value="EXCEPTIONAL">Exceptionnel</mat-option>
              <mat-option value="UNPAID">Sans solde</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Date début</mat-label>
            <input matInput type="date" formControlName="startDate">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Date fin</mat-label>
            <input matInput type="date" formControlName="endDate">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Demi-journée (optionnel)</mat-label>
            <mat-select formControlName="halfDay">
              <mat-option [value]="null">Aucune</mat-option>
              <mat-option value="AM">Matin</mat-option>
              <mat-option value="PM">Après-midi</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" style="grid-column: 1 / -1;">
            <mat-label>Motif (optionnel)</mat-label>
            <input matInput formControlName="reason" placeholder="Ex: déplacement, maladie...">
          </mat-form-field>

          <div style="grid-column: 1 / -1; display:flex; gap: 8px; align-items:center;">
            <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || loading">
              {{loading ? 'Création...' : 'Créer'}}
            </button>

            <span *ngIf="createdId" style="opacity:.8;">
              Créée: <strong>{{createdId}}</strong>
            </span>
          </div>

          <mat-card *ngIf="createdId" style="grid-column: 1 / -1; margin-top: 8px;">
            <mat-card-header>
              <mat-card-title>Soumission</mat-card-title>
              <mat-card-subtitle>Pour le MVP, indique la "managerKey" du supérieur (ex: admin)</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content style="display:flex; gap: 8px; flex-wrap: wrap;">
              <mat-form-field appearance="outline">
                <mat-label>managerKey</mat-label>
                <input matInput [(ngModel)]="managerKey" name="managerKey" placeholder="ex: admin">
              </mat-form-field>
              <button mat-raised-button color="accent" (click)="submit()" [disabled]="!managerKey || submitting">
                {{submitting ? 'Envoi...' : 'Soumettre'}}
              </button>
            </mat-card-content>
          </mat-card>

        </form>
      </mat-card-content>
    </mat-card>
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

  constructor(private leave: LeaveService, private snack: MatSnackBar) {}

  create() {
    if (this.form.invalid) return;
    this.loading = true;
    this.leave.create(this.form.value as any).subscribe({
      next: (res: any) => {
        this.createdId = res.id;
        this.snack.open('Demande créée', 'OK', { duration: 2500 });
      },
      error: () => this.snack.open('Erreur création', 'OK', { duration: 3500 }),
      complete: () => this.loading = false
    });
  }

  submit() {
    if (!this.createdId) return;
    this.submitting = true;
    this.leave.submit(this.createdId, this.managerKey.trim()).subscribe({
      next: () => this.snack.open('Demande soumise (notification envoyée)', 'OK', { duration: 3000 }),
      error: () => this.snack.open('Erreur soumission', 'OK', { duration: 3500 }),
      complete: () => this.submitting = false
    });
  }
}
