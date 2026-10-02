import { Injectable, inject } from '@angular/core';
import { ApiClient } from './api-client.service';

export interface OnboardingInput {
  firmName?: string;
  /** Must be literal true — backend uses z.literal(true) validation. */
  consent: boolean;
  digitalMaturity: 'HIGH' | 'LOW';
  /** UI language the consent statement was shown in (ISO 27560 stamp). */
  language?: 'en' | 'bg';
}

export interface OnboardingResult {
  /** Firm UUID — backend returns as `id`, not `firmId`. */
  id: string;
  name: string;
  digitalMaturity: string;
  onboardingCompleteAt: string | null;
  /** True when the firm must complete the conversational intake before the dashboard. */
  intakeRequired?: boolean;
  intakeCompleteAt?: string | null;
}

@Injectable({ providedIn: 'root' })
export class OnboardingApi {
  private api = inject(ApiClient);

  /**
   * Submit the onboarding form. If `files` are supplied (eg. founding
   * docs uploaded during onboarding) they are sent as a separate
   * multipart upload AFTER the JSON onboarding call succeeds. The
   * /api/onboarding endpoint takes JSON only; documents flow through
   * /api/documents.
   */
  async submitOnboarding(
    payload: OnboardingInput,
    files: File[] = [],
  ): Promise<OnboardingResult> {
    const result = await this.api.post<OnboardingResult>('onboarding', payload);
    // Upload any supporting documents now that the firm exists.
    for (const f of files) {
      try {
        await this.api.upload<unknown>('documents', f);
      } catch (err) {
        // Soft-fail: onboarding succeeded; the user can re-try the
        // uploads from the documents page.
        // eslint-disable-next-line no-console
        console.warn('Onboarding document upload failed:', err);
      }
    }
    return result;
  }
}
