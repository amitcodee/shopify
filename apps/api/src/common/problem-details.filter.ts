import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ProblemDetails } from '@repo/contracts';
import { Prisma } from '@repo/db';
import type { Response } from 'express';

const REASONS: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

function fromHttpException(exception: HttpException): ProblemDetails {
  const status = exception.getStatus();
  const body = exception.getResponse();
  const problem: ProblemDetails = {
    type: 'about:blank',
    title: REASONS[status] ?? 'Error',
    status,
  };
  if (typeof body === 'string') {
    problem.detail = body;
  } else if (typeof body === 'object' && body !== null) {
    const record = body as Record<string, unknown>;
    if (typeof record.title === 'string') problem.title = record.title;
    if (typeof record.detail === 'string') problem.detail = record.detail;
    else if (typeof record.message === 'string') problem.detail = record.message;
    if (Array.isArray(record.errors)) problem.errors = record.errors as ProblemDetails['errors'];
  }
  return problem;
}

export function toProblem(exception: unknown): ProblemDetails {
  if (exception instanceof HttpException) return fromHttpException(exception);
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    if (exception.code === 'P2002') {
      return {
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail: 'A record with this value already exists.',
      };
    }
    if (exception.code === 'P2025') {
      return { type: 'about:blank', title: 'Not Found', status: 404 };
    }
  }
  return { type: 'about:blank', title: 'Internal Server Error', status: 500 };
}

/** Renders every error as RFC 9457 problem+json and never leaks internals for 5xx. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const requestId = http.getRequest<{ id?: string }>().id;
    const problem = toProblem(exception);
    if (problem.status >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error(
        `[${requestId ?? '-'}] ${exception instanceof Error ? (exception.stack ?? exception.message) : String(exception)}`,
      );
      // Give clients a reference they can quote to support without exposing internals.
      if (requestId) problem.detail = `Reference: ${requestId}`;
    }
    response.status(problem.status).type('application/problem+json').json(problem);
  }
}
