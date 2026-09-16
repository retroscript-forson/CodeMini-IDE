// ==========================================
// editor.js
// ==========================================

// Shared with up-down.js (the upload pipeline): defines which file
// extensions must be read/stored as base64 rather than plain text, since
// reading binary content with file.text() silently corrupts it (UTF-8
// decoding mangles arbitrary bytes). These MUST be defined at true
// top-level/load-time, not lazily inside openFileInTab - up-down.js reads
// window.BINARY_FILE_EXTS at upload time, which can happen before any file
// has ever been opened, so a lazy "window.X = window.X || [...]" inside
// openFileInTab would leave it undefined for that first upload.
window.IMAGE_FILE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp'];
window.VIDEO_FILE_EXTS = ['mp4', 'mov', 'webm', 'ogv', 'm4v'];
window.AUDIO_FILE_EXTS = ['mp3', 'wav', 'ogg', 'm4a', 'flac'];
window.ARCHIVE_FILE_EXTS = ['zip', 'rar', '7z', 'tar', 'gz'];
window.BINARY_FILE_EXTS = [
    ...window.IMAGE_FILE_EXTS, ...window.VIDEO_FILE_EXTS, ...window.AUDIO_FILE_EXTS, ...window.ARCHIVE_FILE_EXTS,
    'mkv', 'avi', 'pdf', 'woff', 'woff2', 'ttf', 'otf',
    // .docx (and legacy .doc) are real zip/binary Word documents now that
    // docs.js saves Documents as actual .docx files instead of portable
    // .html - must be read/stored as base64 or the upload pipeline would
    // corrupt them via text decoding, exactly like any other binary type.
    'doc', 'docx'
];
// Tab types handled by media.js's shared getMediaPlayerHTML/initMediaPlayer/
// teardownMediaPlayer - checked at the two hook points in this file instead
// of an ||-chain, so adding a future media type only means updating this
// list once.
window.MEDIA_TAB_TYPES = ['video', 'image', 'audio'];

require.config({ 
    paths: { 
        'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs',
        'emmet-monaco-es': 'https://unpkg.com/emmet-monaco-es@5.3.0/dist/emmet-monaco.min'
    }
});

const bpStyle = document.createElement('style');
bpStyle.innerHTML = `
    .debug-breakpoint-glyph {
        background: var(--color-danger);
        border-radius: 50%;
        width: 10px !important;
        height: 10px !important;
        margin-left: 5px;
        margin-top: 5px;
        cursor: pointer;
        box-shadow: 0 0 4px rgba(211, 47, 47, 0.6);
    }
    
    /* File Breadcrumb UI */
    .editor-breadcrumb {
        flex-shrink: 0;
        height: 26px;
        display: flex;
        align-items: center;
        padding: 0 6px;
        background: var(--bg-white);
        border-bottom: 1px solid var(--border-color);
        font-size: 13px;
        color: var(--text-muted);
        gap: 2px;
        overflow-x: auto;
        white-space: nowrap;
        user-select: none;
        font-family: var(--font-main);
    }
    .editor-breadcrumb::-webkit-scrollbar {
        display: none;
    }
    .bc-item {
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        transition: background 0.2s, color 0.2s;
    }
    .bc-item:hover {
        background: var(--hover-blue);
        color: var(--text-main);
    }
    .bc-separator {
        font-size: 14px;
        opacity: 0.6;
        margin: 0 2px;
    }
`;
document.head.appendChild(bpStyle);

// --- ISOLATED STATE REGISTRY ---
window.breakpointRegistry = window.breakpointRegistry || {};
window.bpDecorationRegistry = window.bpDecorationRegistry || {};
window.debugLogRegistry = window.debugLogRegistry || {};
window.bpConsoleOutputRegistry = window.bpConsoleOutputRegistry || {};
window.bpConsoleInputRegistry = window.bpConsoleInputRegistry || {};
window._bpConsoleRunningState = window._bpConsoleRunningState || {};

function _getEditorWinId() {
    return typeof cellActiveWinId !== 'undefined' ? cellActiveWinId : (localStorage.getItem('codemini_active_window') || 'win_default');
}

function initEditorWindowState(winId) {
    if (!window.breakpointRegistry[winId]) window.breakpointRegistry[winId] = {};
    if (!window.bpDecorationRegistry[winId]) window.bpDecorationRegistry[winId] = {};
    if (!window.bpConsoleOutputRegistry[winId]) window.bpConsoleOutputRegistry[winId] = '';
    if (!window.bpConsoleInputRegistry[winId]) window.bpConsoleInputRegistry[winId] = '';
    if (!window.debugLogRegistry[winId]) window.debugLogRegistry[winId] = '<em>Debug console ready. Set breakpoints and run to execute the active file.</em>';
}

function getFileContextFromEditor(editor) {
    const pane = editor.getContainerDomNode().closest('.content-pane');
    if (!pane) return { fileId: null, fileName: 'unknown' };
    const tab = document.querySelector(`.tab[data-target="${pane.id}"]`);
    return {
        fileId: tab ? tab.dataset.fileId : null,
        fileName: tab ? tab.querySelector('span').textContent : 'unknown'
    };
}

window.toggleBreakpoint = function(editor, lineNumber) {
    const winId = _getEditorWinId();
    initEditorWindowState(winId);
    
    const { fileId, fileName } = getFileContextFromEditor(editor);
    if (!fileId) return;
    
    if (!window.breakpointRegistry[winId][fileId]) {
        window.breakpointRegistry[winId][fileId] = { fileName: fileName, lines: [] };
    }

    const idx = window.breakpointRegistry[winId][fileId].lines.indexOf(lineNumber);
    if (idx > -1) {
        window.breakpointRegistry[winId][fileId].lines.splice(idx, 1);
    } else {
        window.breakpointRegistry[winId][fileId].lines.push(lineNumber);
    }

    const decorations = window.breakpointRegistry[winId][fileId].lines.map(ln => ({
        range: new monaco.Range(ln, 1, ln, 1),
        options: {
            isWholeLine: false,
            glyphMarginClassName: 'debug-breakpoint-glyph'
        }
    }));

    window.bpDecorationRegistry[winId][fileId] = editor.deltaDecorations(window.bpDecorationRegistry[winId][fileId] || [], decorations);
    if (window.updateDebugPanel) window.updateDebugPanel();
};

window.clearAllBreakpoints = function() {
    const winId = _getEditorWinId();
    window.breakpointRegistry[winId] = {}; 
    window.bpDecorationRegistry[winId] = {}; 
    
    if (window.monaco) { 
        window.monaco.editor.getEditors().forEach(e => {
            if(e.getModel()) {
                e.deltaDecorations(e.getModel().getAllDecorations().map(d => d.id), []);
            }
        });
    } 
    if (window.updateDebugPanel) window.updateDebugPanel();
};

window.saveBottomPanelContext = function(winId) {
    initEditorWindowState(winId);
    const outputEl = document.getElementById('bpConsoleOutput');
    if (outputEl) {
        window.bpConsoleOutputRegistry[winId] = outputEl.innerHTML;
    }
    const inputEl = document.getElementById('bpConsoleInput');
    if (inputEl) {
        window.bpConsoleInputRegistry[winId] = inputEl.value;
    }
    if (typeof window.disconnectBottomTerminal === 'function') {
        window.disconnectBottomTerminal();
    }
};

window.restoreBottomPanelContext = function(winId) {
    initEditorWindowState(winId);
    const outputEl = document.getElementById('bpConsoleOutput');
    if (outputEl) {
        outputEl.innerHTML = window.bpConsoleOutputRegistry[winId] || `
            <div style="margin-bottom: 5px; color: var(--accent-blue);">[Info] CodeMini IDE v1.0.0</div>
            <div>[Info] Ready for execution. Context Switched.</div>
        `;
    }
    const inputEl = document.getElementById('bpConsoleInput');
    if (inputEl) {
        inputEl.value = window.bpConsoleInputRegistry[winId] || '';
    }

    const problemsContent = document.getElementById('problemsPanelContent');
    if (problemsContent) problemsContent.innerHTML = '<div class="empty-state" style="padding: 20px; text-align: center; color: var(--text-muted);">No problems detected in open files.</div>';
    
    const problemsToggle = document.getElementById('statusProblemsToggle');
    if (problemsToggle) {
        problemsToggle.innerHTML = `<i class="ri-error-warning-line"></i> 0`;
        problemsToggle.style.color = 'var(--text-main)';
    }

    if (window.updateDebugPanel) window.updateDebugPanel();
};

window.printDebugSystem = function(msg) {
    const winId = _getEditorWinId();
    initEditorWindowState(winId);
    window.debugLogRegistry[winId] += `<br><span style="color:var(--icon-yellow)">[System] ${msg}</span>`;
    
    const debugLog = document.getElementById('debugLog');
    if (debugLog) {
        debugLog.innerHTML = window.debugLogRegistry[winId];
        debugLog.scrollTop = debugLog.scrollHeight;
    }
};

window.runDebugSession = async function() {
    const winId = _getEditorWinId();
    initEditorWindowState(winId);

    const activePane = document.querySelector('.editor-group.active-group .content-pane.active') || document.querySelector('.content-pane.active');
    if (!activePane || !window.monaco) return;
    const editorContainer = activePane.querySelector('[id^="editor-container-"]');
    if (!editorContainer) return;
    const editor = window.monaco.editor.getEditors().find(e => editorContainer.contains(e.getContainerDomNode()));
    if (!editor) return;

    const code = editor.getValue();
    const tabEl = document.querySelector(`.tab[data-target="${activePane.id}"]`);
    const fileId = tabEl ? tabEl.dataset.fileId : null;
    const fileName = tabEl ? tabEl.querySelector('span').textContent : 'script';
    const ext = fileName.split('.').pop().toLowerCase();

    const bpsObj = window.breakpointRegistry[winId][fileId];
    const bps = bpsObj ? bpsObj.lines : [];
    let lines = code.split('\n');

    window.debugLogRegistry[winId] += `<br><span style="color:var(--accent-blue)">\n[Start] Debugging ${fileName}...</span>`;
    const debugLog = document.getElementById('debugLog');
    if (debugLog) debugLog.innerHTML = window.debugLogRegistry[winId];

    if (ext === 'js' || ext === 'ts' || ext === 'javascript') {
        bps.sort((a,b) => b-a).forEach(ln => {
            if (ln - 1 < lines.length) lines[ln - 1] = `debugger; ${lines[ln - 1]}`;
        });
        const debugCode = lines.join('\n');
        
        window.debugLogRegistry[winId] += `<br><span style="color:var(--icon-yellow)">[Info] Native debugger invoked. Check your browser's Developer Tools (F12) to step through breakpoints interactively!</span>`;
        if (debugLog) debugLog.innerHTML = window.debugLogRegistry[winId];
        
        setTimeout(async () => {
            const origLog = console.log;
            const origError = console.error;
            let capturedLogs = "";
            
            console.log = (...args) => { capturedLogs += "[Log] " + args.join(' ') + '\n'; origLog(...args); };
            console.error = (...args) => { capturedLogs += "[Error] " + args.join(' ') + '\n'; origError(...args); }

            try {
                const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                const res = await (new AsyncFunction(debugCode))();

                if (capturedLogs) window.debugLogRegistry[winId] += `<br><pre style="color:var(--term-blue); margin: 5px 0; white-space: pre-wrap; font-size: 12px; border-left: 2px solid var(--border-color); padding-left: 8px;">${capturedLogs.replace(/</g, '&lt;')}</pre>`;
                if (res !== undefined) window.debugLogRegistry[winId] += `<br><span style="color:var(--term-green)">[Success] Returned: ${res}</span>`;
            } catch(e) {
                window.debugLogRegistry[winId] += `<br><span style="color:var(--color-danger)">[Exception] ${e.name}: ${e.message}</span>`;
            } finally {
                console.log = origLog;
                console.error = origError;
            }
            if (window.updateDebugPanel) window.updateDebugPanel();
        }, 100);
    } else if (ext === 'py') {
        bps.sort((a,b) => b-a).forEach(ln => {
            if (ln - 1 < lines.length) {
                const indent = lines[ln-1].match(/^\s*/)[0];
                lines.splice(ln-1, 0, `${indent}print("[DEBUG] Hit breakpoint at line ${ln}", flush=True)`);
            }
        });
        const debugCode = lines.join('\n');
        if (window.getPyodideInstance) {
            const py = await window.getPyodideInstance();
            if (py) {
                try {
                    py.runPython(`import sys, io; sys.stdout = io.StringIO(); sys.stderr = io.StringIO()`);
                    await py.runPythonAsync(debugCode);
                    const out = py.runPython("sys.stdout.getvalue()");
                    const err = py.runPython("sys.stderr.getvalue()");
                    
                    if (out) window.debugLogRegistry[winId] += `<br><pre style="color:var(--text-main); margin: 5px 0; border-left: 2px solid var(--border-color); padding-left: 8px;">${out.replace(/</g, '&lt;')}</pre>`;
                    if (err) window.debugLogRegistry[winId] += `<br><pre style="color:var(--color-danger); margin: 5px 0; border-left: 2px solid var(--color-danger); padding-left: 8px;">${err.replace(/</g, '&lt;')}</pre>`;
                    window.debugLogRegistry[winId] += `<br><span style="color:var(--term-green)">[Finished] Python debug execution.</span>`;
                } catch(e) {
                    window.debugLogRegistry[winId] += `<br><span style="color:var(--color-danger)">[Error] ${e.message}</span>`;
                }
            }
        }
        if (window.updateDebugPanel) window.updateDebugPanel();
    } else {
        window.debugLogRegistry[winId] += `<br><span style="color:var(--color-danger)">[Error] Debugging not supported for .${ext} files.</span>`;
        if (window.updateDebugPanel) window.updateDebugPanel();
    }
};

