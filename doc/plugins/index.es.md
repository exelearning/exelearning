# Plugins de eXeLearning

[Read in English](index.md){ .lang-switch }

<!-- --8<-- [start:guide] -->

Los plugins llevan eXeLearning a las plataformas que ya usa tu centro. El profesorado crea y edita los
recursos **sin salir de Moodle, Nextcloud, WordPress, Omeka S o Google Drive**, y el alumnado los ve
integrados en la página, sin descargas ni instalaciones.

Todos los plugins son **gratuitos y de código abierto**, y cada versión publicada **incluye el editor
de eXeLearning**: basta con instalar el plugin para empezar a editar.

## ¿Qué plugin necesito?

| Plataforma | Plugin | Para qué sirve | Calificaciones |
| --- | --- | --- | --- |
| Moodle | [Recurso eXeLearning](moodle.es.md#mod_exelearning) (`mod_exelearning`) | Actividades interactivas que se califican solas | Una columna por cada ejercicio |
| Moodle | [eXeLearning (SCORM)](moodle.es.md#mod_exescorm) (`mod_exescorm`) | Contenidos publicados como paquete SCORM 1.2 | Una nota global (SCORM) |
| Moodle | [eXeLearning (sitio web)](moodle.es.md#mod_exeweb) (`mod_exeweb`) | Materiales de consulta con su propio menú | No califica |
| Nextcloud | [eXeLearning para Nextcloud](nextcloud.es.md) | Ver, editar y crear recursos en Archivos | — |
| WordPress | [eXeLearning para WordPress](wordpress.es.md) | Publicar recursos en entradas y páginas | — |
| Omeka S | [eXeLearning para Omeka S](omeka-s.es.md) | Catalogar y mostrar recursos en colecciones | — |
| Google Drive | [eXeLearning para Google Drive](google-drive.es.md) | Abrir y editar recursos guardados en Drive | — |

!!! tip "¿Moodle? Empieza por `mod_exelearning`"
    Si vas a crear contenidos nuevos en Moodle, **eXeLearning** (`mod_exelearning`) es la opción
    recomendada: tiene el editor integrado, conserva el menú del recurso y envía al libro de
    calificaciones la nota de cada ejercicio por separado. `mod_exescorm` y `mod_exeweb` siguen siendo
    útiles para contenidos SCORM y sitios web que ya existen.

## Pruébalos sin instalar nada

Cada plugin tiene una demostración que funciona **en el navegador**, sin servidor ni registro. Ábrela,
juega con ella y ciérrala: no se guarda nada.

| Plugin | Demostración | Usuario |
| --- | --- | --- |
| Moodle · Recurso eXeLearning | [Abrir en Moodle Playground](https://moodle-playground.com/?blueprint-url=https://raw.githubusercontent.com/exelearning/moodle-mod_exelearning/main/blueprint.json) | `admin` / `password` |
| Moodle · eXeLearning (SCORM) | [Abrir en Moodle Playground](https://moodle-playground.com/?blueprint-url=https://raw.githubusercontent.com/exelearning/mod_exescorm/refs/heads/main/blueprint.json) | `admin` / `password` |
| Moodle · eXeLearning (sitio web) | [Abrir en Moodle Playground](https://moodle-playground.com/?blueprint-url=https://raw.githubusercontent.com/exelearning/mod_exeweb/refs/heads/main/blueprint.json) | `admin` / `password` |
| Nextcloud | [Abrir en Nextcloud Playground](https://ateeducacion.github.io/nextcloud-playground/?blueprint-url=https://raw.githubusercontent.com/exelearning/nextcloud-exelearning/main/blueprint.json) | `admin` / `admin` |
| WordPress | [Abrir en WordPress Playground](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/exelearning/wp-exelearning/refs/heads/main/blueprint.json) | sesión ya iniciada |
| Omeka S | [Abrir en Omeka S Playground](https://ateeducacion.github.io/omeka-s-playground/?blueprint=https%3A%2F%2Fraw.githubusercontent.com%2Fexelearning%2Fomeka-s-exelearning%2Frefs%2Fheads%2Fmain%2Fblueprint.json) | `admin@example.com` / `password` |

!!! note "La primera carga tarda un poco"
    La demostración descarga una plataforma completa en el navegador. Espera unos segundos la
    primera vez.

## Cómo funcionan

1. **La administración instala el plugin** una sola vez, desde el panel de la plataforma, con el
   archivo ZIP de la versión publicada. No hace falta un servidor de eXeLearning aparte.
2. **El profesorado sube un recurso** (`.elpx`) o crea uno nuevo, y lo edita con el botón
   **Editar con eXeLearning**. El editor se abre dentro de la propia plataforma.
3. **Al guardar**, el recurso actualizado vuelve a la plataforma. El alumnado ve siempre la última
   versión.

![El editor de eXeLearning abierto dentro de Moodle](img/moodle/exelearning-editor.png)

!!! info "Archivos `.elpx` y `.elp`"
    `.elpx` es el formato de eXeLearning 3 y posteriores. Los archivos `.elp` de versiones antiguas
    se pueden abrir en el editor y se guardan convertidos a `.elpx`.

## Descargas

Instala siempre el ZIP de la **última versión publicada** (*Releases*). La opción *Download ZIP* del
código fuente **no incluye el editor**.

| Plugin | Descarga |
| --- | --- |
| Moodle · Recurso eXeLearning | <https://github.com/exelearning/moodle-mod_exelearning/releases/latest> |
| Moodle · eXeLearning (SCORM) | <https://github.com/exelearning/mod_exescorm/releases/latest> |
| Moodle · eXeLearning (sitio web) | <https://github.com/exelearning/mod_exeweb/releases/latest> |
| Nextcloud | <https://github.com/exelearning/nextcloud-exelearning/releases/latest> |
| WordPress | <https://github.com/exelearning/wp-exelearning/releases/latest> |
| Omeka S | <https://github.com/exelearning/omeka-s-exelearning/releases/latest> |
| Google Drive | No se instala: <https://exelearning.github.io/gdrive-exelearning/> |

## ¿Necesitas ayuda?

Comunica errores y sugerencias en el
[repositorio de eXeLearning](https://github.com/exelearning/exelearning/issues). Cada plugin tiene su
etiqueta (`moodle`, `nextcloud`, `wordpress`, `omeka-s`, `gdrive`) para encontrar consultas
parecidas.

<!-- --8<-- [end:guide] -->

Para tener todas las guías en un solo documento, abre el [manual completo](manual.es.md) y usa
**Imprimir → Guardar como PDF** en el navegador.
