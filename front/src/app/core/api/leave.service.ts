import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { LeaveRequest } from '../models';

@Injectable({ providedIn: 'root' })
export class LeaveService {
  constructor(private http: HttpClient) {}

  create(payload: {
    type: LeaveRequest['type'];
    startDate: string;
    endDate: string;
    halfDay?: 'AM' | 'PM' | null;
    reason?: string | null;
  }) {
    return this.http.post<LeaveRequest>(`${environment.apiBaseUrl}/api/leave-requests`, payload);
  }

  my() {
    return this.http.get<LeaveRequest[]>(`${environment.apiBaseUrl}/api/leave-requests/my`);
  }

  submit(id: string, managerKey: string) {
    return this.http.post(`${environment.apiBaseUrl}/api/leave-requests/${id}/submit`, { managerKey });
  }

  cancel(id: string) {
    return this.http.post(`${environment.apiBaseUrl}/api/leave-requests/${id}/cancel`, {});
  }
}
