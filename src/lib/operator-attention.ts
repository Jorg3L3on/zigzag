import type { CompanyLifecycleStatus } from '@/db/schema';
import type { OperatorSecurityAlert } from '@/lib/operator-sign-in-burst';

/** «Sin uso»: an active company where nobody signed in for this many days. */
export const OPERATOR_UNUSED_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export type OperatorAttentionReasonId =
  | 'alert'
  | 'missing_profile'
  | 'ready_to_activate'
  | 'unused';

export type OperatorAttentionReason = {
  id: OperatorAttentionReasonId;
  /** Short pill text. */
  label: string;
  /** One line saying why. */
  detail: string;
  tone: 'red' | 'amber' | 'blue' | 'slate';
};

export type OperatorAttentionInput = {
  lifecycle: CompanyLifecycleStatus;
  profileMissing: number;
  alert: OperatorSecurityAlert | null;
  lastSignInAt: string | null;
  createdAt?: string | null;
  now?: Date;
  unusedDays?: number;
};

/**
 * Why a company needs the operator (ZIG-I38): a live security alert, missing
 * profile data, ready to activate, or unused. Ordered by severity; empty means
 * «Al día». Archived companies never need attention.
 */
export const resolveOperatorAttention = (
  input: OperatorAttentionInput,
): OperatorAttentionReason[] => {
  const reasons: OperatorAttentionReason[] = [];
  if (input.lifecycle === 'ARCHIVED') {
    return reasons;
  }
  const now = input.now ?? new Date();

  if (input.alert) {
    reasons.push({
      id: 'alert',
      label: 'Alerta de seguridad',
      detail: input.alert.account
        ? `${input.alert.label} · ${input.alert.account}`
        : input.alert.label,
      tone: 'red',
    });
  }

  if (input.lifecycle === 'SETUP' || input.lifecycle === 'ACTIVE') {
    if (input.profileMissing > 0) {
      reasons.push({
        id: 'missing_profile',
        label:
          input.profileMissing === 1
            ? 'Falta 1 dato'
            : `Faltan ${input.profileMissing} datos`,
        detail: 'Perfil de la empresa incompleto',
        tone: 'amber',
      });
    } else if (input.lifecycle === 'SETUP') {
      reasons.push({
        id: 'ready_to_activate',
        label: 'Lista para activar',
        detail: 'Perfil completo, sigue en configuración',
        tone: 'blue',
      });
    }
  }

  if (input.lifecycle === 'ACTIVE') {
    const days = input.unusedDays ?? OPERATOR_UNUSED_DAYS;
    const last = input.lastSignInAt ? new Date(input.lastSignInAt).getTime() : null;
    const created = input.createdAt ? new Date(input.createdAt).getTime() : null;
    const reference = last ?? created;
    const idle =
      reference == null || !Number.isFinite(reference)
        ? true
        : now.getTime() - reference > days * DAY_MS;
    if (idle) {
      reasons.push({
        id: 'unused',
        label: 'Sin uso',
        detail: last
          ? `Nadie ha entrado en más de ${days} días`
          : 'Nadie ha entrado todavía',
        tone: 'slate',
      });
    }
  }

  return reasons;
};
