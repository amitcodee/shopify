import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AppRequest } from '../common/request.js';
import { SessionService } from './session.service.js';

const IS_PUBLIC = 'auth:isPublic';

/** Opts a route out of staff authentication (storefront, webhooks, health, login). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 && token.length <= 200 ? token : null;
}

/** Global guard: every route requires a valid staff session unless marked @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AppRequest>();
    const token = bearerToken(req.headers.authorization);
    const session = token ? await this.sessions.validate(token) : null;
    if (!token || !session) throw new UnauthorizedException('Sign in to continue.');

    req.auth = { user: session.user, sessionId: session.sessionId, token };
    return true;
  }
}