window.updateDebugPanel = async function() {
    const debugPanel = document.getElementById('debugPanelContent');
    if (!debugPanel || debugPanel.style.display === 'none') return;

    const winId = _getEditorWinId();
    initEditorWindowState(winId);
    
    const activePane = document.querySelector('.editor-group.active-group .content-pane.active') || document.querySelector('.content-pane.active');
    let varsHtml = '<div style="color: var(--text-muted); font-size: 12px; margin-bottom: 25px;">No variables in scope</div>';

    if (activePane) {
        const tabEl = document.querySelector(`.tab[data-target="${activePane.id}"]`);
        if (tabEl) {
            const fileName = tabEl.querySelector('span').textContent;
            const ext = fileName.split('.').pop().toLowerCase();
            
            if (ext === 'js' || ext === 'ts' || ext === 'javascript') {
                let vars = [];
                const excludeKeys = ['monaco', 'appSettings', 'db', 'breakpointRegistry', 'bpDecorationRegistry', 'debugLogRegistry', 'require', 'openedTabs', 'workspacesList', 'recentlyClosed', 'recycleBin', 'consoleInstances'];
                
                for (let key in window) {
                    if (window.hasOwnProperty(key) && !excludeKeys.includes(key)) {
                        try {
                            if (typeof window[key] !== 'function' && key !== 'window' && key !== 'document' && key !== 'localStorage' && key !== 'sessionStorage') {
                                let valStr = window[key];
                                if (valStr === null) valStr = 'null';
                                else if (typeof valStr === 'object') {
                                    if (Array.isArray(valStr)) valStr = `Array(${valStr.length})`;
                                    else if (valStr instanceof HTMLElement) valStr = `<${valStr.tagName.toLowerCase()}>`;
                                    else valStr = '[Object]';
                                } else valStr = String(valStr);
                                
                                vars.push(`
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--border-color); gap: 10px;">
                                        <span style="font-weight: 600; color: var(--accent-blue); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${key}</span>
                                        <span style="font-family: monospace; color: var(--text-main); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60%;" title="${valStr.replace(/"/g, '&quot;')}">${valStr}</span>
                                    </div>
                                `);
                            }
                        } catch(e){}
                    }
                }
                if (vars.length) varsHtml = `<div style="display:flex; flex-direction:column; margin-bottom: 25px; max-height: 200px; overflow-y: auto; padding-right: 4px;">${vars.slice(0, 30).join('')}</div>`;
            } else if (ext === 'py') {
                 try {
                     const py = await window.getPyodideInstance();
                     if (py) {
                         const pyVars = py.runPython(`
import json
vars_dict = {k: str(v)[:40] for k, v in globals().items() if not k.startswith('_') and type(v).__name__ not in ['module', 'function', 'type', 'builtin_function_or_method']}
json.dumps(vars_dict)
                         `);
                         const parsed = JSON.parse(pyVars);
                         let items = [];
                         for(let k in parsed) {
                             items.push(`
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--border-color); gap: 10px;">
                                    <span style="font-weight: 600; color: var(--accent-blue); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${k}</span>
                                    <span style="font-family: monospace; color: var(--text-main); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60%;" title="${String(parsed[k]).replace(/"/g, '&quot;')}">${parsed[k]}</span>
                                </div>
                             `);
                         }
                         if (items.length) varsHtml = `<div style="display:flex; flex-direction:column; margin-bottom: 25px; max-height: 200px; overflow-y: auto; padding-right: 4px;">${items.join('')}</div>`;
                     }
                 } catch(e) {}
            }
        }
    }

    let bpListHtml = '<div style="color: var(--text-muted); font-size: 12px;">No breakpoints</div>';
    let bps = [];
    const currentBps = window.breakpointRegistry[winId] || {};
    
    for (let fId in currentBps) {
        const data = currentBps[fId];
        data.lines.forEach(ln => {
            bps.push(`
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 6px 8px; background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 2px; margin-bottom: 6px;">
                    <div style="display:flex; align-items:center; gap:8px;" title="File ${data.fileName} - Line ${ln}">
                        <div style="width:8px; height:8px; border-radius:50%; background:var(--color-danger); box-shadow: 0 0 4px rgba(211,47,47,0.4);"></div>
                        <span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-main);">${data.fileName}:${ln}</span>
                    </div>
                </div>
            `);
        });
    }
    if (bps.length) bpListHtml = `<div style="display:flex; flex-direction:column; max-height: 150px; overflow-y: auto; padding-right: 4px;">${bps.join('')}</div>`;

    debugPanel.innerHTML = `
        <div class="debug-layout">
            <div class="debug-sidebar">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 700; color: var(--text-main); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Variables</span>
                    <i class="ri-refresh-line debug-btn" style="font-size: 14px;" onclick="window.updateDebugPanel()" title="Refresh Variables"></i>
                </div>
                ${varsHtml}
                <div style="font-weight: 700; margin-bottom: 8px; color: var(--text-main); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Breakpoints</div>
                ${bpListHtml}
            </div>
            <div class="debug-main-area">
                <div id="debugLog" style="flex:1; overflow:auto; font-family:var(--font-mono); font-size:13px; color:var(--text-main); padding:15px; line-height: 1.5;">
                    ${window.debugLogRegistry[winId]}
                </div>
                <div class="debug-action-bar">
                    <i class="ri-play-fill debug-btn play" onclick="window.runDebugSession()" title="Run / Continue"></i>
                    <i class="ri-pause-line debug-btn" onclick="window.printDebugSystem('Pause requested. (Use DevTools for native JS pausing)')" title="Pause"></i>
                    <div style="width: 1px; height: 16px; background: var(--border-color); margin: 0 8px;"></div>
                    <i class="ri-arrow-go-forward-line debug-btn" onclick="window.printDebugSystem('Step Over (F10) - Triggered.')" title="Step Over"></i>
                    <i class="ri-download-line debug-btn" onclick="window.printDebugSystem('Step Into (F11) - Triggered.')" title="Step Into"></i>
                    <i class="ri-upload-line debug-btn" onclick="window.printDebugSystem('Step Out (Shift+F11) - Triggered.')" title="Step Out"></i>
                    <i class="ri-refresh-line debug-btn" onclick="window.runDebugSession()" title="Restart"></i>
                    <div style="width: 1px; height: 16px; background: var(--border-color); margin: 0 8px;"></div>
                    <i class="ri-delete-bin-line debug-btn" onclick="window.clearAllBreakpoints()" title="Clear Breakpoints"></i>
                    <i class="ri-eraser-line debug-btn" onclick="window.debugLogRegistry[_getEditorWinId()] = '<em>Debug console cleared. Ready.</em>'; document.getElementById('debugLog').innerHTML = window.debugLogRegistry[_getEditorWinId()];" title="Clear Debug Log"></i>
                </div>
            </div>
        </div>
    `;
};

