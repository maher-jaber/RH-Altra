import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Subject, firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LeaveWorkflowService {
  /** Emits whenever a leave is created/submitted/updated so tabbed pages can refresh without navigation. */
  readonly changed$ = new Subject<void>();

  constructor(private http: HttpClient) {}

  // Lists
  my(page?:number, limit?:number){ const q = page ? `?page=${page}&limit=${limit||10}`:''; return firstValueFrom(this.http.get<any>(`${environment.apiBaseUrl}/api/leaves/my${q}`)); }
  pendingManager(page?:number, limit?:number){ const q = page ? `?page=${page}&limit=${limit||10}`:''; return firstValueFrom(this.http.get<any>(`${environment.apiBaseUrl}/api/leaves/pending/manager${q}`)); }
  // Backward-compat (old HR screens): behave like manager pending/approve.
  pendingHr(page?:number, limit?:number){ return this.pendingManager(page, limit); }

  // Types / balance / calculation
  listTypes() { return firstValueFrom(this.http.get<any>(`${environment.apiBaseUrl}/api/leave-types`)); }
  balance(year?: number) {
    const y = year ? `?year=${year}` : '';
    return firstValueFrom(this.http.get<any>(`${environment.apiBaseUrl}/api/leaves/balance${y}`));
  }
  calculate(startDate: string, endDate: string) {
    return firstValueFrom(this.http.post<any>(`${environment.apiBaseUrl}/api/leaves/calculate`, { startDate, endDate }));
  }

  // Create / submit / decisions
  createLeave(payload: { typeId: string; startDate: string; endDate: string; note?: string }) {
    return firstValueFrom(this.http.post<any>(`${environment.apiBaseUrl}/api/leaves`, payload)).then(r => {
      this.changed$.next();
      return r;
    });
  }
  submitLeave(id: string) {
    return firstValueFrom(this.http.post<any>(`${environment.apiBaseUrl}/api/leaves/${id}/submit`, {})).then(r => {
      this.changed$.next();
      return r;
    });
  }
  managerApprove(id: string, comment?: string) {
    return firstValueFrom(this.http.post<any>(`${environment.apiBaseUrl}/api/leaves/${id}/manager-approve`, { comment })).then(r => {
      this.changed$.next();
      return r;
    });
  }
    // Backward-compat (old HR screens): behave like manager approve.
  hrApprove(id: string, comment?: string) { return this.managerApprove(id, comment); }
  reject(id: string, comment?: string) {
    return firstValueFrom(this.http.post<any>(`${environment.apiBaseUrl}/api/leaves/${id}/reject`, { comment })).then(r => {
      this.changed$.next();
      return r;
    });
  }

  // Certificates / attachments / audit
  uploadCertificate(id: string, file: File) {
    const fd = new FormData();
    fd.append('file', file);
    return firstValueFrom(this.http.post<any>(`${environment.apiBaseUrl}/api/leaves/${id}/certificate`, fd));
  }
  uploadAttachments(id: string, files: File[]) {
    const fd = new FormData();
    files.forEach(f => fd.append('files[]', f));
    return firstValueFrom(this.http.post<any>(`${environment.apiBaseUrl}/api/leaves/${id}/attachments`, fd));
  }
  audit(id: string) { return firstValueFrom(this.http.get<any>(`${environment.apiBaseUrl}/api/leaves/${id}/audit`)); }

  // Stats + team calendar
  statsLeaves() { return firstValueFrom(this.http.get<any>(`${environment.apiBaseUrl}/api/stats/leaves`)); }
  teamCalendar() { return firstValueFrom(this.http.get<any>(`${environment.apiBaseUrl}/api/leaves/team-calendar`)); }

  // Certificate download
  downloadCertificate(id: string) {
    return this.http.get(`${environment.apiBaseUrl}/api/leaves/${id}/certificate/download`, { responseType: 'blob' as const });
  }

  // PDF
  downloadPdf(id: string) {
    return this.http.get(`${environment.apiBaseUrl}/api/leaves/${id}/pdf`, { responseType: 'blob' as const });
  }

  // Detail
  getLeave(id: string) { return firstValueFrom(this.http.get<any>(`${environment.apiBaseUrl}/api/leaves/${id}`)); }

  // ICS urls (consumed by external calendar apps)
  icsMyUrl() { return `${environment.apiBaseUrl}/api/leaves/ics/my`; }
  icsDeptUrl() { return `${environment.apiBaseUrl}/api/leaves/ics/department`; }


  listNotifications(page?:number, limit?:number){ const q = page ? `?page=${page}&limit=${limit||10}`:''; return firstValueFrom(this.http.get<any>(`${environment.apiBaseUrl}/api/notifications${q}`)); }
  markNotificationRead(id:string){ return firstValueFrom(this.http.post<any>(`${environment.apiBaseUrl}/api/notifications/${id}/read`, {})); }
}
