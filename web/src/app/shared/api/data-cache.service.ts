import { computed, inject, Injectable, Signal, signal } from '@angular/core';
import { DocumentRow, DocumentsApi } from './documents-api.service';
import { AdminApi, SettingRow } from './admin-api.service';

/**
 * Lightweight React-Query-style cache built on Angular signals.
 *
 * Each `useX()` method returns a stable signal-backed view (data/loading/error)
 * plus a `refresh()` that re-runs the loader. Mutations call the explicit
 * `invalidateX()` helpers so consumers don't have to manage cache keys.
 */

interface CacheEntry<T> {
  data: ReturnType<typeof signal<T | null>>;
  loading: ReturnType<typeof signal<boolean>>;
  error: ReturnType<typeof signal<unknown | null>>;
  inflight?: Promise<T>;
}

function makeEntry<T>(): CacheEntry<T> {
  return {
    data: signal<T | null>(null),
    loading: signal(false),
    error: signal<unknown | null>(null),
  };
}

export interface Query<T> {
  data: Signal<T | null>;
  loading: Signal<boolean>;
  error: Signal<unknown | null>;
  refresh: () => Promise<T>;
}

@Injectable({ providedIn: 'root' })
export class DataCache {
  private documentsApi = inject(DocumentsApi);
  private adminApi = inject(AdminApi);

  private documents = makeEntry<DocumentRow[]>();
  private adminSettings = makeEntry<SettingRow[]>();

  private async run<T>(entry: CacheEntry<T>, loader: () => Promise<T>): Promise<T> {
    if (entry.inflight) return entry.inflight;
    entry.loading.set(true);
    entry.error.set(null);
    const p = loader()
      .then((res) => { entry.data.set(res); return res; })
      .catch((err) => { entry.error.set(err); throw err; })
      .finally(() => { entry.loading.set(false); entry.inflight = undefined; });
    entry.inflight = p;
    return p;
  }

  // ---- documents ----
  useDocuments(): Query<DocumentRow[]> {
    if (!this.documents.data() && !this.documents.loading()) {
      this.run(this.documents, () => this.documentsApi.listDocuments()).catch(() => {});
    }
    return {
      data: this.documents.data,
      loading: this.documents.loading,
      error: this.documents.error,
      refresh: () => this.run(this.documents, () => this.documentsApi.listDocuments()),
    };
  }
  invalidateDocuments() {
    this.documents.data.set(null);
    this.run(this.documents, () => this.documentsApi.listDocuments()).catch(() => {});
  }

  // ---- admin: settings ----
  useAdminSettings(): Query<SettingRow[]> {
    if (!this.adminSettings.data() && !this.adminSettings.loading()) {
      this.run(this.adminSettings, () => this.adminApi.getSettings()).catch(() => {});
    }
    return {
      data: this.adminSettings.data,
      loading: this.adminSettings.loading,
      error: this.adminSettings.error,
      refresh: () => this.run(this.adminSettings, () => this.adminApi.getSettings()),
    };
  }
  invalidateAdminSettings() {
    this.adminSettings.data.set(null);
    this.run(this.adminSettings, () => this.adminApi.getSettings()).catch(() => {});
  }

  /** Clear everything — called from logout. */
  clearAll() {
    [this.documents, this.adminSettings].forEach(e => {
      e.data.set(null);
      e.error.set(null);
      e.loading.set(false);
      e.inflight = undefined;
    });
  }
}
