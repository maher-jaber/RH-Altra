import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

import { LoginPageComponent } from './features/auth/login.page';
import { ForgotPasswordPageComponent } from './features/auth/forgot-password.page';
import { ResetPasswordPageComponent } from './features/auth/reset-password.page';

import { ShellComponent } from './features/dashboard/shell.component';
import { DashboardPageComponent } from './features/dashboard/dashboard.page';

// Congés (ancienne démo)
import { LeaveNewPageComponent } from './features/leave/leave-new.page';
import { LeaveMyPageComponent } from './features/leave/leave-my.page';

// Congés (nouveau module)
import { LeaveDashboardPage } from './features/leaves/leave-dashboard.page';
import { LeaveTeamCalendarPage } from './features/leaves/leave-team-calendar.page';
import { LeaveCalendarPage } from './features/leaves/leave-calendar.page';
import { LeavePendingHrPage } from './features/leaves/leave-pending-hr.page';
import { LeavePendingManagerPage } from './features/leaves/leave-pending-manager.page';
import { LeaveCreatePage } from './features/leaves/leave-create.page';

import { NotificationsPage } from './features/notifications/notifications.page';

import { AdminUsersPageComponent } from './features/admin/admin-users.page';
import { AdminDepartmentsPage } from './features/admin/admin-departments.page';

import { AdvancesPageComponent } from './features/advances/advances.page';
import { ExitPermissionsPageComponent } from './features/exit-permissions/exit-permissions.page';
import { DailyReportsPageComponent } from './features/daily-reports/daily-reports.page';

export const APP_ROUTES: Routes = [
  { path: 'login', component: LoginPageComponent, title: 'Connexion' },
  { path: 'forgot-password', component: ForgotPasswordPageComponent, title: 'Mot de passe oublié' },
  { path: 'reset-password', component: ResetPasswordPageComponent, title: 'Réinitialisation' },

  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },

      { path: 'dashboard', component: DashboardPageComponent, title: 'Tableau de bord' },

      // Congés (module principal)
      { path: 'leaves', component: LeaveDashboardPage, title: 'Congés' },
      { path: 'leaves/create', component: LeaveCreatePage, title: 'Nouvelle demande de congé' },
      { path: 'leaves/my', component: LeaveMyPageComponent, title: 'Mes demandes de congé' },
      { path: 'leaves/pending-manager', component: LeavePendingManagerPage, title: 'Validation congés · Manager' },
      { path: 'leaves/pending-hr', component: LeavePendingHrPage, canActivate: [adminGuard], title: 'Validation congés · RH' },
      { path: 'leaves/calendar', component: LeaveCalendarPage, title: 'Calendrier congés' },
      { path: 'leaves/team-calendar', component: LeaveTeamCalendarPage, title: 'Calendrier équipe' },


      // Congés (ancienne démo conservée)
      { path: 'leave/new', component: LeaveNewPageComponent, title: 'Nouvelle demande de congé' },
      { path: 'leave/my', component: LeaveMyPageComponent, title: 'Mes demandes de congé' },

      { path: 'advances', component: AdvancesPageComponent, title: 'Avances / Acompte' },
      { path: 'exit-permissions', component: ExitPermissionsPageComponent, title: 'Autorisations de sortie' },
      { path: 'daily-reports', component: DailyReportsPageComponent, title: 'Compte-rendu journalier' },

      { path: 'notifications', component: NotificationsPage, title: 'Notifications' },

      { path: 'admin/users', component: AdminUsersPageComponent, canActivate: [adminGuard], title: 'Administration · Utilisateurs' },
      { path: 'admin/departments', component: AdminDepartmentsPage, canActivate: [adminGuard], title: 'Administration · Départements' },
    ],
  },

  { path: '**', redirectTo: '' },
];
