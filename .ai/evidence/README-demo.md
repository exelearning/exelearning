# Solo Logic Alpha — Demo Instructions

This document provides step-by-step commands to reproduce the Solo Logic Alpha demo course and verify all acceptance tests.

## Prerequisites

- Windows 11 (target platform per SPEC.md)
- Bun 1.3.x (repository contract)
- Git
- Docker Desktop (optional, for container-based verification)

## 1. Clone and Setup

```bash
git clone https://github.com/danghoangsqtt-sys/exelearning.git
cd exelearning
git checkout feature/solo-logic-alpha
# Pinned commit: 3c7c7e82163e812f04cbb033240942f8ac1214a0
```

## 2. Install Dependencies and Build

### Option A: Docker (recommended, matches P02 verified environment)

```bash
docker run --rm -v ${PWD}:/app -w /app oven/bun:1.3-alpine sh -c "
  bun run build:all
"
```

### Option B: Native Windows (requires Bun on PATH)

```bash
bun install
bun run build:all
```

## 3. Run Development Server

### Docker
```bash
docker run --rm -p 8080:8080 -v ${PWD}:/app -w /app oven/bun:1.3-alpine bun run start
```

### Native
```bash
bun run start
```

Server starts at `http://localhost:8080` (or `http://127.0.0.1:8080`).

Default credentials: `user@exelearning.net` / `1234`

## 4. Load Demo Course

1. Open `http://localhost:8080` in browser
2. Login with `user@exelearning.net` / `1234`
3. Click **File** → **Open** → select `test/fixtures/electronics-logic-demo.elpx`
4. Course loads with:
   - Text iDevice: "Electronics Logic: bảng chân trị, Karnaugh và mạch bán tổng." + image + video
   - Truth Table iDevice: 3 variables, prompt "Hoàn thành bảng chân trị ba biến."
   - Karnaugh iDevice: 4 variables, prompt "Nhóm bản đồ Karnaugh bốn biến có wrap, overlap và don't-care."
   - Circuit iDevice: 2 variables, prompt "Dựng mạch bán tổng (half-adder) cho A, B."

## 5. Verify Authoring → Preview → Save/Open Round-trip

### Preview
- Click **Preview** button (bottom bar) or `#head-bottom-preview`
- Verify all three Electronics Logic runtimes render in preview iframe

### Save/Open (10 cycles)
- Click **Save** (top bar) → wait for confirmation
- Refresh browser (F5)
- Reopen project from dashboard
- Repeat 10 times
- Verify all Electronics Logic data preserved (AT-02)
- Automated test: `test/e2e/playwright/specs/demo/electronics-logic-demo.spec.ts` test `round-trips text, image, video, truth table, Karnaugh, and half-adder through ten reloads`

## 6. Verify Learner Flows (Preview or HTML Offline)

### Truth Table (AT-05)
1. Open preview panel
2. Navigate to Truth Table activity
3. Fill 7/8 cells correctly, 1 wrong
4. Click **Kiểm tra** → exactly 1 failed cell highlighted; feedback text includes "Đúng 7/8 ô đúng" (per
   `electronics-logic.js` message template) — note the full feedback string is `Điểm: {score} / {maxScore}. Đúng
   {passed}/{total} ô đúng.`; since truth-table scoring is weighted 70% cells / 30% expression (see CHANGELOG.md),
   the leading `{score}/{maxScore}` is **not** simply "7/8" — verify the actual displayed score live rather than
   expecting an exact "7 / 8" match.
5. Correct the wrong cell
6. Click **Kiểm tra** → all 8 cells correct; feedback includes "Đúng 8/8 ô đúng" and a full score matching `maxScore`

### Karnaugh (AT-06)
1. Open Karnaugh activity in preview
2. Fill all 16 cells: minterms 0,2,8,10,12,14 = 1; don't-care 4 = X; rest = 0
3. Create group 1: cells 0,2,8,10 (wrap left/right + top/bottom)
4. Create group 2: cells 8,10,12,14 (overlap at 8,10, wrap)
5. Click **Kiểm tra** → shows "10 / 10", solution text "!B*!D+A*!D" displayed

### Half-Adder Circuit (AT-07)
1. Open Circuit activity in preview
2. Place nodes: 2×INPUT (A,B), 1×XOR, 1×AND, 2×OUTPUT (Sum, Carry)
3. Wire: A→XOR.a, B→XOR.b, A→AND.a, B→AND.b, XOR.out→Sum, AND.out→Carry
4. Click **Kiểm tra** → feedback is `Điểm: 10 / 10. Đúng 8/8 tổ hợp kiểm tra.` (score out of 10 per the E04-verified
   grader — `core:10, all 8 checks passed`; "8/8" is the underlying check count, not the score — see
   `electronics-logic.js` lines 944-946 and `messages.correctCircuitCases`)
5. Remove one wire (e.g., AND→Carry)
6. Click **Kiểm tra** → shows "Mạch chưa đúng cấu trúc, chưa thể chấm điểm."

## 7. Export HTML5 Offline (AT-09, EXP-03)

