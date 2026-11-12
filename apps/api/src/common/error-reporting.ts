import * as Sentry from '@sentry/node';
import type { Env } from '../config/env.js';

let enabled = false;

/**
 * Sends unexpected errors (5xx, failed jobs) to Sentry when SENTRY_DSN is set. Request bodies,
 * cookies and headers are never sent: they can hold customer data and credentials.
 */
export function initErrorReporting(env: Env, role: 'api' | 'worker'): void {
  if (!env.SENTRY_DSN || enabled) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    release: env.APP_VERSION,
    serverName: role,
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.headers;
        delete event.request.query_string;
      }
      return event;
    },
  });
  enabled = true;
}

export function reportError(
  error: unknown,
  context: Record<string, string | undefined> = {},
): void {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context)) if (value) scope.setTag(key, value);
    Sentry.captureException(error);
  });
}
