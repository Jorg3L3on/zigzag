/**
 * @jest-environment node
 */
import { toErrorResult } from '@/lib/mcp/tool-helpers';

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));

describe('tool errors never expose internals', () => {
  it('maps a database error to a generic internal error and logs the real one', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const dbError = Object.assign(
      new Error('duplicate key value violates unique constraint "Ticket_pkey"'),
      { code: '23505', table: 'Ticket' },
    );

    const result = toErrorResult(dbError, 'create_ticket');

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      error: {
        code: 'internal',
        message: 'Error interno en la herramienta. Intenta de nuevo más tarde.',
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/duplicate key|Ticket_pkey|23505/);
    consoleError.mockRestore();
  });

  it('does not forward the message of arbitrary thrown values', () => {
    const result = toErrorResult('connect ECONNREFUSED 10.0.0.5:5432');
    expect(JSON.stringify(result)).not.toContain('ECONNREFUSED');
    expect(result.structuredContent).toEqual({
      error: expect.objectContaining({ code: 'internal' }),
    });
  });
});
