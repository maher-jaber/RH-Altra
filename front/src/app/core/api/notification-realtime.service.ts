import { Injectable, effect } from '@angular/core';
import { AuthService } from '../auth.service';
import { AlertService } from '../ui/alert.service';
import { NotificationStoreService } from './notification-store.service';
import { NotificationItem } from '../models';

/**
 * Global realtime notifications (Mercure / SSE) started as soon as the user is authenticated.
 * - Works on any page (no navigation required).
 * - Shows a toast for every new notification.
 * - Keeps NotificationStoreService in sync (badge count, notifications page, etc.).
 */
@Injectable({ providedIn: 'root' })
export class NotificationRealtimeService {
  private started = false;

  constructor(
    private auth: AuthService,
    private store: NotificationStoreService,
    private alert: AlertService,
  ) {
    // React to login/logout (signals)
    effect(() => {
      const me = this.auth.me();
      const token = this.auth.token;

      if (me && token) {
        this.start();
      } else {
        this.stop();
      }
    }, { allowSignalWrites: true });
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    this.store.start((n: NotificationItem) => {
      // Toast like "Facebook" (non-blocking)
      this.alert.toast({
        icon: 'info',
        title: n.title || 'Nouvelle notification',
        text: n.body || '',
        ms: 3200,
      });
    });
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.store.stop();
  }
}
