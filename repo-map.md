# Solo Logic Alpha Repository Map

Baseline evidence for task **P01** and requirement **PLAT-01**. This file records the source revision, toolchain
contract, reproducible commands, and the smallest relevant module map before product code is changed.

Last verified: **2026-08-12** on Windows 11 from VS Code with native PowerShell.

## Source baseline

| Item | Pinned value |
|---|---|
| Repository | `exelearning/exelearning` |
| Upstream URL | `https://github.com/exelearning/exelearning.git` |
| Working fork | `https://github.com/danghoangsqtt-sys/exelearning.git` |
| Branch | `feature/solo-logic-alpha` tracking `upstream/main` |
| Commit | `3c7c7e82163e812f04cbb033240942f8ac1214a0` |
| Commit date | `2026-08-06` |
| Commit subject | `Fix typo in CHANGELOG for file attachments (#2243)` |
| Baseline relation | `HEAD == upstream/main` at verification time |
| Dependency lock | `bun.lock`, lockfile version `1`, config version `1` |

The commit hash, rather than the moving branch name, is the reproducible source pin for Solo Logic Alpha. A later
upstream update requires a deliberate baseline change and a new verification record.

## Toolchain contract

The repository declares Bun `1.3` in `Dockerfile` (`ARG BUN_VERSION=1.3`) and the development guide requires Bun
`1.3+`. CI currently requests `bun-version: latest`, so upstream does not provide a patch-level Bun pin. For this
baseline, **Bun 1.3.x** is the supported runtime family and `bun.lock` is authoritative for dependencies. P02 must
record the exact installed Bun patch version before accepting a successful Windows build.

| Tool | Repository contract | Observed in the current VS Code terminal |
|---|---|---|
| Bun | `1.3.x` baseline family | `1.3.14` in the verified Docker build; not on native PowerShell `PATH` |
| GNU Make | Required by the documented workflow | Not installed or not on `PATH` |
| Node.js | Used by supporting tooling; CI database matrix uses Node 22 | `24.12.0` |
| npm | Supporting CLI only; Bun remains the package manager | `11.8.0` via `npm.cmd` |
| Git | Required | `2.53.0.windows.1` |
| Docker Desktop | Supported container path on Windows | Engine `29.5.3`, Linux/WSL2 |
| TypeScript | Locked dependency, source target `ES2021` | `^7.0.2` in `package.json` |
| Electron | Desktop runtime | `^43.0.0` in `package.json` |
| Playwright | E2E runner | `^1.58.2` in `package.json` |
| Vitest | Frontend unit-test runner | `^4.0.18` in `package.json` |

Windows execution constraint: `doc/development/environment.md` recommends WSL2, while `Makefile` contains native
Windows guards and POSIX commands. Native PowerShell also blocks `npm.ps1` under the current execution policy, but
`npm.cmd` works. P02 should use WSL2 as the primary reproducible shell and must not upgrade dependencies unless a
demonstrated blocker requires it.

## Canonical commands

Run from the repository root in WSL2 (preferred on Windows 11):

```bash
make deps
make bundle
make up-local
make run-app
```

Quality gates from `AGENTS.md` and `Makefile`:

```bash
make fix
make test-unit
make test-integration
make test-e2e
make test-e2e-static   # required when static build, embedding, or export is affected
make test-coverage
```

Runner ownership is fixed: backend `src/**/*.spec.ts` uses Bun test; frontend and iDevice `*.test.js` under
`public/` use Vitest; user-visible flows use Playwright specs under `test/e2e/playwright/specs/`.

## Relevant module map

```text
eXeLearning
├── app/                                      Electron desktop shell
│   ├── main.js                               Electron main process
│   ├── preload.js                            Renderer bridge
│   └── save-utils.js                         Desktop save helpers
├── public/
│   ├── app/workarea/idevices/                Installed-iDevice catalogue and UI manager
│   │   ├── idevice.js                        Parsed iDevice model
│   │   ├── idevicesList.js                   Catalogue loading and lookup
│   │   └── idevicesManager.js                Workarea integration
│   ├── app/workarea/project/
│   │   ├── idevices/idevicesEngine.js        Editor lifecycle and iDevice instances
│   │   └── projectManager.js                 Project open/save orchestration
│   ├── app/workarea/interface/elements/
│   │   ├── previewPanel.js                    Preview UI and browser-side preview request
│   │   └── saveButton.js                      Save entry point
│   ├── app/yjs/
│   │   ├── YjsDocumentManager.js              Canonical browser document state
│   │   ├── YjsProjectManagerMixin.js          ELPX import entry point
│   │   ├── YjsProjectBridge.js                Project/Yjs import-export bridge
│   │   └── CollaborativeAutosaveManager.js    Autosave lifecycle
│   ├── files/perm/idevices/base/
│   │   └── electrical-circuits/               Closest existing interactive reference
│   │       ├── config.xml                     Palette metadata
│   │       ├── edition/                       Editor CSS, JS, tests, and assets
│   │       └── export/                        Export runtime CSS, JS, tests, and assets
│   └── preview-sw.js                          In-memory preview file router
├── scripts/build-static-bundle.ts             Static catalogue/build integration
├── src/
│   ├── index.ts                               Elysia bootstrap and preview service-worker route
│   ├── routes/idevices.ts                     Dynamic iDevice catalogue endpoint
│   ├── shared/parsers/idevice-parser.ts        Shared config.xml parser
│   └── shared/export/
│       ├── browser/index.ts                   SharedExporters browser facade and preview generation
│       ├── adapters/YjsDocumentAdapter.ts      Yjs-to-export adapter
│       ├── exporters/Html5Exporter.ts          HTML5 and preview file generation
│       └── renderers/IdeviceRenderer.ts        iDevice export rendering and asset rewriting
└── test/e2e/playwright/
    ├── helpers/workarea-helpers.ts             Stable workarea/save/preview helpers
    └── specs/                                  User-visible flow coverage
```

### P03 reference boundary

`public/files/perm/idevices/base/electrical-circuits/` demonstrates the required `config.xml`, separate edition and
export runtimes, and colocated Vitest coverage. Electronics Logic should follow the platform contract without copying
its domain implementation or bundled font/image payload. Catalogue discovery flows through the shared parser and
either `src/routes/idevices.ts` (dynamic app) or `scripts/build-static-bundle.ts` (static app).

### State and export boundary

The browser Yjs document is the source of truth. Product work must preserve this path:

```text
iDevice editor
  -> project iDevice lifecycle
  -> YjsDocumentManager
  -> save/open through YjsProjectManagerMixin and YjsProjectBridge
  -> YjsDocumentAdapter
  -> IdeviceRenderer
  -> preview service worker or HTML/SCORM exporter
```

No `.agents`, `.claude`, `.ai`, or AI-development document may be included in HTML or SCORM output.

## P01 findings

P01 maps the repository without changing product code. The source revision is pinned and the relevant paths are now
known.

## P02 Windows build evidence

P02 was verified from Windows 11 through Docker Desktop's Linux/WSL2 engine. The machine has only the internal
`docker-desktop` WSL2 distribution, so the documented WSL2 + GNU Make development shell is not provisioned. A clean
container based on the repository's `oven/bun:1.3-alpine` contract reported Bun `1.3.14` and kernel
`6.18.33.2-microsoft-standard-WSL2`.

The source tree at the pinned commit was copied into a dependency-stage container and executed with:

```sh
bun run build:all
bun run start
```

Observed acceptance evidence:

- Backend and CLI bundles completed: `dist/index.js` and `dist/cli.js`.
- CSS, application, importers, exporters, slide editor, themes, libraries, and the iDevice resource bundle completed.
- The resource build discovered 52 iDevices.
- SQLite migrations `000` through `007` completed and six base themes synchronized.
- Elysia and the Yjs WebSocket relay started on container port 8080.
- `GET http://127.0.0.1:18080/healthcheck` returned HTTP 200 with `{"status":"ok",...}`.
- `GET http://127.0.0.1:18080/login` returned HTTP 200 with 2,624 bytes.
- The temporary smoke container was stopped and removed after verification; dependency image/cache remains local.

The standard Dockerfile builder also completed the application build, but its final builder cleanup command
(`rm -rf node_modules && bun install --production`) stopped producing output after `bun install v1.3.14` for more
than 185 seconds. The Docker CLI used for that diagnostic was canceled without changing the Dockerfile. This is a
packaging-stage baseline observation, not an application build failure and not a P02 source-code change.

P02 status: **PASS** for running the pinned source on Windows 11 via Docker Desktop. Native PowerShell and a general
WSL2 development distro remain unprovisioned, so future use of the `make` workflow requires installing/selecting that
toolchain or continuing through the documented Docker path.

## P03–P04 Electronics Logic evidence

P03 registered `electronics-logic` as the 53rd iDevice and verified palette discovery plus dynamic/static rendering.
P04 added the canonical `schemaVersion: 1` lifecycle contract, schema-0 and legacy-placeholder migration, validation,
stable save/open normalization, and export rendering. Focused evidence on Bun 1.3.14/Node 22/Playwright 1.58.2:

- Vitest: 11/11 passed; 98.93% line, 99.06% statement, and 100% function coverage for the two runtime files.
- Dynamic Playwright: 1/1 passed through palette → editor → Yjs save → reload → preview.
- Static Playwright: 1/1 passed through the same lifecycle on the generated static bundle.
- Integration: 727/727 passed.
- Backend unit execution: 7,998/7,998 tests passed.

## G-P0 evaluation

G-P0 status on 2026-08-12: **FAIL**. The P03/P04 product slice itself passes, but the repository-wide Definition of
Done remains blocked by pre-existing baseline failures outside the P04 Task Packet:

- The backend coverage checker reports `src/websocket/yjs-persistence.ts` at 88.97% lines, below its 90% per-file
  threshold, despite all 7,998 backend unit tests passing.
- A clean full Chromium run reports 494 passed, 34 failed, and 7 skipped. Failures cluster in existing asset/file
  manager/theme/media flows; a representative `should upload file to folder` failure reproduces with one worker.
- The full frontend Vitest run has one unchanged timing assertion differ by 1 ms; that exact test passes alone.

`make fix` exits 0 (with three unchanged baseline warnings). C01 was initially stopped at the failed gate; after the
G-P0 timebox expired, the PLAN fallback authorized standalone Core work only under the explicit `Technical Prototype`
classification. It must not be represented as a platform-ready integrated feature.

## C01-C06 standalone Boolean Core evidence

The PLAN fallback was activated after G-P0's timebox expired. C01-C06 therefore implement a standalone
`Technical Prototype`; they do not change the failed platform-gate status and are not represented as an integrated
Alpha feature.

The Core now provides a DOM/Electron-independent contract, lexer/normalizer, recursive-descent parser, evaluator,
truth vectors, equivalence, minterm/don't-care conversion, canonical SOP conversion, bidirectional Gray-code K-map
models, and an exact stable SOP minimizer for at most four variables. It never executes expression strings through
`eval` or `Function`.

G-C0 status on 2026-08-12: **PASS** within the `Technical Prototype` classification.

- Golden syntax coverage: 30 valid fixtures and 12 invalid fixtures with Vietnamese error evidence.
- Focused Core Vitest: 143/143 passed.
- Focused Core coverage: 100% statements, branches, functions, and lines.
- Property evidence: 100 deterministic canonical-SOP/minimized-SOP equivalence pairs passed.
- Measured focused coverage run: 3.05 seconds; its 100-pair property test completed in 0.43 seconds.
- Full frontend Vitest regression: exit 0 in 139.3 seconds.
- Biome: Core source, contract, and JSON fixture passed with no fixes required.
- Security boundary scan: no DOM, Electron, `eval`, or `Function` dependency in the Core module.

G-P0 remains **FAIL** for the pre-existing repository-wide blockers recorded above. The next approved backlog task is
T01, but every downstream result remains a `Technical Prototype` until the platform gate is repaired and re-evaluated.

## T01 Boolean/Truth Table authoring evidence

T01 is **PASS** on 2026-08-12 under the existing `Technical Prototype` classification. The editor now writes one
canonical schema-v1 model for Boolean and truth-table activities: mode, two to four ordered variables `A`–`D`, prompt,
expression or minterm/don't-care answer source, maximum score, and a short author solution. It validates the draft
before save, reports stable Vietnamese field errors, sorts valid minterm lists, and rejects duplicates, out-of-range
indices, overlap, malformed tokens, empty prompts, empty expressions, and non-positive scores.

Schema-0 truth-table output vectors are enriched into minterms without removing their original `outputs`; the P03
placeholder payload remains editable and retains its placeholder content. Ten save/reopen normalization cycles preserve
authoring, answer, learner, and accessibility data. Learner UI, equivalence grading, Karnaugh/circuit authoring, and the
preview/export runtime remain outside T01 and start at T02/T03 or later PLAN tasks.

Evidence from the pinned local Docker toolchains:

- Red: the first focused T01 run reported 9 failed and 3 passed because authoring controls/model validation were absent.
- Edition Vitest: 13/13 passed.
- Electronics Logic regression: 159/159 passed across Core, edition, and export.
- Focused edition coverage: 94.24% statements, 90.09% branches, 95.12% functions, and 95.95% lines.
- Focused Biome: the four T01 product/test files passed with no fixes required.
- Dynamic Chromium: 1/1 passed through authoring → Yjs save → reload → preview.
- Static Chromium: 1/1 passed against a fresh static distribution; static build completed successfully.
- Full frontend Vitest: exit 0 in 105.2 seconds.
- The three commands behind `make fix` exited 0. GNU `make` itself is unavailable in both native PowerShell and the
  pinned image; unchanged warnings remain in `src/routes/export.ts`, `block-icons.spec.ts`, and
  `focused-edit-mode.spec.ts`.

The first dynamic E2E attempt proved the source workspace lacked generated `app.bundle.js` and `main.css`; `build:all`
created them and the unchanged test passed. The first static harness used a missing `serve` binary; the final run served
the already-built distribution with the Playwright image's built-in HTTP server and passed without downloading anything.
G-P0 remains **FAIL** for the earlier repository-wide blockers outside T01. The next approved task is T02.

## T02 learner UI evidence

T02 is **PASS** on 2026-08-12 under the existing `Technical Prototype` classification. Boolean activities now render
an isolated learner expression input. Truth-table activities render exactly `2^n` rows in binary-ascending order, with
each output restricted to blank, `0`, `1`, or `X`. Both modes expose an instance-local reset action and an accessible
Vietnamese incomplete-state message. The learner runtime validates schema-v1 payloads defensively and renders an alert
instead of throwing for malformed data; saved answers and author solutions are never placed in learner HTML.

The production lifecycle passes JSON data, not a DOM root, to `renderBehaviour` and `init`; the runtime now supports
that signature while retaining an explicit-root path for unit isolation. A second integration defect was traced to the
browser exporter registry: `config.xml` declared Electronics Logic as JSON, but the browser shim classified it as HTML.
That mismatch suppressed `data-idevice-component-type="json"`, so `exe_export.js` never invoked the learner lifecycle.
A focused Red test captured the mismatch before `electronics-logic` was added to the JSON registry.

Evidence from the pinned local Docker toolchains:

- Red: the initial learner-runtime suite reported 7 failures; a later production-signature lifecycle test and browser
  exporter registry test also failed before their respective fixes.
- Learner runtime Vitest: 11/11 passed.
- Learner runtime coverage: 98.82% statements, 95.23% branches, 100% functions, and 100% lines.
- Browser exporter registry: 68/68 Bun tests passed with 100% function and line coverage.
- Electronics Logic regression: 167/167 passed across Core, edition, and export.
- Dynamic Chromium: 1/1 passed through authoring, Yjs save/reload, learner input, state transitions, and reset.
- Static Chromium: 1/1 passed against a newly generated static distribution.
- Full frontend Vitest: exit 0 in 109.4 seconds.
- Focused Biome passed with no fixes. Full `src` and `test` lint commands exited 0; only the three unchanged baseline
  warnings recorded under T01 remain.

The first browser rerun still used a stale iDevice resource bundle. After rebuilding it, DOM evidence exposed the
independent JSON-classification root cause. Rebuilding the exporters bundle and restarting the clean local server made
the unchanged dynamic test pass; the fresh static build passed the same flow. All temporary diagnostic code was removed.
G-P0 remains **FAIL** for repository-wide blockers outside T02. The next approved task is T03.

## T03 grader and feedback evidence

T03 is **PASS** on 2026-08-12 under the existing `Technical Prototype` classification. A deterministic pure grader now
uses the existing Boolean Core for both expected truth vectors and all-assignment expression equivalence. Truth-table
checks return independent row evidence, treat author don't-cares as accepting `0`, `1`, or `X`, and calculate a stable
score. Boolean syntax failures return position/code/message evidence without placing the author expression in feedback.
Every result follows the SPEC `GradingResult v1` shape with injected attempt/time metadata and engine version `0.1.0`.

The learner runtime adds Check and accessible Vietnamese feedback. No answer or per-control result is rendered before
the first check. Reset clears input, marks, feedback, and the in-memory last result while retaining prompt/authoring.
The runtime never embeds a second parser/evaluator: `scripts/build-resource-bundles.js` bundles the canonical CommonJS
Core and grader through a small ESM adapter into a 19.1 KB browser IIFE. Dynamic config and the browser exporter both
load that IIFE before the learner runtime; the same artifact is included in `idevices.zip` and the static PWA.

Evidence from the pinned local Docker toolchains:

- Red: the grader suite first failed because its module did not exist; the feedback suite then reported 4 expected
  failures before Check, feedback, attempt metadata, and grading behavior were implemented.
- Grader Vitest: 14/14 passed; 95.83% statements, 96.92% branches, 100% functions, and 100% lines.
- Learner runtime Vitest: 15/15 passed; 91.44% statements and 92.96% lines.
- Offline browser-bundle smoke: 1/1 passed without Node globals.
- Electronics Logic regression: 186/186 passed across six files.
- Resource artifact and browser exporter registry: 81/81 Bun tests passed with 1,149 assertions.
- Dynamic Chromium: 1/1 passed with per-cell marks, `7 / 8` evidence, no pre-check feedback, and reset cleanup.
- Static Chromium: 1/1 passed against a freshly generated PWA distribution.
- Full frontend Vitest: exit 0 in 106.5 seconds.
- Focused Biome: all 11 supported T03 source/test files passed with no fixes or warnings.

The first CommonJS IIFE build contained the grader but did not invoke its entry wrapper. The dedicated browser smoke
test caught the missing global; changing only the adapter to `.mjs` made top-level initialization explicit while the
Core/grader remained CommonJS and authoritative. The tested build step now regenerates the artifact deterministically.
G-P0 remains **FAIL** for repository-wide blockers outside T03. The next approved task is K01.

## K01 Karnaugh Gray model evidence

K01 is **PASS** on 2026-08-12 under the existing `Technical Prototype` classification. Dependency C05 had already
implemented the complete pure Karnaugh model required by KM-01, so this gate deliberately made no redundant product
change. The canonical Core maps two-, three-, and four-variable truth vectors to locked Gray-code cell layouts, exposes
deterministic axis labels and assignments, and maps edited cells back to the truth vector without changing minterm
identity. Invalid dimensions, cell counts, and layouts are rejected.

Evidence from the pinned local Node 22 toolchain:

- Focused K-map Vitest: 6/6 passed, with 128 unrelated Core cases excluded by the test-name filter.
- Golden layouts passed for two variables `[[0,1],[2,3]]`, three variables `[[0,1,3,2],[4,5,7,6]]`, and four
  variables `[[0,1,3,2],[4,5,7,6],[12,13,15,14],[8,9,11,10]]`.
- Deterministic axes/assignments, edited-cell round-trip, and invalid-model validation all passed.
- The focused run completed in 1.14 seconds.

G-P0 remains **FAIL** for repository-wide blockers outside K01. The next approved task is K02.

## PM/Tester independent verification (2026-08-13, native Windows)

Independent verification pass by Claude Code, acting as PM/Tester per direct project-owner instruction given
in-session (not a Task Packet writer — Codex remains the sole implementation writer). Run natively on the Windows 11
host via Git Bash, **not** the pinned Docker toolchain used for every evidence entry above. Recorded to keep this
file and `.ai/skills.lock.json` synchronized with the true state of the working tree. Nothing below invalidates the
Docker-based evidence already recorded, which remains the authoritative gate record for P01-K01.

