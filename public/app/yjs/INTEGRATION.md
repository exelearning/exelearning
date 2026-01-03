# Yjs Integration Guide

This guide shows how to integrate the Yjs collaborative editing system into eXeLearning.

## Quick Start

### 1. Include the Loader

Add to your HTML template:

```html
<script src="/app/yjs/yjs-loader.js"></script>
```

### 2. Initialize on Project Load

```javascript
// After user logs in and opens a project
async function onProjectOpen(projectId) {
  // Get auth token from your auth system
  const authToken = eXeLearning.app.auth.getToken();

  // Load Yjs modules and initialize
  await YjsLoader.load();

  // Apply mixin to existing projectManager
  YjsProjectManagerMixin.applyMixin(eXeLearning.app.project);

  // Enable Yjs mode
  await eXeLearning.app.project.enableYjsMode(projectId, authToken);

  console.log('Yjs collaborative editing enabled!');
}
```

### 3. Working with Pages

```javascript
const project = eXeLearning.app.project;

// Add a new page
const page = project.addPageViaYjs('Introduction', null); // null = root level
console.log('Created page:', page.id);

// Add a child page
const childPage = project.addPageViaYjs('Section 1.1', page.id);

// Delete a page
project.deletePageViaYjs(page.id);
```

### 4. Working with Blocks and iDevices

```javascript
// Add a block to a page
const block = project.addBlockViaYjs(pageId, 'Content Block');

// Add an iDevice (component) to a block
const idevice = project.addComponentViaYjs(pageId, block.id, 'FreeTextIdevice');

// Update iDevice HTML content
project.updateComponentHtmlViaYjs(pageId, block.id, idevice.id, '<p>Hello World!</p>');
```

### 5. Binding TinyMCE Editors

```javascript
// When opening an iDevice editor
function onIdeviceEdit(editor, pageId, blockId, componentId) {
  // Bind the TinyMCE editor to Yjs for real-time sync
  const binding = project.bindEditorToYjs(editor, pageId, blockId, componentId);

  // Store binding reference for cleanup
  editor._yjsBinding = binding;
}

// When closing the editor
function onIdeviceClose(editor) {
  if (editor._yjsBinding) {
    editor._yjsBinding.destroy();
    editor._yjsBinding = null;
  }
}
```

### 6. Collaborative Locking

```javascript
// Before editing an iDevice
function beforeEdit(componentId) {
  const canEdit = project.acquireIdeviceLock(componentId);

  if (!canEdit) {
    const lockInfo = project.getIdeviceLockInfo(componentId);
    alert(`This iDevice is being edited by ${lockInfo.lockedBy}`);
    return false;
  }

  return true;
}

// After finishing edit
function afterEdit(componentId) {
  project.releaseIdeviceLock(componentId);
}
```

### 7. Undo/Redo

```javascript
// Programmatic undo/redo
project.undo();
project.redo();

// Keyboard shortcuts are automatically enabled:
// - Ctrl+Z / Cmd+Z: Undo
// - Ctrl+Shift+Z / Cmd+Shift+Z: Redo
// - Ctrl+Y: Redo (Windows)
```

### 8. Import/Export .elpx Files

```javascript
// Export current project to .elpx
await project.exportToElpxViaYjs('my-project.elpx');

// Import from .elpx file
const fileInput = document.getElementById('file-input');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const stats = await project.importFromElpxViaYjs(file);
  console.log('Imported:', stats);
  // { pages: 5, blocks: 12, components: 25, assets: 8 }
});
```

### 9. Listen for Changes

```javascript
// Subscribe to structure changes (pages/blocks/components)
const unsubscribe = project.onStructureChange((events) => {
  console.log('Structure changed:', events);
  // Update your UI tree here
});

// Later, to stop listening:
unsubscribe();

// Subscribe to save status
project.onSaveStatus((status, message) => {
  console.log('Save status:', status); // 'saving', 'saved', 'error', 'offline'
});
```

### 10. Disable Yjs Mode

```javascript
// Revert to legacy REST API mode
await project.disableYjsMode();
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser Client                          │
├─────────────────────────────────────────────────────────────┤
│  YjsProjectBridge                                           │
│    ├── YjsDocumentManager (Y.Doc + IndexedDB + WebSocket)   │
│    ├── YjsStructureBinding (Pages/Blocks/Components CRUD)   │
│    ├── YjsLockManager (iDevice-level locking)               │
│    └── AssetCacheManager (IndexedDB blob storage)           │
├─────────────────────────────────────────────────────────────┤
│  TinyMCE ←→ YjsTinyMCEBinding ←→ Y.Text                     │
│  Navigation Tree ←→ YjsStructureTreeAdapter ←→ Y.Array      │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket (Socket.io)
                              │ /yjs namespace
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      NestJS Server                           │
├─────────────────────────────────────────────────────────────┤
│  YjsSyncGateway (WebSocket handler)                         │
│    ├── yjs-update: Broadcast document updates               │
│    ├── yjs-awareness: Broadcast user presence               │
│    └── request-sync: Send full document state               │
├─────────────────────────────────────────────────────────────┤
│  YjsStorageModule                                           │
│    ├── YjsPersistenceService (debounced update storage)     │
│    └── YjsSnapshotService (snapshots every 100 updates)     │
├─────────────────────────────────────────────────────────────┤
│  Database (SQLite/PostgreSQL/MariaDB)                       │
│    ├── projects: Project metadata + ownership               │
│    ├── yjs_documents: Yjs snapshots (BLOB)                  │
│    ├── yjs_updates: Incremental update log                  │
│    └── assets: File metadata + content hash                 │
└─────────────────────────────────────────────────────────────┘
```

## API Reference

### REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects` | Create new project |
| GET | `/api/projects` | List user's projects |
| GET | `/api/projects/:id` | Get project details |
| PUT | `/api/projects/:id` | Update project metadata |
| DELETE | `/api/projects/:id` | Delete project |
| GET | `/api/projects/:id/yjs-document` | Get Yjs document state |
| POST | `/api/projects/:id/yjs-document` | Store Yjs update |
| POST | `/api/projects/:id/snapshot` | Force create snapshot |
| POST | `/api/projects/:id/collaborators` | Add collaborator |
| DELETE | `/api/projects/:id/collaborators/:id` | Remove collaborator |
| POST | `/api/projects/:id/assets` | Upload asset |
| GET | `/api/projects/:id/assets` | List assets |
| GET | `/api/projects/:id/assets/:assetId` | Download asset |

### WebSocket Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `join-project` | Client→Server | `{ projectId, authToken }` |
| `yjs-update` | Bidirectional | `{ update: Uint8Array }` |
| `yjs-awareness` | Bidirectional | `{ state: Object }` |
| `request-sync` | Client→Server | `{}` |
| `sync-response` | Server→Client | `{ state: Uint8Array }` |
| `lock-acquired` | Server→Client | `{ componentId, userId }` |
| `lock-released` | Server→Client | `{ componentId }` |

## Troubleshooting

### "Yjs modules not loaded"
Make sure `yjs-loader.js` is included before calling any Yjs functions.

### "WebSocket connection failed"
Check that the server is running and the `/yjs` namespace is accessible.

### "Lock acquisition failed"
Another user is editing the iDevice. Wait for them to finish or check the lock timeout (5 minutes).

### "IndexedDB error"
The browser may have storage limits. Clear old project data or increase quota.
