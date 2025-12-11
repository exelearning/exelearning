# eXeLearning Architecture

This document describes the technical architecture of eXeLearning, an educational content authoring tool built with modern web technologies.

## 1. Overview

### Design Philosophy

eXeLearning follows a **browser-first architecture** where:

- **Client is the source of truth**: The browser holds the authoritative state in IndexedDB and in-memory Yjs documents
- **Server is for synchronization**: The server acts as a stateless relay, coordinating between clients without storing document state
- **Explicit saves only**: Content is persisted to the server only when the user explicitly saves
- **Offline-capable**: Users can work without network connectivity; sync happens when online

### Key Principles

1. **Zero server memory overhead**: No Y.Doc stored on server per document
2. **P2P asset coordination**: Assets shared between collaborating clients via server coordination
3. **Content-addressable assets**: Same file content = same ID across all users
4. **Dependency injection**: All services use DI pattern for testability

## 2. Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Runtime** | [Bun](https://bun.sh/) | Fast JavaScript runtime and package manager |
| **Framework** | [Elysia](https://elysiajs.com/) | Type-safe web framework |
| **ORM** | [Kysely](https://kysely.dev/) | Type-safe SQL query builder |
| **Database** | SQLite / PostgreSQL / MySQL | Multi-database support |
| **Real-time** | WebSocket + [Yjs](https://yjs.dev/) | Collaborative editing |
| **Frontend** | Vanilla JavaScript | No framework dependencies |
| **Storage** | IndexedDB | Client-side asset and document storage |
| **Templates** | Nunjucks | Server-side HTML rendering |
| **Desktop** | Electron | Cross-platform desktop application |

## 3. System Architecture

```mermaid
graph TB
    subgraph "Browser (Client)"
        UI[User Interface]
        YDoc["Y.Doc (in-memory)"]
        IDB[(IndexedDB)]
        AM[AssetManager]
        WSH[WebSocket Handler]

        UI --> YDoc
        YDoc <--> IDB
        AM <--> IDB
        UI --> AM
        WSH --> YDoc
        WSH --> AM
    end

    subgraph "Server (Elysia + Bun)"
        Routes[REST Routes]
        WS[WebSocket Relay]
        RM[Room Manager]
        AC[Asset Coordinator]
        SM[Session Manager]
        Kysely[Kysely ORM]

        Routes --> SM
        Routes --> Kysely
        WS --> RM
        WS --> AC
        AC --> Kysely
    end

    subgraph "Storage"
        DB[(Database)]
        FS[File System]
    end

    Browser <-->|"REST API"| Routes
    Browser <-->|"WebSocket (Yjs Binary)"| WS
    Kysely --> DB
    SM --> FS
```

### Request Flow

1. **Page Load**: Browser fetches HTML from REST API, renders workarea
2. **Document Open**: YjsDocumentManager initializes Y.Doc, syncs from IndexedDB
3. **WebSocket Connect**: y-websocket provider connects for real-time sync
4. **Editing**: Changes update Y.Doc → replicated to peers via WebSocket
5. **Save**: User clicks save → REST API persists Yjs state to database

## 4. WebSocket & Yjs Collaboration

### 4.1 Stateless Relay Architecture

The WebSocket server does NOT maintain Y.Doc state:

```
┌─────────────────────────────────────────────────────────────┐
│                    Traditional Architecture                  │
│  Client A ──► Server Y.Doc ◄── Client B                     │
│              (memory overhead)                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                eXeLearning Stateless Relay                   │
│  Client A ──────► Relay ◄────── Client B                    │
│  (Y.Doc)     (zero memory)      (Y.Doc)                     │
└─────────────────────────────────────────────────────────────┘
```

**Benefits:**
- No memory per document on server
- Scales to many concurrent documents
- Client IndexedDB provides offline persistence

### 4.2 Connection Flow

```mermaid
sequenceDiagram
    participant Client
    participant Server
    participant Room

    Client->>Server: WebSocket connect<br/>/yjs/project-{uuid}?token=JWT
    Server->>Server: Validate JWT token
    Server->>Server: Check project access
    Server->>Room: getOrCreateRoom()
    Room->>Room: Add connection
    Server->>Client: Connection established

    Client->>Server: Yjs sync step 1 (binary)
    Server->>Room: relayMessage() to other clients

    Note over Client,Server: Continuous sync during editing

    Client->>Server: Close connection
    Server->>Room: removeConnection()
    Room->>Room: Schedule cleanup (30s delay)
```

### 4.3 Message Protocol

The server distinguishes between two message types:

| Type | Detection | Handler |
|------|-----------|---------|
| **Yjs sync** | Binary, starts with bytes 0-2 | Relayed to room peers |
| **Asset protocol** | Binary with `0xFF` prefix + JSON | Handled by AssetCoordinator |

```typescript
// Message discrimination in message-parser.ts
if (message[0] === 0xFF) {
    // Asset protocol message
    const json = message.subarray(1);
    return { kind: 'asset', message: JSON.parse(json) };
}
// Default: Yjs binary message
return { kind: 'yjs', data: message };
```

### 4.4 Room Management

Rooms are created per document and track connected clients:

```typescript
interface Room {
    name: string;                    // "project-{uuid}"
    conns: Set<WebSocket>;           // Connected clients
    projectUuid: string;
    cleanupController?: AbortController;  // For cancellable cleanup
}
```

**Lifecycle:**
1. **Create**: First client connects → room created
2. **Active**: Messages relayed between clients
3. **Cleanup Scheduled**: Last client disconnects → 30s timer starts
4. **Cleanup Cancelled**: Client reconnects before timer → cancel cleanup
5. **Destroyed**: Timer fires → room deleted, assets cleaned up

### 4.5 Heartbeat & Keep-Alive

WebSocket connections use ping/pong for health checking:

| Environment | Ping Interval | Cleanup Delay |
|-------------|---------------|---------------|
| **Desktop** | 60s | 5s |
| **Server** | 30s | 30s |

The shorter server interval avoids proxy timeout issues (typically 60s).

## 5. Asset Management System

### 5.1 Browser-First Storage

Assets are stored primarily in IndexedDB on the client:

```javascript
// IndexedDB schema (exelearning-assets-v2)
{
    id: string,           // Content-addressable UUID
    projectId: string,    // Project reference
    blob: Blob,           // Actual file data
    mime: string,         // MIME type
    hash: string,         // SHA-256 hex
    size: number,
    uploaded: boolean,    // Server sync status
    filename: string
}
```

### 5.2 Content-Addressable URLs

Assets use deterministic IDs based on content hash:

```
asset://8f3e9c2a-1b4d-4f7e-9a3c-2d1e5f7a9b3c
asset://8f3e9c2a-1b4d-4f7e-9a3c-2d1e5f7a9b3c/photo.jpg
```

**Benefits:**
- Same file = same ID (deduplication)
- Idempotent uploads
- Efficient P2P sharing

### 5.3 P2P Asset Coordination

When multiple users collaborate, assets are shared via server coordination:

```mermaid
sequenceDiagram
    participant Alice as Alice (has asset)
    participant Server as Server
    participant Bob as Bob (needs asset)

    Alice->>Server: awareness-update<br/>["asset-1", "asset-2"]
    Note over Server: Track: Alice has asset-1, asset-2

    Bob->>Server: request-asset<br/>{assetId: "asset-1", priority: HIGH}
    Server->>Server: Check DB (not found)
    Server->>Server: Check peers (Alice has it)
    Server->>Alice: upload-request<br/>{assetId: "asset-1"}

    Alice->>Server: Upload asset-1 via REST
    Server->>Bob: asset-ready<br/>{assetId: "asset-1", url: "/api/..."}

    Bob->>Server: Download asset-1
    Bob->>Bob: Store in IndexedDB
```

### 5.4 Priority Queue System

Asset uploads are prioritized to ensure responsive UI:

| Priority | Value | Use Case |
|----------|-------|----------|
| CRITICAL | 100 | Asset needed for current render |
| HIGH | 75 | Asset on current page |
| MEDIUM | 50 | Asset on nearby pages |
| LOW | 25 | Background prefetch |
| IDLE | 0 | Normal save upload |

**Preemption rules:**
- Max 3 concurrent uploads per project
- Higher priority can preempt if: priority diff ≥ 50 AND upload running ≥ 2s

### 5.5 Save Flow

```mermaid
flowchart LR
    subgraph Browser
        A[User clicks Save] --> B[Get pending assets]
        B --> C[Create priority batches]
        C --> D[Upload batches in parallel]
        D --> E[Save Yjs state]
        E --> F[Mark assets uploaded]
    end

    subgraph Server
        D --> G[Store assets on disk]
        E --> H[Store Yjs snapshot in DB]
    end
```

**Batch configuration:**
- Critical: 1 asset per batch (fastest)
- High priority: max 5 files or 5MB per batch
- Normal: max 15 files or 10MB per batch
- Max concurrent batches: 5

## 6. Session Management

### 6.1 Session Lifecycle

Each opened project gets a unique session:

```typescript
interface ProjectSession {
    sessionId: string;        // UUID
    projectId: number;        // Database ID
    projectUuid: string;      // Project UUID
    sessionPath: string;      // tmp/{sessionId}/
    contentPath: string;      // Path to extracted content
    createdAt: Date;
    modifiedAt: Date;
}
```

Sessions are stored in-memory (`Map<sessionId, ProjectSession>`).

### 6.2 File System Structure

```
FILES_DIR/
├── tmp/{sessionId}/          # Temporary session directory
│   ├── content.xml           # Extracted ELP content
│   ├── assets/               # Uploaded assets
│   └── dist/                 # Export output
│
├── perm/odes/{projectId}/    # Permanent storage
│   └── assets/
│
└── data/
    └── chunks/{projectId}/   # Chunked upload temp storage
```

## 7. Export System

### 7.1 Supported Formats

| Format | Description | Use Case |
|--------|-------------|----------|
| **HTML5** | Self-contained website | Web hosting |
| **SCORM 1.2** | LMS package | Moodle, Blackboard (legacy) |
| **SCORM 2004** | LMS package | Modern LMS |
| **EPUB3** | E-book format | E-readers |
| **IMS CP** | Content package | Standards compliance |

### 7.2 Export Strategy Pattern

```typescript
interface ExportStrategy {
    export(session: ProjectSession, options: ExportOptions): Promise<string>;
    getManifest(): Promise<string>;
    copyAssets(): Promise<void>;
}

// Usage
const exporter = ExportFactory.create('scorm12');
const zipPath = await exporter.export(session, options);
```

## 8. Database Architecture

### 8.1 Multi-Database Support

Kysely ORM with dialect adapters:

```typescript
// src/db/dialect.ts
function createDialect(): Dialect {
    switch (process.env.DB_DRIVER) {
        case 'pdo_sqlite':
            return new BunWorkerDialect({ /* SQLite config */ });
        case 'pdo_pgsql':
            return new PostgresDialect({ /* PostgreSQL config */ });
        case 'pdo_mysql':
            return new MysqlDialect({ /* MySQL config */ });
    }
}
```

### 8.2 Query Pattern with Dependency Injection

All queries accept `db` as first parameter for testability:

```typescript
// src/db/queries/projects.ts
export async function findProjectByUuid(
    db: Kysely<Database>,
    uuid: string
): Promise<Project | undefined> {
    return db.selectFrom('projects')
        .where('uuid', '=', uuid)
        .selectAll()
        .executeTakeFirst();
}
```

**Testing with DI:**
```typescript
// In tests
configure({
    queries: { findProjectByUuid: mockFindProjectByUuid }
});

afterEach(() => resetDependencies());
```

## 9. Configuration

### 9.1 Environment Variables

Key configuration in `.env`:

```bash
# Server
APP_PORT=8080
APP_SECRET=your-jwt-secret

# Database
DB_DRIVER=pdo_sqlite          # pdo_sqlite | pdo_pgsql | pdo_mysql
DB_PATH=/mnt/data/exelearning.db

# File Storage
FILES_DIR=/mnt/data/

# Optional
BASE_PATH=/exelearning        # URL prefix for subdirectory install
APP_AUTH_METHODS=password     # password,cas,openid,guest
```

### 9.2 Desktop vs Server Configuration

| Setting | Desktop (Electron) | Server |
|---------|-------------------|--------|
| Ping interval | 60s | 30s |
| Cleanup delay | 5s | 30s |
| Compact threshold | 100 updates | 50 updates |
| WebSocket timeout | 70s | 40s |

## 10. Key File Locations

### Backend (src/)

| Path | Purpose |
|------|---------|
| `src/index.ts` | Elysia entry point |
| `src/routes/` | REST API routes |
| `src/services/` | Business logic |
| `src/db/client.ts` | Kysely instance |
| `src/db/queries/` | Database queries |
| `src/websocket/yjs-websocket.ts` | WebSocket handler |
| `src/websocket/room-manager.ts` | Room lifecycle |
| `src/websocket/asset-coordinator.ts` | P2P coordination |

### Frontend (public/app/)

| Path | Purpose |
|------|---------|
| `public/app/yjs/YjsDocumentManager.js` | Y.Doc management |
| `public/app/yjs/AssetManager.js` | IndexedDB storage |
| `public/app/yjs/AssetWebSocketHandler.js` | Asset protocol |
| `public/app/yjs/SaveManager.js` | Save orchestration |
| `public/app/yjs/YjsProjectBridge.js` | Coordination hub |

### Configuration

| Path | Purpose |
|------|---------|
| `.env` | Environment configuration |
| `tsconfig.json` | TypeScript config |
| `bunfig.toml` | Bun configuration |
| `Makefile` | Build commands |

## 11. Testing

### Test Strategy

- **Unit tests**: Next to source files (`*.spec.ts`)
- **Integration tests**: `test/integration/`
- **E2E tests**: Playwright
- **Coverage target**: 90%

### Running Tests

```bash
# Run all unit tests
make test-unit

# Run with coverage
make test-coverage

# Run specific test
DB_PATH=:memory: ELYSIA_FILES_DIR=/tmp/test bun test src/path/to/file.spec.ts
```

### DI Pattern for Testing

Never use `mock.module()`. Use dependency injection:

```typescript
// Configure mocks
configure({
    db: testDb,
    queries: { findById: mockFindById }
});

// Reset after test
afterEach(() => resetDependencies());
```

## 12. Security

### Authentication

- JWT tokens for API and WebSocket authentication
- Token passed in query string for WebSocket (`?token=JWT`)
- Multiple auth methods: password, CAS, OpenID Connect, guest

### Authorization

- Project access checked before WebSocket connection
- User ID tracked per connection for audit
- Path traversal prevention with `isPathSafe()`

### WebSocket Security

```typescript
// Connection validation
ws.on('open', async () => {
    const token = url.searchParams.get('token');
    const decoded = await verifyToken(token);
    if (!decoded) {
        ws.close(4001, 'Invalid token');
        return;
    }
    const hasAccess = await checkProjectAccess(db, decoded.userId, projectUuid);
    if (!hasAccess) {
        ws.close(4003, 'Access denied');
        return;
    }
});
```

---

## Further Reading

- [Real-Time Collaboration](development/real-time.md) - WebSocket and Yjs details
- [REST API](development/rest-api.md) - API endpoints
- [Testing](development/testing.md) - Test patterns and coverage

