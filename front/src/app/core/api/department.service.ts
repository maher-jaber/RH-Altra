import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

type PageMeta = { page:number; limit:number; total:number; pages:number };
type ListResponse = { items: any[]; meta?: PageMeta };

@Injectable({providedIn:'root'})
export class DepartmentService {
  constructor(private http:HttpClient){}

  list(page?: number, limit?: number, q?: string): Promise<ListResponse> {
    const params: any = {};
    if (page) params.page = page;
    if (limit) params.limit = limit;
    if (q) params.q = q;

    return firstValueFrom(
      this.http.get<ListResponse>(`${environment.apiBaseUrl}/api/admin/departments`, { params })
    );
  }

  create(name:string){ return firstValueFrom(this.http.post<any>(`${environment.apiBaseUrl}/api/admin/departments`,{name})); }
  update(id: string, name: string){ return firstValueFrom(this.http.put<any>(`${environment.apiBaseUrl}/api/admin/departments/${id}`,{name})); }
  remove(id: string){ return firstValueFrom(this.http.delete<any>(`${environment.apiBaseUrl}/api/admin/departments/${id}`)); }
}
