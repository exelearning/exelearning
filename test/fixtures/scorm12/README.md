# SCORM 1.2 resume-race fixture

`resume-race.scorm.zip` is a compact SCORM 1.2 package that registers a quiz on
`DOMContentLoaded` (the same moment game iDevices call `registerActivity`) and
then runs `loadPage()` from `body onload`.

It exists so a resumed attempt can be checked without opening the workarea:
the LMS seed is `cmi.core.score.raw=80` plus an `exe12/` payload, and the SCO
must not overwrite that score with `0`.

Regenerate after runtime changes:

```bash
bun test test/helpers/scorm12-resume-package.spec.ts
```

Against a live alpine-moodle (for example the `mod_exelearning` compose on http://localhost):

```bash
MOODLE_URL=http://localhost MOODLE_USERNAME=user MOODLE_PASSWORD=1234 \
  bun x playwright test --project=chromium test/e2e/playwright/specs/scorm12-moodle.spec.ts
```
