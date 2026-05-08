# Generating `.elpx` with an LLM

Rules and recipes for AI agents that produce eXeLearning project files (`.elpx`) end-to-end. If you are an LLM reading this in the wild via the project's [`llms.txt`](../../llms.txt), this is the single most important document for you.

> **Audience**: language models, AI assistants, codegen pipelines, and humans
> who orchestrate them.
>
> **Prerequisites**: skim [`elpx-format.md`](../elpx-format.md) (the hub) and
> at least [`content-xml.md`](content-xml.md), [`idevices/catalog.md`](idevices/catalog.md),
> and [`idevices/patterns.md`](idevices/patterns.md) before generating anything.

---

## TL;DR — the ten non-negotiable rules

These ten rules cover every common failure mode. They are sourced from the actual generator code in this repository (`OdeXmlGenerator.ts`, `ElpxExporter.ts`) and from validation rejections seen in the importer (`ElpxImporter.ts`).

1. **Reuse a real template.** Start from a known-good v4 `.elpx` produced by this repository (e.g. one of the fixtures in `test/fixtures/`) and modify it. Do **not** synthesize the package from scratch unless every rule below is followed exactly.
2. **Bundle every required file at the ZIP root.** v4 minimum baseline: `content.xml`, `content.dtd`, `index.html`, `screenshot.png` (1280×720 PNG), `theme/config.xml`, `theme/style.css`, `theme/style.js`, `theme/screenshot.png`, `libs/jquery/jquery.min.js`, `libs/bootstrap/bootstrap.bundle.min.js`, `libs/bootstrap/bootstrap.min.css`, `libs/common.js`, `libs/common_i18n.js`, `libs/exe_export.js`, `libs/favicon.ico`, plus per-iDevice JS/CSS in `idevices/<type>/`. Project assets go flat under `content/resources/<filename>` — no UUID subfolders. See [container.md](container.md), [libraries.md](libraries.md), and [assets.md](assets.md) for the full inventory.
3. **Always emit `<odeComponentsProperties>` — even when empty.** The DTD marks it optional, but every fixture and the generator emit it, and downstream tools assume it. When you have no properties, write `<odeComponentsProperties><odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty></odeComponentsProperties>`.
4. **Synchronize redundant IDs.** Inside an `<odeComponent>`, the `<odePageId>` and `<odeBlockId>` MUST equal the IDs of the enclosing `<odePagStructure>` and `<odeNavStructure>`. Inside an `<odePagStructure>`, `<odePageId>` MUST equal the page's own `<odePageId>`. Mismatches reject the component or attach it to the wrong block.
5. **Wrap `<htmlView>` and `<jsonProperties>` in `<![CDATA[ ... ]]>` always.** This is what [`OdeXmlGenerator.ts:270, 275`](../../src/shared/export/generators/OdeXmlGenerator.ts) does, regardless of whether the content has special characters.
6. **Split `]]>` inside CDATA.** When user content contains the literal sequence `]]>`, replace it with `]]]]><![CDATA[>`. The exporter's `escapeCdata` helper does this at [`OdeXmlGenerator.ts:355`](../../src/shared/export/generators/OdeXmlGenerator.ts).
7. **Match the iDevice type to its storage pattern.** Each iDevice type uses one of four content-storage patterns (Standard JSON / URI-encoded JSON / `<script type="application/json">` / `htmlView`-only). Read [`idevices/patterns.md`](idevices/patterns.md) and pick the right one. A `text` iDevice with no `<jsonProperties>` will not be re-editable. A `rubric` with raw JSON inside `<jsonProperties>` instead of URI-encoded JSON inside `<htmlView>` will fail to render.
8. **Use only canonical iDevice type names.** Read the list at [`idevices/catalog.md`](idevices/catalog.md). The XSD `ideviceTypeType` enumeration at [`ode-content.xsd:158-235`](../../public/app/schemas/ode/ode-content.xsd) is the authoritative set. Legacy CamelCase aliases (e.g. `FreeTextIdevice`) are accepted on import but normalized — emit the modern name (e.g. `text`).
9. **Use the `YYYYMMDDHHmmss` + 6 alphanumerics ID format.** All ODE identifiers (`odeId`, `odeVersionId`, `odePageId`, `odeBlockId`, `odeIdeviceId`) follow `[0-9]{14}[A-Z0-9]{6}`. The XSD enforces this regex. Generate IDs with the algorithm in [`OdeXmlGenerator.generateOdeId()`](../../src/shared/export/generators/OdeXmlGenerator.ts) at lines 315-332.
10. **Math markup must use `\(...\)` and `\[...\]`.** Never `$...$` or `$$...$$`. The MathJax bundle this project ships only triggers on the backslash-paren syntax (see [`constants.ts:228`](../../src/shared/export/constants.ts) — pattern `/\\\(|\\\[/`). Use the inline form `\(x^2\)` for inline math, `\[ x = \tfrac{-b \pm \sqrt{b^2-4ac}}{2a} \]` for displays.

