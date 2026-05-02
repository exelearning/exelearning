# Estudio: Administración de iDevices en eXeLearning (rama `main`)

Estudio detallado del estado actual de la administración de iDevices en `main`, cubriendo cómo se comporta en los **tres modos de despliegue** del proyecto: **online** (servidor Bun + Elysia), **electron** (desktop) y **static** (PWA / build embebible).

> **Importante.** Online, Electron y Static **no son ramas distintas** del repositorio: son tres modos de despliegue dentro de `main`, detectados en runtime por [public/app/core/RuntimeConfig.js](../../public/app/core/RuntimeConfig.js). La administración de iDevices se comporta muy diferente en cada uno.

## Índice

| Documento | De qué trata |
|---|---|
| [01-anatomy.md](./01-anatomy.md) | Estructura de un iDevice: `config.xml`, `edition/`, `export/`, las 5 categorías canónicas, los 43 iDevices del sistema, aliases legacy |
| [02-backend.md](./02-backend.md) | Rutas API, parser XML por regex, servicio cacheado, autorización, **endpoints declarados sin handler** |
| [03-frontend.md](./03-frontend.md) | Manager + List + Idevice, menú lateral por categorías, modal de visibilidad, IndexedDB, inyección dinámica de scripts |
| [04-modes.md](./04-modes.md) | Diferencias online vs electron vs static: detección de modo, capabilities, flags `isOfflineInstallation` y `userIdevices`, tabla comparativa |
| [05-admin-flows.md](./05-admin-flows.md) | Diagramas paso a paso de los 7 flujos: listar, cargar edición, cargar export, importar ZIP, eliminar, exportar, visibilidad |
| [06-tests.md](./06-tests.md) | Cobertura backend (Bun), frontend (Vitest) y E2E (Playwright), con detección de tests que pasan con backend mockeado |
| [07-findings.md](./07-findings.md) | 15 hallazgos accionables: endpoints rotos, code muerto, defaults divergentes, errata visible, etc. |
| [08-branch-status.md](./08-branch-status.md) | Análisis cruzado contra la rama `idevice-local-installer`: qué hallazgos se resuelven, qué queda pendiente, hallazgos nuevos detectados |

## Resumen ejecutivo

eXeLearning trae **43 iDevices** preinstalados en [public/files/perm/idevices/base/](../../public/files/perm/idevices/base/). Cada uno es una carpeta con `config.xml` (metadatos sin XSD), `edition/` (código del editor) y `export/` (runtime al exportar a SCORM/HTML5/EPUB/IMS).

La **administración** —entendida como listar, importar, eliminar, exportar y configurar visibilidad de iDevices— está cableada en frontend con UI completa (modal "iDevice manager" + menú lateral con drag-and-drop) pero **no está completa en backend**:

- ✅ **Listar** funciona (`GET /api/idevices/installed`).
- ✅ **Cargar para edición / exportación** funciona en los tres modos.
- ✅ **Subir recursos de un iDevice** (imágenes, audios) funciona.
- ✅ **Visibilidad de favoritos** (máx 5) funciona en cliente (IndexedDB), aunque la sincronización al servidor está desconectada.
- ❌ **Importar iDevice ZIP**, **eliminar**, **exportar como ZIP** están **declarados** en [api-routes.ts](../../src/routes/api-routes.ts) pero **no implementados** en [idevices.ts](../../src/routes/idevices.ts). El frontend los llama y obtiene 404 silencioso.

## Diferencias entre modos (vista rápida)

| Aspecto | Online (server) | Electron | Static / PWA |
|---|---|---|---|
| Listado iDevices | `GET /api/idevices/installed` | `data/bundle.json` precargado | `data/bundle.json` precargado |
| Recursos JS/CSS | Endpoint con CSS rewriting | Path directo `app://` | Path directo |
| Subida de recursos en edición | ✅ | ❌ | ❌ |
| Importar iDevice ZIP | ❌ (handler ausente) | ❌ | ❌ |
| Borrar iDevice | ❌ (handler ausente) | ❌ | ❌ |
| Exportar iDevice ZIP | ❌ (handler ausente) | ❌ | ❌ |
| Carpeta `users/` | Soportada por API | Ignorada | Ignorada |
| Visibilidad favoritos | IndexedDB local + (código de sync desconectado) | IndexedDB local | IndexedDB local |
| `userIdevices` config | `0` hardcoded | `0` hardcoded | `0` hardcoded |

Para el detalle de la decisión de modo y los flags ver [04-modes.md](./04-modes.md).

## Top hallazgos (lista corta)

1. **Endpoint legacy de instalación** ([H1](./07-findings.md#h1--endpoint-legacy-de-instalación-de-idevices)) — no usar `POST /api/idevices/upload`; el flujo actual usa `POST /api/idevices/install` para usuario y `POST /api/admin/idevices/upload` para administración.
2. **`userIdevices: 0` hardcoded** ([H3](./07-findings.md#h3--userIdevices-0-hardcoded-en-backend)) — sin setting ni env var. La feature está deshabilitada por construcción.
3. **`users/` vacío y huérfano** ([H2](./07-findings.md#h2--users-está-vacío-sin-entrada-de-ui-funcional)) — el backend lo escanea pero no hay forma soportada de poblarlo.
4. **No hay XSD** ([H5](./07-findings.md#h5--no-hay-xsdjson-schema-para-configxml)) — `config.xml` se valida implícitamente con regex tolerante; cualquier formato pasa.
5. **Tests cliente con backend mockeado** ([H14](./07-findings.md#h14--tests-cliente-con-backend-mockeado)) — el "happy path" de import/delete/export pasa en CI aunque no exista handler.

Lista completa de los 15 hallazgos en [07-findings.md](./07-findings.md).

## Cómo leer este estudio

- Si quieres entender **cómo está hecho un iDevice**, empieza por [01-anatomy.md](./01-anatomy.md).
- Si vienes a tocar **rutas o lógica de servidor**, ve a [02-backend.md](./02-backend.md).
- Si vienes a tocar **UI o el modal**, ve a [03-frontend.md](./03-frontend.md).
- Si quieres entender **por qué algo funciona online y no en static**, ve a [04-modes.md](./04-modes.md).
- Si necesitas **un mapa visual de un flujo**, ve a [05-admin-flows.md](./05-admin-flows.md).
- Si planeas **añadir tests** o **cerrar gaps de cobertura**, ve a [06-tests.md](./06-tests.md).
- Si quieres **proponer mejoras**, ve a [07-findings.md](./07-findings.md).

## Alcance del estudio

- **Es:** descripción del estado actual + diagnóstico de inconsistencias.
- **No es:** propuesta de refactor, plan de implementación, ni cambio en código fuente. Las "sugerencias" en [07-findings.md](./07-findings.md) son material para discutir, no decisiones tomadas.
- **Datos verificados:** los 43 iDevices, las 10 declaraciones en `api-routes.ts`, los 5 handlers en `idevices.ts`, los flags `isOfflineInstallation` y `userIdevices`, la lógica del modal y el menú, y la estructura del build estático y de Electron — todo leído directamente del código de la rama `main` el día del estudio.
- **No verificado al 100%:** la cadena de middlewares de Elysia para autorización ([H11](./07-findings.md#h11--no-hay-autenticaciónautorización-en-los-handlers-de-idevices)) y el comportamiento exacto de Electron al cargar `data/bundle.json` (ver nota en [04-modes.md](./04-modes.md)).
