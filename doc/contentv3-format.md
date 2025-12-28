# contentv3.xml Format Documentation

This document describes the legacy `contentv3.xml` format used by eXeLearning 2.x (eXe Legacy). This format is a Python object serialization to XML and is **not suitable for DTD validation** due to its dynamic structure.

## Overview

The contentv3.xml format is a serialization of Python objects from the original eXeLearning application. It uses a reference-based system to represent complex object graphs.

**Important**: A DTD cannot effectively validate this format because:
1. Class names are attribute values, not element names
2. Cross-references between objects cannot be validated with DTD
3. The structure is highly dynamic

## Root Structure

```xml
<?xml version="1.0" encoding="utf-8"?>
<instance xmlns="http://www.exelearning.org/content/v0.3"
          reference="2"
          version="0.3"
          class="exe.engine.package.Package">
  <dictionary>
    <!-- Package metadata and content -->
  </dictionary>
</instance>
```

### Root Attributes

| Attribute | Description |
|-----------|-------------|
| `xmlns` | Namespace: `http://www.exelearning.org/content/v0.3` |
| `reference` | Unique numeric ID for this object |
| `version` | Format version (typically "0.3") |
| `class` | Python class name (`exe.engine.package.Package`) |

## Data Types

### String Elements

```xml
<string role="key" value="_title"/>
```

Used for dictionary keys and simple string values.

### Unicode Elements

```xml
<unicode value="Document Title"/>
<unicode content="true" value="&lt;p&gt;HTML content&lt;/p&gt;"/>
```

| Attribute | Description |
|-----------|-------------|
| `value` | The text content |
| `content` | If "true", indicates HTML content |

### Boolean Elements

```xml
<boolean value="True"/>
<boolean value="False"/>
```

### Integer Elements

```xml
<int value="42"/>
```

### None/Null Elements

```xml
<none/>
```

### Reference Elements

```xml
<reference key="4"/>
```

References another object by its `reference` ID.

### Dictionary Elements

```xml
<dictionary>
  <string role="key" value="propertyName"/>
  <unicode value="propertyValue"/>
  <!-- More key-value pairs -->
</dictionary>
```

Dictionaries contain alternating key-value pairs. Keys are typically `<string role="key">` elements.

### List Elements

```xml
<list>
  <instance class="...">...</instance>
  <instance class="...">...</instance>
</list>
```

### Tuple Elements

```xml
<tuple>
  <string value="fieldName"/>
  <list>...</list>
</tuple>
```

## Package Structure

The Package object (`exe.engine.package.Package`) contains:

### Metadata Properties

| Key | Type | Description |
|-----|------|-------------|
| `_title` | unicode | Project title |
| `_author` | unicode | Author name |
| `_description` | unicode | Project description |
| `_lang` | unicode | Language code (e.g., "es", "en") |
| `_name` | unicode | Project filesystem name |
| `_docType` | unicode | Export format ("HTML5") |
| `_isTemplate` | boolean | Whether this is a template |
| `_isChanged` | boolean | Modified flag |
| `_nextNodeId` | int | Next available node ID |
| `_nextIdeviceId` | int | Next available iDevice ID |

### Export Options

| Key | Type | Description |
|-----|------|-------------|
| `_addPagination` | boolean | Add page numbers |
| `_addSearchBox` | boolean | Include search |
| `_addExeLink` | boolean | Include eXe link |
| `_extraHeadContent` | unicode | Custom CSS/JS |

### Navigation Structure

| Key | Type | Description |
|-----|------|-------------|
| `_nodeIdDict` | dictionary | Maps node IDs to Node instances |
| `_levelNames` | list | Custom hierarchy level names |
| `_root` | reference | Root Node reference |

## Node Structure (Pages)

Nodes represent pages in the navigation hierarchy.

```xml
<instance class="exe.engine.node.Node" reference="4">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Page Title"/>

    <string role="key" value="parent"/>
    <reference key="2"/>  <!-- or <none/> for root -->

    <string role="key" value="idevices"/>
    <list>
      <!-- iDevice instances -->
    </list>

    <string role="key" value="children"/>
    <list>
      <!-- Child Node instances -->
    </list>
  </dictionary>
</instance>
```

### Node Properties

| Key | Type | Description |
|-----|------|-------------|
| `_title` | unicode | Page title |
| `parent` | reference/none | Parent node (none for root) |
| `idevices` | list | List of iDevice instances |
| `children` | list | Child node instances |

## iDevice Structure (Components)

iDevices are interactive learning elements. There are multiple types:

### JsIdevice (Modern JSON-based)

```xml
<instance class="exe.engine.jsidevice.JsIdevice" reference="5">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Activity Title"/>

    <string role="key" value="class_"/>
    <unicode value="text"/>

    <string role="key" value="fields"/>
    <list>
      <!-- Field instances -->
    </list>
  </dictionary>
</instance>
```

### TextAreaField (Content Field)

