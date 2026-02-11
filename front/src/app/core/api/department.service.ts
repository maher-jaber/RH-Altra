
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

@Injectable({providedIn:'root'})
export class DepartmentService {
  constructor(private http:HttpClient){}
  list(){ return firstValueFrom(this.http.get<any>(`${environment.apiBaseUrl}/api/admin/departments`)); }
  create(name:string){ return firstValueFrom(this.http.post<any>(`${environment.apiBaseUrl}/api/admin/departments`,{name})); }
  update(id: string, name: string){ return firstValueFrom(this.http.put<any>(`${environment.apiBaseUrl}/api/admin/departments/${id}`,{name})); }
  remove(id: string){ return firstValueFrom(this.http.delete<any>(`${environment.apiBaseUrl}/api/admin/departments/${id}`)); }
}
