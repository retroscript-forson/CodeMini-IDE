// ==========================================
// app.js
// ==========================================

// Single canonical definition (previously duplicated in stacks.js, which
// loads later and silently won the reassignment for anything created after
// page load - e.g. every window.recentlyClosed/recycleBin rebuilt inside
// switchWindow - while anything created here at initial page load, below,
// kept using this original, un-debounced version. Same behavior either way,
// just inconsistent debouncing depending on when the array was made. Merged
// here: debounced + defensive write from the stacks.js version, plus this
// version's get-trap so Array methods like .push()/.splice() also trigger a
// save even in edge cases the set-trap alone wouldn't catch.
window.createPersistentArray = function(storageKey) {
    let initial = [];
    try {
        initial = JSON.parse(localStorage.getItem(storageKey)) || [];
    } catch (e) {
        console.warn(`Could not parse persistent data for ${storageKey}`);
    }

    let debounceTimer;
    const save = (arr) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            try {
                localStorage.setItem(storageKey, JSON.stringify(arr));
            } catch (e) {
                console.warn(`Storage quota exceeded for ${storageKey}.`);
            }
        }, 50); // Micro-batch mutations
    };

    return new Proxy(initial, {
        set(target, prop, value) {
            target[prop] = value;
            if (!isNaN(prop) || prop === 'length') save(target);
            return true;
        },
        deleteProperty(target, prop) {
            delete target[prop];
            save(target);
            return true;
        },
        get(target, prop) {
            const val = target[prop];
            if (typeof val === 'function') {
                return function(...args) {
                    const res = Array.prototype[prop].apply(target, args);
                    save(target);
                    return res;
                }
            }
            return val;
        }
    });
};

// Global Collision Helper - Auto-numbering for duplicates
window.getUniqueFileName = function(existingFiles, parentId, baseName, type) {
    let finalName = baseName;
    let counter = 1;
    let nameParts = baseName.split('.');
    let ext = type === 'file' && nameParts.length > 1 ? '.' + nameParts.pop() : '';
    let base = type === 'file' && ext ? nameParts.join('.') : baseName;

    while (existingFiles.some(f => (f.parentId || 'root') === parentId && f.name.toLowerCase() === finalName.toLowerCase())) {
        finalName = `${base}(${counter})${ext}`;
        counter++;
    }
    return finalName;
};

// --- Global Success Toast Notification Engine ---
window.showSuccessToast = function(message) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    
    // Content layout with matching checklist/success icon
    const contentDiv = document.createElement('div');
    contentDiv.className = 'custom-toast-content';
    contentDiv.innerHTML = `<i class="ri-checkbox-circle-line"></i><span>${message}</span>`;
    
    // Close Action Icon (Using pre-loaded Remixicons)
    const closeIcon = document.createElement('i');
    closeIcon.className = 'ri-close-line custom-toast-close';
    closeIcon.addEventListener('click', () => removeToast(toast));
    
    toast.appendChild(contentDiv);
    toast.appendChild(closeIcon);
    container.appendChild(toast);
    
    // Self-destruct sequence after exactly 3 seconds
    const autoDismiss = setTimeout(() => {
        removeToast(toast);
    }, 3000);
    
    function removeToast(el) {
        if (el.classList.contains('fade-out')) return;
        clearTimeout(autoDismiss);
        el.classList.add('fade-out');
        el.addEventListener('animationend', () => {
            el.remove();
            if (container.children.length === 0) {
                container.remove();
            }
        });
    }
};

let cellWindows = JSON.parse(localStorage.getItem('codemini_windows')) || [{ id: 'win_default', name: '- Native Window -', db: 'CodeMiniDB', profile: false }];
let cellActiveWinId = localStorage.getItem('codemini_active_window') || 'win_default';
let cellActiveWindow = cellWindows.find(w => w.id === cellActiveWinId) || cellWindows[0];

let profileStates = JSON.parse(localStorage.getItem('codemini_profile_states')) || {};
let folderStack = [{ id: 'root', name: 'CodeMini' }];

// STRICT ISOLATION: Explorer Clipboard 
window.workspaceClipboardRegistry = window.workspaceClipboardRegistry || {};

let activeGroupId = 'editorGroup1';
window.activeGroupId = activeGroupId; // Global exposure for other scripts
let tabCounter = 1;
let currentSortOrder = 'asc'; 

window.recentlyClosed = window.createPersistentArray(`codemini_recently_closed_${cellActiveWindow.id}`);
window.recycleBin = window.createPersistentArray(`codemini_recycle_bin_${cellActiveWindow.db}`);

window.openedTabs = [];
window.workspacesList = [];

let navHistory = [];
let navIndex = -1;
let isNavigating = false;

let isMultiSelectMode = false;
let selectedFiles = new Set();
let isDownloadMultiSelectMode = false;
let downloadSelectedFiles = new Set();

let db;
let creationMode = null;
let currentExplorerSearch = "";

window.expandedFolders = new Set();
window.creationTargetFolderId = null;

if (profileStates[cellActiveWinId]) {
    const state = profileStates[cellActiveWinId];
    folderStack = state.folderStack || [{ id: 'root', name: 'CodeMini' }];
    navHistory = state.navHistory || [];
    navIndex = state.navIndex !== undefined ? state.navIndex : -1;
    window.expandedFolders = new Set(state.expandedFolders || []);
    currentSortOrder = state.currentSortOrder || 'asc';
    currentExplorerSearch = state.currentExplorerSearch || '';
}

let overlayTimer;
window.showProfileLoadingOverlay = function(windowName, isCreating) {
    const overlay = document.getElementById('profileLoadingOverlay');
    const nameEl = document.getElementById('profileLoadingName');
    const textEl = document.getElementById('profileLoadingText');
    const iconEl = document.querySelector('.profile-loading-icon');
    if (!overlay || !nameEl || !textEl) return;

    nameEl.textContent = windowName;
    
    if (cellActiveWindow.profile) {
        textEl.textContent = isCreating ? "Creating window with profile..." : "Loading profile...";
        if (iconEl) iconEl.className = 'ri-user-smile-line profile-loading-icon';
    } else {
        textEl.textContent = "Loading Native Window...";
        if (iconEl) iconEl.className = 'ri-window-line profile-loading-icon';
    }

    overlay.classList.add('show');
    
    clearTimeout(overlayTimer);
    overlayTimer = setTimeout(() => {
        overlay.classList.remove('show');
    }, 3000);
};

function renderWindowBar() {
    const bar = document.getElementById('windowBar');
    if (!bar) return;
    bar.innerHTML = '';
    cellWindows.forEach(w => {
        let tab = document.createElement('div');
        tab.className = `window-tab ${w.id === cellActiveWinId ? 'active' : ''}`;
        tab.dataset.id = w.id;

        let nameSpan = document.createElement('span');
        nameSpan.textContent = w.name;

        // The native window stays exactly as it was - unlabeled, no icons,
        // can't be renamed or closed.
        if (w.id === 'win_default') {
            tab.appendChild(nameSpan);
        } else {
            let typeIcon = document.createElement('i');
            // Same icon pair the "New Window" / "New Window with Profile"
            // menu items already use, so a window's tab matches whichever
            // menu item actually created it.
            typeIcon.className = w.profile ? 'ri-user-smile-line window-tab-type-icon' : 'ri-window-line window-tab-type-icon';
            typeIcon.title = w.profile ? 'Profile Window' : 'Window';
            tab.appendChild(typeIcon);

            tab.appendChild(nameSpan);

            let moreIcon = document.createElement('i');
            moreIcon.className = 'ri-more-fill window-tab-more-icon';
            moreIcon.title = 'Window Options';
            moreIcon.onclick = (e) => {
                e.stopPropagation();
                showWindowActionsMenu(e, w);
            };
            tab.appendChild(moreIcon);
        }

        tab.onclick = () => {
            if (cellActiveWinId !== w.id) switchWindow(w.id);
        };
        bar.appendChild(tab);
    });
}

// Reuses the same #contextMenu singleton (and its existing outside-click-to-
// close handling) that file/folder right-click menus already use, rather
// than introducing a second dropdown mechanism - same addOption pattern and
// icon/label conventions as showContextMenu's own Rename/Delete options,
// just positioned off the window tab's three-dot icon instead of a file.
function showWindowActionsMenu(e, w) {
    const menu = document.getElementById('contextMenu');
    if (!menu) return;
    menu.innerHTML = '';

    const addOption = (icon, text, handler, colorStyle = '') => {
        const div = document.createElement('div'); div.className = 'dropdown-item';
        div.innerHTML = `<i class="${icon}" style="${colorStyle}"></i> <span style="${colorStyle}">${text}</span>`;
        div.onclick = (event) => { event.stopPropagation(); menu.classList.remove('show'); handler(); };
        menu.appendChild(div);
    };

    addOption('ri-edit-line', 'Rename', () => {
        if (window.showCustomModal) {
            window.showCustomModal({ title: 'Rename Window', inputType: 'text', inputValue: w.name, submitText: 'Rename' }, (newName) => {
                if (newName && newName.trim()) {
                    w.name = newName.trim();
                    localStorage.setItem('codemini_windows', JSON.stringify(cellWindows));
                    renderWindowBar();
                }
                closeGenModal();
            });
        }
    });

    addOption('ri-close-line', 'Close', () => {
        if (window.showCustomModal) {
            window.showCustomModal({ title: 'Close Window', text: `Are you sure you want to close window "${w.name}"? This permanently deletes the profile data if it is a window with profile.`, submitText: 'Close' }, async () => {

                // Deep Isolated Environment Teardown Guard
                if (window.teardownPreviewContext) window.teardownPreviewContext(w.id);
                if (window.forceCloseEnvironments) window.forceCloseEnvironments(w.id, true);

                delete window.workspaceClipboardRegistry[w.id];
                if (window.cellClipboardRegistry) delete window.cellClipboardRegistry[w.id];
                if (window._activeCellRegistry) delete window._activeCellRegistry[w.id];
                if (window._envStateRegistry) delete window._envStateRegistry[w.id];

                cellWindows = cellWindows.filter(x => x.id !== w.id);
                localStorage.setItem('codemini_windows', JSON.stringify(cellWindows));

                delete profileStates[w.id];
                localStorage.setItem('codemini_profile_states', JSON.stringify(profileStates));

                if (w.profile) {
                    // Also delete all workspaces linked to this profile before deleting the main profile DB
                    const req = indexedDB.open(w.db, 3);
                    req.onsuccess = (e) => {
                        const tempDb = e.target.result;
                        const tx = tempDb.transaction('filesystem', 'readonly');
                        const storeReq = tx.objectStore('filesystem').getAll();
                        storeReq.onsuccess = (ev) => {
                            const files = ev.target.result || [];
                            files.filter(f => f.type === 'workspace').forEach(ws => {
                                if (ws.db) {
                                    try { indexedDB.deleteDatabase(ws.db); } catch(err){}
                                }
                            });
                            tempDb.close();
                            try { indexedDB.deleteDatabase(w.db); } catch(err) { console.warn("Teardown DB error:", err); }
                        };
                    };
                    localStorage.removeItem(`codemini_recycle_bin_${w.db}`);
                }

                const keysToWipe = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.includes(w.id)) keysToWipe.push(key);
                }
                keysToWipe.forEach(k => localStorage.removeItem(k));

                if (cellActiveWinId === w.id) {
                    switchWindow('win_default');
                } else {
                    renderWindowBar();
                }
                closeGenModal();
            });
        }
    }, 'color: var(--color-danger);');

    let clickX = e.clientX || (e.touches && e.touches[0].clientX);
    let clickY = e.clientY || (e.touches && e.touches[0].clientY);

    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;

    if (clickX + menuWidth > window.innerWidth) {
        clickX = window.innerWidth - menuWidth - 10;
    }

    if (clickY + menuHeight > window.innerHeight) {
        clickY = window.innerHeight - menuHeight - 10;
    }

    menu.style.left = `${Math.max(5, clickX)}px`;
    menu.style.top = `${Math.max(5, clickY)}px`;

    menu.classList.add('show');
}

