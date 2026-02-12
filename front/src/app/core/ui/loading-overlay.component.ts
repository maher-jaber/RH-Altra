import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { LoadingService } from './loading.service';

@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  styles: [`
    .overlay {
      position: fixed;
      inset: 0;
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.10);
      backdrop-filter: blur(2px);
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--stroke);
      border-radius: 18px;
      padding: 16px 18px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 22px 60px rgba(0,0,0,.25);
    }
    .text { font-weight: 800; color: var(--text); }
    .sub { font-size: 12px; color: var(--text-2); margin-top: 2px; }
  `],
  template: `
    <div class="overlay" *ngIf="loader.isLoading()">
      <div class="card">
        <mat-spinner diameter="28"></mat-spinner>
        <div>
          <div class="text">Chargement…</div>
          <div class="sub">Merci de patienter</div>
        </div>
      </div>
    </div>
  `
})
export class LoadingOverlayComponent {
  constructor(public loader: LoadingService) {}
}
