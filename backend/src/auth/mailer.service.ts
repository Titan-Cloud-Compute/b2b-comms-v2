import { Injectable, Logger } from '@nestjs/common';

/**
 * MailerService — transactional email dispatch.
 *
 * The default implementation logs the reset link to stdout (safe for
 * development / test environments where no SMTP relay is configured).
 * Production deployments swap in a nodemailer createTransport() that
 * delivers to a real relay.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger('MailerService');

  /**
   * Send a password-reset link to `email`. The `token` is a single-use,
   * short-lived secret that the UI will POST back to /auth/password-reset/confirm.
   */
  async sendPasswordReset(email: string, token: string): Promise<void> {
    // Intentionally short-circuit in test / development: just log the token so
    // integration tests can capture it without an SMTP relay.
    this.logger.log(`[password-reset] token for ${email}: ${token}`);
  }
}
