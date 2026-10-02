import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route handler or controller as public (no JWT required).
 * JwtAuthGuard reads this metadata via Reflector and skips token validation.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
