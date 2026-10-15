'use server';

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { pushSubscription } from '@/db/schema';
import { db } from '@/lib/db';
import { handleCodedServerActionError, type ActionErrorType } from '@/lib/errors';
import { requireActionAuth } from '@/lib/security';

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(256),
  }),
  userAgent: z.string().max(512).optional(),
});

export type PushSubscriptionInput = z.infer<typeof subscriptionSchema>;

type ActionResult = { success: boolean; error?: string; errorType?: ActionErrorType };

/**
 * Register (or refresh) this device's push subscription (ZIG-I20-2). Never
 * takes a company: the row is bound to the caller's user and company, so a
 * tenant cannot subscribe to another company's notifications. An endpoint
 * re-sent by another user (device handed over) moves to the caller.
 */
export async function savePushSubscription(input: PushSubscriptionInput): Promise<ActionResult> {
  try {
    const context = await requireActionAuth();
    if (!context.companyId) {
      return { success: false, error: 'Sin empresa', errorType: 'auth' };
    }
    const parsed = subscriptionSchema.parse(input);
    const values = {
      company_id: context.companyId,
      user_id: BigInt(context.userId),
      endpoint: parsed.endpoint,
      p256dh: parsed.keys.p256dh,
      auth: parsed.keys.auth,
      user_agent: parsed.userAgent ?? null,
      last_seen_at: new Date(),
    };
    await db
      .insert(pushSubscription)
      .values(values)
      .onConflictDoUpdate({ target: pushSubscription.endpoint, set: values });
    return { success: true };
  } catch (e) {
    return handleCodedServerActionError('push.subscribe', 'GN001', e);
  }
}

/** Forget this device: only the caller's own subscription row can go. */
export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  try {
    const context = await requireActionAuth();
    await db
      .delete(pushSubscription)
      .where(
        and(
          eq(pushSubscription.endpoint, endpoint),
          eq(pushSubscription.user_id, BigInt(context.userId)),
        ),
      );
    return { success: true };
  } catch (e) {
    return handleCodedServerActionError('push.unsubscribe', 'GN001', e);
  }
}

/** Is this device's subscription known to the server (and the caller's)? */
export async function hasPushSubscription(endpoint: string): Promise<{
  success: boolean;
  data?: boolean;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const context = await requireActionAuth();
    const row = await db.query.pushSubscription.findFirst({
      where: and(
        eq(pushSubscription.endpoint, endpoint),
        eq(pushSubscription.user_id, BigInt(context.userId)),
      ),
      columns: { id: true },
    });
    return { success: true, data: Boolean(row) };
  } catch (e) {
    return handleCodedServerActionError('push.status', 'GN001', e);
  }
}
