import { useRef, useState, useCallback } from 'react';
import { usePlacesAutocomplete, useGoogleMaps } from '../../hooks/useGoogleMaps';
import { useStore } from '../../store/useStore';

export default function AddressSearch({ searchInputRef }: { searchInputRef?: React.RefObject<HTMLInputElement | null> }) {
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = searchInputRef || internalRef;
  const [address, setAddress] = useState('');
  const { apiKey } = useGoogleMaps();
  const { createProperty, startNewMeasurement } = useStore();

  const handlePlaceSelected = useCallback(
    (place: { address: string; city: string; state: string; zip: string; lat: number; lng: number }) => {
      createProperty(place.address, place.city, place.state, place.zip, place.lat, place.lng);
      startNewMeasurement();
      setAddress(place.address);
    },
    [createProperty, startNewMeasurement]
  );

  usePlacesAutocomplete(inputRef, handlePlaceSelected);

  // Manual coordinate entry for when API is not available
  const [showManual, setShowManual] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [manualAddress, setManualAddress] = useState('');

  const handleManualSubmit = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng)) return;
    const addr = manualAddress || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    createProperty(addr, '', '', '', lat, lng);
    startNewMeasurement();
    setShowManual(false);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={apiKey ? "Search property address..." : "Enter address (API key required for autocomplete)"}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gotruf-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => setShowManual(!showManual)}
          className="px-3 py-2.5 bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg text-sm transition-colors"
          title="Manual coordinate entry"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Manual entry dropdown */}
      {showManual && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-lg p-4 z-50 shadow-xl">
          <h4 className="text-sm font-medium text-white mb-3">Manual Property Entry</h4>
          <div className="space-y-2">
            <input
              type="text"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              placeholder="Address (optional)"
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gotruf-500"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="any"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                placeholder="Latitude"
                className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gotruf-500"
              />
              <input
                type="number"
                step="any"
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                placeholder="Longitude"
                className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gotruf-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleManualSubmit}
                className="flex-1 px-3 py-2 bg-gotruf-600 hover:bg-gotruf-500 text-white text-sm font-medium rounded transition-colors"
              >
                Create Property
              </button>
              <button
                onClick={() => setShowManual(false)}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
