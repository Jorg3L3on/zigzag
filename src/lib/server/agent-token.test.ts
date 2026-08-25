import { generateAgentToken, hashAgentToken, verifyAgentToken } from '@/lib/server/agent-token';
import { generateOAuthAccessToken, verifyOAuthSecret } from '@/lib/server/mcp-oauth/tokens';

describe('agent and oauth tokens', () => {
  it('generates zigzag_ prefixed API keys', () => {
    const { token, keyPrefix } = generateAgentToken();
    expect(token.startsWith('zigzag_')).toBe(true);
    expect(keyPrefix.startsWith('zigzag_')).toBe(true);
  });

  it('verifies agent token hash', async () => {
    const { token } = generateAgentToken();
    const hash = hashAgentToken(token);
    await expect(verifyAgentToken(token, hash)).resolves.toBe(true);
    await expect(verifyAgentToken(`${token}x`, hash)).resolves.toBe(false);
  });

  it('generates zigzag_oauth_ access tokens', () => {
    const access = generateOAuthAccessToken();
    expect(access.token.startsWith('zigzag_oauth_')).toBe(true);
    expect(verifyOAuthSecret(access.token, access.tokenHash)).toBe(true);
  });
});
