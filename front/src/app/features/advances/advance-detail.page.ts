import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

@Component({
  standalone: true,
  selector: 'app-advance-detail',
  imports: [CommonModule, RouterModule, MatTabsModule, MatCardModule, MatButtonModule],
  template: `
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
      <div>
        <h2 style="margin:0">Demande d'avance</h2>
        <div class="muted">Détails, audit et actions.</div>
      </div>
      <a mat-stroked-button routerLink="/advances">Retour</a>
    </div>

    <div style="height:12px"></div>

    <mat-card class="shell">
      <mat-tab-group (selectedIndexChange)="onTab($event)">
        <mat-tab label="Résumé">
          <ng-template matTabContent>
            <ng-container *ngIf="overviewCmp() && actionsCmp(); else loading">
              <ng-container *ngComponentOutlet="overviewCmp(); inputs: { advanceId: advanceId() }"></ng-container>

              <div style="height:12px"></div>
              <ng-container *ngComponentOutlet="actionsCmp(); inputs: { advanceId: advanceId() }"></ng-container>
            </ng-container>
          </ng-template>
        </mat-tab>

        <mat-tab label="Audit">
          <ng-template matTabContent>
            <ng-container *ngIf="auditCmp(); else loading">
              <ng-container *ngComponentOutlet="auditCmp(); inputs: { advanceId: advanceId() }"></ng-container>
            </ng-container>
          </ng-template>
        </mat-tab>
      </mat-tab-group>
    </mat-card>

    <ng-template #loading>
      <div class="muted p-2">Chargement...</div>
    </ng-template>
  `,
  styles: [
    `.shell{border-radius:18px;padding:8px}`,
    `.muted{opacity:.75;font-size:12px}`
  ]
})
export class AdvanceDetailPage implements OnInit {
  advanceId = signal<number>(0);
  overviewCmp = signal<any>(null);
  actionsCmp = signal<any>(null);
  auditCmp = signal<any>(null);

  private loadOverview = () => import('./advance-detail-tabs/advance-overview.tab').then(m => m.AdvanceOverviewTab);
  private loadActions = () => import('./advance-detail-tabs/advance-actions.tab').then(m => m.AdvanceActionsTab);
  private loadAudit = () => import('./advance-detail-tabs/advance-audit.tab').then(m => m.AdvanceAuditTab);

  constructor(private route: ActivatedRoute) {}

  async ngOnInit() {
    this.advanceId.set(Number(this.route.snapshot.paramMap.get('id') || '0'));
    const [Ov, Act] = await Promise.all([this.loadOverview(), this.loadActions()]);
    this.overviewCmp.set(Ov);
    this.actionsCmp.set(Act);
  }

  async onTab(i: number) {
    // tab 1 = Audit
    if(i === 1 && !this.auditCmp()){
      const A = await this.loadAudit();
      this.auditCmp.set(A);
    }
  }
}
