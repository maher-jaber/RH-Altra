import { Component, Input, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { firstValueFrom } from 'rxjs';

import { AdvanceService } from '../../../core/api/advance.service';
import { AuthService } from '../../../core/auth.service';

@Component({
  standalone: true,
  selector: 'app-advance-actions-tab',
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
export class AdvanceActionsTab implements OnInit {
  @Input({ required: true }) advanceId!: number;

  item = signal<any | null>(null);
  loading = signal(false);
  msg = signal('');

  meId = computed(() => this.auth.me()?.id);

  constructor(private api: AdvanceService, private auth: AuthService) {}

  async ngOnInit() {
    await this.load();
  }

  private async load() {
    this.item.set(null);
    const a = await firstValueFrom(this.api.getOne(this.advanceId));
    this.item.set(a);
  }

  canAct(): boolean {
    const a = this.item();
    if (!a) return false;
    const isAdmin = this.auth.hasRole('ROLE_ADMIN');
    const isManager = this.auth.hasRole('ROLE_SUPERIOR') && (a.manager?.id === this.meId());
    return (isAdmin || isManager) && a.status === 'SUBMITTED';
  }

  async decide(d: 'APPROVE' | 'REJECT') {
    const a = this.item();
    if (!a) return;
    this.loading.set(true);
    this.msg.set('');
    try {
      await firstValueFrom(this.api.decide(a.id, d));
      await this.load();
      this.msg.set('Action effectuée.');
    } finally {
      this.loading.set(false);
    }
  }
}