---

## Recommended generation pipeline

A robust LLM pipeline for `.elpx` looks like four stages. Each stage has a single responsibility and a verifiable output.

```
  ┌─────────────────┐    ┌──────────────────┐    ┌────────────────┐    ┌──────────────────┐
  │ 1. Pedagogical  │ →  │ 2. Project-shape │ →  │ 3. content.xml │ →  │ 4. ZIP package   │
  │    plan (text)  │    │    JSON (struct) │    │   + DTD + HTML │    │   (.elpx file)   │
  └─────────────────┘    └──────────────────┘    └────────────────┘    └──────────────────┘
       narrative              structured             snippet-driven         deterministic
       per topic              per page/block         per iDevice type       file packing
```

### Stage 1 — Pedagogical plan

Input: a learning objective, a topic, a target audience, a duration.
Output: a Markdown plan listing the pages, the blocks per page, and the iDevice types you intend to use, with one paragraph of pedagogical justification per page.

This stage is purely textual. The LLM does not emit any XML or JSON yet. It does pick iDevice types from [`idevices/catalog.md`](idevices/catalog.md) — and only from that list.

### Stage 2 — Project-shape JSON

Input: the Stage 1 plan.
Output: a structured JSON document describing the entire project tree: title, language, license, theme, and a flat list of pages with their parent-child relationships, blocks, and components. Use a simple JSON shape such as:

```jsonc
{
  "metadata": {
    "title": "An Introduction to Photosynthesis",
    "author": "Jane Doe",
    "language": "en",
    "license": "creative commons: attribution - share alike 4.0",
    "theme": "base",
    "addAccessibilityToolbar": true,
    "addSearchBox": true,
    "addExeLink": true,
    "addPagination": false,
    "addMathJax": false
  },
  "pages": [
    {
      "id": "20251217062007PAGE01",
      "parentId": null,
      "title": "Introduction",
      "order": 0,
      "blocks": [
        {
          "id": "20251217062007BLK001",
          "name": "Text",
          "order": 0,
          "components": [
            {
              "id": "20251217062007IDEV1",
              "type": "text",
              "order": 0,
              "content": { "textTextarea": "<p>Photosynthesis is …</p>" }
            }
          ]
        }
      ]
    },
    {
      "id": "20251217062007PAGE02",
      "parentId": "20251217062007PAGE01",
      "title": "Quick Quiz",
      "order": 1,
      "blocks": [ /* ... */ ]
    }
  ]
}
```

Keep this representation simple. It is intermediate fuel for Stage 3, not the final XML.

### Stage 3 — `content.xml` from snippets

Input: the Stage 2 JSON + the canonical XML snippets in [`idevices/snippets.md`](idevices/snippets.md).
Output: a complete `content.xml` valid against [`content.dtd`](../../public/app/schemas/ode/content.dtd).

Algorithm:

