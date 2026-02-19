import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { AlertService } from '../../core/ui/alert.service';

import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterModule
  ],
  styles: [`
    .wrap { height: 100vh; display:flex; align-items:center; justify-content:center; padding: 16px;
            background:
              radial-gradient(900px 600px at 12% 8%, rgba(37,99,235,.35), transparent 60%),
              radial-gradient(900px 600px at 88% 92%, rgba(124,58,237,.28), transparent 60%),
              radial-gradient(700px 500px at 92% 12%, rgba(6,182,212,.18), transparent 55%),
              var(--bg); }
    .card { width: min(560px, 100%); border-radius: 22px; overflow: hidden; border: 1px solid var(--stroke);
               background: linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.06));
               backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
               box-shadow: var(--shadow-2); }
    .brand { display:flex; align-items:center; gap: 14px; margin-bottom: 8px; }
    .brand img { width: 56px; height: 56px; object-fit: contain; filter: drop-shadow(0 12px 26px rgba(0,0,0,.45)); }
    .brand h1 { font-size: 20px; margin: 0; letter-spacing: .6px; color: var(--text); }
    .sub { color: var(--text-2); margin: 0 0 14px; }
    .row { display:grid; grid-template-columns: 1fr; gap: 10px; }
    .actions { display:flex; justify-content: space-between; align-items:center; gap: 12px; margin-top: 10px; flex-wrap: wrap;}
    a { text-decoration:none; }
  `],
  template: `
  <div class="wrap">
    <div class="card">
      <div class="card-body">
        <div class="brand">
          <img src="assets/altracall-logo.png" alt="Altra-RH">
          <div>
            <h1>Altra-RH</h1>
            <p class="sub">Connexion à l’espace RH</p>
          </div>
        </div>

        <form class="row" [formGroup]="form" (ngSubmit)="onSubmit()">
          <div class="mb-3">
            <label class="form-label">Email</label>
            <input class="form-control" type="email" formControlName="email" placeholder="ex: admin@altracall.com">
          </div>

          <div class="mb-3">
            <label class="form-label">Mot de passe</label>
            <input class="form-control" type="password" formControlName="password" placeholder="••••••••">
          </div>

          <div class="actions">
            <a routerLink="/forgot-password">Mot de passe oublié ?</a>
            <button class="btn btn-primary" type="submit" [disabled]="form.invalid || loading">
              {{loading ? 'Connexion...' : 'Se connecter'}}
            </button>
          </div>
        </form>

        <p style="margin-top:14px;color:var(--text-2);font-size:12px;">
          Astuce dev: si c’est la première installation, l’admin par défaut est <b>admin&#64;altracall.com</b> / <b>Admin&#64;1234</b>.
        </p>
      </div>
    </div>
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
    private alert: AlertService
  ) {}

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading = true;

    try {
      await this.auth.login(this.form.value.email!, this.form.value.password!);
      this.router.navigateByUrl('/dashboard');
    } catch (e) {
      await this.alert.error('Connexion impossible', "Email ou mot de passe invalide, ou API indisponible");
    } finally {
      this.loading = false;
    }
  }
}
