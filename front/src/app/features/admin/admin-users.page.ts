import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';

import { AlertService } from '../../core/ui/alert.service';

import { AdminUserService } from '../../core/api/admin-user.service';
import { DepartmentService } from '../../core/api/department.service';
import { AdminUser, Role, Department } from '../../core/models';

@Component({
  standalone: true,
  selector: 'app-admin-users',
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatTableModule, MatButtonModule, MatIconModule,
    MatSnackBarModule, MatFormFieldModule, MatInputModule, MatChipsModule, MatSelectModule,
  ],
  styles: [`
    .grid { display: grid; grid-template-columns: 1.4fr .9fr; gap: 16px; }
    @media (max-width: 980px) { .grid { grid-template-columns: 1fr; } }
    table { width: 100%; }
    .muted { opacity: .75; font-size: 12px; }
    .actions { display:flex; gap: 8px; }
    mat-card { border-radius: 16px; }
  `],
  template: `
    <div class="grid">
      <mat-card>
        <mat-card-title>Utilisateurs</mat-card-title>
        <mat-card-content>
          <table mat-table [dataSource]="users()">
            <ng-container matColumnDef="fullName">
              <th mat-header-cell *matHeaderCellDef>Nom</th>
              <td mat-cell *matCellDef="let u">
                <div><b>{{u.fullName}}</b></div>
                <div class="muted">{{u.email}}</div>
              </td>
            </ng-container>

            <ng-container matColumnDef="roles">
              <th mat-header-cell *matHeaderCellDef>Rôles</th>
              <td mat-cell *matCellDef="let u">
                <mat-chip-set>
                  <mat-chip *ngFor="let r of u.roles">{{r}}</mat-chip>
                </mat-chip-set>
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let u">
                <div class="actions">
                  <button mat-icon-button (click)="edit(u)" title="Modifier"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="rotateKey(u)" title="Regénérer API Key"><mat-icon>vpn_key</mat-icon></button>
                  <button mat-icon-button (click)="remove(u)" title="Supprimer"><mat-icon>delete</mat-icon></button>
                </div>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns;"></tr>
          </table>

          <div style="margin-top: 12px; display:flex; gap: 8px;">
            <button mat-stroked-button (click)="reload()"><mat-icon>refresh</mat-icon>&nbsp;Rafraîchir</button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-title>{{editingId() ? 'Modifier un utilisateur' : 'Créer un utilisateur'}}</mat-card-title>
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="save()">
            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>Email</mat-label>
              <input matInput formControlName="email" placeholder="email@domaine.com"/>
            </mat-form-field>

            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>Nom complet</mat-label>
              <input matInput formControlName="fullName" placeholder="Prénom Nom"/>
            </mat-form-field>


            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>Département</mat-label>
              <mat-select formControlName="departmentId">
                <mat-option value="">(Aucun)</mat-option>
                <mat-option *ngFor="let d of departments()" [value]="d.id">{{d.name}}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>Manager principal</mat-label>
              <mat-select formControlName="managerId">
                <mat-option value="">(Aucun)</mat-option>
                <mat-option *ngFor="let m of users()" [value]="m.id">{{m.fullName}} — {{m.email}}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>Manager secondaire</mat-label>
              <mat-select formControlName="manager2Id">
                <mat-option value="">(Aucun)</mat-option>
                <mat-option *ngFor="let m of users()" [value]="m.id">{{m.fullName}} — {{m.email}}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>Rôles (séparés par virgule)</mat-label>
              <input matInput formControlName="roles" placeholder="ROLE_EMPLOYEE,ROLE_SUPERIOR"/>
              <div class="muted">Utilise: ROLE_ADMIN, ROLE_SUPERIOR, ROLE_EMPLOYEE</div>
            </mat-form-field>

            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>Mot de passe {{editingId() ? '(laisser vide pour ne pas changer)' : ''}}</mat-label>
              <input matInput type="password" formControlName="password" placeholder="********"/>
            </mat-form-field>

            <div style="display:flex; gap: 8px; margin-top: 8px;">
              <button mat-flat-button color="primary" type="submit">
                <mat-icon>save</mat-icon>&nbsp;{{editingId() ? 'Enregistrer' : 'Créer'}}
              </button>
              <button mat-button type="button" (click)="cancel()" *ngIf="editingId()">Annuler</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `
})
export class AdminUsersPageComponent implements OnInit {
  users = signal<AdminUser[]>([]);
  departments = signal<Department[]>([]);
  columns = ['fullName', 'roles', 'actions'];
  editingId = signal<string | null>(null);

