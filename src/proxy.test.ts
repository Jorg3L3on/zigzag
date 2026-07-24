/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { REQUEST_ID_HEADER } from '@/lib/request-context';

describe('proxy request correlation', () => {
  it('redirects unauthenticated /dashboard to /login', () => {
    const request = new NextRequest('http://localhost:3069/dashboard');
    const response = proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3069/login');
  });

  it('redirects legacy nested dashboard routes to canonical top-level routes', () => {
    const request = new NextRequest(
      'http://localhost:3069/dashboard/tickets/123/edit?step=review',
    );
    const response = proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3069/tickets/123/edit?step=review',
    );
  });

  it('redirects unauthenticated app routes to /login', () => {
    const request = new NextRequest('http://localhost:3069/tickets');
    const response = proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3069/login');
  });

  it('mints x-request-id on redirects when absent', () => {
    const request = new NextRequest('http://localhost:3069/tickets');
    const response = proxy(request);
    const requestId = response.headers.get(REQUEST_ID_HEADER);
    expect(requestId).toBeTruthy();
    expect(requestId!.length).toBeGreaterThanOrEqual(8);
  });

  it('preserves inbound x-request-id on API passthrough', () => {
    const request = new NextRequest('http://localhost:3069/api/health', {
      headers: { [REQUEST_ID_HEADER]: 'client-supplied-id-99' },
    });
    const response = proxy(request);
    expect(response.status).toBe(200);
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe(
      'client-supplied-id-99',
    );
  });

  it('mints x-request-id for API routes without inbound header', () => {
    const request = new NextRequest('http://localhost:3069/api/health');
    const response = proxy(request);
    expect(response.headers.get(REQUEST_ID_HEADER)).toBeTruthy();
  });
});
