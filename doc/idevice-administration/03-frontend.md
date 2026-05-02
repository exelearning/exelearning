# 03 — Frontend / UI

> Cómo el cliente lista, carga, instala y muestra iDevices. Quién renderiza qué y dónde se persiste el estado.

## Mapa de archivos

```
public/app/
├── rest/
│   └── apiCallManager.js                       Wrappers HTTP de todos los endpoints
├── workarea/
│   ├── idevices/
│   │   ├── idevicesManager.js                  Manager raíz, expuesto como app.idevices
│   │   ├── idevicesList.js                     Carga inicial y diccionario { name → Idevice }
│   │   └── idevice.js                          Clase Idevice (un objeto por iDevice instalado)
│   ├── menus/idevices/
│   │   ├── menuIdevices.js                     Coordina compose + behaviour
│   │   ├── menuIdevicesCompose.js              Construye el menú lateral (categorías + drag & drop)
│   │   └── menuIdevicesBehaviour.js            Listeners (click, drag start/end)
│   ├── modals/modals/pages/
│   │   └── modalIdeviceManager.js              Modal "iDevice manager" (visibilidad de favoritos)
│   └── project/idevices/
│       └── idevicesEngine.js                   Inyección dinámica de <script>/<style> con dedup y URL rewriting
└── core/
    ├── RuntimeConfig.js                         Decisión única de modo
    └── Capabilities.js                          Feature flags por modo
```

## Carga inicial

