import type { AdminUserRole } from '../../shared/api/admin-api.service';

export type { AdminUserRole } from '../../shared/api/admin-api.service';

/** A user row rendered in the admin Users table (normalised for display). */
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminUserRole;
  firmId: string | null;
  /** Human-readable firm name, or null for admins (no firm). */
  firmName: string | null;
  /** yyyy-mm-dd, for sorting/display. */
  createdAt: string;
  /** yyyy-mm-dd of the user's most recent conversation ('' when none). */
  lastConversationAt: string;
  /**
   * One-time generated temporary password, present ONLY on the create-user
   * response (never on rows loaded from a listing). Transient — never persisted
   * or put in a URL; surfaced once in the reveal modal then discarded.
   */
  temporaryPassword?: string;
}

/** A firm option shown in the "Firm User" firm picker. */
export interface FirmOption {
  id: string;
  name: string;
}

/**
 * Role selectable when provisioning a new account. Admin and Firm User are
 * mutually exclusive: Admin ⇒ no firm, Firm User ⇒ a firm is required.
 */
export type ProvisionRole = 'ADMIN';

/** The value produced by the create form. */
export interface CreateUserFormValue {
  name: string;
  email: string;
  role: ProvisionRole;
  firmId: string | null;
}
