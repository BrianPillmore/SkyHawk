import { useState, useEffect, useCallback } from 'react';
import type { SharedReport } from '../../types/enterprise';
import {
  shareProperty,
  listShares,
  revokeShare,
} from '../../services/enterpriseApi';

const PERMISSION_OPTIONS: { value: 'view' | 'comment' | 'edit'; label: string }[] = [
  { value: 'view', label: 'View Only' },
  { value: 'comment', label: 'Can Comment' },
  { value: 'edit', label: 'Can Edit' },
];

const PERMISSION_COLORS: Record<string, string> = {
  view: '#6b7280',
  comment: '#3b82f6',
  edit: '#f59e0b',
};

function PermissionBadge({ permission }: { permission: string }) {
  const color = PERMISSION_COLORS[permission] || '#6b7280';
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
      style={{
        backgroundColor: color + '22',
        color,
        border: `1px solid ${color}44`,
      }}
    >
      {permission}
    </span>
  );
}

export default function SharingPanel() {
  const [shares, setShares] = useState<SharedReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Share form
  const [showShareForm, setShowShareForm] = useState(false);
  const [sharePropertyId, setSharePropertyId] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState<'view' | 'comment' | 'edit'>('view');
  const [shareExpiresAt, setShareExpiresAt] = useState('');

  // Last created share link
  const [lastShareUrl, setLastShareUrl] = useState<string | null>(null);

  const loadShares = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listShares();
      setShares(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shares');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShares();
  }, [loadShares]);

  const handleShare = async () => {
    if (!sharePropertyId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await shareProperty(sharePropertyId.trim(), {
        email: shareEmail.trim() || undefined,
        permissions: sharePermission,
        expiresAt: shareExpiresAt || undefined,
      });
      setLastShareUrl(result.shareUrl);
      setShowShareForm(false);
      setSharePropertyId('');
      setShareEmail('');
      setSharePermission('view');
      setShareExpiresAt('');
      await loadShares();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share property');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (share: SharedReport) => {
    if (!confirm('Are you sure you want to revoke this share link?')) return;
    setError(null);
    try {
      await revokeShare(share.id);
      setShares((prev) => prev.filter((s) => s.id !== share.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke share');
    }
  };

  const handleCopyLink = async (token: string, id: string) => {
    const url = `${window.location.origin}/shared/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback for environments without clipboard API
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="p-4 text-gray-200">
      <h2 className="text-lg font-bold mb-3 text-white">Report Sharing</h2>

      {/* Error display */}
      {error && (
        <div className="mb-3 p-2 bg-red-900/30 border border-red-800/50 rounded text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Last share URL notification */}
      {lastShareUrl && (
        <div className="mb-3 p-3 bg-green-900/30 border border-green-800/50 rounded">
          <p className="text-sm text-green-400 font-medium mb-1">Share link created!</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-green-300 bg-gray-900 px-2 py-1 rounded overflow-x-auto">
              {window.location.origin}{lastShareUrl}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}${lastShareUrl}`);
                setLastShareUrl(null);
              }}
              className="px-2 py-1 bg-green-800/50 hover:bg-green-800 text-green-300 text-xs rounded transition-colors"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Share button */}
      {!showShareForm && (
        <button
          onClick={() => setShowShareForm(true)}
          className="w-full py-2 mb-3 bg-gotruf-600 hover:bg-gotruf-700 text-white text-sm font-medium rounded transition-colors"
        >
          + Share Property / Report
        </button>
      )}

      {/* Share form */}
      {showShareForm && (
        <div className="bg-gray-800 rounded-lg p-3 space-y-2 border border-gray-700 mb-3">
          <h3 className="text-sm font-semibold text-white">Share Property</h3>
          <input
            type="text"
            placeholder="Property ID"
            value={sharePropertyId}
            onChange={(e) => setSharePropertyId(e.target.value)}
            className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gotruf-500"
          />
          <input
            type="email"
            placeholder="Recipient Email (optional)"
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gotruf-500"
          />
          <select
            value={sharePermission}
            onChange={(e) => setSharePermission(e.target.value as 'view' | 'comment' | 'edit')}
            className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-gotruf-500"
          >
            {PERMISSION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Expiration Date (optional)</label>
            <input
              type="datetime-local"
              value={shareExpiresAt}
              onChange={(e) => setShareExpiresAt(e.target.value)}
              className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-gotruf-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              disabled={loading || !sharePropertyId.trim()}
              className="flex-1 py-1.5 bg-gotruf-600 hover:bg-gotruf-700 text-white text-sm rounded transition-colors disabled:opacity-50"
            >
              {loading ? 'Sharing...' : 'Create Share Link'}
            </button>
            <button
              onClick={() => {
                setShowShareForm(false);
                setSharePropertyId('');
                setShareEmail('');
                setSharePermission('view');
                setShareExpiresAt('');
              }}
              className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Shares list */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Active Shares ({shares.length})
        </h3>

        {loading && shares.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-4">Loading shares...</p>
        )}

        {!loading && shares.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-4">
            No shared reports yet. Share a property to generate a link.
          </p>
        )}

        {shares.map((share) => (
          <div
            key={share.id}
            className={`bg-gray-800 rounded-lg p-3 border ${
              isExpired(share.expiresAt)
                ? 'border-red-800/50 opacity-60'
                : 'border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-white truncate">
                {share.propertyAddress || share.propertyId}
              </span>
              <PermissionBadge permission={share.permissions} />
            </div>
            {share.sharedWithEmail && (
              <p className="text-xs text-gray-400 mb-1">
                Shared with: {share.sharedWithEmail}
              </p>
            )}
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <span>Created {new Date(share.createdAt).toLocaleDateString()}</span>
              {share.expiresAt && (
                <>
                  <span className="text-gray-600">|</span>
                  <span className={isExpired(share.expiresAt) ? 'text-red-400' : ''}>
                    {isExpired(share.expiresAt) ? 'Expired' : `Expires ${new Date(share.expiresAt).toLocaleDateString()}`}
                  </span>
                </>
              )}
              {!share.expiresAt && (
                <>
                  <span className="text-gray-600">|</span>
                  <span>No expiry</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopyLink(share.shareToken, share.id)}
                className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors"
              >
                {copiedId === share.id ? 'Copied!' : 'Copy Link'}
              </button>
              <button
                onClick={() => handleRevoke(share)}
                className="px-2 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs rounded transition-colors border border-red-800/50"
              >
                Revoke
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
