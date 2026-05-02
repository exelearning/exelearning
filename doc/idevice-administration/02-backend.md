# 02 — Backend / API

> Cómo el servidor sirve, escanea, parsea y modifica iDevices. Qué endpoints están realmente implementados y cuáles sólo declarados.

## Estructura en disco

El servidor sólo conoce dos rutas (constantes en [src/routes/idevices.ts:35-36](../../src/routes/idevices.ts#L35-L36)):

```ts
const IDEVICES_BASE_PATH  = 'public/files/perm/idevices/base';
const IDEVICES_USERS_PATH = 'public/files/perm/idevices/users';
```

`base/` contiene los 43 iDevices del sistema. `users/` está prácticamente vacío en `main` (sólo una carpeta `94/` sin contenido).

## Endpoints declarados vs. implementados

Hay **dos fuentes de verdad** distintas en `main` que **no están alineadas**:

- [src/routes/api-routes.ts:17-34](../../src/routes/api-routes.ts#L17-L34) — declara **10 nombres** de ruta (path + method). Esta tabla se sirve al cliente vía `/api/config/parameters` y se usa para que el frontend construya URLs.
- [src/routes/idevices.ts](../../src/routes/idevices.ts) — implementa los handlers Elysia.

### Tabla comparativa

| Nombre en `api-routes.ts` | Path declarado | Handler en `idevices.ts` | Estado |
|---|---|---|---|
| `api_idevices_installed` | `GET /api/idevices/installed` | [línea 252](../../src/routes/idevices.ts#L252) | ✅ Implementado |
| `api_idevices_installed_idevice` | `GET /api/idevices/installed/{ideviceId}` | [línea 289](../../src/routes/idevices.ts#L289) | ✅ Implementado |
| `api_idevices_download_file_resources` | `GET /api/idevices/download-file-resources` | [línea 319](../../src/routes/idevices.ts#L319) | ✅ Implementado |
| `api_idevices_upload_file_resources` | `POST /api/idevices/upload/file/resources` | [línea 379](../../src/routes/idevices.ts#L379) | ✅ Implementado |
| `api_idevices_upload_large_file_resources` | `POST /api/idevices/upload/large/file/resources` | [línea 505](../../src/routes/idevices.ts#L505) | ✅ Implementado |
| `api_idevices_upload` | `POST /api/idevices/install` | [src/routes/idevice-installer.ts](../../src/routes/idevice-installer.ts) | ✅ Implementado |
| `api_idevices_installed_delete` | `DELETE /api/idevices/{ideviceId}/delete` | — | ❌ **No implementado** |
| `api_idevices_installed_download` | `GET /api/idevices/{ideviceId}/download` | — | ❌ **No implementado** |
| `api_idevices_download_ode_components` | `GET /api/idevices/download-ode-components` | — | ❌ **No implementado** |
| `api_idevices_force_download_file_resources` | `GET /api/idevices/force-download-file-resources` | — | ❌ **No implementado** |

### Implicaciones

El frontend tiene wrappers en [public/app/rest/apiCallManager.js](../../public/app/rest/apiCallManager.js) que llaman a los 3 endpoints administrativos no implementados:

- [apiCallManager.js:715-718](../../public/app/rest/apiCallManager.js#L715-L718) `postUploadIdevice()` → `POST /api/idevices/install`
- [apiCallManager.js:726-729](../../public/app/rest/apiCallManager.js#L726-L729) `deleteIdeviceInstalled()` → `DELETE /api/idevices/{ideviceId}/delete`
- [apiCallManager.js:738-743](../../public/app/rest/apiCallManager.js#L738-L743) `getIdeviceInstalledZip()` → `GET /api/idevices/{ideviceId}/download`

Los flujos de instalar/desinstalar/exportar iDevice (modal y menú) llaman a esas funciones — pero el handler no existe, así que en `main` la administración real (no la mera visibilidad) está rota end-to-end. Ver [04-modes.md](./04-modes.md) y [05-admin-flows.md](./05-admin-flows.md) para los flujos afectados.

## Listado: `GET /api/idevices/installed`

Definido en [src/routes/idevices.ts:252-286](../../src/routes/idevices.ts#L252-L286).

Pasos:

1. Llama a `scanIdevices(IDEVICES_BASE_PATH)` y `scanIdevices(IDEVICES_USERS_PATH)`.
2. Construye un `Map<id, IdeviceConfig>` y vuelca primero `base`, luego `users` (los `users` **sobreescriben** a `base` con el mismo id) — ver [línea 257-267](../../src/routes/idevices.ts#L257-L267).
3. Reescribe `url` con prefijo de versión: `/${getAppVersion()}/files/perm/idevices/base/${id}` o `.../users/${id}`. Ese prefijo es el ETag implícito que invalida las caches del navegador entre versiones.
4. Ordena por `category` y luego por `title` (ambos `localeCompare`) — [línea 272-277](../../src/routes/idevices.ts#L272-L277).
5. Devuelve `{ idevices: [...] }` añadiendo `name: idevice.id` en cada elemento (el frontend usa `name`).

Respuesta tipada en `IdeviceConfig` ([interface líneas 38-69](../../src/routes/idevices.ts#L38-L69)).

## Detalle: `GET /api/idevices/installed/:ideviceId`

[src/routes/idevices.ts:289-316](../../src/routes/idevices.ts#L289-L316). Busca primero en `users/`, luego en `base/`. Devuelve 404 si no existe, 500 si el `config.xml` no parsea.

## Recursos: `GET /api/idevices/download-file-resources?resource=...`

[src/routes/idevices.ts:319-376](../../src/routes/idevices.ts#L319-L376).

Este endpoint sirve cualquier archivo bajo `public/files/` indexado por su path relativo en el query `resource`. Lo usan tanto iDevices como temas (de hecho la URL `download-file-resources` es genérica, no específica de iDevices, a pesar del prefijo).

Características:

- **Anti path-traversal:** `replace(/\.\./g, '')` y verificación `resolvedPath.startsWith(basePath)` ([líneas 328 y 335](../../src/routes/idevices.ts#L328)). Devuelve 403 si se sale del directorio.
- **Tabla de MIME types** en líneas 348-365 (CSS, JS, JSON, HTML, SVG, fuentes, imágenes).
- **Reescritura de URLs en CSS:** si la extensión es `.css`, el contenido pasa por `rewriteCSSUrls()` ([línea 585-608](../../src/routes/idevices.ts#L585-L608)). Sustituye `url(./x.svg)` por `url(${BASE_PATH}/api/idevices/download-file-resources?resource=...)`. Esto permite que las fuentes/imágenes referenciadas relativamente en CSS sigan funcionando cuando el CSS se sirve a través del endpoint API en lugar de desde el FS.

## Subida de recursos del iDevice

Hay **dos endpoints** que difieren en codificación y tamaño máximo:

### `POST /api/idevices/upload/file/resources` (base64)

[src/routes/idevices.ts:379-502](../../src/routes/idevices.ts#L379-L502). Acepta payload JSON con:

```ts
{
  odeIdeviceId: string,
  base64String: string,    // o 'file' (legacy)
  filename: string,
  createThumbnail?: boolean | 'true',
  odeSessionId?: string,    // o cookie 'odeSessionId' / 'projectId'
}
```

Comportamiento:

- Decodifica base64 y escribe en `${FILES_DIR}/tmp/${odeSessionId}/content/resources/${odeIdeviceId}/${cleanFilename}`.
- Si no hay `odeSessionId` ni cookie, usa `'uploads'` como fallback ([línea 420](../../src/routes/idevices.ts#L420)).
- Saneamiento del nombre: reemplaza espacios por `_` y aplica `replace(/[^A-Za-z0-9_\-.]/g, '')` ([líneas 424-425](../../src/routes/idevices.ts#L424-L425)). Si el nombre queda vacío usa `'file_' + Date.now()`.
- Si ya existe, añade sufijo `_1`, `_2`, ... ([línea 444-447](../../src/routes/idevices.ts#L444-L447)).
- `createThumbnail`: copia el archivo con prefijo `thumb_` (no genera miniatura real — hay un `TODO` en [línea 493](../../src/routes/idevices.ts#L493) para implementarlo con `sharp`).

### `POST /api/idevices/upload/large/file/resources` (FormData)

[src/routes/idevices.ts:505-579](../../src/routes/idevices.ts#L505-L579). Análogo al anterior pero acepta `Blob`/`Buffer`/raw como `file` ([línea 555-562](../../src/routes/idevices.ts#L555-L562)). Sin generación de thumbnail.

## Parser `parseIdeviceConfig()`

[src/routes/idevices.ts:90-216](../../src/routes/idevices.ts#L90-L216). Recibe el XML como string, el id, y el basePath en disco. Devuelve un `IdeviceConfig` o `null` si falla (try/catch silencioso).

Curiosidades:

- **No usa parser XML formal** (a pesar de que `fast-xml-parser` está instalado y se usa en [src/services/idevice-config.ts:8](../../src/services/idevice-config.ts#L8)). Aquí se usa regex pura. Funciona porque los `config.xml` son simples y no tienen atributos.
- **Auto-descubrimiento de archivos** cuando faltan tags `<edition-js>` etc. Es el caso por defecto en la mayoría de iDevices `base/`.
- **Lectura inline de templates:** si hay `<edition-template-filename>` o `<export-template-filename>`, el contenido del archivo se lee a memoria y se inyecta en el JSON de respuesta como `editionTemplateContent`/`exportTemplateContent` ([líneas 173-178 y 207-208](../../src/routes/idevices.ts#L173-L178)). Esto evita un fetch adicional desde el cliente, pero infla la respuesta.

## Servicio cacheado: `idevice-config`

[src/services/idevice-config.ts](../../src/services/idevice-config.ts) es **independiente** del parser de `idevices.ts`. Tiene su propio escaneo y cache, usado por los exporters (SCORM, HTML5, EPUB, IMS). Nota: solo escanea `base/` ([línea 42](../../src/services/idevice-config.ts#L42)) — los iDevices de `users/` no llegan al pipeline de export.

API expuesta:

- `loadIdeviceConfigs(customBasePath?)` — escanea y cachea (parsea con `XMLParser`, no regex).
- `setIdevicesBasePath(basePath)` — sobrescribe el path base (usado en tests).
- `getIdeviceConfig(type)` — lazy-load y devuelve `{ cssClass, componentType, template }`. Aplica `IDEVICE_TYPE_ALIASES` (ver [01-anatomy.md](./01-anatomy.md)).
- `isJsonIdevice(type)` — `componentType === 'json'`.
- `getIdeviceExportFiles(typeName, '.js' | '.css')` — escanea `${type}/export/` y devuelve los archivos en orden (principal primero) excluyendo `.test.js` y `.spec.js`.
- `resetIdeviceConfigCache()` — para tests.

El cache es un `Map<string, IdeviceConfigCache>` que indexa por nombre, lowercase, y nombre de directorio (para cubrir las tres variantes legacy).

## Autorización

**Ninguno** de los endpoints de `idevices.ts` declara middleware de autenticación o autorización. La protección que existe es:

- Path traversal mitigado en `download-file-resources`.
- Sanitización de nombre de archivo en los uploads.
- Limitación de directorio: la subida sólo escribe en `${FILES_DIR}/tmp/${sessionId}/content/resources/`, así que aunque no haya auth no se puede sobreescribir `base/`.

Es decir, cualquier request a `GET /api/idevices/installed` funciona sin token. En modo offline (`APP_ONLINE_MODE=0`) eso es esperado; en modo servidor con autenticación habilitada, depende del middleware global del cliente Elysia (ver `src/index.ts`).
