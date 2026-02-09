export type Role = 'ROLE_ADMIN' | 'ROLE_SUPERVISOR' | 'ROLE_EMPLOYEE';

export interface MeResponse {
  id: string;
  fullName: string;
  roles: Role[];
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
  message: string;
  createdAt: string;
  readAt?: string | null;
}
