# eXeLearning MCP Server User Guide

This guide explains how to connect AI agents (Claude Desktop, VS Code Copilot, etc.) to eXeLearning using the Model Context Protocol (MCP).

## What is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io/) is an open standard that allows AI applications to securely connect to external tools and data sources. eXeLearning implements an MCP server that exposes:

- **Tools**: Actions like creating projects, adding pages, managing content
- **Resources**: Data like project structure, available iDevices, themes
- **Prompts**: Pre-built templates for common educational content tasks

## Prerequisites

1. eXeLearning server running (local or remote)
2. User account with password authentication (guest accounts are not supported)
3. MCP-compatible AI client (Claude Desktop, VS Code with Copilot, etc.)

## Getting a JWT Token

Before connecting, you need to obtain a JWT authentication token:

```bash
# Login to get a token
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "your@email.com", "password": "your-password"}'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 604800
}
```

Save the `access_token` for configuration.

## Claude Desktop Configuration

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

### Local Server (Development)

```json
{
  "mcpServers": {
    "exelearning": {
      "url": "http://localhost:8080/mcp",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoidXNlckBleGVsZWFybmluZy5uZXQiLCJyb2xlcyI6WyJST0xFX1VTRVIiXSwiaXNHdWVzdCI6ZmFsc2UsImV4cCI6MTc2NTY2OTMyNSwiaWF0IjoxNzY1MDY0NTI1fQ.SlIQvzrGxl0uiaDAj5o-pPsiHz-sgRPlwMi4Bo-zGnw"
      }
    }
  }
}
```

Replace the token with your actual JWT token obtained from the login endpoint.

### Remote Server (Production)

```json
{
  "mcpServers": {
    "exelearning": {
      "url": "https://your-exelearning-server.com/mcp",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer YOUR_JWT_TOKEN_HERE"
      }
    }
  }
}
```

### Multiple Servers

You can connect to multiple eXeLearning instances:

```json
{
  "mcpServers": {
    "exelearning-local": {
      "url": "http://localhost:8080/mcp",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer LOCAL_JWT_TOKEN"
      }
    },
    "exelearning-production": {
      "url": "https://exelearning.example.com/mcp",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer PRODUCTION_JWT_TOKEN"
      }
    }
  }
}
```

## VS Code Configuration

### Using Copilot Chat with MCP

VS Code with GitHub Copilot supports MCP servers. Add to your VS Code settings:

**File**: `.vscode/settings.json` (workspace) or User Settings

```json
{
  "github.copilot.chat.mcpServers": {
    "exelearning": {
      "url": "http://localhost:8080/mcp",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer YOUR_JWT_TOKEN_HERE"
      }
    }
  }
}
```

### Using Claude Code Extension

If using the Claude Code extension for VS Code:

```json
{
  "claude.mcpServers": {
    "exelearning": {
      "url": "http://localhost:8080/mcp",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer YOUR_JWT_TOKEN_HERE"
      }
    }
  }
}
```

## Cursor IDE Configuration

