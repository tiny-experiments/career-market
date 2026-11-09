import { isApiError, type ApiErrorCode } from "@/lib/api";

/** A failed read in plain words. API codes and messages never reach the reader. */
export interface Failure {
  /** Null when the failure did not come from the API client. */
  readonly code: ApiErrorCode | null;
  /** One sentence for the reader; undefined means the general apology. */
  readonly message: string | undefined;
}

const MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  NETWORK:
    "We couldn't reach Career Market. Check your connection and try again.",
  NOT_READY: "The figures are on their way. Try again in a moment.",
  RATE_LIMITED: "That was a lot of clicks at once. Try again in a moment.",
};

export function describeFailure(cause: unknown): Failure {
  if (!isApiError(cause)) return { code: null, message: undefined };
  return { code: cause.code, message: MESSAGES[cause.code] };
}
