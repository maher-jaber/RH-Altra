import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LeaveWorkflowService } from '../../core/api/leave-workflow.service';

@Component({
  standalone:true,
  selector:'app-leave-pending-manager',
  imports:[CommonModule,FormsModule,MatCardModule,MatTableModule,MatButtonModule,MatFormFieldModule,MatInputModule,MatPaginatorModule,RouterModule],
  styles:[`mat-card{border-radius:16px} table{width:100%} .rowActions{display:flex;gap:8px}`],
  template:`
  <mat-card>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
      <h2>Validation Congés – Manager</h2>
      <a mat-stroked-button routerLink="/leaves">Dashboard</a>
    </div>

    <mat-form-field appearance="outline" style="width:100%">
      <mat-label>Commentaire (optionnel)</mat-label>
      <input matInput [(ngModel)]="comment" placeholder="Ex: OK pour la période / merci de joindre certificat..." />
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
            <a mat-stroked-button [routerLink]="['/leaves/detail', x.id]">Détail</a>
            <button mat-flat-button color="primary" (click)="approve(x)">Approuver</button>
                        <button mat-stroked-button color="warn" (click)="reject(x)">Refuser</button>
          </div>
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="cols"></tr>
      <tr mat-row *matRowDef="let row; columns: cols;"></tr>
    </table>
    <mat-paginator [length]="total()" [pageIndex]="pageIndex()" [pageSize]="pageSize()" [pageSizeOptions]="[5,10,25,50]" (page)="onPage($event)"></mat-paginator>
  </mat-card>
  `
})
export class LeavePendingManagerPage implements OnInit, OnDestroy{
  items=signal<any[]>([]);
  pageIndex = signal(0);
  pageSize = signal(10);
  total = signal(0);
  cols=['employee','period','actions'];
  comment='';
  private sub: any;
  constructor(private api:LeaveWorkflowService){}
  async ngOnInit(){
    await this.load();
    this.sub = this.api.changed$.subscribe(() => { this.load(); });
  }

  ngOnDestroy(){
    try{ this.sub?.unsubscribe?.(); }catch{}
  }

  async load(){
    const res = await this.api.pendingManager(this.pageIndex()+1, this.pageSize());
    this.items.set(res.items||[]);
    this.total.set(res.meta?.total ?? (res.items?.length || 0));
  }

  onPage(e: PageEvent){
    this.pageIndex.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
    this.load();
  }

  async approve(x:any){ await this.api.managerApprove(x.id, this.comment); await this.load(); }
  async reject(x:any){
    await this.api.reject(x.id, this.comment);
    await this.load();
  }
}