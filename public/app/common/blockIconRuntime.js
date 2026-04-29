(function(root, factory) {
  const runtime = factory(root);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = runtime;
  }

  root.eXeBlockIconRuntime = runtime;
})(typeof globalThis !== 'undefined' ? globalThis : window, function(root) {
  const BOOTSTRAP_ICON_FALLBACK = 'question-circle';
  const BOOTSTRAP_ICON_MASK_STYLE = [
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

  function sanitizeBootstrapIconName(iconName, catalog) {
    if (!iconName) return BOOTSTRAP_ICON_FALLBACK;
    if (!Array.isArray(catalog) || catalog.includes(iconName)) {
      return iconName;
    }
    return BOOTSTRAP_ICON_FALLBACK;
  }

  function getBootstrapIconPath(iconName, options = {}) {
    const safeIconName = sanitizeBootstrapIconName(iconName, options.catalog);
    return resolveAppAssetUrl(`/libs/bootstrap-icons/icons/${safeIconName}.svg`, options);
  }

  function renderBootstrapMaskIcon(iconName, options = {}) {
    const iconPath = getBootstrapIconPath(iconName, options);
    return `<span class="exe-bootstrap-icon" style="--exe-bootstrap-icon-url:url('${iconPath}');" aria-hidden="true"></span>`;
  }

  return {
    BOOTSTRAP_ICON_FALLBACK,
    BOOTSTRAP_ICON_MASK_STYLE,
    resolveAppAssetUrl,
    getBootstrapIconPath,
    renderBootstrapMaskIcon,
  };
});
