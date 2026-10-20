import { z } from 'zod';

export const PERMISSIONS = [
  'products:read',
  'products:write',
  'orders:read',
  'orders:write',
  'customers:read',
  'customers:write',
  'discounts:write',
  'analytics:read',
  'settings:read',
  'settings:write',
  'themes:write',
  'staff:manage',
  'billing:manage',
] as const;

export const permissionSchema = z.enum(PERMISSIONS);
export type Permission = z.infer<typeof permissionSchema>;

export const storeRoleSchema = z.enum(['OWNER', 'ADMIN', 'STAFF']);
export type StoreRole = z.infer<typeof storeRoleSchema>;

const ADMIN_EXCLUDED: Permission[] = ['billing:manage', 'staff:manage'];

/** Permissions implied by a role. STAFF members only get what is granted explicitly. */
export function permissionsForRole(role: StoreRole, granted: readonly string[] = []): Permission[] {
  if (role === 'OWNER') return [...PERMISSIONS];
  if (role === 'ADMIN') return PERMISSIONS.filter((p) => !ADMIN_EXCLUDED.includes(p));
  return PERMISSIONS.filter((p) => granted.includes(p));
}

export function hasPermission(
  role: StoreRole,
  granted: readonly string[],
  permission: Permission,
): boolean {
  return permissionsForRole(role, granted).includes(permission);
}
