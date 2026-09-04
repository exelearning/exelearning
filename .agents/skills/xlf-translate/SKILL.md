---
name: xlf-translate
description: Fill empty <target> elements in translations/messages.*.xlf files with machine-assisted translations prefixed with ~. Handles language selection, line-range filtering, encoding (inline PowerShell only), and produces a minimal diff touching only empty targets.
---

# Skill: XLF Translation

> Parent: [AGENTS.md](../../../AGENTS.md) | Related: [i18n](../i18n/SKILL.md)

## When to Use

When asked to fill in empty translation targets (`<target></target>`) in the XLF files under `translations/`. This is the **only** legitimate reason to write to those files — and only with this skill's procedure. Never run `make translations` as part of this skill.

---

## Step 0 — Gather parameters

Ask the user **two questions** before doing anything:

**1. From which line?**
> Do you want to translate all empty targets in the file, or only from a specific line onwards?

Accept:
- `"all"` → process every empty target regardless of position
- A line number (e.g. `15468`) → only process empty targets at or after that line

**2. Which languages?**
> Which language files should I fill in? (English is never modified.)

Available languages and their files:

| Code | Language   | File                        |
|------|------------|-----------------------------|
| `es` | Spanish    | `messages.es.xlf`           |
| `ca` | Catalan    | `messages.ca.xlf`           |
| `va` | Valencian  | `messages.va.xlf`           |
| `de` | German     | `messages.de.xlf`           |
| `eo` | Esperanto  | `messages.eo.xlf`           |
| `eu` | Basque     | `messages.eu.xlf`           |
| `gl` | Galician   | `messages.gl.xlf`           |
| `it` | Italian    | `messages.it.xlf`           |
| `pt` | Portuguese | `messages.pt.xlf`           |
| `ro` | Romanian   | `messages.ro.xlf`           |

Accept any of:
- `"all"` → all ten languages above
- `"all except es"` (or any variant) → the list minus the excluded ones
- An explicit list: `"es, ca, va"`

> **`messages.en.xlf` is never touched under any circumstance.**

---

## Step 1 — Identify targets to translate

For each language file in scope, read the file and collect every `<trans-unit>` block that:
- Contains `<target></target>` (exactly empty — no whitespace inside)
- Starts at or after the specified line (if a line constraint was given)

Extract from each block:
- The `<source>` text (the English original)
- The line number of the `<target>` element

Group all unique source texts — the same source may appear in multiple language files.

---

## Step 1.5 — Anchor the terminology before translating

**Do not translate from scratch.** The catalogue already contains thousands of reviewed
strings; a translation that ignores them introduces a synonym where the product had one
settled term. Before writing anything, extract the following from each target file and
translate against it:

1. **Key nouns your strings reuse.** Look up the existing `<target>` for the terms that
   appear in your sources — e.g. `Password`, `Icon`, `Image`, `File manager`, `Activity`,
   `Activities`, `Search`, `Warning`, `Style`, `Confirm`, `Cancel`, `Import`.

   ```bash
   for l in ca va de eo eu gl it pt ro; do echo "--- $l ---"
     for s in "Password" "File manager" "Activities"; do
       grep -A1 "<source>$s</source>" translations/messages.$l.xlf | grep '<target>'
     done
   done
   ```

2. **Register (formal vs informal).** Languages that mark it (`de`, `ro`, `pt`, `it`, `eo`)
   must match what the file already does. Read a full existing sentence with an imperative
   rather than guessing — e.g. look up `You didn't pass the test. Please try again`. A file
   can be internally inconsistent; match the closest analogue (system errors with system
   errors, button labels with button labels).

3. **Regional variant.** Check which one the file is written in before choosing vocabulary:
   `pt` in this project is Brazilian (`Senha`, `arquivos`, `Gerenciador`, `você`), not
   European Portuguese.

4. **Enumerated scales.** When a string belongs to a graded series (text sizes, strength
   levels, difficulty), dump the **whole** series first and pick a term that is still free.
   The LaTeX size scale (`Tiny → Small → Normal → Large → Larger → Very large → Huge →
   Huger`) is the trap: the obvious translation of the last step is usually already taken by
   an earlier one. Check the scale for pre-existing duplicates too, and report them —
   `messages.gl.xlf` had `Very large text` and `Huge text` both as `Texto moi grande`.

5. **Upstream vendored libraries.** Some strings originate in a bundled library that ships
   its own translations — `public/app/common/edicuatex/lang/*.js` covers `ca`, `de`, `es`,
   `eu`, `gl`. Prefer the upstream term so the editor and the surrounding UI agree, **but
   verify it does not collide** with a term the XLF already uses for a different source. For
   `Huger text`, upstream collides in `de`, `eu` and `gl`, and must not be copied there.

