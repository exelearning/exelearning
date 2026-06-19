import { test, expect } from '../../fixtures/auth.fixture';
import { waitForAppReady, gotoWorkarea, selectFirstPage, expandIdeviceCategory } from '../../helpers/workarea-helpers';
import type { Page } from '@playwright/test';

/**
 * E2E regression tests for uploading and rendering molecules in the 3Dmol iDevice.
 *
 * 1) File-manager filter: the 3Dmol model picker (input id `dmoleModelFile`)
 *    used to inherit the generic `accept='3d'` filter via the id heuristic in
 *    `legacyExeIdevicesFilePicker` (its id contains "model"). That filter only
 *    recognises triangle-mesh formats (glb/gltf/stl), so uploaded molecule
 *    files (.sdf, .pdb, .mol2, …) were filtered out: the file uploaded but never
 *    showed in the file manager to be selected. The fix gives 3Dmol a dedicated
 *    `data-filemanager-accept="molecule"` filter, leaving the three-d-viewer
 *    mesh filter untouched.
 *
 * 2) Molfile rendering: the iDevice trimmed the raw model data before parsing
 *    and saving. MDL molfiles (SDF/MOL) are line-position sensitive — line 1 is
 *    the title, which is often empty (e.g. OpenBabel output) — so trimming the
 *    leading blank line shifted the counts line and the molecule rendered empty.
 *    The fix keeps the model data raw.
 */

const THREE_DMOL_ID = '3dmol';
const MOLECULE_FIXTURE = 'test/fixtures/sample-molecule.sdf';
const EMPTY_TITLE_MOLECULE_FIXTURE = 'test/fixtures/sample-molecule-empty-title.sdf';

/**
 * Add a 3Dmol iDevice and wait for its edition form.
 *
 * The content node receives the class `3dmol`, an invalid CSS class selector
 * (it starts with a digit), so the menu item is targeted by its `id` attribute
 * instead of the generic `addIdevice()` helper.
 */
async function add3DmolIdevice(page: Page): Promise<void> {
    await expandIdeviceCategory(page, /Science|Ciencia/i);

    const menuItem = page.locator(`.idevice_item[id="${THREE_DMOL_ID}"]`).first();
    await menuItem.waitFor({ state: 'visible', timeout: 10000 });
    await menuItem.click();

    const editForm = page.locator('#dMoleIdeviceForm');
    await editForm.waitFor({ state: 'visible', timeout: 15000 });

    // The form preloads its bundled default model (GLC_ideal.sdf) asynchronously
    // and rebuilds the model row when it lands. Wait for that to settle before
    // interacting, otherwise the rebuild races with the file-manager flow. The
    // loaded model name is reflected in #dmoleModelFileName.
    await expect(page.locator('#dmoleModelFileName')).not.toBeEmpty({ timeout: 20000 });
}

/**
 * Upload a molecule fixture through the 3Dmol model picker and select it.
 * Returns once the file-manager has closed and the input holds an asset:// URL.
 */
async function selectMoleculeViaPicker(page: Page, fixturePath: string): Promise<void> {
    const browseButton = page.locator('input.exe-pick-any-file').first();
    await browseButton.waitFor({ state: 'visible', timeout: 10000 });
    await browseButton.click();

    await page.waitForSelector('#modalFileManager.show, #modalFileManager[data-open="true"]', { timeout: 10000 });

    const fileInput = page.locator('#modalFileManager .media-library-upload-input');
    await fileInput.setInputFiles(fixturePath);

    // The molecule passes the molecule filter and shows up as a selectable item.
    const mediaItem = page.locator('#modalFileManager .media-library-item').first();
    await expect(mediaItem).toBeVisible({ timeout: 15000 });
    await mediaItem.click();

    await page.locator('#modalFileManager .media-library-insert-btn').click();

    // The picker writes an asset:// reference to the model input.
    await page.waitForFunction(
        () => {
            const input = document.querySelector('#dmoleModelFile') as HTMLInputElement | null;
            return !!input && input.value.startsWith('asset://') && input.value.endsWith('.sdf');
        },
        { timeout: 15000 },
    );
}

/** True when the page's browser exposes a WebGL context. */
async function hasWebGL(page: Page): Promise<boolean> {
    return page.evaluate(() => {
        try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch {
            return false;
        }
    });
}

