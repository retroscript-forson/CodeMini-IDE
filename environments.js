// ==========================================
// environments.js (Universal Plot Viewer)
// ==========================================

// --- Strict Isolation Registry ---
window._envStateRegistry = window._envStateRegistry || {};

function _getEnvWinId() { 
    return localStorage.getItem('codemini_active_window') || 'win_default'; 
}

function getEnvState() {
    const wid = _getEnvWinId();
    if (!window._envStateRegistry[wid]) {
        window._envStateRegistry[wid] = { 
            plotNavList: [], 
            plotNavIndex: 0, 
            currentPlotZoom: 1 
        };
    }
    return window._envStateRegistry[wid];
}

// NOTE: notebook-kernels.js defines a window.forceCloseEnvironments FIRST
// (interrupts/tears down the Python/R/SQL/Ruby kernels for winId). It loads
// before this file, so without capturing+chaining it here, this assignment
// would silently clobber it - kernels would never actually be torn down on
// window switch/close, only this plot-preview state would reset. Follow the
// same "capture original, call it, then extend" pattern already used for
// window.saveCurrentUIState/restoreCurrentUIState (see now-island.js, search.js).
const _envPrevForceCloseEnvironments = window.forceCloseEnvironments;
window.forceCloseEnvironments = function(winId, isClosing = false) {
    if (typeof _envPrevForceCloseEnvironments === 'function') {
        _envPrevForceCloseEnvironments(winId, isClosing);
    }

    const state = window._envStateRegistry[winId];
    if (state) {
        state.plotNavList = [];
        state.plotNavIndex = 0;
        state.currentPlotZoom = 1;
    }
    
    const currentWin = localStorage.getItem('codemini_active_window') || 'win_default';
    if (currentWin === winId || !currentWin) {
        const container = document.getElementById('plotPreviewContainer');
        if (container) {
            container.classList.remove('show');
            setTimeout(() => {
                if (container.style.display !== 'none' && !container.classList.contains('show')) {
                    container.style.display = 'none';
                }
            }, 300);
        }
    }
};

