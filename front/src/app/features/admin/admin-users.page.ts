import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminUserService } from '../../core/api/admin-user.service';
import { DepartmentService } from '../../core/api/department.service';
import { AlertService } from '../../core/ui/alert.service';
import { AdminUser, Department, Role } from '../../core/models';
import { AuthService } from '../../core/auth.service';
import { Router } from '@angular/router';
import { SettingsApiService } from '../../core/api/settings-api.service';

// Backend uses ROLE_SUPERIOR for managers. Keep UI wording "Manager".
type UiRole = 'ROLE_EMPLOYEE' | 'ROLE_SUPERIOR' | 'ROLE_ADMIN';

@Component({
  standalone: true,
  selector: 'app-admin-users',
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  styles: [`
    .page-card { border: 1px solid var(--stroke); border-radius: 18px; background: var(--surface); box-shadow: var(--shadow-sm); }
    .page-card-header { padding: 14px 16px; border-bottom: 1px solid var(--stroke); background: rgba(255,255,255,.55); border-top-left-radius: 18px; border-top-right-radius: 18px; }
    .page-card-body { padding: 16px; }
    .muted { opacity: .75; font-size: 12px; }
    .pill { display:inline-flex; align-items:center; gap:6px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--stroke); background: rgba(255,255,255,.65); font-size: 12px; }
    /* Simple modal (no dependency) */
    .modal-backdropx{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1040;}
    .modalx{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:1050;padding:16px;}
    /* Make modal always fit viewport; body scrolls when long */
    .modalx-dialog{width:min(760px,100%);max-height:calc(100vh - 64px);border-radius:18px;overflow:hidden;border:1px solid var(--stroke);background:var(--surface);box-shadow:0 30px 90px rgba(0,0,0,.22);display:flex;flex-direction:column;}
    .modalx-header{padding:14px 16px;border-bottom:1px solid var(--stroke);display:flex;align-items:center;justify-content:space-between;}
    .modalx-body{padding:16px;overflow:auto;}
    .modalx-footer{padding:14px 16px;border-top:1px solid var(--stroke);display:flex;gap:10px;justify-content:flex-end;}
  `],
  template: `
    <div class="page-card">
      <div class="page-card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <div class="h5 mb-0">Utilisateurs</div>
          <div class="text-muted small">Gestion des comptes (création, modification, rôles, informations RH).</div>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-primary btn-sm" (click)="openCreate()">
            <i class="bi bi-plus-lg"></i><span class="ms-1">Ajouter</span>
          </button>
          <button class="btn btn-outline-secondary btn-sm" (click)="reload()">
            <i class="bi bi-arrow-clockwise"></i><span class="ms-1">Rafraîchir</span>
          </button>
        </div>
      </div>

      <div class="page-card-body">
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
          <div class="d-flex align-items-center gap-2">
            <input class="form-control form-control-sm" style="max-width: 320px" placeholder="Rechercher (nom ou email)…" [(ngModel)]="q" (ngModelChange)="applyFilter()"/>
            <span class="text-muted small">{{ filtered().length }} résultat(s)</span>
          </div>

          <div class="d-flex align-items-center gap-2">
            <select class="form-select form-select-sm" style="max-width: 200px" [(ngModel)]="roleFilter" (ngModelChange)="applyFilter()">
              <option value="">Tous les rôles</option>
              <option value="ROLE_EMPLOYEE">Employé</option>
              <option value="ROLE_SUPERIOR">Manager</option>
              <option value="ROLE_ADMIN">Admin</option>
            </select>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table align-middle">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Rôle</th>
                <th>Département</th>
                <th>Manager</th>
                <th>Type contrat</th>
                <th>Salaire net</th>
                <th>Embauche</th>
                <th>Solde congés</th>
                <th style="width: 210px"></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let u of pageItems()">
                <td>
                  <div class="fw-semibold">{{ u.fullName || '—' }}</div>
                  <div class="muted">{{ u.email }}</div>
                </td>
                <td>
                  <span class="pill"><i class="bi bi-shield-lock"></i>{{ roleLabel(primaryRole(u)) }}</span>
                </td>
                <td class="small">{{ deptName(u.departmentId || u.department?.id) }}</td>
                <td class="small">{{ managerName(u.managerId || u.manager?.id) }}</td>
                <td class="small">{{ u.contractType || '—' }}</td>
                <td class="small">{{ u.netSalary ?? '—' }}</td>
                <td class="small">{{ u.hireDate ?? '—' }}</td>
                <td class="small">{{ u.leaveInitialBalance ?? '—' }}</td>
                <td class="text-end">
                  <button class="btn btn-outline-secondary btn-sm me-2" (click)="openEdit(u)">
                    <i class="bi bi-pencil"></i><span class="ms-1">Modifier</span>
                  </button>
                  <button class="btn btn-outline-danger btn-sm" (click)="remove(u)">
                    <i class="bi bi-trash"></i><span class="ms-1">Supprimer</span>
                  </button>
                </td>
              </tr>

              <tr *ngIf="pageItems().length === 0">
                <td colspan="8" class="text-center text-muted py-4">
                  Aucun utilisateur.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="d-flex align-items-center justify-content-between mt-2">
          <div class="text-muted small">
            Page {{ pageIndex()+1 }} / {{ pageCount() }} • {{ filtered().length }} total
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-outline-secondary btn-sm" [disabled]="pageIndex()===0" (click)="prevPage()">Précédent</button>
            <button class="btn btn-outline-secondary btn-sm" [disabled]="pageIndex()+1>=pageCount()" (click)="nextPage()">Suivant</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <ng-container *ngIf="modalOpen()">
      <div class="modal-backdropx" (click)="closeModal()"></div>
      <div class="modalx" role="dialog" aria-modal="true">
        <div class="modalx-dialog">
          <div class="modalx-header">
            <div class="h6 mb-0">{{ modalMode() === 'create' ? 'Ajouter un utilisateur' : 'Modifier l’utilisateur' }}</div>
            <button class="btn btn-sm btn-outline-secondary" (click)="closeModal()"><i class="bi bi-x-lg"></i></button>
          </div>

          <div class="modalx-body">
            <form [formGroup]="form" class="row g-3">
              <div class="col-md-6">
                <label class="form-label">Nom complet</label>
                <input class="form-control" formControlName="fullName" placeholder="Ex: Ahmed Ben Ali"/>
              </div>

              <div class="col-md-6">
                <label class="form-label">Email</label>
                <input class="form-control" formControlName="email" placeholder="nom@domaine.com"/>
              </div>

              <div class="col-md-4">
                <label class="form-label">Rôle</label>
                <select class="form-select" formControlName="role">
                  <option value="ROLE_EMPLOYEE">Employé</option>
                  <option value="ROLE_SUPERIOR">Manager</option>
                  <option value="ROLE_ADMIN">Admin</option>
                </select>
              </div>

              <div class="col-md-4">
                <label class="form-label">Date d’embauche</label>
                <input class="form-control" type="date" formControlName="hireDate"/>
              </div>

              <div class="col-md-4">
                <label class="form-label">Solde congés initial</label>
                <input class="form-control" type="number" step="0.5" min="0" formControlName="initialLeaveBalance"/>
              </div>

              <div class="col-md-4">
                <label class="form-label">Salaire net</label>
                <input class="form-control" type="number" step="0.01" min="0" formControlName="netSalary"/>
              </div>

              <div class="col-md-4">
                <label class="form-label">Type de contrat</label>
                <select class="form-select" formControlName="contractType">
                  <option *ngFor="let ct of contractTypes()" [value]="ct">{{ ct }}</option>
                </select>
                <div class="form-text">
                  Taux d’acquisition: <strong>{{ contractRates()[form.value.contractType || ''] ?? (0) }}</strong> jours/mois
                </div>
              </div>

              <div class="col-md-4">
                <label class="form-label">Département</label>
                <select class="form-select" formControlName="departmentId">
                  <option [ngValue]="null">—</option>
                  <option *ngFor="let d of departments()" [ngValue]="d.id">{{ d.name }}</option>
                </select>
              </div>

              <div class="col-md-4">
                <label class="form-label">Manager 1</label>
                <select class="form-select" formControlName="managerId">
                  <option [ngValue]="null">—</option>
                  <option *ngFor="let u of users()" [ngValue]="u.id">{{ u.fullName }}</option>
                </select>
              </div>

              <div class="col-md-4">
                <label class="form-label">Manager 2</label>
                <select class="form-select" formControlName="manager2Id">
                  <option [ngValue]="null">—</option>
                  <option *ngFor="let u of users()" [ngValue]="u.id">{{ u.fullName }}</option>
                </select>
              </div>

              <div class="col-md-8" *ngIf="modalMode()==='create'">
                <label class="form-label">Mot de passe (sera envoyé par email)</label>
                <input class="form-control" type="text" formControlName="password" placeholder="Ex: Temp@1234"/>
                <div class="form-text">Conseil: utilise un mot de passe temporaire, l’utilisateur pourra le changer ensuite.</div>
              </div>

              <div class="col-md-8" *ngIf="modalMode()==='edit'">
                <label class="form-label">Réinitialiser le mot de passe (optionnel)</label>
                <input class="form-control" type="text" formControlName="password" placeholder="Laisser vide pour ne pas changer"/>
              </div>

            </form>
          </div>

          <div class="modalx-footer">
            <button class="btn btn-outline-secondary" (click)="closeModal()">Annuler</button>
            <button class="btn btn-primary" [disabled]="form.invalid || saving()" (click)="save()">
              <span *ngIf="!saving()">Enregistrer</span>
              <span *ngIf="saving()">Enregistrement…</span>
            </button>
          </div>
        </div>
      </div>
    </ng-container>
  `
})
export class AdminUsersPageComponent implements OnInit {
  // state
  users = signal<AdminUser[]>([]);
  departments = signal<Department[]>([]);
  // contract types + accrual rates (from Settings)
  contractRates = signal<Record<string, number>>({ CDI: 1.75, CDD: 1.25 });
  contractTypes = computed(() => Object.keys(this.contractRates()).sort((a,b)=>a.localeCompare(b)));