---

## Step 2 — Produce translations

For every unique source text, produce a translation for each target language. Rules:

- **Every translation must start with `~`** — no exceptions, including Spanish.
  Example: source `"Save"` → Spanish `"~Guardar"`, German `"~Speichern"`.
  The prefix means *machine-assisted, not yet reviewed by a human*. The reviewer removes it
  to signal acceptance, so a `~` left behind on a single string is a deliberate flag that
  that one still needs a decision. Never remove a `~` yourself.
- Translate faithfully. Keep the same tone, punctuation, and placeholders as the source.
- Ellipsis (`...`) stays as-is; do not convert to `…`.
- Do not translate proper nouns: `eXeLearning`, `iDevice`, `SCORM`, `Yjs`.
- Valencian (`va`) and Catalan (`ca`) are distinct — do not reuse one for the other.
  Real markers to apply: `esta`/`este` vs `aquesta`/`aquest`, `ací` vs `aquí`, `estiga` vs
  `estigui`, `afig` vs `afegeix`, `coincidixen` vs `coincideixen`, infinitive (`Canviar`) vs
  imperative (`Canvia`), and the typographic apostrophe `’` in `va` against the straight `'`
  that predominates in `ca`. Strings where the two languages genuinely coincide may be
  identical — that is not the same as copying one into the other.
- **Resolve ambiguous UI strings from the source code, not from intuition.** `Search icon`
  is a search-field placeholder (`blockNode.js`: `search.placeholder = _('Search icon')`),
  not "icon for searching"; `Style icons` and `General icons` are section headings. One
  `grep` settles what a label actually does.

---

## Step 3 — Apply translations (encoding-critical)

### Why never a `.ps1` script

PowerShell 5.1 (Windows) reads `.ps1` script files as ANSI (Windows-1252) by default. Writing a `.ps1` file with the Write tool produces UTF-8 without BOM, which PS 5.1 misreads — corrupting every non-ASCII character silently. **Never write translations to a `.ps1` file and execute it.**

The fix: run the substitution as an **inline PowerShell command** passed directly to the PowerShell tool. Inline commands are received as Unicode strings (UTF-16LE) and are unaffected by the file-encoding issue.