1. Open the document with the prologue from [`content-xml.md`](content-xml.md): XML declaration, DOCTYPE, `<ode>` opening tag.
2. Emit `<userPreferences>` with a single `<userPreference>` for `theme`.
3. Emit `<odeResources>` with three `<odeResource>` entries: `odeId`, `odeVersionId`, `exe_version`. Generate IDs with the format `[0-9]{14}[A-Z0-9]{6}`.
4. Emit `<odeProperties>` with one `<odeProperty>` per metadata key. Use the XML keys from [`metadata.md`](metadata.md) (e.g. `pp_title`, `pp_lang`, `pp_addAccessibilityToolbar`). Booleans become the literal strings `"true"` or `"false"`.
5. Emit `<odeNavStructures>`. For each page in the JSON:
    - Emit `<odeNavStructure>` with `<odePageId>`, `<odeParentPageId>` (empty if root), `<pageName>`, `<odeNavStructureOrder>`.
    - Emit `<odeNavStructureProperties>` with at minimum a `<key>titlePage</key><value>…</value>` entry.
    - Emit `<odePagStructures>` containing one `<odePagStructure>` per block.
    - For each block: emit redundant `<odePageId>`, then `<odeBlockId>`, `<blockName>`, `<iconName/>`, `<odePagStructureOrder>`, `<odePagStructureProperties>`, `<odeComponents>`.
    - For each component: pull the matching XML snippet from [`idevices/snippets.md`](idevices/snippets.md), substitute the IDs, and inject the user content.
6. Close `<odeNavStructures>`, `<ode>`.

Snippet substitution rules per pattern:

| Pattern | Where to inject content | How to encode |
|---------|-------------------------|---------------|
| Standard JSON | `<jsonProperties><![CDATA[ JSON ]]></jsonProperties>` and the rendered HTML in `<htmlView><![CDATA[ HTML ]]></htmlView>`. Both must be semantically aligned. | JSON.stringify; CDATA-wrap; split `]]>`. |
| URI-encoded JSON | Inside the `*-DataGame js-hidden` `<div>` in `<htmlView>`. `<jsonProperties>` empty or omitted. | `encodeURIComponent(JSON.stringify(...))`. |
| `<script type="application/json">` | Inside `<htmlView>`, in a `<script id="exe-…">` tag. | JSON.stringify; do not URL-encode. |
| `htmlView`-only (UDL) | Multiple `<article>` blocks in `<htmlView>`; no JSON state. | Plain HTML; CDATA-wrap; split `]]>`. |

### Stage 4 — ZIP packaging

Input: `content.xml` + a template directory with all the static assets (`content.dtd`, `index.html`, `html/`, `content/`, `libs/`, `theme/`, `idevices/`).
Output: a `.zip` archive renamed to `.elpx`.

Algorithm:

1. Take a known-good template directory (extract one of the project's fixtures, or reuse a previous successful export).
2. Replace `content.xml` with your generated XML.
3. Update `index.html` and any `html/<page>.html` files if you regenerated them (optional — see "skip HTML pre-rendering" below).
4. Drop a `screenshot.png` at the ZIP root if you have one (PNG, recommended 1280×720).
5. ZIP with the standard `deflate` compressor (`zip -r out.elpx .` works).
6. Verify the archive with `unzip -l` and check that `content.xml`, `content.dtd`, `index.html`, `theme/`, `libs/`, `idevices/` are all present.

> **Skip HTML pre-rendering**: an `.elpx` is technically valid for re-import even
> if `index.html` and `html/*.html` are stub or missing — the importer reads
> `content.xml` and reconstructs everything else. Skipping pre-rendering is the
> simplest way for an LLM to produce an `.elpx`. The cost is that the package
> is not viewable offline before re-importing into eXeLearning. For a fully
> portable package, run the project's HTML5 exporter (or a copy of `index.html`
> from a template) to produce the `html/` directory.

---

## Pre-flight checklist (before declaring done)

Run through this list every time you generate an `.elpx`. Anything that fails MUST be fixed before claiming success.

### XML correctness

- [ ] `content.xml` starts with `<?xml version="1.0" encoding="UTF-8"?>`.
- [ ] DOCTYPE line is `<!DOCTYPE ode SYSTEM "content.dtd">`.
- [ ] Root element opens as `<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">`.
- [ ] Top-level children appear in this exact order: `<userPreferences>`, `<odeResources>`, `<odeProperties>`, `<odeNavStructures>`.
- [ ] `<odeNavStructures>` is present and contains at least one `<odeNavStructure>`.
- [ ] DTD validation passes: `xmllint --noout --dtdvalid content.dtd content.xml` (run inside the unzipped directory).
- [ ] XSD validation passes (recommended): `xmllint --noout --schema public/app/schemas/ode/ode-content.xsd content.xml`.

### IDs

