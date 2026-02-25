import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import { useStore } from '../../store/useStore';
import {
  propertiesToPins,
  calculateBounds,
  calculateCenter,
  getPinColor,
  formatPinTooltip,
  type PropertyPin,
} from '../../utils/propertyMapUtils';

export default function PropertyMapOverview() {
  const { properties, setActiveProperty } = useStore();
  const { loaded, error } = useGoogleMaps();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  const pins = useMemo(() => propertiesToPins(properties), [properties]);
  const center = useMemo(() => calculateCenter(pins), [pins]);
  const bounds = useMemo(() => calculateBounds(pins), [pins]);

  const handlePinClick = useCallback(
    (pin: PropertyPin) => {
      setActiveProperty(pin.id);
    },
    [setActiveProperty],
  );

  // Initialize map
  useEffect(() => {
    if (!loaded || !mapContainerRef.current || mapRef.current) return;

    mapRef.current = new google.maps.Map(mapContainerRef.current, {
      center,
      zoom: 10,
      mapTypeId: 'roadmap',
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'cooperative',
      styles: [
        // Dark mode styling
        { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#8b8b8b' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a4a' }] },
        { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6b6b8b' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      ],
    });

    // Fit to bounds if we have multiple pins
    if (bounds && pins.length > 1) {
      mapRef.current.fitBounds({
        north: bounds.north,
        south: bounds.south,
        east: bounds.east,
        west: bounds.west,
      });
    }
  }, [loaded, center, bounds, pins.length]);

  // Update markers when pins change
  useEffect(() => {
    if (!mapRef.current || !loaded) return;

    // Clear existing markers
    for (const marker of markersRef.current) {
      marker.map = null;
    }
    markersRef.current = [];

    // Check if AdvancedMarkerElement is available; fall back to regular Markers
    const useAdvanced = !!google.maps.marker?.AdvancedMarkerElement;

    for (const pin of pins) {
      if (useAdvanced) {
        // Create custom pin element
        const el = document.createElement('div');
        el.className = 'property-pin';
        el.style.cssText = `
          width: 14px; height: 14px; border-radius: 50%;
          background: ${getPinColor(pin)};
          border: 2px solid rgba(255,255,255,0.9);
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,0.5);
          transition: transform 0.15s ease;
        `;
        el.title = formatPinTooltip(pin);

        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.5)';
          el.style.zIndex = '10';
        });
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)';
          el.style.zIndex = '';
        });

        const marker = new google.maps.marker.AdvancedMarkerElement({
          map: mapRef.current,
          position: { lat: pin.lat, lng: pin.lng },
          content: el,
          title: pin.address,
        });

        marker.addListener('click', () => handlePinClick(pin));
        markersRef.current.push(marker);
      } else {
        // Fallback: create a simple circle overlay via SVG marker
        const marker = new google.maps.Marker({
          map: mapRef.current!,
          position: { lat: pin.lat, lng: pin.lng },
          title: formatPinTooltip(pin),
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: getPinColor(pin),
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });

        marker.addListener('click', () => handlePinClick(pin));
        // Store in markers array (cast for cleanup)
        markersRef.current.push(marker as unknown as google.maps.marker.AdvancedMarkerElement);
      }
    }

    // Update bounds
    if (bounds && pins.length > 1 && mapRef.current) {
      mapRef.current.fitBounds({
        north: bounds.north,
        south: bounds.south,
        east: bounds.east,
        west: bounds.west,
      });
    } else if (pins.length === 1 && mapRef.current) {
      mapRef.current.setCenter({ lat: pins[0].lat, lng: pins[0].lng });
      mapRef.current.setZoom(15);
    }
  }, [loaded, pins, bounds, handlePinClick]);

  if (error || !loaded) {
    // Fallback: show a placeholder with property dots
    return (
      <div className="relative bg-gray-900 border border-gray-800 rounded-xl overflow-hidden h-64">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <span className="text-2xl block mb-2">🗺️</span>
            <p className="text-sm text-gray-500">
              {error ? 'Map unavailable' : 'Loading map...'}
            </p>
          </div>
        </div>
        {/* Mini property indicators */}
        <div className="absolute bottom-3 left-3 flex gap-1">
          {pins.slice(0, 10).map((pin) => (
            <div
              key={pin.id}
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: getPinColor(pin) }}
              title={pin.address}
            />
          ))}
          {pins.length > 10 && (
            <span className="text-[10px] text-gray-600 ml-1">+{pins.length - 10}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Map container */}
      <div ref={mapContainerRef} className="h-64 w-full" />

      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-gray-900/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-gray-700/50">
        <div className="flex items-center gap-3 text-[10px]">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-gray-400">&gt;3k sf</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-gray-400">&gt;1.5k sf</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-gray-400">&lt;1.5k sf</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-500" />
            <span className="text-gray-400">No data</span>
          </div>
        </div>
      </div>

      {/* Property count */}
      <div className="absolute top-3 right-3 bg-gray-900/90 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-gray-700/50">
        <span className="text-[10px] text-gray-400">{pins.length} properties</span>
      </div>
    </div>
  );
}
