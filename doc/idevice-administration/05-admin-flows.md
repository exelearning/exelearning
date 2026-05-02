# 05 — Flujos de administración

> Diagramas y descripción paso a paso de los seis flujos clave: listar, cargar para edición, cargar para exportación, importar ZIP, eliminar, gestionar visibilidad.

## 1. Listar iDevices instalados

```
┌──────────────────────────────────────────────────────────────────────┐
│ App boot                                                             │
└──────────────────────────────────────────────────────────────────────┘
   │
   │ app.idevices.loadIdevicesFromAPI()                idevicesManager.js:13
   ▼
   │ list.load() → list.loadIdevicesInstalled()        idevicesList.js:12,19
   ▼
   │ api.getIdevicesInstalled()                        apiCallManager.js
   ▼
 ┌──────────────────────────────┐
 │ ¿Modo?                       │
 └──────────────────────────────┘
   │ server                                  │ static/electron
   ▼                                          ▼
 GET /api/idevices/installed             StaticDataProvider.idevices
 (idevices.ts:252)                       (cargado de data/bundle.json)
   │                                          │
   ▼                                          │
 scanIdevices(base) + scanIdevices(users)     │
 merge users>base                              │
 sort category, title                          │
   │                                          │
   ▼                                          ▼
 { idevices: [...] }                          { idevices: [...] }
   │                                          │
   └──────────────────┬───────────────────────┘
                      ▼
 Para cada item: new Idevice(manager, data)   idevicesList.js:24-26
 Almacenado en list.installed[name]
                      │
                      ▼
 menuIdevices.compose() agrupa por categoría  menuIdevicesCompose.js:45
 menuIdevicesBottom dibuja favoritos (max 5)  modalIdeviceManager (visibilidad)
```

**Identificación del modo:** `getIdevicesInstalled()` de `apiCallManager` no toma decisiones; delega en el adaptador inyectado al construirse (`StaticDataProvider` vs `ServerDataProvider`).

## 2. Cargar un iDevice para edición

Cuando el usuario hace click/drag de un iDevice del menú al canvas, se llama a `loadScriptsEdition()` y `loadStylesEdition()` de la instancia [Idevice](../../public/app/workarea/idevices/idevice.js).

```
loadScriptsEdition()                                  idevice.js:128
  │
  │ for each editionJs[i]:
  │   path = pathEdition + script
  │   = `${symfonyURL}${data.url}/edition/${script}`
  │   p.ej. `/v4.0.0-rc4/files/perm/idevices/base/text/edition/text.js`
  ▼
servicePath = getResourceServicePath(path)            idevice.js:211
  │
  ▼
┌─────────────────────────────────────────────┐
│ ¿path contiene '/files/perm/idevices/'?    │
└─────────────────────────────────────────────┘
   │ sí (static/electron)              │ no
   ▼                                   ▼
   Devuelve path tal cual          ¿Existe endpoint
   (fetch directo de FS)           api_idevices_download_file_resources?
                                       │ sí                  │ no
                                       ▼                     ▼
                                 Reescribe a            Devuelve path
                                 ?resource=...          tal cual
   │
   ▼
 idevicesEngine.loadScriptDynamically(servicePath)
   │
   ▼
   Crea <script src="..."> en <head>
   Dedup: si ya existe, se omite
   onload/onerror loggea
```

CSS sigue el mismo árbol pero termina en `loadStyleByInsertingIt()`, que **no usa `<link>`**. En su lugar:

1. Hace `fetch` del CSS.
2. Reescribe `url(./x.svg)` → `url(${idevicePath}/x.svg)` para que las imágenes relativas sigan resolviéndose.
3. Inyecta el resultado como `<style>...</style>` en `<head>`.

