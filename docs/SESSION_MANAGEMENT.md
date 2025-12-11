# Session Management Architecture

## Overview

This document describes the refactored session management system in eXeLearning v4.0. The system has been redesigned to provide clear, consistent handling of user sessions across Login, New Project, and Open File workflows.

## Architecture Goals

1. **Centralized Logic**: All session management logic in one place (`SessionManagerService`)
2. **Dirty State Tracking**: Explicit tracking of unsaved changes (`projectState.isDirty`)
3. **Predictable Behavior**: Consistent decision-making for "Save changes?" dialogs
4. **Clean UI State**: Complete DOM reset when creating new projects or opening files

---

## Backend Architecture

### SessionManagerService

**Location**: `src/modules/session/session-manager.service.ts`

Centralized service that handles all session lifecycle operations.

#### Key Methods:

| Method | Purpose | Returns |
|--------|---------|---------|
| `createBlankSession(userEmail, clientIp)` | Create new blank session with "Home" page | Session IDs |
| `isSessionBlank(odeSessionId)` | Check if session only has default content | boolean |
| `canAutoCloseSession(odeSessionId, userEmail)` | Comprehensive session state check | SessionCheckResult |
| `closeSession(odeSessionId)` | Close session and cleanup all resources | Delete counts |

#### SessionCheckResult

```typescript
{
  canAutoClose: boolean;      // true if blank AND no other users
  requiresSave: boolean;      // true if session has content
  isBlank: boolean;           // true if only "Home" page with no blocks
  hasOtherUsers: boolean;     // true if other users in session
}
```

### Blank Session Detection

A session is considered **blank** if:
- **No navigation nodes exist**, OR
- **Exactly 1 node** named "Home" with **no page blocks**

This logic is centralized in `SessionManagerService.isSessionBlank()`.

---

## Frontend Architecture

### Project State (projectState.js)

**Location**: `symfony_legacy/public/app/workarea/project/projectState.js`

Global state object for tracking project changes.

#### Properties:

```javascript
{
  isDirty: boolean,          // Has unsaved changes?
  odeSessionId: string,      // Current session ID
  odeId: string,             // Current ODE ID
  odeVersionId: string       // Current version ID
}
```

#### Methods:

| Method | When to Call |
|--------|-------------|
| `markDirty()` | After ANY content modification |
| `markClean()` | After successful save or loading new project |
| `setSessionIds()` | When session IDs are assigned |
| `reset()` | When creating new blank project |

### Project Manager (projectManager.js)

**Location**: `symfony_legacy/public/app/workarea/project/projectManager.js`

#### New Method: `resetProject()`

**Purpose**: Completely clear all previous project state before loading new content.

**What it clears**:
- Project state (calls `projectState.reset()`)
- Structure menu (navigation tree)
- Content area iDevices
- iDevice panels
- Project properties form
- Selected node state

**When called**: At the start of `openLoad()` before loading any new project.

---

## Workflow Diagrams

### 1. Login Flow

```
User Login
    ↓
GET /api/current-ode-users-management/current-ode-user/user/get
    ↓
CurrentOdeUsersController.getCurrentOdeUsersForUser()
    ├─ Existing session found?
    │   YES: Update lastAction, return session
    │   NO:  SessionManager.createBlankSession()
    │        ├─ Generate IDs (odeId, odeVersionId, odeSessionId)
    │        ├─ Create CurrentOdeUsers DB record
    │        ├─ ProjectOpenService.createBlankSession() (in-memory)
    │        └─ Return session IDs
    ↓
Frontend: projectManager.loadCurrentProject()
    ├─ Store odeSession, odeId, odeVersion
    ├─ projectState.setSessionIds()
    ├─ projectState.markClean()
    └─ Continue loading (openLoad → resetProject → load structure)
```

### 2. "New" Button Flow

```
User clicks "File → New"
    ↓
navbarFile.newSession()
    ↓
POST /api/current-ode-users-management/current-ode-user/check/current/users/ode/session/id
    ↓
CurrentOdeUsersController.checkCurrentOdeUsers()
    ├─ SessionManager.canAutoCloseSession()
    │   ├─ Check: isSessionBlank()
    │   ├─ Check: hasOtherUsers()
    │   └─ Return: { canAutoClose, requiresSave, isBlank, hasOtherUsers }
    └─ Return session check result
    ↓
Frontend Decision:
    ├─ Check: projectState.isDirty
    ├─ Check: response.canAutoClose
    └─ Decision:
        IF (canAutoClose && !isDirty)
            → createSession() directly (no dialog)
        ELSE
            → Show "Save changes?" dialog

IF User chooses "Create without saving":
    ↓
    POST /api/ode-management/odes/ode/session/close
    ↓
    SessionManager.closeSession()
        ├─ Mark CurrentOdeUsers as inactive
        ├─ Soft-delete nav/pag/component structures
        └─ Remove from in-memory sessions
    ↓
    loadCurrentProject() → GET new session
    ↓
    openLoad()
        ├─ resetProject() ← CLEARS ALL DOM
        ├─ Load new blank structure
        ├─ projectState.setSessionIds()
        └─ projectState.markClean()
```

