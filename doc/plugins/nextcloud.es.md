# eXeLearning en Nextcloud

[Read in English](nextcloud.md){ .lang-switch }

<!-- --8<-- [start:guide] -->

La app **eXeLearning** para Nextcloud permite **ver, editar y crear** recursos de eXeLearning
(`.elpx`) directamente desde **Archivos**, sin descargarlos. Es útil para que el profesorado guarde y
comparta sus materiales en la nube del centro.

!!! tip "Pruébalo antes de instalar"
    [Abre la demostración en Nextcloud Playground](https://ateeducacion.github.io/nextcloud-playground/?blueprint-url=https://raw.githubusercontent.com/exelearning/nextcloud-exelearning/main/blueprint.json)
    (usuario `admin`, contraseña `admin`). Trae dos recursos de ejemplo en la carpeta
    `exelearning-samples`.

## Requisitos

- Nextcloud 31, 32 o 33. Con la versión 4.0.5 del plugin, solo Nextcloud 33.
- Un navegador actual (la vista previa usa *Service Workers*).

## Instalación

Necesitas acceso de **administración** al servidor de Nextcloud.

1. Descarga `exelearning-X.Y.Z.tar.gz` de la
   [última versión](https://github.com/exelearning/nextcloud-exelearning/releases/latest). El archivo
   ya incluye el editor.
2. Descomprímelo en la carpeta `custom_apps/` (o `apps/`) de Nextcloud. Debe quedar una carpeta
   llamada `exelearning`.
3. Entra en **Aplicaciones → Apps deshabilitadas**, elige **eXeLearning** y pulsa **Activar** (te
   pedirá tu contraseña). Por consola: `occ app:enable exelearning`.

![La app eXeLearning en la página de Aplicaciones](img/nextcloud/apps-enabled.png)

!!! note "Recomendado: reconocer los archivos `.elpx`"
    Para que Nextcloud muestre bien el icono y el tipo de los archivos `.elpx` y `.elp`, crea
    `config/mimetypemapping.json` con este contenido:

    ```json
    {
      "elpx": ["application/vnd.exelearning.elpx", "application/zip"],
      "elp": ["application/vnd.exelearning.elpx", "application/zip"]
    }
    ```

    y ejecuta `occ maintenance:mimetype:update-js` y
    `occ maintenance:mimetype:update-db --repair-filecache`.

La app no tiene opciones de configuración.

## Uso

### Crear un recurso nuevo

En **Archivos**, pulsa **Nuevo → New eXeLearning resource**. Se crea el archivo y se abre en el
editor.

![Menú Nuevo con la opción New eXeLearning resource](img/nextcloud/files-new-menu.png)

### Ver un recurso

Sube el `.elpx` como cualquier otro archivo y haz clic en él. Se abre la vista previa con el
contenido navegable.

![Una carpeta con un recurso de eXeLearning](img/nextcloud/files-list.png)

![Vista previa del recurso con el botón Edit](img/nextcloud/preview.png)

### Editar un recurso

Desde la vista previa pulsa **Edit**, o abre el menú **…** del archivo y elige **Edit with
eXeLearning**.

![Menú de acciones del archivo](img/nextcloud/file-actions.png)

En el editor, pulsa **Save** para guardar los cambios en Nextcloud.

![El editor de eXeLearning dentro de Nextcloud](img/nextcloud/editor.png)

!!! info "Archivos `.elp` antiguos"
    Se abren en el editor con **Open in eXeLearning editor** y se guardan como `.elpx`.

### Compartir

Comparte el recurso con el sistema habitual de Nextcloud (con usuarios, grupos o un enlace público).

!!! note "Idioma"
    Los textos propios de la app (**New eXeLearning resource**, **Edit with eXeLearning**, **Save**…)
    todavía están solo en inglés. El resto de Nextcloud y el editor se muestran en tu idioma.

<!-- --8<-- [end:guide] -->
