---
id: ADR-2539-01
title: "Generate printable content from iDevice data"
status: Proposed
date: 2026-09-20
tracking_issue: 2539
deciders:
  - "@mnarvaezm"
reviewers:
  - "@mnarvaezm"
related:
  prs: [2539]
  changes: ["2539-print-idevice-contents"]
  adrs: [ADR-2539-02]
supersedes: []
superseded_by: []
ai_assistance:
  tool: Claude Code
  model: Claude Opus 5
---

# ADR-2539-01: Generate printable content from iDevice data

## Context

eXeLearning had one printing path: `PrintPreviewExporter` renders the project the way the
single-page export does, loads it in an iframe and applies `@media print` rules
(`src/shared/export/exporters/PrintPreviewExporter.ts`).

That path prints what the browser displays. For prose and images this is exactly right. For the
gamified iDevices it is not: what the browser displays for a Guess activity is a board with the
solution's letters hidden behind covers, and for a crossword a grid wired to click handlers.
Printed, these are not exercises — they are screenshots of a game mid-play.

The existing exporter already conceded this. `hidePrintExtras()` exists to *hide* what it cannot
print sensibly: `completa-DataGame`, `form-Data`, the map iDevice's overlay images.

Teachers want the opposite: the activity they built digitally, handed out on paper.

## Problem

Should printable content for interactive activities be produced by styling the rendered HTML, or
by reading each activity's stored data and building a new document from it?

## Decision drivers

- **Fidelity to the exercise.** A printed Guess activity must show the clues and space to answer,
  not the game board.
- **Per-iDevice divergence.** The gamified iDevices have unrelated data shapes (`wordsGame`,
  `questionsGame`, `selectsGame`, crossword grids, map coordinates). Whatever we choose has to
  scale across them without a rewrite each time.
- **Cost of adding the next iDevice.** This governs every conversion that follows the first.
- **No risk to the user's project.** Printing must never write to the document.
- **Runs in both halves.** The shared export code runs in the browser and under Bun for CLI
  exports, so the mechanism cannot depend on a DOM.

## Options considered

### Option 1: Extend the CSS-based print path

Keep rendering the activity and add `@media print` rules that reveal hidden elements and suppress
interactive chrome.

- Pros: no new pipeline; smallest diff.
- Cons: the information needed is often not in the DOM at all. In Guess the solution's letters are
  drawn into covers by JavaScript at runtime; there is no markup that reads "eight empty boxes".
  Every iDevice needs bespoke CSS, untestable in isolation and unable to restructure content.

### Option 2: Read the stored data and build a new document

Extract each activity's persisted state, translate it into a neutral model, and render that model
as a worksheet.

- Pros: complete freedom over the printed layout. Each conversion is a pure function, unit
  testable without a browser. The activity's own runtime is never involved.
- Cons: a new pipeline; one adapter per iDevice; the stored shapes are undocumented.

### Option 3: Have each iDevice render its own printable form

Add a `renderPrintable()` to every iDevice's export JavaScript.

- Cons: spreads print logic across legacy files with no shared tests; requires loading each
  iDevice's runtime; rules out CLI exports.

## Evidence

- **The data is present and readable.** Gamified iDevices persist their whole state as JSON in a
  hidden div, obfuscated with XOR key 146 plus `escape()` (`public/app/common/common.js`).
- **The shapes carry what a worksheet needs.** Guess stores `definition` (the clue), `word` (the
  solution) and `percentageShow` (how many letters to give away); Crossword stores `difficulty`;
  Complete stores the text with hidden words wrapped in `@@`.
- **Media URLs must come from sidecar links, not the payload.** The export pipeline's `asset://`
  rewriting cannot see inside the obfuscated blob, so iDevices duplicate the references as plain
  `<a class="js-hidden adivina-LinkImages">3</a>` elements whose link text is the question index.
  The activity's own runtime overrides the payload URLs from those links when loading.

## Decision

We will generate printable content **from each iDevice's stored data**, not from its rendered
HTML.

The mechanism is three layers with a neutral model between them:

