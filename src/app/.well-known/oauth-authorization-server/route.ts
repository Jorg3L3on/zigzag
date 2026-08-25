import { buildAuthorizationServerMetadata } from '@/lib/server/mcp-oauth/metadata';

export async function GET(request: Request) {
  return Response.json(buildAuthorizationServerMetadata(request), {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
