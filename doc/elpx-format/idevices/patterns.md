# iDevice Content-Storage Patterns

This document describes the four ways iDevices store their state inside a `content.xml` `<odeComponent>` block. Understanding these patterns is required when writing tools that generate, parse, or round-trip ELPX files programmatically (e.g. AI generators, importers, automated test fixtures).

See also:
- [catalog.md](catalog.md) — full list of iDevice types and which pattern each one uses
- [config-xml.md](config-xml.md) — per-iDevice `config.xml` metadata schema

---

## Context: the `<odeComponent>` wrapper

Every iDevice in `content.xml` is enclosed in an `<odeComponent>` element. The wrapper carries four identification fields, then the content fields discussed below.

```xml
<odeComponent>
  <odePageId>20251025070914ABCDEF</odePageId>
  <odeBlockId>20251025070914XYZUVW</odeBlockId>
  <odeIdeviceId>20251025070914XDRVFP</odeIdeviceId>
  <odeIdeviceTypeName>text</odeIdeviceTypeName>
  <!-- content fields below -->
</odeComponent>
```

IDs use the format `YYYYMMDDHHmmss` + 6 uppercase alphanumeric characters. The `odeIdeviceTypeName` value is the modern type name from [catalog.md](catalog.md).

---

## Pattern 1: Standard JSON

### When it is used

Used by iDevices that have a structured editor backed by a JavaScript component with `component-type: json` in `config.xml`. The editor reads `jsonProperties` on open, modifies it in memory, and writes both `jsonProperties` and `htmlView` on save.

**Types using this pattern:** `text`, `casestudy`, `image-gallery`, `magnifier`, `trueorfalse`, `form`, `digcompedu`, `example`, `geogebra-activity`, `scrambled-list`, `udl-content`

### Structure

- `<htmlView>` — rendered HTML output, wrapped in `<![CDATA[ ... ]]>`. What the learner sees in the exported package. Regenerated from `jsonProperties` every time the iDevice is saved.
- `<jsonProperties>` — JSON string, wrapped in `<![CDATA[ ... ]]>`. The canonical editable state. The editor reads this; `htmlView` is derived from it.

Both values are **always** wrapped in CDATA in v4 — even when the content contains no XML-significant characters — because [`OdeXmlGenerator.ts:270, 275`](../../../src/shared/export/generators/OdeXmlGenerator.ts) emits the wrapper unconditionally. Inside the CDATA section, `<`, `>`, `"`, `&` are written verbatim (no entity encoding). The single exception is the literal three-character sequence `]]>`, which would close the CDATA section prematurely and is therefore split as `]]]]><![CDATA[>` by [`escapeCdata()`](../../../src/shared/export/generators/OdeXmlGenerator.ts).

### How to read it

```
raw_html   = odeComponent.htmlView.textContent           // already decoded by the XML parser
state_json = json_parse(odeComponent.jsonProperties.textContent)
```

`textContent` returns the CDATA payload verbatim — no further decoding is needed.

### How to write it

