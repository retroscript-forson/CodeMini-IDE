// ==========================================
// notebook-kernels.js (Kernel Execution & WebAssembly)
// ==========================================

window._coreEngines = window._coreEngines || {
    pyodide: null,
    micropip: null,
    webr: null,
    sql: null,
    loading: {
        pyodide: false,
        webr: false,
        sql: false
    }
};

// --- Strict Isolation Registry ---
window._activeCellRegistry = window._activeCellRegistry || {};

const kernelRegistry = {
    sqlDbs: {},
    pyNamespaces: {},
    rNamespaces: {},
    php: { instances: {}, lines: {} },
    interrupted: {},
    packages: {}
};

function _getWinId() {
    return typeof cellActiveWinId !== 'undefined' ? cellActiveWinId : (localStorage.getItem('codemini_active_window') || 'win_default');
}

Object.defineProperty(window, 'phpWebInstance', {
    get: () => kernelRegistry.php.instances[_getWinId()] || null,
    set: (v) => { kernelRegistry.php.instances[_getWinId()] = v; }
});
Object.defineProperty(window, '_phpConsoleLines', {
    get: () => kernelRegistry.php.lines[_getWinId()] || [],
    set: (v) => { kernelRegistry.php.lines[_getWinId()] = v; }
});

Object.defineProperty(window, 'kernelInterrupted', {
    get: () => kernelRegistry.interrupted[_getWinId()] || false,
    set: (v) => { kernelRegistry.interrupted[_getWinId()] = v; }
});

Object.defineProperty(window, 'installedPackages', {
    get: () => {
        const wid = _getWinId();
        if (!kernelRegistry.packages[wid]) kernelRegistry.packages[wid] = new Set();
        return kernelRegistry.packages[wid];
    },
    set: (v) => { kernelRegistry.packages[_getWinId()] = v; }
});

Object.defineProperty(window, 'micropip', {
    get: () => window._coreEngines.micropip
});

Object.defineProperty(window, 'sqlDb', {
    get: () => kernelRegistry.sqlDbs[_getWinId()] || null,
    set: (v) => { kernelRegistry.sqlDbs[_getWinId()] = v; }
});

window.cellMonacoEditors = {};

window.getNbAutoInstall = function() {
    if (window.appSettings && window.appSettings.nbAutoInstall !== undefined) {
        return window.appSettings.nbAutoInstall;
    }
    return true; 
}

// --- Centralized Kernel Status Management ---
window.resetKernelStatus = function(pane) {
    if (!pane) return;
    const kernelStatus = pane.querySelector('.kernel-status');
    if (!kernelStatus) return;
    const kType = kernelStatus.dataset.kernel;
    let baseTxt = '<i class="fab fa-python" style="color: var(--icon-py);"></i> Python 3 (Pyodide)';
    if (kType === 'r') baseTxt = '<i class="fab fa-r-project" style="color: #276dc3;"></i> R (WebR)';
    else if (kType === 'sql') baseTxt = '<i class="ri-database-2-line" style="color: #4CAF50;"></i> SQL (SQLite)';
    
    kernelStatus.innerHTML = `${baseTxt} -- Ready`;
    kernelStatus.style.color = '';
};

window.setKernelStatus = function(pane, msg, isError = false) {
    if (!pane) return;
    const kernelStatus = pane.querySelector('.kernel-status');
    if (!kernelStatus) return;
    const kType = kernelStatus.dataset.kernel;
    let baseTxt = '<i class="fab fa-python" style="color: var(--icon-py);"></i> Python 3 (Pyodide)';
    if (kType === 'r') baseTxt = '<i class="fab fa-r-project" style="color: #276dc3;"></i> R (WebR)';
    else if (kType === 'sql') baseTxt = '<i class="ri-database-2-line" style="color: #4CAF50;"></i> SQL (SQLite)';
    
    kernelStatus.innerHTML = `${baseTxt} -- ${msg}`;
    kernelStatus.style.color = isError ? 'var(--color-danger)' : '';
};

window.forceCloseEnvironments = function(winId, isClosing = false) {
    if (kernelRegistry.interrupted) kernelRegistry.interrupted[winId] = true;
    if (window._bpConsoleRunningState) window._bpConsoleRunningState[winId] = false;
    
    // PHP's instance and Ruby's sandbox iframe are only fully torn down when
    // the window is genuinely being deleted (isClosing=true), not on every
    // ordinary switch-away - otherwise variables/state defined in either
    // language would be lost every time you switched to another window and
    // back, even though nothing was actually closed. Mirrors the same
    // survive-a-switch principle already applied to the Python/R namespaces.
    if (isClosing) {
        if (window.phpWebInstances && window.phpWebInstances[winId]) {
            window.phpWebInstances[winId] = null;
        }
        if (window._phpConsoleLines) window._phpConsoleLines[winId] = [];
        if (window.teardownRubySandbox) window.teardownRubySandbox(winId);
    }
    
    // NOTE: window._coreEngines (pyodide/webr/sql) are intentionally SHARED,
    // loaded-once WASM runtimes used by every window/profile - they must NOT
    // be nulled out here. This function tears down only winId's own isolated
    // state within those shared engines. Nulling the engines themselves would
    // force a full multi-megabyte reload for every other window still using
    // them (this was previously happening on every single window switch, not
    // just window close, since switchWindow calls this for the outgoing window).
    
    if (kernelRegistry.pyNamespaces) delete kernelRegistry.pyNamespaces[winId];
    if (kernelRegistry.rNamespaces) {
        if (kernelRegistry.rNamespaces[winId]) {
            try { kernelRegistry.rNamespaces[winId].destroy(); } catch(e) {}
            delete kernelRegistry.rNamespaces[winId];
        }
    }
    if (kernelRegistry.sqlDbs) {
        if (kernelRegistry.sqlDbs[winId]) {
            try { kernelRegistry.sqlDbs[winId].close(); } catch(e) {}
            delete kernelRegistry.sqlDbs[winId];
        }
    }
};

