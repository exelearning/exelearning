# Real-Time Collaboration

eXeLearning uses [Yjs](https://yjs.dev/) for real-time collaborative editing with WebSocket transport. This enables multiple users to edit the same project simultaneously with automatic conflict resolution.

## Architecture Overview

eXeLearning implements a **stateless relay architecture**:

- **No Y.Doc on server**: The server doesn't maintain document state in memory
- **Client is the source of truth**: Each client holds the authoritative Y.Doc in memory + IndexedDB
- **Explicit saves only**: Content persists to server only when user clicks save
- **Binary Yjs protocol**: Efficient sync using Yjs encoding

```
┌─────────────┐      WebSocket       ┌─────────────┐
│  Client A   │◄───────────────────►│   Server    │
│  (Y.Doc)    │   Binary messages   │   (Relay)   │
└─────────────┘                      └──────┬──────┘
                                            │
┌─────────────┐      WebSocket             │
│  Client B   │◄───────────────────────────┘
│  (Y.Doc)    │
└─────────────┘
```

## WebSocket Connection

### Endpoint

```
ws://hostname:port/yjs/project-{uuid}?token=JWT
```

- `project-{uuid}`: Document name (room identifier)
- `token`: JWT authentication token (required)

### Connection Lifecycle

1. **Connect**: Client opens WebSocket with JWT token
2. **Validate**: Server validates token and project access
3. **Join Room**: Client added to document room
4. **Sync**: Yjs sync protocol exchanges state
5. **Edit**: Changes broadcast to all room members
6. **Disconnect**: Client removed, room cleanup scheduled

### Authentication

The JWT token must be passed as a query parameter:

```javascript
const wsUrl = `ws://localhost:3000/yjs/project-${projectId}?token=${authToken}`;
const provider = new WebsocketProvider(wsUrl, `project-${projectId}`, ydoc);
```

**Error codes:**
- `4001`: Invalid token
- `4003`: Access denied to project

## Message Protocol

The server distinguishes between two message types:

### Yjs Sync Messages (Binary)

Standard Yjs sync protocol messages (bytes 0-2 prefix):

| Byte | Message Type |
|------|-------------|
| 0 | Sync Step 1 |
| 1 | Sync Step 2 |
| 2 | Update |

These are relayed to all other clients in the room.

### Asset Coordination Messages

Binary messages with `0xFF` prefix followed by JSON:

```javascript
// Client → Server
{ type: 'awareness-update', data: { availableAssets: ['uuid1', 'uuid2'] } }
{ type: 'request-asset', data: { assetId: 'uuid', priority: 75 } }
{ type: 'asset-uploaded', data: { assetId: 'uuid' } }

// Server → Client
{ type: 'upload-request', data: { assetId: 'uuid' } }
{ type: 'asset-ready', data: { assetId: 'uuid', url: '/api/...' } }
{ type: 'asset-not-found', data: { assetId: 'uuid' } }
```

## Frontend Integration

### YjsDocumentManager

Central manager for Yjs documents:

```javascript
const manager = new YjsDocumentManager(projectId, {
    wsUrl: 'ws://localhost:3000/yjs',
    apiUrl: '/api',
    token: authToken,
    offline: false  // Set true to skip WebSocket
});

await manager.initialize({ isNewProject: false });

// Access Y.Doc structures
const navigation = manager.getNavigation();  // Y.Array
const properties = manager.getProperties();  // Y.Map

// Save to server (explicit)
await manager.saveToServer();

// Cleanup
manager.destroy();
```

### IndexedDB Persistence

Documents are persisted locally using `y-indexeddb`:

```javascript
// Automatic: YjsDocumentManager handles this
const idbProvider = new IndexeddbPersistence(
    `exelearning-project-${projectId}`,
    ydoc
);

await idbProvider.whenSynced;  // Wait for local data load
```

### Awareness (User Presence)

Track other users' cursor positions and states:

```javascript
const awareness = manager.awareness;

// Set local state
awareness.setLocalStateField('user', {
    name: 'John',
    color: '#ff0000'
});

// Listen for changes
awareness.on('change', () => {
    const states = awareness.getStates();
    // Update UI with user cursors
});
```

## Asset Coordination

When collaborating, assets are shared between clients:

### P2P Flow

1. **Announce**: Clients send `awareness-update` with available assets
2. **Request**: Client sends `request-asset` when missing an asset
3. **Coordinate**: Server finds peer with asset, sends `upload-request`
4. **Upload**: Peer uploads asset via REST API
5. **Ready**: Server broadcasts `asset-ready` to requesters

### Priority Queue

Assets are prioritized for responsive UI:

```javascript
const PRIORITY = {
    CRITICAL: 100,  // Blocking current render
    HIGH: 75,       // Current page
    MEDIUM: 50,     // Nearby pages
    LOW: 25,        // Prefetch
    IDLE: 0         // Normal save
};
```

## Room Management

### Room Lifecycle

- Rooms are created when first client connects
- Multiple clients can join the same room
- Cleanup is scheduled 30 seconds after last client disconnects
- Cleanup is cancelled if client reconnects within 30 seconds

### Heartbeat

WebSocket connections use ping/pong for health:

| Environment | Ping Interval |
|-------------|---------------|
| Desktop | 60s |
| Server | 30s |

Server uses shorter interval to avoid proxy timeouts.

## Testing Collaboration

### Default Test Users

Two users are created for testing:

- **User 1**: `user@exelearning.net` / `1234`
- **User 2**: `user2@exelearning.net` / `1234`

### Testing Steps

1. Open browser window 1, login as User 1
2. Open project
3. Open browser window 2 (incognito), login as User 2
4. Open same project
5. Edit in both windows - changes sync in real-time

### Automated Testing

```bash
# Run unit tests
make test-unit

# Test WebSocket specifically
DB_PATH=:memory: bun test src/websocket/
```

## Configuration

### Environment Variables

```bash
# WebSocket endpoint is automatically determined from APP_PORT
APP_PORT=8080

# JWT secret for token validation
APP_SECRET=your-secret-key

# Base path (if app is in subdirectory)
BASE_PATH=/exelearning
```

### Desktop vs Server

Different timeouts are used:

```typescript
// Desktop (Electron)
const DESKTOP_CONFIG = {
    pingInterval: 60_000,
    cleanupDelay: 5_000
};

// Server
const SERVER_CONFIG = {
    pingInterval: 30_000,
    cleanupDelay: 30_000
};
```

## Troubleshooting

### Connection Issues

**WebSocket not connecting:**
- Check JWT token is valid and not expired
- Verify project UUID exists and user has access
- Check browser console for error codes (4001 = invalid token, 4003 = access denied)

**Connection drops frequently:**
- Check proxy timeout settings (should be > ping interval)
- For Nginx: `proxy_read_timeout 90s;`

### Sync Problems

**Changes not appearing:**
- Check both clients are connected (look for awareness)
- Verify WebSocket messages in Network tab
- Try refreshing to force full sync

**Conflict/data loss:**
- Yjs uses CRDT, conflicts are auto-resolved
- Check IndexedDB for local state
- Use `manager.saveToServer()` to persist

### Asset Loading

**Assets not loading for collaborators:**
- Check `awareness-update` messages being sent
- Verify asset exists in IndexedDB
- Check REST API endpoints for upload/download

**Slow asset sync:**
- Check priority queue (CRITICAL assets upload first)
- Verify network bandwidth
- Large files use chunked upload (>20MB)

## Key Files

| File | Purpose |
|------|---------|
| `src/websocket/yjs-websocket.ts` | WebSocket route handler |
| `src/websocket/room-manager.ts` | Room lifecycle management |
| `src/websocket/asset-coordinator.ts` | P2P asset coordination |
| `src/websocket/heartbeat.ts` | Connection keep-alive |
| `public/app/yjs/YjsDocumentManager.js` | Frontend Y.Doc manager |
| `public/app/yjs/AssetWebSocketHandler.js` | Asset protocol handler |

## Further Reading

- [Architecture Overview](../architecture.md) - System architecture
- [Yjs Documentation](https://docs.yjs.dev/) - Official Yjs docs
- [y-websocket](https://github.com/yjs/y-websocket) - WebSocket provider