function initPreviewContainer() {
    let container = document.getElementById('plotPreviewContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'plotPreviewContainer';
        container.className = 'plot-preview-container';
        container.innerHTML = `
            <div class="plot-header">
                <div class="plot-header-left">
                    <i class="ri-bar-chart-2-line" id="previewIcon" style="color:var(--accent-blue); font-size: 16px;"></i> <span id="previewTitle">Preview</span>
                </div>
                <div class="plot-header-right">
                    <i class="ri-zoom-in-line" id="plotZoomIn" title="Zoom In"></i>
                    <i class="ri-zoom-out-line" id="plotZoomOut" title="Zoom Out"></i>
                    <i class="ri-download-2-line" id="plotDownload" title="Download"></i>
                    <div class="hide-on-mobile" style="width: 1px; height: 16px; background: var(--border-color); margin: 0 8px;"></div>
                    <i class="ri-fullscreen-fill hide-on-mobile" id="plotMaximizeToggle" title="Toggle Full Width"></i>
                    <i class="ri-close-line" id="plotCloseBtn" title="Close"></i>
                </div>
            </div>
            <div class="plot-content" id="previewContentArea" style="flex:1; overflow:auto; display:flex; justify-content:center; align-items:center; background: var(--bg-white); padding: 20px;">
                </div>
            <div class="plot-statusbar" id="previewStatusBar">
                <div class="plot-status-left" id="previewNavControls">
                    <i class="ri-arrow-left-line disabled" id="plotNavBack" title="Previous Item"></i>
                    <i class="ri-arrow-right-line disabled" id="plotNavFwd" title="Next Item"></i>
                </div>
                <div class="plot-status-right">
                    <span id="plotFileName"></span> - <span id="plotCellNum"></span>
                </div>
            </div>
        `;
        document.body.appendChild(container);

        const style = document.createElement('style');
        style.innerHTML = `
            .plot-preview-container { position: fixed; top: 0; right: 0; width: 55%; height: 100vh; background-color: var(--bg-white); z-index: 10005; display: flex; flex-direction: column; border-left: 1px solid var(--border-color); box-shadow: -5px 0 25px rgba(0, 0, 0, 0.1); transform: translateX(105%); transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), width 0.3s ease; }
            .plot-preview-container.show { transform: translateX(0); }
            .plot-preview-container.maximized { width: 100%; border-left: none; }
            @media (max-width: 768px) { .plot-preview-container { width: 100%; border-left: none; } .plot-preview-container .hide-on-mobile { display: none !important; } }
            .plot-header { display: flex; justify-content: space-between; align-items: center; height: 36px; padding: 0 15px; background-color: var(--bg-panel); border-bottom: 1px solid var(--border-color); color: var(--text-main); font-size: 13px; flex-shrink: 0; }
            .plot-header-left { display: flex; align-items: center; gap: 6px; font-weight: 600; }
            .plot-header-right { display: flex; align-items: center; gap: 12px; font-size: 16px; color: var(--icon-gray); }
            .plot-header-right i { cursor: pointer; transition: color 0.2s; }
            .plot-header-right i:hover { color: var(--text-main); }
            .plot-statusbar { display: flex; justify-content: space-between; align-items: center; height: 26px; padding: 0 15px; background-color: var(--bg-tabs-bar); border-top: 1px solid var(--border-color); color: var(--text-muted); font-size: 12px; flex-shrink: 0; }
            .plot-status-left{
               gap: 12px;
}
            .plot-status-left i { font-size: 15px; cursor: margin-right: 10px; transition: color 0.2s; }
            .plot-status-left i:hover:not(.disabled) { color: var(--text-main); }
            .plot-status-left i.disabled { opacity: 0.3; cursor: not-allowed; }
            
            .preview-table-wrapper table { border-collapse: collapse; width: 100%; text-align: left; font-size: 13px; white-space: nowrap; }
            .preview-table-wrapper thead { position: sticky; top: 0; background: var(--bg-tabs-bar); z-index: 1; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
            .preview-table-wrapper th, .preview-table-wrapper td { padding: 10px 15px; border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); }
            .preview-table-wrapper th { font-weight: 600; color: var(--text-main); }
            .preview-table-wrapper td { color: var(--text-main); }
        `;
        document.head.appendChild(style);

        document.getElementById('plotCloseBtn').addEventListener('click', () => {
            container.classList.remove('show');
            setTimeout(() => { if (!container.classList.contains('show')) container.style.display = 'none'; }, 300);
        });
        
        document.getElementById('plotMaximizeToggle').addEventListener('click', () => {
            container.classList.toggle('maximized');
            const icon = document.getElementById('plotMaximizeToggle');
            if (container.classList.contains('maximized')) {
                icon.classList.replace('ri-fullscreen-fill', 'ri-fullscreen-exit-fill');
            } else {
                icon.classList.replace('ri-fullscreen-exit-fill', 'ri-fullscreen-fill');
            }
        });
        
        document.getElementById('plotZoomIn').addEventListener('click', () => window.updatePlotZoom(0.2));
        document.getElementById('plotZoomOut').addEventListener('click', () => window.updatePlotZoom(-0.2));
        
        document.getElementById('plotNavBack').addEventListener('click', () => {
            const state = getEnvState();
            if (state.plotNavIndex > 0) {
                state.plotNavIndex--;
                window.renderPlotPreviewIndex();
            }
        });
        
        document.getElementById('plotNavFwd').addEventListener('click', () => {
            const state = getEnvState();
            if (state.plotNavIndex < state.plotNavList.length - 1) {
                state.plotNavIndex++;
                window.renderPlotPreviewIndex();
            }
        });
    }
    return container;
}

window.openTablePreview = function(tableId, cellInfo = 'Query Result') {
    let container = initPreviewContainer();
    const tableEl = document.getElementById(tableId);
    if (!tableEl) return;
    
    document.getElementById('previewTitle').textContent = 'Table Preview';
    document.getElementById('previewIcon').className = 'ri-table-2';
    
    document.getElementById('plotZoomIn').style.display = 'none';
    document.getElementById('plotZoomOut').style.display = 'none';
    document.getElementById('previewNavControls').style.display = 'none';
    
    const downloadBtn = document.getElementById('plotDownload');
    downloadBtn.style.display = 'block';
    
    const newDownloadBtn = downloadBtn.cloneNode(true);
    downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);
    newDownloadBtn.addEventListener('click', () => window.downloadSqlCsv(tableId, 'query_export.csv'));
    
    document.getElementById('plotFileName').textContent = 'SQL Table';
    document.getElementById('plotCellNum').textContent = cellInfo;
    
    const contentArea = document.getElementById('previewContentArea');
    contentArea.innerHTML = `<div class="preview-table-wrapper" style="width: 100%; height: 100%; overflow: auto; align-self: flex-start;">${tableEl.outerHTML}</div>`;
    
    container.style.display = 'flex';
    setTimeout(() => container.classList.add('show'), 10);
};

