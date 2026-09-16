// ==========================================
// preloader.js
// ==========================================

(function initPreloader() {
    // 1. Inject Styles for the Preloader
    const preloaderStyles = document.createElement('style');
    preloaderStyles.id = 'codemini-preloader-styles';
    preloaderStyles.innerHTML = `
        /* Full-screen overlay with exact profile-loading blur & fallback */
        .app-preloader-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 999999; /* Ensure it covers everything */
            background: transparent;
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(10px);
            display: flex;
            justify-content: center;
            align-items: center;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.5s ease, visibility 0.5s ease;
            pointer-events: none;
        }

        .app-preloader-overlay.show {
            opacity: 1;
            visibility: visible;
            pointer-events: all;
        }

        /* Fallback for browsers that do not support backdrop-filter */
        @supports not (backdrop-filter: blur(10px)) {
            .app-preloader-overlay {
                background-color: rgba(245, 245, 245, 0.95);
            }
            [data-theme="dark"] .app-preloader-overlay {
                background-color: rgba(30, 30, 30, 0.95);
            }
        }

        /* Center Text Styling */
        .app-preloader-center h1 {
            font-size: 40px;
            font-weight: 500;
            color: var(--text-main);
            margin: 0;
            letter-spacing: 1px;
        }

        /* Bottom Right Loading Indicator */
        .app-preloader-bottom-right {
            position: absolute;
            bottom: 25px;
            right: 25px;
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 14px;
            color: var(--text-muted);
            font-weight: 500;
        }

        .app-preloader-spinner {
            font-size: 22px;
            color: var(--accent-blue);
            animation: spinStatus 0.8s linear infinite;
        }
    `;
    document.head.appendChild(preloaderStyles);

    // 2. Inject HTML Structure
    const preloaderContainer = document.createElement('div');
    preloaderContainer.id = 'appPreloader';
    preloaderContainer.className = 'app-preloader-overlay';
    preloaderContainer.innerHTML = `
        <div class="app-preloader-center">
            <h1>CodeMini</h1>
        </div>
        <div class="app-preloader-bottom-right">
            <i class="ri-loader-4-line app-preloader-spinner"></i>
            <span>Loading CodeMini...</span>
        </div>
    `;
    document.body.appendChild(preloaderContainer);

    // 3. Trigger Fade In
    // Using requestAnimationFrame ensures the initial styles are painted before adding the 'show' class
    requestAnimationFrame(() => {
        preloaderContainer.classList.add('show');
    });

    // 4. Trigger Fade Out after 4 seconds
    setTimeout(() => {
        preloaderContainer.classList.remove('show');
        
        // Clean up the DOM after the 0.5s fade-out transition completes
        setTimeout(() => {
            preloaderContainer.remove();
            preloaderStyles.remove();
        }, 500);
    }, 4000);

})();
