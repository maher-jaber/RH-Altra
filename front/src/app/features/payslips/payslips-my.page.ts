import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';

import { PayslipService } from '../../core/api/payslip.service';
import { AlertService } from '../../core/ui/alert.service';
import { PayslipItem } from '../../core/models';

@Component({
  standalone: true,
  selector: 'app-payslips-my',
  imports: [CommonModule, MatCardModule, MatButtonModule, MatListModule, MatIconModule],
  styles: [`
    .wrap { max-width: 980px; margin: 0 auto; }
    .hint { color: var(--text-2); }
    .row { display:flex; gap:10px; align-items:center; justify-content: space-between; }
    .meta { font-size: 12px; color: var(--text-2); }
    .title { font-weight: 900; }
  `],
  template: `
    <div class="wrap">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Mes fiches de paie</mat-card-title>
          <mat-card-subtitle class="hint">Vos fiches de paie publiées par la direction.</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div *ngIf="loading()" class="hint">Chargement…</div>
          <div *ngIf="!loading() && items().length === 0" class="hint">Aucune fiche publiée pour le moment.</div>

          <mat-nav-list *ngIf="items().length > 0">
            <div mat-list-item *ngFor="let p of items()">
              <div class="row" style="width:100%">
                <div>
                  <div class="title">{{p.month}}</div>
                  <div class="meta">{{p.originalFilename}}</div>
                </div>
                <button mat-stroked-button type="button" (click)="download(p.id, p.originalFilename)">Télécharger</button>
              </div>
            </div>
          </mat-nav-list>
        </mat-card-content>
      </mat-card>
    </div>
  `
})
export class PayslipsMyPage implements OnInit {
  loading = signal(true);
  items = signal<PayslipItem[]>([]);

  constructor(private api: PayslipService, private alerts: AlertService) {}

  async ngOnInit(): Promise<void> {
    try {
      const res = await this.api.my();
      this.items.set(res.items || []);
    } finally {
      this.loading.set(false);
    }
  }

  async download(id: string, filename?: string): Promise<void> {
    try {
      const blob = await this.api.downloadBlob(id);
    const url = URL.createObjectURL(blob);
    // Use a temporary anchor to suggest filename.
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `payslip-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
      await this.alerts.toast({ title: 'Téléchargement lancé', icon: 'success' });
    } catch (e: any) {
      await this.alerts.toast({ title: 'Téléchargement impossible', text: String(e?.message || 'Erreur API'), icon: 'error' });
    }
  }
}
