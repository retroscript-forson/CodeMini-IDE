// ==========================================
// docs.js (Document Editor Tab)
// ==========================================
// A Word-like document editor: ribbon + ribbon tabs (Home/Insert/Layout),
// a contentEditable page with a Word-style ruler for adjusting its margins,
// and a status bar showing file identity (name + breadcrumb path) instead
// of the usual tab breadcrumb, per user requirement - this tab type is
// deliberately excluded from the normal breadcrumb (see editor.js) and its
// tab title is always literally "Document", not the real filename.
//
// Documents are saved as real, Word-openable .docx files - a zip of XML
// parts per the OOXML WordprocessingML spec - instead of a portable-but-fake
// .html file with a marker comment. A zip reader/writer isn't bundled with
// the app, so fflate is loaded on demand from esm.sh (the same on-demand-CDN
// pattern archive.js already uses for archive-wasm, and the notebook
// kernels use for Pyodide/WebR) rather than adding a permanent dependency
// for a feature that's only exercised while a Document tab is open. Real,
// already-existing .docx files a user uploads or opens are read the same
// way, so they're previewable *and* editable here, not just files this app
// created itself. Documents created before this change (marker-tagged
// .html) still open and edit fine - see the DOCUMENT_MARKER handling below
// - and are transparently upgraded to real .docx the next time they're
// saved. Formatting is built directly on contentEditable + the
// Selection/Range API rather than the deprecated document.execCommand for
// anything execCommand doesn't handle consistently across browsers.

const DOCUMENT_MARKER = '<!--codemini-document:v1-->';

window.isDocumentMarkerPresent = function(content) {
    return typeof content === 'string' && content.includes(DOCUMENT_MARKER);
};

// ---- Tab shell -------------------------------------------------------

const DOC_FONT_FAMILIES = ['Calibri', 'Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Tahoma'];
const DOC_FONT_SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];
const DOC_HIGHLIGHT_COLORS = ['#ffff00', '#00ff00', '#00ffff', '#ff9900', '#ff00ff', '#0000ff', '#ff0000', 'transparent'];
const DOC_TEXT_COLORS = ['#000000', '#1a1a1a', '#c00000', '#ff0000', '#ffc000', '#00b050', '#0070c0', '#7030a0', '#ffffff'];
const DOC_PX_PER_INCH = 96;

function _docSelect(id, options) {
    return `<select id="${id}" class="doc-ribbon-select">${options.map(o => `<option value="${o}">${o}</option>`).join('')}</select>`;
}

function _docSwatchGrid(id, colors) {
    return `<div class="doc-swatch-grid" id="${id}">${colors.map(c => `<div class="doc-swatch" data-color="${c}" style="background:${c === 'transparent' ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 / 8px 8px' : c};" title="${c}"></div>`).join('')}</div>`;
}

const DOC_SYMBOLS = ['©', '®', '™', '§', '¶', '†', '‡', '•', '…', '–', '—', '½', '¼', '¾', '°', '±', '×', '÷', '€', '£', '¥', '¢', '★', '☺', '→', '←', '↑', '↓', '✓', '✗'];

function _docSymbolGrid(id, symbols) {
    return `<div class="doc-symbol-grid" id="${id}">${symbols.map(s => `<div class="doc-symbol" data-symbol="${s}" title="${s}">${s}</div>`).join('')}</div>`;
}

window.getDocumentEditorHTML = function(file) {
    const escapedName = (file.name || 'Document').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return `
    <div class="doc-editor-wrapper">
        <div class="doc-ribbon-tabs">
            <div class="doc-ribbon-tab active" data-ribbon="home">Home</div>
            <div class="doc-ribbon-tab" data-ribbon="insert">Insert</div>
            <div class="doc-ribbon-tab" data-ribbon="layout">Layout</div>
            <div class="doc-ribbon-tab" data-ribbon="view">View</div>
            <div class="doc-ribbon-tab" data-ribbon="review">Review</div>
        </div>

        <div class="doc-ribbon">
            <div class="doc-ribbon-panel active" data-ribbon-panel="home">
                <div class="doc-ribbon-group">
                    <div class="doc-ribbon-row">
                        ${_docSelect('docFontFamily', DOC_FONT_FAMILIES)}
                        ${_docSelect('docFontSize', DOC_FONT_SIZES)}
                    </div>
                    <div class="doc-ribbon-row">
                        <button class="doc-btn" data-cmd="bold" title="Bold (Ctrl+B)"><b>B</b></button>
                        <button class="doc-btn" data-cmd="italic" title="Italic (Ctrl+I)"><i>I</i></button>
                        <button class="doc-btn" data-cmd="underline" title="Underline (Ctrl+U)"><u>U</u></button>
                        <button class="doc-btn" data-cmd="strikeThrough" title="Strikethrough"><s>S</s></button>
                        <div class="doc-swatch-picker" data-picker="textColor">
                            <button class="doc-btn" title="Text Color"><b style="border-bottom: 3px solid #c00000;">A</b></button>
                            ${_docSwatchGrid('docTextColorGrid', DOC_TEXT_COLORS)}
                        </div>
                        <div class="doc-swatch-picker" data-picker="highlightColor">
                            <button class="doc-btn" title="Highlight Color"><i class="ri-mark-pen-line"></i></button>
                            ${_docSwatchGrid('docHighlightColorGrid', DOC_HIGHLIGHT_COLORS)}
                        </div>
                    </div>
                    <div class="doc-ribbon-row">
                        <button class="doc-btn" data-cmd="subscript" title="Subscript">X<sub>2</sub></button>
                        <button class="doc-btn" data-cmd="superscript" title="Superscript">X<sup>2</sup></button>
                        <button class="doc-btn" data-cmd="removeFormat" title="Clear Formatting"><i class="ri-format-clear"></i></button>
                    </div>
                    <div class="doc-ribbon-label">Font</div>
                </div>
                <div class="doc-ribbon-group">
                    <div class="doc-ribbon-row">
                        <button class="doc-btn" data-cmd="justifyLeft" title="Align Left"><i class="ri-align-left"></i></button>
                        <button class="doc-btn" data-cmd="justifyCenter" title="Align Center"><i class="ri-align-center"></i></button>
                        <button class="doc-btn" data-cmd="justifyRight" title="Align Right"><i class="ri-align-right"></i></button>
                        <button class="doc-btn" data-cmd="justifyFull" title="Justify"><i class="ri-align-justify"></i></button>
                    </div>
                    <div class="doc-ribbon-row">
                        <button class="doc-btn" data-cmd="insertUnorderedList" title="Bulleted List"><i class="ri-list-unordered"></i></button>
                        <button class="doc-btn" data-cmd="insertOrderedList" title="Numbered List"><i class="ri-list-ordered"></i></button>
                        <button class="doc-btn" data-cmd="outdent" title="Decrease Indent"><i class="ri-indent-decrease"></i></button>
                        <button class="doc-btn" data-cmd="indent" title="Increase Indent"><i class="ri-indent-increase"></i></button>
                    </div>
                    <div class="doc-ribbon-label">Paragraph</div>
                </div>
                <div class="doc-ribbon-group">
                    <div class="doc-ribbon-row doc-style-row">
                        <button class="doc-btn doc-style-btn" data-block="P" title="Normal text">Normal</button>
                        <button class="doc-btn doc-style-btn" data-block="H1" title="Heading 1">Heading 1</button>
                        <button class="doc-btn doc-style-btn" data-block="H2" title="Heading 2">Heading 2</button>
                        <button class="doc-btn doc-style-btn" data-block="H3" title="Heading 3">Heading 3</button>
                    </div>
                    <div class="doc-ribbon-label">Styles</div>
                </div>
            </div>

            <div class="doc-ribbon-panel" data-ribbon-panel="insert">
                <div class="doc-ribbon-group">
                    <div class="doc-ribbon-row">
                        <button class="doc-btn doc-btn-wide" data-action="insertTable" title="Insert Table"><i class="ri-table-2"></i><span>Table</span></button>
                        <button class="doc-btn doc-btn-wide" data-action="insertImage" title="Insert Image"><i class="ri-image-add-line"></i><span>Picture</span></button>
                        <button class="doc-btn doc-btn-wide" data-action="insertLink" title="Insert Link"><i class="ri-link"></i><span>Link</span></button>
                        <button class="doc-btn doc-btn-wide" data-action="insertPageBreak" title="Insert Page Break"><i class="ri-file-add-line"></i><span>Page Break</span></button>
                    </div>
                    <div class="doc-ribbon-label">Insert</div>
                </div>
                <div class="doc-ribbon-group">
                    <div class="doc-ribbon-row">
                        <button class="doc-btn" data-cmd="insertHorizontalRule" title="Horizontal Line"><i class="ri-separator"></i></button>
                        <button class="doc-btn doc-btn-wide" data-block="BLOCKQUOTE" title="Quote"><i class="ri-double-quotes-l"></i><span>Quote</span></button>
                        <button class="doc-btn doc-btn-wide" data-action="insertDateTime" title="Insert current date & time"><i class="ri-calendar-line"></i><span>Date/Time</span></button>
                        <div class="doc-swatch-picker" data-picker="symbol">
                            <button class="doc-btn doc-btn-wide" title="Insert Symbol"><i style="font-style:normal; font-size:14px; font-weight:600;">&Omega;</i><span>Symbol</span></button>
                            ${_docSymbolGrid('docSymbolGrid', DOC_SYMBOLS)}
                        </div>
                    </div>
                    <div class="doc-ribbon-label">Elements</div>
                </div>
            </div>

            <div class="doc-ribbon-panel" data-ribbon-panel="layout">
                <div class="doc-ribbon-group">
                    <div class="doc-ribbon-row">
                        <button class="doc-btn doc-btn-wide" data-action="pageWidthNarrow" title="Narrow page width"><i class="ri-layout-column-line"></i><span>Narrow</span></button>
                        <button class="doc-btn doc-btn-wide" data-action="pageWidthNormal" title="Normal page width"><i class="ri-file-line"></i><span>Normal</span></button>
                        <button class="doc-btn doc-btn-wide" data-action="pageWidthWide" title="Wide page width"><i class="ri-layout-row-line"></i><span>Wide</span></button>
                    </div>
                    <div class="doc-ribbon-label">Page Width</div>
                </div>
                <div class="doc-ribbon-group">
                    <div class="doc-ribbon-row">
                        <button class="doc-btn doc-btn-wide" data-margins="narrow" title="Narrow margins (0.5in)"><i class="ri-contract-left-right-line"></i><span>Narrow</span></button>
                        <button class="doc-btn doc-btn-wide" data-margins="normal" title="Normal margins (1in / 0.83in)"><i class="ri-expand-left-right-line"></i><span>Normal</span></button>
                        <button class="doc-btn doc-btn-wide" data-margins="wide" title="Wide margins (1.5in)"><i class="ri-expand-width-line"></i><span>Wide</span></button>
                    </div>
                    <div class="doc-ribbon-label">Margins</div>
                </div>
                <div class="doc-ribbon-group">
                    <div class="doc-ribbon-row">
                        ${_docSelect('docLineSpacing', ['1.0', '1.15', '1.5', '2.0'])}
                    </div>
                    <div class="doc-ribbon-label">Line Spacing</div>
                </div>
            </div>

            <div class="doc-ribbon-panel" data-ribbon-panel="view">
                <div class="doc-ribbon-group">
                    <div class="doc-ribbon-row">
                        <button class="doc-btn doc-btn-wide doc-btn-active" data-action="toggleRuler" id="docToggleRuler" title="Show/hide the ruler"><i class="ri-ruler-2-line"></i><span>Ruler</span></button>
                        <button class="doc-btn doc-btn-wide" data-action="toggleMarks" id="docToggleMarks" title="Show/hide paragraph marks"><i class="ri-paragraph"></i><span>Marks</span></button>
                    </div>
                    <div class="doc-ribbon-label">Show</div>
                </div>
                <div class="doc-ribbon-group">
                    <div class="doc-ribbon-row">
                        <button class="doc-btn doc-btn-wide" data-action="showWordCount" title="Word count details"><i class="ri-numbers-line"></i><span>Word Count</span></button>
                    </div>
                    <div class="doc-ribbon-label">Document</div>
                </div>
            </div>

            <div class="doc-ribbon-panel" data-ribbon-panel="review">
                <div class="doc-ribbon-group">
                    <div class="doc-ribbon-row">
                        <button class="doc-btn doc-btn-wide" data-action="toggleFindReplace" id="docToggleFindReplace" title="Find and replace text"><i class="ri-search-line"></i><span>Find & Replace</span></button>
                    </div>
                    <div class="doc-ribbon-label">Editing</div>
                </div>
            </div>
        </div>

        <div class="doc-find-bar" id="docFindBar">
            <input type="text" id="docFindInput" class="doc-find-input" placeholder="Find">
            <input type="text" id="docReplaceInput" class="doc-find-input" placeholder="Replace with">
            <button class="doc-btn doc-find-btn" id="docFindNextBtn" title="Find Next"><i class="ri-arrow-down-line"></i></button>
            <button class="doc-btn doc-find-btn" id="docReplaceBtn" title="Replace">Replace</button>
            <button class="doc-btn doc-find-btn" id="docReplaceAllBtn" title="Replace All">Replace All</button>
            <span class="doc-find-status" id="docFindStatus"></span>
            <i class="ri-close-line doc-find-close" id="docFindCloseBtn" title="Close"></i>
        </div>

        <div class="doc-canvas-area" id="docCanvasArea">
            <div class="doc-ruler-h" id="docRulerH">
                <div class="doc-ruler-corner"></div>
                <div class="doc-ruler-h-track" id="docRulerHTrack">
                    <div class="doc-ruler-margin-shade" id="docRulerHShadeLeft"></div>
                    <div class="doc-ruler-margin-shade" id="docRulerHShadeRight"></div>
                    <div class="doc-ruler-margin-handle" id="docMarginLeftHandle" title="Left margin"></div>
                    <div class="doc-ruler-margin-handle" id="docMarginRightHandle" title="Right margin"></div>
                </div>
            </div>
            <div class="doc-page-row">
                <div class="doc-ruler-v" id="docRulerV">
                    <div class="doc-ruler-v-track" id="docRulerVTrack">
                        <div class="doc-ruler-margin-shade" id="docRulerVShadeTop"></div>
                        <div class="doc-ruler-margin-shade" id="docRulerVShadeBottom"></div>
                        <div class="doc-ruler-margin-handle" id="docMarginTopHandle" title="Top margin"></div>
                        <div class="doc-ruler-margin-handle" id="docMarginBottomHandle" title="Bottom margin"></div>
                    </div>
                </div>
                <div class="doc-page" id="docPage">
                    <div class="doc-content" id="docContent" contenteditable="true" spellcheck="true"></div>
                </div>
            </div>
        </div>

        <div class="doc-status-bar">
            <div class="doc-status-left">
                <i class="ri-file-word-2-line"></i>
                <span class="doc-status-filename" id="docStatusFilename">${escapedName}</span>
                <span class="doc-status-sep">/</span>
                <span class="doc-status-breadcrumb" id="docStatusBreadcrumb"></span>
            </div>
            <div class="doc-status-right">
                <span id="docStatusWords">0 words</span>
                <span class="doc-status-sep">|</span>
                <span id="docStatusChars">0 characters</span>
                <span class="doc-status-sep">|</span>
                <span id="docStatusSaved" class="doc-status-saved">Saved</span>
            </div>
        </div>
    </div>
    `;
};

