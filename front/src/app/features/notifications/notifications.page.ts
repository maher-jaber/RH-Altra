import { Component, OnInit } from '@angular/core';
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
    <div class="d-flex align-items-center justify-content-between">
      <h2 style="margin:0">Notifications</h2>
      <button mat-stroked-button (click)="reload()">Rafraîchir</button>
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
              <b>Avance:</b> {{n.payload?.amount}} {{n.payload?.currency}} · Statut: {{n.payload?.status}}
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
  items=this.store.items;
  constructor(public store:NotificationStoreService, private router:Router){}
  ngOnInit(){ this.store.start(); }
  reload(){ this.store.refresh(); }
  async read(n:any){ await this.store.markRead(n.id); }
  async open(n:any){
    if(!n.isRead){ await this.store.markRead(n.id); }
    if(n.actionUrl){ await this.router.navigateByUrl(n.actionUrl); }
    else this.store.refresh();
  }
}
