import type { FieldError } from './error-response';

export class AppError extends Error {
  status: number;
  code: string;
  error: string;
  fieldErrors?: FieldError[];

  constructor(params: {
    status: number;
    code: string;
    message: string;
    error?: string;
    fieldErrors?: FieldError[];
  }) {
    super(params.message);
    this.status = params.status;
    this.code = params.code;
    this.error = params.error ?? 'BUSINESS_ERROR';
    this.fieldErrors = params.fieldErrors;
  }
}
