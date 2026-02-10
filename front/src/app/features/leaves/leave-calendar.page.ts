import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { LeaveWorkflowService } from '../../core/api/leave-workflow.service';

@Component({
  standalone:true,
  selector:'app-leave-calendar',
  imports:[CommonModule, MatCardModule],
  template:`
    <mat-card>
      <h2>Calendrier des congés (mois)</h2>
      <div class="grid">
        <div *ngFor="let d of days" class="day" [class.busy]="d.busy">
          <b>{{d.day}}</b>
          <div *ngIf="d.busy" class="tag">{{d.label}}</div>
        </div>
      </div>
    </mat-card>
  `,
  styles:[`
    .grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
    .day{border:1px solid #ddd;border-radius:8px;padding:6px;min-height:70px}
    .busy{background:#e3f2fd}
    .tag{font-size:11px;color:#1976d2}
  `]
})
export class LeaveCalendarPage implements OnInit{
  days:any[]=[];
  constructor(private api:LeaveWorkflowService){}
  async ngOnInit(){
    // simple demo calendar using approved leaves
    const res = await this.api.my();
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const last = new Date(y,m+1,0).getDate();
    for(let i=1;i<=last;i++){
      const date = new Date(y,m,i).toISOString().slice(0,10);
      const hit = res.items.find((l:any)=>l.status==='HR_APPROVED' && date>=l.startDate && date<=l.endDate);
      this.days.push({day:i,busy:!!hit,label:hit?hit.type.label:''});
    }
  }
}
