const KEY = 'altra_hrms_token';

export const storage = {
  getToken(): string | null {
    return localStorage.getItem(KEY);
  },
  setToken(token: string): void {
    localStorage.setItem(KEY, token);
  },
  clear(): void {
    localStorage.removeItem(KEY);
  }
};
