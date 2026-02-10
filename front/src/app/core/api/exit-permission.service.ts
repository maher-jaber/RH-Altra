import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ExitPermission } from '../models';

@Injectable({ providedIn: 'root' })
export class ExitPermissionService {
  constructor(private http: HttpClient) {}

  my() {
    return this.http.get<ExitPermission[]>(`${environment.apiBaseUrl}/api/exit-permissions/my`);
  }

  create(payload: { startAt: string; endAt: string; reason?: string | null; status?: 'DRAFT' | 'SUBMITTED' }) {
    return this.http.post<ExitPermission>(`${environment.apiBaseUrl}/api/exit-permissions`, payload);
  }

  pending() {
    return this.http.get<ExitPermission[]>(`${environment.apiBaseUrl}/api/exit-permissions/pending`);
  }

  decide(id: number, decision: 'APPROVE' | 'REJECT') {
    return this.http.post<ExitPermission>(`${environment.apiBaseUrl}/api/exit-permissions/${id}/decision`, { decision });
  }
}
