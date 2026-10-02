import { Injectable, signal, computed } from '@angular/core';

export type ToastLevel = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: number;
  message: string;
  level: ToastLevel;
  retry: boolean;
}

/**
 * Minimal toast queue. The interceptor pushes here on 403/503; the
 * `<app-layout>` host listens on the `toasts` signal and renders the
 * stack. Toasts auto-dismiss after `ttlMs`.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<Toast[]>([]);
  private nextId = 1;

  toasts = computed(() => this._toasts());

  show(
    message: string,
    level: ToastLevel = 'info',
    opts: { retry?: boolean; ttlMs?: number } = {},
  ): number {
    const id = this.nextId++;
    const toast: Toast = {
      id,
      message,
      level,
      retry: !!opts.retry,
    };
    this._toasts.update((list) => [...list, toast]);
    const ttl = opts.ttlMs ?? (level === 'error' ? 6000 : 4000);
    setTimeout(() => this.dismiss(id), ttl);
    return id;
  }

  dismiss(id: number) {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  clear() {
    this._toasts.set([]);
  }
}
