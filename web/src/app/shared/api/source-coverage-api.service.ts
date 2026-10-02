import { Injectable, inject } from '@angular/core';
import { ApiClient } from './api-client.service';

/* -------------------------------------------------------------------------- */
/* Wire shapes — mirror backend/src/enrichment/source-coverage.service.ts       */
/* -------------------------------------------------------------------------- */

/** Licence tier of a catalogued source, as authored in the static catalog. */
export type SourceOpenness = 'open-data' | 'license-gated' | 'proprietary';

export type ExpectedConfidence = 'high' | 'medium' | 'low';

/** One catalogued source plus THIS deployment's availability verdict. */
export interface SourceAvailability {
  id: string;
  label: string;
  publisher: string;
  url: string;
  openness: SourceOpenness;
  licence: string;
  /** Attribution line the licence obliges us to render, or null when none. */
  attribution: string | null;
  /** True when the source needs no credential at all. */
  keyless: boolean;
  coverage: string;
  refreshCadence: string;
  /** Config key that unlocks it (env → SystemSetting), null when keyless. */
  configKey: string | null;
  /** True when every credential/flag the source needs is present right now. */
  available: boolean;
  /** Actionable reason it is unusable — `null` exactly when `available`. */
  blockedReason: string | null;
}

/** One way of answering one question, with the runtime verdict folded in. */
export interface CoverageSource extends SourceAvailability {
  /** Research tool that reaches it, or null when catalogued but unwired. */
  tool: string | null;
  /** The concrete field/derivation that answers this question. */
  method: string;
  expectedConfidence: ExpectedConfidence;
}

/** One pre-survey question with its resolved, runtime-aware source list. */
export interface QuestionCoverage {
  formKey: string;
  profileColumn: string | null;
  required: boolean;
  /** No public dataset holds this answer — the owner is the only source. */
  ownerOnly: boolean;
  rationale: string;
  /** True when at least one mapped source is AVAILABLE right now. */
  answerable: boolean;
  /** Waterfall order preserved from the map — first entry wins attribution. */
  sources: CoverageSource[];
}

/** Per-openness-tier rollup — the licence-risk read of the same data. */
export interface OpennessRollup {
  openness: SourceOpenness;
  sources: number;
  available: number;
  blocked: number;
  questions: number;
  questionsAnswerable: number;
}

/** Headline counts for the coverage page. */
export interface CoverageSummary {
  totalQuestions: number;
  answerable: number;
  blocked: number;
  ownerOnly: number;
  totalSources: number;
  availableSources: number;
}

/** `GET api/admin/source-coverage` — the whole matrix in one inert read. */
export interface SourceCoverageReport {
  summary: CoverageSummary;
  questions: QuestionCoverage[];
  rollup: OpennessRollup[];
  sources: SourceAvailability[];
  generatedAt: string;
}

/** `GET api/admin/source-coverage/sources` — the catalog listing alone. */
export interface SourceCatalogListing {
  sources: SourceAvailability[];
  total: number;
  available: number;
  generatedAt: string;
}

/**
 * Firm-scoped view of one question's sources — deliberately narrower than the
 * admin shape (no `configKey`, no admin-phrased `blockedReason`).
 */
export interface IntakeQuestionSource {
  id: string;
  label: string;
  publisher: string;
  url: string;
  openness: string;
  licence: string;
  attribution: string | null;
  coverage: string;
  tool: string | null;
  method: string;
  expectedConfidence: ExpectedConfidence;
  available: boolean;
}

export interface IntakeQuestionSources {
  formKey: string;
  profileColumn: string | null;
  required: boolean;
  ownerOnly: boolean;
  rationale: string;
  answerable: boolean;
  sources: IntakeQuestionSource[];
}

/** `GET api/intake/question-sources` — firm-scoped question→source read. */
export interface IntakeQuestionSourcesResponse {
  firmId: string | null;
  questions: IntakeQuestionSources[];
}

/* -------------------------------------------------------------------------- */
/* Facade                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * OPEN-SOURCE DATA CATALOG — the frontend front door.
 *
 * One-liner facade in the `AdminApi` style over the three inert reads exposed
 * by `SourceCoverageController` / `IntakeController`:
 *  - `matrix()`      → `admin/source-coverage`         (admin coverage page)
 *  - `sources()`     → `admin/source-coverage/sources` ("Sources & licences")
 *  - `forQuestion()` → `intake/question-sources`       (firm-scoped intake UI)
 *
 * Every call is derived from static TS + config lookups on the backend — no
 * network, no LLM, no writes — so these are safe to call on page load and on
 * every deep-link (`?formKey=`, `?openness=`) change.
 */
@Injectable({ providedIn: 'root' })
export class SourceCoverageApi {
  private api = inject(ApiClient);

  /**
   * Full coverage matrix + rollup + summary. `formKey` narrows the `questions`
   * array to a single question (the detail-panel deep link) while summary and
   * rollup keep describing the WHOLE matrix.
   */
  matrix(formKey?: string): Promise<SourceCoverageReport> {
    return this.api.get<SourceCoverageReport>('admin/source-coverage', {
      params: { formKey: formKey || undefined },
    });
  }

  /** Catalog listing with per-source verdicts, optionally one licence tier. */
  sources(openness?: SourceOpenness): Promise<SourceCatalogListing> {
    return this.api.get<SourceCatalogListing>('admin/source-coverage/sources', {
      params: { openness: openness || undefined },
    });
  }

  /**
   * Which open sources can answer one pre-survey question, for the signed-in
   * firm. An unmapped/unknown `formKey` returns an empty `questions` array
   * rather than an error — the intake UI asks per field and must not break.
   */
  forQuestion(formKey: string): Promise<IntakeQuestionSourcesResponse> {
    return this.api.get<IntakeQuestionSourcesResponse>('intake/question-sources', {
      params: { formKey: formKey || undefined },
    });
  }
}
