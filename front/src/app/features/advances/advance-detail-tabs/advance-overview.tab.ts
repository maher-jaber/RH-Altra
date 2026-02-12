import { Component, Input, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { firstValueFrom } from 'rxjs';

import { AdvanceService } from '../../../core/api/advance.service';

@Component({
  standalone: true,
  selector: 'app-advance-overview-tab',
  imports: [CommonModule, MatCardModule],
  template: `
    <div *ngIf="item(); else loading">
      <div class="d-flex flex-wrap align-items-start justify-content-between gap-3">
        <div>
          <div class="fs-5 fw-bold">{{item()?.amount}} {{item()?.currency}}</div>
          <div class="text-muted">Statut: <b>{{item()?.status}}</b></div>
          <div class="text-muted">Période: <b>{{periodLabel()}}</b></div>
          <div class="text-muted">Créée: {{item()?.createdAt | date:'medium'}}</div>
          <div class="text-muted" *ngIf="item()?.updatedAt">Maj: {{item()?.updatedAt | date:'medium'}}</div>
          <div class="text-muted" *ngIf="item()?.reason">Motif: {{item()?.reason}}</div>
        </div>
        <span class="badge bg-light text-dark" style="border:1px solid #eee">ADVANCE</span>
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
  `,
})
export class AdvanceOverviewTab implements OnInit {
  @Input({ required: true }) advanceId!: number;

  item = signal<any | null>(null);

  periodLabel = computed(() => {
    const a: any = this.item();
    if (!a) return '—';
    const m = a.periodMonth ? String(a.periodMonth).padStart(2, '0') : '??';
    const y = a.periodYear || '????';
    return `${m}/${y}`;
  });

  constructor(private api: AdvanceService) {}

  async ngOnInit() {
    const a = await firstValueFrom(this.api.getOne(this.advanceId));
    this.item.set(a);
  }
}
