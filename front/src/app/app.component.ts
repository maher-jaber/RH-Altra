import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`
})
export class AppComponent implements OnInit {
  constructor(private auth: AuthService) {}

  async ngOnInit() {
    // Try to load /me if api key exists
    try { await this.auth.refreshMe(); } catch { /* ignore */ }
  }
}
