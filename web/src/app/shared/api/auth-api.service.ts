import { Injectable, inject } from '@angular/core';
import { ApiClient } from './api-client.service';

export interface ImpersonationIdentity {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  firmId: string | null;
  firmName?: string | null;
  impersonating: boolean;
}

export type UserRole = 'ADMIN' | 'USER' | 'SUPER_ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface SignupInput {
  email: string;
  password: string;
  name?: string;
  /** hex32 single-use registration token (UI spec). Optional only for the
   *  very first admin bootstrap. */
  registrationToken?: string;
  /** Optional EU VAT number (e.g. BG123456789). Used to auto-pull registry
   *  and financial data. */
  vatNumber?: string;
  /** Optional company website URL. Used to read and pre-fill profile. */
  website?: string;
  /** Optional company registration number (validated server-side). */
  regNumber?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** What a registration token grants, as read by the public preview endpoint. */
export interface RegistrationTokenPreview {
  /** Is the token known, unconsumed and unexpired? */
  valid: boolean;
  /** Models the token entitles the registrant to (first = the one they get). */
  models: { id: string; label: string }[];
}

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private api = inject(ApiClient);

  signup(input: SignupInput): Promise<AuthUser> {
    return this.api.post<AuthUser>('auth/signup', input);
  }

  login(input: LoginInput): Promise<AuthUser> {
    return this.api.post<AuthUser>('auth/login', input);
  }

  /**
   * Public (pre-account) lookup of the AI model a registration token grants.
   * Never throws: a malformed/unknown token simply resolves to "no model", so
   * the signup field stays blank instead of surfacing an error.
   */
  async previewRegistrationToken(
    token: string,
  ): Promise<RegistrationTokenPreview> {
    try {
      const res = await this.api.get<RegistrationTokenPreview>(
        `auth/registration-token/${encodeURIComponent(token)}`,
      );
      return {
        valid: !!res?.valid,
        models: Array.isArray(res?.models) ? res.models : [],
      };
    } catch {
      return { valid: false, models: [] };
    }
  }

  logout(): Promise<void> {
    return this.api.post<void>('auth/logout');
  }

  /** Exit a "view as company" impersonation, restoring the admin session.
   *  Returns the admin's restored identity. */
  exitImpersonation(): Promise<ImpersonationIdentity> {
    return this.api.post<ImpersonationIdentity>('auth/exit-impersonation');
  }

  /** Request a password-reset email for the given address. */
  requestPasswordReset(email: string): Promise<{ ok: boolean }> {
    return this.api.post<{ ok: boolean }>('auth/password-reset/request', { email });
  }

  /** Confirm a password reset using the one-time token from the email link. */
  confirmPasswordReset(token: string, password: string): Promise<{ ok: boolean }> {
    return this.api.post<{ ok: boolean }>('auth/password-reset/confirm', { token, password });
  }

  /**
   * Best-effort "who am I" lookup via the users/me endpoint.
   * Returns `null` if the session is gone or absent.
   */
  async me(): Promise<{ id: string; email: string } | null> {
    try {
      return await this.api.get<{ id: string; email: string }>('users/me');
    } catch {
      return null;
    }
  }
}
