import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

import { PayslipService } from '../../core/api/payslip.service';
import { AlertService } from '../../core/ui/alert.service';
import { PayslipImportResult } from '../../core/models';

type TeamUser = { id: string; fullName?: string | null; email?: string | null };

@Component({
  standalone: true,
  selector: 'app-payslips-import',
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDividerModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  styles: [`
    .wrap { max-width: 1200px; margin: 0 auto; }
    .hint { color: var(--text-2); }
    .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 980px){ .grid { grid-template-columns: 1fr; } }
    .results { margin-top: 14px; display:grid; gap: 10px; }
    .item { border: 1px solid var(--stroke); background: var(--surface); border-radius: 16px; padding: 12px; }
    .row { display:flex; align-items:flex-start; justify-content: space-between; gap: 12px; }
    .file { font-weight: 900; }
    .meta { font-size: 12px; color: var(--text-2); }
    .tag { display:inline-flex; align-items:center; gap:6px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--stroke); background: var(--surface-2); font-size: 12px; font-weight: 800; }
    .tag.ok { border-color: rgba(16,185,129,.35); }
    .tag.warn { border-color: rgba(245,158,11,.35); }
    .tag.bad { border-color: rgba(239,68,68,.35); }
    .actions { display:flex; gap: 10px; flex-wrap: wrap; }
  `],
  template: `
    <div class="wrap">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Import fiches de paie (PDF)</mat-card-title>
          <mat-card-subtitle class="hint">
            Uploadez les PDFs dans votre espace Manager. Le système tente d'associer automatiquement chaque fichier à l'employé.
            Vous pouvez corriger manuellement en cas d'ambiguïté ou d'erreur.
          </mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <div class="grid">
            <mat-form-field appearance="outline">
              <mat-label>Mois</mat-label>
              <input
                matInput
                [matDatepicker]="picker"
                [value]="monthDate"
                placeholder="Choisir mois"
                readonly
                (dateChange)="onMonthChange($event.value)"
              />
              <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-datepicker
                #picker
                startView="multi-year"
                (monthSelected)="chosenMonthHandler($event, picker)"
              ></mat-datepicker>
              <mat-hint>Mois sélectionné : {{ monthLabel() }}</mat-hint>
            </mat-form-field>

            <div>
              <div class="hint" style="margin-bottom:6px">Fichiers PDF (multi)</div>
              <input type="file" accept="application/pdf,.pdf" multiple (change)="onFiles($event)" />
              <div class="meta" *ngIf="selectedFiles().length">{{selectedFiles().length}} fichier(s) sélectionné(s)</div>
            </div>
          </div>

          <div style="margin-top: 10px" class="actions">
            <button mat-raised-button type="button" (click)="doImport()" [disabled]="busy() || !month || selectedFiles().length===0">Importer</button>
            <button mat-stroked-button type="button" (click)="doPublish()" [disabled]="busy() || !month || !canPublish()">Publier le mois</button>
            <span class="hint" *ngIf="busy()">Traitement…</span>
          </div>

          <mat-divider style="margin: 14px 0"></mat-divider>

          <div class="hint" style="margin-bottom:8px">Envoi manuel (un fichier → un employé)</div>
          <div class="grid">
            <mat-form-field appearance="outline">
              <mat-label>Employé</mat-label>
              <mat-select [(ngModel)]="manualUserId">
                <mat-option *ngFor="let u of teamUsers()" [value]="u.id">
                  {{u.fullName || u.email || ('ID ' + u.id)}}
                </mat-option>
              </mat-select>
              <mat-hint>Sélection limitée à votre équipe (ou tous si Admin)</mat-hint>
            </mat-form-field>
            <div>
              <div class="hint" style="margin-bottom:6px">PDF</div>
              <input type="file" accept="application/pdf,.pdf" (change)="onManualFile($event)" />
              <div class="meta" *ngIf="manualFile()">{{manualFile()?.name}}</div>
            </div>
          </div>
          <button mat-stroked-button type="button" (click)="doManual()" [disabled]="busy() || !month || !manualUserId || !manualFile()">Envoyer manuellement</button>

          <div class="results" *ngIf="results().length">
            <div class="item" *ngFor="let r of results()">
              <div class="row">
                <div>
                  <div class="file">{{r.file}}</div>
                  <div class="meta">Candidat extrait: {{r.candidate || '—'}}</div>
                  <div style="margin-top:6px">
                    <span class="tag" [ngClass]="tagClass(r)">Statut: {{r.status || '—'}}</span>
                    <span class="tag" *ngIf="r.matchScore != null">Score: {{r.matchScore}}</span>
                    <span class="tag ok" *ngIf="r.matchedUser">Employé: {{r.matchedUser.fullName || ('ID ' + r.matchedUser.id)}}</span>
                    <span class="tag bad" *ngIf="!r.ok">Erreur: {{r.error}}</span>
                  </div>
                </div>

                <div style="min-width: 320px" *ngIf="r.ok">
                  <mat-form-field appearance="outline" style="width:100%">
                    <mat-label>Assigner / corriger</mat-label>
                    <mat-select [(ngModel)]="assignPick[r.id || r.file]">
                      <mat-option [value]="''">—</mat-option>
                      <mat-option *ngFor="let u of teamUsers()" [value]="u.id">
                        {{u.fullName || u.email || ('ID ' + u.id)}}
                      </mat-option>
                    </mat-select>
                    <mat-hint>Choisissez l'employé puis cliquez "Assigner"</mat-hint>
                  </mat-form-field>
                  <div class="actions">
                    <button mat-stroked-button type="button" (click)="doAssign(r)" [disabled]="busy() || !r.id || !assignPick[r.id || r.file]">Assigner</button>
                    <button mat-stroked-button type="button" *ngIf="r.id" (click)="preview(r.id)">Télécharger (preview)</button>
                  </div>
                </div>
              </div>

              <div class="meta" style="margin-top:8px" *ngIf="(r.topCandidates||[]).length">
                Top candidats: <span *ngFor="let c of r.topCandidates; let last = last">{{c.fullName}} ({{c.score}}){{last?'':', '}}</span>
              </div>
            </div>
          </div>

        </mat-card-content>
      </mat-card>
    </div>
  `
})
export class PayslipsImportPage implements OnInit {
  month = '';
  monthDate: Date | null = null;
  busy = signal(false);
  selectedFiles = signal<File[]>([]);
  results = signal<PayslipImportResult[]>([]);

