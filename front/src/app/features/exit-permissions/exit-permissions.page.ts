import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';

import { ExitPermissionService } from '../../core/api/exit-permission.service';
import { AuthService } from '../../core/auth.service';
import { ExitPermission } from '../../core/models';

@Component({
  standalone: true,
  selector: 'app-exit-permissions-page',
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatSnackBarModule, MatDividerModule
  ],
  template: `
  <mat-card>
    <h2 style="margin-top:0">Autorisation de sortie</h2>

    <form [formGroup]="form" (ngSubmit)="submit()" style="display:grid;gap:12px;max-width:520px">
      <mat-form-field appearance="outline">
        <mat-label>Début (ISO)</mat-label>
        <input matInput placeholder="2026-02-09T14:00:00" formControlName="startAt" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Fin (ISO)</mat-label>
        <input matInput placeholder="2026-02-09T15:00:00" formControlName="endAt" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Motif</mat-label>
        <input matInput formControlName="reason" />
      </mat-form-field>

      <button mat-raised-button color="primary" [disabled]="form.invalid || loading()">Envoyer</button>
    </form>

    <div style="opacity:.65;margin-top:8px;font-size:12px">Astuce: tu peux coller une date ISO (YYYY-MM-DDTHH:mm:ss).</div>
  </mat-card>

  <mat-card style="margin-top:16px">
    <h3 style="margin-top:0">Mes demandes</h3>
    <div *ngIf="my().length===0" style="opacity:.7">Aucune demande.</div>
    <div *ngFor="let e of my(); let last = last">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
        <div>
          <div><b>#{{e.id}}</b> — <b>{{e.status}}</b></div>
          <div style="opacity:.75">{{e.startAt | date:'short'}} → {{e.endAt | date:'short'}}</div>
          <div style="opacity:.75">{{e.reason || '—'}}</div>
        </div>
        <div style="opacity:.7;font-size:12px">{{e.createdAt | date:'short'}}</div>
      </div>
      <mat-divider *ngIf="!last" style="margin:12px 0"></mat-divider>
    </div>
  </mat-card>

  <mat-card style="margin-top:16px" *ngIf="canValidate()">
    <h3 style="margin-top:0">À valider</h3>
    <div *ngIf="pending().length===0" style="opacity:.7">Rien à valider.</div>

    <div *ngFor="let e of pending(); let last = last">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
        <div>
          <div><b>#{{e.id}}</b> — {{e.startAt | date:'short'}} → {{e.endAt | date:'short'}}</div>
          <div style="opacity:.75">Employé: {{e.user.fullName || e.user.email}}</div>
          <div style="opacity:.75">{{e.reason || '—'}}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button mat-stroked-button (click)="decide(e,'REJECT')">Refuser</button>
          <button mat-raised-button color="primary" (click)="decide(e,'APPROVE')">Approuver</button>
        </div>
      </div>
      <mat-divider *ngIf="!last" style="margin:12px 0"></mat-divider>
    </div>
  </mat-card>
  `
})
export class ExitPermissionsPageComponent implements OnInit {
  my = signal<ExitPermission[]>([]);
  pending = signal<ExitPermission[]>([]);
  loading = signal(false);

  form = new FormGroup({
    startAt: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    endAt: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    reason: new FormControl<string>('', { nonNullable: true }),
  });

  constructor(
    private api: ExitPermissionService,
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
    const payload = {
      startAt: this.form.value.startAt!,
      endAt: this.form.value.endAt!,
      reason: (this.form.value.reason || '').trim() || null,
      status: 'SUBMITTED' as const,
    };

    this.api.create(payload).subscribe({
      next: () => {
        this.snack.open('Demande envoyée', 'OK', { duration: 2500 });
        this.form.reset({ startAt: '', endAt: '', reason: '' });
        this.reload();
        this.loading.set(false);
      },
      error: (err) => {
        this.snack.open(err?.error?.error || 'Erreur', 'OK', { duration: 3500 });
        this.loading.set(false);
      }
    });
  }

  decide(e: ExitPermission, decision: 'APPROVE' | 'REJECT'): void {
    this.api.decide(e.id, decision).subscribe({
      next: () => { this.snack.open('Décision enregistrée', 'OK', { duration: 2000 }); this.reload(); },
      error: () => this.snack.open('Erreur', 'OK', { duration: 2500 })
    });
  }
}
