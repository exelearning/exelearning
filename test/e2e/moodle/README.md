# Live-LMS grading harness

A real Moodle, in Docker, that grades packages this repository exported — so a claim about
what an LMS records can be produced by measurement rather than by reading the SCORM
specification.

This is not part of `make test-e2e`. `playwright.config.ts` only picks up
`test/e2e/playwright/specs`; the lanes here live in `specs-moodle` and run from
`playwright.moodle.config.ts`, which declares no `webServer` because the LMS is external
by definition — starting one from a test run would hide which instance the results came
from.

## What it can answer

- what a package sends the LMS on entry, page by page, with no interaction at all;
- what it sends once every gradable iDevice has been played with a fixed click script;
- what Moodle then stores (`scorm_scoes_value` / `exescorm_scoes_track`) and what value
  lands in the gradebook, per grading method;
- whether two runtimes, two browsers or two hosts differ — the lanes write one JSON per
  run, so any two are directly comparable.

## Setup

```bash
cd test/e2e/moodle
docker compose -p scormaudit up -d
docker exec scormaudit-moodle-1 php /var/www/html/scormaudit/setup.php   # course + learners
```

`setup.php` creates the course and the learner accounts the lanes use. Packages are read
from `./packages`, which is mounted into the container at `/var/www/packages`: put the
exported ZIPs you want graded there.

To grade with `mod_exescorm` as well, clone `exelearning/mod_exescorm` into
`./plugins/exescorm` before starting the stack.

## Running a lane

```bash
# from the repository root
AUDIT_ROOT=$PWD/test-results/moodle-harness \
MOODLE_BASE_URL=http://localhost:8097 \
  bun x playwright test -c playwright.moodle.config.ts --project=chromium specs-moodle/probe.spec.ts
```

`probe.spec.ts` first: it proves login, the player URL, the iframe and the API
instrumentation all work, so a later failure is about grading and not about plumbing.
It opens an activity you create by hand — run `add_activity.php` once (see the docblock
in the spec for the exact command) and save its JSON output as
`$AUDIT_ACTIVITY_DIR/probe-scorm.json`; without that file the probe skips and says so.

Two engines are configured, `chromium` and `firefox`. Run both when the change touches the
end-of-session path: `pagehide`, `visibilitychange` and the back/forward cache do not fire
on the same schedule in Gecko as in Chromium, and a grading result that only holds in one
engine is not a grading result. Evidence from the default engine keeps its plain file name;
any other engine tags its own (`walk-main.firefox.json`), so runs never overwrite each
other.

## The scenario catalogue and its packages

Four lanes — `scorm-grading-matrix`, `package-oracles`, `exelearning-serving-matrix` and
`exelearning-matrix` — replay the **declared scenarios**
(`test/helpers/grading-scenarios.ts`, the single source shared with the integration spec
and the recorder). They read three things from `$AUDIT_ROOT`, which the producer script
writes with the real exporters:

```bash
# from the repository root; --root defaults to $AUDIT_ROOT or test-results/moodle-harness
AUDIT_ROOT=$PWD/test-results/moodle-harness \
  bun run scripts/build-grading-catalogue.ts --producer=main --formats=scorm12,html5,elpx
```

This writes, under `$AUDIT_ROOT`:

- `scenarios/catalogue.json` — every declared scenario, with its hand-authored oracle;
- `packages/main/manifest-main.json` — the `head`, the per-scenario `sha256`, the SCORM
  runtime digests and the page lists the lanes record;
- `packages/main/<id>-main-<format>.zip` — one package per scenario. Scenarios that share
  a project (M3 and its control M3C) get identical bytes under their own names, because
  every lane addresses a package by scenario id.

