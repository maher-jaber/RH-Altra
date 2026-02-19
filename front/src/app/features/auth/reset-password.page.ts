import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { AlertService } from '../../core/ui/alert.service';

import { environment } from '../../../environments/environment';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  styles: [`
    .wrap { height: 100vh; display:flex; align-items:center; justify-content:center; padding: 16px;
            background:
              radial-gradient(900px 600px at 12% 8%, rgba(37,99,235,.20), transparent 60%),
              radial-gradient(900px 600px at 88% 92%, rgba(124,58,237,.16), transparent 60%),
              radial-gradient(700px 500px at 92% 12%, rgba(6,182,212,.10), transparent 55%),
              var(--bg);
    }
    .card { width: min(560px, 100%); border-radius: 22px; overflow:hidden; border: 1px solid var(--stroke);
            background: linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.06));
            backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
            box-shadow: var(--shadow-2);
    }
    .brand { display:flex; align-items:center; gap: 14px; margin-bottom: 8px; }
    .brand img { width: 56px; height: 56px; object-fit: contain; }
  `],
  template: `
  <div class="wrap">
    <div class="card">
      <div class="card-body">
        <div class="brand">
          <img src="assets/altracall-logo.png" alt="Altra-RH">
          <div>
            <h2 style="margin:0">Réinitialiser le mot de passe</h2>
            <p style="margin:0;color:var(--text-2)">Entrez le token et le nouveau mot de passe.</p>
          </div>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" style="margin-top:14px">
          <div class="mb-3">
            <label class="form-label">Token</label>
            <input class="form-control" formControlName="token">
          </div>

          <div class="mb-3">
            <label class="form-label">Nouveau mot de passe</label>
            <input class="form-control" type="password" formControlName="password">
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
            <a routerLink="/login">Retour</a>
            <button class="btn btn-primary" type="submit" [disabled]="form.invalid || loading">
              {{loading ? 'Sauvegarde...' : 'Mettre à jour'}}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
  `
})
export class ResetPasswordPageComponent {
  loading = false;

  form = new FormGroup({
    token: new FormControl('', [Validators.required]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
  });

  constructor(private http: HttpClient, private route: ActivatedRoute, private router: Router, private alert: AlertService) {
    const t = this.route.snapshot.queryParamMap.get('token');
    if (t) this.form.patchValue({ token: t });
  }

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading = true;

    try {
      await firstValueFrom(this.http.post(`${environment.apiBaseUrl}/api/auth/reset-password`, this.form.value));
      this.alert.toast({ icon: 'success', title: 'Mot de passe mis à jour', text: 'Vous pouvez vous connecter.' });
      this.router.navigateByUrl('/login');
    } catch {
      await this.alert.error('Échec', 'Token invalide ou API indisponible');
    } finally {
      this.loading = false;
    }
  }
}
