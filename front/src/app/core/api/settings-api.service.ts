import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

export interface AppSettings {
  mailNotifications: any;
  annualLeaveDays: number;
  exit: { enforceHours: boolean; workStart: string; workEnd: string; };
}

@Injectable({ providedIn: 'root' })
export class SettingsApiService {
  constructor(private http: HttpClient) {}

  get(): Promise<AppSettings> {
    return firstValueFrom(this.http.get<AppSettings>(`${environment.apiBaseUrl}/api/settings`));
  }

  update(payload: Partial<AppSettings>): Promise<any> {
    return firstValueFrom(this.http.put(`${environment.apiBaseUrl}/api/settings`, payload));
  }
}
