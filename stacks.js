// ==========================================
// stacks.js
// ==========================================

// --- Helper Utility for File Icons ---
// Centralized engine to guarantee proper developer icons and accurate system colors across all sections
function getFileIconAndColor(name, isFolder = false) {
  if (isFolder) {
    return {
      icon: 'ri-folder-2-line',
      color: 'var(--icon-gray)'
    };
  }

  const lower = name.toLowerCase();

  // Consoles
  if (lower.endsWith('.console')) {
    if (lower.includes('python')) return {
      icon: 'ri-terminal-box-line',
      color: 'var(--icon-py)'
    };
    if (lower.includes('javascript') || lower.includes('js')) return {
      icon: 'ri-terminal-box-line',
      color: 'var(--icon-js)'
    };
    if (lower.includes('php')) return {
      icon: 'ri-terminal-box-line',
      color: '#777bb4'
    };
    if (lower.includes('ruby')) return {
      icon: 'ri-terminal-box-line',
      color: '#cc342d'
    };
    return {
      icon: 'ri-terminal-box-line',
      color: 'var(--text-main)'
    };
  }

  // Notebooks
  if (lower.endsWith('.ipynb')) return {
    icon: 'ri-book-2-line',
    color: 'var(--icon-py)'
  };
  if (lower.endsWith('.irnb')) return {
    icon: 'ri-book-2-line',
    color: '#276dc3'
  };
  if (lower.endsWith('.sqlnb')) return {
    icon: 'ri-book-2-line',
    color: '#4CAF50'
  };
  if (lower.endsWith('.jlnb')) return {
    icon: 'ri-book-2-line',
    color: '#9558B2'
  };

  // Standard Files
  if (lower.endsWith('.py') || lower.endsWith('.pyw')) return {
    icon: 'fab fa-python',
    color: 'var(--icon-py)'
  };
  if (lower.endsWith('.r')) return {
    icon: 'fab fa-r-project',
    color: '#276dc3'
  };
  if (lower.endsWith('.sql') || lower.endsWith('.db') || lower.endsWith('.sqlite')) return {
    icon: 'ri-database-2-line',
    color: '#e38c00'
  };
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) return {
    icon: 'ri-javascript-fill',
    color: 'var(--icon-js)'
  };
  if (lower.endsWith('.ts')) return {
    icon: 'ri-file-code-line',
    color: '#3178c6'
  };
  if (lower.endsWith('.jsx') || lower.endsWith('.tsx')) return {
    icon: 'ri-reactjs-line',
    color: '#61dafb'
  };
  if (lower.endsWith('.vue')) return {
    icon: 'ri-vuejs-line',
    color: '#41b883'
  };
  if (lower.endsWith('.php')) return {
    icon: 'fab fa-php',
    color: '#777bb4'
  };
  if (lower.endsWith('.rb')) return {
    icon: 'ri-code-line',
    color: '#cc342d'
  };
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return {
    icon: 'ri-markdown-fill',
    color: 'var(--icon-md)'
  };
  if (lower.endsWith('.json')) return {
    icon: 'ri-braces-line',
    color: 'var(--icon-json)'
  };
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return {
    icon: 'ri-html5-fill',
    color: 'var(--icon-html)'
  };
  if (lower.endsWith('.css')) return {
    icon: 'ri-css3-fill',
    color: 'var(--icon-css)'
  };
  if (lower.endsWith('.scss') || lower.endsWith('.sass')) return {
    icon: 'ri-css3-line',
    color: '#cc6699'
  };
  if (lower.endsWith('.java') || lower.endsWith('.jar')) return {
    icon: 'fab fa-java',
    color: 'var(--icon-java)'
  };
  if (lower.endsWith('.cpp') || lower.endsWith('.c')) return {
    icon: 'ri-c-plus-plus-line',
    color: '#00599C'
  };
  if (lower.endsWith('.go')) return {
    icon: 'ri-code-box-line',
    color: '#00add8'
  };
  if (lower.endsWith('.rs')) return {
    icon: 'ri-settings-3-line',
    color: '#dea584'
  };
  if (lower.endsWith('.sh') || lower.endsWith('.bash')) return {
    icon: 'ri-terminal-box-line',
    color: 'var(--text-main)'
  };
  if (lower.endsWith('.csv') || lower.endsWith('.tsv')) return {
    icon: 'ri-file-excel-2-line',
    color: '#217346'
  };
  if (lower.endsWith('.txt') || lower.endsWith('.log')) return {
    icon: 'ri-file-text-line',
    color: 'var(--icon-gray)'
  };
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.svg')) return {
    icon: 'ri-image-line',
    color: '#4caf50'
  };
  if (lower.endsWith('.zip') || lower.endsWith('.tar')) return {
    icon: 'ri-folder-zip-line',
    color: '#fbbc04'
  };

  return {
    icon: 'ri-file-3-line',
    color: 'var(--icon-gray)'
  };
}

