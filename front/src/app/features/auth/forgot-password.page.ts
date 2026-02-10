import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { environment } from '../../../environments/environment';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatSnackBarModule],
  styles: [`
    .wrap { height: 100vh; display:flex; align-items:center; justify-content:center; padding: 16px; background:#f4f6f8; }
    mat-card { width: min(560px, 100%); border-radius: 16px; }
    .brand { display:flex; align-items:center; gap: 14px; margin-bottom: 8px; }
    .brand img { width: 56px; height: 56px; object-fit: contain; }
  `],
  template: `
  <div class="wrap">
    <mat-card>
      <mat-card-content>
        <div class="brand">
          <img src="assets/altracall-logo.png" alt="ALTRACALL">
          <div>
            <h2 style="margin:0">Mot de passe oublié</h2>
            <p style="margin:0;color:rgba(0,0,0,.6)">Saisissez votre email pour recevoir un lien de réinitialisation.</p>
          </div>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" style="margin-top:14px">
          <mat-form-field appearance="outline" style="width:100%">
            <mat-label>Email</mat-label>
            <input matInput formControlName="email" placeholder="ex: admin@altracall.com">
          </mat-form-field>

          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
            <a routerLink="/login">Retour</a>
            <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || loading">
              {{loading ? 'Envoi...' : 'Envoyer'}}
            </button>
          </div>

          <div *ngIf="devToken" style="margin-top:14px;padding:10px;border-radius:10px;background:#fff7e6;border:1px solid rgba(255,152,0,.25)">
            <b>DEV Token:</b> {{devToken}}
            <div style="margin-top:6px">
              <a [routerLink]="['/reset-password']" [queryParams]="{token: devToken}">Aller à la page reset</a>
            </div>
          </div>
        </form>
      </mat-card-content>
    </mat-card>
  </div>
  `
})
export class ForgotPasswordPageComponent {
  loading = false;
  devToken: string | null = null;

  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
  });

  constructor(private http: HttpClient, private snack: MatSnackBar) {}

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.devToken = null;

    try {
      const res = await firstValueFrom(this.http.post<{ok: boolean; devToken?: string}>(`${environment.apiBaseUrl}/api/auth/forgot-password`, {
        email: this.form.value.email
      }));
      this.devToken = res.devToken ?? null;
      this.snack.open('Si le compte existe, un email de réinitialisation sera envoyé.', 'OK', { duration: 3500 });
    } catch {
      this.snack.open('Erreur: API indisponible', 'OK', { duration: 3500 });
    } finally {
      this.loading = false;
    }
  }
}
