// ==========================================
// script.js (Layout, Event Listeners & Advanced DND Manager)
// ==========================================

// Shared drag-resize helper: wires one handle element to work identically
// with mouse AND touch, so every resizer in the app can share one correct
// implementation instead of each hand-rolling mouse-only logic (which is
// how the sidebar/bottom-panel/live-preview resizers worked before - none
// of them supported touch at all).
//
// onStart(e)         - called once when the drag begins; return false to cancel.
// onMove(dx, dy, e)   - called on every move, with total delta from the drag's start point.
// onEnd(e)            - called once when the drag ends (mouseup/touchend/touchcancel).
//
// The handle gets 'dragging' added/removed automatically. touchmove calls
// preventDefault() so dragging a handle doesn't also scroll the page underneath it.
window.makeResizable = function(handle, { onStart, onMove, onEnd, cursor } = {}) {
    if (!handle) return;
    let active = false;
    let startX = 0, startY = 0;

    const getPoint = (e) => {
        if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        if (e.changedTouches && e.changedTouches.length) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        return { x: e.clientX, y: e.clientY };
    };

    const start = (e) => {
        if (onStart && onStart(e) === false) return;
        active = true;
        const p = getPoint(e);
        startX = p.x; startY = p.y;
        handle.classList.add('dragging');
        if (cursor) document.body.style.cursor = cursor;
        e.preventDefault();
    };

    const move = (e) => {
        if (!active) return;
        const p = getPoint(e);
        if (e.type === 'touchmove') e.preventDefault();
        if (onMove) onMove(p.x - startX, p.y - startY, e);
    };

    const end = (e) => {
        if (!active) return;
        active = false;
        handle.classList.remove('dragging');
        if (cursor) document.body.style.cursor = '';
        if (onEnd) onEnd(e);
    };

    handle.addEventListener('mousedown', start);
    handle.addEventListener('touchstart', start, { passive: false });
    document.addEventListener('mousemove', move);
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('mouseup', end);
    document.addEventListener('touchend', end);
    document.addEventListener('touchcancel', end);
};

// Inserts (once) a draggable divider between editorGroup1 and editorGroup2,
// resizing the split ratio on both desktop (side-by-side, drag left/right)
// and mobile (stacked, drag up/down - .editor-split-view switches to
// flex-direction: column at the same breakpoint the CSS uses for that).
window.ensureSplitResizer = function() {
    const splitView = document.getElementById('splitView');
    const group1 = document.getElementById('editorGroup1');
    const group2 = document.getElementById('editorGroup2');
    if (!splitView || !group1 || !group2) return;
    if (document.getElementById('splitResizer')) return;

    const resizer = document.createElement('div');
    resizer.id = 'splitResizer';
    resizer.className = 'split-resizer';
    splitView.insertBefore(resizer, group2);

    let startSize = 0;
    let isRow = true;

    window.makeResizable(resizer, {
        onStart: () => {
            isRow = getComputedStyle(splitView).flexDirection === 'row';
            startSize = isRow ? group1.offsetWidth : group1.offsetHeight;
            group1.style.transition = 'none';
            group2.style.transition = 'none';
        },
        onMove: (dx, dy) => {
            const containerSize = isRow ? splitView.offsetWidth : splitView.offsetHeight;
            let newSize = startSize + (isRow ? dx : dy);
            const minSize = 150;
            const maxSize = containerSize - minSize - 6; // leave room for the resizer itself + group2's minimum
            if (newSize < minSize) newSize = minSize;
            if (newSize > maxSize) newSize = maxSize;

            group1.style.flex = `0 0 ${newSize}px`;
            group2.style.flex = '1 1 0';
        },
        onEnd: () => {
            group1.style.transition = '';
            group2.style.transition = '';
            const winId = localStorage.getItem('codemini_active_window') || 'win_default';
            const ratio = isRow
                ? group1.offsetWidth / splitView.offsetWidth
                : group1.offsetHeight / splitView.offsetHeight;
            localStorage.setItem(`codemini_split_ratio_${winId}`, ratio);
        }
    });

    // Restore a previously-saved split ratio, if any, so a chosen size
    // survives a reload the same way sidebar width and bottom panel height do.
    const winId = localStorage.getItem('codemini_active_window') || 'win_default';
    const savedRatio = parseFloat(localStorage.getItem(`codemini_split_ratio_${winId}`));
    if (!isNaN(savedRatio) && savedRatio > 0 && savedRatio < 1) {
        const isRowNow = getComputedStyle(splitView).flexDirection === 'row';
        const containerSize = isRowNow ? splitView.offsetWidth : splitView.offsetHeight;
        if (containerSize > 0) {
            group1.style.flex = `0 0 ${Math.round(containerSize * savedRatio)}px`;
            group2.style.flex = '1 1 0';
        }
    }
};

window.removeSplitResizer = function() {
    const resizer = document.getElementById('splitResizer');
    if (resizer) resizer.remove();
    const group1 = document.getElementById('editorGroup1');
    if (group1) group1.style.flex = '';
};

// Single source of truth for Tree/List view, regardless of what triggered
// the change (the explorer's own toggle button, or the Settings dropdown) -
// keeps window.isTreeViewMode, the persisted explorerDefaultView setting,
// and the live UI (button color, Settings dropdown if open) all in sync.
window.setExplorerTreeMode = function(isTree, options = {}) {
    window.isTreeViewMode = isTree;

    const treeViewBtn = document.getElementById('treeViewBtn');
    if (treeViewBtn) treeViewBtn.style.color = isTree ? 'var(--accent-blue)' : 'var(--icon-gray)';

    if (window.appSettings) window.appSettings.explorerDefaultView = isTree ? 'Tree View' : 'List View';
    if (!options.skipPersistSetting) {
        const winId = typeof cellActiveWinId !== 'undefined' ? cellActiveWinId : (localStorage.getItem('codemini_active_window') || 'win_default');
        const activeWin = (typeof cellWindows !== 'undefined' ? cellWindows : JSON.parse(localStorage.getItem('codemini_windows') || 'null') || []).find(w => w.id === winId) || { profile: false };
        const syncProfilesActive = localStorage.getItem('codemini_syncProfileSettings') === 'true';
        const prefixedKey = (activeWin.profile && !syncProfilesActive) ? `codemini_${winId}_explorerDefaultView` : `codemini_explorerDefaultView`;
        localStorage.setItem(prefixedKey, isTree ? 'Tree View' : 'List View');
    }

    if (window.saveCurrentUIState) window.saveCurrentUIState();
    if (typeof loadFilesFromDB === 'function') loadFilesFromDB();
    if (typeof window.syncUI === 'function') window.syncUI();
};

window.saveCurrentUIState = function() {
    const winId = localStorage.getItem('codemini_active_window') || 'win_default';
    const uiState = {
        sidebar: document.getElementById('explorerSidebar')?.classList.contains('open') ? 'explorer' :
                 document.getElementById('searchSidebar')?.classList.contains('open') ? 'search' :
                 document.getElementById('stackSidebar')?.classList.contains('open') ? 'stack' : null,
        bottomPanel: document.getElementById('problemsPanel')?.style.display !== 'none',
        bottomActiveTab: document.querySelector('.bottom-panel-tab.active')?.dataset.target || 'problemsPanelContent',
        treeMode: window.isTreeViewMode,
        splitView: document.getElementById('editorGroup2') !== null
    };
    localStorage.setItem(`codemini_ui_state_${winId}`, JSON.stringify(uiState));
};

window.restoreCurrentUIState = function() {
    const winId = localStorage.getItem('codemini_active_window') || 'win_default';
    
    // Dynamically isolate and rebuild activity items for this window profile before rendering layout
    if (window.restoreActivityState) window.restoreActivityState();

    const defaultState = { sidebar: null, bottomPanel: false, bottomActiveTab: 'problemsPanelContent', splitView: false };

    let uiState = defaultState;
    try {
        const saved = localStorage.getItem(`codemini_ui_state_${winId}`);
        if (saved) uiState = JSON.parse(saved);
    } catch(e){}

    // Restore Sidebar Width
    const savedSidebarWidth = localStorage.getItem(`codemini_sidebar_width_${winId}`);
    if (savedSidebarWidth) {
        document.documentElement.style.setProperty('--sidebar-width', `${savedSidebarWidth}px`);
    }

   window.isTreeViewMode = uiState.treeMode !== undefined ? uiState.treeMode : (window.appSettings && window.appSettings.explorerDefaultView === 'Tree View');
   if (window.appSettings) window.appSettings.explorerDefaultView = window.isTreeViewMode ? 'Tree View' : 'List View';

    const treeViewBtn = document.getElementById('treeViewBtn');
    if (treeViewBtn) {
        treeViewBtn.style.color = window.isTreeViewMode ? 'var(--accent-blue)' : 'var(--icon-gray)';
    }

    if (window.closeAllSidebars) window.closeAllSidebars();
    if (uiState.sidebar === 'explorer') { document.getElementById('explorerSidebar')?.classList.add('open'); document.getElementById('folderIconItem')?.classList.add('active'); }
    else if (uiState.sidebar === 'search') { document.getElementById('searchSidebar')?.classList.add('open'); document.getElementById('searchIconItem')?.classList.add('active'); }
    else if (uiState.sidebar === 'stack') {
        document.getElementById('stackSidebar')?.classList.add('open');
        document.getElementById('stackIconItem')?.classList.add('active');
        if (window.renderStacks) window.renderStacks();
    }

    const problemsPanel = document.getElementById('problemsPanel');
    if (problemsPanel) {
        problemsPanel.style.display = uiState.bottomPanel ? 'flex' : 'none';
        
        const savedHeight = localStorage.getItem(`codemini_bottom_panel_height_${winId}`);
        if (savedHeight) {
            problemsPanel.style.height = `${savedHeight}px`;
        }

        if (uiState.bottomActiveTab) {
            const tabs = document.querySelectorAll('.bottom-panel-tab');
            const contents = document.querySelectorAll('.bottom-panel-content');
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.style.display = 'none');
            
            const tabToClick = document.querySelector(`.bottom-panel-tab[data-target="${uiState.bottomActiveTab}"]`);
            if (tabToClick) tabToClick.classList.add('active');
            
            const targetContent = document.getElementById(uiState.bottomActiveTab);
            if (targetContent) targetContent.style.display = uiState.bottomActiveTab === 'problemsPanelContent' ? 'block' : 'flex';
        }
    }

    // Fully isolated restoration of the Split Editor Panel
    const splitView = document.getElementById('splitView');
    let group2 = document.getElementById('editorGroup2');
    
    if (uiState.splitView && !group2 && splitView) {
        group2 = document.createElement('div'); 
        group2.className = 'editor-group'; 
        group2.id = 'editorGroup2';
        group2.innerHTML = `<div class="tabs-bar"><div class="add-tab"><i class="ri-add-line"></i></div></div><div class="panes-container"></div>`;
        splitView.appendChild(group2); 
        if (window.ensureSplitResizer) window.ensureSplitResizer();
    } else if (!uiState.splitView && group2) {
        group2.remove();
        if (window.removeSplitResizer) window.removeSplitResizer();
        const group1 = document.getElementById('editorGroup1');
        if (group1) group1.classList.add('active-group');
        if (typeof activeGroupId !== 'undefined') activeGroupId = 'editorGroup1';
    }
};

const treeViewBtn = document.getElementById('treeViewBtn');
if (treeViewBtn) {
    treeViewBtn.addEventListener('click', () => {
        window.setExplorerTreeMode(!window.isTreeViewMode);
    });
}

document.getElementById('menuNewWindow')?.addEventListener('click', () => {
    if (cellWindows.length >= 4) {
        if(window.showCustomModal) window.showCustomModal({ title: 'Limit Reached', text: 'You can only create up to 4 windows maximum.', submitText: 'OK' }, () => { closeGenModal(); });
        return;
    }
    let newId = 'win_' + Date.now(); let newNum = cellWindows.filter(w => !w.profile && w.id !== 'win_default').length + 1;
    cellWindows.push({ id: newId, name: `Window-${newNum}`, db: cellActiveWindow.db, profile: false }); localStorage.setItem('codemini_windows', JSON.stringify(cellWindows));
    if(typeof switchWindow === 'function') switchWindow(newId); document.getElementById('moreDropdown').classList.remove('show');
});

