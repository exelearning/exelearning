---
name: websocket-yjs
description: "Change eXeLearning shared document mutations, WebSocket rooms, snapshots, reconnects or concurrent editing behavior."
---

# Yjs collaboration

Read `src/websocket/{room-manager,yjs-websocket,yjs-persistence}.ts`, `src/yjs/`,
`public/app/yjs/`, and [real-time documentation](../../../doc/development/real-time.md).
Use [Yjs shared types](https://docs.yjs.dev/getting-started/working-with-shared-types) and
[document updates](https://docs.yjs.dev/api/document-updates) for API semantics.

## State and transport boundaries

- Browser `YjsDocumentManager` owns the live editing document. WebSocket rooms retain connections and
  lightweight coordination state; they do not keep a long-lived authoritative Y.Doc per room.
- Server reconstruction, snapshot processing and CLI/API export **do** create temporary Y.Docs.
  Preserve those legitimate operations and their cleanup; do not turn the relay rule into a server-wide ban.
- Binary Yjs sync/awareness and JSON asset coordination share a socket but are different protocols.
  Preserve authentication, project access, message limits, heartbeat, disconnect and room cleanup.
- Awareness is ephemeral presence, not persistent content. Respect the existing late-join/resync protocol
  and `connectWebSocket()`/provider reconnect lifecycle rather than adding a second sync loop.

## Mutations and concurrent editors

- Use existing Y.Map/Y.Array/Y.Text shapes and transaction origins. Group related mutations in a transaction;
  preserve observer/undo origin filtering and avoid reflecting a remote update back as a fresh local edit.
- A shared type can be integrated only once. Reordering/copying must follow the project's clone/rebuild
  helpers; deleting and reinserting the same integrated object is not an ordinary array move.
- Do not replace shared structures with plain JSON mutations or apply whole-document replacement to a
  local edit. Concurrent peer updates and legacy import normalization must remain distinct.
- Preserve the deferred-page-reload behavior when another user adds an iDevice while an editor is active.
  Resolve it through the existing bridge on leaving edition; never discard the active user's work.
- Preserve installed Yjs identity and V1/V2 encoding contracts across browser bundles, persistence and
  server tools. A generic skill is not authorization to add Liveblocks, YKeyValue or a schema migration.
- Unobserve listeners and destroy temporary documents/providers when their owner is disposed. Avoid retaining
  document references after cleanup; test reconnect without duplicate listeners or orphan awareness.

Run focused Bun server specs and Vitest client specs, then final gates in `verify-change`.
Use the collaboration fixture with separate users for simultaneous edits, late join, disconnect/reconnect,
and an active editor while a peer changes the page. Check persisted content after reload, not only DOM text.
Use valid hex project UUIDs in fixtures; test asset JSON messages separately from binary sync.
