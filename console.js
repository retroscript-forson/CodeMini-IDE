// ==========================================
// console.js
// ==========================================

(function initLanguageConsoles() {
    function escapeHTML(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag));
    }

    // Circular-safe JSON stringifier for improved JS Console
    function safeStringify(obj, indent = 2) {
        let cache = [];
        const retVal = JSON.stringify(
            obj,
            (key, value) =>
                typeof value === "object" && value !== null
                    ? cache.includes(value)
                        ? "[Circular Reference]"
                        : cache.push(value) && value
                    : typeof value === "function" ? `[Function: ${value.name || 'anonymous'}]` : value,
            indent
        );
        cache = null;
        return retVal;
    }

    // Scope tracking arrays and instances per window
    window.consoleInstances = window.consoleInstances || {};
    window.phpWebInstances = window.phpWebInstances || {};
    window._phpConsoleLines = window._phpConsoleLines || {};
    // Ruby (Opal) has no lightweight per-call environment/scope option like
    // Pyodide's globals dict or WebR's REnvironment - Opal.eval always runs
    // against ONE shared global JS runtime object. The only real isolation
    // is a genuinely separate JS realm, so each window gets its own hidden
    // iframe with its own freshly-loaded Opal instance. See getRubySandbox().
    window._rubySandboxes = window._rubySandboxes || {};

    // Lazily creates (once per window) a hidden, sandboxed iframe with its own
    // freshly-loaded Opal runtime - a genuinely separate JS realm, so Ruby
    // constants/classes/top-level variables in one window's console can never
    // be seen by or leak into another window's. allow-same-origin keeps the
    // iframe reachable directly via contentWindow (no postMessage needed) while
    // still giving it its own distinct global object from the parent page's.
    window.getRubySandbox = function(winId) {
        if (window._rubySandboxes[winId] && window._rubySandboxes[winId].ready) {
            return window._rubySandboxes[winId].ready;
        }

        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.sandbox = 'allow-scripts allow-same-origin';
        document.body.appendChild(iframe);

        const readyPromise = new Promise((resolve, reject) => {
            iframe.onload = () => {
                const win = iframe.contentWindow;
                const doc = iframe.contentDocument;
                const loadScript = (src) => new Promise((res, rej) => {
                    const script = doc.createElement('script');
                    script.src = src; script.onload = res;
                    script.onerror = () => rej(new Error(`Failed to load ${src}`));
                    doc.head.appendChild(script);
                });
                (async () => {
                    try {
                        await loadScript("https://cdn.opalrb.com/opal/current/opal.min.js");
                        await loadScript("https://cdn.opalrb.com/opal/current/opal-parser.min.js");
                        await loadScript("https://cdn.opalrb.com/opal/current/math.min.js");
                        await loadScript("https://cdn.opalrb.com/opal/current/json.min.js");
                        await loadScript("https://cdn.opalrb.com/opal/current/base64.min.js");
                        resolve(win.Opal);
                    } catch (err) {
                        reject(err);
                    }
                })();
            };
            iframe.src = 'about:blank';
        });

        window._rubySandboxes[winId] = { iframe, ready: readyPromise };
        return readyPromise;
    };

    // Tears down a window's Ruby sandbox entirely - the cleanest possible reset
    // (fresh iframe + fresh Opal load next time) rather than trying to clear
    // individual Ruby-defined globals, which Opal doesn't expose a way to do.
    window.teardownRubySandbox = function(winId) {
        const sandbox = window._rubySandboxes[winId];
        if (sandbox && sandbox.iframe && sandbox.iframe.parentNode) {
            sandbox.iframe.parentNode.removeChild(sandbox.iframe);
        }
        delete window._rubySandboxes[winId];
    };

    window.openLanguageConsole = function(language) {
        // Retrieve dynamic window ID at execution time
        const activeWinId = localStorage.getItem('codemini_active_window') || 'win_default';
        
        // Initialize scope
        window.consoleInstances[activeWinId] = window.consoleInstances[activeWinId] || {
            'JavaScript': false,
            'PHP': false,
            'Ruby': false,
            'Python': false
        };

        // Strict Profile Isolation Fix: Verify both state AND valid DOM presence
        const existingConsole = document.querySelector(`.tab[data-language-console="${language}"]`);
        if (window.consoleInstances[activeWinId][language] && existingConsole) {
            if (window.switchTab) {
                window.switchTab(existingConsole.dataset.target);
            }
            return;
        }

        // 1. Determine Tab Name
        let tabName = `${language}.console`;
        window.consoleInstances[activeWinId][language] = true;

        const consoleId = `console-${language.toLowerCase()}-${Date.now()}`;
        const targetPaneId = `pane-${consoleId}`;
        const persistenceKey = `codemini_console_${activeWinId}_${language.toLowerCase()}`;

        // 2. Locate Tab and Pane Containers
        const activeGroup = document.querySelector('.editor-group.active-group') || document.getElementById('editorGroup1');
        const tabsContainer = activeGroup ? activeGroup.querySelector('.tabs-bar') : null;
        const panesContainer = activeGroup ? activeGroup.querySelector('.panes-container') : null;

        if (!tabsContainer || !panesContainer) {
            console.error("Could not find tab or pane containers.");
            return;
        }

        // Deactivate currently active tabs/panes in active group ONLY
        if (activeGroup) {
            activeGroup.querySelectorAll('.tab.active').forEach(t => t.classList.remove('active'));
            activeGroup.querySelectorAll('.content-pane.active').forEach(p => p.classList.remove('active'));
        }

        // Determine icon color based on language (Matching stacks.js logic)
        let iconColor = 'var(--text-main)';
        const lowerLang = language.toLowerCase();
        if (lowerLang === 'python') iconColor = 'var(--icon-py)';
        else if (lowerLang === 'javascript' || lowerLang === 'js') iconColor = 'var(--icon-js)';
        else if (lowerLang === 'php') iconColor = '#777bb4';
        else if (lowerLang === 'ruby') iconColor = '#cc342d';

        // 3. Create the Tab
        const tab = document.createElement('div');
        tab.className = 'tab active';
        tab.dataset.target = targetPaneId;
        tab.dataset.type = 'console';
        tab.dataset.languageConsole = language; 
        
        tab.innerHTML = `
            <i class="ri-terminal-box-line" style="color: ${iconColor}; margin-right: 3px; font-size: 14px;"></i>
            <span class="tab-title" style="margin-right: 3px;">${tabName}</span>
            <i class="ri-close-line tab-close close-tab"></i>
        `;

        // Load saved state if exists
        let savedState = null;
        try {
            savedState = JSON.parse(localStorage.getItem(persistenceKey));
        } catch (e) {
            console.warn(`Could not parse console state for ${language}`);
        }

        let isTrusted = savedState && savedState.isTrusted !== undefined ? savedState.isTrusted : true;

        // Determine placeholder text based on language and library
        let placeholderText = '';
        switch(language.toLowerCase()) {
            case 'javascript':
                placeholderText = 'JavaScript (V8/Browser)';
                break;
            case 'php':
                placeholderText = 'PHP (php-wasm)';
                break;
            case 'ruby':
                placeholderText = 'Ruby (Opal + Stdlib)';
                break;
            case 'python':
                placeholderText = 'Python 3 (Pyodide)';
                break;
            default:
                placeholderText = `${language} Console`;
        }
        
        const cFontSize = window.appSettings ? window.appSettings.consoleFontSize || 14 : 14;
        const cFontFamily = window.appSettings ? window.appSettings.consoleFontFamily || 'var(--font-mono)' : 'var(--font-mono)';
        const cLineHeight = window.appSettings ? window.appSettings.consoleLineHeight || 21 : 21;
        const cWordWrap = (window.appSettings && window.appSettings.consoleWordWrap === 'off') ? 'pre' : 'pre-wrap';

        // 4. Create the Pane
        const pane = document.createElement('div');
        pane.className = 'content-pane active'; 
        pane.id = targetPaneId;
        
        pane.style.flexDirection = 'column';
        pane.style.height = '100%';
        pane.style.width = '100%';
        pane.style.backgroundColor = 'var(--bg-white)';

        pane.innerHTML = `
            <style>
                #${targetPaneId} .console-container {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                    font-family: var(--font-main);
                    background-color: var(--bg-white);
                    overflow: hidden;
                    --console-fs: ${cFontSize}px;
                    --console-ff: ${cFontFamily};
                    --console-lh: ${cLineHeight}px;
                    --console-wrap: ${cWordWrap};
                }
                #${targetPaneId} .toolbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 16px;
                    border-bottom: 1px solid var(--border-color);
                    flex-wrap: wrap;
                    flex-shrink: 0;
                }
                #${targetPaneId} .toolbar-left, #${targetPaneId} .toolbar-right {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    flex-wrap: wrap;
                }
                #${targetPaneId} .toolbar-right {
                    gap: 12px;
                }
                #${targetPaneId} .icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--icon-gray);
                    cursor: pointer;
                    font-size: 20px;
                    transition: color 0.2s;
                }
                #${targetPaneId} .icon:hover {
                    color: var(--text-main);
                }
                #${targetPaneId} .kernel-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-size: 15px;
                    color: var(--text-main);
                    flex-wrap: wrap;
                }
                #${targetPaneId} .kernel-indicator {
                    width: 15px;
                    height: 15px;
                    border: 3px solid transparent;
                    border-radius: 50%;
                    border-top-color: var(--accent-blue);
                    border-bottom-color: var(--accent-new-light);
                    display: inline-block;
                }
                #${targetPaneId} .kernel-indicator.running {
                    animation: spinStatus 0.3s linear infinite;
                }
                #${targetPaneId} .middle-content {
                    flex: 1;
                    padding: 20px 24px;
                    overflow-y: auto;
                    font-family: var(--console-ff);
                    font-size: var(--console-fs);
                    line-height: var(--console-lh);
                    color: var(--text-main);
                }
                #${targetPaneId} .placeholder-text {
                    font-family: var(--font-main);
                    font-size: 15px;
                    font-weight: 500;
                    color: var(--text-main);
                    letter-spacing: 2px;
                    line-height: 1;
                }
                #${targetPaneId} .divider {
                    height: 6px;
                    background-color: var(--bg-panel);
                     border-top: 1px solid var(--border-color);
                    border-bottom: 1px solid var(--border-color);
                    flex-shrink: 0;
                }
                #${targetPaneId} .cell-row {
                    display: flex;
                    padding: 16px 24px;
                    align-items: flex-start;
                    gap: 12px;
                    flex-shrink: 0;
                    background-color: var(--bg-white);

                }
                #${targetPaneId} .input-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                #${targetPaneId} .prompt {
                    font-family: var(--console-ff);
                    font-size: var(--console-fs);
                    color: var(--accent-blue);
                    user-select: none;
                }
                #${targetPaneId} .input-actions {
                    display: flex;
                    gap: 8px;
                }
                #${targetPaneId} .input-actions .icon {
                    font-size: 18px;
                    padding: 4px;
                    border-radius: 4px;
                }
                #${targetPaneId} .input-actions .icon:not(.disabled):hover {
                    background-color: var(--bg-panel);
                }
                #${targetPaneId} .input-wrapper {
                    flex-grow: 1;
                }
                #${targetPaneId} .cell-input {
                    width: 100%;
                    border: 2px solid var(--border-color);
                    min-height: 38px;
                    max-height: 200px;
                    border-radius: 1px;
                    outline: none;
                    padding: 8px 12px;
                    font-family: var(--console-ff);
                    font-size: var(--console-fs);
                    line-height: var(--console-lh);
                    color: var(--text-main);
                    box-sizing: border-box;
                    transition: border-color 0.2s;
                    resize: none;
                    overflow-y: auto;
                }
                #${targetPaneId} .cell-input:focus {
                    border-color: var(--accent-blue);
                }
                #${targetPaneId} .cell-input::placeholder {
                    color: var(--text-placeholder);
                }
                #${targetPaneId} .output-block {
                    margin-bottom: 24px;
                }
                #${targetPaneId} .input-header-display {
                    display: flex;
                    align-items: center;
                    margin-bottom: 4px;
                    font-family: var(--console-ff);
                    font-size: calc(var(--console-fs) - 1px);
                    color: var(--accent-blue);
                    font-weight: 500;
                }
                #${targetPaneId} .input-content {
                    margin-bottom: 8px;
                    padding: 8px 12px;
                    font-family: var(--console-ff);
                    font-size: var(--console-fs);
                    line-height: var(--console-lh);
                    color: var(--text-main);
                    white-space: var(--console-wrap);
                    word-break: break-word;
                }
                #${targetPaneId} .output-header {
                    display: flex;
                    align-items: center;
                    margin-bottom: 4px;
                    margin-top: 12px;
                    font-family: var(--console-ff);
                    font-size: calc(var(--console-fs) - 1px);
                    color: var(--accent-new);
                    font-weight: 500;
                }
                #${targetPaneId} .output-content {
                    padding: 8px 12px;
                    background-color: var(--bg-white);
                    font-family: var(--console-ff);
                    font-size: var(--console-fs);
                    line-height: var(--console-lh);
                    color: var(--text-muted);
                    white-space: var(--console-wrap);
                    word-break: break-word;
                    margin-bottom: 4px;
                }
                #${targetPaneId} .execution-time {
                    font-family: var(--font-mono);
                    font-size: 11px;
                    color: var(--text-placeholder);
                    margin-bottom: 8px;
                    font-style: italic;
                }
                @media (max-width: 600px) {
                    #${targetPaneId} .console-container { border-top: none; }
                    #${targetPaneId} .toolbar { padding: 8px; }
                    #${targetPaneId} .toolbar-left, #${targetPaneId} .toolbar-right { gap: 8px; }
                    #${targetPaneId} .kernel-info { font-size: 13px; gap: 6px; }
                    #${targetPaneId} .middle-content { padding: 16px; }
                    #${targetPaneId} .placeholder-text { font-size: 20px; }
                    #${targetPaneId} .cell-row { padding: 12px 16px; }
                    #${targetPaneId} .cell-input { min-height: 32px; }
                }
            </style>
            
            <div class="console-container">
                <div class="toolbar">
                    <div class="toolbar-left">
                        
                        <div class="icon" title="Export"><i class="ri-external-link-line"></i></div>
                        <div class="icon tb-vars" title="Variables Explorer"><i class="ri-list-unordered"></i></div>
                        <div class="hide-on-mobile" style="width: 1px; height: 16px; background: var(--border-color); margin: 0 8px;"></div>
                        <div class="icon" title="Copy Output"><i class="ri-file-copy-line"></i></div>
                        <div class="icon" title="Clear History"><i class="ri-history-line"></i></div>
                        <div class="icon" title="Clear All"><i class="ri-eraser-line"></i></div>
                    </div>
                    <div class="toolbar-right">
                        <a href="#" class="notebook-link tb-trust" data-trusted="${isTrusted}">
                            <span class="hide-on-mobile">${isTrusted ? 'Trusted' : 'Untrusted'}</span> 
                            <i class="${isTrusted ? 'ri-shield-check-line' : 'ri-shield-flash-line'}" ${!isTrusted ? 'style="color: var(--color-danger);"' : ''}></i>
                        </a>
                        <div class="hide-on-mobile" style="width: 1px; height: 16px; background: var(--border-color); margin: 0 8px;"></div>
                        <div class="kernel-info">
                            <span>${language} (Console)</span>
                            <span class="kernel-indicator" title="Kernel Status"></span>
                        </div>
                    </div>
                </div>
                
                <div class="console-body-wrapper">
                    <div class="console-main-area">
                        <div class="middle-content console-output">
                            <div class="placeholder-text">${placeholderText}</div>
                        </div>

                        <div class="cell-row console-input-area">
                            <div class="input-wrapper">
                                <div class="input-header">
                                    <div class="prompt console-prompt">In [1]:</div>
                                    <div class="input-actions">
                                        <div class="icon run-btn" title="Run Command"><i class="ri-play-fill"></i></div>
                                        <div class="icon stop-btn disabled" title="Stop Kernel"><i class="ri-stop-fill"></i></div>
                                        <div class="icon" title="Restart"><i class="ri-restart-line"></i></div>
                                    </div>
                                </div>
                                <textarea class="cell-input console-input" placeholder="" autocomplete="off" spellcheck="false" rows="1"></textarea>
                            </div>
                        </div>
                    </div>

                    <div class="console-vars-panel">
                        <div class="vars-header" style="display: flex; justify-content: space-between; padding: 10px 15px; background: var(--bg-white);  font-weight: 500; font-size: 13px;">
                            <span>Variables Explorer</span>
                            <div>
                                <i class="ri-refresh-line vars-refresh" style="cursor: pointer; margin-right: 8px;" title="Refresh"></i>
                                <i class="ri-close-line vars-close" style="cursor: pointer;" title="Close"></i>
                            </div>
                        </div>
                        <div class="vars-content" style="flex: 1; overflow-y: auto;">
                            <div class="empty-state" style="padding:20px; text-align:center; color:var(--text-muted);">No variables</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 5. Append to DOM
        const addBtn = tabsContainer.querySelector('.add-tab');
        if (addBtn) {
            tabsContainer.insertBefore(tab, addBtn); 
        } else {
            tabsContainer.appendChild(tab);
        }
        panesContainer.appendChild(pane);
        
        if (window.updateOpenedTabsRegistry) window.updateOpenedTabsRegistry();
        const activeFileStatus = document.getElementById('activeFileStatus');
        if (activeFileStatus) activeFileStatus.textContent = tabName;

        // 6. Setup Input Handling & Logic
        const inputField = pane.querySelector('.console-input');
        const outputArea = pane.querySelector('.console-output');
        const kernelIndicator = pane.querySelector('.kernel-indicator');
        const stopBtn = pane.querySelector('.stop-btn');
        const varsPanel = pane.querySelector('.console-vars-panel');
        let executionCount = savedState ? savedState.executionCount : 1;
        
        let commandHistory = savedState && savedState.history ? savedState.history : [];
        let historyIndex = commandHistory.length;

        if (savedState && savedState.outputHtml) {
            outputArea.innerHTML = savedState.outputHtml;
            const promptDisplay = pane.querySelector('.console-prompt');
            if (promptDisplay) promptDisplay.textContent = `In [${executionCount}]:`;
        }

        const saveConsoleState = () => {
            const state = {
                executionCount: executionCount,
                outputHtml: outputArea.innerHTML,
                history: commandHistory,
                isTrusted: isTrusted // Save state of the trust toggle
            };
            localStorage.setItem(persistenceKey, JSON.stringify(state));
        };

        function autoResizeTextarea() {
            inputField.style.height = 'auto';
            inputField.style.height = Math.min(inputField.scrollHeight, 200) + 'px';
        }
        
        inputField.addEventListener('input', autoResizeTextarea);

        function setKernelRunning(isRunning) {
            if (isRunning) {
                kernelIndicator.classList.add('running');
                if(stopBtn) stopBtn.classList.remove('disabled');
            } else {
                kernelIndicator.classList.remove('running');
                if(stopBtn) stopBtn.classList.add('disabled');
            }
        }

        async function updateConsoleVariables() {
            const contentDiv = pane.querySelector('.vars-content');
            if (!contentDiv || !varsPanel.classList.contains('show')) return;

            contentDiv.innerHTML = '<div style="text-align:center; padding: 30px;"><i class="ri-loader-4-line" style="animation: spinStatus 0.8s linear infinite; font-size: 24px; color: var(--accent-blue);"></i><p style="margin-top: 10px; color: var(--text-muted);">Fetching variables...</p></div>';

            try {
                let html = '';
                if (language.toLowerCase() === 'python') {
                    if (typeof window.getPyodideInstance === 'undefined') throw new Error("Pyodide not loaded");
                    const py = await window.getPyodideInstance();
                    if (!py) throw new Error("Kernel not ready");
                    
                    const code = `
import json, sys, types, builtins
_exclude_names = {
    '__builtins__', '__name__', '__doc__', '__package__', '__loader__', '__spec__',
    '__annotations__', '__file__', '__cached__', '__warningregistry__',
    'sys', 'json', 'types', 'os', 'io', 'js', 'builtins', 'warnings', 'ast',
    'micropip', 'pyodide', 'pyodide_js', 'pyodide_ffi', 'asyncio',
    'matplotlib', 'plt', 'np', 'pd', 'Figure', 'Axes', 'pyplot',
    'ainput', 'custom_input', 'display_html', 'is_trusted',
    '_code_to_parse', '_fmt_code', 'builtins_proxy',
    'k', 'v', 'val_str', 'modules'
}

def _is_public_name(name):
    return not name.startswith('_') and not name.startswith('\\x00') and name not in _exclude_names

def _collect_variables():
    _vars = []
    for _k in list(globals().keys()):
        if _is_public_name(_k):
            try:
                _v = globals()[_k]
                _val_str = repr(_v)
                if len(_val_str) > 50: _val_str = _val_str[:47] + '...'
                if not _val_str.startswith('<') or _val_str.startswith('<class'):
                    _vars.append({"name": _k, "type": type(_v).__name__, "value": _val_str})
            except Exception:
                pass
    return _vars

json.dumps(_collect_variables())
                    `;
                    const res = await py.runPythonAsync(code);
                    const vars = JSON.parse(res);
                    
                    if (vars.length === 0) {
                        html = '<div class="empty-state" style="padding:30px; text-align:center; color:var(--text-muted);">No variables defined yet.</div>';
                    } else {
                        html = '<table class="vars-table"><thead><tr><th>Name</th><th>Type</th><th>Value</th></tr></thead><tbody>';
                        vars.forEach(v => {
                            html += `<tr><td style="font-weight:600; color:var(--accent-blue);">${escapeHTML(v.name)}</td><td><span class="var-type-badge">${escapeHTML(v.type)}</span></td><td style="font-family:monospace;">${escapeHTML(v.value)}</td></tr>`;
                        });
                        html += '</tbody></table>';
                    }
                } else {
                    html = `<div class="empty-state" style="padding:30px; text-align:center; color:var(--text-muted); line-height:1.5;">Variable explorer is not currently supported for ${language}.</div>`;
                }
                contentDiv.innerHTML = html;
            } catch (err) {
                contentDiv.innerHTML = `<div style="padding: 20px; color: var(--color-danger); text-align:center;">Failed to fetch variables: ${err.message}</div>`;
            }
        }

        async function executeCommand(command) {
            const autoClear = window.appSettings && window.appSettings.consoleAutoClear === true;
            const showTimestamp = window.appSettings && window.appSettings.consoleShowTimestamps === true;
            const autoInstall = window.appSettings ? window.appSettings.consoleAutoInstall !== false : true;

            if(autoClear) {
                outputArea.innerHTML = '';
            }

            const startTime = performance.now();
            const timeDateStart = new Date().toLocaleTimeString();
            setKernelRunning(true);
            
            const trimmedCmd = command.trim();
            if (trimmedCmd === 'clear' || trimmedCmd === 'clear()' || trimmedCmd === '%clear') {
                outputArea.innerHTML = `<div class="placeholder-text">${placeholderText}</div>`;
                executionCount = 1;
                const promptDisplay = pane.querySelector('.console-prompt');
                if (promptDisplay) promptDisplay.textContent = `In [1]:`;
                saveConsoleState();
                setKernelRunning(false);
                updateConsoleVariables();
                return;
            }

            const placeholder = outputArea.querySelector('.placeholder-text');
            if (placeholder) placeholder.remove();

            const outputBlock = document.createElement('div');
            outputBlock.className = 'output-block';
            
            const inputHeader = document.createElement('div');
            inputHeader.className = 'input-header-display';
            let headInnerHtml = `<span>In [${executionCount}]:</span>`;
            if (showTimestamp) headInnerHtml += `<span class="console-timestamp">${timeDateStart}</span>`;
            inputHeader.innerHTML = headInnerHtml;
            outputBlock.appendChild(inputHeader);
            
            const inputContent = document.createElement('div');
            inputContent.className = 'input-content';
            inputContent.textContent = command;
            outputBlock.appendChild(inputContent);
            
            const outputHeader = document.createElement('div');
            outputHeader.className = 'output-header';
            outputHeader.style.display = 'flex'; 
            outputHeader.innerHTML = `<span>Out [${executionCount}]:</span><i class="ri-file-copy-line block-copy-btn" style="margin-left:auto; cursor:pointer; font-size:14px; color:var(--icon-gray); transition:color 0.2s;" title="Copy Output"></i>`;
            outputBlock.appendChild(outputHeader);
            
            let mockResponse = '';

            if (trimmedCmd === 'help' || trimmedCmd === 'help()') {
                let helpMsg = `[CodeMini ${language} Console Capabilities]\n - clear(): Wipe the console output entirely.\n - Arrow Up/Down: Seamlessly navigate your execution history.\n - Custom UI settings dynamically available from the IDE settings panel.`;
                if(language.toLowerCase() === 'python') helpMsg += `\n - %time <cmd>: Magic command to measure execution speed.`;
                mockResponse = `<span style="color: var(--term-blue); font-weight: bold;">${escapeHTML(helpMsg)}</span>`;
            } else {
                if (language.toLowerCase() === 'php') {
                    try {
                        if (!window.phpWebInstances[activeWinId]) {
                            outputHeader.innerHTML += " <span style='font-style: italic; color: var(--text-placeholder);'></span>";
                            let module;
                            try { module = await import('https://unpkg.com/php-wasm/PhpWeb.mjs'); } 
                            catch (err1) { module = await import('https://cdn.jsdelivr.net/npm/php-wasm/PhpWeb.mjs'); }

                            window.phpWebInstances[activeWinId] = new module.PhpWeb();
                            
                            window.phpWebInstances[activeWinId].addEventListener('output', (event) => {
                                if(!window._phpConsoleLines[activeWinId]) window._phpConsoleLines[activeWinId] = [];
                                window._phpConsoleLines[activeWinId].push(escapeHTML(String(event.detail)));
                            });
                            window.phpWebInstances[activeWinId].addEventListener('error', (event) => {
                                if(!window._phpConsoleLines[activeWinId]) window._phpConsoleLines[activeWinId] = [];
                                window._phpConsoleLines[activeWinId].push('<span style="color: var(--term-red);">' + escapeHTML(String(event.detail)) + '</span>');
                            });
                            await new Promise(r => setTimeout(r, 200)); 
                        }

                        window._phpConsoleLines[activeWinId] = [];
                        let code = command.trim();
                        
                        if (!code.startsWith('<?php')) {
                            code = `<?php\nerror_reporting(E_ALL);\nini_set('display_errors', 1);\n${code}\n?>`;
                        }
                        
                        await window.phpWebInstances[activeWinId].run(code);
                        mockResponse = window._phpConsoleLines[activeWinId].join('').trim();
                        if (mockResponse === '') mockResponse = '(No output)';
                    } catch (e) {
                        mockResponse = `<span style="color: var(--term-red);">[PHP Error] ${escapeHTML(e.message)}</span>`;
                    }
                } else if (language.toLowerCase() === 'ruby') {
                    try {
                        const opal = await window.getRubySandbox(activeWinId);
                        const sandboxWin = window._rubySandboxes[activeWinId].iframe.contentWindow;

                        let outputLines = [];
                        const originalLog = sandboxWin.console.log;
                        sandboxWin.console.log = (...args) => {
                            outputLines.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join('\t'));
                        };

                        try {
                            const rubyResult = opal.eval(command);
                            if (rubyResult !== undefined && rubyResult !== null && String(rubyResult) !== 'nil') {
                                outputLines.push(String(rubyResult));
                            }
                            mockResponse = escapeHTML(outputLines.join('\n'));
                            if (mockResponse.trim() === '') mockResponse = '(No output)';
                        } catch (err) {
                            mockResponse = `<span style="color: var(--term-red);">[Ruby Error] ${escapeHTML(err.message || String(err))}</span>`;
                        } finally {
                            sandboxWin.console.log = originalLog;
                        }
                    } catch (e) {
                        mockResponse = `<span style="color: var(--term-red);">[Ruby System Error] ${escapeHTML(e.message)}</span>`;
                    }
                } else if (language.toLowerCase() === 'python') {
                    try {
                        if (typeof window.getPyodideInstance === 'undefined') {
                            throw new Error("Pyodide engine not found.");
                        }
                        outputHeader.innerHTML += " <span style='font-style: italic; color: var(--text-placeholder);'></span>";
                        const py = await window.getPyodideInstance();
                        if (!py) throw new Error("Failed to load Pyodide runtime.");

                        py.runPython(`
import sys, io
_cm_stdout = io.StringIO()
_cm_stderr = io.StringIO()
sys.stdout = _cm_stdout
sys.stderr = _cm_stderr
try:
    import builtins
    builtins.is_trusted = ${isTrusted ? 'True' : 'False'}
    import warnings
    warnings.filterwarnings("ignore", message="Matplotlib is currently using agg")
    import matplotlib
    matplotlib.use('agg')
except Exception:
    pass
`);

                        let execCmd = command;
                        let isTimeMagic = false;
                        if (execCmd.startsWith('%time ')) {
                            isTimeMagic = true;
                            execCmd = execCmd.substring(6).trim();
                        }

                        if (autoInstall) {
                            try {
                                const importStatusIndicator = document.createElement('span');
                                importStatusIndicator.style.cssText = 'font-style: italic; color: var(--accent-blue); font-size: 12px; margin-left: 8px;';
                                importStatusIndicator.textContent = "(Resolving dependencies...)";
                                outputHeader.appendChild(importStatusIndicator);
                                await py.loadPackagesFromImports(execCmd);
                                importStatusIndicator.remove();
                            } catch (err) {
                                console.warn("Console auto-install failed:", err);
                            }
                        }

                        const result = await py.runPythonAsync(execCmd);
                        const stdout = py.runPython("_cm_stdout.getvalue()"); 
                        const stderr = py.runPython("_cm_stderr.getvalue()");

                        // Extract Plots directly from Pyodide
                        let plots = [];
                        try {
                            const plotCode = `
import base64, io
import matplotlib.pyplot as plt
_figs = [plt.figure(n) for n in plt.get_fignums()]
_res = []
for _fig in _figs:
    _buf = io.BytesIO()
    _fig.savefig(_buf, format='png', bbox_inches='tight', dpi=100)
    _res.append(base64.b64encode(_buf.getvalue()).decode('utf-8'))
plt.close('all')
_res
`;
                            const proxy = await py.runPythonAsync(plotCode);
                            if (proxy && proxy.toJs) {
                                plots = proxy.toJs();
                                proxy.destroy();
                            }
                        } catch(plotErr) {
                            console.warn("Console plot extraction failed:", plotErr);
                        }

                        let outHtml = "";
                        if (stdout) outHtml += escapeHTML(stdout) + "\n";
                        if (stderr) outHtml += `<span style="color: var(--term-red);">${escapeHTML(stderr)}</span>\n`;
                        
                        if (result !== undefined && result !== null) {
                            const resultStr = result.toString();
                            if (resultStr !== 'undefined' && resultStr !== 'null' && resultStr !== 'None') {
                                outHtml += escapeHTML(resultStr) + "\n";
                            }
                        }

                        if (plots.length > 0) {
                            const bgStr = (window.appSettings && window.appSettings.nbPlotBackground === 'Transparent') ? 'transparent' : 'var(--bg-white)';
                            plots.forEach(b64 => {
                                outHtml += `\n<div style="margin-top: 8px; padding: 10px; background: ${bgStr}; text-align: center; border: 1px solid var(--border-color); display: inline-block;">
                                    <img src="data:image/png;base64,${b64}" style="max-width:100%; display:inline-block;" />
                                </div>`;
                            });
                        }

                        if (isTimeMagic) {
                            const tMeasure = ((performance.now() - startTime)).toFixed(3);
                            outHtml += `\n<span style="color: var(--term-blue); font-style: italic;">CPU Time: ${tMeasure} ms</span>`;
                        }

                        mockResponse = outHtml.trim();
                        if (mockResponse === '') mockResponse = '(No output)';
                    } catch (err) {
                        try {
                            const py = await window.getPyodideInstance();
                            const stderr = py.runPython("sys.stderr.getvalue()");
                            let errOut = stderr ? stderr : err.toString();
                            mockResponse = `<span style="color: var(--term-red);">[Python Error]\n${escapeHTML(errOut)}</span>`;
                        } catch (fallbackErr) {
                            mockResponse = `<span style="color: var(--term-red);">[Python System Error] ${escapeHTML(err.message)}</span>`;
                        }
                    }
                } else if (language.toLowerCase() === 'javascript') {
                    try {
                        let outputLines = [];
                        const originalLog = console.log;
                        const originalWarn = console.warn;
                        const originalError = console.error;
                        const originalInfo = console.info;
                        
                        const createInterceptor = (level) => (...args) => {
                            const parsedArgs = args.map(a => {
                                if (a instanceof Error) return a.stack || a.message;
                                if (a instanceof HTMLElement) return `<${a.tagName.toLowerCase()}${a.id ? ' id="'+a.id+'"' : ''}${a.className ? ' class="'+a.className+'"' : ''}>...`;
                                if (typeof a === 'object' && a !== null) {
                                    try { return safeStringify(a); } catch(e) { return String(a); }
                                }
                                return String(a);
                            }).join(' ');
                            
                            if (level === 'error') outputLines.push(`<span style="color: var(--term-red);">${escapeHTML(parsedArgs)}</span>`);
                            else if (level === 'warn') outputLines.push(`<span style="color: var(--term-yellow);">${escapeHTML(parsedArgs)}</span>`);
                            else if (level === 'info') outputLines.push(`<span style="color: var(--term-blue);">${escapeHTML(parsedArgs)}</span>`);
                            else outputLines.push(escapeHTML(parsedArgs));
                            
                            if (level === 'log') originalLog(...args);
                            else if (level === 'warn') originalWarn(...args);
                            else if (level === 'error') originalError(...args);
                            else if (level === 'info') originalInfo(...args);
                        };

                        console.log = createInterceptor('log');
                        console.warn = createInterceptor('warn');
                        console.error = createInterceptor('error');
                        console.info = createInterceptor('info');

                        let result;
                        try {
                            if (/\bawait\b/.test(command)) {
                                const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                                try { result = await (new AsyncFunction(`return (${command});`))(); } 
                                catch (wrapErr) { result = await (new AsyncFunction(command))(); }
                            } else {
                                result = (1, eval)(command);
                            }
                        } finally {
                            console.log = originalLog;
                            console.warn = originalWarn;
                            console.error = originalError;
                            console.info = originalInfo;
                        }

                        if (result !== undefined) {
                            if (result instanceof HTMLElement) {
                                outputLines.push(`<span style="color: var(--term-blue);">&lt;${result.tagName.toLowerCase()}${result.id ? ' id="'+escapeHTML(result.id)+'"' : ''}${result.className ? ' class="'+escapeHTML(result.className)+'"' : ''}&gt;...&lt;/${result.tagName.toLowerCase()}&gt;</span>`);
                            } else if (typeof result === 'object' && result !== null) {
                                try { outputLines.push(escapeHTML(safeStringify(result))); } 
                                catch(e) { outputLines.push(escapeHTML(String(result))); }
                            } else if (typeof result === 'string') {
                                outputLines.push(`<span style="color: var(--term-green);">"${escapeHTML(result)}"</span>`);
                            } else if (typeof result === 'number' || typeof result === 'boolean') {
                                outputLines.push(`<span style="color: var(--term-yellow);">${escapeHTML(String(result))}</span>`);
                            } else if (typeof result === 'function') {
                                outputLines.push(`<span style="color: var(--term-blue); font-style: italic;">[Function: ${escapeHTML(result.name || 'anonymous')}]</span>`);
                            } else {
                                outputLines.push(escapeHTML(String(result)));
                            }
                        }

                        mockResponse = outputLines.join('\n');
                        if (mockResponse.trim() === '') mockResponse = '(No output)';
                    } catch (e) {
                        mockResponse = `<span style="color: var(--term-red);">[JS Error] ${escapeHTML(e.name)}: ${escapeHTML(e.message)}</span>`;
                    }
                }
            }

            const endTime = performance.now();
            const executionTime = (endTime - startTime).toFixed(2);
            
            // Console Execution Untrusted Output Sanitization Engine
            if (!isTrusted) {
                let wasBlocked = false;
                const sanitizeHTML = (htmlString) => {
                    if (!htmlString) return htmlString;
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlString, 'text/html');
                    
                    const scripts = doc.querySelectorAll('script');
                    if (scripts.length > 0) wasBlocked = true;
                    scripts.forEach(s => s.remove());
                    
                    const allElements = doc.querySelectorAll('*');
                    allElements.forEach(el => {
                        for (let i = el.attributes.length - 1; i >= 0; i--) {
                            const attr = el.attributes[i];
                            if (attr.name.toLowerCase().startsWith('on') || attr.value.toLowerCase().includes('javascript:')) {
                                el.removeAttribute(attr.name);
                                wasBlocked = true;
                            }
                        }
                    });
                    
                    return doc.body.innerHTML;
                };

                mockResponse = sanitizeHTML(mockResponse);

                if (wasBlocked) {
                    const indicator = `<div class="blocked-content-indicator" style="color:var(--color-danger); border: 1px dashed var(--color-danger); padding: 5px; border-radius: 4px; font-size:12px; margin-bottom:5px; background: rgba(211, 47, 47, 0.05);"><i class="ri-shield-flash-line"></i> Sanitized Output: Blocked unsafe scripts/events (Untrusted)</div>\n`;
                    mockResponse = indicator + mockResponse;
                }
            }

            const outputContent = document.createElement('div');
            outputContent.className = 'output-content';
            outputContent.innerHTML = mockResponse;
            outputBlock.appendChild(outputContent);

            const blockCopyBtn = outputHeader.querySelector('.block-copy-btn');
            if (blockCopyBtn) {
                blockCopyBtn.addEventListener('click', () => {
                    const content = outputContent.innerText;
                    navigator.clipboard.writeText(content).then(() => {
                        const origClass = blockCopyBtn.className;
                        blockCopyBtn.className = 'ri-check-line block-copy-btn';
                        blockCopyBtn.style.color = 'var(--term-green)';
                        setTimeout(() => {
                            blockCopyBtn.className = origClass;
                            blockCopyBtn.style.color = 'var(--icon-gray)';
                        }, 1500);
                    });
                });
            }
            
            const execTime = document.createElement('div');
            execTime.className = 'execution-time';
            execTime.textContent = `executed in ${executionTime}ms`;
            outputBlock.appendChild(execTime);
            
            const hrDivider = document.createElement('hr');
            hrDivider.style.cssText = 'border: none; border-bottom: 1px dashed var(--border-color); margin: 10px 0 20px 0;';
            outputBlock.appendChild(hrDivider);
            
            outputArea.appendChild(outputBlock);

            executionCount++;
            const promptDisplay = pane.querySelector('.console-prompt');
            if (promptDisplay) promptDisplay.textContent = `In [${executionCount}]:`;
            
            setKernelRunning(false);
            saveConsoleState();
            updateConsoleVariables();
            outputArea.scrollTop = outputArea.scrollHeight;
        }

        function runCommand() {
            const command = inputField.value.trim();
            if (command) {
                const historyLimit = window.appSettings ? window.appSettings.consoleMaxHistory || 50 : 50;

                commandHistory.push(command);
                if (commandHistory.length > historyLimit) {
                    commandHistory = commandHistory.slice(-historyLimit);
                }

                historyIndex = commandHistory.length;
                executeCommand(command);
                inputField.value = '';
                inputField.style.height = 'auto';
            }
        }

        const runBtn = pane.querySelector('.run-btn');
        if (runBtn) runBtn.addEventListener('click', runCommand);

        inputField.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowUp') {
                if (historyIndex > 0) {
                    historyIndex--;
                    inputField.value = commandHistory[historyIndex];
                    e.preventDefault();
                }
            } else if (e.key === 'ArrowDown') {
                if (historyIndex < commandHistory.length - 1) {
                    historyIndex++;
                    inputField.value = commandHistory[historyIndex];
                    e.preventDefault();
                } else if (historyIndex === commandHistory.length - 1) {
                    historyIndex++;
                    inputField.value = '';
                    e.preventDefault();
                }
            }
        });

        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                if (stopBtn.classList.contains('disabled')) return;
                
                setKernelRunning(false);
                const outputBlock = document.createElement('div');
                outputBlock.className = 'output-block';
                outputBlock.innerHTML = `<div class="output-content"><span style="color: var(--term-red);">[Execution Interrupted]</span></div><hr style="border: none; border-bottom: 1px dashed var(--border-color); margin: 10px 0 20px 0;">`;
                outputArea.appendChild(outputBlock);
                outputArea.scrollTop = outputArea.scrollHeight;
                saveConsoleState();
            });
        }

        const trustBtn = pane.querySelector('.tb-trust');
        if (trustBtn) {
            trustBtn.addEventListener('click', (e) => {
                e.preventDefault();
                isTrusted = !isTrusted;
                trustBtn.dataset.trusted = isTrusted;
                const icon = trustBtn.querySelector('i');
                const span = trustBtn.querySelector('span');
                if (!isTrusted) {
                    if (icon) { icon.className = 'ri-shield-flash-line'; icon.style.color = 'var(--color-danger)'; }
                    if (span) span.textContent = 'Untrusted';
                } else {
                    if (icon) { icon.className = 'ri-shield-check-line'; icon.style.color = ''; }
                    if (span) span.textContent = 'Trusted';
                }
                saveConsoleState();
            });
        }

        const restartBtn = pane.querySelector('.icon[title="Restart"]');
        const clearBtn = pane.querySelector('.icon[title="Clear All"]');
        const exportBtn = pane.querySelector('.icon[title="Export"]');
        const copyBtn = pane.querySelector('.icon[title="Copy Output"]');
        const clearHistoryBtn = pane.querySelector('.icon[title="Clear History"]');
        
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                setKernelRunning(true);
                setTimeout(() => {
                    executionCount = 1;
                    const prompt = pane.querySelector('.console-prompt');
                    if (prompt) prompt.textContent = 'In [1]:';
                    setKernelRunning(false);
                    
                    outputArea.innerHTML = `<div class="placeholder-text">${placeholderText}</div>`;
                    saveConsoleState();
                    updateConsoleVariables();
                }, 500);
            });
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                outputArea.innerHTML = `<div class="placeholder-text">${placeholderText}</div>`;
                executionCount = 1;
                const prompt = pane.querySelector('.console-prompt');
                if (prompt) prompt.textContent = 'In [1]:';
                saveConsoleState();
            });
        }
        
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const content = outputArea.innerText;
                const blob = new Blob([content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${language.toLowerCase()}_console_output.txt`;
                a.click();
                URL.revokeObjectURL(url);
            });
        }

        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const content = outputArea.innerText;
                navigator.clipboard.writeText(content).then(() => {
                    const icon = copyBtn.querySelector('i');
                    const origClass = icon.className;
                    icon.className = 'ri-check-line';
                    icon.style.color = 'var(--term-green)';
                    setTimeout(() => {
                        icon.className = origClass;
                        icon.style.color = '';
                    }, 1500);
                });
            });
        }

        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => {
                commandHistory = [];
                historyIndex = 0;
                saveConsoleState();
                
                const icon = clearHistoryBtn.querySelector('i');
                const origClass = icon.className;
                icon.className = 'ri-check-double-line';
                icon.style.color = 'var(--term-green)';
                setTimeout(() => {
                    icon.className = origClass;
                    icon.style.color = '';
                }, 1500);
            });
        }

        const varsBtn = pane.querySelector('.tb-vars');
        const varsCloseBtn = pane.querySelector('.vars-close');
        const varsRefreshBtn = pane.querySelector('.vars-refresh');

        if (varsBtn) {
            varsBtn.addEventListener('click', () => {
                varsPanel.classList.toggle('show');
                if (varsPanel.classList.contains('show')) updateConsoleVariables();
            });
        }

        if (varsCloseBtn) varsCloseBtn.addEventListener('click', () => varsPanel.classList.remove('show'));

        if (varsRefreshBtn) {
            varsRefreshBtn.addEventListener('click', () => {
                varsRefreshBtn.classList.add('spinning');
                updateConsoleVariables().then(() => setTimeout(() => varsRefreshBtn.classList.remove('spinning'), 500));
            });
        }

        setTimeout(() => inputField.focus(), 100);

        tab.addEventListener('click', (e) => {
            if (e.target.classList.contains('close-tab')) return; 
            if(window.switchTab) window.switchTab(targetPaneId); 
            setTimeout(() => inputField.focus(), 50);
        });
        
        const closeBtn = tab.querySelector('.tab-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                window.consoleInstances[activeWinId][language] = false;
            });
        }
        
        outputArea.addEventListener('click', (e) => {
            if (window.getSelection().toString().length === 0) inputField.focus();
        });
    };
})();