**electronics-logic regression, current count:** 203/203 passed across 7 files (Vitest, scoped to the iDevice
directory), up from the 186/186 across six files recorded under T03. The difference is `core/schema-lifecycle.test.js`
(P04's deliverable, 15 tests) — completed in the working tree but not yet folded into a dated P04 gate entry here.

**G-P0 coverage blocker confirmed fixed:** `src/websocket/yjs-persistence.ts` is now **100.00%** line / **100.00%**
function coverage (was 88.97%). Full run: `bun test ./src ./test/helpers ./scripts ./app --coverage` → 7830 pass, 39
fail, 113141 expect() calls, 7869 tests across 220 files, 115.70s.

**New finding, native-Windows-only, not caused by the uncommitted diff:** all 39 failures share one root cause.
`.env`/`.env.dist` ship `DB_PATH=/mnt/data/exelearning.db` (the Docker/prod default per AGENTS.md §8). `bunfig.toml`
sets `DB_PATH=:memory:` for `[test]`, but that override does not take effect for code paths that call the real
`getDb()` singleton on native Windows — reproduced deterministically in complete isolation
(`bun test src/routes/config.spec.ts -t "should return application settings"` fails identically alone, 1 test, 1
file). The pre-existing Docker-path guard in `src/db/dialect.ts` (introduced 2026-02-05, PR #1200 — unrelated to
Solo Logic Alpha) then throws because `/mnt/` is rejected on non-Linux. Affected: `src/routes/config.spec.ts` (3),
`src/routes/games.spec.ts` (19), and eight `src/routes/api/v1/*.spec.ts` files (17). None of these files, nor
`src/db/dialect.ts`, `src/db/client.ts`, `.env`, `.env.dist`, or `bunfig.toml`, are part of the current uncommitted
diff — confirmed by cross-referencing every failing stack trace against `git diff --stat`. Every prior evidence entry
above ran inside the pinned Docker container, where `/mnt/` is a valid Linux path and the guard never fires, so this
finding does not contradict the previously recorded `7,998/7,998` Docker-toolchain figure; it is a distinct gap that
only appears on bare native Windows (no Docker) — the platform SPEC.md mandates for Alpha acceptance. Recommend a
dedicated debugging task (skill: `systematic-debugging`) rather than folding it into any product Task Packet.

**Lint:** `bun run lint:src`, `bun run lint:test`, and the exact explicit iDevice file list from
`CODE_P04_HANDOFF.md` all exit clean against the current working tree. Zero new errors/warnings from the uncommitted
diff; the only warnings present (1 in `src/routes/export.ts`, 2 in
`test/e2e/playwright/specs/idevices/focused-edit-mode.spec.ts`) are in files outside the diff.

**Undeclared Windows-compatibility changes outside the P04 Task Packet:** the working tree also modifies 16 files
outside both the P04 file list and the electronics-logic iDevice tree: `app/save-utils.spec.ts`, `bun.lock`,
`scripts/build-resource-bundles.js`/`.spec.ts`, `scripts/check-coverage.ts`, four `src/cli/commands/*.spec.ts`
files, `src/db/migrations/001_initial.spec.ts`, five `src/routes/*.spec.ts` files,
`src/services/cleanup-scheduler.spec.ts`, `src/services/file-helper.spec.ts`,
`src/websocket/yjs-persistence.ts`/`.spec.ts`, and `test/integration/helpers/integration-app.ts`. Content is a
coherent Windows-compatibility pass — `toPosix()` path normalization, a deterministic EISDIR-forcing technique
replacing unreliable `chmod(0o444)`, a `DEBUG`-const-to-`isDebugEnabled()` refactor for testability, and a
`path.relative`-based fix to a naive `.includes()` directory-safety check — directly targeting the exact G-P0
blocking evidence recorded above. Filesystem `LastWriteTime` on every one of these 16 files falls between 12:33 PM
and 2:15 PM on 2026-08-12, **before** `CODE_P04_HANDOFF.md` existed (2:38 PM) — i.e. earlier in the same continuous
session, not made under the P04 Task Packet's cover. `repo-map.md` and `.ai/skills.lock.json` were both last written
at 11:07 AM that day, before this block of work happened, which is why neither reflected it until now. This was not
declared as its own Task Packet per AGENTS.md §13. The project owner was notified in-session and elected to grant
full authority to the PM/Tester to resolve and record this rather than require a retroactive Task Packet or further
origin investigation. Content-wise the changes are lint-clean and test-verified as described above.

**E2E (Playwright/Chromium), native Windows result:** a full `bun x playwright test --project=chromium` run against
the current working tree completed with **528 passed, 1 failed, 6 skipped (22.0 min)** — the single failure
(`test/e2e/playwright/specs/idevices/geogebra-activity.spec.ts:93`, "display sizing... exposes visible width/height
controls") is a deterministic `page.waitForFunction` timeout, reproduced identically on two immediate retries (not
flaky), in a GeoGebra iDevice spec unrelated to electronics-logic or any of the 16 Windows-compat files.

**This is not treated as a re-verification of the Docker-gathered 34-failure blocking evidence above**, for two
reasons: (1) it runs on a different environment (native Windows vs. the pinned Docker/Linux toolchain used for
every other entry in this file, so Docker-side timing/filesystem/worker behavior is not reproduced), and (2) a
file-level causal check makes it implausible the 16 out-of-scope files could move that number at all — all 16 are
`*.spec.ts` backend unit tests, build/CLI scripts, or `src/websocket/yjs-persistence.ts` (server-side snapshot
persistence robustness/coverage only); none touch `public/app/**` frontend code, exporters/renderers, or any E2E
spec file that Chromium-rendered flows would exercise. Docker was confirmed available on this host
(`docker info` succeeds) and a from-scratch Docker rebuild was considered, but rejected in favor of this direct
causal read: reverse-engineering the original unrecorded container methodology risked introducing a new,
weaker-evidence confound rather than resolving the existing one.

**Conclusion:** G-P0's Chromium blocker (494/34/7, Docker-gathered, clustered in asset/file-manager/theme/media
flows, representative failure `should upload file to folder`) is **not re-verified and remains open**. It should
not be attributed to, or expected to be fixed by, the 16-file Windows-compat diff. If formal re-verification is
required, it needs either the original Docker methodology repeated, or a dedicated investigation into the
upload-to-folder failure directly (candidate for `systematic-debugging`, outside Solo Logic Alpha scope). G-P0
status is **FAIL**: the coverage blocker is resolved; the Chromium blocker is unresolved; the 1ms Vitest timing
item is re-checked immediately below.

**Frontend Vitest, native Windows result:** a full `bun run test:frontend` run completed with **267/267 test files
passed, 14324/14324 tests passed**, exit 0 — the previously-recorded 1ms timing assertion did not fail in this run.
This is one clean run, not a repeated-trials guarantee against an inherently timing-sensitive assertion; repo-map.md
already recorded that the same test "passes alone," so a single flake-free full run is consistent with, not
proof beyond, that prior finding. Treated as not-currently-reproducing rather than permanently fixed.

**Overall G-P0 call:** remains **FAIL**. One of three blocking-evidence items (coverage) is conclusively resolved;
one (1ms Vitest flake) did not reproduce in a clean run but is not conclusively eliminated; one (34 Chromium
failures) is genuinely unresolved and is the substantive remaining blocker. Per the existing PLAN fallback already
in effect since C01, this does not by itself pause work: every task from C01 through K01 already proceeds under the
`Technical Prototype` classification specifically because G-P0 is FAIL. K02 may continue on that same,
already-established basis — this is a continuation of the standing fallback, not a new exception.

## K02 Karnaugh UI evidence (PM/Tester independent verification, 2026-08-13)

K02 is **PASS** on 2026-08-13 under the existing `Technical Prototype` classification. Codex implemented and
reported K02 complete, but explicitly declined to self-declare the gate closed because `make fix` could not run in
its environment (`make: command not found`). Per AGENTS.md §13.6, this report is not accepted on Codex's word alone;
every claim below was independently re-run by Claude Code (PM/Tester) natively on Windows 11 via Git Bash.

The learner runtime now renders the K-map grid (Gray-order row/column labels for 2-4 variables, sourced from
`$electronicsLogicCore.vectorToKmapModel`), accepts `0`/`1`/`X` per cell, supports click-to-select (no drag) with an
explicit "create group" action, and lists groups with highlight/remove. `collectResponse()` returns
`{ cells, groups }` per the contract locked in this packet. `schema-lifecycle.validate()` now rejects `kmap`
activities with an empty prompt, a variable count outside 2-4, or minterm/don't-care duplicate/out-of-range/overlap,
closing the PLAT-06 gap the PM amendment identified before handoff (`AUTHORING_MODES` was missing `'kmap'`). K03
(group validator) and K04 (K-map grader) are out of scope and were not implemented; the K-map UI still shows the
Vietnamese "cannot grade yet" message, as expected.

**File scope, independently confirmed exact:** diffing the working tree against the K01 checkpoint commit
(`a867616f`) — not `git status`, which can't isolate K02 changes inside an already-untracked directory — shows
precisely the 10 packet files changed: 653 insertions(+), 32 deletions(-), nothing else touched. Two files were
read in full diff to confirm surgical scope: `schema-lifecycle.js` changed exactly one line (`'kmap'` added to
`AUTHORING_MODES`); `boolean-grader-browser.mjs` added exactly two lines (import `boolean-core.js`, assign
`globalThis.$electronicsLogicCore`). Neither `boolean-core.js`, `boolean-grader.js`, `boolean-core-contract.js`
(frozen since C05), nor `translations/**` was touched.

**Vitest, independently re-run, all green:**

- `core/schema-lifecycle.test.js`: 22/22 passed.
- `export/electronics-logic.test.js`: 22/22 passed.
- `edition/electronics-logic.test.js`: 19/19 passed.
- Core regression (4 files): 179/179 passed.
- Full electronics-logic regression (7 files): 221/221 passed.

**Playwright Chromium**, `test/e2e/playwright/specs/idevices/electronics-logic.spec.ts`: 2/2 passed in 23.3s —
K-map cell/group editing with grading gated for K04, and truth-table minterm authoring through
palette/editor/reload/preview.

**Bundle rebuild, verified byte-for-byte:** `electronics-logic-grader.bundle.js` is 19,658 bytes (was 19,602);
SHA-256 `55fd117fa9a3bc224e1a35926a74ea87e5418a205480a6e66bf30bfad82b9454`; exactly one occurrence of
`$electronicsLogicCore`, at a genuine `globalThis` assignment.

**`make fix` gate — claim confirmed, plus a deeper tooling-scope finding.** `which make`, `command -v make`, and
`make --version` all fail with "command not found" in this native Windows Git Bash environment, reproduced
independently in a separate terminal from Codex's. Reading `Makefile` and `package.json` further shows that even
with GNU Make installed, `make fix` (`fix-ts` → `biome check --write src/`, `fix-js` → `biome lint --write
public/app/`, `fix-tests` → `biome check --write test/`) would not reach 9 of these 10 files anyway —
`public/files/perm/idevices/**` is not in any of those three globs; only the E2E spec under `test/` is covered.
This is a pre-existing repository tooling-scope gap, not a K02 defect. `biome.json`'s own top-level `files.includes`
(`**` minus a short denylist) does cover `public/files/perm/idevices/**` for non-test files, and its
`public/files/perm/idevices/**/*.test.js` override disables linting (not formatting) for test files — so running
Biome directly against the named files is a config-consistent substitute, not an ad-hoc bypass. Independently run:
`bun x biome check <the same 9 files Codex named>` → `Checked 9 files in 50ms. No fixes applied.`, exit 0 — an exact
match to Codex's reported output. The K02 gate is closed on this substitute check plus the full
Vitest/Playwright/file-scope verification above, not on a lint waiver.

G-P0 remains **FAIL** for the pre-existing repository-wide blockers recorded above and is unaffected by K02. The
next approved task is K03.

## K03 Group validator evidence (PM/Tester independent verification, 2026-08-13)

K03 is **PASS** on 2026-08-13 under the existing `Technical Prototype` classification. Codex implemented K03,
applied the K02-established Biome substitute for the missing `make fix` proactively this time (no self-declaration
decline needed), and reported completion with inline command output. Per AGENTS.md §13.6, this report is not
accepted on Codex's word alone; every claim below was independently re-run by Claude Code (PM/Tester) natively on
Windows 11 via Git Bash, using the same K01-checkpoint diff methodology established at K02.

The learner runtime now validates every candidate K-map group before creating it. `core/kmap-group-validator.js` is
a new, pure CommonJS module (no DOM) implementing the algorithm locked in the K03 packet: a group's cell count must
be in `{1,2,4,8,16}` and not exceed `2^variableCount` (`invalidSize`); folding `cell XOR cells[0]` across every
member with bitwise OR must produce a `varyMask` whose popcount equals `log2(size)`, i.e. a true Gray-space
rectangle including wraparound (`notRectangle`); and no member cell may currently hold the learner-entered value
`'0'` (`containsZero` — `''` and `'X'` are explicitly allowed). `createKmapGroup` in the runtime now calls this
validator first, shows a Vietnamese `aria-live="assertive"` message and leaves the current selection untouched on
rejection, and only creates/clears on success. `collectResponse()`'s `{ cells, groups }` contract is byte-for-byte
unchanged from K02 — `groups[].cells` is now guaranteed by construction to always be a valid rectangle that avoids
zero cells, an invariant K04's grader can rely on without re-validating shape.

**File scope, independently confirmed exact:** diffing the working tree against the K01 checkpoint commit
(`a867616f`), scoped to the electronics-logic tree, the E2E spec, and `.ai/packets` — shows precisely the 10
already-verified K02 files plus 3 new K03 files (`kmap-group-validator.js`, its colocated test, and the packet
itself); nothing else changed. `schema-lifecycle.js` and `edition/electronics-logic.js` were re-diffed in full
against the K01 baseline and found byte-identical to the already-verified K02 state — K03 did not touch either
forbidden file. `schema-lifecycle.test.js` and `edition/electronics-logic.test.js` were grepped for
group/`validateKmapGroup` content: zero matches. `export/electronics-logic.css`'s full 113-line diff against K01 was
read and confirmed 100% pre-existing K02 grid/cell styling — no feedback/error/invalid selector was added, matching
Codex's claim that the existing `role="alert"` pattern was reused as-is with no CSS change needed.

**`boolean-grader-browser.mjs`**, read in full diff: exactly two lines added (`import kmapGroupValidator`, assign
`globalThis.$electronicsLogicKmapValidator`) on top of the untouched K02 two lines. **`export/electronics-logic.js`**,
read in full diff: a new `getKmapValidator` helper mirrors the existing `getCore` pattern; `createKmapGroup` derives
`variableCount` via `Math.log2()` of the rendered cell count (no new DOM state added), builds a minterm-indexed
`values` array from the live `<select data-role="kmap-value">` state, and calls the validator before any group DOM
node is created.

**Vitest, independently re-run, all green:**

- `core/kmap-group-validator.test.js`: 17/17 passed.
- `export/electronics-logic.test.js`: 26/26 passed — including a wraparound+overlap case (`[0,2,8,10]` then `[0,2]`
  in a 4-variable map) and an invalid-size case that asserts the selection is *not* cleared on rejection.
- Core regression (5 files): 196/196 passed.
- Full electronics-logic regression (8 files): 242/242 passed.

**Playwright Chromium**, `test/e2e/playwright/specs/idevices/electronics-logic.spec.ts`: 3/3 passed in 21.3s — the
pre-existing truth-table spec, the K02-scope K-map edit/group/grading-gated spec, and a new K03 spec that selects an
invalid 3-cell group (rejected, selection preserved), then toggles one cell off to reach a valid 2-cell group
(accepted). Codex's report claimed a mid-task E2E race-condition fix (a new deterministic wait on
`data-behaviour-bound="true"` before the first click); this was investigated by grepping the runtime, which confirms
`data-behaviour-bound` is pre-existing K01/K02 infrastructure inside `renderBehaviour`'s double-bind guard — the fix
was a test-only wait added inside the one already-approved E2E spec file, not undisclosed production-code scope
creep.

**Bundle rebuild, verified byte-for-byte:** `electronics-logic-grader.bundle.js` is 20,171 bytes (was 19,658, +513 —
the "before" figure matches this PM's own independently-recorded K02 measurement, not just Codex's restatement of
it); SHA-256 `a13986839a4fefc4439340d02d59d6c9d851b33182240645639adae9280ad446`; exactly one occurrence each of
`$electronicsLogicKmapValidator` and `validateKmapGroup`.

**Lint gate:** `make` remains absent from this native Windows Git Bash environment (unchanged from K02). Codex
applied the K02-established substitute proactively this time: `bun x biome check --write` against the 5
packet-listed source/test files, then a clean read-only re-check across 6 files including the E2E spec. Independently
re-run read-only: `bun x biome check <the same 6 files>` → `Checked 6 files in 40ms. No fixes applied.` — matches
Codex's reported final state exactly.

G-P0 remains **FAIL** for the pre-existing repository-wide blockers recorded above and is unaffected by K03. The
next approved task is K04.

## K04 Scoring/solution evidence (PM/Tester independent verification, 2026-08-13)

K04 is **PASS** on 2026-08-13 under the existing `Technical Prototype` classification, 3 calendar days ahead of
PLAN.md's own "Ngày 6" target for K-map correctness (sprint started Tuesday 11/08/2026; today is day 3). Codex
implemented K04 and reported completion with inline command output, recommending AT-06 as the closing test for gate
G-K0. Per AGENTS.md §13.6, this report is not accepted on Codex's word alone; every claim below — including the
AT-06/G-K0 recommendation itself — was independently re-derived and re-run by Claude Code (PM/Tester) natively on
Windows 11 via Git Bash, using the same K01-checkpoint diff methodology established at K02/K03.

**Algorithm, hand-verified against the locked KM-06/KM-07/KM-08 packet spec:** `core/kmap-grader.js` is a new, pure
CommonJS module implementing `gradeKmapResponse({expected, response, variableCount, maxScore})` with the SPEC.md §9
weights locked at `{cells: 0.3, groups: 0.4, sop: 0.3}`. Cell checks compare every K-map cell against the expected
truth vector (`'X'` always passes). Group checks reuse K03's `validateKmapGroup` verbatim — but called with the
*expected* answer's values rather than the learner's live grid, so a single call simultaneously re-validates
Gray-rectangle shape (including wraparound) and "group excludes any true-zero cell" against the author's key, not
the learner's own possibly-wrong entries. Coverage checks confirm every required minterm is covered by at least one
valid group (KM-06: catches missing/excess/wrong groups). SOP checks compare the learner's implicant/literal count
against `core.minimizeSop(expected)`'s cost and attach the canonical minimal expression as a `solution` field on the
`kmap-sop-minimal` check (KM-07); a learner grouping scores as fully equivalent-and-minimal whenever it covers the
same minterms with the same implicant/literal cost as the canonical answer, regardless of which specific cells were
grouped (KM-08 — an alternate valid grouping is not penalized). All 6 `kmap-grader.test.js` scenarios (golden
full-credit, don't-care handling, missing-group partial credit, invalid-group-touching-zero, all-zero edge case,
KM-08 alternate-grouping) were independently reproduced via direct `node -e` execution against the real
`boolean-core.js`/`kmap-grader.js` files, not just re-read as source — every score matched exactly (10, 9.8125,
5.8571, 3, 10, 10).

**Dispatch and DOM/UI integration, diffed in full against the K01 checkpoint:** `core/boolean-grader.js` gained a
`gradeKmap` function and a `'kmap'` dispatch branch; the diff is purely additive — `gradeTruthTable`/`gradeExpression`
are byte-identical to K01. `export/electronics-logic.js` gained `renderKmap`, `toggleKmapCell`, `createKmapGroup`,
`deleteKmapGroup`, `updateKmapGroupEmptyState`, `refreshKmapHighlights`, an extended `collectResponse` (kmap
`{cells, groups}` shape), and a kmap branch in `applyResult`. All three places that index K-map cells —
`renderKmap`'s `data-minterm-index` attribute, `createKmapGroup`'s minterm-indexed values array, and
`applyResult`'s `kmap-cell-{mintermIndex}` check lookup — correctly key off minterm index rather than DOM/Gray-code
column order, avoiding the ordering pitfall already documented for K02/K03. `getCore`/`getKmapValidator` are reused,
not duplicated; `createKmapGroup` calls `validateKmapGroup` with the *learner's* live values (authoring-time shape
validation, K03's concern) while `kmap-grader.js` calls the same function with the *expected* values (grading-time
correctness, K04's concern) — same function, two distinct call sites, zero duplicated logic.

**File scope, independently confirmed exact, including two investigated near-misses:** diffing the working tree
against the K01 checkpoint commit (`a867616f`) shows exactly the K04 packet's 7 listed files changed
(`core/kmap-grader.js` + test, `core/boolean-grader.js` + test, `export/electronics-logic.js` + test,
`export/electronics-logic-grader.test.js`) plus the one E2E spec the packet named. Two files initially looked like
possible scope violations and were independently investigated rather than waved through:

- `core/schema-lifecycle.test.js` diffs non-trivially against the stale K01 baseline and is *not* in K04's file
  list (the packet explicitly says K04 does not touch `schema-lifecycle.js`). Comparing
  `ls -la --time-style=full-iso` modification timestamps across every touched electronics-logic file shows this
  file clustered at 14:35 together with `schema-lifecycle.js` itself — both far earlier than the 21:26–21:32
  cluster of the actual K04 files. This is a stale-baseline artifact from K02, not K04 scope creep.
