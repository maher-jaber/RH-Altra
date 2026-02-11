import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { AlertService } from '../../core/ui/alert.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  styles: [`
    .grid { display:grid; grid-template-columns: 1.1fr .9fr; gap: 18px; }
    @media (max-width: 980px){ .grid { grid-template-columns: 1fr; } }
    .k { color: var(--text-2); font-weight: 700; font-size: 12px; letter-spacing: .3px; }
    .v { color: var(--text); font-weight: 800; }
    .row { display:flex; align-items:center; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--stroke); }
    .row:last-child { border-bottom: none; }
    .badge-role { background: rgba(29,78,216,0.10); color: var(--text); border: 1px solid var(--stroke); }
  `],
  template: `
  <div class="container" style="max-width: 1100px;">
    <div class="grid">
      <div class="card">
        <div class="card-body">
          <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <h3 class="mb-1" style="font-weight:900;">Mon profil</h3>
              <div style="color:var(--text-2)">Informations de session et accès.</div>
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-outline-primary" type="button" (click)="refresh()">
                <i class="bi bi-arrow-clockwise me-2"></i>Actualiser
              </button>
              <button class="btn btn-primary" type="button" (click)="logout()">
                <i class="bi bi-box-arrow-right me-2"></i>Déconnexion
              </button>
            </div>
          </div>

          <div class="mt-3" *ngIf="auth.me() as me">
            <div class="row">
              <div>
                <div class="k">Nom complet</div>
                <div class="v">{{me.fullName}}</div>
              </div>
              <span class="badge badge-role rounded-pill px-3 py-2">{{roleLabel()}}</span>
            </div>
            <div class="row">
              <div>
                <div class="k">Identifiant</div>
                <div class="v">{{me.id}}</div>
              </div>
            </div>
            <div class="row">
              <div>
                <div class="k">Rôles</div>
                <div class="v" style="font-size: 13px;">{{(me.roles || []).join(', ')}}</div>
              </div>
            </div>
          </div>

          <div class="alert alert-info mt-3" role="alert">
            <b>Note :</b> La modification du profil (nom/email/mot de passe) dépend des endpoints backend.
            Pour l’instant, cet écran affiche l’état de session + offre la déconnexion.
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <h5 class="mb-2" style="font-weight:900;">Diagnostic API</h5>
          <p style="color:var(--text-2); margin-bottom: 12px;">
            Vérifie que les endpoints utilisés par le front répondent correctement.
          </p>

          <div class="d-grid gap-2">
            <a class="btn btn-outline-primary" routerLink="/notifications"><i class="bi bi-bell me-2"></i>Ouvrir Notifications</a>
            <a class="btn btn-outline-primary" routerLink="/dashboard"><i class="bi bi-speedometer2 me-2"></i>Retour Dashboard</a>
          </div>

          <div class="mt-3" style="font-size: 12px; color: var(--text-2);">
            API: <b>.../api/me</b>, <b>.../api/notifications</b>, <b>.../api/*</b>
          </div>
        </div>
      </div>
    </div>
  </div>
  `
})
export class ProfilePage {
  constructor(
    public auth: AuthService,
    private router: Router,
    private alert: AlertService,
  ) {}

  async refresh() {
    try {
      await this.auth.refreshMe();
      await this.alert.success('OK', 'Profil actualisé');
    } catch {
      await this.alert.error('Erreur', "Impossible d'actualiser /api/me");
    }
  }

  logout() {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  roleLabel(): string {
    const roles = this.auth.me()?.roles || [];
    if (roles.includes('ROLE_ADMIN')) return 'Administrateur';
    if (roles.includes('ROLE_SUPERIOR')) return 'Manager';
    return 'Employé';
  }
}
