import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { NotificationItem } from '../models';
import { storage } from '../storage';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private http: HttpClient, private zone: NgZone) {}

  list(): Observable<NotificationItem[]> {
    return this.http.get<NotificationItem[]>(`${environment.apiBaseUrl}/api/notifications`);
  }

  markAsRead(id: string) {
    return this.http.post(`${environment.apiBaseUrl}/api/notifications/${id}/read`, {});
  }

  /**
   * SSE / Mercure subscription for current user (topic: /users/{apiKey}/notifications)
   */
  subscribeMercure(onMessage: (n: NotificationItem) => void): () => void {
    const apiKey = storage.getToken();
    if (!apiKey) return () => {};

    const topic = `/users/${encodeURIComponent(apiKey)}/notifications`;
    const url = new URL(environment.mercureUrl);
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
