import { hash } from 'bcryptjs';
import {
  assertCompanyEntitlementAllows,
  CompanyEntitlementExceededError,
} from '@/lib/company-entitlement-guard';
import { and, eq, isNull } from 'drizzle-orm';
import { role, user } from '@/db/schema';
import { fail, ok, requireApiPermission } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import {
  recordGovernanceAudit,
  sanitizeUserForAudit,
  sessionUserToGovernanceActor,
} from '@/lib/governance-audit';
import { NextRequest } from 'next/server';
import { z } from 'zod';

export async function GET() {
  try {
    const { session, unauthorized } = await requireApiPermission('users.read');
    if (unauthorized || !session) {
      return unauthorized;
    }

    const isSystemUser = session.user.company_is_system;
    const users = isSystemUser
      ? await db.select().from(user).where(isNull(user.deleted_at))
      : await db
          .select()
          .from(user)
          .where(
            and(
              isNull(user.deleted_at),
              eq(user.company_id, session.user.company_id as number),
            ),
          );

    return ok(users);
  } catch (error) {
    console.error(error);
    return fail('US001', 500, 'server');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Only client-settable fields are accepted. `email_verified_at` and
    // `remember_token` are server-managed and must never come from the client.
    const parsed = z
      .object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8),
        company_id: z.number().int().positive().optional(),
        role_id: z.number().int().positive().optional(),
      })
      .parse(body);

    const { session, companyId, unauthorized } = await requireApiPermission(
      'users.write',
      parsed.company_id,
    );
    if (unauthorized || !session) {
      return unauthorized;
    }

    // resolveWritableCompanyId guarantees non-system callers can only target
    // their own company; system operators target the requested company.
    const targetCompanyId = companyId;
    if (!targetCompanyId) {
      return fail('AU002', 400, 'auth');
    }

    if (parsed.role_id !== undefined) {
      const roleRow = await db.query.role.findFirst({
        where: and(eq(role.id, parsed.role_id), isNull(role.deleted_at)),
      });
      // The assigned role must belong to the target company or be global.
      if (
        !roleRow ||
        (roleRow.company_id !== null && roleRow.company_id !== targetCompanyId)
      ) {
        return fail('US005', 400, 'validation');
      }
    }

    await assertCompanyEntitlementAllows(targetCompanyId, 'users');

    const hashedPassword = await hash(parsed.password, 10);

    const [created] = await db
      .insert(user)
      .values({
        name: parsed.name,
        email: parsed.email,
        company_id: targetCompanyId,
        role_id: parsed.role_id ?? null,
        password: hashedPassword,
      })
      .returning();

    await recordGovernanceAudit(db, {
      actor: sessionUserToGovernanceActor(session.user),
      resourceType: 'user',
      resourceId: created.id,
      targetCompanyId: targetCompanyId,
      eventType: 'created',
      after: sanitizeUserForAudit(created),
    });

    return ok(created, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return fail('US005', 400, 'validation');
    }
    if (e instanceof CompanyEntitlementExceededError) {
      return fail('CO011', 403, 'validation');
    }
    console.error(e);
    return fail('US002', 500, 'server');
  }
}
