/**
 * Unit tests for enterprise utility functions
 * Run with: npx vitest run tests/unit/enterprise.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  canAccessResource,
  getPermittedActions,
  createAuditEntry,
  filterAuditLog,
  formatAuditAction,
  getRoleHierarchy,
  canManageRole,
  generateApiKeyPrefix,
  maskApiKey,
} from '../../src/utils/enterprise';
import type { AuditLogEntry, OrganizationMember, UserRole, AuditAction } from '../../src/types/enterprise';
import { ROLE_PERMISSIONS } from '../../src/types/enterprise';

// ─── Helpers ────────────────────────────────────────────────────────

function createMember(overrides: Partial<OrganizationMember> = {}): OrganizationMember {
  return {
    id: 'm1',
    organizationId: 'org1',
    userId: 'u1',
    userName: 'Test User',
    email: 'test@example.com',
    role: 'viewer',
    joinedAt: '2025-01-01T00:00:00Z',
    lastActiveAt: '2025-06-01T00:00:00Z',
    ...overrides,
  };
}

function createAuditLogEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: 'audit-1',
    timestamp: '2025-06-15T10:00:00Z',
    userId: 'u1',
    userName: 'Test User',
    action: 'property.create',
    resourceType: 'property',
    resourceId: 'p1',
    details: 'Created property',
    ...overrides,
  };
}

// ─── hasPermission ──────────────────────────────────────────────────

describe('hasPermission', () => {
  it('should grant admin access to any resource with wildcard', () => {
    expect(hasPermission('admin', 'properties', 'create')).toBe(true);
    expect(hasPermission('admin', 'measurements', 'read')).toBe(true);
    expect(hasPermission('admin', 'users', 'delete')).toBe(true);
    expect(hasPermission('admin', 'anything', 'update')).toBe(true);
  });

  it('should grant manager CRUD on properties', () => {
    expect(hasPermission('manager', 'properties', 'create')).toBe(true);
    expect(hasPermission('manager', 'properties', 'read')).toBe(true);
    expect(hasPermission('manager', 'properties', 'update')).toBe(true);
    expect(hasPermission('manager', 'properties', 'delete')).toBe(true);
  });

  it('should allow manager to read users but not create/update/delete', () => {
    expect(hasPermission('manager', 'users', 'read')).toBe(true);
    expect(hasPermission('manager', 'users', 'create')).toBe(false);
    expect(hasPermission('manager', 'users', 'update')).toBe(false);
    expect(hasPermission('manager', 'users', 'delete')).toBe(false);
  });

  it('should allow adjuster to read properties but not create', () => {
    expect(hasPermission('adjuster', 'properties', 'read')).toBe(true);
    expect(hasPermission('adjuster', 'properties', 'create')).toBe(false);
  });

  it('should allow adjuster to create and read reports', () => {
    expect(hasPermission('adjuster', 'reports', 'create')).toBe(true);
    expect(hasPermission('adjuster', 'reports', 'read')).toBe(true);
    expect(hasPermission('adjuster', 'reports', 'delete')).toBe(false);
  });

  it('should allow roofer to create measurements', () => {
    expect(hasPermission('roofer', 'measurements', 'create')).toBe(true);
    expect(hasPermission('roofer', 'measurements', 'read')).toBe(true);
  });

  it('should deny roofer from deleting anything', () => {
    expect(hasPermission('roofer', 'properties', 'delete')).toBe(false);
    expect(hasPermission('roofer', 'measurements', 'delete')).toBe(false);
    expect(hasPermission('roofer', 'reports', 'delete')).toBe(false);
  });

  it('should only allow viewer to read', () => {
    expect(hasPermission('viewer', 'properties', 'read')).toBe(true);
    expect(hasPermission('viewer', 'measurements', 'read')).toBe(true);
    expect(hasPermission('viewer', 'reports', 'read')).toBe(true);
    expect(hasPermission('viewer', 'properties', 'create')).toBe(false);
    expect(hasPermission('viewer', 'properties', 'update')).toBe(false);
    expect(hasPermission('viewer', 'properties', 'delete')).toBe(false);
  });

  it('should deny access to resources not in the role permissions', () => {
    expect(hasPermission('viewer', 'inspections', 'read')).toBe(false);
    expect(hasPermission('roofer', 'claims', 'read')).toBe(false);
  });
});

// ─── canAccessResource ──────────────────────────────────────────────

describe('canAccessResource', () => {
  it('should use the member role to check access', () => {
    const adminMember = createMember({ role: 'admin' });
    expect(canAccessResource(adminMember, 'properties', 'delete')).toBe(true);
  });

  it('should deny access for viewer creating a property', () => {
    const viewer = createMember({ role: 'viewer' });
    expect(canAccessResource(viewer, 'properties', 'create')).toBe(false);
  });

  it('should allow roofer to read properties', () => {
    const roofer = createMember({ role: 'roofer' });
    expect(canAccessResource(roofer, 'properties', 'read')).toBe(true);
  });
});

// ─── getPermittedActions ────────────────────────────────────────────

describe('getPermittedActions', () => {
  it('should return all CRUD actions for admin on any resource', () => {
    const actions = getPermittedActions('admin', 'anything');
    expect(actions).toContain('create');
    expect(actions).toContain('read');
    expect(actions).toContain('update');
    expect(actions).toContain('delete');
  });

  it('should return all CRUD for manager on properties', () => {
    const actions = getPermittedActions('manager', 'properties');
    expect(actions).toEqual(['create', 'read', 'update', 'delete']);
  });

  it('should return only read for viewer on properties', () => {
    const actions = getPermittedActions('viewer', 'properties');
    expect(actions).toEqual(['read']);
  });

  it('should return empty for viewer on inspections', () => {
    const actions = getPermittedActions('viewer', 'inspections');
    expect(actions).toEqual([]);
  });

  it('should return create/read/update for adjuster on inspections', () => {
    const actions = getPermittedActions('adjuster', 'inspections');
    expect(actions).toEqual(['create', 'read', 'update']);
  });

  it('should return a new array (not a reference to the original)', () => {
    const actions1 = getPermittedActions('admin', 'properties');
    const actions2 = getPermittedActions('admin', 'properties');
    expect(actions1).not.toBe(actions2);
    expect(actions1).toEqual(actions2);
  });
});

// ─── createAuditEntry ───────────────────────────────────────────────

describe('createAuditEntry', () => {
  it('should create entry with all provided fields', () => {
    const entry = createAuditEntry(
      'u1', 'Alice', 'property.create', 'property', 'p1', 'Created new property'
    );
    expect(entry.userId).toBe('u1');
    expect(entry.userName).toBe('Alice');
    expect(entry.action).toBe('property.create');
    expect(entry.resourceType).toBe('property');
    expect(entry.resourceId).toBe('p1');
    expect(entry.details).toBe('Created new property');
  });

  it('should generate a non-empty id', () => {
    const entry = createAuditEntry(
      'u1', 'Alice', 'property.create', 'property', 'p1', 'details'
    );
    expect(entry.id).toBeTruthy();
    expect(typeof entry.id).toBe('string');
    expect(entry.id.length).toBeGreaterThan(0);
  });

  it('should generate unique ids for different entries', () => {
    const entry1 = createAuditEntry('u1', 'Alice', 'property.create', 'property', 'p1', 'details');
    const entry2 = createAuditEntry('u2', 'Bob', 'property.update', 'property', 'p2', 'details');
    expect(entry1.id).not.toBe(entry2.id);
  });

  it('should generate a valid ISO timestamp', () => {
    const entry = createAuditEntry(
      'u1', 'Alice', 'property.create', 'property', 'p1', 'details'
    );
    const parsed = new Date(entry.timestamp);
    expect(parsed.getTime()).not.toBeNaN();
  });
});

// ─── filterAuditLog ─────────────────────────────────────────────────

describe('filterAuditLog', () => {
  const entries: AuditLogEntry[] = [
    createAuditLogEntry({ id: '1', userId: 'u1', action: 'property.create', resourceType: 'property', timestamp: '2025-06-01T10:00:00Z' }),
    createAuditLogEntry({ id: '2', userId: 'u2', action: 'property.update', resourceType: 'property', timestamp: '2025-06-10T10:00:00Z' }),
    createAuditLogEntry({ id: '3', userId: 'u1', action: 'report.generate', resourceType: 'report', timestamp: '2025-06-15T10:00:00Z' }),
    createAuditLogEntry({ id: '4', userId: 'u3', action: 'claim.create', resourceType: 'claim', timestamp: '2025-07-01T10:00:00Z' }),
    createAuditLogEntry({ id: '5', userId: 'u2', action: 'export.csv', resourceType: 'export', timestamp: '2025-07-15T10:00:00Z' }),
  ];

  it('should return all entries when no filters applied', () => {
    const result = filterAuditLog(entries, {});
    expect(result).toHaveLength(5);
  });

  it('should filter by userId', () => {
    const result = filterAuditLog(entries, { userId: 'u1' });
    expect(result).toHaveLength(2);
    result.forEach((e) => expect(e.userId).toBe('u1'));
  });

  it('should filter by action', () => {
    const result = filterAuditLog(entries, { action: 'property.create' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('should filter by resourceType', () => {
    const result = filterAuditLog(entries, { resourceType: 'property' });
    expect(result).toHaveLength(2);
  });

  it('should filter by startDate', () => {
    const result = filterAuditLog(entries, { startDate: '2025-06-15T00:00:00Z' });
    expect(result).toHaveLength(3);
  });

  it('should filter by endDate', () => {
    const result = filterAuditLog(entries, { endDate: '2025-06-15T23:59:59Z' });
    expect(result).toHaveLength(3);
  });

  it('should filter by date range', () => {
    const result = filterAuditLog(entries, {
      startDate: '2025-06-10T00:00:00Z',
      endDate: '2025-06-30T23:59:59Z',
    });
    expect(result).toHaveLength(2);
  });

  it('should combine userId and action filters', () => {
    const result = filterAuditLog(entries, { userId: 'u1', action: 'property.create' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('should combine userId and resourceType filters', () => {
    const result = filterAuditLog(entries, { userId: 'u2', resourceType: 'export' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('5');
  });

  it('should return empty array when no entries match', () => {
    const result = filterAuditLog(entries, { userId: 'nonexistent' });
    expect(result).toHaveLength(0);
  });

  it('should handle empty entries array', () => {
    const result = filterAuditLog([], { userId: 'u1' });
    expect(result).toHaveLength(0);
  });
});

// ─── formatAuditAction ──────────────────────────────────────────────

describe('formatAuditAction', () => {
  it('should format property.create as "Created Property"', () => {
    expect(formatAuditAction('property.create')).toBe('Created Property');
  });

  it('should format property.update as "Updated Property"', () => {
    expect(formatAuditAction('property.update')).toBe('Updated Property');
  });

  it('should format property.delete as "Deleted Property"', () => {
    expect(formatAuditAction('property.delete')).toBe('Deleted Property');
  });

  it('should format report.generate as "Generated Report"', () => {
    expect(formatAuditAction('report.generate')).toBe('Generated Report');
  });

  it('should format report.download as "Downloaded Report"', () => {
    expect(formatAuditAction('report.download')).toBe('Downloaded Report');
  });

  it('should format inspection.schedule as "Scheduled Inspection"', () => {
    expect(formatAuditAction('inspection.schedule')).toBe('Scheduled Inspection');
  });

  it('should format inspection.cancel as "Cancelled Inspection"', () => {
    expect(formatAuditAction('inspection.cancel')).toBe('Cancelled Inspection');
  });

  it('should format user.invite as "Invited User"', () => {
    expect(formatAuditAction('user.invite')).toBe('Invited User');
  });

  it('should format user.remove as "Removed User"', () => {
    expect(formatAuditAction('user.remove')).toBe('Removed User');
  });

  it('should format user.role_change as "Changed Role of User"', () => {
    expect(formatAuditAction('user.role_change')).toBe('Changed Role of User');
  });

  it('should format export.json as "Exported JSON"', () => {
    expect(formatAuditAction('export.json')).toBe('Exported JSON');
  });

  it('should format export.csv as "Exported CSV"', () => {
    expect(formatAuditAction('export.csv')).toBe('Exported CSV');
  });

  it('should format export.geojson as "Exported GeoJSON"', () => {
    expect(formatAuditAction('export.geojson')).toBe('Exported GeoJSON');
  });

  it('should format export.esx as "Exported ESX"', () => {
    expect(formatAuditAction('export.esx')).toBe('Exported ESX');
  });
});

// ─── getRoleHierarchy ───────────────────────────────────────────────

describe('getRoleHierarchy', () => {
  it('should return 4 for admin', () => {
    expect(getRoleHierarchy('admin')).toBe(4);
  });

  it('should return 3 for manager', () => {
    expect(getRoleHierarchy('manager')).toBe(3);
  });

  it('should return 2 for adjuster', () => {
    expect(getRoleHierarchy('adjuster')).toBe(2);
  });

  it('should return 1 for roofer', () => {
    expect(getRoleHierarchy('roofer')).toBe(1);
  });

  it('should return 0 for viewer', () => {
    expect(getRoleHierarchy('viewer')).toBe(0);
  });

  it('should maintain correct ordering', () => {
    expect(getRoleHierarchy('admin')).toBeGreaterThan(getRoleHierarchy('manager'));
    expect(getRoleHierarchy('manager')).toBeGreaterThan(getRoleHierarchy('adjuster'));
    expect(getRoleHierarchy('adjuster')).toBeGreaterThan(getRoleHierarchy('roofer'));
    expect(getRoleHierarchy('roofer')).toBeGreaterThan(getRoleHierarchy('viewer'));
  });
});

// ─── canManageRole ──────────────────────────────────────────────────

describe('canManageRole', () => {
  it('should allow admin to manage all other roles', () => {
    expect(canManageRole('admin', 'manager')).toBe(true);
    expect(canManageRole('admin', 'adjuster')).toBe(true);
    expect(canManageRole('admin', 'roofer')).toBe(true);
    expect(canManageRole('admin', 'viewer')).toBe(true);
  });

  it('should not allow admin to manage admin', () => {
    expect(canManageRole('admin', 'admin')).toBe(false);
  });

  it('should allow manager to manage lower roles', () => {
    expect(canManageRole('manager', 'adjuster')).toBe(true);
    expect(canManageRole('manager', 'roofer')).toBe(true);
    expect(canManageRole('manager', 'viewer')).toBe(true);
  });

  it('should not allow manager to manage admin or manager', () => {
    expect(canManageRole('manager', 'admin')).toBe(false);
    expect(canManageRole('manager', 'manager')).toBe(false);
  });

  it('should not allow viewer to manage anyone', () => {
    expect(canManageRole('viewer', 'viewer')).toBe(false);
    expect(canManageRole('viewer', 'roofer')).toBe(false);
    expect(canManageRole('viewer', 'admin')).toBe(false);
  });

  it('should not allow roofer to manage adjuster (same or higher)', () => {
    expect(canManageRole('roofer', 'adjuster')).toBe(false);
  });

  it('should allow roofer to manage viewer', () => {
    expect(canManageRole('roofer', 'viewer')).toBe(true);
  });
});

// ─── generateApiKeyPrefix ───────────────────────────────────────────

describe('generateApiKeyPrefix', () => {
  it('should return a string of length 8', () => {
    const prefix = generateApiKeyPrefix();
    expect(prefix).toHaveLength(8);
  });

  it('should contain only alphanumeric characters', () => {
    const prefix = generateApiKeyPrefix();
    expect(prefix).toMatch(/^[A-Za-z0-9]{8}$/);
  });

  it('should generate different prefixes on successive calls', () => {
    const prefixes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      prefixes.add(generateApiKeyPrefix());
    }
    // With 62^8 possible combinations, 20 calls should be unique
    expect(prefixes.size).toBe(20);
  });
});

// ─── maskApiKey ─────────────────────────────────────────────────────

describe('maskApiKey', () => {
  it('should return sk_ prefix with ellipsis', () => {
    expect(maskApiKey('AbCd1234')).toBe('sk_AbCd1234...');
  });

  it('should handle empty prefix', () => {
    expect(maskApiKey('')).toBe('sk_...');
  });

  it('should preserve the full prefix in the output', () => {
    const prefix = 'XyZ98765';
    const masked = maskApiKey(prefix);
    expect(masked).toContain(prefix);
    expect(masked.startsWith('sk_')).toBe(true);
    expect(masked.endsWith('...')).toBe(true);
  });
});
