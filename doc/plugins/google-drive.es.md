# eXeLearning en Google Drive

[Read in English](google-drive.md){ .lang-switch }

<!-- --8<-- [start:guide] -->

**eXeLearning para Google Drive** permite **abrir, editar y crear** recursos de eXeLearning
(`.elpx`) guardados en tu Drive. No hay que instalar nada: funciona en el navegador y los archivos
nunca salen de Drive.

## Requisitos

- Una cuenta de Google.
- Un navegador actual.

## Primeros pasos

1. Entra en <https://exelearning.github.io/gdrive-exelearning/>.
2. Pulsa **Authorize Google** y acepta los permisos. Así eXeLearning aparece en los menús **Abrir con**
   y **Nuevo** de Drive.

![Página de inicio de eXeLearning para Google Drive](img/google-drive/landing.png)

!!! info "Permisos que pide"
    Solo accede a los archivos que abras o crees con eXeLearning (permiso `drive.file`), no a todo tu
    Drive.

## Uso

### Abrir un recurso

En Google Drive, haz clic derecho sobre un `.elpx` y elige **Abrir con → eXeLearning**. La primera
vez, pulsa **Authorize and open**. Se muestra una vista previa; pulsa **Edit in eXeLearning** para
editar.

### Guardar

Pulsa **Save to Drive** (o Ctrl/Cmd + S). El archivo se actualiza en Drive, con su miniatura.

- Si alguien cambió el archivo mientras lo editabas, podrás elegir entre sobrescribirlo, guardar una
  copia o cancelar.
- Los archivos que solo puedes ver se abren en modo lectura.
- Los `.elp` antiguos se guardan como un `.elpx` nuevo junto al original.

### Crear un recurso nuevo

En Drive, pulsa **Nuevo → Más → eXeLearning**. La primera vez, pulsa **Authorize and create**.

### Compartir

Usa el botón **Compartir** de Google Drive, como con cualquier otro archivo.

!!! note "Idioma"
    Por ahora los textos de esta aplicación están solo en inglés. Los menús de Drive y el editor se
    muestran en tu idioma.

!!! tip "Para administraciones"
    Para usarla con un dominio de Google Workspace propio, se puede alojar una copia con su propio
    proyecto de Google Cloud. Consulta la
    [guía de autoalojamiento](https://github.com/exelearning/gdrive-exelearning/blob/main/SELF-HOSTING.md).

<!-- --8<-- [end:guide] -->
