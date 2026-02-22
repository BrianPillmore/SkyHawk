import { useState } from 'react';
import type { UserRole, AuditLogEntry, OrganizationMember, ApiKey } from '../../types/enterprise';
import { ROLE_LABELS, ROLE_COLORS } from '../../types/enterprise';
import {
  formatAuditAction,
  createAuditEntry,
  filterAuditLog,
  maskApiKey,
  generateApiKeyPrefix,
  getRoleHierarchy,
} from '../../utils/enterprise';

type TabId = 'team' | 'audit' | 'apikeys';

const INITIAL_MEMBERS: OrganizationMember[] = [
  {
    id: 'm1',
    organizationId: 'org1',
    userId: 'u1',
    userName: 'Sarah Chen',
    email: 'sarah@skyhawk.io',
    role: 'admin',
    joinedAt: '2025-01-15T10:00:00Z',
    lastActiveAt: '2026-02-22T09:30:00Z',
  },
  {
    id: 'm2',
    organizationId: 'org1',
    userId: 'u2',
    userName: 'James Rodriguez',
    email: 'james@skyhawk.io',
    role: 'manager',
    joinedAt: '2025-03-10T14:00:00Z',
    lastActiveAt: '2026-02-21T16:45:00Z',
  },
  {
    id: 'm3',
    organizationId: 'org1',
    userId: 'u3',
    userName: 'Mike Thompson',
    email: 'mike@skyhawk.io',
    role: 'adjuster',
    joinedAt: '2025-06-01T08:00:00Z',
    lastActiveAt: '2026-02-20T11:15:00Z',
  },
  {
    id: 'm4',
    organizationId: 'org1',
    userId: 'u4',
    userName: 'Lisa Park',
    email: 'lisa@skyhawk.io',
    role: 'roofer',
    joinedAt: '2025-08-20T12:00:00Z',
    lastActiveAt: '2026-02-19T14:00:00Z',
  },
  {
    id: 'm5',
    organizationId: 'org1',
    userId: 'u5',
    userName: 'Tom Davis',
    email: 'tom@skyhawk.io',
    role: 'viewer',
    joinedAt: '2025-11-05T09:00:00Z',
    lastActiveAt: '2026-02-18T10:30:00Z',
  },
];

const INITIAL_AUDIT_LOG: AuditLogEntry[] = [
  createAuditEntry('u1', 'Sarah Chen', 'property.create', 'property', 'p1', 'Created property at 123 Main St'),
  createAuditEntry('u2', 'James Rodriguez', 'measurement.create', 'measurement', 'ms1', 'New roof measurement for 123 Main St'),
  createAuditEntry('u3', 'Mike Thompson', 'claim.update', 'claim', 'c1', 'Updated claim status to in-progress'),
  createAuditEntry('u1', 'Sarah Chen', 'report.generate', 'report', 'r1', 'Generated PDF report for 123 Main St'),
  createAuditEntry('u2', 'James Rodriguez', 'user.invite', 'user', 'u5', 'Invited Tom Davis as viewer'),
  createAuditEntry('u1', 'Sarah Chen', 'export.csv', 'export', 'e1', 'Exported measurements to CSV'),
  createAuditEntry('u3', 'Mike Thompson', 'inspection.schedule', 'inspection', 'i1', 'Scheduled inspection for 456 Oak Ave'),
  createAuditEntry('u4', 'Lisa Park', 'measurement.create', 'measurement', 'ms2', 'New measurement for 789 Pine Rd'),
];

const INITIAL_API_KEYS: ApiKey[] = [
  {
    id: 'ak1',
    name: 'Production API',
    prefix: 'aBcDeFgH',
    createdAt: '2025-06-15T10:00:00Z',
    lastUsedAt: '2026-02-22T08:00:00Z',
    expiresAt: '2027-06-15T10:00:00Z',
    permissions: [{ resource: 'properties', actions: ['read'] }, { resource: 'measurements', actions: ['read'] }],
  },
  {
    id: 'ak2',
    name: 'CI/CD Integration',
    prefix: 'XyZ12345',
    createdAt: '2025-09-01T14:00:00Z',
    lastUsedAt: '2026-02-21T22:00:00Z',
    expiresAt: null,
    permissions: [{ resource: 'reports', actions: ['create', 'read'] }],
  },
];

const ALL_ROLES: UserRole[] = ['admin', 'manager', 'adjuster', 'roofer', 'viewer'];

