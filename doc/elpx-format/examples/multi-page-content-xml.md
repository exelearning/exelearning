# Multi-page content.xml

This example shows a `content.xml` with a three-level hierarchy:

```
Root page (20251217062007PAGE01)
├── Child page A (20251217062007PAGE02)
└── Child page B (20251217062007PAGE03)
```

Each page contains at least one block. Across the three pages the example covers all four
iDevice content-encoding patterns:

| Pattern | iDevice type | Where |
|---------|-------------|-------|
| Standard JSON (htmlView + jsonProperties) | `text` | Page 01, Block 01 |
| URI-encoded game data | `rubric` | Page 02, Block 01 |
| Script-tag JSON | `interactive-video` | Page 02, Block 02 |
| htmlView-only (no jsonProperties) | `udl-content` | Page 03, Block 01 |

The root page also contains an internal cross-page link using the `exe-node:` URI scheme.

Full element reference: [../content-xml.md](../content-xml.md).
iDevice HTML/JSON shapes: [../idevices/snippets.md](../idevices/snippets.md).
Minimal single-iDevice baseline: [minimal-content-xml.md](minimal-content-xml.md).

---

## Document header and metadata

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<!-- content.dtd filename comes from ODE_DTD_FILENAME in src/shared/export/constants.ts -->

<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">

  <userPreferences>
    <userPreference>
      <key>theme</key>
      <value>base</value>
    </userPreference>
  </userPreferences>

  <odeResources>
    <odeResource>
      <key>odeId</key>
      <value>20251217062007MULPG1</value>
      <!-- Stable project ID: generated once, never changes on re-save. -->
    </odeResource>
    <odeResource>
      <key>odeVersionId</key>
      <value>20251217062007MULPG2</value>
      <!-- Fresh on every export. -->
    </odeResource>
    <odeResource>
      <key>exe_version</key>
      <value>3.0</value>
      <!-- Key is "exe_version" (underscore, lowercase) — not "eXeVersion". -->
    </odeResource>
  </odeResources>

  <odeProperties>
    <odeProperty>
      <key>pp_title</key>
      <value>Multi-page Example</value>
    </odeProperty>
    <odeProperty>
      <key>pp_lang</key>
      <value>en</value>
    </odeProperty>
    <odeProperty>
      <key>pp_author</key>
      <value>Jane Educator</value>
    </odeProperty>
    <odeProperty>
      <key>pp_addExeLink</key>
      <value>true</value>
    </odeProperty>
    <odeProperty>
      <key>pp_addPagination</key>
      <value>true</value>
      <!-- Enables previous/next navigation buttons in the exported HTML. -->
    </odeProperty>
    <odeProperty>
      <key>pp_addSearchBox</key>
      <value>true</value>
    </odeProperty>
  </odeProperties>

  <odeNavStructures>
