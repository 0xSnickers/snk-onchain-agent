import { isAxiosError } from 'axios';

interface AppApiErrorOptions {
  code?: number | string;
  status?: number;
  details?: unknown;
  cause?: unknown;
}

export class AppApiError extends Error {
  code?: number | string;
  status?: number;
  details?: unknown;
  cause?: unknown;

  constructor(message: string, options: AppApiErrorOptions = {}) {
    super(message);
    this.name = 'AppApiError';
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
    this.cause = options.cause;
  }
}

export function normalizeApiError(error: unknown): AppApiError {
  if (error instanceof AppApiError) {
    return error;
  }

  if (isAxiosError(error)) {
    const data = error.response?.data as { code?: number | string; message?: string } | undefined;

    return new AppApiError(data?.message ?? error.message, {
      code: data?.code ?? error.code,
      status: error.response?.status,
      details: data,
      cause: error,
    });
  }

  if (error instanceof Error) {
    return new AppApiError(error.message, { cause: error });
  }

  return new AppApiError('Unknown API error', { details: error });
}
