import { AppError } from './errors.ts';
export class NotReadyError extends AppError {
  constructor() {
    super(503, 'NOT_READY', 'Market data is not available yet');
  }
}
export class NotFoundError extends AppError {
  constructor(_message?: string) {
    super(404, 'NOT_FOUND', 'Resource not found');
  }
}
