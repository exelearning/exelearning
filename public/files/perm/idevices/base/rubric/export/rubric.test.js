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
