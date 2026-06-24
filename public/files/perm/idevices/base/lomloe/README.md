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
    ├── lomloe-ES-MD.json   # Comunidad de Madrid (ISO ES-MD) — Decretos 36/2022, 61/2022, 65/2022, 64/2022
    ├── lomloe-ES-CN.json   # Canary Islands (ISO ES-CN) LOMLOE concretion
    ├── lomloe-ES-GA.json   # Galicia (ISO ES-GA) — DOG decrees, Galician language
    ├── lomloe-ES-NC.json   # Com. Foral de Navarra (ISO ES-NC) — Decretos Forales 61/67/71/72-2022, Spanish
    └── lomloe-ES-VC.json   # Comunitat Valenciana (ISO ES-VC) — Decrets 100/106/107/108-2022, Valencian
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

### Optional per-dataset descriptor catalogue (`descriptors`)

The codes in `competencias_clave` (the perfil-d'eixida / competence codes — `CCL`,
`CMCT`, `CCL1`, `STEM2.3`…) are rendered with human-readable **text**. By default
that text comes from a shared, hardcoded **Castilian** catalogue (`CC_DESCRIPTIONS`,
defined in both `edition/lomloe.js` and `export/lomloe.js`).

A dataset may **override** that text — e.g. a community with a co-official language
(the Comunitat Valenciana publishes its descriptors in Valencian) — by adding an
optional **reserved top-level `descriptors` key**: a flat `{ "code": "text" }` map
sitting alongside the etapa keys.

```jsonc
{
  "descriptors": {                                  // optional, reserved (NOT an etapa)
    "CCL":  "Competència en comunicació lingüística",
    "CCL1": "CCL1 — S'expressa de manera oral, escrita…",
    "CMCT": "Competència matemàtica, científica i tecnològica"
  },
  "Educació Primària": { /* …etapes… */ }
}
```

