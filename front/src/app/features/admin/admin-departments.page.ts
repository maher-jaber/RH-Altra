
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { DepartmentService } from '../../core/api/department.service';

@Component({
 standalone:true,
 selector:'app-admin-departments',
 imports:[CommonModule,FormsModule,MatCardModule,MatInputModule,MatButtonModule],
 template:`
 <mat-card>
  <h2>Départements</h2>
  <input matInput placeholder="Nouveau département" [(ngModel)]="name">
  <button mat-flat-button color="primary" (click)="add()">Ajouter</button>
  <ul><li *ngFor="let d of items()">{{d.name}}</li></ul>
 </mat-card>`
})
export class AdminDepartmentsPage implements OnInit {
 items=signal<any[]>([]); name='';
 constructor(private api:DepartmentService){}
 async ngOnInit(){ this.items.set((await this.api.list()).items); }
 async add(){ if(!this.name)return; await this.api.create(this.name); this.ngOnInit(); this.name=''; }
}
