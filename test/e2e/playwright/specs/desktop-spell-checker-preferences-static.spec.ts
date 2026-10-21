import { test, expect } from '../fixtures/static.fixture';

test('desktop spell-checker preference names languages, shows them on demand, and saves through Electron', async ({
    staticPage,
}) => {
    await staticPage.evaluate(async () => {
        const app = (window as any).eXeLearning.app;
        (window as any).__spellCheckerSelections = [];
        (window as any).electronAPI = {
            ...(window as any).electronAPI,
            getSpellCheckerSettings: async () => ({
                supported: true,
                availableLanguages: ['en-US', 'es'],
                selectedLanguages: [],
                systemDefault: true,
            }),
            setSpellCheckerLanguages: async (languages: string[]) => {
                (window as any).__spellCheckerSelections.push(languages);
                return {
                    supported: true,
                    availableLanguages: ['en-US', 'es'],
                    selectedLanguages: languages.filter(language => language !== '__system_default__'),
                    systemDefault: languages.length === 0 || languages.includes('__system_default__'),
                    applied: true,
                    persisted: true,
                };
            },
        };
        await app.user.preferences.loadSpellCheckerPreferences();
        app.user.preferences.showModalPreferences();
    });

    const modal = staticPage.locator('#modalProperties');
    await expect(modal).toBeVisible();
    const preference = modal.locator('[property="spellCheckerLanguages"]');
    const mode = preference.locator('.multiselect-mode');
    const list = preference.locator('.multiselect-options');
    await expect(mode).toBeVisible();
    await expect(modal.locator('.exe-form-tabs')).toHaveCount(0);

    // System default hides the language list
    await expect(mode).toHaveValue('__system_default__');
    await expect(list).toBeHidden();

    await mode.selectOption('custom');
    await expect(list).toBeVisible();
    const spanish = list.locator('.multiselect-option[value="es"]');
    // Options are named in the interface language, not shown as codes
    await expect(list.locator(`label[for="${await spanish.getAttribute('id')}"]`)).not.toHaveText('es');

    await spanish.check();
    await modal.locator('button.btn.btn-primary').click();
    await expect.poll(() => staticPage.evaluate(() => (window as any).__spellCheckerSelections)).toEqual([['es']]);
});
