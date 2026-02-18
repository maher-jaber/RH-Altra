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

  /**
   * Role check with backward-compatible aliases.
   * - Managers may be stored as ROLE_SUPERIOR (legacy) or ROLE_MANAGER (newer UI).
   */
  hasRole(role: string): boolean {
    const roles = (this._me()?.roles ?? []) as any[];
    if (roles.includes(role as any)) return true;
    if (role === 'ROLE_MANAGER') return roles.includes('ROLE_SUPERIOR');
    if (role === 'ROLE_SUPERIOR') return roles.includes('ROLE_MANAGER');
    return false;
  }

  /**
   * Manager access is granted either by role (ROLE_SUPERIOR / admin) OR by relationship
   * (the user manages at least one employee).
   */
  isManager(): boolean {
    const me = this._me();
    if (!me) return false;
    return (me.roles ?? []).includes('ROLE_ADMIN' as any)
      || (me.roles ?? []).includes('ROLE_SUPERIOR' as any)
      || (me.roles ?? []).includes('ROLE_MANAGER' as any)
      || !!me.isManager
      || ((me.managedCount ?? 0) > 0);
  }
}
