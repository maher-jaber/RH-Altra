import { Injectable, signal, computed } from '@angular/core';

/**
 * Global loading indicator (HTTP + long async tasks).
 * Counter-based to handle concurrent requests.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private pending = signal<number>(0);

  /** True if at least one async task is running. */
  readonly isLoading = computed(() => this.pending() > 0);

  begin(): void {
    this.pending.set(this.pending() + 1);
  }

  end(): void {
    this.pending.set(Math.max(0, this.pending() - 1));
  }

  reset(): void {
    this.pending.set(0);
  }
}
