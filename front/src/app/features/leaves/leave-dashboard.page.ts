import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { RouterModule } from '@angular/router';
import { LeaveWorkflowService } from '../../core/api/leave-workflow.service';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone:true,
  selector:'app-leave-dashboard',
  imports:[CommonModule,MatCardModule,MatButtonModule,MatTableModule,RouterModule],
  styles:[`
    .grid{display:grid;grid-template-columns:1.2fr .8fr;gap:16px}
    @media(max-width:980px){.grid{grid-template-columns:1fr}}
    mat-card{border-radius:16px}
    table{width:100%}
  `],
  template:`
  <div class="grid">
    <mat-card>
      <h2>Congés – Tableau de bord</h2>
<p class="muted">Les jours sont calculés automatiquement en jours ouvrés (week-ends + jours fériés exclus).</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <a mat-stroked-button routerLink="/leaves/my">Mes demandes</a>
        <a mat-stroked-button routerLink="/leaves/pending-manager">Validation Manager</a>
        <a *ngIf="isAdmin" mat-stroked-button routerLink="/leaves/pending-hr">Validation RH</a>
      </div>

      <p><b>Mes demandes:</b> {{my().length}}</p>
      <p><b>À valider (manager):</b> {{pendingManager().length}}</p>
      <p *ngIf="isAdmin"><b>À valider (RH):</b> {{pendingHr().length}}</p>
    </mat-card>

    <mat-card>
      <h3>Solde (année {{year}})</h3>
      <table mat-table [dataSource]="balances()">
        <ng-container matColumnDef="type">
          <th mat-header-cell *matHeaderCellDef>Type</th>
          <td mat-cell *matCellDef="let b">{{b.type.label}}</td>
        </ng-container>
        <ng-container matColumnDef="used">
          <th mat-header-cell *matHeaderCellDef>Pris</th>
          <td mat-cell *matCellDef="let b">{{b.usedDays}}</td>
        </ng-container>
        <ng-container matColumnDef="remaining">
          <th mat-header-cell *matHeaderCellDef>Reste</th>
          <td mat-cell *matCellDef="let b">{{b.remainingDays === null ? '—' : b.remainingDays}}</td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="balCols"></tr>
        <tr mat-row *matRowDef="let row; columns: balCols;"></tr>
      </table>
    </mat-card>
  </div>`
})
export class LeaveDashboardPage implements OnInit {
  year = new Date().getFullYear();
  my=signal<any[]>([]); pendingManager=signal<any[]>([]); pendingHr=signal<any[]>([]);
  balances=signal<any[]>([]);
  balCols = ['type','used','remaining'];
  isAdmin = false;

  constructor(private api:LeaveWorkflowService, private auth: AuthService){}

  async ngOnInit(){
    this.isAdmin = this.auth.hasRole('ROLE_ADMIN');

    // Do NOT call pendingHr for non-admins (403 should not log out anyway, but it is unnecessary traffic).
    const requests: Promise<any>[] = [this.api.my(), this.api.pendingManager(), this.api.balance(this.year)];
    if (this.isAdmin) requests.splice(2, 0, this.api.pendingHr());

    const res = await Promise.all(requests);
    const my = res[0];
    const pm = res[1];
    const ph = this.isAdmin ? res[2] : { items: [] };
    const bal = this.isAdmin ? res[3] : res[2];
    this.my.set(my.items||[]);
    this.pendingManager.set(pm.items||[]);
    this.pendingHr.set(ph.items||[]);
    this.balances.set(bal.items||[]);
  }
}
