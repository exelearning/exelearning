# eXeLearning en Omeka S

[Read in English](omeka-s.md){ .lang-switch }

<!-- --8<-- [start:intro] -->

El módulo **ExeLearning** para Omeka S permite añadir recursos de eXeLearning (`.elpx`) como
**medios** de las fichas (ítems), **verlos** integrados en la página y **editarlos** con el editor de
eXeLearning. Es útil para repositorios y colecciones de recursos educativos.

!!! tip "Pruébalo antes de instalar"
    [Abre la demostración en Omeka S Playground](https://ateeducacion.github.io/omeka-s-playground/?blueprint=https%3A%2F%2Fraw.githubusercontent.com%2Fexelearning%2Fomeka-s-exelearning%2Frefs%2Fheads%2Fmain%2Fblueprint.json)
    (usuario `admin@example.com`, contraseña `password`). Incluye una ficha de ejemplo y un sitio
    público en `/s/demo`.

<!-- --8<-- [end:intro] -->

<!-- --8<-- [start:admin] -->

## Para administración { #administracion }

La administración instala el módulo una sola vez en el servidor de Omeka S y queda disponible en
todos los sitios de esa instalación; el profesorado no instala nada. Si tus centros comparten un
mismo Omeka S, basta con instalarlo allí una vez.

### Requisitos

- Omeka S 4.0 o posterior.
- PHP 7.4 o posterior con la extensión ZIP.
- En servidores **nginx**, las reglas adicionales que indica el
  [README del módulo](https://github.com/exelearning/omeka-s-exelearning#readme). Con Apache no hace
  falta nada.

### Instalación

1. Descarga `ExeLearning-X.Y.Z.zip` de la
   [última versión](https://github.com/exelearning/omeka-s-exelearning/releases/latest).
2. Descomprímelo en la carpeta `modules/` de Omeka S. Debe quedar `modules/ExeLearning`.
3. En la administración, entra en **Módulos** y pulsa **Instalar** junto a ExeLearning.

![Instalar el módulo ExeLearning](img/omeka-s/modules-install.png)

### Configuración

Pulsa **Configurar** junto al módulo para ajustar la **Altura del visor (px)** y los **Formatos de
descarga** que se ofrecen (`.elpx`, web, SCORM 1.2, IMS, EPUB3). Pulsa **Enviar** para guardar.

![Configuración del módulo](img/omeka-s/module-config.png)

Con **Abrir página de estilos** puedes subir y activar estilos propios.

<!-- --8<-- [end:admin] -->

<!-- --8<-- [start:teacher] -->

## Para el profesorado { #profesorado }

### Añadir un recurso a un ítem

Crea o edita una ficha (**Fichas**), ve a la pestaña **Medios**, elige **Subir** y selecciona el
`.elpx`. Guarda la ficha.

![Subir un recurso como medio del ítem](img/omeka-s/item-add-media.png)

### Verlo y editarlo

Abre el medio: verás la **Vista previa de eXeLearning** con los botones **Abrir en nueva pestaña** y
**Descargar .elpx**. Pulsa **Editar en eXeLearning** para modificarlo.

![El visor de eXeLearning en Omeka S](img/omeka-s/media-viewer.png)

Al terminar, pulsa **Guardar en Omeka**.

![El editor de eXeLearning dentro de Omeka S](img/omeka-s/editor.png)

### En el sitio público

El recurso aparece automáticamente en la página de la ficha del sitio público, con los botones
**Abrir a pantalla completa** y **Descargar .elpx**.

![El recurso en la página pública del ítem](img/omeka-s/public-item.png)

!!! info "¿Quién puede editar?"
    La persona propietaria del medio y los roles de Omeka S que pueden modificar cualquier recurso
    (administración, edición). La administración decide quién tiene esos roles. Los visitantes solo
    ven el contenido.

<!-- --8<-- [end:teacher] -->