function switchWindow(winId, isCreating = false) {
    if (window.saveCurrentUIState) window.saveCurrentUIState(); 
    if (window.saveBottomPanelContext) window.saveBottomPanelContext(cellActiveWinId);
    
    // Flush all pending saves synchronously BEFORE tearing down the DOM 
    if (window.saveAllUnsavedTabs) window.saveAllUnsavedTabs();
    
    // Strict isolation structural cleanup for the outgoing window
    if (window.forceClosePreview) window.forceClosePreview(cellActiveWinId);
    if (window.forceCloseEnvironments) window.forceCloseEnvironments(cellActiveWinId);

    // Release per-tab resources (media/archive Blob URLs, pdf viewer state,
    // docs.js autosave timers) for every tab about to be wiped below - the
    // bulk DOM clear further down bypasses closeTab(), which is where this
    // cleanup normally happens for a single tab.
    if (window.teardownAllOpenPanes) window.teardownAllOpenPanes();

    profileStates[cellActiveWinId] = {
        folderStack: folderStack,
        navHistory: navHistory,
        navIndex: navIndex,
        expandedFolders: Array.from(window.expandedFolders || []),
        currentSortOrder: currentSortOrder,
        currentExplorerSearch: currentExplorerSearch
    };
    localStorage.setItem('codemini_profile_states', JSON.stringify(profileStates));

    const prevWin = cellActiveWindow;
    localStorage.setItem('codemini_active_window', winId);
    cellActiveWinId = winId;
    cellActiveWindow = cellWindows.find(w => w.id === winId) || cellWindows[0];
    
    if (window.reloadSettings) window.reloadSettings(cellActiveWindow.id, cellActiveWindow.profile);

    if (cellActiveWindow.profile || (prevWin && prevWin.profile && !cellActiveWindow.profile)) {
        if (window.showProfileLoadingOverlay) window.showProfileLoadingOverlay(cellActiveWindow.name, isCreating);
    }

    if (profileStates[cellActiveWinId]) {
        const state = profileStates[cellActiveWinId];
        folderStack = state.folderStack || [{ id: 'root', name: 'CodeMini' }];
        navHistory = state.navHistory || [];
        navIndex = state.navIndex !== undefined ? state.navIndex : -1;
        window.expandedFolders = new Set(state.expandedFolders || []);
        currentSortOrder = state.currentSortOrder || 'asc';
        currentExplorerSearch = state.currentExplorerSearch || '';
    } else {
        folderStack = [{ id: 'root', name: 'CodeMini' }];
        navHistory = [];
        navIndex = -1;
        window.expandedFolders.clear();
        currentSortOrder = 'asc';
        currentExplorerSearch = '';
    }

    const sortIcon = document.getElementById('sortNameIcon');
    if (sortIcon) sortIcon.className = currentSortOrder === 'asc' ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line';
    const expSearch = document.getElementById('explorerSearchInput');
    if (expSearch) expSearch.value = currentExplorerSearch;

    window.openedTabs = [];
    window.workspacesList = []; 
    
    selectedFiles.clear();
    downloadSelectedFiles.clear();
    isMultiSelectMode = false;
    isDownloadMultiSelectMode = false;
    if (typeof closeModal === 'function') closeModal();

    const msBtn = document.getElementById('multiSelectBtn');
    if (msBtn) msBtn.style.color = 'var(--icon-gray)';
    const dlBtn = document.querySelector('.ri-download-line[title="Download"]');
    if (dlBtn) dlBtn.style.color = 'var(--icon-gray)';
    
    window.recentlyClosed = window.createPersistentArray(`codemini_recently_closed_${cellActiveWindow.id}`);
    window.recycleBin = window.createPersistentArray(`codemini_recycle_bin_${cellActiveWindow.db}`);

    const closeSearchBtn = document.getElementById('closeSearchBtn');
    const searchSidebar = document.getElementById('searchSidebar');
    if (closeSearchBtn && searchSidebar && searchSidebar.classList.contains('open')) {
        closeSearchBtn.click(); 
    }

    // DISPOSE ALL MONACO MODELS TO FIX MEMORY AND CROSS-PROFILE MARKER LEAK
    if (window.monaco) {
        window.monaco.editor.getModels().forEach(model => model.dispose());
        window.monaco.editor.getEditors().forEach(editor => editor.dispose());
    }
    window.cellMonacoEditors = {}; 

    document.querySelectorAll('.editor-group').forEach((g, i) => { if(i > 0) g.remove(); });
    if (window.removeSplitResizer) window.removeSplitResizer();
    
    const group1 = document.getElementById('editorGroup1');
    if (group1) {
        group1.querySelector('.tabs-bar').querySelectorAll('.tab').forEach(t => t.remove());
        group1.querySelector('.panes-container').innerHTML = '';
        activeGroupId = 'editorGroup1';
        window.activeGroupId = activeGroupId;
        group1.classList.add('active-group');

        const activeFileStatus = document.getElementById('activeFileStatus');
        if (activeFileStatus) activeFileStatus.textContent = 'Workspace';

        const enc = document.getElementById('statusEncoding'); 
        if (enc) enc.style.display = 'none';

        const lf = document.getElementById('statusLineEnding'); 
        if (lf) lf.style.display = 'none';
    }

    renderWindowBar();
    if (window.restoreCurrentUIState) window.restoreCurrentUIState(); 
    if (window.restoreBottomPanelContext) window.restoreBottomPanelContext(winId);

    const activeWinTab = document.querySelector('.window-tab.active');
    if(activeWinTab) {
        activeWinTab.classList.add('window-loading-blink');
        setTimeout(() => activeWinTab.classList.remove('window-loading-blink'), 5000);
    }

    initDatabase(cellActiveWindow.db, () => loadFilesFromDB());
}

function pushNavState() {
    if (isNavigating) return;
    const currentState = {
        folderStack: JSON.parse(JSON.stringify(folderStack)),
        activeTabId: document.querySelector('.editor-group.active-group .tab.active') ? document.querySelector('.editor-group.active-group .tab.active').dataset.target : null
    };

    if (navIndex >= 0) {
        const lastState = navHistory[navIndex];
        if (JSON.stringify(lastState.folderStack) === JSON.stringify(currentState.folderStack) && 
            lastState.activeTabId === currentState.activeTabId) return;
    }

    if (navIndex < navHistory.length - 1) navHistory = navHistory.slice(0, navIndex + 1);
    navHistory.push(currentState);
    navIndex++;
}

let expectedDbName = null;
function initDatabase(dbName, onSuccessCallback) {
    expectedDbName = dbName;
    if (db) { db.close(); db = null; }
    
    const request = indexedDB.open(dbName, 3);
    request.onupgradeneeded = (e) => {
        const tempDb = e.target.result;
        if(tempDb.objectStoreNames.contains('filesystem')) tempDb.deleteObjectStore('filesystem'); 
        tempDb.createObjectStore('filesystem', { keyPath: 'id' });
    };
    request.onsuccess = (e) => {
        if (expectedDbName !== dbName) {
            e.target.result.close();
            return; 
        }
        db = e.target.result;
        if (onSuccessCallback) onSuccessCallback();
    };
    request.onerror = (e) => console.error("Database error: ", e);
}

document.addEventListener('DOMContentLoaded', () => {
    const expSearch = document.getElementById('explorerSearchInput');
    if (expSearch) {
        expSearch.addEventListener('input', (e) => {
            currentExplorerSearch = e.target.value.toLowerCase().trim();
            loadFilesFromDB();
        });
    }
});

function saveFileToDB(fileObj) {
    const executingDbInstance = db;
    const tx = executingDbInstance.transaction('filesystem', 'readwrite');
    tx.objectStore('filesystem').put(fileObj);
    tx.oncomplete = () => {
        if (db === executingDbInstance) loadFilesFromDB();
    };
}

