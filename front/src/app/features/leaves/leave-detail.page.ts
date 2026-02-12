import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

import { LeaveWorkflowService } from '../../core/api/leave-workflow.service';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone:true,
  selector:'app-leave-detail',
  imports:[CommonModule, RouterModule, FormsModule, MatCardModule, MatButtonModule, MatInputModule],
  template:`
    <div class="d-flex align-items-center justify-content-between">
      <div>
        <h2 style="margin:0">Détail demande de congé</h2>
        <div style="opacity:.7" *ngIf="leave()">ID: {{leave()?.id}}</div>
      </div>
      <a mat-stroked-button routerLink="/leaves">Retour</a>
    </div>

    <div style="height:12px"></div>

    <mat-card *ngIf="leave()">
      <div class="d-flex align-items-center justify-content-between">
        <div>
          <b>{{leave()?.type?.label || leave()?.type?.code}}</b>
          <div style="opacity:.8">{{leave()?.startDate}} → {{leave()?.endDate}} · {{leave()?.daysCount}} jour(s)</div>
          <div style="opacity:.8">Statut: <b>{{leave()?.status}}</b></div>
        </div>
        <span class="badge bg-light text-dark" style="border:1px solid #eee">LEAVE</span>
      </div>

      <div style="height:10px"></div>

      <div *ngIf="leave()?.user" style="opacity:.9">
        <b>Employé:</b> {{leave()?.user?.fullName || leave()?.user?.email}}
      </div>
      <div *ngIf="leave()?.manager" style="opacity:.9">
        <b>Manager:</b> {{leave()?.manager?.fullName || leave()?.manager?.email}}
      </div>
      <div *ngIf="leave()?.note" style="margin-top:8px; opacity:.9">
        <b>Note:</b> {{leave()?.note}}
      </div>

      <div *ngIf="leave()?.managerComment || leave()?.hrComment" style="margin-top:10px">
        <div *ngIf="leave()?.managerComment"><b>Commentaire manager:</b> {{leave()?.managerComment}}</div>
        <div *ngIf="leave()?.hrComment"><b>Commentaire RH:</b> {{leave()?.hrComment}}</div>
      </div>

      <div style="height:14px"></div>

      <div class="d-flex flex-column gap-2" *ngIf="canAct()">
        <mat-form-field appearance="outline">
          <mat-label>Commentaire (optionnel)</mat-label>
          <input matInput [(ngModel)]="comment" placeholder="Ex: OK / Merci" />
        </mat-form-field>

        <div class="d-flex flex-wrap gap-2">
          <button mat-raised-button color="primary" (click)="approve()" [disabled]="loading()">Approuver</button>
          <button mat-stroked-button color="warn" (click)="reject()" [disabled]="loading()">Refuser</button>
        </div>

        <div *ngIf="msg()" style="opacity:.85">{{msg()}}</div>
      </div>

      <div *ngIf="!canAct()" style="opacity:.7;margin-top:10px">
        Aucune action disponible pour vous sur cette demande.
      </div>
    </mat-card>

    <div *ngIf="!leave()" style="opacity:.7;margin-top:16px">
      Chargement...
    </div>
  `,
  styles:[`mat-card{border-radius:16px;padding:14px}`]
})
export class LeaveDetailPage implements OnInit{
  leave = signal<any|null>(null);
  loading = signal(false);
  msg = signal('');
  comment = '';

  meId = computed(() => this.auth.me()?.id);

  constructor(private route:ActivatedRoute, private api:LeaveWorkflowService, private auth:AuthService){}

  async ngOnInit(){
    const id = this.route.snapshot.paramMap.get('id')!;
    await this.load(id);
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

  private async load(id:string){
    this.leave.set(null);
    const res = await this.api.getLeave(id);
    this.leave.set(res.leave || res);
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
      await this.load(lr.id);
      this.msg.set('Action effectuée.');
    } finally { this.loading.set(false); }
  }

  async reject(){
    const lr = this.leave(); if(!lr) return;
    this.loading.set(true); this.msg.set('');
    try{
      await this.api.reject(lr.id, this.comment || undefined);
      await this.load(lr.id);
      this.msg.set('Action effectuée.');
    } finally { this.loading.set(false); }
  }
}
