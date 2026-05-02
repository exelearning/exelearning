# 01 — Anatomía de un iDevice

> Cómo está estructurado un iDevice individual, qué describe `config.xml`, y qué archivos contiene cada uno.

## Estructura de directorio

Todos los iDevices del sistema viven bajo [public/files/perm/idevices/base/](../../public/files/perm/idevices/base/). Cada uno es una carpeta con la siguiente convención:

```
{idevice-id}/
├── config.xml                    Metadatos y configuración (único campo obligatorio)
├── {idevice-id}-icon.svg         Icono por defecto (puede sobrescribirse en config.xml)
├── edition/                      Código que se carga en el editor
│   ├── {idevice-id}.js           Script principal (convencional)
│   ├── {idevice-id}.css          Estilos del editor
│   ├── {idevice-id}.test.js      Tests Vitest (excluidos del bundle)
│   └── ...                       Dependencias .js, imágenes, etc.
└── export/                       Código que se inyecta en el HTML/SCORM exportado
    ├── {idevice-id}.js           Runtime principal
    ├── {idevice-id}.css          Estilos en publicación
    ├── {idevice-id}.html         Template Nunjucks (sólo si `componentType=json`)
    ├── {idevice-id}.test.js      Tests Vitest
    └── ...                       Dependencias (p. ej. `html2canvas.js`)
```

