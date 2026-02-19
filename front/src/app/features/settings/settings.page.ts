import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { SettingsApiService, AppSettings } from '../../core/api/settings-api.service';
import { HolidayService, HolidayItem } from '../../core/api/holiday.service';
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

        <div class="col-12 col-md-4">
          <label class="form-label">Acquisition mensuelle (jours/mois)</label>
          <input class="form-control" type="number" min="0" max="10" step="0.5" [(ngModel)]="model.leaveAccrual!.perMonth" [ngModelOptions]="{standalone:true}">
          <div class="text-muted" style="font-size:12px">Si &gt; 0 : le solde annuel se calcule automatiquement (solde initial + mois travaillés × taux).</div>
        </div>

        <div class="col-12 col-md-4">
          <label class="form-label">Jour de clôture acquisition (1-28)</label>
          <input class="form-control" type="number" min="1" max="28" step="1" [(ngModel)]="model.leaveAccrual!.cycleDay" [ngModelOptions]="{standalone:true}">
          <div class="text-muted" style="font-size:12px">Exemple 21 : un mois complet est compté de 21 → 21.</div>
        </div>

        <div class="col-12">
          <label class="form-label">Taux d’acquisition par type de contrat (jours/mois)</label>
          <div class="table-responsive">
            <table class="table table-sm">
              <thead><tr><th>Type</th><th style="width:160px">Jours/mois</th><th style="width:80px"></th></tr></thead>
              <tbody>
                <tr *ngFor="let k of contractKeys()">
                  <td><input class="form-control form-control-sm" [(ngModel)]="contractKeyEdits[k]" (blur)="commitRename(k)" [ngModelOptions]="{standalone:true}"></td>
                  <td><input class="form-control form-control-sm" type="number" min="0" max="10" step="0.25" [(ngModel)]="model.leaveAccrual!.byContract![k]" [ngModelOptions]="{standalone:true}"></td>
                  <td><button class="btn btn-outline-danger btn-sm" (click)="removeContract(k)">X</button></td>
                </tr>
              </tbody>
            </table>
          </div>
          <button class="btn btn-outline-primary btn-sm" (click)="addContract()">+ Ajouter un type</button>
          <div class="text-muted" style="font-size:12px">Si un type n’existe pas dans la liste, le système utilise le taux “Acquisition mensuelle” par défaut.</div>
        </div>

        <div class="col-12 col-md-4">
          <label class="form-label">Solde initial par défaut (nouvel employé)</label>
          <input class="form-control" type="number" min="0" max="365" step="0.5" [(ngModel)]="model.leaveAccrual!.defaultInitialBalance" [ngModelOptions]="{standalone:true}">
          <div class="text-muted" style="font-size:12px">Appliqué à la création d’un employé si tu ne renseignes pas un solde initial.</div>
        </div>
      </div>
    </div>

    <div class="card mt-3 p-3" style="border-radius:16px">
      <h5 class="mb-2">Congé maladie</h5>
      <div class="text-muted" style="font-size:13px">
        Définir comment le congé maladie est consommé selon le type de contrat.
      </div>

      <div class="row g-3 mt-1">
        <div class="col-12 col-md-4">
          <label class="form-label">Politique par défaut</label>
          <select class="form-select" [(ngModel)]="model.sickLeave!.defaultPolicy" [ngModelOptions]="{standalone:true}">
            <option [ngValue]="'OWN'">Solde maladie annuel (séparé)</option>
            <option [ngValue]="'ANNUAL'">Déduire du congé annuel</option>
          </select>
        </div>

        <div class="col-12 col-md-4">
          <label class="form-label">Quota maladie annuel par défaut (jours/an)</label>
          <input class="form-control" type="number" min="0" max="365" step="0.5" [(ngModel)]="model.sickLeave!.defaultAnnualQuotaDays" [ngModelOptions]="{standalone:true}">
          <div class="text-muted" style="font-size:12px">Utilisé uniquement si la politique est “Solde séparé (OWN)”.</div>
        </div>

        <div class="col-12">
          <label class="form-label">Politique par type de contrat</label>
          <div class="table-responsive">
            <table class="table table-sm">
              <thead><tr><th>Type</th><th style="width:260px">Politique</th><th style="width:180px">Quota (jours/an)</th></tr></thead>
              <tbody>
                <tr *ngFor="let k of contractKeys()">
                  <td class="align-middle">{{k}}</td>
                  <td>
                    <select class="form-select form-select-sm" [(ngModel)]="model.sickLeave!.byContract![k]" [ngModelOptions]="{standalone:true}">
                      <option [ngValue]="'OWN'">Solde maladie annuel (séparé)</option>
                      <option [ngValue]="'ANNUAL'">Déduire du congé annuel</option>
                    </select>
                  </td>
                  <td>
                    <input class="form-control form-control-sm" type="number" min="0" max="365" step="0.5" [(ngModel)]="model.sickLeave!.annualQuotaByContract![k]" [ngModelOptions]="{standalone:true}">
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="text-muted" style="font-size:12px">
            Si un type n’existe pas dans la liste, l’application utilise la “Politique par défaut”.
          </div>
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
      <h5 class="mb-2">Semaine de travail</h5>
      <div class="text-muted" style="font-size:13px">Choisir les jours de week-end (non travaillés). Cela impacte le calcul des jours ouvrés (congés, etc.).</div>

      <div class="mt-3 d-flex gap-3 flex-wrap">
        <mat-checkbox [checked]="(model.workWeek?.weekendDays||[]).includes(6)" (change)="setWeekendDay(6,$event.checked)">Samedi</mat-checkbox>
        <mat-checkbox [checked]="(model.workWeek?.weekendDays||[]).includes(7)" (change)="setWeekendDay(7,$event.checked)">Dimanche</mat-checkbox>
        <mat-checkbox [checked]="(model.workWeek?.weekendDays||[]).includes(5)" (change)="setWeekendDay(5,$event.checked)">Vendredi</mat-checkbox>
      </div>

      <div class="text-muted mt-2" style="font-size:12px">
        Par défaut: Samedi + Dimanche.
      </div>
    </div>

    <div class="card mt-3 p-3" style="border-radius:16px">
      <h5 class="mb-2">Règles de congé</h5>
      <div class="row g-3">
        <div class="col-12 col-md-4">
          <label class="form-label">Préavis minimum (jours)</label>
          <input class="form-control" type="number" min="0" max="365" [(ngModel)]="model.leaveRules!.minNoticeDays" [ngModelOptions]="{standalone:true}">
          <div class="text-muted" style="font-size:12px">Ex: 2 = demande au moins 2 jours avant.</div>
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label">Max jours par demande</label>
          <input class="form-control" type="number" min="1" max="365" [(ngModel)]="model.leaveRules!.maxDaysPerRequest" [ngModelOptions]="{standalone:true}">
        </div>
        <div class="col-12 col-md-4 d-flex align-items-end">
          <mat-checkbox [checked]="!!model.leaveRules?.allowPastDates" (change)="model.leaveRules!.allowPastDates = $event.checked">
            Autoriser dates passées
          </mat-checkbox>
        </div>
      </div>
      <div class="text-muted mt-2" style="font-size:12px">
        Si “dates passées” est désactivé, l’API refusera une demande dans le passé.
      </div>
    </div>

    <div class="card mt-3 p-3" style="border-radius:16px">
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h5 class="mb-1">Jours fériés</h5>
          <div class="text-muted" style="font-size:13px">Ils sont exclus du calcul des jours ouvrés.</div>
        </div>
        <div class="d-flex gap-2 align-items-center">
          <select class="form-select" style="width:120px" [ngModel]="holidayYear()" (ngModelChange)="holidayYear.set(+$event); loadHolidays()" [ngModelOptions]="{standalone:true}">
            <option *ngFor="let y of [holidayYear() - 1, holidayYear(), holidayYear() + 1]" [ngValue]="y">{{y}}</option>
          </select>
          <button class="btn btn-outline-secondary" (click)="seedHolidays()">Seed</button>
        </div>
      </div>

      <div class="mt-3" *ngIf="holidaysLoading()">Chargement...</div>

      <div class="table-responsive mt-3" *ngIf="!holidaysLoading()">
        <table class="table table-sm align-middle">
          <thead>
            <tr>
              <th style="width:160px">Date</th>
              <th>Libellé</th>
              <th style="width:120px"></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let h of holidays()">
              <td>{{h.date}}</td>
              <td>{{h.label}}</td>
              <td class="text-end">
                <button class="btn btn-sm btn-outline-danger" (click)="deleteHoliday(h.id)">Supprimer</button>
              </td>
            </tr>

            <tr>
              <td>
                <input #newDate class="form-control form-control-sm" placeholder="YYYY-MM-DD">
              </td>
              <td>
                <input #newLabel class="form-control form-control-sm" placeholder="Libellé (ex: Aïd...)">
              </td>
              <td class="text-end">
                <button class="btn btn-sm btn-primary" (click)="addHoliday(newDate.value, newLabel.value); newDate.value=''; newLabel.value=''">Ajouter</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="text-muted mt-2" style="font-size:12px">
        Les fêtes religieuses (Aïd, Mawlid, etc.) changent selon l’année: ajoutez-les ici pour l’année choisie.
      </div>
    </div>
  </div>
  `
})
export class SettingsPage implements OnInit {
  buckets = ['employee','manager','admin'];
  notifTypes = ['LEAVE','ADVANCE','EXIT_PERMISSION'];

  saving = signal(false);

  holidayYear = signal<number>(new Date().getFullYear());
  holidays = signal<HolidayItem[]>([]);
  holidaysLoading = signal(false);

	  // Edit buffers for "type de contrat" keys (prevents input from being overwritten while typing)
	  contractKeyEdits: Record<string, string> = {};
  model: AppSettings = {
    mailNotifications: {
      employee: { ALL: true, LEAVE: true, ADVANCE: true, EXIT_PERMISSION: true },
      manager: { ALL: true, LEAVE: true, ADVANCE: true, EXIT_PERMISSION: true },
      admin: { ALL: true, LEAVE: true, ADVANCE: true, EXIT_PERMISSION: true },
    },
    annualLeaveDays: 18,
    leaveAccrual: { perMonth: 0, defaultInitialBalance: 0, cycleDay: 21, byContract: { CDI: 1.75, CDD: 1.25 } },
    sickLeave: { defaultPolicy: 'OWN', byContract: { CDI: 'OWN', CDD: 'OWN' }, defaultAnnualQuotaDays: 0, annualQuotaByContract: { CDI: 0, CDD: 0 } },
    workWeek: { weekendDays: [6,7] },
    leaveRules: { minNoticeDays: 0, maxDaysPerRequest: 60, allowPastDates: false },
    exit: { enforceHours: false, workStart: '08:00', workEnd: '18:00' }
  };

constructor(private api: SettingsApiService, private holidaysApi: HolidayService, private auth: AuthService, private alert: AlertService) {}
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
    const la = s.leaveAccrual || base.leaveAccrual || { perMonth: 0, defaultInitialBalance: 0 };
    const workWeek = s.workWeek || base.workWeek || { weekendDays: [6,7] };
    const sl = s.sickLeave || (base as any).sickLeave || { defaultPolicy: 'OWN', byContract: {}, defaultAnnualQuotaDays: 0, annualQuotaByContract: {} };
    const leaveRules = s.leaveRules || base.leaveRules || { minNoticeDays: 0, maxDaysPerRequest: 60, allowPastDates: false };
    return {
      mailNotifications: mail,
      annualLeaveDays: typeof s.annualLeaveDays === 'number' ? s.annualLeaveDays : base.annualLeaveDays,
      leaveAccrual: {
        perMonth: typeof la.perMonth === 'number' ? la.perMonth : 0,
        defaultInitialBalance: typeof la.defaultInitialBalance === 'number' ? la.defaultInitialBalance : 0,
        cycleDay: typeof la.cycleDay === 'number' ? la.cycleDay : 21,
        byContract: (la.byContract && typeof la.byContract === 'object' && Object.keys(la.byContract).length) ? la.byContract : { CDI: 1.75, CDD: 1.25 },
      },
      sickLeave: {
        defaultPolicy: (sl.defaultPolicy === 'ANNUAL' ? 'ANNUAL' : 'OWN') as any,
        byContract: (sl.byContract && typeof sl.byContract === 'object') ? sl.byContract : {},
        defaultAnnualQuotaDays: (typeof sl.defaultAnnualQuotaDays === 'number') ? sl.defaultAnnualQuotaDays : 0,
        annualQuotaByContract: (sl.annualQuotaByContract && typeof sl.annualQuotaByContract === 'object') ? sl.annualQuotaByContract : {},
      },
      workWeek: {
        weekendDays: Array.isArray(workWeek.weekendDays) && workWeek.weekendDays.length ? workWeek.weekendDays.map((x:any)=>+x) : [6,7]
      },
      leaveRules: {
        minNoticeDays: typeof leaveRules.minNoticeDays === 'number' ? leaveRules.minNoticeDays : 0,
        maxDaysPerRequest: typeof leaveRules.maxDaysPerRequest === 'number' ? leaveRules.maxDaysPerRequest : 60,
        allowPastDates: !!leaveRules.allowPastDates,
      },
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
      await this.loadHolidays();
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


  async loadHolidays() {
    if (!this.isAdmin()) return;
    this.holidaysLoading.set(true);
    try {
      const year = this.holidayYear();
      const res = await this.holidaysApi.list(year);
      this.holidays.set(res.items || []);
    } catch (e:any) {
      this.alert.toast({ icon: 'error', title: 'Erreur', text: 'Impossible de charger les jours fériés' });
    } finally {
      this.holidaysLoading.set(false);
    }
  }

  async seedHolidays() {
    if (!this.isAdmin()) return;
    try {
      const year = this.holidayYear();
      await this.holidaysApi.seed(year);
      await this.loadHolidays();
      this.alert.toast({ icon: 'success', title: 'OK', text: 'Jours fériés ajoutés (par défaut)' });
    } catch (e:any) {
      this.alert.toast({ icon: 'error', title: 'Erreur', text: 'Échec du seed' });
    }
  }

  async addHoliday(date: string, label: string) {
    if (!this.isAdmin()) return;
    date = (date || '').trim();
    label = (label || '').trim();
    if (!date || !label) return;
    try {
      await this.holidaysApi.create({ date, label });
      await this.loadHolidays();
    } catch (e:any) {
      this.alert.toast({ icon: 'error', title: 'Erreur', text: 'Échec ajout jour férié' });
    }
  }

  async deleteHoliday(id: number) {
    if (!this.isAdmin()) return;
    try {
      await this.holidaysApi.delete(id);
      await this.loadHolidays();
    } catch (e:any) {
      this.alert.toast({ icon: 'error', title: 'Erreur', text: 'Échec suppression' });
    }
  }

  setWeekendDay(n: number, checked: boolean) {
    const set = new Set(this.model.workWeek?.weekendDays || [6,7]);
    if (checked) set.add(n); else set.delete(n);
    const arr = Array.from(set.values()).filter(x => x>=1 && x<=7).sort((a,b)=>a-b);
    this.model.workWeek = { weekendDays: arr.length ? arr : [6,7] };
  }

  
// --- Leave accrual by contract helpers ---
  private ensureContractMap(): Record<string, number> {
    if (!this.model.leaveAccrual) {
      // Fallback defaults (will be overwritten when settings are loaded)
      this.model.leaveAccrual = { perMonth: 0, defaultInitialBalance: 0 } as any;
    }
    const la: any = this.model.leaveAccrual as any;
    if (!la.byContract) la.byContract = {};
    return la.byContract as Record<string, number>;
  }


  private ensureSickMap(): Record<string, 'OWN'|'ANNUAL'> {
    if (!this.model.sickLeave) {
      (this.model as any).sickLeave = { defaultPolicy: 'OWN', byContract: {}, defaultAnnualQuotaDays: 0, annualQuotaByContract: {} };
    }
    const sl: any = (this.model as any).sickLeave;
    if (!sl.byContract) sl.byContract = {};
    // Normalize values
    for (const k of Object.keys(sl.byContract)) {
      const v = String(sl.byContract[k] || '').toUpperCase();
      sl.byContract[k] = (v === 'ANNUAL') ? 'ANNUAL' : 'OWN';
    }
    return sl.byContract as Record<string, 'OWN'|'ANNUAL'>;
  }

  private ensureSickQuotaMap(): Record<string, number> {
    if (!this.model.sickLeave) {
      (this.model as any).sickLeave = { defaultPolicy: 'OWN', byContract: {}, defaultAnnualQuotaDays: 0, annualQuotaByContract: {} };
    }
    const sl: any = (this.model as any).sickLeave;
    if (typeof sl.defaultAnnualQuotaDays !== 'number') sl.defaultAnnualQuotaDays = Number(sl.defaultAnnualQuotaDays || 0) || 0;
    if (!sl.annualQuotaByContract) sl.annualQuotaByContract = {};
    for (const k of Object.keys(sl.annualQuotaByContract)) {
      const n = Number(sl.annualQuotaByContract[k]);
      sl.annualQuotaByContract[k] = isFinite(n) ? Math.max(0, n) : 0;
    }
    return sl.annualQuotaByContract as Record<string, number>;
  }

  contractKeys(): string[] {
    const map = this.ensureContractMap();
    const sl = this.ensureSickMap();
    const sq = this.ensureSickQuotaMap();
    const keys = Object.keys(map).sort((a, b) => a.localeCompare(b));

    // Ensure sick maps contain the same keys
    for (const k of keys) {
      if (sl[k] === undefined) sl[k] = (this.model.sickLeave as any)?.defaultPolicy === 'ANNUAL' ? 'ANNUAL' : 'OWN';
      if (sq[k] === undefined) sq[k] = Number((this.model.sickLeave as any)?.defaultAnnualQuotaDays || 0) || 0;
    }
    // keep edit buffers in sync (avoid input "blocking" while user types)
    const next: Record<string,string> = {};
    for (const k of keys) next[k] = this.contractKeyEdits[k] ?? k;
    this.contractKeyEdits = next;
    return keys;
  }

  commitRename(oldKey: string) {
    const newKeyRaw = this.contractKeyEdits[oldKey] ?? oldKey;
    this.renameContractKey(oldKey, newKeyRaw);
    // re-sync buffers after rename
    this.contractKeys();
  }


  renameContractKey(oldKey: string, newKeyRaw: string) {
    const map = this.ensureContractMap();
    const newKey = (newKeyRaw || '').trim();
    if (!newKey || newKey === oldKey) return;
    if (Object.prototype.hasOwnProperty.call(map, newKey)) {
      this.alert.toast({ icon: 'warning', title: 'Déjà existant', text: 'Ce type de contrat existe déjà.' });
      return;
    }
    const val = map[oldKey];
    delete map[oldKey];
    map[newKey] = val;

    // keep sick leave policy map in sync
    const sl = this.ensureSickMap();
    if (Object.prototype.hasOwnProperty.call(sl, oldKey)) {
      const p = sl[oldKey];
      delete sl[oldKey];
      sl[newKey] = p;
    }

    // keep sick leave quota map in sync
    const sq = this.ensureSickQuotaMap();
    if (Object.prototype.hasOwnProperty.call(sq, oldKey)) {
      const q = sq[oldKey];
      delete sq[oldKey];
      sq[newKey] = q;
    }
  }

  removeContract(key: string) {
    const map = this.ensureContractMap();
    delete map[key];
    const sl = this.ensureSickMap();
    delete sl[key];
    const sq = this.ensureSickQuotaMap();
    delete sq[key];
  }

  addContract() {
    const map = this.ensureContractMap();
    const sl = this.ensureSickMap();
    const sq = this.ensureSickQuotaMap();
    const base = 'NOUVEAU';
    let k = base;
    let i = 2;
    while (Object.prototype.hasOwnProperty.call(map, k)) {
      k = `${base}_${i++}`;
    }
    const fallback = (this.model.leaveAccrual as any)?.perMonth ?? 0;
    map[k] = Number(fallback) || 0;
    sl[k] = (this.model.sickLeave as any)?.defaultPolicy === 'ANNUAL' ? 'ANNUAL' : 'OWN';
    sq[k] = Number((this.model.sickLeave as any)?.defaultAnnualQuotaDays || 0) || 0;
  }

}

