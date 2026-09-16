// ==========================================
// preview.js
// ==========================================

(function initLivePreview() {
    // Reload strategy is a global (not per-window) preference: whichever page or
    // window you're previewing, you almost certainly want the same reload behavior
    // everywhere, and it's a low-level technical fallback rather than a per-project
    // setting - so it lives directly in localStorage rather than in the per-window
    // codemini_preview_state_* blob or the app's broader settings-profile.js system.
    const RELOAD_MODE_KEY = 'codemini_preview_reload_mode';
    function getReloadMode() {
        const stored = localStorage.getItem(RELOAD_MODE_KEY);
        return stored === 'legacy' ? 'legacy' : 'navigate'; // 'navigate' (default/new) or 'legacy' (old document.write)
    }
    function setReloadMode(mode) {
        localStorage.setItem(RELOAD_MODE_KEY, mode === 'legacy' ? 'legacy' : 'navigate');
    }

    // 1. Inject Styles for the Preview Pane
    const previewStyles = document.createElement('style');
    previewStyles.innerHTML = `
        /* Live Preview Container */
        #livePreviewContainer {
            position: fixed; top: 0; right: 0; width: 55%; height: 100vh;
            background-color: var(--bg-white); z-index: 10000;
            display: flex; flex-direction: column; border-left: 1px solid var(--border-color);
            box-shadow: -5px 0 25px rgba(0, 0, 0, 0.1); transform: translateX(105%);
            transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), width 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), top 0.3s, height 0.3s;
        }
        #livePreviewContainer.show { transform: translateX(0); }
        #livePreviewContainer.maximized { width: 100%; border-left: none;}
        @media (max-width: 768px) {
            #livePreviewContainer { width: 100%; border-left: none; }
            #lpMaximizeBtn, #lpWordCount, #lpDockBtn { display: none !important; }
            /* On narrow viewports there's no room for a side panel without hiding the page entirely
               (and hover doesn't exist on touch anyway) -- use a bottom sheet instead so the element
               that was just tapped stays visible above the panel for picking a different one. */
            .lp-inspector-panel { top: auto; left: 0; right: 0; bottom: 0; width: 100%; max-width: 100%; height: 50%; border-left: none; border-top: 1px solid var(--border-color); }
            .insp-toolbar { gap: 16px; }
            .insp-style-prop { min-width: 100px; }
            .lp-inspector-vresizer { display: flex; }
        }
        .lp-inspector-vresizer {
            display: none;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            height: 18px;
            margin: -4px 0 -8px 0;
            cursor: ns-resize;
            touch-action: none;
            position: relative;
            z-index: 1;
        }
        .lp-inspector-vresizer::after {
            content: '';
            width: 36px;
            height: 4px;
            border-radius: 2px;
            background: var(--border-color);
            transition: background 0.2s;
        }
        .lp-inspector-vresizer:hover::after,
        .lp-inspector-vresizer.dragging::after {
            background: var(--accent-blue);
        }
        .lp-header { display: flex; justify-content: space-between; align-items: center; height: 36px; padding: 0 15px; background-color: var(--bg-panel); border-bottom: 1px solid var(--border-color); color: var(--text-main); font-size: 14px; flex-shrink: 0; }
        .lp-header-left { display: flex; align-items: center; gap: 6px; font-weight: 600; }
        .lp-header-left i { font-size: 15px; color: var(--accent-blue); }
        .lp-loader { display: none; animation: spinStatus 0.8s linear infinite; }
        .lp-loader.show { display: inline-block; }
        .lp-header-right { display: flex; align-items: center; gap: 12px; color: var(--icon-gray); font-size: 16px; }
        .lp-header-right i { cursor: pointer; transition: color 0.2s; }
        .lp-header-right i:hover, .lp-header-right i.active-state { color: var(--text-main); }
        .lp-resources-panel { display: none; flex-direction: column; background-color: var(--bg-white); border-bottom: 1px solid var(--border-color); padding: 10px 15px; font-size: 12px; max-height: 260px; overflow-y: auto; -webkit-overflow-scrolling: touch; flex-shrink: 0; color: var(--text-main); }
        .lp-resources-panel.show { display: flex; }
        .res-group-title { font-weight: 600; margin-bottom: 5px; margin-top: 8px; color: var(--text-muted); text-transform: uppercase; font-size: 10px; flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .res-group-title:first-child { margin-top: 0; }
        .res-group-title .rg-count { font-weight: 500; text-transform: none; color: var(--text-muted); background: var(--bg-panel); border-radius: 10px; padding: 0 6px; font-size: 10px; }
        .res-group-title .rg-actions { display: flex; align-items: center; gap: 10px; margin-left: auto; }
        .res-item { display: flex; align-items: center; gap: 6px; padding: 3px 0; font-family: var(--font-mono); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0;}
        .res-linked { color: var(--term-green); }
        .res-unlinked { color: var(--term-red); }
        .res-external { color: var(--term-blue); }
        .res-error { color: var(--term-yellow); white-space: normal; }
        /* Preview Settings Panel */
        .lp-settings-group { display: flex; flex-direction: column; gap: 8px; }
        .lp-settings-label { font-weight: 600; text-transform: uppercase; font-size: 10px; color: var(--text-muted); letter-spacing: 0.3px; }
        .lp-settings-desc { color: var(--text-muted); font-size: 11px; line-height: 1.5; margin-bottom: 2px; }
        .lp-settings-radio-row { display: flex; align-items: center; gap: 8px; padding: 6px 4px; cursor: pointer; font-size: 12px; color: var(--text-main); border-radius: 4px; }
        .lp-settings-radio-row:hover { background: var(--bg-panel); }
        .lp-settings-radio-row input[type="radio"] { accent-color: var(--accent-blue); cursor: pointer; flex-shrink: 0; }
        .lp-settings-tag { font-size: 9px; font-weight: 600; text-transform: uppercase; color: var(--accent-blue); background: rgba(77, 184, 255, 0.15); border-radius: 8px; padding: 1px 6px; margin-left: 6px; }
        /* Storage Manager Toolbar */
        .sm-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-shrink: 0; flex-wrap: wrap; }
        .sm-scope-toggle { display: flex; border: 1px solid var(--border-color); border-radius: 5px; overflow: hidden; flex-shrink: 0; }
        .sm-scope-btn { padding: 4px 9px; font-size: 11px; cursor: pointer; background: var(--bg-white); color: var(--text-muted); border: none; font-family: inherit; }
        .sm-scope-btn.active { background: var(--accent-blue); color: #fff; }
        .sm-search-wrap { position: relative; flex: 1; min-width: 120px; }
        .sm-search-wrap i { position: absolute; left: 7px; top: 50%; transform: translateY(-50%); font-size: 12px; color: var(--text-muted); }
        .sm-search { width: 100%; box-sizing: border-box; padding: 5px 8px 5px 24px; font-size: 11px; border: 1px solid var(--border-color); border-radius: 5px; background: var(--bg-white); color: var(--text-main); font-family: var(--font-mono); }
        .sm-toolbar-icons { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .sm-toolbar-icons i { font-size: 14px; cursor: pointer; color: var(--icon-gray); }
        .sm-toolbar-icons i:hover { color: var(--text-main); }
        .sm-import-input { display: none; }
        .res-item.sm-item { justify-content: space-between; white-space: normal; }
        .sm-key-main { display: flex; align-items: center; gap: 5px; overflow: hidden; flex: 1; min-width: 0; }
        .sm-key-name { flex-shrink: 0; }
        .sm-key-val { color: var(--term-green); overflow: hidden; text-overflow: ellipsis; }
        .sm-key-actions { display: flex; gap: 7px; flex-shrink: 0; margin-left: 8px; }
        .sm-origin-tag { font-size: 9px; padding: 0 5px; border-radius: 8px; background: var(--bg-panel); color: var(--text-muted); text-transform: none; font-family: var(--font-sans, inherit); flex-shrink: 0; }
        .sm-origin-tag.sm-origin-self { color: var(--term-green); }
        .sm-empty-state { text-align: center; color: var(--text-muted); font-style: italic; padding: 14px 0; font-size: 11px; }
        .sm-edit-input { flex: 1; font-family: var(--font-mono); font-size: 11px; padding: 2px 5px; border: 1px solid var(--accent-blue); border-radius: 3px; background: var(--bg-white); color: var(--text-main); min-width: 0; }
        /* Expandable value / IndexedDB browser */
        .sm-item.expandable > .sm-key-main { cursor: pointer; }
        .sm-key-main .sm-caret { font-size: 9px; color: var(--text-muted); transition: transform 0.15s; flex-shrink: 0; }
        .sm-item.sm-expanded .sm-caret { transform: rotate(90deg); }
        .sm-expand-panel { display: none; margin: 4px 0 8px 0; padding: 8px 10px; background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 5px; font-family: var(--font-mono); font-size: 11px; }
        .sm-item.sm-expanded + .sm-expand-panel { display: block; }
        .sm-value-pre { margin: 0; white-space: pre-wrap; word-break: break-all; max-height: 220px; overflow-y: auto; color: var(--text-main); }
        .sm-expand-toolbar { display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 6px; }
        .sm-expand-toolbar i { cursor: pointer; color: var(--icon-gray); font-size: 13px; }
        .sm-expand-toolbar i:hover { color: var(--text-main); }
        .sm-idb-loading { color: var(--text-muted); font-style: italic; padding: 4px 0; }
        .sm-idb-store { margin: 2px 0 2px 15px; }
        .sm-idb-store-title { display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 3px 0; color: var(--text-main); }
        .sm-idb-store-title .rg-count { font-weight: 500; color: var(--text-muted); background: var(--bg-white); border-radius: 10px; padding: 0 6px; font-size: 10px; }
        .sm-idb-records { display: none; margin-left: 18px; border-left: 1px dashed var(--border-color); padding-left: 10px; }
        .sm-idb-store.sm-expanded .sm-idb-records { display: block; }
        .sm-idb-store.sm-expanded .sm-caret { transform: rotate(90deg); }
        .sm-idb-record { padding: 4px 0; border-bottom: 1px dashed var(--border-color); }
        .sm-idb-record:last-child { border-bottom: none; }
        .sm-idb-record-key { color: var(--term-yellow); font-size: 10px; margin-bottom: 2px; }
        .sm-idb-record pre { margin: 0; white-space: pre-wrap; word-break: break-all; font-size: 11px; max-height: 150px; overflow-y: auto; }
        .lp-content-wrapper { flex: 1; display: flex; flex-direction: column; overflow: hidden; background-color: var(--border-color); position: relative; }
        .lp-content { flex: 1; display: flex; justify-content: center; align-items: center; position: relative; overflow: hidden; }
        .lp-content iframe { width: 100%; height: 100%; border: none; outline: none; background-color: #ffffff; transition: width 0.3s ease, height 0.3s ease; }
        .lp-inspector-panel { position: absolute; top: 0; right: 0; bottom: 0; width: 320px; max-width: 85%; background-color: var(--bg-white); color: var(--text-main); font-family: var(--font-mono); font-size: 12px; display: none; flex-direction: column; z-index: 10003; border-left: 1px solid var(--border-color); box-shadow: -6px 0 15px rgba(0,0,0,0.08); }
        .lp-inspector-panel.show { display: flex; }
        .insp-breadcrumb { display: flex; align-items: center; gap: 2px; padding: 6px 8px; border-bottom: 1px solid var(--border-color); overflow-x: auto; white-space: nowrap; flex-shrink: 0; -webkit-overflow-scrolling: touch; }
        .insp-breadcrumb::-webkit-scrollbar { height: 3px; }
        .insp-crumb { color: var(--text-muted); cursor: pointer; padding: 2px 4px; border-radius: 3px; font-size: 11px; flex-shrink: 0; }
        .insp-crumb:hover { background: var(--hover-blue); color: var(--text-main); }
        .insp-crumb.insp-crumb-active { color: var(--accent-blue); font-weight: 600; background: var(--hover-blue); }
        .insp-crumb-sep { color: var(--text-muted); font-size: 10px; flex-shrink: 0; }
        .insp-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid var(--border-color); flex-shrink: 0; gap: 6px; }
        .insp-header-title { display: flex; align-items: baseline; gap: 3px; overflow: hidden; }
        .insp-tag { color: var(--term-blue); font-weight: 600; }
        .insp-id { color: var(--term-yellow); }
        .insp-classes { color: var(--term-green); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .insp-lock-indicator { font-size: 10px; padding: 1px 6px; border-radius: 8px; background: var(--bg-panel); color: var(--text-muted); flex-shrink: 0; }
        .insp-lock-indicator.locked { background: rgba(255, 82, 82, 0.15); color: var(--color-danger); }
        .insp-tabs { display: flex; border-bottom: 1px solid var(--border-color); flex-shrink: 0; }
        .insp-tab { flex: 1; text-align: center; padding: 6px 4px; font-size: 11px; color: var(--text-muted); cursor: pointer; border-bottom: 2px solid transparent; }
        .insp-tab:hover { color: var(--text-main); }
        .insp-tab.active { color: var(--accent-blue); border-bottom-color: var(--accent-blue); font-weight: 500; }
        .insp-toolbar { display: flex; gap: 10px; padding: 6px 10px; border-bottom: 1px solid var(--border-color); flex-shrink: 0; }
        .insp-toolbar i { font-size: 13px; cursor: pointer; color: var(--icon-gray); }
        .insp-toolbar i:hover { color: var(--text-main); }
        .insp-body { flex: 1; overflow-y: auto; padding: 10px; -webkit-overflow-scrolling: touch; }
        .insp-empty { color: var(--text-muted); font-style: italic; text-align: center; padding: 30px 10px; font-size: 11px; }
        /* Box model diagram */
        .insp-boxmodel { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 0 16px 0; }
        .insp-box-margin { background: rgba(255, 165, 0, 0.15); border: 1px dashed rgba(255, 165, 0, 0.5); padding: 16px; position: relative; }
        .insp-box-border { background: rgba(255, 230, 130, 0.2); border: 1px dashed rgba(220, 190, 60, 0.6); padding: 14px; position: relative; }
        .insp-box-padding { background: rgba(140, 200, 120, 0.2); border: 1px dashed rgba(100, 180, 90, 0.6); padding: 14px; position: relative; }
        .insp-box-content { background: rgba(110, 168, 254, 0.25); border: 1px solid rgba(70, 130, 220, 0.6); padding: 10px 16px; min-width: 50px; text-align: center; font-size: 11px; color: var(--text-main); }
        .insp-box-label { position: absolute; font-size: 9px; color: var(--text-muted); }
        .insp-box-label.lbl-top { top: 1px; left: 50%; transform: translateX(-50%); }
        .insp-box-label.lbl-right { right: 3px; top: 50%; transform: translateY(-50%); }
        .insp-box-label.lbl-bottom { bottom: 1px; left: 50%; transform: translateX(-50%); }
        .insp-box-label.lbl-left { left: 3px; top: 50%; transform: translateY(-50%); }
        .insp-box-tag { position: absolute; top: -8px; left: 4px; font-size: 8px; text-transform: uppercase; color: var(--text-muted); background: var(--bg-white); padding: 0 3px; }
        .insp-dims { text-align: center; font-size: 10px; color: var(--text-muted); }
        /* Styles tab */
        .insp-style-search { width: 100%; box-sizing: border-box; padding: 4px 8px; font-size: 11px; border: 1px solid var(--border-color); border-radius: 5px; background: var(--bg-white); color: var(--text-main); font-family: var(--font-mono); margin-bottom: 8px; }
        .insp-style-row { display: flex; padding: 2px 0; gap: 6px; border-bottom: 1px solid var(--border-color); }
        .insp-style-prop { color: var(--accent-blue); flex-shrink: 0; min-width: 130px; }
        .insp-style-val { color: var(--text-main); word-break: break-all; }
        /* Attributes tab */
        .insp-attr-row { display: flex; padding: 3px 0; gap: 6px; border-bottom: 1px solid var(--border-color); align-items: baseline; }
        .insp-attr-name { color: var(--term-yellow); flex-shrink: 0; }
        .insp-attr-val { color: var(--text-main); word-break: break-all; }
        .lp-statusbar { display: flex; justify-content: space-between; align-items: center; height: 26px; padding: 0 15px; background-color: var(--bg-tabs-bar); border-top: 1px solid var(--border-color); color: var(--text-muted); font-size: 12px; flex-shrink: 0; position: relative; z-index: 10002; }
        .lp-status-left, .lp-status-right { display: flex; align-items: center; gap: 12px; }
        .lp-status-left i, .lp-status-right i { font-size: 15px; cursor: pointer; transition: color 0.2s; }
        .lp-status-left i:hover, .lp-status-right i:hover { color: var(--text-main); }
        .lp-status-left i.disabled { opacity: 0.3; cursor: not-allowed; pointer-events: none; }
        .active-state { color: var(--accent-blue) !important; }
        #lpNetworkPanel { position: absolute; left: 0; right: 0; height: 40%; bottom: 0px; background-color: var(--bg-white); border-top: 1px solid var(--border-color); display: none; flex-direction: column; z-index: 10001; box-shadow: 0 -5px 15px rgba(0,0,0,0.05); }
        #lpNetworkPanel.show { display: flex; }
        .network-header { display: flex; justify-content: space-between; align-items: center; padding: 6px 15px; background: var(--bg-white); font-weight: 500; font-size: 12px; color: var(--text-main); flex-shrink: 0; gap: 10px; flex-wrap: wrap; }
        .network-header i { font-size: 14px; cursor: pointer; color: var(--icon-gray); }
        .network-header i:hover { color: var(--text-main); }
        .network-header i.active-state { color: var(--accent-blue); }
        .net-title-group { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .net-count-badge { font-size: 10px; font-weight: 500; background: var(--bg-panel); color: var(--text-muted); border-radius: 9px; padding: 0 6px; }
        .net-count-badge.has-errors { background: rgba(255, 82, 82, 0.15); color: var(--color-danger); }
        .net-filters { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
        .net-filter-btn { font-size: 10px; padding: 2px 8px; border-radius: 10px; cursor: pointer; color: var(--text-muted); background: var(--bg-panel); border: 1px solid transparent; user-select: none; }
        .net-filter-btn.active { background: var(--accent-blue); color: #fff; }
        .net-search-wrap { position: relative; flex: 1; min-width: 100px; }
        .net-search-wrap i { position: absolute; left: 7px; top: 50%; transform: translateY(-50%); font-size: 12px; color: var(--text-muted); cursor: default; }
        .net-search { width: 100%; box-sizing: border-box; padding: 4px 8px 4px 24px; font-size: 11px; border: 1px solid var(--border-color); border-radius: 5px; background: var(--bg-white); color: var(--text-main); font-family: var(--font-mono); }
        .network-body { flex: 1; overflow-y: auto; padding: 5px; font-family: var(--font-mono); font-size: 11px; -webkit-overflow-scrolling: touch; }
        .net-req { display: flex; flex-direction: column; border-bottom: 1px solid var(--border-color); }
        .net-req-row { display: flex; align-items: center; padding: 5px 8px; gap: 8px; color: var(--text-main); cursor: pointer; }
        .net-req-row:hover { background-color: var(--hover-blue); }
        .net-status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: var(--text-muted); }
        .net-status-dot.pending { background: var(--term-yellow); animation: net-pulse 1s ease-in-out infinite; }
        .net-status-dot.success { background: var(--term-green); }
        .net-status-dot.redirect { background: var(--term-blue); }
        .net-status-dot.error { background: var(--color-danger); }
        @keyframes net-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .net-method { font-weight: bold; width: 42px; flex-shrink: 0; color: var(--accent-blue); }
        .net-status-code { width: 32px; flex-shrink: 0; font-weight: 500; }
        .net-status-code.s2 { color: var(--term-green); }
        .net-status-code.s3 { color: var(--term-blue); }
        .net-status-code.s4, .net-status-code.s5 { color: var(--color-danger); }
        .net-url { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
        .net-meta { display: flex; gap: 8px; flex-shrink: 0; color: var(--text-muted); font-size: 10px; }
        .net-source { width: 34px; text-align: right; }
        .net-caret { font-size: 9px; color: var(--text-muted); transition: transform 0.15s; flex-shrink: 0; }
        .net-req.net-expanded .net-caret { transform: rotate(90deg); }
        .net-req.net-expanded .net-req-row { background-color: var(--hover-blue); }
        .net-detail { display: none; padding: 8px 10px 10px 30px; background: var(--bg-panel); font-size: 11px; }
        .net-req.net-expanded .net-detail { display: block; }
        .net-detail-toolbar { display: flex; justify-content: flex-end; gap: 12px; margin-bottom: 6px; }
        .net-detail-toolbar i { font-size: 12px; cursor: pointer; color: var(--icon-gray); }
        .net-detail-toolbar i:hover { color: var(--text-main); }
        .net-detail-section { margin-bottom: 8px; }
        .net-detail-section:last-child { margin-bottom: 0; }
        .net-detail-title { font-size: 10px; text-transform: uppercase; color: var(--text-muted); font-weight: 600; margin-bottom: 3px; }
        .net-kv { display: flex; gap: 6px; padding: 1px 0; }
        .net-kv-key { color: var(--accent-blue); flex-shrink: 0; }
        .net-kv-val { color: var(--text-main); word-break: break-all; }
        .net-body-pre { margin: 0; white-space: pre-wrap; word-break: break-all; max-height: 180px; overflow-y: auto; background: var(--bg-white); border: 1px solid var(--border-color); border-radius: 4px; padding: 6px 8px; color: var(--text-main); }
        .net-empty-detail { color: var(--text-muted); font-style: italic; }
        .net-empty-state { text-align: center; color: var(--text-muted); font-style: italic; padding: 20px 0; font-size: 11px; }
        #lpConsolePanel { height: 0; background-color: var(--term-bg); color: var(--term-text); font-family: 'Fira Code', Consolas, monospace; display: flex; flex-direction: column; border-top: 1px solid var(--border-color); transition: height 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); overflow: hidden; font-size: 13px; z-index: 10001; }
        #lpConsolePanel.show { height: 45%; }
        .console-header-term { display: flex; justify-content: space-between; align-items: center; padding: 6px 15px; background: var(--term-bg); color: var(--term-text); font-size: 13px; font-weight: bold; flex-shrink: 0; }
        .console-filters { display: flex; gap: 10px; align-items: center; font-weight: normal; }
        .console-filter-btn { cursor: pointer; color: var(--term-gray); transition: color 0.2s; font-weight: 500; }
        .console-filter-btn:hover, .console-filter-btn.active { color: var(--accent-blue); font-weight: 600; }
        .console-body-term { flex: 1; padding: 15px; overflow-y: auto; scroll-behavior: smooth; display: flex; flex-direction: column; }
        #lpConsoleContent.filter-error .console-entry:not(.console-error) { display: none; }
        #lpConsoleContent.filter-warn .console-entry:not(.console-warn) { display: none; }
        #lpConsoleContent.filter-log .console-entry:not(.console-log):not(.console-info):not(.console-result) { display: none; }
        .term-output { display: flex; flex-direction: column; margin-bottom: 5px; word-wrap: break-word; flex: 1; }
        .term-input-row { display: flex; align-items: flex-start; gap: 8px; margin-top: auto; flex-shrink: 0; }
        .console-entry { display: flex; flex-direction: column; margin-bottom: 12px; word-wrap: break-word; white-space: pre-wrap; line-height: 1.4; border-bottom: 1px dashed rgba(255,255,255,0.05); padding-bottom: 8px; }
        .console-entry:last-child { border-bottom: none; }
        .console-error { color: var(--term-red); }
        .console-warn { color: var(--term-yellow); }
        .console-info { color: var(--term-blue); }
        .console-log { color: var(--term-text); }
        .console-result { color: var(--term-green); }
        .tree-node { margin-left: 15px; }
        .tree-caret { cursor: pointer; user-select: none; color: var(--term-blue); }
        .tree-caret::before { content: '▶'; display: inline-block; margin-right: 5px; transition: transform 0.2s; font-size: 10px; }
        .tree-caret.tree-caret-down::before { transform: rotate(90deg); }
        .tree-nested { display: none; }
        .tree-active { display: block; }
        .tree-key { color: var(--term-yellow); }
        .tree-string { color: var(--term-green); }
        .tree-number { color: #d19a66; }
        .tree-boolean { color: #c678dd; }
        .tree-null { color: var(--term-gray); font-style: italic; }
    `;
    document.head.appendChild(previewStyles);

    // 2. Inject HTML Structure
    const previewContainer = document.createElement('div');
    previewContainer.id = 'livePreviewContainer';
    previewContainer.innerHTML = `
        <div class="lp-resizer" id="lpResizer"></div>
        <div class="lp-header">
            <div class="lp-header-left">
                <i class="ri-flashlight-line"></i> Live Preview 
                <i class="ri-loader-4-line lp-loader" id="lpLoader"></i>
            </div>
            <div class="lp-header-right">
                <i class="ri-database-2-line" id="lpStorageManagerBtn" title="Storage Manager" style="display:none;"></i>
                <i class="ri-links-line" id="lpResourcesBtn" title="Linked Resources" style="display:none;"></i>
                <i class="ri-settings-3-line" id="lpSettingsBtn" title="Preview Settings"></i>
                <i class="ri-external-link-line" id="lpPopOutBtn" title="Open in External Browser"></i>
                <i class="ri-layout-right-line hide-on-mobile" id="lpDockBtn" title="Dock to Right"></i>
                <div class="hide-on-mobile" style="width: 1px; height: 16px; background: var(--border-color); margin: 0 8px;"></div>
                <i class="ri-refresh-line" id="lpRefreshBtn" title="Reload (Shift+Click for Hard Cache Clear)"></i>
                <i class="ri-fullscreen-line" id="lpMaximizeBtn" title="Toggle Fullscreen"></i>
                <i class="ri-close-line" id="lpCloseBtn" title="Close Preview"></i>
            </div>
        </div>

        <div id="lpResourcesPanel" class="lp-resources-panel"></div>
        <div id="lpSettingsPanel" class="lp-resources-panel">
            <div class="lp-settings-group">
                <div class="lp-settings-label">Reload Strategy</div>
                <div class="lp-settings-desc">How the preview applies each reload. "Full Navigation" starts a genuinely fresh page each time (recommended - correctly resets live connections like Supabase realtime, WebSockets, or polling). "Legacy" reuses the existing page in place and can leave old connections running alongside new ones.</div>
                <label class="lp-settings-radio-row">
                    <input type="radio" name="lpReloadMode" id="lpReloadModeNavigate" value="navigate">
                    <span>Full Navigation <span class="lp-settings-tag">Recommended</span></span>
                </label>
                <label class="lp-settings-radio-row">
                    <input type="radio" name="lpReloadMode" id="lpReloadModeLegacy" value="legacy">
                    <span>Legacy (in-place rewrite)</span>
                </label>
            </div>
        </div>
        <div id="lpStoragePanel" class="lp-resources-panel">
            <div class="sm-toolbar">
                <div class="sm-scope-toggle" id="smScopeToggle">
                    <button type="button" class="sm-scope-btn active" data-scope="file" title="Only keys attributed to the previewed file and its linked local files">This File</button>
                    <button type="button" class="sm-scope-btn" data-scope="all" title="All storage keys in this preview">All Keys</button>
                </div>
                <div class="sm-search-wrap">
                    <i class="ri-search-line"></i>
                    <input type="text" class="sm-search" id="smSearchInput" placeholder="Filter keys...">
                </div>
                <div class="sm-toolbar-icons">
                    <i class="ri-download-2-line" id="smExportBtn" title="Export visible keys as JSON"></i>
                    <i class="ri-upload-2-line" id="smImportBtn" title="Import keys from JSON"></i>
                    <input type="file" id="smImportInput" class="sm-import-input" accept="application/json">
                </div>
            </div>
            <div id="lpStoragePanelBody"></div>
        </div>
        
        <div class="lp-content-wrapper">
            <div class="lp-content" id="lpContentBackground">
                <iframe id="lpIframe" sandbox="allow-scripts allow-same-origin allow-modals allow-popups allow-forms"></iframe>
            </div>
            
            <div id="lpInspectorPanel" class="lp-inspector-panel">
                <div class="lp-inspector-vresizer" id="lpInspectorVResizer"></div>
                <div class="insp-breadcrumb" id="inspBreadcrumb"></div>
                <div class="insp-header">
                    <div class="insp-header-title" id="inspHeaderTitle"></div>
                    <span class="insp-lock-indicator" id="inspLockIndicator">Hover</span>
                </div>
                <div class="insp-toolbar">
                    <i class="ri-file-copy-line" id="inspCopyHtml" title="Copy outerHTML"></i>
                    <i class="ri-code-line" id="inspCopySelector" title="Copy CSS Selector"></i>
                    <i class="ri-braces-line" id="inspCopyStyles" title="Copy Computed Styles as JSON"></i>
                </div>
                <div class="insp-tabs" id="inspTabs">
                    <div class="insp-tab active" data-tab="styles">Styles</div>
                    <div class="insp-tab" data-tab="boxmodel">Box Model</div>
                    <div class="insp-tab" data-tab="attributes">Attributes</div>
                </div>
                <div class="insp-body" id="inspBody">
                    <div class="insp-empty">Hover an element in the preview to inspect it. Click to lock the selection.</div>
                </div>
            </div>

            <div id="lpNetworkPanel">
                <div class="network-header">
                    <div class="net-title-group">
                        <span>Network</span>
                        <span class="net-count-badge" id="netCountBadge">0</span>
                    </div>
                    <div class="net-filters" id="netFilters">
                        <span class="net-filter-btn active" data-filter="all">All</span>
                        <span class="net-filter-btn" data-filter="fetch">Fetch</span>
                        <span class="net-filter-btn" data-filter="xhr">XHR</span>
                        <span class="net-filter-btn" data-filter="error">Errors</span>
                    </div>
                    <div class="net-search-wrap">
                        <i class="ri-search-line"></i>
                        <input type="text" class="net-search" id="netSearchInput" placeholder="Filter URL...">
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <i class="ri-eraser-line" id="lpAutoClearNetwork" title="Auto-clear on navigation/reload: OFF"></i>
                        <i class="ri-delete-bin-line" id="lpClearNetwork" title="Clear Logs"></i>
                        <i class="ri-close-line" id="lpCloseNetwork" title="Close Panel"></i>
                    </div>
                </div>
                <div class="network-body" id="lpNetworkContent"></div>
            </div>

            <div id="lpConsolePanel">
                <div class="console-header-term">
                    <span style="margin-right:5px;">Console</span>
                    <div class="console-filters">
                        <span class="console-filter-btn active" data-filter="all">All</span>
                        <span class="console-filter-btn" data-filter="error">Errors</span>
                        <span class="console-filter-btn" data-filter="warn">Warns</span>
                        <span class="console-filter-btn" data-filter="log">Logs</span>
                        <div style="width: 1px; height: 12px; background: var(--term-gray); margin: 0 5px;"></div>
                        <i class="ri-lock-unlock-line" id="lpScrollLock" style="cursor: pointer; color: var(--accent-blue);" title="Auto-Scroll: ON"></i>
                        <i class="ri-delete-bin-line" id="lpClearConsole" style="cursor: pointer; margin-left: 5px;" title="Clear Console"></i>
                        <i class="ri-close-line" id="lpCloseConsole" style="cursor: pointer; margin-left: 5px;" title="Hide Console"></i>
                    </div>
                </div>
                <div class="console-body-term">
                    <div class="term-output" id="lpConsoleContent"></div>
                    <div class="term-input-row">
                        <span style="white-space: nowrap;"><span style="color: var(--term-prompt-user);">></span>
                        <input type="text" class="term-input" id="lpConsoleInput" autocomplete="off" spellcheck="false" style="flex: 1; background: transparent; border: none; color: var(--term-cmd-text); outline: none; font-family: inherit; font-size: 13px; min-width: 0;">
                    </div>
                </div>
            </div>
        </div>

        <div class="lp-statusbar">
            <div class="lp-status-left" style="margin-left: 2px;">
                <i class="ri-arrow-left-line disabled" id="lpNavBack" title="Go Back"></i>
                <i class="ri-arrow-right-line disabled" id="lpNavFwd" title="Go Forward"></i>
                <div class="hide-on-mobile" style="width: 1px; height: 16px; background: var(--border-color); margin: 0 8px;"></div>
                <i class="ri-loop-right-line active-state" id="lpAutoReloadBtn" title="Auto-Reload: ON"></i>
                <i class="ri-terminal-box-line" id="lpToggleConsole" title="Toggle Console"></i>
                <i class="ri-global-line" id="lpNetworkBtn" title="Network Monitor"></i>
                <i class="ri-focus-3-line" id="lpInspectorBtn" title="DOM Inspector"></i>
                <div class="hide-on-mobile" style="width: 1px; height: 16px; background: var(--border-color); margin: 0 8px;"></div>
                <i class="ri-shape-line" id="lpLayoutDebugBtn" title="Toggle Layout Outlines"></i>
                <i class="ri-edit-2-line hide-on-mobile" id="lpToggleEditMode" title="Toggle Edit Mode (Design Mode)"></i>
                <i class="ri-grid-line hide-on-mobile" id="lpToggleGrid" title="Toggle Grid Overlay"></i>
            </div>
            <div class="lp-status-right">
                <span id="lpCurrentFileLabel">preview</span>
                <span id="lpWordCount" style="color: var(--accent-blue); font-weight: bold;"></span>
            </div>
        </div>
    `;
    document.body.appendChild(previewContainer);

    // 3. DOM Elements
    const playIconItem = document.getElementById('playIconItem');
    const lpLoader = document.getElementById('lpLoader');
    const lpRefreshBtn = document.getElementById('lpRefreshBtn');
    const lpMaximizeBtn = document.getElementById('lpMaximizeBtn');
    const lpDockBtn = document.getElementById('lpDockBtn');
    const lpCloseBtn = document.getElementById('lpCloseBtn');
    const lpPopOutBtn = document.getElementById('lpPopOutBtn');
    const lpAutoReloadBtn = document.getElementById('lpAutoReloadBtn');
    
    const lpNavBack = document.getElementById('lpNavBack');
    const lpNavFwd = document.getElementById('lpNavFwd');
    
    const lpToggleConsole = document.getElementById('lpToggleConsole');
    const lpCloseConsole = document.getElementById('lpCloseConsole');
    const lpConsolePanel = document.getElementById('lpConsolePanel');
    const lpConsoleContent = document.getElementById('lpConsoleContent');
    const lpClearConsole = document.getElementById('lpClearConsole');
    const lpConsoleInput = document.getElementById('lpConsoleInput');
    const lpScrollLock = document.getElementById('lpScrollLock');
    
    const lpNetworkBtn = document.getElementById('lpNetworkBtn');
    const lpNetworkPanel = document.getElementById('lpNetworkPanel');
    const lpCloseNetwork = document.getElementById('lpCloseNetwork');
    const lpClearNetwork = document.getElementById('lpClearNetwork');
    const lpNetworkContent = document.getElementById('lpNetworkContent');
    const netCountBadge = document.getElementById('netCountBadge');
    const netFilters = document.getElementById('netFilters');
    const netSearchInput = document.getElementById('netSearchInput');
    const lpAutoClearNetwork = document.getElementById('lpAutoClearNetwork');

    const lpResourcesBtn = document.getElementById('lpResourcesBtn');
    const lpResourcesPanel = document.getElementById('lpResourcesPanel');
    const lpSettingsBtn = document.getElementById('lpSettingsBtn');
    const lpSettingsPanel = document.getElementById('lpSettingsPanel');
    const lpReloadModeNavigate = document.getElementById('lpReloadModeNavigate');
    const lpReloadModeLegacy = document.getElementById('lpReloadModeLegacy');
    const lpStorageManagerBtn = document.getElementById('lpStorageManagerBtn');
    const lpStoragePanel = document.getElementById('lpStoragePanel');
    const lpStoragePanelBody = document.getElementById('lpStoragePanelBody');
    const smScopeToggle = document.getElementById('smScopeToggle');
    const smSearchInput = document.getElementById('smSearchInput');
    const smExportBtn = document.getElementById('smExportBtn');
    const smImportBtn = document.getElementById('smImportBtn');
    const smImportInput = document.getElementById('smImportInput');

    const lpInspectorBtn = document.getElementById('lpInspectorBtn');
    const lpInspectorPanel = document.getElementById('lpInspectorPanel');
    const inspBreadcrumb = document.getElementById('inspBreadcrumb');
    const inspHeaderTitle = document.getElementById('inspHeaderTitle');
    const inspLockIndicator = document.getElementById('inspLockIndicator');
    const inspTabs = document.getElementById('inspTabs');
    const inspBody = document.getElementById('inspBody');
    const inspCopyHtml = document.getElementById('inspCopyHtml');
    const inspCopySelector = document.getElementById('inspCopySelector');
    const inspCopyStyles = document.getElementById('inspCopyStyles');
    const lpLayoutDebugBtn = document.getElementById('lpLayoutDebugBtn');
    const lpToggleEditMode = document.getElementById('lpToggleEditMode');
    const lpToggleGrid = document.getElementById('lpToggleGrid');

    const lpCurrentFileLabel = document.getElementById('lpCurrentFileLabel');
    const lpWordCount = document.getElementById('lpWordCount');

    // Reflect the persisted global reload-mode preference in the settings panel's
    // radio group as soon as it exists, so re-opening the panel later (or a fresh
    // page load) always shows the choice that's actually in effect.
    (lpReloadMode => {
        if (lpReloadMode === 'legacy') lpReloadModeLegacy.checked = true;
        else lpReloadModeNavigate.checked = true;
    })(getReloadMode());

    // 4. SCOPED PREVIEW STATE REGISTRY & PERSISTENCE
    const previewStateRegistry = {};

    function getPreviewState() {
        const winId = localStorage.getItem('codemini_active_window') || 'win_default';
        if (!previewStateRegistry[winId]) {
            const stored = localStorage.getItem(`codemini_preview_state_${winId}`);
            let parsed = stored ? JSON.parse(stored) : {};
            
            previewStateRegistry[winId] = {
                navHistory: [],
                currentNavIndex: -1,
                activeObjectUrls: {},
                moduleFileIds: new Set(), // file ids whose blob must load as <script type="module">
                jsImportedCssFileIds: new Set(), // css files pulled in via a JS-side `import './x.css'`
                moduleTranspileReport: null, // last transpileAndLinkModules() result - packages/errors for the resources panel
                moduleImportMap: null, // { imports: {...} } - injected as <script type="importmap"> so module scripts can resolve local/aliased/npm specifiers
                isMaximized: parsed.isMaximized || false,
                isDocked: parsed.isDocked || false,
                dockWidth: parsed.dockWidth || 45, // vw percent
                inspectorMobileHeight: parsed.inspectorMobileHeight || null, // px, mobile bottom-sheet height
                autoReloadEnabled: parsed.autoReloadEnabled !== undefined ? parsed.autoReloadEnabled : true,
                autoScrollConsole: parsed.autoScrollConsole !== undefined ? parsed.autoScrollConsole : true,
                inspectorEnabled: false,
                layoutDebugEnabled: false,
                editModeEnabled: false,
                gridEnabled: false,
                storageScope: 'file', // 'file' = only current file + linked local files, 'all' = everything
                storageFilter: '',
                storageExpandedKeys: new Set(), // remembers which rows are expanded across re-renders (e.g. "ls:theme", "idb:MyDB")
                lastResourceReport: { linked: [], unlinked: [], external: [] },
                lastStorageData: null, // cache of most recent fetch-storage response for re-filtering client-side
                networkEntries: new Map(), // reqId -> entry, correlates request-start with its eventual response/error
                networkFilter: 'all', // 'all' | 'fetch' | 'xhr' | 'error'
                networkSearch: '',
                networkExpandedIds: new Set(),
                networkAutoClear: false, // clear the log automatically on every preview reload/navigation
                inspectorLocked: false, // true once the user has clicked an element to pin the selection
                inspectorTab: 'styles', // 'styles' | 'boxmodel' | 'attributes'
                inspectorStyleFilter: '',
                inspectorData: null // most recent element snapshot (hover or locked) from the iframe
            };
        }
        return previewStateRegistry[winId];
    }

    function savePreviewState() {
        const winId = localStorage.getItem('codemini_active_window') || 'win_default';
        const state = previewStateRegistry[winId];
        if (state) {
            localStorage.setItem(`codemini_preview_state_${winId}`, JSON.stringify({
                isMaximized: state.isMaximized,
                isDocked: state.isDocked,
                dockWidth: state.dockWidth,
                inspectorMobileHeight: state.inspectorMobileHeight,
                autoReloadEnabled: state.autoReloadEnabled,
                autoScrollConsole: state.autoScrollConsole
            }));
        }
    }

    function applyDockState(state) {
        if (state.isDocked && !state.isMaximized) {
            document.body.classList.add('preview-docked');
            document.documentElement.style.setProperty('--dock-width', `${state.dockWidth}vw`);
            lpDockBtn.classList.replace('ri-layout-right-line', 'ri-layout-right-fill');
        } else {
            document.body.classList.remove('preview-docked');
            lpDockBtn.classList.replace('ri-layout-right-fill', 'ri-layout-right-line');
        }
    }

    function syncPreviewUI(state) {
        if (state.autoReloadEnabled) {
            lpAutoReloadBtn.classList.add('active-state');
            lpAutoReloadBtn.title = 'Auto-Reload: ON';
        } else {
            lpAutoReloadBtn.classList.remove('active-state');
            lpAutoReloadBtn.title = 'Auto-Reload: OFF';
        }

        if (state.autoScrollConsole) {
            lpScrollLock.classList.replace('ri-lock-line', 'ri-lock-unlock-line');
            lpScrollLock.title = 'Auto-Scroll: ON';
        } else {
            lpScrollLock.classList.replace('ri-lock-unlock-line', 'ri-lock-line');
            lpScrollLock.title = 'Auto-Scroll: OFF';
        }

        applyDockState(state);
    }

    // STRICT ISOLATION API FOR WINDOW CONTEXT SWAPS
    window.forceClosePreview = function(winId) {
        const state = previewStateRegistry[winId];
        if (!state) return;
        
        Object.values(state.activeObjectUrls || {}).forEach(url => URL.revokeObjectURL(url));
        state.activeObjectUrls = {};
        if (state._lastDocUrl) { URL.revokeObjectURL(state._lastDocUrl); state._lastDocUrl = null; }
        if (state._pendingRevokeUrls) {
            // Safety net for the abort case described where oldDocUrl is
            // created above (renderPreviewContent) - a URL can land here
            // without ever reaching its own onload-driven revoke if a window
            // switch/close cut its navigation short first.
            state._pendingRevokeUrls.forEach(url => URL.revokeObjectURL(url));
            state._pendingRevokeUrls.clear();
        }
        state.navHistory = [];
        state.currentNavIndex = -1;
        
        const currentActiveWin = localStorage.getItem('codemini_active_window') || 'win_default';
        if (currentActiveWin === winId || !currentActiveWin) {
            const container = document.getElementById('livePreviewContainer');
            if (container) container.classList.remove('show');
            document.body.classList.remove('preview-docked');
            
            const oldIframe = document.getElementById('lpIframe');
            if (oldIframe) {
                const newIframe = document.createElement('iframe');
                newIframe.id = 'lpIframe';
                newIframe.sandbox = "allow-scripts allow-same-origin allow-modals allow-popups allow-forms";
                oldIframe.parentNode.replaceChild(newIframe, oldIframe);
            }
            
            if(lpConsoleContent) lpConsoleContent.innerHTML = '';
            if(lpNetworkContent) lpNetworkContent.innerHTML = '';
            
            state.layoutDebugEnabled = false;
            state.inspectorEnabled = false;
            state.inspectorLocked = false;
            state.inspectorData = null;
            state.editModeEnabled = false;
            state.gridEnabled = false;
            
            [lpLayoutDebugBtn, lpInspectorBtn, lpToggleEditMode, lpToggleGrid].forEach(btn => {
                if(btn) btn.classList.remove('active-state');
            });
            if(lpInspectorPanel) lpInspectorPanel.classList.remove('show');
            if(lpStoragePanel) lpStoragePanel.classList.remove('show');
            if(lpStorageManagerBtn) lpStorageManagerBtn.classList.remove('active-state');
            // Settings panel is the same shared-singleton dropdown as
            // Inspector/Storage above, but unlike them it has no per-file
            // reset path in renderPreviewContent (it's "always available
            // regardless of what's currently being previewed" - it reflects
            // a global preference, not per-file state) - so without this,
            // it's the one panel that would never close on its own and
            // would carry over open across a window switch indefinitely.
            if(lpSettingsPanel) lpSettingsPanel.classList.remove('show');
            if(lpSettingsBtn) lpSettingsBtn.classList.remove('active-state');
        }
    };

    window.teardownPreviewContext = function(winId) {
        window.forceClosePreview(winId);
        delete previewStateRegistry[winId];
        localStorage.removeItem(`codemini_preview_state_${winId}`);
    };

    // 5. Injected Script (Console, Network, Navigations, Eval, Inspector, Edit, Grid, Storage Manager)
    const injectedInterceptors = `
        <script>
            ['log', 'error', 'warn', 'info'].forEach(method => {
                const original = console[method];
                console[method] = function(...args) {
                    const parsedArgs = args.map(a => {
                        if(typeof a === 'object') {
                            try { return { isObj: true, data: JSON.stringify(a) }; } 
                            catch(e) { return String(a); }
                        }
                        return String(a);
                    });
                    window.parent.postMessage({ type: 'console', level: method, args: parsedArgs }, '*');
                    original.apply(console, args);
                };
            });
            // --- Storage origin attribution ---
            // Tags every localStorage/sessionStorage/IndexedDB write with the script file that made it,
            // so the parent Storage Manager can filter down to the actively previewing file + its
            // linked local dependencies instead of showing everything in the origin.
            (function() {
                const ORIGIN_MAP_KEY = '__cm_storage_origins__';
                function loadOriginMap() {
                    try { return JSON.parse(sessionStorage.getItem(ORIGIN_MAP_KEY) || '{}'); } catch(e) { return {}; }
                }
                function saveOriginMap(map) {
                    try {
                        const raw = JSON.stringify(map);
                        const nativeSet = Storage.prototype.setItem;
                        nativeSet.call(sessionStorage, ORIGIN_MAP_KEY, raw);
                    } catch(e) {}
                }
                function currentScriptFile() {
                    // Prefer document.currentScript (works for synchronous top-level script execution)
                    if (document.currentScript && document.currentScript.src) {
                        const src = document.currentScript.src;
                        // Local blob: URLs back linked .js/.css files created via URL.createObjectURL;
                        // inline <script> tags in the previewed HTML have no .src at all (handled below).
                        if (src.startsWith('blob:')) return src;
                        try { return new URL(src, document.baseURI).pathname.split('/').pop() || src; }
                        catch(e) { return src; }
                    }
                    // No src at all + we're inside a currentScript context means an inline <script> block
                    // in the previewed HTML itself -- treat that as part of the current file.
                    if (document.currentScript) return 'blob:inline';
                    // Fallback for async/deferred calls: parse the call stack for a local blob/script reference
                    try {
                        const stack = new Error().stack || '';
                        const lines = stack.split('\\n');
                        for (const line of lines) {
                            const m = line.match(/(blob:[^\\s):]+|[\\w\\-.]+\\.js)(?=[:)]|\\s|$)/);
                            if (m && m[1] && !m[1].includes('preview.js')) {
                                return m[1].startsWith('blob:') ? m[1] : m[1].split('/').pop();
                            }
                        }
                    } catch(e) {}
                    return document.title || 'index.html';
                }

                // Notifies the parent Storage Manager the instant anything changes, whether the write
                // came from our own panel (edit/delete/import) or from the previewed app's own code
                // (e.g. a button handler calling localStorage.setItem). Debounced so a tight write loop
                // (per-keystroke autosave, bulk import, etc.) coalesces into one refresh instead of flooding.
                let notifyTimer = null;
                function notifyStorageChanged() {
                    if (notifyTimer) return;
                    notifyTimer = setTimeout(() => {
                        notifyTimer = null;
                        window.parent.postMessage({ type: 'storage-updated' }, '*');
                    }, 80);
                }

                function wrapStorage(storageObj, tagPrefix) {
                    const nativeSet = Storage.prototype.setItem;
                    const nativeRemove = Storage.prototype.removeItem;
                    const nativeClear = Storage.prototype.clear;
                    try {
                        Object.defineProperty(storageObj, 'setItem', {
                            value: function(key, value) {
                                if (key !== ORIGIN_MAP_KEY) {
                                    const map = loadOriginMap();
                                    map[tagPrefix + ':' + key] = currentScriptFile();
                                    saveOriginMap(map);
                                    notifyStorageChanged();
                                }
                                return nativeSet.call(this, key, value);
                            }, writable: true, configurable: true
                        });
                        Object.defineProperty(storageObj, 'removeItem', {
                            value: function(key) {
                                const map = loadOriginMap();
                                delete map[tagPrefix + ':' + key];
                                saveOriginMap(map);
                                notifyStorageChanged();
                                return nativeRemove.call(this, key);
                            }, writable: true, configurable: true
                        });
                        Object.defineProperty(storageObj, 'clear', {
                            value: function() {
                                const map = loadOriginMap();
                                Object.keys(map).forEach(k => { if (k.startsWith(tagPrefix + ':')) delete map[k]; });
                                saveOriginMap(map);
                                notifyStorageChanged();
                                return nativeClear.call(this);
                            }, writable: true, configurable: true
                        });
                    } catch(e) {}
                }
                wrapStorage(window.localStorage, 'ls');
                wrapStorage(window.sessionStorage, 'ss');

                if (window.indexedDB && indexedDB.open) {
                    const nativeOpen = indexedDB.open.bind(indexedDB);
                    indexedDB.open = function(name, ...rest) {
                        const map = loadOriginMap();
                        map['idb:' + name] = currentScriptFile();
                        saveOriginMap(map);
                        const req = nativeOpen(name, ...rest);
                        // Wrap every object store this connection opens so writes made by the app's own
                        // code (put/add/delete/clear) are attributed AND trigger a live panel refresh --
                        // without this, IndexedDB writes made outside our own panel are invisible entirely.
                        req.addEventListener('success', () => {
                            try {
                                const idb = req.result;
                                const nativeTransaction = idb.transaction.bind(idb);
                                idb.transaction = function(storeNames, mode, ...rest2) {
                                    const tx = nativeTransaction(storeNames, mode, ...rest2);
                                    if (mode === 'readwrite') {
                                        const names = Array.isArray(storeNames) ? storeNames : [storeNames];
                                        tx.addEventListener('complete', () => {
                                            const m = loadOriginMap();
                                            names.forEach(sn => { m['idb:' + name + ':' + sn] = currentScriptFile(); });
                                            saveOriginMap(m);
                                            notifyStorageChanged();
                                        });
                                    }
                                    return tx;
                                };
                            } catch(e) {}
                        });
                        return req;
                    };
                }
                window.__cmGetStorageOrigins = loadOriginMap;
            })();

            // --- Network request monitor ---
            // Reports the full lifecycle of every fetch/XHR call (start -> success/error) so the parent
            // panel can show status, timing, size, and headers/bodies instead of just the initial URL.
            (function() {
                let reqCounter = 0;
                const MAX_BODY_CHARS = 20000; // cap so huge payloads don't choke postMessage/the UI

                function truncate(str) {
                    if (str === null || str === undefined) return null;
                    const s = String(str);
                    return s.length > MAX_BODY_CHARS ? s.substring(0, MAX_BODY_CHARS) + '\\n...[truncated]' : s;
                }
                function headersToObject(headers) {
                    const out = {};
                    if (!headers) return out;
                    try {
                        if (typeof headers.forEach === 'function') {
                            headers.forEach((v, k) => { out[k] = v; });
                        } else if (typeof headers === 'object') {
                            Object.keys(headers).forEach(k => { out[k] = String(headers[k]); });
                        }
                    } catch(e) {}
                    return out;
                }
                function safeRequestBody(body) {
                    // Only capture body types that are cheap/safe to serialize; skip streams/blobs/formdata
                    // (their contents can't be read without consuming them, which would break the real request).
                    if (body === null || body === undefined) return null;
                    if (typeof body === 'string') return truncate(body);
                    if (body instanceof URLSearchParams) return truncate(body.toString());
                    if (typeof FormData !== 'undefined' && body instanceof FormData) return '[FormData]';
                    if (typeof Blob !== 'undefined' && body instanceof Blob) return '[Blob]';
                    try { return truncate(JSON.stringify(body)); } catch(e) { return '[Unserializable body]'; }
                }

                const originalFetch = window.fetch;
                window.fetch = async function(...args) {
                    const reqId = 'net_' + (++reqCounter) + '_' + Date.now();
                    const input = args[0];
                    const init = args[1] || {};
                    const url = typeof input === 'string' ? input : (input && input.url ? input.url : 'Unknown URL');
                    const method = (init.method || (input && input.method) || 'GET').toUpperCase();
                    const reqHeaders = headersToObject(init.headers || (input && input.headers));
                    const reqBody = safeRequestBody(init.body);
                    const startTime = performance.now();

                    window.parent.postMessage({ type: 'network-start', reqId, method, url, source: 'fetch', requestHeaders: reqHeaders, requestBody: reqBody, startTime: Date.now() }, '*');

                    try {
                        const response = await originalFetch.apply(this, args);
                        const duration = Math.round(performance.now() - startTime);
                        let respBody = null, respSize = null;
                        try {
                            const cloned = response.clone();
                            const text = await cloned.text();
                            respSize = text.length;
                            respBody = truncate(text);
                        } catch(e) {}
                        window.parent.postMessage({
                            type: 'network-end', reqId, status: response.status, statusText: response.statusText,
                            ok: response.ok, redirected: response.redirected, duration, size: respSize,
                            responseHeaders: headersToObject(response.headers), responseBody: respBody
                        }, '*');
                        return response;
                    } catch(err) {
                        const duration = Math.round(performance.now() - startTime);
                        window.parent.postMessage({ type: 'network-error', reqId, duration, error: (err && err.message) ? err.message : String(err) }, '*');
                        throw err;
                    }
                };

                const originalXhrOpen = XMLHttpRequest.prototype.open;
                const originalXhrSend = XMLHttpRequest.prototype.send;
                const originalXhrSetHeader = XMLHttpRequest.prototype.setRequestHeader;

                XMLHttpRequest.prototype.open = function(method, url, ...rest) {
                    this.__cmReqId = 'net_' + (++reqCounter) + '_' + Date.now();
                    this.__cmMethod = (method || 'GET').toUpperCase();
                    this.__cmUrl = url;
                    this.__cmReqHeaders = {};
                    return originalXhrOpen.call(this, method, url, ...rest);
                };
                XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
                    if (this.__cmReqHeaders) this.__cmReqHeaders[name] = value;
                    return originalXhrSetHeader.call(this, name, value);
                };
                XMLHttpRequest.prototype.send = function(body) {
                    const reqId = this.__cmReqId;
                    const startTime = performance.now();
                    if (reqId) {
                        window.parent.postMessage({
                            type: 'network-start', reqId, method: this.__cmMethod, url: this.__cmUrl, source: 'xhr',
                            requestHeaders: this.__cmReqHeaders || {}, requestBody: safeRequestBody(body), startTime: Date.now()
                        }, '*');
                        this.addEventListener('loadend', () => {
                            const duration = Math.round(performance.now() - startTime);
                            if (this.status === 0) {
                                // status 0 with no response = network failure, CORS block, or aborted request
                                window.parent.postMessage({ type: 'network-error', reqId, duration, error: 'Request failed (network error, CORS, or aborted)' }, '*');
                                return;
                            }
                            let respHeaders = {};
                            try {
                                this.getAllResponseHeaders().trim().split(/[\\r\\n]+/).forEach(line => {
                                    const idx = line.indexOf(':');
                                    if (idx > -1) respHeaders[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
                                });
                            } catch(e) {}
                            let respBody = null, respSize = null;
                            try {
                                const text = typeof this.responseText === 'string' ? this.responseText : null;
                                if (text !== null) { respSize = text.length; respBody = truncate(text); }
                            } catch(e) {}
                            window.parent.postMessage({
                                type: 'network-end', reqId, status: this.status, statusText: this.statusText,
                                ok: this.status >= 200 && this.status < 300, redirected: false, duration, size: respSize,
                                responseHeaders: respHeaders, responseBody: respBody
                            }, '*');
                        });
                    }
                    return originalXhrSend.call(this, body);
                };

                // Native ES module import resolution (local files and CDN packages alike)
                // bypasses fetch/XHR entirely, so those loads are otherwise invisible here -
                // the Resource Timing API still records them regardless of what triggered the
                // fetch. Only 'script' initiatorType entries are forwarded (that covers
                // <script src> and the nested static imports it pulls in); fetch/xhr are
                // excluded since those are already tracked above and would double-count.
                try {
                    const seenResourceKeys = new Set();
                    function reportResourceEntry(entry) {
                        const key = entry.name + '@' + entry.startTime;
                        if (seenResourceKeys.has(key)) return;
                        seenResourceKeys.add(key);
                        const reqId = 'res_' + (++reqCounter) + '_' + Date.now();
                        window.parent.postMessage({ type: 'network-start', reqId, method: 'GET', url: entry.name, source: 'resource', requestHeaders: {}, requestBody: null, startTime: Date.now() }, '*');
                        window.parent.postMessage({
                            type: 'network-end', reqId, status: 200, statusText: '', ok: true, redirected: false,
                            duration: Math.round(entry.duration), size: entry.transferSize || entry.decodedBodySize || null,
                            responseHeaders: {}, responseBody: null
                        }, '*');
                    }
                    const resourceObserver = new PerformanceObserver((list) => {
                        list.getEntries().forEach(entry => {
                            if (entry.initiatorType === 'script') reportResourceEntry(entry);
                        });
                    });
                    // buffered:true also picks up anything that loaded before this observer
                    // was even attached (e.g. the entry module script itself).
                    resourceObserver.observe({ type: 'resource', buffered: true });
                } catch (e) {}
            })();

            let lastErrorTracker = "";
            window.onerror = function(msg, url, line, col, error) {
                const errHash = msg + line + col;
                if (lastErrorTracker !== errHash) {
                    window.parent.postMessage({ type: 'console', level: 'error', args: [\`\${msg} at \${line}:\${col}\`] }, '*');
                    lastErrorTracker = errHash;
                }
                return true; 
            };
            document.addEventListener('click', function(e) {
                const a = e.target.closest('a');
                if (a && a.getAttribute('href') && !a.getAttribute('href').startsWith('http') && !a.getAttribute('href').startsWith('#') && !a.getAttribute('href').startsWith('data:') && !a.getAttribute('href').startsWith('blob:')) {
                    e.preventDefault();
                    window.parent.postMessage({ type: 'navigate', path: a.getAttribute('href') }, '*');
                }
            });
            let _inspectorActive = false;
            let _lastInspectedEl = null; // currently hovered (or locked) element being outlined
            let _lockedEl = null; // non-null while locked; hover updates are ignored until unlocked

            function cmGenerateSelector(el) {
                if (!el || el.nodeType !== 1) return '';
                if (el.id) return '#' + el.id;
                const parts = [];
                let node = el;
                while (node && node.nodeType === 1 && node !== document.body && parts.length < 6) {
                    let part = node.tagName.toLowerCase();
                    if (node.id) { part = '#' + node.id; parts.unshift(part); break; }
                    const classes = (node.className && typeof node.className === 'string') ? node.className.trim().split(/\\s+/).filter(Boolean) : [];
                    if (classes.length > 0) part += '.' + classes.slice(0, 2).join('.');
                    const parent = node.parentElement;
                    if (parent) {
                        const siblings = Array.from(parent.children).filter(c => c.tagName === node.tagName);
                        if (siblings.length > 1) part += ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')';
                    }
                    parts.unshift(part);
                    node = node.parentElement;
                }
                return parts.join(' > ');
            }

            function cmBuildAncestorChain(el) {
                const chain = [];
                let node = el;
                while (node && node.nodeType === 1) {
                    chain.unshift({ tag: node.tagName.toLowerCase(), id: node.id || '', classes: (node.className && typeof node.className === 'string') ? node.className : '' });
                    if (node === document.documentElement) break;
                    node = node.parentElement;
                }
                return chain;
            }

            function cmSnapshotElement(el) {
                const rect = el.getBoundingClientRect();
                const cs = window.getComputedStyle(el);
                const box = {
                    marginTop: cs.marginTop, marginRight: cs.marginRight, marginBottom: cs.marginBottom, marginLeft: cs.marginLeft,
                    borderTop: cs.borderTopWidth, borderRight: cs.borderRightWidth, borderBottom: cs.borderBottomWidth, borderLeft: cs.borderLeftWidth,
                    paddingTop: cs.paddingTop, paddingRight: cs.paddingRight, paddingBottom: cs.paddingBottom, paddingLeft: cs.paddingLeft,
                    contentWidth: Math.round(el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)),
                    contentHeight: Math.round(el.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0))
                };
                // Only the most commonly-inspected properties -- a full CSSStyleDeclaration dump is 300+ entries
                // of mostly-empty/inherited noise that would bury the useful ones.
                const STYLE_PROPS = [
                    'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'float', 'clear',
                    'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'box-sizing',
                    'color', 'background-color', 'background-image', 'opacity',
                    'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-align', 'text-decoration', 'text-transform',
                    'flex-direction', 'justify-content', 'align-items', 'flex-wrap', 'gap',
                    'grid-template-columns', 'grid-template-rows',
                    'border-radius', 'box-shadow', 'overflow', 'overflow-x', 'overflow-y',
                    'cursor', 'transition', 'transform', 'visibility'
                ];
                const styles = {};
                STYLE_PROPS.forEach(p => { const v = cs.getPropertyValue(p); if (v && v !== 'none' && v !== 'normal' && v !== 'auto' && v !== '0px') styles[p] = v; });
                // Always show these core ones even if "default", since box-model/layout debugging needs them
                ['display', 'position', 'width', 'height', 'color', 'background-color'].forEach(p => { if (!(p in styles)) styles[p] = cs.getPropertyValue(p); });

                const attributes = {};
                Array.from(el.attributes || []).forEach(a => { attributes[a.name] = a.value; });

                let outerHtml = '';
                try {
                    outerHtml = el.outerHTML.length > 5000 ? el.outerHTML.substring(0, 5000) + '\\n...[truncated]' : el.outerHTML;
                } catch(e) {}

                return {
                    tag: el.tagName.toLowerCase(), id: el.id || '', classes: (el.className && typeof el.className === 'string') ? el.className : '',
                    rect: { w: Math.round(rect.width), h: Math.round(rect.height) },
                    box, styles, attributes, outerHtml,
                    selector: cmGenerateSelector(el),
                    ancestors: cmBuildAncestorChain(el)
                };
            }

            function cmOutlineElement(el, locked) {
                if (_lastInspectedEl && _lastInspectedEl !== el) {
                    _lastInspectedEl.style.outline = '';
                    _lastInspectedEl.style.outlineOffset = '';
                }
                if (el) {
                    el.style.outline = locked ? '2px solid #ff5252' : '2px dashed #3794ff';
                    el.style.outlineOffset = '-2px';
                }
                _lastInspectedEl = el;
            }

            document.addEventListener('mouseover', e => {
                if (!_inspectorActive || _lockedEl) return; // locked selection ignores hover entirely
                cmOutlineElement(e.target, false);
                window.parent.postMessage({ type: 'inspect-hover', locked: false, data: cmSnapshotElement(e.target) }, '*');
            });
            document.addEventListener('mouseout', e => {
                if (!_inspectorActive || _lockedEl) return;
                if (e.target === _lastInspectedEl) {
                    e.target.style.outline = '';
                    e.target.style.outlineOffset = '';
                    _lastInspectedEl = null;
                }
            });
            document.addEventListener('click', e => {
                if (!_inspectorActive) return;
                e.preventDefault();
                e.stopPropagation();
                if (_lockedEl === e.target) {
                    // clicking the already-locked element again unlocks it
                    _lockedEl = null;
                    cmOutlineElement(null, false);
                    window.parent.postMessage({ type: 'inspect-unlocked' }, '*');
                } else {
                    _lockedEl = e.target;
                    cmOutlineElement(e.target, true);
                    window.parent.postMessage({ type: 'inspect-hover', locked: true, data: cmSnapshotElement(e.target) }, '*');
                }
            }, {capture: true});
            document.addEventListener('keydown', e => {
                if (_inspectorActive && _lockedEl && e.key === 'Escape') {
                    _lockedEl = null;
                    cmOutlineElement(null, false);
                    window.parent.postMessage({ type: 'inspect-unlocked' }, '*');
                }
            });
            

            // Re-written global async evaluation handler
            window.addEventListener('message', async function(e) {
                if (e.data && e.data.type === 'eval') {
                    try {
                        let code = e.data.code;
                        let result;
                        if (/\\bawait\\b/.test(code)) {
                            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                            result = await (new AsyncFunction('return (' + code + ')'))();
                        } else {
                            result = window.eval(code);
                        }
                        
                        let resParsed;
                        if(typeof result === 'object' && result !== null) {
                            try { resParsed = { isObj: true, data: JSON.stringify(result) }; } catch(err) { resParsed = String(result); }
                        } else if (result === undefined) {
                            resParsed = 'undefined';
                        } else { 
                            resParsed = String(result); 
                        }
                        window.parent.postMessage({ type: 'console', level: 'result', args: [resParsed] }, '*');
                    } catch(err) {
                        window.parent.postMessage({ type: 'console', level: 'error', args: [err.toString()] }, '*');
                    }
                } else if (e.data && e.data.type === 'inject-css') {
                    let styleTag = document.getElementById('codemini-hot-css');
                    if (!styleTag) {
                        styleTag = document.createElement('style');
                        styleTag.id = 'codemini-hot-css';
                        document.head.appendChild(styleTag);
                    }
                    styleTag.innerHTML = e.data.css;
                    window.parent.postMessage({ type: 'console', level: 'info', args: ['[Hot Reload] CSS Updated successfully.'] }, '*');
                } else if (e.data && e.data.type === 'swap-stylesheet') {
                    // A <link>-ed (or JS-imported) stylesheet changed - point it at the
                    // fresh blob instead of reloading the whole page.
                    const link = document.querySelector('link[rel="stylesheet"][href="' + e.data.oldUrl + '"]');
                    if (link) {
                        link.setAttribute('href', e.data.newUrl);
                        window.parent.postMessage({ type: 'console', level: 'info', args: ['[Hot Reload] Stylesheet updated successfully.'] }, '*');
                    }
                } else if (e.data && e.data.type === 'toggle-inspector') {
                    _inspectorActive = e.data.enabled;
                    if (!_inspectorActive) {
                        if (_lastInspectedEl) { _lastInspectedEl.style.outline = ''; _lastInspectedEl.style.outlineOffset = ''; }
                        _lastInspectedEl = null;
                        _lockedEl = null;
                        window.parent.postMessage({ type: 'inspect-clear' }, '*');
                    }
                } else if (e.data && e.data.type === 'inspect-select-ancestor') {
                    // Breadcrumb click from the parent panel: re-target the (locked) selection to an ancestor
                    if (!_inspectorActive || !_lockedEl) return;
                    let node = _lockedEl;
                    for (let i = 0; i < e.data.stepsUp && node.parentElement; i++) node = node.parentElement;
                    _lockedEl = node;
                    cmOutlineElement(node, true);
                    window.parent.postMessage({ type: 'inspect-hover', locked: true, data: cmSnapshotElement(node) }, '*');
                } else if (e.data && e.data.type === 'toggle-edit') {
                    document.designMode = e.data.enabled ? 'on' : 'off';
                } else if (e.data && e.data.type === 'toggle-grid') {
                    let gridStyle = document.getElementById('codemini-grid-overlay');
                    if (e.data.enabled) {
                        if (!gridStyle) {
                            gridStyle = document.createElement('style');
                            gridStyle.id = 'codemini-grid-overlay';
                            gridStyle.innerHTML = 'body { background-size: 20px 20px !important; background-image: linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px) !important; }';
                            document.head.appendChild(gridStyle);
                        }
                    } else {
                        if (gridStyle) gridStyle.remove();
                    }
                } else if (e.data && e.data.type === 'toggle-layout-debug') {
                    // Outlines every element's box so margins/padding/nesting are visible at a glance,
                    // similar to a browser devtools "show layout" overlay. Colors cycle by nesting depth.
                    // Uses box-shadow (not outline) since outline can get visually buried under opaque
                    // sibling/child backgrounds on real pages; box-shadow paints reliably per-element.
                    let layoutStyle = document.getElementById('codemini-layout-debug');
                    if (e.data.enabled) {
                        if (!layoutStyle) {
                            layoutStyle = document.createElement('style');
                            layoutStyle.id = 'codemini-layout-debug';
                            layoutStyle.innerHTML = 'html.codemini-layout-debug-on * { box-shadow: inset 0 0 0 1px rgba(255, 82, 82, 0.85) !important; }'
                                + ' html.codemini-layout-debug-on *:nth-child(2n) { box-shadow: inset 0 0 0 1px rgba(64, 156, 255, 0.85) !important; }'
                                + ' html.codemini-layout-debug-on *:nth-child(3n) { box-shadow: inset 0 0 0 1px rgba(255, 193, 7, 0.85) !important; }';
                            document.head.appendChild(layoutStyle);
                        }
                        document.documentElement.classList.add('codemini-layout-debug-on');
                    } else {
                        document.documentElement.classList.remove('codemini-layout-debug-on');
                        if (layoutStyle) layoutStyle.remove();
                    }
                } else if (e.data && e.data.type === 'fetch-storage') {
                    const ls = {}, ss = {};
                    Object.keys(localStorage).forEach(k => { if(!k.startsWith('codemini_')) ls[k] = localStorage.getItem(k); });
                    Object.keys(sessionStorage).forEach(k => { if(!k.startsWith('codemini_') && k !== '__cm_storage_origins__') ss[k] = sessionStorage.getItem(k); });
                    const origins = window.__cmGetStorageOrigins ? window.__cmGetStorageOrigins() : {};
                    
                    let idbs = [];
                    if(indexedDB.databases) {
                        indexedDB.databases().then(dbs => {
                            idbs = dbs.map(db => db.name).filter(n => !n.startsWith('CodeMiniDB'));
                            window.parent.postMessage({ type: 'storage-data', ls, ss, idbs, origins }, '*');
                        }).catch(() => {
                            window.parent.postMessage({ type: 'storage-data', ls, ss, idbs: [], origins }, '*');
                        });
                    } else {
                        window.parent.postMessage({ type: 'storage-data', ls, ss, idbs: [], origins }, '*');
                    }
                } else if (e.data && e.data.type === 'set-storage') {
                    const sType = e.data.sType, key = e.data.key, value = e.data.value;
                    if (sType === 'ls') localStorage.setItem(key, value);
                    if (sType === 'ss') sessionStorage.setItem(key, value);
                    window.parent.postMessage({ type: 'storage-updated' }, '*');
                } else if (e.data && e.data.type === 'delete-storage') {
                    const sType = e.data.sType, key = e.data.key;
                    if (sType === 'ls') localStorage.removeItem(key);
                    if (sType === 'ss') sessionStorage.removeItem(key);
                    if (sType === 'idb') indexedDB.deleteDatabase(key);
                    window.parent.postMessage({ type: 'storage-updated' }, '*');
                } else if (e.data && e.data.type === 'rename-storage') {
                    const sType = e.data.sType, oldKey = e.data.oldKey, newKey = e.data.newKey;
                    if (sType === 'ls') { localStorage.setItem(newKey, localStorage.getItem(oldKey)); localStorage.removeItem(oldKey); }
                    if (sType === 'ss') { sessionStorage.setItem(newKey, sessionStorage.getItem(oldKey)); sessionStorage.removeItem(oldKey); }
                    window.parent.postMessage({ type: 'storage-updated' }, '*');
                } else if (e.data && e.data.type === 'clear-storage-type') {
                    const sType = e.data.sType;
                    const onlyKeys = e.data.onlyKeys; // optional: array of keys to scope the clear to (used by "This File" scope)
                    if (sType === 'ls') {
                        Object.keys(localStorage).forEach(k => {
                            if (k.startsWith('codemini_')) return;
                            if (onlyKeys && !onlyKeys.includes(k)) return;
                            localStorage.removeItem(k);
                        });
                    }
                    if (sType === 'ss') {
                        Object.keys(sessionStorage).forEach(k => {
                            if (k.startsWith('codemini_') || k === '__cm_storage_origins__') return;
                            if (onlyKeys && !onlyKeys.includes(k)) return;
                            sessionStorage.removeItem(k);
                        });
                    }
                    if (sType === 'idb' && indexedDB.databases) {
                        indexedDB.databases().then(dbs => {
                            dbs.forEach(db => {
                                if (db.name.startsWith('CodeMiniDB')) return;
                                if (onlyKeys && !onlyKeys.includes(db.name)) return;
                                indexedDB.deleteDatabase(db.name);
                            });
                            window.parent.postMessage({ type: 'storage-updated' }, '*');
                        });
                    } else {
                        window.parent.postMessage({ type: 'storage-updated' }, '*');
                    }
                } else if (e.data && e.data.type === 'import-storage') {
                    const sType = e.data.sType, entries = e.data.entries || {};
                    Object.keys(entries).forEach(k => {
                        if (sType === 'ls') localStorage.setItem(k, entries[k]);
                        if (sType === 'ss') sessionStorage.setItem(k, entries[k]);
                    });
                    window.parent.postMessage({ type: 'storage-updated' }, '*');
                } else if (e.data && e.data.type === 'fetch-idb-contents') {
                    // Opens the database read-only-ish (no version bump), enumerates every object store,
                    // and reads up to a capped number of records per store so large DBs don't hang the UI.
                    const dbName = e.data.dbName;
                    const REQ_ID = e.data.reqId;
                    const RECORD_CAP = 50;
                    try {
                        const openReq = indexedDB.open(dbName);
                        openReq.onerror = () => {
                            window.parent.postMessage({ type: 'idb-contents', reqId: REQ_ID, dbName, error: 'Could not open database', stores: [] }, '*');
                        };
                        openReq.onsuccess = () => {
                            const idb = openReq.result;
                            const storeNames = Array.from(idb.objectStoreNames);
                            if (storeNames.length === 0) {
                                idb.close();
                                window.parent.postMessage({ type: 'idb-contents', reqId: REQ_ID, dbName, stores: [] }, '*');
                                return;
                            }
                            const tx = idb.transaction(storeNames, 'readonly');
                            const stores = [];
                            let pending = storeNames.length;
                            const finish = () => {
                                pending--;
                                if (pending === 0) {
                                    idb.close();
                                    window.parent.postMessage({ type: 'idb-contents', reqId: REQ_ID, dbName, stores }, '*');
                                }
                            };
                            storeNames.forEach(storeName => {
                                try {
                                    const os = tx.objectStore(storeName);
                                    const countReq = os.count();
                                    countReq.onsuccess = () => {
                                        const totalCount = countReq.result;
                                        const records = [];
                                        let cursorCount = 0;
                                        const cursorReq = os.openCursor();
                                        cursorReq.onsuccess = (ev) => {
                                            const cursor = ev.target.result;
                                            if (cursor && cursorCount < RECORD_CAP) {
                                                let safeValue;
                                                try { safeValue = JSON.parse(JSON.stringify(cursor.value)); } catch(e) { safeValue = String(cursor.value); }
                                                records.push({ key: JSON.stringify(cursor.key), value: safeValue });
                                                cursorCount++;
                                                cursor.continue();
                                            } else {
                                                stores.push({ name: storeName, keyPath: os.keyPath, count: totalCount, truncated: totalCount > RECORD_CAP, records });
                                                finish();
                                            }
                                        };
                                        cursorReq.onerror = () => {
                                            stores.push({ name: storeName, keyPath: os.keyPath, count: totalCount, truncated: false, records: [], error: 'Could not read records' });
                                            finish();
                                        };
                                    };
                                    countReq.onerror = () => {
                                        stores.push({ name: storeName, count: 0, truncated: false, records: [], error: 'Could not count records' });
                                        finish();
                                    };
                                } catch(e) {
                                    stores.push({ name: storeName, count: 0, truncated: false, records: [], error: String(e) });
                                    finish();
                                }
                            });
                        };
                    } catch(e) {
                        window.parent.postMessage({ type: 'idb-contents', reqId: REQ_ID, dbName, error: String(e), stores: [] }, '*');
                    }
                }
            });
        <\/script>
    `;

    // 6. Advanced Path Resolution & File Mapping
    async function getAllWorkspaceFiles() {
        return new Promise(resolve => {
            if (typeof db === 'undefined' || !db) return resolve([]);
            const tx = db.transaction('filesystem', 'readonly');
            tx.objectStore('filesystem').getAll().onsuccess = e => resolve(e.target.result);
        });
    }

    function buildVirtualPathTree(files) {
        const idToNode = {};
        const pathMap = {}; 

        files.forEach(f => idToNode[f.id] = f);

        function getAbsolutePath(file) {
            if (!file) return '';
            if (file.parentId === 'root' || file.parentId === 'workspace-root') return '/' + file.name;
            const parent = idToNode[file.parentId];
            if (!parent) return '/' + file.name;
            return getAbsolutePath(parent) + '/' + file.name;
        }

        files.forEach(f => {
            f.absolutePath = getAbsolutePath(f);
            pathMap[f.absolutePath] = f;
        });

        return pathMap;
    }

    function resolveRelativePath(basePath, relativePath) {
        if (relativePath.startsWith('/')) return relativePath; 
        const baseParts = basePath.split('/');
        baseParts.pop(); 
        const relParts = relativePath.split('/');
        
        for (const part of relParts) {
            if (part === '.' || part === '') continue;
            if (part === '..') {
                if (baseParts.length > 0) baseParts.pop();
            } else {
                baseParts.push(part);
            }
        }
        return baseParts.join('/') || '/';
    }

    // Resolves a bare/relative module specifier written inside a .ts/.tsx/.jsx (or ESM
    // .js) file to an actual file in the virtual filesystem. Mirrors how bundlers resolve
    // extension-less imports: try the exact path, then common extensions, then
    // "<path>/index.*" for folder-style imports (e.g. `import Foo from './Foo'`).
    const MODULE_RESOLVE_EXTS = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json', '.css'];
    const ASSET_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp', 'avif',
        'woff', 'woff2', 'ttf', 'otf', 'eot', 'mp3', 'wav', 'ogg', 'mp4', 'webm', 'pdf']);

    function resolveImportTarget(baseAbsolutePath, spec, pathMap) {
        const resolved = resolveRelativePath(baseAbsolutePath, spec);
        if (pathMap[resolved]) return pathMap[resolved];
        for (const extCandidate of MODULE_RESOLVE_EXTS) {
            if (pathMap[resolved + extCandidate]) return pathMap[resolved + extCandidate];
        }
        for (const extCandidate of MODULE_RESOLVE_EXTS) {
            if (pathMap[resolved + '/index' + extCandidate]) return pathMap[resolved + '/index' + extCandidate];
        }
        return null;
    }

    // --- Path alias support (tsconfig.json / jsconfig.json "paths") --------------------
    // Lets `import Foo from '@/components/Foo'` resolve the same way it would in a real
    // bundler-based project, by reading compilerOptions.baseUrl/paths if such a config
    // file exists anywhere in the workspace.
    function stripJsonComments(text) {
        // tsconfig commonly has // and /* */ comments and trailing commas, neither of
        // which JSON.parse accepts - strip just enough to make it parseable.
        return text
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/(^|[^:])\/\/.*$/gm, '$1')
            .replace(/,(\s*[}\]])/g, '$1');
    }

    function loadPathAliasConfig(files) {
        const configFile = files.find(f => /(^|\/)(tsconfig|jsconfig)\.json$/i.test(f.absolutePath || '') && f.content);
        if (!configFile) return null;
        try {
            const parsed = JSON.parse(stripJsonComments(configFile.content));
            const opts = (parsed && parsed.compilerOptions) || {};
            if (!opts.paths || typeof opts.paths !== 'object') return null;
            const configDir = configFile.absolutePath.substring(0, configFile.absolutePath.lastIndexOf('/')) || '';
            const baseUrl = opts.baseUrl ? resolveRelativePath(configDir + '/x', opts.baseUrl) : configDir;
            return { baseUrl, paths: opts.paths };
        } catch (e) {
            return null; // malformed config - skip alias resolution rather than fail the whole preview
        }
    }

    // Resolves one specifier against tsconfig-style path aliases: supports the common
    // `"@/*": ["./src/*"]` wildcard form as well as exact (no-wildcard) keys. Returns a
    // path to feed into resolveImportTarget, or null if no alias matched (bare package).
    function resolveAlias(spec, aliasConfig) {
        if (!aliasConfig) return null;
        // resolveRelativePath expects a *file* path to strip a segment from, so a "/x" is
        // appended to baseUrl to give it one - but when baseUrl resolves all the way to
        // the workspace root, it's already "/", and "/" + "/x" doubles up to "//x", which
        // throws off every segment resolved from it (a trailing "/src/..." alias would
        // resolve to "//src/..." - a path nothing in pathMap actually matches, so the
        // import silently 404s). Stripping any trailing slash first keeps this correct
        // whether baseUrl is the bare root or a nested directory.
        const base = aliasConfig.baseUrl.endsWith('/') ? aliasConfig.baseUrl.slice(0, -1) : aliasConfig.baseUrl;
        for (const key of Object.keys(aliasConfig.paths)) {
            const targets = aliasConfig.paths[key];
            if (!Array.isArray(targets) || targets.length === 0) continue;
            if (key.includes('*')) {
                const starIdx = key.indexOf('*');
                const prefix = key.slice(0, starIdx);
                const suffix = key.slice(starIdx + 1);
                if (spec.startsWith(prefix) && spec.endsWith(suffix) && spec.length >= prefix.length + suffix.length) {
                    const captured = spec.slice(prefix.length, spec.length - suffix.length);
                    return resolveRelativePath(base + '/x', targets[0].replace('*', captured));
                }
            } else if (spec === key) {
                return resolveRelativePath(base + '/x', targets[0]);
            }
        }
        return null;
    }

    // Builds a Babel plugin that rewrites every import/export/dynamic-import specifier in
    // one file:
    //  - path-aliased and relative specifiers pointing at another JS/TS/JSX file become a
    //    stable "cm:module:<id>" key, resolved for real via a <script type="importmap">
    //    built once every candidate file has a blob URL (see transpileAndLinkModules) -
    //    using a stable key instead of the target's actual blob URL means files can
    //    import each other in any order, including circularly, with no dependency
    //    ordering needed at all
    //  - local CSS specifiers are pulled out entirely and turned into a <link> instead of
    //    a JS import, since native ESM can't import CSS
    //  - local JSON specifiers are inlined directly as a JS value, sidestepping
    //    inconsistent browser support for JSON import assertions
    //  - local asset specifiers (images, fonts, media) become `const x = "<blob-url>"`,
    //    matching how bundlers hand back a URL string for this kind of import
    //  - bare/npm-style specifiers ("react", "react-dom/client") are left untouched in
    //    the code and instead recorded so the import map can point them at esm.sh - every
    //    file importing "react" gets the exact same URL, so there's only ever one
    //    instance of it (no version-mismatch/"Invalid hook call" risk between files)
    function makeImportRewritePlugin(file, pathMap, aliasConfig, depsOut) {
        return function importRewritePlugin({ types: t }) {
            function packageRoot(spec) {
                const parts = spec.split('/');
                return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
            }
            function resolveSpecPath(value) {
                if (value.startsWith('.') || value.startsWith('/')) return value;
                return resolveAlias(value, aliasConfig); // null => bare/npm package
            }

            // Export-from and dynamic import() positions: only a plain code change (local
            // JS module -> stable key) is safe here, since replacing/removing the node
            // isn't always valid syntax in those positions. CSS/JSON/asset targets are
            // reported as unresolved rather than guessed at.
            function classifyAndMaybeRewrite(sourcePath) {
                const value = sourcePath.node.value;
                if (typeof value !== 'string') return null;
                if (value.startsWith('http') || value.startsWith('blob:') || value.startsWith('data:')) return null;

                const resolvedPath = resolveSpecPath(value);
                if (resolvedPath === null) { depsOut.packages.add(packageRoot(value)); return null; }
                const target = resolveImportTarget(file.absolutePath, resolvedPath, pathMap);
                if (!target) { depsOut.unresolved.add(value); return null; }
                const targetExt = target.name.split('.').pop().toLowerCase();

                if (targetExt === 'css') { depsOut.cssDeps.add(target.id); return 'remove'; }
                if (targetExt === 'json' || ASSET_EXTS.has(targetExt)) {
                    depsOut.unresolved.add(value + ' (only a static `import ... from` can inline this here)');
                    return null;
                }
                depsOut.localDeps.add(target.id);
                sourcePath.node.value = `cm:module:${target.id}`;
                return null;
            }

            // Static `import ... from '...'` declarations: the one place it's always
            // safe to fully replace the statement, so JSON/assets get properly inlined
            // here instead of just being reported as unresolved.
            function rewriteImportDeclaration(path) {
                const sourcePath = path.get('source');
                const value = sourcePath.node.value;
                if (typeof value !== 'string' || value.startsWith('http') || value.startsWith('blob:') || value.startsWith('data:')) return;

                const resolvedPath = resolveSpecPath(value);
                if (resolvedPath === null) { depsOut.packages.add(packageRoot(value)); return; }
                const target = resolveImportTarget(file.absolutePath, resolvedPath, pathMap);
                if (!target) { depsOut.unresolved.add(value); return; }
                const targetExt = target.name.split('.').pop().toLowerCase();

                if (targetExt === 'css') { depsOut.cssDeps.add(target.id); path.remove(); return; }

                if (targetExt === 'json') {
                    let parsed;
                    try { parsed = JSON.parse(target.content || 'null'); }
                    catch (e) { depsOut.unresolved.add(value + ' (invalid JSON)'); path.remove(); return; }
                    const declarators = (path.node.specifiers || []).map(spec => {
                        if (t.isImportDefaultSpecifier(spec) || t.isImportNamespaceSpecifier(spec)) {
                            return t.variableDeclarator(t.cloneNode(spec.local), t.valueToNode(parsed));
                        }
                        const key = (spec.imported && (spec.imported.name || spec.imported.value)) || spec.local.name;
                        const val = (parsed && typeof parsed === 'object') ? parsed[key] : undefined;
                        return t.variableDeclarator(t.cloneNode(spec.local), t.valueToNode(val === undefined ? null : val));
                    });
                    if (declarators.length === 0) { path.remove(); return; }
                    path.replaceWith(t.variableDeclaration('const', declarators));
                    return;
                }

                if (ASSET_EXTS.has(targetExt)) {
                    const url = depsOut.assetUrls[target.id] || '';
                    if (!url) depsOut.unresolved.add(value + ' (asset not available)');
                    const defaultSpec = (path.node.specifiers || []).find(s => t.isImportDefaultSpecifier(s));
                    if (!defaultSpec) { path.remove(); return; }
                    path.replaceWith(t.variableDeclaration('const', [
                        t.variableDeclarator(t.cloneNode(defaultSpec.local), t.stringLiteral(url))
                    ]));
                    return;
                }

                depsOut.localDeps.add(target.id);
                sourcePath.node.value = `cm:module:${target.id}`;
            }

            return {
                visitor: {
                    ImportDeclaration(path) { rewriteImportDeclaration(path); },
                    ExportNamedDeclaration(path) {
                        if (path.node.source && classifyAndMaybeRewrite(path.get('source')) === 'remove') path.remove();
                    },
                    ExportAllDeclaration(path) {
                        if (classifyAndMaybeRewrite(path.get('source')) === 'remove') path.remove();
                    },
                    ImportExpression(path) { classifyAndMaybeRewrite(path.get('source')); }
                }
            };
        };
    }

    // Babel Standalone is only needed once a workspace actually contains TS/JSX - loaded
    // on demand from esm.sh, the same lazy-CDN-load pattern pdf-viewer.js uses for pdf.js.
    // Cached as a promise so a failed load (offline) is retried on the next refresh instead
    // of being stuck, and a successful load isn't re-fetched every render.
    let babelModulePromise = null;
    function loadBabelStandalone() {
        if (!babelModulePromise) {
            babelModulePromise = import('https://esm.sh/@babel/standalone').catch(err => {
                babelModulePromise = null;
                throw err;
            });
        }
        return babelModulePromise;
    }

    // Transpiles every candidate TS/TSX/JSX (or ESM .js) file and builds a single import
    // map covering all of it - so <script type="module" src="App.tsx"> works the same way
    // <script src="app.js"> already does, including files it imports (in any order, even
    // circularly), path-aliased imports, JSON/asset imports, and packages (React, etc.)
    // pulled in from npm. Each file's blob can be created independently and in any order,
    // since nothing needs another file's real URL up front - they reference each other by
    // a stable "cm:module:<id>" key that the import map resolves afterwards.
    async function transpileAndLinkModules(candidateFiles, pathMap, aliasConfig, state) {
        let Babel;
        try {
            const mod = await loadBabelStandalone();
            // esm.sh's CJS->ESM interop sometimes lands the real API on .default
            // instead of the namespace itself, depending on how the package is shaped.
            Babel = (mod && typeof mod.transform === 'function') ? mod : mod.default;
            if (!Babel || typeof Babel.transform !== 'function') throw new Error('Babel Standalone did not load as expected');
        } catch (e) {
            return { ok: false, reason: 'offline' };
        }

        const packages = new Set();
        const cssDeps = new Set();
        const unresolved = new Set();
        const localDeps = new Set(); // every local file id referenced via an import, across ALL candidate files
        const failed = [];
        const importMapImports = {};

        candidateFiles.forEach(file => {
            const fileExt = file.name.split('.').pop().toLowerCase();
            // Only .ts is excluded from JSX/React support: it's the one extension where
            // JSX syntax would actually conflict with something real (an old-style
            // `<T>value` cast). Plain .js/.mjs/.cjs get it too, in case they contain JSX -
            // a common real-world habit - and so a bare component file saved as .js (like
            // Calculator.js) still renders correctly when previewed standalone.
            const mayHaveJsx = fileExt !== 'ts';
            const depsOut = { localDeps, cssDeps, packages, unresolved, assetUrls: state.activeObjectUrls };
            try {
                const presets = ['typescript']; // isTSX/allExtensions were removed from newer @babel/preset-typescript releases - it now infers JSX-ness from `filename`'s own extension instead
                if (mayHaveJsx) presets.push(['react', { runtime: 'automatic' }]);
                const out = Babel.transform(file.content || '', {
                    filename: file.name,
                    sourceType: 'module',
                    sourceMaps: 'inline', // so a runtime error - or a "pop out" into a real browser tab - can map back to the original .tsx/.ts source
                    presets,
                    plugins: [makeImportRewritePlugin(file, pathMap, aliasConfig, depsOut)]
                });
                const blob = new Blob([out.code], { type: 'text/javascript' });
                const url = URL.createObjectURL(blob);
                state.activeObjectUrls[file.id] = url;
                state.moduleFileIds.add(file.id);
                importMapImports[`cm:module:${file.id}`] = url;
            } catch (e) {
                failed.push({ name: file.name, error: (e && e.message) ? e.message : String(e) });
            }
        });

        // A "local dep" isn't always a candidate file that got transpiled above - it might
        // be a plain classic .js file (no import/export of its own - e.g. something fetched
        // by the terminal's `npm install`, which just saves a package's raw UMD/CJS bundle
        // as a flat file) that some .tsx file still imports. That file was already blobbed
        // in refreshBlobMap's earlier plainFiles pass, just never given a "cm:module:" key,
        // so the import to it would otherwise 404 against the import map. Point any such
        // dependency at its existing blob URL here.
        localDeps.forEach(id => {
            const key = `cm:module:${id}`;
            if (!importMapImports[key] && state.activeObjectUrls[id]) {
                importMapImports[key] = state.activeObjectUrls[id];
            }
        });

        cssDeps.forEach(id => state.jsImportedCssFileIds.add(id));

        // Always available, even if nothing in the graph explicitly imports them: the
        // standalone-preview auto-mount bootstrap (buildSyntheticEntryHtml) needs
        // react/react-dom to render a bare component file's default export, whether or
        // not that file itself imports react-dom.
        packages.add('react');
        packages.add('react-dom');

        // A handful of packages need to resolve to a *different* package to run in a
        // browser at all - most notably React Native's own core, which has no browser
        // build of its own. react-native-web is the standard drop-in replacement (it's
        // what Expo's own web target uses). Other RN-ecosystem packages don't get this
        // treatment: they don't rename themselves for web, they rely on Metro swapping in
        // a .web.js variant at build time, which esm.sh has no way to replicate - aliasing
        // only helps here because react-native-web is a real, separate, browser-ready package.
        const PACKAGE_ALIASES = { 'react-native': 'react-native-web' };

        // One import-map entry per package root, plus a trailing-slash prefix entry so
        // subpaths resolve too (e.g. "react-dom/client", "react/jsx-runtime" both need
        // to fall under the "react-dom"/"react" entry). Every file importing the same
        // root gets this exact same URL - one shared instance, not one per file.
        packages.forEach(pkg => {
            const target = PACKAGE_ALIASES[pkg] || pkg;
            importMapImports[pkg] = `https://esm.sh/${target}`;
            importMapImports[`${pkg}/`] = `https://esm.sh/${target}/`;
        });
        state.moduleImportMap = { imports: importMapImports };

        return {
            ok: true,
            failed,
            packages: Array.from(packages),
            unresolvedImports: Array.from(unresolved)
        };
    }

    async function refreshBlobMap(files) {
        const state = getPreviewState();
        Object.values(state.activeObjectUrls).forEach(url => URL.revokeObjectURL(url));
        state.activeObjectUrls = {};
        state.moduleFileIds = new Set();
        state.jsImportedCssFileIds = new Set();
        state.moduleTranspileReport = null;
        state.moduleImportMap = null;

        const MODULE_EXTS = ['ts', 'tsx', 'jsx'];
        const isEsmJs = (content, ext) => (ext === 'js' || ext === 'mjs') && /(^|\n)\s*(import\s|export\s)/.test(content || '');

        const candidateFiles = [];
        const plainFiles = [];
        files.forEach(f => {
            if (f.type !== 'file' || !f.content) return;
            const ext = f.name.split('.').pop().toLowerCase();
            if (MODULE_EXTS.includes(ext) || isEsmJs(f.content, ext)) {
                candidateFiles.push(f);
            } else {
                plainFiles.push(f);
            }
        });

        // Non-module files first (CSS/JSON/images/plain classic-script JS/etc.) so
        // anything a TS/TSX/JSX file imports (a stylesheet, a JSON data file, ...)
        // already has a real blob URL by the time the module graph below needs it.
        plainFiles.forEach(f => {
            const ext = f.name.split('.').pop().toLowerCase();

            // Linked local dependencies (CSS/JS/HTML/JSON) are text and may be open in Monaco with
            // unsaved edits that haven't been flushed to IndexedDB yet (autosave is debounced, or off).
            // Without this, refresh only ever reflects what's actually persisted to the DB, not what's
            // currently in the editor -- which looks like "refresh doesn't work" for any linked file.
            const isTextType = ['css', 'js', 'html', 'json', 'txt', 'svg'].includes(ext);

            try {
                let blob;
                if (f.encoding === 'base64' && window.fileRecordToBlob) {
                    // Binary file (image/video/audio/font/etc.) - reconstruct real
                    // bytes + correct mime type instead of wrapping the base64
                    // string itself as if it were the file's literal content.
                    blob = window.fileRecordToBlob(f);
                } else {
                    let mimeType = 'text/plain';
                    if (ext === 'css') mimeType = 'text/css';
                    else if (ext === 'js') mimeType = 'application/javascript';
                    else if (ext === 'html') mimeType = 'text/html';
                    else if (ext === 'json') mimeType = 'application/json';
                    else if (['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp'].includes(ext)) {
                        mimeType = 'image/' + (ext === 'jpg' ? 'jpeg' : (ext === 'svg' ? 'svg+xml' : ext));
                    }
                    let contentToUse = f.content;
                    if (isTextType) {
                        const liveContent = getEditorContentByFileId(f.id);
                        if (liveContent !== null && liveContent !== undefined) contentToUse = liveContent;
                    }
                    blob = new Blob([contentToUse], { type: mimeType });
                }
                state.activeObjectUrls[f.id] = URL.createObjectURL(blob);
            } catch(e) {}
        });

        if (candidateFiles.length > 0) {
            const pathMap = {};
            files.forEach(f => { if (f.absolutePath) pathMap[f.absolutePath] = f; });
            const aliasConfig = loadPathAliasConfig(files);

            // Same live-editor-content preference as above, without mutating the shared
            // file records (buildVirtualPathTree's absolutePath/id fields carry over fine).
            const liveCandidateFiles = candidateFiles.map(f => {
                const liveContent = getEditorContentByFileId(f.id);
                return (liveContent !== null && liveContent !== undefined) ? Object.assign({}, f, { content: liveContent }) : f;
            });

            state.moduleTranspileReport = await transpileAndLinkModules(liveCandidateFiles, pathMap, aliasConfig, state);
        }
    }

    function injectLocalDependencies(html, currentFile, pathMap) {
        const state = getPreviewState();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        let resourceReport = { linked: [], unlinked: [], external: [], packages: [] };

        // The import map has to be present before any <script type="module"> starts
        // resolving imports - inserted as head's very first child so it precedes the
        // entry script(s) rewritten below regardless of anything else added to <head>
        // later. If the HTML already has its own importmap (rare, but possible), merge
        // into it instead of adding a second one - two importmaps is a hard parse error
        // that would break the whole page's module loading.
        if (state.moduleImportMap && Object.keys(state.moduleImportMap.imports).length > 0) {
            const existingMap = doc.querySelector('script[type="importmap"]');
            if (existingMap) {
                let existing = {};
                try { existing = JSON.parse(existingMap.textContent || '{}'); } catch (e) {}
                existing.imports = Object.assign({}, existing.imports || {}, state.moduleImportMap.imports);
                existingMap.textContent = JSON.stringify(existing);
            } else {
                const mapScript = doc.createElement('script');
                mapScript.setAttribute('type', 'importmap');
                mapScript.textContent = JSON.stringify(state.moduleImportMap);
                doc.head.insertBefore(mapScript, doc.head.firstChild);
            }
        }

        const targetElements = doc.querySelectorAll('script[src], link[href], img[src], audio[src], video[src], source[src], object[data], iframe[src]');

        targetElements.forEach(el => {
            const attr = el.hasAttribute('src') ? 'src' : el.hasAttribute('href') ? 'href' : 'data';
            const val = el.getAttribute(attr);
            
            if (val && !val.startsWith('http') && !val.startsWith('data:') && !val.startsWith('blob:') && !val.startsWith('#')) {
                const resolvedPath = resolveRelativePath(currentFile.absolutePath, val);
                const targetFile = pathMap[resolvedPath];
                
                if (targetFile && state.activeObjectUrls[targetFile.id]) {
                    el.setAttribute(attr, state.activeObjectUrls[targetFile.id]);
                    // A transpiled TS/TSX/JSX (or ESM .js) file still contains real
                    // import/export syntax in its output - only valid in a module script.
                    if (el.tagName === 'SCRIPT' && state.moduleFileIds.has(targetFile.id)) {
                        el.setAttribute('type', 'module');
                    }
                    resourceReport.linked.push(resolvedPath);
                } else {
                    resourceReport.unlinked.push(resolvedPath);
                }
            } else if (val && val.startsWith('http')) {
                resourceReport.external.push(val);
            }
        });

        // Stylesheets pulled in via a JS-side `import './x.css'` (common in React/Vite-style
        // code) don't correspond to any HTML tag rewritten above - inject a <link> for each,
        // skipping any that are already linked directly in the HTML.
        state.jsImportedCssFileIds.forEach(cssId => {
            const url = state.activeObjectUrls[cssId];
            if (!url) return;
            const alreadyLinked = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).some(l => l.getAttribute('href') === url);
            if (alreadyLinked) return;
            const link = doc.createElement('link');
            link.setAttribute('rel', 'stylesheet');
            link.setAttribute('href', url);
            doc.head.appendChild(link);
            const cssFile = Object.values(pathMap).find(f => f.id === cssId);
            resourceReport.linked.push('(imported) ' + (cssFile ? cssFile.absolutePath : 'stylesheet'));
        });

        if (state.moduleTranspileReport && state.moduleTranspileReport.ok) {
            resourceReport.packages = state.moduleTranspileReport.packages || [];
        }

        const hotCssTag = doc.createElement('style');
        hotCssTag.id = 'codemini-hot-css';
        doc.head.appendChild(hotCssTag);

        return { html: doc.documentElement.outerHTML, resources: resourceReport };
    }

    function buildInteractiveTree(obj, keyName = null, isRoot = true) {
        const wrapper = document.createElement('div');
        if (!isRoot) wrapper.classList.add('tree-node');

        if (obj === null) {
            wrapper.innerHTML = `${keyName ? `<span class="tree-key">${keyName}:</span> ` : ''}<span class="tree-null">null</span>`;
            return wrapper;
        }

        const type = typeof obj;
        if (type === 'string') {
            wrapper.innerHTML = `${keyName ? `<span class="tree-key">${keyName}:</span> ` : ''}<span class="tree-string">"${obj.replace(/</g, '&lt;').replace(/>/g, '&gt;')}"</span>`;
            return wrapper;
        }
        if (type === 'number') {
            wrapper.innerHTML = `${keyName ? `<span class="tree-key">${keyName}:</span> ` : ''}<span class="tree-number">${obj}</span>`;
            return wrapper;
        }
        if (type === 'boolean') {
            wrapper.innerHTML = `${keyName ? `<span class="tree-key">${keyName}:</span> ` : ''}<span class="tree-boolean">${obj}</span>`;
            return wrapper;
        }

        if (type === 'object') {
            const isArray = Array.isArray(obj);
            const keys = Object.keys(obj);
            const summary = isArray ? `Array(${keys.length})` : `Object {${keys.length}}`;

            const caret = document.createElement('span');
            caret.className = 'tree-caret';
            caret.innerHTML = `${keyName ? `<span class="tree-key">${keyName}:</span> ` : ''}${summary}`;
            
            const nested = document.createElement('div');
            nested.className = 'tree-nested';
            
            keys.forEach(k => {
                nested.appendChild(buildInteractiveTree(obj[k], k, false));
            });

            caret.addEventListener('click', function() {
                this.classList.toggle('tree-caret-down');
                nested.classList.toggle('tree-active');
            });

            wrapper.appendChild(caret);
            wrapper.appendChild(nested);
            return wrapper;
        }

        wrapper.innerHTML = `${keyName ? `<span class="tree-key">${keyName}:</span> ` : ''}<span>${String(obj)}</span>`;
        return wrapper;
    }

    function getEditorContentByFileId(fileId) {
        const tab = document.querySelector(`.tab[data-file-id="${fileId}"]`);
        if (!tab) return null;
        const pane = document.getElementById(tab.dataset.target);
        if (!pane || !window.monaco) return null;
        const monacoContainer = pane.querySelector('[id^="editor-container-"]');
        if (monacoContainer) {
            const editor = window.monaco.editor.getEditors().find(e => monacoContainer.contains(e.getContainerDomNode()));
            if (editor) return editor.getValue();
        }
        return null;
    }

    // Wraps a bare .js/.jsx/.ts/.tsx file in a minimal HTML page so it can go through the
    // exact same dependency-linking pipeline as a real HTML file. The file is imported via
    // its stable "cm:module:<id>" import-map key (populated by transpileAndLinkModules)
    // rather than a relative src - inline module scripts aren't touched by
    // injectLocalDependencies's src/href rewriting, so a plain relative path here
    // wouldn't resolve to anything.
    //
    // Most component files expect to be imported by some other entry point and never call
    // anything like ReactDOM.createRoot(...).render(...) themselves - previewed as-is,
    // that's a page that loads correctly and shows nothing, with no error to explain why.
    // For .tsx/.jsx specifically, if the default export looks like a component (a
    // function), it's auto-mounted into #root; a file that already mounts itself (like a
    // hand-written entry point) is unaffected, since this only renders something when
    // there's a default export to render in the first place.
    function buildSyntheticEntryHtml(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        // Matches the same "everything but plain .ts" rule used for JSX support during
        // transpilation (see transpileAndLinkModules) - a .js file is just as likely to
        // default-export a component as a .jsx one is.
        const mayBeComponent = ext !== 'ts';
        const autoMount = mayBeComponent ? `
        const CM_Component = CM_Entry.default;
        if (typeof CM_Component === 'function') {
            const [{ createRoot }, React] = await Promise.all([import('react-dom/client'), import('react')]);
            createRoot(document.getElementById('root')).render(React.createElement(CM_Component));
        }` : '';
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${file.name}</title>
    <style>html, body { margin: 0; min-height: 100%; } #root { min-height: 100vh; }</style>
</head>
<body>
    <div id="root"></div>
    <script type="module">
        import * as CM_Entry from 'cm:module:${file.id}';${autoMount}
    </script>
</body>
</html>`;
    }

    // 7. Dynamic Content Renderer
    async function renderPreviewContent(file, rawContent, isHistoryNav = false) {
        const currentWinId = localStorage.getItem('codemini_active_window') || 'win_default';
        const state = getPreviewState();

        if (!isHistoryNav) {
            state.navHistory = state.navHistory.slice(0, state.currentNavIndex + 1);
            state.navHistory.push({ file: file, content: rawContent });
            state.currentNavIndex++;
        }

        lpCurrentFileLabel.textContent = file.name;
        const ext = file.name.split('.').pop().toLowerCase();
        const isHtml = ext === 'html';
        // A bare component/script file has no HTML of its own to load - it gets wrapped in
        // a minimal synthetic page (see buildSyntheticEntryHtml) and run through the exact
        // same dependency-linking pipeline as a real HTML file, so it's just as "live" -
        // console/network/inspector and the resources panel all apply to it too.
        const isCodeEntry = ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(ext);
        const showWebTools = isHtml || isCodeEntry;
        let finalHtml = '';

        // Dynamically show/hide specific tool icons based on file type
        const displayVal = showWebTools ? 'inline-block' : 'none';
        lpResourcesBtn.style.display = showWebTools ? 'block' : 'none';
        lpStorageManagerBtn.style.display = showWebTools ? 'block' : 'none';
        
        const webTools = [
            lpToggleConsole, lpNetworkBtn, lpInspectorBtn, 
            lpLayoutDebugBtn, lpToggleEditMode, lpToggleGrid
        ];
        webTools.forEach(btn => { if (btn) btn.style.display = displayVal; });

        // Clean up UI state if transitioning to a preview with no live DOM/JS of its own
        if (!showWebTools) {
            lpResourcesBtn.classList.remove('active-state');
            lpResourcesPanel.classList.remove('show');
            lpStorageManagerBtn.classList.remove('active-state');
            lpStoragePanel.classList.remove('show');
            lpConsolePanel.classList.remove('show');
            lpNetworkPanel.classList.remove('show');
            lpInspectorPanel.classList.remove('show');
            state.inspectorEnabled = false;
            state.inspectorLocked = false;
            state.inspectorData = null;
            state.layoutDebugEnabled = false;
            state.editModeEnabled = false;
            state.gridEnabled = false;
            
            [lpLayoutDebugBtn, lpInspectorBtn, lpToggleEditMode, lpToggleGrid].forEach(btn => {
                if(btn) btn.classList.remove('active-state');
            });
        }

        if (['md', 'csv'].includes(ext)) {
            const chars = rawContent.length;
            const words = rawContent.trim() ? rawContent.trim().split(/\s+/).length : 0;
            lpWordCount.textContent = `${words} words, ${chars} chars`;
        } else {
            lpWordCount.textContent = '';
        }

        lpLoader.classList.add('show'); 

        if (ext === 'md') {
            const escapedContent = rawContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            finalHtml = `
                <!DOCTYPE html>
                <html><head>
                    ${injectedInterceptors}
                    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown.min.css">
                    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
                    <style>
                        body { box-sizing: border-box; min-width: 200px; max-width: 980px; margin: 0 auto; padding: 45px; background-color: #ffffff; }
                        #content { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
                        @media (max-width: 767px) { body { padding: 25px; } }
                    </style>
                </head><body class="markdown-body">
                    <textarea id="raw-md" style="display:none;">${escapedContent}</textarea>
                    <div id="content"></div>
                    <script>
                        marked.use({ gfm: true, breaks: true });
                        const rawMdText = document.getElementById('raw-md').value;
                        document.getElementById('content').innerHTML = marked.parse(rawMdText);
                    </script>
                </body></html>`;
        } else if (ext === 'json') {
            finalHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    ${injectedInterceptors}
                    <style>
                        body { padding: 30px; margin: 0; font-family: 'Fira Code', 'Consolas', monospace; background: #1e1e1e; color: #cccccc; font-size: 14px; line-height: 1.6; }
                        .tree-node { margin-left: 25px; }
                        .tree-caret { cursor: pointer; user-select: none; color: #569cd6; font-weight: bold; }
                        .tree-caret::before { content: '▶'; display: inline-block; margin-right: 6px; transition: transform 0.2s; font-size: 11px; color: #888; }
                        .tree-caret.tree-caret-down::before { transform: rotate(90deg); }
                        .tree-nested { display: none; margin-left: 10px; border-left: 1px dashed #444; padding-left: 15px; margin-top: 4px; }
                        .tree-active { display: block; }
                        .tree-key { color: #9cdcfe; }
                        .tree-string { color: #ce9178; }
                        .tree-number { color: #b5cea8; }
                        .tree-boolean { color: #569cd6; }
                        .tree-null { color: #808080; font-style: italic; }
                        .tree-wrapper { padding: 4px 0; }
                    </style>
                </head>
                <body>
                    <div id="jsonRoot"></div>
                    <script>
                        const data = ${rawContent || "{}"};
                        function buildTree(obj, keyName = null, isRoot = true) {
                            const wrapper = document.createElement('div');
                            wrapper.className = isRoot ? 'tree-wrapper' : 'tree-wrapper tree-node';
                            if (obj === null) { wrapper.innerHTML = (keyName ? '<span class="tree-key">' + keyName + ':</span> ' : '') + '<span class="tree-null">null</span>'; return wrapper; }
                            const type = typeof obj;
                            if (type === 'string') { wrapper.innerHTML = (keyName ? '<span class="tree-key">' + keyName + ':</span> ' : '') + '<span class="tree-string">"' + obj.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '"</span>'; return wrapper; }
                            if (type === 'number') { wrapper.innerHTML = (keyName ? '<span class="tree-key">' + keyName + ':</span> ' : '') + '<span class="tree-number">' + obj + '</span>'; return wrapper; }
                            if (type === 'boolean') { wrapper.innerHTML = (keyName ? '<span class="tree-key">' + keyName + ':</span> ' : '') + '<span class="tree-boolean">' + obj + '</span>'; return wrapper; }
                            if (type === 'object') {
                                const isArray = Array.isArray(obj); const keys = Object.keys(obj);
                                const summary = isArray ? 'Array[' + keys.length + ']' : 'Object {' + keys.length + '}';
                                const caret = document.createElement('span'); caret.className = 'tree-caret tree-caret-down';
                                caret.innerHTML = (keyName ? '<span class="tree-key">' + keyName + ':</span> ' : '') + summary;
                                const nested = document.createElement('div'); nested.className = 'tree-nested tree-active';
                                keys.forEach(k => { nested.appendChild(buildTree(obj[k], k, false)); });
                                caret.addEventListener('click', function() { this.classList.toggle('tree-caret-down'); nested.classList.toggle('tree-active'); });
                                wrapper.appendChild(caret); wrapper.appendChild(nested); return wrapper;
                            }
                            wrapper.innerHTML = (keyName ? '<span class="tree-key">' + keyName + ':</span> ' : '') + '<span>' + String(obj) + '</span>'; return wrapper;
                        }
                        document.getElementById('jsonRoot').appendChild(buildTree(data));
                    </script>
                </body>
                </html>`;
        } else if (ext === 'css') {
            finalHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    ${injectedInterceptors}
                    <style id="codemini-hot-css">${rawContent}</style>
                    <style>
                        /* Base resets that do not interfere with the user's styling but ensure structure */
                        html, body { min-height: 100%; margin: 0; padding: 25px; box-sizing: border-box; }
                    </style>
                </head>
                <body>
                    <h1>Heading 1 Size</h1>
                    <h2>Heading 2 Size</h2>
                    <h3>Heading 3 Size</h3>
                    <p>This is a standard paragraph. It includes <strong>bold text</strong>, <em>italic emphasis</em>, and a <a href="#">hyperlink</a>. The quick brown fox jumps over the lazy dog. Checking how your CSS styles basic typography and spacing.</p>
                    
                    <blockquote>This is a blockquote element, meant to isolate quotes visually.</blockquote>
                    <code>Inline code block test</code>

                    <div style="margin-top: 30px;">
                        <button type="button">Default Button</button>
                        <button type="button" class="primary">Primary Class</button>
                        <button type="button" class="secondary" disabled>Disabled</button>
                    </div>
                    
                    <div style="margin-top: 30px;">
                        <label>Text Input</label><br>
                        <input type="text" placeholder="Enter text..." style="margin-top: 5px; margin-bottom: 10px;">
                        <br>
                        <input type="checkbox" id="chk"> <label for="chk">Checkbox Option</label>
                        <br>
                        <input type="radio" id="rd" name="grp"> <label for="rd">Radio Option</label>
                    </div>

                    <div style="margin-top: 30px; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
                        <div style="padding: 20px; border: 1px solid #ccc;">Grid Card A</div>
                        <div style="padding: 20px; border: 1px solid #ccc;">Grid Card B</div>
                        <div style="padding: 20px; border: 1px solid #ccc;">Grid Card C</div>
                    </div>
                </body>
                </html>`;
        } else if (ext === 'csv') {
            const lines = rawContent.trim().split('\n');
            const headerHtml = lines[0] ? `<tr>${lines[0].split(',').map(c => `<th>${c.trim()}</th>`).join('')}</tr>` : '';
            const rowsHtml = lines.slice(1).map(r => `<tr>${r.split(',').map(c => `<td>${c.trim()}</td>`).join('')}</tr>`).join('');
            
            finalHtml = `
                <html>
                <head>
                    ${injectedInterceptors}
                    <style>
                        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #ffffff; color: #333; }
                        .csv-wrapper { width: 100%; height: 100vh; overflow: auto; box-sizing: border-box; padding: 25px; }
                        table { border-collapse: collapse; width: 100%; font-size: 13px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
                        th { background: #f8fafc; position: sticky; top: 0; padding: 12px 16px; text-align: left; font-weight: 600; color: #475569; border-bottom: 2px solid #cbd5e1; z-index: 10; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
                        td { border-bottom: 1px solid #f1f5f9; padding: 10px 16px; text-align: left; color: #334155; }
                        tr:nth-child(even) { background-color: #f8fafc; }
                        tr:hover { background-color: #f1f5f9; transition: background-color 0.15s ease; }
                    </style>
                </head>
                <body>
                    <div class="csv-wrapper">
                        <table>
                            <thead>${headerHtml}</thead>
                            <tbody>${rowsHtml}</tbody>
                        </table>
                    </div>
                </body>
                </html>`;
        } else if (ext === 'svg') {
            // Rendered inline (not as an <img src>) so it displays as a real vector image
            // without needing a data-URI/blob round-trip for something this simple.
            // Anything before the <svg tag itself (an XML declaration, DOCTYPE, or
            // exporter comments - common from Illustrator/Figma/Inkscape) is invalid in
            // an HTML parsing context and can break the parse right where the real
            // content starts, so it's stripped rather than embedded as-is.
            const svgStart = rawContent.indexOf('<svg');
            const svgOnly = svgStart >= 0 ? rawContent.slice(svgStart) : rawContent;
            finalHtml = `
                <html>
                <head>
                    ${injectedInterceptors}
                    <style>
                        html, body { margin: 0; height: 100%; background: #fafafa; display: flex; align-items: center; justify-content: center; }
                        .svg-wrap { width: min(90vw, 480px); height: min(90vh, 480px); }
                        .svg-wrap svg { width: 100%; height: 100%; object-fit: contain; display: block; }
                    </style>
                </head>
                <body>
                    <div class="svg-wrap">${svgOnly}</div>
                </body>
                </html>`;
        } else {
            const files = await getAllWorkspaceFiles();
            // Strict check to prevent asynchronous data contamination during window switches
            if (currentWinId !== (localStorage.getItem('codemini_active_window') || 'win_default')) return;

            const pathMap = buildVirtualPathTree(files);
            const needsCompile = files.some(f => f.type === 'file' && f.content && ['ts', 'tsx', 'jsx'].includes(f.name.split('.').pop().toLowerCase()));
            lpLoader.title = needsCompile ? 'Compiling...' : 'Loading preview...';
            await refreshBlobMap(files);
            // refreshBlobMap now includes the Babel CDN load + transpilation, which can
            // take a real amount of time on first load - long enough for the user to have
            // switched to a different window/profile while it was running. Since lpIframe,
            // lpResourcesPanel, etc. are single shared DOM elements reused across whichever
            // window is currently active, re-check here (not just after the earlier,
            // now much shorter getAllWorkspaceFiles await) before touching any of them with
            // what could be a now-stale window's data.
            if (currentWinId !== (localStorage.getItem('codemini_active_window') || 'win_default')) return;
            
            const currentFile = pathMap[file.absolutePath] || file;
            const htmlToProcess = isCodeEntry ? buildSyntheticEntryHtml(currentFile) : rawContent;
            let result = injectLocalDependencies(htmlToProcess, currentFile, pathMap);
            let processedHtml = result.html;
            
            if (isHtml || isCodeEntry) {
                let resHtml = '';
                const rep = result.resources;
                const escapeForPanel = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                if (rep.linked.length > 0) { resHtml += `<div class="res-group-title"><span>Local Linked Files</span></div>`; rep.linked.forEach(r => resHtml += `<div class="res-item res-linked"><i class="ri-check-line"></i> ${r}</div>`); }
                if (rep.packages.length > 0) { resHtml += `<div class="res-group-title"><span>Packages (CDN)</span></div>`; rep.packages.forEach(r => resHtml += `<div class="res-item res-external"><i class="ri-npmjs-line"></i> ${r}</div>`); }
                if (rep.external.length > 0) { resHtml += `<div class="res-group-title"><span>External Resources</span></div>`; rep.external.forEach(r => resHtml += `<div class="res-item res-external"><i class="ri-global-line"></i> ${r}</div>`); }
                if (rep.unlinked.length > 0) { resHtml += `<div class="res-group-title"><span>Missing Local Links</span></div>`; rep.unlinked.forEach(r => resHtml += `<div class="res-item res-unlinked"><i class="ri-close-line"></i> ${r}</div>`); }
                if (state.moduleTranspileReport && state.moduleTranspileReport.ok === false) {
                    resHtml += `<div class="res-group-title"><span>Compiler</span></div>`;
                    resHtml += `<div class="res-item res-error"><i class="ri-error-warning-line"></i> Couldn't load the TS/JSX compiler (check your connection) - .ts/.tsx/.jsx files were not linked.</div>`;
                }
                if (state.moduleTranspileReport && state.moduleTranspileReport.failed && state.moduleTranspileReport.failed.length > 0) {
                    resHtml += `<div class="res-group-title"><span>Compile Errors</span></div>`;
                    state.moduleTranspileReport.failed.forEach(f => resHtml += `<div class="res-item res-error"><i class="ri-error-warning-line"></i> ${escapeForPanel(f.name)}: ${escapeForPanel(f.error)}</div>`);
                }
                if (state.moduleTranspileReport && state.moduleTranspileReport.unresolvedImports && state.moduleTranspileReport.unresolvedImports.length > 0) {
                    resHtml += `<div class="res-group-title"><span>Unresolved Imports</span></div>`;
                    state.moduleTranspileReport.unresolvedImports.forEach(r => resHtml += `<div class="res-item res-unlinked"><i class="ri-close-line"></i> ${escapeForPanel(r)}</div>`);
                }
                if (resHtml === '') { resHtml = `<div style="text-align:center; color:var(--text-muted); font-style:italic; padding:10px;">No links detected.</div>`; }
                lpResourcesPanel.innerHTML = resHtml;

                // Track which local files are considered "related" to the actively previewing file,
                // so the Storage Manager can scope itself to keys attributed to this file/its deps.
                state.lastResourceReport = {
                    linked: rep.linked.slice(),
                    unlinked: rep.unlinked.slice(),
                    external: rep.external.slice(),
                    currentFileName: currentFile.name,
                    currentFilePath: currentFile.absolutePath
                };
            } else {
                state.lastResourceReport = { linked: [], unlinked: [], external: [], currentFileName: file.name, currentFilePath: file.absolutePath };
            }
            // A fresh render means a fresh page load in the iframe — any cached storage snapshot is stale.
            state.lastStorageData = null;
            state.storageExpandedKeys.clear();
            // A fresh iframe document means pending network requests from the old page will never resolve
            // (their promises/XHR objects are gone). Drop anything still "pending" so it doesn't sit there
            // forever looking stuck; optionally clear everything if the user has auto-clear enabled.
            if (state.networkAutoClear) {
                state.networkEntries.clear();
                state.networkExpandedIds.clear();
            } else {
                state.networkEntries.forEach((entry, reqId) => {
                    if (entry.status === 'pending') state.networkEntries.delete(reqId);
                });
            }
            if (lpNetworkPanel.classList.contains('show')) renderNetworkPanel(state);
            // A fresh iframe document also invalidates any locked/hovered inspector selection --
            // the underlying element no longer exists once the page reloads.
            state.inspectorLocked = false;
            state.inspectorData = null;
            if (lpInspectorPanel.classList.contains('show')) renderInspectorPanel(state);
            
            if (processedHtml.includes('<head>')) {
                processedHtml = processedHtml.replace('<head>', '<head>' + injectedInterceptors);
            } else {
                processedHtml = injectedInterceptors + processedHtml;
            }
            finalHtml = processedHtml;
        }

        const lpIframe = document.getElementById('lpIframe');
        const reloadMode = getReloadMode();

        if (reloadMode === 'legacy') {
            // Legacy path: rewrite the existing iframe document in place via
            // document.write(). Kept as an opt-in fallback (Settings panel) for any
            // preview content that turns out to depend on the old same-window reuse
            // behavior. Does NOT reliably tear down the previous page's live
            // connections (WebSockets, polling intervals, in-flight fetches) - see
            // the 'navigate' branch below for why that matters with real backends.
            const doc = lpIframe.contentWindow.document;
            lpIframe.onload = function() { lpLoader.classList.remove('show'); lpLoader.title = ''; };
            doc.open(); doc.write(finalHtml); doc.close();

            if (state.inspectorEnabled) lpIframe.contentWindow.postMessage({ type: 'toggle-inspector', enabled: true }, '*');
            if (state.layoutDebugEnabled) lpIframe.contentWindow.postMessage({ type: 'toggle-layout-debug', enabled: true }, '*');
            if (state.editModeEnabled) lpIframe.contentWindow.postMessage({ type: 'toggle-edit', enabled: true }, '*');
            if (state.gridEnabled) lpIframe.contentWindow.postMessage({ type: 'toggle-grid', enabled: true }, '*');
        } else {
            // Default path: a real navigation (fresh Blob URL) instead of
            // document.write() into the existing window. document.write() rewrites
            // the current document in place - it does NOT reliably tear down the
            // previous page's live connections (a Supabase realtime WebSocket, an
            // onAuthStateChange listener, a setInterval poll loop, an in-flight
            // fetch). Those can keep running alongside the "new" page and race it,
            // which is why data from a real backend can look stale or stuck even
            // right after a manual or auto reload. A real navigation also gives every
            // fetch() a genuinely new document URL each time, rather than reusing the
            // same context indefinitely - important because without that, the
            // browser is free to serve a cached response for a GET to the same
            // effective location.
            const oldDocUrl = state._lastDocUrl;
            const blob = new Blob([finalHtml], { type: 'text/html' });
            const docUrl = URL.createObjectURL(blob);
            state._lastDocUrl = docUrl;
            // Tracked separately from state._lastDocUrl (which now points at
            // the new URL) so forceClosePreview can still find and revoke
            // this one even if the onload below never runs: switching windows
            // replaces #lpIframe outright (see forceClosePreview), which
            // aborts whatever navigation was in flight and silently drops
            // this exact closure - without this, oldDocUrl would leak for
            // any reload that a window switch happens to interrupt.
            if (oldDocUrl) {
                state._pendingRevokeUrls = state._pendingRevokeUrls || new Set();
                state._pendingRevokeUrls.add(oldDocUrl);
            }

            lpIframe.onload = function() {
                lpLoader.classList.remove('show');
                lpLoader.title = '';
                // Re-inject states if enabled - deferred until the new document has
                // actually loaded, since postMessage to a not-yet-navigated iframe is dropped.
                if (state.inspectorEnabled) lpIframe.contentWindow.postMessage({ type: 'toggle-inspector', enabled: true }, '*');
                if (state.layoutDebugEnabled) lpIframe.contentWindow.postMessage({ type: 'toggle-layout-debug', enabled: true }, '*');
                if (state.editModeEnabled) lpIframe.contentWindow.postMessage({ type: 'toggle-edit', enabled: true }, '*');
                if (state.gridEnabled) lpIframe.contentWindow.postMessage({ type: 'toggle-grid', enabled: true }, '*');
                // Old document URL only gets revoked once the new one has actually
                // taken over the iframe - revoking too early can abort a slow-loading navigation.
                if (oldDocUrl) {
                    URL.revokeObjectURL(oldDocUrl);
                    if (state._pendingRevokeUrls) state._pendingRevokeUrls.delete(oldDocUrl);
                }
            };
            lpIframe.src = docUrl;
        }

        lpIframe.dataset.rawHtml = encodeURIComponent(finalHtml);
        updateNavArrows(state);
    }

    function updateNavArrows(state) {
        if (state.currentNavIndex > 0) { lpNavBack.classList.remove('disabled'); } else { lpNavBack.classList.add('disabled'); }
        if (state.currentNavIndex < state.navHistory.length - 1) { lpNavFwd.classList.remove('disabled'); } else { lpNavFwd.classList.add('disabled'); }
    }

    // Storage Manager Action APIs exposed to global execution context
    window.manageStorage = function(action, sType, key) {
        const iframe = document.getElementById('lpIframe');
        if (!iframe || !iframe.contentWindow) return;
        
        if (action === 'delete') {
            iframe.contentWindow.postMessage({ type: 'delete-storage', sType, key }, '*');
        } else if (action === 'rename') {
            if(window.showCustomModal) {
                window.showCustomModal({
                    title: 'Rename Storage Item',
                    inputType: 'text',
                    inputValue: key,
                    submitText: 'Rename'
                }, (newKey) => {
                    if(newKey && newKey !== key) {
                        iframe.contentWindow.postMessage({ type: 'rename-storage', sType, oldKey: key, newKey }, '*');
                    }
                    closeGenModal();
                });
            } else {
                const newKey = prompt("Enter new storage identifier:", key);
                if (newKey && newKey !== key) {
                    iframe.contentWindow.postMessage({ type: 'rename-storage', sType, oldKey: key, newKey }, '*');
                }
            }
        }
    };
    
    window.clearAllStorage = function(sType, triggerEl) {
        const iframe = document.getElementById('lpIframe');
        if (!iframe || !iframe.contentWindow) return;
        let onlyKeys = null;
        if (triggerEl && triggerEl.dataset && triggerEl.dataset.onlyKeys) {
            try { onlyKeys = JSON.parse(triggerEl.dataset.onlyKeys); } catch(e) { onlyKeys = null; }
        }
        iframe.contentWindow.postMessage({ type: 'clear-storage-type', sType, onlyKeys }, '*');
    };

    // Drag Resizing Logic for Docked View (desktop width) and mobile inspector bottom-sheet (height)
    const lpResizer = document.getElementById('lpResizer');
    if (lpResizer && window.makeResizable) {
        window.makeResizable(lpResizer, {
            cursor: 'ew-resize',
            onStart: () => {
                if (!document.body.classList.contains('preview-docked')) return false;
                const iframe = document.getElementById('lpIframe');
                if (iframe) iframe.style.pointerEvents = 'none'; // Prevent drag break over iframe
            },
            onMove: (dx, dy, e) => {
                const clientX = e.touches ? e.touches[0].clientX : (e.clientX !== undefined ? e.clientX : window.innerWidth);
                const newWidthPx = window.innerWidth - clientX;
                const newWidthVw = (newWidthPx / window.innerWidth) * 100;
                if (newWidthVw > 20 && newWidthVw < 80) { // Constrain width 20% - 80%
                    document.documentElement.style.setProperty('--dock-width', `${newWidthVw}vw`);
                    const state = getPreviewState();
                    state.dockWidth = newWidthVw;
                }
            },
            onEnd: () => {
                const iframe = document.getElementById('lpIframe');
                if (iframe) iframe.style.pointerEvents = '';
                savePreviewState(); // Save dock width
            }
        });
    }

    // Mobile bottom-sheet inspector panel height, dragged via the handle at its top edge.
    const lpInspectorVResizer = document.getElementById('lpInspectorVResizer');
    if (lpInspectorVResizer && lpInspectorPanel && window.makeResizable) {
        let startHeight = 0;
        window.makeResizable(lpInspectorVResizer, {
            onStart: () => {
                startHeight = lpInspectorPanel.offsetHeight;
                const iframe = document.getElementById('lpIframe');
                if (iframe) iframe.style.pointerEvents = 'none';
                lpInspectorPanel.style.transition = 'none';
            },
            onMove: (dx, dy) => {
                // Dragging the handle up (negative dy) should grow the sheet, since it's
                // anchored to the bottom of the screen - so height increases as dy decreases.
                let newHeight = startHeight - dy;
                const maxHeight = window.innerHeight * 0.85;
                const minHeight = 120;
                if (newHeight < minHeight) newHeight = minHeight;
                if (newHeight > maxHeight) newHeight = maxHeight;
                lpInspectorPanel.style.height = `${newHeight}px`;
            },
            onEnd: () => {
                lpInspectorPanel.style.transition = '';
                const iframe = document.getElementById('lpIframe');
                if (iframe) iframe.style.pointerEvents = '';
                const state = getPreviewState();
                state.inspectorMobileHeight = lpInspectorPanel.offsetHeight;
                savePreviewState();
            }
        });
    }

    // 8. Core Event Listeners
    if (playIconItem) {
        playIconItem.addEventListener('click', async () => {
            const currentWinId = localStorage.getItem('codemini_active_window') || 'win_default';
            const state = getPreviewState();
            const activeTab = document.querySelector('.editor-group.active-group .tab.active');
            if (activeTab) {
                const fileId = activeTab.dataset.fileId;
                if (!fileId) return;

                if (previewContainer.classList.contains('show') && !state.autoReloadEnabled) { return; }

                const tx = db.transaction('filesystem', 'readonly');
                tx.objectStore('filesystem').get(fileId).onsuccess = async (e) => {
                    const file = e.target.result;
                    if(file) {
                        const files = await getAllWorkspaceFiles();
                        if (currentWinId !== (localStorage.getItem('codemini_active_window') || 'win_default')) return;

                        const pathMap = buildVirtualPathTree(files);
                        const fileWithPath = pathMap[file.absolutePath] || files.find(f => f.id === file.id) || file; 
                        const content = getEditorContentByFileId(file.id) ?? file.content;
                        
                        if (!previewContainer.classList.contains('show')) {
                            state.navHistory = [];
                            state.currentNavIndex = -1;
                            lpConsoleContent.innerHTML = ''; 
                            lpNetworkContent.innerHTML = '';
                            syncPreviewUI(state); // Sync icons/layout before showing
                        }
                        
                        previewContainer.classList.add('show');
                        renderPreviewContent(fileWithPath, content);
                    }
                };
            }
        });
    }

    lpDockBtn.addEventListener('click', () => {
        const state = getPreviewState();
        state.isDocked = !state.isDocked;
        applyDockState(state);
        savePreviewState();
    });

    lpStorageManagerBtn.addEventListener('click', () => {
        lpStoragePanel.classList.toggle('show');
        lpStorageManagerBtn.classList.toggle('active-state');
        
        if (lpStoragePanel.classList.contains('show')) {
            lpResourcesPanel.classList.remove('show');
            lpResourcesBtn.classList.remove('active-state');
            lpSettingsPanel.classList.remove('show');
            lpSettingsBtn.classList.remove('active-state');
            
            const iframe = document.getElementById('lpIframe');
            if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage({ type: 'fetch-storage' }, '*');
        }
    });

    lpResourcesBtn.addEventListener('click', () => { 
        lpResourcesPanel.classList.toggle('show'); 
        lpResourcesBtn.classList.toggle('active-state'); 
        if (lpResourcesPanel.classList.contains('show')) {
            lpStoragePanel.classList.remove('show');
            lpStorageManagerBtn.classList.remove('active-state');
            lpSettingsPanel.classList.remove('show');
            lpSettingsBtn.classList.remove('active-state');
        }
    });

    // Settings panel - same drop-down-under-the-header pattern as Resources/Storage,
    // just with no file-type gating: it's always available regardless of what's
    // currently being previewed, since the reload strategy applies globally.
    lpSettingsBtn.addEventListener('click', () => {
        lpSettingsPanel.classList.toggle('show');
        lpSettingsBtn.classList.toggle('active-state');
        if (lpSettingsPanel.classList.contains('show')) {
            lpResourcesPanel.classList.remove('show');
            lpResourcesBtn.classList.remove('active-state');
            lpStoragePanel.classList.remove('show');
            lpStorageManagerBtn.classList.remove('active-state');
        }
    });

    [lpReloadModeNavigate, lpReloadModeLegacy].forEach(radio => {
        radio.addEventListener('change', () => {
            if (!radio.checked) return;
            setReloadMode(radio.value);
        });
    });

    lpNetworkBtn.addEventListener('click', () => {
        lpNetworkPanel.classList.toggle('show');
        lpNetworkBtn.classList.toggle('active-state');
        if (lpNetworkPanel.classList.contains('show')) renderNetworkPanel(getPreviewState());
    });
    lpCloseNetwork.addEventListener('click', () => { lpNetworkPanel.classList.remove('show'); lpNetworkBtn.classList.remove('active-state'); });
    lpClearNetwork.addEventListener('click', () => {
        const state = getPreviewState();
        state.networkEntries.clear();
        state.networkExpandedIds.clear();
        renderNetworkPanel(state);
    });

    lpToggleEditMode.addEventListener('click', () => {
        const state = getPreviewState();
        state.editModeEnabled = !state.editModeEnabled;
        lpToggleEditMode.classList.toggle('active-state', state.editModeEnabled);
        const iframe = document.getElementById('lpIframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'toggle-edit', enabled: state.editModeEnabled }, '*');
        }
    });

    lpToggleGrid.addEventListener('click', () => {
        const state = getPreviewState();
        state.gridEnabled = !state.gridEnabled;
        lpToggleGrid.classList.toggle('active-state', state.gridEnabled);
        const iframe = document.getElementById('lpIframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'toggle-grid', enabled: state.gridEnabled }, '*');
        }
    });

    lpInspectorBtn.addEventListener('click', () => {
        const state = getPreviewState();
        state.inspectorEnabled = !state.inspectorEnabled;
        const iframe = document.getElementById('lpIframe');
        if (state.inspectorEnabled) {
            lpInspectorBtn.classList.add('active-state');
            lpInspectorPanel.classList.add('show');
            if (window.innerWidth <= 768 && state.inspectorMobileHeight) {
                lpInspectorPanel.style.height = `${state.inspectorMobileHeight}px`;
            }
            state.inspectorLocked = false;
            state.inspectorData = null;
            renderInspectorPanel(state);
            if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage({ type: 'toggle-inspector', enabled: true }, '*');
        } else {
            lpInspectorBtn.classList.remove('active-state');
            lpInspectorPanel.classList.remove('show');
            state.inspectorLocked = false;
            state.inspectorData = null;
            if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage({ type: 'toggle-inspector', enabled: false }, '*');
        }
    });

    lpLayoutDebugBtn.addEventListener('click', () => {
        const state = getPreviewState();
        state.layoutDebugEnabled = !state.layoutDebugEnabled;
        lpLayoutDebugBtn.classList.toggle('active-state', state.layoutDebugEnabled);
        const iframe = document.getElementById('lpIframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'toggle-layout-debug', enabled: state.layoutDebugEnabled }, '*');
        }
    });

    lpAutoReloadBtn.addEventListener('click', () => {
        const state = getPreviewState();
        state.autoReloadEnabled = !state.autoReloadEnabled;
        if(state.autoReloadEnabled) { 
            lpAutoReloadBtn.classList.add('active-state'); 
            lpAutoReloadBtn.title = 'Auto-Reload: ON'; 
        } else { 
            lpAutoReloadBtn.classList.remove('active-state'); 
            lpAutoReloadBtn.title = 'Auto-Reload: OFF'; 
        }
        savePreviewState();
    });

    lpScrollLock.addEventListener('click', () => {
        const state = getPreviewState();
        state.autoScrollConsole = !state.autoScrollConsole;
        if(state.autoScrollConsole) {
            lpScrollLock.classList.replace('ri-lock-line', 'ri-lock-unlock-line');
            lpScrollLock.title = 'Auto-Scroll: ON';
            lpConsoleContent.parentElement.scrollTop = lpConsoleContent.parentElement.scrollHeight;
        } else {
            lpScrollLock.classList.replace('ri-lock-unlock-line', 'ri-lock-line');
            lpScrollLock.title = 'Auto-Scroll: OFF';
        }
        savePreviewState();
    });

    const filterBtns = document.querySelectorAll('.console-filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const state = getPreviewState();
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            lpConsoleContent.classList.remove('filter-all', 'filter-error', 'filter-warn', 'filter-log');
            const targetFilter = btn.getAttribute('data-filter');
            lpConsoleContent.classList.add(`filter-${targetFilter}`);
            if (state.autoScrollConsole) { lpConsoleContent.parentElement.scrollTop = lpConsoleContent.parentElement.scrollHeight; }
        });
    });

    lpRefreshBtn.addEventListener('click', async (e) => {
        const currentWinId = localStorage.getItem('codemini_active_window') || 'win_default';
        const state = getPreviewState();
        
        lpRefreshBtn.style.transition = "transform 0.5s ease";
        lpRefreshBtn.style.transform = "rotate(360deg)";
        
        const isHardReload = e.shiftKey;
        const currentState = state.navHistory[state.currentNavIndex];

        if (currentState && currentState.file) {
            const fileId = currentState.file.id;
            const tx = db.transaction('filesystem', 'readonly');
            tx.objectStore('filesystem').get(fileId).onsuccess = async (ev) => {
                const file = ev.target.result || currentState.file;
                const files = await getAllWorkspaceFiles();
                if (currentWinId !== (localStorage.getItem('codemini_active_window') || 'win_default')) return;

                const pathMap = buildVirtualPathTree(files); 
                
                if(isHardReload) {
                    Object.values(state.activeObjectUrls).forEach(url => URL.revokeObjectURL(url));
                    state.activeObjectUrls = {};
                    const needsCompile = files.some(f => f.type === 'file' && f.content && ['ts', 'tsx', 'jsx'].includes(f.name.split('.').pop().toLowerCase()));
                    lpLoader.title = needsCompile ? 'Compiling...' : 'Loading preview...';
                    lpLoader.classList.add('show');
                    await refreshBlobMap(files);
                    // Same reasoning as the main render path: this await can now genuinely
                    // take a while (Babel CDN load + transpile), so re-check before acting
                    // on what might be a stale window/profile's data.
                    if (currentWinId !== (localStorage.getItem('codemini_active_window') || 'win_default')) return;
                }

                const fileWithPath = pathMap[file.absolutePath] || files.find(f => f.id === file.id) || file;
                const freshContent = getEditorContentByFileId(fileId) ?? file.content;
                renderPreviewContent(fileWithPath, freshContent, true);
            };
        }

        setTimeout(() => { 
            lpRefreshBtn.style.transition = "none"; 
            lpRefreshBtn.style.transform = "rotate(0deg)"; 
        }, 500);
    });

    lpPopOutBtn.addEventListener('click', () => {
        const lpIframe = document.getElementById('lpIframe');
        if (!lpIframe || !lpIframe.dataset.rawHtml) return;
        const html = decodeURIComponent(lpIframe.dataset.rawHtml);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    });

    lpNavBack.addEventListener('click', () => {
        const state = getPreviewState();
        if (state.currentNavIndex > 0) {
            state.currentNavIndex--;
            const st = state.navHistory[state.currentNavIndex];
            renderPreviewContent(st.file, st.content, true);
        }
    });

    lpNavFwd.addEventListener('click', () => {
        const state = getPreviewState();
        if (state.currentNavIndex < state.navHistory.length - 1) {
            state.currentNavIndex++;
            const st = state.navHistory[state.currentNavIndex];
            renderPreviewContent(st.file, st.content, true);
        }
    });

    lpMaximizeBtn.addEventListener('click', () => {
        const state = getPreviewState();
        state.isMaximized = !state.isMaximized;
        if (state.isMaximized) {
            previewContainer.classList.add('maximized');
            lpMaximizeBtn.classList.replace('ri-fullscreen-line', 'ri-fullscreen-exit-line');
        } else {
            previewContainer.classList.remove('maximized');
            lpMaximizeBtn.classList.replace('ri-fullscreen-exit-line', 'ri-fullscreen-line');
        }
        savePreviewState();
    });

    lpCloseBtn.addEventListener('click', () => {
        const winId = localStorage.getItem('codemini_active_window') || 'win_default';
        window.forceClosePreview(winId);
    });

    lpToggleConsole.addEventListener('click', () => {
        const state = getPreviewState();
        lpConsolePanel.classList.toggle('show');
        if (lpConsolePanel.classList.contains('show')) {
            lpConsoleInput.focus();
            if (state.autoScrollConsole) lpConsoleContent.parentElement.scrollTop = lpConsoleContent.parentElement.scrollHeight;
        }
    });

    lpCloseConsole.addEventListener('click', () => { lpConsolePanel.classList.remove('show'); });
    lpClearConsole.addEventListener('click', () => { lpConsoleContent.innerHTML = ''; });

    lpConsoleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const state = getPreviewState();
            const command = lpConsoleInput.value.trim();
            if (command) {
                if (command === 'clear()') { lpConsoleContent.innerHTML = ''; lpConsoleInput.value = ''; return; }
                const entry = document.createElement('div');
                entry.className = `console-entry`;
                
                const now = new Date();
                const timeStr = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
                
                entry.innerHTML = `
                    <div style="display:flex; justify-content:space-between; width:100%; margin-bottom: 2px;">
                        <div style="display:flex; align-items:center; gap:5px;"><span style="color: var(--term-prompt-user); font-weight:bold;">&gt;</span> <span style="font-weight:600; color: var(--term-cmd-text);">Input</span></div>
                        <span style="color: var(--term-gray); font-size: 11px; user-select: none;">${timeStr}</span>
                    </div>
                    <div style="padding-left: 18px; color: var(--term-cmd-text);">${command.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                `;

                lpConsoleContent.appendChild(entry);
                const iframe = document.getElementById('lpIframe');
                if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage({ type: 'eval', code: command }, '*');
                
                lpConsoleInput.value = '';
                if (state.autoScrollConsole) lpConsoleContent.parentElement.scrollTop = lpConsoleContent.parentElement.scrollHeight;
            }
        }
    });

    window.addEventListener('message', async (event) => {
        const iframe = document.getElementById('lpIframe');
        if (!iframe || event.source !== iframe.contentWindow) return;

        const currentWinId = localStorage.getItem('codemini_active_window') || 'win_default';
        const state = getPreviewState();
        const data = event.data;
        if (!data) return;

        if (data.type === 'console') {
            const entry = document.createElement('div');
            entry.className = `console-entry console-${data.level}`;
            let icon = '';
            if (data.level === 'error') icon = '<i class="ri-close-circle-line" style="color: var(--term-red); margin-top:1px;"></i>';
            else if (data.level === 'warn') icon = '<i class="ri-error-warning-line" style="color: var(--term-yellow); margin-top:1px;"></i>';
            else if (data.level === 'info') icon = '<i class="ri-information-line" style="color: var(--term-blue); margin-top:1px;"></i>';
            else if (data.level === 'result') icon = '<span style="color: var(--term-gray); font-weight:bold;">&lt;</span>';

            const now = new Date();
            const timeStr = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;

            entry.innerHTML = `
                <div style="display:flex; justify-content:space-between; width:100%; margin-bottom: 2px;">
                    <div style="display:flex; align-items:center; gap:5px;">${icon} <span style="font-weight:600;">${data.level === 'result' ? 'Result' : 'Console'}</span></div>
                    <span style="color: var(--term-gray); font-size: 11px; user-select: none;">${timeStr}</span>
                </div>
            `;
            
            const contentWrapper = document.createElement('div');
            contentWrapper.style.paddingLeft = '18px';

            data.args.forEach((argStr, idx) => {
                if (typeof argStr === 'object' && argStr.isObj) {
                    try { contentWrapper.appendChild(buildInteractiveTree(JSON.parse(argStr.data))); } 
                    catch(e) { contentWrapper.innerHTML += `<span>${String(argStr.data).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`; }
                } else {
                    contentWrapper.innerHTML += `<span>${String(argStr).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
                }
                if (idx < data.args.length - 1) contentWrapper.appendChild(document.createTextNode(' '));
            });

            entry.appendChild(contentWrapper);
            lpConsoleContent.appendChild(entry);
            if (lpConsolePanel.classList.contains('show') && state.autoScrollConsole) { lpConsoleContent.parentElement.scrollTop = lpConsoleContent.parentElement.scrollHeight; }
        } 
        else if (data.type === 'network-start') {
            state.networkEntries.set(data.reqId, {
                reqId: data.reqId, method: data.method, url: data.url, source: data.source,
                requestHeaders: data.requestHeaders || {}, requestBody: data.requestBody,
                startTime: data.startTime, status: 'pending'
            });
            renderNetworkPanel(state);
        }
        else if (data.type === 'network-end') {
            const entry = state.networkEntries.get(data.reqId);
            if (entry) {
                entry.status = 'done';
                entry.statusCode = data.status;
                entry.statusText = data.statusText;
                entry.ok = data.ok;
                entry.redirected = data.redirected;
                entry.duration = data.duration;
                entry.size = data.size;
                entry.responseHeaders = data.responseHeaders || {};
                entry.responseBody = data.responseBody;
                renderNetworkPanel(state);
            }
        }
        else if (data.type === 'network-error') {
            const entry = state.networkEntries.get(data.reqId);
            if (entry) {
                entry.status = 'error';
                entry.duration = data.duration;
                entry.errorMessage = data.error;
                renderNetworkPanel(state);
            }
        }
        else if (data.type === 'inspect-hover') {
            if (!state.inspectorEnabled) return;
            state.inspectorLocked = !!data.locked;
            state.inspectorData = data.data;
            renderInspectorPanel(state);
        }
        else if (data.type === 'inspect-unlocked') {
            state.inspectorLocked = false;
            renderInspectorPanel(state);
        }
        else if (data.type === 'inspect-clear') {
            state.inspectorLocked = false;
            state.inspectorData = null;
            renderInspectorPanel(state);
        }
        else if (data.type === 'navigate') {
            const targetPath = data.path;
            const files = await getAllWorkspaceFiles();
            if (currentWinId !== (localStorage.getItem('codemini_active_window') || 'win_default')) return;

            const pathMap = buildVirtualPathTree(files);
            
            const currentActiveFile = state.navHistory[state.currentNavIndex]?.file;
            if (!currentActiveFile) return;

            const resolvedAbsolutePath = resolveRelativePath(currentActiveFile.absolutePath, targetPath);
            const targetFile = pathMap[resolvedAbsolutePath];
            
            if (targetFile) {
                renderPreviewContent(targetFile, targetFile.content);
            } else {
                const entry = document.createElement('div');
                entry.className = `console-entry console-warn`;
                entry.innerHTML = `
                    <div style="display:flex; justify-content:space-between; width:100%; margin-bottom: 2px;">
                        <div style="display:flex; align-items:center; gap:5px;"><i class="ri-error-warning-line" style="color: var(--term-yellow); margin-top:1px;"></i> <span style="font-weight:600;">System</span></div>
                    </div>
                    <div style="padding-left: 18px;">404: File "${targetPath}" not found in current directory context.</div>
                `;
                lpConsoleContent.appendChild(entry);
            }
        }
        else if (data.type === 'storage-updated') {
            if (iframe && iframe.contentWindow && document.getElementById('lpStoragePanel').classList.contains('show')) {
                iframe.contentWindow.postMessage({ type: 'fetch-storage' }, '*');
            }
        }
        else if (data.type === 'storage-data') {
            const state = getPreviewState();
            state.lastStorageData = data;
            renderStoragePanel(state);
        }
        else if (data.type === 'idb-contents') {
            const panel = smIdbPending[data.reqId];
            if (panel) {
                delete smIdbPending[data.reqId];
                renderIdbContents(panel, data);
            }
        }
    });

    // --- Storage Manager: scoping + rendering ---

    // Determines which local file names are "related" to the actively previewing file:
    // the file itself, plus any local files it links to (script/link/img/etc that resolved
    // to a workspace file). External URLs and unresolved/missing links are never in-scope.
    function getRelatedFileNames(state) {
        const rep = state.lastResourceReport || { linked: [], currentFileName: null };
        const names = new Set();
        if (rep.currentFileName) names.add(rep.currentFileName);
        rep.linked.forEach(path => {
            const base = path.split('/').pop();
            if (base) names.add(base);
        });
        return names;
    }

    function isKeyInScope(originFile, relatedNames) {
        if (!originFile) return false;
        // origin may be a blob: URL (inline <script> in the previewed HTML itself) or a filename
        if (originFile.startsWith('blob:')) return true; // treated as part of the current file's own execution
        return relatedNames.has(originFile);
    }

    function escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // --- Network Monitor: rendering ---
    function formatBytes(n) {
        if (n === null || n === undefined) return '';
        if (n < 1024) return n + 'B';
        if (n < 1024 * 1024) return (n / 1024).toFixed(1) + 'KB';
        return (n / (1024 * 1024)).toFixed(1) + 'MB';
    }

    function statusClass(code) {
        if (!code) return '';
        if (code >= 200 && code < 300) return 's2';
        if (code >= 300 && code < 400) return 's3';
        return 's4';
    }

    function buildCurl(entry) {
        let cmd = `curl -X ${entry.method} '${entry.url}'`;
        Object.keys(entry.requestHeaders || {}).forEach(k => {
            cmd += ` \\\n  -H '${k}: ${String(entry.requestHeaders[k]).replace(/'/g, "'\\''")}'`;
        });
        if (entry.requestBody && typeof entry.requestBody === 'string' && !entry.requestBody.startsWith('[')) {
            cmd += ` \\\n  -d '${entry.requestBody.replace(/'/g, "'\\''")}'`;
        }
        return cmd;
    }

    // --- DOM Inspector: rendering ---
    function renderInspectorPanel(state) {
        const d = state.inspectorData;
        inspLockIndicator.textContent = state.inspectorLocked ? 'Locked' : 'Hover';
        inspLockIndicator.classList.toggle('locked', state.inspectorLocked);

        if (!d) {
            inspBreadcrumb.innerHTML = '';
            inspHeaderTitle.innerHTML = '';
            inspBody.innerHTML = '<div class="insp-empty">Hover an element in the preview to inspect it. Click to lock the selection.</div>';
            return;
        }

        // Header: tag#id.classes
        const idStr = d.id ? `<span class="insp-id">#${escapeHtml(d.id)}</span>` : '';
        const clsStr = d.classes ? `<span class="insp-classes">.${escapeHtml(d.classes.trim().split(/\s+/).join('.'))}</span>` : '';
        inspHeaderTitle.innerHTML = `<span class="insp-tag">${escapeHtml(d.tag)}</span>${idStr}${clsStr}`;

        // Breadcrumb of ancestors, deepest (current element) last
        let crumbHtml = '';
        (d.ancestors || []).forEach((a, idx) => {
            const isLast = idx === d.ancestors.length - 1;
            const label = a.tag + (a.id ? '#' + a.id : '') + (a.classes ? '.' + a.classes.trim().split(/\s+/)[0] : '');
            const stepsUp = d.ancestors.length - 1 - idx;
            crumbHtml += `<span class="insp-crumb${isLast ? ' insp-crumb-active' : ''}" data-steps-up="${stepsUp}">${escapeHtml(label)}</span>`;
            if (!isLast) crumbHtml += `<span class="insp-crumb-sep">›</span>`;
        });
        inspBreadcrumb.innerHTML = crumbHtml;
        // Keep the active (rightmost) crumb in view
        inspBreadcrumb.scrollLeft = inspBreadcrumb.scrollWidth;

        renderInspectorTabContent(state);
    }

    function renderInspectorTabContent(state) {
        const d = state.inspectorData;
        inspTabs.querySelectorAll('.insp-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === state.inspectorTab));
        if (!d) { inspBody.innerHTML = ''; return; }

        // Don't yank focus from the style search box mid-keystroke. This mainly matters in unlocked
        // (hover) mode, where a stray mouseover back onto the iframe re-renders on every pixel of
        // movement; in locked mode rebuilds only happen on explicit breadcrumb clicks, which is fine.
        const activeSearch = document.getElementById('inspStyleSearch');
        if (activeSearch && document.activeElement === activeSearch && !state.inspectorLocked) {
            return;
        }

        if (state.inspectorTab === 'boxmodel') {
            const b = d.box;
            inspBody.innerHTML = `
                <div class="insp-boxmodel">
                    <div class="insp-box-margin">
                        <span class="insp-box-tag">margin</span>
                        <span class="insp-box-label lbl-top">${b.marginTop}</span>
                        <span class="insp-box-label lbl-right">${b.marginRight}</span>
                        <span class="insp-box-label lbl-bottom">${b.marginBottom}</span>
                        <span class="insp-box-label lbl-left">${b.marginLeft}</span>
                        <div class="insp-box-border">
                            <span class="insp-box-tag">border</span>
                            <span class="insp-box-label lbl-top">${b.borderTop}</span>
                            <span class="insp-box-label lbl-right">${b.borderRight}</span>
                            <span class="insp-box-label lbl-bottom">${b.borderBottom}</span>
                            <span class="insp-box-label lbl-left">${b.borderLeft}</span>
                            <div class="insp-box-padding">
                                <span class="insp-box-tag">padding</span>
                                <span class="insp-box-label lbl-top">${b.paddingTop}</span>
                                <span class="insp-box-label lbl-right">${b.paddingRight}</span>
                                <span class="insp-box-label lbl-bottom">${b.paddingBottom}</span>
                                <span class="insp-box-label lbl-left">${b.paddingLeft}</span>
                                <div class="insp-box-content">${d.rect.w} × ${d.rect.h}</div>
                            </div>
                        </div>
                    </div>
                    <div class="insp-dims">content-box: ${b.contentWidth} × ${b.contentHeight}</div>
                </div>`;
        } else if (state.inspectorTab === 'attributes') {
            const attrs = d.attributes || {};
            const keys = Object.keys(attrs);
            if (keys.length === 0) {
                inspBody.innerHTML = '<div class="insp-empty">No attributes</div>';
            } else {
                inspBody.innerHTML = keys.map(k => `<div class="insp-attr-row"><span class="insp-attr-name">${escapeHtml(k)}</span><span class="insp-attr-val">${escapeHtml(attrs[k])}</span></div>`).join('');
            }
        } else { // styles
            const filterText = (state.inspectorStyleFilter || '').toLowerCase();
            const styles = d.styles || {};
            const keys = Object.keys(styles).filter(k => !filterText || k.includes(filterText) || String(styles[k]).toLowerCase().includes(filterText));
            let rows = keys.length === 0
                ? '<div class="insp-empty">No matching styles</div>'
                : keys.map(k => `<div class="insp-style-row"><span class="insp-style-prop">${escapeHtml(k)}</span><span class="insp-style-val">${escapeHtml(styles[k])}</span></div>`).join('');
            inspBody.innerHTML = `<input type="text" class="insp-style-search" id="inspStyleSearch" placeholder="Filter styles..." value="${escapeHtml(state.inspectorStyleFilter || '')}">` + rows;
            const searchEl = document.getElementById('inspStyleSearch');
            if (searchEl) {
                searchEl.addEventListener('input', () => {
                    state.inspectorStyleFilter = searchEl.value;
                    renderInspectorTabContent(state);
                    // restore focus + cursor position since the input was rebuilt
                    const newSearchEl = document.getElementById('inspStyleSearch');
                    if (newSearchEl) { newSearchEl.focus(); newSearchEl.setSelectionRange(newSearchEl.value.length, newSearchEl.value.length); }
                });
            }
        }
    }

    inspTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.insp-tab');
        if (!tab) return;
        const state = getPreviewState();
        state.inspectorTab = tab.dataset.tab;
        renderInspectorTabContent(state);
    });

    inspBreadcrumb.addEventListener('click', (e) => {
        const crumb = e.target.closest('.insp-crumb');
        if (!crumb || crumb.classList.contains('insp-crumb-active')) return;
        const state = getPreviewState();
        if (!state.inspectorLocked) return; // breadcrumb navigation only makes sense once locked
        const stepsUp = parseInt(crumb.dataset.stepsUp, 10) || 0;
        const iframe = document.getElementById('lpIframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'inspect-select-ancestor', stepsUp }, '*');
        }
    });

    inspCopyHtml.addEventListener('click', () => {
        const state = getPreviewState();
        const d = state.inspectorData;
        if (d && navigator.clipboard) navigator.clipboard.writeText(d.outerHtml || '').catch(() => {});
    });
    inspCopySelector.addEventListener('click', () => {
        const state = getPreviewState();
        const d = state.inspectorData;
        if (d && navigator.clipboard) navigator.clipboard.writeText(d.selector || '').catch(() => {});
    });
    inspCopyStyles.addEventListener('click', () => {
        const state = getPreviewState();
        const d = state.inspectorData;
        if (d && navigator.clipboard) navigator.clipboard.writeText(JSON.stringify(d.styles || {}, null, 2)).catch(() => {});
    });

    function renderNetworkPanel(state) {
        // Preserve an in-progress detail expansion / scroll position across live rebuilds
        const savedScrollTop = lpNetworkContent.scrollTop;

        // Sync toolbar UI to state
        netFilters.querySelectorAll('.net-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === state.networkFilter);
        });
        if (netSearchInput.value !== state.networkSearch) netSearchInput.value = state.networkSearch || '';
        lpAutoClearNetwork.classList.toggle('active-state', state.networkAutoClear);
        lpAutoClearNetwork.title = 'Auto-clear on navigation/reload: ' + (state.networkAutoClear ? 'ON' : 'OFF');

        const filterText = (state.networkSearch || '').toLowerCase();
        const all = Array.from(state.networkEntries.values());
        const filtered = all.filter(e => {
            if (state.networkFilter === 'fetch' && e.source !== 'fetch') return false;
            if (state.networkFilter === 'xhr' && e.source !== 'xhr') return false;
            if (state.networkFilter === 'error' && !(e.status === 'error' || (e.status === 'done' && !e.ok))) return false;
            if (filterText && !e.url.toLowerCase().includes(filterText) && !e.method.toLowerCase().includes(filterText)) return false;
            return true;
        }).reverse(); // newest first

        const errorCount = all.filter(e => e.status === 'error' || (e.status === 'done' && !e.ok)).length;
        netCountBadge.textContent = all.length + (errorCount > 0 ? ` (${errorCount} failed)` : '');
        netCountBadge.classList.toggle('has-errors', errorCount > 0);

        if (filtered.length === 0) {
            lpNetworkContent.innerHTML = `<div class="net-empty-state">${all.length === 0 ? 'No requests captured yet' : 'No matches'}</div>`;
            return;
        }

        let html = '';
        filtered.forEach(e => {
            const dotClass = e.status === 'pending' ? 'pending' : (e.status === 'error' ? 'error' : (statusClass(e.statusCode) === 's3' ? 'redirect' : (e.ok ? 'success' : 'error')));
            const statusLabel = e.status === 'pending' ? '...' : (e.status === 'error' ? 'ERR' : e.statusCode);
            const durationLabel = e.duration !== undefined ? e.duration + 'ms' : '';
            const sizeLabel = e.size !== undefined && e.size !== null ? formatBytes(e.size) : '';
            const isExpanded = state.networkExpandedIds.has(e.reqId);

            html += `<div class="net-req${isExpanded ? ' net-expanded' : ''}" data-req-id="${escapeHtml(e.reqId)}">
                <div class="net-req-row" onclick="window.toggleNetworkExpand('${escapeHtml(e.reqId)}')">
                    <i class="ri-arrow-right-s-line net-caret"></i>
                    <div class="net-status-dot ${dotClass}"></div>
                    <div class="net-method">${escapeHtml(e.method)}</div>
                    <div class="net-status-code ${statusClass(e.statusCode)}">${statusLabel}</div>
                    <div class="net-url" title="${escapeHtml(e.url)}">${escapeHtml(e.url)}</div>
                    <div class="net-meta">
                        <span>${durationLabel}</span>
                        <span>${sizeLabel}</span>
                        <span class="net-source">${e.source}</span>
                    </div>
                </div>
                <div class="net-detail" id="net-detail-${escapeHtml(e.reqId)}"></div>
            </div>`;
        });

        lpNetworkContent.innerHTML = html;
        lpNetworkContent.scrollTop = savedScrollTop;

        // Rebuild detail content for any rows the user had expanded (fresh DOM each render)
        state.networkExpandedIds.forEach(reqId => {
            const entry = state.networkEntries.get(reqId);
            const detailEl = document.getElementById('net-detail-' + reqId);
            if (entry && detailEl) renderNetworkDetail(detailEl, entry);
        });
    }

    function renderNetworkDetail(detailEl, entry) {
        function kvBlock(title, obj) {
            const keys = Object.keys(obj || {});
            if (keys.length === 0) return `<div class="net-detail-section"><div class="net-detail-title">${title}</div><div class="net-empty-detail">None</div></div>`;
            let rows = keys.map(k => `<div class="net-kv"><span class="net-kv-key">${escapeHtml(k)}:</span><span class="net-kv-val">${escapeHtml(obj[k])}</span></div>`).join('');
            return `<div class="net-detail-section"><div class="net-detail-title">${title}</div>${rows}</div>`;
        }
        function bodyBlock(title, body) {
            if (body === null || body === undefined || body === '') return `<div class="net-detail-section"><div class="net-detail-title">${title}</div><div class="net-empty-detail">Empty</div></div>`;
            let display = body;
            try { display = JSON.stringify(JSON.parse(body), null, 2); } catch(e) {}
            return `<div class="net-detail-section"><div class="net-detail-title">${title}</div><pre class="net-body-pre">${escapeHtml(display)}</pre></div>`;
        }

        let html = `<div class="net-detail-toolbar">
            <i class="ri-file-copy-line" onclick="window.copyNetworkCurl('${escapeHtml(entry.reqId)}')" title="Copy as cURL"></i>
        </div>`;

        if (entry.status === 'error') {
            html += `<div class="net-detail-section"><div class="net-detail-title">Error</div><div class="net-empty-detail">${escapeHtml(entry.errorMessage || 'Request failed')}</div></div>`;
        }
        html += kvBlock('Request Headers', entry.requestHeaders);
        html += bodyBlock('Request Body', entry.requestBody);
        if (entry.status === 'done') {
            html += kvBlock('Response Headers', entry.responseHeaders);
            html += bodyBlock('Response Body', entry.responseBody);
        }
        detailEl.innerHTML = html;
    }

    window.toggleNetworkExpand = function(reqId) {
        const state = getPreviewState();
        if (state.networkExpandedIds.has(reqId)) {
            state.networkExpandedIds.delete(reqId);
        } else {
            state.networkExpandedIds.add(reqId);
        }
        renderNetworkPanel(state);
    };

    window.copyNetworkCurl = function(reqId) {
        const state = getPreviewState();
        const entry = state.networkEntries.get(reqId);
        if (!entry) return;
        const curl = buildCurl(entry);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(curl).catch(() => {});
        }
    };

    netFilters.addEventListener('click', (e) => {
        const btn = e.target.closest('.net-filter-btn');
        if (!btn) return;
        const state = getPreviewState();
        state.networkFilter = btn.dataset.filter;
        renderNetworkPanel(state);
    });

    let netSearchDebounce = null;
    netSearchInput.addEventListener('input', () => {
        clearTimeout(netSearchDebounce);
        netSearchDebounce = setTimeout(() => {
            const state = getPreviewState();
            state.networkSearch = netSearchInput.value;
            renderNetworkPanel(state);
        }, 120);
    });

    lpAutoClearNetwork.addEventListener('click', () => {
        const state = getPreviewState();
        state.networkAutoClear = !state.networkAutoClear;
        renderNetworkPanel(state);
    });

    function renderStoragePanel(state) {
        const data = state.lastStorageData;
        if (!data) return;

        // Don't blow away an in-progress inline edit if a live update arrives mid-keystroke
        // (e.g. the previewed app writes to storage in the background while the user is
        // renaming/editing an unrelated key). Defer the rebuild until the edit is committed.
        const activeEdit = lpStoragePanelBody.querySelector('.sm-edit-input');
        if (activeEdit && document.activeElement === activeEdit) {
            state._storagePanelRenderPending = true;
            return;
        }
        state._storagePanelRenderPending = false;

        // Preserve scroll position across rebuilds -- live updates can arrive while the user
        // is scrolled deep into a long key/record list, and a full innerHTML rebuild resets scroll.
        const savedScrollTop = lpStoragePanel.scrollTop;

        const scope = state.storageScope || 'file';
        const filterText = (state.storageFilter || '').toLowerCase();
        const origins = data.origins || {};
        const relatedNames = getRelatedFileNames(state);

        // Sync toolbar UI to state
        smScopeToggle.querySelectorAll('.sm-scope-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.scope === scope);
        });
        if (smSearchInput.value !== state.storageFilter) smSearchInput.value = state.storageFilter || '';

        function filterEntries(items, typeKey) {
            // items: {key: value}. Returns {key, value, origin, inScope}[] respecting scope + text filter
            return Object.keys(items).map(k => {
                const origin = origins[typeKey + ':' + k] || null;
                return { key: k, value: items[k], origin, inScope: scope === 'all' || isKeyInScope(origin, relatedNames) };
            }).filter(entry => {
                if (!entry.inScope) return false;
                if (filterText && !entry.key.toLowerCase().includes(filterText) && !String(entry.value).toLowerCase().includes(filterText)) return false;
                return true;
            });
        }

        function filterDbs(items) {
            return items.map(name => {
                const origin = origins['idb:' + name] || null;
                return { key: name, origin, inScope: scope === 'all' || isKeyInScope(origin, relatedNames) };
            }).filter(entry => {
                if (!entry.inScope) return false;
                if (filterText && !entry.key.toLowerCase().includes(filterText)) return false;
                return true;
            });
        }

        const lsEntries = filterEntries(data.ls, 'ls');
        const ssEntries = filterEntries(data.ss, 'ss');
        const idbEntries = filterDbs(data.idbs);

        let html = '';

        function originTag(origin) {
            if (!origin) return '';
            const label = origin.startsWith('blob:') ? 'inline' : origin;
            const selfCls = relatedNames.has(origin) || origin.startsWith('blob:') ? ' sm-origin-self' : '';
            return `<span class="sm-origin-tag${selfCls}" title="Written by ${escapeHtml(label)}">${escapeHtml(label)}</span>`;
        }

        function buildSection(title, entries, typeKey, isDbList) {
            const keysForClear = entries.map(e => e.key);
            html += `<div class="res-group-title"><span>${title}</span><span class="rg-count">${entries.length}</span>`;
            if (entries.length > 0) {
                const onlyKeysAttr = scope === 'file' ? ` data-only-keys='${escapeHtml(JSON.stringify(keysForClear))}'` : '';
                const clearLabel = scope === 'file' ? 'this file\u2019s' : 'all';
                html += `<span class="rg-actions"><i class="ri-delete-bin-line" style="cursor:pointer; color:var(--color-danger); font-size:14px;" onclick="window.clearAllStorage('${typeKey}', this)" title="Clear ${clearLabel} ${title}"${onlyKeysAttr}></i></span>`;
            }
            html += `</div>`;

            if (entries.length === 0) {
                html += `<div class="sm-empty-state">${filterText ? 'No matches' : (scope === 'file' ? 'No keys attributed to this file' : 'Empty')}</div>`;
                return;
            }

            if (isDbList) {
                entries.forEach(e => {
                    const expandId = 'idb:' + e.key;
                    html += `<div class="res-item sm-item expandable" data-db-name="${escapeHtml(e.key)}" data-expand-id="${escapeHtml(expandId)}" onclick="window.toggleIdbExpand(this, event)">
                        <div class="sm-key-main"><i class="ri-arrow-right-s-line sm-caret"></i><i class="ri-database-2-line" style="color:var(--icon-gray);"></i><span class="sm-key-name">${escapeHtml(e.key)}</span>${originTag(e.origin)}</div>
                        <div class="sm-key-actions">
                            <i class="ri-delete-bin-line" onclick="event.stopPropagation(); window.manageStorage('delete', 'idb', '${escapeHtml(e.key)}')" title="Delete Database" style="cursor:pointer; color:var(--color-danger);"></i>
                        </div>
                    </div>
                    <div class="sm-expand-panel"></div>`;
                });
            } else {
                entries.forEach(e => {
                    const valStr = String(e.value);
                    const preview = valStr.length > 22 ? escapeHtml(valStr.substring(0, 22)) + '&hellip;' : escapeHtml(valStr);
                    const expandId = typeKey + ':' + e.key;
                    html += `<div class="res-item sm-item expandable" data-key="${escapeHtml(e.key)}" data-type="${typeKey}" data-expand-id="${escapeHtml(expandId)}" onclick="window.toggleValueExpand(this, event)">
                        <div class="sm-key-main">
                            <i class="ri-arrow-right-s-line sm-caret"></i>
                            <i class="ri-key-2-line" style="color:var(--icon-gray);"></i>
                            <span class="sm-key-name">${escapeHtml(e.key)}</span> = <span class="sm-key-val">${preview}</span>
                            ${originTag(e.origin)}
                        </div>
                        <div class="sm-key-actions">
                            <i class="ri-file-copy-line" onclick="event.stopPropagation(); window.copyStorageValue(this, '${escapeHtml(e.key)}')" title="Copy Value" style="cursor:pointer; color:var(--icon-gray);"></i>
                            <i class="ri-pencil-line" onclick="event.stopPropagation(); window.editStorageValue(this)" title="Edit Value" style="cursor:pointer; color:var(--accent-blue);"></i>
                            <i class="ri-price-tag-3-line" onclick="event.stopPropagation(); window.manageStorage('rename', '${typeKey}', '${escapeHtml(e.key)}')" title="Rename Key" style="cursor:pointer; color:var(--accent-blue);"></i>
                            <i class="ri-delete-bin-line" onclick="event.stopPropagation(); window.manageStorage('delete', '${typeKey}', '${escapeHtml(e.key)}')" title="Delete Key" style="cursor:pointer; color:var(--color-danger);"></i>
                        </div>
                    </div>
                    <div class="sm-expand-panel"></div>`;
                });
            }
        }

        buildSection('Local Storage', lsEntries, 'ls', false);
        buildSection('Session Storage', ssEntries, 'ss', false);
        buildSection('IndexedDB', idbEntries, 'idb', true);

        lpStoragePanelBody.innerHTML = html;
        // stash raw entry values for edit/copy without re-escaping headaches
        lpStoragePanelBody.querySelectorAll('.sm-item[data-key]').forEach(el => {
            const k = el.dataset.key, t = el.dataset.type;
            const source = t === 'ls' ? data.ls : data.ss;
            el._smRawValue = source ? source[k] : '';
        });

        // Re-expand any rows the user had opened before this re-render (scope/search change,
        // or a storage-updated refresh triggered by an edit/delete elsewhere in the panel).
        if (state.storageExpandedKeys.size > 0) {
            lpStoragePanelBody.querySelectorAll('.sm-item.expandable[data-expand-id]').forEach(rowEl => {
                if (!state.storageExpandedKeys.has(rowEl.dataset.expandId)) return;
                if (rowEl.dataset.dbName) window.toggleIdbExpand(rowEl, null);
                else window.toggleValueExpand(rowEl, null);
            });
        }

        lpStoragePanel.scrollTop = savedScrollTop;
    }

    smScopeToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('.sm-scope-btn');
        if (!btn) return;
        const state = getPreviewState();
        state.storageScope = btn.dataset.scope;
        renderStoragePanel(state);
    });

    let smSearchDebounce = null;
    smSearchInput.addEventListener('input', () => {
        clearTimeout(smSearchDebounce);
        smSearchDebounce = setTimeout(() => {
            const state = getPreviewState();
            state.storageFilter = smSearchInput.value;
            renderStoragePanel(state);
        }, 120);
    });

    smExportBtn.addEventListener('click', () => {
        const state = getPreviewState();
        const data = state.lastStorageData;
        if (!data) return;
        const scope = state.storageScope || 'file';
        const relatedNames = getRelatedFileNames(state);
        const origins = data.origins || {};
        const pick = (items, typeKey) => {
            const out = {};
            Object.keys(items).forEach(k => {
                const origin = origins[typeKey + ':' + k] || null;
                if (scope === 'all' || isKeyInScope(origin, relatedNames)) out[k] = items[k];
            });
            return out;
        };
        const exportPayload = {
            exportedAt: new Date().toISOString(),
            scope,
            file: (state.lastResourceReport && state.lastResourceReport.currentFileName) || null,
            localStorage: pick(data.ls, 'ls'),
            sessionStorage: pick(data.ss, 'ss')
        };
        const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `storage-export-${(exportPayload.file || 'preview').replace(/\.[^.]+$/, '')}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    smImportBtn.addEventListener('click', () => smImportInput.click());
    smImportInput.addEventListener('change', () => {
        const file = smImportInput.files && smImportInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(reader.result);
                const iframe = document.getElementById('lpIframe');
                if (!iframe || !iframe.contentWindow) return;
                if (parsed.localStorage) iframe.contentWindow.postMessage({ type: 'import-storage', sType: 'ls', entries: parsed.localStorage }, '*');
                if (parsed.sessionStorage) iframe.contentWindow.postMessage({ type: 'import-storage', sType: 'ss', entries: parsed.sessionStorage }, '*');
            } catch (e) {
                if (window.showToast) window.showToast('Invalid storage export file', 'error');
            }
            smImportInput.value = '';
        };
        reader.readAsText(file);
    });

    window.copyStorageValue = function(el, key) {
        const item = el.closest('.sm-item');
        const raw = item && item._smRawValue !== undefined ? item._smRawValue : '';
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(raw).then(() => {
                const icon = el;
                const original = icon.className;
                icon.className = 'ri-check-line';
                setTimeout(() => { icon.className = original; }, 900);
            }).catch(() => {});
        }
    };

    window.editStorageValue = function(el) {
        const item = el.closest('.sm-item');
        if (!item) return;
        const key = item.dataset.key, typeKey = item.dataset.type;
        const raw = item._smRawValue !== undefined ? item._smRawValue : '';
        const mainRow = item.querySelector('.sm-key-main');
        if (item.querySelector('.sm-edit-input')) return; // already editing

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'sm-edit-input';
        input.value = raw;
        mainRow.style.display = 'none';
        item.insertBefore(input, mainRow);
        input.focus();
        input.select();

        function commit() {
            const iframe = document.getElementById('lpIframe');
            if (iframe && iframe.contentWindow && input.value !== raw) {
                iframe.contentWindow.postMessage({ type: 'set-storage', sType: typeKey, key, value: input.value }, '*');
            } else {
                cleanup();
            }
        }
        function cleanup() {
            input.remove();
            mainRow.style.display = '';
            // If a live update arrived while this edit was open, apply the deferred render now.
            const state = getPreviewState();
            if (state._storagePanelRenderPending) renderStoragePanel(state);
        }
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') cleanup();
        });
        input.addEventListener('blur', commit);
    };

    // --- Expand-to-view-contents: localStorage/sessionStorage full value viewer ---
    window.toggleValueExpand = function(rowEl, evt) {
        if (evt && evt.target.closest('.sm-key-actions')) return; // action icon clicks handled separately
        const panel = rowEl.nextElementSibling;
        if (!panel || !panel.classList.contains('sm-expand-panel')) return;
        const wasExpanded = rowEl.classList.contains('sm-expanded');
        const state = getPreviewState();
        const expandId = rowEl.dataset.expandId;

        if (wasExpanded) {
            rowEl.classList.remove('sm-expanded');
            if (expandId) state.storageExpandedKeys.delete(expandId);
            return;
        }
        rowEl.classList.add('sm-expanded');
        if (expandId) state.storageExpandedKeys.add(expandId);
        if (panel.dataset.rendered === '1') return; // already built, just re-shown via CSS

        const raw = rowEl._smRawValue !== undefined ? rowEl._smRawValue : '';
        panel.innerHTML = '';
        const toolbar = document.createElement('div');
        toolbar.className = 'sm-expand-toolbar';
        const copyIcon = document.createElement('i');
        copyIcon.className = 'ri-file-copy-line';
        copyIcon.title = 'Copy Value';
        copyIcon.onclick = (e) => { e.stopPropagation(); window.copyStorageValue(copyIcon, rowEl.dataset.key); };
        toolbar.appendChild(copyIcon);
        panel.appendChild(toolbar);

        let parsed = null;
        try { parsed = JSON.parse(raw); } catch(e) { parsed = null; }

        if (parsed !== null && typeof parsed === 'object') {
            panel.appendChild(buildInteractiveTree(parsed));
        } else {
            const pre = document.createElement('pre');
            pre.className = 'sm-value-pre';
            pre.textContent = raw;
            panel.appendChild(pre);
        }
        panel.dataset.rendered = '1';
    };

    // --- Expand-to-view-contents: IndexedDB database -> object stores -> records ---
    let smIdbReqCounter = 0;
    const smIdbPending = {};
    window.toggleIdbExpand = function(rowEl, evt) {
        if (evt && evt.target.closest('.sm-key-actions')) return;
        const dbName = rowEl.dataset.dbName;
        const panel = rowEl.nextElementSibling;
        if (!panel || !panel.classList.contains('sm-expand-panel')) return;
        const wasExpanded = rowEl.classList.contains('sm-expanded');
        const state = getPreviewState();
        const expandId = rowEl.dataset.expandId;

        if (wasExpanded) {
            rowEl.classList.remove('sm-expanded');
            if (expandId) state.storageExpandedKeys.delete(expandId);
            return;
        }
        rowEl.classList.add('sm-expanded');
        if (expandId) state.storageExpandedKeys.add(expandId);
        if (panel.dataset.rendered === '1') return; // cached from a previous open this session

        panel.innerHTML = '<div class="sm-idb-loading">Reading database contents&hellip;</div>';
        const iframe = document.getElementById('lpIframe');
        if (!iframe || !iframe.contentWindow) return;

        const reqId = 'idbreq_' + (++smIdbReqCounter);
        smIdbPending[reqId] = panel;
        iframe.contentWindow.postMessage({ type: 'fetch-idb-contents', dbName, reqId }, '*');
    };

    function renderIdbContents(panel, payload) {
        panel.innerHTML = '';
        if (payload.error) {
            panel.innerHTML = `<div class="sm-idb-loading">${escapeHtml(payload.error)}</div>`;
            panel.dataset.rendered = '1';
            return;
        }
        if (!payload.stores || payload.stores.length === 0) {
            panel.innerHTML = `<div class="sm-idb-loading">No object stores</div>`;
            panel.dataset.rendered = '1';
            return;
        }
        payload.stores.forEach(store => {
            const storeEl = document.createElement('div');
            storeEl.className = 'sm-idb-store';

            const titleEl = document.createElement('div');
            titleEl.className = 'sm-idb-store-title';
            titleEl.innerHTML = `<i class="ri-arrow-right-s-line sm-caret"></i><i class="ri-table-line" style="color:var(--icon-gray);"></i><span class="sm-key-name">${escapeHtml(store.name)}</span><span class="rg-count">${store.count}</span>`;
            titleEl.addEventListener('click', () => storeEl.classList.toggle('sm-expanded'));
            storeEl.appendChild(titleEl);

            const recordsEl = document.createElement('div');
            recordsEl.className = 'sm-idb-records';

            if (store.error) {
                recordsEl.innerHTML = `<div class="sm-idb-loading">${escapeHtml(store.error)}</div>`;
            } else if (store.records.length === 0) {
                recordsEl.innerHTML = `<div class="sm-idb-loading">Empty store</div>`;
            } else {
                store.records.forEach(rec => {
                    const recEl = document.createElement('div');
                    recEl.className = 'sm-idb-record';
                    const keyEl = document.createElement('div');
                    keyEl.className = 'sm-idb-record-key';
                    keyEl.textContent = 'key: ' + rec.key;
                    recEl.appendChild(keyEl);
                    if (rec.value !== null && typeof rec.value === 'object') {
                        recEl.appendChild(buildInteractiveTree(rec.value));
                    } else {
                        const pre = document.createElement('pre');
                        pre.textContent = String(rec.value);
                        recEl.appendChild(pre);
                    }
                    recordsEl.appendChild(recEl);
                });
                if (store.truncated) {
                    const note = document.createElement('div');
                    note.className = 'sm-idb-loading';
                    note.textContent = `Showing first ${store.records.length} of ${store.count} records`;
                    recordsEl.appendChild(note);
                }
            }

            storeEl.appendChild(recordsEl);
            panel.appendChild(storeEl);
        });
        panel.dataset.rendered = '1';
    }

    const originalSave = window.autoSaveFile;
    if (originalSave) {
        window.autoSaveFile = function(fileId, newContent, tabEl) {
            const currentWinId = localStorage.getItem('codemini_active_window') || 'win_default';
            const state = getPreviewState();
            
            originalSave(fileId, newContent, tabEl);
            
            const previewContainer = document.getElementById('livePreviewContainer');
            if (!previewContainer || !previewContainer.classList.contains('show') || !state.autoReloadEnabled) return;

            const currentPreviewFile = state.navHistory[state.currentNavIndex]?.file;
            if (!currentPreviewFile) return;

            const isEntryFile = currentPreviewFile.id === fileId;
            const isPartOfGraph = !!state.activeObjectUrls[fileId];
            if (!isEntryFile && !isPartOfGraph) return; // unrelated to what's showing - nothing to refresh

            if (isEntryFile && currentPreviewFile.name.toLowerCase().endsWith('.css')) {
                // Directly previewing a .css file (the style-guide preview) - it has no
                // <link> tag to swap, just the one shared inline <style> tag to update.
                const iframe = document.getElementById('lpIframe');
                if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage({ type: 'inject-css', css: newContent }, '*');
                return;
            }

            const tx = db.transaction('filesystem', 'readonly');
            tx.objectStore('filesystem').get(fileId).onsuccess = (ev) => {
                if (currentWinId !== (localStorage.getItem('codemini_active_window') || 'win_default')) return;
                const savedFile = ev.target.result;
                const savedIsCss = savedFile && savedFile.name.toLowerCase().endsWith('.css');

                if (!isEntryFile && savedIsCss && state.activeObjectUrls[fileId]) {
                    // A stylesheet the preview links to - directly via <link>, or via a
                    // JS-side `import './x.css'` - changed. Point its existing <link> at
                    // a fresh blob instead of reloading the whole page.
                    const oldUrl = state.activeObjectUrls[fileId];
                    const blob = new Blob([newContent], { type: 'text/css' });
                    const newUrl = URL.createObjectURL(blob);
                    state.activeObjectUrls[fileId] = newUrl;
                    const iframe = document.getElementById('lpIframe');
                    if (iframe && iframe.contentWindow) {
                        iframe.contentWindow.postMessage({ type: 'swap-stylesheet', oldUrl, newUrl }, '*');
                    }
                    setTimeout(() => URL.revokeObjectURL(oldUrl), 2000); // grace period for the swap to land
                    return;
                }

                // Anything else (the entry file itself, or a JS/TS/JSX/other dependency)
                // still needs a full re-render - CSS is the one thing that can hot-swap
                // without it (see the Resources panel for why JS/TS/JSX can't yet).
                if (isEntryFile) {
                    const dbFile = savedFile || currentPreviewFile;
                    const freshContent = getEditorContentByFileId(dbFile.id) ?? dbFile.content;
                    renderPreviewContent(dbFile, freshContent, true);
                } else {
                    const entryTx = db.transaction('filesystem', 'readonly');
                    entryTx.objectStore('filesystem').get(currentPreviewFile.id).onsuccess = (ev2) => {
                        if (currentWinId !== (localStorage.getItem('codemini_active_window') || 'win_default')) return;
                        const dbFile = ev2.target.result || currentPreviewFile;
                        const freshContent = getEditorContentByFileId(dbFile.id) ?? dbFile.content;
                        renderPreviewContent(dbFile, freshContent, true);
                    };
                }
            };
        };
    }

})();