// --- JavaScript Helpers ---
window.inlineInputPrompt = function(promptText) {
    return new Promise((resolve) => {
        const cell = window._activeCellRegistry[_getWinId()];
        if (!cell) { resolve(prompt(promptText) || ""); return; }

        let outputWrapper = cell.querySelector('.cell-output-wrapper');
        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = `
            display: flex; align-items: center; gap: 10px; padding: 8px 15px; 
            background-color: var(--bg-panel); border-top: 1px dashed var(--border-color); 
            border-bottom: 1px solid var(--border-color); font-family: var(--font-mono); 
            font-size: 13px;
        `;

        const label = document.createElement('span');
        label.textContent = promptText;
        label.style.color = 'var(--accent-blue)';

        const inputField = document.createElement('input');
        inputField.type = 'text';
        inputField.style.cssText = `
            flex: 1; background: var(--bg-white); border: 1px solid var(--border-color); 
            color: var(--text-main); padding: 4px 8px; border-radius: 4px; outline: none;
            font-family: var(--font-mono);
        `;

        inputField.addEventListener('focus', () => inputField.style.borderColor = 'var(--accent-blue)');
        inputField.addEventListener('blur', () => inputField.style.borderColor = 'var(--border-color)');

        inputContainer.appendChild(label);
        inputContainer.appendChild(inputField);

        let plotContainer = outputWrapper.querySelector('.plot-container');
        if (plotContainer) {
            outputWrapper.insertBefore(inputContainer, plotContainer);
        } else {
            outputWrapper.appendChild(inputContainer);
        }
        
        inputField.focus();

        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const val = inputField.value;
                inputContainer.innerHTML = `
                    <span style="color: var(--text-muted);">${promptText}</span> 
                    <span style="color: var(--term-green); font-weight: bold;">${val}</span>
                `;
                resolve(val);
            }
        });
    });
};

window.displayHTML = function(htmlContent) {
    const cell = window._activeCellRegistry[_getWinId()];
    if (!cell) return;
    
    const pane = cell.closest('.content-pane');
    const trustLink = pane ? pane.querySelector('.tb-trust') : null;
    const isTrusted = trustLink ? trustLink.dataset.trusted === 'true' : true;

    let finalHtml = htmlContent;
    let wasBlocked = false;

    if (!isTrusted) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

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
        finalHtml = doc.body.innerHTML;
    }

    let outputWrapper = cell.querySelector('.cell-output-wrapper');
    const displayDiv = document.createElement('div');
    displayDiv.className = 'cell-output custom-display';
    displayDiv.style.backgroundColor = 'transparent';
    displayDiv.style.padding = '10px 15px';

    let indicatorHtml = '';
    if (wasBlocked) {
        indicatorHtml = `<div class="blocked-content-indicator" style="color:var(--color-danger); border: 1px dashed var(--color-danger); padding: 5px; border-radius: 4px; font-size:12px; margin-bottom:5px; background: rgba(211, 47, 47, 0.05);"><i class="ri-shield-flash-line"></i> Sanitized Output: Blocked unsafe scripts/events (Untrusted)</div>\n`;
    }

    displayDiv.innerHTML = indicatorHtml + finalHtml;
    
    let plotContainer = outputWrapper.querySelector('.plot-container');
    if (plotContainer) {
        outputWrapper.insertBefore(displayDiv, plotContainer);
    } else {
        outputWrapper.appendChild(displayDiv);
    }
};

function renderMarkdown(text) {
    if (!text) return '';
    let html = text;
    
    html = html.replace(/^### (.+)$/gm, '<h3 style="margin: 10px 0 5px 0; color: var(--text-main); font-size: 16px;">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 style="margin: 12px 0 6px 0; color: var(--text-main); font-size: 18px;">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 style="margin: 15px 0 8px 0; color: var(--text-main); font-size: 22px;">$1</h1>');
    
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*\*/g, '<em>$1</em>');
    
    html = html.replace(/`([^`]+)`/g, '<code class="nb-inline-code" style="background: var(--bg-panel); padding: 2px 6px; border-radius: 3px; font-family: var(--font-mono); font-size: 12px; color: var(--accent-blue);">$1</code>');
    
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function(match, lang, code) {
        return '<pre class="nb-code-block" style="background: var(--bg-panel); padding: 12px; border-radius: 4px; border: 1px solid var(--border-color); overflow-x: auto; font-family: var(--font-mono); font-size: 12px; color: var(--text-main); margin: 10px 0;"><code>' + code.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</code></pre>';
    });
    
    html = html.replace(/^- (.+)$/gm, '<li style="margin-left: 20px; color: var(--text-main);">$1</li>');
    html = html.replace(/(<li.*<\/li>\n?)+/g, '<ul style="margin: 8px 0;">$&</ul>');
    
    html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin-left: 20px; color: var(--text-main);">$1</li>');
    html = html.replace(/^---$/gm, '<hr style="border: none; border-top: 1px solid var(--border-color); margin: 12px 0;">');
    html = html.replace(/^> (.+)$/gm, '<blockquote style="border-left: 3px solid var(--accent-blue); padding: 8px 15px; margin: 10px 0; background: var(--bg-panel); color: var(--text-muted);">$1</blockquote>');
    
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: var(--accent-blue); text-decoration: underline;" target="_blank">$1</a>');
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; border-radius: 4px; margin: 8px 0;">');
    html = html.replace(/^(?!<[houlpibla]|<hr|<\s*$)(.+)$/gm, '<p style="margin: 6px 0; color: var(--text-main); line-height: 1.6;">$1</p>');
    
    return html;
}

window.getSqlInstance = async function() {
    const winId = _getWinId();
    const pane = document.querySelector('.editor-group.active-group .content-pane.active') || document.querySelector('.content-pane.active');
    
    if (!window._coreEngines.sql) {
        if (window._coreEngines.loading.sql) {
            while (!window._coreEngines.sql) {
                await new Promise(r => setTimeout(r, 100));
                if (!window._coreEngines.loading.sql && !window._coreEngines.sql) return null; 
            }
        } else {
            window._coreEngines.loading.sql = true;
            try {
                const statusCircles = document.querySelectorAll('.status-circle');
                statusCircles.forEach(c => c.classList.add('running'));

                const SQL = await window.initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}` });
                window._coreEngines.sql = SQL;
                
                statusCircles.forEach(c => c.classList.remove('running'));
            } catch(e) {
                window._coreEngines.loading.sql = false;
                document.querySelectorAll('.status-circle').forEach(c => c.classList.remove('running'));
                window.setKernelStatus(pane, 'Failed to load. Please refresh.', true);
                console.error("SQL init error:", e);
                return null;
            }
        }
    }
    
    if (!kernelRegistry.sqlDbs[winId]) {
        const SQL = window._coreEngines.sql;
        const db = new SQL.Database();

        db.create_function("POWER", (a, b) => Math.pow(a, b));
        db.create_function("SQRT", a => Math.sqrt(a));
        db.create_function("SIN", a => Math.sin(a));
        db.create_function("COS", a => Math.cos(a));
        db.create_function("TAN", a => Math.tan(a));
        db.create_function("LOG", a => Math.log(a));
        db.create_function("EXP", a => Math.exp(a));
        db.create_function("CEIL", a => Math.ceil(a));
        db.create_function("FLOOR", a => Math.floor(a));
        db.create_function("RANDOM_RANGE", (min, max) => Math.floor(Math.random() * (max - min + 1)) + min);

        kernelRegistry.sqlDbs[winId] = db;
    }
    
    window.resetKernelStatus(pane);
    return kernelRegistry.sqlDbs[winId];
};