document.getElementById('menuNewWindowProfile')?.addEventListener('click', () => {
    if (cellWindows.length >= 4) {
        if(window.showCustomModal) window.showCustomModal({ title: 'Limit Reached', text: 'You can only create up to 4 windows maximum.', submitText: 'OK' }, () => { closeGenModal(); });
        return;
    }
    let newId = 'win_' + Date.now(); let newNum = cellWindows.filter(w => w.profile).length + 1;
    cellWindows.push({ id: newId, name: `Window-${newNum} (Profile)`, db: 'CodeMiniDB_profile_' + Date.now(), profile: true }); localStorage.setItem('codemini_windows', JSON.stringify(cellWindows));
    if(typeof switchWindow === 'function') switchWindow(newId, true); document.getElementById('moreDropdown').classList.remove('show');
});

document.getElementById('navBackBtn')?.addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('navBackDropdown').classList.toggle('show'); document.getElementById('navFwdDropdown').classList.remove('show'); });
document.getElementById('navFwdBtn')?.addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('navFwdDropdown').classList.toggle('show'); document.getElementById('navBackDropdown').classList.remove('show'); });

function applyNavState(state) {
    folderStack = state.folderStack;
    if(typeof loadFilesFromDB === 'function') loadFilesFromDB();

    if (state.groups) {
        for (const [groupId, tabTarget] of Object.entries(state.groups)) {
            if (tabTarget && document.getElementById(tabTarget) && document.getElementById(groupId)) {
                if (typeof switchTab === 'function') switchTab(tabTarget);
            }
        }
    } else if (state.activeTabId && document.getElementById(state.activeTabId)) {
        if (typeof switchTab === 'function') switchTab(state.activeTabId);
    }

    if (state.activeGroupId) {
        document.querySelectorAll('.editor-group').forEach(g => g.classList.remove('active-group'));
        const targetGroup = document.getElementById(state.activeGroupId);
        if (targetGroup) {
            targetGroup.classList.add('active-group');
            activeGroupId = targetGroup.id;
            window.activeGroupId = targetGroup.id;
        }
    }
}

document.getElementById('menuHistBack')?.addEventListener('click', () => { 
    if (typeof navIndex !== 'undefined' && navIndex > 0) {
        isNavigating = true; 
        navIndex--; 
        applyNavState(navHistory[navIndex]);
        isNavigating = false;
    }
    document.getElementById('navBackDropdown').classList.remove('show'); 
});

document.getElementById('menuHistFwd')?.addEventListener('click', () => { 
    if (typeof navIndex !== 'undefined' && navIndex < navHistory.length - 1) {
        isNavigating = true; 
        navIndex++; 
        applyNavState(navHistory[navIndex]);
        isNavigating = false;
    }
    document.getElementById('navFwdDropdown').classList.remove('show'); 
});

const handleUndoRedo = (action) => {
    const activePane = document.querySelector('.editor-group.active-group .content-pane.active') || document.querySelector('.content-pane.active');
    if (activePane && window.monaco) {
        const monacoContainer = activePane.querySelector('[id^="editor-container-"]');
        if (monacoContainer) {
            const editors = window.monaco.editor.getEditors();
            const editor = editors.find(e => monacoContainer.contains(e.getContainerDomNode()));
            if (editor) {
                editor.trigger('keyboard', action === 'undo' ? 'undo' : 'redo', null);
                return;
            }
        }
    }
    document.execCommand(action);
};

document.getElementById('menuUndo')?.addEventListener('click', () => { handleUndoRedo('undo'); document.getElementById('navBackDropdown').classList.remove('show'); });
document.getElementById('menuRedo')?.addEventListener('click', () => { handleUndoRedo('redo'); document.getElementById('navFwdDropdown').classList.remove('show'); });

document.getElementById('mainMenuBtnItem')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById('mainMenuDropdown');
    if (dropdown) dropdown.classList.toggle('show');
});

// Top Layout Controls
document.getElementById('topLayoutLeftBtn')?.addEventListener('click', () => {
    const explorer = document.getElementById('explorerSidebar');
    const search = document.getElementById('searchSidebar');
    const stack = document.getElementById('stackSidebar');
    
    if ((explorer && explorer.classList.contains('open')) ||
        (search && search.classList.contains('open')) ||
        (stack && stack.classList.contains('open'))) {
        if(window.closeAllSidebars) window.closeAllSidebars();
    } else {
        const winId = localStorage.getItem('codemini_active_window') || 'win_default';
        let lastSidebar = 'explorer';
        try {
            const state = JSON.parse(localStorage.getItem(`codemini_ui_state_${winId}`));
            if (state && state.sidebar) lastSidebar = state.sidebar;
        } catch(e){}
        
        if (lastSidebar === 'search') document.getElementById('searchIconItem')?.click();
        else if (lastSidebar === 'stack') document.getElementById('stackIconItem')?.click();
        else document.getElementById('folderIconItem')?.click();
    }
});

document.getElementById('topLayoutBottomBtn')?.addEventListener('click', () => {
    const problemsPanel = document.getElementById('problemsPanel');
    if (problemsPanel) {
        problemsPanel.style.display = problemsPanel.style.display === 'none' ? 'flex' : 'none';
        if (window.saveCurrentUIState) window.saveCurrentUIState();
    }
});

document.getElementById('topAdvancedSearchBtn')?.addEventListener('click', () => {
    const searchIconItem = document.getElementById('searchIconItem');
    if(searchIconItem) searchIconItem.click();
});

document.addEventListener('click', (e) => {
    const menu = document.getElementById('contextMenu');
    if (menu && !menu.contains(e.target)) menu.classList.remove('show');
    
    if (e.target.classList.contains('mobile-more-btn')) {
        const dropdown = e.target.nextElementSibling;
        document.querySelectorAll('.mobile-dropdown.show').forEach(d => { if (d !== dropdown) d.classList.remove('show'); });
        dropdown.classList.toggle('show');
    } else {
        const isDropdownClick = e.target.closest('.mobile-dropdown');
        if (!isDropdownClick) document.querySelectorAll('.mobile-dropdown.show').forEach(d => d.classList.remove('show'));
    }
    
    if(!e.target.closest('#navBackBtn') && !e.target.closest('#navBackDropdown')) document.getElementById('navBackDropdown')?.classList.remove('show');
    if(!e.target.closest('#navFwdBtn') && !e.target.closest('#navFwdDropdown')) document.getElementById('navFwdDropdown')?.classList.remove('show');

    const expDropdown = document.getElementById('explorerDropdown'); const expAddBtn = document.getElementById('explorerAddBtn');
    if(expDropdown && !expDropdown.contains(e.target) && e.target !== expAddBtn && !expAddBtn.contains(e.target)) expDropdown.classList.remove('show');
    
    const wsDropdown = document.getElementById('workspaceDropdown'); const wsMenuBtn = document.getElementById('workspaceMenuBtn');
    if(wsDropdown && !wsDropdown.contains(e.target) && e.target !== wsMenuBtn) wsDropdown.classList.remove('show');

    const moreDropdown = document.getElementById('moreDropdown'); const layoutDropdown = document.getElementById('layoutDropdown');
    const moreBtn = document.getElementById('moreMenuBtn'); const layoutBtn = document.getElementById('layoutMenuBtn');
    if (moreDropdown && !moreDropdown.contains(e.target) && e.target !== moreBtn) moreDropdown.classList.remove('show');
    if (layoutDropdown && !layoutDropdown.contains(e.target) && e.target !== layoutBtn) layoutDropdown.classList.remove('show');
    
    const mainMenuDropdown = document.getElementById('mainMenuDropdown'); const mainMenuBtn = document.getElementById('mainMenuBtnItem');
    if (mainMenuDropdown && !mainMenuDropdown.contains(e.target) && e.target !== mainMenuBtn && (!mainMenuBtn || !mainMenuBtn.contains(e.target))) {
        mainMenuDropdown.classList.remove('show');
    }
});

document.addEventListener('mousedown', (e) => {
    const group = e.target.closest('.editor-group');
    if (group) { document.querySelectorAll('.editor-group').forEach(g => g.classList.remove('active-group')); group.classList.add('active-group'); activeGroupId = group.id; window.activeGroupId = activeGroupId; }
});

document.getElementById('splitLayoutBtn')?.addEventListener('click', () => {
    const splitView = document.getElementById('splitView');
    if (document.getElementById('editorGroup2')) {
        document.getElementById('editorGroup2').remove(); document.getElementById('editorGroup1').classList.add('active-group'); activeGroupId = 'editorGroup1'; window.activeGroupId = activeGroupId;
        if (window.removeSplitResizer) window.removeSplitResizer();
    } else {
        const group2 = document.createElement('div'); group2.className = 'editor-group'; group2.id = 'editorGroup2';
        group2.innerHTML = `<div class="tabs-bar"><div class="add-tab"><i class="ri-add-line"></i></div></div><div class="panes-container"></div>`;
        splitView.appendChild(group2); document.querySelectorAll('.editor-group').forEach(g => g.classList.remove('active-group'));
        group2.classList.add('active-group'); activeGroupId = 'editorGroup2'; window.activeGroupId = activeGroupId;
        if(typeof createNewTab === 'function') createNewTab('Workspace', 'ri-apps-2-line', false, typeof launcherHTMLTemplate !== 'undefined' ? launcherHTMLTemplate : '', 'workspace');
        if (window.ensureSplitResizer) window.ensureSplitResizer();
    }
    if (window.saveCurrentUIState) window.saveCurrentUIState();
});

const folderIconItem = document.getElementById('folderIconItem'); const searchIconItem = document.getElementById('searchIconItem'); const stackIconItem = document.getElementById('stackIconItem');
const explorerSidebar = document.getElementById('explorerSidebar'); const searchSidebar = document.getElementById('searchSidebar'); const stackSidebar = document.getElementById('stackSidebar');

window.closeAllSidebars = function() {
    if(explorerSidebar) explorerSidebar.classList.remove('open'); 
    if(searchSidebar) searchSidebar.classList.remove('open'); 
    if(stackSidebar) stackSidebar.classList.remove('open');
    if(folderIconItem) folderIconItem.classList.remove('active'); 
    if(searchIconItem) searchIconItem.classList.remove('active'); 
    if(stackIconItem) stackIconItem.classList.remove('active');
}

if(folderIconItem) folderIconItem.addEventListener('click', () => { 
    const isOpen = explorerSidebar.classList.contains('open'); 
    closeAllSidebars(); 
    if (!isOpen) { explorerSidebar.classList.add('open'); folderIconItem.classList.add('active'); } 
    if (window.saveCurrentUIState) window.saveCurrentUIState();
});

if(stackIconItem) stackIconItem.addEventListener('click', () => { 
    const isOpen = stackSidebar.classList.contains('open'); 
    closeAllSidebars(); 
    if (!isOpen) { stackSidebar.classList.add('open'); stackIconItem.classList.add('active'); if (window.renderStacks) window.renderStacks(); } 
    if (window.saveCurrentUIState) window.saveCurrentUIState();
});

