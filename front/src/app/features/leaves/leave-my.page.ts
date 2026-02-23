import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { RouterModule } from '@angular/router';
import { LeaveWorkflowService } from '../../core/api/leave-workflow.service';

@Component({
  standalone:true,
  selector:'app-leave-my',
  imports:[CommonModule,MatCardModule,MatTableModule,MatButtonModule,MatPaginatorModule,RouterModule],
  styles:[`mat-card{border-radius:16px} table{width:100%}`],
  template:`
  <mat-card>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
      <h2>Mes demandes de congé</h2>
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
        <td mat-cell *matCellDef="let x"><b>{{statusLabel(x.status)}}</b></td>
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
    <mat-paginator [length]="total()" [pageIndex]="pageIndex()" [pageSize]="pageSize()" [pageSizeOptions]="[5,10,25,50]" (page)="onPage($event)"></mat-paginator>
  </mat-card>
  `
})
export class LeaveMyPage implements OnInit, OnDestroy{
  items=signal<any[]>([]);
  cols=['type','period','status','actions'];
  pageIndex=signal(0);
  pageSize=signal(10);
  total=signal(0);
  private sub: any;

  constructor(private api:LeaveWorkflowService){}

  async ngOnInit(){
    await this.load();
    // Important for tabbed UI: refresh list after a leave is created/submitted without forcing navigation.
    this.sub = this.api.changed$.subscribe(() => { this.load(); });
  }

  ngOnDestroy(){
    try{ this.sub?.unsubscribe?.(); }catch{}
  }

  async load(){
    const page=this.pageIndex()+1;
    const limit=this.pageSize();
    const res = await this.api.my(page, limit);
    this.items.set(res.items||[]);
    this.total.set(res.meta?.total ?? (res.items?.length||0));
  }

  async onPage(ev: PageEvent){
    this.pageIndex.set(ev.pageIndex);
    this.pageSize.set(ev.pageSize);
    await this.load();
  }

  statusLabel(v: string): string {
    const s = (v || '').toUpperCase();
    if (s === 'DRAFT') return 'Brouillon';
    if (s === 'SUBMITTED') return 'Soumis';
    if (s === 'MANAGER_APPROVED') return 'Approuvé (Manager)';
    if (s === 'HR_APPROVED' || s === 'APPROVED') return 'Approuvé';
    if (s === 'REJECTED') return 'Refusé';
    if (s === 'CANCELLED') return 'Annulé';
    return v || '—';
  }
}
