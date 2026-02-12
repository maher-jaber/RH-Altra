import { Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { AdvanceService } from '../../../core/api/advance.service';

@Component({
  standalone: true,
  selector: 'app-advance-audit-tab',
  imports: [CommonModule],
  template: `
    <div *ngIf="item(); else loading" class="p-2">
      <div class="text-muted small mb-2">Audit (JSON)</div>
      <pre class="bg-light p-2 rounded" style="max-height:420px;overflow:auto">{{item() | json}}</pre>
    </div>
    <ng-template #loading>
      <div class="text-muted p-2">Chargement...</div>
    </ng-template>
  `
})
export class AdvanceAuditTab implements OnInit {
  @Input({ required: true }) advanceId!: number;

  item = signal<any | null>(null);

  constructor(private api: AdvanceService) {}

  async ngOnInit() {
    const a = await firstValueFrom(this.api.getOne(this.advanceId));
    this.item.set(a);
  }
}
