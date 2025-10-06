const MANIFEST_URL = './menus.json';
const DEFAULT_BASE_URL = './base.json';

let tabs = [];
let activeTabId = null;

// --- DOM Elements ---
const ui = {
    editorContainer: document.getElementById('editor-container'),
    previewContainer: document.getElementById('preview-container'),
    copyBtn: document.getElementById('copy-btn'),
    pasteBtn: document.getElementById('paste-btn'),
    exportBtn: document.getElementById('export-btn'),
    categoryNavigator: document.getElementById('category-navigator'),
    toggleAllBtn: document.getElementById('toggle-all-btn'),
    aiCreatorBtn: document.getElementById('ai-creator-btn'),
    tabsContainer: document.getElementById('tabs-container'),
    addTabBtn: document.getElementById('add-tab-btn'),
    // Modals
    modal: document.getElementById('modal'),
    modalTitle: document.getElementById('modal-title'),
    modalForm: document.getElementById('modal-form'),
    modalCancel: document.getElementById('modal-cancel'),
    modalSave: document.getElementById('modal-save'),
    confirmModal: document.getElementById('confirm-modal'),
    confirmTitle: document.getElementById('confirm-title'),
    confirmMessage: document.getElementById('confirm-message'),
    confirmCancel: document.getElementById('confirm-cancel'),
    confirmDelete: document.getElementById('confirm-delete'),
    pasteModal: document.getElementById('paste-modal'),
    pasteTextArea: document.getElementById('paste-textarea'),
    pasteType: document.getElementById('paste-type'),
    pasteCategorySelectorDiv: document.getElementById('paste-category-selector-div'),
    pasteCategorySelector: document.getElementById('paste-category-selector'),
    pasteCancel: document.getElementById('paste-cancel'),
    pasteAdd: document.getElementById('paste-add'),
    aiCreatorModal: document.getElementById('ai-creator-modal'),
    aiCreatorCloseBtn: document.getElementById('ai-creator-close-btn'),
    aiChoice: document.getElementById('ai-choice'),
    aiInputsContainer: document.getElementById('ai-inputs-container'),
    aiPromptOutput: document.getElementById('ai-prompt-output'),
    aiGeneratePromptBtn: document.getElementById('ai-generate-prompt-btn'),
    aiCopyPromptBtn: document.getElementById('ai-copy-prompt-btn'),
    aiLaunchChatGptBtn: document.getElementById('ai-launch-chatgpt-btn'),
    addTabModal: document.getElementById('add-tab-modal'),
    addTabCloseBtn: document.getElementById('add-tab-close-btn'),
    githubFilesList: document.getElementById('github-files-list'),
    clearCacheBtn: document.getElementById('clear-cache-btn'),
    customUrlInput: document.getElementById('custom-url-input'),
    customUrlLoadBtn: document.getElementById('custom-url-load-btn'),
    customFileInput: document.getElementById('custom-file-input'),
};

// --- Core Functions ---
function getActiveTabData() {
    if (!activeTabId) return null;
    return tabs.find(t => t.id === activeTabId);
}

function setActiveTabData(newData) {
    const tabIndex = tabs.findIndex(t => t.id === activeTabId);
    if (tabIndex !== -1) {
        tabs[tabIndex].data = newData;
    }
}

function render() {
    const activeTab = getActiveTabData();
    const currentData = activeTab ? activeTab.data : { categorias: [] };
    renderEditor(currentData);
    renderPreview(currentData);
    renderCategoryNavigator(currentData);
    initDragAndDrop();
    renderTabs();
    // Re-translate dynamic UI parts
    translateUIDynamic();
}

function translateUIDynamic() {
    // Static text that might be re-rendered
    document.title = _('LaTeX Formula Visual Editor');
    ui.toggleAllBtn.textContent = _('Collapse/Expand');
    ui.categoryNavigator.querySelector('option[value=""]').textContent = _('Go to category...');
    document.querySelector('h1.text-2xl').textContent = _('LaTeX Formula Editor');
    ui.aiCreatorBtn.innerHTML = `✨ ${_('Create with AI')}`;
    ui.pasteBtn.textContent = _('Paste');
    ui.copyBtn.textContent = _('Copy JSON');
    ui.exportBtn.textContent = _('Export JSON');
    ui.modalCancel.textContent = _('Cancel');
    ui.modalSave.textContent = _('Save');
    ui.confirmCancel.textContent = _('Cancel');
    ui.confirmDelete.textContent = _('Delete');
    ui.pasteModal.querySelector('h2').textContent = _('Paste JSON content');
    ui.pasteTextArea.placeholder = _('Paste the JSON code here...');
    ui.pasteModal.querySelector('label').textContent = _('Type of content to paste:');
    ui.pasteType.options[0].textContent = _('Full JSON (in new tab)');
    ui.pasteType.options[1].textContent = _('Category (in current tab)');
    ui.pasteType.options[2].textContent = _('Element(s) (in current tab)');
    ui.pasteCategorySelectorDiv.querySelector('label').textContent = _('Add element(s) to category:');
    ui.pasteCancel.textContent = _('Cancel');
    ui.pasteAdd.textContent = _('Add Content');
    ui.aiCreatorModal.querySelector('h2').textContent = _('AI Creation Wizard');
    ui.aiCreatorModal.querySelector('label[for="ai-choice"]').textContent = _('1. What do you want to create?');
    ui.aiChoice.options[0].textContent = _('Full JSON file');
    ui.aiChoice.options[1].textContent = _('A single category');
    ui.aiChoice.options[2].textContent = _('Multiple elements');
    ui.aiCreatorModal.querySelector('h3:first-of-type').textContent = _('2. Generate and use the prompt');
    ui.aiCreatorModal.querySelector('p:first-of-type').textContent = _('Follow the steps to generate a prompt and get the JSON code from your preferred AI.');
    ui.aiPromptOutput.placeholder = _('The generated prompt will appear here...');
    ui.aiGeneratePromptBtn.textContent = _('1. Generate Prompt');
    ui.aiLaunchChatGptBtn.textContent = _('2. Launch in ChatGPT');
    ui.aiCopyPromptBtn.textContent = _('2a. Copy (other AI)');
    ui.aiCreatorModal.querySelector('h3:last-of-type').textContent = _('3. Paste the result into the editor');
    document.getElementById('ai-paste-instructions').innerHTML = `${_('Once you have the code, close this window and use the')} <strong class="text-yellow-600">"${_('Paste')}"</strong> ${_('button on the top bar to add your new creation.')}`;
    ui.aiCreatorCloseBtn.textContent = _('Close');
    ui.addTabModal.querySelector('h2').textContent = _('Add formula set');
    ui.clearCacheBtn.textContent = _('Clear cache');
    ui.addTabModal.querySelectorAll('h3')[0].textContent = _('Available menus');
    ui.githubFilesList.textContent = _('Loading list...');
    ui.addTabModal.querySelectorAll('h3')[1].textContent = _('Other sources');
    ui.customUrlInput.placeholder = _('Paste a JSON URL...');
    ui.customUrlLoadBtn.textContent = _('Load');
    ui.addTabModal.querySelector('label[for="custom-file-input"]').textContent = _('Open local file...');
    ui.addTabCloseBtn.textContent = _('Close');
}

