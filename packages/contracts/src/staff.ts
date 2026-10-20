import { z } from 'zod';
import { emailSchema } from './common.js';
import { permissionSchema, storeRoleSchema } from './permissions.js';

const assignableRole = z.enum(['ADMIN', 'STAFF']);

export const inviteStaffInputSchema = z.strictObject({
  email: emailSchema,
  role: assignableRole,
  permissions: z.array(permissionSchema).max(20).default([]),
});
export type InviteStaffInput = z.input<typeof inviteStaffInputSchema>;

export const updateMemberInputSchema = z.strictObject({
  role: assignableRole,
  permissions: z.array(permissionSchema).max(20).default([]),
});
export type UpdateMemberInput = z.input<typeof updateMemberInputSchema>;

export const staffMemberSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  name: z.string(),
  email: z.string(),
  role: storeRoleSchema,
  permissions: z.array(z.string()),
  createdAt: z.iso.datetime(),
});
export type StaffMember = z.infer<typeof staffMemberSchema>;

export const invitationSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: storeRoleSchema,
  permissions: z.array(z.string()),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});
export type Invitation = z.infer<typeof invitationSchema>;

/** The accept link is emailed to the invitee only (never returned to the inviter). */
export const createdInvitationSchema = invitationSchema;
export type CreatedInvitation = z.infer<typeof createdInvitationSchema>;

export const staffListSchema = z.object({
  members: z.array(staffMemberSchema),
  invitations: z.array(invitationSchema),
});
export type StaffList = z.infer<typeof staffListSchema>;

export const invitationPreviewSchema = z.object({
  storeName: z.string(),
  email: z.string(),
  role: storeRoleSchema,
  accountExists: z.boolean(),
});
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

export const acceptInvitationInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(100).optional(),
  password: z.string().min(12).max(128).optional(),
});