1. **Adapters** — one per iDevice type, translating that iDevice's stored shape into the model.
   Registered in a single registry; adding an iDevice means adding an adapter and one line.
2. **`PrintableActivity`** — the model: instructions, an optional shared board, a list of items
   and closing text.
3. **`WorksheetRenderer`** — renders the model as HTML with its own inlined stylesheet.

The model has grown with each adapter, and the shapes it settled on are the durable part:

| Concept | Variants |
|---|---|
| Answer space per item | `characterBoxes` (one box per character, with hinted letters), `options` (a box to tick or a line to number), `writingSpace` (blank room to write in), `orderCards` (cards to be numbered), `mediaOptions` (pictures to choose between, each with a box) |
| Shared board above the items | `crosswordGrid` (with an optional background picture), `wordBank`, `matchColumns`, `groupColumns`, `letterRing`, `wordGrid`, `operationTable`, `rubricTable`, `elementCards` |
| Inline | gaps sized per word, placed inside the author's own text |

A board can be the whole exercise rather than a space above one. An arithmetic drill is a table of
sums and has no questions to number beside it, so its activity carries a board and an empty list
of items. The blank is wherever the activity asks: a row gives the sum and leaves the result
empty, or gives the result and leaves a gap inside the sum, and a gap for a sign is narrower than
one for a number because a gap wide enough for a number invites one.

**The board is where an activity's shape lives.** A crossword's grid, a ring of letters, two
columns to join: each is drawn the way the activity is recognised rather than flattened into a
list. The ring is a ring, its letters placed by angle as the activity places them, because the
shape is what the student reads the state of the game off.

**The copy the export pipeline can see is the one to read.** An iDevice may keep the same text
twice: inside the obfuscated payload, and in plain HTML beside it. They are not interchangeable.
The `asset://` rewriting pass only reaches what it can parse, so a picture referenced from inside
the payload points at something that no longer resolves; the plain copy has been rewritten and
still loads, and is also the one the runtime reads back over the payload. This is the rule the
sidecar links already encode, and it extends past media: whole statements are stored that way too.

**What the activity does not store is built here, not ported.** Some iDevices keep rules rather
than questions and invent the exercise on every load: the crossword and the word search lay their
grid out afresh, Maths problems draws the numbers its statements are posed with, and Maths
operations stores no question at all — only which operators are in play, the range the operands
come from, and whether a result may be negative, decimal or zero. There is therefore nothing on
screen for a printed sheet to match, and porting hundreds of lines would buy an arrangement that
is random anyway. Each gets its own compact builder, which follows the activity wherever a reader
would notice — the directions a word may run, a preference for crossing, a grid that grows until
everything fits, the same alphabet in the blanks, the operators the author switched on, a result
redrawn until the settings allow it — and departs only where the original is arbitrary, with the
departure written down where it happens.

A generator that can be asked for the impossible sets something rather than nothing: an activity
allowing only subtraction within 0–0 and forbidding a zero result has no draw that satisfies it,
so the drill is bounded and keeps its first attempt. A blank sheet would tell the teacher less
than a sum that breaks one of their own rules.

Author HTML is parsed and filtered with **parse5** rather than regexes, so entity decoding, tag
nesting and attribute handling match what a browser does in both the browser and Bun.

The path is read-only: it never writes to the project.

### The model carries page-sized units, not long lists

A board that asks the student to join two columns is carried as **groups**, each holding the cards
whose partners are among them, rather than as two columns the renderer cuts wherever the page ends.

This is a modelling decision and not a styling one, because only the adapter knows which cards
belong together: it must group *before* it shuffles, or a card's partner ends up in another group
and then on another sheet. `break-inside: avoid` alone cannot fix this — it moves a block whole,
but nothing tells it where one exercise ends and the next begins.

**A block is as tall as its tallest column, not as tall as both together.** The two columns stand
side by side, so sizing a block by subtracting one column's rows from the other's budget is simply
wrong arithmetic — it was, and it left one card per block while the column of destinations still
ran to 330mm, taller than the sheet it was supposed to fit. Each column is measured on its own,
and a column with more entries than a block holds is laid out wider and shorter rather than
allowed to grow past the page.