// --- Render UI ---
function renderEditor(currentData) {
    ui.editorContainer.innerHTML = '';
    if (!currentData || !currentData.categorias || currentData.categorias.length === 0) {
        ui.editorContainer.innerHTML = `<p class="text-gray-500 text-center">${_('Add or load a formula set.')}</p>`;
        return;
    }
    currentData.categorias.forEach((cat, catIndex) => {
        const isCollapsed = cat.isCollapsed || false;
        const categoryDiv = document.createElement('div');
        categoryDiv.className = `category-item mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50 ${isCollapsed ? 'collapsed' : ''}`;
        categoryDiv.dataset.catId = catIndex;
        const header = document.createElement('div');
        header.className = 'flex justify-between items-center mb-3 pb-2 border-b';
        header.innerHTML = `<div class="flex items-center"><span class="drag-handle cat-drag-handle">&#9776;</span><span class="toggle-collapse-btn text-gray-500 hover:text-gray-800" data-cat-index="${catIndex}"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></span><h3 class="text-xl font-semibold text-gray-700 ml-1">${cat.nombre} (${cat.elementos ? cat.elementos.length : 0})</h3></div><div class="space-x-2"><button data-cat-index="${catIndex}" class="edit-cat-btn text-blue-500 hover:text-blue-700" title="${_('Edit category')}">&#9998;</button><button data-cat-index="${catIndex}" class="delete-cat-btn text-red-500 hover:text-red-700" title="${_('Delete category')}">&#10006;</button><button data-cat-index="${catIndex}" class="add-el-btn bg-green-500 text-white text-sm px-3 py-1 rounded hover:bg-green-600" title="${_('Add element')}">+</button></div>`;
        const elementsList = document.createElement('div');
        elementsList.className = 'elements-list space-y-2 pl-8';
        if (isCollapsed) elementsList.classList.add('hidden');
        elementsList.dataset.catIndex = catIndex;
        if(cat.elementos) {
            cat.elementos.forEach((el, elIndex) => {
                const elDiv = document.createElement('div');
                elDiv.className = 'editor-item flex justify-between items-center p-2 rounded-md bg-white border border-gray-200 transition-colors duration-300';
                elDiv.dataset.editorId = `${catIndex}-${elIndex}`;
                elDiv.innerHTML = `<div class="flex items-center truncate"><span class="drag-handle el-drag-handle">&#9776;</span><div class="truncate"><strong class="text-sm font-medium">${el.title || el.type || _('Element')}</strong><p class="text-xs text-gray-500 truncate font-mono">${el.latex || ''}</p></div></div><div class="flex-shrink-0 space-x-2"><button data-cat-index="${catIndex}" data-el-index="${elIndex}" class="edit-el-btn text-blue-500 hover:text-blue-700" title="${_('Edit element')}">&#9998;</button><button data-cat-index="${catIndex}" data-el-index="${elIndex}" class="delete-el-btn text-red-500 hover:text-red-700" title="${_('Delete element')}">&#10006;</button></div>`;
                elementsList.appendChild(elDiv);
            });
        }
        categoryDiv.appendChild(header);
        categoryDiv.appendChild(elementsList);
        ui.editorContainer.appendChild(categoryDiv);
    });
    addEditorEventListeners();
}

