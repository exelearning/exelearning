/**
 * PageHtmlRenderer
 * Renders complete HTML pages for export.
 *
 * Generates full HTML5 pages matching legacy Symfony exports:
 * - Proper DOCTYPE and meta tags
 * - CSS/JS includes for theme and iDevices
 * - Navigation menu structure
 * - Page content with blocks and iDevices
 * - Pagination and footer
 */
class PageHtmlRenderer {
  /**
   * @param {IdeviceHtmlRenderer} ideviceRenderer - Renderer for iDevice content
   */
  constructor(ideviceRenderer = null) {
    this.ideviceRenderer = ideviceRenderer || new IdeviceHtmlRenderer();
  }

  /**
   * Render a complete HTML page
   * @param {Object} page - Page data from buildPageList()
   * @param {Object} options - Rendering options
   * @returns {string} Complete HTML document
   */
  render(page, options = {}) {
    const {
      projectTitle = 'eXeLearning',
      language = 'en',
      theme = 'base',
      customStyles = '',
      allPages = [],
      basePath = '',
      isIndex = false,
      usedIdevices = [],
      author = '',
      license = 'CC-BY-SA',
      // SCORM-specific options
      isScorm = false,
      scormVersion = '',
      bodyClass = '',
      extraHeadScripts = '',
      onLoadScript = '',
      onUnloadScript = '',
    } = options;

    const pageTitle = page.title || 'Page';
    const fullTitle = `${this.escapeHtml(pageTitle)} | ${this.escapeHtml(projectTitle)}`;

    // Build body class
    let bodyClassStr = bodyClass || 'exe-export exe-web-site';
    const onLoadAttr = onLoadScript ? ` onload="${onLoadScript}"` : '';
    const onUnloadAttr = onUnloadScript ? ` onunload="${onUnloadScript}" onbeforeunload="${onUnloadScript}"` : '';

    return `<!DOCTYPE html>
<html lang="${language}" id="exe-${isIndex ? 'index' : page.id}">
<head>
${this.renderHead({ pageTitle: fullTitle, basePath, usedIdevices, customStyles, extraHeadScripts, isScorm, scormVersion })}
</head>
<body class="${bodyClassStr}" lang="${language}"${onLoadAttr}${onUnloadAttr}>
<script>document.body.className+=" js"</script>
<div class="exe-content exe-export pre-js siteNav-hidden">
${this.renderNavigation(allPages, page.id, basePath)}
<main id="${page.id}" class="page">
${this.renderPageHeader(page)}
<div id="page-content-${page.id}" class="page-content">
${this.renderPageContent(page, basePath)}
</div>
${this.renderPagination(page, allPages, basePath)}
</main>
${this.renderFooter({ author, license })}
</div>
${this.renderScripts(basePath, isScorm)}
</body>
</html>`;
  }

  /**
   * Render HTML head section
   * @param {Object} options
   * @returns {string}
   */
  renderHead(options) {
    const {
      pageTitle,
      basePath,
      usedIdevices,
      customStyles,
      extraHeadScripts = '',
      isScorm = false,
      scormVersion = '',
    } = options;

    let head = `<meta charset="utf-8">
<meta name="generator" content="eXeLearning 4.0 - exelearning.net">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${pageTitle}</title>
<script>document.querySelector("html").classList.add("js");</script>
<link rel="stylesheet" href="${basePath}libs/bootstrap/bootstrap.min.css">
<link rel="stylesheet" href="${basePath}content/css/base.css">
<link rel="stylesheet" href="${basePath}theme/content.css">`;

    // Add iDevice-specific CSS
    const cssLinks = this.ideviceRenderer.getCssLinks(usedIdevices, basePath);
    for (const link of cssLinks) {
      head += `\n${link}`;
    }

    // Add custom styles
    if (customStyles) {
      head += `\n<style>\n${customStyles}\n</style>`;
    }

    // Add SCORM-specific scripts in head (before body scripts)
    if (extraHeadScripts) {
      head += `\n${extraHeadScripts}`;
    }

    return head;
  }