// window.createPersistentArray now lives solely in app.js (loads first, and
// needs to exist before app.js's own top-level code runs) - see the comment
// there for why this used to be duplicated here.

// State Registry Isolation: Stops global window object pollution
window.stacksStateRegistry = window.stacksStateRegistry || {};

window.renderStacks = function() {
  const stackSidebar = document.getElementById('stackSidebar');
  if (!stackSidebar) return;

  // PRESERVE RESIZER: The drag resizer is injected by script.js.
  // We must capture the node here so the upcoming innerHTML overwrite doesn't destroy it.
  const existingResizer = stackSidebar.querySelector('.sidebar-resizer');

  // Dynamically retrieve ID to guarantee isolation during rendering cycle
  const currentWinId = localStorage.getItem('codemini_active_window') || 'win_default';

  if (!window.stacksStateRegistry[currentWinId]) {
    window.stacksStateRegistry[currentWinId] = {
      ws: false,
      tabs: true,
      kernel: false,
      closed: false,
      bin: false,
      scrollPos: 0,
      filterQuery: ''
    };
  }
  const st = window.stacksStateRegistry[currentWinId];

  //  Ensure we only read states if the DOM belongs to the current window profile!
  if (stackSidebar.dataset.winId === currentWinId) {
    const existingScrollArea = stackSidebar.querySelector('.stack-main-scroll');
    const existingFilterInput = stackSidebar.querySelector('.stack-filter-input');
    if (existingScrollArea) st.scrollPos = existingScrollArea.scrollTop;
    if (existingFilterInput) st.filterQuery = existingFilterInput.value;

    if (stackSidebar.querySelector('.stack-section')) {
      st.ws = document.getElementById('wsDropdownList')?.classList.contains('show') || false;
      st.tabs = document.getElementById('tabsDropdownList')?.classList.contains('show') || false;
      st.kernel = document.getElementById('kernelDropdown')?.classList.contains('show') || false;
      st.closed = document.getElementById('closedDropdownList')?.classList.contains('show') || false;
      st.bin = document.getElementById('binDropdownList')?.classList.contains('show') || false;
    }
  }
  stackSidebar.dataset.winId = currentWinId;

  // Process Recycle Bin - 5 Days Auto-Clear
  const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  if (window.recycleBin && window.recycleBin.length > 0) {
    for (let i = window.recycleBin.length - 1; i >= 0; i--) {
      const item = window.recycleBin[i];
      const age = now - (item.deletedAt || item.timestamp || now);
      if (age >= FIVE_DAYS_MS) {
        window.recycleBin.splice(i, 1);
      } else {
        item._daysLeft = Math.max(1, Math.ceil((FIVE_DAYS_MS - age) / (1000 * 60 * 60 * 24)));
      }
    }
  }

  const recentClosedItems = (window.recentlyClosed || []).slice(-8).reverse();
  const wsCount = window.workspacesList ? window.workspacesList.length: 0;
  const tabsCount = window.openedTabs ? window.openedTabs.length: 0;
  const closedCount = recentClosedItems.length;
  const binCount = window.recycleBin ? window.recycleBin.length: 0;

  // --- KERNELS PROCESSING ENGINE ---
  const allKernels = [{
    id: 'python',
    name: 'Python 3 (Pyodide)',
    icon: 'fab fa-python',
    activeColor: 'var(--icon-py)'
  },
    {
      id: 'r',
      name: 'R (WebR)',
      icon: 'fab fa-r-project',
      activeColor: '#276dc3'
    },
    {
      id: 'sql',
      name: 'SQL (SQLite)',
      icon: 'ri-database-2-line',
      activeColor: '#4CAF50'
    },
    {
      id: 'js',
      name: 'JavaScript',
      icon: 'ri-javascript-line',
      activeColor: 'var(--icon-js)'
    },
    {
      id: 'php',
      name: 'PHP',
      icon: 'fab fa-php',
      activeColor: '#777bb4'
    },
    {
      id: 'ruby',
      name: 'Ruby',
      icon: 'ri-code-line',
      activeColor: '#cc342d'
    }];

  const kernelUsage = {
    python: [],
    r: [],
    sql: [],
    php: [],
    ruby: [],
    js: []
  };
  const domTabs = Array.from(document.querySelectorAll('.tab:not(.add-tab)'));

  domTabs.forEach(tab => {
    const type = tab.dataset.type || '';
    const nameSpan = tab.querySelector('span');
    if (!nameSpan) return;

    const text = nameSpan.textContent;
    const isActive = tab.classList.contains('active');
    const stateStr = isActive
    ? '<span class="kernel-badge kernel-badge-fg">Foreground</span>': '<span class="kernel-badge kernel-badge-bg">Background</span>';

    let kId = null;
    if (type === 'notebook' || type === 'monaco-cell') {
      if (text.endsWith('.ipynb')) kId = 'python';
      else if (text.endsWith('.irnb')) kId = 'r';
      else if (text.endsWith('.sqlnb')) kId = 'sql';
    } else if (type === 'console') {
      if (text.toLowerCase().includes('python')) kId = 'python';
      else if (text.toLowerCase().includes('php')) kId = 'php';
      else if (text.toLowerCase().includes('ruby')) kId = 'ruby';
      else if (text.toLowerCase().includes('javascript')) kId = 'js';
    } else if (type === 'monaco') {
      if (text.endsWith('.py')) kId = 'python';
      else if (text.endsWith('.php')) kId = 'php';
      else if (text.endsWith('.rb')) kId = 'ruby';
      else if (text.endsWith('.js')) kId = 'js';
      else if (text.endsWith('.sql')) kId = 'sql';
      else if (text.endsWith('.r')) kId = 'r';
    }

    if (kId) {
      // Inherit extension-level granular file parameters for active components
      const fileMeta = getFileIconAndColor(text, false);
      kernelUsage[kId].push({
        name: text,
        state: stateStr,
        icon: fileMeta.icon,
        color: fileMeta.color
      });
    }
  });

  let activeKernelsHtml = '';
  let idleKernelsHtml = '';
  let totalActiveKernelsCount = 0;

  allKernels.forEach(k => {
    const usage = kernelUsage[k.id];
    if (usage && usage.length > 0) {
      totalActiveKernelsCount++;
      let usageHtml = usage.map(u => `
        <div class="kernel-usage-row">
        <span class="kernel-file-info" title="${u.name}">
        <i class="${u.icon}" style="color: ${u.color}; font-size: 13px; width: 16px; text-align: center;"></i>
        <span class="kernel-file-text">${u.name}</span>
        </span>
        ${u.state}
        </div>
        `).join('');

      activeKernelsHtml += `
      <div style="margin-bottom: 8px;">
      <div class="kernel-card-header" style="display: flex; align-items: center; gap: 8px; padding: 7px 12px; background: var(--bg-white); border: 1px solid var(--border-color); border-radius: 4px 4px 0 0;">
      <i class="${k.icon}" style="color: ${k.activeColor}; font-size: 14px; width: 16px; text-align: center;"></i>
      <span style="font-size: 12px; color: var(--text-main); font-weight: 600;">${k.name}</span>
      <span class="kernel-usage-count" style="margin-left: auto; font-size: 10px; background: var(--bg-panel); padding: 1px 6px; border-radius: 10px; color: var(--text-muted); border: 1px solid var(--border-color); font-weight: 500;">${usage.length} running</span>
      </div>
      <div class="kernel-card-body" style="background: var(--bg-white); border: 1px solid var(--border-color); border-top: none; border-radius: 0 0 4px 4px; overflow: hidden;">
      ${usageHtml}
      </div>
      </div>
      `;
    } else {
      idleKernelsHtml += `
      <div class="kernel-idle-row" style="display: flex; align-items: center; gap: 8px; padding: 7px 12px; background: transparent; border-radius: 4px; margin-bottom: 4px; opacity: 0.55; border: 1px dashed var(--border-color); transition: opacity 0.2s;">
      <i class="${k.icon}" style="color: var(--icon-gray); font-size: 14px; width: 16px; text-align: center;"></i>
      <span style="font-size: 12px; color: var(--text-muted); font-weight: 500;">${k.name}</span>
      <span style="margin-left: auto; font-size: 10px; color: var(--text-muted); font-style: italic;">Idle</span>
      </div>
      `;
    }
  });

  const kernelHtmlFinal = `
  <div style="font-size: 10px; color: var(--text-muted); font-weight: bold; margin: 4px 0 8px 4px; text-transform: uppercase; letter-spacing: 0.6px;">Active Engines</div>
  ${activeKernelsHtml || '<div style="font-size:12px; color:var(--text-muted); font-style: italic; padding: 4px 8px 12px 4px;">No kernels currently executing</div>'}
  <div style="font-size: 10px; color: var(--text-muted); font-weight: bold; margin: 16px 0 8px 4px; text-transform: uppercase; letter-spacing: 0.6px;">Available Systems</div>
  ${idleKernelsHtml}
  `;

  // --- HTML RENDERERS ---
  const wsHtml = (window.workspacesList || []).map(ws => {
    const wsMeta = getFileIconAndColor(ws.name, true);
    return `
    <div class="stack-item-row stack-filterable" data-name="${ws.name.toLowerCase()}" style="font-size: 12px; padding: 7px 10px; color: var(--text-main); display: flex; align-items: center; gap: 8px; cursor: default;">
    <i class="${wsMeta.icon}" style="color: ${wsMeta.color}; font-size: 14px; width: 16px; text-align: center;"></i>
    <span style="flex:1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500;">${ws.name}</span>
    </div>
    `;
  }).join('');

  const tabsHtml = (window.openedTabs || []).map(t => {
    const fileMeta = getFileIconAndColor(t.name, false);
    const isSystemTab = t.type === 'terminal' || t.type === 'settings' || t.type === 'workspace' || t.type === 'profile' || t.type === 'help';

    let displayIcon = fileMeta.icon;
    let displayColor = fileMeta.color;

    if (isSystemTab) {
      displayIcon = t.icon && !t.icon.includes('ri-file-') ? t.icon: 'ri-terminal-window-line';
      displayColor = 'var(--icon-gray)';
    }

    return `
    <div class="stack-item-row stack-filterable" data-name="${t.name.toLowerCase()}" style="font-size: 12px; padding: 7px 10px; color: var(--text-main); display: flex; align-items: center; gap: 8px; cursor: pointer;" onclick="window.switchTabFromStack('${t.id}')">
    <i class="${displayIcon}" style="color: ${displayColor}; font-size: 14px; width: 16px; text-align: center;"></i>
    <span style="flex:1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500;">${t.name}</span>
    </div>
    `;
  }).join('');

  const closedHtml = recentClosedItems.map(t => {
    const fileMeta = getFileIconAndColor(t.name, false);
    const isSystemTab = t.type === 'terminal' || t.type === 'settings' || t.type === 'workspace' || t.type === 'profile' || t.type === 'help';

    let displayIcon = fileMeta.icon;
    let displayColor = fileMeta.color;

    if (isSystemTab) {
      displayIcon = t.icon && !t.icon.includes('ri-file-') ? t.icon: 'ri-terminal-window-line';
      displayColor = 'var(--icon-gray)';
    }

    return `
    <div class="stack-item-row stack-filterable" data-name="${t.name.toLowerCase()}" style="font-size: 12px; padding: 7px 10px; color: var(--icon-gray); display: flex; align-items: center; gap: 8px; opacity: 0.8;">
    <i class="${displayIcon}" style="color: ${displayColor}; font-size: 14px; width: 16px; text-align: center;"></i>
    <span style="flex:1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${t.name}</span>
    </div>
    `;
  }).join('');

  // Trash display matches how real file managers show deleted folders: only
  // root-level trashed items (whose parent isn't ALSO currently in the trash)
  // render as top-level rows. A trashed folder's contents stay nested inside
  // it, expandable in place, rather than flattening out as separate rows.
  window._trashExpanded = window._trashExpanded || new Set();
  const binItemsById = new Map((window.recycleBin || []).map(t => [t.id, t]));
  const isRootTrashItem = (t) => !binItemsById.has(t.parentId);
  const rootTrashItems = (window.recycleBin || []).filter(isRootTrashItem);

  function renderTrashItem(t, depth) {
    const idx = window.recycleBin.indexOf(t);
    const isFolder = t.type === 'folder' || t.type === 'workspace';
    const fileMeta = getFileIconAndColor(t.name, isFolder);
    const children = isFolder ? (window.recycleBin || []).filter(c => c.parentId === t.id) : [];
    const isExpanded = window._trashExpanded.has(t.id);
    const indent = 10 + depth * 18;

    const caret = (isFolder && children.length > 0)
      ? `<i class="ri-arrow-right-s-line stack-action-icon" style="padding: 0; transform: rotate(${isExpanded ? '90deg' : '0deg'}); transition: transform 0.15s;" onclick="window.toggleTrashExpand('${t.id}', event)"></i>`
      : `<span style="width: 14px; display: inline-block;"></span>`;

    const row = `
    <div class="stack-item-row stack-filterable" data-name="${t.name.toLowerCase()}" style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; padding: 7px 10px 7px ${indent}px; color: var(--text-main);">
    <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;" title="${t.name}" ${isFolder && children.length > 0 ? `onclick="window.toggleTrashExpand('${t.id}', event)" role="button"` : ''}>
    ${caret}
    <i class="${fileMeta.icon}" style="color: ${fileMeta.color}; font-size: 14px; width: 16px; text-align: center;"></i>
    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; font-weight: 500;">${t.name}</span>
    ${isFolder && children.length > 0 ? `<span class="stack-badge">${children.length}</span>` : ''}
    <span class="bin-timer-badge">${t._daysLeft}d left</span>
    </div>
    <div class="bin-actions-container" style="display: flex; gap: 10px; padding-left: 10px;">
    <i class="ri-arrow-go-back-line stack-action-icon" title="Restore Item" onclick="window.restoreBinItem(${idx}, event)"></i>
    <i class="ri-close-line stack-action-icon action-danger-hover" style="color: var(--icon-gray);" title="Delete Permanently" onclick="window.deleteBinItem(${idx}, event)"></i>
    </div>
    </div>
    `;

    const childrenHtml = (isFolder && isExpanded)
      ? children.map(c => renderTrashItem(c, depth + 1)).join('')
      : '';

    return row + childrenHtml;
  }

  const binHtml = rootTrashItems.map(t => renderTrashItem(t, 0)).join('');

  stackSidebar.innerHTML = `
  <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 15px 10px; background: var(--bg-white); position: sticky; top: 0;">
  <div style="font-weight: 700; font-size: 15px; color: var(--text-main); display: flex; align-items: center; gap: 8px; letter-spacing: -0.2px;">My Stacks</div>
  <div class="stack-header-icons" style="border: none; padding: 0; display: flex; gap: 4px;">
  <i class="ri-expand-up-down-line stack-action-icon" style="padding: 4px;" title="Toggle All Sections" onclick="window.toggleAllStacks()"></i>
  <i class="ri-refresh-line stack-action-icon" style="padding: 4px;" title="Refresh UI" onclick="if(window.renderStacks) window.renderStacks();"></i>
  </div>
  </div>

  <div style="padding: 8px 15px 12px; border-bottom: 1px solid var(--border-color); background: var(--bg-white); position: sticky; top: 45px; z-index: 9;">
  <div class="stack-search-bar" style="display: flex; background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 4px; padding: 6px 10px; align-items: center; transition: border-color 0.2s, box-shadow 0.2s;">
  <i class="ri-search-line" style="color: var(--icon-gray); margin-right: 8px; font-size: 14px;"></i>
  <input type="text" class="stack-filter-input" placeholder="Filter variables and items..." value="${st.filterQuery}" style="background: transparent; border: none; outline: none; width: 100%; color: var(--text-main); font-size: 12px; font-family: var(--font-main);" onkeyup="window.filterStacks(this.value)">
  </div>
  </div>

  <div style="flex: 1; overflow-y: auto; padding-bottom: 20px;" class="stack-main-scroll">
  <div class="stack-section" style="flex-direction: column; align-items: stretch; padding: 0;">
  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; cursor: pointer;" onclick="document.getElementById('wsDropdownList').classList.toggle('show'); document.getElementById('wsArrow').classList.toggle('open');">
  <div class="stack-title"><i class="ri-arrow-right-s-fill arrow-icon ${st.ws ? 'open': ''}" id="wsArrow"></i> WORKSPACES <span class="stack-badge">${wsCount}</span></div>
  </div>
  <div id="wsDropdownList" class="stack-list-container ${st.ws ? 'show': ''}" style="padding: 0 10px 10px 20px; flex-direction: column; gap: 2px;">
  ${wsHtml || '<div style="font-size:12px; color:var(--text-muted); font-style: italic; padding: 6px 10px;">No extra workspaces</div>'}
  </div>
  </div>

  <div class="stack-section" style="flex-direction: column; align-items: stretch; padding: 0;">
  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; cursor: pointer;" onclick="document.getElementById('tabsDropdownList').classList.toggle('show'); document.getElementById('tabsArrow').classList.toggle('open');">
  <div class="stack-title"><i class="ri-arrow-right-s-fill arrow-icon ${st.tabs ? 'open': ''}" id="tabsArrow"></i> OPENED TABS <span class="stack-badge">${tabsCount}</span></div>
  <div class="stack-action"><i class="ri-close-circle-line stack-action-icon" style="font-size:15px;" title="Close All Tabs" onclick="event.stopPropagation(); window.closeAllOpenedTabs();"></i></div>
  </div>
  <div id="tabsDropdownList" class="stack-list-container ${st.tabs ? 'show': ''}" style="padding: 0 10px 10px 20px; flex-direction: column; gap: 2px;">
  ${tabsHtml || '<div style="font-size:12px; color:var(--text-muted); font-style: italic; padding: 6px 10px;">No tabs open</div>'}
  </div>
  </div>

  <div class="stack-section" style="flex-direction: column; align-items: stretch; padding: 0;">
  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; cursor: pointer;" onclick="document.getElementById('kernelDropdown').classList.toggle('show'); document.getElementById('kernelArrow').classList.toggle('open');">
  <div class="stack-title"><i class="ri-arrow-right-s-fill arrow-icon ${st.kernel ? 'open': ''}" id="kernelArrow"></i> KERNELS <span class="stack-badge">${totalActiveKernelsCount} Active</span></div>
  </div>
  <div id="kernelDropdown" class="stack-list-container ${st.kernel ? 'show': ''}" style="padding: 0 15px 12px 15px; flex-direction: column; gap: 4px;">
  ${kernelHtmlFinal}
  </div>
  </div>

  <div class="stack-section" style="flex-direction: column; align-items: stretch; padding: 0;">
  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; cursor: pointer;" onclick="document.getElementById('closedDropdownList').classList.toggle('show'); document.getElementById('closedArrow').classList.toggle('open');">
  <div class="stack-title"><i class="ri-arrow-right-s-fill arrow-icon ${st.closed ? 'open': ''}" id="closedArrow"></i> RECENTLY CLOSED <span class="stack-badge">${closedCount}</span></div>
  <div class="stack-action"><i class="ri-eraser-line stack-action-icon" style="font-size:15px;" title="Clear History" onclick="event.stopPropagation(); window.recentlyClosed.length = 0; window.renderStacks();"></i></div>
  </div>
  <div id="closedDropdownList" class="stack-list-container ${st.closed ? 'show': ''}" style="padding: 0 10px 10px 20px; flex-direction: column; gap: 2px;">
  ${closedHtml || '<div style="font-size:12px; color:var(--text-muted); font-style: italic; padding: 6px 10px;">No recent tabs</div>'}
  </div>
  </div>

  <div class="stack-section" style="flex-direction: column; align-items: stretch; padding: 0; border-bottom: none;">
  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; cursor: pointer;" onclick="document.getElementById('binDropdownList').classList.toggle('show'); document.getElementById('binArrow').classList.toggle('open');">
  <div class="stack-title"><i class="ri-arrow-right-s-fill arrow-icon ${st.bin ? 'open': ''}" id="binArrow"></i> RECYCLE BIN <span class="stack-badge">${binCount}</span></div>
  <div class="stack-action" style="display: flex; gap: 10px; align-items: center;">
  <i class="ri-arrow-go-back-line stack-action-icon" style="font-size:14px;" title="Restore All" onclick="event.stopPropagation(); window.restoreAllBin();"></i>
  <i class="ri-delete-bin-2-line stack-action-icon action-danger-hover" style="font-size:14px;" title="Empty Bin" onclick="event.stopPropagation(); window.emptyBin();"></i>
  </div>
  </div>
  <div id="binDropdownList" class="stack-list-container ${st.bin ? 'show': ''}" style="padding: 0 10px 10px 20px; flex-direction: column; gap: 2px;">
  ${binHtml || '<div style="font-size:12px; color:var(--text-muted); font-style: italic; padding: 6px 10px;">Recycle Bin is empty</div>'}
  </div>
  </div>
  </div>
  `;

  // RESTORE RESIZER: Re-attach the dynamic dragger so dragging isn't permanently broken
  if (existingResizer) {
    stackSidebar.appendChild(existingResizer);
  }

  // Restore states
  const newScrollArea = stackSidebar.querySelector('.stack-main-scroll');
  if (newScrollArea) newScrollArea.scrollTop = st.scrollPos;
  if (st.filterQuery) window.filterStacks(st.filterQuery);

  if (!document.getElementById('stackOverrides')) {
    const style = document.createElement('style');
    style.id = 'stackOverrides';
    style.innerHTML = `
    .stack-list-container { display: none; }
    .stack-list-container.show { display: flex !important; }
    .stack-list-container { max-height: 400px; overflow-y: auto; overflow-x: hidden; }
    .stack-list-container::-webkit-scrollbar, .stack-main-scroll::-webkit-scrollbar { width: 4px; }
    .stack-list-container::-webkit-scrollbar-track, .stack-main-scroll::-webkit-scrollbar-track { background: transparent; }
    .stack-list-container::-webkit-scrollbar-thumb, .stack-main-scroll::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 4px; }
    .stack-badge { background: var(--bg-panel); color: var(--text-muted); padding: 2px 7px; border-radius: 10px; font-size: 10px; margin-left: 6px; font-weight: 500; border: 1px solid var(--border-color); }
    .stack-item-row { transition: background-color 0.15s ease, color 0.15s ease; border-radius: 4px; display: flex; align-items: center; }
    .stack-item-row:hover { background-color: var(--bg-panel); }
    .stack-action-icon { cursor: pointer; opacity: 0.65; transition: opacity 0.15s ease, transform 0.15s ease, color 0.15s ease; color: var(--icon-gray); display: inline-flex; align-items: center; justify-content: center; border-radius: 3px; }
    .stack-action-icon:hover { opacity: 1; background-color: var(--bg-panel); color: var(--text-main); }
    .stack-action-icon.action-danger-hover:hover { color: var(--color-danger, #ef5350) !important; }

    /* Enhanced Engine Item Layout Components */
    .kernel-usage-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 12px 6px 12px; font-size: 11px; border-bottom: 1px solid dashed var(--border-color); }
    .kernel-usage-row:last-child { border-bottom: none; }
    .kernel-file-info { display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
    .kernel-file-text { color: var(--text-main); font-weight: 400; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 135px; }

    /* Status Badges */
    .kernel-badge { font-size: 9px; padding: 1px 6px; border-radius: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
    .kernel-badge-fg { color: #2e7d32; background: #e8f5e9; }
    .kernel-badge-bg { color: var(--text-muted); background: var(--bg-panel); }
    .bin-timer-badge { font-size: 9px; color: #f57f17; background: #fffde7; padding: 1px 5px; border-radius: 3px; margin-left: auto; white-space: nowrap; font-weight: 500; border: 1px solid #fff59d; }
    `;
    document.head.appendChild(style);
  }
};