function renderPreview(currentData) {
    ui.previewContainer.innerHTML = '';
    if (!currentData || !currentData.categorias || currentData.categorias.length === 0) {
        ui.previewContainer.innerHTML = `<p class="text-gray-500 text-center">${_('The preview will appear here.')}</p>`;
        return;
    }
    currentData.categorias.forEach((cat, catIndex) => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'mb-6 preview-category';
        categoryDiv.dataset.previewCatId = catIndex;
        categoryDiv.innerHTML = `<h3 class="text-xl font-semibold text-gray-700 mb-3">${cat.nombre} (${cat.elementos ? cat.elementos.length : 0})</h3>`;
        const gridDiv = document.createElement('div');
        gridDiv.className = 'grid gap-2';
        gridDiv.style.gridTemplateColumns = cat.grid_template_columns || 'repeat(auto-fit, minmax(80px, 1fr))';
        if(cat.elementos){
            cat.elementos.forEach((el, elIndex) => {
                if (el.type === 'custom_matrix') return;
                const button = document.createElement('button');
                button.className = 'preview-item preview-button bg-white border border-gray-300 rounded-md shadow-sm';
                button.title = el.title || '';
                button.dataset.catIndex = catIndex;
                button.dataset.elIndex = elIndex;
                const contentWrapper = document.createElement('div');
                contentWrapper.className = 'math-content-wrapper';
                contentWrapper.style.textAlign = 'center';
                const latexToRender = el.display || el.latex;
                contentWrapper.textContent = `\\(${latexToRender}\\)`;
                button.appendChild(contentWrapper);
                button.addEventListener('click', handlePreviewClick);
                button.addEventListener('dblclick', handlePreviewDblClick);
                gridDiv.appendChild(button);
            });
        }
        categoryDiv.appendChild(gridDiv);
        ui.previewContainer.appendChild(categoryDiv);
    });
    
    if (typeof MathJax !== "undefined" && MathJax.typesetPromise) {
        ui.previewContainer.classList.add('mathjax-processing');
        MathJax.typesetPromise([ui.previewContainer])
            .catch((err) => console.log('MathJax error: ' + err.message))
            .finally(() => {
                ui.previewContainer.classList.remove('mathjax-processing');
                document.querySelectorAll('.preview-item').forEach(button => {
                    const mathContainer = button.querySelector('mjx-container');
                    if (mathContainer) {
                        const buttonWidth = button.clientWidth - 16;
                        const mathWidth = mathContainer.scrollWidth;
                        mathContainer.style.transform = 'scale(1)';
                        if (mathWidth > buttonWidth) {
                            const scale = buttonWidth / mathWidth;
                            mathContainer.style.transform = `scale(${scale})`;
                            mathContainer.style.transformOrigin = 'center left';
                        }
                    }
                });
            });
    }
}

function renderCategoryNavigator(currentData) {
    ui.categoryNavigator.innerHTML = `<option value="">${_('Go to category...')}</option>`;
    if (!currentData || !currentData.categorias || currentData.categorias.length === 0) {
        ui.categoryNavigator.disabled = true;
        return;
    }
    ui.categoryNavigator.disabled = false;
    currentData.categorias.forEach((cat, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = cat.nombre;
        ui.categoryNavigator.appendChild(option);
    });
}

// --- Tabs ---
function renderTabs() {
    ui.tabsContainer.innerHTML = '';
    tabs.forEach(tab => {
        const tabEl = document.createElement('button');
        tabEl.className = `tab px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 ${tab.id === activeTabId ? 'active border-indigo-500' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`;
        const totalElements = (tab.data && tab.data.categorias) ? tab.data.categorias.reduce((sum, cat) => sum + (cat.elementos ? cat.elementos.length : 0), 0) : 0;
        tabEl.textContent = `${tab.name} (${totalElements})`;
        tabEl.dataset.tabId = tab.id;
        tabEl.addEventListener('click', () => switchTab(tab.id));
        if (tab.id !== 'base') {
            const closeBtn = document.createElement('span');
            closeBtn.className = 'tab-close-btn ml-2 text-xs font-bold';
            closeBtn.innerHTML = '&times;';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeTab(tab.id);
            });
            tabEl.appendChild(closeBtn);
        }
        ui.tabsContainer.appendChild(tabEl);
    });
}

function switchTab(tabId) {
    activeTabId = tabId;
    render();
}

async function addTab(name, url, directData = null) {
    const existingTab = tabs.find(t => t.id === name);
    if (existingTab) {
        switchTab(name);
        return;
    }

    const tabId = name;
    const newTab = { id: tabId, name: name, url: url, data: { categorias: [] } };
    tabs.push(newTab);
    switchTab(tabId);
    
    if(directData){
        newTab.data = directData;
        render();
        return;
    }
    
    try {
        const cachedData = localStorage.getItem(`formula-cache-${name}`);
        if (cachedData) {
            newTab.data = JSON.parse(cachedData);
        } else {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            const jsonData = await response.json();
            if (!jsonData.categorias) throw new Error('Invalid JSON format');
            newTab.data = jsonData;
            localStorage.setItem(`formula-cache-${name}`, JSON.stringify(jsonData));
        }
    } catch (error) {
        console.error(`Failed to load tab ${name}:`, error);
        alert(_('Could not load the file for "{name}".').replace('{name}', name));
        closeTab(tabId); // Remove tab if loading failed
    }
    render();
}

function closeTab(tabId) {
    tabs = tabs.filter(t => t.id !== tabId);
    if (activeTabId === tabId) {
        switchTab('base');
    }
    render();
}

// --- Drag and Drop (FIXED) ---
function initDragAndDrop() {
    // Sort categories
    new Sortable(ui.editorContainer, {
        animation: 150,
        handle: '.cat-drag-handle',
        ghostClass: 'sortable-ghost',
        onEnd: (evt) => {
            // Use a deep copy to ensure immutability and prevent reference bugs.
            const freshData = getActiveTabData()?.data;
            if (!freshData || !freshData.categorias) return;

            const newData = JSON.parse(JSON.stringify(freshData));
            const [item] = newData.categorias.splice(evt.oldIndex, 1);
            newData.categorias.splice(evt.newIndex, 0, item);
            
            setActiveTabData(newData);
            render();
        }
    });

    // Sort elements within each category
    document.querySelectorAll('.elements-list').forEach(list => {
        const catIndex = list.dataset.catIndex;
        new Sortable(list, {
            animation: 150,
            handle: '.el-drag-handle',
            ghostClass: 'sortable-ghost',
            onEnd: (evt) => {
                const freshData = getActiveTabData()?.data;
                if (!freshData || !freshData.categorias || !freshData.categorias[catIndex]) return;

                // Deep copy is safest for nested arrays.
                const newData = JSON.parse(JSON.stringify(freshData));
                
                const [item] = newData.categorias[catIndex].elementos.splice(evt.oldIndex, 1);
                newData.categorias[catIndex].elementos.splice(evt.newIndex, 0, item);
                
                setActiveTabData(newData);
                render();
            }
        });
    });
}

