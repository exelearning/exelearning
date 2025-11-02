# Creating a Style for **eXeLearning**

## Minimum Required Elements of a Style

A style must include at least the following elements:

| Element        | Description |
|----------------|-------------|
| `config.xml`   | Main configuration file. |
| CSS files      | Visual styling of the content. |
| JS files       | JavaScript functionality for the style (optional). |
| `preview.png`  | Preview image (screenshot). |
| `icons/`       | Folder containing iDevice icons. |

---

## The `config.xml` File

Example structure:

```xml
<?xml version="1.0"?>
<theme>
  <name>example</name>
  <title>Example</title>
  <version>2025</version>
  <compatibility>3.0</compatibility>
  <author>eXeLearning.net</author>
  <license>Creative Commons by-sa</license>
  <license-url>http://creativecommons.org/licenses/by-sa/3.0/</license-url>
  <description>Example style for eXe.

iDevice icons by…</description>
  <downloadable>1</downloadable>
</theme>
```

### File Fields

- **`name`**: Internal name (ID) and folder name of the style (no spaces or special characters).
- **`title`**: Name displayed in the style selector in eXeLearning.
- **`version`**: Version number of the style.
- **`compatibility`**: eXeLearning version the style is compatible with.
- **`author`**, **`license`**, **`license-url`**: Author and licensing information.
- **`description`**: Style description (may include line breaks).
- **`downloadable`**:  
  - `1` → the style can be imported/downloaded from the interface.  
  - `0` → the style cannot be downloaded or imported from the application.

---

## CSS Files

- Placed in the root folder of the style.
- You may include one or multiple files (`style.css` is required).
- If multiple files exist, they are loaded **in alphabetical order**.

---

## JavaScript (JS) Files

- Placed in the root folder of the style.
- You may include multiple JS files (most styles use a single `style.js`); they are also loaded **alphabetically**.
- JavaScript **does not run inside eXeLearning**, it only runs after exporting the content.

---

## Screenshot (`preview.png`)

- Required name: `preview.png`.  
- Location: root folder.  
- Recommended size: **1200×550 px**.

---

## `icons/` Folder

- Contains images for iDevice icons.  
- Supported formats: `.gif`, `.png`, `.jpg`, `.svg`.  

---

## Optional Files and Folders

You can add other useful folders such as:

- `fonts/` → Fonts (`.woff`, `.woff2`, etc.)  
- `img/` → Additional images.

Example usage in CSS:

```css
#siteNav a {
  background: #191748 url(img/example.svg) no-repeat 8px center;
  padding-left: 42px;
}
```

---

## CSS and Exported Content

All exported content is wrapped in a `<div class="exe-content">`.  
Using this class ensures your CSS does **not interfere with the eXeLearning interface**.

**Incorrect:**
```css
h2 { color: red !important; }
```

**Correct:**
```css
.exe-content h2 { color: red !important; }
```

---

## CSS Classes by Export Type

Each export type adds a CSS class to the `<body>` element:

| Export Type        | Body Class      |
|--------------------|------------------|
| Website            | `exe-web-site`   |
| SCORM              | `exe-scorm`      |
| EPUB               | `exe-epub`       |
| IMS                | `exe-ims`        |
| Single HTML page   | `exe-single-page`|

All export formats also include the general class **`exe-export`**.  
Example:  
```html
<body class="exe-export exe-web-site">
```

---

## JavaScript in Styles

You can use jQuery (already included in exported content).  
Common functionality found in built-in eXe styles:

- Toggle menu visibility.
- Remember menu open/closed state between pages.
- Show/hide the search bar.
- Custom button to enable/disable the **Teacher mode**:
  ```js
  $exeExport.teacherMode.init();
  ```

---

## Final Recommendations

- Export in different formats: **SCORM, Web, Single HTML Page** to test compatibility.
- Adjust your CSS and JS so the style works consistently across all export types.
- Package the style into a `.zip` file:
  - The `.zip` file name must match the `<name>` in `config.xml`.
  - The `.zip` must not contain extra parent folders — all files (`config.xml`, CSS, JS, `icons/`, etc.) must be in the root.

---

### How to Create a New Style Easily

- Download any of the styles included in eXeLearning. Choose the one that most closely resembles what you want to achieve.  
- Unzip the `.zip` folder.  
- Edit the `config.xml` file to modify all the information you need.  
- Follow the steps described in the **"Final Recommendations"** section to complete the creation of your style.

---

## Deployment Information

The styles included by default in eXeLearning are located in:

```
/public/files/perm/themes/base/
```

If you are managing an online instance of eXeLearning, place the folder containing your new styles there and restart the service.

User-installed styles (both in the online version, if allowed by the administrator, and in the desktop version) are stored, for each user, in:

```
/public/files/perm/themes/users/
```
