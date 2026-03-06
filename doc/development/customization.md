# Customization

There are two complementary approaches depending on your deployment type:

| Approach | How | Works in static mode | Requires server |
|---|---|---|---|
| **Custom files** | Edit `custom.css` / `custom.js` on the filesystem | Yes | No |
| **Admin panel** | Admin → Customization → Custom HEAD HTML | No | Yes |

---

## Option A: Custom Files (filesystem / static mode)

For sysadmins with filesystem access, Docker volume mounts, or static deployments where there is no server or database.

### Custom CSS

- Path: `public/style/workarea/custom.css`
- Loaded on all user-facing pages (login, workarea, error pages).
- Add overrides here to change fonts, colors, spacing, etc.

```css
/* Accent color */
:root { --exe-accent: #1769aa; }

/* Toolbar tweaks */
.exe-toolbar button { border-radius: 6px; }
```

### Custom JavaScript

- Path: `public/app/workarea/custom.js`
- Loaded on all user-facing pages.
- jQuery is always available.
- `window.eXeLearning` is only available in the workarea (not on login or error pages).
- When the app is fully ready, it calls `window.$eXeLearningCustom.init()` if defined.
- If `window.$eXeLearningCustom` is already defined (e.g. via the Admin panel), this file will not overwrite it.

```js
/* Add your JavaScript code here */
jQuery(function () {
  // Runs when the DOM is loaded (all pages)
});
window.$eXeLearningCustom = {
  init() {
    // Runs when the workarea app is fully initialized
    console.log('eXeLearning is ready!');
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

---

## Option B: Admin Panel (server mode only)

For admins who have web access to the admin panel but not to the server filesystem. Requires a running server with database support.

**Admin → Customization → Custom HEAD HTML**

The content is injected into the `<head>` of all user-facing pages (login, workarea, error pages). It is not injected into the admin panel itself.

Supports any valid HTML head element: `<style>`, `<script>`, `<link>`, `<meta>`, etc.

```html
<!-- Custom styles -->
<style>
  :root { --exe-accent: #1769aa; }
</style>

<!-- External analytics -->
<script src="https://example.com/analytics.js" defer></script>

<!-- Custom JS hook (workarea only) -->
<script>
jQuery(function () {
  // Runs when the DOM is loaded (all pages)
});
window.$eXeLearningCustom = {
  init() {
    // Runs when the workarea app is fully initialized
    console.log('eXeLearning is ready!');
  }
};
</script>
```

> **Note:** `window.$eXeLearningCustom` defined here takes precedence over `public/app/workarea/custom.js`, which will not overwrite it.

---

## Guidelines

- Keep scripts small and self-contained; avoid blocking calls.
- Test in a staging environment before rolling out to users.
- Do not edit other core files for customization purposes.

---

## See Also

- Developer environment: [development/environment.md](environment.md)
