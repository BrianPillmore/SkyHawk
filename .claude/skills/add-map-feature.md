# Skill: Add Map Feature

## Description
Add or modify Google Maps integration including new drawing tools,
map overlays, imagery options, or interaction modes.

## Context Files
- src/components/map/MapView.tsx - Main map component
- src/components/map/PlaceholderMap.tsx - Fallback map
- src/components/map/AddressSearch.tsx - Address search
- src/hooks/useGoogleMaps.ts - Maps API loader
- src/store/useStore.ts - Drawing state management

## Steps
1. Determine if change requires new Google Maps API features
2. Update hooks/useGoogleMaps.ts if new API features needed
3. Modify MapView.tsx for rendering changes
4. Update store for new drawing modes or state
5. Update PlaceholderMap.tsx for consistency
6. Test with and without API key