  /**
   * Render navigation menu
   * @param {Array} allPages - All pages in the project
   * @param {string} currentPageId - ID of the current page
   * @param {string} basePath - Base path for links
   * @returns {string}
   */
  renderNavigation(allPages, currentPageId, basePath) {
    const rootPages = allPages.filter(p => !p.parentId);

    let html = '<nav id="siteNav">\n<ul>\n';
    for (const page of rootPages) {
      html += this.renderNavItem(page, allPages, currentPageId, basePath);
    }
    html += '</ul>\n</nav>';

    return html;
  }

  /**
   * Render a single navigation item (recursive for children)
   * @param {Object} page
   * @param {Array} allPages
   * @param {string} currentPageId
   * @param {string} basePath
   * @returns {string}
   */
  renderNavItem(page, allPages, currentPageId, basePath) {
    const children = allPages.filter(p => p.parentId === page.id);
    const isCurrent = page.id === currentPageId;
    const hasChildren = children.length > 0;
    const isAncestor = this.isAncestorOf(page.id, currentPageId, allPages);

    const classAttr = isCurrent ? ' class="active"' : (isAncestor ? ' class="parent"' : '');
    const link = this.getPageLink(page, allPages, basePath);
    const linkClass = hasChildren ? 'daddy' : 'no-ch';

    let html = `<li${classAttr}>`;
    html += ` <a href="${link}" class="${isCurrent ? 'active ' : ''}${linkClass}">${this.escapeHtml(page.title)}</a>\n`;

    if (hasChildren) {
      html += '<ul class="other-section">\n';
      for (const child of children) {
        html += this.renderNavItem(child, allPages, currentPageId, basePath);
      }
      html += '</ul>\n';
    }

    html += '</li>\n';
    return html;
  }

  /**
   * Check if a page is an ancestor of another
   * @param {string} ancestorId
   * @param {string} childId
   * @param {Array} allPages
   * @returns {boolean}
   */
  isAncestorOf(ancestorId, childId, allPages) {
    const child = allPages.find(p => p.id === childId);
    if (!child || !child.parentId) return false;
    if (child.parentId === ancestorId) return true;
    return this.isAncestorOf(ancestorId, child.parentId, allPages);
  }

  /**
   * Get page link URL
   * @param {Object} page
   * @param {Array} allPages
   * @param {string} basePath
   * @returns {string}
   */
  getPageLink(page, allPages, basePath) {
    const isFirstPage = page.id === allPages[0]?.id;
    if (isFirstPage) {
      return basePath ? `${basePath}index.html` : 'index.html';
    }
    const filename = this.sanitizeFilename(page.title);
    return `${basePath}html/${filename}.html`;
  }

  /**
   * Sanitize title for use as filename
   * @param {string} title
   * @returns {string}
   */
  sanitizeFilename(title) {
    if (!title) return 'page';
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }

  /**
   * Render page header with title
   * @param {Object} page
   * @returns {string}
   */
  renderPageHeader(page) {
    return `<header class="page-header">
<h2 class="page-title">${this.escapeHtml(page.title)}</h2>
</header>`;
  }

  /**
   * Render page content (blocks with iDevices)
   * @param {Object} page
   * @param {string} basePath
   * @returns {string}
   */
  renderPageContent(page, basePath) {
    let html = '';

    for (const block of page.blocks || []) {
      html += this.ideviceRenderer.renderBlock(block, {
        basePath,
        includeDataAttributes: true,
      });
    }

    return html;
  }

  /**
   * Render pagination (prev/next links)
   * @param {Object} page
   * @param {Array} allPages
   * @param {string} basePath
   * @returns {string}
   */
  renderPagination(page, allPages, basePath) {
    const currentIndex = allPages.findIndex(p => p.id === page.id);
    const prevPage = currentIndex > 0 ? allPages[currentIndex - 1] : null;
    const nextPage = currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;

    if (!prevPage && !nextPage) {
      return '';
    }

    let html = '<nav class="pagination">\n';

    if (prevPage) {
      const link = this.getPageLink(prevPage, allPages, basePath);
      html += `<a href="${link}" class="prev"><span>&laquo; </span>${this.escapeHtml(prevPage.title)}</a>`;
    }

    if (prevPage && nextPage) {
      html += ' | ';
    }

    if (nextPage) {
      const link = this.getPageLink(nextPage, allPages, basePath);
      html += `<a href="${link}" class="next">${this.escapeHtml(nextPage.title)}<span> &raquo;</span></a>`;
    }

    html += '\n</nav>';
    return html;
  }

