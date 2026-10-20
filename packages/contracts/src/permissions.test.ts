import { describe, expect, it } from 'vitest';
import { hasPermission, permissionsForRole, PERMISSIONS } from './permissions.js';
import { subdomainSchema } from './stores.js';

describe('permissions', () => {
  it('gives owners everything and admins everything except billing and staff', () => {
    expect(permissionsForRole('OWNER')).toEqual([...PERMISSIONS]);
    expect(hasPermission('ADMIN', [], 'products:write')).toBe(true);
    expect(hasPermission('ADMIN', [], 'billing:manage')).toBe(false);
    expect(hasPermission('ADMIN', [], 'staff:manage')).toBe(false);
  });

  it('only grants staff what is listed, ignoring unknown strings', () => {
    expect(permissionsForRole('STAFF', ['orders:read', 'bogus'])).toEqual(['orders:read']);
    expect(hasPermission('STAFF', ['orders:read'], 'orders:write')).toBe(false);
  });
});

describe('subdomainSchema', () => {
  it('normalizes and validates store handles', () => {
    expect(subdomainSchema.parse('  My-Store ')).toBe('my-store');
    expect(subdomainSchema.safeParse('-bad').success).toBe(false);
    expect(subdomainSchema.safeParse('admin').success).toBe(false);
    expect(subdomainSchema.safeParse('ab').success).toBe(false);
  });
});