Run the producer once per revision under test (`--producer=main`, `--producer=2209`, …);
the `producer` axis of the matrix lanes selects which set is graded. To grade with a
container-based host (`scorm-grading-matrix`'s `mod_scorm` / `mod_exescorm`), also stage
those zips where the container reads them:

```bash
cp $AUDIT_ROOT/packages/main/*.zip test/e2e/moodle/packages/
```

A lane whose catalogue is not staged **skips itself** with the command above rather than
failing at import.

**Not produced by this repository:** the `allidevices-{main,2209,2209fix}-scorm12.zip`
packages the `all-idevices-*.spec.ts` lanes consume. They are exported from a real
33-iDevice project (`todos-los-idevices`) by each revision's own exporter, not from a
scenario this repository declares, and the `2209fix` label is a worktree with the audit's
fixes applied — there is no spec to generate them. Stage them into
`test/e2e/moodle/packages/` by hand when running those lanes.

## Environment

| variable | default | what it selects |
|---|---|---|
| `MOODLE_BASE_URL` | `http://localhost:8097` | the LMS under test |
| `AUDIT_ROOT` | `test-results/moodle-harness` | where evidence JSON is written |
| `AUDIT_ACTIVITY_DIR` | `$AUDIT_ROOT/activities` | activity descriptors written by `add_activity.php` |
| `AUDIT_MOODLE_CONTAINER` | `scormaudit-moodle-1` | container the CLI helpers exec into |
| `AUDIT_MOODLE_CLI_DIR` | `/var/www/html/scormaudit` | where `cli/` is mounted inside it |
| `AUDIT_PASSWORD` | `Audit#1234` | the learner accounts' password |
| `AUDIT_PRODUCERS` | every producer in the spec | restrict a lane to some producers |

## The mod_exelearning lane

The lanes above measure a package inside an LMS's own SCORM player. `exelearning-live`
measures the eXeLearning **plugin**, which serves the content itself, injects its own copy
of the runtime and bridges scores to its own endpoint — a path no SCORM lane touches.

It needs a Moodle with `mod_exelearning` installed. Point the harness at it and provision
the course:

```bash
docker exec <container> php /var/www/html/exeaudit/setup_exe.php
EXE_BASE_URL=http://localhost:8096 EXE_MOODLE_CONTAINER=exeaudit-moodle-1 \
  bun x playwright test -c playwright.moodle.config.ts --project=chromium \
    specs-moodle/exelearning-live.spec.ts
```

| variable | default | what it selects |
|---|---|---|
| `EXE_BASE_URL` | `http://localhost:8096` | the Moodle running the plugin |
| `EXE_MOODLE_CONTAINER` | `exeaudit-moodle-1` | container for `add_exelearning.php` / `read_exelearning_state.php` |
| `EXE_MOODLE_CLI_DIR` | `/var/www/html/exeaudit` | where those two are mounted inside it |
| `EXE_FIXTURE_DIR` | the plugin's `research/fixtures/elpx` | ELPX packages to build activities from |
| `EXE_SCORM_PACKAGE` | `/var/www/moodledata/audit/scorm12-upload.zip` | a SCORM 1.2 zip, to check the plugin still installs exactly one runtime. Stage it with `docker cp <zip> <container>:/var/www/moodledata/audit/scorm12-upload.zip`; the test fails with that instruction rather than skipping |

What it asserts, all read back from Moodle rather than from the browser: exactly one copy
of the runtime is served (in both serving models); the per-iDevice grade model publishes
the answered iDevice's own column and no overall column; the overall model publishes one
aggregated column instead; and with grading switched off the plugin records nothing at
all — no attempt row, no grade.

## The CLI helpers

`cli/` is mounted into the container and runs inside Moodle's bootstrap, so the harness
never has to drive the admin UI to create an activity:

- `setup.php` — course, learner accounts, enrolments;
- `add_activity.php` — create one `mod_scorm` (or `mod_exescorm`) activity from a package
  in `/var/www/packages`, and print its cmid and its SCO list as JSON;
- `read_state.php` — dump the tracking rows and the gradebook value for one learner;
- `setup_exe.php`, `add_exelearning.php`, `read_exelearning_state.php` — the same three
  jobs for the mod_exelearning lane, against the plugin's own tables.

Everything they print is JSON, so a lane records the LMS's own state next to the API
traffic it captured in the browser.