Add to your Cursor settings (`~/.cursor/mcp.json` or workspace `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "exelearning": {
      "url": "http://localhost:8080/mcp",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer YOUR_JWT_TOKEN_HERE"
      }
    }
  }
}
```

## Windsurf Configuration

Add to your Windsurf MCP configuration:

```json
{
  "mcpServers": {
    "exelearning": {
      "serverUrl": "http://localhost:8080/mcp",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer YOUR_JWT_TOKEN_HERE"
      }
    }
  }
}
```

## Other MCP Clients

Any MCP-compatible client can connect to eXeLearning using these parameters:

| Parameter | Value |
|-----------|-------|
| **URL** | `http://localhost:8080/mcp` (or your server URL) |
| **Transport** | `streamable-http` |
| **Auth Header** | `Authorization: Bearer <JWT_TOKEN>` |

### Example: Generic MCP Client

```javascript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client({
  name: "my-client",
  version: "1.0.0",
});

const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:8080/mcp"),
  {
    requestInit: {
      headers: {
        "Authorization": "Bearer YOUR_JWT_TOKEN_HERE",
      },
    },
  }
);

await client.connect(transport);

// List available tools
const tools = await client.listTools();
console.log(tools);

// Call a tool
const result = await client.callTool({
  name: "projects.list",
  arguments: { limit: 10 },
});
console.log(result);
```

## Available Tools

### Project Management

| Tool | Description |
|------|-------------|
| `projects.list` | List all your projects |
| `projects.create` | Create a new project |
| `projects.get` | Get project details |
| `projects.update` | Update project title |
| `projects.delete` | Delete a project |
| `projects.duplicate` | Duplicate a project |

### Page Management

| Tool | Description |
|------|-------------|
| `pages.list` | List pages in a project |
| `pages.create` | Create a new page |
| `pages.get` | Get page details |
| `pages.update` | Update page name/order |
| `pages.delete` | Delete a page |
| `pages.move` | Move page to new location |

### Content Management

| Tool | Description |
|------|-------------|
| `blocks.list` | List blocks in a page |
| `blocks.create` | Create a new block |
| `components.list` | List components in a block |
| `components.create` | Add an iDevice (text, quiz, etc.) |
| `components.setHtml` | Update component HTML content |

### Metadata & Export

| Tool | Description |
|------|-------------|
| `metadata.get` | Get project metadata |
| `metadata.update` | Update author, description, etc. |
| `export.formats` | List available export formats |
| `export.generate` | Get export download URL |

## Available Resources

| Resource URI | Description |
|--------------|-------------|
| `project://{uuid}/structure` | Complete project structure |
| `project://{uuid}/metadata` | Project metadata |
| `exelearning://idevices` | Available iDevice types |
| `exelearning://themes` | Available themes |
| `exelearning://export-formats` | Export format options |

## Built-in Prompts

### create-course

Creates a structured course with multiple modules.

**Arguments:**
- `title` (required): Course title
- `modules`: Number of modules (default: 3)
- `language`: Language code (default: "en")
- `includeIntro`: Include introduction page (default: "yes")
- `includeSummary`: Include summary page (default: "yes")

### add-content

Adds educational content to a page.

**Arguments:**
- `projectUuid` (required): Project UUID
- `pageId` (required): Target page ID
- `contentType` (required): Type of content (text, quiz, reflection, gallery, multimedia)
- `topic`: Content topic/subject

### export-for-lms

Exports project for a specific LMS.

**Arguments:**
- `projectUuid` (required): Project UUID
- `lmsType`: Target LMS (moodle, canvas, blackboard)

### review-project

Reviews project for quality and accessibility.

**Arguments:**
- `projectUuid` (required): Project UUID

### translate-project

Translates project content.

**Arguments:**
- `projectUuid` (required): Project UUID
- `targetLanguage` (required): Target language code

## Usage Examples

### Example 1: Create a New Course

Ask Claude:
> "Create a new eXeLearning course called 'Introduction to Python Programming' with 5 modules"

Claude will use the MCP tools to:
1. Create a new project
2. Add pages for each module
3. Structure the content appropriately

### Example 2: Add Quiz Content

Ask Claude:
> "Add a multiple choice quiz about variables to the 'Module 2' page in project abc-123"

Claude will:
1. Find the correct page
2. Create a new block
3. Add a question iDevice with the quiz content

### Example 3: Export for Moodle

Ask Claude:
> "Export project xyz-789 as SCORM 1.2 for Moodle"

Claude will:
1. Check export formats
2. Generate the export
3. Provide the download URL

### Example 4: Review Project Structure

Ask Claude:
> "Review the structure of my project abc-123 and suggest improvements"

Claude will:
1. Read the project structure resource
2. Analyze the organization
3. Provide recommendations

## Troubleshooting

### "401 Unauthorized" Error

Your JWT token may have expired. Get a new token:

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "your@email.com", "password": "your-password"}'
```

### "403 Forbidden" Error

Guest accounts cannot use MCP. Ensure you're logged in with a password-authenticated account.

### Connection Refused

1. Check that eXeLearning server is running
2. Verify the URL in your configuration
3. Check firewall settings

### Tool Not Found

Update to the latest version of eXeLearning which includes MCP support.

## Server Health Check

You can verify the MCP server is running:

```bash
curl http://localhost:8080/mcp/health
```

Response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "activeSessions": 0
  }
}
```

## Security Notes

1. **Keep your JWT token secure** - treat it like a password
2. **Token expiration** - tokens expire after 7 days by default
3. **HTTPS recommended** - use HTTPS for production servers
4. **Network access** - only expose the MCP endpoint to trusted networks

## API Reference

For detailed API documentation, see [MCP Server Technical Documentation](../development/mcp-server.md).
