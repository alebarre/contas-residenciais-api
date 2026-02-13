import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error';
import type { ErrorResponse } from '../errors/error-response';

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err, req, reply) => {
    const now = new Date().toISOString();
    const defaultStatus = (err as any).statusCode ?? 500;

    let status = defaultStatus;
    let code = 'UNEXPECTED_ERROR';
    let error = 'INTERNAL_ERROR';
    let message = 'Erro inesperado';
    let fieldErrors: { field: string; message: string }[] | undefined;

    if (err instanceof AppError) {
      status = err.status;
      code = err.code;
      error = err.error;
      message = err.message;
      fieldErrors = err.fieldErrors;
    } else if (err instanceof ZodError) {
      status = 400;
      code = 'REQ_BODY_INVALID';
      error = 'VALIDATION_ERROR';
      message = 'Payload inválido';
      fieldErrors = err.issues.map((i) => ({
        field: i.path.join('.') || 'body',
        message: i.message
      }));
    } else if (defaultStatus === 400) {
      status = 400;
      code = 'REQ_BODY_INVALID';
      error = 'VALIDATION_ERROR';
      message = 'Payload inválido';
    }

    const body: ErrorResponse = {
      status,
      error,
      message,
      timestamp: now,
      path: req.url,
      code,
      ...(fieldErrors ? { fieldErrors } : {})
    };

    req.log.error({ err }, 'request error');
    reply.status(status).send(body);
  });
}
