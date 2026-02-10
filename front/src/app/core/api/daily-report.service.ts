import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { DailyReport } from '../models';

@Injectable({ providedIn: 'root' })
export class DailyReportService {
  constructor(private http: HttpClient) {}

  my() {
    return this.http.get<DailyReport[]>(`${environment.apiBaseUrl}/api/daily-reports/my`);
  }

  upsert(payload: { day: string; content: string }) {
    return this.http.post<DailyReport>(`${environment.apiBaseUrl}/api/daily-reports`, payload);
  }

  team() {
    return this.http.get<DailyReport[]>(`${environment.apiBaseUrl}/api/daily-reports/team`);
  }
}
