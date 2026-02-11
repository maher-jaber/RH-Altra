import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminUserService } from '../../core/api/admin-user.service';
import { DepartmentService } from '../../core/api/department.service';
import { AlertService } from '../../core/ui/alert.service';
import { AdminUser, Department } from '../../core/models';

type UiRole = 'ROLE_EMPLOYEE' | 'ROLE_MANAGER' | 'ROLE_HR' | 'ROLE_ADMIN';

@Component({
  standalone: true,
  selector: 'app-admin-users',
  imports: [CommonModule, ReactiveFormsModule],
  styles: [`
    .grid { display: grid; grid-template-columns: 1.4fr .9fr; gap: 16px; }
    @media (max-width: 980px) { .grid { grid-template-columns: 1fr; } }
    .card { border: 1px solid var(--stroke); border-radius: 18px; background: var(--surface); box-shadow: var(--shadow-sm); }
    .card-header { padding: 14px 16px; border-bottom: 1px solid var(--stroke); background: rgba(255,255,255,.55); border-top-left-radius: 18px; border-top-right-radius: 18px; }
    .card-body { padding: 16px; }
    .muted { opacity: .75; font-size: 12px; }
    .pill { display:inline-flex; align-items:center; gap:6px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--stroke); background: rgba(255,255,255,.65); font-size: 12px; }
  `],
  template: `
    <div class="grid">
      <div class="card">
        <div class="card-header d-flex align-items-center justify-content-between">
          <div>
            <div class="h5 mb-0">Utilisateurs</div>
            <div class="text-muted small">Gérer les comptes, rôles, managers et API Key.</div>
          </div>
          <button class="btn btn-outline-secondary btn-sm" (click)="reload()">
            <i class="bi bi-arrow-clockwise"></i><span class="ms-1">Rafraîchir</span>
          </button>
        </div>

        <div class="card-body">
          <div class="table-responsive">
            <table class="table align-middle">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Rôle</th>
                  <th style="width: 220px"></th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let u of users()">
                  <td>
                    <div class="fw-semibold">{{ u.fullName || '—' }}</div>
                    <div class="muted">{{ u.email }}</div>
                  </td>
                  <td>
                    <span class="pill"><i class="bi bi-shield-lock"></i>{{ (u.roles[0] || 'ROLE_EMPLOYEE') }}</span>
                  </td>
                  <td class="text-end">
                    <button class="btn btn-outline-secondary btn-sm me-2" (click)="edit(u)">
                      <i class="bi bi-pencil"></i><span class="ms-1">Modifier</span>
                    </button>
                    <button class="btn btn-outline-secondary btn-sm me-2" (click)="rotateKey(u)">
                      <i class="bi bi-key"></i><span class="ms-1">API Key</span>
                    </button>
                    <button class="btn btn-outline-danger btn-sm" (click)="remove(u)">
                      <i class="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>

                <tr *ngIf="!users().length">
                  <td colspan="3" class="text-muted">Aucun utilisateur.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="h5 mb-0">{{ editingId() ? 'Modifier un utilisateur' : 'Créer un utilisateur' }}</div>
          <div class="text-muted small">Champs clairs, rôle en liste déroulante.</div>
        </div>

        <div class="card-body">
          <form [formGroup]="form" (ngSubmit)="save()">
            <div class="mb-2">
              <label class="form-label">Email</label>
              <div class="input-group">
                <span class="input-group-text"><i class="bi bi-envelope"></i></span>
                <input class="form-control" formControlName="email" placeholder="email@domaine.com" autocomplete="username" />
              </div>
            </div>

            <div class="mb-2">
              <label class="form-label">Nom complet</label>
              <div class="input-group">
                <span class="input-group-text"><i class="bi bi-person"></i></span>
                <input class="form-control" formControlName="fullName" placeholder="Prénom Nom" />
              </div>
            </div>

            <div class="mb-2">
              <label class="form-label">Département</label>
              <select class="form-select" formControlName="departmentId">
                <option value="">(Aucun)</option>
                <option *ngFor="let d of departments()" [value]="d.id">{{ d.name }}</option>
              </select>
            </div>

            <div class="row g-2">
              <div class="col-12 col-lg-6">
                <label class="form-label">Manager principal</label>
                <select class="form-select" formControlName="managerId">
                  <option value="">(Aucun)</option>
                  <option *ngFor="let m of users()" [value]="m.id">{{ m.fullName || m.email }} — {{ m.email }}</option>
                </select>
              </div>
              <div class="col-12 col-lg-6">
                <label class="form-label">Manager secondaire</label>
                <select class="form-select" formControlName="manager2Id">
                  <option value="">(Aucun)</option>
                  <option *ngFor="let m of users()" [value]="m.id">{{ m.fullName || m.email }} — {{ m.email }}</option>
                </select>
              </div>
            </div>

            <div class="mb-2 mt-2">
              <label class="form-label">Rôle</label>
              <select class="form-select" formControlName="role">
                <option value="ROLE_EMPLOYEE">Employé</option>
                <option value="ROLE_MANAGER">Manager</option>
                <option value="ROLE_HR">RH</option>
                <option value="ROLE_ADMIN">Admin</option>
              </select>
              <div class="muted mt-1">Le rôle est envoyé au backend comme une liste (ex: [ROLE_ADMIN]).</div>
            </div>

            <div class="mb-3">
              <label class="form-label">Mot de passe {{ editingId() ? '(laisser vide pour ne pas changer)' : '' }}</label>
              <div class="input-group">
                <span class="input-group-text"><i class="bi bi-lock"></i></span>
                <input class="form-control" type="password" formControlName="password" placeholder="********" autocomplete="current-password" />
              </div>
            </div>

            <div class="d-flex gap-2">
              <button class="btn btn-primary" type="submit" [disabled]="form.invalid">
                <i class="bi bi-check2-circle"></i>
                <span class="ms-1">{{ editingId() ? 'Enregistrer' : 'Créer' }}</span>
              </button>
              <button *ngIf="editingId()" class="btn btn-outline-secondary" type="button" (click)="cancel()">Annuler</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `
})
export class AdminUsersPageComponent implements OnInit {
  users = signal<AdminUser[]>([]);
  departments = signal<Department[]>([]);
  editingId = signal<string | null>(null);