### 3. "Open" File Flow

```
User clicks "File → Open" → Selects file
    ↓
POST /api/current-ode-users-management/current-ode-user/check/current/users/ode/session/id
    ↓
CurrentOdeUsersController.checkCurrentOdeUsers()
    └─ Return session check result
    ↓
Frontend Decision:
    ├─ Check: projectState.isDirty
    ├─ Check: response.canAutoClose
    └─ Decision:
        IF (canAutoClose && !isDirty)
            → Upload file directly (no dialog)
        ELSE
            → Show "Save changes?" dialog

IF User chooses "Open without saving":
    ↓
    modalOpenUserOdeFiles.largeFilesUpload(file)
        ├─ Upload file in chunks to current session directory
        └─ POST /api/local-ode-files-management/local-ode-files/post
    ↓
    ProjectOpenService.openElpFile()
        ├─ Check: SessionManager.isSessionBlank() ← Uses centralized detection
        ├─ IF blank: Mark session for closing
        ├─ Generate NEW session ID
        ├─ Extract file to NEW directory
        ├─ Parse content.xml
        ├─ Persist structures to database
        ├─ Create NEW session in memory
        └─ Close OLD session (delete old directories)
    ↓
    openLoad()
        ├─ resetProject() ← CLEARS ALL DOM
        ├─ Load structure from opened file
        ├─ projectState.setSessionIds()
        └─ projectState.markClean()
```

---

## Decision Matrix: Show "Save Changes?" Dialog

| Scenario | `isDirty` | `isBlank` | `hasOtherUsers` | `canAutoClose` | **Show Dialog?** |
|----------|-----------|-----------|-----------------|----------------|------------------|
| Fresh login, no edits | `false` | `true` | `false` | `true` | **NO** - Auto-proceed |
| Blank session, edited content | `true` | `false` | `false` | `false` | **YES** - Has changes |
| Blank session, no edits | `false` | `true` | `false` | `true` | **NO** - Auto-proceed |
| Has pages, no edits | `false` | `false` | `false` | `false` | **YES** - Has content |
| Has pages, edited | `true` | `false` | `false` | `false` | **YES** - Has changes |
| Collaborative session | any | any | `true` | `false` | **YES** - Other users |

**Simple Rule**:
```javascript
if (canAutoClose && !isDirty) {
  // Auto-proceed (no dialog)
} else {
  // Show "Save changes?" dialog
}
```

---

## Key Files Modified

### Backend

| File | Changes |
|------|---------|
| `src/modules/session/session-manager.service.ts` | **NEW** - Centralized session logic |
| `src/modules/session/session.module.ts` | **NEW** - Session module |
| `src/app.module.ts` | Import SessionModule |
| `src/modules/current-ode-users/controllers/current-ode-users.controller.ts` | Refactored to use SessionManager |
| `src/modules/current-ode-users/current-ode-users.module.ts` | Import SessionModule |
| `src/modules/project/services/project-open.service.ts` | Use SessionManager.isSessionBlank() |
| `src/modules/project/project.module.ts` | Import SessionModule |

### Frontend

| File | Changes |
|------|---------|
| `symfony_legacy/public/app/workarea/project/projectState.js` | **NEW** - Dirty state tracking |
| `symfony_legacy/public/app/workarea/project/projectManager.js` | Added `resetProject()`, integrate projectState |
| `symfony_legacy/public/app/workarea/menus/navbar/items/navbarFile.js` | Check isDirty + canAutoClose |
| `symfony_legacy/public/app/workarea/modals/modals/pages/modalOpenUserOdeFiles.js` | Check isDirty + canAutoClose |

---

## API Changes

### POST /api/current-ode-users-management/current-ode-user/check/current/users/ode/session/id

**New Response Fields**:

```json
{
  "responseMessage": "OK",
  "canAutoClose": true,          // NEW: Can auto-close without asking?
  "requiresSave": false,         // NEW: Has unsaved content?
  "isBlank": true,               // NEW: Only has "Home" page?
  "hasOtherUsers": false,        // NEW: Other users in session?

  // Legacy fields (kept for backwards compatibility):
  "leaveEmptySession": true,
  "usersInSession": 1,
  "otherUsers": 0
}
```

