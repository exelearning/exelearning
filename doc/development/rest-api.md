# eXeLearning REST API Documentation

This document describes the REST APIs available in eXeLearning.

## API Versions Overview

| Version | Base Path | Purpose | Status |
|---------|-----------|---------|--------|
| **API v1** | `/api/v1` | External integrations (LMS, mobile apps, automation) | **Current** |
| Legacy API | `/api` | Internal use, compatibility | Deprecated |

---

# API v1 — External Integration API

**Base URL:** `/api/v1`
**Auth:** `Authorization: Bearer <JWT>`
**Real-time:** Changes propagate to WebSocket clients via Yjs CRDTs

## Purpose

API v1 is designed for **external integrations**:
- Learning Management Systems (LMS)
- Mobile applications
- Automation scripts
- Third-party tools

All changes made via the REST API are automatically synchronized with connected WebSocket clients using Yjs CRDTs for conflict resolution.

---

## Authentication

**Important:** API v1 is only accessible to **registered users** (`ROLE_USER` or `ROLE_ADMIN`). **Guest users are not allowed** and will receive a `403 FORBIDDEN` error.

### Get a JWT Token

#### Option A — via CLI (development/automation)

```bash
bun run cli generate-jwt user@example.com --ttl=3600
```

#### Option B — via Login API

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"secret"}'
# → { "access_token": "<JWT>", "token_type": "bearer" }
```

### Using the Token

```bash
export TOKEN='<JWT>'
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/projects
```

---

## Response Format

All API v1 endpoints return consistent JSON responses:

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Project not found"
  }
}
```

### Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / Validation error |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (no permission, or guest user attempting access) |
| 404 | Not found |
| 422 | Unprocessable entity (schema validation) |
| 500 | Internal server error |

---

## Projects

### List Projects

```
GET /api/v1/projects
```

Returns projects owned by the authenticated user (or all projects for admins).

**Query Parameters:**
- `limit` (number): Max results (default: 50)
- `offset` (number): Pagination offset
- `search` (string): Search in title

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "uuid": "abc-123-def",
      "title": "My Course",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-16T14:20:00Z"
    }
  ]
}
```

### Get Project

```
GET /api/v1/projects/:uuid
```

### Create Project

```
POST /api/v1/projects
Content-Type: application/json

{
  "title": "New Course"
}
```

### Update Project

```
PUT /api/v1/projects/:uuid
Content-Type: application/json

{
  "title": "Updated Title"
}
```

### Delete Project

```
DELETE /api/v1/projects/:uuid
```

### Duplicate Project

```
POST /api/v1/projects/:uuid/duplicate
Content-Type: application/json

{
  "title": "Copy of My Course"
}
```

---

## Pages

### List Pages

```
GET /api/v1/projects/:uuid/pages
```

Returns all pages in the project as a flat array, sorted by order.

### Get Page

```
GET /api/v1/projects/:uuid/pages/:pageId
```

### Create Page

```
POST /api/v1/projects/:uuid/pages
Content-Type: application/json

{
  "name": "Introduction",
  "parentId": null,
  "order": 0
}
```

**Parameters:**
- `name` (required): Page name
- `parentId` (optional): Parent page ID for nested pages (null for root level)
- `order` (optional): Position in the page list

### Update Page

```
PATCH /api/v1/projects/:uuid/pages/:pageId
Content-Type: application/json

{
  "name": "Updated Name",
  "properties": {
    "customKey": "customValue"
  }
}
```

### Delete Page

```
DELETE /api/v1/projects/:uuid/pages/:pageId
```

Deletes the page and all its descendants.

### Move Page

```
POST /api/v1/projects/:uuid/pages/:pageId/move
Content-Type: application/json

{
  "parentId": "target-page-id",
  "position": 0
}
```

---

## Blocks

Blocks are containers within pages that hold components (iDevices).

### List Blocks

```
GET /api/v1/projects/:uuid/pages/:pageId/blocks
```

### Get Block

```
GET /api/v1/projects/:uuid/blocks/:blockId
```

### Create Block

```
POST /api/v1/projects/:uuid/pages/:pageId/blocks
Content-Type: application/json