// ---- Formatting engine -------------------------------------------------
// Built on contentEditable + the Selection/Range API rather than the
// deprecated document.execCommand, which is inconsistent across browsers
// and formally discouraged. A small set of primitives (wrapping the current
// selection in an inline element, toggling a block-level tag, and a few
// execCommand calls that remain genuinely reliable/standardized - bold,
// italic, underline, list commands, alignment - per current browser
// behavior) covers the ribbon's needs without pulling in a third-party
// rich-text framework. This live DOM is what the DOCX engine below reads
// from (on save) and writes into (on open) - see "DOCX engine".

function _docExec(command, value) {
    // A handful of commands remain well-supported and standardized enough
    // in practice (bold/italic/underline/strike, lists, alignment,
    // indent/outdent, horizontal rule) that reimplementing them via raw
    // Range manipulation would add real complexity for no practical
    // benefit - browsers agree on these. Everything else in this editor
    // (fonts, colors, headings, tables, images, links) is implemented
    // directly below instead.
    document.execCommand(command, false, value || null);
}

function _docWrapSelection(tagName, styleProp, styleValue) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;

    const wrapper = document.createElement(tagName);
    if (styleProp) wrapper.style[styleProp] = styleValue;
    try {
        range.surroundContents(wrapper);
    } catch (e) {
        // surroundContents throws if the range spans multiple block-level
        // elements partially - fall back to extracting and re-inserting,
        // which handles that case at the cost of losing nested formatting
        // boundaries mid-selection (an acceptable, rare edge case).
        const contents = range.extractContents();
        wrapper.appendChild(contents);
        range.insertNode(wrapper);
    }
    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(wrapper);
    sel.addRange(newRange);
}

function _docSetBlock(tagName, contentEl) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !contentEl.contains(sel.anchorNode)) return;
    let node = sel.anchorNode;
    while (node && node !== contentEl && node.nodeType !== 1) node = node.parentNode;
    while (node && node.parentNode !== contentEl && node !== contentEl) node = node.parentNode;
    if (!node || node === contentEl) return;

    const newBlock = document.createElement(tagName);
    newBlock.innerHTML = node.innerHTML;
    node.parentNode.replaceChild(newBlock, node);
}

// ---- Status bar / word count -------------------------------------------

function _docUpdateStats(pane) {
    const contentEl = pane.querySelector('.doc-content');
    const wordsEl = pane.querySelector('#docStatusWords');
    const charsEl = pane.querySelector('#docStatusChars');
    if (!contentEl) return;
    const text = contentEl.innerText || '';
    const words = text.trim().length ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    if (wordsEl) wordsEl.textContent = `${words} word${words === 1 ? '' : 's'}`;
    if (charsEl) charsEl.textContent = `${chars} character${chars === 1 ? '' : 's'}`;
}

function _docUpdateBreadcrumbText(pane, fileId) {
    const bcEl = pane.querySelector('#docStatusBreadcrumb');
    if (!bcEl || typeof db === 'undefined' || !db) return;
    const requestToken = (bcEl._docBcToken || 0) + 1;
    bcEl._docBcToken = requestToken;

    const tx = db.transaction('filesystem', 'readonly');
    tx.objectStore('filesystem').getAll().onsuccess = (e) => {
        if (bcEl._docBcToken !== requestToken || !document.body.contains(bcEl)) return;
        const allFiles = e.target.result;
        const path = [];
        let currId = fileId;
        while (currId && currId !== 'root' && currId !== 'workspace-root') {
            const f = allFiles.find(x => x.id === currId);
            if (!f) break;
            path.unshift(f.name);
            currId = f.parentId;
        }
        path.pop(); // drop the file's own name - the filename is already shown separately
        bcEl.textContent = path.length ? path.join(' / ') : '';
    };
}

// Public entry point (mirrors editor.js's window.updateEditorBreadcrumb) so
// a rename or move elsewhere in the app - which doesn't know or care that
// this particular tab happens to be a Document - can refresh both the
// filename label and the breadcrumb here the same way it refreshes any
// other open tab. Without this, both were only ever set once when the tab
// was first opened, and never again.
window.updateDocumentBreadcrumb = function(fileId, targetPaneId) {
    const pane = document.getElementById(targetPaneId);
    if (!pane || !fileId) return;
    const filenameEl = pane.querySelector('#docStatusFilename');
    if (filenameEl && typeof db !== 'undefined' && db) {
        const tx = db.transaction('filesystem', 'readonly');
        tx.objectStore('filesystem').get(fileId).onsuccess = (e) => {
            const f = e.target.result;
            if (f && document.body.contains(filenameEl)) filenameEl.textContent = f.name;
        };
    }
    _docUpdateBreadcrumbText(pane, fileId);
};

// ==========================================================================
// DOCX engine - real OOXML (WordprocessingML) read/write
// ==========================================================================
// Converts between the live contentEditable DOM and the small subset of the
// OOXML spec this editor's ribbon actually needs: paragraphs, headings 1-3,
// quotes, bullet/numbered lists, tables, images, links, a horizontal rule,
// and run-level bold/italic/underline/strike/color/highlight/font/size/
// alignment. Reading is intentionally more lenient than writing, since an
// uploaded .docx from real Word (or Google Docs/LibreOffice's export) can
// contain constructs this editor never produces itself (styles.xml-defined
// styles, content controls/w:sdt, complex numbering) - unsupported parts are
// skipped gracefully rather than failing the whole document, so the common
// case (text, formatting, lists, tables, images, links) still comes through
// even for documents this editor didn't create.

let _fflatePromise = null;
function _docLoadZipLib() {
    if (!_fflatePromise) _fflatePromise = import('https://esm.sh/fflate@0.8.2');
    return _fflatePromise;
}

