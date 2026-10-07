# eXeLearning Plugins

[Leer en español](index.es.md){ .lang-switch }

<!-- --8<-- [start:guide] -->

The plugins bring eXeLearning into the platforms your school already uses. Teachers create and edit
resources **without leaving Moodle, Nextcloud, WordPress, Omeka S or Google Drive**, and students see
them right on the page, with nothing to download or install.

Every plugin is **free and open source**, and every published release **includes the eXeLearning
editor**: install the plugin and you can start editing.

## Which plugin do I need?

| Platform | Plugin | What it is for | Grades |
| --- | --- | --- | --- |
| Moodle | [eXeLearning resource](moodle.md#mod_exelearning) (`mod_exelearning`) | Interactive activities that grade themselves | One column per exercise |
| Moodle | [eXeLearning (SCORM)](moodle.md#mod_exescorm) (`mod_exescorm`) | Content published as a SCORM 1.2 package | One overall grade (SCORM) |
| Moodle | [eXeLearning (website)](moodle.md#mod_exeweb) (`mod_exeweb`) | Reference material with its own menu | Not graded |
| Nextcloud | [eXeLearning for Nextcloud](nextcloud.md) | View, edit and create resources in Files | — |
| WordPress | [eXeLearning for WordPress](wordpress.md) | Publish resources in posts and pages | — |
| Omeka S | [eXeLearning for Omeka S](omeka-s.md) | Catalogue and show resources in collections | — |
| Google Drive | [eXeLearning for Google Drive](google-drive.md) | Open and edit resources stored in Drive | — |

!!! tip "Moodle? Start with `mod_exelearning`"
    For new content in Moodle, the **eXeLearning resource** (`mod_exelearning`) is the recommended
    choice: it has the embedded editor, keeps the resource's own menu and sends each exercise's score
    to the gradebook separately. `mod_exescorm` and `mod_exeweb` remain useful for existing SCORM
    packages and websites.

## Try them without installing anything

Each plugin has a demo that runs **in your browser**, with no server and no sign-up. Open it, play with
it and close it: nothing is kept.

| Plugin | Demo | User |
| --- | --- | --- |
| Moodle · eXeLearning resource | [Open in Moodle Playground](https://moodle-playground.com/?blueprint-url=https://raw.githubusercontent.com/exelearning/moodle-mod_exelearning/main/blueprint.json) | `admin` / `password` |
| Moodle · eXeLearning (SCORM) | [Open in Moodle Playground](https://moodle-playground.com/?blueprint-url=https://raw.githubusercontent.com/exelearning/mod_exescorm/refs/heads/main/blueprint.json) | `admin` / `password` |
| Moodle · eXeLearning (website) | [Open in Moodle Playground](https://moodle-playground.com/?blueprint-url=https://raw.githubusercontent.com/exelearning/mod_exeweb/refs/heads/main/blueprint.json) | `admin` / `password` |
| Nextcloud | [Open in Nextcloud Playground](https://ateeducacion.github.io/nextcloud-playground/?blueprint-url=https://raw.githubusercontent.com/exelearning/nextcloud-exelearning/main/blueprint.json) | `admin` / `admin` |
| WordPress | [Open in WordPress Playground](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/exelearning/wp-exelearning/refs/heads/main/blueprint.json) | already signed in |
| Omeka S | [Open in Omeka S Playground](https://ateeducacion.github.io/omeka-s-playground/?blueprint=https%3A%2F%2Fraw.githubusercontent.com%2Fexelearning%2Fomeka-s-exelearning%2Frefs%2Fheads%2Fmain%2Fblueprint.json) | `admin@example.com` / `password` |

!!! note "The first load takes a moment"
    The demo downloads a complete platform into your browser. Give it a few seconds the first time.

## How they work

1. **An administrator installs the plugin** once, from the platform's admin panel, using the ZIP of
   the published release. No separate eXeLearning server is needed.
2. **Teachers upload a resource** (`.elpx`) or create a new one, and edit it with the **Edit with
   eXeLearning** button. The editor opens inside the platform.
3. **When they save**, the updated resource goes back to the platform. Students always see the latest
   version.

![The eXeLearning editor open inside Moodle](img/moodle/exelearning-editor.png)

!!! info "`.elpx` and `.elp` files"
    `.elpx` is the format of eXeLearning 3 and later. `.elp` files from older versions open in the
    editor and are saved as `.elpx`.

## Downloads

Always install the ZIP of the **latest published release** (*Releases*). The source code's
*Download ZIP* button **does not include the editor**.

| Plugin | Download |
| --- | --- |
| Moodle · eXeLearning resource | <https://github.com/exelearning/moodle-mod_exelearning/releases/latest> |
| Moodle · eXeLearning (SCORM) | <https://github.com/exelearning/mod_exescorm/releases/latest> |
| Moodle · eXeLearning (website) | <https://github.com/exelearning/mod_exeweb/releases/latest> |
| Nextcloud | <https://github.com/exelearning/nextcloud-exelearning/releases/latest> |
| WordPress | <https://github.com/exelearning/wp-exelearning/releases/latest> |
| Omeka S | <https://github.com/exelearning/omeka-s-exelearning/releases/latest> |
| Google Drive | Nothing to install: <https://exelearning.github.io/gdrive-exelearning/> |

!!! note "Screenshots"
    The screenshots in these guides show the Spanish interface. The steps are the same in any language.

## Need help?

Report bugs and suggestions in the
[eXeLearning repository](https://github.com/exelearning/exelearning/issues). Each plugin has its own
label (`moodle`, `nextcloud`, `wordpress`, `omeka-s`, `gdrive`) so you can find similar reports.

<!-- --8<-- [end:guide] -->

To get every guide in a single document, open the [full manual](manual.md) and use **Print → Save as
PDF** in your browser.