### Room to write is left blank

Where a student writes an answer out in full, the model reserves height and the renderer draws
nothing in it. A rule under a sentence being copied out says *write on this line*, which is a
constraint the exercise never set; an empty gap says the same thing without adding one. Rules are
kept for the one case that needs them — a single value written under the card it belongs to, where
the line is what ties the number to its card.

### Two columns was a special case, not a shape

An activity that asks the student to join things up does not always join two. Discover sets pairs,
trios or quartets, and its "Type" decides which. The board therefore carries **columns**, a list of
them, rather than a left and a right; two is simply the common length. One shape and one renderer
now serve every joining exercise, where a second board kind beside the first would have been the
same picture drawn twice.

The gap between columns follows from the count rather than being fixed. Four columns of card at
the old 30mm channel come to 226mm, which is wider than the sheet; the channel closes exactly as
far as it must and no further, so two columns keep the room they had and four still fit.

**A fragment cannot borrow the host's box model.** The activity styles are injected into documents
this renderer did not build, and a card declared 34mm wide measured 38.5mm wherever the host had
not set `border-box` — which made a nonsense of any arithmetic done against the page width. The
fragment now sets it on its own elements and leaves the host's alone. Two columns had always been
narrow enough to hide this; four were not.

**Columns are not always an exercise.** Before/After lays two pictures out in the same shape, but
nothing is joined across the row: the row *is* the content, and the student is looking rather than
answering. So the group says whether its rows are `aligned`, and may name its columns. Neither is
styling. Aligned means the adapter did not shuffle — a before separated from its own after
compares nothing — and the naming is what tells the reader which column is which, where a joining
exercise needs no such thing.

Both facts change the drawing. Nothing is joined across an aligned row, so the channel a matching
exercise keeps between its columns is wasted there and goes to the cards instead: 78mm rather than
34mm, which is the difference between two pictures that can be compared and two that cannot.

### An adapter may borrow the worksheet's own words, having first tried the activity's

Some activities keep their user-visible wording where the author can edit it, and the rule above
stands: that wording is what gets printed. But an activity may have none to lend. Before/After
draws no captions at all on screen — it is a slider, and the "Before" and "After" in its editor
label form fields that never reach the runtime — so a printed comparison has to name its columns
with words of ours.

An adapter therefore receives the worksheet's translated labels alongside its other options. The
order is what matters: reach for the activity's stored words first, because inventing a string of
our own where the author has edited theirs would ignore the edit and would need a translation key
for something already translated.

### An author's colour is read for paper, not copied to it

Some activities let the teacher colour each card, a font colour and a background colour. Neither
is used as given.

**A background becomes an outline and a band, never a fill.** A filled card is a block of toner on
every copy, and a class set is thirty copies; the outline and the band across the card's top say
which cards go together for a fraction of the ink, and leave the words on white rather than on a
background chosen for a backlit screen. This is the same reasoning the matching containers already
followed, now stated once and applied wherever a card carries a colour.

**A colour that cannot be seen on paper is dropped rather than printed.** White text was legible
on the author's coloured card and is invisible on white paper; a pastel outline is not an outline.
The bar is the published one — WCAG 2.2's 3:1 for a graphical object and for large text — so the
rule can be checked against the standard instead of argued about. A colour that fails it is
dropped for text, and for an outline falls back to black, because a card without an edge runs into
its neighbour. A band keeps its colour whatever its lightness: a band only has to be noticed, not
read through.

**The editor's own defaults mark nothing.** Black text and a white background are where the
editors start every card, so carrying them through would put a style attribute on nearly every
card to say what it already was.

The colours reaching the renderer are hex or nothing, which is also the only reason they can be
written into a `style` attribute unescaped. Validation lives with the reading, not at the point of
use.

### What a removed element leaves behind goes with it

An author can put a video, or a whole interactive embed, in the middle of their own prose. None of
it can be printed, and the sanitiser has always dropped it — but it left the paragraph that held it
standing, empty. On screen that is nothing; on paper it is a hole the size of the words it
replaced, and a sheet with several of them looks broken.

