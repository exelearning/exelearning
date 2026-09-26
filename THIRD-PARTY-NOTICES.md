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
- **License:** MIT. The upstream repository ships no separate `LICENSE`
  file; the grant is the statement `MIT-style license:
  http://pipwerks.mit-license.org/` carried by the file header (kept intact
  inside the vendored copy), by the repository `readme.md` and by its
  `package.json` `license` field, where <http://pipwerks.mit-license.org/>
  renders the standard MIT licence text in pipwerks' name.
- **Usage:** shipped unmodified inside exported SCORM 1.2 packages as
  `libs/SCORM_API_wrapper.js`. The eXeLearning-specific behavior lives in the
  separate project-owned runtime under `public/app/common/scorm/scorm12/`
  (AGPL-3.0-or-later), which wraps and additively extends the wrapper at
  runtime without modifying this file.
- **Verification:** the unit suite asserts that the SCORM 1.2 export pipeline
  ships this file byte-identical to the vendored copy
  (`src/shared/export/utils/Scorm12Runtime.spec.ts`).

## jsPDF

- **Path:** `public/files/perm/idevices/base/{checklist,progress-report,rubric}/export/jspdf/jspdf.umd.min.js`
  (one copy per iDevice, like `html2canvas.js`, because each iDevice export
  folder is copied as a unit into exported packages; kept in a `jspdf/`
  subfolder because the server-side exporter adds a `<script>` tag for every
  top-level `.js` file there, and jsPDF must only load when a PDF is requested)
- **Upstream:** <https://github.com/parallax/jsPDF> (npm `jspdf@4.2.1`, `dist/jspdf.umd.min.js`)
- **Version:** 4.2.1
- **Retrieved:** 2026-09-26
- **SHA-256:** `e6551fcdc32f09d6853b2c5126d18d01d9447e0da618a41a11ebeee0f6c20d54`
- **License:** MIT
- **Usage:** lazy-loaded from the iDevice folder when the user saves a
  checklist, progress report or rubric as PDF. Replaces the former unpinned
  jsDelivr load so no executable code is fetched from a remote server.

## Draco decoder (for model-viewer)

- **Path:** `public/files/perm/idevices/base/three-d-viewer/export/draco/`
  (`draco_wasm_wrapper.js`, `draco_decoder.wasm`)
- **Upstream:** <https://github.com/google/draco>, retrieved from the exact
  location model-viewer uses by default,
  `https://www.gstatic.com/draco/versioned/decoders/1.5.6/`
- **Version:** 1.5.6
- **Retrieved:** 2026-09-26
- **SHA-256:**
  - `draco_wasm_wrapper.js`: `e8049906ef3f8f75d3456c22a3f31bfdfe5b5b5bd09ccdec613b9e9a49d554d8`
  - `draco_decoder.wasm`: `c55a594e8ffd18426d36b27fea9618af3df5e173640a3e56d46f09d76f0574f2`
- **License:** Apache-2.0
- **Usage:** `model-viewer-decoders.js` points model-viewer's
  `dracoDecoderLocation` here, so Draco-compressed glTF/GLB models decode
  offline. The asm.js fallback (`draco_decoder.js`, only used by browsers
  without WebAssembly) is not shipped; such browsers fail closed.

## Basis Universal transcoder (for model-viewer)

- **Path:** `public/files/perm/idevices/base/three-d-viewer/export/basis/`
  (`basis_transcoder.js`, `basis_transcoder.wasm`)
- **Upstream:** <https://github.com/BinomialLLC/basis_universal>, retrieved
  from the exact location model-viewer uses by default,
  `https://www.gstatic.com/basis-universal/versioned/2021-04-15-ba1c3e4/`
- **Version:** build `2021-04-15-ba1c3e4`
- **Retrieved:** 2026-09-26
- **SHA-256:**
  - `basis_transcoder.js`: `48a0ef319a28bf0224ee88ded34f74eaf97c175bba9eb18b47fb9720510ad6c4`
  - `basis_transcoder.wasm`: `79ae97d781e10a566659c689b7bb1de91726453f55f9f5e3bcc07a4e3904070f`
- **License:** Apache-2.0
- **Usage:** `model-viewer-decoders.js` points model-viewer's
  `ktx2TranscoderLocation` here, so models with KTX2 textures load offline.

## FluidR3_GM acoustic grand piano samples (for abcjs)

- **Path:** `public/libs/abcjs/soundfont/acoustic_grand_piano-mp3/` (88 MP3 files, A0 to C8)
- **Upstream:** <https://github.com/gleitz/midi-js-soundfonts> (`FluidR3_GM/acoustic_grand_piano-mp3`),
  retrieved from the abcjs default location
  `https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/`
- **Retrieved:** 2026-09-26
- **SHA-256** of the 88 files concatenated in `ls` order: `e96969dbf4a519b0053f8c42fb764519a368368943a93ebf7373d8620ba6fda7`
- **License:** MIT (the midi-js-soundfonts repository and the Fluid R3 GM
  SoundFont by Frank Wen)
- **Usage:** `exe_abc_music.js` passes this folder as abcjs's `soundFontUrl`
  so ABC notation plays offline. Only the piano (General MIDI program 0, the
  default) is bundled; tunes that select another instrument with
  `%%MIDI program` render and export MIDI but play no audio.