document.getElementById('workspaceMenuBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const wsDrop = document.getElementById('workspaceDropdown');
    wsDrop.innerHTML = '';

    // FIXED: Always load workspace list from the MAIN window db (cellActiveWindow.db),
    // NOT from `db` which might be a workspace-specific db when inside a workspace.
    const mainDbReq = indexedDB.open(cellActiveWindow.db, 3);
    mainDbReq.onsuccess = (mainEv) => {
        const mainDb = mainEv.target.result;
        const tx = mainDb.transaction('filesystem', 'readonly');
        tx.objectStore('filesystem').getAll().onsuccess = (req) => {
            mainDb.close();
            const files = req.target.result;
            let workspaces = files.filter(f => f.parentId === 'workspace-root');
            workspaces.unshift({ id: 'root', name: 'CodeMini' });

            workspaces.forEach(ws => {
                const item = document.createElement('div');
                item.className = 'dropdown-item';
                item.style.justifyContent = 'space-between';

                const nameContainer = document.createElement('div');
                nameContainer.innerHTML = `<i class="ri-folder-5-line"></i> ${ws.name}`;
                nameContainer.style.display = 'flex';
                nameContainer.style.gap = '12px';
                nameContainer.style.alignItems = 'center';
                nameContainer.style.flex = '1';
                item.appendChild(nameContainer);

                if (ws.id !== 'root') {
                    const actionsContainer = document.createElement('div');
                    actionsContainer.style.display = 'flex';
                    actionsContainer.style.alignItems = 'center';

                    const editIcon = document.createElement('i');
                    editIcon.className = 'ri-pencil-line';
                    editIcon.style.color = 'var(--text-muted)';
                    editIcon.style.cursor = 'pointer';
                    editIcon.style.padding = '0 5px';
                    editIcon.onclick = (ev) => {
                        ev.stopPropagation();
                        wsDrop.classList.remove('show');
                        window.showCustomModal({ title: 'Rename Workspace', inputType: 'text', inputValue: ws.name, submitText: 'Rename' }, (newName) => {
                            const trimmedName = newName.trim();
                            if (trimmedName) {
                                // FIXED: Rename must operate on the main db, not the current workspace db.
                                const renDbReq = indexedDB.open(cellActiveWindow.db, 3);
                                renDbReq.onsuccess = (renEv) => {
                                    const renDb = renEv.target.result;
                                    const txRen = renDb.transaction('filesystem', 'readwrite');
                                    const store = txRen.objectStore('filesystem');
                                    store.get(ws.id).onsuccess = (ev2) => {
                                        let wObj = ev2.target.result;
                                        if (wObj) {
                                            wObj.name = trimmedName;
                                            store.put(wObj).onsuccess = () => {
                                                // Update the live folderStack if we're currently inside this workspace
                                                if (folderStack[0].id === ws.id) {
                                                    folderStack[0].name = trimmedName;
                                                    if (typeof loadFilesFromDB === 'function') loadFilesFromDB();
                                                }
                                            };
                                        }
                                    };
                                    txRen.oncomplete = () => renDb.close();
                                };
                            }
                            closeGenModal();
                        });
                    };

                    const delIcon = document.createElement('i');
                    delIcon.className = 'ri-delete-bin-line';
                    delIcon.style.color = 'var(--color-danger)';
                    delIcon.style.cursor = 'pointer';
                    delIcon.style.padding = '0 5px';
                    delIcon.onclick = (ev) => {
                    ev.stopPropagation(); wsDrop.classList.remove('show');
                    window.showCustomModal({ title: 'Delete Workspace', text: `Are you sure you want to delete workspace "${ws.name}"?`, submitText: 'Delete' }, () => {
                        // Fix: Delete the isolated database for the workspace to prevent ghost DB leaks
                        const wsDbName = ws.db || `CodeMiniDB_WS_${ws.id}`;
                        try { indexedDB.deleteDatabase(wsDbName); } catch(e){}
                        
                        const txDel = db.transaction('filesystem', 'readwrite'); txDel.objectStore('filesystem').delete(ws.id);
                        txDel.oncomplete = () => { if(folderStack[0].id === ws.id) { folderStack = [{id: 'root', name: 'CodeMini'}]; if(typeof loadFilesFromDB === 'function') loadFilesFromDB(); } }; closeGenModal();
                    });
                };


                    actionsContainer.appendChild(editIcon);
                    actionsContainer.appendChild(delIcon);
                    item.appendChild(actionsContainer);
                }

                nameContainer.onclick = () => {
                    if (ws.id === 'root') {
                        // FIXED: Switch back to the main window db (cellActiveWindow.db), correct for ALL window types.
                        initDatabase(cellActiveWindow.db, () => {
                            folderStack = [{ id: 'root', name: 'CodeMini' }];
                            if (typeof loadFilesFromDB === 'function') loadFilesFromDB();
                        });
                    } else {
                        const wsDb = ws.db || `CodeMiniDB_WS_${ws.id}`;
                        // FIXED: Store parentDb as cellActiveWindow.db so profile windows correctly
                        // know which db to return to when navigating out of the workspace.
                        initDatabase(wsDb, () => {
                            folderStack = [{ id: ws.id, name: ws.name, isWorkspaceRoot: true, parentDb: cellActiveWindow.db }];
                            if (typeof loadFilesFromDB === 'function') loadFilesFromDB();
                        });
                    }
                    wsDrop.classList.remove('show');
                };

                wsDrop.appendChild(item);
            });
            wsDrop.classList.toggle('show');
        };
    };
});

