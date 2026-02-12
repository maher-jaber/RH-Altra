import { Injectable, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from './notification.service';
import { NotificationItem } from '../models';

@Injectable({ providedIn: 'root' })
export class NotificationStoreService {
  items = signal<NotificationItem[]>([]);
  unreadCount = computed(() => this.items().filter(n => !n.isRead).length);

  private stopSse: (() => void) | null = null;
  private started = false;

  constructor(private api: NotificationService) {}

  start(onMessage?: (n: NotificationItem)=>void): void {
    if (this.started) return;
    this.started = true;

    this.refresh();

    this.stopSse = this.api.subscribeMercure((n: NotificationItem) => {
      if (onMessage) onMessage(n);
      const cur = this.items();
      // Avoid duplicates if the SSE reconnects and replays (best-effort)
      if (cur.some(x => x.id === n.id)) return;
      this.items.set([n, ...cur]);
    });
  }

  stop(): void {
    this.stopSse?.();
    this.stopSse = null;
    this.started = false;
  }

  refresh(): void {
    this.api.list().subscribe(list => this.items.set(list));
  }

  async markRead(id: string): Promise<void> {
    await firstValueFrom(this.api.markAsRead(id));
    const cur = this.items();
    this.items.set(cur.map(n => n.id === id ? { ...n, isRead: true } : n));
  }
}
