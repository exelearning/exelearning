/**
 * Tests for YjsStructureBinding.deletePage() functionality
 *
 * These tests verify the page deletion logic including:
 * - Deleting root pages
 * - Deleting child pages
 * - Recursive deletion of descendants
 * - Edge cases (non-existent pages, empty navigation, etc.)
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as Y from 'yjs';

/**
 * Mock implementation of YjsStructureBinding for testing the deletePage logic.
 * This mirrors the actual implementation to test the algorithm in isolation.
 */
class MockYjsStructureBinding {
    private doc: Y.Doc;
    private navigation: Y.Array<Y.Map<unknown>>;

    constructor() {
        this.doc = new Y.Doc();
        this.navigation = this.doc.getArray('navigation');
    }

    getNavigation(): Y.Array<Y.Map<unknown>> {
        return this.navigation;
    }

    getDoc(): Y.Doc {
        return this.doc;
    }

    /**
     * Delete a page and all its descendants
     * @param pageId - Page ID to delete
     * @returns true if page was found and deleted
     */
    deletePage(pageId: string): boolean {
        const navigation = this.getNavigation();
        let deleted = false;

        this.doc.transact(() => {
            const pageIdsToDelete = this._collectDescendantIds(pageId, navigation);
            pageIdsToDelete.push(pageId);

            for (const idToDelete of pageIdsToDelete) {
                for (let i = navigation.length - 1; i >= 0; i--) {
                    const pageMap = navigation.get(i);
                    if (pageMap.get('id') === idToDelete) {
                        navigation.delete(i, 1);
                        if (idToDelete === pageId) {
                            deleted = true;
                        }
                        break;
                    }
                }
            }
        });

        return deleted;
    }

    /**
     * Collect all descendant page IDs recursively
     */
    _collectDescendantIds(parentId: string, navigation: Y.Array<Y.Map<unknown>>): string[] {
        const descendants: string[] = [];
        for (let i = 0; i < navigation.length; i++) {
            const pageMap = navigation.get(i);
            if (pageMap.get('parentId') === parentId) {
                const childId = pageMap.get('id') as string;
                descendants.push(childId);
                descendants.push(...this._collectDescendantIds(childId, navigation));
            }
        }
        return descendants;
    }

    /**
     * Helper to add a page for testing
     */
    addPage(id: string, parentId: string | null = null): void {
        const pageMap = new Y.Map();
        pageMap.set('id', id);
        pageMap.set('parentId', parentId);
        pageMap.set('pageName', `Page ${id}`);
        this.navigation.push([pageMap]);
    }

    /**
     * Helper to get all page IDs
     */
    getPageIds(): string[] {
        const ids: string[] = [];
        for (let i = 0; i < this.navigation.length; i++) {
            ids.push(this.navigation.get(i).get('id') as string);
        }
        return ids;
    }
}

