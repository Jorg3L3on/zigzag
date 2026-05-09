export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

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

// Error handler for API routes
export function handleApiError(error: unknown) {
  console.error('API Error:', error);

  if (error instanceof AppError) {
    return {
      error: error.message,
      statusCode: error.statusCode,
    };
  }

  if (error instanceof Error) {
    return {
      error: error.message,
      statusCode: 500,
    };
  }

  return {
    error: 'An unexpected error occurred',
    statusCode: 500,
  };
}

// Error handler for server actions
export function handleServerActionError(error: unknown) {
  console.error('Server Action Error:', error);
  const errorType = classifyServerErrorType(error);

  if (error instanceof AppError) {
    return {
      success: false,
      error: error.message,
      errorType,
    };
  }

  if (error instanceof Error) {
    return {
      success: false,
      error: error.message,
      errorType,
    };
  }

  return {
    success: false,
    error: 'An unexpected error occurred',
    errorType,
  };
}
