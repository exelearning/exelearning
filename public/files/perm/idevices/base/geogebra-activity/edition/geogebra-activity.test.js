/**
 * Unit tests for GeoGebra activity iDevice (edition)
 */

/* eslint-disable no-undef */

import { readFileSync } from 'fs';
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

  it('populates shared progressBar fields when auto-geogebra-evaluation-id is set', () => {
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
      <input id="geogebraActivityShowTitle" type="checkbox" />
      <input id="geogebraActivityShowAuthor" type="checkbox" />
      <input id="eXeProgressReport" type="checkbox" />
      <input id="eXeProgressReportID" disabled value="" />
    `;

    $exeDevice.idevicePreviousData = `
      <div class="auto-geogebra auto-geogebra-VgHhQXCC auto-geogebra-evaluation-id-myReport123 auto-geogebra-ideviceid-id1"></div>
    `;

    $exeDevice.loadPreviousValues();

    expect($('#eXeProgressReport').prop('checked')).toBe(true);
    expect($('#eXeProgressReportID').val()).toBe('myReport123');
    expect($('#eXeProgressReportID').prop('disabled')).toBe(false);
  });

  it('does not enable progressBar when evaluation id is 0', () => {
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
      <input id="geogebraActivityShowTitle" type="checkbox" />
      <input id="geogebraActivityShowAuthor" type="checkbox" />
      <input id="eXeProgressReport" type="checkbox" />
      <input id="eXeProgressReportID" disabled value="" />
    `;

    $exeDevice.idevicePreviousData = `
      <div class="auto-geogebra auto-geogebra-VgHhQXCC auto-geogebra-evaluation-id-0"></div>
    `;

    $exeDevice.loadPreviousValues();

    expect($('#eXeProgressReport').prop('checked')).toBe(false);
    expect($('#eXeProgressReportID').val()).toBe('');
  });

  describe('display size controls', () => {
    function buildSizeFieldsDom() {
      return `
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
        <input id="geogebraActivityShowTitle" type="checkbox" />
        <input id="geogebraActivityShowAuthor" type="checkbox" />
        <input id="geogebraActivityEvaluation" type="checkbox" />
        <input id="geogebraActivityEvaluationID" value="" />
        <input id="geogebraActivityWidth" />
        <input id="geogebraActivityHeight" />
      `;
    }

    it('renders createForm() with the size controls visible (not hidden)', () => {
      document.body.innerHTML = '<div id="geogebra_body_create_form"></div>';
      $exeDevice.ideviceBody = document.getElementById('geogebra_body_create_form');

      globalThis.$exeDevicesEdition.iDevice.common = {
        getIdeviceDescription: vi.fn(() => '<div class="alert alert-info"></div>'),
        getTextFieldset: vi.fn(() => ''),
      };

      $exeDevice.createForm();

      const sizeBlock = $exeDevice.ideviceBody.querySelector('#geogebraActivitySize');
      expect(sizeBlock).not.toBeNull();
      expect(sizeBlock.classList.contains('d-none')).toBe(false);
      expect(sizeBlock.classList.contains('d-flex')).toBe(true);

      const widthInput = $exeDevice.ideviceBody.querySelector('#geogebraActivityWidth');
      const heightInput = $exeDevice.ideviceBody.querySelector('#geogebraActivityHeight');
      expect(widthInput).not.toBeNull();
      expect(heightInput).not.toBeNull();
    });

    it('restores width and height from saved size classes', () => {
      document.body.innerHTML = buildSizeFieldsDom();

      $exeDevice.idevicePreviousData = `
        <div class="auto-geogebra auto-geogebra-VgHhQXCC auto-geogebra-width-800 auto-geogebra-height-600"></div>
      `;

      $exeDevice.loadPreviousValues();

      expect($('#geogebraActivityWidth').val()).toBe('800');
      expect($('#geogebraActivityHeight').val()).toBe('600');
    });

    it('leaves width and height empty for legacy content without explicit size classes', () => {
      document.body.innerHTML = buildSizeFieldsDom();

      $exeDevice.idevicePreviousData = `
        <div class="auto-geogebra auto-geogebra-VgHhQXCC"></div>
      `;

      $exeDevice.loadPreviousValues();

      expect($('#geogebraActivityWidth').val()).toBe('');
      expect($('#geogebraActivityHeight').val()).toBe('');
    });

    function buildSaveDom({ width, height }) {
      return `
        <input id="geogebraActivityLang" value="en" />
        <input id="geogebraActivityURL" value="VgHhQXCC" />
        <input id="geogebraActivitySCORM" type="checkbox" />
        <input id="geogebraActivityBorderColor" value="" />
        <input id="geogebraActivityScale" value="100" />
        <input id="geogebraActivityWeight" value="100" />
        <input id="geogebraActivityWidth" value="${width}" />
        <input id="geogebraActivityHeight" value="${height}" />
        <span id="geogebraActivityAuthorURL"></span>
        <span id="geogebraActivityTitle"></span>
      `;
    }

    it('save() emits auto-geogebra-width/height classes for provided values', () => {
      document.body.innerHTML = buildSaveDom({ width: '800', height: '600' });

      const previousEditors = global.tinymce.editors;
      global.tinymce.editors = [{ getContent: () => '' }, { getContent: () => '' }];

      try {
        const html = $exeDevice.save();
        expect(html).toContain('auto-geogebra-width-800');
        expect(html).toContain('auto-geogebra-height-600');
      } finally {
        global.tinymce.editors = previousEditors;
      }
    });

    it('save() omits size classes when width and height are left blank', () => {
      document.body.innerHTML = buildSaveDom({ width: '', height: '' });

      const previousEditors = global.tinymce.editors;
      global.tinymce.editors = [{ getContent: () => '' }, { getContent: () => '' }];

      try {
        const html = $exeDevice.save();
        expect(html).not.toContain('auto-geogebra-width-');
        expect(html).not.toContain('auto-geogebra-height-');
      } finally {
        global.tinymce.editors = previousEditors;
      }
    });
  });

  /**
   * This iDevice stores nothing as JSON: its options live as CSS classes on its
   * own markup. The pass score follows that convention, and the asymmetry is
   * deliberate -- the class is written only for a customised mark, so "global"
   * leaves no trace and content saved before the option existed reads as global
   * without a migration.
   */
  describe('pass score wiring', () => {
    let source;

    beforeEach(() => {
      source = readFileSync(join(__dirname, 'geogebra-activity.js'), 'utf-8');
    });

    it('renders the control immediately above the progress report', () => {
      const passScoreAt = source.indexOf('gamification.passScore.getContents()');
      const progressBarAt = source.indexOf('gamification.progressBar.getContents(');

      expect(passScoreAt).toBeGreaterThan(-1);
      expect(progressBarAt).toBeGreaterThan(-1);
      expect(passScoreAt).toBeLessThan(progressBarAt);
    });

    it('writes a class only for a customised mark', () => {
      expect(source).toContain("if (passScore.passScoreMode === 'custom')");
      expect(source).toContain("css += ' ' + PASS_SCORE_CLASS + passScore.passScoreCustom");
    });

    it('reads the class back as the custom mode', () => {
      expect(source).toContain('gamification.passScore.setValues(');
      expect(source).toContain("passScoreMode: 'custom'");
      expect(source).toContain('part.replace(PASS_SCORE_CLASS');
    });

    it('takes the mark from the shared control when saving', () => {
      expect(source).toContain('gamification.passScore.getValues()');
    });

    it('wires the radio and input handlers', () => {
      expect(source).toContain('gamification.passScore.addEvents()');
    });
  });
});
