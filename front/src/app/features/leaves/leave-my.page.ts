import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { LeaveWorkflowService } from '../../core/api/leave-workflow.service';

@Component({
  standalone:true,
  selector:'app-leave-my',
  imports:[CommonModule,MatCardModule,MatTableModule,MatButtonModule,RouterModule],
  styles:[`mat-card{border-radius:16px} table{width:100%}`],
  template:`
  <mat-card>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
      <h2>Mes demandes de congé</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
      <a mat-stroked-button routerLink="/leaves">Dashboard</a>
      <a mat-flat-button color="primary" routerLink="/leaves/new">Nouvelle demande</a>
    </div>
    </div>
    <table mat-table [dataSource]="items()">
      <ng-container matColumnDef="type">
        <th mat-header-cell *matHeaderCellDef>Type</th>
        <td mat-cell *matCellDef="let x">{{x.type?.label || x.type}}</td>
      </ng-container>
      <ng-container matColumnDef="period">
        <th mat-header-cell *matHeaderCellDef>Période</th>
        <td mat-cell *matCellDef="let x">{{x.startDate}} → {{x.endDate}} ({{x.daysCount}} j)</td>
      </ng-container>
      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef>Statut</th>
        <td mat-cell *matCellDef="let x"><b>{{x.status}}</b></td>
      </ng-container>
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef></th>
        <td mat-cell *matCellDef="let x">
          <a mat-stroked-button [routerLink]="['/leaves/detail', x.id]">Détail</a>
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="cols"></tr>
      <tr mat-row *matRowDef="let row; columns: cols;"></tr>
    </table>
  </mat-card>
  `
})
export class LeaveMyPage implements OnInit{
  items=signal<any[]>([]);
  cols=['type','period','status','actions'];
  constructor(private api:LeaveWorkflowService){}
  async ngOnInit(){ this.items.set((await this.api.my()).items||[]); }
}
