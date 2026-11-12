/**
 * @jest-environment node
 *
 * Needs a migrated, disposable Postgres. Skipped unless OPERATOR_DB_TEST=1:
 *   OPERATOR_DB_TEST=1 DATABASE_URL=<scratch db> npx jest src/lib/company-operator-fleet-loader.db.test.ts
 */
import { inArray } from 'drizzle-orm';
import { auditEvent, company, user } from '@/db/schema';
import { db } from '@/lib/db';
import { loadCompanyOperatorFleet } from '@/lib/company-operator-fleet-loader';
import { loadCompanyOperatorSummary } from '@/lib/company-operator-summary-loader';

const enabled = process.env.OPERATOR_DB_TEST === '1';
const describeDb = enabled ? describe : describe.skip;

describeDb('operator fleet loader (real Postgres, ZIG-I38-1)', () => {
  const suffix = `${Date.now()}`;
  const companyIds: number[] = [];
  const userIds: bigint[] = [];
  const now = new Date();
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000);
  let tenantId = 0;
  let operatorCompanyId = 0;
  let email = '';

  beforeAll(async () => {
    const [tenant] = await db
      .insert(company)
      .values({
        name: `Fleet test ${suffix}`, phone: '5550000000', email: `fleet-${suffix}@test.local`,
        street: 'x', exterior_number: '1', neighborhood: 'x', city: 'x', state: 'x', country: 'MX',
        postal_code: '00000', status: 'ACTIVE', settings: { rfc: 'RFC-DE-PRUEBA', default_currency: 'MXN' },
      })
      .returning({ id: company.id });
    tenantId = tenant.id;
    companyIds.push(tenantId);
    const system = await db.query.company.findFirst({ where: (c, { eq }) => eq(c.is_system, true) });
    operatorCompanyId = system!.id;

    email = `luis-${suffix}@test.local`;
    const [person] = await db
      .insert(user)
      .values({ name: 'Luis Prueba', email, password: 'x', company_id: tenantId })
      .returning({ id: user.id });
    userIds.push(person.id);

    await db.insert(auditEvent).values([
      // The company user signed in 3 hours ago.
      { occurred_at: minutesAgo(180), actor_user_id: person.id, actor_company_id: tenantId, target_company_id: tenantId,
        resource_type: 'auth', action: 'signed_in', result: 'success', source: 'auth' },
      // The operator acted on the company a minute ago (must not count as «último acceso»).
      { occurred_at: minutesAgo(1), actor_company_id: operatorCompanyId, target_company_id: tenantId,
        resource_type: 'company', resource_id: String(tenantId), action: 'updated', result: 'success', source: 'action',
        payload: { before: { status: 'ACTIVE' }, after: { status: 'ACTIVE' } } },
      // A single failed sign-in two days ago: no alert.
      { occurred_at: minutesAgo(2 * 24 * 60), resource_type: 'auth', resource_id: email, action: 'sign_in_failed',
        result: 'failed', source: 'auth' },
    ]);
  });

  afterAll(async () => {
    await db.delete(auditEvent).where(inArray(auditEvent.target_company_id, companyIds));
    await db.delete(auditEvent).where(inArray(auditEvent.resource_id, [email]));
    await db.delete(user).where(inArray(user.id, userIds));
    await db.delete(company).where(inArray(company.id, companyIds));
  });

  const row = async () => (await loadCompanyOperatorFleet(now)).find((r) => r.id === tenantId)!;

  it('reads the last sign-in of a company user, not the operator action (E11)', async () => {
    const fleetRow = await row();
    expect(fleetRow.lastSignInAt).toBe(minutesAgo(180).toISOString());
    expect(fleetRow.peopleCount).toBe(1);
    expect(fleetRow.alert).toBeNull();
    expect(fleetRow.needsAttention).toBe(false);
  });

  it('raises an alert on 5 failed sign-ins of one account in 15 minutes (E12)', async () => {
    await db.insert(auditEvent).values(
      [14, 11, 8, 5, 2].map((m) => ({
        occurred_at: minutesAgo(m), resource_type: 'auth', resource_id: email, action: 'sign_in_failed',
        result: 'failed', source: 'auth',
      })),
    );
    const fleetRow = await row();
    expect(fleetRow.alert).toMatchObject({ kind: 'sign_in_burst', account: email, count: 5 });
    expect(fleetRow.attention[0]?.id).toBe('alert');

    const summary = await loadCompanyOperatorSummary(tenantId, now);
    expect(summary?.alert?.kind).toBe('sign_in_burst');
    expect(summary?.neverSignedInCount).toBe(0);
  });
});
