import { Injectable } from '@angular/core';

declare global {
  interface Window { Swal?: any; }
}

@Injectable({ providedIn: 'root' })
export class AlertService {
  async confirm(opts: { title: string; text?: string; confirmText?: string; cancelText?: string; danger?: boolean; }): Promise<boolean> {
    const Swal = window.Swal;
    if (!Swal) {
      return confirm(opts.text ?? opts.title);
    }
    const res = await Swal.fire({
      title: opts.title,
      text: opts.text,
      icon: opts.danger ? 'warning' : 'question',
      showCancelButton: true,
      confirmButtonText: opts.confirmText ?? 'Confirmer',
      cancelButtonText: opts.cancelText ?? 'Annuler',
      confirmButtonColor: opts.danger ? '#d33' : undefined,
    });
    return !!res.isConfirmed;
  }

  async success(title: string, text?: string): Promise<void> {
    const Swal = window.Swal;
    if (!Swal) { return; }
    await Swal.fire({ title, text, icon: 'success', timer: 1800, showConfirmButton: false });
  }

  async error(title: string, text?: string): Promise<void> {
    const Swal = window.Swal;
    if (!Swal) { alert(text ?? title); return; }
    await Swal.fire({ title, text, icon: 'error' });
  }
}
