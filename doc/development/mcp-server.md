# MCP Server

The eXeLearning MCP (Model Context Protocol) server enables AI agents like Claude Desktop, VS Code Copilot, and other MCP-compatible clients to interact programmatically with eXeLearning projects.

## Architecture

The MCP server is integrated into the existing Elysia HTTP server, using the Streamable HTTP transport.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Elysia Server (Port 8080)                   │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  /api/v1/*      │   /yjs/*        │   /mcp/*                    │
│  REST API       │   WebSocket     │   MCP Endpoints             │
│  (LMS, mobile)  │   (UI browser)  │   (AI agents)               │
└────────┬────────┴────────┬────────┴────────────┬────────────────┘
         │                 │                      │
         │                 │                      ▼
         │                 │             ┌────────────────────┐
         │                 │             │    MCP Server      │
         │                 │             │  (McpServer SDK)   │
         │                 │             └─────────┬──────────┘
         │                 │                       │
         └────────────┬────┴───────────────────────┘
                      ▼
         ┌────────────────────────────┐
         │      API v1 Services       │
         └────────────────────────────┘
```

## Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/mcp/health` | GET | No | Health check with session count |
| `/mcp/info` | GET | Yes | Server info, tools, resources, prompts |
| `/mcp` | POST/GET/DELETE | Yes | Main MCP message endpoint |

## Authentication

The MCP server uses the same JWT authentication as the REST API:

```http
Authorization: Bearer <jwt-token>
```

**Important**: Guest users are not allowed to access MCP endpoints. Only authenticated users with password/CAS/OpenID login can use MCP tools.

## Source Files

```
src/
├── mcp/
│   ├── server.ts            # MCP server factory with session management
│   ├── types.ts             # TypeScript interfaces
│   ├── tools/
│   │   ├── index.ts         # Tool re-exports
│   │   ├── projects.ts      # Project CRUD tools
│   │   ├── pages.ts         # Page CRUD tools
│   │   ├── blocks.ts        # Block CRUD tools
│   │   ├── components.ts    # Component CRUD tools
│   │   ├── metadata.ts      # Metadata tools
│   │   └── export.ts        # Export tools
│   ├── resources/
│   │   ├── index.ts         # Resource registry
│   │   └── catalog.ts       # Catalog resources (idevices, themes)
│   └── prompts/
│       └── index.ts         # Prompt templates
└── routes/
    └── mcp.ts               # HTTP endpoints for MCP
```

## Tools

### Project Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `projects/list` | List user projects | `limit?`, `offset?`, `search?` |
| `projects/create` | Create new project | `title` |
| `projects/get` | Get project by UUID | `uuid` |
| `projects/update` | Update project title | `uuid`, `title` |
| `projects/delete` | Delete project | `uuid` |
| `projects/duplicate` | Duplicate project | `uuid`, `newTitle?` |

### Page Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `pages/list` | List pages in project | `projectUuid` |
| `pages/create` | Create new page | `projectUuid`, `name`, `parentId?`, `order?` |
| `pages/get` | Get page by ID | `projectUuid`, `pageId` |
| `pages/update` | Update page | `projectUuid`, `pageId`, `name?`, `order?` |
| `pages/delete` | Delete page | `projectUuid`, `pageId` |
| `pages/move` | Move page | `projectUuid`, `pageId`, `newParentId`, `newOrder?` |

### Block Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `blocks/list` | List blocks in page | `projectUuid`, `pageId` |
| `blocks/create` | Create new block | `projectUuid`, `pageId`, `name?`, `order?` |
| `blocks/get` | Get block by ID | `projectUuid`, `blockId` |
| `blocks/update` | Update block | `projectUuid`, `blockId`, `name?`, `order?` |
| `blocks/delete` | Delete block | `projectUuid`, `blockId` |
| `blocks/move` | Move block | `projectUuid`, `blockId`, `newPageId`, `newOrder?` |

### Component Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `components/list` | List components in block | `projectUuid`, `blockId` |
| `components/create` | Create component (iDevice) | `projectUuid`, `blockId`, `ideviceType`, `initialData?` |
| `components/get` | Get component by ID | `projectUuid`, `componentId` |
| `components/update` | Update component | `projectUuid`, `componentId`, `title?`, `htmlContent?` |
| `components/setHtml` | Set HTML content | `projectUuid`, `componentId`, `html` |
| `components/delete` | Delete component | `projectUuid`, `componentId` |

### Metadata Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `metadata/get` | Get project metadata | `projectUuid` |
| `metadata/update` | Update metadata | `projectUuid`, `title?`, `author?`, `description?`, ... |

### Export Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `export/formats` | List export formats | - |
| `export/generate` | Generate export URL | `projectUuid`, `format` |

## Resources

| URI Pattern | Description |
|-------------|-------------|
| `project://{uuid}/structure` | Project structure (pages, blocks, components) |
| `project://{uuid}/metadata` | Project metadata |
| `exelearning://idevices` | Available iDevice types |
| `exelearning://themes` | Available themes |
| `exelearning://export-formats` | Available export formats |

## Prompts

| Prompt | Description | Arguments |
|--------|-------------|-----------|
| `create-course` | Create structured course | `title`, `modules?`, `language?`, `includeIntro?`, `includeSummary?` |
| `add-content` | Add content to page | `projectUuid`, `pageId`, `contentType`, `topic?` |
| `export-for-lms` | Export for LMS | `projectUuid`, `lmsType?` |
| `review-project` | Review project quality | `projectUuid` |
| `translate-project` | Translate project | `projectUuid`, `targetLanguage` |

## Session Management

MCP sessions are managed per-user with automatic cleanup:

```typescript
// Sessions stored in memory with user association
const sessions = new Map<string, { server: McpServer; userId: number; createdAt: Date }>();

// Session ID from header or auto-generated
const sessionId = headers['mcp-session-id'] || crypto.randomUUID();
```

Sessions are cleaned up on:
- Server shutdown (graceful)
- Explicit session close (DELETE /mcp)

## Dependencies

```json
{
  "@modelcontextprotocol/sdk": "^1.12.1",
  "zod": "^3.24.1"
}
```

## Testing

```bash
# Run MCP tests
DB_PATH=:memory: ELYSIA_FILES_DIR=/tmp/exelearning-test bun test src/mcp/

# Run route tests
DB_PATH=:memory: ELYSIA_FILES_DIR=/tmp/exelearning-test bun test src/routes/mcp.spec.ts
```

## Tool Name Convention

Tool names use `/` as separator for logical grouping (e.g., `projects/list`, `pages/create`). The MCP SDK shows validation warnings about this, but the tools function correctly. This is an intentional design choice for better organization and discoverability.

## Error Handling

All tools return responses in a standard format:

```typescript
// Success
{
  success: true,
  data: { ... }
}

// Error
{
  success: false,
  error: {
    code: "NOT_FOUND" | "FORBIDDEN" | "VALIDATION_ERROR" | "INTERNAL_ERROR",
    message: "Human-readable error message"
  }
}
```

## Security Considerations

1. **Authentication Required**: All MCP endpoints except `/mcp/health` require valid JWT
2. **No Guest Access**: Guest users are explicitly blocked from MCP access
3. **Project Ownership**: Users can only access their own projects
4. **Input Validation**: All tool inputs validated with Zod schemas
5. **Rate Limiting**: Standard API rate limits apply

## Related Documentation

- [REST API Documentation](./rest-api.md)
- [Authentication](./authentication.md)
- [User Guide for MCP](../mcp/README.md)
