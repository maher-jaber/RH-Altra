import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DepartmentService } from '../../core/api/department.service';
import { AlertService } from '../../core/ui/alert.service';

@Component({
  standalone: true,
  selector: 'app-admin-departments',
  imports: [CommonModule, FormsModule],
  styles: [`
    .card { border: 1px solid var(--stroke); border-radius: 18px; background: var(--surface); box-shadow: var(--shadow-sm); }
    .card-header { padding: 14px 16px; border-bottom: 1px solid var(--stroke); background: rgba(255,255,255,.55); border-top-left-radius: 18px; border-top-right-radius: 18px; }
    .card-body { padding: 16px; }
    .table thead th { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; opacity: .7; }
    .name-input { max-width: 420px; }
  `],
  template: `
    <div class="card">
      <div class="card-header d-flex align-items-center justify-content-between">
        <div>
          <div class="h5 mb-0">Départements</div>
          <div class="text-muted small">Créer, modifier, supprimer les départements.</div>
        </div>
        <button class="btn btn-outline-secondary btn-sm" (click)="reload()">
          <i class="bi bi-arrow-clockwise"></i>
          <span class="ms-1">Rafraîchir</span>
        </button>
      </div>

      <div class="card-body">
          <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
            <div class="d-flex align-items-center gap-2">
              <input class="form-control form-control-sm" style="width:240px" placeholder="Rechercher département" [value]="q()" (input)="q.set(($any($event.target).value||'').trim())" />
              <button class="btn btn-outline-secondary btn-sm" (click)="search()"><i class="bi bi-search"></i><span class="ms-1">Chercher</span></button>
            </div>
            <div class="d-flex align-items-center gap-2">
              <select class="form-select form-select-sm" style="width:110px" [value]="pageSize()" (change)="setPageSize($any($event.target).value)">
                <option [value]="5">5</option><option [value]="10">10</option><option [value]="25">25</option><option [value]="50">50</option>
              </select>
              <div class="muted">Total: {{total()}}</div>
              <button class="btn btn-outline-secondary btn-sm" (click)="prev()" [disabled]="pageIndex()===0">Précédent</button>
              <button class="btn btn-outline-secondary btn-sm" (click)="next()" [disabled]="(pageIndex()+1)*pageSize()>=total()">Suivant</button>
            </div>
          </div>
        <div class="row g-2 align-items-end mb-3">
          <div class="col-12 col-lg-6">
            <label class="form-label">{{ editingId ? 'Renommer un département' : 'Nouveau département' }}</label>
            <div class="input-group name-input">
              <span class="input-group-text"><i class="bi bi-building"></i></span>
              <input class="form-control" [(ngModel)]="name" placeholder="Ex: IT, RH, Finance..." />
            </div>
          </div>
          <div class="col-12 col-lg-auto">
            <button class="btn btn-primary" (click)="save()" [disabled]="!name.trim()">
              <i class="bi bi-check2-circle"></i>
              <span class="ms-1">{{ editingId ? 'Enregistrer' : 'Ajouter' }}</span>
            </button>
            <button *ngIf="editingId" class="btn btn-outline-secondary ms-2" (click)="cancel()">
              Annuler
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table align-middle">
            <thead>
              <tr>
                <th>Nom</th>
                <th style="width: 180px"></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let d of items()">
                <td>
                  <div class="fw-semibold">{{ d.name }}</div>
                  <div class="text-muted small">ID: {{ d.id }}</div>
                </td>
                <td class="text-end">
                  <button class="btn btn-outline-secondary btn-sm me-2" (click)="edit(d)">
                    <i class="bi bi-pencil"></i>
                    <span class="ms-1">Modifier</span>
                  </button>
                  <button class="btn btn-outline-danger btn-sm" (click)="remove(d)">
                    <i class="bi bi-trash"></i>
                    <span class="ms-1">Supprimer</span>
                  </button>
                </td>
              </tr>

              <tr *ngIf="!items().length">
                <td colspan="2" class="text-muted">Aucun département.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class AdminDepartmentsPage implements OnInit {
  items = signal<any[]>([]);
  name = '';
  editingId: string | null = null;
  // ✅ pagination + search
  q = signal<string>('');
  pageIndex = signal<number>(0);
  pageSize = signal<number>(10);
  total = signal<number>(0);

  constructor(private api: DepartmentService, private alert: AlertService) {}

  async ngOnInit() {
    await this.reload();
  }
setPageSize(v: any) {
    const n = parseInt(v, 10) || 10;
    this.pageSize.set(n);
    this.pageIndex.set(0);
    this.reload();
  }

  search() {
    this.pageIndex.set(0);
    this.reload();
  }

  prev() {
    if (this.pageIndex() === 0) return;
    this.pageIndex.set(this.pageIndex() - 1);
    this.reload();
  }

  next() {
    if ((this.pageIndex() + 1) * this.pageSize() >= this.total()) return;
    this.pageIndex.set(this.pageIndex() + 1);
    this.reload();
  }

  async reload() {
    const res = await this.api.list(this.pageIndex()+1, this.pageSize(), this.q() || undefined);
    this.items.set(res.items || []);
    this.total.set(res.meta?.total ?? (res.items?.length || 0));
  }

  edit(d: any) {
    this.editingId = d.id;
    this.name = d.name;
  }

  cancel() {
    this.editingId = null;
    this.name = '';
  }

  async save() {
    const n = this.name.trim();
    if (!n) return;

    try {
      if (this.editingId) {
        await this.api.update(this.editingId, n);
      this.alert.toast({ title: 'Département mis à jour', icon: 'success' });
      } else {
        await this.api.create(n);
        this.alert.toast({ title: 'Département ajouté', icon: 'success' });
      }
      this.cancel();
      await this.reload();
    } catch {
      this.alert.toast({ title: 'Échec. Vérifie le serveur.', icon: 'error' });
    }
  }

  async remove(d: any) {
    const ok = await this.alert.confirm({ title: 'Supprimer ce département ?', text: `"${d.name}" sera supprimé.`, danger: true });
    if (!ok) return;
    try {
      await this.api.remove(d.id);
      this.alert.toast({ title: 'Département supprimé', icon: 'success' });
      await this.reload();
    } catch {
      this.alert.toast({ title: 'Impossible de supprimer', text: 'Ce département est probablement utilisé par des utilisateurs.', icon: 'warning' });
    }
  }
}
