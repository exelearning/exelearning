# Customization

Educators and admins can safely apply CSS/JS customizations without modifying core code.

## Custom CSS (Look & Feel)

- Path: `/public/style/workarea/custom.css`
- Add your overrides here to change fonts, colors, spacing, etc.

Example

```css
/* Accent color */
:root { --exe-accent: #1769aa; }

/* Toolbar tweaks */
.exe-toolbar button { border-radius: 6px; }
```

## Custom JavaScript

- Path: `/public/app/workarea/custom.js`
- jQuery is available.
- The `eXeLearning` global object exists only in the work area (not on login or error pages).
- When the app is ready, it calls `$eXeLearningCustom.init()` if defined.

Example

```js
window.$eXeLearningCustom = {
  init() {
    console.log('Custom script loaded');
    // Example: add a keyboard shortcut
    $(document).on('keydown', (e) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        window.eXeLearning?.actions?.saveDocument?.();
      }
    });
  }
};
```

## Guidelines

- Do not edit core files; keep changes in the custom files above.
- Keep scripts small and self‑contained; avoid blocking calls.
- Test in a staging environment before rolling out to users.

---

## See Also

- Developer environment: [development/environment.md](environment.md)
