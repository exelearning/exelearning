import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInThisContext } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../../..');

function loadScript(relativePath) {
    const filename = resolve(root, relativePath);
    runInThisContext(readFileSync(filename, 'utf8'), { filename });
}

describe('rubric progress report integration', () => {
    let previousGlobals;
    const globalNames = ['$exe', '$exeDevices', '$exeDevicesEdition', '$exeDevice', '$rubric', '$eXeInforme', 'eXeLearning', 'eXe'];
    const reportId = 'rubric-report';
    const rubricData = {
        id: 'rubric-node',
        title: 'Assessment',
        categories: ['Criterion'],
        scores: ['Excellent', 'Good'],
        descriptions: [[{ text: 'Full marks', weight: '16' }, { text: 'Partial marks', weight: '12' }]],
        evaluation: true,
        evaluationID: reportId,
        passScoreMode: 'custom',
        passScoreCustom: 8,
        isScorm: 0,
    };

    beforeEach(() => {
        previousGlobals = Object.fromEntries(globalNames.map(name => [name, globalThis[name]]));
        globalThis.eXeLearning = { app: { project: { odeId: reportId } } };
        vi.spyOn($.fn, 'ready').mockImplementation(function () { return this; });
        loadScript('public/app/common/common.js');
        loadScript('public/app/common/common_edition.js');
        loadScript('public/files/perm/idevices/base/rubric/edition/rubric.js');
        loadScript('public/files/perm/idevices/base/rubric/export/rubric.js');
        loadScript('public/files/perm/idevices/base/progress-report/export/progress-report.js');
        vi.spyOn($exeDevicesEdition.iDevice.tabs, 'init').mockImplementation(() => {});
        vi.spyOn($exeDevicesEdition.iDevice.gamification.scorm, 'init').mockImplementation(() => {});
        document.body.innerHTML = '<div class="idevice_node rubric" id="rubric-node"><div id="editor"></div></div>';
        localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        Object.assign(globalThis, previousGlobals);
        localStorage.clear();
    });

    function serialize(data = rubricData) {
        return $exeDevice.buildSerializedRubricHTML(data, '', '', {
            includeWrapper: true,
            wrapperClass: 'rubric-IDevice',
        });
    }

    it.each([true, false])('resolves the report icon path before loading activities (editor=%s)', isInExe => {
        const path = isInExe ? '/editor/rubric/export/' : '../idevices/rubric/';
        globalThis.eXe = { app: {
            isInExe: () => isInExe,
            getIdeviceInstalledExportPath: vi.fn(() => path),
        } };
        document.querySelector('.idevice_node.rubric').setAttribute('data-idevice-path', path);
        const load = vi.spyOn($rubric, 'loadGame').mockImplementation(() => {
            const game = $rubric.buildScormGame({ ...rubricData, scope: document.getElementById('editor') });
            expect(game.idevicePath).toBe(path);
        });
        $rubric.init();
        $rubric.init();
        expect(load).toHaveBeenCalledTimes(1);
        expect(eXe.app.getIdeviceInstalledExportPath).toHaveBeenCalledTimes(isInExe ? 1 : 0);
    });

    it('preserves report settings through save and reopen and exposes them to the course map', () => {
        $exeDevice.init(document.getElementById('editor'), serialize(), 'assets/');
        const saved = $exeDevice.save();
        expect(saved).toBeTypeOf('string');
        const payload = $(saved).find('.exe-rubrics-DataGame');
        expect(payload.attr('data-id')).toBe(rubricData.id);
        expect(payload.attr('data-evaluationid')).toBe(reportId);
        expect(payload.attr('data-evaluationb')).toBe('true');
        $exeDevice.init(document.getElementById('editor'), saved, 'assets/');
        expect($exeDevicesEdition.iDevice.gamification.progressBar.getValues()).toEqual({
            evaluation: true, evaluationID: reportId,
        });
        expect($exeDevicesEdition.iDevice.gamification.passScore.getValues()).toEqual({
            passScoreMode: 'custom', passScoreCustom: 8,
        });
        const pages = $eXeInforme.buildNestedPages([{
            odePageId: 'page1', pageName: 'Page', componentId: 'rubric-copy',
            ode_idevice_id: 'rubric-copy', odeIdeviceTypeName: 'rubric', htmlViewer: saved, jsonProperties: null,
        }]);
        expect(pages[0].components[0]).toMatchObject({
            ideviceID: 'rubric-copy', evaluationID: reportId, evaluation: true,
        });
    });

    it('includes the rubric as evaluable when the report reads exported content.xml', () => {
        // Happy DOM does not expose CDATA text; XML-escaped text has the same browser textContent.
        const html = $exeDevice.escapeHtml(serialize());
        const xml = `<ode><odeNavStructures><odeNavStructure>
            <odePageId>page1</odePageId><pageName>Page</pageName><odePagStructures><odePagStructure>
            <odeComponents><odeComponent><odeIdeviceId>rubric-node</odeIdeviceId>
            <odeIdeviceTypeName>rubric</odeIdeviceTypeName><htmlView>${html}</htmlView>
            </odeComponent></odeComponents></odePagStructure></odePagStructures>
            </odeNavStructure></odeNavStructures></ode>`;
        const pages = $eXeInforme.parseOdeXmlToJson(xml);
        expect(pages[0].components[0]).toMatchObject({ evaluationID: reportId, evaluation: true });
        $eXeInforme.options = { evaluationID: reportId, msgs: { msgNoPendientes: '%s activities' } };
        expect($eXeInforme.generateHtmlFromJsonPages(pages)).toContain('data-is-evaluable="true"');
        expect($eXeInforme.options.number).toBe(1);
    });

    it.each([false, undefined])('keeps a rubric with evaluation=%s out of the report', evaluation => {
        const saved = serialize({ ...rubricData, evaluation });
        expect($eXeInforme.getEvaluatioID(saved, null)).toMatchObject({ evaluation: false });
    });

    it('escapes the report and activity identifiers in the serialized attributes', () => {
        const id = 'rubric" data-injected="yes';
        const evaluationID = 'report" data-injected="yes';
        const payload = $(serialize({ ...rubricData, id, evaluationID })).find('.exe-rubrics-DataGame');
        expect(payload.attr('data-id')).toBe(id);
        expect(payload.attr('data-evaluationid')).toBe(evaluationID);
        expect(payload.attr('data-injected')).toBeUndefined();
    });

    it('shows and updates the verdict in the rubric node using the configured threshold', () => {
        document.body.innerHTML = `<div class="idevice_node rubric" id="rubric-node">
            <div class="rubric-IDevice" id="scope"><table><tbody><tr><th>Criterion</th>
            <td><input type="checkbox" value="16"></td>
            <td><input type="checkbox" value="12" checked></td></tr></tbody></table></div></div>`;
        const data = { ...rubricData, scope: document.getElementById('scope'), table: document.querySelector('table') };
        $rubric.updateProgressReport(data, $(data.table));
        const icon = document.querySelector('#rubric-node .Games-ReportIconDiv');
        expect(icon).not.toBeNull();
        expect(icon.textContent).toContain('Activity: Not passed. Score: 7.50');
        expect(JSON.parse(localStorage.getItem(`dataEvaluation-${reportId}`)).activities[0]).toMatchObject({
            id: rubricData.id, score: 7.5, state: 1,
        });
        $(data.table).find('input').prop('checked', false).first().prop('checked', true);
        $rubric.updateProgressReport(data, $(data.table));
        expect(document.querySelectorAll('#rubric-node .Games-ReportIconDiv')).toHaveLength(1);
        expect(document.querySelector('#rubric-node .Games-ReportIconDiv').textContent).toContain('Activity: Passed. Score: 10.00');
    });
});
