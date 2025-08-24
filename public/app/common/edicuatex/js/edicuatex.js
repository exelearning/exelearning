// Global placeholder for the translation function
let _ = str => str;

// --- Language & UI Update Functions ---
function setupLanguageSelector() {
    const languageSelector = document.getElementById('language-selector');
    if (!languageSelector || isInExe) return;

    languageSelector.style.display = 'flex';
    const langButtons = document.querySelectorAll('.lang-btn');
    const currentLang = document.documentElement.lang;

    langButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLang);
        btn.addEventListener('click', () => changeLanguage(btn.dataset.lang));
    });
}

function changeLanguage(newLang) {
    document.documentElement.lang = newLang;
    localStorage.setItem('userLanguage', newLang);
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === newLang);
    });
    updateAllDynamicTexts();
    addFooter(); // Retranslate footer
}

function updateAllDynamicTexts() {
    document.title = _('EdiCuaTeX - LaTeX Equation Editor');
    document.querySelectorAll('[data-i18n-key]').forEach(el => {
        const key = el.getAttribute('data-i18n-key');
        // Special handling for elements with mixed content (e.g., text and a link)
        if (el.querySelector('a[data-i18n-key]')) {
            const link = el.querySelector('a');
            const linkKey = link.getAttribute('data-i18n-key');
            link.textContent = _(linkKey);
            // The main text needs a placeholder for the link, e.g., "Text with %s"
            // This is complex, so we just translate the text part for now.
            const textNode = Array.from(el.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
            if (textNode) {
               textNode.textContent = _(key) + " ";
            }
        } else if (el.closest('button#ask-ai-btn')) {
            el.textContent = " " + _(key); // Keep space for emoji
        } else {
            el.textContent = _(key);
        }
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => el.title = _(el.getAttribute('data-i18n-title')));
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => el.placeholder = _(el.getAttribute('data-i18n-placeholder')));
    
    // Rebuild UI parts that are created dynamically
    if (window.rebuildToolbarAndUI) {
        window.rebuildToolbarAndUI();
    }
}

// This function must be available globally to be called from the DOMContentLoaded listener
function addFooter() {
    const footer = document.getElementById('page-footer');
    if (footer) {
        footer.innerHTML = `<p style="margin-bottom: 10px;"><a href="https://labia.tiddlyhost.com" target="_blank" rel="noopener noreferrer">${_('Educational Applications Laboratory')}</a> | <a href="https://bilateria.org" target="_blank" rel="noopener noreferrer">${_('Application created by Juan José de Haro')}</a></p><p style="margin-bottom: 10px;"><a href="https://creativecommons.org/licenses/by-sa/4.0/deed.es" target="_blank" rel="noopener noreferrer">Licencia Creative Commons BY-SA</a></p><p style="margin-top: 20px; font-size: 0.8em; opacity: 0.7;">v1.1</p>`;
    }
};

// --- Main Application Logic ---
async function initializeLatexEditor() {
    // --- DOM REFERENCES ---
    const latexInput = document.getElementById('latex-input');
    const preview = document.getElementById('preview');
    const copyButton = document.getElementById('copy-button');
    const clearButton = document.getElementById('clear-button');
    const insertButton = document.getElementById('insert-button');
    const viewImageButton = document.getElementById('view-image-button');
    const delimiterSelector = document.getElementById('delimiter-selector');
    const copyCodeFeedback = document.getElementById('copy-code-feedback');
    const tabsContainer = document.getElementById('tabs-container');
    const toolbar = document.getElementById('toolbar');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const menuTogglerBtn = document.getElementById('menu-toggler-btn');
    const settingsBtn = document.getElementById('settings-btn');
    // Modals
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const urlInput = document.getElementById('url-input');
    const fileInput = document.getElementById('file-input');
    const loadUrlBtn = document.getElementById('load-url-btn'); // <-- New button reference
    const modalFeedback = document.getElementById('modal-feedback');
    const alertModal = document.getElementById('alert-modal');
    const alertModalTitle = document.getElementById('alert-modal-title');
    const alertModalMessage = document.getElementById('alert-modal-message');
    const alertModalCloseBtn = document.getElementById('alert-modal-close-btn');
    const availableMenusList = document.getElementById('available-menus-list');
    const reloadMenusListBtn = document.getElementById('reload-menus-list-btn');
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    // AI Modal
    const askAiBtn = document.getElementById('ask-ai-btn');
    const aiModal = document.getElementById('ai-modal');
    const closeAiModalBtn = document.getElementById('close-ai-modal-btn');
    const aiUserPrompt = document.getElementById('ai-user-prompt');
    const generateAiPromptBtn = document.getElementById('generate-ai-prompt-btn');
    const aiGeneratedPrompt = document.getElementById('ai-generated-prompt');
    const openChatGptBtn = document.getElementById('open-chatgpt-btn');
    const copyAiPromptBtn = document.getElementById('copy-ai-prompt-btn');
    const aiFeedback = document.getElementById('ai-feedback');
    const maximizeBtn = document.getElementById('maximize-btn');

    // --- Helper functions for initialization ---
    function stripLatexDelimiters(code) {
        if (!code) return code;
        const trimmed = code.trim();
        const patterns = [
            /^\\\(([\s\S]+?)\\\)$/,   // \( ... \)
            /^\\\[([\s\S]+?)\\\]$/,   // \\[ ... \\]
            /^\$\$([\s\S]+?)\$\$$/,     // $$ ... $$
            /^\$([\s\S]+?)\$$/        // $ ... $
        ];
        for (const p of patterns) {
            const m = trimmed.match(p);
            if (m) return m[1].trim();
        }
        return trimmed;
    }

    function autoPickDelimiter(latexFragment){
        const selectorEl = document.getElementById('delimiter-selector');
        if(!selectorEl || !latexFragment) return;
        const frag = latexFragment.trim();
        
        if(/^\\\(.+?\\\)$/.test(frag)){ selectorEl.value = 'parentheses'; return; }
        if(/^\\\[([\s\S]+?)\\\]$/.test(frag)){ selectorEl.value = 'brackets'; return; }
        if(/^\$\$([\s\S]+?)\$\$$/.test(frag)){ selectorEl.value = 'double_dollar'; return; }
        if(/^\$([\s\S]+?)\$$/.test(frag)){ selectorEl.value = 'single_dollar'; return; }

        // If no delimiter is found, default based on context
        selectorEl.value = isInExe ? 'parentheses' : 'none';
    }
    
    // --- Contextual UI Adjustments & Initialization ---
    if (isInExe) {
        // Hide elements not needed inside the eXeLearning plugin view
        const headerEl = document.querySelector('.header');
        const footerEl = document.querySelector('.footer');
        if (headerEl) headerEl.style.display = 'none';
        if (footerEl) footerEl.style.display = 'none';

        // Inside eXe, we "Insert", so "Copy" is less relevant and can be hidden.
        if (copyButton) copyButton.style.display = 'none';

        // Also, limit the available delimiters for the eXe context
        if (delimiterSelector) {
            const allowedDelims = ['none', 'parentheses', 'brackets'];
            Array.from(delimiterSelector.options).forEach(opt => {
                if (!allowedDelims.includes(opt.value)) {
                    opt.remove();
                }
            });
             // Set a sensible default if no formula is pre-filled
            if (!latexInput.value.trim()) {
                delimiterSelector.value = 'parentheses';
            }
        }

    } else {
        // When running standalone (outside eXe), the "Insert" button has no target editor.
        if (insertButton) insertButton.style.display = 'none';
    }

    // --- Prefill from eXeLearning Selection (URL Parameter) ---
    const urlSel = new URLSearchParams(window.location.search).get('sel');
    if (urlSel) {
        const originalSel = decodeURIComponent(urlSel);
        autoPickDelimiter(originalSel);
        latexInput.value = stripLatexDelimiters(originalSel);
    }

    // Prefill from other potential eXe dialogs (legacy support)
    try {
        if (window.opener && window.opener.PasteMathDialog && window.opener.PasteMathDialog.mathEditor && window.opener.PasteMathDialog.mathEditor.field) {
            const parentLatex = window.opener.PasteMathDialog.mathEditor.field.val().trim();
            if (parentLatex) {
                autoPickDelimiter(parentLatex);
                latexInput.value = stripLatexDelimiters(parentLatex);
            }
        }
    } catch (err) {
        console.warn(_('Could not get code from parent dialog:'), err);
    }

    // --- CONFIG & STATE ---
    const MANIFEST_URL = './menus/menus.json';
    const MAX_RECENTS = 12;
    let loadedMenus = new Map();
    let menuCache = new Map();
    let recentSymbols = [];
    
    // --- CORE FUNCTIONS (RESTORED AND INTERNATIONALIZED) ---

    const loadRecents = () => { recentSymbols = JSON.parse(localStorage.getItem('latexRecents')) || []; };
    const saveRecents = () => { localStorage.setItem('latexRecents', JSON.stringify(recentSymbols)); };
    const clearRecents = () => { recentSymbols = []; localStorage.removeItem('latexRecents'); rebuildToolbarAndUI(); };
    
    const createRecentsTab = () => {
        if (document.querySelector('[data-tab="recientes"]')) return;
        const recentsTabButton = document.createElement('button');
        recentsTabButton.className = 'tab-btn';
        recentsTabButton.dataset.tab = 'recientes';
        recentsTabButton.textContent = _('Recent');
        tabsContainer.prepend(recentsTabButton);
        const recentsContentDiv = document.createElement('div');
        recentsContentDiv.id = 'tab-recientes';
        recentsContentDiv.className = 'tab-content';
        toolbar.prepend(recentsContentDiv);
    };

    const trackSymbolUsage = (latexCode) => {
        const wasEmpty = recentSymbols.length === 0;
        recentSymbols = recentSymbols.filter(item => item !== latexCode);
        recentSymbols.unshift(latexCode);
        if (recentSymbols.length > MAX_RECENTS) recentSymbols = recentSymbols.slice(0, MAX_RECENTS);
        saveRecents();
        if (wasEmpty) {
            createRecentsTab();
            renderTabContent('recientes', getAllCategories());
        } else {
            const recentsContent = document.getElementById('tab-recientes');
            if (recentsContent && recentsContent.classList.contains('active')) {
                renderTabContent('recientes', getAllCategories());
            }
        }
    };
    
    const saveAddedMenusToStorage = () => {
        const added = Array.from(loadedMenus.values())
            .filter(m => m.source !== 'default' && m.source !== 'localfile')
            .map(m => ({ id: m.id, url: m.url, source: m.source, name: m.name }));
        localStorage.setItem('latexAddedMenus', JSON.stringify(added));
    };

    const loadAddedMenusFromStorage = () => JSON.parse(localStorage.getItem('latexAddedMenus')) || [];

    const fetchMenuData = async (url) => {
        if (menuCache.has(url)) return menuCache.get(url);
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            menuCache.set(url, data);
            return data;
        } catch (error) {
            console.error(_('Error loading menu') + ` ${url}:`, error);
            showModalFeedback(_('Could not load') + ` ${url}`, true);
            return null;
        }
    };

    const addMenu = async (menuInfo) => {
        if (loadedMenus.has(menuInfo.id)) return;
        menuInfo.url = 'menus/' + menuInfo.url;
        const data = await fetchMenuData(menuInfo.url);
        if (data) {
            loadedMenus.set(menuInfo.id, { ...menuInfo, data });
            rebuildToolbarAndUI();
            saveAddedMenusToStorage();
        }
    };
    
    const removeMenu = (menuId) => {
        if (loadedMenus.has(menuId)) {
            loadedMenus.delete(menuId);
            rebuildToolbarAndUI();
            saveAddedMenusToStorage();
        }
    };

    const getAllCategories = () => {
        const allCategories = new Map();
        const menuOrder = ['default', 'github', 'url', 'localfile'];
        const sortedMenus = Array.from(loadedMenus.values()).sort((a,b) => menuOrder.indexOf(a.source) - menuOrder.indexOf(b.source));
        for (const menu of sortedMenus) {
            if (!menu.data || !menu.data.categorias) continue;
            for (const categoria of menu.data.categorias) {
                if (!allCategories.has(categoria.id)) {
                     allCategories.set(categoria.id, { ...categoria, elementos: [...categoria.elementos] });
                } else {
                    allCategories.get(categoria.id).elementos.push(...categoria.elementos);
                }
            }
        }
        return allCategories;
    };

    window.rebuildToolbarAndUI = () => {
        tabsContainer.innerHTML = '';
        toolbar.innerHTML = '';
        const allCategories = getAllCategories();
        let isFirstTab = true;

        if (recentSymbols.length > 0) {
            createRecentsTab();
            isFirstTab = false;
        }

        allCategories.forEach((categoria) => {
            const tabButton = document.createElement('button');
            tabButton.className = 'tab-btn';
            tabButton.dataset.tab = categoria.id;
            tabButton.textContent = _(categoria.nombre); // Translate category name
            tabsContainer.appendChild(tabButton);
            const contentDiv = document.createElement('div');
            contentDiv.id = `tab-${categoria.id}`;
            contentDiv.className = 'tab-content';
            toolbar.appendChild(contentDiv);
        });

        // Set active tab after creating all of them
        let activeTab = tabsContainer.querySelector('.tab-btn.active');
        if (!activeTab) {
            const firstTab = tabsContainer.querySelector('[data-tab="recientes"]') || tabsContainer.querySelector('.tab-btn');
            if (firstTab) {
                activeTab = firstTab;
            }
        }
        
        if (activeTab) {
           activeTab.classList.add('active');
           const activeContent = document.getElementById(`tab-${activeTab.dataset.tab}`);
           if (activeContent) activeContent.classList.add('active');
           renderTabContent(activeTab.dataset.tab, allCategories);
        } else {
           // Fallback if no tabs exist at all
           toolbar.innerHTML = `<p>${_('No menus found.')}</p>`;
        }
        
        loadAndDisplayAvailableMenus();
    };

    async function loadAndDisplayAvailableMenus(forceReload = false) {
        const menuItemsMap = new Map();
        if (window.__manifestMenus) {
            window.__manifestMenus.forEach(menuItem => {
                const id = menuItem.file;
                menuItemsMap.set(id, {
                    id: id,
                    url: `./${id}`,
                    name: id.replace('.json', ''),
                    source: id === 'base.json' ? 'default' : 'manifest',
                    description: menuItem.description
                });
            });
        }
        loadedMenus.forEach(menu => { if (!menuItemsMap.has(menu.id)) menuItemsMap.set(menu.id, { ...menu }); });
        loadAddedMenusFromStorage().forEach(stored => { if (!menuItemsMap.has(stored.id)) menuItemsMap.set(stored.id, { ...stored }); });
        
        availableMenusList.innerHTML = '';
        if (menuItemsMap.size === 0) {
            availableMenusList.innerHTML = `<li>${_('No menus found.')}</li>`;
            return;
        }
        menuItemsMap.forEach(menu => {
            const li = document.createElement('li');
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.id = `menu-checkbox-${menu.id}`;
            cb.checked = loadedMenus.has(menu.id);
            cb.dataset.id = menu.id;
            cb.dataset.url = menu.url;
            cb.dataset.name = menu.name;
            cb.dataset.source = menu.source;
            const label = document.createElement('label');
            label.htmlFor = cb.id;
            label.className = 'menu-list-item-name';
            
            const menuName = _(menu.name) || menu.id;
            const menuDescription = _(menu.description || '');

            label.textContent = menuDescription ? `${menuName} (${menuDescription})` : menuName;
            label.title = `${_('File')}: ${menu.id}`;
            
            li.appendChild(cb);
            li.appendChild(label);
            availableMenusList.appendChild(li);
        });
        if (isInExe) {
            
        }
    }

    function showAlert(title, htmlMessage) {
        alertModalTitle.textContent = _(title); // Translate title
        alertModalMessage.innerHTML = htmlMessage; // Message may contain HTML
        alertModal.classList.add('active');
    }

    function hideAlert() { alertModal.classList.remove('active'); }

    function showImageModal(message, buttons) {
        document.getElementById('modal-message').innerHTML = message;
        const modalButtons = document.getElementById('modal-buttons');
        modalButtons.innerHTML = '';
        buttons.forEach(btnInfo => {
            const button = document.createElement('button');
            button.textContent = _(btnInfo.text); // Translate button text
            button.className = `btn ${btnInfo.class}`;
            button.onclick = () => { if(btnInfo.action) btnInfo.action(); document.getElementById('image-modal').classList.remove('active'); };
            modalButtons.appendChild(button);
        });
        document.getElementById('image-modal').classList.add('active');
    }

    function showModalFeedback(message, isError = false) {
        modalFeedback.textContent = message; // Already translated when called
        modalFeedback.style.color = isError ? 'var(--danger-color)' : 'var(--success-color)';
        setTimeout(() => modalFeedback.textContent = '', 3000);
    }

    function generateAiPrompt() {
        const userDescription = aiUserPrompt.value.trim();
        if (!userDescription) {
            showAiFeedback(_('Please describe the formula you need.'), true);
            return;
        }
        const prompt = `Provide the LaTeX code for the following mathematical description: "${userDescription}". The result should be only the LaTeX code, without additional explanations or delimiters like $$ or \\[ \\]. It should be ready to copy and paste directly into a LaTeX editor.`;
        aiGeneratedPrompt.value = prompt;
        openChatGptBtn.href = `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
        openChatGptBtn.style.display = 'inline-block';
        copyAiPromptBtn.style.display = 'inline-block';
        showAiFeedback(_('Instruction generated. You can now use the buttons.'), false);
    }

    function showAiFeedback(message, isError = false) {
        aiFeedback.textContent = message; // Already translated
        aiFeedback.style.color = isError ? 'var(--danger-color)' : 'var(--success-color)';
        aiFeedback.style.opacity = '1';
        setTimeout(() => { if (aiFeedback.textContent === message) { aiFeedback.style.opacity = '0'; } }, 4000);
    }

    function copyAiPrompt() {
        if (!aiGeneratedPrompt.value) return;
        navigator.clipboard.writeText(aiGeneratedPrompt.value);
        showAiFeedback(_('Instruction copied to clipboard!'), false);
    }
    
    function updatePreview() {
        const sanitizedInput = DOMPurify.sanitize(latexInput.value.trim());
        preview.innerHTML = sanitizedInput === "" ? "" : `$$${sanitizedInput}$$`;
        MathJax.typesetPromise([preview]).catch(() => { preview.innerHTML = `<span style="color:red;">${_('Syntax error')}</span>`; });
    }

    function insertAtCursor(textToInsert) {
        const startPos = latexInput.selectionStart;
        latexInput.value = latexInput.value.substring(0, startPos) + textToInsert + latexInput.value.substring(latexInput.selectionEnd);
        let cursorPos = textToInsert.indexOf('{}');
        latexInput.selectionStart = latexInput.selectionEnd = startPos + (cursorPos !== -1 ? cursorPos + 1 : textToInsert.length);
        latexInput.focus();
        updatePreview();
        if (textToInsert.includes('\\begin{')) return;
        trackSymbolUsage(textToInsert);
    }
    
    function generateImage(callback) {
        const svgElement = preview.querySelector('svg');
        if (!svgElement) { showImageModal(`<p>${_('No formula to capture.')}</p>`, [{text: _('Understood'), class: 'btn-primary'}]); return; }
        const svgString = new XMLSerializer().serializeToString(svgElement);
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const padding = 20;
            canvas.width = svgElement.width.baseVal.value + padding * 2;
            canvas.height = svgElement.height.baseVal.value + padding * 2;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, padding, padding, svgElement.width.baseVal.value, svgElement.height.baseVal.value);
            URL.revokeObjectURL(img.src);
            callback(canvas);
        };
        img.src = URL.createObjectURL(new Blob([svgString], {type: "image/svg+xml;charset=utf-8"}));
    }
    
    function handleViewImage() {
        generateImage(canvas => {
            const message = `<div><img src="${canvas.toDataURL('image/png')}" style="max-width: 100%; max-height: 80vh;"><p>${_('Right-click on the image to save or copy it.')}</p></div>`;
            showImageModal(message, [{text: _('Close'), class: 'btn-secondary'}]);
        });
    }

    function createMatrixBuilderUI(elemento) {
        const container = document.createElement('div');
        container.className = 'matrix-builder';
        container.dataset.title = _(elemento.title) || _('Matrix');
        container.innerHTML = `<div class="matrix-builder-group"><label for="mb-rows">${_('Rows:')}</label><input type="number" id="mb-rows" value="2" min="1" max="20"></div><div class="matrix-builder-group"><label for="mb-cols">${_('Columns:')}</label><input type="number" id="mb-cols" value="2" min="1" max="20"></div><div class="matrix-builder-group"><label for="mb-fill">${_('Fill:')}</label><select id="mb-fill"><option value="subscripts">${_('Subscripts (a, b...)')}</option><option value="zeros">${_('Zeros (0)')}</option><option value="ones">${_('Ones (1)')}</option><option value="vars">${_('Variables (a, b, c...)')}</option><option value="numbers">${_('Numbers (1, 2, 3...)')}</option><option value="empty">${_('Empty ({})')}</option></select></div><div class="matrix-builder-delimiters"><button class="btn" data-delimiter="pmatrix">()</button><button class="btn" data-delimiter="bmatrix">[]</button><button class="btn" data-delimiter="vmatrix">||</button><button class="btn" data-delimiter="Vmatrix">|||</button></div>`;
        container.querySelector('.matrix-builder-delimiters').addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;
            const rows = parseInt(container.querySelector('#mb-rows').value, 10);
            const cols = parseInt(container.querySelector('#mb-cols').value, 10);
            insertAtCursor(generateMatrixCode(rows, cols, container.querySelector('#mb-fill').value, button.dataset.delimiter));
        });
        return container;
    }

    function generateMatrixCode(rows, cols, fillType, delimiter) {
        if (isNaN(rows) || isNaN(cols) || rows < 1 || cols < 1) return '';
        let content = '', counter = 0;
        for (let i = 1; i <= rows; i++) {
            for (let j = 1; j <= cols; j++) {
                let cell;
                switch(fillType) {
                    case 'subscripts': cell = `a_{${i}${j}}`; break;
                    case 'zeros': cell = '0'; break; case 'ones': cell = '1'; break;
                    case 'vars': cell = 'abcdefghijklmnopqrstuvwxyz'[counter % 26]; counter++; break;
                    case 'numbers': cell = (counter + 1).toString(); counter++; break;
                    case 'empty': cell = '{}'; break;
                    default: cell = '';
                }
                content += cell + (j < cols ? ' & ' : '');
            }
            if (i < rows) content += ' \\\\\n  ';
        }
        return `\\begin{${delimiter}}\n  ${content}\n\\end{${delimiter}}`;
    }

    function normalizeString(str) { return typeof str !== 'string' ? '' : str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
    
    function renderTabContent(tabId, allCategories) {
        const contentDiv = document.getElementById(`tab-${tabId}`);
        if (!contentDiv) return;
        contentDiv.innerHTML = '';
        let elementsToRender = [], gridColumns = "repeat(auto-fill, minmax(80px, 1fr))";
        if (tabId === 'recientes') {
            if (recentSymbols.length === 0) {
                 contentDiv.innerHTML = `<p style="color: var(--dark-gray); grid-column: 1 / -1; text-align:center;">${_('No recent symbols yet.')}</p><div id="clear-recents-btn-container" style="grid-column: 1 / -1;"><button id="clear-recents-btn" class="btn btn-sm btn-danger">${_('Clear recent')}</button></div>`;
                 if(document.getElementById('clear-recents-btn')) document.getElementById('clear-recents-btn').onclick = clearRecents;
                 return;
            }
            recentSymbols.forEach(latexCode => {
                for (const menu of loadedMenus.values()) {
                    if (!menu.data || !menu.data.categorias) continue;
                    for (const categoria of menu.data.categorias) {
                        const found = categoria.elementos.find(el => el && el.latex === latexCode);
                        if (found) { elementsToRender.push(found); return; }
                    }
                }
            });
        } else {
            const categoria = allCategories.get(tabId);
            if (categoria) { elementsToRender = categoria.elementos; gridColumns = categoria.grid_template_columns || gridColumns; }
        }
        contentDiv.style.gridTemplateColumns = gridColumns;
        elementsToRender.forEach(elemento => {
            if (!elemento) return;
            if (elemento.type === 'custom_matrix') {
                contentDiv.appendChild(createMatrixBuilderUI(elemento));
            } else if (elemento.latex) {
                const button = document.createElement('button');
                button.className = 'toolbar-btn';
                
                // ===== MODIFICATION START =====
                // 1. Translate the LaTeX content using the _() function, using display as primary and latex as fallback.
                const translatedLatex = _(elemento.display || elemento.latex);
                
                // 2. Use the translated version for the data-latex attribute (what gets inserted).
                button.dataset.latex = translatedLatex;
                
                // 3. Use the translated version for the button's visible content.
                button.innerHTML = `\\(${translatedLatex}\\)`;
                // ===== MODIFICATION END =====
                
                // The title is still translated independently.
                button.title = _(elemento.title);
                
                contentDiv.appendChild(button);
            }
        });
        if (tabId === 'recientes' && recentSymbols.length > 0) {
             const clearBtnContainer = document.createElement('div');
             clearBtnContainer.id = 'clear-recents-btn-container';
             clearBtnContainer.style.gridColumn = '1 / -1';
             clearBtnContainer.innerHTML = `<button id="clear-recents-btn" class="btn btn-sm btn-danger">${_('Clear recent')}</button>`;
             clearBtnContainer.firstElementChild.onclick = clearRecents;
             contentDiv.appendChild(clearBtnContainer);
        }
        MathJax.typesetPromise(contentDiv.querySelectorAll('.toolbar-btn'));
    }

    function handleTabSwitch(event) {
        const button = event.target.closest('.tab-btn');
        if (!button) return;
        tabsContainer.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        toolbar.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        button.classList.add('active');
        const tabId = button.dataset.tab;
        document.getElementById(`tab-${tabId}`).classList.add('active');
        renderTabContent(tabId, getAllCategories());
    }
    
    // --- INITIALIZATION ---
    
    const initializeApp = async () => {
        loadRecents();
        loadedMenus.clear();
        menuCache.clear();
        let manifestMenus = [];
        try {
            const manifestResponse = await fetch(MANIFEST_URL);
            if (!manifestResponse.ok) throw new Error(_('Could not load') + ' menus.json');
            const manifest = await manifestResponse.json();
            manifestMenus = manifest.menus.filter(Boolean);
        } catch (e) {
            console.error('Error loading menus.json:', e);
            showAlert('Error', `Could not load <code>menus.json</code>.`);
        }
        const BASE_NAME = 'base.json';
        if (manifestMenus.find(m => m.file === BASE_NAME)) {
            const data = await fetchMenuData(`./menus/${BASE_NAME}`);
            if (data) loadedMenus.set(BASE_NAME, { id: BASE_NAME, url: `./${BASE_NAME}`, source: 'default', name: 'Base', data });
        }
        const previouslyAdded = loadAddedMenusFromStorage();
        for (const menuInfo of previouslyAdded) {
            if (menuInfo.id === BASE_NAME && loadedMenus.has(BASE_NAME)) continue;
            const data = await fetchMenuData(menuInfo.url);
            if (data) loadedMenus.set(menuInfo.id, { ...menuInfo, data });
        }
        window.__manifestMenus = manifestMenus;
        rebuildToolbarAndUI();
        updatePreview();
        addFooter();
    };

    // --- EVENT LISTENERS ---
    latexInput.addEventListener('input', updatePreview);
    toolbar.addEventListener('click', (event) => { const btn = event.target.closest('.toolbar-btn'); if (btn && btn.dataset.latex) insertAtCursor(btn.dataset.latex); });
    tabsContainer.addEventListener('click', handleTabSwitch);
    clearSearchBtn.addEventListener('click', () => { searchInput.value = ''; searchInput.dispatchEvent(new Event('input', { bubbles: true })); searchInput.focus(); });
    copyButton.addEventListener('click', () => {
        const rawLatex = latexInput.value.trim();
        if (!rawLatex) return;
        let textToCopy;
        switch (delimiterSelector.value) {
            case 'parentheses': textToCopy = `\\(${rawLatex}\\)`; break;
            case 'brackets': textToCopy = `\\[\n${rawLatex}\n\\]`; break;
            case 'double_dollar': textToCopy = `$$\n${rawLatex}\n$$`; break;
            case 'single_dollar': textToCopy = `$${rawLatex}$`; break;
            default: textToCopy = rawLatex;
        }
        navigator.clipboard.writeText(textToCopy);
        copyCodeFeedback.textContent = _('Code copied!');
        copyCodeFeedback.style.opacity = '1';
        setTimeout(() => { copyCodeFeedback.style.opacity = '0'; }, 2000);
    });
    clearButton.addEventListener('click', () => { latexInput.value = ''; latexInput.focus(); updatePreview(); });
    insertButton.addEventListener('click', () => {
        const rawLatex = latexInput.value.trim();
        if (!rawLatex) return;
        let latexToInsert;
        switch (delimiterSelector.value) {
            case 'parentheses': latexToInsert = `\\(${rawLatex}\\)`; break;
            case 'brackets': latexToInsert = `\\[${rawLatex}\\]`; break;
            default: latexToInsert = rawLatex;
        }
        try {
            // --- eXeLearning Integration (Legacy) ---
            const tinymceRef = parent && parent.tinymce ? parent.tinymce : null;
            if (isInExe && tinymceRef && tinymceRef.activeEditor) {
                tinymceRef.activeEditor.execCommand('mceReplaceContent', false, latexToInsert);
                tinymceRef.activeEditor.windowManager?.close();
                return; // Success, exit
            }
        } catch (err) {
            console.warn('Could not use TinyMCE integration:', err);
        }

        // --- Generic Integration using postMessage (for other apps) ---
        if (window.opener) {
            // The '*' means we don't restrict the target origin.
            // For higher security, this could be replaced with the specific URL
            // of the application that is allowed to open the editor.
            window.opener.postMessage(latexToInsert, '*');
        }
        window.close();
    });
    viewImageButton.addEventListener('click', handleViewImage);
    menuTogglerBtn.addEventListener('click', function(){
        const tabs = document.getElementById('tabs-container');
        const toolbars = document.getElementById('toolbar-wrapper');
        if (!tabs || !toolbars) return;
        if (tabs.style.display == 'none') {
            tabs.style.display = 'block';
            toolbars.style.display = 'block';
        } else {
            tabs.style.display = 'none';
            toolbars.style.display = 'none';
        }
    });
    settingsBtn.addEventListener('click', () => settingsModal.classList.add('active'));
    closeSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('active'));
    
    // --- NEW EVENT LISTENER FOR URL BUTTON ---
    loadUrlBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) {
            showModalFeedback(_('Please enter a URL.'), true);
            return;
        }
        // Use the URL as ID and derive a name from the filename
        const menuName = url.substring(url.lastIndexOf('/') + 1) || 'menu.json';
        const menuInfo = {
            id: url, // The URL is a unique identifier
            url: url,
            source: 'url',
            name: menuName
        };
        
        // addMenu handles UI reload and localStorage saving
        await addMenu(menuInfo); 
        showModalFeedback(_('Menu loaded successfully.'), false);
        urlInput.value = ''; // Clear the input after loading
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length === 0) return;
        const [file] = fileInput.files;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                loadedMenus.set(file.name, { id: file.name, url: file.name, source: 'localfile', name: file.name, data: parsed });
                rebuildToolbarAndUI();
                showModalFeedback(_('Menu loaded successfully.'), false);
            } catch (err) {
                console.error(_('Error parsing local JSON:'), err);
                showModalFeedback(`${_('The file is not a valid JSON')} (${err.message})`, true);
            }
        };
        reader.readAsText(file, 'utf-8');
        fileInput.value = '';
    });
    availableMenusList.addEventListener('change', (e) => { if(e.target.type !== 'checkbox') return; const ds = e.target.dataset; if (e.target.checked) addMenu(ds); else removeMenu(ds.id); });
    clearCacheBtn.addEventListener('click', () => location.reload(true));
    alertModalCloseBtn.addEventListener('click', hideAlert);
    askAiBtn.addEventListener('click', () => aiModal.classList.add('active'));
    closeAiModalBtn.addEventListener('click', () => aiModal.classList.remove('active'));
    generateAiPromptBtn.addEventListener('click', generateAiPrompt);
    copyAiPromptBtn.addEventListener('click', copyAiPrompt);
    maximizeBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => console.log(err));
            maximizeBtn.textContent = '🗗';
        } else {
            document.exitFullscreen();
            maximizeBtn.textContent = '🗖';
        }
    });

    // Start the application
    initializeApp();
}

// Expose initializeLatexEditor to the global window object so MathJax can call it.
window.initializeLatexEditor = initializeLatexEditor;