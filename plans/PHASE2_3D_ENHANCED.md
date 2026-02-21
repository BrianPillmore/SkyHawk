# Phase 2: Enhanced Measurement & 3D Visualization

## Status: PLANNED

## Objective
Add 3D roof model visualization, multi-structure support, undo/redo,
and enhanced measurement capabilities.

## Planned Features

### 1. 3D Roof Visualization (Three.js)
- Generate 3D mesh from 2D facet outlines + pitch data
- Interactive rotation, zoom, and pan
- Color-coded facets matching 2D view
- Edge highlighting on hover
- Measurement labels on 3D model
- Export 3D model as screenshot

### 2. Multi-Structure Support
- Multiple buildings per property
- Structure naming and management
- Per-structure measurement summaries
- Combined property totals

### 3. Undo/Redo System
- Command pattern implementation
- Full operation history
- Ctrl+Z / Ctrl+Shift+Z keyboard shortcuts
- Visual history indicator

### 4. Walls, Windows & Doors
- Wall area calculation from building footprint + height
- Window and door placement on walls
- Net wall area (wall - openings)
- Siding material estimation

### 5. Measurement Validation
- Cross-check area calculations
- Edge consistency validation
- Overlapping facet detection
- Gap detection in roof outline

### 6. Persistent Storage
- localStorage for session persistence
- IndexedDB for larger datasets
- JSON import/export
- Project file format (.skyhawk)

## Dependencies
- Three.js library
- OrbitControls for Three.js
- Command pattern utility

## Estimated Effort
- 3D Visualization: Large
- Multi-structure: Medium
- Undo/Redo: Medium
- Walls/Windows/Doors: Large
- Validation: Medium
- Storage: Small
