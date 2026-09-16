// ==========================================
// now-island.js
// ==========================================

(function initNowIsland() {
    // 1. Inject Styles for Now Island
    const style = document.createElement('style');
    style.innerHTML = `
        #nowIslandPanel {
            position: fixed;
            bottom: 30px; /* Above PC status bar (26px) + margin */
            right: 15px;
            width: 370px;
            height: 290px;
            background-color: var(--bg-white);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            box-shadow: 0 4px 20px var(--shadow-color);
            display: flex;
            flex-direction: column;
            z-index: 9999;
            transform: translateY(15px);
            opacity: 0;
            visibility: hidden;
            transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        
        #nowIslandPanel.show {
            transform: translateY(0);
            opacity: 1;
            visibility: visible;
        }
        
        .ni-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 15px;
            background-color: var(--bg-white);
            border-radius: 6px 6px 0 0;
        }
        
        .ni-title {
            font-weight: 600;
            font-size: 13px;
            color: var(--text-main);
        }
        
        .ni-controls {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .ni-tabs {
            display: flex;
            gap: 12px;
        }
        
        .ni-tab {
            font-size: 11px;
            font-weight: 600;
            color: var(--text-muted);
            text-transform: uppercase;
            cursor: pointer;
            transition: color 0.2s;
        }
        
        
        .ni-tab.active {
            color: var(--accent-blue);
            font-weight: 700;
        }
        
        #nowIslandClose {
            cursor: pointer;
            font-size: 16px;
            color: var(--icon-gray);
            transition: color 0.2s;
        }
        
        #nowIslandClose:hover {
            color: var(--color-danger);
        }
        
        .ni-body {
            flex: 1;
            background-color: var(--bg-white);
            border-radius: 0 0 6px 6px;
        }

        /* Mobile Adaptations */
        @media (max-width: 768px) {
            #nowIslandPanel {
                bottom: 55px; /* Above mobile status bar (46px) + margin */
                right: 10px;
                /* Adapts to account for the 45px activity bar */
                left: 55px; 
                width: auto;
                height: 340px;
            }
            
            /* Dynamically adapts width if the layout hides the activity bar */
            body.hide-activity-bar #nowIslandPanel {
                left: 10px; 
            }

            /* Native Android Override (Accounts for default 26px status bar vs iOS safe areas) */
            html.is-android #nowIslandPanel {
                bottom: 35px;
            }
        }
    `;
    document.head.appendChild(style);

    // 2. Inject HTML Structure
    const panel = document.createElement('div');
    panel.id = 'nowIslandPanel';
    panel.innerHTML = `
        <div class="ni-header">
            <div class="ni-title">Now Island</div>
            <div class="ni-controls">
                <div class="ni-tabs">
                    <span class="ni-tab active">Now</span>
                    <span class="ni-tab">Notifications</span>
                </div>
                <i class="ri-layout-grid-fill" id=""></i>
                <i class="ri-close-line" id="nowIslandClose"></i>
            </div>
        </div>
        <div class="ni-body"></div>
    `;
    document.body.appendChild(panel);

    // 3. Setup Event Listeners
    const nowIslandBtn = document.getElementById('nowIsland');
    const closeBtn = document.getElementById('nowIslandClose');
    const tabs = panel.querySelectorAll('.ni-tab');

    if (nowIslandBtn) {
        nowIslandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            panel.classList.toggle('show');
            if (window.saveCurrentUIState) window.saveCurrentUIState();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            panel.classList.remove('show');
            if (window.saveCurrentUIState) window.saveCurrentUIState();
        });
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });

    document.addEventListener('click', (e) => {
        if (panel.classList.contains('show') && !panel.contains(e.target) && (!nowIslandBtn || !nowIslandBtn.contains(e.target))) {
            panel.classList.remove('show');
            if (window.saveCurrentUIState) window.saveCurrentUIState();
        }
    });

    // 4. Connect to Isolated Profile Window Registry
    document.addEventListener('DOMContentLoaded', () => {
        
        // Patch save function
        if (typeof window.saveCurrentUIState === 'function') {
            const originalSave = window.saveCurrentUIState;
            window.saveCurrentUIState = function() {
                originalSave();
                const winId = localStorage.getItem('codemini_active_window') || 'win_default';
                const isOpen = panel.classList.contains('show');
                const activeTabEl = panel.querySelector('.ni-tab.active');
                const activeTabIndex = activeTabEl ? Array.from(tabs).indexOf(activeTabEl) : 0;
                localStorage.setItem(`codemini_nowisland_state_${winId}`, JSON.stringify({ isOpen, activeTabIndex }));
            };
        }

        // Patch restore function
        if (typeof window.restoreCurrentUIState === 'function') {
            const originalRestore = window.restoreCurrentUIState;
            window.restoreCurrentUIState = function() {
                originalRestore();
                const winId = localStorage.getItem('codemini_active_window') || 'win_default';
                let activeTabIndex = 0;
                try {
                    const saved = JSON.parse(localStorage.getItem(`codemini_nowisland_state_${winId}`));
                    if (saved && saved.isOpen) {
                        panel.classList.add('show');
                    } else {
                        panel.classList.remove('show');
                    }
                    if (saved && Number.isInteger(saved.activeTabIndex)) activeTabIndex = saved.activeTabIndex;
                } catch(e) {
                    panel.classList.remove('show');
                }
                // Without this, whichever tab (Now / Notifications) was last
                // clicked in ANY window stays visually selected after
                // switching, since the tabs themselves are a DOM singleton
                // that switchWindow never rebuilds - it just looked like the
                // new window "remembered" the old window's last tab choice.
                tabs.forEach((t, i) => t.classList.toggle('active', i === activeTabIndex));
            };
        }

        // Initial restore pass
        if (typeof window.restoreCurrentUIState === 'function') {
            window.restoreCurrentUIState();
        }
    });
})();
