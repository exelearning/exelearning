# Unified compact activity authoring format

A compact, line-based text syntax for authoring activity-like iDevices, using
`#` field separators and optional `@key=value` parameters. Proposed in
[issue #1228](https://github.com/exelearning/exelearning/issues/1228).

> **This is an authoring/import format, _not_ the canonical iDevice storage
> format.** eXeLearning iDevices use [several different storage
> patterns](patterns.md) depending on the type. The parser turns one compact
> line into a normalized, iDevice-agnostic model; separate adapters convert that
> model into the concrete data structure of a specific iDevice. Existing
> `.elp`/`.elpx` import and export behaviour is unchanged.

Implementation:

- Parser: `src/shared/parsers/unified-activity-format.ts`
- Adapters: `src/shared/parsers/unified-activity-adapters.ts`
- Re-exported from `src/shared/parsers/index.ts`

## Grammar

A line has a **payload** followed by zero or more **parameters**:

```
<payload>@key=value@key=value…
```

- Payload fields are separated by an unescaped `#`.
- The parameter section starts at the first unescaped `@` that begins a **valid**
  `@key=` assignment. A key must be letter-leading (`^[a-z][a-z0-9_-]*$`,
  case-insensitive); other `@token=` text (for example `@8am=`) is not a
  parameter and stays in the payload as literal content. To keep a would-be
  parameter literal, escape it as `\@key=`.
- `@@…@@` blank regions are skipped while locating parameters, so a blank answer
  may itself contain `=` (for example `@@x=5@@`). The same is true inside a
  parameter value (`@explain=use @@k=v@@`).
- Parsing is line-based. The batch helper splits on `\r\n`/`\n`, skips blank
  lines, `//` comment lines and `# ` (hash-space) comment lines, and reports
  1-based line numbers in diagnostics.

### Escaping

Because natural text contains `#` and `@`, the following escapes are supported
everywhere (payload fields, blank answers and parameter values):

| Sequence | Result |
| --- | --- |
| `\#` | literal `#` |
| `\@` | literal `@` |
| `\\\|` | a literal pipe inside a blank answer (an unescaped pipe separates alternatives) |
| `\\` | literal `\` |
| `\n` | newline |
| `\t` | tab |

An unknown escape (for example `\z`) is **preserved literally** and reported as
an `UNKNOWN_ESCAPE` warning (an error in `strict` mode). A literal `@@` in
fill-in-the-blank text is written `\@\@`.

### Activity kinds and `@type` aliases

The normalized model has four kinds. `@type=` is the explicit, unambiguous way
to choose one; the following input aliases all normalize to a kind:

| Kind | `@type` aliases |
| --- | --- |
| `selection` | `selection`, `select`, `multiple-choice`, `multiple`, `single`, `mc` |
| `truefalse` | `truefalse`, `true-false`, `tf` |
| `fillblank` | `fillblank`, `fill-in-the-blank`, `cloze`, `fill` |
| `flashcard` | `flashcard`, `flashcards`, `flipcard`, `flipcards` |

`flashcard` is an **input alias only** — the canonical iDevice is
[`flipcards`](catalog.md) (Memory cards). No new canonical iDevice type is
introduced. The `single` and `multiple` aliases additionally fix the selection
mode (equivalent to `@selection=single`/`@selection=multiple`).

### Type detection (when `@type` is absent)

1. If the `defaultType` option is set, it is used.
2. If the payload contains a valid `@@…@@` blank → `fillblank`.
3. Otherwise the payload is split into `#` fields:
   - exactly 4 fields, first is a boolean token, and the 3rd/4th are literal
     `true`/`false` labels → `truefalse`;
   - 3 or more fields and the first field starts with a digit → `selection`.
4. Anything else (including any 2-field line) returns an `AMBIGUOUS_TYPE` error
   asking for an explicit `@type=`. Flashcards are **never inferred** and always
   require `@type=flashcard`.

## Examples

Selection — single answer (0-based option index):

```
0#Capital of France?#Paris#Rome#Berlin
```

Selection — multiple answers (`012` = compact indexes 0, 1 and 2; `0,2` and
`0|2` are also accepted):

```
012#Which are the three main axes?#Poverty blame#Dehumanization#Dissent criminalization#Democratic participation@explain=The three axes are poverty as guilt, dehumanization, and dissent criminalization.
```

True/False (the leading `1` means the statement is **true**, not option index 1):

```
1#Is the Earth round?#True#False@hint=Think about the horizon@explain=The Earth is a geoid, not flat.
```

Fill-in-the-blank (each `@@answer@@` is a blank; alternatives use `@@a|b@@`,
correct first):

```
eXeLearning is a @@free@@ and open source editor to create @@educational@@ resources.@explain=eXeLearning creates interactive learning content.
```

Flashcard (requires explicit `@type`):

```
Photosynthesis#Process by which plants convert light into energy@type=flashcard
```

Escaping a literal separator:

```
0#What is 2 \# 3?#Five#Six
0#Contact \@ support?#Yes#No
```

## Parameters

Parameter keys are normalized to lowercase and must match
`^[a-z][a-z0-9_-]*$`. Values run until the next `@key=` and are trimmed.
Duplicate keys are an error. Unknown keys are kept in `params.extra` and
reported as an `UNKNOWN_PARAM` warning (an error in `strict` mode or when
`allowUnknownParams` is `false`) — they are never silently dropped.

| Parameter | Normalized as | Notes |
| --- | --- | --- |
| `type` | (consumed for kind detection) | see aliases above |
| `hint` | `params.hint` | learner hint |
| `explain` | `params.explain` | explanation of the correct answer |
| `feedback` | `params.feedback` | feedback when wrong |
| `points` | `params.points` (number) | non-numeric → `INVALID_POINTS` warning |
| `difficulty` | `params.difficulty` | free-form |
| `tags` | `params.tags` (string[]) | comma-separated |
| `selection` | `params.selection` | `single`/`multiple`; overrides inference (also set by `@type=single`/`@type=multiple`) |
| `shuffle` | `params.shuffle` (boolean) | `true/1/yes/y` / `false/0/no/n` |
| `case-sensitive` | `params.caseSensitive` (boolean) | |
| `strict` | `params.strict` (boolean) | |
| `lang` | `params.lang` | language hint |

A recognized parameter is only written into an iDevice when that iDevice has a
real target field (see the mapping below). Parameters without a target survive
in the normalized model but are not invented into iDevice fields.

## iDevice mapping

Adapters target confirmed runtime models. Selection and fill map to the
[`form`](catalog.md) iDevice (the unified quiz container); true/false maps to the
[`trueorfalse`](catalog.md) game (and, optionally, to a `form` `true-false`
question); flashcards map to [`flipcards`](catalog.md).

| Kind | Adapter | Target |
| --- | --- | --- |
| `selection` | `unifiedSelectionToFormQuestion` | `form` `questionsData` (`activityType: 'selection'`) |
| `truefalse` | `unifiedTrueFalseToTrueOrFalseQuestion` | `trueorfalse` game question |
| `truefalse` | `unifiedTrueFalseToFormQuestion` | `form` `questionsData` (`activityType: 'true-false'`) |
| `fillblank` | `unifiedFillBlankToFormQuestion` | `form` `questionsData` (`activityType: 'fill'`, blanks as `<u>answer</u>`) |
| `flashcard` | `unifiedFlashcardToFlipCard` | `flipcards` card (`eText`/`eTextBk`, URI-encoded) |
| any batch | `unifiedItemsToFormQuestionsData` | `form` `questionsData[]` (flashcards skipped) |

Parameter → iDevice field mapping:

| Parameter | selection (`form`) | truefalse (`trueorfalse`) | fill (`form`) |
| --- | --- | --- | --- |
| `hint` | `suggestion` | `suggestion` | `suggestion` |
| `explain` | `feedbackRight` | `feedback` | `feedbackRight` |
| `feedback` | `feedbackWrong` | `feedback` (fallback) | `feedbackWrong` |
| `points` | `customScore` | — | `customScore` |
| `case-sensitive` | — | — | `capitalization` |
| `strict` | — | — | `strict` |

> **Hint maps to `suggestion`, not `hint`.** The `form` iDevice reads the
> question-level hint from `suggestion`; the field named `hint` (written by the
> legacy `MultichoiceHandler`) is never read. Adapters write `suggestion`.

### Encoding notes

- True/false answers normalize the tokens `1/true/t/yes/y` and `0/false/f/no/n`
  to a boolean, then to `solution: 1` (true) / `0` (false) for the `trueorfalse`
  game, or `answer: '1'` / `'0'` for a `form` `true-false` question.
- Selection options become `[isCorrect, text]` tuples; `selectionType` is
  `multiple` when more than one answer is correct (or `@selection=multiple`).
- Fill blanks render as `<u>answer</u>` in `baseText` (alternatives as
  `<u>|a|b|</u>`), matching the `form` fill renderer.
- Flashcard front/back text is URI-encoded with the same `encodeURIComponentSafe`
  rule the `flipcards` editor uses.
- Adapter output `baseText`/`question` is HTML; this layer does not sanitize —
  sanitization belongs to the iDevice render layer, as elsewhere in the codebase.

### `MultichoiceIdevice` mapping

The legacy `MultichoiceIdevice` / `MultiSelectIdevice` convert to the modern
[`form`](catalog.md) iDevice (`MultichoiceHandler`, `LegacyXmlParser`). The
[catalog](catalog.md) reflects this; new selection authoring also targets `form`.

## Diagnostics

The parser never throws for malformed authoring text. It returns
`{ ok, item?, diagnostics[] }`; each diagnostic has a `severity`
(`error`/`warning`), a stable `code`, a `message`, and a 1-based `line` (in
batch mode).

Errors: `AMBIGUOUS_TYPE`, `UNKNOWN_TYPE`, `DUPLICATE_PARAM`,
`INVALID_ANSWER_INDEX`, `ANSWER_INDEX_OUT_OF_RANGE`, `DUPLICATE_ANSWER_INDEX`,
`NO_CORRECT_ANSWER`, `EMPTY_QUESTION`, `TOO_FEW_OPTIONS`, `EMPTY_OPTION`,
`SELECTION_SINGLE_CONFLICT`, `INVALID_BOOLEAN`, `EMPTY_STATEMENT`,
`TRUEFALSE_BAD_SHAPE`, `MISSING_BACK`, `TOO_MANY_FIELDS`, `EMPTY_FRONT`,
`EMPTY_BACK`, `UNMATCHED_BLANK`, `EMPTY_BLANK`, `NO_BLANKS`.

Warnings: `UNKNOWN_PARAM`, `INVALID_PARAM_VALUE`, `INVALID_POINTS`,
`EMPTY_ALTERNATIVE`, `UNKNOWN_ESCAPE`.

## API

```typescript
import {
    parseUnifiedActivityLine,
    parseUnifiedActivityLines,
    unifiedSelectionToFormQuestion,
    unifiedTrueFalseToTrueOrFalseQuestion,
    unifiedFillBlankToFormQuestion,
    unifiedFlashcardToFlipCard,
    unifiedItemsToFormQuestionsData,
} from '@/shared/parsers';

const result = parseUnifiedActivityLine('0#Capital of France?#Paris#Rome#Berlin');
if (result.ok && result.item?.kind === 'selection') {
    const question = unifiedSelectionToFormQuestion(result.item);
}
```

Options: `defaultType`, `strict`, `lineOffset`, `allowUnknownParams`.

## Known limitations

- This format does not replace the per-iDevice storage models; not every iDevice
  is expressible.
- A pure-digit answer spec is interpreted as compact single-digit indexes
  (`012` → 0, 1, 2). To reference an option at index ≥ 10, use the comma or pipe
  form (`0,12`).
- `flashcard` is an input alias mapped to `flipcards`; only simple text
  front/back cards are produced (no media).
- A leading `1`/`0` means a boolean answer **only** in true/false context; in
  selection context the first field is a 0-based option index.
- This PR adds the parser, adapters and documentation. Wiring the format into the
  existing bulk-question authoring UI (`getTabIA` / `insertQuestions` in
  `public/app/common/common_edition.js`) is a follow-up.

## Migration notes

- Existing `.elp` / `.elpx` import and export are unchanged.
- Legacy iDevice handlers remain the source of truth for legacy XML.
- This parser is an additional authoring convenience, layered on top of the
  existing models.
