import { z } from 'zod';
import { paginated } from './common.js';

export const auditLogEntrySchema = z.object({
  id: z.uuid(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  actor: z.object({ id: z.uuid(), name: z.string(), email: z.string() }).nullable(),
  data: z.unknown().nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;

export const auditLogPageSchema = paginated(auditLogEntrySchema);
