export type InvalidGrantReason =
  | 'not_found'
  | 'expired'
  | 'redirect'
  | 'client'
  | 'pkce'
  | 'resource'
  | 'other';

export class OAuthInvalidGrantError extends Error {
  readonly reason: InvalidGrantReason;

  constructor(reason: InvalidGrantReason, message = 'invalid_grant') {
    super(message);
    this.name = 'OAuthInvalidGrantError';
    this.reason = reason;
  }
}

export const isOAuthInvalidGrantError = (
  error: unknown,
): error is OAuthInvalidGrantError => error instanceof OAuthInvalidGrantError;
