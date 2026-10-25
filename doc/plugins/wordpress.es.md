# eXeLearning en WordPress

[Read in English](wordpress.md){ .lang-switch }

<!-- --8<-- [start:intro] -->

El plugin **eXeLearning** para WordPress permite subir recursos (`.elpx`) a la **biblioteca de
medios**, **editarlos** con el editor integrado y **publicarlos** en entradas y páginas con un bloque o
un código corto. Es ideal para el blog o la web del centro.

!!! tip "Pruébalo antes de instalar"
    [Abre la demostración en WordPress Playground](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/exelearning/wp-exelearning/refs/heads/main/blueprint.json).
    Se abre en castellano, con la sesión iniciada y dos recursos de ejemplo en Medios.

<!-- --8<-- [end:intro] -->

<!-- --8<-- [start:admin] -->

## Para administración { #administracion }

La administración instala el plugin una sola vez en el sitio de WordPress y lo pueden usar todas
las personas que publican; el profesorado no instala nada. En un WordPress multisitio compartido por
varios centros, basta con instalarlo una vez para toda la red.

### Requisitos

- WordPress 6.1 o posterior.
- PHP 8.0 o posterior.
- Un límite de subida suficiente para el plugin (unos 30 MB) y para tus recursos.

### Instalación

1. Descarga `exelearning-X.Y.Z.zip` de la
   [última versión](https://github.com/exelearning/wp-exelearning/releases/latest).
2. Ve a **Plugins → Añadir plugin → Subir plugin**, elige el ZIP con **Seleccionar archivo** y pulsa
   **Instalar ahora**.

    ![Subir el plugin de eXeLearning](img/wordpress/install-upload.png)

3. Pulsa **Activar plugin**.

    ![Activar el plugin](img/wordpress/install-activate.png)

### Configuración

No hace falta configurar nada. En **Ajustes → eXeLearning** puedes revisar el estado del editor,
gestionar los estilos y ver ejemplos del código corto.

![Ajustes de eXeLearning](img/wordpress/settings.png)

<!-- --8<-- [end:admin] -->

<!-- --8<-- [start:teacher] -->

## Para el profesorado { #profesorado }

### 1. Subir un recurso

En **Medios → Añadir medios**, sube el archivo `.elpx`. WordPress lo comprueba y lo prepara para
mostrarlo.

![Un recurso de eXeLearning en la biblioteca de medios](img/wordpress/media-upload.png)

En los detalles del archivo verás la **Información de eXeLearning**, una vista previa y el botón
**Editar en eXeLearning**.

![Detalles del recurso con vista previa](img/wordpress/media-details.png)

### 2. Editarlo

Pulsa **Editar en eXeLearning**. El editor se abre en una ventana; al terminar, pulsa **Guardar en
WordPress**. Todas las entradas que usan ese recurso muestran la nueva versión.

![El editor de eXeLearning dentro de WordPress](img/wordpress/editor.png)

### 3. Publicarlo en una entrada o página

En el editor de bloques, pulsa **+** (Insertador de bloques), busca **eXeLearning** y añade el bloque.
Después elige el recurso con **Subir archivo .elpx** o **Biblioteca de medios**.

![Insertar el bloque eXeLearning](img/wordpress/block-insert.png)

En el panel lateral del bloque puedes cambiar la **Altura (px)**, mostrar el **selector de capa
docente**, el **botón de pantalla completa** y las **opciones de descarga**.

![Ajustes del bloque](img/wordpress/block-settings.png)

Así lo ve el alumnado en la web:

![El recurso publicado en una entrada](img/wordpress/frontend.png)

??? note "¿Usas el editor clásico? Código corto"
    Escribe `[exelearning id="123"]`, donde `123` es el número del archivo en la biblioteca de medios
    (aparece en la dirección al abrirlo: `upload.php?item=123`). Opciones útiles:

    ```text
    [exelearning id="123" height="800" fullscreen="1" show_download="1" screenshot="poster"]
    ```

    `height` y `width` cambian el tamaño, `fullscreen` añade el botón de pantalla completa,
    `show_download` permite descargar el recurso y `screenshot="poster"` muestra una imagen hasta que
    se pulsa **Cargar contenido interactivo**.

<!-- --8<-- [end:teacher] -->
