# iDevice Catalog

This document is the authoritative reference for all iDevice types available in eXeLearning. Each entry lists the modern type name used in `content.xml`, the display title, the category, and known legacy aliases accepted on import. Descriptions are written for authors and integrators who need to understand what each iDevice does without reading source code.

See also:
- [patterns.md](patterns.md) — how each iDevice stores its state in `content.xml`
- [config-xml.md](config-xml.md) — schema for the per-iDevice `config.xml` metadata file

---

## Master Table

| type | Title | Category | downloadable | api-version | component-type | Legacy aliases |
|------|-------|----------|-------------|-------------|----------------|----------------|
| `text` | Text | Information and presentation | 0 | 3.0 | json | `FreeTextIdevice`, `FreeTextfpdIdevice`, `ReflectionIdevice`, `ReflectionfpdIdevice`, `GenericIdevice`, `SolvedExerciseIdevice`, `WikipediaIdevice`, `RssIdevice` |
| `casestudy` | Case study | Information and presentation | 0 | 3.0 | json | `CaseStudyIdevice`, `CasopracticofpdIdevice` |
| `image-gallery` | Image gallery | Information and presentation | 0 | 3.0 | json | `ImageGalleryIdevice`, `GalleryIdevice` |
| `magnifier` | Magnifier | Information and presentation | 0 | 3.0 | json | `ImageMagnifierIdevice` |
| `external-website` | External website | Information and presentation | 0 | — | — | `ExternalUrlIdevice` |
| `download-source-file` | Download source file | Information and presentation | 0 | — | — | `FileAttachIdevice`, `FileAttachIdeviceInc`, `AttachmentIdevice` |
| `digcompedu` | DigCompEdu | Information and presentation | 0 | 3.0 | json | — |
| `map` | Map | Information and presentation | 0 | — | — | — |
| `udl-content` | UDL Content | Information and presentation | 0 | — | — | — |
| `example` | Example | Information and presentation | 1 | 3.0 | json | — |
| `trueorfalse` | True or false | Assessment and tracking | 0 | 3.0 | json | `TrueFalseIdevice`, `VerdaderoFalsoFPDIdevice`, `VerdaderofalsofpdIdevice` |
| `quick-questions` | Test | Assessment and tracking | 0 | — | — | `QuizTestIdevice`, `ScormTestIdevice` |
| `quick-questions-multiple-choice` | Select | Assessment and tracking | 0 | — | — | `MultichoiceIdevice`, `EleccionmultiplefpdIdevice` |
| `quick-questions-video` | Video test | Assessment and tracking | 0 | — | — | — |
| `interactive-video` | Interactive video | Assessment and tracking | 0 | — | — | — |
| `form` | Form | Assessment and tracking | 0 | 3.0 | json | `ClozeIdevice`, `ClozeActivityIdevice`, `ClozeLanguageIdevice`, `ClozeLangIdevice`, `MultiSelectIdevice`, `SeleccionmultiplefpdIdevice`, `ClozefpdIdevice`, `ClozelangfpdIdevice` |
| `guess` | Guess | Assessment and tracking | 0 | — | — | — |
| `checklist` | Checklist | Assessment and tracking | 0 | — | — | — |
| `rubric` | Rubric | Assessment and tracking | 0 | — | — | — |
| `select-media-files` | Select media files | Assessment and tracking | 0 | — | — | — |
| `progress-report` | Progress report | Assessment and tracking | 0 | — | — | — |
| `beforeafter` | Before/After | Interactive activities | 0 | — | — | — |
| `classify` | Classify | Interactive activities | 0 | — | — | — |
| `complete` | Complete | Interactive activities | 0 | — | — | — |
| `dragdrop` | Drag and drop | Interactive activities | 0 | — | — | — |
| `flipcards` | Memory cards | Interactive activities | 0 | — | — | — |
| `identify` | Identify | Interactive activities | 0 | — | — | — |
| `relate` | Relate | Interactive activities | 0 | — | — | — |
| `scrambled-list` | Scrambled list | Interactive activities | 0 | 3.0 | json | — |
| `sort` | Sort | Interactive activities | 0 | — | — | — |
| `az-quiz-game` | A-Z quiz | Games | 0 | — | — | — |
| `challenge` | Challenge | Games | 0 | — | — | — |
| `crossword` | Crossword | Games | 0 | — | — | — |
| `discover` | Discover | Games | 0 | — | — | — |
| `hidden-image` | Hidden image | Games | 0 | — | — | — |
| `padlock` | Padlock | Games | 0 | — | — | — |
| `puzzle` | Puzzle | Games | 0 | — | — | — |
| `trivial` | TriviExt | Games | 0 | — | — | — |
| `word-search` | Word search | Games | 0 | — | — | — |
| `geogebra-activity` | GeoGebra activity | Science | 0 | — | — | `GeogebraIdevice` |
| `mathematicaloperations` | Math operations | Science | 0 | — | — | — |
| `mathproblems` | Math problems | Science | 0 | — | — | — |
| `periodic-table` | Periodic table | Science | 0 | — | — | — |

