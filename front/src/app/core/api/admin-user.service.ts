import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AdminUser, Role } from '../models';
import { firstValueFrom } from 'rxjs';

type PageMeta = { page:number; limit:number; total:number; pages:number };
type ListResponse = { items: AdminUser[]; meta?: PageMeta };
type UserResponse = { user: AdminUser };

@Injectable({ providedIn: 'root' })
export class AdminUserService {
  constructor(private http: HttpClient) {}

  list(page?: number, limit?: number, q?: string): Promise<ListResponse> {
    const params: any = {};
    if (page) params.page = page;
    if (limit) params.limit = limit;
    if (q) params.q = q;
  
    return firstValueFrom(
      this.http.get<ListResponse>(`${environment.apiBaseUrl}/api/admin/users`, { params })
    );
  }

  create(payload: { email: string; password: string; fullName?: string; roles: Role[]; netSalary?: number | null }): Promise<UserResponse> {
    return firstValueFrom(this.http.post<UserResponse>(`${environment.apiBaseUrl}/api/admin/users`, payload));
  }

  update(id: string, payload: Partial<{ email: string; password: string; fullName: string; roles: Role[]; rotateApiKey: boolean; netSalary: number | null }>): Promise<UserResponse> {
    return firstValueFrom(this.http.put<UserResponse>(`${environment.apiBaseUrl}/api/admin/users/${id}`, payload));
  }

  delete(id: string): Promise<{ ok: boolean }> {
    return firstValueFrom(this.http.delete<{ ok: boolean }>(`${environment.apiBaseUrl}/api/admin/users/${id}`));
  }
}
