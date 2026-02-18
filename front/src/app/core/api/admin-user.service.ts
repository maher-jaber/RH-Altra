import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AdminUser, Role } from '../models';
import { firstValueFrom } from 'rxjs';

type PageMeta = { page:number; limit:number; total:number; pages:number };
type ListResponse = { items: AdminUser[]; meta?: PageMeta };
type UserResponse = { user: AdminUser };
type UpdateResponse = { user: AdminUser; forceLogout?: boolean };

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

  create(payload: any): Promise<UserResponse> {
    return firstValueFrom(this.http.post<UserResponse>(`${environment.apiBaseUrl}/api/admin/users`, payload));
  }

  update(id: string, payload: any): Promise<UpdateResponse> {
    return firstValueFrom(this.http.put<UpdateResponse>(`${environment.apiBaseUrl}/api/admin/users/${id}`, payload));
  }

  delete(id: string): Promise<{ ok: boolean }> {
    return firstValueFrom(this.http.delete<{ ok: boolean }>(`${environment.apiBaseUrl}/api/admin/users/${id}`));
  }
}
