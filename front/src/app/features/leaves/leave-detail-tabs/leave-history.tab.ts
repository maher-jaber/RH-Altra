import { ChangeDetectionStrategy, Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaveWorkflowService } from '../../../core/api/leave-workflow.service';

@Component({
  standalone: true,
  selector: 'app-leave-history-tab',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel">
      <div class="h6 m-0">Historique / Audit</div>
      <div class="muted mb-3">Toutes les actions et changements de statut.</div>

      <div *ngIf="rows() === null" class="muted">Chargement...</div>

      <div *ngIf="rows() && rows()!.length === 0" class="muted">Aucun historique.</div>

      <div class="timeline" *ngIf="rows() && rows()!.length">
        <div class="item" *ngFor="let x of rows()!; trackBy: trackById">
          <div class="dot"></div>
          <div class="content">
            <div class="d-flex justify-content-between gap-2 flex-wrap">
              <div><b>{{ displayAction(x) }}</b></div>
              <div class="muted">{{x.at || x.createdAt || ''}}</div>
            </div>
            <div class="muted" *ngIf="x.byEmail || x.byName">par {{x.byName || x.byEmail}}</div>
            <div *ngIf="x.comment">{{x.comment}}</div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .panel{border:1px solid var(--stroke,#eee);border-radius:16px;padding:14px;background:var(--surface,#fff)}
    .muted{opacity:.75;font-size:12px}
    .timeline{display:flex;flex-direction:column;gap:10px;margin-top:8px}
    .item{display:flex;gap:12px;align-items:flex-start}
    .dot{width:10px;height:10px;border-radius:999px;background:#0d6efd;margin-top:6px}
    .content{flex:1;border:1px solid rgba(0,0,0,.06);border-radius:14px;padding:10px 12px;background:rgba(255,255,255,.65)}
  `]
})
export class LeaveHistoryTab implements OnInit{
  @Input({required:true}) leaveId!: string;
  rows = signal<any[]|null>(null);

  constructor(private api: LeaveWorkflowService){}

  async ngOnInit(){
    const res = await this.api.audit(this.leaveId);
    this.rows.set(res.items || res.audit || []);
  }

  trackById = (_:number, x:any) => x?.id || x?.at || _;

  displayAction(x: any): string {
    if (!x) return 'Action';
    if (x.action) return x.action;
    const s = (x.status || x.toStatus || x.newStatus || '').toString();
    if (!s) return 'Action';
    switch (s) {
      case 'DRAFT': return 'Brouillon';
      case 'SUBMITTED': return 'Soumise (en attente manager)';
      case 'MANAGER_APPROVED': return 'Pré-validée (manager)';
      case 'HR_APPROVED':
      case 'RH_APPROVED':
      case 'APPROVED': return 'Validée (finale)';
      case 'REJECTED': return 'Refusée';
      case 'CANCELLED': return 'Annulée';
      default: return s;
    }
  }
}
