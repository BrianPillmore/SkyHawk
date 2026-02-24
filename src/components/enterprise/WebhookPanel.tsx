import { useState, useEffect, useCallback } from 'react';
import type { Webhook, WebhookEvent } from '../../types/enterprise';
import { WEBHOOK_EVENT_LABELS } from '../../types/enterprise';
import {
  createWebhook,
  listWebhooks,
  updateWebhook,
  deleteWebhook,
  testWebhook,
} from '../../services/enterpriseApi';

const ALL_EVENTS: WebhookEvent[] = [
  'property.created',
  'property.updated',
  'measurement.completed',
  'report.generated',
  'claim.updated',
];

function StatusBadge({ active, failureCount }: { active: boolean; failureCount: number }) {
  if (!active) {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-red-900/30 text-red-400 border border-red-800/50">
        Inactive
      </span>
    );
  }
  if (failureCount > 0) {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-yellow-900/30 text-yellow-400 border border-yellow-800/50">
        Failing ({failureCount})
      </span>
    );
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-green-900/30 text-green-400 border border-green-800/50">
      Active
    </span>
  );
}

export default function WebhookPanel() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ webhookId: string; success: boolean; message: string } | null>(null);

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState<Set<WebhookEvent>>(new Set());
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [editEvents, setEditEvents] = useState<Set<WebhookEvent>>(new Set());

  const loadWebhooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listWebhooks();
      setWebhooks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWebhooks();
  }, [loadWebhooks]);

  const handleCreate = async () => {
    if (!newUrl.trim() || newEvents.size === 0) return;
    setLoading(true);
    setError(null);
    try {
      const result = await createWebhook({
        url: newUrl.trim(),
        events: Array.from(newEvents),
      });
      setCreatedSecret(result.secret);
      setShowCreateForm(false);
      setNewUrl('');
      setNewEvents(new Set());
      await loadWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create webhook');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (webhook: Webhook) => {
    setError(null);
    try {
      const updated = await updateWebhook(webhook.id, { active: !webhook.active });
      setWebhooks((prev) =>
        prev.map((w) => (w.id === webhook.id ? { ...w, ...updated } : w)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update webhook');
    }
  };

  const handleUpdate = async (webhookId: string) => {
    if (!editUrl.trim() || editEvents.size === 0) return;
    setError(null);
    try {
      const updated = await updateWebhook(webhookId, {
        url: editUrl.trim(),
        events: Array.from(editEvents),
      });
      setWebhooks((prev) =>
        prev.map((w) => (w.id === webhookId ? { ...w, ...updated } : w)),
      );
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update webhook');
    }
  };

  const handleDelete = async (webhook: Webhook) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;
    setError(null);
    try {
      await deleteWebhook(webhook.id);
      setWebhooks((prev) => prev.filter((w) => w.id !== webhook.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete webhook');
    }
  };

  const handleTest = async (webhook: Webhook) => {
    setTestResult(null);
    setError(null);
    try {
      const result = await testWebhook(webhook.id);
      setTestResult({
        webhookId: webhook.id,
        success: result.success,
        message: result.success
          ? `Test delivered successfully (HTTP ${result.statusCode})`
          : result.error || 'Test delivery failed',
      });
      setTimeout(() => setTestResult(null), 5000);
    } catch (err) {
      setTestResult({
        webhookId: webhook.id,
        success: false,
        message: err instanceof Error ? err.message : 'Test failed',
      });
    }
  };

  const toggleEvent = (event: WebhookEvent, eventSet: Set<WebhookEvent>, setter: (s: Set<WebhookEvent>) => void) => {
    const next = new Set(eventSet);
    if (next.has(event)) {
      next.delete(event);
    } else {
      next.add(event);
    }
    setter(next);
  };

  return (
    <div className="p-4 text-gray-200">
      <h2 className="text-lg font-bold mb-3 text-white">Webhooks</h2>

      {/* Error display */}
      {error && (
        <div className="mb-3 p-2 bg-red-900/30 border border-red-800/50 rounded text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Created secret notification */}
      {createdSecret && (
        <div className="mb-3 p-3 bg-yellow-900/30 border border-yellow-800/50 rounded">
          <p className="text-sm text-yellow-400 font-medium mb-1">Webhook Secret (save this now!)</p>
          <p className="text-xs text-gray-400 mb-2">This secret will not be shown again. Use it to verify webhook signatures.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-yellow-300 bg-gray-900 px-2 py-1 rounded font-mono overflow-x-auto">
              {createdSecret}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(createdSecret);
                setCreatedSecret(null);
              }}
              className="px-2 py-1 bg-yellow-800/50 hover:bg-yellow-800 text-yellow-300 text-xs rounded transition-colors"
            >
              Copy & Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Create button */}
      {!showCreateForm && (
        <button
          onClick={() => setShowCreateForm(true)}
          className="w-full py-2 mb-3 bg-gotruf-600 hover:bg-gotruf-700 text-white text-sm font-medium rounded transition-colors"
        >
          + Register Webhook
        </button>
      )}

      {/* Create form */}
      {showCreateForm && (
        <div className="bg-gray-800 rounded-lg p-3 space-y-2 border border-gray-700 mb-3">
          <h3 className="text-sm font-semibold text-white">Register Webhook</h3>
          <input
            type="url"
            placeholder="Webhook URL (https://...)"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gotruf-500"
          />
          <div>
            <label className="block text-xs text-gray-400 mb-1">Events</label>
            <div className="space-y-1">
              {ALL_EVENTS.map((event) => (
                <label key={event} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newEvents.has(event)}
                    onChange={() => toggleEvent(event, newEvents, setNewEvents)}
                    className="rounded border-gray-600 bg-gray-900 text-gotruf-600 focus:ring-gotruf-500"
                  />
                  <span className="text-xs text-gray-300">{WEBHOOK_EVENT_LABELS[event]}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={loading || !newUrl.trim() || newEvents.size === 0}
              className="flex-1 py-1.5 bg-gotruf-600 hover:bg-gotruf-700 text-white text-sm rounded transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Webhook'}
            </button>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setNewUrl('');
                setNewEvents(new Set());
              }}
              className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Webhooks list */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Registered Webhooks ({webhooks.length})
        </h3>

        {loading && webhooks.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-4">Loading webhooks...</p>
        )}

        {!loading && webhooks.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-4">
            No webhooks registered. Create one to receive event notifications.
          </p>
        )}

        {webhooks.map((webhook) => (
          <div key={webhook.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            {editingId === webhook.id ? (
              /* Edit mode */
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-white">Edit Webhook</h4>
                <input
                  type="url"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-gotruf-500"
                />
                <div className="space-y-1">
                  {ALL_EVENTS.map((event) => (
                    <label key={event} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editEvents.has(event)}
                        onChange={() => toggleEvent(event, editEvents, setEditEvents)}
                        className="rounded border-gray-600 bg-gray-900 text-gotruf-600 focus:ring-gotruf-500"
                      />
                      <span className="text-xs text-gray-300">{WEBHOOK_EVENT_LABELS[event]}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdate(webhook.id)}
                    className="flex-1 py-1.5 bg-gotruf-600 hover:bg-gotruf-700 text-white text-sm rounded transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* Display mode */
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white truncate mr-2">{webhook.url}</span>
                  <StatusBadge active={webhook.active} failureCount={webhook.failureCount} />
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {webhook.events.map((event) => (
                    <span
                      key={event}
                      className="inline-block px-1.5 py-0.5 bg-gray-700 text-gray-300 text-xs rounded"
                    >
                      {WEBHOOK_EVENT_LABELS[event as WebhookEvent] || event}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  {webhook.lastTriggeredAt && (
                    <span>Last triggered {new Date(webhook.lastTriggeredAt).toLocaleString()}</span>
                  )}
                  {!webhook.lastTriggeredAt && <span>Never triggered</span>}
                  {webhook.createdAt && (
                    <>
                      <span className="text-gray-600">|</span>
                      <span>Created {new Date(webhook.createdAt).toLocaleDateString()}</span>
                    </>
                  )}
                </div>

                {/* Test result */}
                {testResult && testResult.webhookId === webhook.id && (
                  <div
                    className={`mb-2 p-2 rounded text-xs ${
                      testResult.success
                        ? 'bg-green-900/30 border border-green-800/50 text-green-400'
                        : 'bg-red-900/30 border border-red-800/50 text-red-400'
                    }`}
                  >
                    {testResult.message}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(webhook)}
                    className={`px-2 py-1 text-xs rounded transition-colors border ${
                      webhook.active
                        ? 'bg-yellow-900/30 hover:bg-yellow-900/50 text-yellow-400 border-yellow-800/50'
                        : 'bg-green-900/30 hover:bg-green-900/50 text-green-400 border-green-800/50'
                    }`}
                  >
                    {webhook.active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleTest(webhook)}
                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors"
                  >
                    Test
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(webhook.id);
                      setEditUrl(webhook.url);
                      setEditEvents(new Set(webhook.events as WebhookEvent[]));
                    }}
                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(webhook)}
                    className="px-2 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs rounded transition-colors border border-red-800/50"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
