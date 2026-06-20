/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

describe('proxy', () => {
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
});