require(['vs/editor/editor.main'], function() {
    window.monaco = monaco;
    monaco.languages.html.htmlDefaults.setOptions({ suggest: { html5: true, angular1: false, ionic: false } });
    
    require(['emmet-monaco-es'], function(emmet) {
        if (emmet && emmet.emmetHTML) {
            emmet.emmetHTML(monaco);
            emmet.emmetCSS(monaco);
            emmet.emmetJSX(monaco);
        }
    }, function(err) {
        console.warn('Emmet extension could not be loaded via CDN.');
    });
    
    function updateProblemsPanel() {
        if (!window.monaco) return;
        
        let allMarkers = monaco.editor.getModelMarkers({});
        let markers = allMarkers.filter(m => m.severity === monaco.MarkerSeverity.Error || m.severity === monaco.MarkerSeverity.Warning);
        markers.sort((a, b) => b.severity - a.severity);

        const problemsToggleEl = document.getElementById('statusProblemsToggle');
        const contentEl = document.getElementById('problemsPanelContent');

        const grouped = {};
        markers.forEach(m => {
            const uriStr = m.resource.toString();
            if (!grouped[uriStr]) grouped[uriStr] = [];
            grouped[uriStr].push(m);
        });

        let html = '';
        const editors = monaco.editor.getEditors();
        
        let totalActiveErrors = 0;
        let totalActiveWarnings = 0;

        for (const [uri, fileMarkers] of Object.entries(grouped)) {
            let fileName = uri;
            let targetPaneId = null;

            for (const ed of editors) {
                const model = ed.getModel();
                if (model && model.uri.toString() === uri) {
                    const container = ed.getContainerDomNode();
                    const pane = container.closest('.content-pane');
                    if (pane) {
                        targetPaneId = pane.id;
                        const tab = document.querySelector(`.tab[data-target="${pane.id}"]`);
                        if (tab) fileName = tab.querySelector('span').textContent;
                    }
                    break;
                }
            }

            if (!targetPaneId) continue;

            totalActiveErrors += fileMarkers.filter(m => m.severity === monaco.MarkerSeverity.Error).length;
            totalActiveWarnings += fileMarkers.filter(m => m.severity === monaco.MarkerSeverity.Warning).length;

            const fileIconHTML = typeof getFileIconHTML === 'function' ? getFileIconHTML(fileName) : '<i class="ri-file-code-line file-icon"></i>';

            const switchLogic = `if(window.switchTab) { window.switchTab('${targetPaneId}'); const p = document.getElementById('${targetPaneId}'); if(p){ const g = p.closest('.editor-group'); if(g){ document.querySelectorAll('.editor-group').forEach(eg => eg.classList.remove('active-group')); g.classList.add('active-group'); if (typeof activeGroupId !== 'undefined') activeGroupId = g.id; window.activeGroupId = g.id; } } }`;

            html += `<div class="problem-file" style="cursor: pointer; transition: background 0.2s;" onclick="${switchLogic}" onmouseover="this.style.background='var(--hover-blue)'" onmouseout="this.style.background='var(--bg-panel)'">
                        ${fileIconHTML} <span style="font-family: var(--font-main);">${fileName}</span> 
                        <span style="font-size: 10px; font-weight: normal; color: var(--text-muted); margin-left: auto;">${fileMarkers.length} issues</span>
                     </div>`;

            fileMarkers.forEach(m => {
                const isErr = m.severity === monaco.MarkerSeverity.Error;
                const icon = isErr ? 'ri-error-warning-fill' : 'ri-alert-fill';
                const colorClass = isErr ? 'error' : 'warning';
                
                html += `
                    <div class="problem-row" onclick="${switchLogic}">
                        <i class="${icon} problem-icon ${colorClass}"></i>
                        <div style="display: flex; flex-direction: column;">
                            <span style="color: var(--text-main);">${m.message}</span>
                            <span style="color: var(--text-muted); font-size: 10px;">[Line ${m.startLineNumber}, Col ${m.startColumn}]</span>
                        </div>
                    </div>
                `;
            });
        }

        const total = totalActiveErrors + totalActiveWarnings;

        if (problemsToggleEl) {
            if (total === 0) {
                problemsToggleEl.innerHTML = `<i class="ri-error-warning-line"></i> 0`;
                problemsToggleEl.style.color = 'var(--text-main)';
            } else {
                problemsToggleEl.innerHTML = `<i class="ri-close-circle-line"></i> ${totalActiveErrors} <i class="ri-alert-line" style="margin-left: 5px;"></i> ${totalActiveWarnings}`;
                problemsToggleEl.style.color = totalActiveErrors > 0 ? 'var(--color-danger)' : 'var(--icon-yellow)';
            }
        }

        if (contentEl) {
            if (total === 0) {
                contentEl.innerHTML = '<div class="empty-state" style="padding: 20px; text-align: center; color: var(--text-muted);">No problems detected in open files.</div>';
            } else {
                contentEl.innerHTML = html;
            }
        }
    }

    let markerDebounce;
    monaco.editor.onDidChangeMarkers(() => {
        clearTimeout(markerDebounce);
        markerDebounce = setTimeout(updateProblemsPanel, 300);
    });

    const originalCreate = monaco.editor.create;
    monaco.editor.create = function(container, options, ...args) {
        const theme = (window.appSettings && typeof window.isThemeDark === 'function' && window.isThemeDark()) ? 'vs-dark' : 'vs-light';
        const mergedOptions = {
            theme: theme,
            fontSize: window.appSettings ? window.appSettings.fontSize : 13,
            fontFamily: window.appSettings ? window.appSettings.fontFamily : "'Fira Code', monospace",
            fontWeight: window.appSettings ? window.appSettings.fontWeight : 'normal',
            lineHeight: window.appSettings ? window.appSettings.lineHeight : 21,
            letterSpacing: window.appSettings ? window.appSettings.letterSpacing : 0.3,
            fontLigatures: window.appSettings ? window.appSettings.fontLigatures : true,
            tabSize: window.appSettings ? window.appSettings.tabSize : 4,
            insertSpaces: window.appSettings ? window.appSettings.insertSpaces : true,
            wordWrap: window.appSettings ? window.appSettings.wordWrap : 'off',
            minimap: { enabled: window.appSettings ? window.appSettings.minimap : false },
            lineNumbers: window.appSettings ? window.appSettings.lineNumbers : 'on',
            renderWhitespace: window.appSettings ? window.appSettings.renderWhitespace : 'none',
            smoothScrolling: window.appSettings ? window.appSettings.smoothScrolling : true,
            cursorStyle: window.appSettings ? window.appSettings.cursorStyle : 'line',
            cursorBlinking: window.appSettings ? window.appSettings.cursorBlinking : 'blink',
            glyphMargin: true, 
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: "smart",
            acceptSuggestionOnCommitCharacter: true,
            snippetSuggestions: "inline",
            suggest: {
                showKeywords: true, showSnippets: true, showClasses: true,
                showVariables: true, showFunctions: true, showModules: true
            },
            
            // Re-wired New Settings Configuration
            mouseWheelZoom: window.appSettings ? window.appSettings.mouseWheelZoom : false,
            folding: window.appSettings ? window.appSettings.editorFolding : true,
            renderLineHighlight: window.appSettings ? window.appSettings.renderLineHighlight : 'line',
            matchBrackets: window.appSettings ? window.appSettings.matchBrackets : 'always',
            cursorWidth: window.appSettings ? window.appSettings.cursorWidth : 2,

            // Fix for bracket pairs strict requirement config mapping
            bracketPairColorization: { enabled: window.appSettings ? window.appSettings.bracketPairs : true },
            guides: { bracketPairs: window.appSettings ? window.appSettings.bracketPairs : true },

            ...options 
        };
        const editorInstance = originalCreate.call(this, container, mergedOptions, ...args);

        editorInstance.onMouseDown(function (e) {
            if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
                const lineNumber = e.target.position.lineNumber;
                window.toggleBreakpoint(editorInstance, lineNumber);
            }
        });
        
        // Sync Ln, Col to Status Bar dynamically
        editorInstance.onDidChangeCursorPosition(e => {
            const statusLnCol = document.getElementById('statusLnCol');
            if (statusLnCol) {
                const pane = editorInstance.getContainerDomNode().closest('.content-pane');
                if (pane && pane.classList.contains('active')) {
                    statusLnCol.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
                }
            }
        });

        editorInstance.addAction({
            id: 'run-in-bottom-console',
            label: 'Run in console',
            contextMenuGroupId: '1_modification',
            contextMenuOrder: 1.5,
            precondition: 'editorHasSelection',
            run: function (ed) {
                const selection = ed.getSelection();
                const text = ed.getModel().getValueInRange(selection);
                if (text) {
                    const lang = ed.getModel().getLanguageId();
                    let ext = lang === 'python' ? 'py' : (lang === 'javascript' ? 'js' : lang);
                    if(window.runInBottomConsole) window.runInBottomConsole(text, ext);
                }
            }
        });

        const winId = _getEditorWinId();
        const { fileId } = getFileContextFromEditor(editorInstance);
        
        if (fileId && window.breakpointRegistry[winId] && window.breakpointRegistry[winId][fileId]) {
            const decorations = window.breakpointRegistry[winId][fileId].lines.map(ln => ({
                range: new monaco.Range(ln, 1, ln, 1),
                options: { isWholeLine: false, glyphMarginClassName: 'debug-breakpoint-glyph' }
            }));
            window.bpDecorationRegistry[winId][fileId] = editorInstance.deltaDecorations([], decorations);
        }

        setTimeout(updateProblemsPanel, 100);
        return editorInstance;
    };
    
    // --- Hook Up the Tab Size / Space Status Bar Component ---
    const spacesBtn = document.getElementById('statusSpaces');
    if (spacesBtn) {
        window.updateSpacesText = () => {
            const isSpaces = window.appSettings ? window.appSettings.insertSpaces : true;
            const size = window.appSettings ? window.appSettings.tabSize : 4;
            spacesBtn.textContent = `${isSpaces ? 'Spaces' : 'Tabs'}: ${size}`;
        };
        window.updateSpacesText();

        spacesBtn.addEventListener('click', () => {
            // Rapid-Cycle through standard configurations
            let isSpaces = window.appSettings.insertSpaces;
            let size = window.appSettings.tabSize;
            if (isSpaces && size === 4) { size = 2; }
            else if (isSpaces && size === 2) { isSpaces = false; size = 4; }
            else if (!isSpaces && size === 4) { size = 2; }
            else { isSpaces = true; size = 4; }

            if (typeof window.saveSetting === 'function') {
                window.saveSetting('insertSpaces', isSpaces);
                window.saveSetting('tabSize', size);
            } else {
                window.appSettings.insertSpaces = isSpaces;
                window.appSettings.tabSize = size;
            }
            window.updateSpacesText();
        });
    }

    const lfBtn = document.getElementById('statusLineEnding');
    if (lfBtn) {
        lfBtn.addEventListener('click', () => {
            if (window.monaco) {
                const activePane = document.querySelector('.editor-group.active-group .content-pane.active') || document.querySelector('.content-pane.active');
                if (!activePane) return;
                const editorContainer = activePane.querySelector('[id^="editor-container-"]');
                if (editorContainer) {
                    const editor = window.monaco.editor.getEditors().find(e => editorContainer.contains(e.getContainerDomNode()));
                    if (editor) {
                        const model = editor.getModel();
                        const currentEOL = model.getEOL();
                        if (currentEOL === '\n') {
                            model.setEOL(window.monaco.editor.EndOfLineSequence.CRLF);
                            lfBtn.textContent = 'CRLF';
                        } else {
                            model.setEOL(window.monaco.editor.EndOfLineSequence.LF);
                            lfBtn.textContent = 'LF';
                        }
                    }
                }
            }
        });
    }

    const utfBtn = document.getElementById('statusEncoding');
    if (utfBtn) {
        utfBtn.addEventListener('click', () => {
            if(window.showCustomModal) {
                window.showCustomModal({ 
                    title: 'File Encoding', 
                    text: 'The text environment uses standard UTF-8 encoding. Modifying encoding formats is not permitted in the browser.', 
                    submitText: 'OK' 
                }, () => {});
            }
        });
    }

    const panel = document.getElementById('problemsPanel');
    const bpTabs = document.querySelectorAll('.bottom-panel-tab');
    const bpContents = document.querySelectorAll('.bottom-panel-content');

    bpTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            bpTabs.forEach(t => t.classList.remove('active'));
            bpContents.forEach(c => c.style.display = 'none');

            tab.classList.add('active');
            const targetId = tab.getAttribute('data-target');
            const targetContent = document.getElementById(targetId);
            
            const header = document.querySelector('.bottom-panel-header');
            if (header) {
                if (targetId === 'debugPanelContent') header.classList.add('debug-active');
                else header.classList.remove('debug-active');
            }
            
            if (targetContent) {
                targetContent.style.display = targetId === 'problemsPanelContent' ? 'block' : 'flex';
                if(targetId === 'problemsPanelContent') updateProblemsPanel();
                if(targetId === 'debugPanelContent') if (window.updateDebugPanel) window.updateDebugPanel();
            }

            if (window.saveCurrentUIState) window.saveCurrentUIState();
        });
    });

    function openBottomPanelToTab(tabTargetId) {
        if (panel) {
            if (panel.style.display === 'none') panel.style.display = 'flex';
            const tabToClick = document.querySelector(`.bottom-panel-tab[data-target="${tabTargetId}"]`);
            if (tabToClick) tabToClick.click();
            if (window.saveCurrentUIState) window.saveCurrentUIState();
        }
    }

    const probToggle = document.getElementById('statusProblemsToggle');
    const consoleToggle = document.getElementById('statusConsoleToggle');
    const debugToggle = document.getElementById('statusDebugToggle');

    if (probToggle) probToggle.addEventListener('click', () => {
        const targetTab = document.querySelector('.bottom-panel-tab[data-target="problemsPanelContent"]');
        if (panel.style.display === 'flex' && targetTab.classList.contains('active')) panel.style.display = 'none';
        else openBottomPanelToTab('problemsPanelContent');
        if (window.saveCurrentUIState) window.saveCurrentUIState();
    });

    if (consoleToggle) consoleToggle.addEventListener('click', () => {
        const targetTab = document.querySelector('.bottom-panel-tab[data-target="consolePanelContent"]');
        if (panel.style.display === 'flex' && targetTab.classList.contains('active')) panel.style.display = 'none';
        else openBottomPanelToTab('consolePanelContent');
        if (window.saveCurrentUIState) window.saveCurrentUIState();
    });

    if (debugToggle) debugToggle.addEventListener('click', () => {
        const targetTab = document.querySelector('.bottom-panel-tab[data-target="debugPanelContent"]');
        if (panel.style.display === 'flex' && targetTab.classList.contains('active')) panel.style.display = 'none';
        else openBottomPanelToTab('debugPanelContent');
        if (window.saveCurrentUIState) window.saveCurrentUIState();
    });
    
    document.addEventListener('click', (e) => {
        if (e.target.id === 'closeProblemsPanel') {
            if (panel) panel.style.display = 'none';
            if (window.saveCurrentUIState) window.saveCurrentUIState();
        }
    });

    // Implement line jumper input handler
    const statusLnCol = document.getElementById('statusLnCol');
    const gotoLinePopover = document.getElementById('gotoLinePopover');
    const gotoLineInput = document.getElementById('gotoLineInput');

    if (statusLnCol && gotoLinePopover) {
        statusLnCol.addEventListener('click', (e) => {
            e.stopPropagation();
            gotoLinePopover.style.display = gotoLinePopover.style.display === 'none' ? 'block' : 'none';
            if (gotoLinePopover.style.display === 'block') {
                gotoLineInput.focus();
                gotoLineInput.value = '';
            }
        });

        document.addEventListener('click', (e) => {
            if (!statusLnCol.contains(e.target) && !gotoLinePopover.contains(e.target)) {
                gotoLinePopover.style.display = 'none';
            }
        });

        gotoLineInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const val = gotoLineInput.value.trim();
                if (val && window.monaco) {
                    const parts = val.split(':');
                    const ln = parseInt(parts[0], 10);
                    const col = parts.length > 1 ? parseInt(parts[1], 10) : 1;

                    const activePane = document.querySelector('.editor-group.active-group .content-pane.active') || document.querySelector('.content-pane.active');
                    if (activePane) {
                        const editorContainer = activePane.querySelector('[id^="editor-container-"]');
                        if (editorContainer) {
                            const editor = window.monaco.editor.getEditors().find(ed => editorContainer.contains(ed.getContainerDomNode()));
                            if (editor && !isNaN(ln)) {
                                editor.setPosition({lineNumber: ln, column: !isNaN(col) ? col : 1});
                                editor.revealLineInCenter(ln);
                                editor.focus();
                            }
                        }
                    }
                }
                gotoLinePopover.style.display = 'none';
            }
        });
    }
});

