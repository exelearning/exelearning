# Valencian (ES-VC) ↔ State-RD competència alignment — descriptor grafting proposal

**Status: DRAFT for curriculum-expert review. Not applied to any dataset.**

## Purpose

`lomloe-ES-VC.json` currently carries, per competència específica, only the **bare
competence-family codes** (CCL, CP, CMCT, CD, CPSAA, CC, CE, CCEC) that the
Valencian DOGV decrees publish in their secció-3 *connexions amb les competències
clau* matrices. The maintainer wants the richer **numbered descriptors operatius
del perfil d'eixida** (CCL1, STEM2.3, CPSAA1.1, …). The Valencian decrees do **not**
publish those per competència; they live in the state Reials Decrets:

- **Educació Primària** → RD 157/2022 (BOE-A-2022-3296)
- **Educació Secundària Obligatòria** → RD 217/2022 (BOE-A-2022-4975)
- **Batxillerat** → RD 243/2022 (BOE-A-2022-5521)

## Why this is a proposal, not an automatic graft

The Valencian decrees **re-authored / renumbered** their competències específiques:
the count, order and per-CE family assignments differ from the state RDs (e.g. VC
Biologia i Geologia has **11** CEs vs RD 217's **6**; VC Matemàtiques **8** vs RD
**10**; for the core ESO materias **zero** VC CE statements are verbatim
translations of an RD CE). So the numbered descriptors **cannot** be grafted by CE
number. This document proposes, for each VC competència, the RD competència whose
descriptors would apply — by **cross-language statement similarity** — so an expert
can confirm or correct each row before any graft.

## How to read each row

`| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |`

- **VC CE / VC statement** — the Valencian competència (number + verbatim statement, truncated with … only for width).
- **→ RD CE / RD statement** — the best-matching state-RD competència in the mapped materia.
- **Sim** — cross-language token-overlap score (0–1) between the two statements. Higher = more likely the same competència. It is a *hint*, not proof.
- **DOGV families** — the bare family codes already in the dataset for this VC CE (the ground truth to check against).
- **RD numbered descriptors** — the perfil-d'eixida descriptors the RD attaches to the matched RD CE (what would be grafted).
- **Status** — see legend.

## Status legend

