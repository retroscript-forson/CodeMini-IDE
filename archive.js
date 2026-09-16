// ==========================================
// archive.js (Archive Viewer Tab)
// ==========================================
// Renders a real file-tree browser for archive files (.zip, .rar, .7z,
// .tar, .gz) instead of the generic "cannot be displayed" binary
// placeholder. Uses archive-wasm (https://github.com/HeavenVolkoff/archive-wasm),
// a WASM build of libarchive that reads all five formats through one API,
// loaded on demand via esm.sh - the same on-demand-CDN-script pattern
// already used for WebR and Opal elsewhere in this app, since this codebase
// loads third-party libraries as needed rather than bundling them upfront.
//
// Depends on window.fileRecordToBlob / window.getExtMimeType (up-down.js)
// for previewing individual entries, and window.saveExtractedFiles
// (up-down.js) for Extract All - reusing the exact same folder
// reconstruction logic already used by folder uploads, rather than
// duplicating it a fifth time.

window._archiveViewers = window._archiveViewers || {}; // per-pane state: { entries, objectUrls }

// Returns the static shell for an archive tab's pane. The file tree isn't
// built here - at this point the pane isn't in the real DOM yet, and
// reading + parsing the archive is async. See initArchiveViewer.
window.getArchiveViewerHTML = function(file) {
    const escapedName = (file.name || 'archive').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `
    <div class="archive-viewer-wrapper" style="flex: 1; display: flex; flex-direction: column; min-height: 0; background: var(--bg-white);">
        <div class="archive-viewer-toolbar" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 14px; border-bottom: 1px solid var(--border-color); flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-main); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                <i class="ri-folder-zip-line" style="color: var(--icon-gray);"></i>
                <span>${escapedName}</span>
            </div>
            <button class="archive-extract-all-btn" style="display:none; align-items:center; gap:6px; background: var(--accent-blue); color: #fff; border: none; border-radius: 4px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap;">
                <i class="ri-folder-download-line"></i> Extract All
            </button>
        </div>
        <div class="archive-viewer-body" style="flex: 1; overflow: auto; min-height: 0;">
            <div class="archive-viewer-loading" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 10px; color: var(--text-muted); font-size: 13px;">
                <i class="ri-loader-4-line" style="font-size: 26px; animation: media-spin 0.8s linear infinite;"></i>
                <span>Reading ${escapedName}...</span>
            </div>
            <div class="archive-viewer-tree" style="display: none; padding: 6px 0;"></div>
        </div>
    </div>
    <style>
        @keyframes media-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .archive-tree-row { display: flex; align-items: center; gap: 6px; padding: 5px 14px; font-size: 13px; color: var(--text-main); cursor: pointer; white-space: nowrap; }
        .archive-tree-row:hover { background: var(--hover-blue); }
        .archive-tree-row .archive-tree-size { margin-left: auto; padding-left: 12px; color: var(--text-muted); font-size: 11px; flex-shrink: 0; }
        .archive-tree-children { display: none; }
        .archive-tree-children.open { display: block; }
        .archive-tree-caret { transition: transform 0.15s; flex-shrink: 0; color: var(--icon-gray); }
        .archive-tree-caret.open { transform: rotate(90deg); }
    </style>
    `;
};

