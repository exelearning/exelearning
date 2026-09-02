import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const themesDir = join(here, '..', '..', '..', 'files', 'perm', 'themes', 'base');

const css = readFileSync(join(here, 'exe_effects.css'), 'utf8');

/**
 * Splits a stylesheet into `{ selectors, declarations }` rules.
 *
 * Rules nested in an at-rule are returned too (the at-rule prelude is dropped),
 * which is all these tests need: they only ever look at selectors and at the
 * declarations that belong to them.
 *
 * @param {string} source Stylesheet text.
 * @returns {{selectors: string[], declarations: string}[]} The rules it contains.
 */
function parseRules(source) {
  const rules = [];
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let match = rulePattern.exec(withoutComments);
  while (match !== null) {
    const selectors = match[1]
      .split(',')
      .map((selector) => selector.trim().replace(/\s+/g, ' '))
      .filter((selector) => selector.length > 0 && !selector.startsWith('@'));
    if (selectors.length > 0) {
      rules.push({ selectors: selectors, declarations: match[2].replace(/\s+/g, ' ').trim() });
    }
    match = rulePattern.exec(withoutComments);
  }
  return rules;
}

const rules = parseRules(css);

/**
 * @param {string} selector Selector to look for, exactly as authored.
 * @returns {{selectors: string[], declarations: string}[]} Rules that list it.
 */
function rulesFor(selector) {
  return rules.filter((rule) => rule.selectors.includes(selector));
}

// Interactive controls of every effect. They are links, but not links inside a
// block of text, so they carry no underline and need a focus ring of their own.
const CONTROLS = [
  '.exe-fx .fx-tabs a',
  '.exe-fx .fx-pagination a',
  '.exe-fx .fx-accordion-title',
  '.exe-fx .fx-timeline-expand',
  '.exe-fx .fx-timeline-major h2 a',
];

const FOCUS_RINGS = CONTROLS.concat(['.exe-fx .fx-timeline-minor h3 a']).map(
  (selector) => `${selector}:focus-visible`
);

// Any selector naming a part of an effect, whatever the effect.
const FX_PART = /\.(fx-|exe-accordion|exe-tabs|exe-paginated|exe-carousel|exe-timeline)/;

describe('exe_effects.css', () => {
  it('parses into rules', () => {
    expect(rules.length).toBeGreaterThan(50);
  });

  it('never suppresses the outline of an effect control', () => {
    const suppressed = rules.filter(
      (rule) =>
        rule.selectors.some((selector) => FX_PART.test(selector)) &&
        /outline\s*:\s*(none|0)\b/.test(rule.declarations)
    );
    expect(suppressed.map((rule) => rule.selectors.join(', '))).toEqual([]);
  });

  it.each(FOCUS_RINGS)('draws a focus ring on %s', (selector) => {
    const declarations = rulesFor(selector).map((rule) => rule.declarations);
    expect(declarations.length).toBeGreaterThan(0);
    expect(declarations.join(' ')).toMatch(/outline\s*:\s*2px solid/);
  });

  it('lets a style retint the ring, and never paints it with box-shadow', () => {
    const focusRules = rules.filter((rule) =>
      rule.selectors.some((selector) => selector.endsWith(':focus-visible'))
    );
    expect(focusRules.length).toBeGreaterThan(0);
    for (const rule of focusRules) {
      expect(rule.declarations).toMatch(/outline:2px solid var\(--exe-fx-focus-color,#[0-9a-f]{3,6}\)/);
      // Styles paint these controls with box-shadow: the ring must not take it over.
      expect(rule.declarations).not.toContain('box-shadow');
    }
  });

  it.each(['.exe-tabs .fx-tabs', '.fx-carousel-pagination'])('does not clip the ring of %s', (selector) => {
    for (const rule of rulesFor(selector)) {
      expect(rule.declarations).not.toContain('overflow:');
    }
    expect(rulesFor(selector + ':after')[0].declarations).toContain('clear:both');
  });

  it('lets the ring out of the accordion, which clips its children', () => {
    const [rule] = rulesFor('.js .exe-accordion:has(.fx-accordion-title:focus-visible)');
    expect(rule.declarations).toBe('overflow:visible');
    expect(rulesFor('.js .exe-accordion')[0].declarations).toContain('overflow:hidden');
  });

  it.each(CONTROLS)('leaves %s free of underlines in every state', (selector) => {
    const states = [selector, `${selector}:hover`, `${selector}:focus`];
    for (const state of states) {
      const declarations = rulesFor(state).map((rule) => rule.declarations);
      expect(declarations.join(' ')).toContain('text-decoration:none');
    }
  });

  it('never underlines an effect control', () => {
    const underlined = rules.filter(
      (rule) =>
        rule.selectors.some((selector) => CONTROLS.some((control) => selector.startsWith(control))) &&
        /text-decoration\s*:\s*underline/.test(rule.declarations)
    );
    expect(underlined.map((rule) => rule.selectors.join(', '))).toEqual([]);
  });

  it('keeps the underline on the timeline event headings, which are plain text links', () => {
    const [rule] = rulesFor('.fx-timeline-minor h3 a:hover');
    expect(rule.declarations).toContain('text-decoration:underline');
  });

  it('styles the carousel pagination through .fx-pagination, which its list also carries', () => {
    const duplicated = rules.filter((rule) =>
      rule.selectors.some(
        (selector) => selector === '.fx-carousel-pagination a' || selector === '.fx-carousel-pagination li'
      )
    );
    expect(duplicated.map((rule) => rule.declarations)).toEqual(['font-size:.85em']);
  });
});

describe('bundled styles', () => {
  const styles = readdirSync(themesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  it('finds the bundled styles', () => {
    expect(styles).toContain('base');
    expect(styles).toContain('universal');
  });

  it.each(styles)('%s does not suppress the focus ring of the effects', (style) => {
    const styleRules = parseRules(readFileSync(join(themesDir, style, 'style.css'), 'utf8'));
    const suppressed = styleRules.filter(
      (rule) =>
        rule.selectors.some((selector) => FX_PART.test(selector)) &&
        /outline\s*:\s*(none|0)\b/.test(rule.declarations)
    );
    expect(suppressed.map((rule) => rule.selectors.join(', '))).toEqual([]);
  });

  it.each(styles)('%s keeps the current page chip readable', (style) => {
    const styleRules = parseRules(readFileSync(join(themesDir, style, 'style.css'), 'utf8'));
    // exe_effects.css pairs a dark background with white text on the current chip. A rule
    // recolouring every pagination link outranks that pair, so it would repaint the text
    // but not the background and leave it unreadable on the dark chip.
    const repaintsEveryLink = styleRules.some(
      (rule) =>
        rule.selectors.some((selector) => /\.fx-(pagination|carousel-pagination) a$/.test(selector)) &&
        /(^|;)color:/.test(rule.declarations)
    );
    const restylesTheChip = styleRules.some((rule) =>
      rule.selectors.some((selector) => /\.fx-current a$/.test(selector))
    );
    expect(repaintsEveryLink && !restylesTheChip).toBe(false);
  });

  it.each(['base', 'universal'])('%s recolours the ring through --exe-fx-focus-color', (style) => {
    const source = readFileSync(join(themesDir, style, 'style.css'), 'utf8');
    expect(source).toMatch(/--exe-fx-focus-color:\s*#[0-9a-f]{3,6};/i);
  });
});