```

---

## Page 01 — root page with a text iDevice and a cross-page link

Page 01 is a root page (`<odeParentPageId>` is empty). Its single block holds one `text`
iDevice whose `<htmlView>` contains an `exe-node:` link pointing at the child page PAGE02.

The `text` iDevice uses **Pattern 1 (standard JSON)**: the full editor state is stored in
`<jsonProperties>` as a plain JSON object wrapped in CDATA, and `<htmlView>` holds the
rendered HTML also wrapped in CDATA.

```xml
    <!-- ══════════════════════════════════════════════════════════════
         PAGE 01 — root page
         ══════════════════════════════════════════════════════════════ -->
    <odeNavStructure>
      <odePageId>20251217062007PAGE01</odePageId>
      <odeParentPageId></odeParentPageId>
      <!-- Empty odeParentPageId marks a root-level page. -->
      <pageName>Overview</pageName>
      <odeNavStructureOrder>1</odeNavStructureOrder>

      <odeNavStructureProperties>
        <odeNavStructureProperty>
          <key>titlePage</key>
          <value>Overview</value>
        </odeNavStructureProperty>
        <odeNavStructureProperty>
          <key>hidePageTitle</key>
          <value>false</value>
        </odeNavStructureProperty>
        <odeNavStructureProperty>
          <key>visibility</key>
          <value>true</value>
        </odeNavStructureProperty>
      </odeNavStructureProperties>

      <odePagStructures>

        <!-- Block 01 on page 01 -->
        <odePagStructure>
          <odePageId>20251217062007PAGE01</odePageId>
          <odeBlockId>20251217062007BLK01</odeBlockId>
          <blockName>Introduction</blockName>
          <iconName></iconName>
          <odePagStructureOrder>1</odePagStructureOrder>

          <odePagStructureProperties>
            <odePagStructureProperty>
              <key>visibility</key>
              <value>true</value>
            </odePagStructureProperty>
            <odePagStructureProperty>
              <key>teacherOnly</key>
              <value>false</value>
            </odePagStructureProperty>
            <odePagStructureProperty>
              <key>allowToggle</key>
              <value>true</value>
            </odePagStructureProperty>
            <odePagStructureProperty>
              <key>minimized</key>
              <value>false</value>
            </odePagStructureProperty>
          </odePagStructureProperties>

          <odeComponents>

            <!-- ── iDevice: text (Pattern 1 — standard JSON) ──────────────
                 Both <htmlView> and <jsonProperties> are present and both are
                 unconditionally wrapped in CDATA regardless of content.
                 The htmlView is what the HTML exporter inlines; the jsonProperties
                 is the source of truth used by the importer to restore editor state.
                 ─────────────────────────────────────────────────────────────── -->
            <odeComponent>
              <odePageId>20251217062007PAGE01</odePageId>
              <odeBlockId>20251217062007BLK01</odeBlockId>
              <odeIdeviceId>20251217062007IDEV1</odeIdeviceId>
              <odeIdeviceTypeName>text</odeIdeviceTypeName>

              <htmlView><![CDATA[<div class="exe-text-template"><div class="textIdeviceContent">
  <div class="exe-text-activity">
    <div>
      <p>This module covers three topics. Start with
         <a href="exe-node:20251217062007PAGE02">Topic A</a>
         or jump straight to
         <a href="exe-node:20251217062007PAGE03">Topic B</a>.</p>
    </div>
  </div>
</div></div>]]></htmlView>
              <!-- exe-node:<pageId> is an internal cross-page link.
                   The HTML exporter rewrites these to relative paths (e.g. html/page-2.html)
                   at export time.  Inside content.xml they are always stored as exe-node: URIs
                   so that the link survives page reordering or renaming. -->

              <jsonProperties><![CDATA[{"ideviceId":"20251217062007IDEV1","textTextarea":"<p>This module covers three topics. Start with <a href=\"exe-node:20251217062007PAGE02\">Topic A</a> or jump straight to <a href=\"exe-node:20251217062007PAGE03\">Topic B</a>.</p>","textFeedbackInput":"Show Feedback","textFeedbackTextarea":"","textInfoDurationInput":"","textInfoDurationTextInput":"Duration","textInfoParticipantsInput":"","textInfoParticipantsTextInput":"Grouping"}]]></jsonProperties>
              <!-- Inside the CDATA block JSON is stored as literal characters.
                   The JSON value of textTextarea contains HTML with double-quoted attributes;
                   those quotes are JSON-escaped (\") inside the JSON string but are NOT
                   XML-escaped because CDATA does not require XML escaping. -->

              <odeComponentsOrder>1</odeComponentsOrder>
              <odeComponentsProperties>
                <odeComponentsProperty>
                  <key>visibility</key>
                  <value>true</value>
                </odeComponentsProperty>
              </odeComponentsProperties>
            </odeComponent>

          </odeComponents>
        </odePagStructure>

      </odePagStructures>
    </odeNavStructure>
```

---

## Page 02 — child of Page 01, with a game iDevice and an interactive-video iDevice

Page 02 is a child of PAGE01. It has two blocks: a `rubric` game iDevice (Pattern 2,
URI-encoded) and an `interactive-video` iDevice (Pattern 3, script-tag JSON).

### Pattern 2 — URI-encoded game data (`rubric`)

The `rubric` iDevice stores its game configuration as a URI-encoded JSON string inside a
`<div class="exe-rubrics-DataGame js-hidden">` element in `<htmlView>`. The
`<jsonProperties>` holds the normal editor-state JSON. The game engine initialises itself by
reading and decoding that hidden div at runtime.

URI encoding is used because the game data can be large and may contain characters (curly
braces, colons, quotes) that would interfere with naive string handling in older browsers.

### Pattern 3 — script-tag JSON (`interactive-video`)

The `interactive-video` iDevice stores its configuration as an inline `<script>` tag with
`type="application/json"` inside `<htmlView>`. This avoids URI-encoding overhead for large
video annotation objects and gives the runtime direct access to a parsed JSON structure.

```xml
    <!-- ══════════════════════════════════════════════════════════════
         PAGE 02 — child of PAGE01 (Topic A)
         ══════════════════════════════════════════════════════════════ -->
    <odeNavStructure>
      <odePageId>20251217062007PAGE02</odePageId>
      <odeParentPageId>20251217062007PAGE01</odeParentPageId>
      <!-- odeParentPageId matches PAGE01's odePageId — this makes PAGE02 a child. -->
      <pageName>Topic A</pageName>
      <odeNavStructureOrder>1</odeNavStructureOrder>
      <!-- Order 1 among PAGE01's children. -->

      <odeNavStructureProperties>
        <odeNavStructureProperty>
          <key>titlePage</key>
          <value>Topic A</value>
        </odeNavStructureProperty>
        <odeNavStructureProperty>
          <key>hidePageTitle</key>
          <value>false</value>
        </odeNavStructureProperty>
        <odeNavStructureProperty>
          <key>visibility</key>
          <value>true</value>
        </odeNavStructureProperty>
      </odeNavStructureProperties>

      <odePagStructures>

        <!-- Block 01 on page 02 — rubric game iDevice (Pattern 2: URI-encoded) -->
        <odePagStructure>
          <odePageId>20251217062007PAGE02</odePageId>
          <odeBlockId>20251217062007BLK02</odeBlockId>
          <blockName>Self-assessment rubric</blockName>
          <iconName></iconName>
          <odePagStructureOrder>1</odePagStructureOrder>

          <odePagStructureProperties>
            <odePagStructureProperty>
              <key>visibility</key>
              <value>true</value>
            </odePagStructureProperty>
            <odePagStructureProperty>
              <key>teacherOnly</key>
              <value>false</value>
            </odePagStructureProperty>
            <odePagStructureProperty>
              <key>allowToggle</key>
              <value>true</value>
            </odePagStructureProperty>
            <odePagStructureProperty>
              <key>minimized</key>
              <value>false</value>
            </odePagStructureProperty>
          </odePagStructureProperties>

          <odeComponents>

            <!-- ── iDevice: rubric (Pattern 2 — URI-encoded game data) ───────
                 The htmlView contains the rendered rubric HTML plus a hidden div
                 whose text content is the URI-encoded game configuration JSON.
                 The game bootstrap script reads that div, calls decodeURIComponent(),
                 and parses the resulting JSON to initialise the rubric widget.
                 ─────────────────────────────────────────────────────────────── -->
            <odeComponent>
              <odePageId>20251217062007PAGE02</odePageId>
              <odeBlockId>20251217062007BLK02</odeBlockId>
              <odeIdeviceId>20251217062007IDEV2</odeIdeviceId>
              <odeIdeviceTypeName>rubric</odeIdeviceTypeName>

              <htmlView><![CDATA[<div class="exe-rubric" id="exe-rubric-20251217062007IDEV2">
  <div class="exe-rubrics-DataGame js-hidden">%7B%22id%22%3A%2220251217062007IDEV2%22%2C%22title%22%3A%22Reading%20comprehension%22%2C%22criteria%22%3A%5B%7B%22label%22%3A%22Identifies%20main%20idea%22%2C%22levels%22%3A%5B%22Beginning%22%2C%22Developing%22%2C%22Proficient%22%2C%22Exemplary%22%5D%7D%5D%7D</div>
  <!-- The string above is URI-encoded JSON.  Decoded it equals:
       {"id":"20251217062007IDEV2","title":"Reading comprehension",
        "criteria":[{"label":"Identifies main idea",
                     "levels":["Beginning","Developing","Proficient","Exemplary"]}]}
       The game runtime calls decodeURIComponent() on this div's textContent. -->
  <table class="exe-rubric-table" aria-label="Reading comprehension">
    <thead>
      <tr>
        <th>Criterion</th>
        <th>Beginning</th><th>Developing</th><th>Proficient</th><th>Exemplary</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Identifies main idea</td>
        <td><input type="radio" name="c0" value="0"></td>
        <td><input type="radio" name="c0" value="1"></td>
        <td><input type="radio" name="c0" value="2"></td>
        <td><input type="radio" name="c0" value="3"></td>
      </tr>
    </tbody>
  </table>
</div>]]></htmlView>

              <jsonProperties><![CDATA[{"ideviceId":"20251217062007IDEV2","rubricTitle":"Reading comprehension","rubricCriteria":[{"label":"Identifies main idea","levels":["Beginning","Developing","Proficient","Exemplary"]}]}]]></jsonProperties>
              <!-- jsonProperties holds the plain editor-state JSON used by the importer
                   to restore the rubric form fields.  The game-data div in htmlView is
                   regenerated from this JSON during the next export. -->

              <odeComponentsOrder>1</odeComponentsOrder>
              <odeComponentsProperties>
                <odeComponentsProperty>
                  <key>visibility</key>
                  <value>true</value>
                </odeComponentsProperty>
              </odeComponentsProperties>
            </odeComponent>

          </odeComponents>
        </odePagStructure>

        <!-- Block 02 on page 02 — interactive-video iDevice (Pattern 3: script-tag JSON) -->
        <odePagStructure>
          <odePageId>20251217062007PAGE02</odePageId>
          <odeBlockId>20251217062007BLK03</odeBlockId>
          <blockName>Video with annotations</blockName>
          <iconName></iconName>
          <odePagStructureOrder>2</odePagStructureOrder>

          <odePagStructureProperties>
            <odePagStructureProperty>
              <key>visibility</key>
              <value>true</value>
            </odePagStructureProperty>
            <odePagStructureProperty>
              <key>teacherOnly</key>
              <value>false</value>
            </odePagStructureProperty>
            <odePagStructureProperty>
              <key>allowToggle</key>
              <value>true</value>
            </odePagStructureProperty>
            <odePagStructureProperty>
              <key>minimized</key>
              <value>false</value>
            </odePagStructureProperty>
          </odePagStructureProperties>

          <odeComponents>

            <!-- ── iDevice: interactive-video (Pattern 3 — script-tag JSON) ──
                 The htmlView embeds a <script type="application/json"> element
                 containing the full video configuration.  The widget bootstrap code
                 queries document.querySelector('script[type="application/json"]')
                 within its container and calls JSON.parse() on its textContent.
                 This pattern avoids URI-encoding overhead for large annotation sets.
                 ─────────────────────────────────────────────────────────────── -->
            <odeComponent>
              <odePageId>20251217062007PAGE02</odePageId>
              <odeBlockId>20251217062007BLK03</odeBlockId>
              <odeIdeviceId>20251217062007IDEV3</odeIdeviceId>
              <odeIdeviceTypeName>interactive-video</odeIdeviceTypeName>

              <htmlView><![CDATA[<div class="exe-interactive-video" id="exe-iv-20251217062007IDEV3">
  <script type="application/json">
  {
    "id": "20251217062007IDEV3",
    "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "annotations": [
      {
        "time": 12,
        "type": "question",
        "text": "What is the main message of this video?"
      },
      {
        "time": 45,
        "type": "note",
        "text": "Pay attention to the visual metaphor used here."
      }
    ]
  }
  </script>
  <!-- The <script type="application/json"> block is inside CDATA in content.xml,
       so the curly braces and quotes are stored as literal characters without any
       XML or URI escaping.  The browser never executes this script tag because its
       type is not "text/javascript". -->
  <div class="exe-iv-player" data-idevice-id="20251217062007IDEV3">
    <div class="exe-iv-video-container"></div>
    <div class="exe-iv-annotations" aria-live="polite"></div>
  </div>
</div>]]></htmlView>

              <jsonProperties><![CDATA[{"ideviceId":"20251217062007IDEV3","ivVideoUrl":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","ivAnnotations":[{"time":12,"type":"question","text":"What is the main message of this video?"},{"time":45,"type":"note","text":"Pay attention to the visual metaphor used here."}]}]]></jsonProperties>
              <!-- jsonProperties keys:
                   - ideviceId: matches <odeIdeviceId> above
                   - ivVideoUrl: the video source URL
                   - ivAnnotations: array of timed annotation objects with
                     { time (seconds), type ("question"|"note"|"pause"), text } -->

              <odeComponentsOrder>1</odeComponentsOrder>
              <odeComponentsProperties>
                <odeComponentsProperty>
                  <key>visibility</key>
                  <value>true</value>
                </odeComponentsProperty>
              </odeComponentsProperties>
            </odeComponent>

          </odeComponents>
        </odePagStructure>

      </odePagStructures>
    </odeNavStructure>
```

---

## Page 03 — child of Page 01, with a UDL iDevice (htmlView-only)

Page 03 is the second child of PAGE01. It holds a `udl-content` iDevice that uses
**Pattern 4 (htmlView-only)**: the iDevice stores no `<jsonProperties>` state — the
`<jsonProperties>` element is present but empty. The rendered HTML in `<htmlView>` is both
the display artefact and the persistence mechanism; the importer reads it back as-is.

This pattern is typical for iDevices whose entire state is captured by their HTML output,
such as structured accessibility overlays or static layout blocks.

```xml
    <!-- ══════════════════════════════════════════════════════════════
         PAGE 03 — child of PAGE01 (Topic B)
         ══════════════════════════════════════════════════════════════ -->
    <odeNavStructure>
      <odePageId>20251217062007PAGE03</odePageId>
      <odeParentPageId>20251217062007PAGE01</odeParentPageId>
      <pageName>Topic B</pageName>
      <odeNavStructureOrder>2</odeNavStructureOrder>
      <!-- Order 2 among PAGE01's children — comes after PAGE02. -->

      <odeNavStructureProperties>
        <odeNavStructureProperty>
          <key>titlePage</key>
          <value>Topic B</value>
        </odeNavStructureProperty>
        <odeNavStructureProperty>
          <key>hidePageTitle</key>
          <value>false</value>
        </odeNavStructureProperty>
        <odeNavStructureProperty>
          <key>visibility</key>
          <value>true</value>
        </odeNavStructureProperty>
      </odeNavStructureProperties>

      <odePagStructures>

        <!-- Block 01 on page 03 — udl-content iDevice (Pattern 4: htmlView-only) -->
        <odePagStructure>
          <odePageId>20251217062007PAGE03</odePageId>
          <odeBlockId>20251217062007BLK04</odeBlockId>
          <blockName>UDL Content Block</blockName>
          <iconName></iconName>
          <odePagStructureOrder>1</odePagStructureOrder>

          <odePagStructureProperties>
            <odePagStructureProperty>
              <key>visibility</key>
              <value>true</value>
            </odePagStructureProperty>
            <odePagStructureProperty>
              <key>teacherOnly</key>
              <value>false</value>
            </odePagStructureProperty>
            <odePagStructureProperty>
              <key>allowToggle</key>
              <value>true</value>
            </odePagStructureProperty>
            <odePagStructureProperty>
              <key>minimized</key>
              <value>false</value>
            </odePagStructureProperty>
          </odePagStructureProperties>

          <odeComponents>

            <!-- ── iDevice: udl-content (Pattern 4 — htmlView-only) ──────────
                 jsonProperties is empty.  The entire iDevice state lives in
                 htmlView.  The importer reads htmlView and injects it directly
                 into the editor's content area; no JSON deserialisation occurs.
                 Note: the generator still writes the <jsonProperties></jsonProperties>
                 tag — it is never omitted, just left empty (OdeXmlGenerator.ts line 277).
                 ─────────────────────────────────────────────────────────────── -->
            <odeComponent>
              <odePageId>20251217062007PAGE03</odePageId>
              <odeBlockId>20251217062007BLK04</odeBlockId>
              <odeIdeviceId>20251217062007IDEV4</odeIdeviceId>
              <odeIdeviceTypeName>udl-content</odeIdeviceTypeName>

              <htmlView><![CDATA[<div class="exe-udl-content" id="exe-udl-20251217062007IDEV4">
  <div class="exe-udl-representation exe-udl-text" role="region" aria-label="Text representation">
    <h3>Read</h3>
    <p>Photosynthesis is the process by which plants convert sunlight into glucose.
       The overall equation is: 6CO<sub>2</sub> + 6H<sub>2</sub>O → C<sub>6</sub>H<sub>12</sub>O<sub>6</sub> + 6O<sub>2</sub>.</p>
  </div>
  <div class="exe-udl-representation exe-udl-visual" role="region" aria-label="Visual representation">
    <h3>Watch</h3>
    <p><a href="https://example.com/photosynthesis-diagram.png" target="_blank"
          rel="noopener noreferrer">View diagram</a></p>
  </div>
  <div class="exe-udl-representation exe-udl-action" role="region" aria-label="Action representation">
    <h3>Do</h3>
    <ol>
      <li>Label the parts of a chloroplast.</li>
      <li>Write the photosynthesis equation from memory.</li>
    </ol>
  </div>
</div>]]></htmlView>

              <jsonProperties></jsonProperties>
              <!-- Empty <jsonProperties> — Pattern 4.  The generator writes this empty
                   tag (not omitted) because its presence is part of the schema contract. -->

              <odeComponentsOrder>1</odeComponentsOrder>
              <odeComponentsProperties>
                <odeComponentsProperty>
                  <key>visibility</key>
                  <value>true</value>
                </odeComponentsProperty>
              </odeComponentsProperties>
            </odeComponent>

          </odeComponents>
        </odePagStructure>

      </odePagStructures>
    </odeNavStructure>

  </odeNavStructures>
</ode>
```

---

## Page tree summary

The three `<odeNavStructure>` elements above produce this navigation tree:

```
Overview  (PAGE01, order 1, no parent)
└── Topic A  (PAGE02, order 1, parent=PAGE01)
└── Topic B  (PAGE03, order 2, parent=PAGE01)
```

The importer rebuilds this tree by iterating all `<odeNavStructure>` elements and grouping
them by `<odeParentPageId>`. Order within a level is determined by `<odeNavStructureOrder>`.
Pages must appear in depth-first order in the XML (parent before its children) — the generator
in `OdeXmlGenerator.ts` guarantees this by construction.

---

## Validation

Validate the assembled XML the same way as the minimal example:

```bash
# From the directory containing both content.xml and content.dtd:
xmllint --noout --dtdvalid content.dtd content.xml && echo "valid"
```

Common validation errors in multi-page files:

- **Mismatched `<odePageId>` inside a block** — the `<odePageId>` inside each
  `<odePagStructure>` must equal the `<odePageId>` of the enclosing `<odeNavStructure>`.
- **Mismatched `<odeBlockId>` inside a component** — the `<odeBlockId>` inside each
  `<odeComponent>` must equal the `<odeBlockId>` of the enclosing `<odePagStructure>`.
- **Missing `<odeComponentsProperties>`** — this element must always be present; the
  generator writes `visibility=true` as a default when no explicit properties are set.
- **`]]>` inside a CDATA section** — if `<htmlView>` or `<jsonProperties>` content
  contains the sequence `]]>`, it must be split: `]]]]><![CDATA[>`. The generator handles
  this automatically via `escapeCdata()` in `OdeXmlGenerator.ts`.

---

## Next steps

- Validate the full element vocabulary in [../content-xml.md](../content-xml.md).
- See how this `content.xml` fits inside the ZIP archive in [full-package-tree.md](full-package-tree.md).
- Browse ready-to-use iDevice HTML/JSON snippets in [../idevices/snippets.md](../idevices/snippets.md).
- Understand how IDs are generated and scoped in [../ids.md](../ids.md).
