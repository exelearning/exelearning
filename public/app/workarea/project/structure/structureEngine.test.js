import { describe, expect, it, beforeEach } from 'vitest';
import StructureEngine from './structureEngine.js';

describe('StructureEngine helpers', () => {
  let engine;

  beforeEach(() => {
    document.body.innerHTML = '<div id="main"><div id="workarea"><div id="node-content"></div></div></div>';
    engine = new StructureEngine({});
  });

  it('identifies Yjs mode only when project flag is true', () => {
    expect(engine.isYjsEnabled()).toBe(false);
    engine.project._yjsEnabled = true;
    expect(engine.isYjsEnabled()).toBe(true);
  });

  it('addParentRootToData upgrades top-level nodes to root children', () => {
    const nodes = [
      { id: 'root', parent: null, children: [] },
      { id: 'page-a', parent: null, children: [] },
      { id: 'page-b', parent: 'page-a', children: [] },
    ];
    const result = engine.addParentRootToData(nodes);
    expect(result).toContainEqual(expect.objectContaining({ id: 'page-a', parent: 'root' }));
    expect(result).toContainEqual(expect.objectContaining({ id: 'root', parent: null }));
    expect(result.find((node) => node.id === 'page-b').parent).toBe('page-a');
  });

  it('groupDataByParent returns default buckets when input is invalid', () => {
    const grouped = engine.groupDataByParent(null);
    expect(grouped.null.children).toEqual([]);
    expect(grouped.root.children).toEqual([]);
  });

  it('compareNodesSort safely compares by order property', () => {
    const a = { order: 5 };
    const b = { order: 10 };
    const c = {};
    expect(engine.compareNodesSort(a, b)).toBe(-1);
    expect(engine.compareNodesSort(b, a)).toBe(1);
    expect(engine.compareNodesSort(c, a)).toBe(-1);
    expect(engine.compareNodesSort(a, c)).toBe(1);
    expect(engine.compareNodesSort(c, {})).toBe(0);
  });

  it('addOpenParamToStructureData assigns open flags appropriately', () => {
    const nodes = [
      { id: 'with-children', children: [{ id: 'child' }], open: null },
      { id: 'leaf', children: [], open: false },
    ];
    const updated = engine.addOpenParamToStructureData(nodes);
    expect(updated.find((node) => node.id === 'with-children').open).toBe(true);
    expect(updated.find((node) => node.id === 'leaf').open).toBe(null);
  });

  it('orderStructureData respects hierarchy and indexes nodes', () => {
    const nodes = [
      { id: 'root', parent: null, children: [], order: 0 },
      { id: 'a', parent: null, children: [], order: 1 },
      { id: 'child-1', parent: 'a', children: [], order: 2 },
      { id: 'child-2', parent: 'a', children: [], order: 3 },
    ];
    const ordered = engine.orderStructureData(JSON.parse(JSON.stringify(nodes)));
    expect(ordered.map((node) => node.id)).toEqual(['root', 'a', 'child-1', 'child-2']);
    const parentNode = ordered.find((node) => node.id === 'a');
    expect(parentNode.index).toBe('1');
    expect(parentNode.deep).toBe(0);
    const firstChild = ordered.find((node) => node.id === 'child-1');
    const secondChild = ordered.find((node) => node.id === 'child-2');
    expect(firstChild.index).toBe('1.1');
    expect(secondChild.index).toBe('1.2');
  });
});
