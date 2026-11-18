# eXeLearning en OneDrive

[Read in English](onedrive.md){ .lang-switch }

<!-- --8<-- [start:intro] -->

**eXeLearning para OneDrive** permite **abrir, editar y crear** recursos de eXeLearning (`.elpx`)
guardados en tu Microsoft OneDrive. No hay que instalar nada: funciona en el navegador y los archivos
nunca salen de OneDrive.

<!-- --8<-- [end:intro] -->

<!-- --8<-- [start:admin] -->

## Para administración { #administracion }

**No hay nada que instalar.** Cada docente puede usar la aplicación pública,
<https://exelearning.github.io/onedrive-exelearning/>, con una cuenta de Microsoft: la de Microsoft 365
de su centro o una personal. Es gratuita y no necesita servidor.

### Revisa tu inquilino de Microsoft 365

La primera vez que alguien inicia sesión, Microsoft le pide aceptar los permisos de la aplicación
(leer y escribir sus archivos de OneDrive, y su nombre). Si tu inquilino no deja que los usuarios
acepten aplicaciones, una persona con permisos de administración de Microsoft Entra debe **conceder el
consentimiento de administrador** a **onedrive-exelearning** para toda la organización. Si no, el
profesorado verá el mensaje «Se necesita la aprobación del administrador» al iniciar sesión.

### Alojar una copia propia (opcional)

Una administración puede publicar su propia copia en lugar de usar la pública, por ejemplo para
limitar el acceso a su propio inquilino de Microsoft 365 y conceder el consentimiento una sola vez para
todo el profesorado. La aplicación es una web estática, así que sirve cualquier servidor web.
Necesitas:

1. Un **registro de aplicación** en el centro de administración de Microsoft Entra, con la dirección
   de tu copia como URI de redirección de **aplicación de página única** (SPA).
2. Los permisos delegados de Microsoft Graph `Files.ReadWrite`, `User.Read`, `openid` y `profile`.
   En una copia de un solo inquilino, pulsa **Conceder consentimiento de administrador** para que no
   se lo pregunte al profesorado.
3. El ID de cliente y el inquilino de la aplicación en la configuración de compilación.

Todos los pasos están en la
[guía de autoalojamiento](https://github.com/exelearning/onedrive-exelearning/blob/main/SELF-HOSTING.md)
(en inglés).

<!-- --8<-- [end:admin] -->

<!-- --8<-- [start:teacher] -->

## Para el profesorado { #profesorado }

### Requisitos

- Una cuenta de Microsoft (la de Microsoft 365 de tu centro o una personal) con OneDrive.
- Un navegador actual que permita las ventanas emergentes de la aplicación (para iniciar sesión).

### Primeros pasos

1. Entra en <https://exelearning.github.io/onedrive-exelearning/>.
2. Pulsa **Sign in with Microsoft**, elige tu cuenta y acepta los permisos.

![Página de inicio de eXeLearning para OneDrive](img/onedrive/landing.png)

!!! note "A diferencia de Google Drive"
    OneDrive no añade eXeLearning a sus propios menús. Siempre se empieza desde la página de la
    aplicación: guárdala en marcadores.

### Abrir un recurso

Pulsa **Open from OneDrive** y elige un archivo `.elpx` de la lista.

![Open from OneDrive con la lista de recursos](img/onedrive/open-picker.png)

Se muestra una vista previa del recurso, lista para navegar. Pulsa **Edit in eXeLearning** para
editarlo.

### Editar y guardar

Cuando termines, pulsa **Save to OneDrive** (o Ctrl/Cmd + S). El archivo se actualiza en OneDrive.

![El editor de eXeLearning con el botón Save to OneDrive](img/onedrive/editor.png)

- Si alguien cambió el archivo mientras lo editabas, podrás elegir entre sobrescribirlo, guardar una
  copia o cancelar.
- Los `.elp` antiguos se guardan como un `.elpx` nuevo junto al original.

### Crear un recurso nuevo

Pulsa **New file**. Se crea un archivo `Untitled.elpx` en tu OneDrive y se abre en el editor. Puedes
cambiarle el nombre desde OneDrive cuando quieras.

### Compartir

Usa el botón **Compartir** de OneDrive, como con cualquier otro archivo.

!!! note "Idioma"
    Por ahora las pantallas propias de esta aplicación están solo en inglés. El editor se muestra en tu
    idioma.

<!-- --8<-- [end:teacher] -->
