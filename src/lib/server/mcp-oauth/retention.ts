/**
 * Retention for the OAuth tables (ZIG-I23-11). Each rule deletes what is past
 * its window and returns how many rows went; the daily cron runs them.
 */
import { and, lt, notExists, notLike, sql } from 'drizzle-orm';
import {
  mcpOAuthAuthorizationCode,
  mcpOAuthClient,
  mcpOAuthGrant,
  mcpOAuthJwtAssertion,
  mcpOAuthTokenAttempt,
} from '@/db/schema';
import { db } from '@/lib/db';
import { captureException } from '@/lib/observability';

const DAY_MS = 24 * 60 * 60 * 1000;

export const TOKEN_ATTEMPT_RETENTION_DAYS = 30;
/** Codes live 10 minutes; keep them a day past expiry so a replay is still recognised. */
export const EXPIRED_CODE_GRACE_DAYS = 1;
/** DCR clients that never got a grant are dropped after a week. */
export const STALE_DCR_CLIENT_DAYS = 7;

const daysAgo = (days: number, nowMs: number) => new Date(nowMs - days * DAY_MS);

export const pruneTokenAttempts = async (nowMs = Date.now()) =>
  (
    await db
      .delete(mcpOAuthTokenAttempt)
      .where(lt(mcpOAuthTokenAttempt.created_at, daysAgo(TOKEN_ATTEMPT_RETENTION_DAYS, nowMs)))
      .returning({ id: mcpOAuthTokenAttempt.id })
  ).length;

export const pruneExpiredAuthorizationCodes = async (nowMs = Date.now()) =>
  (
    await db
      .delete(mcpOAuthAuthorizationCode)
      .where(
        lt(mcpOAuthAuthorizationCode.expires_at, daysAgo(EXPIRED_CODE_GRACE_DAYS, nowMs)),
      )
      .returning({ id: mcpOAuthAuthorizationCode.id })
  ).length;

export const pruneStaleDcrClients = async (nowMs = Date.now()) =>
  (
    await db
      .delete(mcpOAuthClient)
      .where(
        and(
          lt(mcpOAuthClient.created_at, daysAgo(STALE_DCR_CLIENT_DAYS, nowMs)),
          // CIMD clients (client_id is their https URL) are not DCR registrations.
          notLike(mcpOAuthClient.client_id, 'https://%'),
          notExists(
            db
              .select({ one: sql`1` })
              .from(mcpOAuthGrant)
              .where(sql`${mcpOAuthGrant.client_id} = ${mcpOAuthClient.client_id}`),
          ),
        ),
      )
      .returning({ id: mcpOAuthClient.id })
  ).length;

export const pruneExpiredJwtAssertions = async (nowMs = Date.now()) =>
  (
    await db
      .delete(mcpOAuthJwtAssertion)
      .where(lt(mcpOAuthJwtAssertion.expires_at, new Date(nowMs)))
      .returning({ jti: mcpOAuthJwtAssertion.jti })
  ).length;

export type RetentionRule = { name: string; run: () => Promise<number> };

export const MCP_OAUTH_RETENTION_RULES: RetentionRule[] = [
  { name: 'oauth_token_attempts', run: () => pruneTokenAttempts() },
  { name: 'oauth_expired_codes', run: () => pruneExpiredAuthorizationCodes() },
  { name: 'oauth_stale_dcr_clients', run: () => pruneStaleDcrClients() },
  { name: 'oauth_jwt_assertions', run: () => pruneExpiredJwtAssertions() },
];

/** Runs every rule; one failing rule never stops the others. */
export const runMcpOAuthRetention = async (
  rules: RetentionRule[] = MCP_OAUTH_RETENTION_RULES,
): Promise<Record<string, number | 'failed'>> => {
  const result: Record<string, number | 'failed'> = {};
  for (const rule of rules) {
    try {
      result[rule.name] = await rule.run();
    } catch (error) {
      captureException(error, { retention: rule.name });
      result[rule.name] = 'failed';
    }
  }
  return result;
};
