import { ChangeDetectionStrategy, Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { LeaveWorkflowService } from '../../../core/api/leave-workflow.service';
import { firstValueFrom } from 'rxjs';


@Component({
  standalone: true,
  selector: 'app-leave-overview-tab',
  imports: [CommonModule, MatCardModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card class="panel" *ngIf="leave(); else loading">
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <div class="h6 m-0">{{leave()?.type?.label || leave()?.type?.code}}</div>
          <div class="muted">{{leave()?.startDate}} → {{leave()?.endDate}} · {{leave()?.daysCount}} jour(s)</div>
          <div class="mt-1">
            Statut:
            <span class="badge" [ngClass]="statusBadgeClass(leave()?.status)">{{ statusLabel(leave()?.status) }}</span>
          </div>
        </div>
        <span class="badge bg-light text-dark" style="border:1px solid #eee">LEAVE</span>
      </div>

      <hr class="my-3"/>

      <div class="row g-3">
        <div class="col-12 col-md-6" *ngIf="leave()?.user">
          <div class="muted">Employé</div>
          <div><b>{{leave()?.user?.fullName || leave()?.user?.email}}</b></div>
          <div class="muted">{{leave()?.user?.email}}</div>
        </div>
        <div class="col-12 col-md-6" *ngIf="leave()?.manager">
          <div class="muted">Manager</div>
          <div><b>{{leave()?.manager?.fullName || leave()?.manager?.email}}</b></div>
          <div class="muted">{{leave()?.manager?.email}}</div>
        </div>

        <div class="col-12" *ngIf="leave()?.note">
          <div class="muted">Note</div>
          <div>{{leave()?.note}}</div>
        </div>


        <div class="col-12" *ngIf="leave()?.certificatePath">
          <div class="muted">Certificat</div>
          <button mat-stroked-button color="primary" (click)="downloadCert()">Télécharger certificat</button>
        </div>
        <div class="col-12" *ngIf="leave()?.managerComment || leave()?.hrComment">
          <div class="muted">Commentaires</div>
          <div *ngIf="leave()?.managerComment"><b>Manager:</b> {{leave()?.managerComment}}</div>
          <div *ngIf="leave()?.hrComment"><b>RH:</b> {{leave()?.hrComment}}</div>
        </div>
      </div>
    </mat-card>

    <ng-template #loading>
      <div class="muted p-2">Chargement...</div>
    </ng-template>
  `,
  styles: [`.panel{border-radius:16px;padding:14px}.muted{opacity:.75;font-size:12px}`]
})
export class LeaveOverviewTab implements OnInit{
  @Input({required:true}) leaveId!: string;
  leave = signal<any|null>(null);

  constructor(private api: LeaveWorkflowService){}

  async ngOnInit(){ await this.reload(); }

  async reload(){
    const res = await this.api.getLeave(this.leaveId);
    this.leave.set(res.leave || res);
  }

  async downloadCert(){
    // Download certificate (if any) as a blob and trigger a browser download.
    const blob = await firstValueFrom(this.api.downloadCertificate(this.leaveId));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // The backend may provide Content-Disposition; if not accessible, fall back to a safe filename.
    a.download = `certificat_${this.leaveId}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  statusLabel(s?: string | null): string {
    if (!s) return '—';
    switch (s) {
      case 'DRAFT': return 'Brouillon';
      case 'SUBMITTED': return 'En attente manager';
      case 'MANAGER_APPROVED': return 'Pré-validée (manager)';
      case 'HR_APPROVED':
      case 'RH_APPROVED':
      case 'APPROVED':
        return 'Validée (finale)';
      case 'REJECTED': return 'Refusée';
      case 'CANCELLED': return 'Annulée';
      default: return s;
    }
  }

  statusBadgeClass(s?: string | null): string {
    const v = (s || '').toUpperCase();
    if (v === 'SUBMITTED') return 'text-bg-warning';
    if (v === 'MANAGER_APPROVED') return 'text-bg-info';
    if (v === 'HR_APPROVED' || v === 'RH_APPROVED' || v === 'APPROVED') return 'text-bg-success';
    if (v === 'REJECTED') return 'text-bg-danger';
    if (v === 'CANCELLED') return 'text-bg-secondary';
    if (v === 'DRAFT') return 'text-bg-light text-dark';
    return 'text-bg-secondary';
  }
}