function getFileIconHTML(filename) {
    const parts = filename.split('.'); 
    const isDotFile = filename.startsWith('.') && parts.length === 2 && !parts[1];
    const ext = isDotFile ? filename.substring(1).toLowerCase() : (parts.length > 1 ? parts.pop().toLowerCase() : '');
    const exactName = filename.toLowerCase();
    const theme = (window.appSettings && window.appSettings.iconTheme) || 'Remix Icons';
    
    if (theme === 'Font Awesome') {
        if (exactName === 'dockerfile' || exactName === 'docker-compose.yml') return '<i class="fab fa-docker file-icon" style="color: #2496ed;"></i>';
        if (exactName === 'makefile') return '<i class="fas fa-hammer file-icon" style="color: var(--icon-gray);"></i>';
        if (exactName === 'package.json' || exactName === 'package-lock.json') return '<i class="fab fa-npm file-icon" style="color: #cb3837;"></i>';

        switch(ext) {
            case 'js': case 'mjs': case 'cjs': return '<i class="fab fa-js file-icon" style="color: var(--icon-js);"></i>';
            case 'ts': return '<i class="fas fa-file-code file-icon" style="color: #3178c6;"></i>';
            case 'jsx': case 'tsx': return '<i class="fab fa-react file-icon" style="color: #61dafb;"></i>';
            case 'vue': return '<i class="fab fa-vuejs file-icon" style="color: #41b883;"></i>';
            case 'py': case 'pyw': case 'pyc': return '<i class="fab fa-python file-icon" style="color: var(--icon-py);"></i>';
            case 'html': case 'htm': return '<i class="fab fa-html5 file-icon" style="color: var(--icon-html);"></i>';
            case 'css': return '<i class="fab fa-css3-alt file-icon" style="color: var(--icon-css);"></i>';
            case 'scss': case 'sass': case 'less': return '<i class="fab fa-sass file-icon" style="color: #cc6699;"></i>';
            case 'json': return '<i class="fas fa-code file-icon" style="color: var(--icon-json);"></i>';
            case 'yaml': case 'yml': case 'toml': return '<i class="fas fa-cogs file-icon" style="color: #cb171e;"></i>';
            case 'xml': return '<i class="fas fa-code file-icon" style="color: #ff6600;"></i>';
            case 'md': case 'markdown': return '<i class="fab fa-markdown file-icon" style="color: var(--icon-md);"></i>';
            case 'java': case 'jar': case 'class': return '<i class="fab fa-java file-icon" style="color: var(--icon-java);"></i>';
            case 'cpp': case 'c': case 'cxx': case 'h': case 'hpp': return '<i class="fas fa-file-code file-icon" style="color: #00599C;"></i>';
            case 'cs': return '<i class="fas fa-file-code file-icon" style="color: #178600;"></i>';
            case 'go': return '<i class="fas fa-code file-icon" style="color: #00add8;"></i>';
            case 'rs': return '<i class="fas fa-cog file-icon" style="color: #dea584;"></i>';
            case 'php': return '<i class="fab fa-php file-icon" style="color: #777bb4;"></i>';
            case 'rb': case 'erb': return '<i class="far fa-gem file-icon" style="color: #cc342d;"></i>';
            case 'sh': case 'bash': case 'zsh': case 'bat': case 'cmd': return '<i class="fas fa-terminal file-icon" style="color: var(--text-main);"></i>';
            case 'sql': case 'db': case 'sqlite': return '<i class="fas fa-database file-icon" style="color: #e38c00;"></i>';
            case 'ipynb': return '<i class="fas fa-book file-icon" style="color: var(--icon-py);"></i>';
            case 'irnb': return '<i class="fas fa-book file-icon" style="color: #276dc3;"></i>';
            case 'sqlnb': return '<i class="fas fa-book file-icon" style="color: #4CAF50;"></i>';
            case 'csv': case 'tsv': return '<i class="fas fa-file-csv file-icon" style="color: #217346;"></i>';
            case 'txt': case 'log': return '<i class="fas fa-file-alt file-icon" style="color: var(--icon-gray);"></i>';
            case 'png': case 'jpg': case 'jpeg': case 'svg': case 'gif': case 'ico': case 'webp': case 'bmp': return '<i class="fas fa-image file-icon" style="color: #4caf50;"></i>';
            case 'zip': case 'rar': case '7z': case 'tar': case 'gz': return '<i class="fas fa-file-archive file-icon" style="color: #fbbc04;"></i>';
            case 'mp4': case 'mkv': case 'avi': case 'webm': case 'mov': case 'ogv': case 'm4v': return '<i class="fas fa-file-video file-icon" style="color: #ea4335;"></i>';
            case 'mp3': case 'wav': case 'ogg': case 'm4a': case 'flac': return '<i class="fas fa-file-audio file-icon" style="color: #34a853;"></i>';
            case 'gitignore': case 'env': case 'editorconfig': return '<i class="fas fa-sliders-h file-icon" style="color: var(--icon-gray);"></i>';
            case 'pdf': return '<i class="fas fa-file-pdf file-icon" style="color: #db4437;"></i>';
            case 'doc': case 'docx': return '<i class="fas fa-file-word file-icon" style="color: #2b579a;"></i>';
            default: return ext === '' ? '<i class="fas fa-file file-icon" style="color: var(--icon-gray);"></i>' : '<i class="fas fa-file-code file-icon" style="color: var(--icon-gray);"></i>';
        }
    } else if (theme === 'Material') {
        if (exactName === 'dockerfile' || exactName === 'docker-compose.yml') return '<i class="ri-ship-fill file-icon" style="color: #2496ed;"></i>';
        if (exactName === 'makefile') return '<i class="ri-tools-fill file-icon" style="color: var(--icon-gray);"></i>';
        if (exactName === 'package.json' || exactName === 'package-lock.json') return '<i class="ri-npmjs-fill file-icon" style="color: #cb3837;"></i>';

        switch(ext) {
            case 'js': case 'mjs': case 'cjs': return '<i class="ri-javascript-fill file-icon" style="color: #f7df1e;"></i>';
            case 'ts': return '<i class="ri-file-code-fill file-icon" style="color: #3178c6;"></i>';
            case 'jsx': case 'tsx': return '<i class="ri-reactjs-fill file-icon" style="color: #61dafb;"></i>';
            case 'vue': return '<i class="ri-vuejs-fill file-icon" style="color: #41b883;"></i>';
            case 'svelte': return '<i class="ri-code-s-slash-fill file-icon" style="color: #ff3e00;"></i>';
            case 'py': case 'pyw': case 'pyc': return '<i class="fab fa-python file-icon" style="color: #306998;"></i>';
            case 'html': case 'htm': return '<i class="ri-html5-fill file-icon" style="color: #e34f26;"></i>';
            case 'css': return '<i class="ri-css3-fill file-icon" style="color: #264de4;"></i>';
            case 'scss': case 'sass': case 'less': return '<i class="ri-css3-fill file-icon" style="color: #cc6699;"></i>';
            case 'json': return '<i class="ri-braces-fill file-icon" style="color: #8bc34a;"></i>';
            case 'yaml': case 'yml': case 'toml': return '<i class="ri-settings-5-fill file-icon" style="color: #cb171e;"></i>';
            case 'xml': return '<i class="ri-braces-fill file-icon" style="color: #ff6600;"></i>';
            case 'md': case 'markdown': return '<i class="ri-markdown-fill file-icon" style="color: #8e24aa;"></i>';
            case 'java': case 'jar': case 'class': return '<i class="fab fa-java file-icon" style="color: #f89820;"></i>';
            case 'cpp': case 'c': case 'cxx': case 'h': case 'hpp': return '<i class="ri-c-plus-plus-fill file-icon" style="color: #00599C;"></i>';
            case 'cs': return '<i class="ri-file-code-fill file-icon" style="color: #178600;"></i>';
            case 'go': return '<i class="ri-code-box-fill file-icon" style="color: #00add8;"></i>';
            case 'rs': return '<i class="ri-settings-3-fill file-icon" style="color: #dea584;"></i>';
            case 'php': return '<i class="ri-file-code-fill file-icon" style="color: #777bb4;"></i>';
            case 'rb': case 'erb': return '<i class="ri-gemini-fill file-icon" style="color: #cc342d;"></i>';
            case 'sh': case 'bash': case 'zsh': case 'bat': case 'cmd': return '<i class="ri-terminal-box-fill file-icon" style="color: var(--text-main);"></i>';
            case 'sql': case 'db': case 'sqlite': return '<i class="ri-database-2-fill file-icon" style="color: #e38c00;"></i>';
            case 'ipynb': return '<i class="ri-book-3-fill file-icon" style="color: var(--icon-py);"></i>';
            case 'irnb': return '<i class="ri-book-3-fill file-icon" style="color: #276dc3;"></i>';
            case 'sqlnb': return '<i class="ri-book-3-fill file-icon" style="color: #4CAF50;"></i>';
            case 'jlnb': return '<i class="ri-book-3-fill file-icon" style="color: #9558B2;"></i>';
            case 'csv': case 'tsv': return '<i class="ri-file-excel-2-fill file-icon" style="color: #217346;"></i>';
            case 'txt': case 'log': return '<i class="ri-file-text-fill file-icon" style="color: var(--icon-gray);"></i>';
            case 'png': case 'jpg': case 'jpeg': case 'svg': case 'gif': case 'ico': case 'webp': case 'bmp': return '<i class="ri-image-fill file-icon" style="color: #4caf50;"></i>';
            case 'zip': case 'rar': case '7z': case 'tar': case 'gz': return '<i class="ri-folder-zip-fill file-icon" style="color: #fbbc04;"></i>';
            case 'mp4': case 'mkv': case 'avi': case 'webm': case 'mov': case 'ogv': case 'm4v': return '<i class="ri-film-fill file-icon" style="color: #ea4335;"></i>';
            case 'mp3': case 'wav': case 'ogg': case 'm4a': case 'flac': return '<i class="ri-music-2-fill file-icon" style="color: #34a853;"></i>';
            case 'gitignore': case 'env': case 'editorconfig': return '<i class="ri-equalizer-fill file-icon" style="color: var(--icon-gray);"></i>';
            case 'pdf': return '<i class="ri-file-pdf-fill file-icon" style="color: #db4437;"></i>';
            case 'doc': case 'docx': return '<i class="ri-file-word-fill file-icon" style="color: #2b579a;"></i>';
            default: return ext === '' ? '<i class="ri-file-fill file-icon" style="color: var(--icon-gray);"></i>' : '<i class="ri-file-code-fill file-icon" style="color: var(--icon-gray);"></i>';
        }
    }
    
    // Default: Remix Icons
    if (exactName === 'dockerfile' || exactName === 'docker-compose.yml') return '<i class="ri-ship-line file-icon" style="color: #2496ed;"></i>';
    if (exactName === 'makefile') return '<i class="ri-tools-line file-icon" style="color: var(--icon-gray);"></i>';
    if (exactName === 'package.json' || exactName === 'package-lock.json') return '<i class="ri-npmjs-line file-icon" style="color: #cb3837;"></i>';

    switch(ext) {
        case 'js': case 'mjs': case 'cjs': return '<i class="ri-javascript-fill file-icon" style="color: var(--icon-js);"></i>'; 
        case 'ts': return '<i class="ri-file-code-line file-icon" style="color: #3178c6;"></i>'; 
        case 'jsx': case 'tsx': return '<i class="ri-reactjs-line file-icon" style="color: #61dafb;"></i>'; 
        case 'vue': return '<i class="ri-vuejs-line file-icon" style="color: #41b883;"></i>';
        case 'svelte': return '<i class="ri-code-s-slash-line file-icon" style="color: #ff3e00;"></i>';
        case 'py': case 'pyw': case 'pyc': return '<i class="fab fa-python file-icon" style="color: var(--icon-py);"></i>'; 
        case 'html': case 'htm': return '<i class="ri-html5-fill file-icon" style="color: var(--icon-html);"></i>'; 
        case 'css': return '<i class="ri-css3-fill file-icon" style="color: var(--icon-css);"></i>'; 
        case 'scss': case 'sass': case 'less': return '<i class="ri-css3-line file-icon" style="color: #cc6699;"></i>';
        case 'json': return '<i class="ri-braces-line file-icon" style="color: var(--icon-json);"></i>'; 
        case 'yaml': case 'yml': case 'toml': return '<i class="ri-file-settings-line file-icon" style="color: #cb171e;"></i>'; 
        case 'xml': return '<i class="ri-code-s-slash-line file-icon" style="color: #ff6600;"></i>'; 
        case 'md': case 'markdown': return '<i class="ri-markdown-fill file-icon" style="color: var(--icon-md);"></i>'; 
        case 'java': case 'jar': case 'class': return '<i class="fab fa-java file-icon" style="color: var(--icon-java);"></i>'; 
        case 'cpp': case 'c': case 'cxx': case 'h': case 'hpp': return '<i class="ri-c-plus-plus-line file-icon" style="color: #00599C;"></i>'; 
        case 'cs': return '<i class="ri-file-code-line file-icon" style="color: #178600;"></i>'; 
        case 'go': return '<i class="ri-code-box-line file-icon" style="color: #00add8;"></i>';
        case 'rs': return '<i class="ri-settings-3-line file-icon" style="color: #dea584;"></i>';
        case 'php': return '<i class="ri-file-code-line file-icon" style="color: #777bb4;"></i>';
        case 'rb': case 'erb': return '<i class="ri-gemini-line file-icon" style="color: #cc342d;"></i>';
        case 'sh': case 'bash': case 'zsh': case 'bat': case 'cmd': return '<i class="ri-terminal-box-line file-icon" style="color: var(--text-main);"></i>'; 
        case 'sql': case 'db': case 'sqlite': return '<i class="ri-database-2-line file-icon" style="color: #e38c00;"></i>';
        case 'ipynb': return '<i class="ri-book-2-line file-icon" style="color: var(--icon-py);"></i>';
        case 'irnb': return '<i class="ri-book-2-line file-icon" style="color: #276dc3;"></i>';
        case 'sqlnb': return '<i class="ri-book-2-line file-icon" style="color: #4CAF50;"></i>';
        case 'jlnb': return '<i class="ri-book-2-line file-icon" style="color: #9558B2;"></i>';
        case 'csv': case 'tsv': return '<i class="ri-file-excel-2-line file-icon" style="color: #217346;"></i>'; 
        case 'txt': case 'log': return '<i class="ri-file-text-line file-icon" style="color: var(--icon-gray);"></i>'; 
        case 'jl': return '<i class="ri-code-line file-icon" style="color: #9558B2;"></i>'; 
        case 'png': case 'jpg': case 'jpeg': case 'svg': case 'gif': case 'ico': case 'webp': case 'bmp': return '<i class="ri-image-line file-icon" style="color: #4caf50;"></i>'; 
        case 'zip': case 'rar': case '7z': case 'tar': case 'gz': return '<i class="ri-folder-zip-line file-icon" style="color: #fbbc04;"></i>';
        case 'mp4': case 'mkv': case 'avi': case 'webm': case 'mov': case 'ogv': case 'm4v': return '<i class="ri-film-line file-icon" style="color: #ea4335;"></i>';
        case 'mp3': case 'wav': case 'ogg': case 'm4a': case 'flac': return '<i class="ri-music-2-line file-icon" style="color: #34a853;"></i>';
        case 'gitignore': case 'env': case 'editorconfig': return '<i class="ri-equalizer-line file-icon" style="color: var(--icon-gray);"></i>';
        case 'pdf': return '<i class="ri-file-pdf-line file-icon" style="color: #db4437;"></i>';
        case 'doc': case 'docx': return '<i class="ri-file-word-2-line file-icon" style="color: #2b579a;"></i>';
        default: return ext === '' ? '<i class="ri-file-text-line file-icon" style="color: var(--icon-gray);"></i>' : '<i class="ri-file-3-line file-icon" style="color: var(--icon-gray);"></i>';
    }
}

