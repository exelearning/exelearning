# iDevice XML Snippets

This document provides a representative `<odeComponent>` block for every iDevice type available in eXeLearning. Each snippet is taken verbatim (or lightly trimmed) from the project's own test fixtures and can be used as a starting point when constructing or validating `.elpx` archives by hand or programmatically.

An `<odeComponent>` element is the atomic unit of iDevice storage inside `content.xml`. It lives inside an `<odeComponents>` list on a page (`<odePage>`). The five child elements that always appear are `<odePageId>`, `<odeBlockId>`, `<odeIdeviceId>`, `<odeIdeviceTypeName>`, and `<odeComponentsOrder>`. The two storage fields are `<htmlView>` (the pre-rendered HTML the export engine uses directly) and `<jsonProperties>` (the editable source data the editor reads back). The `<odeComponentsProperties>` list carries per-instance flags such as `visibility`, `teacherOnly`, `identifier`, and `cssClass`.

The four storage patterns referenced throughout this document are defined in [`patterns.md`](patterns.md). In brief: **Standard JSON** means `<jsonProperties>` holds a JSON object whose keys are the editable fields; **URI-encoded JSON in hidden div** means the game data is percent-encoded inside a hidden `<div>` inside `<htmlView>` and `<jsonProperties>` contains only a thin metadata wrapper (`textTextarea`, `textFeedbackTextarea`, etc.) that wraps the same HTML; **htmlView-only** means `<jsonProperties/>` is self-closing and the export HTML is the sole source of truth; **embedded `<script type="application/json">`** means a JSON block is inlined in `<htmlView>`.

IDs (page, block, idevice) follow the pattern `YYYYMMDDHHMMSS` + six uppercase alphanumeric characters. Generate fresh IDs when creating new components.

---

## az-quiz-game

**Storage pattern:** URI-encoded JSON in hidden div | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215OHOSFQ</odePageId>
  <odeBlockId>20251022181215ATVRXU</odeBlockId>
  <odeIdeviceId>20250605150704FPKNJN</odeIdeviceId>
  <odeIdeviceTypeName>az-quiz-game</odeIdeviceTypeName>
  <htmlView>
    <!-- Pre-rendered game HTML. The actual question data is stored as
         URI-percent-encoded JSON inside a hidden div with class
         "rosco-DataGame js-hidden". The wrapper iDevice HTML is also
         embedded in jsonProperties.textTextarea. -->
    ... (htmlView content trimmed for readability) ...
  </htmlView>
  <jsonProperties>{"ideviceId":"20250605150704FPKNJN",
    "textInfoDurationInput":"",
    "textInfoDurationTextInput":"Duración",
    "textInfoParticipantsInput":"",
    "textInfoParticipantsTextInput":"Agrupamiento",
    "textTextarea":"... (full iDevice HTML, same as htmlView) ...",
    "textFeedbackInput":"Mostrar retroalimentación",
    "textFeedbackTextarea":""}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The A-Z quiz (Rosco) iDevice stores all question data as URI-percent-encoded JSON inside the hidden div `class="rosco-DataGame js-hidden"` within `htmlView`. The `jsonProperties` object is a thin metadata wrapper: `textTextarea` duplicates the full rendered HTML, while `textInfoDurationInput` and `textInfoParticipantsInput` carry optional lesson-info annotations. To create a new instance, encode the question array as percent-encoded JSON and embed it in the hidden div; regenerate `textTextarea` to match.

---

## beforeafter

**Storage pattern:** htmlView-only | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215PMQHWS</odePageId>
  <odeBlockId>20251022181215CYZARX</odeBlockId>
  <odeIdeviceId>20250605150704UOKBEL</odeIdeviceId>
  <odeIdeviceTypeName>beforeafter</odeIdeviceTypeName>
  <htmlView>
    <!-- Before/After comparison slider. Two images are embedded directly
         in the HTML; no separate jsonProperties data store is used. -->
    ... (htmlView content trimmed for readability) ...
  </htmlView>
  <jsonProperties/>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The before/after iDevice uses the htmlView-only pattern: `<jsonProperties/>` is self-closing and all content, including the two image paths and slider configuration, is encoded directly inside the `<htmlView>` HTML. The editor reconstructs the form from the live DOM rather than from a JSON snapshot.

---

## casestudy

