import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { LoginPageComponent } from './features/auth/login.page';
import { ShellComponent } from './features/dashboard/shell.component';
import { DashboardPageComponent } from './features/dashboard/dashboard.page';
import { LeaveNewPageComponent } from './features/leave/leave-new.page';
import { LeaveMyPageComponent } from './features/leave/leave-my.page';
import { NotificationsPageComponent } from './features/notifications/notifications.page';

export const APP_ROUTES: Routes = [
  { path: 'login', component: LoginPageComponent },

  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardPageComponent },
      { path: 'leave/new', component: LeaveNewPageComponent },
      { path: 'leave/my', component: LeaveMyPageComponent },
      { path: 'notifications', component: NotificationsPageComponent }
    ],
  },

  { path: '**', redirectTo: '' }
];