function triggerEditorAction(action) {
    const activePane = document.querySelector('.editor-group.active-group .content-pane.active') || document.querySelector('.content-pane.active');
    if (!activePane) return;
    const monacoContainer = activePane.querySelector('[id^="editor-container-"]');
    if (monacoContainer && window.monaco) {
        const editors = window.monaco.editor.getEditors(); const editor = editors.find(e => monacoContainer.contains(e.getContainerDomNode()));
        if (editor) { editor.trigger('keyboard', action === 'undo' ? 'undo' : 'redo', null); return; }
    }
    document.execCommand(action);
}

window.openCellInMonaco = function(cellId) {
    const cell = document.querySelector(`.cell[data-cell-id="${cellId}"]`); if (!cell) return;
    const code = cell.querySelector('.cell-editor').innerText; createNewTab('Cell Editor', 'ri-code-box-line', false, code, 'monaco-cell', cellId);
};

window.autoSaveFile = function(fileId, newContent, tabEl, encoding, explicitDbName) {
    if(!fileId || fileId === 'workspace') return;
    
    // Callers that do async work BEFORE calling autoSaveFile (e.g. docs.js
    // building a .docx) must pass explicitDbName, captured synchronously on
    // their end before that async gap - otherwise, if the user switches
    // windows/profiles while the save is in flight, this re-derives "the
    // active window" at write time, which by then is the NEW window, not the
    // one the edit actually belongs to. That silently saves into the wrong
    // window's database (fileId won't exist there, so the edit is just lost)
    // instead of the file it was meant for. Callers that call autoSaveFile
    // synchronously (Monaco, notebooks) are unaffected either way, since for
    // them this still resolves before any window switch can occur.
    let targetDbName = explicitDbName;
    if (!targetDbName) {
        const activeWinId = localStorage.getItem('codemini_active_window') || 'win_default';
        const windowsData = JSON.parse(localStorage.getItem('codemini_windows') || '[]');
        const winContext = windowsData.find(w => w.id === activeWinId) || windowsData[0];
        targetDbName = winContext ? winContext.db : 'CodeMiniDB';
    }

    const req = indexedDB.open(targetDbName, 3);
    req.onsuccess = (e) => {
        const isolatedDb = e.target.result;
        const tx = isolatedDb.transaction('filesystem', 'readwrite');
        const store = tx.objectStore('filesystem');
        
        store.get(fileId).onsuccess = (ev) => {
            const file = ev.target.result;
            if (file) {
                file.content = newContent; 
                // Only touch encoding when a caller explicitly passes one (e.g.
                // docs.js saving a real .docx) - every other caller keeps
                // passing 3 args and this stays a no-op for them, exactly as
                // before.
                if (encoding !== undefined) file.encoding = encoding;
                file.timestamp = Date.now();
                store.put(file).onsuccess = () => {
                    if (tabEl && document.body.contains(tabEl)) {
                        tabEl.classList.remove('unsaved-blink'); 
                        tabEl.classList.add('saved-pulse'); 
                        setTimeout(() => tabEl.classList.remove('saved-pulse'), 1000);
                    }
                    isolatedDb.close();
                };
            } else {
                isolatedDb.close();
            }
        };
        tx.onerror = () => isolatedDb.close();
    };
};

window.saveAllUnsavedTabs = function() {
    document.querySelectorAll('.tab.unsaved-blink').forEach(tab => {
        const pane = document.getElementById(tab.dataset.target); if (!pane) return;
        if (tab.dataset.type === 'monaco' && window.monaco) {
            const editor = window.monaco.editor.getEditors().find(e => pane.querySelector('[id^="editor-container-"]').contains(e.getContainerDomNode()));
            if (editor) {
                if (window.appSettings && window.appSettings.formatOnSave && !editor._isFormatting) {
                    editor._isFormatting = true;
                    try { editor.getAction('editor.action.formatDocument')?.run().finally(() => { editor._isFormatting = false; window.autoSaveFile(tab.dataset.fileId, editor.getValue(), tab); }); } 
                    catch(e){ window.autoSaveFile(tab.dataset.fileId, editor.getValue(), tab); }
                } else window.autoSaveFile(tab.dataset.fileId, editor.getValue(), tab);
            }
        } else if (tab.dataset.type === 'notebook') { if (typeof triggerNotebookSave === 'function') triggerNotebookSave(pane); }
        else if (tab.dataset.type === 'document') { if (typeof window.triggerDocumentSave === 'function') window.triggerDocumentSave(pane); }
    });
};

window.updatePlayIconVisibility = function() {
    const playIcon = document.getElementById('playIconItem'); 
    const togglePreviewMenu = document.getElementById('layoutTogglePreview');
    const activePane = document.querySelector('.editor-group.active-group .content-pane.active');
    
    if (!playIcon) return;
    const activeTab = document.querySelector('.editor-group.active-group .tab.active');
    if (!activeTab || !activePane) { 
        playIcon.style.display = 'none'; 
        if (togglePreviewMenu) togglePreviewMenu.style.display = 'none';
        return; 
    }
    
    const fileName = activeTab.querySelector('span').textContent.toLowerCase(); 
    const ext = fileName.split('.').pop(); 
    const supportedExts = ['html', 'css', 'md', 'json', 'csv', 'svg', 'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'];
    
    if (supportedExts.includes(ext) && activeTab.dataset.type !== 'workspace') { 
        playIcon.style.display = 'flex'; 
        if (togglePreviewMenu) togglePreviewMenu.style.display = 'flex';
    } else { 
        playIcon.style.display = 'none'; 
        if (togglePreviewMenu) togglePreviewMenu.style.display = 'none';
    }
};

const activeFileStatus = document.getElementById('activeFileStatus');

function switchTab(targetId) {
    if (window.appSettings && window.appSettings.autoSave === 'On Tab Change') {
        if(window.saveAllUnsavedTabs) window.saveAllUnsavedTabs();
    }

    const targetTab = document.querySelector(`.tab[data-target="${targetId}"]`);
    if (!targetTab) return;
    const group = targetTab.closest('.editor-group');
    
    group.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    group.querySelectorAll('.content-pane').forEach(p => p.classList.remove('active'));
    
    targetTab.classList.add('active');
    const targetPane = document.getElementById(targetId);
    if (targetPane) targetPane.classList.add('active');
    
    const statusEncoding = document.getElementById('statusEncoding');
    const statusLineEnding = document.getElementById('statusLineEnding');
    const statusLnCol = document.getElementById('statusLnCol');
    const statusSpaces = document.getElementById('statusSpaces');
    
    if (targetTab.dataset.type === 'monaco' || targetTab.dataset.type === 'monaco-cell') {
        if (statusEncoding) statusEncoding.style.display = 'flex';
        if (statusLineEnding) statusLineEnding.style.display = 'flex';
        if (statusLnCol) statusLnCol.style.display = 'flex';
        if (statusSpaces) statusSpaces.style.display = 'flex';
        
        if (window.monaco && targetPane) {
            const editorContainer = targetPane.querySelector('[id^="editor-container-"]');
            if (editorContainer) {
                const editor = window.monaco.editor.getEditors().find(e => editorContainer.contains(e.getContainerDomNode()));
                if (editor) {
                    const eol = editor.getModel().getEOL();
                    if (statusLineEnding) statusLineEnding.textContent = eol === '\n' ? 'LF' : 'CRLF';
                    const pos = editor.getPosition();
                    if (pos && statusLnCol) statusLnCol.textContent = `Ln ${pos.lineNumber}, Col ${pos.column}`;
                }
            }
        }
    } else {
        if (statusEncoding) statusEncoding.style.display = 'none';
        if (statusLineEnding) statusLineEnding.style.display = 'none';
        if (statusLnCol) statusLnCol.style.display = 'none';
        if (statusSpaces) statusSpaces.style.display = 'none';
    }

    if (typeof activeGroupId !== 'undefined') activeGroupId = group.id;
    if(activeFileStatus) activeFileStatus.textContent = targetTab.querySelector('span').textContent;
    
    window.updatePlayIconVisibility();
    if (typeof pushNavState === 'function') setTimeout(pushNavState, 50);

    if(window.updateDebugPanel) window.updateDebugPanel();
}

function updateOpenedTabsRegistry() {
    window.openedTabs = Array.from(document.querySelectorAll('.tab')).map(t => {
        const iEl = t.querySelector('i:not(.tab-close)');
        return {
            id: t.dataset.target,
            name: t.querySelector('span').textContent,
            icon: iEl ? iEl.className : '',
            iconStyle: iEl ? (iEl.getAttribute('style') || '') : '',
            type: t.dataset.type,
            fileId: t.dataset.fileId,
            groupId: t.closest('.editor-group') ? t.closest('.editor-group').id : 'editorGroup1'
        };
    });
    if(window.renderStacks) window.renderStacks();

    if (window.appSettings && window.appSettings.restoreSession && typeof cellActiveWindow !== 'undefined') {
        localStorage.setItem(`codemini_session_${cellActiveWindow.id}`, JSON.stringify(window.openedTabs));
    }
}

// Shared per-pane resource teardown - revokes media/archive Blob URLs, clears
// docs.js's pending autosave timer, drops pdf.js viewer state. Used by
// closeTab (single tab) AND window.teardownAllOpenPanes (bulk, see below) so
// the two paths can never drift out of sync with each other.
function teardownPaneResources(tabElement, paneElement) {
    // Monaco's own delayed-autosave timer (see editor.onDidChangeModelContent
    // above) - cancel it here rather than letting it fire later, whether
    // this tab is closing outright or just getting swept up in a window
    // switch's bulk teardown.
    if (tabElement._pendingAutoSaveTimeout) {
        clearTimeout(tabElement._pendingAutoSaveTimeout);
        tabElement._pendingAutoSaveTimeout = null;
    }

    if (window.connectedTerminalInfo && window.connectedTerminalInfo.tab === tabElement) {
        if (typeof window.disconnectBottomTerminal === 'function') {
            window.disconnectBottomTerminal();
        }
    }

    if (window.MEDIA_TAB_TYPES && window.MEDIA_TAB_TYPES.includes(tabElement.dataset.type) && typeof window.teardownMediaPlayer === 'function') {
        window.teardownMediaPlayer(paneElement ? paneElement.id : tabElement.dataset.target);
    }

    if (tabElement.dataset.type === 'archive' && typeof window.teardownArchiveViewer === 'function') {
        window.teardownArchiveViewer(paneElement ? paneElement.id : tabElement.dataset.target);
    }

    if (tabElement.dataset.type === 'document' && typeof window.teardownDocumentEditor === 'function') {
        window.teardownDocumentEditor(paneElement ? paneElement.id : tabElement.dataset.target);
    }

    if (tabElement.dataset.type === 'pdf' && typeof window.teardownPdfViewer === 'function') {
        window.teardownPdfViewer(paneElement ? paneElement.id : tabElement.dataset.target);
    }
}
window.teardownPaneResources = teardownPaneResources;

// switchWindow (app.js) tears down every open tab's DOM in bulk
// (tabs-bar/panes-container innerHTML wipe) rather than calling closeTab()
// per tab - deliberately, since closeTab() also does things that are wrong
// mid-switch (pushing every tab into "Recently Closed", re-activating a
// sibling tab, re-writing the session registry per tab). But that bulk wipe
// was skipping teardownPaneResources entirely, which meant: media/archive
// Blob URLs for the outgoing window were never revoked (leaked every single
// window switch), and docs.js's pending per-pane autosave timer was never
// cleared (it would still fire later, after the switch, autosaving into
// whatever window happened to be active by then). Call this once, right
// before that DOM wipe, to run just the resource-cleanup half of closeTab
// for every open tab across both editor groups.
window.teardownAllOpenPanes = function() {
    document.querySelectorAll('.tab').forEach(tabElement => {
        const paneElement = document.getElementById(tabElement.dataset.target);
        teardownPaneResources(tabElement, paneElement);
    });
};

function closeTab(tabElement, paneElement, group) {
    teardownPaneResources(tabElement, paneElement);

    const wasActive = tabElement.classList.contains('active');
    window.recentlyClosed.push({ name: tabElement.querySelector('span').textContent, icon: tabElement.querySelector('i').className, type: tabElement.dataset.type });

    if (window.recentlyClosed.length > 8) {
        window.recentlyClosed.shift();
    }
    
    if (paneElement && window.monaco) {
        const editorContainer = paneElement.querySelector('[id^="editor-container-"]');
        if (editorContainer) {
            const editor = window.monaco.editor.getEditors().find(e => editorContainer.contains(e.getContainerDomNode()));
            if (editor) {
                const model = editor.getModel();
                if (model) model.dispose();
                const id = editor.getId();
                if (window.searchDecorationsMap && window.searchDecorationsMap[id]) {
                    delete window.searchDecorationsMap[id];
                }
                editor.dispose(); 
            }
        }
    }

    tabElement.remove(); if (paneElement) paneElement.remove();
    const remainingTabsInGroup = group.querySelectorAll('.tab');
    if (wasActive) {
        if (remainingTabsInGroup.length > 0) { const lastTab = remainingTabsInGroup[remainingTabsInGroup.length - 1]; switchTab(lastTab.dataset.target); } 
        else { 
            if(activeFileStatus && activeGroupId === group.id) {
                activeFileStatus.textContent = 'No file open';
                const enc = document.getElementById('statusEncoding'); if(enc) enc.style.display = 'none';
                const lf = document.getElementById('statusLineEnding'); if(lf) lf.style.display = 'none';
                const ln = document.getElementById('statusLnCol'); if (ln) ln.style.display = 'none';
                const spc = document.getElementById('statusSpaces'); if (spc) spc.style.display = 'none';
            } 
        }
    }
    // A secondary split group left with zero tabs is a dead, orphaned half-screen
    // pane - auto-collapse it back to single view rather than leaving it stranded.
    // editorGroup1 (the permanent base group) is never auto-removed this way.
    if (remainingTabsInGroup.length === 0 && group.id !== 'editorGroup1' && document.getElementById('editorGroup1')) {
        group.remove();
        if (window.removeSplitResizer) window.removeSplitResizer();
        const group1 = document.getElementById('editorGroup1');
        document.querySelectorAll('.editor-group').forEach(g => g.classList.remove('active-group'));
        group1.classList.add('active-group');
        if (typeof activeGroupId !== 'undefined') activeGroupId = 'editorGroup1';
        window.activeGroupId = 'editorGroup1';
        if (window.saveCurrentUIState) window.saveCurrentUIState();
    }
    updateOpenedTabsRegistry(); window.updatePlayIconVisibility();
}