  saving = signal(false);

  // filters + pagination (client-side)
  q = '';
  roleFilter = '';
  private _pageIndex = signal(0);
  pageIndex = () => this._pageIndex();
  pageSize = 10;

  // modal
  modalOpen = signal(false);
  modalMode = signal<'create' | 'edit'>('create');
  editingId: string | null = null;

  form = this.fb.group({
    fullName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    role: ['ROLE_EMPLOYEE' as UiRole, [Validators.required]],
    departmentId: [null as any],
    managerId: [null as any],
    manager2Id: [null as any],
    hireDate: ['' as any],
    initialLeaveBalance: [null as any],
    netSalary: [null as any],
    contractType: ['CDD' as any],
    password: ['' as any],
  });

  constructor(
    private fb: FormBuilder,
    private api: AdminUserService,
    private departmentsApi: DepartmentService,
    private settingsApi: SettingsApiService,
    private alert: AlertService,
    private auth: AuthService,
    private router: Router,
  ) {}

  async ngOnInit() {
    await this.loadSettings();
    await this.reload();
  }

  async loadSettings() {
    try {
      const s: any = await this.settingsApi.get();
      const map: any = s?.leaveAccrual?.byContract;
      if (map && typeof map === 'object' && Object.keys(map).length) {
        // backend normalizes keys to UPPERCASE; keep as-is
        this.contractRates.set(map);
      } else {
        this.contractRates.set({ CDI: 1.75, CDD: 1.25 });
      }
    } catch {
      // fallback defaults if settings endpoint is not available
      this.contractRates.set({ CDI: 1.75, CDD: 1.25 });
    }
  }
  primaryRole(u: any): any {
    // on retourne toujours une valeur "role" exploitable côté template
    const r = (u?.roles && u.roles.length ? u.roles[0] : null);
    return r || 'ROLE_EMPLOYEE';
  }
  async reload() {
    try {
      const usersRes = await this.api.list();
      const deptsRes = await this.departmentsApi.list();
      // list() returns {items, meta}
      this.users.set(usersRes.items || []);
      this.departments.set(deptsRes.items || []);
      this.applyFilter();
    } catch (e:any) {
      this.alert.error('Impossible de charger les utilisateurs.');
    }
  }