const splitViewContainer = document.getElementById('splitView');
if(splitViewContainer) {
    splitViewContainer.addEventListener('click', async (e) => {
        const qsItem = e.target.closest('.quick-start-item');
        if (qsItem) {
            const action = qsItem.dataset.action;
            if (action === 'new-file') { const menuNewFile = document.getElementById('menuNewFile'); if(menuNewFile) menuNewFile.click(); } 
            else if (action === 'new-folder') { const addFolderBtn = document.getElementById('addFolderBtn'); if(addFolderBtn) addFolderBtn.click(); } 
            else if (action === 'open-folder') {
                const dropZone = document.getElementById('dndFolderZone');
                if (dropZone) {
                    if (dropZone.style.display === 'none' || !dropZone.style.display) {
                        dropZone.style.display = 'block';
                        
                        const newDropZone = dropZone.cloneNode(true);
                        dropZone.parentNode.replaceChild(newDropZone, dropZone);
                        
                        newDropZone.addEventListener('click', () => {
                            const fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.webkitdirectory = true; fileInput.multiple = true;
                            fileInput.onchange = async (ev) => {
                                const files = ev.target.files; if (!files.length) return;
                                
                                const progressContainer = document.getElementById('dndProgressContainer');
                                const progressBar = document.getElementById('dndProgressBar');
                                const progressText = document.getElementById('dndProgressText');
                                if(progressContainer) progressContainer.style.display = 'block';
                                if(progressText) progressText.textContent = "Reading files...";
                                if(progressBar) progressBar.style.width = '10%';
                                
                                let filesData = [];
                                for (let i = 0; i < files.length; i++) {
                                    const f = files[i];
                                    const { content, encoding } = await readFileAsAppropriate(f);
                                    filesData.push({ webkitRelativePath: f.webkitRelativePath, name: f.name, content: content, encoding: encoding });
                                    if(progressBar) progressBar.style.width = Math.floor(10 + (i / files.length) * 40) + '%';
                                }
                                
                                if(progressText) progressText.textContent = "Saving to workspace...";
                                
                                const tx = db.transaction('filesystem', 'readwrite'); 
                                const store = tx.objectStore('filesystem'); 
                                
                                const rootFolderName = filesData[0].webkitRelativePath.split('/')[0] || 'Imported';
                                const rootFolderObj = { id: Date.now().toString() + Math.random().toString(36).substring(2), parentId: folderStack[folderStack.length - 1].id, name: rootFolderName, type: 'folder', isLocked: false, timestamp: Date.now() };
                                store.put(rootFolderObj);
                                
                                let pathMap = { [rootFolderName]: rootFolderObj.id };
                                
                                filesData.forEach(fData => {
                                    let parts = fData.webkitRelativePath.split('/'); 
                                    let fileName = parts.pop(); 
                                    let currentParent = folderStack[folderStack.length - 1].id; 
                                    let currentPath = "";
                                    
                                    for(let dir of parts) {
                                        currentPath = currentPath ? currentPath + '/' + dir : dir;
                                        if(!pathMap[currentPath]) { 
                                            let dirId = Date.now().toString() + Math.random().toString(36).substring(2); 
                                            store.put({ id: dirId, parentId: currentParent, name: dir, type: 'folder', timestamp: Date.now() }); 
                                            pathMap[currentPath] = dirId; 
                                        }
                                        currentParent = pathMap[currentPath];
                                    }
                                    
                                    store.put({ id: Date.now().toString() + Math.random().toString(36).substring(2), parentId: currentParent, name: fileName, type: 'file', content: fData.content, encoding: fData.encoding, timestamp: Date.now() });
                                });
                                
                                tx.oncomplete = () => { 
                                    if(progressBar) progressBar.style.width = '100%';
                                    setTimeout(() => {
                                        if(typeof loadFilesFromDB === 'function') loadFilesFromDB(); 
                                        newDropZone.style.display = 'none'; 
                                        if(progressContainer) progressContainer.style.display = 'none';
                                    }, 500);
                                };
                            }; fileInput.click();
                        });
                        
                        newDropZone.addEventListener('dragover', (ev) => { ev.preventDefault(); newDropZone.style.borderColor = 'var(--accent-new)'; });
                        newDropZone.addEventListener('dragleave', (ev) => { ev.preventDefault(); newDropZone.style.borderColor = 'var(--accent-blue)'; });
                        newDropZone.addEventListener('drop', async (ev) => {
                            ev.preventDefault(); newDropZone.style.borderColor = 'var(--accent-blue)';
                            const items = ev.dataTransfer.items; if (!items || !items.length) return;
                            
                            const progressContainer = document.getElementById('dndProgressContainer');
                            const progressBar = document.getElementById('dndProgressBar');
                            const progressText = document.getElementById('dndProgressText');
                            if(progressContainer) progressContainer.style.display = 'block';
                            
                            let filesToSave = [];
                            
                            const readEntry = async (entry, currentPath) => {
                                if (entry.isFile) {
                                    const file = await new Promise(r => entry.file(r));
                                    const { content, encoding } = await readFileAsAppropriate(file);
                                    filesToSave.push({ name: file.name, path: currentPath, type: 'file', content: content, encoding: encoding });
                                } else if (entry.isDirectory) {
                                    filesToSave.push({ name: entry.name, path: currentPath, type: 'folder' });
                                    const reader = entry.createReader();
                                    const entries = await new Promise(r => reader.readEntries(r));
                                    for(let e of entries) await readEntry(e, currentPath ? currentPath + '/' + entry.name : entry.name);
                                }
                            };
                            
                            if(progressText) progressText.textContent = "Reading file structure...";
                            if(progressBar) progressBar.style.width = '30%';
                            
                            for(let i = 0; i < items.length; i++) {
                                const item = items[i];
                                if (item.webkitGetAsEntry) {
                                    const entry = item.webkitGetAsEntry();
                                    if (entry) await readEntry(entry, "");
                                }
                            }
                            
                            if(progressText) progressText.textContent = "Saving files to workspace...";
                            if(progressBar) progressBar.style.width = '70%';
                            
                            const tx = db.transaction('filesystem', 'readwrite'); 
                            const store = tx.objectStore('filesystem');
                            
                            let pathMap = { "": folderStack[folderStack.length - 1].id };
                            
                            filesToSave.forEach(fItem => {
                                let parentPath = fItem.path;
                                let parentId = pathMap[parentPath] || folderStack[folderStack.length - 1].id;
                                let id = Date.now().toString() + Math.random().toString(36).substring(2);
                                
                                if (fItem.type === 'folder') {
                                    let fullPath = parentPath ? parentPath + '/' + fItem.name : fItem.name;
                                    pathMap[fullPath] = id;
                                    store.put({ id: id, parentId: parentId, name: fItem.name, type: 'folder', timestamp: Date.now() });
                                } else {
                                    store.put({ id: id, parentId: parentId, name: fItem.name, type: 'file', content: fItem.content, encoding: fItem.encoding, timestamp: Date.now() });
                                }
                            });
                            
                            tx.oncomplete = () => { 
                                if(progressBar) progressBar.style.width = '100%';
                                setTimeout(() => {
                                    if(typeof loadFilesFromDB === 'function') loadFilesFromDB(); 
                                    newDropZone.style.display = 'none'; 
                                    if(progressContainer) progressContainer.style.display = 'none';
                                }, 500);
                            };
                        });
                    } else {
                        dropZone.style.display = 'none';
                    }
                }
            } else if (action === 'open-repo') {
                if(window.showCustomModal) {
                    window.showCustomModal({ title: 'Open GitHub Repo', text: 'Enter repository (e.g., facebook/react):', inputType: 'text', submitText: 'Fetch' }, async (repo) => {
                        if(!repo) return; closeGenModal();

                        // Safety cap - a full recursive import of a genuinely large repo
                        // (the old placeholder text literally suggested torvalds/linux,
                        // which alone is 70,000+ files) is far more than a browser-based
                        // IndexedDB workspace should try to hold at once.
                        const MAX_FILES = 400;

                        // Captured now, before any of the fetching below (which can take
                        // a while for a repo with many files) - if the user switches
                        // windows/profiles mid-import, this keeps the eventual write
                        // targeted at the workspace the import actually started in, same
                        // reasoning as handleDropItems/extractArchiveFile (up-down.js/archive.js).
                        const targetDb = db;
                        const targetParentId = folderStack[folderStack.length - 1].id;
                        const repoName = repo.split('/').pop();

                        if (window.showSuccessToast) window.showSuccessToast(`Fetching ${repo}...`);

                        try {
                            // 1. Resolve the default branch - the old Contents API call
                            // picked this automatically, but the Trees API below needs it
                            // named explicitly.
                            const repoRes = await fetch(`https://api.github.com/repos/${repo}`);
                            if (!repoRes.ok) throw new Error('repo-not-found');
                            const repoInfo = await repoRes.json();
                            const branch = repoInfo.default_branch || 'main';

                            // 2. One call for the entire recursive file tree, rather than
                            // one call per folder (which is what a naive recursive walk of
                            // the Contents API - and every folder inside it - would need).
                            // This is also still the same api.github.com host and rate-limit
                            // bucket the working root-level fetch already used successfully.
                            const treeRes = await fetch(`https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
                            if (!treeRes.ok) throw new Error('tree-fetch-failed');
                            const treeData = await treeRes.json();

                            let blobs = (treeData.tree || []).filter(entry => entry.type === 'blob');
                            if (blobs.length === 0) {
                                if(window.showCustomModal) window.showCustomModal({title: 'Empty', text: 'No files found in this repository.', submitText: 'OK'}, ()=>{});
                                return;
                            }

                            const wasTruncated = !!treeData.truncated || blobs.length > MAX_FILES;
                            if (blobs.length > MAX_FILES) blobs = blobs.slice(0, MAX_FILES);

                            // 3. Fetch each file's raw content from raw.githubusercontent.com
                            // rather than the REST API - it doesn't count against the same
                            // tiny (60/hr, unauthenticated) rate-limit bucket as the two
                            // api.github.com calls above, so only those two do regardless
                            // of how many files there are. A small concurrency limit keeps
                            // this considerate rather than firing hundreds of fetches at once.
                            const filesToSave = [];
                            const CONCURRENCY = 6;
                            let cursor = 0;
                            async function worker() {
                                while (cursor < blobs.length) {
                                    const entry = blobs[cursor++];
                                    const segments = entry.path.split('/');
                                    const name = segments.pop();
                                    const subPath = segments.join('/');
                                    try {
                                        const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${entry.path.split('/').map(encodeURIComponent).join('/')}`;
                                        const fRes = await fetch(rawUrl);
                                        if (!fRes.ok) throw new Error();
                                        const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
                                        let content, encoding;
                                        if (window.BINARY_FILE_EXTS && window.BINARY_FILE_EXTS.includes(ext)) {
                                            const blob = await fRes.blob();
                                            content = await new Promise((resolve, reject) => {
                                                const reader = new FileReader();
                                                reader.onload = () => {
                                                    const result = reader.result;
                                                    const commaIdx = result.indexOf(',');
                                                    resolve(commaIdx !== -1 ? result.slice(commaIdx + 1) : result);
                                                };
                                                reader.onerror = reject;
                                                reader.readAsDataURL(blob);
                                            });
                                            encoding = 'base64';
                                        } else {
                                            content = await fRes.text();
                                            encoding = undefined;
                                        }
                                        // Nested under repoName so saveExtractedFiles (step 4)
                                        // creates the repo's own root folder as just another
                                        // level of the same path-based folder hierarchy it
                                        // already builds for every other item.
                                        filesToSave.push({ path: subPath ? `${repoName}/${subPath}` : repoName, name, type: 'file', content, encoding });
                                    } catch(e) { /* skip files that fail individually - the rest still import */ }
                                }
                            }
                            await Promise.all(Array.from({ length: Math.min(CONCURRENCY, blobs.length) }, worker));

                            if (filesToSave.length === 0) {
                                if(window.showCustomModal) window.showCustomModal({title: 'Error', text: 'Could not fetch any files from this repository.', submitText: 'OK'}, ()=>{});
                                return;
                            }

                            // 4. One bulk write instead of one saveFileToDB transaction (and
                            // one loadFilesFromDB() re-render) per file - saveExtractedFiles
                            // already builds nested folders from each item's .path this way
                            // for archive extraction and folder drag-and-drop, and already
                            // accepts the explicit targetDb captured above.
                            if (typeof window.saveExtractedFiles === 'function') {
                                await window.saveExtractedFiles(filesToSave, targetParentId, targetDb);
                            }

                            let msg = `Imported ${filesToSave.length} file${filesToSave.length === 1 ? '' : 's'} from ${repo}.`;
                            if (wasTruncated) msg += ` This repository is large - only the first ${blobs.length} files were imported.`;
                            if(window.showCustomModal) window.showCustomModal({title: 'Success', text: msg, submitText: 'OK'}, ()=>{});
                        } catch(e) { if(window.showCustomModal) window.showCustomModal({title: 'Error', text: 'Failed to fetch repository. Check the name, or you may be rate-limited - try again shortly.', submitText: 'OK'}, ()=>{}); }
                    });
                }
            }
            return;
        }

        const launcherCard = e.target.closest('.launcher-card');
        if (launcherCard) {
            const text = launcherCard.querySelector('span').textContent; let ext = ''; let filename = 'unnamed'; let isTerminal = false;
            
            if (text === 'PHP' || text === 'Ruby' || text === 'JavaScript' || text === 'Python') {
                const lang = text === 'Python' ? 'Python' : text;
                if (typeof window.openLanguageConsole === 'function') {
                    window.openLanguageConsole(lang);
                }
                return;
            }
            
            if (text === 'Python 3 (Pyodide)') { filename = 'notebook'; ext = 'ipynb'; } 
            else if (text === 'R (WebR)') { filename = 'notebook'; ext = 'irnb'; }
            else if (text === 'SQL (SQLite)') { filename = 'notebook'; ext = 'sqlnb'; }
            else if (text === 'Python Script') { filename = 'script'; ext = 'py'; } 
            else if (text === 'JavaScript File') ext = 'js'; 
            else if (text === 'Markdown') ext = 'md'; 
            else if (text === 'HTML File') ext = 'html'; 
            else if (text === 'CSS File') ext = 'css'; 
            else if (text === 'Text File') ext = 'txt'; 
            else if (text === 'Terminal') isTerminal = true;
            
            if (isTerminal) { const terminalIconItem = document.getElementById('terminalIconItem'); if(terminalIconItem) terminalIconItem.click(); return; }

            if (text === 'Document') {
                const targetParentId = folderStack[folderStack.length - 1].id;
                if (window.showCustomModal) {
                    window.showCustomModal({
                        title: 'New Document',
                        inputType: 'text',
                        inputValue: 'Untitled Document',
                        submitText: 'Create'
                    }, async (newName) => {
                        let trimmedName = newName.trim();
                        if (!trimmedName) { closeGenModal(); return; }
                        if (!trimmedName.toLowerCase().endsWith('.docx')) trimmedName += '.docx';
                        isNameDuplicate(trimmedName, targetParentId, async (exists) => {
                            if (exists) {
                                const errEl = document.getElementById('genModalError');
                                if (errEl) {
                                    errEl.textContent = 'An item with this name already exists in the current location.';
                                    errEl.style.display = 'block';
                                }
                                return;
                            }
                            // Documents are real, Word-openable .docx files (see docs.js)
                            // rather than portable-but-fake .html, so their content is
                            // base64-encoded zip bytes like any other binary file type.
                            const docContent = (typeof window.createBlankDocumentDocx === 'function') ? await window.createBlankDocumentDocx() : '';
                            const fileObj = { id: Date.now().toString() + Math.random().toString(36).substring(2), parentId: targetParentId, name: trimmedName, type: 'file', isLocked: false, password: null, content: docContent, encoding: 'base64', timestamp: Date.now() };
                            if (typeof saveFileToDB === 'function') {
                                saveFileToDB(fileObj);
                                setTimeout(() => { if (typeof openFileInTab === 'function') openFileInTab(fileObj); }, 100);
                            }
                            if (typeof closeGenModal === 'function') closeGenModal();
                        });
                    });
                }
                return;
            }

             if (ext) {
                const targetParentId = folderStack[folderStack.length - 1].id;
                
                if (window.showCustomModal) {
                    window.showCustomModal({
                        title: `New ${text} File`,
                        inputType: 'text',
                        inputValue: `${filename}.${ext}`,
                        submitText: 'Create'
                    }, (newName) => {
                        const trimmedName = newName.trim();
                        if(trimmedName) {
                            isNameDuplicate(trimmedName, targetParentId, (exists) => {
                                if (exists) {
                                    const errEl = document.getElementById('genModalError');
                                    if (errEl) {
                                        errEl.textContent = 'An item with this name already exists in the current location.';
                                        errEl.style.display = 'block';
                                    }
                                    return;
                                }
                                const fileObj = { id: Date.now().toString() + Math.random().toString(36).substring(2), parentId: targetParentId, name: trimmedName, type: 'file', isLocked: false, password: null, content: "", timestamp: Date.now() };
                                if(typeof saveFileToDB === 'function') {
                                    saveFileToDB(fileObj); 
                                    setTimeout(() => { if(typeof openFileInTab === 'function') openFileInTab(fileObj); }, 100);
                                }
                                if(typeof closeGenModal === 'function') closeGenModal();
                            });
                        }
                    });
                }
            } else if (text.includes('Console')) {
                const title = text;
                const msg = `${text} coming soon.`;
                if(window.showCustomModal) window.showCustomModal({ title: title, text: msg, submitText: 'OK' }, () => { closeGenModal(); });
                return;
            }
            return;
        }

        const addBtn = e.target.closest('.add-tab');
        if (addBtn) {
            const group = addBtn.closest('.editor-group'); activeGroupId = group.id; document.querySelectorAll('.editor-group').forEach(g => g.classList.remove('active-group')); group.classList.add('active-group'); window.activeGroupId = activeGroupId;
            if(typeof createNewTab === 'function') createNewTab('Workspace', 'ri-apps-2-line', false, typeof launcherHTMLTemplate !== 'undefined' ? launcherHTMLTemplate : '', 'workspace'); 
            return;
        }

        const tab = e.target.closest('.tab');
        if (tab) {
            const group = tab.closest('.editor-group'); activeGroupId = group.id; document.querySelectorAll('.editor-group').forEach(g => g.classList.remove('active-group')); group.classList.add('active-group'); window.activeGroupId = activeGroupId;
            if (e.target.classList.contains('tab-close')) { if(typeof closeTab === 'function') closeTab(tab, document.getElementById(tab.dataset.target), group); e.stopPropagation(); } else { if(typeof switchTab === 'function') switchTab(tab.dataset.target); }
            return;
        }
    });
}