**Backwards Compatibility**: Legacy fields still present, so old frontend code continues to work.

---

## Future Enhancements

### TODO: Integrate markDirty() Calls

Currently `projectState.isDirty` must be manually set. Need to integrate `markDirty()` calls in:

1. **Page Operations**:
   - Add page: `structureEngine.addNode()`
   - Delete page: `structureEngine.deleteNode()`
   - Rename page: `structureEngine.renameNode()`
   - Move page: `structureEngine.moveNode()`

2. **iDevice Operations**:
   - Add iDevice: `idevicesEngine.add()`
   - Delete iDevice: `idevicesEngine.delete()`
   - Edit iDevice content: TinyMCE onChange events

3. **Project Properties**:
   - Change title: `projectProperties.setTitle()`
   - Change author: `projectProperties.setAuthor()`
   - Change language: `projectProperties.setLanguage()`

4. **Save Operations**:
   - On successful save: `projectState.markClean()`

### Example Integration:

```javascript
// In structureEngine.addNode()
addNode(params) {
  // ... existing add node logic ...

  // Mark project as dirty
  if (window.eXeLearning?.app?.projectState) {
    window.eXeLearning.app.projectState.markDirty();
  }
}
```

---

## Testing Checklist

- [ ] **Login Flow**
  - [ ] Login with no existing session → Creates blank session
  - [ ] Login with existing session → Reuses session
  - [ ] Session IDs stored in projectState

- [ ] **New Button**
  - [ ] Click "New" with blank session, no edits → Creates new session directly (no dialog)
  - [ ] Click "New" with content, no edits → Shows dialog
  - [ ] Click "New" with blank session, has edits → Shows dialog
  - [ ] After creating new session, DOM is completely cleared

- [ ] **Open File**
  - [ ] Open file with blank session, no edits → Opens directly (no dialog)
  - [ ] Open file with content, no edits → Shows dialog
  - [ ] Open file with blank session, has edits → Shows dialog
  - [ ] After opening file, DOM is completely cleared
  - [ ] Old session content does not appear in new session

- [ ] **Dirty State**
  - [ ] Add page → projectState.isDirty = true (when integrated)
  - [ ] Edit iDevice → projectState.isDirty = true (when integrated)
  - [ ] Save project → projectState.isDirty = false (when integrated)

---

## Migration Notes

### For Developers

**Before this refactor**:
- Session detection logic duplicated in multiple places
- No explicit dirty state tracking
- Inconsistent dialog showing behavior
- DOM not properly cleared between projects

**After this refactor**:
- Single source of truth: `SessionManagerService`
- Explicit dirty state: `projectState.isDirty`
- Predictable dialog logic based on `canAutoClose && !isDirty`
- Complete DOM reset via `projectManager.resetProject()`

### Breaking Changes

**None** - This refactor maintains backwards compatibility:
- Legacy API response fields still present
- Frontend falls back to `leaveEmptySession` if `canAutoClose` not available
- Existing code paths continue to work

### Performance Impact

**Minimal** - Session checks now use database queries instead of complex logic, but:
- Queries are simple (indexed lookups)
- Only called on user action (not polling)
- In-memory session map unchanged

---

## Troubleshooting

### Issue: "New" still shows old content

**Cause**: `resetProject()` not being called or not clearing all DOM elements.

**Fix**: Check console for `[ProjectManager] Resetting project` log. Verify selectors in `resetProject()` match actual DOM structure.

### Issue: Dialog shows even for blank session

**Cause**: `isDirty` flag not being reset properly.

**Fix**: Check that `projectState.markClean()` is called in `loadCurrentProject()`.

### Issue: Session marked as non-blank incorrectly

**Cause**: "Home" page has blocks added by auto-creation.

**Fix**: Verify `SessionManagerService.isSessionBlank()` checks both `navNodes.length === 0` OR `(navNodes.length === 1 && pagBlocks.length === 0)`.

---

## Summary

The refactored session management system provides:

✅ **Centralized Logic** - One service for all session operations
✅ **Explicit State** - Clear dirty state tracking
✅ **Predictable Behavior** - Consistent decision-making
✅ **Clean Transitions** - Complete DOM reset between projects
✅ **Backwards Compatible** - No breaking changes
✅ **Well Documented** - Clear workflows and decision matrix

This foundation enables future enhancements like real-time collaboration, better autosave, and more sophisticated change tracking.