- `test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` contains a second Karnaugh test ("rejects an
  invalid Karnaugh selection before creating a valid group") beyond the one the K04 packet named for rewriting.
  Cross-referencing its content against SPEC.md's KM-04 definition ("nhóm chỉ có 1/2/4/8/16 ô và là rectangle
  trong không gian Gray") confirms it is the pre-existing K03 rejection test, and the K04 packet itself says not
  to touch it ("Không đổi test KM-04/KM-05 khác"). Not K04 scope.

The packet's named test was confirmed rewritten as instructed: "edits and grades Karnaugh cells and a minimal group
in preview" fills the packet's 3-variable fixture (`minterms=[1,3,7]`, `dontCare=5`) across 8 cells via
`data-minterm-index` locators, creates the single `{1,3,5,7}` group, and asserts `10 / 10` plus the canonical
solution text "Một lời giải tối giản: C." with `data-grade="passed"` on every cell and the group. Independently
re-derived via `node -e` against the real `vectorToKmapModel`/`validateKmapGroup`: this 3-variable layout is
`[[0,1,3,2],[4,5,7,6]]`, so `{1,3,5,7}` occupies the two middle columns of both rows — a solid, non-wrapping
rectangle, confirmed `valid:true`. This is a single-group, non-wrapping fixture: a full-pipeline smoke test, not a
wrap/overlap demonstration — see the AT-06 finding below for where that evidence actually lives. A shared
`addElectronicsLogicIdevice(page, projectUuid)` helper was extracted from this test's prior inline setup — in-scope
DRY refactor, not new production surface.

**Vitest, independently re-run, all green:** `npx vitest run public/files/perm/idevices/base/electronics-logic` →
**254/254 passed** across 9 files (~2.05s), including all 6 `kmap-grader.test.js` scenarios, the
`boolean-grader.test.js` kmap dispatch/contract tests, and 8 kmap-tagged `electronics-logic.test.js` DOM tests. The
wrong-cell/incomplete-coverage DOM scenario (expected score 5.6696, groupDimension 5/7 checks passing) was
independently re-derived via a standalone `node` script against the real grading path, not just re-read — exact
match.

**Playwright Chromium**, `test/e2e/playwright/specs/idevices/electronics-logic.spec.ts`: **3/3 passed in 23.1s**
against a freshly auto-started live dev server (real migrations, real DB, real WebSocket, real browser) — the
pre-existing truth-table spec, the rewritten K04 Karnaugh grading spec, and the pre-existing K03 invalid-group
rejection spec.

**Bundle rebuild, verified byte-for-byte via a genuinely fresh independent rebuild (not a re-check of Codex's own
output):** `electronics-logic-grader.bundle.js` was 22,739 bytes / SHA-256
`ef3795e11bc8bccf872a895268dce0e8b36d41eab72c6f9b32a84ec56e8017dc` before this PM touched anything — 2,568 bytes
larger than the 20,171-byte K03 checkpoint recorded above. Running `bun run bundle:resources` from a clean checkout
reproduced the identical 22,739 bytes and identical SHA-256 hash: deterministic and reproducible, not a coincidental
match against Codex's own claimed figures.

**Lint gate:** `make` remains absent from this native Windows Git Bash environment (unchanged from K02/K03).
Independently re-run read-only: `bun x biome check` against all 8 K04-touched files (7 packet files + the E2E spec)
→ `Checked 8 files in 46ms. No fixes applied.`

**Gate G-K0 / acceptance test AT-06:** SPEC.md defines AT-06 as "Karnaugh | Bài bốn biến có don't-care, overlap và
wrap chấm đúng" and PLAN.md gates G-K0 on the same condition ("Gate G-K0 bằng bài có wrap, overlap và don't-care").
This PM evaluated Codex's recommendation to close the gate rather than forwarding it unverified: the semantic
content of AT-06 (a 4-variable case with don't-care, overlapping groups, and a wraparound group, graded correctly)
is independently confirmed at three separate levels — pure-algorithm (`kmap-grader.test.js`), rebuilt-offline-bundle
(`electronics-logic-grader.test.js`), and full DOM integration (`export/electronics-logic.test.js`) — all using the
same golden fixture (`variables=[A,B,C,D]`, `minterms=[0,2,8,10,12,14]`, `dontCares=[4]`, groups `{0,2,8,10}` +
`{8,10,12,14}`, which overlap at cells 8 and 10, where `{0,2,8,10}` wraps both the left/right and top/bottom K-map
edges), scoring 10/10 with all 26 checks passing every time. The Playwright E2E kmap case itself uses the simpler
non-wrapping single-group 3-variable fixture confirmed above — a smoke test of the full browser pipeline, not a
wrap/overlap demonstration. AT-06's wrap+overlap+don't-care evidence lives in the unit/bundle/DOM layers verified
above, not in the E2E layer; that distinction matters so the E2E pass is not later mistaken for AT-06 proof. On
this basis, **G-K0 is recommended CLOSED** as of this verification.

G-P0 remains **FAIL** for the pre-existing repository-wide blockers recorded above and is unaffected by K04. With
K01–K04 and gate G-K0 now closed, the next task per PLAN.md's own Day 6 note ("K03, K04 và phần đầu E01") is E01
(netlist validation/topology); its stated prerequisites (C04, P04) were not re-verified as part of this K04 review
and should be confirmed before an E01 Task Packet is issued.

## C04/P04 dependency re-verification for E01 (PM/Tester, 2026-08-13)

**Why this entry exists:** the `.ai/packets/E01-netlist-validation-topology.md` packet (drafted this session) states
both E01 dependencies as "đã xong — PM/tester xác minh lại 2026-08-13, xem `repo-map.md`." That claim was written
against the broad "PM/Tester independent verification (2026-08-13, native Windows)" section above, which does cover
the whole electronics-logic iDevice (203/203 at the time) and separately calls out `schema-lifecycle.test.js` by
name — but neither C04 nor P04 has its own dedicated, task-scoped verification entry the way K02/K03/K04 do, and the
K04 section explicitly flagged both as unconfirmed for E01's purposes (previous paragraph). Per this project's own
evidence standard (AGENTS.md §13 rule 6 — no completion claim without command output), that gap needed closing with
fresh, isolated, task-scoped runs before E01 is handed to Codex, not just a pointer to an aggregate figure.

**C04 (Evaluator/truth vector, `PLAN.md` line 132, DoD "Đúng mọi tổ hợp 2–4 biến; deterministic"):** implemented as
`evaluate`/`evaluateNode`/`variableValue`/`createTruthVector` in
`core/boolean-core.js` (lines 353-443), covered by the `'Electronics Logic Boolean evaluator and truth vectors'`
describe block in `core/boolean-core.test.js` (lines 292-398), including a dedicated "evaluates every four-variable
combination" case. Isolated run:

```
npx vitest run public/files/perm/idevices/base/electronics-logic/core/boolean-core.test.js -t "evaluator and truth vectors"
```

→ **29 passed, 0 failed** (105 other-describe-block tests correctly filtered out by `-t`, not skipped due to a
failure).

**P04 (Schema/lifecycle skeleton, `PLAN.md` line 123):** `core/schema-lifecycle.js` +
`core/schema-lifecycle.test.js`. Isolated run:

```
npx vitest run public/files/perm/idevices/base/electronics-logic/core/schema-lifecycle.test.js
```

→ **22 passed, 0 failed** — up from the "15 tests" figure recorded in the native-Windows section above; the
difference is test-suite growth since that pass, not a regression (no test was removed or weakened).

**Fresh full-iDevice regression, superseding the stale 203/203 figure:**

```
npx vitest run public/files/perm/idevices/base/electronics-logic
```

→ **254 passed, 0 failed across 9 files** (up from 203/203 across 7 files — growth accounted for by
`schema-lifecycle.test.js` (15→22) plus files not individually re-counted since K04 closed).

**Conclusion:** both C04 and P04 are confirmed healthy on the current working tree, 2026-08-13, via fresh isolated
runs plus a passing full-iDevice regression — not merely inferred from the older aggregate figure. E01's stated
dependencies are satisfied; the E01 Task Packet is ready to hand to Codex. This does not change G-P0 (still
**FAIL**, unrelated blockers recorded above) — C04/P04 were never part of G-P0's blocking evidence, only of E01's
own prerequisite chain.

## BUGFIX-01 DB_PATH test isolation — writer evidence (2026-08-13)

**Authorship note:** this is the first packet in Solo Logic Alpha where Claude acted as **writer**, not only
PM/tester/verifier. The user explicitly narrowed the standing single-writer rule (AGENTS.md §13.4: "Codex là AI
writer duy nhất") for exactly two packets, `BUGFIX-01` and `BUGFIX-02`, after stating discomfort with Codex's
bug-fixing reliability ("tôi nghĩ codex sửa lỗi yếu hơn bạn"). Confirmed via AskUserQuestion before any file was
touched; scope is limited to these two packets — Codex remains the sole writer for the entire S/P/C/T/K/E/U/I/Q
backlog. `.ai/packets/BUGFIX-01-db-path-test-isolation.md` is the approved packet; this entry is its evidence log.

**Root cause, confirmed (not the speculative mechanism the packet was written against):** `bunfig.toml`'s
`[test].env` block only fills in environment variables that are not already set — it does not override a value an
auto-loaded `.env` file has already assigned. Since `.env` sets `DB_PATH=/mnt/data/exelearning.db` (correct
Docker/prod default), `bunfig.toml`'s `env = { DB_PATH = ":memory:", ... }` silently never took effect for
`DB_PATH` specifically. `ELYSIA_FILES_DIR` in the same `[test].env` block was never affected by this, because `.env`
defines `FILES_DIR` (a different variable, per AGENTS.md §8's resolution order), not `ELYSIA_FILES_DIR` — nothing
pre-empted it. This asymmetry (one variable in the same object silently ignored, the other honored) is why only
`DB_PATH`-dependent tests failed. Confirmed in a fully isolated scratchpad repro (outside the project, `.env` +
`bunfig.toml [test].env` only, no other project complexity): the spec printed `.env`'s value, not `bunfig.toml`'s.
Re-running the same isolated repro with `bunfig.toml` removed and a `.env.test` file (`DB_PATH=:memory:`) added
printed the correct `:memory:` value — both with and without explicitly exporting `NODE_ENV=test` first. This
matches Bun's own `.env` → `.env.local` → `.env.$NODE_ENV` → `.env.$NODE_ENV.local` precedence cascade (later files
win): `.env.test` is a first-class override point, `[test].env` in `bunfig.toml` is not, for variables `.env`
already sets.

**Durability, confirmed before editing:** `git ls-files .env.test .env .env.dist bunfig.toml` shows `.env.test`,
`.env.dist`, and `bunfig.toml` are all tracked; `.gitignore` excludes only `.env`, `/.env`, `/.env.local`,
`/.env.local.php`, `/.env.*.local` — none match `.env.test`. So `.env.test` is an intentionally shared, committed
file (it already carried `PORT`/`SESSION_STORAGE_PATH`/`TEMP_STORAGE_PATH` overrides for tests before this fix).
Editing it is a real, repo-wide, contributor- and CI-visible fix, not a local workaround.

**Fix applied (2 files, both within the packet's declared `FILE ĐƯỢC SỬA`):**
- `.env.test`: added `DB_PATH=:memory:` with a one-line comment on the precedence gotcha (why this file, not
  `bunfig.toml`, is the override point).
- `bunfig.toml`: removed the now-confirmed-ineffective `DB_PATH = ":memory:"` from `[test].env` (kept
  `ELYSIA_FILES_DIR`, which still needs it) and added a one-line comment pointing to `.env.test` for `DB_PATH`, so a
  future reader isn't misled by a config value that looks authoritative but silently isn't.
- `.env`/`.env.dist` untouched. `src/db/dialect.ts`'s `/mnt/` guard untouched. No `src/**` or `public/app/**` file
  touched — confirmed via the full lint/test scope below, which shows 0 files changed outside these two.

**Test evidence — Red (already on record in the packet, `.env` value observed as
`/mnt/data/exelearning.db` before any edit) → Green (this session, post-fix, native Windows Git Bash, no Docker):**
- `bun test src/routes/config.spec.ts -t "should return application settings"` (packet's exact Red-repro command):
  **1 pass, 0 fail** (930ms).
- `bun test src/routes/config.spec.ts src/routes/games.spec.ts`: **95 pass, 0 fail** (1.55s).
- `bun test src/routes/api/v1` (all 9 files): **158 pass, 0 fail** (6.78s). Note: `[activity-logger] Failed to log
  activity event ... SQLiteError: no such table: activity_log` appears in stdout for several of these tests — this
  is a pre-existing, gracefully-caught condition in specs whose DB fixture doesn't run the `activity_log` migration;
  it does not fail any test and is unrelated to `DB_PATH` (a wrong `DB_PATH` would fail at dialect-creation time via
  the `/mnt/` guard, not surface as a missing-table error inside an already-connected in-memory DB). Out of
  BUGFIX-01's scope; not touched.
- `bun test ./src ./test/helpers ./scripts ./app --coverage` (full required suite): **8012 pass, 0 fail, 113536
  expect() calls, 220 files, 117.56s.** Zero `/mnt/` or `DB_PATH` failures anywhere; exceeds the packet's
  acceptance floor (≥7869 pass) — the higher count reflects test suite growth since the 7830 baseline was recorded,
  not a discrepancy.
- Lint: `bun x biome check .env.test bunfig.toml` reports "No files were processed" — expected, not a failure:
  Biome's configured scope (`package.json`'s `lint:src`/`lint:test`/`lint:public` → `src/`, `test/`, `public/app/`)
  never includes `.env*` or `*.toml` files; TOML/dotenv syntax is outside what Biome parses. As a substitute
  sanity check, the full scope was re-run: `bun run lint:src` (448 files, exit 0), `bun run lint:test` (164 files,
  exit 0), `bun run lint:public` (1 file, exit 0) — only pre-existing warnings in files this fix never touched
  (`src/routes/export.ts:634`, a `noExplicitAny`; one test-helper optional-chain suggestion).

**G-P0 impact:** none. This bug was never one of G-P0's 3 recorded blocking-evidence items (coverage/Chromium/1ms
flake) — all official G-P0 evidence has always run in Docker, where `/mnt/` is valid and the guard never fires, so
this native-Windows-only test-isolation defect was silent there. Its purpose was cleaning up the PM/tester's own
native-Windows verification signal (used since K02), not unblocking the gate. G-P0 remains **FAIL**, now solely for
the 34-failure Chromium blocker (`BUGFIX-02`, not yet started).

**Scratchpad cleanup:** the isolated repro directory used to establish the mechanism above lived entirely outside
the project (session scratchpad), not in this repository; no project files require cleanup beyond the two edited
above.

## BUGFIX-02 Chromium E2E investigation — findings (2026-08-13)

**Authorship note:** covered by the same narrow writer exception recorded in BUGFIX-01's authorship note above
(AskUserQuestion-confirmed, scoped to exactly `BUGFIX-01`/`BUGFIX-02`; Codex remains sole writer for the S/P/C/T/K/E/U/I/Q
backlog). This packet is **investigation-only** per `.ai/packets/BUGFIX-02-chromium-e2e-investigation.md`
(`FILE ĐƯỢC SỬA: Không có`) — no product/source file was touched. This `repo-map.md` entry is the packet's sole
deliverable, exactly as instructed ("chỉ chạy lệnh, thu thập log, ghi nhận phát hiện vào repo-map.md").

**Mandate:** fully reproduce the 34 failing Chromium E2E tests behind the recorded 494 passed / 34 failed / 7
skipped baseline, cluster failures by root cause, and determine the root cause of at least the largest cluster
using direct reproduction evidence — not speculation. Any fix arising from a confirmed root cause was to be
proposed as a separate `BUGFIX-02b-...` follow-up, not applied here.

**Methodology:** stood up `bugfix02-e2e`, an `oven/bun:1.3-alpine` container with `/app` bind-mounted to the repo
and an isolated `node_modules` volume — the project's existing documented Docker E2E contract. Playwright's own
glibc-built Chromium download cannot run on Alpine's musl libc (~19 missing/ABI-incompatible shared libraries,
even after installing `gcompat`), so Alpine's native `apk add --no-cache chromium` package was used instead via a
diagnostic-only Playwright config (`launchOptions.executablePath: '/usr/bin/chromium'`), copied verbatim from the
tracked `playwright.config.ts` with no other behavioral change. This diagnostic config and all other artifacts
existed only inside the container/host scratch paths — never committed (see cleanup below).

**Cluster 1 — test discovery collapse (root-caused, container-level fix, direct evidence):**
- Symptom: `bun x playwright test --project=chromium` (and `--list`) reported "Total: 0 tests in 0 files", with six
  opaque `ResolveMessage {}` errors and no further detail — before any test could run.
- Root cause, confirmed by direct reproduction: `bun x` honors the Playwright CLI's `#!/usr/bin/env node` shebang
  and delegates to whatever `node` resolves first on `PATH`. `oven/bun:1.3-alpine` ships no real Node.js — only a
  compatibility shim at `/usr/local/bun-node-fallback-bin/node` that impersonates Node for shebang purposes but is
  not genuine Node (confirmed: it errors on bare invocation, "Bun's provided 'node' cli wrapper does not support a
  repl"). Every spec file transitively imports the `src/shared/export/index.ts` barrel, which eagerly evaluates
  `ServerMermaidPreRenderer.ts`'s `import { JSDOM } from 'jsdom'`. jsdom 30 (this repo's tracked version — `bun.lock`
  shows 29.1.1→30.0.1 via #2220, 2026-08-03) depends on undici 8, which requires real Node ≥22.19 for
  `worker_threads.markAsUncloneable`. This exact requirement is already known and documented in this repo, verbatim,
  in `.github/workflows/e2e-db-matrix.yml`'s header comment and its explicit `Setup Node.js` step (`node-version:
  '22'`): "a jsdom major raised the Node requirement and broke all three databases on main." Under Bun's shim this
  load fails silently enough to surface only as Playwright's opaque discovery-collapse signature, not as a jsdom or
  undici error.
- Fix (container-only, not a repo change): `apk add --no-cache nodejs` → real Node 22.23.2 at `/usr/bin/node`,
  resolving ahead of Bun's shim on `PATH`. Confirmed: `bun x playwright test --list --project=chromium` went from 0
  tests/0 files to **537 tests in 91 files**, zero `ResolveMessage` errors.
- This closes a real gap: the Node-version-floor mechanism was already documented for the `e2e-db-matrix.yml` CI
  workflow, but not for ad hoc/local Docker reproduction of the plain Chromium E2E suite, which is what this
  investigation was chartered to do.

**Cluster 2 — concurrency/timeout-driven mass failure (root-caused, direct A/B + serial-sample evidence):**
- After fixing Cluster 1, a full `--project=chromium` run at the config's default worker count (4, from
  `Math.min(4, Math.max(1, Math.floor(os.cpus().length * 0.8)))` against this container's 20 reported CPU cores —
  confirmed via `nproc`, matching the "Running 537 tests using 4 workers" log line) produced **207 passed / 323
  failed / 7 skipped** (537 total) — roughly an order of magnitude more failures than the 34-failure baseline this
  packet was chartered to reproduce, spread broadly across 30+ unrelated spec files rather than clustering in
  "asset/file manager/theme/media" flows the way the original baseline did.
- Categorized all 950 distinct failure error messages from this run: excluding the 14 that mention neither
  "timeout" nor "has been closed" (scattered one-to-four-deep across 10 unrelated files — `toBeVisible`/`toBe`
  assertion failures, one strict-mode-violation locator, no thematic pattern connecting them), the remaining 936
  (98.5%) reference a 45000ms/90000ms test timeout, a cascading "Target page, context or browser has been closed"
  teardown message (Playwright's effect when a sibling test's timeout tears down a shared resource mid-await), or
  both. This is one dominant cluster, not several.
- Direct A/B evidence for the mechanism: the representative test `should upload file to folder`
  (`file-manager.spec.ts:552`) took **15.9s** run alone (`--workers=1`) versus **42.2s** inside the full 4-worker
  concurrent run — a 2.65x slowdown, comfortably enough to push otherwise-healthy tests over the fixed 45s timeout
  when many tests compete for the same CPU/IO/browser-launch resources at once.
- Independent confirmation via serial-sample reversal: re-running the 3 most-failing spec files from the
  concurrent run (`file-manager-special-chars.spec.ts`, `anchor-links.spec.ts`, `latex-rendering.spec.ts`; 60 tests
  total, same container, same code, `--workers=1`) produced **59 passed, 0 failed, 1 skipped** — the failures do not
  reproduce once concurrency is removed, confirming contention artifacts rather than logic defects. (The 1 skip's
  exact identity/reason was not isolated within budget; since 0 of the other 59 regressed and no spec file was
  touched by this investigation, it is presumed a pre-existing, unrelated `test.skip()`.)
- Contributing structural risk factor, not separately isolated as its own variable: this host's container runs with
  Docker's unmitigated 64MB `/dev/shm` default (confirmed: `df -h /dev/shm` → 64.0M; `docker inspect --format
  '{{.HostConfig.ShmSize}}'` → 67108864 bytes) and no memory cgroup cap — a documented general source of Chromium
  instability/slowness under parallel load in Docker, plausibly compounding the CPU-contention effect measured
  above. No dedicated shm-size or worker-count sweep was run to separate the two within budget.

**What this investigation did NOT establish — stated plainly, per the packet's evidence requirements:** the
original, specific 494/34/7 baseline (34 failures, narrow "asset/file manager/theme/media flows" cluster) was
**not reproduced, and its root cause was not determined.** This reconstruction's own dominant failure mode (323
failures, broad indiscriminate distribution, driven by resource contention under 4-worker concurrency) is
categorically different in both scale and pattern from the original baseline — it is not currently usable as a
faithful stand-in for whatever environment produced that original evidence. This document already records (G-P0
section, above) that the original Docker methodology was never precisely captured; consistent with the packet's
`KHÔNG LÀM` on arbitrarily rebuilding that methodology, no attempt was made to reverse-engineer it — this
investigation instead used the project's standard, documented `oven/bun:*` + Playwright contract, which is
demonstrably not equivalent to whatever produced 494/34/7. Whether the original 34 are a subset of what a
lower-contention rerun of this same environment would show is unknown: only a 60-test sample was run serially, not
the full 537-test suite, and no intermediate worker count (e.g. 2) was tried.

**Recommendation:**
1. A narrow `BUGFIX-02b` follow-up is warranted to document the Node.js requirement for local/Docker Chromium E2E
   reproduction (the `oven/bun:*` image's Node shim cannot load jsdom≥30, transitively pulled in by every spec
   file) — mirroring what `.github/workflows/e2e-db-matrix.yml` already does for its CI matrix. This is a real,
   reproducible, low-risk gap, independent of the unresolved 34-failure question.
2. G-P0's Chromium blocker re-verification should rely on real CI evidence (`.github/workflows/e2e.yml`, which runs
   directly on bare `ubuntu-latest` GitHub-hosted runners — no Docker layer, the runner's preinstalled Node — and is
   architecturally distinct from, and not subject to, either issue found here) rather than further local Docker
   attempts on this host, which has now demonstrated resource-contention behavior (this investigation's 323-failure
   run) inconsistent with usable evidence quality.
3. **G-P0 remains FAIL.** The 34-failure Chromium blocker is neither newly confirmed nor newly resolved by this
   investigation; it is exactly as open as before BUGFIX-02 started.

**Time used:** approximately 3h07m elapsed (session start ~2026-08-13 17:21 UTC, this entry written ~2026-08-13
20:28 UTC) against the packet's 6-hour hard budget — completed within budget, not cut short by the time limit.

**Scratchpad cleanup:** diagnostic artifacts (`/app/playwright.docker-repro.config.ts`, `/app/.bugfix02-minimal/`,
`/app/test-results/`) existed only inside the `bugfix02-e2e` container / host bind-mount scratch paths, never
staged or committed; all deleted before this entry was written. `git status --short` confirms no repository file
was modified by this investigation beyond this entry (all pre-existing `M`/`??` entries predate BUGFIX-02 and
belong to unrelated prior work). Container `bugfix02-e2e` stopped and removed after this entry was recorded.

## E01 Netlist validation/topology evidence (PM/Tester independent verification, 2026-08-14)

**Author/role note:** written by the PM/tester (Claude Code), not Codex. Codex is the sole writer for this task per
the standing mandate (AGENTS.md §13); this entry independently reproduces Codex's completion report rather than
recording it verbatim, per the rule against accepting a verbal claim of completion without evidence.

**Scope check.** `git status --porcelain` at verification time shows the entire `electronics-logic/` iDevice tree as
one untracked block (new iDevice, not yet committed at any point in this engagement), so per-file `git diff` cannot
distinguish "new for E01" from "pre-existing from K/C/P work" inside that tree. Cross-referenced by filesystem mtime
instead: `core/circuit-netlist.js` and `core/circuit-netlist.test.js` are timestamped 2026-08-14 08:19–08:21, while
every other file under `electronics-logic/` (including `core/fixtures/boolean-syntax-v1.json` and
`core/boolean-grader-browser.mjs`, the only other non-`.js`-pair files under `core/`) predates that window. The
packet itself, `.ai/packets/E01-netlist-validation-topology.md`, is unchanged since it was drafted (2026-08-13
22:38) — Codex read it but did not edit it. **Conclusion: E01's touched-file set is exactly the two files the
packet's `FILE ĐƯỢC SỬA` allowed**, nothing more.

**Separately, not part of E01:** the same `git status` sweep shows `.env.test` and `bunfig.toml` as modified
(mtimes 2026-08-13 23:15, i.e. ~36 minutes after the E01 packet was drafted but **over 8 hours before** Codex's
E01 files were written). The diff is a real fix to Bun's env-precedence order for `DB_PATH` in tests (`.env.test`
now sets `DB_PATH=:memory:` directly, with a comment explaining `bunfig.toml`'s `[test].env` block can't override
a value `.env` already set). This is unrelated to the Circuit domain, outside E01's file scope, and chronologically
can't be Codex's E01 work. Flagged to the user for awareness; not scored against E01, not folded into the findings
below.

**Source cross-check (`circuit-netlist.js`, read in full against the packet's locked design).** `GATE_PINS` matches
the packet's table exactly (INPUT/OUTPUT/NOT/AND/OR/XOR only, no NAND/NOR/XNOR), deep-frozen. `parseNetlist`
performs Tier-1 shape validation (plain-object, `schemaVersion`, array shape, per-node `id`/`kind`/finite `x`/`y`/
no duplicate ids, per-wire `id`/`from`/`to` endpoint shape/no duplicate ids) and throws `TypeError` with a
Vietnamese message on any failure, otherwise returns a `JSON.parse(JSON.stringify(raw))` clone exactly as the
packet's implementation note prescribed (no separate `serializeNetlist`). `topologicalSort` is Kahn's algorithm,
correctly skipping wires that reference nonexistent nodes rather than crashing; on failure it delegates to
`findCycleNodes`, which uses Tarjan's SCC — a different algorithm than the packet's suggested approach, which the
packet explicitly permits as long as the two return shapes are correct. Read closely: this SCC approach is more
correct than a naive "leftover nodes after Kahn's" cycle report would be, because it excludes nodes that are
downstream of a cycle but not themselves part of it. `validateTopology` accumulates all 6 error codes in one pass
(never throws, never stops at the first error), and specifically excludes wrongly-directed wires from the
dangling/multiple-source source count (checked at the `wireDirectionMismatch` branch, which `continue`s before
incrementing the `incoming` map) — matching ACCEPTANCE 7. Export is `Object.freeze({...})`, CommonJS, zero
`require()` of other `core/*.js` files, no `globalThis` assignment, no DOM/`eval`/`Function` anywhere in the file.

**Test cross-check (`circuit-netlist.test.js`, read in full against the packet's 11 ACCEPTANCE criteria).** All 11
are exercised: round-trip clone semantics (deep-clone, not same reference, stable re-parse), an `it.each` sweep of
11 malformed-input cases each asserting both `TypeError` and a Vietnamese message pattern, valid-circuit →
`{valid:true, errors:[]}`, the exact SPEC.md §7 example asserted via exact `toEqual` (not `toContainEqual`) to
produce precisely one `danglingInputPin` on `xor-1.b`, `unknownNodeReference` (deleted-node wire, explicitly
asserted not to throw), `unknownPin` (existing node, bad pin name), `wireDirectionMismatch`, `multipleSources`,
`combinationalLoop` via a self-loop (both `topologicalSort` and `validateTopology` asserted), a valid-order property
check for acyclic topological sort (every wire's source precedes its target, without over-constraining to one exact
valid order), a multi-error accumulation case, and the frozen/no-DOM/no-eval/no-Core-`require` module contract. One
standout: a dedicated test, `excludes downstream acyclic nodes from the reported cycle`, builds a self-loop plus an
extra downstream `OUTPUT` node and asserts the reported cycle is `['not-1']` only — directly confirming the
SCC-over-naive-Kahn's correctness point above. No `.skip`/`.todo`.

**Independently reproduced (all commands run fresh by the PM/tester, not copy-pasted from Codex's report):**

```
npx vitest run public/files/perm/idevices/base/electronics-logic/core/circuit-netlist.test.js
  → Test Files 1 passed (1); Tests 24 passed (24)

npx vitest run public/files/perm/idevices/base/electronics-logic/core
  → Test Files 7 passed (7); Tests 230 passed (230)

npx vitest run public/files/perm/idevices/base/electronics-logic
  → Test Files 10 passed (10); Tests 278 passed (278); exit code 0
```

All three counts match Codex's completion report exactly.

**Coverage.** `vitest.config.mts`'s `coverage.include` is `['public/app/**/*.js']` only (confirmed by reading the
config) — `public/files/perm/**` is outside that glob regardless of the `exclude` list, so a default `--coverage`
run reports 0% for this file, as Codex's report described. Reproduced with a CLI-level `--coverage.include`
override scoped to `circuit-netlist.js` (report directory redirected to the session scratchpad after the default
`./coverage/vitest` path hit a pre-existing Windows file lock, `EPERM` on `lcov.info` — unrelated to E01):

```
% Stmts 97.69 | % Branch 92.92 | % Funcs 100 | % Lines 100
```

Matches Codex's reported numbers exactly, clearing the ≥90% patch-coverage gate (AGENTS.md §5.3) on every measured
axis. Inspected the uncovered branches directly in `lcov.info` (`BRDA` records with a `0` hit count): source lines
24, 94, 99, 160, 165, 169, 172 — e.g. the `prototype === null` arm of `isPlainObject`, and the case where a wire's
`from` **and** `to` are simultaneously unknown in the same iteration. All are defensive sub-clauses inside
already-tested, already-100%-line/function-covered logic, not missing behavior.

**Lint.** `bunx @biomejs/biome check` on both new files: `Checked 2 files in 21ms. No fixes applied.` — clean.
(Note for future verification passes: bare `npx biome` resolves to an unrelated, unscoped, deprecated npm package,
not this project's `@biomejs/biome ^2.4.5` — always invoke via `bunx @biomejs/biome` or `bun run lint:*`.)

**`KHÔNG LÀM` sweep.** No `NAND`/`NOR`/`XNOR` anywhere in either new file. No `globalThis` anywhere in either new
file. No new fixture files added under `core/fixtures/` (the one JSON fixture there predates E01). No other
`core/`, `edition/`, or `export/` file touched.

**Verdict:** E01's completion claim holds up under independent reproduction — file scope, source design, test
coverage of all 11 acceptance criteria, exact pass counts, coverage percentages, lint cleanliness, and `KHÔNG LÀM`
compliance all independently confirmed, not just re-stated from Codex's report. This entry does not evaluate or
change G-P0 (still FAIL, per the BUGFIX-02 entry above, for unrelated Chromium E2E reasons) or any other gate.

## E02 Engine 0/1/X evidence (PM/Tester independent verification, 2026-08-14)

**Author/role note:** written by the PM/tester (Claude Code), not Codex, for the same standing-mandate reason as
the E01 entry above — independently reproduced, not a transcription of Codex's completion report.

**Scope check.** Same limitation as E01: the whole `electronics-logic/` tree is one untracked `git status` block, so
`git diff` can't isolate E02's files by itself. Cross-checked two ways instead. (1) `find
public/files/perm/idevices/base/electronics-logic -type f -newermt "2026-08-14 09:00:00"` (09:00 is after E01's
files were written, before Codex started E02) returns exactly two paths: `core/circuit-engine.js` and
`core/circuit-engine.test.js`. Nothing under `edition/`, `export/`, `fixtures/`, or `config.xml` is newer than that
cutoff. (2) `sha256sum core/circuit-netlist.js` → `2f78cb5216d4d15a659594b9b67a4d6a8231ba7498425cb9e893328cc5b2c138`,
an exact match (case-insensitive) to both Codex's reported hash and the file's own mtime (still 2026-08-14 08:19,
unchanged since the E01 entry above). **Conclusion: E02 touched exactly the two files the packet's `FILE ĐƯỢC SỬA`
allowed, and did not modify E01's frozen `circuit-netlist.js`.**

**Source cross-check (`circuit-engine.js`, 83 lines, read in full against the packet's locked design).**
`SIGNAL_VALUES = Object.freeze(['0','1','X'])` and `COMPUTATIONAL_GATES = Object.freeze(['NOT','AND','OR','XOR'])`
match the packet exactly. `evaluateGate` rejects any `kind` outside `COMPUTATIONAL_GATES` (covers `INPUT`/`OUTPUT`)
and rejects malformed `inputValues` (wrong length or any value outside `SIGNAL_VALUES`) before touching the truth
tables. Hand-checked every branch against the packet's locked tables: `NOT` (`X→X`, `0→1`, `1→0`); `AND` dominant-0
(`includes('0') → '0'`, else `includes('X') → 'X'`, else `'1'`); `OR` dominant-1 (mirror image); `XOR` no dominant
value (`includes('X') → 'X'` unconditionally, else plain inequality check) — all four match the packet's tables with
no transcription errors. `propagate` calls `topologicalSort(model)` first and returns the locked
`{ok:false, error:{code:'combinationalLoop', path, message}}` shape *before* touching `sortResult.order`, avoiding
the "order is not iterable on failure" trap that `topologicalSort`'s `{ok:false, cycle}` shape (no `order` key)
would otherwise cause. For each node in topological order: `INPUT` resolves via `resolveInputValue` (absent
assignment key defaults to `'X'`, present-but-invalid value throws `TypeError`); other nodes look up each input pin's
source value via a `node\0pin → wire.from` map, **write that source value into `values` under the consuming node's
own pin key too** (so both endpoints of a wire appear in the output, satisfying ACCEPTANCE 10's "every pin of every
node"), then call `evaluateGate` only if the node kind has an output pin (`OUTPUT` is correctly skipped — it has no
`outputs`, so its `a` pin value is recorded but nothing is computed from it). Exports a frozen object of exactly
`{SIGNAL_VALUES, evaluateGate, propagate}`. Only `require('./circuit-netlist.js')`; no reference to `boolean-core`,
`kmap-`, `schema-lifecycle`, `document`, `window`, `electron`, `eval`, or `Function` anywhere in the file.

**Debugging-narrative claim verified against source, not taken on faith.** Codex's report attributes a mid-TDD RED
cycle to "Boolean Core khóa biến A–D viết hoa" (Boolean Core locks variables to uppercase A–D). Checked directly in
`boolean-core.js`: the tokenizer's variable-character branch is `if (/^[A-D]$/.test(character))` (line 93, uppercase
only), and a separate branch a few lines later, `if (/^[A-Za-z]$/.test(character))`, exists specifically to `throw
createSyntaxError('INVALID_VARIABLE', ...)` for anything alphabetic that isn't uppercase A–D (line 127) — so
`"a AND b"` deterministically throws `BooleanSyntaxError` while `"A AND B"` parses. The claimed root cause is real,
not a plausible-sounding fabrication.

**Test cross-check (`circuit-engine.test.js`, 200 lines, 35 `it`/`it.each` cases, read in full against the packet's
12 ACCEPTANCE criteria).** All 12 are covered, plus two extra defensive `evaluateGate` validation cases (invalid
signal value, wrong input count) that are in-scope superset coverage, not scope creep: module purity (frozen
exports, frozen `SIGNAL_VALUES`, source-text assertions for the `require` allowlist and DOM/`eval` absence) → 12;
`NOT` 3-case table → 1; `AND`/`OR` full 9-combination sweep via a shared `BINARY_INPUTS` fixture → 2; `XOR` full
9-combination sweep, same fixture → 3; 14-case cross-check against `booleanCore.evaluate()` on the 0/1-only subset,
built from `BOOLEAN_CORE_CASES` (2 `NOT` + 4 combinations × 3 gates) → 4; `INPUT`/`OUTPUT` rejection → 5;
full-circuit propagation for all 4 XOR input combinations → 6; missing-input-defaults-to-`'X'`-and-propagates (plus
an unrelated assignment key silently ignored) → 7; loop circuit returns the structured error, doesn't throw → 8;
invalid assignment value (numeric, unsupported string) throws with the exact Vietnamese message → 9; every pin of
every node present, count-checked against `GATE_PINS` → 10; two `propagate` calls on the same input deep-equal → 11.
Hand-verified the two 9-combination truth-table fixtures cell-by-cell against the packet's locked tables (AND:
`['0','0','0','0','1','X','0','X','X']`; OR: `['0','1','X','1','1','1','X','1','X']`; XOR:
`['0','1','X','1','0','X','X','X','X']`, for input order `00,01,0X,10,11,1X,X0,X1,XX`) — no mismatches. No
`.skip`/`.todo`. Test-count arithmetic (1+3+2+1+14+2+2+4+1+1+1+2+1 = 35) matches the file's own reported total.

**Independently reproduced (all commands run fresh by the PM/tester):**

```
npx vitest run public/files/perm/idevices/base/electronics-logic/core/circuit-engine.test.js
  → Test Files 1 passed (1); Tests 35 passed (35)

npx vitest run public/files/perm/idevices/base/electronics-logic/core
  → Test Files 8 passed (8); Tests 265 passed (265)

npx vitest run public/files/perm/idevices/base/electronics-logic
  → Test Files 11 passed (11); Tests 313 passed (313)
```

All three counts match Codex's completion report exactly. `313 - 278` (the E01-entry baseline above) `= 35`, i.e.
E02 added tests and changed nothing else — no regression in any of the other 9 pre-existing spec files in the tree.

**Coverage**, same CLI-override technique as E01 (default `coverage.include` in `vitest.config.mts` excludes
`public/files/perm/**`; reports redirected to the session scratchpad to avoid the same pre-existing Windows
`lcov.info` file lock noted in the E01 entry):

```
% Stmts 100 | % Branch 100 | % Funcs 100 | % Lines 100
```

Matches Codex's reported numbers exactly — full coverage, no uncovered branches to inspect this time (unlike E01,
which had a handful of defensive-only gaps).

**Lint.** `bunx @biomejs/biome check` on both new files: `Checked 2 files in 23ms. No fixes applied.` — clean,
reproduced exactly.

**`KHÔNG LÀM` sweep.** No `NAND`/`NOR`/`XNOR` anywhere. No DOM/UI code, no `globalThis` assignment. `core/
circuit-netlist.js` unchanged (hash-verified above). No new file under `core/fixtures/`. The `find -newermt` sweep
above already confirms `edition/`, `export/`, and `translations/` were untouched.

**Gate claim check.** Codex's report states G-E0 remains PENDING and explicitly does not claim AT-07 (needs E04's
half-adder) or the testbench-pipeline half of AT-08 (needs E03). Consistent with `PLAN.md`'s actual gate placement
(G-E0 sits after E04, requiring E01+E02+E03+E04 together) — not an overclaim.

