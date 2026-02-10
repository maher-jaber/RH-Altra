import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { storage } from './storage';
import { MeResponse } from './models';
import { firstValueFrom } from 'rxjs';

type LoginResponse = { token: string; me: MeResponse };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _me = signal<MeResponse | null>(null);
  me = computed(() => this._me());

  constructor(private http: HttpClient) {}

  get token(): string | null {
    return storage.getToken();
  }

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>(`${environment.apiBaseUrl}/api/auth/login`, { email, password })
    );
    storage.setToken(res.token);
    this._me.set(res.me);
  }

  async refreshMe(): Promise<void> {
    if (!this.token) { this._me.set(null); return; }
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
