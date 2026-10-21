import { mcpOAuthJwtAssertion } from '@/db/schema';
import { db } from '@/lib/db';

/** A client assertion may live at most this long (exp - iat). */
export const JWT_ASSERTION_MAX_LIFETIME_S = 10 * 60;

/**
 * Records a private_key_jwt `jti` until the assertion expires. Returns false
 * when the jti was already used: the assertion is a replay.
 */
export const consumeJwtAssertionJti = async (input: {
  jti: string;
  clientId: string;
  expiresAt: Date;
}): Promise<boolean> => {
  const inserted = await db
    .insert(mcpOAuthJwtAssertion)
    .values({
      jti: input.jti,
      client_id: input.clientId,
      expires_at: input.expiresAt,
    })
    .onConflictDoNothing()
    .returning({ jti: mcpOAuthJwtAssertion.jti });
  return inserted.length === 1;
};
