[English version](README.md)

# Editor de ecuaciones $\LaTeX$ online

## Descripción

Este proyecto es una herramienta gratuita pensada para que docentes y estudiantes puedan crear y editar fórmulas matemáticas fácilmente, sin necesidad de conocer a fondo el lenguaje LaTeX. Permite generar materiales educativos con notación matemática clara y profesional. Se puede usar con programas que admiten LaTeX, como eXeLearning, Moodle, Overleaf, etc.

El programa funciona tanto de forma **independiente** como **integrado en eXeLearning**. Cuando se detecta que se abre desde eXe (desde un plugin para TinyMCE), se muestra un botón que permite insertar la fórmula directamente. Si se abre de forma autónoma (por ejemplo, en un navegador), este botón no aparece.

---

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

Este proyecto tiene licencia Creative Commons BY-SA. Puedes usarlo, modificarlo y compartirlo libremente, citando al autor y manteniendo la misma licencia.

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