/**
 * Assert the active model parsed to `expected` atoms.
 *
 * With WebGL we read the live 3Dmol viewer (full-fidelity render path). On a
 * GPU-less runner where WebGL is unavailable the iDevice deliberately skips
 * creating the viewer (3dmol.js: `isWebGLAvailable()` guard), so we assert the
 * same invariant on the raw model text the iDevice stores in `#dmoleModelData`
 * *before* that guard. An MDL V2000 molfile keeps its atom count as the first
 * token of the counts line (line index 3); reaching `expected` there proves the
 * leading title line was kept (untrimmed) and that the active model is the
 * intended one — exactly the two regressions these tests cover.
 */
async function expectModelAtomCount(page: Page, expected: number): Promise<void> {
    if (await hasWebGL(page)) {
        const atomCount = await page.waitForFunction(
            () => {
                const dev = (
                    window as { $exeDevice?: { modelViewer?: { selectedAtoms?: (sel: object) => unknown[] } } }
                ).$exeDevice;
                const viewer = dev?.modelViewer;
                if (!viewer || typeof viewer.selectedAtoms !== 'function') {
                    return false;
                }
                const count = viewer.selectedAtoms({}).length;
                return count > 0 ? count : false;
            },
            { timeout: 20000 },
        );
        expect(await atomCount.jsonValue()).toBe(expected);
        return;
    }

    const atomCount = await page.waitForFunction(
        exp => {
            const ta = document.querySelector('#dmoleModelData') as HTMLTextAreaElement | null;
            const lines = (ta?.value ?? '').split(/\r?\n/);
            const count = Number.parseInt((lines[3] ?? '').trim().split(/\s+/)[0] ?? '', 10);
            return count === exp ? count : false;
        },
        expected,
        { timeout: 20000 },
    );
    expect(await atomCount.jsonValue()).toBe(expected);
}

test.describe('3Dmol iDevice — molecule upload via file manager', () => {
    test('model picker opts into the molecule file-manager filter', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        const projectUuid = await createProject(page, '3Dmol Molecule Filter Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await selectFirstPage(page);
        await add3DmolIdevice(page);

        // The model file input drives a molecule-specific file-manager filter.
        const modelFileInput = page.locator('#dmoleModelFile');
        await expect(modelFileInput).toBeAttached({ timeout: 5000 });
        const accept = await modelFileInput.getAttribute('data-filemanager-accept');
        expect(accept).toBe('molecule');

        // The shared picker generates a browse button for it.
        const browseButton = page.locator('input.exe-pick-any-file').first();
        await expect(browseButton).toBeVisible({ timeout: 10000 });
    });

    test('uploaded molecule appears in the file manager and can be selected', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        const projectUuid = await createProject(page, '3Dmol Molecule Upload Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await selectFirstPage(page);
        await add3DmolIdevice(page);

        await selectMoleculeViaPicker(page, MOLECULE_FIXTURE);

        // The selected molecule is now the model: the input holds its asset:// URL.
        const value = await page.locator('#dmoleModelFile').inputValue();
        expect(value).toMatch(/^asset:\/\/.*\.sdf$/);
    });

    test('renders an SDF whose title line is empty (OpenBabel style)', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        const projectUuid = await createProject(page, '3Dmol Empty-Title SDF Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await selectFirstPage(page);
        await add3DmolIdevice(page);

        await selectMoleculeViaPicker(page, EMPTY_TITLE_MOLECULE_FIXTURE);

        // The fixture is a benzene molfile (12 atoms) whose first line (title) is
        // empty. Before the fix, the data was trimmed, the molfile counts line
        // shifted and 3Dmol parsed 0 atoms (the viewer rendered empty). Assert
        // the molecule actually parsed to its 12 atoms.
        await expectModelAtomCount(page, 12);
    });

    test('switching to a second molecule loads the new model, not the previous one', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        const projectUuid = await createProject(page, '3Dmol Molecule Switch Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await selectFirstPage(page);
        await add3DmolIdevice(page);

        // First model: water (sample-molecule.sdf, 3 atoms).
        await selectMoleculeViaPicker(page, MOLECULE_FIXTURE);

        // Switch to a second, different model: benzene (12 atoms).
        await selectMoleculeViaPicker(page, EMPTY_TITLE_MOLECULE_FIXTURE);

        // Regression: switching used to reuse the previous model's blob (stale
        // jQuery .data('blobUrl')), leaving the viewer on the first molecule (or
        // empty). The active model must now be the second one (benzene, 12 atoms),
        // not the first (water, 3 atoms).
        await expectModelAtomCount(page, 12);
    });
});