  /**
   * Render footer section
   * @param {Object} options
   * @returns {string}
   */
  renderFooter(options) {
    const { author, license } = options;

    let html = `<footer id="packageLicense" class="cc cc-by-sa">`;
    if (author) {
      html += `\n<p><span>Author:</span> ${this.escapeHtml(author)}</p>`;
    }
    html += `\n<p><span>License:</span> ${this.escapeHtml(license)}</p>`;
    html += '\n</footer>';
    return html;
  }

  /**
   * Render script tags for JS libraries
   * @param {string} basePath
   * @param {boolean} isScorm - Whether this is a SCORM export
   * @returns {string}
   */
  renderScripts(basePath, isScorm = false) {
    let scripts = `<script type="text/javascript" src="${basePath}libs/jquery/jquery.min.js"></script>
<script type="text/javascript" src="${basePath}libs/exe_export.js"></script>
<script type="text/javascript" src="${basePath}libs/common_i18n.js"></script>
<script type="text/javascript" src="${basePath}libs/common.js"></script>
<script type="text/javascript" src="${basePath}theme/default.js"></script>`;

    // Note: SCORM API scripts are added via extraHeadScripts for proper load order
    return scripts;
  }

  /**
   * Render a single-page HTML document with all pages
   * @param {Array} allPages - All pages in the project
   * @param {Object} options - Rendering options
   * @returns {string}
   */
  renderSinglePage(allPages, options = {}) {
    const {
      projectTitle = 'eXeLearning',
      language = 'en',
      customStyles = '',
      usedIdevices = [],
      author = '',
      license = 'CC-BY-SA',
    } = options;

    let contentHtml = '';
    for (const page of allPages) {
      contentHtml += `<section id="section-${page.id}" class="single-page-section">
${this.renderPageHeader(page)}
<div class="page-content">
${this.renderPageContent(page, '')}
</div>
</section>\n`;
    }

    return `<!DOCTYPE html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="generator" content="eXeLearning 4.0 - exelearning.net">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${this.escapeHtml(projectTitle)}</title>
<script>document.querySelector("html").classList.add("js");</script>
<link rel="stylesheet" href="libs/bootstrap/bootstrap.min.css">
<link rel="stylesheet" href="content/css/base.css">
<link rel="stylesheet" href="theme/content.css">
${this.ideviceRenderer.getCssLinks(usedIdevices, '').join('\n')}
${customStyles ? `<style>\n${customStyles}\n</style>` : ''}
</head>
<body class="exe-export exe-single-page" lang="${language}">
<script>document.body.className+=" js"</script>
<div class="exe-content exe-export pre-js">
${this.renderSinglePageNav(allPages)}
<main class="single-page-content">
${contentHtml}
</main>
${this.renderFooter({ author, license })}
</div>
${this.renderScripts('')}
</body>
</html>`;
  }

  /**
   * Render navigation for single-page export (anchor links)
   * @param {Array} allPages
   * @returns {string}
   */
  renderSinglePageNav(allPages) {
    const rootPages = allPages.filter(p => !p.parentId);

    let html = '<nav id="siteNav" class="single-page-nav">\n<ul>\n';
    for (const page of rootPages) {
      html += this.renderSinglePageNavItem(page, allPages);
    }
    html += '</ul>\n</nav>';

    return html;
  }

  /**
   * Render a single navigation item for single-page (anchor links)
   * @param {Object} page
   * @param {Array} allPages
   * @returns {string}
   */
  renderSinglePageNavItem(page, allPages) {
    const children = allPages.filter(p => p.parentId === page.id);
    const hasChildren = children.length > 0;

    let html = '<li>';
    html += ` <a href="#section-${page.id}" class="${hasChildren ? 'daddy' : 'no-ch'}">${this.escapeHtml(page.title)}</a>\n`;

    if (hasChildren) {
      html += '<ul class="other-section">\n';
      for (const child of children) {
        html += this.renderSinglePageNavItem(child, allPages);
      }
      html += '</ul>\n';
    }

    html += '</li>\n';
    return html;
  }

  /**
   * Escape HTML special characters
   * @param {string} str
   * @returns {string}
   */
  escapeHtml(str) {
    if (!str) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return String(str).replace(/[&<>"']/g, m => map[m]);
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PageHtmlRenderer;
} else {
  window.PageHtmlRenderer = PageHtmlRenderer;
}
