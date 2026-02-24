export type UserRole = 'admin' | 'manager' | 'adjuster' | 'roofer' | 'viewer';

export interface Permission {
  resource: string;
  actions: ('create' | 'read' | 'update' | 'delete')[];
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    { resource: '*', actions: ['create', 'read', 'update', 'delete'] },
  ],
  manager: [
    { resource: 'properties', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'measurements', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'reports', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'claims', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'adjusters', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'users', actions: ['read'] },
    { resource: 'audit', actions: ['read'] },
  ],
  adjuster: [
    { resource: 'properties', actions: ['read'] },
    { resource: 'measurements', actions: ['read'] },
    { resource: 'reports', actions: ['create', 'read'] },
    { resource: 'claims', actions: ['read', 'update'] },
    { resource: 'inspections', actions: ['create', 'read', 'update'] },
  ],
  roofer: [
    { resource: 'properties', actions: ['read'] },
    { resource: 'measurements', actions: ['create', 'read'] },
    { resource: 'reports', actions: ['create', 'read'] },
  ],
  viewer: [
    { resource: 'properties', actions: ['read'] },
    { resource: 'measurements', actions: ['read'] },
    { resource: 'reports', actions: ['read'] },
  ],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  adjuster: 'Adjuster',
  roofer: 'Roofer',
  viewer: 'Viewer',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  admin: '#ef4444',
  manager: '#f59e0b',
  adjuster: '#3b82f6',
  roofer: '#10b981',
  viewer: '#6b7280',
};

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  plan: 'free' | 'pro' | 'enterprise';
  members?: OrganizationMember[];
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  userName: string;
  username: string;
  email: string;
  role: UserRole;
  joinedAt: string;
  lastActiveAt: string;
}

export interface SharedReport {
  id: string;
  propertyId: string;
  sharedByUsername: string;
  sharedWithEmail?: string;
  shareToken: string;
  permissions: 'view' | 'comment' | 'edit';
  expiresAt?: string;
  createdAt: string;
  propertyAddress?: string;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  lastTriggeredAt?: string;
  failureCount: number;
  createdAt?: string;
}

export type WebhookEvent =
  | 'property.created'
  | 'property.updated'
  | 'measurement.completed'
  | 'report.generated'
  | 'claim.updated';

export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  'property.created': 'Property Created',
  'property.updated': 'Property Updated',
  'measurement.completed': 'Measurement Completed',
  'report.generated': 'Report Generated',
  'claim.updated': 'Claim Updated',
};

export interface WhiteLabelConfig {
  companyName?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  headerText?: string;
  footerText?: string;
  customDomain?: string;
}

export type AuditAction =
  | 'property.create' | 'property.update' | 'property.delete'
  | 'measurement.create' | 'measurement.update' | 'measurement.delete'
  | 'report.generate' | 'report.download'
  | 'claim.create' | 'claim.update' | 'claim.delete'
  | 'inspection.schedule' | 'inspection.update' | 'inspection.cancel'
  | 'user.invite' | 'user.remove' | 'user.role_change'
  | 'export.json' | 'export.csv' | 'export.geojson' | 'export.esx';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  details: string;
  ipAddress?: string;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;  // first 8 chars shown
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  permissions: Permission[];
}
