import {
  DEMO_ADMIN_EMAIL,
  DEMO_COMPANY_NAME,
  DEMO_SHOWCASE_CLIENT_NAME,
  DEMO_SHOWCASE_TICKET_ID,
} from './demo-company';

describe('demo-company constants', () => {
  it('defines the showcase tenant identity', () => {
    expect(DEMO_COMPANY_NAME).toBe('ClimaTotal Demo');
    expect(DEMO_ADMIN_EMAIL).toBe('demo@zigzag.app');
    expect(DEMO_SHOWCASE_CLIENT_NAME).toBe('Hotel Riviera Dorada');
    expect(DEMO_SHOWCASE_TICKET_ID).toBe(1000n);
  });
});
