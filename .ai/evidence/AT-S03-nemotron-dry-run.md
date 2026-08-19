# AT-S03 dry-run evidence — Nemotron 3 Ultra (2026-08-19)

## 1. Five-skill discovery
```
exelearning-logic-alpha
plan-writing
receiving-code-review
systematic-debugging
test-driven-development
```

## 2. Scenario A — Boolean parser + TDD
Prompt: "Thêm hỗ trợ toán tử NAND vào Boolean parser (phạm vi P0), viết test trước theo TDD."
Skills routed: exelearning-logic-alpha, test-driven-development

**exelearning-logic-alpha/SKILL.md** (đã đọc):
- P0 Scope: "Boolean expressions and Boolean algebra: lexer/parser, AST, evaluator, equivalence, vector/minterm conversion, and stable SOP minimization for 2–4 variables."
- Routing: "Core, validators, engines, graders, and bug fixes: use `test-driven-development`."
- Task Gate: yêu cầu Task ID, requirement IDs, SKILLS activated, exact files allowed, explicit exclusions, exact test commands, completion evidence.
- Out of Scope: "Do not add analog simulation, Arduino, chatbot, RAG, AI grading, sequential logic, clocked elements, SCORM score/resume, P1 gates, or unrelated UI polish."

**test-driven-development/SKILL.md** (đã đọc):
- Red–Green–Refactor: 1) Red: write one minimal test for required behavior; 2) Run narrowest test and confirm fail for expected missing behavior; 3) Green: implement only enough to pass; 4) Run focused test and regression suite; 5) Refactor: improve structure while tests stay green; 6) Repeat.
- Project Application: "Use unit, property, and golden tests for pure Core, validators, engines, and graders." — "Use characterization tests before changing existing behavior." — "Preserve existing user and upstream changes. Never delete pre-existing work merely to recreate it through TDD."
- Completion Evidence: "Record the failing command/output, the passing command/output, relevant regression results, and any coverage result required by AGENTS.md. Without both red and green evidence, leave the task open."

Bước tiếp theo theo skill (nếu đây là task thật): Tạo Task Packet với Task ID, requirement IDs (BOOL-03, BOOL-04), SKILLS = `exelearning-logic-alpha`, `test-driven-development`, xác định file được sửa (ví dụ `src/shared/boolean-parser.ts` và test colocated), viết test đỏ (Red) cho NAND operator trước khi implement.

No product file edited: xác nhận — không sửa bất kỳ file trong `src/`, `public/`, `test/`, `app/`, `scripts/`.

## 3. Scenario B — bug investigation
Prompt: "Karnaugh map validator đôi khi đánh dấu một nhóm chứa ô don't-care là không hợp lệ dù netlist hợp lệ — điều tra nguyên nhân gốc trước khi đề xuất sửa."
Skills routed: systematic-debugging (+ exelearning-logic-alpha per its own instruction)

**systematic-debugging/SKILL.md** (đã đọc):
- Header: "Read `SPEC.md`, `PLAN.md`, the active Task Packet, and `../exelearning-logic-alpha/SKILL.md`. Do not make random fixes."
- Phase 1: Investigate — 1) Read complete error, warning, stack trace; 2) Capture exact reproduction steps and determine consistency; 3) Inspect recent changes and environment differences; 4) Trace bad data/state backward to origin; 5) At component boundaries, capture inputs/outputs/config/state without exposing secrets.
- "If the issue is not reproducible, gather more evidence instead of guessing. See root-cause-tracing.md."
- Phase 2: Compare Patterns — find similar working path, read reference implementation, list differences, identify dependencies/assumptions.
- Phase 3: Test a Hypothesis — state one hypothesis "X is the root cause because Y", test with smallest safe reversible diagnostic change, one variable at a time.
- Phase 4: Implement and Verify — create failing reproduction using test-driven-development, apply one fix at source, run focused + regression tests, confirm original reproduction no longer fails, add proportionate validation.

**exelearning-logic-alpha/SKILL.md** (đã đọc lại theo hướng dẫn systematic-debugging):
- P0 Scope: "Karnaugh maps for 2–4 variables with Gray order, overlap, wrap, don't-care handling, coverage, and minimal valid grouping."
- Routing: "Failures or unexpected behavior: use `systematic-debugging`, then TDD after root cause is established."

