import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { storage } from './storage';
import { MeResponse } from './models';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _me = signal<MeResponse | null>(null);
  me = computed(() => this._me());

  constructor(private http: HttpClient) {}

  get apiKey(): string | null {
    return storage.getApiKey();
  }

  async loginWithApiKey(apiKey: string): Promise<void> {
    storage.setApiKey(apiKey.trim());
    // Load /me to validate
    const me = await firstValueFrom(this.http.get<MeResponse>(`${environment.apiBaseUrl}/api/me`));
    this._me.set(me);
  }

  async refreshMe(): Promise<void> {
    if (!this.apiKey) { this._me.set(null); return; }
    const me = await firstValueFrom(this.http.get<MeResponse>(`${environment.apiBaseUrl}/api/me`));
    this._me.set(me);
  }

  logout(): void {
    storage.clear();
    this._me.set(null);
  }

  hasRole(role: string): boolean {
    return (this._me()?.roles ?? []).includes(role as any);
  }
}