// --- Event Listeners & Handlers ---
function addEditorEventListeners() {
    document.querySelectorAll('.toggle-collapse-btn').forEach(b => b.addEventListener('click', handleToggleCollapse));
    document.querySelectorAll('.edit-cat-btn').forEach(b => b.addEventListener('click', handleEditCategory));
    document.querySelectorAll('.delete-cat-btn').forEach(b => b.addEventListener('click', handleDeleteCategory));
    document.querySelectorAll('.add-el-btn').forEach(b => b.addEventListener('click', handleAddElement));
    document.querySelectorAll('.edit-el-btn').forEach(b => b.addEventListener('click', handleEditElement));
    document.querySelectorAll('.delete-el-btn').forEach(b => b.addEventListener('click', handleDeleteElement));
    document.querySelectorAll('.editor-item').forEach(item => item.addEventListener('click', handleEditorClick));
}

function handleToggleCollapse(e) {
    const catIndex = e.currentTarget.dataset.catIndex;
    const freshData = getActiveTabData().data;
    const newData = JSON.parse(JSON.stringify(freshData));
    newData.categorias[catIndex].isCollapsed = !newData.categorias[catIndex].isCollapsed;
    setActiveTabData(newData);
    render();
}

function highlightElements(editorItem, previewItem) {
    document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
    if(editorItem) editorItem.classList.add('highlight');
    if(previewItem) previewItem.classList.add('highlight');
    setTimeout(() => { if(editorItem) editorItem.classList.remove('highlight'); if(previewItem) previewItem.classList.remove('highlight'); }, 1500);
}

function handleEditorClick(e) {
    if (e.target.closest('button, .drag-handle, .toggle-collapse-btn')) return;
    const editorItem = e.currentTarget.closest('.editor-item');
    if (!editorItem) return;
    const { editorId } = editorItem.dataset;
    const [catIndex, elIndex] = editorId.split('-');
    const previewItem = document.querySelector(`.preview-item[data-cat-index="${catIndex}"][data-el-index="${elIndex}"]`);
    if (previewItem) { previewItem.scrollIntoView({ behavior: 'smooth', block: 'center' }); highlightElements(editorItem, previewItem); }
}

function handlePreviewClick(e) {
    const { catIndex, elIndex } = e.currentTarget.dataset;
    const freshData = getActiveTabData().data;
    const category = freshData.categorias[catIndex];

    if (category.isCollapsed) {
        const newData = JSON.parse(JSON.stringify(freshData));
        newData.categorias[catIndex].isCollapsed = false;
        setActiveTabData(newData);
        render();
        setTimeout(() => {
            const editorItem = document.querySelector(`.editor-item[data-editor-id="${catIndex}-${elIndex}"]`);
             if (editorItem) {
                editorItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                highlightElements(editorItem, e.currentTarget);
            }
        }, 0);
    } else {
         const editorItem = document.querySelector(`.editor-item[data-editor-id="${catIndex}-${elIndex}"]`);
         if (editorItem) {
            editorItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            highlightElements(editorItem, e.currentTarget);
        }
    }
}

function handlePreviewDblClick(e) {
    const { catIndex, elIndex } = e.currentTarget.dataset;
    handleEditElement({ currentTarget: { dataset: { catIndex, elIndex } } });
}

// CRUD Handlers (FIXED with immutable pattern)
function handleEditCategory(e) { const { catIndex } = e.currentTarget.dataset; showCategoryModal(_('Edit Category'), getActiveTabData().data.categorias[catIndex], (formData) => { const newData = JSON.parse(JSON.stringify(getActiveTabData().data)); newData.categorias[catIndex] = {...newData.categorias[catIndex], ...formData}; setActiveTabData(newData); render(); }); }
function handleDeleteCategory(e) { const { catIndex } = e.currentTarget.dataset; showConfirmModal(`${_('Delete')} "${getActiveTabData().data.categorias[catIndex].nombre}"`, `${_('Are you sure?')}`, () => { const newData = JSON.parse(JSON.stringify(getActiveTabData().data)); newData.categorias.splice(catIndex, 1); setActiveTabData(newData); render(); }); }
function handleAddElement(e) { const { catIndex } = e.currentTarget.dataset; showElementModal(_('Add Element'), {}, (formData) => { const newData = JSON.parse(JSON.stringify(getActiveTabData().data)); if (!newData.categorias[catIndex].elementos) { newData.categorias[catIndex].elementos = []; } newData.categorias[catIndex].elementos.push({ type: "button", ...formData }); setActiveTabData(newData); render(); }); }
function handleEditElement(e) { 
    const { catIndex, elIndex } = e.currentTarget.dataset;
    showElementModal(_('Edit Element'), getActiveTabData().data.categorias[catIndex].elementos[elIndex], (formData) => {
        const newData = JSON.parse(JSON.stringify(getActiveTabData().data));
        newData.categorias[catIndex].elementos[elIndex] = {...newData.categorias[catIndex].elementos[elIndex], ...formData};
        setActiveTabData(newData);
        render();
    }, catIndex, elIndex);
}
function handleDeleteElement(e) { const { catIndex, elIndex } = e.currentTarget.dataset; const el = getActiveTabData().data.categorias[catIndex].elementos[elIndex]; showConfirmModal(`${_('Delete')} "${el.title || el.latex}"`, `${_('Are you sure?')}`, () => { const newData = JSON.parse(JSON.stringify(getActiveTabData().data)); newData.categorias[catIndex].elementos.splice(elIndex, 1); setActiveTabData(newData); render(); }); }