window.getPyodideInstance = async function() {
    const winId = _getWinId();
    const pane = document.querySelector('.editor-group.active-group .content-pane.active') || document.querySelector('.content-pane.active');

    if (!window._coreEngines.pyodide) {
        if (window._coreEngines.loading.pyodide) {
            while (!window._coreEngines.pyodide) {
                await new Promise(r => setTimeout(r, 100));
                if (!window._coreEngines.loading.pyodide && !window._coreEngines.pyodide) return null;
            }
        } else {
            window._coreEngines.loading.pyodide = true;
            try {
                if (typeof loadPyodide === 'undefined') throw new Error("Pyodide not loaded. Please check your internet connection and refresh the page.");
                
                const statusCircles = document.querySelectorAll('.status-circle');
                statusCircles.forEach(c => c.classList.add('running'));
                
                const py = await loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/" });
                await py.loadPackage('micropip');
                window._coreEngines.micropip = py.pyimport('micropip');
                
                py.globals.set("custom_input", (prompt_text) => prompt(prompt_text) || "");
                py.globals.set("ainput", async (prompt_text) => await window.inlineInputPrompt(prompt_text));
                py.globals.set("display_html", (html_content) => window.displayHTML(html_content));
                
                py.registerJsModule("IPython", {
                    get_ipython: () => null,
                    display: {
                        HTML: (data) => {
                            window.displayHTML(data);
                            return "";
                        }
                    }
                });
                
                await py.runPythonAsync(`
import os
os.environ['MPLBACKEND'] = 'AGG'
import sys, io
import builtins

builtins.is_trusted = True
builtins.input = custom_input
builtins.ainput = ainput
builtins.display_html = display_html

try:
    import warnings
    warnings.filterwarnings("ignore", message="Matplotlib is currently using agg")
    
    import matplotlib
    matplotlib.use('agg')
    import matplotlib.pyplot as plt
    plt.ion = lambda: None
    plt.show = lambda *args, **kwargs: None
except Exception:
    pass
`);
                window._coreEngines.pyodide = py;
                statusCircles.forEach(c => c.classList.remove('running'));
            } catch (e) {
                window._coreEngines.loading.pyodide = false;
                document.querySelectorAll('.status-circle').forEach(c => c.classList.remove('running'));
                window.setKernelStatus(pane, 'Failed to load. Please refresh.', true);
                console.error("Pyodide init error:", e);
                return null;
            }
        }
    }

    const py = window._coreEngines.pyodide;
    if (!py) return null;

    if (!kernelRegistry.pyNamespaces[winId]) {
        const ns = py.globals.get("dict")();
        kernelRegistry.pyNamespaces[winId] = ns;
        
        py.runPython(`
import sys, io
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
        `, { globals: ns });
    }
    
    const ns = kernelRegistry.pyNamespaces[winId];
    window.resetKernelStatus(pane);
    
    return new Proxy(py, {
        get(target, prop) {
            if (prop === 'runPython') {
                return (code, options = {}) => target.runPython(code, { ...options, globals: ns });
            }
            if (prop === 'runPythonAsync') {
                return (code, options = {}) => target.runPythonAsync(code, { ...options, globals: ns });
            }
            if (prop === 'globals') {
                return ns;
            }
            const val = target[prop];
            return typeof val === 'function' ? val.bind(target) : val;
        }
    });
};

window.getWebRInstance = async function() {
    const pane = document.querySelector('.editor-group.active-group .content-pane.active') || document.querySelector('.content-pane.active');

    if (!window._coreEngines.webr) {
        if (window._coreEngines.loading.webr) {
            while (!window._coreEngines.webr) {
                await new Promise(r => setTimeout(r, 100));
                if (!window._coreEngines.loading.webr && !window._coreEngines.webr) return null;
            }
        } else {
            window._coreEngines.loading.webr = true;
            try {
                const statusCircles = document.querySelectorAll('.status-circle');
                statusCircles.forEach(c => c.classList.add('running'));

                const { WebR } = await import('https://webr.r-wasm.org/latest/webr.mjs');
                const webr = new WebR();
                await webr.init();
                window._coreEngines.webr = webr;

                statusCircles.forEach(c => c.classList.remove('running'));
            } catch(e) {
                window._coreEngines.loading.webr = false;
                document.querySelectorAll('.status-circle').forEach(c => c.classList.remove('running'));
                window.setKernelStatus(pane, 'Failed to load. Please refresh.', true);
                console.error("WebR init error:", e);
                return null;
            }
        }
    }
    
    window.resetKernelStatus(pane);
    return window._coreEngines.webr;
};

// The webR engine itself is shared across every window/profile (loading it is
// expensive), but each window gets its own persistent R environment so
// variables assigned in one window's notebook never leak to or from another's.
// Mirrors getPyodideInstance's pyNamespaces pattern - see window.forceCloseEnvironments
// for the corresponding per-window cleanup (delete, not a full engine reload).
window.getRNamespace = async function(webr, winId) {
    if (!kernelRegistry.rNamespaces[winId]) {
        kernelRegistry.rNamespaces[winId] = await new webr.REnvironment({});
    }
    return kernelRegistry.rNamespaces[winId];
};

window.installPackage = async function(pkgName, kernel = 'python', e) {
    if(e) e.stopPropagation();
    
    const statusDiv = document.getElementById(`pkg-status-${kernel}-${pkgName}`);
    if(statusDiv) statusDiv.innerHTML = '<i class="ri-loader-4-line pkg-install-btn" style="animation: spinStatus 0.5s linear infinite;"></i>';
    
    const pane = document.querySelector('.editor-group.active-group .content-pane.active') || document.querySelector('.content-pane.active');
    
    try {
        document.querySelectorAll('.status-circle').forEach(c => c.classList.add('running'));

        if (kernel === 'r') {
            const webr = await window.getWebRInstance();
            if (!webr) throw new Error("Failed to initialize WebR.");
            if (window.kernelInterrupted) throw new Error("Interrupted");
            await webr.installPackages([pkgName]); 
        } else {
            const py = await window.getPyodideInstance();
            if (!py) throw new Error("Failed to initialize Pyodide.");
            if (window.kernelInterrupted) throw new Error("Interrupted");
            if (window.micropip) { 
                await window.micropip.install(pkgName); 
            } else { 
                await py.loadPackage(pkgName); 
            }
        }
        
        if (window.kernelInterrupted) throw new Error("Interrupted");

        window.installedPackages.add(`${kernel}:${pkgName}`);
        if(window.renderStacks) window.renderStacks();

        window.setKernelStatus(pane, `${pkgName} installed!`);
        setTimeout(() => window.resetKernelStatus(pane), 2000);
        
    } catch (err) {
        if (err.message === 'Interrupted') {
            window.setKernelStatus(pane, '[Installation Interrupted]', true);
            setTimeout(() => window.resetKernelStatus(pane), 2000);
        } else {
            window.showCustomModal({title:'Install Failed', text:`Failed to install ${pkgName}: ${err.message}`, submitText:'OK'}, ()=>{});
        }
        if(statusDiv) statusDiv.innerHTML = `<i class="ri-download-cloud-2-line pkg-install-btn" onclick="window.installPackage('${pkgName}', '${kernel}', event)" title="Install ${pkgName}"></i>`;
    } finally { 
        document.querySelectorAll('.status-circle').forEach(c => c.classList.remove('running')); 
        window.kernelInterrupted = false;
    }
};

