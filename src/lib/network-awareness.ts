'use client';

import type { ActionErrorType } from '@/lib/errors';

type NetworkErrorCandidate = {
  code?: string;
  cause?: {
    code?: string;
  };
  message?: string;
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
  if (errorType === 'network') {
    return 'No se pudo completar por problemas de conexión. Verifica tu internet e intenta de nuevo.';
  }

  if (errorType === 'auth') {
    return 'Tu sesión expiró o no tienes permisos para realizar esta acción.';
  }

  if (errorType === 'server') {
    return 'Ocurrió un error del servidor. Intenta de nuevo en unos momentos.';
  }

  if (errorType === 'unknown') {
    return 'No se pudo completar la operación. Intenta de nuevo.';
  }

  return fallbackMessage;
}