So an element left with nothing to show, **because something was taken out of it**, goes with what
was taken. The qualifier is the whole of the rule: an empty paragraph the author typed is spacing
they asked for and is kept, and a table cell is kept whatever is in it, because an empty cell is
part of the table's shape and dropping one shifts every cell after it. Only the emptiness this
pipeline caused is this pipeline's to clear up.

### The one activity whose answers are printed in full

Every other adapter hides what the student is meant to arrive at. A rubric is the exception, and it
is not an exception to the rule so much as a different exercise: the descriptors are what the
teacher is choosing between, and marking is done by ringing the cell that fits. Hiding them would
leave a grid of numbers with nothing to decide from.

It also stops being "not an activity". It was excluded at first on the grounds that an assessment
table prints as the table it is — true of the table, but not of what surrounds it on screen: text
inputs, buttons and a running total that print as empty boxes. With an adapter it goes through the
same conversion as the rest, and what reaches the page is the table, the fields as blank rules and
room for notes.

The fields are the activity's own, minus the name and the date: the sheet already asks for both at
the top, and asking twice on one page reads as a mistake.

### An activity whose subject is a drawing prints the drawing

Most of these activities are words and a game played with them, and what does not survive the trip
to paper is the game. Two are not: Electrical circuits and 3D molecules exist to show a thing, and
the question is about the thing. Printing their words and leaving the picture out would set an
unanswerable exercise, so the picture is what makes them printable at all — and unlike a map or a
puzzle, nothing about the picture is interactive.

**A drawing travels as an image, never as markup.** Electrical circuits stores its diagram twice,
the TikZ source and the SVG it was rendered into, and the sheet carries the SVG as a data URI in an
`<img>`. A browser runs no script in an SVG loaded that way, which is the whole of the safety
argument: inlining the same markup would put an author's `onload` into the document. The argument
is written down beside the code that depends on it, in `circuitImage`.

**What was never drawn is drawn before the sheet is built.** 3D molecules keeps only half of that:
the model file, the style and the camera angle the author framed it at. What a reader sees is drawn
by WebGL every time, and nothing about it is stored. An adapter cannot draw it — adapters are pure
functions over stored data with no DOM, which is what lets them run under Bun — so a pass opens each
payload, has every molecule drawn, writes the picture in beside the model and closes it again. It
runs before the adapter in both printing paths, and before the conversion in the document path,
which is synchronous and has no browser either.

The rendering itself is injected rather than imported. Only a browser can do it, and keeping it out
of the shared code is what lets a command-line export skip it instead of failing: with nothing
supplied, the questions print without their molecules and the gap is reported. It is the same shape
as the LaTeX and Mermaid pre-renders that already run over these payloads, which is why it is not a
new idea to maintain.

**A picture is drawn for paper, not for the screen.** The sheet prints a molecule at 80 mm across
at most, so it is captured at about 300 dpi for that width and no more. Each one travels inside the
document as a data URI, and a page of molecules captured at screen-grab quality is a document
nobody can open.

### Print sets typography the screen was excused from

Where the screen's rendering is a compromise the page does not share, the page gets the proper
form. An arithmetic drill writes its signs on screen as a lowercase `x` and a colon, sitting in a
line among form controls; printed, those signs *are* the arithmetic, and an `x` beside a number
reads as an unknown. A worksheet therefore writes `×`, `÷` and a true minus `−`.

This is not a licence to restyle the author's content. It covers characters this pipeline emits on
the activity's behalf, never text the author typed.

### No expression an author wrote is ever evaluated

A printed exercise asks the student to solve it, so the answer to an author's question is never
worked out here. Maths problems store a formula and the activity evaluates it with `eval`; the
adapter substitutes the numbers into the statement and stops there. Preferring to print the
question over the answer is what keeps an expression an author wrote off the path to a printed
page.

Arithmetic this pipeline made up itself is a different thing and is worked out: Maths operations
draws two numbers and an operator, so the sum has an answer without anything being interpreted.
It has to be worked out, because an activity may ask for a missing operand instead of the result,
and then the result is the part that gets printed. The line is between evaluating stored text and
adding two numbers we chose — the first is what the rule above is protecting against, the second
is arithmetic.