  form = this.fb.group({
    departmentId: [''],
    managerId: [''],
    manager2Id: [''],
    email: ['', [Validators.required, Validators.email]],
    fullName: [''],
    roles: ['ROLE_EMPLOYEE'],
    password: [''],
  });

  constructor(
    private api: AdminUserService,
    private deptApi: DepartmentService,
    private fb: FormBuilder,
    private snack: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  async reload(): Promise<void> {
    try {
      const [res, deps] = await Promise.all([this.api.list(), this.deptApi.list()]);
      this.users.set(res.items);
      this.departments.set(deps.items || []);
    } catch (e: any) {
      this.snack.open('Impossible de charger les utilisateurs', 'OK', { duration: 3000 });
    }
  }

  edit(u: AdminUser): void {
    this.editingId.set(u.id);
    this.form.patchValue({
      email: u.email,
      fullName: u.fullName,
      roles: u.roles.join(','),
      departmentId: u.department?.id || '',
      managerId: u.manager?.id || '',
      manager2Id: u.manager2?.id || '',
      password: '',
    });
  }

  cancel(): void {
    this.editingId.set(null);
    this.form.reset({ email: '', fullName: '', roles: 'ROLE_EMPLOYEE', departmentId: '', managerId: '', manager2Id: '', password: '' });
  }

  private parseRoles(raw: string): Role[] {
    const parts = (raw || '').split(',').map(s => s.trim()).filter(Boolean) as Role[];
    return (parts.length ? parts : ['ROLE_EMPLOYEE']);
  }

  async save(): Promise<void> {
    if (this.form.invalid) return;

    const val = this.form.getRawValue();
    const payload = {
      email: val.email!,
      fullName: val.fullName || '',
      roles: this.parseRoles(val.roles || ''),
      password: val.password || '',
      departmentId: val.departmentId || '',
      managerId: val.managerId || '',
      manager2Id: val.manager2Id || '',
    } as any;

    try {
      if (this.editingId()) {
        const id = this.editingId()!;
        const updatePayload: any = { email: payload.email, fullName: payload.fullName, roles: payload.roles, departmentId: payload.departmentId || null, managerId: payload.managerId || null, manager2Id: payload.manager2Id || null };
        if (payload.password) updatePayload.password = payload.password;
        await this.api.update(id, updatePayload);
        this.snack.open('Utilisateur mis à jour', 'OK', { duration: 2500 });
      } else {
        if (!payload.password) {
          this.snack.open('Mot de passe requis pour créer', 'OK', { duration: 2500 });
          return;
        }
        await this.api.create(payload);
        this.snack.open('Utilisateur créé', 'OK', { duration: 2500 });
      }
      this.cancel();
      await this.reload();
    } catch (e: any) {
      const msg = e?.error?.error || 'Erreur';
      this.snack.open('Échec: ' + msg, 'OK', { duration: 3500 });
    }
  }

  async rotateKey(u: AdminUser): Promise<void> {
    try {
      await this.api.update(u.id, { rotateApiKey: true });
      this.snack.open('API key régénérée', 'OK', { duration: 2500 });
      await this.reload();
    } catch {
      this.snack.open('Impossible de régénérer la clé', 'OK', { duration: 3000 });
    }
  }

  async remove(u: AdminUser): Promise<void> {
    if (!confirm(`Supprimer ${u.email} ?`)) return;
    try {
      await this.api.delete(u.id);
      this.snack.open('Utilisateur supprimé', 'OK', { duration: 2500 });
      await this.reload();
    } catch {
      this.snack.open('Impossible de supprimer', 'OK', { duration: 3000 });
    }
  }
}
