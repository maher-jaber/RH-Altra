import { Component, Input, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { firstValueFrom } from 'rxjs';

import { ExitPermissionService } from '../../../core/api/exit-permission.service';
import { AuthService } from '../../../core/auth.service';

@Component({
  standalone: true,
  selector: 'app-exit-actions-tab',
  imports: [CommonModule, MatCardModule, MatButtonModule],
  template: `
    <mat-card class="box">
      <div class="d-flex flex-wrap align-items-start justify-content-between gap-2">
        <div>
          <div class="fw-bold">Actions</div>
          <div class="text-muted small">Approuver / Refuser si vous êtes manager ou admin et si la demande est soumise.</div>
        </div>
        <span class="badge bg-light text-dark" style="border:1px solid #eee">{{item()?.status || '—'}}</span>
      </div>

      <div style="height:12px"></div>

      <div *ngIf="canAct(); else noActions" class="d-flex flex-wrap gap-2">
        <button mat-raised-button color="primary" (click)="decide('APPROVE')" [disabled]="loading()">Approuver</button>
        <button mat-stroked-button color="warn" (click)="decide('REJECT')" [disabled]="loading()">Refuser</button>
      </div>

      <ng-template #noActions>
        <div class="text-muted">Aucune action disponible pour vous sur cette demande.</div>
      </ng-template>

      <div *ngIf="msg()" class="text-muted" style="margin-top:10px">{{msg()}}</div>
    </mat-card>
  `,
  styles: [`.box{border-radius:16px;padding:14px}`]
})
export class ExitActionsTab implements OnInit {
  @Input({ required: true }) exitId!: number;

  item = signal<any | null>(null);
  loading = signal(false);
  msg = signal('');

  meId = computed(() => Number(this.auth.me()?.id));

  constructor(private api: ExitPermissionService, private auth: AuthService) {}

  async ngOnInit() {
    await this.load();
  }

  private async load() {
    this.item.set(null);
    const e = await firstValueFrom(this.api.getOne(this.exitId));
    this.item.set(e);
  }

  canAct(): boolean {
    const e = this.item();
    if (!e) return false;
    const isAdmin = this.auth.hasRole('ROLE_ADMIN');
    // Manager permission is relationship-based (manager/manager2), not only ROLE_SUPERIOR.
    const isManager = (Number(e.manager?.id) === this.meId());
    const isManager2 = (Number(e.manager2?.id) === this.meId());
    const alreadySigned = (!!e.managerSignedAt && isManager) || (!!e.manager2SignedAt && isManager2);
    return (isAdmin || isManager || isManager2) && e.status === 'SUBMITTED' && !alreadySigned;
  }

  async decide(d: 'APPROVE' | 'REJECT') {
    const e = this.item();
    if (!e) return;
    this.loading.set(true);
    this.msg.set('');
    try {
      await firstValueFrom(this.api.decide(e.id, d));
      await this.load();
      this.msg.set('Action effectuée.');
    } finally {
      this.loading.set(false);
    }
  }
}
