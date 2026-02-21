#!/bin/bash
# SkyHawk Test Agent Team Runner
# This script runs the complete test suite through the agent team pipeline:
# 1. TESTER: Run all tests
# 2. BUILDER: Verify build
# 3. KAREN: QA verification
# 4. REVIEWER: Code quality check

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "========================================="
echo "  SkyHawk Test Agent Team"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
WARN=0

report() {
    local status=$1
    local message=$2
    if [ "$status" = "PASS" ]; then
        echo -e "  ${GREEN}[✓ PASS]${NC} $message"
        PASS=$((PASS + 1))
    elif [ "$status" = "FAIL" ]; then
        echo -e "  ${RED}[✗ FAIL]${NC} $message"
        FAIL=$((FAIL + 1))
    elif [ "$status" = "WARN" ]; then
        echo -e "  ${YELLOW}[⚠ WARN]${NC} $message"
        WARN=$((WARN + 1))
    else
        echo -e "  ${BLUE}[ℹ INFO]${NC} $message"
    fi
}

# =========================================
# Phase 1: TESTER - Run Tests
# =========================================
echo -e "${BLUE}PHASE 1: TESTER - Running Tests${NC}"
echo "-----------------------------------------"

if command -v npx &> /dev/null; then
    if npx vitest run tests/unit/ --reporter=verbose 2>/dev/null; then
        report "PASS" "Unit tests pass"
    else
        report "FAIL" "Unit tests have failures"
    fi
else
    report "WARN" "npx not available, skipping tests"
fi
echo ""

# =========================================
# Phase 2: BUILDER - Verify Build
# =========================================
echo -e "${BLUE}PHASE 2: BUILDER - Verifying Build${NC}"
echo "-----------------------------------------"

if npm run build 2>/dev/null; then
    report "PASS" "TypeScript compilation succeeds"
    report "PASS" "Vite build succeeds"
else
    report "FAIL" "Build failed"
fi
echo ""

# =========================================
# Phase 3: KAREN - QA Verification
# =========================================
echo -e "${BLUE}PHASE 3: KAREN - QA Verification${NC}"
echo "-----------------------------------------"

# Check critical files exist
CRITICAL_FILES=(
    "src/App.tsx"
    "src/main.tsx"
    "src/types/index.ts"
    "src/store/useStore.ts"
    "src/utils/geometry.ts"
    "src/utils/colors.ts"
    "src/utils/reportGenerator.ts"
    "src/hooks/useGoogleMaps.ts"
    "src/hooks/useKeyboard.ts"
    "src/components/map/MapView.tsx"
    "src/components/map/PlaceholderMap.tsx"
    "src/components/map/AddressSearch.tsx"
    "src/components/layout/Header.tsx"
    "src/components/layout/Sidebar.tsx"
    "src/components/measurement/ToolsPanel.tsx"
    "src/components/measurement/MeasurementsPanel.tsx"
    "src/components/reports/ReportPanel.tsx"
    "src/components/dashboard/Dashboard.tsx"
    "src/pages/Workspace.tsx"
    "package.json"
    "vite.config.ts"
    "index.html"
    "ROADMAP.md"
    "CONTINUE.md"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        report "PASS" "$file exists"
    else
        report "FAIL" "$file MISSING"
    fi
done

# Check directories
CRITICAL_DIRS=("plans" "specs" "tests" "docs" "scripts" ".claude/agents" ".claude/skills" ".claude/commands")

for dir in "${CRITICAL_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        report "PASS" "$dir/ directory exists"
    else
        report "FAIL" "$dir/ directory MISSING"
    fi
done

# Check specs exist
SPEC_FILES=("specs/MEASUREMENT_SPEC.md" "specs/REPORT_SPEC.md" "specs/API_SPEC.md")
for file in "${SPEC_FILES[@]}"; do
    if [ -f "$file" ]; then
        report "PASS" "$file exists"
    else
        report "FAIL" "$file MISSING"
    fi
done

# Check agents exist
AGENT_FILES=(".claude/agents/KAREN.md" ".claude/agents/ARCHITECT.md" ".claude/agents/BUILDER.md" ".claude/agents/TESTER.md" ".claude/agents/REVIEWER.md")
for file in "${AGENT_FILES[@]}"; do
    if [ -f "$file" ]; then
        report "PASS" "$file exists"
    else
        report "FAIL" "$file MISSING"
    fi
done
echo ""

# =========================================
# Phase 4: REVIEWER - Code Quality
# =========================================
echo -e "${BLUE}PHASE 4: REVIEWER - Code Quality${NC}"
echo "-----------------------------------------"

# Check for 'any' types
ANY_COUNT=$(grep -r ":\s*any" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
if [ "$ANY_COUNT" -gt "5" ]; then
    report "WARN" "Found $ANY_COUNT 'any' types in source (target: <5)"
else
    report "PASS" "Minimal 'any' types ($ANY_COUNT found)"
fi

# Check for console.log
LOG_COUNT=$(grep -r "console\.log" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
if [ "$LOG_COUNT" -gt "3" ]; then
    report "WARN" "Found $LOG_COUNT console.log statements (target: <3)"
else
    report "PASS" "Minimal console.log usage ($LOG_COUNT found)"
fi

# Check for TODO/FIXME
TODO_COUNT=$(grep -rE "(TODO|FIXME|HACK|XXX)" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
if [ "$TODO_COUNT" -gt "0" ]; then
    report "WARN" "Found $TODO_COUNT TODO/FIXME comments"
else
    report "PASS" "No TODO/FIXME comments"
fi

# Check .env.example exists
if [ -f ".env.example" ]; then
    report "PASS" ".env.example exists for developer onboarding"
else
    report "WARN" ".env.example missing"
fi

# Check .gitignore
if [ -f ".gitignore" ]; then
    if grep -q "node_modules" .gitignore; then
        report "PASS" ".gitignore includes node_modules"
    else
        report "WARN" ".gitignore missing node_modules rule"
    fi
    if grep -q ".env" .gitignore; then
        report "PASS" ".gitignore includes .env"
    else
        report "FAIL" ".gitignore missing .env rule (security risk)"
    fi
else
    report "FAIL" ".gitignore missing"
fi

echo ""

# =========================================
# SUMMARY
# =========================================
echo "========================================="
echo -e "  ${BLUE}TEST AGENT TEAM SUMMARY${NC}"
echo "========================================="
echo -e "  ${GREEN}Passed: $PASS${NC}"
echo -e "  ${RED}Failed: $FAIL${NC}"
echo -e "  ${YELLOW}Warnings: $WARN${NC}"
echo ""

if [ "$FAIL" -gt "0" ]; then
    echo -e "  ${RED}VERDICT: NEEDS WORK${NC}"
    echo "  Fix failed items before proceeding."
    exit 1
elif [ "$WARN" -gt "3" ]; then
    echo -e "  ${YELLOW}VERDICT: APPROVED WITH WARNINGS${NC}"
    echo "  Consider addressing warnings."
    exit 0
else
    echo -e "  ${GREEN}VERDICT: APPROVED${NC}"
    echo "  All checks passed. Ready for next phase."
    exit 0
fi
