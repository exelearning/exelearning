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

## Status & errors (shape)

* Success: standard JSON bodies as above, typical codes `200/201/204`.
* Validation errors: `400` with `{ "title", "detail", "type" }`.
* Not found: `404` with `{ "title":"Not found", ... }`.
* Auth: include `Authorization: Bearer <JWT>` on every request.
