# Contributing to SkyHawk

## Development Setup
1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b feature/your-feature`
5. Start dev server: `npm run dev`

## Code Standards
- TypeScript strict mode
- Functional React components with hooks
- Zustand for state management
- Tailwind CSS for styling
- No CSS modules or styled-components

## Commit Message Format
```
type(scope): description

[optional body]
```

Types: feat, fix, refactor, docs, test, chore, style

## Pull Request Process
1. Update relevant docs and specs
2. Add tests for new functionality
3. Ensure `npm run build` passes
4. Update ROADMAP.md if adding new features
5. Request review from maintainers

## Architecture Guidelines
- Keep geometry calculations in `utils/geometry.ts`
- Keep colors in `utils/colors.ts`
- One component per file
- Types go in `types/index.ts`
- Store actions in `store/useStore.ts`
- New hooks in `hooks/` directory
