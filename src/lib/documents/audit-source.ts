/**
 * The trailing `source` argument for recordTicketAudit: nothing for the app's
 * own actions (its default, so their calls stay as they were), `'api'` for
 * agent writes (ZIG-I23-6).
 */
export const auditSourceArg = (via?: 'action' | 'api'): ['api'] | [] =>
  via === 'api' ? ['api'] : [];
