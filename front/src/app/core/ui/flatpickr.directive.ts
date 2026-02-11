import { AfterViewInit, Directive, ElementRef, Input, NgZone, OnDestroy } from '@angular/core';

declare global {
  interface Window { flatpickr?: any; }
}

/**
 * Lightweight datepicker using Flatpickr loaded via CDN (no npm dependency).
 * Works great with Bootstrap input-groups.
 */
@Directive({
  selector: '[altraFlatpickr]',
  standalone: true,
})
export class FlatpickrDirective implements AfterViewInit, OnDestroy {
  @Input() altraFlatpickr: boolean | '' = true;
  @Input() fpDateFormat: string = 'Y-m-d';
  @Input() fpEnableTime: boolean = false;
  @Input() fpEnableSeconds: boolean = false;
  @Input() fpTime24hr: boolean = true;
  @Input() fpMinDate?: string;
  @Input() fpMaxDate?: string;
  /** Time-only picker (no calendar) */
  @Input() fpNoCalendar: boolean = false;

  private instance: any;

  constructor(private el: ElementRef<HTMLInputElement>, private zone: NgZone) {}

  ngAfterViewInit(): void {
    if (!this.altraFlatpickr) return;

    const fp = window.flatpickr;
    if (!fp) {
      // Flatpickr not loaded (e.g., offline). Fallback: native date input can be used.
      return;
    }

    this.zone.runOutsideAngular(() => {
      this.instance = fp(this.el.nativeElement, {
        dateFormat: this.fpDateFormat,
        enableTime: this.fpEnableTime,
        enableSeconds: this.fpEnableSeconds,
        noCalendar: this.fpNoCalendar,
        time_24hr: this.fpTime24hr,
      
        allowInput: true,
        disableMobile: true,
        minDate: this.fpMinDate,
        maxDate: this.fpMaxDate,
        onChange: () => {
          // Ensure Angular form controls get updated.
          this.el.nativeElement.dispatchEvent(new Event('input', { bubbles: true }));
          this.el.nativeElement.dispatchEvent(new Event('change', { bubbles: true }));
        },
      });
    });
  }

  ngOnDestroy(): void {
    try {
      this.instance?.destroy?.();
    } catch {
      // no-op
    }
  }
}
