(() => {
  // src/shared/export/adapters/YjsDocumentAdapter.ts
  var YjsDocumentAdapter = class {
    /**
     * Create adapter from YjsDocumentManager
     * @param manager - Active YjsDocumentManager instance
     */
    constructor(manager) {
      this.manager = manager;
    }
    /**
     * Get export metadata from Y.Map
     * @returns Export metadata
     */
    getMetadata() {
      const meta = this.manager.getMetadata();
      return {
        title: meta.get("title") || "eXeLearning",
        author: meta.get("author") || "",
        description: meta.get("description") || "",
        language: meta.get("language") || "en",
        license: meta.get("license") || "",
        keywords: meta.get("keywords") || "",
        theme: meta.get("theme") || "base",
        version: meta.get("version") || "4.0",
        created: meta.get("createdAt") || (/* @__PURE__ */ new Date()).toISOString(),
        modified: meta.get("modifiedAt") || (/* @__PURE__ */ new Date()).toISOString(),
        // Custom styles support
        customStyles: meta.get("customStyles") || void 0,
        // Export options (values stored as strings 'true'/'false' in Yjs)
        addExeLink: this.parseBoolean(meta.get("addExeLink"), true),
        // Default: true
        addPagination: this.parseBoolean(meta.get("addPagination"), false),
        addSearchBox: this.parseBoolean(meta.get("addSearchBox"), false),
        addAccessibilityToolbar: this.parseBoolean(meta.get("addAccessibilityToolbar"), false),
        exportSource: this.parseBoolean(meta.get("exportSource"), true),
        // Default: true
        // Custom content
        extraHeadContent: meta.get("extraHeadContent") || void 0,
        footer: meta.get("footer") || void 0
      };
    }
    /**
     * Parse boolean value from Yjs storage
     * Values may be stored as strings 'true'/'false' or actual booleans
     * @param value - Value to parse
     * @param defaultValue - Default value if not found
     * @returns Boolean value
     */
    parseBoolean(value, defaultValue) {
      if (value === void 0 || value === null) return defaultValue;
      if (typeof value === "boolean") return value;
      if (typeof value === "string") return value.toLowerCase() === "true";
      return defaultValue;
    }
    /**
     * Get navigation structure as flat array of pages
     * @returns Array of export pages
     */
    getNavigation() {
      const navigation = this.manager.getNavigation();
      const pages = [];
      this.flattenNavigation(navigation, pages);
      return pages;
    }
    /**
     * Recursively flatten navigation structure
     * @param navigation - Y.Array of pages
     * @param result - Result array to populate
     */
    flattenNavigation(navigation, result) {
      navigation.forEach((pageMap) => {
        const page = this.convertPage(pageMap);
        result.push(page);
        const children = pageMap.get("children");
        if (children && children.length > 0) {
          this.flattenNavigation(children, result);
        }
      });
    }
    /**
     * Convert a Y.Map page to ExportPage format
     * @param pageMap - Y.Map representing a page
     * @returns Export page
     */
    convertPage(pageMap) {
      const blocksArray = pageMap.get("blocks");
      const blocks = [];
      if (blocksArray) {
        blocksArray.forEach((blockMap, index) => {
          blocks.push(this.convertBlock(blockMap, index));
        });
      }
      return {
        id: pageMap.get("id") || pageMap.get("pageId") || "",
        title: pageMap.get("title") || pageMap.get("pageName") || "Page",
        parentId: pageMap.get("parentId") || null,
        order: pageMap.get("order") || 0,
        blocks
      };
    }
    /**
     * Convert a Y.Map block to ExportBlock format
     * @param blockMap - Y.Map representing a block
     * @param index - Block index for ordering
     * @returns Export block
     */
    convertBlock(blockMap, index) {
      const componentsArray = blockMap.get("components");
      const components = [];
      if (componentsArray) {
        componentsArray.forEach((compMap, compIndex) => {
          components.push(this.convertComponent(compMap, compIndex));
        });
      }
      return {
        id: blockMap.get("id") || `block-${index}`,
        name: blockMap.get("name") || blockMap.get("blockName") || "",
        order: blockMap.get("order") || index,
        components
      };
    }
    /**
     * Convert a Y.Map component to ExportComponent format
     * @param compMap - Y.Map representing a component (iDevice)
     * @param index - Component index for ordering
     * @returns Export component
     */
    convertComponent(compMap, index) {
      let content = compMap.get("content") || compMap.get("htmlContent") || compMap.get("htmlView") || "";
      if (content && typeof content === "object" && "toString" in content) {
        content = content.toString();
      }
      const propsMap = compMap.get("properties");
      const properties = propsMap ? propsMap.toJSON() : {};
      return {
        id: compMap.get("id") || `comp-${index}`,
        type: compMap.get("type") || compMap.get("ideviceType") || "FreeTextIdevice",
        order: compMap.get("order") || index,
        content,
        properties
      };
    }
    /**
     * Get all unique iDevice types used in the document
     * @returns Array of iDevice type names
     */
    getUsedIdeviceTypes() {
      const types = /* @__PURE__ */ new Set();
      const pages = this.getNavigation();
      for (const page of pages) {
        for (const block of page.blocks) {
          for (const comp of block.components) {
            if (comp.type) {
              types.add(comp.type);
            }
          }
        }
      }
      return Array.from(types);
    }
    /**
     * Get combined HTML content from all pages (for library detection)
     * @returns Combined HTML string
     */
    getAllHtmlContent() {
      const htmlParts = [];
      const pages = this.getNavigation();
      for (const page of pages) {
        for (const block of page.blocks) {
          for (const comp of block.components) {
            if (comp.content) {
              htmlParts.push(comp.content);
            }
          }
        }
      }
      return htmlParts.join("\n");
    }
  };

  // src/shared/export/browser/idevice-config-browser.ts
  function getIdeviceConfig(type) {
    const normalized = type.replace(/Idevice$/i, "").replace(/([A-Z])/g, "-$1").toLowerCase().replace(/^-/, "");
    const typeMap = {
      "text": "text",
      "freetext": "text",
      "freetextfpd": "text",
      "generic": "text",
      "reflection": "text",
      "reflectionfpd": "text",
      "multi-choice": "multi-choice",
      "multichoice": "multi-choice",
      "true-false": "true-false",
      "truefalse": "true-false",
      "cloze": "cloze",
      "clozeactivity": "cloze",
      "case-study": "case-study",
      "casestudy": "case-study"
    };
    const cssClass = typeMap[normalized] || normalized || "text";
    return {
      cssClass,
      componentType: "html",
      // Default to HTML for browser rendering
      template: `${cssClass}.html`
    };
  }

  // src/shared/export/constants.ts
  var LIBRARY_PATTERNS = [
    // Effects library (animations, transitions)
    {
      name: "exe_effects",
      type: "class",
      pattern: "exe-fx",
      files: ["exe_effects/exe_effects.js", "exe_effects/exe_effects.css"]
    },
    // Games library
    {
      name: "exe_games",
      type: "class",
      pattern: "exe-game",
      files: ["exe_games/exe_games.js", "exe_games/exe_games.css"]
    },
    // Code highlighting
    {
      name: "exe_highlighter",
      type: "class",
      pattern: "highlighted-code",
      files: ["exe_highlighter/exe_highlighter.js", "exe_highlighter/exe_highlighter.css"]
    },
    // Lightbox for images
    {
      name: "exe_lightbox",
      type: "rel",
      pattern: "lightbox",
      files: ["exe_lightbox/exe_lightbox.js", "exe_lightbox/exe_lightbox.css"]
    },
    // Lightbox for image galleries
    {
      name: "exe_lightbox_gallery",
      type: "class",
      pattern: "imageGallery",
      files: ["exe_lightbox/exe_lightbox.js", "exe_lightbox/exe_lightbox.css"]
    },
    // Tooltips (qTip2)
    {
      name: "exe_tooltips",
      type: "class",
      pattern: "exe-tooltip",
      files: [
        "exe_tooltips/exe_tooltips.js",
        "exe_tooltips/jquery.qtip.min.js",
        "exe_tooltips/jquery.qtip.min.css",
        "exe_tooltips/imagesloaded.pkg.min.js"
      ]
    },
    // Image magnifier
    {
      name: "exe_magnify",
      type: "class",
      pattern: "ImageMagnifierIdevice",
      files: ["exe_magnify/mojomagnify.js"]
    },
    // Wikipedia content styling
    {
      name: "exe_wikipedia",
      type: "class",
      pattern: "exe-wikipedia-content",
      files: ["exe_wikipedia/exe_wikipedia.css"]
    },
    // Media player (MediaElement.js)
    {
      name: "exe_media",
      type: "class",
      pattern: "mediaelement",
      files: [
        "exe_media/exe_media.js",
        "exe_media/exe_media.css",
        "exe_media/exe_media_background.png",
        "exe_media/exe_media_bigplay.png",
        "exe_media/exe_media_bigplay.svg",
        "exe_media/exe_media_controls.png",
        "exe_media/exe_media_controls.svg",
        "exe_media/exe_media_loading.gif"
      ]
    },
    // Media player via audio/video file links with lightbox
    {
      name: "exe_media_link",
      type: "regex",
      pattern: /href="[^"]*\.(mp3|mp4|flv|ogg|ogv)"[^>]*rel="[^"]*lightbox/i,
      files: [
        "exe_media/exe_media.js",
        "exe_media/exe_media.css",
        "exe_media/exe_media_background.png",
        "exe_media/exe_media_bigplay.png",
        "exe_media/exe_media_bigplay.svg",
        "exe_media/exe_media_controls.png",
        "exe_media/exe_media_controls.svg",
        "exe_media/exe_media_loading.gif"
      ]
    },
    // ABC Music notation (abcjs)
    {
      name: "abcjs",
      type: "class",
      pattern: "abc-music",
      files: ["abcjs/abcjs-basic-min.js", "abcjs/exe_abc_music.js", "abcjs/abcjs-audio.css"]
    },
    // LaTeX math expressions (MathJax)
    {
      name: "exe_math",
      type: "regex",
      pattern: /\\\(|\\\[/,
      files: ["exe_math/tex-mml-svg.js"]
    },
    // DataGame with encrypted LaTeX (special case)
    {
      name: "exe_math_datagame",
      type: "class",
      pattern: "DataGame",
      files: ["exe_math/tex-mml-svg.js"],
      requiresLatexCheck: true
    },
    // Mermaid diagrams
    {
      name: "mermaid",
      type: "class",
      pattern: "mermaid",
      files: ["mermaid/mermaid.min.js"]
    },
    // jQuery UI for sortable/draggable iDevices
    {
      name: "jquery_ui_ordena",
      type: "class",
      pattern: "ordena-IDevice",
      files: ["jquery-ui/jquery-ui.min.js"]
    },
    {
      name: "jquery_ui_clasifica",
      type: "class",
      pattern: "clasifica-IDevice",
      files: ["jquery-ui/jquery-ui.min.js"]
    },
    {
      name: "jquery_ui_relaciona",
      type: "class",
      pattern: "relaciona-IDevice",
      files: ["jquery-ui/jquery-ui.min.js"]
    },
    {
      name: "jquery_ui_dragdrop",
      type: "class",
      pattern: "dragdrop-IDevice",
      files: ["jquery-ui/jquery-ui.min.js"]
    },
    {
      name: "jquery_ui_completa",
      type: "class",
      pattern: "completa-IDevice",
      files: ["jquery-ui/jquery-ui.min.js"]
    },
    // Accessibility toolbar
    {
      name: "exe_atools",
      type: "class",
      pattern: "exe-atools",
      files: ["exe_atools/exe_atools.js", "exe_atools/exe_atools.css"]
    },
    // ELPX download support (for download-source-file iDevice)
    // Includes fflate for client-side ZIP generation
    {
      name: "exe_elpx_download",
      type: "class",
      pattern: "exe-download-package-link",
      files: ["fflate/fflate.umd.js", "exe_elpx_download.js"]
    }
  ];
  var BASE_LIBRARIES = [
    // jQuery
    "jquery/jquery.min.js",
    // Common eXe scripts
    "common_i18n.js",
    "common.js",
    "exe_export.js",
    // Bootstrap (JS bundle includes Popper)
    "bootstrap/bootstrap.bundle.min.js",
    "bootstrap/bootstrap.bundle.min.js.map",
    "bootstrap/bootstrap.min.css",
    "bootstrap/bootstrap.min.css.map"
  ];
  var SCORM_LIBRARIES = ["scorm/SCORM_API_wrapper.js", "scorm/SCOFunctions.js"];
  var SCORM_12_NAMESPACES = {
    imscp: "http://www.imsproject.org/xsd/imscp_rootv1p1p2",
    adlcp: "http://www.adlnet.org/xsd/adlcp_rootv1p2",
    imsmd: "http://www.imsglobal.org/xsd/imsmd_v1p2",
    xsi: "http://www.w3.org/2001/XMLSchema-instance"
  };
  var SCORM_2004_NAMESPACES = {
    imscp: "http://www.imsglobal.org/xsd/imscp_v1p1",
    adlcp: "http://www.adlnet.org/xsd/adlcp_v1p3",
    adlseq: "http://www.adlnet.org/xsd/adlseq_v1p3",
    adlnav: "http://www.adlnet.org/xsd/adlnav_v1p3",
    imsss: "http://www.imsglobal.org/xsd/imsss",
    xsi: "http://www.w3.org/2001/XMLSchema-instance"
  };
  var IMS_NAMESPACES = {
    imscp: "http://www.imsglobal.org/xsd/imscp_v1p1",
    imsmd: "http://www.imsglobal.org/xsd/imsmd_v1p2",
    xsi: "http://www.w3.org/2001/XMLSchema-instance"
  };
  var LOM_NAMESPACES = {
    lom: "http://ltsc.ieee.org/xsd/LOM",
    xsi: "http://www.w3.org/2001/XMLSchema-instance"
  };
  var IDEVICE_TYPE_MAP = {
    // Text/FreeText variations
    freetext: "text",
    text: "text",
    freetextidevice: "text",
    textidevice: "text",
    // Spanish → English mappings
    adivina: "guess",
    "adivina-activity": "guess",
    listacotejo: "checklist",
    "listacotejo-activity": "checklist",
    ordena: "sort",
    clasifica: "classify",
    relaciona: "relate",
    completa: "complete",
    // Plural → singular
    rubrics: "rubric",
    // Alternative names
    "download-package": "download-source-file",
    "pbl-tools": "udl-content",
    // PBL tools maps to UDL content
    // Quiz variants
    selecciona: "quick-questions-multiple-choice",
    "selecciona-activity": "quick-questions-multiple-choice",
    quiz: "quick-questions",
    "quiz-activity": "quick-questions",
    // Game variants
    "quiz-game": "az-quiz-game",
    trivialquiz: "trivial",
    // Interactive variants
    "before-after": "beforeafter",
    "image-magnifier": "magnifier",
    "word-puzzle": "word-search",
    "palabras-puzzle": "word-search",
    "sopa-de-letras": "word-search",
    // Case study variants
    "case-study": "casestudy",
    "estudio-de-caso": "casestudy",
    // Example/model variants
    ejemplo: "example",
    modelo: "example",
    // Challenge variants
    reto: "challenge",
    desafio: "challenge",
    // External website variants
    "sitio-externo": "external-website",
    "web-externa": "external-website",
    // Form variants
    formulario: "form",
    // Flipcards variants
    tarjetas: "flipcards",
    "flash-cards": "flipcards",
    // Image gallery variants
    galeria: "image-gallery",
    "galeria-imagenes": "image-gallery",
    // Crossword variants
    crucigrama: "crossword",
    // Puzzle variants
    rompecabezas: "puzzle",
    // Map variants
    mapa: "map",
    // Discover variants
    descubre: "discover",
    // Identify variants
    identifica: "identify",
    // Hidden image variants
    "imagen-oculta": "hidden-image",
    // Padlock variants
    candado: "padlock",
    // Periodic table variants
    "tabla-periodica": "periodic-table",
    // Progress report variants
    "informe-progreso": "progress-report",
    // Scrambled list variants
    "lista-desordenada": "scrambled-list",
    // True/false variants
    verdaderofalso: "trueorfalse",
    "verdadero-falso": "trueorfalse",
    // Interactive video variants
    "video-interactivo": "interactive-video",
    // Collaborative editing
    "edicion-colaborativa": "collaborative-editing",
    // Dragdrop variants
    "arrastrar-soltar": "dragdrop",
    // Attached files variants
    "archivos-adjuntos": "attached-files",
    // Select media files variants
    "seleccionar-archivos": "select-media-files",
    // Math operations variants
    "operaciones-matematicas": "mathematicaloperations",
    // Math problems variants
    "problemas-matematicos": "mathproblems",
    // GeoGebra variants
    geogebra: "geogebra-activity"
  };
  function normalizeIdeviceType(typeName) {
    if (!typeName) return "text";
    let normalized = typeName.toLowerCase();
    normalized = normalized.replace(/-?idevice$/i, "");
    return IDEVICE_TYPE_MAP[normalized] || normalized || "text";
  }

  // src/shared/export/adapters/BrowserResourceProvider.ts
  var BrowserResourceProvider = class {
    /**
     * Create provider with ResourceFetcher instance
     * @param fetcher - ResourceFetcher instance
     */
    constructor(fetcher) {
      this.fetcher = fetcher;
    }
    /**
     * Fetch theme files
     * @param themeName - Theme name (e.g., 'base', 'blue')
     * @returns Map of path -> content
     */
    async fetchTheme(themeName) {
      const blobMap = await this.fetcher.fetchTheme(themeName);
      return this.convertBlobMapToUint8ArrayMap(blobMap);
    }
    /**
     * Fetch iDevice resources
     * @param ideviceType - iDevice type name
     * @returns Map of path -> content
     */
    async fetchIdeviceResources(ideviceType) {
      const blobMap = await this.fetcher.fetchIdevice(ideviceType);
      return this.convertBlobMapToUint8ArrayMap(blobMap);
    }
    /**
     * Fetch base libraries (jQuery, common.js, etc.)
     * @returns Map of path -> content
     */
    async fetchBaseLibraries() {
      const blobMap = await this.fetcher.fetchBaseLibraries();
      return this.convertBlobMapToUint8ArrayMap(blobMap);
    }
    /**
     * Fetch SCORM-specific files
     * @returns Map of path -> content
     */
    async fetchScormFiles() {
      const blobMap = await this.fetcher.fetchScormFiles();
      return this.convertBlobMapToUint8ArrayMap(blobMap);
    }
    /**
     * Fetch specific library files by path
     * @param files - Array of file paths
     * @returns Map of path -> content
     */
    async fetchLibraryFiles(files) {
      const blobMap = await this.fetcher.fetchLibraryFiles(files);
      return this.convertBlobMapToUint8ArrayMap(blobMap);
    }
    /**
     * Fetch all files in a library directory
     * @param libraryName - Library name (e.g., 'exe_effects')
     * @returns Map of path -> content
     */
    async fetchLibraryDirectory(libraryName) {
      const blobMap = await this.fetcher.fetchLibraryDirectory(libraryName);
      return this.convertBlobMapToUint8ArrayMap(blobMap);
    }
    /**
     * Fetch schema files for a format
     * @param format - Format name (scorm12, scorm2004, ims, epub3)
     * @returns Map of path -> content
     */
    async fetchSchemas(format) {
      const blobMap = await this.fetcher.fetchSchemas(format);
      return this.convertBlobMapToUint8ArrayMap(blobMap);
    }
    /**
     * Normalize iDevice type name to directory name
     * @param ideviceType - Raw iDevice type name (e.g., 'FreeTextIdevice')
     * @returns Normalized directory name (e.g., 'text')
     */
    normalizeIdeviceType(ideviceType) {
      return normalizeIdeviceType(ideviceType);
    }
    /**
     * Fetch the eXeLearning "powered by" logo
     * @returns Logo image as Uint8Array, or null if not found
     */
    async fetchExeLogo() {
      const blob = await this.fetcher.fetchExeLogo();
      if (blob) {
        const arrayBuffer = await blob.arrayBuffer();
        return new Uint8Array(arrayBuffer);
      }
      return null;
    }
    /**
     * Convert Map<string, Blob> to Map<string, Uint8Array>
     * In browser, we convert Blob to ArrayBuffer then to Uint8Array
     * @param blobMap - Map of path -> Blob
     * @returns Map of path -> Uint8Array
     */
    async convertBlobMapToUint8ArrayMap(blobMap) {
      const result = /* @__PURE__ */ new Map();
      const entries = Array.from(blobMap.entries());
      const conversions = entries.map(async ([path, blob]) => {
        const arrayBuffer = await blob.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        return { path, data };
      });
      const converted = await Promise.all(conversions);
      for (const { path, data } of converted) {
        result.set(path, data);
      }
      return result;
    }
  };

  // src/shared/export/adapters/BrowserAssetProvider.ts
  var BrowserAssetProvider = class {
    /**
     * Create provider with AssetCacheManager and/or AssetManager instance
     * @param assetCache - AssetCacheManager instance (legacy, optional)
     * @param assetManager - AssetManager instance (preferred, optional)
     *
     * Note: At least one of assetCache or assetManager should be provided.
     * AssetManager is preferred for getAllAssets() as it contains the actual imported assets.
     */
    constructor(assetCache, assetManager = null) {
      this.assetCache = assetCache;
      this.assetManager = assetManager;
    }
    /**
     * Get asset data by path/id
     * @param assetId - Asset path or ID (e.g., 'abc123/image.png')
     * @returns ExportAsset or null if not found
     */
    async getAsset(assetId) {
      try {
        if (this.assetManager?.getAsset) {
          const asset = await this.assetManager.getAsset(assetId);
          if (asset && asset.blob) {
            const arrayBuffer = await asset.blob.arrayBuffer();
            return {
              id: asset.id,
              filename: assetId.split("/").pop() || "unknown",
              originalPath: assetId,
              mime: asset.mime || "application/octet-stream",
              data: new Uint8Array(arrayBuffer)
            };
          }
        }
        if (this.assetCache) {
          const cached = await this.assetCache.getAssetByPath(assetId);
          if (cached && cached.blob) {
            const arrayBuffer = await cached.blob.arrayBuffer();
            const filename = cached.metadata?.filename || assetId.split("/").pop() || "unknown";
            return {
              id: assetId,
              filename,
              originalPath: assetId,
              mime: cached.metadata?.mimeType || "application/octet-stream",
              data: new Uint8Array(arrayBuffer)
            };
          }
        }
        return null;
      } catch (error) {
        console.warn(`[BrowserAssetProvider] Failed to get asset: ${assetId}`, error);
        return null;
      }
    }
    /**
     * Check if an asset exists
     * @param assetPath - Asset path
     * @returns true if asset exists
     */
    async hasAsset(assetPath) {
      try {
        if (this.assetManager?.getAsset) {
          const asset = await this.assetManager.getAsset(assetPath);
          if (asset && asset.blob) {
            return true;
          }
        }
        if (this.assetCache) {
          const cached = await this.assetCache.getAssetByPath(assetPath);
          return cached !== null && cached.blob !== void 0;
        }
        return false;
      } catch {
        return false;
      }
    }
    /**
     * List all available assets
     * @returns Array of asset paths
     */
    async listAssets() {
      try {
        if (this.assetManager) {
          const assets = await this.assetManager.getProjectAssets();
          return assets.filter((a) => a.originalPath || a.filename).map((a) => a.originalPath || `${a.id}/${a.filename}`);
        }
        if (this.assetCache) {
          const assets = await this.assetCache.getAllAssets();
          return assets.filter((a) => a.metadata?.originalPath).map((a) => a.metadata.originalPath);
        }
        return [];
      } catch (error) {
        console.warn("[BrowserAssetProvider] Failed to list assets:", error);
        return [];
      }
    }
    /**
     * Get all assets as ExportAsset array
     * This is the main method used for exports - it retrieves all project assets
     * and converts them to the ExportAsset format.
     *
     * @returns Array of ExportAsset
     */
    async getAllAssets() {
      const result = [];
      try {
        if (this.assetManager) {
          const assets = await this.assetManager.getProjectAssets();
          console.log(`[BrowserAssetProvider] Found ${assets.length} assets from AssetManager`);
          for (const asset of assets) {
            if (asset.blob) {
              const arrayBuffer = await asset.blob.arrayBuffer();
              const assetId = String(asset.id);
              const filename = asset.filename || `asset-${assetId}`;
              let originalPath;
              if (asset.originalPath && asset.originalPath.includes(assetId)) {
                originalPath = asset.originalPath;
              } else {
                originalPath = `${assetId}/${filename}`;
              }
              result.push({
                id: assetId,
                filename,
                originalPath,
                mime: asset.mime || "application/octet-stream",
                data: new Uint8Array(arrayBuffer)
              });
            }
          }
          if (result.length > 0) {
            console.log(`[BrowserAssetProvider] Converted ${result.length} assets for export`);
            return result;
          }
        }
        if (this.assetCache) {
          const assets = await this.assetCache.getAllAssets();
          console.log(`[BrowserAssetProvider] Found ${assets.length} assets from AssetCacheManager (legacy)`);
          for (const asset of assets) {
            if (asset.blob) {
              const arrayBuffer = await asset.blob.arrayBuffer();
              const assetId = String(asset.assetId);
              const filename = asset.metadata?.filename || `asset-${assetId}`;
              const originalPath = asset.metadata?.originalPath || `${assetId}/${filename}`;
              result.push({
                id: assetId,
                filename,
                originalPath,
                mime: asset.metadata?.mimeType || "application/octet-stream",
                data: new Uint8Array(arrayBuffer)
              });
            }
          }
        }
      } catch (error) {
        console.warn("[BrowserAssetProvider] Failed to get all assets:", error);
      }
      return result;
    }
    /**
     * Get all project assets (alias for getAllAssets)
     * @returns Array of ExportAsset
     */
    async getProjectAssets() {
      return this.getAllAssets();
    }
    /**
     * Resolve asset URL for preview (returns blob URL)
     * @param assetPath - Asset path
     * @returns Blob URL or null
     */
    async resolveAssetUrl(assetPath) {
      try {
        if (this.assetManager?.resolveAssetURL) {
          const url = await this.assetManager.resolveAssetURL(assetPath);
          if (url) return url;
        }
        if (this.assetCache) {
          return await this.assetCache.resolveAssetUrl(assetPath);
        }
        return null;
      } catch {
        return null;
      }
    }
  };

  // src/shared/export/adapters/ExportAssetResolver.ts
  var ExportAssetResolver = class _ExportAssetResolver {
    constructor(options = {}) {
      this.basePath = options.basePath ?? "";
      this.resourceDir = options.resourceDir ?? "content/resources";
    }
    /**
     * Resolve a single asset URL
     */
    resolve(assetUrl) {
      return this.resolveSync(assetUrl);
    }
    /**
     * Synchronous resolution
     */
    resolveSync(assetUrl) {
      if (assetUrl.startsWith("blob:") || assetUrl.startsWith("data:")) {
        return assetUrl;
      }
      if (assetUrl.startsWith("asset://")) {
        const assetPath = assetUrl.slice("asset://".length);
        return `${this.basePath}${this.resourceDir}/${assetPath}`;
      }
      if (assetUrl.includes("{{context_path}}")) {
        return assetUrl.replace("{{context_path}}/", `${this.basePath}${this.resourceDir}/`);
      }
      return assetUrl;
    }
    /**
     * Process HTML content, resolving all asset URLs
     */
    processHtml(html) {
      return this.processHtmlSync(html);
    }
    /**
     * Synchronous HTML processing
     */
    processHtmlSync(html) {
      if (!html) return "";
      let result = html;
      result = result.replace(/\{\{context_path\}\}\/([^"'\s]+)/g, (_match, assetPath) => {
        if (assetPath.startsWith("blob:") || assetPath.startsWith("data:")) {
          return _match;
        }
        return `${this.basePath}${this.resourceDir}/${assetPath}`;
      });
      result = result.replace(/asset:\/\/([^"']+)/g, (_match, assetPath) => {
        if (assetPath.startsWith("blob:") || assetPath.startsWith("data:")) {
          return _match;
        }
        return `${this.basePath}${this.resourceDir}/${assetPath}`;
      });
      result = result.replace(/files\/tmp\/[^"'\s]+\/([^/]+\/[^"'\s]+)/g, (_match, relativePath) => {
        if (relativePath.startsWith("blob:") || relativePath.startsWith("data:")) {
          return _match;
        }
        return `${this.basePath}${this.resourceDir}/${relativePath}`;
      });
      result = result.replace(/["']\/files\/tmp\/[^"']+\/([^"']+)["']/g, (_match, path) => {
        if (path.startsWith("blob:") || path.startsWith("data:")) {
          return _match;
        }
        return `"${this.basePath}${this.resourceDir}/${path}"`;
      });
      return result;
    }
    /**
     * Create a new resolver with a different base path
     */
    withBasePath(basePath) {
      return new _ExportAssetResolver({
        basePath,
        resourceDir: this.resourceDir
      });
    }
  };

  // src/shared/export/adapters/PreviewAssetResolver.ts
  var PreviewAssetResolver = class {
    constructor(assetManager, options = {}) {
      this.assetManager = assetManager;
      this.basePath = options.basePath ?? "";
      this.resolvedUrls = /* @__PURE__ */ new Map();
    }
    /**
     * Resolve a single asset URL (async)
     * Looks up the asset in the cache and returns a blob URL
     */
    async resolve(assetUrl) {
      if (assetUrl.startsWith("blob:") || assetUrl.startsWith("data:")) {
        return assetUrl;
      }
      if (assetUrl.startsWith("asset://")) {
        const assetPath = assetUrl.slice("asset://".length);
        const slashIndex = assetPath.indexOf("/");
        const assetId = slashIndex > 0 ? assetPath.slice(0, slashIndex) : assetPath;
        const cached = this.resolvedUrls.get(assetId);
        if (cached) {
          return cached;
        }
        try {
          const blobUrl = await this.assetManager.resolveAssetUrl(assetId);
          if (blobUrl) {
            this.resolvedUrls.set(assetId, blobUrl);
            return blobUrl;
          }
        } catch {
        }
      }
      return assetUrl;
    }
    /**
     * Synchronous resolution (returns cached blob URL or original URL)
     * Use this when you need sync behavior and assets were pre-resolved
     */
    resolveSync(assetUrl) {
      if (assetUrl.startsWith("blob:") || assetUrl.startsWith("data:")) {
        return assetUrl;
      }
      if (assetUrl.startsWith("asset://")) {
        const assetPath = assetUrl.slice("asset://".length);
        const slashIndex = assetPath.indexOf("/");
        const assetId = slashIndex > 0 ? assetPath.slice(0, slashIndex) : assetPath;
        const cached = this.resolvedUrls.get(assetId);
        if (cached) {
          return cached;
        }
        const syncUrl = this.assetManager.getAssetBlobUrl?.(assetId);
        if (syncUrl) {
          this.resolvedUrls.set(assetId, syncUrl);
          return syncUrl;
        }
      }
      return assetUrl;
    }
    /**
     * Process HTML content, resolving all asset URLs (async)
     */
    async processHtml(html) {
      if (!html) return "";
      const assetUrlPattern = /asset:\/\/([^"']+)/g;
      const assetUrls = /* @__PURE__ */ new Set();
      let match;
      while ((match = assetUrlPattern.exec(html)) !== null) {
        assetUrls.add(match[0]);
      }
      const resolutions = await Promise.all(
        Array.from(assetUrls).map(async (url) => ({
          original: url,
          resolved: await this.resolve(url)
        }))
      );
      let result = html;
      for (const { original, resolved } of resolutions) {
        if (original !== resolved) {
          result = result.split(original).join(resolved);
        }
      }
      return result;
    }
    /**
     * Synchronous HTML processing (uses cached URLs only)
     */
    processHtmlSync(html) {
      if (!html) return "";
      return html.replace(/asset:\/\/([^"']+)/g, (fullMatch, assetPath) => {
        const slashIndex = assetPath.indexOf("/");
        const assetId = slashIndex > 0 ? assetPath.slice(0, slashIndex) : assetPath;
        const cached = this.resolvedUrls.get(assetId);
        if (cached) {
          return cached;
        }
        const syncUrl = this.assetManager.getAssetBlobUrl?.(assetId);
        if (syncUrl) {
          this.resolvedUrls.set(assetId, syncUrl);
          return syncUrl;
        }
        return fullMatch;
      });
    }
    /**
     * Pre-resolve a list of asset IDs (call before processHtmlSync)
     */
    async preResolve(assetIds) {
      await Promise.all(
        assetIds.map(async (assetId) => {
          if (!this.resolvedUrls.has(assetId)) {
            try {
              const url = await this.assetManager.resolveAssetUrl(assetId);
              if (url) {
                this.resolvedUrls.set(assetId, url);
              }
            } catch {
            }
          }
        })
      );
    }
    /**
     * Clear the resolution cache
     */
    clearCache() {
      this.resolvedUrls.clear();
    }
  };

  // node_modules/fflate/esm/browser.js
  var u8 = Uint8Array;
  var u16 = Uint16Array;
  var i32 = Int32Array;
  var fleb = new u8([
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    2,
    2,
    2,
    2,
    3,
    3,
    3,
    3,
    4,
    4,
    4,
    4,
    5,
    5,
    5,
    5,
    0,
    /* unused */
    0,
    0,
    /* impossible */
    0
  ]);
  var fdeb = new u8([
    0,
    0,
    0,
    0,
    1,
    1,
    2,
    2,
    3,
    3,
    4,
    4,
    5,
    5,
    6,
    6,
    7,
    7,
    8,
    8,
    9,
    9,
    10,
    10,
    11,
    11,
    12,
    12,
    13,
    13,
    /* unused */
    0,
    0
  ]);
  var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
  var freb = function(eb, start) {
    var b = new u16(31);
    for (var i = 0; i < 31; ++i) {
      b[i] = start += 1 << eb[i - 1];
    }
    var r = new i32(b[30]);
    for (var i = 1; i < 30; ++i) {
      for (var j = b[i]; j < b[i + 1]; ++j) {
        r[j] = j - b[i] << 5 | i;
      }
    }
    return { b, r };
  };
  var _a = freb(fleb, 2);
  var fl = _a.b;
  var revfl = _a.r;
  fl[28] = 258, revfl[258] = 28;
  var _b = freb(fdeb, 0);
  var fd = _b.b;
  var revfd = _b.r;
  var rev = new u16(32768);
  for (i = 0; i < 32768; ++i) {
    x = (i & 43690) >> 1 | (i & 21845) << 1;
    x = (x & 52428) >> 2 | (x & 13107) << 2;
    x = (x & 61680) >> 4 | (x & 3855) << 4;
    rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
  }
  var x;
  var i;
  var hMap = (function(cd, mb, r) {
    var s = cd.length;
    var i = 0;
    var l = new u16(mb);
    for (; i < s; ++i) {
      if (cd[i])
        ++l[cd[i] - 1];
    }
    var le = new u16(mb);
    for (i = 1; i < mb; ++i) {
      le[i] = le[i - 1] + l[i - 1] << 1;
    }
    var co;
    if (r) {
      co = new u16(1 << mb);
      var rvb = 15 - mb;
      for (i = 0; i < s; ++i) {
        if (cd[i]) {
          var sv = i << 4 | cd[i];
          var r_1 = mb - cd[i];
          var v = le[cd[i] - 1]++ << r_1;
          for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
            co[rev[v] >> rvb] = sv;
          }
        }
      }
    } else {
      co = new u16(s);
      for (i = 0; i < s; ++i) {
        if (cd[i]) {
          co[i] = rev[le[cd[i] - 1]++] >> 15 - cd[i];
        }
      }
    }
    return co;
  });
  var flt = new u8(288);
  for (i = 0; i < 144; ++i)
    flt[i] = 8;
  var i;
  for (i = 144; i < 256; ++i)
    flt[i] = 9;
  var i;
  for (i = 256; i < 280; ++i)
    flt[i] = 7;
  var i;
  for (i = 280; i < 288; ++i)
    flt[i] = 8;
  var i;
  var fdt = new u8(32);
  for (i = 0; i < 32; ++i)
    fdt[i] = 5;
  var i;
  var flm = /* @__PURE__ */ hMap(flt, 9, 0);
  var fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
  var shft = function(p) {
    return (p + 7) / 8 | 0;
  };
  var slc = function(v, s, e) {
    if (s == null || s < 0)
      s = 0;
    if (e == null || e > v.length)
      e = v.length;
    return new u8(v.subarray(s, e));
  };
  var ec = [
    "unexpected EOF",
    "invalid block type",
    "invalid length/literal",
    "invalid distance",
    "stream finished",
    "no stream handler",
    ,
    "no callback",
    "invalid UTF-8 data",
    "extra field too long",
    "date not in range 1980-2099",
    "filename too long",
    "stream finishing",
    "invalid zip data"
    // determined by unknown compression method
  ];
  var err = function(ind, msg, nt) {
    var e = new Error(msg || ec[ind]);
    e.code = ind;
    if (Error.captureStackTrace)
      Error.captureStackTrace(e, err);
    if (!nt)
      throw e;
    return e;
  };
  var wbits = function(d, p, v) {
    v <<= p & 7;
    var o = p / 8 | 0;
    d[o] |= v;
    d[o + 1] |= v >> 8;
  };
  var wbits16 = function(d, p, v) {
    v <<= p & 7;
    var o = p / 8 | 0;
    d[o] |= v;
    d[o + 1] |= v >> 8;
    d[o + 2] |= v >> 16;
  };
  var hTree = function(d, mb) {
    var t = [];
    for (var i = 0; i < d.length; ++i) {
      if (d[i])
        t.push({ s: i, f: d[i] });
    }
    var s = t.length;
    var t2 = t.slice();
    if (!s)
      return { t: et, l: 0 };
    if (s == 1) {
      var v = new u8(t[0].s + 1);
      v[t[0].s] = 1;
      return { t: v, l: 1 };
    }
    t.sort(function(a, b) {
      return a.f - b.f;
    });
    t.push({ s: -1, f: 25001 });
    var l = t[0], r = t[1], i0 = 0, i1 = 1, i2 = 2;
    t[0] = { s: -1, f: l.f + r.f, l, r };
    while (i1 != s - 1) {
      l = t[t[i0].f < t[i2].f ? i0++ : i2++];
      r = t[i0 != i1 && t[i0].f < t[i2].f ? i0++ : i2++];
      t[i1++] = { s: -1, f: l.f + r.f, l, r };
    }
    var maxSym = t2[0].s;
    for (var i = 1; i < s; ++i) {
      if (t2[i].s > maxSym)
        maxSym = t2[i].s;
    }
    var tr = new u16(maxSym + 1);
    var mbt = ln(t[i1 - 1], tr, 0);
    if (mbt > mb) {
      var i = 0, dt = 0;
      var lft = mbt - mb, cst = 1 << lft;
      t2.sort(function(a, b) {
        return tr[b.s] - tr[a.s] || a.f - b.f;
      });
      for (; i < s; ++i) {
        var i2_1 = t2[i].s;
        if (tr[i2_1] > mb) {
          dt += cst - (1 << mbt - tr[i2_1]);
          tr[i2_1] = mb;
        } else
          break;
      }
      dt >>= lft;
      while (dt > 0) {
        var i2_2 = t2[i].s;
        if (tr[i2_2] < mb)
          dt -= 1 << mb - tr[i2_2]++ - 1;
        else
          ++i;
      }
      for (; i >= 0 && dt; --i) {
        var i2_3 = t2[i].s;
        if (tr[i2_3] == mb) {
          --tr[i2_3];
          ++dt;
        }
      }
      mbt = mb;
    }
    return { t: new u8(tr), l: mbt };
  };
  var ln = function(n, l, d) {
    return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : l[n.s] = d;
  };
  var lc = function(c) {
    var s = c.length;
    while (s && !c[--s])
      ;
    var cl = new u16(++s);
    var cli = 0, cln = c[0], cls = 1;
    var w = function(v) {
      cl[cli++] = v;
    };
    for (var i = 1; i <= s; ++i) {
      if (c[i] == cln && i != s)
        ++cls;
      else {
        if (!cln && cls > 2) {
          for (; cls > 138; cls -= 138)
            w(32754);
          if (cls > 2) {
            w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
            cls = 0;
          }
        } else if (cls > 3) {
          w(cln), --cls;
          for (; cls > 6; cls -= 6)
            w(8304);
          if (cls > 2)
            w(cls - 3 << 5 | 8208), cls = 0;
        }
        while (cls--)
          w(cln);
        cls = 1;
        cln = c[i];
      }
    }
    return { c: cl.subarray(0, cli), n: s };
  };
  var clen = function(cf, cl) {
    var l = 0;
    for (var i = 0; i < cl.length; ++i)
      l += cf[i] * cl[i];
    return l;
  };
  var wfblk = function(out, pos, dat) {
    var s = dat.length;
    var o = shft(pos + 2);
    out[o] = s & 255;
    out[o + 1] = s >> 8;
    out[o + 2] = out[o] ^ 255;
    out[o + 3] = out[o + 1] ^ 255;
    for (var i = 0; i < s; ++i)
      out[o + i + 4] = dat[i];
    return (o + 4 + s) * 8;
  };
  var wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
    wbits(out, p++, final);
    ++lf[256];
    var _a2 = hTree(lf, 15), dlt = _a2.t, mlb = _a2.l;
    var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
    var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
    var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
    var lcfreq = new u16(19);
    for (var i = 0; i < lclt.length; ++i)
      ++lcfreq[lclt[i] & 31];
    for (var i = 0; i < lcdt.length; ++i)
      ++lcfreq[lcdt[i] & 31];
    var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
    var nlcc = 19;
    for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
      ;
    var flen = bl + 5 << 3;
    var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
    var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
    if (bs >= 0 && flen <= ftlen && flen <= dtlen)
      return wfblk(out, p, dat.subarray(bs, bs + bl));
    var lm, ll, dm, dl;
    wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
    if (dtlen < ftlen) {
      lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
      var llm = hMap(lct, mlcb, 0);
      wbits(out, p, nlc - 257);
      wbits(out, p + 5, ndc - 1);
      wbits(out, p + 10, nlcc - 4);
      p += 14;
      for (var i = 0; i < nlcc; ++i)
        wbits(out, p + 3 * i, lct[clim[i]]);
      p += 3 * nlcc;
      var lcts = [lclt, lcdt];
      for (var it = 0; it < 2; ++it) {
        var clct = lcts[it];
        for (var i = 0; i < clct.length; ++i) {
          var len = clct[i] & 31;
          wbits(out, p, llm[len]), p += lct[len];
          if (len > 15)
            wbits(out, p, clct[i] >> 5 & 127), p += clct[i] >> 12;
        }
      }
    } else {
      lm = flm, ll = flt, dm = fdm, dl = fdt;
    }
    for (var i = 0; i < li; ++i) {
      var sym = syms[i];
      if (sym > 255) {
        var len = sym >> 18 & 31;
        wbits16(out, p, lm[len + 257]), p += ll[len + 257];
        if (len > 7)
          wbits(out, p, sym >> 23 & 31), p += fleb[len];
        var dst = sym & 31;
        wbits16(out, p, dm[dst]), p += dl[dst];
        if (dst > 3)
          wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
      } else {
        wbits16(out, p, lm[sym]), p += ll[sym];
      }
    }
    wbits16(out, p, lm[256]);
    return p + ll[256];
  };
  var deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
  var et = /* @__PURE__ */ new u8(0);
  var dflt = function(dat, lvl, plvl, pre, post, st) {
    var s = st.z || dat.length;
    var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7e3)) + post);
    var w = o.subarray(pre, o.length - post);
    var lst = st.l;
    var pos = (st.r || 0) & 7;
    if (lvl) {
      if (pos)
        w[0] = st.r >> 3;
      var opt = deo[lvl - 1];
      var n = opt >> 13, c = opt & 8191;
      var msk_1 = (1 << plvl) - 1;
      var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
      var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
      var hsh = function(i2) {
        return (dat[i2] ^ dat[i2 + 1] << bs1_1 ^ dat[i2 + 2] << bs2_1) & msk_1;
      };
      var syms = new i32(25e3);
      var lf = new u16(288), df = new u16(32);
      var lc_1 = 0, eb = 0, i = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
      for (; i + 2 < s; ++i) {
        var hv = hsh(i);
        var imod = i & 32767, pimod = head[hv];
        prev[imod] = pimod;
        head[hv] = imod;
        if (wi <= i) {
          var rem = s - i;
          if ((lc_1 > 7e3 || li > 24576) && (rem > 423 || !lst)) {
            pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i - bs, pos);
            li = lc_1 = eb = 0, bs = i;
            for (var j = 0; j < 286; ++j)
              lf[j] = 0;
            for (var j = 0; j < 30; ++j)
              df[j] = 0;
          }
          var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
          if (rem > 2 && hv == hsh(i - dif)) {
            var maxn = Math.min(n, rem) - 1;
            var maxd = Math.min(32767, i);
            var ml = Math.min(258, rem);
            while (dif <= maxd && --ch_1 && imod != pimod) {
              if (dat[i + l] == dat[i + l - dif]) {
                var nl = 0;
                for (; nl < ml && dat[i + nl] == dat[i + nl - dif]; ++nl)
                  ;
                if (nl > l) {
                  l = nl, d = dif;
                  if (nl > maxn)
                    break;
                  var mmd = Math.min(dif, nl - 2);
                  var md = 0;
                  for (var j = 0; j < mmd; ++j) {
                    var ti = i - dif + j & 32767;
                    var pti = prev[ti];
                    var cd = ti - pti & 32767;
                    if (cd > md)
                      md = cd, pimod = ti;
                  }
                }
              }
              imod = pimod, pimod = prev[imod];
              dif += imod - pimod & 32767;
            }
          }
          if (d) {
            syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
            var lin = revfl[l] & 31, din = revfd[d] & 31;
            eb += fleb[lin] + fdeb[din];
            ++lf[257 + lin];
            ++df[din];
            wi = i + l;
            ++lc_1;
          } else {
            syms[li++] = dat[i];
            ++lf[dat[i]];
          }
        }
      }
      for (i = Math.max(i, wi); i < s; ++i) {
        syms[li++] = dat[i];
        ++lf[dat[i]];
      }
      pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i - bs, pos);
      if (!lst) {
        st.r = pos & 7 | w[pos / 8 | 0] << 3;
        pos -= 7;
        st.h = head, st.p = prev, st.i = i, st.w = wi;
      }
    } else {
      for (var i = st.w || 0; i < s + lst; i += 65535) {
        var e = i + 65535;
        if (e >= s) {
          w[pos / 8 | 0] = lst;
          e = s;
        }
        pos = wfblk(w, pos + 1, dat.subarray(i, e));
      }
      st.i = s;
    }
    return slc(o, 0, pre + shft(pos) + post);
  };
  var crct = /* @__PURE__ */ (function() {
    var t = new Int32Array(256);
    for (var i = 0; i < 256; ++i) {
      var c = i, k = 9;
      while (--k)
        c = (c & 1 && -306674912) ^ c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  var crc = function() {
    var c = -1;
    return {
      p: function(d) {
        var cr = c;
        for (var i = 0; i < d.length; ++i)
          cr = crct[cr & 255 ^ d[i]] ^ cr >>> 8;
        c = cr;
      },
      d: function() {
        return ~c;
      }
    };
  };
  var dopt = function(dat, opt, pre, post, st) {
    if (!st) {
      st = { l: 1 };
      if (opt.dictionary) {
        var dict = opt.dictionary.subarray(-32768);
        var newDat = new u8(dict.length + dat.length);
        newDat.set(dict);
        newDat.set(dat, dict.length);
        dat = newDat;
        st.w = dict.length;
      }
    }
    return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt.mem, pre, post, st);
  };
  var mrg = function(a, b) {
    var o = {};
    for (var k in a)
      o[k] = a[k];
    for (var k in b)
      o[k] = b[k];
    return o;
  };
  var wbytes = function(d, b, v) {
    for (; v; ++b)
      d[b] = v, v >>>= 8;
  };
  function deflateSync(data, opts) {
    return dopt(data, opts || {}, 0, 0);
  }
  var fltn = function(d, p, t, o) {
    for (var k in d) {
      var val = d[k], n = p + k, op = o;
      if (Array.isArray(val))
        op = mrg(o, val[1]), val = val[0];
      if (val instanceof u8)
        t[n] = [val, op];
      else {
        t[n += "/"] = [new u8(0), op];
        fltn(val, n, t, o);
      }
    }
  };
  var te = typeof TextEncoder != "undefined" && /* @__PURE__ */ new TextEncoder();
  var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
  var tds = 0;
  try {
    td.decode(et, { stream: true });
    tds = 1;
  } catch (e) {
  }
  function strToU8(str, latin1) {
    if (latin1) {
      var ar_1 = new u8(str.length);
      for (var i = 0; i < str.length; ++i)
        ar_1[i] = str.charCodeAt(i);
      return ar_1;
    }
    if (te)
      return te.encode(str);
    var l = str.length;
    var ar = new u8(str.length + (str.length >> 1));
    var ai = 0;
    var w = function(v) {
      ar[ai++] = v;
    };
    for (var i = 0; i < l; ++i) {
      if (ai + 5 > ar.length) {
        var n = new u8(ai + 8 + (l - i << 1));
        n.set(ar);
        ar = n;
      }
      var c = str.charCodeAt(i);
      if (c < 128 || latin1)
        w(c);
      else if (c < 2048)
        w(192 | c >> 6), w(128 | c & 63);
      else if (c > 55295 && c < 57344)
        c = 65536 + (c & 1023 << 10) | str.charCodeAt(++i) & 1023, w(240 | c >> 18), w(128 | c >> 12 & 63), w(128 | c >> 6 & 63), w(128 | c & 63);
      else
        w(224 | c >> 12), w(128 | c >> 6 & 63), w(128 | c & 63);
    }
    return slc(ar, 0, ai);
  }
  var exfl = function(ex) {
    var le = 0;
    if (ex) {
      for (var k in ex) {
        var l = ex[k].length;
        if (l > 65535)
          err(9);
        le += l + 4;
      }
    }
    return le;
  };
  var wzh = function(d, b, f, fn, u, c, ce, co) {
    var fl2 = fn.length, ex = f.extra, col = co && co.length;
    var exl = exfl(ex);
    wbytes(d, b, ce != null ? 33639248 : 67324752), b += 4;
    if (ce != null)
      d[b++] = 20, d[b++] = f.os;
    d[b] = 20, b += 2;
    d[b++] = f.flag << 1 | (c < 0 && 8), d[b++] = u && 8;
    d[b++] = f.compression & 255, d[b++] = f.compression >> 8;
    var dt = new Date(f.mtime == null ? Date.now() : f.mtime), y = dt.getFullYear() - 1980;
    if (y < 0 || y > 119)
      err(10);
    wbytes(d, b, y << 25 | dt.getMonth() + 1 << 21 | dt.getDate() << 16 | dt.getHours() << 11 | dt.getMinutes() << 5 | dt.getSeconds() >> 1), b += 4;
    if (c != -1) {
      wbytes(d, b, f.crc);
      wbytes(d, b + 4, c < 0 ? -c - 2 : c);
      wbytes(d, b + 8, f.size);
    }
    wbytes(d, b + 12, fl2);
    wbytes(d, b + 14, exl), b += 16;
    if (ce != null) {
      wbytes(d, b, col);
      wbytes(d, b + 6, f.attrs);
      wbytes(d, b + 10, ce), b += 14;
    }
    d.set(fn, b);
    b += fl2;
    if (exl) {
      for (var k in ex) {
        var exf = ex[k], l = exf.length;
        wbytes(d, b, +k);
        wbytes(d, b + 2, l);
        d.set(exf, b + 4), b += 4 + l;
      }
    }
    if (col)
      d.set(co, b), b += col;
    return b;
  };
  var wzf = function(o, b, c, d, e) {
    wbytes(o, b, 101010256);
    wbytes(o, b + 8, c);
    wbytes(o, b + 10, c);
    wbytes(o, b + 12, d);
    wbytes(o, b + 16, e);
  };
  function zipSync(data, opts) {
    if (!opts)
      opts = {};
    var r = {};
    var files = [];
    fltn(data, "", r, opts);
    var o = 0;
    var tot = 0;
    for (var fn in r) {
      var _a2 = r[fn], file = _a2[0], p = _a2[1];
      var compression = p.level == 0 ? 0 : 8;
      var f = strToU8(fn), s = f.length;
      var com = p.comment, m = com && strToU8(com), ms = m && m.length;
      var exl = exfl(p.extra);
      if (s > 65535)
        err(11);
      var d = compression ? deflateSync(file, p) : file, l = d.length;
      var c = crc();
      c.p(file);
      files.push(mrg(p, {
        size: file.length,
        crc: c.d(),
        c: d,
        f,
        m,
        u: s != fn.length || m && com.length != ms,
        o,
        compression
      }));
      o += 30 + s + exl + l;
      tot += 76 + 2 * (s + exl) + (ms || 0) + l;
    }
    var out = new u8(tot + 22), oe = o, cdl = tot - o;
    for (var i = 0; i < files.length; ++i) {
      var f = files[i];
      wzh(out, f.o, f, f.f, f.u, f.c.length);
      var badd = 30 + f.f.length + exfl(f.extra);
      out.set(f.c, f.o + badd);
      wzh(out, o, f, f.f, f.u, f.c.length, f.o, f.m), o += 16 + badd + (f.m ? f.m.length : 0);
    }
    wzf(out, o, files.length, cdl, oe);
    return out;
  }

  // src/shared/export/providers/FflateZipProvider.ts
  function toUint8Array(content) {
    if (content instanceof Uint8Array) {
      return content;
    }
    if (typeof content === "string") {
      return new TextEncoder().encode(content);
    }
    throw new Error("Blob content must be converted to Uint8Array before adding to ZIP");
  }
  var FflateZipProvider = class {
    constructor() {
      this.files = /* @__PURE__ */ new Map();
    }
    /**
     * Create a new ZIP archive (returns self for compatibility)
     */
    createZip() {
      this.reset();
      return this;
    }
    /**
     * Add a file to the archive
     */
    addFile(path, content) {
      const data = toUint8Array(content);
      this.files.set(path, data);
    }
    /**
     * Add multiple files from a Map
     */
    addFiles(files) {
      for (const [path, content] of files) {
        this.addFile(path, content);
      }
    }
    /**
     * Generate the ZIP archive (async version for compatibility)
     */
    async generateAsync() {
      return this.generate();
    }
    /**
     * Generate the ZIP archive
     */
    async generate() {
      const zipData = {};
      for (const [path, data] of this.files) {
        zipData[path] = [data, { level: 6 }];
      }
      return zipSync(zipData);
    }
    /**
     * Reset the archive for reuse
     */
    reset() {
      this.files.clear();
    }
    /**
     * Get the number of files in the archive
     */
    getFileCount() {
      return this.files.size;
    }
    /**
     * Check if a file exists in the archive
     */
    hasFile(path) {
      return this.files.has(path);
    }
    /**
     * Get file content (for testing)
     */
    getFile(path) {
      return this.files.get(path);
    }
    /**
     * Get file content as string (for testing)
     */
    getFileAsString(path) {
      const data = this.files.get(path);
      if (!data) return void 0;
      return new TextDecoder().decode(data);
    }
  };

  // src/shared/export/renderers/IdeviceRenderer.ts
  var IdeviceRenderer = class {
    /**
     * Render a single iDevice component to HTML
     * @param component - Component data
     * @param options - Rendering options
     * @returns HTML string
     */
    render(component, options = { basePath: "", includeDataAttributes: true }) {
      const { basePath = "", includeDataAttributes = true } = options;
      const type = component.type || "text";
      const config = getIdeviceConfig(type);
      const ideviceId = component.id;
      const htmlContent = component.content || "";
      const properties = component.properties || {};
      const classes = ["idevice_node", config.cssClass];
      if (!htmlContent) {
        classes.push("db-no-data");
      }
      if (properties.visibility === "false") {
        classes.push("novisible");
      }
      if (properties.teacherOnly === "true" || properties.visibilityType === "teacher") {
        classes.push("teacher-only");
      }
      if (properties.cssClass && typeof properties.cssClass === "string") {
        classes.push(properties.cssClass);
      }
      let dataAttrs = "";
      if (includeDataAttributes) {
        const isPreviewModeForPath = basePath.startsWith("/") || basePath.includes("://");
        const normalizedType = config.cssClass;
        const idevicePath = isPreviewModeForPath ? `${basePath}${normalizedType}/export/` : `${basePath}idevices/${normalizedType}/`;
        dataAttrs = ` data-idevice-path="${this.escapeAttr(idevicePath)}"`;
        dataAttrs += ` data-idevice-type="${this.escapeAttr(normalizedType)}"`;
        if (config.componentType === "json") {
          dataAttrs += ` data-idevice-component-type="json"`;
          if (type !== "text" && Object.keys(properties).length > 0) {
            const jsonData = JSON.stringify(properties);
            dataAttrs += ` data-idevice-json-data="${this.escapeAttr(jsonData)}"`;
            dataAttrs += ` data-idevice-template="${this.escapeAttr(config.template)}"`;
          }
        }
      }
      const isPreviewMode = basePath.startsWith("/") || basePath.includes("://");
      const fixedContent = this.fixAssetUrls(htmlContent, basePath, isPreviewMode);
      const isTextIdevice = type === "text" || type === "FreeTextIdevice" || type === "TextIdevice";
      const contentHtml = isTextIdevice && fixedContent ? `<div class="exe-text">${fixedContent}</div>` : fixedContent;
      return `<div id="${this.escapeAttr(ideviceId)}" class="${classes.join(" ")}"${dataAttrs}>
${contentHtml}
</div>`;
    }
    /**
     * Render a block with multiple iDevices
     * @param block - Block data
     * @param options - Rendering options
     * @returns HTML string
     */
    renderBlock(block, options = { basePath: "", includeDataAttributes: true }) {
      const { basePath = "", includeDataAttributes = true } = options;
      const blockId = block.id;
      const blockName = block.name || "";
      const components = block.components || [];
      const properties = block.properties || {};
      const classes = ["box"];
      const hasHeader = blockName && blockName.trim() !== "";
      if (!hasHeader) {
        classes.push("no-header");
      }
      if (properties.minimized === "true") {
        classes.push("minimized");
      }
      if (properties.visibility === "false") {
        classes.push("novisible");
      }
      if (properties.teacherOnly === "true" || properties.visibilityType === "teacher") {
        classes.push("teacher-only");
      }
      if (properties.cssClass) {
        classes.push(properties.cssClass);
      }
      let headerHtml = "";
      if (hasHeader) {
        headerHtml = `<header class="box-head no-icon">
<h1 class="box-title">${this.escapeHtml(blockName)}</h1>
</header>`;
      } else {
        headerHtml = '<div class="box-head"></div>';
      }
      let contentHtml = "";
      for (const component of components) {
        contentHtml += this.render(component, { basePath, includeDataAttributes });
      }
      return `<article id="${this.escapeAttr(blockId)}" class="${classes.join(" ")}">
${headerHtml}
<div class="box-content">
${contentHtml}
</div>
</article>`;
    }
    /**
     * Fix asset URLs in HTML content
     * @param content - HTML content
     * @param basePath - Base path prefix
     * @param isPreviewMode - If true, skip asset:// transformation (keep for blob resolution)
     * @returns Fixed HTML content
     */
    fixAssetUrls(content, basePath, isPreviewMode = false) {
      if (!content) return "";
      let result = content;
      if (!isPreviewMode) {
        result = result.replace(/\{\{context_path\}\}\/([^"'\s]+)/g, (_match, assetPath) => {
          if (assetPath.startsWith("blob:") || assetPath.startsWith("data:")) {
            return _match;
          }
          return `${basePath}content/resources/${assetPath}`;
        });
      }
      if (!isPreviewMode) {
        result = result.replace(/asset:\/\/([^"']+)/g, (_match, assetPath) => {
          if (assetPath.startsWith("blob:") || assetPath.startsWith("data:")) {
            return _match;
          }
          return `${basePath}content/resources/${assetPath}`;
        });
      }
      result = result.replace(/files\/tmp\/[^"'\s]+\/([^/]+\/[^"'\s]+)/g, (_match, relativePath) => {
        if (relativePath.startsWith("blob:") || relativePath.startsWith("data:")) {
          return _match;
        }
        return `${basePath}content/resources/${relativePath}`;
      });
      result = result.replace(/["']\/files\/tmp\/[^"']+\/([^"']+)["']/g, (_match, path) => {
        if (path.startsWith("blob:") || path.startsWith("data:")) {
          return _match;
        }
        return `"${basePath}content/resources/${path}"`;
      });
      result = result.replace(/(src|href)=(["'])resources\/([^"']+)\2/g, (_match, attr, quote, assetPath) => {
        if (assetPath.startsWith("blob:") || assetPath.startsWith("data:")) {
          return _match;
        }
        return `${attr}=${quote}${basePath}content/resources/${assetPath}${quote}`;
      });
      result = result.replace(
        /http:\/\/localhost:\d+\/(files|scripts)\/(perm\/)?([^"'\s]+)/g,
        (_match, prefix, _perm, path) => {
          return `${basePath}files/perm/${path}`;
        }
      );
      return result;
    }
    /**
     * Escape HTML special characters
     * @param str - String to escape
     * @returns Escaped string
     */
    escapeHtml(str) {
      if (!str) return "";
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };
      return String(str).replace(/[&<>"']/g, (m) => map[m]);
    }
    /**
     * Escape attribute value
     * @param str - String to escape
     * @returns Escaped string
     */
    escapeAttr(str) {
      if (!str) return "";
      return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    /**
     * Get list of CSS link tags needed for given iDevice types
     * @param ideviceTypes - Array of iDevice type names
     * @param basePath - Base path prefix
     * @returns Array of CSS link tags as strings
     */
    getCssLinks(ideviceTypes, basePath = "") {
      const links = [];
      const seen = /* @__PURE__ */ new Set();
      for (const type of ideviceTypes) {
        const config = getIdeviceConfig(type);
        const typeName = config.cssClass;
        if (!seen.has(typeName)) {
          seen.add(typeName);
          links.push(`<link rel="stylesheet" href="${basePath}idevices/${typeName}/${typeName}.css">`);
        }
      }
      return links;
    }
    /**
     * Get list of JS script tags needed for given iDevice types
     * @param ideviceTypes - Array of iDevice type names
     * @param basePath - Base path prefix
     * @returns Array of script tags as strings
     */
    getJsScripts(ideviceTypes, basePath = "") {
      const scripts = [];
      const seen = /* @__PURE__ */ new Set();
      for (const type of ideviceTypes) {
        const config = getIdeviceConfig(type);
        const typeName = config.cssClass;
        if (!seen.has(typeName)) {
          seen.add(typeName);
          scripts.push(`<script src="${basePath}idevices/${typeName}/${typeName}.js"><\/script>`);
        }
      }
      return scripts;
    }
    /**
     * Get list of CSS link info (without full tag) for given iDevice types
     * @param ideviceTypes - Array of iDevice type names
     * @param basePath - Base path prefix
     * @returns Array of link info objects
     */
    getCssLinkInfo(ideviceTypes, basePath = "") {
      const links = [];
      const seen = /* @__PURE__ */ new Set();
      for (const type of ideviceTypes) {
        const config = getIdeviceConfig(type);
        const typeName = config.cssClass;
        if (!seen.has(typeName)) {
          seen.add(typeName);
          const href = `${basePath}idevices/${typeName}/${typeName}.css`;
          links.push({
            href,
            tag: `<link rel="stylesheet" href="${href}">`
          });
        }
      }
      return links;
    }
    /**
     * Get list of JS script info (without full tag) for given iDevice types
     * @param ideviceTypes - Array of iDevice type names
     * @param basePath - Base path prefix
     * @returns Array of script info objects
     */
    getJsScriptInfo(ideviceTypes, basePath = "") {
      const scripts = [];
      const seen = /* @__PURE__ */ new Set();
      for (const type of ideviceTypes) {
        const config = getIdeviceConfig(type);
        const typeName = config.cssClass;
        if (!seen.has(typeName)) {
          seen.add(typeName);
          const src = `${basePath}idevices/${typeName}/${typeName}.js`;
          scripts.push({
            src,
            tag: `<script src="${src}"><\/script>`
          });
        }
      }
      return scripts;
    }
  };

  // src/shared/export/renderers/PageRenderer.ts
  var PageRenderer = class {
    /**
     * @param ideviceRenderer - Renderer for iDevice content
     */
    constructor(ideviceRenderer = null) {
      this.ideviceRenderer = ideviceRenderer || new IdeviceRenderer();
    }
    /**
     * Render a complete HTML page
     * @param page - Page data
     * @param options - Rendering options
     * @returns Complete HTML document
     */
    render(page, options) {
      const {
        projectTitle = "eXeLearning",
        language = "en",
        customStyles = "",
        allPages = [],
        basePath = "",
        isIndex = false,
        usedIdevices = [],
        license = "creative commons: attribution - share alike 4.0",
        description = "",
        licenseUrl = "https://creativecommons.org/licenses/by-sa/4.0/",
        // Page counter options
        totalPages,
        currentPageIndex,
        userFooterContent = "",
        // Export options (with defaults)
        addExeLink = true,
        addPagination = false,
        addSearchBox = false,
        addAccessibilityToolbar = false,
        // Custom head content
        extraHeadContent = "",
        // SCORM-specific options
        isScorm = false,
        scormVersion = "",
        bodyClass = "",
        extraHeadScripts = "",
        onLoadScript = "",
        onUnloadScript = ""
      } = options;
      const pageTitle = isIndex ? projectTitle : page.title || "Page";
      const total = totalPages ?? allPages.length;
      const currentIdx = currentPageIndex ?? allPages.findIndex((p) => p.id === page.id);
      const bodyClassStr = bodyClass || "exe-export exe-web-site";
      const onLoadAttr = onLoadScript ? ` onload="${onLoadScript}"` : "";
      const onUnloadAttr = onUnloadScript ? ` onunload="${onUnloadScript}" onbeforeunload="${onUnloadScript}"` : "";
      const pageHeaderHtml = this.renderPageHeader(page, {
        projectTitle,
        currentPageIndex: currentIdx,
        totalPages: total,
        addPagination
      });
      const searchBoxHtml = addSearchBox ? `<div id="exe-client-search" data-block-order-string="Caja %e" data-no-results-string="Sin resultados.">
</div>` : "";
      const madeWithExeHtml = addExeLink ? this.renderMadeWithEXe() : "";
      return `<!DOCTYPE html>
<html lang="${language}" id="exe-${isIndex ? "index" : page.id}">
<head>
${this.renderHead({ pageTitle, basePath, usedIdevices, customStyles, extraHeadScripts, isScorm, scormVersion, description, licenseUrl, addAccessibilityToolbar, extraHeadContent, addSearchBox })}
</head>
<body class="${bodyClassStr}" lang="${language}"${onLoadAttr}${onUnloadAttr}>
<script>document.body.className+=" js"<\/script>
<div class="exe-content exe-export pre-js siteNav-hidden"> ${this.renderNavigation(allPages, page.id, basePath)}${pageHeaderHtml}<div id="page-content-${page.id}" class="page-content"> <main id="${page.id}" class="page"> ${searchBoxHtml}
${this.renderPageContent(page, basePath)}
</main></div>${this.renderNavButtons(page, allPages, basePath)}
${this.renderFooterSection({ license, licenseUrl, userFooterContent })}
</div>
${madeWithExeHtml}
</body>
</html>`;
    }
    /**
     * Render HTML head section
     * Legacy order: SCRIPTS first, then CSS (required for proper initialization)
     * @param options - Head render options
     * @returns HTML head content
     */
    renderHead(options) {
      const {
        pageTitle,
        basePath,
        usedIdevices,
        customStyles,
        extraHeadScripts = "",
        isScorm: _isScorm = false,
        description = "",
        licenseUrl = "https://creativecommons.org/licenses/by-sa/4.0/",
        addAccessibilityToolbar = false,
        extraHeadContent = "",
        addSearchBox = false
      } = options;
      let head = `<meta charset="utf-8">
<meta name="generator" content="eXeLearning v3.0.0">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="license" type="text/html" href="${licenseUrl}">
<title>${this.escapeHtml(pageTitle)}</title>`;
      if (description) {
        head += `
<meta name="description" content="${this.escapeAttr(description)}">`;
      }
      head += `
<script>document.querySelector("html").classList.add("js");<\/script>`;
      head += `<script src="${basePath}libs/jquery/jquery.min.js"> <\/script>`;
      head += `<script src="${basePath}libs/common_i18n.js"> <\/script>`;
      head += `<script src="${basePath}libs/common.js"> <\/script>`;
      head += `<script src="${basePath}libs/exe_export.js"> <\/script>`;
      if (addSearchBox) {
        head += `<script src="${basePath}search_index.js"> <\/script>`;
      }
      head += `<script src="${basePath}libs/bootstrap/bootstrap.bundle.min.js"> <\/script>`;
      head += `<script src="${basePath}libs/exe_lightbox/exe_lightbox.js"> <\/script>`;
      head += `<link rel="stylesheet" href="${basePath}libs/bootstrap/bootstrap.min.css">`;
      head += `
<link rel="stylesheet" href="${basePath}libs/exe_lightbox/exe_lightbox.css">`;
      const jsScripts = this.ideviceRenderer.getJsScripts(usedIdevices, basePath);
      const cssLinks = this.ideviceRenderer.getCssLinks(usedIdevices, basePath);
      for (let i = 0; i < jsScripts.length; i++) {
        head += `
${jsScripts[i]}`;
        if (cssLinks[i]) {
          head += cssLinks[i];
        }
      }
      head += `
<link rel="stylesheet" href="${basePath}content/css/base.css">`;
      head += `<script src="${basePath}theme/default.js"> <\/script>`;
      head += `<link rel="stylesheet" href="${basePath}theme/content.css">`;
      if (customStyles) {
        head += `
<style>
${customStyles}
</style>`;
      }
      if (addAccessibilityToolbar) {
        head += `
<script src="${basePath}libs/exe_atools/exe_atools.js"> <\/script>`;
        head += `<link rel="stylesheet" href="${basePath}libs/exe_atools/exe_atools.css">`;
      }
      if (extraHeadContent) {
        head += `
${extraHeadContent}`;
      }
      if (extraHeadScripts) {
        head += `
${extraHeadScripts}`;
      }
      return head;
    }
    /**
     * Render navigation menu
     * @param allPages - All pages in the project
     * @param currentPageId - ID of the current page
     * @param basePath - Base path for links
     * @returns Navigation HTML
     */
    renderNavigation(allPages, currentPageId, basePath) {
      const rootPages = allPages.filter((p) => !p.parentId);
      let html = '<nav id="siteNav">\n<ul>\n';
      for (const page of rootPages) {
        html += this.renderNavItem(page, allPages, currentPageId, basePath);
      }
      html += "</ul>\n</nav>";
      return html;
    }
    /**
     * Render a single navigation item (recursive for children)
     * @param page - Page to render
     * @param allPages - All pages
     * @param currentPageId - Current page ID
     * @param basePath - Base path
     * @returns Navigation item HTML
     */
    renderNavItem(page, allPages, currentPageId, basePath) {
      const children = allPages.filter((p) => p.parentId === page.id);
      const isCurrent = page.id === currentPageId;
      const hasChildren = children.length > 0;
      const isAncestor = this.isAncestorOf(page.id, currentPageId, allPages);
      const isFirstPage = page.id === allPages[0]?.id;
      const liClass = isCurrent ? ' class="active"' : isAncestor ? ' class="current-page-parent"' : "";
      const link = this.getPageLink(page, allPages, basePath);
      const linkClasses = [];
      if (isCurrent) linkClasses.push("active");
      if (isFirstPage) linkClasses.push("main-node");
      linkClasses.push(hasChildren ? "daddy" : "no-ch");
      let html = `<li${liClass}>`;
      html += ` <a href="${link}" class="${linkClasses.join(" ")}">${this.escapeHtml(page.title)}</a>
`;
      if (hasChildren) {
        html += '<ul class="other-section">\n';
        for (const child of children) {
          html += this.renderNavItem(child, allPages, currentPageId, basePath);
        }
        html += "</ul>\n";
      }
      html += "</li>\n";
      return html;
    }
    /**
     * Check if a page is an ancestor of another
     * @param ancestorId - Potential ancestor ID
     * @param childId - Child ID
     * @param allPages - All pages
     * @returns True if ancestorId is an ancestor of childId
     */
    isAncestorOf(ancestorId, childId, allPages) {
      const child = allPages.find((p) => p.id === childId);
      if (!child || !child.parentId) return false;
      if (child.parentId === ancestorId) return true;
      return this.isAncestorOf(ancestorId, child.parentId, allPages);
    }
    /**
     * Get page link URL
     * @param page - Page
     * @param allPages - All pages
     * @param basePath - Base path
     * @returns Link URL
     */
    getPageLink(page, allPages, basePath) {
      const isFirstPage = page.id === allPages[0]?.id;
      if (isFirstPage) {
        return basePath ? `${basePath}index.html` : "index.html";
      }
      const filename = this.sanitizeFilename(page.title);
      return `${basePath}html/${filename}.html`;
    }
    /**
     * Sanitize title for use as filename
     * @param title - Title to sanitize
     * @returns Sanitized filename
     */
    sanitizeFilename(title) {
      if (!title) return "page";
      return title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, 50);
    }
    /**
     * Render page header with page counter, package title (h1), and page title (h2)
     * @param page - Page
     * @param options - Header options including counter info
     * @returns Header HTML
     */
    renderPageHeader(page, options) {
      const { projectTitle, currentPageIndex, totalPages, addPagination } = options;
      const pageCounterHtml = addPagination ? ` <p class="page-counter"> <span class="page-counter-label">P\xE1gina </span><span class="page-counter-content"> <strong class="page-counter-current-page">${currentPageIndex + 1}</strong><span class="page-counter-sep">/</span><strong class="page-counter-total">${totalPages}</strong></span></p>
` : "";
      return `<header id="header-${page.id}" class="page-header">${pageCounterHtml}<h1 class="package-title">${this.escapeHtml(projectTitle)}</h1>
<h2 class="page-title">${this.escapeHtml(page.title)}</h2></header>`;
    }
    /**
     * Render page content (blocks with iDevices)
     * @param page - Page
     * @param basePath - Base path
     * @returns Content HTML
     */
    renderPageContent(page, basePath) {
      let html = "";
      for (const block of page.blocks || []) {
        html += this.ideviceRenderer.renderBlock(block, {
          basePath,
          includeDataAttributes: true
        });
      }
      return html;
    }
    /**
     * Render navigation buttons (prev/next links)
     * @param page - Current page
     * @param allPages - All pages
     * @param basePath - Base path
     * @returns Navigation buttons HTML
     */
    renderNavButtons(page, allPages, basePath) {
      const currentIndex = allPages.findIndex((p) => p.id === page.id);
      const prevPage = currentIndex > 0 ? allPages[currentIndex - 1] : null;
      const nextPage = currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;
      if (!prevPage && !nextPage) return "";
      let html = '<div class="nav-buttons">';
      if (prevPage) {
        const link = this.getPageLink(prevPage, allPages, basePath);
        html += ` <a href="${link}" title="Anterior" class="nav-button nav-button-left"> <span>Anterior</span></a>`;
      }
      if (nextPage) {
        const link = this.getPageLink(nextPage, allPages, basePath);
        html += `<a href="${link}" title="Siguiente" class="nav-button nav-button-right"> <span>Siguiente</span></a>`;
      }
      html += "\n</div>";
      return html;
    }
    /**
     * Render pagination (prev/next links) - legacy method kept for backward compatibility
     * @param page - Current page
     * @param allPages - All pages
     * @param basePath - Base path
     * @returns Pagination HTML
     * @deprecated Use renderNavButtons instead
     */
    renderPagination(page, allPages, basePath) {
      return this.renderNavButtons(page, allPages, basePath);
    }
    /**
     * Render complete footer section with license and optional user content
     * @param options - Footer options
     * @returns Footer HTML with siteFooter wrapper
     */
    renderFooterSection(options) {
      const { license, licenseUrl = "https://creativecommons.org/licenses/by-sa/4.0/", userFooterContent } = options;
      let userFooterHtml = "";
      if (userFooterContent) {
        userFooterHtml = `<div id="siteUserFooter"> <div>${userFooterContent}</div>
</div>`;
      }
      return `<footer id="siteFooter"><div id="siteFooterContent"> <div id="packageLicense" class="cc cc-by-sa"> <p> <span class="license-label">Licencia: </span><a href="${licenseUrl}" class="license">${this.escapeHtml(license)}</a></p>
</div>
${userFooterHtml}</div></footer>`;
    }
    /**
     * Render "Made with eXeLearning" credit
     * @returns Made with eXe HTML
     */
    renderMadeWithEXe() {
      return `<p id="made-with-eXe"> <a href="https://exelearning.net/" target="_blank" rel="noopener"> <span>Creado con eXeLearning <span>(nueva ventana)</span></span></a></p>`;
    }
    /**
     * Render license div (inside main, before pagination)
     * @param options - License options
     * @returns License HTML
     * @deprecated Use renderFooterSection instead
     */
    renderLicense(options) {
      const { license, licenseUrl = "https://creativecommons.org/licenses/by-sa/4.0/" } = options;
      return `<div id="packageLicense" class="cc cc-by-sa">
<p><span>Licensed under the</span> <a rel="license" href="${licenseUrl}">${this.escapeHtml(license)}</a></p>
</div>`;
    }
    /**
     * Render footer section (legacy method, kept for backward compatibility)
     * @param options - Footer options
     * @returns Footer HTML
     * @deprecated Use renderFooterSection instead
     */
    renderFooter(options) {
      return this.renderLicense({ ...options, licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" });
    }
    /**
     * Generate search data JSON for client-side search functionality
     * @param allPages - All pages in the project
     * @param basePath - Base path for URLs
     * @returns JSON string with page structure
     */
    generateSearchData(allPages, _basePath) {
      const pagesData = {};
      for (let i = 0; i < allPages.length; i++) {
        const page = allPages[i];
        const isIndex = i === 0;
        const prevPage = i > 0 ? allPages[i - 1] : null;
        const nextPage = i < allPages.length - 1 ? allPages[i + 1] : null;
        const fileName = isIndex ? "index.html" : `${this.sanitizeFilename(page.title)}.html`;
        const fileUrl = isIndex ? "index.html" : `html/${fileName}`;
        const blocksData = {};
        for (const block of page.blocks || []) {
          const idevicesData = {};
          for (let j = 0; j < (block.components || []).length; j++) {
            const component = block.components[j];
            idevicesData[component.id] = {
              order: j + 1,
              htmlView: component.content || "",
              jsonProperties: JSON.stringify(component.properties || {})
            };
          }
          blocksData[block.id] = {
            name: block.name || "",
            order: block.order || 1,
            idevices: idevicesData
          };
        }
        pagesData[page.id] = {
          name: page.title,
          isIndex,
          fileName,
          fileUrl,
          prePageId: prevPage?.id || null,
          nextPageId: nextPage?.id || null,
          blocks: blocksData
        };
      }
      return JSON.stringify(pagesData);
    }
    /**
     * Generate the content for search_index.js file
     * @param allPages - All pages in the project
     * @param basePath - Base path for URLs
     * @returns JavaScript file content with window.exeSearchData assignment
     */
    generateSearchIndexFile(allPages, basePath) {
      const searchDataJson = this.generateSearchData(allPages, basePath);
      return `window.exeSearchData = ${searchDataJson};`;
    }
    /**
     * Render a single-page HTML document with all pages
     * @param allPages - All pages in the project
     * @param options - Rendering options
     * @returns Complete HTML document
     */
    renderSinglePage(allPages, options = {}) {
      const {
        projectTitle = "eXeLearning",
        language = "en",
        customStyles = "",
        usedIdevices = [],
        author = "",
        license = "CC-BY-SA"
      } = options;
      let contentHtml = "";
      for (const page of allPages) {
        contentHtml += `<section id="section-${page.id}" class="single-page-section">
<header class="page-header">
<h2 class="page-title">${this.escapeHtml(page.title)}</h2>
</header>
<div class="page-content">
${this.renderPageContent(page, "")}
</div>
</section>
`;
      }
      const jsScripts = this.ideviceRenderer.getJsScripts(usedIdevices, "");
      const cssLinks = this.ideviceRenderer.getCssLinks(usedIdevices, "");
      let ideviceIncludes = "";
      for (let i = 0; i < jsScripts.length; i++) {
        ideviceIncludes += `
${jsScripts[i]}`;
        if (cssLinks[i]) {
          ideviceIncludes += cssLinks[i];
        }
      }
      return `<!DOCTYPE html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="generator" content="eXeLearning v3.0.0">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${this.escapeHtml(projectTitle)}</title>
<script>document.querySelector("html").classList.add("js");<\/script>
<script src="libs/jquery/jquery.min.js"> <\/script>
<script src="libs/common_i18n.js"> <\/script>
<script src="libs/common.js"> <\/script>
<script src="libs/exe_export.js"> <\/script>
<script src="libs/bootstrap/bootstrap.bundle.min.js"> <\/script>
<script src="libs/exe_lightbox/exe_lightbox.js"> <\/script>
<link rel="stylesheet" href="libs/bootstrap/bootstrap.min.css">
<link rel="stylesheet" href="libs/exe_lightbox/exe_lightbox.css">${ideviceIncludes}
<link rel="stylesheet" href="content/css/base.css">
<script src="theme/default.js"> <\/script>
<link rel="stylesheet" href="theme/content.css">
${customStyles ? `<style>
${customStyles}
</style>` : ""}
</head>
<body class="exe-export exe-single-page" lang="${language}">
<script>document.body.className+=" js"<\/script>
<div class="exe-content exe-export pre-js">
${this.renderSinglePageNav(allPages)}
<main class="single-page-content">
${contentHtml}
</main>
${this.renderLicense({ author, license })}
</div>
</body>
</html>`;
    }
    /**
     * Render navigation for single-page export (anchor links)
     * @param allPages - All pages
     * @returns Navigation HTML
     */
    renderSinglePageNav(allPages) {
      const rootPages = allPages.filter((p) => !p.parentId);
      let html = '<nav id="siteNav" class="single-page-nav">\n<ul>\n';
      for (const page of rootPages) {
        html += this.renderSinglePageNavItem(page, allPages);
      }
      html += "</ul>\n</nav>";
      return html;
    }
    /**
     * Render a single navigation item for single-page (anchor links)
     * @param page - Page
     * @param allPages - All pages
     * @returns Navigation item HTML
     */
    renderSinglePageNavItem(page, allPages) {
      const children = allPages.filter((p) => p.parentId === page.id);
      const hasChildren = children.length > 0;
      let html = "<li>";
      html += ` <a href="#section-${page.id}" class="${hasChildren ? "daddy" : "no-ch"}">${this.escapeHtml(page.title)}</a>
`;
      if (hasChildren) {
        html += '<ul class="other-section">\n';
        for (const child of children) {
          html += this.renderSinglePageNavItem(child, allPages);
        }
        html += "</ul>\n";
      }
      html += "</li>\n";
      return html;
    }
    /**
     * Escape HTML special characters
     * @param str - String to escape
     * @returns Escaped string
     */
    escapeHtml(str) {
      if (!str) return "";
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };
      return String(str).replace(/[&<>"']/g, (m) => map[m]);
    }
    /**
     * Escape attribute value for use in HTML attributes
     * @param str - String to escape
     * @returns Escaped string safe for attribute values
     */
    escapeAttr(str) {
      if (!str) return "";
      return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
  };

  // src/shared/export/utils/LibraryDetector.ts
  var LibraryDetector = class {
    constructor() {
      this.detectedLibraries = /* @__PURE__ */ new Set();
      this.filesToInclude = /* @__PURE__ */ new Set();
    }
    /**
     * Detect all required libraries by scanning HTML content
     * @param html - HTML content to scan
     * @param options - Detection options
     * @returns Detected libraries info
     */
    detectLibraries(html, options = {}) {
      this.detectedLibraries.clear();
      this.filesToInclude.clear();
      if (!html || typeof html !== "string") {
        return this._buildResult();
      }
      for (const lib of LIBRARY_PATTERNS) {
        if (this._matchesPattern(html, lib)) {
          if (lib.requiresLatexCheck) {
            if (!this._hasLatexInDataGame(html)) {
              continue;
            }
          }
          this._addLibrary(lib);
        }
      }
      if (options.includeAccessibilityToolbar) {
        const atoolsLib = LIBRARY_PATTERNS.find((l) => l.name === "exe_atools");
        if (atoolsLib) {
          this._addLibrary(atoolsLib);
        }
      }
      return this._buildResult();
    }
    /**
     * Check if HTML matches a library pattern
     * @param html - HTML content
     * @param lib - Library pattern definition
     * @returns True if pattern matches
     */
    _matchesPattern(html, lib) {
      switch (lib.type) {
        case "class":
          return new RegExp(`class="[^"]*${this._escapeRegex(lib.pattern)}[^"]*"`, "i").test(html);
        case "rel":
          return new RegExp(`rel="[^"]*${this._escapeRegex(lib.pattern)}[^"]*"`, "i").test(html);
        case "regex":
          return lib.pattern.test(html);
        default:
          return false;
      }
    }
    /**
     * Check if DataGame content contains LaTeX after decryption
     * @param html - HTML content
     * @returns True if LaTeX is found in decrypted DataGame content
     */
    _hasLatexInDataGame(html) {
      const match = html.match(/<div[^>]*class="[^"]*DataGame[^"]*"[^>]*>(.*?)<\/div>/s);
      if (!match) return false;
      const decrypted = this._decrypt(match[1]);
      return /\\\(|\\\[/.test(decrypted);
    }
    /**
     * Decrypt XOR-encoded string (matches Symfony's decrypt method)
     * @param str - Encrypted string
     * @returns Decrypted string
     */
    _decrypt(str) {
      if (!str || str === "undefined" || str === "null") return "";
      try {
        str = decodeURIComponent(str);
        const key = 146;
        let result = "";
        for (let i = 0; i < str.length; i++) {
          result += String.fromCharCode(key ^ str.charCodeAt(i));
        }
        return result;
      } catch {
        return "";
      }
    }
    /**
     * Add a library and its files to the detected set
     * @param lib - Library pattern
     */
    _addLibrary(lib) {
      if (this.detectedLibraries.has(lib.name)) return;
      this.detectedLibraries.add(lib.name);
      for (const file of lib.files) {
        this.filesToInclude.add(file);
      }
    }
    /**
     * Build the result object
     * @returns Detection result
     */
    _buildResult() {
      const libraries = [];
      for (const lib of LIBRARY_PATTERNS) {
        if (this.detectedLibraries.has(lib.name)) {
          libraries.push({
            name: lib.name,
            files: lib.files
          });
        }
      }
      return {
        libraries,
        files: Array.from(this.filesToInclude),
        count: libraries.length
      };
    }
    /**
     * Get base libraries (always included)
     * @returns Array of base library file paths
     */
    getBaseLibraries() {
      return [...BASE_LIBRARIES];
    }
    /**
     * Get SCORM-specific libraries
     * @returns Array of SCORM library file paths
     */
    getScormLibraries() {
      return [...SCORM_LIBRARIES];
    }
    /**
     * Get all files needed for export (base + detected)
     * @param html - HTML content to scan
     * @param options - Options
     * @returns Array of file paths
     */
    getAllRequiredFiles(html, options = {}) {
      const detected = this.detectLibraries(html, options);
      const files = new Set(this.getBaseLibraries());
      for (const file of detected.files) {
        files.add(file);
      }
      if (options.includeScorm) {
        for (const file of this.getScormLibraries()) {
          files.add(file);
        }
      }
      return Array.from(files);
    }
    /**
     * Group files by type for HTML head generation
     * @param files - Array of file paths
     * @returns Object with js and css arrays
     */
    groupFilesByType(files) {
      const js = [];
      const css = [];
      for (const file of files) {
        const ext = file.split(".").pop()?.toLowerCase();
        if (ext === "js") {
          js.push(file);
        } else if (ext === "css") {
          css.push(file);
        }
      }
      return { js, css };
    }
    /**
     * Escape special regex characters in a string
     * @param str - String to escape
     * @returns Escaped string
     */
    _escapeRegex(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  };

  // src/shared/export/exporters/BaseExporter.ts
  var BaseExporter = class {
    constructor(document2, resources, assets, zip2) {
      // Cache for asset filename lookups
      this.assetFilenameMap = null;
      this.document = document2;
      this.resources = resources;
      this.assets = assets;
      this.zip = zip2;
      this.ideviceRenderer = new IdeviceRenderer();
      this.pageRenderer = new PageRenderer(this.ideviceRenderer);
      this.libraryDetector = new LibraryDetector();
    }
    // =========================================================================
    // Structure Access Methods
    // =========================================================================
    /**
     * Get project metadata
     */
    getMetadata() {
      return this.document.getMetadata();
    }
    /**
     * Get navigation structure (pages)
     */
    getNavigation() {
      return this.document.getNavigation();
    }
    /**
     * Build a flat list of pages from the navigation structure
     */
    buildPageList() {
      return this.getNavigation();
    }
    /**
     * Get list of unique iDevice types used in the project
     */
    getUsedIdevices(pages) {
      const types = /* @__PURE__ */ new Set();
      for (const page of pages) {
        for (const block of page.blocks || []) {
          for (const component of block.components || []) {
            if (component.type) {
              types.add(component.type);
            }
          }
        }
      }
      return Array.from(types);
    }
    /**
     * Get list of iDevice types used in a specific page
     */
    getUsedIdevicesForPage(page) {
      const types = /* @__PURE__ */ new Set();
      for (const block of page.blocks || []) {
        for (const component of block.components || []) {
          if (component.type) {
            types.add(component.type);
          }
        }
      }
      return Array.from(types);
    }
    /**
     * Get root pages (pages without parent)
     */
    getRootPages(pages) {
      return pages.filter((p) => !p.parentId);
    }
    /**
     * Get child pages of a given page
     */
    getChildPages(parentId, pages) {
      return pages.filter((p) => p.parentId === parentId);
    }
    // =========================================================================
    // String Utilities
    // =========================================================================
    /**
     * Escape XML special characters
     */
    escapeXml(str) {
      if (!str) return "";
      return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
    }
    /**
     * Escape HTML special characters
     */
    escapeHtml(str) {
      if (!str) return "";
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };
      return String(str).replace(/[&<>"']/g, (m) => map[m]);
    }
    /**
     * Sanitize string for use as filename
     */
    sanitizeFilename(str, maxLength = 50) {
      if (!str) return "export";
      return str.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, maxLength);
    }
    /**
     * Sanitize page title for use as filename (with accent normalization)
     */
    sanitizePageFilename(title) {
      if (!title) return "page";
      return title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, 50);
    }
    /**
     * Generate unique identifier with optional prefix
     */
    generateId(prefix = "") {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 8);
      return `${prefix}${timestamp}${random}`.toUpperCase();
    }
    // =========================================================================
    // File Handling
    // =========================================================================
    /**
     * Build export filename from metadata
     */
    buildFilename() {
      const meta = this.getMetadata();
      const title = meta.title || "export";
      const sanitized = this.sanitizeFilename(title);
      return `${sanitized}${this.getFileSuffix()}${this.getFileExtension()}`;
    }
    /**
     * Add assets to ZIP
     */
    async addAssetsToZip(prefix = "") {
      let assetsAdded = 0;
      try {
        const assets = await this.assets.getAllAssets();
        for (const asset of assets) {
          const assetId = asset.id;
          const filename = asset.filename || `asset-${assetId}`;
          const assetPath = asset.originalPath || `${assetId}/${filename}`;
          const zipPath = prefix ? `${prefix}${assetPath}` : assetPath;
          this.zip.addFile(zipPath, asset.data);
          assetsAdded++;
        }
      } catch (e) {
        console.warn("[BaseExporter] Failed to add assets to ZIP:", e);
      }
      return assetsAdded;
    }
    /**
     * Add assets to ZIP with content/resources/ prefix
     */
    async addAssetsToZipWithResourcePath() {
      let assetsAdded = 0;
      try {
        const assets = await this.assets.getAllAssets();
        for (const asset of assets) {
          let assetPath = asset.originalPath || `${asset.id}/${asset.filename || `asset-${asset.id}`}`;
          if (assetPath.startsWith("content/resources/")) {
            assetPath = assetPath.substring("content/resources/".length);
          }
          if (assetPath.startsWith("content/")) {
            assetPath = assetPath.substring("content/".length);
          }
          const zipPath = `content/resources/${assetPath}`;
          this.zip.addFile(zipPath, asset.data);
          assetsAdded++;
        }
      } catch (e) {
        console.warn("[BaseExporter] Failed to add assets to ZIP:", e);
      }
      return assetsAdded;
    }
    // =========================================================================
    // Navigation Helpers
    // =========================================================================
    /**
     * Check if a page is an ancestor of another page
     */
    isAncestorOf(potentialAncestor, childId, allPages) {
      const child = allPages.find((p) => p.id === childId);
      if (!child || !child.parentId) return false;
      if (child.parentId === potentialAncestor.id) return true;
      return this.isAncestorOf(potentialAncestor, child.parentId, allPages);
    }
    /**
     * Get page link (index.html for first page, id.html for others)
     */
    getPageLink(page, allPages, extension = ".html") {
      if (page.id === allPages[0]?.id) {
        return `index${extension}`;
      }
      return `${page.id}${extension}`;
    }
    /**
     * Get previous page in flat list
     */
    getPreviousPage(currentPage, allPages) {
      const currentIndex = allPages.findIndex((p) => p.id === currentPage.id);
      return currentIndex > 0 ? allPages[currentIndex - 1] : null;
    }
    /**
     * Get next page in flat list
     */
    getNextPage(currentPage, allPages) {
      const currentIndex = allPages.findIndex((p) => p.id === currentPage.id);
      return currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;
    }
    // =========================================================================
    // Asset URL Transformation
    // =========================================================================
    /**
     * Get file extension from MIME type
     */
    getExtensionFromMime(mime) {
      const mimeToExt = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "image/svg+xml": ".svg",
        "image/bmp": ".bmp",
        "image/tiff": ".tiff",
        "image/x-icon": ".ico",
        "application/pdf": ".pdf",
        "video/mp4": ".mp4",
        "video/webm": ".webm",
        "video/ogg": ".ogv",
        "video/quicktime": ".mov",
        "audio/mpeg": ".mp3",
        "audio/ogg": ".ogg",
        "audio/wav": ".wav",
        "audio/webm": ".weba",
        "application/zip": ".zip",
        "application/json": ".json",
        "text/plain": ".txt",
        "text/html": ".html",
        "text/css": ".css",
        "application/javascript": ".js",
        "application/octet-stream": ".bin"
      };
      return mimeToExt[mime] || ".bin";
    }
    /**
     * Build asset filename map for URL transformation
     */
    async buildAssetFilenameMap() {
      if (this.assetFilenameMap) {
        return this.assetFilenameMap;
      }
      this.assetFilenameMap = /* @__PURE__ */ new Map();
      try {
        const assets = await this.assets.getAllAssets();
        for (const asset of assets) {
          const id = asset.id;
          let filename = asset.filename;
          if (!filename) {
            const ext = this.getExtensionFromMime(asset.mimeType || "application/octet-stream");
            filename = `asset-${id.substring(0, 8)}${ext}`;
          }
          this.assetFilenameMap.set(id, filename);
        }
      } catch (e) {
        console.warn("[BaseExporter] Failed to build asset map:", e);
      }
      return this.assetFilenameMap;
    }
    /**
     * Add filenames to asset:// URLs without changing the protocol
     * Transforms asset://uuid to asset://uuid/filename.ext
     */
    async addFilenamesToAssetUrls(content) {
      if (!content) return "";
      const assetMap = await this.buildAssetFilenameMap();
      if (assetMap.size === 0) {
        return content;
      }
      return content.replace(/asset:\/\/([a-f0-9-]+)(?![/a-zA-Z0-9._-])/gi, (match, uuid) => {
        const filename = assetMap.get(uuid);
        if (filename) {
          return `asset://${uuid}/${filename}`;
        }
        return match;
      });
    }
    /**
     * Pre-process pages to add filenames to asset URLs in all component content
     * Also replaces exe-package:elp protocol for download-source-file iDevice
     */
    async preprocessPagesForExport(pages) {
      const meta = this.getMetadata();
      const projectTitle = meta.title || "eXeLearning";
      for (const page of pages) {
        for (const block of page.blocks || []) {
          for (const component of block.components || []) {
            if (component.content) {
              component.content = await this.addFilenamesToAssetUrls(component.content);
              component.content = this.replaceElpxProtocol(component.content, projectTitle);
            }
          }
        }
      }
      return pages;
    }
    /**
     * Replace exe-package:elp protocol with client-side download handler
     * This enables the download-source-file iDevice to generate ELPX files on-the-fly
     *
     * @param content - HTML content
     * @param projectTitle - Project title for the download filename
     * @returns Content with exe-package:elp replaced with onclick handler
     */
    replaceElpxProtocol(content, projectTitle) {
      if (!content) return "";
      if (!content.includes("exe-package:elp")) {
        return content;
      }
      let result = content.replace(
        /href="exe-package:elp"/g,
        `href="#" onclick="if(typeof downloadElpx==='function')downloadElpx();return false;"`
      );
      const safeTitle = this.escapeXml(projectTitle);
      result = result.replace(/download="exe-package:elp-name"/g, `download="${safeTitle}.elpx"`);
      return result;
    }
    /**
     * Collect all HTML content from all pages (for library detection)
     */
    collectAllHtmlContent(pages) {
      const htmlParts = [];
      for (const page of pages) {
        for (const block of page.blocks || []) {
          for (const component of block.components || []) {
            if (component.content) {
              htmlParts.push(component.content);
            }
          }
        }
      }
      return htmlParts.join("\n");
    }
    // =========================================================================
    // Content XML Generation (for re-import capability)
    // =========================================================================
    /**
     * Generate content.xml from document structure
     */
    generateContentXml() {
      const metadata = this.getMetadata();
      const pages = this.getNavigation();
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">\n';
      xml += this.generatePropertiesXml(metadata);
      xml += "<odeNavStructures>\n";
      for (let i = 0; i < pages.length; i++) {
        xml += this.generatePageXml(pages[i], i);
      }
      xml += "</odeNavStructures>\n";
      xml += "</ode>";
      return xml;
    }
    /**
     * Generate properties XML section
     */
    generatePropertiesXml(metadata) {
      let xml = "<odeProperties>\n";
      const props = {
        pp_title: metadata.title || "Untitled",
        pp_author: metadata.author || "",
        pp_lang: metadata.language || "en",
        pp_description: metadata.description || "",
        pp_license: metadata.license || "",
        pp_theme: metadata.theme || "base",
        // Export options
        pp_addExeLink: String(metadata.addExeLink ?? true),
        pp_addPagination: String(metadata.addPagination ?? false),
        pp_addSearchBox: String(metadata.addSearchBox ?? false),
        pp_addAccessibilityToolbar: String(metadata.addAccessibilityToolbar ?? false),
        exportSource: String(metadata.exportSource ?? true)
      };
      if (metadata.extraHeadContent) {
        props["pp_extraHeadContent"] = metadata.extraHeadContent;
      }
      if (metadata.footer) {
        props["footer"] = metadata.footer;
      }
      for (const [key, value] of Object.entries(props)) {
        xml += `  <${key}>${this.escapeXml(value)}</${key}>
`;
      }
      xml += "</odeProperties>\n";
      return xml;
    }
    /**
     * Generate page XML
     */
    generatePageXml(page, index) {
      const pageId = page.id;
      const pageName = page.title || "Page";
      const parentId = page.parentId || "";
      const order = page.order ?? index;
      let xml = `<odeNavStructure odeNavStructureId="${this.escapeXml(pageId)}" `;
      xml += `odePageName="${this.escapeXml(pageName)}" odeNavStructureOrder="${order}" `;
      if (parentId) {
        xml += `parentOdeNavStructureId="${this.escapeXml(parentId)}" `;
      }
      xml += `>
`;
      for (let i = 0; i < (page.blocks || []).length; i++) {
        xml += this.generateBlockXml(page.blocks[i], i);
      }
      xml += "</odeNavStructure>\n";
      return xml;
    }
    /**
     * Generate block XML
     */
    generateBlockXml(block, index) {
      const blockId = block.id;
      const blockName = block.name || "";
      const order = block.order ?? index;
      let xml = `  <odePagStructure odePagStructureId="${this.escapeXml(blockId)}" `;
      xml += `blockName="${this.escapeXml(blockName)}" odePagStructureOrder="${order}">
`;
      for (let i = 0; i < (block.components || []).length; i++) {
        xml += this.generateComponentXml(block.components[i], i);
      }
      xml += "  </odePagStructure>\n";
      return xml;
    }
    /**
     * Generate component XML
     */
    generateComponentXml(component, index) {
      const compId = component.id;
      const ideviceType = component.type || "FreeTextIdevice";
      const order = component.order ?? index;
      let xml = `    <odeComponent odeComponentId="${this.escapeXml(compId)}" `;
      xml += `odeIdeviceTypeDirName="${this.escapeXml(ideviceType)}" odeComponentOrder="${order}">
`;
      if (component.content) {
        xml += `      <htmlView><![CDATA[${component.content}]]></htmlView>
`;
      }
      if (component.properties && Object.keys(component.properties).length > 0) {
        xml += `      <jsonProperties><![CDATA[${JSON.stringify(component.properties)}]]></jsonProperties>
`;
      }
      xml += "    </odeComponent>\n";
      return xml;
    }
    // =========================================================================
    // Fallback Styles (used when resources can't be fetched)
    // =========================================================================
    /**
     * Get base CSS content
     */
    getBaseCss() {
      return `.exe-content{
  background: #fff;
}
.exe-content .page-title{
  font-size: 1.45em;
}
.exe-content .box{
  margin-top: 20px;
  border: 1px solid #dbdbdb;
}
.exe-content a{
  color: #5a7f0c;
}
.exe-content a:hover,
.exe-content a:focus{
  color: #71a300;
}
.exe-content h2{ font-size: 1.45em; }
.exe-content h3{ font-size: 1.35em; }
.exe-content h4{ font-size: 1.25em; }
.exe-content h5{ font-size: 1.15em; }

/* iDevice styles */
.iDevice_wrapper {
  margin-bottom: 25px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  background: #fff;
}
.iDevice_content {
  line-height: 1.8;
}
.iDevice_content img {
  max-width: 100%;
  height: auto;
}

/* Navigation */
#siteNav {
  background: #34495e;
  color: #fff;
  padding: 15px 20px;
  min-width: 220px;
}
#siteNav ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
#siteNav li {
  margin: 5px 0;
}
#siteNav a {
  color: #ecf0f1;
  text-decoration: none;
  display: block;
  padding: 5px 10px;
  border-radius: 4px;
}
#siteNav a:hover {
  background: rgba(255,255,255,0.1);
}
#siteNav .active > a,
#siteNav a.active {
  background: #3498db;
  font-weight: bold;
}
#siteNav ul ul {
  padding-left: 15px;
}

/* Pagination */
.pagination {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}
.pagination a {
  color: #3498db;
  text-decoration: none;
}
.pagination a:hover {
  text-decoration: underline;
}

/* Footer */
#packageLicense {
  margin-top: 30px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 0.9em;
  color: #666;
}

/* Responsive */
@media (min-width: 768px) {
  .exe-content {
    display: flex;
    flex-direction: row;
  }
  #siteNav {
    width: 250px;
    flex-shrink: 0;
  }
  main.page {
    flex: 1;
    padding: 20px 30px;
    max-width: 900px;
  }
}

/* Made with eXeLearning */
#made-with-eXe {
  margin: 0;
  position: fixed;
  bottom: 0;
  right: 0;
}
#made-with-eXe a {
  text-decoration: none;
  box-shadow: rgba(0, 0, 0, 0.35) 0px 5px 15px;
  border-top-left-radius: 4px;
  color: #222;
  font-size: 11px;
  font-family: Arial, sans-serif;
  line-height: 35px;
  width: 35px;
  height: 35px;
  background: #fff url(../img/exe_powered_logo.png) no-repeat 3px 50%;
  display: block;
  background-size: auto 20px;
  transition: .5s;
  opacity: .8;
}
#made-with-eXe span {
  padding-left: 35px;
  padding-right: 5px;
}
#made-with-eXe span span {
  position: absolute;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip: rect(0, 0, 0, 0);
  height: 0;
}
#made-with-eXe a:hover {
  width: auto;
  padding: 0 5px;
  background-position: 5px 50%;
  opacity: 1;
}
@media print {
  #made-with-eXe { display: none; }
}
`;
    }
    /**
     * Get fallback theme CSS
     */
    getFallbackThemeCss() {
      return `/* Default theme CSS */
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  margin: 0;
  padding: 0;
  line-height: 1.6;
}
`;
    }
    /**
     * Get fallback theme JS
     */
    getFallbackThemeJs() {
      return `// Default theme JS
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    // Theme initialization
    console.log('[Theme] Default theme loaded');
  });
})();
`;
    }
  };

  // src/shared/export/exporters/Html5Exporter.ts
  var Html5Exporter = class extends BaseExporter {
    constructor(document2, resources, assets, zip2) {
      super(document2, resources, assets, zip2);
    }
    /**
     * Get file extension for HTML5 format
     */
    getFileExtension() {
      return ".zip";
    }
    /**
     * Get file suffix for HTML5 format
     */
    getFileSuffix() {
      return "_web";
    }
    /**
     * Export to HTML5 ZIP
     */
    async export(options) {
      const exportFilename = options?.filename || this.buildFilename();
      const html5Options = options;
      try {
        let pages = this.buildPageList();
        const meta = this.getMetadata();
        const themeName = html5Options?.theme || meta.theme || "base";
        pages = await this.preprocessPagesForExport(pages);
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          const html = this.generatePageHtml(page, pages, meta, i === 0, i);
          const pageFilename = i === 0 ? "index.html" : `html/${this.sanitizePageFilename(page.title)}.html`;
          this.zip.addFile(pageFilename, html);
        }
        if (meta.addSearchBox) {
          const searchIndexContent = this.pageRenderer.generateSearchIndexFile(pages, "");
          this.zip.addFile("search_index.js", searchIndexContent);
        }
        if (meta.exportSource !== false) {
          const contentXml = this.generateContentXml();
          this.zip.addFile("content.xml", contentXml);
        }
        this.zip.addFile("content/css/base.css", this.getBaseCss());
        try {
          const logoData = await this.resources.fetchExeLogo();
          if (logoData) {
            this.zip.addFile("content/img/exe_powered_logo.png", logoData);
          }
        } catch {
        }
        try {
          const themeFiles = await this.resources.fetchTheme(themeName);
          console.log(`[Html5Exporter] Theme '${themeName}' files count: ${themeFiles.size}`);
          for (const [filePath, content] of themeFiles) {
            let exportPath = filePath;
            if (filePath === "style.css") {
              exportPath = "content.css";
            } else if (filePath === "style.js") {
              exportPath = "default.js";
            }
            console.log(`[Html5Exporter] Adding theme file: theme/${exportPath}`);
            this.zip.addFile(`theme/${exportPath}`, content);
          }
        } catch (e) {
          console.warn(`[Html5Exporter] Failed to fetch theme: ${themeName}`, e);
          this.zip.addFile("theme/content.css", this.getFallbackThemeCss());
          this.zip.addFile("theme/default.js", this.getFallbackThemeJs());
        }
        const allHtmlContent = this.collectAllHtmlContent(pages);
        const allRequiredFiles = this.libraryDetector.getAllRequiredFiles(allHtmlContent, {
          includeAccessibilityToolbar: meta.addAccessibilityToolbar === true
        });
        try {
          const libFiles = await this.resources.fetchLibraryFiles(allRequiredFiles);
          for (const [path, content] of libFiles) {
            this.zip.addFile(`libs/${path}`, content);
          }
        } catch {
          try {
            const baseLibs = await this.resources.fetchBaseLibraries();
            for (const [path, content] of baseLibs) {
              this.zip.addFile(`libs/${path}`, content);
            }
          } catch {
          }
        }
        const usedIdevices = this.getUsedIdevices(pages);
        for (const idevice of usedIdevices) {
          try {
            const normalizedType = this.resources.normalizeIdeviceType(idevice);
            const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
            for (const [filePath, content] of ideviceFiles) {
              this.zip.addFile(`idevices/${normalizedType}/${filePath}`, content);
            }
          } catch {
          }
        }
        await this.addAssetsToZipWithResourcePath();
        const buffer = await this.zip.generateAsync();
        return {
          success: true,
          filename: exportFilename,
          data: buffer
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    /**
     * Generate complete HTML for a page
     */
    generatePageHtml(page, allPages, meta, isIndex, pageIndex) {
      const basePath = isIndex ? "" : "../";
      const usedIdevices = this.getUsedIdevicesForPage(page);
      const currentPageIndex = pageIndex ?? allPages.findIndex((p) => p.id === page.id);
      return this.pageRenderer.render(page, {
        projectTitle: meta.title || "eXeLearning",
        language: meta.language || "en",
        theme: meta.theme || "base",
        customStyles: meta.customStyles || "",
        allPages,
        basePath,
        isIndex,
        usedIdevices,
        author: meta.author || "",
        license: meta.license || "creative commons: attribution - share alike 4.0",
        description: meta.description || "",
        licenseUrl: meta.licenseUrl || "https://creativecommons.org/licenses/by-sa/4.0/",
        // Page counter options
        totalPages: allPages.length,
        currentPageIndex,
        userFooterContent: meta.footer,
        // Export options
        addExeLink: meta.addExeLink ?? true,
        addPagination: meta.addPagination ?? false,
        addSearchBox: meta.addSearchBox ?? false,
        addAccessibilityToolbar: meta.addAccessibilityToolbar ?? false,
        // Custom head content
        extraHeadContent: meta.extraHeadContent
      });
    }
    /**
     * Get page link for HTML5 export
     */
    getPageLinkForHtml5(page, allPages, basePath) {
      const isFirstPage = page.id === allPages[0]?.id;
      if (isFirstPage) {
        return basePath ? `${basePath}index.html` : "index.html";
      }
      const filename = this.sanitizePageFilename(page.title);
      return `${basePath}html/${filename}.html`;
    }
  };

  // src/shared/export/exporters/PageExporter.ts
  var PageExporter = class extends Html5Exporter {
    constructor(document2, resources, assets, zip2) {
      super(document2, resources, assets, zip2);
    }
    /**
     * Get file suffix for PAGE format
     */
    getFileSuffix() {
      return "_page";
    }
    /**
     * Export to single-page HTML ZIP
     */
    async export(options) {
      const exportFilename = options?.filename || this.buildFilename();
      try {
        let pages = this.buildPageList();
        const meta = this.getMetadata();
        const themeName = options?.theme || meta.theme || "base";
        pages = await this.preprocessPagesForExport(pages);
        const usedIdevices = this.getUsedIdevices(pages);
        const html = this.generateSinglePageHtml(pages, meta, usedIdevices);
        this.zip.addFile("index.html", html);
        const contentXml = this.generateContentXml();
        this.zip.addFile("content.xml", contentXml);
        this.zip.addFile("content/css/base.css", this.getBaseCss());
        this.zip.addFile("content/css/single-page.css", this.getSinglePageCss());
        try {
          const themeFiles = await this.resources.fetchTheme(themeName);
          for (const [path, content] of themeFiles) {
            this.zip.addFile(`theme/${path}`, content);
          }
        } catch {
          this.zip.addFile("theme/content.css", this.getFallbackThemeCss());
          this.zip.addFile("theme/default.js", this.getFallbackThemeJs());
        }
        try {
          const baseLibs = await this.resources.fetchBaseLibraries();
          for (const [path, content] of baseLibs) {
            this.zip.addFile(`libs/${path}`, content);
          }
        } catch {
        }
        for (const idevice of usedIdevices) {
          try {
            const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
            for (const [path, content] of ideviceFiles) {
              this.zip.addFile(`idevices/${idevice}/${path}`, content);
            }
          } catch {
          }
        }
        await this.addAssetsToZipWithResourcePath();
        const buffer = await this.zip.generateAsync();
        return {
          success: true,
          filename: exportFilename,
          data: buffer
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    /**
     * Generate single-page HTML with all pages
     */
    generateSinglePageHtml(pages, meta, usedIdevices) {
      return this.pageRenderer.renderSinglePage(pages, {
        projectTitle: meta.title || "eXeLearning",
        language: meta.language || "en",
        theme: meta.theme || "base",
        customStyles: meta.customStyles || "",
        usedIdevices,
        author: meta.author || "",
        license: meta.license || "CC-BY-SA"
      });
    }
    /**
     * Get CSS specific to single-page layout
     */
    getSinglePageCss() {
      return `/* Single-page specific styles */
.exe-single-page .single-page-section {
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 40px;
  margin-bottom: 40px;
}

.exe-single-page .single-page-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.exe-single-page .single-page-nav {
  position: sticky;
  top: 0;
  max-height: 100vh;
  overflow-y: auto;
}

.exe-single-page .single-page-content {
  padding: 20px 30px;
}

/* Smooth scrolling for anchor links */
html {
  scroll-behavior: smooth;
}

/* Section target offset for fixed header */
.single-page-section:target {
  scroll-margin-top: 20px;
}

/* Print styles for single page */
@media print {
  .exe-single-page .single-page-nav {
    display: none;
  }
  .exe-single-page .single-page-section {
    page-break-inside: avoid;
  }
}
`;
    }
  };

  // src/shared/export/generators/Scorm12Manifest.ts
  var Scorm12ManifestGenerator = class {
    /**
     * @param projectId - Unique project identifier
     * @param pages - Pages from navigation structure
     * @param metadata - Project metadata
     */
    constructor(projectId, pages, metadata = {}) {
      this.projectId = projectId || this.generateId();
      this.pages = pages || [];
      this.metadata = metadata;
    }
    /**
     * Generate a unique ID for the project
     * @returns Unique ID string
     */
    generateId() {
      return "exe-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    }
    /**
     * Generate complete imsmanifest.xml content
     * @param options - Generation options
     * @returns Complete XML string
     */
    generate(options = {}) {
      const { commonFiles = [], pageFiles = {} } = options;
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += this.generateManifestOpen();
      xml += this.generateMetadata();
      xml += this.generateOrganizations();
      xml += this.generateResources(commonFiles, pageFiles);
      xml += "</manifest>\n";
      return xml;
    }
    /**
     * Generate manifest opening tag with namespaces
     * @returns Manifest opening XML
     */
    generateManifestOpen() {
      return `<manifest identifier="eXe-MANIFEST-${this.escapeXml(this.projectId)}"
  xmlns="${SCORM_12_NAMESPACES.imscp}"
  xmlns:adlcp="${SCORM_12_NAMESPACES.adlcp}"
  xmlns:imsmd="${SCORM_12_NAMESPACES.imsmd}"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCORM_12_NAMESPACES.imscp} imscp_rootv1p1p2.xsd
    ${SCORM_12_NAMESPACES.imsmd} imsmd_v1p2p2.xsd
    ${SCORM_12_NAMESPACES.adlcp} adlcp_rootv1p2.xsd">
`;
    }
    /**
     * Generate metadata section
     * @returns Metadata XML
     */
    generateMetadata() {
      let xml = "  <metadata>\n";
      xml += "    <schema>ADL SCORM</schema>\n";
      xml += "    <schemaversion>1.2</schemaversion>\n";
      xml += "    <adlcp:location>imslrm.xml</adlcp:location>\n";
      xml += "  </metadata>\n";
      return xml;
    }
    /**
     * Generate organizations section with hierarchical structure
     * @returns Organizations XML
     */
    generateOrganizations() {
      const orgId = `eXe-${this.projectId}`;
      const title = this.metadata.title || "eXeLearning";
      let xml = `  <organizations default="${this.escapeXml(orgId)}">
`;
      xml += `    <organization identifier="${this.escapeXml(orgId)}" structure="hierarchical">
`;
      xml += `      <title>${this.escapeXml(title)}</title>
`;
      xml += this.generateItems();
      xml += "    </organization>\n";
      xml += "  </organizations>\n";
      return xml;
    }
    /**
     * Generate item elements for pages in hierarchical structure
     * @returns Items XML
     */
    generateItems() {
      const pageMap = /* @__PURE__ */ new Map();
      for (const page of this.pages) {
        pageMap.set(page.id, page);
      }
      const rootPages = this.pages.filter((p) => !p.parentId);
      let xml = "";
      for (const page of rootPages) {
        xml += this.generateItemRecursive(page, pageMap, 3);
      }
      return xml;
    }
    /**
     * Generate item element recursively for nested pages
     * @param page - Page object
     * @param pageMap - Map of all pages by ID
     * @param indent - Indentation level
     * @returns Item XML
     */
    generateItemRecursive(page, pageMap, indent) {
      const indentStr = "  ".repeat(indent);
      const isVisible = "true";
      let xml = `${indentStr}<item identifier="ITEM-${this.escapeXml(page.id)}" identifierref="RES-${this.escapeXml(page.id)}" isvisible="${isVisible}">
`;
      xml += `${indentStr}  <title>${this.escapeXml(page.title || "Page")}</title>
`;
      const children = this.pages.filter((p) => p.parentId === page.id);
      for (const child of children) {
        xml += this.generateItemRecursive(child, pageMap, indent + 1);
      }
      xml += `${indentStr}</item>
`;
      return xml;
    }
    /**
     * Generate resources section
     * @param commonFiles - List of common file paths
     * @param pageFiles - Map of pageId to file info
     * @returns Resources XML
     */
    generateResources(commonFiles, pageFiles) {
      let xml = "  <resources>\n";
      for (const page of this.pages) {
        const pageFile = pageFiles[page.id] || {};
        xml += this.generatePageResource(page, pageFile);
      }
      xml += this.generateCommonFilesResource(commonFiles);
      xml += "  </resources>\n";
      return xml;
    }
    /**
     * Generate resource element for a page
     * @param page - Page object
     * @param pageFile - Page file info
     * @returns Resource XML
     */
    generatePageResource(page, pageFile) {
      const pageId = page.id;
      const isIndex = this.pages.indexOf(page) === 0;
      const fileUrl = pageFile.fileUrl || (isIndex ? "index.html" : `html/${this.sanitizeFilename(page.title)}.html`);
      let xml = `    <resource identifier="RES-${this.escapeXml(pageId)}" type="webcontent" adlcp:scormtype="sco" href="${this.escapeXml(fileUrl)}">
`;
      xml += `      <file href="${this.escapeXml(fileUrl)}"/>
`;
      const files = pageFile.files || [];
      for (const file of files) {
        xml += `      <file href="${this.escapeXml(file)}"/>
`;
      }
      xml += '      <dependency identifierref="COMMON_FILES"/>\n';
      xml += "    </resource>\n";
      return xml;
    }
    /**
     * Generate COMMON_FILES resource for shared assets
     * @param commonFiles - List of common file paths
     * @returns Resource XML
     */
    generateCommonFilesResource(commonFiles) {
      let xml = '    <resource identifier="COMMON_FILES" type="webcontent" adlcp:scormtype="asset">\n';
      for (const file of commonFiles) {
        xml += `      <file href="${this.escapeXml(file)}"/>
`;
      }
      xml += "    </resource>\n";
      return xml;
    }
    /**
     * Escape XML special characters
     * @param str - String to escape
     * @returns Escaped string
     */
    escapeXml(str) {
      if (!str) return "";
      return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
    /**
     * Sanitize filename for use in paths
     * @param title - Title to sanitize
     * @returns Sanitized filename
     */
    sanitizeFilename(title) {
      if (!title) return "page";
      return title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, 50);
    }
  };

  // src/shared/export/generators/LomMetadata.ts
  var TRANSLATIONS = {
    "Metadata creation date": {
      en: "Metadata creation date",
      es: "Fecha de creaci\xF3n de los metadatos",
      fr: "Date de cr\xE9ation des m\xE9tadonn\xE9es",
      de: "Erstellungsdatum der Metadaten",
      pt: "Data de cria\xE7\xE3o dos metadados",
      ca: "Data de creaci\xF3 de les metadades",
      eu: "Metadatuen sorrera data",
      gl: "Data de creaci\xF3n dos metadatos"
    }
  };
  var LomMetadataGenerator = class {
    /**
     * @param projectId - Unique project identifier
     * @param metadata - Project metadata
     */
    constructor(projectId, metadata = {}) {
      this.projectId = projectId || this.generateId();
      this.metadata = metadata;
    }
    /**
     * Generate a unique ID for the project
     * @returns Unique ID string
     */
    generateId() {
      return "exe-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    }
    /**
     * Generate complete imslrm.xml content
     * @returns Complete XML string
     */
    generate() {
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += this.generateLomOpen();
      xml += this.generateGeneral();
      xml += this.generateLifeCycle();
      xml += this.generateMetaMetadata();
      xml += this.generateTechnical();
      xml += this.generateEducational();
      xml += this.generateRights();
      xml += "</lom>\n";
      return xml;
    }
    /**
     * Generate lom opening tag with namespaces
     * @returns LOM opening XML
     */
    generateLomOpen() {
      return `<lom xmlns="${LOM_NAMESPACES.lom}"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${LOM_NAMESPACES.lom} lomCustom.xsd">
`;
    }
    /**
     * Generate general section
     * @returns General XML
     */
    generateGeneral() {
      const title = this.metadata.title || "eXe-p-" + this.projectId;
      const lang = this.metadata.language || "en";
      const description = this.metadata.description || "";
      const catalogName = this.metadata.catalogName || "none";
      const catalogEntry = this.metadata.catalogEntry || "ODE-" + this.projectId;
      let xml = '  <general uniqueElementName="general">\n';
      xml += "    <identifier>\n";
      xml += `      <catalog uniqueElementName="catalog">${this.escapeXml(catalogName)}</catalog>
`;
      xml += `      <entry uniqueElementName="entry">${this.escapeXml(catalogEntry)}</entry>
`;
      xml += "    </identifier>\n";
      xml += "    <title>\n";
      xml += `      <string language="${this.escapeXml(lang)}">${this.escapeXml(title)}</string>
`;
      xml += "    </title>\n";
      xml += `    <language>${this.escapeXml(lang)}</language>
`;
      xml += "    <description>\n";
      xml += `      <string language="${this.escapeXml(lang)}">${this.escapeXml(description)}</string>
`;
      xml += "    </description>\n";
      xml += '    <aggregationLevel uniqueElementName="aggregationLevel">\n';
      xml += '      <source uniqueElementName="source">LOM-ESv1.0</source>\n';
      xml += '      <value uniqueElementName="value">2</value>\n';
      xml += "    </aggregationLevel>\n";
      xml += "  </general>\n";
      return xml;
    }
    /**
     * Generate lifeCycle section
     * @returns LifeCycle XML
     */
    generateLifeCycle() {
      const author = this.metadata.author || "";
      const lang = this.metadata.language || "en";
      const dateTime = this.getCurrentDateTime();
      let xml = "  <lifeCycle>\n";
      xml += "    <contribute>\n";
      xml += '      <role uniqueElementName="role">\n';
      xml += '        <source uniqueElementName="source">LOM-ESv1.0</source>\n';
      xml += '        <value uniqueElementName="value">author</value>\n';
      xml += "      </role>\n";
      const vcard = `BEGIN:VCARD VERSION:3.0 FN:${author} EMAIL;TYPE=INTERNET: ORG: END:VCARD`;
      xml += `      <entity>${this.escapeXml(vcard)}</entity>
`;
      xml += "      <date>\n";
      xml += `        <dateTime uniqueElementName="dateTime">${dateTime}</dateTime>
`;
      xml += "        <description>\n";
      xml += `          <string language="${this.escapeXml(lang)}">${this.getLocalizedString("Metadata creation date", lang)}</string>
`;
      xml += "        </description>\n";
      xml += "      </date>\n";
      xml += "    </contribute>\n";
      xml += "  </lifeCycle>\n";
      return xml;
    }
    /**
     * Generate metaMetadata section
     * @returns MetaMetadata XML
     */
    generateMetaMetadata() {
      const author = this.metadata.author || "";
      const lang = this.metadata.language || "en";
      const dateTime = this.getCurrentDateTime();
      let xml = '  <metaMetadata uniqueElementName="metaMetadata">\n';
      xml += "    <contribute>\n";
      xml += '      <role uniqueElementName="role">\n';
      xml += '        <source uniqueElementName="source">LOM-ESv1.0</source>\n';
      xml += '        <value uniqueElementName="value">creator</value>\n';
      xml += "      </role>\n";
      const vcard = `BEGIN:VCARD VERSION:3.0 FN:${author} EMAIL;TYPE=INTERNET: ORG: END:VCARD`;
      xml += `      <entity>${this.escapeXml(vcard)}</entity>
`;
      xml += "      <date>\n";
      xml += `        <dateTime uniqueElementName="dateTime">${dateTime}</dateTime>
`;
      xml += "        <description>\n";
      xml += `          <string language="${this.escapeXml(lang)}">${this.getLocalizedString("Metadata creation date", lang)}</string>
`;
      xml += "        </description>\n";
      xml += "      </date>\n";
      xml += "    </contribute>\n";
      xml += "    <metadataSchema>LOM-ESv1.0</metadataSchema>\n";
      xml += `    <language>${this.escapeXml(lang)}</language>
`;
      xml += "  </metaMetadata>\n";
      return xml;
    }
    /**
     * Generate technical section
     * @returns Technical XML
     */
    generateTechnical() {
      const lang = this.metadata.language || "en";
      let xml = '  <technical uniqueElementName="technical">\n';
      xml += "    <otherPlatformRequirements>\n";
      xml += `      <string language="${this.escapeXml(lang)}">editor: eXe Learning</string>
`;
      xml += "    </otherPlatformRequirements>\n";
      xml += "  </technical>\n";
      return xml;
    }
    /**
     * Generate educational section
     * @returns Educational XML
     */
    generateEducational() {
      const lang = this.metadata.language || "en";
      let xml = "  <educational>\n";
      xml += `    <language>${this.escapeXml(lang)}</language>
`;
      xml += "  </educational>\n";
      return xml;
    }
    /**
     * Generate rights section
     * @returns Rights XML
     */
    generateRights() {
      const license = this.metadata.license || "";
      let xml = '  <rights uniqueElementName="rights">\n';
      xml += '    <copyrightAndOtherRestrictions uniqueElementName="copyrightAndOtherRestrictions">\n';
      xml += '      <source uniqueElementName="source">LOM-ESv1.0</source>\n';
      xml += `      <value uniqueElementName="value">${this.escapeXml(license)}</value>
`;
      xml += "    </copyrightAndOtherRestrictions>\n";
      xml += '    <access uniqueElementName="access">\n';
      xml += '      <accessType uniqueElementName="accessType">\n';
      xml += '        <source uniqueElementName="source">LOM-ESv1.0</source>\n';
      xml += '        <value uniqueElementName="value">universal</value>\n';
      xml += "      </accessType>\n";
      xml += "      <description>\n";
      xml += '        <string language="en">Default</string>\n';
      xml += "      </description>\n";
      xml += "    </access>\n";
      xml += "  </rights>\n";
      return xml;
    }
    /**
     * Get current date/time in ISO format with timezone
     * @returns ISO date time string
     */
    getCurrentDateTime() {
      const now = /* @__PURE__ */ new Date();
      const offset = now.getTimezoneOffset();
      const offsetHours = Math.abs(Math.floor(offset / 60)).toString().padStart(2, "0");
      const offsetMinutes = Math.abs(offset % 60).toString().padStart(2, "0");
      const offsetSign = offset <= 0 ? "+" : "-";
      const year = now.getFullYear();
      const month = (now.getMonth() + 1).toString().padStart(2, "0");
      const day = now.getDate().toString().padStart(2, "0");
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const seconds = now.getSeconds().toString().padStart(2, "0");
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.00${offsetSign}${offsetHours}:${offsetMinutes}`;
    }
    /**
     * Get localized string (basic implementation)
     * @param key - Translation key
     * @param lang - Language code
     * @returns Localized string
     */
    getLocalizedString(key, lang) {
      const langShort = lang.substring(0, 2).toLowerCase();
      if (TRANSLATIONS[key] && TRANSLATIONS[key][langShort]) {
        return TRANSLATIONS[key][langShort];
      }
      return TRANSLATIONS[key]?.en || key;
    }
    /**
     * Escape XML special characters
     * @param str - String to escape
     * @returns Escaped string
     */
    escapeXml(str) {
      if (!str) return "";
      return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
  };

  // src/shared/export/exporters/Scorm12Exporter.ts
  var Scorm12Exporter = class extends Html5Exporter {
    constructor(document2, resources, assets, zip2) {
      super(document2, resources, assets, zip2);
      this.manifestGenerator = null;
      this.lomGenerator = null;
    }
    /**
     * Get file suffix for SCORM 1.2 format
     */
    getFileSuffix() {
      return "_scorm12";
    }
    /**
     * Export to SCORM 1.2 ZIP
     */
    async export(options) {
      const exportFilename = options?.filename || this.buildFilename();
      try {
        let pages = this.buildPageList();
        const meta = this.getMetadata();
        const themeName = options?.theme || meta.theme || "base";
        const projectId = this.generateProjectId();
        pages = await this.preprocessPagesForExport(pages);
        this.manifestGenerator = new Scorm12ManifestGenerator(projectId, pages, {
          title: meta.title || "eXeLearning",
          language: meta.language || "en",
          author: meta.author || "",
          description: meta.description || "",
          license: meta.license || ""
        });
        this.lomGenerator = new LomMetadataGenerator(projectId, {
          title: meta.title || "eXeLearning",
          language: meta.language || "en",
          author: meta.author || "",
          description: meta.description || "",
          license: meta.license || ""
        });
        const commonFiles = [];
        const pageFiles = {};
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          const isIndex = i === 0;
          const html = this.generateScormPageHtml(page, pages, meta, isIndex);
          const pageFilename = isIndex ? "index.html" : `html/${this.sanitizePageFilename(page.title)}.html`;
          this.zip.addFile(pageFilename, html);
          pageFiles[page.id] = {
            fileUrl: pageFilename,
            files: []
          };
        }
        if (meta.addSearchBox) {
          const searchIndexContent = this.pageRenderer.generateSearchIndexFile(pages, "");
          this.zip.addFile("search_index.js", searchIndexContent);
          commonFiles.push("search_index.js");
        }
        this.zip.addFile("content/css/base.css", this.getBaseCss());
        commonFiles.push("content/css/base.css");
        try {
          const themeFiles = await this.resources.fetchTheme(themeName);
          for (const [filePath, content] of themeFiles) {
            let exportPath = filePath;
            if (filePath === "style.css") {
              exportPath = "content.css";
            } else if (filePath === "style.js") {
              exportPath = "default.js";
            }
            this.zip.addFile(`theme/${exportPath}`, content);
            commonFiles.push(`theme/${exportPath}`);
          }
        } catch {
          this.zip.addFile("theme/content.css", this.getFallbackThemeCss());
          this.zip.addFile("theme/default.js", this.getFallbackThemeJs());
          commonFiles.push("theme/content.css", "theme/default.js");
        }
        try {
          const baseLibs = await this.resources.fetchBaseLibraries();
          for (const [path, content] of baseLibs) {
            this.zip.addFile(`libs/${path}`, content);
            commonFiles.push(`libs/${path}`);
          }
        } catch {
        }
        try {
          const scormFiles = await this.resources.fetchScormFiles("1.2");
          for (const [path, content] of scormFiles) {
            this.zip.addFile(`libs/${path}`, content);
            commonFiles.push(`libs/${path}`);
          }
        } catch {
          this.zip.addFile("libs/SCORM_API_wrapper.js", this.getScormApiWrapper());
          this.zip.addFile("libs/SCOFunctions.js", this.getScoFunctions());
          commonFiles.push("libs/SCORM_API_wrapper.js", "libs/SCOFunctions.js");
        }
        const usedIdevices = this.getUsedIdevices(pages);
        for (const idevice of usedIdevices) {
          try {
            const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
            for (const [path, content] of ideviceFiles) {
              this.zip.addFile(`idevices/${idevice}/${path}`, content);
              commonFiles.push(`idevices/${idevice}/${path}`);
            }
          } catch {
          }
        }
        await this.addAssetsToZipWithResourcePath();
        const manifestXml = this.manifestGenerator.generate({
          commonFiles,
          pageFiles
        });
        this.zip.addFile("imsmanifest.xml", manifestXml);
        const lomXml = this.lomGenerator.generate();
        this.zip.addFile("imslrm.xml", lomXml);
        const buffer = await this.zip.generateAsync();
        return {
          success: true,
          filename: exportFilename,
          data: buffer
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    /**
     * Generate project ID for SCORM package
     */
    generateProjectId() {
      return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    }
    /**
     * Generate SCORM-enabled HTML page
     */
    generateScormPageHtml(page, allPages, meta, isIndex) {
      const basePath = isIndex ? "" : "../";
      const usedIdevices = this.getUsedIdevicesForPage(page);
      return this.pageRenderer.render(page, {
        projectTitle: meta.title || "eXeLearning",
        language: meta.language || "en",
        theme: meta.theme || "base",
        customStyles: meta.customStyles || "",
        allPages,
        basePath,
        isIndex,
        usedIdevices,
        author: meta.author || "",
        license: meta.license || "CC-BY-SA",
        description: meta.description || "",
        licenseUrl: meta.licenseUrl || "https://creativecommons.org/licenses/by-sa/4.0/",
        // Export options
        addSearchBox: meta.addSearchBox ?? false,
        // SCORM-specific options
        isScorm: true,
        scormVersion: "1.2",
        bodyClass: "exe-scorm exe-scorm12",
        extraHeadScripts: this.getScormHeadScripts(basePath),
        onLoadScript: "loadPage()",
        onUnloadScript: "unloadPage()"
      });
    }
    /**
     * Get SCORM-specific head scripts
     */
    getScormHeadScripts(basePath) {
      return `<script src="${basePath}libs/SCORM_API_wrapper.js"><\/script>
<script src="${basePath}libs/SCOFunctions.js"><\/script>`;
    }
    /**
     * Get minimal SCORM API wrapper (fallback)
     */
    getScormApiWrapper() {
      return `/**
 * SCORM API Wrapper
 * Minimal implementation for SCORM 1.2 communication
 */
var pipwerks = pipwerks || {};

pipwerks.SCORM = {
  version: "1.2",
  API: { handle: null, isFound: false },
  data: { completionStatus: null, exitStatus: null },
  debug: { isActive: true }
};

pipwerks.SCORM.API.find = function(win) {
  var findAttempts = 0, findAttemptLimit = 500;
  while (!win.API && win.parent && win.parent !== win && findAttempts < findAttemptLimit) {
    findAttempts++;
    win = win.parent;
  }
  return win.API || null;
};

pipwerks.SCORM.API.get = function() {
  var win = window;
  if (win.parent && win.parent !== win) { this.handle = this.find(win.parent); }
  if (!this.handle && win.opener) { this.handle = this.find(win.opener); }
  if (this.handle) { this.isFound = true; }
  return this.handle;
};

pipwerks.SCORM.API.getHandle = function() {
  if (!this.handle) { this.get(); }
  return this.handle;
};

pipwerks.SCORM.connection = { isActive: false };

pipwerks.SCORM.init = function() {
  var success = false, API = this.API.getHandle();
  if (API) {
    success = API.LMSInitialize("");
    if (success) { this.connection.isActive = true; }
  }
  return success;
};

pipwerks.SCORM.quit = function() {
  var success = false, API = this.API.getHandle();
  if (API && this.connection.isActive) {
    success = API.LMSFinish("");
    if (success) { this.connection.isActive = false; }
  }
  return success;
};

pipwerks.SCORM.get = function(parameter) {
  var value = "", API = this.API.getHandle();
  if (API && this.connection.isActive) {
    value = API.LMSGetValue(parameter);
  }
  return value;
};

pipwerks.SCORM.set = function(parameter, value) {
  var success = false, API = this.API.getHandle();
  if (API && this.connection.isActive) {
    success = API.LMSSetValue(parameter, value);
  }
  return success;
};

pipwerks.SCORM.save = function() {
  var success = false, API = this.API.getHandle();
  if (API && this.connection.isActive) {
    success = API.LMSCommit("");
  }
  return success;
};

// Shorthand
var scorm = pipwerks.SCORM;
`;
    }
    /**
     * Get minimal SCO Functions (fallback)
     */
    getScoFunctions() {
      return `/**
 * SCO Functions for SCORM 1.2
 * Page load/unload handlers for SCORM communication
 */

var startTimeStamp = null;
var exitPageStatus = false;

function loadPage() {
  startTimeStamp = new Date();
  var result = scorm.init();
  if (result) {
    var status = scorm.get("cmi.core.lesson_status");
    if (status === "not attempted" || status === "") {
      scorm.set("cmi.core.lesson_status", "incomplete");
    }
  }
  return result;
}

function unloadPage() {
  if (!exitPageStatus) {
    exitPageStatus = true;
    computeTime();
    scorm.quit();
  }
}

function computeTime() {
  if (startTimeStamp != null) {
    var now = new Date();
    var elapsed = now.getTime() - startTimeStamp.getTime();
    elapsed = Math.round(elapsed / 1000);
    var hours = Math.floor(elapsed / 3600);
    var mins = Math.floor((elapsed - hours * 3600) / 60);
    var secs = elapsed - hours * 3600 - mins * 60;
    hours = hours < 10 ? "0" + hours : hours;
    mins = mins < 10 ? "0" + mins : mins;
    secs = secs < 10 ? "0" + secs : secs;
    var sessionTime = hours + ":" + mins + ":" + secs;
    scorm.set("cmi.core.session_time", sessionTime);
  }
}

function setComplete() {
  scorm.set("cmi.core.lesson_status", "completed");
  scorm.save();
}

function setIncomplete() {
  scorm.set("cmi.core.lesson_status", "incomplete");
  scorm.save();
}

function setScore(score, maxScore, minScore) {
  scorm.set("cmi.core.score.raw", score);
  if (maxScore !== undefined) scorm.set("cmi.core.score.max", maxScore);
  if (minScore !== undefined) scorm.set("cmi.core.score.min", minScore);
  scorm.save();
}
`;
    }
  };

  // src/shared/export/generators/Scorm2004Manifest.ts
  var Scorm2004ManifestGenerator = class {
    /**
     * @param projectId - Unique project identifier
     * @param pages - Pages from navigation structure
     * @param metadata - Project metadata
     */
    constructor(projectId, pages, metadata = {}) {
      this.projectId = projectId || this.generateId();
      this.pages = pages || [];
      this.metadata = metadata;
    }
    /**
     * Generate a unique ID for the project
     * @returns Unique ID string
     */
    generateId() {
      return "exe-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    }
    /**
     * Generate complete imsmanifest.xml content
     * @param options - Generation options
     * @returns Complete XML string
     */
    generate(options = {}) {
      const { commonFiles = [], pageFiles = {} } = options;
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += this.generateManifestOpen();
      xml += this.generateMetadata();
      xml += this.generateOrganizations();
      xml += this.generateResources(commonFiles, pageFiles);
      xml += "</manifest>\n";
      return xml;
    }
    /**
     * Generate manifest opening tag with SCORM 2004 namespaces
     * @returns Manifest opening XML
     */
    generateManifestOpen() {
      return `<manifest identifier="eXe-MANIFEST-${this.escapeXml(this.projectId)}"
  xmlns="${SCORM_2004_NAMESPACES.imscp}"
  xmlns:adlcp="${SCORM_2004_NAMESPACES.adlcp}"
  xmlns:adlseq="${SCORM_2004_NAMESPACES.adlseq}"
  xmlns:adlnav="${SCORM_2004_NAMESPACES.adlnav}"
  xmlns:imsss="${SCORM_2004_NAMESPACES.imsss}"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCORM_2004_NAMESPACES.imscp} imscp_v1p1.xsd
    ${SCORM_2004_NAMESPACES.adlcp} adlcp_v1p3.xsd
    ${SCORM_2004_NAMESPACES.adlseq} adlseq_v1p3.xsd
    ${SCORM_2004_NAMESPACES.adlnav} adlnav_v1p3.xsd
    ${SCORM_2004_NAMESPACES.imsss} imsss_v1p0.xsd">
`;
    }
    /**
     * Generate metadata section
     * @returns Metadata XML
     */
    generateMetadata() {
      let xml = "  <metadata>\n";
      xml += "    <schema>ADL SCORM</schema>\n";
      xml += "    <schemaversion>2004 4th Edition</schemaversion>\n";
      xml += "    <adlcp:location>imslrm.xml</adlcp:location>\n";
      xml += "  </metadata>\n";
      return xml;
    }
    /**
     * Generate organizations section with sequencing
     * @returns Organizations XML
     */
    generateOrganizations() {
      const orgId = `eXe-${this.projectId}`;
      const title = this.metadata.title || "eXeLearning";
      let xml = `  <organizations default="${this.escapeXml(orgId)}">
`;
      xml += `    <organization identifier="${this.escapeXml(orgId)}" structure="hierarchical">
`;
      xml += `      <title>${this.escapeXml(title)}</title>
`;
      xml += this.generateItems();
      xml += this.generateOrganizationSequencing();
      xml += "    </organization>\n";
      xml += "  </organizations>\n";
      return xml;
    }
    /**
     * Generate organization-level sequencing rules
     * @returns Sequencing XML
     */
    generateOrganizationSequencing() {
      return `      <imsss:sequencing>
        <imsss:controlMode choice="true" choiceExit="true" flow="true" forwardOnly="false"/>
      </imsss:sequencing>
`;
    }
    /**
     * Generate item elements for pages in hierarchical structure
     * @returns Items XML
     */
    generateItems() {
      const pageMap = /* @__PURE__ */ new Map();
      for (const page of this.pages) {
        pageMap.set(page.id, page);
      }
      const rootPages = this.pages.filter((p) => !p.parentId);
      let xml = "";
      for (const page of rootPages) {
        xml += this.generateItemRecursive(page, pageMap, 3);
      }
      return xml;
    }
    /**
     * Generate item element recursively for nested pages
     * @param page - Page object
     * @param pageMap - Map of all pages by ID
     * @param indent - Indentation level
     * @returns Item XML
     */
    generateItemRecursive(page, pageMap, indent) {
      const indentStr = "  ".repeat(indent);
      const isVisible = "true";
      const children = this.pages.filter((p) => p.parentId === page.id);
      const hasChildren = children.length > 0;
      let xml = `${indentStr}<item identifier="ITEM-${this.escapeXml(page.id)}" identifierref="RES-${this.escapeXml(page.id)}" isvisible="${isVisible}">
`;
      xml += `${indentStr}  <title>${this.escapeXml(page.title || "Page")}</title>
`;
      for (const child of children) {
        xml += this.generateItemRecursive(child, pageMap, indent + 1);
      }
      if (hasChildren) {
        xml += this.generateItemSequencing(indentStr + "  ");
      }
      xml += `${indentStr}</item>
`;
      return xml;
    }
    /**
     * Generate sequencing rules for a parent item (cluster)
     * @param indentStr - Indentation string
     * @returns Sequencing XML
     */
    generateItemSequencing(indentStr) {
      return `${indentStr}<imsss:sequencing>
${indentStr}  <imsss:controlMode choice="true" choiceExit="true" flow="true"/>
${indentStr}</imsss:sequencing>
`;
    }
    /**
     * Generate resources section
     * @param commonFiles - List of common file paths
     * @param pageFiles - Map of pageId to file info
     * @returns Resources XML
     */
    generateResources(commonFiles, pageFiles) {
      let xml = "  <resources>\n";
      for (const page of this.pages) {
        const pageFile = pageFiles[page.id] || {};
        xml += this.generatePageResource(page, pageFile);
      }
      xml += this.generateCommonFilesResource(commonFiles);
      xml += "  </resources>\n";
      return xml;
    }
    /**
     * Generate resource element for a page
     * @param page - Page object
     * @param pageFile - Page file info
     * @returns Resource XML
     */
    generatePageResource(page, pageFile) {
      const pageId = page.id;
      const isIndex = this.pages.indexOf(page) === 0;
      const fileUrl = pageFile.fileUrl || (isIndex ? "index.html" : `html/${this.sanitizeFilename(page.title)}.html`);
      let xml = `    <resource identifier="RES-${this.escapeXml(pageId)}" type="webcontent" adlcp:scormType="sco" href="${this.escapeXml(fileUrl)}">
`;
      xml += `      <file href="${this.escapeXml(fileUrl)}"/>
`;
      const files = pageFile.files || [];
      for (const file of files) {
        xml += `      <file href="${this.escapeXml(file)}"/>
`;
      }
      xml += '      <dependency identifierref="COMMON_FILES"/>\n';
      xml += "    </resource>\n";
      return xml;
    }
    /**
     * Generate COMMON_FILES resource for shared assets
     * @param commonFiles - List of common file paths
     * @returns Resource XML
     */
    generateCommonFilesResource(commonFiles) {
      let xml = '    <resource identifier="COMMON_FILES" type="webcontent" adlcp:scormType="asset">\n';
      for (const file of commonFiles) {
        xml += `      <file href="${this.escapeXml(file)}"/>
`;
      }
      xml += "    </resource>\n";
      return xml;
    }
    /**
     * Escape XML special characters
     * @param str - String to escape
     * @returns Escaped string
     */
    escapeXml(str) {
      if (!str) return "";
      return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
    /**
     * Sanitize filename for use in paths
     * @param title - Title to sanitize
     * @returns Sanitized filename
     */
    sanitizeFilename(title) {
      if (!title) return "page";
      return title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, 50);
    }
  };

  // src/shared/export/exporters/Scorm2004Exporter.ts
  var Scorm2004Exporter = class extends Html5Exporter {
    constructor(document2, resources, assets, zip2) {
      super(document2, resources, assets, zip2);
      this.manifestGenerator = null;
      this.lomGenerator = null;
    }
    /**
     * Get file suffix for SCORM 2004 format
     */
    getFileSuffix() {
      return "_scorm2004";
    }
    /**
     * Export to SCORM 2004 ZIP
     */
    async export(options) {
      const exportFilename = options?.filename || this.buildFilename();
      try {
        let pages = this.buildPageList();
        const meta = this.getMetadata();
        const themeName = options?.theme || meta.theme || "base";
        const projectId = this.generateProjectId();
        pages = await this.preprocessPagesForExport(pages);
        this.manifestGenerator = new Scorm2004ManifestGenerator(projectId, pages, {
          title: meta.title || "eXeLearning",
          language: meta.language || "en",
          author: meta.author || "",
          description: meta.description || "",
          license: meta.license || ""
        });
        this.lomGenerator = new LomMetadataGenerator(projectId, {
          title: meta.title || "eXeLearning",
          language: meta.language || "en",
          author: meta.author || "",
          description: meta.description || "",
          license: meta.license || ""
        });
        const commonFiles = [];
        const pageFiles = {};
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          const isIndex = i === 0;
          const html = this.generateScorm2004PageHtml(page, pages, meta, isIndex);
          const pageFilename = isIndex ? "index.html" : `html/${this.sanitizePageFilename(page.title)}.html`;
          this.zip.addFile(pageFilename, html);
          pageFiles[page.id] = {
            fileUrl: pageFilename,
            files: []
          };
        }
        if (meta.addSearchBox) {
          const searchIndexContent = this.pageRenderer.generateSearchIndexFile(pages, "");
          this.zip.addFile("search_index.js", searchIndexContent);
          commonFiles.push("search_index.js");
        }
        this.zip.addFile("content/css/base.css", this.getBaseCss());
        commonFiles.push("content/css/base.css");
        try {
          const themeFiles = await this.resources.fetchTheme(themeName);
          for (const [filePath, content] of themeFiles) {
            let exportPath = filePath;
            if (filePath === "style.css") {
              exportPath = "content.css";
            } else if (filePath === "style.js") {
              exportPath = "default.js";
            }
            this.zip.addFile(`theme/${exportPath}`, content);
            commonFiles.push(`theme/${exportPath}`);
          }
        } catch {
          this.zip.addFile("theme/content.css", this.getFallbackThemeCss());
          this.zip.addFile("theme/default.js", this.getFallbackThemeJs());
          commonFiles.push("theme/content.css", "theme/default.js");
        }
        try {
          const baseLibs = await this.resources.fetchBaseLibraries();
          for (const [path, content] of baseLibs) {
            this.zip.addFile(`libs/${path}`, content);
            commonFiles.push(`libs/${path}`);
          }
        } catch {
        }
        try {
          const scormFiles = await this.resources.fetchScormFiles("2004");
          for (const [path, content] of scormFiles) {
            this.zip.addFile(`libs/${path}`, content);
            commonFiles.push(`libs/${path}`);
          }
        } catch {
          this.zip.addFile("libs/SCORM_API_wrapper.js", this.getScorm2004ApiWrapper());
          this.zip.addFile("libs/SCOFunctions.js", this.getSco2004Functions());
          commonFiles.push("libs/SCORM_API_wrapper.js", "libs/SCOFunctions.js");
        }
        const usedIdevices = this.getUsedIdevices(pages);
        for (const idevice of usedIdevices) {
          try {
            const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
            for (const [path, content] of ideviceFiles) {
              this.zip.addFile(`idevices/${idevice}/${path}`, content);
              commonFiles.push(`idevices/${idevice}/${path}`);
            }
          } catch {
          }
        }
        await this.addAssetsToZipWithResourcePath();
        const manifestXml = this.manifestGenerator.generate({
          commonFiles,
          pageFiles
        });
        this.zip.addFile("imsmanifest.xml", manifestXml);
        const lomXml = this.lomGenerator.generate();
        this.zip.addFile("imslrm.xml", lomXml);
        const buffer = await this.zip.generateAsync();
        return {
          success: true,
          filename: exportFilename,
          data: buffer
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    /**
     * Generate project ID for SCORM package
     */
    generateProjectId() {
      return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    }
    /**
     * Generate SCORM 2004-enabled HTML page
     */
    generateScorm2004PageHtml(page, allPages, meta, isIndex) {
      const basePath = isIndex ? "" : "../";
      const usedIdevices = this.getUsedIdevicesForPage(page);
      return this.pageRenderer.render(page, {
        projectTitle: meta.title || "eXeLearning",
        language: meta.language || "en",
        theme: meta.theme || "base",
        customStyles: meta.customStyles || "",
        allPages,
        basePath,
        isIndex,
        usedIdevices,
        author: meta.author || "",
        license: meta.license || "CC-BY-SA",
        description: meta.description || "",
        licenseUrl: meta.licenseUrl || "https://creativecommons.org/licenses/by-sa/4.0/",
        // Export options
        addSearchBox: meta.addSearchBox ?? false,
        // SCORM 2004-specific options
        isScorm: true,
        scormVersion: "2004",
        bodyClass: "exe-scorm exe-scorm2004",
        extraHeadScripts: this.getScorm2004HeadScripts(basePath),
        onLoadScript: "loadPage()",
        onUnloadScript: "unloadPage()"
      });
    }
    /**
     * Get SCORM 2004-specific head scripts
     */
    getScorm2004HeadScripts(basePath) {
      return `<script src="${basePath}libs/SCORM_API_wrapper.js"><\/script>
<script src="${basePath}libs/SCOFunctions.js"><\/script>`;
    }
    /**
     * Get SCORM 2004 API wrapper (fallback)
     */
    getScorm2004ApiWrapper() {
      return `/**
 * SCORM 2004 API Wrapper
 * Minimal implementation for SCORM 2004 communication
 */
var pipwerks = pipwerks || {};

pipwerks.SCORM = {
  version: "2004",
  API: { handle: null, isFound: false },
  data: { completionStatus: null, exitStatus: null },
  debug: { isActive: true }
};

pipwerks.SCORM.API.find = function(win) {
  var findAttempts = 0, findAttemptLimit = 500;
  while (!win.API_1484_11 && win.parent && win.parent !== win && findAttempts < findAttemptLimit) {
    findAttempts++;
    win = win.parent;
  }
  return win.API_1484_11 || null;
};

pipwerks.SCORM.API.get = function() {
  var win = window;
  if (win.parent && win.parent !== win) { this.handle = this.find(win.parent); }
  if (!this.handle && win.opener) { this.handle = this.find(win.opener); }
  if (this.handle) { this.isFound = true; }
  return this.handle;
};

pipwerks.SCORM.API.getHandle = function() {
  if (!this.handle) { this.get(); }
  return this.handle;
};

pipwerks.SCORM.connection = { isActive: false };

pipwerks.SCORM.init = function() {
  var success = false, API = this.API.getHandle();
  if (API) {
    success = API.Initialize("");
    if (success === "true" || success === true) {
      this.connection.isActive = true;
      success = true;
    }
  }
  return success;
};

pipwerks.SCORM.quit = function() {
  var success = false, API = this.API.getHandle();
  if (API && this.connection.isActive) {
    success = API.Terminate("");
    if (success === "true" || success === true) {
      this.connection.isActive = false;
      success = true;
    }
  }
  return success;
};

pipwerks.SCORM.get = function(parameter) {
  var value = "", API = this.API.getHandle();
  if (API && this.connection.isActive) {
    value = API.GetValue(parameter);
  }
  return value;
};

pipwerks.SCORM.set = function(parameter, value) {
  var success = false, API = this.API.getHandle();
  if (API && this.connection.isActive) {
    success = API.SetValue(parameter, value);
    success = (success === "true" || success === true);
  }
  return success;
};

pipwerks.SCORM.save = function() {
  var success = false, API = this.API.getHandle();
  if (API && this.connection.isActive) {
    success = API.Commit("");
    success = (success === "true" || success === true);
  }
  return success;
};

// Shorthand
var scorm = pipwerks.SCORM;
`;
    }
    /**
     * Get SCO Functions for SCORM 2004 (fallback)
     */
    getSco2004Functions() {
      return `/**
 * SCO Functions for SCORM 2004
 * Page load/unload handlers for SCORM 2004 communication
 */

var startTimeStamp = null;
var exitPageStatus = false;

function loadPage() {
  startTimeStamp = new Date();
  var result = scorm.init();
  if (result) {
    var status = scorm.get("cmi.completion_status");
    if (status === "not attempted" || status === "unknown" || status === "") {
      scorm.set("cmi.completion_status", "incomplete");
    }
  }
  return result;
}

function unloadPage() {
  if (!exitPageStatus) {
    exitPageStatus = true;
    computeTime();
    scorm.set("cmi.exit", "suspend");
    scorm.save();
    scorm.quit();
  }
}

function computeTime() {
  if (startTimeStamp != null) {
    var now = new Date();
    var elapsed = now.getTime() - startTimeStamp.getTime();
    // SCORM 2004 uses ISO 8601 duration format
    var seconds = Math.round(elapsed / 1000);
    var hours = Math.floor(seconds / 3600);
    var mins = Math.floor((seconds - hours * 3600) / 60);
    var secs = seconds - hours * 3600 - mins * 60;
    // Format: PT#H#M#S
    var sessionTime = "PT" + hours + "H" + mins + "M" + secs + "S";
    scorm.set("cmi.session_time", sessionTime);
  }
}

function setComplete() {
  scorm.set("cmi.completion_status", "completed");
  scorm.set("cmi.success_status", "passed");
  scorm.save();
}

function setIncomplete() {
  scorm.set("cmi.completion_status", "incomplete");
  scorm.save();
}

function setScore(score, maxScore, minScore) {
  // SCORM 2004 score must be between 0 and 1
  var scaledScore = maxScore ? score / maxScore : score / 100;
  scorm.set("cmi.score.scaled", scaledScore);
  scorm.set("cmi.score.raw", score);
  if (maxScore !== undefined) scorm.set("cmi.score.max", maxScore);
  if (minScore !== undefined) scorm.set("cmi.score.min", minScore);
  scorm.save();
}
`;
    }
  };

  // src/shared/export/generators/ImsManifest.ts
  var ImsManifestGenerator = class {
    /**
     * @param projectId - Unique project identifier
     * @param pages - Pages from navigation structure
     * @param metadata - Project metadata
     */
    constructor(projectId, pages, metadata = {}) {
      this.projectId = projectId || this.generateId();
      this.pages = pages || [];
      this.metadata = metadata;
    }
    /**
     * Generate a unique ID for the project
     * @returns Unique ID string
     */
    generateId() {
      return "exe-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    }
    /**
     * Generate complete imsmanifest.xml content
     * @param options - Generation options
     * @returns Complete XML string
     */
    generate(options = {}) {
      const { commonFiles = [], pageFiles = {} } = options;
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += this.generateManifestOpen();
      xml += this.generateMetadata();
      xml += this.generateOrganizations();
      xml += this.generateResources(commonFiles, pageFiles);
      xml += "</manifest>\n";
      return xml;
    }
    /**
     * Generate manifest opening tag with IMS CP namespaces
     * @returns Manifest opening XML
     */
    generateManifestOpen() {
      return `<manifest identifier="eXe-MANIFEST-${this.escapeXml(this.projectId)}"
  xmlns="${IMS_NAMESPACES.imscp}"
  xmlns:imsmd="${IMS_NAMESPACES.imsmd}"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${IMS_NAMESPACES.imscp} imscp_v1p1.xsd
    ${IMS_NAMESPACES.imsmd} imsmd_v1p2p2.xsd">
`;
    }
    /**
     * Generate metadata section with inline LOM
     * @returns Metadata XML
     */
    generateMetadata() {
      const title = this.metadata.title || "eXeLearning";
      const description = this.metadata.description || "";
      const language = this.metadata.language || "en";
      const author = this.metadata.author || "";
      let xml = "  <metadata>\n";
      xml += "    <schema>IMS Content</schema>\n";
      xml += "    <schemaversion>1.1.3</schemaversion>\n";
      xml += "    <imsmd:lom>\n";
      xml += "      <imsmd:general>\n";
      xml += `        <imsmd:title>
`;
      xml += `          <imsmd:langstring xml:lang="${this.escapeXml(language)}">${this.escapeXml(title)}</imsmd:langstring>
`;
      xml += `        </imsmd:title>
`;
      if (description) {
        xml += `        <imsmd:description>
`;
        xml += `          <imsmd:langstring xml:lang="${this.escapeXml(language)}">${this.escapeXml(description)}</imsmd:langstring>
`;
        xml += `        </imsmd:description>
`;
      }
      xml += `        <imsmd:language>${this.escapeXml(language)}</imsmd:language>
`;
      xml += "      </imsmd:general>\n";
      if (author) {
        xml += "      <imsmd:lifecycle>\n";
        xml += "        <imsmd:contribute>\n";
        xml += "          <imsmd:role>\n";
        xml += "            <imsmd:value>Author</imsmd:value>\n";
        xml += "          </imsmd:role>\n";
        xml += "          <imsmd:centity>\n";
        xml += `            <imsmd:vcard>BEGIN:VCARD\\nFN:${this.escapeXml(author)}\\nEND:VCARD</imsmd:vcard>
`;
        xml += "          </imsmd:centity>\n";
        xml += "        </imsmd:contribute>\n";
        xml += "      </imsmd:lifecycle>\n";
      }
      xml += "    </imsmd:lom>\n";
      xml += "  </metadata>\n";
      return xml;
    }
    /**
     * Generate organizations section
     * @returns Organizations XML
     */
    generateOrganizations() {
      const orgId = `eXe-${this.projectId}`;
      const title = this.metadata.title || "eXeLearning";
      let xml = `  <organizations default="${this.escapeXml(orgId)}">
`;
      xml += `    <organization identifier="${this.escapeXml(orgId)}" structure="hierarchical">
`;
      xml += `      <title>${this.escapeXml(title)}</title>
`;
      xml += this.generateItems();
      xml += "    </organization>\n";
      xml += "  </organizations>\n";
      return xml;
    }
    /**
     * Generate item elements for pages in hierarchical structure
     * @returns Items XML
     */
    generateItems() {
      const pageMap = /* @__PURE__ */ new Map();
      for (const page of this.pages) {
        pageMap.set(page.id, page);
      }
      const rootPages = this.pages.filter((p) => !p.parentId);
      let xml = "";
      for (const page of rootPages) {
        xml += this.generateItemRecursive(page, pageMap, 3);
      }
      return xml;
    }
    /**
     * Generate item element recursively for nested pages
     * @param page - Page object
     * @param pageMap - Map of all pages by ID
     * @param indent - Indentation level
     * @returns Item XML
     */
    generateItemRecursive(page, pageMap, indent) {
      const indentStr = "  ".repeat(indent);
      const isVisible = "true";
      const children = this.pages.filter((p) => p.parentId === page.id);
      let xml = `${indentStr}<item identifier="ITEM-${this.escapeXml(page.id)}" identifierref="RES-${this.escapeXml(page.id)}" isvisible="${isVisible}">
`;
      xml += `${indentStr}  <title>${this.escapeXml(page.title || "Page")}</title>
`;
      for (const child of children) {
        xml += this.generateItemRecursive(child, pageMap, indent + 1);
      }
      xml += `${indentStr}</item>
`;
      return xml;
    }
    /**
     * Generate resources section
     * @param commonFiles - List of common file paths
     * @param pageFiles - Map of pageId to file info
     * @returns Resources XML
     */
    generateResources(commonFiles, pageFiles) {
      let xml = "  <resources>\n";
      for (const page of this.pages) {
        const pageFile = pageFiles[page.id] || {};
        xml += this.generatePageResource(page, pageFile);
      }
      xml += this.generateCommonFilesResource(commonFiles);
      xml += "  </resources>\n";
      return xml;
    }
    /**
     * Generate resource element for a page
     * @param page - Page object
     * @param pageFile - Page file info
     * @returns Resource XML
     */
    generatePageResource(page, pageFile) {
      const pageId = page.id;
      const isIndex = this.pages.indexOf(page) === 0;
      const fileUrl = pageFile.fileUrl || (isIndex ? "index.html" : `html/${this.sanitizeFilename(page.title)}.html`);
      let xml = `    <resource identifier="RES-${this.escapeXml(pageId)}" type="webcontent" href="${this.escapeXml(fileUrl)}">
`;
      xml += `      <file href="${this.escapeXml(fileUrl)}"/>
`;
      const files = pageFile.files || [];
      for (const file of files) {
        xml += `      <file href="${this.escapeXml(file)}"/>
`;
      }
      xml += '      <dependency identifierref="COMMON_FILES"/>\n';
      xml += "    </resource>\n";
      return xml;
    }
    /**
     * Generate COMMON_FILES resource for shared assets
     * @param commonFiles - List of common file paths
     * @returns Resource XML
     */
    generateCommonFilesResource(commonFiles) {
      let xml = '    <resource identifier="COMMON_FILES" type="webcontent">\n';
      for (const file of commonFiles) {
        xml += `      <file href="${this.escapeXml(file)}"/>
`;
      }
      xml += "    </resource>\n";
      return xml;
    }
    /**
     * Escape XML special characters
     * @param str - String to escape
     * @returns Escaped string
     */
    escapeXml(str) {
      if (!str) return "";
      return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
    /**
     * Sanitize filename for use in paths
     * @param title - Title to sanitize
     * @returns Sanitized filename
     */
    sanitizeFilename(title) {
      if (!title) return "page";
      return title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, 50);
    }
  };

  // src/shared/export/exporters/ImsExporter.ts
  var ImsExporter = class extends Html5Exporter {
    constructor(document2, resources, assets, zip2) {
      super(document2, resources, assets, zip2);
      this.manifestGenerator = null;
    }
    /**
     * Get file suffix for IMS CP format
     */
    getFileSuffix() {
      return "_ims";
    }
    /**
     * Export to IMS Content Package ZIP
     */
    async export(options) {
      const exportFilename = options?.filename || this.buildFilename();
      try {
        let pages = this.buildPageList();
        const meta = this.getMetadata();
        const themeName = options?.theme || meta.theme || "base";
        const projectId = this.generateProjectId();
        pages = await this.preprocessPagesForExport(pages);
        this.manifestGenerator = new ImsManifestGenerator(projectId, pages, {
          title: meta.title || "eXeLearning",
          language: meta.language || "en",
          author: meta.author || "",
          description: meta.description || "",
          license: meta.license || ""
        });
        const commonFiles = [];
        const pageFiles = {};
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          const isIndex = i === 0;
          const html = this.generateImsPageHtml(page, pages, meta, isIndex);
          const pageFilename = isIndex ? "index.html" : `html/${this.sanitizePageFilename(page.title)}.html`;
          this.zip.addFile(pageFilename, html);
          pageFiles[page.id] = {
            fileUrl: pageFilename,
            files: []
          };
        }
        if (meta.addSearchBox) {
          const searchIndexContent = this.pageRenderer.generateSearchIndexFile(pages, "");
          this.zip.addFile("search_index.js", searchIndexContent);
          commonFiles.push("search_index.js");
        }
        this.zip.addFile("content/css/base.css", this.getBaseCss());
        commonFiles.push("content/css/base.css");
        try {
          const themeFiles = await this.resources.fetchTheme(themeName);
          for (const [filePath, content] of themeFiles) {
            let exportPath = filePath;
            if (filePath === "style.css") {
              exportPath = "content.css";
            } else if (filePath === "style.js") {
              exportPath = "default.js";
            }
            this.zip.addFile(`theme/${exportPath}`, content);
            commonFiles.push(`theme/${exportPath}`);
          }
        } catch {
          this.zip.addFile("theme/content.css", this.getFallbackThemeCss());
          this.zip.addFile("theme/default.js", this.getFallbackThemeJs());
          commonFiles.push("theme/content.css", "theme/default.js");
        }
        try {
          const baseLibs = await this.resources.fetchBaseLibraries();
          for (const [path, content] of baseLibs) {
            this.zip.addFile(`libs/${path}`, content);
            commonFiles.push(`libs/${path}`);
          }
        } catch {
        }
        const usedIdevices = this.getUsedIdevices(pages);
        for (const idevice of usedIdevices) {
          try {
            const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
            for (const [path, content] of ideviceFiles) {
              this.zip.addFile(`idevices/${idevice}/${path}`, content);
              commonFiles.push(`idevices/${idevice}/${path}`);
            }
          } catch {
          }
        }
        await this.addAssetsToZipWithResourcePath();
        const manifestXml = this.manifestGenerator.generate({
          commonFiles,
          pageFiles
        });
        this.zip.addFile("imsmanifest.xml", manifestXml);
        const buffer = await this.zip.generateAsync();
        return {
          success: true,
          filename: exportFilename,
          data: buffer
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    /**
     * Generate project ID for IMS package
     */
    generateProjectId() {
      return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    }
    /**
     * Generate IMS CP HTML page (standard website, no SCORM)
     */
    generateImsPageHtml(page, allPages, meta, isIndex) {
      const basePath = isIndex ? "" : "../";
      const usedIdevices = this.getUsedIdevicesForPage(page);
      return this.pageRenderer.render(page, {
        projectTitle: meta.title || "eXeLearning",
        language: meta.language || "en",
        theme: meta.theme || "base",
        customStyles: meta.customStyles || "",
        allPages,
        basePath,
        isIndex,
        usedIdevices,
        author: meta.author || "",
        license: meta.license || "CC-BY-SA",
        description: meta.description || "",
        licenseUrl: meta.licenseUrl || "https://creativecommons.org/licenses/by-sa/4.0/",
        // Export options
        addSearchBox: meta.addSearchBox ?? false,
        bodyClass: "exe-web-site exe-ims"
      });
    }
  };

  // src/shared/export/exporters/WebsitePreviewExporter.ts
  var WebsitePreviewExporter = class _WebsitePreviewExporter {
    /**
     * Create a WebsitePreviewExporter
     * @param document - Export document adapter
     * @param resourceProvider - Resource provider for theme/iDevice info
     */
    constructor(document2, resourceProvider) {
      this.document = document2;
      this.resourceProvider = resourceProvider;
      this.ideviceRenderer = new IdeviceRenderer(resourceProvider);
    }
    /**
     * Generate preview HTML
     * @param options - Preview options
     * @returns Preview result with HTML string
     */
    async generatePreview(options = {}) {
      try {
        const pages = this.document.getNavigation();
        const meta = this.document.getMetadata();
        if (pages.length === 0) {
          return { success: false, error: "No pages to preview" };
        }
        const usedIdevices = this.getUsedIdevices(pages);
        const needsElpxDownload = this.needsElpxDownloadSupport(pages);
        let html = this.generateWebsiteSpaHtml(pages, meta, usedIdevices, options, needsElpxDownload);
        if (needsElpxDownload) {
          const projectTitle = meta.title || "project";
          html = this.replaceElpxProtocol(html, projectTitle);
        }
        return { success: true, html };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
      }
    }
    /**
     * Check if any page contains the download-source-file iDevice
     * (needs fflate and exe_elpx_download.js)
     */
    needsElpxDownloadSupport(pages) {
      for (const page of pages) {
        for (const block of page.blocks || []) {
          for (const component of block.components || []) {
            const type = (component.type || "").toLowerCase();
            if (type.includes("download-source-file") || type.includes("downloadsourcefile")) {
              return true;
            }
            if (component.content && component.content.includes("exe-download-package-link")) {
              return true;
            }
          }
        }
      }
      return false;
    }
    /**
     * Replace exe-package:elp protocol with client-side download handler
     * Enables the download-source-file iDevice to generate ELPX files on-the-fly
     */
    replaceElpxProtocol(content, projectTitle) {
      if (!content || !content.includes("exe-package:elp")) {
        return content;
      }
      let result = content.replace(
        /href="exe-package:elp"/g,
        `href="#" onclick="if(typeof downloadElpx==='function')downloadElpx();return false;"`
      );
      const safeTitle = this.escapeHtml(projectTitle);
      result = result.replace(/download="exe-package:elp-name"/g, `download="${safeTitle}.elpx"`);
      return result;
    }
    /**
     * Get all unique iDevice types used in pages
     */
    getUsedIdevices(pages) {
      const types = /* @__PURE__ */ new Set();
      for (const page of pages) {
        for (const block of page.blocks) {
          for (const component of block.components) {
            if (component.type) {
              types.add(component.type);
            }
          }
        }
      }
      return Array.from(types);
    }
    /**
     * Get versioned asset path for server resources
     * @param path - The resource path (e.g., '/libs/bootstrap.css')
     * @param options - Preview options with baseUrl and version
     * @returns Versioned URL
     */
    getVersionedPath(path, options) {
      const baseUrl = options.baseUrl || "";
      const basePath = options.basePath || "";
      const version = options.version || "v1.0.0";
      const cleanPath = path.startsWith("/") ? path.slice(1) : path;
      return `${baseUrl}${basePath}/${version}/${cleanPath}`;
    }
    static {
      /**
       * Libraries that are located in /libs/ instead of /app/common/
       * The LibraryDetector returns files without the base path, so we need to map them correctly
       */
      this.LIBS_FOLDER_LIBRARIES = /* @__PURE__ */ new Set([
        "jquery-ui",
        "fflate",
        "exe_atools",
        "mermaid",
        "exe_elpx_download.js"
        // Root-level file in /libs/
      ]);
    }
    /**
     * Get the correct server path for a detected library file
     * Some libraries are in /libs/, others in /app/common/
     * @param file - Library file path (e.g., 'jquery-ui/jquery-ui.min.js' or 'exe_lightbox/exe_lightbox.js')
     * @param options - Preview options
     * @returns Versioned URL with correct base path
     */
    getLibraryServerPath(file, options) {
      const firstPart = file.split("/")[0];
      if (_WebsitePreviewExporter.LIBS_FOLDER_LIBRARIES.has(firstPart) || _WebsitePreviewExporter.LIBS_FOLDER_LIBRARIES.has(file)) {
        return this.getVersionedPath(`/libs/${file}`, options);
      }
      return this.getVersionedPath(`/app/common/${file}`, options);
    }
    /**
     * Generate complete SPA HTML with all pages
     */
    generateWebsiteSpaHtml(pages, meta, usedIdevices, options, needsElpxDownload = false) {
      const lang = meta.language || "en";
      const projectTitle = meta.title || "eXeLearning";
      const customStyles = meta.customStyles || "";
      const author = meta.author || "";
      const license = meta.license || "CC-BY-SA";
      const themeName = meta.theme || "base";
      const totalPages = pages.length;
      const addExeLink = meta.addExeLink ?? true;
      const addPagination = meta.addPagination ?? false;
      const addSearchBox = meta.addSearchBox ?? false;
      const addAccessibilityToolbar = meta.addAccessibilityToolbar ?? false;
      const searchDataJson = addSearchBox ? this.generateSearchData(pages, options) : "";
      let pagesHtml = "";
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const isFirst = i === 0;
        pagesHtml += this.renderPageArticle(page, isFirst, i, totalPages, projectTitle, options, addPagination);
      }
      const libraryDetector = new LibraryDetector();
      const detectedLibraries = libraryDetector.detectLibraries(pagesHtml, {
        includeAccessibilityToolbar: addAccessibilityToolbar
      });
      const madeWithExeHtml = addExeLink ? this.renderMadeWithEXe(lang) : "";
      const searchBoxHtml = addSearchBox ? this.renderSearchBox() : "";
      const searchDataScript = addSearchBox ? this.generateSearchDataScript(searchDataJson) : "";
      return `<!DOCTYPE html>
<html lang="${lang}">
<head>
${this.generateWebsitePreviewHead(themeName, usedIdevices, projectTitle, customStyles, options, addAccessibilityToolbar, detectedLibraries)}
</head>
<body class="exe-web-site exe-preview" lang="${lang}">
<script>document.body.className+=" js"<\/script>
${searchBoxHtml}
<div class="exe-content exe-export pre-js">
${this.renderSpaNavigation(pages)}
<main class="page">
${pagesHtml}
</main>
${this.renderNavButtons()}
${this.renderWebsiteFooter(author, license)}
</div>
${madeWithExeHtml}
${searchDataScript}
${this.generateWebsitePreviewScripts(themeName, usedIdevices, options, needsElpxDownload, addAccessibilityToolbar, detectedLibraries)}
</body>
</html>`;
    }
    /**
     * Generate <head> content with versioned server paths
     */
    generateWebsitePreviewHead(themeName, usedIdevices, projectTitle, customStyles, options, addAccessibilityToolbar = false, detectedLibraries = {
      libraries: [],
      files: [],
      count: 0
    }) {
      const bootstrapCss = this.getVersionedPath("/libs/bootstrap/bootstrap.min.css", options);
      const themeCss = this.getVersionedPath(`/files/perm/themes/base/${themeName}/style.css`, options);
      const fallbackCss = this.getVersionedPath("/style/content.css", options);
      const jqueryUiRequiredTypes = /* @__PURE__ */ new Set([
        "ordena",
        "sort",
        "clasifica",
        "classify",
        "relaciona",
        "relate",
        "dragdrop",
        "complete",
        "completa"
      ]);
      let needsJqueryUiCss = false;
      for (const idevice of usedIdevices) {
        const typeName = idevice.toLowerCase().replace(/idevice$/i, "").replace(/-idevice$/i, "");
        if (jqueryUiRequiredTypes.has(typeName)) {
          needsJqueryUiCss = true;
          break;
        }
      }
      let jqueryUiCssLink = "";
      if (needsJqueryUiCss) {
        const jqueryUiCss = this.getVersionedPath("/libs/jquery-ui/jquery-ui.min.css", options);
        jqueryUiCssLink = `
<link rel="stylesheet" href="${jqueryUiCss}">`;
      }
      let detectedLibraryCss = "";
      for (const file of detectedLibraries.files) {
        if (file.endsWith(".css")) {
          const serverPath = this.getLibraryServerPath(file, options);
          detectedLibraryCss += `
<link rel="stylesheet" href="${serverPath}" onerror="this.remove()">`;
        }
      }
      let head = `<meta charset="utf-8">
<meta name="generator" content="eXeLearning 4.0 - exelearning.net (Preview)">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${this.escapeHtml(projectTitle)} - Preview</title>
<script>document.querySelector("html").classList.add("js");<\/script>

<!-- Server-hosted libraries (versioned paths) -->
<link rel="stylesheet" href="${bootstrapCss}">${jqueryUiCssLink}${detectedLibraryCss}

<!-- Preview-only CSS for SPA behavior -->
<style>
${this.getWebsitePreviewCss()}
</style>

<!-- Theme from server (loads AFTER fallback, so theme wins) -->
<link rel="stylesheet" href="${themeCss}" onerror="this.href='${fallbackCss}'">`;
      const seen = /* @__PURE__ */ new Set();
      for (const idevice of usedIdevices) {
        const typeName = normalizeIdeviceType(idevice);
        if (!seen.has(typeName)) {
          seen.add(typeName);
          const ideviceCss = this.getVersionedPath(
            `/files/perm/idevices/base/${typeName}/export/${typeName}.css`,
            options
          );
          head += `
<link rel="stylesheet" href="${ideviceCss}" onerror="this.remove()">`;
        }
      }
      if (customStyles) {
        head += `
<style>
${customStyles}
</style>`;
      }
      if (addAccessibilityToolbar) {
        const atoolsCss = this.getVersionedPath("/libs/exe_atools/exe_atools.css", options);
        head += `
<link rel="stylesheet" href="${atoolsCss}">`;
      }
      head += `
<style>
${this.getMadeWithExeCss(options)}
</style>`;
      return head;
    }
    /**
     * Get preview-only CSS for SPA behavior and critical theme fallbacks
     */
    getWebsitePreviewCss() {
      return `/* SPA Preview Styles */
.spa-page { display: none; }
.spa-page.active { display: block; }

/* Navigation link fixes (theme fallback) */
#siteNav a {
    text-decoration: none;
}

/* Button text hiding - visually hidden but accessible */
.nav-buttons .nav-button span,
button.toggler span,
#exe-client-search-reset span {
    position: absolute;
    clip: rect(1px, 1px, 1px, 1px);
    clip-path: inset(50%);
    width: 1px;
    height: 1px;
    overflow: hidden;
    white-space: nowrap;
}

/* Search form flex layout */
#exe-client-search-form p {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 6px;
    align-items: center;
}

/* Nav buttons positioning (theme fallback) */
.nav-buttons { display: flex; justify-content: space-between; padding: 1rem; }
.nav-button { cursor: pointer; }
.nav-button.disabled { opacity: 0.5; pointer-events: none; }`;
    }
    /**
     * Get Made-with-eXe CSS (loaded AFTER theme to ensure it overrides)
     */
    getMadeWithExeCss(options) {
      const logoUrl = this.getVersionedPath("/app/common/exe_powered_logo/exe_powered_logo.png", options);
      return `/* Made with eXeLearning - Must load after theme */
#made-with-eXe {
    margin: 0;
    position: fixed;
    bottom: 0;
    right: 0;
    z-index: 9999;
}
#made-with-eXe a {
    text-decoration: none;
    box-shadow: rgba(0, 0, 0, 0.35) 0px 5px 15px;
    border-top-left-radius: 4px;
    color: #222;
    font-size: 11px;
    font-family: Arial, sans-serif;
    line-height: 35px;
    width: 35px;
    height: 35px;
    background: #fff url(${logoUrl}) no-repeat 3px 50%;
    display: block;
    background-size: auto 20px;
    transition: .5s;
    opacity: .8;
    overflow: hidden;
}
#made-with-eXe span {
    padding-left: 35px;
    padding-right: 5px;
    white-space: nowrap;
}
#made-with-eXe a:hover {
    width: auto;
    padding: 0 5px;
    background-position: 5px 50%;
    opacity: 1;
}
@media print {
    #made-with-eXe { display: none; }
}`;
    }
    /**
     * Render SPA navigation with JavaScript page switching
     */
    renderSpaNavigation(pages) {
      const rootPages = pages.filter((p) => !p.parentId);
      let html = '<nav id="siteNav">\n<ul>\n';
      for (const page of rootPages) {
        html += this.renderSpaNavItem(page, pages, pages[0]?.id);
      }
      html += "</ul>\n</nav>";
      return html;
    }
    /**
     * Render a navigation item for SPA
     */
    renderSpaNavItem(page, allPages, currentPageId) {
      const children = allPages.filter((p) => p.parentId === page.id);
      const hasChildren = children.length > 0;
      const isActive = page.id === currentPageId;
      let html = `<li${isActive ? ' class="active"' : ""}>`;
      html += ` <a href="#" data-page-id="${page.id}" class="${isActive ? "active " : ""}${hasChildren ? "daddy" : "no-ch"}">${this.escapeHtml(page.title)}</a>
`;
      if (hasChildren) {
        html += '<ul class="other-section">\n';
        for (const child of children) {
          html += this.renderSpaNavItem(child, allPages, currentPageId);
        }
        html += "</ul>\n";
      }
      html += "</li>\n";
      return html;
    }
    /**
     * Render a page as an article (hidden except first)
     */
    renderPageArticle(page, isFirst, pageIndex, totalPages, projectTitle, options, addPagination = false) {
      let blockHtml = "";
      const ideviceBasePath = this.getVersionedPath("/files/perm/idevices/base/", options);
      for (const block of page.blocks || []) {
        blockHtml += this.ideviceRenderer.renderBlock(block, {
          basePath: ideviceBasePath,
          includeDataAttributes: true
        });
      }
      const displayStyle = isFirst ? "" : ' style="display:none"';
      const pageId = page.id;
      const pageCounterHtml = addPagination ? `<p class="page-counter"> <span class="page-counter-label">P\xE1gina </span><span class="page-counter-content"> <strong class="page-counter-current-page">${pageIndex + 1}</strong><span class="page-counter-sep">/</span><strong class="page-counter-total">${totalPages}</strong></span></p>` : "";
      return `<article id="page-${pageId}" class="spa-page${isFirst ? " active" : ""}"${displayStyle} data-page-index="${pageIndex}">
<header id="header-${pageId}" class="page-header"> ${pageCounterHtml}
<h1 class="package-title">${this.escapeHtml(projectTitle)}</h1>
<h2 class="page-title">${this.escapeHtml(page.title)}</h2></header>
<div id="page-content-${pageId}" class="page-content">
${blockHtml}
</div>
</article>
`;
    }
    /**
     * Render navigation buttons (Previous/Next)
     */
    renderNavButtons() {
      return `<div class="nav-buttons">
<a href="#" title="Anterior" class="nav-button nav-button-left" data-nav="prev">
<span>Anterior</span>
</a>
<a href="#" title="Siguiente" class="nav-button nav-button-right" data-nav="next">
<span>Siguiente</span>
</a>
</div>`;
    }
    /**
     * Render website footer
     */
    renderWebsiteFooter(author, license) {
      return `<footer id="siteFooter">
<p class="license">${this.escapeHtml(author ? `${author} - ` : "")}${this.escapeHtml(license)}</p>
</footer>`;
    }
    static {
      /**
       * Translations for "Made with eXeLearning" text
       */
      this.MADE_WITH_TRANSLATIONS = {
        en: "Made with eXeLearning",
        es: "Creado con eXeLearning",
        ca: "Creat amb eXeLearning",
        eu: "eXeLearning-ekin egina",
        gl: "Creado con eXeLearning",
        pt: "Criado com eXeLearning",
        va: "Creat amb eXeLearning",
        ro: "Creat cu eXeLearning",
        eo: "Kreita per eXeLearning"
      };
    }
    /**
     * Render "Made with eXeLearning" credit with translated text
     * The text is hidden by default and shown on hover via CSS
     */
    renderMadeWithEXe(lang) {
      const text = _WebsitePreviewExporter.MADE_WITH_TRANSLATIONS[lang] || _WebsitePreviewExporter.MADE_WITH_TRANSLATIONS["en"];
      return `<p id="made-with-eXe"><a href="https://exelearning.net/" target="_blank" rel="noopener"><span>${this.escapeHtml(text)} </span></a></p>`;
    }
    /**
     * Generate scripts with SPA navigation logic
     */
    generateWebsitePreviewScripts(themeName, usedIdevices, options, needsElpxDownload = false, addAccessibilityToolbar = false, detectedLibraries = {
      libraries: [],
      files: [],
      count: 0
    }) {
      const jqueryJs = this.getVersionedPath("/libs/jquery/jquery.min.js", options);
      const bootstrapJs = this.getVersionedPath("/libs/bootstrap/bootstrap.bundle.min.js", options);
      const commonJs = this.getVersionedPath("/app/common/common.js", options);
      const commonI18nJs = this.getVersionedPath("/app/common/common_i18n.js", options);
      const exeExportJs = this.getVersionedPath("/app/common/exe_export.js", options);
      const themeJs = this.getVersionedPath(`/files/perm/themes/base/${themeName}/style.js`, options);
      const jqueryUiRequiredTypes = /* @__PURE__ */ new Set([
        "ordena",
        "sort",
        "clasifica",
        "classify",
        "relaciona",
        "relate",
        "dragdrop",
        "complete",
        "completa"
      ]);
      let needsJqueryUi = false;
      for (const idevice of usedIdevices) {
        const typeName = idevice.toLowerCase().replace(/idevice$/i, "").replace(/-idevice$/i, "");
        if (jqueryUiRequiredTypes.has(typeName)) {
          needsJqueryUi = true;
          break;
        }
      }
      let jqueryUiScript = "";
      if (needsJqueryUi) {
        const jqueryUiJs = this.getVersionedPath("/libs/jquery-ui/jquery-ui.min.js", options);
        jqueryUiScript = `
<script src="${jqueryUiJs}"><\/script>`;
      }
      let elpxDownloadScripts = "";
      if (needsElpxDownload) {
        const fflateJs = this.getVersionedPath("/libs/fflate/fflate.umd.js", options);
        const elpxDownloadJs = this.getVersionedPath("/libs/exe_elpx_download.js", options);
        elpxDownloadScripts = `
<script src="${fflateJs}"><\/script>
<script src="${elpxDownloadJs}"><\/script>`;
      }
      let detectedLibraryScripts = "";
      for (const file of detectedLibraries.files) {
        if (file.endsWith(".js")) {
          const serverPath = this.getLibraryServerPath(file, options);
          detectedLibraryScripts += `
<script src="${serverPath}" onerror="this.remove()"><\/script>`;
        }
      }
      let ideviceScripts = "";
      const seenJs = /* @__PURE__ */ new Set();
      for (const idevice of usedIdevices) {
        const typeName = normalizeIdeviceType(idevice);
        if (!seenJs.has(typeName)) {
          seenJs.add(typeName);
          const ideviceJs = this.getVersionedPath(
            `/files/perm/idevices/base/${typeName}/export/${typeName}.js`,
            options
          );
          ideviceScripts += `
<script src="${ideviceJs}" onerror="this.remove()"><\/script>`;
        }
      }
      let atoolsScript = "";
      if (addAccessibilityToolbar) {
        const atoolsJs = this.getVersionedPath("/libs/exe_atools/exe_atools.js", options);
        atoolsScript = `
<script src="${atoolsJs}"><\/script>`;
      }
      return `<script src="${jqueryJs}"><\/script>
<script src="${bootstrapJs}"><\/script>${jqueryUiScript}${elpxDownloadScripts}
<script src="${commonJs}"><\/script>
<script src="${commonI18nJs}"><\/script>
<script src="${exeExportJs}"><\/script>${detectedLibraryScripts}${ideviceScripts}${atoolsScript}
<script src="${themeJs}" onerror="this.remove()"><\/script>
<script>
${this.getSpaNavigationScript()}
// Initialize iDevices after DOM is ready
if (typeof $exeExport !== 'undefined' && $exeExport.init) {
    $exeExport.init();
}
<\/script>`;
    }
    /**
     * Get SPA navigation JavaScript
     */
    getSpaNavigationScript() {
      return `// SPA Navigation
(function() {
  var pages = document.querySelectorAll('.spa-page');
  var navLinks = document.querySelectorAll('[data-page-id]');
  var prevBtn = document.querySelector('[data-nav="prev"]');
  var nextBtn = document.querySelector('[data-nav="next"]');
  var currentIndex = 0;

  function showPage(index) {
    if (index < 0 || index >= pages.length) return;
    currentIndex = index;
    pages.forEach(function(p, i) {
      p.style.display = i === index ? 'block' : 'none';
      p.classList.toggle('active', i === index);
    });
    navLinks.forEach(function(link) {
      var pageId = link.getAttribute('data-page-id');
      var isActive = pages[index].id === 'page-' + pageId;
      link.classList.toggle('active', isActive);
      if (link.parentElement) link.parentElement.classList.toggle('active', isActive);
    });
    updateNavButtons();
  }

  function updateNavButtons() {
    if (prevBtn) prevBtn.classList.toggle('disabled', currentIndex === 0);
    if (nextBtn) nextBtn.classList.toggle('disabled', currentIndex === pages.length - 1);
  }

  navLinks.forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      var pageId = this.getAttribute('data-page-id');
      for (var i = 0; i < pages.length; i++) {
        if (pages[i].id === 'page-' + pageId) {
          showPage(i);
          break;
        }
      }
    });
  });

  if (prevBtn) prevBtn.addEventListener('click', function(e) {
    e.preventDefault();
    showPage(currentIndex - 1);
  });

  if (nextBtn) nextBtn.addEventListener('click', function(e) {
    e.preventDefault();
    showPage(currentIndex + 1);
  });

  // Handle hash changes for search result navigation
  function showPageByHash() {
    var hash = window.location.hash;
    if (hash && hash.startsWith('#page-')) {
      var targetId = hash.substring(1); // Remove the #
      for (var i = 0; i < pages.length; i++) {
        if (pages[i].id === targetId) {
          showPage(i);
          return;
        }
      }
    }
  }

  // Listen for hash changes
  window.addEventListener('hashchange', showPageByHash);

  // Check initial hash on load
  showPageByHash();

  updateNavButtons();
})();`;
    }
    /**
     * Escape HTML special characters
     */
    escapeHtml(text) {
      const escapes = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      };
      return text.replace(/[&<>"']/g, (char) => escapes[char] || char);
    }
    /**
     * Escape string for use in HTML attributes
     */
    escapeAttr(text) {
      return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    /**
     * Sanitize filename for URLs
     */
    sanitizeFilename(title) {
      return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 50) || "page";
    }
    /**
     * Render search box container (without data-pages attribute)
     * The data is provided via window.exeSearchData inline script
     * The form is created dynamically by exe_export.js
     */
    renderSearchBox() {
      return `<div id="exe-client-search"
    data-block-order-string="Caja %e"
    data-no-results-string="Sin resultados.">
</div>`;
    }
    /**
     * Generate inline script for search data
     * This avoids bloating each page with large JSON in attributes
     */
    generateSearchDataScript(searchDataJson) {
      return `<script>window.exeSearchData = ${searchDataJson};<\/script>`;
    }
    /**
     * Generate search data JSON for client-side search functionality
     * For SPA preview, uses anchor links (#page-{id}) instead of file URLs
     * @param pages - All pages in the project
     * @param options - Preview options for URL generation
     * @returns JSON string with page structure
     */
    generateSearchData(pages, _options) {
      const pagesData = {};
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const isIndex = i === 0;
        const prevPage = i > 0 ? pages[i - 1] : null;
        const nextPage = i < pages.length - 1 ? pages[i + 1] : null;
        const fileName = `#page-${page.id}`;
        const fileUrl = `#page-${page.id}`;
        const blocksData = {};
        for (const block of page.blocks || []) {
          const idevicesData = {};
          for (let j = 0; j < (block.components || []).length; j++) {
            const component = block.components[j];
            idevicesData[component.id] = {
              order: j + 1,
              htmlView: component.content || "",
              jsonProperties: JSON.stringify(component.properties || {})
            };
          }
          blocksData[block.id] = {
            name: block.name || "",
            order: block.order || 1,
            idevices: idevicesData
          };
        }
        pagesData[page.id] = {
          name: page.title,
          isIndex,
          fileName,
          fileUrl,
          prePageId: prevPage?.id || null,
          nextPageId: nextPage?.id || null,
          blocks: blocksData
        };
      }
      return JSON.stringify(pagesData);
    }
  };

  // src/shared/export/exporters/ComponentExporter.ts
  var ComponentExporter = class extends BaseExporter {
    constructor(document2, resources, assets, zip2) {
      super(document2, resources, assets, zip2);
    }
    /**
     * Get file extension for component export
     */
    getFileExtension() {
      return ".elp";
    }
    /**
     * Get file suffix for component export
     */
    getFileSuffix() {
      return "";
    }
    /**
     * Standard export method (not typically used for components)
     * Use exportComponent() instead for targeted exports
     */
    async export(options) {
      const componentOptions = options;
      if (!componentOptions?.blockId) {
        return {
          success: false,
          error: "blockId is required for component export"
        };
      }
      return this.exportComponent(componentOptions.blockId, componentOptions.ideviceId);
    }
    /**
     * Export a single component (iDevice) or entire block
     * @param blockId - Block ID to export
     * @param ideviceId - iDevice ID (null or 'null' = export whole block)
     * @returns Export result with data buffer
     */
    async exportComponent(blockId, ideviceId) {
      const isIdevice = ideviceId && ideviceId !== "null";
      const filename = isIdevice ? `${ideviceId}.idevice` : `${blockId}.block`;
      console.log(`[ComponentExporter] Exporting ${isIdevice ? "iDevice" : "block"}: ${filename}`);
      try {
        const { block, component, pageId } = this.findComponent(blockId, ideviceId);
        if (!block) {
          console.log(`[ComponentExporter] Block not found: ${blockId}`);
          return { success: false, error: "Block not found" };
        }
        if (isIdevice && !component) {
          console.log(`[ComponentExporter] Component not found: ${ideviceId}`);
          return { success: false, error: "Component not found" };
        }
        const contentXml = this.generateComponentExportXml(block, component, pageId);
        this.zip.addFile("content.xml", new TextEncoder().encode(contentXml));
        await this.addComponentAssetsToZip(block, component);
        const data = await this.zip.generate();
        console.log(`[ComponentExporter] Export complete: ${filename}`);
        return { success: true, data, filename };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[ComponentExporter] Export failed:", error);
        return { success: false, error: message };
      }
    }
    /**
     * Export and trigger browser download
     * @param blockId - Block ID to export
     * @param ideviceId - iDevice ID (null = export whole block)
     * @returns Export result
     */
    async exportAndDownload(blockId, ideviceId) {
      const result = await this.exportComponent(blockId, ideviceId);
      if (result.success && result.data && result.filename) {
        this.downloadBlob(result.data, result.filename);
      }
      return result;
    }
    /**
     * Find block and component in document navigation structure
     * @param blockId - Block ID to find
     * @param ideviceId - Optional iDevice ID to find within block
     */
    findComponent(blockId, ideviceId) {
      const pages = this.buildPageList();
      for (const page of pages) {
        for (const block of page.blocks || []) {
          if (block.id === blockId) {
            if (ideviceId && ideviceId !== "null") {
              const component = (block.components || []).find((c) => c.id === ideviceId);
              return { block, component: component || null, pageId: page.id };
            }
            return { block, component: null, pageId: page.id };
          }
        }
      }
      return { block: null, component: null, pageId: null };
    }
    /**
     * Generate XML for component export (ODE format)
     * @param block - Block data
     * @param component - Single component to export (null = all components in block)
     * @param pageId - Page ID containing the block
     */
    generateComponentExportXml(block, component, pageId) {
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">\n';
      xml += "<odeResources>\n";
      xml += "  <odeResource>\n";
      xml += "    <key>odeComponentsResources</key>\n";
      xml += "    <value>true</value>\n";
      xml += "  </odeResource>\n";
      xml += "</odeResources>\n";
      xml += "<odePagStructures>\n";
      xml += this.generateBlockExportXml(block, component, pageId);
      xml += "</odePagStructures>\n";
      xml += "</ode>";
      return xml;
    }
    /**
     * Generate XML for the block structure
     * @param block - Block data
     * @param singleComponent - Single component to include (null = all)
     * @param pageId - Page ID
     */
    generateBlockExportXml(block, singleComponent, pageId) {
      let xml = "  <odePagStructure>\n";
      xml += `    <odeBlockId>${this.escapeXml(block.id)}</odeBlockId>
`;
      xml += `    <blockName>${this.escapeXml(block.name || "Block")}</blockName>
`;
      xml += `    <iconName></iconName>
`;
      xml += `    <odePagStructureOrder>0</odePagStructureOrder>
`;
      xml += `    <odePagStructureProperties>${this.escapeXml(JSON.stringify(block.properties || {}))}</odePagStructureProperties>
`;
      xml += "    <odeComponents>\n";
      const components = singleComponent ? [singleComponent] : block.components || [];
      for (const comp of components) {
        xml += this.generateIdeviceExportXml(comp, block.id, pageId);
      }
      xml += "    </odeComponents>\n";
      xml += "  </odePagStructure>\n";
      return xml;
    }
    /**
     * Generate XML for a single iDevice/component
     * @param comp - Component data
     * @param blockId - Parent block ID
     * @param pageId - Parent page ID
     */
    generateIdeviceExportXml(comp, blockId, pageId) {
      let xml = "      <odeComponent>\n";
      xml += `        <odeIdeviceId>${this.escapeXml(comp.id)}</odeIdeviceId>
`;
      xml += `        <odePageId>${this.escapeXml(pageId)}</odePageId>
`;
      xml += `        <odeBlockId>${this.escapeXml(blockId)}</odeBlockId>
`;
      xml += `        <odeIdeviceTypeName>${this.escapeXml(comp.type || "FreeTextIdevice")}</odeIdeviceTypeName>
`;
      xml += `        <ideviceSrcType>json</ideviceSrcType>
`;
      xml += `        <userIdevice>0</userIdevice>
`;
      xml += `        <htmlView><![CDATA[${comp.content || ""}]]></htmlView>
`;
      xml += `        <jsonProperties><![CDATA[${JSON.stringify(comp.properties || {})}]]></jsonProperties>
`;
      xml += `        <odeComponentsOrder>${comp.order || 0}</odeComponentsOrder>
`;
      xml += `        <odeComponentsProperties></odeComponentsProperties>
`;
      xml += "      </odeComponent>\n";
      return xml;
    }
    /**
     * Add only assets used by this component to ZIP
     * Scans component content for asset:// URLs and includes only those assets
     * @param block - Block data
     * @param singleComponent - Single component (null = all in block)
     */
    async addComponentAssetsToZip(block, singleComponent) {
      try {
        const allAssets = await this.assets.getAllAssets();
        const components = singleComponent ? [singleComponent] : block.components || [];
        const usedAssetIds = /* @__PURE__ */ new Set();
        for (const comp of components) {
          const content = comp.content || "";
          const matches = content.matchAll(/asset:\/\/([a-f0-9-]+)/gi);
          for (const match of matches) {
            usedAssetIds.add(match[1]);
          }
        }
        console.log(`[ComponentExporter] Found ${usedAssetIds.size} referenced assets`);
        let addedCount = 0;
        for (const asset of allAssets) {
          const assetId = asset.id;
          if (usedAssetIds.has(assetId)) {
            const filename = asset.filename || `asset-${assetId}`;
            const originalPath = asset.originalPath || `content/resources/${assetId}/${filename}`;
            this.zip.addFile(originalPath, asset.data);
            console.log(`[ComponentExporter] Added asset: ${originalPath}`);
            addedCount++;
          }
        }
        console.log(`[ComponentExporter] Added ${addedCount} assets to ZIP`);
      } catch (e) {
        console.warn("[ComponentExporter] Failed to add assets:", e);
      }
    }
    /**
     * Trigger browser download of blob data
     * @param data - ZIP data buffer
     * @param filename - Download filename
     */
    downloadBlob(data, filename) {
      if (typeof window === "undefined" || typeof document === "undefined") {
        console.warn("[ComponentExporter] downloadBlob only works in browser environment");
        return;
      }
      const blob = new Blob([data], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  // src/shared/export/browser/index.ts
  function createNullResourceProvider() {
    return {
      fetchTheme: async () => /* @__PURE__ */ new Map(),
      fetchIdeviceResources: async () => /* @__PURE__ */ new Map(),
      fetchBaseLibraries: async () => /* @__PURE__ */ new Map(),
      fetchScormFiles: async () => /* @__PURE__ */ new Map(),
      fetchLibraryFiles: async () => /* @__PURE__ */ new Map(),
      fetchLibraryDirectory: async () => /* @__PURE__ */ new Map(),
      fetchSchemas: async () => /* @__PURE__ */ new Map(),
      normalizeIdeviceType: (type) => type.toLowerCase().replace(/idevice$/i, "") || "text"
    };
  }
  function createNullAssetProvider() {
    return {
      getAsset: async () => null,
      hasAsset: async () => false,
      listAssets: async () => [],
      getAllAssets: async () => [],
      resolveAssetUrl: async () => null,
      getProjectAssets: async () => []
    };
  }
  function createExporter(format, documentManager, assetCache, resourceFetcher, assetManager) {
    if (!documentManager) {
      throw new Error("[SharedExporters] documentManager is required for export");
    }
    const document2 = new YjsDocumentAdapter(documentManager);
    const resources = resourceFetcher ? new BrowserResourceProvider(resourceFetcher) : createNullResourceProvider();
    const assets = assetCache || assetManager ? new BrowserAssetProvider(
      assetCache,
      assetManager
    ) : createNullAssetProvider();
    const zip2 = new FflateZipProvider();
    const normalizedFormat = format.toLowerCase().replace("-", "");
    switch (normalizedFormat) {
      case "html5":
      case "web":
        return new Html5Exporter(document2, resources, assets, zip2);
      case "html5sp":
      case "page":
        return new PageExporter(document2, resources, assets, zip2);
      case "scorm12":
      case "scorm":
        return new Scorm12Exporter(document2, resources, assets, zip2);
      case "scorm2004":
        return new Scorm2004Exporter(document2, resources, assets, zip2);
      case "ims":
      case "imscp":
        return new ImsExporter(document2, resources, assets, zip2);
      case "epub3":
      case "epub":
        throw new Error("EPUB3 export not yet implemented in shared code");
      case "elpx":
      case "elp":
        throw new Error("ELPX export not yet implemented in shared code");
      case "component":
      case "block":
      case "idevice":
        return new ComponentExporter(document2, resources, assets, zip2);
      default:
        throw new Error(`Unknown export format: ${format}`);
    }
  }
  async function quickExport(format, documentManager, assetCache, resourceFetcher, options, assetManager) {
    const exporter = createExporter(format, documentManager, assetCache, resourceFetcher, assetManager);
    return exporter.export(options);
  }
  async function exportAndDownload(format, documentManager, assetCache, resourceFetcher, filename, options, assetManager) {
    const exporter = createExporter(format, documentManager, assetCache, resourceFetcher, assetManager);
    const result = await exporter.export(options);
    if (!result.success || !result.data) {
      throw new Error(result.error || "Export failed");
    }
    const extension = exporter.getFileExtension();
    const fullFilename = filename.endsWith(extension) ? filename : `${filename}${extension}`;
    const blob = new Blob([result.data], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fullFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return result;
  }
  async function generatePreview(documentManager, resourceFetcher, options) {
    const document2 = new YjsDocumentAdapter(documentManager);
    const resources = resourceFetcher ? new BrowserResourceProvider(resourceFetcher) : createNullResourceProvider();
    const exporter = new WebsitePreviewExporter(document2, resources);
    return exporter.generatePreview(options);
  }
  async function openPreviewWindow(documentManager, resourceFetcher, options) {
    const result = await generatePreview(documentManager, resourceFetcher, options);
    if (!result.success || !result.html) {
      console.error("[SharedExporters] Preview generation failed:", result.error);
      return null;
    }
    let html = result.html;
    const resolveAssetUrlsAsync = window.resolveAssetUrlsAsync;
    if (typeof resolveAssetUrlsAsync === "function") {
      try {
        html = await resolveAssetUrlsAsync(html);
      } catch (error) {
        console.warn("[SharedExporters] Failed to resolve asset URLs:", error);
      }
    }
    const previewWindow = window.open("", "_blank");
    if (!previewWindow) {
      console.error("[SharedExporters] Could not open preview window (popup blocked?)");
      return null;
    }
    previewWindow.document.open();
    previewWindow.document.write(html);
    previewWindow.document.close();
    return previewWindow;
  }
  function createPreviewExporter(documentManager, resourceFetcher) {
    const document2 = new YjsDocumentAdapter(documentManager);
    const resources = resourceFetcher ? new BrowserResourceProvider(resourceFetcher) : createNullResourceProvider();
    return new WebsitePreviewExporter(document2, resources);
  }
  if (typeof window !== "undefined") {
    const windowExports = {
      // Factory functions
      createExporter,
      quickExport,
      exportAndDownload,
      // Preview functions
      generatePreview,
      openPreviewWindow,
      createPreviewExporter,
      // Adapters
      YjsDocumentAdapter,
      BrowserResourceProvider,
      BrowserAssetProvider,
      ExportAssetResolver,
      PreviewAssetResolver,
      // Providers
      FflateZipProvider,
      // Exporters
      Html5Exporter,
      PageExporter,
      Scorm12Exporter,
      Scorm2004Exporter,
      ImsExporter,
      WebsitePreviewExporter,
      ComponentExporter,
      // Renderers
      IdeviceRenderer,
      PageRenderer,
      // Generators
      Scorm12ManifestGenerator,
      Scorm2004ManifestGenerator,
      ImsManifestGenerator,
      LomMetadataGenerator,
      // Utilities
      LibraryDetector
    };
    window.SharedExporters = windowExports;
    window.createSharedExporter = createExporter;
    window.createExporter = createExporter;
    console.log("[SharedExporters] Browser export system loaded");
  }
})();
