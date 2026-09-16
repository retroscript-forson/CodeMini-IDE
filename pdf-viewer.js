// ==========================================
// pdf-viewer.js (PDF Preview Tab)
// ==========================================
// A read-only PDF preview: every page is rendered to its own <canvas> via
// pdf.js, loaded on demand from esm.sh - the same on-demand-CDN pattern
// archive.js already uses for archive-wasm, and the notebook kernels use
// for Pyodide/WebR - rather than bundling a PDF rendering engine with the
// app for a feature only exercised while a PDF tab is open. Pages sit
// inside "sheets" styled to match the existing --pdf-bg/--pdf-page-bg/
// --pdf-text theme variables (already defined in themes.css, previously
// unused since no PDF renderer existed yet). PDFs are never editable here -
// only Word documents (docs.js) get a ribbon and an editable canvas; see
// script.js's Save As handling, which deliberately treats a 'pdf' tab as a
// straight file copy rather than trying to serialize the preview markup.
//
// pdf.js version is pinned for a worker URL that's known to match the
// library build (mismatched versions fail to initialize) - if esm.sh ever
// stops serving this exact version, bump both PDFJS_VERSION and the worker
// path together.

const PDFJS_VERSION = '3.11.174';
const MAX_RENDERED_PAGES = 60;

window._pdfViewers = window._pdfViewers || {}; // per-pane state, so teardown can no-op cleanly

window.getPdfViewerHTML = function(file) {
    const escapedName = (file.name || 'document.pdf').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `
    <div class="pdf-viewer-wrapper">
        <div class="pdf-toolbar">
            <div class="pdf-toolbar-left">
                <i class="ri-file-pdf-2-line" style="color:#db4437;"></i>
                <span class="pdf-toolbar-name">${escapedName}</span>
            </div>
            <div class="pdf-toolbar-right">
                <i class="ri-zoom-out-line" id="pdfZoomOut" title="Zoom Out"></i>
                <span class="pdf-zoom-label" id="pdfZoomLabel">100%</span>
                <i class="ri-zoom-in-line" id="pdfZoomIn" title="Zoom In"></i>
                <div class="pdf-toolbar-sep hide-on-mobile"></div>
                <span class="pdf-page-indicator hide-on-mobile" id="pdfPageIndicator">- / -</span>
            </div>
        </div>
        <div class="pdf-pages-scroll" id="pdfPagesScroll">
            <div class="pdf-loading" id="pdfLoading">
                <i class="ri-loader-4-line" style="font-size:26px; animation: pdf-spin 0.8s linear infinite;"></i>
                <span>Loading ${escapedName}...</span>
            </div>
            <div class="pdf-pages-list" id="pdfPagesList" style="display:none;"></div>
        </div>
    </div>
    <style>
        @keyframes pdf-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    </style>
    `;
};

window.initPdfViewer = async function(fileId, targetId) {
    const pane = document.getElementById(targetId);
    if (!pane || !fileId || typeof db === 'undefined' || !db) return;

    const loadingEl = pane.querySelector('#pdfLoading');
    const listEl = pane.querySelector('#pdfPagesList');
    const scrollEl = pane.querySelector('#pdfPagesScroll');
    const zoomLabel = pane.querySelector('#pdfZoomLabel');
    const pageIndicator = pane.querySelector('#pdfPageIndicator');

    const fail = (msg) => {
        if (loadingEl) loadingEl.innerHTML = `<i class="ri-error-warning-line" style="font-size:28px; color:var(--color-danger);"></i><span style="text-align:center; max-width:320px; line-height:1.5;">${msg}</span>`;
    };

    const fileData = await new Promise((resolve) => {
        try {
            const tx = db.transaction('filesystem', 'readonly');
            tx.objectStore('filesystem').get(fileId).onsuccess = (e) => resolve(e.target.result);
            tx.onerror = () => resolve(null);
        } catch (e) { resolve(null); }
    });

    if (!fileData) { fail('Could not load this file.'); return; }
    if (fileData.encoding !== 'base64') { fail("This file's content isn't stored as valid PDF data. Try re-uploading it."); return; }

    let bytes;
    try {
        const binaryStr = atob(fileData.content || '');
        bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    } catch (e) { fail('This PDF could not be decoded.'); return; }

    let pdfjsLib;
    try {
        pdfjsLib = await import(`https://esm.sh/pdfjs-dist@${PDFJS_VERSION}`);
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;
    } catch (e) {
        fail('Could not load the PDF reader. Check your connection and try again.');
        return;
    }

    let pdfDoc;
    try {
        pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
    } catch (e) {
        fail('This PDF could not be opened. It may be corrupted or password-protected.');
        return;
    }

    if (!document.body.contains(pane)) return; // tab closed while loading

    const state = { doc: pdfDoc, zoom: 1 };
    window._pdfViewers[targetId] = state;

    const pagesToRender = Math.min(pdfDoc.numPages, MAX_RENDERED_PAGES);

    async function renderAllPages() {
        listEl.innerHTML = '';
        for (let pageNum = 1; pageNum <= pagesToRender; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: state.zoom * 1.5 });
            const pageWrap = document.createElement('div');
            pageWrap.className = 'pdf-page';
            pageWrap.dataset.pageNum = pageNum;
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            pageWrap.appendChild(canvas);
            listEl.appendChild(pageWrap);
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;
        }
        if (pdfDoc.numPages > MAX_RENDERED_PAGES) {
            const notice = document.createElement('div');
            notice.className = 'pdf-truncated-notice';
            notice.textContent = `Showing the first ${MAX_RENDERED_PAGES} of ${pdfDoc.numPages} pages.`;
            listEl.appendChild(notice);
        }
    }

    try {
        await renderAllPages();
    } catch (e) {
        fail('This PDF could not be rendered.');
        return;
    }

    if (!document.body.contains(pane)) return; // tab closed mid-render

    if (loadingEl) loadingEl.style.display = 'none';
    listEl.style.display = 'flex';
    if (pageIndicator) pageIndicator.textContent = `1 / ${pdfDoc.numPages}`;

    const applyZoom = async (delta) => {
        state.zoom = Math.max(0.5, Math.min(3, state.zoom + delta));
        if (zoomLabel) zoomLabel.textContent = Math.round(state.zoom * 100) + '%';
        await renderAllPages();
    };
    const zoomInBtn = pane.querySelector('#pdfZoomIn');
    const zoomOutBtn = pane.querySelector('#pdfZoomOut');
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => applyZoom(0.25));
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => applyZoom(-0.25));

    if (scrollEl && pageIndicator) {
        scrollEl.addEventListener('scroll', () => {
            const pages = Array.from(listEl.children).filter(p => p.classList.contains('pdf-page'));
            const scrollTop = scrollEl.scrollTop + scrollEl.clientHeight / 3;
            let current = 1;
            pages.forEach((p, idx) => { if (p.offsetTop <= scrollTop) current = idx + 1; });
            pageIndicator.textContent = `${current} / ${pdfDoc.numPages}`;
        });
    }
};

window.teardownPdfViewer = function(targetId) {
    if (!targetId) return;
    delete window._pdfViewers[targetId];
};