function _xmlEsc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function _htmlEsc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _docBytesToBase64(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

function _docBase64ToBytes(b64) {
    const binary = atob(b64 || '');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function _docPxToTwips(px) { return Math.round((px || 0) * 15); }
function _docTwipsToPx(twips) { return twips ? Math.round(parseInt(twips, 10) / 15) : null; }

function _docCssColorToHex(css) {
    if (!css) return null;
    css = String(css).trim();
    if (css.startsWith('#')) {
        let h = css.slice(1);
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
        return h.toUpperCase();
    }
    const m = css.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (m) return [1, 2, 3].map(i => parseInt(m[i], 10).toString(16).padStart(2, '0')).join('').toUpperCase();
    return null;
}

function _docLooksLikeLegacyDoc(bytes) {
    // The OLE Compound File signature used by pre-2007 (binary) .doc files -
    // genuinely a different, much older format from .docx's zip/XML, and not
    // something worth building a full binary parser for here.
    const sig = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
    if (!bytes || bytes.length < 8) return false;
    return sig.every((b, i) => bytes[i] === b);
}

// ---- Static OOXML parts (the same for every document) ----

function _docContentTypesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
}

const _DOC_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;

function _docCoreXml(title, iso) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${_xmlEsc(title)}</dc:title><dc:creator>CodeMini</dc:creator><cp:lastModifiedBy>CodeMini</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>`;
}

const _DOC_APP_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>CodeMini IDE</Application></Properties>`;

const _DOC_STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="44"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="200" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="34"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="160" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:pBdr><w:left w:val="single" w:sz="18" w:space="12" w:color="2E74B5"/></w:pBdr><w:ind w:left="288"/></w:pPr><w:rPr><w:i/><w:color w:val="595959"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/></w:style><w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style><w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style></w:styles>`;

// numId 1 = bullet, numId 2 = decimal - fixed on write; read back generically below.
const _DOC_NUMBERING_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val=""/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`;

// ---- HTML -> DOCX (save) ----

function _docIsEmptyBlock(el) {
    return el.childNodes.length === 1 && el.firstChild.nodeType === 1 && el.firstChild.nodeName === 'BR';
}

function _docMergeInlineStyle(tag, node, style) {
    const s = Object.assign({}, style);
    if (tag === 'B' || tag === 'STRONG') s.bold = true;
    if (tag === 'I' || tag === 'EM') s.italic = true;
    if (tag === 'U') s.underline = true;
    if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') s.strike = true;
    if (tag === 'SUB') s.vertAlign = 'subscript';
    if (tag === 'SUP') s.vertAlign = 'superscript';
    const st = node.style;
    if (st) {
        const fw = st.fontWeight;
        if (fw === 'bold' || fw === '700' || (fw && parseInt(fw, 10) >= 600)) s.bold = true;
        if (st.fontStyle === 'italic') s.italic = true;
        const td = st.textDecorationLine || st.textDecoration || '';
        if (td.indexOf('underline') !== -1) s.underline = true;
        if (td.indexOf('line-through') !== -1) s.strike = true;
        if (st.verticalAlign === 'sub') s.vertAlign = 'subscript';
        if (st.verticalAlign === 'super') s.vertAlign = 'superscript';
        if (st.color) { const hex = _docCssColorToHex(st.color); if (hex) s.color = hex; }
        if (st.backgroundColor && st.backgroundColor !== 'transparent') { const hex = _docCssColorToHex(st.backgroundColor); if (hex) s.highlight = hex; }
        if (st.fontFamily) s.font = st.fontFamily.replace(/["']/g, '').split(',')[0].trim();
        if (st.fontSize) {
            const m = /([\d.]+)(pt|px)/.exec(st.fontSize);
            if (m) {
                const val = parseFloat(m[1]);
                const pt = m[2] === 'pt' ? val : (val * 72 / 96);
                s.size = Math.round(pt * 2); // half-points
            }
        }
    }
    return s;
}

function _docExtractRuns(el) {
    const flat = [];
    function walk(node, style) {
        if (node.nodeType === Node.TEXT_NODE) {
            if (node.nodeValue) flat.push(Object.assign({ type: 'text', text: node.nodeValue }, style));
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const tag = node.tagName;
        if (tag === 'BR') { flat.push({ type: 'break', href: style.href }); return; }
        if (tag === 'IMG') { flat.push({ type: 'image', src: node.getAttribute('src') || '', href: style.href }); return; }
        let newStyle = _docMergeInlineStyle(tag, node, style);
        if (tag === 'A') newStyle = Object.assign({}, newStyle, { href: node.getAttribute('href') || '#' });
        Array.from(node.childNodes).forEach(c => walk(c, newStyle));
    }
    Array.from(el.childNodes).forEach(c => walk(c, {}));

    // Group consecutive runs that share the same href into one link run -
    // simpler than tracking link nesting during the walk above.
    const grouped = [];
    let i = 0;
    while (i < flat.length) {
        const r = flat[i];
        if (r.href) {
            const url = r.href;
            const groupRuns = [];
            while (i < flat.length && flat[i].href === url) {
                const rest = Object.assign({}, flat[i]);
                delete rest.href;
                groupRuns.push(rest);
                i++;
            }
            grouped.push({ type: 'link', url, runs: groupRuns });
        } else {
            const rest = Object.assign({}, r);
            delete rest.href;
            grouped.push(rest);
            i++;
        }
    }
    return grouped;
}

function _docJcFromAlign(el) {
    const ta = el.style && el.style.textAlign;
    if (ta === 'center') return 'center';
    if (ta === 'right') return 'right';
    if (ta === 'justify') return 'both';
    return null;
}

function _docParaPropsXml(opts) {
    let x = '';
    if (opts.pStyle) x += `<w:pStyle w:val="${opts.pStyle}"/>`;
    if (opts.numId) x += `<w:numPr><w:ilvl w:val="${opts.ilvl || 0}"/><w:numId w:val="${opts.numId}"/></w:numPr>`;
    if (opts.hr) x += `<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr>`;
    if (opts.lineSpacing) x += `<w:spacing w:line="${Math.round(opts.lineSpacing * 240)}" w:lineRule="auto"/>`;
    if (opts.jc) x += `<w:jc w:val="${opts.jc}"/>`;
    return x ? `<w:pPr>${x}</w:pPr>` : '';
}

// Builds a full .docx (as a base64 string) from the live contentEditable DOM.
// `marginsOverride` is used only when contentEl isn't mounted under a live
// .doc-page (e.g. building the starter content for a brand-new file).
async function _docBuildDocx(contentEl, docTitle, marginsOverride) {
    const fflate = await _docLoadZipLib();

    const media = [];       // { relId, partName, bytes }
    const hyperlinks = [];  // { relId, url }
    let relCounter = 3;     // rId1/rId2 are reserved for styles.xml/numbering.xml

    function nextRelId() { return 'rId' + (relCounter++); }

    const pageEl = contentEl.closest ? contentEl.closest('.doc-page') : null;
    const cs = pageEl ? getComputedStyle(pageEl) : null;
    const margins = marginsOverride || {
        top: cs ? (parseFloat(cs.paddingTop) || 96) : 96,
        right: cs ? (parseFloat(cs.paddingRight) || 80) : 80,
        bottom: cs ? (parseFloat(cs.paddingBottom) || 96) : 96,
        left: cs ? (parseFloat(cs.paddingLeft) || 80) : 80
    };

    async function imageToMedia(src) {
        let bytes, ext = 'png';
        if (src.startsWith('data:')) {
            const m = /^data:image\/(\w+);base64,(.*)$/.exec(src);
            if (!m) return null;
            ext = m[1] === 'jpeg' ? 'jpg' : m[1];
            bytes = _docBase64ToBytes(m[2]);
        } else {
            // Images this editor inserts are always data URLs - this only
            // covers defensively handling pasted/external <img src> content.
            try {
                const res = await fetch(src);
                const buf = await res.arrayBuffer();
                bytes = new Uint8Array(buf);
                const ct = res.headers.get('content-type') || '';
                ext = ct.indexOf('png') !== -1 ? 'png' : (ct.indexOf('gif') !== -1 ? 'gif' : 'jpg');
            } catch (e) { return null; }
        }
        const partName = `image${media.length + 1}.${ext}`;
        const relId = nextRelId();
        media.push({ relId, partName, bytes });
        return relId;
    }

    function measureImage(src) {
        return new Promise((resolve) => {
            const im = new Image();
            im.onload = () => resolve({ w: im.naturalWidth || 300, h: im.naturalHeight || 200 });
            im.onerror = () => resolve({ w: 300, h: 200 });
            im.src = src;
        });
    }

    async function runXml(run, insideLink) {
        if (run.type === 'break') return '<w:r><w:br/></w:r>';
        if (run.type === 'image') {
            const relId = await imageToMedia(run.src);
            if (!relId) return '';
            let { w, h } = await measureImage(run.src);
            const maxW = 600;
            if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
            const cx = Math.round(w * 9525), cy = Math.round(h * 9525);
            const docPrId = media.length + 100;
            return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${docPrId}" name="Picture ${docPrId}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${docPrId}" name="Picture ${docPrId}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
        }
        // text
        const props = [];
        if (insideLink) props.push('<w:rStyle w:val="Hyperlink"/>');
        if (run.font) props.push(`<w:rFonts w:ascii="${_xmlEsc(run.font)}" w:hAnsi="${_xmlEsc(run.font)}" w:cs="${_xmlEsc(run.font)}"/>`);
        if (run.bold) props.push('<w:b/>');
        if (run.italic) props.push('<w:i/>');
        if (run.strike) props.push('<w:strike/>');
        if (run.color) props.push(`<w:color w:val="${run.color}"/>`);
        if (run.size) props.push(`<w:sz w:val="${run.size}"/><w:szCs w:val="${run.size}"/>`);
        if (insideLink || run.underline) props.push('<w:u w:val="single"/>');
        if (run.highlight) props.push(`<w:shd w:val="clear" w:color="auto" w:fill="${run.highlight}"/>`);
        if (run.vertAlign) props.push(`<w:vertAlign w:val="${run.vertAlign}"/>`);
        const rPr = props.length ? `<w:rPr>${props.join('')}</w:rPr>` : '';
        return `<w:r>${rPr}<w:t xml:space="preserve">${_xmlEsc(run.text || '')}</w:t></w:r>`;
    }

    async function runsXml(runs) {
        let out = '';
        for (const run of runs) {
            if (run.type === 'link') {
                const relId = nextRelId();
                hyperlinks.push({ relId, url: run.url });
                let inner = '';
                for (const r of run.runs) inner += await runXml(r, true);
                out += `<w:hyperlink r:id="${relId}" w:history="1">${inner}</w:hyperlink>`;
            } else {
                out += await runXml(run, false);
            }
        }
        return out;
    }

    async function tableToXml(table) {
        const rows = Array.from(table.children).filter(c => c.tagName === 'TR')
            .concat(Array.from(table.querySelectorAll(':scope > tbody > tr')));
        const colCount = rows.length ? Math.max(...rows.map(r => r.children.length), 1) : 1;
        const colWidth = Math.round(9350 / colCount);
        const gridCols = Array.from({ length: colCount }).map(() => `<w:gridCol w:w="${colWidth}"/>`).join('');
        let rowsXmlOut = '';
        for (const tr of rows) {
            let cellsXml = '';
            for (const td of Array.from(tr.children)) {
                const runs = _docIsEmptyBlock(td) ? [] : _docExtractRuns(td);
                cellsXml += `<w:tc><w:tcPr><w:tcW w:w="${colWidth}" w:type="dxa"/></w:tcPr><w:p>${await runsXml(runs)}</w:p></w:tc>`;
            }
            rowsXmlOut += `<w:tr>${cellsXml}</w:tr>`;
        }
        return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="999999"/></w:tblBorders></w:tblPr><w:tblGrid>${gridCols}</w:tblGrid>${rowsXmlOut}</w:tbl>`;
    }

    async function listToXml(listEl) {
        const numId = listEl.tagName === 'OL' ? 2 : 1;
        let out = '';
        for (const li of Array.from(listEl.children)) {
            if (li.tagName !== 'LI') continue;
            const nestedLists = Array.from(li.children).filter(c => c.tagName === 'UL' || c.tagName === 'OL');
            // Extract this <li>'s own direct inline content, ignoring any
            // nested list children (handled as their own paragraphs next).
            const directClone = li.cloneNode(true);
            nestedLists.forEach((_, idx) => {
                const toRemove = Array.from(directClone.children).filter(c => c.tagName === 'UL' || c.tagName === 'OL');
                if (toRemove[idx]) toRemove[idx].remove();
            });
            const runs = _docIsEmptyBlock(directClone) ? [] : _docExtractRuns(directClone);
            const pPr = _docParaPropsXml({ pStyle: 'ListParagraph', numId, ilvl: 0, jc: _docJcFromAlign(li) });
            out += `<w:p>${pPr}${await runsXml(runs)}</w:p>`;
            for (const nested of nestedLists) out += await listToXml(nested);
        }
        return out;
    }

    async function blockToXml(el) {
        const tag = el.tagName;
        if (tag === 'HR') return `<w:p>${_docParaPropsXml({ hr: true })}</w:p>`;
        if (tag === 'TABLE') return await tableToXml(el);
        if (tag === 'UL' || tag === 'OL') return await listToXml(el);
        if (tag === 'DIV' && el.classList.contains('doc-page-break')) {
            return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
        }

        let pStyle = null;
        if (tag === 'H1') pStyle = 'Heading1';
        else if (tag === 'H2') pStyle = 'Heading2';
        else if (tag === 'H3') pStyle = 'Heading3';
        else if (tag === 'BLOCKQUOTE') pStyle = 'Quote';

        // A stray wrapper div containing further block-level children (a
        // browser contentEditable quirk, not something this editor itself
        // produces) is flattened rather than treated as one paragraph.
        if (tag === 'DIV' && Array.from(el.children).some(c => ['P', 'DIV', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'UL', 'OL', 'TABLE', 'HR'].includes(c.tagName))) {
            let out = '';
            for (const child of Array.from(el.children)) out += await blockToXml(child);
            return out;
        }

        const runs = _docIsEmptyBlock(el) ? [] : _docExtractRuns(el);
        const lineHeightVal = el.style && el.style.lineHeight ? parseFloat(el.style.lineHeight) : null;
        const pPr = _docParaPropsXml({ pStyle, jc: _docJcFromAlign(el), lineSpacing: (lineHeightVal && !isNaN(lineHeightVal)) ? lineHeightVal : null });
        return `<w:p>${pPr}${await runsXml(runs)}</w:p>`;
    }

    let bodyXml = '';
    for (const child of Array.from(contentEl.children)) bodyXml += await blockToXml(child);
    if (!bodyXml) bodyXml = '<w:p/>';

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${bodyXml}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="${_docPxToTwips(margins.top)}" w:right="${_docPxToTwips(margins.right)}" w:bottom="${_docPxToTwips(margins.bottom)}" w:left="${_docPxToTwips(margins.left)}" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;

    const relsForDocXml = [
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`,
        `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>`
    ];
    media.forEach(m => relsForDocXml.push(`<Relationship Id="${m.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.partName}"/>`));
    hyperlinks.forEach(h => relsForDocXml.push(`<Relationship Id="${h.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${_xmlEsc(h.url)}" TargetMode="External"/>`));

    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const files = {
        '[Content_Types].xml': fflate.strToU8(_docContentTypesXml()),
        '_rels/.rels': fflate.strToU8(_DOC_RELS_XML),
        'docProps/core.xml': fflate.strToU8(_docCoreXml(docTitle || 'Document', now)),
        'docProps/app.xml': fflate.strToU8(_DOC_APP_XML),
        'word/document.xml': fflate.strToU8(documentXml),
        'word/styles.xml': fflate.strToU8(_DOC_STYLES_XML),
        'word/numbering.xml': fflate.strToU8(_DOC_NUMBERING_XML),
        'word/_rels/document.xml.rels': fflate.strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relsForDocXml.join('')}</Relationships>`)
    };
    media.forEach(m => { files['word/media/' + m.partName] = m.bytes; });

    const zipped = fflate.zipSync(files, { level: 6 });
    return _docBytesToBase64(zipped);
}

// The starter content for a brand-new Document (script.js's "Document"
// launcher card awaits this for the new file's initial base64 content).
window.createBlankDocumentDocx = async function() {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = '<p><br></p>';
    return await _docBuildDocx(tempDiv, 'Untitled Document', { top: 96, right: 80, bottom: 96, left: 80 });
};

// ---- DOCX -> HTML (open) ----

async function _docParseDocxToHtml(bytes) {
    const fflate = await _docLoadZipLib();
    let entries;
    try { entries = fflate.unzipSync(bytes); } catch (e) { throw new Error('not-a-zip'); }

    const docXmlBytes = entries['word/document.xml'];
    if (!docXmlBytes) throw new Error('no-document-xml');
    const xml = new DOMParser().parseFromString(fflate.strFromU8(docXmlBytes), 'application/xml');
    if (xml.getElementsByTagName('parsererror').length) throw new Error('bad-xml');

    const relsMap = {};
    const relsBytes = entries['word/_rels/document.xml.rels'];
    if (relsBytes) {
        const relsXml = new DOMParser().parseFromString(fflate.strFromU8(relsBytes), 'application/xml');
        Array.from(relsXml.getElementsByTagName('Relationship')).forEach(r => {
            relsMap[r.getAttribute('Id')] = { target: r.getAttribute('Target'), mode: r.getAttribute('TargetMode') };
        });
    }

    // numId -> list format ('bullet' | 'decimal' | ...), best-effort.
    const numFmtMap = {};
    const numberingBytes = entries['word/numbering.xml'];
    if (numberingBytes) {
        try {
            const numXml = new DOMParser().parseFromString(fflate.strFromU8(numberingBytes), 'application/xml');
            const abstractFmt = {};
            Array.from(numXml.getElementsByTagName('w:abstractNum')).forEach(an => {
                const id = an.getAttribute('w:abstractNumId');
                const lvl0 = Array.from(an.getElementsByTagName('w:lvl')).find(l => l.getAttribute('w:ilvl') === '0');
                const numFmtEl = lvl0 ? Array.from(lvl0.children).find(c => c.tagName === 'w:numFmt') : null;
                abstractFmt[id] = numFmtEl ? (numFmtEl.getAttribute('w:val') || 'bullet') : 'bullet';
            });
            Array.from(numXml.getElementsByTagName('w:num')).forEach(n => {
                const numId = n.getAttribute('w:numId');
                const absEl = Array.from(n.children).find(c => c.tagName === 'w:abstractNumId');
                const abs = absEl ? absEl.getAttribute('w:val') : null;
                numFmtMap[numId] = abstractFmt[abs] || 'bullet';
            });
        } catch (e) { /* best-effort: unresolvable lists default to bullet below */ }
    }

    function mediaDataUrl(relId) {
        const rel = relsMap[relId];
        if (!rel || !rel.target) return null;
        const cleanTarget = rel.target.replace(/^\.?\//, '');
        const path = cleanTarget.startsWith('media/') ? 'word/' + cleanTarget : 'word/' + cleanTarget;
        const bytes2 = entries[path] || entries[cleanTarget];
        if (!bytes2) return null;
        const ext = (cleanTarget.split('.').pop() || 'png').toLowerCase();
        const mime = ext === 'jpg' ? 'jpeg' : ext;
        return `data:image/${mime};base64,${_docBytesToBase64(bytes2)}`;
    }

    function runToHtml(rEl) {
        const rPr = Array.from(rEl.children).find(c => c.tagName === 'w:rPr');
        let bold = false, italic = false, underline = false, strike = false, color = null, size = null, font = null, highlight = null, vertAlign = null;
        if (rPr) {
            Array.from(rPr.children).forEach(p => {
                const val = p.getAttribute('w:val');
                if (p.tagName === 'w:b' && val !== '0' && val !== 'false') bold = true;
                if (p.tagName === 'w:i' && val !== '0' && val !== 'false') italic = true;
                if (p.tagName === 'w:u' && val && val !== 'none') underline = true;
                if (p.tagName === 'w:strike' && val !== '0' && val !== 'false') strike = true;
                if (p.tagName === 'w:color' && val && val !== 'auto') color = val;
                if (p.tagName === 'w:sz') size = parseInt(val, 10);
                if (p.tagName === 'w:rFonts') font = p.getAttribute('w:ascii') || p.getAttribute('w:hAnsi');
                if (p.tagName === 'w:shd') { const fill = p.getAttribute('w:fill'); if (fill && fill.toLowerCase() !== 'auto' && fill.toLowerCase() !== 'ffffff') highlight = fill; }
                if (p.tagName === 'w:highlight') { const named = val; if (named && named !== 'none') highlight = named; }
                if (p.tagName === 'w:vertAlign' && (val === 'subscript' || val === 'superscript')) vertAlign = val;
            });
        }
        let out = '';
        Array.from(rEl.children).forEach(child => {
            if (child.tagName === 'w:t') out += _htmlEsc(child.textContent || '');
            else if (child.tagName === 'w:br' || child.tagName === 'w:cr') { if (child.getAttribute('w:type') !== 'page') out += '<br>'; }
            else if (child.tagName === 'w:tab') out += '&emsp;';
            else if (child.tagName === 'w:drawing') {
                const blip = child.getElementsByTagName('a:blip')[0];
                const embed = blip ? blip.getAttribute('r:embed') : null;
                const dataUrl = embed ? mediaDataUrl(embed) : null;
                if (dataUrl) out += `<img src="${dataUrl}">`;
            }
        });
        if (!out) return '';
        if (bold) out = `<b>${out}</b>`;
        if (italic) out = `<i>${out}</i>`;
        if (underline) out = `<u>${out}</u>`;
        if (strike) out = `<s>${out}</s>`;
        if (vertAlign === 'subscript') out = `<sub>${out}</sub>`;
        if (vertAlign === 'superscript') out = `<sup>${out}</sup>`;
        const styles = [];
        if (color && /^[0-9a-fA-F]{6}$/.test(color)) styles.push(`color:#${color}`);
        if (highlight) {
            const named = { yellow: 'ffff00', green: '00ff00', cyan: '00ffff', magenta: 'ff00ff', blue: '0000ff', red: 'ff0000', black: '000000', white: 'ffffff', orange: 'ff9900' };
            const hex = /^[0-9a-fA-F]{6}$/.test(highlight) ? highlight : (named[highlight.toLowerCase()] || null);
            if (hex) styles.push(`background-color:#${hex}`);
        }
        if (font) styles.push(`font-family:${font.replace(/["';]/g, '')}`);
        if (size) styles.push(`font-size:${(size / 2)}pt`);
        if (styles.length) out = `<span style="${styles.join(';')}">${out}</span>`;
        return out;
    }

    // A paragraph whose only meaningful content is a page-break run is
    // rendered as the same non-editable marker _docInsertPageBreak creates,
    // rather than as a normal (empty-looking) paragraph.
    function paragraphHasPageBreak(pEl) {
        return Array.from(pEl.children).some(child => child.tagName === 'w:r' &&
            Array.from(child.children).some(rc => rc.tagName === 'w:br' && rc.getAttribute('w:type') === 'page'));
    }

    function paragraphInnerHtml(pEl) {
        let html = '';
        Array.from(pEl.children).forEach(child => {
            if (child.tagName === 'w:r') html += runToHtml(child);
            else if (child.tagName === 'w:hyperlink') {
                const relId = child.getAttribute('r:id');
                const rel = relId ? relsMap[relId] : null;
                const anchor = child.getAttribute('w:anchor');
                const href = rel ? rel.target : (anchor ? '#' + anchor : '#');
                let inner = '';
                Array.from(child.children).forEach(rc => { if (rc.tagName === 'w:r') inner += runToHtml(rc); });
                if (inner) html += `<a href="${_htmlEsc(href)}">${inner}</a>`;
            }
        });
        return html;
    }

    function paragraphMeta(pEl) {
        const pPr = Array.from(pEl.children).find(c => c.tagName === 'w:pPr');
        let pStyle = null, jc = null, numId = null, isHr = false, lineSpacing = null;
        if (pPr) {
            Array.from(pPr.children).forEach(c => {
                if (c.tagName === 'w:pStyle') pStyle = c.getAttribute('w:val');
                if (c.tagName === 'w:jc') jc = c.getAttribute('w:val');
                if (c.tagName === 'w:numPr') {
                    const n = Array.from(c.children).find(x => x.tagName === 'w:numId');
                    numId = n ? n.getAttribute('w:val') : null;
                }
                if (c.tagName === 'w:pBdr') {
                    if (Array.from(c.children).some(x => x.tagName === 'w:bottom')) isHr = true;
                }
                if (c.tagName === 'w:spacing' && c.getAttribute('w:lineRule') === 'auto') {
                    const line = parseInt(c.getAttribute('w:line'), 10);
                    if (line) lineSpacing = Math.round((line / 240) * 100) / 100;
                }
            });
        }
        return { pStyle, jc, numId, isHr, lineSpacing };
    }

    function blockStyleAttr(meta) {
        const styles = [];
        if (meta.jc === 'center') styles.push('text-align:center');
        else if (meta.jc === 'right') styles.push('text-align:right');
        else if (meta.jc === 'both') styles.push('text-align:justify');
        if (meta.lineSpacing) styles.push(`line-height:${meta.lineSpacing}`);
        return styles.length ? ` style="${styles.join(';')}"` : '';
    }

    function paragraphToBlockHtml(pEl) {
        if (paragraphHasPageBreak(pEl)) return '<div class="doc-page-break" contenteditable="false">Page Break</div>';
        const meta = paragraphMeta(pEl);
        const inner = paragraphInnerHtml(pEl);
        if (meta.isHr && !inner.trim()) return '<hr>';
        const attr = blockStyleAttr(meta);
        if (meta.pStyle === 'Heading1') return `<h1${attr}>${inner || '<br>'}</h1>`;
        if (meta.pStyle === 'Heading2') return `<h2${attr}>${inner || '<br>'}</h2>`;
        if (meta.pStyle === 'Heading3') return `<h3${attr}>${inner || '<br>'}</h3>`;
        if (meta.pStyle === 'Quote' || meta.pStyle === 'IntenseQuote') return `<blockquote${attr}>${inner || '<br>'}</blockquote>`;
        return `<p${attr}>${inner || '<br>'}</p>`;
    }

    function tableToHtml(tblEl) {
        let html = '<table>';
        Array.from(tblEl.children).filter(c => c.tagName === 'w:tr').forEach(tr => {
            html += '<tr>';
            Array.from(tr.children).filter(c => c.tagName === 'w:tc').forEach(tc => {
                let cellInner = '';
                Array.from(tc.children).filter(c => c.tagName === 'w:p').forEach(p => { cellInner += paragraphInnerHtml(p); });
                html += `<td>${cellInner || '<br>'}</td>`;
            });
            html += '</tr>';
        });
        html += '</table>';
        return html;
    }

    const body = xml.getElementsByTagName('w:body')[0];
    if (!body) throw new Error('no-body');

    let html = '';
    const children = Array.from(body.children);
    let i = 0;
    while (i < children.length) {
        const el = children[i];
        if (el.tagName === 'w:p') {
            const meta = paragraphMeta(el);
            if (meta.numId) {
                const fmt = numFmtMap[meta.numId] || 'bullet';
                const isOrdered = /decimal|lowerLetter|upperLetter|lowerRoman|upperRoman/.test(fmt);
                const listTag = isOrdered ? 'ol' : 'ul';
                let listHtml = `<${listTag}>`;
                while (i < children.length && children[i].tagName === 'w:p' && paragraphMeta(children[i]).numId) {
                    listHtml += `<li>${paragraphInnerHtml(children[i]) || '<br>'}</li>`;
                    i++;
                }
                listHtml += `</${listTag}>`;
                html += listHtml;
                continue;
            }
            html += paragraphToBlockHtml(el);
            i++;
        } else if (el.tagName === 'w:tbl') {
            html += tableToHtml(el);
            i++;
        } else {
            i++; // sectPr, bookmarks, content controls, etc. - skipped gracefully
        }
    }

    let marginsPx = null;
    const sectPr = body.getElementsByTagName('w:sectPr')[0];
    if (sectPr) {
        const pgMar = Array.from(sectPr.children).find(c => c.tagName === 'w:pgMar');
        if (pgMar) {
            marginsPx = {
                top: _docTwipsToPx(pgMar.getAttribute('w:top')),
                right: _docTwipsToPx(pgMar.getAttribute('w:right')),
                bottom: _docTwipsToPx(pgMar.getAttribute('w:bottom')),
                left: _docTwipsToPx(pgMar.getAttribute('w:left'))
            };
        }
    }

    return { html: html || '<p><br></p>', marginsPx };
}

// ---- Save ---------------------------------------------------------------

// Rebuilds a real .docx from the current contentEditable body and hands it
// to the existing generic autoSaveFile (editor.js) - no separate save/DB
// path, this is the same mechanism every other file type in the app
// already uses. autoSaveFile's optional 4th argument marks the stored
// content as base64 (see editor.js) - needed so a Document that's being
// saved for the first time since upgrading from the old marker-tagged
// .html format is correctly flagged as binary going forward, not just its
// bytes.
window.triggerDocumentSave = async function(pane) {
    if (!pane) return;
    const contentEl = pane.querySelector('.doc-content');
    const tabEl = document.querySelector(`.tab[data-target="${pane.id}"]`);
    if (!contentEl || !tabEl || contentEl.contentEditable === 'false') return;
    const fileId = tabEl.dataset.fileId;
    if (!fileId) return;

    const nameEl = pane.querySelector('#docStatusFilename');
    const title = (nameEl && nameEl.textContent) || 'Document';

    // Capture which window/profile (and therefore which database) this file
    // actually belongs to RIGHT NOW, synchronously, before the await below
    // yields control. _docBuildDocx is real async work (building a zip) - if
    // the user switches windows while it's running (e.g. saveAllUnsavedTabs
    // flushing this tab during switchWindow), window.autoSaveFile would
    // otherwise re-derive "the active window" at write time and target
    // whatever window is active *then*, not the one this edit belongs to.
    // Mirrors the capture-before-await pattern terminal-window.js uses for
    // its own isolated DB writes.
    const targetWinId = typeof cellActiveWinId !== 'undefined' ? cellActiveWinId : (localStorage.getItem('codemini_active_window') || 'win_default');
    const windowsData = JSON.parse(localStorage.getItem('codemini_windows') || '[]');
    const winContext = windowsData.find(w => w.id === targetWinId) || windowsData[0];
    const targetDbName = winContext ? winContext.db : 'CodeMiniDB';

    let base64;
    try {
        base64 = await _docBuildDocx(contentEl, title);
    } catch (e) {
        console.error('Document save failed:', e);
        return;
    }

    window.autoSaveFile(fileId, base64, tabEl, 'base64', targetDbName);
    const savedEl = pane.querySelector('#docStatusSaved');
    if (savedEl) { savedEl.textContent = 'Saved'; savedEl.classList.remove('doc-status-unsaved'); }
};

function _docMarkUnsaved(pane, tabEl) {
    if (tabEl) tabEl.classList.add('unsaved-blink');
    const savedEl = pane.querySelector('#docStatusSaved');
    if (savedEl) { savedEl.textContent = 'Unsaved changes'; savedEl.classList.add('doc-status-unsaved'); }
}

function _docScheduleAutosave(pane) {
    clearTimeout(window._docAutosaveTimers[pane.id]);
    window._docAutosaveTimers[pane.id] = setTimeout(() => {
        window.triggerDocumentSave(pane);
    }, (window.appSettings && window.appSettings.autoSaveDelay) || 1000);
}

// ---- Insert actions (table / image / link) ------------------------------

function _docInsertAtCursor(contentEl, node) {
    contentEl.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && contentEl.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        range.collapse(false);
        range.insertNode(node);
        range.setStartAfter(node);
        range.setEndAfter(node);
        sel.removeAllRanges();
        sel.addRange(range);
    } else {
        contentEl.appendChild(node);
    }
}

function _docInsertTable(contentEl) {
    const table = document.createElement('table');
    for (let r = 0; r < 3; r++) {
        const row = document.createElement('tr');
        for (let c = 0; c < 3; c++) {
            const cell = document.createElement('td');
            cell.innerHTML = '<br>';
            row.appendChild(cell);
        }
        table.appendChild(row);
    }
    const wrapper = document.createDocumentFragment();
    wrapper.appendChild(table);
    wrapper.appendChild(document.createElement('p')).innerHTML = '<br>';
    _docInsertAtCursor(contentEl, wrapper);
}

function _docInsertImage(contentEl) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const img = document.createElement('img');
            img.src = reader.result; // data URL - embedded as a real image part in the .docx on save
            _docInsertAtCursor(contentEl, img);
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

function _docInsertLink(contentEl) {
    const sel = window.getSelection();
    const hasSelection = sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed;
    if (window.showCustomModal) {
        window.showCustomModal({ title: 'Insert Link', inputType: 'text', placeholder: 'https://example.com', submitText: 'Insert' }, (url) => {
            if (!url || !url.trim()) { closeGenModal(); return; }
            const safeUrl = url.trim();
            if (hasSelection) {
                _docWrapSelectionAsLink(safeUrl);
            } else {
                const a = document.createElement('a');
                a.href = safeUrl;
                a.textContent = safeUrl;
                _docInsertAtCursor(contentEl, a);
            }
            closeGenModal();
        });
    }
}

function _docWrapSelectionAsLink(url) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const a = document.createElement('a');
    a.href = url;
    try { range.surroundContents(a); }
    catch (e) { const contents = range.extractContents(); a.appendChild(contents); range.insertNode(a); }
}

// A page break is inserted as its own non-editable block (deletable as a
// single unit via backspace/selection, but you can't type into it) so it
// reads clearly in the continuous scrolling page. It round-trips to a real
// <w:br w:type="page"/> in the .docx - see the DOCX engine below.
function _docInsertPageBreak(contentEl) {
    const marker = document.createElement('div');
    marker.className = 'doc-page-break';
    marker.contentEditable = 'false';
    marker.textContent = 'Page Break';
    const wrapper = document.createDocumentFragment();
    wrapper.appendChild(marker);
    const trailingP = document.createElement('p');
    trailingP.innerHTML = '<br>';
    wrapper.appendChild(trailingP);
    _docInsertAtCursor(contentEl, wrapper);
}

// Applies line-height to every top-level block the current selection
// touches - mirrors how the alignment buttons already work per-paragraph,
// just across a (possibly multi-paragraph) range instead of a single one.
function _docApplyLineSpacing(contentEl, value) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !contentEl.contains(sel.anchorNode)) return;
    const range = sel.getRangeAt(0);

    function topLevelBlockOf(node) {
        let n = node;
        while (n && n !== contentEl && n.parentNode !== contentEl) n = n.parentNode;
        return (n && n !== contentEl) ? n : null;
    }

    const startBlock = topLevelBlockOf(range.startContainer);
    const endBlock = topLevelBlockOf(range.endContainer);
    if (!startBlock) return;

    const blocks = [];
    if (startBlock === endBlock || !endBlock) {
        blocks.push(startBlock);
    } else {
        let collecting = false;
        for (const child of Array.from(contentEl.children)) {
            if (child === startBlock) collecting = true;
            if (collecting) blocks.push(child);
            if (child === endBlock) break;
        }
    }
    blocks.forEach(b => { if (b && b.style) b.style.lineHeight = value; });
}

