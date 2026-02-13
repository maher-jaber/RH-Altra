import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { DailyReport } from '../models';
import { firstValueFrom } from 'rxjs';

export type ListResponse<T> = { items: T[]; meta?: { page: number; limit: number; total: number; pages: number } };

@Injectable({ providedIn: 'root' })
export class DailyReportService {
  constructor(private http: HttpClient) {}

  my(page = 1, limit = 10): Promise<ListResponse<DailyReport>> {
    return firstValueFrom(this.http.get<ListResponse<DailyReport>>(`${environment.apiBaseUrl}/api/daily-reports/my?page=${page}&limit=${limit}`));
  }

  team(page = 1, limit = 10): Promise<ListResponse<DailyReport>> {
    return firstValueFrom(this.http.get<ListResponse<DailyReport>>(`${environment.apiBaseUrl}/api/daily-reports/team?page=${page}&limit=${limit}`));
  }



  get(id: number): Promise<DailyReport> {
    return firstValueFrom(this.http.get<DailyReport>(`${environment.apiBaseUrl}/api/daily-reports/${id}`));
  }
  create(payload: { date: string; tasks: string; hours?: number|null; blockers?: string|null; nextDayPlan?: string|null }): Promise<DailyReport> {
    return firstValueFrom(this.http.post<DailyReport>(`${environment.apiBaseUrl}/api/daily-reports`, payload));
  }

  // Legacy helper (kept in case other screens still use it)
  upsert(payload: { day: string; content: string }): Promise<DailyReport> {
    return firstValueFrom(this.http.post<DailyReport>(`${environment.apiBaseUrl}/api/daily-reports`, payload));
  }
}
