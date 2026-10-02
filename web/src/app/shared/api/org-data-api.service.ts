import { Injectable, inject } from '@angular/core';
import { ApiClient } from './api-client.service';

/** Mirrors the backend FrameworkReadinessService output (Phase 1.2/1.4). */
export type ReadinessStatus = 'ready' | 'partial' | 'blocked';
export type ResolvedSource = 'profile' | 'dataset';
export type ObtainOption = 'connect' | 'upload' | 'derive' | 'ask';
export type Provenance = 'filed' | 'connector' | 'benchmark' | 'estimate' | 'ask' | 'upload';

export interface ResolvedInput {
  key: string;
  label: string;
  required: boolean;
  satisfied: boolean;
  source: ResolvedSource | null;
  provenance: string | null;
  obtain?: ObtainOption[];
}

export interface FrameworkReadiness {
  framework: string;
  label: string;
  description: string;
  inputs: ResolvedInput[];
  requiredTotal: number;
  requiredSatisfied: number;
  completeness: number;
  status: ReadinessStatus;
}

export interface DatasetDraft {
  datasetType: string;
  data: Record<string, unknown>;
  documentId: string;
  documentName: string | null;
}

export interface UpsertDatasetBody {
  datasetType: string;
  period?: string;
  data: Record<string, unknown>;
  provenance: Provenance;
  confidence?: number;
  sourceRef?: string;
}

/** Typed client for the Org Data Room endpoints. */
@Injectable({ providedIn: 'root' })
export class OrgDataApi {
  private api = inject(ApiClient);

  /** Per-framework data-readiness for the current firm. */
  readiness(): Promise<FrameworkReadiness[]> {
    return this.api.get<FrameworkReadiness[]>('org-data/readiness');
  }

  /** Extract a dataset draft from an uploaded document (not persisted). */
  extract(documentId: string, datasetType: string): Promise<DatasetDraft> {
    return this.api.post<DatasetDraft>('org-data/extract', { documentId, datasetType });
  }

  /** Persist a dataset (create/revise). */
  upsertDataset(body: UpsertDatasetBody): Promise<unknown> {
    return this.api.post<unknown>('org-data/datasets', body);
  }
}
