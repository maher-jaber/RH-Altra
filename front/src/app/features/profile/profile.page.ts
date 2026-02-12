import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/auth.service';
import { AlertService } from '../../core/ui/alert.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  styles: [`
    .grid { display:grid; grid-template-columns: 1.1fr .9fr; gap: 18px; }
    @media (max-width: 980px){ .grid { grid-template-columns: 1fr; } }
    .k { color: var(--text-2); font-weight: 800; font-size: 12px; letter-spacing: .3px; }
    .badge-role { background: rgba(29,78,216,0.10); color: var(--text); border: 1px solid var(--stroke); }
    .hint { font-size: 12px; color: var(--text-2); }
  `],
  template: `
  <div class="container" style="max-width: 1100px;">
    <div class="grid">
      <div class="card">
        <div class="card-body">
          <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <h3 class="mb-1" style="font-weight:900;">Mon profil</h3>
              <div style="color:var(--text-2)">Modifier vos informations personnelles.</div>
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-outline-primary" type="button" (click)="refresh()" [disabled]="saving()">
                <i class="bi bi-arrow-clockwise me-2"></i>Actualiser
              </button>
              <button class="btn btn-primary" type="button" (click)="save()" [disabled]="saving()">
                <i class="bi bi-check2-circle me-2"></i>Enregistrer
              </button>
            </div>
          </div>

          <div class="mt-3" *ngIf="auth.me() as me">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div>
                <div class="k">Rôle</div>
                <span class="badge badge-role rounded-pill px-3 py-2">{{roleLabel()}}</span>
              </div>
              <div class="hint">ID: <b>{{me.id}}</b></div>
            </div>

            <hr class="my-3">

            <div class="row g-3">
              <div class="col-12">
                <label class="form-label">Nom complet</label>
                <input class="form-control" [(ngModel)]="formFullName" [ngModelOptions]="{standalone:true}" placeholder="Votre nom complet">
              </div>

              <div class="col-12">
                <label class="form-label">Email</label>
                <input class="form-control" [(ngModel)]="formEmail" [ngModelOptions]="{standalone:true}" placeholder="email@domaine.com">
                <div class="hint mt-1">⚠️ Si vous changez l’email, il doit rester unique.</div>
              </div>
            </div>

            <hr class="my-3">

            <div class="d-flex align-items-center justify-content-between">
              <div>
                <div class="k">Mot de passe</div>
                <div class="hint">Laisser vide si vous ne voulez pas le changer.</div>
              </div>
              <button class="btn btn-sm btn-outline-secondary" type="button" (click)="togglePwd()">
                <i class="bi" [ngClass]="showPwd() ? 'bi-eye-slash' : 'bi-eye'"></i>
                {{showPwd() ? 'Masquer' : 'Afficher'}}
              </button>
            </div>

            <div class="row g-3 mt-1">
              <div class="col-12">
                <label class="form-label">Mot de passe actuel</label>
                <input class="form-control" [type]="showPwd() ? 'text' : 'password'" [(ngModel)]="currentPassword" [ngModelOptions]="{standalone:true}">
              </div>
              <div class="col-12 col-md-6">
                <label class="form-label">Nouveau mot de passe</label>
                <input class="form-control" [type]="showPwd() ? 'text' : 'password'" [(ngModel)]="newPassword" [ngModelOptions]="{standalone:true}">
              </div>
              <div class="col-12 col-md-6">
                <label class="form-label">Confirmation</label>
                <input class="form-control" [type]="showPwd() ? 'text' : 'password'" [(ngModel)]="confirmPassword" [ngModelOptions]="{standalone:true}">
              </div>
            </div>

          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <h5 class="mb-2" style="font-weight:900;">Accès rapide</h5>
          <p style="color:var(--text-2); margin-bottom: 12px;">
            Actions utiles (session / navigation).
          </p>

          <div class="d-grid gap-2">
            <a class="btn btn-outline-primary" routerLink="/notifications"><i class="bi bi-bell me-2"></i>Notifications</a>
            <a class="btn btn-outline-primary" routerLink="/dashboard"><i class="bi bi-speedometer2 me-2"></i>Dashboard</a>
            <button class="btn btn-outline-danger" type="button" (click)="logout()"><i class="bi bi-box-arrow-right me-2"></i>Déconnexion</button>
          </div>

          <div class="mt-3 hint">
            Endpoints: <b>GET/PUT /api/me</b>
          </div>
        </div>
      </div>
    </div>
  </div>
  `
})
export class ProfilePage implements OnInit {
  saving = signal(false);
  showPwd = signal(false);

  formFullName = '';
  formEmail = '';
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  constructor(
    public auth: AuthService,
    private router: Router,
    private alert: AlertService,
  ) {}

  async ngOnInit() {
    await this.refresh(false);
  }

  togglePwd() { this.showPwd.set(!this.showPwd()); }

  roleLabel(): string {
    const roles = this.auth.me()?.roles || [];
    if (roles.includes('ROLE_ADMIN' as any)) return 'Administrateur';
    if (roles.includes('ROLE_SUPERIOR' as any)) return 'Manager';
    return 'Employé';
  }

  async refresh(showToast = true) {
    try {
      await this.auth.refreshMe();
      const me = this.auth.me();
      this.formFullName = me?.fullName || '';
      this.formEmail = me?.email || '';
      if (showToast) await this.alert.success('OK', 'Profil actualisé');
    } catch {
      if (showToast) await this.alert.error('Erreur', 'Impossible de charger le profil');
    }
  }

  private buildPayload(): any {
    const payload: any = {};
    payload.fullName = (this.formFullName || '').trim();
    payload.email = (this.formEmail || '').trim();

    const newPwd = (this.newPassword || '').trim();
    const confirmPwd = (this.confirmPassword || '').trim();
    const currentPwd = (this.currentPassword || '').trim();

    // Only attempt password change if user entered a NEW password (or confirmation)
    const wantsPwd = newPwd !== '' || confirmPwd !== '';
    if (wantsPwd) {
      if (newPwd !== confirmPwd) {
        throw new Error('PASSWORD_MISMATCH');
      }
      payload.currentPassword = currentPwd;
      payload.newPassword = newPwd;
    }
    return payload;
  }

  async save() {
    this.saving.set(true);
    try {
      const payload = this.buildPayload();
      await this.auth.updateMe(payload);

      // clear password fields after success
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';

      await this.alert.success('Enregistré', 'Profil mis à jour');
    } catch (e:any) {
      if (e?.message === 'PASSWORD_MISMATCH') {
        await this.alert.error('Erreur', 'Confirmation mot de passe incorrecte');
      } else {
        await this.alert.error('Erreur', 'Échec de mise à jour du profil');
      }
    } finally {
      this.saving.set(false);
    }
  }

  async logout() {
    this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