// Other Event Listeners
ui.addTabBtn.addEventListener('click', async () => {
    ui.githubFilesList.innerHTML = _('Loading list...');
    ui.addTabModal.classList.remove('hidden');
    try {
        const response = await fetch(MANIFEST_URL);
        const filesData = await response.json();
        let files = Array.isArray(filesData) ? filesData : [];
        if (!Array.isArray(filesData) && filesData.menus) {
            files = filesData.menus.map(item =>
                (typeof item === 'string') ?
                {name: item, download_url: './' + item} :
                {name: item.file, download_url: './' + item.file}
            );
        }
        if (!files || files.length === 0) {
            ui.githubFilesList.innerHTML = `<p class="text-red-500">${_('Could not retrieve menus.')}</p>`;
            return;
        }
        const jsonFiles = files.filter(file => file.name.endsWith('.json'));
        ui.githubFilesList.innerHTML = '';
        if (jsonFiles.length === 0) {
             ui.githubFilesList.innerHTML = `<p>${_("No .json files found in the 'docs' folder.")}</p>`;
        }
        jsonFiles.forEach(file => {
            const fileEl = document.createElement('button');
            fileEl.className = 'w-full text-left p-2 rounded hover:bg-gray-100';
            fileEl.textContent = file.name;
            fileEl.addEventListener('click', () => {
                addTab(file.name, file.download_url);
                ui.addTabModal.classList.add('hidden');
            });
            ui.githubFilesList.appendChild(fileEl);
        });
    } catch (error) {
        console.error("Error fetching GitHub files:", error);
        ui.githubFilesList.innerHTML = `<p class="text-red-500">${_('Error loading the list.')}</p>`;
    }
});
ui.addTabCloseBtn.addEventListener('click', () => ui.addTabModal.classList.add('hidden'));
ui.clearCacheBtn.addEventListener('click', async () => {
    // Clear localStorage and sessionStorage
    localStorage.clear();
    sessionStorage.clear();
    // Clear Cache Storage
    if (window.caches && caches.keys) {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
            await caches.delete(name);
        }
    }
    // Clear cookies
    document.cookie.split(";").forEach((cookie) => {
        const name = cookie.split("=")[0].trim();
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    });
    alert(_('All browser data has been cleared.'));
});
ui.customUrlLoadBtn.addEventListener('click', () => {
    const url = ui.customUrlInput.value.trim();
    if (url) {
        const name = url.substring(url.lastIndexOf('/') + 1) || _('Custom URL');
        addTab(name, url);
        ui.addTabModal.classList.add('hidden');
    } else {
        alert(_("Please enter a valid URL."));
    }
});
ui.customFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const loadedData = JSON.parse(event.target.result);
            if (loadedData.categorias && Array.isArray(loadedData.categorias)) {
                addTab(file.name, null, loadedData);
                ui.addTabModal.classList.add('hidden');
            } else {
                alert(_("The JSON file does not have the expected format."));
            }
        } catch (error) {
            alert(_("Error processing the JSON file."));
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset for same-file uploads
});


ui.categoryNavigator.addEventListener('change', (e) => {
    const catIndex = e.target.value;
    if (catIndex === "") return;

    const editorCategoryDiv = ui.editorContainer.querySelector(`[data-cat-id='${catIndex}']`);
    const previewCategoryDiv = ui.previewContainer.querySelector(`[data-preview-cat-id='${catIndex}']`);

    if (editorCategoryDiv) {
        editorCategoryDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        editorCategoryDiv.classList.add('highlight');
        setTimeout(() => editorCategoryDiv.classList.remove('highlight'), 1500);
    }
    if (previewCategoryDiv) {
        previewCategoryDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        previewCategoryDiv.classList.add('highlight');
        setTimeout(() => previewCategoryDiv.classList.remove('highlight'), 1500);
    }
    e.target.value = ""; // Reset dropdown
});

ui.toggleAllBtn.addEventListener('click', () => {
    const freshData = getActiveTabData().data;
    if (!freshData.categorias || freshData.categorias.length === 0) return;

    const newData = JSON.parse(JSON.stringify(freshData));
    const shouldCollapse = newData.categorias.some(cat => !cat.isCollapsed);
    newData.categorias.forEach(cat => cat.isCollapsed = shouldCollapse);
    setActiveTabData(newData);
    render();
});

ui.copyBtn.addEventListener('click', () => {
    const currentData = getActiveTabData().data;
    if (currentData.categorias.length === 0) { alert(_("There is nothing to copy.")); return; }
    const jsonString = JSON.stringify(currentData, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
        const originalText = ui.copyBtn.textContent;
        ui.copyBtn.textContent = _('Copied!');
        ui.copyBtn.classList.replace('bg-teal-500', 'bg-green-600');
        setTimeout(() => { ui.copyBtn.textContent = originalText; ui.copyBtn.classList.replace('bg-green-600', 'bg-teal-500'); }, 2000);
    }).catch(err => console.error('Error al copiar: ', err));
});

