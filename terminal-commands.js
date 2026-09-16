// ==========================================
// terminal-commands.js
// ==========================================

window.getTerminalCommands = function(
    printTerm, dbGetDirFiles, getCurrentFolderId, dbGetAll, dbPut, dbDelete,
    updateCWD, getPathString, checkUnlock, blockBinary, executeFile,
    termState, saveState, clearState, termContainer, output, input, inputRow, formatBytes
) {
    
    // --- WORKSPACE SYNC ADAPTATION ---
    // Automatically adapts the terminal's starting directory to the current Explorer Workspace or active Split View profile
    if (!termState.workspaceSynced) {
        termState.workspaceSynced = true;
        if (typeof folderStack !== 'undefined' && folderStack && folderStack.length > 0 && termState.folderStack.length === 1 && termState.folderStack[0].id === 'root') {
            termState.folderStack = JSON.parse(JSON.stringify(folderStack));
            updateCWD();
        }
    }

    // Helper utility to strictly preserve spacing and ASCII art integrity
    const printPre = (text, color = 'var(--term-output-text)') => {
        printTerm(`<pre style="margin: 0; font-family: inherit; white-space: pre-wrap; word-break: break-all; color: ${color};">${text}</pre>`, true);
    };

    const commandDocs = {
        'ls': 'List directory contents (options: -a, -l, -h, -t)',
        'cd': 'Change working directory',
        'mkdir': 'Create directories (options: -p)',
        'touch': 'Create an empty file or update timestamp',
        'rm': 'Remove files or directories (options: -r, -f)',
        'mv': 'Move or rename a file/directory',
        'cp': 'Copy files or directories (options: -r)',
        'pwd': 'Print the current working directory',
        'chmod': 'Change file permissions (e.g., +x, -x, 755)',
        'tree': 'Display directory structure as a tree',
        'find': 'Search for files in the hierarchy',
        'cat': 'Print file content (options: -n)',
        'grep': 'Search text in files (options: -i, -v)',
        'head': 'Output the first part of files (options: -n)',
        'tail': 'Output the last part of files (options: -n)',
        'write': 'Write string content directly to a file',
        'mini': 'Open the lightweight text editor',
        'hexdump': 'Display file contents in hexadecimal',
        'sort': 'Sort lines of text files (Supports Pipe)',
        'uniq': 'Report or omit repeated lines (Supports Pipe)',
        'wc': 'Print newline, word, and byte counts (Supports Pipe)',
        'diff': 'Compare files line by line',
        'tar': 'Tape archive utility (options: -cf, -xf)',
        'zip': 'Package and compress files',
        'unzip': 'Extract compressed files',
        'markdown': 'Render a markdown file as HTML',
        'csv2json': 'Convert CSV data to JSON format',
        'json2csv': 'Convert JSON array to CSV format',
        'formatjson': 'Prettify and format a JSON file',
        'extracturls': 'Extract all URLs from a file',
        'minifyjs': 'Minify a JavaScript file',
        'clear': 'Clear the terminal screen',
        'history': 'Show command execution history',
        'whoami': 'Print effective user name',
        'hostname': 'Print the system hostname',
        'uname': 'Print system information',
        'ping': 'Send ICMP ECHO_REQUEST to network hosts',
        'curl': 'Transfer data from a URL',
        'wget': 'Download files from the web',
        'sysinfo': 'Display OS and browser hardware info',
        'uptime': 'Show current session uptime',
        'battery': 'Display device battery status',
        'storage': 'Show browser IndexedDB storage usage',
        'geolocate': 'Fetch current geographic coordinates',
        'weather': 'Fetch current weather info from wttr.in',
        'ps': 'Report a snapshot of the current processes',
        'kill': 'Terminate or signal a process',
        'jobs': 'List active background jobs',
        'fg': 'Move job to the foreground',
        'bg': 'Move job to the background',
        'ssh': 'Open SSH client connection (Stubbed)',
        'run': 'Execute a script or file natively',
        'sh': 'Execute a shell script natively',
        'bash': 'Execute a bash script natively',
        'zsh': 'Execute a zsh script natively',
        'js': 'Evaluate a JavaScript expression',
        'python': 'Execute a Python script (Pyodide)',
        'ruby': 'Execute a Ruby script (Opal)',
        'php': 'Execute a PHP script (php-wasm)',
        'npm': 'Install packages from unpkg to workspace',
        'open': 'Open file in the CodeMini text editor',
        'tabs': 'List all currently open editor tabs',
        'closetab': 'Close a specific open tab by name',
        'sync': 'Force sync terminal directory with active Explorer workspace',
        'help': 'Display this detailed help manual',
        'man': 'Format and display system manual pages',
        'exit': 'Close the terminal window',
        'echo': 'Print text to the terminal perfectly preserving spaces',
        'date': 'Print the current date and time',
        'calc': 'Evaluate a mathematical expression',
        'timer': 'Set a countdown timer in seconds',
        'urlencode': 'Encode a string for URLs',
        'urldecode': 'Decode a URL-encoded string',
        'base64': 'Encode/decode Base64 strings (options: -d)',
        'uuid': 'Generate a random UUIDv4 string',
        'roll': 'Roll a random number or dice (e.g., roll 100)',
        'rot13': 'Apply ROT13 cipher to a string',
        'cowsay': 'Display a message inside an ASCII cow',
        'qr': 'Generate a QR code from string data',
        'encrypt': 'AES-GCM encrypt a file with a password',
        'decrypt': 'AES-GCM decrypt a file with a password',
        'cmatrix': 'Display a falling text matrix animation',
        'alias': 'Define or display terminal aliases',
        'env': 'Display environment variables',
        'restart': 'Factory reset the terminal state'
    };

    const commands = {
        help: async () => {
            const categories = {
                'File System': ['ls', 'cd', 'mkdir', 'touch', 'rm', 'mv', 'cp', 'pwd', 'chmod', 'tree', 'find', 'tar', 'zip', 'unzip'],
                'Text & Data': ['cat', 'grep', 'head', 'tail', 'write', 'mini', 'hexdump', 'sort', 'uniq', 'wc', 'diff', 'markdown', 'csv2json', 'json2csv', 'formatjson', 'extracturls', 'minifyjs'],
                'System & Network': ['clear', 'history', 'whoami', 'hostname', 'uname', 'ping', 'curl', 'wget', 'sysinfo', 'uptime', 'battery', 'storage', 'geolocate', 'weather', 'ssh', 'ps', 'kill', 'jobs', 'fg', 'bg'],
                'Execution': ['run', 'sh', 'bash', 'zsh', 'js', 'python', 'ruby', 'php', 'npm', 'open', 'tabs', 'closetab'],
                'Utilities': ['sync', 'help', 'man', 'exit', 'echo', 'date', 'calc', 'timer', 'urlencode', 'urldecode', 'base64', 'uuid', 'roll', 'rot13', 'cowsay', 'qr', 'encrypt', 'decrypt', 'cmatrix', 'alias', 'env', 'restart']
            };

            let html = `<div style="color:#e5c07b; margin-bottom: 10px; font-weight: bold; font-size: 14px;">CodeMini Terminal Commands</div>`;
            
            for (const [category, cmds] of Object.entries(categories)) {
                html += `<div style="color:#c678dd; margin-top: 15px; font-weight: bold;">[ ${category} ]</div>`;
                html += `<table style="width: 100%; color: #61afef; margin-top: 5px; margin-bottom: 5px; font-size: 13px; border-spacing: 0 4px;">`;
                cmds.sort().forEach(c => {
                    html += `<tr><td style="width: 120px; vertical-align: top;"><b>${c}</b></td><td style="color: #abb2bf;">${commandDocs[c] || ''}</td></tr>`;
                });
                html += `</table>`;
            }
            printTerm(html, true);
        },
        man: async (args) => {
            if (!args[1]) return printTerm('What manual page do you want?');
            if (commandDocs[args[1]]) {
                printTerm(`<b>NAME</b><br>&nbsp;&nbsp;&nbsp;&nbsp;${args[1]} - ${commandDocs[args[1]]}<br><br><b>DESCRIPTION</b><br>&nbsp;&nbsp;&nbsp;&nbsp;Standard builtin IDE emulator implementation.`, true);
            } else { printTerm(`No manual entry for ${args[1]}`); }
        },
        clear: async () => { output.innerHTML = ''; },
        echo: async (args) => { 
            const cleanArgs = args.slice(1);
            printPre(cleanArgs.join(' ')); 
        },
        date: async () => { printTerm(new Date().toString()); },
        pwd: async () => { printTerm('/' + termState.folderStack.map(f => f.name).join('/')); },
        history: async () => { printTerm(termState.commandHistory.map((c, i) => `  ${i+1}  ${c}`).join('<br>'), true); },
        whoami: async () => { printTerm(termState.userName); },
        hostname: async () => { printTerm('codemini'); },
        sync: async (args) => {
            // Retrieve global workspaces array
            const workspaces = [{ id: 'root', name: 'CodeMini (Default Root)' }];
            if (window.workspacesList && window.workspacesList.length > 0) {
                workspaces.push(...window.workspacesList);
            }

            // If no number argument is provided, render the numbered list
            if (!args[1]) {
                let out = '<div style="color: var(--term-blue); font-weight: bold; margin-bottom: 5px;">Available Workspaces:</div>';
                workspaces.forEach((ws, i) => {
                    out += `<div>[${i}] <i class="ri-folder-5-line"></i> ${ws.name}</div>`;
                });
                out += '<div style="margin-top: 5px; color: var(--term-muted);">Usage: sync &lt;number&gt;</div>';
                return printTerm(out, true);
            }

            // Parse selection argument
            const idx = parseInt(args[1], 10);
            if (isNaN(idx) || idx < 0 || idx >= workspaces.length) {
                return printTerm('<span style="color:var(--term-red)">Invalid workspace number.</span>', true);
            }

            const targetWs = workspaces[idx];
            
            // 1. Sync Terminal's internal path tracking
            termState.folderStack = [{ id: targetWs.id, name: targetWs.id === 'root' ? 'CodeMini' : targetWs.name }];
            updateCWD();
            
            // 2. Sync Global Explorer UI & Database Target
            if (targetWs.id === 'root') {
                if (typeof initDatabase === 'function' && typeof cellActiveWindow !== 'undefined') {
                    initDatabase(cellActiveWindow.db, () => {
                        folderStack = [{ id: 'root', name: 'CodeMini' }];
                        if (typeof loadFilesFromDB === 'function') loadFilesFromDB();
                    });
                }
            } else {
                if (typeof initDatabase === 'function' && typeof cellActiveWindow !== 'undefined') {
                    const wsDb = targetWs.db || ('CodeMiniDB_WS_' + targetWs.id);
                    initDatabase(wsDb, () => {
                        folderStack = [{ id: targetWs.id, name: targetWs.name, isWorkspaceRoot: true, parentDb: cellActiveWindow.db }];
                        if (typeof loadFilesFromDB === 'function') loadFilesFromDB();
                    });
                }
            }

            printTerm(`<span style="color:var(--term-green)">Terminal and Explorer successfully synced to Workspace: ${targetWs.name}</span>`, true);
            printTerm('<span style="color:var(--icon-yellow)">Note: To fully bind terminal file creation operations to a new isolated workspace database, close and reopen this terminal tab.</span>', true);
        },

        uname: async (args) => {
            if (args.includes('-a')) printTerm('CodeMiniOS codemini 1.4.0 WebAssembly x86_64 GNU/Linux');
            else if (args.includes('-m')) printTerm('x86_64');
            else if (args.includes('-s')) printTerm('CodeMiniOS');
            else if (args.includes('-r')) printTerm('1.4.0');
            else printTerm('CodeMiniOS');
        },
        ping: async (args) => {
            if (!args[1]) return printTerm('Usage: ping <destination>');
            printTerm(`PING ${args[1]} (${args[1]}): 56 data bytes`);
            for (let i = 1; i <= 4; i++) {
                if (termState.interrupted) break;
                await new Promise(r => setTimeout(r, 800));
                printTerm(`64 bytes from ${args[1]}: icmp_seq=${i-1} ttl=116 time=${(Math.random() * 20 + 5).toFixed(1)} ms`);
            }
        },
        exit: async () => {
            const tabEl = termContainer.closest('.content-pane');
            if(tabEl) {
                const associatedTab = document.querySelector(`.tab[data-target="${tabEl.id}"]`);
                if(associatedTab && typeof closeTab === 'function') closeTab(associatedTab, tabEl, associatedTab.closest('.editor-group'));
            }
        },
        ls: async (args) => {
            const curId = getCurrentFolderId();
            let files = await dbGetDirFiles(curId);
            const isAll = args.some(a => a.startsWith('-') && a.includes('a'));
            const isLong = args.some(a => a.startsWith('-') && a.includes('l'));
            const isHuman = args.some(a => a.startsWith('-') && a.includes('h'));
            const isTimeSort = args.some(a => a.startsWith('-') && a.includes('t'));

            if (!isAll) files = files.filter(f => !f.name.startsWith('.'));
            if (isTimeSort) files.sort((a,b) => b.timestamp - a.timestamp);
            
            if (files.length === 0 && !isAll) return printTerm('');

            if (isLong) {
                let html = `<table style="width: 100%; border-collapse: collapse; color: #abb2bf;">`;
                if (isAll) {
                    html += `<tr><td>drwxr-xr-x</td><td>root</td><td>0</td><td>${new Date().toLocaleDateString()}</td><td style="color:#61afef">.</td></tr>`;
                    html += `<tr><td>drwxr-xr-x</td><td>root</td><td>0</td><td>${new Date().toLocaleDateString()}</td><td style="color:#61afef">..</td></tr>`;
                }
                for (const f of files) {
                    const isDir = f.type === 'folder' || f.type === 'workspace';
                    const perms = f.perms || (isDir ? 'drwxr-xr-x' : (f.isLocked ? '-r--------' : (f.name.endsWith('.sh') || f.name.endsWith('.js') ? '-rwxr-xr-x' : '-rw-r--r--')));
                    const sizeRaw = f.content ? new Blob([f.content]).size : 0;
                    const size = isHuman ? formatBytes(sizeRaw) : sizeRaw;
                    const date = new Date(f.timestamp).toLocaleDateString();
                    const color = f.isLocked ? '#e06c75' : (isDir ? '#61afef' : (perms.includes('x') ? '#98c379' : '#abb2bf'));
                    html += `<tr><td style="padding-right:15px; font-family: monospace;">${perms}</td><td style="padding-right:15px;">user</td><td style="padding-right:15px; font-family: monospace;">${size}</td><td style="padding-right:15px;">${date}</td><td style="color:${color};">${f.name}${isDir?'/':''}</td></tr>`;
                }
                html += `</table>`;
                printTerm(html, true);
            } else {
                let items = [];
                if(isAll) items.push(`<span style="color: #61afef;">./</span>`, `<span style="color: #61afef;">../</span>`);
                items = items.concat(files.map(f => {
                    const isDir = f.type === 'folder' || f.type === 'workspace';
                    const perms = f.perms || (isDir ? 'drwxr-xr-x' : (f.isLocked ? '-r--------' : (f.name.endsWith('.sh') || f.name.endsWith('.js') ? '-rwxr-xr-x' : '-rw-r--r--')));
                    if (f.isLocked) return `<span style="color: #e06c75;">${f.name}${isDir?'/':''}</span>`;
                    if (isDir) return `<span style="color: #61afef;">${f.name}/</span>`;
                    if (perms.includes('x')) return `<span style="color: #98c379;">${f.name}</span>`;
                    return `<span style="color: #abb2bf;">${f.name}</span>`;
                }));
                printTerm(items.join('&nbsp;&nbsp;&nbsp;&nbsp;'), true);
            }
        },
        cd: async (args) => {
            const target = args[1];
            if (!target || target === '~') { termState.folderStack = [termState.folderStack[0]]; updateCWD(); return; }
            if (target === '..') {
                if (termState.folderStack.length > 1) { termState.folderStack.pop(); updateCWD(); }
            } else {
                const files = await dbGetDirFiles(getCurrentFolderId());
                const found = files.find(f => f.name === target && (f.type === 'folder' || f.type === 'workspace'));
                if (found) {
                    if(!await checkUnlock(found)) return;
                    termState.folderStack.push({id: found.id, name: found.name}); updateCWD(); 
                } else { 
                    printTerm(`bash: cd: ${target}: No such directory`); 
                }
            }
            if(typeof loadFilesFromDB === 'function') loadFilesFromDB();
        },
        mkdir: async (args) => {
            const isParent = args.includes('-p');
            const targets = args.slice(1).filter(a => !a.startsWith('-'));
            if (targets.length === 0) return printTerm('mkdir: missing operand');
            
            for (const name of targets) {
                if (isParent && name.includes('/')) {
                    const parts = name.split('/');
                    let curParent = getCurrentFolderId();
                    for (const part of parts) {
                        if (!part) continue;
                        const files = await dbGetDirFiles(curParent);
                        let found = files.find(f => f.name === part && (f.type === 'folder' || f.type === 'workspace'));
                        if (!found) {
                            const newId = Date.now().toString() + Math.random().toString(36).substring(2);
                            await dbPut({ id: newId, parentId: curParent, name: part, type: 'folder', isLocked: false, content: "", perms: 'drwxr-xr-x', timestamp: Date.now() });
                            curParent = newId;
                        } else {
                            curParent = found.id;
                        }
                    }
                } else {
                    const fileObj = { id: Date.now().toString() + Math.random().toString(36).substring(2), parentId: getCurrentFolderId(), name: name, type: 'folder', isLocked: false, password: null, content: "", perms: 'drwxr-xr-x', timestamp: Date.now() };
                    await dbPut(fileObj);
                }
            }
        },
        touch: async (args) => {
            const targets = args.slice(1).filter(a => !a.startsWith('-'));
            if (targets.length === 0) return printTerm('touch: missing operand');
            
            for (const name of targets) {
                if (blockBinary(name, 'touch')) continue;
                const files = await dbGetDirFiles(getCurrentFolderId());
                let found = files.find(f => f.name === name);
                if (found) {
                    if (!await checkUnlock(found)) continue;
                    found.timestamp = Date.now(); await dbPut(found); 
                } else { 
                    const perms = (name.endsWith('.sh') || name.endsWith('.js') || name.endsWith('.py')) ? '-rwxr-xr-x' : '-rw-r--r--';
                    await dbPut({ id: Date.now().toString() + Math.random().toString(36).substring(2), parentId: getCurrentFolderId(), name: name, type: 'file', isLocked: false, password: null, content: "", perms: perms, timestamp: Date.now() }); 
                }
            }
        },
        chmod: async (args) => {
            if (args.length < 3) return printTerm('Usage: chmod <mode> <file>');
            const mode = args[1];
            const filename = args[2];
            const files = await dbGetDirFiles(getCurrentFolderId());
            const target = files.find(f => f.name === filename);
            
            if (!target) return printTerm(`chmod: cannot access '${filename}': No such file or directory`);
            if (!await checkUnlock(target)) return;

            if (!target.perms) {
                const isDir = target.type === 'folder' || target.type === 'workspace';
                target.perms = isDir ? 'drwxr-xr-x' : (target.name.endsWith('.sh') || target.name.endsWith('.js') || target.name.endsWith('.py') ? '-rwxr-xr-x' : '-rw-r--r--');
            }

            let newPerms = target.perms.split('');
            if (mode === '+x') {
                if(newPerms[3] === '-') newPerms[3] = 'x';
                if(newPerms[6] === '-') newPerms[6] = 'x';
                if(newPerms[9] === '-') newPerms[9] = 'x';
            } else if (mode === '-x') {
                if(newPerms[3] === 'x') newPerms[3] = '-';
                if(newPerms[6] === 'x') newPerms[6] = '-';
                if(newPerms[9] === 'x') newPerms[9] = '-';
            } else if (/^[0-7]{3}$/.test(mode)) {
                const octalToRwx = (oct) => {
                    const map = ['---','--x','-w-','-wx','r--','r-x','rw-','rwx'];
                    return map[parseInt(oct, 10)];
                };
                const typeChar = newPerms[0]; 
                newPerms = (typeChar + octalToRwx(mode[0]) + octalToRwx(mode[1]) + octalToRwx(mode[2])).split('');
            } else { return printTerm(`chmod: invalid mode: '${mode}'`); }

            target.perms = newPerms.join(''); target.timestamp = Date.now(); await dbPut(target);
        },
        cat: async (args) => {
            const isNumbered = args.includes('-n');
            const targets = args.slice(1).filter(a => !a.startsWith('-'));
            
            if (termState.envVars['STDIN'] !== undefined && targets.length === 0) {
                let text = termState.envVars['STDIN'].replace(/</g, '&lt;').replace(/>/g, '&gt;');
                if (isNumbered) {
                    text = text.split('\n').map((l, i) => `<span style="color:var(--term-muted);margin-right:10px;">${(i+1).toString().padStart(4, ' ')}</span> ${l}`).join('\n');
                }
                printPre(text);
                return;
            }

            if (targets.length === 0) return printTerm('cat: missing operand');
            
            for (const name of targets) {
                if (blockBinary(name, 'cat')) continue;
                const files = await dbGetDirFiles(getCurrentFolderId());
                const found = files.find(f => f.name === name && f.type === 'file');
                if (found) {
                    if (!await checkUnlock(found)) continue;
                    let text = (found.content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    if (isNumbered) {
                        text = text.split('\n').map((l, i) => `<span style="color:var(--term-muted);margin-right:10px;">${(i+1).toString().padStart(4, ' ')}</span> ${l}`).join('\n');
                    }
                    printPre(text);
                } else { printTerm(`cat: ${name}: No such file`); }
            }
        },
        grep: async (args) => {
            const isIgnoreCase = args.includes('-i');
            const isInvert = args.includes('-v');
            const cleanArgs = args.slice(1).filter(a => !a.startsWith('-'));
            
            if (cleanArgs.length < 1) return printTerm('Usage: grep [-i] [-v] <pattern> [file]');
            const pattern = cleanArgs[0];
            const filename = cleanArgs[1];
            
            let lines = [];

            if (termState.envVars['STDIN'] !== undefined && !filename) {
                lines = termState.envVars['STDIN'].split('\n');
            } else if (filename) {
                if (blockBinary(filename, 'grep')) return;
                const files = await dbGetDirFiles(getCurrentFolderId());
                const found = files.find(f => f.name === filename && f.type === 'file');
                if (!found) return printTerm(`grep: ${filename}: No such file`);
                if (!await checkUnlock(found)) return;
                lines = (found.content || '').split('\n');
            } else { return printTerm('Usage: grep [-i] [-v] <pattern> [file]'); }

            const matches = lines.filter(l => {
                let lineTxt = isIgnoreCase ? l.toLowerCase() : l;
                let patTxt = isIgnoreCase ? pattern.toLowerCase() : pattern;
                let hasMatch = lineTxt.includes(patTxt);
                return isInvert ? !hasMatch : hasMatch;
            });

            if (matches.length > 0) printPre(matches.map(m => m.replace(/</g, '&lt;').replace(/>/g, '&gt;')).join('\n'));
        },
        head: async (args) => {
            let linesToPrint = 10;
            let filename = args[1];
            if (args[1] === '-n' && args[2]) { linesToPrint = parseInt(args[2], 10); filename = args[3]; }

            let lines = [];
            if (termState.envVars['STDIN'] !== undefined && !filename) {
                lines = termState.envVars['STDIN'].split('\n');
            } else if (filename) {
                if (blockBinary(filename, 'head')) return;
                const files = await dbGetDirFiles(getCurrentFolderId());
                const found = files.find(f => f.name === filename && f.type === 'file');
                if (!found) return printTerm(`head: ${filename}: No such file`);
                if (!await checkUnlock(found)) return;
                lines = (found.content || '').split('\n');
            } else { return printTerm('Usage: head [-n lines] [file]'); }

            printPre(lines.slice(0, linesToPrint).map(l => l.replace(/</g, '&lt;').replace(/>/g, '&gt;')).join('\n'));
        },
        tail: async (args) => {
            let linesToPrint = 10;
            let filename = args[1];
            if (args[1] === '-n' && args[2]) { linesToPrint = parseInt(args[2], 10); filename = args[3]; }

            let lines = [];
            if (termState.envVars['STDIN'] !== undefined && !filename) {
                lines = termState.envVars['STDIN'].split('\n');
            } else if (filename) {
                if (blockBinary(filename, 'tail')) return;
                const files = await dbGetDirFiles(getCurrentFolderId());
                const found = files.find(f => f.name === filename && f.type === 'file');
                if (!found) return printTerm(`tail: ${filename}: No such file`);
                if (!await checkUnlock(found)) return;
                lines = (found.content || '').split('\n');
            } else { return printTerm('Usage: tail [-n lines] [file]'); }

            const start = Math.max(0, lines.length - linesToPrint);
            printPre(lines.slice(start).map(l => l.replace(/</g, '&lt;').replace(/>/g, '&gt;')).join('\n'));
        },
        sort: async (args) => {
            let lines = [];
            if (termState.envVars['STDIN'] !== undefined && !args[1]) {
                lines = termState.envVars['STDIN'].split('\n');
            } else if (args[1]) {
                if (blockBinary(args[1], 'sort')) return;
                const files = await dbGetDirFiles(getCurrentFolderId());
                const found = files.find(f => f.name === args[1] && f.type === 'file');
                if (!found) return printTerm(`sort: ${args[1]}: No such file`);
                if (!await checkUnlock(found)) return;
                lines = (found.content || '').split('\n');
            } else { return printTerm('Usage: sort [file]'); }

            lines = lines.sort();
            printPre(lines.map(l => l.replace(/</g, '&lt;').replace(/>/g, '&gt;')).join('\n'));
        },
        uniq: async (args) => {
            let lines = [];
            if (termState.envVars['STDIN'] !== undefined && !args[1]) {
                lines = termState.envVars['STDIN'].split('\n');
            } else if (args[1]) {
                if (blockBinary(args[1], 'uniq')) return;
                const files = await dbGetDirFiles(getCurrentFolderId());
                const found = files.find(f => f.name === args[1] && f.type === 'file');
                if (!found) return printTerm(`uniq: ${args[1]}: No such file`);
                if (!await checkUnlock(found)) return;
                lines = (found.content || '').split('\n');
            } else { return printTerm('Usage: uniq [file]'); }

            const uniqueLines = [...new Set(lines)];
            printPre(uniqueLines.map(l => l.replace(/</g, '&lt;').replace(/>/g, '&gt;')).join('\n'));
        },
        wc: async (args) => {
            let content = "";
            let name = "";
            if (termState.envVars['STDIN'] !== undefined && !args[1]) {
                content = termState.envVars['STDIN'];
            } else if (args[1]) {
                if (blockBinary(args[1], 'wc')) return;
                const files = await dbGetDirFiles(getCurrentFolderId());
                const found = files.find(f => f.name === args[1] && f.type === 'file');
                if (!found) return printTerm(`wc: ${args[1]}: No such file`);
                if (!await checkUnlock(found)) return;
                content = found.content || ''; name = args[1];
            } else { return printTerm('Usage: wc [file]'); }

            const lines = content === '' ? 0 : content.split('\n').length;
            const words = content === '' ? 0 : content.trim().split(/\s+/).length;
            const bytes = new Blob([content]).size;
            printPre(` ${lines}  ${words}  ${bytes} ${name}`);
        },
        diff: async (args) => {
            if (args.length < 3) return printTerm('Usage: diff <file1> <file2>');
            const files = await dbGetDirFiles(getCurrentFolderId());
            const f1 = files.find(f => f.name === args[1]);
            const f2 = files.find(f => f.name === args[2]);
            if (!f1) return printTerm(`diff: ${args[1]}: No such file`);
            if (!f2) return printTerm(`diff: ${args[2]}: No such file`);
            if (!await checkUnlock(f1) || !await checkUnlock(f2)) return;

            const lines1 = (f1.content || '').split('\n');
            const lines2 = (f2.content || '').split('\n');
            let diffHtml = '';
            const max = Math.max(lines1.length, lines2.length);

            for (let i = 0; i < max; i++) {
                if (lines1[i] !== lines2[i]) {
                    if (lines1[i] !== undefined) diffHtml += `<span style="color:var(--term-red)">- ${lines1[i].replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>\n`;
                    if (lines2[i] !== undefined) diffHtml += `<span style="color:var(--term-green)">+ ${lines2[i].replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>\n`;
                }
            }
            if (!diffHtml) diffHtml = 'Files are identical.';
            printPre(diffHtml);
        },
        tar: async (args) => {
            if (args[1] === '-cf' && args[2]) {
                const archiveName = args[2];
                const filesToArchive = args.slice(3);
                if (filesToArchive.length === 0) return printTerm('tar: missing file targets');
                const files = await dbGetDirFiles(getCurrentFolderId());
                let archiveData = {};
                for (let name of filesToArchive) {
                    let f = files.find(x => x.name === name);
                    if (f && f.type === 'file') archiveData[name] = f.content;
                }
                const perms = '-rw-r--r--';
                await dbPut({ id: Date.now().toString(), parentId: getCurrentFolderId(), name: archiveName, type: 'file', content: JSON.stringify(archiveData), perms, timestamp: Date.now() });
                printTerm(`Created tarball ${archiveName}`);
            } else if (args[1] === '-xf' && args[2]) {
                const files = await dbGetDirFiles(getCurrentFolderId());
                let f = files.find(x => x.name === args[2]);
                if (f && f.type === 'file') {
                    try {
                        let archiveData = JSON.parse(f.content);
                        for (let [name, content] of Object.entries(archiveData)) {
                            await dbPut({ id: Date.now().toString() + Math.random(), parentId: getCurrentFolderId(), name, type: 'file', content, perms: '-rw-r--r--', timestamp: Date.now() });
                        }
                        printTerm(`Extracted ${args[2]}`);
                    } catch(e) { printTerm(`tar: Error extracting. Invalid format.`); }
                } else { printTerm(`tar: ${args[2]}: Cannot open: No such file`); }
            } else { printTerm(`Usage: tar -cf archive.tar file1 file2... | tar -xf archive.tar`); }
        },
        zip: async (args) => {
            if (args.length < 3) return printTerm(`Usage: zip archive.zip file1 file2...`);
            const archiveName = args[1].endsWith('.zip') ? args[1] : args[1] + '.zip';
            const filesToArchive = args.slice(2);
            const files = await dbGetDirFiles(getCurrentFolderId());
            let archiveData = {};
            for (let name of filesToArchive) {
                let f = files.find(x => x.name === name);
                if (f && f.type === 'file') archiveData[name] = f.content;
            }
            await dbPut({ id: Date.now().toString(), parentId: getCurrentFolderId(), name: archiveName, type: 'file', content: JSON.stringify(archiveData), perms: '-rw-r--r--', timestamp: Date.now() });
            printTerm(`Added to zip archive ${archiveName}`);
        },
        unzip: async (args) => {
            if (!args[1]) return printTerm('Usage: unzip archive.zip');
            const files = await dbGetDirFiles(getCurrentFolderId());
            let f = files.find(x => x.name === args[1]);
            if (f && f.type === 'file') {
                try {
                    let archiveData = JSON.parse(f.content);
                    for (let [name, content] of Object.entries(archiveData)) {
                        await dbPut({ id: Date.now().toString() + Math.random(), parentId: getCurrentFolderId(), name, type: 'file', content, perms: '-rw-r--r--', timestamp: Date.now() });
                        printPre(`  inflating: ${name}`);
                    }
                } catch(e) { printTerm(`unzip: cannot find zipfile directory`); }
            } else { printTerm(`unzip: cannot find ${args[1]}`); }
        },
        rm: async (args) => {
            const isRecursive = args.some(a => a.startsWith('-') && a.includes('r'));
            const force = args.some(a => a.startsWith('-') && a.includes('f'));
            const targets = args.slice(1).filter(a => !a.startsWith('-'));
            if (targets.length === 0) return printTerm('rm: missing operand');
            
            const files = await dbGetDirFiles(getCurrentFolderId());
            
            const deleteDescendants = async (parentId, collected) => {
                const all = await dbGetAll();
                const children = all.filter(f => f.parentId === parentId);
                for (let c of children) {
                    if (c.type === 'folder' || c.type === 'workspace') await deleteDescendants(c.id, collected);
                    await dbDelete(c.id);
                    collected.push(c);
                }
            };

            for (const targetName of targets) {
                const found = files.find(f => f.name === targetName);
                if (found) {
                    if ((found.type === 'folder' || found.type === 'workspace') && !isRecursive) {
                        printTerm(`rm: cannot remove '${targetName}': Is a directory`);
                        continue;
                    }
                    if (!force && !await checkUnlock(found)) continue;
                    const deletedAt = Date.now();
                    const collected = [];
                    if (found.type === 'folder' || found.type === 'workspace') { await deleteDescendants(found.id, collected); }
                    await dbDelete(found.id);
                    if (window.recycleBin) {
                        found.deletedAt = deletedAt;
                        window.recycleBin.push(found);
                        collected.forEach(c => { c.deletedAt = deletedAt; window.recycleBin.push(c); });
                    }
                } else {
                    if (!force) printTerm(`rm: cannot remove '${targetName}': No such file or directory`);
                }
            }
        },
        mv: async (args) => {
            if(args.length < 3) return printTerm('mv: missing file operand');
            const files = await dbGetDirFiles(getCurrentFolderId());
            const src = files.find(f => f.name === args[1]);
            if(!src) return printTerm(`mv: cannot stat '${args[1]}': No such file or directory`);
            if (!await checkUnlock(src)) return;
            src.name = args[2]; src.timestamp = Date.now(); await dbPut(src);
        },
        cp: async (args) => {
            const isRecursive = args.some(a => a.startsWith('-') && a.includes('r'));
            const targets = args.slice(1).filter(a => !a.startsWith('-'));
            if(targets.length < 2) return printTerm('cp: missing file operand');
            
            const srcName = targets[0];
            const destName = targets[1];
            
            const files = await dbGetDirFiles(getCurrentFolderId());
            const src = files.find(f => f.name === srcName);
            if(!src) return printTerm(`cp: cannot stat '${srcName}': No such file or directory`);
            if (!await checkUnlock(src)) return;
            
            if ((src.type === 'folder' || src.type === 'workspace') && !isRecursive) {
                return printTerm(`cp: -r not specified; omitting directory '${srcName}'`);
            }

            if (src.type === 'folder' || src.type === 'workspace') {
                const allFiles = await dbGetAll();
                const filesToTransfer = [];
                const newFolderId = Date.now().toString() + Math.random().toString(36).substring(2);
                
                const getDescendants = (parentId, newParentId) => {
                    let children = allFiles.filter(f => f.parentId === parentId);
                    children.forEach(c => {
                        let newId = Date.now().toString() + Math.random().toString(36).substring(2);
                        let clone = {...c, id: newId, parentId: newParentId, timestamp: Date.now()};
                        filesToTransfer.push(clone);
                        if (c.type === 'folder' || c.type === 'workspace') getDescendants(c.id, newId);
                    });
                };
                
                const rootClone = {...src, id: newFolderId, name: destName, timestamp: Date.now()};
                filesToTransfer.push(rootClone);
                getDescendants(src.id, newFolderId);

                for(let f of filesToTransfer) await dbPut(f);
            } else {
                const copy = { ...src, id: Date.now().toString() + Math.random().toString(36).substring(2), name: destName, timestamp: Date.now() };
                await dbPut(copy);
            }
        },
        find: async (args) => {
            const term = args[1] || "";
            const allFiles = await dbGetAll();
            
            const getPath = (f) => {
                let path = f.name;
                let curr = f.parentId;
                while(curr && curr !== 'root' && curr !== 'workspace-root') {
                    let parent = allFiles.find(p => p.id === curr);
                    if(parent) { path = parent.name + '/' + path; curr = parent.parentId; }
                    else break;
                }
                return path;
            };
            
            const matches = allFiles.filter(f => f.name.includes(term));
            if(matches.length === 0) return printTerm('find: no matches found');
            printTerm(matches.map(m => getPath(m)).join('<br>'), true);
        },
        tree: async () => {
            const allFiles = await dbGetAll();
            const curId = getCurrentFolderId();
            let treeOutput = `<span style="color:#61afef">${termState.folderStack[termState.folderStack.length - 1].name}</span>\n`;
            
            const traverse = (parentId, prefix = '') => {
                const children = allFiles.filter(f => f.parentId === parentId).sort((a,b) => a.name.localeCompare(b.name));
                children.forEach((child, index) => {
                    const isLast = index === children.length - 1;
                    const connector = isLast ? '└── ' : '├── ';
                    
                    const isDir = child.type === 'folder' || child.type === 'workspace';
                    const color = child.isLocked ? '#e06c75' : (isDir ? '#61afef' : '#abb2bf');
                    
                    treeOutput += `${prefix}${connector}<span style="color:${color}">${child.name}</span>\n`;
                    if(isDir && !child.isLocked) traverse(child.id, prefix + (isLast ? '    ' : '│   '));
                });
            };
            traverse(curId);
            printPre(treeOutput);
        },
        open: async (args) => {
            if(!args[1]) return printTerm('open: missing operand');
            const files = await dbGetDirFiles(getCurrentFolderId());
            const target = files.find(f => f.name === args[1]);
            if(!target || target.type !== 'file') return printTerm(`open: ${args[1]}: No such file`);
            if (!await checkUnlock(target)) return;
            if(typeof openFileInTab === 'function') openFileInTab(target);
            printTerm(`Opened ${args[1]} in workspace.`);
        },
        write: async (args) => {
            if(args.length < 3) return printTerm('Usage: write <file> "<content>"');
            const filename = args[1]; 
            if (blockBinary(filename, 'write')) return;
            const content = args.slice(2).join(' ').replace(/^["']|["']$/g, '');
            const files = await dbGetDirFiles(getCurrentFolderId());
            let target = files.find(f => f.name === filename);
            
            if(target) { 
                if (!await checkUnlock(target)) return;
                target.content = content; target.timestamp = Date.now(); await dbPut(target); 
            } else { 
                const perms = (filename.endsWith('.sh') || filename.endsWith('.js') || filename.endsWith('.py')) ? '-rwxr-xr-x' : '-rw-r--r--';
                await dbPut({ id: Date.now().toString(), parentId: getCurrentFolderId(), name: filename, type: 'file', content: content, perms: perms, timestamp: Date.now() }); 
            }
        },
         curl: async (args) => {
            if(!args[1]) return printTerm('curl: no URL specified');
            try {
                printTerm('Fetching...', false);
                const url = args[1];
                // Using a CORS proxy to bypass browser frontend restrictions
                const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(url);
                const res = await fetch(proxyUrl);
                
                if(!res.ok) throw new Error(`HTTP ${res.status}`);
                
                const text = await res.text();
                printPre(text.substring(0, 1000).replace(/</g, '&lt;') + (text.length>1000?'\n...[TRUNCATED]':''));
            } catch (e) { 
                printTerm(`<span style="color:var(--term-red)">curl: (6) Could not resolve host or CORS proxy blocked: ${args[1]}</span>`, true); 
            }
        },
         wget: async (args) => {
            if(!args[1]) return printTerm('Usage: wget <url>');
            const url = args[1];
            // Clean query parameters off the filename if present
            const filename = url.split('/').pop().split('?')[0] || 'downloaded_file';
            
            try {
                printTerm(`Downloading from ${url}...`);
                // Using a CORS proxy to bypass browser frontend restrictions
                const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(url);
                const res = await fetch(proxyUrl);
                
                if(!res.ok) throw new Error(`HTTP ${res.status}`);
                
                const wgetExt = filename.split('.').pop().toLowerCase();
                let content, encoding;
                if (window.BINARY_FILE_EXTS && window.BINARY_FILE_EXTS.includes(wgetExt)) {
                    const blob = await res.blob();
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
                    content = await res.text();
                    encoding = undefined;
                }
                await dbPut({ id: Date.now().toString(), parentId: getCurrentFolderId(), name: filename, type: 'file', content: content, encoding: encoding, perms: '-rw-r--r--', timestamp: Date.now() });
                printTerm(`<span style="color:var(--term-green)">Saved successfully to ${filename}</span>`, true);
            } catch (e) { 
                printTerm('<span style="color:var(--term-red)">wget: Failed to download. The URL may be invalid or blocking proxies.</span>', true); 
            }
        },
        weather: async (args) => {
            const loc = args.slice(1).join('+');
            try {
                printTerm('Fetching weather...', false);
                // AT0 prevents User-Agent ANSI overrides, forces plain text layout, and limits to current conditions
                const res = await fetch(`https://wttr.in/${loc}?AT0`);
                let text = await res.text();
                // Filter out possible injected HTML/CSS from wttr.in if it detects a browser
                text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                           .replace(/<[^>]+>/g, '')
                           .replace(/&nbsp;/g, ' ');
                printPre(text.trim());
            } catch (e) {
                printTerm('<span style="color:var(--term-red)">weather: Failed to fetch weather data. Check connection or CORS.</span>', true);
            }
        },
        js: async (args) => {
            if(!args[1]) return printTerm('js: missing expression');
            try { const result = eval(args.slice(1).join(' ')); printTerm(result !== undefined ? result.toString() : 'undefined'); } 
            catch (e) { printTerm(`<span style="color:#e06c75;">Error: ${e.message}</span>`, true); }
        },
        python: async (args) => {
            if (args.length === 1) return printTerm('Usage: python <file.py> or python -c "code"');
            if (args[1] === '-c' && args[2]) {
                try {
                    if (typeof window.getPyodideInstance === 'undefined') throw new Error("Pyodide engine missing. Please open a Python console/notebook first.");
                    const py = await window.getPyodideInstance();
                    if (!py) throw new Error("Kernel not ready");
                    py.runPython(`import sys, io\nsys.stdout = io.StringIO()\nsys.stderr = io.StringIO()`);
                    await py.runPythonAsync(args.slice(2).join(' '));
                    const out = py.runPython("sys.stdout.getvalue()");
                    const err = py.runPython("sys.stderr.getvalue()");
                    if (out) printPre(out.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
                    if (err) printPre(err.replace(/</g, '&lt;').replace(/>/g, '&gt;'), 'var(--term-red)');
                } catch (e) { printTerm(`<span style="color:var(--term-red)">[Python Error] ${e.message}</span>`, true); }
            } else { await executeFile(args[1], args.slice(2)); }
        },
        php: async (args) => {
            if (args.length === 1) return printTerm('Usage: php <file.php> or php -r "code"');
            if (args[1] === '-r' && args[2]) {
                try {
                    if (!window.phpWebInstance) {
                        let module = await import('https://cdn.jsdelivr.net/npm/php-wasm/PhpWeb.mjs');
                        window.phpWebInstance = new module.PhpWeb();
                        window.phpWebInstance.addEventListener('output', (event) => { if(window._phpConsoleLines) window._phpConsoleLines.push(event.detail); });
                    }
                    window._phpConsoleLines = [];
                    let code = args.slice(2).join(' ').trim();
                    if (!code.startsWith('<?php')) code = `<?php\n${code}\n?>`;
                    await window.phpWebInstance.run(code);
                    const result = window._phpConsoleLines.join('').trim();
                    if (result) printPre(result.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
                } catch (e) { printTerm(`<span style="color:var(--term-red)">[PHP Error] ${e.message}</span>`, true); }
            } else { await executeFile(args[1], args.slice(2)); }
        },
        ruby: async (args) => {
            if (args.length === 1) return printTerm('Usage: ruby <file.rb> or ruby -e "code"');
            if (args[1] === '-e' && args[2]) {
                try {
                    if (!window.opalLoading && typeof window.Opal === 'undefined') {
                        const loadScript = (src) => new Promise(res => { const script = document.createElement('script'); script.src = src; script.onload = res; document.head.appendChild(script); });
                        window.opalLoading = (async () => { await loadScript("https://cdn.opalrb.com/opal/current/opal.min.js"); await loadScript("https://cdn.opalrb.com/opal/current/opal-parser.min.js"); })();
                    }
                    if (window.opalLoading) await window.opalLoading;
                    let out = []; const origLog = console.log; console.log = (...a) => out.push(a.join(' '));
                    window.Opal.eval(args.slice(2).join(' '));
                    console.log = origLog;
                    if (out.length) printPre(out.join('\n').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
                } catch(e) { printTerm(`<span style="color:var(--term-red)">[Ruby Error] ${e.message}</span>`, true); }
            } else { await executeFile(args[1], args.slice(2)); }
        },
        run: async (args) => {
            if (!args[1]) return printTerm('Usage: run <filename>');
            await executeFile(args[1], args.slice(2));
        },
        bash: async (args) => await commands.run(args),
        sh: async (args) => await commands.run(args),
        zsh: async (args) => await commands.run(args),
        env: async () => {
            if (Object.keys(termState.envVars).length === 0) return printTerm('No environment variables set.');
            let out = '';
            for (const [key, value] of Object.entries(termState.envVars)) out += `${key}=${value}\n`;
            printPre(out);
        },
        alias: async (args) => {
            if (args.length === 1) {
                let out = '';
                for (const [k, v] of Object.entries(termState.aliases)) out += `alias ${k}='${v}'\n`;
                return printPre(out);
            }
            const assignment = args.slice(1).join(' ').match(/^([a-zA-Z0-9_-]+)=(.+)$/);
            if (assignment) {
                termState.aliases[assignment[1]] = assignment[2].replace(/^['"]|['"]$/g, '');
                saveState();
            } else { printTerm('Usage: alias name="value"'); }
        },
        npm: async (args) => {
            if(args[1] !== 'install' || !args[2]) return printTerm('Usage: npm install <package>');
            const pkg = args[2]; printTerm(`Fetching ${pkg} from unpkg...`);
            try {
                const res = await fetch(`https://unpkg.com/${pkg}`);
                if(!res.ok) throw new Error('Not found');
                const code = await res.text(); const filename = `${pkg}.js`;
                const files = await dbGetDirFiles(getCurrentFolderId());
                let target = files.find(f => f.name === filename);
                if(target) { 
                    if (!await checkUnlock(target)) return;
                    target.content = code; target.timestamp = Date.now(); await dbPut(target); 
                } else { 
                    await dbPut({ id: Date.now().toString(), parentId: getCurrentFolderId(), name: filename, type: 'file', content: code, perms: '-rw-r--r--', timestamp: Date.now() }); 
                }
                printTerm(`<span style="color:#4caf50;">Successfully installed ${pkg} to ${filename}</span>`, true);
            } catch(e) { printTerm(`<span style="color:#e06c75;">Error: Could not resolve package '${pkg}'</span>`, true); }
        },

        /* --- Re-Worked Mini Text Editor (No S&R) --- */
        mini: async (args) => {
            if (!args[1]) return printTerm('mini: missing filename');
            const filename = args[1];
            if (blockBinary(filename, 'mini')) return;

            const files = await dbGetDirFiles(getCurrentFolderId());
            let target = files.find(f => f.name === filename);
            if (target && !await checkUnlock(target)) return;

            let content = target ? (target.content || '') : '';
            let historyStack = [content];
            let historyIndex = 0;

            const saveStateToHistory = (val) => {
                if (historyStack[historyIndex] !== val) {
                    historyStack = historyStack.slice(0, historyIndex + 1);
                    historyStack.push(val);
                    historyIndex++;
                }
            };

            output.style.display = 'none';
            inputRow.style.display = 'none';

            const miniUi = document.createElement('div');
            miniUi.style.cssText = "position:absolute; top:0; left:0; right:0; bottom:0; background: var(--term-output-bg); z-index:100; display:flex; flex-direction:column; padding:10px; height: 100%; width: 100%; box-sizing: border-box;";
            
            const header = document.createElement('div');
            header.style.cssText = "background:#333; color:#fff; text-align:center; padding:5px; font-weight:bold; border-radius: 2px; flex-shrink: 0; word-wrap: break-word; white-space: normal;";
            header.textContent = `GNU mini (CodeMini) - ${filename}`;
            
            const textarea = document.createElement('textarea');
            textarea.style.cssText = "flex:1; background:transparent; color:#d4d4d4; font-family:monospace; font-size:13px; border:none; outline:none; resize:none; margin-top:10px; width: 100%; white-space: pre-wrap; word-wrap: break-word; overflow-y: auto; overflow-x: hidden; padding-bottom: 10px;";
            textarea.value = content;
            textarea.spellcheck = false;

            const footer = document.createElement('div');
            footer.style.cssText = "background: #333; color: #fff; padding: 8px 10px; display: flex; justify-content: space-between; margin-top: 10px; flex-shrink: 0; border-radius: 2px; align-items: center; font-size:12px; flex-wrap: wrap; gap: 8px; height: auto; white-space: normal;";
            
            footer.innerHTML = `
                <div style="display:flex; gap:12px; flex-wrap: wrap;">
                    <span id="miniBtnSave" style="cursor:pointer; padding:2px; white-space: nowrap;"><b>^S</b> Save</span>
                    <span id="miniBtnExit" style="cursor:pointer; padding:2px; white-space: nowrap;"><b>^X</b> Exit</span>
                    <span id="miniBtnUndo" style="cursor:pointer; padding:2px; white-space: nowrap;"><b>^Z</b> Undo</span>
                    <span id="miniBtnRedo" style="cursor:pointer; padding:2px; white-space: nowrap;"><b>^Y</b> Redo</span>
                </div>
                <div id="miniSaveStatus" style="color:#98c379; font-weight:bold; margin-left: auto;"></div>
            `;

            miniUi.appendChild(header); miniUi.appendChild(textarea); miniUi.appendChild(footer);
            termContainer.appendChild(miniUi);
            textarea.focus();

            return new Promise(resolve => {
                const cleanup = () => {
                    miniUi.remove(); output.style.display = 'flex'; inputRow.style.display = 'flex'; input.focus(); resolve();
                };

                const doSave = async () => {
                    if(target) { target.content = textarea.value; target.timestamp = Date.now(); await dbPut(target); }
                    else { 
                        const perms = (filename.endsWith('.sh') || filename.endsWith('.js') || filename.endsWith('.py')) ? '-rwxr-xr-x' : '-rw-r--r--';
                        target = { id: Date.now().toString(), parentId: getCurrentFolderId(), name: filename, type: 'file', content: textarea.value, perms: perms, timestamp: Date.now() }; 
                        await dbPut(target); 
                    }
                    const sStatus = footer.querySelector('#miniSaveStatus');
                    sStatus.textContent = "Saved";
                    setTimeout(() => sStatus.textContent = "", 2000);
                };

                footer.querySelector('#miniBtnSave').onclick = async () => await doSave();
                footer.querySelector('#miniBtnExit').onclick = () => cleanup();
                footer.querySelector('#miniBtnUndo').onclick = () => {
                    if (historyIndex > 0) { historyIndex--; textarea.value = historyStack[historyIndex]; }
                };
                footer.querySelector('#miniBtnRedo').onclick = () => {
                    if (historyIndex < historyStack.length - 1) { historyIndex++; textarea.value = historyStack[historyIndex]; }
                };

                textarea.addEventListener('keydown', async (e) => {
                    if (e.key === 'Tab') {
                        e.preventDefault();
                        const start = textarea.selectionStart; const end = textarea.selectionEnd;
                        textarea.value = textarea.value.substring(0, start) + "    " + textarea.value.substring(end);
                        textarea.selectionStart = textarea.selectionEnd = start + 4;
                    }
                    if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); await doSave(); }
                    if (e.ctrlKey && e.key.toLowerCase() === 'x') { e.preventDefault(); cleanup(); }
                    
                    if (e.ctrlKey && e.key.toLowerCase() === 'z') {
                        e.preventDefault();
                        if (historyIndex > 0) { historyIndex--; textarea.value = historyStack[historyIndex]; }
                    }
                    if (e.ctrlKey && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
                        e.preventDefault();
                        if (historyIndex < historyStack.length - 1) { historyIndex++; textarea.value = historyStack[historyIndex]; }
                    }

                    if (e.key === ' ' || e.key === 'Enter') saveStateToHistory(textarea.value);
                });

                textarea.addEventListener('input', () => {
                    clearTimeout(textarea.historyTimeout);
                    textarea.historyTimeout = setTimeout(() => saveStateToHistory(textarea.value), 800);
                });
            });
        },
        cmatrix: async () => {
            const canvas = document.createElement('canvas');
            canvas.style.cssText = "position:absolute; top:0; left:0; right:0; bottom:0; background:#000; z-index:100; width:100%; height:100%;";
            termContainer.appendChild(canvas);
            const ctx = canvas.getContext('2d');
            canvas.width = termContainer.clientWidth; canvas.height = termContainer.clientHeight;
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*".split('');
            const fontSize = 14; const columns = canvas.width / fontSize;
            const drops = Array(Math.floor(columns)).fill(1);

            const interval = setInterval(() => {
                if (!document.body.contains(canvas)) {
                    clearInterval(interval); window.removeEventListener('keydown', end); return;
                }
                ctx.fillStyle = "rgba(0, 0, 0, 0.05)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = "#0F0"; ctx.font = fontSize + "px monospace";
                for(let i=0; i<drops.length; i++) {
                    const text = chars[Math.floor(Math.random() * chars.length)];
                    ctx.fillText(text, i*fontSize, drops[i]*fontSize);
                    if(drops[i]*fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
                    drops[i]++;
                }
            }, 50);

            let end; return new Promise(resolve => {
                end = (e) => {
                    if(e.key.toLowerCase() === 'q' || (e.ctrlKey && e.key.toLowerCase() === 'c')) {
                        clearInterval(interval); canvas.remove(); window.removeEventListener('keydown', end); input.focus(); resolve();
                    }
                };
                window.addEventListener('keydown', end);
            });
        },
        battery: async () => {
            if(!navigator.getBattery) return printTerm('Battery API not supported in this browser.');
            const bat = await navigator.getBattery();
            printTerm(`Level: ${Math.round(bat.level * 100)}%<br>Charging: ${bat.charging ? 'Yes' : 'No'}`, true);
        },
        geolocate: async () => {
            return new Promise(resolve => {
                if(!navigator.geolocation) { printTerm("Geolocation not supported."); return resolve(); }
                printTerm("Requesting location...");
                navigator.geolocation.getCurrentPosition(pos => { printTerm(`Lat: ${pos.coords.latitude}, Lon: ${pos.coords.longitude}`); resolve(); }, err => { printTerm(`Error: ${err.message}`); resolve(); });
            });
        },
        storage: async () => {
            if(!navigator.storage || !navigator.storage.estimate) return printTerm('Storage API not supported.');
            const est = await navigator.storage.estimate();
            const used = (est.usage / 1024 / 1024).toFixed(2); const total = (est.quota / 1024 / 1024).toFixed(2);
            printTerm(`Storage Used: ${used} MB / ${total} MB`);
        },
        tabs: async () => {
            const tabs = Array.from(document.querySelectorAll('.tab span')).map(t => t.textContent);
            if(tabs.length === 0) return printTerm('No tabs open.');
            printTerm(tabs.map((t, i) => `${i+1}. ${t}`).join('<br>'), true);
        },
        closetab: async (args) => {
            if(!args[1]) return printTerm('closetab: missing tab name');
            const targetName = args.slice(1).join(' ');
            const tabs = Array.from(document.querySelectorAll('.tab'));
            const tab = tabs.find(t => t.querySelector('span').textContent.toLowerCase() === targetName.toLowerCase());
            if(tab && typeof closeTab === 'function') {
                closeTab(tab, document.getElementById(tab.dataset.target), tab.closest('.editor-group')); printTerm(`Closed tab: ${targetName}`);
            } else { printTerm(`Tab '${targetName}' not found.`); }
        },
        sysinfo: async () => {
            const cores = navigator.hardwareConcurrency || 'Unknown'; const mem = navigator.deviceMemory || 'Unknown';
            printTerm(`OS/Browser: ${navigator.userAgent}<br>Logical Cores: ${cores}<br>Device Memory: ~${mem}GB`, true);
        },
        uptime: async () => {
            const ms = performance.now(); const secs = Math.floor(ms / 1000); const mins = Math.floor(secs / 60);
            printTerm(`Session Uptime: ${mins}m ${secs % 60}s`);
        },
        urlencode: async (args) => {
            if(!args[1]) return printTerm('urlencode: missing text');
            printTerm(encodeURIComponent(args.slice(1).join(' ')));
        },
        urldecode: async (args) => {
            if(!args[1]) return printTerm('urldecode: missing text');
            printTerm(decodeURIComponent(args.slice(1).join(' ')));
        },
        base64: async (args) => {
            if (!args[1]) return printTerm('Usage: base64 [-d] <string>');
            try {
                if (args[1] === '-d' && args[2]) printTerm(atob(args.slice(2).join(' ')));
                else printTerm(btoa(args.slice(1).join(' ')));
            } catch(e) { printTerm('base64: invalid input'); }
        },
        uuid: async () => {
            if (typeof crypto.randomUUID === 'function') {
                printTerm(crypto.randomUUID());
            } else {
                // Fallback for older environments
                const uuid = "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
                    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
                );
                printTerm(uuid);
            }
        },
        roll: async (args) => {
            let max = 100;
            if (args[1] && !isNaN(parseInt(args[1], 10))) max = parseInt(args[1], 10);
            const result = Math.floor(Math.random() * max) + 1;
            printTerm(`Rolled a ${max}-sided die: <span style="color:var(--term-green); font-weight:bold;">${result}</span>`, true);
        },
        rot13: async (args) => {
            if (!args[1]) return printTerm('Usage: rot13 <string>');
            const input = args.slice(1).join(' ');
            const output = input.replace(/[a-zA-Z]/g, c => {
                const base = c <= 'Z' ? 65 : 97;
                return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
            });
            printTerm(output);
        },
        cowsay: async (args) => {
            const msg = args.slice(1).join(' ') || 'Moo';
            const dash = '-'.repeat(msg.length + 2);
            const cow = `
 ${dash}
< ${msg} >
 ${dash}
        \\   ^__^
         \\  (oo)\\_______
            (__)\\       )\\/\\
                ||----w |
                ||     ||`;
            printPre(cow.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        },
        qr: async (args) => {
            if(!args[1]) return printTerm('qr: missing data string');
            const text = encodeURIComponent(args.slice(1).join(' '));
            const url = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${text}`;
            printTerm(`<img src="${url}" style="margin-top:10px; border-radius:4px;"/>`, true);
        },
        encrypt: async (args) => {
            if(args.length < 3) return printTerm('Usage: encrypt <file> <password>');
            if(blockBinary(args[1], 'encrypt')) return;
            const files = await dbGetDirFiles(getCurrentFolderId());
            const target = files.find(f => f.name === args[1]);
            if(!target || target.type !== 'file') return printTerm(`encrypt: ${args[1]}: No such file`);
            if(!await checkUnlock(target)) return;
            try {
                const pass = args.slice(2).join(' ').padEnd(32, '0').slice(0,32);
                const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), {name: "AES-GCM"}, false, ["encrypt"]);
                const iv = crypto.getRandomValues(new Uint8Array(12));
                const enc = await crypto.subtle.encrypt({name: "AES-GCM", iv: iv}, key, new TextEncoder().encode(target.content));
                target.content = JSON.stringify({iv: Array.from(iv), data: Array.from(new Uint8Array(enc))});
                await dbPut(target); printTerm(`Encrypted ${args[1]}`);
            } catch(e) { printTerm(`Encryption failed: ${e.message}`); }
        },
        decrypt: async (args) => {
            if(args.length < 3) return printTerm('Usage: decrypt <file> <password>');
            if(blockBinary(args[1], 'decrypt')) return;
            const files = await dbGetDirFiles(getCurrentFolderId());
            const target = files.find(f => f.name === args[1]);
            if(!target || target.type !== 'file') return printTerm(`decrypt: ${args[1]}: No such file`);
            if(!await checkUnlock(target)) return;
            try {
                const pass = args.slice(2).join(' ').padEnd(32, '0').slice(0,32);
                const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), {name: "AES-GCM"}, false, ["decrypt"]);
                const payload = JSON.parse(target.content);
                const dec = await crypto.subtle.decrypt({name: "AES-GCM", iv: new Uint8Array(payload.iv)}, key, new Uint8Array(payload.data));
                target.content = new TextDecoder().decode(dec);
                await dbPut(target); printTerm(`Decrypted ${args[1]}`);
            } catch(e) { printTerm(`Decryption failed (Wrong password or corrupted).`); }
        },
        markdown: async (args) => {
            if(!args[1]) return printTerm('markdown: missing file');
            if(blockBinary(args[1], 'markdown')) return;
            const files = await dbGetDirFiles(getCurrentFolderId());
            const target = files.find(f => f.name === args[1]);
            if(!target || target.type !== 'file') return printTerm(`markdown: ${args[1]}: No such file`);
            if(!await checkUnlock(target)) return;
            let html = (target.content || '')
                .replace(/^### (.*$)/gim, '<h3>$1</h3>').replace(/^## (.*$)/gim, '<h2>$1</h2>').replace(/^# (.*$)/gim, '<h1>$1</h1>')
                .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>').replace(/\*(.*)\*/gim, '<i>$1</i>').replace(/\n/gim, '<br>');
            printTerm(`<div style="background:#fff; color:#000; padding:10px; border-radius:4px;">${html}</div>`, true);
        },
        csv2json: async (args) => {
            if(!args[1]) return printTerm('Usage: csv2json <file.csv>');
            if(blockBinary(args[1], 'csv2json')) return;
            const files = await dbGetDirFiles(getCurrentFolderId());
            const target = files.find(f => f.name === args[1]);
            if(!target || target.type !== 'file') return printTerm(`File not found.`);
            if(!await checkUnlock(target)) return;
            const lines = (target.content || '').split('\n');
            const headers = lines[0].split(',');
            const result = lines.slice(1).map(line => {
                const obj = {}; const curline = line.split(',');
                headers.forEach((h, i) => obj[h.trim()] = curline[i] ? curline[i].trim() : '');
                return obj;
            });
            await dbPut({ id: Date.now().toString(), parentId: getCurrentFolderId(), name: args[1].replace('.csv', '.json'), type: 'file', content: JSON.stringify(result, null, 2), timestamp: Date.now() });
            printTerm(`Converted to ${args[1].replace('.csv', '.json')}`);
        },
        json2csv: async (args) => {
            if(!args[1]) return printTerm('Usage: json2csv <file.json>');
            if(blockBinary(args[1], 'json2csv')) return;
            const files = await dbGetDirFiles(getCurrentFolderId());
            const target = files.find(f => f.name === args[1]);
            if(!target || target.type !== 'file') return printTerm(`File not found.`);
            if(!await checkUnlock(target)) return;
            try {
                const arr = JSON.parse(target.content); if(!arr.length) throw new Error();
                const headers = Object.keys(arr[0]).join(','); const rows = arr.map(obj => Object.values(obj).join(',')).join('\n');
                await dbPut({ id: Date.now().toString(), parentId: getCurrentFolderId(), name: args[1].replace('.json', '.csv'), type: 'file', content: headers + '\n' + rows, timestamp: Date.now() });
                printTerm(`Converted to ${args[1].replace('.json', '.csv')}`);
            } catch(e) { printTerm(`Invalid JSON array format.`); }
        },
        formatjson: async (args) => {
            if(!args[1]) return printTerm('Usage: formatjson <file.json>');
            if(blockBinary(args[1], 'formatjson')) return;
            const files = await dbGetDirFiles(getCurrentFolderId());
            const target = files.find(f => f.name === args[1]);
            if(!target || target.type !== 'file') return printTerm(`File not found.`);
            if(!await checkUnlock(target)) return;
            try {
                target.content = JSON.stringify(JSON.parse(target.content), null, 4);
                await dbPut(target); printTerm(`Formatted ${args[1]}`);
            } catch(e) { printTerm(`Invalid JSON.`); }
        },
        extracturls: async (args) => {
            if(!args[1]) return printTerm('Usage: extracturls <file>');
            if(blockBinary(args[1], 'extracturls')) return;
            const files = await dbGetDirFiles(getCurrentFolderId());
            const target = files.find(f => f.name === args[1]);
            if(!target || target.type !== 'file') return printTerm(`File not found.`);
            if(!await checkUnlock(target)) return;
            const urls = (target.content || '').match(/https?:\/\/[^\s]+/g);
            if(urls) printTerm(urls.join('<br>'), true); else printTerm('No URLs found.');
        },
        minifyjs: async (args) => {
            if(!args[1]) return printTerm('Usage: minifyjs <file.js>');
            if(blockBinary(args[1], 'minifyjs')) return;
            const files = await dbGetDirFiles(getCurrentFolderId());
            const target = files.find(f => f.name === args[1]);
            if(!target || target.type !== 'file') return printTerm(`File not found.`);
            if(!await checkUnlock(target)) return;
            target.content = target.content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g,'').replace(/\s+/g,' ').trim();
            await dbPut(target); printTerm(`Minified ${args[1]}`);
        },
        timer: async (args) => {
            const secs = parseInt(args[1]);
            if(isNaN(secs) || secs <= 0) return printTerm('Usage: timer <seconds>');
            printTerm(`Timer set for ${secs} seconds.`);
            return new Promise(resolve => {
                let current = 0;
                const int = setInterval(() => {
                    if (termState.interrupted) { clearInterval(int); return resolve(); }
                    current++;
                    if (current >= secs) {
                        clearInterval(int); printTerm(`<span style="color:#fbc02d; font-weight:bold;">TIMER DONE (${secs}s)</span>`, true); resolve();
                    }
                }, 1000);
            });
        },
        restart: async () => {
            if (typeof clearState === 'function') clearState();
            termState.commandHistory = []; termState.folderStack = [{ id: 'root', name: 'CodeMini' }]; 
            termState.aliases = { 'ted': 'mini', 'nan': 'mini', 'edit': 'mini', 'll': 'ls -l', 'la': 'ls -la', 'cls': 'clear' }; termState.envVars = {};
            output.innerHTML = ''; printTerm('<div style="color: #4caf50;">CodeMini Terminal Environment v1.0.0</div><div style="margin-bottom: 8px; color: #9e9e9e;">Terminal wiped and restarted.</div>', true); updateCWD();
        },
        calc: async (args) => {
            if(!args[1]) return printTerm('calc: missing expression');
            try {
                const expression = args.slice(1).join('').replace(/[^0-9+\-*/().]/g, '');
                const result = new Function(`return ${expression}`)(); printTerm(result.toString());
            } catch (e) { printTerm(`<span style="color:#e06c75;">Invalid expression</span>`, true); }
        },
        hexdump: async (args) => {
            if(!args[1]) return printTerm('hexdump: missing file');
            if(blockBinary(args[1], 'hexdump')) return;
            const files = await dbGetDirFiles(getCurrentFolderId());
            const target = files.find(f => f.name === args[1]);
            if(!target || target.type !== 'file') return printTerm(`hexdump: ${args[1]}: No such file`);
            if(!await checkUnlock(target)) return;
            const str = (target.content || '').slice(0, 256); let hex = '';
            for (let i = 0; i < str.length; i++) {
                hex += str.charCodeAt(i).toString(16).padStart(2, '0') + ' ';
                if ((i+1) % 16 === 0) hex += '\n';
            }
            if(str.length === 256) hex += '\n... [TRUNCATED]';
            printPre(hex, '#abb2bf');
        },

        /* --- Job / Process Mocking --- */
        ps: async () => { printPre('  PID TTY          TIME CMD\n   13 pts/0    00:00:00 bash\n   19 pts/0    00:00:00 ps'); },
        kill: async (args) => { 
            if (!args[1]) printTerm('kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ...');
            else printTerm(`kill: (${args[1]}) - No such process`);
        },
        jobs: async () => { printTerm('No active jobs. Job control is emulated.'); },
        fg: async () => { printTerm('bash: fg: current: no such job'); },
        bg: async () => { printTerm('bash: bg: current: no such job'); },
        ssh: async (args) => {
            if (!args[1]) return printTerm('Usage: ssh user@hostname');
            printTerm(`ssh: connect to host ${args[1]} port 22: Connection refused (Cross-Origin / TCP bounds restricted by browser)`);
        }
    };

    return { commandDocs, commands };
};