// --- FILE BREADCRUMB DYNAMIC INJECTION ---
window.updateEditorBreadcrumb = function(fileId, targetPaneId) {
    const bcEl = document.getElementById(`bc-${targetPaneId}`);
    if (!bcEl) return;
    
    if (typeof db === 'undefined' || !db) return;
    
    // Race guard: session restore and notebook init can each trigger a breadcrumb
    // rebuild for the same pane in quick succession. Since the DB read is async,
    // requests can resolve out of order. Stamp this request and bail out in the
    // callback if a newer request has since been issued for this element.
    const requestToken = (bcEl._bcRequestToken || 0) + 1;
    bcEl._bcRequestToken = requestToken;
    
    const tx = db.transaction('filesystem', 'readonly');
    tx.objectStore('filesystem').getAll().onsuccess = (e) => {
        if (bcEl._bcRequestToken !== requestToken) return; // a newer request superseded this one
        if (!document.body.contains(bcEl)) return; // pane was closed/removed while we were waiting
        const allFiles = e.target.result;
        const path = [];
        let currId = fileId;
        
        while(currId && currId !== 'root' && currId !== 'workspace-root') {
            const f = allFiles.find(x => x.id === currId);
            if(f) {
                path.unshift(f);
                currId = f.parentId;
            } else {
                break;
            }
        }
        
        let html = '';
        path.forEach((f, idx) => {
            const isLast = idx === path.length - 1;
            const iconHTML = typeof getFileIconHTML === 'function' ? getFileIconHTML(f.name) : '<i class="ri-file-code-line"></i>';
            
            let iconClass = 'ri-file-text-line';
            let iconStyle = '';
            if (f.type === 'folder' || f.type === 'workspace') {
                iconClass = 'ri-folder-2-line';
            } else {
                const classMatch = iconHTML.match(/class="([^"]+)"/);
                if (classMatch) iconClass = classMatch[1].replace('file-icon', '').trim();
                const styleMatch = iconHTML.match(/style="([^"]+)"/);
                if (styleMatch) iconStyle = styleMatch[1];
            }

            html += `<div class="bc-item" data-file-id="${f.id}" style="${isLast ? 'color: var(--text-main); font-weight: 500;' : ''}">
                <i class="${iconClass}" style="${iconStyle}"></i>
                <span>${f.name}</span>
            </div>`;
            
            if (!isLast) {
                html += `<i class="ri-arrow-right-s-line bc-separator"></i>`;
            }
        });
        
        bcEl.innerHTML = html;
        
        // Navigation listener on breadcrumbs
        bcEl.querySelectorAll('.bc-item').forEach(el => {
            el.addEventListener('click', () => {
                const clickId = el.dataset.fileId;
                const txAll = db.transaction('filesystem', 'readonly');
                txAll.objectStore('filesystem').getAll().onsuccess = (eAll) => {
                    const files = eAll.target.result;
                    const clickedFile = files.find(x => x.id === clickId);
                    
                    if (clickedFile && (clickedFile.type === 'folder' || clickedFile.type === 'workspace')) {
                        const newStack = [];
                        let curr = clickedFile.id;
                        while(curr && curr !== 'root' && curr !== 'workspace-root') {
                            const f = files.find(x => x.id === curr);
                            if(f) {
                                newStack.unshift({id: f.id, name: f.name});
                                curr = f.parentId;
                            } else break;
                        }
                        
                        if (typeof folderStack !== 'undefined' && folderStack.length > 0) {
                            newStack.unshift(folderStack[0]);
                            folderStack = newStack;
                            if (typeof loadFilesFromDB === 'function') loadFilesFromDB();
                            
                            const explorerSidebar = document.getElementById('explorerSidebar');
                            if (explorerSidebar && !explorerSidebar.classList.contains('open')) {
                                document.getElementById('folderIconItem')?.click();
                            }
                        }
                    }
                };
            });
        });
    };
};

// Refreshes every currently-open tab's breadcrumb from the DB - call this
// after a rename or a move (see app.js's Rename handler and script.js's
// moveFileInDB) rather than relying on the breadcrumb having been built
// once back when the tab was first opened. A single renamed/moved item can
// affect more open tabs than just its own (e.g. renaming a folder changes
// the breadcrumb path for every open file inside it), so this refreshes
// all of them rather than trying to work out which ones are affected.
// Document tabs (docs.js) render their own breadcrumb + filename inside
// their status bar rather than the shared .editor-breadcrumb element, so
// they're refreshed through their own equivalent entry point instead.
window.refreshAllOpenBreadcrumbs = function() {
    document.querySelectorAll('.tab[data-file-id]').forEach(tab => {
        const fileId = tab.dataset.fileId;
        const targetId = tab.dataset.target;
        if (!fileId || !targetId) return;
        if (tab.dataset.type === 'document') {
            if (typeof window.updateDocumentBreadcrumb === 'function') window.updateDocumentBreadcrumb(fileId, targetId);
        } else if (typeof window.updateEditorBreadcrumb === 'function') {
            window.updateEditorBreadcrumb(fileId, targetId);
        }
    });
};


window.createNewTab = function(title, iconClass, isUnsaved = false, contentHTML = '', tabType = 'default', fileId = null, iconStyle = '') {
    if (typeof tabCounter !== 'undefined') tabCounter++;
    const targetId = `pane-${typeof tabCounter !== 'undefined' ? tabCounter : Date.now()}`;
    const tab = document.createElement('div');
    tab.className = 'tab'; tab.dataset.target = targetId; if(tabType) tab.dataset.type = tabType; if(fileId) tab.dataset.fileId = fileId;
    
    let styleStr = iconStyle ? ` style="${iconStyle}"` : '';
    tab.innerHTML = `<i class="${iconClass}"${styleStr}></i> <span>${title}</span> <i class="ri-close-line tab-close"></i>`;
    
    if (isUnsaved) tab.classList.add('unsaved-blink');
    
    const activeGroup = document.getElementById(typeof activeGroupId !== 'undefined' ? activeGroupId : 'editorGroup1') || document.getElementById('editorGroup1');
    const tabsBar = activeGroup.querySelector('.tabs-bar'); 
    const panesContainer = activeGroup.querySelector('.panes-container');
    const addBtn = tabsBar.querySelector('.add-tab'); 
    tabsBar.insertBefore(tab, addBtn);
    
    const pane = document.createElement('div'); 
    pane.className = 'content-pane'; 
    if(tabType === 'workspace') pane.classList.add('launcher-workspace'); 
    pane.id = targetId; 
    
    let editorId = null;
    let breadcrumbHtml = (fileId && tabType !== 'workspace' && tabType !== 'monaco-cell' && tabType !== 'document') ? `<div class="editor-breadcrumb" id="bc-${targetId}"></div>` : '';

    if (tabType === 'monaco') {
        editorId = `editor-container-${typeof tabCounter !== 'undefined' ? tabCounter : Date.now()}`;
        pane.innerHTML = `${breadcrumbHtml}<div id="${editorId}" style="flex: 1; position: relative; width: 100%; min-height: 0;"></div>`;
    } else if (tabType === 'monaco-cell') {
        editorId = `editor-container-${typeof tabCounter !== 'undefined' ? tabCounter : Date.now()}`;
        pane.innerHTML = `<div id="${editorId}" style="width: 100%; height: 100%;"></div>`;
    } else if (tabType === 'workspace') {
        pane.innerHTML = contentHTML;
    } else {
        pane.innerHTML = `${breadcrumbHtml}<div style="flex: 1; position: relative; display: flex; flex-direction: column; min-height: 0; min-width: 0; overflow: hidden;">${contentHTML}</div>`;
    }

    panesContainer.appendChild(pane); 
    switchTab(targetId); 
    updateOpenedTabsRegistry();

    if (fileId && tabType !== 'workspace' && tabType !== 'monaco-cell' && tabType !== 'document') {
        window.updateEditorBreadcrumb(fileId, targetId);
    }

    if (window.MEDIA_TAB_TYPES && window.MEDIA_TAB_TYPES.includes(tabType) && typeof window.initMediaPlayer === 'function') {
        window.initMediaPlayer(fileId, targetId);
    }

    if (tabType === 'archive' && typeof window.initArchiveViewer === 'function') {
        window.initArchiveViewer(fileId, targetId);
    }

    if (tabType === 'document' && typeof window.initDocumentEditor === 'function') {
        window.initDocumentEditor(fileId, targetId);
    }

    if (tabType === 'pdf' && typeof window.initPdfViewer === 'function') {
        window.initPdfViewer(fileId, targetId);
    }

    if (tabType === 'monaco' || tabType === 'monaco-cell') {
        const checkAndInitMonaco = () => {
            if (window.monaco && document.getElementById(editorId)) {
                const ext = title.split('.').pop().toLowerCase();
                const langMap = { 'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript', 'py': 'python', 'html': 'html', 'css': 'css', 'json': 'json', 'yaml': 'yaml', 'yml': 'yaml', 'xml': 'xml', 'md': 'markdown', 'java': 'java', 'cpp': 'cpp', 'c': 'c', 'sql': 'sql', 'php': 'php', 'rb': 'ruby', 'go': 'go', 'rs': 'rust', 'vue': 'vue', 'svelte': 'html', 'scss': 'scss', 'sass': 'scss', 'less': 'less' };
                const editorLang = langMap[ext] || 'plaintext';
                
                const theme = (window.appSettings && typeof window.isThemeDark === 'function' && window.isThemeDark()) ? 'vs-dark' : 'vs-light';

                const editor = window.monaco.editor.create(document.getElementById(editorId), {
                    value: contentHTML || "", language: editorLang, theme: theme, automaticLayout: true,
                    fontSize: window.appSettings ? window.appSettings.fontSize : 13, 
                    fontFamily: window.appSettings ? window.appSettings.fontFamily : "'Fira Code', 'JetBrains Mono', monospace", 
                    fontLigatures: window.appSettings ? window.appSettings.fontLigatures : true,
                    fontWeight: window.appSettings ? window.appSettings.fontWeight : '300', 
                    largeFileOptimizations: true, 

                    lineHeight: window.appSettings ? window.appSettings.lineHeight : 21, 
                    letterSpacing: window.appSettings ? window.appSettings.letterSpacing : 0.3, 
                    tabSize: window.appSettings ? window.appSettings.tabSize : 4,
                    insertSpaces: window.appSettings ? window.appSettings.insertSpaces : true,
                    wordWrap: window.appSettings ? window.appSettings.wordWrap : "off",
                    minimap: { enabled: window.appSettings ? window.appSettings.minimap : false, scale: 0.75 }, 
                    lineNumbers: window.appSettings ? window.appSettings.lineNumbers : 'on', 
                    renderWhitespace: window.appSettings ? window.appSettings.renderWhitespace : 'none',
                    smoothScrolling: window.appSettings ? window.appSettings.smoothScrolling : true,
                    lineNumbersMinChars: 4, lineDecorationsWidth: 2, 
                    cursorStyle: window.appSettings ? window.appSettings.cursorStyle : 'line', 
                    cursorWidth: window.appSettings ? window.appSettings.cursorWidth : 2, 
                    cursorBlinking: window.appSettings ? window.appSettings.cursorBlinking : 'expand',
                    suggest: { snippetsPreventQuickSuggestions: false },

                    mouseWheelZoom: window.appSettings ? window.appSettings.mouseWheelZoom : false,
                    folding: window.appSettings ? window.appSettings.editorFolding : true,
                    renderLineHighlight: window.appSettings ? window.appSettings.renderLineHighlight : 'line',
                    matchBrackets: window.appSettings ? window.appSettings.matchBrackets : 'always',

                    bracketPairColorization: { enabled: window.appSettings ? window.appSettings.bracketPairs : true },
                    guides: { bracketPairs: window.appSettings ? window.appSettings.bracketPairs : true }
                });

                let saveTimeout;
                editor.onDidChangeModelContent(() => {
                    tab.classList.add('unsaved-blink');
                    
                    if (window.appSettings && window.appSettings.autoSave === 'After Delay') {
                        clearTimeout(saveTimeout);
                        saveTimeout = setTimeout(async () => {
                            if (window.appSettings.formatOnSave && !editor._isFormatting) {
                                editor._isFormatting = true;
                                try { await editor.getAction('editor.action.formatDocument')?.run(); } catch(e){}
                                editor._isFormatting = false;
                            }
                            if (tabType === 'monaco-cell') {
                                const targetCell = document.querySelector(`.cell[data-cell-id="${fileId}"]`);
                                if (targetCell) { targetCell.querySelector('.cell-editor').innerText = editor.getValue(); const evt = new Event('input', { bubbles: true }); targetCell.querySelector('.cell-editor').dispatchEvent(evt); }
                                tab.classList.remove('unsaved-blink');
                            } else { window.autoSaveFile(fileId, editor.getValue(), tab); }
                        }, window.appSettings.autoSaveDelay || 1000);
                        // Exposed so teardownPaneResources (closeTab, and window
                        // switching's bulk teardown) can cancel this - otherwise
                        // it's a dangling timer with no external handle, and it
                        // outlives both a closed tab and a window switch, firing
                        // later against whatever window/db happens to be active
                        // by then instead of the one this edit belongs to.
                        tab._pendingAutoSaveTimeout = saveTimeout;
                    }
                });
            } else {
                setTimeout(checkAndInitMonaco, 50);
            }
        };

        checkAndInitMonaco();
    }
};

