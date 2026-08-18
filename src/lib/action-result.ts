import type { PublicErrorPayload } from '@/lib/error-catalog';

export type ActionSuccess<T> = { success: true; data: T };

export type ActionFailure = { success: false } & PublicErrorPayload;

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