// ---- Ruler (Feature #1: draggable page margins, similar to Word) --------

function _docCurrentPageWidth(pageEl) {
    if (pageEl.classList.contains('doc-page-narrow')) return 620;
    if (pageEl.classList.contains('doc-page-wide')) return 1000;
    return 816;
}

function _docBuildRulerTicks(trackEl, lengthPx, orientation) {
    trackEl.querySelectorAll('.doc-ruler-tick-h, .doc-ruler-tick-v, .doc-ruler-num-h, .doc-ruler-num-v').forEach(n => n.remove());
    const inches = lengthPx / DOC_PX_PER_INCH;
    for (let i = 0; i <= inches + 0.001; i += 0.125) {
        const pos = Math.round(i * DOC_PX_PER_INCH);
        if (pos > lengthPx) break;
        const isWhole = Math.abs(i - Math.round(i)) < 0.001;
        const isHalf = !isWhole && Math.abs((i * 2) - Math.round(i * 2)) < 0.001;
        const len = isWhole ? 12 : (isHalf ? 8 : 5);
        const tick = document.createElement('div');
        tick.className = orientation === 'h' ? 'doc-ruler-tick-h' : 'doc-ruler-tick-v';
        if (orientation === 'h') { tick.style.left = pos + 'px'; tick.style.height = len + 'px'; }
        else { tick.style.top = pos + 'px'; tick.style.width = len + 'px'; }
        trackEl.appendChild(tick);
        if (isWhole && i > 0) {
            const num = document.createElement('div');
            num.className = orientation === 'h' ? 'doc-ruler-num-h' : 'doc-ruler-num-v';
            num.textContent = String(Math.round(i));
            if (orientation === 'h') num.style.left = pos + 'px'; else num.style.top = pos + 'px';
            trackEl.appendChild(num);
        }
    }
}

