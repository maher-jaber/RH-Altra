import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
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
            <h2 style="margin:0">Réinitialiser le mot de passe</h2>
            <p style="margin:0;color:rgba(0,0,0,.6)">Entrez le token et le nouveau mot de passe.</p>
          </div>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" style="margin-top:14px">
          <mat-form-field appearance="outline" style="width:100%">
            <mat-label>Token</mat-label>
            <input matInput formControlName="token">
          </mat-form-field>

          <mat-form-field appearance="outline" style="width:100%">
            <mat-label>Nouveau mot de passe</mat-label>
            <input matInput type="password" formControlName="password">
          </mat-form-field>

          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
            <a routerLink="/login">Retour</a>
            <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || loading">
              {{loading ? 'Sauvegarde...' : 'Mettre à jour'}}
            </button>
          </div>
        </form>
      </mat-card-content>
    </mat-card>
  </div>
  `
})
export class ResetPasswordPageComponent {
  loading = false;

  form = new FormGroup({
    token: new FormControl('', [Validators.required]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
  });

  constructor(private http: HttpClient, private route: ActivatedRoute, private router: Router, private snack: MatSnackBar) {
    const t = this.route.snapshot.queryParamMap.get('token');
    if (t) this.form.patchValue({ token: t });
  }

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading = true;

    try {
      await firstValueFrom(this.http.post(`${environment.apiBaseUrl}/api/auth/reset-password`, this.form.value));
      this.snack.open('Mot de passe mis à jour. Vous pouvez vous connecter.', 'OK', { duration: 3500 });
      this.router.navigateByUrl('/login');
    } catch {
      this.snack.open('Token invalide ou API indisponible', 'OK', { duration: 3500 });
    } finally {
      this.loading = false;
    }
  }
}