describe('YjsStructureBinding.deletePage', () => {
    let binding: MockYjsStructureBinding;

    beforeEach(() => {
        binding = new MockYjsStructureBinding();
    });

    describe('Eliminar página raíz sin hijos', () => {
        it('debe eliminar una página raíz única', () => {
            binding.addPage('root1', null);

            const result = binding.deletePage('root1');

            expect(result).toBe(true);
            expect(binding.getPageIds()).toEqual([]);
        });

        it('debe eliminar una de varias páginas raíz', () => {
            binding.addPage('root1', null);
            binding.addPage('root2', null);
            binding.addPage('root3', null);

            const result = binding.deletePage('root2');

            expect(result).toBe(true);
            expect(binding.getPageIds()).toEqual(['root1', 'root3']);
        });
    });

    describe('Eliminar página raíz con hijos', () => {
        it('debe eliminar raíz y todos sus hijos directos', () => {
            binding.addPage('root1', null);
            binding.addPage('child1', 'root1');
            binding.addPage('child2', 'root1');

            const result = binding.deletePage('root1');

            expect(result).toBe(true);
            expect(binding.getPageIds()).toEqual([]);
        });

        it('debe eliminar raíz y todos sus descendientes (nietos)', () => {
            binding.addPage('root1', null);
            binding.addPage('child1', 'root1');
            binding.addPage('grandchild1', 'child1');
            binding.addPage('grandchild2', 'child1');

            const result = binding.deletePage('root1');

            expect(result).toBe(true);
            expect(binding.getPageIds()).toEqual([]);
        });

        it('debe preservar otras ramas al eliminar una raíz', () => {
            binding.addPage('root1', null);
            binding.addPage('child1', 'root1');
            binding.addPage('root2', null);
            binding.addPage('child2', 'root2');

            const result = binding.deletePage('root1');

            expect(result).toBe(true);
            expect(binding.getPageIds()).toEqual(['root2', 'child2']);
        });
    });

    describe('Eliminar hijo (no raíz)', () => {
        it('debe eliminar un hijo sin afectar al padre', () => {
            binding.addPage('root1', null);
            binding.addPage('child1', 'root1');
            binding.addPage('child2', 'root1');

            const result = binding.deletePage('child1');

            expect(result).toBe(true);
            expect(binding.getPageIds()).toEqual(['root1', 'child2']);
        });

        it('debe eliminar hijo intermedio y sus descendientes', () => {
            binding.addPage('root1', null);
            binding.addPage('child1', 'root1');
            binding.addPage('grandchild1', 'child1');
            binding.addPage('child2', 'root1');

            const result = binding.deletePage('child1');

            expect(result).toBe(true);
            expect(binding.getPageIds()).toEqual(['root1', 'child2']);
        });
    });

    describe('Casos edge', () => {
        it('debe retornar false si la página no existe', () => {
            binding.addPage('root1', null);

            const result = binding.deletePage('nonexistent');

            expect(result).toBe(false);
            expect(binding.getPageIds()).toEqual(['root1']);
        });

        it('debe manejar navegación vacía', () => {
            const result = binding.deletePage('any');

            expect(result).toBe(false);
            expect(binding.getPageIds()).toEqual([]);
        });

        it('debe manejar IDs con caracteres especiales', () => {
            binding.addPage('20251103161100OUGAUF', null);

            const result = binding.deletePage('20251103161100OUGAUF');

            expect(result).toBe(true);
            expect(binding.getPageIds()).toEqual([]);
        });

        it('debe manejar jerarquía profunda (5 niveles)', () => {
            binding.addPage('level0', null);
            binding.addPage('level1', 'level0');
            binding.addPage('level2', 'level1');
            binding.addPage('level3', 'level2');
            binding.addPage('level4', 'level3');

            const result = binding.deletePage('level0');

            expect(result).toBe(true);
            expect(binding.getPageIds()).toEqual([]);
        });

        it('debe manejar múltiples ramas en paralelo', () => {
            // Estructura: root1 -> [child1 -> grandchild1, child2 -> grandchild2]
            binding.addPage('root1', null);
            binding.addPage('child1', 'root1');
            binding.addPage('child2', 'root1');
            binding.addPage('grandchild1', 'child1');
            binding.addPage('grandchild2', 'child2');

            const result = binding.deletePage('child1');

            expect(result).toBe(true);
            expect(binding.getPageIds()).toEqual(['root1', 'child2', 'grandchild2']);
        });

        it('debe eliminar correctamente cuando hay páginas huérfanas', () => {
            // Simular página huérfana (parentId apunta a ID inexistente)
            binding.addPage('root1', null);
            binding.addPage('orphan', 'nonexistent');

            const result = binding.deletePage('root1');

            expect(result).toBe(true);
            expect(binding.getPageIds()).toEqual(['orphan']);
        });
    });

    describe('_collectDescendantIds', () => {
        it('debe retornar array vacío si no hay hijos', () => {
            binding.addPage('root1', null);

            const descendants = binding._collectDescendantIds('root1', binding.getNavigation());

            expect(descendants).toEqual([]);
        });

        it('debe encontrar hijos directos', () => {
            binding.addPage('root1', null);
            binding.addPage('child1', 'root1');
            binding.addPage('child2', 'root1');

            const descendants = binding._collectDescendantIds('root1', binding.getNavigation());

            expect(descendants.sort()).toEqual(['child1', 'child2'].sort());
        });

        it('debe encontrar todos los descendientes recursivamente', () => {
            binding.addPage('root1', null);
            binding.addPage('child1', 'root1');
            binding.addPage('grandchild1', 'child1');

            const descendants = binding._collectDescendantIds('root1', binding.getNavigation());

            expect(descendants).toContain('child1');
            expect(descendants).toContain('grandchild1');
            expect(descendants.length).toBe(2);
        });
    });
});
