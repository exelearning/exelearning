[Versión en español](README_es.md)

# Online $\LaTeX$ Equation Editor

[![AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE.txt)
[![CC BY-SA 4.0](https://img.shields.io/badge/Content-CC_BY--SA_4.0-lightgrey.svg)](https://creativecommons.org/licenses/by-sa/4.0/)

## Description

This project is a free tool designed to help teachers and students create and edit mathematical formulas easily, without needing in-depth knowledge of LaTeX. It allows you to generate educational materials with clear, professional mathematical notation. It can be used with programs that support LaTeX, such as eXeLearning, Moodle, Overleaf, etc.

The program works both as a **standalone** application and **integrated into eXeLearning**. When it detects it was opened from eXe (via a plugin for TinyMCE), a button appears to insert the formula directly. If opened standalone (e.g., in a browser), this button does not appear.

---

## Integration with other web apps (postMessage)

Besides the eXeLearning/TinyMCE integration, you can integrate EdiCuaTeX into any website via `postMessage` without modifying your app:

- Open the editor with parameters: append `?pm=1&origin=<YOUR_ORIGIN>` to the editor URL.
  - Local example (popup): `http://localhost:8000/index.html?pm=1&origin=http%3A%2F%2Flocalhost%3A8001`
  - Public example (GitHub Pages): `https://jjdeharo.github.io/edicuatex/index.html?pm=1&origin=https%3A%2F%2Fjjdeharo.github.io`
  - `origin` must be the exact origin (protocol + host + port) of your receiving app.
- Contextual button: with `pm=1`, a “Send to host” button appears.
- Payload sent when clicking “Send”:
  - `type: 'edicuatex:result'`
  - `latex`: LaTeX code without delimiters
  - `delimiter`: value from the delimiter selector (`none`, `parentheses`, `brackets`, `double_dollar`, `single_dollar`)
  - `wrapped`: LaTeX including the selected delimiters

Minimal host example (popup or iframe):

```html
<button id="open">Open editor</button>
<textarea id="out" rows="6" cols="60"></textarea>
<script>
let editorOrigin = '';
document.getElementById('open').onclick = () => {
  const url = 'http://localhost:8000/index.html?pm=1&origin=' + encodeURIComponent(location.origin);
  editorOrigin = new URL(url).origin; // e.g., http://localhost:8000
  window.open(url, 'edicuatex', 'width=1100,height=800');
};
window.addEventListener('message', (e) => {
  if (!editorOrigin || e.origin !== editorOrigin) return; // accept only from editor
  if (e.data && e.data.type === 'edicuatex:result') {
    document.getElementById('out').value = e.data.wrapped || e.data.latex || '';
  }
});
</script>
```

Notes
- Works with both `window.open` (popup) and `<iframe>` embeds.
- The eXe/TinyMCE integration remains intact and separate; the “Insert” button is shown only inside eXe.

## 1. `index.html` → Visual LaTeX Formula Editor

### Main Features

- Write formulas using a visual menu with customizable buttons and categories.
- Preview the formula in real time thanks to MathJax.
- Copy the LaTeX code ready to use, with or without delimiters.
- Export the formula as a PNG image.
- Search by name or code (e.g., `square root`, `\int`...).
- Quick access to recently used formulas.
- AI assistant to generate formulas from a description.
- Support for **multiple menus** from local files, external URLs, or GitHub.
- Automatically loads menus defined in `menus/menus.json`, with visible descriptions.

### How to Use

1. Select a formula or write code manually.
2. Preview the result.
3. Copy the code, download it as an image, or insert it directly into eXeLearning.

---

## 2. `menus/editor.html` → Visual Menu Editor for Formulas

This file allows you to create or modify collections of buttons with LaTeX formulas organized by category.

### Main Features

- Create, edit, and organize formula menus without manually writing JSON.
- Use drag and drop to rearrange buttons.
- AI assistant to generate elements, categories, or entire files.
- Export menus in JSON format for use in `index.html`.
- Load `.json` files from your computer, clipboard, or external URLs (like GitHub Raw).

---

## Formula Menus (`.json`)

Menus define buttons organized in categories with LaTeX formulas. They can be loaded from `index.html` or created with `menus/editor.html`.

The default base menu is `menus/base.json`, which loads automatically when the editor opens. You can add more from the "Manage Menus" window.

### Manifest `menus/menus.json`

The `menus/menus.json` file acts as an index of the available menus for the editor. It contains an array called `menus`, where each element specifies:

- `file`: name of the `.json` file containing the categories and formulas.
- `description`: text describing the menu's content (shown in the interface).

Example:

```json
{
  "menus": [
    { "file": "base.json",       "description": "Basic Symbols" },
    { "file": "entornos.json",   "description": "Mathematical Environments" },
    { "file": "estadistica.json","description": "Statistics" },
    { "file": "fisica.json",     "description": "Physics" },
    { "file": "geometria.json",  "description": "Geometry" }
  ]
}
```

---

## Structure of a Menu File

```json
{
  "categorias": [
    {
      "nombre": "Algebra",
      "id": "algebra",
      "grid_template_columns": "repeat(auto-fit, minmax(80px, 1fr))",
      "isCollapsed": false,
      "elementos": [
        {
          "type": "button",
          "latex": "\\frac{a}{b}",
          "display": "\\frac{a}{b}",
          "title": "Fraction"
        },
        {
          "type": "custom_matrix",
          "title": "Custom Matrix"
        }
      ]
    }
  ]
}
```

---

## License

- Code: GNU AGPL v3. See `LICENSE.txt`.
- Content (texts, screenshots, menu data): CC BY-SA 4.0.
  - https://creativecommons.org/licenses/by-sa/4.0/

Third-party libraries remain under their own licenses.

---

**Author**: Juan José de Haro  
[https://bilateria.org](https://bilateria.org)

---

## Third-party libraries

EdiCuaTeX includes DOMPurify, a DOM-only XSS sanitizer for HTML, MathML and SVG.

DOMPurify details:

Copyright 2025 Dr.-Ing. Mario Heiderich, Cure53

DOMPurify is free software; you can redistribute it and/or modify it under the
terms of either:

a) the Apache License Version 2.0, or
b) the Mozilla Public License Version 2.0

See https://github.com/cure53/DOMPurify for more details.