- **AUTO** — high similarity (≥ 0.45, clear margin over the runner-up) **and** the RD CE's descriptor family-set is consistent with the DOGV families already in the dataset (DOGV families non-empty and ⊆ RD families, CMCT≡STEM). Both the statement and the family ground-truth agree, so it is safe to graft, pending a sanity glance.
- **REVIEW** — plausible but unverified. Either mid similarity, or the families disagree, or — for **all of Batxillerat** — the Valencian source publishes **no bare family codes at all**, so there is no ground truth to cross-check the match against. A high-similarity Batxillerat row is therefore REVIEW, never AUTO: the expert must confirm the proposed RD CE before grafting.
- **VC-ONLY** — no usable RD equivalent (similarity below 0.30, or the VC matèria has no RD 2022 counterpart — e.g. the extra VC Biologia CEs, or VC-specific optatives like Creativitat Musical / Laboratori d'Arts Escèniques). The expert must decide descriptors manually or leave the bare codes.

## CMCT ↔ STEM note

The DOGV uses the family code **CMCT** (Competència matemàtica i competències bàsiques
en ciència i tecnologia); the state RDs use **STEM** for the same family. All family
comparisons in this table normalise **CMCT ≡ STEM**.

## Mapping caveats (expert: please verify the materia mapping first)

- VC-specific optatives with **no RD 2022 materia** are marked in the àrea header and yield all-VC-ONLY rows.
- A few Batxillerat materias are **absent from RD 243** (Psicologia, Imatge i So) or are split into I/II blocks (Tecnologia i Enginyeria → mapped to "Tecnología e Ingeniería II"); these are flagged.
- `Valencià: Llengua i Literatura (VLL)` is mapped to the RD's **Lengua Castellana y Literatura** (the parallel language competències), per the maintainer's guidance.
- Where an RD CE shows `—` under descriptors, the RD states no perfil-d'eixida descriptor list for that competència (or it could not be parsed) — nothing to graft.

## Infantil — out of scope

**Educació Infantil is intentionally excluded.** The LOMLOE Infantil model (RD 95/2022 / Decret 100/2022) is organised by àrees and sabers, not by competències específiques linked to numbered perfil-d'eixida descriptors, so there is no per-CE descriptor mapping to graft. Its `competencias_clave` stay empty by design.

## Summary

| Etapa | AUTO | REVIEW (with RD proposal) | VC-ONLY | Total VC CEs |
|---|---|---|---|---|
| Educació Primària | 0 | 24 (24) | 40 | 64 |
| Educació Secundària Obligatòria | 3 | 36 (36) | 136 | 175 |
| Batxillerat | 0 | 59 (59) | 157 | 216 |
| **Total** | **3** | **119** (119) | **333** | **455** |

**Actionable for the expert:** **3** AUTO rows (statement + family-verified, safe to graft) and **119** REVIEW rows that carry a concrete RD descriptor proposal to confirm or correct — **122** VC competències in total have a candidate numbered-descriptor mapping. The remaining **333** VC-ONLY competències have no RD equivalent and keep the DOGV bare codes (or are decided manually). All of Batxillerat is REVIEW because the Valencian Batxillerat source publishes no bare family codes, so its matches cannot be family-verified — only the cross-language statement similarity supports them.


---

## Educació Primària — RD 157/2022 (BOE-A-2022-3296)

### CONEIXEMENT DEL MEDI NATURAL, SOCIAL I CULTURAL (CMNSC) — VC 8 CEs / RD 9 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Utilitzar de forma guiada i delimitada dispositius i recursos digitals per a buscar infor… | → 1 | Utilizar dispositivos y recursos digitales de forma segura, responsable y eficiente, para… | 0.50 | CCL, CD, CE, CP, CPSAA | CCL3, STEM4, CD1, CD2, CD3, CD4, CD5, CCEC4 | REVIEW |
| 2 | Desenvolupar projectes cooperatius delimitats i realitzar investigacions senzilles de nat… | — | — | 0.11 | CCL, CD, CE, CP, CPSAA, STEM | — | VC-ONLY |
| 3 | Plantejar i respondre preguntes sobre qüestions de la vida quotidiana relatives a l'entor… | — | — | 0.25 | CCL, CD, CE, CP, CPSAA, STEM | — | VC-ONLY |
| 4 | Adoptar hàbits saludables de consum, alimentació, exercici i descans a partir del coneixe… | — | — | 0.25 | CCL, CD, CE, CP, CPSAA, STEM | — | VC-ONLY |
| 5 | Identificar, analitzar i proposar solucions als problemes generats per l'acció humana en… | → 6 | Identificar las causas y consecuencias de la intervención humana en el entorno, desde los… | 0.36 | CC, CCEC, CCL, CD, CE, CP, CPSAA, STEM | CCL5, STEM2, STEM5, CPSAA4, CC1, CC3, CC4, CE1 | REVIEW |
| 6 | Situar cronològicament i espacial els esdeveniments que marquen l'inici i el final dels g… | — | — | 0.08 | CC, CCEC, CCL, CD, CP, CPSAA | — | VC-ONLY |
| 7 | Reconéixer i descriure l'organització i estructura política i territorial municipal, de l… | — | — | 0.11 | CC, CCEC, CCL, CD, CE, CP, CPSAA, STEM | — | VC-ONLY |
| 8 | Reconéixer alguns elements destacats del patrimoni natural, històric i cultural de la Com… | — | — | 0.25 | CC, CCEC, CCL, CD, CE, CP, CPSAA | — | VC-ONLY |

### EDUCACIÓ FÍSICA (EF) — VC 6 CEs / RD 5 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Identificar i incorporar hàbits saludables bàsics en la vida quotidiana, desenvolupant un… | → 1 | Adoptar un estilo de vida activo y saludable, practicando regularmente actividades física… | 0.33 | CCL, CD, CE, CP, CPSAA, STEM | STEM2, STEM5, CPSAA2, CPSAA5, CE3 | REVIEW |
| 2 | Mostrar consciència i control dels elements fonamentals de la corporalitat en la resoluci… | — | — | 0.15 | CCEC, CCL, CE, CP, CPSAA, STEM | — | VC-ONLY |
| 3 | Resoldre reptes i situacions motrius fent ús de les capacitats físiques, perceptivomotriu… | → 2 | Adaptar los elementos propios del esquema corporal, las capacidades físicas, perceptivo-m… | 0.38 | CCL, CE, CP, CPSAA, STEM | STEM1, CPSAA4, CPSAA5 | REVIEW |
| 4 | Participar en l’execució de propostes artisticoexpressives amb aportacions estètiques i c… | → 4 | Reconocer y practicar diferentes manifestaciones lúdicas, físico-deportivas y artístico-… | 0.41 | CC, CCEC, CCL, CD, CE, CP, CPSAA | CC3, CCEC1, CCEC2, CCEC3, CCEC4 | REVIEW |
| 5 | Participar activament en l’exploració del patrimoni natural i cultural de l’entorn, a tra… | → 5 | Valorar diferentes medios naturales y urbanos como contextos de práctica motriz, interact… | 0.41 | CC, CCEC, CCL, CD, CP, CPSAA, STEM | STEM5, CC2, CC4, CE1, CE3 | REVIEW |
| 6 | Identificar i explorar recursos tecnològics relacionats amb l’activitat física i la salut… | — | — | 0.18 | CC, CCL, CD, CP, CPSAA | — | VC-ONLY |

### EDUCACIÓ PLÀSTICA I VISUAL (EPV) — VC 6 CEs / RD 4 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Explorar propostes artístiques de l’entorn patrimonial i de la cultura visual i audiovisu… | — | — | 0.25 | CC, CCEC, CCL, CP, CPSAA | — | VC-ONLY |
| 2 | Reconéixer i valorar les característiques fonamentals de la contemporaneïtat artística mi… | — | — | 0.25 | CC, CCEC, CCL, CP, CPSAA, STEM | — | VC-ONLY |
| 3 | Emprar de manera adequada la terminologia específica de l’àrea relativa a elements config… | — | — | 0.24 | CCEC, CCL, CP | — | VC-ONLY |
| 4 | Experimentar amb els elements bàsics del llenguatge visual i audiovisual, així com amb di… | → 3 | Expresar y comunicar de manera creativa ideas, sentimientos y emociones, experimentando c… | 0.42 | CCEC, CCL, CE, STEM | CCL1, CD2, CPSAA1, CPSAA5, CC2, CE1, CCEC3, CCEC4 | REVIEW |
| 5 | Utilitzar de manera guiada recursos digitals aplicats a la cerca d’informació i a la crea… | — | — | 0.14 | CC, CCEC, CCL, CD, CP, CPSAA, STEM | — | VC-ONLY |
| 6 | Participar en les diferents fases d’un procés creatiu col·laboratiu amb actitud inclusiva… | — | — | 0.27 | CC, CCEC, CCL, CE, CPSAA, STEM | — | VC-ONLY |

### EDUCACIÓ EN VALORS ÈTICS I CÍVICS (EVEC) — VC 7 CEs / RD 4 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Dialogar i debatre de manera assertiva i respectuosa en situacions de l’entorn personal,… | — | — | 0.13 | CC, CCL, CPSAA | — | VC-ONLY |
| 2 | Reconéixer les emocions pròpies i alienes en situacions de conflicte de l’àmbit escolar i… | — | — | 0.12 | CC, CCL, CP, CPSAA | — | VC-ONLY |
| 3 | Participar en l’elaboració de les regles de convivència escolar en el marc dels principis… | — | — | 0.18 | CC, CD, CPSAA | — | VC-ONLY |
| 4 | Identificar, analitzar i valorar críticament estereotips que incideixen en el benestar fí… | — | — | 0.13 | CC, CCL, CD, CP, CPSAA | — | VC-ONLY |
| 5 | Identificar en l’entorn proper els beneficis dels valors democràtics promoguts per les ll… | — | — | 0.14 | CC, CE, CPSAA | — | VC-ONLY |
| 6 | Proposar i implicar-se en accions front a situacions de desigualtat i injustícia social e… | — | — | 0.06 | CC, CCEC, CD, CE, CPSAA | — | VC-ONLY |
| 7 | Identificar els desafiaments ecològics plantejats pels Objectius de Desenvolupament Soste… | — | — | 0.14 | CC, CD, CE, STEM | — | VC-ONLY |

### LLENGUA CASTELLANA Y LITERATURA (LCL) — VC 9 CEs / RD 10 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Reconéixer la diversitat lingüística i cultural de la Comunitat Valenciana, d’Espanya i d… | — | — | 0.29 | CC, CCEC, CCL, CD, CE, CP, CPSAA | — | VC-ONLY |
| 2 | Comprendre, interpretar i valorar, de manera guiada, textos orals i multimodals propis de… | → 9 | Reflexionar de forma guiada sobre el lenguaje a partir de procesos de producción y compre… | 0.30 | CC, CCL, CD, CP, CPSAA | CCL1, CCL2, CP2, STEM1, STEM2, CPSAA5 | REVIEW |
| 3 | Comprendre, interpretar i valorar, de manera guiada, textos escrits i multimodals propis… | → 9 | Reflexionar de forma guiada sobre el lenguaje a partir de procesos de producción y compre… | 0.30 | CC, CCL, CD, CP, CPSAA | CCL1, CCL2, CP2, STEM1, STEM2, CPSAA5 | REVIEW |
| 4 | Produir, de manera guiada, missatges orals senzills amb coherència, cohesió i adequació a… | — | — | 0.18 | CC, CCL, CD, CP, CPSAA | — | VC-ONLY |
| 5 | Produir, de manera guiada, textos escrits i multimodals adequats i coherents amb un vocab… | → 5 | Producir textos escritos y multimodales, con corrección gramatical y ortográfica básicas,… | 0.47 | CC, CCL, CD, CP, CPSAA | CCL1, CCL3, CCL5, STEM1, CD2, CD3, CPSAA5, CC2 | REVIEW |
| 6 | Interactuar de manera oral, escrita i multimodal, a través de textos senzills dels àmbits… | — | — | 0.24 | CC, CCL, CD, CE, CP, CPSAA | — | VC-ONLY |
| 7 | Mediar entre interlocutors utilitzant estratègies d’adaptació i de simplificació del llen… | — | — | 0.19 | CC, CCL, CD, CE, CP, CPSAA | — | VC-ONLY |
| 8 | Llegir de manera autònoma obres i textos de caràcter divers, seleccionats atenent els seu… | → 7 | Leer de manera autónoma obras diversas seleccionadas atendiendo a sus gustos e intereses,… | 0.60 | CC, CCL, CD, CE, CP, CPSAA | CCL1, CCL4, CD3, CPSAA1, CCEC1, CCEC2, CCEC3 | REVIEW |
| 9 | Llegir i produir textos amb intenció literària, senzills, amb llenguatge pròxim a l’alumn… | — | — | 0.20 | CC, CCEC, CCL, CD, CE, CP, CPSAA | — | VC-ONLY |

### LLENGUA ESTRANGERA (LE) — VC 7 CEs / RD 6 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Multilingüisme i interculturalitat Reconéixer i usar els repertoris lingüístics de divers… | → 5 | Reconocer y usar los repertorios lingüísticos personales entre distintas lenguas, reflexi… | 0.38 | CC, CCEC, CCL, CD, CP, CPSAA | CP2, STEM1, CD2, CPSAA1, CPSAA4, CPSAA5, CE3 | REVIEW |
| 2 | Comprensió oral Interpretar la informació de textos orals i multimodals, breus i senzills… | → 4 | Mediar en situaciones predecibles, usando estrategias y conocimientos para procesar y tra… | 0.30 | CC, CCEC, CCL, CD, CP, CPSAA | CCL5, CP1, CP2, CP3, STEM1, CPSAA1, CPSAA3, CCEC1 | REVIEW |
| 3 | Comprensió escrita Interpretar la informació expressada per mitjà de textos escrits i mul… | — | — | 0.29 | CC, CCEC, CCL, CD, CP, CPSAA | — | VC-ONLY |
| 4 | Expressió oral Produir de manera guiada textos orals i multimodals, comprensibles i estru… | → 2 | Producir textos sencillos de manera comprensible y estructurada, mediante el empleo de es… | 0.50 | CC, CCEC, CCL, CD, CP, CPSAA | CCL1, CP1, CP2, STEM1, CD2, CPSAA5, CE1, CCEC4 | REVIEW |
| 5 | Expressió escrita Produir, de manera guiada, textos escrits i multimodals, comprensibles… | → 2 | Producir textos sencillos de manera comprensible y estructurada, mediante el empleo de es… | 0.43 | CC, CCEC, CCL, CD, CP, CPSAA | CCL1, CP1, CP2, STEM1, CD2, CPSAA5, CE1, CCEC4 | REVIEW |
| 6 | Interacció oral i escrita Interaccionar de manera oral, escrita i multimodal per mitjà de… | → 2 | Producir textos sencillos de manera comprensible y estructurada, mediante el empleo de es… | 0.40 | CC, CCEC, CCL, CD, CE, CP, CPSAA, STEM | CCL1, CP1, CP2, STEM1, CD2, CPSAA5, CE1, CCEC4 | REVIEW |
| 7 | Mediació oral i escrita Mediar entre interlocutors utilitzant estratègies d’adaptació i s… | → 4 | Mediar en situaciones predecibles, usando estrategias y conocimientos para procesar y tra… | 0.48 | CC, CCEC, CCL, CD, CE, CP, CPSAA, STEM | CCL5, CP1, CP2, CP3, STEM1, CPSAA1, CPSAA3, CCEC1 | REVIEW |

### MATEMÀTIQUES (M) — VC 8 CEs / RD 8 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Resoldre problemes relacionats amb situacions reals de l'entorn personal, social i educat… | → 1 | Interpretar situaciones de la vida cotidiana, proporcionando una representación matemátic… | 0.33 | CC, CD, CE, CPSAA, STEM | STEM1, STEM2, STEM4, CD2, CPSAA5, CE1, CE3, CCEC4 | REVIEW |
| 2 | Observar, formular, explorar i comprovar conjectures senzilles sobre propietats i relacio… | — | — | 0.29 | CCEC, CD, STEM | — | VC-ONLY |
| 3 | Construir models matemàtics concrets i utilitzar conceptes i procediments matemàtics senz… | — | — | 0.22 | CC, CCEC, CE, STEM | — | VC-ONLY |
| 4 | Construir i aplicar algorismes senzills per a afrontar situacions i resoldre problemes re… | — | — | 0.29 | CD, CE, STEM | — | VC-ONLY |
| 5 | Utilitzar amb correcció el simbolisme matemàtic, fent transformacions i algunes conversio… | — | — | 0.14 | CCL, CD, CPSAA, STEM | — | VC-ONLY |
| 6 | Comprendre i produir missatges orals i escrits concrets de manera informal, utilitzant un… | — | — | 0.28 | CCL, CE, CP, STEM | — | VC-ONLY |
| 7 | Identificar fenòmens i problemes importants des del punt de vista cultural i social en el… | — | — | 0.23 | CC, CCEC, CPSAA, STEM | — | VC-ONLY |
| 8 | Gestionar les emocions i actituds implicades en els processos matemàtics, acceptant la in… | → 7 | Desarrollar destrezas personales que ayuden a identificar y gestionar emociones al enfren… | 0.30 | CE, CPSAA, STEM | STEM5, CPSAA1, CPSAA4, CPSAA5, CE2, CE3 | REVIEW |

### MÚSICA I DANSA (MD) — VC 4 CEs / RD 4 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Reconéixer i investigar obres de diversos gèneres i els components estructurals i tècnics… | → 1 | Descubrir propuestas artísticas de diferentes géneros, estilos, épocas y culturas, a trav… | 0.37 | CC, CCEC, CCL, CD, CP, CPSAA, STEM | CP3, STEM1, CD1, CPSAA3, CC1, CE2, CCEC1, CCEC2 | REVIEW |
| 2 | Explorar, distingir i relacionar els paràmetres, les característiques i les representacio… | — | — | 0.07 | CCEC, CCL, CD, STEM | — | VC-ONLY |
| 3 | Interpretar jocs i propostes musicals i escèniques diverses a través de la veu, els instr… | — | — | 0.15 | CC, CCEC, CCL, CD, CP, CPSAA | — | VC-ONLY |
| 4 | Crear propostes musicals i escèniques breus de forma guiada a partir d’un o de diversos l… | — | — | 0.08 | CC, CCEC, CCL, CD, CE, CPSAA | — | VC-ONLY |

### VALENCIÀ: LLENGUA I LITERATURA (VLL) — VC 9 CEs / RD 10 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Reconéixer la diversitat lingüística i cultural de la Comunitat Valenciana, d’Espanya i d… | — | — | 0.29 | CC, CCEC, CCL, CD, CE, CP, CPSAA | — | VC-ONLY |
| 2 | Comprendre, interpretar i valorar, de manera guiada, textos orals i multimodals propis de… | → 9 | Reflexionar de forma guiada sobre el lenguaje a partir de procesos de producción y compre… | 0.30 | CC, CCL, CD, CP, CPSAA | CCL1, CCL2, CP2, STEM1, STEM2, CPSAA5 | REVIEW |
| 3 | Comprendre, interpretar i valorar, de manera guiada, textos escrits i multimodals propis… | → 9 | Reflexionar de forma guiada sobre el lenguaje a partir de procesos de producción y compre… | 0.30 | CC, CCL, CD, CP, CPSAA | CCL1, CCL2, CP2, STEM1, STEM2, CPSAA5 | REVIEW |
| 4 | Produir, de manera guiada, missatges orals senzills amb coherència, cohesió i adequació a… | — | — | 0.18 | CC, CCL, CD, CP, CPSAA | — | VC-ONLY |
| 5 | Produir, de manera guiada, textos escrits i multimodals adequats i coherents amb un vocab… | → 5 | Producir textos escritos y multimodales, con corrección gramatical y ortográfica básicas,… | 0.47 | CC, CCL, CD, CP, CPSAA | CCL1, CCL3, CCL5, STEM1, CD2, CD3, CPSAA5, CC2 | REVIEW |
| 6 | Interactuar de manera oral, escrita i multimodal, a través de textos senzills dels àmbits… | — | — | 0.24 | CC, CCL, CD, CE, CP, CPSAA | — | VC-ONLY |
| 7 | Mediar entre interlocutors utilitzant estratègies d’adaptació i de simplificació del llen… | — | — | 0.19 | CC, CCL, CD, CE, CP, CPSAA | — | VC-ONLY |
| 8 | Llegir de manera autònoma obres i textos de caràcter divers, seleccionats atenent els seu… | → 7 | Leer de manera autónoma obras diversas seleccionadas atendiendo a sus gustos e intereses,… | 0.60 | CC, CCL, CD, CE, CP, CPSAA | CCL1, CCL4, CD3, CPSAA1, CCEC1, CCEC2, CCEC3 | REVIEW |
| 9 | Llegir i produir textos amb intenció literària, senzills, amb llenguatge pròxim a l’alumn… | — | — | 0.20 | CC, CCEC, CCL, CD, CE, CP, CPSAA | — | VC-ONLY |


## Educació Secundària Obligatòria — RD 217/2022 (BOE-A-2022-4975)

### ARTS ESCÈNIQUES (AE) — VC 5 CEs / RD 0 CEs — _VC-specific matèria, no RD 2022 equivalent → all rows VC-ONLY_

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Apreciar i argumentar l'aportació de les manifestacions escèniques al patrimoni cultural,… | — | — | — | CCL, CPSAA, CC, CCEC | — | VC-ONLY |
| 2 | Analitzar propostes escèniques des d’un punt de vista estètic, amb actitud crítica, explo… | — | — | — | CCL, CP, CD, CPSAA, CC, CCEC | — | VC-ONLY |
| 3 | Planificar i crear produccions escèniques individuals i col·lectives mitjançant l’ús d’el… | — | — | — | CCL, CPSAA, CE, CCEC | — | VC-ONLY |
| 4 | Interpretar obres o peces escèniques de creació pròpia o aliena mitjançant els instrument… | — | — | — | CCL, CP, CPSAA, CCEC | — | VC-ONLY |
| 5 | Posar en escena projectes artístics d’un repertori divers, cooperant en l’organització de… | — | — | — | CPSAA, CCEC | — | VC-ONLY |

### BIOLOGIA I GEOLOGIA (BG) — VC 11 CEs / RD 6 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Resoldre problemes científics abordables en l’àmbit escolar a partir de treballs d’invest… | — | — | 0.27 | CD, CPSAA, STEM | — | VC-ONLY |
| 2 | Analitzar situacions problemàtiques reals utilitzant la lògica científica i explorant les… | — | — | 0.15 | CC, CD, CPSAA, STEM | — | VC-ONLY |
| 3 | Utilitzar el coneixement científic com a instrument del pensament crític, interpretant i… | — | — | 0.20 | CCL, CP, STEM | — | VC-ONLY |
| 4 | Justificar la validesa del model científic com a producte dinàmic que es va revisant i re… | — | — | 0.08 | CC, CCEC, STEM | — | VC-ONLY |
| 5 | Adoptar hàbits de vida saludable basats en el coneixement del funcionament del propi cos,… | — | — | 0.19 | CC, CPSAA, STEM | — | VC-ONLY |
| 6 | Identificar i acceptar la sexualitat personal, i respectar la varietat d’identitats de gè… | — | — | 0.14 | CC, CPSAA, STEM | — | VC-ONLY |
| 7 | Actuar amb responsabilitat i participar activament en la conservació de totes les formes… | — | — | 0.25 | CC, CCEC, CE, CPSAA, STEM | — | VC-ONLY |
| 8 | Utilitzar el coneixement geològic bàsic sobre el funcionament del planeta Terra com a sis… | — | — | 0.11 | CC, CCEC, CPSAA, STEM | — | VC-ONLY |
| 9 | Analitzar i interpretar les principals fites de la història del planeta Terra i els princ… | — | — | 0.18 | CC, CPSAA, STEM | — | VC-ONLY |
| 10 | Adoptar hàbits de comportament en l’activitat quotidiana responsables amb l’entorn, aplic… | — | — | 0.29 | CC, CE, CPSAA, STEM | — | VC-ONLY |
| 11 | Proposar solucions realistes basades en el coneixement científic davant de problemes de n… | — | — | 0.18 | CC, CCL, CE, STEM | — | VC-ONLY |

### CULTURA CLÀSSICA (CC) — VC 5 CEs / RD 0 CEs — _VC-specific matèria, no RD 2022 equivalent → all rows VC-ONLY_

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Reconéixer i valorar la pervivència de les característiques de la vida social grega i rom… | — | — | — | CCL, CD, CPSAA, CE, CCEC | — | VC-ONLY |
| 2 | Relacionar els esdeveniments més rellevants de la història grega i romana amb la configur… | — | — | — | CCL, CMCT, CD, CPSAA, CC, CE | — | VC-ONLY |
| 3 | Identificar els trets i valorar la importància i la pervivència de la llengua grega i lla… | — | — | — | CCL, CP, CMCT, CD, CPSAA, CC, CE | — | VC-ONLY |
| 4 | Localitzar i relacionar la presència del món clàssic en el patrimoni històric d'Europa, d… | — | — | — | CD, CPSAA, CC, CE, CCEC | — | VC-ONLY |
| 5 | Des d’una perspectiva inclusiva, investigar, identificar i explicar els referents cultura… | — | — | — | CD, CPSAA, CC, CE, CCEC | — | VC-ONLY |

### CREATIVITAT MUSICAL (CM) — VC 6 CEs / RD 0 CEs — _VC-specific matèria, no RD 2022 equivalent → all rows VC-ONLY_

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Identificar els elements compositius, estructurals i comunicatius de creacions sonores i… | — | — | — | CCL, CP, CPSAA, CCEC | — | VC-ONLY |
| 2 | Analitzar els elements sonors de l'entorn més pròxim mitjançant l'escolta activa i explor… | — | — | — | CMCT, CPSAA, CCEC | — | VC-ONLY |
| 3 | Interpretar peces de música urbana i creacions sonores i interdisciplinàries pròpies, mit… | — | — | — | CPSAA, CE, CCEC | — | VC-ONLY |
| 4 | Realitzar improvisacions guiades musicals o interdisciplinàries, tot utilitzant llenguatg… | — | — | — | CMCT, CPSAA, CCEC | — | VC-ONLY |
| 5 | Crear i posar en escena projectes sonors i interdisciplinaris, individuals i col·lectius,… | — | — | — | CCL, CP, CMCT, CPSAA, CE, CCEC | — | VC-ONLY |
| 6 | Emprar recursos digitals en processos de creació sonora i interdisciplinària, incorporant… | — | — | — | CMCT, CPSAA, CCEC | — | VC-ONLY |

### DIGITALITZACIÓ (D) — VC 5 CEs / RD 4 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Dissenyar equips i xarxes de comunicació d’ús personal i domèstic, administrar-los i util… | — | — | 0.18 | CD, STEM | — | VC-ONLY |
| 2 | Buscar, seleccionar i organitzar la informació en l’entorn personal d’aprenentatge, i uti… | — | — | 0.21 | CCEC, CCL, CD, CP, CPSAA | — | VC-ONLY |
| 3 | Mostrar hàbits que fomenten el benestar en entorns digitals, aplicant mesures preventives… | → 3 | Desarrollar hábitos que fomenten el bienestar digital, aplicando medidas preventivas y co… | 0.62 | CD, CPSAA, STEM | CCL3, STEM5, CD1, CD4, CPSAA2, CPSAA5, CC2, CC3 | AUTO |
| 4 | Exercir una ciutadania digital crítica mitjançant un ús actiu, responsable i ètic dels mi… | — | — | 0.21 | CC, CCL, CD, CE | — | VC-ONLY |
| 5 | Afrontar els desafiaments informàtics i digitals que la societat de la informació plantej… | — | — | 0.23 | CCL, CD, CE, CPSAA, STEM | — | VC-ONLY |

### ECONOMIA I EMPRENEDORIA (EE) — VC 7 CEs / RD 7 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Dissenyar un projecte personal que genere valor per a la societat, analitzar les fortales… | → 1 | Analizar y valorar las fortalezas y debilidades propias y de los demás, reflexionando sob… | 0.43 | CC, CCEC, CE, CPSAA | CPSAA1, CC1, CE2, CCEC3 | REVIEW |
| 2 | Utilitzar estratègies de conformació d’equips i mostrar habilitats socials d’empatia, res… | → 2 | Utilizar estrategias de conformación de equipos, así como habilidades sociales, de comuni… | 0.53 | CC, CCL, CE, CP, CPSAA | CCL1, CP1, CP2, CPSAA1, CPSAA3, CC1, CE2 | AUTO |
| 3 | Identificar necessitats de les persones en l’àmbit local i global i proposar solucions se… | → 3 | Elaborar, con sentido ético y solidario, ideas y soluciones innovadoras y sostenibles que… | 0.33 | — | STEM3, CC4, CE1, CE2, CE3, CCEC3 | REVIEW |
| 4 | Identificar els recursos necessaris en el procés de desenvolupament de la idea o la soluc… | → 4 | Seleccionar y reunir los recursos disponibles en el proceso de desarrollo de la idea o so… | 0.35 | — | STEM3, CD2, CE1, CE2 | REVIEW |
| 5 | Presentar i exposar idees i solucions creatives que transmeten missatges convincents adeq… | → 5 | Presentar y exponer ideas y soluciones creativas, utilizando estrategias comunicativas ág… | 0.53 | — | CCL1, CCL2, CCL3, CD3, CPSAA1, CC1, CE1, CE2 | REVIEW |
| 6 | Analitzar aspectes bàsics de l’economia i les finances, valorar críticament el problema d… | → 6 | Comprender aspectos básicos de la economía y las finanzas, valorando críticamente el prob… | 0.39 | — | CC1, CE1, CE2, CE3 | REVIEW |
| 7 | Dissenyar i analitzar de manera cooperativa i àgil prototips innovadors i sostenibles, a… | → 7 | Construir y analizar de manera cooperativa, autónoma y ágil prototipos innovadores y sost… | 0.69 | CC, CD, CPSAA, STEM | STEM3, CD5, CPSAA3, CPSAA5, CE2, CE3 | REVIEW |

### EDUCACIÓ FÍSICA (EF) — VC 5 CEs / RD 5 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Integrar un estil de vida actiu mitjançant la pràctica de l’activitat física i esportiva… | — | — | 0.21 | CC, CCL, CD, CE, CPSAA, STEM | — | VC-ONLY |
| 2 | Resoldre amb èxit diferents reptes i situacions motrius a través de propostes físiques i… | — | — | 0.12 | CC, CCEC, CCL, CP, CPSAA, STEM | — | VC-ONLY |
| 3 | Participar en processos de creació de naturalesa artisticoexpressiva mitjançant l’ús del… | — | — | 0.17 | CC, CCEC, CCL, CD, CE, CPSAA | — | VC-ONLY |
| 4 | Interaccionar de manera sostenible amb el patrimoni natural i cultural mitjançant activit… | → 5 | Adoptar un estilo de vida sostenible y ecosocialmente responsable aplicando medidas de se… | 0.30 | CC, CD, CE, CPSAA, STEM | STEM5, CC4, CE1, CE3 | REVIEW |
| 5 | Seleccionar i fer un ús crític i segur de les tecnologies de la informació i la comunicac… | → 5 | Adoptar un estilo de vida sostenible y ecosocialmente responsable aplicando medidas de se… | 0.42 | CD, CE, CP, CPSAA | STEM5, CC4, CE1, CE3 | REVIEW |

### EDUCACIÓ PLÀSTICA, VISUAL I AUDIOVISUAL (EPVA) — VC 4 CEs / RD 8 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Analitzar de manera crítica i argumentada diferents propostes artístiques, contemporànies… | — | — | 0.26 | CC, CCEC, CCL, CP, CPSAA, STEM | — | VC-ONLY |
| 2 | Compartir idees i opinions usant la terminologia específica de l'àrea en la comunicació d… | → 2 | Explicar las producciones plásticas, visuales y audiovisuales propias, comparándolas con… | 0.33 | CCEC, CCL, CP | CCL1, CPSAA1, CPSAA3, CC1, CC3, CCEC1, CCEC3 | REVIEW |
| 3 | Comunicar idees, sentiments i emocions, experimentant amb els elements del llenguatge vis… | — | — | 0.27 | CCEC, CCL, CE, STEM | — | VC-ONLY |
| 5 | Crear produccions artístiques col·lectives, ateses les diferents fases del procés creatiu… | → 5 | Realizar producciones artísticas individuales o colectivas con creatividad e imaginación,… | 0.31 | CC, CCEC, CCL, CE, CPSAA, STEM | CCL2, CPSAA1, CPSAA3, CPSAA4, CC3, CCEC3, CCEC4 | REVIEW |

### EMPRENEDORIA SOCIAL I SOSTENIBLE (ESS) — VC 6 CEs / RD 0 CEs — _VC-specific matèria, no RD 2022 equivalent → all rows VC-ONLY_

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Identificar en si mateix qualitats personals i habilitats socials que afavorisquen la pre… | — | — | — | CCL, CD, CPSAA, CC, CE, CCEC | — | VC-ONLY |
| 2 | Participar en equips de treball, valorant el plantejament i discussió tant de les propost… | — | — | — | CCL, CD, CPSAA, CC, CE, CCEC | — | VC-ONLY |
| 3 | Argumentar el paper de l'economia social com a marc que afavoreix el desenvolupament d'un… | — | — | — | CCL, CP, STEM, CD, CC, CE, CCEC | — | VC-ONLY |
| 4 | Dissenyar projectes bàsics sostenibles i innovadors, utilitzant eines de l'economia socia… | — | — | — | STEM, CPSAA, CC, CE, CCEC | — | VC-ONLY |
| 5 | Planificar un pressupost personal senzill, avaluant la importància de l'estalvi i el risc… | — | — | — | CCL, CP, STEM, CD, CC, CE | — | VC-ONLY |
| 6 | Analitzar documents relatius al consum, des d'una perspectiva responsable i sostenible, i… | — | — | — | CCL, STEM, CD, CPSAA, CC, CE | — | VC-ONLY |

### EDUCACIÓ EN VALORS CÍVICS I ÈTICS (EVCE) — VC 7 CEs / RD 4 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Dialogar i debatre de manera assertiva, respectuosa i correctament argumentada sobre prob… | — | — | 0.21 | CE, CP, CPSAA, STEM | — | VC-ONLY |
| 2 | Gestionar les emocions en situacions de conflicte per a poder afrontar-les des de la cult… | — | — | 0.00 | CC, CCEC, CE, CPSAA | — | VC-ONLY |
| 3 | Analitzar de manera crítica les normes i lleis vigents en el marc de la Declaració Univer… | — | — | 0.12 | CC, CE, CPSAA | — | VC-ONLY |
| 4 | Reconéixer, denunciar i combatre els estereotips i rols associats a partir d’una reflexió… | — | — | 0.20 | CC, CE, CP, STEM | — | VC-ONLY |
| 5 | Identificar, analitzar i valorar en l’àmbit internacional els beneficis dels valors democ… | — | — | 0.14 | CC, CCEC, CE, CP, CPSAA | — | VC-ONLY |
| 6 | Proposar i desplegar accions responsables i justes compromeses amb la transformació socia… | — | — | 0.10 | CC, CCEC, CE, CP, CPSAA | — | VC-ONLY |
| 7 | Explicar els desafiaments ecològics plantejats pels Objectius de Desenvolupament Sostenib… | — | — | 0.13 | CC, CCEC, CD, CE, CPSAA | — | VC-ONLY |

### FILOSOFIA (F) — VC 4 CEs / RD 0 CEs — _VC-specific matèria, no RD 2022 equivalent → all rows VC-ONLY_

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Analitzar problemes quotidians des d'una perspectiva filosòfica i amb una mirada crítica,… | — | — | — | CPSAA, CC | — | VC-ONLY |
| 2 | Identificar i diferenciar les premisses, estratègies argumentatives i conclusions de text… | — | — | — | CP, CPSAA | — | VC-ONLY |
| 3 | Explicar les diferències entre elements racionals i emocionals en la justificació de deci… | — | — | — | CC, CCEC | — | VC-ONLY |
| 4 | Elaborar i exposar d'una manera clara, ordenada i argumentada idees i propostes filosòfiq… | — | — | — | CP, CPSAA, CC | — | VC-ONLY |

### FORMACIÓ I ORIENTACIÓ PERSONAL I PROFESSIONAL (FOPP) — VC 5 CEs / RD 0 CEs — _VC-specific matèria, no RD 2022 equivalent → all rows VC-ONLY_

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Identificar en si mateix alguns processos psicològics bàsics implicats en l’aprenentatge,… | — | — | — | CCL, CMCT, CD, CPSAA, CE, CCEC | — | VC-ONLY |
| 2 | Reconéixer alguns factors personals i socioculturals que intervenen en la comprensió de s… | — | — | — | CCL, CD, CPSAA, CC | — | VC-ONLY |
| 3 | Explorar l’entorn, identificar les oportunitats de desenvolupament personal, acadèmic i p… | — | — | — | CCL, CP, CD | — | VC-ONLY |
| 4 | Definir metes realistes, ajustades al coneixement de si mateix, i utilitzar la informació… | — | — | — | CCL, CMCT, CPSAA, CE | — | VC-ONLY |
| 5 | Dissenyar un projecte personal, acadèmic i professional propi i conjugar les necessitats… | — | — | — | CCL, CP, CMCT, CD, CPSAA, CE, CCEC | — | VC-ONLY |

### FÍSICA I QUÍMICA (FQ) — VC 10 CEs / RD 6 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Resoldre problemes científics abordables en l’àmbit escolar a partir de treballs d’invest… | — | — | 0.27 | CCL, CD, CE, CP, CPSAA, STEM | — | VC-ONLY |
| 2 | Analitzar i resoldre situacions problemàtiques de l’àmbit de la física i la química utili… | — | — | 0.24 | CC, CCL, CD, CE, CPSAA, STEM | — | VC-ONLY |
| 3 | Utilitzar el coneixement científic com a instrument del pensament crític, interpretant i… | — | — | 0.21 | CC, CCEC, CCL, CD, CP, CPSAA, STEM | — | VC-ONLY |
| 4 | Justificar la validesa del model científic com a producte dinàmic que es va revisant i re… | — | — | 0.15 | CC, CPSAA, STEM | — | VC-ONLY |
| 5 | Analitzar alguns fenòmens naturals i predir el seu comportament utilitzant models de la f… | — | — | 0.19 | CCL, CPSAA, STEM | — | VC-ONLY |
| 6 | Utilitzar adequadament el llenguatge científic propi de la física i la química en la inte… | → 3 | Manejar con soltura las reglas y normas básicas de la física y la química en lo referente… | 0.50 | CCL, CD, CP, STEM | STEM4, STEM5, CD3, CPSAA2, CC1, CCEC2, CCEC4 | REVIEW |
| 7 | Interpretar correctament la informació presentada en diferents formats de representació g… | → 3 | Manejar con soltura las reglas y normas básicas de la física y la química en lo referente… | 0.54 | CCL, CD, STEM | STEM4, STEM5, CD3, CPSAA2, CC1, CCEC2, CCEC4 | REVIEW |
| 8 | Distingir les diferents manifestacions de l’energia i identificar-ne les formes de transm… | — | — | 0.08 | CCEC, CD, CPSAA, STEM | — | VC-ONLY |
| 9 | Identificar i caracteritzar les substàncies a partir de les seues propietats físiques per… | — | — | 0.18 | CCEC, CPSAA, STEM | — | VC-ONLY |
| 10 | Caracteritzar els canvis químics com a transformació d’unes substàncies en altres de dife… | — | — | 0.21 | CCEC, CPSAA, STEM | — | VC-ONLY |

### GEOGRAFIA I HISTÒRIA (GH) — VC 9 CEs / RD 9 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Descriure i contextualitzar en el temps i l’espai els esdeveniments i els processos més r… | — | — | 0.24 | CC, CCEC, CCL, CPSAA | — | VC-ONLY |
| 2 | Buscar, identificar i seleccionar la informació referent a fets històrics, geogràfics i a… | → 1 | Buscar, seleccionar, tratar y organizar información sobre temas relevantes del presente y… | 0.32 | CCL, CD, CPSAA | CCL2, CCL3, STEM4, CD1, CD2, CC1 | REVIEW |
| 3 | Explicar les nocions bàsiques de canvi i continuïtat en la història emprant una perspecti… | — | — | 0.17 | CC, CCL | — | VC-ONLY |
| 4 | Contrastar les identitats individuals amb les col·lectives, identificar les aportacions d… | — | — | 0.23 | CC, CCEC, CCL | — | VC-ONLY |
| 5 | Explicar les interrelacions econòmiques fonamentals entre els elements de l’espai físic i… | — | — | 0.13 | CC, CCEC, CPSAA, STEM | — | VC-ONLY |
| 6 | Contrastar els principals models d’ocupació territorial i d’organització política i econò… | — | — | 0.18 | CC, CCEC, CCL, CPSAA | — | VC-ONLY |
| 7 | Donar arguments des d’una perspectiva crítica, fonamentada en coneixements històrics i la… | → 2 | Indagar, argumentar y elaborar productos propios sobre problemas geográficos, históricos… | 0.39 | CC, CE | CCL1, CCL2, CD2, CC1, CC3, CE3, CCEC3 | REVIEW |
| 8 | Promoure projectes cooperatius de convivència i participar-hi, prenent com a base la cons… | — | — | 0.25 | CC, CCEC | — | VC-ONLY |
| 9 | Identificar l’origen i reconéixer el valor del patrimoni cultural i natural, especialment… | — | — | 0.25 | CC, CCEC | — | VC-ONLY |

### INTEL·LIGÈNCIA ARTIFICIAL, PROGRAMACIÓ I ROBÒTICA (ILAPR) — VC 4 CEs / RD 0 CEs — _VC-specific matèria, no RD 2022 equivalent → all rows VC-ONLY_

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Identificar, investigar i emprar tècniques d'intel·ligència artificial i virtualització d… | — | — | — | CCL, CP, CMCT, CD | — | VC-ONLY |
| 2 | Aplicar el pensament computacional en l'anàlisi i resolució de problemes bàsics significa… | — | — | — | CCL, CMCT, CD | — | VC-ONLY |
| 3 | Muntar sistemes robòtics senzills, analitzant les respostes que proporcionen en la seua i… | — | — | — | CMCT, CD | — | VC-ONLY |
| 4 | Afrontar reptes tecnològics senzills i proposar solucions mitjançant la programació, la I… | — | — | — | CMCT, CD, CC, CE | — | VC-ONLY |

### LLATÍ (L) — VC 5 CEs / RD 5 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Reconéixer i valorar el paper de la cultura i la llengua llatines en els orígens d'Europa… | — | — | 0.24 | CC, CCEC, CCL, CD, CPSAA | — | VC-ONLY |
| 2 | Identificar els trets bàsics i valorar la importància de la llengua llatina en els idiome… | — | — | 0.24 | CC, CCL, CD, CP, CPSAA, STEM | — | VC-ONLY |
| 3 | Traduir, comprendre i interpretar textos llatins orals i escrits de dificultat moderada,… | → 4 | Comprender textos originales latinos, traduciendo del latín a la lengua de enseñanza y de… | 0.31 | CCL, CD, CP, CPSAA | CCL2, CP2, CP3, CD2, STEM1 | REVIEW |
| 4 | Produir enunciats senzills en llengua llatina, orals i escrits, desenvolupant estratègies… | — | — | 0.27 | CCL, CD, CP, CPSAA | — | VC-ONLY |
| 5 | Localitzar i valorar la presència del món clàssic en el patrimoni històric, arqueològic i… | → 5 | Descubrir, conocer y valorar el patrimonio cultural, arqueológico y artístico romano, apr… | 0.38 | CC, CCEC, CD, CE, CPSAA | CP3, CD1, CD3, CC1, CC4, CCEC1, CCEC2 | REVIEW |

### LABORATORI D’ARTS ESCÈNIQUES (LAE) — VC 4 CEs / RD 0 CEs — _VC-specific matèria, no RD 2022 equivalent → all rows VC-ONLY_

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Inventar propostes escèniques breus a partir d’estímuls creatius diversos, aplicant i com… | — | — | — | CCL, CP, CD, CPSAA, CCEC | — | VC-ONLY |
| 2 | Interpretar obres o peces escèniques diverses de creació pròpia o aliena mitjançant els i… | — | — | — | CCL, CP, CPSAA, CCEC | — | VC-ONLY |
| 3 | Posar en escena creacions artístiques col·lectives mitjançant l’ús dels diferents llengua… | — | — | — | CPSAA, CE, CCEC | — | VC-ONLY |
| 4 | Apreciar produccions escèniques en el seu context sociocultural a través de diferents can… | — | — | — | CCL, CPSAA, CC, CCEC | — | VC-ONLY |

### LABORATORI DE CREACIÓ AUDIOVISUAL (LCA) — VC 4 CEs / RD 0 CEs — _VC-specific matèria, no RD 2022 equivalent → all rows VC-ONLY_

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Explorar propostes audiovisuals des d'una perspectiva inclusiva i oberta, analitzant els… | — | — | — | — | — | VC-ONLY |
| 2 | Elaborar propostes audiovisuals experimentant amb diferents recursos, tècniques i eines,… | — | — | — | — | — | VC-ONLY |
| 3 | Participar de totes les fases del procés de producció audiovisual col·lectiu assumint dif… | — | — | — | — | — | VC-ONLY |
| 4 | Compartir les propostes audiovisuals individuals i col·lectives a través de diferents can… | — | — | — | — | — | VC-ONLY |

### LLENGUA CASTELLANA I LITERATURA (LCL) — VC 9 CEs / RD 10 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Descriure i apreciar la diversitat lingüística i cultural de la Comunitat Valenciana, d’E… | → 1 | Describir y apreciar la diversidad lingüística del mundo a partir del reconocimiento de l… | 0.37 | CC, CCEC, CCL, CD, CE, CP, CPSAA | CCL1, CCL5, CP2, CP3, CC1, CC2, CCEC1, CCEC3 | REVIEW |
| 2 | Comprendre, interpretar i valorar, de manera autònoma, textos orals i multimodals propis… | — | — | 0.30 | CC, CCL, CD, CP, CPSAA | — | VC-ONLY |
| 3 | Comprendre, interpretar i valorar, de manera autònoma, textos escrits i multimodals propi… | → 4 | Comprender, interpretar y valorar textos escritos, con sentido crítico y diferentes propó… | 0.38 | CC, CCL, CD, CP, CPSAA | CCL2, CCL3, CCL5, CP2, STEM4, CD1, CPSAA4, CC3 | REVIEW |
| 4 | Produir missatges orals amb coherència, cohesió i adequació, fluïdesa i correcció, per mi… | → 3 | Producir textos orales y multimodales con fluidez, coherencia, cohesión y registro adecua… | 0.33 | CC, CCL, CD, CP, CPSAA | CCL1, CCL3, CCL5, CP2, STEM1, CD2, CD3, CC2, CE1 | REVIEW |
| 5 | Produir textos escrits i multimodals coherents, cohesionats, adequats i correctes emprant… | → 5 | Producir textos escritos y multimodales coherentes, cohesionados, adecuados y correctos,… | 0.43 | CC, CCL, CD, CP, CPSAA | CCL1, CCL3, CCL5, STEM1, CD2, CD3, CPSAA5, CC2 | REVIEW |
| 6 | Interactuar de manera oral, escrita i multimodal, de forma progressivament autònoma, per… | — | — | 0.23 | CC, CCL, CD, CE, CP, CPSAA | — | VC-ONLY |
| 7 | Mediar entre interlocutors aplicant estratègies d’adaptació, simplificació i reformulació… | — | — | 0.16 | CC, CCL, CD, CE, CP, CPSAA | — | VC-ONLY |
| 8 | Llegir obres i textos de caràcter divers i de complexitat progressiva, seleccionats amb a… | → 7 | Seleccionar y leer de manera progresivamente autónoma obras diversas como fuente de place… | 0.50 | CC, CCEC, CCL, CD, CE, CP, CPSAA | CCL1, CCL4, CD3, CPSAA1, CCEC1, CCEC2, CCEC3 | REVIEW |
| 9 | Llegir i produir textos literaris, contextualitzats en la cultura i la societat, com a fo… | → 8 | Leer, interpretar y valorar obras o fragmentos literarios del patrimonio nacional y unive… | 0.30 | CC, CCEC, CCL, CD, CE, CP, CPSAA | CCL1, CCL4, CC1, CCEC1, CCEC2, CCEC3, CCEC4 | REVIEW |

### LLENGUA ESTRANGERA (LE) — VC 7 CEs / RD 6 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Analitzar i usar els repertoris lingüístics de diverses llengües, reflexionar sobre el fu… | → 5 | Ampliar y usar los repertorios lingüísticos personales entre distintas lenguas, reflexion… | 0.37 | CC, CCEC, CCL, CD, CP, CPSAA | CP2, STEM1, CPSAA1, CPSAA5, CD2 | REVIEW |
| 2 | Interpretar textos orals, breus i senzills, sobre temes predictibles i no predictibles de… | — | — | 0.17 | CC, CCEC, CCL, CD, CP, CPSAA | — | VC-ONLY |
| 3 | Interpretar informació explícita i implícita expressada en textos escrits i multimodals b… | — | — | 0.19 | CC, CCEC, CCL, CD, CP, CPSAA | — | VC-ONLY |
| 4 | Produir textos orals, de manera autònoma i fluida, aplicant estratègies de planificació,… | — | — | 0.28 | CC, CCEC, CCL, CD, CP, CPSAA | — | VC-ONLY |
| 5 | Produir textos escrits i multimodals comprensibles i estructurats, de manera autònoma, pe… | — | — | 0.23 | CC, CCEC, CCL, CD, CP, CPSAA | — | VC-ONLY |
| 6 | Interaccionar de manera oral, escrita i multimodal per mitjà d’intercanvis senzills d’inf… | — | — | 0.24 | CC, CCEC, CCL, CD, CE, CP, CPSAA, STEM | — | VC-ONLY |
| 7 | Mediar entre interlocutors aplicant estratègies d’adaptació, simplificació i reformulació… | → 4 | Mediar en situaciones cotidianas entre distintas lenguas, usando estrategias y conocimien… | 0.32 | CC, CCEC, CCL, CD, CE, CP, CPSAA, STEM | CCL5, CP1, CP2, CP3, STEM1, CPSAA1, CPSAA3, CCEC1 | REVIEW |

### MATEMÀTIQUES (M) — VC 8 CEs / RD 10 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Resoldre problemes relacionats amb situacions diverses de l'àmbit social i en la iniciaci… | — | — | 0.11 | CC, CD, CE, CPSAA, STEM | — | VC-ONLY |
| 2 | Explorar, formular i generalitzar conjectures i propietats matemàtiques, fent demostracio… | — | — | 0.24 | CCEC, CD, STEM | — | VC-ONLY |
| 3 | Construir models matemàtics generals utilitzant conceptes i procediments matemàtics funci… | — | — | 0.21 | CC, CE, STEM | — | VC-ONLY |
| 4 | Implementar algoritmes computacionals organitzant dades, descomponent un problema en part… | → 4 | Utilizar los principios del pensamiento computacional organizando datos, descomponiendo e… | 0.33 | CE, STEM | STEM1, STEM2, STEM3, CD2, CD3, CD5, CE3 | REVIEW |
| 5 | Manejar amb precisió el simbolisme matemàtic fent transformacions i conversions entre rep… | — | — | 0.09 | CCL, CD, CPSAA, STEM | — | VC-ONLY |
| 6 | Produir, comunicar i interpretar missatges orals i escrits complexos de manera formal, em… | → 8 | Comunicar de forma individual y colectiva conceptos, procedimientos y argumentos matemáti… | 0.36 | CCL, CE, CP, STEM | CCL1, CCL3, CP1, STEM2, STEM4, CD2, CD3, CE3, CCEC3 | REVIEW |
| 7 | Conéixer el valor cultural i històric de les matemàtiques i identificar les seues aportac… | — | — | 0.14 | CC, CCEC, CPSAA, STEM | — | VC-ONLY |
| 8 | Gestionar i regular les emocions, creences i actituds implicades en els processos matemàt… | — | — | 0.20 | CE, CPSAA, STEM | — | VC-ONLY |

### MÚSICA (M2) — VC 5 CEs / RD 4 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Analitzar propostes musicals, corporals i multidisciplinàries de diferents èpoques i esti… | — | — | 0.24 | CCEC, CCL, CP | — | VC-ONLY |
| 2 | Relacionar els elements, les característiques i les representacions gràfiques del so, els… | — | — | 0.07 | CC, CCEC, CE | — | VC-ONLY |
| 3 | Construir propostes musicals basades en la interpretació, la improvisació i l’experimenta… | — | — | 0.25 | CC, CCEC, CD, CPSAA, STEM | — | VC-ONLY |
| 4 | Crear projectes musicals i interdisciplinaris mitjançant el disseny, la planificació i l’… | — | — | 0.11 | CC, CCEC, CCL, CE, CPSAA, STEM | — | VC-ONLY |
| 5 | Aplicar recursos digitals a l’escolta, la interpretació, la investigació, la creació i la… | — | — | 0.12 | CCEC, CD, CE | — | VC-ONLY |

### SEGONA LLENGUA ESTRANGERA (SLE) — VC 7 CEs / RD 6 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Reconéixer i usar els seus repertoris lingüístics i comparar-ne el funcionament, tot iden… | — | — | 0.08 | CC, CCEC, CCL, CD, CP, CPSAA | — | VC-ONLY |
| 2 | Interpretar la informació de textos orals i multimodals, breus i senzills, de manera guia… | — | — | 0.12 | CC, CCEC, CCL, CD, CP, CPSAA | — | VC-ONLY |
| 3 | Interpretar la informació expressada per mitjà de textos escrits i multimodals breus i se… | — | — | 0.21 | CC, CCEC, CCL, CD, CP, CPSAA | — | VC-ONLY |
| 4 | Produir de manera guiada textos orals i multimodals comprensibles i estructurats, per a e… | — | — | 0.19 | CC, CCEC, CCL, CD, CP, CPSAA | — | VC-ONLY |
| 5 | Produir, de manera guiada, textos escrits i multimodals, comprensibles i estructurats, pe… | — | — | 0.18 | CC, CCEC, CCL, CD, CP, CPSAA | — | VC-ONLY |
| 6 | Interaccionar de manera oral, escrita i multimodal per mitjà de textos senzills, breus i… | — | — | 0.15 | CC, CCEC, CCL, CD, CE, CP, CPSAA, STEM | — | VC-ONLY |
| 7 | Mediar entre interlocutors utilitzant estratègies d’adaptació i simplificació del llengua… | — | — | 0.10 | CC, CCEC, CCL, CD, CE, CP, CPSAA, STEM | — | VC-ONLY |

### TECNOLOGIA (T) — VC 6 CEs / RD 7 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Identificar problemes tecnològics a partir de l’estudi de les necessitats presents en l’e… | — | — | 0.20 | CC, CD, CE, CPSAA, STEM | — | VC-ONLY |
| 2 | Fabricar solucions tecnològiques utilitzant els coneixements interdisciplinaris, les tècn… | — | — | 0.29 | CC, CCEC, CPSAA, STEM | — | VC-ONLY |
| 3 | Expressar, difondre i interpretar idees, propostes o solucions tecnològiques de manera ef… | → 4 | Describir, representar e intercambiar ideas o soluciones a problemas tecnológicos o digit… | 0.44 | CC, CCL, CD, CP, STEM | CCL1, STEM4, CD3, CCEC3, CCEC4 | REVIEW |
| 4 | Dissenyar i construir sistemes de control programables i robòtics, desenvolupant solucion… | → 5 | Desarrollar algoritmos y aplicaciones informáticas en distintos entornos, aplicando los p… | 0.43 | CD, CE, CP, CPSAA, STEM | CP2, STEM1, STEM3, CD5, CPSAA5, CE3 | REVIEW |
| 5 | Aprofitar les possibilitats que ofereixen les eines digitals per a realitzar eficientment… | — | — | 0.21 | CD, CP, CPSAA | — | VC-ONLY |
| 6 | Contribuir al desenvolupament sostenible analitzant críticament l’ús d’objectes, material… | — | — | 0.27 | CC, CD, STEM | — | VC-ONLY |

### TECNOLOGIA I DIGITALITZACIÓ (TD) — VC 7 CEs / RD 7 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Identificar i resoldre problemes tecnològics senzills aplicant el mètode de projectes, pr… | → 2 | Abordar problemas tecnológicos con autonomía y actitud creativa, aplicando conocimientos… | 0.54 | CD, CE, STEM | CCL1, STEM1, STEM3, CD3, CPSAA3, CPSAA5, CE1, CE3 | AUTO |
| 2 | Buscar, obtindre, analitzar i seleccionar informació de manera fiable i segura per a pode… | — | — | 0.30 | CCL, CP, STEM | — | VC-ONLY |
| 3 | Configurar, utilitzar i mantindre màquines, eines, aplicacions i sistemes digitals, fent-… | — | — | 0.29 | CC, CD, CPSAA, STEM | — | VC-ONLY |
| 4 | Fer un ús responsable i sostenible dels objectes, materials, productes i solucions tecnol… | — | — | 0.28 | CC, CCEC, CCL, CD, STEM | — | VC-ONLY |
| 5 | Crear, expressar, comprendre i comunicar idees, opinions i propostes amb un ús correcte d… | → 4 | Describir, representar e intercambiar ideas o soluciones a problemas tecnológicos o digit… | 0.43 | CCEC, CCL, CD, CP, STEM | CCL1, STEM4, CD3, CCEC3, CCEC4 | REVIEW |
| 6 | Analitzar problemes senzills i plantejar-ne la solució, de manera que s’automatitzen proc… | → 5 | Desarrollar algoritmos y aplicaciones informáticas en distintos entornos, aplicando los p… | 0.62 | CCL, CD, CE, CP, CPSAA, STEM | CP2, STEM1, STEM3, CD5, CPSAA5, CE3 | REVIEW |
| 7 | Utilitzar la tecnologia posant-la al servei del desenvolupament personal i professional,… | — | — | 0.28 | CD, CP, CPSAA, STEM | — | VC-ONLY |

### TALLER D’ECONOMIA (TE) — VC 7 CEs / RD 0 CEs — _VC-specific matèria, no RD 2022 equivalent → all rows VC-ONLY_

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Identificar els problemes econòmics bàsics vinculats amb l'escassetat i la necessitat de… | — | — | — | CCL, CD, CPSAA, CC, CE, CCEC | — | VC-ONLY |
| 2 | Analitzar les qualitats individuals i col·lectives que caracteritzen una actitud emprened… | — | — | — | CCL, CP, CD, CPSAA, CC, CE | — | VC-ONLY |
| 3 | Descriure la importància del paper de les famílies, les empreses i l'Estat en el funciona… | — | — | — | CCL, CD, CPSAA, CC, CE | — | VC-ONLY |
| 4 | Identificar els principals indicadors macroeconòmics relacionats amb el mercat de treball… | — | — | — | CCL, STEM, CD, CPSAA, CC, CE | — | VC-ONLY |
| 5 | Explicar la connexió entre l'activitat de l'Estat i la necessitat de finançament públic p… | — | — | — | CCL, STEM, CD, CPSAA, CC, CE | — | VC-ONLY |
| 6 | Recopilar informació de diferents fonts econòmiques, seleccionant dades fiables que donen… | — | — | — | CCL, CD, CPSAA, CC, CE | — | VC-ONLY |
| 7 | Dissenyar un projecte senzill de col·laboració amb un servei a la comunitat que possibili… | — | — | — | CCL, CP, STEM, CD, CPSAA, CC, CE | — | VC-ONLY |

### TALLER DE RELACIONS DIGITALS RESPONSABLES (TRDR) — VC 4 CEs / RD 0 CEs — _VC-specific matèria, no RD 2022 equivalent → all rows VC-ONLY_

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Utilitzar dispositius digitals d'ús personal en l'entorn domèstic i educatiu de manera sa… | — | — | — | CMCT, CD | — | VC-ONLY |
| 2 | Buscar i seleccionar críticament informació digital de diferents fonts, interpretar-la, o… | — | — | — | CCL, CP, CD, CPSAA, CCEC | — | VC-ONLY |
| 3 | Construir una identitat digital adequada i aplicar estratègies bàsiques per a cuidar-la i… | — | — | — | CD, CPSAA, CC | — | VC-ONLY |
| 4 | Mostrar hàbits bàsics que fomenten el benestar en les relacions a través d'entorns digita… | — | — | — | CD, CPSAA, CC | — | VC-ONLY |

### VALENCIÀ: LLENGUA I LITERATURA (VLL) — VC 9 CEs / RD 10 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Descriure i apreciar la diversitat lingüística i cultural de la Comunitat Valenciana, d’E… | → 1 | Describir y apreciar la diversidad lingüística del mundo a partir del reconocimiento de l… | 0.37 | CC, CCEC, CCL, CD, CE, CP, CPSAA | CCL1, CCL5, CP2, CP3, CC1, CC2, CCEC1, CCEC3 | REVIEW |
| 2 | Comprendre, interpretar i valorar, de manera autònoma, textos orals i multimodals propis… | — | — | 0.30 | CC, CCL, CD, CP, CPSAA | — | VC-ONLY |
| 3 | Comprendre, interpretar i valorar, de manera autònoma, textos escrits i multimodals propi… | → 4 | Comprender, interpretar y valorar textos escritos, con sentido crítico y diferentes propó… | 0.38 | CC, CCL, CD, CP, CPSAA | CCL2, CCL3, CCL5, CP2, STEM4, CD1, CPSAA4, CC3 | REVIEW |
| 4 | Produir missatges orals amb coherència, cohesió i adequació, fluïdesa i correcció, per mi… | → 3 | Producir textos orales y multimodales con fluidez, coherencia, cohesión y registro adecua… | 0.33 | CC, CCL, CD, CP, CPSAA | CCL1, CCL3, CCL5, CP2, STEM1, CD2, CD3, CC2, CE1 | REVIEW |
| 5 | Produir textos escrits i multimodals coherents, cohesionats, adequats i correctes emprant… | → 5 | Producir textos escritos y multimodales coherentes, cohesionados, adecuados y correctos,… | 0.43 | CC, CCL, CD, CP, CPSAA | CCL1, CCL3, CCL5, STEM1, CD2, CD3, CPSAA5, CC2 | REVIEW |
| 6 | Interactuar de manera oral, escrita i multimodal, de forma progressivament autònoma, per… | — | — | 0.23 | CC, CCL, CD, CE, CP, CPSAA | — | VC-ONLY |
| 7 | Mediar entre interlocutors aplicant estratègies d’adaptació, simplificació i reformulació… | — | — | 0.16 | CC, CCL, CD, CE, CP, CPSAA | — | VC-ONLY |
| 8 | Llegir obres i textos de caràcter divers i de complexitat progressiva, seleccionats amb a… | → 7 | Seleccionar y leer de manera progresivamente autónoma obras diversas como fuente de place… | 0.50 | CC, CCEC, CCL, CD, CE, CP, CPSAA | CCL1, CCL4, CD3, CPSAA1, CCEC1, CCEC2, CCEC3 | REVIEW |
| 9 | Llegir i produir textos literaris, contextualitzats en la cultura i la societat, com a fo… | → 8 | Leer, interpretar y valorar obras o fragmentos literarios del patrimonio nacional y unive… | 0.30 | CC, CCEC, CCL, CD, CE, CP, CPSAA | CCL1, CCL4, CC1, CCEC1, CCEC2, CCEC3, CCEC4 | REVIEW |


## Batxillerat — RD 243/2022 (BOE-A-2022-5521)

### ARTS ESCÈNIQUES I i II (AEI) — VC 5 CEs / RD 5 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Apreciar i argumentar l’aportació de les manifestacions escèniques al patrimoni cultural,… | — | — | 0.26 | — | — | VC-ONLY |
| 2 | Analitzar propostes escèniques en contextos històrics diversos des d’un punt de vista crí… | — | — | 0.18 | — | — | VC-ONLY |
| 3 | Planificar i crear produccions escèniques individuals i col·lectives mitjançant lú’s d’el… | — | — | 0.18 | — | — | VC-ONLY |
| 4 | Interpretar obres o peces escèniques de creació pròpia o aliena mitjançant els instrument… | — | — | 0.25 | — | — | VC-ONLY |
| 5 | Posar en escena produccions artístiques d’un repertori de diferents cultures i períodes h… | — | — | 0.24 | — | — | VC-ONLY |

### ANÀLISI MUSICAL I i II (AMI) — VC 5 CEs / RD 5 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Identificar els diversos elements tècnics que conformen una obra musical i analitzar, mit… | → 1 | Analizar los elementos musicales de diferentes obras, utilizando la escucha activa y el e… | 0.33 | — | CCL2, CPSAA5, CC1, CCEC1, CCEC2 | REVIEW |
| 2 | Analitzar l’organització estructural d’una obra musical, establint relacions amb l’estil,… | → 2 | Establecer relaciones entre los elementos musicales de una composición, a través del anál… | 0.33 | — | CCL2, CD1, CPSAA4, CC1, CCEC1, CCEC2 | REVIEW |
| 3 | Fer comentaris i crítiques musicals de manera argumentada i amb una terminologia adequada… | — | — | 0.27 | — | — | VC-ONLY |
| 4 | Construir propostes musicals basades en elements musicals i estructures formals conegudes… | → 4 | Utilizar los procedimientos compositivos fundamentales y las tecnologías digitales, emple… | 0.36 | — | CCL1, STEM1, CD3, CPSAA3.1, CPSAA3.2, CE3, CCEC3.1, CCEC3.2 | REVIEW |
| 5 | Elaborar projectes musicals d’investigació i divulgació basats en l’anàlisi musical, fent… | — | — | 0.21 | — | — | VC-ONLY |

### BIOLOGIA (B) — VC 6 CEs / RD 6 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Explicar fenòmens i resoldre problemes relacionats amb les ciències biològiques, utilitza… | → 4 | Plantear y resolver problemas, buscando y utilizando las estrategias adecuadas, analizand… | 0.50 | — | CCL2, STEM1, STEM2, CD1, CD5, CPSAA1.1, CPSAA5 | REVIEW |
| 2 | Localitzar i seleccionar informació procedent de diferents fonts, analitzant-la críticame… | → 2 | Localizar y utilizar fuentes fiables, identificando, seleccionando y organizando la infor… | 0.50 | — | CCL2, CCL3, CP2, STEM4, CD1, CD2, CPSAA4, CC3 | REVIEW |
| 3 | Comunicar informació i dades sobre qüestions de naturalesa biològica, argumentant amb pre… | → 1 | Interpretar y transmitir información y datos a partir de trabajos científicos y argumenta… | 0.67 | — | CCL1, CCL2, CP1, STEM2, STEM4, CD3, CPSAA4, CC3, CCEC3.2 | REVIEW |
| 4 | Identificar i explicar les característiques dels éssers vius a partir de l'anàlisi dels s… | — | — | 0.20 | — | — | VC-ONLY |
| 5 | Relacionar les característiques dels microorganismes amb la seua participació en diferent… | — | — | 0.15 | — | — | VC-ONLY |
| 6 | Analitzar críticament determinades accions relacionades amb els objectius de desenvolupam… | → 5 | Analizar críticamente determinadas acciones relacionadas con la sostenibilidad y la salud… | 0.47 | — | CCL3, STEM2, STEM5, CD4, CPSAA2, CC3, CC4, CE1 | REVIEW |

### BIOLOGIA, GEOLOGIA I CIÈNCIES AMBIENTALS (BGCA) — VC 7 CEs / RD 0 CEs — _VC-specific matèria, no RD 2022 equivalent → all rows VC-ONLY_

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Dissenyar, planificar i desenvolupar projectes d'investigació seguint els passos de les d… | — | — | — | — | — | VC-ONLY |
| 2 | Explicar fenòmens i resoldre problemes relacionats amb les ciències biològiques, geològiq… | — | — | — | — | — | VC-ONLY |
| 3 | Localitzar i utilitzar fonts fiables, seleccionant i organitzant la informació, contrasta… | — | — | — | — | — | VC-ONLY |
| 4 | Dissenyar, promoure i executar iniciatives compatibles amb els objectius per al desenvolu… | — | — | — | — | — | VC-ONLY |
| 5 | Utilitzar el coneixement geològic sobre el funcionament i composició del planeta Terra co… | — | — | — | — | — | VC-ONLY |
| 6 | Utilitzar els elements del registre geològic, relacionar-los amb els grans esdeveniments… | — | — | — | — | — | VC-ONLY |
| 7 | Comprendre i valorar la diversitat biològica a partir de l'anàlisi i interpretació del co… | — | — | — | — | — | VC-ONLY |

### BIOLOGIA HUMANA I SALUT (BHS) — VC 5 CEs / RD 0 CEs — _VC-specific matèria, no RD 2022 equivalent → all rows VC-ONLY_

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Realitzar investigacions entorn de la biologia humana utilitzant metodologies pròpies del… | — | — | — | — | — | VC-ONLY |
| 2 | Utilitzar amb autonomia els mètodes experimentals adequats i aplicar correctament les nor… | — | — | — | — | — | VC-ONLY |
| 3 | Comunicar amb rigor i claredat les conclusions d'investigacions o activitats experimental… | — | — | — | — | — | VC-ONLY |
| 4 | Prendre decisions fonamentades respecte al propi cos i la salut, justificant-les des del… | — | — | — | — | — | VC-ONLY |
| 5 | Relacionar la salut humana amb els estils de vida, el medi ambient i els sistemes sanitar… | — | — | — | — | — | VC-ONLY |

### CIÈNCIES GENERALS (CG) — VC 6 CEs / RD 0 CEs — _VC-specific matèria, no RD 2022 equivalent → all rows VC-ONLY_

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Aplicar els mètodes de treball de la ciència en l'anàlisi i la comprensió dels fenòmens n… | — | — | — | — | — | VC-ONLY |
| 2 | Analitzar la contribució de la ciència al desenvolupament tecnològic i a la millora de le… | — | — | — | — | — | VC-ONLY |
| 3 | Seleccionar informació de contingut científic a través de la interpretació de textos que… | — | — | — | — | — | VC-ONLY |
| 4 | Comunicar les conclusions obtingudes entorn de qüestions científiques amb precisió, rigor… | — | — | — | — | — | VC-ONLY |
| 5 | Argumentar sobre la importància dels hàbits sostenibles secundant-se en fonaments científ… | — | — | — | — | — | VC-ONLY |
| 6 | Valorar els límits ètics dels usos de la ciència i el progrés científic en la societat. | — | — | — | — | — | VC-ONLY |

### DISSENY (D) — VC 5 CEs / RD 6 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Investigar i analitzar propostes de disseny atenent la seua evolució històrica, estils i… | — | — | 0.24 | — | — | VC-ONLY |
| 2 | Analitzar diferents produccions de disseny bidimensional i tridimensional, relacionant el… | → 3 | Analizar de manera crítica y rigurosa distintas configuraciones formales, compositivas y… | 0.35 | — | STEM1, STEM5, CD2, CC1, CC4, CE1, CCEC1, CCEC2, CCEC4.1 | REVIEW |
| 3 | Planificar la creació de propostes gràfiques, productes i espais, mitjançant un procés me… | — | — | 0.16 | — | — | VC-ONLY |
| 4 | Crear propostes de disseny, utilitzant diferents sistemes de representació i presentació,… | — | — | 0.29 | — | — | VC-ONLY |
| 5 | Concretar el producte dissenyat mitjançant la realització d'arts finals, maqueta o protot… | — | — | 0.17 | — | — | VC-ONLY |

### DESCOBRINT LES NOSTRES ARRELS CLÀSSIQUES (DLNAC) — VC 4 CEs / RD 0 CEs — _VC-specific matèria, no RD 2022 equivalent → all rows VC-ONLY_

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 2 | Investigar, explicar i valorar els referents clàssics en el desenvolupament de la ciència… | — | — | — | — | — | VC-ONLY |
| 3 | Investigar, explicar i valorar els referents clàssics en les diverses manifestacions artí… | — | — | — | — | — | VC-ONLY |
| 4 | Reconéixer en la nostra vida com a ciutadans i ciutadanes els elements de la tradició clà… | — | — | — | — | — | VC-ONLY |
| 5 | Reconéixer i valorar les arrels clàssiques que fonamenten l'actual configuració d'Europa… | — | — | — | — | — | VC-ONLY |

### DIBUIX TÈCNIC APLICAT A LES ARTS PLÀSTIQUES I AL DISSENY I i II (DTALAPDI) — VC 6 CEs / RD 5 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Analitzar la presència de la geometria en la naturalesa, l'entorn construït, el disseny i… | — | — | 0.25 | — | — | VC-ONLY |
| 2 | Realitzar dibuixos a mà alçada, esbossos i croquis integrant elements i construccions geo… | — | — | 0.16 | — | — | VC-ONLY |
| 3 | Desenvolupar propostes artístiques i de disseny, individuals o col·lectives, aplicant els… | → 2 | Utilizar razonamientos inductivos, deductivos y lógicos en problemas de índole gráfico- m… | 0.31 | — | CCL2, STEM1, STEM2, STEM4, CPSAA1.1, CPSAA5, CE2 | REVIEW |
| 4 | Representar objectes, espais i projectes de disseny aplicant els sistemes de representaci… | — | — | 0.27 | — | — | VC-ONLY |
| 5 | Aplicar les normes fonamentals UNE i ISO en la representació, definició i documentació de… | → 4 | Formalizar y definir diseños técnicos aplicando las normas UNE e ISO de manera apropiada,… | 0.31 | — | CCL2, STEM1, STEM4, CD2, CPSAA1.1, CPSAA3.2, CPSAA5, CE3 | REVIEW |
| 6 | Incorporar eines de dibuix digital en 2D i en 3D en el desenvolupament de propostes gràfi… | — | — | 0.14 | — | — | VC-ONLY |

### DIBUIX TÈCNIC I i II (DTI) — VC 5 CEs / RD 5 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Analitzar la relació entre les matemàtiques i el dibuix geomètric en elements arquitectòn… | — | — | 0.24 | — | — | VC-ONLY |
| 2 | Resoldre gràficament operacions matemàtiques, relacions, construccions i transformacions,… | → 2 | Utilizar razonamientos inductivos, deductivos y lógicos en problemas de índole gráfico- m… | 0.56 | — | CCL2, STEM1, STEM2, STEM4, CPSAA1.1, CPSAA5, CE2 | REVIEW |
| 3 | Representar la realitat tridimensional sobre la superfície del pla mitjançant els diferen… | → 3 | Desarrollar la visión espacial, utilizando la geometría descriptiva en proyectos sencillo… | 0.41 | — | STEM1, STEM2, STEM4, CPSAA1.1, CPSAA5, CE2, CE3 | REVIEW |
| 4 | Documentar gràficament projectes arquitectònics i d’enginyeria, aplicant les normes UNO i… | → 4 | Formalizar y definir diseños técnicos aplicando las normas UNE e ISO de manera apropiada,… | 0.71 | — | CCL2, STEM1, STEM4, CD2, CPSAA1.1, CPSAA3.2, CPSAA5, CE3 | REVIEW |
| 5 | Participar en projectes col·lectius de creació digital d’objectes i espais en dues i tres… | → 5 | Investigar, experimentar y representar digitalmente elementos, planos y esquemas técnicos… | 0.33 | — | STEM2, STEM3, STEM4, CD1, CD2, CD3, CE3, CCEC3.2 | REVIEW |

### ECONOMIA (E) — VC 6 CEs / RD 6 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Argumentar la importància d’adoptar decisions responsables en l’àmbit econòmic, analitzar… | → 1 | Valorar el problema de la escasez y la importancia de adoptar decisiones en el ámbito eco… | 0.48 | — | CCL2, STEM2, CPSAA4, CPSAA5, CE1, CE2 | REVIEW |
| 2 | Identificar i analitzar el funcionament del mercat, analitzar-ne les fallades, interpreta… | → 2 | Reconocer y comprender el funcionamiento del mercado, analizando sus fallos, para estudia… | 0.31 | — | CCL2, CCL3, STEM2, CPSAA4, CC3, CE1, CE2 | REVIEW |
| 3 | Identificar i comparar el paper dels diferents agents econòmics en el flux circular de la… | → 3 | Distinguir y valorar el papel de los distintos agentes económicos que intervienen en el f… | 0.36 | — | CCL2, CCL3, CPSAA4, CPSAA5, CC3, CC4, CE1, CE2 | REVIEW |
| 4 | Analitzar el funcionament bàsic del sistema financer descrivint els efectes sobre l’econo… | → 4 | Conocer y comprender el funcionamiento del sistema financiero y de la política monetaria,… | 0.36 | — | CCL2, CCL3, CD4, CPSAA1.2, CPSAA4, CPSAA5, CE1, CE2 | REVIEW |
| 5 | Identificar les principals amenaces i oportunitats a què s’enfronta actualment l’economia… | → 5 | Identificar y valorar los retos y desafíos a los que se enfrenta la economía actual anali… | 0.50 | — | CCL2, CCL3, STEM4, CD5, CPSAA1.2, CPSAA4, CPSAA5, CE1 | REVIEW |
| 6 | Investigar i interpretar fets, successos o esdeveniments concrets de l’actualitat econòmi… | — | — | 0.21 | — | — | VC-ONLY |

### EMPRESA I DISSENY DE MODELS DE NEGOCI (EDMN) — VC 5 CEs / RD 0 CEs — _VC-specific matèria, no RD 2022 equivalent → all rows VC-ONLY_

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Argumentar el poder de transformació de l'activitat empresarial i emprenedora en la socie… | — | — | — | — | — | VC-ONLY |
| 2 | Investigar l'entorn econòmic i social, des d'un punt de vista general i específic, i la s… | — | — | — | — | — | VC-ONLY |
| 3 | Identificar alguns models de negoci actuals comparant-los amb altres models tradicionals… | — | — | — | — | — | VC-ONLY |
| 4 | Obtindre la informació que es genera tant en l'àmbit intern com extern de l'empresa i ges… | — | — | — | — | — | VC-ONLY |
| 5 | Explicar i avaluar diferents models de negoci aplicant eines fonamentals d'anàlisi empres… | — | — | — | — | — | VC-ONLY |

### ECONOMIA, EMPRENEDORIA I ACTIVITAT EMPRESARIAL (EEAE) — VC 7 CEs / RD 0 CEs — _VC-specific matèria, no RD 2022 equivalent → all rows VC-ONLY_

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Analitzar de manera crítica i reflexiva les aportacions fonamentals de la ciència econòmi… | — | — | — | — | — | VC-ONLY |
| 2 | Analitzar des d'una perspectiva interdisciplinària el comportament individual i col·lecti… | — | — | — | — | — | VC-ONLY |
| 3 | Establir correspondències entre els Objectius de Desenvolupament Sostenible i els problem… | — | — | — | — | — | VC-ONLY |
| 4 | Identificar les principals habilitats i competències que caracteritzen les persones empre… | — | — | — | — | — | VC-ONLY |
| 5 | Analitzar i valorar amb sentit crític les tendències de les estratègies empresarials i el… | — | — | — | — | — | VC-ONLY |
| 6 | Analitzar la transformació econòmica i social i les seues conseqüències, argumentant la i… | — | — | — | — | — | VC-ONLY |
| 7 | Aplicar, en els problemes econòmics més rellevants, les estratègies metodològiques pròpie… | — | — | — | — | — | VC-ONLY |

### FILOSOFIA (F) — VC 8 CEs / RD 9 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Identificar problemes i formular preguntes relacionades amb l'existència dels éssers huma… | → 1 | Identificar problemas y formular preguntas acerca del fundamento, valor y sentido de la r… | 0.41 | — | CCL2, CPSAA1.2, CC1, CC3, CCEC1 | REVIEW |
| 2 | Utilitzar criteris de cerca, selecció i anàlisi d'informació referida a qüestions filosòf… | → 2 | Buscar, gestionar, interpretar, producir y transmitir correctamente información relativa… | 0.50 | — | CCL1, CCL2, CCL3, STEM1, CD1, CD3, CPSAA4, CC3, CE3 | REVIEW |
| 3 | Practicar el diàleg i debat filosòfics de manera rigorosa, crítica i assertiva, utilitzan… | — | — | 0.27 | — | — | VC-ONLY |
| 4 | Visibilitzar, denunciar i combatre les desigualtats, estereotips i exclusions propis del… | — | — | 0.12 | — | — | VC-ONLY |
| 5 | Identificar i analitzar problemes ètics i polítics des d'una perspectiva interseccional i… | — | — | 0.19 | — | — | VC-ONLY |
| 6 | Analitzar amb actitud crítica, constructiva, oberta i respectuosa els conflictes humans,… | → 5 | Reconocer el carácter plural de las concepciones, ideas y argumentos en torno a cada uno… | 0.40 | — | CCL5, CC1, CC2, CC3 | REVIEW |
| 7 | Analitzar críticament i qüestionar la legitimitat de les idees, valors i concepcions del… | — | — | 0.25 | — | — | VC-ONLY |
| 8 | Identificar la diversitat de manifestacions artístiques, valorar-les com a motor del pens… | → 9 | Desarrollar la sensibilidad y la comprensión crítica del arte y otras manifestaciones y a… | 0.31 | — | CPSAA3.1, CC2, CC3, CCEC2, CCEC3.1, CCEC3.2 | REVIEW |

### FONAMENTS ARTÍSTICS (FA) — VC 5 CEs / RD 7 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Identificar i analitzar els diferents conceptes d'art des dels orígens fins a l'actualita… | → 2 | Reflexionar sobre las funciones del arte a lo largo de la historia, analizando la evoluci… | 0.40 | — | CCL1, CPSAA4, CC1, CC3, CCEC1, CCEC2 | REVIEW |
| 2 | Investigar la funció ideològica de l'art com a representació d'una època i d'una cultura,… | → 4 | Explicar obras artísticas realizadas en distintos medios y soportes, identificando el con… | 0.47 | — | CCL1, CCL2, CD1, CPSAA4, CC1, CCEC1, CCEC2 | REVIEW |
| 3 | Analitzar i explicar els llenguatges, mitjans i suports propis de diferents estils i perí… | — | — | 0.27 | — | — | VC-ONLY |
| 4 | Valorar les possibilitats expressives i comunicatives de l'art, mitjançant l'observació,… | → 5 | Comprender el poder comunicativo del arte, identificando y reconociendo el reflejo de las… | 0.33 | — | CCL1, CPSAA1.1, CPSAA1.2, CPSAA3.1, CC1, CCEC2, CCEC3.1 | REVIEW |
| 5 | Interpretar i crear produccions artístiques, individuals o col·lectives, a partir de el s… | — | — | 0.29 | — | — | VC-ONLY |

### FÍSICA I QUÍMICA (FQ) — VC 5 CEs / RD 6 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Justificar la validesa del model científic per mitjà de l’anàlisi de casos representatius… | — | — | 0.25 | — | — | VC-ONLY |
| 2 | Posar en pràctica els processos i les actituds propis de l’anàlisi sistemàtica i d’indaga… | — | — | 0.23 | — | — | VC-ONLY |
| 3 | Manejar amb propietat i soltesa els diferents registres de comunicació de la ciència pel… | → 3 | Manejar con propiedad y solvencia el flujo de información en los diferentes registros de… | 0.70 | — | CCL1, CCL5, STEM4, CD2 | REVIEW |
| 4 | Formular argumentacions científiques expressant i organitzant les idees amb rigor, precis… | — | — | 0.20 | — | — | VC-ONLY |
| 5 | Utilitzar de manera autònoma i eficient els recursos tecnològics i els coneixements de Fí… | — | — | 0.21 | — | — | VC-ONLY |

### GEOGRAFIA (G) — VC 7 CEs / RD 7 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Analitzar mitjançant mètodes i tècniques geogràfiques les principals repercussions territ… | — | — | 0.20 | — | — | VC-ONLY |
| 2 | Explicar l'espai geogràfic com a sistema a partir de l'anàlisi de fonts d'informació visu… | → 2 | Comprender la complejidad del espacio geográfico, mediante la interpretación de fuentes d… | 0.35 | — | STEM4, STEM5, CD1, CC1, CC4, CE1, CCEC1, CCEC2 | REVIEW |
| 3 | Descriure la diversitat natural d'Espanya i confrontar-la amb el context europeu, a travé… | → 3 | Analizar la diversidad natural de España y su singularidad geográfica dentro de Europa, a… | 0.50 | — | STEM1, STEM4, CPSAA3.1, CC1, CC3, CCEC1 | REVIEW |
| 4 | Localitzar i delimitar l'escala de fenòmens físics i humans de diferent tipus, utilitzant… | → 4 | Aplicar las Tecnologías de la Información Geográfica (TIG), métodos y técnicas propios o… | 0.52 | — | CCL1, STEM1, STEM2, CD1, CD2, CD5, CC3, CE1, CE3 | REVIEW |
| 5 | Elaborar i exposar treballs que analitzen les dinàmiques globalitzadores que determinen l… | — | — | 0.17 | — | — | VC-ONLY |
| 6 | Explicar els desequilibris territorials d'Espanya i de la seua estructura demogràfica i s… | → 6 | Explicar de forma crítica los desequilibrios territoriales de España y de su estructura s… | 0.42 | — | STEM4, CPSAA1.2, CPSAA3.1, CC1, CC2, CC3, CE1, CE2, CCEC3.2 | REVIEW |
| 7 | Participar en l'elaboració de projectes en equip que analitzen i proposen solucions viabl… | — | — | 0.09 | — | — | VC-ONLY |

### GEOLOGIA I CIÈNCIES AMBIENTALS (GCA) — VC 6 CEs / RD 6 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Dissenyar, planificar i desenvolupar de manera autònoma projectes d'investigació seguint… | — | — | 0.17 | — | — | VC-ONLY |
| 2 | Explicar fenòmens i resoldre de manera autònoma problemes relacionats amb les ciències ge… | → 4 | Plantear y resolver problemas, buscando y utilizando las estrategias adecuadas, analizand… | 0.44 | — | CCL3, STEM1, STEM2, CD1, CD5, CPSAA1.1, CE3 | REVIEW |
| 3 | Localitzar i utilitzar de manera autònoma fonts fiables, seleccionant i organitzant la in… | → 2 | Localizar y utilizar fuentes fiables, identificando, seleccionando y organizando informac… | 0.53 | — | CCL2, CCL3, CP2, STEM4, CD1, CPSAA4, CC3 | REVIEW |
| 4 | Dissenyar, promoure i executar iniciatives compatibles amb els objectius de desenvolupame… | — | — | 0.25 | — | — | VC-ONLY |
| 5 | Explicar fenòmens geològics a partir de la història geològica i identificar possibles ris… | → 6 | Identificar y analizar los elementos geológicos del relieve a partir de observaciones de… | 0.40 | — | CCL3, CP2, STEM2, STEM5, CD4, CPSAA4, CE3, CCEC1 | REVIEW |
| 6 | Proposar i justificar mesures de prevenció i adaptació als riscos derivats dels fenòmens… | — | — | 0.12 | — | — | VC-ONLY |

### GEOGRAFIA I HISTÒRIA VALENCIANES (GHV) — VC 8 CEs / RD 0 CEs — _VC-specific matèria, no RD 2022 equivalent → all rows VC-ONLY_

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Cercar, identificar i seleccionar la informació referent a fets històrics, geogràfics i a… | — | — | — | — | — | VC-ONLY |
| 2 | Descriure la diversitat natural de la Comunitat València i confrontar-la amb el context p… | — | — | — | — | — | VC-ONLY |
| 3 | Descriure, explicar i comparar les interaccions entre els grups socials que al llarg de l… | — | — | — | — | — | VC-ONLY |
| 4 | Identificar i analitzar els trets i factors que fan de la Comunitat Valenciana una realit… | — | — | — | — | — | VC-ONLY |
| 5 | Descriure i contextualitzar en el temps i l'espai els processos, fets i esdeveniments his… | — | — | — | — | — | VC-ONLY |
| 6 | Identificar el patrimoni cultural i natural de la Comunitat Valenciana, participant en l'… | — | — | — | — | — | VC-ONLY |
| 7 | Analitzar i explicar els canvis i permanències dels diferents grups socials en la societa… | — | — | — | — | — | VC-ONLY |
| 8 | Participar en la realització i exposició de treballs que analitzen, contrasten i integren… | — | — | — | — | — | VC-ONLY |

### GREC I i II (GI) — VC 5 CEs / RD 5 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Analitzar els elements bàsics de la llengua grega, tot identificant i reflexionant sobre… | → 1 | Traducir y comprender textos griegos de dificultad creciente y justificar la traducción,… | 0.47 | — | CCL1, CCL2, CP2, STEM1, STEM2 | REVIEW |
| 2 | Identificar i valorar els principals elements lèxics grecs, els canvis i el llegat d’aque… | — | — | 0.17 | — | — | VC-ONLY |
| 3 | Argumentar, interpretar, traduir i produir textos grecs, escrits i orals, de dificultat g… | → 3 | Leer, interpretar y comentar textos griegos de diferentes géneros y épocas, asumiendo el… | 0.30 | — | CCL4, CCEC1, CCEC2 | REVIEW |
| 4 | Identificar i valorar les contribucions del món grec en l'origen de la democràcia i de la… | → 4 | Analizar las características de la civilización griega en el ámbito personal, religioso y… | 0.42 | — | CCL3, CP3, CD1, CPSAA3.1, CC1 | REVIEW |
| 5 | Identificar i valorar el patrimoni, material i immaterial, de la civilització grega com a… | → 5 | Valorar críticamente el patrimonio histórico, arqueológico, artístico y cultural heredado… | 0.46 | — | CCL3, CD2, CC1, CC4, CE1, CCEC1, CCEC2 | REVIEW |

### GESTIÓ DE PROJECTES D'EMPRENEDORIA (GPE) — VC 6 CEs / RD 0 CEs — _VC-specific matèria, no RD 2022 equivalent → all rows VC-ONLY_

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Identificar i analitzar la importància de l'emprenedoria i la innovació com a elements ne… | — | — | — | — | — | VC-ONLY |
| 2 | Generar una idea de projecte emprenedor sostenible, analitzant les principals decisions q… | — | — | — | — | — | VC-ONLY |
| 3 | Analitzar les principals àrees de l'empresa, valorant les decisions d'administració i ges… | — | — | — | — | — | VC-ONLY |
| 4 | Aplicar les principals normes bàsiques de comptabilitat i fiscalitat empresarial en el pr… | — | — | — | — | — | VC-ONLY |
| 5 | Analitzar l'impacte social i mediambiental de l'empresa, a través de l'anàlisi de casos,… | — | — | — | — | — | VC-ONLY |
| 6 | Realitzar presentacions orals i escrites eficaces i creatives del seu propi projecte d'em… | — | — | — | — | — | VC-ONLY |

### HISTÒRIA D’ESPANYA (HE) — VC 8 CEs / RD 8 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Comparar els distints règims polítics de la història espanyola usant conceptes històrics,… | — | — | 0.28 | — | — | VC-ONLY |
| 2 | Buscar, identificar i seleccionar la informació referent a esdeveniments i processos hist… | — | — | 0.24 | — | — | VC-ONLY |
| 3 | Contrastar les identitats individuals amb les col·lectives, tot reconeixent l’existència… | → 2 | Reconocer y valorar la diversidad identitaria de nuestro país, por medio del contraste de… | 0.50 | — | CCL3, CPSAA3.1, CC1, CC2, CC3, CCEC1, CCEC2 | REVIEW |
| 4 | Explicar l’evolució de l’economia espanyola, tot reconeixent els progressos assolits i le… | — | — | 0.27 | — | — | VC-ONLY |
| 5 | Reconèixer l’origen de la diversitat ideològica de les distintes cultures polítiques en l… | → 5 | Analizar críticamente el papel de las creencias y de las ideologías en la articulación so… | 0.50 | — | CCL3, STEM4, CPSAA3.1, CPSAA4, CC1, CC2, CC3, CCEC1 | REVIEW |
| 6 | Contextualitzar la posició espanyola en la història del món, tot assenyalant particularit… | → 6 | Interpretar el valor geoestratégico de España y su conexión con la historia mundial, seña… | 0.35 | — | STEM4, CPSAA1.1, CPSAA4, CC1, CC2, CC3, CCEC1, CCEC2 | REVIEW |
| 7 | Incorporar la perspectiva de gènere en l’anàlisi històrica, en adoptar actituds i promour… | → 7 | Incorporar la perspectiva de género en el análisis de la España actual y de su historia,… | 0.40 | — | CCL4, CPSAA1.1, CPSAA1.2, CPSAA3.1, CC2, CC3, CCEC1, CCEC2 | REVIEW |
| 8 | Reconèixer el valor del patrimoni cultural i històric com a conformador de la memòria col… | → 8 | Valorar el patrimonio histórico y cultural como legado y expresión de la memoria colectiv… | 0.31 | — | STEM3, CPSAA1.1, CPSAA3.1, CPSAA3.2, CC1, CC3, CE3, CCEC3.2 | REVIEW |

### HISTÒRIA DE LA FILOSOFIA (HF) — VC 6 CEs / RD 7 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Identificar les diferents concepcions filosòfiques que s'han formulat al llarg de la hist… | → 3 | Comprender y expresar diferentes concepciones filosóficas históricamente dadas, mediante… | 0.31 | — | CC1, CC2, CC3, CCEC1 | REVIEW |
| 2 | Buscar, analitzar i interpretar informació relativa a problemes històrico-filosòfics des… | → 1 | Buscar, analizar, interpretar, producir y transmitir información relativa a hechos histór… | 0.54 | — | CCL1, CCL2, CCL3, CD1, CD3, CPSAA4, CC3, CE3 | REVIEW |
| 3 | Argumentar de manera rigorosa i constructiva a l'hora d'expressar teories i idees relacio… | → 6 | Reconocer las formas diversas en que los interrogantes filosóficos y sus intentos de resp… | 0.33 | — | CCL2, CC1, CC2, CC3, CCEC1 | REVIEW |
| 4 | Identificar en els problemes actuals la presència dels interrogants i reflexions planteja… | → 5 | Reconocer el modo en que se han planteado sucesivamente, a través de distintas épocas y c… | 0.55 | — | CCL2, CC1, CC2, CC3, CCEC1 | REVIEW |
| 5 | Analitzar críticament i qüestionar la legitimitat de les idees, valors i concepcions del… | — | — | 0.29 | — | — | VC-ONLY |
| 6 | Identificar i analitzar els principals problemes ètics i polítics plantejats al llarg de… | — | — | 0.16 | — | — | VC-ONLY |

### HISTÒRIA DEL MÓN CONTEMPORANI (HMC) — VC 9 CEs / RD 8 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Cercar, seleccionar i emprar informació sobre el passat i el present en distints tipus de… | — | — | 0.18 | — | — | VC-ONLY |
| 2 | Descriure i contextualitzar els fets i processos més importants de la història contemporà… | → 7 | Interpretar la función que han desempeñado el pensamiento y las ideologías en la transfor… | 0.32 | — | CCL3, CCL5, CD3, CPSAA1.2, CPSAA3.1, CPSAA4, CC2, CC3 | REVIEW |
| 3 | Analitzar les principals ideologies, revolucions i canvis polítics de l’època contemporàn… | — | — | 0.21 | — | — | VC-ONLY |
| 4 | Analitzar l’evolució de les relacions internacionals i els conflictes bèl·lics de l’època… | — | — | 0.11 | — | — | VC-ONLY |
| 5 | Identificar i analitzar els canvis demogràfics, econòmics, socials i culturals provocats… | — | — | 0.20 | — | — | VC-ONLY |
| 6 | Identificar i analitzar els canvis i permanències en l’organització social de la població… | — | — | 0.19 | — | — | VC-ONLY |
| 7 | Identificar, definir i analitzar en el seu context els principals corrents i manifestacio… | — | — | 0.25 | — | — | VC-ONLY |
| 8 | Reconéixer i analitzar els reptes més rellevants del món actual, analitzant-ne l'origen,… | — | — | 0.22 | — | — | VC-ONLY |
| 9 | Incorporar la perspectiva de gènere en l’estudi de la història del món contemporani, inve… | — | — | 0.15 | — | — | VC-ONLY |

### HISTÒRIA DE LA MÚSICA I LA DANSA (HMD) — VC 5 CEs / RD 5 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Relacionar les manifestacions musicals i coreogràfiques de la història amb les caracterís… | → 2 | Relacionar la música y la danza con otras formas de expresión artística, vinculándolas co… | 0.43 | — | CCL2, STEM2, CD1, CPSAA4, CC1, CCEC1, CCEC2 | REVIEW |
| 2 | Analitzar les característiques més rellevants del llenguatge musical i coreogràfic, ident… | — | — | 0.17 | — | — | VC-ONLY |
| 3 | Construir arguments i opinions fonamentades sobre obres musicals i coreogràfiques de dife… | — | — | 0.25 | — | — | VC-ONLY |
| 4 | Interpretar música i coreografies de diverses èpoques, estils i gèneres, a partir de les… | — | — | 0.22 | — | — | VC-ONLY |
| 5 | Elaborar projectes, participant en el disseny, la planificació i la realització de manera… | — | — | 0.11 | — | — | VC-ONLY |

### IMATGE I SO (IS) — VC 4 CEs / RD 0 CEs — _VC-specific matèria, no RD 2022 equivalent → all rows VC-ONLY_

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Analitzar produccions audiovisuals i els recursos d'imatge, àudio i vídeo que incorporen,… | — | — | — | — | — | VC-ONLY |
| 2 | Dissenyar i crear produccions audiovisuals multidisciplinàries i col·laboratives utilitza… | — | — | — | — | — | VC-ONLY |
| 3 | Captar, editar i modificar digitalment imatges, àudio i vídeo, i incorporar els elements… | — | — | — | — | — | VC-ONLY |
| 4 | Seleccionar i configurar els dispositius, eines i aplicacions digitals adequades per a re… | — | — | — | — | — | VC-ONLY |

### LLATÍ I i II (LI) — VC 5 CEs / RD 5 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Analitzar els elements bàsics de la llengua llatina, tot identificant i reflexionant sobr… | → 1 | Traducir y comprender textos latinos de dificultad creciente y justificar la traducción,… | 0.50 | — | CCL1, CCL2, CP2, STEM1, STEM2 | REVIEW |
| 2 | Identificar i valorar els principals elements lèxics llatins, les seues variacions i el s… | — | — | 0.12 | — | — | VC-ONLY |
| 3 | Argumentar, interpretar, traduir i produir textos llatins, escrits i orals, de dificultat… | → 3 | Leer, interpretar y comentar textos latinos de diferentes géneros y épocas, asumiendo el… | 0.30 | — | CCL4, CCEC1, CCEC2 | REVIEW |
| 4 | Identificar i valorar les contribucions de la cultura llatina en l'origen de la ciutadani… | → 4 | Analizar las características de la civilización latina en el ámbito personal, religioso y… | 0.33 | — | CCL3, CP3, CD1, CPSAA3.1, CC1 | REVIEW |
| 5 | Identificar i valorar el patrimoni històric, arqueològic, artístic i cultural, material i… | → 5 | Valorar críticamente el patrimonio histórico, arqueológico, artístico y cultural heredado… | 0.56 | — | CCL3, CD2, CC1, CC4, CE1, CCEC1, CCEC2 | REVIEW |

### LLENGUATGE I PRÀCTICA MUSICAL (LPM) — VC 5 CEs / RD 5 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Analitzar de manera autònoma els elements estructurals i tècnics de la música per mitjà d… | — | — | 0.20 | — | — | VC-ONLY |
| 2 | Distingir les diferents representacions gràfiques del so per mitjà de la sensibilitat aud… | — | — | 0.29 | — | — | VC-ONLY |
| 3 | Identificar i crear diferents patrons, fórmules i seqüències musicals dins de la diversit… | — | — | 0.28 | — | — | VC-ONLY |
| 4 | Interpretar de manera autònoma propostes musicals per mitjà de la veu, els instruments, e… | — | — | 0.29 | — | — | VC-ONLY |
| 5 | Dissenyar i portar a la pràctica projectes artístics i interdisciplinaris utilitzant els… | — | — | 0.12 | — | — | VC-ONLY |

### LITERATURA UNIVERSAL (LU) — VC 1 CEs / RD 5 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Llegir, analitzar i interpretar clàssics de la literatura universal utilitzant un metalle… | → 1 | Leer, interpretar y valorar clásicos de la literatura universal atendiendo tanto a las re… | 0.33 | — | CCL4, CC1, CCEC1, CCEC2, CCEC3.1, CCEC3.2, CCEC4.2 | REVIEW |

### MATEMÀTIQUES APLICADES A LES CIÈNCIES SOCIALS (MALCS) — VC 8 CEs / RD 9 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Resoldre problemes directament vinculats amb la vida quotidiana en situacions diverses de… | — | — | 0.24 | — | — | VC-ONLY |
| 2 | Investigar, formular, generalitzar i desenvolupar conjectures i propietats matemàtiques,… | — | — | 0.27 | — | — | VC-ONLY |
| 3 | Modelitzar situacions reals i fenòmens rellevants de l’àmbit social, investigant, compara… | → 6 | Descubrir los vínculos de las matemáticas con otras áreas de conocimiento y profundizar e… | 0.33 | — | STEM1, STEM2, CD2, CPSAA5, CC4, CE2, CE3, CCEC1 | REVIEW |
| 4 | Dissenyar, modificar, generalitzar i implementar algorismes computacionals que faciliten… | → 4 | Utilizar el pensamiento computacional de forma eficaz, modificando, creando y generalizan… | 0.35 | — | STEM1, STEM2, STEM3, CD2, CD3, CD5, CE3 | REVIEW |
| 5 | Manejar amb precisió el simbolisme matemàtic, fent transformacions i conversions que perm… | — | — | 0.14 | — | — | VC-ONLY |
| 6 | Produir, comunicar i interpretar missatges matemàtics, tant orals com escrits, emprant el… | — | — | 0.23 | — | — | VC-ONLY |
| 7 | Conéixer i apreciar el valor cultural, històric i social de les matemàtiques, identificar… | — | — | 0.18 | — | — | VC-ONLY |
| 8 | Gestionar i regular les emocions, creences i actituds implicades en els processos matemàt… | — | — | 0.25 | — | — | VC-ONLY |

### MATEMÀTIQUES GENERALS (MG) — VC 8 CEs / RD 9 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Resoldre problemes relacionats amb situacions reals d'importància social, cultural o cien… | — | — | 0.20 | — | — | VC-ONLY |
| 2 | Explorar, formular i generalitzar conjectures i propietats matemàtiques, fent demostracio… | — | — | 0.25 | — | — | VC-ONLY |
| 3 | Modelitzar situacions reals i fenòmens rellevants per a la societat, investigant i constr… | — | — | 0.26 | — | — | VC-ONLY |
| 4 | Dissenyar, modificar i implementar algorismes computacionals emprant eines tecnològiques,… | — | — | 0.27 | — | — | VC-ONLY |
| 5 | Manejar amb precisió el simbolisme matemàtic, fent transformacions i conversions entre to… | — | — | 0.17 | — | — | VC-ONLY |
| 6 | Comunicar i intercanviar idees matemàtiques usant el suport, la terminologia i el rigor a… | — | — | 0.27 | — | — | VC-ONLY |
| 7 | Conéixer i valorar la contribució de les matemàtiques a la cultura, identificant i contex… | — | — | 0.14 | — | — | VC-ONLY |
| 8 | Gestionar i regular les emocions, creences i actituds implicades en els processos matemàt… | — | — | 0.23 | — | — | VC-ONLY |

### MATEMÀTIQUES I i II (MI) — VC 8 CEs / RD 9 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Resoldre problemes relacionats amb situacions dels àmbits científic i tecnològic utilitza… | — | — | 0.18 | — | — | VC-ONLY |
| 2 | Investigar, formular i elaborar conjectures i propietats matemàtiques, fent demostracions… | — | — | 0.25 | — | — | VC-ONLY |
| 3 | Modelitzar situacions reals i fenòmens rellevants dels àmbits científic i tecnològic, inv… | — | — | 0.23 | — | — | VC-ONLY |
| 4 | Dissenyar, modificar, generalitzar i implementar algorismes computacionals emprant llengu… | → 4 | Utilizar el pensamiento computacional de forma eficaz, modificando, creando y generalizan… | 0.32 | — | STEM1, STEM2, STEM3, CD2, CD3, CD5, CE3 | REVIEW |
| 5 | Utilitzar amb rigor el simbolisme matemàtic, fent transformacions i conversions entre tot… | — | — | 0.18 | — | — | VC-ONLY |
| 6 | Comunicar i intercanviar idees matemàtiques fent servir el suport, la terminologia i el r… | — | — | 0.26 | — | — | VC-ONLY |
| 7 | Valorar la contribució de les matemàtiques a la cultura, identificant i contextualitzant… | — | — | 0.18 | — | — | VC-ONLY |
| 8 | Gestionar i regular les emocions, creences i actituds implicades en els processos matemàt… | — | — | 0.23 | — | — | VC-ONLY |

### PSICOLOGIA (P) — VC 5 CEs / RD 0 CEs — _VC-specific matèria, no RD 2022 equivalent → all rows VC-ONLY_

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Buscar, seleccionar, analitzar i interpretar la informació relativa a temes tractats per… | — | — | — | — | — | VC-ONLY |
| 2 | Practicar el diàleg i el debat de manera rigorosa, crítica i assertiva, sempre emprant de… | — | — | — | — | — | VC-ONLY |
| 3 | Identificar i explicar el paper de les emocions front als reptes, les incerteses i els co… | — | — | — | — | — | VC-ONLY |
| 4 | Utilitzar estratègies per millorar l’aprenentatge personal a partir dels coneixements i t… | — | — | — | — | — | VC-ONLY |
| 6 | Establir connexions amb els continguts d’altres matèries trencant amb visions parcials de… | — | — | — | — | — | VC-ONLY |

### PROJECTES ARTÍSTICS (PA) — VC 6 CEs / RD 5 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Reconéixer els elements del patrimoni local i global històric i contemporani a través de… | — | — | 0.06 | — | — | VC-ONLY |
| 2 | Elaborar idees de projectes mitjançant estratègies creatives, realitzant esbossos i maque… | → 1 | Generar y perfeccionar ideas de proyecto, consultando distintas fuentes, experimentando c… | 0.45 | — | CCL1, STEM3, CD1, CD2, CPSAA1.1, CPSAA3.1, CE3, CCEC3.2, CCEC4.1 | REVIEW |
| 3 | Comunicar idees, sentiments i emocions, durant la construcció de projectes artístics, i m… | — | — | 0.11 | — | — | VC-ONLY |
| 4 | Seleccionar els espais, mitjans, suports i tècniques adequats per al desenvolupament d'un… | — | — | 0.24 | — | — | VC-ONLY |
| 5 | Planificar i dur a terme les diferents fases del desenvolupament d'un projecte artístic d… | — | — | 0.27 | — | — | VC-ONLY |
| 6 | Exposar i compartir projectes artístics i registrar el procés seguit en la seua elaboraci… | → 5 | Tratar correctamente la documentación de un proyecto artístico, seleccionando las fuentes… | 0.35 | — | CCL2, CCL3, CD1, CD2, CPSAA4, CPSAA5, CCEC2, CCEC4.2 | REVIEW |

### PROGRAMACIÓ, XARXES I SISTEMES INFORMÀTICS (PXSI) — VC 5 CEs / RD 0 CEs — _VC-specific matèria, no RD 2022 equivalent → all rows VC-ONLY_

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Analitzar problemes de diferents contextos i tipus i afrontar la seua resolució mitjançan… | — | — | — | — | — | VC-ONLY |
| 2 | Dissenyar, instal·lar, configurar i administrar sistemes informàtics en l'entorn personal… | — | — | — | — | — | VC-ONLY |
| 3 | Dissenyar, configurar i administrar xarxes informàtiques segures per a grups de treball r… | — | — | — | — | — | VC-ONLY |
| 4 | Aprofitar i utilitzar de manera eficient sistemes d'informació connectats en xarxa per a… | — | — | — | — | — | VC-ONLY |
| 5 | Exercir una ciutadania digital crítica, responsable i solidària enfront dels principals r… | — | — | — | — | — | VC-ONLY |

### TECNOLOGIA I ENGINYERIA (TE) — VC 6 CEs / RD 4 CEs

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Dissenyar, crear i millorar productes i sistemes tecnològics gestionant projectes d’inves… | — | — | 0.08 | — | — | VC-ONLY |
| 2 | Seleccionar materials aplicant criteris tècnics, considerant estudis d’impacte ecosocial… | — | — | 0.19 | — | — | VC-ONLY |
| 3 | Aprofitar i configurar les eines digitals adequades per a resoldre de manera eficient tas… | — | — | 0.07 | — | — | VC-ONLY |
| 4 | Resoldre problemes de l’àmbit de l’enginyeria transferint i aplicant sabers interdiscipli… | — | — | 0.12 | — | — | VC-ONLY |
| 5 | Dissenyar i crear solucions tecnològiques automatitzades o robòtiques mitjançant el contr… | — | — | 0.10 | — | — | VC-ONLY |
| 6 | Analitzar sistemes tecnològics dels àmbits de l’enginyeria des del punt de vista de la ge… | — | — | 0.00 | — | — | VC-ONLY |

### EL TREBALL EXPERIMENTAL EN FÍSICA I QUÍMICA (TEFQ) — VC 5 CEs / RD 0 CEs — _no RD mapping defined (VC-specific); expert to confirm_

| VC CE | VC statement | → RD CE | RD statement | Sim | DOGV families | RD numbered descriptors | Status |
|---|---|---|---|---|---|---|---|
| 1 | Analitzar el fenomen a estudiar o la situació problemàtica a resoldre mitjançant una apro… | — | — | — | — | — | VC-ONLY |
| 2 | Dissenyar experiències per a la recollida de dades, aplicant el mètode de control de vari… | — | — | — | — | — | VC-ONLY |
| 3 | Utilitzar els mètodes experimentals adequats i aplicar correctament les normes de seguret… | — | — | — | — | — | VC-ONLY |
| 4 | Extraure conclusions degudament argumentades a partir de l'organització, representació i… | — | — | — | — | — | VC-ONLY |
| 5 | Comunicar amb rigor i claredat les reflexions realitzades al llarg de tot el procés, així… | — | — | — | — | — | VC-ONLY |

