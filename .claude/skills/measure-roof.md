# Skill: Measure Roof

## Description
Add or modify roof measurement functionality including geometry calculations,
new edge types, facet operations, or measurement display components.

## Context Files
- src/utils/geometry.ts - All measurement math
- src/types/index.ts - Data model types
- src/store/useStore.ts - State management
- src/components/measurement/ - UI components
- specs/MEASUREMENT_SPEC.md - Measurement specification

## Steps
1. Review the measurement spec for requirements
2. Add/modify types in src/types/index.ts
3. Add/modify calculations in src/utils/geometry.ts
4. Update store actions in src/store/useStore.ts
5. Update UI components in src/components/measurement/
6. Add tests in tests/unit/geometry.test.ts
7. Update specs if behavior changed
