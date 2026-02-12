import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AdvanceRequest } from '../models';

@Injectable({ providedIn: 'root' })
export class AdvanceService {
  constructor(private http: HttpClient) {}

  my() {
    return this.http.get<AdvanceRequest[]>(`${environment.apiBaseUrl}/api/advances/my`);
  }

  create(payload: { amount: number; currency?: string; reason?: string | null; status?: 'DRAFT' | 'SUBMITTED' }) {
    return this.http.post<AdvanceRequest>(`${environment.apiBaseUrl}/api/advances`, payload);
  }

  pending() {
    return this.http.get<AdvanceRequest[]>(`${environment.apiBaseUrl}/api/advances/pending`);
  }

  getOne(id: number) {
    return this.http.get<AdvanceRequest>(`${environment.apiBaseUrl}/api/advances/${id}`);
  }

  decide(id: number, decision: 'APPROVE' | 'REJECT') {
    return this.http.post<AdvanceRequest>(`${environment.apiBaseUrl}/api/advances/${id}/decision`, { decision });
  }
}