El backend resuelve los archivos de cada carpeta así (ver [src/routes/idevices.ts:106-151](../../src/routes/idevices.ts#L106-L151)):

1. Si `config.xml` declara `<edition-js>`/`<export-js>`/`<edition-css>`/`<export-css>`, usa esos nombres.
2. Si **no** los declara, escanea el directorio y devuelve **todos** los `.js`/`.css`, ordenados con el archivo principal `{idevice-id}.{ext}` primero y el resto alfabético, **excluyendo** `*.test.js` y `*.spec.js`.
3. Filtra resultados por `fs.existsSync()` para no servir nombres rotos.

Ese fallback es la razón por la que muchos `config.xml` están casi vacíos.

## El archivo `config.xml`

No existe XSD ni JSON-Schema. El parser compartido valida que el XML esté bien formado y tenga raíz `idevice`/`idevice-config`; los campos ausentes siguen usando defaults de runtime — ver [src/shared/parsers/idevice-parser.ts](../../src/shared/parsers/idevice-parser.ts).

### Esquema de facto (campos reconocidos)

| Tag | Tipo | Default | Descripción |
|---|---|---|---|
| `name` | string | nombre de la carpeta | ID único |
| `title` | string | id | Nombre legible (traducible) |
| `css-class` | string | id | Clase CSS aplicada al contenedor |
| `category` | string | `'Uncategorized'` | Una de las 5 categorías conocidas (en inglés) |
| `description` | string | `''` | Texto descriptivo |
| `version` | string | `'1.0'` | Versión semántica del iDevice |
| `api-version` | string | `'3.0'` | Versión de la API que usa |
| `component-type` | `'json'` \| `'html'` | `'html'` | Si los datos se almacenan como JSON estructurado o HTML libre |
| `icon` | string \| nested | `{name: '${id}-icon', url: '${id}-icon.svg', type: 'img'}` | Icono. Si es texto plano se interpreta como `type: 'icon'` (FontAwesome); si es objeto, lleva `name`/`url`/`type` |
| `author`, `author-url` | string | `''` | Atribución |
| `license`, `license-url` | string | `''` | Licencia |
| `edition-js`, `edition-css` | `<filename>` × N | autoescaneo | Archivos a cargar en edición |
| `export-js`, `export-css` | `<filename>` × N | autoescaneo | Archivos a cargar en exportación |
| `edition-template-filename` | string | `''` | Plantilla Nunjucks/HTML para el editor (si aplica) |
| `export-template-filename` | string | `''` | Plantilla para exportación (sólo `componentType=json`) |
| `location`, `location-type` | string | `''` | Campos no usados activamente |
| `downloadable` | `'0'` \| `'1'` | `'0'` | Si el iDevice se puede exportar como ZIP descargable |

### Convención `exportObject`

Cada iDevice expone un objeto global JS para que el motor de export lo invoque. **No** se declara en `config.xml`; se deriva del `id`:

```ts
exportObject = '$' + ideviceId.split('-').join('')
// 'text' → '$text'
// 'az-quiz-game' → '$azquizgame'
// 'quick-questions-multiple-choice' → '$quickquestionsmultiplechoice'
```

Definido en backend en [src/routes/idevices.ts:183](../../src/routes/idevices.ts#L183) y replicado en cliente en [public/app/workarea/idevices/idevice.js:85-88](../../public/app/workarea/idevices/idevice.js#L85-L88) (`getIdeviceObjectKey()`).

### Ejemplos contrastados

**`config.xml` mínimo** ([base/az-quiz-game/config.xml](../../public/files/perm/idevices/base/az-quiz-game/config.xml)):

```xml
<?xml version="1.0"?>
<idevice>
    <title>A-Z quiz</title>
    <css-class>az-quiz-game</css-class>
    <category>Games</category>
    <icon>
        <name>az-quiz-game-icon</name>
        <url>az-quiz-game-icon.svg</url>
        <type>img</type>
    </icon>
    <downloadable>0</downloadable>
</idevice>
```

Todo lo demás (versión, archivos JS/CSS, `componentType`, `exportObject`...) viene de defaults y autoescaneo.

**`config.xml` extendido** ([base/text/config.xml](../../public/files/perm/idevices/base/text/config.xml)):

```xml
<?xml version="1.0"?>
<idevice>
    <name>text</name>
    <title>Text</title>
    <css-class>text</css-class>
    <category>Information and presentation</category>
    <description>Text component for bootstrap functionalities</description>
    <icon> ... </icon>
    <version>1.0</version>
    <api-version>3.0</api-version>
    <component-type>json</component-type>
    <edition-js><filename>text.js</filename></edition-js>
    <export-js><filename>text.js</filename></export-js>
    <export-template-filename>text.html</export-template-filename>
    ...
</idevice>
```

## Inventario actual: 43 iDevices en `base/`

Verificado con `ls public/files/perm/idevices/base/ | wc -l = 43` y categoría leída de cada `config.xml`. Agrupado en las 5 categorías canónicas:

### Information and presentation (10)
- `casestudy`, `digcompedu`, `download-source-file`, `example` (oculto en UI), `external-website`, `image-gallery`, `magnifier`, `map`, `text`, `udl-content`

### Assessment and tracking (11)
- `checklist`, `form`, `guess`, `interactive-video`, `progress-report`, `quick-questions`, `quick-questions-multiple-choice`, `quick-questions-video`, `rubric`, `select-media-files`, `trueorfalse`

### Games (9)
- `az-quiz-game`, `challenge`, `crossword`, `discover`, `hidden-image`, `padlock`, `puzzle`, `trivial`, `word-search`

### Interactive activities (9)
- `beforeafter`, `classify`, `complete`, `dragdrop`, `flipcards`, `identify`, `relate`, `scrambled-list`, `sort`

### Science (4)
- `geogebra-activity`, `mathematicaloperations`, `mathproblems`, `periodic-table`

> Algunas asignaciones pueden sorprender: `interactive-video` y `select-media-files` están en *Assessment*, no *Interactive*; `padlock` está en *Games*, no *Interactive*; `mathproblems` está en *Science*, no *Assessment*. Es el dato literal de cada `config.xml`.

> Nota: el iDevice `example` se filtra en cliente — ver [menuIdevicesCompose.js:181](../../public/app/workarea/menus/idevices/menuIdevicesCompose.js#L181) y [modalIdeviceManager.js:428](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L428). Sigue listándose por la API pero no aparece en el menú lateral ni en el modal.

## Categorías

Hay **5 categorías canónicas** definidas en el frontend, en inglés (en `config.xml`) y traducidas en render. Definidas en [menuIdevicesCompose.js:24-31](../../public/app/workarea/menus/idevices/menuIdevicesCompose.js#L24-L31):

| Clave (icono) | Nombre en `config.xml` |
|---|---|
| `information` | `Information and presentation` |
| `evaluation` | `Assessment and tracking` |
| `games` | `Games` |
| `interactive` | `Interactive activities` |
| `science` | `Science` |
| `imported` | `Imported` (categoría virtual para iDevices de usuario) |

Orden de presentación en menú lateral: `information → evaluation → games → interactive → science` ([menuIdevicesCompose.js:34](../../public/app/workarea/menus/idevices/menuIdevicesCompose.js#L34)).

Las categorías "desconocidas" (no listadas) **no se descartan**: se acumulan en `categoriesExtra` y se renderizan al final ([menuIdevicesCompose.js:47-95](../../public/app/workarea/menus/idevices/menuIdevicesCompose.js#L47-L95)).

## Aliases legacy de tipo

Para mantener compatibilidad con ELP de versiones anteriores (EXE 2.x, 3.x, traducciones al español), [src/services/idevice-config.ts:103-123](../../src/services/idevice-config.ts#L103-L123) mapea nombres alternativos al id canónico:

```ts
const IDEVICE_TYPE_ALIASES: Record<string, string> = {
    freetext: 'text',
    freetextidevice: 'text',
    textidevice: 'text',
    js: 'text',
    'download-package': 'download-source-file',
    adivina: 'guess',
    'adivina-activity': 'guess',
    listacotejo: 'checklist',
    'listacotejo-activity': 'checklist',
    ordena: 'sort',
    clasifica: 'classify',
    relaciona: 'relate',
    completa: 'complete',
    rubrics: 'rubric',
};
```

`normalizeTypeName()` además quita el sufijo `-idevice` o `idevice` antes de buscar.

## Hallazgos corregidos o vigentes

- **No hay XSD.** El contrato del `config.xml` sigue siendo de facto, pero el parser compartido ya rechaza XML mal formado en lugar de devolver defaults silenciosamente.
- **Default de categoría unificado.** Backend, bundle estático y frontend usan `category: 'Uncategorized'` como fallback. Cualquier categoría no listada sigue cayendo en `categoriesExtra` y se muestra al final del menú con icono genérico.
- **`componentType: 'html'` por defecto sigue vigente.** Es el fallback compartido para iDevices legacy/HTML. Los iDevices JSON tienen que declarar `<component-type>json</component-type>` explícitamente.
- **Errata visible en UI corregida.** La categoría Science se renderiza con `_('Science')`.