window.openPlotPreview = function(initialSrc, cellElement) {
    let container = initPreviewContainer();
    const state = getEnvState();

    document.getElementById('previewTitle').textContent = 'Plot Preview';
    document.getElementById('previewIcon').className = 'ri-bar-chart-2-line';
    
    document.getElementById('plotZoomIn').style.display = 'block';
    document.getElementById('plotZoomOut').style.display = 'block';
    document.getElementById('previewNavControls').style.display = 'flex';

    const downloadBtn = document.getElementById('plotDownload');
    downloadBtn.style.display = 'block';
    const newDownloadBtn = downloadBtn.cloneNode(true);
    downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);
    newDownloadBtn.addEventListener('click', () => {
        const img = document.getElementById('plotPreviewImg');
        if(img) {
            const a = document.createElement('a');
            a.href = img.src;
            a.download = `plot_export_${Date.now()}.png`;
            a.click();
        }
    });

    const contentArea = document.getElementById('previewContentArea');
    const bgStr = (window.appSettings && window.appSettings.nbPlotBackground === 'Transparent') ? 'transparent' : '#fff';
    contentArea.style.background = bgStr;

    contentArea.innerHTML = `<img id="plotPreviewImg" src="" style="max-width:100%; transition: transform 0.2s ease, max-width 0.2s ease; transform-origin: center center;" />`;

    const activePane = document.querySelector('.content-pane.active');
    if (!activePane) return;

    const allPlotImgs = activePane.querySelectorAll('.output-plot-img'); 
    state.plotNavList = [];
    
    allPlotImgs.forEach((imgEl) => {
        const parentCell = imgEl.closest('.cell');
        const cellIndex = parentCell ? Array.from(parentCell.closest('.cells-container').querySelectorAll('.cell')).indexOf(parentCell) + 1 : '?';
        const tab = document.querySelector('.tab[data-target="' + activePane.id + '"]');
        const fName = tab ? tab.querySelector('span').textContent : 'notebook';
        
        state.plotNavList.push({
            src: imgEl.src,
            cellNum: cellIndex,
            fileName: fName
        });
    });

    state.plotNavIndex = state.plotNavList.findIndex(p => p.src === initialSrc);
    if (state.plotNavIndex === -1) state.plotNavIndex = 0; 
    
    state.currentPlotZoom = 1;
    window.renderPlotPreviewIndex();
    
    container.style.display = 'flex';
    setTimeout(() => container.classList.add('show'), 10);
};

window.renderPlotPreviewIndex = function() {
    const state = getEnvState();
    if (!state.plotNavList || state.plotNavList.length === 0) return;
    const data = state.plotNavList[state.plotNavIndex];
    
    const imgEl = document.getElementById('plotPreviewImg');
    if (imgEl) {
        imgEl.src = data.src;
        state.currentPlotZoom = 1;
        imgEl.style.transform = `scale(${state.currentPlotZoom})`;
    }
    
    document.getElementById('plotFileName').textContent = data.fileName;
    document.getElementById('plotCellNum').textContent = 'Cell ' + data.cellNum;

    const backBtn = document.getElementById('plotNavBack');
    const fwdBtn = document.getElementById('plotNavFwd');
    
    if (state.plotNavIndex > 0) backBtn.classList.remove('disabled');
    else backBtn.classList.add('disabled');
    
    if (state.plotNavIndex < state.plotNavList.length - 1) fwdBtn.classList.remove('disabled');
    else fwdBtn.classList.add('disabled');
};

window.updatePlotZoom = function(delta) {
    const state = getEnvState();
    state.currentPlotZoom += delta;
    if (state.currentPlotZoom < 0.2) state.currentPlotZoom = 0.2;
    if (state.currentPlotZoom > 5) state.currentPlotZoom = 5;
    const imgEl = document.getElementById('plotPreviewImg');
    if (imgEl) {
        imgEl.style.transform = `scale(${state.currentPlotZoom})`;
    }
};