const AUDIT_ACTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Actions' },
  { value: 'property.create', label: 'Property Created' },
  { value: 'property.update', label: 'Property Updated' },
  { value: 'property.delete', label: 'Property Deleted' },
  { value: 'measurement.create', label: 'Measurement Created' },
  { value: 'measurement.update', label: 'Measurement Updated' },
  { value: 'report.generate', label: 'Report Generated' },
  { value: 'report.download', label: 'Report Downloaded' },
  { value: 'claim.create', label: 'Claim Created' },
  { value: 'claim.update', label: 'Claim Updated' },
  { value: 'inspection.schedule', label: 'Inspection Scheduled' },
  { value: 'user.invite', label: 'User Invited' },
  { value: 'user.remove', label: 'User Removed' },
  { value: 'user.role_change', label: 'Role Changed' },
  { value: 'export.json', label: 'Exported JSON' },
  { value: 'export.csv', label: 'Exported CSV' },
  { value: 'export.geojson', label: 'Exported GeoJSON' },
  { value: 'export.esx', label: 'Exported ESX' },
];

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: ROLE_COLORS[role] + '22', color: ROLE_COLORS[role], border: `1px solid ${ROLE_COLORS[role]}44` }}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

export default function EnterprisePanel() {
  const [activeTab, setActiveTab] = useState<TabId>('team');
  const [members, setMembers] = useState<OrganizationMember[]>(INITIAL_MEMBERS);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOG);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(INITIAL_API_KEYS);

  // Invite form state
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('viewer');
  const [showInviteForm, setShowInviteForm] = useState(false);

  // Audit filter state
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');

  // API key form state
  const [newKeyName, setNewKeyName] = useState('');
  const [showKeyForm, setShowKeyForm] = useState(false);

  // Current user role (mock - admin for demo)
  const currentUserRole: UserRole = 'admin';

  // --- Team Tab Handlers ---
  const handleInviteMember = () => {
    if (!inviteName.trim() || !inviteEmail.trim()) return;

    const newMember: OrganizationMember = {
      id: `m${Date.now()}`,
      organizationId: 'org1',
      userId: `u${Date.now()}`,
      userName: inviteName.trim(),
      email: inviteEmail.trim(),
      role: inviteRole,
      joinedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    setMembers((prev) => [...prev, newMember]);

    const entry = createAuditEntry(
      'u1', 'Sarah Chen', 'user.invite', 'user', newMember.userId,
      `Invited ${newMember.userName} as ${ROLE_LABELS[newMember.role]}`
    );
    setAuditLog((prev) => [entry, ...prev]);

    setInviteName('');
    setInviteEmail('');
    setInviteRole('viewer');
    setShowInviteForm(false);
  };

  const handleRoleChange = (memberId: string, newRole: UserRole) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    );
    const member = members.find((m) => m.id === memberId);
    if (member) {
      const entry = createAuditEntry(
        'u1', 'Sarah Chen', 'user.role_change', 'user', member.userId,
        `Changed ${member.userName} role to ${ROLE_LABELS[newRole]}`
      );
      setAuditLog((prev) => [entry, ...prev]);
    }
  };

  const handleRemoveMember = (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;
    if (member.role === 'admin') return; // Cannot remove admin

    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    const entry = createAuditEntry(
      'u1', 'Sarah Chen', 'user.remove', 'user', member.userId,
      `Removed ${member.userName} from organization`
    );
    setAuditLog((prev) => [entry, ...prev]);
  };

  // --- Audit Tab ---
  const filteredAuditLog = filterAuditLog(auditLog, {
    action: auditActionFilter ? (auditActionFilter as AuditLogEntry['action']) : undefined,
    startDate: auditStartDate ? new Date(auditStartDate).toISOString() : undefined,
    endDate: auditEndDate ? new Date(auditEndDate + 'T23:59:59').toISOString() : undefined,
  });

  // --- API Keys Tab ---
  const handleCreateApiKey = () => {
    if (!newKeyName.trim()) return;

    const newKey: ApiKey = {
      id: `ak${Date.now()}`,
      name: newKeyName.trim(),
      prefix: generateApiKeyPrefix(),
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      expiresAt: null,
      permissions: [{ resource: '*', actions: ['read'] }],
    };

    setApiKeys((prev) => [...prev, newKey]);
    setNewKeyName('');
    setShowKeyForm(false);
  };

  const handleRevokeKey = (keyId: string) => {
    setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: 'team', label: 'Team' },
    { id: 'audit', label: 'Audit Log' },
    { id: 'apikeys', label: 'API Keys' },
  ];

  return (
    <div className="p-4 text-gray-200">
      <h2 className="text-lg font-bold mb-3 text-white">Enterprise</h2>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 bg-gray-800 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-1.5 px-2 text-xs font-medium rounded transition-colors ${
              activeTab === tab.id
                ? 'bg-skyhawk-600 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Team Tab */}
      {activeTab === 'team' && (
        <div className="space-y-3">
          {/* Invite button */}
          {!showInviteForm && (
            <button
              onClick={() => setShowInviteForm(true)}
              className="w-full py-2 bg-skyhawk-600 hover:bg-skyhawk-700 text-white text-sm font-medium rounded transition-colors"
            >
              + Invite Member
            </button>
          )}

          {/* Invite form */}
          {showInviteForm && (
            <div className="bg-gray-800 rounded-lg p-3 space-y-2 border border-gray-700">
              <h3 className="text-sm font-semibold text-white">Invite Member</h3>
              <input
                type="text"
                placeholder="Full Name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-skyhawk-500"
              />
              <input
                type="email"
                placeholder="Email Address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-skyhawk-500"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as UserRole)}
                className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-skyhawk-500"
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
                  className="flex-1 py-1.5 bg-skyhawk-600 hover:bg-skyhawk-700 text-white text-sm rounded transition-colors"
                >
                  Send Invite
                </button>
                <button
                  onClick={() => setShowInviteForm(false)}
                  className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Members list */}
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="bg-gray-800 rounded-lg p-3 border border-gray-700"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white">{member.userName}</span>
                  <RoleBadge role={member.role} />
                </div>
                <p className="text-xs text-gray-400 mb-2">{member.email}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Joined {new Date(member.joinedAt).toLocaleDateString()}</span>
                  <span className="text-gray-600">|</span>
                  <span>Active {new Date(member.lastActiveAt).toLocaleDateString()}</span>
                </div>
                {/* Role change and remove controls */}
                {getRoleHierarchy(currentUserRole) > getRoleHierarchy(member.role) && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-700">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value as UserRole)}
                      className="flex-1 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-gray-300 focus:outline-none focus:border-skyhawk-500"
                    >
                      {ALL_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="px-2 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs rounded transition-colors border border-red-800/50"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="bg-gray-800 rounded-lg p-3 space-y-2 border border-gray-700">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Filters</h3>
            <select
              value={auditActionFilter}
              onChange={(e) => setAuditActionFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-skyhawk-500"
            >
              {AUDIT_ACTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="date"
                value={auditStartDate}
                onChange={(e) => setAuditStartDate(e.target.value)}
                className="flex-1 px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-skyhawk-500"
                placeholder="Start date"
              />
              <input
                type="date"
                value={auditEndDate}
                onChange={(e) => setAuditEndDate(e.target.value)}
                className="flex-1 px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-skyhawk-500"
                placeholder="End date"
              />
            </div>
          </div>

          {/* Audit entries */}
          <div className="space-y-1">
            {filteredAuditLog.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">No audit entries match the current filters.</p>
            )}
            {filteredAuditLog.map((entry) => (
              <div
                key={entry.id}
                className="bg-gray-800 rounded p-2.5 border border-gray-700"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-skyhawk-400">
                    {formatAuditAction(entry.action)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-gray-300">{entry.details}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <span>{entry.userName}</span>
                  <span className="text-gray-600">|</span>
                  <span>{entry.resourceType}/{entry.resourceId}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* API Keys Tab */}
      {activeTab === 'apikeys' && (
        <div className="space-y-3">
          {/* Create key button */}
          {!showKeyForm && (
            <button
              onClick={() => setShowKeyForm(true)}
              className="w-full py-2 bg-skyhawk-600 hover:bg-skyhawk-700 text-white text-sm font-medium rounded transition-colors"
            >
              + Create API Key
            </button>
          )}

          {/* Create key form */}
          {showKeyForm && (
            <div className="bg-gray-800 rounded-lg p-3 space-y-2 border border-gray-700">
              <h3 className="text-sm font-semibold text-white">Create API Key</h3>
              <input
                type="text"
                placeholder="Key Name (e.g., Production API)"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-skyhawk-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateApiKey}
                  className="flex-1 py-1.5 bg-skyhawk-600 hover:bg-skyhawk-700 text-white text-sm rounded transition-colors"
                >
                  Create Key
                </button>
                <button
                  onClick={() => { setShowKeyForm(false); setNewKeyName(''); }}
                  className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* API keys list */}
          <div className="space-y-2">
            {apiKeys.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">No API keys created yet.</p>
            )}
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="bg-gray-800 rounded-lg p-3 border border-gray-700"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white">{key.name}</span>
                  <button
                    onClick={() => handleRevokeKey(key.id)}
                    className="px-2 py-0.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs rounded transition-colors border border-red-800/50"
                  >
                    Revoke
                  </button>
                </div>
                <p className="text-xs font-mono text-skyhawk-400 mb-1">
                  {maskApiKey(key.prefix)}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Created {new Date(key.createdAt).toLocaleDateString()}</span>
                  {key.lastUsedAt && (
                    <>
                      <span className="text-gray-600">|</span>
                      <span>Last used {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                    </>
                  )}
                  {key.expiresAt && (
                    <>
                      <span className="text-gray-600">|</span>
                      <span>Expires {new Date(key.expiresAt).toLocaleDateString()}</span>
                    </>
                  )}
                  {!key.expiresAt && (
                    <>
                      <span className="text-gray-600">|</span>
                      <span>No expiry</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
