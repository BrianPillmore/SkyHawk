import { useState } from 'react';
import { useStore } from '../../store/useStore';
import type { AdjusterSpecialty, InspectionStatus } from '../../types';
import {
  ADJUSTER_SPECIALTY_LABELS,
  ADJUSTER_STATUS_COLORS,
  INSPECTION_STATUS_LABELS,
  INSPECTION_STATUS_COLORS,
} from '../../types';

const SPECIALTY_OPTIONS: AdjusterSpecialty[] = ['residential', 'commercial', 'catastrophe', 'general'];

export default function AdjusterPanel() {
  const {
    properties,
    activePropertyId,
    adjusters,
    inspections,
    addAdjuster,
    updateAdjusterStatus,
    deleteAdjuster,
    scheduleInspection,
    updateInspectionStatus,
    cancelInspection,
    deleteInspection,
  } = useStore();

  // Adjuster form state
  const [showAdjusterForm, setShowAdjusterForm] = useState(false);
  const [adjName, setAdjName] = useState('');
  const [adjEmail, setAdjEmail] = useState('');
  const [adjPhone, setAdjPhone] = useState('');
  const [adjSpecialty, setAdjSpecialty] = useState<AdjusterSpecialty>('general');

  // Inspection form state
  const [showInspectionForm, setShowInspectionForm] = useState(false);
  const [inspClaimId, setInspClaimId] = useState('');
  const [inspAdjusterId, setInspAdjusterId] = useState('');
  const [inspDate, setInspDate] = useState('');
  const [inspTime, setInspTime] = useState('');
  const [inspNotes, setInspNotes] = useState('');

  // Collect all claims across properties
  const allClaims = properties.flatMap((p) => (p.claims || []).map((c) => ({ ...c, propertyAddress: p.address })));

  // Helpers
  const getClaimNumber = (claimId: string) => {
    const claim = allClaims.find((c) => c.id === claimId);
    return claim ? claim.claimNumber : 'Unknown';
  };

  const getAdjusterName = (adjusterId: string) => {
    const adj = adjusters.find((a) => a.id === adjusterId);
    return adj ? adj.name : 'Unknown';
  };

  const handleAddAdjuster = () => {
    if (!adjName.trim()) return;
    addAdjuster(adjName.trim(), adjEmail.trim(), adjPhone.trim(), adjSpecialty);
    setAdjName('');
    setAdjEmail('');
    setAdjPhone('');
    setAdjSpecialty('general');
    setShowAdjusterForm(false);
  };

  const handleSchedule = () => {
    if (!inspClaimId || !inspAdjusterId || !inspDate || !inspTime) return;
    scheduleInspection(inspClaimId, inspAdjusterId, inspDate, inspTime, inspNotes.trim());
    setInspClaimId('');
    setInspAdjusterId('');
    setInspDate('');
    setInspTime('');
    setInspNotes('');
    setShowInspectionForm(false);
  };

  const availableAdjusters = adjusters.filter((a) => a.status === 'available');

  // Sort inspections: scheduled first, then in-progress, completed, cancelled
  const statusOrder: Record<InspectionStatus, number> = {
    'scheduled': 0,
    'in-progress': 1,
    'completed': 2,
    'cancelled': 3,
  };
  const sortedInspections = [...inspections].sort(
    (a, b) => statusOrder[a.status] - statusOrder[b.status]
  );

  return (
    <div className="p-3 space-y-4">
      {/* ── Adjuster Roster ──────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Adjusters ({adjusters.length})
          </h3>
          <button
            onClick={() => setShowAdjusterForm(!showAdjusterForm)}
            className="px-2 py-1 text-[10px] font-medium bg-skyhawk-600 hover:bg-skyhawk-500 text-white rounded transition-colors"
          >
            {showAdjusterForm ? 'Cancel' : '+ Add'}
          </button>
        </div>

        {/* Add adjuster form */}
        {showAdjusterForm && (
          <div className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg space-y-2 mb-2">
            <input
              type="text"
              value={adjName}
              onChange={(e) => setAdjName(e.target.value)}
              placeholder="Name *"
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-skyhawk-500"
            />
            <input
              type="email"
              value={adjEmail}
              onChange={(e) => setAdjEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-skyhawk-500"
            />
            <input
              type="tel"
              value={adjPhone}
              onChange={(e) => setAdjPhone(e.target.value)}
              placeholder="Phone"
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-skyhawk-500"
            />
            <select
              value={adjSpecialty}
              onChange={(e) => setAdjSpecialty(e.target.value as AdjusterSpecialty)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-skyhawk-500"
            >
              {SPECIALTY_OPTIONS.map((sp) => (
                <option key={sp} value={sp}>
                  {ADJUSTER_SPECIALTY_LABELS[sp]}
                </option>
              ))}
            </select>
            <button
              onClick={handleAddAdjuster}
              disabled={!adjName.trim()}
              className="w-full px-3 py-1.5 bg-skyhawk-600 hover:bg-skyhawk-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-medium rounded transition-colors"
            >
              Add Adjuster
            </button>
          </div>
        )}

        {/* Adjuster list */}
        {adjusters.length === 0 && !showAdjusterForm && (
          <div className="text-xs text-gray-500 text-center py-4">
            No adjusters yet. Add one to start scheduling inspections.
          </div>
        )}

        <div className="space-y-1.5">
          {adjusters.map((adj) => (
            <div
              key={adj.id}
              className="flex items-center justify-between px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-300 font-medium truncate">
                    {adj.name}
                  </span>
                  <span
                    className="px-1.5 py-0.5 text-[10px] rounded font-medium shrink-0"
                    style={{
                      backgroundColor: ADJUSTER_STATUS_COLORS[adj.status] + '22',
                      color: ADJUSTER_STATUS_COLORS[adj.status],
                    }}
                  >
                    {adj.status}
                  </span>
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {ADJUSTER_SPECIALTY_LABELS[adj.specialty]}
                  {adj.phone && <span className="ml-2">{adj.phone}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                {adj.status !== 'available' && adj.status !== 'unavailable' && (
                  <button
                    onClick={() => updateAdjusterStatus(adj.id, 'available')}
                    title="Set available"
                    className="px-1.5 py-0.5 text-[10px] text-green-400/70 hover:text-green-400 hover:bg-green-900/20 rounded transition-colors"
                  >
                    Free
                  </button>
                )}
                {adj.status === 'available' && (
                  <button
                    onClick={() => updateAdjusterStatus(adj.id, 'unavailable')}
                    title="Set unavailable"
                    className="px-1.5 py-0.5 text-[10px] text-gray-400/70 hover:text-gray-400 hover:bg-gray-700/50 rounded transition-colors"
                  >
                    Off
                  </button>
                )}
                {adj.status === 'unavailable' && (
                  <button
                    onClick={() => updateAdjusterStatus(adj.id, 'available')}
                    title="Set available"
                    className="px-1.5 py-0.5 text-[10px] text-green-400/70 hover:text-green-400 hover:bg-green-900/20 rounded transition-colors"
                  >
                    On
                  </button>
                )}
                <button
                  onClick={() => deleteAdjuster(adj.id)}
                  title="Delete adjuster"
                  className="px-1.5 py-0.5 text-[10px] text-red-400/70 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                >
                  Del
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Inspection Scheduler ─────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Schedule Inspection
          </h3>
          <button
            onClick={() => setShowInspectionForm(!showInspectionForm)}
            className="px-2 py-1 text-[10px] font-medium bg-skyhawk-600 hover:bg-skyhawk-500 text-white rounded transition-colors"
          >
            {showInspectionForm ? 'Cancel' : '+ New'}
          </button>
        </div>

        {showInspectionForm && (
          <div className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg space-y-2 mb-2">
            {/* Claim selector */}
            <select
              value={inspClaimId}
              onChange={(e) => setInspClaimId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-skyhawk-500"
            >
              <option value="">Select claim *</option>
              {allClaims.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.claimNumber} - {c.insuredName || c.propertyAddress}
                </option>
              ))}
            </select>

            {/* Adjuster selector */}
            <select
              value={inspAdjusterId}
              onChange={(e) => setInspAdjusterId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-skyhawk-500"
            >
              <option value="">Select adjuster *</option>
              {availableAdjusters.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({ADJUSTER_SPECIALTY_LABELS[a.specialty]})
                </option>
              ))}
              {availableAdjusters.length === 0 && (
                <option value="" disabled>
                  No available adjusters
                </option>
              )}
            </select>

            {/* Date & time */}
            <div className="flex gap-2">
              <input
                type="date"
                value={inspDate}
                onChange={(e) => setInspDate(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-skyhawk-500"
              />
              <input
                type="time"
                value={inspTime}
                onChange={(e) => setInspTime(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-skyhawk-500"
              />
            </div>

            {/* Notes */}
            <textarea
              value={inspNotes}
              onChange={(e) => setInspNotes(e.target.value)}
              rows={2}
              placeholder="Inspection notes..."
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-skyhawk-500 resize-none"
            />

            <button
              onClick={handleSchedule}
              disabled={!inspClaimId || !inspAdjusterId || !inspDate || !inspTime}
              className="w-full px-3 py-1.5 bg-skyhawk-600 hover:bg-skyhawk-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-medium rounded transition-colors"
            >
              Schedule Inspection
            </button>
          </div>
        )}
      </div>

      {/* ── Upcoming Inspections ─────────────────────────── */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Inspections ({inspections.length})
        </h3>

        {inspections.length === 0 && (
          <div className="text-xs text-gray-500 text-center py-4">
            No inspections scheduled. Create one above.
          </div>
        )}

        <div className="space-y-2">
          {sortedInspections.map((insp) => (
            <div
              key={insp.id}
              className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 space-y-2"
            >
              {/* Inspection header */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300 font-medium">
                  Claim {getClaimNumber(insp.claimId)}
                </span>
                <span
                  className="px-1.5 py-0.5 text-[10px] rounded font-medium"
                  style={{
                    backgroundColor: INSPECTION_STATUS_COLORS[insp.status] + '22',
                    color: INSPECTION_STATUS_COLORS[insp.status],
                  }}
                >
                  {INSPECTION_STATUS_LABELS[insp.status]}
                </span>
              </div>

              {/* Details */}
              <div className="space-y-0.5 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">Adjuster</span>
                  <span className="text-gray-300">{getAdjusterName(insp.adjusterId)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date</span>
                  <span className="text-gray-300">{insp.scheduledDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Time</span>
                  <span className="text-gray-300">{insp.scheduledTime}</span>
                </div>
                {insp.notes && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Notes</span>
                    <span className="text-gray-300 text-right max-w-[60%] truncate">{insp.notes}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              {insp.status !== 'completed' && insp.status !== 'cancelled' && (
                <div className="flex flex-wrap gap-1 pt-1 border-t border-gray-700/50">
                  {insp.status === 'scheduled' && (
                    <button
                      onClick={() => updateInspectionStatus(insp.id, 'in-progress')}
                      className="px-1.5 py-0.5 text-[10px] text-amber-400/80 hover:text-amber-400 hover:bg-amber-900/20 border border-gray-700 rounded transition-colors"
                    >
                      Start
                    </button>
                  )}
                  {(insp.status === 'scheduled' || insp.status === 'in-progress') && (
                    <button
                      onClick={() => updateInspectionStatus(insp.id, 'completed')}
                      className="px-1.5 py-0.5 text-[10px] text-green-400/80 hover:text-green-400 hover:bg-green-900/20 border border-gray-700 rounded transition-colors"
                    >
                      Complete
                    </button>
                  )}
                  <button
                    onClick={() => cancelInspection(insp.id)}
                    className="px-1.5 py-0.5 text-[10px] text-gray-400/70 hover:text-gray-400 hover:bg-gray-700/50 border border-gray-700 rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Delete (always available) */}
              <button
                onClick={() => deleteInspection(insp.id)}
                className="w-full px-2 py-1 text-[10px] text-red-400/70 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
