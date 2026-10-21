import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { API_TOKEN_PREFIX } from '@repo/contracts';
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
    if (token?.startsWith(API_TOKEN_PREFIX)) return this.apiToken(req, token);
    const session = token ? await this.sessions.validate(token) : null;
    if (!token || !session) throw new UnauthorizedException('Sign in to continue.');

    req.auth = { user: session.user, sessionId: session.sessionId, token };
    return true;
  }

  /**
   * Access tokens only reach their own store's admin API (`/admin/stores/<id>/...`), never
   * account, platform or token-management routes, so a leaked token cannot sign in as its
   * creator or mint more tokens.
   */
  private async apiToken(req: AppRequest, token: string): Promise<boolean> {
    const found = await this.sessions.validateApiToken(token);
    if (!found) throw new UnauthorizedException('Invalid or revoked access token.');
    const scope = new RegExp(`^/api/v\\d+/admin/stores/${found.storeId}(/|$)`);
    if (!scope.test(req.path) || /\/api-tokens(\/|$)/.test(req.path)) {
      throw new ForbiddenException('Access tokens can only use their store’s Admin API.');
    }
    req.auth = {
      user: found.user,
      sessionId: '',
      token,
      apiToken: { id: found.tokenId, storeId: found.storeId, permissions: found.permissions },
    };
    return true;
  }
}
