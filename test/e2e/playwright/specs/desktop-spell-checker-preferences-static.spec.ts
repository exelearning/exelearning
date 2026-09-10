import { test, expect } from '../fixtures/static.fixture';

test('desktop spell-checker preference is visible, exclusive, and saved through Electron', async ({ staticPage }) => {
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
    const selector = modal.locator('[property="spellCheckerLanguages"]');
    await expect(selector).toBeVisible();
    await expect(modal.locator('.exe-form-tabs')).toHaveCount(0);

    await selector.selectOption(['__system_default__', 'es']);
    await expect(selector).toHaveJSProperty('value', 'es');
    await expect(selector.locator('option[value="__system_default__"]')).toHaveJSProperty('selected', false);
    await expect(selector.locator('option[value="es"]')).toHaveJSProperty('selected', true);

    await modal.locator('button.btn.btn-primary').click();
    await expect.poll(() => staticPage.evaluate(() => (window as any).__spellCheckerSelections)).toEqual([['es']]);
});