function _docPositionMarginHandle(handle, shadeEl, value, lengthPx, orientation, side) {
    const pos = side === 'start' ? value : (lengthPx - value);
    if (orientation === 'h') {
        handle.style.left = pos + 'px';
        if (shadeEl) {
            if (side === 'start') { shadeEl.style.left = '0px'; shadeEl.style.width = value + 'px'; }
            else { shadeEl.style.left = (lengthPx - value) + 'px'; shadeEl.style.width = value + 'px'; }
        }
    } else {
        handle.style.top = pos + 'px';
        if (shadeEl) {
            if (side === 'start') { shadeEl.style.top = '0px'; shadeEl.style.height = value + 'px'; }
            else { shadeEl.style.top = (lengthPx - value) + 'px'; shadeEl.style.height = value + 'px'; }
        }
    }
}

function _docSyncRuler(pane) {
    const pageEl = pane.querySelector('#docPage');
    const hTrack = pane.querySelector('#docRulerHTrack');
    const vTrack = pane.querySelector('#docRulerVTrack');
    if (!pageEl || !hTrack || !vTrack) return;

    // Read the page's real, rendered size rather than assuming 816/620/1000px
    // - .doc-page's own max-width can clamp it narrower than that on small
    // viewports, and the ruler needs to track whatever the page actually
    // renders at or the two drift out of alignment.
    const pageRect = pageEl.getBoundingClientRect();
    const pageWidth = Math.round(pageRect.width) || _docCurrentPageWidth(pageEl);
    const pageHeight = Math.max(Math.round(pageRect.height) || 0, 1056);
    hTrack.style.width = pageWidth + 'px';
    vTrack.style.height = pageHeight + 'px';

    const cs = getComputedStyle(pageEl);
    const marginLeft = parseFloat(cs.paddingLeft) || 0;
    const marginRight = parseFloat(cs.paddingRight) || 0;
    const marginTop = parseFloat(cs.paddingTop) || 0;
    const marginBottom = parseFloat(cs.paddingBottom) || 0;

    _docBuildRulerTicks(hTrack, pageWidth, 'h');
    _docBuildRulerTicks(vTrack, pageHeight, 'v');

    const leftHandle = pane.querySelector('#docMarginLeftHandle');
    const rightHandle = pane.querySelector('#docMarginRightHandle');
    const topHandle = pane.querySelector('#docMarginTopHandle');
    const bottomHandle = pane.querySelector('#docMarginBottomHandle');
    const shadeLeft = pane.querySelector('#docRulerHShadeLeft');
    const shadeRight = pane.querySelector('#docRulerHShadeRight');
    const shadeTop = pane.querySelector('#docRulerVShadeTop');
    const shadeBottom = pane.querySelector('#docRulerVShadeBottom');

    if (leftHandle) _docPositionMarginHandle(leftHandle, shadeLeft, marginLeft, pageWidth, 'h', 'start');
    if (rightHandle) _docPositionMarginHandle(rightHandle, shadeRight, marginRight, pageWidth, 'h', 'end');
    if (topHandle) _docPositionMarginHandle(topHandle, shadeTop, marginTop, pageHeight, 'v', 'start');
    if (bottomHandle) _docPositionMarginHandle(bottomHandle, shadeBottom, marginBottom, pageHeight, 'v', 'end');
}

