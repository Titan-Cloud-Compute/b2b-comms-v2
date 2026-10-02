/**
 * Signup request DTO.
 *
 * Lives apart from the controller so the validation rules can be unit-tested
 * without instantiating the auth DI graph.
 */

import { z } from 'zod';

export const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
  /** 48-char hex token issued by an admin. Optional in schema so Zod parses
   *  gracefully; the service rejects missing tokens for non-bootstrap users. */
  registrationToken: z.string().regex(/^[a-f0-9]{48}$/).optional(),
  /** Optional VAT number. */
  vatNumber: z.string().optional(),
  /** Optional company registration number (or equivalent). */
  regNumber: z.string().optional(),
  /** Optional company website URL. */
  website: z.string().optional(),
  /** Optional WhatsApp contact number. */
  whatsappPhone: z.string().optional(),
  /** Optional Viber contact number. */
  viberPhone: z.string().optional(),
});

export type SignupDto = z.infer<typeof SignupSchema>;