window.filterStacks = function(query) {
  const lowerQuery = query.toLowerCase();

  // Auto-expand any trashed folder that contains a matching descendant, so
  // search can actually find items nested inside a collapsed trashed folder
  // (their rows don't exist in the DOM at all until expanded).
  if (lowerQuery && window.recycleBin && window.recycleBin.length) {
    window._trashExpanded = window._trashExpanded || new Set();
    const byId = new Map(window.recycleBin.map(t => [t.id, t]));
    let expandedAny = false;
    window.recycleBin.forEach(t => {
      if (t.name.toLowerCase().includes(lowerQuery)) {
        let parentId = t.parentId;
        while (byId.has(parentId)) {
          if (!window._trashExpanded.has(parentId)) { window._trashExpanded.add(parentId); expandedAny = true; }
          parentId = byId.get(parentId).parentId;
        }
      }
    });
    if (expandedAny) { window.renderStacks(); }
  }

  document.querySelectorAll('#stackSidebar .stack-filterable').forEach(el => {
    el.style.display = (!lowerQuery || (el.dataset.name && el.dataset.name.includes(lowerQuery))) ? 'flex': 'none';
  });
  if (lowerQuery.length > 0) {
    document.querySelectorAll('#stackSidebar .stack-list-container').forEach(d => d.classList.add('show'));
    document.querySelectorAll('#stackSidebar .arrow-icon').forEach(a => a.classList.add('open'));
  }
};