```xml
<instance class="exe.engine.field.TextAreaField" reference="6">
  <dictionary>
    <string role="key" value="_id"/>
    <unicode value="field-id-123"/>

    <string role="key" value="content_w_resourcePaths"/>
    <unicode content="true" value="&lt;p&gt;HTML content&lt;/p&gt;"/>
  </dictionary>
</instance>
```

## Legacy iDevice Types

The following are common legacy iDevice class names:

### Text-based iDevices

- `FreeTextIdevice` - Free text content
- `FreeTextfpdIdevice` - FPD variant
- `GenericIdevice` - Generic content
- `ReflectionIdevice` - Reflection activity
- `WikipediaIdevice` - Wikipedia content

### Interactive iDevices

- `TrueFalseIdevice` - True/False questions
- `MultichoiceIdevice` - Multiple choice
- `MultiSelectIdevice` - Multiple selection
- `ClozeIdevice` - Fill in the blanks
- `QuizTestIdevice` - Quiz

### Media iDevices

- `GalleryIdevice` - Image gallery
- `ImageMagnifierIdevice` - Image magnifier
- `AppletIdevice` - Java applet (legacy)

### Spanish FPD Variants

- `VerdaderofalsofpdIdevice`
- `EleccionmultiplefpdIdevice`
- `SeleccionmultiplefpdIdevice`
- `ClozefpdIdevice`
- `ReflectionfpdIdevice`
- `TareasIdevice`
- `ListaApartadosIdevice`
- `ComillasIdevice`
- `NotaInformacionIdevice`
- `CasopracticofpdIdevice`
- `DebesconocerfpdIdevice`
- `DestacadofpdIdevice`
- `ParasabermasfpdIdevice`
- And more...

## Resource References

Assets are referenced within content using the path format:

```
resources/image.jpg
```

The parser extracts these paths using regex pattern `/resources\/[^\s"'<>]+/g`.

## Parsing Strategy

When parsing contentv3.xml:

1. **Build Reference Map**: Create a map of `reference` IDs to XML elements
2. **Find Package**: Locate the root `exe.engine.package.Package` instance
3. **Extract Metadata**: Parse the Package dictionary for metadata
4. **Find Root Node**: Follow the `_root` reference to the root Node
5. **Build Page Tree**: Recursively parse nodes and their children
6. **Extract iDevices**: Parse iDevice instances within each node
7. **Map Types**: Convert legacy iDevice types to modern equivalents
8. **Collect Resources**: Extract resource paths from content

## Type Mappings

Legacy iDevice types are mapped to modern ODE types:

| Legacy Type | Modern Type |
|-------------|-------------|
| `FreeTextIdevice` | `text` |
| `TrueFalseIdevice` | `trueorfalse` |
| `MultichoiceIdevice` | `quick-questions-multiple-choice` |
| `MultiSelectIdevice` | `quick-questions-multiple-choice` |
| `ClozeIdevice` | `complete` |
| `ImageMagnifierIdevice` | `magnifier` |
| `GalleryIdevice` | `image-gallery` |
| `CasestudyIdevice` | `casestudy` |
| `FileAttachIdevice` | `text` |
| `AttachmentIdevice` | `text` |
| `ExternalUrlIdevice` | `external-website` |
| `QuizTestIdevice` | `quick-questions` |
| `JsIdevice` | Uses `class_` attribute |

## Implementation Files

The contentv3.xml parser is implemented in:

- `src/services/xml/legacy-xml-parser.ts` - Main parser
- `src/services/xml/xml-parser.ts` - Format detection
- `src/services/xml/interfaces.ts` - Type definitions

## Example Document

```xml
<?xml version="1.0" encoding="utf-8"?>
<instance xmlns="http://www.exelearning.org/content/v0.3"
          reference="1" version="0.3"
          class="exe.engine.package.Package">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="My Learning Content"/>

    <string role="key" value="_author"/>
    <unicode value="John Doe"/>

    <string role="key" value="_lang"/>
    <unicode value="en"/>

    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Home"/>

        <string role="key" value="parent"/>
        <none/>

        <string role="key" value="idevices"/>
        <list>
          <instance class="exe.engine.idevice.FreeTextIdevice" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Introduction"/>

              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="4">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode content="true" value="&lt;p&gt;Welcome!&lt;/p&gt;"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </list>

        <string role="key" value="children"/>
        <list/>
      </dictionary>
    </instance>

    <string role="key" value="_nodeIdDict"/>
    <dictionary>
      <string role="key" value="0"/>
      <reference key="2"/>
    </dictionary>
  </dictionary>
</instance>
```

## Differences from ODE Format

| Aspect | contentv3.xml | ODE Format |
|--------|---------------|------------|
| Root Element | `<instance class="...">` | `<ode>` |
| Serialization | Python objects | Native XML |
| References | `@reference` attribute | `odePageId`, `odeBlockId` |
| Content | `<unicode content="true">` | `<htmlView>`, `<jsonProperties>` |
| Hierarchy | Nested Node instances | Flat with `odeParentPageId` |
| Metadata | Dictionary keys | `<odeProperty>` elements |