### What the activity gives is printed as given

An activity can hand the student part of the answer: a letter revealed in a box, a word offered in
a bank, a row of column headings fixed in place. Those are printed where they belong, in their
own order, with nothing to fill in beside them. Only what is actually asked is shuffled and left
blank. Getting this wrong does not merely look odd — shuffling a heading turns a solvable exercise
into an impossible one.

### A question is labelled once

Questions are numbered by the list they sit in, except where they already carry a label of their
own — a crossword clue numbered after its grid, a letter in an alphabet game. Numbering those as
well prints 'A. Contains letter A' or '1. Starts with D', which says the same thing twice and
reads as a mistake. The model records that the items are labelled; the renderer stops numbering
them.

### An activity's own words are used before new ones are invented

Several iDevices save their user-visible wording with the activity, where the author can edit it —
the alphabet game stores 'Starts with %1' and 'Contains letter %1' among its custom texts. When
that wording exists it is what gets printed, translated as the author left it. Adding a string of
our own would ignore their edit, and would need a translation key for something already
translated.

### Fidelity is to the iDevice's own contract, not to the family's habits

Each adapter reads its iDevice the way that iDevice's editor writes and its runtime reads, even
where the family around it differs. Two cases already bit:

- **Classify stores `eText` unescaped** and injects it unchanged, unlike every sibling, which
  `escape()`s the same field. Unescaping it rewrote a teacher's literal `%41` into `A`.
- **The crossword runtime places words in two passes**, the second seating whatever crossed nothing
  rather than dropping it. Porting only the first took a word's clue off the sheet.
- **The alphabet game only encrypts from version 1 onwards**, so an older project stores its
  payload as plain JSON where every sibling stores it obfuscated. It also holds two of its letters
  as digits, `0` and `1`, which are read as L·L and SS.
- **Sort keys its sidecar links twice over.** Every other iDevice names one class and puts the
  question's index in the link text; Sort has rounds, so it puts the round in the class
  (`ordena-LinkImages-0`) and the card in the text. The shared rule now takes a class rather than
  composing one, so both shapes go through the same code.
- **Sort and Classify store their card text unescaped** where the rest of the family escapes the
  same field, and the word search applies its share of questions in stored order where its
  siblings draw at random. Neither could be guessed from the family.
- **Maths problems keeps each statement in a hidden div of its own**, tagged with the problem's
  index, and its payload copy is stale. It also draws the numbers afresh on every load, so a sheet
  poses one version of each problem rather than the version anyone has seen.
- **Before/After never obfuscates its payload and never encodes its captions.** Its loader calls
  no decrypt at all, and assigns `eText` to itself rather than decoding it — where Relate keeps the
  same-named field URI-encoded. Decoding here would mangle a caption containing a percent sign.
- **Hidden image names its two shuffle flags the wrong way round.** `optionsRamdon` shuffles the
  questions and `answersRamdon` the options, which its own editor field ids confirm. Reading them
  as spelled sets a different exercise from the one the teacher configured, and nothing on the
  sheet would say so.
- **Relate and Flip cards store the identical card**, down to the field names and the four
  sidecar classes, so the reading of it lives in `twoFacedCards` rather than in each adapter. The
  two do different things with it on screen — one drags a line, the other turns a card over — and
  neither survives the trip, so both print the same exercise.
- **Relate keeps both faces of a pair in one object, the back marked only by a Bk suffix** on
  every field, and stores its card text URI-encoded — `decodeURIComponent`, not the family's usual
  `unescape()`, which would mangle every accent in a Spanish worksheet. Its sidecars come in four
  classes rather than two, a picture and a sound for each face. Unlike Drag and drop, which pairs
  a picture with a text, either face can carry a picture, a text, both, or only a sound.