  form = this.fb.group({
    departmentId: [''],
    managerId: [''],
    manager2Id: [''],
    email: ['', [Validators.required, Validators.email]],
    fullName: [''],
    role: ['ROLE_EMPLOYEE' as UiRole],
    password: [''],
  });

  constructor(
    private api: AdminUserService,
    private deptApi: DepartmentService,
    private fb: FormBuilder,
    private alert: AlertService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    try {
      const [res, deps] = await Promise.all([this.api.list(), this.deptApi.list()]);
      this.users.set(res.items || []);
      this.departments.set(deps.items || []);
    } catch {
      this.alert.toast({ title: 'Impossible de charger les utilisateurs', icon: 'error' });
    }
  }

  edit(u: AdminUser): void {
    this.editingId.set(u.id);
    const role = (u.roles?.[0] || 'ROLE_EMPLOYEE') as UiRole;
    this.form.patchValue({
      email: u.email,
      fullName: u.fullName,
      role,
      departmentId: (u.department as any)?.id || '',
      managerId: (u.manager as any)?.id || '',
      manager2Id: (u.manager2 as any)?.id || '',
      password: '',
    });
  }

  cancel(): void {
    this.editingId.set(null);
    this.form.reset({
      email: '',
      fullName: '',
      role: 'ROLE_EMPLOYEE',
      departmentId: '',
      managerId: '',
      manager2Id: '',
      password: '',
    });
  }

  async save(): Promise<void> {
    if (this.form.invalid) return;

    const val = this.form.getRawValue();
    const roles = [val.role as UiRole];
    const payload: any = {
      email: val.email!,
      fullName: val.fullName || '',
      roles,
      password: val.password || '',
      departmentId: val.departmentId || null,
      managerId: val.managerId || null,
      manager2Id: val.manager2Id || null,
    };

    try {
      if (this.editingId()) {
        const id = this.editingId()!;
        const updatePayload: any = {
          email: payload.email,
          fullName: payload.fullName,
          roles: payload.roles,
          departmentId: payload.departmentId,
          managerId: payload.managerId,
          manager2Id: payload.manager2Id,
        };
        if (payload.password) updatePayload.password = payload.password;
        await this.api.update(id, updatePayload);
        this.alert.toast({ title: 'Utilisateur mis à jour', icon: 'success' });
      } else {
        if (!payload.password) {
          this.alert.toast({ title: 'Mot de passe requis pour créer', icon: 'warning' });
          return;
        }
        await this.api.create(payload);
        this.alert.toast({ title: 'Utilisateur créé', icon: 'success' });
      }
      this.cancel();
      await this.reload();
    } catch (e: any) {
      const msg = e?.error?.message || e?.error?.error || 'Erreur serveur';
      this.alert.toast({ title: 'Échec', text: msg, icon: 'error' });
    }
  }

  async rotateKey(u: AdminUser): Promise<void> {
    const ok = await this.alert.confirm({
      title: 'Régénérer l\'API Key ?',
      text: `Utilisateur: ${u.email}`,
      confirmText: 'Régénérer',
      cancelText: 'Annuler',
      danger: false,
    });
    if (!ok) return;
    try {
      await this.api.update(u.id, { rotateApiKey: true });
      this.alert.toast({ title: 'API Key régénérée', icon: 'success' });
      await this.reload();
    } catch {
      this.alert.toast({ title: 'Impossible de régénérer', icon: 'error' });
    }
  }

  async remove(u: AdminUser): Promise<void> {
    const ok = await this.alert.confirm({
      title: 'Supprimer cet utilisateur ?',
      text: `${u.fullName || u.email}`,
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.api.delete(u.id);
      this.alert.toast({ title: 'Utilisateur supprimé', icon: 'success' });
      await this.reload();
    } catch {
      this.alert.toast({ title: 'Suppression impossible', icon: 'error' });
    }
  }
}