- [ ] Every `odeId`, `odeVersionId`, `odePageId`, `odeBlockId`, `odeIdeviceId` matches `[0-9]{14}[A-Z0-9]{6}` (14 digits + 6 chars from `[A-Z0-9]`).
- [ ] All page/block/component IDs are unique within the document.
- [ ] Inside every `<odeComponent>`, `<odePageId>` matches the enclosing page and `<odeBlockId>` matches the enclosing block.
- [ ] Inside every `<odePagStructure>`, `<odePageId>` matches the enclosing page.
- [ ] `<odeParentPageId>` is empty for root pages and references a real `<odePageId>` otherwise.

### Content

- [ ] Every iDevice type used is in the catalog at [`idevices/catalog.md`](idevices/catalog.md).
- [ ] Every iDevice uses the correct content pattern from [`idevices/patterns.md`](idevices/patterns.md).
- [ ] `<htmlView>` and `<jsonProperties>` are CDATA-wrapped.
- [ ] No literal `]]>` appears inside CDATA (use the `]]]]><![CDATA[>` split).
- [ ] No leftover placeholders (`__PLACEHOLDER__`, `UUID-PAGE`, `UUID-BLOQUE`, `<TODO>`, etc.) in any text content.
- [ ] `{{context_path}}` is used only inside `<htmlView>` and `<jsonProperties>` for asset URLs (see [assets.md](assets.md)). Never in a stand-alone `pp_*` property value.
- [ ] All `src=` and `href=` references inside `<htmlView>` either resolve to a file in `content/resources/` (within the ZIP) or are absolute external URLs.

### Container

- [ ] ZIP root contains: `content.xml`, `content.dtd`, `index.html`, **`screenshot.png` (1280×720 PNG)**.
- [ ] `screenshot.png` starts with the PNG magic bytes `89 50 4E 47 0D 0A 1A 0A`. If you don't have one, generate it with [`scripts/add-screenshot.ts`](../../scripts/add-screenshot.ts).
- [ ] `theme/` contains `config.xml`, `style.css`, `style.js`, `screenshot.png`, plus any theme assets (icons, fonts).
- [ ] `libs/` contains the BASE_LIBRARIES from [`constants.ts:325`](../../src/shared/export/constants.ts): `jquery/jquery.min.js`, `common_i18n.js`, `common.js`, `exe_export.js`, `bootstrap/bootstrap.bundle.min.js`, `bootstrap/bootstrap.bundle.min.js.map`, `bootstrap/bootstrap.min.css`, `bootstrap/bootstrap.min.css.map`.
- [ ] `idevices/<type>/` exists for each iDevice type used, with the type's `<type>.js`, `<type>.css`, and `<type>.html` files.
- [ ] Project assets live under `content/resources/<folderPath>/<filename>` — assets without a `folderPath` go at the root, user-created folders appear verbatim as subdirectories, and there are **no** legacy v3 per-asset UUID folders (`[0-9]{14}[A-Z0-9]{6}`). XML refs follow the same shape: `{{context_path}}/<filename>` for root assets, `{{context_path}}/<folderPath>/<filename>` for assets inside a folder. If the package was rebuilt from a v3 source, run [`scripts/flatten-elpx.ts`](../../scripts/flatten-elpx.ts) to normalise (it preserves user folders).
- [ ] At least 2 iDevices total in the project. Single-iDevice projects are a useful smell test for AI-generated learning content — they usually indicate the LLM produced a stub instead of a complete pedagogical sequence.

### Round-trip test

- [ ] Open the `.elpx` in eXeLearning. The import succeeds with no warnings.
- [ ] Every page renders correctly in the editor's preview.
- [ ] Every iDevice can be opened, its content matches what the LLM generated, and saving leaves the project re-exportable.

---