{
  "name": "Content Section",
  "order": 0
}
```

### Update Block

```
PATCH /api/v1/projects/:uuid/blocks/:blockId
Content-Type: application/json

{
  "name": "Updated Name",
  "iconName": "icon-text",
  "properties": {
    "visibility": "true",
    "teacherOnly": "false"
  }
}
```

### Delete Block

```
DELETE /api/v1/projects/:uuid/blocks/:blockId
```

### Move Block

```
POST /api/v1/projects/:uuid/blocks/:blockId/move
Content-Type: application/json

{
  "targetPageId": "page-xyz",
  "position": 0
}
```

---

## Components (iDevices)

Components are the content elements within blocks.

### List Components

```
GET /api/v1/projects/:uuid/blocks/:blockId/components
```

### Get Component

```
GET /api/v1/projects/:uuid/components/:componentId
```

### Create Component

```
POST /api/v1/projects/:uuid/blocks/:blockId/components
Content-Type: application/json

{
  "ideviceType": "text",
  "initialData": {
    "title": "My Text",
    "htmlContent": "<p>Hello world</p>"
  },
  "order": 0
}
```

**Parameters:**
- `ideviceType` (required): Type of iDevice (text, quiz, image, etc.)
- `initialData` (optional): Initial content and properties
- `order` (optional): Position within the block

### Update Component

```
PUT /api/v1/projects/:uuid/components/:componentId
Content-Type: application/json

{
  "title": "Updated Title",
  "htmlContent": "<p>Updated content</p>",
  "properties": {
    "customProp": "value"
  }
}
```

### Set Component HTML

Convenience endpoint to update only the HTML content:

```
PUT /api/v1/projects/:uuid/components/:componentId/html
Content-Type: application/json

{
  "html": "<p>New HTML content</p>"
}
```

### Delete Component

```
DELETE /api/v1/projects/:uuid/components/:componentId
```

---

## Metadata

### Get Project Metadata

```
GET /api/v1/projects/:uuid/metadata
```

Returns project metadata (title, author, description, language, etc.).

### Update Project Metadata

```
PATCH /api/v1/projects/:uuid/metadata
Content-Type: application/json

{
  "title": "Course Title",
  "author": "John Doe",
  "description": "Course description",
  "language": "en"
}
```

---

## Export

### Export Project

```
GET /api/v1/projects/:uuid/export/:format
```

**Formats:**
- `html5` - HTML5 website
- `html5-sp` - HTML5 single page
- `scorm12` - SCORM 1.2 package
- `scorm2004` - SCORM 2004 package
- `ims` - IMS Content Package
- `epub3` - EPUB3 ebook
- `elp` / `elpx` - eXeLearning project file

**Response:** ZIP file download

### List Available Formats

```
GET /api/v1/export/formats
```

---

## Assets

Manage project assets (images, media files, documents).

**Note:** Changes are automatically broadcast to connected WebSocket clients via Yjs.

### List Assets

```
GET /api/v1/projects/:uuid/assets
```

Returns all assets in the project.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "clientId": "abc-123-uuid",
      "filename": "image.jpg",
      "mimeType": "image/jpeg",
      "size": 102400,
      "folderPath": "images",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-16T14:20:00Z"
    }
  ]
}
```

### Upload Asset

```
POST /api/v1/projects/:uuid/assets
Content-Type: multipart/form-data

file: <binary>
clientId: (optional) UUID for the asset
folderPath: (optional) Virtual folder path
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "clientId": "generated-uuid",
    "filename": "image.jpg",
    "mimeType": "image/jpeg",
    "size": 102400,
    "folderPath": "",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Download Asset

```
GET /api/v1/projects/:uuid/assets/:assetId
```

Returns the asset file with appropriate Content-Type header.

### Get Asset Metadata

```
GET /api/v1/projects/:uuid/assets/:assetId/metadata
```

Returns asset metadata without downloading the file.

### Delete Asset

```
DELETE /api/v1/projects/:uuid/assets/:assetId
```

Deletes the asset from disk and database.

### Bulk Delete Assets

```
POST /api/v1/projects/:uuid/assets/bulk-delete
Content-Type: application/json

