// ==========================================
// help-feedback.js
// ==========================================
// Help & Feedback tab: contact/feedback input, searchable help content.

(function () {

    // --- Feedback draft persistence -------------------------------------
    // Isolated profile windows must not see each other's drafts, and separate
    // (non-profile) windows share state like everything else in this app -
    // this mirrors the getPrefixedKey convention used in settings-profile.js.
    function _feedbackDraftKey() {
        const winId = typeof _getEditorWinId === 'function'
            ? _getEditorWinId()
            : (localStorage.getItem('codemini_active_window') || 'win_default');
        const windowsData = JSON.parse(localStorage.getItem('codemini_windows') || 'null') || [{ id: 'win_default', profile: false }];
        const activeWin = windowsData.find(w => w.id === winId) || windowsData[0];
        const syncProfiles = localStorage.getItem('codemini_syncProfileSettings') === 'true';
        return (activeWin && activeWin.profile && !syncProfiles)
            ? `codemini_${winId}_helpFeedbackDraft`
            : `codemini_helpFeedbackDraft`;
    }

    function _saveFeedbackDraft(value) {
        try { localStorage.setItem(_feedbackDraftKey(), value); } catch (e) { /* storage unavailable - draft just won't persist */ }
    }

    function _loadFeedbackDraft() {
        try { return localStorage.getItem(_feedbackDraftKey()) || ''; } catch (e) { return ''; }
    }

    function _clearFeedbackDraft() {
        try { localStorage.removeItem(_feedbackDraftKey()); } catch (e) { /* ignore */ }
    }

    // --- Help content model ----------------------------------------------
    // Each section is { title, icon, open, items: [{ term, body }] } so the
    // search bar can filter by matching against title + item text without
    // parsing rendered HTML.
    const HELP_SECTIONS = [
        {
            id: 'visual-indicators',
            title: 'Visual Indicators & States',
            icon: 'ri-eye-line',
            open: true,
            items: [
                { term: 'File tab blinking red (top border)', body: 'The file has unsaved changes.' },
                { term: 'File tab pulsing green (top border)', body: 'The file was just saved successfully.' },
                { term: 'Window tab solid red (top border)', body: 'There is at least one unsaved file somewhere in that window.' },
                { term: 'Window tab blinking yellow (top border)', body: 'The window is currently loading or initializing.' },
                { term: 'Breadcrumb path', body: 'Shows exactly where the open file lives, including which workspace it belongs to. Click any segment to jump there.' }
            ]
        },
        {
            id: 'file-management',
            title: 'File Management & Explorer',
            icon: 'ri-folder-2-line',
            open: false,
            items: [
                { term: 'Create / Rename / Delete', body: 'Use the left explorer sidebar toolbar, or right-click any file or folder for a full context menu.' },
                { term: 'Lock files & folders', body: 'Create locked items with the add-icon dropdown in the explorer. A password is required to open, preview, or reveal locked content again.' },
                { term: 'Multi-select', body: 'Toggle the multi-select icon in the explorer toolbar to batch move, copy, or delete several items at once.' },
                { term: 'Drag & drop', body: 'Drag files or folders directly onto another folder in the explorer to move them, or onto the tab bar to open them in a specific editor group.' },
                { term: 'Move / Copy to Root', body: "Right-click any item to send it straight back to the workspace's (or window's) root folder, no matter how deeply nested it is." },
                { term: 'Move / Copy to another workspace', body: 'The context menu also lists your other workspaces as direct targets, so you can reorganize files across isolated workspace databases in one step.' }
            ]
        },
        {
            id: 'tree-view',
            title: 'Tree View vs. List View',
            icon: 'ri-node-tree',
            open: false,
            items: [
                { term: 'Toggling views', body: 'Click the tree/list icon in the explorer toolbar to switch between a flat list of the current folder and a fully collapsible hierarchical tree.' },
                { term: 'Expanding folders', body: 'In Tree View, click a folder (or its arrow) to expand its children in place, without leaving the current listing.' },
                { term: 'Workspaces in Tree View', body: "Workspaces behave differently from folders: each one is its own isolated database, so clicking a workspace always navigates into it (switching your active file context) instead of expanding it inline. Look for the 'open' icon instead of the usual expand arrow." },
                { term: 'Indentation', body: 'Tree View indentation width is configurable in Settings, under the Explorer section, if you prefer a more compact or more spread-out hierarchy.' }
            ]
        },
        {
            id: 'workspaces',
            title: 'Workspaces',
            icon: 'ri-folder-5-line',
            open: false,
            items: [
                { term: 'What a workspace is', body: 'A workspace is a self-contained project: its own isolated file database, separate from your main files and from every other workspace.' },
                { term: 'Creating one', body: 'Use the workspace dropdown in the explorer to create a new workspace or switch between existing ones.' },
                { term: 'Switching workspaces', body: 'Switching workspaces (via the dropdown, or by opening one from the explorer) reloads the file list from that workspace\'s own database - files you had open from a different workspace stay open in their tabs, unaffected.' },
                { term: 'Moving files between workspaces', body: "Use a file's context menu to move or copy it directly into another workspace, or back out to the root - this transfers it between the two underlying databases for you." }
            ]
        },
        {
            id: 'split-view',
            title: 'Split View & Editor Groups',
            icon: 'ri-layout-column-line',
            open: false,
            items: [
                { term: 'Creating a split', body: 'Click the split-layout icon in the toolbar to open a second editor group side by side. Click it again to close the split and return to a single group.' },
                { term: 'Moving a tab between groups', body: 'Once both groups exist, press and hold a tab, then drag it into the other group to move it there.' },
                { term: 'Opening a file in a specific group', body: 'Click into the group you want first (its border highlights to show it\'s active), then open the file from the explorer - it opens there.' },
                { term: 'Same file, two panes', body: 'You can open the same file in two different groups at once (handy for referencing one part of a file while editing another) - each pane scrolls and edits independently but they always save to the same underlying file. Notebooks are an exception: opening one that\'s already open elsewhere switches you to that existing tab instead, since notebook output can\'t safely stay in sync across two separate panes.' },
                { term: 'Active group', body: 'Actions like Run, Find, and new-file creation apply to whichever editor group you last interacted with - it is outlined to show which one is active.' },
                { term: 'Closing a split', body: 'Closing the last tab in the second group automatically closes the split and returns to a single editor group.' }
            ]
        },
        {
            id: 'windowing-profiles',
            title: 'Windows & Profiles',
            icon: 'ri-window-2-line',
            open: false,
            items: [
                { term: 'New Window', body: 'Creates another virtual window that shares the same underlying filesystem database as your current one. Use the Window Bar at the top to switch between windows instantly.' },
                { term: 'New Window with Profile', body: 'Creates a fully isolated environment: its own file database, its own settings, and its own cached session state, completely separate from every other window and profile.' },
                { term: 'Settings sync across profiles', body: "Enable 'Sync Profile Settings' if you'd like new isolated profiles to inherit settings from your native window instead of starting from defaults." },
                { term: 'What stays isolated', body: 'Per-profile isolation covers files, settings, open tabs/session state, and drafts like the feedback message on this page - nothing you type or configure in one profile leaks into another.' }
            ]
        },
        {
            id: 'notebooks-consoles',
            title: 'Notebooks, Consoles, & Previews',
            icon: 'ri-terminal-box-line',
            open: false,
            items: [
                { term: 'Supported notebooks', body: 'Jupyter-style native execution for Python 3 (via Pyodide), R (via WebR), and SQL (via SQLite) - all running locally in your browser.' },
                { term: 'Smart notebook execution', body: 'Notebooks auto-install missing packages in Python/R environments and render Matplotlib plots inline, right below the cell that produced them.' },
                { term: 'Quick Console', body: 'Launch a quick REPL console from the Quick Start dashboard to rapid-prototype JavaScript, Python, PHP, or Ruby without creating a file first.' },
                { term: 'Bottom-panel console', body: 'The docked console at the bottom of the editor runs the currently active file directly - press Enter to run, or use the Run button. It respects the same workspace/window context as the file you\'re editing.' },
                { term: 'Terminal', body: 'A shell-like terminal is available as its own tab or docked into the bottom panel, supporting common commands, tab-completion, and command history (Up/Down arrows).' },
                { term: 'Live Previews', body: 'HTML, CSS, and JS files support a live side-by-side preview pane - open it from the play icon in the activity bar. Markdown, JSON, and CSV files also render a formatted preview.' }
            ]
        },
        {
            id: 'keybindings',
            title: 'System Keybindings',
            icon: 'ri-keyboard-line',
            open: false,
            items: [
                { term: 'Ctrl+S / Cmd+S', body: 'Save the active file (works for both regular files and notebooks).' },
                { term: 'Ctrl+Enter / Cmd+Enter', body: 'Run the active notebook cell.' },
                { term: 'Shift+Enter', body: 'Run the active notebook cell and advance to the next one.' },
                { term: 'Tab (in Terminal)', body: 'Autocomplete the current command or filename.' },
                { term: 'Ctrl+C (in Terminal)', body: 'Cancel the current input line.' },
                { term: 'Up / Down (in Terminal or Console)', body: 'Step through previous commands in your history.' },
                { term: 'Everything else', body: 'New file, close tab, toggle sidebar, open terminal, search, and formatting are all toolbar/menu-driven rather than keyboard shortcuts right now - see the other sections above for where to find each one.' }
            ]
        },
        {
            id: 'data-storage',
            title: 'Data, Storage & Offline Use',
            icon: 'ri-database-2-line',
            open: false,
            items: [
                { term: 'Where files live', body: 'Everything is stored locally in your browser using IndexedDB - your default files, each workspace, and each isolated profile all get their own database.' },
                { term: 'Offline-first', body: 'CodeMini is designed to work fully offline once loaded. A service worker caches the app itself so it keeps working without a network connection.' },
                { term: 'Backing up your work', body: 'Use the download options in the explorer toolbar to export files or folders as JSON or ZIP - useful before clearing browser data, since nothing is stored anywhere except this browser.' },
                { term: 'Clearing data', body: 'Clearing your browser\'s site data for CodeMini removes every workspace and profile permanently. Export anything important first.' }
            ]
        },
        {
            id: 'troubleshooting',
            title: 'Troubleshooting',
            icon: 'ri-tools-line',
            open: false,
            items: [
                { term: 'A tab seems stuck or unresponsive', body: 'Try closing and reopening it. If a notebook cell seems stuck running, use the Interrupt Kernel button (stop icon) in the notebook toolbar to cancel execution.' },
                { term: 'Changes aren\'t saving', body: 'Check the file tab\'s top border - a persistent red blink usually means a save attempt is failing. Make sure the browser hasn\'t restricted storage for this site.' },
                { term: 'Something looks wrong after an update', body: 'A hard refresh (clearing the page cache) can help after CodeMini updates, since the service worker sometimes needs a moment to pick up new files.' },
                { term: 'Still stuck?', body: 'Use the contact box above to send a message describing what happened - the more detail, the faster it can be tracked down.' }
            ]
        }
    ];

    function _escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function _renderSection(section) {
        const rows = section.items.map(item => {
            const isKeybind = section.id === 'keybindings';
            return isKeybind
                ? `<li><kbd>${_escapeHtml(item.term)}</kbd> <span class="help-item-body">${_escapeHtml(item.body)}</span></li>`
                : `<li><b>${_escapeHtml(item.term)}:</b> <span class="help-item-body">${_escapeHtml(item.body)}</span></li>`;
        }).join('');

        return `
            <details class="help-details" id="help-section-${section.id}" data-help-section="${section.id}" ${section.open ? 'open' : ''}>
                <summary><span><i class="${section.icon}" style="margin-right: 8px; color: var(--icon-gray);"></i><span class="help-summary-text">${_escapeHtml(section.title)}</span></span></summary>
                <div class="help-content">
                    <ul>${rows}</ul>
                </div>
            </details>`;
    }

    function _buildHelpHTML() {
        const sectionsHTML = HELP_SECTIONS.map(_renderSection).join('');
        const draft = _escapeHtml(_loadFeedbackDraft());

        return `
        <div class="help-feedback-pane" style="padding: 16px; color: var(--text-main); height: 100%; overflow-y: auto;">

            <h2 style="color: var(--accent-blue); margin-bottom: 6px;"><i class="ri-mail-line"></i> Contact Us</h2>
            <p style="margin-bottom: 12px; color: var(--text-muted);">Reach out with a question, a bug, or an idea for making CodeMini better - we read every message.</p>
            <div class="help-feedback-box" style="margin-bottom: 30px;">
                <textarea id="helpFeedbackInput" rows="3" placeholder="Have a question, found a bug, or want to see something new in CodeMini? Let us know here.">${draft}</textarea>
                <div class="help-feedback-actions">
                    <span id="helpFeedbackHint" class="help-feedback-hint">Opens your email app with this message pre-filled.</span>
                    <button id="helpFeedbackSendBtn" class="help-feedback-send-btn"><i class="ri-send-plane-line"></i> Send Feedback</button>
                </div>
            </div>

            <h2 style="color: var(--accent-blue); margin-bottom: 15px;"><i class="ri-question-line"></i> CodeMini Help Guide</h2>

            <div class="search-bar" id="helpSearchBar" style="width: 100%; max-width: 100%; margin-bottom: 18px;">
                <i class="ri-search-2-line"></i>
                <input type="text" id="helpSearchInput" placeholder="Search help topics...">
                <i class="ri-close-line" id="helpSearchClear" style="cursor: pointer; margin-left: 8px; display: none;"></i>
            </div>
            <p id="helpSearchEmpty" style="display: none; color: var(--text-muted); margin: -6px 0 16px;">No help topics match your search.</p>

            <div id="helpSectionsContainer">${sectionsHTML}</div>
        </div>`;
    }

    // --- Wiring -------------------------------------------------------------

    function _wireFeedback(pane) {
        const input = pane.querySelector('#helpFeedbackInput');
        const sendBtn = pane.querySelector('#helpFeedbackSendBtn');
        if (!input || !sendBtn) return;

        input.addEventListener('input', () => _saveFeedbackDraft(input.value));

        sendBtn.addEventListener('click', () => {
            const message = input.value.trim();
            if (!message) {
                input.focus();
                return;
            }
            const subject = encodeURIComponent('CodeMini Feedback');
            const body = encodeURIComponent(message);
            const mailLink = document.createElement('a');
            mailLink.href = `mailto:?subject=${subject}&body=${body}`;
            mailLink.click();

            _clearFeedbackDraft();
            input.value = '';
            if (typeof window.showSuccessToast === 'function') {
                window.showSuccessToast('Your email app should now open with the message ready to send');
            }
        });
    }

    function _wireSearch(pane) {
        const searchInput = pane.querySelector('#helpSearchInput');
        const clearBtn = pane.querySelector('#helpSearchClear');
        const emptyMsg = pane.querySelector('#helpSearchEmpty');
        const container = pane.querySelector('#helpSectionsContainer');
        if (!searchInput || !container) return;

        const allDetails = Array.from(container.querySelectorAll('.help-details'));
        // Remember which sections were open before searching, so clearing the
        // search restores the user's own expand/collapse choices rather than
        // resetting everything back to defaults.
        const userOpenState = new Map(allDetails.map(d => [d, d.hasAttribute('open')]));

        allDetails.forEach(details => {
            details.addEventListener('toggle', () => {
                if (!searchInput.value.trim()) userOpenState.set(details, details.hasAttribute('open'));
            });
        });

        function _highlightText(el, query) {
            const original = el.dataset.plainText || (el.dataset.plainText = el.textContent);
            if (!query) { el.textContent = original; return false; }
            const idx = original.toLowerCase().indexOf(query);
            if (idx === -1) { el.textContent = original; return false; }
            el.innerHTML = _escapeHtml(original.slice(0, idx))
                + '<mark class="help-hl">' + _escapeHtml(original.slice(idx, idx + query.length)) + '</mark>'
                + _escapeHtml(original.slice(idx + query.length));
            return true;
        }

        function applyFilter() {
            const query = searchInput.value.trim().toLowerCase();
            clearBtn.style.display = query ? 'inline-block' : 'none';

            if (!query) {
                allDetails.forEach(details => {
                    details.style.display = '';
                    details.open = userOpenState.get(details) || false;
                    details.querySelectorAll('li').forEach(li => { li.style.display = ''; });
                    const summarySpan = details.querySelector('.help-summary-text');
                    if (summarySpan) _highlightText(summarySpan, '');
                    details.querySelectorAll('.help-item-body').forEach(span => _highlightText(span, ''));
                });
                emptyMsg.style.display = 'none';
                return;
            }

            let anyVisible = false;
            allDetails.forEach(details => {
                const summarySpan = details.querySelector('.help-summary-text');
                const summaryMatches = _highlightText(summarySpan, query);
                const items = Array.from(details.querySelectorAll('.help-content li'));

                let sectionHasMatch = summaryMatches;
                items.forEach(li => {
                    const bodySpan = li.querySelector('.help-item-body');
                    const termText = (li.querySelector('b, kbd')?.textContent || '').toLowerCase();
                    const bodyMatches = bodySpan ? _highlightText(bodySpan, query) : false;
                    const matches = bodyMatches || termText.includes(query);
                    li.style.display = matches ? '' : 'none';
                    if (matches) sectionHasMatch = true;
                });

                details.style.display = sectionHasMatch ? '' : 'none';
                if (sectionHasMatch) {
                    anyVisible = true;
                    details.open = true;
                }
            });

            emptyMsg.style.display = anyVisible ? 'none' : '';
        }

        searchInput.addEventListener('input', applyFilter);
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            applyFilter();
            searchInput.focus();
        });
    }

    function openHelpTab() {
        const existingTab = document.querySelector('.tab[data-type="help"]');
        if (existingTab) {
            if (window.switchTab) window.switchTab(existingTab.dataset.target);
            document.getElementById('moreDropdown')?.classList.remove('show');
            return;
        }

        const activeGroup = document.getElementById((typeof activeGroupId !== 'undefined' && activeGroupId) || 'editorGroup1');
        document.querySelectorAll('.editor-group').forEach(g => g.classList.remove('active-group'));
        if (activeGroup) activeGroup.classList.add('active-group');

        if (window.createNewTab) {
            window.createNewTab('Help Guide', 'ri-question-line', false, _buildHelpHTML(), 'help');
            setTimeout(() => {
                const tab = document.querySelector('.tab[data-type="help"]');
                const pane = tab ? document.getElementById(tab.dataset.target) : null;
                if (!pane) return;
                _wireFeedback(pane);
                _wireSearch(pane);
            }, 0);
        }

        document.getElementById('moreDropdown')?.classList.remove('show');
    }

    window.openHelpTab = openHelpTab;
    document.getElementById('menuHelp')?.addEventListener('click', openHelpTab);

})();