Snippet links are deferred: [snippets.md#text](snippets.md#text), [snippets.md#casestudy](snippets.md#casestudy), etc.

A dash (`—`) in `api-version` or `component-type` means the field is absent from that iDevice's `config.xml`; such iDevices do not follow the full api-v3 lifecycle and store state differently. See [patterns.md](patterns.md) for details.

---

## Information and presentation

### `text`

The foundational iDevice. Accepts arbitrary rich HTML produced by the in-app editor, plus optional metadata fields (duration, grouping). The editor reads `jsonProperties` to restore the user's authored content; the rendered `htmlView` is what appears in exports. Handles most content that does not fit a more specific iDevice.

### `casestudy`

A structured presentation of a scenario together with its analysis. Presents the scenario text and a "What would you do?" or worked answer section side by side. Imported from legacy format via `CaseStudyIdevice`.

### `image-gallery`

A lightbox-enabled image gallery. Authors upload images and add captions; the export embeds `simple-lightbox.min.js` and `simple-lightbox.min.css` alongside the iDevice's own JS/CSS.

### `magnifier`

A zoom-on-hover magnifier for a single image. Useful for detailed diagrams or maps that learners need to inspect closely.

### `external-website`

Embeds a remote URL in an iframe. The author sets the URL, width, height, and whether to display a fallback error message when the iframe is blocked by HTTPS/HTTP mismatch.

### `download-source-file`

Presents a descriptive table about the learning resource and a button that downloads the original `.elpx` source file when the exported package includes it. The entire content is rendered into `htmlView` at export time; there is no separate JSON state blob.

### `digcompedu`

A DigCompEdu competence framework manager. Authors tag learning objectives against the European Digital Competence Framework for Educators (DigCompEdu). Stores competence selections in `jsonProperties`.

### `map`

Embeds an interactive map (typically Leaflet-based) with configurable markers and popups. Game state is stored as URI-encoded JSON in a `mapa-DataGame js-hidden` div. See [patterns.md#uri-encoded-json](patterns.md#uri-encoded-json).

### `udl-content`

A Universal Design for Learning (UDL) container. Provides separate authored `<section>` blocks for the three UDL principles: representation, action/expression, and engagement. Each section is a standalone HTML block inside `htmlView`. Unlike most iDevices, it carries no JSON state payload for game mechanics; all editable content is structured HTML.

### `example`

A reference implementation used as a skeleton when developing new iDevices (`downloadable=1`). Provides a bootstrap for the api-v3 lifecycle: `edition-js`, `export-js`, `export-template-filename`. Marked hidden by default (`<default-visibility>0</default-visibility>`).

---

## Assessment and tracking

### `trueorfalse`

Presents a statement and asks the learner to respond True or False. Supports optional feedback text for each answer. State is stored in `jsonProperties` as structured JSON; `htmlView` holds the rendered quiz.

### `quick-questions`

A multiple-choice test with a single correct answer per question (radio-button style). Game data is URI-encoded in a `quext-DataGame js-hidden` div inside `htmlView`.

### `quick-questions-multiple-choice`

A multiple-choice test where more than one answer can be correct (checkbox style). Game data lives in a `selecciona-DataGame js-hidden` div inside `htmlView`.

### `quick-questions-video`

A video player with inline quiz questions triggered at time-coded moments. Game data is in a `vquext-DataGame js-hidden` div inside `htmlView`.

### `interactive-video`

A video annotated with interactive slides (text annotations, single-choice questions, images) that appear at specified timestamps. JSON data is embedded inside a `<script id="exe-interactive-video-contents" type="application/json">` block (or, in older exports, a `<div id="exe-interactive-video-contents" style="display:none">` block) within `htmlView`. `jsonProperties` stores a separately maintained editor state. See [patterns.md#embedded-script-json](patterns.md#embedded-script-json).

### `form`

A free-form assessment container. Covers fill-in-the-blank, cloze activities, dropdown questions, and multi-select question sets. Legacy aliases include all FPD cloze variants and SCORM quiz types. State in `jsonProperties`.

### `guess`

A guessing activity where learners reveal a hidden answer step by step. Game data in `adivina-DataGame js-hidden`.

### `checklist`

A self-assessment checklist with configurable criteria. Game data in `listacotejo-DataGame js-hidden`.

### `rubric`

A scoring rubric table. The entire table is rendered into `htmlView` as static HTML at save time; there is no `jsonProperties` blob. The rubric editor writes directly to `htmlView`.

### `select-media-files`

An activity where learners select correct image or audio files in response to a prompt. Game data in `seleccionamedias-DataGame js-hidden`.

### `progress-report`

A learner progress-tracking dashboard. Aggregates SCORM scores or self-assessment data. Game data in `informe-DataGame js-hidden`.

---

## Interactive activities

### `beforeafter`

A split-image slider showing a "before" state on one side and an "after" state on the other. Authors upload two images and configure the initial divider position. Game data in `beforeafter-DataGame js-hidden`.

### `classify`

Learners drag items into labelled categories. Game data in `clasifica-DataGame js-hidden`.

### `complete`

A fill-in-the-blank activity where learners type missing words directly into the text. Game data in `completa-DataGame js-hidden`.

### `dragdrop`

A drag-and-drop activity where learners place labelled elements onto a background image at correct positions. Game data in `dragdrop-DataGame js-hidden`.

### `flipcards`

A memory-card game. Authors configure card fronts (images) and backs (text labels). Cards are randomizable. Game data in `flipcards-DataGame js-hidden`.

### `identify`

An image annotation activity where learners click on the correct region of an image to identify a labelled element. Game data in `identifica-DataGame js-hidden`.

### `relate`

A matching activity where learners draw connections between two columns of items. Game data in `relaciona-DataGame js-hidden`.

### `scrambled-list`

An ordering activity where learners drag list items into the correct sequence. Unlike most activity iDevices, `scrambled-list` stores its JSON state in `jsonProperties` (not as URI-encoded data in `htmlView`); the JSON uses key `typeGame: "ScrambledList"`. See [patterns.md](patterns.md) for the distinction.

### `sort`

A sorting activity where learners arrange cards or blocks in the correct order. Game data in `ordena-DataGame js-hidden`.

---

## Games

### `az-quiz-game`

A quiz game styled as an A-to-Z board. Each letter is associated with a question. Game data in `rosco-DataGame js-hidden`.

### `challenge`

A timed challenge game with multiple rounds of questions. Game data in `desafio-DataGame js-hidden`.

### `crossword`

An auto-generated crossword puzzle. Word/clue pairs are defined by the author; the crossword layout is computed at runtime. Game data in `crucigrama-DataGame js-hidden`.

### `discover`

A progressive image-reveal game. The image is covered by tiles that are removed as the learner answers questions correctly. Game data in `descubre-DataGame js-hidden`.

### `hidden-image`

An image that is covered and revealed by correct answers. Distinct from `discover` in layout and reveal mechanic. Game data in `hiddenimage-DataGame js-hidden`.

### `padlock`

A combination-lock game where the learner must enter a code discovered by answering questions. Game data in `candado-DataGame js-hidden`.

### `puzzle`

A jigsaw-puzzle activity where learners reassemble a scrambled image. Game data in `puzzle-DataGame js-hidden`.

### `trivial`

A trivia wheel game (TriviExt) with multiple categories arranged around a wheel. Game data in `trivial-DataGame js-hidden`.

### `word-search`

A word-search grid generated from an author-supplied word list. Game data in `sopa-DataGame js-hidden`.

---

## Science

### `geogebra-activity`

Embeds a GeoGebra applet (by GeoGebra ID or uploaded file) with optional auto-evaluation. State is in `jsonProperties`; the applet is rendered via the GeoGebra API at runtime.

### `mathematicaloperations`

An arithmetic practice activity where learners solve generated arithmetic operations. Game data in `mathoperations-DataGame js-hidden`.

### `mathproblems`

A word-problem activity for mathematics. Learners solve presented problems with numeric or symbolic answers. Game data in `mathproblems-DataGame js-hidden`.

### `periodic-table`

An interactive periodic table activity. Learners identify or classify elements. Game data in `periodic-table-DataGame js-hidden`.

---

## Legacy / FPD aliases

The following table lists every legacy CamelCase class name that the importer recognises and the modern type it maps to. Legacy names are accepted on import only and are rewritten to the modern type name before the document is stored. Source: `src/shared/import/legacy-handlers/HandlerRegistry.ts`.

| Legacy class name | Modern type |
|-------------------|-------------|
| `FreeTextIdevice` | `text` |
| `FreeTextfpdIdevice` | `text` |
| `ReflectionIdevice` | `text` |
| `ReflectionfpdIdevice` | `text` |
| `GenericIdevice` | `text` |
| `SolvedExerciseIdevice` | `text` |
| `EjercicioResueltoFpdIdevice` | `text` |
| `WikipediaIdevice` | `text` |
| `RssIdevice` | `text` |
| `MultichoiceIdevice` | `form` |
| `MultiSelectIdevice` | `form` |
| `ListaIdevice` | `form` |
| `ClozeIdevice` | `form` |
| `ClozeActivityIdevice` | `form` |
| `ClozeLanguageIdevice` | `form` |
| `ClozeLangIdevice` | `form` |
| `ScormTestIdevice` | `form` |
| `QuizTestIdevice` | `form` |
| `TrueFalseIdevice` | `trueorfalse` |
| `VerdaderoFalsoFPDIdevice` | `trueorfalse` |
| `CaseStudyIdevice` | `casestudy` |
| `ImageGalleryIdevice` | `image-gallery` |
| `GalleryIdevice` | `image-gallery` |
| `ImageMagnifierIdevice` | `magnifier` |
| `FileAttachIdevice` | `text` |
| `FileAttachIdeviceInc` | `text` |
| `AttachmentIdevice` | `text` |
| `ExternalUrlIdevice` | `external-website` |
| `GeogebraIdevice` | `geogebra-activity` |
| `JavaAppIdevice` | `java-app` |

Additional FPD-specific aliases recognised by the XSD but not explicitly mapped (they fall through to the kebab-case normalisation in `getLegacyTypeName()`):

`VerdaderofalsofpdIdevice`, `EleccionmultiplefpdIdevice`, `SeleccionmultiplefpdIdevice`, `ClozefpdIdevice`, `ClozelangfpdIdevice`, `ReflectionfpdmodifIdevice`, `TareasIdevice`, `ListaApartadosIdevice`, `ComillasIdevice`, `NotaInformacionIdevice`, `NotaIdevice`, `CasopracticofpdIdevice`, `CitasparapensarfpdIdevice`, `DebesconocerfpdIdevice`, `DestacadofpdIdevice`, `OrientacionestutoriafpdIdevice`, `OrientacionesalumnadofpdIdevice`, `ParasabermasfpdIdevice`, `RecomendacionfpdIdevice`, `EjercicioresueltofpdIdevice`.

Source for the full enumeration: `public/app/schemas/ode/ode-content.xsd` lines 158–234.
