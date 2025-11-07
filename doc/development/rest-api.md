# eXeLearning API v2 — Quick Reference

**Base URL:** `/api/v2`
**Auth:** `Authorization: Bearer <JWT>`
**Roles:** `ROLE_USER` (projects, pages, blocks, iDevices) · `ROLE_ADMIN` (user management, quotas)

---

## Get a JWT

### Option A — via API (needs an authenticated browser session)

```bash
curl -s -X POST \
  -H 'Accept: application/json' \
  -b cookies.txt -c cookies.txt \
  http://localhost:8080/api/v2/auth/token
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
  http://localhost:8080/api/v2/projects
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
  'http://localhost:8080/api/v2/projects?title_like=tutorial&updated_after=1700000000'
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
  'http://localhost:8080/api/v2/users?search=@example.com'

# Lookup by userId
curl -s -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json' \
  http://localhost:8080/api/v2/users/by-userid/user2

# Lookup by email (URL-encoded)
curl -s -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json' \
  'http://localhost:8080/api/v2/users/by-email/user%40exelearning.net'
```

---

## Minimal cURL examples

List projects:

```bash
curl -s -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json' \
  http://localhost:8080/api/v2/projects
```

Create a page:

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{ "title":"Intro", "parentId": null }' \
  http://localhost:8080/api/v2/projects/<projectId>/pages
```

Add a text block:

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{ "type":"text", "data": { "content":"Hello" } }' \
  http://localhost:8080/api/v2/projects/<projectId>/pages/<pageId>/blocks
```

Move a block:

```bash
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{ "newPageId":"<targetPageId>", "position": 0 }' \
  http://localhost:8080/api/v2/projects/<projectId>/pages/<pageId>/blocks/<blockId>/move
```

---

## ELP Conversion & Export Endpoints

These endpoints allow you to convert legacy ELP files to the current format and export ELP files to various output formats (HTML5, SCORM, EPUB, etc.).

**Authentication:** All endpoints require `ROLE_USER` and `Authorization: Bearer <JWT>`.

**Request Format:** `multipart/form-data` with file upload.

---

### Convert ELP File

**Endpoint:** `POST /api/v2/convert/elp`

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
curl -X POST "http://localhost:8080/api/v2/convert/elp" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/legacy.elp"

# Convert and download directly
curl -X POST "http://localhost:8080/api/v2/convert/elp?download=1" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/legacy.elp" \
  -o converted.elpx
```

---

### Export ELP File

**Endpoints:**
- `POST /api/v2/export/elp` — Export to ELP/ELPX format
- `POST /api/v2/export/html5` — Export to HTML5 web format
- `POST /api/v2/export/html5-sp` — Export to HTML5 single page format
- `POST /api/v2/export/scorm12` — Export to SCORM 1.2 format
- `POST /api/v2/export/scorm2004` — Export to SCORM 2004 format
- `POST /api/v2/export/ims` — Export to IMS Common Cartridge format
- `POST /api/v2/export/epub3` — Export to EPUB3 format

**Description:** Exports an ELP file to the specified format.

**Request:**
- **Content-Type:** `multipart/form-data`
- **Body Parameters:**
  - `file` (required): The ELP file to export
  - `baseUrl` (optional): Base URL for links in exported content (e.g., `https://cdn.example.com/content`)

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
curl -X POST "http://localhost:8080/api/v2/export/html5" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/course.elp"

# Export to HTML5 and download as ZIP
curl -L -X POST "http://localhost:8080/api/v2/export/html5?download=1" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/course.elp" \
  -o export_html5.zip

# Export to HTML5 with custom base URL and download
curl -L -X POST "http://localhost:8080/api/v2/export/html5?download=1" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/course.elp" \
  -F "baseUrl=https://cdn.example.com/courses" \
  -o export_html5.zip

# Export to SCORM 1.2 and download
curl -L -X POST "http://localhost:8080/api/v2/export/scorm12?download=1" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/course.elp" \
  -o export_scorm12.zip

# Export to EPUB3 and download
curl -L -X POST "http://localhost:8080/api/v2/export/epub3?download=1" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/course.elp" \
  -o export_epub3.zip

# Export to ELP format and download
curl -L -X POST "http://localhost:8080/api/v2/export/elp?download=1" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/course.elp" \
  -o exported.elp
```

---

### Configuration

The ELP API endpoints use standard PHP configuration for file uploads:

- **Upload size limit:** Respects PHP's `upload_max_filesize` setting (configured in `php.ini`)
- **Temporary storage:** Uses system temp directory (`sys_get_temp_dir()`) with automatic cleanup
- **No additional configuration required**

To adjust the maximum upload size, modify your `php.ini` or web server configuration:

```ini
upload_max_filesize = 100M
post_max_size = 100M
```

---

### Implementation Notes

1. **Ephemeral Users:** The API creates temporary users for each conversion/export operation to avoid conflicts with the authenticated user's session. These users are automatically cleaned up after the operation completes.

2. **Temporary Files:** Uploaded files are stored in the system temp directory (`/tmp/exe_api_uploads` or equivalent) and cleaned up automatically. Export artifacts are also stored temporarily and removed after the response is sent.

3. **File Validation:** All uploaded files are validated for:
   - File size (PHP's `upload_max_filesize` limit)
   - File extension (must be `.elp`, `.elpx`, or `.zip`)
   - MIME type (must be a ZIP archive)
   - Valid ELP structure (checked by ODE service)

4. **Session Management:** Each operation creates a unique ODE session that is properly closed and cleaned up, even if errors occur.

5. **Logging:** All operations are logged with correlation IDs for debugging and monitoring.

---

## Status & errors (shape)

* Success: standard JSON bodies as above, typical codes `200/201/204`.
* Validation errors: `400` with `{ "title", "detail", "type" }` or `{ "code", "detail" }`.
* Not found: `404` with `{ "title":"Not found", ... }`.
* Auth: include `Authorization: Bearer <JWT>` on every request.
