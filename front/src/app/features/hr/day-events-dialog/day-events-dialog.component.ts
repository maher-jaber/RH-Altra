import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

export type DayEventsDialogData = {
  dayLabel: string; // ex: '27/02/2026'
  events: Array<{
    kind: 'LEAVE' | 'EXIT' | 'ADVANCE' | 'REPORT';
    title: string;
    status?: string;
    userLabel?: string;
    entityId?: string;
    color?: string;
  }>;
};

@Component({
  selector: 'app-day-events-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Événements du {{ data.dayLabel }}</h2>

    <mat-dialog-content class="content">
      <div *ngIf="!data.events?.length" class="empty">
        Aucun événement.
      </div>

      <div *ngFor="let e of data.events" class="row">
        <div class="left">
          <span class="dot" [style.background]="e.color || '#999'"></span>
          <div>
            <div class="title">
              <b>{{ e.title }}</b>
              <span class="kind">{{ e.kind }}</span>
            </div>
            <div class="meta" *ngIf="e.userLabel || e.status || e.entityId">
              <span *ngIf="e.userLabel">👤 {{ e.userLabel }}</span>
              <span *ngIf="e.status">• {{ e.status }}</span>
              <span *ngIf="e.entityId">• #{{ e.entityId }}</span>
            </div>
          </div>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="close()">Fermer</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .content { max-height: 65vh; overflow: auto; }
    .row { padding: 10px 0; border-bottom: 1px solid #eee; }
    .left { display:flex; gap:10px; align-items:flex-start; }
    .dot { width:10px; height:10px; border-radius:50%; margin-top:6px; }
    .title { display:flex; gap:8px; align-items:center; }
    .kind { font-size: 12px; opacity: .7; border: 1px solid #ddd; padding: 2px 6px; border-radius: 10px; }
    .meta { font-size: 12px; opacity:.75; margin-top:4px; display:flex; gap:10px; flex-wrap:wrap; }
    .empty { padding: 12px 0; opacity: .7; }
  `]
})
export class DayEventsDialogComponent {
  constructor(
    private ref: MatDialogRef<DayEventsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DayEventsDialogData,
  ) {}

  close() { this.ref.close(); }
}