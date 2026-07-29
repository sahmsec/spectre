/**
 * Acorn loader
 * Loads the acorn parser library inside a Chrome extension
 * 
 * Usage:
 * 1. Download acorn.min.js into the libs/ directory
 *    - Download from https://cdn.jsdelivr.net/npm/acorn/dist/acorn.min.js
 *    - or use npm: npm pack acorn && tar -xf acorn-*.tgz
 * 2. Add it in manifest.json to web_accessible_resources
 * 3. Call it where needed loadAcorn()
 */

/**
 * Load the acorn library
 * @returns {Promise<Object>} acorn object
 */
async function loadAcorn() {
    // If already loaded, return immediately
    if (typeof window !== 'undefined' && window.acorn) {
        return window.acorn;
    }
    
    // Try loading from local files
    try {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('libs/acorn.min.js');
        
        await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        
        if (window.acorn) {
            console.log('✅ [AcornLoader] acorn loaded from local file');
            return window.acorn;
        }
    } catch (error) {
        console.warn('⚠️ [AcornLoader] Failed to load acorn from local file:', error);
    }
    
    // Local load failed, notify the user
    console.error('❌ [AcornLoader] acorn not available. Please download acorn.min.js to libs/ directory');
    console.error('   Download from: https://cdn.jsdelivr.net/npm/acorn/dist/acorn.min.js');
    
    return null;
}

/**
 * Check whether acorn is loaded
 * @returns {boolean} whether it is loaded
 */
function isAcornLoaded() {
    return typeof window !== 'undefined' && window.acorn !== undefined;
}

// Export the function
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadAcorn,
        isAcornLoaded
    };
}

// In a browser environment, attach to window
if (typeof window !== 'undefined') {
    window.AcornLoader = {
        loadAcorn,
        isAcornLoaded
    };
}