function _docInitRuler(pane) {
    const pageEl = pane.querySelector('#docPage');
    const contentEl = pane.querySelector('.doc-content');
    if (!pageEl) return;

    _docSyncRuler(pane);

    if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => _docSyncRuler(pane));
        ro.observe(pageEl);
        pane._docRulerResizeObserver = ro;
    }

    const MIN_MARGIN = 8;
    const MIN_CONTENT = 100;

    function commitMarginChange() {
        if (contentEl && contentEl.contentEditable !== 'false') {
            _docMarkUnsaved(pane, document.querySelector(`.tab[data-target="${pane.id}"]`));
            _docScheduleAutosave(pane);
        }
    }

    function wireHandle(handleId, orientation, side, paddingProp) {
        const handle = pane.querySelector('#' + handleId);
        if (!handle) return;
        const trackEl = orientation === 'h' ? pane.querySelector('#docRulerHTrack') : pane.querySelector('#docRulerVTrack');

        function moveTo(clientX, clientY) {
            const rect = trackEl.getBoundingClientRect();
            const lengthPx = orientation === 'h' ? rect.width : rect.height;
            const pointerPos = orientation === 'h' ? (clientX - rect.left) : (clientY - rect.top);
            let value = side === 'start' ? pointerPos : (lengthPx - pointerPos);
            value = Math.max(MIN_MARGIN, Math.min(value, lengthPx - MIN_CONTENT));
            pageEl.style[paddingProp] = Math.round(value) + 'px';
            _docSyncRuler(pane);
        }

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            handle.classList.add('dragging');
            const onMove = (ev) => moveTo(ev.clientX, ev.clientY);
            const onUp = () => {
                handle.classList.remove('dragging');
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                commitMarginChange();
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        handle.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handle.classList.add('dragging');
            const onMove = (ev) => {
                const t = ev.touches[0];
                if (t) moveTo(t.clientX, t.clientY);
            };
            const onEnd = () => {
                handle.classList.remove('dragging');
                document.removeEventListener('touchmove', onMove);
                document.removeEventListener('touchend', onEnd);
                commitMarginChange();
            };
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onEnd);
        }, { passive: false });
    }

    wireHandle('docMarginLeftHandle', 'h', 'start', 'paddingLeft');
    wireHandle('docMarginRightHandle', 'h', 'end', 'paddingRight');
    wireHandle('docMarginTopHandle', 'v', 'start', 'paddingTop');
    wireHandle('docMarginBottomHandle', 'v', 'end', 'paddingBottom');
}

// ---- Find & Replace (Review tab) -----------------------------------------

// Maps the plain-text content of `root` to the actual text nodes it's made
// of, so a plain string search (case-insensitive indexOf) can be turned
// back into a real Range for selecting/replacing. Text inside a
// contenteditable="false" island (e.g. a page-break marker) is skipped -
// those are meant to be opaque, atomic units, not searchable/replaceable
// text.
function _docGetTextNodesInfo(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            const el = node.parentElement;
            if (el && el.closest('[contenteditable="false"]')) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        }
    });
    const nodes = [];
    let fullText = '';
    let n;
    while ((n = walker.nextNode())) {
        nodes.push({ node: n, start: fullText.length, end: fullText.length + n.nodeValue.length });
        fullText += n.nodeValue;
    }
    return { nodes, fullText };
}

