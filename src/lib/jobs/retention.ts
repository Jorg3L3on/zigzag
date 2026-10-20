/**
 * Daily retention rules, run by the cron routes after the job queue drains.
 * Each rule deletes what is past its window and reports how many rows went.
 * One failing rule never stops the others.
 */
import { logger } from '@/lib/logger';
import { captureException } from '@/lib/observability';
import { pruneMcpToolCalls } from '@/lib/mcp/activity';

export type RetentionRule = {
  name: string;
  run: () => Promise<number>;
};

export const RETENTION_RULES: RetentionRule[] = [
  // ZIG-I23-8: agent activity log, 90 days.
  { name: 'mcp_tool_calls', run: () => pruneMcpToolCalls() },
];

export type RetentionResult = Record<string, number | 'failed'>;

export async function runRetention(
  rules: RetentionRule[] = RETENTION_RULES,
): Promise<RetentionResult> {
  const result: RetentionResult = {};
  for (const rule of rules) {
    try {
      result[rule.name] = await rule.run();
    } catch (error) {
      captureException(error, { retention: rule.name });
      result[rule.name] = 'failed';
    }
  }
  const deleted = Object.values(result).filter((v) => typeof v === 'number' && v > 0);
  if (deleted.length > 0) logger.info('Retention ran', result);
  return result;
}
