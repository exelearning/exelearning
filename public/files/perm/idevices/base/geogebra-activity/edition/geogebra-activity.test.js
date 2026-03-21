/**
 * Unit tests for GeoGebra activity iDevice (edition)
 */

/* eslint-disable no-undef */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('geogebra-activity iDevice (edition)', () => {
  let $exeDevice;

  beforeEach(() => {
    global.$exeDevice = undefined;
    document.body.innerHTML = '';
    $exeDevice = global.loadIdevice(join(__dirname, 'geogebra-activity.js'));
  });

  afterEach(() => {
    global.$exeDevice = undefined;
  });

  it('includes ShowTitle option enabled by default', () => {
    expect($exeDevice.trueFalseOptions.ShowTitle).toBeDefined();
    expect($exeDevice.trueFalseOptions.ShowTitle[1]).toBe(true);
  });

  it('includes ShowAuthor option enabled by default', () => {
    expect($exeDevice.trueFalseOptions.ShowAuthor).toBeDefined();
    expect($exeDevice.trueFalseOptions.ShowAuthor[1]).toBe(true);
  });

  it('restores title link and showTitle flag from saved metadata', () => {
    document.body.innerHTML = `
      <input id="geogebraActivityLang" value="en" />
      <input id="geogebraActivityURL" value="" />
      <input id="geogebraActivitySCORM" type="checkbox" />
      <div id="geogebraActivitySCORMoptions" class="d-none"></div>
      <div id="geogebraActivitySCORMinstructions" class="d-none"></div>
      <div id="geogebraActivityWeightDiv" class="d-none"></div>
      <textarea id="geogebraActivityInstructions"></textarea>
      <textarea id="eXeIdeviceTextAfter"></textarea>
      <span id="geogebraActivityAuthorURL"></span>
      <span id="geogebraActivityTitle"></span>
      <input id="geogebraActivityShowTitle" type="checkbox" checked />
      <input id="geogebraActivityShowAuthor" type="checkbox" checked />
      <input id="geogebraActivityEvaluation" type="checkbox" />
      <input id="geogebraActivityEvaluationID" value="" />
    `;

    const author = escape('Ada Lovelace');
    const titleUrl = escape('https://www.geogebra.org/m/VgHhQXCC');
    const title = escape('Pendiente de una recta');
    const authLabel = escape('Authorship');
    const titleLabel = escape('Title');

    $exeDevice.idevicePreviousData = `
      <div class="auto-geogebra auto-geogebra-VgHhQXCC">
        <div class="auto-geogebra-author js-hidden">${author},${titleUrl},${title},1,${authLabel},0,${titleLabel}</div>
      </div>
    `;

    $exeDevice.loadPreviousValues();

    expect($('#geogebraActivityAuthorURL').text()).toBe('Ada Lovelace');
    expect($('#geogebraActivityTitle a').text()).toBe('Pendiente de una recta');
    expect($('#geogebraActivityTitle a').prop('href')).toContain('/m/VgHhQXCC');
    expect($('#geogebraActivityShowTitle').prop('checked')).toBe(false);
  });

  it('restores showAuthor option from saved classes', () => {
    document.body.innerHTML = `
      <input id="geogebraActivityLang" value="en" />
      <input id="geogebraActivityURL" value="" />
      <input id="geogebraActivitySCORM" type="checkbox" />
      <div id="geogebraActivitySCORMoptions" class="d-none"></div>
      <div id="geogebraActivitySCORMinstructions" class="d-none"></div>
      <div id="geogebraActivityWeightDiv" class="d-none"></div>
      <textarea id="geogebraActivityInstructions"></textarea>
      <textarea id="eXeIdeviceTextAfter"></textarea>
      <span id="geogebraActivityAuthorURL"></span>
      <span id="geogebraActivityTitle"></span>
      <input id="geogebraActivityShowTitle" type="checkbox" checked />
      <input id="geogebraActivityShowAuthor" type="checkbox" checked />
      <input id="geogebraActivityEvaluation" type="checkbox" />
      <input id="geogebraActivityEvaluationID" value="" />
    `;

    $exeDevice.idevicePreviousData = `
      <div class="auto-geogebra auto-geogebra-VgHhQXCC ShowAuthor0">
        <div class="auto-geogebra-author js-hidden">${escape('Ada Lovelace')},${escape('https://www.geogebra.org/m/VgHhQXCC')},${escape('Pendiente de una recta')},0,${escape('Authorship')},1,${escape('Title')}</div>
      </div>
    `;

    $exeDevice.loadPreviousValues();

    expect($('#geogebraActivityShowAuthor').prop('checked')).toBe(false);
  });
});