function loadFilesFromDB() {
    const tx = db.transaction('filesystem', 'readonly');
    const req = tx.objectStore('filesystem').getAll();
    req.onsuccess = () => {
        const allFiles = req.result;
        
        // FIX: Ensure workspaces list is updated globally even if inside a workspace
        if (db.name !== cellActiveWindow.db) {
            const rootReq = indexedDB.open(cellActiveWindow.db, 3);
            rootReq.onsuccess = (e) => {
                const rootDb = e.target.result;
                const rootTx = rootDb.transaction('filesystem', 'readonly');
                rootTx.objectStore('filesystem').getAll().onsuccess = (ev) => {
                    window.workspacesList = ev.target.result.filter(f => f.type === 'workspace');
                    rootDb.close();
                };
            };
        } else {
            window.workspacesList = allFiles.filter(f => f.type === 'workspace');
        }

        renderFileList(allFiles);
        
        if (window.renderStacks) window.renderStacks();
        if (typeof window.updateProfileStats === 'function') window.updateProfileStats();
        
        if (typeof window.renderTopSearch === 'function' && document.getElementById('topSearchIsland') && document.getElementById('topSearchIsland').style.display === 'flex') {
            const topSearchInput = document.querySelector('.top-center .search-bar input');
            if (topSearchInput) window.renderTopSearch(topSearchInput.value);
        }
        
        // FIX: Sync Global Search Sidebar Dynamically
        const searchSidebar = document.getElementById('searchSidebar');
        if (searchSidebar && searchSidebar.classList.contains('open')) {
            const runSearchBtn = document.getElementById('runSearchBtn');
            if (runSearchBtn && typeof window.executeGlobalSearch === 'function') {
                runSearchBtn.click(); // Re-trigger the active search query
            }
        }
        
        if (window.appSettings && window.appSettings.restoreSession && window.openedTabs.length === 0) {
            try {
                const sessionData = localStorage.getItem(`codemini_session_${cellActiveWindow.id}`);
                if (sessionData) {
                    const tabsToRestore = JSON.parse(sessionData);
                    
                    const originalActiveGroupId = typeof activeGroupId !== 'undefined' ? activeGroupId : 'editorGroup1';
                    
                    tabsToRestore.forEach(t => {
                        // Strict Group Enforcement & Target assignment
                        const targetGroup = document.getElementById(t.groupId || 'editorGroup1');
                        if (targetGroup) {
                            activeGroupId = targetGroup.id;
                            window.activeGroupId = targetGroup.id;
                            document.querySelectorAll('.editor-group').forEach(g => g.classList.remove('active-group'));
                            targetGroup.classList.add('active-group');
                        }

                        if (t.fileId) {
                            const fileToOpen = allFiles.find(f => f.id === t.fileId);
                            if (fileToOpen) {
                                openFileInTab(fileToOpen);
                                const isRestoredFileNotebook = fileToOpen.name && (fileToOpen.name.endsWith('.ipynb') || fileToOpen.name.endsWith('.irnb') || fileToOpen.name.endsWith('.sqlnb'));
                                // DOM Enforcement Failsafe: only relocate a tab that ended up OUTSIDE its
                                // intended group already (e.g. because it was created before this restore
                                // pass, such as by an earlier double-click). A tab openFileInTab just placed
                                // correctly in targetGroup is left alone so we don't bounce its pane (and
                                // breadcrumb) between groups. Notebooks are skipped entirely here: they're
                                // intentionally single-instance across all groups now (see openFileInTab),
                                // so a stale saved session listing the same notebook under two groupIds
                                // should just leave it wherever it already landed, not fight to relocate it.
                                if (!isRestoredFileNotebook && targetGroup && !targetGroup.querySelector(`.tab[data-file-id="${t.fileId}"]`)) {
                                    const tabEl = document.querySelector(`.tab[data-file-id="${t.fileId}"]`);
                                    if (tabEl) {
                                        const addBtn = targetGroup.querySelector('.add-tab');
                                        if (addBtn) targetGroup.querySelector('.tabs-bar').insertBefore(tabEl, addBtn);
                                        const pane = document.getElementById(tabEl.dataset.target);
                                        if (pane) targetGroup.querySelector('.panes-container').appendChild(pane);
                                    }
                                }
                            }
                        } else if (t.type === 'workspace') {
                            if (targetGroup && !targetGroup.querySelector('.tab[data-type="workspace"]')) {
                                window.createNewTab('Workspace', 'ri-apps-2-line', false, typeof launcherHTMLTemplate !== 'undefined' ? launcherHTMLTemplate : '', 'workspace');
                                const wsTab = targetGroup.querySelector('.tab[data-type="workspace"]');
                                if (wsTab && wsTab.closest('.editor-group') !== targetGroup) {
                                     const addBtn = targetGroup.querySelector('.add-tab');
                                     if (addBtn) targetGroup.querySelector('.tabs-bar').insertBefore(wsTab, addBtn);
                                     const pane = document.getElementById(wsTab.dataset.target);
                                     if (pane) targetGroup.querySelector('.panes-container').appendChild(pane);
                                }
                            }
                        } else if (t.type === 'console') {
                            const langMatch = t.name.match(/^([a-zA-Z]+)\.console/);
                            if (langMatch && window.openLanguageConsole) {
                                window.openLanguageConsole(langMatch[1]);
                                // Matched on the language-specific attribute
                                // openLanguageConsole itself sets (unique per
                                // language, per window) rather than the
                                // generic 'pane-console' prefix every console
                                // tab shares - restoring two different-language
                                // consoles into two different groups otherwise
                                // risks this grabbing whichever one merely
                                // happens to sit first in the DOM and relocating
                                // it instead of the one just opened here.
                                const consTab = document.querySelector(`.tab[data-language-console="${langMatch[1]}"]`);
                                if (consTab && targetGroup && consTab.closest('.editor-group') !== targetGroup) {
                                     const addBtn = targetGroup.querySelector('.add-tab');
                                     if (addBtn) targetGroup.querySelector('.tabs-bar').insertBefore(consTab, addBtn);
                                     const pane = document.getElementById(consTab.dataset.target);
                                     if (pane) targetGroup.querySelector('.panes-container').appendChild(pane);
                                }
                            }
                        } else if (t.type === 'terminal') {
                            const termBtn = document.getElementById('terminalIconItem');
                            if (termBtn) {
                                termBtn.click();
                                // Scoped to targetGroup rather than the whole
                                // document: with a terminal already restored
                                // into the OTHER group earlier in this same
                                // loop, that group's tab would sort after
                                // targetGroup's in document order whenever
                                // targetGroup is editorGroup1 - so
                                // "last terminal tab in the document" doesn't
                                // reliably mean "the one just created here".
                                const termTabs = targetGroup ? targetGroup.querySelectorAll('.tab[data-type="terminal"]') : document.querySelectorAll('.tab[data-type="terminal"]');
                                const latestTerm = termTabs[termTabs.length - 1]; 
                                if (latestTerm && targetGroup && latestTerm.closest('.editor-group') !== targetGroup) {
                                    const addBtn = targetGroup.querySelector('.add-tab');
                                    if (addBtn) targetGroup.querySelector('.tabs-bar').insertBefore(latestTerm, addBtn);
                                    const pane = document.getElementById(latestTerm.dataset.target);
                                    if (pane) targetGroup.querySelector('.panes-container').appendChild(pane);
                                }
                            }
                        } else if (t.type === 'settings') {
                            const setBtn = document.getElementById('settingsIconItem');
                            if (setBtn) {
                                setBtn.click();
                                const setTab = document.querySelector('.tab[data-type="settings"]');
                                if (setTab && targetGroup && setTab.closest('.editor-group') !== targetGroup) {
                                    const addBtn = targetGroup.querySelector('.add-tab');
                                    if (addBtn) targetGroup.querySelector('.tabs-bar').insertBefore(setTab, addBtn);
                                    const pane = document.getElementById(setTab.dataset.target);
                                    if (pane) targetGroup.querySelector('.panes-container').appendChild(pane);
                                }
                            }
                        } else if (t.type === 'profile') {
                            const profBtn = document.getElementById('profileIconItem');
                            if (profBtn) {
                                profBtn.click();
                                const profTab = document.querySelector('.tab[data-type="profile"]');
                                if (profTab && targetGroup && profTab.closest('.editor-group') !== targetGroup) {
                                    const addBtn = targetGroup.querySelector('.add-tab');
                                    if (addBtn) targetGroup.querySelector('.tabs-bar').insertBefore(profTab, addBtn);
                                    const pane = document.getElementById(profTab.dataset.target);
                                    if (pane) targetGroup.querySelector('.panes-container').appendChild(pane);
                                }
                            }
                        } else if (t.type === 'help') {
                            const helpBtn = document.getElementById('menuHelp');
                            if (helpBtn) {
                                helpBtn.click();
                                const helpTab = document.querySelector('.tab[data-type="help"]');
                                if (helpTab && targetGroup && helpTab.closest('.editor-group') !== targetGroup) {
                                    const addBtn = targetGroup.querySelector('.add-tab');
                                    if (addBtn) targetGroup.querySelector('.tabs-bar').insertBefore(helpTab, addBtn);
                                    const pane = document.getElementById(helpTab.dataset.target);
                                    if (pane) targetGroup.querySelector('.panes-container').appendChild(pane);
                                }
                            }
                        }
                    });
                    
                    // Revert to original active group
                    activeGroupId = originalActiveGroupId;
                    window.activeGroupId = activeGroupId;
                    document.querySelectorAll('.editor-group').forEach(g => g.classList.remove('active-group'));
                    const origGroupEl = document.getElementById(originalActiveGroupId);
                    if(origGroupEl) origGroupEl.classList.add('active-group');
                    
                    // Ensure that each populated group has an active tab displaying
                    document.querySelectorAll('.editor-group').forEach(g => {
                        const tabs = g.querySelectorAll('.tab');
                        if (tabs.length > 0 && !g.querySelector('.tab.active')) {
                            if (window.switchTab) window.switchTab(tabs[tabs.length - 1].dataset.target);
                        }
                    });
                    
                    if (typeof updateOpenedTabsRegistry === 'function') updateOpenedTabsRegistry();
                    
                } else if (!document.querySelector('.tab') && folderStack.length === 1) {
                    if (window.createNewTab) window.createNewTab('Workspace', 'ri-apps-2-line', false, typeof launcherHTMLTemplate !== 'undefined' ? launcherHTMLTemplate : '', 'workspace');
                }
            } catch(e) { console.error("Session restore error", e); }
        } else if (!document.querySelector('.tab') && folderStack.length === 1) {
             if (window.createNewTab) window.createNewTab('Workspace', 'ri-apps-2-line', false, typeof launcherHTMLTemplate !== 'undefined' ? launcherHTMLTemplate : '', 'workspace');
        }
        
        setTimeout(pushNavState, 50); 
    };
}

function isNameDuplicate(name, parentId, callback) {
    const tx = db.transaction('filesystem', 'readonly');
    const req = tx.objectStore('filesystem').getAll();
    req.onsuccess = () => {
        const files = req.result;
        const duplicate = files.find(f => (f.parentId || 'root') === parentId && f.name.toLowerCase() === name.toLowerCase());
        callback(!!duplicate);
    };
}

function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0 && now.getDate() === d.getDate()) return 'Today';
    if (days === 1 || (days === 0 && now.getDate() !== d.getDate())) return 'Yesterday';
    return d.toLocaleDateString();
}

// Splits a file/folder name into a "head" that's allowed to ellipsize and
// a "tail" that always stays fully visible (used to truncate long explorer
// names in the middle instead of letting them push/overlay the date column).
// The tail is sized to comfortably include the extension, so e.g.
// "some-really-long-component-name-here.spec.js" truncates to something like
// "some-really-long-co....name-here.spec.js" rather than losing the
// extension off the end.
function splitNameForTruncation(name) {
    const dotIndex = name.lastIndexOf('.');
    const hasExt = dotIndex > 0 && dotIndex < name.length - 1;
    const extLen = hasExt ? (name.length - dotIndex) : 0;
    const tailLen = Math.min(name.length - 1, Math.max(extLen + 6, 10));
    // Short names never need splitting - just render them whole.
    if (name.length <= tailLen + 6) return { head: name, tail: '' };
    return { head: name.slice(0, name.length - tailLen), tail: name.slice(-tailLen) };
}

function updateBreadcrumbs() {
    const pathEl = document.getElementById('fileBrowserPath');
    if (!pathEl) return;
    const rootNode = folderStack[0];
    const rootName = rootNode.name;
    let html = `<i class="ri-folder-5-line" style="color: var(--icon-gray)"></i> <p style="font-size: 11px; cursor: pointer; color: var(--accent-blue); font-weight: 700;" id="crumb-root">${rootName}</p>`;
    
    for(let i = 1; i < folderStack.length; i++) {
        html += `<span style="font-size: 11px; margin: 0 2px; color: var(--text-muted);">/</span><p style="font-size: 11px; cursor: pointer; font-weight: 700; color: var(--accent-blue);" class="crumb-link" data-index="${i}">${folderStack[i].name}</p>`;
    }
    html += `<span style="font-size: 11px; margin: 0 2px; color: var(--text-muted)">/</span>`;
    pathEl.innerHTML = html;

    // FIX: Only re-render the workspace top node instead of bouncing the user fully out to the main DB
    document.getElementById('crumb-root').addEventListener('click', () => {
        folderStack = [folderStack[0]];
        loadFilesFromDB();
    });

    pathEl.querySelectorAll('.crumb-link').forEach(el => {
        el.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            folderStack = folderStack.slice(0, idx + 1);
            loadFilesFromDB();
        });
    });
}