const launcherHTMLTemplate = `
    <div class="launcher-section">
        <div class="launcher-section-title">Quick Start</div>
        <div class="quick-start-list">
            <div class="quick-start-item" data-action="new-file"><i class="ri-file-add-line"></i>Create New File...</div>
            <div class="quick-start-item" data-action="new-folder"><i class="ri-folder-add-line"></i> Create New Folder...</div>
            <div class="quick-start-item" data-action="open-folder"><i class="ri-folder-open-line"></i> Open Existing Folder...</div>
            <div id="dndFolderZone" class="dnd-folder-zone" style="display:none; border:2px dashed var(--accent-blue); padding:20px; text-align:center; border-radius:6px; margin:5px 0 10px 0; color:var(--text-muted); cursor:pointer;">
                <i class="ri-upload-cloud-2-line" style="font-size:24px; color:var(--accent-blue); display:block; margin-bottom:5px;"></i>
                Drag and drop folder here, or click to browse
                <div id="dndProgressContainer" style="display:none; width: 100%; margin-top: 15px;">
                    <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px; text-align: left;" id="dndProgressText">Reading files...</div>
                    <div style="width: 100%; height: 4px; background: var(--border-color); border-radius: 2px; overflow: hidden;">
                        <div id="dndProgressBar" style="width: 0%; height: 100%; background: var(--accent-blue); transition: width 0.2s;"></div>
                    </div>
                </div>
            </div>
            <div class="quick-start-item" data-action="open-repo"><i class="ri-git-repository-line"></i> Open Repository...</div>
        </div>
    </div>
    <div class="launcher-section">
        <div class="launcher-section-title">Notebook</div>
        <div class="launcher-grid">
            <div class="launcher-card"><i class="fab fa-python" style="color: var(--icon-py);"></i><span>Python 3 (Pyodide)</span></div>
            <div class="launcher-card"><i class="fab fa-r-project" style="color: #276dc3;"></i><span>R (WebR)</span></div>
            <div class="launcher-card"><i class="ri-database-2-line" style="color: #4CAF50;"></i><span>SQL (SQLite)</span></div>
        </div>
    </div>
    <div class="launcher-section">
        <div class="launcher-card" style="flex-direction:row; padding:12px; gap:10px; cursor:pointer;" onclick="window.open('https://buymeacoffee.com', '_blank')">
            <i class="ri-cup-line" style="margin:0; font-size:20px; color:#ff9800;"></i><span style="font-size: 13px;">Buy me a coffee</span>
        </div>
    </div>
    <div class="launcher-section">
        <div class="launcher-section-title">Console</div>
        <div class="launcher-grid">
            <div class="launcher-card"><i class="fab fa-python" style="color: var(--icon-py);"></i><span>Python</span></div>         <div class="launcher-card"><i class="fab fa-php" style="color: #777bb3;"></i><span>PHP</span></div>
            <div class="launcher-card"><i class="ri-code-line" style="color: #cc342d;"></i><span>Ruby</span></div>
            <div class="launcher-card"><i class="ri-javascript-line" style="color: #f7df1e;"></i><span>JavaScript</span></div>
        </div>
    </div>
    <div class="launcher-section">
        <div class="launcher-section-title">Other</div>
        <div class="launcher-grid">
            <div class="launcher-card"><i class="fab fa-python" style="color: var(--icon-py);"></i><span>Python Script</span></div>
            <div class="launcher-card"><i class="ri-javascript-fill" style="color: var(--icon-js);"></i><span>JavaScript File</span></div>
            <div class="launcher-card"><i class="ri-markdown-fill" style="color: var(--icon-black);"></i><span>Markdown</span></div>
            <div class="launcher-card"><i class="ri-html5-fill" style="color: var(--icon-html);"></i><span>HTML File</span></div>
            <div class="launcher-card"><i class="ri-css3-fill" style="color: var(--icon-css);"></i><span>CSS File</span></div>
            <div class="launcher-card"><i class="ri-file-text-line" style="color: var(--icon-gray);"></i><span>Text File</span></div>
            <div class="launcher-card"><i class="ri-file-word-2-line" style="color: #2b579a;"></i><span>Document</span></div>
            <div class="launcher-card"><i class="ri-terminal-window-line" style="color: var(--text-main);"></i><span>Terminal</span></div>
        </div>
    </div>
    <div class="launcher-privacy">CodeMini does not collects usage data, check our privacy policy for more.</div>
`;

window.renderTopSearch = function(query) {
    const searchIsland = document.getElementById('topSearchIsland');
    const topSearchInput = document.querySelector('.top-center .search-bar input');
    if (!searchIsland || !topSearchInput) return;

    const q = (query || "").toLowerCase().trim(); 
    searchIsland.innerHTML = ''; 
    let html = '';
    
    const commands = [
        { name: 'New File', icon: 'ri-file-add-line', action: () => { const menuNewFile = document.getElementById('menuNewFile'); if(menuNewFile) menuNewFile.click(); } }, { name: 'New Folder', icon: 'ri-folder-add-line', action: () => { const addFolderBtn = document.getElementById('addFolderBtn'); if(addFolderBtn) addFolderBtn.click(); } }, { name: 'Open Terminal', icon: 'ri-terminal-window-line', action: () => { const terminalIconItem = document.getElementById('terminalIconItem'); if(terminalIconItem) terminalIconItem.click(); } }, { name: 'Settings', icon: 'ri-settings-6-line', action: () => { const settingsIconItem = document.getElementById('settingsIconItem'); if(settingsIconItem) settingsIconItem.click(); } }, { name: 'Profile', icon: 'ri-user-4-line', action: () => { const profileIconItem = document.getElementById('profileIconItem'); if(profileIconItem) profileIconItem.click(); } }, { name: 'Format Code', icon: 'ri-format-clear', action: () => { document.querySelector('.tb-format')?.click(); document.querySelector('.jtb-format')?.click(); } }, { name: 'Close All Tabs', icon: 'ri-close-circle-line', action: () => { const activeGroup = document.getElementById(activeGroupId || 'editorGroup1'); if (activeGroup) { Array.from(activeGroup.querySelectorAll('.tab')).forEach(tab => { const closeBtn = tab.querySelector('.tab-close'); if (closeBtn) closeBtn.click(); }); } } }, { name: 'Toggle Zen Mode', icon: 'ri-fullscreen-line', action: () => { document.body.classList.toggle('zen-mode'); } }
    ];

    const matchedCmds = commands.filter(c => c.name.toLowerCase().includes(q));
    if (matchedCmds.length > 0) {
        html += `<div class="top-search-section-header" style="padding: 8px 12px; font-size: 13px; font-weight: bold; color: var(--text-muted); background: var(--bg-white);">COMMANDS</div>`;
        matchedCmds.forEach((cmd, idx) => { html += `<div class="top-search-item" data-cmd-idx="${idx}" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 13px;"><i class="${cmd.icon}" style="color: var(--icon-gray); font-size: 16px; "></i> <span>${cmd.name}</span></div>`; });
    }

    const tx = db.transaction('filesystem', 'readonly');
    tx.objectStore('filesystem').getAll().onsuccess = (req) => {
        const files = req.target.result;

        const getFilePath = (file) => {
            let path = file.name;
            let curr = file.parentId;
            while (curr && curr !== 'root' && curr !== 'workspace-root') {
                let parent = files.find(f => f.id === curr);
                if (parent) { path = parent.name + '/' + path; curr = parent.parentId; }
                else break;
            }
            return path;
        };

        const matchedFiles = files.filter(f => f.type === 'file' && f.name.toLowerCase().includes(q));
        const matchedFolders = files.filter(f => f.type === 'folder' && f.name.toLowerCase().includes(q));

        // FIXED: Workspaces are stored in the MAIN window db (cellActiveWindow.db), not necessarily
        // in the currently active db. Search for workspaces from window.workspacesList which is
        // already populated from the main db in loadFilesFromDB.
        const matchedWorkspaces = (window.workspacesList || []).filter(ws => ws.name && ws.name.toLowerCase().includes(q));
        
        if (matchedWorkspaces.length > 0) {
            html += `<div class="top-search-section-header" style="padding: 8px 12px; font-size: 13px; font-weight: bold; color: var(--text-muted); background: var(--bg-white);">WORKSPACES</div>`;
            matchedWorkspaces.forEach(ws => { 
                html += `<div class="top-search-item top-search-ws" data-ws-id="${ws.id}" data-ws-db="${ws.db || ('CodeMiniDB_ws_' + ws.id)}" data-ws-name="${ws.name}" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 13px;"><i class="ri-folder-5-line" style="color: var(--icon-gray); font-size: 16px;"></i> <span>${ws.name}</span></div>`; 
            });
        }

        if (matchedFolders.length > 0) {
            html += `<div class="top-search-section-header" style="padding: 8px 12px; font-size: 13px; font-weight: bold; color: var(--text-muted); background: var(--bg-white);">FOLDERS</div>`;
            matchedFolders.forEach(f => { 
                const pathStr = getFilePath(f);
                html += `<div class="top-search-item top-search-folder" data-file-id="${f.id}" data-file-name="${f.name}" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 13px;">
                            <div style="display:flex; align-items:center; gap:10px;"><i class="ri-folder-2-line" style="color: var(--icon-gray); font-size: 16px;"></i> <span>${f.name}</span></div>
                            <div style="font-size: 10px; color: var(--text-muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 150px;" title="${pathStr}">${pathStr}</div>
                         </div>`; 
            });
        }

        if (matchedFiles.length > 0) {
            html += `<div class="top-search-section-header" style="padding: 8px 12px; font-size: 13px; font-weight: bold; color: var(--text-muted); background: var(--bg-white);">FILES</div>`;
            matchedFiles.forEach(f => { 
                const getIcon = typeof getFileIconHTML === 'function' ? getFileIconHTML(f.name) : '<i class="ri-file-text-line"></i>';
                const pathStr = getFilePath(f);
                html += `<div class="top-search-item top-search-file" data-file-id="${f.id}" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 13px;">
                            <div style="display:flex; align-items:center; gap:10px;">${getIcon} <span>${f.name}</span></div>
                            <div style="font-size: 10px; color: var(--text-muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 150px;" title="${pathStr}">${pathStr}</div>
                         </div>`; 
            });
        }
        
        if (!html) html = `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">No results found</div>`;
        searchIsland.innerHTML = html;

        searchIsland.querySelectorAll('.top-search-item').forEach(item => {
            item.addEventListener('mouseenter', () => item.style.backgroundColor = 'var(--hover-blue)');
            item.addEventListener('mouseleave', () => item.style.backgroundColor = 'transparent');
            item.addEventListener('click', () => {
                searchIsland.style.display = 'none'; topSearchInput.value = '';
                if (item.hasAttribute('data-cmd-idx')) { commands[item.dataset.cmdIdx].action(); } 
                else if (item.classList.contains('top-search-ws')) {
                    const wsDb = item.dataset.wsDb; const wsId = item.dataset.wsId; const wsName = item.dataset.wsName;
                    if(typeof initDatabase === 'function') {
                        initDatabase(wsDb, () => { folderStack = [{id: wsId, name: wsName, isWorkspaceRoot: true, parentDb: cellActiveWindow.db}]; if(typeof loadFilesFromDB === 'function') loadFilesFromDB(); });
                    }
                } else if (item.classList.contains('top-search-folder')) { folderStack.push({ id: item.dataset.fileId, name: item.dataset.fileName }); if(typeof loadFilesFromDB === 'function') loadFilesFromDB(); } 
                else if (item.classList.contains('top-search-file')) {
                    const txGet = db.transaction('filesystem', 'readonly'); txGet.objectStore('filesystem').get(item.dataset.fileId).onsuccess = (ev) => { const file = ev.target.result; if (file && typeof handleFileClick === 'function') handleFileClick(file, document.createElement('div')); };
                }
            });
        });
    };
};

