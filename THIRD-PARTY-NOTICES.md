# Third-party notices

This file records third-party components vendored into this repository
(copied verbatim rather than installed from a package manager), their exact
origin and their licenses. Vendored files must **never** be edited locally:
fix issues upstream and re-vendor, or wrap the file from project-owned code.
Each entry records the exact upstream commit so the copy can be verified
byte-for-byte.

## pipwerks SCORM API Wrapper (JavaScript)

- **Path:** `public/app/common/scorm/scorm12/vendor/pipwerks/SCORM_API_wrapper.js`
- **Upstream:** <https://github.com/pipwerks/scorm-api-wrapper>
  (`src/JavaScript/SCORM_API_wrapper.js`)
- **Version:** 1.1.20180906
- **Commit:** `82e455b4032ee08febf64d2fa2bf1aacaebaa446` (master, 2018-09-07)
- **Retrieved:** 2026-07-24
- **SHA-256:** `f2a558ba284edbc6842edf51678df1f7e3e05cbf09ec00bc6dd5988b6caa2e78`
- **License:** MIT (header kept intact inside the file; see
  <http://pipwerks.mit-license.org/>)
- **Usage:** shipped unmodified inside exported SCORM 1.2 packages as
  `libs/SCORM_API_wrapper.js`. The eXeLearning-specific behavior lives in the
  separate project-owned runtime under `public/app/common/scorm/scorm12/`
  (AGPL-3.0-or-later), which wraps and additively extends the wrapper at
  runtime without modifying this file.
- **Verification:** the unit suite asserts that the SCORM 1.2 export pipeline
  ships this file byte-identical to the vendored copy
  (`src/shared/export/utils/Scorm12Runtime.spec.ts`).
