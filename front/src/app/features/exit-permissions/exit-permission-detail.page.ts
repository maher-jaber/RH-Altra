import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { firstValueFrom } from 'rxjs';

import { ExitPermissionService } from '../../core/api/exit-permission.service';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  selector: 'app-exit-permission-detail',
  imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule],
  template: `
    <div class="d-flex align-items-center justify-content-between">
      <div>
        <h2 style="margin:0">Détail autorisation de sortie</h2>
        <div style="opacity:.7" *ngIf="item()">ID: {{item()?.id}}</div>
      </div>
      <a mat-stroked-button routerLink="/exit-permissions">Retour</a>
    </div>

    <div style="height:12px"></div>

    <mat-card *ngIf="item()">
      <div class="d-flex align-items-center justify-content-between">
        <div>
          <div style="opacity:.9"><b>Du:</b> {{item()?.startAt | date:'short'}}</div>
          <div style="opacity:.9"><b>Au:</b> {{item()?.endAt | date:'short'}}</div>
          <div style="opacity:.85">Statut: <b>{{item()?.status}}</b></div>
          <div style="opacity:.85" *ngIf="item()?.reason">Motif: {{item()?.reason}}</div>
        </div>
        <span class="badge bg-light text-dark" style="border:1px solid #eee">EXIT</span>
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

    <div *ngIf="!item()" style="opacity:.7;margin-top:16px">Chargement...</div>
  `,
  styles: [`mat-card{border-radius:16px;padding:14px}`]
})
export class ExitPermissionDetailPage implements OnInit {
  item = signal<any | null>(null);
  loading = signal(false);
  msg = signal('');

  meId = computed(() => this.auth.me()?.id);

  constructor(private route: ActivatedRoute, private api: ExitPermissionService, private auth: AuthService) {}

  async ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id') || '0');
    await this.load(id);
  }

  canAct() {
    const e = this.item();
    if (!e) return false;
    const isAdmin = this.auth.hasRole('ROLE_ADMIN');
    const isManager = this.auth.hasRole('ROLE_SUPERIOR') && (e.manager?.id === this.meId());
    return (isAdmin || isManager) && e.status === 'SUBMITTED';
  }

  private async load(id: number) {
    this.item.set(null);
    const e = await firstValueFrom(this.api.getOne(id));
    this.item.set(e);
  }

  async decide(d: 'APPROVE' | 'REJECT') {
    const e = this.item();
    if (!e) return;
    this.loading.set(true);
    this.msg.set('');
    try {
      await firstValueFrom(this.api.decide(e.id, d));
      await this.load(e.id);
      this.msg.set('Action effectuée.');
    } finally {
      this.loading.set(false);
    }
  }
}
