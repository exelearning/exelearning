# Minimal content.xml

This is the smallest valid `content.xml` you can write: one root page, one block, one `text`
iDevice. Every element shown here is required — remove any of them and the importer will either
reject the file or silently drop content.

The generator that produces this XML is `src/shared/export/generators/OdeXmlGenerator.ts`.
The full element reference lives in [../content-xml.md](../content-xml.md). For iDevice-specific
HTML and JSON shapes see [../idevices/snippets.md](../idevices/snippets.md).

To turn this `content.xml` into a working `.elpx`, wrap it in a ZIP — see the recipe at the end
of this page.

---

## The complete XML

The listing below is annotated with inline comments. Every element and attribute is mandatory
unless a comment says otherwise.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!-- Processing instruction: XML 1.0, UTF-8. The generator always writes this first line. -->

<!DOCTYPE ode SYSTEM "content.dtd">
<!-- DTD declaration. The filename "content.dtd" is the value of the ODE_DTD_FILENAME constant
     (src/shared/export/constants.ts). The DTD file must exist at the same path inside the ZIP.
     Omit this line only for IMS/SCORM exports where no DTD is bundled. -->

<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
  <!-- Root element. xmlns and version are fixed values; do not change them. -->

  <!-- ═══════════════════════════════════════════════════════════════════════
       SECTION 1: userPreferences
       User-level settings stored with the document.  Currently only "theme"
       is written.  The value is the folder name under the bundled themes
       directory; "base" is the default theme shipped with eXeLearning.
       ═══════════════════════════════════════════════════════════════════════ -->
  <userPreferences>
    <userPreference>
      <key>theme</key>
      <value>base</value>
      <!-- Other possible values: "lernmodule", "formal_darkgray", or any custom theme name. -->
    </userPreference>
  </userPreferences>

  <!-- ═══════════════════════════════════════════════════════════════════════
       SECTION 2: odeResources
       Three entries are always written by the generator (generateOdeResourcesXml).
       The key names are exact — "exe_version" is correct, NOT "eXeVersion".
       ═══════════════════════════════════════════════════════════════════════ -->
  <odeResources>
    <odeResource>
      <key>odeId</key>
      <value>20251217061325ABC001</value>
      <!-- Stable project identifier: YYYYMMDDHHmmss + 6 uppercase alphanumeric chars.
           Generated once when the project is first created; never changes on re-save. -->
    </odeResource>
    <odeResource>
      <key>odeVersionId</key>
      <value>20251217062007XYZ002</value>
      <!-- Version identifier: same format as odeId, generated fresh on every export.
           Two exports of the same project will have different odeVersionId values. -->
    </odeResource>
    <odeResource>
      <key>exe_version</key>
      <value>3.0</value>
      <!-- The ODE_VERSION constant from src/shared/export/constants.ts.
           NOTE: this key is "exe_version" (lowercase, underscore), not "eXeVersion".
           Legacy files from pre-v4 eXeLearning may use "eXeVersion" — the importer
           handles both, but the generator always writes "exe_version". -->
    </odeResource>
  </odeResources>

  <!-- ═══════════════════════════════════════════════════════════════════════
       SECTION 3: odeProperties
       Project-level metadata.  Each entry is an <odeProperty> key/value pair.
       The generator iterates ExportMetadata, skipping null/empty/excluded fields.
       Only the most common keys are shown here; see content-xml.md for the full list.
       ═══════════════════════════════════════════════════════════════════════ -->
  <odeProperties>
    <odeProperty>
      <key>pp_title</key>
      <value>My First eXeLearning Project</value>
      <!-- Human-readable title shown in the exported HTML page <title> tag. -->
    </odeProperty>
    <odeProperty>
      <key>pp_lang</key>
      <value>en</value>
      <!-- BCP-47 language tag.  Used for the HTML lang attribute and accessibility. -->
    </odeProperty>
    <odeProperty>
      <key>pp_author</key>
      <value>Jane Educator</value>
      <!-- Author name, written to <meta name="author"> in exported HTML. -->
    </odeProperty>
    <odeProperty>
      <key>pp_addExeLink</key>
      <value>true</value>
      <!-- When true, a "Made with eXeLearning" footer link is injected into exports.
           Boolean values are written as the strings "true" or "false". -->
    </odeProperty>
  </odeProperties>

  <!-- ═══════════════════════════════════════════════════════════════════════
       SECTION 4: odeNavStructures
       One <odeNavStructure> element per page, in tree order (parent before children).
       This minimal example has exactly one root page.
       ═══════════════════════════════════════════════════════════════════════ -->
  <odeNavStructures>

    <odeNavStructure>
      <!-- ── Page identity ── -->
      <odePageId>20251217062007PAGE01</odePageId>
      <!-- Unique page identifier.  Same format as odeId. -->

      <odeParentPageId></odeParentPageId>
      <!-- Empty string means this is a root page (no parent).
           Child pages set this to the parent's <odePageId>. -->

      <pageName>Introduction</pageName>
      <!-- Navigation label shown in the left-hand page tree. -->

      <odeNavStructureOrder>1</odeNavStructureOrder>
      <!-- 1-based position among siblings.  Root pages are ordered relative to each other. -->

      <!-- ── Page-level properties ── -->
      <odeNavStructureProperties>
        <odeNavStructureProperty>
          <key>titlePage</key>
          <value>Introduction</value>
          <!-- Page heading rendered as <h1> at the top of the page body. -->
        </odeNavStructureProperty>
        <!-- Additional optional properties: hidePageTitle, editableInPage, highlight, description.
             They are written by the generator when non-default values are set. -->
      </odeNavStructureProperties>

      <!-- ── Blocks (odePagStructures) ── -->
      <!-- Each block is a collapsible container for one or more iDevices. -->
      <odePagStructures>

        <odePagStructure>
          <!-- ── Block identity ── -->
          <odePageId>20251217062007PAGE01</odePageId>
          <!-- Repeats the parent page id — the importer uses this to associate
               blocks with pages even when parsing a flat list of elements. -->

          <odeBlockId>20251217062007BLK001</odeBlockId>
          <!-- Unique block identifier within the project. -->

          <blockName>Text block</blockName>
          <!-- Displayed in the block header when the block is collapsed. -->

          <iconName></iconName>
          <!-- Optional icon name for the block header.  Empty string is valid. -->

          <odePagStructureOrder>1</odePagStructureOrder>
          <!-- 1-based position of this block within the page. -->

          <!-- ── Block-level properties ── -->
          <odePagStructureProperties>
            <odePagStructureProperty>
              <key>visibility</key>
              <value>true</value>
              <!-- Whether the block is visible to students.  "true" or "false". -->
            </odePagStructureProperty>
            <odePagStructureProperty>
              <key>teacherOnly</key>
              <value>false</value>
              <!-- When true, block is hidden from learners and shown only in teacher view. -->
            </odePagStructureProperty>
            <odePagStructureProperty>
              <key>allowToggle</key>
              <value>true</value>
              <!-- When true, learners can collapse/expand the block. -->
            </odePagStructureProperty>
            <odePagStructureProperty>
              <key>minimized</key>
              <value>false</value>
              <!-- Initial collapsed state.  Usually false. -->
            </odePagStructureProperty>
          </odePagStructureProperties>

          <!-- ── Components (iDevices) ── -->
          <odeComponents>

            <odeComponent>
              <!-- ── Component identity ── -->
              <odePageId>20251217062007PAGE01</odePageId>
              <!-- Repeats the parent page id (same pattern as block ↔ page). -->

              <odeBlockId>20251217062007BLK001</odeBlockId>
              <!-- Repeats the parent block id. -->

              <odeIdeviceId>20251217062007IDEV01</odeIdeviceId>
              <!-- Unique iDevice identifier.  Used in the asset record's referencedBy
                   list and in any `data-asset-id` attribute that links a DOM node to
                   this iDevice.  iDevice file assets do NOT live in a per-iDevice
                   subfolder — they go under content/resources/<filename> (or
                   content/resources/<folderPath>/<filename> when the user organised
                   them into folders via the file manager).  See ../assets.md. -->

              <odeIdeviceTypeName>text</odeIdeviceTypeName>
              <!-- Registered iDevice type name.  Must match the "name" field in the
                   iDevice's config.xml.  Common values: "text", "interactive-video",
                   "rubric", "udl-content".  See ../idevices/snippets.md for more. -->

              <!-- ── Rendered HTML (always CDATA-wrapped) ── -->
              <htmlView><![CDATA[<div class="exe-text-template"><div class="textIdeviceContent">
  <div class="exe-text-activity">
    <div>
      <p>Welcome to your first eXeLearning project. This paragraph was typed
         into the <strong>Text</strong> iDevice editor.</p>
    </div>
  </div>
</div></div>]]></htmlView>
              <!-- The rendered HTML that the export engine places directly in page HTML.
                   CDATA wrapping is unconditional — even if the content contains no
                   characters that require escaping, the generator always writes CDATA.
                   This matches lines 269-270 of OdeXmlGenerator.ts. -->

              <!-- ── JSON properties (always CDATA-wrapped) ── -->
              <jsonProperties><![CDATA[{"ideviceId":"20251217062007IDEV01","textTextarea":"<p>Welcome to your first eXeLearning project. This paragraph was typed into the <strong>Text</strong> iDevice editor.</p>","textFeedbackInput":"Show Feedback","textFeedbackTextarea":"","textInfoDurationInput":"","textInfoDurationTextInput":"Duration","textInfoParticipantsInput":"","textInfoParticipantsTextInput":"Grouping"}]]></jsonProperties>
              <!-- The iDevice's internal state as a JSON object, CDATA-wrapped.
                   This is the authoritative source when re-importing; htmlView is
                   re-generated from jsonProperties during import.
                   NOTE: inside CDATA the JSON is NOT HTML-escaped — angle brackets,
                   quotes, and ampersands are literal characters.
                   If the JSON string itself contains "]]>" it is split across two
                   CDATA sections (see escapeCdata() in OdeXmlGenerator.ts). -->

              <odeComponentsOrder>1</odeComponentsOrder>
              <!-- 1-based position of this component within the block. -->

              <!-- ── Component structural properties ── -->
              <odeComponentsProperties>
                <odeComponentsProperty>
                  <key>visibility</key>
                  <value>true</value>
                  <!-- Mirrors the block-level visibility but at iDevice granularity. -->
                </odeComponentsProperty>
              </odeComponentsProperties>
              <!-- If component.structureProperties is absent, the generator writes
                   visibility=true as a default (OdeXmlGenerator.ts lines 291-293). -->

            </odeComponent>

          </odeComponents>
        </odePagStructure>

      </odePagStructures>
    </odeNavStructure>

  </odeNavStructures>
