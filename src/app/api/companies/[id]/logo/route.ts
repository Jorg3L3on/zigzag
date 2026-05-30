import { and, eq, isNull } from 'drizzle-orm';
import { company, user } from '@/db/schema';
import { fail, ok, requireApiPermission } from '@/lib/api-helpers';
import { parseCompanyLogoFile } from '@/lib/company-logo-upload';
import {
  deleteCompanyLogoBlob,
  uploadCompanyLogoBlob,
} from '@/lib/company-logo-blob';
import { db } from '@/lib/db';
import { ValidationError } from '@/lib/errors';
import {
  recordGovernanceAudit,
  sessionUserToGovernanceActor,
} from '@/lib/governance-audit';

type RouteParams = {
  params: Promise<{ id: string }>;
};

const loadWritableCompanyForApi = async (
  companyId: number,
  sessionUserId: string,
) => {
  const sessionUser = await db.query.user.findFirst({
    where: and(eq(user.id, BigInt(sessionUserId)), isNull(user.deleted_at)),
    with: { company: true },
  });

  if (
    !sessionUser ||
    sessionUser.company?.deleted_at ||
    !sessionUser.company?.is_system
  ) {
    return { error: fail('AU002', 403, 'auth') as Response };
  }

  const row = await db.query.company.findFirst({
    where: and(eq(company.id, companyId), isNull(company.deleted_at)),
  });

  if (!row || row.is_system) {
    return { error: fail('CO006', 404, 'validation') as Response };
  }

  return { row };
};

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const companyId = Number.parseInt(id, 10);
    if (Number.isNaN(companyId)) {
      return fail('CO007', 400, 'validation');
    }

    const { session, unauthorized } = await requireApiPermission(
      'companies.write',
      companyId,
    );
    if (unauthorized || !session) {
      return unauthorized;
    }

    const access = await loadWritableCompanyForApi(companyId, session.user.id);
    if (access.error) {
      return access.error;
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return fail('CO010', 400, 'validation');
    }

    const parsed = await parseCompanyLogoFile(file);
    const logoUrl = await uploadCompanyLogoBlob(
      companyId,
      parsed.buffer,
      parsed.contentType,
    );

    if (access.row!.logo) {
      await deleteCompanyLogoBlob(access.row!.logo);
    }

    const [updated] = await db
      .update(company)
      .set({ logo: logoUrl, updated_at: new Date() })
      .where(and(eq(company.id, companyId), isNull(company.deleted_at)))
      .returning();

    await recordGovernanceAudit(db, {
      actor: sessionUserToGovernanceActor(session.user),
      resourceType: 'company',
      resourceId: companyId,
      targetCompanyId: companyId,
      eventType: 'logo_uploaded',
      before: { logo: access.row!.logo },
      after: { logo: updated.logo },
    });

    return ok(updated);
  } catch (error) {
    if (error instanceof ValidationError) {
      return fail('CO010', 400, 'validation');
    }
    console.error(error);
    return fail('CO010', 500, 'server');
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const companyId = Number.parseInt(id, 10);
    if (Number.isNaN(companyId)) {
      return fail('CO007', 400, 'validation');
    }

    const { session, unauthorized } = await requireApiPermission(
      'companies.write',
      companyId,
    );
    if (unauthorized || !session) {
      return unauthorized;
    }

    const access = await loadWritableCompanyForApi(companyId, session.user.id);
    if (access.error) {
      return access.error;
    }

    if (access.row!.logo) {
      await deleteCompanyLogoBlob(access.row!.logo);
    }

    const [updated] = await db
      .update(company)
      .set({ logo: null, updated_at: new Date() })
      .where(and(eq(company.id, companyId), isNull(company.deleted_at)))
      .returning();

    await recordGovernanceAudit(db, {
      actor: sessionUserToGovernanceActor(session.user),
      resourceType: 'company',
      resourceId: companyId,
      targetCompanyId: companyId,
      eventType: 'logo_removed',
      before: { logo: access.row!.logo },
      after: { logo: null },
    });

    return ok(updated);
  } catch (error) {
    console.error(error);
    return fail('CO004', 500, 'server');
  }
}
