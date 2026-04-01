/**
 * Unit tests for rubric iDevice CSV tools (edition)
 */

/* eslint-disable no-undef */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('rubric iDevice CSV tools (edition)', () => {
  let $exeDevice;

  beforeEach(() => {
    global.$exeDevice = undefined;
    $exeDevice = global.loadIdevice(join(__dirname, 'rubric.js'));
  });

  afterEach(() => {
    global.$exeDevice = undefined;
  });

  it('parseCSVLine handles quoted commas', () => {
    const row = $exeDevice.parseCSVLine('"Criterio, 1",Texto,"Nivel, A"');
    expect(row).toEqual(['Criterio, 1', 'Texto', 'Nivel, A']);
  });

  it('csvToRubricData imports levels and weights from CSV header', () => {
    const csv = [
      'Criterio,Descripción,Excelente (4),Notable (3),Aprobado (2),Insuficiente (1),Peso (%)',
      'Comprensión del contenido,Demuestra entendimiento de los conceptos clave,Demuestra comprensión profunda y completa de todos los conceptos,Comprende la mayoría de los conceptos con pequeñas lagunas,Comprensión básica con lagunas notables,No demuestra comprensión de los conceptos,25',
    ].join('\n');

    const data = $exeDevice.csvToRubricData(csv);

    expect(data.categories).toEqual(['Comprensión del contenido']);
    expect(data.scores).toEqual([
      'Excelente (4)',
      'Notable (3)',
      'Aprobado (2)',
      'Insuficiente (1)',
    ]);
    expect(data.descriptions[0][0].text).toBe(
      'Demuestra comprensión profunda y completa de todos los conceptos'
    );
    expect(data.descriptions[0][0].weight).toBe('4');
    expect(data.descriptions[0][3].weight).toBe('1');
  });

  it('csvToRubricData imports criterion#score as criterion text plus score fallback', () => {
    const csv = [
      'Criterio,Descripción,Nivel A,Nivel B',
      'Claridad#3,Texto base,Desc A,Desc B',
    ].join('\n');

    const data = $exeDevice.csvToRubricData(csv);

    expect(data.categories).toEqual(['Claridad']);
    expect(data.descriptions[0][0].weight).toBe('3');
    expect(data.descriptions[0][1].weight).toBe('3');
  });

  it('csvToRubricData leaves score empty when criterion has no #score and no other weight source', () => {
    const csv = [
      'Criterio,Descripción,Nivel A,Nivel B',
      'Claridad,Texto base,Desc A,Desc B',
    ].join('\n');

    const data = $exeDevice.csvToRubricData(csv);

    expect(data.categories).toEqual(['Claridad']);
    expect(data.descriptions[0][0].weight).toBe('');
    expect(data.descriptions[0][1].weight).toBe('');
  });

  it('importCSV shows success modal when import completes', () => {
    const csv = [
      'Criterio,Descripción,Nivel A',
      'Claridad,Texto base,Descriptor A#4',
    ].join('\n');

    const alertSpy = vi.spyOn($exeDevice, 'alert').mockImplementation(() => {});
    vi.spyOn($exeDevice, 'jsonToTable').mockImplementation(() => {});
    vi.spyOn($exeDevice, 'clearCurrentRubricEdition').mockImplementation(() => {});
    vi.spyOn($exeDevice, 'enableFieldsetToggle').mockImplementation(() => {});
    vi.spyOn($exeDevice, 'setEditionFocus').mockImplementation(() => {});

    $exeDevice.importCSV(csv);

    expect(alertSpy).toHaveBeenCalledWith('CSV imported successfully.');
  });

  it('importCSV shows error modal when CSV is invalid', () => {
    const alertSpy = vi.spyOn($exeDevice, 'alert').mockImplementation(() => {});

    $exeDevice.importCSV('');

    expect(alertSpy).toHaveBeenCalled();
    const firstArg = alertSpy.mock.calls[0][0];
    expect(String(firstArg).length).toBeGreaterThan(0);
  });

  it('importCSV overrides previous caption with c_ fallback title when CSV has no title', () => {
    const csv = [
      'Criterio,Descripción,Nivel A',
      'Claridad,Texto base,Descriptor A#4',
    ].join('\n');

    const originalContentTranslate = global.c_;
    global.c_ = (text) => (text === 'Imported rubric' ? 'Rúbrica importada' : text);

    document.body.innerHTML += '<input id="ri_Cell-0" value="Título anterior" />';

    const jsonToTableSpy = vi.spyOn($exeDevice, 'jsonToTable').mockImplementation(() => {});
    vi.spyOn($exeDevice, 'clearCurrentRubricEdition').mockImplementation(() => {});
    vi.spyOn($exeDevice, 'enableFieldsetToggle').mockImplementation(() => {});
    vi.spyOn($exeDevice, 'setEditionFocus').mockImplementation(() => {});
    vi.spyOn($exeDevice, 'alert').mockImplementation(() => {});

    $exeDevice.importCSV(csv);

    expect(jsonToTableSpy).toHaveBeenCalled();
    const importedData = jsonToTableSpy.mock.calls[0][0];
    expect(importedData.title).toBe('Rúbrica importada');

    global.c_ = originalContentTranslate;
  });

  it('rubricDataToCSV exports a valid CSV matrix', () => {
    const data = {
      title: 'Rubrica test',
      categories: ['Criterio 1'],
      scores: ['Nivel 1', 'Nivel 2'],
      descriptions: [
        [
          { text: 'Desc 1.1', weight: '2' },
          { text: 'Desc 1.2', weight: '1' },
        ],
      ],
    };

    const csv = $exeDevice.rubricDataToCSV(data);

    expect(csv).toContain('Criterio,Descripción,Nivel 1,Nivel 2,Peso (%)');
    expect(csv).toContain('Criterio 1,Desc 1.1#2,Desc 1.1#2,Desc 1.2#1,2');
  });

  it('rubricDataToCSV exports only plain text and excludes buttons', () => {
    const data = {
      title: 'Rubrica test',
      categories: ['<strong>Criterio</strong> <button>Editar</button>'],
      scores: ['<em>Nivel 1</em>'],
      descriptions: [
        [
          {
            text: '<p>Texto <span>visible</span> <button class="btn">Guardar</button></p>',
            weight: '2',
          },
        ],
      ],
    };

    const csv = $exeDevice.rubricDataToCSV(data);

    expect(csv).toContain('Criterio,Descripción,Nivel 1,Peso (%)');
    expect(csv).toContain('Criterio,Texto visible#2,Texto visible#2,2');
    expect(csv).not.toContain('<button');
    expect(csv).not.toContain('Editar');
    expect(csv).not.toContain('Guardar');
  });

  it('rubricDataToCSV keeps existing criterion#score without duplicating row score', () => {
    const data = {
      title: 'Rubrica test',
      categories: ['Criterio base#4'],
      scores: ['Nivel 1'],
      descriptions: [[{ text: 'Descriptor', weight: '2' }]],
    };

    const csv = $exeDevice.rubricDataToCSV(data);

    expect(csv).toContain('Criterio base#4,Descriptor#2,Descriptor#2,2');
    expect(csv).not.toContain('Descriptor#2#2');
  });

  it('tableEditorToJSON reads actual editor inputs, not action labels', () => {
    document.body.innerHTML = `
      <div id="ri_TableEditor">
        <table>
          <caption><input type="text" value="Rubrica" /></caption>
          <thead>
            <tr>
              <th><input type="text" value="" /></th>
              <th>
                <span class="ri_Actions">← → ✎Editar x</span>
                <input type="text" value="Excelente" />
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>
                <span class="ri_Actions">↑ ↓ ✎Editar x</span>
                <input type="text" value="Criterio 1" />
              </th>
              <td>
                <input type="text" value="Descriptor 1" />
                <span><label>Puntuación:</label><input type="text" class="ri_Weight" value="4" /></span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const data = $exeDevice.tableEditorToJSON();

    expect(data.scores).toEqual(['Excelente']);
    expect(data.categories).toEqual(['Criterio 1']);
    expect(data.descriptions[0][0]).toEqual({ text: 'Descriptor 1', weight: '4' });
  });

  it('rubricDataToCSV keeps criterion text and appends score to descriptors', () => {
    const data = {
      title: 'Rubrica test',
      categories: ['Criterio con nota (4)'],
      scores: ['Nivel 1'],
      descriptions: [[{ text: 'Descriptor', weight: '4' }]],
    };

    const csv = $exeDevice.rubricDataToCSV(data);

    expect(csv).toContain('Criterio con nota (4),Descriptor#4,Descriptor#4,4');
  });

  it('csvToRubricData imports descriptor#score into descriptor text and weight', () => {
    const csv = [
      'Criterio,Descripción,Nivel A,Nivel B',
      'Claridad,Desc base#5,Desc A#4,Desc B#2',
    ].join('\n');

    const data = $exeDevice.csvToRubricData(csv);

    expect(data.categories).toEqual(['Claridad']);
    expect(data.descriptions[0][0]).toEqual({ text: 'Desc A', weight: '4' });
    expect(data.descriptions[0][1]).toEqual({ text: 'Desc B', weight: '2' });
  });

  it('csvCriterionText handles score labels with Puntuacion/Score', () => {
    expect($exeDevice.csvCriterionText('Pensamiento critico Puntuacion: 3,5')).toBe('Pensamiento critico#3.5');
    expect($exeDevice.csvCriterionText('Critical Thinking Score: 2')).toBe('Critical Thinking#2');
  });

  it('parseCsvCriterionAndScore parses criterion text and score separated by #', () => {
    expect($exeDevice.parseCsvCriterionAndScore('Organizacion # 4')).toEqual({ text: 'Organizacion', score: '4' });
    expect($exeDevice.parseCsvCriterionAndScore('Organizacion')).toEqual({ text: 'Organizacion', score: '' });
  });

  it('parseCsvDescriptorAndScore parses descriptor text and score separated by #', () => {
    expect($exeDevice.parseCsvDescriptorAndScore('Buen trabajo # 3')).toEqual({ text: 'Buen trabajo', score: '3' });
    expect($exeDevice.parseCsvDescriptorAndScore('Buen trabajo')).toEqual({ text: 'Buen trabajo', score: '' });
  });

  it('isCSVFile accepts only CSV files', () => {
    expect($exeDevice.isCSVFile({ name: 'rubrica.csv', type: '' })).toBe(true);
    expect($exeDevice.isCSVFile({ name: 'rubrica.txt', type: 'text/csv' })).toBe(true);
    expect($exeDevice.isCSVFile({ name: 'rubrica.txt', type: 'text/plain' })).toBe(false);
    expect($exeDevice.isCSVFile({ name: 'rubrica.json', type: 'application/json' })).toBe(false);
  });

  it('removeLegacyRenderedArtifacts removes residual export blocks from idevice root', () => {
    document.body.innerHTML = `
      <div class="idevice_node rubric" id="rubric_1">
        <div class="idevice_body" id="rubric_body"></div>
        <div class="exe-rubrics-wrapper">legacy export UI</div>
        <div class="exe-rubrics-content">legacy content</div>
      </div>
    `;

    $exeDevice.ideviceBody = document.getElementById('rubric_body');
    $exeDevice.removeLegacyRenderedArtifacts();

    expect(document.querySelector('#rubric_1 .exe-rubrics-wrapper')).toBeNull();
    expect(document.querySelector('#rubric_1 .exe-rubrics-content')).toBeNull();
  });

  it('openCellEditModal shows assessment criteria title and performance level from selected cell', () => {
    document.body.innerHTML = `
      <div id="ri_TableEditor"></div>
      <table id="ri_Table">
        <thead>
          <tr>
            <th><input type="text" value="" /></th>
            <th><input type="text" value="Nivel Alto" /></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th><input type="text" value="Contenido" /></th>
            <td>
              <input type="text" value="Descriptor actual" />
              <input type="text" class="ri_Weight" value="4" />
            </td>
          </tr>
        </tbody>
      </table>
    `;

    $exeDevice.ensureCellEditModal();
    const td = $('#ri_Table tbody tr td').first();
    $exeDevice.openCellEditModal(td);

    expect($('#ri_CellEditModalTitle').text()).toBe('Assessment criteria: Contenido');
    expect($('#ri_CellEditPerformanceInfo').text()).toBe('Performance level: Nivel Alto');
    expect($('#ri_CellEditContent').val()).toBe('Descriptor actual');
    expect($('#ri_CellEditScore').val()).toBe('4');
  });

  it('collectRubricStringsFromForm prioritizes current idevice form when duplicated ci18n ids exist', () => {
    document.body.innerHTML = `
      <input id="ci18n_activity" value="Global stale value" />
      <div class="idevice_node rubric" id="rubric_node">
        <div id="rubric_body">
          <div id="ri_IdeviceForm">
            <input id="ci18n_activity" value="Actividad personalizada" />
            <input id="ci18n_name" value="Nombre personalizado" />
          </div>
        </div>
      </div>
    `;

    $exeDevice.ideviceBody = document.getElementById('rubric_body');

    const strings = $exeDevice.collectRubricStringsFromForm();

    expect(strings.activity).toBe('Actividad personalizada');
    expect(strings.name).toBe('Nombre personalizado');
  });

  it('collectRubricStringsFromForm reads all ci18n fields from active form scope', () => {
    document.body.innerHTML = `
      <div class="idevice_node rubric" id="rubric_node_2">
        <div id="rubric_body_2">
          <div id="ri_IdeviceForm">
            <input id="ci18n_activity" value="Act" />
            <input id="ci18n_name" value="Nom" />
            <input id="ci18n_date" value="Fec" />
            <input id="ci18n_score" value="Punt" />
            <input id="ci18n_notes" value="Notas" />
          </div>
        </div>
      </div>
    `;

    $exeDevice.ideviceBody = document.getElementById('rubric_body_2');

    const strings = $exeDevice.collectRubricStringsFromForm();

    expect(strings.activity).toBe('Act');
    expect(strings.name).toBe('Nom');
    expect(strings.date).toBe('Fec');
    expect(strings.score).toBe('Punt');
    expect(strings.notes).toBe('Notas');
  });

  it('applyRowEditModal saves current draft and closes the row modal', () => {
    document.body.innerHTML = `
      <div id="ri_TableEditor"></div>
      <table id="ri_Table">
        <thead>
          <tr>
            <th><input type="text" value="" /></th>
            <th><input type="text" value="Nivel Alto" /></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th><input type="text" value="Contenido" /></th>
            <td>
              <input type="text" value="Descriptor inicial" />
              <input type="text" class="ri_Weight" value="2" />
            </td>
          </tr>
        </tbody>
      </table>
    `;

    $exeDevice.ensureRowEditModal();
    const row = $('#ri_Table tbody tr').first();
    $exeDevice.openRowEditModal(row);

    $('#ri_RowEditContent').val('Descriptor actualizado');
    $('#ri_RowEditScore').val('5');

    $exeDevice.applyRowEditModal();

    const descriptorInput = row.find('td input[type="text"]').not('.ri_Weight').first();
    const scoreInput = row.find('td input.ri_Weight').first();

    expect(descriptorInput.val()).toBe('Descriptor actualizado');
    expect(scoreInput.val()).toBe('5');
    expect($('#ri_RowEditModal').css('display')).toBe('none');
    expect($exeDevice.rowEditState).toBeNull();
  });

  it('getTableHTML does not leak implicit loop variables to global scope', () => {
    delete globalThis.i;
    delete globalThis.z;
    delete globalThis.c;

    $exeDevice.getTableHTML({
      title: 'Rubrica',
      categories: ['C1'],
      scores: ['L1'],
      descriptions: [[{ text: 'D1', weight: '1' }]],
    });

    expect(Object.prototype.hasOwnProperty.call(globalThis, 'i')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(globalThis, 'z')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(globalThis, 'c')).toBe(false);
  });

  it('makeNormal ignores null cells without throwing', () => {
    $exeDevice.cells = null;
    expect(() => $exeDevice.makeNormal()).not.toThrow();
  });

  it('buildRubricAuthorshipHTML sanitizes author, title and unsafe author-url', () => {
    const html = $exeDevice.buildRubricAuthorshipHTML({
      author: 'Alice <img src=x onerror=alert(1)>',
      'author-url': 'javascript:alert(1)',
      title: '<script>alert(1)</script>Unsafe title',
      license: '',
      'visible-info': true,
    });

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;

    expect(wrapper.querySelector('script')).toBeNull();
    expect(wrapper.querySelector('a.author')).toBeNull();
    expect(wrapper.querySelector('.author')?.textContent).toBe('Alice ');
    expect(wrapper.querySelector('.title em')?.textContent).toBe('alert(1)Unsafe title');
  });

  it('jsonToTable keeps quoted author values without breaking the author inputs', () => {
    document.body.innerHTML = '<div id="ri_TableEditor"></div>';
    $exeDevice.editor = $('#ri_TableEditor');

    $exeDevice.jsonToTable({
      title: 'Rubrica',
      categories: ['C1'],
      scores: ['L1'],
      descriptions: [[{ text: 'D1', weight: '1' }]],
      author: 'Author "quoted"',
      'author-url': 'https://example.com/?q="quoted"',
      license: '',
      'visible-info': true,
      i18n: {},
    }, 'edition');

    expect($('#ri_RubricAuthor').val()).toBe('Author "quoted"');
    expect($('#ri_RubricAuthorURL').val()).toBe('https://example.com/?q="quoted"');
  });
});
