import { Injectable, inject } from '@angular/core';
import { ApiClient } from './api-client.service';

export type KpiSource = 'DOCUMENTS' | 'QA';

export interface KpiInputs {
  revenue?: number;
  revenueLow?: number;
  revenueHigh?: number;
  cogs?: number;
  cogsLow?: number;
  cogsHigh?: number;
  opex?: number;
  fteCount?: number;
  payrollMonthly?: number;
  customerCount?: number;
  topCustomerSharePct?: number;
  cashOnHand?: number;
  lastPriceChangeMonthsAgo?: number;
  competitorAvgPrice?: number;
  ownAvgPrice?: number;
}

export interface KpiSnapshot {
  id: string;
  firmId: string;
  source: KpiSource;
  inputs: KpiInputs;
  results: Record<string, number | null>;
  createdAt: string;
}

export interface RecomputeInput {
  source: KpiSource;
  inputs: KpiInputs;
}

@Injectable({ providedIn: 'root' })
export class KpisApi {
  private api = inject(ApiClient);

  getKpis(): Promise<KpiSnapshot[]> {
    return this.api.get<KpiSnapshot[]>('kpis');
  }

  /**
   * Recompute KPIs from the provided inputs. The backend runs a
   * deterministic financial engine — no LLM is on this path per
   * project rule.
   */
  recomputeKpis(input: RecomputeInput): Promise<KpiSnapshot> {
    return this.api.post<KpiSnapshot>('kpis/recompute', input);
  }
}