function _formatBytes(n) {
    if (!n && n !== 0) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

// Builds a nested { folders: {}, files: [] } tree from archive-wasm's flat
// entry list (paths like "folder/subfolder/file.txt"), mirroring the same
// path-splitting approach saveExtractedFiles (up-down.js) already uses for
// folder uploads.
function _buildEntryTree(entries) {
    const root = { folders: {}, files: [] };
    entries.forEach(entry => {
        const path = (entry.path || entry.pathname || '').replace(/\\/g, '/').replace(/\/+$/, '');
        if (!path) return;
        const parts = path.split('/').filter(Boolean);
        const fileName = parts.pop();
        if (!fileName) return; // was a directory-only entry with no file part
        let node = root;
        parts.forEach(part => {
            if (!node.folders[part]) node.folders[part] = { folders: {}, files: [] };
            node = node.folders[part];
        });
        node.files.push({ name: fileName, entry });
    });
    return root;
}

function _renderTreeNode(node, depth, pathPrefix) {
    let html = '';
    Object.keys(node.folders).sort((a, b) => a.localeCompare(b)).forEach(folderName => {
        const childId = 'atf-' + Math.random().toString(36).slice(2);
        html += `
        <div class="archive-tree-row" style="padding-left: ${14 + depth * 18}px;" onclick="window.toggleArchiveTreeFolder('${childId}', this)">
            <i class="ri-arrow-right-s-line archive-tree-caret"></i>
            <i class="ri-folder-2-line" style="color: var(--icon-folder, #dcb67a);"></i>
            <span>${folderName}</span>
        </div>
        <div class="archive-tree-children" id="${childId}">
            ${_renderTreeNode(node.folders[folderName], depth + 1, pathPrefix + folderName + '/')}
        </div>`;
    });
    node.files.sort((a, b) => a.name.localeCompare(b.name)).forEach(({ name, entry }) => {
        const icon = (typeof getFileIconHTML === 'function') ? getFileIconHTML(name) : '<i class="ri-file-line file-icon"></i>';
        const size = entry.size !== undefined ? entry.size : (entry.getSize ? entry.getSize() : undefined);
        html += `
        <div class="archive-tree-row" style="padding-left: ${14 + (depth + 1) * 18}px;" onclick="window.openArchiveEntry(this)" data-entry-path="${pathPrefix}${name}">
            ${icon}
            <span>${name}</span>
            <span class="archive-tree-size">${_formatBytes(size)}</span>
        </div>`;
    });
    return html;
}

// Shared by initArchiveViewer and the tap-to-extract flow (proceedWithFileOpen
// in app.js, via window.extractArchiveFile below): reads the file record,
// decodes its base64 content, loads archive-wasm on demand, and extracts the
// entry list. Returns { entries } on success or { error } on failure, so each
// caller can render its own appropriate failure UI (a pane message for the
// viewer, a toast for the tap-to-extract flow) without this helper needing
// to know about either.
async function _readArchiveEntries(fileId) {
    if (!fileId || typeof db === 'undefined' || !db) return { error: 'Could not load this file.' };

    const fileData = await new Promise((resolve) => {
        try {
            const tx = db.transaction('filesystem', 'readonly');
            tx.objectStore('filesystem').get(fileId).onsuccess = (e) => resolve(e.target.result);
            tx.onerror = () => resolve(null);
        } catch (e) { resolve(null); }
    });

    if (!fileData) return { error: 'Could not load this file.' };
    if (fileData.encoding !== 'base64') {
        return { error: "This file's content isn't stored as valid archive data. Try re-uploading it." };
    }

    let bytes;
    try {
        const binaryStr = atob(fileData.content || '');
        bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    } catch (e) { return { error: 'This archive could not be decoded.' }; }

    let extract;
    try {
        const mod = await import('https://esm.sh/archive-wasm');
        extract = mod.extract;
        if (typeof extract !== 'function') throw new Error('extract() not found');
    } catch (e) {
        return { error: 'Could not load the archive reader. Check your connection and try again.' };
    }

    let entries;
    try {
        entries = Array.from(extract(bytes));
    } catch (e) {
        // Matches archive-wasm's documented behavior: encrypted archives (other
        // than encrypted zip, which libarchive itself supports) throw here.
        return { error: 'This archive could not be read - it may be encrypted or in an unsupported format.' };
    }

    const fileEntries = entries.filter(e => {
        const t = e.type || (typeof e.getType === 'function' ? e.getType() : null);
        return !t || t === 'FILE' || t === 'file';
    });

    if (fileEntries.length === 0) return { error: 'This archive appears to be empty.' };
    return { entries: fileEntries, fileData };
}

window.toggleArchiveTreeFolder = function(childId, rowEl) {
    const childEl = document.getElementById(childId);
    const caret = rowEl.querySelector('.archive-tree-caret');
    if (!childEl) return;
    const isOpen = childEl.classList.toggle('open');
    if (caret) caret.classList.toggle('open', isOpen);
};

// Reads the archive file, loads archive-wasm, extracts entries, and renders
// the tree. Runs after the pane is actually in the DOM.
window.initArchiveViewer = async function(fileId, targetId) {
    const pane = document.getElementById(targetId);
    if (!pane || !fileId) return;

    const loadingEl = pane.querySelector('.archive-viewer-loading');
    const treeEl = pane.querySelector('.archive-viewer-tree');
    const extractBtn = pane.querySelector('.archive-extract-all-btn');
    if (!treeEl) return;

    const fail = (msg) => {
        if (loadingEl) loadingEl.innerHTML = `<i class="ri-error-warning-line" style="font-size: 26px; color: var(--color-danger);"></i><span style="text-align:center; max-width: 320px; line-height: 1.5;">${msg}</span>`;
    };

    const result = await _readArchiveEntries(fileId);
    if (result.error) { fail(result.error); return; }
    const fileEntries = result.entries;

    window._archiveViewers[targetId] = { entries: fileEntries, objectUrls: [] };

    const tree = _buildEntryTree(fileEntries);
    treeEl.innerHTML = _renderTreeNode(tree, 0, '');
    treeEl.dataset.targetId = targetId;

    if (loadingEl) loadingEl.style.display = 'none';
    treeEl.style.display = 'block';
    if (extractBtn) {
        extractBtn.style.display = 'flex';
        extractBtn.onclick = () => window.extractArchiveAll(targetId, fileData.name);
    }
};

// Opens a single entry from within the archive inline - no real database
// record is created, so this routes around openFileInTab entirely and
// builds a minimal synthetic tab directly. Media types get the same
// player shell as a real file would; anything else gets a read-only text
// view (large/very-large binary entries the browser can't sensibly display
// as text get a short notice instead, same spirit as the real binary
// placeholder).
window.openArchiveEntry = function(rowEl) {
    const path = rowEl.dataset.entryPath;
    const treeEl = rowEl.closest('.archive-viewer-tree');
    const targetId = treeEl ? treeEl.dataset.targetId : null;
    const state = targetId ? window._archiveViewers[targetId] : null;
    if (!state) return;

    const found = state.entries.find(e => {
        const p = (e.path || e.pathname || '').replace(/\\/g, '/').replace(/\/+$/, '');
        return p === path || p.endsWith('/' + path);
    });
    if (!found) return;

    const name = path.split('/').pop();
    const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';

    let bytes;
    try {
        bytes = found.data || (typeof found.readData === 'function' ? found.readData() : null);
    } catch (e) { bytes = null; }
    if (!bytes) { if (window.showSuccessToast) window.showSuccessToast('Could not read this entry.'); return; }

    const isMedia = window.VIDEO_FILE_EXTS.includes(ext) || window.IMAGE_FILE_EXTS.includes(ext) || window.AUDIO_FILE_EXTS.includes(ext);

    if (isMedia) {
        const kind = window.VIDEO_FILE_EXTS.includes(ext) ? 'video' : (window.AUDIO_FILE_EXTS.includes(ext) ? 'audio' : 'image');
        const mime = window.getExtMimeType ? window.getExtMimeType(ext) : 'application/octet-stream';
        const blob = new Blob([bytes], { type: mime });
        const url = URL.createObjectURL(blob);
        state.objectUrls.push(url);

        const shellHTML = window.getMediaPlayerHTML ? window.getMediaPlayerHTML({ name }, kind) : '';
        if (window.createNewTab) window.createNewTab(name, '', false, shellHTML, kind, null, '');
        // createNewTab doesn't return the pane id in this codebase's convention,
        // but it does synchronously append the pane and call switchTab (which
        // marks it .active) before returning - so the just-created pane can be
        // found directly here, no need to defer.
        const activePane = document.querySelector('.editor-group.active-group .content-pane.active');
        if (activePane) {
            const mediaEl = activePane.querySelector('.media-player-video') || activePane.querySelector('.media-player-image') || activePane.querySelector('.media-player-audio');
            const loadingEl = activePane.querySelector('.media-player-loading');
            if (mediaEl) {
                mediaEl.src = url;
                const revealEvent = kind === 'image' ? 'load' : 'loadedmetadata';
                mediaEl.addEventListener(revealEvent, () => {
                    if (loadingEl) loadingEl.style.display = 'none';
                    mediaEl.style.display = 'block';
                    if (kind === 'audio') {
                        const audioIcon = activePane.querySelector('.media-player-audio-icon');
                        const audioName = activePane.querySelector('.media-player-audio-name');
                        if (audioIcon) audioIcon.style.display = 'block';
                        if (audioName) audioName.style.display = 'block';
                    }
                }, { once: true });
            }
        }
        return;
    }

    // Non-media entry: show as read-only text if it's reasonably small and
    // decodes cleanly, otherwise a short notice (mirrors the real binary
    // placeholder rather than risking a corrupted-looking text dump).
    const MAX_INLINE_TEXT_BYTES = 2 * 1024 * 1024;
    let asText = null;
    if (bytes.length <= MAX_INLINE_TEXT_BYTES) {
        try { asText = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (e) { asText = null; }
    }

    if (asText !== null) {
        if (window.createNewTab) window.createNewTab(name, '', false, asText, 'monaco', null, '');
    } else {
        const notice = `<div style="display:flex; justify-content:center; align-items:center; height:100%; color:var(--text-muted);">
            <div style="text-align:center;">
                <i class="ri-file-warning-line" style="font-size: 48px; color: var(--icon-gray);"></i>
                <p style="margin-top: 15px;">This file type cannot be previewed from inside the archive.<br>Extract it to open it normally.</p>
            </div>
        </div>`;
        if (window.createNewTab) window.createNewTab(name, '', false, notice, 'binary', null, '');
    }
};

// Converts one archive-wasm entry into the { name, path, type, content,
// encoding } shape saveExtractedFiles (up-down.js) expects, deciding
// text-vs-base64 the same way the rest of this app's upload pipeline does
// (BINARY_FILE_EXTS). pathPrefix optionally nests the result under an
// additional folder (used by the tap-to-extract flow to place everything
// under a subfolder named after the archive itself).
function _entryToFileRecord(entry, pathPrefix) {
    const rawPath = (entry.path || entry.pathname || '').replace(/\\/g, '/').replace(/\/+$/, '');
    if (!rawPath) return null;
    const parts = rawPath.split('/').filter(Boolean);
    const name = parts.pop();
    if (!name) return null;
    const path = pathPrefix ? [pathPrefix, ...parts].join('/') : parts.join('/');

    let bytes;
    try {
        bytes = entry.data || (typeof entry.readData === 'function' ? entry.readData() : null);
    } catch (e) { bytes = null; }
    if (!bytes) return null;

    const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    let content, encoding;
    if (window.BINARY_FILE_EXTS && window.BINARY_FILE_EXTS.includes(ext)) {
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        content = btoa(binary);
        encoding = 'base64';
    } else {
        try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes); encoding = undefined; }
        catch (e) {
            let binary = '';
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            content = btoa(binary);
            encoding = 'base64';
        }
    }

    return { name, path, type: 'file', content, encoding };
}

