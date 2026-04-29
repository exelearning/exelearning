---
name: websocket-yjs
description: Modifying real-time collaboration features including WebSocket handlers, Yjs documents, and room lifecycle. Every change must ship with colocated tests (`*.spec.ts` server-side, `*.test.js` client-side), keep patch coverage ≥ 90% on changed lines, include or update a multi-user Playwright spec using the `collaboration.fixture`, and pass `make fix`, `make test-unit`, `make test-integration`, and `make test-e2e` before submission.
---

# Skill: WebSocket & Yjs Collaboration

> Parent: [AGENTS.md](../../../AGENTS.md) | Related: [frontend-module](../frontend-module/SKILL.md), [backend-service](../backend-service/SKILL.md)

## When to Use

Modifying real-time collaboration, WebSocket handling, or Yjs document management.

## Key Files

**Server-side:**
- `src/websocket/*.ts` — WebSocket handlers (room management, persistence, asset coordination)
- `src/websocket/room-manager.ts` — room lifecycle management
- `src/websocket/yjs-websocket.ts` — WebSocket route creation
- `src/websocket/yjs-persistence.ts` — Yjs document persistence
- `src/yjs/*.ts` — Yjs document helpers

**Client-side:**
- `public/app/yjs/YjsDocumentManager.js` — Y.Doc management (source of truth)
- `public/app/yjs/YjsStructureBinding.js` — binds Yjs state to UI
- `public/app/yjs/YjsProviderFactory.js` — WebSocket provider creation
- `public/app/yjs/AssetManager.js` — Cache API asset management
- `public/app/yjs/ResourceCache.js` — theme/library cache
- `public/app/yjs/*.test.js` — colocated tests

**Documentation:** [doc/development/real-time.md](../../../doc/development/real-time.md)

## Architecture

```
CLIENT owns Y.Doc (source of truth)
  ↕ WebSocket (stateless relay)
SERVER: lightweight metadata only
  - Does NOT store Y.Doc in memory
  - Persists snapshots to yjs_documents table
  - Forwards messages between clients
```

The server is a **stateless relay**. All document state lives in the browser's Y.Doc.

## Concurrency Patterns

### Deferred Page Reload

When User B creates an iDevice while User A is editing, User A's editor must not be force-closed. Instead, defer the reload:

```javascript
// In YjsProjectBridge: defer reload when editor is active
const hasActiveEditor = document.querySelector('#node-content div.idevice_node[mode="edition"]');
if (hasActiveEditor) {
    this._deferredPageReload = pageId;
    return;
}
// In idevicesEngine: execute deferred reload when exiting edition
this.project._yjsBridge?.executeDeferredPageReload?.();
```

### Late Joiner Resync

When a new user joins, the y-websocket handshake may be incomplete. Use awareness-triggered resync plus server `trigger-resync` as belt-and-suspenders.

## Commands

```bash
bun test src/websocket/room-manager.spec.ts                    # Server tests
npx vitest run public/app/yjs/YjsDocumentManager.test.js       # Client tests
make fix                                                        # Lint
```

## Gotchas

- **Server must NEVER store Y.Doc in memory** — it's a stateless relay. Violations break the architecture.
- **`connectWebSocket()`** — `YjsDocumentManager` uses this method, NOT `setupWebSocketProvider`. Using the wrong method name will silently fail.
- **`MockWebsocketProvider` needs `connect()` and `disconnect()`** — tests that test resync behavior will fail without these methods on the mock.
- **UUIDs in test data must be hex** — `extractProjectUuid` rejects non-hex characters. Use `[0-9a-f-]{36}` format.
- **Concurrent editing data loss** — the most dangerous class of bug. When two users edit the same page, ensure neither loses work. Always test: User A editing + User B creates iDevice on same page → User A's editor must survive. _Example: PR #1540._
- **Asset coordination uses separate JSON protocol** — over the same WebSocket connection, but distinct from Yjs binary messages.
- **Reconnection safety** — `AssetWebSocketHandler._handleStatus` already re-sets up the message handler on reconnect. It's safe to disconnect/connect.

## Done When

- [ ] Server changes: `.spec.ts` at 90%+ coverage
- [ ] Client changes: `.test.js` at 80%+ coverage
- [ ] Server remains stateless relay (no Y.Doc storage)
- [ ] Concurrent editing scenarios tested (two-user interactions)
- [ ] `make fix` passes clean
