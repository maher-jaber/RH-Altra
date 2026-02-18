import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

@Component({
  standalone:true,
  selector:'app-leave-detail',
  imports:[CommonModule, RouterModule, MatTabsModule, MatCardModule, MatButtonModule],
  template:`
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
      <div>
        <h2 style="margin:0">Demande de congé</h2>
        <div class="muted">Détails, audit, pièces jointes et actions.</div>
      </div>
      <a mat-stroked-button routerLink="/leaves">Retour</a>
    </div>

    <div style="height:12px"></div>

    <mat-card class="shell">
      <mat-tab-group (selectedIndexChange)="onTab($event)">
        <mat-tab label="Résumé">
          <ng-template matTabContent>
            <ng-container *ngIf="overviewCmp() && actionsCmp(); else loading">
              <ng-container *ngComponentOutlet="overviewCmp(); inputs: { leaveId: leaveId() }"></ng-container>

              <div style="height:12px"></div>
              <!-- Actions sous le résumé (au lieu d'un onglet séparé) -->
              <ng-container *ngComponentOutlet="actionsCmp(); inputs: { leaveId: leaveId() }"></ng-container>
            </ng-container>
          </ng-template>
        </mat-tab>

        <mat-tab label="Historique validation">
          <ng-template matTabContent>
            <ng-container *ngIf="historyCmp(); else loading">
              <ng-container *ngComponentOutlet="historyCmp(); inputs: { leaveId: leaveId() }"></ng-container>
            </ng-container>
          </ng-template>
        </mat-tab>
      </mat-tab-group>
    </mat-card>

    <ng-template #loading>
      <div class="muted p-2">Chargement...</div>
    </ng-template>
  `,
  styles:[`
    .shell{border-radius:18px;padding:8px}
    .muted{opacity:.75;font-size:12px}
  `]
})
export class LeaveDetailPage implements OnInit{
  leaveId = signal<string>('');
  overviewCmp = signal<any>(null);
  historyCmp = signal<any>(null);
  actionsCmp = signal<any>(null);

  private loadOverview = () => import('./leave-detail-tabs/leave-overview.tab').then(m => m.LeaveOverviewTab);
  private loadHistory = () => import('./leave-detail-tabs/leave-history.tab').then(m => m.LeaveHistoryTab);
  private loadActions = () => import('./leave-detail-tabs/leave-actions.tab').then(m => m.LeaveActionsTab);

  constructor(private route:ActivatedRoute){}

  async ngOnInit(){
    this.leaveId.set(this.route.snapshot.paramMap.get('id')!);
    // Pré-charge résumé + actions pour affichage direct (pas d'onglet Actions séparé)
    const [Ov, Act] = await Promise.all([this.loadOverview(), this.loadActions()]);
    this.overviewCmp.set(Ov);
    this.actionsCmp.set(Act);
  }

  async onTab(i:number){
    // On ne charge l'historique qu'au besoin
    if(i === 1 && !this.historyCmp()){
      const H = await this.loadHistory();
      this.historyCmp.set(H);
    }
  }
}
