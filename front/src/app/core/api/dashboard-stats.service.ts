import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type DashboardStats = {
  kpis: {
    pendingLeavesManager: number;
    pendingLeavesHr: number;
    pendingExits: number;
    pendingAdvances: number;
    dailyReportsToday: number;
    employeesTotal: number | null;
    departmentsTotal: number | null;
  };
  series: Array<{ month: string; leaves: number; exits: number; advances: number }>;
  leaveTypes: Array<{ type: string | null; total: number }> | null;
};

@Injectable({ providedIn: 'root' })
export class DashboardStatsService {
  constructor(private http: HttpClient) {}

  get() {
    return this.http.get<DashboardStats>(`${environment.apiBaseUrl}/api/stats/dashboard`);
  }
}