window.updateVariablesExplorer = async function(pane) {
    const contentDiv = pane.querySelector('.vars-content');
    if (!contentDiv) return;
    
    const kernelStatus = pane.querySelector('.kernel-status');
    const kernelType = kernelStatus ? kernelStatus.dataset.kernel : 'python';
    
    contentDiv.innerHTML = '<div style="text-align:center; padding: 30px;"><i class="ri-loader-4-line" style="animation: spinStatus 0.8s linear infinite; font-size: 24px; color: var(--accent-blue);"></i><p style="margin-top: 10px; color: var(--text-muted);">Fetching variables...</p></div>';

    try {
        let html = '';
        if (kernelType === 'python') {
            const py = await window.getPyodideInstance();
            if (!py) throw new Error("Kernel not ready");
            
            const code = `
import json, sys, types, builtins

_exclude_names = {
    '__builtins__', '__name__', '__doc__', '__package__', '__loader__', '__spec__',
    '__annotations__', '__file__', '__cached__', '__warningregistry__',
    'sys', 'json', 'types', 'os', 'io', 'js', 'builtins', 'warnings', 'ast',
    'base64', 'copy', 'math', 'random', 're', 'string', 'time', 'datetime',
    'itertools', 'functools', 'collections', 'pathlib', 'traceback',
    'micropip', 'pyodide', 'pyodide_js', 'pyodide_ffi', 'asyncio',
    'matplotlib', 'plt', 'np', 'pd', 'Figure', 'Axes', 'pyplot',
    'AxesSubplot', 'Subplot', 'FigureCanvas', 'NavigationToolbar',
    'display', 'get_ipython', 'exit', 'quit', 'copyright', 'license', 'credits',
    'In', 'Out', 'getsizeof', 'pi', 'e', 'tau', 'inf', 'nan',
    'ainput', 'custom_input', 'display_html', 'is_trusted',
    '_code_to_parse', '_fmt_code', 'builtins_proxy',
    '_matplotlib_cache', 'mpld3', 'IPython',
    'HTML', 'display_html_builtin', '__builtins_snapshot__',
    'k', 'v', 'val_str', 'modules',
}

def _is_public_name(name):
    return (not name.startswith('_') and 
            not name.startswith('\\x00') and
            name not in _exclude_names)

def _is_user_value(v):
    if v is None:
        return False
    vtype = type(v)
    type_name = vtype.__name__
    if type_name in (
        'module', 'function', 'builtin_function_or_method',
        'type', 'method_descriptor', 'wrapper_descriptor',
        'getset_descriptor', 'member_descriptor', 'method-wrapper',
        'classmethod', 'staticmethod', 'ABCMeta', 'property',
        'BuiltinFunctionType', 'BuiltinMethodType', 'FunctionType'
    ):
        return False
    if hasattr(v, '__module__'):
        module = getattr(v, '__module__', '')
        if module and (module.startswith('pyodide') or 
                       module.startswith('_pyodide') or
                       module in ('builtins', 'sys', 'os')):
            return False
    if 'matplotlib' in str(type(v)).lower() or 'tkinter' in str(type(v)).lower():
        return False
    return True

def _collect_variables():
    _vars = []
    for _k in list(globals().keys()):
        if _is_public_name(_k):
            try:
                _v = globals()[_k]
                if _is_user_value(_v):
                    try:
                        _val_str = repr(_v)
                        if len(_val_str) > 50:
                            _val_str = _val_str[:47] + '...'
                        if not _val_str.startswith('<') or _val_str.startswith('<class'):
                            _vars.append({"name": _k, "type": type(_v).__name__, "value": _val_str})
                    except Exception:
                        pass
            except Exception:
                pass
    return _vars

_result = _collect_variables()
json.dumps(_result)
`;

            const res = await py.runPythonAsync(code);
            const vars = JSON.parse(res);
            
            if (vars.length === 0) {
                html = '<div class="empty-state" style="padding:30px; text-align:center; color:var(--text-muted);">No variables defined yet.</div>';
            } else {
                html = '<table class="vars-table"><thead><tr><th>Name</th><th>Type</th><th>Value</th></tr></thead><tbody>';
                vars.forEach(v => {
                    html += `<tr><td style="font-weight:600; color:var(--accent-blue);">${v.name.replace(/</g, '&lt;')}</td><td><span class="var-type-badge">${v.type.replace(/</g, '&lt;')}</span></td><td style="font-family:monospace;">${v.value.replace(/</g, '&lt;')}</td></tr>`;
                });
                html += '</tbody></table>';
            }
        } else if (kernelType === 'sql') {
            const db = await window.getSqlInstance();
            if (!db) throw new Error("Kernel not ready");
            const res = db.exec("SELECT name FROM sqlite_master WHERE type='table';");
            if (res.length > 0 && res[0].values.length > 0) {
                html = '<table class="vars-table"><thead><tr><th>Table Name</th></tr></thead><tbody>';
                res[0].values.forEach(row => {
                    html += `<tr><td style="font-weight:600; color:var(--accent-blue);"><i class="ri-table-2" style="margin-right: 5px;"></i>${row[0]}</td></tr>`;
                });
                html += '</tbody></table>';
            } else {
                html = '<div class="empty-state" style="padding:30px; text-align:center; color:var(--text-muted);">No tables created yet.</div>';
            }
        } else {
            html = `<div class="empty-state" style="padding:30px; text-align:center; color:var(--text-muted);">Variable explorer is not yet supported for ${kernelType}.</div>`;
        }
        contentDiv.innerHTML = html;
    } catch (err) {
        contentDiv.innerHTML = `<div style="padding: 20px; color: var(--color-danger); text-align:center;">Failed to fetch variables: ${err.message}</div>`;
    }
};