  teamUsers = signal<TeamUser[]>([]);

  // manual send
  manualUserId: string = '';
  manualFile = signal<File | null>(null);

  // per row assignment selection
  assignPick: Record<string, string> = {};

  constructor(private api: PayslipService, private alerts: AlertService) {}

  /**
   * Affichage lisible du mois sélectionné (FR) : "mars 2026"
   */
  monthLabel(): string {
    const d = this.monthDate;
    if (!d) return this.month || '—';
    return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(d);
  }

  /**
   * Vrai si on peut publier au moins 1 fiche (au moins une fiche a un matchedUser).
   */
  canPublish(): boolean {
    return this.results().some(r => !!(r.matchedUser && r.matchedUser.id));
  }

  /**
   * Sélection du mois depuis le picker.
   */
  onMonthChange(value: Date | null): void {
    if (!value) return;
    this.setMonth(value);
  }

  /**
   * Handler spécifique au MatDatepicker (monthSelected).
   */
  chosenMonthHandler(normalizedMonth: Date, datepicker: any): void {
    this.setMonth(normalizedMonth);
    if (datepicker && typeof datepicker.close === 'function') {
      datepicker.close();
    }
  }

  private setMonth(d: Date): void {
    const year = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    this.month = `${year}-${mm}`;
    this.monthDate = new Date(year, d.getMonth(), 1);
  }

  onFiles(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    this.selectedFiles.set(files);
  }

  onManualFile(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    const file = (input.files && input.files[0]) ? input.files[0] : null;
    this.manualFile.set(file);
  }

  async ngOnInit(): Promise<void> {
    // Default month: current YYYY-MM
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    this.month = `${d.getFullYear()}-${mm}`;
    this.monthDate = new Date(d.getFullYear(), d.getMonth(), 1);

    try {
      const res = await this.api.teamUsers();
      this.teamUsers.set(res.items || []);
    } catch (e: any) {
      await this.alerts.toast({ title: 'Import impossible', text: String(e?.message || 'Erreur API'), icon: 'error' });
    } finally {
      this.busy.set(false);
    }
  }

