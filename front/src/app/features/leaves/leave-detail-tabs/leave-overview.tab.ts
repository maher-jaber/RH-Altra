import { ChangeDetectionStrategy, Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { LeaveWorkflowService } from '../../../core/api/leave-workflow.service';


@Component({
  standalone: true,
  selector: 'app-leave-overview-tab',
  imports: [CommonModule, MatCardModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card class="panel" *ngIf="leave(); else loading">
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <div class="h6 m-0">{{leave()?.type?.label || leave()?.type?.code}}</div>
          <div class="muted">{{leave()?.startDate}} → {{leave()?.endDate}} · {{leave()?.daysCount}} jour(s)</div>
          <div class="mt-1">Statut: <b>{{leave()?.status}}</b></div>
        </div>
        <span class="badge bg-light text-dark" style="border:1px solid #eee">LEAVE</span>
      </div>

      <hr class="my-3"/>

      <div class="row g-3">
        <div class="col-12 col-md-6" *ngIf="leave()?.user">
          <div class="muted">Employé</div>
          <div><b>{{leave()?.user?.fullName || leave()?.user?.email}}</b></div>
          <div class="muted">{{leave()?.user?.email}}</div>
        </div>
        <div class="col-12 col-md-6" *ngIf="leave()?.manager">
          <div class="muted">Manager</div>
          <div><b>{{leave()?.manager?.fullName || leave()?.manager?.email}}</b></div>
          <div class="muted">{{leave()?.manager?.email}}</div>
        </div>

        <div class="col-12" *ngIf="leave()?.note">
          <div class="muted">Note</div>
          <div>{{leave()?.note}}</div>
        </div>

        <div class="col-12" *ngIf="leave()?.managerComment || leave()?.hrComment">
          <div class="muted">Commentaires</div>
          <div *ngIf="leave()?.managerComment"><b>Manager:</b> {{leave()?.managerComment}}</div>
          <div *ngIf="leave()?.hrComment"><b>RH:</b> {{leave()?.hrComment}}</div>
        </div>
      </div>
    </mat-card>

    <ng-template #loading>
      <div class="muted p-2">Chargement...</div>
    </ng-template>
  `,
  styles: [`.panel{border-radius:16px;padding:14px}.muted{opacity:.75;font-size:12px}`]
})
export class LeaveOverviewTab implements OnInit{
  @Input({required:true}) leaveId!: string;
  leave = signal<any|null>(null);

  constructor(private api: LeaveWorkflowService){}

  async ngOnInit(){ await this.reload(); }

  async reload(){
    const res = await this.api.getLeave(this.leaveId);
    this.leave.set(res.leave || res);
  }
}