[idevicesManager.js:13-15](../../public/app/workarea/idevices/idevicesManager.js#L13-L15) → [idevicesList.js:19-29](../../public/app/workarea/idevices/idevicesList.js#L19-L29):

```js
async loadIdevicesInstalled() {
    let installedIdevicesJSON = await this.manager.app.api.getIdevicesInstalled();
    if (installedIdevicesJSON && installedIdevicesJSON.idevices) {
        installedIdevicesJSON.idevices.forEach((ideviceData) => {
            let idevice = new Idevice(this.manager, ideviceData);
            this.installed[ideviceData.name] = idevice;
        });
    }
}
```

`getIdevicesInstalled()` es transparente al modo: en `server` hace `GET /api/idevices/installed`; en `static`/Electron lee de `data/bundle.json` precargado (ver [04-modes.md](./04-modes.md)).

## La clase `Idevice`

[public/app/workarea/idevices/idevice.js](../../public/app/workarea/idevices/idevice.js).

### Construcción

```js
constructor(manager, data) {
    this.manager = manager;
    this.id = data.name;
    this.setConfigValues(data);
    this.path = `${manager.symfonyURL}${data.url}`;
    this.pathEdition = `${this.path}/edition/`;
    this.pathExport = `${this.path}/export/`;
    this.exportObject = null;
    if (this.exportJs.length > 0) {
        this.exportObject = this.getIdeviceObjectKey();
    }
}
```

`manager.symfonyURL` viene del config global de la app (es el `baseUrl` de la instalación, no relacionado con Symfony pese al nombre — es vestigio del eXeLearning legacy).

### `setConfigValues()`

[idevice.js:95-104](../../public/app/workarea/idevices/idevice.js#L95-L104). Itera el objeto recibido del backend (`ideviceData`), aplica defaults locales si el valor es falsy, y traduce `title` con `_(v, this.id)` si está en la lista `configParamsTranslatables` (sólo `title`).

### Carga dinámica de scripts y estilos

Los métodos `loadScriptsEdition()`, `loadScriptsExport()`, `loadStylesEdition()`, `loadStylesExport()` ([idevice.js:128-204](../../public/app/workarea/idevices/idevice.js#L128-L204)) iteran las arrays `editionJs/editionCss/exportJs/exportCss` y delegan en el motor:

- Scripts → `idevicesEngine.loadScriptDynamically(servicePath, false)` ([idevicesEngine.js](../../public/app/workarea/project/idevices/idevicesEngine.js)).
- Estilos → `idevicesEngine.loadStyleByInsertingIt(servicePath, this, status)` (donde `status` es `'edition'` o `'export'`).

### `getResourceServicePath()` — bifurcación static vs server

[idevice.js:211-239](../../public/app/workarea/idevices/idevice.js#L211-L239). Decide qué URL usar para el archivo:

```js
getResourceServicePath(path) {
    // Static mode: bundled iDevice files are served directly
    if (path.includes('/files/perm/idevices/')) {
        return path;
    }
    // Check if endpoint exists (may not exist in static mode)
    const endpoint = this.manager.app.api.endpoints.api_idevices_download_file_resources;
    if (!endpoint) {
        return path;  // Return as-is if no endpoint available
    }
    let pathServiceResources = endpoint.path;
    let pathSplit = path.split('/files/');
    let pathParam = pathSplit.length == 2 ? pathSplit[1] : path;
    return `${pathServiceResources}?resource=${pathParam}`;
}
```

Reglas:

- Si el path ya apunta a `/files/perm/idevices/` (caso static / Electron), se devuelve tal cual: el navegador hace fetch directo al archivo bundled.
- Si la ruta `download-file-resources` existe en el `endpoints` registry (modo server), se reescribe a `?resource=...`.
- Si no existe (static stub), devuelve el path tal cual como fallback.

## Inyección DOM

`idevicesEngine.js` (no incluido aquí por tamaño — ~3000 líneas) hace dos cosas relevantes para esta administración:

1. **Scripts:** crea `<script src="...">` dinámicamente en `<head>`, deduplicando por src para evitar reinyección entre proyectos.
2. **Estilos como `<style>` inline:** descarga el CSS vía `getText(servicePath)`, **reescribe** las URLs relativas (`url(./x.svg)`) para que apunten al directorio del iDevice (en server mode; en static no es necesario porque los paths ya son directos), y lo inyecta como `<style>`. Esto permite reescritura sin depender de `<link>` (que no permite manipular contenido).

> Verificar el rango exacto de líneas si se referencia desde otro doc — la última auditoría apunta a `loadScriptDynamically` y `loadStyleByInsertingIt` como las funciones clave.

## Menú lateral: `MenuIdevicesCompose`

[public/app/workarea/menus/idevices/menuIdevicesCompose.js](../../public/app/workarea/menus/idevices/menuIdevicesCompose.js).

### Composición

`compose()` ([línea 45-78](../../public/app/workarea/menus/idevices/menuIdevicesCompose.js#L45-L78)):

1. Limpia `#menu_idevices #list_menu_idevices`.
2. Construye `categoriesIdevices: { categoryEnglishName: [...idevices] }` recorriendo `idevicesList.installed`.
3. Itera `categoriesOrder` (5 categorías canónicas) más `categoriesExtra` (categorías encontradas pero no en la lista) y crea cada bloque.
4. Excluye visualmente el iDevice con id `'example'` ([línea 181](../../public/app/workarea/menus/idevices/menuIdevicesCompose.js#L181)).

Para "Information and presentation", reordena para poner `text` primero ([línea 107-115](../../public/app/workarea/menus/idevices/menuIdevicesCompose.js#L107-L115)).

### Categoría especial "Imported"

Cuando se renderiza la categoría `imported` ([línea 187-197](../../public/app/workarea/menus/idevices/menuIdevicesCompose.js#L187-L197)), en lugar de listar iDevices se construye:

- Un grid de iDevices importados (cada uno con menú dropdown "Export" / "Delete").
- Una caja drag-and-drop para subir un nuevo `.zip`.

### Subir / borrar / exportar (sólo para iDevices importados)

- **Subir:** [línea 283-301](../../public/app/workarea/menus/idevices/menuIdevicesCompose.js#L283-L301) — `uploadIdevice(fileName, fileData)` llama a `eXeLearning.app.api.postUploadIdevice(params)`. Ese endpoint **no está implementado** en `main` (ver [02-backend.md](./02-backend.md)).
- **Borrar:** [línea 303-331](../../public/app/workarea/menus/idevices/menuIdevicesCompose.js#L303-L331) — `removeIdevice(id)` llama a `deleteIdeviceInstalled`. Tampoco implementado.
- **Exportar como ZIP:** [línea 333-349](../../public/app/workarea/menus/idevices/menuIdevicesCompose.js#L333-L349) — `downloadIdeviceZip(idevice)` llama a `getIdeviceInstalledZip(odeSessionId, idevice.dirName)`. Tampoco implementado.

Resultado: en `main`, el botón existe pero la operación falla en backend. En modo static/Electron las rutas ni siquiera existen como mock.

## Modal "iDevice manager"

[public/app/workarea/modals/modals/pages/modalIdeviceManager.js](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js).

A pesar del nombre, en `main` este modal **no instala ni desinstala** iDevices. Su rol actual es **selección de favoritos** (máx 5) que aparecen en el menú inferior.

### Lo que hace realmente

1. **Lista iDevices** con un toggle por cada uno ([línea 502-588](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L502-L588)).
2. **Filtra por título** ([línea 292-325](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L292-L325)).
3. **Persiste el estado en IndexedDB** ([línea 441-482](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L441-L482)):
   - DB: `exelearning`, store: `idevicesSettings`, key: `eXeLearning.app.user.name`.
   - Valor: array con los `name` de los iDevices seleccionados.
4. **Limita a 5** favoritos ([línea 553-557](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L553-L557)) y muestra un alert si se excede.
5. **Re-renderiza el menú inferior** tras cambios ([línea 573-577](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L573-L577)).
6. **Excluye `example`** ([línea 428](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L428)).

### Estado heredado / desconectado

- El modal sigue teniendo `getBaseIdevices()` y `getUserIdevices()` ([línea 205-228](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L205-L228)) que filtran por `value.type === eXeLearning.config.ideviceTypeBase` / `ideviceTypeUser`. Pero **el backend no devuelve** un campo `type` en la respuesta de `/api/idevices/installed` (ver el interface [IdeviceConfig en idevices.ts:38-69](../../src/routes/idevices.ts#L38-L69)). Por lo tanto ambos diccionarios quedan vacíos y la pestaña de "user iDevices" no se renderiza nunca.
- Existe `uploadIdevice()` y `removeIdevice()` ([línea 668-738](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L668-L738)) que llaman a `postUploadIdevice` / `deleteIdeviceInstalled`, pero el botón "Import iDevice" del modal ([línea 378-406](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L378-L406)) sólo se muestra si `isOfflineInstallation === true || userIdevices === true`. Ver [04-modes.md](./04-modes.md) para qué significa.
- En la función `addNewReader()` (referenciada desde el `change` listener) **no está definida en este archivo** ([línea 357](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L357)) — aparentemente residual de un refactor: se hereda como `undefined` y reventaría si se invocara.

## Persistencia de visibilidad — IndexedDB

Resumen del esquema usado por el modal y el menú inferior:

| Storage | DB / Store / Key | Contenido |
|---|---|---|
| IndexedDB | `exelearning` / `idevicesSettings` / `${user.name}` | Array de `name`s de iDevices marcados como favoritos (máx 5) |
| IndexedDB | `exelearning` / `idevicesSettings` / `${user.name}` (mismo) | Lectura en `getUserListIdevices()` |
| Backend (sólo modo server) | `PUT /api/user/preferences` | `saveIdevicesVisibility()` envía además a [línea 184-185](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L184-L185) las claves `ideviceVisibilityPreferencePre + ideviceName` para sincronizar entre dispositivos |

Nota: la línea 147-149 del modal tiene `setConfirmExec(() => { /*this.saveIdevicesVisibility();*/ })` con la llamada **comentada**. Es decir, el botón "Confirmar" no graba nada (se graba al hacer toggle individual, dentro del `input.addEventListener('change', ...)`).

## API config / parámetros del cliente

[src/routes/config-params.ts](../../src/routes/config-params.ts) define `IDEVICE_INFO_FIELDS_CONFIG`, una lista de campos a mostrar en la información del iDevice (`title`, `description`, `version`, `author`, `authorUrl`, `license`, `licenseUrl`). Se sirve al cliente como `eXeLearning.app.api.parameters.ideviceInfoFieldsConfig` y se consume en [modalIdeviceManager.js:130-134](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L130-L134).

## Hallazgos

- **El modal está semidesmontado.** Mezcla código activo (toggle de visibilidad) con código heredado (`getBaseIdevices`/`getUserIdevices` por `type`, `addNewReader` no definida) que no tiene efecto porque el backend no provee `type`.
- **`saveIdevicesVisibility()` está comentado** en `setConfirmExec` ([línea 147-149](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L147-L149)). El comentario sugiere que la sincronización con `PUT /api/user/preferences` se desactivó en algún momento — pero se sigue llamando desde `uploadIdevice()` ([línea 695](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L695)) que tampoco se ejecuta porque el botón está oculto.
- **El menú lateral implementa toda la administración de iDevices "imported"** (subir, borrar, exportar) que el backend no soporta. Es código muerto end-to-end en `main`.
- **`category: 'Others'` (default cliente) vs `'Uncategorized'` (default backend)**: ver [01-anatomy.md](./01-anatomy.md). Una iDevice sin categoría caerá en `categoriesExtra` y se dibujará al final.
