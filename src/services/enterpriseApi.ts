/**
 * Client-side API service for enterprise features.
 * Covers organizations, sharing, webhooks, and white-label branding.
 * Follows the pattern established in propertyApi.ts.
 */

import type {
  Organization,
  OrganizationMember,
  SharedReport,
  Webhook,
  WhiteLabelConfig,
} from '../types/enterprise';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getToken(): string | null {
  try {
    const stored = localStorage.getItem('skyhawk-storage');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed.state?.token || null;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(response.status, body.error || 'Request failed');
  }

  return response.json() as Promise<T>;
}

// ─── Organizations API ──────────────────────────────────────────────

export async function createOrganization(data: {
  name: string;
  plan?: string;
}): Promise<Organization> {
  return apiFetch('/api/organizations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getOrganization(id: string): Promise<Organization> {
  return apiFetch(`/api/organizations/${id}`);
}

export async function updateOrganization(
  id: string,
  data: Partial<{ name: string; plan: string }>,
): Promise<Organization> {
  return apiFetch(`/api/organizations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteOrganization(id: string): Promise<void> {
  await apiFetch(`/api/organizations/${id}`, { method: 'DELETE' });
}

export async function inviteMember(
  orgId: string,
  data: { email: string; role?: string },
): Promise<OrganizationMember> {
  return apiFetch(`/api/organizations/${orgId}/members`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listMembers(
  orgId: string,
): Promise<OrganizationMember[]> {
  const result = await apiFetch<{ members: OrganizationMember[] }>(
    `/api/organizations/${orgId}/members`,
  );
  return result.members;
}

export async function updateMemberRole(
  orgId: string,
  userId: string,
  role: string,
): Promise<OrganizationMember> {
  return apiFetch(`/api/organizations/${orgId}/members/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  });
}

export async function removeMember(
  orgId: string,
  userId: string,
): Promise<void> {
  await apiFetch(`/api/organizations/${orgId}/members/${userId}`, {
    method: 'DELETE',
  });
}

// ─── Sharing API ────────────────────────────────────────────────────

export async function shareProperty(
  propertyId: string,
  data: {
    email?: string;
    permissions?: 'view' | 'comment' | 'edit';
    expiresAt?: string;
  },
): Promise<SharedReport & { shareUrl: string }> {
  return apiFetch(`/api/properties/${propertyId}/share`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getSharedReport(
  token: string,
): Promise<{
  share: {
    id: string;
    permissions: string;
    sharedByUsername: string;
    expiresAt?: string;
    createdAt: string;
  };
  property: Record<string, unknown>;
  measurements: Record<string, unknown>[];
  damageAnnotations: Record<string, unknown>[];
}> {
  return apiFetch(`/api/shared/${token}`);
}

export async function listShares(): Promise<SharedReport[]> {
  const result = await apiFetch<{ shares: SharedReport[] }>('/api/shared');
  return result.shares;
}

export async function revokeShare(id: string): Promise<void> {
  await apiFetch(`/api/shared/${id}`, { method: 'DELETE' });
}

// ─── Webhooks API ───────────────────────────────────────────────────

export async function createWebhook(data: {
  url: string;
  events: string[];
  organizationId?: string;
}): Promise<Webhook & { secret: string }> {
  return apiFetch('/api/webhooks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listWebhooks(): Promise<Webhook[]> {
  const result = await apiFetch<{ webhooks: Webhook[] }>('/api/webhooks');
  return result.webhooks;
}

export async function updateWebhook(
  id: string,
  data: Partial<{ url: string; events: string[]; active: boolean }>,
): Promise<Webhook> {
  return apiFetch(`/api/webhooks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteWebhook(id: string): Promise<void> {
  await apiFetch(`/api/webhooks/${id}`, { method: 'DELETE' });
}

export async function testWebhook(
  id: string,
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  return apiFetch(`/api/webhooks/${id}/test`, { method: 'POST' });
}

// ─── White-Label API ────────────────────────────────────────────────

export async function getWhiteLabelConfig(
  orgId: string,
): Promise<WhiteLabelConfig> {
  return apiFetch(`/api/organizations/${orgId}/white-label`);
}

export async function updateWhiteLabelConfig(
  orgId: string,
  data: Partial<WhiteLabelConfig>,
): Promise<WhiteLabelConfig> {
  return apiFetch(`/api/organizations/${orgId}/white-label`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
