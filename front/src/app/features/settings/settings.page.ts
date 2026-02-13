import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { SettingsApiService, AppSettings } from '../../core/api/settings-api.service';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AlertService } from '../../core/ui/alert.service';

@Component({
  standalone: true,
  selector: 'app-settings',
  imports: [CommonModule, FormsModule, MatCheckboxModule, RouterModule],
  template: `
  <div class="d-flex align-items-center justify-content-between">
    <h2 style="margin:0">Paramètres</h2>
    <button class="btn btn-primary" (click)="save()" [disabled]="saving()">Enregistrer</button>
  </div>

  <div class="alert alert-warning mt-3" *ngIf="!isAdmin()">
    Accès administrateur requis.
  </div>

  <div *ngIf="isAdmin()">
    <div class="card mt-3 p-3" style="border-radius:16px">
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h5 class="mb-1">Outils</h5>
          <div class="text-muted" style="font-size:13px">Accès rapide à des écrans d'administration.</div>
        </div>
      </div>
    </div>

    <div class="card mt-3 p-3" style="border-radius:16px">
      <h5 class="mb-2">Emails de notification</h5>
      <div class="text-muted" style="font-size:13px">Activer / désactiver les emails par type de personne.</div>

      <div class="mt-3">
        <div class="row g-3">
          <div class="col-12 col-lg-4" *ngFor="let bucket of buckets">
            <div class="border rounded-3 p-3">
              <div class="fw-semibold text-capitalize">{{bucket}}</div>
              <div class="mt-2">
                <mat-checkbox
                  [checked]="!!model.mailNotifications[bucket].ALL"
                  (change)="toggle(bucket, 'ALL', $event.checked)">
                  Tous les emails
                </mat-checkbox>
              </div>

              <div class="mt-2" *ngFor="let t of notifTypes">
                <mat-checkbox
                  [checked]="!!model.mailNotifications[bucket][t]"
                  (change)="toggle(bucket, t, $event.checked)">
                  {{t}}
                </mat-checkbox>
              </div>

              <div class="text-muted mt-2" style="font-size:12px">
                Si “Tous les emails” est activé, il sert de valeur par défaut.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card mt-3 p-3" style="border-radius:16px">
      <h5 class="mb-2">Congé annuel</h5>
      <div class="row g-3">
        <div class="col-12 col-md-4">
          <label class="form-label">Nombre de jours annuels</label>
          <input class="form-control" type="number" min="0" max="60" [(ngModel)]="model.annualLeaveDays" [ngModelOptions]="{standalone:true}">
        </div>
      </div>
    </div>

    <div class="card mt-3 p-3" style="border-radius:16px">
      <h5 class="mb-2">Autorisation de sortie</h5>
      <div class="row g-3">
        <div class="col-12 col-md-4">
          <label class="form-label">Horaire début (HH:MM)</label>
          <input class="form-control" [(ngModel)]="model.exit.workStart" [ngModelOptions]="{standalone:true}">
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label">Horaire fin (HH:MM)</label>
          <input class="form-control" [(ngModel)]="model.exit.workEnd" [ngModelOptions]="{standalone:true}">
        </div>
        <div class="col-12 col-md-4 d-flex align-items-end">
          <mat-checkbox
            [checked]="!!model.exit.enforceHours"
            (change)="toggleExitEnforce($event.checked)">
            Appliquer la règle horaire
          </mat-checkbox>
        </div>
      </div>
      <div class="text-muted mt-2" style="font-size:12px">
        Si activé, l’API refusera une autorisation en dehors de la fenêtre (erreur: outside_work_hours).
      </div>
    </div>

    <div class="card mt-3 p-3" style="border-radius:16px">
      <h5 class="mb-2">À venir</h5>
      <div class="text-muted" style="font-size:13px">
        Cet espace “Paramètres” est conçu pour accueillir toutes les options de configuration (jours fériés, règles de calcul, workflows, etc.).
      </div>
    </div>
  </div>
  `
})
export class SettingsPage implements OnInit {
  buckets = ['employee','manager','admin'];
  notifTypes = ['LEAVE','ADVANCE','EXIT_PERMISSION'];

  saving = signal(false);
  model: AppSettings = {
    mailNotifications: {
      employee: { ALL: true, LEAVE: true, ADVANCE: true, EXIT_PERMISSION: true },
      manager: { ALL: true, LEAVE: true, ADVANCE: true, EXIT_PERMISSION: true },
      admin: { ALL: true, LEAVE: true, ADVANCE: true, EXIT_PERMISSION: true },
    },
    annualLeaveDays: 18,
    exit: { enforceHours: false, workStart: '08:00', workEnd: '18:00' }
  };

constructor(private api: SettingsApiService, private auth: AuthService, private alert: AlertService) {}
  private normalize(input: Partial<AppSettings> | null | undefined): AppSettings {
    const base = this.model;
    const s: any = input || {};
    const mail: any = s.mailNotifications || base.mailNotifications;

    // Ensure buckets + types exist to avoid template undefined errors
    for (const b of this.buckets) {
      mail[b] = mail[b] || { ALL: true };
      for (const t of this.notifTypes) {
        if (mail[b][t] === undefined) mail[b][t] = true;
      }
      if (mail[b].ALL === undefined) mail[b].ALL = true;
    }

    const exit = s.exit || base.exit;
    return {
      mailNotifications: mail,
      annualLeaveDays: typeof s.annualLeaveDays === 'number' ? s.annualLeaveDays : base.annualLeaveDays,
      exit: {
        enforceHours: !!exit.enforceHours,
        workStart: exit.workStart || base.exit.workStart,
        workEnd: exit.workEnd || base.exit.workEnd,
      }
    };
  }


  isAdmin(): boolean {
    const r = this.auth.me()?.roles || [];
    return r.includes('ROLE_ADMIN');
  }

  async ngOnInit() {
    if (!this.isAdmin()) return;
    try {
      const s = await this.api.get();
      this.model = this.normalize(s);
    } catch (e:any) {
      this.alert.toast({ icon: 'error', title: 'Erreur', text: 'Impossible de charger les paramètres' });
    }
  }

  async save() {
    if (!this.isAdmin()) return;
    this.saving.set(true);
    try {
      await this.api.update(this.model);
      this.alert.toast({ icon: 'success', title: 'Enregistré', text: 'Paramètres mis à jour' });
    } catch (e:any) {
      this.alert.toast({ icon: 'error', title: 'Erreur', text: 'Échec enregistrement' });
    } finally {
      this.saving.set(false);
    }
  }

  // ---- Stable checkbox handling (avoid ngModel edge-cases on dynamic keys) ----
  toggle(bucket: string, key: string, checked: boolean) {
    
    // Ensure path exists
    (this.model.mailNotifications as any)[bucket] = (this.model.mailNotifications as any)[bucket] || { ALL: true };
    (this.model.mailNotifications as any)[bucket][key] = checked;
  }

  toggleExitEnforce(checked: boolean) {
    this.model.exit.enforceHours = !!checked;
  }
}