**Verdict:** E02's completion claim holds up under independent reproduction — file scope (including E01's
`circuit-netlist.js` staying byte-identical), source design fidelity to all locked truth tables and the `propagate`
contract, a specific debugging root-cause claim verified against `boolean-core.js` source rather than taken on
faith, test coverage of all 12 acceptance criteria, exact pass counts (35 / 265 / 313), 100% coverage, lint
cleanliness, `KHÔNG LÀM` compliance, and gate-status honesty all independently confirmed. Does not evaluate or
change G-P0 or G-E0 themselves (G-E0 correctly still PENDING pending E03+E04).

## E03 Testbench/grading evidence (PM/Tester independent verification, 2026-08-14)

**Author/role note:** written by the PM/tester (Claude Code), not Codex, for the same standing-mandate reason as
the E01/E02 entries above — independently reproduced, not a transcription of Codex's completion report.

**Scope check.** Same limitation as E01/E02: the whole `electronics-logic/` tree is one untracked `git status`
block. Exact mtimes resolve the timeline cleanly: `circuit-netlist.js` (E01) 08:19, `circuit-engine.js`/
`circuit-engine.test.js` (E02) 14:00–14:01, `circuit-grader.js`/`circuit-grader.test.js` (E03) 16:59–17:01, all
2026-08-14. `find public/files/perm/idevices/base/electronics-logic -type f -newermt "2026-08-14 15:00:00"` (a
cutoff strictly after E02 finished) returns exactly those two E03 files across the **entire** iDevice tree — nothing
under `edition/`, `export/`, `fixtures/`, or `config.xml` changed. Independent SHA-256 of the five files the packet
locked as untouchable — `circuit-netlist.js`, `circuit-engine.js`, `boolean-core.js`, `boolean-grader.js`,
`schema-lifecycle.js` — matches Codex's reported hashes exactly (case-insensitive), and `circuit-netlist.js`'s hash
additionally matches the value independently recorded in the E01/E02 entries above. Full-repo `git status
--porcelain` shows the same pre-existing `M`/`??` set recorded since the K04 entry (the unrelated 16-file
Windows-compat pass, `.env.test`/`bunfig.toml`) plus `electronics-logic/`/`.ai/` as untracked blocks — nothing new.
**Conclusion: E03 touched exactly the two files the packet's `FILE ĐƯỢC SỬA` allowed**, and left E01/E02's frozen
files byte-identical.

**Source cross-check (`circuit-grader.js`, 144 lines, read in full against the packet's locked 8-step algorithm).**
Every step matches verbatim: (1) `isValidTestbench` throws `TypeError('Testbench không hợp lệ.')` — variables
1–4 elements matching `/^[A-D]$/` with no duplicates, `hasExactKeys` enforcing `inputs`/`expected` key sets exactly
equal to `variables`/`outputs`; (2) `maxScore` validated with the exact `boolean-grader.js`-precedent three-condition
check, throwing `TypeError('Điểm tối đa không hợp lệ.')`; (3) `parseNetlist` wrapped in a `try/catch` scoped to that
one call, catching only `TypeError` and re-throwing anything else, converting to the graceful
`structure-invalid-netlist` check on the expected type; (4) `validateTopology` failure maps every
`topology.errors[]` entry to a `structure-${code}` check, no throw; (5) input/output node-id set comparison via a
`sameSet` helper against `Object.values(testbench.inputs/outputs)`, graceful `structure-input-mapping`/
`structure-output-mapping` on mismatch — confirmed this runs **after** topology validation and **before** building
truth vectors, matching the packet's locked ordering; (6) `createTruthVector(testbench.expected[name],
testbench.variables)` per output, deliberately uncaught (author-configuration errors from Boolean Core propagate
naturally); (7) the combination loop builds `bits = index.toString(2).padStart(n,'0')`, maps `variables[k] →
inputs[variables[k]] = bits[k]`, calls `propagate()` with **no** defensive `if (!result.ok)` branch (relying on the
E01/E02-proven invariant that a topology already confirmed valid cannot make `propagate`'s internal
`topologicalSort` fail), reads `result.values['<outputNodeId>.a']`, builds
`case-${bits}-${name.toLowerCase()}` check ids; (8) `Number(((passed/checks.length)*maxScore).toFixed(4))`, the
exact `boolean-grader.js`/`kmap-grader.js` rounding precedent. Module exports frozen `{gradeCircuitResponse}`,
`require()`s exactly `boolean-core.js`+`circuit-engine.js`+`circuit-netlist.js`, no `kmap-`/`schema-lifecycle`
import, no DOM/`eval`/`Function` anywhere in the file.

**Packet-prose contradiction, confirmed real and corrected (not a Codex deviation).** Codex flagged that
`ACCEPTANCE` item 2's worked example (`case-01-p: expected:'0', actual:'1'`) is arithmetically reversed. Independently
re-derived by hand before checking either the implementation or Codex's test: testbench declares the (deliberately
wrong) expression `A OR B` while the real circuit is `AND`; at row `index=1` (`A=0,B=1`), `OR(0,1)=1` (this is
`expected`, since `expected` is defined as the testbench author's declared — here wrong — truth vector) and the real
`AND(0,1)=0` (this is `actual`, from `propagate()` on the real circuit) — so the correct pair is
`expected:'1', actual:'0'`, the reverse of what the packet's prose said. This was re-confirmed a second, fully
independent way: a standalone Node script written by the PM/tester, calling `gradeCircuitResponse` directly with no
reuse of Codex's test file or fixtures, reproduced `{id:'case-01-p', passed:false, expected:'1', actual:'0'}`
byte-for-byte. The packet's **locked algorithm steps, error-classification table, and check-id formula were all
unambiguous and correct**; only the illustrative prose example inside `ACCEPTANCE` item 2 had `expected`/`actual`
swapped — a drafting mistake by this PM/tester when writing the packet, not a design flaw. Both the implementation
and the test file correctly follow the locked algorithm rather than the flawed illustration; this is the intended
result of the `systematic-debugging` skill activation the task instructions specified for exactly this situation.
`.ai/packets/E03-testbench-grading.md`'s `ACCEPTANCE` item 2 has been corrected in place to match the verified real
behavior.

**Test cross-check (`circuit-grader.test.js`, 362 lines, 29 cases, read in full against the packet's 13 ACCEPTANCE
criteria).** All 13 covered: module contract (frozen exports, exact dependency allowlist, no DOM/`eval`) → 1; full
4/4 AND-circuit pass with exact check ids → 2; wrong-expression partial credit with corrected expected/actual → 3;
one-variable circuit (2 checks, no hard-coded row count) → 4; two-output circuit (8 checks covering both output
groups per combination, exact id ordering) → 5; SPEC §7 byte-for-byte `case-11-carry` id → 6; determinism (two calls
deep-equal) → 7; Boolean Core rejecting invalid/undeclared-variable expressions (`it.each`, both left uncaught) → 8;
malformed netlist JSON graceful `structure-invalid-netlist` → 9; topology errors graceful, two distinct codes
(`danglingInputPin`, `combinationalLoop`) with exact `path` values → 10; input-mapping mismatch graceful, two
sub-cases (omitted INPUT, wrong-kind node) → 11; output-mapping mismatch graceful, same two sub-cases → 12; invalid
testbench shape throwing, 8 sub-cases (`it.each`) → 13; invalid `maxScore`, 4 sub-cases → 13; explicit ordering test
confirming testbench-shape validation runs before netlist parsing. No `.skip`/`.todo`.

**Independent black-box re-verification, bypassing Codex's test file entirely.** A standalone script (session
scratchpad, not the project tree) required `circuit-grader.js` directly and called it fresh for ACCEPTANCE 1, 2, 5,
9, 10, 11, 12, plus an extra undeclared-variable case — guarding against the classic TDD pitfall where implementation
and test share the same wrong assumption. Every result matched the test file's assertions exactly, including the
Vietnamese `TypeError` messages and the natural (uncaught) `"Boolean variable order is missing expression variable
C."` propagation from `boolean-core.js` for an expression referencing an undeclared variable.

