# 08 — Análisis cruzado con la rama `idevice-local-installer`

> Cómo los últimos commits de la rama `idevice-local-installer` impactan los hallazgos de este estudio (originalmente hecho sobre `main`). Qué queda resuelto, qué sigue pendiente, qué hallazgos nuevos surgen.

## Contexto

La rama [`idevice-local-installer`](https://github.com/exelearning/iteexe/tree/idevice-local-installer) añade ~7.500 líneas en commits `abea31aa2 iDevice Manager V1`, `5f0f88dd2 iDevice Manager V2`, `2f05ca46d Improve admin iDevice manager` (más una serie de commits del nuevo iDevice `adaptative-quiz`). Comparado con `main`, los archivos clave nuevos/modificados son:

```
src/routes/admin-idevices.ts                  290 líneas  NUEVO
src/routes/admin-idevices.spec.ts             339 líneas  NUEVO
src/routes/idevice-installer.ts               180 líneas  NUEVO
src/routes/idevice-installer.spec.ts          271 líneas  NUEVO
src/services/idevice-installer.ts             591 líneas  NUEVO
src/services/idevice-installer.spec.ts        509 líneas  NUEVO
src/services/idevice-admin-settings.ts         51 líneas  NUEVO
src/services/idevice-admin-settings.spec.ts    43 líneas  NUEVO
src/utils/local-mode.util.ts                   46 líneas  NUEVO
src/utils/local-mode.util.spec.ts              95 líneas  NUEVO
views/admin/index.njk                         337 líneas  NUEVO
public/files/perm/idevices/site/adaptative-quiz/    +carpeta entera (~6.000 líneas)
src/routes/idevices.ts                         +290 / -200  REFACTOR
src/routes/api-routes.ts                          +2 / -2   ajuste paths
src/routes/pages.ts                              +11 / -1   userIdevices ahora dinámico
public/app/rest/apiCallManager.js                +78 / -2   FormData + normalización
public/app/workarea/modals/modals/pages/modalIdeviceManager.js   +308 / -75  pestañas System/User
public/app/workarea/menus/idevices/menuIdevicesCompose.js        +108 / -25  ajustes
workarea-auth.html                            1561 líneas  NUEVO (en root, no views/)
```

> Nota: aún no se ha mergeado a `main` y se ha hecho desde `main` (no desde algún commit más antiguo), así que los hallazgos del estudio siguen vigentes contra `main` mientras que esta rama los resuelve parcialmente.

## Resolución de los hallazgos del estudio (07-findings.md)

### ✅ H1 · Endpoints de administración sin handler — **resuelto parcialmente**

La rama implementa los handlers, **renombrando los paths**:

| Path en `main` (api-routes.ts) | Path en rama (api-routes.ts) | Handler en rama |
|---|---|---|
| `POST /api/idevices/upload` | `POST /api/idevices/install` | [src/routes/idevice-installer.ts:106-141](../../src/routes/idevice-installer.ts) |
| `DELETE /api/idevices/{ideviceId}/delete` | `DELETE /api/idevices/installed/{ideviceId}` | [src/routes/idevice-installer.ts:144-163](../../src/routes/idevice-installer.ts) |
| `GET /api/idevices/{ideviceId}/download` | (sin cambios) | [src/routes/idevice-installer.ts](../../src/routes/idevice-installer.ts) |

Además aparecen **3 endpoints admin nuevos** en [src/routes/admin-idevices.ts](../../src/routes/admin-idevices.ts), todos con guard JWT + `requireAdmin`:

- `GET /api/admin/idevices` — listado completo con flag `isEnabled` y `source: 'base' | 'site'`
- `GET /api/admin/idevices/:id`
- `POST /api/admin/idevices/upload` — instala en `site/`
- `DELETE /api/admin/idevices/:id` — desinstala de `site/` (no permite borrar `base/`)
- `PATCH /api/admin/idevices/:id/enabled` — activa/desactiva por BD

**Lo que sigue pendiente:**
- Los endpoints declarados pero todavía huérfanos en la rama: `api_idevices_download_ode_components`, `api_idevices_force_download_file_resources`.
- `GET /api/idevices/{ideviceId}/download` ya exporta como ZIP el iDevice instalado del usuario autenticado y el administrador de iDevices muestra un icono de descarga junto a cada iDevice de usuario.

### ✅ H2 · `users/` vacío y huérfano — **resuelto, con nueva taxonomía**

La rama introduce **tres ubicaciones distintas**:

```
public/files/perm/idevices/
├── base/        ← iDevices del sistema (los 43)
├── site/        ← iDevices instalados por administradores (NUEVO)
└── users/{userId}/   ← iDevices instalados por un usuario específico (NUEVO scoping)
```

[src/routes/idevices.ts:40-42](../../src/routes/idevices.ts#L40-L42):

```ts
export const IDEVICES_BASE_PATH = 'public/files/perm/idevices/base';
export const IDEVICES_SITE_PATH = 'public/files/perm/idevices/site';
export const IDEVICES_USERS_PATH = 'public/files/perm/idevices/users';
```

Ya hay un iDevice instalado en `site/`: `adaptative-quiz` (Adaptative Quiz, gameId 10, categoría "Assessment and tracking"). Su `config.xml` usa un nuevo campo `<default-visibility>0</default-visibility>` no presente antes.

**Implicación importante:** los iDevices `users/` están ahora **scoped por usuario** (`users/{userId}/{ideviceId}/`). El listado de `/api/idevices/installed` resuelve el `userId` desde el JWT y solo incluye los iDevices del usuario actual. Diseño correcto, pero significa que un usuario A no ve los iDevices instalados por el usuario B.

### ✅ H3 · `userIdevices: 0` hardcoded — **resuelto**

[src/routes/pages.ts:900-905,939](../../src/routes/pages.ts):

```ts
const userIdevicesEnabled =
    isOfflineInstallation ||
    isDevEnv() ||
    (await getSettingBoolean(
        db,
        'ONLINE_IDEVICES_INSTALL',
        parseAppSettingBoolean(process.env.ONLINE_IDEVICES_INSTALL, false),
    ));
// ...
userIdevices: userIdevicesEnabled ? 1 : 0,
```

Ahora el flag se activa por:
- modo offline (`APP_ONLINE_MODE=0`),
- modo dev (`APP_ENV=dev`),
- env `ONLINE_IDEVICES_INSTALL=1`,
- o setting de BD `ONLINE_IDEVICES_INSTALL` (administrable por admin).

### ✅ H4 · Lógica del botón "Import iDevice" con AND invertido — **resuelto implícitamente**

Con H3 resuelto, la condición funciona como esperaba la UI. Adicionalmente, [modalIdeviceManager.js:428](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js) cambió el texto a `_('Install iDevice')` (más preciso: ya no es "importar", es "instalar").

### ⚠️ H5 · No hay XSD/JSON-Schema para `config.xml` — **mejorado, no resuelto**

El instalador ahora valida muchas cosas con códigos de error específicos en [src/services/idevice-installer.ts](../../src/services/idevice-installer.ts):

```ts
type InstallErrorCode =
  | 'INVALID_ZIP' | 'ZIP_TOO_LARGE' | 'UNCOMPRESSED_SIZE_TOO_LARGE'
  | 'TOO_MANY_FILES' | 'ZIP_SLIP_DETECTED' | 'UNSUPPORTED_EXTENSION'
  | 'CONFIG_XML_NOT_FOUND' | 'INVALID_CONFIG_XML' | 'INVALID_NAME'
  | 'MISSING_REQUIRED_FIELD' | 'MISSING_EDITION_FOLDER' | 'MISSING_EXPORT_FOLDER'
  | 'MISSING_EDITION_JS' | 'MISSING_EXPORT_JS' | 'INVALID_COMPONENT_TYPE'
  | 'INVALID_ICON' | 'MISSING_ICON_FILE' | 'EXPORT_OBJECT_NOT_FOUND'
  | 'EXPORT_OBJECT_CONFLICT' | 'IDEVICE_OVERLAPS_BUILTIN'
  | 'IDEVICE_ALREADY_EXISTS_NEEDS_CONFIRM' | 'COPY_ERROR'
  | 'ROLLBACK_ERROR' | 'UNKNOWN_ERROR';
```

Validaciones notables:
- `ID_REGEX = /^[a-z0-9][a-z0-9_-]{2,79}$/`
- `BLOCKED_EXTENSIONS` rechaza `.exe`, `.bat`, `.sh`, `.php`, `.jar`, `.dll`, etc.
- Detecta zip-slip, limita 20MB ZIP, 100MB descomprimido, 500 archivos.
- Verifica que el nombre no solape con un built-in (`IDEVICE_OVERLAPS_BUILTIN`).
- Verifica que el `exportObject` derivado del id no colisione con uno existente.

**Sigue sin haber un schema declarativo** (XSD/JSON Schema). La validación está hardcoded en el servicio. Es robusta pero no documentada como contrato.

### ✅ H6 · Doble parser de `config.xml` en backend — **resuelto**

[src/routes/idevices.ts](../../src/routes/idevices.ts), [src/services/idevice-config.ts](../../src/services/idevice-config.ts) y [scripts/build-static-bundle.ts](../../scripts/build-static-bundle.ts) usan el parser compartido de [src/shared/parsers/idevice-parser.ts](../../src/shared/parsers/idevice-parser.ts). El instalador ([src/services/idevice-installer.ts](../../src/services/idevice-installer.ts)) reutiliza `scanIdevices`, evitando otra implementación.

**Cambios clave:**
- [src/services/idevice-config.ts](../../src/services/idevice-config.ts) ya no usa un parser propio con `fast-xml-parser`; carga `base + site` por defecto, permite paths explícitos para tests/export scoped y mantiene precedencia `site > base`.
- [scripts/build-static-bundle.ts](../../scripts/build-static-bundle.ts) ya no tiene parser local y construye el catálogo estático desde `base + site`. Los `users/{userId}` se excluyen deliberadamente porque el bundle estático no tiene contexto de usuario.
- El exporter server-side refresca la caché de iDevices con `base + site` antes de exportar, y el provider de recursos busca `site/` antes que `base/`.

**Resultado:** un proyecto que use un iDevice instalado en `site/` (por ejemplo `adaptative-quiz`) puede resolver su configuración y sus recursos tanto en export server-side como en el bundle estático.

### H7 · Defaults divergentes — **sin cambios**

Backend: `'Uncategorized'`. Cliente: `'Others'`.

Mejora colateral: [src/routes/idevices.ts:216](../../src/routes/idevices.ts) ahora hace fallback de `title` a `<name>` si `<title>` falta:
```ts
title: getValue('title') || getValue('name') || ideviceId,
```

### ✅ H8 · `addNewReader` referenciada pero no definida en `modalIdeviceManager.js` — **resuelto**

El modal ya define `addNewReader(file)` en [public/app/workarea/modals/modals/pages/modalIdeviceManager.js](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js). La función crea un `FileReader`, lo guarda en `this.readers`, lee el ZIP seleccionado con `readAsDataURL(file)` y, cuando termina la lectura, llama a `uploadIdevice(file.name, event.target.result)`.

En la práctica, conecta el `<input type="file" accept=".zip">` del modal con el flujo de instalación `POST /api/idevices/install` mediante el wrapper `postUploadIdevice`.

### ✅ H9 · `setConfirmExec` con sincronización comentada — **resuelto**

El flujo nuevo ya no guarda favoritos al pulsar el botón de confirmación del modal. Los toggles se persisten inmediatamente en IndexedDB (`idevicesSettings`) desde el listener `change` de cada fila, mediante `saveIdevices(idevicesArray)`, y después se refresca el menú inferior de iDevices.

Por eso [public/app/workarea/modals/modals/pages/modalIdeviceManager.js](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js) ahora limpia explícitamente la acción de confirmación con `setConfirmExec(null)`: el botón de confirmar solo cierra el modal. También se eliminó la llamada posterior a `saveIdevicesVisibility()` tras instalar un ZIP, porque esa función pertenece al flujo antiguo de preferencias servidor-side y busca selectores que la tabla nueva ya no renderiza (`.idevice-row .idevice-visible input`).

**Matiz:** si se quiere que la lista de favoritos se sincronice entre dispositivos/sesiones mediante servidor, eso ya no es H9 sino una feature nueva: habría que definir un contrato explícito para persistir `idevicesSettings` fuera de IndexedDB.

### ✅ H10 · `getBaseIdevices`/`getUserIdevices` sin entrada — **resuelto**

[src/routes/idevices.ts:330-355](../../src/routes/idevices.ts) ahora añade `type: 'base' | 'user'` y `source: 'base' | 'site' | 'user'` a cada elemento de la respuesta. El modal ([modalIdeviceManager.js:277-296](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js)) ahora **renderiza pestañas reales** "System" / "User":

```js
const baseIdevicesTabData = { title: _('System'), id: 'base-idevices-tab', active: true };
const userIdevicesTabData = { title: _('User'), id: 'user-idevices-tab' };
idevicesListContainer.append(this.makeIdevicesFormTabs([baseIdevicesTabData, userIdevicesTabData]));
idevicesListContainer.append(this.makeElementTableIdevices(this.idevicesBase, baseIdevicesTabData));
idevicesListContainer.append(this.makeElementTableIdevices(this.idevicesUser, userIdevicesTabData));
```

### ✅ H11 · Sin auth en handlers — **resuelto**

- [src/routes/admin-idevices.ts:138-160](../../src/routes/admin-idevices.ts) usa `.guard({ async beforeHandle({ jwt, cookie, set }) { ... requireAdmin(payload) ... }})`. Devuelve 401/403 explícitamente.
- [src/routes/idevice-installer.ts:107-115](../../src/routes/idevice-installer.ts) requiere `currentUser` resuelto desde JWT cookie.
- Adicionalmente, [src/routes/idevices.ts:316](../../src/routes/idevices.ts) ahora resuelve `currentUser` para scoping de `users/{userId}/`. El listado en sí sigue siendo accesible sin auth (devuelve solo `base + site` si no hay user), lo que es razonable.

### H12, H13, H15 · Categorías hardcoded, errata "Sciencie", filtro de `example` — **sin cambios**

Ninguno de los tres se aborda en la rama. La errata sigue ahí.

### ✅ H14 · Tests cliente con backend mockeado — **mejorado**

La rama añade **tests reales de backend**:

- [src/routes/idevice-installer.spec.ts](../../src/routes/idevice-installer.spec.ts) — 271 líneas
- [src/routes/admin-idevices.spec.ts](../../src/routes/admin-idevices.spec.ts) — 339 líneas
- [src/services/idevice-installer.spec.ts](../../src/services/idevice-installer.spec.ts) — 509 líneas (cubre los códigos de error, ZIP slip, rollback, etc.)
- [src/services/idevice-admin-settings.spec.ts](../../src/services/idevice-admin-settings.spec.ts) — 43 líneas
- [src/utils/local-mode.util.spec.ts](../../src/utils/local-mode.util.spec.ts) — 95 líneas
- [src/routes/idevices.spec.ts](../../src/routes/idevices.spec.ts) — +171 líneas (incluyendo casos de `disabled` filter y type/source)
- [src/routes/pages.spec.ts](../../src/routes/pages.spec.ts) — +107 líneas (incluyendo `userIdevicesEnabled`)

**Lo que sigue pendiente:** Playwright E2E del flujo `install → use → uninstall` no se ha añadido (revisado: no hay nuevos `.spec.ts` en `test/e2e/playwright/specs/idevices/` en la rama).

## Hallazgos nuevos detectados en los commits de la rama

### NH1 · Discordancia entre `api-routes.ts` y el wrapper de descarga — **resuelto**

[apiCallManager.js](../../public/app/rest/apiCallManager.js) ahora sustituye el placeholder real `{ideviceId}`:

```js
async getIdeviceInstalledZip(ideviceId) {
    let url = this.endpoints.api_idevices_installed_download.path;
    url = url.replace('{ideviceId}', encodeURIComponent(ideviceId));
    return await this.func.get(url);
}
```

El endpoint devuelve `{ zipFileName, zipBase64 }` para descargar el ZIP fuente/instalable del iDevice de usuario.

### NH2 · El path `IDEVICES_USERS_PATH` se usa en dos sitios con semántica distinta

- En `idevice-installer.ts` (servicio): `users/{userId}/{ideviceId}/` (instalación scoped por usuario en modo local).
- En `admin-idevices.ts`: el admin instala en `site/`, no en `users/`.

[src/routes/admin-idevices.ts:73](../../src/routes/admin-idevices.ts):
```ts
installer: createIdeviceInstallerService({ userIdevicesPath: IDEVICES_SITE_PATH }),
```

El `userIdevicesPath` del servicio se sobreescribe con `site/` en el caso admin. Funciona, pero el nombre del parámetro (`userIdevicesPath`) ahora abarca dos cosas distintas. Renombrar a algo como `installTargetPath` sería más honesto.

### NH3 · Exporter server-side y build estático no incluyen `site/` — **resuelto**

[src/services/idevice-config.ts](../../src/services/idevice-config.ts) carga `base + site` por defecto y permite pasar una lista explícita de paths en orden de precedencia. El exporter server-side llama a `loadIdeviceConfigs([base, site])` antes de renderizar para que `IdeviceRenderer` resuelva `componentType`, templates y archivos de exportación de iDevices instalados por administradores.

[scripts/build-static-bundle.ts](../../scripts/build-static-bundle.ts) también construye el catálogo desde `base + site` usando el parser compartido:

```ts
const sources = [
    { source: 'base', dir: path.join(idevicesRoot, 'base') },
    { source: 'site', dir: path.join(idevicesRoot, 'site') },
];
```

Los iDevices de `users/{userId}` quedan fuera del bundle estático por diseño: un build PWA/Electron compartido no tiene usuario autenticado. En server-side export se puede pasar scope de usuario para resolver `users/{userId}` antes de `site` y `base`.

### NH4 · `GET /api/idevices/{ideviceId}/download` declarado y sin handler — **resuelto**

La ruta está implementada en [src/routes/idevice-installer.ts](../../src/routes/idevice-installer.ts). Requiere usuario autenticado, respeta el scoping `users/{userId}/{ideviceId}/` y devuelve 404 si el iDevice no pertenece al usuario actual.

### NH5 · `workarea-auth.html` aparece en la raíz del repo

`workarea-auth.html` (1561 líneas) se añadió en `iDevice Manager V1` directamente en el directorio raíz, junto al `package.json`, en lugar de en `views/`. Mirando el contenido (es una copia compilada del workarea con scripts de `/v0.0.0-alpha/`), parece un **artefacto de generación** o un **dump de debug** que se coló en el commit. Probablemente debería:
- Eliminarse del commit, o
- Moverse a `views/` si es intencional, o
- Añadirse a `.gitignore`.

### NH6 · `views/admin/index.njk` (337 líneas) introduce panel admin web

[views/admin/index.njk](../../views/admin/index.njk) trae UI de admin con sidebar, gestión de iDevices con toggle enable/disable, install y uninstall. Pero esto **no está documentado** en `doc/development/` ni en el `AGENTS.md`. El estudio asumía que la admin de iDevices era solo programática; en la rama existe ya un panel real.

### NH7 · Nuevo campo `<default-visibility>` en `config.xml` no documentado

[adaptative-quiz/config.xml:35](../../public/files/perm/idevices/site/adaptative-quiz/config.xml):

```xml
<default-visibility>0</default-visibility>
```

Este campo no aparece en el parser ([idevices.ts:90-216](../../src/routes/idevices.ts#L90-L216)) ni en `IdeviceConfig`. Es decir, está en el XML pero **el backend lo ignora**. ¿Deuda futura, basura del template, o feature por implementar? Pendiente de aclarar.

### NH8 · `icon`/`url` `<location>`/`<location-type>` siguen como campos zombi

`adaptative-quiz/config.xml` sigue declarando `<location>location</location>` y `<location-type>location type</location-type>`. Estos campos están en el parser y se devuelven en la respuesta API, pero **nadie los usa en cliente** (no aparecen en la clase `Idevice` ni en el modal). El estudio ya marcaba esto pero no como hallazgo separado; con un iDevice nuevo replicando el patrón, se confirma que es deuda heredada.

### NH9 · Servicio de `disabled` aplica solo al endpoint público, no al admin

[src/routes/idevices.ts:362](../../src/routes/idevices.ts) filtra: `result = ...filter(idevice => !disabledIdeviceIds.has(idevice.id))`. Bien.

[admin-idevices.ts:182](../../src/routes/admin-idevices.ts) NO filtra; devuelve todos con `isEnabled: !disabledIds.has(idevice.id)`. Correcto: el admin necesita ver los inhabilitados para reactivarlos.

Pero en [idevices.ts:401-405](../../src/routes/idevices.ts) (endpoint `GET /api/idevices/installed/:ideviceId`) **también** filtra los `disabled` devolviendo 404. Eso significa que un iDevice deshabilitado no se puede consultar individualmente, ni siquiera para mostrar metadatos. Razonable, pero podría querer reconsiderarse para preview/compatibilidad legacy.

### NH10 · Sin migración de BD para `app_settings.ADMIN_DISABLED_IDEVICES`

El servicio [idevice-admin-settings.ts](../../src/services/idevice-admin-settings.ts) lee/escribe la clave `ADMIN_DISABLED_IDEVICES` en la tabla `app_settings`. Asume que la tabla existe. **No se ve una migración nueva en `src/db/migrations/`** — confiar en una migración previa para `app_settings` puede ser correcto, pero conviene verificar y documentar el upgrade path.

### NH11 · El campo `STATIC_ROUTES` no se actualiza

[api-routes.ts:133-139](../../src/routes/api-routes.ts) sigue:

```ts
export const STATIC_ROUTES: RouteMap = {
    api_translations_lists: ...,
    api_translations_list_by_locale: ...,
    api_idevices_installed: ...,
    api_themes_installed: ...,
    api_config_upload_limits: ...,
};
```

Bien: en static no tiene sentido instalar iDevices (no hay backend). Pero las nuevas rutas `/api/admin/idevices/*` **no se filtran explícitamente** del frontend en modo static, así que si la UI admin se carga ahí podría intentarlas y fallar. Mínimo, asegurar que el frontend nunca intenta llegar al panel admin en static.

### NH12 · `adaptative-quiz` es el ZIP de prueba del instalador y debe eliminarse del repo antes del merge

`adaptative-quiz` (~6.000 líneas, en [public/files/perm/idevices/site/adaptative-quiz/](../../public/files/perm/idevices/site/adaptative-quiz/)) **no es una feature** del proyecto: es el paquete que el desarrollador usa para probar el instalador. La trayectoria por commits lo confirma:

- En `iDevice Manager V1` (`abea31aa2`) se borra de `base/` (donde estaba como iDevice del sistema durante el desarrollo del feature original).
- En `Improve admin iDevice manager` (`2f05ca46d`) se añade en `site/` (donde caería tras instalarse vía el panel admin).

**Acción antes del merge:** eliminar la carpeta entera `public/files/perm/idevices/site/adaptative-quiz/` y todos los commits relacionados con la feature `adaptative-quiz` en sí (commits `ddfc52bf9` para abajo: `feat(idevice): add Adaptative Quiz iDevice`, todos los `feat(adaptative-quiz)`/`fix(adaptative-quiz)`/`style(adaptative-quiz)`, y la integración `gameId 10` en `common_edition.js`). El instalador debe quedar verificable solo con sus tests unitarios; un ZIP de fixture en `test/fixtures/` sería el equivalente "limpio" si se quiere preservar el caso de prueba.

## Tabla resumen

| Hallazgo del estudio | Estado en `idevice-local-installer` |
|---|---|
| H1 endpoints sin handler | ✅ implementados (con paths nuevos), excepto `download` |
| H2 `users/` vacío | ✅ resuelto con nueva taxonomía `base/site/users` |
| H3 `userIdevices: 0` hardcoded | ✅ ahora setting BD + env + modo |
| H4 lógica AND invertido del botón | ✅ funciona |
| H5 sin XSD | ⚠️ validación robusta hardcoded, sin schema |
| H6 doble parser backend | ✅ resuelto: parser compartido en rutas, servicio exporter y bundle estático |
| H7 defaults divergentes | sin cambios (mejora menor en `title`) |
| H8 `addNewReader` no definida | ✅ resuelto: definida y conectada al upload ZIP del modal |
| H9 `setConfirmExec` comentado | ✅ resuelto: confirmación no guarda; los toggles persisten al cambiar |
| H10 `type/source` sin entrada | ✅ backend devuelve `type` y `source`, modal usa pestañas |
| H11 sin auth | ✅ JWT + `requireAdmin` |
| H12 categorías hardcoded | sin cambios |
| H13 errata "Sciencie" | sin cambios |
| H14 tests con backend mockeado | ✅ tests reales de backend; falta E2E |
| H15 `example` filtrado en cliente | sin cambios |

| Hallazgo nuevo en la rama | Severidad |
|---|---|
| NH1 wrapper download tiene placeholders incorrectos | ✅ resuelto |
| NH2 `userIdevicesPath` se reusa para `site/` (nombre confuso) | Baja |
| NH3 exporter server-side y static bundle no incluyen `site/` | ✅ resuelto |
| NH4 `download` endpoint sigue declarado y sin handler | ✅ resuelto |
| NH5 `workarea-auth.html` en root del repo | Baja (probable artefacto) |
| NH6 panel admin sin documentación | Media |
| NH7 `<default-visibility>` ignorado por backend | Baja (feature pendiente o basura) |
| NH8 campos zombi `location`/`location-type` perduran | Baja |
| NH9 `disabled` también filtra `:ideviceId` (404 en lugar de devolver con flag) | Baja |
| NH10 sin migración BD para `app_settings.ADMIN_DISABLED_IDEVICES` (a verificar) | Media |
| NH11 `STATIC_ROUTES` no filtra rutas admin para static/electron | Baja |
| NH12 `adaptative-quiz` es el ZIP de prueba: eliminar del repo antes del merge | **Alta** |

## Recomendaciones para cerrar la rama

Por orden de impacto:

1. **NH3 — resuelto.** Mantener tests que garanticen `site/` en exporter server-side y build estático.

2. **NH4 + NH1 — endpoint `download` resuelto.** Mantener cobertura backend/frontend y verificar en E2E dentro del flujo install → download → uninstall.

3. **H9 — resuelto.** El modal guarda favoritos en cada toggle e IndexedDB sigue siendo la fuente local; la sincronización servidor-side queda como posible feature futura, no como bug del confirm.

4. **NH5 — eliminar `workarea-auth.html` del root** o moverlo a `views/`.

5. **NH7 — documentar `<default-visibility>`** o eliminarlo del `config.xml` de `adaptative-quiz`.

6. **NH6 — añadir `doc/development/admin-panel.md`** describiendo `views/admin/index.njk` y los endpoints `/api/admin/*`.

7. **H14 — añadir spec Playwright** del flujo install → use → uninstall, idealmente con dos perfiles (admin instalando en `site/`, usuario instalando en `users/{userId}/` en modo local).

8. **NH12 — eliminar `adaptative-quiz` del repo** antes del merge: es el ZIP de prueba del instalador, no una feature. Eliminar la carpeta `public/files/perm/idevices/site/adaptative-quiz/` y la cadena de commits `feat(adaptative-quiz)/fix(adaptative-quiz)/style(adaptative-quiz)`. Si se quiere preservar como fixture de tests, moverlo como `.zip` a `test/fixtures/`.

9. **H6 — resuelto.** Mantener la cobertura sobre parser compartido, `site/` en exporter server-side y `site/` en build estático para evitar regresiones.

10. **H13 — corregir errata "Sciencie"** y migrar la cadena en los `.xlf`.

11. **NH10 — verificar/añadir migración** para garantizar la columna `app_settings` en bases nuevas.
