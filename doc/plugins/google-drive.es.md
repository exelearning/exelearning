# eXeLearning en Google Drive

[Read in English](google-drive.md){ .lang-switch }

<!-- --8<-- [start:intro] -->

**eXeLearning para Google Drive** permite **abrir, editar y crear** recursos de eXeLearning
(`.elpx`) guardados en tu Drive. No hay que instalar nada: funciona en el navegador y los archivos
nunca salen de Drive.

<!-- --8<-- [end:intro] -->

<!-- --8<-- [start:admin] -->

## Para administración { #administracion }

**No hay nada que instalar.** Cada docente puede usar la aplicación pública,
<https://exelearning.github.io/gdrive-exelearning/>, con su propia cuenta de Google, también con
cuentas de Google Workspace for Education. Es gratuita, no necesita servidor y solo accede a los
archivos que cada persona abre o crea con ella (permiso `drive.file`).

### Revisa tu dominio de Google Workspace

Si tu dominio restringe las aplicaciones de terceros, una persona con permisos de administración de
Workspace debe permitir **eXeLearning** en la **Consola de administración de Google** (**Seguridad →
Control de acceso y de datos → Controles de API → Gestionar el acceso de aplicaciones de terceros**).
Si no, el profesorado verá un error al autorizarla.

### Alojar una copia propia (opcional)

Una administración puede publicar su propia copia en lugar de usar la pública, por ejemplo para que
aparezca su nombre en la pantalla de permisos o para limitar el acceso a su dominio. La aplicación es
una web estática, así que sirve cualquier servidor web. Necesitas:

1. Un **proyecto de Google Cloud** con la **API de Google Drive** activada.
2. Una **pantalla de consentimiento OAuth** con los permisos `drive.file` y `drive.install`, y un
   **ID de cliente OAuth** para la dirección de tu web.
3. La **integración con la interfaz de Drive** apuntando a tu copia, para que eXeLearning aparezca en
   los menús **Abrir con** y **Nuevo** de Drive.

Todos los pasos están en la
[guía de autoalojamiento](https://github.com/exelearning/gdrive-exelearning/blob/main/SELF-HOSTING.md)
(en inglés).

<!-- --8<-- [end:admin] -->

<!-- --8<-- [start:teacher] -->

## Para el profesorado { #profesorado }

### Requisitos

- Una cuenta de Google (personal o de tu centro).
- Un navegador actual.

### Primeros pasos

1. Entra en <https://exelearning.github.io/gdrive-exelearning/>.
2. Pulsa **Authorize Google** y acepta los permisos. Así eXeLearning aparece en los menús **Abrir con**
   y **Nuevo** de Drive.

![Página de inicio de eXeLearning para Google Drive](img/google-drive/landing.png)

!!! info "Permisos que pide"
    Solo accede a los archivos que abras o crees con eXeLearning (permiso `drive.file`), no a todo tu
    Drive.

### Abrir un recurso

En Google Drive, haz clic derecho sobre un `.elpx` y elige **Abrir con → eXeLearning**. La primera
vez, pulsa **Authorize and open**.

![Abrir con → eXeLearning en Google Drive](img/google-drive/open-with.png)

Se muestra una vista previa del recurso, lista para navegar. Pulsa **Edit in eXeLearning** para
editarlo.

![Vista previa del recurso con el botón Edit in eXeLearning](img/google-drive/preview.png)

### Editar y guardar

El editor se abre en la misma pestaña. Cuando termines, pulsa **Save to Drive** (o Ctrl/Cmd + S). El
archivo se actualiza en Drive, con su miniatura.

![El editor de eXeLearning con el botón Save to Drive](img/google-drive/editor.png)

- Si alguien cambió el archivo mientras lo editabas, podrás elegir entre sobrescribirlo, guardar una
  copia o cancelar.
- Los archivos que solo puedes ver se abren en modo lectura.
- Los `.elp` antiguos se guardan como un `.elpx` nuevo junto al original.

### Crear un recurso nuevo

En Drive, pulsa **Nuevo → Más → eXeLearning**. La primera vez, pulsa **Authorize and create**. El
archivo nuevo se crea en la carpeta en la que estás y se abre en el editor.

![Nuevo → Más → eXeLearning en Google Drive](img/google-drive/new-menu.png)

### Compartir

Usa el botón **Compartir** de Google Drive, como con cualquier otro archivo.

!!! note "Idioma"
    Por ahora las pantallas propias de esta aplicación están solo en inglés. Los menús de Drive y el
    editor se muestran en tu idioma.

<!-- --8<-- [end:teacher] -->
