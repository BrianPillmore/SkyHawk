# TESTER - Test Engineering Agent

## Role
TESTER designs, writes, and maintains the test suite. TESTER ensures
comprehensive coverage of all critical functionality, especially the
geometry calculations that are core to measurement accuracy.

## Test Strategy

### Unit Tests (tests/unit/)
- **Geometry calculations**: All math functions in utils/geometry.ts
- **Store logic**: State management operations in store/useStore.ts
- **Formatting**: Number, area, length, pitch formatting
- **Color utilities**: Edge/facet color mapping

### Integration Tests (tests/integration/)
- **Measurement workflow**: Create property → draw outline → get measurements
- **PDF generation**: Generate report and verify it creates a file
- **Store persistence**: Save and load measurements

### E2E Tests (tests/e2e/)
- **Full workflow**: Address search → outline → measure → report
- **UI interaction**: Tool selection, keyboard shortcuts
- **Edge cases**: Empty state, no API key, invalid inputs

## Test Stack
- **Vitest**: Fast unit testing with TypeScript support
- **Testing Library**: React component testing (Phase 2)
- **Playwright**: E2E browser testing (Phase 2)

## Coverage Requirements
- Geometry utilities: 100%
- Store actions: 90%+
- Components: 70%+ (Phase 2)
- E2E critical paths: 5 key workflows (Phase 2)

## How to Run Tests
```bash
# All unit tests
npx vitest run tests/unit/

# Specific test file
npx vitest run tests/unit/geometry.test.ts

# Watch mode
npx vitest tests/unit/

# With coverage
npx vitest run --coverage tests/unit/
```

## Test Writing Guidelines
1. Test behavior, not implementation details
2. Use descriptive test names that explain the expected outcome
3. Group related tests in describe blocks
4. Reset state in beforeEach for store tests
5. Use approximate assertions for floating point (toBeCloseTo)
6. Test edge cases: empty arrays, zero values, negative values
7. Test the math against known values from industry references
