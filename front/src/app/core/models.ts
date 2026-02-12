export type Role = 'ROLE_ADMIN' | 'ROLE_SUPERIOR' | 'ROLE_EMPLOYEE';

export interface MeResponse {
  id: string;
  fullName: string;
  email?: string; 
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
  apiKey: string;
  department?: Department | null;
  manager?: UserMini | null;
  manager2?: UserMini | null;
  createdAt: string;
}


export interface Department { id: string; name: string; }
export interface UserMini { id: string; fullName: string; email: string; }


export interface AdvanceRequest {
  id: number;
  amount: number;
  currency: string;
  reason?: string | null;
  status: string;
  createdAt: string;
  user: UserMini;
  manager?: UserMini | null;
}

export interface ExitPermission {
  id: number;
  startAt: string;
  endAt: string;
  reason?: string | null;
  status: string;
  createdAt: string;
  user: UserMini;
  manager?: UserMini | null;
}

export interface DailyReport {
  id: number;
  day: string; // YYYY-MM-DD
  content: string;
  createdAt: string;
  updatedAt: string;
  user: UserMini;
}
