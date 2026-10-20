/**
 * @jest-environment node
 */
import {
  MCP_WWW_AUTHENTICATE_META_KEY,
  withAuthChallenge,
} from '@/lib/mcp/auth-challenge';
import { AgentAuthError } from '@/lib/server/resolve-agent-context';

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));

const result = { content: [{ type: 'text' as const, text: '{}' }], isError: true };
const request = new Request('https://zigzag-hazel.vercel.app/api/mcp');

describe('withAuthChallenge', () => {
  it('adds the WWW-Authenticate challenge to a 401 tool error', () => {
    const tagged = withAuthChallenge(
      result,
      new AgentAuthError('Token OAuth inválido o expirado', 401),
      request,
    );

    expect(tagged).toEqual({
      ...result,
      _meta: {
        [MCP_WWW_AUTHENTICATE_META_KEY]: [
          'Bearer error="invalid_token", error_description="Token OAuth inválido o expirado", resource_metadata="https://zigzag-hazel.vercel.app/.well-known/oauth-protected-resource"',
        ],
      },
    });
  });

  it('strips quotes from the description so the challenge stays parseable', () => {
    const tagged = withAuthChallenge(
      result,
      new AgentAuthError('Falta "Bearer"', 401),
      request,
    ) as { _meta: Record<string, string[]> };

    expect(tagged._meta[MCP_WWW_AUTHENTICATE_META_KEY][0]).toContain(
      'error_description="Falta Bearer"',
    );
  });

  it('leaves 403s and other errors untouched', () => {
    expect(withAuthChallenge(result, new AgentAuthError('Forbidden', 403), request)).toBe(
      result,
    );
    expect(withAuthChallenge(result, new Error('boom'), request)).toBe(result);
  });
});
