// ==========================================
// notebook-ui.js (UI & Monaco Editor Management)
// ==========================================

// --- Strict Isolation Registry ---
window.cellClipboardRegistry = window.cellClipboardRegistry || {};

function _getNbUiWinId() {
    return localStorage.getItem('codemini_active_window') || 'win_default';
}

// --- Enhanced HTML & PDF Export Engine ---
window.generateCleanNotebookHTML = function(pane) {
    const escapeHTML = (str) => {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag));
    };

    let html = '';
    const cells = pane.querySelectorAll('.cell');
    
    cells.forEach((cell) => {
        const cellType = cell.dataset.cellType || 'code';
        let code = '';
        
        if (window.cellMonacoEditors && window.cellMonacoEditors[cell.dataset.cellId]) {
            code = window.cellMonacoEditors[cell.dataset.cellId].getValue();
        } else if (cell.querySelector('.cell-monaco-container')?.hasAttribute('data-saved-code')) {
            code = decodeURIComponent(cell.querySelector('.cell-monaco-container').getAttribute('data-saved-code'));
        } else {
            code = cell.querySelector('.cell-editor')?.innerText || '';
        }

        if (cellType === 'markdown') {
            const rendered = cell.querySelector('.markdown-rendered');
            if (rendered) {
                html += `<div class="export-markdown">${rendered.innerHTML}</div>`;
            } else {
                html += `<div class="export-markdown"><pre>${escapeHTML(code)}</pre></div>`;
            }
        } else if (cellType === 'code') {
            const promptEl = cell.querySelector('.cell-prompt');
            const promptText = promptEl && promptEl.style.display !== 'none' ? promptEl.textContent : `In [ ]:`;
            
            let outputWrapper = cell.querySelector('.cell-output-wrapper');
            let outputHtml = '';
            if (outputWrapper) {
                const clone = outputWrapper.cloneNode(true);
                clone.querySelectorAll('.output-actions-bar').forEach(el => el.remove());
                clone.querySelectorAll('.plot-toolbar').forEach(el => el.remove());
                outputHtml = clone.innerHTML;
            }

            html += `
                <div class="export-cell">
                    <div class="export-input-area">
                        <div class="export-prompt">${escapeHTML(promptText)}</div>
                        <div class="export-code"><pre><code>${escapeHTML(code)}</code></pre></div>
                    </div>
                    ${outputHtml.trim() ? `<div class="export-output-area"><div class="export-output-content">${outputHtml}</div></div>` : ''}
                </div>
            `;
        }
    });

    const themeCss = `
        :root {
            --bg-color: #ffffff;
            --text-main: #24292e;
            --text-muted: #586069;
            --prompt-color: #0366d6;
            --code-bg: #f6f8fa;
            --border-color: #e1e4e8;
            --font-mono: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        }
        body { font-family: var(--font-sans); line-height: 1.6; color: var(--text-main); background-color: var(--bg-color); max-width: 950px; margin: 0 auto; padding: 40px 20px; }
        h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; color: #111; font-weight: 600; }
        .export-header { border-bottom: 2px solid var(--border-color); padding-bottom: 20px; margin-bottom: 40px; text-align: center; }
        .export-header h1 { margin: 0 0 10px 0; font-size: 28px; color: #222; }
        .export-header p { margin: 0; color: var(--text-muted); font-size: 14px; }
        .export-cell { margin-bottom: 25px; page-break-inside: avoid; display: flex; flex-direction: column; width: 100%; }
        .export-input-area { display: flex; align-items: stretch; margin-bottom: 10px; width: 100%; }
        .export-prompt { font-family: var(--font-mono); font-size: 13px; color: var(--prompt-color); min-width: 75px; text-align: right; padding-right: 15px; margin-top: 12px; font-weight: bold; }
        .export-code { flex-grow: 1; background-color: var(--code-bg); border: 1px solid var(--border-color); border-radius: 6px; padding: 12px 16px; overflow-x: auto; box-shadow: inset 0 1px 3px rgba(0,0,0,0.02); }
        .export-code pre { margin: 0; font-family: var(--font-mono); font-size: 13px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; color: #24292e; }
        .export-output-area { display: flex; align-items: flex-start; width: 100%; margin-top: 5px; }
        .export-output-area::before { content: 'Out:'; font-family: var(--font-mono); font-size: 13px; color: #d73a49; min-width: 75px; text-align: right; padding-right: 15px; font-weight: bold; margin-top: 10px; opacity: 0; }
        .export-output-content { flex-grow: 1; overflow-x: auto; padding: 0 5px; }
        .cell-output { padding: 8px 0; font-family: var(--font-mono); font-size: 13px; white-space: pre-wrap; word-wrap: break-word; color: #333; }
        .plot-container { display: flex; flex-direction: column; gap: 15px; margin-top: 12px; align-items: flex-start; }
        .plot-card { background: #fff; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; display: inline-block; box-shadow: 0 2px 5px rgba(0,0,0,0.04); }
        .plot-card img { max-width: 100%; height: auto; display: block; }
        .plot-toolbar { display: none !important; }
        .export-markdown { margin-bottom: 25px; padding: 10px 10px 10px 90px; }
        .sql-table-responsive { max-width: 100%; overflow-x: auto; border: 1px solid var(--border-color); border-radius: 6px; margin-top: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }
        .sql-table-responsive table { border-collapse: collapse; width: 100%; font-size: 13px; font-family: var(--font-sans); }
        .sql-table-responsive th, .sql-table-responsive td { padding: 10px 12px; border-bottom: 1px solid var(--border-color); }
        .sql-table-responsive th { background-color: var(--code-bg); text-align: left; font-weight: 600; border-right: 1px solid var(--border-color); }
        .sql-table-responsive td { border-right: 1px solid var(--border-color); }
        .execution-time { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); margin-top: 8px; font-style: italic; }
        
        @media print {
            body { max-width: 100%; padding: 0; background: #fff; }
            .export-header { margin-bottom: 20px; padding-bottom: 10px; }
            .export-cell { page-break-inside: avoid; margin-bottom: 20px; }
            .export-code { border: 1px solid #ddd; background-color: #fafafa; box-shadow: none; }
            .plot-card { box-shadow: none; border: 1px solid #ddd; }
            .export-prompt { color: #000; }
            .export-output-area::before { color: #000; }
        }
    `;

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CodeMini Notebook Export</title>
        <style>${themeCss}</style>
    </head>
    <body>
        <div class="export-header">
            <h1>Notebook Document</h1>
            <p>Exported securely from CodeMini on ${new Date().toLocaleString()}</p>
        </div>
        <div class="notebook-content">
            ${html}
        </div>
    </body>
    </html>
    `;
};

const CELL_TOOLBAR_HTML = `
    <div class="cell-toolbar">
        <div class="ct-left" style="display: flex; gap: 12px; align-items: center; position: relative;">
            <i class="ri-more-fill responsive-ct-more" title="More Actions"></i>
            <div class="ct-responsive-actions" style="display: flex; gap: 12px;">
                <i class="ri-price-tag-3-line tb-add-tag" title="Add Tag"></i>
                <i class="ri-draft-fill tb-copy-to-pad" title="Copy to Scratchpad"></i>
                <svg class="tb-ai-action" title="Agent Mini (AI)" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                <div class="responsive-hide" style="width: 1px; height: 16px; background: var(--border-color); margin: 0 8px;"></div>
                <i class="ri-insert-row-top tb-cell-before" title="New Cell Before"></i>
                <i class="ri-insert-row-bottom tb-cell-after" title="New Cell After"></i>
            </div>
            <div class="ct-responsive-dropdown">
                <div class="dropdown-item tb-add-tag"><i class="ri-price-tag-3-line"></i> Add Tag</div>
                <div class="dropdown-item tb-cell-before"><i class="ri-insert-row-top"></i> New Cell Before</div>
                <div class="dropdown-item tb-cell-after"><i class="ri-insert-row-bottom"></i> New Cell After</div>
                <div class="dropdown-item tb-copy-to-pad"><i class="ri-draft-fill"></i> Copy to Scratchpad</div>
                <div class="dropdown-item tb-ai-action"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="color: var(--icon-gray);"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Agent Mini</div>
            </div>
        </div>
        <div class="ct-right" style="display: flex; gap: 12px; align-items: center;">
            <i class="ri-arrow-up-line tb-move-up" title="Move Up"></i>
            <i class="ri-arrow-down-line tb-move-down" title="Move Down"></i>
            <div class="responsive-hide" style="width: 1px; height: 16px; background: var(--border-color); margin: 0 8px;"></div>
            <i class="ri-scissors-cut-line tb-cut-cell" title="Cut Cell"></i>
            <i class="ri-file-copy-line tb-copy-cell" title="Copy Cell"></i>
            <i class="ri-clipboard-line tb-paste-cell" title="Paste Cell"></i>
            <div class="responsive-hide" style="width: 1px; height: 16px; background: var(--border-color); margin: 0 8px;"></div>
            <i class="ri-delete-bin-line tb-delete-cell" title="Delete Cell" style="color: var(--color-danger);"></i>
        </div>
    </div>
