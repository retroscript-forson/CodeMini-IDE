// ==========================================
// search.js - Rebuilt for Split Views & Isolated Profiles
// ==========================================

(function initSearch() {
    const searchIconItem = document.getElementById('searchIconItem');
    const searchSidebar = document.getElementById('searchSidebar');
    const closeSearchBtn = document.getElementById('closeSearchBtn');
    
    const searchInput = document.getElementById('globalSearchInput');
    const replaceInput = document.getElementById('globalReplaceInput');
    const runSearchBtn = document.getElementById('runSearchBtn');
    const runReplaceBtn = document.getElementById('runReplaceBtn');
    const searchResultsContainer = document.getElementById('searchResultsContainer');
    const searchInputGroup = document.querySelector('.search-input-group');

    // --- 1. Inject Styles ---
    if (!document.getElementById('search-injected-styles')) {
        const searchStyles = document.createElement('style');
        searchStyles.id = 'search-injected-styles';
        searchStyles.innerHTML = `
            .search-controls-row { display: flex; gap: 4px; margin-bottom: 6px; align-items: center; }
            .search-opt-btn { background: var(--bg-white); border: 1px solid var(--border-color); color: var(--icon-gray); border-radius: 2px; padding: 2px 6px; cursor: pointer; font-size: 11px; font-family: var(--font-mono); transition: 0.2s; display: flex; align-items: center; justify-content: center; height: 22px; flex-shrink: 0; }
            .search-opt-btn:hover { background: var(--bg-panel); color: var(--text-main); }
            .search-opt-btn.active { background: var(--accent-blue); color: white; border-color: var(--accent-blue); }
            .search-nav-btn { background: var(--bg-white); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 2px; width: 22px; height: 22px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; flex-shrink: 0; }
            .search-nav-btn:hover { background: var(--bg-panel); }
            .match-count { font-size: 11px; color: var(--text-muted); margin-left: auto; padding-right: 2px; white-space: nowrap; flex-shrink: 0; }
            
            .search-highlight { background-color: rgba(255, 255, 0, 0.25); border-bottom: 2px solid rgba(255, 220, 0, 0.6); }
            .search-highlight-active { background-color: rgba(255, 140, 0, 0.45) !important; border: 1px solid darkorange !important; box-sizing: border-box; }
            
            .mobile-search-bar { display: none; flex-direction: column; padding: 8px 10px; background: var(--bg-white); border-bottom: 1px solid var(--border-color); width: 100%; box-sizing: border-box; flex-shrink: 0; }
            .mobile-search-bar.active { display: flex; }
            .ms-row { display: flex; gap: 6px; align-items: center; width: 100%; }
            .ms-row-top { margin-bottom: 6px; }
            .mobile-search-input { flex: 1; border: 1px solid var(--border-color); padding: 6px 8px; border-radius: 2px; outline: none; background: var(--bg-panel); color: var(--text-main); font-size: 13px; font-family: var(--font-main); transition: border-color 0.2s; min-width: 0; }
            .mobile-search-input:focus { border-color: var(--accent-blue); }
            .ms-btn-group { display: flex; gap: 4px; align-items: center; flex-shrink: 0; }
            .ms-match-count { min-width: 45px; text-align: right; }
            .ms-replace-btn { background: var(--accent-blue); color: white; border: none; padding: 6px 12px; border-radius: 2px; cursor: pointer; font-size: 12px; font-weight: 600; flex-shrink: 0; transition: opacity 0.2s; }
            .ms-replace-btn:hover { opacity: 0.9; }
            
            @media (min-width: 769px) { .mobile-search-bar { display: none !important; } }
        `;
        document.head.appendChild(searchStyles);
    }

    if (searchInputGroup && !document.getElementById('optCaseBtn')) {
        const controlsRow = document.createElement('div');
        controlsRow.className = 'search-controls-row';
        controlsRow.innerHTML = `
            <button id="optCaseBtn" class="search-opt-btn" title="Match Case">Aa</button>
            <button id="optWordBtn" class="search-opt-btn" title="Match Whole Word">ab</button>
            <button id="optRegexBtn" class="search-opt-btn" title="Use Regular Expression">.*</button>
            <span class="match-count" id="searchMatchCount"></span>
            <button id="navPrevBtn" class="search-nav-btn" title="Previous Match (Shift+Enter)"><i class="ri-arrow-up-line"></i></button>
            <button id="navNextBtn" class="search-nav-btn" title="Next Match (Enter)"><i class="ri-arrow-down-line"></i></button>
        `;
        searchInputGroup.insertBefore(controlsRow, searchInput);
    }

    // --- 2. Core Profile/Window State Isolation ---
    window._codeminiSearchState = window._codeminiSearchState || {};

    function getWinId() {
        return typeof cellActiveWinId !== 'undefined' ? cellActiveWinId : (localStorage.getItem('codemini_active_window') || 'win_default');
    }

    function getDbName() {
        return (typeof cellActiveWindow !== 'undefined' && cellActiveWindow.db) ? cellActiveWindow.db : "CodeMiniDB";
    }

    function getState() {
        const wid = getWinId();
        if (!window._codeminiSearchState[wid]) {
            window._codeminiSearchState[wid] = {
                opts: { caseSensitive: false, wholeWord: false, regex: false },
                activeMatches: [],
                currentMatchIndex: -1,
                lastQuery: '',
                decorationsMap: {} 
            };
        }
        return window._codeminiSearchState[wid];
    }

    // --- 3. Split View Aware Editor Acquisition ---
    function isSearchableEditor(editor) {
        const domNode = editor.getContainerDomNode();
        if (!domNode) return false;
        const pane = domNode.closest('.content-pane');
        if (!pane) return false;
        
        const tab = document.querySelector(`.tab[data-target="${pane.id}"]`);
        if (!tab || tab.dataset.type === 'notebook' || tab.dataset.type === 'monaco-cell') return false;
        return true;
    }

    function getActiveMonacoEditor() {
        if (!window.monaco) return null;
        const editors = window.monaco.editor.getEditors().filter(isSearchableEditor);
        if (editors.length === 0) return null;

        // Priority 1: Editor directly focused by the user right now
        const focused = editors.find(e => e.hasTextFocus() || e.hasWidgetFocus());
        if (focused) return focused;

        // Priority 2: The actively selected split-view group
        const activeGroup = document.querySelector('.editor-group.active-group') || document.querySelector('.editor-group');
        if (!activeGroup) return null;
        
        const activePane = activeGroup.querySelector('.content-pane.active');
        if (!activePane) return null;

        const container = activePane.querySelector('[id^="editor-container-"]');
        if (!container) return null;

        return editors.find(e => container.contains(e.getContainerDomNode())) || null;
    }

    // --- 4. Decoration Management ---
    function getDecorationsCollection(editor, state) {
        const id = editor.getId();
        if (!state.decorationsMap[id]) {
            state.decorationsMap[id] = editor.createDecorationsCollection ? editor.createDecorationsCollection() : {
                ids: [],
                set: function(decs) { this.ids = editor.deltaDecorations(this.ids, decs); },
                clear: function() { this.ids = editor.deltaDecorations(this.ids, []); }
            };
        }
        return state.decorationsMap[id];
    }

    function clearAllDecorations(state) {
        if (!window.monaco) return;
        window.monaco.editor.getEditors().forEach(ed => {
            if (state.decorationsMap[ed.getId()]) {
                state.decorationsMap[ed.getId()].clear();
            }
        });
    }

    // --- 5. Local Search Execution ---
    function updateLocalSearch(query) {
        const state = getState();
        state.lastQuery = query;
        clearAllDecorations(state);
        state.activeMatches = [];
        state.currentMatchIndex = -1;

        const countDisplay = document.getElementById('searchMatchCount');
        
        const updateCount = (text) => {
            if (countDisplay) countDisplay.textContent = text;
            document.querySelectorAll('.ms-match-count').forEach(el => el.textContent = text);
        };

        if (!query) {
            updateCount('');
            return;
        }

        const editor = getActiveMonacoEditor();
        if (!editor) {
            updateCount('0 of 0');
            return;
        }

        const model = editor.getModel();
        if (!model) return;

        const { caseSensitive, wholeWord, regex } = state.opts;
        const wordSeparators = wholeWord ? ' \n\r\t()[]{}<>`~!@#$%^&*-=+\\|;:\'",./?' : null;

        try {
            state.activeMatches = model.findMatches(query, false, regex, caseSensitive, wordSeparators, false);
        } catch (e) {
            state.activeMatches = [];
        }

        if (state.activeMatches.length > 0) {
            state.currentMatchIndex = 0;
            renderEditorHighlights(editor, state);
            updateCount(`1 of ${state.activeMatches.length}`);
            editor.revealRangeInCenterIfOutsideViewport(state.activeMatches[0].range);
        } else {
            updateCount('0 of 0');
        }
    }

    function renderEditorHighlights(editor, state) {
        const collection = getDecorationsCollection(editor, state);
        const decs = state.activeMatches.map((m, idx) => ({
            range: m.range,
            options: {
                inlineClassName: idx === state.currentMatchIndex ? 'search-highlight-active' : 'search-highlight',
                stickiness: 1
            }
        }));
        collection.set(decs);
    }

    function navigateLocalSearch(direction) {
        const state = getState();
        if (state.activeMatches.length === 0) return;

        state.currentMatchIndex += direction;
        if (state.currentMatchIndex >= state.activeMatches.length) state.currentMatchIndex = 0;
        if (state.currentMatchIndex < 0) state.currentMatchIndex = state.activeMatches.length - 1;

        const editor = getActiveMonacoEditor();
        if (editor) {
            renderEditorHighlights(editor, state);
            editor.revealRangeInCenterIfOutsideViewport(state.activeMatches[state.currentMatchIndex].range);
        }

        const text = `${state.currentMatchIndex + 1} of ${state.activeMatches.length}`;
        const countDisplay = document.getElementById('searchMatchCount');
        if (countDisplay) countDisplay.textContent = text;
        document.querySelectorAll('.ms-match-count').forEach(el => el.textContent = text);
    }

    function replaceAllLocal(replaceVal) {
        const state = getState();
        const editor = getActiveMonacoEditor();
        if (!editor || state.activeMatches.length === 0) return;

        const operations = state.activeMatches.map(match => ({ range: match.range, text: replaceVal }));
        editor.executeEdits("search-replace", operations);
        
        const boundPane = editor.getContainerDomNode().closest('.content-pane');
        if (boundPane) {
            const tabElement = document.querySelector(`.tab[data-target="${boundPane.id}"]`);
            if (tabElement && typeof window.autoSaveFile === 'function') {
                window.autoSaveFile(tabElement.dataset.fileId, editor.getValue(), tabElement);
            }
        }
        updateLocalSearch(state.lastQuery);
    }

    // --- 6. Global Search (IndexedDB) ---
    function runGlobalSearch(query) {
        const container = document.getElementById('searchResultsContainer');
        if (!container) return;
        
        if (!query) {
            container.innerHTML = '<div class="empty-state">Enter a search term.</div>';
            return;
        }

        const state = getState();
        let regexObj;
        try {
            let pattern = query;
            if (!state.opts.regex) pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (state.opts.wholeWord) pattern = `\\b${pattern}\\b`;
            regexObj = new RegExp(pattern, state.opts.caseSensitive ? 'g' : 'gi');
        } catch (e) {
            container.innerHTML = '<div class="empty-state" style="color:var(--color-danger)">Invalid Regular Expression</div>';
            return;
        }

        container.innerHTML = '<div class="empty-state"><i class="ri-loader-4-line" style="animation: spinStatus 0.8s linear infinite;"></i> Searching...</div>';

        const dbName = getDbName();
        const request = indexedDB.open(dbName, 3);
        
        request.onsuccess = (e) => {
            const dbInstance = e.target.result;
            if (!dbInstance.objectStoreNames.contains('filesystem')) {
                container.innerHTML = '<div class="empty-state">Filesystem not found.</div>';
                return;
            }
            const tx = dbInstance.transaction('filesystem', 'readonly');
            tx.objectStore('filesystem').getAll().onsuccess = (req) => {
                const files = req.target.result;
                const matches = [];

                files.forEach(file => {
                    if (file.type === 'file' && file.content && !file.isLocked) {
                        if (file.name.match(/\.(ipynb|irnb|sqlnb)$/i)) return; 
                        
                        regexObj.lastIndex = 0;
                        const match = regexObj.exec(file.content);
                        if (match) {
                            const start = Math.max(0, match.index - 20);
                            const end = Math.min(file.content.length, match.index + match[0].length + 20);
                            let snippet = file.content.substring(start, end).replace(/\n/g, ' ');
                            matches.push({ file, snippet, matchText: match[0] });
                        }
                    }
                });

                if (matches.length === 0) {
                    container.innerHTML = '<div class="empty-state">No results found.</div>';
                } else {
                    container.innerHTML = '';
                    matches.forEach(matchData => {
                        const div = document.createElement('div');
                        div.className = 'search-result-item';
                        
                        const safeSnippet = matchData.snippet.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        const safeMatch = matchData.matchText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        const highlightRegex = new RegExp(safeMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), state.opts.caseSensitive ? 'g' : 'gi');
                        const highlightedSnippet = safeSnippet.replace(highlightRegex, `<span class="search-highlight">$&</span>`);
                        
                        // Generate dynamic mapped icon and style based on file type
                        const fileIconHTML = typeof getFileIconHTML === 'function' ? getFileIconHTML(matchData.file.name) : '<i class="ri-file-text-line"></i>';

                        div.innerHTML = `
                            <div class="search-result-file" style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                                ${fileIconHTML}
                                <span style="font-family: var(--font-main); color: var(--text-main); font-weight: 600;">${matchData.file.name}</span>
                            </div>
                            <div class="search-result-match">...${highlightedSnippet}...</div>
                        `;
                        div.addEventListener('click', () => {
                            if (typeof openFileInTab === 'function') {
                                openFileInTab(matchData.file);
                                setTimeout(() => {
                                    if (document.getElementById('globalSearchInput')) {
                                        document.getElementById('globalSearchInput').value = query;
                                        updateLocalSearch(query);
                                    }
                                }, 300);
                            }
                        });
                        container.appendChild(div);
                    });
                }
            };
        };
    }

    // --- 7. Mobile UI Component ---
    function injectMobileSearchBar() {
        const activeGroup = document.querySelector('.editor-group.active-group') || document.querySelector('.editor-group') || document.getElementById('editorGroup1');
        if (!activeGroup) return null;

        const existing = activeGroup.querySelector('.mobile-search-bar');
        if (existing) return existing;

        const tabsBar = activeGroup.querySelector('.tabs-bar');
        const searchBar = document.createElement('div');
        searchBar.className = 'mobile-search-bar';
        searchBar.innerHTML = `
            <div class="ms-row ms-row-top">
                <input type="text" class="mobile-search-input ms-search-input" placeholder="Search tab...">
                <div class="ms-btn-group">
                    <span class="match-count ms-match-count"></span>
                    <button class="search-opt-btn ms-case-btn" title="Match Case">Aa</button>
                    <button class="search-nav-btn ms-prev-btn"><i class="ri-arrow-up-line"></i></button>
                    <button class="search-nav-btn ms-next-btn"><i class="ri-arrow-down-line"></i></button>
                    <button class="search-nav-btn ms-close-btn" style="color: var(--color-danger);"><i class="ri-close-line"></i></button>
                </div>
            </div>
            <div class="ms-row">
                <input type="text" class="mobile-search-input ms-replace-input" placeholder="Replace with...">
                <button class="ms-replace-btn">Replace All</button>
            </div>
        `;
        
        if (tabsBar) tabsBar.parentNode.insertBefore(searchBar, tabsBar.nextSibling);
        else activeGroup.appendChild(searchBar);

        const msInput = searchBar.querySelector('.ms-search-input');
        const msReplaceInput = searchBar.querySelector('.ms-replace-input');
        
        msInput.addEventListener('input', () => updateLocalSearch(msInput.value));
        msInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') navigateLocalSearch(e.shiftKey ? -1 : 1);
        });

        searchBar.querySelector('.ms-case-btn').addEventListener('click', function() {
            this.classList.toggle('active');
            getState().opts.caseSensitive = !getState().opts.caseSensitive;
            updateLocalSearch(msInput.value);
        });

        searchBar.querySelector('.ms-prev-btn').addEventListener('click', () => navigateLocalSearch(-1));
        searchBar.querySelector('.ms-next-btn').addEventListener('click', () => navigateLocalSearch(1));
        
        searchBar.querySelector('.ms-close-btn').addEventListener('click', () => {
            searchBar.classList.remove('active');
            msInput.value = '';
            msReplaceInput.value = '';
            updateLocalSearch('');
            if (window.saveCurrentUIState) window.saveCurrentUIState();
        });

        searchBar.querySelector('.ms-replace-btn').addEventListener('click', () => {
            replaceAllLocal(msReplaceInput.value);
        });

        return searchBar;
    }

    // --- 8. Event Listeners & UI Binding ---
    if (searchIconItem) {
        searchIconItem.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                if (window.closeAllSidebars) window.closeAllSidebars();
                const bar = injectMobileSearchBar();
                if (bar) {
                    bar.classList.toggle('active');
                    if (bar.classList.contains('active')) {
                        setTimeout(() => bar.querySelector('.ms-search-input').focus(), 50);
                        updateLocalSearch(bar.querySelector('.ms-search-input').value);
                    } else {
                        updateLocalSearch('');
                    }
                }
            } else {
                document.querySelectorAll('.mobile-search-bar').forEach(b => b.classList.remove('active'));
                const isOpen = searchSidebar.classList.contains('open');
                if (window.closeAllSidebars) window.closeAllSidebars();
                
                if (!isOpen && searchSidebar) {
                    searchSidebar.classList.add('open');
                    searchIconItem.classList.add('active');
                    if (searchInput) {
                        setTimeout(() => { searchInput.focus(); searchInput.select(); }, 100);
                        updateLocalSearch(searchInput.value.trim());
                    }
                }
            }
            if (window.saveCurrentUIState) window.saveCurrentUIState();
        });
    }

    if (closeSearchBtn) {
        closeSearchBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (replaceInput) replaceInput.value = '';
            if (searchResultsContainer) searchResultsContainer.innerHTML = '<div class="empty-state">No results</div>';
            updateLocalSearch(''); 
            searchSidebar.classList.remove('open');
            searchIconItem.classList.remove('active');
            if (window.saveCurrentUIState) window.saveCurrentUIState();
        });
    }

    if (document.getElementById('optCaseBtn')) {
        document.getElementById('optCaseBtn').addEventListener('click', function() { this.classList.toggle('active'); getState().opts.caseSensitive = !getState().opts.caseSensitive; updateLocalSearch(searchInput.value); });
        document.getElementById('optWordBtn').addEventListener('click', function() { this.classList.toggle('active'); getState().opts.wholeWord = !getState().opts.wholeWord; updateLocalSearch(searchInput.value); });
        document.getElementById('optRegexBtn').addEventListener('click', function() { this.classList.toggle('active'); getState().opts.regex = !getState().opts.regex; updateLocalSearch(searchInput.value); });

        document.getElementById('navPrevBtn').addEventListener('click', () => navigateLocalSearch(-1));
        document.getElementById('navNextBtn').addEventListener('click', () => navigateLocalSearch(1));

        if (searchInput) {
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    navigateLocalSearch(e.shiftKey ? -1 : 1);
                }
            });
            searchInput.addEventListener('input', () => {
                updateLocalSearch(searchInput.value);
            });
        }
    }

    if (runSearchBtn && searchInput) {
        runSearchBtn.addEventListener('click', () => {
            updateLocalSearch(searchInput.value); 
            runGlobalSearch(searchInput.value);
        });
    }

    if (runReplaceBtn && replaceInput) {
        runReplaceBtn.addEventListener('click', () => {
            replaceAllLocal(replaceInput.value);
        });
    }

    // --- 9. Split View Focus Tracker (Mutation Observer) ---
    const tabObserver = new MutationObserver((mutations) => {
        let needsUpdate = false;
        for (let m of mutations) {
            if (m.type === 'attributes' && m.attributeName === 'class') {
                if (m.target.classList.contains('content-pane') && m.target.classList.contains('active')) needsUpdate = true;
                if (m.target.classList.contains('editor-group') && m.target.classList.contains('active-group')) needsUpdate = true;
            }
        }
        if (needsUpdate) {
            setTimeout(() => {
                const q = getState().lastQuery;
                if (q) updateLocalSearch(q);
                else clearAllDecorations(getState());
            }, 100);
        }
    });

    setTimeout(() => {
        const layoutRoot = document.querySelector('.panes-container') || document.body;
        tabObserver.observe(layoutRoot, { attributes: true, subtree: true, attributeFilter: ['class'] });
    }, 500);

    // --- 10. Persistent UI Restoration Monkey-Patch ---
    const origSaveUI = window.saveCurrentUIState;
    window.saveCurrentUIState = function() {
        if (origSaveUI) { try { origSaveUI(); } catch (e) {} }
        const wid = getWinId();
        const msBar = document.querySelector('.editor-group.active-group .mobile-search-bar') || document.querySelector('.mobile-search-bar');
        const localState = {
            desktopSearch: searchInput ? searchInput.value : '',
            desktopReplace: replaceInput ? replaceInput.value : '',
            opts: getState().opts,
            mobileActive: msBar ? msBar.classList.contains('active') : false,
            mobileSearch: msBar ? msBar.querySelector('.ms-search-input')?.value || '' : '',
            mobileReplace: msBar ? msBar.querySelector('.ms-replace-input')?.value || '' : ''
        };
        localStorage.setItem(`codemini_search_store_${wid}`, JSON.stringify(localState));
    };

    const origRestoreUI = window.restoreCurrentUIState;
    window.restoreCurrentUIState = function() {
        if (origRestoreUI) { try { origRestoreUI(); } catch (e) {} }
        
        document.querySelectorAll('.mobile-search-bar').forEach(bar => bar.remove());
        clearAllDecorations(getState());
        
        const wid = getWinId();
        const saved = localStorage.getItem(`codemini_search_store_${wid}`);
        
        if (saved) {
            try {
                const localState = JSON.parse(saved);
                getState().opts = localState.opts || { caseSensitive: false, wholeWord: false, regex: false };
                
                const btnCase = document.getElementById('optCaseBtn');
                const btnWord = document.getElementById('optWordBtn');
                const btnRegex = document.getElementById('optRegexBtn');
                if (btnCase) btnCase.classList.toggle('active', getState().opts.caseSensitive);
                if (btnWord) btnWord.classList.toggle('active', getState().opts.wholeWord);
                if (btnRegex) btnRegex.classList.toggle('active', getState().opts.regex);
                
                if (searchInput) searchInput.value = localState.desktopSearch || '';
                if (replaceInput) replaceInput.value = localState.desktopReplace || '';
                
                if (localState.mobileActive && window.innerWidth <= 768) {
                    const bar = injectMobileSearchBar();
                    if (bar) {
                        bar.classList.add('active');
                        const msInput = bar.querySelector('.ms-search-input');
                        const msReplaceInput = bar.querySelector('.ms-replace-input');
                        if (msInput) msInput.value = localState.mobileSearch || '';
                        if (msReplaceInput) msReplaceInput.value = localState.mobileReplace || '';
                        if (bar.querySelector('.ms-case-btn')) bar.querySelector('.ms-case-btn').classList.toggle('active', getState().opts.caseSensitive);
                        setTimeout(() => updateLocalSearch(localState.mobileSearch || ''), 300);
                    }
                } else if (searchInput && searchInput.value && searchSidebar && searchSidebar.classList.contains('open')) {
                    setTimeout(() => updateLocalSearch(searchInput.value), 300);
                }
            } catch (e) {}
        }
    };
})();
