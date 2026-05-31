import {
  getErrorCatalogEntry,
  isErrorCode,
  type ErrorCode,
  type PublicErrorPayload,
} from '@/lib/error-catalog';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorCode?: ErrorCode;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    errorCode?: ErrorCode,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errorCode = errorCode;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

export type ActionErrorType =
  | 'network'
  | 'auth'
  | 'validation'
  | 'server'
  | 'unknown';

export type CodedActionError = {
  success: false;
} & PublicErrorPayload;

type NetworkErrorCandidate = {
  code?: string;
  cause?: {
    code?: string;
  };
};

const NETWORK_ERROR_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ECONNRESET',
  'ETIMEDOUT',
  'ERR_NETWORK',
]);

export function classifyServerErrorType(error: unknown): ActionErrorType {
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
    return 'auth';
  }

  if (
    error instanceof ValidationError ||
    error instanceof NotFoundError ||
    error instanceof ConflictError
  ) {
    return 'validation';
  }

  if (error instanceof AppError && error.statusCode >= 500) {
    return 'server';
  }

  const candidate = error as NetworkErrorCandidate;
  const errorCode = candidate?.code ?? candidate?.cause?.code;
  if (errorCode && NETWORK_ERROR_CODES.has(errorCode)) {
    return 'network';
  }

  if (error instanceof Error) {
    return 'server';
  }

  return 'unknown';
}

function resolvePublicErrorType(
  code: ErrorCode,
  cause?: unknown,
): ActionErrorType {
  const catalogType = getErrorCatalogEntry(code).type;
  if (cause === undefined || cause === null) {
    return catalogType;
  }

  const classifiedType = classifyServerErrorType(cause);
  if (classifiedType === 'unknown') {
    return catalogType;
  }

  return classifiedType;
}

function fallbackCodeForServerError(
  errorType: ActionErrorType,
  cause?: unknown,
): ErrorCode {
  if (errorType === 'network') {
    return 'GN002';
  }

  if (errorType === 'validation') {
    return 'GN003';
  }

  if (errorType === 'auth') {
    return cause instanceof AuthenticationError ? 'AU001' : 'AU002';
  }

  return 'GN001';
}

export function buildPublicError(
  code: ErrorCode,
  cause?: unknown,
  errorType?: ActionErrorType,
): PublicErrorPayload {
  const entry = getErrorCatalogEntry(code);
  const customMessage =
    cause instanceof AppError &&
    cause.errorCode === code &&
    cause.message.trim()
      ? cause.message.trim()
      : entry.message;

  return {
    error: `${customMessage} Código: ${entry.code}`,
    errorCode: entry.code as ErrorCode,
    errorTitle: entry.title,
    errorType: errorType ?? resolvePublicErrorType(code, cause),
  };
}

export function buildActionError(
  code: ErrorCode,
  cause?: unknown,
  errorType?: ActionErrorType,
): CodedActionError {
  return {
    success: false,
    ...buildPublicError(code, cause, errorType),
  };
}

export function logServerError(
  operation: string,
  code: ErrorCode,
  cause: unknown,
) {
  console.error(`[${code}] ${operation}`, cause);
}

export function handleCodedServerActionError(
  operation: string,
  code: ErrorCode,
  cause: unknown,
): CodedActionError {
  logServerError(operation, code, cause);
  return buildActionError(code, cause);
}

// Error handler for API routes
export function handleApiError(error: unknown) {
  console.error('API Error:', error);

  if (error instanceof AppError) {
    if (error.errorCode) {
      return {
        ...buildPublicError(error.errorCode, error),
        statusCode: error.statusCode,
      };
    }

    return {
      ...buildPublicError(
        fallbackCodeForServerError(classifyServerErrorType(error), error),
        error,
      ),
      statusCode: error.statusCode,
    };
  }

  if (error instanceof Error) {
    return {
      ...buildPublicError(
        fallbackCodeForServerError(classifyServerErrorType(error), error),
        error,
      ),
      statusCode: 500,
    };
  }

  return {
    ...buildPublicError(
      fallbackCodeForServerError(classifyServerErrorType(error), error),
      error,
    ),
    statusCode: 500,
  };
}

// Error handler for server actions
export function handleServerActionError(error: unknown) {
  console.error('Server Action Error:', error);
  const errorType = classifyServerErrorType(error);

  if (error instanceof AppError) {
    if (error.errorCode) {
      return buildActionError(error.errorCode, error);
    }

    return buildActionError(
      fallbackCodeForServerError(errorType, error),
      error,
      errorType,
    );
  }

  if (error instanceof Error) {
    return buildActionError(
      fallbackCodeForServerError(errorType, error),
      error,
      errorType,
    );
  }

  return buildActionError(
    fallbackCodeForServerError(errorType, error),
    error,
    errorType,
  );
}

export function coerceErrorCode(value: unknown, fallback: ErrorCode): ErrorCode {
  return isErrorCode(value) ? value : fallback;
}
