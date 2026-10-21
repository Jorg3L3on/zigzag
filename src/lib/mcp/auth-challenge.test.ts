/**
 * @jest-environment node
 */
import { MCP_WWW_AUTHENTICATE_META_KEY } from '@/lib/mcp/auth-challenge';
import { toErrorResult } from '@/lib/mcp/tool-helpers';
import { AgentAuthError } from '@/lib/server/resolve-agent-context';

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));

const request = new Request('https://zigzag-hazel.vercel.app/api/mcp');

describe('401 tool errors carry the mcp/www_authenticate challenge', () => {
  it('adds the invalid_token challenge with resource_metadata to the unauthorized result', () => {
    const result = toErrorResult(
      new AgentAuthError('Token OAuth inválido o expirado', 401),
      'list_companies',
      request,
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      error: { code: 'unauthorized', message: 'Token OAuth inválido o expirado' },
    });
    expect(result._meta).toEqual({
      [MCP_WWW_AUTHENTICATE_META_KEY]: [
        'Bearer error="invalid_token", error_description="Token OAuth inválido o expirado", resource_metadata="https://zigzag-hazel.vercel.app/.well-known/oauth-protected-resource"',
      ],
    });
  });

  it('strips quotes from the description so the challenge stays parseable', () => {
    const result = toErrorResult(new AgentAuthError('Falta "Bearer"', 401), 'x', request);

    expect(
      (result._meta?.[MCP_WWW_AUTHENTICATE_META_KEY] as string[])[0],
    ).toContain('error_description="Falta Bearer"');
  });

  it('leaves 403s and other errors without _meta', () => {
    expect(
      toErrorResult(new AgentAuthError('Forbidden', 403), 'x', request)._meta,
    ).toBeUndefined();
    expect(toErrorResult(new Error('boom'), 'x', request)._meta).toBeUndefined();
  });
});
