// ==========================================
// settings-profile.js
// ==========================================

// --- Profile & Settings Functionality ---

window.appSettings = {};

// Shared theme registry - every dark/light and variant check in the app
// (Monaco theme, notebook editors, applyTheme itself) should go through
// window.isThemeDark() / window.getThemeVariant() instead of comparing
// colorTheme strings directly, so adding a theme is a one-entry change here.
window.THEME_REGISTRY = {
  'CodeMini Light':      { dark: false, variant: 'base' },
  'CodeMini Light +':    { dark: false, variant: 'plus' },
  'CodeMini Dark':       { dark: true,  variant: 'base' },
  'CodeMini Dark +':     { dark: true,  variant: 'plus' }
};
function _resolveTheme() {
  const t = window.appSettings && window.appSettings.colorTheme;
  return window.THEME_REGISTRY[t] || window.THEME_REGISTRY['CodeMini Light'];
}
window.isThemeDark = function() {
  if (window.isThemePackActive()) return window.THEME_PACK_REGISTRY[window.appSettings.themePack].dark;
  return _resolveTheme().dark;
};
window.getThemeVariant = function() {
  if (window.isThemePackActive()) return window.THEME_PACK_REGISTRY[window.appSettings.themePack].variant;
  return _resolveTheme().variant;
};
window.isThemeVariantPlus = function() { return window.getThemeVariant() === 'plus'; };

// Theme Packs are a separate, more sweeping layer than Color Theme: when one
// is active it OVERRIDES/LOCKS the Color Theme choice entirely (border
// radius, colors, backgrounds, inactive-item styling, everything) rather
// than layering on top of it - see applyTheme() and the Theme Pack select
// wiring below. 'None' means no pack is active and Color Theme applies normally.
window.THEME_PACK_REGISTRY = {
  'None': null,
  'CodeMini Premium': { dark: true, variant: 'premium' },
  'CodeMini Premium Light': { dark: false, variant: 'premium' }
};
window.isThemePackActive = function() {
  const pack = window.appSettings && window.appSettings.themePack;
  return !!(pack && pack !== 'None' && window.THEME_PACK_REGISTRY[pack]);
};

window.reloadSettings = function(winId = null, isProfile = false) {
  if (!winId) {
    winId = localStorage.getItem('codemini_active_window') || 'win_default';
    const windowsData = JSON.parse(localStorage.getItem('codemini_windows')) || [{ id: 'win_default', profile: false }];
    const activeWin = windowsData.find(w => w.id === winId) || windowsData[0];
    isProfile = activeWin.profile;
  }

  const getPrefixedKey = (baseKey) => {
      // Global Profile Sync forces new isolated profiles to inherit settings from the Native window
      if (baseKey === 'syncProfileSettings') return 'codemini_syncProfileSettings';
      const syncProfiles = localStorage.getItem('codemini_syncProfileSettings') === 'true';
      return (isProfile && !syncProfiles) ? `codemini_${winId}_${baseKey}` : `codemini_${baseKey}`;
  };

  window.appSettings = {
    // New General Settings
    explorerDefaultView: localStorage.getItem(getPrefixedKey('explorerDefaultView')) || 'List View',
    treeViewIndent: parseInt(localStorage.getItem(getPrefixedKey('treeViewIndent'))) || 15,
    profileAccentTint: localStorage.getItem(getPrefixedKey('profileAccentTint')) !== 'false',
    syncProfileSettings: localStorage.getItem('codemini_syncProfileSettings') === 'true',
    confirmBeforeExit: localStorage.getItem(getPrefixedKey('confirmBeforeExit')) === 'true',
    showBreadcrumbs: localStorage.getItem(getPrefixedKey('showBreadcrumbs')) !== 'false',
    compactExplorer: localStorage.getItem(getPrefixedKey('compactExplorer')) === 'true',

    // New Application Settings
    performanceMode: localStorage.getItem(getPrefixedKey('performanceMode')) === 'true',
    clearTrashOnExit: localStorage.getItem(getPrefixedKey('clearTrashOnExit')) === 'true',

    // Existing Settings
    autoSave: localStorage.getItem(getPrefixedKey('autoSave')) || 'After Delay',
    autoSaveDelay: parseInt(localStorage.getItem(getPrefixedKey('autoSaveDelay'))) || 1000,
    formatOnSave: localStorage.getItem(getPrefixedKey('formatOnSave')) === 'true',
    restoreSession: localStorage.getItem(getPrefixedKey('restoreSession')) !== 'false',
    enableTrashBin: localStorage.getItem(getPrefixedKey('enableTrashBin')) !== 'false',

    autoCheckUpdates: localStorage.getItem(getPrefixedKey('autoCheckUpdates')) !== 'false',

    maxMemory: parseInt(localStorage.getItem(getPrefixedKey('maxMemory'))) || 1024,

    fontSize: parseInt(localStorage.getItem(getPrefixedKey('fontSize'))) || 13,
    fontFamily: localStorage.getItem(getPrefixedKey('fontFamily')) || "'Fira Code', monospace",
    fontWeight: localStorage.getItem(getPrefixedKey('fontWeight')) || 'normal',
    lineHeight: parseInt(localStorage.getItem(getPrefixedKey('lineHeight'))) || 21,
    letterSpacing: parseFloat(localStorage.getItem(getPrefixedKey('letterSpacing'))) || 0.3,
    fontLigatures: localStorage.getItem(getPrefixedKey('fontLigatures')) !== 'false',

    tabSize: parseInt(localStorage.getItem(getPrefixedKey('tabSize'))) || 4,
    insertSpaces: localStorage.getItem(getPrefixedKey('insertSpaces')) !== 'false',
    wordWrap: localStorage.getItem(getPrefixedKey('wordWrap')) || 'off',

    minimap: localStorage.getItem(getPrefixedKey('minimap')) === 'true',
    lineNumbers: localStorage.getItem(getPrefixedKey('lineNumbers')) || 'on',
    renderWhitespace: localStorage.getItem(getPrefixedKey('renderWhitespace')) || 'none',
    bracketPairs: localStorage.getItem(getPrefixedKey('bracketPairs')) !== 'false',
    smoothScrolling: localStorage.getItem(getPrefixedKey('smoothScrolling')) !== 'false',
    cursorStyle: localStorage.getItem(getPrefixedKey('cursorStyle')) || 'line',
    cursorBlinking: localStorage.getItem(getPrefixedKey('cursorBlinking')) || 'blink',
    
    mouseWheelZoom: localStorage.getItem(getPrefixedKey('mouseWheelZoom')) === 'true',
    editorFolding: localStorage.getItem(getPrefixedKey('editorFolding')) !== 'false',
    renderLineHighlight: localStorage.getItem(getPrefixedKey('renderLineHighlight')) || 'line',
    matchBrackets: localStorage.getItem(getPrefixedKey('matchBrackets')) || 'always',
    cursorWidth: parseInt(localStorage.getItem(getPrefixedKey('cursorWidth'))) || 2,

    colorTheme: localStorage.getItem(getPrefixedKey('colorTheme')) || 'CodeMini Light',
    themePack: localStorage.getItem(getPrefixedKey('themePack')) || 'None',
    iconTheme: localStorage.getItem(getPrefixedKey('iconTheme')) || 'Remix Icons',
    accentColor: localStorage.getItem(getPrefixedKey('accentColor')) || '#3794ff',

    sidebarPosition: localStorage.getItem(getPrefixedKey('sidebarPosition')) || 'Left',
    activityBar: localStorage.getItem(getPrefixedKey('activityBar')) !== 'false',
    windowOpacity: parseInt(localStorage.getItem(getPrefixedKey('windowOpacity'))) || 100,

    nbAutoInstall: localStorage.getItem(getPrefixedKey('nbAutoInstall')) !== 'false',
    nbClearOnRestart: localStorage.getItem(getPrefixedKey('nbClearOnRestart')) === 'true',
    nbConfirmDelete: localStorage.getItem(getPrefixedKey('nbConfirmDelete')) !== 'false',
    nbPlotBackground: localStorage.getItem(getPrefixedKey('nbPlotBackground')) || 'White',
    nbCellFontSize: parseInt(localStorage.getItem(getPrefixedKey('nbCellFontSize'))) || 13,
    nbCellFontFamily: localStorage.getItem(getPrefixedKey('nbCellFontFamily')) || "'Fira Code', monospace",
    nbCellLineHeight: parseInt(localStorage.getItem(getPrefixedKey('nbCellLineHeight'))) || 21,
    nbCellLetterSpacing: parseFloat(localStorage.getItem(getPrefixedKey('nbCellLetterSpacing'))) || 0.3,
    nbCellLineNumbers: localStorage.getItem(getPrefixedKey('nbCellLineNumbers')) || 'off',
    nbCellWordWrap: localStorage.getItem(getPrefixedKey('nbCellWordWrap')) || 'on',
    nbCellFolding: localStorage.getItem(getPrefixedKey('nbCellFolding')) === 'true',
    nbCellMinimap: localStorage.getItem(getPrefixedKey('nbCellMinimap')) === 'true',
    nbCellRenderWhitespace: localStorage.getItem(getPrefixedKey('nbCellRenderWhitespace')) || 'none',
    nbCellBracketPairs: localStorage.getItem(getPrefixedKey('nbCellBracketPairs')) !== 'false',
    nbCellCursorStyle: localStorage.getItem(getPrefixedKey('nbCellCursorStyle')) || 'line',
    nbCellCursorBlinking: localStorage.getItem(getPrefixedKey('nbCellCursorBlinking')) || 'expand',
    nbCellSmoothScrolling: localStorage.getItem(getPrefixedKey('nbCellSmoothScrolling')) !== 'false',

    consoleAutoClear: localStorage.getItem(getPrefixedKey('consoleAutoClear')) === 'true',
    consoleShowTimestamps: localStorage.getItem(getPrefixedKey('consoleShowTimestamps')) === 'true',
    consoleAutoInstall: localStorage.getItem(getPrefixedKey('consoleAutoInstall')) !== 'false',
    consoleMaxHistory: parseInt(localStorage.getItem(getPrefixedKey('consoleMaxHistory'))) || 50,
    consoleFontSize: parseInt(localStorage.getItem(getPrefixedKey('consoleFontSize'))) || 14,
    consoleFontFamily: localStorage.getItem(getPrefixedKey('consoleFontFamily')) || "var(--font-mono)",
    consoleLineHeight: parseInt(localStorage.getItem(getPrefixedKey('consoleLineHeight'))) || 21,
    consoleWordWrap: localStorage.getItem(getPrefixedKey('consoleWordWrap')) || 'on',

    termFontSize: parseInt(localStorage.getItem(getPrefixedKey('termFontSize'))) || 13,
    termFontFamily: localStorage.getItem(getPrefixedKey('termFontFamily')) || "'Fira Code', Consolas, monospace",
    termTextColor: localStorage.getItem(getPrefixedKey('termTextColor')) || "#d4d4d4",
    termPromptColor: localStorage.getItem(getPrefixedKey('termPromptColor')) || "#4caf50",
    termCmdColor: localStorage.getItem(getPrefixedKey('termCmdColor')) || "#ffffff",
    termHistorySize: parseInt(localStorage.getItem(getPrefixedKey('termHistorySize'))) || 100
  };

  if (typeof applyTheme === 'function') applyTheme();
  if (typeof syncUI === 'function') syncUI();
};

