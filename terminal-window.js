// ==========================================
// terminal-window.js
// ==========================================

(function initTerminalWindow() {
    const terminalIconItem = document.getElementById('terminalIconItem');
    
    if (terminalIconItem) {
        terminalIconItem.addEventListener('click', () => {
            const existingTerms = document.querySelectorAll('.tab[data-type="terminal"]');
            if (existingTerms.length >= 2) {
                if(window.showCustomModal) {
                    window.showCustomModal({ title: 'Terminal Limit', text: 'A maximum of 2 terminal windows can be opened.', submitText: 'OK' }, () => {});
                } else {
                    alert("A maximum of 2 terminal windows can be opened.");
                }
                return;
            }

            // Determine unique index for persistence (1 or 2)
            let termIndex = 1;
            if (document.querySelector('.tab[data-target="pane-term-1"]')) termIndex = 2;
            const targetPaneId = `pane-term-${termIndex}`;
            
            // Strictly bind the terminal execution to the active window ID and DB at the time of creation
            const activeWinId = localStorage.getItem('codemini_active_window') || 'win_default';
            const stateKey = `codemini-term-${activeWinId}-state-${termIndex}`;
            
            let isolatedDbName = 'CodeMiniDB';
            if (typeof cellWindows !== 'undefined') {
                const winData = cellWindows.find(w => w.id === activeWinId);
                if (winData && winData.db) isolatedDbName = winData.db;
            }
            
            const termId = 'term-' + Date.now();

            const termState = {
                commandHistory: [],
                historyIndex: -1,
                aliases: {
                    'ted': 'mini', 'nan': 'mini', 'edit': 'mini', 'll': 'ls -l', 'la': 'ls -la', 'cls': 'clear'
                },
                envVars: {},
                folderStack: [{ id: 'root', name: 'CodeMini' }],
                userName: "user",
                interrupted: false
            };

            // Output capture for command substitution $(...) and Piping
            let isCapturing = false;
            let captureBuffer = "";
            
            if(typeof createNewTab === 'function') {
                // Captured before creation: createNewTab() inserts into
                // whichever group activeGroupId currently points at, and with
                // split view on, that's not necessarily editorGroup1 - scoping
                // the post-creation lookup below to this same group is what
                // keeps it targeting the tab we actually just made.
                const targetGroupEl = document.getElementById(typeof activeGroupId !== 'undefined' ? activeGroupId : 'editorGroup1')
                    || document.querySelector('.editor-group.active-group')
                    || document.getElementById('editorGroup1');

                createNewTab('Terminal', 'ri-terminal-window-line', false, `
                    <div id="${termId}" data-term-index="${termIndex}" style="background-color: var(--term-output-bg); color: var(--term-output-text); font-family: 'Fira Code', Consolas, monospace; padding: 15px; flex: 1; display: flex; flex-direction: column; font-size: 13px; height: 100%; overflow-y: auto; scroll-behavior: smooth; position: relative;">
                        <div class="term-output" style="display: flex; flex-direction: column; margin-bottom: 5px; word-wrap: break-word; flex: 1;">
                        </div>
                        <div class="term-input-row" style="display: flex; align-items: flex-start; gap: 8px; margin-top: auto; flex-shrink: 0;">
                            <span style="white-space: nowrap;"><span style="color: var(--term-prompt-user);">${termState.userName}@codemini</span>:<span style="color: var(--term-prompt-path); font-weight: bold;" class="term-cwd">~</span>$</span>
                            <input type="text" class="term-input" style="flex: 1; background: transparent; border: none; color: var(--term-cmd-text); outline: none; font-family: inherit; font-size: 13px; min-width: 0;" autocomplete="off" spellcheck="false" autofocus>
                        </div>
                    </div>
                `, 'terminal');

                // Scoped to targetGroupEl rather than a bare document-wide
                // query - with a second terminal already open and active in
                // the OTHER split pane, an unscoped
                // '.tab.active[data-type="terminal"]' lookup would just as
                // happily match that unrelated, pre-existing tab, and the
                // rename below would then hijack ITS pane id instead of the
                // new tab's - corrupting both terminals' identities.
                const newTab = targetGroupEl ? targetGroupEl.querySelector('.tab.active[data-type="terminal"]') : document.querySelector('.tab.active[data-type="terminal"]');

                if (newTab && !document.getElementById(targetPaneId)) {
                    const pane = document.getElementById(newTab.dataset.target);
                    if (pane) {
                        newTab.dataset.target = targetPaneId;
                        pane.id = targetPaneId;
                    }
                }

                setTimeout(() => {
                    const termContainer = document.getElementById(termId);
                    if (!termContainer) return;
                    
                    const input = termContainer.querySelector('.term-input');
                    const output = termContainer.querySelector('.term-output');
                    const inputRow = termContainer.querySelector('.term-input-row');
                    const cwdDisplay = termContainer.querySelector('.term-cwd');

                    // --- Persistence Engine ---
                    const saveState = () => {
                        const state = {
                            history: termState.commandHistory,
                            cwd: termState.folderStack,
                            aliases: termState.aliases,
                            envVars: termState.envVars,
                            outputHtml: output.innerHTML
                        };
                        localStorage.setItem(stateKey, JSON.stringify(state));
                    };
                    
                    const clearState = () => {
                        localStorage.removeItem(stateKey);
                    };

                    const loadState = () => {
                        const saved = localStorage.getItem(stateKey);
                        if (saved) {
                            try {
                                const parsed = JSON.parse(saved);
                                termState.commandHistory = parsed.history || [];
                                termState.folderStack = parsed.cwd || [{ id: 'root', name: 'CodeMini' }];
                                termState.aliases = parsed.aliases || { 'ted': 'mini', 'nan': 'mini', 'edit': 'mini', 'll': 'ls -l', 'la': 'ls -la', 'cls': 'clear' };
                                termState.envVars = parsed.envVars || {};
                                output.innerHTML = parsed.outputHtml || '';
                            } catch (e) {
                                console.error("Error loading terminal state", e);
                            }
                        } else {
                            output.innerHTML = `
                                <div style="margin-bottom: 4px; color: #4caf50;">CodeMini Terminal Environment v1.0.0</div>
                                <div style="margin-bottom: 8px; color: #9e9e9e;">Type <span style="color:#2196f3;">'help'</span> for a categorized list of commands.</div>
                            `;
                        }
                    };

                    loadState();

                    // --- Isolated DB Promise Wrappers ---
                    // By defining these per-terminal, we guarantee background loops write to the parent window's database 
                    // even if the user has navigated away to a different workspace profile.
                    const getIsolatedDbTx = (mode) => new Promise((resolve, reject) => {
                        const req = indexedDB.open(isolatedDbName, 3);
                        req.onsuccess = e => resolve({ dbInst: e.target.result, tx: e.target.result.transaction('filesystem', mode) });
                        req.onerror = e => reject(e);
                    });

                    const dbGetAll = async () => {
                        const { dbInst, tx } = await getIsolatedDbTx('readonly');
                        return new Promise(resolve => {
                            tx.objectStore('filesystem').getAll().onsuccess = e => {
                                dbInst.close();
                                resolve(e.target.result);
                            };
                        });
                    };

                    const dbGetDirFiles = async (parentId) => {
                        const all = await dbGetAll();
                        return all.filter(f => (f.parentId || 'root') === parentId);
                    };

                    const triggerSafeUIRefresh = () => {
                        // Only trigger UI render if the user is looking at this terminal's native window
                        if (typeof cellActiveWinId !== 'undefined' && cellActiveWinId === activeWinId && typeof loadFilesFromDB === 'function') {
                            loadFilesFromDB();
                        }
                    };

                    const dbPut = async (fileObj) => {
                        const { dbInst, tx } = await getIsolatedDbTx('readwrite');
                        return new Promise(resolve => {
                            tx.objectStore('filesystem').put(fileObj);
                            tx.oncomplete = () => { 
                                dbInst.close();
                                triggerSafeUIRefresh(); 
                                resolve(); 
                            };
                        });
                    };

                    const dbDelete = async (id) => {
                        const { dbInst, tx } = await getIsolatedDbTx('readwrite');
                        return new Promise(resolve => {
                            tx.objectStore('filesystem').delete(id);
                            tx.oncomplete = () => { 
                                dbInst.close();
                                triggerSafeUIRefresh(); 
                                resolve(); 
                            };
                        });
                    };

                    const writeToFile = async (filename, content, append = false) => {
                        const files = await dbGetDirFiles(getCurrentFolderId());
                        let target = files.find(f => f.name === filename);
                        if (target) {
                            if (!await checkUnlock(target)) return;
                            target.content = append ? (target.content || '') + content : content;
                            target.timestamp = Date.now();
                            await dbPut(target);
                        } else {
                            const perms = (filename.endsWith('.sh') || filename.endsWith('.js') || filename.endsWith('.py')) ? '-rwxr-xr-x' : '-rw-r--r--';
                            await dbPut({ id: Date.now().toString() + Math.random().toString(36).substring(2), parentId: getCurrentFolderId(), name: filename, type: 'file', content: content, perms: perms, timestamp: Date.now() });
                        }
                    };

                    const getCurrentFolderId = () => termState.folderStack[termState.folderStack.length - 1].id;
                    
                    const getPathString = () => {
                        if (termState.folderStack.length === 1) return '~';
                        return '~/' + termState.folderStack.slice(1).map(f => f.name).join('/');
                    };

                    const updateCWD = () => { cwdDisplay.textContent = getPathString(); };
                    updateCWD();

                    const printTerm = (text, isHtml = false) => {
                        if (isCapturing) {
                            let temp = document.createElement('div');
                            if (isHtml) temp.innerHTML = text; else temp.textContent = text;
                            captureBuffer += temp.textContent + "\n";
                            return;
                        }
                        const div = document.createElement('div');
                        div.style.marginBottom = '4px';
                        if (isHtml) div.innerHTML = text; else div.textContent = text;
                        output.appendChild(div);
                        termContainer.scrollTop = termContainer.scrollHeight;
                    };

                    const parseArgs = (str) => {
                        const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
                        const args = []; let match;
                        while ((match = regex.exec(str)) !== null) {
                            args.push(match[1] !== undefined ? match[1] : (match[2] !== undefined ? match[2] : match[3]));
                        }
                        return args;
                    };

                    const formatBytes = (bytes) => {
                        if (bytes === 0) return '0 B';
                        const k = 1024;
                        const sizes = ['B', 'KB', 'MB', 'GB'];
                        const i = Math.floor(Math.log(bytes) / Math.log(k));
                        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
                    };

                    // --- Advanced Parsing & Execution Pipelines ---

                    const captureCommand = async (cmdStr) => {
                        const prevCapturing = isCapturing;
                        const prevBuffer = captureBuffer;

                        isCapturing = true;
                        captureBuffer = "";

                        await executeSingleCommand(cmdStr);

                        const result = captureBuffer;

                        isCapturing = prevCapturing;
                        captureBuffer = prevBuffer;

                        return result.endsWith('\n') ? result.slice(0, -1) : result;
                    };

                    const expandEnvAndSub = async (str) => {
                        const subRegex = /\$\(([^)]+)\)/g;
                        let match;
                        const matches = [];
                        while ((match = subRegex.exec(str)) !== null) {
                            matches.push({ full: match[0], cmd: match[1] });
                        }
                        for (let m of matches) {
                            const captured = await captureCommand(m.cmd);
                            str = str.replace(m.full, captured.trim());
                        }

                        str = str.replace(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (m, v) => termState.envVars[v] !== undefined ? termState.envVars[v] : '');
                        str = str.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (m, v) => termState.envVars[v] !== undefined ? termState.envVars[v] : '');

                        return str;
                    };

                    const splitCommands = (str) => {
                        const result = [];
                        let current = '';
                        let inQuotes = false;
                        let quoteChar = '';

                        for (let i = 0; i < str.length; i++) {
                            const char = str[i];
                            if ((char === '"' || char === "'") && (i === 0 || str[i-1] !== '\\')) {
                                if (inQuotes && quoteChar === char) inQuotes = false;
                                else if (!inQuotes) { inQuotes = true; quoteChar = char; }
                            }

                            if (char === ';' && !inQuotes) {
                                result.push(current);
                                current = '';
                            } else {
                                current += char;
                            }
                        }
                        if (current) result.push(current);
                        return result;
                    };

                    // --- SECURITY / ACCESS HELPERS ---
                    const checkUnlock = async (file) => {
                        if (!file || !file.isLocked) return true;
                        return new Promise(resolve => {
                            if(window.showCustomModal) {
                                window.showCustomModal({
                                    title: 'Item Locked',
                                    text: `Enter password to access ${file.name}:`,
                                    inputType: 'password',
                                    submitText: 'Unlock'
                                }, (pwd) => {
                                    if (pwd !== file.password) {
                                        printTerm(`<span style="color: var(--term-red);">bash: ${file.name}: Permission denied (Incorrect password)</span>`, true);
                                        if(typeof closeGenModal === 'function') closeGenModal();
                                        resolve(false);
                                    } else {
                                        if(typeof closeGenModal === 'function') closeGenModal();
                                        resolve(true);
                                    }
                                });

                                const modal = document.getElementById('genericModal');
                                if (modal) {
                                    const observer = new MutationObserver((mutations) => {
                                        mutations.forEach((mutation) => {
                                            if (mutation.attributeName === 'class' && !modal.classList.contains('show')) {
                                                resolve(false); 
                                                observer.disconnect();
                                            }
                                        });
                                    });
                                    observer.observe(modal, { attributes: true });
                                }
                            } else {
                                const pwd = prompt(`Enter password to access ${file.name}:`);
                                if (pwd !== file.password) {
                                    printTerm(`<span style="color: var(--term-red);">bash: ${file.name}: Permission denied</span>`, true);
                                    resolve(false);
                                } else {
                                    resolve(true);
                                }
                            }
                        });
                    };

                    const blockBinary = (filename, cmd) => {
                        const ext = filename.split('.').pop().toLowerCase();
                        if (['ipynb', 'irnb', 'sqlnb', 'pdf', 'png', 'zip'].includes(ext)) {
                            printTerm(`<span style="color: var(--term-red);">${cmd}: ${filename}: Cannot read, open, or edit this type of file inside the terminal tools.</span>`, true);
                            return true;
                        }
                        return false;
                    };

                    // --- FILE EXECUTOR ---
                    const executeFile = async (filename, args) => {
                        const files = await dbGetDirFiles(getCurrentFolderId());
                        const target = files.find(f => f.name === filename);
                        if (!target || target.type !== 'file') {
                            return printTerm(`bash: ${filename}: No such file or directory`);
                        }

                        if (!await checkUnlock(target)) return;

                        // Permission Checking
                        const perms = target.perms || (target.name.endsWith('.sh') || target.name.endsWith('.js') ? '-rwxr-xr-x' : '-rw-r--r--');
                        const isExecutable = perms[3] === 'x' || perms[6] === 'x' || perms[9] === 'x';
                        
                        if (!isExecutable) {
                            return printTerm(`bash: ${filename}: Permission denied`);
                        }
                        
                        const ext = filename.split('.').pop().toLowerCase();
                        
                        if (ext === 'js') {
                            try {
                                const result = eval(target.content);
                                if (result !== undefined) printTerm(result.toString());
                            } catch (e) {
                                printTerm(`<span style="color:#e06c75;">Error: ${e.message}</span>`, true);
                            }
                        } else if (ext === 'py') {
                            try {
                                if (typeof window.getPyodideInstance === 'undefined') {
                                    throw new Error("Pyodide engine missing. Please load a Python notebook first.");
                                }
                                const py = await window.getPyodideInstance();
                                if (!py) throw new Error("Kernel not ready");
                                
                                py.runPython(`import sys, io\nsys.stdout = io.StringIO()\nsys.stderr = io.StringIO()`);
                                
                                // Inject argv arguments
                                py.globals.set('sys_argv', ['python', filename, ...args]);
                                py.runPython(`import sys; sys.argv = sys_argv.to_py()`);

                                await py.runPythonAsync(target.content);
                                
                                const stdout = py.runPython("sys.stdout.getvalue()");
                                const stderr = py.runPython("sys.stderr.getvalue()");
                                
                                if (stdout) printTerm(stdout.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'), true);
                                if (stderr) printTerm(`<span style="color:var(--term-red)">${stderr.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</span>`, true);
                            } catch (e) {
                                printTerm(`<span style="color:#e06c75;">[Python Error] ${e.message}</span>`, true);
                            }
                        } else if (ext === 'php') {
                            try {
                                if (!window.phpWebInstance) {
                                    let module;
                                    try { module = await import('https://unpkg.com/php-wasm/PhpWeb.mjs'); } 
                                    catch (err1) { module = await import('https://cdn.jsdelivr.net/npm/php-wasm/PhpWeb.mjs'); }
                                    window.phpWebInstance = new module.PhpWeb();
                                    window.phpWebInstance.addEventListener('output', (event) => { if(window._phpConsoleLines) window._phpConsoleLines.push(event.detail); });
                                }
                                window._phpConsoleLines = [];
                                let code = target.content.trim();
                                if (!code.startsWith('<?php')) code = `<?php\n${code}\n?>`;
                                await window.phpWebInstance.run(code);
                                const result = window._phpConsoleLines.join('').trim();
                                if (result) printTerm(result.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'), true);
                            } catch (e) {
                                printTerm(`<span style="color:#e06c75;">[PHP Error] ${e.message}</span>`, true);
                            }
                        } else if (ext === 'rb') {
                            try {
                                if (!window.opalLoading && typeof window.Opal === 'undefined') {
                                    const loadScript = (src) => new Promise(resolve => {
                                        const script = document.createElement('script'); script.src = src; script.onload = resolve; document.head.appendChild(script);
                                    });
                                    window.opalLoading = (async () => {
                                        await loadScript("https://cdn.opalrb.com/opal/current/opal.min.js");
                                        await loadScript("https://cdn.opalrb.com/opal/current/opal-parser.min.js");
                                    })();
                                }
                                if (window.opalLoading) await window.opalLoading;
                                
                                let outputLines = [];
                                const originalLog = console.log;
                                console.log = (...a) => outputLines.push(a.join(' '));
                                window.Opal.eval(target.content);
                                console.log = originalLog;
                                
                                if (outputLines.length) printTerm(outputLines.join('<br>').replace(/</g, '&lt;').replace(/>/g, '&gt;'), true);
                            } catch (e) {
                                printTerm(`<span style="color:#e06c75;">[Ruby Error] ${e.message}</span>`, true);
                            }
                        } else if (ext === 'sh' || ext === 'zsh' || ext === 'bash' || !filename.includes('.')) {
                            const prevEnv = { ...termState.envVars };
                            termState.envVars['0'] = filename;
                            termState.envVars['#'] = args.length.toString();
                            termState.envVars['@'] = args.join(' ');
                            termState.envVars['*'] = args.join(' ');
                            args.forEach((a, i) => termState.envVars[(i + 1).toString()] = a);

                            const lines = (target.content || '').split('\n');
                            let combinedLines = [];
                            let currentLine = "";
                            
                            for (let line of lines) {
                                let tLine = line.trim();
                                if (tLine.endsWith('\\')) {
                                    currentLine += tLine.slice(0, -1) + " ";
                                } else {
                                    combinedLines.push(currentLine + line);
                                    currentLine = "";
                                }
                            }

                            for (let line of combinedLines) {
                                if (termState.interrupted) break;
                                if (line.trim() && !line.trim().startsWith('#')) {
                                    await processCommandStr(line);
                                }
                            }

                            termState.envVars = prevEnv;
                        } else {
                            printTerm(`bash: ${filename}: command not found or not executable`);
                        }
                    };

                    // --- CORE SYSTEM COMMANDS INJECTION ---
                    const { commandDocs, commands } = window.getTerminalCommands(
                        printTerm, dbGetDirFiles, getCurrentFolderId, dbGetAll, dbPut, dbDelete,
                        updateCWD, getPathString, checkUnlock, blockBinary, executeFile,
                        termState, saveState, clearState, termContainer, output, input, inputRow, formatBytes
                    );

                    const executeSingleCommand = async (cmdStr) => {
                        if (!cmdStr || termState.interrupted) return;

                        const varMatch = cmdStr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)=(.*)$/);
                        if (varMatch) {
                            let val = varMatch[2];
                            val = await expandEnvAndSub(val);
                            termState.envVars[varMatch[1]] = val.replace(/^["']|["']$/g, '');
                            saveState();
                            return;
                        }

                        cmdStr = await expandEnvAndSub(cmdStr);

                        const rawArgs = parseArgs(cmdStr);
                        if(rawArgs.length === 0) return;
                        
                        let baseCmd = rawArgs[0];
                        if(termState.aliases[baseCmd]) {
                            const expanded = termState.aliases[baseCmd] + ' ' + rawArgs.slice(1).join(' ');
                            rawArgs.length = 0;
                            rawArgs.push(...parseArgs(expanded));
                            baseCmd = rawArgs[0];
                        }

                        const command = baseCmd.toLowerCase();

                        if (command.startsWith('./')) {
                            const filename = command.substring(2);
                            await executeFile(filename, rawArgs.slice(1));
                            return;
                        }

                        if (commands[command]) {
                            await commands[command](rawArgs);
                        } else {
                            const files = await dbGetDirFiles(getCurrentFolderId());
                            const target = files.find(f => f.name === baseCmd);
                            
                            if (target && target.type === 'file' && (baseCmd.endsWith('.js') || baseCmd.endsWith('.sh') || baseCmd.endsWith('.zsh') || baseCmd.endsWith('.py') || baseCmd.endsWith('.rb') || baseCmd.endsWith('.php'))) {
                                await executeFile(baseCmd, rawArgs.slice(1));
                            } else {
                                printTerm(`bash: ${command}: command not found`);
                            }
                        }
                    };

                    const processCommandStr = async (rawInput) => {
                        let runInBackground = false;
                        if (rawInput.trim().endsWith('&')) {
                            runInBackground = true;
                            rawInput = rawInput.substring(0, rawInput.lastIndexOf('&')).trim();
                        }

                        const executePipeline = async (pipelineStr) => {
                            const pipeParts = pipelineStr.split('|').map(p => p.trim());
                            let pipeData = null;

                            let lastCmd = pipeParts[pipeParts.length - 1];
                            let redirectTarget = null;
                            let append = false;
                            
                            const redMatch = lastCmd.match(/\s+(>>|>)\s+([^>|&\s]+)$/);
                            if (redMatch) {
                                append = redMatch[1] === '>>';
                                redirectTarget = redMatch[2];
                                pipeParts[pipeParts.length - 1] = lastCmd.substring(0, redMatch.index);
                            }

                            for (let i = 0; i < pipeParts.length; i++) {
                                if (termState.interrupted) break;
                                let part = pipeParts[i];
                                if (!part) continue;

                                if (pipeData !== null) {
                                    termState.envVars['STDIN'] = pipeData;
                                } else {
                                    delete termState.envVars['STDIN'];
                                }

                                if (i < pipeParts.length - 1 || redirectTarget) {
                                    pipeData = await captureCommand(part);
                                } else {
                                    await executeSingleCommand(part);
                                }
                            }

                            if (redirectTarget && !termState.interrupted && pipeData !== null) {
                                await writeToFile(redirectTarget, pipeData, append);
                            }
                        };

                        const cmds = splitCommands(rawInput);
                        
                        if (runInBackground) {
                            (async () => {
                                for (let cmdStr of cmds) {
                                    if (termState.interrupted) break;
                                    await executePipeline(cmdStr);
                                }
                            })();
                            printTerm(`[1] ${Math.floor(Math.random() * 10000) + 1000}`);
                        } else {
                            for (let cmdStr of cmds) {
                                if (termState.interrupted) break;
                                await executePipeline(cmdStr);
                            }
                        }
                        
                        delete termState.envVars['STDIN'];
                        termState.interrupted = false;
                    };

                    let termEnterHandled = false;
                    let termSubmitting = false; // guards against double-submit across the multiple detection paths below
                    const processTermEnter = async () => {
                        if (termSubmitting) return;
                        termSubmitting = true;
                        try {
                            const cmd = input.value.trim();
                            input.value = '';
                            printTerm(`<span style="color: #4caf50;">${termState.userName}@codemini</span>:<span style="color: #2196f3; font-weight: bold;">${getPathString()}</span>$ ${cmd}`, true);

                            if (cmd) {
                                termState.commandHistory.push(cmd);
                                termState.historyIndex = termState.commandHistory.length;
                                input.disabled = true;
                                await processCommandStr(cmd);
                                input.disabled = false;
                                input.focus();
                                saveState();
                            }
                        } finally {
                            termSubmitting = false;
                        }
                    };

                    input.addEventListener('keydown', async (e) => {
                        if (e.key === 'c' && e.ctrlKey) {
                            e.preventDefault();
                            termState.interrupted = true;
                            printTerm(`<span style="color: #4caf50;">${termState.userName}@codemini</span>:<span style="color: #2196f3; font-weight: bold;">${getPathString()}</span>$ ${input.value}^C`, true);
                            input.value = '';
                            isCapturing = false;
                            return;
                        }

                        if (e.key === 'Tab') {
                            e.preventDefault();
                            const val = input.value;
                            if (!val) return;
                            const words = val.split(' ');
                            const lastWord = words[words.length - 1];
                            if (!lastWord) return;

                            let matches = [];
                            if (words.length === 1) {
                                const availableCmds = Object.keys(commands).concat(Object.keys(termState.aliases));
                                matches = availableCmds.filter(c => c.startsWith(lastWord));
                            } else {
                                const files = await dbGetDirFiles(getCurrentFolderId());
                                matches = files.map(f => f.name).filter(f => f.startsWith(lastWord));
                            }

                            if (matches.length === 1) {
                                words[words.length - 1] = matches[0];
                                input.value = words.join(' ');
                            } else if (matches.length > 1) {
                                printTerm(`<br>${matches.join('  ')}`, true);
                                printTerm(`<span style="color: #4caf50;">${termState.userName}@codemini</span>:<span style="color: #2196f3; font-weight: bold;">${getPathString()}</span>$ ${val}`, true);
                            }
                            return;
                        }

                        // Standard path: works for physical keyboards and most desktop browsers.
                        // Some Android IME keyboards never reach here for the Enter/Go/Send key
                        // (they report keyCode 229 / key 'Unidentified' since it's delivered via
                        // IME composition), so this alone isn't sufficient on those devices -
                        // see the 'beforeinput' listener below for the fallback path.
                        if (e.key === 'Enter' || e.keyCode === 13) {
                            e.preventDefault();
                            termEnterHandled = true;
                            await processTermEnter();
                        } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            if (termState.historyIndex > 0) {
                                termState.historyIndex--;
                                input.value = termState.commandHistory[termState.historyIndex];
                            }
                        } else if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            if (termState.historyIndex < termState.commandHistory.length - 1) {
                                termState.historyIndex++;
                                input.value = termState.commandHistory[termState.historyIndex];
                            } else {
                                termState.historyIndex = termState.commandHistory.length;
                                input.value = '';
                            }
                        }
                    });

                    // Android IME fallback: when the on-screen keyboard's Enter/Go/Send key is
                    // tapped, many Android IMEs (Gboard, Samsung Keyboard, etc.) don't surface a
                    // normal 'Enter' keydown at all. For a single-line <input>, the browser also
                    // never lets a literal newline land in .value, so a plain 'input' listener
                    // never sees it either. The reliable hook is 'beforeinput' with inputType
                    // 'insertLineBreak', which fires right before that (suppressed) edit.
                    input.addEventListener('beforeinput', async (e) => {
                        if (e.inputType !== 'insertLineBreak') return;
                        e.preventDefault();
                        if (termEnterHandled) { termEnterHandled = false; return; } // already handled by keydown
                        await processTermEnter();
                    });

                    termContainer.addEventListener('click', (e) => {
                        if(e.target.tagName !== 'TEXTAREA') input.focus();
                    });
                }, 100);
            }
        });
    }
})();
