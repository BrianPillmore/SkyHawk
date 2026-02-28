import { useStore } from '../../store/useStore';

export default function AnalyzeConditionButton() {
  const activePropertyId = useStore((s) => s.activePropertyId);
  const properties = useStore((s) => s.properties);

  const activeProperty = properties.find((p) => p.id === activePropertyId);

  return (
    <div className="mb-4">
      <button
        disabled
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all bg-gray-800 text-gray-500 cursor-not-allowed"
        title="AI Condition Assessment is temporarily unavailable"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        AI Condition Assessment
      </button>

      <p className="text-xs text-gray-500 mt-2">
        AI Condition Assessment is temporarily unavailable.
        {!activeProperty && ' Search for an address first.'}
      </p>
    </div>
  );
}
