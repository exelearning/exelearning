# Solo Logic Alpha — Release Notes (2026-08-19)

## Version
**Solo Logic Alpha** — commit `3c7c7e82163e812f04cbb033240942f8ac1214a0` (upstream `exelearning/exelearning` main @ 2026-08-06, "Fix typo in CHANGELOG for file attachments (#2243)")

## Date
2026-08-19

## Deliverables (per PLAN.md §12)

1. **Source fork AGPL at fixed commit/tag**
   - Fork: `danghoangsqtt-sys/exelearning` branch `feature/solo-logic-alpha` tracking upstream/main
   - Pinned commit: `3c7c7e82163e812f04cbb033240942f8ac1214a0` (2026-08-06)
   - Verified in repo-map.md "Source baseline" (2026-08-12)

2. **Five project skills, lock file, sync/check script, discovery evidence**
   - Managed skills (`.agents/skills/`): `exelearning-logic-alpha`, `plan-writing`, `receiving-code-review`, `systematic-debugging`, `test-driven-development`
   - Lock: `.ai/skills.lock.json` (provenance, SHA-256, AGPL-3.0-or-later owner authorization)
   - Sync: `tools/ai/sync-project-skills.ps1` (copies `.agents/skills/` → `.claude/skills/`, `-Check` mode)
   - Discovery: AT-S03 dry-run for Nemotron 3 Ultra at `.ai/evidence/AT-S03-nemotron-dry-run.md` (2026-08-19)

3. **Boolean Core with unit/property/golden tests**
   - Pure CommonJS module (`public/files/perm/idevices/base/electronics-logic/core/boolean-core.js`), no DOM/Electron/eval/Function
   - Lexer/parser (NOT > AND > XOR > OR, implicit AND, Vietnamese errors), evaluator, truth vectors, equivalence, minterm/don't-care/K-map conversion, stable SOP minimizer (≤4 variables)
   - 143/143 tests, 100% coverage, 100 equivalence property pairs, 30+12 syntax fixtures
   - Verified in repo-map.md "C01-C06 standalone Boolean Core evidence" (2026-08-12)

4. **Electronics Logic iDevice (4 modes: boolean, truthTable, kmap, circuit)**
   - Registered as 53rd iDevice, palette discovery, dynamic/static rendering
   - Schema v1 lifecycle with validation, migration (schema-0, legacy), stable save/open normalization
   - Edition runtime (authoring UI), export runtime (learner UI + grading)
   - Verified in repo-map.md "P03–P04", "T01–T03", "K01–K04", "E01–E04", "U01–U03", "I01–I03" (2026-08-12 through 2026-08-18)

5. **Course demo `.elpx` (text, image, video, truth-table, Karnaugh, half-adder)**
   - Fixture: `test/fixtures/electronics-logic-demo.elpx` (1.39 MB)
   - Content: course text + sample-2.jpg + sample-video-480-900kb.webm + 3 Electronics Logic activities
   - Truth-table: 3 variables, minterms 7,1,3, don't-care 5
   - Karnaugh: 4 variables, minterms 0,2,8,10,12,14, don't-care 4, overlap+wrap groups
   - Circuit: half-adder (Sum = A XOR B, Carry = A AND B)
   - Verified in repo-map.md "Q01 Codex delivery — FINAL" (2026-08-19)

6. **HTML offline export (audit EXP-03)**
   - Browser-side export via `SharedExporters` → ZIP with relative paths
   - Service Worker preview, Electron save-to-disk
   - Offline test: `page.route` serves export on synthetic origin, all 3 runtimes grade without network
   - `auditWholeExport` scans every entry: no `.agents/`, `.claude/`, `.ai/`, absolute paths, tokens, stack traces
   - Verified in repo-map.md "I02", "I03", "Q01" (2026-08-18, 2026-08-19)

7. **Test report AT-S01…AT-S03 and AT-01…AT-10**
   - This file's sibling: `.ai/evidence/test-report-AT.md`
   - All 13 ATs PASS with evidence traceable to dated repo-map.md entries
   - Full regression: 8013 backend pass, 14513 frontend pass, 735 integration pass, 534/536 Chromium pass (2 unrelated)

8. **README build/run/demo, release notes, limitations, backlog**
   - README.md updated with "Solo Logic Alpha — Build & Demo" section
   - This file: release notes
   - Limitations & backlog below

## Limitations (Sev-3 / Sev-4)

