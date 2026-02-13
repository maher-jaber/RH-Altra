import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

export interface HolidayItem {
  id: number;
  date: string; // YYYY-MM-DD
  label: string;
}

@Injectable({ providedIn: 'root' })
export class HolidayService {
  constructor(private http: HttpClient) {}

  list(year: number): Promise<{year: number; items: HolidayItem[]}> {
    return firstValueFrom(this.http.get<{year:number; items: HolidayItem[]}>(`${environment.apiBaseUrl}/api/holidays?year=${year}`));
  }

  create(payload: {date: string; label: string}): Promise<HolidayItem> {
    return firstValueFrom(this.http.post<HolidayItem>(`${environment.apiBaseUrl}/api/holidays`, payload));
  }

  update(id: number, payload: Partial<{date: string; label: string}>): Promise<HolidayItem> {
    return firstValueFrom(this.http.put<HolidayItem>(`${environment.apiBaseUrl}/api/holidays/${id}`, payload));
  }

  delete(id: number): Promise<any> {
    return firstValueFrom(this.http.delete(`${environment.apiBaseUrl}/api/holidays/${id}`));
  }

  seed(year: number): Promise<{year:number; created:number}> {
    return firstValueFrom(this.http.post<{year:number; created:number}>(`${environment.apiBaseUrl}/api/holidays/seed`, { year }));
  }
}
