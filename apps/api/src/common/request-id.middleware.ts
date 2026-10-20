import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const VALID_ID = /^[\w.-]{1,100}$/;

/** Propagates (or assigns) an X-Request-Id so logs and client reports can be correlated. */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.get('x-request-id');
  const id = incoming && VALID_ID.test(incoming) ? incoming : randomUUID();
  (req as Request & { id?: string }).id = id;
  res.setHeader('X-Request-Id', id);
  next();
}
