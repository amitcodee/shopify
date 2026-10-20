import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Permission, PlatformRole, StoreRole } from '@repo/contracts';
import type { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  platformRole: PlatformRole;
  twoFactorEnabled: boolean;
  emailVerified: boolean;
}

export interface StoreContext {
  id: string;
  role: StoreRole;
  permissions: Permission[];
  currency: string;
}

export interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AppRequest extends Request {
  auth?: { user: AuthUser; sessionId: string; token: string };
  store?: StoreContext;
}

export function requestMeta(req: Request): RequestMeta {
  return { ipAddress: req.ip ?? null, userAgent: req.get('user-agent')?.slice(0, 500) ?? null };
}

/** The authenticated staff user (set by AuthGuard). */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<AppRequest>();
  if (!req.auth) throw new Error('CurrentUser used on a route without AuthGuard');
  return req.auth.user;
});

/** The authorized store for `/admin/stores/:storeId/*` routes (set by StoreAccessGuard). */
export const CurrentStore = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): StoreContext => {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    if (!req.store) throw new Error('CurrentStore used on a route without StoreAccessGuard');
    return req.store;
  },
);

/** Client IP and user agent, for audit logs and sessions. */
export const ReqMeta = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestMeta =>
  requestMeta(ctx.switchToHttp().getRequest<Request>()),
);