const genericModal = document.getElementById('genericModal');
const genModalLabel = document.getElementById('genModalLabel');
const genModalText = document.getElementById('genModalText');
const genModalInput = document.getElementById('genModalInput');
const genModalPassword = document.getElementById('genModalPassword');
const genModalError = document.getElementById('genModalError');
const genModalCancel = document.getElementById('genModalCancel');
const genModalSubmit = document.getElementById('genModalSubmit');
let genModalCallback = null;

function closeGenModal() {
    genericModal.classList.remove('show');
    document.getElementById('modalBackdrop').classList.remove('show');
}

if (genModalCancel) genModalCancel.addEventListener('click', closeGenModal);
if (genModalSubmit) genModalSubmit.addEventListener('click', () => { if (genModalCallback) genModalCallback(); });
if (genericModal) {
    genericModal.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { if (genModalCallback) genModalCallback(); }
        if (e.key === 'Escape') closeGenModal();
    });
}

window.showCustomModal = function({ title, text, inputType, inputValue, placeholder, placeholder2, requireBoth, submitText }, callback) {
    genModalLabel.textContent = title;
    if (text) { genModalText.innerHTML = text; genModalText.style.display = 'block'; } else { genModalText.style.display = 'none'; }
    genModalInput.style.display = 'none'; genModalPassword.style.display = 'none';
    genModalInput.value = inputValue || ''; genModalPassword.value = '';
    genModalError.style.display = 'none'; genModalSubmit.textContent = submitText || 'OK';

    if (inputType === 'text') {
        genModalInput.style.display = 'block'; genModalInput.type = 'text'; genModalInput.placeholder = placeholder || ''; setTimeout(() => genModalInput.focus(), 100);
    } else if (inputType === 'password') {
        genModalInput.style.display = 'block'; genModalInput.type = 'password'; genModalInput.placeholder = placeholder || ''; setTimeout(() => genModalInput.focus(), 100);
    } else if (inputType === 'double-password') {
        genModalInput.style.display = 'block'; genModalInput.type = 'password'; genModalInput.placeholder = placeholder || 'Old Password';
        genModalPassword.style.display = 'block'; genModalPassword.placeholder = placeholder2 || 'New Password'; setTimeout(() => genModalInput.focus(), 100);
    }

    genModalCallback = () => {
        if (inputType === 'double-password') {
            if (requireBoth && (!genModalInput.value || !genModalPassword.value)) { genModalError.textContent = 'Both fields are required.'; genModalError.style.display = 'block'; return; }
            callback({ val1: genModalInput.value, val2: genModalPassword.value });
        } else if (inputType) {
            if (requireBoth && !genModalInput.value) { genModalError.textContent = 'Field cannot be empty.'; genModalError.style.display = 'block'; return; }
            callback(genModalInput.value);
        } else {
            callback(); closeGenModal(); 
        }
    };
    document.getElementById('modalBackdrop').classList.add('show'); genericModal.classList.add('show');
}

async function transferToExternalDBDeep(targets, targetDbName, action, targetRootId = 'root') {
    const sourceDbName = db.name;
    const isSameDb = sourceDbName === targetDbName;

    const allFiles = await new Promise((res, rej) => {
        const req = indexedDB.open(sourceDbName, 3);
        req.onsuccess = (e) => {
            const tempDb = e.target.result;
            const tx = tempDb.transaction('filesystem', 'readonly');
            tx.objectStore('filesystem').getAll().onsuccess = ev => {
                tempDb.close();
                res(ev.target.result);
            };
            tx.onerror = () => { tempDb.close(); rej("Failed to read source DB"); };
        };
        req.onerror = () => rej("Failed to open source DB");
    });

    const getDescendants = (parentId) => {
        let children = allFiles.filter(f => f.parentId === parentId);
        let result = [...children];
        children.forEach(c => {
            if (c.type === 'folder' || c.type === 'workspace') result.push(...getDescendants(c.id));
        });
        return result;
    };

    // rootTargets = the directly selected items; descendants are their children
    let rootTargets = [];
    let descendants = [];
    let itemNames = [];
    targets.forEach(t => {
        rootTargets.push(t);
        itemNames.push(t.name);
        if (t.type === 'folder' || t.type === 'workspace') descendants.push(...getDescendants(t.id));
    });

    // For same-DB moves we only need to update parentId on root items (descendants stay put).
    // For cross-DB moves or copies we need to transfer everything.
    if (isSameDb && action === 'move') {
        const req = indexedDB.open(sourceDbName, 3);
        req.onsuccess = (e) => {
            const sameDb = e.target.result;
            const tx = sameDb.transaction('filesystem', 'readwrite');
            const store = tx.objectStore('filesystem');
            const existingFiles = allFiles;

            rootTargets.forEach(t => {
                const updated = { ...t, parentId: targetRootId, timestamp: Date.now() };
                updated.name = window.getUniqueFileName(
                    existingFiles.filter(f => f.id !== t.id),
                    targetRootId, updated.name, updated.type
                );
                store.put(updated);
            });

            tx.oncomplete = () => {
                sameDb.close();
                const actionText = 'Moved';
                const itemsText = itemNames.slice(0, 3).join(', ') + (itemNames.length > 3 ? ` and ${itemNames.length - 3} more` : '');
                window.showSuccessToast(`${actionText} ${itemsText} successfully`);
                if (typeof loadFilesFromDB === 'function') loadFilesFromDB();
                if (window.renderStacks) window.renderStacks();
                if (typeof window.refreshAllOpenBreadcrumbs === 'function') window.refreshAllOpenBreadcrumbs();
            };
        };
        req.onerror = () => console.error("Failed to open DB for same-DB move");
        return;
    }

    // Cross-DB transfer (move or copy) — include root items + all descendants
    let filesToTransfer = [];
    rootTargets.forEach(t => filesToTransfer.push({ ...t, isTargetRoot: true }));
    filesToTransfer.push(...descendants);

    const targetReq = indexedDB.open(targetDbName, 3);
    targetReq.onupgradeneeded = (e) => {
        if (!e.target.result.objectStoreNames.contains('filesystem')) {
            e.target.result.createObjectStore('filesystem', { keyPath: 'id' });
        }
    };

    targetReq.onsuccess = (e) => {
        const targetDb = e.target.result;
        const tx = targetDb.transaction('filesystem', 'readwrite');
        const store = tx.objectStore('filesystem');

        store.getAll().onsuccess = (ev) => {
            const existingTargetFiles = ev.target.result || [];
            let idMap = {};

            filesToTransfer.forEach(f => {
                let newFile = { ...f, timestamp: Date.now() };
                const isRoot = newFile.isTargetRoot;
                delete newFile.isTargetRoot;

                if (action === 'copy') {
                    const newId = Date.now().toString() + Math.random().toString(36).substring(2);
                    idMap[f.id] = newId;
                    newFile.id = newId;
                }

                if (isRoot) {
                    newFile.parentId = targetRootId;
                    newFile.name = window.getUniqueFileName(existingTargetFiles, targetRootId, newFile.name, newFile.type);
                    existingTargetFiles.push(newFile);
                } else if (action === 'copy') {
                    newFile.parentId = idMap[f.parentId] || f.parentId;
                }

                store.put(newFile);
            });
        };

        tx.oncomplete = () => {
            targetDb.close();

            const actionText = action === 'copy' ? 'Copied' : 'Moved';
            const itemsText = itemNames.slice(0, 3).join(', ') + (itemNames.length > 3 ? ` and ${itemNames.length - 3} more` : '');
            window.showSuccessToast(`${actionText} ${itemsText} successfully`);

            if (action === 'move') {
                // Delete root targets + all their descendants from the source DB
                const allToDelete = [...rootTargets, ...descendants];
                const deleteReq = indexedDB.open(sourceDbName, 3);
                deleteReq.onsuccess = (delEv) => {
                    const sourceDb = delEv.target.result;
                    const sourceTx = sourceDb.transaction('filesystem', 'readwrite');
                    allToDelete.forEach(f => sourceTx.objectStore('filesystem').delete(f.id));
                    sourceTx.oncomplete = () => {
                        sourceDb.close();
                        if (typeof loadFilesFromDB === 'function') loadFilesFromDB();
                        if (window.renderStacks) window.renderStacks();
                    };
                };
            } else {
                if (typeof loadFilesFromDB === 'function') loadFilesFromDB();
                if (window.renderStacks) window.renderStacks();
            }
        };
    };
}