`;

window.initCellMonacoEditor = function(editorContainer, initialValue, cellType, cellId) {
    if (!window.monaco) {
        setTimeout(() => window.initCellMonacoEditor(editorContainer, initialValue, cellType, cellId), 100);
        return null;
    }
    
    const language = cellType === 'markdown' ? 'markdown' : (cellType === 'raw' ? 'plaintext' : 'python');
    const isDark = window.appSettings && typeof window.isThemeDark === 'function' && window.isThemeDark();

    const editor = window.monaco.editor.create(editorContainer, {
        value: initialValue || '',
        language: language,
        theme: isDark ? 'vs-dark' : 'vs-light',
        automaticLayout: true,
        
        // NB SETTINGS OVERRIDES
        fontSize: window.appSettings ? window.appSettings.nbCellFontSize : 13,
        fontFamily: window.appSettings ? window.appSettings.nbCellFontFamily : "'Fira Code', monospace",
        lineHeight: window.appSettings ? window.appSettings.nbCellLineHeight : 21,
        letterSpacing: window.appSettings ? window.appSettings.nbCellLetterSpacing : 0.3,
        lineNumbers: window.appSettings ? window.appSettings.nbCellLineNumbers : 'off',
        wordWrap: window.appSettings ? window.appSettings.nbCellWordWrap : 'on',
        folding: window.appSettings ? window.appSettings.nbCellFolding : false,
        minimap: { enabled: window.appSettings ? window.appSettings.nbCellMinimap : false },
        renderWhitespace: window.appSettings ? window.appSettings.nbCellRenderWhitespace : 'none',
        bracketPairColorization: { enabled: window.appSettings ? window.appSettings.nbCellBracketPairs : true },
        cursorStyle: window.appSettings ? window.appSettings.nbCellCursorStyle : 'line',
        cursorBlinking: window.appSettings ? window.appSettings.nbCellCursorBlinking : 'expand',
        smoothScrolling: window.appSettings ? window.appSettings.nbCellSmoothScrolling : true,

        lineNumbersMinChars: 3,
        scrollBeyondLastLine: false,
        renderLineHighlight: 'line',
        autoClosingBrackets: 'always',
        autoClosingQuotes: 'always',
        suggest: { showWords: true },
        padding: { top: 8, bottom: 8 },
        scrollbar: {
            vertical: 'auto', horizontal: 'auto',
            verticalScrollbarSize: 8, horizontalScrollbarSize: 8,
        },
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        overviewRulerBorder: false,
        renderLineHighlightOnlyWhenFocus: true,
        glyphMargin: false
    });
    
    const updateEditorHeight = () => {
        const contentHeight = editor.getContentHeight();
        editorContainer.style.height = `${contentHeight}px`;
        editor.layout();
    };

    editor.onDidContentSizeChange((e) => {
        if (e.contentHeightChanged) {
            updateEditorHeight();
        }
    });
    
    setTimeout(updateEditorHeight, 50);

    if (cellId) {
        window.cellMonacoEditors[cellId] = editor;
    }
    
    return editor;
};

window.getNotebookHTML = function(kernelType = 'python') {
    let kernelIcon = '<i class="fab fa-python" style="color: var(--icon-py);"></i> Python 3 (Pyodide)';
    if (kernelType === 'r') kernelIcon = '<i class="fab fa-r-project" style="color: #276dc3;"></i> R (WebR)';
    else if (kernelType === 'sql') kernelIcon = '<i class="ri-database-2-line" style="color: #4CAF50;"></i> SQL (SQLite)';

    const initCellId = 'cell-' + Date.now() + '-' + Math.floor(Math.random() * 10000);

    return `
        <style>
            .plot-toolbar i.plot-dl-btn:hover, 
            .plot-toolbar i.plot-max-btn:hover,
            .sql-table-btn:hover {
                color: var(--text-main) !important;
                background-color: var(--bg-panel);
            }
            .sql-table-responsive {
                max-width: 100%;
                overflow-x: auto;
                overflow-y: auto;
                max-height: 400px;
                border: 1px solid var(--border-color);
                border-radius: 2px;
                background: var(--bg-white);
            }
            .sql-table-responsive table {
                border-collapse: collapse;
                width: 100%;
                text-align: left;
                font-size: 13px;
                white-space: nowrap;
            }
            .sql-table-responsive thead {
                position: sticky;
                top: 0;
                background-color: var(--bg-tabs-bar);
                z-index: 1;
                box-shadow: 0 1px 2px rgba(0,0,0,0.1);
            }
            .sql-table-responsive th, .sql-table-responsive td {
                padding: 8px 12px;
                border-right: 1px solid var(--border-color);
                border-bottom: 1px solid var(--border-color);
            }
            .sql-table-responsive th {
                font-weight: 600;
                color: var(--text-main);
            }
            .sql-table-responsive td {
                color: var(--text-main);
            }
            .cell-monaco-editor {
                min-height: 55px;
                border: none;
                width: 100%;
            }
            .cell.input .cell-monaco-container {
                min-height: 55px;
            }
            .markdown-rendered {
                padding: 10px 15px;
                font-family: var(--font-main);
                line-height: 1.6;
            }
            
            .cell.markdown-mode-active, .cell.raw-mode-active {
                padding-left: 0;
                background: transparent;
                border: none;
            }
            .cell.markdown-mode-active .cell-input,
            .cell.markdown-mode-active .cell-prompt,
            .cell.markdown-mode-active .active-indicator,
            .cell.raw-mode-active .cell-prompt,
            .cell.raw-mode-active .active-indicator {
                display: none !important;
            }
            .cell.raw-mode-active .cell-input {
                border: 1px dashed var(--border-color);
                background-color: var(--bg-panel);
            }
            .cell.markdown-mode-active .cell-output-wrapper {
                padding: 0;
                gap: 0;
            }
            .cell.markdown-mode-active .cell-output {
                padding: 0;
                background: transparent;
            }
            .custom-markdown-view {
                cursor: pointer;
                transition: background-color 0.2s;
                border: 1px solid transparent;
            }
            .tb-interrupt.disabled {
                opacity: 0.3 !important;
                pointer-events: none;
                cursor: not-allowed;
            }

            /* --- Cell Tags Restyled & Outputs --- */
            .cell-tags { display: none; flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden; gap: 0; padding: 0; background: var(--bg-tabs-bar); border-bottom: 1px solid var(--border-color); border-radius: 2px 2px 0 0; }
            .cell-tags::-webkit-scrollbar { display: none; }
            .cell-tags.has-tags { display: flex; }
            .cell-tag { background: var(--bg-panel); color: var(--text-muted); font-size: 13px; padding: 0 10px 0 12px; height: 26px; display: inline-flex; align-items: center; gap: 8px; border-right: 1px solid var(--border-color); border-top: 1px solid var(--border-color); cursor: default; margin-bottom: -1px; white-space: nowrap; }
            .cell-tag i { cursor: pointer; transition: color 0.2s; font-size: 14px;}
            .cell-tag i:hover { color: var(--color-danger); }
            
            .cell-toolbar i { cursor: pointer; font-size: 15px; transition: color 0.2s; }
            .cell-toolbar i:hover { color: var(--text-main); }
            .cell-toolbar svg { cursor: pointer; transition: color 0.2s; }
            .cell-toolbar svg:hover { color: var(--text-main); }
            
            .output-actions-bar { display: flex; justify-content: flex-end; gap: 8px; padding: 4px 10px; font-size: 14px; color: var(--icon-gray); background: var(--bg-panel); border-bottom: 1px solid var(--border-color); }
            .output-actions-bar i { cursor: pointer; transition: color 0.2s; }
            .output-actions-bar i:hover { color: var(--text-main); }
            .cell-output.collapsed { display: none; }

            /* --- Scratchpad Layout Enhanced --- */
            .scratchpad-panel { position: relative; width: 0; background: var(--bg-white); border-left: 1px solid var(--border-color); display: flex; flex-direction: column; transition: width 0.3s ease; overflow: hidden; flex-shrink: 0; }
            .scratchpad-panel.show { width: 400px; }
            .scratchpad-header { display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; font-weight: 600; color: var(--text-main); font-size: 13px; border-top: 1px solid var(--border-color); background: var(--bg-white); flex-shrink: 0;}
            .scratchpad-header i { cursor: pointer; color: var(--icon-gray); font-size: 16px; transition: color 0.2s; font-weight: normal !important;}
            .scratchpad-header i:hover { color: var(--text-main); }
            .sp-body { flex: 1; display: flex; flex-direction: column; min-height: 0; }
            .sp-output-container { display: none; flex-direction: column; background: var(--bg-white); }
            .sp-output-container.overlay-mode { display: flex; position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 10; border-top: none; }
            .sp-output-container.split-mode { display: flex; flex: 1; border-top: 1px solid var(--border-color); }
            .sp-output { flex: 1; overflow: auto; padding: 10px; background: var(--bg-panel); font-family: var(--font-mono); font-size: 13px; color: var(--text-main); white-space: pre-wrap; word-break: break-word; }
            .sp-output.empty { display: flex; align-items: center; justify-content: center; height: 100%; text-align: center; }

            @media (max-width: 768px) {
                .scratchpad-panel { width: 100%; height: 0; border-left: none; border-top: 1px solid var(--border-color); transition: height 0.3s ease; }
                .scratchpad-panel.show { width: 100%; height: 45%; }
            }
        </style>
        
        <div class="toolbar">
            <div class="nav-dropdown-container">
                <i class="ri-external-link-line tb-export-menu" title="Export Notebook"></i>
                <div class="explorer-dropdown" id="exportDropdown" style="left: 0; top: 100%; margin-top: 10px;">
                    <div class="dropdown-item tb-export-pdf"><i class="ri-file-pdf-line"></i> Export as PDF</div>
                    <div class="dropdown-item tb-export-html"><i class="ri-html5-line"></i> Export as HTML</div>
                    <div class="dropdown-item tb-export-json"><i class="ri-braces-line"></i> Export as JSON</div>
                </div>
            </div>
            
            <i class="ri-draft-line tb-scratchpad" title="Toggle Scratchpad"></i>
            <i class="ri-list-unordered tb-vars" title="Variables Explorer"></i>
            <i class="ri-list-check-2 tb-toc" title="Table of Contents"></i>
            <div class="separator responsive-hide"></div>
            <i class="ri-play-fill tb-run" title="Run Cell (Ctrl+Enter)"></i>
            <i class="ri-stop-mini-fill responsive-hide tb-interrupt disabled" title="Interrupt Kernel"></i>
            <div class="separator responsive-hide"></div>
            <i class="ri-restart-line responsive-hide tb-restart" title="Restart Kernel"></i>
            <i class="ri-skip-forward-mini-fill responsive-hide tb-run-all" title="Restart & Run All"></i>
            <i class="ri-play-circle-line responsive-hide tb-run-all-no-restart" title="Run All Cells"></i>
            <i class="ri-play-list-add-line responsive-hide tb-run-tagged" title="Run Tagged Cells"></i>
            <i class="ri-play-list-line responsive-hide tb-run-untagged" title="Run Untagged Cells"></i>
            <div class="separator responsive-hide"></div>
            <div class="toolbar-dropdown tb-cell-type">Code</div>
            <div class="separator responsive-hide"></div>
            <span class="responsive-hide tb-format" style="color: var(--accent-new-light); font-family: monospace; font-weight: bold; font-size: 14px; cursor: pointer;" title="Format Code">{}</span>
            <i class="ri-map-pin-line responsive-hide tb-properties" title="Property Inspector"></i>

            <div class="responsive-more-container">
                <i class="ri-more-2-fill responsive-more-btn"></i>
                <div class="responsive-dropdown">
                    <div class="dropdown-item tb-interrupt disabled"><i class="ri-stop-mini-fill"></i> Interrupt Kernel</div>
                    <div class="dropdown-item tb-restart"><i class="ri-restart-line"></i> Restart Kernel</div>
                    <div class="dropdown-item tb-run-all"><i class="ri-skip-forward-mini-fill"></i> Restart & Run All</div>
                    <div class="dropdown-item tb-run-all-no-restart"><i class="ri-play-circle-line"></i> Run All Cells</div>
                    <div class="dropdown-item tb-run-tagged"><i class="ri-play-list-add-line"></i> Run Tagged Cells</div>
                    <div class="dropdown-item tb-run-untagged"><i class="ri-play-list-line"></i> Run Untagged Cells</div>
                    <div style="height: 1px; background: var(--border-color); margin: 4px 0;"></div>
                    <div class="dropdown-item tb-format"><span style="color: var(--accent-new-light); font-family: monospace; font-weight: bold; font-size: 14px; margin-right: 2px;">{}</span> Format Code</div>
                    <div class="dropdown-item tb-properties"><i class="ri-map-pin-line"></i> Property Inspector</div>
                    <div class="dropdown-item tb-clear-outputs"><i class="ri-eraser-line"></i> Clear All Outputs</div>
                </div>
            </div>
            
            <div class="toolbar-right">
                <a href="#" class="notebook-link tb-trust" data-trusted="true"><span class="responsive-hide">Trusted</span> <i class="ri-shield-check-line"></i></a>
                <div class="status-circle" title="Kernel Status"></div>
            </div>
        </div>

        <div class="kernel-status" data-kernel="${kernelType}">${kernelIcon} -- Ready</div>

        <div class="notebook-layout">
            <div class="cells-container">
                <div class="cell active" data-cell-type="code" data-cell-id="${initCellId}">
                    <div class="active-indicator"></div>
                    <div class="cell-content-wrapper">
                        <div class="cell-input">
                            <div class="cell-tags"></div>
                            ${CELL_TOOLBAR_HTML}
                            <div class="cell-prompt" style="font-weight: 600;">In [ ]:</div>
                            <div class="cell-monaco-container" style="min-height: 55px; width: 100%;"></div>
                        </div>
                        <div class="cell-output-wrapper"></div>
                    </div>
                </div>
                <div class="add-cell">+ New cell</div>
            </div>

            <div class="vars-explorer-panel">
                <div class="vars-header">
                    <span>Variables Explorer</span>
                    <div style="display:flex; gap: 10px;">
                        <i class="ri-refresh-line vars-refresh" style="cursor:pointer;" title="Refresh Variables"></i>
                        <i class="ri-close-line vars-close" style="cursor:pointer;" title="Close Explorer"></i>
                    </div>
                </div>
                <div class="vars-content">
                    <div class="empty-state" style="padding:20px; text-align:center; color:var(--text-muted);">No variables to show</div>
                </div>
            </div>

            <div class="toc-panel" id="tocPanel">
                <div class="toc-header">
                    <span>Table of Contents</span>
                    <i class="ri-close-line toc-close" title="Close TOC"></i>
                </div>
                <div class="toc-content" id="tocContent">
                    <div class="toc-empty">No headings found</div>
                </div>
            </div>

            <div class="scratchpad-panel" id="scratchpadPanel">
                <div class="scratchpad-header">
                    <span>Scratchpad</span>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <i class="ri-play-fill sp-run" title="Run Scratchpad" style="font-size: 18px; cursor: pointer; transition: color 0.2s;"></i>
                        <i class="ri-file-copy-line sp-copy-to-cell" title="Copy to Active Cell" style="cursor: pointer; font-size: 16px;"></i>
                        <i class="ri-layout-row-line sp-split responsive-hide" title="Split Editor & Output View"></i>
                        <i class="ri-eraser-line sp-clear" title="Clear Code & Output"></i>
                        <i class="ri-window-line sp-toggle-output" title="Display Output"></i>
                        <i class="ri-close-line scratchpad-close" title="Close"></i>
                    </div>
                </div>
                <div class="sp-body">
                    <div class="sp-monaco-container" style="flex:1; min-height: 100px;"></div>
                    <div class="sp-output-container">
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:5px 10px; background:var(--bg-panel);  font-size:12px; border-top: 1px solid var(--border-color); font-weight:600; color:var(--text-main);">
                            Scratchpad Output
                            <div>
                                <i class="ri-file-copy-line sp-copy-output" title="Copy Output" style="cursor:pointer; font-size:14px; font-weight: 500; margin-right: 8px;"></i>
                                <i class="ri-close-line sp-close-output" title="Close Output" style="cursor:pointer; font-weight: 500; font-size:16px;"></i>
                            </div>
                        </div>
                        <div class="sp-output empty">
                            <span style="color:var(--text-muted); font-style:italic;">Scratchpad output will appear here...</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