- **Discover keys its sidecars twice, as Sort does**, but on a different pair: the class carries the position within the answer (`descubre-LinkImages-0` … `-3`) and the link text the entry. It also stores its `eText` raw, where Relate URI-encodes the same-named field and Classify keeps its own unescaped — the family agrees on the name and on nothing else.
- **A Discover difficulty level is not a different exercise**, it is the same one with more of the board in play: a third, two thirds, all. A sheet has no buttons to offer, so it prints the middle.
- **Maths operations settles a random choice once per activity, not once per question.** Its
  `type` setting says which part the student supplies, and `random` is drawn and written back over
  the setting as the activity loads — so every sum in a drill asks for the same part. Drawing it
  per row would set an exercise the iDevice never sets.
- **Form keeps its data where the adapter could not see it.** It is the first of the `json` family
  to get an adapter, and that family stores nothing in its HTML — `form-Data` holds `{}` and the
  questions live in the component's properties. An adapter used to be handed only the markup, so
  the properties are now handed over with it. Nothing else changed: the model took the four kinds
  of question it asks — true or false, options to tick, a gap to write in, a gap to choose a word
  for — without a new shape, which is what the first of a family was there to test.
- **The periodic table is not stored anywhere.** The activity keeps which groups of elements are in
  play and how many to ask about, and draws the elements themselves afresh on every load from a
  table inside its own JavaScript. That table is ported rather than read, as the crossword's
  placement and the word search's grid are built rather than ported. Only the chemistry comes
  across: an element's name and its group are the activity's own words, kept in its payload, so a
  Spanish project prints 'Hierro' and 'Metal de transición' and not a translation of ours.
- **Rubric stores its table two ways, and neither is obfuscated.** A project saved by the current
  editor carries the whole table as `escape()`d JSON — no XOR over it, unlike every sibling that
  keeps a payload — and an older one carries only the table the author pasted, as ordinary HTML,
  which the runtime rebuilds the JSON from on load. Both are in the wild and both print. The
  reading of the old one follows the runtime field for field; the two cannot share code, one being
  legacy jQuery and the other running under Bun, so what is shared is written down instead.
- **Identify keeps eight clue slots whatever the author filled.** `numberClues` says how many are
  in play, and the slots past it hold whatever was last typed there — printing the array would put
  a deleted draft on the sheet. A slot left blank in the middle is skipped rather than numbered.
- **Challenge keeps a description twice, and not always both.** The main challenge's wording and
  each smaller one's live in the payload and in a div beside it, and the div is the copy the
  pipeline rewrote — but the divs arrived with a later version of the iDevice, so a project saved
  before that has only the payload's. Each falls back rather than printing nothing. Its challenges
  key those divs by position alone, where the iDevices that keep a `data-id` can be read in any
  order. It also stores `instructionsExe` raw, where most of the family `escape()`s the same field.
- **Electrical circuits and 3D molecules are Select's questions with a picture attached.** Both
  store `selectsGame`, `quextion`, `typeSelect` and `options` exactly as Select does, down to the
  spelling, so the three answer kinds are set the way they are there. What is theirs alone is
  `activityMode`: the author says whether the activity presents its subject or asks about it, and
  the sheet follows, because a question keeps its `quextion` from whenever it was last in test mode
  and reading it in presentation mode would print a question the author had put away. 3D molecules
  also names its payload `dmole`, not after the iDevice.

The rule this leaves: read the iDevice's editor and runtime before writing its adapter, and write
the fixtures the way the editor really stores things — a fixture built the convenient way validates
a format that never occurs.

### Printing never widens what the author restricted

A transformation may leave content as it is, but it may never make visible something the author
hid. The blocks and components marked `novisible` or `teacher-only` are `display: none` in the
export stylesheet, so anything that moves them out of their block loses the restriction with them.
Restricted content is therefore left untouched by every mode.

## Consequences

### Positive

- Printed activities are real exercises, sized and shaped from the stored data.
- Each conversion is a pure function over a JSON shape, unit testable without a browser.
- Adding an iDevice touches one new file and one registry line.
- Works under Bun as well as in the browser, so CLI worksheets stay possible.

### Negative

- A second printing pipeline to maintain.
- Adapters depend on undocumented, per-iDevice stored shapes. An iDevice changing its payload
  silently breaks its adapter; only the adapter's own tests would catch it.
