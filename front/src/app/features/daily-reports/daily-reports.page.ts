import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';

import { AuthService } from '../../core/auth.service';

import { DailyReportComposeTab } from './daily-report-tabs/report-compose.tab';
import { DailyReportMyTab } from './daily-report-tabs/report-my.tab';
import { DailyReportTeamTab } from './daily-report-tabs/report-team.tab';

@Component({
  standalone: true,
  selector: 'app-daily-reports-page',
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatTabsModule,
    DailyReportComposeTab,
    DailyReportMyTab,
    DailyReportTeamTab,
  ],
  template: `
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
      <div>
        <h2 style="margin:0">Compte-rendu journalier</h2>
        <div class="muted">Saisie, historique et suivi équipe — interface légère (onglets séparés).</div>
      </div>
      <div class="d-flex gap-2">
        <a class="btn btn-outline-secondary" routerLink="/dashboard"><i class="bi bi-arrow-left"></i> Retour</a>
      </div>
    </div>

    <div style="height:12px"></div>

    <mat-card class="panel">
      <mat-tab-group animationDuration="0ms" [selectedIndex]="selectedIndex()">
        <mat-tab label="Nouveau">
          <app-daily-report-compose-tab
            [refreshKey]="refreshKey()"
            (created)="onCreated()" />
        </mat-tab>

        <mat-tab label="Mes CR">
          <app-daily-report-my-tab [refreshKey]="refreshKey()" />
        </mat-tab>

        <mat-tab label="Équipe" *ngIf="canSeeTeam()">
          <app-daily-report-team-tab [refreshKey]="refreshKey()" />
        </mat-tab>
      </mat-tab-group>
    </mat-card>
  `,
  styles: [
    `.panel{border-radius:18px;padding:8px}`,
    `.muted{opacity:.75;font-size:12px}`,
  ]
})
export class DailyReportsPageComponent implements OnInit {
  // Used to request refresh in child tabs after create/updates
  refreshKey = signal(0);

  // mat-tab-group selected index (0=new, 1=my, 2=team)
  selectedIndex = signal(0);

  constructor(private auth: AuthService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    const tab = (this.route.snapshot.queryParamMap.get('tab') || 'new') as any;
    // new=0, my=1, team=2
    if (tab === 'my') this.selectedIndex.set(1);
    else if (tab === 'team' && this.canSeeTeam()) this.selectedIndex.set(2);
    else this.selectedIndex.set(0);
  }

  canSeeTeam(): boolean {
    return this.auth.hasRole('ROLE_SUPERIOR') || this.auth.hasRole('ROLE_ADMIN');
  }

  onCreated() {
    this.refreshKey.set(this.refreshKey() + 1);
  }
}
