// ==========================================
// media.js (Video/Image/Audio Player Tab)
// ==========================================
// Renders a real <video>/<img>/<audio> viewer for media files (.mp4, .mov,
// .png, .jpg, .mp3, .wav, etc.) instead of the generic "cannot be
// displayed" binary placeholder. Depends on the base64 upload pipeline in
// up-down.js (window.readFileAsAppropriate, file.encoding === 'base64') and
// window.fileRecordToBlob (defined in up-down.js) to reconstruct real
// bytes from what's stored.

// Blob URLs currently in use, keyed by pane ID (not file ID - the same
// media file can legitimately be open in two different editor groups at
// once, each getting its own independent viewer/player, so each needs its
// own URL rather than sharing/fighting over one).
window._mediaObjectUrls = window._mediaObjectUrls || {};

// Returns the static shell for a video, image, or audio tab's pane. The
// actual <video>/<img>/<audio> src is intentionally NOT set here - at this
// point the pane isn't in the real DOM yet (createNewTab builds this HTML
// string before inserting it), and the Blob URL needs a real DOM element to
// attach to. See initMediaPlayer, which runs right after the pane is
// actually inserted (same reason editor.js wires up the file breadcrumb as
// a separate post-creation step rather than baking it into this string too).
window.getMediaPlayerHTML = function(file, kind) {
    if (kind !== 'video' && kind !== 'image' && kind !== 'audio') return '';
    const escapedName = (file.name || 'media').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let mediaTag, bg, loadingColor, extraIcon = '';
    if (kind === 'video') {
        mediaTag = `<video class="media-player-video" controls preload="metadata" style="max-width: 100%; max-height: 100%; display: none; background: #000;"></video>`;
        bg = '#000'; loadingColor = '#ccc';
    } else if (kind === 'audio') {
        mediaTag = `<audio class="media-player-audio" controls preload="metadata" style="width: 100%; max-width: 420px; display: none;"></audio>`;
        bg = 'var(--bg-panel)'; loadingColor = 'var(--text-muted)';
        extraIcon = `<i class="ri-music-2-line media-player-audio-icon" style="font-size: 64px; color: var(--icon-gray); margin-bottom: 20px; display: none;"></i>`;
    } else {
        mediaTag = `<img class="media-player-image" style="max-width: 100%; max-height: 100%; display: none; object-fit: contain;" alt="${escapedName}">`;
        // Images look better on a neutral checkerboard-free dark backdrop that still
        // reads as "viewer chrome" rather than pure black (which can visually merge
        // with a transparent PNG's own transparent regions).
        bg = 'var(--bg-panel)'; loadingColor = 'var(--text-muted)';
    }
    return `
    <div class="media-player-wrapper" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; background: ${bg}; min-height: 0; position: relative; overflow: auto;">
        <div class="media-player-loading" style="color: ${loadingColor}; font-size: 13px; display: flex; flex-direction: column; align-items: center; gap: 10px;">
            <i class="ri-loader-4-line" style="font-size: 28px; animation: media-spin 0.8s linear infinite;"></i>
            <span>Loading ${escapedName}...</span>
        </div>
        ${extraIcon}
        ${kind === 'audio' ? `<span class="media-player-audio-name" style="display:none; margin-bottom: 14px; color: var(--text-main); font-size: 13px; font-weight: 500; max-width: 90%; text-align: center; word-break: break-word;">${escapedName}</span>` : ''}
        ${mediaTag}
    </div>
    <style>
        @keyframes media-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    </style>
    `;
};

// Fetches the file's real record (contentHTML passed to createNewTab may be
// stale relative to what's actually in the DB by the time this runs, and we
// need the raw content/encoding fields anyway, which aren't threaded through
// the HTML string) and wires up a Blob URL for the <video>/<img>/<audio>
// element that was just inserted into targetId's pane.
window.initMediaPlayer = async function(fileId, targetId) {
    const pane = document.getElementById(targetId);
    if (!pane || !fileId || typeof db === 'undefined' || !db) return;

    const fileData = await new Promise((resolve) => {
        try {
            const tx = db.transaction('filesystem', 'readonly');
            tx.objectStore('filesystem').get(fileId).onsuccess = (e) => resolve(e.target.result);
            tx.onerror = () => resolve(null);
        } catch (e) { resolve(null); }
    });

    const loadingEl = pane.querySelector('.media-player-loading');
    const mediaEl = pane.querySelector('.media-player-video') || pane.querySelector('.media-player-image') || pane.querySelector('.media-player-audio');
    if (!mediaEl) return;
    const isVideo = mediaEl.tagName === 'VIDEO';
    const isAudio = mediaEl.tagName === 'AUDIO';
    const noun = isVideo ? 'video' : (isAudio ? 'audio' : 'image');

    if (!fileData) {
        if (loadingEl) loadingEl.innerHTML = `<i class="ri-error-warning-line" style="font-size: 28px; color: var(--color-danger);"></i><span>Could not load this file.</span>`;
        return;
    }

    // Files uploaded before the base64 fix (or ones that were somehow saved
    // through a path that still read them as text) won't have real binary
    // content - fail clearly instead of trying to render corrupted data as
    // if it were a working media file.
    if (fileData.encoding !== 'base64') {
        const dataNoun = isVideo ? 'playable video' : (isAudio ? 'playable audio' : 'valid image');
        if (loadingEl) loadingEl.innerHTML = `<i class="ri-error-warning-line" style="font-size: 28px; color: var(--color-danger);"></i><span style="text-align:center; max-width: 320px; line-height: 1.5;">This file's content isn't stored as ${dataNoun} data. Try re-uploading it.</span>`;
        return;
    }

    let blob;
    try {
        blob = window.fileRecordToBlob ? window.fileRecordToBlob(fileData) : null;
    } catch (e) { blob = null; }

    if (!blob) {
        if (loadingEl) loadingEl.innerHTML = `<i class="ri-error-warning-line" style="font-size: 28px; color: var(--color-danger);"></i><span>This ${noun} could not be decoded.</span>`;
        return;
    }

    const url = URL.createObjectURL(blob);
    window._mediaObjectUrls[targetId] = url;

    mediaEl.src = url;
    const revealEvent = (isVideo || isAudio) ? 'loadedmetadata' : 'load';
    mediaEl.addEventListener(revealEvent, () => {
        if (loadingEl) loadingEl.style.display = 'none';
        mediaEl.style.display = 'block';
        if (isAudio) {
            const audioIcon = pane.querySelector('.media-player-audio-icon');
            const audioName = pane.querySelector('.media-player-audio-name');
            if (audioIcon) audioIcon.style.display = 'block';
            if (audioName) audioName.style.display = 'block';
        }
    }, { once: true });
    mediaEl.addEventListener('error', () => {
        const formatNoun = isVideo ? 'video format' : (isAudio ? 'audio format' : 'image');
        const verb = isVideo || isAudio ? 'played' : 'displayed';
        if (loadingEl) loadingEl.innerHTML = `<i class="ri-error-warning-line" style="font-size: 28px; color: var(--color-danger);"></i><span>This ${formatNoun} could not be ${verb} by your browser.</span>`;
    }, { once: true });
};

// Called from closeTab (editor.js) when a video/image/audio tab closes -
// releases the Blob URL (and the memory/file-handle it references) so it
// doesn't leak every time a media tab is opened and closed.
window.teardownMediaPlayer = function(targetId) {
    if (!targetId) return;
    const url = window._mediaObjectUrls[targetId];
    if (url) {
        URL.revokeObjectURL(url);
        delete window._mediaObjectUrls[targetId];
    }
};