window.toggleAllStacks = function() {
  const dropdowns = document.querySelectorAll('#stackSidebar .stack-list-container');
  const arrows = document.querySelectorAll('#stackSidebar .arrow-icon');
  const isAnyClosed = Array.from(dropdowns).some(d => !d.classList.contains('show'));
  dropdowns.forEach(d => isAnyClosed ? d.classList.add('show'): d.classList.remove('show'));
  arrows.forEach(a => isAnyClosed ? a.classList.add('open'): a.classList.remove('open'));
};

window.switchTabFromStack = function(targetId) {
  if (typeof window.switchTab === 'function') window.switchTab(targetId);
};

window.closeAllOpenedTabs = function() {
  document.querySelectorAll('.tab-close').forEach(btn => btn.click());
};

window.emptyBin = function() {
  if (!window.recycleBin || window.recycleBin.length === 0) return;
  const confirmAction = () => {
    window.recycleBin.length = 0;
    window.renderStacks();
    if (typeof closeGenModal === 'function') closeGenModal();
  };
  if (window.showCustomModal) {
    window.showCustomModal({
      title: 'Empty Recycle Bin', text: 'Permanently delete all items? This action cannot be undone.', submitText: 'Empty Bin'
    }, confirmAction);
  } else if (confirm("Permanently delete all items in the Recycle Bin?")) confirmAction();
};

