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
