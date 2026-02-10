import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { LeaveWorkflowService } from '../../core/api/leave-workflow.service';

@Component({
  standalone:true,
  selector:'app-leave-stats',
  imports:[CommonModule, MatCardModule],
  template:`
    <mat-card>
      <h2>Statistiques congés</h2>
      <div *ngFor="let s of stats">
        {{s.type}} : <b>{{s.total}}</b>
      </div>
    </mat-card>
  `
})
export class LeaveStatsPage implements OnInit{
  stats:any[]=[];
  constructor(private api:LeaveWorkflowService){}
  async ngOnInit(){
    const r = await this.api.statsLeaves();
    this.stats = r.items || [];
  }
}
