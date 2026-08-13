export const parseOptionalInt = (value: string | null): number | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

export const parseOptionalDate = (value: string | null): Date | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export const parseAuditListFilters = (url: URL) => {
  const search = url.searchParams.get('search') ?? '';
  const incidentsParam =
    url.searchParams.get('incidents_only') ?? url.searchParams.get('incidents');
  const filters = {
    targetCompanyId: parseOptionalInt(url.searchParams.get('target_company_id')),
    actorUserId: url.searchParams.get('actor_user_id') ?? undefined,
    resourceType: url.searchParams.get('resource_type') ?? undefined,
    resourceId: url.searchParams.get('resource_id') ?? undefined,
    action: url.searchParams.get('action') ?? undefined,
    result: url.searchParams.get('result') ?? undefined,
    incidentsOnly:
      incidentsParam === '1' || incidentsParam === 'true' ? true : undefined,
    from: parseOptionalDate(url.searchParams.get('from')),
    to: parseOptionalDate(url.searchParams.get('to')),
    cursor: parseOptionalInt(url.searchParams.get('cursor')),
    limit: parseOptionalInt(url.searchParams.get('limit')),
  };
  return { search, filters };
};
