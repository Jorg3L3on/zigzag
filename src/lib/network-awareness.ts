'use client';

import {
  isActionFailure,
  type ActionFailure,
} from '@/lib/action-result';
import type { ActionErrorType } from '@/lib/errors';
import { splitErrorCode } from '@/lib/error-code-display';
import { ERROR_CATALOG, isErrorCode, type ErrorCode } from '@/lib/error-catalog';
import { logSupportCode } from '@/lib/support-code-log';

type NetworkErrorCandidate = {
  code?: string;
  cause?: {
    code?: string;
  };
  message?: string;
};

export type PublicErrorResponse = {
  error?: string;
  errorCode?: string;
  errorTitle?: string;
  errorType?: ActionErrorType;
};

export type ToastErrorContent = {
  title: string;
  description: string;
  errorType: ActionErrorType;
};

const NETWORK_ERROR_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ECONNRESET',
  'ETIMEDOUT',
  'ERR_NETWORK',
]);

const NETWORK_ERROR_MESSAGES = [
  'failed to fetch',
  'networkerror',
  'network error',
  'load failed',
];

export function getIsOnline(): boolean {
  if (typeof navigator === 'undefined') {
    return true;
  }

  return navigator.onLine;
}

export function isLikelyNetworkError(error: unknown): boolean {
  if (!getIsOnline()) {
    return true;
  }

  const candidate = error as NetworkErrorCandidate;
  const errorCode = candidate?.code ?? candidate?.cause?.code;
  if (errorCode && NETWORK_ERROR_CODES.has(errorCode)) {
    return true;
  }

  const message = candidate?.message?.toLowerCase();
  if (!message) {
    return false;
  }

  return NETWORK_ERROR_MESSAGES.some((value) => message.includes(value));
}

export function classifyClientError(
  error: unknown,
  statusCode?: number,
  serverErrorType?: ActionErrorType,
): ActionErrorType {
  if (serverErrorType) {
    return serverErrorType;
  }

  if (isLikelyNetworkError(error)) {
    return 'network';
  }

  if (statusCode === 401 || statusCode === 403) {
    return 'auth';
  }

  if (statusCode === 400 || statusCode === 404 || statusCode === 409) {
    return 'validation';
  }

  if (typeof statusCode === 'number' && statusCode >= 500) {
    return 'server';
  }

  return 'unknown';
}

/** Spanish for the screen. Any support code in the text is logged and dropped. */
const withoutSupportCode = (message: string): string => {
  const split = splitErrorCode(message);
  logSupportCode(split.code);
  return split.message;
};

export function getErrorMessageByType(
  errorType: ActionErrorType,
  fallbackMessage: string,
): string {
  if (fallbackMessage.includes('Código:')) {
    return withoutSupportCode(fallbackMessage);
  }

  if (errorType === 'network') {
    return withoutSupportCode(
      'No se pudo completar por problemas de conexión. Verifica tu internet e intenta de nuevo. Código: GN002',
    );
  }

  if (errorType === 'auth') {
    return withoutSupportCode(
      'Tu sesión expiró o no tienes permisos para realizar esta acción. Código: AU002',
    );
  }

  if (errorType === 'server') {
    return withoutSupportCode(
      'Ocurrió un error del servidor. Intenta de nuevo en unos momentos. Código: GN001',
    );
  }

  if (errorType === 'validation') {
    return withoutSupportCode('Revisa los campos marcados e intenta de nuevo. Código: GN003');
  }

  if (errorType === 'unknown') {
    return withoutSupportCode(
      'No se pudo completar la operación. Intenta de nuevo. Código: GN001',
    );
  }

  return withoutSupportCode(`${fallbackMessage} Código: GN003`);
}

function fallbackCodeForType(errorType: ActionErrorType): ErrorCode {
  if (errorType === 'network') {
    return 'GN002';
  }

  if (errorType === 'auth') {
    return 'AU002';
  }

  if (errorType === 'validation') {
    return 'GN003';
  }

  return 'GN001';
}

export function buildToastErrorContent(
  payload: PublicErrorResponse | null | undefined,
  fallbackMessage: string,
  fallbackType?: ActionErrorType,
): ToastErrorContent {
  const errorType = classifyClientError(
    null,
    undefined,
    payload?.errorType ?? fallbackType,
  );
  const code = isErrorCode(payload?.errorCode)
    ? payload.errorCode
    : fallbackCodeForType(errorType);
  const catalogEntry = ERROR_CATALOG[code];
  const title = payload?.errorTitle || catalogEntry.title;
  const message = splitErrorCode(payload?.error || fallbackMessage).message;
  logSupportCode(code);

  return {
    title,
    description: message,
    errorType,
  };
}

export function getErrorDisplayMessage(
  payload: PublicErrorResponse | null | undefined,
  fallbackMessage: string,
  fallbackType?: ActionErrorType,
): string {
  const content = buildToastErrorContent(payload, fallbackMessage, fallbackType);
  return `${content.title}. ${content.description}`;
}

export function presentActionError(
  result: ActionFailure | PublicErrorResponse | null | undefined,
  fallbackMessage: string,
  fallbackType?: ActionErrorType,
): ToastErrorContent {
  return buildToastErrorContent(result, fallbackMessage, fallbackType);
}

export function toastActionFailure(
  result: { success: boolean } | null | undefined,
  fallbackMessage: string,
  fallbackType?: ActionErrorType,
): ToastErrorContent | null {
  if (!isActionFailure(result)) {
    return null;
  }
  return presentActionError(result, fallbackMessage, fallbackType);
}
