// ==========================================
// up-down.js
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // --- Hooks for Upload & Download Features ---
    const uploadBtn = document.querySelector('.ri-upload-line[title="Upload"]');
    const downloadBtn = document.querySelector('.ri-download-line[title="Download"]');

    if(uploadBtn) uploadBtn.addEventListener('click', toggleUploadZone);
    if(downloadBtn) downloadBtn.addEventListener('click', toggleDownloadMode);

    setupUploadAndDownload();
});

// --- Upload & Download Logic ---

function toggleUploadZone() {
    const upZone = document.getElementById('explorerUploadZone');
    const dlZone = document.getElementById('explorerDownloadToolbar');
    const mainToolbar = document.querySelector('.file-browser-toolbar');

    if (upZone && dlZone && mainToolbar) {
        if (upZone.style.display === 'none') {
            upZone.style.display = 'flex';
            dlZone.style.display = 'none';
            isDownloadMultiSelectMode = false;
            updateDownloadState();
            mainToolbar.style.borderBottom = 'none';
        } else {
            upZone.style.display = 'none';
            mainToolbar.style.borderBottom = '';
        }
    }
}

function toggleDownloadMode() {
    const upZone = document.getElementById('explorerUploadZone');
    const dlZone = document.getElementById('explorerDownloadToolbar');
    const mainToolbar = document.querySelector('.file-browser-toolbar');
    
    isDownloadMultiSelectMode = !isDownloadMultiSelectMode;
    updateDownloadState();

    if (isDownloadMultiSelectMode) {
        if (dlZone) dlZone.style.display = 'flex';
        if (upZone) upZone.style.display = 'none';
        if (mainToolbar) mainToolbar.style.borderBottom = 'none';
    } else {
        if (dlZone) dlZone.style.display = 'none';
        if (mainToolbar) mainToolbar.style.borderBottom = '';
    }
}

function updateDownloadState() {
    const downloadBtn = document.querySelector('.ri-download-line[title="Download"]');
    if (downloadBtn) {
        downloadBtn.style.color = isDownloadMultiSelectMode ? 'var(--accent-new)' : 'var(--icon-gray)';
    }

    if (!isDownloadMultiSelectMode) {
        downloadSelectedFiles.clear();
        document.querySelectorAll('.file-item.download-selected-file').forEach(el => el.classList.remove('download-selected-file'));
    }
    updateDownloadToolbar();
}

function updateDownloadToolbar() {
    const rawBtn = document.getElementById('dlRawBtn');
    if (rawBtn) {
        rawBtn.disabled = downloadSelectedFiles.size === 0;
    }
}

function setupUploadAndDownload() {
    const zone = document.getElementById('explorerUploadZone');
    const input = document.getElementById('explorerUploadInput');
    
    if (zone && input) {
        zone.addEventListener('click', () => input.click());
        
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });
        
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        
        zone.addEventListener('drop', async (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const items = e.dataTransfer.items;
            if (items && items.length > 0) {
                await handleDropItems(items);
                toggleUploadZone();
            }
        });
        
        input.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                await processFileList(e.target.files);
                toggleUploadZone();
            }
            input.value = '';
        });
    }

    document.getElementById('dlRawBtn')?.addEventListener('click', handleDownloadRaw);
    document.getElementById('dlJsonBtn')?.addEventListener('click', handleDownloadJson);
    document.getElementById('dlZipBtn')?.addEventListener('click', handleDownloadZip);
}

