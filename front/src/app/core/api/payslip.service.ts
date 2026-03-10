import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { PayslipImportResult, PayslipItem } from '../models';

@Injectable({ providedIn: 'root' })
export class PayslipService {
  constructor(private http: HttpClient) {}

  async my(): Promise<{ items: PayslipItem[] }> {
    return firstValueFrom(this.http.get<{ items: PayslipItem[] }>(`${environment.apiBaseUrl}/api/payslips/my`));
  }

  async teamUsers(): Promise<{ items: Array<{ id: string; fullName?: string | null; email?: string | null }> }> {
    return firstValueFrom(this.http.get<{ items: Array<{ id: string; fullName?: string | null; email?: string | null }> }>(`${environment.apiBaseUrl}/api/payslips/team-users`));
  }

  async import(month: string, files: File[]): Promise<{ items: PayslipImportResult[] }> {
    const fd = new FormData();
    fd.append('month', month);
    files.forEach(f => fd.append('files[]', f, f.name));
    return firstValueFrom(this.http.post<{ items: PayslipImportResult[] }>(`${environment.apiBaseUrl}/api/payslips/import`, fd));
  }

  async publish(month: string): Promise<{ ok: boolean; published: number; month: string }>{
    return firstValueFrom(this.http.post<{ ok: boolean; published: number; month: string }>(`${environment.apiBaseUrl}/api/payslips/publish`, { month }));
  }

  async assign(payslipId: string, userId: string): Promise<any> {
    return firstValueFrom(this.http.post(`${environment.apiBaseUrl}/api/payslips/${payslipId}/assign`, { userId }));
  }

  async manual(month: string, userId: string, file: File): Promise<any> {
    const fd = new FormData();
    fd.append('month', month);
    fd.append('userId', userId);
    fd.append('file', file, file.name);
    return firstValueFrom(this.http.post(`${environment.apiBaseUrl}/api/payslips/manual`, fd));
  }

  downloadUrl(id: string): string {
    return `${environment.apiBaseUrl}/api/payslips/${id}/download`;
  }

  async downloadBlob(id: string): Promise<Blob> {
    // Http interceptor will attach Authorization header.
    return firstValueFrom(
      this.http.get(`${environment.apiBaseUrl}/api/payslips/${id}/download`, { responseType: 'blob' })
    );
  }
}
