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

## Step 2 — Produce translations

For every unique source text, produce a translation for each target language. Rules:

- **Every translation must start with `~`** — no exceptions, including Spanish.
  Example: source `"Save"` → Spanish `"~Guardar"`, German `"~Speichern"`.
- Translate faithfully. Keep the same tone, punctuation, and placeholders as the source.
- Ellipsis (`...`) stays as-is; do not convert to `…`.
- Do not translate proper nouns: `eXeLearning`, `iDevice`, `SCORM`, `Yjs`.
- Valencian (`va`) and Catalan (`ca`) are distinct — do not reuse one for the other.

---

## Step 3 — Apply translations (encoding-critical)

### Why inline PowerShell only

PowerShell 5.1 (Windows) reads `.ps1` script files as ANSI (Windows-1252) by default. Writing a `.ps1` file with the Write tool produces UTF-8 without BOM, which PS 5.1 misreads — corrupting every non-ASCII character silently. **Never write translations to a `.ps1` file and execute it.**

The fix: run the substitution as an **inline PowerShell command** passed directly to the PowerShell tool. Inline commands are received as Unicode strings (UTF-16LE) and are unaffected by the file-encoding issue.

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
- Use `$le` variable so the replacement works on both CRLF and LF files.
- Process all source texts for one language in a single command (not one command per string).
- You may batch multiple language files in a single command if they share the same base path.

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
- **`~` prefix is mandatory** on every translation, including Spanish.
- **`messages.en.xlf` is never opened or written.**
- **`make translations` is never run** as part of this skill.
- **No `.ps1` files** — inline PowerShell only (see encoding section above).
- The diff must show only `<target>~...</target>` lines changing; everything else stays byte-for-byte identical.
