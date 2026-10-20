import { Inject, Injectable } from '@nestjs/common';
import { type PlatformSettings, platformSettingsSchema } from '@repo/contracts';
import type { Prisma, PrismaClient } from '@repo/db';
import { PLATFORM_DB } from '../database/database.module.js';

const KEY = 'platform';

/** Platform-wide switches stored as one validated JSON document. */
@Injectable()
export class PlatformSettingsService {
  constructor(@Inject(PLATFORM_DB) private readonly db: PrismaClient) {}

  async get(): Promise<PlatformSettings> {
    const row = await this.db.platformSetting.findUnique({ where: { key: KEY } });
    const parsed = platformSettingsSchema.safeParse(row?.value ?? {});
    return parsed.success ? parsed.data : platformSettingsSchema.parse({});
  }

  async save(settings: PlatformSettings, actorUserId: string): Promise<PlatformSettings> {
    const value = settings as unknown as Prisma.InputJsonValue;
    await this.db.platformSetting.upsert({
      where: { key: KEY },
      update: { value, updatedById: actorUserId },
      create: { key: KEY, value, updatedById: actorUserId },
    });
    return settings;
  }
}
