import type { UserRole, Permission, AuditAction, AuditLogEntry, OrganizationMember } from '../types/enterprise';
import { ROLE_PERMISSIONS } from '../types/enterprise';

/**
 * Check if a role has permission for a specific action on a resource.
 * Admin with '*' resource matches everything.
 */
export function hasPermission(
  role: UserRole,
  resource: string,
  action: 'create' | 'read' | 'update' | 'delete'
): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;

  return permissions.some((perm: Permission) => {
    const resourceMatch = perm.resource === '*' || perm.resource === resource;
    const actionMatch = perm.actions.includes(action);
    return resourceMatch && actionMatch;
  });
}

/**
 * Convenience wrapper around hasPermission using the member's role.
 */
export function canAccessResource(
  member: OrganizationMember,
  resource: string,
  action: 'create' | 'read' | 'update' | 'delete'
): boolean {
  return hasPermission(member.role, resource, action);
}

/**
 * Return list of actions a role can perform on a specific resource.
 */
export function getPermittedActions(
  role: UserRole,
  resource: string
): ('create' | 'read' | 'update' | 'delete')[] {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return [];

  for (const perm of permissions) {
    if (perm.resource === '*' || perm.resource === resource) {
      return [...perm.actions];
    }
  }

  return [];
}

/**
 * Create an audit log entry with auto-generated id and current timestamp.
 */
export function createAuditEntry(
  userId: string,
  userName: string,
  action: AuditAction,
  resourceType: string,
  resourceId: string,
  details: string
): AuditLogEntry {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });

  return {
    id,
    timestamp: new Date().toISOString(),
    userId,
    userName,
    action,
    resourceType,
    resourceId,
    details,
  };
}

/**
 * Filter audit log entries by various criteria.
 */
export function filterAuditLog(
  entries: AuditLogEntry[],
  filters: {
    userId?: string;
    action?: AuditAction;
    resourceType?: string;
    startDate?: string;
    endDate?: string;
  }
): AuditLogEntry[] {
  return entries.filter((entry) => {
    if (filters.userId && entry.userId !== filters.userId) return false;
    if (filters.action && entry.action !== filters.action) return false;
    if (filters.resourceType && entry.resourceType !== filters.resourceType) return false;
    if (filters.startDate && entry.timestamp < filters.startDate) return false;
    if (filters.endDate && entry.timestamp > filters.endDate) return false;
    return true;
  });
}

/**
 * Convert audit action to human-readable format.
 * e.g. 'property.create' -> 'Created Property', 'report.generate' -> 'Generated Report'
 */
export function formatAuditAction(action: AuditAction): string {
  const [resource, verb] = action.split('.');

  const verbMap: Record<string, string> = {
    create: 'Created',
    update: 'Updated',
    delete: 'Deleted',
    generate: 'Generated',
    download: 'Downloaded',
    schedule: 'Scheduled',
    cancel: 'Cancelled',
    invite: 'Invited',
    remove: 'Removed',
    role_change: 'Changed Role of',
    json: 'Exported JSON',
    csv: 'Exported CSV',
    geojson: 'Exported GeoJSON',
    esx: 'Exported ESX',
  };

  const resourceMap: Record<string, string> = {
    property: 'Property',
    measurement: 'Measurement',
    report: 'Report',
    claim: 'Claim',
    inspection: 'Inspection',
    user: 'User',
    export: '',
  };

  const formattedVerb = verbMap[verb] || verb.charAt(0).toUpperCase() + verb.slice(1);
  const formattedResource = resourceMap[resource] || resource.charAt(0).toUpperCase() + resource.slice(1);

  // For export actions, the verb map already includes the full description
  if (resource === 'export') {
    return formattedVerb;
  }

  return `${formattedVerb} ${formattedResource}`.trim();
}

/**
 * Returns numeric hierarchy level for a role.
 * admin=4, manager=3, adjuster=2, roofer=1, viewer=0
 */
export function getRoleHierarchy(role: UserRole): number {
  const hierarchy: Record<UserRole, number> = {
    admin: 4,
    manager: 3,
    adjuster: 2,
    roofer: 1,
    viewer: 0,
  };
  return hierarchy[role] ?? 0;
}

/**
 * Whether a user with managerRole can manage (invite/remove/change) a user with targetRole.
 * Only higher hierarchy can manage lower. Admin can manage all.
 */
export function canManageRole(managerRole: UserRole, targetRole: UserRole): boolean {
  return getRoleHierarchy(managerRole) > getRoleHierarchy(targetRole);
}

/**
 * Generate a random 8-char alphanumeric prefix for API keys.
 */
export function generateApiKeyPrefix(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Returns "sk_XXXXXXXX..." format for display.
 */
export function maskApiKey(prefix: string): string {
  return `sk_${prefix}...`;
}
