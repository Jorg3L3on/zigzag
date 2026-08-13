export type OperatorAttentionSignal = {
  id: 'readiness' | 'incident' | 'auth_blocked';
  label: string;
  tone: 'warning' | 'destructive' | 'secondary';
};

export type OperatorAttentionInput = {
  productionReady: boolean;
  missingCount: number;
  missingLabels: string[];
  allowsAuthentication: boolean;
  lastIncidentAt: string | null;
  lastIncidentLabel: string | null;
  /** ISO timestamp; incidents older than this window are ignored. */
  now?: Date;
  incidentWindowMs?: number;
};

const DEFAULT_INCIDENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const buildOperatorAttentionSignals = (
  input: OperatorAttentionInput,
): OperatorAttentionSignal[] => {
  const signals: OperatorAttentionSignal[] = [];
  const now = input.now ?? new Date();
  const windowMs = input.incidentWindowMs ?? DEFAULT_INCIDENT_WINDOW_MS;

  if (!input.productionReady && input.missingCount > 0) {
    const first = input.missingLabels[0];
    signals.push({
      id: 'readiness',
      label:
        input.missingCount === 1 && first
          ? `Falta: ${first}`
          : `${input.missingCount} pendientes de go-live`,
      tone: 'warning',
    });
  }

  if (input.lastIncidentAt) {
    const occurred = new Date(input.lastIncidentAt).getTime();
    if (
      Number.isFinite(occurred) &&
      now.getTime() - occurred <= windowMs
    ) {
      signals.push({
        id: 'incident',
        label: input.lastIncidentLabel
          ? `Incidente: ${input.lastIncidentLabel}`
          : 'Incidente reciente',
        tone: 'destructive',
      });
    }
  }

  if (!input.allowsAuthentication) {
    signals.push({
      id: 'auth_blocked',
      label: 'Acceso de usuarios bloqueado',
      tone: 'destructive',
    });
  }

  return signals.slice(0, 3);
};
