import { useStore } from '../../store/useStore';

export default function PlaceholderMap() {
  const { drawingMode } = useStore();

  return (
    <div className="flex-1 relative bg-gray-900 flex items-center justify-center">
      {/* SVG-based interactive map placeholder */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Grid background */}
        <svg className="absolute inset-0 w-full h-full opacity-10">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#3b82f6" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Placeholder satellite imagery */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="max-w-lg text-center p-8">
            <div className="w-20 h-20 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-gray-700">
              <svg className="w-10 h-10 text-gotruf-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-3">Google Maps API Key Required</h2>
            <p className="text-gray-400 mb-6 text-sm leading-relaxed">
              To display satellite imagery and enable property search, add your Google Maps API key.
              The application needs Maps JavaScript API, Places API, and Geocoding API enabled.
            </p>
            <div className="bg-gray-800/80 rounded-lg p-4 text-left border border-gray-700">
              <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Setup Instructions</p>
              <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
                <li>Go to <span className="text-gotruf-400">Google Cloud Console</span></li>
                <li>Enable Maps JavaScript API, Places API, Geocoding API</li>
                <li>Create an API key with appropriate restrictions</li>
                <li>Create a <code className="bg-gray-700 px-1.5 py-0.5 rounded text-xs">.env</code> file in the project root</li>
                <li>Add <code className="bg-gray-700 px-1.5 py-0.5 rounded text-xs">VITE_GOOGLE_MAPS_API_KEY=your_key</code></li>
                <li>Restart the dev server</li>
              </ol>
            </div>

            {/* Demo mode notice */}
            <div className="mt-6 p-3 bg-amber-900/20 border border-amber-800/30 rounded-lg">
              <p className="text-xs text-amber-400">
                You can still explore the UI and measurement tools. Roof outlines and measurements will work once the map is connected.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Map type selector (still functional) */}
      <div className="absolute top-3 right-3 bg-gray-800/90 backdrop-blur rounded-lg overflow-hidden flex border border-gray-700/50 z-10">
        <div className="px-3 py-1.5 text-xs text-gray-500 font-medium">
          Map Unavailable
        </div>
      </div>

      {/* Drawing mode indicator */}
      {drawingMode !== 'pan' && drawingMode !== 'select' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-800/90 backdrop-blur px-4 py-2 rounded-lg border border-gray-700/50 z-10">
          <p className="text-sm text-gray-300">
            <span className="text-gotruf-400 font-medium">
              {drawingMode === 'outline' ? 'Drawing Mode' : drawingMode}
            </span>
            {' — Connect Google Maps API to enable drawing on satellite imagery'}
          </p>
        </div>
      )}
    </div>
  );
}