function showContextMenu(e, file) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    const menu = document.getElementById('contextMenu'); menu.innerHTML = '';
    const activeWinId = cellActiveWindow.id;
    
    const addOption = (icon, text, handler, colorStyle = '') => {
        const div = document.createElement('div'); div.className = 'dropdown-item';
        div.innerHTML = `<i class="${icon}" style="${colorStyle}"></i> <span style="${colorStyle}">${text}</span>`;
        div.onclick = (event) => { event.stopPropagation(); menu.classList.remove('show'); handler(); };
        menu.appendChild(div);
    };

    let targets = isMultiSelectMode && Array.from(selectedFiles).some(f => f.id === file.id) ? Array.from(selectedFiles) : [file];
    let isMulti = targets.length > 1;

    if (window.isTreeViewMode && file.type === 'folder' && !isMulti) {
        const createItem = document.createElement('div');
        createItem.className = 'dropdown-item context-has-submenu';
        createItem.innerHTML = `<i class="ri-add-line"></i> <span>Create...</span> <i class="ri-arrow-right-s-line" style="margin-left:auto;"></i>`;
        
        const subMenu = document.createElement('div');
        subMenu.className = 'context-submenu';
        
        const addSub = (icon, text, mode) => {
            const subItem = document.createElement('div');
            subItem.className = 'dropdown-item';
            subItem.innerHTML = `<i class="${icon}"></i> <span>${text}</span>`;
            subItem.onclick = (evt) => {
                evt.stopPropagation(); 
                menu.classList.remove('show');
                window.creationTargetFolderId = file.id;
                openModal(mode);
            };
            subMenu.appendChild(subItem);
        };
        
        addSub('ri-file-add-line', 'Create File', 'file');
        addSub('ri-folder-add-line', 'Create Folder', 'folder');
        addSub('ri-file-lock-line', 'Create Locked File', 'locked-file');
        addSub('ri-folder-lock-line', 'Create Locked Folder', 'locked-folder');
        
        createItem.appendChild(subMenu);
        createItem.onclick = (evt) => {
            evt.stopPropagation();
            subMenu.classList.toggle('show-submenu');
        };
        menu.appendChild(createItem);
        
        const sep = document.createElement('div');
        sep.style.cssText = "height: 1px; background: var(--border-color); margin: 4px 0;";
        menu.appendChild(sep);
    }

    if (!isMulti) {
        addOption('ri-edit-line', 'Rename', () => {
            window.showCustomModal({ title: 'Rename', inputType: 'text', inputValue: file.name, submitText: 'Rename' }, (newName) => {
                const trimmedName = newName.trim();
                if(trimmedName && trimmedName !== "") {
                    if (file.type === 'file' && !trimmedName.includes('.')) { genModalError.textContent = 'Please include a file extension (e.g., .js, .txt).'; genModalError.style.display = 'block'; return; }
                    isNameDuplicate(trimmedName, file.parentId, (exists) => {
                        if (exists && trimmedName !== file.name) { genModalError.textContent = 'A file or folder with this name already exists.'; genModalError.style.display = 'block'; return; }
                        
                        const txGet = db.transaction('filesystem', 'readonly');
                        txGet.objectStore('filesystem').get(file.id).onsuccess = (e) => {
                            const latestFile = e.target.result;
                            if (latestFile) {
                                latestFile.name = trimmedName; 
                                latestFile.timestamp = Date.now(); 
                                saveFileToDB(latestFile);
                                
                                const openTab = document.querySelector(`.tab[data-file-id="${latestFile.id}"]`);
                                if (openTab) {
                                    // Document tabs always show the literal label "Document",
                                    // never the real filename (see docs.js) - the filename
                                    // itself lives in that tab's own status bar instead, which
                                    // refreshAllOpenBreadcrumbs() below takes care of.
                                    if (openTab.dataset.type !== 'document') {
                                        openTab.querySelector('span').textContent = trimmedName;
                                        if (typeof getFileIconHTML === 'function' && latestFile.type === 'file') {
                                            const newIconHTML = getFileIconHTML(trimmedName);
                                            const iconClassMatch = newIconHTML.match(/class="([^"]+)"/);
                                            if (iconClassMatch) {
                                                const newClass = iconClassMatch[1].replace('file-icon', '').trim();
                                                const iEl = openTab.querySelector('i:not(.tab-close)');
                                                if (iEl) iEl.className = newClass;
                                            }
                                        }
                                    }
                                    if (openTab.classList.contains('active')) {
                                        const activeFileStatus = document.getElementById('activeFileStatus');
                                        if (activeFileStatus) activeFileStatus.textContent = trimmedName;
                                    }
                                    if (typeof updateOpenedTabsRegistry === 'function') updateOpenedTabsRegistry();
                                }

                                // Refresh every open tab's breadcrumb, not just this file's own
                                // (if it's even open) - a renamed folder changes the breadcrumb
                                // path shown by every open file inside it too.
                                if (typeof window.refreshAllOpenBreadcrumbs === 'function') window.refreshAllOpenBreadcrumbs();
                            }
                        };
                        closeGenModal();
                    });
                }
            });
        });
    }

    addOption('ri-scissors-cut-line', 'Cut', () => { window.workspaceClipboardRegistry[activeWinId] = { action: 'cut', files: targets, sourceDb: cellActiveWindow.db }; });
    addOption('ri-file-copy-line', 'Copy', () => { window.workspaceClipboardRegistry[activeWinId] = { action: 'copy', files: targets, sourceDb: cellActiveWindow.db }; });

    addOption('ri-file-copy-fill', 'Duplicate', async () => {
        const txRead = db.transaction('filesystem', 'readonly');
        const allFiles = await new Promise(res => {
            txRead.objectStore('filesystem').getAll().onsuccess = e => res(e.target.result);
        });

        if (file.type === 'folder' || file.type === 'workspace') {
            const newName = window.getUniqueFileName(allFiles, file.parentId, file.name + ' (Copy)', file.type);
            const newFolderId = Date.now().toString() + Math.random().toString(36).substring(2);
            
            const writeTx = db.transaction('filesystem', 'readwrite');
            const store = writeTx.objectStore('filesystem');
            
            const filesToTransfer = [];
            const getDescendants = (parentId, newParentId) => {
                let children = allFiles.filter(f => f.parentId === parentId);
                children.forEach(c => {
                    let newId = Date.now().toString() + Math.random().toString(36).substring(2);
                    let clone = {...c, id: newId, parentId: newParentId, timestamp: Date.now()};
                    filesToTransfer.push(clone);
                    if (c.type === 'folder' || c.type === 'workspace') getDescendants(c.id, newId);
                });
            };
            
            const rootClone = {...file, id: newFolderId, name: newName, timestamp: Date.now()};
            filesToTransfer.push(rootClone);
            getDescendants(file.id, newFolderId);

            filesToTransfer.forEach(f => store.put(f));
            writeTx.oncomplete = () => loadFilesFromDB();
        } else {
            let nameParts = file.name.split('.');
            let ext = nameParts.length > 1 ? '.' + nameParts.pop() : '';
            let baseName = nameParts.length > 0 ? nameParts.join('.') : file.name;
            let newFileName = window.getUniqueFileName(allFiles, file.parentId, baseName + ' (Copy)' + ext, 'file');
            let newFile = { ...file, id: Date.now().toString() + Math.random().toString(36).substring(2), name: newFileName, timestamp: Date.now() };
            saveFileToDB(newFile);
        }
    });

    const currentRootId = folderStack[0].id;
    // currentRootId is relative to whatever we're CURRENTLY browsing - the
    // outer window's own root when not inside a workspace, or the workspace's
    // own root when inside one (that's why this option hides itself for a
    // file already sitting at a workspace's own top level, a few lines down).
    // The target database has to match that same scope: db.name (this IS
    // already cellActiveWindow.db outside a workspace, since only entering a
    // workspace ever points db elsewhere) - hardcoding cellActiveWindow.db
    // unconditionally sent every "Move/Copy to Root" run from inside a
    // workspace to the OUTER database instead, with parentId set to the
    // workspace's own id - which exists there only as the workspace's own
    // type:'workspace' entry, not a real folder anything renders children
    // under, so the file/folder silently vanished even though the operation
    // "succeeded" (the toast has no way to know the destination was wrong).
    const rootDbName = db.name;
    if (file.parentId !== currentRootId && file.id !== 'root' && file.id !== 'workspace-root') {
        addOption('ri-arrow-up-circle-line', 'Move to Root', () => {
            transferToExternalDBDeep(targets, rootDbName, 'move', currentRootId);
        });

        addOption('ri-file-transfer-line', 'Copy to Root', () => {
            transferToExternalDBDeep(targets, rootDbName, 'copy', currentRootId);
        });
    }

    let otherProfiles = [];
    // Always exclude the current window's root DB so we don't show "move to self"
    let seenDbs = new Set([cellActiveWindow.db]);

    let sortedWindows = [...cellWindows].sort((a, b) => a.id === 'win_default' ? -1 : (b.id === 'win_default' ? 1 : 0));

    sortedWindows.forEach(w => {
        if (!seenDbs.has(w.db)) {
            otherProfiles.push(w);
            seenDbs.add(w.db);
        }
    });

    // workspacesList entries already carry a .db field (set at creation time).
    // Filter out the currently active workspace root and resolve each DB name properly.
    let otherWorkspaces = (window.workspacesList || []).filter(ws => ws.id !== folderStack[0].id).map(ws => ({
        ...ws,
        // ws.db is the authoritative DB name; the fallback reconstructs legacy records
        // that predate the profileSuffix convention — accept both forms.
        resolvedDb: ws.db || `CodeMiniDB_WS_${ws.id}`
    }));

    if (folderStack[0].id !== 'root') {
        otherWorkspaces.unshift({ id: 'root', name: 'CodeMini', db: cellActiveWindow.db, resolvedDb: cellActiveWindow.db });
    }

    if (otherProfiles.length > 0 || otherWorkspaces.length > 0) {
        const sep = document.createElement('div');
        sep.style.cssText = "height: 1px; background: var(--border-color); margin: 4px 0;";
        menu.appendChild(sep);

        otherProfiles.forEach(p => {
            addOption('ri-file-copy-2-line', `Copy to ${p.name}`, () => transferToExternalDBDeep(targets, p.db, 'copy', 'root'));
            addOption('ri-drag-move-2-line', `Move to ${p.name}`, () => transferToExternalDBDeep(targets, p.db, 'move', 'root'));
        });

        otherWorkspaces.forEach(ws => {
            const wsDbName = ws.resolvedDb;
            const wsRootId = ws.id === 'root' ? 'root' : ws.id;
            addOption('ri-file-copy-2-line', `Copy to ${ws.name}`, () => transferToExternalDBDeep(targets, wsDbName, 'copy', wsRootId));
            addOption('ri-drag-move-2-line', `Move to ${ws.name}`, () => transferToExternalDBDeep(targets, wsDbName, 'move', wsRootId));
        });

        const sep2 = document.createElement('div');
        sep2.style.cssText = "height: 1px; background: var(--border-color); margin: 4px 0;";
        menu.appendChild(sep2);
    }

    const clip = window.workspaceClipboardRegistry[activeWinId];
    if (!isMulti && file.type === 'folder' && clip) {
        addOption('ri-clipboard-line', 'Paste', async () => {
            const actionText = clip.action === 'copy' ? 'Copied' : 'Moved';
            const itemNames = clip.files.map(f => f.name).slice(0, 3).join(', ');
            
            if (clip.sourceDb && clip.sourceDb !== cellActiveWindow.db) {
                transferToExternalDBDeep(clip.files, cellActiveWindow.db, clip.action, file.id);
                if (clip.action === 'cut') delete window.workspaceClipboardRegistry[activeWinId];
                return;
            }

            if (clip.action === 'cut') { 
                const tx = db.transaction('filesystem', 'readwrite');
                const store = tx.objectStore('filesystem');
                store.getAll().onsuccess = (ev) => {
                    const existingFiles = ev.target.result || [];
                    clip.files.forEach(clipFile => {
                        clipFile.parentId = file.id; 
                        clipFile.timestamp = Date.now(); 
                        clipFile.name = window.getUniqueFileName(existingFiles, file.id, clipFile.name, clipFile.type);
                        store.put(clipFile); 
                        existingFiles.push(clipFile);
                    });
                };
                tx.oncomplete = () => { 
                    loadFilesFromDB(); 
                    delete window.workspaceClipboardRegistry[activeWinId];
                    window.showSuccessToast(`Moved ${itemNames} successfully`);
                    if (typeof window.refreshAllOpenBreadcrumbs === 'function') window.refreshAllOpenBreadcrumbs();
                };
            } else if (clip.action === 'copy') { 
                const txRead = db.transaction('filesystem', 'readonly');
                const allSourceFiles = await new Promise(res => {
                    txRead.objectStore('filesystem').getAll().onsuccess = e => res(e.target.result);
                });
                
                const txWrite = db.transaction('filesystem', 'readwrite');
                const store = txWrite.objectStore('filesystem');
                
                store.getAll().onsuccess = (ev) => {
                    const existingFiles = ev.target.result || [];
                    const filesToTransfer = [];
                    const getDescendants = (parentId, newParentId) => {
                        let children = allSourceFiles.filter(f => f.parentId === parentId);
                        children.forEach(c => {
                            let newId = Date.now().toString() + Math.random().toString(36).substring(2);
                            let clone = {...c, id: newId, parentId: newParentId, timestamp: Date.now()};
                            clone.name = window.getUniqueFileName(existingFiles, newParentId, clone.name, clone.type);
                            filesToTransfer.push(clone);
                            existingFiles.push(clone);
                            if (c.type === 'folder' || c.type === 'workspace') getDescendants(c.id, newId);
                        });
                    };

                    clip.files.forEach(clipFile => {
                        let newId = Date.now().toString() + Math.random().toString(36).substring(2);
                        let rootClone = { ...clipFile, id: newId, parentId: file.id, timestamp: Date.now() };
                        rootClone.name = window.getUniqueFileName(existingFiles, file.id, rootClone.name, rootClone.type);
                        filesToTransfer.push(rootClone);
                        existingFiles.push(rootClone);
                        if (clipFile.type === 'folder' || clipFile.type === 'workspace') {
                            getDescendants(clipFile.id, newId);
                        }
                    });

                    filesToTransfer.forEach(f => store.put(f));
                    txWrite.oncomplete = () => {
                        loadFilesFromDB();
                        window.showSuccessToast(`Copied ${itemNames} successfully`);
                    };
                };
            }
        });
    }

    if (!isMulti && !file.isLocked) {
        const lockText = file.type === 'folder' || file.type === 'workspace' ? 'Lock Folder' : 'Lock File';
        addOption('ri-lock-line', lockText, () => {
            window.showCustomModal({ title: lockText, inputType: 'password', submitText: 'Lock' }, (pwd) => {
                if(pwd) {
                    file.isLocked = true; file.password = pwd; file.timestamp = Date.now(); saveFileToDB(file); closeGenModal();
                } else {
                    genModalError.textContent = 'Password cannot be empty.'; genModalError.style.display = 'block';
                }
            });
        });
    }

    if (!isMulti && file.isLocked) {
        addOption('ri-lock-unlock-line', 'Remove Lock', () => {
            window.showCustomModal({ title: 'Remove Lock', text: 'Enter current password to remove lock:', inputType: 'password', submitText: 'Unlock' }, (pwd) => {
                if (pwd === file.password) {
                    file.isLocked = false; file.password = null; file.timestamp = Date.now(); saveFileToDB(file); closeGenModal();
                    window.showCustomModal({ title: 'Success', text: 'Lock removed successfully.', submitText: 'OK' }, () => { });
                } else { genModalError.textContent = 'Incorrect password.'; genModalError.style.display = 'block'; }
            });
        });

        addOption('ri-lock-password-line', 'Change Password', () => {
            window.showCustomModal({ title: 'Change Password', inputType: 'double-password', placeholder: 'Old Password', placeholder2: 'New Password', requireBoth: true, submitText: 'Change' }, (res) => {
                if (res.val1 === file.password) {
                    file.password = res.val2; file.timestamp = Date.now(); saveFileToDB(file); closeGenModal();
                    window.showCustomModal({ title: 'Success', text: 'Password changed successfully.', submitText: 'OK' }, () => { });
                } else { genModalError.textContent = 'Incorrect old password.'; genModalError.style.display = 'block'; }
            });
        });
    }
    
    if (!isMulti) {
        addOption('ri-information-line', 'Details', async () => {
            const dateStr = new Date(file.timestamp).toLocaleString();
            let detailsHtml = `
                <table style="width:100%; border-collapse: collapse; font-size: 13px; text-align: left;">
                    <tr><th style="padding: 8px 0;">Name:</th><td style="padding: 8px 0;">${file.name}</td></tr>
                    <tr><th style="padding: 8px 0;">Type:</th><td style="padding: 8px 0;">${file.type === 'folder' || file.type === 'workspace' ? 'Folder' : 'File'}</td></tr>
                    <tr><th style="padding: 8px 0;">Modified:</th><td style="padding: 8px 0;">${dateStr}</td></tr>
            `;

            if (file.type === 'folder') {
                const tx = db.transaction('filesystem', 'readonly');
                const allFiles = await new Promise(res => {
                    tx.objectStore('filesystem').getAll().onsuccess = e => res(e.target.result);
                });
                let childCount = 0;
                let folderCount = 0;
                const getCounts = (pId) => {
                    const children = allFiles.filter(f => f.parentId === pId);
                    children.forEach(c => {
                        if (c.type === 'folder') { folderCount++; getCounts(c.id); } 
                        else childCount++;
                    });
                };
                getCounts(file.id);
                detailsHtml += `<tr><th style="padding: 8px 0;">Contents:</th><td style="padding: 8px 0;">${childCount} Files, ${folderCount} Folders</td></tr>`;
            } else {
                const size = file.content ? new Blob([file.content]).size : 0;
                const sizeStr = size > 1024 ? (size/1024).toFixed(2) + ' KB' : size + ' B';
                detailsHtml += `<tr><th style="padding: 8px 0;">Size:</th><td style="padding: 8px 0;">${sizeStr}</td></tr>`;
            }
            
            if(file.perms) detailsHtml += `<tr><th style="padding: 8px 0;">Permissions:</th><td style="padding: 8px 0;">${file.perms}</td></tr>`;
            detailsHtml += `</table>`;

            if(window.showCustomModal) {
                window.showCustomModal({ title: 'Details', text: '', submitText: 'Close' }, () => {});
                const textEl = document.getElementById('genModalText');
                if (textEl) {
                    textEl.innerHTML = detailsHtml;
                    textEl.style.display = 'block';
                }
            }
        });
    }

    addOption('ri-delete-bin-line', 'Delete', () => {
        window.showCustomModal({ title: 'Delete', text: `Are you sure you want to delete ${isMulti ? targets.length + ' items' : '"' + file.name + '"'}?`, submitText: 'Delete' }, () => {
            const tx = db.transaction('filesystem', 'readwrite'); const store = tx.objectStore('filesystem');
            store.getAll().onsuccess = (e) => {
                const allFiles = e.target.result;
                const getDescendants = (parentId) => {
                    const children = allFiles.filter(f => f.parentId === parentId);
                    let result = [...children];
                    children.forEach(c => {
                        if (c.type === 'folder' || c.type === 'workspace') result.push(...getDescendants(c.id));
                    });
                    return result;
                };

                // Expand each target into itself + every descendant, so deleting a
                // folder genuinely deletes its whole contents (previously only the
                // folder's own record was removed, orphaning everything inside it -
                // still present in the database, invisible in every view, and any
                // open tab for a file inside it was never closed since it was never
                // part of the deletion at all).
                const allToDelete = [];
                const seenIds = new Set();
                targets.forEach(t => {
                    if (!seenIds.has(t.id)) { seenIds.add(t.id); allToDelete.push(t); }
                    if (t.type === 'folder' || t.type === 'workspace') {
                        getDescendants(t.id).forEach(d => {
                            if (!seenIds.has(d.id)) { seenIds.add(d.id); allToDelete.push(d); }
                        });
                    }
                });

                allToDelete.forEach(t => {
                    store.delete(t.id);
                    if (!window.appSettings || window.appSettings.enableTrashBin !== false) {
                        t.deletedAt = Date.now();
                        window.recycleBin.push(t);
                    }
                    const openTab = document.querySelector(`.tab[data-file-id="${t.id}"]`);
                    if (openTab) {
                        const group = openTab.closest('.editor-group'); const paneId = openTab.dataset.target; const paneElement = document.getElementById(paneId);
                        if (typeof closeTab === 'function') closeTab(openTab, paneElement, group);
                    }
                });
            };
            tx.oncomplete = () => { selectedFiles.clear(); downloadSelectedFiles.clear(); loadFilesFromDB(); if (window.renderStacks) window.renderStacks(); };
            closeGenModal();
        });
    }, 'color: var(--color-danger);');

    let clickX = e.clientX || (e.touches && e.touches[0].clientX);
    let clickY = e.clientY || (e.touches && e.touches[0].clientY);

    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;

    if (clickX + menuWidth > window.innerWidth) {
        clickX = window.innerWidth - menuWidth - 10;
    }

    if (clickY + menuHeight > window.innerHeight) {
        clickY = window.innerHeight - menuHeight - 10;
    }

    menu.style.left = `${Math.max(5, clickX)}px`; 
    menu.style.top = `${Math.max(5, clickY)}px`; 
    
    menu.classList.add('show');
}

