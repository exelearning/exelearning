[English version](README.md)

# Editor de ecuaciones $\LaTeX$ online

[![AGPL v3](https://img.shields.io/badge/Licencia-AGPL_v3-blue.svg)](LICENSE.txt)
[![CC BY-SA 4.0](https://img.shields.io/badge/Contenido-CC_BY--SA_4.0-lightgrey.svg)](https://creativecommons.org/licenses/by-sa/4.0/deed.es)

## Descripción

Este proyecto es una herramienta gratuita pensada para que docentes y estudiantes puedan crear y editar fórmulas matemáticas fácilmente, sin necesidad de conocer a fondo el lenguaje LaTeX. Permite generar materiales educativos con notación matemática clara y profesional. Se puede usar con programas que admiten LaTeX, como eXeLearning, Moodle, Overleaf, etc.

El programa funciona tanto de forma **independiente** como **integrado en eXeLearning**. Cuando se detecta que se abre desde eXe (desde un plugin para TinyMCE), se muestra un botón que permite insertar la fórmula directamente. Si se abre de forma autónoma (por ejemplo, en un navegador), este botón no aparece.

---

## Integración con otras aplicaciones web (postMessage)

Además de la integración con eXeLearning/TinyMCE, puedes integrar EdiCuaTeX en cualquier web mediante `postMessage` sin tocar el código de tu app:

- Abrir el editor con parámetros: añade `?pm=1&origin=<TU_ORIGIN>` a la URL del editor.
  - Ejemplo local (popup): `http://localhost:8000/index.html?pm=1&origin=http%3A%2F%2Flocalhost%3A8001`
  - Ejemplo público (GitHub Pages): `https://jjdeharo.github.io/edicuatex/index.html?pm=1&origin=https%3A%2F%2Fjjdeharo.github.io`
  - `origin` debe ser el origen exacto (protocolo + host + puerto) de tu app receptora.
- Botón contextual: con `pm=1` aparece el botón “Enviar a la app”.
- Payload enviado al pulsar “Enviar”:
  - `type: 'edicuatex:result'`
  - `latex`: código LaTeX sin delimitadores
  - `delimiter`: valor del selector de delimitadores (`none`, `parentheses`, `brackets`, `double_dollar`, `single_dollar`)
  - `wrapped`: LaTeX con los delimitadores elegidos

Ejemplo mínimo en tu app (popup o iframe):

```html
<button id="open">Abrir editor</button>
<textarea id="out" rows="6" cols="60"></textarea>
<script>
let editorOrigin = '';
document.getElementById('open').onclick = () => {
  const url = 'http://localhost:8000/index.html?pm=1&origin=' + encodeURIComponent(location.origin);
  editorOrigin = new URL(url).origin; // p.ej., http://localhost:8000
  window.open(url, 'edicuatex', 'width=1100,height=800');
};
window.addEventListener('message', (e) => {
  if (!editorOrigin || e.origin !== editorOrigin) return; // seguridad: solo aceptar del editor
  if (e.data && e.data.type === 'edicuatex:result') {
    document.getElementById('out').value = e.data.wrapped || e.data.latex || '';
  }
});
</script>
```

Notas
- Funciona tanto en `window.open` (popup) como en `<iframe>`.
- La integración con eXe/TinyMCE permanece intacta y separada; el botón “Insertar” solo aparece dentro de eXe.

## 1. `index.html` → Editor visual de fórmulas LaTeX

### Funcionalidades principales

- Escribir fórmulas con un menú visual de botones y categorías personalizables.
- Ver la fórmula en tiempo real gracias a MathJax.
- Copiar el código LaTeX listo para usar, con o sin delimitadores.
- Exportar la fórmula como imagen PNG.
- Buscar por nombre o código (ej: `raíz`, `\int`...).
- Acceso rápido a fórmulas usadas recientemente.
- Asistente con IA para generar fórmulas a partir de una descripción.
- Gestión de **múltiples menús** desde archivos locales, URLs externas o GitHub.
- Carga automática de menús definidos en `menus/menus.json`, con descripciones visibles.

### Cómo usarlo

1. Selecciona una fórmula o escribe código manualmente.
2. Visualiza el resultado.
3. Copia el código, descárgalo como imagen o insértalo directamente en eXeLearning.

---

## 2. `menus/editor.html` → Editor visual de menús de fórmulas

Este archivo permite crear o modificar colecciones de botones con fórmulas LaTeX organizadas por categorías.

### Funcionalidades principales

- Crear, editar y organizar menús de fórmulas sin escribir JSON manualmente.
- Usar arrastrar y soltar para reorganizar los botones.
- Asistente con IA para generar elementos, categorías o archivos completos.
- Exportar los menús en formato JSON para integrarlos en `index.html`.
- Cargar archivos `.json` desde tu ordenador, portapapeles o URLs externas (como GitHub Raw).

---

## Menús de fórmulas (`.json`)

Los menús definen botones organizados en categorías con fórmulas LaTeX. Se pueden cargar desde `index.html` o crear con `menus/editor.html`.

El menú base por defecto es `menus/base.json`, cargado automáticamente al abrir el editor. Puedes añadir más desde la ventana "Gestionar menús".

### Manifest `menus/menus.json`

El archivo `menus/menus.json` actúa como índice de los menús disponibles para el editor. Contiene un array llamado `menus`, donde cada elemento especifica:

- `file`: nombre del archivo `.json` que contiene las categorías y fórmulas.
- `description`: texto que describe el contenido del menú (aparece en la interfaz).

Ejemplo:

```json
{
  "menus": [
    { "file": "base.json",       "description": "Símbolos básicos" },
    { "file": "entornos.json",   "description": "Entornos matemáticos" },
    { "file": "estadistica.json","description": "Estadística" },
    { "file": "fisica.json",     "description": "Física" },
    { "file": "geometria.json",  "description": "Geometría" }
  ]
}
```

---

## Estructura de un archivo de menú

```json
{
  "categorias": [
    {
      "nombre": "Álgebra",
      "id": "algebra",
      "grid_template_columns": "repeat(auto-fit, minmax(80px, 1fr))",
      "isCollapsed": false,
      "elementos": [
        {
          "type": "button",
          "latex": "\\frac{a}{b}",
          "display": "\\frac{a}{b}",
          "title": "Fracción"
        },
        {
          "type": "custom_matrix",
          "title": "Matriz personalizada"
        }
      ]
    }
  ]
}
```

---

## Licencia

- Código: GNU AGPL v3. Ver `LICENSE.txt`.
- Contenidos (textos, capturas, datos de menús): CC BY-SA 4.0.
  - https://creativecommons.org/licenses/by-sa/4.0/deed.es

Las librerías de terceros mantienen sus propias licencias.

---

**Autor**: Juan José de Haro  
[https://bilateria.org](https://bilateria.org)

---

## Librerías de terceros

EdiCuaTeX incluye DOMPurify, una librería para "sanitizar" código y evitar ataques XSS.

Detalles de DOMPurify:

Copyright 2025 Dr.-Ing. Mario Heiderich, Cure53

DOMPurify es software libre y se puede distribuir y modificar según los términos de cualquiera de las siguientes licencias:

a) Apache License Version 2.0, o
b) Mozilla Public License Version 2.0

Para más información, visita https://github.com/cure53/DOMPurify
