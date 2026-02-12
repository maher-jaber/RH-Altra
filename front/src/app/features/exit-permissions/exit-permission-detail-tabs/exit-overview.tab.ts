import { Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { firstValueFrom } from 'rxjs';

import { ExitPermissionService } from '../../../core/api/exit-permission.service';

@Component({
  standalone: true,
  selector: 'app-exit-overview-tab',
  imports: [CommonModule, MatCardModule],
  template: `
    <div *ngIf="item(); else loading">
      <div class="d-flex flex-wrap align-items-start justify-content-between gap-3">
        <div>
          <div class="text-muted"><b>Du:</b> {{item()?.startAt | date:'short'}}</div>
          <div class="text-muted"><b>Au:</b> {{item()?.endAt | date:'short'}}</div>
          <div class="text-muted">Statut: <b>{{item()?.status}}</b></div>
          <div class="text-muted" *ngIf="item()?.reason">Motif: {{item()?.reason}}</div>
        </div>
        <span class="badge bg-light text-dark" style="border:1px solid #eee">EXIT</span>
      </div>

      <hr/>

      <div class="row g-2">
        <div class="col-12 col-md-6" *ngIf="item()?.user">
          <div class="small text-muted">Employé</div>
          <div class="fw-semibold">{{item()?.user?.fullName || item()?.user?.email}}</div>
        </div>
        <div class="col-12 col-md-6" *ngIf="item()?.manager">
          <div class="small text-muted">Manager</div>
          <div class="fw-semibold">{{item()?.manager?.fullName || item()?.manager?.email}}</div>
        </div>
      </div>
    </div>

    <ng-template #loading>
      <div class="text-muted p-2">Chargement...</div>
    </ng-template>
  `
})
export class ExitOverviewTab implements OnInit {
  @Input({ required: true }) exitId!: number;
  item = signal<any | null>(null);

  constructor(private api: ExitPermissionService) {}

  async ngOnInit() {
    const e = await firstValueFrom(this.api.getOne(this.exitId));
    this.item.set(e);
  }
}