document.addEventListener('DOMContentLoaded', () => {
    // Inject dataset ids into file elements for DND
    if (typeof window.createFileElement === 'function') {
        const origCreate = window.createFileElement;
        window.createFileElement = function(file, level, allFilesContext) {
            origCreate(file, level, allFilesContext);
            const fileList = document.getElementById('fileList');
            if (fileList && fileList.lastElementChild) {
                const el = fileList.lastElementChild;
                el.dataset.fileId = file.id;
                el.dataset.type = file.type;
                el.dataset.name = file.name;
            }
        };
    }

    // Fix IDs for dropdown items so they can be dragged
    const plugs = document.querySelectorAll('.activity-item .ri-plug-line');
    plugs.forEach(p => { if (!p.parentElement.id) p.parentElement.id = 'extensionIconItem'; });
    
    const groups = document.querySelectorAll('.dropdown-item .ri-group-line');
    groups.forEach(g => { if (!g.parentElement.id) g.parentElement.id = 'menuCollab'; });

    const branches = document.querySelectorAll('.dropdown-item .ri-git-branch-line');
    branches.forEach(b => { if (!b.parentElement.id) b.parentElement.id = 'menuSource'; });
    
    if (window.restoreActivityState) window.restoreActivityState();

    if (typeof loadFilesFromDB === 'function' && typeof db !== 'undefined' && db) {
        loadFilesFromDB();
    }

    const resizer = document.getElementById('bottomPanelResizer');
    const bottomPanel = document.getElementById('problemsPanel');
    
    if (resizer && bottomPanel) {
        let startHeight = 0;
        window.makeResizable(resizer, {
            cursor: 'ns-resize',
            onStart: () => { startHeight = bottomPanel.offsetHeight; },
            onMove: (dx, dy) => {
                let newHeight = startHeight - dy;
                if (newHeight < 100) newHeight = 100;
                if (newHeight > window.innerHeight * 0.8) newHeight = window.innerHeight * 0.8;
                bottomPanel.style.height = `${newHeight}px`;
            },
            onEnd: () => {
                const winId = localStorage.getItem('codemini_active_window') || 'win_default';
                localStorage.setItem(`codemini_bottom_panel_height_${winId}`, bottomPanel.offsetHeight);
            }
        });
    }

    // --- Sidebar Resizing Logic ---
    {
        // Dynamically inject resizers into all sidebars
        document.querySelectorAll('.sidebar').forEach(sidebar => {
            let sResizer = document.createElement('div');
            sResizer.className = 'sidebar-resizer';
            sidebar.appendChild(sResizer);

            let sidebarStartWidth = 0;
            window.makeResizable(sResizer, {
                cursor: 'ew-resize',
                onStart: () => {
                    sidebarStartWidth = sidebar.offsetWidth;
                    sidebar.style.transition = 'none';
                },
                onMove: (dx) => {
                    let newWidth = sidebarStartWidth + dx;
                    if (newWidth < 150) newWidth = 150;
                    if (newWidth > window.innerWidth * 0.6) newWidth = window.innerWidth * 0.6;
                    document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
                },
                onEnd: () => {
                    sidebar.style.transition = '';
                    const winId = localStorage.getItem('codemini_active_window') || 'win_default';
                    localStorage.setItem(`codemini_sidebar_width_${winId}`, sidebar.offsetWidth);
                }
            });
        });
    }

    if (window.restoreCurrentUIState) window.restoreCurrentUIState();
    
    const sortNameBtn = document.getElementById('sortNameBtn');
    if (sortNameBtn) {
        sortNameBtn.addEventListener('click', () => {
            currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
            const icon = document.getElementById('sortNameIcon');
            if (icon) {
                icon.className = currentSortOrder === 'asc' ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line';
            }
            if(typeof loadFilesFromDB === 'function') loadFilesFromDB(); 
        });
    }

    if(typeof renderWindowBar === 'function') renderWindowBar();
    const activeWinTab = document.querySelector('.window-tab.active');
    if(activeWinTab) { activeWinTab.classList.add('window-loading-blink'); setTimeout(() => activeWinTab.classList.remove('window-loading-blink'), 5000); }

    const defWorkspace = document.getElementById('pane-workspace');
    if (defWorkspace) defWorkspace.innerHTML = launcherHTMLTemplate;

    const topSearchInput = document.querySelector('.top-center .search-bar input');
    if (topSearchInput) {
        const searchIsland = document.createElement('div'); searchIsland.id = 'topSearchIsland'; searchIsland.className = 'top-search-island';
        searchIsland.style.cssText = `position: absolute; top: 80px; left: 50%; transform: translateX(-50%); width: 600px; max-width: 95vw; background: var(--bg-white); border: 1px solid var(--border-color); border-radius: 4px; box-shadow: 0 10px 30px var(--shadow-color); z-index: 999; display: none; flex-direction: column; max-height: 45vh; overflow-y: auto;`;
        document.body.appendChild(searchIsland);

        topSearchInput.addEventListener('focus', () => { searchIsland.style.display = 'flex'; window.renderTopSearch(topSearchInput.value); });
        topSearchInput.addEventListener('input', (e) => window.renderTopSearch(e.target.value));
        document.addEventListener('click', (e) => { if (!topSearchInput.contains(e.target) && !searchIsland.contains(e.target)) searchIsland.style.display = 'none'; });
    }
});

setInterval(() => {
    const hasUnsaved = document.querySelector('.tab.unsaved-blink') !== null;
    const activeWin = document.querySelector('.window-tab.active');
    if (activeWin) { if (hasUnsaved) activeWin.classList.add('has-unsaved'); else activeWin.classList.remove('has-unsaved'); }
}, 500);

document.getElementById('layoutTogglePreview')?.addEventListener('click', () => {
    const playIconItem = document.getElementById('playIconItem');
    if (playIconItem) playIconItem.click();
    document.getElementById('layoutDropdown').classList.remove('show');
});

document.getElementById('moreMenuBtn')?.addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('moreDropdown').classList.toggle('show'); document.getElementById('layoutDropdown').classList.remove('show'); });
document.getElementById('layoutMenuBtn')?.addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('layoutDropdown').classList.toggle('show'); document.getElementById('moreDropdown').classList.remove('show'); });
document.getElementById('layoutZenMode')?.addEventListener('click', () => { document.body.classList.toggle('zen-mode'); document.getElementById('layoutDropdown').classList.remove('show'); });
document.getElementById('layoutToggleActivity')?.addEventListener('click', () => { document.body.classList.toggle('hide-activity-bar'); document.getElementById('layoutDropdown').classList.remove('show'); });
document.getElementById('layoutToggleTabs')?.addEventListener('click', () => { document.body.classList.toggle('hide-tab-bar'); document.getElementById('layoutDropdown').classList.remove('show'); });
document.getElementById('layoutToggleExplorer')?.addEventListener('click', () => { const folderIconItem = document.getElementById('folderIconItem'); if(folderIconItem) folderIconItem.click(); document.getElementById('layoutDropdown').classList.remove('show'); });
document.getElementById('layoutToggleSearch')?.addEventListener('click', () => { const searchIconItem = document.getElementById('searchIconItem'); if(searchIconItem) searchIconItem.click(); document.getElementById('layoutDropdown').classList.remove('show'); });
document.getElementById('layoutToggleStacks')?.addEventListener('click', () => { const stackIconItem = document.getElementById('stackIconItem'); if(stackIconItem) stackIconItem.click(); document.getElementById('layoutDropdown').classList.remove('show'); });
document.getElementById('layoutOpenTerminal')?.addEventListener('click', () => { const terminalIconItem = document.getElementById('terminalIconItem'); if(terminalIconItem) terminalIconItem.click(); document.getElementById('layoutDropdown').classList.remove('show'); });
document.getElementById('layoutOpenProfile')?.addEventListener('click', () => { const profileIconItem = document.getElementById('profileIconItem'); if(profileIconItem) profileIconItem.click(); document.getElementById('layoutDropdown').classList.remove('show'); });
document.getElementById('layoutOpenSettings')?.addEventListener('click', () => { const settingsIconItem = document.getElementById('settingsIconItem'); if(settingsIconItem) settingsIconItem.click(); document.getElementById('layoutDropdown').classList.remove('show'); });

window.addEventListener('blur', () => {
    if (window.appSettings && window.appSettings.autoSave === 'On Focus Change' && window.saveAllUnsavedTabs) { window.saveAllUnsavedTabs(); }
});

window.performActiveSave = function() {
    const activeGroup = document.getElementById(activeGroupId || 'editorGroup1');
    const activePane = activeGroup ? activeGroup.querySelector('.content-pane.active') : document.querySelector('.content-pane.active');
    if (activePane) {
        const activeTab = activeGroup.querySelector(`.tab.active`) || document.querySelector(`.tab[data-target="${activePane.id}"]`);
        if (activeTab && activeTab.dataset.type === 'monaco' && window.monaco) {
            const editorContainer = activePane.querySelector('[id^="editor-container-"]');
            if (editorContainer) {
                const editor = window.monaco.editor.getEditors().find(e => editorContainer.contains(e.getContainerDomNode()));
                if (editor) {
                    if (window.appSettings && window.appSettings.formatOnSave && !editor._isFormatting) {
                        editor._isFormatting = true;
                        try { editor.getAction('editor.action.formatDocument')?.run().finally(() => { editor._isFormatting = false; if(typeof window.autoSaveFile === 'function') window.autoSaveFile(activeTab.dataset.fileId, editor.getValue(), activeTab); }); } 
                        catch(e){ if(typeof window.autoSaveFile === 'function') window.autoSaveFile(activeTab.dataset.fileId, editor.getValue(), activeTab); }
                    } else { if(typeof window.autoSaveFile === 'function') window.autoSaveFile(activeTab.dataset.fileId, editor.getValue(), activeTab); }
                    return true;
                }
            }
        }
        if (activeTab && (activeTab.dataset.type === 'notebook' || activeTab.dataset.type === 'java-notebook')) {
            if (typeof triggerNotebookSave === 'function') { triggerNotebookSave(activePane); return true; }
        }
        if (activeTab && activeTab.dataset.type === 'document') {
            if (typeof window.triggerDocumentSave === 'function') { window.triggerDocumentSave(activePane); return true; }
        }
        const tabEl = document.querySelector(`.tab[data-target="${activePane.id}"]`);
        if(tabEl) { tabEl.classList.remove('unsaved-blink'); tabEl.classList.add('saved-pulse'); setTimeout(() => tabEl.classList.remove('saved-pulse'), 1000); return true; }
    }
    return false;
};

document.getElementById('menuSave')?.addEventListener('click', () => {
    window.performActiveSave();
    document.getElementById('moreDropdown').classList.remove('show');
});

document.getElementById('menuSaveAs')?.addEventListener('click', () => {
    const activeGroup = document.getElementById(activeGroupId || 'editorGroup1');
    const activeTab = activeGroup ? activeGroup.querySelector('.tab.active') : null;
    if (!activeTab || ['workspace', 'terminal', 'settings', 'profile'].includes(activeTab.dataset.type)) { if(window.showCustomModal) window.showCustomModal({title: 'Notice', text: 'Cannot "Save As" for this tab type.', submitText: 'OK'}, ()=>{}); return; }
    const fileId = activeTab.dataset.fileId; if (!fileId) return;
    const tx = db.transaction('filesystem', 'readonly');
    tx.objectStore('filesystem').get(fileId).onsuccess = (e) => {
        const originalFile = e.target.result;
        if (originalFile && window.showCustomModal) {
            window.showCustomModal({ title: 'Save As', inputType: 'text', inputValue: 'copy_' + originalFile.name, submitText: 'Save' }, (newName) => {
                const trimmedName = newName.trim();
                if(trimmedName) {
                    const newFile = { ...originalFile, id: Date.now().toString() + Math.random().toString(36).substring(2), name: trimmedName, timestamp: Date.now() };
                    const activePane = document.getElementById(activeTab.dataset.target);
                    if (activeTab.dataset.type === 'monaco' && window.monaco) {
                        const editor = window.monaco.editor.getEditors().find(e => activePane.querySelector('[id^="editor-container-"]').contains(e.getContainerDomNode()));
                        if (editor) newFile.content = editor.getValue();
                    } else if (['notebook', 'java-notebook'].includes(activeTab.dataset.type)) {
                        // Clone first (never mutate the live pane) and strip the
                        // shared .editor-breadcrumb div createNewTab injects
                        // outside the notebook's own markup - same reasoning as
                        // triggerNotebookSave's identical strip in notebook-ui.js,
                        // otherwise "Save As" bakes it into the new copy too.
                        const paneClone = activePane.cloneNode(true);
                        paneClone.querySelectorAll('.editor-breadcrumb').forEach(el => el.remove());
                        newFile.content = paneClone.innerHTML;
                    }
                    // Note: 'pdf' tabs are intentionally excluded above - a PDF's pane
                    // holds rendered <canvas> pages, not editable/serializable markup,
                    // so Save As instead keeps the real bytes already copied via the
                    // {...originalFile} spread a few lines up.
                    if(typeof saveFileToDB === 'function') saveFileToDB(newFile); 
                    if(typeof openFileInTab === 'function') openFileInTab(newFile); 
                    if(typeof closeGenModal === 'function') closeGenModal();
                }
            });
        }
    };
    document.getElementById('moreDropdown').classList.remove('show');
});

document.getElementById('menuSaveAll')?.addEventListener('click', () => { if(typeof window.saveAllUnsavedTabs === 'function') window.saveAllUnsavedTabs(); document.getElementById('moreDropdown').classList.remove('show'); });

document.getElementById('menuCloseAll')?.addEventListener('click', () => { 
    const activeGroup = document.getElementById(activeGroupId || 'editorGroup1');
    if (activeGroup) {
        Array.from(activeGroup.querySelectorAll('.tab')).forEach(tab => { 
            const closeBtn = tab.querySelector('.tab-close'); 
            if (closeBtn) closeBtn.click(); 
        });
    }
    document.getElementById('moreDropdown').classList.remove('show'); 
});