window.restoreAllBin = function() {
  if (!window.recycleBin || window.recycleBin.length === 0) return;

  // Isolate database dynamically to current active context
  const currentDb = typeof db !== 'undefined' ? db: null;
  if (!currentDb) return;

  const tx = currentDb.transaction('filesystem', 'readwrite');
  const store = tx.objectStore('filesystem');
  window.recycleBin.forEach(f => { delete f.deletedAt; store.put(f); });

  tx.oncomplete = () => {
    window.recycleBin.length = 0;
    if (typeof loadFilesFromDB === 'function') loadFilesFromDB();
    window.renderStacks();
  };
};

window.toggleTrashExpand = function(id, event) {
  if (event) event.stopPropagation();
  window._trashExpanded = window._trashExpanded || new Set();
  if (window._trashExpanded.has(id)) window._trashExpanded.delete(id);
  else window._trashExpanded.add(id);
  window.renderStacks();
};

window.restoreBinItem = function(index, event) {
  if (event) event.stopPropagation();
  const currentDb = typeof db !== 'undefined' ? db: null;
  if (!currentDb) return;

  const file = window.recycleBin[index];
  if (!file) return;
  const byId = new Map(window.recycleBin.map(t => [t.id, t]));

  // Restoring a single item shouldn't come back as an orphan if its parent
  // folder is still in the trash - walk up and restore any trashed ancestors
  // first, so it always has somewhere to actually live once restored.
  const toRestore = [file];
  const seen = new Set([file.id]);
  let parentId = file.parentId;
  while (byId.has(parentId) && !seen.has(parentId)) {
    const parent = byId.get(parentId);
    toRestore.push(parent);
    seen.add(parentId);
    parentId = parent.parentId;
  }

  // Restoring a folder also restores everything still in the trash beneath
  // it, matching how deleting a folder already recursively deletes its
  // contents - the natural counterpart action.
  if (file.type === 'folder' || file.type === 'workspace') {
    const getDescendants = (pid) => {
      const children = window.recycleBin.filter(t => t.parentId === pid);
      let result = [...children];
      children.forEach(c => { if (c.type === 'folder' || c.type === 'workspace') result.push(...getDescendants(c.id)); });
      return result;
    };
    getDescendants(file.id).forEach(d => { if (!seen.has(d.id)) { toRestore.push(d); seen.add(d.id); } });
  }

  const tx = currentDb.transaction('filesystem', 'readwrite');
  const store = tx.objectStore('filesystem');
  toRestore.forEach(f => { delete f.deletedAt; store.put(f); });

  tx.oncomplete = () => {
    toRestore.forEach(f => {
      const i = window.recycleBin.indexOf(f);
      if (i !== -1) window.recycleBin.splice(i, 1);
    });
    if (typeof loadFilesFromDB === 'function') loadFilesFromDB();
    window.renderStacks();
  };
};

