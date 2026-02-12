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
    try {
      const me = await firstValueFrom(this.http.get<MeResponse>(`${environment.apiBaseUrl}/api/me`));
      this._me.set(me);
    } catch {
      // If the API is down (500) or token invalid, keep the UI usable and send user to login.
      this._me.set(null);
    }
  }

  async updateMe(payload: { fullName?: string; email?: string; currentPassword?: string; newPassword?: string }): Promise<MeResponse> {
    if (!this.token) throw new Error('Not authenticated');
    const me = await firstValueFrom(this.http.put<MeResponse>(`${environment.apiBaseUrl}/api/me`, payload));
    this._me.set(me);
    return me;
  }


  logout(): void {
    storage.clear();
    this._me.set(null);
  }

  hasRole(role: string): boolean {
    return (this._me()?.roles ?? []).includes(role as any);
  }
}