The rule is about *scripts PowerShell parses*, not about every file. Translation text held in a
JSON **data** file you decode yourself with an explicit `UTF8Encoding` is safe, and is the way
to get past the inline length limit — see [Data-file route](#data-file-route-for-a-full-run-across-many-languages).
Either way, the encoding verification below is not optional.

### Substitution template

For each language file, build one inline PowerShell command that:

1. Reads the file as UTF-8 without BOM
2. Detects the actual line ending (CRLF or LF)
3. Replaces each `<source>SRC</source>LE<target></target>` with `<source>SRC</source>LE<target>~TRANSLATION</target>`
4. Writes back as UTF-8 without BOM

```powershell
$enc = New-Object System.Text.UTF8Encoding $false
$file = "C:\...\translations\messages.LANG.xlf"
$content = [System.IO.File]::ReadAllText($file, $enc)
$le = if ($content.Contains("`r`n")) { "`r`n" } else { "`n" }

# One block per source text:
$old = "        <source>SOURCE TEXT</source>$le        <target></target>"
$new = "        <source>SOURCE TEXT</source>$le        <target>~TRANSLATION</target>"
if ($content.Contains($old)) { $content = $content.Replace($old, $new) }

# ... repeat for each source text ...

[System.IO.File]::WriteAllText($file, $content, $enc)
Write-Host "Done"
```

Key points:
- 8 spaces before `<source>` and `<target>` — match exactly (do not guess indentation; verify from the file).
- Use `.Contains()` + `.Replace()` — not regex — for literal source texts.
- Use `$le` variable so the replacement works on both CRLF and LF files. **Detect it, do not
  assume it.** `cat -A` through git-bash strips the CR and will tell you a CRLF file is LF;
  settle it in PowerShell with `$content.Contains("`r`n")`, which is what the substitution
  actually depends on.
- Anchor every replacement on the `<source>` line. Never replace a bare
  `<target>VALUE</target>`: the same value legitimately appears under several sources, and a
  bare replace hits all of them.
- Always report per-source hit/miss counts (`applied` / `MISS <source>`), and check the total
  against the number of empty targets you found in Step 1.

### Two mechanical traps

**Never put a single pair in one command.** PowerShell collapses a one-element array, so
`@( @('src','tgt') )` becomes the flat two-element array `@('src','tgt')`, the loop iterates
over the two strings instead of the pair, and `$p[0]` yields the first *character*. The
symptom is `NO MATCH: A` / `NO MATCH: ~`. Nothing is written (the file is rewritten
unchanged), but the run silently does nothing. Use `$pairs = ,@('src','tgt')` or batch at
least two pairs.

**Long inline commands are rejected.** Past roughly 1,800 characters the tool aborts with a
misleading `Remove-Item on system path '/' is blocked` even though the command contains no
`Remove-Item`. It is the command length, not its content — the same pairs split in half both
succeed. Keep inline batches to about 4–5 short strings, or use the data-file route below.

### Data-file route (for a full run across many languages)

27 strings × 10 languages does not fit in inline batches. Write the translations to a **JSON
data file** and apply it with one short command:

```powershell
$enc = New-Object System.Text.UTF8Encoding $false
$data = [System.IO.File]::ReadAllText($json, $enc) | ConvertFrom-Json
$base = "C:\...\translations\messages.{0}.xlf"
foreach ($lang in $data.PSObject.Properties.Name) {
    $file = $base -f $lang
    $content = [System.IO.File]::ReadAllText($file, $enc)
    $le = if ($content.Contains("`r`n")) { "`r`n" } else { "`n" }
    $applied = 0
    foreach ($prop in $data.$lang.PSObject.Properties) {
        $old = "        <source>" + $prop.Name + "</source>" + $le + "        <target></target>"
        $new = "        <source>" + $prop.Name + "</source>" + $le + "        <target>" + $prop.Value + "</target>"
        if ($content.Contains($old)) { $content = $content.Replace($old, $new); $applied++ }
        else { Write-Host ("  MISS [$lang] " + $prop.Name) }
    }
    [System.IO.File]::WriteAllText($file, $content, $enc)
    Write-Host ("{0}: applied={1}" -f $lang, $applied)
}
```

This does **not** reopen the `.ps1` encoding hole. That ban exists because PowerShell 5.1
*parses script files* as ANSI; here the JSON is data whose decoding you control explicitly
with `UTF8Encoding`. Write the JSON with the Write tool (UTF-8, no BOM), keep it out of the
repository (use the scratchpad directory), and run the encoding verification below regardless.

### Encoding verification

After writing, verify at least one file per run by reading back the actual bytes of a translated target containing non-ASCII characters:

```powershell
$enc = New-Object System.Text.UTF8Encoding $false
$content = [System.IO.File]::ReadAllText($file, $enc)
$sample = ($content -split '\r?\n' | Where-Object { $_ -match '<target>~' } | Select-Object -Last 1).Trim()
Write-Host $sample
```

If the output shows garbled characters (e.g., `Ã„` instead of `Ä`), the encoding is wrong — stop, revert using the revert pattern below, and diagnose before continuing.

### Revert pattern (if encoding goes wrong)

```powershell
$enc = New-Object System.Text.UTF8Encoding $false
$file = "C:\...\translations\messages.LANG.xlf"
$content = [System.IO.File]::ReadAllText($file, $enc)
$le = if ($content.Contains("`r`n")) { "`r`n" } else { "`n" }

# For each source text, replace back to empty:
$escaped = [regex]::Escape("SOURCE TEXT")
$pattern = "        <source>$escaped</source>\r?\n        <target>~[^<]*</target>"
$replacement = "        <source>SOURCE TEXT</source>" + $le + "        <target></target>"
$content = [regex]::Replace($content, $pattern, $replacement)

[System.IO.File]::WriteAllText($file, $content, $enc)
```

---

## Step 4 — Verify

After applying all translations:

```powershell
# Count remaining empty targets in each processed file
$langs = @('es','ca','va','de','eo','eu','gl','it','pt','ro')
foreach ($lang in $langs) {
    $file = "C:\...\translations\messages.$lang.xlf"
    $count = (Select-String -Path $file -Pattern '<target></target>' -SimpleMatch).Count
    Write-Host "$lang: $count empty"
}
```

Expected: `0` for every language in scope. If any remain, they were at a line before the specified start line (expected) or the pattern did not match (investigate).

---

## Constraints (non-negotiable)

- **Only empty `<target></target>` are modified** — never touch non-empty targets, source texts, IDs, resnames, indentation, line endings, or any other attribute.
  The single exception is a pre-existing defect you surfaced in Step 1.5 — two sources in one
  graded scale sharing a translation, say — and even then only after the user has explicitly
  asked for it. Report such a defect; do not fix it on your own initiative. When authorised,
  the corrected target gets a `~` like any other unreviewed string.
- **`~` prefix is mandatory** on every translation, including Spanish.
- **`messages.en.xlf` is never opened or written.**
- **`make translations` is never run** as part of this skill.
- **No `.ps1` files** — inline PowerShell only (see encoding section above).
- The diff must show only `<target>~...</target>` lines changing; everything else stays byte-for-byte identical.