document.getElementById('menuCloseSaved')?.addEventListener('click', () => { 
    const activeGroup = document.getElementById(activeGroupId || 'editorGroup1');
    if (activeGroup) {
        Array.from(activeGroup.querySelectorAll('.tab:not(.unsaved-blink)')).forEach(tab => { 
            const closeBtn = tab.querySelector('.tab-close'); 
            if (closeBtn) closeBtn.click(); 
        });
    }
    document.getElementById('moreDropdown').classList.remove('show'); 
});

document.getElementById('menuGroupTabs')?.addEventListener('click', () => {
    const activeGroup = document.getElementById(activeGroupId || 'editorGroup1');
    if (activeGroup) {
        const tabsBar = activeGroup.querySelector('.tabs-bar'); 
        const tabs = Array.from(tabsBar.querySelectorAll('.tab')); 
        const addBtn = tabsBar.querySelector('.add-tab');
        tabs.sort((a, b) => {
            const getExt = t => { if(t.dataset.type === 'workspace') return '0'; if(t.dataset.type === 'terminal') return '1'; let name = t.querySelector('span').textContent; return name.includes('.') ? name.split('.').pop() : name; };
            return getExt(a).localeCompare(getExt(b));
        });
        tabs.forEach(t => tabsBar.insertBefore(t, addBtn)); 
    }
    document.getElementById('moreDropdown').classList.remove('show');
});

// Help & Feedback tab logic now lives in help-feedback.js

// ==========================================
// Custom Drag & Drop Manager for Tabs, Activity & Explorer
// ==========================================

const activityMeta = {
    'folderIconItem': { icon: 'ri-folder-4-line', name: 'Explorer' },
    'searchIconItem': { icon: 'ri-search-2-line', name: 'Search' },
    'stackIconItem': { icon: 'ri-stack-line', name: 'Stacks' },
    'playIconItem': { icon: 'ri-play-line', name: 'Preview' },
    'extensionIconItem': { icon: 'ri-plug-line', name: 'Extensions' },
    'terminalIconItem': { icon: 'ri-terminal-window-line', name: 'Terminal' },
    'menuDatabase': { icon: 'ri-database-2-line', name: 'Database' },
    'menuAgent': { isSvg: true, icon: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="color: var(--icon-gray);"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>', name: 'Agent Mini' },
    'menuCollab': { icon: 'ri-group-line', name: 'Live Collab' },
    'menuSource': { icon: 'ri-git-branch-line', name: 'Source Control' }
};

function convertToActivityItem(el) {
    if (!el || el.classList.contains('activity-item')) return;
    const id = el.id || (activeDrag && activeDrag.el ? activeDrag.el.id : null);
    if (!activityMeta[id]) return;
    el.className = 'activity-item' + (el.classList.contains('drag-placeholder') ? ' drag-placeholder' : '');
    el.innerHTML = activityMeta[id].isSvg ? activityMeta[id].icon : `<i class="${activityMeta[id].icon}" title="${activityMeta[id].name}"></i>`;
    if (activityMeta[id].isSvg) {
        const svg = el.querySelector('svg');
        if (svg) svg.setAttribute('title', activityMeta[id].name);
    }
}

function convertToDropdownItem(el) {
    if (!el || el.classList.contains('dropdown-item')) return;
    const id = el.id || (activeDrag && activeDrag.el ? activeDrag.el.id : null);
    if (!activityMeta[id]) return;
    el.className = 'dropdown-item' + (el.classList.contains('drag-placeholder') ? ' drag-placeholder' : '');
    el.innerHTML = activityMeta[id].isSvg ? `${activityMeta[id].icon} ${activityMeta[id].name}` : `<i class="${activityMeta[id].icon}"></i> ${activityMeta[id].name}`;
}

function createActivityElement(id, type) {
    const meta = activityMeta[id];
    const el = document.createElement('div');
    el.id = id;
    if (type === 'activity') {
        el.className = 'activity-item';
        el.innerHTML = meta.isSvg ? meta.icon : `<i class="${meta.icon}" title="${meta.name}"></i>`;
        if (meta.isSvg) {
            const svg = el.querySelector('svg');
            if (svg) svg.setAttribute('title', meta.name);
        }
    } else {
        el.className = 'dropdown-item';
        el.innerHTML = meta.isSvg ? `${meta.icon} ${meta.name}` : `<i class="${meta.icon}"></i> ${meta.name}`;
    }
    return el;
}

window.saveActivityState = function() {
    const topContainer = document.querySelector('.activity-top');
    const dropContainer = document.getElementById('mainMenuDropdown');
    if (!topContainer || !dropContainer) return;
    const winId = localStorage.getItem('codemini_active_window') || 'win_default';
    
    const topIds = Array.from(topContainer.children).map(el => el.id).filter(id => id && id !== 'mainMenuBtnItem');
    const dropIds = Array.from(dropContainer.children).map(el => el.id).filter(id => id);
        
    localStorage.setItem(`codemini_activity_state_${winId}`, JSON.stringify({ top: topIds, drop: dropIds }));
}

window.restoreActivityState = function() {
    const winId = localStorage.getItem('codemini_active_window') || 'win_default';
    const stateStr = localStorage.getItem(`codemini_activity_state_${winId}`);
    const topContainer = document.querySelector('.activity-top');
    const dropContainer = document.getElementById('mainMenuDropdown');
    if (!topContainer || !dropContainer) return;

    const allElements = {};
    [...topContainer.children, ...dropContainer.children].forEach(el => {
        if (el.id && el.id !== 'mainMenuBtnItem') allElements[el.id] = el;
    });

    let topIds = ['folderIconItem', 'searchIconItem', 'stackIconItem', 'playIconItem', 'extensionIconItem', 'terminalIconItem'];
    let dropIds = ['menuAgent', 'menuCollab', 'menuDatabase', 'menuSource'];

    if (stateStr) {
        try {
            const state = JSON.parse(stateStr);
            if (state.top && state.drop) {
                topIds = state.top;
                dropIds = state.drop;
            }
        } catch(e) {}
    }

    // Isolate by clearing all children except the main menu button
    Array.from(topContainer.children).forEach(child => {
        if (child.id !== 'mainMenuBtnItem') topContainer.removeChild(child);
    });
    dropContainer.innerHTML = '';

    // Rebuild order
    topIds.forEach(id => {
        let el = allElements[id] || createActivityElement(id, 'activity');
        convertToActivityItem(el);
        topContainer.appendChild(el);
    });

    dropIds.forEach(id => {
        let el = allElements[id] || createActivityElement(id, 'dropdown');
        convertToDropdownItem(el);
        dropContainer.appendChild(el);
    });
}

window.moveFileInDB = function(fileId, newParentId) {
    if (!db) return;
    const tx = db.transaction('filesystem', 'readwrite');
    const store = tx.objectStore('filesystem');
    
    store.getAll().onsuccess = (ev) => {
        const allFiles = ev.target.result || [];
        const file = allFiles.find(f => f.id === fileId);
        
        if (file && file.parentId !== newParentId) {
            if (file.id === newParentId) return;
            
            // Fix: Check for duplicate names in the target location and auto-number
            file.name = window.getUniqueFileName(allFiles, newParentId, file.name, file.type);
            file.parentId = newParentId;
            file.timestamp = Date.now();
            
            store.put(file).onsuccess = () => {
                if (typeof loadFilesFromDB === 'function') loadFilesFromDB();
                if (typeof window.refreshAllOpenBreadcrumbs === 'function') window.refreshAllOpenBreadcrumbs();
            };
        }
    };
};


const dndStyle = document.createElement('style');
dndStyle.innerHTML = `
    .file-item.drag-over { background-color: var(--hover-blue) !important; border-left: 3px solid var(--accent-blue) !important; }
    #fileBrowserPath.drag-over { background-color: var(--hover-blue) !important; border-radius: 4px; }
`;
document.head.appendChild(dndStyle);

let activeDrag = null;
let suppressNextClick = false;
let dragTimer = null;
const HOLD_DURATION = 400;

document.addEventListener('click', (e) => {
    if (suppressNextClick) {
        e.stopPropagation();
        e.preventDefault();
    }
}, true);

document.addEventListener('contextmenu', (e) => {
    if (activeDrag && activeDrag.isLongPressed) {
        e.preventDefault();
    }
});

function createDragState(e, targetEl) {
    let type = 'unknown';
    if (targetEl.classList.contains('window-tab')) type = 'window';
    else if (targetEl.classList.contains('tab')) type = 'editor';
    else if (targetEl.classList.contains('activity-item')) type = 'activity';
    else if (targetEl.classList.contains('dropdown-item')) type = 'activity-dropdown';
    else if (targetEl.classList.contains('file-item')) type = 'file';

    return {
        el: targetEl,
        type: type,
        startX: e.clientX,
        startY: e.clientY,
        isDragging: false,
        isLongPressed: false,
        clone: null,
        placeholder: null,
        sourceGroup: targetEl.closest('.editor-group'),
        offsetX: 0,
        offsetY: 0,
        scrollContainer: null
    };
}

document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return; 
    
    let target = e.target.closest('.tab:not(.add-tab)') || e.target.closest('.window-tab') || 
                 e.target.closest('.activity-top .activity-item:not(#mainMenuBtnItem)') || 
                 e.target.closest('#mainMenuDropdown .dropdown-item') ||
                 e.target.closest('.file-item');
    if (!target) return;
    if (e.target.closest('.tab-close') || e.target.closest('.ri-pencil-line') || e.target.closest('.window-tab-more-icon') || e.target.closest('.tree-toggle-icon')) return; 

    activeDrag = createDragState(e, target);
    
    dragTimer = setTimeout(() => {
        if (activeDrag) {
            activeDrag.isLongPressed = true;
            activeDrag.el.classList.add('ready-to-drag');
            
            const scrollContainer = activeDrag.el.closest('.tabs-bar, .window-bar');
            if (scrollContainer) {
                activeDrag.scrollContainer = scrollContainer;
                scrollContainer.style.overflowX = 'hidden'; 
            }

            try { activeDrag.el.setPointerCapture(e.pointerId); } catch(err) {}
        }
    }, HOLD_DURATION);
});