window.deleteBinItem = function(index, event) {
  if (event) event.stopPropagation();
  const item = window.recycleBin[index];
  if (!item) return;

  // Permanently deleting a still-trashed folder should also permanently
  // delete whatever's still nested beneath it in the trash, rather than
  // leaving those entries behind pointing at a parentId that no longer
  // exists anywhere (live or trashed) - the trash-internal equivalent of
  // the same orphaning bug the live-delete recursion already fixes.
  const toDelete = [item];
  if (item.type === 'folder' || item.type === 'workspace') {
    const getDescendants = (pid) => {
      const children = window.recycleBin.filter(t => t.parentId === pid);
      let result = [...children];
      children.forEach(c => { if (c.type === 'folder' || c.type === 'workspace') result.push(...getDescendants(c.id)); });
      return result;
    };
    toDelete.push(...getDescendants(item.id));
  }

  const confirmAction = () => {
    toDelete.forEach(f => {
      const i = window.recycleBin.indexOf(f);
      if (i !== -1) window.recycleBin.splice(i, 1);
    });
    window.renderStacks();
    if (typeof closeGenModal === 'function') closeGenModal();
  };
  const confirmText = toDelete.length > 1
    ? `Are you sure you want to permanently delete "${item.name}" and ${toDelete.length - 1} item${toDelete.length - 1 === 1 ? '' : 's'} inside it?`
    : `Are you sure you want to permanently delete "${item.name}"?`;
  if (window.showCustomModal) {
    window.showCustomModal({
      title: 'Delete Permanently', text: confirmText, submitText: 'Delete'
    }, confirmAction);
  } else if (confirm(confirmText)) confirmAction();
};

document.addEventListener('DOMContentLoaded', () => {
  if (window.renderStacks) window.renderStacks();
});