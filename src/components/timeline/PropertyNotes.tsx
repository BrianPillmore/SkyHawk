import { useState } from 'react';
import { useStore } from '../../store/useStore';

export default function PropertyNotes({
  propertyId,
  onClose,
}: {
  propertyId: string;
  onClose: () => void;
}) {
  const { properties, username } = useStore();
  const property = properties.find((p) => p.id === propertyId);
  const [noteText, setNoteText] = useState('');

  const updatePropertyNotes = useStore((s) => s.updatePropertyNotes);

  if (!property) return null;

  const handleSave = () => {
    const trimmed = noteText.trim();
    if (!trimmed) return;

    const timestamp = new Date().toISOString();
    const author = username || 'Unknown';
    const entry = `[${timestamp}] ${author}: ${trimmed}`;

    // Append to existing notes
    const updated = property.notes
      ? `${property.notes}\n${entry}`
      : entry;

    updatePropertyNotes(propertyId, updated);
    setNoteText('');
    onClose();
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-400">Add a Note</span>
        <button
          onClick={onClose}
          className="text-gray-600 hover:text-white transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <textarea
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        placeholder="Add observation, field note, or follow-up..."
        className="w-full h-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white placeholder-gray-500 resize-none focus:border-gotruf-500 focus:outline-none focus:ring-1 focus:ring-gotruf-500/50"
        autoFocus
      />
      <div className="flex justify-end gap-2 mt-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!noteText.trim()}
          className="px-3 py-1.5 text-xs font-medium bg-gotruf-600 hover:bg-gotruf-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
        >
          Save Note
        </button>
      </div>
    </div>
  );
}
