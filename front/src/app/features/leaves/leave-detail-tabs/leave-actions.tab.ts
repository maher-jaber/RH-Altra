import { ChangeDetectionStrategy, Component, Input, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { LeaveWorkflowService } from '../../../core/api/leave-workflow.service';
import { AuthService } from '../../../core/auth.service';

@Component({
  standalone: true,
  selector: 'app-leave-actions-tab',
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card class="panel">
      <div class="h6 m-0">Actions</div>
      <div class="muted mb-3">Validation / refus selon votre rôle.</div>

      <div *ngIf="leave()===null" class="muted">Chargement...</div>

      <div *ngIf="leave() && canAct()">
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Commentaire (optionnel)</mat-label>
          <input matInput [(ngModel)]="comment" placeholder="Ex: OK / Merci" />
        </mat-form-field>

        <div class="d-flex flex-wrap gap-2">
          <button mat-raised-button color="primary" (click)="approve()" [disabled]="loading()">Approuver</button>
          <button mat-stroked-button color="warn" (click)="reject()" [disabled]="loading()">Refuser</button>
        </div>

        <div *ngIf="msg()" class="muted mt-2">{{msg()}}</div>
      </div>

      <div *ngIf="leave() && !canAct()" class="muted">
        Aucune action disponible pour vous sur cette demande.
      </div>
    </mat-card>
  `,
  styles: [`.panel{border-radius:16px;padding:14px}.muted{opacity:.75;font-size:12px}`]
})
export class LeaveActionsTab implements OnInit{
  @Input({required:true}) leaveId!: string;

  leave = signal<any|null>(null);
  loading = signal(false);
  msg = signal('');
  comment = '';

  meId = computed(() => this.auth.me()?.id);

  constructor(private api: LeaveWorkflowService, private auth: AuthService){}

  async ngOnInit(){ await this.reload(); }

  async reload(){
    const res = await this.api.getLeave(this.leaveId);
    this.leave.set(res.leave || res);
  }

  canAct(){
    const lr = this.leave();
    if(!lr) return false;
    const isAdmin = this.auth.hasRole('ROLE_ADMIN');
    const isManager = this.auth.hasRole('ROLE_SUPERIOR') && (lr.manager?.id === this.meId());
    if(isManager && lr.status === 'SUBMITTED') return true;
    if(isAdmin && lr.status === 'MANAGER_APPROVED') return true;
    return false;
  }

  async approve(){
    const lr = this.leave(); if(!lr) return;
    this.loading.set(true); this.msg.set('');
    try{
      if(this.auth.hasRole('ROLE_ADMIN')) {
        await this.api.hrApprove(lr.id, this.comment || undefined);
      } else {
        await this.api.managerApprove(lr.id, this.comment || undefined);
      }
      await this.reload();
      this.msg.set('Action effectuée.');
    } finally { this.loading.set(false); }
  }

  async reject(){
    const lr = this.leave(); if(!lr) return;
    this.loading.set(true); this.msg.set('');
    try{
      await this.api.reject(lr.id, this.comment || undefined);
      await this.reload();
      this.msg.set('Action effectuée.');
    } finally { this.loading.set(false); }
  }
}
