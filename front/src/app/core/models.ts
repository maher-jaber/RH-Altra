// RH role removed: workflow is manager 1 / manager 2 only.
// Keep backward compatibility: the backend historically used ROLE_SUPERIOR for managers,
// while some UI parts used ROLE_MANAGER.
export type Role =
  | 'ROLE_ADMIN'
  | 'ROLE_SUPERIOR'
  | 'ROLE_MANAGER'
  | 'ROLE_EMPLOYEE'
  | 'ROLE_HR';

export interface MeResponse {
  id: string;
  fullName: string;
  email?: string; 
  roles: Role[];
  managedCount?: number;
  isManager?: boolean;
}

export interface LeaveRequest {
  id: string;
  type: 'ANNUAL' | 'SICK' | 'UNPAID' | 'EXCEPTIONAL';
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  halfDay?: 'AM' | 'PM' | null;
  reason?: string | null;
  status: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt?: string;
  actionUrl?: string | null;
  payload?: any;
}


export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  roles: Role[];

  // Employee fields
  netSalary?: number | null;
  hireDate?: string | null;
  leaveInitialBalance?: number | null;
  contractType?: string | null;

  // Relations (API may return ids and/or lightweight objects)
  departmentId?: string | null;
  managerId?: string | null;
  manager2Id?: string | null;

  department?: Department | null;
  manager?: UserMini | null;
  manager2?: UserMini | null;

  createdAt?: string;
}


export interface Department { id: string; name: string; }
export interface UserMini { id: string; fullName: string; email: string; }


export interface AdvanceRequest {
  id: number;
  amount: number;
  currency: string;
  reason?: string | null;
  status: string;
  periodYear?: number;
  periodMonth?: number;
  createdAt: string;
  updatedAt?: string;
  user: UserMini;
  manager?: UserMini | null;
  manager2?: UserMini | null;
  managerSignedAt?: string | null;
  manager2SignedAt?: string | null;
}

export interface ExitPermission {
  id: number;
  startAt: string;
  endAt: string;
  reason?: string | null;
  status: string;
  periodYear?: number;
  periodMonth?: number;
  createdAt: string;
  updatedAt?: string;
  user: UserMini;
  manager?: UserMini | null;
  manager2?: UserMini | null;
  managerSignedAt?: string | null;
  manager2SignedAt?: string | null;
}

export interface DailyReport {
  id: number;
  // New UI fields (preferred)
  date?: string; // YYYY-MM-DD
  tasks?: string;
  hours?: number | null;
  blockers?: string | null;
  nextDayPlan?: string | null;

  // Legacy fields kept for compatibility
  day: string; // YYYY-MM-DD
  content: string;
  createdAt: string;
  updatedAt: string;
  user: UserMini;
}