// Reads a File as plain text (existing behavior) unless its extension is a
// known binary type, in which case it's read as base64 instead - reading
// binary content with file.text() silently corrupts it (UTF-8 decoding
// mangles arbitrary bytes), which is what made opening any image, video, or
// archive uploaded through this app broken from the moment it was uploaded.
async function readFileAsAppropriate(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const binaryExts = window.BINARY_FILE_EXTS || [];
    if (binaryExts.includes(ext)) {
        const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // reader.result is a data URL like "data:<mime>;base64,<payload>" -
                // store just the payload; the mime type is cheaply re-derivable
                // from the extension wherever it's needed (see getMimeTypeForExt).
                const result = reader.result;
                const commaIdx = result.indexOf(',');
                resolve(commaIdx !== -1 ? result.slice(commaIdx + 1) : result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        return { content: base64, encoding: 'base64' };
    }
    return { content: await file.text(), encoding: undefined };
}

// Recreate structured files and directories from Drag and Drop
async function handleDropItems(items) {
    const targetParentId = folderStack[folderStack.length - 1].id;
    // Captured now, synchronously, alongside targetParentId - reading files
    // below (entry.file(), FileReader, possibly many of them for a deep
    // folder drop) can take real time, and if the user switches windows
    // mid-upload, the module-level `db` will already point at the new
    // window's database by the time we get to actually writing. Passing
    // this captured reference through keeps the write targeted at the
    // window the upload was actually started in.
    const targetDb = db;
    let filesToSave = [];
    
    const readEntry = async (entry, currentPath) => {
        if (entry.isFile) {
            const file = await new Promise(r => entry.file(r));
            
            // Special handling: Native App JSON Restoration
            if (file.name.endsWith('.json') && currentPath === "") {
                const content = await file.text();
                try {
                    const data = JSON.parse(content);
                    if (Array.isArray(data) && data.length > 0 && data[0].id && data[0].type) {
                        await importJsonData(data, targetParentId, targetDb);
                        return; // Successfully handled directly
                    }
                } catch(e) {} // Not matching standard array format, handle as raw file
            }
            
            const { content, encoding } = await readFileAsAppropriate(file);
            filesToSave.push({ name: file.name, path: currentPath, type: 'file', content: content, encoding: encoding });
        } else if (entry.isDirectory) {
            filesToSave.push({ name: entry.name, path: currentPath, type: 'folder' });
            const reader = entry.createReader();
            
            const readEntriesPromise = async () => {
                let entries = [];
                let hasMore = true;
                while (hasMore) {
                    const batch = await new Promise(r => reader.readEntries(r));
                    if (batch.length === 0) hasMore = false;
                    else entries.push(...batch);
                }
                return entries;
            };
            
            const allEntries = await readEntriesPromise();
            for(let e of allEntries) {
                await readEntry(e, currentPath ? currentPath + '/' + entry.name : entry.name);
            }
        }
    };
    
    for(let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.webkitGetAsEntry) {
            const entry = item.webkitGetAsEntry();
            if (entry) await readEntry(entry, "");
        }
    }
    
    if (filesToSave.length > 0) {
        await saveExtractedFiles(filesToSave, targetParentId, targetDb);
    }
}

// Flat file lists from file input (Does not natively capture deep directories without webkitdirectory)
async function processFileList(files) {
    const targetParentId = folderStack[folderStack.length - 1].id;
    // See handleDropItems above for why this is captured synchronously here
    // rather than left for saveExtractedFiles/importJsonData to read fresh.
    const targetDb = db;
    let filesToSave = [];
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Native App JSON Restoration
        if (file.name.endsWith('.json')) {
            const content = await file.text();
            try {
                const data = JSON.parse(content);
                if (Array.isArray(data) && data.length > 0 && data[0].id && data[0].type) {
                    await importJsonData(data, targetParentId, targetDb);
                    continue; 
                }
            } catch(e) {}
        }
        
        const { content, encoding } = await readFileAsAppropriate(file);
        let path = file.webkitRelativePath || "";
        if (path) {
            const parts = path.split('/');
            parts.pop(); 
            path = parts.join('/');
        }
        filesToSave.push({ name: file.name, path: path, type: 'file', content: content, encoding: encoding });
    }
    if (filesToSave.length > 0) {
        await saveExtractedFiles(filesToSave, targetParentId, targetDb);
    }
}