  // computed helpers
  filtered = computed(() => {
    const q = (this.q || '').trim().toLowerCase();
    const role = (this.roleFilter || '').trim();
    return (this.users() || []).filter(u => {
      const okQ = q === '' || (u.email || '').toLowerCase().includes(q) || (u.fullName || '').toLowerCase().includes(q);
      const okR = role === '' || (u.roles?.includes(role as any));
      return okQ && okR;
    });
  });

  applyFilter() {
    this._pageIndex.set(0);
  }

  pageCount() {
    return Math.max(1, Math.ceil(this.filtered().length / this.pageSize));
  }

  pageItems() {
    const start = this.pageIndex() * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  }

  prevPage() { this._pageIndex.set(Math.max(0, this.pageIndex()-1)); }
  nextPage() { this._pageIndex.set(Math.min(this.pageCount()-1, this.pageIndex()+1)); }

  roleLabel(r: UiRole | Role) {
    switch (r) {
      case 'ROLE_ADMIN': return 'Admin';
      case 'ROLE_SUPERIOR': return 'Manager';
      case 'ROLE_MANAGER': return 'Manager'; // backward compat
      default: return 'Employé';
    }
  }

  deptName(id?: string | null) {
    if (!id) return '—';
    const d = this.departments().find(x => String(x.id) === String(id));
    return d ? d.name : '—';
  }

