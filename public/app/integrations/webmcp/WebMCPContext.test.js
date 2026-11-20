import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebMCPContext, { isTextIdeviceType } from './WebMCPContext.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeApp(overrides = {}) {
    return {
        project: {
            _yjsBridge: {
                structureBinding: {
                    getComponent: vi.fn(),
                },
                assetManager: {},
                getMetadata: vi.fn(() => ({})),
            },
            structure: {
                menuStructureBehaviour: { nodeSelected: null },
                menuStructureCompose: { menuNav: null },
                resetStructureData: vi.fn(),
            },
            idevices: {
                loadApiIdevicesInPage: vi.fn(),
            },
        },
        themes: {
            getThemeIcons: vi.fn(() => ({})),
        },
        menus: {
            menuStructure: {
                menuStructureBehaviour: {
                    checkIfEmptyNode: vi.fn(),
                },
            },
        },
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// isTextIdeviceType (exported pure function)
// ---------------------------------------------------------------------------

describe('isTextIdeviceType', () => {
    it('returns true only for the canonical "text" type (case-insensitive)', () => {
        expect(isTextIdeviceType('text')).toBe(true);
        expect(isTextIdeviceType('TEXT')).toBe(true);
        expect(isTextIdeviceType('Text')).toBe(true);
    });

    it('returns false for types that merely contain "text" — legacy aliases are normalised on import', () => {
        // Per doc/elpx-format/idevices/catalog.md, all legacy CamelCase aliases
        // (FreeTextIdevice, ReflectionIdevice, etc.) are normalised to "text"
        // on import, so the only canonical type stored in Yjs is "text".
        expect(isTextIdeviceType('textblock')).toBe(false);
        expect(isTextIdeviceType('myTextIdevice')).toBe(false);
        expect(isTextIdeviceType('FreeTextIdevice')).toBe(false);
        expect(isTextIdeviceType('external-text-website')).toBe(false);
    });

    it('returns false for unrelated types and falsy values', () => {
        expect(isTextIdeviceType('image')).toBe(false);
        expect(isTextIdeviceType('quiz')).toBe(false);
        expect(isTextIdeviceType('')).toBe(false);
        expect(isTextIdeviceType(null)).toBe(false);
        expect(isTextIdeviceType(undefined)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// WebMCPContext
// ---------------------------------------------------------------------------

describe('WebMCPContext', () => {
    let app;
    let ctx;

    beforeEach(() => {
        app = makeApp();
        ctx = new WebMCPContext(app);
        window.eXeLearning = { app: null };
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete window.eXeLearning;
    });

    // -----------------------------------------------------------------------
    // getBridge
    // -----------------------------------------------------------------------

    describe('getBridge', () => {
        it('returns the bridge when the project is ready', () => {
            expect(ctx.getBridge()).toBe(app.project._yjsBridge);
        });

        it('throws "Project is not ready yet" when bridge is absent', () => {
            app.project._yjsBridge = null;
            expect(() => ctx.getBridge()).toThrow('Project is not ready yet');
        });

        it('throws when bridge exists but structureBinding is missing', () => {
            app.project._yjsBridge = {};
            expect(() => ctx.getBridge()).toThrow('Project is not ready yet');
        });

        it('throws when project itself is absent', () => {
            const emptyCtx = new WebMCPContext({});
            expect(() => emptyCtx.getBridge()).toThrow('Project is not ready yet');
        });
    });

    // -----------------------------------------------------------------------
    // getAssetManager
    // -----------------------------------------------------------------------

    describe('getAssetManager', () => {
        it('returns the asset manager when present', () => {
            expect(ctx.getAssetManager()).toBe(app.project._yjsBridge.assetManager);
        });

        it('throws "AssetManager is not available" when absent', () => {
            delete app.project._yjsBridge.assetManager;
            expect(() => ctx.getAssetManager()).toThrow('AssetManager is not available');
        });
    });

    // -----------------------------------------------------------------------
    // getSelectedPageId
    // -----------------------------------------------------------------------

    describe('getSelectedPageId', () => {
        it('returns null when nodeSelected is null', () => {
            expect(ctx.getSelectedPageId()).toBeNull();
        });

        it('returns null when nodeSelected has no getAttribute', () => {
            app.project.structure.menuStructureBehaviour.nodeSelected = { foo: 'bar' };
            expect(ctx.getSelectedPageId()).toBeNull();
        });

        it('returns the nav-id attribute of the selected node', () => {
            const node = document.createElement('div');
            node.setAttribute('nav-id', 'page-42');
            app.project.structure.menuStructureBehaviour.nodeSelected = node;
            expect(ctx.getSelectedPageId()).toBe('page-42');
        });
    });

    // -----------------------------------------------------------------------
    // requirePageId
    // -----------------------------------------------------------------------

    describe('requirePageId', () => {
        it('returns the provided pageId when it is a non-empty string', () => {
            expect(ctx.requirePageId('page-1')).toBe('page-1');
        });

        it('falls back to the selected page id when pageId is absent', () => {
            const node = document.createElement('div');
            node.setAttribute('nav-id', 'selected-page');
            app.project.structure.menuStructureBehaviour.nodeSelected = node;

            expect(ctx.requirePageId(null)).toBe('selected-page');
            expect(ctx.requirePageId(undefined)).toBe('selected-page');
            expect(ctx.requirePageId('')).toBe('selected-page');
        });

        it('throws when neither pageId nor a selection is available', () => {
            expect(() => ctx.requirePageId(null)).toThrow(
                'pageId is required (or select a page in the editor)',
            );
        });
    });

    // -----------------------------------------------------------------------
    // getComponent / requireComponent
    // -----------------------------------------------------------------------

    describe('getComponent', () => {
        it('delegates to structureBinding.getComponent', () => {
            const component = { id: 'c1', ideviceType: 'text' };
            app.project._yjsBridge.structureBinding.getComponent.mockReturnValue(component);
            expect(ctx.getComponent('c1')).toBe(component);
            expect(app.project._yjsBridge.structureBinding.getComponent).toHaveBeenCalledWith('c1');
        });
    });

    describe('requireComponent', () => {
        it('returns the component when found', () => {
            const component = { id: 'c1', ideviceType: 'text' };
            app.project._yjsBridge.structureBinding.getComponent.mockReturnValue(component);
            expect(ctx.requireComponent('c1')).toBe(component);
        });

        it('throws when component is not found', () => {
            app.project._yjsBridge.structureBinding.getComponent.mockReturnValue(undefined);
            expect(() => ctx.requireComponent('missing-id')).toThrow('Component not found: missing-id');
        });

        it('throws when componentId is empty', () => {
            expect(() => ctx.requireComponent('')).toThrow('componentId is required');
        });
    });

    // -----------------------------------------------------------------------
    // requireTextIdeviceComponent
    // -----------------------------------------------------------------------

    describe('requireTextIdeviceComponent', () => {
        it('returns the component when it is a text iDevice', () => {
            const component = { id: 'c1', ideviceType: 'text' };
            app.project._yjsBridge.structureBinding.getComponent.mockReturnValue(component);
            expect(ctx.requireTextIdeviceComponent('c1')).toBe(component);
        });

        it('throws when the component type is not text', () => {
            const component = { id: 'c2', ideviceType: 'quiz' };
            app.project._yjsBridge.structureBinding.getComponent.mockReturnValue(component);
            expect(() => ctx.requireTextIdeviceComponent('c2')).toThrow(
                'Component c2 is not a text iDevice (type: quiz)',
            );
        });

        it('throws when the component is not found', () => {
            app.project._yjsBridge.structureBinding.getComponent.mockReturnValue(undefined);
            expect(() => ctx.requireTextIdeviceComponent('ghost')).toThrow(
                'Component not found: ghost',
            );
        });
    });

    // -----------------------------------------------------------------------
    // getThemeIconsList
    // -----------------------------------------------------------------------

    describe('getThemeIconsList', () => {
        it('returns an empty array when no theme icons exist', () => {
            app.themes.getThemeIcons.mockReturnValue({});
            expect(ctx.getThemeIconsList()).toEqual([]);
        });

        it('returns icons sorted alphabetically by key', () => {
            app.themes.getThemeIcons.mockReturnValue({
                zebra: { id: 'zebra', title: 'Zebra', value: 'z' },
                apple: { id: 'apple', title: 'Apple', value: 'a' },
                mango: { id: 'mango', title: 'Mango', value: 'm' },
            });

            const icons = ctx.getThemeIconsList();
            expect(icons.map((i) => i.key)).toEqual(['apple', 'mango', 'zebra']);
        });

        it('normalises icon fields using normalizeMetadataValue', () => {
            app.themes.getThemeIcons.mockReturnValue({
                star: { id: '  star  ', title: '  Star Icon  ', value: '  ★  ' },
            });

            const [icon] = ctx.getThemeIconsList();
            expect(icon.id).toBe('star');
            expect(icon.title).toBe('Star Icon');
            expect(icon.value).toBe('★');
        });

        it('falls back to window.eXeLearning.app.themes when app.themes is absent', () => {
            const ctxNoThemes = new WebMCPContext({});
            const fakeIcons = { bolt: { id: 'bolt', title: 'Bolt', value: 'b' } };
            window.eXeLearning.app = { themes: { getThemeIcons: () => fakeIcons } };

            const icons = ctxNoThemes.getThemeIconsList();
            expect(icons).toHaveLength(1);
            expect(icons[0].key).toBe('bolt');
        });
    });

    // -----------------------------------------------------------------------
    // resolveOptionalIconName
    // -----------------------------------------------------------------------

    describe('resolveOptionalIconName', () => {
        beforeEach(() => {
            app.themes.getThemeIcons.mockReturnValue({
                arrow: { id: 'arrow-icon', title: 'Arrow', value: '→' },
                star: { id: 'star-icon', title: 'Star', value: '★' },
            });
        });

        it('returns null when iconName is absent', () => {
            expect(ctx.resolveOptionalIconName(null)).toBeNull();
            expect(ctx.resolveOptionalIconName('')).toBeNull();
            expect(ctx.resolveOptionalIconName(undefined)).toBeNull();
        });

        it('resolves by exact key', () => {
            expect(ctx.resolveOptionalIconName('arrow')).toBe('arrow');
        });

        it('resolves by icon id', () => {
            expect(ctx.resolveOptionalIconName('star-icon')).toBe('star');
        });

        it('throws when the icon name does not match any theme icon', () => {
            expect(() => ctx.resolveOptionalIconName('ghost')).toThrow(
                'iconName "ghost" is not available in the current theme',
            );
        });
    });

    // -----------------------------------------------------------------------
    // getProjectMetadata
    // -----------------------------------------------------------------------

    describe('getProjectMetadata', () => {
        it('returns normalised metadata from the bridge', () => {
            app.project._yjsBridge.getMetadata.mockReturnValue({
                title: '  My Project  ',
                author: 'Alice',
                description: 'Desc',
                language: 'en',
                license: 'CC',
                createdAt: '2024-01-01',
                modifiedAt: '2024-06-01',
            });

            expect(ctx.getProjectMetadata()).toEqual({
                title: 'My Project',
                author: 'Alice',
                description: 'Desc',
                language: 'en',
                license: 'CC',
                createdAt: '2024-01-01',
                modifiedAt: '2024-06-01',
            });
        });

        it('returns empty strings for missing fields', () => {
            app.project._yjsBridge.getMetadata.mockReturnValue({});
            const meta = ctx.getProjectMetadata();
            expect(meta.title).toBe('');
            expect(meta.author).toBe('');
        });
    });

    // -----------------------------------------------------------------------
    // getMissingRequiredMetadataFields
    // -----------------------------------------------------------------------

    describe('getMissingRequiredMetadataFields', () => {
        it('returns empty array when all required fields are present', () => {
            expect(
                ctx.getMissingRequiredMetadataFields({
                    title: 'T',
                    author: 'A',
                    description: 'D',
                }),
            ).toEqual([]);
        });

        it('returns the names of missing fields', () => {
            expect(
                ctx.getMissingRequiredMetadataFields({ title: '', author: 'A', description: '' }),
            ).toEqual(['title', 'description']);
        });
    });

    // -----------------------------------------------------------------------
    // getNavElementByPageId
    // -----------------------------------------------------------------------

    describe('getNavElementByPageId', () => {
        it('returns null for a null pageId', () => {
            expect(ctx.getNavElementByPageId(null)).toBeNull();
        });

        it('finds the nav element in the DOM', () => {
            const el = document.createElement('div');
            el.classList.add('nav-element');
            el.setAttribute('nav-id', 'p99');
            document.body.appendChild(el);

            expect(ctx.getNavElementByPageId('p99')).toBe(el);

            document.body.removeChild(el);
        });
    });

    // -----------------------------------------------------------------------
    // refreshStructure
    // -----------------------------------------------------------------------

    describe('refreshStructure', () => {
        it('calls resetStructureData with the target pageId', async () => {
            await ctx.refreshStructure('page-1');
            expect(app.project.structure.resetStructureData).toHaveBeenCalledWith('page-1');
        });

        it('forces content reload when target matches currently selected page', async () => {
            const node = document.createElement('div');
            node.setAttribute('nav-id', 'same-page');
            app.project.structure.menuStructureBehaviour.nodeSelected = node;

            const navEl = document.createElement('div');
            navEl.classList.add('nav-element');
            navEl.setAttribute('nav-id', 'same-page');
            document.body.appendChild(navEl);

            await ctx.refreshStructure('same-page');

            expect(app.project.idevices.loadApiIdevicesInPage).toHaveBeenCalled();

            document.body.removeChild(navEl);
        });
    });
});
