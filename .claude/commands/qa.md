# /qa - Run KAREN Quality Assurance Check

## Description
Invokes the KAREN QA agent to verify all claimed work is actually done.

## Instructions
1. Read .claude/agents/KAREN.md for verification protocol
2. List all files that should exist
3. Read each file and verify contents
4. Run `npm run build` to verify compilation
5. Run tests with `npx vitest run tests/unit/`
6. Cross-reference specs against implementation
7. Produce a QA report with PASS/FAIL for each item
