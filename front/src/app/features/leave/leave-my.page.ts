import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';

import { LeaveService } from '../../core/api/leave.service';
import { LeaveRequest } from '../../core/models';
import { AlertService } from '../../core/ui/alert.service';

@Component({
  standalone: true,
  imports: [CommonModule, MatCardModule, MatTableModule, MatButtonModule],
  template: `
  <div class="container">
    <mat-card>
      <mat-card-header>
        <mat-card-title>Mes demandes</mat-card-title>
        <mat-card-subtitle>Liste de vos demandes (MVP)</mat-card-subtitle>
      </mat-card-header>

      <mat-card-content>
        <table mat-table [dataSource]="rows" class="mat-elevation-z1" style="width:100%;">
          <ng-container matColumnDef="type">
            <th mat-header-cell *matHeaderCellDef>Type</th>
            <td mat-cell *matCellDef="let r">{{r.type?.label || r.typeCode || r.type}}</td>
          </ng-container>

          <ng-container matColumnDef="period">
            <th mat-header-cell *matHeaderCellDef>Période</th>
            <td mat-cell *matCellDef="let r">{{r.startDate}} → {{r.endDate}}</td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Statut</th>
            <td mat-cell *matCellDef="let r">
              <span class="badge" [ngClass]="statusBadgeClass(r.status)">{{ statusLabel(r.status) }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Actions</th>
            <td mat-cell *matCellDef="let r">
              <button mat-button (click)="cancel(r)" [disabled]="r.status === 'CANCELLED' || r.status === 'HR_APPROVED' || r.status === 'MANAGER_APPROVED'">
                Annuler
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols;"></tr>
        </table>

        <div *ngIf="rows.length === 0" style="padding: 12px; opacity:.75;">
          Aucune demande.
        </div>
      </mat-card-content>
    </mat-card>
  </div>
  `
})
export class LeaveMyPageComponent {
  cols = ['type', 'period', 'status', 'actions'];
  rows: LeaveRequest[] = [];

  constructor(private leave: LeaveService, private alert: AlertService) {
    this.reload();
  }

  reload() {
    this.leave.my().subscribe({
      next: (list) => this.rows = list,
      error: () => this.alert.toast({ icon: 'error', title: 'Erreur', text: 'Impossible de charger vos demandes', ms: 3500 })
    });
  }

  cancel(r: LeaveRequest) {
    this.leave.cancel(r.id).subscribe({
      next: () => { this.alert.toast({ icon: 'success', title: 'Demande annulée', ms: 2500 }); this.reload(); },
      error: () => this.alert.toast({ icon: 'error', title: 'Erreur', text: 'Impossible d\'annuler la demande', ms: 3500 })
    });
  }

  statusLabel(s?: string | null): string {
    if (!s) return '—';
    switch (s) {
      case 'DRAFT': return 'Brouillon';
      case 'SUBMITTED': return 'En attente manager';
      case 'MANAGER_APPROVED': return 'Pré-validée (manager)';
      case 'HR_APPROVED':
      case 'RH_APPROVED':
      case 'APPROVED':
        return 'Validée (finale)';
      case 'REJECTED': return 'Refusée';
      case 'CANCELLED': return 'Annulée';
      default: return s;
    }
  }

  statusBadgeClass(s?: string | null): string {
    const v = (s || '').toUpperCase();
    if (v === 'SUBMITTED') return 'text-bg-warning';
    if (v === 'MANAGER_APPROVED') return 'text-bg-info';
    if (v === 'HR_APPROVED' || v === 'RH_APPROVED' || v === 'APPROVED') return 'text-bg-success';
    if (v === 'REJECTED') return 'text-bg-danger';
    if (v === 'CANCELLED') return 'text-bg-secondary';
    if (v === 'DRAFT') return 'text-bg-light text-dark';
    return 'text-bg-secondary';
  }
}