ui.exportBtn.addEventListener('click', () => {
    const currentData = getActiveTabData().data;
    if (currentData.categorias.length === 0) { alert(_("There is nothing to export.")); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(currentData, null, 2)], { type: 'application/json' }));
    a.download = `${activeTabId.replace('.json', '') || 'formulas'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
});

// --- Paste Logic ---
ui.pasteBtn.addEventListener('click', () => {
    const currentData = getActiveTabData()?.data;
    ui.pasteTextArea.value = '';
    ui.pasteCategorySelector.innerHTML = '';
    if (currentData && currentData.categorias) {
        currentData.categorias.forEach((cat, index) => { const option = document.createElement('option'); option.value = index; option.textContent = cat.nombre; ui.pasteCategorySelector.appendChild(option); });
    }
    ui.pasteType.value = 'full';
    ui.pasteCategorySelectorDiv.classList.add('hidden');
    ui.pasteModal.classList.remove('hidden');
});

ui.pasteType.addEventListener('change', (e) => { 
    const isElement = e.target.value === 'element';
    ui.pasteCategorySelectorDiv.classList.toggle('hidden', !isElement);
});

ui.pasteCancel.addEventListener('click', () => ui.pasteModal.classList.add('hidden'));

ui.pasteAdd.addEventListener('click', () => {
    const jsonText = ui.pasteTextArea.value.trim();
    if (!jsonText) { alert(_("The text area is empty.")); return; }
    
    try {
        const type = ui.pasteType.value;
        if (type === 'full') {
            const pastedData = JSON.parse(jsonText);
            if (pastedData.categorias && Array.isArray(pastedData.categorias)) {
                addTab(`${_('Pasted')}-${Date.now().toString().slice(-5)}`, null, pastedData);
            } else { throw new Error(_("Invalid full JSON.")); }
        } else {
            // For category and element, we modify the current tab's data
            const newData = JSON.parse(JSON.stringify(getActiveTabData().data));
            if (type === 'category') {
                const pastedData = JSON.parse(jsonText);
                if (pastedData.nombre && pastedData.elementos) {
                    newData.categorias.push(pastedData);
                } else { throw new Error(_("Invalid category JSON.")); }
            } else if (type === 'element') {
                const catIndex = ui.pasteCategorySelector.value;
                if (catIndex === '') { alert(_("Select a category.")); return; }
                
                let itemsToPaste = [];
                try {
                    itemsToPaste = JSON.parse(`[${jsonText}]`);
                } catch (e) {
                    throw new Error(_("The format of the element or list of elements is invalid. Make sure they are valid JSON objects separated by commas."));
                }

                const validItems = itemsToPaste.filter(item => item.type && item.latex);
                if (validItems.length > 0) {
                    if(!newData.categorias[catIndex].elementos) {
                       newData.categorias[catIndex].elementos = [];
                    }
                    newData.categorias[catIndex].elementos.push(...validItems);
                } else {
                    throw new Error(_("No valid elements found in the pasted text."));
                }
            }
            setActiveTabData(newData);
            render();
        }
        ui.pasteModal.classList.add('hidden');
    } catch (error) {
        alert(`${_("Error processing JSON: ")}${error.message}`);
    }
});

// --- AI Creator Modal Logic (UPDATED) ---
const PROMPTS = {
    full_json: `Act as an expert in creating structured JSON data for web applications. Your task is to generate a COMPLETE JSON FILE containing a list of categories of LaTeX commands on a specific topic.\n\n**JSON File Structure:**\nThe file must start with \`{"categorias": [ ... ]}\` and contain an array of category objects.\n\n**Structure of each Category:**\n\`\`\`json\n{\n  "nombre": "string",  // The visible name of the category (e.g., "Vectors").\n  "id": "string",        // A unique lowercase identifier (e.g., "vectors").\n  "grid_template_columns": "string", // CSS value for the grid. Use a minmax value appropriate for the width of the formulas. For wide formulas like integrals or statistics, use "repeat(auto-fit, minmax(180px, 1fr))". For Greek letters, "repeat(auto-fit, minmax(50px, 1fr))" is sufficient.\n  "isCollapsed": false, // Always 'false' to appear expanded.\n  "elementos": [       // List of buttons in the category.\n    {\n      "type": "button",          // Always "button".\n      "latex": "string",         // The actual LaTeX code to be inserted (e.g., "\\\\vec{}").\n      "display": "string",       // LaTeX code to display on the button, must be a valid example (e.g., "\\\\vec{a}"). If omitted, "latex" is used.\n      "title": "string"          // A short text describing the formula (e.g., "Vector").\n    }\n  ]\n}\n\`\`\`\n\n**VITAL RULE:** Inside the JSON, every backslash \`\\\` from the original LaTeX code must be represented as a DOUBLE BACKSLASH \`\\\\\`. For example, if the command is \`\\frac\`, in the JSON it must be written as \`"latex": "\\\\frac{}{}"\`. NEVER use FOUR backslashes.\n\n**Instructions:**\n1. Based on the general topic and additional instructions, create a coherent structure of categories and elements.\n2. Generate the complete JSON, starting with \`{"categorias": [ ... ]}\`.\n3. Your response must be only the JSON code block, without adding any explanation or additional text.\n\n**General Topic:**\n{THEME}\n\n**Additional Instructions for the AI (optional):**\n{INSTRUCTIONS}`,
    category: `Act as an expert in creating structured JSON data for web applications. Your task is to generate a single JSON object that represents a category of LaTeX commands.\n\n**JSON Structure and fields (explanation):**\n\`\`\`json\n{\n  "nombre": "string",  // The visible name of the category (e.g., "Vectors").\n  "id": "string",        // A unique lowercase identifier (e.g., "vectors").\n  "grid_template_columns": "string", // CSS value for the grid. Use a minmax value appropriate for the width of the formulas. For wide formulas like integrals or statistics, use "repeat(auto-fit, minmax(180px, 1fr))". For Greek letters, "repeat(auto-fit, minmax(50px, 1fr))" is sufficient.\n  "isCollapsed": false, // Always 'false' to appear expanded.\n  "elementos": [       // List of buttons in the category.\n    {\n      "type": "button",          // Always "button".\n      "latex": "string",         // The actual LaTeX code to be inserted (e.g., "\\\\vec{}").\n      "display": "string",       // LaTeX code to display on the button, must be a valid example (e.g., "\\\\vec{a}"). If omitted, "latex" is used.\n      "title": "string"          // A short text describing the formula (e.g., "Vector").\n    }\n  ]\n}\n\`\`\`\n\n**VITAL RULE:** Inside the JSON, every backslash \`\\\` from the original LaTeX code must be represented as a DOUBLE BACKSLASH \`\\\\\`. For example, if the command is \`\\frac\`, in the JSON it must be written as \`"latex": "\\\\frac{}{}"\`. NEVER use FOUR backslashes.\n\n**Instructions:**\n1. Based on the topic I provide below and any additional instructions, create a list of relevant LaTeX commands.\n2. Generate a single JSON object that follows the structure and rules above.\n3. Your response must be only the JSON code block, without adding any explanation or additional text.\n\n**Category Topic:**\n{THEME}\n\n**Additional Instructions for the AI (optional):**\n{INSTRUCTIONS}`,
    multiple_elements: `Act as an expert in creating structured JSON data for web applications. Your task is to generate a list of JSON objects that represent LaTeX commands for buttons.\n\n**JSON Structure and fields (explanation):**\n\`\`\`json\n{\n  "type": "button",          // Always "button".\n  "latex": "string",         // The actual LaTeX code to be inserted (e.g., "\\\\vec{}").\n  "display": "string",       // LaTeX code to display on the button, must be a valid example (e.g., "\\\\vec{a}"). If omitted, "latex" is used.\n  "title": "string"          // A short text describing the formula (e.g., "Vector").\n}\n\`\`\`\n\n**VITAL RULE:** Inside the JSON, every backslash \`\\\` from the original LaTeX code must be represented as a DOUBLE BACKSLASH \`\\\\\`. For example, if the command is \`\\frac\`, in the JSON it must be written as \`"latex": "\\\\frac{}{}"\`. NEVER use FOUR backslashes.\n\n**Instructions:**\n1. Based on the topic I provide and any additional instructions, create a list of relevant LaTeX command JSON objects.\n2. The objects must be separated by commas.\n3. Your response must be only the list of JSON objects, without wrapping it in an array \`[]\` and without any additional text.\n\n**Topic of the elements:**\n{THEME}\n\n**Additional Instructions for the AI (optional):**\n{INSTRUCTIONS}`
};