window.downloadSqlCsv = function(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    let csvContent = "";
    const rows = table.querySelectorAll('tr');
    
    rows.forEach((row) => {
        let rowData = [];
        const cols = row.querySelectorAll('th, td');
        cols.forEach((col) => {
            let data = col.innerText.replace(/"/g, '""');
            rowData.push(`"${data}"`);
        });
        csvContent += rowData.join(",") + "\n";
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.copySqlTable = function(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    let textContent = "";
    const rows = table.querySelectorAll('tr');
    
    rows.forEach((row) => {
        let rowData = [];
        const cols = row.querySelectorAll('th', 'td');
        cols.forEach((col) => rowData.push(col.innerText.trim()));
        textContent += rowData.join("\t") + "\n";
    });
    
    navigator.clipboard.writeText(textContent).then(() => {
        if(window.showCustomModal) {
            window.showCustomModal({ title: 'Success', text: 'Table copied to clipboard!', submitText: 'OK' }, () => {});
        }
    }).catch(err => console.error("Clipboard copy failed:", err));
};

function formatPythonCode(code) {
    let lines = code.split('\n'); const formatted = []; let indentLevel = 0; const indentSize = 4;
    for (let line of lines) {
        line = line.trimEnd(); const trimmed = line.trim();
        if (trimmed === '') { formatted.push(''); continue; }
        if (trimmed.match(/^(else|elif|except|finally)/)) indentLevel = Math.max(0, indentLevel - 1);
        formatted.push(' '.repeat(indentLevel * indentSize) + trimmed);
        if (trimmed.endsWith(':') && !trimmed.startsWith('import ') && !trimmed.startsWith('from ')) indentLevel++;
    }
    return formatted.join('\n');
}

function formatJavaScriptCode(code) {
    let formatted = code; let lines = formatted.split('\n'); let indentLevel = 0; const result = [];
    for (let line of lines) {
        line = line.trimEnd(); const trimmed = line.trim();
        if (trimmed === '') { result.push(''); continue; }
        if (trimmed.startsWith('}') || trimmed.startsWith(']')) indentLevel = Math.max(0, indentLevel - 1);
        result.push('  '.repeat(indentLevel) + trimmed);
        if (trimmed.endsWith('{') || trimmed.endsWith('[') || (trimmed.endsWith('(') && !trimmed.endsWith(');'))) indentLevel++;
    }
    return result.join('\n');
}

function getCellCodeFromEditor(cell) {
    if (window.cellMonacoEditors && window.cellMonacoEditors[cell.dataset.cellId]) {
        return window.cellMonacoEditors[cell.dataset.cellId].getValue();
    }
    const monacoContainer = cell.querySelector('.cell-monaco-container');
    if (monacoContainer && monacoContainer.hasAttribute('data-saved-code')) {
        return decodeURIComponent(monacoContainer.getAttribute('data-saved-code'));
    }
    const editor = cell.querySelector('.cell-editor');
    return editor ? editor.innerText : '';
}

function setCellCodeInEditor(cell, code) {
    if (window.cellMonacoEditors && window.cellMonacoEditors[cell.dataset.cellId]) {
        window.cellMonacoEditors[cell.dataset.cellId].setValue(code);
        return;
    }
    const editor = cell.querySelector('.cell-editor');
    if (editor) editor.innerText = code;
}

async function runCell(cell, pane) {
    const code = getCellCodeFromEditor(cell);
    if (!code && !code.trim()) return;

    if (cell.dataset.lastExecutedCode === code) {
        let outputWrapper = cell.querySelector('.cell-output-wrapper');
        if (outputWrapper) {
            const origBorder = outputWrapper.style.borderLeft;
            outputWrapper.style.borderLeft = '3px solid var(--term-green)';
            outputWrapper.style.paddingLeft = '10px';
            setTimeout(() => {
                outputWrapper.style.borderLeft = origBorder;
                outputWrapper.style.paddingLeft = '0';
            }, 400);
        }
        return; 
    }
    
    let outputWrapper = cell.querySelector('.cell-output-wrapper');
    if (!outputWrapper) {
        outputWrapper = document.createElement('div'); outputWrapper.className = 'cell-output-wrapper'; cell.querySelector('.cell-content-wrapper').appendChild(outputWrapper);
    }
    
    if (window.kernelInterrupted) { 
        outputWrapper.innerHTML = '<div class="cell-output"><span style="color: var(--color-danger); font-weight: bold;">[Execution Interrupted] The kernel was stopped by the user. Please restart if necessary.</span></div>'; 
        return; 
    }

    outputWrapper.innerHTML = '';
    
    let outputDiv = document.createElement('div'); outputDiv.className = 'cell-output';
    let plotContainer = document.createElement('div'); plotContainer.className = 'plot-container';

    outputWrapper.appendChild(outputDiv);
    outputWrapper.appendChild(plotContainer);

    const prompt = cell.querySelector('.cell-prompt'); const originalPrompt = prompt.innerHTML;
    
    const kernelStatus = pane.querySelector('.kernel-status');
    const kernelType = kernelStatus ? kernelStatus.dataset.kernel : 'python';
    const cellType = cell.dataset.cellType || 'code';
    
    const trustLink = pane.querySelector('.tb-trust');
    const isTrusted = trustLink ? trustLink.dataset.trusted === 'true' : true;
    
    if (cellType === 'markdown') {
        let renderedHtml = renderMarkdown(code);
        if (!isTrusted) {
            let wasBlocked = false;
            const parser = new DOMParser();
            const doc = parser.parseFromString(renderedHtml, 'text/html');
            const scripts = doc.querySelectorAll('script');
            if (scripts.length > 0) wasBlocked = true;
            scripts.forEach(s => s.remove());
            doc.querySelectorAll('*').forEach(el => {
                for (let i = el.attributes.length - 1; i >= 0; i--) {
                    const attr = el.attributes[i];
                    if (attr.name.toLowerCase().startsWith('on') || attr.value.toLowerCase().includes('javascript:')) {
                        el.removeAttribute(attr.name);
                        wasBlocked = true;
                    }
                }
            });
            renderedHtml = doc.body.innerHTML;
            if (wasBlocked) {
                const indicator = `<div class="blocked-content-indicator" style="color:var(--color-danger); border: 1px dashed var(--color-danger); padding: 5px; border-radius: 4px; font-size:12px; margin-bottom:5px; background: rgba(211, 47, 47, 0.05);"><i class="ri-shield-flash-line"></i> Sanitized Output: Blocked unsafe scripts/events (Untrusted)</div>\n`;
                renderedHtml = indicator + renderedHtml;
            }
        }
        outputWrapper.innerHTML = `<div class="markdown-rendered custom-markdown-view" title="Double click to edit">${renderedHtml}</div>`;
        cell.classList.add('markdown-mode-active');
        cell.dataset.lastExecutedCode = code;
        triggerNotebookSave(pane);
        setTimeout(() => window.generateTOC(pane), 200);
        return;
    }

    if (cellType === 'raw') {
        outputWrapper.innerHTML = '';
        cell.dataset.lastExecutedCode = code;
        triggerNotebookSave(pane);
        return;
    }
    
    prompt.innerHTML = '[*]:'; prompt.style.color = 'var(--accent-blue)'; outputDiv.innerHTML = '<span style="color: var(--accent-blue);">Running...</span>'; plotContainer.innerHTML = '';
    
    const statusCircle = pane.querySelector('.status-circle');
    if (statusCircle) statusCircle.classList.add('running');
    
    const interruptBtns = pane.querySelectorAll('.tb-interrupt');
    interruptBtns.forEach(b => b.classList.remove('disabled'));
    
    const startTime = performance.now();
    
    window._activeCellRegistry = window._activeCellRegistry || {};
    window._activeCellRegistry[_getWinId()] = cell;

    const interruptCheck = () => window.kernelInterrupted; window.kernelInterrupted = false;

    try {
        let outputText = ''; let errorText = '';
        let plots = [];

        if (kernelType === 'sql') {
            const db = await window.getSqlInstance();
            if (!db) throw new Error("Failed to load SQL runtime.");
            if (interruptCheck()) throw new Error("KeyboardInterrupt");
            
            try {
                const res = db.exec(code);
                if (res.length > 0) {
                    res.forEach((resultset, idx) => {
                        let tableId = 'sql-table-' + Date.now() + '-' + idx;
                        let tableHtml = `<div class="sql-table-responsive" style="margin-bottom: 10px;">`;
                        tableHtml += `<table id="${tableId}">`;
                        tableHtml += `<thead><tr>`;
                        resultset.columns.forEach(col => {
                            tableHtml += `<th>${col.replace(/</g, '&lt;')}</th>`;
                        });
                        tableHtml += '</tr></thead><tbody>';
                        resultset.values.forEach(row => {
                            tableHtml += '<tr>';
                            row.forEach(val => {
                                const displayVal = val === null ? '<em style="color: var(--text-muted);">NULL</em>' : String(val).replace(/</g, '&lt;');
                                tableHtml += `<td>${displayVal}</td>`;
                            });
                            tableHtml += '</tr>';
                        });
                        tableHtml += '</tbody></table></div>';

                        let toolbarHtml = `
                            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 15px;">
                                <button class="sql-table-btn" onclick="window.downloadSqlCsv('${tableId}', 'query_result.csv')" style="background: transparent; border: 1px solid var(--border-color); border-radius: 4px; padding: 4px 10px; cursor: pointer; color: var(--text-muted); font-size: 12px; transition: all 0.2s;"><i class="ri-download-line"></i> CSV</button>
                                <button class="sql-table-btn" onclick="window.copySqlTable('${tableId}')" style="background: transparent; border: 1px solid var(--border-color); border-radius: 4px; padding: 4px 10px; cursor: pointer; color: var(--text-muted); font-size: 12px; transition: all 0.2s;"><i class="ri-clipboard-line"></i> Copy</button>
                                <button class="sql-table-btn" onclick="window.openTablePreview('${tableId}', 'Cell ${getNextExecutionCount(cell)}')" style="background: transparent; border: 1px solid var(--border-color); border-radius: 4px; padding: 4px 10px; cursor: pointer; color: var(--text-muted); font-size: 12px; transition: all 0.2s;"><i class="ri-fullscreen-line"></i> Maximize</button>
                            </div>
                        `;
                        outputText += tableHtml + toolbarHtml;
                    });
                } else {
                    outputText += '<span style="color: var(--term-green);">Success (no result to display)</span>';
                }
            } catch(e) {
                errorText += e.message;
            }

        } else if (kernelType === 'r') {
            const webr = await window.getWebRInstance();
            if (!webr) throw new Error("Failed to load WebR runtime. Please refresh the page.");
            if (interruptCheck()) throw new Error("KeyboardInterrupt");
            
            const winId = _getWinId();
            const rEnv = await window.getRNamespace(webr, winId);
            
            let lines = code.split('\n');
            let cleanCodeLines = [];
            for (let line of lines) {
                if(line.trim().startsWith('%time')) {
                } else {
                    cleanCodeLines.push(line);
                }
            }
            let execCode = cleanCodeLines.join('\n');

            if (window.getNbAutoInstall()) {
                const rImports = [...execCode.matchAll(/(?:library|require)\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g)].map(m => m[2]);
                if (rImports.length > 0) {
                    outputDiv.innerHTML = '<span style="color: var(--accent-blue);">Resolving R dependencies...</span>';
                    try {
                        await webr.installPackages(rImports);
                    } catch (err) {
                        console.warn("Could not auto-install some R packages:", err);
                    }
                }
            }
            
            if (interruptCheck()) throw new Error("KeyboardInterrupt");
            
            let shelter = await new webr.Shelter();
            
            const tmpFolder = '/tmp/win_' + winId.replace(/[^a-zA-Z0-9]/g, '_');
            try { await webr.FS.mkdir(tmpFolder); } catch(e) {}
            
            try {
                try {
                    const oldFiles = await webr.FS.readdir(tmpFolder);
                    for(let f of oldFiles) {
                        if(f.startsWith('webr_plot_')) await webr.FS.unlink(tmpFolder + '/' + f);
                    }
                } catch(e) {}

                await webr.evalRVoid(`png(file="${tmpFolder}/webr_plot_%03d.png", width=800, height=600, res=100)`);

                const capture = await shelter.captureR(execCode, {
                    withAutoprint: true,
                    captureStreams: true,
                    captureConditions: false,
                    env: rEnv
                });
                
                capture.output.forEach(out => {
                    if (out.type === 'stdout') outputText += out.data + '\n';
                    if (out.type === 'stderr') errorText += out.data + '\n';
                });
            } finally {
                shelter.purge();
                await webr.evalRVoid(`tryCatch(dev.off(), error=function(e) NULL)`);
                
                try {
                    const files = await webr.FS.readdir(tmpFolder);
                    for (let f of files) {
                        if (f.startsWith('webr_plot_') && f.endsWith('.png')) {
                            const fileData = await webr.FS.readFile(tmpFolder + '/' + f);
                            let binary = '';
                            const bytes = new Uint8Array(fileData);
                            for (let i = 0; i < bytes.byteLength; i++) {
                                binary += String.fromCharCode(bytes[i]);
                            }
                            plots.push(btoa(binary));
                            await webr.FS.unlink(tmpFolder + '/' + f);
                        }
                    }
                } catch(e) { console.error("R Plot Capture Error:", e); }
            }

        } else {
            const py = await window.getPyodideInstance();
            if (!py) throw new Error("Failed to load Pyodide runtime. Please refresh the page.");
            if (interruptCheck()) throw new Error("KeyboardInterrupt");
            
            py.runPython(`import builtins\nbuiltins.is_trusted = ${isTrusted ? 'True' : 'False'}`);
            
            let lines = code.split('\n');
            let cleanCodeLines = [];
            let pipInstalls = [];
            let isTimeMagic = false;

            for (let line of lines) {
                const tLine = line.trim();
                if (tLine.startsWith('!pip install ')) {
                    let pkgs = tLine.replace('!pip install', '').trim().split(/\s+/);
                    pipInstalls.push(...pkgs);
                } else if (tLine.startsWith('!ls')) {
                    cleanCodeLines.push("import os; print('\\n'.join(os.listdir('.')))");
                } else if (tLine.startsWith('!pwd')) {
                    cleanCodeLines.push("import os; print(os.getcwd())");
                } else if (tLine.startsWith('!echo ')) {
                    cleanCodeLines.push(`print("${tLine.replace('!echo ', '').replace(/"/g, '\\"')}")`);
                } else if (tLine.startsWith('%time ') || tLine.startsWith('%%time')) {
                    isTimeMagic = true;
                    if (tLine.startsWith('%time ')) {
                        cleanCodeLines.push(line.replace('%time ', ''));
                    }
                } else if (tLine.startsWith('%matplotlib')) {
                } else {
                    cleanCodeLines.push(line);
                }
            }

            const cleanCode = cleanCodeLines.join('\n');

            if (pipInstalls.length > 0) {
                outputDiv.innerHTML = `<span style="color: var(--accent-blue);">Installing packages: ${pipInstalls.join(', ')}...</span>`;
                try {
                    if (window.micropip) {
                        await window.micropip.install(pipInstalls);
                    }
                } catch(e) {
                    errorText += `Failed to pip install: ${e.message}\n`;
                }
            }
            if (interruptCheck()) throw new Error("KeyboardInterrupt");

            if (window.getNbAutoInstall()) {
                outputDiv.innerHTML = '<span style="color: var(--accent-blue);">Resolving Python dependencies...</span>';
                
                try {
                    await py.loadPackagesFromImports(cleanCode);
                } catch (err) {
                    console.warn("Pyodide native load warning:", err);
                }
                
                try {
                    py.globals.set('_code_to_parse', cleanCode);
                    const importedModules = py.runPython(`
import ast
try:
    tree = ast.parse(_code_to_parse)
    modules = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for n in node.names: modules.add(n.name.split('.')[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module: modules.add(node.module.split('.')[0])
    list(modules)
except Exception:
    []
                    `);
                    if (importedModules && importedModules.toJs) {
                        const mods = importedModules.toJs();
                        const pkgsToInstall = mods.filter(m => m !== 'seaborn' && m !== 'requests');
                        if (pkgsToInstall.length > 0 && window.micropip) {
                            await window.micropip.install(pkgsToInstall);
                        }
                        importedModules.destroy();
                    }
                } catch (err) {
                    console.warn("Could not auto-install PyPI packages via micropip:", err);
                }
            }
            
            if (interruptCheck()) throw new Error("KeyboardInterrupt");
            
            py.runPython(`
import sys, io
_cm_stdout = io.StringIO()
_cm_stderr = io.StringIO()
sys.stdout = _cm_stdout
sys.stderr = _cm_stderr
`);

            try {
                let jsStartTime = isTimeMagic ? performance.now() : 0;
                const result = await py.runPythonAsync(cleanCode);
                let jsEndTime = isTimeMagic ? performance.now() : 0;

                if (interruptCheck()) throw new Error("KeyboardInterrupt");
                
                const stdout = py.runPython("_cm_stdout.getvalue()"); 
                const stderr = py.runPython("_cm_stderr.getvalue()");
                
                if (isTimeMagic) {
                    outputText += `CPU times: user ${(jsEndTime - jsStartTime).toFixed(2)} ms, sys: 0.00 ms, total: ${(jsEndTime - jsStartTime).toFixed(2)} ms\nWall time: ${(jsEndTime - jsStartTime).toFixed(2)} ms\n`;
                }

                if (stdout) outputText += stdout; 
                if (stderr) errorText += stderr;
                if (result !== undefined && result !== null) { 
                    const resultStr = result.toString(); 
                    if (resultStr !== 'undefined' && resultStr !== 'null') outputText += resultStr; 
                }
            } catch (execError) {
                const stderr = py.runPython("sys.stderr.getvalue()"); 
                if (stderr) errorText += stderr; 
                throw execError;
            }
            
            try {
                const plotCode = `
import matplotlib
matplotlib.use('agg')
import matplotlib.pyplot as plt
import io, base64
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
                if (proxy && proxy.toJs) { plots = proxy.toJs(); proxy.destroy(); }
            } catch(e) { console.error("Plot render error:", e); }
        }

        const endTime = performance.now();
        const execTime = ((endTime - startTime) / 1000).toFixed(2);

        if (!isTrusted && kernelType === 'sql') {
            let wasBlocked = false;
            const parser = new DOMParser();
            const doc = parser.parseFromString(outputText, 'text/html');
            const scripts = doc.querySelectorAll('script');
            if (scripts.length > 0) wasBlocked = true;
            scripts.forEach(s => s.remove());
            doc.querySelectorAll('*').forEach(el => {
                for (let i = el.attributes.length - 1; i >= 0; i--) {
                    const attr = el.attributes[i];
                    if (attr.name.toLowerCase().startsWith('on') || attr.value.toLowerCase().includes('javascript:')) {
                        el.removeAttribute(attr.name);
                        wasBlocked = true;
                    }
                }
            });
            outputText = doc.body.innerHTML;
            if (wasBlocked) {
                const indicator = `<div class="blocked-content-indicator" style="color:var(--color-danger); border: 1px dashed var(--color-danger); padding: 5px; border-radius: 4px; font-size:12px; margin-bottom:5px; background: rgba(211, 47, 47, 0.05);"><i class="ri-shield-flash-line"></i> Sanitized Output: Blocked unsafe scripts/events (Untrusted)</div>\n`;
                outputText = indicator + outputText;
            }
        }

        outputDiv.innerHTML = '';

        if (outputText || errorText) {
            const actionsBar = document.createElement('div');
            actionsBar.className = 'output-actions-bar';
            actionsBar.innerHTML = `
                <i class="ri-file-copy-line output-copy-btn" title="Copy Output"></i>
                <i class="ri-arrow-up-s-line output-collapse-btn" title="Collapse Output"></i>
            `;
            outputWrapper.insertBefore(actionsBar, outputDiv);
        }

        if (outputText) { 
            if (kernelType === 'sql') {
                outputDiv.style.backgroundColor = 'transparent';
                outputDiv.style.padding = '0';
                outputDiv.innerHTML += outputText;
            } else {
                const outputLines = outputText.split('\n'); 
                outputDiv.innerHTML += outputLines.map(line => line === '' ? '&nbsp;' : line.replace(/</g, '&lt;').replace(/>/g, '&gt;')).join('<br>'); 
            }
        }
        if (errorText) outputDiv.innerHTML += `<span style="color: var(--color-danger);">${errorText.replace(/\n/g, '<br>').replace(/</g, '&lt;')}</span>`;
        
        if (plots.length > 0) {
            const bgStr = (window.appSettings && window.appSettings.nbPlotBackground === 'Transparent') ? 'transparent' : 'var(--bg-white)';
            
            plots.forEach((b64, idx) => { 
                const card = document.createElement('div'); 
                card.className = 'plot-card'; 
                card.style.display = 'inline-block';
                card.style.padding = '0';
                card.style.overflow = 'hidden';
                card.style.border = '1px solid var(--border-color)';                

                const imgSrc = `data:image/png;base64,${b64}`;
                
                card.innerHTML = `
                    <div style="padding: 10px; background: ${bgStr}; text-align: center;">
                        <img src="${imgSrc}" class="output-plot-img" style="max-width:100%; display:inline-block;" />
                    </div>
                    <div class="plot-toolbar" style="display:flex; justify-content:flex-end; gap:12px; padding: 6px 10px; background: var(--bg-panel); border-top: 1px solid var(--border-color);">
                        <i class="ri-download-2-line plot-dl-btn" title="Download Plot" style="cursor:pointer; color:var(--icon-gray); font-size:15px; transition:color 0.2s;"></i>
                        <i class="ri-fullscreen-line plot-max-btn" title="Maximize Plot" style="cursor:pointer; color:var(--icon-gray); font-size:15px; transition:color 0.2s;"></i>
                    </div>
                `; 
                plotContainer.appendChild(card); 
            }); 
        }

        if (!outputDiv.innerHTML) outputDiv.remove();
        if (plots.length === 0) plotContainer.remove();
        
        const customDisplays = outputWrapper.querySelectorAll('.custom-display').length;
        if (!outputText && !errorText && plots.length === 0 && customDisplays === 0) {
             outputWrapper.innerHTML = '<div class="cell-output"><span style="color: var(--text-muted); font-style: italic;">(Completed with no output)</span></div>';
        }
        
        const timeDiv = document.createElement('div');
        timeDiv.style.cssText = "font-size: 10px; color: var(--text-muted); text-align: right; margin-top: 5px; width: 100%;";
        timeDiv.textContent = `Executed in ${execTime}s`;
        outputWrapper.appendChild(timeDiv);
        
        prompt.innerHTML = originalPrompt.replace('[ ]:', `[${getNextExecutionCount(cell)}]:`); prompt.style.color = '';
        
    } catch (err) {
        console.error("Execution error:", err); const errorMessage = err.toString();
        if (errorMessage.includes('KeyboardInterrupt') || errorMessage.includes('InterruptException') || window.kernelInterrupted) {
            outputDiv.innerHTML = '<span style="color: var(--color-danger); font-weight: bold;">[Execution Interrupted] The kernel was stopped by the user.</span>';
        } else {
            outputDiv.innerHTML = `<span style="color: var(--color-danger);">Error: ${errorMessage.replace(/\n/g, '<br>')}</span>`;
        }
        prompt.innerHTML = originalPrompt; prompt.style.color = '';
    } finally {
        if (statusCircle) statusCircle.classList.remove('running');
        interruptBtns.forEach(b => b.classList.add('disabled'));
        window.kernelInterrupted = false; 
        
        cell.dataset.lastExecutedCode = code;
        
        triggerNotebookSave(pane);

        const varsPanel = pane.querySelector('.vars-explorer-panel');
        if (varsPanel && varsPanel.classList.contains('show')) {
            setTimeout(() => {
                window.updateVariablesExplorer(pane);
            }, 100);
        }
        
        setTimeout(() => window.generateTOC(pane), 200);
    }
}

function getNextExecutionCount(cell) { 
    return Array.from(cell.closest('.cells-container').querySelectorAll('.cell')).indexOf(cell) + 1; 
}

function exportNotebook(pane) {
    const cells = pane.querySelectorAll('.cell');
    const kernelStatus = pane.querySelector('.kernel-status');
    const kernelType = kernelStatus ? kernelStatus.dataset.kernel : 'python';
    const lang = kernelType === 'r' ? 'r' : (kernelType === 'sql' ? 'sql' : 'python3');
    
    const trustLink = pane.querySelector('.tb-trust');
    const isTrusted = trustLink ? trustLink.dataset.trusted === 'true' : true;
    
    const notebookData = { cells: [], metadata: { kernel: lang, language: kernelType, trusted: isTrusted } };
    cells.forEach(cell => {
        const code = getCellCodeFromEditor(cell);
        const outputs = []; const outputDiv = cell.querySelector('.cell-output'); const plotContainer = cell.querySelector('.plot-container');
        
        const tagsContainer = cell.querySelector('.cell-tags');
        const tags = tagsContainer ? Array.from(tagsContainer.querySelectorAll('.cell-tag')).map(t => t.textContent.trim()) : [];
        const cellMetadata = tags.length > 0 ? { tags: tags } : {};

        if (outputDiv && outputDiv.innerHTML && !outputDiv.classList.contains('collapsed')) {
            outputs.push({ output_type: 'stream', text: outputDiv.innerText });
        }
        if (plotContainer) {
            plotContainer.querySelectorAll('img').forEach(img => { 
                outputs.push({ output_type: 'display_data', data: { 'image/png': img.src.split(',')[1] } }); 
            });
        }
        
        notebookData.cells.push({ cell_type: cell.dataset.cellType || 'code', metadata: cellMetadata, source: code, outputs: outputs });
    });
    return JSON.stringify(notebookData, null, 2);
}