- Faithfulness has to be established per iDevice by reading its editor and runtime. Nothing in the
  types enforces it, and green tests do not establish it either — a fixture written to the wrong
  contract passes happily.
- Grouping for the page fixes the pairing, and fixes the number of cards a block holds at
  something the renderer chose rather than what the content needs.
- Fitting a large set of destinations rests on an assumption about how long their names are. The
  shorter layout sets a minimum height, not a fixed one, so nine long names can still grow a block
  back towards the edge of the sheet.
- Most interactive iDevices remain unconverted, so the worksheet is incomplete until they are
  done. It reports what it skipped rather than dropping activities silently.

### Neutral

- The worksheet stylesheet is inlined in the generated document, because the document loads from a
  blob URL with no access to application CSS. This matches `injectPreviewStyles()`.
- User-visible strings are passed in from the frontend already wrapped in `_()`, because the
  shared export code's `trans()` is a pass-through.

## Risks

- **Stored shapes drift.** Medium likelihood, low severity: an adapter breaks, its tests fail, the
  activity is reported as unprintable rather than printed wrongly.
- **An adapter is written to the family's habits instead of its iDevice's contract.** High
  likelihood — it happened twice in the first seven — and medium severity, since the result is a
  quietly wrong exercise that the tests agree with. The only guard is reading the editor and the
  runtime, and writing the fixtures the way the editor really stores things.
- **Stale media URLs.** High likelihood if the sidecar rule is forgotten, low severity once
  encoded. Mitigated by concentrating the rule in `dataGameReader`.
- **Untrusted author HTML.** Low likelihood, high severity: a crafted `.elp` could carry a script
  into the generated document. Mitigated by parsing and filtering with an allow-list.
- **A molecule that cannot be drawn.** Medium likelihood — no WebGL, a command-line export, a
  browser that has run out of graphics contexts — and low severity: the questions print without
  their pictures and the gap is reported to the teacher rather than passing unnoticed. The pass
  draws one molecule at a time and releases each context, so a project full of them does not run
  the browser dry partway through.

## Validation

- Twenty-nine adapters ship, which is every interactive iDevice that is not settled as unprintable: `guess`, `crossword`, `quick-questions`,
  `quick-questions-multiple-choice`, `complete`, `classify`, `dragdrop`, `az-quiz-game`, `sort`,
  `word-search`, `mathproblems`, `mathematicaloperations`, `relate`, `discover`, `flipcards`,
  `hidden-image`, `beforeafter`, `electrical-circuits`, `3dmol`, `challenge`, `identify`, `rubric`, `select-media-files`, `periodic-table`, `form`, `scrambled-list`, `trueorfalse`, `adaptative-quiz`, `padlock`.
- The two that print a drawing are checked against real projects the author saved, rendered to a
  PDF and looked at: a diagram or a molecule that is missing, or drawn from the wrong angle, is not
  something a passing assertion would catch.
- Patch coverage on every worksheet module, with each adapter covering its question types and its
  degenerate payloads.
- An E2E spec printing real projects and asserting real numbers, not arbitrary ones.
- **Anything about pages is checked on pages.** The layout cases render the worksheet to an A4 PDF
  and assert page counts and per-page text. A measurement taken from the continuous DOM cannot
  answer the only question that matters here — whether a card and the thing it must be joined to
  end up on the same sheet — and an assertion that cannot fail for the right reason is worse than
  none.
- Revisit once the shapes stop growing: if a new adapter needs the model to change shape again,
  the contract was wrong and this ADR should be superseded rather than patched.

## Follow-up work

- Adapters for the interactive iDevices that still have none.
- Render the `lines` answer kind when the first adapter needs it; the renderer throws for it today
  rather than printing a blank space.
- A teacher's answer key, deliberately out of scope so far.

## References

- `src/shared/export/worksheet/` — the model, renderer, reader and adapters
- `public/app/common/common.js` — the DataGame cipher
- `public/files/perm/idevices/base/*/export/*.js` — the runtimes the adapters mirror
- [ADR-2539-02](ADR-2539-02-choose-how-interactive-activities-print.md)
