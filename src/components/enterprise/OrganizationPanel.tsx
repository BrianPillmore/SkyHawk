import { useState, useEffect, useCallback } from 'react';
import type { Organization, OrganizationMember, UserRole } from '../../types/enterprise';
import { ROLE_LABELS, ROLE_COLORS } from '../../types/enterprise';
import {
  createOrganization,
  getOrganization,
  updateOrganization,
  deleteOrganization,
  inviteMember,
  listMembers,
  updateMemberRole,
  removeMember,
} from '../../services/enterpriseApi';

const ALL_ROLES: UserRole[] = ['admin', 'manager', 'adjuster', 'roofer', 'viewer'];
const PLAN_OPTIONS = ['free', 'pro', 'enterprise'] as const;

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
      style={{
        backgroundColor: ROLE_COLORS[role] + '22',
        color: ROLE_COLORS[role],
        border: `1px solid ${ROLE_COLORS[role]}44`,
      }}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    free: '#6b7280',
    pro: '#3b82f6',
    enterprise: '#8b5cf6',
  };
  const color = colors[plan] || '#6b7280';
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase"
      style={{
        backgroundColor: color + '22',
        color,
        border: `1px solid ${color}44`,
      }}
    >
      {plan}
    </span>
  );
}

export default function OrganizationPanel() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create org form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgPlan, setNewOrgPlan] = useState<string>('free');

  // Invite form
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('viewer');

  // Edit org form
  const [editingOrg, setEditingOrg] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPlan, setEditPlan] = useState('');

  // Stored org ID (in a real app, this would come from context/store)
  const [orgId, setOrgId] = useState<string | null>(null);

  const loadOrganization = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const orgData = await getOrganization(id);
      setOrg(orgData);
      const memberData = await listMembers(id);
      setMembers(memberData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organization');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (orgId) {
      loadOrganization(orgId);
    }
  }, [orgId, loadOrganization]);

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const created = await createOrganization({ name: newOrgName.trim(), plan: newOrgPlan });
      setOrgId(created.id);
      setShowCreateForm(false);
      setNewOrgName('');
      setNewOrgPlan('free');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrg = async () => {
    if (!org) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await updateOrganization(org.id, {
        name: editName.trim() || undefined,
        plan: editPlan || undefined,
      });
      setOrg({ ...org, ...updated });
      setEditingOrg(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update organization');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOrg = async () => {
    if (!org) return;
    if (!confirm('Are you sure you want to delete this organization? This action cannot be undone.')) return;
    setLoading(true);
    setError(null);
    try {
      await deleteOrganization(org.id);
      setOrg(null);
      setOrgId(null);
      setMembers([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete organization');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async () => {
    if (!org || !inviteEmail.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await inviteMember(org.id, { email: inviteEmail.trim(), role: inviteRole });
      setShowInviteForm(false);
      setInviteEmail('');
      setInviteRole('viewer');
      await loadOrganization(org.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite member');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (member: OrganizationMember, newRole: UserRole) => {
    if (!org) return;
    setError(null);
    try {
      await updateMemberRole(org.id, member.userId, newRole);
      setMembers((prev) =>
        prev.map((m) => (m.userId === member.userId ? { ...m, role: newRole } : m)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const handleRemoveMember = async (member: OrganizationMember) => {
    if (!org) return;
    if (!confirm(`Remove ${member.userName || member.username} from the organization?`)) return;
    setError(null);
    try {
      await removeMember(org.id, member.userId);
      setMembers((prev) => prev.filter((m) => m.userId !== member.userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  return (
    <div className="p-4 text-gray-200">
      <h2 className="text-lg font-bold mb-3 text-white">Organization</h2>

      {/* Error display */}
      {error && (
        <div className="mb-3 p-2 bg-red-900/30 border border-red-800/50 rounded text-sm text-red-400">
          {error}
        </div>
      )}

      {/* No organization yet */}
      {!org && !showCreateForm && (
        <div className="text-center py-6">
          <p className="text-sm text-gray-400 mb-3">No organization configured yet.</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-gotruf-600 hover:bg-gotruf-700 text-white text-sm font-medium rounded transition-colors"
          >
            Create Organization
          </button>
        </div>
      )}

      {/* Create organization form */}
      {showCreateForm && (
        <div className="bg-gray-800 rounded-lg p-3 space-y-2 border border-gray-700 mb-4">
          <h3 className="text-sm font-semibold text-white">Create Organization</h3>
          <input
            type="text"
            placeholder="Organization Name"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gotruf-500"
          />
          <select
            value={newOrgPlan}
            onChange={(e) => setNewOrgPlan(e.target.value)}
            className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-gotruf-500"
          >
            {PLAN_OPTIONS.map((plan) => (
              <option key={plan} value={plan}>
                {plan.charAt(0).toUpperCase() + plan.slice(1)}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleCreateOrg}
              disabled={loading || !newOrgName.trim()}
              className="flex-1 py-1.5 bg-gotruf-600 hover:bg-gotruf-700 text-white text-sm rounded transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => { setShowCreateForm(false); setNewOrgName(''); }}
              className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Organization details */}
      {org && (
        <div className="space-y-3">
          {/* Org header */}
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            {!editingOrg ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-white">{org.name}</h3>
                  <PlanBadge plan={org.plan} />
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <span>{org.memberCount || members.length} member{(org.memberCount || members.length) !== 1 ? 's' : ''}</span>
                  <span className="text-gray-600">|</span>
                  <span>Created {new Date(org.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingOrg(true);
                      setEditName(org.name);
                      setEditPlan(org.plan);
                    }}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDeleteOrg}
                    className="px-3 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs rounded transition-colors border border-red-800/50"
                  >
                    Delete
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">Edit Organization</h3>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-gotruf-500"
                />
                <select
                  value={editPlan}
                  onChange={(e) => setEditPlan(e.target.value)}
                  className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-gotruf-500"
                >
                  {PLAN_OPTIONS.map((plan) => (
                    <option key={plan} value={plan}>
                      {plan.charAt(0).toUpperCase() + plan.slice(1)}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdateOrg}
                    disabled={loading}
                    className="flex-1 py-1.5 bg-gotruf-600 hover:bg-gotruf-700 text-white text-sm rounded transition-colors disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingOrg(false)}
                    className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Invite member */}
          {!showInviteForm && (
            <button
              onClick={() => setShowInviteForm(true)}
              className="w-full py-2 bg-gotruf-600 hover:bg-gotruf-700 text-white text-sm font-medium rounded transition-colors"
            >
              + Invite Member
            </button>
          )}

          {showInviteForm && (
            <div className="bg-gray-800 rounded-lg p-3 space-y-2 border border-gray-700">
              <h3 className="text-sm font-semibold text-white">Invite Member</h3>
              <input
                type="email"
                placeholder="Email Address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gotruf-500"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as UserRole)}
                className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-gotruf-500"
              >
                {ALL_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={handleInviteMember}
                  disabled={loading || !inviteEmail.trim()}
                  className="flex-1 py-1.5 bg-gotruf-600 hover:bg-gotruf-700 text-white text-sm rounded transition-colors disabled:opacity-50"
                >
                  {loading ? 'Inviting...' : 'Send Invite'}
                </button>
                <button
                  onClick={() => { setShowInviteForm(false); setInviteEmail(''); }}
                  className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Members list */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Members ({members.length})
            </h3>
            {members.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">No members yet.</p>
            )}
            {members.map((member) => (
              <div
                key={member.id}
                className="bg-gray-800 rounded-lg p-3 border border-gray-700"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white">
                    {member.userName || member.username}
                  </span>
                  <RoleBadge role={member.role} />
                </div>
                <p className="text-xs text-gray-400 mb-2">{member.email}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Joined {new Date(member.joinedAt).toLocaleDateString()}</span>
                  {member.lastActiveAt && (
                    <>
                      <span className="text-gray-600">|</span>
                      <span>Active {new Date(member.lastActiveAt).toLocaleDateString()}</span>
                    </>
                  )}
                </div>
                {/* Role change and remove */}
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-700">
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member, e.target.value as UserRole)}
                    className="flex-1 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-gray-300 focus:outline-none focus:border-gotruf-500"
                  >
                    {ALL_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleRemoveMember(member)}
                    className="px-2 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs rounded transition-colors border border-red-800/50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