**Storage pattern:** Standard JSON | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-manual/content.xml`

```xml
<odeComponent>
  <odePageId>20251027202947UJFTPM</odePageId>
  <odeBlockId>20251027202947OWIMTQ</odeBlockId>
  <odeIdeviceId>20251022092535737VOP</odeIdeviceId>
  <odeIdeviceTypeName>casestudy</odeIdeviceTypeName>
  <htmlView>
    <!-- Rendered case-study HTML with history block and activity sections.
         Content trimmed; full HTML includes CSP-History and CSP-Activities divs. -->
    ... (htmlView content trimmed for readability) ...
  </htmlView>
  <jsonProperties>{"id":"20251022092535737VOP",
    "typeGame":"Case study",
    "history":"&lt;p&gt;Narrative HTML...&lt;/p&gt;",
    "textInfoDurationInput":"",
    "textInfoDurationTextInput":"Duración",
    "textInfoParticipantsInput":"",
    "textInfoParticipantsTextInput":"Agrupamiento",
    "activities":[
      {
        "activity":"&lt;h4&gt;Activity title&lt;/h4&gt;&lt;p&gt;...&lt;/p&gt;",
        "feedback":"&lt;p&gt;Feedback text&lt;/p&gt;",
        "buttonCaption":"Mostrar retroalimentación"
      }
    ]
  }
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>teacherOnly</key><value>false</value></odeComponentsProperty>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The case-study iDevice uses Standard JSON. The key `history` holds the narrative rich-text HTML as a JSON string (the surrounding `<jsonProperties>` is CDATA-wrapped, so the HTML's `<`, `>`, `&` characters are written verbatim — only standard JSON-string escaping for `\"`, `\\`, and control characters applies). The `activities` array contains objects with `activity` (task description HTML), `feedback` (collapsible feedback HTML), and `buttonCaption` (button label). Both `textInfoDurationInput` and `textInfoParticipantsInput` are optional metadata fields.

---

## challenge

**Storage pattern:** URI-encoded JSON in hidden div | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215GEXCXT</odePageId>
  <odeBlockId>20251022181215PPHGQR</odeBlockId>
  <odeIdeviceId>20250605150704CKIQUR</odeIdeviceId>
  <odeIdeviceTypeName>challenge</odeIdeviceTypeName>
  <htmlView>
    <!-- Escape-room style multi-challenge activity. Contains:
         - class="desafio-IDevice" outer wrapper
         - class="desafio-instructions" introduction text
         - class="desafio-EDescription" overall narrative (rich HTML)
         - one or more class="desafio-ChallengeDescription" sections, each
           containing a challenge description and an embedded iframe/activity
         Challenge answer data is URI-encoded in a hidden div. -->
    ... (htmlView content trimmed for readability) ...
  </htmlView>
  <jsonProperties/>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The challenge iDevice stores all content inside `htmlView` only — `<jsonProperties/>` is self-closing. The outer wrapper uses `class="desafio-IDevice"`. Multiple challenge stages appear as sibling `desafio-ChallengeDescription` divs. The final answer to the overall mystery is stored URI-encoded in a hidden element inside the rendered HTML.

---

## checklist

**Storage pattern:** URI-encoded JSON in hidden div | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215JPWLEU</odePageId>
  <odeBlockId>20251022181215FDBAJP</odeBlockId>
  <odeIdeviceId>20250605150704XPLIIS</odeIdeviceId>
  <odeIdeviceTypeName>checklist</odeIdeviceTypeName>
  <htmlView>... (htmlView content trimmed for readability) ...</htmlView>
  <jsonProperties>{"ideviceId":"20250605150704XPLIIS",
    "textInfoDurationInput":"",
    "textInfoDurationTextInput":"Duración",
    "textInfoParticipantsInput":"",
    "textInfoParticipantsTextInput":"Agrupamiento",
    "textTextarea":"... (full iDevice HTML including checklist data) ...",
    "textFeedbackInput":"Mostrar retroalimentación",
    "textFeedbackTextarea":""}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The checklist iDevice follows the URI-encoded JSON in hidden div pattern. `jsonProperties.textTextarea` stores the full iDevice HTML (identical to `htmlView`), which contains the checklist items URI-encoded in a hidden div. The `textFeedbackTextarea` field holds optional post-activity feedback HTML.

---

## classify

**Storage pattern:** URI-encoded JSON in hidden div | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215BBAAWJ</odePageId>
  <odeBlockId>20251022181215PZBPBU</odeBlockId>
  <odeIdeviceId>20250605150704FPXAIS</odeIdeviceId>
  <odeIdeviceTypeName>classify</odeIdeviceTypeName>
  <htmlView>... (htmlView content trimmed for readability) ...</htmlView>
  <jsonProperties>{"ideviceId":"20250605150704FPXAIS",
    "textInfoDurationInput":"",
    "textInfoDurationTextInput":"Duración",
    "textInfoParticipantsInput":"",
    "textInfoParticipantsTextInput":"Agrupamiento",
    "textTextarea":"... (full iDevice HTML with classify game data) ...",
    "textFeedbackInput":"Mostrar retroalimentación",
    "textFeedbackTextarea":""}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The classify iDevice uses the URI-encoded JSON in hidden div pattern. Items to be sorted into categories are stored as percent-encoded JSON in a hidden div within `textTextarea`/`htmlView`. `jsonProperties` carries only the metadata wrapper keys.

---

## complete

**Storage pattern:** URI-encoded JSON in hidden div | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215TBKRKL</odePageId>
  <odeBlockId>20251022181215COMZUS</odeBlockId>
  <odeIdeviceId>20250605150704UCOOBV</odeIdeviceId>
  <odeIdeviceTypeName>complete</odeIdeviceTypeName>
  <htmlView>... (htmlView content trimmed for readability) ...</htmlView>
  <jsonProperties>{"ideviceId":"20250605150704UCOOBV",
    "textInfoDurationInput":"",
    "textInfoDurationTextInput":"Duración",
    "textInfoParticipantsInput":"",
    "textInfoParticipantsTextInput":"Agrupamiento",
    "textTextarea":"... (full iDevice HTML with fill-in data) ...",
    "textFeedbackInput":"Mostrar retroalimentación",
    "textFeedbackTextarea":""}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The complete (fill-in-the-blanks) iDevice uses the URI-encoded JSON in hidden div pattern. The blanked text and expected answers are stored as percent-encoded JSON in a hidden div inside the rendered HTML. `jsonProperties.textTextarea` mirrors `htmlView` exactly; only the thin metadata keys (`textInfoDurationInput`, etc.) are separate editable fields.

---

## crossword

**Storage pattern:** URI-encoded JSON in hidden div | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215GMHSIA</odePageId>
  <odeBlockId>20251022181215PIOZFH</odeBlockId>
  <odeIdeviceId>20250605150704JMURGS</odeIdeviceId>
  <odeIdeviceTypeName>crossword</odeIdeviceTypeName>
  <htmlView>... (htmlView content trimmed for readability) ...</htmlView>
  <jsonProperties>{"ideviceId":"20250605150704JMURGS",
    "textInfoDurationInput":"",
    "textInfoDurationTextInput":"Duración",
    "textInfoParticipantsInput":"",
    "textInfoParticipantsTextInput":"Agrupamiento",
    "textTextarea":"... (full iDevice HTML with crossword grid data) ...",
    "textFeedbackInput":"Mostrar retroalimentación",
    "textFeedbackTextarea":""}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>teacherOnly</key><value>false</value></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The crossword iDevice uses URI-encoded JSON in hidden div. The crossword grid layout, word list, and clues are stored as percent-encoded JSON in a hidden div within `textTextarea`. The `teacherOnly` property appears explicitly in this iDevice's `<odeComponentsProperties>` (set to `false` by default).

---

## digcompedu

**Storage pattern:** Standard JSON | **Downloadable:** no

Not present in fixtures — minimal skeleton based on `public/files/perm/idevices/base/digcompedu/edition/digcompedu.js` (source: `digcompedu.js:init`).

```xml
<odeComponent>
  <odePageId>YYYYMMDDHHMMSSAAAAAA</odePageId>
  <odeBlockId>YYYYMMDDHHMMSSBBBBBB</odeBlockId>
  <odeIdeviceId>YYYYMMDDHHMMSSCCCCCC</odeIdeviceId>
  <odeIdeviceTypeName>digcompedu</odeIdeviceTypeName>
  <htmlView>
    <!-- Rendered DigCompEdu summary table HTML, generated by the
         export template digcompedu.html from the saved JSON data. -->
    &lt;div class="digcompedu-container"&gt;
      &lt;!-- summary table rendered here --&gt;
    &lt;/div&gt;
  </htmlView>
  <jsonProperties>{"digcompeduSelected":["2.1","2.2","3.1"],
    "digcompeduGranularity":"indicator",
    "digcompeduDataLang":"es",
    "digcompeduSummaryTableHtml":"&lt;table&gt;...&lt;/table&gt;",
    "digcompeduSummaryTextHtml":"&lt;p&gt;...&lt;/p&gt;"}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>teacherOnly</key><value>false</value></odeComponentsProperty>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The DigCompEdu iDevice stores its data as Standard JSON. `digcompeduSelected` is an array of selected indicator IDs (e.g. `"2.1"`, `"3.1"`). `digcompeduGranularity` is either `"indicator"` or `"competence"`. `digcompeduDataLang` selects which framework JSON file to load from `base/digcompedu/data/digcompedu_{lang}.json`. `digcompeduSummaryTableHtml` and `digcompeduSummaryTextHtml` cache the rendered output. No fixture coverage exists in the three test files; this skeleton is derived from the edition JS at `public/files/perm/idevices/base/digcompedu/edition/digcompedu.js:init`.

---

## discover

**Storage pattern:** URI-encoded JSON in hidden div | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215EGCFIE</odePageId>
  <odeBlockId>20251022181215AGEKAQ</odeBlockId>
  <odeIdeviceId>20250605150704RTZIQO</odeIdeviceId>
  <odeIdeviceTypeName>discover</odeIdeviceTypeName>
  <htmlView>... (htmlView content trimmed for readability) ...</htmlView>
  <jsonProperties>{"ideviceId":"20250605150704RTZIQO",
    "textInfoDurationInput":"",
    "textInfoDurationTextInput":"Duración",
    "textInfoParticipantsInput":"",
    "textInfoParticipantsTextInput":"Agrupamiento",
    "textTextarea":"... (full iDevice HTML with discover game data) ...",
    "textFeedbackInput":"Mostrar retroalimentación",
    "textFeedbackTextarea":""}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The discover iDevice uses the URI-encoded JSON in hidden div pattern. The reveal/uncover interaction data (hidden regions and their content) is stored as percent-encoded JSON in a hidden div inside `textTextarea`. The `jsonProperties` object otherwise contains only the standard metadata wrapper keys.

---

## download-source-file

**Storage pattern:** htmlView-only | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-manual/content.xml`

```xml
<odeComponent>
  <odePageId>20251027202947OGFWBX</odePageId>
  <odeBlockId>20251027202947OHWSXU</odeBlockId>
  <odeIdeviceId>20251025104201535JS5</odeIdeviceId>
  <odeIdeviceTypeName>download-source-file</odeIdeviceTypeName>
  <htmlView>&lt;div class="exe-download-package-instructions"&gt;
    &lt;table class="exe-table"&gt;
      &lt;caption&gt;Resource metadata&lt;/caption&gt;
      &lt;tbody&gt;
        &lt;tr&gt;&lt;th&gt;Título&lt;/th&gt;&lt;td&gt;Manual de eXeLearning 3.0&lt;/td&gt;&lt;/tr&gt;
        &lt;tr&gt;&lt;th&gt;Descripción&lt;/th&gt;&lt;td&gt;...&lt;/td&gt;&lt;/tr&gt;
        &lt;tr&gt;&lt;th&gt;Autoría&lt;/th&gt;&lt;td&gt;Cedec&lt;/td&gt;&lt;/tr&gt;
        &lt;tr&gt;&lt;th&gt;Licencia&lt;/th&gt;
          &lt;td&gt;&lt;a href="https://creativecommons.org/licenses/by-sa/4.0/"
                 rel="license" class="cc cc-by-sa"&gt;CC BY-SA 4.0&lt;/a&gt;&lt;/td&gt;
        &lt;/tr&gt;
      &lt;/tbody&gt;
    &lt;/table&gt;
    &lt;p&gt;...created with eXeLearning...&lt;/p&gt;
  &lt;/div&gt;
  &lt;p class="exe-download-package-link"&gt;
    &lt;a download="exe-package:elp-name" href="exe-package:elp"
       style="background-color:#0ca1a1;color:#ffffff;"&gt;
      Descargar el archivo .elpx
    &lt;/a&gt;
  &lt;/p&gt;</htmlView>
  <jsonProperties/>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>teacherOnly</key><value>false</value></odeComponentsProperty>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The download-source-file iDevice uses the htmlView-only pattern. It renders a metadata table (title, description, authorship, licence) followed by a download link. The special `href="exe-package:elp"` and `download="exe-package:elp-name"` attributes are resolved by the exporter to the actual `.elpx` filename. All content is encoded directly in `htmlView`; `<jsonProperties/>` is self-closing.

---

## dragdrop

**Storage pattern:** htmlView-only | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215VSUXEX</odePageId>
  <odeBlockId>20251022181215FTDJTO</odeBlockId>
  <odeIdeviceId>20250605150704WPLCGC</odeIdeviceId>
  <odeIdeviceTypeName>dragdrop</odeIdeviceTypeName>
  <htmlView>
    <!-- Drag-and-drop activity HTML. Drop zones and draggable items are
         encoded directly in the HTML structure. No jsonProperties store. -->
    ... (htmlView content trimmed for readability) ...
  </htmlView>
  <jsonProperties/>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>teacherOnly</key><value>false</value></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The dragdrop iDevice uses the htmlView-only pattern. Drop-target zones and draggable label items are encoded directly in the HTML DOM. `<jsonProperties/>` is self-closing. The `teacherOnly` property is explicitly present in this iDevice's property list.

---

## example

**Storage pattern:** Standard JSON | **Downloadable:** yes

Not present in fixtures — skeleton based on `public/files/perm/idevices/base/example/edition/example.js:getDataJson`.

```xml
<odeComponent>
  <odePageId>YYYYMMDDHHMMSSAAAAAA</odePageId>
  <odeBlockId>YYYYMMDDHHMMSSBBBBBB</odeBlockId>
  <odeIdeviceId>YYYYMMDDHHMMSSCCCCCC</odeIdeviceId>
  <odeIdeviceTypeName>example</odeIdeviceTypeName>
  <htmlView>
    &lt;div class="example-IDevice"&gt;
      &lt;!-- Rendered output from example.html template --&gt;
    &lt;/div&gt;
  </htmlView>
  <jsonProperties>{"text":"Hello world",
    "dataList":"element_1",
    "number":3,
    "color":"#fbbf3c",
    "switch":false,
    "radio":"element_1"}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>teacherOnly</key><value>false</value></odeComponentsProperty>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The example iDevice is a reference implementation for the api-version 3.0 Standard JSON pattern. Its `jsonProperties` keys are `text` (free text), `dataList` (selected option from a predefined list), `number` (integer), `color` (hex color string), `switch` (boolean), and `radio` (selected radio value). This iDevice is `downloadable=1` — the only type in the catalog with that flag set. No fixture coverage; skeleton derived from `public/files/perm/idevices/base/example/edition/example.js`.

---

## external-website

**Storage pattern:** htmlView-only | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-manual/content.xml`

```xml
<odeComponent>
  <odePageId>20251027202947APQPMG</odePageId>
  <odeBlockId>20251027202947TJMRCT</odeBlockId>
  <odeIdeviceId>202510211206065735S7</odeIdeviceId>
  <odeIdeviceTypeName>external-website</odeIdeviceTypeName>
  <htmlView>&lt;div id="iframeWebsiteIdevice"&gt;
  &lt;iframe src="https://cedec.intef.es/" size="2"
          width="600" height="300" style="width:100%;"&gt;
  &lt;/iframe&gt;
  &lt;div class="iframe-error-message" style="display:none;"&gt;
    No se puede mostrar un iframe en HTTP en una web HTTPS.
  &lt;/div&gt;
&lt;/div&gt;</htmlView>
  <jsonProperties/>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>teacherOnly</key><value>false</value></odeComponentsProperty>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The external-website iDevice uses the htmlView-only pattern. The URL is embedded in an `<iframe src="...">` inside `htmlView`. The companion `class="iframe-error-message"` div is shown by JavaScript when the page is served over HTTPS but the framed URL is HTTP. `<jsonProperties/>` is self-closing.

---

## flipcards

**Storage pattern:** URI-encoded JSON in hidden div | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215YBLEHR</odePageId>
  <odeBlockId>20251022181215OMIFPO</odeBlockId>
  <odeIdeviceId>20250605150704GCEFQI</odeIdeviceId>
  <odeIdeviceTypeName>flipcards</odeIdeviceTypeName>
  <htmlView>... (htmlView content trimmed for readability) ...</htmlView>
  <jsonProperties>{"ideviceId":"20250605150704GCEFQI",
    "textInfoDurationInput":"",
    "textInfoDurationTextInput":"Duración",
    "textInfoParticipantsInput":"",
    "textInfoParticipantsTextInput":"Agrupamiento",
    "textTextarea":"... (full iDevice HTML with card data) ...",
    "textFeedbackInput":"Mostrar retroalimentación",
    "textFeedbackTextarea":""}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The flipcards (memory cards) iDevice uses the URI-encoded JSON in hidden div pattern. Front/back card content pairs are stored as percent-encoded JSON in a hidden div within `textTextarea`. `jsonProperties` contains only the thin metadata wrapper; `textFeedbackTextarea` carries optional post-activity feedback HTML.

---

## form

**Storage pattern:** Standard JSON | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215JBBARR</odePageId>
  <odeBlockId>20251022181215LJHQGP</odeBlockId>
  <odeIdeviceId>20250605150704YWTQEJ</odeIdeviceId>
  <odeIdeviceTypeName>form</odeIdeviceTypeName>
  <htmlView>
    <!-- Rendered form HTML. Full structure with question divs is omitted;
         all question data is reconstructed at runtime from jsonProperties. -->
    ... (htmlView content trimmed for readability) ...
  </htmlView>
  <jsonProperties>{"ideviceId":"20250605150704YWTQEJ",
    "evaluation":true,
    "evaluationID":"987654T",
    "repeatActivity":true,
    "isScorm":1,
    "textButtonScorm":"Guardar puntuación",
    "weighted":100,
    "msgs":{
      "msgCheck":"Comprobar",
      "msgReset":"Reiniciar",
      "msgShowAnswers":"Mostrar respuestas"
    },
    "id":"20250605150704YWTQEJ",
    "questionsRandom":false,
    "percentageQuestions":"100",
    "time":"0",
    "eXeFormInstructions":"&lt;p&gt;Instructions HTML&lt;/p&gt;",
    "questionsData":[
      {"activityType":"true-false","baseText":"&lt;p&gt;Question?&lt;/p&gt;","answer":"1"},
      {"activityType":"selection","selectionType":"single",
       "baseText":"&lt;p&gt;Which?&lt;/p&gt;",
       "answers":[[false,"Wrong"],[true,"Correct"]]},
      {"activityType":"selection","selectionType":"multiple",
       "baseText":"&lt;p&gt;Pick all that apply&lt;/p&gt;",
       "answers":[[true,"A"],[false,"B"],[true,"C"]]}
    ],
    "passRate":5,
    "addBtnAnswers":true,
    "eXeIdeviceTextAfter":""}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The form iDevice uses Standard JSON. `questionsData` is an array of question objects, each with `activityType` (`"true-false"`, `"selection"`, or `"fill"`), `baseText` (HTML question), and type-specific answer data. For `"selection"` questions, `selectionType` is `"single"` or `"multiple"` and `answers` is an array of `[isCorrect, labelText]` pairs. `evaluation` enables SCORM score tracking; `evaluationID` links to the gradebook entry. `msgs` holds all user-visible button and feedback labels.

---

## geogebra-activity

**Storage pattern:** htmlView-only | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215MIQVVZ</odePageId>
  <odeBlockId>20251022181215BGSYII</odeBlockId>
  <odeIdeviceId>20250605150704KCWYSA</odeIdeviceId>
  <odeIdeviceTypeName>geogebra-activity</odeIdeviceTypeName>
  <htmlView>
    <!-- GeoGebra applet embed. The material ID and applet parameters
         are encoded directly in the HTML. No jsonProperties data store. -->
    ... (htmlView content trimmed for readability) ...
  </htmlView>
  <jsonProperties/>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The geogebra-activity iDevice uses the htmlView-only pattern. The GeoGebra material ID and applet configuration parameters are embedded directly in the `htmlView` HTML. `<jsonProperties/>` is self-closing.

---

## guess

**Storage pattern:** URI-encoded JSON in hidden div | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215TUELCX</odePageId>
  <odeBlockId>20251022181215RTAMMO</odeBlockId>
  <odeIdeviceId>20250605150704CWXHNG</odeIdeviceId>
  <odeIdeviceTypeName>guess</odeIdeviceTypeName>
  <htmlView>... (htmlView content trimmed for readability) ...</htmlView>
  <jsonProperties>{"ideviceId":"20250605150704CWXHNG",
    "textInfoDurationInput":"",
    "textInfoDurationTextInput":"Duración",
    "textInfoParticipantsInput":"",
    "textInfoParticipantsTextInput":"Agrupamiento",
    "textTextarea":"... (full iDevice HTML with guess game data) ...",
    "textFeedbackInput":"Mostrar retroalimentación",
    "textFeedbackTextarea":""}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The guess iDevice (hangman-style letter-guessing game) uses the URI-encoded JSON in hidden div pattern. The word list and clues are stored as percent-encoded JSON in a hidden div inside `textTextarea`. `jsonProperties` carries only the metadata wrapper keys.

---

## hidden-image

**Storage pattern:** htmlView-only | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215QCFGOX</odePageId>
  <odeBlockId>20251022181215FUGKLE</odeBlockId>
  <odeIdeviceId>20250605150704EJQUEU</odeIdeviceId>
  <odeIdeviceTypeName>hidden-image</odeIdeviceTypeName>
  <htmlView>
    <!-- Image with a progressively-revealed overlay. The image path,
         overlay grid configuration, and reveal order are embedded
         directly in the HTML. No jsonProperties data store. -->
    ... (htmlView content trimmed for readability) ...
  </htmlView>
  <jsonProperties/>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The hidden-image iDevice uses the htmlView-only pattern. The image source path and the grid-tile reveal configuration are encoded directly in the `htmlView` HTML structure. `<jsonProperties/>` is self-closing.

---

## identify

**Storage pattern:** URI-encoded JSON in hidden div | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215XHHSMU</odePageId>
  <odeBlockId>20251022181215ACLAEU</odeBlockId>
  <odeIdeviceId>20250605150704VWUSZO</odeIdeviceId>
  <odeIdeviceTypeName>identify</odeIdeviceTypeName>
  <htmlView>... (htmlView content trimmed for readability) ...</htmlView>
  <jsonProperties>{"ideviceId":"20250605150704VWUSZO",
    "textInfoDurationInput":"",
    "textInfoDurationTextInput":"Duración",
    "textInfoParticipantsInput":"",
    "textInfoParticipantsTextInput":"Agrupamiento",
    "textTextarea":"... (full iDevice HTML with identify game data) ...",
    "textFeedbackInput":"Mostrar retroalimentación",
    "textFeedbackTextarea":""}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The identify iDevice (click-on-image hotspot activity) uses the URI-encoded JSON in hidden div pattern. Hotspot coordinates and labels are stored as percent-encoded JSON in a hidden div inside `textTextarea`. `jsonProperties` contains only the metadata wrapper keys.

---

## image-gallery

**Storage pattern:** Standard JSON | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-manual/content.xml`

```xml
<odeComponent>
  <odePageId>20251027202947LOYKIH</odePageId>
  <odeBlockId>20251027202947XBZMTO</odeBlockId>
  <odeIdeviceId>20251023084607814UOH</odeIdeviceId>
  <odeIdeviceTypeName>image-gallery</odeIdeviceTypeName>
  <htmlView>
    &lt;!-- Idevice Example template start --&gt;
    &lt;div class="exe-image-gallery-template"&gt;
      &lt;div class="imageGallery-IDevice"&gt;
        &lt;div class="imageGallery-body"&gt;
          &lt;div id="imageContainer_0" class="imageContainer"&gt;
            &lt;a idevice-id="20251023084607814UOH"
               title="mito común"
               href="{{context_path}}/20251023084607814UOH//1X5A5365.jpg"
               class="imageLink"&gt;
              &lt;div class="imageElement"&gt;
                &lt;img src="{{context_path}}/20251023084607814UOH//1X5A5365_thumb.jpg"
                     height="128" width="128"
                     title="mito común" alt="mito común"
                     author="Pablo Amaya"
                     authorlink="https://www.instagram.com/pabloamayabarbosa/"
                     license="CC-BY-SA"
                     licenselink="http://creativecommons.org/licenses/"/&gt;
              &lt;/div&gt;
            &lt;/a&gt;
          &lt;/div&gt;
          &lt;!-- additional imageContainer_N divs follow the same pattern --&gt;
        &lt;/div&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  </htmlView>
  <jsonProperties>{"ideviceId":"20251023084607814UOH",
    "img_0":{
      "img":"{{context_path}}/20251023084607814UOH//1X5A5365.jpg",
      "thumbnail":"{{context_path}}/20251023084607814UOH//1X5A5365_thumb.jpg",
      "title":"mito común",
      "linktitle":"",
      "author":"Pablo Amaya",
      "linkauthor":"https://www.instagram.com/pabloamayabarbosa/",
      "license":"CC-BY-SA"
    },
    "img_1":{
      "img":"{{context_path}}/20251023084607814UOH//IMG_1913.jpg",
      "thumbnail":"{{context_path}}/20251023084607814UOH//IMG_1913_thumb.jpg",
      "title":"milano negro",
      "linktitle":"",
      "author":"Pablo Amaya",
      "linkauthor":"https://www.instagram.com/pabloamayabarbosa/",
      "license":"CC-BY-SA"
    }
  }
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>teacherOnly</key><value>false</value></odeComponentsProperty>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The image-gallery iDevice uses Standard JSON. Images are stored as numbered keys `img_0`, `img_1`, ..., `img_N` in `jsonProperties`. Each object has `img` (full-size path), `thumbnail` (thumb path), `title`, `linktitle` (optional link URL for the title), `author`, `linkauthor`, and `license`. Paths use the `{{context_path}}/IDEVICEID/FILENAME` template pattern, which the exporter resolves to the actual asset location. Thumbnail filenames follow the convention `BASENAME_thumb.EXT`.

---

## interactive-video

**Storage pattern:** htmlView-only | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215SZEJVR</odePageId>
  <odeBlockId>20251022181215JOTXJP</odeBlockId>
  <odeIdeviceId>20250605150704XZJSFI</odeIdeviceId>
  <odeIdeviceTypeName>interactive-video</odeIdeviceTypeName>
  <htmlView>
    <!-- Interactive video player with question overlays at specified
         timestamps. Video URL and question data are encoded directly
         in the HTML. No jsonProperties data store. -->
    ... (htmlView content trimmed for readability) ...
  </htmlView>
  <jsonProperties/>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The interactive-video iDevice uses the htmlView-only pattern. The video source URL and timestamped question overlays are encoded directly in the `htmlView` HTML. `<jsonProperties/>` is self-closing.

---

## magnifier

**Storage pattern:** Standard JSON | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-manual/content.xml`

```xml
<odeComponent>
  <odePageId>20251027202947VBLZIJ</odePageId>
  <odeBlockId>20251027202947PCBSRS</odeBlockId>
  <odeIdeviceId>2025102112033528604B</odeIdeviceId>
  <odeIdeviceTypeName>magnifier</odeIdeviceTypeName>
  <htmlView>&lt;div class="exe-magnifier-container"&gt;
  &lt;div class="MNF-MainContainer" id="mnfPMainContainer-2025102112033528604B"
       style="display:flex; flex-direction:row; align-items:flex-start;"&gt;
    &lt;div class="MNF-instructions" style="flex:1;"&gt;
      &lt;p&gt;Elige el nivel de aumento y el tamaño de la lupa.&lt;/p&gt;
    &lt;/div&gt;
    &lt;div class="MNF-image-wrapper" id="image-wrapper-2025102112033528604B"&gt;
      &lt;div class="ImageMagnifierIdevice"&gt;
        &lt;div class="image-thumbnail" id="image-thumbnail-2025102112033528604B"&gt;
          &lt;div style="position:relative; display:block; width:400; height:auto;"&gt;
            &lt;img id="magnifier-2025102112033528604B"
                 src="{{context_path}}/2025102112033528604B/myimage.jpg"
                 data-magnifysrc="{{context_path}}/2025102112033528604B/myimage.jpg"
                 width="400"
                 data-size="2"
                 data-zoom="200"&gt;
          &lt;/div&gt;
        &lt;/div&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  &lt;/div&gt;
&lt;/div&gt;</htmlView>
  <jsonProperties>{"id":"2025102112033528604B",
    "typeGame":"magnifier",
    "textTextarea":"&lt;p&gt;Instruction text HTML&lt;/p&gt;",
    "isDefaultImage":"1",
    "imageResource":"",
    "defaultImage":"http://localhost:41309/files/perm/idevices/base/magnifier/edition/hood.jpg",
    "height":"",
    "width":"400",
    "align":"right",
    "initialZSize":"200",
    "maxZSize":600,
    "glassSize":"2",
    "ideviceId":"2025102112033528604B"}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>teacherOnly</key><value>false</value></odeComponentsProperty>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The magnifier iDevice uses Standard JSON. Key fields: `imageResource` is the user-uploaded asset path (empty if using `defaultImage`); `width`/`height` control the display dimensions; `initialZSize` is the initial zoom percentage; `maxZSize` is the maximum zoom; `glassSize` controls the magnifier lens radius (1–3 scale). `isDefaultImage` is `"1"` when using the bundled placeholder image. The `img` element carries `data-zoom` and `data-size` attributes that the magnifier script reads at runtime.

---

## map

**Storage pattern:** URI-encoded JSON in hidden div | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215FFFDXR</odePageId>
  <odeBlockId>20251022181215TOHERQ</odeBlockId>
  <odeIdeviceId>20250605150704RCMMJH</odeIdeviceId>
  <odeIdeviceTypeName>map</odeIdeviceTypeName>
  <htmlView>... (htmlView content trimmed for readability) ...</htmlView>
  <jsonProperties>{"ideviceId":"20250605150704RCMMJH",
    "textInfoDurationInput":"",
    "textInfoDurationTextInput":"Duración",
    "textInfoParticipantsInput":"",
    "textInfoParticipantsTextInput":"Agrupamiento",
    "textTextarea":"... (full iDevice HTML with map markers data) ...",
    "textFeedbackInput":"Mostrar retroalimentación",
    "textFeedbackTextarea":""}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The map iDevice uses the URI-encoded JSON in hidden div pattern. The Leaflet/OpenStreetMap configuration — including centre coordinates, zoom level, and all marker definitions with popup HTML — is stored as percent-encoded JSON in a hidden div inside `textTextarea`. Given that the map data can be very large (over 70 KB for a rich map), this is one of the largest `htmlView` payloads in the fixture set.

---

## mathematicaloperations

**Storage pattern:** URI-encoded JSON in hidden div | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215NHKMBU</odePageId>
  <odeBlockId>20251022181215JDOTYI</odeBlockId>
  <odeIdeviceId>20250605150704MEZACM</odeIdeviceId>
  <odeIdeviceTypeName>mathematicaloperations</odeIdeviceTypeName>
  <htmlView>... (htmlView content trimmed for readability) ...</htmlView>
  <jsonProperties>{"ideviceId":"20250605150704MEZACM",
    "textInfoDurationInput":"",
    "textInfoDurationTextInput":"Duración",
    "textInfoParticipantsInput":"",
    "textInfoParticipantsTextInput":"Agrupamiento",
    "textTextarea":"... (full iDevice HTML with operations data) ...",
    "textFeedbackInput":"Mostrar retroalimentación",
    "textFeedbackTextarea":""}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The mathematicaloperations iDevice uses the URI-encoded JSON in hidden div pattern. Arithmetic operation sets (operands, operators, expected results) are stored as percent-encoded JSON in a hidden div inside `textTextarea`. `jsonProperties` carries only the standard metadata wrapper.

---

## mathproblems

**Storage pattern:** URI-encoded JSON in hidden div | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215NUIQEQ</odePageId>
  <odeBlockId>20251022181215FAMKCN</odeBlockId>
  <odeIdeviceId>20250605150704ZVCKDV</odeIdeviceId>
  <odeIdeviceTypeName>mathproblems</odeIdeviceTypeName>
  <htmlView>... (htmlView content trimmed for readability) ...</htmlView>
  <jsonProperties>{"ideviceId":"20250605150704ZVCKDV",
    "textInfoDurationInput":"",
    "textInfoDurationTextInput":"Duración",
    "textInfoParticipantsInput":"",
    "textInfoParticipantsTextInput":"Agrupamiento",
    "textTextarea":"... (full iDevice HTML with math problems data) ...",
    "textFeedbackInput":"Mostrar retroalimentación",
    "textFeedbackTextarea":""}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The mathproblems iDevice uses the URI-encoded JSON in hidden div pattern. Word problem text, numeric parameters, and answer validation rules are stored as percent-encoded JSON in a hidden div inside `textTextarea`. `jsonProperties` carries only the metadata wrapper.

---

## padlock

**Storage pattern:** URI-encoded JSON in hidden div | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215ZAQUEM</odePageId>
  <odeBlockId>20251022181215EHMYSL</odeBlockId>
  <odeIdeviceId>20250605150704TQZSKC</odeIdeviceId>
  <odeIdeviceTypeName>padlock</odeIdeviceTypeName>
  <htmlView>... (htmlView content trimmed for readability) ...</htmlView>
  <jsonProperties>{"ideviceId":"20250605150704TQZSKC",
    "textInfoDurationInput":"",
    "textInfoDurationTextInput":"Duración",
    "textInfoParticipantsInput":"",
    "textInfoParticipantsTextInput":"Agrupamiento",
    "textTextarea":"... (full iDevice HTML with padlock code data) ...",
    "textFeedbackInput":"Mostrar retroalimentación",
    "textFeedbackTextarea":""}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The padlock iDevice (combination-lock puzzle requiring learners to enter a code unlocked by solving sub-activities) uses the URI-encoded JSON in hidden div pattern. The lock code, hint text, and sub-activity references are stored as percent-encoded JSON in a hidden div inside `textTextarea`.

---

## periodic-table

**Storage pattern:** htmlView-only | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215DGWYTQ</odePageId>
  <odeBlockId>20251022181215NSTGVS</odeBlockId>
  <odeIdeviceId>20250605150704QLHEQO</odeIdeviceId>
  <odeIdeviceTypeName>periodic-table</odeIdeviceTypeName>
  <htmlView>
    <!-- Interactive periodic table of elements. All element data,
         highlighting configuration, and display mode are encoded
         directly in the HTML. No jsonProperties data store. -->
    ... (htmlView content trimmed for readability) ...
  </htmlView>
  <jsonProperties/>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The periodic-table iDevice uses the htmlView-only pattern. The full element dataset, any highlighted elements, and the display configuration are embedded directly in the `htmlView` HTML. `<jsonProperties/>` is self-closing.

---

## progress-report

**Storage pattern:** htmlView-only | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215EWDTOA</odePageId>
  <odeBlockId>20251022181215FKXNRG</odeBlockId>
  <odeIdeviceId>20251022200826143PUO</odeIdeviceId>
  <odeIdeviceTypeName>progress-report</odeIdeviceTypeName>
  <htmlView>
    <!-- Aggregate score and completion dashboard. Reads SCORM runtime
         data to display progress across the package. All dashboard
         configuration is embedded in the HTML. No jsonProperties store. -->
    ... (htmlView content trimmed for readability) ...
  </htmlView>
  <jsonProperties/>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>teacherOnly</key><value>false</value></odeComponentsProperty>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The progress-report iDevice uses the htmlView-only pattern. It renders a SCORM progress dashboard that reads live completion and score data from the SCORM runtime at display time. No editable JSON properties are stored; the entire widget configuration is baked into `htmlView`.

---

## puzzle

**Storage pattern:** URI-encoded JSON in hidden div | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215HNRPFM</odePageId>
  <odeBlockId>20251022181215UIHYZA</odeBlockId>
  <odeIdeviceId>20250605150704FOKAPF</odeIdeviceId>
  <odeIdeviceTypeName>puzzle</odeIdeviceTypeName>
  <htmlView>... (htmlView content trimmed for readability) ...</htmlView>
  <jsonProperties>{"ideviceId":"20250605150704FOKAPF",
    "textInfoDurationInput":"",
    "textInfoDurationTextInput":"Duración",
    "textInfoParticipantsInput":"",
    "textInfoParticipantsTextInput":"Agrupamiento",
    "textTextarea":"... (full iDevice HTML with puzzle image data) ...",
    "textFeedbackInput":"Mostrar retroalimentación",
    "textFeedbackTextarea":""}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The puzzle iDevice uses the URI-encoded JSON in hidden div pattern. The source image path, grid dimensions (rows × columns), and tile order are stored as percent-encoded JSON in a hidden div inside `textTextarea`.

---

## quick-questions

**Storage pattern:** URI-encoded JSON in hidden div | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215SFKZHH</odePageId>
  <odeBlockId>20251022181215DQADOW</odeBlockId>
  <odeIdeviceId>20250605150704UJHZFQ</odeIdeviceId>
  <odeIdeviceTypeName>quick-questions</odeIdeviceTypeName>
  <htmlView>... (htmlView content trimmed for readability) ...</htmlView>
  <jsonProperties>{"ideviceId":"20250605150704UJHZFQ",
    "textInfoDurationInput":"",
    "textInfoDurationTextInput":"Duración",
    "textInfoParticipantsInput":"",
    "textInfoParticipantsTextInput":"Agrupamiento",
    "textTextarea":"... (full iDevice HTML with test questions data) ...",
    "textFeedbackInput":"Mostrar retroalimentación",
    "textFeedbackTextarea":""}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The quick-questions (Test) iDevice uses the URI-encoded JSON in hidden div pattern. Short-answer and true/false questions with their correct answers are stored as percent-encoded JSON in a hidden div inside `textTextarea`. `jsonProperties` carries only the metadata wrapper.

---

## quick-questions-multiple-choice

**Storage pattern:** URI-encoded JSON in hidden div | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215VQFAZW</odePageId>
  <odeBlockId>20251022181215AFDFKE</odeBlockId>
  <odeIdeviceId>20250605150704XZIELR</odeIdeviceId>
  <odeIdeviceTypeName>quick-questions-multiple-choice</odeIdeviceTypeName>
  <htmlView>... (htmlView content trimmed for readability) ...</htmlView>
  <jsonProperties>{"ideviceId":"20250605150704XZIELR",
    "textInfoDurationInput":"",
    "textInfoDurationTextInput":"Duración",
    "textInfoParticipantsInput":"",
    "textInfoParticipantsTextInput":"Agrupamiento",
    "textTextarea":"... (full iDevice HTML with MC questions data) ...",
    "textFeedbackInput":"Mostrar retroalimentación",
    "textFeedbackTextarea":""}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The quick-questions-multiple-choice (Select) iDevice uses the URI-encoded JSON in hidden div pattern. Multiple-choice question definitions — question text, answer options, and correct answer indices — are stored as percent-encoded JSON in a hidden div inside `textTextarea`.

---

## quick-questions-video

**Storage pattern:** URI-encoded JSON in hidden div | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215FZKWXE</odePageId>
  <odeBlockId>20251022181215OZZZNR</odeBlockId>
  <odeIdeviceId>20250605150704YGWXFR</odeIdeviceId>
  <odeIdeviceTypeName>quick-questions-video</odeIdeviceTypeName>
  <htmlView>... (htmlView content trimmed for readability) ...</htmlView>
  <jsonProperties>{"ideviceId":"20250605150704YGWXFR",
    "textInfoDurationInput":"",
    "textInfoDurationTextInput":"Duración",
    "textInfoParticipantsInput":"",
    "textInfoParticipantsTextInput":"Agrupamiento",
    "textTextarea":"... (full iDevice HTML with video test data) ...",
    "textFeedbackInput":"Mostrar retroalimentación",
    "textFeedbackTextarea":""}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The quick-questions-video (Video test) iDevice uses the URI-encoded JSON in hidden div pattern. A video URL, pause timestamps, and per-timestamp question definitions are stored as percent-encoded JSON in a hidden div inside `textTextarea`.

---

## relate

**Storage pattern:** URI-encoded JSON in hidden div | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215ACZURA</odePageId>
  <odeBlockId>20251022181215RLQGVW</odeBlockId>
  <odeIdeviceId>20250605150704BRBLML</odeIdeviceId>
  <odeIdeviceTypeName>relate</odeIdeviceTypeName>
  <htmlView>... (htmlView content trimmed for readability) ...</htmlView>
  <jsonProperties>{"ideviceId":"20250605150704BRBLML",
    "textInfoDurationInput":"",
    "textInfoDurationTextInput":"Duración",
    "textInfoParticipantsInput":"",
    "textInfoParticipantsTextInput":"Agrupamiento",
    "textTextarea":"... (full iDevice HTML with matching pairs data) ...",
    "textFeedbackInput":"Mostrar retroalimentación",
    "textFeedbackTextarea":""}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The relate (matching-pairs) iDevice uses the URI-encoded JSON in hidden div pattern. Left-column and right-column item pairs are stored as percent-encoded JSON in a hidden div inside `textTextarea`.

---

## rubric

**Storage pattern:** htmlView-only | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-manual/content.xml`

```xml
<odeComponent>
  <odePageId>20251027202947HBMUNP</odePageId>
  <odeBlockId>20251027202947GCSDFW</odeBlockId>
  <odeIdeviceId>20251021091936UTBELO</odeIdeviceId>
  <odeIdeviceTypeName>rubric</odeIdeviceTypeName>
  <htmlView>&lt;table class="exe-table"&gt;
  &lt;caption&gt;Rúbrica para evaluar un trabajo escrito&lt;/caption&gt;
  &lt;thead&gt;
    &lt;tr&gt;
      &lt;th&gt;&amp;nbsp;&lt;/th&gt;
      &lt;th&gt;4 Excelente&lt;/th&gt;
      &lt;th&gt;3 Satisfactorio&lt;/th&gt;
      &lt;th&gt;2 Mejorable&lt;/th&gt;
      &lt;th&gt;1 Insuficiente&lt;/th&gt;
    &lt;/tr&gt;
  &lt;/thead&gt;
  &lt;tbody&gt;
    &lt;tr&gt;
      &lt;th&gt;Aspectos formales&lt;/th&gt;
      &lt;td&gt;Cumple todos los aspectos. &lt;span&gt;(4)&lt;/span&gt;&lt;/td&gt;
      &lt;td&gt;Cumple casi todos. &lt;span&gt;(3)&lt;/span&gt;&lt;/td&gt;
      &lt;td&gt;Cumple algunos. &lt;span&gt;(2)&lt;/span&gt;&lt;/td&gt;
      &lt;td&gt;No cumple. &lt;span&gt;(1)&lt;/span&gt;&lt;/td&gt;
    &lt;/tr&gt;
    &lt;!-- additional criterion rows follow the same pattern --&gt;
  &lt;/tbody&gt;
&lt;/table&gt;
&lt;p class="exe-rubrics-authorship"&gt;
  &lt;a href="http://cedec.intef.es/" class="author"&gt;CEDEC&lt;/a&gt;.
  &lt;span class="title"&gt;&lt;em&gt;Rubric title&lt;/em&gt;&lt;/span&gt;
  &lt;span class="license"&gt;(&lt;a href="..." rel="license"&gt;CC BY-SA&lt;/a&gt;)&lt;/span&gt;
&lt;/p&gt;
&lt;ul class="exe-rubrics-strings"&gt;
  &lt;li class="activity"&gt;Actividad&lt;/li&gt;
  &lt;li class="name"&gt;Nombre&lt;/li&gt;
  &lt;li class="date"&gt;Fecha&lt;/li&gt;
  &lt;li class="score"&gt;Puntuación&lt;/li&gt;
  &lt;li class="notes"&gt;Notas&lt;/li&gt;
  &lt;li class="reset"&gt;Reiniciar&lt;/li&gt;
  &lt;li class="print"&gt;Imprimir&lt;/li&gt;
&lt;/ul&gt;</htmlView>
  <jsonProperties/>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>teacherOnly</key><value>false</value></odeComponentsProperty>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The rubric iDevice uses the htmlView-only pattern. The entire assessment grid is stored as an HTML table; `<jsonProperties/>` is self-closing. The `class="exe-rubrics-strings"` `<ul>` element carries localised label strings (activity, name, date, score, notes, reset, print) that the rubric JavaScript reads at runtime to populate the printable evaluation form.

---

## scrambled-list

**Storage pattern:** Standard JSON | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215ARMDHO</odePageId>
  <odeBlockId>20251022181215ZTHBCN</odeBlockId>
  <odeIdeviceId>20250605150704CJUQLN</odeIdeviceId>
  <odeIdeviceTypeName>scrambled-list</odeIdeviceTypeName>
  <htmlView>... (htmlView content trimmed for readability) ...</htmlView>
  <jsonProperties>{"typeGame":"ScrambledList",
    "instructions":"&lt;p&gt;Sort the items into the correct order&lt;/p&gt;",
    "textAfter":"",
    "afterElement":"",
    "options":["First item","Second item","Third item"],
    "time":0,
    "buttonText":"Comprobar",
    "rightText":"¡Correcto!",
    "wrongText":"Inténtalo de nuevo",
    "isScorm":1,
    "textButtonScorm":"Guardar puntuación",
    "repeatActivity":true,
    "weighted":100,
    "evaluation":true,
    "evaluationID":"987654T",
    "ideviceId":"20250605150704CJUQLN"}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The scrambled-list iDevice is notable for using the api-version 3.0 Standard JSON pattern even though it is categorised as an interactive activity. `options` is an ordered array of strings representing the correct sequence (the editor scrambles them for display). `instructions` is rich-text HTML. `time` is a per-item time limit in seconds (0 = unlimited). `rightText`/`wrongText` are feedback labels. `evaluation` + `evaluationID` enable SCORM score tracking.

---

## select-media-files

**Storage pattern:** URI-encoded JSON in hidden div | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215NQHJFI</odePageId>
  <odeBlockId>20251022181215HRTVWF</odeBlockId>
  <odeIdeviceId>20250605150704KZYGBR</odeIdeviceId>
  <odeIdeviceTypeName>select-media-files</odeIdeviceTypeName>
  <htmlView>... (htmlView content trimmed for readability) ...</htmlView>
  <jsonProperties>{"ideviceId":"20250605150704KZYGBR",
    "textInfoDurationInput":"",
    "textInfoDurationTextInput":"Duración",
    "textInfoParticipantsInput":"",
    "textInfoParticipantsTextInput":"Agrupamiento",
    "textTextarea":"... (full iDevice HTML with media selection data) ...",
    "textFeedbackInput":"Mostrar retroalimentación",
    "textFeedbackTextarea":""}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The select-media-files iDevice uses the URI-encoded JSON in hidden div pattern. The list of media items (images or audio clips) from which the learner must select the correct answer is stored as percent-encoded JSON in a hidden div inside `textTextarea`.

---

## sort

**Storage pattern:** URI-encoded JSON in hidden div | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215WAYWUV</odePageId>
  <odeBlockId>20251022181215XVBSYN</odeBlockId>
  <odeIdeviceId>20250605150704WQAZQP</odeIdeviceId>
  <odeIdeviceTypeName>sort</odeIdeviceTypeName>
  <htmlView>... (htmlView content trimmed for readability) ...</htmlView>
  <jsonProperties>{"ideviceId":"20250605150704WQAZQP",
    "textInfoDurationInput":"",
    "textInfoDurationTextInput":"Duración",
    "textInfoParticipantsInput":"",
    "textInfoParticipantsTextInput":"Agrupamiento",
    "textTextarea":"... (full iDevice HTML with sort activity data) ...",
    "textFeedbackInput":"Mostrar retroalimentación",
    "textFeedbackTextarea":""}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The sort iDevice uses the URI-encoded JSON in hidden div pattern. Items to be placed in chronological or logical order, together with their correct sequence indices, are stored as percent-encoded JSON in a hidden div inside `textTextarea`.

---

## text

**Storage pattern:** Standard JSON | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-manual/content.xml`

```xml
<odeComponent>
  <odePageId>20251027202947MKIISA</odePageId>
  <odeBlockId>20251027202947EDIAYV</odeBlockId>
  <odeIdeviceId>20251025070914XDRVFP</odeIdeviceId>
  <odeIdeviceTypeName>text</odeIdeviceTypeName>
  <htmlView>&lt;div class="exe-text-template"&gt;
  &lt;div class="textIdeviceContent"&gt;
    &lt;div class="exe-text-activity"&gt;
      &lt;div&gt;
        &lt;div class="exe-text"&gt;
          &lt;h1 style="text-align:center;"&gt;Manual de eXeLearning 3.0&lt;/h1&gt;
          &lt;p&gt;&lt;img src="{{context_path}}/20251025070914XDRVFP/logo.png"
                   width="342" height="309" alt="logo exe"
                   style="display:block; margin-left:auto; margin-right:auto;"&gt;&lt;/p&gt;
          &lt;p style="text-align:center;"&gt;Guía práctica...&lt;/p&gt;
        &lt;/div&gt;
        &lt;p class="clearfix"&gt;&lt;/p&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  &lt;/div&gt;
&lt;/div&gt;</htmlView>
  <jsonProperties>{"ideviceId":"20251025070914XDRVFP",
    "textInfoDurationInput":"",
    "textInfoDurationTextInput":"Duración",
    "textInfoParticipantsInput":"",
    "textInfoParticipantsTextInput":"Agrupamiento",
    "textTextarea":"&lt;div class=\"exe-text\"&gt;\n&lt;h1&gt;...&lt;/h1&gt;\n...&lt;/div&gt;",
    "textFeedbackInput":"Mostrar retroalimentación",
    "textFeedbackTextarea":""}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>teacherOnly</key><value>false</value></odeComponentsProperty>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The text iDevice uses Standard JSON. `textTextarea` is the primary content field and contains the rich-text HTML wrapped in `<div class="exe-text">`. Image paths within the HTML use the `{{context_path}}/IDEVICEID/FILENAME` template. `textFeedbackTextarea` holds optional collapsible feedback HTML. `textInfoDurationInput` and `textInfoParticipantsInput` are optional lesson-metadata values rendered as a definition list above the main content when non-empty.

---

## trivial

**Storage pattern:** URI-encoded JSON in hidden div | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215YFOJCC</odePageId>
  <odeBlockId>20251022181215DWGNCI</odeBlockId>
  <odeIdeviceId>20250605150704UZELMR</odeIdeviceId>
  <odeIdeviceTypeName>trivial</odeIdeviceTypeName>
  <htmlView>... (htmlView content trimmed for readability) ...</htmlView>
  <jsonProperties>{"ideviceId":"20250605150704UZELMR",
    "textInfoDurationInput":"",
    "textInfoDurationTextInput":"Duración",
    "textInfoParticipantsInput":"",
    "textInfoParticipantsTextInput":"Agrupamiento",
    "textTextarea":"... (full iDevice HTML with trivial game data) ...",
    "textFeedbackInput":"Mostrar retroalimentación",
    "textFeedbackTextarea":""}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The trivial (TriviExt) iDevice uses the URI-encoded JSON in hidden div pattern. Question categories, question text, answer options, and correct answer indices are stored as percent-encoded JSON in a hidden div inside `textTextarea`.

---

## trueorfalse

**Storage pattern:** Standard JSON | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215YMBLFO</odePageId>
  <odeBlockId>20251022181215BQSJQR</odeBlockId>
  <odeIdeviceId>20250605150704MFDSBR</odeIdeviceId>
  <odeIdeviceTypeName>trueorfalse</odeIdeviceTypeName>
  <htmlView>
    <!-- Pre-rendered True-or-False game. The game scaffold HTML is
         included; question data is in jsonProperties.questionsGame. -->
    ... (htmlView content trimmed for readability) ...
  </htmlView>
  <jsonProperties>{"id":"20250605150704MFDSBR",
    "typeGame":"TrueOrFalse",
    "eXeGameInstructions":"&lt;p&gt;Revisión Final&lt;/p&gt;",
    "eXeIdeviceTextAfter":"",
    "msgs":{
      "msgStartGame":"Haz clic aquí para empezar",
      "msgTrue":"Verdadero",
      "msgFalse":"Falso",
      "msgOk":"Correcto",
      "msgKO":"Incorrecto",
      "msgCheck":"Comprobar",
      "msgReboot":"Inténtalo de nuevo",
      "msgScore":"Puntuación"
    },
    "questionsRandom":false,
    "percentageQuestions":50,
    "isTest":true,
    "time":0,
    "questionsGame":[
      {
        "question":"&lt;p&gt;¿Las plantas realizan la fotosíntesis durante la noche?&lt;/p&gt;",
        "feedback":"&lt;p&gt;La fotosíntesis requiere energía luminosa.&lt;/p&gt;",
        "suggestion":"&lt;p&gt;Reflexiona sobre la necesidad de la luz solar.&lt;/p&gt;",
        "solution":0
      },
      {
        "question":"&lt;p&gt;¿Los metales son buenos conductores de electricidad?&lt;/p&gt;",
        "feedback":"&lt;p&gt;Su estructura atómica permite el libre movimiento de electrones.&lt;/p&gt;",
        "suggestion":"&lt;p&gt;Piensa en los materiales usados en cables eléctricos.&lt;/p&gt;",
        "solution":1
      }
    ],
    "isScorm":1,
    "textButtonScorm":"Guardar puntuación",
    "repeatActivity":true,
    "weighted":100,
    "evaluation":true,
    "evaluationID":"987654T",
    "ideviceId":"20250605150704MFDSBR"}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The trueorfalse iDevice uses Standard JSON. `questionsGame` is an array of question objects each having `question` (HTML), `feedback` (HTML shown after answer), `suggestion` (hint HTML), and `solution` (0 = false, 1 = true). `percentageQuestions` controls how many questions are drawn from the pool per session. `time` is a per-question timer in seconds (0 = unlimited). `msgs` carries all user-visible string labels, enabling full localisation. `evaluation` + `evaluationID` activate SCORM score submission.

---

## udl-content

**Storage pattern:** Standard JSON | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-manual/content.xml`

```xml
<odeComponent>
  <odePageId>20251027202947XQHCJW</odePageId>
  <odeBlockId>20251027202947RLIQTV</odeBlockId>
  <odeIdeviceId>20251021091936QALZGN</odeIdeviceId>
  <odeIdeviceTypeName>udl-content</odeIdeviceTypeName>
  <htmlView>&lt;div class="exe-udlContent exe-udlContent-engagement"&gt;
  &lt;section class="exe-udlContent-block"&gt;
    &lt;div class="exe-udlContent-content"&gt;
      &lt;div class="exe-udlContent-content-main"&gt;
        &lt;h2&gt;Apoyos al contenido principal&lt;/h2&gt;
        &lt;p&gt;7 Razones para usar Software Libre...&lt;/p&gt;
      &lt;/div&gt;
      &lt;article class="exe-udlContent-content-audio js-hidden"&gt;
        &lt;header class="exe-udlContent-alt-content-title"&gt;&lt;h2&gt;Audio&lt;/h2&gt;&lt;/header&gt;
        &lt;audio controls="controls"
               src="{{context_path}}/20251021091936QALZGN/audio.webm"&gt;
        &lt;/audio&gt;
        &lt;button class="exe-udlContent-alt-content-hide"&gt;Cerrar&lt;/button&gt;
      &lt;/article&gt;
      &lt;article class="exe-udlContent-content-visual js-hidden"&gt;
        &lt;header class="exe-udlContent-alt-content-title"&gt;&lt;h2&gt;Apoyo visual&lt;/h2&gt;&lt;/header&gt;
        &lt;img src="{{context_path}}/20251021091936QALZGN/infographic.png"
             alt="infografía" width="600" height="424"&gt;
        &lt;button class="exe-udlContent-alt-content-hide"&gt;Cerrar&lt;/button&gt;
      &lt;/article&gt;
    &lt;/div&gt;
  &lt;/section&gt;
&lt;/div&gt;</htmlView>
  <jsonProperties>{"ideviceId":"20251021091936QALZGN",
    "textInfoDurationInput":"",
    "textInfoParticipantsInput":"",
    "textInfoDurationTextInput":"",
    "textInfoParticipantsTextInput":"",
    "textTextarea":"... (full UDL HTML including main, audio, and visual sections) ...",
    "textFeedbackInput":"",
    "textFeedbackTextarea":""}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>teacherOnly</key><value>false</value></odeComponentsProperty>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The udl-content (UDL Content) iDevice uses Standard JSON. `textTextarea` stores the full UDL block HTML including all three representation layers: `exe-udlContent-content-main` (primary text), `exe-udlContent-content-audio` (audio alternative), and `exe-udlContent-content-visual` (visual alternative). The outer div class `exe-udlContent-engagement` / `-representation` / `-action` encodes the UDL principle. Alternative sections are hidden by default (`js-hidden`) and toggled by the UDL navigation buttons rendered by the export template.

---

## word-search

**Storage pattern:** URI-encoded JSON in hidden div | **Downloadable:** no

Source: `/tmp/elpx-docs-work/fix-todos/content.xml`

```xml
<odeComponent>
  <odePageId>20251022181215PCJNMN</odePageId>
  <odeBlockId>20251022181215NOITNZ</odeBlockId>
  <odeIdeviceId>20250605150704YZXLPV</odeIdeviceId>
  <odeIdeviceTypeName>word-search</odeIdeviceTypeName>
  <htmlView>... (htmlView content trimmed for readability) ...</htmlView>
  <jsonProperties>{"ideviceId":"20250605150704YZXLPV",
    "textInfoDurationInput":"",
    "textInfoDurationTextInput":"Duración",
    "textInfoParticipantsInput":"",
    "textInfoParticipantsTextInput":"Agrupamiento",
    "textTextarea":"... (full iDevice HTML with word-search grid data) ...",
    "textFeedbackInput":"Mostrar retroalimentación",
    "textFeedbackTextarea":""}
  </jsonProperties>
  <odeComponentsOrder>1</odeComponentsOrder>
  <odeComponentsProperties>
    <odeComponentsProperty><key>identifier</key><value/></odeComponentsProperty>
    <odeComponentsProperty><key>visibility</key><value>true</value></odeComponentsProperty>
    <odeComponentsProperty><key>cssClass</key><value/></odeComponentsProperty>
  </odeComponentsProperties>
</odeComponent>
```

The word-search iDevice uses the URI-encoded JSON in hidden div pattern. The letter grid, word list, and direction configuration are stored as percent-encoded JSON in a hidden div inside `textTextarea`. `jsonProperties` carries only the metadata wrapper keys.

---

## See also

- [`catalog.md`](catalog.md) — master table of all iDevice types with categories, downloadable flags, api-version, and legacy import aliases
- [`patterns.md`](patterns.md) — detailed explanation of the four storage patterns (Standard JSON, URI-encoded JSON in hidden div, htmlView-only, embedded script JSON)
- [`config-xml.md`](config-xml.md) — schema reference for the per-iDevice `config.xml` metadata file
- [`../content-xml.md`](../content-xml.md) — top-level `content.xml` structure: pages, blocks, and the `<odeComponents>` container that holds these `<odeComponent>` elements