function resetAiModal() { ui.aiPromptOutput.value = ''; ui.aiLaunchChatGptBtn.disabled = true; ui.aiCopyPromptBtn.disabled = true; }

ui.aiCreatorBtn.addEventListener('click', () => { renderAiCreatorInputs('full_json'); resetAiModal(); ui.aiCreatorModal.classList.remove('hidden'); });

ui.aiCreatorCloseBtn.addEventListener('click', () => ui.aiCreatorModal.classList.add('hidden'));

ui.aiChoice.addEventListener('change', (e) => { renderAiCreatorInputs(e.target.value); resetAiModal(); });

function renderAiCreatorInputs(choice) {
    let html = '';
    const instructionsHTML = `<div><label for="ai-instructions" class="block text-sm font-medium text-gray-700 mt-2">${_('Additional instructions for the AI (optional):')}</label><textarea id="ai-instructions" rows="3" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="${_('E.g.: Create 3 categories with 5 formulas each. Or create 8 elements about...')}"></textarea></div>`;
    
    switch(choice) {
        case 'full_json':
            html = `<div><label for="ai-theme" class="block text-sm font-medium text-gray-700 mt-2">${_('General topic:')}</label><input type="text" id="ai-theme" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="${_('E.g.: Statistics, Linear Algebra...')}"></div>`;
            break;
        case 'category':
            html = `<div><label for="ai-theme" class="block text-sm font-medium text-gray-700 mt-2">${_('Category topic:')}</label><input type="text" id="ai-theme" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="${_('E.g.: Vectors, Organic Chemistry...')}"></div>`;
            break;
        case 'multiple_elements':
            html = `<div><label for="ai-theme" class="block text-sm font-medium text-gray-700 mt-2">${_('Topic of the elements:')}</label><input type="text" id="ai-theme" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="${_('E.g.: Trigonometric identities')}"></div>`;
            break;
    }
    ui.aiInputsContainer.innerHTML = html + instructionsHTML;
}

function generatePromptText() {
    let prompt = '';
    const choice = ui.aiChoice.value;
    const instructions = document.getElementById('ai-instructions').value.trim();
    const defaultInstructions = _('None.');
    let theme = '';

    switch(choice) {
        case 'full_json':
        case 'category':
        case 'multiple_elements':
            theme = document.getElementById('ai-theme').value.trim();
            if (!theme) { alert(_("Please enter a topic.")); return null; }
            prompt = PROMPTS[choice]
                .replace('{THEME}', theme)
                .replace('{INSTRUCTIONS}', instructions || defaultInstructions);
            break;
    }
    return prompt;
}

ui.aiGeneratePromptBtn.addEventListener('click', () => { const promptText = generatePromptText(); if (promptText) { ui.aiPromptOutput.value = promptText; ui.aiLaunchChatGptBtn.disabled = false; ui.aiCopyPromptBtn.disabled = false; } });
ui.aiCopyPromptBtn.addEventListener('click', () => { const promptText = ui.aiPromptOutput.value; if (!promptText) { return; } navigator.clipboard.writeText(promptText).then(() => { const originalText = ui.aiCopyPromptBtn.textContent; const originalClasses = [...ui.aiCopyPromptBtn.classList]; ui.aiCopyPromptBtn.textContent = _("Copied!"); ui.aiCopyPromptBtn.classList.remove('bg-gray-500', 'hover:bg-gray-600'); ui.aiCopyPromptBtn.classList.add('bg-green-600'); setTimeout(() => { ui.aiCopyPromptBtn.textContent = originalText; ui.aiCopyPromptBtn.className = ''; originalClasses.forEach(c => ui.aiCopyPromptBtn.classList.add(c)); }, 2000); }).catch(err => { console.error('Error copying: ', err); alert(_("Could not copy the prompt.")); }); });
ui.aiLaunchChatGptBtn.addEventListener('click', () => { const promptText = ui.aiPromptOutput.value; if (!promptText) { return; } const chatGptUrl = `https://chatgpt.com/?q=${encodeURIComponent(promptText)}`; window.open(chatGptUrl, '_blank'); });