window.reloadSettings();

// Global Save Exposer for proper isolated architectural access
window.saveSetting = function(key, value) {
  window.appSettings[key] = value;
  const winId = typeof cellActiveWinId !== 'undefined' ? cellActiveWinId : (localStorage.getItem('codemini_active_window') || 'win_default');
  const activeWin = (typeof cellWindows !== 'undefined' ? cellWindows : JSON.parse(localStorage.getItem('codemini_windows'))).find(w => w.id === winId) || { profile: false };
  
  // Enforce global isolation override if sync is active - must mirror the exact
  // same rule reloadSettings' getPrefixedKey uses for reads, or a profile with
  // sync enabled writes to an orphaned per-profile key that never gets read
  // back (reads prefer the global key while sync is on), silently losing the change.
  const syncProfilesActive = localStorage.getItem('codemini_syncProfileSettings') === 'true';
  let prefixedKey = (activeWin.profile && !syncProfilesActive) ? `codemini_${winId}_${key}` : `codemini_${key}`;
  if (key === 'syncProfileSettings') prefixedKey = 'codemini_syncProfileSettings';

  localStorage.setItem(prefixedKey, value);

  if (['colorTheme', 'themePack', 'accentColor', 'windowOpacity', 'sidebarPosition', 'activityBar', 'profileAccentTint', 'performanceMode', 'showBreadcrumbs', 'compactExplorer'].includes(key)) {
      if (typeof window.applyTheme === 'function') window.applyTheme();
      // applyTheme() just recalculated whether a Theme Pack is active - the
      // Color Theme / Accent Color lock state in the Settings panel needs to
      // reflect that immediately, not just the next time Settings is reopened.
      if (typeof window.syncUI === 'function') window.syncUI();
  }
  
  if (key === 'explorerDefaultView') {
      if (typeof window.setExplorerTreeMode === 'function') {
          window.setExplorerTreeMode(value === 'Tree View', { skipPersistSetting: true });
      }
  }

  if (key === 'iconTheme' && typeof loadFilesFromDB === 'function') loadFilesFromDB();

  if (['fontSize', 'fontFamily', 'fontWeight', 'lineHeight', 'letterSpacing', 'fontLigatures', 'tabSize', 'insertSpaces', 'wordWrap', 'minimap', 'lineNumbers', 'renderWhitespace', 'bracketPairs', 'smoothScrolling', 'cursorStyle', 'cursorBlinking', 'colorTheme', 'themePack', 'mouseWheelZoom', 'editorFolding', 'renderLineHighlight', 'matchBrackets', 'cursorWidth'].includes(key)) {
    if (typeof window.updateMonacoGlobalSettings === 'function') window.updateMonacoGlobalSettings();
  }

  if (key.startsWith('nbCell') || key === 'colorTheme' || key === 'themePack') if (typeof window.updateNotebookMonacoSettings === 'function') window.updateNotebookMonacoSettings();
  if (key.startsWith('console')) if (typeof window.updateConsoleLiveSettings === 'function') window.updateConsoleLiveSettings();
  if (key.startsWith('term')) if (typeof window.updateTerminalLiveSettings === 'function') window.updateTerminalLiveSettings();
  
  if (key === 'insertSpaces' || key === 'tabSize') {
      if (typeof window.updateSpacesText === 'function') window.updateSpacesText();
  }
};

// Application-wide Exit Hook 
window.addEventListener('beforeunload', function (e) {
    if (window.appSettings && window.appSettings.clearTrashOnExit) {
        const winId = localStorage.getItem('codemini_active_window') || 'win_default';
        const activeWin = JSON.parse(localStorage.getItem('codemini_windows')).find(w => w.id === winId);
        if (activeWin && activeWin.db) {
            localStorage.removeItem(`codemini_recycle_bin_${activeWin.db}`);
        }
    }
    if (window.appSettings && window.appSettings.confirmBeforeExit) {
        e.preventDefault();
        e.returnValue = 'Are you sure you want to leave CodeMini? Unsaved changes may be lost.';
    }
});