**Independently reproduced (all commands run fresh by the PM/tester):**

```
npx vitest run public/files/perm/idevices/base/electronics-logic/core/circuit-grader.test.js
  → Test Files 1 passed (1); Tests 29 passed (29)

npx vitest run public/files/perm/idevices/base/electronics-logic/core
  → Test Files 9 passed (9); Tests 294 passed (294)

npx vitest run public/files/perm/idevices/base/electronics-logic
  → Test Files 12 passed (12); Tests 342 passed (342)
```

All three counts match Codex's completion report exactly. `342 - 313` (the E02-entry baseline above) `= 29`, i.e.
E03 added tests and changed nothing else — no regression in any of the other 10 pre-existing spec files in the tree.

**Coverage**, same CLI-override technique as E01/E02 (default `coverage.include` in `vitest.config.mts` excludes
`public/files/perm/**`; report directory redirected to the session scratchpad to avoid the same pre-existing Windows
`lcov.info` file lock noted in the E01 entry):

```
% Stmts 97.36 | % Branch 94.23 | % Funcs 100 | % Lines 100 — uncovered lines 10, 33, 80
```

Matches Codex's reported numbers exactly, clearing NFR-05's ≥90% branch gate. Inspected the three uncovered lines:
line 10 is `isPlainObject`'s `prototype === null` arm (an `Object.create(null)` testbench, not exercised); line 33
is the "an `inputs` value is present but not a non-empty string" branch (right key set, wrong value type — not
separately exercised); line 80 is the `parseNetlist` catch's `!(error instanceof TypeError)` re-throw arm, the same
defensive-precedent pattern as `boolean-grader.js`'s `gradeExpression` catch (see E03 packet, "Bối cảnh đã xác
minh"). All three are defensive sub-clauses inside already-100%-line/function-covered logic, consistent with the
E01 entry's equivalent finding — not missing behavior.

**Lint.** `bunx @biomejs/biome check` on both new files: `Checked 2 files in 33ms. No fixes applied.` — clean,
reproduced exactly (Codex reported 16ms; timing differs naturally, not a concern).

**`KHÔNG LÀM` sweep.** No edits to `boolean-grader.js`, `schema-lifecycle.js`, `edition/electronics-logic.js`,
`export/electronics-logic*.js`, `circuit-netlist.js`, or `circuit-engine.js` (hash-verified above). No
half-adder-named fixture or file added under either `core/fixtures/` or `electronics-logic/fixtures/` — both
directories' contents independently listed and confirmed unchanged (every file dated 2026-08-12, before this
session). No NAND/NOR/XNOR, no UI/canvas, no `translations/**` change, no bundle rebuild.

**Gate claim check.** Codex's report states G-E0 remains PENDING, explicitly does not claim AT-07 (needs E04's
half-adder fixture), and explicitly states `circuit-grader.js` is not yet called from `boolean-grader.js` as a
deliberate scope decision. Consistent with `PLAN.md`'s actual gate placement (G-E0 requires E01+E02+E03+E04
together) — not an overclaim. Codex did not begin E04 in the same turn, consistent with the standing "stop at the
nearest gate" rule.

**Verdict:** E03's completion claim holds up under independent reproduction — file scope (including E01/E02's four
frozen files staying byte-identical), full algorithm fidelity to all 8 locked steps and the error-classification
table, a specific packet-prose contradiction independently confirmed real and corrected at its source (the packet,
not the code), test coverage of all 13 acceptance criteria cross-checked by an independent black-box script rather
than only re-reading Codex's own test assertions, exact pass counts (29 / 294 / 342), coverage percentages, lint
cleanliness, `KHÔNG LÀM` compliance, and gate-status honesty all independently confirmed. Does not evaluate or
change G-P0 or G-E0 themselves (G-E0 correctly still PENDING pending E04).

## E04 Half-adder fixture evidence (PM/Tester independent verification, 2026-08-14)

**Author/role note:** written by the PM/tester (Claude Code), not Codex, for the same standing-mandate reason as
the E01/E02/E03 entries above.

**Scope check.** `ls -la --time-style=full-iso` on the four files the packet locked as frozen
(`circuit-netlist.js`, `circuit-engine.js`, `circuit-grader.js`, `boolean-core.js`) shows the exact same mtimes
recorded in the E01/E02/E03 entries above (08:19:33 / 14:00:13 / 16:59:24 / 2026-08-12 09:08:43) — on Windows a
rewrite updates mtime even for byte-identical content, so unchanged mtimes alone are strong evidence of no touch.
`find public/files/perm/idevices/base/electronics-logic -type f -newermt "2026-08-14 17:30:00"` (a cutoff strictly
after E03's last write) returns exactly the two files the packet's `FILE ĐƯỢC SỬA` allowed —
`core/circuit-half-adder.test.js` and `core/fixtures/circuit-half-adder.json` — across the **entire** iDevice tree.
Independent SHA-256 of the four frozen files matches both Codex's reported hashes and the values independently
recorded in the E01/E02/E03 entries above, byte-for-byte. Full-repo `git status --porcelain` shows the same
pre-existing `M`/`??` set recorded since the E03 entry — nothing new at the top level (expected: the whole
`electronics-logic/` tree is one untracked block, so new files inside it don't add new top-level porcelain lines).
**Conclusion: E04 touched exactly the two files the packet allowed, and left all four frozen dependencies
byte-identical.**

**Source cross-check.** Both delivered files were read in full and diffed by eye against the packet's "Thiết kế
khóa" section: `core/fixtures/circuit-half-adder.json` matches the locked JSON **byte-for-byte** — same
`schemaVersion`/`id`, same six node ids/kinds/positions (`in-a`, `in-b`, `xor-1`, `and-1`, `sum-out`,
`carry-out`), same six wire ids/endpoints (`w1`…`w6`), same testbench (`variables:['A','B']`,
`inputs:{A:'in-a',B:'in-b'}`, `outputs:{Sum:'sum-out',Carry:'carry-out'}`, `expected:{Sum:'A XOR B',Carry:'A AND
B'}`). `core/circuit-half-adder.test.js` matches the locked design: CommonJS (`require`, not `import`, consistent
with its direct siblings `circuit-netlist.test.js`/`circuit-engine.test.js`/`circuit-grader.test.js`), requires only
`./circuit-grader.js` and the JSON fixture (not `circuit-engine.js`/`circuit-netlist.js` directly — correctly goes
through the E03 abstraction layer like every other consumer), uses `structuredClone` to avoid mutating the
imported fixture object across tests (per the packet's explicit anti-leakage instruction), and implements exactly
the three locked scenarios plus the folded-in fixture-shape assertion (packet `ACCEPTANCE` item 4) inside test 1.
No `.skip`/`.todo` (grep confirmed zero matches).

**Independent black-box re-verification, against the actual delivered fixture file (not a hand-built copy).** A
standalone script (session scratchpad) `require()`d the real `circuit-grader.js` and the real
`core/fixtures/circuit-half-adder.json` directly — no reuse of Codex's test file — and reproduced all three locked
scenarios:

```
1. unmodified fixture       → score:10, all 8 checks passed
2. wire w4 removed          → score:0, checks:[{id:'structure-danglingInputPin', path:'nodes[and-1].inputs[b]', ...}]
3. w4.from.node -> 'in-a'   → score:8.75, 7/8 passed, only case-10-carry failed (expected:'0', actual:'1')
```

Byte-for-byte identical to the values this PM/tester hand-derived and script-verified **before** the packet was
handed off (the packet locked these exact numbers in advance, not after seeing Codex's report), and byte-for-byte
identical to what Codex's completion report pasted. Three independent sources (hand derivation, pre-handoff
script, post-delivery script against the real file) agree.

**Independently reproduced (all commands run fresh by the PM/tester):**

```
npx vitest run public/files/perm/idevices/base/electronics-logic/core/circuit-half-adder.test.js
  → Test Files 1 passed (1); Tests 3 passed (3)

npx vitest run public/files/perm/idevices/base/electronics-logic/core
  → Test Files 10 passed (10); Tests 297 passed (297)

npx vitest run public/files/perm/idevices/base/electronics-logic
  → Test Files 13 passed (13); Tests 345 passed (345)
```

All three match Codex's completion report exactly, same file lists. `297 - 294 = 3` and `345 - 342 = 3` (E03's
baseline recorded above) — E04 added exactly three tests and changed nothing else; no regression anywhere else in
the tree.

**Lint.** `bunx @biomejs/biome check` on both new files: `Checked 2 files in 14ms. No fixes applied.` — clean,
reproduced exactly.

**Coverage.** Not applicable in the E01-E03 sense — E04 adds no new production `.js` module (only a data fixture
and a test file exercising the already-covered `circuit-grader.js`), matching the packet's explicit note that no
new coverage threshold applies here.

**`KHÔNG LÀM` sweep.** No edits to `circuit-netlist.js`, `circuit-engine.js`, `circuit-grader.js`, `boolean-core.js`
(hash- and mtime-verified above), `boolean-grader.js`, `schema-lifecycle.js`, or any `edition/`/`export/` file. No
`combinationalLoop`/`multipleSources` test duplicated against the half-adder fixture (packet correctly scoped this
out as already covered generically by E01/E03). No NAND/NOR/XNOR, no UI/canvas, no `translations/**` change, no
bundle rebuild, no sample-course/authoring content added.

**Gate claim check.** Codex's report explicitly does not declare `G-E0` closed ("Codex chưa tự tuyên bố gate đã
đóng") and explicitly did not start U01/U02 in the same turn — consistent with the packet's requirement and the
standing "stop at the nearest gate" rule.

**Verdict:** E04's completion claim holds up completely under independent reproduction — file scope (all four
frozen dependencies from E01-E03 confirmed byte-identical by both mtime and hash), fixture content matching the
packet's locked design byte-for-byte, all three graded scenarios independently reproduced against the actual
delivered fixture file with results matching values this PM/tester pre-computed and locked into the packet *before*
Codex started (not merely re-checked after the fact), exact pass counts (3 / 297 / 345) with consistent arithmetic
against the E03 baseline, lint cleanliness, and `KHÔNG LÀM` compliance all confirmed with zero discrepancies.

**Gate `G-E0` — Circuit core: CLOSED.** All four prerequisite tasks (E01 netlist/topology, E02 engine `0/1/X`, E03
testbench/grading, E04 half-adder fixture) have each been independently verified PASS by the PM/tester with
reproducible command output, hash evidence, and — for E04 — a triple-sourced independent re-derivation of the
graded results. `PLAN.md`'s gate criterion (line 89, "Half-adder netlist đạt 4/4 bằng test, loop/dangling được
báo") and `SPEC.md`'s AT-07 (line 396, "Half-adder đúng 4/4; tháo dây làm test thất bại") are both satisfied by
E04's ACCEPTANCE 1 and 2. This closes `G-E0` and unblocks `U01` (`PLAN.md` line 166, depends on `G-E0`+`P04`) —
starting U01 itself requires a new Task Packet, not implied by this verification entry.

## U01+U02 Circuit Node/Wire UI evidence (PM/Tester independent verification, 2026-08-16)

**Author/role note:** written by the PM/tester (Claude Code), not Codex. **Why this entry exists now, two days after
the work landed:** `.ai/packets/U01-node-ui.md` and `.ai/packets/U02-wire-ui.md` each already carry an inline "PM
AMENDMENT (2026-08-15)" section — written by this PM/tester in the prior session — recording a coverage-branch gap
found in each packet's first-pass delivery and the exact follow-up test required to close it. `U02`'s own
dependency preamble cites `U01` as "đã verify PASS", and `U03-four-modes.md`'s dependency preamble (drafted
2026-08-15 17:36) cites `U02` as "đã verify PASS" — so both gates were provisionally signed off in-session. But
unlike every other completed task in this backlog (P01-P04, C01-C06, T01-T03, K01-K04, E01-E04), neither U01 nor
U02 ever got a dated `repo-map.md` entry. This entry closes that gap — and does so by re-deriving everything fresh
in a new session (new test run, new hashes, new source trace) rather than transcribing the amendments' claims,
consistent with the standing rule that Codex/past-session self-reports are never accepted at face value.

**Timeline reconstruction.** `find -printf '%T+ %p'` across the whole `electronics-logic/` tree shows zero file
changes after `2026-08-15 11:07:54` (`export/electronics-logic.test.js`). Working backward: E01-E04 close out on
08-14; `core/boolean-grader-browser.mjs` (bridge) and `export/electronics-logic-grader.bundle.js` (rebuild) both
move at 08-14 21:36-22:06 — this is U01's bridge addition; `export/electronics-logic.css`/`.js` move at 08-15
09:33-09:34 — U01's node UI; `export/electronics-logic.test.js` alone moves again at 08-15 11:07 — consistent with
U02's wire-UI tests landing after U01's amendment test was already in place. No file has moved since. This matches
file-scope declared in both packets exactly (U01 touches the bridge + bundle once; U02 touches only
`export/electronics-logic.{js,css,test.js}`, no bridge/bundle/core changes).

**Full regression, run fresh:**

```
npx vitest run public/files/perm/idevices/base/electronics-logic
  → Test Files 13 passed (13); Tests 369 passed (369); exit code 0
```

Breakdown (all 13 files): `core/` unchanged from the E04 baseline — 10 files, 297 tests, exact match
(`kmap-group-validator` 17, `circuit-engine` 35, `circuit-half-adder` 3, `circuit-grader` 29, `schema-lifecycle` 22,
`kmap-grader` 6, `circuit-netlist` 24, `boolean-grader` 18, `boolean-core-contract` 9, `boolean-core` 134) — confirms
neither U01 nor U02 touched anything under `core/`, as both packets require. The remaining 3 files carry the whole
delta: `export/electronics-logic-grader.test.js` 2, `edition/electronics-logic.test.js` 19 (both untouched by
either packet), `export/electronics-logic.test.js` **51**. `369` total is an *exact* match — not merely "≥" — of
U02's amendment threshold (`≥51` file / `≥369` total), and `51` also clears U01's amendment threshold (`≥37`) with
room for U02's own 14-test addition on top. `369 - 345 (E04 baseline) = 24` tests added across U01+U02 combined,
all inside one file, arithmetic consistent with both packets' declared scope.

**Amendment re-verification, by direct source trace (see Coverage-tooling finding below for why not by
instrumented branch numbers this time).** Read `export/electronics-logic.js` and its test file directly:

