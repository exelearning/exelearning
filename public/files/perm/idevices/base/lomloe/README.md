# LOMLOE: Fundamentación Curricular — iDevice

An eXeLearning iDevice that lets educators tag an educational resource (REA) with Spanish LOMLOE curriculum elements: *saberes básicos* and *competencias específicas / criterios de evaluación*.

## What it does

1. **Select a dataset** — national (state) or an autonomous community concretion.
2. **Browse the curriculum tree** — Etapa → Nivel → Materia, then two branches:
   - **Saberes Básicos**: browsable by block, individual checkboxes.
   - **Competencias Específicas**: expandable competencia cards with criterio checkboxes.
3. **Tag each selected element** with a coverage level (*Introducido / Practicado / Evaluado*) and optional notes.
4. **Preview / export** a summary table listing all tagged elements.

## Files

```
lomloe/
├── config.xml              # iDevice manifest (registered by eXeLearning)
├── lomloe-icon.svg         # Menu icon
├── edition/
│   ├── lomloe.js           # Editor: $exeDevice object (init + save)
│   └── lomloe.css          # Editor styles
├── export/
│   ├── lomloe.js           # Export renderer: $Lomloe object (renderView)
│   ├── lomloe.css          # Export styles
│   └── lomloe.html         # Export template wrapper
└── data/
    ├── lomloe-ES-CN.json   # Canary Islands (ISO ES-CN) LOMLOE concretion (~7 MB)
    └── lomloe-ES.json      # National concretion (ISO ES) — placeholder, not yet available
```

## Dataset format

All dataset JSON files share the same schema:

```jsonc
{
  "Etapa label": {              // e.g. "Educación Primaria", "ESO"
    "Nivel label": {            // e.g. "1º Primaria", "3º ESO"
      "CodArea": {              // e.g. "MAT", "LCS"
        "denominacion": "Materia name",
        "competencias_especificas": {
          "CodigoComp": {       // e.g. "PC9NC1"
            "descripcion": "Competencia description",
            "explicacion_bloque_competencial": "Extended explanation",
            "criterios_evaluacion": [
              {
                "codigo": "PC9N01CE1.1",
                "descripcion": "Criterio description",
                "competencias_clave": ["CCL3", "STEM4", "CD1"]
              }
            ]
          }
        },
        "saberes_basicos": {
          "bloques": {
            "Block title": [    // e.g. "I. Cultura científica"
              {
                "nombre": "PC9N01SBI.1.1",        // unique code
                "subtitulo_nivel_1": "Topic",
                "subtitulo_nivel_2": "Sub-topic"  // optional
              }
            ]
          }
        }
      }
    }
  }
}
```

## How to add a new autonomous community

Dataset identifiers use **ISO 3166-2:ES** codes (e.g. `ES-MD` for Madrid, `ES-CT` for Catalunya).
File names follow the pattern `lomloe-{ISO-code}.json`.

1. **Prepare the JSON** in the format above and place it in `data/lomloe-ES-MD.json` (example: Madrid).

2. **Register the dataset** in `edition/lomloe.js` by adding an entry to the `DATASETS` array:

   ```javascript
   {
       id: 'ES-MD',
       isoCode: 'ES-MD',
       label: 'LOMLOE — Comunidad de Madrid',
       labelEn: 'LOMLOE — Community of Madrid',
       framework: 'LOMLOE',
       community: 'Comunidad de Madrid',
       file: '../data/lomloe-ES-MD.json',
       available: true
   }
   ```

3. No other code changes are needed. The dataset will appear in the concretion selector automatically.

### ISO 3166-2:ES community codes

| Code  | Community                     | Code  | Community               |
|-------|-------------------------------|-------|-------------------------|
| ES    | Estado (national)             | ES-MD | Comunidad de Madrid     |
| ES-AN | Andalucía                     | ES-MC | Región de Murcia        |
| ES-AR | Aragón                        | ES-NC | Com. Foral de Navarra   |
| ES-AS | Asturias, Principado de       | ES-PV | País Vasco / Euskadi    |
| ES-CB | Cantabria                     | ES-RI | La Rioja                |
| ES-CL | Castilla y León               | ES-VC | Comunitat Valenciana    |
| ES-CM | Castilla-La Mancha            | ES-CE | Ceuta                   |
| ES-CN | **Canarias** ✓ (available)    | ES-ML | Melilla                 |
| ES-CT | Catalunya                     | ES-IB | Illes Balears           |
| ES-EX | Extremadura                   | ES-GA | Galicia                 |

