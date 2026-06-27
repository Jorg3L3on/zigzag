'use server';

import { and, eq, isNull } from 'drizzle-orm';
import QRCode from 'qrcode';
import { user } from '@/db/schema';
import { db } from '@/lib/db';
import { requireActionAuth } from '@/lib/security';
import {
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import { buildOtpAuthUri, generateTotpSecret, verifyTotp } from '@/lib/totp';
import { revalidatePath } from 'next/cache';

const loadOwnUser = async (userId: string) =>
  db.query.user.findFirst({
    where: and(eq(user.id, BigInt(userId)), isNull(user.deleted_at)),
  });

export async function getTwoFactorStatus(): Promise<{
  success: boolean;
  data?: { enabled: boolean };
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const context = await requireActionAuth();
    const row = await loadOwnUser(context.userId);
    return { success: true, data: { enabled: Boolean(row?.two_factor_enabled) } };
  } catch (e) {
    return handleCodedServerActionError('2fa.status', 'US001', e);
  }
}

/**
 * Begin TOTP enrollment: generates a fresh secret, stores it (disabled until
 * confirmed), and returns the provisioning URI + QR data URL for the user to
 * scan in an authenticator app.
 */
export async function startTwoFactorEnrollment(): Promise<{
  success: boolean;
  data?: { secret: string; otpauthUri: string; qrDataUrl: string };
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const context = await requireActionAuth();
    const row = await loadOwnUser(context.userId);
    if (!row) {
      return handleCodedServerActionError(
        '2fa.start',
        'US001',
        new Error('User not found'),
      );
    }

    const secret = generateTotpSecret();
    const otpauthUri = buildOtpAuthUri(secret, row.email);
    const qrDataUrl = await QRCode.toDataURL(otpauthUri);

    await db
      .update(user)
      .set({
        two_factor_secret: secret,
        two_factor_enabled: false,
        updated_at: new Date(),
      })
      .where(eq(user.id, BigInt(context.userId)));

    return { success: true, data: { secret, otpauthUri, qrDataUrl } };
  } catch (e) {
    return handleCodedServerActionError('2fa.start', 'US003', e);
  }
}

export async function confirmTwoFactorEnrollment(code: string): Promise<{
  success: boolean;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const context = await requireActionAuth();
    const row = await loadOwnUser(context.userId);
    if (!row?.two_factor_secret) {
      return { success: false, error: 'No hay una inscripción pendiente', errorType: 'validation' };
    }

    if (!verifyTotp(code, row.two_factor_secret)) {
      return { success: false, error: 'Código inválido', errorType: 'validation' };
    }

    await db
      .update(user)
      .set({ two_factor_enabled: true, updated_at: new Date() })
      .where(eq(user.id, BigInt(context.userId)));

    revalidatePath('/account');
    return { success: true };
  } catch (e) {
    return handleCodedServerActionError('2fa.confirm', 'US003', e);
  }
}

export async function disableTwoFactor(code: string): Promise<{
  success: boolean;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const context = await requireActionAuth();
    const row = await loadOwnUser(context.userId);
    if (!row?.two_factor_enabled || !row.two_factor_secret) {
      return { success: true };
    }

    if (!verifyTotp(code, row.two_factor_secret)) {
      return { success: false, error: 'Código inválido', errorType: 'validation' };
    }

    await db
      .update(user)
      .set({
        two_factor_enabled: false,
        two_factor_secret: null,
        updated_at: new Date(),
      })
      .where(eq(user.id, BigInt(context.userId)));

    revalidatePath('/account');
    return { success: true };
  } catch (e) {
    return handleCodedServerActionError('2fa.disable', 'US003', e);
  }
}