async function saveExtractedFiles(filesToSave, rootParentId, explicitDb) {
    // Mirrors saveFileToDB's (app.js) executingDbInstance pattern: use the
    // db this operation was actually meant for (passed in by a caller that
    // captured it before its own async gap), falling back to the live
    // global only for callers with no such gap of their own.
    const executingDbInstance = explicitDb || db;
    const tx = executingDbInstance.transaction('filesystem', 'readwrite');
    const store = tx.objectStore('filesystem');
    
    return new Promise(resolve => {
        store.getAll().onsuccess = (ev) => {
            const existingFiles = ev.target.result || [];
            let pathMap = { "": rootParentId };
            
            const getOrCreatePath = (pathString) => {
                if (!pathString) return rootParentId;
                if (pathMap[pathString]) return pathMap[pathString];
                
                let currentPath = "";
                let currentParent = rootParentId;
                const parts = pathString.split('/');
                
                for (let dir of parts) {
                    currentPath = currentPath ? currentPath + '/' + dir : dir;
                    if (!pathMap[currentPath]) {
                        let newId = Date.now().toString() + Math.random().toString(36).substring(2);
                        // FIX: Auto-number folders dynamically during deep drops
                        let safeDirName = window.getUniqueFileName(existingFiles, currentParent, dir, 'folder');
                        
                        let newFolder = { id: newId, parentId: currentParent, name: safeDirName, type: 'folder', timestamp: Date.now() };
                        store.put(newFolder);
                        existingFiles.push(newFolder);
                        pathMap[currentPath] = newId;
                    }
                    currentParent = pathMap[currentPath];
                }
                return currentParent;
            };

            filesToSave.forEach(fItem => {
                let parentId = getOrCreatePath(fItem.path);
                let id = Date.now().toString() + Math.random().toString(36).substring(2);
                
                if (fItem.type === 'folder') {
                    let fullPath = fItem.path ? fItem.path + '/' + fItem.name : fItem.name;
                    if (!pathMap[fullPath]) {
                        let safeFolderName = window.getUniqueFileName(existingFiles, parentId, fItem.name, 'folder');
                        let newFolder = { id: id, parentId: parentId, name: safeFolderName, type: 'folder', timestamp: Date.now() };
                        pathMap[fullPath] = id;
                        store.put(newFolder);
                        existingFiles.push(newFolder);
                    }
                } else {
                    let safeFileName = window.getUniqueFileName(existingFiles, parentId, fItem.name, 'file');
                    let newFile = { id: id, parentId: parentId, name: safeFileName, type: 'file', content: fItem.content, encoding: fItem.encoding, timestamp: Date.now() };
                    store.put(newFile);
                    existingFiles.push(newFile);
                }
            });
        };

        tx.oncomplete = () => { 
            if (db === executingDbInstance) loadFilesFromDB();
            resolve();
        };
    });
}

// Robust JSON Restoration 
async function importJsonData(data, targetParentId, explicitDb) {
    const executingDbInstance = explicitDb || db;
    const tx = executingDbInstance.transaction('filesystem', 'readwrite');
    const store = tx.objectStore('filesystem');
    
    let idMap = {};
    let dataIds = new Set(data.map(d => d.id));
    
    data.forEach(item => {
        idMap[item.id] = Date.now().toString() + Math.random().toString(36).substring(2);
    });
    
    data.forEach(item => {
        let newItem = { ...item };
        newItem.id = idMap[item.id];
        
        // If parent exists in the imported JSON package, maintain relative hierarchy
        if (dataIds.has(item.parentId)) {
            newItem.parentId = idMap[item.parentId];
        } else {
            // It's a root level item of the import batch
            newItem.parentId = targetParentId;
        }
        newItem.timestamp = Date.now();
        store.put(newItem);
    });
    
    return new Promise(resolve => {
        tx.oncomplete = () => {
            if (db === executingDbInstance) loadFilesFromDB();
            resolve();
        };
    });
}

// Shared with editor.js/media.js: given a stored file record, reconstructs
// its real content as a Blob - decoding base64 back to actual binary bytes
// for binary files, or wrapping plain text as-is otherwise. Centralizes the
// "how do I get this file's real bytes back" logic so every download/player
// path handles base64 files identically instead of each needing its own
// decode logic (or, before this fix existed at all, silently treating the
// base64 string itself as if it were the file's literal text content).
window.getExtMimeType = function(ext) {
    const map = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
        webp: 'image/webp', ico: 'image/x-icon', bmp: 'image/bmp',
        mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', ogv: 'video/ogg', m4v: 'video/mp4',
        mkv: 'video/x-matroska', avi: 'video/x-msvideo',
        mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac',
        zip: 'application/zip', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed',
        tar: 'application/x-tar', gz: 'application/gzip', pdf: 'application/pdf',
        woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    return map[ext] || 'application/octet-stream';
};

