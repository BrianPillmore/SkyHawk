import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import {
  buildPropertyTimeline,
  groupTimelineByDate,
  filterTimelineEvents,
  getTimelineSummary,
  formatEventTime,
} from '../../utils/propertyTimeline';
import {
  TIMELINE_EVENT_ICONS,
  TIMELINE_EVENT_COLORS,
  type TimelineEventType,
} from '../../types/timeline';
import PropertyNotes from './PropertyNotes';

const FILTER_OPTIONS: { value: TimelineEventType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Activity' },
  { value: 'measurement.added', label: 'Measurements' },
  { value: 'damage.annotated', label: 'Damage' },
  { value: 'claim.filed', label: 'Claims' },
  { value: 'snapshot.added', label: 'Photos' },
  { value: 'note.added', label: 'Notes' },
];

export default function PropertyTimeline() {
  const { properties, activePropertyId } = useStore();
  const [filter, setFilter] = useState<TimelineEventType | 'all'>('all');
  const [showNotes, setShowNotes] = useState(false);

  const property = properties.find((p) => p.id === activePropertyId);

  const allEvents = useMemo(
    () => (property ? buildPropertyTimeline(property) : []),
    [property],
  );

  const filteredEvents = useMemo(
    () => filter === 'all' ? allEvents : filterTimelineEvents(allEvents, [filter]),
    [allEvents, filter],
  );

  const groupedEvents = useMemo(
    () => groupTimelineByDate(filteredEvents),
    [filteredEvents],
  );

  if (!property) {
    return (
      <div className="p-6 text-center text-gray-500 text-sm">
        Select a property to view its timeline.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-white">Property Timeline</h2>
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
              showNotes
                ? 'bg-gotruf-600/20 text-gotruf-400 border border-gotruf-600/40'
                : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
            }`}
          >
            + Add Note
          </button>
        </div>

        <p className="text-[11px] text-gray-500 mb-3">{getTimelineSummary(allEvents)}</p>

        {/* Filter chips */}
        <div className="flex gap-1 flex-wrap">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                filter === opt.value
                  ? 'bg-gotruf-600/20 text-gotruf-400 border border-gotruf-600/40'
                  : 'bg-gray-800/50 text-gray-500 border border-gray-700/50 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes input area (collapsible) */}
      {showNotes && (
        <div className="border-b border-gray-800">
          <PropertyNotes propertyId={property.id} onClose={() => setShowNotes(false)} />
        </div>
      )}

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-2xl block mb-2">📭</span>
            <p className="text-sm text-gray-500">No activity to show.</p>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="text-xs text-gotruf-400 hover:text-gotruf-300 mt-2 transition-colors"
              >
                Show all activity
              </button>
            )}
          </div>
        ) : (
          groupedEvents.map((group) => (
            <div key={group.label} className="mb-4">
              <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {group.label}
              </h3>
              <div className="space-y-0.5">
                {group.events.map((event, idx) => {
                  const icon = TIMELINE_EVENT_ICONS[event.type];
                  const dotColor = TIMELINE_EVENT_COLORS[event.type];
                  const isLast = idx === group.events.length - 1;

                  return (
                    <div key={event.id} className="flex gap-3 group">
                      {/* Timeline line + dot */}
                      <div className="flex flex-col items-center">
                        <div className={`w-2 h-2 rounded-full ${dotColor} shrink-0 mt-1.5`} />
                        {!isLast && (
                          <div className="w-px flex-1 bg-gray-800 my-1" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 pb-3 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs">{icon}</span>
                          <span className="text-xs font-medium text-white">{event.title}</span>
                          <span className="text-[10px] text-gray-600 ml-auto shrink-0">
                            {formatEventTime(event.timestamp)}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 leading-relaxed">
                          {event.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
