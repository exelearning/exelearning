/**
 * ProjectActivityReporter tests — real Y.Docs driven through YjsStructureBinding.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ProjectActivityReporter = require('./ProjectActivityReporter');
const YjsStructureBinding = require('./YjsStructureBinding');

const Y = window.Y;

function createManager(ydoc) {
  const navigation = ydoc.getArray('navigation');
  const metadata = ydoc.getMap('metadata');
  const undoManager = new Y.UndoManager([navigation, metadata], {
    trackedOrigins: new Set([ydoc.clientID]),
    captureTimeout: 0,
  });
  return {
    ydoc,
    undoManager,
    sessionId: 'session-test-0001',
    lockManager: null,
    activityReporter: null,
    getDoc: () => ydoc,
    getNavigation: () => navigation,
    getMetadata: () => metadata,
    noteActivity(hint) {
      if (this.activityReporter) this.activityReporter.noteActivity(hint);
    },
  };
}

function okResponse(body = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ accepted: 1, duplicates: 0, rejected: 0, recordingEnabled: true, ...body }),
  };
}

/** Let the per-transaction microtask buffer flush into the aggregates. */
async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('ProjectActivityReporter', () => {
  let ydoc;
  let manager;
  let binding;
  let reporter;
  let fetchMock;
  let requests;
  let clock;

  const pending = () => [...reporter.pending.values()];
  const types = () => pending().map((e) => e.type);

  async function replaceReporter(options = {}) {
    await reporter.destroy();
    requests.length = 0;
    reporter = createReporter(options);
    return reporter;
  }

  function createReporter(options = {}) {
    const instance = new ProjectActivityReporter(manager, {
      projectId: 'proj-uuid',
      apiUrl: '/api',
      token: 'tok',
      fetch: fetchMock,
      now: () => clock,
      windowRef: null,
      logger: { warn: vi.fn(), log: vi.fn() },
      ...options,
    });
    instance.start();
    return instance;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    clock = 1_700_000_000_000;
    requests = [];
    fetchMock = vi.fn(async (url, init) => {
      requests.push({ url, init, body: JSON.parse(init.body) });
      return okResponse();
    });
    ydoc = new Y.Doc();
    manager = createManager(ydoc);
    binding = new YjsStructureBinding(manager);
    reporter = createReporter();
  });

  afterEach(async () => {
    reporter.destroyed = true;
    reporter._clearTimers();
    ydoc.destroy();
    vi.useRealTimers();
  });

  describe('structural operations through the binding', () => {
    it('reports page creation with its label', async () => {
      const page = binding.createPage('Intro');
      await settle();
      expect(pending()).toEqual([
        expect.objectContaining({ type: 'page.created', targetType: 'page', targetId: page.id, label: 'Intro', count: 1 }),
      ]);
    });

    it('reports a rename and a property edit separately', async () => {
      const page = binding.createPage('Intro');
      await settle();
      reporter.pending.clear();
      binding.updatePage(page.id, { pageName: 'Introduction' });
      await settle();
      binding.updatePage(page.id, { properties: { visibility: 'false' } });
      await settle();
      expect(types()).toEqual(['page.renamed', 'page.edited']);
      expect(pending()[0].label).toBe('Introduction');
      expect(pending()[1].details.keys).toEqual(['properties']);
    });

    it('reports a move once, without sibling order noise, and group moves per page', async () => {
      const a = binding.createPage('A');
      const b = binding.createPage('B');
      const c = binding.createPage('C');
      await settle();
      reporter.pending.clear();

      binding.movePage(c.id, a.id, 0);
      await settle();
      expect(types()).toEqual(['page.moved']);
      expect(pending()[0]).toMatchObject({ targetId: c.id, label: 'C', details: { toParentId: a.id } });
      reporter.pending.clear();

      binding.movePageNext(a.id);
      await settle();
      expect(types()).toEqual(['page.moved']);
      expect(pending()[0].targetId).toBe(a.id);
      reporter.pending.clear();

      binding.movePageToTarget(b.id, a.id);
      await settle();
      expect(types()).toEqual(['page.moved']);
      reporter.pending.clear();

      // Pure order reshuffles outside the binding are not user semantics by themselves.
      ydoc.transact(() => {
        binding.getPageMap(a.id).set('order', 5);
      }, ydoc.clientID);
      await settle();
      expect(types()).toEqual([]);
    });

    it('reports a delete with the historical label and descendant count, once', async () => {
      const parent = binding.createPage('Parent');
      const child = binding.createPage('Child', parent.id);
      binding.createPage('Grandchild', child.id);
      const block = binding.createBlock(parent.id, 'Box');
      binding.createComponent(parent.id, block, 'text', { htmlContent: '<p>x</p>' });
      await settle();
      reporter.pending.clear();

      binding.deletePage(parent.id);
      await settle();
      expect(types()).toEqual(['page.deleted']);
      expect(pending()[0]).toMatchObject({ targetId: parent.id, label: 'Parent', details: { descendants: 2 } });
    });

    it('reports clones as clones with their source, not as creations', async () => {
      const page = binding.createPage('Source');
      const block = binding.createBlock(page.id, 'Box');
      const comp = binding.createComponent(page.id, block, 'text', { htmlContent: '<p>x</p>' });
      await settle();
      reporter.pending.clear();

      const cloned = binding.clonePage(page.id);
      await settle();
      expect(types()).toEqual(['page.cloned']);
      expect(pending()[0]).toMatchObject({ targetId: cloned.id, details: { sourceId: page.id } });
      reporter.pending.clear();

      const clonedBlock = binding.cloneBlock(page.id, block);
      await settle();
      expect(types()).toEqual(['block.cloned']);
      expect(pending()[0]).toMatchObject({ targetId: clonedBlock.id, label: 'Box', details: { sourceId: block } });
      reporter.pending.clear();

      const clonedComp = binding.cloneComponent(page.id, block, comp);
      await settle();
      expect(types()).toEqual(['idevice.cloned']);
      expect(pending()[0]).toMatchObject({ targetId: clonedComp.id, details: { sourceId: comp, ideviceType: 'text' } });
    });

    it('reports iDevice creation, edition, nested property updates and deletion with page context', async () => {
      const page = binding.createPage('Lesson');
      const block = binding.createBlock(page.id, 'Activity box');
      await settle();
      reporter.pending.clear();

      const comp = binding.createComponent(page.id, block, 'text', { htmlContent: '<p>hello</p>' });
      await settle();
      expect(pending()).toEqual([
        expect.objectContaining({
          type: 'idevice.created',
          targetId: comp,
          label: 'Activity box',
          details: { ideviceType: 'text', pageId: page.id, pageLabel: 'Lesson', blockId: block },
        }),
      ]);
      reporter.pending.clear();

      binding.updateComponent(comp, { htmlContent: '<p>edited</p>' });
      await settle();
      binding.updateComponent(comp, { properties: { visibility: 'false' } });
      await settle();
      expect(types()).toEqual(['idevice.edited']);
      expect(pending()[0].count).toBe(2);
      expect(pending()[0].details.keys).toEqual(expect.arrayContaining(['htmlContent', 'properties']));
      reporter.pending.clear();

      binding.deleteComponent(comp);
      await settle();
      expect(pending()).toEqual([
        expect.objectContaining({
          type: 'idevice.deleted',
          targetId: comp,
          label: 'Activity box',
          details: expect.objectContaining({ ideviceType: 'text', pageId: page.id, pageLabel: 'Lesson' }),
        }),
      ]);
    });

    it('never reports lock bookkeeping as an edit', async () => {
      const page = binding.createPage('Lesson');
      const block = binding.createBlock(page.id, 'Box');
      const comp = binding.createComponent(page.id, block, 'text', { htmlContent: '<p>hello</p>' });
      await settle();
      reporter.pending.clear();

      binding.updateComponent(comp, { lockedBy: '123', lockUserName: 'Ann', lockUserColor: '#f00' });
      binding.updateComponent(comp, { lockedBy: null, lockUserName: null, lockUserColor: null });
      await settle();
      expect(types()).toEqual([]);
    });

    it('reports moves of blocks and iDevices as moves, not as delete plus create', async () => {
      const page = binding.createPage('Lesson');
      const other = binding.createPage('Other');
      const block1 = binding.createBlock(page.id, 'First');
      const block2 = binding.createBlock(page.id, 'Second');
      const comp = binding.createComponent(page.id, block1, 'text', { htmlContent: '<p>x</p>' });
      binding.createComponent(page.id, block1, 'text', { htmlContent: '<p>y</p>' });
      await settle();
      reporter.pending.clear();

      binding.reorderComponent(comp, 1);
      await settle();
      expect(types()).toEqual(['idevice.moved']);
      reporter.pending.clear();

      binding.moveComponentToBlock(comp, block2);
      await settle();
      expect(types()).toEqual(['idevice.moved']);
      expect(pending()[0].details).toMatchObject({ fromBlockId: block1, toBlockId: block2 });
      reporter.pending.clear();

      binding.updateBlockOrder(block2, 0);
      await settle();
      expect(types()).toEqual(['block.moved']);
      reporter.pending.clear();

      binding.moveBlockToPage(block2, other.id);
      await settle();
      expect(types()).toEqual(['block.moved']);
      expect(pending()[0].details).toMatchObject({ fromPageId: page.id, toPageId: other.id });
      reporter.pending.clear();

      const moved = binding.moveComponentToPage(comp, page.id, 'Landing');
      await settle();
      expect(types()).toEqual(['idevice.moved']);
      expect(pending()[0].details).toMatchObject({ pageId: page.id, toBlockId: moved.blockId });
    });

    it('reports block deletion with its page context', async () => {
      const page = binding.createPage('Lesson');
      const block = binding.createBlock(page.id, 'Box');
      await settle();
      reporter.pending.clear();
      binding.deleteBlock(page.id, block);
      await settle();
      expect(pending()).toEqual([
        expect.objectContaining({ type: 'block.deleted', targetId: block, label: 'Box', details: { pageId: page.id, pageLabel: 'Lesson' } }),
      ]);
    });
  });

  describe('local edits outside the binding', () => {
    it('classifies a direct Y.Text edit without transaction origin as an iDevice edit', async () => {
      const page = binding.createPage('Lesson');
      const block = binding.createBlock(page.id, 'Box');
      const comp = binding.createComponent(page.id, block, 'text', { htmlContent: '<p>x</p>' });
      await settle();
      reporter.pending.clear();

      const text = binding.getComponentMap(comp).get('htmlContent');
      text.delete(0, text.length);
      text.insert(0, '<p>typed</p>');
      await settle();
      expect(types()).toEqual(['idevice.edited']);
      expect(pending()[0].details.keys).toEqual(['htmlContent']);
    });

    it('reports metadata changes and ignores bookkeeping keys', async () => {
      ydoc.transact(() => {
        manager.getMetadata().set('title', 'New title');
        manager.getMetadata().set('modifiedAt', 1);
      }, ydoc.clientID);
      await settle();
      expect(pending()).toEqual([expect.objectContaining({ type: 'project.metadata_updated', details: { keys: ['title'] } })]);
      reporter.pending.clear();
      ydoc.transact(() => manager.getMetadata().set('modifiedAt', 2), ydoc.clientID);
      await settle();
      expect(types()).toEqual([]);
    });
  });

  describe('what is never attributed to this user', () => {
    it('ignores remote updates, snapshot merges, replays and system structures, but keeps labels for later deletes', async () => {
      const remote = new Y.Doc();
      const remotePage = new Y.Map();
      remote.transact(() => {
        remotePage.set('id', 'page-remote');
        remotePage.set('pageId', 'page-remote');
        remotePage.set('pageName', 'From Bob');
        remotePage.set('parentId', null);
        remotePage.set('blocks', new Y.Array());
        remote.getArray('navigation').push([remotePage]);
      });
      Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(remote)); // remote via provider
      Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(remote), 'initial'); // stored snapshot merge
      ydoc.transact(() => {
        const system = new Y.Map();
        system.set('id', 'page-system');
        system.set('pageName', 'Blank');
        system.set('blocks', new Y.Array());
        ydoc.getArray('navigation').push([system]);
      }, 'system');
      await settle();
      expect(types()).toEqual([]);

      // The remote page can still be named when this user deletes it.
      binding.deletePage('page-remote');
      await settle();
      expect(pending()).toEqual([expect.objectContaining({ type: 'page.deleted', targetId: 'page-remote', label: 'From Bob' })]);
      remote.destroy();
    });

    it('reports undo and redo as such, not as fresh edits', async () => {
      const page = binding.createPage('Undo me');
      await settle();
      reporter.pending.clear();
      manager.undoManager.undo();
      await settle();
      manager.undoManager.redo();
      await settle();
      expect(types()).toEqual(['content.undone', 'content.redone']);
      expect(ydoc.getArray('navigation').length).toBe(1);
      expect(binding.getPageMap(page.id)).toBeTruthy();
    });

    it('suppresses per-item events inside an import scope and reports one summary', async () => {
      reporter.beginScope();
      const page = binding.createPage('Imported');
      for (let i = 0; i < 50; i++) {
        const block = binding.createBlock(page.id, `Box ${i}`);
        binding.createComponent(page.id, block, 'text', { htmlContent: '<p>x</p>' });
      }
      reporter.endScope();
      await settle();
      expect(types()).toEqual([]);

      reporter.reportImport({ format: 'elpx', mode: 'merge', pages: 1, blocks: 50, components: 50, assets: 3 });
      expect(requests).toHaveLength(1);
      expect(requests[0].body.events[0]).toMatchObject({
        type: 'import.elpx',
        targetType: 'project',
        details: { format: 'elpx', mode: 'merge', pages: 1, blocks: 50, components: 50, assets: 3 },
      });
      // The cache was rebuilt after the import: imported items are nameable.
      binding.deletePage(page.id);
      await settle();
      expect(pending()[0]).toMatchObject({ type: 'page.deleted', label: 'Imported' });
    });
  });

  describe('aggregation and delivery', () => {
    it('aggregates repeated edits of one target into a single entry with a time range', async () => {
      const page = binding.createPage('Lesson');
      const block = binding.createBlock(page.id, 'Box');
      const comp = binding.createComponent(page.id, block, 'text', { htmlContent: '<p>0</p>' });
      await settle();
      reporter.pending.clear();
      const start = clock;
      for (let i = 1; i <= 14; i++) {
        clock += 60_000;
        binding.updateComponent(comp, { htmlContent: `<p>${i}</p>` });
        await settle();
      }
      expect(pending()).toHaveLength(1);
      expect(pending()[0]).toMatchObject({ type: 'idevice.edited', count: 14, firstAt: start + 60_000, lastAt: clock });
    });

    it('flushes after the inactivity window with a stable per-session seq and the expected payload', async () => {
      const page = binding.createPage('Lesson');
      await settle();
      expect(requests).toHaveLength(0);
      vi.advanceTimersByTime(30_000);
      await vi.runOnlyPendingTimersAsync();
      expect(requests).toHaveLength(1);
      const { url, init, body } = requests[0];
      expect(url).toBe('/api/projects/uuid/proj-uuid/activity/events');
      expect(init.headers.Authorization).toBe('Bearer tok');
      expect(body.sessionId).toBe('session-test-0001');
      expect(body.events).toEqual([
        { type: 'page.created', targetType: 'page', targetId: page.id, label: 'Lesson', count: 1, firstAt: clock, lastAt: clock, details: null, seq: 1 },
      ]);
      expect(reporter.getPendingCount()).toBe(0);
    });

    it('flushes when the oldest pending entry reaches the maximum window even while edits continue', async () => {
      const page = binding.createPage('Lesson');
      await settle();
      for (let i = 0; i < 25; i++) {
        vi.advanceTimersByTime(25_000); // keeps resetting the inactivity timer
        binding.updatePage(page.id, { pageName: `L${i}` });
        await settle();
      }
      await vi.runOnlyPendingTimersAsync();
      expect(requests.length).toBeGreaterThanOrEqual(1);
    });

    it('flushes immediately when too many targets are pending', async () => {
      await replaceReporter({ maxPendingKeys: 3 });
      binding.createPage('A');
      await settle();
      binding.createPage('B');
      await settle();
      binding.createPage('C');
      await settle();
      expect(requests).toHaveLength(1);
      expect(requests[0].body.events).toHaveLength(3);
    });

    it('retries failed deliveries with backoff and resends the same seq (idempotent on the server)', async () => {
      fetchMock.mockImplementationOnce(async () => {
        throw new Error('offline');
      });
      binding.createPage('A');
      await settle();
      await reporter.flush();
      expect(reporter.queue).toHaveLength(1);
      const seq = reporter.queue[0].seq;
      vi.advanceTimersByTime(5_000);
      await vi.runOnlyPendingTimersAsync();
      expect(requests).toHaveLength(1);
      expect(requests[0].body.events[0].seq).toBe(seq);
      expect(reporter.queue).toHaveLength(0);
    });

    it('splits large backlogs into batches', async () => {
      await replaceReporter({ maxBatch: 2 });
      binding.createPage('A');
      await settle();
      binding.createPage('B');
      await settle();
      binding.createPage('C');
      await settle();
      await reporter.flush();
      await vi.runOnlyPendingTimersAsync();
      expect(requests).toHaveLength(2);
      expect(requests[0].body.events).toHaveLength(2);
      expect(requests[1].body.events).toHaveLength(1);
    });

    it('drops the oldest entries beyond the queue bound instead of growing forever', async () => {
      await replaceReporter({ maxQueue: 2, maxRetries: 0 });
      fetchMock.mockImplementation(async () => {
        throw new Error('offline');
      });
      for (const name of ['A', 'B', 'C', 'D']) {
        binding.createPage(name);
        await settle();
        await reporter.flush();
      }
      expect(reporter.queue.length).toBeLessThanOrEqual(2);
      expect(reporter.lostCount).toBeGreaterThan(0);
    });

    it('stops reporting when the server refuses or recording is disabled', async () => {
      fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 403 }));
      binding.createPage('A');
      await settle();
      await reporter.flush();
      expect(reporter.disabled).toBe(true);
      binding.createPage('B');
      await settle();
      expect(reporter.getPendingCount()).toBe(0);

      await replaceReporter();
      fetchMock.mockImplementationOnce(async () => okResponse({ recordingEnabled: false }));
      binding.createPage('C');
      await settle();
      await reporter.flush();
      expect(reporter.disabled).toBe(true);
    });

    it('drops a batch the server rejects as malformed instead of retrying it', async () => {
      fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 400 }));
      binding.createPage('A');
      await settle();
      await reporter.flush();
      expect(reporter.queue).toHaveLength(0);
      expect(reporter.disabled).toBe(false);
      expect(reporter.lostCount).toBe(1);
    });

    it('flushes with keepalive on page hide and on destroy, then stops observing', async () => {
      const listeners = {};
      const fakeWindow = {
        addEventListener: (name, fn) => {
          listeners[name] = fn;
        },
        removeEventListener: (name) => {
          delete listeners[name];
        },
      };
      await replaceReporter({ windowRef: fakeWindow });
      binding.createPage('A');
      await settle();
      listeners.pagehide();
      await Promise.resolve();
      expect(requests).toHaveLength(1);
      expect(requests[0].init.keepalive).toBe(true);

      binding.createPage('B');
      await settle();
      await reporter.destroy();
      expect(requests).toHaveLength(2);
      expect(listeners.pagehide).toBeUndefined();
      expect(manager.activityReporter).toBeNull();
      binding.createPage('C');
      await settle();
      expect(reporter.getPendingCount()).toBe(0);
    });

    it('accepts a hint outside a transaction buffer and ignores hints inside a scope', async () => {
      reporter.noteActivity({ type: 'page.moved', targetId: 'page-x', label: 'X' });
      expect(types()).toEqual(['page.moved']);
      reporter.pending.clear();
      reporter.beginScope();
      reporter.noteActivity({ type: 'page.moved', targetId: 'page-y' });
      reporter.endScope();
      expect(types()).toEqual([]);
    });

    it('generates session ids in the accepted format', () => {
      const id = ProjectActivityReporter.generateSessionId();
      expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
      const bare = new ProjectActivityReporter({ getDoc: () => ydoc, getNavigation: () => ydoc.getArray('navigation'), getMetadata: () => ydoc.getMap('metadata') }, { windowRef: null });
      expect(bare.sessionId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    });
  });
});
