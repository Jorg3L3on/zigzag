import type { PublicErrorPayload } from '@/lib/error-catalog';

export type ActionSuccess<T> = { success: true; data: T };

/** One rejected field of a validated input: where it is and what is wrong (ZIG-I12). */
export type ValidationIssue = {
  path: Array<string | number>;
  code: string;
  message: string;
};

export type ActionFailure = {
  success: false;
  /** Present on validation failures of composer inputs, so the UI can mark the line and field. */
  issues?: ValidationIssue[];
} & PublicErrorPayload;

export type ActionResult<T = void> = T extends void
  ? ActionSuccess<undefined> | ActionFailure
  : ActionSuccess<T> | ActionFailure;

export type ApiSuccess<T> = { success: true; data: T };

export type ApiFailure = { success: false } & PublicErrorPayload;

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export const isActionFailure = (
  result: { success: boolean } | null | undefined,
): result is ActionFailure =>
  result != null && result.success === false;

export const isActionSuccess = <T>(
  result: ActionResult<T> | null | undefined,
): result is Extract<ActionResult<T>, { success: true }> =>
  result != null && result.success === true;
