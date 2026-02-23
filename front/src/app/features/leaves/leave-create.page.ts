import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';

import { LeaveWorkflowService } from '../../core/api/leave-workflow.service';
import { AlertService } from '../../core/ui/alert.service';

type LeaveType = { id: string; code: string; label: string; annualAllowance: number; requiresCertificate: boolean };
type BalanceRow = { type: LeaveType; year: number; usedDays: number; remainingDays: number | null };

@Component({
  standalone: true,
  selector: 'app-leave-create',
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule
  ],
  styles: [`
    mat-card{border-radius:16px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    @media(max-width:980px){.grid{grid-template-columns:1fr}}
    .muted{opacity:.75;font-size:12px}
    .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
  `],
  template: `
    <mat-card>
      <div class="row" style="justify-content:space-between">
        <h2>Nouvelle demande de congé</h2>
    
      </div>

      <div class="grid">
        <div>
          <mat-form-field appearance="outline" style="width:100%">
            <mat-label>Type de congé</mat-label>
            <mat-select [(ngModel)]="typeId" (selectionChange)="recompute()">
              <mat-option *ngFor="let t of types()" [value]="t.id">{{t.label}}</mat-option>
            </mat-select>
          </mat-form-field>

          <div class="grid">
            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>Date début</mat-label>
              <!-- Use ngModelChange (not only change) to avoid cases where the date is selected but buttons stay disabled -->
              <input matInput type="date" [min]="minDate" [(ngModel)]="startDate" (ngModelChange)="recompute()" />
            </mat-form-field>

            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>Date fin</mat-label>
              <input matInput type="date" [min]="minDate" [(ngModel)]="endDate" (ngModelChange)="recompute()" />
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline" style="width:100%">
            <mat-label>Note (optionnel)</mat-label>
            <input matInput [(ngModel)]="note" placeholder="Ex: rendez-vous médical, déplacement..." />
          </mat-form-field>

          <div class="row">
            <div><b>Jours ouvrés:</b> {{workingDays() ?? '—'}}</div>
            <div class="muted">Week-ends + jours fériés exclus</div>
          </div>

          <div class="row" style="margin-top:10px" *ngIf="selectedBalance() as b">
            <div><b>Solde actuel:</b> {{ b.remainingDays === null ? '—' : b.remainingDays }} jours</div>
            <div *ngIf="remainingAfter() !== null" class="muted">
              Après cette demande: {{ remainingAfter() }} jours
            </div>
            <div class="muted" *ngIf="selectedType()?.code==='UNPAID'">Sans solde: pas de limite</div>
          </div>

          <div style="margin-top:12px">
            <label class="muted" *ngIf="requiresCertificate()">Certificat requis (PDF/JPG/PNG)</label><br/>
            <input type="file" (change)="onFile($event)" />
            <div class="muted" *ngIf="fileName">{{fileName}}</div>
          </div>

          <div class="row" style="margin-top:16px">
            <button mat-flat-button color="primary" (click)="create()" [disabled]="creating || !canCreate()">
              Créer (brouillon)
            </button>
            <button mat-stroked-button color="primary" (click)="createAndSubmit()" [disabled]="creating || !canSubmit()">
              Créer & Soumettre
            </button>
          </div>

          <div class="muted" style="margin-top:10px" *ngIf="validationMsg()">{{validationMsg()}}</div>
        </div>

        <div>
          <mat-card>
            <h3>Récapitulatif</h3>
            <p><b>Type:</b> {{selectedType()?.label || '—'}}</p>
            <p><b>Période:</b> {{startDate || '—'}} → {{endDate || '—'}}</p>
            <p><b>Jours:</b> {{workingDays() ?? '—'}}</p>
            <p><b>Certificat:</b> {{requiresCertificate() ? 'Oui' : 'Non'}}</p>
          </mat-card>

          <mat-card style="margin-top:16px">
            <h3>Règles</h3>
            <ul class="muted">
              <li>Jours calculés en jours ouvrés (samedi/dimanche + jours fériés exclus).</li>
              <li>Certificat obligatoire si le type l’exige (ex: maladie).</li>
              <li>Le solde est contrôlé (sauf sans solde).</li>
              <li>Les chevauchements de dates sont refusés.</li>
            </ul>
          </mat-card>
        </div>
      </div>
    </mat-card>
  `
})
export class LeaveCreatePage implements OnInit {
  year = new Date().getFullYear();
  // Prevent selecting past dates (rule requested)
  minDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  types = signal<LeaveType[]>([]);
  balances = signal<BalanceRow[]>([]);

  typeId = '';
  startDate = '';
  endDate = '';
  note = '';
  workingDays = signal<number|null>(null);
  file: File | null = null;
  fileName = '';

  creating = false;
  validationMsg = signal<string>('');

  constructor(private api: LeaveWorkflowService, private alert: AlertService, private router: Router) {}

  async ngOnInit() {
    const [typesRes, balRes] = await Promise.all([
      this.api.listTypes(),
      this.api.balance(this.year),
    ]);
    this.types.set(typesRes.items || []);
    this.balances.set(balRes.items || []);
    if ((typesRes.items || []).length) this.typeId = (typesRes.items || [])[0].id;
    await this.recompute();
  }