  managerName(id?: string | null) {
    if (!id) return '—';
    const u = this.users().find(x => String(x.id) === String(id));
    return u ? (u.fullName || u.email) : '—';
  }

  openCreate() {
    this.modalMode.set('create');
    this.editingId = null;
    this.form.reset({
      fullName: '',
      email: '',
      role: 'ROLE_EMPLOYEE',
      departmentId: null,
      managerId: null,
      manager2Id: null,
      hireDate: '',
      initialLeaveBalance: null,
      netSalary: null,
      contractType: 'CDD',
      password: '',
    });
    this.modalOpen.set(true);
  }

  openEdit(u: AdminUser) {
    this.modalMode.set('edit');
    this.editingId = u.id;
    this.form.reset({
      fullName: u.fullName || '',
      email: u.email || '',
      // Normalize legacy ROLE_MANAGER to backend's ROLE_SUPERIOR so the UI shows "Manager".
      role: (((u.roles?.[0] as any) === 'ROLE_MANAGER') ? 'ROLE_SUPERIOR' : ((u.roles?.[0] as any) || 'ROLE_EMPLOYEE')) as any,
      departmentId: u.departmentId || u.department?.id || null,
      managerId: u.managerId || u.manager?.id || null,
      manager2Id: u.manager2Id || u.manager2?.id || null,
      hireDate: u.hireDate || '',
      initialLeaveBalance: u.leaveInitialBalance ?? null,
      netSalary: u.netSalary ?? null,
      contractType: (((u as any).contractType || '').toString().trim().toUpperCase() || 'CDD'),
      password: '',
    });
    this.modalOpen.set(true);
  }

  closeModal() {
    this.modalOpen.set(false);
  }

  async save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    try {
      const v:any = this.form.value;
      const role = (v.role === 'ROLE_MANAGER') ? 'ROLE_SUPERIOR' : v.role;
      const payload:any = {
        email: v.email,
        fullName: v.fullName,
        roles: [role],
        departmentId: v.departmentId || null,
        managerId: v.managerId || null,
        manager2Id: v.manager2Id || null,
        hireDate: v.hireDate || null,
        initialLeaveBalance: v.initialLeaveBalance ?? null,
        netSalary: v.netSalary ?? null,
        contractType: (v.contractType || 'CDI'),
      };

      // Password required on create; optional on edit
      if (this.modalMode() === 'create') {
        payload.password = (v.password || '').trim();
        if (!payload.password) {
          this.alert.error('Mot de passe requis pour la création.');
          this.saving.set(false);
          return;
        }
      } else {
        if ((v.password || '').trim() !== '') payload.password = (v.password || '').trim();
      }

      if (this.modalMode() === 'create') {
        await this.api.create(payload);
        this.alert.success('Utilisateur créé. Un email de bienvenue a été envoyé.');
      } else if (this.editingId) {
        const res = await this.api.update(this.editingId, payload);
        // if role changed on self, force logout
        if ((res as any).forceLogout) {
          await this.auth.logout();
          this.router.navigateByUrl('/login');
          return;
        }
        this.alert.success('Utilisateur mis à jour.');
      }

      this.closeModal();
      await this.reload();
    } catch (e:any) {
      this.alert.error('Erreur lors de l’enregistrement.');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(u: AdminUser) {
    if (!confirm('Supprimer cet utilisateur ?')) return;
    try {
      await this.api.delete(u.id);
      this.alert.success('Utilisateur supprimé.');
      await this.reload();
    } catch {
      this.alert.error('Suppression impossible.');
    }
  }
}