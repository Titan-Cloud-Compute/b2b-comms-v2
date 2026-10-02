import { Injectable, inject } from '@angular/core';
import { ApiClient } from './api-client.service';

/**
 * Cloud-storage provider slugs the backend accepts in the `provider` filter —
 * mirrors `CLOUD_PROVIDERS` in the connectors registry. Kept as a union (not a
 * bare string) so a typo in a filter chip fails at compile time; hits coming
 * back may still carry `null` when a Document's `cloud:<slug>` tag is missing.
 */
export type CloudSlug = 'googledrive' | 'sharepoint' | 'dropbox' | 'box';

/**
 * One chunk-level hit from `POST /api/search/files` — a passage of a
 * cloud-synced file, not the whole file. Several hits can share a
 * `documentId` with different `chunkIndex` values.
 */
export interface FileSearchHit {
  documentId: string;
  fileName: string;
  /** Parsed from the `cloud:<slug>` tag; null if the tag is missing/unknown. */
  provider: CloudSlug | null;
  chunkIndex: number;
  excerpt: string;
  /** Reciprocal-rank-fusion score (vector + full-text); higher is better. */
  score: number;
}

/**
 * One cloud-storage connection the firm has, with how many of its synced files
 * are searchable. Lets the UI tell "nothing connected" apart from "connected
 * but nothing matched" (`fileCount === 0` + `lastSyncAt === null` = the drive
 * is connected but has not finished a first sync).
 */
export interface ConnectedFileSource {
  /** Connection.id — matches the `conn:<id>` provenance tag on its Documents. */
  connectionId: string;
  /** Slug after the `cloudstorage:` prefix, e.g. `googledrive`. */
  provider: string;
  /** Human label from the provider registry ('Google Drive'), never a raw slug. */
  displayName: string;
  /** Distinct cloud-synced Documents tagged `conn:<id>` for this firm. */
  fileCount: number;
  /** ISO timestamp of the last completed sync, or null if it never ran. */
  lastSyncAt: string | null;
  /** ACTIVE | DISCONNECTED | ERROR — only ACTIVE drives are searched. */
  status: string;
}

/**
 * The filter set a saved search replays. Deliberately the same shape as the
 * file-search request minus nothing — an old saved search that predates a new
 * filter simply omits it, so extra keys are optional by construction.
 */
export interface SavedSearchFilters {
  query?: string;
  provider?: CloudSlug | null;
  limit?: number;
}

/**
 * One saved search — a NAMED filter set owned by the signed-in user, as
 * returned by `/api/saved-searches`. The owner is never part of the wire
 * shape: the backend takes it from the session cookie on every route.
 */
export interface SavedSearch {
  id: string;
  name: string;
  filters: SavedSearchFilters;
  /** ISO timestamp of when it was saved. */
  createdAt: string;
}

/**
 * Body of `POST /api/search/files`. NOTE the absence of `firmId`: the backend
 * reads firm scope from the verified JWT session cookie and ignores any
 * client-supplied one, so there is nothing for the caller to pass.
 */
export interface FileSearchRequest {
  query: string;
  /** Restrict to one drive; omit to search every connected provider. */
  provider?: CloudSlug;
  /** 1..20, backend default 10. */
  limit?: number;
}

/** Response of `POST /api/search/files`. */
export interface FileSearchResponse {
  /** Echo of the submitted query — use it to drop stale out-of-order responses. */
  query: string;
  /** Echo of the applied provider filter, null when every drive was searched. */
  provider: CloudSlug | null;
  count: number;
  results: FileSearchHit[];
}

/** Wire shape of `GET /api/search/files/sources`. */
interface ConnectedFileSourcesResponse {
  count: number;
  sources: ConnectedFileSource[];
}

/**
 * "Search my connected files" — thin typed wrapper over the firm-scoped
 * hybrid search endpoints. Both routes are cookie-authenticated
 * (`JwtAuthGuard`); `ApiClient` already sends credentials, and paths are
 * given WITHOUT the `api/` prefix because the client adds it.
 */
@Injectable({ providedIn: 'root' })
export class SearchApi {
  private api = inject(ApiClient);

  /**
   * Hybrid (pgvector + full-text) search restricted to cloud-synced
   * Documents of the caller's firm. Only files from connections that are
   * still ACTIVE are searched, so a disconnected drive stops answering
   * immediately and an empty `results` is a truthful "no connected files".
   */
  searchFiles(body: FileSearchRequest): Promise<FileSearchResponse> {
    return this.api.post<FileSearchResponse>('search/files', body);
  }

  /**
   * Save the current filters under a name. Re-saving an existing NAME updates
   * that saved search server-side (unique per user+name) instead of creating a
   * duplicate, so pressing Save twice is harmless.
   */
  saveSearch(name: string, filters: SavedSearchFilters): Promise<SavedSearch> {
    return this.api.post<SavedSearch>('saved-searches', { name, filters });
  }

  /** The signed-in user's saved searches, newest first (bare array response). */
  async listSavedSearches(): Promise<SavedSearch[]> {
    const res = await this.api.get<SavedSearch[]>('saved-searches');
    return res ?? [];
  }

  /** Delete one saved search. Idempotent server-side — a stale id is not an error. */
  deleteSavedSearch(id: string): Promise<{ id: string; deleted: boolean }> {
    return this.api.delete<{ id: string; deleted: boolean }>(
      `saved-searches/${encodeURIComponent(id)}`,
    );
  }

  /**
   * The firm's cloud-storage connections and their searchable file counts —
   * powers the provider filter and the empty-state copy. The endpoint's
   * redundant `count` envelope is unwrapped here (it is always
   * `sources.length`).
   */
  async listSources(): Promise<ConnectedFileSource[]> {
    const res = await this.api.get<ConnectedFileSourcesResponse>('search/files/sources');
    return res?.sources ?? [];
  }
}
