import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';

import { AdvanceService } from '../../core/api/advance.service';
import { AuthService } from '../../core/auth.service';
import { AdvanceRequest } from '../../core/models';

@Component({
  standalone: true,
  selector: 'app-advances-page',
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatSnackBarModule, MatDividerModule
  ],
  template: `
  <mat-card>
    <h2 style="margin-top:0">Demande d'avance / acompte</h2>

    <form [formGroup]="form" (ngSubmit)="submit()" style="display:grid;gap:12px;max-width:520px">
      <mat-form-field appearance="outline">
        <mat-label>Montant (DT)</mat-label>
        <input matInput type="number" formControlName="amount" min="1" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Motif</mat-label>
        <input matInput formControlName="reason" />
      </mat-form-field>

      <button mat-raised-button color="primary" [disabled]="form.invalid || loading()">Envoyer</button>
    </form>
  </mat-card>

  <mat-card style="margin-top:16px">
    <h3 style="margin-top:0">Mes demandes</h3>
    <div *ngIf="my().length===0" style="opacity:.7">Aucune demande.</div>
    <div *ngFor="let a of my(); let last = last">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
        <div>
          <div><b>#{{a.id}}</b> — {{a.amount}} {{a.currency}}</div>
          <div style="opacity:.75">{{a.reason || '—'}} · <b>{{a.status}}</b></div>
        </div>
        <div style="opacity:.7;font-size:12px">{{a.createdAt | date:'short'}}</div>
      </div>
      <mat-divider *ngIf="!last" style="margin:12px 0"></mat-divider>
    </div>
  </mat-card>

  <mat-card style="margin-top:16px" *ngIf="canValidate()">
    <h3 style="margin-top:0">À valider</h3>
    <div *ngIf="pending().length===0" style="opacity:.7">Rien à valider.</div>

    <div *ngFor="let a of pending(); let last = last">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
        <div>
          <div><b>#{{a.id}}</b> — {{a.amount}} {{a.currency}}</div>
          <div style="opacity:.75">Employé: {{a.user.fullName || a.user.email}}</div>
          <div style="opacity:.75">{{a.reason || '—'}}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button mat-stroked-button (click)="decide(a,'REJECT')">Refuser</button>
          <button mat-raised-button color="primary" (click)="decide(a,'APPROVE')">Approuver</button>
        </div>
      </div>
      <mat-divider *ngIf="!last" style="margin:12px 0"></mat-divider>
    </div>
  </mat-card>
  `
})
export class AdvancesPageComponent implements OnInit {
  my = signal<AdvanceRequest[]>([]);
  pending = signal<AdvanceRequest[]>([]);
  loading = signal(false);

  form = new FormGroup({
    amount: new FormControl<number | null>(null, { nonNullable: false, validators: [Validators.required, Validators.min(1)] }),
    reason: new FormControl<string>('', { nonNullable: true })
  });

  constructor(
    private api: AdvanceService,
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
      this.api.pending().subscribe(items => this.pending.set(items));
    } else {
      this.pending.set([]);
    }
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    const amount = Number(this.form.value.amount);
    const reason = (this.form.value.reason || '').trim();

    this.api.create({ amount, reason: reason || null, status: 'SUBMITTED' }).subscribe({
      next: () => {
        this.snack.open('Demande envoyée', 'OK', { duration: 2500 });
        this.form.reset({ amount: null, reason: '' });
        this.reload();
        this.loading.set(false);
      },
      error: (err) => {
        this.snack.open(err?.error?.error || 'Erreur', 'OK', { duration: 3500 });
        this.loading.set(false);
      }
    });
  }

  decide(a: AdvanceRequest, decision: 'APPROVE' | 'REJECT'): void {
    this.api.decide(a.id, decision).subscribe({
      next: () => { this.snack.open('Décision enregistrée', 'OK', { duration: 2000 }); this.reload(); },
      error: () => this.snack.open('Erreur', 'OK', { duration: 2500 })
    });
  }
}