// --- TOC Functions ---
window.generateTOC = function(pane) {
    const tocContent = pane.querySelector('#tocContent');
    if (!tocContent) return;
    
    const cells = pane.querySelectorAll('.cell');
    let tocItems = [];
    
    cells.forEach((cell, index) => {
        const cellType = cell.dataset.cellType || 'code';
        let headingText = '';
        let level = 0;
        
        if (cellType === 'markdown') {
            let code = '';
            if (window.cellMonacoEditors && window.cellMonacoEditors[cell.dataset.cellId]) {
                code = window.cellMonacoEditors[cell.dataset.cellId].getValue();
            } else {
                const monacoContainer = cell.querySelector('.cell-monaco-container');
                if (monacoContainer && monacoContainer.hasAttribute('data-saved-code')) {
                    code = decodeURIComponent(monacoContainer.getAttribute('data-saved-code'));
                }
            }
            
            const lines = code.split('\n');
            for (let line of lines) {
                const h1Match = line.match(/^#\s+(.+)/);
                const h2Match = line.match(/^##\s+(.+)/);
                const h3Match = line.match(/^###\s+(.+)/);
                
                if (h3Match) { headingText = h3Match[1].trim(); level = 3; } 
                else if (h2Match) { headingText = h2Match[1].trim(); level = 2; } 
                else if (h1Match) { headingText = h1Match[1].trim(); level = 1; }
                
                if (headingText && level > 0) {
                    tocItems.push({ text: headingText, level: level, cellIndex: index, cellId: cell.dataset.cellId });
                    headingText = ''; level = 0;
                }
            }
        } else {
            let code = '';
            if (window.cellMonacoEditors && window.cellMonacoEditors[cell.dataset.cellId]) {
                code = window.cellMonacoEditors[cell.dataset.cellId].getValue();
            }
            
            if (code) {
                const lines = code.split('\n');
                for (let line of lines) {
                    const trimmed = line.trim();
                    const sectionMatch = trimmed.match(/^#\s*={3,}\s*(.+)\s*={3,}$/);
                    if (sectionMatch) {
                        tocItems.push({ text: sectionMatch[1].trim(), level: 1, cellIndex: index, cellId: cell.dataset.cellId });
                    }
                }
            }
        }
    });
    
    if (tocItems.length === 0) {
        tocContent.innerHTML = '<div class="toc-empty">No headings found</div>';
        return;
    }
    
    let html = '';
    tocItems.forEach((item, idx) => {
        let icon = item.level === 1 ? 'ri-hash' : (item.level === 2 ? 'ri-hashtag' : 'ri-subscript');
        html += `
            <div class="toc-item toc-h${item.level}" data-cell-id="${item.cellId}" data-toc-index="${idx}">
                <i class="${icon} toc-icon"></i>
                <span>${item.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
            </div>
        `;
    });
    
    tocContent.innerHTML = html;
    pane._tocData = tocItems;
    
    tocContent.querySelectorAll('.toc-item').forEach(item => {
        item.addEventListener('click', () => {
            const cellId = item.dataset.cellId;
            const targetCell = pane.querySelector(`.cell[data-cell-id="${cellId}"]`);
            if (targetCell) {
                pane.querySelectorAll('.cell').forEach(c => c.classList.remove('active'));
                targetCell.classList.add('active');
                targetCell.scrollIntoView({ behavior: 'smooth', block: 'center' });
                tocContent.querySelectorAll('.toc-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                if (window.cellMonacoEditors && window.cellMonacoEditors[cellId]) {
                    setTimeout(() => window.cellMonacoEditors[cellId].focus(), 200);
                }
            }
        });
    });
};

window.initNotebookMonacoEditors = function(pane) {
    if (!window.monaco) {
        setTimeout(() => window.initNotebookMonacoEditors(pane), 200);
        return;
    }

    const trustLink = pane.querySelector('.tb-trust');
    if (trustLink) {
        const isCurrentlyTrusted = trustLink.dataset.trusted === 'true';
        const icon = trustLink.querySelector('i'); 
        const span = trustLink.querySelector('span');
        if (!isCurrentlyTrusted) {
            if (icon) { icon.className = 'ri-shield-flash-line'; icon.style.color = 'var(--color-danger)'; }
            if (span) span.textContent = 'Untrusted'; 
        } else {
            if (icon) { icon.className = 'ri-shield-check-line'; icon.style.color = ''; }
            if (span) span.textContent = 'Trusted'; 
        }
    }
    
    const cells = pane.querySelectorAll('.cell');
    cells.forEach(cell => {
        let cellId = cell.dataset.cellId;
        const cellType = cell.dataset.cellType || 'code';
        const monacoContainer = cell.querySelector('.cell-monaco-container');
        
        const tagsContainer = cell.querySelector('.cell-tags');
        if (tagsContainer && cell.dataset.tags) {
            try {
                const tagList = JSON.parse(cell.dataset.tags);
                if (tagList.length > 0) {
                    tagsContainer.classList.add('has-tags');
                    tagsContainer.innerHTML = '';
                    tagList.forEach(t => {
                        const span = document.createElement('span');
                        span.className = 'cell-tag';
                        span.innerHTML = `${t.replace(/</g, '&lt;')} <i class="ri-close-line remove-tag"></i>`;
                        tagsContainer.appendChild(span);
                    });
                }
            } catch(e){}
        }

        if (monacoContainer) {
            if (window.cellMonacoEditors[cellId]) {
                if (!monacoContainer.contains(window.cellMonacoEditors[cellId].getContainerDomNode())) {
                    if (document.body.contains(window.cellMonacoEditors[cellId].getContainerDomNode())) {
                        cellId = 'cell-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
                        cell.dataset.cellId = cellId;
                    } else {
                        window.cellMonacoEditors[cellId].dispose();
                        delete window.cellMonacoEditors[cellId];
                    }
                } else {
                    return; 
                }
            }
            
            monacoContainer.innerHTML = '';
            
            let codeToRestore = '';
            if (monacoContainer.hasAttribute('data-saved-code')) {
                codeToRestore = decodeURIComponent(monacoContainer.getAttribute('data-saved-code'));
            } else if (cell.querySelector('.cell-editor')) {
                codeToRestore = cell.querySelector('.cell-editor').innerText;
            }
            
            const editor = window.initCellMonacoEditor(monacoContainer, codeToRestore, cellType, cellId);
            
            if (editor) {
                editor.onDidChangeModelContent(() => {
                    const pane = cell.closest('.content-pane');
                    if (!pane) return;
                    const group = pane.closest('.editor-group');
                    if (!group) return;
                    const tabEl = group.querySelector(`.tab[data-target="${pane.id}"]`);
                    if (tabEl) {
                        tabEl.classList.add('unsaved-blink');
                    }
                    
                    if (window.appSettings && window.appSettings.autoSave === 'After Delay') {
                        clearTimeout(cell._saveTimeout);
                        cell._saveTimeout = setTimeout(() => {
                            triggerNotebookSave(pane);
                        }, window.appSettings.autoSaveDelay || 1000);
                    }
                    
                    clearTimeout(pane._tocUpdateTimeout);
                    pane._tocUpdateTimeout = setTimeout(() => {
                        const tocPanel = pane.querySelector('#tocPanel');
                        if (tocPanel && tocPanel.classList.contains('show')) {
                            window.generateTOC(pane);
                        }
                    }, 500);
                });
            }
        }
    });

    const spContainer = pane.querySelector('.sp-monaco-container');
    if (spContainer && !spContainer.hasChildNodes()) {
        const spEditorId = 'sp-' + pane.id;
        const spEditor = window.initCellMonacoEditor(spContainer, '', 'code', spEditorId);
        pane._spEditor = spEditor;
    }
    
    setTimeout(() => window.generateTOC(pane), 300);
};

function triggerNotebookSave(pane) {
    if (window.autoSaveFile) {
        const tabEl = document.querySelector(`.tab[data-target="${pane.id}"]`);
        if (tabEl) { 
            const cells = pane.querySelectorAll('.cell');
            cells.forEach(cell => {
                const monacoContainer = cell.querySelector('.cell-monaco-container');
                if (monacoContainer && window.cellMonacoEditors && window.cellMonacoEditors[cell.dataset.cellId]) {
                    const code = window.cellMonacoEditors[cell.dataset.cellId].getValue();
                    monacoContainer.setAttribute('data-saved-code', encodeURIComponent(code));
                }
                
                const tagsContainer = cell.querySelector('.cell-tags');
                if (tagsContainer) {
                    const rawTags = Array.from(tagsContainer.querySelectorAll('.cell-tag')).map(t => t.textContent.trim());
                    if (rawTags.length > 0) {
                        cell.dataset.tags = JSON.stringify(rawTags);
                        tagsContainer.classList.add('has-tags');
                    } else {
                        cell.removeAttribute('data-tags');
                        tagsContainer.classList.remove('has-tags');
                    }
                }
            });

            const paneClone = pane.cloneNode(true);
            paneClone.querySelectorAll('.cell-monaco-container, .sp-monaco-container').forEach(container => {
                container.innerHTML = ''; 
            });
            // The pane also holds the shared .editor-breadcrumb div that
            // createNewTab injects as a sibling ahead of a tab's actual
            // content (same shared structure every non-Monaco/document/
            // workspace tab type gets) - it isn't part of the notebook's own
            // markup, and saving it here means next time this file opens,
            // createNewTab injects a FRESH breadcrumb div and this stale one
            // (now baked into file.content) renders again too, nested inside
            // the notebook body. Each open/save cycle bakes in one more,
            // which is why the breadcrumb count creeps up on every reload.
            // Removed at every nesting level, not just the outermost, so a
            // notebook that already accumulated stale breadcrumbs from
            // before this fix self-heals on its next save too.
            paneClone.querySelectorAll('.editor-breadcrumb').forEach(el => el.remove());

            const fileId = tabEl.dataset.fileId; 
            window.autoSaveFile(fileId, paneClone.innerHTML, tabEl); 
        }
    }
}

function clearAllOutputs(pane) {
    pane.querySelectorAll('.cell').forEach(cell => {
        const outputWrapper = cell.querySelector('.cell-output-wrapper'); const prompt = cell.querySelector('.cell-prompt');
        if (outputWrapper) outputWrapper.innerHTML = ''; if (prompt) prompt.innerHTML = 'In [ ]:';
        
        if (cell.classList.contains('markdown-mode-active')) {
            cell.classList.remove('markdown-mode-active');
        }
    }); triggerNotebookSave(pane);
}

// --- Notebook Event Listeners ---
document.addEventListener('dblclick', (e) => {
    const mdView = e.target.closest('.custom-markdown-view');
    if (mdView) {
        const cell = mdView.closest('.cell');
        if (cell) {
            cell.classList.remove('markdown-mode-active');
            mdView.remove();
            triggerNotebookSave(cell.closest('.content-pane'));
            
            if (window.cellMonacoEditors && window.cellMonacoEditors[cell.dataset.cellId]) {
                window.cellMonacoEditors[cell.dataset.cellId].focus();
            }
        }
    }
});

document.addEventListener('click', async (e) => {
    if (e.target.closest('.sql-table-btn')) return;

    if (e.target.closest('.plot-dl-btn')) {
        const btn = e.target.closest('.plot-dl-btn');
        const img = btn.closest('.plot-card').querySelector('img');
        if(img) {
            const a = document.createElement('a');
            a.href = img.src;
            a.download = `plot_${Date.now()}.png`;
            a.click();
        }
        return;
    }
    
    if (e.target.closest('.plot-max-btn')) {
        const btn = e.target.closest('.plot-max-btn');
        const img = btn.closest('.plot-card').querySelector('img');
        if (img && window.openPlotPreview) window.openPlotPreview(img.src, btn.closest('.cell'));
        return;
    }

    // Toggle responsive dropdowns
    if (e.target.closest('.responsive-ct-more')) {
        const drop = e.target.closest('.ct-left').querySelector('.ct-responsive-dropdown');
        if (drop) {
            document.querySelectorAll('.ct-responsive-dropdown.show, .responsive-dropdown.show').forEach(d => {
                if (d !== drop) d.classList.remove('show');
            });
            drop.classList.toggle('show');
        }
        return;
    }
    
    if (e.target.closest('.responsive-more-btn')) {
        const drop = e.target.closest('.responsive-more-container').querySelector('.responsive-dropdown');
        if (drop) {
            document.querySelectorAll('.ct-responsive-dropdown.show, .responsive-dropdown.show').forEach(d => {
                if (d !== drop) d.classList.remove('show');
            });
            drop.classList.toggle('show');
        }
        return;
    }

    // Auto-close responsive dropdowns if clicking outside
    if (!e.target.closest('.ct-left') && !e.target.closest('.responsive-more-container')) {
        document.querySelectorAll('.ct-responsive-dropdown.show, .responsive-dropdown.show').forEach(d => d.classList.remove('show'));
    }

    if (e.target.closest('.tb-add-tag')) {
        const cell = e.target.closest('.cell');
        let tagsContainer = cell.querySelector('.cell-tags');
        if (!tagsContainer) {
            tagsContainer = document.createElement('div');
            tagsContainer.className = 'cell-tags';
            cell.querySelector('.cell-input').insertBefore(tagsContainer, cell.querySelector('.cell-toolbar'));
        }
        
        if (window.showCustomModal) {
            window.showCustomModal({
                title: 'Add Tag',
                inputType: 'text',
                placeholder: 'Enter tag name...',
                submitText: 'Add'
            }, (tag) => {
                if (tag && tag.trim()) {
                    const span = document.createElement('span');
                    span.className = 'cell-tag';
                    span.innerHTML = `${tag.trim().replace(/</g, '&lt;')} <i class="ri-close-line remove-tag"></i>`;
                    tagsContainer.appendChild(span);
                    tagsContainer.classList.add('has-tags');
                    triggerNotebookSave(cell.closest('.content-pane'));
                }
                if (typeof closeGenModal === 'function') closeGenModal();
            });
        }
        return;
    }
    
    if (e.target.closest('.remove-tag')) {
        const pane = e.target.closest('.content-pane');
        const tagEl = e.target.closest('.cell-tag');
        const tagsContainer = tagEl.closest('.cell-tags');
        tagEl.remove();
        if (tagsContainer && tagsContainer.children.length === 0) {
            tagsContainer.classList.remove('has-tags');
        }
        if (pane) triggerNotebookSave(pane);
        return;
    }

    const createNewCellAt = (pane, referenceCell, position) => {
        const cellsContainer = pane.querySelector('.cells-container');
        const newCell = document.createElement('div');
        const newCellId = 'cell-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        newCell.className = 'cell'; newCell.dataset.cellType = 'code'; newCell.dataset.cellId = newCellId;
        newCell.innerHTML = `<div class="active-indicator"></div><div class="cell-content-wrapper"><div class="cell-input"><div class="cell-tags"></div>${CELL_TOOLBAR_HTML}<div class="cell-prompt" style="font-weight: 600;">In [ ]:</div><div class="cell-monaco-container" style="min-height: 55px; width: 100%;"></div></div><div class="cell-output-wrapper"></div></div>`;
        
        if (position === 'before') {
            cellsContainer.insertBefore(newCell, referenceCell);
        } else {
            cellsContainer.insertBefore(newCell, referenceCell.nextSibling);
        }
        
        pane.querySelectorAll('.cell').forEach(c => c.classList.remove('active'));
        newCell.classList.add('active');
        
        const typeDropdown = pane.querySelector('.tb-cell-type');
        if (typeDropdown) typeDropdown.textContent = 'Code';
        
        if (window.monaco) {
            const monacoContainer = newCell.querySelector('.cell-monaco-container');
            const editor = window.initCellMonacoEditor(monacoContainer, '', 'code', newCellId);
            if (editor) {
                editor.onDidChangeModelContent(() => {
                    const pane = newCell.closest('.content-pane');
                    if (!pane) return;
                    const group = pane.closest('.editor-group');
                    if (!group) return;
                    const tabEl = group.querySelector(`.tab[data-target="${pane.id}"]`);
                    if (tabEl) tabEl.classList.add('unsaved-blink');
                    if (window.appSettings && window.appSettings.autoSave === 'After Delay') {
                        clearTimeout(newCell._saveTimeout);
                        newCell._saveTimeout = setTimeout(() => {
                            triggerNotebookSave(pane);
                        }, window.appSettings.autoSaveDelay || 1000);
                    }
                });
                setTimeout(() => editor.focus(), 50);
            }
        }
        triggerNotebookSave(pane);
        setTimeout(() => window.generateTOC(pane), 300);
    };

    if (e.target.closest('.tb-cell-before')) {
        const cell = e.target.closest('.cell');
        const pane = cell.closest('.content-pane');
        if (cell && pane) createNewCellAt(pane, cell, 'before');
        return;
    }

    if (e.target.closest('.tb-cell-after')) {
        const cell = e.target.closest('.cell');
        const pane = cell.closest('.content-pane');
        if (cell && pane) createNewCellAt(pane, cell, 'after');
        return;
    }

    if (e.target.closest('.tb-copy-to-pad')) {
        const cell = e.target.closest('.cell');
        const pane = cell.closest('.content-pane');
        if (cell && pane) {
            const code = getCellCodeFromEditor(cell);
            if (pane._spEditor) {
                pane._spEditor.setValue(code);
                const spPanel = pane.querySelector('#scratchpadPanel');
                if (spPanel && !spPanel.classList.contains('show')) {
                    pane.querySelector('.tb-scratchpad').click(); 
                }
            }
        }
        return;
    }

    if (e.target.closest('.output-copy-btn')) {
        const btn = e.target.closest('.output-copy-btn');
        const outputDiv = btn.closest('.cell-output-wrapper').querySelector('.cell-output');
        if (outputDiv) {
            navigator.clipboard.writeText(outputDiv.innerText).then(() => {
                const origClass = btn.className;
                btn.className = 'ri-check-line output-copy-btn';
                btn.style.color = 'var(--term-green)';
                setTimeout(() => { btn.className = origClass; btn.style.color = ''; }, 1500);
            });
        }
        return;
    }
    
    if (e.target.closest('.output-collapse-btn')) {
        const btn = e.target.closest('.output-collapse-btn');
        const outputDiv = btn.closest('.cell-output-wrapper').querySelector('.cell-output');
        if (outputDiv) {
            outputDiv.classList.toggle('collapsed');
            if (outputDiv.classList.contains('collapsed')) {
                btn.classList.replace('ri-arrow-up-s-line', 'ri-arrow-down-s-line');
            } else {
                btn.classList.replace('ri-arrow-down-s-line', 'ri-arrow-up-s-line');
            }
        }
        return;
    }

    if (e.target.closest('.tb-export-menu')) {
        e.stopPropagation();
        const exportDrop = e.target.nextElementSibling;
        if (exportDrop) exportDrop.classList.toggle('show');
        return;
    }

    if (e.target.closest('.tb-export-json')) {
        const pane = e.target.closest('.content-pane');
        const blob = new Blob([exportNotebook(pane)], { type: 'application/json' }); 
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'notebook.ipynb'; a.click(); URL.revokeObjectURL(url);
        e.target.closest('.explorer-dropdown').classList.remove('show');
        return;
    }

    if (e.target.closest('.tb-export-html')) {
        const pane = e.target.closest('.content-pane');
        const fullHtml = window.generateCleanNotebookHTML(pane);
        const blob = new Blob([fullHtml], { type: 'text/html' }); 
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'notebook.html'; a.click(); URL.revokeObjectURL(url);
        e.target.closest('.explorer-dropdown').classList.remove('show');
        return;
    }

    if (e.target.closest('.tb-export-pdf')) {
        const pane = e.target.closest('.content-pane');
        const fullHtml = window.generateCleanNotebookHTML(pane);
        
        const printWin = window.open('', '_blank');
        printWin.document.write(fullHtml);
        printWin.document.close();
        printWin.focus();
        
        setTimeout(() => {
            printWin.print();
            printWin.close();
        }, 500);

        e.target.closest('.explorer-dropdown').classList.remove('show');
        return;
    }

    if (e.target.closest('.tb-scratchpad')) {
        const pane = e.target.closest('.content-pane');
        if (pane) {
            const spPanel = pane.querySelector('#scratchpadPanel');
            const tocPanel = pane.querySelector('#tocPanel');
            const varsPanel = pane.querySelector('.vars-explorer-panel');
            if (spPanel) {
                if (tocPanel) tocPanel.classList.remove('show');
                if (varsPanel) varsPanel.classList.remove('show');
                spPanel.classList.toggle('show');
                if (spPanel.classList.contains('show') && pane._spEditor) {
                    setTimeout(() => pane._spEditor.layout(), 100);
                }
            }
        }
        return;
    }

    if (e.target.closest('.sp-copy-to-cell')) {
        const pane = e.target.closest('.content-pane');
        if (pane && pane._spEditor) {
            const padCode = pane._spEditor.getValue();
            const activeCell = pane.querySelector('.cell.active');
            if (!activeCell) {
                if (window.showCustomModal) {
                    window.showCustomModal({ title: 'Notice', text: 'No active cell selected to copy into.', submitText: 'OK' }, () => {
                        if (typeof closeGenModal === 'function') closeGenModal();
                    });
                }
                return;
            }
            const cellCode = getCellCodeFromEditor(activeCell);
            const writeToCell = () => {
                setCellCodeInEditor(activeCell, padCode);
                triggerNotebookSave(pane);
            };

            if (cellCode && cellCode.trim().length > 0) {
                if (window.showCustomModal) {
                    window.showCustomModal({ title: 'Replace Cell Content?', text: 'The active cell already contains code. Do you want to replace it?', submitText: 'Replace' }, () => {
                        writeToCell();
                        if (typeof closeGenModal === 'function') closeGenModal();
                    });
                }
            } else {
                writeToCell();
            }
        }
        return;
    }
    
    if (e.target.closest('.sp-copy-output')) {
        const btn = e.target.closest('.sp-copy-output');
        const outContainer = btn.closest('.sp-output-container').querySelector('.sp-output');
        if (outContainer && !outContainer.classList.contains('empty')) {
            navigator.clipboard.writeText(outContainer.innerText).then(() => {
                const origClass = btn.className;
                btn.className = 'ri-check-line sp-copy-output';
                btn.style.color = 'var(--term-green)';
                setTimeout(() => { btn.className = origClass; btn.style.color = ''; }, 1500);
            });
        }
        return;
    }

    if (e.target.closest('.scratchpad-close')) {
        const panel = e.target.closest('#scratchpadPanel');
        if (panel) panel.classList.remove('show');
        return;
    }

    if (e.target.closest('.sp-toggle-output')) {
        const pane = e.target.closest('.content-pane');
        const outContainer = pane.querySelector('.sp-output-container');
        if (outContainer) {
            outContainer.classList.remove('split-mode');
            outContainer.classList.toggle('overlay-mode');
        }
        return;
    }

    if (e.target.closest('.sp-split')) {
        const pane = e.target.closest('.content-pane');
        const outContainer = pane.querySelector('.sp-output-container');
        if (outContainer) {
            outContainer.classList.remove('overlay-mode');
            outContainer.classList.toggle('split-mode');
            if (pane._spEditor) setTimeout(() => pane._spEditor.layout(), 50);
        }
        return;
    }

    if (e.target.closest('.sp-close-output')) {
        const pane = e.target.closest('.content-pane');
        const outContainer = pane.querySelector('.sp-output-container');
        if (outContainer) {
            outContainer.classList.remove('overlay-mode', 'split-mode');
            if (pane._spEditor) setTimeout(() => pane._spEditor.layout(), 50);
        }
        return;
    }

    if (e.target.closest('.sp-clear')) {
        const pane = e.target.closest('.content-pane');
        const editor = pane ? pane._spEditor : null;
        const out = pane ? pane.querySelector('.sp-output') : null;
        if (editor) editor.setValue('');
        if (out) {
            out.classList.add('empty');
            out.innerHTML = '<span style="color:var(--text-muted); font-style:italic;">Scratchpad output will appear here...</span>';
        }
        return;
    }
    
    // ===============================================
    // COMPLETELY REBUILT SCRATCHPAD RUN LOGIC
    // ===============================================
    if (e.target.closest('.sp-run')) {
        const pane = e.target.closest('.content-pane');
        const editor = pane ? pane._spEditor : null;
        const outContainer = pane ? pane.querySelector('.sp-output-container') : null;
        const out = pane ? pane.querySelector('.sp-output') : null;
        if (!editor || !out || !outContainer) return;
        
        if (!outContainer.classList.contains('split-mode') && !outContainer.classList.contains('overlay-mode')) {
            outContainer.classList.add('overlay-mode');
        }

        const code = editor.getValue();
        out.classList.remove('empty');
        out.innerHTML = '<span style="color:var(--accent-blue);">Executing Scratchpad...</span>';
        
        const kernelStatus = pane.querySelector('.kernel-status');
        const kernelType = kernelStatus ? kernelStatus.dataset.kernel : 'python';
        
        try {
            if (kernelType === 'python') {
                const py = await window.getPyodideInstance();
                
                if (window.appSettings && window.appSettings.nbAutoInstall !== false) {
                    try { await py.loadPackagesFromImports(code); } catch (err) {}
                }
                
                // Pass code securely via globals to avoid string interpolation breaks
                py.globals.set('_scratchpad_raw_code', code);
                
                // Unified execution wrapper: Captures stdout, stderr, plots, and returns JSON safely
                const wrapperScript = `
import sys, io, base64, json, ast, traceback

_out = io.StringIO()
_err = io.StringIO()
sys.stdout = _out
sys.stderr = _err

_plots = []
_eval_res = ""

try:
    import matplotlib
    matplotlib.use('agg')
    import matplotlib.pyplot as plt
    # Intercept plt.show() so the user doesn't accidentally wipe the figure before capture
    plt.show = lambda *args, **kwargs: None
except ImportError:
    pass

try:
    # AST parsing to safely evaluate the last expression for output
    _parsed = ast.parse(_scratchpad_raw_code)
    if _parsed.body and isinstance(_parsed.body[-1], ast.Expr):
        _last_expr = _parsed.body.pop()
        if _parsed.body:
            exec(compile(_parsed, filename="<scratchpad>", mode="exec"), globals())
        _res_obj = eval(compile(ast.Expression(_last_expr.value), filename="<scratchpad>", mode="eval"), globals())
        if _res_obj is not None:
            _eval_res = str(_res_obj)
    else:
        exec(_scratchpad_raw_code, globals())
except Exception as e:
    traceback.print_exc(file=sys.stderr)

# Securely capture all active figures
try:
    import matplotlib.pyplot as plt
    for _n in plt.get_fignums():
        _fig = plt.figure(_n)
        _buf = io.BytesIO()
        _fig.savefig(_buf, format='png', bbox_inches='tight', dpi=100)
        _plots.append(base64.b64encode(_buf.getvalue()).decode('utf-8'))
    plt.close('all')
except Exception:
    pass

# Restore standard streams
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__

json.dumps({
    "stdout": _out.getvalue(),
    "stderr": _err.getvalue(),
    "plots": _plots,
    "result": _eval_res
})
`;
                const resultJson = await py.runPythonAsync(wrapperScript);
                const payload = JSON.parse(resultJson);
                
                out.innerHTML = '';
                
                if (payload.stdout) {
                    const span = document.createElement('span');
                    span.textContent = payload.stdout;
                    out.appendChild(span);
                }
                if (payload.stderr) {
                    const span = document.createElement('span');
                    span.style.color = 'var(--color-danger)';
                    span.textContent = payload.stderr;
                    out.appendChild(span);
                }
                
                if (payload.plots && payload.plots.length > 0) {
                    payload.plots.forEach(b64 => {
                        const imgWrapper = document.createElement('div');
                        imgWrapper.innerHTML = `<br><img src="data:image/png;base64,${b64}" style="max-width:100%; border:1px solid var(--border-color); border-radius:1px; margin-top:8px; background:var(--bg-white); display:block;">`;
                        out.appendChild(imgWrapper);
                    });
                }
                
                if (payload.result && !payload.result.startsWith('<matplotlib.')) {
                    const span = document.createElement('span');
                    span.textContent = payload.result + '\n';
                    out.appendChild(span);
                }

            } else if (kernelType === 'sql') {
                const db = await window.getSqlInstance();
                try {
                    const res = db.exec(code);
                    out.innerHTML = '<span style="color:var(--term-green);">Success</span><br>';
                    if (res.length > 0) {
                        res.forEach(resultset => {
                            let tableHtml = `<div class="sql-table-responsive" style="margin-top: 10px; max-width: 100%; overflow: auto;"><table style="width:100%; border-collapse:collapse; font-size:12px; color:var(--text-main);"><thead><tr style="background:var(--bg-tabs-bar);">`;
                            resultset.columns.forEach(col => { tableHtml += `<th style="padding:4px 8px; border:1px solid var(--border-color);">${col.replace(/</g, '&lt;')}</th>`; });
                            tableHtml += '</tr></thead><tbody>';
                            resultset.values.forEach(row => {
                                tableHtml += '<tr>';
                                row.forEach(val => {
                                    const displayVal = val === null ? '<em style="color:var(--text-muted);">NULL</em>' : String(val).replace(/</g, '&lt;');
                                    tableHtml += `<td style="padding:4px 8px; border:1px solid var(--border-color);">${displayVal}</td>`;
                                });
                                tableHtml += '</tr>';
                            });
                            tableHtml += '</tbody></table></div>';
                            out.innerHTML += tableHtml;
                        });
                    } else {
                        out.innerHTML += '<span style="color:var(--text-muted);">(No result set)</span>';
                    }
                } catch(err) {
                    out.innerHTML = `<span style="color:var(--color-danger);">${err.message.replace(/</g, '&lt;')}</span>`;
                }
            } else if (kernelType === 'r') {
                const webr = await window.getWebRInstance();
                let shelter = await new webr.Shelter();
                try {
                    // Set up R's internal plot device safely before execution
                    await webr.evalRVoid(`
                        options(device = function(...) {
                            png(file="/tmp/webr_sp_plot_%03d.png", width=800, height=600, res=100, ...)
                        })
                        tryCatch({
                            old_files <- list.files("/tmp", pattern="^webr_sp_plot_.*\\\\.png$", full.names=TRUE)
                            file.remove(old_files)
                        }, error = function(e) {})
                    `);
                    
                    const capture = await shelter.captureR(code, { withAutoprint: true, captureStreams: true, captureConditions: false });
                    
                    out.innerHTML = ''; 
                    
                    capture.output.forEach(o => {
                        const span = document.createElement('span');
                        span.textContent = o.data + '\n';
                        if (o.type === 'stderr') span.style.color = 'var(--color-danger)';
                        out.appendChild(span);
                    });
                } catch (err) {
                    out.innerHTML = `<span style="color:var(--color-danger);">${err.message}</span>`;
                } finally {
                    shelter.purge();
                    
                    // Safely close the plotting device to flush buffers
                    await webr.evalRVoid(`tryCatch(dev.off(), error=function(e) NULL)`);
                    
                    try {
                        const files = await webr.FS.readdir('/tmp/');
                        for (let f of files) {
                            if (f.startsWith('webr_sp_plot_') && f.endsWith('.png')) {
                                const fileData = await webr.FS.readFile('/tmp/' + f);
                                let binary = '';
                                const bytes = new Uint8Array(fileData);
                                for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
                                const b64 = btoa(binary);
                                
                                const imgWrapper = document.createElement('div');
                                imgWrapper.innerHTML = `<br><img src="data:image/png;base64,${b64}" style="max-width:100%; border:1px solid var(--border-color); border-radius:1px; margin-top:8px; background:var(--bg-white); display:block;">`;
                                out.appendChild(imgWrapper);
                                
                                await webr.FS.unlink('/tmp/' + f);
                            }
                        }
                    } catch(e) { console.error("Scratchpad R Plot Error:", e); }
                }
            } else {
                out.innerHTML = `<span style="color:var(--icon-yellow);">Scratchpad execution for ${kernelType} is currently limited.</span>`;
            }
        } catch(err) {
            out.innerHTML = `<span style="color:var(--color-danger);">${err.message.replace(/</g, '&lt;')}</span>`;
        }
        return;
    }


    if (e.target.closest('.tb-toc')) {
        const pane = e.target.closest('.content-pane');
        if (pane) {
            const panel = pane.querySelector('#tocPanel');
            const varsPanel = pane.querySelector('.vars-explorer-panel');
            const spPanel = pane.querySelector('#scratchpadPanel');
            if (panel) {
                if (varsPanel) varsPanel.classList.remove('show');
                if (spPanel) spPanel.classList.remove('show');
                panel.classList.toggle('show');
                if (panel.classList.contains('show')) window.generateTOC(pane);
            }
            const drop = pane.querySelector('.responsive-dropdown');
            if (drop) drop.classList.remove('show');
        }
    }

    if (e.target.closest('.toc-close')) {
        const panel = e.target.closest('#tocPanel');
        if (panel) panel.classList.remove('show');
    }

    if (e.target.closest('.tb-vars')) {
        const pane = e.target.closest('.content-pane');
        if (pane) {
            const panel = pane.querySelector('.vars-explorer-panel');
            const tocPanel = pane.querySelector('#tocPanel');
            const spPanel = pane.querySelector('#scratchpadPanel');
            if (panel) {
                if (tocPanel) tocPanel.classList.remove('show');
                if (spPanel) spPanel.classList.remove('show');
                panel.classList.toggle('show');
                if (panel.classList.contains('show')) window.updateVariablesExplorer(pane);
            }
            const drop = pane.querySelector('.responsive-dropdown');
            if (drop) drop.classList.remove('show');
        }
    }

    if (e.target.closest('.vars-close')) {
        const panel = e.target.closest('.vars-explorer-panel');
        if (panel) panel.classList.remove('show');
    }

    if (e.target.closest('.vars-refresh')) {
        const pane = e.target.closest('.content-pane');
        if (pane) window.updateVariablesExplorer(pane);
    }

    const pane = e.target.closest('.content-pane'); if (!pane) return;
    const clickedCell = e.target.closest('.cell');
    
    if (clickedCell && pane) { 
        pane.querySelectorAll('.cell').forEach(c => c.classList.remove('active')); 
        clickedCell.classList.add('active'); 
        
        const typeDropdown = pane.querySelector('.tb-cell-type');
        if (typeDropdown) {
            const cellType = clickedCell.dataset.cellType || 'code';
            typeDropdown.textContent = cellType.charAt(0).toUpperCase() + cellType.slice(1);
        }
        
        const tocPanel = pane.querySelector('#tocPanel');
        if (tocPanel && tocPanel.classList.contains('show')) {
            const tocContent = tocPanel.querySelector('#tocContent');
            if (tocContent) {
                tocContent.querySelectorAll('.toc-item').forEach(i => i.classList.remove('active'));
                const activeTocItem = tocContent.querySelector(`.toc-item[data-cell-id="${clickedCell.dataset.cellId}"]`);
                if (activeTocItem) activeTocItem.classList.add('active');
            }
        }
    }

    if (e.target.classList.contains('add-cell') && pane) {
        const cellsContainer = pane.querySelector('.cells-container'); const newCell = document.createElement('div'); const newCellId = 'cell-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        newCell.className = 'cell'; newCell.dataset.cellType = 'code'; newCell.dataset.cellId = newCellId;
        newCell.innerHTML = `<div class="active-indicator"></div><div class="cell-content-wrapper"><div class="cell-input"><div class="cell-tags"></div>${CELL_TOOLBAR_HTML}<div class="cell-prompt" style="font-weight: 600;">In [ ]:</div><div class="cell-monaco-container" style="min-height: 55px; width: 100%;"></div></div><div class="cell-output-wrapper"></div></div>`;
        cellsContainer.insertBefore(newCell, e.target); pane.querySelectorAll('.cell').forEach(c => c.classList.remove('active'));
        newCell.classList.add('active');
        
        const typeDropdown = pane.querySelector('.tb-cell-type');
        if (typeDropdown) typeDropdown.textContent = 'Code';
        
        if (window.monaco) {
            const monacoContainer = newCell.querySelector('.cell-monaco-container');
            const editor = window.initCellMonacoEditor(monacoContainer, '', 'code', newCellId);
            if (editor) {
                editor.onDidChangeModelContent(() => {
                    const pane = newCell.closest('.content-pane');
                    if (!pane) return;
                    const group = pane.closest('.editor-group');
                    if (!group) return;
                    const tabEl = group.querySelector(`.tab[data-target="${pane.id}"]`);
                    if (tabEl) {
                        tabEl.classList.add('unsaved-blink');
                    }
                    if (window.appSettings && window.appSettings.autoSave === 'After Delay') {
                        clearTimeout(newCell._saveTimeout);
                        newCell._saveTimeout = setTimeout(() => {
                            triggerNotebookSave(pane);
                        }, window.appSettings.autoSaveDelay || 1000);
                    }
                });
                setTimeout(() => editor.focus(), 50);
            }
        }
        
        triggerNotebookSave(pane);
        setTimeout(() => window.generateTOC(pane), 300);
    }

    const activeCell = pane.querySelector('.cell.active');
    
    if (e.target.closest('.tb-run')) if (activeCell) await runCell(activeCell, pane);
    if (e.target.closest('.tb-move-up')) { if (activeCell && activeCell.previousElementSibling && activeCell.previousElementSibling.classList.contains('cell')) { activeCell.parentNode.insertBefore(activeCell, activeCell.previousElementSibling); triggerNotebookSave(pane); setTimeout(() => window.generateTOC(pane), 300); } }
    if (e.target.closest('.tb-move-down')) { if (activeCell && activeCell.nextElementSibling && activeCell.nextElementSibling.classList.contains('cell')) { activeCell.parentNode.insertBefore(activeCell.nextElementSibling, activeCell); triggerNotebookSave(pane); setTimeout(() => window.generateTOC(pane), 300); } }
    
    if (e.target.closest('.tb-cut-cell')) if (activeCell) { 
        const code = getCellCodeFromEditor(activeCell);
        window.cellClipboardRegistry[_getNbUiWinId()] = { type: activeCell.dataset.cellType || 'code', code: code };
        if (window.cellMonacoEditors && window.cellMonacoEditors[activeCell.dataset.cellId]) {
            window.cellMonacoEditors[activeCell.dataset.cellId].dispose();
            delete window.cellMonacoEditors[activeCell.dataset.cellId];
        }
        activeCell.remove(); 
        triggerNotebookSave(pane); 
        setTimeout(() => window.generateTOC(pane), 300);
    }
    
    if (e.target.closest('.tb-copy-cell')) if (activeCell) {
        const code = getCellCodeFromEditor(activeCell);
        window.cellClipboardRegistry[_getNbUiWinId()] = { type: activeCell.dataset.cellType || 'code', code: code };
    }
    
    if (e.target.closest('.tb-paste-cell')) {
        const clip = window.cellClipboardRegistry[_getNbUiWinId()];
        if (clip && activeCell) {
            const cellsContainer = pane.querySelector('.cells-container');
            const newCell = document.createElement('div');
            const newCellId = 'cell-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
            newCell.className = 'cell'; 
            newCell.dataset.cellType = clip.type || 'code'; 
            newCell.dataset.cellId = newCellId;
            newCell.innerHTML = `<div class="active-indicator"></div><div class="cell-content-wrapper"><div class="cell-input"><div class="cell-tags"></div>${CELL_TOOLBAR_HTML}<div class="cell-prompt" style="font-weight: 600;">${newCell.dataset.cellType === 'code' ? 'In [ ]:' : ''}</div><div class="cell-monaco-container" style="min-height: 55px; width: 100%;"></div></div><div class="cell-output-wrapper"></div></div>`;
            
            activeCell.parentNode.insertBefore(newCell, activeCell.nextSibling);
            
            if (window.monaco) {
                const monacoContainer = newCell.querySelector('.cell-monaco-container');
                window.initCellMonacoEditor(monacoContainer, clip.code || '', newCell.dataset.cellType, newCellId);
                if (newCell.dataset.cellType === 'markdown' || newCell.dataset.cellType === 'raw') {
                    newCell.querySelector('.cell-prompt').style.display = 'none';
                    if (newCell.dataset.cellType === 'markdown') newCell.classList.add('markdown-mode-active');
                    if (newCell.dataset.cellType === 'raw') newCell.classList.add('raw-mode-active');
                }
            }
            
            triggerNotebookSave(pane);
            setTimeout(() => window.generateTOC(pane), 300);
        }
    }

    if (e.target.closest('.tb-delete-cell')) {
        if (activeCell) { 
            const processDelete = () => {
                if (window.cellMonacoEditors && window.cellMonacoEditors[activeCell.dataset.cellId]) {
                    window.cellMonacoEditors[activeCell.dataset.cellId].dispose();
                    delete window.cellMonacoEditors[activeCell.dataset.cellId];
                }
                activeCell.remove(); 
                triggerNotebookSave(pane); 
                setTimeout(() => window.generateTOC(pane), 300);
            };

            if (window.appSettings && window.appSettings.nbConfirmDelete) {
                if (window.showCustomModal) {
                    window.showCustomModal({ 
                        title: 'Delete Cell', 
                        text: 'Are you sure you want to permanently delete this cell?', 
                        submitText: 'Delete' 
                    }, () => {
                        processDelete();
                        if (typeof closeGenModal === 'function') closeGenModal();
                    });
                } else if(confirm("Are you sure you want to delete this cell?")) processDelete();
            } else {
                processDelete();
            }
        }
    }
    
    if (e.target.closest('.tb-interrupt')) {
        window.kernelInterrupted = true; 
        const statusCircle = pane.querySelector('.status-circle'); 
        if (statusCircle) statusCircle.classList.remove('running');
        if (window.setKernelStatus) window.setKernelStatus(pane, '[Interrupted]', true);
        setTimeout(() => { if (window.resetKernelStatus) window.resetKernelStatus(pane); }, 2000); 
    }
    
    if (e.target.closest('.tb-restart')) {
        const doRestart = async () => {
            if (window.appSettings && window.appSettings.nbClearOnRestart) {
                clearAllOutputs(pane);
            }

            const statusCircle = pane.querySelector('.status-circle'); if(statusCircle) statusCircle.classList.add('running');
            const kernelStatus = pane.querySelector('.kernel-status');
            const kernelType = kernelStatus ? kernelStatus.dataset.kernel : 'python';
            
            if (kernelType === 'r') {
                window.webrInstance = null; window.webrLoading = false; window.kernelInterrupted = false;
                window.setKernelStatus(pane, 'Restarting kernel...');
                await window.getWebRInstance();
                window.setKernelStatus(pane, 'Kernel restarted');
                setTimeout(() => window.resetKernelStatus(pane), 2000);
            } else if (kernelType === 'sql') {
                window.sqlInstance = null; window.sqlDb = null; window.sqlLoading = false; window.kernelInterrupted = false;
                window.setKernelStatus(pane, 'Restarting kernel...');
                await window.getSqlInstance();
                window.setKernelStatus(pane, 'Kernel restarted');
                setTimeout(() => window.resetKernelStatus(pane), 2000);
            } else {
                window.pyodideInstance = null; window.pyodideLoading = false; window.kernelInterrupted = false;
                window.setKernelStatus(pane, 'Restarting kernel...');
                await window.getPyodideInstance();
                window.setKernelStatus(pane, 'Kernel restarted');
                setTimeout(() => window.resetKernelStatus(pane), 2000);
            }
            if(statusCircle) statusCircle.classList.remove('running');
        };
        doRestart();
    }
    
    if (e.target.closest('.tb-run-all')) {
        const kernelStatus = pane.querySelector('.kernel-status');
        const kernelType = kernelStatus ? kernelStatus.dataset.kernel : 'python';
        
        if (kernelType === 'r') {
            window.webrInstance = null; window.webrLoading = false; window.kernelInterrupted = false; await window.getWebRInstance();
        } else if (kernelType === 'sql') {
            window.sqlInstance = null; window.sqlDb = null; window.sqlLoading = false; window.kernelInterrupted = false; await window.getSqlInstance();
        } else {
            window.pyodideInstance = null; window.pyodideLoading = false; window.kernelInterrupted = false; await window.getPyodideInstance();
        }
        
        const allCells = pane.querySelectorAll('.cell');
        for (let i = 0; i < allCells.length; i++) {
            if (window.kernelInterrupted) break; pane.querySelectorAll('.cell').forEach(cl => cl.classList.remove('active')); allCells[i].classList.add('active'); await runCell(allCells[i], pane);
        }
        return;
    }

    if (e.target.closest('.tb-run-all-no-restart')) {
        const allCells = pane.querySelectorAll('.cell');
        for (let i = 0; i < allCells.length; i++) {
            if (window.kernelInterrupted) break; 
            pane.querySelectorAll('.cell').forEach(cl => cl.classList.remove('active')); 
            allCells[i].classList.add('active'); 
            await runCell(allCells[i], pane);
        }
        return;
    }

    if (e.target.closest('.tb-run-tagged')) {
        const allCells = pane.querySelectorAll('.cell');
        for (let i = 0; i < allCells.length; i++) {
            if (window.kernelInterrupted) break;
            const cell = allCells[i];
            const tags = cell.dataset.tags ? JSON.parse(cell.dataset.tags) : [];
            if (tags.length > 0) {
                pane.querySelectorAll('.cell').forEach(cl => cl.classList.remove('active')); 
                cell.classList.add('active'); 
                await runCell(cell, pane);
            }
        }
        return;
    }
    
    if (e.target.closest('.tb-run-untagged')) {
        const allCells = pane.querySelectorAll('.cell');
        for (let i = 0; i < allCells.length; i++) {
            if (window.kernelInterrupted) break;
            const cell = allCells[i];
            const tags = cell.dataset.tags ? JSON.parse(cell.dataset.tags) : [];
            if (tags.length === 0) {
                pane.querySelectorAll('.cell').forEach(cl => cl.classList.remove('active')); 
                cell.classList.add('active'); 
                await runCell(cell, pane);
            }
        }
        return;
    }
    
    if (e.target.closest('.tb-format')) {
        if (activeCell) {
            const cellType = activeCell.dataset.cellType || 'code';
            if (cellType === 'markdown' || cellType === 'raw') return;

            const kernelStatus = pane.querySelector('.kernel-status');
            const kernelType = kernelStatus ? kernelStatus.dataset.kernel : 'python';
            const code = getCellCodeFromEditor(activeCell);
            
            const formatAndUpdate = (formatted) => {
                setCellCodeInEditor(activeCell, formatted);
                triggerNotebookSave(pane);
            };

            if (kernelType === 'python') {
                const statusCircle = pane.querySelector('.status-circle');
                if (statusCircle) statusCircle.classList.add('running');
                
                window.getPyodideInstance().then(py => {
                    if (py) {
                        try {
                            py.globals.set('_fmt_code', code);
                            const fmtCode = py.runPython(`
import ast
try:
    ast.unparse(ast.parse(_fmt_code))
except Exception:
    _fmt_code
                            `);
                            formatAndUpdate(fmtCode);
                        } catch(err) {
                            formatAndUpdate(formatPythonCode(code)); 
                        }
                    } else {
                        formatAndUpdate(formatPythonCode(code));
                    }
                    if (statusCircle) statusCircle.classList.remove('running');
                });
            } else {
                const editor = window.cellMonacoEditors && window.cellMonacoEditors[activeCell.dataset.cellId];
                if (editor) {
                    editor.getAction('editor.action.formatDocument').run().then(() => {
                        triggerNotebookSave(pane);
                    }).catch(() => {
                        formatAndUpdate(formatJavaScriptCode(code));
                    });
                } else {
                    formatAndUpdate(formatJavaScriptCode(code));
                }
            }
        }
    }
    
    if (e.target.closest('.tb-properties')) {
        if (activeCell) {
            const cellType = activeCell.dataset.cellType || 'code'; 
            const code = getCellCodeFromEditor(activeCell);
            const lineCount = code ? code.split('\n').length : 0;
            const charCount = code ? code.length : 0;
            const outputWrapper = activeCell.querySelector('.cell-output-wrapper');
            const hasOutput = outputWrapper && outputWrapper.innerHTML.trim().length > 0;
            const execTimeEl = outputWrapper ? outputWrapper.querySelector('div[style*="text-align: right"]') : null;
            const lastExecTime = execTimeEl ? execTimeEl.textContent : 'N/A';

            const propsHtml = `
                <table style="width:100%; border-collapse: collapse; font-size: 13px;">
                    <tr>
                        <td style="padding: 8px 0; font-weight: 600;">Cell ID</td>
                        <td style="padding: 8px 0; text-align: right; font-family: monospace;">${activeCell.dataset.cellId}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: 600;">Type</td>
                        <td style="padding: 8px 0; text-align: right; text-transform: capitalize;">${cellType}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: 600;">Lines of Code</td>
                        <td style="padding: 8px 0; text-align: right;">${lineCount}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: 600;">Characters</td>
                        <td style="padding: 8px 0; text-align: right;">${charCount}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: 600;">Output Present</td>
                        <td style="padding: 8px 0; text-align: right;">${hasOutput ? 'Yes' : 'No'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: 600;">Last Execution</td>
                        <td style="padding: 8px 0; text-align: right;">${lastExecTime}</td>
                    </tr>
                </table>
            `;

            if(window.showCustomModal) { 
                window.showCustomModal({ 
                    title: 'Cell Properties', 
                    text: '', 
                    submitText: 'Close' 
                }, () => {}); 
                const textEl = document.getElementById('genModalText');
                if (textEl) {
                    textEl.innerHTML = propsHtml;
                    textEl.style.display = 'block';
                }
            }
        }
    }
    
    if (e.target.closest('.tb-clear-outputs')) clearAllOutputs(pane);
    
    if (e.target.closest('.tb-trust')) {
        e.preventDefault(); 
        const trustLink = e.target.closest('.tb-trust'); 
        const icon = trustLink.querySelector('i'); 
        const span = trustLink.querySelector('span');
        const isCurrentlyTrusted = trustLink.dataset.trusted === 'true';
        
        if (isCurrentlyTrusted) { 
            if(icon) { icon.className = 'ri-shield-flash-line'; icon.style.color = 'var(--color-danger)'; }
            if(span) span.textContent = 'Untrusted'; 
            trustLink.dataset.trusted = 'false';
        } else { 
            if(icon) { icon.className = 'ri-shield-check-line'; icon.style.color = ''; }
            if(span) span.textContent = 'Trusted'; 
            trustLink.dataset.trusted = 'true';
        }
        triggerNotebookSave(pane);
    }
    
    if (e.target.closest('.tb-cell-type')) {
        const dropdown = e.target.closest('.tb-cell-type');
        if (activeCell) {
            let current = activeCell.dataset.cellType || 'code';
            let newType = current === 'code' ? 'markdown' : (current === 'markdown' ? 'raw' : 'code');
            activeCell.dataset.cellType = newType; 
            
            dropdown.innerHTML = newType === 'code' ? 'Code' : (newType === 'markdown' ? 'Markdown' : 'Raw');
            
            const prompt = activeCell.querySelector('.cell-prompt'); 
            if (prompt) prompt.style.display = newType === 'code' ? 'block' : 'none';
            
            activeCell.classList.remove('markdown-mode-active', 'raw-mode-active');
            const mdView = activeCell.querySelector('.custom-markdown-view');
            if (mdView) mdView.remove();

            if (newType === 'markdown') {
                // Keep default visible to allow code edition
            } else if (newType === 'raw') {
                activeCell.classList.add('raw-mode-active');
            }
            
            if (window.cellMonacoEditors && window.cellMonacoEditors[activeCell.dataset.cellId]) {
                const editor = window.cellMonacoEditors[activeCell.dataset.cellId];
                const model = editor.getModel();
                if (model) {
                    window.monaco.editor.setModelLanguage(model, newType === 'markdown' ? 'markdown' : (newType === 'raw' ? 'plaintext' : 'python'));
                }
            }
            triggerNotebookSave(pane);
        }
    }
});

document.addEventListener('keydown', (e) => {
    const pane = document.querySelector('.editor-group.active-group .content-pane.active'); if (!pane) return;
    const activeCell = pane.querySelector('.cell.active');
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (activeCell) runCell(activeCell, pane); }
    if (e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        if (activeCell) {
            runCell(activeCell, pane); const nextCell = activeCell.nextElementSibling;
            if (nextCell && nextCell.classList.contains('cell')) { pane.querySelectorAll('.cell').forEach(c => c.classList.remove('active')); nextCell.classList.add('active'); }
        }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { 
        e.preventDefault(); 
        if (typeof window.performActiveSave === 'function') {
            window.performActiveSave();
        } else {
            triggerNotebookSave(pane);
        }
    }
});

document.addEventListener('input', (e) => {
    if(e.target.classList && e.target.classList.contains('cell-editor')) {
        const pane = e.target.closest('.content-pane'); if (!pane) return;
        const group = pane.closest('.editor-group'); if (!group) return;
        const tabEl = group.querySelector(`.tab[data-target="${pane.id}"]`);
        if(tabEl) {
            tabEl.classList.add('unsaved-blink');
            if (window.appSettings && window.appSettings.autoSave === 'After Delay') {
                clearTimeout(pane.saveTimeout);
                pane.saveTimeout = setTimeout(() => {
                    triggerNotebookSave(pane);
                }, window.appSettings.autoSaveDelay || 1000);
            }
        }
    }
});

const originalOpenFileInTab = window.openFileInTab;
if (typeof originalOpenFileInTab === 'function') {
    window.openFileInTab = function(file) {
        originalOpenFileInTab(file);
        
        const isNotebook = file.name.endsWith('.ipynb') || file.name.endsWith('.irnb') || file.name.endsWith('.sqlnb');
        if (isNotebook) {
            setTimeout(() => {
                const tab = document.querySelector(`.tab[data-file-id="${file.id}"]`);
                if (tab) {
                    const specificPane = document.getElementById(tab.dataset.target);
                    if (specificPane) {
                        window.initNotebookMonacoEditors(specificPane);
                    }
                }
            }, 500);
        }
    };
}

const _nbu_originalSwitchTab = window.switchTab;
if (typeof _nbu_originalSwitchTab === 'function') {
    window.switchTab = function(targetId) {
        _nbu_originalSwitchTab(targetId);
        const pane = document.getElementById(targetId);
        if (pane) {
            if (pane.querySelector('.cells-container') && window.initNotebookMonacoEditors) {
                window.initNotebookMonacoEditors(pane);
            }

            pane.querySelectorAll('.cell-monaco-container').forEach(container => {
                const cell = container.closest('.cell');
                if (cell && cell.dataset.cellId && window.cellMonacoEditors) {
                    const editor = window.cellMonacoEditors[cell.dataset.cellId];
                    if (editor) {
                        editor.layout();
                        const contentHeight = editor.getContentHeight();
                        if (contentHeight > 0) {
                            container.style.height = `${contentHeight}px`;
                            editor.layout();
                        }
                    }
                }
            });
            if (pane._spEditor) {
                pane._spEditor.layout();
            }
        }
    };
}
