import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LeaveWorkflowService } from '../../core/api/leave-workflow.service';

@Component({
  standalone:true,
  selector:'app-leave-pending-hr',
  imports:[CommonModule,FormsModule,MatCardModule,MatTableModule,MatButtonModule,MatFormFieldModule,MatInputModule,RouterModule],
  styles:[`mat-card{border-radius:16px} table{width:100%} .rowActions{display:flex;gap:8px}`],
  template:`
  <mat-card>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
      <h2>Validation Congés – RH</h2>
      <a mat-stroked-button routerLink="/leaves">Dashboard</a>
    </div>

    <mat-form-field appearance="outline" style="width:100%">
      <mat-label>Commentaire RH (optionnel)</mat-label>
      <input matInput [(ngModel)]="comment" placeholder="Ex: approuvé / justificatif manquant..." />
    </mat-form-field>

    <table mat-table [dataSource]="items()">
      <ng-container matColumnDef="employee">
        <th mat-header-cell *matHeaderCellDef>Employé</th>
        <td mat-cell *matCellDef="let x">{{x.user?.fullName || x.user}}</td>
      </ng-container>
      <ng-container matColumnDef="period">
        <th mat-header-cell *matHeaderCellDef>Période</th>
        <td mat-cell *matCellDef="let x">{{x.startDate}} → {{x.endDate}} ({{x.daysCount}} j)</td>
      </ng-container>
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef></th>
        <td mat-cell *matCellDef="let x">
          <div class="rowActions">
            <button mat-flat-button color="primary" (click)="approve(x)">Approuver</button>
            <button mat-stroked-button (click)="sign(x)">Signer & Archiver PDF</button>
            <button mat-stroked-button color="warn" (click)="reject(x)">Refuser</button>
          </div>
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="cols"></tr>
      <tr mat-row *matRowDef="let row; columns: cols;"></tr>
    </table>
  </mat-card>
  `
})
export class LeavePendingHrPage implements OnInit{
  items=signal<any[]>([]);
  cols=['employee','period','actions'];
  comment='';
  constructor(private api:LeaveWorkflowService){}
  async ngOnInit(){ this.items.set((await this.api.pendingHr()).items||[]); }
  async approve(x:any){ await this.api.hrApprove(x.id, this.comment); await this.ngOnInit(); }
  async sign(x:any){ const name=prompt('Nom RH', ''); const sig=prompt('Signature (base64 ou texte)', ''); await this.api.signHr(x.id,{name:name||undefined, signature:sig||undefined, comment:this.comment||undefined}); await this.ngOnInit(); }
  async reject(x:any){ await this.api.reject(x.id, this.comment); await this.ngOnInit(); }
}
