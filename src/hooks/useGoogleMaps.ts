import { useEffect, useRef, useState, useCallback } from 'react';

declare global {
  interface Window {
    google?: typeof google;
  }
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

let googleMapsPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (googleMapsPromise) return googleMapsPromise;

  if (window.google?.maps) {
    googleMapsPromise = Promise.resolve();
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    if (!GOOGLE_MAPS_API_KEY) {
      // If no API key, we'll use a placeholder map
      console.warn('No Google Maps API key found. Set VITE_GOOGLE_MAPS_API_KEY in .env');
      reject(new Error('No API key'));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,drawing,geometry&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

export function useGoogleMaps() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGoogleMaps()
      .then(() => setLoaded(true))
      .catch((err) => setError(err.message));
  }, []);

  return { loaded, error, apiKey: GOOGLE_MAPS_API_KEY };
}

export function useMap(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: {
    center: { lat: number; lng: number };
    zoom: number;
    mapTypeId?: string;
  }
) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const { loaded, error } = useGoogleMaps();

  useEffect(() => {
    if (!loaded || !containerRef.current || mapRef.current) return;

    mapRef.current = new google.maps.Map(containerRef.current, {
      center: options.center,
      zoom: options.zoom,
      mapTypeId: (options.mapTypeId as google.maps.MapTypeId) || 'satellite',
      tilt: 0,
      disableDefaultUI: true,
      zoomControl: true,
      fullscreenControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      rotateControl: false,
      gestureHandling: 'greedy',
      styles: [
        {
          featureType: 'all',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
    });
  }, [loaded, containerRef]);

  const panTo = useCallback(
    (lat: number, lng: number, zoom?: number) => {
      if (mapRef.current) {
        mapRef.current.panTo({ lat, lng });
        if (zoom) mapRef.current.setZoom(zoom);
      }
    },
    []
  );

  const setMapType = useCallback((type: string) => {
    if (mapRef.current) {
      mapRef.current.setMapTypeId(type as google.maps.MapTypeId);
    }
  }, []);

  return { map: mapRef.current, mapRef, loaded, error, panTo, setMapType };
}

export function usePlacesAutocomplete(
  inputRef: React.RefObject<HTMLInputElement | null>,
  onPlaceSelected: (place: {
    address: string;
    city: string;
    state: string;
    zip: string;
    lat: number;
    lng: number;
  }) => void
) {
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const { loaded } = useGoogleMaps();

  useEffect(() => {
    if (!loaded || !inputRef.current || autocompleteRef.current) return;

    autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'us' },
      types: ['address'],
      fields: ['address_components', 'geometry', 'formatted_address'],
    });

    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current?.getPlace();
      if (!place?.geometry?.location || !place.address_components) return;

      let address = '';
      let city = '';
      let state = '';
      let zip = '';

      for (const component of place.address_components) {
        const types = component.types;
        if (types.includes('street_number')) {
          address = component.long_name + ' ';
        } else if (types.includes('route')) {
          address += component.long_name;
        } else if (types.includes('locality')) {
          city = component.long_name;
        } else if (types.includes('administrative_area_level_1')) {
          state = component.short_name;
        } else if (types.includes('postal_code')) {
          zip = component.long_name;
        }
      }

      onPlaceSelected({
        address: address || place.formatted_address || '',
        city,
        state,
        zip,
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      });
    });
  }, [loaded, inputRef, onPlaceSelected]);
}
