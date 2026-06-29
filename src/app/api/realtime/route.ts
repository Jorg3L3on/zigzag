import { Client } from 'pg';
import { requireSession } from '@/lib/api-helpers';
import { REALTIME_CHANNEL, type RealtimeEvent } from '@/lib/realtime/events';
import { captureException } from '@/lib/observability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEARTBEAT_MS = 25_000;

/**
 * Server-Sent Events stream of realtime app events for the authenticated user,
 * fanned out via Postgres LISTEN/NOTIFY. A dedicated `pg` client holds the
 * LISTEN connection for the life of the request; events are filtered to the
 * viewer's company (system users see all). The browser's EventSource
 * auto-reconnects if the connection drops (e.g. serverless time limits).
 */
export async function GET(request: Request) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized || !session) {
    return unauthorized ?? new Response('Unauthorized', { status: 401 });
  }

  const viewerCompanyId = session.user.company_id ?? null;
  const isSystem = Boolean(session.user.company_is_system);

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return new Response('Realtime unavailable', { status: 503 });
  }

  const encoder = new TextEncoder();
  const client = new Client({
    connectionString,
    // IPv4; supported by `pg` at runtime but omitted from typings.
    family: 4,
  } as ConstructorParameters<typeof Client>[0]);

  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const cleanup = async () => {
    if (closed) {
      return;
    }
    closed = true;
    if (heartbeat) {
      clearInterval(heartbeat);
    }
    try {
      await client.end();
    } catch {
      // ignore teardown errors
    }
  };

  const stream = new ReadableStream({
    async start(controller) {
      const sendRaw = (chunk: string) => {
        if (!closed) {
          controller.enqueue(encoder.encode(chunk));
        }
      };
      const sendEvent = (event: Partial<RealtimeEvent>) =>
        sendRaw(`data: ${JSON.stringify(event)}\n\n`);

      try {
        await client.connect();
        await client.query(`LISTEN ${REALTIME_CHANNEL}`);

        client.on('notification', (msg) => {
          if (!msg.payload) {
            return;
          }
          try {
            const event = JSON.parse(msg.payload) as RealtimeEvent;
            if (isSystem || event.companyId === null || event.companyId === viewerCompanyId) {
              sendEvent(event);
            }
          } catch {
            // ignore malformed payloads
          }
        });

        client.on('error', (error) => {
          captureException(error, { route: '/api/realtime' });
          void cleanup();
          try {
            controller.close();
          } catch {
            // already closed
          }
        });

        sendEvent({ type: 'connected', companyId: viewerCompanyId });
        heartbeat = setInterval(() => sendRaw(': ping\n\n'), HEARTBEAT_MS);
      } catch (error) {
        captureException(error, { route: '/api/realtime', phase: 'start' });
        await cleanup();
        controller.close();
        return;
      }

      request.signal.addEventListener('abort', () => {
        void cleanup();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    async cancel() {
      await cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
