/**
 * Unit tests for GeoGebra activity iDevice (export/runtime)
 */

/* eslint-disable no-undef */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
  const modifiedCode = code
    .replace(/var\s+\$geogebraactivity\s*=/, 'global.$geogebraactivity =')
    .replace(/\$\(function\s*\(\)\s*\{\s*\$geogebraactivity\.init\(\);\s*\}\);?\s*$/g, '');

  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$geogebraactivity;
}

describe('geogebra-activity iDevice (export)', () => {
  let $geogebraactivity;

  beforeEach(() => {
    global.$geogebraactivity = undefined;
    document.body.innerHTML = '';

    const filePath = join(__dirname, 'geogebra-activity.js');
    const code = readFileSync(filePath, 'utf-8');
    $geogebraactivity = loadExportIdevice(code);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    global.$geogebraactivity = undefined;
  });

  it('renders title when showTitle is enabled in saved metadata', () => {
    const author = escape('Ada Lovelace');
    const titleUrl = escape('https://www.geogebra.org/m/VgHhQXCC');
    const title = escape('Pendiente de una recta');
    const authLabel = escape('Authorship');
    const titleLabel = escape('Title');

    document.body.innerHTML = `
      <div class="auto-geogebra auto-geogebra-VgHhQXCC">
        <div class="auto-geogebra-author js-hidden">${author},${titleUrl},${title},1,${authLabel},1,${titleLabel}</div>
      </div>
    `;

    $geogebraactivity.activities = $('.auto-geogebra');
    $geogebraactivity.indicator.start();

    const titleNode = document.querySelector('.auto-geogebra-title');
    expect(titleNode).not.toBeNull();
    expect(titleNode.textContent).toContain('Title');
    expect(titleNode.textContent).toContain('Pendiente de una recta');
  });

  it('does not render title when showTitle is disabled', () => {
    const author = escape('Ada Lovelace');
    const titleUrl = escape('https://www.geogebra.org/m/VgHhQXCC');
    const title = escape('Pendiente de una recta');
    const authLabel = escape('Authorship');
    const titleLabel = escape('Title');

    document.body.innerHTML = `
      <div class="auto-geogebra auto-geogebra-VgHhQXCC">
        <div class="auto-geogebra-author js-hidden">${author},${titleUrl},${title},1,${authLabel},0,${titleLabel}</div>
      </div>
    `;

    $geogebraactivity.activities = $('.auto-geogebra');
    $geogebraactivity.indicator.start();

    expect(document.querySelector('.auto-geogebra-title')).toBeNull();
  });

  it('keeps legacy compatibility: 5-field metadata still shows title', () => {
    const author = escape('Ada Lovelace');
    const titleUrl = escape('https://www.geogebra.org/m/VgHhQXCC');
    const title = escape('Pendiente de una recta');
    const authLabel = escape('Authorship');

    document.body.innerHTML = `
      <div class="auto-geogebra auto-geogebra-VgHhQXCC">
        <div class="auto-geogebra-author js-hidden">${author},${titleUrl},${title},1,${authLabel}</div>
      </div>
    `;

    $geogebraactivity.activities = $('.auto-geogebra');
    $geogebraactivity.indicator.start();

    const titleNode = document.querySelector('.auto-geogebra-title');
    expect(titleNode).not.toBeNull();
    expect(titleNode.textContent).toContain('Pendiente de una recta');
  });

  it('renders authorship when showAuthor is enabled', () => {
    const author = escape('Ada Lovelace');
    const titleUrl = escape('https://www.geogebra.org/m/VgHhQXCC');
    const title = escape('Pendiente de una recta');
    const authLabel = escape('Authorship');
    const titleLabel = escape('Title');

    document.body.innerHTML = `
      <div class="auto-geogebra auto-geogebra-VgHhQXCC">
        <div class="auto-geogebra-author js-hidden">${author},${titleUrl},${title},1,${authLabel},1,${titleLabel}</div>
      </div>
    `;

    $geogebraactivity.activities = $('.auto-geogebra');
    $geogebraactivity.indicator.start();

    const authorNode = document.querySelector('.auto-geogebra-author');
    expect(authorNode).not.toBeNull();
    expect(authorNode.textContent).toContain('Authorship');
    expect(authorNode.textContent).toContain('Ada Lovelace');
  });

  it('does not render authorship when showAuthor is disabled', () => {
    const author = escape('Ada Lovelace');
    const titleUrl = escape('https://www.geogebra.org/m/VgHhQXCC');
    const title = escape('Pendiente de una recta');
    const authLabel = escape('Authorship');
    const titleLabel = escape('Title');

    document.body.innerHTML = `
      <div class="auto-geogebra auto-geogebra-VgHhQXCC">
        <div class="auto-geogebra-author js-hidden">${author},${titleUrl},${title},0,${authLabel},1,${titleLabel}</div>
      </div>
    `;

    $geogebraactivity.activities = $('.auto-geogebra');
    $geogebraactivity.indicator.start();

    expect(document.querySelector('.auto-geogebra-author')).toBeNull();
    expect(document.querySelector('.auto-geogebra-title')).not.toBeNull();
  });
});