window.fileRecordToBlob = function(fileData) {
    const ext = (fileData.name || '').split('.').pop().toLowerCase();
    if (fileData.encoding === 'base64') {
        const mime = window.getExtMimeType(ext);
        const binaryStr = atob(fileData.content || '');
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        return new Blob([bytes], { type: mime });
    }
    return new Blob([fileData.content || ''], { type: 'text/plain' });
};

async function handleDownloadRaw() {
    if (downloadSelectedFiles.size === 0) return;

    // Filter out folders and workspaces, keeping only actual files
    const filesToDownload = Array.from(downloadSelectedFiles).filter(
        f => f.type !== 'folder' && f.type !== 'workspace'
    );

    if (filesToDownload.length === 0) {
        if (window.showCustomModal) {
            window.showCustomModal({
                title: 'Error', 
                text: 'No downloadable files selected. Folders cannot be downloaded as Raw text.', 
                submitText: 'OK'
            }, () => {});
        }
        return;
    }

    const tx = db.transaction('filesystem', 'readonly');
    const store = tx.objectStore('filesystem');

    // Helper to fetch file data asynchronously
    const getFileData = (id) => new Promise(resolve => {
        store.get(id).onsuccess = (e) => resolve(e.target.result);
    });

    for (let i = 0; i < filesToDownload.length; i++) {
        const fileObj = filesToDownload[i];
        const fileData = await getFileData(fileObj.id);
        
        if (fileData) {
            const blob = window.fileRecordToBlob(fileData);
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = fileData.name;
            
            // Append to body, click, and remove (required for Firefox compatibility)
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Small delay to prevent the browser from blocking concurrent downloads
            await new Promise(r => setTimeout(r, 100));
            URL.revokeObjectURL(url);
        }
    }

    toggleDownloadMode(); 
}

async function handleDownloadJson() {
    if (downloadSelectedFiles.size === 0) return;
    const tx = db.transaction('filesystem', 'readonly');
    const allFiles = await new Promise(res => {
        tx.objectStore('filesystem').getAll().onsuccess = e => res(e.target.result);
    });

    const filesToExport = [];
    const addedIds = new Set();

    const addFileAndDescendants = (fileObj) => {
        if (addedIds.has(fileObj.id)) return;
        filesToExport.push(fileObj);
        addedIds.add(fileObj.id);

        if (fileObj.type === 'folder' || fileObj.type === 'workspace') {
            const children = allFiles.filter(f => f.parentId === fileObj.id);
            children.forEach(c => addFileAndDescendants(c));
        }
    };

    Array.from(downloadSelectedFiles).forEach(f => addFileAndDescendants(f));

    const blob = new Blob([JSON.stringify(filesToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `codemini_export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toggleDownloadMode();
}

async function handleDownloadZip() {
    if (downloadSelectedFiles.size === 0) return;

    // Captured before the JSZip CDN load below, which only happens once per
    // session but can take a moment - if the user switches windows while it's
    // loading, `db` would otherwise point at the new window by the time the
    // folder-children lookup below runs, silently zipping up empty folders
    // instead of the ones actually selected.
    const targetDb = db;

    if (typeof JSZip === 'undefined') {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    const tx = targetDb.transaction('filesystem', 'readonly');
    const allFiles = await new Promise(res => {
        tx.objectStore('filesystem').getAll().onsuccess = e => res(e.target.result);
    });

    const zip = new JSZip();

    const buildZip = (fileObj, currentFolder) => {
        if (fileObj.type === 'folder' || fileObj.type === 'workspace') {
            const newFolder = currentFolder.folder(fileObj.name);
            const children = allFiles.filter(f => f.parentId === fileObj.id);
            children.forEach(c => buildZip(c, newFolder));
        } else if (fileObj.encoding === 'base64') {
            currentFolder.file(fileObj.name, fileObj.content || '', { base64: true });
        } else {
            currentFolder.file(fileObj.name, fileObj.content || '');
        }
    };

    Array.from(downloadSelectedFiles).forEach(f => buildZip(f, zip));

    zip.generateAsync({ type: 'blob' }).then(content => {
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `codemini_archive_${Date.now()}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        toggleDownloadMode();
    });
}
