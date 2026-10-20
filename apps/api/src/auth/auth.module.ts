import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { OutboxService } from '../outbox/outbox.service.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    SessionService,
    OutboxService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [PasswordService, SessionService],
})
export class AuthModule {}
