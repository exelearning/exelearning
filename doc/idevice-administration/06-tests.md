# 06 — Cobertura de tests

> Qué se está testando hoy y qué falta. Lista útil cuando se planee añadir cobertura.

## Tests backend (Bun)

| Archivo | Cubre | Notas |
|---|---|---|
| [src/routes/idevices.spec.ts](../../src/routes/idevices.spec.ts) | `GET /api/idevices/installed`, `GET /api/idevices/installed/:id`, `GET /api/idevices/download-file-resources` | Verifica forma de respuesta, ordenamiento, prevención de path traversal, 404 |
| [src/services/idevice-config.spec.ts](../../src/services/idevice-config.spec.ts) | `loadIdeviceConfigs`, `getIdeviceConfig`, `getIdeviceExportFiles`, `IDEVICE_TYPE_ALIASES` | Cache, normalización de aliases, fallback a defaults |
| [src/routes/pages.spec.ts](../../src/routes/pages.spec.ts) | `isOfflineInstallation` con auth `none` y env `APP_ONLINE_MODE` | Cubre la generación del flag pero no su efecto en UI |

**No cubierto:**

- El endpoint legacy `POST /api/idevices/upload` no debe usarse. La cobertura debe apuntar al endpoint actual `POST /api/idevices/install` y a los endpoints de borrado/descarga implementados.
- `POST /api/idevices/upload/file/resources` y la versión `large/` no tienen tests específicos (la lógica de saneamiento de filename, fallback a `uploads`, generación de thumbnail copiando, etc. está sin asertar).

## Tests frontend (Vitest)

| Archivo | Cubre |
|---|---|
| [public/app/workarea/idevices/idevice.test.js](../../public/app/workarea/idevices/idevice.test.js) | Construcción de `Idevice`, defaults, traducción de `title`, `getIdeviceObjectKey`, `getResourceServicePath` |
| [public/app/workarea/idevices/idevicesList.test.js](../../public/app/workarea/idevices/idevicesList.test.js) | Carga inicial, dict `installed`, `loadIdevice`/`removeIdevice` |
| [public/app/workarea/idevices/idevicesManager.test.js](../../public/app/workarea/idevices/idevicesManager.test.js) | Manager raíz: `getIdeviceActive`, `setIdeviceActive`, `getIdeviceById` |
| [public/app/workarea/menus/idevices/menuIdevices.test.js](../../public/app/workarea/menus/idevices/menuIdevices.test.js) | Coordinación compose+behaviour |
| [public/app/workarea/menus/idevices/menuIdevicesCompose.test.js](../../public/app/workarea/menus/idevices/menuIdevicesCompose.test.js) | Composición DOM, agrupación por categoría, mock de `postUploadIdevice`/`deleteIdeviceInstalled`/`getIdeviceInstalledZip` (líneas 13-15, 114-116, 630-797) |
| [public/app/workarea/menus/idevices/menuIdevicesBehaviour.test.js](../../public/app/workarea/menus/idevices/menuIdevicesBehaviour.test.js) | Listeners drag/click |
| [public/app/workarea/menus/idevices/menuIdevicesBottom.test.js](../../public/app/workarea/menus/idevices/menuIdevicesBottom.test.js) | Barra inferior con favoritos |
| [public/app/workarea/modals/modals/pages/modalIdeviceManager.test.js](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.test.js) | Modal: rendering, toggle de visibilidad, IndexedDB, llamadas a `postUploadIdevice`/`deleteIdeviceInstalled` (líneas 1188-1278) |
| [public/app/rest/apiCallManager.test.js](../../public/app/rest/apiCallManager.test.js) | `postUploadIdevice`, `deleteIdeviceInstalled`, `getIdeviceInstalledZip` (líneas 286, 1410-1411) |

**Importante:** los tests frontend de upload/delete/download **mockean los métodos de `apiCallManager`**, así que pasan aunque el backend no implemente los endpoints. Es decir, los tests no detectarían que la cadena está rota end-to-end.

## Tests E2E (Playwright)

15 specs en [test/e2e/playwright/specs/idevices/](../../test/e2e/playwright/specs/idevices/):

```
text.spec.ts                    az-quiz-game.spec.ts
text-advanced.spec.ts           beforeafter.spec.ts
text-multi-image.spec.ts        digcompedu.spec.ts
form.spec.ts                    download-source-file.spec.ts
relate.spec.ts                  external-website.spec.ts
rubric.spec.ts                  image-gallery.spec.ts
udl-content.spec.ts             interactive-video.spec.ts
                                magnifier.spec.ts
```

Todos validan el **uso** de un iDevice (añadir al canvas, editar, guardar, previsualizar). Ninguno cubre flujos de administración:

- ❌ Importar iDevice como ZIP
- ❌ Eliminar iDevice "imported"
- ❌ Exportar iDevice como ZIP
- ❌ Modal "iDevice manager" (visibilidad, límite de 5 favoritos)
- ❌ Refresco del menú inferior tras toggle
- ❌ Persistencia entre recargas de la visibilidad

## Hallazgos

- **Tests cliente verdes ≠ feature funcional.** Los `apiCallManager` están mockeados en los tests del modal y del menú, así que el "happy path" pasa aunque el backend no exista. Pasar tests no implica que importar/borrar/exportar iDevices funcione realmente.
- **No hay test de integración** que arranque el backend, llame a `POST /api/idevices/install` con un `.zip` real y compruebe la creación en `users/{userId}/`. Es el test que confirmaría que la instalación de usuario acaba en disco.
- **`example` se filtra en tests también?** Conviene verificar si los tests E2E asumen su presencia (el iDevice está oculto en UI pero la API lo devuelve).
- **Si se decide implementar los endpoints faltantes**, el orden razonable de tests sería:
  1. Backend: spec de `POST /api/idevices/install` con ZIP de fixture, asertando estructura escrita en `users/{userId}/`.
  2. Backend: spec de `DELETE` y `GET /download` en orden, validando que después del delete el `GET /installed` ya no incluye el iDevice.
  3. E2E: un test que importe un ZIP de fixture, verifique que aparece en categoría "Imported" del menú lateral, lo use en el canvas, lo elimine, y compruebe que desaparece.
