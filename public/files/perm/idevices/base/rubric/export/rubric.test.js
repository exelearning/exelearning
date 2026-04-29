/**
 * Unit tests for rubric iDevice (export/runtime)
 */

/* eslint-disable no-undef */
import '../../../../../../../public/vitest.setup.js';

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
  const modifiedCode = code
    .replace(/var\s+\$rubric\s*=/, 'global.$rubric =')
    .replace(/\$\(function\s*\(\)\s*\{[\s\S]*?\}\);?\s*$/, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$rubric;
}

describe('rubric iDevice export', () => {
  let $rubric;

  beforeEach(() => {
    global.$rubric = undefined;

    const filePath = join(__dirname, 'rubric.js');
    const code = readFileSync(filePath, 'utf-8');
    $rubric = loadExportIdevice(code);
  });

  it('extractDataGameFromLegacyInterface rebuilds data from legacy table markup', () => {
    document.body.innerHTML = `
      <div class="idevice_node rubric" id="rubric_legacy">
        <div class="rubric">
          <table class="exe-table">
            <caption>Legacy Rubric</caption>
            <thead>
              <tr>
                <th>&nbsp;</th>
                <th>Level 1</th>
                <th>Level 2</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Criteria A</th>
                <td>Desc A1 <span>(1.5)</span></td>
                <td>Desc A2 <span>(2)</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    const data = $rubric.extractDataGameFromLegacyInterface($('#rubric_legacy'));

    expect(data).not.toBeNull();
    expect(data.title).toBe('Legacy Rubric');
    expect(data.categories).toEqual(['Criteria A']);
    expect(data.scores).toEqual(['Level 1', 'Level 2']);
    expect(data.descriptions[0][0]).toEqual({ text: 'Desc A1', weight: '1.5' });
    expect(data.descriptions[0][1]).toEqual({ text: 'Desc A2', weight: '2' });
  });

  it('rebuildMissingDataGameFromInterface migrates legacy rubric and clears old interface artifacts', () => {
    document.body.innerHTML = `
      <div class="idevice_node rubric" id="rubric_migrate">
        <div class="rubric">
          <table class="exe-table">
            <caption>Migrate Me</caption>
            <thead>
              <tr>
                <th>&nbsp;</th>
                <th>L1</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>C1</th>
                <td>D1 <span>(3)</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="exe-rubrics-wrapper">legacy UI</div>
        <div class="exe-rubrics-content">legacy content</div>
      </div>
    `;

    $rubric.rebuildMissingDataGameFromInterface();

    const scope = $('#rubric_migrate');
    const dataNode = scope.find('.exe-rubrics-DataGame').first();

    expect(dataNode.length).toBe(1);
    expect(scope.find('.exe-rubrics-wrapper').length).toBe(0);
    expect(scope.find('.exe-rubrics-content').length).toBe(0);
    expect(scope.find('table.exe-table').length).toBe(0);

    const parsed = JSON.parse(unescape(dataNode.text()));
    expect(parsed.title).toBe('Migrate Me');
    expect(parsed.categories).toEqual(['C1']);
    expect(parsed.scores).toEqual(['L1']);
    expect(parsed.descriptions[0][0]).toEqual({ text: 'D1', weight: '3' });
  });

  it('getLegacyScopesWithoutDataGame excludes already migrated scopes', () => {
    const payload = escape(JSON.stringify({
      title: 'Current',
      categories: ['A'],
      scores: ['L1'],
      descriptions: [[{ text: 'D', weight: '1' }]],
    }));

    document.body.innerHTML = `
      <div class="idevice_node rubric" id="rubric_already_migrated">
        <div class="rubric">
          <div class="exe-rubrics-DataGame js-hidden">${payload}</div>
          <table class="exe-table">
            <tbody><tr><th>A</th><td>D <span>(1)</span></td></tr></tbody>
          </table>
        </div>
      </div>
      <div class="idevice_node rubric" id="rubric_pending">
        <div class="rubric">
          <table class="exe-table">
            <tbody><tr><th>B</th><td>E <span>(2)</span></td></tr></tbody>
          </table>
        </div>
      </div>
    `;

    const scopes = $rubric.getLegacyScopesWithoutDataGame();
    const ids = scopes.map(function () {
      return this.id;
    }).get();

    expect(ids).toContain('rubric_pending');
    expect(ids).not.toContain('rubric_already_migrated');
  });

  it('loadGame auto-migrates legacy rubric markup before rendering', () => {
    document.body.innerHTML = `
      <div class="idevice_node rubric" id="rubric_legacy_autoload">
        <div class="rubric">
          <table class="exe-table">
            <caption>Legacy Autoload</caption>
            <thead>
              <tr>
                <th>&nbsp;</th>
                <th>L1</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>C1</th>
                <td>D1 <span>(2)</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    const createInterfaceSpy = vi.spyOn($rubric, 'createInterface');

    $rubric.loadGame();

    const scope = $('#rubric_legacy_autoload');
    const dataNode = scope.find('.exe-rubrics-DataGame').first();
    expect(dataNode.length).toBe(1);
    expect(scope.find('table.exe-table:not([data-rubric-table-type="export"])').length).toBe(0);
    expect(scope.find('table[data-rubric-table-type="export"]').length).toBe(1);
    expect(createInterfaceSpy).toHaveBeenCalledTimes(1);
  });

  it('loadGame auto-migrates legacy rubric without idevice_node wrapper', () => {
    document.body.innerHTML = `
      <div class="rubric" id="rubric_plain_legacy">
        <table class="exe-table">
          <caption>Legacy Plain</caption>
          <thead>
            <tr>
              <th>&nbsp;</th>
              <th>L1</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>C1</th>
              <td>D1 <span>(1)</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const createInterfaceSpy = vi.spyOn($rubric, 'createInterface');

    $rubric.loadGame();

    const scope = $('#rubric_plain_legacy');
    expect(scope.find('.exe-rubrics-DataGame').length).toBe(1);
    expect(scope.find('table.exe-table:not([data-rubric-table-type="export"])').length).toBe(0);
    expect(scope.find('table[data-rubric-table-type="export"]').length).toBe(1);
    expect(createInterfaceSpy).toHaveBeenCalledTimes(1);
  });

  it('getActivities prioritizes rubric-IDevice scopes over raw DataGame nodes', () => {
    const payload = escape(JSON.stringify({
      title: 'Rubrica',
      categories: ['C1'],
      scores: ['L1'],
      descriptions: [[{ text: 'D1', weight: '1' }]],
    }));

    document.body.innerHTML = `
      <div class="rubric-IDevice" id="rubric_scope_preferred">
        <div class="rubric">
          <div class="exe-rubrics-DataGame js-hidden">${payload}</div>
        </div>
      </div>
      <div id="stray">
        <div class="exe-rubrics-DataGame js-hidden">${payload}</div>
      </div>
    `;

    const scopes = $rubric.getActivities();
    const ids = scopes.map(function () {
      return this.id;
    }).get();

    expect(ids).toEqual(['rubric_scope_preferred']);
  });

  it('loadGame renders multiple rubric activities in the same document without alerting', () => {
    const payloadA = escape(JSON.stringify({
      title: 'Rubrica A',
      categories: ['C1'],
      scores: ['L1'],
      descriptions: [[{ text: 'DA1', weight: '1' }]],
    }));
    const payloadB = escape(JSON.stringify({
      title: 'Rubrica B',
      categories: ['C2'],
      scores: ['L2'],
      descriptions: [[{ text: 'DB1', weight: '2' }]],
    }));

    document.body.innerHTML = `
      <div class="rubric-IDevice" id="rubric_multi_a">
        <div class="rubric">
          <div class="exe-rubrics-DataGame js-hidden">${payloadA}</div>
        </div>
      </div>
      <div class="rubric-IDevice" id="rubric_multi_b">
        <div class="rubric">
          <div class="exe-rubrics-DataGame js-hidden">${payloadB}</div>
        </div>
      </div>
    `;

    const originalAlert = globalThis.alert;
    const alertSpy = vi.fn();
    globalThis.alert = alertSpy;
    const createInterfaceSpy = vi.spyOn($rubric, 'createInterface');

    try {
      $rubric.loadGame();
    } finally {
      globalThis.alert = originalAlert;
    }

    expect(createInterfaceSpy).toHaveBeenCalledTimes(2);
    expect($('#rubric_multi_a').find('.exe-rubrics-wrapper').length).toBe(1);
    expect($('#rubric_multi_b').find('.exe-rubrics-wrapper').length).toBe(1);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('createInterface renders notes first, actions below notes, and authorship at the bottom', () => {
    const scope = $('<div class="idevice_node rubric" id="rubric_layout"></div>');
    const table = $('<table class="exe-table"><tbody><tr><th>A</th><td>B</td></tr></tbody></table>');

    const iface = $rubric.createInterface({
      scope,
      table,
      scopeId: 'rubric_layout',
      strings: {
        activity: 'Activity',
        name: 'Name',
        score: 'Score',
        date: 'Date',
        notes: 'Notes',
        download: 'Download',
        reset: 'Reset',
      },
      raw: {
        author: 'Author Name',
        license: 'CC-BY-SA',
        'visible-info': true,
      },
    });

    const content = iface.find('.exe-rubrics-content').first();
    const childrenClasses = content.children().map(function () {
      return this.className || this.id || this.tagName;
    }).get();

    expect(childrenClasses).toContain('exe-rubrics-actions');
    expect(childrenClasses).toContain('exe-rubrics-authorship');

    const footerIndex = content.children('#exe-rubrics-footer').index();
    const actionsIndex = content.children('.exe-rubrics-actions').index();
    const authorshipIndex = content.children('.exe-rubrics-authorship').index();

    expect(footerIndex).toBeGreaterThan(-1);
    expect(actionsIndex).toBeGreaterThan(footerIndex);
    expect(authorshipIndex).toBeGreaterThan(actionsIndex);
    expect(content.find('.exe-rubrics-authorship').text()).toContain('Author Name / CC BY SA');
  });

  it('createInterface keeps only one rich authorship footer when serialized authorship already exists', () => {
    const scope = $(`
      <div class="idevice_node rubric" id="rubric_authorship_once">
        <div class="rubric-IDevice">
          <div class="rubric">
            <p class="exe-rubrics-authorship">
              <a href="https://example.com" class="author" rel="noopener">CEDEC</a>.
              <span class="title"><em>Rubrica</em></span>
              <span class="license">(<a href="https://creativecommons.org/licenses/" rel="license">CC BY-SA</a>)</span>
            </p>
          </div>
        </div>
      </div>
    `);
    const table = $('<table class="exe-table"><tbody><tr><th>A</th><td>B</td></tr></tbody></table>');

    $rubric.createInterface({
      scope,
      table,
      scopeId: 'rubric_authorship_once',
      strings: {
        activity: 'Activity',
        name: 'Name',
        score: 'Score',
        date: 'Date',
        notes: 'Notes',
        download: 'Download',
        reset: 'Reset',
      },
      raw: {
        author: 'Fallback',
        license: 'CC-BY-SA',
        'visible-info': true,
      },
    });

    const allAuthorship = scope.find('.exe-rubrics-authorship');
    expect(allAuthorship.length).toBe(1);
    expect(allAuthorship.find('a.author').attr('href')).toBe('https://example.com');
    expect(allAuthorship.text()).toContain('CEDEC');
    expect(allAuthorship.text()).toContain('CC BY-SA');
  });

  it('buildAuthorshipFooter escapes author text from raw data payload', () => {
    const html = $rubric.buildAuthorshipFooter({
      author: 'Alice <img src=x onerror=alert(1)>',
      license: 'CC-BY-SA',
      'visible-info': true,
    });

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;

    expect(wrapper.querySelector('img')).toBeNull();
    expect(wrapper.textContent).toContain('Alice');
    expect(wrapper.textContent).toContain('CC BY SA');
  });

  it('createInterface updates rich authorship title with current rubric title', () => {
    const scope = $(`
      <div class="idevice_node rubric" id="rubric_authorship_title_sync">
        <div class="rubric-IDevice">
          <div class="rubric">
            <p class="exe-rubrics-authorship">
              <a href="https://example.com" class="author" rel="noopener">CEDEC</a>.
              <span class="title"><em>Titulo antiguo</em></span>
              <span class="license">(<a href="https://creativecommons.org/licenses/" rel="license">CC BY-SA</a>)</span>
            </p>
          </div>
        </div>
      </div>
    `);
    const table = $('<table class="exe-table"><tbody><tr><th>A</th><td>B</td></tr></tbody></table>');

    $rubric.createInterface({
      scope,
      table,
      scopeId: 'rubric_authorship_title_sync',
      strings: {
        activity: 'Activity',
        name: 'Name',
        score: 'Score',
        date: 'Date',
        notes: 'Notes',
        download: 'Download',
        reset: 'Reset',
      },
      raw: {
        title: 'Titulo nuevo',
        author: 'Fallback',
        license: 'CC-BY-SA',
        'visible-info': true,
      },
    });

    const authorship = scope.find('.exe-rubrics-authorship').first();
    expect(authorship.length).toBe(1);
    expect(authorship.find('.title em').text()).toBe('Titulo nuevo');
    expect(authorship.find('a.author').attr('href')).toBe('https://example.com');
  });

  it('createInterface escapes injected i18n strings in labels and buttons', () => {
    const scope = $('<div class="idevice_node rubric" id="rubric_escape_strings"></div>');
    const table = $('<table class="exe-table"><tbody><tr><th>A</th><td>B</td></tr></tbody></table>');

    $rubric.createInterface({
      scope,
      table,
      scopeId: 'rubric_escape_strings',
      strings: {
        activity: '<img src=x onerror=alert(1)>',
        name: '<script>alert(1)</script>Name',
        score: 'Score',
        date: 'Date',
        notes: 'Notes',
        download: '<b>Download</b>',
        reset: '<i>Reset</i>',
      },
      raw: {},
    });

    expect(scope.find('script').length).toBe(0);
    expect(scope.find('img').length).toBe(0);
    expect(scope.find('label[for^="rubric-activity-"]').text()).toContain('<img src=x onerror=alert(1)>');
    expect(scope.find('.exe-rubrics-download').text()).toBe('<b>Download</b>');
    expect(scope.find('.exe-rubrics-reset').text()).toBe('<i>Reset</i>');
  });

  it('prepareInteractiveTable keeps caption visible in export', () => {
    const table = $rubric.createTableFromData({
      title: 'Titulo de Rubrica',
      categories: ['C1'],
      scores: ['L1'],
      descriptions: [[{ text: 'D1', weight: '1' }]],
    });

    $rubric.prepareInteractiveTable(table, 'rubric_caption', $rubric.ci18n);

    expect(table.find('caption').length).toBe(1);
    expect(table.find('caption').text()).toContain('Titulo de Rubrica');
  });

  it('prepareInteractiveTable adds accessible aria-label to criterion checkboxes', () => {
    const table = $rubric.createTableFromData({
      title: 'Rubrica',
      categories: ['Comprension'],
      scores: ['Nivel alto'],
      descriptions: [[{ text: 'Descriptor', weight: '3' }]],
    });

    $rubric.prepareInteractiveTable(table, 'rubric_aria', {
      ...$rubric.ci18n,
      apply: 'Apply',
    });

    const checkbox = table.find('tbody input[type="checkbox"]').first();
    expect(checkbox.length).toBe(1);
    expect(checkbox.attr('aria-label')).toBe('Apply: Comprension / Nivel alto');
  });

  it('createTableFromData strips dangerous descriptor tags but keeps allowed formatting', () => {
    const table = $rubric.createTableFromData({
      title: 'Rubrica',
      categories: ['C1'],
      scores: ['L1'],
      descriptions: [[{
        text: '<b>Bold</b><script>alert(1)</script><img src=x onerror=alert(1)><u>Under</u>',
        weight: '2',
      }]],
    });

    const cellHtml = table.find('tbody td').first().html();
    expect(cellHtml).toContain('<b>Bold</b>');
    expect(cellHtml).toContain('<u>Under</u>');
    expect(cellHtml).not.toContain('<script>');
    expect(cellHtml).not.toContain('<img');
  });

  it('renderTableScore shows normalized format as 10 (24/24)', () => {
    const scope = $(`
      <div class="idevice_node rubric" id="rubric_score_format">
        <div class="exe-rubrics-content">
          <input type="text" data-rubric-field="score" />
        </div>
      </div>
    `);

    const table = $rubric.createTableFromData({
      title: 'Rubrica',
      categories: ['C1', 'C2'],
      scores: ['L1', 'L2'],
      descriptions: [
        [
          { text: 'D11', weight: '12' },
          { text: 'D12', weight: '6' },
        ],
        [
          { text: 'D21', weight: '12' },
          { text: 'D22', weight: '6' },
        ],
      ],
    });

    scope.find('.exe-rubrics-content').append(table);
    $rubric.prepareInteractiveTable(table, 'rubric_score_format', $rubric.ci18n);

    table.find('#criteria-rubric_score_format-0-0').prop('checked', true);
    table.find('#criteria-rubric_score_format-1-0').prop('checked', true);

    const score = $rubric.calculateTableScore(table);
    $rubric.renderTableScore(table, score);

    expect(score).toBe(24);
    expect(scope.find('[data-rubric-field="score"]').val()).toBe('10 (24/24)');
  });

  it('buildCaptureTarget includes authorship so it appears in generated PDF', () => {
    document.body.innerHTML = `
      <div class="idevice_node rubric" id="rubric_pdf_authorship">
        <div class="exe-rubrics-content" data-rubric-content="rubric_pdf_authorship">
          <div id="exe-rubrics-header"><p>Header</p></div>
          <table class="exe-table exe-rubrics-export-table"><tbody><tr><th>A</th><td>B</td></tr></tbody></table>
          <div id="exe-rubrics-footer"><p>Footer</p></div>
          <p class="exe-rubrics-authorship">CEDEC / CC BY-SA</p>
        </div>
      </div>
    `;

    const table = $('#rubric_pdf_authorship table').first();
    const capture = $rubric.buildCaptureTarget(table);

    expect(capture).not.toBeNull();
    expect(capture.querySelector('.exe-rubrics-authorship')).not.toBeNull();
    expect(capture.querySelector('.exe-rubrics-authorship').textContent).toContain('CEDEC / CC BY-SA');

    if (capture && capture.parentNode) {
      capture.parentNode.removeChild(capture);
    }
  });

  it('buildCaptureTarget aligns checkbox to exact bottom-right in capture shell', () => {
    document.body.innerHTML = `
      <div class="idevice_node rubric" id="rubric_pdf_checkbox_alignment">
        <div class="exe-rubrics-content" data-rubric-content="rubric_pdf_checkbox_alignment">
          <div id="exe-rubrics-header"><p>Header</p></div>
          <table class="exe-table exe-rubrics-export-table">
            <tbody>
              <tr>
                <th>A</th>
                <td style="position: relative;">Texto <input type="checkbox" checked="checked" style="position: absolute; right: 2px; bottom: 2px;" /></td>
              </tr>
            </tbody>
          </table>
          <div id="exe-rubrics-footer"><p>Footer</p></div>
        </div>
      </div>
    `;

    const table = $('#rubric_pdf_checkbox_alignment table').first();
    const capture = $rubric.buildCaptureTarget(table);

    expect(capture).not.toBeNull();

    const captureCheckbox = capture.querySelector('td input[type="checkbox"]');
    expect(captureCheckbox).not.toBeNull();
    expect(captureCheckbox.style.right).toBe('0px');
    expect(captureCheckbox.style.bottom).toBe('0px');
    expect(captureCheckbox.style.left).toBe('auto');

    if (capture && capture.parentNode) {
      capture.parentNode.removeChild(capture);
    }
  });

  it('addActionEvents removes previous click handlers from download button', () => {
    const scope = $('<div class="idevice_node rubric" id="rubric_download_off_on"></div>');
    const table = $('<table class="exe-table"><tbody><tr><th>A</th><td>B</td></tr></tbody></table>');

    $rubric.createInterface({
      scope,
      table,
      scopeId: 'rubric_download_off_on',
      strings: {
        activity: 'Activity',
        name: 'Name',
        score: 'Score',
        date: 'Date',
        notes: 'Notes',
        download: 'Download',
        reset: 'Reset',
      },
      raw: {},
    });

    const button = scope.find('.exe-rubrics-download').first();
    let legacyCalls = 0;
    button.on('click', () => {
      legacyCalls += 1;
    });

    const saveSpy = vi.spyOn($rubric, 'saveAsPdf').mockImplementation(() => {});

    $rubric.addActionEvents(table, $rubric.ci18n);
    button.trigger('click');

    expect(legacyCalls).toBe(0);
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it('addActionEvents removes previous click handlers from reset button', () => {
    const scope = $('<div class="idevice_node rubric" id="rubric_reset_off_on"></div>');
    const table = $('<table class="exe-table"><tbody><tr><th>A</th><td>B</td></tr></tbody></table>');

    $rubric.createInterface({
      scope,
      table,
      scopeId: 'rubric_reset_off_on',
      strings: {
        activity: 'Activity',
        name: 'Name',
        score: 'Score',
        date: 'Date',
        notes: 'Notes',
        download: 'Download',
        reset: 'Reset',
        msgDelete: 'Confirm reset?',
      },
      raw: {},
    });

    const button = scope.find('.exe-rubrics-reset').first();
    let legacyCalls = 0;
    button.on('click', () => {
      legacyCalls += 1;
    });

    const confirmMock = vi.fn(() => true);
    globalThis.confirm = confirmMock;
    const resetSpy = vi.spyOn($rubric, 'resetRubricData').mockImplementation(() => {});

    $rubric.addActionEvents(table, {
      ...$rubric.ci18n,
      msgDelete: 'Confirm reset?',
    });
    button.trigger('click');

    expect(legacyCalls).toBe(0);
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(resetSpy).toHaveBeenCalledTimes(1);
  });

  it('getPdfFileName uses rubric_name pattern from name field', () => {
    document.body.innerHTML = `
      <div class="idevice_node rubric" id="rubric_filename_name">
        <div class="exe-rubrics-content">
          <div id="exe-rubrics-header">
            <p>
              <input type="text" data-rubric-field="name" value="Juan Perez" />
            </p>
          </div>
          <table class="exe-table exe-rubrics-export-table"><tbody><tr><th>A</th><td>B</td></tr></tbody></table>
        </div>
      </div>
    `;

    const table = $('#rubric_filename_name table').first();
    expect($rubric.getPdfFileName(table)).toBe('rubric_juan_perez.pdf');
  });

  it('getPdfFileName defaults to rubric_name when name field is empty', () => {
    document.body.innerHTML = `
      <div class="idevice_node rubric" id="rubric_filename_default">
        <div class="exe-rubrics-content">
          <div id="exe-rubrics-header">
            <p>
              <input type="text" data-rubric-field="name" value="" />
            </p>
          </div>
          <table class="exe-table exe-rubrics-export-table"><tbody><tr><th>A</th><td>B</td></tr></tbody></table>
        </div>
      </div>
    `;

    const table = $('#rubric_filename_default table').first();
    expect($rubric.getPdfFileName(table)).toBe('rubric_name.pdf');
  });

  it('saveAsPdf uses ensureHtml2Canvas when html2canvas is not available', () => {
    const temp = document.createElement('div');
    temp.setAttribute('data-rubric-capture-temp', '1');
    document.body.appendChild(temp);

    const table = $('<table class="exe-table exe-rubrics-export-table"></table>');

    const originalHtml2Canvas = window.html2canvas;
    window.html2canvas = undefined;

    const buildTargetSpy = vi.spyOn($rubric, 'buildCaptureTarget').mockReturnValue(temp);
    const ensureHtml2CanvasSpy = vi.spyOn($rubric, 'ensureHtml2Canvas').mockImplementation(() => {});

    $rubric.saveAsPdf(table);

    expect(buildTargetSpy).toHaveBeenCalledTimes(1);
    expect(ensureHtml2CanvasSpy).toHaveBeenCalledTimes(1);

    if (temp.parentNode) {
      temp.parentNode.removeChild(temp);
    }
    window.html2canvas = originalHtml2Canvas;
  });
});

describe('getElectronAPI', () => {
  afterEach(() => {
    delete window.electronAPI;
  });

  it('returns window.electronAPI when present', () => {
    const fakeAPI = { saveBufferAs: vi.fn() };
    window.electronAPI = fakeAPI;
    expect($rubric.getElectronAPI()).toBe(fakeAPI);
  });

  it('returns null when no electronAPI exists', () => {
    expect($rubric.getElectronAPI()).toBeNull();
  });
});

describe('saveAsPdf Electron path', () => {
  let mockSaveBufferAs;

  beforeEach(() => {
    mockSaveBufferAs = vi.fn().mockResolvedValue({ saved: true });
    window.electronAPI = { saveBufferAs: mockSaveBufferAs };
  });

  afterEach(() => {
    delete window.electronAPI;
  });

  it('toPdf uses electronAPI.saveBufferAs instead of pdf.save when in Electron', async () => {
    const pdfSaveSpy = vi.fn();
    const fakeBlob = new Blob(['fake-pdf-data'], { type: 'application/pdf' });
    window.jspdf = {
      jsPDF: function () {
        this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
        this.getImageProperties = () => ({ width: 800, height: 600 });
        this.addImage = vi.fn();
        this.addPage = vi.fn();
        this.output = vi.fn().mockReturnValue(fakeBlob);
        this.save = pdfSaveSpy;
      },
    };

    // Stub canvas.toDataURL since happy-dom doesn't support it
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    canvas.toDataURL = () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';

    const temp = document.createElement('div');
    temp.setAttribute('data-rubric-capture-temp', '1');
    document.body.appendChild(temp);

    vi.spyOn($rubric, 'buildCaptureTarget').mockReturnValue(temp);
    window.html2canvas = vi.fn().mockResolvedValue(canvas);

    const table = $('<table class="exe-table exe-rubrics-export-table"></table>');
    $rubric.saveAsPdf(table);

    // Wait for html2canvas promise and FileReader async callback
    await new Promise((r) => setTimeout(r, 300));

    expect(pdfSaveSpy).not.toHaveBeenCalled();
    expect(mockSaveBufferAs).toHaveBeenCalledTimes(1);
    expect(mockSaveBufferAs.mock.calls[0][0]).toBeInstanceOf(Uint8Array);
    expect(mockSaveBufferAs.mock.calls[0][2]).toMatch(/\.pdf$/);

    delete window.jspdf;
    delete window.html2canvas;
    if (temp.parentNode) temp.parentNode.removeChild(temp);
  });

  it('toPng uses electronAPI.saveBufferAs when jsPDF is not available', async () => {
    window.jspdf = undefined;

    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    canvas.toDataURL = () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';

    const temp = document.createElement('div');
    temp.setAttribute('data-rubric-capture-temp', '1');
    document.body.appendChild(temp);

    vi.spyOn($rubric, 'buildCaptureTarget').mockReturnValue(temp);
    window.html2canvas = vi.fn().mockResolvedValue(canvas);

    const table = $('<table class="exe-table exe-rubrics-export-table"></table>');
    $rubric.saveAsPdf(table);

    await new Promise((r) => setTimeout(r, 300));

    expect(mockSaveBufferAs).toHaveBeenCalledTimes(1);
    expect(mockSaveBufferAs.mock.calls[0][0]).toBeInstanceOf(Uint8Array);
    expect(mockSaveBufferAs.mock.calls[0][0].length).toBeGreaterThan(0);
    expect(mockSaveBufferAs.mock.calls[0][2]).toBe('rubric_name.png');

    delete window.html2canvas;
    if (temp.parentNode) temp.parentNode.removeChild(temp);
  });
});

// ============================================================================
// SCORM integration
// ============================================================================

describe('rubric iDevice SCORM integration', () => {
  let $rubric;

  beforeEach(() => {
    global.$rubric = undefined;

    const filePath = join(__dirname, 'rubric.js');
    const code = readFileSync(filePath, 'utf-8');
    $rubric = loadExportIdevice(code);
  });

  function buildScoredTable() {
      // 2 rows x 2 columns, each checkbox carries its own score in value
      return $(`
        <table class="exe-table exe-rubrics-export-table">
          <tbody>
            <tr>
              <th>Row 1</th>
              <td><input type="checkbox" name="r0" data-col-index="0" value="1" /></td>
              <td><input type="checkbox" name="r0" data-col-index="1" value="3" /></td>
            </tr>
            <tr>
              <th>Row 2</th>
              <td><input type="checkbox" name="r1" data-col-index="0" value="2" /></td>
              <td><input type="checkbox" name="r1" data-col-index="1" value="4" /></td>
            </tr>
          </tbody>
        </table>
      `);
    }

    it('getIdeviceDomId returns id from .idevice_node ancestor first', () => {
      document.body.innerHTML = `
        <div class="idevice_node rubric" id="node-id">
          <article id="article-id">
            <div class="rubric" id="scope-id"></div>
          </article>
        </div>
      `;
      expect($rubric.getIdeviceDomId($('#scope-id'))).toBe('node-id');
    });

    it('getIdeviceDomId falls back to own id when no idevice_node ancestor', () => {
      document.body.innerHTML = `<div class="rubric" id="scope-only"></div>`;
      expect($rubric.getIdeviceDomId($('#scope-only'))).toBe('scope-only');
    });

    it('getIdeviceDomId falls back to article id when no node or own id', () => {
      document.body.innerHTML = `
        <article id="article-fallback">
          <div class="rubric"></div>
        </article>
      `;
      expect($rubric.getIdeviceDomId($('article .rubric'))).toBe('article-fallback');
    });

    it('getIdeviceDomId returns empty string when scope has zero or multiple elements', () => {
      expect($rubric.getIdeviceDomId($())).toBe('');
      document.body.innerHTML = `<div class="rubric"></div><div class="rubric"></div>`;
      expect($rubric.getIdeviceDomId($('.rubric'))).toBe('');
    });

    it('bindScopedDelegatedEvent unbinds previous handlers before binding new ones', () => {
      const $root = $('<div></div>');
      $root.append('<span class="target">hit</span>');
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();

      $rubric.bindScopedDelegatedEvent($root, 'click.rubric', '.target', firstHandler);
      $rubric.bindScopedDelegatedEvent($root, 'click.rubric', '.target', secondHandler);

      $root.find('.target').trigger('click');

      expect(firstHandler).not.toHaveBeenCalled();
      expect(secondHandler).toHaveBeenCalledTimes(1);
    });

    it('bindScopedDelegatedEvent handles multiple space-separated events', () => {
      const $root = $('<div></div>');
      $root.append('<input class="target" type="text" />');
      const handler = vi.fn();

      $rubric.bindScopedDelegatedEvent($root, 'change.rubric input.rubric', '.target', handler);
      $root.find('.target').trigger('change');
      $root.find('.target').trigger('input');

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('bindScopedDelegatedEvent is a no-op when $root is null or missing jQuery methods', () => {
      expect(() => $rubric.bindScopedDelegatedEvent(null, 'click', '.x', vi.fn())).not.toThrow();
      expect(() => $rubric.bindScopedDelegatedEvent({}, 'click', '.x', vi.fn())).not.toThrow();
    });

    it('calculateScormScore normalizes raw score to 0-10 scale', () => {
      const table = buildScoredTable();
      // Check max for each row: col index 1 with values 3 and 4 → max = 7
      // Check row 0 col 0 (score 1) and row 1 col 1 (score 4) → raw = 5 → 5/7 * 10 ≈ 7.14
      table.find('input[value="1"]').prop('checked', true);
      table.find('input[value="4"]').prop('checked', true);

      const score = $rubric.calculateScormScore(table);
      expect(score).toBeCloseTo(7.14, 2);
    });

    it('calculateScormScore returns 0 when max score is 0', () => {
      const table = $('<table class="exe-table"><tbody></tbody></table>');
      expect($rubric.calculateScormScore(table)).toBe(0);
    });

    it('calculateScormScore clamps to 10 when all maximums selected', () => {
      const table = buildScoredTable();
      table.find('input[value="3"]').prop('checked', true);
      table.find('input[value="4"]').prop('checked', true);

      const score = $rubric.calculateScormScore(table);
      expect(score).toBe(10);
    });

    it('buildScormGame builds structure with defaults and uses closest idevice_node id', () => {
      const scope = $('<div class="idevice_node rubric" id="rubric-node-42"><div class="rubric"></div></div>');
      document.body.append(scope);

      const data = {
        scope: scope.find('.rubric'),
        scopeId: 'rubric-0',
        strings: { msgYouScore: 'Tu puntuación' },
        isScorm: 2,
        textButtonScorm: 'Guardar',
        repeatActivity: false,
        weighted: 75,
      };

      const game = $rubric.buildScormGame(data);

      expect(game.main).toBe('rubric-node-42');
      expect(game.isScorm).toBe(2);
      expect(game.textButtonScorm).toBe('Guardar');
      expect(game.repeatActivity).toBe(false);
      expect(game.weighted).toBe(75);
      expect(game.scorerp).toBe(0);
      expect(game.gameStarted).toBe(false);
      expect(game.gameOver).toBe(false);
      expect(game.msgs.msgYouScore).toBe('Tu puntuación');
      expect(game.msgs.msgScore).toBeDefined();
    });

    it('buildScormGame applies safe defaults when optional fields missing', () => {
      const scope = $('<div class="rubric" id="scope-raw"></div>');
      document.body.append(scope);

      const game = $rubric.buildScormGame({ scope, scopeId: 'scope-raw', strings: {} });

      expect(game.isScorm).toBe(0);
      expect(game.textButtonScorm).toBe('');
      expect(game.repeatActivity).toBe(true);
      expect(game.weighted).toBe(100);
      expect(game.main).toBe('scope-raw');
    });

    it('getDataForTable returns matching option or null', () => {
      const tableA = $('<table id="ta"></table>').get(0);
      const tableB = $('<table id="tb"></table>').get(0);
      const tableUnknown = $('<table id="tu"></table>').get(0);

      $rubric.options = [
        { table: tableA, label: 'A' },
        { table: tableB, label: 'B' },
      ];

      expect($rubric.getDataForTable(tableB).label).toBe('B');
      expect($rubric.getDataForTable(tableUnknown)).toBeNull();

      $rubric.options = [];
    });

    it('restoreVisibleScoreFromLms applies previous LMS score to the table', () => {
      const table = buildScoredTable();
      document.body.append(
        $('<div class="idevice_node rubric" id="restore-node"><div class="rubric"></div></div>')
          .find('.rubric')
          .append(table)
          .end()
      );

      const renderSpy = vi.spyOn($rubric, 'renderTableScore').mockImplementation(() => {});
      const saveSpy = vi.spyOn($rubric, 'saveRubricData').mockImplementation(() => {});

      const data = {
        table,
        scormGame: { previousScore: '5' }, // 5/10 * maxScore (7) = 3.5
      };

      $rubric.restoreVisibleScoreFromLms(data);

      expect(renderSpy).toHaveBeenCalledTimes(1);
      expect(renderSpy.mock.calls[0][1]).toBeCloseTo(3.5, 2);
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it('restoreVisibleScoreFromLms is a no-op when previousScore is missing or invalid', () => {
      const renderSpy = vi.spyOn($rubric, 'renderTableScore').mockImplementation(() => {});

      $rubric.restoreVisibleScoreFromLms(null);
      $rubric.restoreVisibleScoreFromLms({});
      $rubric.restoreVisibleScoreFromLms({ scormGame: { previousScore: 'not-a-number' } });

      expect(renderSpy).not.toHaveBeenCalled();
    });

    it('initScorm bails when isScorm is 0', () => {
      const registerSpy = vi.fn();
      globalThis.$exeDevices.iDevice.gamification.scorm.registerActivity = registerSpy;

      $rubric.initScorm({ isScorm: 0 });

      expect(registerSpy).not.toHaveBeenCalled();
    });

    it('initScorm registers activity and adds save button for isScorm=2', () => {
      const scope = $('<div class="idevice_node rubric" id="init-node"><div class="rubric"></div></div>');
      document.body.append(scope);

      const table = buildScoredTable();
      const $rubricRoot = scope.find('.rubric');
      $rubricRoot.append('<div class="exe-rubrics-actions"></div>');
      $rubricRoot.append(table);

      const registerSpy = vi.fn();
      globalThis.$exeDevices.iDevice.gamification.scorm.registerActivity = registerSpy;

      const data = {
        scope: $rubricRoot,
        scopeId: 'init-node',
        strings: {},
        table,
        isScorm: 2,
        textButtonScorm: 'Save score',
        repeatActivity: true,
        weighted: 100,
      };

      $rubric.initScorm(data);

      expect(registerSpy).toHaveBeenCalledTimes(1);
      expect(data.scormGame).toBeDefined();
      expect($rubricRoot.find('.exe-rubrics-scorm-save').length).toBe(1);
    });

    it('initScorm does not add save button when isScorm=1', () => {
      const scope = $('<div class="idevice_node rubric" id="init-auto"><div class="rubric"></div></div>');
      document.body.append(scope);

      const table = buildScoredTable();
      const $rubricRoot = scope.find('.rubric');
      $rubricRoot.append('<div class="exe-rubrics-actions"></div>');
      $rubricRoot.append(table);

      globalThis.$exeDevices.iDevice.gamification.scorm.registerActivity = vi.fn();

      $rubric.initScorm({
        scope: $rubricRoot,
        scopeId: 'init-auto',
        strings: {},
        table,
        isScorm: 1,
      });

      expect($rubricRoot.find('.exe-rubrics-scorm-save').length).toBe(0);
    });

    it('addScormSaveButton prepends a button with the configured text', () => {
      const scope = $('<div class="idevice_node rubric" id="btn-scope"><div class="rubric"><div class="exe-rubrics-actions"><button class="existing"></button></div></div></div>');
      document.body.append(scope);

      const table = $('<table></table>');
      scope.find('.rubric').append(table);

      $rubric.addScormSaveButton({
        table,
        textButtonScorm: 'Enviar puntuación',
        strings: {},
      });

      const $btn = scope.find('.exe-rubrics-scorm-save');
      expect($btn.length).toBe(1);
      expect($btn.text()).toBe('Enviar puntuación');
      expect($btn.hasClass('Games-SendScore')).toBe(true);
      // Button must be first child of actions container
      expect(scope.find('.exe-rubrics-actions').children().first().is($btn)).toBe(true);
    });

    it('sendRubricScore calls sendScoreNew with computed score', () => {
      const table = buildScoredTable();
      table.find('input[value="3"]').prop('checked', true);
      table.find('input[value="4"]').prop('checked', true);

      const sendSpy = vi.fn();
      globalThis.$exeDevices.iDevice.gamification.scorm.sendScoreNew = sendSpy;

      const game = { scorerp: 0, gameStarted: false, gameOver: false };
      $rubric.sendRubricScore(false, { table, scormGame: game });

      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy.mock.calls[0][0]).toBe(false);
      expect(sendSpy.mock.calls[0][1].scorerp).toBe(10);
      expect(sendSpy.mock.calls[0][1].gameStarted).toBe(true);
      expect(sendSpy.mock.calls[0][1].gameOver).toBe(false);
    });

    it('sendRubricScore is a no-op when data has no scormGame', () => {
      const sendSpy = vi.fn();
      globalThis.$exeDevices.iDevice.gamification.scorm.sendScoreNew = sendSpy;

      $rubric.sendRubricScore(false, { table: buildScoredTable() });
      $rubric.sendRubricScore(false, null);

      expect(sendSpy).not.toHaveBeenCalled();
    });

    it('resetScormScore zeroes the score and flags gameOver', () => {
      const sendSpy = vi.fn();
      globalThis.$exeDevices.iDevice.gamification.scorm.sendScoreNew = sendSpy;

      const game = { scorerp: 7, gameStarted: true, gameOver: false };
      $rubric.resetScormScore({ isScorm: 1, scormGame: game });

      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy.mock.calls[0][0]).toBe(true);
      expect(sendSpy.mock.calls[0][1].scorerp).toBe(0);
      expect(sendSpy.mock.calls[0][1].gameOver).toBe(true);
    });

    it('resetScormScore is a no-op when isScorm is 0', () => {
      const sendSpy = vi.fn();
      globalThis.$exeDevices.iDevice.gamification.scorm.sendScoreNew = sendSpy;

      $rubric.resetScormScore({ isScorm: 0, scormGame: { scorerp: 5 } });

      expect(sendSpy).not.toHaveBeenCalled();
    });

    it('getGameData includes SCORM fields from stored data', () => {
      const payload = escape(JSON.stringify({
        title: 'Scorm rubric',
        categories: ['C1'],
        scores: ['L1', 'L2'],
        descriptions: [[{ text: 'D1', weight: '1' }, { text: 'D2', weight: '2' }]],
        isScorm: '2',
        textButtonScorm: 'Submit',
        repeatActivity: false,
        weighted: 80,
      }));

      document.body.innerHTML = `
        <div class="rubric-IDevice idevice_node rubric" id="rubric-scorm">
          <div class="rubric">
            <div class="exe-rubrics-DataGame js-hidden">${payload}</div>
          </div>
        </div>
      `;

      const data = $rubric.getGameData($('#rubric-scorm'), 0);

      expect(data.isScorm).toBe(2);
      expect(data.textButtonScorm).toBe('Submit');
      expect(data.repeatActivity).toBe(false);
      expect(data.weighted).toBe(80);
    });

    it('getGameData uses safe defaults when SCORM fields are absent', () => {
      const payload = escape(JSON.stringify({
        title: 'Plain rubric',
        categories: ['C1'],
        scores: ['L1'],
        descriptions: [[{ text: 'D1', weight: '1' }]],
      }));

      document.body.innerHTML = `
        <div class="rubric-IDevice idevice_node rubric" id="rubric-plain">
          <div class="rubric">
            <div class="exe-rubrics-DataGame js-hidden">${payload}</div>
          </div>
        </div>
      `;

      const data = $rubric.getGameData($('#rubric-plain'), 0);

      expect(data.isScorm).toBe(0);
      expect(data.textButtonScorm).toBe('');
      expect(data.repeatActivity).toBe(true);
      expect(data.weighted).toBe(100);
    });
});
