import { useStore } from '../../store/useStore';

export default function Header() {
  const { toggleSidebar, activePropertyId, properties } = useStore();
  const activeProperty = activePropertyId
    ? properties.find((p) => p.id === activePropertyId)
    : null;

  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center px-4 justify-between shrink-0 z-50">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          title="Toggle sidebar"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <svg className="w-7 h-7 text-skyhawk-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L1 12h3v9h6v-6h4v6h6v-9h3L12 2zm0 2.84L19 12h-1.5v7.5h-3V13.5h-5v5.5h-3V12H5L12 4.84z" />
          </svg>
          <h1 className="text-lg font-bold text-white tracking-tight">
            Sky<span className="text-skyhawk-500">Hawk</span>
          </h1>
        </div>
      </div>

      {activeProperty && (
        <div className="flex items-center gap-2 text-sm">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-gray-300">{activeProperty.address}</span>
          <span className="text-gray-500">
            {activeProperty.city}, {activeProperty.state} {activeProperty.zip}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">v1.0.0</span>
      </div>
    </header>
  );
}
