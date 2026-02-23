import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';

export type DailyReportDetailData = {
  report: any;
};

@Component({
  standalone: true,
  selector: 'app-daily-report-detail-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatChipsModule,
  ],
  template: `
    <div class="hdr">
      <div>
        <div class="title">Compte‑rendu — Détails</div>
        <div class="sub">
          <span class="who">{{data.report?.user?.fullName || data.report?.user?.email || '—'}}</span>
          <span class="dot">•</span>
          <span>{{data.report?.date | date:'fullDate'}}</span>
        </div>
      </div>
      <button mat-icon-button mat-dialog-close aria-label="Fermer">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-divider></mat-divider>

    <div class="body">
      <div class="meta">
        <mat-chip-set>
          <mat-chip *ngIf="data.report?.hours !== null && data.report?.hours !== undefined">{{data.report.hours}} h</mat-chip>
          <mat-chip>{{data.report?.createdAt | date:'short'}}</mat-chip>
          <mat-chip *ngIf="data.report?.updatedAt && data.report?.updatedAt !== data.report?.createdAt">Modifié {{data.report.updatedAt | date:'short'}}</mat-chip>
        </mat-chip-set>
      </div>

      <div class="section">
        <div class="label">Tâches réalisées</div>
        <div class="box" [innerHTML]="toHtml(data.report?.tasks)"></div>
      </div>

      <div class="section" *ngIf="data.report?.blockers">
        <div class="label">Blocages</div>
        <div class="box" [innerHTML]="toHtml(data.report.blockers)"></div>
      </div>

      <div class="section" *ngIf="data.report?.nextDayPlan">
        <div class="label">Plan pour demain</div>
        <div class="box" [innerHTML]="toHtml(data.report.nextDayPlan)"></div>
      </div>
    </div>

    <div class="actions">
      <button mat-stroked-button mat-dialog-close>Fermer</button>
    </div>
  `,
  styles: [
    `
    .hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 18px}
    .title{font-weight:900;font-size:16px;color:var(--text)}
    .sub{margin-top:4px;opacity:.8;font-size:12px}
    .who{font-weight:800}
    .dot{margin:0 8px;opacity:.5}

    .body{padding:16px 18px 6px}
    .meta{margin-bottom:12px}

    .section{margin:12px 0}
    .label{font-size:12px;font-weight:900;letter-spacing:.3px;text-transform:uppercase;opacity:.7;margin-bottom:6px}
    .box{border:1px solid var(--stroke);background:var(--surface);border-radius:14px;padding:12px 12px;line-height:1.45}
    .box ul,.box ol{padding-left:18px;margin:6px 0}
    .box p{margin:0 0 6px}

    .actions{display:flex;justify-content:flex-end;padding:10px 18px 16px}
    `
  ]
})
export class DailyReportDetailDialog {
  constructor(@Inject(MAT_DIALOG_DATA) public data: DailyReportDetailData) {}

  toHtml(v: any): string {
    const s = (v ?? '') as string;
    if (!s) return '—';
    // If it already looks like HTML, render it; otherwise escape and keep new lines.
    const looksLikeHtml = /<\w+[^>]*>/.test(s);
    if (looksLikeHtml) return s;
    const esc = s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    return esc.replace(/\n/g, '<br>');
  }
}