// Extracts every entry into the folder the archive itself lives in, reusing
// up-down.js's saveExtractedFiles (the same folder-reconstruction logic
// already used by folder uploads) instead of duplicating it.
window.extractArchiveAll = async function(targetId, archiveName) {
    const state = window._archiveViewers[targetId];
    if (!state || typeof window.saveExtractedFiles !== 'function') return;
    if (typeof folderStack === 'undefined' || !folderStack.length) return;

    const targetParentId = folderStack[folderStack.length - 1].id;
    const filesToSave = state.entries.map(e => _entryToFileRecord(e, '')).filter(Boolean);

    if (filesToSave.length === 0) {
        if (window.showSuccessToast) window.showSuccessToast('Nothing to extract.');
        return;
    }

    await window.saveExtractedFiles(filesToSave, targetParentId);
    if (window.showSuccessToast) window.showSuccessToast(`Extracted ${filesToSave.length} item${filesToSave.length === 1 ? '' : 's'} from ${archiveName}`);
};

// Tap-to-extract entry point, called from proceedWithFileOpen (app.js) when
// an archive file is tapped in the explorer, instead of opening a viewer
// tab. Extracts straight into a new subfolder named after the archive
// (de-duplicated automatically by saveExtractedFiles/getUniqueFileName, the
// same as any other name collision in this app), reusing _readArchiveEntries
// and _entryToFileRecord rather than re-implementing either.
window.extractArchiveFile = async function(file) {
    if (typeof window.saveExtractedFiles !== 'function' || !file || !file.parentId) return;

    if (window.showSuccessToast) window.showSuccessToast(`Extracting ${file.name}...`);

    // Captured before _readArchiveEntries's await below (which loads
    // archive-wasm from esm.sh and can take real time on a slow
    // connection) - if the user switches windows meanwhile, the module-level
    // `db` will already point at the new window by the time extraction
    // finishes. Passing this through keeps the write targeted at the
    // window/profile the extraction actually started in.
    const targetDb = db;

    const result = await _readArchiveEntries(file.id);
    if (result.error) {
        if (window.showCustomModal) {
            window.showCustomModal({ title: 'Could Not Extract', text: result.error, submitText: 'OK' }, () => {});
        }
        return;
    }

    // Always extracts into the archive's own parent folder (where it actually
    // lives), not wherever the explorer happens to be showing right now - those
    // can differ when extraction is triggered via global search results or a
    // drag onto the tab bar, neither of which necessarily match folderStack's
    // current position.
    const targetParentId = file.parentId;
    const baseName = file.name.includes('.') ? file.name.slice(0, file.name.lastIndexOf('.')) : file.name;
    const filesToSave = result.entries.map(e => _entryToFileRecord(e, baseName)).filter(Boolean);

    if (filesToSave.length === 0) {
        if (window.showSuccessToast) window.showSuccessToast('Nothing to extract.');
        return;
    }

    await window.saveExtractedFiles(filesToSave, targetParentId, targetDb);
    if (window.showSuccessToast) window.showSuccessToast(`Extracted ${filesToSave.length} item${filesToSave.length === 1 ? '' : 's'} into "${baseName}"`);
};

// Called from closeTab (editor.js) when an archive tab closes - revokes any
// Blob URLs created for entries that were previewed inline, and drops the
// per-pane state so it doesn't linger in memory.
window.teardownArchiveViewer = function(targetId) {
    if (!targetId) return;
    const state = window._archiveViewers[targetId];
    if (state) {
        state.objectUrls.forEach(url => URL.revokeObjectURL(url));
        delete window._archiveViewers[targetId];
    }
};