</ode>
```

---

## What's next

- **Validate** the XML against the bundled DTD — see the command in the section below.
- **Add more pages** and iDevice types — see [multi-page-content-xml.md](multi-page-content-xml.md).
- **Browse iDevice HTML/JSON shapes** — see [../idevices/snippets.md](../idevices/snippets.md).
- **Understand the full element reference** — see [../content-xml.md](../content-xml.md).
- **Understand the ZIP structure** — see [full-package-tree.md](full-package-tree.md) and
  [../container.md](../container.md).

---

## Validating with xmllint

Before importing or shipping a `content.xml`, validate it against the bundled DTD:

```bash
# From the directory that contains both content.xml and content.dtd:
xmllint --noout --dtdvalid content.dtd content.xml && echo "valid"

# If content.dtd is in a different location, point --dtdvalid at its path:
xmllint --noout --dtdvalid /path/to/content.dtd content.xml
```

`xmllint` is part of `libxml2`, available on all major platforms:

```bash
# macOS
brew install libxml2

# Debian / Ubuntu
apt-get install libxml2-utils
```

---

## ZIP it up — making a working .elpx

An `.elpx` is a plain ZIP archive. The **bare-minimum re-importable** layout is just two
files:

```
myproject/
├── content.xml      ← the file above
└── content.dtd      ← copy from public/app/schemas/ode/content.dtd
```

The importer (`ElpxImporter.ts`) does not require anything else. Everything below is
optional from the importer's point of view — but is required for a **publishable v4
package** that is offline-viewable in any browser:

```
myproject/
├── content.xml      ← the file above
├── content.dtd      ← copy from public/app/schemas/ode/content.dtd
├── index.html       ← rendered first page (can be empty <html></html> for a stub)
├── screenshot.png   ← 1280×720 PNG project thumbnail (run scripts/add-screenshot.ts)
├── theme/           ← active theme (config.xml + style.css + style.js + screenshot.png)
├── libs/            ← BASE_LIBRARIES from src/shared/export/constants.ts
├── idevices/<type>/ ← runtime files for each iDevice type referenced in content.xml
└── content/resources/<filename>   ← any project assets (images/audio/PDFs/…),
                                     optionally under a user-created folderPath
```

If `<htmlView>` references a `{{context_path}}/<filename>` (or
`{{context_path}}/<folderPath>/<filename>`), the matching file MUST exist at
`content/resources/<filename>` (or under the same `<folderPath>`). See
[../assets.md](../assets.md) for the URL lifecycle.

Create the ZIP with the standard `zip` command. The archive must **not** include a
top-level `myproject/` directory — entries must be at the root of the ZIP:

```bash
# From inside the myproject/ directory:
cd myproject/

# Re-importable minimum:
zip ../myproject.elpx content.xml content.dtd

# v4 publishable package:
zip -r ../myproject.elpx \
    content.xml content.dtd index.html screenshot.png \
    theme/ libs/ idevices/ content/

mv ../myproject.elpx ../myproject.elpx   # rename if needed
```

Validate before shipping:

```bash
cd myproject/
xmllint --noout --dtdvalid content.dtd content.xml && echo "DTD valid"
```

See [../validation.md](../validation.md) for the full v4 release checklist.

Then open eXeLearning, choose **File → Import** and select `myproject.elpx`. The importer reads
`content.xml` to reconstruct the Yjs document in the browser; it does not parse any HTML files.
