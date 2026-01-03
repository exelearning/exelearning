# eXeLearning REST API — Quick Reference

**Base URL:** `/api`
**Auth:** `Authorization: Bearer <JWT>`
**Roles:** `ROLE_USER` (projects, pages, blocks, iDevices) · `ROLE_ADMIN` (user management, quotas)

---

## Get a JWT

### Option A — via API (needs an authenticated browser session)

```bash
curl -s -X POST \
  -H 'Accept: application/json' \
  -b cookies.txt -c cookies.txt \
  http://localhost:8080/api/auth/token
# → { "token":"<JWT>", "ttl":3600 }
```

### Option B — via CLI (development)

```bash
bin/console app:jwt:generate 'user@example.com' --ttl=3600
```

Use the token:

```bash
export TOKEN='<JWT>'
curl -s -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json' \
  http://localhost:8080/api/projects
```

---

## Core resources (REST)

| Resource     | List                                                                                           | Get                                                                              | Create                                                                                                           | Update                                                                                                                                                                                                                          | Delete                                                         | Reorder / Move                                                                                                                                                                                              | Notes                               |                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------- |
| **Projects** | `GET /projects`                                                                                | `GET /projects/{projectId}`                                                      | `POST /projects` body: `{ "title":"My project" }`                                                                | \`PUT                                                                                                                                                                                                                           | PATCH /projects/{projectId}`body:`{ "title":"New title" }\`    | `DELETE /projects/{projectId}`                                                                                                                                                                              | —                                   | Also properties: `GET/PUT/PATCH /projects/{projectId}/properties` |
| **Pages**    | `GET /projects/{projectId}/pages` (tree) · `GET /projects/{projectId}/pages/{pageId}/children` | `GET /projects/{projectId}/pages/{pageId}`                                       | `POST /projects/{projectId}/pages` body: `{ "title":"Intro", "parentId":null }`                                  | `PATCH /projects/{projectId}/pages/{pageId}` body: `{ "title":"..." }`                                                                                                                                                          | `DELETE /projects/{projectId}/pages/{pageId}`                  | Reorder children: `PATCH /projects/{projectId}/pages/{pageId}/children` body: `{ "order":[...] }` · Move page: `PATCH /projects/{projectId}/pages/{pageId}/move` body: `{ "parentId":"...", "position":0 }` | —                                   |                                                                   |
| **Blocks**   | `GET /projects/{projectId}/pages/{pageId}/blocks`                                              | `GET /projects/{projectId}/pages/{pageId}/blocks/{blockId}`                      | `POST /projects/{projectId}/pages/{pageId}/blocks` body: `{ "type":"text","data":{...} }`                        | Reorder in page: `PATCH /projects/{projectId}/pages/{pageId}/blocks` body: `{ "order":[...] }` · Update by move: `PATCH /projects/{projectId}/pages/{pageId}/blocks/{blockId}/move` body: `{ "newPageId":"...", "position":0 }` | `DELETE /projects/{projectId}/pages/{pageId}/blocks/{blockId}` | Move block to another page: `PATCH .../blocks/{blockId}/move`                                                                                                                                               | `type` defaults to `"generic"`      |                                                                   |
| **iDevices** | `GET /projects/{projectId}/pages/{pageId}/blocks/{blockId}/idevices`                           | `GET /projects/{projectId}/pages/{pageId}/blocks/{blockId}/idevices/{ideviceId}` | `POST /projects/{projectId}/pages/{pageId}/blocks/{blockId}/idevices` body: `{ "ideviceId":"opt","data":{...} }` | `PUT /projects/{projectId}/pages/{pageId}/blocks/{blockId}/idevices/{ideviceId}` body: `{...}`                                                                                                                                  | —                                                              | —                                                                                                                                                                                                           | Returns block-scoped subobject data |                                                                   |

---

## Access Model (Visibility)

- Unprivileged (`ROLE_USER`):
  - `GET /users`: returns only the current user (exactly one entry).
  - `GET /projects`: returns only projects owned by the current user.
  - `GET /projects/{projectId}`: 403 if the project is not owned by the user.

- Admin (`ROLE_ADMIN`):
  - `GET /users`: returns all users; supports filters (see below).
  - `GET /projects`: returns all projects; supports filters (see below).

Notes:
- All requests require `Authorization: Bearer <JWT>`.
- For JWT-based auth where the security user is not a Doctrine entity, the system matches by email.

---

## Projects — Listing, Filters, Owner Fields

Endpoint: `GET /projects`

- Always includes owner information: `owner_id` and `owner_email`.
- Sorted by `updatedAt.timestamp` (desc).

Supported filters (query params):
- `id`: exact match by project id.
- `title`: exact match by title.
- `title_like`: case-insensitive substring in title.
- `updated_after`: `updatedAt.timestamp` strictly greater than the value.
- `updated_before`: `updatedAt.timestamp` strictly less than the value.
- `search`: case-insensitive substring in `id`, `title`, or `fileName`.
- `owner_id` (admin only): exact match by owner userId.
- `owner_email` (admin only): exact match by owner email.

Example:
```bash
curl -s -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json' \
  'http://localhost:8080/api/projects?title_like=tutorial&updated_after=1700000000'