### Via UI
1. Click **File** → **Export** → **HTML5 Website**
2. Save ZIP to disk
3. Unzip and open `index.html` in browser (no server needed)
4. Verify all three activities work offline

### Automated Verification
```bash
# Run the full offline test (requires dev server running)
bun x playwright test --project=chromium test/e2e/playwright/specs/demo/electronics-logic-demo.spec.ts -g "AT-09"
```

This test:
- Triggers real HTML5 export via UI
- Downloads and unzips with `fflate`
- Serves exact bytes via `page.route` on synthetic origin
- Navigates real browser to offline origin
- Grades all three activities without network

### Audit Export (EXP-03)
The test `auditWholeExport` scans every ZIP entry for:
- Dot-prefixed paths (`.agents/`, `.claude/`, `.ai/`)
- Absolute local paths (`C:\`, `/Users/`, `/home/`)
- Secret tokens (`sk-proj-`, `sk-ant-`, `ghp_`, `AIza`, `Bearer`)
- Stack traces (`at Object.`, `at <anonymous>`)

All must be clean.

## 8. Run Full Test Suite

### Unit Tests (Backend)
```bash
bun test ./src ./test/helpers ./scripts ./app --coverage
# Expected: 8013 pass, 0 fail
```

### Frontend Unit Tests (Vitest)
```bash
bun run test:frontend
# Expected: 14513 passed
```

### Integration Tests
```bash
bun run test:integration
# Expected: 735 pass
```

### E2E Tests (Playwright Chromium)
```bash
bun x playwright test --project=chromium
# Expected: ~534 passed, 2 failed (unrelated GeoGebra/TinyMCE), 6 skipped
```

### Electronics Logic iDevice Full Regression
```bash
npx vitest run public/files/perm/idevices/base/electronics-logic
# Expected: 15 files, 388 tests, all pass

bun x playwright test --project=chromium test/e2e/playwright/specs/idevices/electronics-logic.spec.ts
# Expected: 9 passed (includes malformed-JSON test for PLAT-06)

bun x playwright test --project=chromium test/e2e/playwright/specs/demo/electronics-logic-demo.spec.ts
# Expected: 6 passed (round-trip, AT-05, AT-06, AT-07, AT-09, PLAT-07)
```

### Lint
```bash
bun run lint:src
bun run lint:test
bun run lint:public
# Or directly:
bunx @biomejs/biome check src/ test/ public/app/
# Expected: exit 0, only pre-existing warnings in unrelated files
```

### Coverage
```bash
bun test ./src ./test/helpers ./scripts ./app --coverage
# Check patch coverage ≥ 90% on changed lines (AGENTS.md §5.3)
```

## 9. Skill Verification (AT-S01, AT-S02, AT-S03)

```bash
# AT-S01: Skill provenance
cat .ai/skills.lock.json | head -50
# Verify: provenance repo, commit, 11 source skills, 4 whitelisted + 1 created, SHA-256, AGPL owner auth

# AT-S02: Skill parity
powershell -File tools/ai/sync-project-skills.ps1 -Check
# Expected: "Managed project skills are synchronized."

# AT-S03: Current writer routing (Nemotron 3 Ultra)
cat .ai/evidence/AT-S03-nemotron-dry-run.md
# Verify: 5 managed skills listed, Scenario A routes to exelearning-logic-alpha + test-driven-development,
# Scenario B routes to systematic-debugging (+ exelearning-logic-alpha), no product files edited
```

## 10. Offline Verification (No Network)

After HTML5 export, disconnect network and verify:
- Open exported `index.html` directly in browser
- All three Electronics Logic activities load and grade
- No network requests in DevTools Network tab
- Assets (image, video) loaded from local ZIP

## Troubleshooting

| Issue | Resolution |
|-------|------------|
| `make` not found | Use direct `bun`/`npx` commands above; `make` unavailable on native Windows Git Bash |
| Vitest coverage shows 0/0/0/0 | Known regression in `@vitest/coverage-v8` since 2026-08-14; use direct source verification instead |
| Docker Chromium E2E 34 failures | Pre-existing Docker-specific blocker; run natively on Windows 11 instead |
| `public/bundles/idevices.zip` missing | Gitignored; fallback path (`ResourceFetcher.fetchIdeviceFallback`) serves live source for E2E |
| Port 8080 in use | Change `APP_PORT` in `.env` or stop conflicting process |

## Key Files Reference

| Purpose | Path |
|---------|------|
| Demo course fixture | `test/fixtures/electronics-logic-demo.elpx` |
| E2E demo spec | `test/e2e/playwright/specs/demo/electronics-logic-demo.spec.ts` |
| iDevice E2E spec | `test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` |
| Boolean Core | `public/files/perm/idevices/base/electronics-logic/core/boolean-core.js` |
| Export runtime | `public/files/perm/idevices/base/electronics-logic/export/electronics-logic.js` |
| AT-S03 evidence | `.ai/evidence/AT-S03-nemotron-dry-run.md` |
| Full AT report | `.ai/evidence/test-report-AT.md` |
| Release notes | `.ai/evidence/release-notes.md` |
| Repo map (all evidence) | `repo-map.md` |