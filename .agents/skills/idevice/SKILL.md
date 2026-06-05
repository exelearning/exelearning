---
name: idevice
description: Creating or modifying interactive devices in public/files/perm/idevices/base/. Every change must ship with colocated Vitest `*.test.js` coverage for edition and export logic, keep patch coverage ≥ 90% on changed lines, include a Playwright spec exercising the iDevice in the workarea and preview, and pass `make fix`, `make test-unit`, `make test-integration`, and `make test-e2e` before submission.
---

# Skill: iDevice

> Parent: [AGENTS.md](../../../AGENTS.md) | Related: [frontend-module](../frontend-module/SKILL.md), [exporter](../exporter/SKILL.md)

## When to Use

Creating or modifying interactive devices (iDevices) in `public/files/perm/idevices/base/`.

## Key Files

- `public/files/perm/idevices/base/<name>/` — iDevice root directory
- `public/files/perm/idevices/base/<name>/config.xml` — metadata (title, css-class, category, icon)
- `public/files/perm/idevices/base/<name>/edition/` — editor UI (JS + CSS)
- `public/files/perm/idevices/base/<name>/export/` — export rendering (JS + CSS)
- `public/files/perm/idevices/base/<name>/*-icon.svg` — icon asset
- `public/app/workarea/idevices/idevicesList.js` — iDevice registry
- `public/app/workarea/idevices/idevicesManager.js` — iDevice lifecycle management

**Reference iDevices** (well-tested, good to study): `checklist`, `rubric`, `geogebra-activity`

## Structure

```
public/files/perm/idevices/base/<name>/
├── config.xml              # Metadata: title, css-class, category, icon
├── <name>-icon.svg         # Icon
├── edition/
│   ├── <name>.js           # Editor JS
│   ├── <name>.test.js      # Editor tests
│   └── <name>.css          # Editor styles (optional)
└── export/
    ├── <name>.js           # Export rendering JS
    ├── <name>.test.js      # Export tests
    └── <name>.css          # Export styles (optional)
```

## Testing — Round-Trip Is Mandatory

Every iDevice **must** have a round-trip test: save data → load data → verify all fields are preserved. This is the #1 source of iDevice bugs — fields silently disappear when `loadData()` doesn't restore what `save()` stored. _Example: PR #1581._

### Edition Test Pattern

```javascript
import { describe, it, expect, beforeEach } from 'vitest';

describe('my-idevice edition', () => {
    let idevice;
    beforeEach(async () => {
        document.body.innerHTML = '<div id="idevice-container"></div>';
        idevice = await global.loadIdevice('public/files/perm/idevices/base/my-idevice/edition/my-idevice.js');
    });

    it('round-trip: save then load preserves all fields', () => {
        // Set up editor state
        idevice.init(container, { title: 'Test', content: '<p>Hello</p>' });
        // Save
        const saved = idevice.save();
        // Load into fresh instance
        idevice.init(container, {});
        idevice.loadData(saved);
        // Verify ALL fields
        expect(idevice.getTitle()).toBe('Test');
        expect(idevice.getContent()).toContain('Hello');
    });
});
```

### Export Test Pattern

```javascript
function loadExportIdevice(code) {
    const modifiedCode = code
        .replace(/var\s+\$myidevice\s*=/, 'global.$myidevice =')
        .replace(/\$\(function\s*\(\)\s*\{\s*\}\);?\s*$/g, '');
    (0, eval)(modifiedCode);
    return global.$myidevice;
}
```

## Commands

```bash
npx vitest run public/files/perm/idevices/base/<name>/edition/<name>.test.js
npx vitest run public/files/perm/idevices/base/<name>/export/<name>.test.js
make fix
```

## Gotchas

- **Round-trip data loss** — the #1 iDevice bug. If `save()` stores a field, `loadData()` must restore it. Always test `load(save(data)) === data` for every field. _Example: PR #1581._
- **Legacy metadata formats** — old iDevices may store data in fewer fields than current format. Tests must verify both old and new formats work.
- **Extra wrapper divs on re-import** — `IdeviceRenderer` wraps text in `<div class="exe-text">`. If your iDevice stores this HTML and re-imports it, wrappers accumulate. Normalize on import. _Example: PR #1559._
- **Missing `config.xml`** or wrong `<css-class>` — must match folder name convention.
- **Both `edition/` and `export/` are required** — missing either causes silent failures.
- **Icon naming** — must follow `<name>-icon.svg` pattern.
- **Use `escape()` for metadata persistence** — some iDevices use `escape()` for special characters in saved data. Be consistent with the existing pattern.

## Done When

- [ ] `config.xml` with correct title, css-class, category, icon
- [ ] `edition/<name>.js` with `.test.js` including round-trip test
- [ ] `export/<name>.js` with `.test.js`
- [ ] Icon SVG present (`<name>-icon.svg`)
- [ ] Legacy format compatibility tested if modifying an existing iDevice
- [ ] Tests pass via `npx vitest run`
- [ ] `make fix` passes clean
