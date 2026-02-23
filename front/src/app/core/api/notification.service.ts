import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { NotificationItem } from '../models';
import { storage } from '../storage';
import { Observable, map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private http: HttpClient, private zone: NgZone) {}

  listPaged(page = 1, limit = 10): Observable<{ items: NotificationItem[]; meta?: any }> {
    return this.http.get<{ items: NotificationItem[]; meta?: any }>(
      `${environment.apiBaseUrl}/api/notifications?page=${page}&limit=${limit}`
    );
  }

  list(): Observable<NotificationItem[]> {
    // API returns { items: NotificationItem[] }
    return this.http
      .get<{ items: NotificationItem[] }>(`${environment.apiBaseUrl}/api/notifications`)
      .pipe(map((res) => res?.items ?? []));
  }

  markAsRead(id: string) {
    return this.http.post(`${environment.apiBaseUrl}/api/notifications/${id}/read`, {});
  }

  markAllAsRead() {
    return this.http.post(`${environment.apiBaseUrl}/api/notifications/read-all`, {});
  }

  /**
   * SSE / Mercure subscription for current user (topic: /users/{apiKey}/notifications)
   */
  subscribeMercure(onMessage: (n: NotificationItem) => void): () => void {
    const apiKey = storage.getToken();
    if (!apiKey) return () => {};

    const topic = `/users/${encodeURIComponent(apiKey)}/notifications`;
    const raw = (environment.mercureUrl || '').trim();
    // Mercure is optional. If it's not configured, just disable live updates.
    if (!raw) {
      // eslint-disable-next-line no-console
      console.warn('Mercure disabled: no mercureUrl configured');
      return () => {};
    }

    // Support relative URLs like '/.well-known/mercure'
    const url = new URL(raw, window.location.origin);
    url.searchParams.set('topic', topic);

    const es = new EventSource(url.toString(), { withCredentials: false });

    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as NotificationItem;
        // Make sure Angular change detection runs
        this.zone.run(() => onMessage(data));
      } catch (e) {
        // ignore
      }
    };

    es.onerror = () => {
      // auto-reconnect is handled by browser; keep it simple for MVP
    };

    return () => es.close();
  }
}
