(function(root, factory) {
  const runtime = factory(root);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = runtime;
  }

  root.eXeBlockIconRuntime = runtime;
})(typeof globalThis !== 'undefined' ? globalThis : window, function(root) {
  const MATERIAL_ICON_FALLBACK = 'help';
  const MATERIAL_ICON_MASK_STYLE = [
    'display:block',
    'width:100%',
    'height:100%',
    'background-color:currentColor',
    '-webkit-mask-repeat:no-repeat',
    'mask-repeat:no-repeat',
    '-webkit-mask-position:center',
    'mask-position:center',
    '-webkit-mask-size:contain',
    'mask-size:contain',
  ].join(';');

  // --- Material icon sprite store -------------------------------------------
  // The vendored Material Symbols set ships as a single sprite file
  // (/libs/material-icons/material-icons.svg); the loose per-icon SVG files were
  // removed to shrink the static editor bundle. We parse the sprite once into
  // memory and rebuild the data: URI for whichever icon a block uses, so the
  // applied icon keeps the exact .exe-material-icon mask-image markup/CSS.
  // The parsing logic is the JS twin of src/shared/material-icons/spriteParser.ts
  // (export pipeline) — keep both in sync.
  const SYMBOL_RE = /<symbol\s+([^>]*?)>([\s\S]*?)<\/symbol>/gi;
  const ID_RE = /\bid="([^"]+)"/i;
  const VIEWBOX_RE = /\bviewBox="([^"]+)"/i;

  let materialIconSymbols = null;
  const materialIconDataUriCache = new Map();

  function parseMaterialIconSprite(spriteText) {
    const symbols = new Map();
    if (!spriteText) return symbols;
    for (const match of spriteText.matchAll(SYMBOL_RE)) {
      const attrs = match[1];
      const id = ID_RE.exec(attrs)?.[1];
      const viewBox = VIEWBOX_RE.exec(attrs)?.[1];
      if (!id || !viewBox) continue;
      symbols.set(id, { viewBox, body: match[2].trim() });
    }
    return symbols;
  }

  function isMaterialSpriteLoaded() {
    return materialIconSymbols !== null && materialIconSymbols.size > 0;
  }

  function loadMaterialSprite(spriteText, options = {}) {
    materialIconSymbols = parseMaterialIconSprite(spriteText);
    materialIconDataUriCache.clear();
    const docRoot = options.root || (typeof document !== 'undefined' ? document : null);
    hydrateMaterialIcons(docRoot, options);
    return materialIconSymbols.size;
  }

  function getMaterialIconDataUri(iconName, options = {}) {
    if (!isMaterialSpriteLoaded()) return null;
    const safeName = sanitizeMaterialIconName(iconName, options.catalog);
    if (materialIconDataUriCache.has(safeName)) {
      return materialIconDataUriCache.get(safeName);
    }
    const symbol = materialIconSymbols.get(safeName) || materialIconSymbols.get(MATERIAL_ICON_FALLBACK);
    if (!symbol) return null;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="${symbol.viewBox}">${symbol.body}</svg>`;
    const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    materialIconDataUriCache.set(safeName, dataUri);
    return dataUri;
  }

  function hydrateMaterialIcons(docRoot, options = {}) {
    if (!docRoot || typeof docRoot.querySelectorAll !== 'function') return 0;
    let count = 0;
    docRoot.querySelectorAll('.exe-material-icon[data-exe-material-icon]').forEach((el) => {
      const dataUri = getMaterialIconDataUri(el.getAttribute('data-exe-material-icon'), options);
      if (dataUri) {
        el.style.setProperty('--exe-material-icon-url', `url('${dataUri}')`);
        el.removeAttribute('data-exe-material-icon');
        count += 1;
      }
    });
    return count;
  }

  function resolveAppAssetUrl(path, options = {}) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const app = options.app || root.eXeLearning?.app;
    const composeUrl = app?.composeUrl;
    if (typeof composeUrl === 'function') {
      return composeUrl.call(app, normalizedPath);
    }

    let config = options.config ?? root.eXeLearning?.config;
    if (typeof config === 'string') {
      try {
        config = JSON.parse(config);
      } catch {
        config = null;
      }
    }

    const basePath = config?.basePath || root.eXeLearning?.symfony?.basePath || '';
    const cleanBasePath = !basePath || basePath === '/' ? '' : basePath.replace(/\/+$/, '');
    return cleanBasePath ? `${cleanBasePath}${normalizedPath}` : normalizedPath;
  }

  function sanitizeMaterialIconName(iconName, catalog) {
    if (!iconName) return MATERIAL_ICON_FALLBACK;
    if (!Array.isArray(catalog) || catalog.includes(iconName)) {
      return iconName;
    }
    return MATERIAL_ICON_FALLBACK;
  }

  // Derive a structured block-icon descriptor from a legacy iconName string.
  // JS twin of src/shared/block-icon.ts (deriveBlockIcon) — keep both in sync.
  function deriveBlockIcon(iconName) {
    const name = iconName == null ? '' : String(iconName);
    if (!name) return { source: 'none', value: '' };
    if (name.startsWith('mi-')) return { source: 'material', value: name.slice(3) };
    if (name.startsWith('asset://') || name.startsWith('/')) return { source: 'asset', value: name };
    return { source: 'theme', value: name };
  }

  function renderMaterialMaskIcon(iconName, options = {}) {
    const dataUri = getMaterialIconDataUri(iconName, options);
    if (dataUri) {
      return `<span class="exe-material-icon" style="--exe-material-icon-url:url('${dataUri}');" aria-hidden="true"></span>`;
    }
    // Sprite not loaded yet: emit a placeholder that loadMaterialSprite() hydrates
    // once the sprite arrives. Keeps the exact .exe-material-icon markup/CSS.
    const pendingName = sanitizeMaterialIconName(iconName, options.catalog).replace(/[^a-z0-9_-]/gi, '');
    return `<span class="exe-material-icon" data-exe-material-icon="${pendingName}" aria-hidden="true"></span>`;
  }

  return {
    MATERIAL_ICON_FALLBACK,
    MATERIAL_ICON_MASK_STYLE,
    resolveAppAssetUrl,
    deriveBlockIcon,
    renderMaterialMaskIcon,
    parseMaterialIconSprite,
    loadMaterialSprite,
    isMaterialSpriteLoaded,
    getMaterialIconDataUri,
    hydrateMaterialIcons,
  };
});