```

Single project: `GET /projects/{projectId}`

- Includes `owner_id` and `owner_email` in the response.
- Non-admins get 403 if not the owner.

---

## Users — Listing, Filters, and Lookups

List: `GET /users`

- Unprivileged: returns only the current user (1 element).
- Admin: returns all users. Filters supported:
  - `email` (exact)
  - `role` (partial; e.g., `ROLE_ADMIN`)
  - `search` (partial in `email` or `userId`)

Get by numeric id: `GET /users/{id}`

- Access: admin or the owner (the same user).

Lookups (convenience):
- `GET /users/by-email/{email}`
- `GET /users/by-userid/{userId}`

Both endpoints:
- Access: admin or the owner.
- Tip: URL-encode the email when using `/by-email/...`.

Examples:
```bash
# Admin listing with filter
curl -s -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json' \
  'http://localhost:8080/api/users?search=@example.com'

# Lookup by userId
curl -s -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json' \
  http://localhost:8080/api/users/by-userid/user2

# Lookup by email (URL-encoded)
curl -s -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json' \
  'http://localhost:8080/api/users/by-email/user%40exelearning.net'
```

---

## Minimal cURL examples

List projects:

```bash
curl -s -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json' \
  http://localhost:8080/api/projects
```

Create a page:

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{ "title":"Intro", "parentId": null }' \
  http://localhost:8080/api/projects/<projectId>/pages
```

Add a text block:

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{ "type":"text", "data": { "content":"Hello" } }' \
  http://localhost:8080/api/projects/<projectId>/pages/<pageId>/blocks
```

Move a block:

```bash
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{ "newPageId":"<targetPageId>", "position": 0 }' \
  http://localhost:8080/api/projects/<projectId>/pages/<pageId>/blocks/<blockId>/move
```

---

## ELP Conversion & Export Endpoints

These endpoints allow you to convert legacy ELP files to the current format and export ELP files to various output formats (HTML5, SCORM, EPUB, etc.).

**Authentication:** All endpoints require `ROLE_USER` and `Authorization: Bearer <JWT>`.

**Request Format:** `multipart/form-data` with file upload.

---

### Convert ELP File

**Endpoint:** `POST /api/convert/elp`

**Description:** Converts old ELP files (contentv2/v3) to the current format (elpx/contentv4).

**Request:**
- **Content-Type:** `multipart/form-data`
- **Body Parameters:**
  - `file` (required): The ELP file to convert

**Query Parameters:**
- `download` (optional): Set to `1` to download the converted file directly instead of returning JSON metadata.

**Success Response (201):**

Without `download=1`:
```json
{
  "status": "success",
  "fileName": "converted_202501051234_ABC12.elpx",
  "size": 1024000,
  "message": "Conversion completed. Use ?download=1 to download the file directly."
}
```

With `download=1`:
- Returns the converted `.elpx` file as binary download with appropriate `Content-Disposition` header.

**Error Responses:**
- `400 MISSING_FILE`: No file uploaded
- `400 UPLOAD_ERROR`: File upload failed
- `401 UNAUTHORIZED`: Authentication required
- `413 UPLOAD_TOO_LARGE`: File exceeds size limit (see `ELP_API_MAX_UPLOAD_SIZE_MB` config)
- `415 UNSUPPORTED_MEDIA_TYPE`: Expected `multipart/form-data`
- `422 INVALID_FILE_TYPE`: Invalid file extension or MIME type
- `422 INVALID_ELP`: File is not a valid ELP archive
- `500 CONVERSION_FAILED`: Conversion process failed
- `500 INTERNAL_ERROR`: Unexpected error

**Example:**

```bash
# Convert and get JSON metadata
curl -X POST "http://localhost:8080/api/convert/elp" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/legacy.elp"

