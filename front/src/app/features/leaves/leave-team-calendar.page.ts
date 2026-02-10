import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { LeaveWorkflowService } from '../../core/api/leave-workflow.service';

@Component({
  standalone:true,
  selector:'app-leave-team-calendar',
  imports:[CommonModule, MatCardModule],
  template:`
    <mat-card>
      <h2>Calendrier équipe / département</h2>
      <p style="opacity:.75">Astuce: Google/Outlook peuvent s’abonner au flux ICS.</p>
      <p><b>ICS (mes congés):</b> {{icsMy}}</p>
      <p><b>ICS (département):</b> {{icsDept}}</p>
      <hr/>
      <div *ngFor="let l of leaves">
        {{l.user?.fullName || l.user}} : {{l.startDate}} → {{l.endDate}} ({{l.type?.label || ''}})
      </div>
    </mat-card>
  `
})
export class LeaveTeamCalendarPage implements OnInit{
  leaves:any[]=[];
  icsMy=''; icsDept='';
  constructor(private api:LeaveWorkflowService){}
  async ngOnInit(){
    const r = await this.api.teamCalendar();
    this.leaves = r.items || [];
    this.icsMy = this.api.icsMyUrl();
    this.icsDept = this.api.icsDeptUrl();
  }
}