function _docRangeFromOffsets(info, start, end) {
    const range = document.createRange();
    let setStart = false, setEnd = false;
    for (const entry of info.nodes) {
        if (!setStart && start >= entry.start && start <= entry.end) {
            range.setStart(entry.node, start - entry.start);
            setStart = true;
        }
        if (!setEnd && end >= entry.start && end <= entry.end) {
            range.setEnd(entry.node, end - entry.start);
            setEnd = true;
        }
        if (setStart && setEnd) break;
    }
    return (setStart && setEnd) ? range : null;
}

function _docInitFindReplace(pane, contentEl, tabEl) {
    const findBar = pane.querySelector('#docFindBar');
    const toggleBtn = pane.querySelector('#docToggleFindReplace');
    const findInput = pane.querySelector('#docFindInput');
    const replaceInput = pane.querySelector('#docReplaceInput');
    const findNextBtn = pane.querySelector('#docFindNextBtn');
    const replaceBtn = pane.querySelector('#docReplaceBtn');
    const replaceAllBtn = pane.querySelector('#docReplaceAllBtn');
    const statusEl = pane.querySelector('#docFindStatus');
    const closeBtn = pane.querySelector('#docFindCloseBtn');
    if (!findBar || !toggleBtn || !findInput) return;

    let searchFrom = 0; // resumes after the last match; reset whenever the query changes

    function doFind() {
        const query = findInput.value || '';
        if (!query) { statusEl.textContent = ''; return; }
        const info = _docGetTextNodesInfo(contentEl);
        const haystack = info.fullText.toLowerCase();
        const needle = query.toLowerCase();
        let idx = haystack.indexOf(needle, searchFrom);
        let wrapped = false;
        if (idx === -1 && searchFrom > 0) { idx = haystack.indexOf(needle); wrapped = true; }
        if (idx === -1) { statusEl.textContent = 'No matches'; return; }
        const range = _docRangeFromOffsets(info, idx, idx + needle.length);
        if (!range) { statusEl.textContent = 'No matches'; return; }
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        const container = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : range.startContainer;
        if (container && container.scrollIntoView) container.scrollIntoView({ block: 'center', behavior: 'smooth' });
        searchFrom = idx + needle.length;
        statusEl.textContent = wrapped ? 'Wrapped to top' : 'Found';
    }

    toggleBtn.addEventListener('click', () => {
        const showing = findBar.classList.toggle('show');
        toggleBtn.classList.toggle('doc-btn-active', showing);
        if (showing) { findInput.focus(); searchFrom = 0; }
    });
    if (closeBtn) closeBtn.addEventListener('click', () => {
        findBar.classList.remove('show');
        toggleBtn.classList.remove('doc-btn-active');
    });
    if (findNextBtn) findNextBtn.addEventListener('click', doFind);
    findInput.addEventListener('input', () => { searchFrom = 0; statusEl.textContent = ''; });
    findInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); doFind(); }
    });

    if (replaceBtn) replaceBtn.addEventListener('click', () => {
        const sel = window.getSelection();
        const query = findInput.value || '';
        if (query && sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed && sel.toString().toLowerCase() === query.toLowerCase()) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            const replacement = replaceInput.value || '';
            const textNode = document.createTextNode(replacement);
            range.insertNode(textNode);
            sel.removeAllRanges();
            const r2 = document.createRange();
            r2.setStartAfter(textNode);
            r2.collapse(true);
            sel.addRange(r2);
            searchFrom = 0; // the DOM/text offsets just shifted - safest to re-search from the top
            _docMarkUnsaved(pane, tabEl);
            _docScheduleAutosave(pane);
        }
        doFind();
    });

    if (replaceAllBtn) replaceAllBtn.addEventListener('click', () => {
        const query = findInput.value || '';
        if (!query) return;
        const replacement = replaceInput.value || '';
        const needle = query.toLowerCase();
        let count = 0;
        let from = 0;
        // Always resume the search right after where the *replacement* text
        // was just inserted (not the original match) - otherwise a
        // replacement that itself contains the search term (e.g. "cat" ->
        // "cats") would keep re-matching the text it just inserted forever.
        for (let guard = 0; guard < 20000; guard++) {
            const info = _docGetTextNodesInfo(contentEl);
            const idx = info.fullText.toLowerCase().indexOf(needle, from);
            if (idx === -1) break;
            const range = _docRangeFromOffsets(info, idx, idx + needle.length);
            if (!range) break;
            range.deleteContents();
            range.insertNode(document.createTextNode(replacement));
            count++;
            from = idx + replacement.length;
        }
        statusEl.textContent = count ? `Replaced ${count}` : 'No matches';
        searchFrom = 0;
        if (count) { _docMarkUnsaved(pane, tabEl); _docScheduleAutosave(pane); }
    });
}

// ---- Init / teardown -----------------------------------------------------

window._docAutosaveTimers = window._docAutosaveTimers || {};

