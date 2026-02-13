import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ExitPermission } from '../models';

@Injectable({ providedIn: 'root' })
export class ExitPermissionService {
  constructor(private http: HttpClient) {}

  my(page?: number, limit?: number) {
    const q = page ? `?page=${page}&limit=${limit || 10}` : '';
    return this.http.get<any>(`${environment.apiBaseUrl}/api/exit-permissions/my${q}`);
  }

  pending(page?: number, limit?: number) {
    const q = page ? `?page=${page}&limit=${limit || 10}` : '';
    return this.http.get<any>(`${environment.apiBaseUrl}/api/exit-permissions/pending${q}`);
  }

  create(payload: { startAt: string; endAt: string; reason?: string | null; status?: 'DRAFT' | 'SUBMITTED' }) {
    return this.http.post<ExitPermission>(`${environment.apiBaseUrl}/api/exit-permissions`, payload);
  }

  decide(id: number, decision: 'APPROVE' | 'REJECT', comment?: string | null) {
    return this.http.post<ExitPermission>(`${environment.apiBaseUrl}/api/exit-permissions/${id}/decision`, { decision, comment });
  }

  getOne(id: number) {
    return this.http.get<ExitPermission>(`${environment.apiBaseUrl}/api/exit-permissions/${id}`);
  }
}