const explorerAddBtn = document.getElementById('explorerAddBtn'); 
const explorerDropdown = document.getElementById('explorerDropdown');
const menuNewFile = document.getElementById('menuNewFile'); 
const menuNewLockedFile = document.getElementById('menuNewLockedFile');
const menuNewLockedFolder = document.getElementById('menuNewLockedFolder'); 
const menuNewWorkspace = document.getElementById('menuNewWorkspace');
const addFolderBtn = document.getElementById('addFolderBtn'); 
const fileList = document.getElementById('fileList');

const menuNewMultiFile = document.createElement('div');
menuNewMultiFile.className = 'dropdown-item';
menuNewMultiFile.id = 'menuNewMultiFile';
menuNewMultiFile.innerHTML = '<i class="ri-file-copy-2-line"></i> New Multiple Files';
if(explorerDropdown) explorerDropdown.appendChild(menuNewMultiFile);

const islandModal = document.getElementById('islandModal'); const modalBackdrop = document.getElementById('modalBackdrop');
const modalLabel = document.getElementById('modalLabel'); const modalInput = document.getElementById('modalInput');
const modalPassword = document.getElementById('modalPassword'); const modalConfirm = document.getElementById('modalConfirm');
const modalError = document.getElementById('modalError'); const modalSubmit = document.getElementById('modalSubmit'); const modalCancel = document.getElementById('modalCancel');

const multiSelectBtn = document.getElementById('multiSelectBtn');
if (multiSelectBtn) {
    multiSelectBtn.addEventListener('click', () => {
        isMultiSelectMode = !isMultiSelectMode;
        multiSelectBtn.style.color = isMultiSelectMode ? 'var(--accent-blue)' : 'var(--icon-gray)';
        if (!isMultiSelectMode) {
            selectedFiles.clear();
            document.querySelectorAll('.file-item.selected-file').forEach(el => el.classList.remove('selected-file'));
        }
    });
}

if (explorerAddBtn) explorerAddBtn.addEventListener('click', (e) => { e.stopPropagation(); explorerDropdown.classList.toggle('show'); });

