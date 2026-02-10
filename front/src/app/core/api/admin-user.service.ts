import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AdminUser, Role } from '../models';
import { firstValueFrom } from 'rxjs';

type ListResponse = { items: AdminUser[] };
type UserResponse = { user: AdminUser };

@Injectable({ providedIn: 'root' })
export class AdminUserService {
  constructor(private http: HttpClient) {}

  list(): Promise<ListResponse> {
    return firstValueFrom(this.http.get<ListResponse>(`${environment.apiBaseUrl}/api/admin/users`));
  }

  create(payload: { email: string; password: string; fullName?: string; roles: Role[] }): Promise<UserResponse> {
    return firstValueFrom(this.http.post<UserResponse>(`${environment.apiBaseUrl}/api/admin/users`, payload));
  }

  update(id: string, payload: Partial<{ email: string; password: string; fullName: string; roles: Role[]; rotateApiKey: boolean }>): Promise<UserResponse> {
    return firstValueFrom(this.http.put<UserResponse>(`${environment.apiBaseUrl}/api/admin/users/${id}`, payload));
  }

  delete(id: string): Promise<{ ok: boolean }> {
    return firstValueFrom(this.http.delete<{ ok: boolean }>(`${environment.apiBaseUrl}/api/admin/users/${id}`));
  }
}