## Adding the national (state) concretion

When the national JSON is available:

1. Replace `data/lomloe-ES.json` with the real data (same schema).
2. Set `available: true` on the `ES` entry in `DATASETS` in `edition/lomloe.js`.

## Data source (Canary Islands)

The Canary Islands dataset (`lomloe-canarias.json`) is derived from the official LOMLOE concretion published by the Canary Islands Department of Education. It contains:

| Stage | Levels | Subjects | Competencias | Saberes |
|-------|--------|----------|--------------|---------|
| Educación Infantil | 6 | 24 | 102 | — |
| Educación Primaria | 6 | 58 | 252 | — |
| ESO | 4 | 66 | 406 | — |
| Bachillerato | 2 | 92 | 508 | — |
| **Total** | **18** | **240** | **1,268** | **7,884+** |

## Persisted data model

The iDevice stores a JSON object in the Yjs document:

```javascript
{
  ideviceId:             "...",
  lomloeDataset:         "ES-CN",              // active dataset ISO 3166-2:ES code
  lomloeActiveTab:       "saberes",           // last active tab
  lomloeSelectedEtapa:   "Educación Primaria",
  lomloeSelectedNivel:   "1º Primaria",
  lomloeSelectedMateria: { codArea: "MAT", denominacion: "Matemáticas" },
  lomloeSelections: [    // array of selection objects
    {
      id:              "saber\x1fEducación Primaria\x1f1º Primaria\x1fMAT\x1fBloque I\x1fPC9N01SBI.1.1",
      type:            "saber",
      dataset:         "ES-CN",
      etapa:           "Educación Primaria",
      nivel:           "1º Primaria",
      codArea:         "MAT",
      denominacion:    "Matemáticas",
      bloque:          "I. Cultura científica",
      nombre:          "PC9N01SBI.1.1",
      subtitulo1:      "1. Iniciación en la actividad científica",
      subtitulo2:      "1.1. Iniciación a los procedimientos...",
      coverage:        "introduced",  // '' | 'introduced' | 'practiced' | 'assessed'
      notes:           "Worked in unit 2"
    },
    {
      id:              "criterio\x1fEducación Primaria\x1f1º Primaria\x1fMAT\x1fPC9NC1\x1fPC9N01CE1.1",
      type:            "criterio",
      dataset:         "ES-CN",
      etapa:           "Educación Primaria",
      nivel:           "1º Primaria",
      codArea:         "MAT",
      denominacion:    "Matemáticas",
      codigoComp:      "PC9NC1",
      descripcionComp: "Utilizar dispositivos y recursos digitales...",
      codigoCriterio:  "PC9N01CE1.1",
      descripcionCriterio: "Utilizar dispositivos y recursos digitales...",
      competenciasClave: ["CCL3", "STEM4", "CD1", "CD3", "CD4"],
      coverage:        "practiced",
      notes:           ""
    }
  ],
  lomloeSummaryHtml: "<table class=\"lomloe-export-table\">...</table>"
}
```

## Manual test plan

### Basic round-trip

1. Add the iDevice to a page.
2. Select dataset **LOMLOE — Islas Canarias** (default).
3. Click **Educación Primaria** → **1º Primaria** → **Matemáticas**.
4. In **Saberes Básicos** tab: check two items, set coverage to *Practicado*.
5. Switch to **Competencias Específicas** tab: expand one competencia, check one criterio.
6. In the right panel, set *Evaluado* and add a note.
7. Click **Vista previa del resumen** — verify the table shows all three selections.
8. Save the project → reload → reopen the iDevice → verify all selections are restored.

### Dataset switch

1. Open the iDevice with existing selections.
2. Change the concrecion selector to **Estado** — verify the "coming soon" notice appears and selections are preserved.
3. Change back to **Canarias** — verify the browser reloads correctly.

### Empty state

1. Add the iDevice without any selections.
2. Export the page — verify the exported HTML shows a graceful empty message.

## i18n

All user-facing strings pass through `_()` (eXeLearning's translation function).
To add translations, add entries to `translations/messages.{locale}.xlf` using the
string values in `edition/lomloe.js` as source keys.