## Common rejection causes (and how to fix them)

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Importer shows "0 pages imported" | `<odeNavStructures>` is empty or out of order | Ensure at least one `<odeNavStructure>` and that the four top-level children appear in declared order. |
| One page is missing in the navigation tree | `<odeParentPageId>` references a non-existent page ID | Make sure parent IDs match a real `<odePageId>` elsewhere in the document. |
| iDevice renders as a blank box | `<htmlView>` is empty or `<jsonProperties>` is malformed JSON | Keep both fields semantically aligned; validate the JSON with `JSON.parse()` before embedding. |
| "Cannot re-edit this iDevice" in the editor | `<jsonProperties>` is missing for a Standard-JSON iDevice | Always emit `<jsonProperties>` for `text`, `casestudy`, `quick-questions*`, `trueorfalse`, `form`, `image-gallery`, `magnifier`, `external-website`, `download-source-file`. |
| Game iDevice shows "Loading…" forever | URI-encoded JSON inside the `*-DataGame js-hidden` div is missing or not URL-encoded | Apply `encodeURIComponent(JSON.stringify(state))` and place the result in the hidden div. |
| MathJax is not rendering equations | Used `$…$` syntax, or `pp_addMathJax` is `"false"` | Use `\(…\)` for inline and `\[…\]` for displays; set `pp_addMathJax=true` in `<odeProperties>`. |
| XML parse error: unexpected end of CDATA | Content contained literal `]]>` | Apply the `]]]]><![CDATA[>` split. |
| XSD validation fails: `cvc-pattern-valid` on an ID | ID format does not match `[0-9]{14}[A-Z0-9]{6}` | Generate IDs with the canonical algorithm: `<14-digit timestamp><6 random A-Z0-9>`. |
| Importer logs "unknown iDevice type" | Used a deprecated CamelCase or invented name | Use the modern name from [`idevices/catalog.md`](idevices/catalog.md). |
| Image tag in `<htmlView>` shows broken icon | Asset URL points to `asset://…` or to a missing file | Use `{{context_path}}/content/resources/<filename>` and ensure `<filename>` exists inside the ZIP. |

---

## Prompt-engineering hints (for orchestrators)

If you are designing a prompt for an LLM that will execute Stage 3 (XML emission), the following constraints should appear in the system prompt:

1. **Output is XML only.** No prose, no Markdown fences, no explanatory text. The LLM must emit a single XML document and stop.
2. **Use the snippet library.** Pre-load [`idevices/snippets.md`](idevices/snippets.md) as context. The LLM picks the snippet for the iDevice type, substitutes IDs, and injects user content.
3. **Treat IDs as opaque tokens.** Pre-generate every ODE identifier in the orchestrator (not in the LLM) and pass them in. LLMs are bad at producing 20-character random strings reliably.
4. **Never invent iDevice types.** If the requested type is not in the catalog, fall back to `text` and embed the requested behavior as static HTML.
5. **Constrain content size.** Per-iDevice JSON should stay under ~10 KB. Long passages are fine in `textTextarea` as long as they are valid HTML.
6. **Validate before emitting.** Before returning the XML, the orchestrator should run `xmllint --noout --dtdvalid` against the bundled DTD; if it fails, regenerate Stage 3 with the parser error appended to the prompt.

A reasonable system prompt skeleton:

```
You are an XML emitter for eXeLearning .elpx packages. Given a JSON
description of a project, produce a single content.xml document valid
against the bundled content.dtd.

Rules:
- Emit only XML. No explanation.
- Use only the iDevice types in the provided catalog.
- Wrap <htmlView> and <jsonProperties> in <![CDATA[ ... ]]>.
- Replace any literal "]]>" in content with "]]]]><![CDATA[>".
- Use these IDs verbatim: <ID list provided by the orchestrator>.
- Boolean property values are the literal strings "true" / "false".
- Math expressions use \(...\) for inline and \[...\] for display.

Snippets:
<paste idevices/snippets.md or the relevant subset>

Project JSON:
<the Stage 2 JSON>

Now emit content.xml.
```

---

## See also

- [`elpx-format.md`](../elpx-format.md) — hub
- [`content-xml.md`](content-xml.md) — full XML reference
- [`idevices/catalog.md`](idevices/catalog.md) — every supported type
- [`idevices/patterns.md`](idevices/patterns.md) — the four content-storage patterns
- [`idevices/snippets.md`](idevices/snippets.md) — copy-pasteable XML per type
- [`validation.md`](validation.md) — DTD/XSD validation playbook
- [`examples/minimal-content-xml.md`](examples/minimal-content-xml.md) — smallest valid example
- [`/llms.txt`](../../llms.txt) — top-level index for LLM consumption
