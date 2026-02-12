import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AdvanceRequest } from '../models';

@Injectable({ providedIn: 'root' })
export class AdvanceService {
  constructor(private http: HttpClient) {}

  my(page?:number, limit?:number){ const q = page ? `?page=${page}&limit=${limit||10}`:''; return this.http.get<any>(`${environment.apiBaseUrl}/api/advances/my${q}`); }

  create(payload: { amount: number; currency?: string; reason?: string | null; status?: 'DRAFT' | 'SUBMITTED'; periodYear?: number; periodMonth?: number }) {
    return this.http.post<AdvanceRequest>(`${environment.apiBaseUrl}/api/advances`, payload);
  }

  pending(page?:number, limit?:number){ const q = page ? `?page=${page}&limit=${limit||10}`:''; return this.http.get<any>(`${environment.apiBaseUrl}/api/advances/pending${q}`); }

  getOne(id: number) {
    return this.http.get<AdvanceRequest>(`${environment.apiBaseUrl}/api/advances/${id}`);
  }

  decide(id: number, decision: 'APPROVE' | 'REJECT') {
    return this.http.post<AdvanceRequest>(`${environment.apiBaseUrl}/api/advances/${id}/decision`, { decision });
  }
}
