import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { LeaveWorkflowService } from '../../core/api/leave-workflow.service';

@Component({
  standalone:true,
  selector:'app-notifications',
  imports:[CommonModule,MatCardModule,MatButtonModule],
  template:`
    <h2>Notifications</h2>
    <mat-card *ngFor="let n of items()">
      <b>{{n.title}}</b> <span style="opacity:.7">({{n.type}})</span><br/>
      <span style="opacity:.85">{{n.body}}</span><br/>
      <button mat-stroked-button color="primary" (click)="read(n)" *ngIf="!n.isRead">Marquer lu</button>
    </mat-card>
  `,
  styles:[`mat-card{border-radius:16px;margin-bottom:10px;padding:12px}`]
})
export class NotificationsPage implements OnInit{
  items=signal<any[]>([]);
  constructor(private api:LeaveWorkflowService){}
  async ngOnInit(){ this.items.set((await this.api.listNotifications()).items||[]); }
  async read(n:any){ await this.api.markNotificationRead(n.id); await this.ngOnInit(); }
}
