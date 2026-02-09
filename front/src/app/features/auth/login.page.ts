import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatSnackBarModule
  ],
  styles: [`
    .wrap { height: 100vh; display:flex; align-items:center; justify-content:center; padding: 16px; }
    mat-card { width: min(520px, 100%); }
  `],
  template: `
  <div class="wrap">
    <mat-card>
      <mat-card-header>
        <mat-card-title>Connexion</mat-card-title>
        <mat-card-subtitle>Entrez votre clé d'accès (MVP)</mat-card-subtitle>
      </mat-card-header>

      <mat-card-content>
        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <mat-form-field appearance="outline" style="width:100%;">
            <mat-label>API Key</mat-label>
            <input matInput formControlName="apiKey" placeholder="ex: admin">
          </mat-form-field>

          <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || loading">
            {{loading ? 'Connexion...' : 'Se connecter'}}
          </button>
        </form>
      </mat-card-content>
    </mat-card>
  </div>
  `
})
export class LoginPageComponent {
  loading = false;

  form = new FormGroup({
    apiKey: new FormControl('', [Validators.required, Validators.minLength(2)])
  });

  constructor(
    private auth: AuthService,
    private router: Router,
    private snack: MatSnackBar
  ) {}

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading = true;

    try {
      await this.auth.loginWithApiKey(this.form.value.apiKey!);
      this.router.navigateByUrl('/dashboard');
    } catch (e) {
      this.snack.open("Clé invalide ou API indisponible", "OK", { duration: 3500 });
    } finally {
      this.loading = false;
    }
  }
}
