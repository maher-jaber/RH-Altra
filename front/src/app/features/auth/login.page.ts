import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatSnackBarModule
  ],
  styles: [`
    .wrap { height: 100vh; display:flex; align-items:center; justify-content:center; padding: 16px;
            background: radial-gradient(1200px 800px at 10% 10%, rgba(255,152,0,.16), transparent),
                        radial-gradient(1200px 800px at 90% 90%, rgba(25,118,210,.12), transparent),
                        #f4f6f8; }
    mat-card { width: min(560px, 100%); border-radius: 16px; overflow: hidden; }
    .brand { display:flex; align-items:center; gap: 14px; margin-bottom: 8px; }
    .brand img { width: 56px; height: 56px; object-fit: contain; }
    .brand h1 { font-size: 20px; margin: 0; letter-spacing: .5px; }
    .sub { color: rgba(0,0,0,.6); margin: 0 0 14px; }
    .row { display:grid; grid-template-columns: 1fr; gap: 10px; }
    .actions { display:flex; justify-content: space-between; align-items:center; gap: 12px; margin-top: 10px; flex-wrap: wrap;}
    a { text-decoration:none; }
  `],
  template: `
  <div class="wrap">
    <mat-card>
      <mat-card-content>
        <div class="brand">
          <img src="assets/altracall-logo.png" alt="ALTRACALL">
          <div>
            <h1>ALTRACALL HR</h1>
            <p class="sub">Connexion à l’espace RH</p>
          </div>
        </div>

        <form class="row" [formGroup]="form" (ngSubmit)="onSubmit()">
          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input matInput formControlName="email" placeholder="ex: admin@altracall.com">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Mot de passe</mat-label>
            <input matInput type="password" formControlName="password" placeholder="••••••••">
          </mat-form-field>

          <div class="actions">
            <a routerLink="/forgot-password">Mot de passe oublié ?</a>
            <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || loading">
              {{loading ? 'Connexion...' : 'Se connecter'}}
            </button>
          </div>
        </form>

        <p style="margin-top:14px;color:rgba(0,0,0,.55);font-size:12px;">
          Astuce dev: si c’est la première installation, l’admin par défaut est <b>admin&#64;altracall.com</b> / <b>Admin&#64;1234</b>.
        </p>
      </mat-card-content>
    </mat-card>
  </div>
  `
})
export class LoginPageComponent {
  loading = false;

  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)])
  });

  constructor(
    private auth: AuthService,
    private router: Router,
    private snack: MatSnackBar
  ) {}

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading = true;

    try {
      await this.auth.login(this.form.value.email!, this.form.value.password!);
      this.router.navigateByUrl('/dashboard');
    } catch (e) {
      this.snack.open("Email ou mot de passe invalide, ou API indisponible", "OK", { duration: 3500 });
    } finally {
      this.loading = false;
    }
  }
}
