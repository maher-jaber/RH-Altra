import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type HrEmployee = {
  id: number;
  fullName?: string | null;
  email?: string | null;
  roles?: string[];
  department?: { id: number; name: string } | null;
  manager?: { id: number; fullName?: string | null; email?: string | null } | null;
};

export type HrCalendarEvent = {
  id: string;
  entityId: number;
  kind: 'LEAVE' | 'EXIT' | 'ADVANCE' | 'REPORT';
  title: string;
  start: string; // ISO date/time
  end: string;   // ISO date/time
  status?: string;
  user?: { id: number; fullName?: string | null; email?: string | null; department?: { id: number; name: string } | null };
  meta?: any;
};

@Injectable({ providedIn: 'root' })
export class HrPeopleHubService {
  constructor(private http: HttpClient) {}

  employees(search?: string) {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.http.get<{ items: HrEmployee[] }>(`${environment.apiBaseUrl}/api/hr/employees${q}`);
  }

  calendar(start: string, end: string, userId?: number) {
    const params = new URLSearchParams({ start, end });
    if (userId) params.set('userId', String(userId));
    return this.http.get<{ items: HrCalendarEvent[] }>(`${environment.apiBaseUrl}/api/hr/calendar?${params.toString()}`);
  }

  leaves(params: { from?: string; to?: string; status?: string; search?: string; userId?: number; page?: number; limit?: number }) {
    const qp = new URLSearchParams();
    if (params.from) qp.set('from', params.from);
    if (params.to) qp.set('to', params.to);
    if (params.status) qp.set('status', params.status);
    if (params.search) qp.set('search', params.search);
    if (params.userId) qp.set('userId', String(params.userId));
    if (params.page) qp.set('page', String(params.page));
    if (params.limit) qp.set('limit', String(params.limit));
    return this.http.get<any>(`${environment.apiBaseUrl}/api/hr/leaves?${qp.toString()}`);
  }

  advances(params: { from?: string; to?: string; status?: string; search?: string; userId?: number; page?: number; limit?: number }) {
    const qp = new URLSearchParams();
    if (params.from) qp.set('from', params.from);
    if (params.to) qp.set('to', params.to);
    if (params.status) qp.set('status', params.status);
    if (params.search) qp.set('search', params.search);
    if (params.userId) qp.set('userId', String(params.userId));
    if (params.page) qp.set('page', String(params.page));
    if (params.limit) qp.set('limit', String(params.limit));
    return this.http.get<any>(`${environment.apiBaseUrl}/api/hr/advances?${qp.toString()}`);
  }

  exits(params: { from?: string; to?: string; status?: string; search?: string; userId?: number; page?: number; limit?: number }) {
    const qp = new URLSearchParams();
    if (params.from) qp.set('from', params.from);
    if (params.to) qp.set('to', params.to);
    if (params.status) qp.set('status', params.status);
    if (params.search) qp.set('search', params.search);
    if (params.userId) qp.set('userId', String(params.userId));
    if (params.page) qp.set('page', String(params.page));
    if (params.limit) qp.set('limit', String(params.limit));
    return this.http.get<any>(`${environment.apiBaseUrl}/api/hr/exits?${qp.toString()}`);
  }

  reports(params: { from?: string; to?: string; search?: string; userId?: number; page?: number; limit?: number }) {
    const qp = new URLSearchParams();
    if (params.from) qp.set('from', params.from);
    if (params.to) qp.set('to', params.to);
    if (params.search) qp.set('search', params.search);
    if (params.userId) qp.set('userId', String(params.userId));
    if (params.page) qp.set('page', String(params.page));
    if (params.limit) qp.set('limit', String(params.limit));
    return this.http.get<any>(`${environment.apiBaseUrl}/api/hr/reports?${qp.toString()}`);
  }
}