1. Build the JSON state object.
2. Render the HTML from the state object (apply the iDevice's template logic).
3. If either string contains the literal sequence `]]>`, split it as `]]]]><![CDATA[>` (the `escapeCdata` rule).
4. Wrap each value in `<![CDATA[ ... ]]>` and write into `<jsonProperties>` / `<htmlView>`.

### XML excerpt (type: `text`)

```xml
<odeComponent>
  <odePageId>20251027202947MKIISA</odePageId>
  <odeBlockId>20251027202947EDIAYV</odeBlockId>
  <odeIdeviceId>20251025070914XDRVFP</odeIdeviceId>
  <odeIdeviceTypeName>text</odeIdeviceTypeName>
  <htmlView>&lt;div class="exe-text-template"&gt;&lt;div class="textIdeviceContent"&gt;
    &lt;div class="exe-text-activity"&gt;
      &lt;div&gt;&lt;div class="exe-text"&gt;
        &lt;h1&gt;Manual de eXeLearning 3.0&lt;/h1&gt;
        &lt;p&gt;Guia practica para crear contenidos educativos.&lt;/p&gt;
      &lt;/div&gt;&lt;/div&gt;
    &lt;/div&gt;
  &lt;/div&gt;&lt;/div&gt;</htmlView>
  <jsonProperties>{"ideviceId":"20251025070914XDRVFP",
    "textInfoDurationInput":"",
    "textInfoParticipantsInput":"",
    "textInfoDurationTextInput":"Duracion",
    "textInfoParticipantsTextInput":"Agrupamiento",
    "textTextarea":"&lt;div class=\"exe-text\"&gt;\n&lt;h1&gt;Manual de eXeLearning 3.0&lt;/h1&gt;
      &lt;p&gt;Guia practica para crear contenidos educativos.&lt;/p&gt;\n&lt;/div&gt;"
  }</jsonProperties>
</odeComponent>
```

Note that `textTextarea` inside the JSON itself also HTML-entity-encodes its HTML content (double-encoded relative to the raw file bytes).

---

## Pattern 2: URI-encoded JSON inside `htmlView`

### When it is used

Used by game-type and complex interactive iDevices. The JSON state is `encodeURIComponent(JSON.stringify(data))` and placed inside a hidden `<div>` whose CSS class follows the naming convention `<internal-name>-DataGame js-hidden`. The `<jsonProperties>` element may be absent, empty, or may hold supplementary metadata (duration, grouping, ideviceId) that is not the primary game state.

**Types using this pattern:**

| type | DataGame class |
|------|----------------|
| `az-quiz-game` | `rosco-DataGame js-hidden` |
| `beforeafter` | `beforeafter-DataGame js-hidden` |
| `challenge` | `desafio-DataGame js-hidden` |
| `checklist` | `listacotejo-DataGame js-hidden` |
| `classify` | `clasifica-DataGame js-hidden` |
| `complete` | `completa-DataGame js-hidden` |
| `crossword` | `crucigrama-DataGame js-hidden` |
| `discover` | `descubre-DataGame js-hidden` |
| `dragdrop` | `dragdrop-DataGame js-hidden` |
| `flipcards` | `flipcards-DataGame js-hidden` |
| `guess` | `adivina-DataGame js-hidden` |
| `hidden-image` | `hiddenimage-DataGame js-hidden` |
| `identify` | `identifica-DataGame js-hidden` |
| `map` | `mapa-DataGame js-hidden` |
| `mathematicaloperations` | `mathoperations-DataGame js-hidden` |
| `mathproblems` | `mathproblems-DataGame js-hidden` |
| `padlock` | `candado-DataGame js-hidden` |
| `periodic-table` | `periodic-table-DataGame js-hidden` |
| `progress-report` | `informe-DataGame js-hidden` |
| `puzzle` | `puzzle-DataGame js-hidden` |
| `quick-questions` | `quext-DataGame js-hidden` |
| `quick-questions-multiple-choice` | `selecciona-DataGame js-hidden` |
| `quick-questions-video` | `vquext-DataGame js-hidden` |
| `relate` | `relaciona-DataGame js-hidden` |
| `select-media-files` | `seleccionamedias-DataGame js-hidden` |
| `sort` | `ordena-DataGame js-hidden` |
| `trivial` | `trivial-DataGame js-hidden` |
| `word-search` | `sopa-DataGame js-hidden` |

### Structure

Inside `<htmlView>`, the rendered HTML includes a hidden `<div>` that holds the URI-encoded game data:

```html
<div class="<name>-DataGame js-hidden">%7B%22typeGame%22%3A%22...</div>
```

The value is `encodeURIComponent(JSON.stringify(gameData))`. The `%`-encoded payload sits inside the CDATA section of `<htmlView>`, so the percent-encoding flows through the XML serialisation untouched (CDATA does not reinterpret `%`, `<`, or any other character).

### How to read it

```
raw_html    = odeComponent.htmlView.textContent       // CDATA body — verbatim
dom         = parse_html(raw_html)
div         = dom.querySelector('[class*="DataGame"][class*="js-hidden"]')
game_data   = json_parse(decodeURIComponent(div.textContent.trim()))
```

### How to write it

1. Build the game data JSON object.
2. `encoded = encodeURIComponent(JSON.stringify(gameData))`
3. Inject the string as the text content of the `<div class="<name>-DataGame js-hidden">` element inside the full rendered HTML.
4. HTML-entity-encode the full HTML and write it into `<xmlView>`.
5. If the iDevice also uses `<jsonProperties>` for supplementary metadata (ideviceId, duration, grouping), write that separately using Pattern 1 encoding for those fields.

### XML excerpt (type: `flipcards`)

```xml
<odeComponent>
  <odePageId>20251021091936PQRSTU</odePageId>
  <odeBlockId>20251021091936ABCXYZ</odeBlockId>
  <odeIdeviceId>20251021091936VCTATJ</odeIdeviceId>
  <odeIdeviceTypeName>flipcards</odeIdeviceTypeName>
  <htmlView>&lt;div class="flipcards-IDevice"&gt;
    &lt;div class="flipcards-instructions gameQP-instructions"&gt;
      &lt;p&gt;Haz clic sobre cada carta para descubrir el nombre de su animal&lt;/p&gt;
    &lt;/div&gt;
    &lt;div class="flipcards-DataGame js-hidden"&gt;%7B%22typeGame%22%3A%22FlipCards%22%2C
      %22author%22%3A%22%22%2C%22randomCards%22%3Atrue%2C%22instructions%22%3A%22...%22%2C
      %22cardsGame%22%3A%5B%7B%22url%22%3A%22...%22%7D%5D%7D
    &lt;/div&gt;
  &lt;/div&gt;</htmlView>
  <jsonProperties>{"ideviceId":"20251021091936VCTATJ",
    "textInfoDurationInput":"",
    "textInfoParticipantsInput":""}</jsonProperties>
</odeComponent>
```

Decoded, the DataGame div text is:
```json
{
  "typeGame": "FlipCards",
  "author": "",
  "randomCards": true,
  "instructions": "<p>Haz clic sobre cada carta...</p>",
  "cardsGame": [{ "url": "{{context_path}}/..." }]
}
```

#### Note on `crossword` and some other games

Some games (`crossword`, `hidden-image`, `puzzle`, `beforeafter`, `dragdrop`, `periodic-table`) have `<jsonProperties>` absent entirely (not just empty). The DataGame div in `<htmlView>` is the only source of truth for those types.

---

## Pattern 3: Embedded JSON block in `htmlView`

### When it is used

Used by `interactive-video` (and the related `quick-questions-video` in some export versions). The JSON data for interactive slides is embedded directly inside `<htmlView>` as the content of a specially identified element, rather than URI-encoded in a DataGame div.

**Types using this pattern:** `interactive-video`

### Structure

There are two sub-variants depending on eXeLearning version:

**Modern (v3.x exports):** a `<script>` tag with `type="application/json"`:
```html
<script id="exe-interactive-video-contents" type="application/json">
  {"slides": [...], "i18n": {...}}
</script>
```

**Older exports:** a `<div>` with `style="display:none"`:
```html
<div id="exe-interactive-video-contents" style="display: none">
  {"slides": [...], "i18n": {...}}
</div>
```

Both are inside the CDATA-wrapped `<htmlView>`. The `<jsonProperties>` element is also present (also CDATA-wrapped) and holds a separately maintained editor copy of the video configuration; the two may diverge if the user edits one path and not the other.

### How to read it

```
raw_html  = odeComponent.htmlView.textContent       // CDATA body — verbatim
dom       = parse_html(raw_html)
el        = dom.getElementById('exe-interactive-video-contents')
slides    = json_parse(el.textContent.trim())
```

### How to write it

1. Build the slides JSON object.
2. Serialize to a JSON string (no URI encoding needed).
3. Place the JSON string as the text content of `<script id="exe-interactive-video-contents" type="application/json">` inside the full HTML structure.
4. HTML-entity-encode the full HTML and write into `<htmlView>`.
5. Write matching state into `<jsonProperties>` using Pattern 1 encoding.

### XML excerpt (type: `interactive-video`)

```xml
<odeComponent>
  <odeIdeviceId>20251027120355IWQHYP</odeIdeviceId>
  <odeIdeviceTypeName>interactive-video</odeIdeviceTypeName>
  <htmlView>&lt;div class="exe-interactive-video-content-before"&gt;
    &lt;p&gt;Video sobre el suelo&lt;/p&gt;
    &lt;/div&gt;
    &lt;div class="game-evaluation-ids js-hidden"
         data-id="20251027120355IWQHYP"
         data-evaluationb="false" data-evaluationid=""&gt;&lt;/div&gt;
    &lt;div class="exe-interactive-video"&gt;
      &lt;p id="exe-interactive-video-file" class="js-hidden"&gt;
        &lt;a href="https://www.youtube.com/watch?v=ALO_ukssQLg"&gt;
          com/watch?v=ALO_ukssQLg&lt;/a&gt;
      &lt;/p&gt;
      &lt;script id="exe-interactive-video-contents"
              type="application/json"&gt;
        {"slides":[
          {"type":"text","text":"&lt;p&gt;Por que es tan importante el suelo?&lt;/p&gt;",
           "startTime":45,"current":false},
          {"type":"image","url":1,"description":"Formacion del suelo",
           "startTime":118}
        ],"i18n":{"start":"Empezar","results":"Resultado"}}
      &lt;/script&gt;
    &lt;/div&gt;</htmlView>
  <jsonProperties>{"ideviceId":"20251027120355IWQHYP",
    "textInfoDurationInput":"","textInfoParticipantsInput":"",
    "textTextarea":"&lt;div class=\"exe-interactive-video ...\"&gt;..."
  }</jsonProperties>
</odeComponent>
```

---

## Pattern 4: `htmlView`-only

### When it is used

Used by iDevices where the entire editable content is rendered HTML with no separate machine-readable JSON state. The editor writes HTML directly; on re-edit it parses the HTML back.

**Types using this pattern:** `rubric`, `external-website`, `download-source-file`

Note: `udl-content` has `<jsonProperties>` present (Pattern 1) but the HTML in `htmlView` contains multiple `<section>` blocks representing the UDL principles. The JSON state stores the same HTML sections. This is still Pattern 1, not Pattern 4.

### Structure

- `<htmlView>` — the complete rendered HTML, wrapped in `<![CDATA[ ... ]]>` like every other `htmlView`.
- `<jsonProperties>` — absent or empty.

### How to read it

```
raw_html = odeComponent.htmlView.textContent        // CDATA body — verbatim
```

There is no secondary JSON to decode. Any structured data (iframe URL for `external-website`, table content for `rubric`) must be parsed from the HTML directly.

### How to write it

1. Build the HTML string directly.
2. HTML-entity-encode it.
3. Write into `<htmlView>`. Omit or leave empty the `<jsonProperties>` element.

### XML excerpt (type: `external-website`)

```xml
<odeComponent>
  <odeIdeviceId>20251021091936EXTURL</odeIdeviceId>
  <odeIdeviceTypeName>external-website</odeIdeviceTypeName>
  <htmlView>&lt;div id="iframeWebsiteIdevice"&gt;
    &lt;iframe src="https://cedec.intef.es/"
            width="600" height="300"
            style="width:100%;"&gt;
    &lt;/iframe&gt;
    &lt;div class="iframe-error-message" style="display:none;"&gt;
      No se puede mostrar un iframe en HTTP en una web HTTPS.
    &lt;/div&gt;
  &lt;/div&gt;</htmlView>
</odeComponent>
```

### XML excerpt (type: `rubric`)

```xml
<odeComponent>
  <odeIdeviceId>20251021091936RUBRIC</odeIdeviceId>
  <odeIdeviceTypeName>rubric</odeIdeviceTypeName>
  <htmlView>&lt;table class='exe-table'&gt;
    &lt;caption&gt;Rubrica para evaluar un trabajo escrito&lt;/caption&gt;
    &lt;thead&gt;&lt;tr&gt;
      &lt;th&gt;&amp;nbsp;&lt;/th&gt;
      &lt;th&gt;4 Excelente&lt;/th&gt;
      &lt;th&gt;3 Satisfactorio&lt;/th&gt;
      &lt;th&gt;2 Mejorable&lt;/th&gt;
      &lt;th&gt;1 Insuficiente&lt;/th&gt;
    &lt;/tr&gt;&lt;/thead&gt;
    &lt;tbody&gt;
      &lt;tr&gt;
        &lt;th&gt;Aspectos formales&lt;/th&gt;
        &lt;td&gt;Se presenta en plazo ...&lt;/td&gt;
        ...
      &lt;/tr&gt;
    &lt;/tbody&gt;
  &lt;/table&gt;</htmlView>
</odeComponent>
```

---

## Edge cases and caveats

### `scrambled-list`: Pattern 1 with game-flavoured JSON

`scrambled-list` is classified as Pattern 1 (standard JSON in `jsonProperties`). However its JSON payload uses a `typeGame` field (`"typeGame": "ScrambledList"`) similar to DataGame payloads. This is not URI-encoded; the JSON is written directly into `<jsonProperties>`. The `htmlView` contains the rendered sortable list HTML but no `*-DataGame js-hidden` div.

### `geogebra-activity`: Pattern 1, but `htmlView` has DataGame-style evaluation div

`geogebra-activity` uses Pattern 1 (JSON in `jsonProperties`). The `htmlView` may contain a `game-evaluation-ids js-hidden` div for SCORM scoring, but the main configuration state is in `jsonProperties`.

### `quick-questions-video`: DataGame in `htmlView`

Despite the name similarity to `interactive-video`, `quick-questions-video` uses Pattern 2 (DataGame, `vquext-DataGame js-hidden`), not Pattern 3.

### Asset path placeholder `{{context_path}}`

Image and media URLs inside both `htmlView` and `jsonProperties` use `{{context_path}}/` as a prefix, followed by the iDevice ID and filename. At export time the exporter replaces `{{context_path}}` with the relative path to the assets directory.

---

## Decision cheat-sheet: which pattern for a new iDevice?

```
Does the iDevice have a structured JSON editor
with component-type=json in config.xml?
    YES --> Does it use a game runtime that needs
            URI-encoded state in the DOM?
                YES --> Pattern 2 (DataGame)
                NO  --> Is the state a video slide deck?
                            YES --> Pattern 3 (embedded script/div)
                            NO  --> Pattern 1 (standard JSON)
    NO  --> Pattern 4 (htmlView-only)
```

Quick rules:
- Simple content iDevices (text, case study, gallery, magnifier): **Pattern 1**.
- Game/activity iDevices with a game engine (flipcards, crossword, quiz, sort, etc.): **Pattern 2**.
- Interactive video only: **Pattern 3**.
- Legacy presentational iDevices with no JSON model (rubric, iframe embed, file download): **Pattern 4**.