function openModal(mode) {
    creationMode = mode; 
    modalInput.value = ''; modalPassword.value = ''; modalConfirm.value = ''; modalError.style.display = 'none';
    
    const existingMulti = document.getElementById('multiFileContainer');
    if (existingMulti) existingMulti.style.display = 'none';
    
    const isLocked = mode.includes('locked'); 
    modalPassword.style.display = isLocked ? 'block' : 'none'; 
    modalConfirm.style.display = isLocked ? 'block' : 'none';
    
    if (mode === 'workspace') { modalLabel.textContent = 'New Workspace Name:'; modalInput.placeholder = 'My Workspace'; modalInput.style.display = 'block'; }
    else if (mode.includes('file') && mode !== 'multi-file') { modalLabel.textContent = isLocked ? 'New Locked File Name:' : 'New File Name:'; modalInput.placeholder = 'script.js'; modalInput.style.display = 'block'; }
    else if (mode === 'multi-file') {
        modalLabel.textContent = 'Create Multiple Files:';
        modalInput.style.display = 'none';
        
        let multiContainer = document.getElementById('multiFileContainer');
        if (!multiContainer) {
            multiContainer = document.createElement('div');
            multiContainer.id = 'multiFileContainer';
            multiContainer.style.display = 'flex';
            multiContainer.style.flexDirection = 'column';
            multiContainer.style.gap = '8px';
            multiContainer.innerHTML = `
                <input type="text" id="multiTargetDir" placeholder="Target Directory (Empty = Root)" style="padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 13px; font-family: var(--font-main); outline: none; margin-bottom: 10px;">
                <input type="text" class="multi-file-input" placeholder="File 1 (e.g. file1.js or folder/file1.js)" style="padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 13px; font-family: var(--font-main); outline: none;">
                <input type="text" class="multi-file-input" placeholder="File 2" style="padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 13px; font-family: var(--font-main); outline: none;">
                <input type="text" class="multi-file-input" placeholder="File 3" style="padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 13px; font-family: var(--font-main); outline: none;">
                <input type="text" class="multi-file-input" placeholder="File 4" style="padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 13px; font-family: var(--font-main); outline: none;">
                <input type="text" class="multi-file-input" placeholder="File 5" style="padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 13px; font-family: var(--font-main); outline: none;">
                <input type="text" class="multi-file-input" placeholder="File 6" style="padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 13px; font-family: var(--font-main); outline: none;">
            `;
            islandModal.insertBefore(multiContainer, modalError);
        }
        multiContainer.style.display = 'flex';
        multiContainer.querySelectorAll('input').forEach(inp => inp.value = '');
        
        islandModal.style.height = '460px';
        islandModal.style.overflowY = 'auto';
    }
    else { modalLabel.textContent = isLocked ? 'New Locked Folder Name:' : 'New Folder Name:'; modalInput.placeholder = 'Folder name'; modalInput.style.display = 'block'; }
    
    if (mode !== 'multi-file') {
        islandModal.style.height = 'auto';
    }

    modalBackdrop.classList.add('show'); islandModal.classList.add('show'); explorerDropdown.classList.remove('show'); 
    
    setTimeout(() => {
        if (mode === 'multi-file') document.getElementById('multiTargetDir').focus();
        else modalInput.focus();
    }, 100);
}

function closeModal() { 
    islandModal.classList.remove('show'); 
    modalBackdrop.classList.remove('show'); 
    creationMode = null;
    window.creationTargetFolderId = null;
}

if (menuNewFile) menuNewFile.addEventListener('click', () => openModal('file')); 
if (menuNewLockedFile) menuNewLockedFile.addEventListener('click', () => openModal('locked-file'));
if (menuNewLockedFolder) menuNewLockedFolder.addEventListener('click', () => openModal('locked-folder')); 
if (menuNewWorkspace) menuNewWorkspace.addEventListener('click', () => openModal('workspace')); 
if (addFolderBtn) addFolderBtn.addEventListener('click', () => openModal('folder'));
if (menuNewMultiFile) menuNewMultiFile.addEventListener('click', () => openModal('multi-file'));

if (modalCancel) modalCancel.addEventListener('click', closeModal); 
if (modalBackdrop) modalBackdrop.addEventListener('click', () => { closeModal(); closeGenModal(); });

function handleModalSubmit() {
    if (creationMode === 'multi-file') {
        const targetDirInput = document.getElementById('multiTargetDir').value.trim();
        const fileInputs = Array.from(document.querySelectorAll('.multi-file-input')).map(inp => inp.value.trim()).filter(val => val !== '');
        
        if (fileInputs.length === 0) {
            modalError.textContent = "Please enter at least one file name.";
            modalError.style.display = 'block';
            return;
        }

        const tx = db.transaction('filesystem', 'readwrite');
        const store = tx.objectStore('filesystem');
        
        store.getAll().onsuccess = (e) => {
            const allFiles = e.target.result;
            let pathMapCache = {}; 
            
            const getOrCreatePath = (pathString, baseParentId) => {
                if (!pathString) return baseParentId;
                
                let currentParent = baseParentId;
                let currentPath = "";
                const parts = pathString.split('/').filter(p => p.trim() !== '');
                
                for (let dir of parts) {
                    currentPath = currentPath ? currentPath + '/' + dir : dir;
                    const cacheKey = `${baseParentId}_${currentPath}`;
                    
                    if (pathMapCache[cacheKey]) {
                        currentParent = pathMapCache[cacheKey];
                    } else {
                        const existing = allFiles.find(f => f.parentId === currentParent && f.name === dir && (f.type === 'folder' || f.type === 'workspace'));
                        if (existing) {
                            currentParent = existing.id;
                            pathMapCache[cacheKey] = currentParent;
                        } else {
                            const newDirId = Date.now().toString() + Math.random().toString(36).substring(2);
                            store.put({ id: newDirId, parentId: currentParent, name: dir, type: 'folder', isLocked: false, timestamp: Date.now() });
                            allFiles.push({ id: newDirId, parentId: currentParent, name: dir, type: 'folder' });
                            currentParent = newDirId;
                            pathMapCache[cacheKey] = currentParent;
                        }
                    }
                }
                return currentParent;
            };

            const rootParentId = window.creationTargetFolderId || folderStack[folderStack.length - 1].id;
            const baseTargetId = getOrCreatePath(targetDirInput, rootParentId);

            fileInputs.forEach(filePath => {
                let finalParentId = baseTargetId;
                let fileName = filePath;
                
                if (filePath.includes('/')) {
                    const parts = filePath.split('/');
                    fileName = parts.pop();
                    const subDir = parts.join('/');
                    finalParentId = getOrCreatePath(subDir, baseTargetId);
                }
                
                if (!fileName.includes('.')) {
                    const extMap = { 'JavaScript': '.js', 'Python': '.py', 'Plain Text': '.txt' };
                    const defExt = window.appSettings ? extMap[window.appSettings.defaultLanguage] : '.txt';
                    fileName += (defExt || '.txt');
                }

                store.put({ id: Date.now().toString() + Math.random().toString(36).substring(2), parentId: finalParentId, name: fileName, type: 'file', isLocked: false, password: null, content: "", timestamp: Date.now() });
            });
        };
        
        tx.oncomplete = () => { loadFilesFromDB(); closeModal(); };
        return;
    }

    let name = modalInput.value.trim(); if (name === '') return;
    const isLocked = creationMode.includes('locked');
    if (isLocked) {
        if (!modalPassword.value) { modalError.textContent = "Password cannot be empty."; modalError.style.display = 'block'; return; }
        if (modalPassword.value !== modalConfirm.value) { modalError.textContent = "Passwords do not match."; modalError.style.display = 'block'; return; }
    }
    
    if (creationMode.includes('file')) {
        if (!name.includes('.')) {
            const extMap = { 'JavaScript': '.js', 'Python': '.py', 'Plain Text': '.txt' };
            const defExt = window.appSettings ? extMap[window.appSettings.defaultLanguage] : '.txt';
            name += (defExt || '.txt');
        }
    }

    // FIX: Profile Isolated Workspaces Support Mapping
    if (creationMode === 'workspace') {
        const profileSuffix = cellActiveWindow.profile ? `_${cellActiveWindow.id}` : '';
        const wsDbName = `CodeMiniDB_WS_${Date.now()}${profileSuffix}`;
        const fileObj = { id: Date.now().toString() + Math.random().toString(36).substring(2), parentId: 'workspace-root', name: name, type: 'workspace', db: wsDbName, isLocked: false, password: null, content: "", timestamp: Date.now() };
        const req = indexedDB.open(wsDbName, 3); req.onupgradeneeded = (e) => { e.target.result.createObjectStore('filesystem', { keyPath: 'id' }); };
        saveFileToDB(fileObj); closeModal(); return;
    }

    const targetParentId = window.creationTargetFolderId || folderStack[folderStack.length - 1].id;
    isNameDuplicate(name, targetParentId, (exists) => {
        if (exists) { modalError.textContent = "An item with this name already exists in the selected location."; modalError.style.display = 'block'; return; }
        const fileObj = { id: Date.now().toString() + Math.random().toString(36).substring(2), parentId: targetParentId, name: name, type: creationMode.includes('folder') ? 'folder' : 'file', isLocked: isLocked, password: isLocked ? modalPassword.value : null, content: "", timestamp: Date.now() };
        saveFileToDB(fileObj); closeModal();
    });
}

if (modalSubmit) modalSubmit.addEventListener('click', handleModalSubmit); 
if (islandModal) islandModal.addEventListener('keydown', (e) => { if(e.key === 'Enter') handleModalSubmit(); if(e.key === 'Escape') closeModal(); });

function renderFileList(allFiles) {
    updateBreadcrumbs(); 
    const currentFolderId = folderStack[folderStack.length - 1].id;
    fileList.innerHTML = '';
    
    const sortFiles = (filesArray) => {
        return filesArray.sort((a, b) => {
            const aIsFolder = (a.type === 'folder' || a.type === 'workspace'); 
            const bIsFolder = (b.type === 'folder' || b.type === 'workspace');
            if (aIsFolder && !bIsFolder) return -1; 
            if (!aIsFolder && bIsFolder) return 1; 
            const cmp = a.name.localeCompare(b.name);
            return currentSortOrder === 'asc' ? cmp : -cmp;
        });
    };

    if (currentExplorerSearch) {
        const getDescendantsRecursive = (parentId) => {
            let children = allFiles.filter(f => f.parentId === parentId);
            let result = [...children];
            children.forEach(c => {
                if (c.type === 'folder' || c.type === 'workspace') result.push(...getDescendantsRecursive(c.id));
            });
            return result;
        };
        
        let searchScope = getDescendantsRecursive(currentFolderId);
        let files = searchScope.filter(f => f.name.toLowerCase().includes(currentExplorerSearch));
        files = sortFiles(files);
        
        if (files.length === 0) { 
            fileList.innerHTML = '<div class="empty-state" id="emptyState">No matching files found</div>'; 
            return; 
        }
        files.forEach(file => createFileElement(file, 0, allFiles)); 
        return;
    }

    if (!window.isTreeViewMode) {
        let files = allFiles.filter(f => (f.parentId || 'root') === currentFolderId);
        files = sortFiles(files);
        if(files.length === 0) { fileList.innerHTML = '<div class="empty-state" id="emptyState">Folder is empty</div>'; return; }
        files.forEach(file => createFileElement(file, 0, allFiles));
    } else {
        const renderTree = (parentId, level) => {
            let files = allFiles.filter(f => (f.parentId || 'root') === parentId);
            files = sortFiles(files);
            
            if (level === 0 && files.length === 0) {
                fileList.innerHTML = '<div class="empty-state" id="emptyState">Workspace is empty</div>';
                return;
            }
            
            files.forEach(file => {
                createFileElement(file, level, allFiles);
                const isFolder = file.type === 'folder' || file.type === 'workspace';
                if (isFolder && window.expandedFolders.has(file.id)) {
                    renderTree(file.id, level + 1);
                }
            });
        };
        renderTree(currentFolderId, 0);
    }
}