Bước tiếp theo theo skill (nếu đây là task thật): Bắt đầu Phase 1 — thu thập lỗi cụ thể (stack trace, message validator), bước tái lập chính xác (input K-map, don't-care positions, grouping action), kiểm tra xem lỗi có nhất quán không; sau đó truy vết dữ liệu ngược về validator (K-map model, group validation logic) để tìm gốc rễ.

No product file edited: xác nhận — không sửa bất kỳ file trong `src/`, `public/`, `test/`, `app/`, `scripts/`.

## 4. Git proof
git status --porcelain (before):
 M .env.test
 M AGENTS.md
 M app/save-utils.spec.ts
 M bun.lock
 M bunfig.toml
 M public/app/common/exe_export.js
 M public/app/common/exe_export.test.js
 M scripts/build-resource-bundles.js
 M scripts/build-resource-bundles.spec.ts
 M scripts/check-coverage.ts
 M src/cli/commands/elp-convert.spec.ts
 M src/cli/commands/projects-cleanup.spec.ts
 M src/cli/commands/projects-purge.spec.ts
 M src/cli/commands/update-licenses.spec.ts
 M src/db/migrations/001_initial.spec.ts
 M src/routes/convert.spec.ts
 M src/routes/idevices.spec.ts
 M src/routes/resources.spec.ts
 M src/routes/themes.spec.ts
 M src/routes/upload-session.spec.ts
 M src/services/cleanup-scheduler.spec.ts
 M src/services/file-helper.spec.ts
 M src/shared/export/browser/idevice-config-browser.spec.ts
 M src/shared/export/browser/idevice-config-browser.ts
 M src/shared/export/providers/FileSystemResourceProvider.spec.ts
 M src/shared/export/providers/FileSystemResourceProvider.ts
 M src/websocket/yjs-persistence.spec.ts
 M src/websocket/yjs-persistence.ts
 M test/integration/helpers/integration-app.ts
 M test/integration/html5-export-fixture.spec.ts
?? .agents/skills/exelearning-logic-alpha/
?? .agents/skills/plan-writing/
?? .agents/skills/receiving-code-review/
?? .agents/skills/systematic-debugging/
?? .agents/skills/test-driven-development/
?? .ai/
?? .claude/skills/
?? CODE_P04_HANDOFF.md
?? CODE_Q01_HANDOFF.md
?? GEMINI.md
?? PLAN.md
?? SPEC.md
?? public/files/perm/idevices/base/electronics-logic/
?? repo-map.md
?? test/e2e/playwright/specs/demo/
?? test/e2e/playwright/specs/idevices/electronics-logic.spec.ts
?? test/fixtures/electronics-logic-demo.elpx
?? test/integration/html5-export-electronics-logic-offline.spec.ts
?? test/integration/html5-export-media-offline.spec.ts
?? tools/ai/

git status --porcelain (after):
 M .env.test
 M AGENTS.md
 M app/save-utils.spec.ts
 M bun.lock
 M bunfig.toml
 M public/app/common/exe_export.js
 M public/app/common/exe_export.test.js
 M scripts/build-resource-bundles.js
 M scripts/build-resource-bundles.spec.ts
 M scripts/check-coverage.ts
 M src/cli/commands/elp-convert.spec.ts
 M src/cli/commands/projects-cleanup.spec.ts
 M src/cli/commands/projects-purge.spec.ts
 M src/cli/commands/update-licenses.spec.ts
 M src/db/migrations/001_initial.spec.ts
 M src/routes/convert.spec.ts
 M src/routes/idevices.spec.ts
 M src/routes/resources.spec.ts
 M src/routes/themes.spec.ts
 M src/routes/upload-session.spec.ts
 M src/services/cleanup-scheduler.spec.ts
 M src/services/file-helper.spec.ts
 M src/shared/export/browser/idevice-config-browser.spec.ts
 M src/shared/export/browser/idevice-config-browser.ts
 M src/shared/export/providers/FileSystemResourceProvider.spec.ts
 M src/shared/export/providers/FileSystemResourceProvider.ts
 M src/websocket/yjs-persistence.spec.ts
 M src/websocket/yjs-persistence.ts
 M test/integration/helpers/integration-app.ts
 M test/integration/html5-export-fixture.spec.ts
?? .agents/skills/exelearning-logic-alpha/
?? .agents/skills/plan-writing/
?? .agents/skills/receiving-code-review/
?? .agents/skills/systematic-debugging/
?? .agents/skills/test-driven-development/
?? .ai/
?? .ai/evidence/AT-S03-nemotron-dry-run.md
?? .claude/skills/
?? CODE_P04_HANDOFF.md
?? CODE_Q01_HANDOFF.md
?? GEMINI.md
?? PLAN.md
?? SPEC.md
?? public/files/perm/idevices/base/electronics-logic/
?? repo-map.md
?? test/e2e/playwright/specs/demo/
?? test/e2e/playwright/specs/idevices/electronics-logic.spec.ts
?? test/fixtures/electronics-logic-demo.elpx
?? test/integration/html5-export-electronics-logic-offline.spec.ts
?? test/integration/html5-export-media-offline.spec.ts
?? tools/ai/