// --- Modals Generic Handlers ---
let onSaveCallback = null;
function showCategoryModal(title, categoryData = {}, onSave) { ui.modalTitle.textContent = title; ui.modalForm.innerHTML = `<div class="space-y-4"><div><label for="cat-nombre" class="block text-sm font-medium text-gray-700">${_('Name')}</label><input type="text" id="cat-nombre" value="${categoryData.nombre || ''}" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required></div><div><label for="cat-grid" class="block text-sm font-medium text-gray-700">${_('CSS Grid Template')}</label><input type="text" id="cat-grid" value="${categoryData.grid_template_columns || 'repeat(auto-fit, minmax(80px, 1fr))'}" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required></div></div>`; onSaveCallback = () => { const formData = { nombre: document.getElementById('cat-nombre').value, grid_template_columns: document.getElementById('cat-grid').value }; if (!formData.nombre) { alert(_('The name is required.')); return; } onSave(formData); hideModal(); }; ui.modal.classList.remove('hidden'); }

function showElementModal(title, elementData = {}, onSave, catIndex, elIndex) {
    ui.modalTitle.textContent = title;
    ui.modalForm.innerHTML = `<div class="space-y-4"><div><label for="el-title" class="block text-sm font-medium">${_('Title')}</label><input type="text" id="el-title" value="${elementData.title || ''}" class="mt-1 block w-full px-3 py-2 border rounded-md" required></div><div><label for="el-latex" class="block text-sm font-medium">${_('LaTeX (insert)')}</label><textarea id="el-latex" rows="3" class="mt-1 block w-full px-3 py-2 border rounded-md font-mono" required>${elementData.latex || ''}</textarea></div><div><label for="el-display" class="block text-sm font-medium">${_('LaTeX (display)')}</label><textarea id="el-display" rows="3" class="mt-1 block w-full px-3 py-2 border rounded-md font-mono">${elementData.display || ''}</textarea><p class="text-xs text-gray-500 mt-1">${_('Optional. If left blank, the insert LaTeX will be used.')}</p></div></div>`;
    
    if (catIndex !== undefined && elIndex !== undefined) {
        const moveContainer = document.createElement('div');
        moveContainer.className = 'mt-6 pt-4 border-t border-gray-200 space-y-2';
        moveContainer.innerHTML = `<label for="move-el-category" class="block text-sm font-medium text-gray-700">${_('Move to another category')}</label>`;

        const moveControls = document.createElement('div');
        moveControls.className = 'flex items-center space-x-2';

        const selectEl = document.createElement('select');
        selectEl.id = 'move-el-category';
        selectEl.className = 'block w-full rounded-md border-gray-300 shadow-sm';
        getActiveTabData().data.categorias.forEach((cat, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = cat.nombre;
            if (index === parseInt(catIndex)) {
                option.selected = true;
            }
            selectEl.appendChild(option);
        });

        const moveBtn = document.createElement('button');
        moveBtn.type = 'button';
        moveBtn.textContent = _('Move');
        moveBtn.className = 'bg-orange-500 text-white px-3 py-2 rounded-lg shadow-sm hover:bg-orange-600 transition text-sm';

        moveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const newCatIndex = parseInt(selectEl.value, 10);
            if (newCatIndex !== parseInt(catIndex, 10)) {
                const newData = JSON.parse(JSON.stringify(getActiveTabData().data));
                const [elementToMove] = newData.categorias[catIndex].elementos.splice(elIndex, 1);
                newData.categorias[newCatIndex].elementos.push(elementToMove);
                setActiveTabData(newData);
                hideModal();
                render();
            } else {
                alert(_("It is already in this category."));
            }
        });

        moveControls.appendChild(selectEl);
        moveControls.appendChild(moveBtn);
        moveContainer.appendChild(moveControls);
        ui.modalForm.appendChild(moveContainer);
    }

    onSaveCallback = () => {
        const formData = { title: document.getElementById('el-title').value, latex: document.getElementById('el-latex').value, display: document.getElementById('el-display').value };
        if (!formData.title || !formData.latex) { alert(_('Title and LaTeX are required.')); return; }
        onSave(formData);
        hideModal();
    };
    ui.modal.classList.remove('hidden');
}

function hideModal() { ui.modal.classList.add('hidden'); onSaveCallback = null; }
ui.modalSave.addEventListener('click', () => { if (onSaveCallback) onSaveCallback(); });
ui.modalCancel.addEventListener('click', hideModal);

let onDeleteCallback = null;
function showConfirmModal(title, message, onDelete) { ui.confirmTitle.textContent = title; ui.confirmMessage.textContent = message; onDeleteCallback = onDelete; ui.confirmModal.classList.remove('hidden'); }
function hideConfirmModal() { ui.confirmModal.classList.add('hidden'); onDeleteCallback = null; }
ui.confirmDelete.addEventListener('click', () => { if(onDeleteCallback) onDeleteCallback(); hideConfirmModal(); });
ui.confirmCancel.addEventListener('click', hideConfirmModal);

// --- Initial Load ---
async function init() {
    // First, translate the initial static UI before loading data
    translateUIDynamic();

    const baseTab = { id: 'base', name: 'Base', url: DEFAULT_BASE_URL, data: { categorias: [] } };
    tabs.push(baseTab);
    activeTabId = 'base';
    try {
        const response = await fetch(DEFAULT_BASE_URL);
        if (!response.ok) throw new Error('Failed to load base formulas');
        const jsonData = await response.json();
        if (jsonData && jsonData.categorias) {
            baseTab.data = jsonData;
        }
    } catch(error) {
        console.error("Could not load base formulas:", error);
        alert(_("Could not load the default base formulas."));
    }
    render();
    renderAiCreatorInputs('full_json'); // Render initial inputs for AI creator
}

document.addEventListener('DOMContentLoaded', init);