// Loads the real file content into the page, wires the ribbon (tab
// switching, formatting buttons, selects, color pickers, insert actions,
// page width, ruler), and sets up autosave-on-change + the status bar.
// Runs after the pane is actually in the DOM.
window.initDocumentEditor = async function(fileId, targetId) {
    const pane = document.getElementById(targetId);
    if (!pane || !fileId || typeof db === 'undefined' || !db) return;

    const contentEl = pane.querySelector('.doc-content');
    const tabEl = document.querySelector(`.tab[data-target="${targetId}"]`);
    if (!contentEl) return;

    const fileData = await new Promise((resolve) => {
        try {
            const tx = db.transaction('filesystem', 'readonly');
            tx.objectStore('filesystem').get(fileId).onsuccess = (e) => resolve(e.target.result);
            tx.onerror = () => resolve(null);
        } catch (e) { resolve(null); }
    });

    if (!fileData) return;

    const pageEl = pane.querySelector('#docPage');
    let bodyHTML = '<p><br></p>';
    let loadedMargins = null;
    let loadError = null; // only ever set for the genuinely-unreadable legacy .doc case now

    if (fileData.encoding === 'base64') {
        // A real .docx - created here, or an uploaded/opened Word document.
        const bytes = _docBase64ToBytes(fileData.content || '');
        if (_docLooksLikeLegacyDoc(bytes)) {
            loadError = 'This is a legacy .doc file (Word 97-2003 format), which can\u2019t be read directly. Open it in Word, use "Save As" \u2192 Word Document (.docx), then re-upload it.';
        } else {
            try {
                const parsed = await _docParseDocxToHtml(bytes);
                bodyHTML = parsed.html;
                loadedMargins = parsed.marginsPx;
            } catch (e) {
                // A bug in this editor's own docx reader (or a real .docx this
                // subset genuinely can't parse) should never lock someone out
                // of typing - fall back to a blank, still-editable page rather
                // than the old behavior of disabling contentEditable here.
                console.error('Document read failed, starting a blank editable page instead:', e);
                bodyHTML = '<p><br></p>';
            }
        }
    } else if (typeof fileData.content === 'string' && window.isDocumentMarkerPresent(fileData.content)) {
        // A Document saved before this app moved to real .docx files - still
        // opens and edits fine, and is upgraded to a real .docx the next
        // time it's saved (triggerDocumentSave always writes .docx now).
        try {
            const parser = new DOMParser();
            const parsedDoc = parser.parseFromString(fileData.content || '', 'text/html');
            if (parsedDoc.body && parsedDoc.body.innerHTML.trim()) bodyHTML = parsedDoc.body.innerHTML;
        } catch (e) { /* fall back to the default empty paragraph */ }
    }

    if (loadError) {
        contentEl.contentEditable = 'false';
        contentEl.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; height:100%; color:var(--text-muted); text-align:center; padding: 40px;">
            <i class="ri-file-warning-line" style="font-size:40px; color:var(--icon-gray);"></i>
            <p style="max-width:420px; line-height:1.5;">${_htmlEsc(loadError)}</p>
        </div>`;
        const ribbonTabsEl = pane.querySelector('.doc-ribbon-tabs');
        if (ribbonTabsEl) ribbonTabsEl.style.display = 'none';
        const ribbonEl = pane.querySelector('.doc-ribbon');
        if (ribbonEl) ribbonEl.style.display = 'none';
        const rulerHEl = pane.querySelector('#docRulerH');
        if (rulerHEl) rulerHEl.style.display = 'none';
        const rulerVEl = pane.querySelector('#docRulerV');
        if (rulerVEl) rulerVEl.style.display = 'none';
    } else {
        contentEl.innerHTML = bodyHTML;
        // Keeps Enter-key behavior producing <p> (not a bare <div>, Chrome's
        // default) so the DOCX writer's block-element handling stays simple.
        try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { /* non-critical */ }
    }

    if (loadedMargins && pageEl) {
        if (loadedMargins.top) pageEl.style.paddingTop = loadedMargins.top + 'px';
        if (loadedMargins.right) pageEl.style.paddingRight = loadedMargins.right + 'px';
        if (loadedMargins.bottom) pageEl.style.paddingBottom = loadedMargins.bottom + 'px';
        if (loadedMargins.left) pageEl.style.paddingLeft = loadedMargins.left + 'px';
    }

    const filenameEl = pane.querySelector('#docStatusFilename');
    if (filenameEl) filenameEl.textContent = fileData.name;
    _docUpdateStats(pane);
    _docUpdateBreadcrumbText(pane, fileId);

    if (!loadError) {
        // Autosave on change, debounced the same way Monaco's autosave already
        // is elsewhere in this app (window.appSettings.autoSaveDelay).
        contentEl.addEventListener('input', () => {
            _docMarkUnsaved(pane, tabEl);
            _docUpdateStats(pane);
            _docScheduleAutosave(pane);
        });
    }

    // Ribbon tab switching, formatting controls, color pickers, insert
    // actions, page width, and the ruler are wired up together in a single
    // try/catch: none of this can affect whether the page loaded or is
    // editable (already handled above), so a bug in any one control here
    // is logged and skipped rather than risking it taking the others down
    // with it.
    try {
        // ---- Ribbon tab switching ----
        pane.querySelectorAll('.doc-ribbon-tab').forEach(tabBtn => {
            tabBtn.addEventListener('click', () => {
                pane.querySelectorAll('.doc-ribbon-tab').forEach(t => t.classList.remove('active'));
                pane.querySelectorAll('.doc-ribbon-panel').forEach(p => p.classList.remove('active'));
                tabBtn.classList.add('active');
                const panelName = tabBtn.dataset.ribbon;
                const panel = pane.querySelector(`.doc-ribbon-panel[data-ribbon-panel="${panelName}"]`);
                if (panel) panel.classList.add('active');
            });
        });
        const ribbonEl = pane.querySelector('.doc-ribbon');
        if (ribbonEl) ribbonEl.classList.add('active');

        // ---- Formatting buttons (data-cmd -> execCommand primitives) ----
        pane.querySelectorAll('.doc-btn[data-cmd]').forEach(btn => {
            btn.addEventListener('mousedown', (e) => e.preventDefault()); // keep selection from collapsing on click
            btn.addEventListener('click', () => {
                contentEl.focus();
                _docExec(btn.dataset.cmd);
            });
        });

        // ---- Block style buttons (Normal / Heading 1-3 / Quote) ----
        pane.querySelectorAll('.doc-btn[data-block]').forEach(btn => {
            btn.addEventListener('mousedown', (e) => e.preventDefault());
            btn.addEventListener('click', () => {
                contentEl.focus();
                _docSetBlock(btn.dataset.block, contentEl);
            });
        });

        // ---- Font family / size selects ----
        const fontFamilySel = pane.querySelector('#docFontFamily');
        if (fontFamilySel) {
            fontFamilySel.addEventListener('mousedown', () => contentEl.focus());
            fontFamilySel.addEventListener('change', () => {
                contentEl.focus();
                _docWrapSelection('span', 'fontFamily', fontFamilySel.value);
            });
        }
        const fontSizeSel = pane.querySelector('#docFontSize');
        if (fontSizeSel) {
            fontSizeSel.value = '11';
            fontSizeSel.addEventListener('mousedown', () => contentEl.focus());
            fontSizeSel.addEventListener('change', () => {
                contentEl.focus();
                _docWrapSelection('span', 'fontSize', fontSizeSel.value + 'pt');
            });
        }

        // ---- Color / symbol pickers ----
        // Feature #5: the dropdown is position:fixed (see style.css) so the
        // ribbon's own horizontal scrollbox and the tab pane's
        // overflow:hidden wrapper can't clip it. Its on-screen position is
        // computed from the toggle button's real position right before it's
        // shown, then re-checked one frame later against its *actual*
        // rendered width (offsetWidth is 0/unreliable before it's visible),
        // so it never ends up partly off-screen. The text/highlight color
        // grids and the symbol grid all share this same mechanism - they
        // only differ in what clicking an item inside them does.
        function closeAllPickers() {
            pane.querySelectorAll('.doc-swatch-grid, .doc-symbol-grid').forEach(g => g.classList.remove('show'));
        }
        pane.querySelectorAll('.doc-swatch-picker').forEach(picker => {
            const toggleBtn = picker.querySelector('.doc-btn');
            const grid = picker.querySelector('.doc-swatch-grid, .doc-symbol-grid');
            if (!toggleBtn || !grid) return;

            function positionGrid() {
                const rect = toggleBtn.getBoundingClientRect();
                const gridWidth = grid.offsetWidth || 112;
                let left = rect.left;
                if (left + gridWidth > window.innerWidth - 8) left = window.innerWidth - gridWidth - 8;
                if (left < 8) left = 8;
                let top = rect.bottom + 4;
                const gridHeight = grid.offsetHeight || 120;
                if (top + gridHeight > window.innerHeight - 8) top = Math.max(8, rect.top - gridHeight - 4);
                grid.style.top = top + 'px';
                grid.style.left = left + 'px';
            }

            toggleBtn.addEventListener('mousedown', (e) => e.preventDefault());
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const wasOpen = grid.classList.contains('show');
                closeAllPickers();
                if (!wasOpen) {
                    positionGrid();
                    grid.classList.add('show');
                    // offsetWidth/Height above is only a guess while the grid
                    // is still display:none - correct it once it's actually
                    // laid out, one frame later.
                    requestAnimationFrame(positionGrid);
                }
            });
            grid.addEventListener('mousedown', (e) => e.stopPropagation());
            grid.addEventListener('click', (e) => e.stopPropagation());

            grid.querySelectorAll('.doc-swatch').forEach(sw => {
                sw.addEventListener('mousedown', (e) => e.preventDefault());
                sw.addEventListener('click', (e) => {
                    e.stopPropagation();
                    contentEl.focus();
                    const color = sw.dataset.color;
                    const styleProp = picker.dataset.picker === 'textColor' ? 'color' : 'backgroundColor';
                    _docWrapSelection('span', styleProp, color === 'transparent' ? '' : color);
                    grid.classList.remove('show');
                });
            });
            grid.querySelectorAll('.doc-symbol').forEach(symEl => {
                symEl.addEventListener('mousedown', (e) => e.preventDefault());
                symEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    _docInsertAtCursor(contentEl, document.createTextNode(symEl.dataset.symbol));
                    grid.classList.remove('show');
                });
            });
        });
        document.addEventListener('click', closeAllPickers);
        // A dropdown positioned from a one-time rect (above) would otherwise
        // drift away from its button if the ribbon or page scrolls while
        // it's open - simplest fix is just closing it, same as clicking away.
        const ribbonScrollEl = pane.querySelector('.doc-ribbon');
        if (ribbonScrollEl) ribbonScrollEl.addEventListener('scroll', closeAllPickers);
        const canvasAreaEl = pane.querySelector('#docCanvasArea');
        if (canvasAreaEl) canvasAreaEl.addEventListener('scroll', closeAllPickers);

        // ---- Insert actions ----
        const insertTableBtn = pane.querySelector('[data-action="insertTable"]');
        if (insertTableBtn) insertTableBtn.addEventListener('click', () => _docInsertTable(contentEl));
        const insertImageBtn = pane.querySelector('[data-action="insertImage"]');
        if (insertImageBtn) insertImageBtn.addEventListener('click', () => _docInsertImage(contentEl));
        const insertLinkBtn = pane.querySelector('[data-action="insertLink"]');
        if (insertLinkBtn) insertLinkBtn.addEventListener('click', () => _docInsertLink(contentEl));
        const insertPageBreakBtn = pane.querySelector('[data-action="insertPageBreak"]');
        if (insertPageBreakBtn) insertPageBreakBtn.addEventListener('click', () => _docInsertPageBreak(contentEl));
        const insertDateTimeBtn = pane.querySelector('[data-action="insertDateTime"]');
        if (insertDateTimeBtn) {
            insertDateTimeBtn.addEventListener('click', () => {
                const now = new Date();
                const text = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                _docInsertAtCursor(contentEl, document.createTextNode(text));
            });
        }

        // ---- Page width (Layout tab) ----
        const widthBtns = {
            pageWidthNarrow: 'doc-page-narrow',
            pageWidthNormal: null,
            pageWidthWide: 'doc-page-wide'
        };
        Object.keys(widthBtns).forEach(action => {
            const btn = pane.querySelector(`[data-action="${action}"]`);
            if (!btn || !pageEl) return;
            btn.addEventListener('click', () => {
                pageEl.classList.remove('doc-page-narrow', 'doc-page-wide');
                if (widthBtns[action]) pageEl.classList.add(widthBtns[action]);
                _docSyncRuler(pane);
            });
        });

        // ---- Margin presets (Layout tab) - a quick alternative to dragging
        // the ruler handles by hand, using the same padding + ruler-sync
        // mechanism the ruler itself drives. ----
        const marginPresets = {
            narrow: { top: 48, right: 48, bottom: 48, left: 48 },
            normal: { top: 96, right: 80, bottom: 96, left: 80 },
            wide: { top: 96, right: 144, bottom: 96, left: 144 }
        };
        pane.querySelectorAll('[data-margins]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!pageEl) return;
                const preset = marginPresets[btn.dataset.margins];
                if (!preset) return;
                pageEl.style.paddingTop = preset.top + 'px';
                pageEl.style.paddingRight = preset.right + 'px';
                pageEl.style.paddingBottom = preset.bottom + 'px';
                pageEl.style.paddingLeft = preset.left + 'px';
                _docSyncRuler(pane);
                _docMarkUnsaved(pane, tabEl);
                _docScheduleAutosave(pane);
            });
        });

        // ---- Line spacing (Layout tab) - applies to every block-level
        // element the current selection touches, matching how alignment
        // buttons already work per-paragraph. ----
        const lineSpacingSel = pane.querySelector('#docLineSpacing');
        if (lineSpacingSel) {
            lineSpacingSel.value = '1.0';
            lineSpacingSel.addEventListener('mousedown', () => contentEl.focus());
            lineSpacingSel.addEventListener('change', () => {
                contentEl.focus();
                _docApplyLineSpacing(contentEl, lineSpacingSel.value);
            });
        }

        // ---- View tab ----
        const toggleRulerBtn = pane.querySelector('#docToggleRuler');
        if (toggleRulerBtn) {
            toggleRulerBtn.addEventListener('click', () => {
                const showing = toggleRulerBtn.classList.toggle('doc-btn-active');
                const rulerHEl2 = pane.querySelector('#docRulerH');
                const rulerVEl2 = pane.querySelector('#docRulerV');
                if (rulerHEl2) rulerHEl2.style.display = showing ? '' : 'none';
                if (rulerVEl2) rulerVEl2.style.display = showing ? '' : 'none';
                if (showing) _docSyncRuler(pane);
            });
        }
        const toggleMarksBtn = pane.querySelector('#docToggleMarks');
        if (toggleMarksBtn) {
            toggleMarksBtn.addEventListener('click', () => {
                const showing = toggleMarksBtn.classList.toggle('doc-btn-active');
                contentEl.classList.toggle('doc-show-marks', showing);
            });
        }
        const wordCountBtn = pane.querySelector('[data-action="showWordCount"]');
        if (wordCountBtn) {
            wordCountBtn.addEventListener('click', () => {
                const text = contentEl.innerText || '';
                const trimmed = text.trim();
                const words = trimmed ? trimmed.split(/\s+/).length : 0;
                const chars = text.length;
                const charsNoSpaces = text.replace(/\s/g, '').length;
                const paragraphs = Array.from(contentEl.children).filter(c => ['P', 'DIV', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'LI'].includes(c.tagName) && c.textContent.trim()).length;
                if (window.showCustomModal) {
                    window.showCustomModal({
                        title: 'Word Count',
                        text: `Words: ${words}\nCharacters: ${chars}\nCharacters (no spaces): ${charsNoSpaces}\nParagraphs: ${paragraphs}`,
                        submitText: 'OK'
                    }, () => {});
                }
            });
        }

        // ---- Review tab: Find & Replace ----
        _docInitFindReplace(pane, contentEl, tabEl);

        // ---- Ruler (Feature #1) ----
        if (!loadError) _docInitRuler(pane);
    } catch (e) {
        console.error('Document ribbon/ruler setup failed (the page itself remains editable):', e);
    }
};

// Called from closeTab (editor.js) when a document tab closes - clears any
// pending debounced autosave for that pane (so it can't fire after the pane
// no longer exists) and disconnects the ruler's ResizeObserver.
window.teardownDocumentEditor = function(targetId) {
    if (!targetId) return;
    if (window._docAutosaveTimers[targetId]) {
        clearTimeout(window._docAutosaveTimers[targetId]);
        delete window._docAutosaveTimers[targetId];
    }
    const pane = document.getElementById(targetId);
    if (pane && pane._docRulerResizeObserver) {
        pane._docRulerResizeObserver.disconnect();
        delete pane._docRulerResizeObserver;
    }
};