document.addEventListener('pointermove', (e) => {
    if (!activeDrag) return;

    if (!activeDrag.isLongPressed) {
        if (Math.abs(e.clientX - activeDrag.startX) > 10 || Math.abs(e.clientY - activeDrag.startY) > 10) {
            clearTimeout(dragTimer);
            activeDrag = null;
        }
        return;
    }

    if (!activeDrag.isDragging) {
        if (Math.abs(e.clientX - activeDrag.startX) > 5 || Math.abs(e.clientY - activeDrag.startY) > 5) {
            activeDrag.isDragging = true;
            activeDrag.el.classList.remove('ready-to-drag');
            
            const rect = activeDrag.el.getBoundingClientRect();
            activeDrag.offsetX = e.clientX - rect.left;
            activeDrag.offsetY = e.clientY - rect.top;
            
            activeDrag.clone = activeDrag.el.cloneNode(true);
            activeDrag.clone.style.position = 'fixed';
            activeDrag.clone.style.zIndex = '100000';
            activeDrag.clone.style.pointerEvents = 'none';
            activeDrag.clone.style.opacity = '0.9';
            activeDrag.clone.style.boxShadow = '0 5px 15px var(--shadow-color)';
            activeDrag.clone.style.margin = '0';
            activeDrag.clone.style.transition = 'none';
            activeDrag.clone.style.width = rect.width + 'px';
            document.body.appendChild(activeDrag.clone);
            
            activeDrag.placeholder = document.createElement('div');
            activeDrag.placeholder.className = activeDrag.el.className + ' drag-placeholder';
            activeDrag.placeholder.id = activeDrag.el.id; 
            activeDrag.placeholder.style.width = rect.width + 'px';
            activeDrag.placeholder.style.height = rect.height + 'px';
            activeDrag.placeholder.style.background = 'rgba(0,0,0,0.05)';
            activeDrag.placeholder.style.border = '1px dashed var(--accent-blue)';
            activeDrag.placeholder.style.opacity = '0.5';
            activeDrag.placeholder.innerHTML = '';
            
            activeDrag.el.style.display = 'none'; 
            activeDrag.el.parentNode.insertBefore(activeDrag.placeholder, activeDrag.el);
        }
    }
    
    if (activeDrag.isDragging) {
        activeDrag.clone.style.left = (e.clientX - activeDrag.offsetX) + 'px';
        activeDrag.clone.style.top = (e.clientY - activeDrag.offsetY) + 'px';
        
        activeDrag.clone.style.display = 'none';
        const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
        activeDrag.clone.style.display = '';
        
        if (!dropTarget) return;

        if (activeDrag.type === 'file') {
            document.querySelectorAll('.file-item.drag-over, #fileBrowserPath.drag-over').forEach(el => el.classList.remove('drag-over'));
            const folderTarget = dropTarget.closest('.file-item[data-type="folder"], .file-item[data-type="workspace"]');
            if (folderTarget && folderTarget !== activeDrag.el) folderTarget.classList.add('drag-over');
            const pathTarget = dropTarget.closest('#fileBrowserPath');
            if (pathTarget) pathTarget.classList.add('drag-over');
        } else if (activeDrag.type === 'activity' || activeDrag.type === 'activity-dropdown') {
            const targetActivity = dropTarget.closest('.activity-top .activity-item:not(#mainMenuBtnItem):not(.drag-placeholder)');
            const targetDropdown = dropTarget.closest('#mainMenuDropdown .dropdown-item:not(.drag-placeholder)');
            const mainMenuBtn = dropTarget.closest('#mainMenuBtnItem');
            const activityTop = dropTarget.closest('.activity-top');
            const dropdownContainer = dropTarget.closest('#mainMenuDropdown');
            
            if ((targetDropdown || dropdownContainer || mainMenuBtn) && activeDrag.placeholder.classList.contains('activity-item')) {
                convertToDropdownItem(activeDrag.placeholder);
                activeDrag.placeholder.style.width = '100%';
                activeDrag.placeholder.style.height = 'auto';
            } else if ((targetActivity || (activityTop && !mainMenuBtn)) && activeDrag.placeholder.classList.contains('dropdown-item')) {
                convertToActivityItem(activeDrag.placeholder);
                activeDrag.placeholder.style.width = '45px';
                activeDrag.placeholder.style.height = '45px';
            }

            if (targetActivity && targetActivity !== activeDrag.el) {
                const rect = targetActivity.getBoundingClientRect();
                if (e.clientY < rect.top + rect.height / 2) {
                    targetActivity.parentNode.insertBefore(activeDrag.placeholder, targetActivity);
                } else {
                    targetActivity.parentNode.insertBefore(activeDrag.placeholder, targetActivity.nextSibling);
                }
            } else if (targetDropdown && targetDropdown !== activeDrag.el) {
                const rect = targetDropdown.getBoundingClientRect();
                if (e.clientY < rect.top + rect.height / 2) {
                    targetDropdown.parentNode.insertBefore(activeDrag.placeholder, targetDropdown);
                } else {
                    targetDropdown.parentNode.insertBefore(activeDrag.placeholder, targetDropdown.nextSibling);
                }
            } else if (mainMenuBtn) {
                const drop = document.getElementById('mainMenuDropdown');
                if (drop && !drop.contains(activeDrag.placeholder)) drop.appendChild(activeDrag.placeholder);
                if (drop) drop.classList.add('show');
            } else if (activityTop && !mainMenuBtn && !targetActivity) {
                activityTop.appendChild(activeDrag.placeholder);
            }
        } else if (activeDrag.type === 'window') {
            const targetTab = dropTarget.closest('.window-tab:not(.drag-placeholder)');
            const windowBar = dropTarget.closest('.window-bar');
            
            if (targetTab && targetTab !== activeDrag.el) {
                const rect = targetTab.getBoundingClientRect();
                const mid = rect.left + rect.width / 2;
                if (e.clientX < mid) {
                    targetTab.parentNode.insertBefore(activeDrag.placeholder, targetTab);
                } else {
                    targetTab.parentNode.insertBefore(activeDrag.placeholder, targetTab.nextSibling);
                }
            } else if (windowBar && !targetTab) {
                windowBar.appendChild(activeDrag.placeholder);
            }
        } else if (activeDrag.type === 'editor') {
            const targetTab = dropTarget.closest('.tab:not(.add-tab):not(.drag-placeholder)');
            const tabsBar = dropTarget.closest('.tabs-bar');
            const editorGroup = dropTarget.closest('.editor-group');
            
            if (targetTab && targetTab !== activeDrag.el) {
                const rect = targetTab.getBoundingClientRect();
                const mid = rect.left + rect.width / 2;
                if (e.clientX < mid) {
                    targetTab.parentNode.insertBefore(activeDrag.placeholder, targetTab);
                } else {
                    targetTab.parentNode.insertBefore(activeDrag.placeholder, targetTab.nextSibling);
                }
            } else if (tabsBar) {
                const addBtn = tabsBar.querySelector('.add-tab');
                if (addBtn) tabsBar.insertBefore(activeDrag.placeholder, addBtn);
                else tabsBar.appendChild(activeDrag.placeholder);
            } else if (editorGroup && !tabsBar) {
                const targetTb = editorGroup.querySelector('.tabs-bar');
                if (targetTb) {
                    const addBtn = targetTb.querySelector('.add-tab');
                    if (addBtn && !targetTb.contains(activeDrag.placeholder)) {
                        targetTb.insertBefore(activeDrag.placeholder, addBtn);
                    }
                }
            }
        }
    }
});

function finalizeDragState(e) {
    if (!activeDrag) return;
    
    if (activeDrag.scrollContainer) {
        activeDrag.scrollContainer.style.overflowX = ''; 
    }
    
    if (activeDrag.el) activeDrag.el.classList.remove('ready-to-drag');
    
    if (activeDrag.isDragging) {
        suppressNextClick = true;
        setTimeout(() => suppressNextClick = false, 0);

        if(activeDrag.clone) activeDrag.clone.remove(); 
        
        if (activeDrag.type === 'file') {
            document.querySelectorAll('.file-item.drag-over, #fileBrowserPath.drag-over').forEach(el => el.classList.remove('drag-over'));
            activeDrag.placeholder.remove();
            activeDrag.el.style.display = '';

            const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
            if (dropTarget) {
                const folderTarget = dropTarget.closest('.file-item[data-type="folder"], .file-item[data-type="workspace"]');
                const rootTarget = dropTarget.closest('#fileBrowserPath') || dropTarget.closest('.file-browser-list');
                const tabTarget = dropTarget.closest('.tabs-bar') || dropTarget.closest('.panes-container');
                const editorGroup = dropTarget.closest('.editor-group');
                
                const draggedFileId = activeDrag.el.dataset.fileId;
                
                if (draggedFileId) {
                    if (tabTarget && activeDrag.el.dataset.type === 'file') {
                        const txGet = db.transaction('filesystem', 'readonly');
                        txGet.objectStore('filesystem').get(draggedFileId).onsuccess = (ev) => {
                            const file = ev.target.result;
                            if (file) {
                                if (editorGroup) {
                                    document.querySelectorAll('.editor-group').forEach(g => g.classList.remove('active-group'));
                                    editorGroup.classList.add('active-group');
                                    activeGroupId = editorGroup.id;
                                    window.activeGroupId = editorGroup.id;
                                }
                                if (typeof handleFileClick === 'function') handleFileClick(file, document.createElement('div'), []);
                            }
                        };
                    } else if (folderTarget && folderTarget !== activeDrag.el) {
                        window.moveFileInDB(draggedFileId, folderTarget.dataset.fileId);
                    } else if (rootTarget && !dropTarget.closest('.file-item')) {
                        // FIXED: Drop onto breadcrumb path (#fileBrowserPath) → move to explorer root (folderStack[0]).
                        // Drop onto the file list area (.file-browser-list) → move to current folder (folderStack last).
                        // This correctly handles both workspace roots and default roots.
                        const isBreadcrumbDrop = dropTarget.closest('#fileBrowserPath');
                        const targetParentId = isBreadcrumbDrop
                            ? folderStack[0].id
                            : folderStack[folderStack.length - 1].id;
                        window.moveFileInDB(draggedFileId, targetParentId);
                    }
                }
            }
        } else {
            if (activeDrag.placeholder && activeDrag.placeholder.parentNode) {
                activeDrag.placeholder.parentNode.insertBefore(activeDrag.el, activeDrag.placeholder);
                activeDrag.placeholder.remove();
            }
            if(activeDrag.el) activeDrag.el.style.display = '';

            if (activeDrag.type === 'activity' || activeDrag.type === 'activity-dropdown') {
                if (activeDrag.el.parentNode.id === 'mainMenuDropdown') {
                    convertToDropdownItem(activeDrag.el);
                } else {
                    convertToActivityItem(activeDrag.el);
                }
                window.saveActivityState();
            } else if (activeDrag.type === 'editor') {
                const newGroup = activeDrag.el.closest('.editor-group');
                const oldGroup = activeDrag.sourceGroup;
                
                if (newGroup !== oldGroup && newGroup) {
                    const paneId = activeDrag.el.dataset.target;
                    const pane = document.getElementById(paneId);
                    const draggedFileId = activeDrag.el.dataset.fileId;

                    // Guard against ending up with two tabs for the same file in one
                    // group (e.g. the file was already opened fresh in the target
                    // group before this drag). If that would happen, treat the drop
                    // as "switch to the existing tab" instead of creating a duplicate.
                    const duplicateTab = draggedFileId
                        ? Array.from(newGroup.querySelectorAll('.tab')).find(t => t !== activeDrag.el && t.dataset.fileId === draggedFileId)
                        : null;

                    if (duplicateTab) {
                        if (typeof closeTab === 'function') closeTab(activeDrag.el, pane, newGroup);
                        document.querySelectorAll('.editor-group').forEach(g => g.classList.remove('active-group'));
                        newGroup.classList.add('active-group');
                        activeGroupId = newGroup.id;
                        window.activeGroupId = newGroup.id;
                        if (typeof switchTab === 'function') switchTab(duplicateTab.dataset.target);
                        if (typeof window.showSuccessToast === 'function') {
                            window.showSuccessToast('That file is already open in this group - switched to it instead');
                        }
                    } else {
                        if (pane) {
                            newGroup.querySelector('.panes-container').appendChild(pane);
                        }
                        
                        document.querySelectorAll('.editor-group').forEach(g => g.classList.remove('active-group'));
                        newGroup.classList.add('active-group');
                        activeGroupId = newGroup.id;
                        window.activeGroupId = newGroup.id;
                        
                        if (typeof switchTab === 'function') switchTab(paneId);
                    }

                    // Dragging a tab out of a secondary group can leave it empty - same
                    // auto-collapse as closing the last tab there (see closeTab in
                    // editor.js), instead of stranding an empty orphaned pane. The
                    // group the user just dropped into (newGroup) stays active either way.
                    if (oldGroup && oldGroup.id !== 'editorGroup1' && oldGroup.querySelectorAll('.tab').length === 0 && document.getElementById('editorGroup1')) {
                        oldGroup.remove();
                        if (window.removeSplitResizer) window.removeSplitResizer();
                        if (window.saveCurrentUIState) window.saveCurrentUIState();
                    }
                }
                
                if (typeof updateOpenedTabsRegistry === 'function') updateOpenedTabsRegistry();
            } else if (activeDrag.type === 'window') {
                if (typeof cellWindows !== 'undefined') {
                    const newOrderDom = Array.from(document.querySelectorAll('.window-tab:not(.drag-placeholder)'));
                    const newOrderIds = newOrderDom.map(el => el.dataset.id).filter(id => id);
                    if (newOrderIds.length > 0) {
                        cellWindows.sort((a, b) => {
                            let idxA = newOrderIds.indexOf(a.id);
                            let idxB = newOrderIds.indexOf(b.id);
                            if(idxA === -1) idxA = 999;
                            if(idxB === -1) idxB = 999;
                            return idxA - idxB;
                        });
                        localStorage.setItem('codemini_windows', JSON.stringify(cellWindows));
                    }
                }
            }
        }
    }
    
    try { if(activeDrag.el) activeDrag.el.releasePointerCapture(e.pointerId); } catch(err) {}
    activeDrag = null;
}

document.addEventListener('pointerup', finalizeDragState);
document.addEventListener('pointercancel', finalizeDragState);