| ID | Description | Severity | Workaround / Status |
|----|-------------|----------|---------------------|
| LIM-01 | G-P0 FAIL: Docker Chromium E2E 34 failures (asset/file-manager/theme/media) — not reproducible natively on Windows 11 | Sev-3 (pre-existing, outside Solo Logic Alpha scope) | Run tests natively on Windows 11; CI uses bare ubuntu-latest runners |
| LIM-02 | Vitest coverage tooling regression since 2026-08-14: `@vitest/coverage-v8` reports 0/0/0/0 on all files — blocks NFR-05 ≥90% patch-coverage gate verification for future tasks | Sev-3 (environment regression) | Direct source/trace verification substituted; needs dedicated investigation before next gate |
| LIM-03 | `make` unavailable on native Windows (Git Bash) — `make fix`/`make test-*` cannot run directly | Sev-3 (tooling gap) | Use `bun run lint:*`, `bun test`, `npx vitest`, `bun x playwright` directly |
| LIM-04 | `public/bundles/idevices.zip` stale (built 2026-08-14, pre-U03) — fallback path used for E2E (`ResourceFetcher.fetchIdeviceFallback`) | Sev-4 (cosmetic) | Next `make bundle`/`build:all` will regenerate; gitignored |
| LIM-05 | ~~AT-S03 lock file still records Codex-era PASS~~ — corrected: PM updated `.ai/skills.lock.json` on 2026-08-19, before this handoff was drafted | Sev-4 (governance, resolved) | Closed — see repo-map.md "AT-S03 dry-run evidence..." entry |
| LIM-06 | GeoGebra iDevice E2E flake (display sizing timeout) and TinyMCE CodeMagic flake — unrelated to Solo Logic Alpha | Sev-4 (pre-existing) | Flagged for separate triage |

## Backlog (Post-Alpha)

| ID | Description | Origin |
|----|-------------|--------|
| BL-01 | SCORM 1.2 launch (PLAN.md §12 item 4 / SPEC.md EXP-04) | P1 cut per scope rules |
| BL-02 | NAND/NOR/XNOR gates (SPEC.md LOG-10) | P1 cut per scope rules |
| BL-03 | Development installer (Windows signed, auto-update) | P1 cut per scope rules |
| BL-04 | Wire visual effects, group colors, UI polish | P1 cut per scope rules |
| BL-05 | Auto-generate pretty SOP solutions (keep canonical grader) | P1 cut per scope rules |
| BL-06 | 5+ variable Boolean/K-map support | Post-Alpha |
| BL-07 | Sequential logic (clock, flip-flop, timing) | Post-Alpha |
| BL-08 | SCORM score/resume/2004 | Post-Alpha |
| BL-09 | AI gateway, chatbot, RAG, rubric grading | Post-Alpha |
| BL-10 | Analog/Arduino simulation | Separate sprint |
| BL-11 | Fix Vitest coverage tooling regression (LIM-02) | Immediate post-Alpha |
| BL-12 | Restore `make` on Windows or document Bun-native workflow | Immediate post-Alpha |
| BL-13 | Re-baseline G-P0 on native Windows or CI evidence | Post-Alpha |
| BL-14 | Multi-output circuit support (>2 outputs) | P1 |
| BL-15 | POS form minimization (SPEC.md BOOL-08) | P1 |

## Gate Status

| Gate | Status | Notes |
|------|--------|-------|
| G-S0 (Skill ready) | PASS | AT-S01, AT-S02, AT-S03 (Nemotron 3 Ultra) all PASS |
| G-P0 (Platform ready) | FAIL | Pre-existing Docker Chromium blocker; Solo Logic Alpha proceeds as `Technical Prototype` per PLAN fallback |
| G-C0 (Core frozen) | PASS | Boolean Core v1 API frozen, 100% coverage |
| G-K0 (Learning core) | PASS | Truth-table + Karnaugh 4-variable with wrap/overlap/don't-care grading correct |
| G-E0 (Circuit core) | PASS | Half-adder 4/4, loop/dangling/multi-source reported |
| G-U0 (UI slice) | PASS | Half-adder authorable and gradable in iDevice |
| G-R0 (Release) | **PASS — DECIDED 2026-08-19 (PM)** | All 13 ATs PASS, no Sev-1/2; label confirmed below |

## Classification

**Solo Logic Alpha** (full label) — decided by PM at Gate G-R0 on 2026-08-19. Per PLAN.md §9's literal text, the
`Solo Logic Alpha` label requires "toàn bộ AT đạt, không Sev-1/2" (all AT pass, no Sev-1/2): both hold here (13/13
ATs PASS, zero Sev-1/2). The `Technical Prototype` classification applies only when iDevice round-trip (AT-02) or
HTML offline (AT-09) is missing — neither is missing; both are PASS with strong, independently-verified evidence.
G-P0's pre-existing, unrelated platform-infrastructure failure (Docker-specific Chromium E2E blocker) does not
appear as a criterion in §9's classification rule and is instead disclosed transparently as LIM-01. The earlier
draft of this document used an invented term, "Technical Prototype subclass," that does not appear anywhere else
in `SPEC.md`, `PLAN.md`, or prior `repo-map.md` entries, and directly conflicts with §9's unconditional "không được
gọi Alpha" rule for genuine Technical Prototype classifications — it has been removed in favor of the plain,
correct label.