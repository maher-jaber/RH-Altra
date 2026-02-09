const KEY = 'altra_hrms_api_key';

export const storage = {
  getApiKey(): string | null {
    return localStorage.getItem(KEY);
  },
  setApiKey(key: string): void {
    localStorage.setItem(KEY, key);
  },
  clear(): void {
    localStorage.removeItem(KEY);
  }
};