En modo server, **además** el backend ya hace su propia reescritura de URLs (`rewriteCSSUrls` en [idevices.ts:585-608](../../src/routes/idevices.ts#L585-L608)). Hay redundancia entre las dos pasadas, pero la del cliente cubre el caso static donde el backend no interviene.

## 3. Cargar un iDevice para exportación (SCORM/HTML5/IMS/EPUB)

Este flujo es **server-side** cuando se invoca por API o CLI; **client-side** cuando se exporta desde la UI (web/electron).

### Server-side (CLI o `POST /api/export/.../download`)

```
ExportRunner (escogido por formato)
   │
   ▼
PageRenderer.render(page)                src/shared/export/renderers/PageRenderer.ts
   │
   │ usedIdevices = recolectados del Y.Doc
   ▼
ideviceRenderer.getJsScripts(usedIdevices, basePath)   IdeviceRenderer.ts (~520+)
ideviceRenderer.getCssLinks(usedIdevices, basePath)
   │
   │ para cada type ∈ usedIdevices:
   │   files = getIdeviceExportFiles(type, '.js'|'.css')   idevice-config.ts:193
   │   ─ escanea ${type}/export/
   │   ─ archivo principal primero, alfabético después
   │   ─ excluye .test.js / .spec.js
   ▼
<link rel="stylesheet" href="${basePath}/idevices/${type}/${file}">
<script src="${basePath}/idevices/${type}/${file}"></script>
   │
   ▼
Insertados en <head> del HTML exportado
```

### Client-side (UI web/electron)

Mismo flujo conceptual pero en JS: el bundle `exporters.bundle.js` contiene el equivalente cliente del `IdeviceRenderer`. Lee el catálogo de iDevices ya cargado en memoria (no escanea FS) y construye el HTML con JSZip.

## 4. Importar un iDevice como ZIP — ❌ Roto end-to-end

Existen dos invocaciones al mismo wrapper en cliente:

- Botón "Import iDevice" del modal ([modalIdeviceManager.js:378](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L378)).
- Caja drag-and-drop del menú lateral en categoría "Imported" ([menuIdevicesCompose.js:201-249](../../public/app/workarea/menus/idevices/menuIdevicesCompose.js#L201-L249)).

```
Usuario suelta archivo .zip
   │
   ▼ FileReader.readAsDataURL(file)
   │
   ▼ uploadIdevice(filename, base64DataURL)              menuIdevicesCompose.js:283
   │                                                      modalIdeviceManager.js:668
   │ params = { filename, file: base64DataURL }
   ▼ api.postUploadIdevice(params)                       apiCallManager.js:715
   │
   ▼ POST /api/idevices/install  (api_idevices_upload en api-routes.ts)
   │
   ✗ No hay handler en idevices.ts → Elysia devuelve 404
   │
   ▼ El cliente espera response.responseMessage === 'OK'
   │
   ▼ Recibe error / 404
   │
   ▼ showElementAlert(_('Failed to install the new iDevice'), response)
```

**Estado en `main`:** la cadena cliente está completa, el backend no.

## 5. Eliminar un iDevice — ❌ Roto end-to-end

```
Usuario click "Delete" en dropdown
   │
   ▼ confirm modal → confirmExec()                       menuIdevicesCompose.js:550-563
   │
   ▼ removeIdevice(id)                                   menuIdevicesCompose.js:303
   │                                                      modalIdeviceManager.js:711
   │
   ▼ api.deleteIdeviceInstalled({ id })                  apiCallManager.js:726
   │
   ▼ DELETE /api/idevices/{id}/delete  (declarado, sin handler)
   │
   ✗ 404
   │
   ▼ showElementAlert(_('Could not remove the iDevice'), response)
```

## 6. Exportar un iDevice como ZIP — ❌ Roto end-to-end

Sólo invocado desde el menú lateral, en el dropdown del iDevice "imported":

```
Usuario click "Export" en dropdown
   │
   ▼ downloadIdeviceZip(idevice)                         menuIdevicesCompose.js:333
   │
   ▼ api.getIdeviceInstalledZip(odeSession, idevice.dirName)   apiCallManager.js:738
   │
   ▼ GET /api/idevices/{ideviceDirName}/download  (declarado, sin handler)
   │
   ✗ 404
```

## 7. Visibilidad / favoritos (sí funciona)

Único flujo administrativo plenamente funcional en `main`. Persiste **localmente en IndexedDB** y, en modo server, **además** sincroniza con `PUT /api/user/preferences`.

```
Modal "iDevice manager" → toggle individual
   │
   ▼ input.addEventListener('change', ...)            modalIdeviceManager.js:550
   │
   │ countChecked() ≤ 5 ?                              ─ si > 5: deshace y alerta
   ▼
   getUserListIdevices()                              modalIdeviceManager.js:441
   │
   ▼ IndexedDB.exelearning.idevicesSettings.get(user.name)
   │
   ▼ idevicesArray.push/splice(idevice.name)
   ▼ saveIdevices(idevicesArray)                      modalIdeviceManager.js:475
   │
   ▼ IndexedDB.exelearning.idevicesSettings.put({ id: user.name, value: array })
   ▼
   menuIdevicesBottom.init()  ─ redibuja favoritos en bottom bar
```

La sincronización servidor-side (`saveIdevicesVisibility()` en [línea 168](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L168)) está **desconectada del flujo principal** — no se llama desde el toggle individual, sólo desde `uploadIdevice()` (que no se ejecuta) y desde `setConfirmExec(...)` que tiene la llamada **comentada** ([línea 147-149](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L147-L149)).

Por tanto en `main` la visibilidad de favoritos **es sólo local al navegador**, aunque el código para sincronizar exista.

## Resumen de estado de los flujos

| Flujo | Cliente | Backend | Funciona end-to-end |
|---|---|---|---|
| Listar iDevices | ✅ | ✅ | ✅ |
| Cargar para edición | ✅ | ✅ | ✅ |
| Cargar para export server-side | ✅ | ✅ | ✅ |
| Subir recurso de iDevice (imagen/audio) | ✅ | ✅ (`upload/file/resources`) | ✅ |
| Importar iDevice ZIP | ✅ | ❌ | ❌ |
| Eliminar iDevice | ✅ | ❌ | ❌ |
| Exportar iDevice como ZIP | ✅ | ❌ | ❌ |
| Visibilidad de favoritos (local) | ✅ | n/a | ✅ (IndexedDB) |
| Visibilidad de favoritos (sincronizada) | ⚠️ código presente, no enganchado | ✅ (`PUT /api/user/preferences`) | ❌ |
