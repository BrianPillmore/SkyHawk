import { useState } from 'react';
import { useStore } from '../../store/useStore';
import type { ClaimStatus } from '../../types';
import { CLAIM_STATUS_LABELS, CLAIM_STATUS_COLORS } from '../../types';

const STATUS_ORDER: ClaimStatus[] = ['new', 'inspected', 'estimated', 'submitted', 'approved', 'denied', 'closed'];

export default function ClaimsPanel() {
  const {
    properties, activePropertyId,
    addClaim, updateClaimStatus, updateClaimNotes, deleteClaim,
  } = useStore();

  const [showForm, setShowForm] = useState(false);
  const [claimNumber, setClaimNumber] = useState('');
  const [insuredName, setInsuredName] = useState('');
  const [dateOfLoss, setDateOfLoss] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const property = properties.find((p) => p.id === activePropertyId);
  const claims = property?.claims || [];

  const handleAdd = () => {
    if (!claimNumber.trim()) return;
    addClaim(claimNumber.trim(), insuredName.trim(), dateOfLoss);
    setClaimNumber('');
    setInsuredName('');
    setDateOfLoss('');
    setShowForm(false);
  };

  if (!activePropertyId) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        Select a property to manage claims.
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Claims ({claims.length})
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-2 py-1 text-[10px] font-medium bg-gotruf-600 hover:bg-gotruf-500 text-white rounded transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Claim'}
        </button>
      </div>

      {/* New claim form */}
      {showForm && (
        <div className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg space-y-2">
          <input
            type="text"
            value={claimNumber}
            onChange={(e) => setClaimNumber(e.target.value)}
            placeholder="Claim number *"
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-gotruf-500"
          />
          <input
            type="text"
            value={insuredName}
            onChange={(e) => setInsuredName(e.target.value)}
            placeholder="Insured name"
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-gotruf-500"
          />
          <input
            type="date"
            value={dateOfLoss}
            onChange={(e) => setDateOfLoss(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-gotruf-500"
          />
          <button
            onClick={handleAdd}
            disabled={!claimNumber.trim()}
            className="w-full px-3 py-1.5 bg-gotruf-600 hover:bg-gotruf-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-medium rounded transition-colors"
          >
            Create Claim
          </button>
        </div>
      )}

      {/* Claims list */}
      {claims.length === 0 && !showForm && (
        <div className="text-xs text-gray-500 text-center py-6">
          No claims yet. Create one to track insurance claims for this property.
        </div>
      )}

      <div className="space-y-2">
        {claims.map((claim) => {
          const isExpanded = expandedId === claim.id;

          return (
            <div
              key={claim.id}
              className="bg-gray-800/50 border border-gray-700/50 rounded-lg overflow-hidden"
            >
              {/* Claim header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : claim.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: CLAIM_STATUS_COLORS[claim.status] }}
                  />
                  <span className="text-xs text-gray-300 font-medium truncate">
                    {claim.claimNumber}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="px-1.5 py-0.5 text-[10px] rounded font-medium"
                    style={{
                      backgroundColor: CLAIM_STATUS_COLORS[claim.status] + '22',
                      color: CLAIM_STATUS_COLORS[claim.status],
                    }}
                  >
                    {CLAIM_STATUS_LABELS[claim.status]}
                  </span>
                  <span className="text-gray-600 text-xs">{isExpanded ? '\u25B4' : '\u25BE'}</span>
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-3 border-t border-gray-700/50">
                  {/* Info */}
                  <div className="pt-2 space-y-1 text-[10px]">
                    {claim.insuredName && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Insured</span>
                        <span className="text-gray-300">{claim.insuredName}</span>
                      </div>
                    )}
                    {claim.dateOfLoss && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Date of Loss</span>
                        <span className="text-gray-300">{claim.dateOfLoss}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Created</span>
                      <span className="text-gray-300">{new Date(claim.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Status update */}
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Status</label>
                    <div className="flex flex-wrap gap-1">
                      {STATUS_ORDER.map((st) => (
                        <button
                          key={st}
                          onClick={() => updateClaimStatus(claim.id, st)}
                          className={`px-1.5 py-0.5 text-[10px] rounded transition-colors border ${
                            claim.status === st
                              ? 'border-white/30 font-medium'
                              : 'border-gray-700 text-gray-500 hover:text-gray-300'
                          }`}
                          style={{
                            backgroundColor: claim.status === st
                              ? CLAIM_STATUS_COLORS[st] + '33'
                              : 'transparent',
                            color: claim.status === st ? CLAIM_STATUS_COLORS[st] : undefined,
                          }}
                        >
                          {CLAIM_STATUS_LABELS[st]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Notes</label>
                    <textarea
                      value={claim.notes}
                      onChange={(e) => updateClaimNotes(claim.id, e.target.value)}
                      rows={2}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-gotruf-500 resize-none"
                      placeholder="Add claim notes..."
                    />
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => { deleteClaim(claim.id); setExpandedId(null); }}
                    className="w-full px-2 py-1 text-[10px] text-red-400/70 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                  >
                    Delete Claim
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
