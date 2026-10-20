import { type DynamicModule, Module } from '@nestjs/common';
import { ENV, type Env } from './env.js';

@Module({})
export class ConfigModule {
  static register(env: Env): DynamicModule {
    return {
      module: ConfigModule,
      global: true,
      providers: [{ provide: ENV, useValue: env }],
      exports: [ENV],
    };
  }
}