Render-time lookup is **per-code with fallback**:
`descriptorText(code) = dataset.descriptors[code] ?? CC_DESCRIPTIONS[code] ?? code`
— so a dataset can override only some codes and inherit the rest. The key is
**reserved**: every top-level walker (`getEtapas()`, the tests' `walkAreas`) skips
it, so it never becomes an etapa tab; on save the editor denormalizes the used
codes' override text into `lomloeDescriptors` so standalone **exports** keep the
overridden wording. Datasets without a `descriptors` key are unaffected and keep
using `CC_DESCRIPTIONS`. `lomloe-ES-VC.json` is the first to ship one (Valencian).

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
| ES-AR | Aragón                        | ES-NC | **Com. Foral de Navarra** ✓ (available) |
| ES-AS | Asturias, Principado de       | ES-PV | País Vasco / Euskadi    |
| ES-CB | Cantabria                     | ES-RI | La Rioja                |
| ES-CL | Castilla y León               | ES-VC | **Comunitat Valenciana** ✓ (available) |
| ES-CM | Castilla-La Mancha            | ES-CE | Ceuta                   |
| ES-CN | **Canarias** ✓ (available)    | ES-ML | Melilla                 |
| ES-CT | Catalunya                     | ES-IB | Illes Balears           |
| ES-EX | **Extremadura** ✓ (available) | ES-GA | **Galicia** ✓ (available) |

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

Built from the four Órdenes that set the operative curricula for the *ámbito de gestión del Ministerio de Educación, Formación Profesional y Deportes* (Ceuta and Melilla). Use this dataset when the destination is a school inside that territory.

| BOE ID | Norma | Etapa |
|---|---|---|
| `BOE-A-2022-10958` | Orden EFP/608/2022, de 29 de junio | Educación Infantil |
| `BOE-A-2022-12066` | Orden EFP/678/2022, de 15 de julio | Educación Primaria |
| `BOE-A-2022-13172` | Orden EFP/754/2022, de 28 de julio | Educación Secundaria Obligatoria |
| `BOE-A-2022-13173` | Orden EFP/755/2022, de 28 de julio | Bachillerato |

**Infantil build note.** Orden EFP/608/2022 reproduces the state *enseñanzas
mínimas* of RD 95/2022 — the ámbito de gestión MEFPD is the state floor author.
The Infantil etapa is therefore built by inheriting `lomloe-ES.json` verbatim
with the code prefix re-emitted as `ES-EFP-INF…` (the same inheritance strategy
used below for ESO). Because the inherited state tree already carries the
Canarias-sourced competencias-clave backfill (see *Infantil competencias clave*
below), the ES-EFP Infantil criterios appear in the editor with the same
checkbox set as the state floor.

**ESO build note.** The Orden EFP/754/2022 curriculum (competencias específicas,
criterios de evaluación and saberes básicos) reproduces the state *enseñanzas
mínimas* of RD 217/2022 — the ámbito de gestión MEFPD *is* the state floor author.
The ESO etapa is therefore built by inheriting `lomloe-ES.json` verbatim with the
code prefix re-emitted as `ES-EFP-…` (the same inheritance strategy used for
`ES-EX` and `ES-MD`). The per-course distribution is taken from the order's own
Anexo II course markers (see the per-course filter table above). This replaced an
earlier extraction whose ESO etapa mis-parsed section headings (*Evaluación*,
*Especificaciones…*) as materias. The 4.º-curso optatives that are specific to the
MEFPD order and absent from the state RD (*Cultura Clásica*, *Introducción a la
Filosofía*, *Medios y Recursos Digitales*, *Segunda Lengua Extranjera*) are not
yet included, matching the scope of the `ES-EX`/`ES-MD` datasets.

### Cycle-to-year mapping

The BOE Royal Decrees define curriculum at cycle (ciclo) or course-group granularity, not per individual year. The iDevice UI browses by individual year, so cycle content is **duplicated** into each year of that cycle — matching the Canary Islands precedent. Generated codes embed the year/cycle tag (e.g. `ES-PRI1-MAT-CE01` for 1.º Primaria, `ES-PRI2-MAT-CE01` for 2.º Primaria) so each year keeps unique selection IDs even when the content is the same.

| Etapa | Niveles in dataset | BOE source granularity | Mapping |
|---|---|---|---|
| Infantil | `Primer ciclo (0-3 años)`, `Segundo ciclo (3-6 años)` | 2 ciclos | One-to-one; no per-year duplication (BOE does not split Infantil by year). |
| Primaria | `1º Primaria` … `6º Primaria` | 3 ciclos | Each ciclo is duplicated into both its years. |
| ESO | `1º ESO` … `4º ESO` | Mostly "1.º–3.º" plus "4.º" | "1.º–3.º" duplicated into 1.º, 2.º, 3.º. |
| Bachillerato | `1º Bachillerato`, `2º Bachillerato` | Per-curso | One-to-one (subjects named "I" / "II"). |

#### Per-course subject filter for the ESO obligatory block

The state RD 217/2022 defines the curriculum of the 1.º–3.º ESO subjects as a
single block, **without** assigning each subject to a specific course, so the
generator duplicates every subject into 1.º, 2.º and 3.º. The state floor (`ES`)
keeps that cycle view because the RD genuinely does not fix the per-course
distribution. Each autonomous community, however, *does* fix it in its decree's
*Anexo horario* (weekly hours per course; 0 h = not taught that year).

To avoid offering a subject in a course where it is not taught (e.g. *Física y
Química* is never in 1.º ESO), the editor filters the materia list per course
using `ESO_COURSE_SUBJECTS` in `edition/lomloe.js`. It is populated from:

| Dataset | Source of the per-course distribution |
|---|---|
| `ES-EX`  | Decreto 110/2022 (DOE), **Anexo V** |
| `ES-MD`  | Decreto 65/2022 (BOCM), **Anexo I** |
| `ES-EFP` | Orden EFP/754/2022 (BOE), per-course markers of **Anexo II** |

Datasets extracted per course already (`ES-CN`, `ES-GA`) and the state floor
(`ES`) are not listed and are shown unfiltered. 4.º ESO is also left unfiltered
because it is built on optional *materias de opción* the student chooses.

#### Infantil competencias clave

In Educación Infantil, LOMLOE does **not** itemise descriptores operativos or
competencia-clave links per competencia específica / criterio — the *perfil de
salida* is assessed at the end of basic education, not in Infantil — so the state
RD 95/2022 (and the regional decrees that adopt it) contain no such links and the
generator emitted empty `competencias_clave`. The **Canary Islands concretion is
the only source that itemised them**, using the eight bare **competencias clave**
(`CCL, CP, STEM, CD, CPSAA, CC, CE, CCEC`) rather than numbered descriptores.

Because the Infantil competencias específicas are the national framework (their
text is byte-identical across `ES`, `ES-CN`, `ES-EX`, `ES-MD`, `ES-EFP`), the
`ES`, `ES-EX` and `ES-MD` Infantil criterios are **backfilled** with the
competencia-clave set Canarias assigns to the matching área + competencia
(matched by normalised área name and competencia ordinal, guarded by a
description-equality assertion). This is what lets the editor offer the
competencias clave as checkboxes in Infantil (column header "Comp. Clave"); the
teacher then selects the applicable ones. `ES-EFP` inherits its Infantil etapa
from `ES` verbatim (see *Infantil build note* above), so the backfilled links
carry over without a separate pass. `ES-CN`/`ES-GA` already carry their own
links.

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

#### Subject codes (`codArea`) — official Extremadura siglas

Unlike the state dataset (whose `codArea` values are generator-derived abbreviations such as
`BIG`, `FQX`, `EPV`), the **Educación Primaria** and **ESO** subject codes of `ES-EX` use the
**official Extremadura siglas** taken from the *documentos de evaluación* resolution:

> **Resolución de 5 de diciembre de 2022** de la Secretaría General de Educación, por la que se
> establecen los documentos oficiales de evaluación LOMLOE — **DOE núm. 239, de 15 de diciembre de
> 2022** ([BG/FQ/GH/EPVA/TECD/EVCE…], Anexo VII — Actas de Primaria; Anexo VIII — Actas de ESO).
> PDF: `https://doe.juntaex.es/pdfs/doe/2022/2390o/22050223.pdf`

Mapping applied (derived → official): `BIG→BG`, `FQX→FQ`, `GEH→GH`, `EPV→EPVA`, `TYD→TECD`,
`EVC→EVCE`, `LEX→LE`, `EFI→EF`, `EEX→EyE`, `EAR→EA`, `FOP→FOPP`, `CMN→CMNS` (`LCL`, `MAT`, `MUS`,
`DIG`, `LAT`, `TEC` already coincide). These codes are embedded in every competencia/criterio/saber
code (`ES-EX-ESO1-BG-CE01-CR01`) and shown in the summary/export badges.

**Infantil** and **Bachillerato** keep the derived codes: the resolution's Infantil documents
(Anexos I–II) are qualitative and assign no subject siglas, and the Bachillerato actas (Anexo IX)
only codify *materias de modalidad* (with per-course suffixes, e.g. `DA I`/`DA II`) while common
subjects appear by full name without a sigla — so there is no complete, unambiguous official set to
adopt there.

### Generator script

A separate Python script (`generate_lomloe_es_ex.py`) implements the hybrid build: load `lomloe-ES.json`, inherit + reprefix, then overlay DOE-extracted regional saberes. The script is **attached to the PR** that introduced this dataset rather than committed to the repo. The Primaria/ESO `codArea` values are then re-mapped to the official Extremadura siglas documented above.

## `lomloe-ES-MD.json` — Comunidad de Madrid concretion

Hybrid dataset, built the same way as `ES-EX`. The Comunidad de Madrid decrees adopt the state RDs (their text states the state *enseñanzas mínimas* occupy 60% of the curriculum, the autonomous addition the remaining 40%), so competencias específicas and criterios de evaluación are inherited from the state RDs while the regional *contenidos* (= saberes básicos) are published as BOCM tables.

### Base curriculum decrees (BOCM / Comunidad de Madrid)

| Norma | Etapa |
|---|---|
| Decreto 36/2022, de 8 de junio | Educación Infantil |
| Decreto 61/2022, de 13 de julio | Educación Primaria |
| Decreto 65/2022, de 20 de julio | Educación Secundaria Obligatoria |
| Decreto 64/2022, de 20 de julio | Bachillerato |

### Modification decree reviewed

- `Decreto 59/2024, de 12 de junio` — modifies Decreto 61/2022 (Primaria), Decreto 65/2022 (ESO) and Decreto 64/2022 (Bachillerato). Reviewed for impact on the curriculum elements consumed by the iDevice (área/materia names, ESO Geografía e Historia content, Bachillerato subject organisation, criterios, contenidos). Changes that touch those elements are incorporated into the JSON; provisions that only affect organisation, bilingual-programme rules, or timetables are documented here and do not alter the dataset.

### Build strategy (hybrid)

1. **Competencias específicas + criterios de evaluación**: inherited verbatim from `lomloe-ES.json` with codes re-emitted as `ES-MD-…`. Madrid mandates the state minimums as the curriculum floor.
2. **Saberes básicos**: overlaid from the BOCM `CONTENIDOS` tables (columns `BLOQUES | (subbloque) | CONOCIMIENTOS, DESTREZAS Y ACTITUDES`) extracted with `pdfplumber`, attributed to areas by matching the official area vocabulary present on each page. Where the BOCM extraction does not attribute content to an area, the state saberes are used as the fallback per the LOMLOE inheritance rule. In the current dataset the Primaria *contenidos* are overlaid from the BOCM; Infantil, ESO and Bachillerato inherit the state saberes (their BOCM area attribution is pending refinement).

Granularity, code conventions and cycle-to-year duplication match the `ES`, `ES-EX` and `ES-CN` datasets. Codes use the `ES-MD-` prefix.

### Generator script

A Python script (`generate_lomloe_es_md.py`) implements the hybrid build. It is **attached to the PR** that introduced this dataset rather than committed to the repo.

## `lomloe-ES-GA.json` — Galicia concretion

Full extraction from the official Galician-language DOG (*Diario Oficial de Galicia*) decrees published by the Xunta de Galicia. Unlike the hybrid strategy used for Extremadura and Madrid, **all curriculum content is taken verbatim from the Galician-language official sources**. No Spanish text is inherited, translated, or paraphrased.

### Base curriculum decrees (DOG, Galician language `_gl.html`)

| DOG | Date | Norma | Etapa |
|-----|------|-------|-------|
| DOG 172 | 09/09/2022 | Decreto 150/2022, do 8 de setembro | Educación Infantil |
| DOG 183 | 26/09/2022 | Decreto 155/2022, do 15 de setembro | Educación Primaria |
| DOG 183 | 26/09/2022 | Decreto 156/2022, do 15 de setembro | Educación Secundaria Obrigatoria |
| DOG 183 | 26/09/2022 | Decreto 157/2022, do 15 de setembro | Bacharelato |

### Curriculum structure in Galician law

Galicia's decrees use Galician terminology that maps onto the LOMLOE framework:

| Galician term | LOMLOE equivalent | Schema field |
|---------------|------------------|--------------|
| Obxectivos da materia / área (OBX1…) | Competencias específicas | `competencias_especificas` |
| Criterios de avaliación (CA{b}.{n}) | Criterios de evaluación | `criterios_evaluacion` |
| Contidos | Saberes básicos | `saberes_basicos` |

### Nivel labels (Galician)

| Etapa | Nivel keys |
|-------|-----------|
| Educación Infantil | `Primeiro ciclo (0-3 anos)`, `Segundo ciclo (3-6 anos)` |
| Educación Primaria | `1º de educación primaria` … `6º de educación primaria` |
| Educación Secundaria Obrigatoria | `1º de ESO` … `4º de ESO` |
| Bacharelato | `1º de bacharelato`, `2º de bacharelato` |

### Language policy

All text in `lomloe-ES-GA.json` is in Galician (`gl`). The generator does **not** inherit from `lomloe-ES.json` and does **not** translate or paraphrase any content. Every OBX description, CA criterio, and Contido item is extracted verbatim from the official Galician-language DOG HTML.

### Build strategy (full Galician extraction)

1. Fetch the four DOG Galician HTML files (cached locally).
2. Locate `ANEXO II` in each decree; split by subject/area using `dog-base-sangria` section headers.
3. For each subject: extract OBX objectives (→ `competencias_especificas`) from the "Obxectivos" subsection.
4. For each course (per-year for Primaria/ESO/Bacharelato; per-ciclo for Infantil): extract CA criterio items (→ `criterios_evaluacion`) and Contidos items (→ `saberes_basicos`) organized by bloques.
5. Link each CA criterio to its competencia específica via the OBX reference tag.
6. Skip ciclo-level markers in Primaria (Primeiro/Segundo/Terceiro ciclo) that carry no direct content.

### Generator script

A Python script (`generate_lomloe_es_ga.py`, requires `beautifulsoup4`) implements the full extraction. It is **attached to the PR** that introduced this dataset rather than committed to the repo.

## `lomloe-ES-NC.json` — Comunidad Foral de Navarra concretion

Full extraction from the official **BON** (*Boletín Oficial de Navarra*) curriculum annexes (ANEXO II) published by the Gobierno de Navarra. **Language: Spanish.** All curriculum text is taken verbatim from the official Spanish-language sources — nothing is translated or paraphrased. Navarra publishes a Basque-language educational offer too, but the general curriculum dataset for this iDevice is the official Spanish curriculum (the Basque-medium subjects *Lengua Vasca Modelo A* and *Lengua Vasca y Literatura Modelo D* are included as areas, with their official Spanish-language curriculum text).

### Base curriculum decrees (Decretos Forales 2022, ANEXO II)

| Decree | Stage | BON |
|--------|-------|-----|
| Decreto Foral 61/2022 | Educación Infantil | BON 112, 07/06/2022 |
| Decreto Foral 67/2022 | Educación Primaria | BON 130, 01/07/2022 |
| Decreto Foral 71/2022 | Educación Secundaria Obligatoria | BON 155, 04/08/2022 |
| Decreto Foral 72/2022 | Bachillerato | BON 170, 26/08/2022 |

### Corrections / modifications reviewed

- **Decreto Foral 51/2025** (modifies DF 71/2022 for ESO) and the timetable/implementation Órdenes Forales 62/63/64/67-2022 were reviewed. The timetable orders do not alter the stable curriculum content (competencias/criterios/saberes) the iDevice represents and are therefore not extracted.

### Curriculum structure and mapping

- The Lexnavarra HTML detail pages contain only the decree articulado; the per-area curriculum lives in the official ANEXO II PDFs (linked from the Gobierno de Navarra curriculum portal), which are the extraction source.
- **Infantil** is kept by ciclo (`Primer ciclo (0-3 años)`, `Segundo ciclo (3-6 años)`). **Primaria** criterios/saberes are defined per ciclo and duplicated into each of the two concrete years of the cycle. **ESO/Bachillerato** are per course.
- Each competencia's *Vinculación con el Perfil de salida* descriptores are copied onto every one of its criterios (checkbox mode — the teacher picks them explicitly; `descriptorsPerCriterion` is not set).
- Single-course Bachillerato subjects whose specific course is fixed only in the separate timetable annex (not in ANEXO II) are made browsable in **both** Bachillerato years; this preserves the verbatim curriculum content for UI browsing.

### Nivel labels (Spanish)

`Educación Infantil`: `Primer ciclo (0-3 años)`, `Segundo ciclo (3-6 años)`. `Educación Primaria`: `1º`–`6º de Educación Primaria`. `Educación Secundaria Obligatoria`: `1º`–`4º de ESO`. `Bachillerato`: `1º`/`2º de Bachillerato`. Codes use the `ES-NC-` prefix with an embedded nivel tag (`INF1`, `PRI1`…`PRI6`, `ESO1`…`ESO4`, `BAC1`/`BAC2`).

## `lomloe-ES-VC.json` — Comunitat Valenciana concretion

Full extraction from the official **DOGV** (*Diari Oficial de la Generalitat Valenciana*) curriculum annexes published by the Generalitat Valenciana. **Language: Valencian.** All curriculum text is taken verbatim from the official Valencian-language sources — nothing is translated or paraphrased. No `ES-VC-es` (Spanish) variant is produced.

### Base curriculum decrees (Decrets 2022)

| Decree | Stage | Source |
|--------|-------|--------|
| Decret 100/2022 | Educació Infantil | DOGV 9402, 10/08/2022 (bilingual publication; Valencian column extracted) |
| Decret 106/2022 | Educació Primària | DOGV annex `annexos_primaria.pdf` |
| Decret 107/2022 | Educació Secundària Obligatòria | DOGV annex `ANEXOS_SECUND_VAL.pdf` (Annex III comunes + Annex IV optatives) |
| Decret 108/2022 | Batxillerat | DOGV annex `annexes_bat_val.pdf` |

### Issue #1883 attachments

The Valencian curriculum annexes attached to issue **#1883** (provided by community contributors) were used as the extraction source for Primària, ESO and Batxillerat and cross-checked against the official DOGV publications. The Infantil annex was taken from the official DOGV bilingual publication of Decret 100/2022 (Valencian column).

### Corrections / modifications reviewed

- The DOGV *correccions d'errades* of Decrets 100/106/107/108-2022 and **Decret 66/2024** (modifies Decret 107/2022 for ESO) were reviewed. Modifications affecting evaluation/implementation annexes rather than the stable competencia/criteri/saber content are not represented in the dataset.

### Curriculum structure and mapping

- **Infantil**: the decree defines `criteris d'avaluació` as a single per-cycle list at the *area* level (not mapped to individual competències); this list is attached to the area's first competència and the remaining competències carry their statement/description without criteris, faithfully matching the source.
- **Primària**: criteris/sabers are defined per cicle and duplicated into the concrete years of each cycle. The official annex labels each criteris column either by its cicle (`2n cicle (4t curs)`) or only by the cycle's reference year (`4t primària`, `4t de primària`, `4t curs EP`); both variants denote the **whole cicle** and are duplicated into both of its years — so a column printed without the literal word "cicle" is not collapsed onto its terminal year alone (this previously left `3r`/`5é` without criteris for *Educació Plàstica i Visual*, *Llengua Castellana* and *Matemàtiques*).
- **Primària first cicle (1r i 2n) — criteris from the 2026 modification**: the in-force **Decret 106/2022** does **not** publish `criteris d'avaluació` for the first cicle (its Annex III tables only carry `2n cicle (4t curs)` and `3r cicle (6é curs)`; the *sabers bàsics* matrix does include a `1r cicle` column). The **2026 PROJECTE de modificació del Decret 106/2022** re-publishes apartat 6 of each àrea with a `1r cicle | 2n cicle | 3r cicle` table that adds the missing first-cicle column. We take **only that `1r cicle` column** (verbatim) into `1r`/`2n d'Educació Primària`; the in-force `2n`/`3r cicle` criteris already in `3r`–`6é` are left untouched. Both first-cicle years carry identical criteris. *Música i Dansa* keeps only the four competències the modification graduates to the 1r cicle (its digital competència 5 is not graduated). The text comes from the official modification project (a draft), so it may change if the decree is published with edits.
- **ESO criteris — first-cycle block (1r–3r) + 4t**: Decret 107/2022 publishes criteris d'avaluació as a **first-cycle block (cursos 1r–3r)** plus a separate **4t** block (following RD 217/2022 arts. 8–9 and Decret 107/2022 arts. 10 & 12), not per individual course. A subject taught every year (Matemàtiques, Llengua Castellana, Geografia i Història, Llengua Estrangera, Educació Física) names its first-cycle column with a single representative course — the wording is editorially inconsistent across subjects (`2n d'ESO`, `3r ESO`, `SEGON CURS`, `2n ESO (1r cicle)`) — and its 4t column with 4t. The first-cycle criteris are duplicated into **1r, 2n and 3r**; previously they landed only on the named representative course, leaving the other first-cycle years empty. Subjects taught only in a real course pair carry **no** 4t column and keep their columns as the actual courses (Biologia i Geologia 1r/3r, Física i Química 2n/3r, Música 1r/2n, Tecnologia i Digitalització 1r/3r, Ed. Plàstica 2n/3r), so their untaught years stay correctly empty.
- **Batxillerat / single-course ESO opció subjects**: per course; subjects without an explicit course label in the annex are made browsable in every year of the stage (as in Navarra).
- **ESO *sabers bàsics* — all 27 subjects + Valencià.** The ESO sabers parser handles both source layouts: the X-mark matrix (with `4.N. Bloc M:`, `Bloc N.` or `4.N. <Title>` headers, and per-cycle/per-course mark columns) and the plain bulleted list with no per-course marks (emitted under a `TOTS` label that `build_dataset` maps to every nivel where the àrea has criteris). *Valencià: Llengua i Literatura* (`VLL`) is extracted from the decree section it shares with *Llengua Castellana* (the title is printed directly above it) and added to Primària and ESO.
- **Descriptors / competències clau (`competencias_clave`)**: extracted from each materia's *Connexions amb les competències clau* matrix (secció 3) that maps every competència específica to its key-competence families. The Valencian DOGV decrees publish only the **family codes** (`CCL`, `CP`, `STEM`/`CMCT`, `CD`, `CPSAA`, `CC`, `CE`, `CCEC`) per competència. Coverage: **Primària 9/9 àrees**, **ESO 26/28** (EE partial, LCA states its links as prose). Genuine source limits (not parse gaps): **Infantil** has no per-CE descriptor model; **Batxillerat**'s "connexions" pages are narrative prose with no per-CE matrix; ESO LCA likewise.
- **Why there are no *numbered* operatius (`CCL1`, `STEM2.3`…)**: those appear only in the decrees' preamble *catalogue* (definitions), never linked per competència (confirmed by OCR). They cannot be borrowed from the state RDs either, because **the Valencian decrees author their own competències específiques rather than adopting the state ones verbatim** — e.g. ESO *Biologia i Geologia* has **11** competències in Decret 107/2022 vs **6** in RD 217/2022, with different wording and no 1:1 correspondence. Grafting the RD's numbered descriptors onto the renumbered Valencian competències would mis-map curriculum content, so the dataset keeps the DOGV's own per-competència family codes. Numbered operatius would require a hand-curated, expert VC↔RD competència alignment.
- **Descriptor text in Valencian (`descriptors` catalogue)**: ES-VC ships the optional per-dataset `descriptors` override (see [Optional per-dataset descriptor catalogue](#optional-per-dataset-descriptor-catalogue-descriptors)) with the **Valencian** perfil-d'eixida wording — the 8 families + `CMCT` + the full numbered set `CCL1`…`CCEC4.2`, extracted verbatim from the DOGV decree preambles — so a teacher on the Valencian dataset sees Valencian descriptor text in the editor and exports. The shared Castilian catalogues also gained the previously-missing `CMCT` entry (ES-VC uses `CMCT` 1352× and its badges had no tooltip before).
- Note: a small number of Valencian clitic line-break hyphens (e.g. `participant-hi`) may be joined during de-hyphenation; affected items remain otherwise verbatim.

### Nivel labels (Valencian)

`Educació Infantil`: `Primer cicle (0-3 anys)`, `Segon cicle (3-6 anys)`. `Educació Primària`: `1r`–`6é d'Educació Primària`. `Educació Secundària Obligatòria`: `1r`–`4t d'ESO`. `Batxillerat`: `1r`/`2n de Batxillerat`. Codes use the `ES-VC-` prefix with an embedded nivel tag (`INF1`, `PRI1`…`PRI6`, `ESO1`…`ESO4`, `BAT1`/`BAT2`).

### Generator scripts (Navarra + Valencia)

A Python generator (`generate_lomloe_navarra_valencia.py`, requires `beautifulsoup4` + `pdfplumber`) implements the multi-column PDF extraction (column detection from cycle/course headers and code markers, header/footer stripping, deterministic ordered output). It is **attached to the PR** rather than committed to the repo, following the precedent of the other regional datasets.

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
3. Change to **Ámbito de gestión MEFPD** — verify the Ceuta/Melilla dataset loads (Infantil/Primaria/ESO/Bachillerato etapas all present) and previous ES selections persist.
4. Change to **Extremadura** — verify the regional dataset loads and that competencias mirror the state RD (inherited) while saberes show Extremadura-specific concretion where the DOE provides it.
5. Change to **Comunidad de Madrid** — verify the regional dataset loads; Primaria shows BOCM-specific contenidos, other etapas inherit the state saberes.
6. Change to **Galicia** — verify the regional dataset loads; all etapa and nivel labels are in Galician (`Educación Secundaria Obrigatoria`, `1º de educación primaria`, `Primeiro ciclo (0-3 anos)`, etc.) and competencia codes start with `ES-GA-`.
7. Change back to **Canarias** — verify it still loads correctly.

### Empty state

1. Add the iDevice without any selections.
2. Export the page — verify the exported HTML shows a graceful empty message.

## i18n

All user-facing strings pass through `_()` (eXeLearning's translation function).
To add translations, add entries to `translations/messages.{locale}.xlf` using the
string values in `edition/lomloe.js` as source keys.
