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
    ├── lomloe-ES.json      # State minimums (ISO ES) — RD 95/2022, 157/2022, 217/2022, 243/2022
    ├── lomloe-ES-EFP.json  # Ministry-managed territory (Ceuta, Melilla) — Órdenes EFP
    ├── lomloe-ES-EX.json   # Extremadura (ISO ES-EX) — Decretos 98/2022, 107/2022, 110/2022, 109/2022
    └── lomloe-ES-CN.json   # Canary Islands (ISO ES-CN) LOMLOE concretion
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

## National (state) datasets

Two state-level datasets ship alongside the Canary Islands concretion:

### `lomloe-ES.json` — State minimum teachings (Reales Decretos)

Built from the four Royal Decrees that set the Spanish LOMLOE *enseñanzas mínimas*:

| BOE ID | Norma | Etapa |
|---|---|---|
| `BOE-A-2022-1654` | RD 95/2022, de 1 de febrero | Educación Infantil |
| `BOE-A-2022-3296` | RD 157/2022, de 1 de marzo | Educación Primaria |
| `BOE-A-2022-4975` | RD 217/2022, de 29 de marzo | Educación Secundaria Obligatoria |
| `BOE-A-2022-5521` | RD 243/2022, de 5 de abril | Bachillerato |

These RDs apply across Spain as the state floor; each autonomous community adds its own concretion on top.

### `lomloe-ES-EFP.json` — Ministry-managed territory (Ceuta and Melilla)

Built from the three Órdenes that set the operative curricula for the *ámbito de gestión del Ministerio de Educación y Formación Profesional* (Ceuta and Melilla). Use this dataset when the destination is a school inside that territory.

| BOE ID | Norma | Etapa |
|---|---|---|
| `BOE-A-2022-12066` | Orden EFP/678/2022, de 15 de julio | Educación Primaria |
| `BOE-A-2022-13172` | Orden EFP/754/2022, de 28 de julio | Educación Secundaria Obligatoria |
| `BOE-A-2022-13173` | Orden EFP/755/2022, de 28 de julio | Bachillerato |

The Ministry has not published an Orden for Educación Infantil, so this dataset has no Infantil etapa.

### Cycle-to-year mapping

The BOE Royal Decrees define curriculum at cycle (ciclo) or course-group granularity, not per individual year. The iDevice UI browses by individual year, so cycle content is **duplicated** into each year of that cycle — matching the Canary Islands precedent. Generated codes embed the year/cycle tag (e.g. `ES-PRI1-MAT-CE01` for 1.º Primaria, `ES-PRI2-MAT-CE01` for 2.º Primaria) so each year keeps unique selection IDs even when the content is the same.

| Etapa | Niveles in dataset | BOE source granularity | Mapping |
|---|---|---|---|
| Infantil | `Primer ciclo (0-3 años)`, `Segundo ciclo (3-6 años)` | 2 ciclos | One-to-one; no per-year duplication (BOE does not split Infantil by year). |
| Primaria | `1º Primaria` … `6º Primaria` | 3 ciclos | Each ciclo is duplicated into both its years. |
| ESO | `1º ESO` … `4º ESO` | Mostly "1.º–3.º" plus "4.º" | "1.º–3.º" duplicated into 1.º, 2.º, 3.º. |
| Bachillerato | `1º Bachillerato`, `2º Bachillerato` | Per-curso | One-to-one (subjects named "I" / "II"). |

### Generator script

The JSONs are produced by a Python script (`generate_lomloe_es.py`) that fetches each BOE XML, parses the ANEXO sections, and emits the dataset deterministically. The script is **not committed to this repo**; it is attached to the PR that introduced these datasets so the extraction is reproducible and auditable. Re-running it against the same BOE inputs produces byte-identical JSON.

## `lomloe-ES-EX.json` — Extremadura concretion

Hybrid dataset built from the Junta de Extremadura's curriculum decrees plus inheritance from the state RDs (LOMLOE framework mandates that the state minimums apply where the autonomous concretion does not explicitly override them).

### Base curriculum decrees (DOE)

| DOE PDF | Norma | Etapa |
|---|---|---|
| `2022040148` | Decreto 98/2022, de 20 de julio | Educación Infantil |
| `2022040159` | Decreto 107/2022, de 28 de julio | Educación Primaria |
| `2022040165C` | Decreto 110/2022, de 22 de agosto | Educación Secundaria Obligatoria |
| `2022040164` | Decreto 109/2022, de 22 de agosto | Bachillerato |

### Modification decrees reviewed

- `Decreto 240/2023` (Infantil)
- `Decreto 241/2023` (Primaria)
- `Decreto 242/2023` (ESO)
- `Decreto 243/2023` (Bachillerato)
- `Decreto 73/2025` (Bachillerato)

These modifications touch organisational provisions (timetable, optionality, modality lists) more than the curriculum elements consumed by the iDevice. Where a modification updates a regional saber básico or area name, the change is incorporated into the JSON; pure organisational changes are documented here but do not alter the dataset.

### Build strategy (hybrid)

The `ES-EX` dataset combines two sources:

1. **Competencias específicas and criterios de evaluación**: inherited verbatim from `lomloe-ES.json` with the code prefix swapped to `ES-EX-…`. LOMLOE mandates that autonomous concretions adopt the state-level competencias and criterios; Extremadura's decrees state this explicitly.
2. **Saberes básicos**: extracted from the DOE PDF tables with `pdfplumber` where the regional concretion is available (Decreto 107/2022 uses an explicit `A.1.1.1.` saber-code scheme — block letter, subblock, ciclo, item — that maps cleanly to the schema). Where the DOE table extraction does not yield content for an (etapa, area), the state saberes are used as the fallback per the LOMLOE inheritance rule.

The dataset follows the same per-year duplication and code conventions used for `ES` and `ES-CN`: a `nivel_tag` is embedded into every generated code so duplicated cycle content keeps unique selection identifiers across years.

### Generator script

A separate Python script (`generate_lomloe_es_ex.py`) implements the hybrid build: load `lomloe-ES.json`, inherit + reprefix, then overlay DOE-extracted regional saberes. The script is **attached to the PR** that introduced this dataset rather than committed to the repo.

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
2. Change the concretion selector to **Estado (España)** — verify the state dataset loads and the curriculum tree is browsable. Tag one criterio and one saber.
3. Change to **Ámbito de gestión MEFP** — verify the Ceuta/Melilla dataset loads (no Infantil etapa) and previous ES selections persist.
4. Change to **Extremadura** — verify the regional dataset loads and that competencias mirror the state RD (inherited) while saberes show Extremadura-specific concretion where the DOE provides it.
5. Change back to **Canarias** — verify it still loads correctly.

### Empty state

1. Add the iDevice without any selections.
2. Export the page — verify the exported HTML shows a graceful empty message.

## i18n

All user-facing strings pass through `_()` (eXeLearning's translation function).
To add translations, add entries to `translations/messages.{locale}.xlf` using the
string values in `edition/lomloe.js` as source keys.
