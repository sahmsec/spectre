async function initWebpackScanner() {
    console.log('[WebpackScanner] Initialize the Webpack scanner...');

    try {

        const dependencies = [
            { name: 'WebpackDetector', loaded: typeof WebpackDetector !== 'undefined' },
            { name: 'ChunkAnalyzer', loaded: typeof ChunkAnalyzer !== 'undefined' },
            { name: 'SourceMapParser', loaded: typeof SourceMapParser !== 'undefined' },
            { name: 'RuntimeAnalyzer', loaded: typeof RuntimeAnalyzer !== 'undefined' },
            { name: 'ModuleAnalyzer', loaded: typeof ModuleAnalyzer !== 'undefined' },
            { name: 'WebpackScannerBridge', loaded: typeof WebpackScannerBridge !== 'undefined' }
        ];

        const missingDeps = dependencies.filter(d => !d.loaded);
        if (missingDeps.length > 0) {
            console.warn('[WebpackScanner] missing dependency:', missingDeps.map(d => d.name).join(', '));
            return false;
        }


        if (!window.webpackDetector) {
            window.webpackDetector = new WebpackDetector({ debug: false });
        }

        if (!window.webpackScannerBridge) {
            window.webpackScannerBridge = new WebpackScannerBridge({ debug: false });
            await window.webpackScannerBridge.init();
        }

        console.log('[WebpackScanner] Webpack scanner initialized');
        return true;

    } catch (error) {
        console.error('[WebpackScanner] Initialization failed:', error);
        return false;
    }
}


async function detectWebpack() {
    try {
        if (!window.webpackDetector) {
            await initWebpackScanner();
        }

        if (!window.webpackDetector) {
            return { detected: false, error: 'WebpackDetector not initialized' };
        }

        return window.webpackDetector.detect();

    } catch (error) {
        console.error('[WebpackScanner] detection failed:', error);
        return { detected: false, error: error.message };
    }
}


async function scanWebpack(deepScan = false) {
    try {
        if (!window.webpackScannerBridge) {
            await initWebpackScanner();
        }

        if (!window.webpackScannerBridge) {
            return { detected: false, error: 'WebpackScannerBridge not initialized' };
        }

        return await window.webpackScannerBridge.scan(deepScan);

    } catch (error) {
        console.error('[WebpackScanner] Scan failed:', error);
        return { detected: false, error: error.message };
    }
}


async function deepScanWebpack() {
    return await scanWebpack(true);
}


function getWebpackScannerStatus() {
    return {
        initialized: !!window.webpackScannerBridge?.initialized,
        detectorLoaded: typeof WebpackDetector !== 'undefined',
        chunkAnalyzerLoaded: typeof ChunkAnalyzer !== 'undefined',
        sourceMapParserLoaded: typeof SourceMapParser !== 'undefined',
        runtimeAnalyzerLoaded: typeof RuntimeAnalyzer !== 'undefined',
        moduleAnalyzerLoaded: typeof ModuleAnalyzer !== 'undefined',
        bridgeLoaded: typeof WebpackScannerBridge !== 'undefined'
    };
}


function getWebpackScanSummary() {
    if (!window.webpackScannerBridge) {
        return { detected: false };
    }
    return window.webpackScannerBridge.getSummary();
}


async function detectVueWebpack() {
    const result = {
        vue: { detected: false },
        webpack: { detected: false },
        isVueWebpack: false
    };

    try {

        const webpackResult = await detectWebpack();
        result.webpack = {
            detected: webpackResult.detected,
            version: webpackResult.version,
            buildMode: webpackResult.buildMode
        };


        if (typeof window.VueDetectorBridge !== 'undefined') {
            const vueBridge = new window.VueDetectorBridge();
            const vueResult = await vueBridge.detect();
            result.vue = {
                detected: vueResult.detected,
                version: vueResult.framework?.version,
                hasRouter: vueResult.framework?.hasRouter,
                routeCount: vueResult.routes?.length || 0
            };
        } else {

            result.vue.detected = !!(window.Vue || window.__VUE__ ||
                document.querySelector('[data-v-]') ||
                document.querySelector('#app[data-server-rendered]'));
        }


        result.isVueWebpack = result.vue.detected && result.webpack.detected;

        if (result.isVueWebpack) {
            console.log('[WebpackScanner] Detected a Vue + Webpack combination');
        }

    } catch (error) {
        console.error('[WebpackScanner] Vue + Webpack detection failed:', error);
    }

    return result;
}


async function scanFrameworks() {
    const result = {
        vue: null,
        webpack: null,
        isVueWebpack: false,
        combined: {}
    };

    try {

        result.webpack = await scanWebpack();


        if (typeof window.VueDetectorBridge !== 'undefined') {
            const vueBridge = new window.VueDetectorBridge();
            result.vue = await vueBridge.detect();
        }


        result.isVueWebpack = (result.vue?.detected || false) &&
                              (result.webpack?.detection?.detected || false);


        if (result.isVueWebpack) {
            result.combined = {
                framework: 'Vue + Webpack',
                vueVersion: result.vue?.framework?.version || 'unknown',
                webpackVersion: result.webpack?.detection?.version || 'unknown',
                routes: result.vue?.routes || [],
                chunks: result.webpack?.chunks || [],
                sourceMaps: result.webpack?.sourceMaps || [],
                lazyRoutes: result.vue?.routes?.filter(r => r.lazyLoaded)?.length || 0
            };
        }

    } catch (error) {
        console.error('[WebpackScanner] Framework scan failed:', error);
    }

    return result;
}


if (typeof window !== 'undefined') {
    window.initWebpackScanner = initWebpackScanner;
    window.detectWebpack = detectWebpack;
    window.scanWebpack = scanWebpack;
    window.deepScanWebpack = deepScanWebpack;
    window.getWebpackScannerStatus = getWebpackScannerStatus;
    window.getWebpackScanSummary = getWebpackScanSummary;
    window.detectVueWebpack = detectVueWebpack;
    window.scanFrameworks = scanFrameworks;
}