document.addEventListener('DOMContentLoaded', () => {
  const profileIconItem = document.getElementById('profileIconItem');
  const settingsIconItem = document.getElementById('settingsIconItem');

  window.applyTheme = function() {
    const isDark = window.isThemeDark();
    const packActive = window.isThemePackActive();
    const packSlug = packActive ? window.appSettings.themePack.toLowerCase().replace(/\s+/g, '-') : 'none';
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme-variant', window.getThemeVariant());
    document.documentElement.setAttribute('data-theme-pack', packSlug);
    // Theme Packs own their full identity (including accent color) - don't let
    // the separate, independently-saved Accent Color setting override it.
    if (packActive) {
      document.documentElement.style.removeProperty('--accent-blue');
    } else {
      document.documentElement.style.setProperty('--accent-blue', window.appSettings.accentColor);
    }
    document.body.style.opacity = window.appSettings.windowOpacity / 100;

    const isProfile = typeof cellActiveWindow !== 'undefined' && cellActiveWindow.profile;
    const variant = window.getThemeVariant();
    
    // Profile Accent Tinting Logic (Fixed for Dark Mode)
    // Skipped entirely while a Theme Pack is active - Premium (and any future
    // pack) owns its own complete visual identity, and a flat blue tint on top
    // would fight with it the same way it used to fight with Dark+'s
    // deliberately distinct inactive-tab colors.
    if (isProfile && window.appSettings.profileAccentTint && !packActive) {
        if (isDark) {
            // Dark+ runs noticeably darker than base Dark - use a tint that's
            // still clearly blue-shifted but doesn't wash out against its
            // deeper background the way the base-Dark tint would.
            const tabsBarTint = variant === 'plus' ? '#141c2b' : '#1a2333';
            const tabInactiveTint = variant === 'plus' ? '#0f1622' : '#131b26';
            document.documentElement.style.setProperty('--bg-tabs-bar', tabsBarTint);
            document.documentElement.style.setProperty('--bg-tab-inactive', tabInactiveTint);
        } else {
            document.documentElement.style.setProperty('--bg-tabs-bar', 'rgba(55, 148, 255, 0.1)');
            document.documentElement.style.setProperty('--bg-tab-inactive', 'rgba(55, 148, 255, 0.05)');
        }
    } else {
        document.documentElement.style.removeProperty('--bg-tabs-bar');
        document.documentElement.style.removeProperty('--bg-tab-inactive');
    }

    // Performance Mode Logic
    if (window.appSettings.performanceMode) {
        document.body.classList.add('no-animations');
    } else {
        document.body.classList.remove('no-animations');
    }
    
    // Compact Explorer Logic
    if (window.appSettings.compactExplorer) {
        document.body.classList.add('compact-explorer');
    } else {
        document.body.classList.remove('compact-explorer');
    }
    
    // Show Breadcrumbs Logic
    const breadcrumbs = document.getElementById('fileBrowserPath');
    if (breadcrumbs) {
        breadcrumbs.style.display = window.appSettings.showBreadcrumbs ? 'flex' : 'none';
    }

    const appBody = document.querySelector('.app-body');
    if (appBody) {
      appBody.style.flexDirection = window.appSettings.sidebarPosition === 'Right' ? 'row-reverse' : 'row';
    }

    document.body.classList.toggle('hide-activity-bar', !window.appSettings.activityBar);

    window.updateMonacoGlobalSettings();
    window.updateNotebookMonacoSettings();
    window.updateConsoleLiveSettings();
    window.updateTerminalLiveSettings();
  }

  window.updateConsoleLiveSettings = function() {
    document.querySelectorAll('.console-container').forEach(container => {
      container.style.setProperty('--console-fs', window.appSettings.consoleFontSize + 'px');
      container.style.setProperty('--console-ff', window.appSettings.consoleFontFamily);
      container.style.setProperty('--console-lh', window.appSettings.consoleLineHeight + 'px');
      container.style.setProperty('--console-wrap', window.appSettings.consoleWordWrap === 'on' ? 'pre-wrap' : 'pre');
    });
  }

  window.updateTerminalLiveSettings = function() {
    document.documentElement.style.setProperty('--term-output-text', window.appSettings.termTextColor);
    document.documentElement.style.setProperty('--term-prompt-user', window.appSettings.termPromptColor);
    document.documentElement.style.setProperty('--term-cmd-text', window.appSettings.termCmdColor);

    document.querySelectorAll('[id^="term-"]').forEach(container => {
      container.style.fontSize = window.appSettings.termFontSize + 'px';
      container.style.fontFamily = window.appSettings.termFontFamily;
      const input = container.querySelector('.term-input');
      if (input) {
        input.style.fontSize = window.appSettings.termFontSize + 'px';
        input.style.fontFamily = window.appSettings.termFontFamily;
      }
    });
  }

  window.updateMonacoGlobalSettings = function() {
    if (!window.monaco) return;
    const isDark = window.isThemeDark();
    const theme = isDark ? 'vs-dark' : 'vs-light';

    const editorOptions = {
      fontSize: window.appSettings.fontSize,
      fontFamily: window.appSettings.fontFamily,
      fontWeight: window.appSettings.fontWeight,
      lineHeight: window.appSettings.lineHeight,
      letterSpacing: window.appSettings.letterSpacing,
      fontLigatures: window.appSettings.fontLigatures,
      tabSize: window.appSettings.tabSize,
      insertSpaces: window.appSettings.insertSpaces,
      wordWrap: window.appSettings.wordWrap,
      minimap: { enabled: window.appSettings.minimap },
      lineNumbers: window.appSettings.lineNumbers,
      renderWhitespace: window.appSettings.renderWhitespace,
      smoothScrolling: window.appSettings.smoothScrolling,
      cursorStyle: window.appSettings.cursorStyle,
      cursorBlinking: window.appSettings.cursorBlinking,
      
      mouseWheelZoom: window.appSettings.mouseWheelZoom,
      folding: window.appSettings.editorFolding,
      renderLineHighlight: window.appSettings.renderLineHighlight,
      matchBrackets: window.appSettings.matchBrackets,
      cursorWidth: window.appSettings.cursorWidth,
      
      bracketPairColorization: { enabled: window.appSettings.bracketPairs },
      guides: { bracketPairs: window.appSettings.bracketPairs },
      
      theme: theme
    };

    window.monaco.editor.getEditors().forEach(editor => {
      if (!Object.values(window.cellMonacoEditors || {}).includes(editor)) {
        editor.updateOptions(editorOptions);
      }
    });
  }

  window.updateNotebookMonacoSettings = function() {
    if (!window.monaco || !window.cellMonacoEditors) return;
    const isDark = window.isThemeDark();
    const theme = isDark ? 'vs-dark' : 'vs-light';

    const nbOptions = {
      fontSize: window.appSettings.nbCellFontSize,
      fontFamily: window.appSettings.nbCellFontFamily,
      lineHeight: window.appSettings.nbCellLineHeight,
      letterSpacing: window.appSettings.nbCellLetterSpacing,
      lineNumbers: window.appSettings.nbCellLineNumbers,
      wordWrap: window.appSettings.nbCellWordWrap,
      folding: window.appSettings.nbCellFolding,
      minimap: { enabled: window.appSettings.nbCellMinimap },
      renderWhitespace: window.appSettings.nbCellRenderWhitespace,
      bracketPairColorization: { enabled: window.appSettings.nbCellBracketPairs },
      guides: { bracketPairs: window.appSettings.nbCellBracketPairs },
      cursorStyle: window.appSettings.nbCellCursorStyle,
      cursorBlinking: window.appSettings.nbCellCursorBlinking,
      smoothScrolling: window.appSettings.nbCellSmoothScrolling,
      theme: theme
    };

    Object.values(window.cellMonacoEditors).forEach(editor => {
      editor.updateOptions(nbOptions);
      setTimeout(() => editor.layout(), 50);
    });
  }

  function resetAllSettings() {
    const winId = typeof cellActiveWinId !== 'undefined' ? cellActiveWinId : (localStorage.getItem('codemini_active_window') || 'win_default');
    const activeWin = (typeof cellWindows !== 'undefined' ? cellWindows : JSON.parse(localStorage.getItem('codemini_windows'))).find(w => w.id === winId) || { profile: false };
    const syncProfilesActive = localStorage.getItem('codemini_syncProfileSettings') === 'true';
    const isEffectivelyProfileScoped = activeWin.profile && !syncProfilesActive;
    const prefix = isEffectivelyProfileScoped ? `codemini_${winId}_` : `codemini_`;

    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (isEffectivelyProfileScoped) {
        if (key.startsWith(prefix) && key !== `codemini_member_since_${winId}`) {
          keysToRemove.push(key);
        }
      } else {
        if (key.startsWith('codemini_') &&
          !key.match(/^codemini_win_/) &&
          !key.match(/^codemini_(profile_states|windows|active_window|recently_closed|recycle_bin|ui_state|session|console|member_since)/)) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    Object.assign(window.appSettings, {
      explorerDefaultView: 'List View', treeViewIndent: 15, profileAccentTint: true, syncProfileSettings: false, confirmBeforeExit: false, showBreadcrumbs: true, compactExplorer: false, performanceMode: false, clearTrashOnExit: false,
      autoSave: 'After Delay', autoSaveDelay: 1000, formatOnSave: false, restoreSession: true, enableTrashBin: true, autoCheckUpdates: true, maxMemory: 1024, fontSize: 13, fontFamily: "'Fira Code', monospace", fontWeight: 'normal', lineHeight: 21, letterSpacing: 0.3, fontLigatures: true, tabSize: 4, insertSpaces: true, wordWrap: 'off', minimap: false, lineNumbers: 'on', renderWhitespace: 'none', bracketPairs: true, smoothScrolling: true, cursorStyle: 'line', cursorBlinking: 'blink', mouseWheelZoom: false, editorFolding: true, renderLineHighlight: 'line', matchBrackets: 'always', cursorWidth: 2, colorTheme: 'CodeMini Light', iconTheme: 'Remix Icons', accentColor: '#3794ff', sidebarPosition: 'Left', activityBar: true, windowOpacity: 100, nbAutoInstall: true, nbClearOnRestart: false, nbConfirmDelete: true, nbPlotBackground: 'White', nbCellFontSize: 13, nbCellFontFamily: "'Fira Code', monospace", nbCellLineHeight: 21, nbCellLetterSpacing: 0.3, nbCellLineNumbers: 'off', nbCellWordWrap: 'on', nbCellFolding: false, nbCellMinimap: false, nbCellRenderWhitespace: 'none', nbCellBracketPairs: true, nbCellCursorStyle: 'line', nbCellCursorBlinking: 'expand', nbCellSmoothScrolling: true, consoleAutoClear: false, consoleShowTimestamps: false, consoleAutoInstall: true, consoleMaxHistory: 50, consoleFontSize: 14, consoleFontFamily: "var(--font-mono)", consoleLineHeight: 21, consoleWordWrap: 'on', termFontSize: 13, termFontFamily: "'Fira Code', Consolas, monospace", termTextColor: "#d4d4d4", termPromptColor: "#4caf50", termCmdColor: "#ffffff", termHistorySize: 100
    });

    Object.keys(window.appSettings).forEach(key => {
      localStorage.setItem(`${prefix}${key}`, window.appSettings[key]);
    });

    window.applyTheme();
    window.syncUI();
  }

  window.syncUI = function() {
    const container = document.querySelector('.settings-container');
    if (!container) return;
    container.querySelectorAll('[data-setting]').forEach(input => {
      const val = window.appSettings[input.dataset.setting];
      if (input.type === 'checkbox') input.checked = val;
      else input.value = val;
    });

    // Lock Color Theme + Accent Color while a Theme Pack is active - the
    // pack overrides both entirely rather than layering on top, so leaving
    // them live would be misleading (they wouldn't visibly do anything).
    const packActive = typeof window.isThemePackActive === 'function' && window.isThemePackActive();
    const colorThemeSelect = container.querySelector('#colorThemeSelect');
    const colorThemeHint = container.querySelector('#colorThemeHint');
    if (colorThemeSelect) {
      colorThemeSelect.disabled = packActive;
      colorThemeSelect.style.opacity = packActive ? '0.5' : '';
      colorThemeSelect.style.cursor = packActive ? 'not-allowed' : '';
      if (colorThemeHint) {
        colorThemeHint.textContent = packActive
          ? `Controlled by the "${window.appSettings.themePack}" theme pack - set Theme Pack to None to choose a Color Theme`
          : 'Specifies the workbench color theme';
      }
    }
    const accentColorInput = container.querySelector('#accentColorInput');
    const accentColorHint = container.querySelector('#accentColorHint');
    if (accentColorInput) {
      accentColorInput.disabled = packActive;
      accentColorInput.style.opacity = packActive ? '0.5' : '';
      accentColorInput.style.cursor = packActive ? 'not-allowed' : '';
      if (accentColorHint) {
        accentColorHint.textContent = packActive
          ? `Controlled by the "${window.appSettings.themePack}" theme pack`
          : 'Controls primary highlight color';
      }
    }
  }

  window.applyTheme();

  // ==========================================
  // PROFILE HTML GENERATOR
  // ==========================================
  const getProfileHTML = () => {
    const winId = typeof cellActiveWinId !== 'undefined' ? cellActiveWinId : (localStorage.getItem('codemini_active_window') || 'win_default');
    let memberSinceDate = localStorage.getItem(`codemini_member_since_${winId}`);

    if (!memberSinceDate) {
      memberSinceDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
      localStorage.setItem(`codemini_member_since_${winId}`, memberSinceDate);
    }

    const isProfile = typeof cellActiveWindow !== 'undefined' && cellActiveWindow.profile;
    const profileName = typeof cellActiveWindow !== 'undefined' ? cellActiveWindow.name : 'User_Local';
    const badgeText = isProfile ? 'Isolated Profile' : 'Native Window';
    const badgeIcon = isProfile ? 'ri-shield-user-line' : 'ri-map-pin-2-line';

    const genId = typeof cellActiveWindow !== 'undefined' ? cellActiveWindow.id.split('_')[1] || '000' : '000';
    const displayUser = isProfile ? `profile_user_${genId}` : 'user_local';
    const displayEmail = isProfile ? `${displayUser}@codemini.local` : 'user@codemini.local';

    const currentSyncTime = new Date().toLocaleString('en-US', {
      hour12: true, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });

    return `
    <div class="profile-container">
      <div class="profile-fixed-header">
        <i class="ri-user-4-line"></i>
        <span>Profile</span>
      </div>

      <div class="profile-scroll-area">

        <div class="profile-hero-wrapper">
          <div class="profile-hero-section">
            <div class="profile-avatar-large"><i class="ri-user-line"></i></div>
            <div class="profile-title-block">
              <h2 class="profile-name">${profileName}</h2>
              <span class="profile-badge"><i class="${badgeIcon}"></i> ${badgeText}</span>
            </div>
          </div>
          <div class="profile-auth-buttons">
            <button class="primary" onclick="window.showCustomModal({title: 'Sign Up', text: 'Cloud synchronization and cloud accounts are coming in a future update.', submitText: 'Got it'}, () => { if(typeof closeGenModal === 'function') closeGenModal(); })"><i class="ri-user-add-line"></i> Sign up</button>
            <button onclick="window.showCustomModal({title: 'Log In', text: 'Log in and remote workspace access features are currently under active development.', submitText: 'Got it'}, () => { if(typeof closeGenModal === 'function') closeGenModal(); })"><i class="ri-login-box-line"></i> Log in</button>
          </div>
        </div>

        <div class="profile-content-area">
          <div class="profile-details-grid">
            <div class="profile-section-group">
              <h3 class="profile-section-title">Identity & Status</h3>
              <div class="profile-list">
                <div class="profile-list-item"><span>Active Profile:</span> <strong>${profileName}</strong></div>
                <div class="profile-list-item"><span>DB Target:</span> <strong>${typeof cellActiveWindow !== 'undefined' ? cellActiveWindow.db : 'Unknown'}</strong></div>
                <div class="profile-list-item"><span>Username:</span> <strong>${displayUser}</strong></div>
                <div class="profile-list-item"><span>E-Mail:</span> <strong>${displayEmail}</strong></div>
                <div class="profile-list-item"><span>Member Since:</span> <strong>${memberSinceDate}</strong></div>
                <div class="profile-list-item"><span>Last Sync:</span> <strong>${currentSyncTime} (Local)</strong></div>
              </div>
            </div>
            <div class="profile-section-group">
              <h3 class="profile-section-title">Workspace Statistics</h3>
              <div class="profile-list">
                <div class="profile-list-item"><span>Total Files:</span> <strong id="statFiles">0</strong></div>
                <div class="profile-list-item"><span>Total Folders:</span> <strong id="statFolders">0</strong></div>
                <div class="profile-list-item"><span>Total Workspaces:</span> <strong id="statWorkspaces">0</strong></div>
                <div class="profile-list-item"><span>Storage Used:</span> <strong id="statStorage">0 KB</strong></div>
                <div class="profile-list-item"><span>Workspace Health:</span> <strong id="statHealth">Good</strong></div>
                <div class="profile-list-item"><span>Max Terminals:</span> <strong id="statTerms">2</strong></div>
              </div>
            </div>
            <div class="profile-section-group">
              <h3 class="profile-section-title">System Information</h3>
              <div class="profile-list">
                <div class="profile-list-item"><span>App Version:</span> <strong>CodeMini v1.0.0</strong></div>
                <div class="profile-list-item"><span>Environment:</span> <strong>Browser / IndexedDB</strong></div>
                <div class="profile-list-item"><span>Primary Language:</span> <strong>JavaScript / Python</strong></div>
                <div class="profile-list-item"><span>Plugins:</span> <strong>Monaco, Pyodide, Markdown...</strong></div>
                <div class="profile-list-item"><span>Platform Arch:</span> <strong>${navigator.platform}</strong></div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
    `;
  };

  // ==========================================
  // PROFILE STATS ENGINE
  // ==========================================
  window.updateProfileStats = function() {
    const sf = document.getElementById('statFiles');
    const sfo = document.getElementById('statFolders');
    const sws = document.getElementById('statWorkspaces');
    const ss = document.getElementById('statStorage');
    const sh = document.getElementById('statHealth');

    if (!sf && !sfo && !sws && !ss && !sh) return;

    const dbName = (typeof cellActiveWindow !== 'undefined') ? cellActiveWindow.db : "CodeMiniDB";
    const req = indexedDB.open(dbName, 3);
    req.onsuccess = (e) => {
      const dbInstance = e.target.result;
      const tx = dbInstance.transaction('filesystem', 'readonly');
      tx.objectStore('filesystem').getAll().onsuccess = (ev) => {
        const files = ev.target.result || [];
        let fileCount = 0; let folderCount = 0; let workspaceCount = 0; let storageSize = 0;

        files.forEach(f => {
          if (f.type === 'file') fileCount++;
          else if (f.type === 'folder') folderCount++;
          else if (f.type === 'workspace') workspaceCount++;
          if (f.content) storageSize += new Blob([f.content]).size;
        });

        const sizeKB = (storageSize / 1024).toFixed(2);
        const sizeMB = (storageSize / (1024 * 1024)).toFixed(2);

        let maxMem = (window.appSettings && window.appSettings.maxMemory) ? parseInt(window.appSettings.maxMemory) : 1024;
        let health = "Good";
        let healthColor = "var(--term-green)";

        if (sizeMB > maxMem * 0.8) { health = "Warning"; healthColor = "var(--icon-yellow)"; }
        if (sizeMB >= maxMem) { health = "Critical"; healthColor = "var(--color-danger)"; }

        if (sf) sf.textContent = fileCount;
        if (sfo) sfo.textContent = folderCount;
        if (sws) sws.textContent = workspaceCount;
        if (ss) ss.textContent = sizeKB > 1024 ? sizeMB + ' MB' : sizeKB + ' KB';
        if (sh) { sh.textContent = health; sh.style.color = healthColor; }

        dbInstance.close();
      };
    };
  };

  // ==========================================
  // SETTINGS HTML GENERATOR
  // ==========================================

  const settingsTabs = [
    { id: 'general',     label: 'General',      icon: 'ri-equalizer-line' },
    { id: 'notebook',    label: 'Notebook',     icon: 'ri-book-2-line' },
    { id: 'console',     label: 'Console',      icon: 'ri-terminal-box-line' },
    { id: 'terminal',    label: 'Terminal',     icon: 'ri-terminal-window-line' },
    { id: 'editor',      label: 'Editor',       icon: 'ri-code-box-line' },
    { id: 'theme',       label: 'Theme',        icon: 'ri-paint-brush-line' },
    { id: 'keybinds',    label: 'Keybindings',  icon: 'ri-keyboard-line' },
    { id: 'application', label: 'Application',  icon: 'ri-window-fill' },
    { id: 'updates',     label: 'Updates',      icon: 'ri-refresh-line' },
    { id: 'about',       label: 'About',        icon: 'ri-information-line' }
  ];

  const settingsHTML = `
  <style>
  .settings-container.flex-col { display: flex; flex-direction: column; height: 100%; overflow: hidden; padding: 0; background-color: var(--bg-white); }
  .settings-fixed-header { display: flex; align-items: center; gap: 10px; padding: 0 12px; height: 44px; background: var(--bg-white); font-size: 14px; font-weight: 600; color: var(--text-main); flex-shrink: 0; position: sticky; top: 0; z-index: 20; }
  .settings-fixed-header i { font-size: 18px; color: var(--accent-blue); }
  .settings-search-bar { display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: var(--bg-white); border-bottom: 1px solid var(--border-color); flex-shrink: 0; }
  .settings-search-bar i { font-size: 15px; color: var(--text-muted); flex-shrink: 0; }
  .settings-search-bar input { flex: 1; border: 1px solid var(--border-color); border-radius: 4px; padding: 6px 10px; font-size: 13px; font-family: var(--font-main); background: var(--bg-panel); color: var(--text-main); outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
  .settings-search-bar input:focus { border-color: var(--accent-blue); box-shadow: 0 0 0 2px rgba(55,148,255,0.15); }
  .settings-search-clear { background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 16px; padding: 2px 4px; display: none; align-items: center; justify-content: center; border-radius: 3px; transition: color 0.2s; }
  .settings-search-clear.visible { display: flex; }
  .settings-search-clear:hover { color: var(--text-main); }
  .settings-body { display: flex; flex: 1; overflow: hidden; }
  .settings-sidebar { width: 185px; flex-shrink: 0; background: var(--bg-panel); border-right: 1px solid var(--border-color); overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; padding: 6px 0; }
  .settings-sidebar::-webkit-scrollbar { width: 3px; }
  .settings-sidebar::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 4px; }
  .settings-sidebar-item { display: flex; align-items: center; gap: 10px; padding: 9px 14px; cursor: pointer; font-size: 13px; font-weight: 500; color: var(--text-muted); border-left: 3px solid transparent; transition: all 0.15s; white-space: nowrap; user-select: none; }
  .settings-sidebar-item i { font-size: 16px; flex-shrink: 0; }
  .settings-sidebar-item:hover { background: var(--hover-blue); color: var(--text-main); }
  .settings-sidebar-item.active { background: var(--bg-white); color: var(--accent-blue); border-left: 3px solid var(--accent-blue); font-weight: 600; }
  .settings-content-area { flex: 1; overflow-y: auto; padding: 20px 30px; min-width: 0; }
  .settings-content-area::-webkit-scrollbar { width: 4px; }
  .settings-content-area::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 4px; }
  .settings-content-section { display: none; }
  .settings-content-section.active { display: block; animation: settingsFadeIn 0.2s ease; }
  .settings-container.search-active .settings-content-section { display: block !important; }
  .settings-container.search-active .settings-sidebar-item.active { background: transparent; color: var(--text-muted); border-left: 3px solid transparent; font-weight: 500; }
  .settings-item.search-hidden { display: none !important; }
  .settings-category-title.search-hidden { display: none !important; }
  .settings-content-section.search-section-empty { display: none !important; }
  .settings-content-section.search-hidden { display: none !important; }
  .settings-no-results { display: none; padding: 40px 20px; text-align: center; color: var(--text-muted); font-size: 13px; }
  .settings-no-results i { font-size: 36px; display: block; margin-bottom: 12px; color: var(--border-color); }
  .settings-no-results.visible { display: block; }

  @keyframes settingsFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

  .settings-tabs-bottom-mobile { display: none; border-top: 1px solid var(--border-color); background: var(--bg-panel); overflow-x: auto; flex-shrink: 0; padding: 5px 10px; gap: 4px; }
  .settings-tabs-bottom-mobile::-webkit-scrollbar { height: 3px; }
  .settings-tabs-bottom-mobile::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 4px; }

  @media (max-width: 768px) { .settings-sidebar { display: none; } .settings-tabs-bottom-mobile { display: flex; } .settings-content-area { padding: 15px; } .settings-container.search-active .settings-content-section { display: block !important; } }

  .update-item { border: 1px solid var(--border-color); border-radius: 6px; padding: 15px; margin-bottom: 15px; background: var(--bg-panel); transition: transform 0.2s, box-shadow 0.2s; }
  .update-item:hover { transform: translateY(-2px); box-shadow: 0 4px 12px var(--shadow-light); }
  .update-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; }
  .update-version { font-size: 16px; font-weight: bold; color: var(--accent-blue); display: flex; align-items: center; gap: 8px; }
  .update-badge { background: var(--accent-new); color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
  .update-date { font-size: 12px; color: var(--text-muted); }
  .update-desc { font-size: 13px; color: var(--text-main); margin-bottom: 10px; line-height: 1.5; }
  .update-features { margin: 0; padding-left: 20px; font-size: 13px; color: var(--text-main); line-height: 1.6; }
  .update-features li { margin-bottom: 4px; }
  .update-features li::marker { color: var(--accent-blue); }
  </style>

  <div class="settings-container flex-col">

    <div class="settings-fixed-header">
      <i class="ri-settings-6-line"></i>
      <span>Settings</span>
    </div>

    <div class="settings-search-bar">
      <i class="ri-search-line"></i>
      <input type="text" id="settingsSearchInput" placeholder="Search settings across all tabs..." autocomplete="off">
      <button class="settings-search-clear" id="settingsSearchClear" title="Clear search"><i class="ri-close-line"></i></button>
    </div>

    <div class="settings-body">

      <div class="settings-sidebar" id="settingsSidebar">
        <div class="settings-sidebar-item active" data-tab="general"><i class="ri-equalizer-line"></i> General</div>
        <div class="settings-sidebar-item" data-tab="notebook"><i class="ri-book-2-line"></i> Notebook</div>
        <div class="settings-sidebar-item" data-tab="console"><i class="ri-terminal-box-line"></i> Console</div>
        <div class="settings-sidebar-item" data-tab="terminal"><i class="ri-terminal-window-line"></i> Terminal</div>
        <div class="settings-sidebar-item" data-tab="editor"><i class="ri-code-box-line"></i> Editor</div>
        <div class="settings-sidebar-item" data-tab="theme"><i class="ri-paint-brush-line"></i> Theme</div>
        <div class="settings-sidebar-item" data-tab="keybinds"><i class="ri-keyboard-line"></i> Keybindings</div>
        <div class="settings-sidebar-item" data-tab="application"><i class="ri-window-fill"></i> Application</div>
        <div class="settings-sidebar-item" data-tab="updates"><i class="ri-refresh-line"></i> Updates</div>
        <div class="settings-sidebar-item" data-tab="about"><i class="ri-information-line"></i> About</div>
      </div>

      <div class="settings-content-area" id="settingsContentArea">

        <div class="settings-no-results" id="settingsNoResults">
          <i class="ri-search-line"></i>
          No settings matched your search.
        </div>

        <div class="settings-content-section active" id="set-general" data-section-label="General">
          <h3 class="settings-category-title">Window & Profile Behavior</h3>
          <div class="settings-item"><div class="settings-item-info"><strong>Default Explorer View</strong><span>Sets the default view for the file explorer</span></div><div class="settings-control"><select data-setting="explorerDefaultView"><option>List View</option><option>Tree View</option></select></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Tree View Indentation</strong><span>Adjusts the pixel indentation for tree view levels</span></div><div class="settings-control"><input type="number" data-setting="treeViewIndent" style="width: 80px;"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Profile Accent Tinting</strong><span>Applies a subtle color tint to isolated profile windows</span></div><div class="settings-control"><input type="checkbox" data-setting="profileAccentTint"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Global Profile Sync</strong><span>Force new isolated profiles to inherit settings from the Native window</span></div><div class="settings-control"><input type="checkbox" data-setting="syncProfileSettings"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Confirm Before Exit</strong><span>Prompt for confirmation before closing the browser tab</span></div><div class="settings-control"><input type="checkbox" data-setting="confirmBeforeExit"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Show Breadcrumbs</strong><span>Display the navigation path above the file list</span></div><div class="settings-control"><input type="checkbox" data-setting="showBreadcrumbs"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Compact Explorer</strong><span>Reduce padding in the file and folder lists</span></div><div class="settings-control"><input type="checkbox" data-setting="compactExplorer"></div></div>

          <h3 class="settings-category-title">Workspace</h3>
          <div class="settings-item"><div class="settings-item-info"><strong>Auto Save</strong><span>Automatically save files after changes</span></div><div class="settings-control"><select data-setting="autoSave"><option>After Delay</option><option>On Focus Change</option><option>On Tab Change</option><option>Off</option></select></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Auto Save Delay</strong><span>Delay in ms to trigger auto save</span></div><div class="settings-control"><input type="number" data-setting="autoSaveDelay" style="width: 80px;"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Format On Save</strong><span>Format a file on save</span></div><div class="settings-control"><input type="checkbox" data-setting="formatOnSave"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Restore Session</strong><span>Reopen tabs from previous session</span></div><div class="settings-control"><input type="checkbox" data-setting="restoreSession"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Enable Trash Bin</strong><span>Move deleted items to recycle bin</span></div><div class="settings-control"><input type="checkbox" data-setting="enableTrashBin"></div></div>

          <h3 class="settings-category-title">System</h3>
          <div class="settings-item"><div class="settings-item-info"><strong>Max Memory</strong><span>Limit browser memory usage (MB)</span></div><div class="settings-control"><input type="number" data-setting="maxMemory" style="width: 80px;"></div></div>
        </div>

        <div class="settings-content-section" id="set-notebook" data-section-label="Notebook">
          <h3 class="settings-category-title">Notebook Environment</h3>
          <div class="settings-item"><div class="settings-item-info"><strong>Auto-Install Packages</strong><span>Automatically pip-install modules on execution</span></div><div class="settings-control"><input type="checkbox" data-setting="nbAutoInstall"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Clear on Restart</strong><span>Clear all cell outputs when kernel is restarted</span></div><div class="settings-control"><input type="checkbox" data-setting="nbClearOnRestart"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Confirm Cell Deletion</strong><span>Show a prompt before deleting a cell</span></div><div class="settings-control"><input type="checkbox" data-setting="nbConfirmDelete"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Plot Background</strong><span>Default background color for rendered plots</span></div><div class="settings-control"><select data-setting="nbPlotBackground"><option>White</option><option>Transparent</option></select></div></div>

          <h3 class="settings-category-title">Cell Editor</h3>
          <div class="settings-item"><div class="settings-item-info"><strong>Cell Font Size</strong><span>Font size in notebook cells</span></div><div class="settings-control"><input type="number" data-setting="nbCellFontSize" style="width: 80px;"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Cell Font Family</strong><span>Font family in notebook cells</span></div><div class="settings-control"><input type="text" data-setting="nbCellFontFamily" style="width: 180px;"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Cell Line Height</strong><span>Line height in notebook cells (0 = auto)</span></div><div class="settings-control"><input type="number" data-setting="nbCellLineHeight" style="width: 80px;"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Cell Letter Spacing</strong><span>Letter spacing in notebook cells</span></div><div class="settings-control"><input type="number" step="0.1" data-setting="nbCellLetterSpacing" style="width: 80px;"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Line Numbers</strong><span>Show line numbers inside cell blocks</span></div><div class="settings-control"><select data-setting="nbCellLineNumbers"><option>off</option><option>on</option></select></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Word Wrap</strong><span>Wrap text in long cell outputs and inputs</span></div><div class="settings-control"><select data-setting="nbCellWordWrap"><option>on</option><option>off</option><option>bounded</option></select></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Code Folding</strong><span>Enable collapsible code blocks in cells</span></div><div class="settings-control"><input type="checkbox" data-setting="nbCellFolding"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Minimap</strong><span>Enable minimap preview inside cells</span></div><div class="settings-control"><input type="checkbox" data-setting="nbCellMinimap"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Render Whitespace</strong><span>Show invisible whitespace characters</span></div><div class="settings-control"><select data-setting="nbCellRenderWhitespace"><option>none</option><option>boundary</option><option>all</option></select></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Bracket Pairs</strong><span>Colorize matching parenthesis/brackets</span></div><div class="settings-control"><input type="checkbox" data-setting="nbCellBracketPairs"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Cursor Style</strong><span>Style of the blinking cursor</span></div><div class="settings-control"><select data-setting="nbCellCursorStyle"><option>line</option><option>block</option><option>underline</option></select></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Cursor Blinking</strong><span>Animation format of the cursor</span></div><div class="settings-control"><select data-setting="nbCellCursorBlinking"><option>expand</option><option>blink</option><option>solid</option><option>smooth</option></select></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Smooth Scrolling</strong><span>Animate scrolling across notebook cells</span></div><div class="settings-control"><input type="checkbox" data-setting="nbCellSmoothScrolling"></div></div>
        </div>

        <div class="settings-content-section" id="set-console" data-section-label="Console">
          <h3 class="settings-category-title">Console Preferences</h3>
          <div class="settings-item"><div class="settings-item-info"><strong>Auto Clear Console</strong><span>Clear the REPL entirely before executing new commands</span></div><div class="settings-control"><input type="checkbox" data-setting="consoleAutoClear"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Show Timestamps</strong><span>Display the timestamp of when each command ran</span></div><div class="settings-control"><input type="checkbox" data-setting="consoleShowTimestamps"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Auto Install Packages</strong><span>Automatically install missing modules inside REPL environments</span></div><div class="settings-control"><input type="checkbox" data-setting="consoleAutoInstall"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>History Limit</strong><span>Maximum number of commands to store in history navigation</span></div><div class="settings-control"><input type="number" data-setting="consoleMaxHistory" style="width: 80px;"></div></div>

          <h3 class="settings-category-title">Console Typography</h3>
          <div class="settings-item"><div class="settings-item-info"><strong>Font Size</strong><span>Font size in console output and input</span></div><div class="settings-control"><input type="number" data-setting="consoleFontSize" style="width: 80px;"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Font Family</strong><span>Font family used in the console</span></div><div class="settings-control"><input type="text" data-setting="consoleFontFamily" style="width: 180px;"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Line Height</strong><span>Line height mapping for console commands</span></div><div class="settings-control"><input type="number" data-setting="consoleLineHeight" style="width: 80px;"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Word Wrap</strong><span>Wrap text for exceedingly long console outputs</span></div><div class="settings-control"><select data-setting="consoleWordWrap"><option>on</option><option>off</option></select></div></div>
        </div>

        <div class="settings-content-section" id="set-terminal" data-section-label="Terminal">
          <h3 class="settings-category-title">Terminal Preferences</h3>
          <div class="settings-item"><div class="settings-item-info"><strong>Font Size</strong><span>Pixel font size in the terminal view</span></div><div class="settings-control"><input type="number" data-setting="termFontSize" style="width: 80px;"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Font Family</strong><span>Font family mapping for the terminal view</span></div><div class="settings-control"><input type="text" data-setting="termFontFamily" style="width: 180px;"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Output Text Color</strong><span>Color of the text generated inside standard command outputs</span></div><div class="settings-control"><input type="color" data-setting="termTextColor"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Input Command Color</strong><span>Color of the text while typing new commands</span></div><div class="settings-control"><input type="color" data-setting="termCmdColor"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Prompt Username Color</strong><span>Color of the username and path inside the input line</span></div><div class="settings-control"><input type="color" data-setting="termPromptColor"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>History Limit</strong><span>Maximum number of standard executed bash commands retained for scrolling</span></div><div class="settings-control"><input type="number" data-setting="termHistorySize" style="width: 80px;"></div></div>
        </div>

        <div class="settings-content-section" id="set-editor" data-section-label="Editor">
          <h3 class="settings-category-title">Font & Typography</h3>
          <div class="settings-item"><div class="settings-item-info"><strong>Font Size</strong><span>Controls the font size in pixels</span></div><div class="settings-control"><input type="number" data-setting="fontSize" style="width: 80px;"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Font Family</strong><span>Controls the font family</span></div><div class="settings-control"><input type="text" data-setting="fontFamily" style="width: 180px;"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Font Weight</strong><span>Controls the font weight</span></div><div class="settings-control"><select data-setting="fontWeight"><option>normal</option><option>bold</option><option>300</option><option>400</option><option>500</option><option>600</option></select></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Line Height</strong><span>Controls the line height (0 = auto)</span></div><div class="settings-control"><input type="number" data-setting="lineHeight" style="width: 80px;"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Letter Spacing</strong><span>Controls letter spacing in pixels</span></div><div class="settings-control"><input type="number" step="0.1" data-setting="letterSpacing" style="width: 80px;"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Font Ligatures</strong><span>Enable programming font ligatures</span></div><div class="settings-control"><input type="checkbox" data-setting="fontLigatures"></div></div>

          <h3 class="settings-category-title">Formatting</h3>
          <div class="settings-item"><div class="settings-item-info"><strong>Tab Size</strong><span>Number of spaces a tab equals</span></div><div class="settings-control"><input type="number" data-setting="tabSize" style="width: 80px;"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Insert Spaces</strong><span>Insert spaces when pressing Tab</span></div><div class="settings-control"><input type="checkbox" data-setting="insertSpaces"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Word Wrap</strong><span>Controls how lines should wrap</span></div><div class="settings-control"><select data-setting="wordWrap"><option>off</option><option>on</option><option>wordWrapColumn</option><option>bounded</option></select></div></div>

          <h3 class="settings-category-title">Display</h3>
          <div class="settings-item"><div class="settings-item-info"><strong>Mouse Wheel Zoom</strong><span>Zoom font with Ctrl+MouseWheel</span></div><div class="settings-control"><input type="checkbox" data-setting="mouseWheelZoom"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Code Folding</strong><span>Enable collapsible code blocks</span></div><div class="settings-control"><input type="checkbox" data-setting="editorFolding"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Highlight Active Line</strong><span>Render active line highlight</span></div><div class="settings-control"><select data-setting="renderLineHighlight"><option>line</option><option>gutter</option><option>all</option><option>none</option></select></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Match Brackets</strong><span>Highlight matching brackets</span></div><div class="settings-control"><select data-setting="matchBrackets"><option>always</option><option>never</option><option>near</option></select></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Minimap</strong><span>Enable Monaco Editor minimap</span></div><div class="settings-control"><input type="checkbox" data-setting="minimap"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Line Numbers</strong><span>Controls the display of line numbers</span></div><div class="settings-control"><select data-setting="lineNumbers"><option>on</option><option>off</option><option>relative</option><option>interval</option></select></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Render Whitespace</strong><span>Render whitespace characters</span></div><div class="settings-control"><select data-setting="renderWhitespace"><option>none</option><option>boundary</option><option>selection</option><option>trailing</option><option>all</option></select></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Bracket Pairs</strong><span>Colorize matching brackets</span></div><div class="settings-control"><input type="checkbox" data-setting="bracketPairs"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Smooth Scrolling</strong><span>Enable smooth scrolling animation</span></div><div class="settings-control"><input type="checkbox" data-setting="smoothScrolling"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Cursor Style</strong><span>Controls the cursor style</span></div><div class="settings-control"><select data-setting="cursorStyle"><option>line</option><option>block</option><option>underline</option><option>line-thin</option><option>block-outline</option><option>underline-thin</option></select></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Cursor Width</strong><span>Thickness of the cursor (px)</span></div><div class="settings-control"><input type="number" data-setting="cursorWidth" style="width: 80px;"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Cursor Blinking</strong><span>Controls the cursor animation</span></div><div class="settings-control"><select data-setting="cursorBlinking"><option>blink</option><option>smooth</option><option>phase</option><option>expand</option><option>solid</option></select></div></div>
        </div>

        <div class="settings-content-section" id="set-theme" data-section-label="Theme">
          <h3 class="settings-category-title">Colors</h3>
          <div class="settings-item"><div class="settings-item-info"><strong>Color Theme</strong><span id="colorThemeHint">Specifies the workbench color theme</span></div><div class="settings-control"><select id="colorThemeSelect" data-setting="colorTheme"><option>CodeMini Light</option><option>CodeMini Light +</option><option>CodeMini Dark</option><option>CodeMini Dark +</option></select></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Theme Pack</strong><span>A complete visual pack that overrides Color Theme entirely - borders, corners, colors, and inactive-item styling all change together</span></div><div class="settings-control"><select id="themePackSelect" data-setting="themePack"><option>None</option><option>CodeMini Premium</option><option>CodeMini Premium Light</option></select></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Icon Theme</strong><span>Specifies the file icon theme</span></div><div class="settings-control"><select data-setting="iconTheme"><option>Remix Icons</option><option>Material</option><option>Font Awesome</option></select></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Accent Color</strong><span id="accentColorHint">Controls primary highlight color</span></div><div class="settings-control"><input type="color" id="accentColorInput" data-setting="accentColor"></div></div>

          <h3 class="settings-category-title">UI Elements</h3>
          <div class="settings-item"><div class="settings-item-info"><strong>Sidebar Position</strong><span>Controls the location of the sidebar</span></div><div class="settings-control"><select data-setting="sidebarPosition"><option>Left</option><option>Right</option></select></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Activity Bar</strong><span>Show the side activity bar</span></div><div class="settings-control"><input type="checkbox" data-setting="activityBar"></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Window Opacity</strong><span>UI background transparency</span></div><div class="settings-control"><input type="range" min="50" max="100" data-setting="windowOpacity"></div></div>
        </div>

        <div class="settings-content-section" id="set-keybinds" data-section-label="Keybindings">
          <h3 class="settings-category-title">File Management</h3>
          <div class="settings-item"><div class="settings-item-info"><strong>Save File</strong><span>Save the currently active file or notebook</span></div><div class="settings-control"><span class="kbd-badge">Ctrl + S</span></div></div>

          <h3 class="settings-category-title">Execution (Notebooks)</h3>
          <div class="settings-item"><div class="settings-item-info"><strong>Run Cell</strong><span>Run active notebook cell</span></div><div class="settings-control"><span class="kbd-badge">Ctrl + Enter</span></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Run & Advance</strong><span>Run cell and select next</span></div><div class="settings-control"><span class="kbd-badge">Shift + Enter</span></div></div>

          <h3 class="settings-category-title">Terminal & Console</h3>
          <div class="settings-item"><div class="settings-item-info"><strong>Autocomplete</strong><span>Complete the current command or filename in the terminal</span></div><div class="settings-control"><span class="kbd-badge">Tab</span></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Cancel Input</strong><span>Clear the current terminal input line</span></div><div class="settings-control"><span class="kbd-badge">Ctrl + C</span></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Command History</strong><span>Step through previous commands in the terminal or console</span></div><div class="settings-control"><span class="kbd-badge">↑ / ↓</span></div></div>

          <h3 class="settings-category-title">Everything Else</h3>
          <div class="settings-item"><div class="settings-item-info"><strong>Other actions</strong><span>New file, close tab, Save All, toggle sidebar, open terminal, search, and formatting are all toolbar/menu-driven right now rather than keyboard shortcuts.</span></div></div>
        </div>

        <div class="settings-content-section" id="set-application" data-section-label="Application">
          <h3 class="settings-category-title">Performance</h3>
          <div class="settings-item"><div class="settings-item-info"><strong>Performance Mode</strong><span>Disables all UI animations to conserve battery and CPU</span></div><div class="settings-control"><input type="checkbox" data-setting="performanceMode"></div></div>

          <h3 class="settings-category-title">Data Privacy</h3>
          <div class="settings-item"><div class="settings-item-info"><strong>Clear Trash on Exit</strong><span>Automatically empty the recycle bin when closing the app</span></div><div class="settings-control"><input type="checkbox" data-setting="clearTrashOnExit"></div></div>

          <h3 class="settings-category-title">Cache Management</h3>
          <div class="settings-item"><div class="settings-item-info"><strong>Clear UI State Cache</strong><span>Resets layout, sidebar, and tab states for the active window/profile.</span></div><div class="settings-control"><button class="settings-danger-btn" id="btnClearUIState" style="color: var(--text-main); background: var(--bg-panel); border-color: var(--border-color);">Clear Cache</button></div></div>

          <h3 class="settings-category-title">System Actions</h3>
          <div class="settings-item"><div class="settings-item-info"><strong>Reset Settings</strong><span>Revert all preferences to default. (Does not affect other windows with profile).</span></div><div class="settings-control"><button class="settings-danger-btn" id="btnResetSettings">Reset Settings</button></div></div>
          <div class="settings-item"><div class="settings-item-info"><strong>Factory Reset</strong><span>Wipe local files, databases, and workspaces. (Does not affect other windows with profile).</span></div><div class="settings-control"><button class="settings-danger-btn" id="btnFactoryReset">Factory Reset</button></div></div>
        </div>

        <div class="settings-content-section" id="set-updates" data-section-label="Updates">
          <h3 class="settings-category-title">Application Updates</h3>
          <div class="settings-item">
            <div class="settings-item-info"><strong>Auto Check Updates</strong><span>Check for new CodeMini versions on launch</span></div>
            <div class="settings-control"><input type="checkbox" data-setting="autoCheckUpdates"></div>
          </div>

          <div id="updateStateContainer">
            <div class="empty-state" style="margin-top: 30px; text-align: center;">
              <i class="ri-checkbox-circle-line" style="font-size: 40px; color: var(--color-success); margin-bottom: 10px; display: block;"></i>
              <h4 style="margin:0 0 5px 0; color: var(--text-main);">You are up to date!</h4>
              <p style="margin:0;">CodeMini v1.0.0 is the latest available version.</p>
            </div>
          </div>

          <div style="margin-top: 40px;">
            <h4 style="color: var(--text-muted); font-size: 12px; text-transform: uppercase; margin-bottom: 15px;">Features</h4>
            <div class="update-item">
              <div class="update-header">
                <div class="update-version"><i class="ri-rocket-line"></i> v1.0.0 <span class="update-badge">Current</span></div>
                <div class="update-date">April 2026</div>
              </div>
              <div class="update-desc">Welcome to the massive v1.0.0 update! We've completely overhauled the IDE with offline-first capabilities.</div>
              <ul class="update-features">
                <li><strong>Live Preview:</strong> Seamless side-by-side HTML/JS/CSS rendering.</li>
                <li><strong>Terminal:</strong> Fully functional browser-based bash emulator.</li>
                <li><strong>Multi-Window Workspaces:</strong> Isolate your projects with ease.</li>
                <li><strong>Enhanced Notebooks:</strong> Pyodide integration and Java environment.</li>
                <li><strong>Fixed plots issues:</strong> Python plots are now fixed and properly placed in it cell.</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="settings-content-section" id="set-about" data-section-label="About">
          <h3 class="settings-category-title">About CodeMini</h3>
          <div style="padding: 10px 0; color: var(--text-main); font-size: 13px; line-height: 1.6;">
            <div style="text-align: center; margin-bottom: 25px;">
              <img src="icons/icon.png" alt="CodeMini Logo" style="width: 64px; height: 64px; object-fit: contain; border-radius: 7px; margin-bottom: 15px; margin-top: 10px;">
              <h2 style="margin: 0; font-size: 20px; color: var(--text-main);">CodeMini IDE</h2>
              <div style="color: var(--text-muted); font-size: 14px; margin-top: 5px;">Version 1.0.0 (Build 2026.04)</div>
            </div>
            <p><strong>CodeMini</strong> is a state-of-the-art, highly portable browser-based coding environment designed for developers who need power on the go. Built with an offline-first philosophy, your code lives securely in your browser's IndexedDB, requiring zero server roundtrips for your daily workflow.</p>
            <h4 style="margin: 20px 0 10px 0; border-bottom: 1px solid var(--border-color); padding-bottom: 5px; color: var(--accent-blue);">Core Technologies</h4>
            <ul style="padding-left: 20px; margin: 0;">
              <li style="margin-bottom: 6px;"><strong>Monaco Editor:</strong> The same editing engine that powers VS Code, delivering intelligent code completion, syntax highlighting, and formatting.</li>
              <li style="margin-bottom: 6px;"><strong>Pyodide:</strong> A Python port for WebAssembly, bringing the full CPython 3 runtime directly to your browser for Jupyter-style notebooks.</li>
              <li style="margin-bottom: 6px;"><strong>Virtual Filesystem:</strong> A robust IndexedDB-backed file structure supporting full hierarchy, permission emulation, and file locking.</li>
            </ul>
            <div style="margin-top: 35px; text-align: center; color: var(--text-muted); font-size: 12px; border-top: 1px solid var(--border-color); padding-top: 15px;">
              &copy; 2026 The CodeMini Community. All rights reserved.<br><br>
              <a href="#" style="color: var(--accent-blue); text-decoration: none; margin: 0 10px;">License</a> |
              <a href="#" style="color: var(--accent-blue); text-decoration: none; margin: 0 10px;">Privacy Policy</a> |
              <a href="#" style="color: var(--accent-blue); text-decoration: none; margin: 0 10px;">GitHub Repository</a>
            </div>
          </div>
        </div>

      </div></div><div class="settings-tabs-bottom-mobile" id="settingsTabsMobile">
      <div class="settings-tab active" data-tab="general"><i class="ri-equalizer-line"></i> General</div>
      <div class="settings-tab" data-tab="notebook"><i class="ri-book-2-line"></i> Notebook</div>
      <div class="settings-tab" data-tab="console"><i class="ri-terminal-box-line"></i> Console</div>
      <div class="settings-tab" data-tab="terminal"><i class="ri-terminal-window-line"></i> Terminal</div>
      <div class="settings-tab" data-tab="editor"><i class="ri-code-box-line"></i> Editor</div>
      <div class="settings-tab" data-tab="theme"><i class="ri-paint-brush-line"></i> Theme</div>
      <div class="settings-tab" data-tab="keybinds"><i class="ri-keyboard-line"></i> Keybindings</div>
      <div class="settings-tab" data-tab="application"><i class="ri-window-fill"></i> Application</div>
      <div class="settings-tab" data-tab="updates"><i class="ri-refresh-line"></i> Updates</div>
      <div class="settings-tab" data-tab="about"><i class="ri-information-line"></i> About</div>
    </div>

  </div>
  `;

  // ==========================================
  // PROFILE CLICK HANDLER
  // ==========================================
  if (profileIconItem) {
    profileIconItem.addEventListener('click', () => {
      const existingTab = document.querySelector('.tab[data-type="profile"]');
      if (existingTab) {
        if (window.switchTab) window.switchTab(existingTab.dataset.target);
        const pane = document.getElementById(existingTab.dataset.target);
        if (pane) pane.innerHTML = getProfileHTML();
        window.updateProfileStats();
        return;
      }

      if (window.createNewTab) {
        window.createNewTab('Profile', 'ri-user-4-line', false, getProfileHTML(), 'profile');
        setTimeout(() => {
          window.updateProfileStats();
        }, 100);
      }
    });
  }

  // ==========================================
  // SETTINGS CLICK HANDLER
  // ==========================================
  if (settingsIconItem) {
    settingsIconItem.addEventListener('click', () => {
      const existingTab = document.querySelector('.tab[data-type="settings"]');
      if (existingTab) {
        if (window.switchTab) window.switchTab(existingTab.dataset.target);
        return;
      }

      if (window.createNewTab) {
        window.createNewTab('Settings', 'ri-settings-6-line', false, settingsHTML, 'settings');

        setTimeout(() => {
          const settingsContainer = document.querySelector('.settings-container');
          if (!settingsContainer) return;

          window.syncUI();

          function switchSettingsTab(tabId) {
            const sections = settingsContainer.querySelectorAll('.settings-content-section');
            const sidebarItems = settingsContainer.querySelectorAll('.settings-sidebar-item');
            const mobileTabs = settingsContainer.querySelectorAll('.settings-tabs-bottom-mobile .settings-tab');

            sections.forEach(s => s.classList.remove('active'));
            sidebarItems.forEach(i => i.classList.remove('active'));
            mobileTabs.forEach(t => t.classList.remove('active'));

            const targetSection = settingsContainer.querySelector('#set-' + tabId);
            if (targetSection) targetSection.classList.add('active');

            sidebarItems.forEach(i => { if (i.dataset.tab === tabId) i.classList.add('active'); });
            mobileTabs.forEach(t => { if (t.dataset.tab === tabId) t.classList.add('active'); });

            const contentArea = settingsContainer.querySelector('#settingsContentArea');
            if (contentArea) contentArea.scrollTop = 0;
          }

          settingsContainer.querySelectorAll('.settings-sidebar-item').forEach(item => {
            item.addEventListener('click', () => {
              exitSearchMode();
              switchSettingsTab(item.dataset.tab);
            });
          });

          settingsContainer.querySelectorAll('.settings-tabs-bottom-mobile .settings-tab').forEach(tab => {
            tab.addEventListener('click', () => {
              exitSearchMode();
              switchSettingsTab(tab.dataset.tab);
            });
          });

          const searchInput = settingsContainer.querySelector('#settingsSearchInput');
          const searchClear = settingsContainer.querySelector('#settingsSearchClear');
          const noResults = settingsContainer.querySelector('#settingsNoResults');
          const contentArea = settingsContainer.querySelector('#settingsContentArea');

          function exitSearchMode() {
            if (!settingsContainer.classList.contains('search-active')) return;
            settingsContainer.classList.remove('search-active');
            if (searchInput) searchInput.value = '';
            if (searchClear) searchClear.classList.remove('visible');
            settingsContainer.querySelectorAll('.settings-item.search-hidden').forEach(el => el.classList.remove('search-hidden'));
            settingsContainer.querySelectorAll('.settings-category-title.search-hidden').forEach(el => el.classList.remove('search-hidden'));
            settingsContainer.querySelectorAll('.settings-content-section.search-section-empty').forEach(el => el.classList.remove('search-section-empty'));
            settingsContainer.querySelectorAll('.settings-content-section.search-hidden').forEach(el => el.classList.remove('search-hidden'));
            if (noResults) noResults.classList.remove('visible');
          }

          function runSearch(term) {
            const trimmed = term.trim().toLowerCase();
            if (!trimmed) { exitSearchMode(); return; }

            settingsContainer.classList.add('search-active');
            if (searchClear) searchClear.classList.add('visible');

            settingsContainer.querySelectorAll('.settings-sidebar-item').forEach(i => i.classList.remove('active'));
            settingsContainer.querySelectorAll('.settings-tabs-bottom-mobile .settings-tab').forEach(t => t.classList.remove('active'));

            let anyVisible = false;

            settingsContainer.querySelectorAll('.settings-content-section').forEach(section => {
              if (section.id === 'set-updates' || section.id === 'set-about') {
                  section.classList.add('search-hidden');
                  section.classList.add('search-section-empty');
                  return;
              }

              let sectionHasVisible = false;
              section.querySelectorAll('.settings-item').forEach(item => {
                const text = item.textContent.toLowerCase();
                if (text.includes(trimmed)) {
                  item.classList.remove('search-hidden');
                  sectionHasVisible = true;
                  anyVisible = true;
                } else {
                  item.classList.add('search-hidden');
                }
              });

              let lastTitle = null;
              let titleHasItems = false;
              section.querySelectorAll('.settings-category-title, .settings-item').forEach(el => {
                if (el.classList.contains('settings-category-title')) {
                  if (lastTitle && !titleHasItems) lastTitle.classList.add('search-hidden');
                  lastTitle = el;
                  lastTitle.classList.remove('search-hidden');
                  titleHasItems = false;
                } else if (el.classList.contains('settings-item')) {
                  if (!el.classList.contains('search-hidden')) titleHasItems = true;
                }
              });
              
              if (lastTitle && !titleHasItems) lastTitle.classList.add('search-hidden');

              if (sectionHasVisible) {
                section.classList.remove('search-section-empty');
                section.classList.remove('search-hidden');
              } else {
                section.classList.add('search-section-empty');
              }
            });

            if (noResults) {
              if (anyVisible) noResults.classList.remove('visible');
              else noResults.classList.add('visible');
            }
            if (contentArea) contentArea.scrollTop = 0;
          }

          if (searchInput) {
            searchInput.addEventListener('input', () => runSearch(searchInput.value));
            searchInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') { exitSearchMode(); searchInput.blur(); } });
          }

          if (searchClear) {
            searchClear.addEventListener('click', () => { exitSearchMode(); if (searchInput) searchInput.focus(); });
          }

          settingsContainer.querySelectorAll('[data-setting]').forEach(input => {
            const settingKey = input.dataset.setting;
            const updateHandler = () => {
              let value;
              if (input.type === 'checkbox') value = input.checked;
              else if (input.type === 'range' || input.type === 'number') {
                value = input.type === 'range' ? parseInt(input.value) : parseFloat(input.value) || input.value;
              } else value = input.value;
              window.saveSetting(settingKey, value);
            };
            input.addEventListener('change', updateHandler);
            if (['range', 'color', 'text', 'number'].includes(input.type)) input.addEventListener('input', updateHandler);
          });
          
          // Clear UI Caches Logic
          const btnClearUI = document.getElementById('btnClearUIState');
          if (btnClearUI) {
            btnClearUI.addEventListener('click', () => {
                const winId = localStorage.getItem('codemini_active_window') || 'win_default';
                localStorage.removeItem(`codemini_ui_state_${winId}`);
                localStorage.removeItem(`codemini_activity_state_${winId}`);
                if (window.showCustomModal) {
                    window.showCustomModal({
                        title: 'Cache Cleared',
                        text: 'The UI state cache for this window/profile has been cleared. Reload the page to see changes.',
                        submitText: 'OK'
                    }, () => closeGenModal());
                } else alert('UI state cache cleared. Reload the page.');
            });
          }

          const btnReset = document.getElementById('btnResetSettings');
          if (btnReset) {
            btnReset.addEventListener('click', () => {
              if (window.showCustomModal) {
                window.showCustomModal({
                  title: 'Reset Settings',
                  text: 'Are you sure you want to reset all user settings back to default?',
                  submitText: 'Reset'
                }, () => {
                  resetAllSettings();
                  closeGenModal();
                  const activeTab = document.querySelector('.tab.active[data-type="settings"]');
                  const paneId = activeTab?.dataset.target;
                  const activeGroup = activeTab?.closest('.editor-group');
                  if (activeTab && typeof closeTab === 'function') {
                    closeTab(activeTab, document.getElementById(paneId), activeGroup);
                  }
                  settingsIconItem.click();
                });
              }
            });
          }

          const btnFactory = document.getElementById('btnFactoryReset');
          if (btnFactory) {
            btnFactory.addEventListener('click', () => {
              const winId = typeof cellActiveWinId !== 'undefined' ? cellActiveWinId : (localStorage.getItem('codemini_active_window') || 'win_default');
              const windowsData = (typeof cellWindows !== 'undefined' ? cellWindows : JSON.parse(localStorage.getItem('codemini_windows'))) || [];
              const activeWin = windowsData.find(w => w.id === winId) || { profile: false, id: 'win_default', db: 'CodeMiniDB', name: '- Native Window -' };
              const isProfile = activeWin.profile;

              let promptTitle = isProfile ? 'Delete Profile Context' : 'Factory Reset (Native)';
              let promptText = isProfile
                ? `WARNING: This will permanently delete ALL workspaces, files, and settings for this isolated Profile ("${activeWin.name}"). Other windows will not be affected.`
                : `WARNING: This will permanently delete ALL files, workspaces, and settings in the Native window. Your isolated Profile windows will remain untouched.`;
              let submitLabel = isProfile ? 'Delete Profile' : 'Wipe Native Data';

              if (window.showCustomModal) {
                window.showCustomModal({ title: promptTitle, text: promptText, submitText: submitLabel }, async () => {
                  const wipeDatabaseDeep = (dbName) => {
                    return new Promise((resolve) => {
                      try {
                        const req = indexedDB.open(dbName);
                        req.onsuccess = (e) => {
                          const dbInstance = e.target.result;
                          if (!dbInstance.objectStoreNames.contains('filesystem')) {
                            dbInstance.close(); indexedDB.deleteDatabase(dbName); resolve(); return;
                          }
                          const tx = dbInstance.transaction('filesystem', 'readonly');
                          const storeReq = tx.objectStore('filesystem').getAll();
                          storeReq.onsuccess = (ev) => {
                            const files = ev.target.result || [];
                            files.filter(f => f.type === 'workspace').forEach(ws => { if (ws.db) indexedDB.deleteDatabase(ws.db); });
                            dbInstance.close(); indexedDB.deleteDatabase(dbName); resolve();
                          };
                          storeReq.onerror = () => { dbInstance.close(); indexedDB.deleteDatabase(dbName); resolve(); };
                        };
                        req.onerror = () => { indexedDB.deleteDatabase(dbName); resolve(); };
                      } catch (err) { indexedDB.deleteDatabase(dbName); resolve(); }
                    });
                  };

                  if (isProfile) {
                    await wipeDatabaseDeep(activeWin.db);
                    const keysToWipe = [];
                    for (let i = 0; i < localStorage.length; i++) {
                      const key = localStorage.key(i);
                      if (key.includes(winId) || key.includes(activeWin.db)) keysToWipe.push(key);
                    }
                    keysToWipe.forEach(k => localStorage.removeItem(k));
                    const updatedWindows = windowsData.filter(w => w.id !== winId);
                    localStorage.setItem('codemini_windows', JSON.stringify(updatedWindows));
                    let pStates = JSON.parse(localStorage.getItem('codemini_profile_states')) || {};
                    delete pStates[winId];
                    localStorage.setItem('codemini_profile_states', JSON.stringify(pStates));
                    localStorage.setItem('codemini_active_window', 'win_default');
                  } else {
                    await wipeDatabaseDeep('CodeMiniDB');
                    // Per-window keys don't share one naming shape across the
                    // app: settings-profile.js writes codemini_<winId>_<key>
                    // (see getPrefixedKey above), but now-island.js, preview.js,
                    // environments.js, script.js, editor.js and stacks.js all
                    // write codemini_<feature>_<winId> instead - winId as a
                    // suffix, not a prefix. The old filter only excluded the
                    // first shape, so a "Native" reset was silently wiping every
                    // OTHER shape for every profile window too (UI state, panel
                    // layout, session/restore, recently-closed, etc.) even
                    // though the dialog above promises profiles stay untouched.
                    // Match on each known profile's actual id/db instead of
                    // guessing at key shapes - any other NATIVE window shares
                    // this same now-wiped CodeMiniDB, so it's fine for its
                    // per-window keys to reset too; only profile windows (a
                    // separate database entirely) need protecting.
                    const profileTokens = windowsData
                      .filter(w => w.profile)
                      .flatMap(w => [w.id, w.db].filter(Boolean));

                    const keysToWipe = [];
                    for (let i = 0; i < localStorage.length; i++) {
                      const key = localStorage.key(i);
                      if (!key.startsWith('codemini_')) continue;
                      if (key === 'codemini_profile_states' || key === 'codemini_windows' || key === 'codemini_active_window') continue;
                      if (profileTokens.some(tok => key.includes(tok))) continue;
                      keysToWipe.push(key);
                    }
                    keysToWipe.forEach(k => localStorage.removeItem(k));
                  }

                  window.location.reload();
                });
              }
            });
          }

        }, 100);
      }
    });
  }
});