# Convert and download directly
curl -X POST "http://localhost:8080/api/convert/elp?download=1" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/legacy.elp" \
  -o converted.elpx
```

---

### Export ELP File (Stateless)

**Endpoints:**
- `POST /api/convert/export/elp` — Export to ELP/ELPX format
- `POST /api/convert/export/html5` — Export to HTML5 web format
- `POST /api/convert/export/html5-sp` — Export to HTML5 single page format
- `POST /api/convert/export/scorm12` — Export to SCORM 1.2 format
- `POST /api/convert/export/scorm2004` — Export to SCORM 2004 format
- `POST /api/convert/export/ims` — Export to IMS Content Package format
- `POST /api/convert/export/epub3` — Export to EPUB3 format
- `POST /api/convert/export/elpx` — Export to ELPX format (alias for elp)

**Description:** Exports an ELP file to the specified format.

**Request:**
- **Content-Type:** `multipart/form-data`
- **Body Parameters:**
  - `file` (required): The ELP file to export
  - `baseUrl` (optional): Base URL for links in exported content (e.g., `https://cdn.example.com/content`)
  - `theme` (optional): Theme name to use (overrides the theme specified in the ELP metadata). Available themes: `base`, `zen`, `flux`, etc.

**Query Parameters:**
- `download` (optional): Set to `1` to download the exported content as a ZIP file instead of returning JSON metadata.

**Success Response (201):**

Without `download=1`:
```json
{
  "status": "success",
  "format": "html5",
  "exportPath": "/tmp/exe_export_abc123",
  "files": [
    "index.html",
    "html/page1.html",
    "html/page2.html",
    "libs/jquery/jquery.min.js",
    "libs/bootstrap/bootstrap.min.css",
    "theme/style.css"
  ],
  "filesCount": 42
}
```

With `download=1`:
- Returns a ZIP archive containing the exported content as binary download.
- **Content-Type:** `application/zip`
- **Content-Disposition:** `attachment; filename="export_{format}_{timestamp}_{random}.zip"`
- For `elp`/`elpx` formats: streams the generated `.elp`/`.elpx` archive directly.
- For formats that produce a single ZIP (e.g., SCORM packages): streams that ZIP file.
- For other formats: creates and streams a ZIP containing all exported files.

**Error Responses:**
- `400 INVALID_FORMAT`: Invalid export format specified
- `400 MISSING_FILE`: No file uploaded
- `400 UPLOAD_ERROR`: File upload failed
- `401 UNAUTHORIZED`: Authentication required
- `413 UPLOAD_TOO_LARGE`: File exceeds size limit
- `415 UNSUPPORTED_MEDIA_TYPE`: Expected `multipart/form-data`
- `422 INVALID_FILE_TYPE`: Invalid file extension or MIME type
- `422 INVALID_ELP`: File is not a valid ELP archive
- `500 EXPORT_FAILED`: Export process failed
- `500 INTERNAL_ERROR`: Unexpected error

**Examples:**