  async doPublish(): Promise<void> {
    if (!this.canPublish()) {
      await this.alerts.toast({ title: 'Rien à publier', text: 'Aucune fiche de paie n\'est associée à un employé.', icon: 'info' });
      return;
    }

    const hasUnmatched = this.results().some(r => !(r.matchedUser && r.matchedUser.id));
    if (hasUnmatched) {
      const ok = await this.alerts.confirm({ title: 'Certaines fiches ne sont pas assignées', text: 'Publier quand même celles qui sont assignées ?', confirmText: 'Publier' });
      if (!ok) return;
    }

    this.busy.set(true);
    try {
      const res = await this.api.publish(this.month);
      if (res.published > 0) {
        await this.alerts.toast({ title: 'Publication réussie', text: `${res.published} fiche(s) publiée(s) (${res.month}).`, icon: 'success' });
        // mark locally
        this.results.set(this.results().map(x => (x.matchedUser && x.matchedUser.id) ? ({ ...x, status: 'PUBLISHED' } as any) : x));
      } else {
        await this.alerts.toast({ title: 'Aucune fiche publiée', text: 'Vérifiez que les fiches sont bien assignées et que le mois est correct.', icon: 'info' });
      }
    } catch (e: any) {
      await this.alerts.toast({ title: 'Publication impossible', text: String(e?.message || 'Erreur API'), icon: 'error' });
    } finally {
      this.busy.set(false);
    }
  }

  async doImport(): Promise<void> {
    if (!this.month || this.selectedFiles().length === 0) return;
    this.busy.set(true);
    try {
      const res = await this.api.import(this.month, this.selectedFiles());
      this.results.set(res.items || []);
      this.alerts.toast({ title: 'Import terminé', text: `${(res.items || []).length} fichier(s) traité(s).`, icon: 'success' });
    } catch (e: any) {
      this.alerts.toast({ title: 'Import impossible', text: String(e?.message || 'Erreur API'), icon: 'error' });
    } finally {
      this.busy.set(false);
    }
  }

  async doAssign(r: PayslipImportResult): Promise<void> {
    const id = r.id;
    if (!id) return;
    const userId = this.assignPick[id] || this.assignPick[r.file];
    if (!userId) return;

    this.busy.set(true);
    try {
      await this.api.assign(id, userId);
      this.alerts.toast({ title: 'Assignation enregistrée', icon: 'success' });
      // reflect locally
      const u = this.teamUsers().find(x => x.id === userId);
      const items: PayslipImportResult[] = this.results().map((x): PayslipImportResult => {
        if (x.id !== id) return x;
        return {
          ...x,
          // Keep literal type (avoid widening to string during inference)
          status: 'MANUAL' as PayslipImportResult['status'],
          matchedUser: { id: userId, fullName: u?.fullName || null },
        } as PayslipImportResult;
      });
      this.results.set(items);
    } finally {
      this.busy.set(false);
    }
  }

  async doManual(): Promise<void> {
    const f = this.manualFile();
    if (!f) return;
    this.busy.set(true);
    try {
      await this.api.manual(this.month, this.manualUserId, f);
      this.alerts.toast({ title: 'Envoi manuel terminé', icon: 'success' });
      this.manualFile.set(null);
      this.manualUserId = '';
    } finally {
      this.busy.set(false);
    }
  }

  download(id: string): string {
    return this.api.downloadUrl(id);
  }

  async preview(id: string): Promise<void> {
    this.busy.set(true);
    try {
      const blob = await this.api.downloadBlob(id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      this.busy.set(false);
    }
  }

  tagClass(r: PayslipImportResult): string {
    const st = r.status || '';
    if (st === 'AUTO' || st === 'PUBLISHED' || st === 'MANUAL') return 'ok';
    if (st === 'PROBABLE' || st === 'AMBIGUOUS') return 'warn';
    if (st === 'UNMATCHED') return 'bad';
    return '';
  }
}