function openFileInTab(file) {
    // Archives must never open as a tab, under any caller - route to the
    // extraction flow instead. This is a hard guard rather than relying only
    // on proceedWithFileOpen's own check, since other callers reach this
    // function directly (session restore reopening a previously-open tab,
    // for one - a session saved before this change could still list an
    // archive as "open").
    const _ext = file.name && file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
    if (window.ARCHIVE_FILE_EXTS && window.ARCHIVE_FILE_EXTS.includes(_ext)) {
        if (typeof window.extractArchiveFile === 'function') {
            if (window.showCustomModal) {
                window.showCustomModal({
                    title: 'Extract Archive',
                    text: `Extract "${file.name}" into this folder?`,
                    submitText: 'Extract'
                }, () => { window.extractArchiveFile(file); });
            } else if (confirm(`Extract "${file.name}" into this folder?`)) {
                window.extractArchiveFile(file);
            }
        }
        return;
    }

    // Only dedupe within the group we're targeting. This lets the same file be
    // legitimately open in two split panes (different editor groups) without the
    // restore logic colliding them into one tab and bouncing it between groups.
    const currentGroupId = (typeof activeGroupId !== 'undefined' && activeGroupId) ? activeGroupId : 'editorGroup1';
    const currentGroupEl = document.getElementById(currentGroupId);
    const existingTab = currentGroupEl
        ? currentGroupEl.querySelector(`.tab[data-file-id="${file.id}"]`)
        : document.querySelector(`.tab[data-file-id="${file.id}"]`);
    if (existingTab) { switchTab(existingTab.dataset.target); return; }

    const isNotebook = file.name.endsWith('.ipynb') || file.name.endsWith('.irnb') || file.name.endsWith('.sqlnb');

    // Unlike regular Monaco files (which share a live model across multiple
    // editor instances and stay in sync automatically), notebook cell output
    // is rendered directly into that specific pane's DOM with no cross-pane
    // sync - running a cell in one copy would silently leave a second open
    // copy stale. So notebooks are restricted to one open tab across ALL
    // groups, not just deduped within the current one.
    if (isNotebook) {
        const existingAnywhere = document.querySelector(`.tab[data-file-id="${file.id}"]`);
        if (existingAnywhere) {
            const otherGroup = existingAnywhere.closest('.editor-group');
            if (otherGroup) {
                document.querySelectorAll('.editor-group').forEach(g => g.classList.remove('active-group'));
                otherGroup.classList.add('active-group');
                if (typeof activeGroupId !== 'undefined') activeGroupId = otherGroup.id;
                window.activeGroupId = otherGroup.id;
                if (otherGroup.id !== currentGroupId && typeof window.showSuccessToast === 'function') {
                    window.showSuccessToast(`"${file.name}" is already open in the other group - switched to it`);
                }
            }
            switchTab(existingAnywhere.dataset.target);
            return;
        }
    }

    const notebookKernel = file.name.endsWith('.irnb') ? 'r' : (file.name.endsWith('.sqlnb') ? 'sql' : 'python');

    const iconHTML = getFileIconHTML(file.name);
    const iconClassMatch = iconHTML.match(/class="([^"]+)"/);
    let iconClass = iconClassMatch ? iconClassMatch[1].replace('file-icon', '').trim() : 'ri-file-code-line';
    
    const iconStyleMatch = iconHTML.match(/style="([^"]+)"/);
    let iconStyle = iconStyleMatch ? iconStyleMatch[1] : '';

    let contentHTML = ''; let tabType = 'monaco';
    const ext = file.name.split('.').pop().toLowerCase();
    const binaryExts = window.BINARY_FILE_EXTS;

    // Legacy CodeMini documents were saved as marker-tagged .html (portable,
    // but not a real Word file); docs.js now saves real .docx files instead,
    // and any .docx/.doc a user uploads or already has should also open in
    // the same Document editor rather than Monaco or the generic binary
    // placeholder. Both still route to the same tab type - initDocumentEditor
    // (docs.js) tells them apart by fileData.encoding when it loads content.
    const isLegacyMarkedHtmlDoc = (ext === 'html' || ext === 'htm') && typeof window.isDocumentMarkerPresent === 'function' && window.isDocumentMarkerPresent(file.content);
    const isDocxFile = ext === 'docx' || ext === 'doc';
    const isDocumentFile = isLegacyMarkedHtmlDoc || isDocxFile;
    const isPdfFile = ext === 'pdf';

    if (isDocumentFile) {
        contentHTML = (typeof window.getDocumentEditorHTML === 'function') ? window.getDocumentEditorHTML(file) : '';
        tabType = 'document';
    } else if (isPdfFile) {
        contentHTML = (typeof window.getPdfViewerHTML === 'function') ? window.getPdfViewerHTML(file) : '';
        tabType = 'pdf';
    } else if (isNotebook) { 
        contentHTML = file.content || window.getNotebookHTML(notebookKernel); 
        tabType = 'notebook'; 
    } else if (window.VIDEO_FILE_EXTS.includes(ext)) {
        contentHTML = (typeof window.getMediaPlayerHTML === 'function') ? window.getMediaPlayerHTML(file, 'video') : '';
        tabType = 'video';
    } else if (window.IMAGE_FILE_EXTS.includes(ext)) {
        contentHTML = (typeof window.getMediaPlayerHTML === 'function') ? window.getMediaPlayerHTML(file, 'image') : '';
        tabType = 'image';
    } else if (window.AUDIO_FILE_EXTS.includes(ext)) {
        contentHTML = (typeof window.getMediaPlayerHTML === 'function') ? window.getMediaPlayerHTML(file, 'audio') : '';
        tabType = 'audio';
    } else if (window.ARCHIVE_FILE_EXTS.includes(ext)) {
        // Unreachable: the guard at the top of this function already intercepts
        // every archive extension and returns before execution gets here (per
        // user direction, archives extract on open rather than opening a tab
        // at all). Left in place, along with getArchiveViewerHTML/
        // initArchiveViewer/teardownArchiveViewer in archive.js, in case
        // tab-based archive browsing is wanted again later.
        contentHTML = (typeof window.getArchiveViewerHTML === 'function') ? window.getArchiveViewerHTML(file) : '';
        tabType = 'archive';
    } else if (binaryExts.includes(ext)) {
        contentHTML = `<div style="display:flex; justify-content:center; align-items:center; height:100%; color:var(--text-muted);">
            <div style="text-align:center;">
                <i class="ri-file-warning-line" style="font-size: 48px; color: var(--icon-gray);"></i>
                <p style="margin-top: 15px;">This file type cannot be displayed in the text editor.</p>
            </div>
        </div>`;
        tabType = 'binary'; 
    } else { 
        contentHTML = file.content || ''; 
        if (contentHTML.length > 20000000) { 
            if (window.showCustomModal) {
                window.showCustomModal({ 
                    title: 'File Too Large', 
                    text: 'This file is extremely large. Showing the first 15MB to prevent performance issues.', 
                    submitText: 'OK' 
                }, () => {});
            } else {
                alert("This file is extremely large. Showing the first 15MB to prevent performance issues.");
            }
            contentHTML = contentHTML.substring(0, 15000000) + "\n\n... [FILE TRUNCATED DUE TO SIZE] ...";
        }
    }

    createNewTab(tabType === 'document' ? 'Document' : file.name, iconClass, false, contentHTML, tabType, file.id, iconStyle);
}

// --- Bottom Panel Console Logic ---
window.printToBottomConsole = function(text, type = 'normal') {
    const outputEl = document.getElementById('bpConsoleOutput');
    if (!outputEl) return;
    const div = document.createElement('div');
    div.style.fontFamily = 'var(--font-mono)';
    div.style.marginBottom = '4px';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordBreak = 'break-word';
    
    let prefix = '';
    if (type === 'error') {
        div.style.color = 'var(--color-danger)';
    } else if (type === 'system') {
        div.style.color = 'var(--accent-blue)';
        div.style.fontStyle = 'italic';
    } else if (type === 'input') {
        div.style.color = 'var(--term-blue)';
        div.style.background = 'var(--bg-panel)';
        div.style.padding = '6px 10px';
        div.style.borderRadius = '2px';
        div.style.marginTop = '8px';
        div.style.marginBottom = '8px';
        prefix = '❯ ';
    } else {
        div.style.color = 'var(--text-main)';
    }
    
    const escapeHTML = (str) => String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
    
    if (type === 'input') {
        div.innerHTML = `<span style="user-select:none; opacity:0.7; margin-right: 5px;">${prefix}</span>${escapeHTML(text)}`;
    } else {
        div.innerHTML = escapeHTML(text);
    }
    
    outputEl.appendChild(div);
    outputEl.scrollTop = outputEl.scrollHeight;
};

window.runInBottomConsole = async function(code, ext) {
    const panel = document.getElementById('problemsPanel');
    if (panel && panel.style.display === 'none') {
        panel.style.display = 'flex';
    }
    document.querySelector('.bottom-panel-tab[data-target="consolePanelContent"]')?.click();
    
    const restrictedExts = ['html', 'css', 'sh', 'zsh', 'tsx', 'jsx', 'md', 'ts', 'txt'];
    if (restrictedExts.includes(ext)) {
        window.printToBottomConsole(`[Error] Execution of '${ext}' files is not supported in this isolated console. Please use the dedicated terminal or preview.`, 'error');
        return;
    }

    const stopBtn = document.getElementById('bpConsoleStopBtn');
    const playBtn = document.getElementById('bpConsolePlayBtn');

    if (stopBtn) stopBtn.classList.remove('disabled');
    if (playBtn) playBtn.classList.add('disabled');

    window.printToBottomConsole(code, 'input');
    window.printToBottomConsole("[Running...]", 'system');

    const winId = _getEditorWinId();
    window._bpConsoleRunningState[winId] = true;

    try {
        if (ext === 'php') {
            if (!window.phpWebInstanceBottom) {
                let module;
                try { module = await import('https://unpkg.com/php-wasm/PhpWeb.mjs'); } 
                catch (err1) { module = await import('https://cdn.jsdelivr.net/npm/php-wasm/PhpWeb.mjs'); }
                window.phpWebInstanceBottom = new module.PhpWeb();
                window.phpWebInstanceBottom.addEventListener('output', (event) => window.printToBottomConsole(String(event.detail), 'normal'));
                window.phpWebInstanceBottom.addEventListener('error', (event) => window.printToBottomConsole(String(event.detail), 'error'));
                await new Promise(r => setTimeout(r, 200));
            }
            if (!window._bpConsoleRunningState[winId]) throw new Error("Interrupted");
            let phpCode = code.trim();
            if (!phpCode.startsWith('<?php')) {
                phpCode = `<?php\nerror_reporting(E_ALL);\nini_set('display_errors', 1);\n${phpCode}\n?>`;
            }
            await window.phpWebInstanceBottom.run(phpCode);
            return;
        }

        if (ext === 'rb' || ext === 'ruby') {
            if (!window.opalLoading && typeof window.Opal === 'undefined') {
                const loadScript = (src) => new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = src; script.onload = resolve;
                    script.onerror = () => reject(new Error(`Failed to load ${src}`));
                    document.head.appendChild(script);
                });
                window.opalLoading = (async () => {
                    await loadScript("https://cdn.opalrb.com/opal/current/opal.min.js");
                    await loadScript("https://cdn.opalrb.com/opal/current/opal-parser.min.js");
                    await loadScript("https://cdn.opalrb.com/opal/current/math.min.js");
                })();
            }
            if (window.opalLoading) await window.opalLoading;
            if (!window._bpConsoleRunningState[winId]) throw new Error("Interrupted");
            
            const originalLog = console.log;
            console.log = (...args) => { window.printToBottomConsole(args.join(' '), 'normal'); };
            try {
                const rubyResult = window.Opal.eval(code);
                if (rubyResult !== undefined && rubyResult !== null && String(rubyResult) !== 'nil') {
                    window.printToBottomConsole(String(rubyResult), 'normal');
                }
            } catch(e) {
                window.printToBottomConsole(`[Ruby Error] ${e.message || String(e)}`, 'error');
            } finally {
                console.log = originalLog;
            }
            return;
        }

        if (ext === 'js' || ext === 'javascript' || ext === 'ts' || ext === 'typescript') {
            if (!window._bpConsoleRunningState[winId]) throw new Error("Interrupted");
            const originalLog = console.log;
            const originalError = console.error;
            const originalWarn = console.warn;
            const originalInfo = console.info;

            console.log = (...args) => { window.printToBottomConsole(args.join(' '), 'normal'); originalLog(...args); };
            console.error = (...args) => { window.printToBottomConsole(args.join(' '), 'error'); originalError(...args); };
            console.warn = (...args) => { window.printToBottomConsole(args.join(' '), 'system'); originalWarn(...args); };
            console.info = (...args) => { window.printToBottomConsole(args.join(' '), 'system'); originalInfo(...args); };

            try {
                let res;
                if (/\bawait\b/.test(code)) {
                    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                    try { res = await (new AsyncFunction(`return (${code});`))(); }
                    catch(e) { res = await (new AsyncFunction(code))(); }
                } else {
                    try { res = eval.call(window, `(${code})`); }
                    catch(e) { res = eval.call(window, code); }
                }

                if (res !== undefined) {
                    window.printToBottomConsole(String(res), 'normal');
                }
            } catch(e) {
                window.printToBottomConsole(`[Error] ${e.message}`, 'error');
            } finally {
                console.log = originalLog;
                console.error = originalError;
                console.warn = originalWarn;
                console.info = originalInfo;
            }
            return;
        }
        
        if (ext === 'py' || ext === 'python' || ext === 'plaintext' || !ext) {
            const py = await window.getPyodideInstance();
            if (!py) throw new Error("Pyodide execution engine not loaded. Please wait or refresh the page.");
            
            py.runPython(`
import sys, io
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
            `);
            
            const res = await py.runPythonAsync(code);
            
            if(!window._bpConsoleRunningState[winId]) {
                throw new Error("Interrupted");
            }
            
            const stdout = py.runPython("sys.stdout.getvalue()");
            const stderr = py.runPython("sys.stderr.getvalue()");
            
            if (stdout) window.printToBottomConsole(stdout, 'normal');
            if (stderr) window.printToBottomConsole(stderr, 'error');
            
            if (res !== undefined && res !== null && res.toString() !== 'None') {
                window.printToBottomConsole(String(res), 'normal');
            }
        }
    } catch(e) {
        if (e.message === 'Interrupted') {
            window.printToBottomConsole("[Execution Interrupted]", 'error');
        } else {
            window.printToBottomConsole(e.toString(), 'error');
        }
    } finally {
        if (stopBtn) stopBtn.classList.add('disabled');
        if (playBtn) playBtn.classList.remove('disabled');
        window._bpConsoleRunningState[winId] = false;
    }
};

