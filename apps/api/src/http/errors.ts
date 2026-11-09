export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'NOT_READY'
  | 'RATE_LIMITED'
  | 'ORIGIN_NOT_ALLOWED'
  | 'SOURCE_UNAVAILABLE'
  | 'INTERNAL';
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details: { fields?: Readonly<Record<string, string>> } = {},
  ) {
    super(message);
    this.name = 'AppError';
  }
}
export const notFound = () =>
  new AppError(404, 'NOT_FOUND', 'Resource not found');
export const notReady = () =>
  new AppError(503, 'NOT_READY', 'Market data is not available yet');
export const sourceUnavailable = () =>
  new AppError(
    503,
    'SOURCE_UNAVAILABLE',
    'Roles could not be loaded. Try again shortly.',
  );
export const validationFailed = (fields: Record<string, string>) =>
  new AppError(400, 'VALIDATION_FAILED', 'Request validation failed', {
    fields,
  });
export const originNotAllowed = () =>
  new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Origin not allowed');
