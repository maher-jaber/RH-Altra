import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { Router, RouterModule } from '@angular/router';
import { NotificationStoreService } from '../../core/api/notification-store.service';

@Component({
  standalone:true,
  selector:'app-notifications',
  imports:[CommonModule, RouterModule, DatePipe, MatCardModule, MatButtonModule],
  template:`
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
      <div class="small text-muted">Total: {{total()}}</div>
      <div class="d-flex align-items-center gap-2">
        <select class="form-select form-select-sm" style="width:110px" [value]="pageSize()" (change)="setPageSize($any($event.target).value)">
          <option [value]="5">5</option><option [value]="10">10</option><option [value]="25">25</option><option [value]="50">50</option>
        </select>
        <button class="btn btn-outline-secondary btn-sm" (click)="prev()" [disabled]="pageIndex()===0">Précédent</button>
        <button class="btn btn-outline-secondary btn-sm" (click)="next()" [disabled]="(pageIndex()+1)*pageSize() >= total()">Suivant</button>
      </div>
    </div>

    <div class="d-flex align-items-center justify-content-between">
      <h2 style="margin:0">Notifications</h2>
      <div class="d-flex align-items-center gap-2">
        <button mat-stroked-button (click)="markAllRead()" [disabled]="unreadCount()===0">Tout marquer lu</button>
        <button mat-stroked-button (click)="reload()">Rafraîchir</button>
      </div>
    </div>

    <div style="height:10px"></div>

    <mat-card *ngFor="let n of items()">
      <div class="d-flex align-items-start justify-content-between gap-2">
        <div>
          <div class="d-flex align-items-center gap-2">
            <b>{{n.title}}</b>
            <span class="badge bg-light text-dark" style="border:1px solid #eee">{{n.type}}</span>
            <span class="badge" [class.bg-secondary]="n.isRead" [class.bg-danger]="!n.isRead">{{n.isRead?'Lu':'Nouveau'}}</span>
            <span *ngIf="n.payload?.requiresAction" class="badge bg-warning text-dark">Action requise</span>
          </div>

          <div style="opacity:.75; font-size:12px" *ngIf="n.createdAt">
            {{ n.createdAt | date:'yyyy-MM-dd HH:mm' }}
          </div>

          <div style="margin-top:6px; opacity:.9">{{n.body}}</div>

          <div *ngIf="n.payload" style="margin-top:10px; font-size:13px; opacity:.9">
            <div *ngIf="n.type==='LEAVE'">
              <b>Congé:</b> {{n.payload?.type?.label || n.payload?.type?.code}} · {{n.payload?.startDate}} → {{n.payload?.endDate}} · {{n.payload?.daysCount}} jour(s)
            </div>
            <div *ngIf="n.type==='ADVANCE'">
              <b>Avance:</b> {{n.payload?.amount}} {{n.payload?.currency}} ·
              <span class="badge" [ngClass]="statusBadgeClass(n.payload?.status)">{{ statusLabel(n.payload?.status) }}</span>
            </div>
            <div *ngIf="n.type==='EXIT'">
              <b>Autorisation de sortie:</b> {{n.payload?.startAt || n.payload?.startDate}} → {{n.payload?.endAt || n.payload?.endDate}} ·
              <span class="badge" [ngClass]="statusBadgeClass(n.payload?.status)">{{ statusLabel(n.payload?.status) }}</span>
            </div>
          </div>
        </div>

        <div class="d-flex flex-column gap-2" style="min-width:160px">
          <button mat-raised-button color="primary" *ngIf="n.actionUrl" (click)="open(n)">Ouvrir</button>
          <button mat-stroked-button color="primary" (click)="read(n)" *ngIf="!n.isRead">Marquer lu</button>
        </div>
      </div>
    </mat-card>

    <div *ngIf="items().length===0" style="opacity:.7; margin-top:16px">
      Aucune notification.
    </div>
  `,
  styles:[`mat-card{border-radius:16px;margin-bottom:10px;padding:12px}`]
})
export class NotificationsPage implements OnInit{
  pageIndex = this.store.pageIndex;
  pageSize = this.store.pageSize;
  total = this.store.total;
  items = this.store.items;
  unreadCount = this.store.unreadCount;

  constructor(public store:NotificationStoreService, private router:Router){}
  ngOnInit(){ this.store.start(); }

  setPageSize(v:any){
    const ps = parseInt(v,10) || 10;
    this.store.setPage(0, ps);
  }
  prev(){
    if(this.pageIndex()===0) return;
    this.store.setPage(this.pageIndex()-1);
  }
  next(){
    if((this.pageIndex()+1)*this.pageSize() >= this.total()) return;
    this.store.setPage(this.pageIndex()+1);
  }

  reload(){ this.store.refresh(); }
  async read(n:any){ await this.store.markRead(n.id); }
  async markAllRead(){ await this.store.markAllRead(); }
  async open(n:any){
    if(!n.isRead){ await this.store.markRead(n.id); }
    if(n.actionUrl){ await this.router.navigateByUrl(n.actionUrl); }
    else this.store.refresh();
  }

  statusLabel(s?: string | null): string {
    if (!s) return '—';
    switch (s) {
      case 'DRAFT': return 'Brouillon';
      case 'SUBMITTED': return 'En attente';
      case 'MANAGER_APPROVED': return 'Pré-validée (manager)';
      case 'HR_APPROVED':
      case 'RH_APPROVED':
      case 'APPROVED': return 'Validée (finale)';
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
