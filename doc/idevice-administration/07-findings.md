# 07 — Hallazgos y oportunidades

> Lista accionable de cosas detectadas durante el estudio. Cada entrada incluye qué pasa, por qué importa y, donde aplica, una sugerencia de cómo abordarlo.
>
> El alcance del estudio es **descriptivo + diagnóstico**. Las "oportunidades" que siguen son sugerencias para discutir, no decisiones tomadas.

## H1 · Endpoint legacy de instalación de iDevices

**Qué.** El estudio original detectaba estos endpoints declarados para administrar iDevices:

- `POST /api/idevices/upload`
- `DELETE /api/idevices/{ideviceId}/delete`
- `GET /api/idevices/{ideviceId}/download`

En la rama actual, `POST /api/idevices/upload` ya no es la ruta que debe usarse. La instalación de iDevices de usuario se hace con `POST /api/idevices/install` mediante `api_idevices_upload`, y la administración global usa su propio endpoint `POST /api/admin/idevices/upload` desde [views/admin/index.njk](../../views/admin/index.njk). Por tanto, el panel admin no debe llamar a `POST /api/idevices/upload`.

**Impacto.** Mantener referencias a `POST /api/idevices/upload` induce a conectar el panel admin con una ruta legacy/inexistente. La separación correcta es:

- `POST /api/admin/idevices/upload` → instala iDevices administrados en `site/`.
- `POST /api/idevices/install` → instala iDevices de usuario en `users/{userId}/`.

**Sugerencias.** No reintroducir ni usar `POST /api/idevices/upload`. Si aparece en documentación o tests nuevos, reemplazarlo por el endpoint específico del flujo: admin (`/api/admin/idevices/upload`) o usuario (`/api/idevices/install`).

## H2 · `users/` está vacío, sin entrada de UI funcional