```bash
# Export to HTML5 and get JSON metadata
curl -X POST "http://localhost:8080/api/convert/export/html5" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/course.elp"

# Export to HTML5 and download as ZIP
curl -L -X POST "http://localhost:8080/api/convert/export/html5?download=1" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/course.elp" \
  -o export_html5.zip

# Export to HTML5 with custom base URL and download
curl -L -X POST "http://localhost:8080/api/convert/export/html5?download=1" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/course.elp" \
  -F "baseUrl=https://cdn.example.com/courses" \
  -o export_html5.zip

# Export to HTML5 with a specific theme (overrides ELP metadata)
curl -L -X POST "http://localhost:8080/api/convert/export/html5?download=1" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/course.elp" \
  -F "theme=zen" \
  -o export_html5_zen.zip

# Export to SCORM 1.2 and download
curl -L -X POST "http://localhost:8080/api/convert/export/scorm12?download=1" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/course.elp" \
  -o export_scorm12.zip

# Export to EPUB3 and download
curl -L -X POST "http://localhost:8080/api/convert/export/epub3?download=1" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/course.elp" \
  -o export_epub3.epub

# Export to ELP format and download
curl -L -X POST "http://localhost:8080/api/convert/export/elp?download=1" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/course.elp" \
  -o exported.elpx
```

---

### Configuration

The ELP API endpoints are configured through environment variables:

- **Upload size limit:** Configured via `MAX_UPLOAD_SIZE` environment variable (default: 100MB)
- **Temporary storage:** Uses the configured `FILES_DIR` with automatic cleanup
- **No additional configuration required for most deployments**

To adjust the maximum upload size, set the environment variable:

```bash
MAX_UPLOAD_SIZE=200M  # or 200000000 for bytes
```

---

### Get Available Formats

**Endpoint:** `GET /api/convert/formats`

**Description:** Returns a list of available export formats with metadata.

**Response (200):**
```json
{
  "success": true,
  "formats": [
    { "id": "html5", "name": "HTML5 Website", "extension": "zip", "mimeType": "application/zip" },
    { "id": "html5-sp", "name": "HTML5 Single Page", "extension": "zip", "mimeType": "application/zip" },
    { "id": "scorm12", "name": "SCORM 1.2", "extension": "zip", "mimeType": "application/zip" },
    { "id": "scorm2004", "name": "SCORM 2004", "extension": "zip", "mimeType": "application/zip" },
    { "id": "ims", "name": "IMS Content Package", "extension": "zip", "mimeType": "application/zip" },
    { "id": "epub3", "name": "EPUB3", "extension": "epub", "mimeType": "application/epub+zip" },
    { "id": "elp", "name": "eXeLearning Project", "extension": "elpx", "mimeType": "application/x-exelearning" },
    { "id": "elpx", "name": "eXeLearning Project", "extension": "elpx", "mimeType": "application/x-exelearning" }
  ]
}
```

---

### Implementation Notes

1. **Stateless Operation:** The convert/export API is fully stateless. Each request processes the uploaded file independently using temporary directories that are cleaned up immediately after the response.

2. **Temporary Files:** Uploaded files are extracted to a temporary directory (`FILES_DIR/tmp/convert-{uuid}`) and cleaned up automatically after each operation.

3. **File Validation:** All uploaded files are validated for:
   - File size (`MAX_UPLOAD_SIZE` limit, default 100MB)
   - File extension (must be `.elp`, `.elpx`, or `.zip`)
   - Valid ELP/ELPX structure (checked by the document adapter)

4. **Authentication:** All endpoints require JWT authentication. The token can be provided via `Authorization: Bearer <token>` header or the `auth` cookie.

5. **Unified Export System:** Uses the shared export system (`src/shared/export/`) which is also used by the CLI and frontend, ensuring consistent output across all interfaces.

---

## Status & errors (shape)

* Success: standard JSON bodies as above, typical codes `200/201/204`.
* Validation errors: `400` with `{ "title", "detail", "type" }` or `{ "code", "detail" }`.
* Not found: `404` with `{ "title":"Not found", ... }`.
* Auth: include `Authorization: Bearer <JWT>` on every request.
