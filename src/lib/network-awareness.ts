'use client';

import type { ActionErrorType } from '@/lib/errors';
import { ERROR_CATALOG, isErrorCode, type ErrorCode } from '@/lib/error-catalog';

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

export function getErrorMessageByType(
  errorType: ActionErrorType,
  fallbackMessage: string,
): string {
  if (fallbackMessage.includes('Código:')) {
    return fallbackMessage;
  }

  if (errorType === 'network') {
    return 'No se pudo completar por problemas de conexión. Verifica tu internet e intenta de nuevo. Código: GN002';
  }

  if (errorType === 'auth') {
    return 'Tu sesión expiró o no tienes permisos para realizar esta acción. Código: AU002';
  }

  if (errorType === 'server') {
    return 'Ocurrió un error del servidor. Intenta de nuevo en unos momentos. Código: GN001';
  }

  if (errorType === 'unknown') {
    return 'No se pudo completar la operación. Intenta de nuevo. Código: GN001';
  }

  return `${fallbackMessage} Código: GN001`;
}

function fallbackCodeForType(errorType: ActionErrorType): ErrorCode {
  if (errorType === 'network') {
    return 'GN002';
  }

  if (errorType === 'auth') {
    return 'AU002';
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
  const message = (payload?.error || fallbackMessage).replace(
    /\s*Código:\s*[A-Z]{2}\d{3}\.?$/,
    '',
  );

  return {
    title,
    description: `${message} Código: ${code}`,
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