- *U01 amendment* (`nextCircuitNodeId`, now at [electronics-logic.js:615-623](public/files/perm/idevices/base/electronics-logic/export/electronics-logic.js#L615-L623)): the collision-avoidance `while (existingIds.has(...)) sequence += 1;`
  loop only *executes its body* when a same-kind id already exists. Test
  `'assigns sequential kind-specific ids when adding two nodes of the same kind'`
  ([electronics-logic.test.js:728-747](public/files/perm/idevices/base/electronics-logic/export/electronics-logic.test.js#L728-L747))
  places two AND nodes via real tool-click + cell-click DOM events and asserts the resulting ids are exactly
  `['and-1', 'and-2']`. Traced by hand: on the second placement, `existingIds` already contains `'and-1'`, so
  `existingIds.has('and-1')` is `true` — the loop body *must* fire (incrementing to `2`) for the assertion to pass.
  This is an unambiguous, non-accidental exercise of the previously-uncovered branch.
- *U02 amendment* (`deleteCircuitWiresForNode`, now at [electronics-logic.js:762-768](public/files/perm/idevices/base/electronics-logic/export/electronics-logic.js#L762-L768)): the `||` condition
  (`data-from-node === nodeId || data-to-node === nodeId`) needed a case where the **to**-node arm alone is `true`.
  Test `'cascade-deletes wires targeting a deleted node while preserving an unrelated wire'`
  ([electronics-logic.test.js:959-987](public/files/perm/idevices/base/electronics-logic/export/electronics-logic.test.js#L959-L987))
  wires two independent input nodes *into* an AND node (`targetAnd` is the **to**-node of both `w1` and `w2`, never
  the from-node of anything) plus one wholly unrelated wire (`w3`, touching neither `targetAnd` nor either of its
  inputs), then deletes `targetAnd`. Traced by hand: for `w1`/`w2`, `data-from-node === 'and-1'` is `false` in both
  cases (from-nodes are the two INPUT nodes) while `data-to-node === 'and-1'` is `true` — deletion is provably
  driven by the to-node arm alone. `w3` has both arms `false` and is asserted to survive
  (`netlist.wires` reduces to exactly `[{id:'w3', ...}]`). Both outcomes (to-node-only-true → delete, both-false →
  survive) are exercised and asserted in one test, matching the amendment's required scenario exactly.

**Coverage-tooling finding (new, environment-level, not a code defect).** Attempted to confirm the above by
re-reading `coverage-final.json`/`lcov.info` branch hit-counts, the same technique that worked for E01 two days ago
(CLI `--coverage.include` override + reports redirected to the session scratchpad, avoiding the pre-existing
Windows `EPERM` lock on `./coverage/vitest/lcov.info`). Every attempt returned **zero coverage data** — `All files |
0 | 0 | 0 | 0` with no per-file rows at all, for `text`, `json`, and `lcov` reporters alike. Isolated the cause
before giving up on it:
- Not the include glob: re-ran the *exact* E01-era command against `circuit-netlist.js` (known to have worked
  2026-08-14, values recorded in the E01 entry above) — now also empty.
- Not electronics-logic-specific: `npx vitest run public/app/utils --coverage` (in the config's own default
  `include`) also reports `0/0/0/0` for every listed file, including files with real, passing tests.
- Not the worker pool: repeated with `--pool=forks` (config default is `threads`) — same empty result.
- Not the platform/engine: a raw `node:inspector` `Profiler.startPreciseCoverage`/`takePreciseCoverage` probe run
  directly (no vitest involved) returns real per-script coverage data (16 script results after executing a trivial
  function) — V8's coverage API itself works fine in this Node v24.12.0 process.
- `@vitest/coverage-v8` and `vitest` are both pinned at `4.0.18` (matched, not a version-skew issue); the package's
  `dist/` output is present and not truncated.

Conclusion: the break is inside `@vitest/coverage-v8`'s worker-to-main coverage collection/merge path specifically,
not the include configuration, not this task's files, and not the underlying platform. This is a **regression since
2026-08-14** (E01/E02/E03 used this exact technique successfully) and is a standing risk to the NFR-05 / AGENTS.md
§5.3 ≥90% patch-coverage gate for **every** future task, not just this one — it should get its own investigation
(likely bisecting a `node_modules` update between 08-14 and today) before it silently blocks a future gate close.
Substituted direct source/test tracing (above) for this verification pass; that is weaker evidence than an
instrumented branch-hit count but is unambiguous by hand-derivation for both specific lines in question.

**File-scope compliance.** Computed fresh SHA-256 for all 16 files listed in `U03-four-modes.md`'s own "Bối cảnh
#12" baseline table (captured by this PM/tester "ngay trước khi viết packet này", i.e. right after U02 landed) —
**all 16 hashes match exactly**, including the 6 files marked "ĐƯỢC PHÉP ĐỔI" that U01/U02 were allowed to touch
(`circuit-grader.js`, `schema-lifecycle.js`, `boolean-grader.js`, `edition/electronics-logic.js`,
`export/electronics-logic.js`, `export/electronics-logic-grader.bundle.js` — these simply haven't been touched
*again* since). This independently confirms two things at once: (1) `U03` has **not** been started — zero source
drift since its packet was drafted 2026-08-15 17:36; (2) `U01`+`U02`'s delivered state is exactly what both
packets' amendment sections describe, with no undocumented changes since.

**Lint.** `bunx @biomejs/biome check` on all four touched files (`export/electronics-logic.{js,css,test.js}`,
`core/boolean-grader-browser.mjs`): `Checked 4 files in 60ms. No fixes applied.` — clean.

**`KHÔNG LÀM` sweep.** No `NAND`/`NOR`/`XNOR`/pan-zoom/auto-layout anywhere in `export/electronics-logic.js`. All
`globalThis` occurrences are the pre-existing bridge-*read* accessor pattern (`getCore`/`getKmapValidator`/
`getCircuitNetlist`/`getGrader`, predating U01) — no new ad-hoc global state introduced. No `.className`/`.dataset`
assignment on the SVG wire-layer elements (grep for `wire.className =` / `wireLayer...className`: zero matches) —
SVG elements need `setAttribute`, not the HTML-element property shortcuts, and neither packet's delivered code uses
the unsafe form.

**E2E scope.** Both packets explicitly and independently justify shipping **no** new Playwright spec: read
`test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` in full (265 lines) myself — all three existing
tests reach their mode via `editor.locator('[data-field="mode"]').selectOption(...)`, and the only options that
dropdown offers are `'truthTable'`/`'kmap'` (confirmed against `edition/electronics-logic.js`'s
`authoringModes`/`createSelectField('mode', ...)`, which U01/U02 correctly left untouched). There is no real
authoring entry point into circuit mode yet, so an E2E spec today could only drive it by injecting Yjs state
directly rather than through a genuine user journey — both packets defer this to U03, which is the task that
finally adds `'circuit'` to the mode dropdown. This reasoning is sound and matches the project's E2E philosophy
(real user journeys, `test/e2e/playwright/helpers/workarea-helpers.ts`, not synthetic state injection). **Flagged
below:** `U03-four-modes.md` as currently drafted does not list the E2E spec file among its `FILE ĐƯỢC SỬA` either,
despite U03 being exactly the task both prior packets pointed to as removing this blocker.

**Verdict:** `U01` and `U02`'s completion claims — including both packets' own PM AMENDMENT follow-ups — hold up
completely under a fully independent re-derivation in a new session: exact pass counts (369/369, 13 files,
arithmetic-consistent with the E04 baseline and both amendment thresholds), both previously-missing branches now
provably exercised (by hand-trace, coverage tooling being unavailable this session), 16/16 frozen-file hashes exact,
lint clean, `KHÔNG LÀM` compliant, and E2E deferral independently re-justified. **`U01` — CLOSED. `U02` —
CLOSED.** `G-U0` (PLAN.md line 90) still requires `U03` before it can close — not evaluated by this entry. `G-P0`
remains FAIL for unrelated Chromium E2E reasons (BUGFIX-02 entry above), unaffected by and unaffecting this entry.

## U03 Circuit-mode grading wire-up evidence — G-U0 CLOSED (PM/Tester independent verification, 2026-08-17)

**Author/role note:** written by the PM/tester (Claude Code), not Codex, consistent with the standing rule that
Codex self-reports are never accepted at face value without independent re-derivation.

**Context.** `.ai/packets/U03-four-modes.md` wires circuit-mode grading end-to-end (schema validation, grader,
minimal authoring UI, result display) to satisfy `G-U0`'s literal text: "Half-adder nối/chấm được" (PLAN.md line
90). Implementation surfaced four sequential blockers, each stopped-and-reported by Codex per protocol and each
resolved by a dated PM packet amendment (full narrative in the packet's own ĐẦU RA rủi ro items #7-#10, not
reproduced here): (1) a `.mjs` glue-wrapper fix so `schema-lifecycle.js` bundles correctly for the browser (Thiết kế
khoá #8); (2) a Windows cross-identity ACL file lock on `coverage/`, cleared by deleting the local artifact
directory; (3) `validateData()` incorrectly required a non-existent `data.netlist` field for circuit mode instead of
`answer.testbench` — fixed to mirror the adjacent `kmap` branch (Thiết kế khoá #9); (4) Playwright was loading
iDevice runtime code from a stale packaged artifact, `public/bundles/idevices.zip` (built 2026-08-14, pre-dating
every U03 change), instead of live source. For (4), Codex proposed two options (a targeted rebuild requiring new
duplicated bundling logic, or lifting the packet's ban on the full `scripts/build-resource-bundles.js` run); the PM
rejected both as violating "No workarounds"/"Single source of truth" (AGENTS.md §1) and instead designed a third
option requiring zero new code: delete only the gitignored `idevices.zip`, and let the product's own already-shipped
fallback path (`ResourceFetcher.fetchIdeviceFallback()` → `GET /api/resources/idevice/:ideviceType` →
`scanDirectory()`, which always reads live from disk) serve current source — locked as Thiết kế khoá #10.

**Independent verification performed this session** (re-derived directly against this working tree, not transcribed
from Codex's report):

- `git check-ignore -v public/bundles/idevices.zip` → `.gitignore:8:/public/bundles/ public/bundles/idevices.zip` —
  confirms the artifact is gitignored, matching Codex's cited evidence exactly.
- `git status --porcelain public/bundles/` → empty output — confirms nothing under this path is tracked or staged.
- `ls -la public/bundles/`, run both **before and after** independently re-running the E2E suite below: `idevices.zip`
  absent in both checks; the five sibling artifacts (`manifest.json`, `common.zip`, `content-css.zip`, `libs.zip`,
  `themes/`) show the **identical mtime** (`2026-08-14 22:06`) in both checks. This is direct, independently-observed
  proof — not a trusted self-report — that (a) no rebuild ran, and (b) nothing besides the one banned artifact was
  touched, before or as a side effect of the test run.
- Independently re-ran `bun x playwright test --project=chromium
  test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` from a clean invocation (own webServer boot, own DB
  migration, own project fixtures — not reusing any Codex session state): **5 passed, 0 failed, 0 skipped (24.5s)**,
  exact match to Codex's reported result, naming all five tests explicitly:
  `keeps truth-table minterm authoring through the palette, editor, reload, and preview`,
  `edits and grades Karnaugh cells and a minimal group in preview`,
  `rejects an invalid Karnaugh selection before creating a valid group`,
  `authors, saves, and grades a half-adder circuit through the palette, wiring, and preview`,
  `shows a structural error for an unconnected circuit instead of a misleading score`. The fourth test's name is a
  near-verbatim match of `G-U0`'s own requirement text ("Half-adder nối/chấm được"), and the fifth confirms structural
  errors are reported correctly rather than a misleading score — together these are direct behavioral proof of the
  gate requirement, not just file-state evidence. A passing run here also transitively re-exercises Thiết kế khoá
  #1-#9 end-to-end (bundling, validation, grading, UI wiring all execute together inside a real browser), so this one
  independent run corroborates the whole U03 delivery, not blocker #4 in isolation.

**Verdict:** blocker #4's fix (Thiết kế khoá #10) holds up under independent re-derivation with no reliance on
Codex's self-report — gitignore/status checks match, bundle-artifact mtimes prove no unauthorized rebuild occurred,
and a from-scratch Playwright re-run reproduces the exact 5/5 pass, including literal fulfillment of `G-U0`'s stated
half-adder grading requirement. **`U03` — CLOSED. `G-U0` (PLAN.md line 90) — CLOSED.** `G-P0` remains FAIL for
unrelated Chromium E2E reasons (BUGFIX-02 entry above), unaffected by and unaffecting this entry. Per Thiết kế khoá
#10's own accepted-tradeoff note, `public/bundles/idevices.zip` stays absent locally until the next real `make
bundle`/`build:all` run (gitignored, no git/PR impact) — out of scope for U03, and any future task that adds new
iDevice runtime surface (flagged as a candidate: I01/I02) should watch for this same bundle-staleness gap recurring,
since `make` remains unavailable on Codex's machine for the whole engagement and no scoped-rebuild flag exists yet
in `scripts/build-resource-bundles.js`.

## I01→I02→I03 Integration cluster evidence — no gate closed, Q01 dependency unlocked (PM/Tester independent verification, 2026-08-18)

**Author/role note.** Written by the PM/tester (Claude Code), not Codex. **Process gap found before any code
verification began:** unlike every prior entry in this log, the `ĐẦU RA` section of all three packets
(`I01-save-open-preview.md`, `I02-html-runtime-offline.md`, `I03-asset-secret-audit.md`) contains only
*instructions* for what a completion report must include — no actual filled-in Codex report exists anywhere in the
repo for I01, I02, or I03. There was nothing to cross-check a self-report against; everything below is derived solely
from fresh command output and direct source reads, not a second opinion layered on a first one.

### I01 — save/open/preview integration (depends on U03, closed)

- `npx vitest run public/app/common/exe_export.test.js` → **143 pass, 0 fail** — exact match to `ACCEPTANCE` #2.
- Read `public/app/common/exe_export.js` directly: `needsJsonRender` extracted exactly to the packet's locked design
  — 9-entry `jsonOnlyIdevices` array, `'electronics-logic'` appended as the 9th entry, `componentType === 'json' &&
  jsonOnlyIdevices.includes(ideviceType)`. No deviation.
- `git diff --stat` scoped to I01's 2 "modify" files: `exe_export.js` (+16/-15, net 31 changed lines),
  `exe_export.test.js` (+18) — consistent with "extract pure method + 4 new `it()`".
- E2E: `bun x playwright test --project=chromium test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` →
  **8 passed**, not the 7 locked by `ACCEPTANCE` #3. See Finding #2 below — this is not a regression, it's an
  undisclosed extra test.

### I02 — HTML runtime offline (depends on I01)

- `test/integration/html5-export-electronics-logic-offline.spec.ts` → **5 pass, 0 fail, 103 expect() calls**; log
  confirmed exactly the 4 required ZIP entries.
- `npx vitest run public/files/perm/idevices/base/electronics-logic` (full idevice-dir regression) → **15 files, 388
  tests, all pass** — exact match to the packet's own arithmetic (385-file baseline + 3 new tests in
  `electronics-logic-offline.test.js`).
- File scope: exactly the 2 new files the packet declares, neither modifying anything I01 or I03 own. Clean.

### I03 — asset/secret audit (depends on I02; completion unlocks Q01's dependency per `PLAN.md` line 182)

- Read `FileSystemResourceProvider.ts`'s `readDirectoryRecursive` directly: the 3-line dot-prefix skip is present
  verbatim as locked (`if (entry.name.startsWith('.')) { continue; }`, plus its comment — 4 lines changed per `git
  diff --stat`, matching 3 code lines + 1 comment line).
- `FileSystemResourceProvider.spec.ts` → **47 pass, 0 fail, 97 expect() calls**.
- Fixture audit (`html5-export-fixture.spec.ts`) → **51 pass, 0 fail, 66 expect() calls**, but the delivered
  `describe('EXP-03/SKILL-11 whole-export forbidden pattern audit', ...)` (read in full, lines 510-598) is a
  structural redesign of the packet's locked "Piece 3": literal substrings (`'sk-'`, `'.ai/'`) replaced with
  structured token-shape regexes (`sk-proj-`, `sk-ant-`, `sk-[A-Za-z0-9_-]{20,}`, `ghp_...`, `AIza...`, `Bearer
  ...`), a `dotSegment` path-based check replacing the 3 literal dot-folder strings, and new binary/third-party/SVG
  exemption zones. Log line: `[I03 EXP-03 audit] scanned 16 text entries, skipped 91 binary, 23 third-party, 143
  total` — does not match the packet's locked log format either.
- **Independently reproduced the reason** (not trusted from the code comment): wrote a standalone `bun -e` script
  using the project's own `fflate` (`unzipSync`, no external tools — Python and `adm-zip` were both unavailable in
  this environment) against the real `test/fixtures/old_el_cid.elp` fixture used by this test. Result: of 19 total
  entries, exactly 2 (`content.data`, `contentv3.xml`) contain the literal substring `sk-` in real author content,
  and the same 2 contain `.ai/` (via `ideogram.ai` link text). This **proves** the packet's original literal-string
  design would have false-positived against real fixture data — the redesign was a necessary correctness fix, not a
  shortcut. The replacement is a strict superset of the original guarantee (`dotSegment` catches `.agents/`/`.claude/`
  /`.ai/` plus any other dot-prefixed segment; token-shape regexes still catch real secrets; absolute-path/stack-trace
  literal checks are untouched).
- `test/integration/html5-export-media-offline.spec.ts` (new) → **2 pass, 0 fail, 8 expect() calls**.
- Full regressions, no code changes made: `bun test ./src/shared/export` → **2029 pass, 0 fail, 4579 expect() calls,
  44 files**. `bun test test/integration` → **735 pass, 0 fail, 2040 expect() calls, 44 files**. Both include I02's
  and I03's new integration files; no regressions anywhere else in either tree.
- Coverage (`ACCEPTANCE` #6, packet's own required command): `bun test ./src ./test/helpers ./scripts ./app
  --coverage` → **8013 pass, 0 fail, 113544 expect() calls** overall; per-file row for the fix itself:
  `src\shared\export\providers\FileSystemResourceProvider.ts | 100.00 | 100.00 |` — 100% funcs, 100% lines, no
  uncovered line numbers listed. Clears the ≥90% patch-coverage gate with margin.
- File scope: `git diff --stat` shows exactly the packet's 3 "modify" files (`FileSystemResourceProvider.spec.ts`
  +40, `FileSystemResourceProvider.ts` +4, `html5-export-fixture.spec.ts` +90) plus the 1 new file as `??` in `git
  status`. Clean.

### Lint (all three tasks together)

`bunx @biomejs/biome check` on all 6 touched `.ts`/`.spec.ts` files across I01–I03
(`electronics-logic.spec.ts`, `html5-export-electronics-logic-offline.spec.ts`, `FileSystemResourceProvider.ts`,
`FileSystemResourceProvider.spec.ts`, `html5-export-fixture.spec.ts`, `html5-export-media-offline.spec.ts`) →
`Checked 6 files in 32ms. No fixes applied.` — clean, 0 diagnostics.

### File-scope sweep (full, unscoped)

`git status --porcelain` (no pathspec) cross-checked against all three packets' `FILE ĐƯỢC SỬA` tables. The
~25-file `M`-baseline (`AGENTS.md`, `app/save-utils.spec.ts`, `bun.lock`, `scripts/*`, `src/cli/commands/*`,
`src/routes/*.spec.ts`, `src/websocket/yjs-persistence.*`, `test/integration/helpers/integration-app.ts`, etc.) is
pre-existing drift from earlier tasks (E-/U-cluster), already outside I01/I02/I03's declared scope and not touched
again by any of the three commands run this session — confirmed by the pathspec-scoped diffs above showing only the
declared files changed. The only undisclosed addition found anywhere in this cluster is Finding #2 below.

### Finding #1 — I03 EXP-03 audit redesign (flagged, non-blocking)

Already covered above: empirically confirmed necessary and correct via direct fixture inspection. Recorded here for
the log; does not weaken I03's security guarantee and does not block acceptance.

### Finding #2 — unauthorized 8th E2E test (confirmed `KHÔNG LÀM` violation, non-blocking to function, blocking to process)

`test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` carries **8** `test(...)` blocks, not the 7 that
I01's own `ACCEPTANCE` #3 locks. Lines 141/220/279/317/401 are the 5 pre-existing tests; lines 432/502 are I01's 2
authorized additions; **line 596**, `'completes truth-table, Karnaugh, and half-adder grading in a real offline
HTML5 export (I02, AT-09)'`, is not authorized by any packet.

Evidence this is a real scope violation, not a filing error on my part:
- File mtime is a single timestamp, **2026-08-17 20:58:25**, for all 3 added tests together (I01's 2 plus this one)
  — one edit session, not two.
- `I02-html-runtime-offline.md`'s own file mtime is **2026-08-17 23:05:36** — over 2 hours *later*. The 8th test's
  name explicitly says "(I02, AT-09)", meaning whoever wrote it during I01's session pre-emptively wrote and labeled
  work for a task that did not yet exist as a packet.
- I01's own `KHÔNG LÀM` states verbatim: *"Không viết I02/I03 — I01 chỉ là 1 task trong cụm I, dừng lại sau khi
  ACCEPTANCE của I01 đạt."* Writing I02-labeled test code during I01's session is a direct violation of this rule.
- I02's own packet, written afterward with full visibility into the working tree, does **not** list
  `electronics-logic.spec.ts` in its `FILE ĐƯỢC SỬA`, does **not** include a Playwright command in its `TEST BẮT
  BUỘC`, and never references this test. It sits in a governance no-man's-land: authored under no packet's
  authority, checked by no packet's `ACCEPTANCE`.

Read the test in full (lines 590-741). It is technically sound and independently valuable: it drives a real
UI-triggered HTML5 export via `exportHtml5Website(page)`, downloads and unzips the actual ZIP with the project's own
`fflate`, serves those exact bytes back through a `page.route('http://el-offline.local/**', ...)` interceptor (404
for anything not in the ZIP — a genuine "no live network dependency" proof), navigates a real browser to that
synthetic offline origin, and correctly interacts with and grades all three iDevice runtimes (truth table `'7 / 8'`,
K-map `'10 / 10'` + minimal-solution text, half-adder `'8 / 8'` + Vietnamese confirmation text). This is arguably
**stronger** end-to-end evidence for AT-09/EXP-02 than either of I02's own locked tests (an integration test that
inspects ZIP structure without a browser, and a unit test that blocks `fetch` on the runtime file directly rather
than driving a real export).

**Verdict:** confirmed `KHÔNG LÀM` violation by I01's implementer — a **process** defect (scope discipline broken,
packet boundary crossed pre-emptively), not a **functional** defect (the test is correct, passing, and additive; it
does not alter, weaken, or conflict with any of I01's or I02's locked tests). I01's `ACCEPTANCE` #3 text ("7 pass")
is now stale as a literal re-run check — this entry is the canonical explanation for why a fresh run correctly
produces 8. Recommendation: do **not** delete the test — deleting verified, passing coverage to match a stale count
would destroy real evidence and likely just get re-added under I02 or later anyway. Instead this entry retroactively
adopts it as bonus evidence toward I02's AT-09/EXP-02 claim, and flags the pattern itself (packet-boundary discipline
slipping once across I01→I02→I03) as a note for how Codex is briefed on future packets — worth watching, not yet
worth a process change on a single occurrence.

**Cluster verdict:** `I01`, `I02`, `I03` all independently re-verified — every required test command reproduces the
locked pass count (except the disclosed +1 in I01's E2E, Finding #2), lint is clean across all 6 files, I03's patch
coverage is 100% against a ≥90% gate, full-tree regressions (`src/shared/export`, `test/integration`) show zero
collateral damage, and file scope matches each packet's declared list exactly aside from Finding #2. **I01 — CLOSED.
I02 — CLOSED. I03 — CLOSED.** None of the three closes a named gate (no `G-I0` exists by design). Per `PLAN.md` line
182, I03's completion **unlocks the dependency for `Q01`** — this entry does not start Q01. `G-P0` status
re-verification is a separate, still-running check (full native Chromium E2E suite launched this session) — result
to be appended as its own dated entry once it completes, not merged into this one.

## G-P0 Chromium E2E blocker recheck — status update (PM/Tester independent verification, 2026-08-18)

**Context.** `G-P0` (`PLAN.md` line 86) has stood at FAIL since BUGFIX-02 (2026-08-13) on the basis of a **Docker**
Chromium run: 494 passed / 34 failed / 7 skipped. No entry since then had re-run the full suite. Since I01–I03 just
finished touching `exe_export.js` (iDevice JSON-render dispatch) and `FileSystemResourceProvider.ts`
(CLI/server-side export only, per I03's own "Bối cảnh" §2 — the interactive browser paths were already protected),
neither file is in a code path the original 34-failure cluster implicated, but this had not been re-confirmed by an
actual run since then.

**Independent verification performed this session.** Ran the full suite fresh, **native Windows** (not Docker, this
machine has no Docker available — same environment class as the 08-13 native-Windows spot-check, not the same class
as the original 08-13 Docker baseline that set `G-P0` to FAIL):

```
bun x playwright test --project=chromium
→ 2 failed, 6 skipped, 534 passed (22.6m)
```

The 2 failures:
1. `idevices/geogebra-activity.spec.ts:93` — "display sizing (#2029) › exposes visible width/height controls" —
   `TimeoutError: page.waitForFunction: Timeout 5000ms exceeded` waiting for a settings fieldset to expand after a
   legend click.
2. `idevices/text.spec.ts:90` — "TinyMCE Advanced Editor (CodeMagic) › should open advanced HTML editor without
   blank window" — `expect(locator).toBeVisible()` failed, could not find the "advanced" TinyMCE context-menu item.

Both are in iDevices (GeoGebra, Text/TinyMCE) that no task this entire session (I01/I02/I03) touched, read, or has
any dependency on — not a regression introduced by this cluster.

**Verdict.** The original Docker-based 34-failure blocker does **not** reproduce in a fresh native-Windows run —
534/536 pass, matching the same order of magnitude as the last known native-Windows spot-check (08-13: 528
passed/1 failed/6 skipped) rather than the Docker baseline. This corroborates the standing hypothesis (implicit in
prior entries, never directly confirmed until now) that `G-P0`'s failure is **Docker/CI-environment-specific**, not
a defect in the application itself reproducible on the actual development machine. **This does not close `G-P0`** —
the gate's own evidence bar (`PLAN.md` line 86) was set against a Docker run, and this session did not have Docker
available to re-run that exact configuration; closing the gate requires either re-running in the original Docker
setup or a PM decision to re-baseline the gate's evidence environment. Recorded here as a status update, not a
closure. The 2 native failures found here (GeoGebra sizing, TinyMCE CodeMagic) are new findings, unrelated to
Solo Logic Alpha scope, and are flagged for separate triage — not blocking I01/I02/I03/Q01.

## Q01 Task Packet created — governance conflict resolved (PM/Tester, 2026-08-18)

**Context.** Root-level `CODE_Q01_HANDOFF.md` (untracked, pre-existing before this session) designated **Gemini**
as "AI writer duy nhất" for Q01 (Course E2E) — directly contradicting `AGENTS.md` §13.4, which names Codex as the
sole AI writer for Solo Logic Alpha, with other AI tools permitted only as explicitly-assigned read-only reviewers.
Cross-checked against `CODE_P04_HANDOFF.md` (correctly Codex-targeted) and `GEMINI.md` (generic onboarding doc,
does not itself claim sole-writer status) — confirmed this was an isolated authoring mistake in one file, not a
systemic pattern. Surfaced to the user directly via `AskUserQuestion` rather than resolved unilaterally, since it
is a governance decision only the user can make. **User's answer:** *"sự nhầm lẫn thôi, toàn bộ codex viết hết"*
(just a mix-up, Codex writes everything) — Codex confirmed as sole writer for Q01, no exception.

**Action taken.**
1. Re-verified `CODE_Q01_HANDOFF.md`'s substantive content (requirement IDs, file scope, helper assumptions)
   against current `SPEC.md`/`PLAN.md`/actual repo state rather than trusting it at face value. Found it
   materially correct except for two stale points: (a) it cited "7 pass" as `idevices/electronics-logic.spec.ts`'s
   unchanged regression baseline — stale, the file now has **8** tests after the I01 cluster's Finding #2
   (retroactively-adopted 8th test, see entry above); (b) it left "does Q01 need a new download helper?" as an
   open question — resolved by grep: `downloadProject()` in `test/e2e/playwright/helpers/workarea-helpers.ts`
   (line 2341) already handles `.elpx` download in both static and online modes, so no new helper file is needed.
   Also confirmed `exportHtml5Website` is not a shared helper — it's independently duplicated as a local function
   in 4 spec files (`fx-tabs-latex.spec.ts`, `latex-rendering.spec.ts`, `idevices/electronics-logic.spec.ts`,
   `idevices/three-d-viewer.spec.ts`); Q01 should follow the same local-copy convention, not extract a shared one.
2. Wrote **`.ai/packets/Q01-course-e2e.md`**, matching I01/I02/I03's structural template (`Bối cảnh đã xác minh`
   with evidence-backed numbered subsections, `FILE ĐƯỢC SỬA` table, `Thiết kế khóa`, `KHÔNG LÀM`, `ACCEPTANCE`,
   `TEST BẮT BUỘC`, `ĐẦU RA`), targeting Codex, carrying forward `CODE_Q01_HANDOFF.md`'s verified-accurate scope
   (SPEC IDs PLAT-07/AT-03/AT-05/AT-06/AT-07/AT-09/EXP-02/EXP-03, exactly matching `SPEC.md`'s own text) with both
   corrections applied. Q01 closes no gate (no `G-Q0` in `PLAN.md`'s gate table); it is a step toward `G-R0`
   (Release) and unblocks Q02 (`PLAN.md` line 183) once done.
3. Marked `CODE_Q01_HANDOFF.md` **superseded** with a banner at the top of the file (not deleted — kept for
   historical reference only, per the reversible-action-over-destructive-action default). The banner states
   plainly that its content must not be used as instructions for any AI writer going forward.

**Status.** Q01 is packet-ready, not yet started (`test/e2e/playwright/specs/demo/` and
`test/fixtures/electronics-logic-demo.elpx` both confirmed absent via `ls`). No code was written this entry — only
the packet (a PM-authored planning document, consistent with how I01/I02/I03's packets were produced) and the
superseded-banner edit to the old handoff file.

## Q01 Codex delivery — independent verification: NOT CLOSED, flaky test found (PM/Tester, 2026-08-18)

**Claim under review.** Codex reported Q01 (Course E2E) complete: 3 new files
(`test/e2e/playwright/specs/demo/electronics-logic-demo.spec.ts`, `test/fixtures/electronics-logic-demo.elpx`, plus
the packet itself), all 6 required test commands green, Red→Green evidence for a K-map flakiness fix in
`completeKmap()`, course-content verification, and the 8-pass regression baseline correction applied. Per standing
PM/Tester mandate, none of this was accepted on the report's word — every claim was independently reproduced.

**Verified accurate (reproduced myself, matches Codex's numbers exactly):**
- File scope: `git status --porcelain` (full, unscoped) shows exactly the 3 expected new artifacts on top of the
  known ~25-file pre-existing baseline drift — no `KHÔNG ĐƯỢC SỬA` file touched, no new helper file added under
  `test/e2e/playwright/helpers/`.
- `test/e2e/playwright/specs/demo/electronics-logic-demo.spec.ts` (603 lines) read in full: exactly 6 `test(...)`
  cases matching the packet's locked design; `exportHtml5Website` defined locally (not extracted as a shared
  helper, per mandate); `downloadProject`/`addTextIdevice`/`setTinyMCEContent`/`waitForTinyMCEReady`/
  `insertFileIntoEditor`/`uploadFixtureFile` all confirmed to genuinely exist via grep (none fabricated);
  `unzipSync` import from `src/shared/export` confirmed exported at `src/shared/export/index.ts:124`. No
  `eval`/`Function`, no `.skip`/`.todo`, no `test.describe.configure({mode:'serial'})`, each test creates its own
  project (6 distinct project names) — no cross-test coupling.
- `idevices/electronics-logic.spec.ts` re-run fresh → **8 passed (59.2s)**, file untouched — matches the mandated
  correction exactly (not 7).
- `bun test ./src/shared/export` → **2029 pass, 0 fail** (exact match, also matches I03's own last-measured baseline
  — expected, since Q01 adds zero production code).
- `bun x vitest run public/files/perm/idevices/base/electronics-logic/` → **15 files, 388 tests, all pass** (exact
  match).
- `bun x biome check` on the new spec file → clean (exact match).
- `bun test ./src ./test/helpers ./scripts ./app --coverage` → **8013 pass, 0 fail, 113544 expect() calls** (exact
  match, also matches I03's baseline — expected).
- `test/fixtures/electronics-logic-demo.elpx` independently unzipped with a standalone `fflate` script (not via the
  spec's own assertions): 81 real entries, `content.xml` (49072 bytes) contains all 4 authored strings (course
  text, TT/K-map/circuit prompts) and both media filenames. An independent forbidden-pattern/absolute-path scan
  across every entry surfaced 3 hits, all traced to their exact matched substrings and confirmed **false positives**
  from my own cruder regex matching minified vendor code inside `libs/` (a Google-Drive-URL regex fragment in
  `libs/common.js`, and sourcemap token syntax in the Bootstrap `.map` files) — not real secrets or paths. This
  incidentally validates that the spec's own `auditWholeExport` design (which exempts `libs/`/`theme/` from content
  scanning) is load-bearing, not just copied convention: scanning third-party/vendor bundles for these patterns
  produces exactly this class of false positive.

**Finding — confirmed, blocking.** `demo/electronics-logic-demo.spec.ts` does **not** reliably pass as a full suite.
Fresh run #1 at default Playwright parallelism: **5 passed, 1 failed** — `AT-06 grades a four-variable Karnaugh
map...` failed with `expect(locator).toContainText('10 / 10')` / received `"Chưa điền đủ bản đồ Karnaugh."` (K-map
reported incomplete at check-time despite `completeKmap()` having filled and DOM-verified all 16 cells). Re-running
the same test in isolation (`-g "AT-06" --repeat-each=3 --workers=1`) passed **3/3** (8.8s/9.2s/9.0s, consistent
timing). A second fresh full-suite run at default parallelism passed **6/6**. Net: **1 reproducible failure out of 2
default-parallelism attempts**, 0 failures out of 3 isolated attempts — a real, load-sensitive race, not a one-off
fluke or a misconfigured assertion.

Root-cause hypothesis (plausible, not fully proven — read `public/files/perm/idevices/base/electronics-logic/export/electronics-logic.js:968-985`,
`updateEmptyState`): the completeness check reads `<select data-role="kmap-value">.value` directly from the live
DOM with no async indirection, so Codex's fix (`waitFor(attached)` → `selectOption` → `expect(toHaveValue)` per
cell) correctly guards against slow initial paint but not against a **later** full-section re-render clobbering
already-filled cells — plausibly triggered by a delayed Yjs/preview-sync message arriving mid-interaction under the
heavier concurrent WebSocket load a multi-worker run produces (many `[YjsWebSocket] Collaboration detected` lines
were visible in the failing run's server log). Not chased further — root-causing and fixing is Codex's work, not
PM/Tester's; this is handed back as a concrete lead, not a final diagnosis.

**Verdict.** Q01 is **NOT CLOSED**. `ACCEPTANCE` #1 ("toàn bộ 6 test pass") is not reliably met under the same
default-parallelism conditions the required test command actually runs under — this is exactly the class of claim
this mandate exists to catch before it reaches a gate. To Codex's credit, this exact risk was self-disclosed in the
report's own "Rủi ro còn lại" (R1: "Đã mitigate bằng wait chuỗi nhưng chưa bulletproof") — the gap is that R1 was
filed as a residual risk footnote rather than blocking the Gate C "GREEN" claim it directly contradicts. Sent back
to Codex with the specific reproduction steps and root-cause lead above. Q02 remains untouched and un-started.

## Q01 Codex delivery — FINAL (AT-06 fix): independently verified stable, Q01 confirmed (PM/Tester, 2026-08-19)

**Claim under review.** Codex's follow-up report claims the AT-06 flakiness above is fixed: `completeKmap()` now
waits for `data-behaviour-bound="true"` and for all 16 `[data-role="kmap-value"]` dropdowns to be attached before
filling, then uses `expect.poll(..., { timeout: 20000, intervals: [500, 1000, 2000] })` which the report describes
as retrying "tự động re-set giá trị nếu re-render xóa mất" (auto re-setting values if a re-render clears them). All
6 required commands reclaimed green, all 3 files unchanged in scope. Per standing mandate, re-verified from scratch
— nothing carried over from the round-1 session.

**Code read first, before running anything.** Read the current
`test/e2e/playwright/specs/demo/electronics-logic-demo.spec.ts` in full (629 lines). The two new waits before the
fill loop are real (lines 307, 310). The `expect.poll` block (lines 324-338) is also real, but **the report's
description of it is inaccurate**: the poll callback only calls `dropdown.inputValue()` and returns a boolean — it
never calls `selectOption()` again. There is no "auto re-set" anywhere in this function; if a re-render really did
clear values after the fill loop, this poll would detect the mismatch and retry the *check* for up to 20s, then
**time out and fail** (a clearer failure than before, not a self-heal). The mechanism that plausibly fixes the
original race is the two pre-fill waits — ensuring `selectOption()` only fires after the runtime has finished
binding its change-event handlers — which is a different root cause than either Codex's stated mechanism or my own
round-1 hypothesis (late re-render clobbering already-good values). Flagging this so the mechanism is understood
correctly going forward, not as a blocker: the code change itself is sound regardless of how it was described.

**Verified accurate (reproduced myself, matches Codex's numbers exactly):**
- `git status --porcelain` (full, unscoped): still exactly the expected Q01 artifacts on top of the known
  pre-existing baseline drift. No file-scope change since round 1.
- `npx playwright test demo/electronics-logic-demo.spec.ts --project=chromium`, fresh, default parallelism, run
  **3 times**: **6 passed** every time (1.2m / 1.1m / 1.0m).
- AT-06 specifically stress-tested beyond the packet's bar: `--grep "AT-06" --repeat-each=10` run **twice** at
  default parallelism (one batch observed up to 11 concurrent projects/WebSocket clients — heavier load than the
  round-1 failing run) → **20/20 passed**. Combined with the 3 full-suite runs: **23/23 consecutive AT-06 passes**,
  vs. 1 failure in ~9 attempts in round 1. Statistically and by code inspection, this is a genuine fix.
- `idevices/electronics-logic.spec.ts` → **8 passed (1.1m)**, file still untouched (`??`, not `M`).
- `bun test ./src/shared/export` → **2029 pass, 0 fail** (7.27s).
- `bun x vitest run public/files/perm/idevices/base/electronics-logic/` → **388 pass, 15 files**.
- `bun x biome check` on the spec file → clean, no fixes applied.
- `bun test ./src ./test/helpers ./scripts ./app` → **8013 pass, 0 fail, 113544 expect() calls** (103.48s).
- `test/fixtures/electronics-logic-demo.elpx` re-unzipped independently after being overwritten multiple times by my
  own PLAT-07 re-runs: still 81 entries, `content.xml` still contains all 4 authored strings + both media
  filenames, same 3 known false-positive "violations" (Bootstrap sourcemaps + `libs/common.js`) as round 1 —
  content is stable across regeneration, not just accidentally correct once.

**Verdict.** Q01 is **CONFIRMED**. The AT-06 flakiness from round 1 does not reproduce — 23/23 under conditions at
or above the original failure trigger — and all other required commands match exactly with no regression. One
non-blocking note sent back to Codex: correct the "auto re-set" description of `expect.poll` in its own
understanding (it verifies-with-timeout, it does not heal), so a future genuine late-clobber bug isn't mistaken for
already-handled. Per Solo Logic Alpha gate topology, Q01 closes no gate itself (no `G-Q0` exists) — it unlocks Q02
and is a step toward `G-R0`. Q02 (Regression/security, `PLAN.md` line 183) may now proceed.

## AGENTS.md §13.4 — AI writer reassigned: Codex → Nemotron 3 Ultra (PM/Tester, 2026-08-19)

**Context.** User reported Codex has exhausted its quota and needs to wait for reset, and named two replacement
tools available now — Nemotron 3 Ultra and DeepSeek V4 — asking that one of them write the project going forward.
`AGENTS.md` §13.4 item 4 names Codex as the sole AI writer and only covers the reverse case ("their availability
never blocks Codex from continuing an approved task") — it does not address Codex itself being unavailable. This is
a governance decision, not something to resolve unilaterally; surfaced to the user via `AskUserQuestion` on two
points: (1) whether to edit `AGENTS.md` now or just log a time-boxed exception in `repo-map.md`, (2) which of the
two named tools receives the next Task Packet. **User's answers:** update `AGENTS.md` now (recommended option);
Nemotron 3 Ultra takes Q02.

**Action taken.** Edited `AGENTS.md` §13.4 item 4: Codex recorded as the default writer but currently suspended
(quota, since 2026-08-19); Nemotron 3 Ultra is now the active writer; DeepSeek V4 is named as backup if Nemotron 3
Ultra also becomes unavailable. Kept the rest of the rule's substance intact — still exactly one active writer at a
time, other AI tools still read-only unless explicitly assigned, and no writer's unavailability blocks a
different already-approved writer from continuing.

**What does not change.** The PM/Tester mandate is independent of writer identity: every completion claim, from
any writer, is independently reproduced before being accepted — same command re-runs, same file-scope checks via
unscoped `git status --porcelain`, same standard applied to Codex in every Q01 round above now applies to Nemotron
3 Ultra (and to DeepSeek V4 if it becomes active). Task Packet protocol (`.ai/packets/<ID>-<slug>.md`, locked
sections, gate discipline) is unchanged. When Codex's quota resets, revert or update this line again and log the
change here with date and reason — do not let `AGENTS.md` silently drift from actual practice a second time.

**Status.** No task packet written yet for Q02 under the new writer. Next step: prepare
`.ai/packets/Q02-*.md` (Regression/security, `PLAN.md` line 183) and a kickoff prompt targeting Nemotron 3 Ultra.

## Q02 Task Packet written — regression sweep + one gap-closing test (PM/Tester, 2026-08-19)

**Context.** Continuing from the writer reassignment above, researched and wrote
`.ai/packets/Q02-regression-security.md` (Regression/security, `PLAN.md` line 183, dep Q01, target writer Nemotron 3
Ultra). Followed the plan-writing skill's "inspect the repository before naming files" rule — read every file named
in the packet's locked sections before writing them, no guessed paths.

**Research findings, in order:**

1. **Most of AT-01…AT-10 already has automated coverage from prior tasks.** Grepped `.ai/packets/*.md` for AT-04,
   AT-08, AT-10, PLAT-06 and confirmed E01/E02/E04 (AT-08, circuit errors), I01 (AT-02, round-trip), I02/I03/Q01
   (AT-03/AT-09, offline) all already have direct evidence. Q02's job for these is re-run + a compiled AT-ID → test
   cross-reference table, not new test authorship.
2. **Secret scan has three independent implementations, not one.** `I02` (`electronics-logic.spec.ts` +
   `html5-export-electronics-logic-offline.spec.ts`) scans 4 electronics-logic entries only. `I03`
   (`html5-export-fixture.spec.ts`) scans the *whole* export ZIP but against `old_el_cid.elp`, a fixture that
   predates and does not contain electronics-logic. `Q01` (`electronics-logic-demo.spec.ts:382-417`,
   `auditWholeExport`, called at line 556 inside the `AT-09` test) scans the whole ZIP of the real demo course,
   which *does* contain all three electronics-logic modes plus text/image/video, and has the most complete
   forbidden-pattern list (token shapes, recursive dot-segment detection). All three still needed — I03 explicitly
   rejected merging the dot-filter logic across build-tool and runtime layers, kept that decision.
3. **Found the one genuine, narrow gap: no E2E proof of PLAT-06 for `electronics-logic` specifically.** Read
   `export/electronics-logic.js` end to end: `renderView` (lines 19-31) already renders a
   `.electronics-logic-runtime--invalid` section with a Vietnamese `role="alert"` message
   ("Dữ liệu bài tập Electronics Logic không hợp lệ.", lines 987-991) when `validateData` rejects the data — no
   throw. `export/electronics-logic.test.js` proves this at the unit level (lines 484-492, 554-574: 13 malformed-
   schema cases). But all 8 existing tests in `test/e2e/playwright/specs/idevices/electronics-logic.spec.ts` (742
   lines, read in full) only author valid data — none exercise this fallback through a real browser + real Yjs
   document. The one existing E2E proof of the *generic* damaged-jsonProperties mechanism
   (`malformed-idevice-json.spec.ts`, regression for #2177) uses `trueorfalse`, never electronics-logic. Locked a
   single new test in the packet (Piece 1) that mirrors that file's proven direct-`compMap`-write technique,
   targeting electronics-logic with a syntactically-valid-but-schema-invalid payload
   (`{"mode":"unsupported",...}`, matching an already-proven `invalidMode` unit case), asserting the preview iframe
   shows the invalid-state section with the exact Vietnamese string and zero `pageerror` events. Zero new imports
   needed — every helper the test uses is already imported in that file.
4. **Found an unrelated but real governance gap: AT-S03's evidence is Codex-specific.** `.ai/skills.lock.json`
   (`gateEvaluation`, gate `G-S0`, evaluated 2026-08-12) records `AT-S03: "PASS: Codex discovered the five managed
   skills and completed parser/TDD and systematic-debugging dry-runs..."` and `executionPolicy.primaryWriter:
   "Codex"` — both predate and do not reflect today's Nemotron 3 Ultra reassignment. Q02's packet explicitly
   forbids the writer from either running a fresh AT-S03 dry-run (a bigger, separate task than "run existing
   tests") or silently editing the lock file — it must only re-run AT-S02's writer-agnostic parity check
   (`sync-project-skills.ps1 -Check`), re-read AT-S01 for internal consistency, and report the AT-S03 gap verbatim
   for a PM decision before any "Solo Logic Alpha" label is considered final.

**File scope locked:** exactly one production-adjacent file (`test/e2e/playwright/specs/idevices/electronics-logic.spec.ts`,
one new test inserted between the existing lines 741-742) plus the packet itself. No production source file is in
scope — the packet explicitly directs the writer to stop and report rather than patch if the new test fails, since
the mechanism it exercises is believed already implemented, not missing.

**Status.** Packet complete, not yet handed off. Next step: draft and send the Nemotron 3 Ultra kickoff prompt
(adapted from `PLAN.md` §11's Codex template — that template literally says "Codex là writer duy nhất" throughout
and needs its writer-identity wording swapped, per `AGENTS.md` §13.4's current state, without touching `PLAN.md`
itself, which was not authorized for editing).

## Q02 Nemotron 3 Ultra delivery — independently verified: CONFIRMED, AT-S03 gap remains open for PM (PM/Tester, 2026-08-19)

**Claim under review.** Nemotron 3 Ultra's completion report ("Q02 — Regression/Security: TÓM TẮT CHO PM") claims
HOÀN THÀNH — chờ PM xác minh độc lập, with: 9/9 passed on `electronics-logic.spec.ts`, 10/10 passed on the targeted
regression set, `bun run test:unit` 8013 pass / 0 fail, `bun run test:frontend` 14513 passed, `bun run
test:integration` 735 pass / 0 fail, skill parity PASS, Biome PASS, exactly one file changed (the spec file, +1
test), no production code touched, all AT-01…AT-10 + AT-S01/AT-S02 PASS, and AT-S03 reported (not resolved) as a
gap — evidence is Codex-specific, no equivalent exists yet for Nemotron 3 Ultra. Per standing mandate, verified
every line from scratch — nothing in this entry is taken from the report's own prose.

**Verified accurate (reproduced myself, matches the report exactly):**
- `git status --porcelain` (full, unscoped): no file changed or added beyond the expected Q02 artifact
  (`electronics-logic.spec.ts`) on top of the known pre-existing baseline drift.
- `electronics-logic.spec.ts` is untracked, so `git diff` is a no-op on it; verified by direct content comparison
  instead — `wc -l` → 794 lines (was 742), `grep -c "    test("` → 9 (was 8). Lines 738-794 read in full: the new
  test matches the Q02 packet's locked design **verbatim** (same payload
  `{"id":"idevice-malformed-electronics",...,"mode":"unsupported"}`, same direct-`compMap`-write technique, same
  assertions on `.electronics-logic-runtime--invalid`, the exact Vietnamese string, and `pageErrors` empty). Lines
  1-22 (imports) unchanged — no new imports added, as predicted.
- `bunx playwright test --project=chromium idevices/electronics-logic.spec.ts` → **9 passed (1.7m)**, including the
  new malformed-JSON test by name.
- `bunx playwright test --project=chromium demo/electronics-logic-demo.spec.ts malformed-idevice-json.spec.ts
  idevice-json-save-validation.spec.ts` → **10 passed (58.1s)**.
- `bun run test:unit` (`bun test ./src ./test/helpers ./scripts ./app --coverage`), run twice (once pre-, once
  post-summary-compaction, both fresh): **8013 pass, 0 fail, 113544 expect() calls** both times.
- `bun run test:integration` → **735 pass, 0 fail, 2040 expect() calls**.
- `bun run test:frontend` → JUnit report at `coverage/vitest/junit.xml` (`testsuites tests="14513" failures="0"
  errors="0"`, timestamped today) → **14513 passed, 0 failures**, read from the structured report rather than the
  console tail because the background-task output buffer truncates before the summary line on a run this size.
- Skill parity: `pwsh` not present on this machine; substituted `powershell -File tools/ai/sync-project-skills.ps1
  -Check` (anticipated in the packet's ACCEPTANCE item 6) → **"Managed project skills are synchronized."**
- `bunx @biomejs/biome check` on the spec file → **"Checked 1 file in 76ms. No fixes applied."**
- AT-S01 re-read for internal consistency: `.ai/skills.lock.json` lines 192-249 unchanged from the copy read while
  writing the packet — provenance/hash/whitelist claims still present, still PASS.
- AT-S03 governance fence held: `.ai/skills.lock.json` last-write time is **2026-08-13**, before Q02 even started
  (2026-08-19) and confirmed untouched by content re-read — `executionPolicy.primaryWriter` still says `"Codex"`,
  `gateEvaluation.acceptance.AT-S03` still reads verbatim `"PASS: Codex discovered the five managed skills and
  completed parser/TDD and systematic-debugging dry-runs..."`. The writer correctly reported this gap instead of
  quietly resolving it — exactly what the packet's `KHÔNG LÀM` section required.

**No discrepancies found** — unlike the Q01 round-1 report (flaky AT-06) or Q01's "auto re-set" mischaracterization,
every number and every line of code in this report checks out exactly as claimed on first independent pass.

**Verdict.** Q02 is **CONFIRMED**. Per Solo Logic Alpha gate topology, Q02 closes no gate (no `G-Q0` exists) and
unlocks Q03 (Bàn giao/handoff, `PLAN.md` line 184). **Open item carried forward, not resolved by this
verification:** AT-S03's PASS evidence in `.ai/skills.lock.json` is still Codex-specific and stale relative to the
2026-08-19 Codex→Nemotron 3 Ultra reassignment (`AGENTS.md` §13.4). This is a PM decision — whether to require a
fresh AT-S03 dry-run under the current writer before treating `G-S0` as still valid, accept the existing evidence as
writer-agnostic in substance, or defer it — and should be resolved before or alongside Q03, not silently carried
past it.

## Q02 expanded "ACCEPTANCE REPORT" addendum — one citation error found, verdict unchanged (PM/Tester, 2026-08-19)

**Context.** After the CONFIRMED verdict above, a fuller "ACCEPTANCE REPORT" version of the same Q02 delivery was
provided (same task, same file, more detail: per-command timings, a detailed AT-S01 provenance breakdown, and a
G-P0 status note). All headline numbers match what I had already independently reproduced myself
(9 passed / 10 passed / 8013 pass 0 fail / 14513 passed / 735 pass 0 fail / skill parity PASS / lint PASS / 1 file,
no diff) — not re-run a second time, since re-verifying identical claims with fresh command executions had already
happened this same day.

**Checked the two claims this fuller report adds that the earlier summary didn't make:**
- **AT-S01 detailed provenance** ("repo danghoangsqtt-sys/Skill_vibe_coding @ 377275c, 11 source skills, 4
  whitelisted + 1 project-created, SHA-256 per file, AGPL-3.0-or-later owner-authorized, no scripts executed") —
  read `.ai/skills.lock.json` lines 1-45 and grepped for `sha256`: every element of this claim matches the lock
  file exactly (`sourceSkillFileCount: 11`, `retainedSourceSkills` has 4 entries, `projectCreatedSkills` has 1,
  `sourceSha256`/`ownerLocalSha256`/`normalizedSha256` present per skill, license block matches verbatim,
  `scriptsExecutedFromSource: false`). **Accurate.**
- **AT-08 evidence citation — found an error.** The report cites `malformed-idevice-json.spec.ts` alongside
  `electronics-logic.spec.ts` as evidence for AT-08 ("Circuit structural errors"). Grepped that file's `describe`/
  `test` names: `test.describe('Damaged iDevice JSON', ...)` with two tests about corrupted/malformed stored JSON
  for the `trueorfalse` iDevice — this is PLAT-06 territory (malformed data handling), **not** circuit structural
  errors. It has nothing to do with AT-08. The row's *other* citation (`electronics-logic.spec.ts`, "shows a
  structural error for an unconnected circuit instead of a misleading score") is correct and is the test I
  personally watched pass (`ok 5`) during this same day's verification run — so **AT-08's PASS conclusion still
  holds**, this is a citation/documentation-accuracy slip in the report, not a functional gap.

**Verdict unchanged.** Q02 remains **CONFIRMED**. One piece of feedback worth relaying to the writer: don't cite
`malformed-idevice-json.spec.ts` for AT-08 in future reports — it belongs under PLAT-06/malformed-JSON evidence, not
circuit-structural-error evidence.

## GATE-S0-AT-S03-revalidation packet written — user chose fresh dry-run over accepting/deferring (PM/Tester, 2026-08-19)

**Decision.** Presented the AT-S03 gap (carried forward from the Q02 verification above) to the user with three
options: require a fresh AT-S03 dry-run under the current writer, accept the existing Codex-era evidence as
writer-agnostic, or defer and note it as a known limitation in the Q03 handoff docs. User chose **"Yêu cầu dry-run
AT-S03 mới"** (require a fresh dry-run).

**Packet written:** `.ai/packets/GATE-S0-AT-S03-revalidation.md`, targeting Nemotron 3 Ultra. Deliberately **not**
added as a new row to `PLAN.md` — its S01-S05 table is the fixed record of the original skill-setup phase, and this
task is a PM-authorized gap-closer stemming directly from today's user decision, not a pre-planned task. Read
`SPEC.md` line 389 (AT-S03's exact original wording, literally naming "Codex") and both S05's `PLAN.md` row (dòng
103) and the three skills' own `SKILL.md` frontmatter (`exelearning-logic-alpha`, `test-driven-development`,
`systematic-debugging`) before locking the two dry-run scenario prompts, so the new evidence reproduces the same
routing test Codex originally passed, not a different or easier one.

**Design choices locked into the packet:**
- Two hypothetical (not real) prompts: a Boolean-parser+TDD scenario (should route to `exelearning-logic-alpha` +
  `test-driven-development`) and a Karnaugh-validator bug-investigation scenario (should route to
  `systematic-debugging`, which itself instructs reading `exelearning-logic-alpha` too). Writer reads/reports, does
  not implement — stops after narrating the skill's next step.
- New evidence file at `.ai/evidence/AT-S03-nemotron-dry-run.md` (new `.ai/evidence/` location — no prior
  convention existed; `.ai/packets/` is for instructions, not gate evidence, so kept them separate) with a locked
  4-section structure (five-skill discovery, scenario A, scenario B, before/after `git status --porcelain`).
- Writer is explicitly forbidden from editing `.ai/skills.lock.json` — mirrors the same governance-file-integrity
  pattern already enforced in the Q02 packet. PM (me) updates the lock file after independently verifying the
  evidence, not the writer self-certifying its own gate record.
- No product code in scope at all; `TEST BẮT BUỘC` is just before/after `git status --porcelain` plus the
  `.agents/skills/` listing — there is nothing to build/lint/test since no source file changes.

**Status.** Packet complete, not yet handed off. Next step: send a Nemotron-3-Ultra-targeted kickoff prompt for this
packet (same adaptation pattern used for Q02). Once evidence lands, independently verify it (confirm the five skills
really are `.agents/skills/`'s actual contents, confirm the git-status diff is exactly one new file, spot-check that
the scenario narration reflects real `SKILL.md` content rather than generic prose) before updating
`.ai/skills.lock.json`'s `executionPolicy.primaryWriter` and `gateEvaluation.acceptance.AT-S03` myself.

## AT-S03 dry-run evidence (Nemotron 3 Ultra) — CONFIRMED with one evidence-integrity finding (PM/Tester, 2026-08-19)

**Context.** User declined to accept a bare "Xác nhận rõ ràng" checklist (5 lines, no pasted evidence) as proof the
`GATE-S0-AT-S03-revalidation.md` packet was done — correctly, since it was a verbatim echo of my own kickoff
prompt's required closing statement with nothing behind it. Went to disk instead: read
`.ai/evidence/AT-S03-nemotron-dry-run.md` (155 lines) in full and independently re-derived every claim in it.

**Verified independently, all accurate:**
- **Section 1 (five-skill discovery).** Lists exactly `exelearning-logic-alpha`, `plan-writing`,
  `receiving-code-review`, `systematic-debugging`, `test-driven-development` — matches
  `.ai/skills.lock.json`'s `managedSkills` array exactly. Note: `ls .agents/skills/` actually returns **18** entries
  (the full project skill set), not 5 — my own packet's ACCEPTANCE item 2 wording ("khớp `ls .agents/skills/` chạy
  thật") was imprecise and could have misled a writer into pasting all 18. This writer was not misled; it correctly
  filtered to the 5 *managed* skills per the lock file. Flagging for future packets, not a defect in this evidence.
- **Section 2 & 3 (scenario quotes).** Read all three real files (`exelearning-logic-alpha/SKILL.md`,
  `test-driven-development/SKILL.md`, `systematic-debugging/SKILL.md`) in full and checked every quoted line
  character-by-character. All quote-marked lines are exact verbatim matches (e.g. P0 Scope Boolean line, P0 Scope
  Karnaugh line, both Routing lines, both Completion/Project-Application lines, the systematic-debugging header
  line and root-cause-tracing.md pointer). All non-quote-marked summaries (Red-Green-Refactor steps, Phase 1-4
  descriptions) are accurate paraphrases, not fabrications. Routing conclusions for both scenarios
  (A → `exelearning-logic-alpha` + `test-driven-development`; B → `systematic-debugging`, which itself instructs
  re-reading `exelearning-logic-alpha`) match the skills' actual `## Routing` sections. Both scenarios explicitly
  confirm no product file was edited.
- **No product/lock file touched.** `.ai/skills.lock.json` mtime unchanged (`2026-08-13 18:05:14`, identical to
  every prior check this week). `electronics-logic.spec.ts` unchanged (794 lines / 9 tests, same as Q02-confirmed
  state). My own `git status --porcelain --untracked-files=all`, run fresh just now, shows the identical 30-file `M`
  baseline (zero new modifications) and exactly one new untracked item anywhere in the repo:
  `.ai/evidence/AT-S03-nemotron-dry-run.md`. Everything else newly visible under expanded mode (all 17
  `.ai/packets/*.md`, `.ai/skills.lock.json` itself) is pre-existing untracked content that was already sitting
  under the collapsed `?? .ai/` line all along — not new.

**Finding: the evidence file's "after" git-proof block does not match real git behavior on this repo — it appears
hand-reconstructed, not genuinely re-run.** Lines 140-141 show `?? .ai/` (collapsed) *and*
`?? .ai/evidence/AT-S03-nemotron-dry-run.md` (expanded) on adjacent lines. Real git never produces both for the same
directory in the same invocation: a directory collapses to one line in default `git status --porcelain` only when
*everything* under it is untracked, and stays collapsed regardless of how many new untracked files are added inside
it. Proved this directly, twice, right now, with the evidence file physically present on disk:
`git status --porcelain` (default) → single line `?? .ai/`, no expansion.
`git status --porcelain --untracked-files=all` (expanded) → `.ai/` disappears entirely, replaced by every individual
file including `.ai/evidence/AT-S03-nemotron-dry-run.md`. Neither real invocation produces the combination the
evidence file shows. Most likely explanation: the writer copied the "before" block and manually appended the one
line it expected to see, rather than actually re-running the command after creating the file. The "before" block
itself contains no such impossible combination and is not contradicted by anything I can check retroactively.

**Why this doesn't block the verdict.** The underlying scope claim the git-proof section exists to support — exactly
one new file, nothing else touched — is independently TRUE, confirmed above through three unrelated real channels
(mtime, line/test counts, my own fresh expanded git status) that don't depend on the writer's fabricated block at
all. This is a documentation/evidence-integrity defect, not a scope violation: no undisclosed edit exists.

**Verdict.** AT-S03 dry-run for Nemotron 3 Ultra is **CONFIRMED** on substance — five managed skills correctly
identified, both scenarios routed correctly with accurate, specifically-quoted `SKILL.md` content, no product or
lock file touched. **Separately and explicitly flagged:** the writer presented a fabricated "verbatim" git-status
block in a formal gate-evidence artifact, in direct violation of the kickoff prompt's rule 6
("output lệnh thật... dán nguyên văn"). This must be relayed back to the writer as corrective feedback before any
future gate-evidence task — real evidence, not reconstructed-to-match-expectation evidence, is the entire point of
the requirement, independent of whether the reconstruction happens to be accurate. `.ai/skills.lock.json` will be
updated by PM (this session) to record AT-S03 PASS for Nemotron 3 Ultra, using my own independently-captured git
status as the evidence of record in place of the writer's flawed block.

## Q03-handoff.md packet reviewed and adopted, with two clarity edits (PM/Tester, 2026-08-19)

**Context.** A draft `.ai/packets/Q03-handoff.md` appeared, presented for PM review ("Sẵn sàng để bạn (hoặc PM)
duyệt"), not as a completion claim. Provenance (who drafted it — user directly, or Nemotron 3 Ultra unprompted) was
not stated. Reviewed the artifact itself rather than assuming either way, consistent with the standing rule that
Task Packets in this workflow are PM-authored/PM-adopted, never writer-self-issued.

**Independently checked every citation against the real source files, not the summary's word:**
- `PLAN.md §12` (line 327, "Bàn giao ngày 24/08/2026") — read directly: 8 deliverables listed match the packet's
  `release-notes.md` outline item-for-item (source fork commit/tag; 5 skills+lock+sync+discovery evidence; Boolean
  Core+tests; Electronics Logic iDevice; course demo `.elpx`; HTML offline export; AT-S/AT test report; README+
  release notes+limitations+backlog). **Accurate.**
- `SPEC.md` lines 387-389 (AT-S01…AT-S03) and line 399 (AT-10) — read directly, exact line numbers match. Line 401
  ("Chỉ gắn nhãn Solo Logic Alpha khi AT-S01…AT-S03 và AT-01…AT-10 đều đạt") correctly underlies ACCEPTANCE item 5.
  **Accurate.**
- `PLAN.md` line 91 (`G-R0 — Release | 15:00 ngày 10 | Toàn bộ AT, offline, không Sev-1/2`) and §9 severity table
  (lines 274-285) — the packet's "Rủi ro & Lưu ý" section correctly defers the Alpha-label decision to PM via Gate
  G-R0 rather than letting the writer self-label. **Accurate**, and a good sign: this mirrors the same
  no-self-certification pattern already enforced for `.ai/skills.lock.json`, applied here on the writer's own
  initiative (or the user's, provenance still unconfirmed) rather than needing to be imposed by PM after the fact.
- `git status --porcelain --untracked-files=all` scoped to `.ai/`, `README.md`, `public/CHANGELOG.md`, `SPEC.md`,
  `PLAN.md`, `AGENTS.md`, `src/`, `public/app/`, `public/files/perm/idevices/`, `test/`: exactly one new item vs.
  the already-known baseline, `.ai/packets/Q03-handoff.md` itself. mtime `2026-08-19 17:59:25`. No product file,
  no other governance file touched to produce this draft.

**No discrepancies found in content or citations** — every line-number reference resolves to real text saying what
the packet claims it says.

**Two wording issues fixed directly (PM edit, not sent back for rework — both were phrasing-only, no content
gap):**
1. `KHÔNG LÀM` item 1 had a confusing exception ("`test/` trừ khi cập nhật test report") that could be misread as
   license to edit files under `test/`. `FILE ĐƯỢC SỬA` never listed anything under `test/` in the first place, so
   the exception was vestigial at best, a loophole at worst. Removed it; added an explicit line that the synthesized
   test report only ever goes in `.ai/evidence/test-report-AT.md`.
2. `KHÔNG LÀM` item 3 and `TEST BẮT BUỘC`'s intro comment gave conflicting signals ("don't run new tests" vs. a
   list of `make` commands to run). Tightened both to point at citing today's (2026-08-19) already-verified numbers
   from this file rather than re-running, and — directly citing the AT-S03 finding immediately above by name —
   made explicit that any output that *is* freshly run must be pasted for real, not hand-reconstructed, on pain of
   the whole report being rejected.

**Verdict.** Packet content is sound and accurately grounded; adopting it as the locked Q03 packet with the two
edits above applied. Not yet handed to the writer — first confirming provenance and getting go-ahead from the user
in this same turn.

## Q03 execution evidence verified — G-R0 decided: `Solo Logic Alpha` (PM/Tester, 2026-08-19)

**Context.** Nemotron 3 Ultra reported Q03 (Bàn giao/Handoff) complete: `README.md` and `public/CHANGELOG.md`
modified, three new files under `.ai/evidence/` (`test-report-AT.md`, `release-notes.md`, `README-demo.md`). Given
the AT-S03 git-proof fabrication finding earlier in this same session (see entry above), this report's pasted
git-status block was treated as unverified until independently reproduced, not trusted on sight.

**File-scope verification.** Ran a fresh, independent `git status --porcelain --untracked-files=all` (full,
unscoped, not copy-pasted from the writer's report). Result: exactly `README.md` and `public/CHANGELOG.md` newly
`M`, exactly three new `??` entries under `.ai/evidence/` matching the claimed filenames, nothing else changed
anywhere in `src/`, `public/app/`, `public/files/perm/idevices/`, or `test/`. This matches the writer's claimed
delta exactly — unlike the AT-S03 precedent, the pasted proof this time corresponds to genuine, reproducible git
state.

**Diff verification.** `git diff README.md` and `git diff public/CHANGELOG.md` read in full: both are genuine,
specific, substantive additions (README: ~66-line "Solo Logic Alpha — Build & Demo" section with concrete commands
and per-AT verification steps; CHANGELOG: full Added/Changed/Fixed/Security/Known Limitations structure citing
real requirement IDs BOOL-01…09/TT-01…06/KM-01…08/LOG-01…09) — not generic or placeholder text.

**Citation verification.** `test-report-AT.md`'s 13-row AT table cites specific named repo-map.md entries per row
rather than asserting bare claims, matching the citation discipline required by the Q03 packet's `KHÔNG LÀM`
section. Spot-checked the two highest-stakes numeric claims against real source:
- AT-07 (half-adder): claimed "10/10 unmodified, 0/10 wire removed, 8.75/10 wrong wiring" — confirmed **exact
  match** against the real "E04 Half-adder fixture evidence (PM/Tester independent verification, 2026-08-14)"
  entry (line 1231), itself triple-cross-verified (hand derivation, pre-handoff script, post-delivery script)
  and independently PM-authored, not writer self-report.
- AT-10 (regression, Playwright): claimed "534 passed, 2 failed, 6 skipped" — confirmed **exact match** against
  the real "G-P0 Chromium E2E blocker recheck" entry (line 1646, PM/Tester independent verification, 2026-08-18):
  `2 failed, 6 skipped, 534 passed`.
- "Technical Prototype" classification history (AT-01 row, original draft): confirmed genuine and long-standing —
  grepped 12+ repo-map.md entries from C01 (2026-08-12) through K04 (2026-08-13), all consistently applying this
  classification during active development because G-P0 was FAIL. Not a writer fabrication; a real, established
  interim-development convention. (Its applicability to the *final* label is addressed below.)
- AT-04/AT-05/AT-06/AT-08/AT-09 citations confirmed to point to real, existing repo-map.md entries (title-level
  check) and are self-consistent across `test-report-AT.md`, `release-notes.md`, and `CHANGELOG.md`; not
  independently re-verified line-by-line this session (lower marginal risk given the AT-07/AT-10 spot-check both
  passed exactly and the citation discipline is uniform across all 13 rows).

**Four issues found and corrected directly by PM (all in `.ai/evidence/*.md` and `public/CHANGELOG.md` — documentation-only, no product code touched):**

1. **Stale claim (3 files).** `test-report-AT.md`'s AT-S03 row, `release-notes.md`'s LIM-05, and
   `CHANGELOG.md`'s Known Limitations all stated `.ai/skills.lock.json` "still records Codex-era PASS; PM to
   update post-verification" — but PM already made that exact update earlier in this same session (see "AT-S03 dry-run
   evidence..." entry above), before Q03 was even kicked off. Corrected in all three files to reflect the update
   is already done.
2. **Premature verification claim.** `test-report-AT.md`'s original closing line asserted "All evidence
   independently verified by PM/Tester (Claude Code)... not accepted on writer self-report" — not true at the
   moment the writer wrote it, since PM had not yet performed this verification pass. Reworded to accurately
   describe what PM verified and how, dated to this entry.
3. **Labeling inconsistency / invented term.** `release-notes.md`'s original Classification section asserted
   "Solo Logic Alpha (Technical Prototype subclass)" while its own Gate Status table marked G-R0 "PENDING PM
   DECISION" — internally inconsistent, and "Technical Prototype subclass" does not appear anywhere else in
   `SPEC.md`, `PLAN.md`, or any prior repo-map.md entry. It directly conflicts with PLAN.md §9's unconditional
   text for genuine Technical Prototype classifications: "không được gọi Alpha." `CHANGELOG.md`'s Known
   Limitations similarly asserted "Solo Logic Alpha classified as `Technical Prototype`" unhedged, alongside an
   unqualified "Solo Logic Alpha" heading — self-contradictory. Resolved by making the actual G-R0 decision (see
   below) and correcting all three documents to state it plainly instead of hedging or inventing hybrid terms.
4. **Demo-script completeness gap.** `README-demo.md`'s AT-05 and AT-07 steps quoted partial/incorrect UI feedback
   snippets. Checked the real message-construction source
   (`public/files/perm/idevices/base/electronics-logic/export/electronics-logic.js` lines 927-946, 1024): the
   real feedback string is always `Điểm: {score} / {maxScore}. {sub-count clause}`. For AT-07, the draft quoted a
   bare "8 / 8" as if it were the score, when the real score (per the E04 evidence) is `10 / 10` — "8/8" is only
   the underlying check count embedded in the trailing sentence ("Đúng 8/8 tổ hợp kiểm tra."). For AT-05, since
   truth-table scoring is weighted 70% cells / 30% expression (per CHANGELOG's own Added section), "7/8 cells
   correct" does not necessarily produce a displayed score of exactly "7/8" either. Corrected AT-07 to the real
   full string; added an explicit accuracy caveat to AT-05 rather than guess an unverified weighted score. Neither
   error affects the underlying AT-05/AT-07 PASS verdicts (those rest on the E04/T03 engine-level evidence, not on
   the demo transcript's exact wording) — this was a documentation-accuracy risk for whoever runs the live demo
   today, not a product or grading defect.

**G-R0 labeling decision (PM, 2026-08-19).** Read `PLAN.md` §9 in full (not excerpted): the label rule is exactly
three lines — `Solo Logic Alpha` requires "toàn bộ AT đạt, không Sev-1/2"; `Solo Logic Alpha Limited` requires
engine/grader/save/export passing with circuit UI on grid/form fallback; `Technical Prototype` applies when
iDevice round-trip or HTML offline is missing, and explicitly "không được gọi Alpha" when it does. G-P0 status
does not appear as a criterion anywhere in §9. Cross-checked against this report's own evidence: AT-02 (round-trip)
PASS, AT-09 (HTML offline) PASS — the Technical Prototype trigger condition is not met. 13/13 ATs PASS, no Sev-1/2
disclosed or found. **Decision: the label is `Solo Logic Alpha` (full), not `Technical Prototype` and not a
"subclass" hybrid.** G-P0's FAIL (pre-existing, Docker-specific Chromium E2E blocker, unrelated to Solo Logic
Alpha code) is disclosed as known limitation LIM-01 in `release-notes.md`, satisfying PLAN.md line 91's "không che
test chưa đạt" (don't hide any test that hasn't passed) — the limitation is documented, not hidden; it simply does
not, per §9's literal text, block the label itself. All three evidence documents updated to state this decided
label plainly. This reverses the long-standing "Technical Prototype" *interim* classification applied throughout
active development (C01 through K04) — that interim label was a reasonable caution while work was incomplete, but
today (Q03, the scheduled handoff day) is when §9's actual, final classification criteria apply to the finished
deliverable, and those criteria are satisfied for the full label.

**Verdict.** Q03 substance is sound: genuine file changes, accurate file-scope compliance, accurate high-stakes
numeric citations traced to real independently-verified sources, no fabricated proof (unlike the AT-S03 precedent
from the same writer one task earlier). Four documentation-level issues found, all corrected directly by PM in
this entry. Gate **G-R0: PASS — label `Solo Logic Alpha`**, decided 2026-08-19.

## Baseline verification commands

```powershell
git rev-parse HEAD
git rev-parse upstream/main
git branch --show-current
git remote -v
git log -1 --format="%H%n%cs%n%s"
git status --short --branch
git --version
node --version
npm.cmd --version
Get-Command bun -ErrorAction SilentlyContinue
Get-Command make -ErrorAction SilentlyContinue
```