// Console Interactivity Listeners
document.addEventListener('DOMContentLoaded', () => {
    const playBtn = document.getElementById('bpConsolePlayBtn');
    const stopBtn = document.getElementById('bpConsoleStopBtn');
    const clearBtn = document.getElementById('bpConsoleClearBtn');
    const inputFld = document.getElementById('bpConsoleInput');

    if (playBtn) {
        playBtn.addEventListener('click', () => {
            if (playBtn.classList.contains('disabled')) return;
            const activePane = document.querySelector('.editor-group.active-group .content-pane.active') || document.querySelector('.content-pane.active');
            if (!activePane) return;
            
            const tabEl = document.querySelector(`.tab[data-target="${activePane.id}"]`);
            if (!tabEl) return;
            
            const fileName = tabEl.querySelector('span').textContent;
            const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
            
            let code = '';
            if (tabEl.dataset.type === 'monaco' && window.monaco) {
                const editorContainer = activePane.querySelector('[id^="editor-container-"]');
                if (editorContainer) {
                    const editor = window.monaco.editor.getEditors().find(e => editorContainer.contains(e.getContainerDomNode()));
                    if (editor) code = editor.getValue();
                }
            }
            
            if (code) {
                window.runInBottomConsole(code, ext);
            } else {
                window.printToBottomConsole(`[Error] No code found to execute or unsupported tab type.`, 'error');
            }
        });
    }
    
    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            if (stopBtn.classList.contains('disabled')) return;
            window._bpConsoleRunningState[_getEditorWinId()] = false;
            window.printToBottomConsole("[Interrupting...]", 'system');
            stopBtn.classList.add('disabled');
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            const out = document.getElementById('bpConsoleOutput');
            if (out) out.innerHTML = '<div style="margin-bottom: 5px; color: var(--accent-blue);">[Info] Console cleared.</div>';
        });
    }
    
    if (inputFld) {
        let enterHandled = false; // guards the 'input' fallback below from double-firing after a normal keydown Enter
        const submitConsoleInput = () => {
            const val = inputFld.value.trim();
            if (val) {
                inputFld.value = '';
                const activePane = document.querySelector('.editor-group.active-group .content-pane.active') || document.querySelector('.content-pane.active');
                let targetExt = 'py';
                if (activePane) {
                    const tabEl = document.querySelector(`.tab[data-target="${activePane.id}"]`);
                    if (tabEl) {
                        const fileName = tabEl.querySelector('span').textContent;
                        targetExt = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : 'py';
                    }
                }
                if (!['js', 'javascript', 'ts', 'typescript', 'php', 'rb', 'ruby'].includes(targetExt)) {
                    targetExt = 'py';
                }
                window.runInBottomConsole(val, targetExt);
            }
        };

        inputFld.addEventListener('keydown', (e) => {
            // Standard path: works for physical keyboards and most desktop browsers.
            // Some Android IME keyboards never reach here for the Enter/Go/Send key
            // (they report keyCode 229 / key 'Unidentified' since it's delivered via
            // IME composition), so this alone isn't sufficient on those devices -
            // see the 'beforeinput' listener below for the fallback path.
            if (e.key === 'Enter' || e.keyCode === 13) {
                e.preventDefault();
                enterHandled = true;
                submitConsoleInput();
            }
        });

        // Android IME fallback: when the on-screen keyboard's Enter/Go/Send key is
        // tapped, many Android IMEs (Gboard, Samsung Keyboard, etc.) don't surface a
        // normal 'Enter' keydown at all. For a single-line <input>, the browser also
        // never lets a literal newline land in .value, so a plain 'input' listener
        // never sees it either. The reliable hook is 'beforeinput' with inputType
        // 'insertLineBreak', which fires right before that (suppressed) edit.
        inputFld.addEventListener('beforeinput', (e) => {
            if (e.inputType !== 'insertLineBreak') return;
            e.preventDefault();
            if (enterHandled) { enterHandled = false; return; } // already handled by keydown
            submitConsoleInput();
        });
    }

    // --- Bottom Panel Terminal Connection Logic ---
    const connectTermBtn = document.getElementById('bpConsoleConnectTerminalBtn');
    const disconnectTermBtn = document.getElementById('bpConsoleDisconnectTerminalBtn');
    const consolePanelContent = document.getElementById('consolePanelContent');
    const consoleTabBtn = document.querySelector('.bottom-panel-tab[data-target="consolePanelContent"]');
    const bottomPanelHeader = document.querySelector('.bottom-panel-header');
    
    const bpConsoleOutput = document.getElementById('bpConsoleOutput');
    const bpConsoleInputArea = document.getElementById('bpConsoleInput') ? document.getElementById('bpConsoleInput').parentElement : null;
    const actionPlayBtn = document.getElementById('bpConsolePlayBtn');
    const actionStopBtn = document.getElementById('bpConsoleStopBtn');
    const actionClearBtn = document.getElementById('bpConsoleClearBtn');

    function updateBottomPanelHeaderStyle() {
        if (!bottomPanelHeader) return;
        const isTerminalConnected = window.connectedTerminalInfo !== null;
        const activeTab = document.querySelector('.bottom-panel-tab.active');
        const isTerminalTabActive = activeTab && activeTab.getAttribute('data-target') === 'consolePanelContent';
        
        if (isTerminalConnected && isTerminalTabActive) {
            bottomPanelHeader.classList.add('terminal-active');
        } else {
            bottomPanelHeader.classList.remove('terminal-active');
        }
    }

    const tabs = document.querySelectorAll('.bottom-panel-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => { setTimeout(updateBottomPanelHeaderStyle, 10); });
    });

    window.connectedTerminalInfo = null;

    if (connectTermBtn) {
        connectTermBtn.addEventListener('click', () => {
            const termTabs = document.querySelectorAll('.tab[data-type="terminal"]');
            if (termTabs.length === 0) {
                if (window.showCustomModal) {
                    window.showCustomModal({ title: 'Terminal Required', text: 'Please open a Terminal window first from the launcher or menu to connect to the Terminal.', submitText: 'OK' }, () => { closeGenModal(); });
                } else {
                    alert('Please open a Terminal window first.');
                }
                return;
            }

            // Prefer the terminal active in whichever group the user is
            // actually focused on - with two terminals open (one per split
            // pane), a bare document-wide '.tab.active[data-type="terminal"]'
            // query would always favor editorGroup1 (it's earlier in the DOM)
            // regardless of which one the user meant to connect.
            const focusedGroupEl = document.getElementById(typeof activeGroupId !== 'undefined' ? activeGroupId : 'editorGroup1')
                || document.querySelector('.editor-group.active-group');
            let targetTab = (focusedGroupEl && focusedGroupEl.querySelector('.tab.active[data-type="terminal"]'))
                || document.querySelector('.tab.active[data-type="terminal"]')
                || termTabs[0];
            let paneId = targetTab.dataset.target;
            let targetPane = document.getElementById(paneId);
            if (!targetPane) return;

            let termContainer = targetPane.querySelector('[id^="term-"]');
            if (!termContainer) return;

            window.connectedTerminalInfo = { pane: targetPane, termContainer: termContainer, tab: targetTab };

            termContainer.style.height = '100%'; 
            consolePanelContent.insertBefore(termContainer, consolePanelContent.firstChild);

            if (bpConsoleOutput) bpConsoleOutput.style.display = 'none';
            if (bpConsoleInputArea) bpConsoleInputArea.style.display = 'none';
            if (actionPlayBtn) actionPlayBtn.style.display = 'none';
            if (actionStopBtn) actionStopBtn.style.display = 'none';
            if (actionClearBtn) actionClearBtn.style.display = 'none';
            
            connectTermBtn.style.display = 'none';
            disconnectTermBtn.style.display = 'block';

            if (consoleTabBtn) consoleTabBtn.textContent = 'Terminal';
            consolePanelContent.style.backgroundColor = 'var(--term-output-bg)';
            
            updateBottomPanelHeaderStyle();
            
            setTimeout(() => {
                const termInput = termContainer.querySelector('.term-input');
                if (termInput) termInput.focus();
            }, 50);
        });
    }

    window.disconnectBottomTerminal = function() {
        if (!window.connectedTerminalInfo) return;
        
        const { pane, termContainer } = window.connectedTerminalInfo;
        
        if (pane && document.body.contains(pane)) {
            pane.appendChild(termContainer); 
        } else {
            termContainer.remove();
        }
        
        if (bpConsoleOutput) bpConsoleOutput.style.display = 'block';
        if (bpConsoleInputArea) bpConsoleInputArea.style.display = 'flex';
        if (actionPlayBtn) actionPlayBtn.style.display = 'block';
        if (actionStopBtn) actionStopBtn.style.display = 'block';
        if (actionClearBtn) actionClearBtn.style.display = 'block';
        
        if (connectTermBtn) connectTermBtn.style.display = 'block';
        if (disconnectTermBtn) disconnectTermBtn.style.display = 'none';

        if (consoleTabBtn) consoleTabBtn.textContent = 'Console';
        consolePanelContent.style.backgroundColor = '';
        
        window.connectedTerminalInfo = null;
        updateBottomPanelHeaderStyle();
    };

    if (disconnectTermBtn) {
        disconnectTermBtn.addEventListener('click', window.disconnectBottomTerminal);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Sync icon colors dynamically if tab text changes (e.g. rename operations outside of editor bounds)
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'characterData' || mutation.type === 'childList') {
                let target = mutation.target;
                if (target.nodeType === Node.TEXT_NODE) target = target.parentElement;
                
                if (target && target.tagName === 'SPAN' && target.parentElement && target.parentElement.classList.contains('tab')) {
                    const tab = target.parentElement;
                    if (tab.dataset.type === 'workspace' || tab.dataset.type === 'settings' || tab.dataset.type === 'profile' || tab.dataset.type === 'console' || tab.dataset.type === 'terminal' || tab.dataset.type === 'help' || tab.dataset.type === 'document') continue;
                    
                    const filename = target.textContent;
                    const iEl = tab.querySelector('i:not(.tab-close)');
                    if (iEl && typeof getFileIconHTML === 'function') {
                        const newIconHTML = getFileIconHTML(filename);
                        
                        // Extract Style
                        const styleMatch = newIconHTML.match(/style="([^"]+)"/);
                        if (styleMatch) iEl.setAttribute('style', styleMatch[1]);
                        else iEl.removeAttribute('style');
                        
                        // Extract Core Class Layout 
                        const classMatch = newIconHTML.match(/class="([^"]+)"/);
                        if (classMatch) iEl.className = classMatch[1].replace('file-icon', '').trim();
                    }
                }
            }
        }
    });
    const splitView = document.getElementById('splitView') || document.body;
    observer.observe(splitView, { childList: true, subtree: true, characterData: true });
});
