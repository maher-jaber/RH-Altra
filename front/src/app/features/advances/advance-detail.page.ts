import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

import { AdvanceService } from '../../core/api/advance.service';
import { AuthService } from '../../core/auth.service';
import { firstValueFrom } from 'rxjs';

@Component({
  standalone:true,
  selector:'app-advance-detail',
  imports:[CommonModule, RouterModule, MatCardModule, MatButtonModule],
  template:`
    <div class="d-flex align-items-center justify-content-between">
      <div>
        <h2 style="margin:0">Détail demande d'avance</h2>
        <div style="opacity:.7" *ngIf="item()">ID: {{item()?.id}}</div>
      </div>
      <a mat-stroked-button routerLink="/advances">Retour</a>
    </div>

    <div style="height:12px"></div>

    <mat-card *ngIf="item()">
      <div class="d-flex align-items-center justify-content-between">
        <div>
          <b>{{item()?.amount}} {{item()?.currency}}</b>
          <div style="opacity:.8">Statut: <b>{{item()?.status}}</b></div>
          <div style="opacity:.8" *ngIf="item()?.reason">Motif: {{item()?.reason}}</div>
        </div>
        <span class="badge bg-light text-dark" style="border:1px solid #eee">ADVANCE</span>
      </div>

      <div style="height:10px"></div>

      <div *ngIf="item()?.user" style="opacity:.9">
        <b>Employé:</b> {{item()?.user?.fullName || item()?.user?.email}}
      </div>
      <div *ngIf="item()?.manager" style="opacity:.9">
        <b>Manager:</b> {{item()?.manager?.fullName || item()?.manager?.email}}
      </div>

      <div style="height:14px"></div>

      <div class="d-flex flex-wrap gap-2" *ngIf="canAct()">
        <button mat-raised-button color="primary" (click)="decide('APPROVE')" [disabled]="loading()">Approuver</button>
        <button mat-stroked-button color="warn" (click)="decide('REJECT')" [disabled]="loading()">Refuser</button>
      </div>

      <div *ngIf="msg()" style="margin-top:10px; opacity:.85">{{msg()}}</div>

      <div *ngIf="!canAct()" style="opacity:.7;margin-top:10px">
        Aucune action disponible pour vous sur cette demande.
      </div>
    </mat-card>

    <div *ngIf="!item()" style="opacity:.7;margin-top:16px">
      Chargement...
    </div>
  `,
  styles:[`mat-card{border-radius:16px;padding:14px}`]
})
export class AdvanceDetailPage implements OnInit{
  item = signal<any|null>(null);
  loading = signal(false);
  msg = signal('');

  meId = computed(() => this.auth.me()?.id);

  constructor(private route:ActivatedRoute, private api:AdvanceService, private auth:AuthService){}

  async ngOnInit(){
    const id = Number(this.route.snapshot.paramMap.get('id') || '0');
    await this.load(id);
  }

  canAct(){
    const a = this.item();
    if(!a) return false;
    const isAdmin = this.auth.hasRole('ROLE_ADMIN');
    const isManager = this.auth.hasRole('ROLE_SUPERIOR') && (a.manager?.id === this.meId());
    if((isAdmin || isManager) && a.status === 'SUBMITTED') return true;
    return false;
  }

  private async load(id:number){
    this.item.set(null);
    const a = await firstValueFrom(this.api.getOne(id));
    this.item.set(a);
  }

  async decide(d:'APPROVE'|'REJECT'){
    const a = this.item(); if(!a) return;
    this.loading.set(true); this.msg.set('');
    try{
      await firstValueFrom(this.api.decide(a.id, d));
      await this.load(a.id);
      this.msg.set('Action effectuée.');
    } finally { this.loading.set(false); }
  }
}