  selectedType(): LeaveType | null {
    return this.types().find(t => t.id === this.typeId) || null;
  }

  selectedBalance(): BalanceRow | null {
    return this.balances().find(b => b.type?.id === this.typeId) || null;
  }

  
  remainingAfter(): number | null {
    const t = this.selectedType();
    const b = this.selectedBalance();
    if (!t || !b) return null;
    if (t.code === 'UNPAID') return null;
    if (b.remainingDays === null) return null;
    const days = this.workingDays();
    if (!days) return b.remainingDays;
    return b.remainingDays - days;
  }

requiresCertificate(): boolean {
    return !!this.selectedType()?.requiresCertificate;
  }

  private hasSufficientBalance(): boolean {
    const t = this.selectedType();
    const days = this.workingDays();
    if (!t || !days) return false;
    if (t.code === 'UNPAID') return true;
    const b = this.selectedBalance();
    if (!b) return true;
    if (b.remainingDays === null) return true;
    return days <= b.remainingDays;
  }

  async recompute() {
    this.validationMsg.set('');
    this.workingDays.set(null);
    if (!this.startDate || !this.endDate) return;

    // Front-end strict checks (avoid unnecessary API calls)
    if (this.startDate < this.minDate || this.endDate < this.minDate) {
      this.validationMsg.set('Les dates ne doivent pas être dans le passé.');
      return;
    }
    if (this.endDate < this.startDate) {
      this.validationMsg.set('La date de fin doit être après (ou égale à) la date de début.');
      return;
    }

    const y1 = parseInt(this.startDate.slice(0, 4), 10);
    const y2 = parseInt(this.endDate.slice(0, 4), 10);
    if (y1 !== y2) {
      this.validationMsg.set('Période sur deux années: veuillez faire une demande par année.');
      return;
    }
    if (y1 !== this.year) {
      this.year = y1;
      const balRes = await this.api.balance(this.year);
      this.balances.set(balRes.items || []);
    }
    try {
      const res = await this.api.calculate(this.startDate, this.endDate);
      this.workingDays.set(res.workingDays ?? null);

      if (this.selectedType()?.code !== 'UNPAID' && !this.hasSufficientBalance()) {
        this.validationMsg.set('Solde insuffisant pour cette période.');
      }
    } catch {
      this.validationMsg.set('Dates invalides ou impossible de calculer.');
    }
  }

  onFile(ev: any) {
    const f = ev?.target?.files?.[0];
    this.file = f || null;
    this.fileName = f ? f.name : '';
  }

  canCreate(): boolean {
    if (!this.typeId || !this.startDate || !this.endDate || !this.workingDays()) return false;
    if (this.startDate < this.minDate || this.endDate < this.minDate) return false;
    if (this.endDate < this.startDate) return false;
    return true;
  }

  canSubmit(): boolean {
    if (!this.canCreate()) return false;
    if (!this.hasSufficientBalance()) return false;
    if (this.requiresCertificate() && !this.file) return false;
    return true;
  }

  async create() {
    if (!this.canCreate()) return;
    this.creating = true;
    try {
      const res = await this.api.createLeave({ typeId: this.typeId, startDate: this.startDate, endDate: this.endDate, note: this.note });
      const id = res.leave?.id;
      if (id && this.file) {
        await this.api.uploadCertificate(id, this.file);
      }
      this.alert.toast({ title: 'Demande enregistrée (brouillon)', icon: 'success' });
      this.router.navigateByUrl('/leaves/my');
    } catch (e: any) {
      const code = e?.error?.error || 'Erreur';
      const msg = code === 'overlap'
        ? 'Chevauchement : vous avez déjà un congé sur cette période.'
        : code === 'past_dates'
          ? 'Les dates ne doivent pas être dans le passé.'
          : code;
      this.alert.toast({ title: 'Échec', text: msg, icon: 'error' });
    } finally {
      this.creating = false;
    }
  }

  async createAndSubmit() {
    if (!this.canSubmit()) {
      this.validationMsg.set('Vérifie le solde et/ou le certificat.');
      return;
    }
    this.creating = true;
    try {
      const res = await this.api.createLeave({ typeId: this.typeId, startDate: this.startDate, endDate: this.endDate, note: this.note });
      const id = res.leave?.id;
      if (id && this.file) {
        await this.api.uploadCertificate(id, this.file);
      }
      if (id) await this.api.submitLeave(id);
      this.alert.toast({ title: 'Demande soumise', icon: 'success' });
      this.router.navigateByUrl('/leaves');
    } catch (e: any) {
      const code = e?.error?.error || 'Erreur';
      const msg = code === 'overlap'
        ? 'Chevauchement : vous avez déjà un congé sur cette période.'
        : code === 'past_dates'
          ? 'Les dates ne doivent pas être dans le passé.'
          : code;
      this.alert.toast({ title: 'Échec', text: msg, icon: 'error' });
    } finally {
      this.creating = false;
    }
  }
}