function createFileElement(file, level, allFilesContext) {
    const newItem = document.createElement('div'); 
    newItem.className = 'file-item'; 
    if (window.isTreeViewMode) newItem.classList.add('tree-view-item');
    
    if (Array.from(selectedFiles).some(f => f.id === file.id)) newItem.classList.add('selected-file');
    if (Array.from(downloadSelectedFiles).some(f => f.id === file.id)) newItem.classList.add('download-selected-file');
    
    const indentBase = window.appSettings ? window.appSettings.treeViewIndent : 15;
newItem.style.setProperty('--tree-indent', `${level * indentBase}px`);

    
    const lockIcon = file.isLocked ? '<i class="ri-lock-line file-lock-icon" style="margin-left: 5px; color: var(--color-danger);"></i>' : '';
    const dateStr = formatTime(file.timestamp) || 'Stored';
    
    let expandIcon = '';
    const isFolder = file.type === 'folder' || file.type === 'workspace';
    
    if (window.isTreeViewMode && file.type === 'folder') {
        const isOpen = window.expandedFolders.has(file.id);
        expandIcon = `<i class="ri-arrow-right-s-line tree-toggle-icon ${isOpen ? 'open' : ''}"></i>`;
    } else if (window.isTreeViewMode && file.type === 'workspace') {
        // Workspaces navigate into a separate DB rather than expanding inline - use a
        // static "enter" affordance instead of the collapsible chevron.
        expandIcon = `<i class="ri-external-link-line" style="font-size: 13px; opacity: 0.6;"></i>`;
    } else if (window.isTreeViewMode) {
        expandIcon = `<span style="width: 19px; display: inline-block; flex-shrink: 0;"></span>`; 
    }

    // Long names truncate in the middle (head ellipsizes, tail - which
    // always includes the extension - stays put) rather than stretching the
    // row and pushing or overlapping the date on the right.
    const { head: nameHead, tail: nameTail } = splitNameForTruncation(file.name);
    // The lock icon lives inside .file-name-wrap (right after the tail) rather than
    // as a sibling of it - .file-name-wrap is flex:1 and stretches to fill the row,
    // so anything placed outside it gets shoved out to the far-right edge instead of
    // sitting next to the (possibly truncated) name where it reads naturally.
    const nameHTML = `<span class="file-name-wrap" title="${file.name}"><span class="file-name-head">${nameHead}</span><span class="file-name-tail">${nameTail}</span>${lockIcon}</span>`;

    if(isFolder) {
        newItem.innerHTML = `<div class="file-item-left"><span class="file-icons-wrap">${expandIcon}<i class="ri-folder-2-line file-icon icon-folder"></i></span>${nameHTML}</div><div class="file-item-right">${dateStr}</div>`;
    } else {
        const getIcon = typeof getFileIconHTML === 'function' ? getFileIconHTML(file.name) : '<i class="ri-file-text-line file-icon" style="color: var(--icon-gray);"></i>';
        newItem.innerHTML = `<div class="file-item-left"><span class="file-icons-wrap">${expandIcon}${getIcon}</span>${nameHTML}</div><div class="file-item-right">${dateStr}</div>`;
    }
    
    let isLongPress = false; let longPressTimer;
    newItem.addEventListener('click', (e) => { 
        if (isLongPress) { isLongPress = false; return; } 
        
        // Workspaces are a navigation boundary (separate DB), not an expandable tree node -
        // their children can't be listed inline alongside the current DB's files. Always
        // route them through the normal open path (which switches DB via enterWorkspace),
        // even in tree view.
        if (window.isTreeViewMode && isFolder && file.type !== 'workspace' && (e.target.closest('.tree-toggle-icon') || (!isMultiSelectMode && !isDownloadMultiSelectMode))) {
            if (window.expandedFolders.has(file.id)) {
                window.expandedFolders.delete(file.id);
                loadFilesFromDB();
            } else {
                if (file.isLocked) {
                    window.showCustomModal({ title: 'Item Locked', text: `Enter password to access ${file.name}:`, inputType: 'password', submitText: 'Unlock' }, (pwd) => {
                        if (pwd !== file.password) { window.showCustomModal({ title: 'Error', text: 'Incorrect password!', submitText: 'OK' }, () => {}); return; }
                        window.expandedFolders.add(file.id);
                        loadFilesFromDB();
                        closeGenModal();
                    });
                } else {
                    window.expandedFolders.add(file.id);
                    loadFilesFromDB();
                }
            }
            return;
        }

        handleFileClick(file, newItem, allFilesContext); 
    });
    newItem.addEventListener('contextmenu', (e) => showContextMenu(e, file));
    newItem.addEventListener('touchstart', (e) => { isLongPress = false; longPressTimer = setTimeout(() => { isLongPress = true; showContextMenu({clientX: e.touches[0].clientX, clientY: e.touches[0].clientY}, file); }, 600); }, {passive: true});
    newItem.addEventListener('touchend', () => clearTimeout(longPressTimer)); newItem.addEventListener('touchmove', () => clearTimeout(longPressTimer));
    fileList.appendChild(newItem);
}

function handleFileClick(file, element, allFilesContext) {
    if (isDownloadMultiSelectMode) {
        const isSelecting = !Array.from(downloadSelectedFiles).some(f => f.id === file.id);
        
        if (isSelecting) {
            downloadSelectedFiles.add(file);
            element.classList.add('download-selected-file');
        } else {
            const toRemove = Array.from(downloadSelectedFiles).find(f => f.id === file.id);
            if (toRemove) downloadSelectedFiles.delete(toRemove);
            element.classList.remove('download-selected-file');
        }

        if (window.isTreeViewMode && (file.type === 'folder' || file.type === 'workspace')) {
            const getDescendants = (parentId) => {
                let children = allFilesContext.filter(f => f.parentId === parentId);
                let result = [...children];
                children.forEach(c => {
                    if (c.type === 'folder' || c.type === 'workspace') result.push(...getDescendants(c.id));
                });
                return result;
            };

            const descendants = getDescendants(file.id);
            let selectionChanged = false;

            descendants.forEach(desc => {
                if (isSelecting) {
                    if (!Array.from(downloadSelectedFiles).some(f => f.id === desc.id)) { downloadSelectedFiles.add(desc); selectionChanged = true; }
                } else {
                    const toRemove = Array.from(downloadSelectedFiles).find(f => f.id === desc.id);
                    if (toRemove) { downloadSelectedFiles.delete(toRemove); selectionChanged = true; }
                }
            });
            
            if (selectionChanged) {
                loadFilesFromDB(); 
            }
        }
        updateDownloadToolbar();
        return;
    }

    if (isMultiSelectMode) {
        const isSelecting = !Array.from(selectedFiles).some(f => f.id === file.id);
        
        if (isSelecting) {
            selectedFiles.add(file);
            element.classList.add('selected-file');
        } else {
            const toRemove = Array.from(selectedFiles).find(f => f.id === file.id);
            if (toRemove) selectedFiles.delete(toRemove);
            element.classList.remove('selected-file');
        }

        if (window.isTreeViewMode && (file.type === 'folder' || file.type === 'workspace')) {
            const getDescendants = (parentId) => {
                let children = allFilesContext.filter(f => f.parentId === parentId);
                let result = [...children];
                children.forEach(c => {
                    if (c.type === 'folder' || c.type === 'workspace') result.push(...getDescendants(c.id));
                });
                return result;
            };

            const descendants = getDescendants(file.id);
            let selectionChanged = false;

            descendants.forEach(desc => {
                if (isSelecting) {
                    if (!Array.from(selectedFiles).some(f => f.id === desc.id)) { selectedFiles.add(desc); selectionChanged = true; }
                } else {
                    const toRemove = Array.from(selectedFiles).find(f => f.id === desc.id);
                    if (toRemove) { selectedFiles.delete(toRemove); selectionChanged = true; }
                }
            });
            
            if (selectionChanged) {
                loadFilesFromDB(); 
            }
        }
        return;
    }
    if (file.isLocked) {
        window.showCustomModal({ title: 'Item Locked', text: `Enter password to access ${file.name}:`, inputType: 'password', submitText: 'Unlock' }, (pwd) => {
            if (pwd !== file.password) { window.showCustomModal({ title: 'Error', text: 'Incorrect password!', submitText: 'OK' }, () => {}); return; }
            proceedWithFileOpen(file); closeGenModal();
        }); return;
    }
    proceedWithFileOpen(file);
}

// Shared workspace-entry logic. A workspace's contents live in their own isolated
// IndexedDB (see wsDbName / CodeMiniDB_WS_...), NOT in the DB that holds the workspace
// record itself. Every place that navigates into a workspace must switch databases via
// initDatabase() first and stamp isWorkspaceRoot/parentDb onto the folderStack entry -
// otherwise all subsequent file reads/writes (open, preview, move/copy to root, etc.)
// keep hitting whichever DB happened to be open before, and silently fail to find the
// real records. This mirrors the pattern already used by the workspace switcher dropdown
// and top-search "jump to workspace" action.
window.enterWorkspace = function(file) {
    const wsDb = file.db || `CodeMiniDB_WS_${file.id}`;
    initDatabase(wsDb, () => {
        folderStack = [{ id: file.id, name: file.name, isWorkspaceRoot: true, parentDb: cellActiveWindow.db }];
        if (typeof loadFilesFromDB === 'function') loadFilesFromDB();
    });
};

function proceedWithFileOpen(file) {
    if (file.type === 'workspace') { window.enterWorkspace(file); return; }
    if (file.type === 'folder') { folderStack.push({ id: file.id, name: file.name }); loadFilesFromDB(); return; }
    const tx = db.transaction('filesystem', 'readonly');
    tx.objectStore('filesystem').get(file.id).onsuccess = (e) => { const freshFile = e.target.result; if(freshFile && typeof openFileInTab === 'function') openFileInTab(freshFile); };
}

// Background Memory Management Loop
setInterval(() => {
    const hasUnsaved = document.querySelector('.tab.unsaved-blink') !== null;
    const activeWin = document.querySelector('.window-tab.active');
    if (activeWin) { if (hasUnsaved) activeWin.classList.add('has-unsaved'); else activeWin.classList.remove('has-unsaved'); }
    
    // Memory Limit Enforcement
    if (window.appSettings && window.appSettings.maxMemory && performance && performance.memory) {
        const usedMB = performance.memory.usedJSHeapSize / (1024 * 1024);
        const limitMB = parseInt(window.appSettings.maxMemory);
        if (usedMB > limitMB) {
            // Aggressive Cleanup Mode
            if (window.recentlyClosed && window.recentlyClosed.length > 0) {
                window.recentlyClosed.length = 0;
                if (window.renderStacks) window.renderStacks();
            }
            if (window.recycleBin && window.recycleBin.length > 50) {
                 window.recycleBin.splice(0, window.recycleBin.length - 20); 
            }
            
            if (!window._memoryWarned) {
                console.warn(`Memory limit exceeded: ${usedMB.toFixed(2)} MB > ${limitMB} MB. Reclaiming memory...`);
                if(window.showCustomModal) {
                    window.showCustomModal({
                        title: 'High Memory Usage', 
                        text: `Browser memory has exceeded the ${limitMB}MB limit. Background caches have been cleared to maintain performance.`, 
                        submitText: 'OK'
                    }, () => { closeGenModal(); });
                }
                window._memoryWarned = true;
                setTimeout(() => { window._memoryWarned = false; }, 120000); // Wait 2 minutes before warning again
            }
        }
    }
}, 1000);

document.addEventListener('DOMContentLoaded', () => {
    if (window.restoreCurrentUIState) window.restoreCurrentUIState();
    
    initDatabase(cellActiveWindow.db, () => loadFilesFromDB());
    
    if (cellActiveWindow.profile) {
        if (window.showProfileLoadingOverlay) window.showProfileLoadingOverlay(cellActiveWindow.name, false);
    }
});