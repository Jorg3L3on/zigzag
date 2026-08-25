import { sanitizeTokenAttemptBody } from '@/lib/server/mcp-oauth/token-attempt-sanitize';

describe('token attempt sanitize', () => {
  it('never includes secrets in sanitized body', () => {
    const sanitized = sanitizeTokenAttemptBody({
      grant_type: 'authorization_code',
      code: 'secret-code-value',
      code_verifier: 'a'.repeat(43),
      client_secret: 'super-secret',
      client_assertion: 'jwt-token',
      client_id: 'https://chatgpt.com/oauth/instance/client.json',
      redirect_uri: 'https://chatgpt.com/connector/oauth/abc',
      resource: 'https://example.test/api/mcp',
    });

    expect(sanitized.grant_type).toBe('authorization_code');
    expect(sanitized.has_code).toBe(true);
    expect(sanitized.has_verifier).toBe(true);
    expect(sanitized.has_assertion).toBe(true);
    expect(JSON.stringify(sanitized)).not.toContain('secret-code-value');
    expect(JSON.stringify(sanitized)).not.toContain('super-secret');
    expect(JSON.stringify(sanitized)).not.toContain('jwt-token');
  });
});
