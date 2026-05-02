# 04 — Modos online / electron / static

> Cómo cambia la administración de iDevices según el modo de despliegue y por qué.

## Las tres situaciones

eXeLearning 4.x **no tiene tres ramas** distintas. En la rama `main` conviven tres formas de servir el editor que se determinan en runtime:

1. **Online (server)** — Bun + Elysia sirviendo `public/`, con WebSocket Yjs y BD (SQLite/Postgres/MariaDB). Es el modo "completo".
2. **Static / PWA** — Build estático generado por [scripts/build-static-bundle.ts](../../scripts/build-static-bundle.ts), servible desde cualquier hosting o iframe LMS.
3. **Electron** — App de escritorio que reutiliza el build estático servido desde un protocolo `app://`. Lógicamente equivalente a static.

## Decisión única de modo: `RuntimeConfig.fromEnvironment()`

[public/app/core/RuntimeConfig.js:38-112](../../public/app/core/RuntimeConfig.js#L38-L112) es **el único punto** donde se decide el modo. La regla, en orden:

| Condición | Modo resuelto | `wsUrl` | `staticDataPath` | `isEmbedded` |
|---|---|---|---|---|
| `window.__EXE_STATIC_MODE__ === true` | `static` | `null` | `${basePath}/data/bundle.json` | iframe \|\| embedding config |
| `window.electronAPI` existe | `static` | `null` | `null` | `false` |
| Otro caso | `server` | `ws[s]://${host}` | `null` | iframe \|\| `?embedded=true` \|\| embedding config |

Notas críticas:

- **Electron es `mode: 'static'`.** No hay un cuarto valor. Eso quiere decir que para la lógica del cliente, Electron y static-PWA son equivalentes; las diferencias están en el host (Electron tiene `electronAPI` para abrir/guardar archivos nativamente).
- `staticDataPath: null` en Electron — porque Electron **no usa `bundle.json`**. Lee directamente del FS bundled vía `app://` (ver más abajo). Las páginas estáticas de la PWA sí lo usan.

## Capabilities

[public/app/core/Capabilities.js](../../public/app/core/Capabilities.js) traduce `mode` en feature flags. Reglas relevantes para iDevices:

```js
const isServer = config.mode === 'server';
const isStatic = config.mode === 'static';

this.fileManager = {
    enabled: true,                 // siempre
    serverBacked: isServer,        // true solo online
    localBacked: isStatic,         // true en static + electron
};

this.export = {
    serverSide: isServer,
    clientSide: true,
};

this.collaboration = {
    enabled: isServer,
    realtime: isServer,
    concurrent: isServer,
};
```

Para administración de iDevices no hay un `capabilities.idevices.*` específico. La UI usa los flags ad-hoc del template (`isOfflineInstallation`, `userIdevices`) que vienen del backend.

## Flag clave: `isOfflineInstallation`

Definido en backend en [src/routes/pages.ts:868](../../src/routes/pages.ts#L868):

```ts
const isOfflineInstallation = isOfflineMode() || appAuthMethods.includes('none');
```

Donde `isOfflineMode()` ([línea 229](../../src/routes/pages.ts#L229)) lee `process.env.APP_ONLINE_MODE` (default `'1'`):

```ts
const isOfflineMode = () => String(process.env.APP_ONLINE_MODE ?? '1') === '0';
```

Por lo tanto en **modo server con auth normal**: `isOfflineInstallation === false`. En **modo offline o con `none` como método de auth**: `true`.

Este valor se inyecta en `eXeLearning.config.isOfflineInstallation` desde el template Nunjucks de la página principal.

## Flag clave: `userIdevices`

[src/routes/pages.ts:930](../../src/routes/pages.ts#L930):

```ts
userIdevices: 0,
```

**Hardcoded a 0.** No hay setting ni env var que lo active. Resultado: la rama de "user iDevices" está **deshabilitada en todos los modos** desde el backend.

Comparado con `userStyles` ([línea 929](../../src/routes/pages.ts#L929)) que sí toma valor desde la setting `ONLINE_THEMES_INSTALL`, queda claro que `userIdevices` está preparado para activarse pero alguien decidió no implementarlo aún.

## Mostrar/ocultar el botón "Import iDevice"

En el modal ([modalIdeviceManager.js:378-383](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L378-L383)):

```js
makeElementButtonImportIdevice() {
    if (
        eXeLearning.config.isOfflineInstallation == false &&
        eXeLearning.config.userIdevices == false
    )
        return false;
    // ... crea el botón
}
```

Lógica invertida: el botón **se oculta solo cuando AMBAS son false**. En la práctica, dado que `userIdevices` siempre es `0`:

| Modo | `isOfflineInstallation` | `userIdevices` | Botón "Import iDevice" |
|---|---|---|---|
| Server con auth normal | `false` | `0` | Oculto |
| Server con `auth=none` | `true` | `0` | **Visible** |
| Offline (`APP_ONLINE_MODE=0`) | `true` | `0` | **Visible** |
| Static / Electron | (vendría como `true` si el bundle se genera con `--offline`) | `0` | Depende del build |

Nota: en modo static el flag `isOfflineInstallation` **no se evalúa en backend** porque no hay backend; depende de cómo `build-static-bundle.ts` configure los valores estáticos en `bundle.json` y de cómo se inyecten en el HTML compilado.

## Modo online: arquitectura de iDevices

Diagrama:

```
Browser                                 Server (Bun + Elysia)
─────────                                ──────────────────────
GET /workarea (HTML)         ────►       Renderiza Nunjucks
                                          inject eXeLearning.config

GET /api/idevices/installed  ────►       scanIdevices(base + users)
                             ◄────       parseIdeviceConfig (regex)
                                          merge users>base
                                          sort by category, title

GET .../download-file-resources?resource=...  ────►  fs.readFileSync
                             ◄────       MIME + (CSS) URL rewriting

POST .../upload/file/resources (base64)  ────►  fs.writeFile a tmp/

POST /api/idevices/install (ZIP completo) ────►  instala iDevices de usuario
DELETE /api/idevices/{id}/delete          ────►  ❌ no implementado
GET /api/idevices/{id}/download           ────►  ❌ no implementado
```

Storage:

- Lista canónica de iDevices en disco: `public/files/perm/idevices/{base,users}/`.
- Recursos subidos durante edición: `${FILES_DIR}/tmp/${sessionId}/content/resources/${ideviceId}/`.
- Preferencias de visibilidad: tabla `users` (vía `PUT /api/user/preferences`) **+** IndexedDB en cliente.

## Modo static / PWA

### Build

`make build-static` ejecuta [scripts/build-static-bundle.ts](../../scripts/build-static-bundle.ts) que genera `dist/static/`:

```
dist/static/
├── index.html                              Nunjucks compilado, sin condicionales server
├── data/bundle.json                        Datos precargados (iDevices, themes, traducciones, parámetros)
├── manifest.json + service-worker.js       PWA shell
├── app/, libs/, style/                     JS y CSS bundled
├── images/
└── files/
    └── perm/
        ├── idevices/base/...               COPIA exacta de los 43 iDevices
        └── themes/base/...
```

`buildIdevicesList()` ([scripts/build-static-bundle.ts:440-471](../../scripts/build-static-bundle.ts#L440-L471)) escanea sólo `public/files/perm/idevices/base/`, parsea cada `config.xml` con un parser local (similar al de `idevices.ts` pero independiente), ordena y vuelca el array completo en `bundle.json`. Los iDevices de `users/` **se ignoran** en el build estático.

### Runtime

- `__EXE_STATIC_MODE__ = true` se inyecta en el HTML.
- `RuntimeConfig` resuelve `mode: 'static'` y carga `bundle.json` al arrancar.
- `apiCallManager` enruta `getIdevicesInstalled()` al objeto cargado del bundle (vía `StaticDataProvider`); no hace fetch HTTP.
- `getResourceServicePath()` ([idevice.js:213-214](../../public/app/workarea/idevices/idevice.js#L213-L214)) detecta que el path contiene `/files/perm/idevices/` y devuelve la URL tal cual — los archivos se cargan directamente del FS bundled.

### Rutas estáticas declaradas

[src/routes/api-routes.ts:133-139](../../src/routes/api-routes.ts#L133-L139):

```ts
export const STATIC_ROUTES: RouteMap = {
    api_translations_lists: API_ROUTES.api_translations_lists,
    api_translations_list_by_locale: API_ROUTES.api_translations_list_by_locale,
    api_idevices_installed: API_ROUTES.api_idevices_installed,
    api_themes_installed: API_ROUTES.api_themes_installed,
    api_config_upload_limits: API_ROUTES.api_config_upload_limits,
};
```

Sólo 5 rutas se "stub-ean" en cliente. El resto (incluyendo `download-file-resources`, `upload`, `delete`, `download` de iDevices) **no existen en static**: si la UI las invoca, falla en silencio (a menudo el cliente devuelve `null` y el flujo se aborta sin error visible para el usuario).

## Modo Electron

### Arranque

[app/main.js](../../app/main.js) registra el protocolo `app://` antes de `app.whenReady()` ([línea 14-27](../../app/main.js#L14-L27)) con `allowServiceWorkers: true` (necesario para la preview SW). Crea una `BrowserWindow` que carga `app://index.html`.

### Origen de archivos

Todos los archivos vienen de `dist/static/` (que el build de Electron empaqueta dentro del ASAR o como recurso). [getStaticPath()](../../app/main.js#L37-L48) resuelve el directorio según si la app está empaquetada o no.

```
dist/static/files/perm/idevices/base/{id}/...
```

El protocolo handler ([app/main.js línea 96+](../../app/main.js#L96)) sirve directamente esos archivos, así que la lectura `GET app:///files/perm/idevices/base/text/edition/text.js` funciona sin servidor HTTP real.

### Diferencias funcionales con PWA

- **Sin `bundle.json`** — Electron pone `staticDataPath: null` ([RuntimeConfig.js:89](../../public/app/core/RuntimeConfig.js#L89)). En su lugar, el frontend hace `fetch('/data/bundle.json')` igual que en PWA, pero servido vía `app://`. (Verificar: el flag se llama `null` pero Electron en la práctica también necesita el bundle. Es un punto a contrastar en código si se quiere confirmar.)
- **`window.electronAPI`** expone IPC para diálogos nativos de archivos (abrir/guardar `.elpx`).
- Sin colaboración Yjs (`wsUrl: null`).
- Sin auth (modo guest).

## Tabla resumen comparativa para iDevices

| Aspecto | Online (server) | Electron | Static / PWA |
|---|---|---|---|
| Listado iDevices | `GET /api/idevices/installed` | Lectura local del bundle | `data/bundle.json` |
| Recursos JS/CSS | `GET .../download-file-resources` con CSS rewriting | Path directo `/files/perm/idevices/...` | Path directo |
| Subida recurso (uploads en edición) | `POST .../upload/file/resources` | ❌ sin endpoint | ❌ sin endpoint |
| Importar iDevice (ZIP) | ❌ declarado, sin handler | ❌ sin endpoint | ❌ sin endpoint |
| Borrar iDevice | ❌ declarado, sin handler | ❌ sin endpoint | ❌ sin endpoint |
| Exportar iDevice como ZIP | ❌ declarado, sin handler | ❌ sin endpoint | ❌ sin endpoint |
| Lectura de `users/` | ✅ se merge sobre base | ❌ ignorado (no se incluye en bundle) | ❌ ignorado |
| `isOfflineInstallation` | `false` con auth normal | (depende del build) | (depende del build) |
| `userIdevices` | `0` hardcoded | `0` hardcoded | `0` hardcoded |
| Botón "Import iDevice" | Oculto con auth normal, visible con `auth=none`/offline | Visible si el bundle lo activa | Visible si el bundle lo activa |
| Visibilidad por usuario | IndexedDB + `PUT /api/user/preferences` | IndexedDB local | IndexedDB local |

## Hallazgos por modo

- **Online:** la administración real de iDevices (instalar/desinstalar/exportar) está cableada en el frontend pero los handlers backend faltan. El único upload implementado es el de **recursos de un iDevice ya instalado** (imágenes, audios) — no de iDevices completos.
- **Electron:** equivalente a static; cualquier acción de administración termina en mock o silencio. La UI no distingue Electron de PWA porque ambos son `mode: 'static'`.
- **Static:** los iDevices son **inmutables** desde el cliente. Para cambiar el catálogo hay que regenerar el bundle. Los iDevices de `users/` no llegan al build, así que aunque alguien los añadiera al servidor de origen, la PWA los ignoraría.
- **Lógica del botón:** la combinación `userIdevices: 0` hardcoded + `isOfflineInstallation` solo activa por env hace que en deployments online normales el botón "Import iDevice" del modal **nunca se vea**. Si el equipo quiere llevar la admin a la UI, hay que cambiar al menos `userIdevices` a un setting real.
