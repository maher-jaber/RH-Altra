import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { NotificationRealtimeService } from './core/api/notification-realtime.service';
import { LoadingOverlayComponent } from './core/ui/loading-overlay.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LoadingOverlayComponent],
  template: `
    <router-outlet />
    <app-loading-overlay />
  `
})
export class AppComponent implements OnInit {
  constructor(private auth: AuthService, private notifRealtime: NotificationRealtimeService) {}

  async ngOnInit() {
    // Try to load /me if api key exists
    try { await this.auth.refreshMe(); } catch { /* ignore */ }
  }
}
