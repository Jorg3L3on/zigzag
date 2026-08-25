import { NextRequest } from 'next/server';
import { revokeOAuthToken } from '@/lib/server/mcp-oauth/grants';
import {
  oauthErrorResponse,
  oauthJsonResponse,
  oauthOptionsResponse,
} from '@/lib/server/mcp-oauth/cors';

export function OPTIONS() {
  return oauthOptionsResponse();
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    let token: string | undefined;
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as { token?: string };
      token = body.token;
    } else {
      const form = await request.formData();
      token = String(form.get('token') ?? '');
    }
    if (!token?.trim()) {
      return oauthErrorResponse('invalid_request', 'token requerido');
    }
    await revokeOAuthToken(token.trim());
    return oauthJsonResponse({});
  } catch (error) {
    console.error('OAuth revoke error:', error);
    return oauthErrorResponse('server_error', undefined, 500);
  }
}
