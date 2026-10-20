import { buildProtectedResourceMetadata } from '@/lib/server/mcp-oauth/metadata';

export async function GET(request: Request) {
  return Response.json(buildProtectedResourceMetadata(request), {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