{
  "clientIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

Deletes multiple assets by their client IDs.

**Response:**
```json
{
  "success": true,
  "data": {
    "deleted": 3
  }
}
```

---

## Users (Admin Only)

These endpoints require `ROLE_ADMIN`.

### List Users

```
GET /api/v1/users
```

### Get User

```
GET /api/v1/users/:id
```

### Create User

```
POST /api/v1/users
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "securepassword",
  "roles": ["ROLE_USER"]
}
```

### Update User

```
PATCH /api/v1/users/:id
Content-Type: application/json

{
  "roles": ["ROLE_USER", "ROLE_ADMIN"],
  "is_active": true
}
```

### Delete User

```
DELETE /api/v1/users/:id
```

---

## Real-time Synchronization

All changes made via the REST API are automatically broadcast to connected WebSocket clients:

1. REST request modifies the Y.Doc (Yjs document)
2. Server calculates the delta update
3. Delta is broadcast to all WebSocket clients in the project room
4. Clients apply the update via Yjs CRDT merge

This ensures:
- **Consistency**: All clients see the same state
- **Conflict resolution**: Yjs CRDTs handle concurrent edits
- **Real-time updates**: WebSocket clients update instantly

---

## Examples

### Create a Complete Page with Content

```bash
# 1. Create a page
PAGE=$(curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Chapter 1"}' \
  http://localhost:8080/api/v1/projects/$UUID/pages)

PAGE_ID=$(echo $PAGE | jq -r '.data.id')

# 2. Create a block
BLOCK=$(curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Introduction"}' \
  http://localhost:8080/api/v1/projects/$UUID/pages/$PAGE_ID/blocks)

BLOCK_ID=$(echo $BLOCK | jq -r '.data.id')

# 3. Add a text component
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ideviceType": "text",
    "initialData": {
      "title": "Welcome",
      "htmlContent": "<p>Welcome to Chapter 1!</p>"
    }
  }' \
  http://localhost:8080/api/v1/projects/$UUID/blocks/$BLOCK_ID/components
```

### Export a Project to SCORM

```bash
curl -L -o course.zip \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/projects/$UUID/export/scorm12
```

---

# Legacy API (Deprecated)

The legacy API at `/api` is maintained for backwards compatibility but should not be used for new integrations. See the sections below for reference only.

---

## Legacy: ELP Conversion & Export Endpoints

These endpoints allow you to convert legacy ELP files to the current format and export ELP files to various output formats (HTML5, SCORM, EPUB, etc.).

**Authentication:** All endpoints require `ROLE_USER` and `Authorization: Bearer <JWT>`.

**Request Format:** `multipart/form-data` with file upload.

### Convert ELP File

**Endpoint:** `POST /api/convert/elp`

**Description:** Converts old ELP files (contentv2/v3) to the current format (elpx/contentv4).

**Request:**
- **Content-Type:** `multipart/form-data`
- **Body Parameters:**
  - `file` (required): The ELP file to convert

**Query Parameters:**
- `download` (optional): Set to `1` to download the converted file directly instead of returning JSON metadata.

**Example:**

```bash
# Convert and download directly
curl -X POST "http://localhost:8080/api/convert/elp?download=1" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/legacy.elp" \
  -o converted.elpx
```

### Export ELP File (Stateless)

**Endpoints:**
- `POST /api/convert/export/html5` — Export to HTML5 web format
- `POST /api/convert/export/scorm12` — Export to SCORM 1.2 format
- `POST /api/convert/export/scorm2004` — Export to SCORM 2004 format
- `POST /api/convert/export/epub3` — Export to EPUB3 format
- `POST /api/convert/export/ims` — Export to IMS Content Package format

**Example:**

```bash
# Export to SCORM 1.2 and download
curl -L -X POST "http://localhost:8080/api/convert/export/scorm12?download=1" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/course.elp" \
  -o export_scorm12.zip
```

---

## Configuration

### Environment Variables

- **`MAX_UPLOAD_SIZE`**: Maximum upload size (default: 100MB)
- **`FILES_DIR`**: Base directory for file storage
- **`JWT_SECRET`**: Secret for JWT token signing

### Upload Size Limit

```bash
MAX_UPLOAD_SIZE=200M  # or 200000000 for bytes
```