**Qué.** [public/files/perm/idevices/users/](../../public/files/perm/idevices/users/) sólo contiene una carpeta `94/` vacía. El backend la escanea y mergea sobre `base/` ([idevices.ts:255](../../src/routes/idevices.ts#L255)) pero nadie escribe ahí — porque el flujo actual de instalación de usuario debe pasar por `POST /api/idevices/install`, no por el endpoint legacy `POST /api/idevices/upload` (ver H1).

**Impacto.** El soporte para iDevices personalizados existe en filesystem y backend de listado, pero está aislado.

**Sugerencias.** Si se va a completar H1, mantener `users/` y documentar el formato de un iDevice "user" (nombre de la subcarpeta, segregación por usuario, etc.). Si se descarta, eliminar la rama `IDEVICES_USERS_PATH` del listado para simplificar.

## H3 · `userIdevices: 0` hardcoded en backend

**Qué.** [pages.ts:930](../../src/routes/pages.ts#L930) inyecta `userIdevices: 0` sin lectura de setting ni env var. Comparar con `userStyles` ([línea 929](../../src/routes/pages.ts#L929)) que sí toma valor de `ONLINE_THEMES_INSTALL`.

**Impacto.** Hace imposible activar la categoría "Imported" del menú o el botón "Import iDevice" del modal sólo con configuración. Hay que tocar código.

**Sugerencias.** Convertir en setting (`ONLINE_IDEVICES_INSTALL`) similar a `ONLINE_THEMES_INSTALL`, por consistencia.

## H4 · Lógica del botón "Import iDevice" depende de un AND invertido

**Qué.** [modalIdeviceManager.js:378-383](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L378-L383):

```js
if (eXeLearning.config.isOfflineInstallation == false &&
    eXeLearning.config.userIdevices == false)
    return false;  // oculta el botón
```

Combinado con `userIdevices: 0` (H3), la única vía de activar el botón es poner el deployment en `APP_ONLINE_MODE=0` o `APP_AUTH_METHODS` con `none`. Ambas condiciones cambian otras muchas cosas además del botón.

**Impacto.** Acopla la visibilidad de una feature (administración de iDevices) con una preferencia operativa (modo offline). Difícil de razonar.

**Sugerencias.** Separar la decisión: si se completa H1+H3, el botón se controla solo por `userIdevices` y `isOfflineInstallation` deja de tener este efecto colateral.

## H5 · No hay XSD/JSON-Schema para `config.xml`

**Qué.** Cada iDevice valida su contrato implícitamente: si un campo falta, [parseIdeviceConfig](../../src/routes/idevices.ts#L90-L216) aplica defaults; si un archivo declarado no existe, se filtra silenciosamente. Errores de tipeo (`<categgory>`) se ignoran.

**Impacto.** Riesgo bajo en la práctica (43 iDevices conocidos, todos generados internamente). Riesgo crece cuando se quiera permitir iDevices de terceros (H1 + H2).

**Sugerencias.** Si se mantiene la administración por usuario, añadir un schema XSD o JSON Schema y validar en el upload. Mantener los defaults como fallback de runtime, pero rechazar uploads inválidos al menos con un error legible.

## H6 · Doble parser de `config.xml` en backend

**Qué.** Hay dos parsers independientes:

- [src/routes/idevices.ts:90-216](../../src/routes/idevices.ts#L90-L216) — regex puro, usado por las rutas API.
- [src/services/idevice-config.ts:48-97](../../src/services/idevice-config.ts#L48-L97) — `fast-xml-parser`, usado por exporters.

Adicionalmente, [scripts/build-static-bundle.ts](../../scripts/build-static-bundle.ts) tiene **otro parser** (similar al de `idevices.ts`) para construir el bundle estático.

**Impacto.** Tres lecturas distintas del mismo formato → posibilidad de divergencia (ya hay alguna: defaults distintos para `category`, ver [01-anatomy.md](./01-anatomy.md)).

**Sugerencias.** Unificar en un solo parser exportable desde `src/services/idevice-config.ts` o `src/shared/parsers/idevice-parser.ts`, y usarlo desde las tres ubicaciones.

## H7 · Defaults divergentes entre cliente y backend

**Qué.** Para `category`:

- Backend devuelve `'Uncategorized'` cuando falta ([idevices.ts:189](../../src/routes/idevices.ts#L189)).
- Cliente pone `'Others'` cuando falta ([idevice.js:63](../../public/app/workarea/idevices/idevice.js#L63)).

Como el backend siempre devuelve algo, el default de cliente nunca se aplica. Pero ambos quedan como categorías "extra" no agrupadas con las 5 canónicas.

**Impacto.** Cosmético. Una iDevice con categoría faltante se dibuja al final del menú con icono genérico.

**Sugerencias.** Decidir un único default y usar el mismo nombre en ambos sitios.

## H8 · `addNewReader` referenciada pero no definida en `modalIdeviceManager.js`

**Qué.** [modalIdeviceManager.js:357](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L357) llama a `this.addNewReader(idevice)` desde el `change` listener del input file. Esa función **no está definida** en la clase ([revisado el archivo completo](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js)). Sí está en `menuIdevicesCompose.js`.

**Impacto.** Si el botón llegara a ejecutarse (H3+H4), el `change` lanzaría un `TypeError`. En la práctica está enmascarado porque el botón está casi siempre oculto.

**Sugerencias.** Si se decide mantener el modal como entrada de upload, restaurar `addNewReader` y `uploadIdevice` con el mismo patrón que `menuIdevicesCompose.js`. Si no, eliminar el `<input type="file">` y `makeElementButtonImportIdevice()` para no dejar trampas.

## H9 · `setConfirmExec` con la sincronización comentada

**Qué.** [modalIdeviceManager.js:147-149](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L147-L149):

```js
this.setConfirmExec(() => {
    //this.saveIdevicesVisibility();
});
```

El botón "Confirmar" del modal no graba nada en servidor; la persistencia local ocurre en el toggle individual ([línea 573-577](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L573-L577)) sin pasar por servidor.

**Impacto.** La preferencia de favoritos se guarda en IndexedDB pero **no se sincroniza entre dispositivos** aunque el endpoint server-side existe (`PUT /api/user/preferences`).

**Sugerencias.** Decidir explícitamente: o sincronizar (descomentar y probar) o documentar que la visibilidad es siempre local.

## H10 · `getBaseIdevices` / `getUserIdevices` se quedaron sin entrada

**Qué.** [modalIdeviceManager.js:205-228](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L205-L228) filtra por `value.type === eXeLearning.config.ideviceTypeBase` y `ideviceTypeUser`. El backend **no devuelve** un campo `type` en la respuesta de `/api/idevices/installed` ([idevices.ts:38-69](../../src/routes/idevices.ts#L38-L69)), así que ambos diccionarios siempre están vacíos.

**Impacto.** Las pestañas del modal "Default iDevices" y "User iDevices" están descartadas: en su lugar se renderiza una tabla única sin distinción ([línea 282-287](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L282-L287)). El código de pestañas sobrevive como código muerto.

**Sugerencias.** Eliminar `getBaseIdevices`/`getUserIdevices` y el código de `tabSelectedLink`/`addBehaviourExeTabs` si no se va a reactivar. Si se reactiva, el backend debe añadir `type: 'base' | 'user'` a la respuesta (es deducible del path: `users/` vs `base/`).

## H11 · No hay autenticación/autorización en los handlers de iDevices

**Qué.** [idevices.ts](../../src/routes/idevices.ts) no aplica middleware de auth en ningún handler. Las únicas mitigaciones son anti-traversal y sandboxing del directorio de subida.

**Impacto.** En modo server con auth, si la composición de Elysia no cubre estas rutas con middleware global, podrían ser accesibles sin sesión. **No verificado** — depende de cómo `src/index.ts` registra los plugins.

**Sugerencias.** Verificar que el middleware global cubre `/api/idevices/*` y, si no, añadir un guard explícito.

## H12 · Categorías hardcoded en frontend

**Qué.** [menuIdevicesCompose.js:24-31](../../public/app/workarea/menus/idevices/menuIdevicesCompose.js#L24-L31) tiene las 5 categorías codificadas. Si un iDevice declara una categoría nueva, cae en `categoriesExtra` con icono genérico.

**Impacto.** Barrera implícita a "tipos" nuevos de iDevice.

**Sugerencias.** Si la lista no va a crecer (probable: son categorías pedagógicas estables), documentar que estas son las únicas y que un iDevice **debe** usar uno de esos cinco strings exactos. Si se prevé crecimiento, externalizar a config (server o bundle).

## H13 · Errata "Sciencie" en descripción de categoría

**Qué.** [menuIdevicesCompose.js:162](../../public/app/workarea/menus/idevices/menuIdevicesCompose.js#L162) escribe `_('Sciencie')` (sic). Llega como string a las traducciones.

**Impacto.** Bajo. Cadena visible en UI con typo.

**Sugerencias.** Corregir a `_('Science')` y revisar `translations/messages.*.xlf` por si la cadena con typo está traducida y conviene migrarla.

## H14 · Tests cliente con backend mockeado

**Qué.** Los tests de `modalIdeviceManager.test.js`, `menuIdevicesCompose.test.js` y `apiCallManager.test.js` mockean `postUploadIdevice`/`deleteIdeviceInstalled`/`getIdeviceInstalledZip`. El "happy path" verde no implica que la cadena funcione.

**Impacto.** Se puede romper o no implementar handlers backend sin que CI lo detecte.

**Sugerencias.** Añadir un test E2E (Playwright) que ejecute el flujo de import→use→delete con un `.zip` de fixture. Sólo ese test fallaría hoy y haría visible el problema.

## H15 · iDevice `example` se sirve por API pero se filtra en cliente

**Qué.** El iDevice `example` aparece en `GET /api/idevices/installed` pero se omite en el menú lateral ([menuIdevicesCompose.js:181](../../public/app/workarea/menus/idevices/menuIdevicesCompose.js#L181)) y en el modal ([modalIdeviceManager.js:428](../../public/app/workarea/modals/modals/pages/modalIdeviceManager.js#L428)).

**Impacto.** Bajo. Es claramente un iDevice de plantilla/ejemplo, pero la decisión de ocultarlo está dispersa por la UI.

**Sugerencias.** Mover el filtro al backend (`scanIdevices` salta los ids "ejemplo") o hacerlo explícito con un tag en su `config.xml` (`<hidden>1</hidden>`) y filtrar centralizadamente por ese flag.
