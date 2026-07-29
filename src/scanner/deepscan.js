let scanConfig         = null;
let scanResults        = {};
let isScanRunning      = false;
let isPaused           = false;
let currentDepth       = 0;
let scannedUrls        = new Set();
let pendingUrls        = new Set();
let urlContentCache    = new Map();
let activeRequests     = 0;
let maxConcurrency     = 2;
let requestTimeout     = 5000;


let logEntries         = [];
let maxLogEntries      = 50;
let logBuffer          = [];
let logFlushTimer      = null;
const LOG_FLUSH_INTERVAL = 1000;


let apiFilter          = null;
let domainPhoneFilter  = null;
let filtersLoaded      = false;
let patternExtractor   = null;


let updateQueue        = [];
let isUpdating         = false;
let lastUpdateTime     = 0;
const UPDATE_THROTTLE  = 1000;
let pendingResults     = {};
let batchSize          = 50;
let updateTimer        = null;
let displayUpdateCount = 0;
let lastLogTime        = 0;
const LOG_THROTTLE     = 2000;


let memoryCleanupTimer = null;
const MEMORY_CLEANUP_INTERVAL = 15000;


const SKIP_JS_PATTERNS = [
    /^jquery([.-]?\d*\.?\d*\.?\d*)?(?:[\.-]cookie)?(?:[\.-]fancybox)?(?:[\.-]validate)?(?:[\.-]artdialog)?(?:[\.-]blockui)?(?:[\.-]pack)?(?:[\.-]base64)?(?:[\.-]md5)?(?:[\.-]min)?\.js$/i,
    /^(?:vue|vue-router|vuex)[.-]?\d*\.?\d*\.?\d*(?:\.min)?\.js$/i,
    /^(?:react|react-dom)[.-]?\d*\.?\d*\.?\d*(?:\.min)?\.js$/i,
    /^bootstrap(?:\.bundle)?[.-]?\d*\.?\d*\.?\d*(?:[\.-]datepicker|datetimepicker)?(?:[\.-]zh-cn)?(?:[\.-]min)?\.js$/i,
    /^(?:layui|lay|layer|liger|h-ui|element-ui|ueditor|kindeditor|ant-design)[.-]?\d*\.?\d*\.?\d*(?:[\.-]all)?(?:\.admin)?(?:[\.-]config)?(?:[\.-]min)?\.js$/i,
    /^(?:echarts|chart|highcharts)[.-]?\d*\.?\d*\.?\d*(?:\.min)?\.js$/i,
    /^(?:lodash|moment|tableexport|axios|plupload|pqgrid|md5)[.-]?\d*\.?\d*\.?\d*(?:\.full)?(?:\.min)?\.js$/i,
    /^(?:polyfill|modernizr|device|less|isotope\.pkgd|lhgdialog|kendo\.web|datatables|editor|seajs-style|seajs-text|tinymce|jsencrypt|backbone|select2|underscore|ext-all|ext-unigui-min|exporter|buttons)[.-]?\d*\.?\d*\.?\d*(?:[\.-]dev)?(?:[\.-]html5|bootstrap|print|full)?(?:[\.-]min)?\.js$/i,
    /^(?:datepicker|datetimepicker|wdatepicker|laydate)[.-]?\d*\.?\d*\.?\d*(?:\.min)?\.js$/i,
    /^(?:zh|en|zh-cn|zh-tw|ja|ko)[.-]?\d*\.?\d*\.?\d*(?:\.min)?\.js$/i
];

let vendorJsFilterEnabled = true;
let customVendorRegexes = [];

function isVendorJsUrl(u) {
    try {
        const s = String(u || '').split(/[?#]/)[0];
        const name = s.substring(s.lastIndexOf('/') + 1).toLowerCase();
        if (!name) return false;
        if (SKIP_JS_PATTERNS.some(re => re.test(name))) return true;
        return customVendorRegexes.some(re => re.test(name));
    } catch (e) {
        return false;
    }
}

async function loadVendorJsFilterSettings() {
    try {
        const result = await chrome.storage.local.get(['vendorJsFilterSettings']);
        const s = result.vendorJsFilterSettings || { enabled: true, patterns: [] };
        vendorJsFilterEnabled = s.enabled !== false;
        customVendorRegexes = [];
        for (const line of (s.patterns || [])) {
            const text = String(line || '').trim();
            if (!text) continue;
            try {
                customVendorRegexes.push(new RegExp(text, 'i'));
            } catch (e) {
                customVendorRegexes.push(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
            }
        }
    } catch (e) {
        vendorJsFilterEnabled = true;
        customVendorRegexes = [];
    }
}


class VirtualList {
    constructor(container, {
        itemHeight = 24,
        buffer = 8,
        renderItem = null
    } = {}) {
        this.container = container;
        this.itemHeight = itemHeight;
        this.buffer = buffer;
        this.renderItem = renderItem || ((item) => {
            const div = document.createElement('div');
            div.className = 'vl-item';

            div.style.display = 'block';
            div.style.boxSizing = 'border-box';
            div.style.width = '100%';
            div.style.whiteSpace = 'normal';
            div.style.wordBreak = 'break-word';
            div.style.overflowWrap = 'anywhere';
            div.textContent = String(item);
            return div;
        });


        const cs = window.getComputedStyle(this.container);

        const pos = cs.position;
        if ((pos === 'static' || !pos) && !this.container.style.position) {
            this.container.style.position = 'relative';
        }

        this.container.style.willChange = 'transform';
        this.container.style.transform = this.container.style.transform || 'translateZ(0)';

        this.container.style.contain = this.container.style.contain || 'paint';

        this.scrollParent = this.getScrollParent(this.container) || window;
        this.onScroll = this.onScroll.bind(this);
        const sp = this.scrollParent === window ? window : this.scrollParent;
        sp.addEventListener('scroll', this.onScroll, { passive: true });
        window.addEventListener('resize', () => this.render());


        this.content = document.createElement('div');
        this.content.className = 'vl-content';
        this.content.style.position = 'relative';
        this.content.style.willChange = 'transform';
        this.content.style.width = '100%';
        this.container.innerHTML = '';
        this.container.appendChild(this.content);


        this.slice = document.createElement('div');
        this.slice.className = 'vl-slice';
        this.slice.style.position = 'relative';
        this.slice.style.width = '100%';
        this.content.appendChild(this.slice);

        this.items = [];

        this.heightMap = [];
        this._avgH = this.itemHeight;
        this.minRowHeight = this.itemHeight;
        this.avgCharWidth = 7;

        this.heightMap = [];
        this._avgH = this.itemHeight;
        this.minRowHeight = this.itemHeight;
        this.avgCharWidth = 7;


    }


    getScrollParent(el) {
        let p = el.parentElement;
        while (p && p !== document.body && p !== document.documentElement) {
            const style = window.getComputedStyle(p);
            const oy = style.overflowY;
            if (oy === 'auto' || oy === 'scroll') return p;
            p = p.parentElement;
        }
        return window;
    }

    getOffsetTopRelativeToScrollParent() {
        const spEl = this.scrollParent === window ? (document.scrollingElement || document.documentElement) : this.scrollParent;
        let el = this.container;
        let top = 0;
        while (el && el !== spEl && el.offsetParent) {
            top += el.offsetTop;
            el = el.offsetParent;
        }
        return top;
    }

    setItems(items) {
        this.items = Array.isArray(items) ? items : [];


        if (this.items.length > 0) {
            try {

                this.slice.innerHTML = '';
                const probe = this.renderItem(this.items[0], 0);

                probe.style.display = 'block';
                probe.style.boxSizing = 'border-box';
                probe.style.width = '100%';

                if (!probe.style.height) {
                    probe.style.height = this.itemHeight + 'px';
                    probe.style.lineHeight = this.itemHeight + 'px';
                }
                this.slice.appendChild(probe);
                const h = probe.getBoundingClientRect().height;
                if (h > 0 && Math.abs(h - this.itemHeight) >= 0.5) {
                    this.itemHeight = Math.round(h);
                }
                this.slice.innerHTML = '';
            } catch (e) {

            }
        }


        this.heightMap = new Array(this.items.length).fill(0);
        this._avgH = this.minRowHeight;
        this.content.style.height = 'auto';
        this.content.style.paddingTop = '0px';
        this.content.style.paddingBottom = '0px';
        this.render();
    }

    onScroll() {
        this.render();
    }


    appendItems(newItems) {
        if (!Array.isArray(newItems) || newItems.length === 0) return;
        const startLen = this.items.length;
        this.items.push(...newItems);
        if (!Array.isArray(this.heightMap)) this.heightMap = [];
        for (let i = 0; i < newItems.length; i++) {
            this.heightMap[startLen + i] = 0;
        }

        this.render();
    }

    render() {

        const sp = this.scrollParent === window ? window : this.scrollParent;
        let viewportHeight, scrollTop;
        if (sp === window) {
            viewportHeight = window.innerHeight || document.documentElement.clientHeight || 300;
            scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
        } else {
            viewportHeight = sp.clientHeight || 300;
            scrollTop = sp.scrollTop || 0;
        }
        const containerOffset = this.getOffsetTopRelativeToScrollParent();
        const effectiveScrollTop = Math.max(0, scrollTop - containerOffset);


        const containerWidth = this.container.clientWidth || this.content.clientWidth || 300;


        const estimateHeight = (item) => {
            try {
                const text = String(item ?? '');
                const chars = text.length;
                const lineChars = Math.max(1, Math.floor(containerWidth / this.avgCharWidth));
                const lines = Math.max(1, Math.ceil(chars / lineChars));
                return Math.max(this.minRowHeight, lines * this.minRowHeight);
            } catch {
                return this.minRowHeight;
            }
        };


        const total = this.items.length;
        if (total === 0) {
            this.slice.innerHTML = '';
            this.content.style.paddingTop = '0px';
            this.content.style.paddingBottom = '0px';
            return;
        }

        let topPad = 0;

        const avgH = Math.max(this.minRowHeight, (this._avgH || this.minRowHeight));
        let startIndex = Math.max(0, Math.floor(effectiveScrollTop / avgH) - this.buffer);


        let acc = 0;
        for (let i = 0; i < startIndex; i++) {
            const h = this.heightMap[i] || estimateHeight(this.items[i]);
            acc += h;
        }
        while (startIndex > 0 && acc > effectiveScrollTop) {
            startIndex--;
            acc -= (this.heightMap[startIndex] || estimateHeight(this.items[startIndex]));
        }
        while (startIndex < total && acc + (this.heightMap[startIndex] || estimateHeight(this.items[startIndex])) <= effectiveScrollTop) {
            acc += (this.heightMap[startIndex] || estimateHeight(this.items[startIndex]));
            startIndex++;
        }
        topPad = acc;


        const limit = effectiveScrollTop + viewportHeight + this.buffer * this.minRowHeight;
        let endIndex = startIndex;
        let run = acc;
        while (endIndex < total && run <= limit) {
            run += (this.heightMap[endIndex] || estimateHeight(this.items[endIndex]));
            endIndex++;
        }
        endIndex = Math.min(total, endIndex);


        let bottomPad = 0;
        let remaining = 0;
        for (let i = endIndex; i < total; i++) {
            remaining += (this.heightMap[i] || estimateHeight(this.items[i]));
        }
        const totalEstimated = run + remaining;
        bottomPad = Math.max(0, totalEstimated - run);


        this.content.style.paddingTop = `${topPad}px`;
        this.content.style.paddingBottom = `${bottomPad}px`;


        this.slice.innerHTML = '';
        const frag = document.createDocumentFragment();
        for (let idx = startIndex; idx < endIndex; idx++) {
            const node = this.renderItem(this.items[idx], idx);

            node.style.display = 'block';
            node.style.boxSizing = 'border-box';
            node.style.width = '100%';
            node.style.whiteSpace = node.style.whiteSpace || 'normal';
            node.style.wordBreak = node.style.wordBreak || 'break-word';
            node.style.overflowWrap = node.style.overflowWrap || 'anywhere';
            frag.appendChild(node);
        }
        this.slice.appendChild(frag);


        const children = Array.from(this.slice.children);
        let measuredChanged = false;
        let measuredCount = 0;
        let measuredSum = 0;
        for (let k = 0; k < children.length; k++) {
            const i = startIndex + k;
            const h = Math.round(children[k].getBoundingClientRect().height || this.minRowHeight);
            if (h > 0 && h !== this.heightMap[i]) {
                this.heightMap[i] = h;
                measuredChanged = true;
            }
            if (h > 0) {
                measuredSum += h;
                measuredCount++;
            }
        }
        if (measuredChanged) {
            const countMeasured = this.heightMap.filter(Boolean).length;
            if (countMeasured > 0) {
                const sum = this.heightMap.reduce((s, v) => s + (v || 0), 0);
                this._avgH = Math.max(this.minRowHeight, Math.round(sum / countMeasured));
            } else if (measuredCount > 0) {
                this._avgH = Math.max(this.minRowHeight, Math.round(measuredSum / measuredCount));
            }

            requestAnimationFrame(() => this.render());
        }
    }
}


const __virtualLists = new Map();

const __renderedTextCache = {};
const __lastRenderedCounts = {};


function getVirtualList(elementId, options = {}) {
    const key = elementId;
    if (__virtualLists.has(key)) return __virtualLists.get(key);
    const el = document.getElementById(elementId);
    if (!el) return null;
    const vl = new VirtualList(el, options);
    __virtualLists.set(key, vl);
    return vl;
}


function updateVirtualList(elementId, items, options = {}) {
    const vl = getVirtualList(elementId, options);
    if (!vl) return;
    vl.setItems(items || []);
}


function updateVirtualListAppend(elementId, newItems, options = {}) {
    let vl = getVirtualList(elementId);
    if (!vl) {

        vl = getVirtualList(elementId, options);
        if (!vl) return;
        vl.setItems(newItems || []);
        return;
    }
    if (newItems && newItems.length) {
        vl.appendItems(newItems);
    }
}




function performMemoryCleanup() {

    if (urlContentCache.size > 20) {
        const entries = Array.from(urlContentCache.entries());
        const toKeep = entries.slice(-20);
        urlContentCache.clear();
        toKeep.forEach(([key, value]) => urlContentCache.set(key, value));
    }


    if (logBuffer && logBuffer.length > 0) {
        flushLogBuffer();
    }


    Object.keys(pendingResults).forEach(key => {
        if (pendingResults[key] && pendingResults[key].size > 500) {

            flushPendingResults();
        }
    });


    if (window.gc) {
        window.gc();
    }
}


function startMemoryCleanup() {
    if (memoryCleanupTimer) {
        clearInterval(memoryCleanupTimer);
    }
    memoryCleanupTimer = setInterval(performMemoryCleanup, MEMORY_CLEANUP_INTERVAL);
}


function stopMemoryCleanup() {
    if (memoryCleanupTimer) {
        clearInterval(memoryCleanupTimer);
        memoryCleanupTimer = null;
    }
}

function convertRelativeToAbsolute(relativePath) {
    try {
        const base = scanConfig?.baseUrl || window.location.origin;
        return new URL(relativePath, base).href;
    } catch {
        return relativePath;
    }
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        const url = (typeof chrome !== 'undefined' && chrome.runtime?.getURL) ? chrome.runtime.getURL(src) : src;
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}


async function loadFilters() {


    try {

        if (typeof window.SettingsManager === 'undefined') {
            await loadScript('src/utils/SettingsManager.js');
        }


        if (typeof window.PatternExtractor === 'undefined') {
            await loadScript('src/scanner/PatternExtractor.js');
        }


        try {
            if (typeof window.VueDetector === 'undefined') {
                await loadScript('src/scanner/vue/utils/serializer.js');
                await loadScript('src/scanner/vue/utils/pathUtils.js');
                await loadScript('src/scanner/vue/VueFinder.js');
                await loadScript('src/scanner/vue/RouterAnalyzer.js');
                await loadScript('src/scanner/vue/GuardPatcher.js');
                await loadScript('src/scanner/vue/VueDetector.js');
                await loadScript('src/scanner/vue/VueDetectorBridge.js');
                await loadScript('src/scanner/vue/index.js');
                console.log(' [Vue] Vue detection module loaded');
            }
        } catch (vueErr) {
            console.warn(' [Vue] Vue detection module failed to load:', vueErr);
        }


        try {
            if (typeof window.WebpackScannerBridge === 'undefined') {
                await loadScript('src/scanner/webpack/utils/patternUtils.js');
                await loadScript('src/scanner/webpack/utils/urlUtils.js');
                await loadScript('src/scanner/webpack/WebpackDetector.js');
                await loadScript('src/scanner/webpack/ChunkAnalyzer.js');
                await loadScript('src/scanner/webpack/SourceMapParser.js');
                await loadScript('src/scanner/webpack/RuntimeAnalyzer.js');
                await loadScript('src/scanner/webpack/ModuleAnalyzer.js');
                await loadScript('src/scanner/webpack/WebpackScannerBridge.js');
                await loadScript('src/scanner/webpack/WebpackResultRenderer.js');
                await loadScript('src/scanner/webpack/index.js');
                console.log(' [Webpack] Webpack scanner module loaded');
            }
        } catch (webpackErr) {
            console.warn(' [Webpack] Webpack scanner module failed to load:', webpackErr);
        }


        await new Promise(r => setTimeout(r, 100));


        if (typeof window.PatternExtractor === 'undefined') {
            throw new Error('PatternExtractor did not load successfully');
        }
        patternExtractor = new window.PatternExtractor();


        if (typeof patternExtractor.ensureCustomPatternsLoaded === 'function') {
            patternExtractor.ensureCustomPatternsLoaded();
        }


        window.addEventListener('regexConfigUpdated', (e) => {

            if (patternExtractor?.updatePatterns) {
                patternExtractor.updatePatterns(e.detail);
            } else if (patternExtractor?.loadCustomPatterns) {
                patternExtractor.loadCustomPatterns(e.detail);
            }
        });

        filtersLoaded = true;

    } catch (err) {
        console.error(' [DEBUG] Failed to load filters:', err);
        filtersLoaded = false;
    }
}



async function extractFromSourceMap(content, sourceUrl) {
    console.log(' [SourceMap] Parsing Source Map:', sourceUrl.substring(0, 80));

    let results = {
        absoluteApis: [],
        relativeApis: [],
        domains: [],
        urls: [],
        jsFiles: [],
        vueFiles: [],
        emails: [],
        sensitiveKeywords: [],
        credentials: [],
        paths: [],
        sourceMapSources: []
    };

    try {

        let sourceMap;
        try {
            sourceMap = JSON.parse(content);
        } catch (e) {
            console.warn(' [SourceMap] JSON Parse failed, falling back to plain text');

            return await patternExtractor.extractPatterns(content, sourceUrl);
        }


        if (!sourceMap || sourceMap.version !== 3) {
            console.warn(' [SourceMap] is not a valid Source Map v3');
            return results;
        }

        console.log(` [SourceMap] Found ${sourceMap.sources?.length || 0} source files`);


        if (sourceMap.sources && Array.isArray(sourceMap.sources)) {
            for (const sourcePath of sourceMap.sources) {
                if (sourcePath) {
                    results.sourceMapSources.push({
                        value: sourcePath,
                        sourceUrl: sourceUrl,
                        extractedAt: new Date().toISOString()
                    });


                    if (sourcePath.endsWith('.vue')) {
                        results.vueFiles.push({
                            value: sourcePath,
                            sourceUrl: sourceUrl,
                            type: 'sourcemap-source',
                            extractedAt: new Date().toISOString()
                        });
                    }
                }
            }
        }


        if (sourceMap.sourcesContent && Array.isArray(sourceMap.sourcesContent)) {
            console.log(` [SourceMap] Start Scan ${sourceMap.sourcesContent.length} source file contents`);

            for (let i = 0; i < sourceMap.sourcesContent.length; i++) {
                const sourceContent = sourceMap.sourcesContent[i];
                const sourcePath = sourceMap.sources?.[i] || `source_${i}`;

                if (!sourceContent || typeof sourceContent !== 'string') {
                    continue;
                }


                if (sourceContent.length < 50) {
                    continue;
                }

                try {

                    let sourceResults;


                    if (sourcePath.endsWith('.vue')) {

                        sourceResults = await extractFromVueFile(sourceContent, sourcePath);
                    } else {

                        sourceResults = await patternExtractor.extractPatterns(sourceContent, sourcePath);


                        const isJsLike = sourcePath.endsWith('.js') ||
                                         sourcePath.endsWith('.ts') ||
                                         sourcePath.endsWith('.jsx') ||
                                         sourcePath.endsWith('.tsx');

                        if (isJsLike && window.astBridge && window.astBridge.isAvailable()) {
                            try {
                                const astResult = window.astBridge.extract(sourceContent, sourcePath);
                                if (astResult.success && astResult.detections?.length > 0) {
                                    sourceResults = mergeASTResults(sourceResults, astResult.detections, sourcePath);
                                }
                            } catch (astError) {

                            }
                        }
                    }


                    if (sourceResults) {
                        mergeExtractedResults(results, sourceResults);
                    }

                } catch (extractError) {
                    console.warn(` [SourceMap] Extracted source file ${sourcePath} Failed:`, extractError.message);
                }
            }
        }

        console.log(` [SourceMap] parse complete, extracted ${countResults(results)} data items`);

    } catch (error) {
        console.error(' [SourceMap] Parse failed:', error);
    }

    return results;
}



async function extractFromVueFile(content, sourceUrl) {
    console.log(' [Vue] Parsing Vue file:', sourceUrl.substring(0, 80));

    let results = {
        absoluteApis: [],
        relativeApis: [],
        domains: [],
        urls: [],
        jsFiles: [],
        vueFiles: [],
        vueRoutes: [],
        emails: [],
        sensitiveKeywords: [],
        credentials: [],
        paths: [],
        comments: []
    };

    try {

        const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
        if (scriptMatch) {
            for (const scriptBlock of scriptMatch) {

                const scriptContent = scriptBlock
                    .replace(/<script[^>]*>/i, '')
                    .replace(/<\/script>/i, '');

                if (scriptContent.trim().length > 10) {

                    const scriptResults = await patternExtractor.extractPatterns(scriptContent, sourceUrl);
                    mergeExtractedResults(results, scriptResults);


                    if (window.astBridge && window.astBridge.isAvailable()) {
                        try {
                            const astResult = window.astBridge.extract(scriptContent, sourceUrl);
                            if (astResult.success && astResult.detections?.length > 0) {
                                results = mergeASTResults(results, astResult.detections, sourceUrl);
                            }
                        } catch (astError) {

                        }
                    }
                }
            }
        }


        const templateMatch = content.match(/<template[^>]*>([\s\S]*?)<\/template>/gi);
        if (templateMatch) {
            for (const templateBlock of templateMatch) {
                const templateContent = templateBlock
                    .replace(/<template[^>]*>/i, '')
                    .replace(/<\/template>/i, '');


                const urlPatterns = [
                    /(?:href|src|:href|:src|v-bind:href|v-bind:src)=["']([^"']+)["']/gi,
                    /(?:to|:to|v-bind:to)=["']([^"']+)["']/gi,
                    /(?:url|:url)=["']([^"']+)["']/gi,
                    /@click=["'][^"']*(?:push|replace)\s*\(\s*['"]([^'"]+)['"]/gi
                ];

                for (const pattern of urlPatterns) {
                    let match;
                    while ((match = pattern.exec(templateContent)) !== null) {
                        const url = match[1];
                        if (url && !url.startsWith('{{') && !url.startsWith('#')) {
                            if (url.startsWith('http://') || url.startsWith('https://')) {
                                results.urls.push({
                                    value: url,
                                    sourceUrl: sourceUrl,
                                    type: 'vue-template',
                                    extractedAt: new Date().toISOString()
                                });
                            } else if (url.startsWith('/')) {

                                results.vueRoutes.push({
                                    value: url,
                                    path: url,
                                    sourceUrl: sourceUrl,
                                    source: 'vue-template',
                                    extractedAt: new Date().toISOString()
                                });
                            }
                        }
                    }
                }


                const apiPatterns = [
                    /(?:\$http|\$axios|axios|fetch)\s*\.\s*(?:get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
                    /(?:api|API)\.([a-zA-Z_][a-zA-Z0-9_]*)/gi
                ];

                for (const pattern of apiPatterns) {
                    let match;
                    while ((match = pattern.exec(templateContent)) !== null) {
                        const api = match[1];
                        if (api) {
                            if (api.startsWith('/')) {
                                results.relativeApis.push({
                                    value: api,
                                    sourceUrl: sourceUrl,
                                    type: 'vue-template',
                                    extractedAt: new Date().toISOString()
                                });
                            }
                        }
                    }
                }
            }
        }


        const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
        if (styleMatch) {
            for (const styleBlock of styleMatch) {
                const styleContent = styleBlock
                    .replace(/<style[^>]*>/i, '')
                    .replace(/<\/style>/i, '');


                const urlPattern = /url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
                let match;
                while ((match = urlPattern.exec(styleContent)) !== null) {
                    const url = match[1];
                    if (url && !url.startsWith('data:')) {
                        results.urls.push({
                            value: url,
                            sourceUrl: sourceUrl,
                            type: 'vue-style',
                            extractedAt: new Date().toISOString()
                        });
                    }
                }
            }
        }


        const commentPatterns = [
            /<!--([\s\S]*?)-->/g,
            /\/\*[\s\S]*?\*\//g,
            /\/\/[^\n]*/g
        ];

        for (const pattern of commentPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const comment = match[0];

                if (comment.length > 10 && comment.length < 500) {
                    const sensitivePatterns = [
                        /TODO|FIXME|HACK|XXX|BUG/i,
                        /password|secret|key|token|api/i,
                        /http[s]?:\/\//i
                    ];

                    if (sensitivePatterns.some(p => p.test(comment))) {
                        results.comments.push({
                            value: comment.substring(0, 200),
                            sourceUrl: sourceUrl,
                            type: 'vue-comment',
                            extractedAt: new Date().toISOString()
                        });
                    }
                }
            }
        }

        console.log(` [Vue] parse complete, extracted ${countResults(results)} data items`);

    } catch (error) {
        console.error(' [Vue] Parse failed:', error);

        try {
            results = await patternExtractor.extractPatterns(content, sourceUrl);
        } catch (e) {

        }
    }

    return results;
}



function mergeExtractedResults(target, source) {
    if (!source) return;

    for (const key of Object.keys(source)) {
        if (Array.isArray(source[key]) && source[key].length > 0) {
            if (!target[key]) {
                target[key] = [];
            }


            const existingValues = new Set(target[key].map(item =>
                typeof item === 'object' ? item.value : item
            ));

            for (const item of source[key]) {
                const value = typeof item === 'object' ? item.value : item;
                if (!existingValues.has(value)) {
                    target[key].push(item);
                    existingValues.add(value);
                }
            }
        }
    }
}


function countResults(results) {
    if (!results) return 0;
    return Object.values(results).reduce((sum, arr) =>
        sum + (Array.isArray(arr) ? arr.length : 0), 0
    );
}



async function extractFromContentChunked(content, sourceUrl, chunkSize, maxTotalSize) {

    const mergedResults = {
        absoluteApis: new Set(),
        relativeApis: new Set(),
        jsFiles: new Set(),
        cssFiles: new Set(),
        images: new Set(),
        urls: new Set(),
        domains: new Set(),
        emails: new Set(),
        phoneNumbers: new Set(),
        credentials: new Set(),
        ipAddresses: new Set(),
        paths: new Set(),
        jwts: new Set(),
        githubUrls: new Set(),
        vueFiles: new Set(),
        vueRoutes: new Set(),
        companies: new Set(),
        comments: new Set(),
        idCards: new Set(),
        bearerTokens: new Set(),
        basicAuth: new Set(),
        authHeaders: new Set(),
        wechatAppIds: new Set(),
        awsKeys: new Set(),
        googleApiKeys: new Set(),
        githubTokens: new Set(),
        gitlabTokens: new Set(),
        webhookUrls: new Set(),
        cryptoUsage: new Set()
    };


    const contentToProcess = content.length > maxTotalSize ? content.substring(0, maxTotalSize) : content;
    const totalChunks = Math.ceil(contentToProcess.length / chunkSize);

    console.log(` [Chunking] Total size: ${Math.round(contentToProcess.length/1024)}KB, ${totalChunks} chunks`);


    for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;

        let end = Math.min(start + chunkSize, contentToProcess.length);

        if (end < contentToProcess.length) {

            const searchEnd = Math.min(end + 1000, contentToProcess.length);
            const searchRange = contentToProcess.substring(end, searchEnd);

            const newlineIndex = searchRange.indexOf('\n');
            const semicolonIndex = searchRange.indexOf(';');

            if (newlineIndex !== -1 && newlineIndex < 500) {
                end += newlineIndex + 1;
            } else if (semicolonIndex !== -1 && semicolonIndex < 500) {
                end += semicolonIndex + 1;
            }
        }

        const chunk = contentToProcess.substring(start, end);

        try {

            const chunkResults = await patternExtractor.extractPatterns(chunk, sourceUrl);


            if (chunkResults) {
                Object.keys(chunkResults).forEach(key => {
                    if (Array.isArray(chunkResults[key]) && chunkResults[key].length > 0) {
                        if (!mergedResults[key]) {
                            mergedResults[key] = new Set();
                        }

                        chunkResults[key].forEach(item => {
                            const value = typeof item === 'object' ? item.value : item;
                            if (value) {

                                if (typeof item === 'object') {

                                    let exists = false;
                                    for (const existing of mergedResults[key]) {
                                        const existingValue = typeof existing === 'object' ? existing.value : existing;
                                        if (existingValue === value) {
                                            exists = true;
                                            break;
                                        }
                                    }
                                    if (!exists) {
                                        mergedResults[key].add(item);
                                    }
                                } else {
                                    mergedResults[key].add(item);
                                }
                            }
                        });
                    }
                });
            }


            if (i < totalChunks - 1) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }

        } catch (error) {
            console.warn(` [Chunking] chunk ${i+1} failed:`, error.message);
        }
    }


    const finalResults = {};
    Object.keys(mergedResults).forEach(key => {
        if (mergedResults[key] instanceof Set) {
            finalResults[key] = Array.from(mergedResults[key]);
        } else if (Array.isArray(mergedResults[key])) {
            finalResults[key] = mergedResults[key];
        } else {
            finalResults[key] = [];
        }
    });

    console.log(` [Chunking] complete, extracted ${countResults(finalResults)} data items`);

    return finalResults;
}


async function extractFromContent(content, sourceUrl = 'unknown') {
    if (!patternExtractor || typeof patternExtractor.extractPatterns !== 'function') {
        throw new Error('PatternExtractor.extractPatterns unavailable');
    }


    if (typeof patternExtractor.ensureCustomPatternsLoaded === 'function') {
        await patternExtractor.ensureCustomPatternsLoaded();
    }


    const specialFileType = getSpecialFileType(sourceUrl);


    if (specialFileType === 'sourcemap') {
        return await extractFromSourceMap(content, sourceUrl);
    }


    if (specialFileType === 'vue') {
        return await extractFromVueFile(content, sourceUrl);
    }


    const CHUNK_SIZE = 200000;
    const MAX_TOTAL_SIZE = 1000000;

    let results;

    if (content.length > CHUNK_SIZE) {

        console.log(` [Chunking] File size ${Math.round(content.length/1024)}KB, enabling chunked processing`);
        results = await extractFromContentChunked(content, sourceUrl, CHUNK_SIZE, MAX_TOTAL_SIZE);
    } else {

        results = await patternExtractor.extractPatterns(content, sourceUrl);
    }


    const astMaxSize = 100000;
    const shouldTryAST = content.length < astMaxSize;


    const isJsFile = shouldTryAST && (
                     sourceUrl.endsWith('.js') ||
                     sourceUrl.includes('.js?') ||
                     specialFileType === 'typescript');


    const astAvailable = window.astBridge && window.astBridge.isAvailable();

    if (isJsFile && astAvailable) {
        try {
            const astResult = window.astBridge.extract(content, sourceUrl);

            if (astResult.success && astResult.detections && astResult.detections.length > 0) {
                results = mergeASTResults(results, astResult.detections, sourceUrl);
            }
        } catch (error) {

        }
    }


    await enhanceRelativePathsWithIndexedDB(results, sourceUrl);



    if (!results.vueRoutes) {
        results.vueRoutes = [];
    }


    if (typeof window.RouterAnalyzer !== 'undefined' && window.RouterAnalyzer.extractRoutesFromCode) {
        try {
            const staticRoutes = window.RouterAnalyzer.extractRoutesFromCode(content, sourceUrl);

            if (staticRoutes && staticRoutes.length > 0) {
                console.log(` [Vue] Statically extracted from code: ${staticRoutes.length} routes`);

                staticRoutes.forEach(route => {
                    const routePath = route.path || route.fullPath || '';
                    const fullUrl = route.fullUrl || '';


                    const displayValue = fullUrl || routePath;


                    const isDuplicate = results.vueRoutes.some(r => {
                        const existingPath = r.path || r.value;
                        const existingFullUrl = r.fullUrl || '';

                        return existingPath === routePath || (fullUrl && existingFullUrl === fullUrl);
                    });

                    if (routePath && !isDuplicate) {
                        const vueRoute = {
                            value: displayValue,
                            path: routePath,
                            fullUrl: fullUrl,
                            name: route.name || '',
                            meta: route.meta || {},
                            sourceUrl: sourceUrl,
                            source: 'static-analysis',
                            extractedAt: new Date().toISOString()
                        };

                        results.vueRoutes.push(vueRoute);


                        if (fullUrl && fullUrl.startsWith('http')) {
                            if (!results.urls) {
                                results.urls = [];
                            }

                            if (!results.urls.some(u => (typeof u === 'object' ? u.value : u) === fullUrl)) {
                                results.urls.push({
                                    value: fullUrl,
                                    sourceUrl: sourceUrl,
                                    type: 'vue-route',
                                    extractedAt: new Date().toISOString()
                                });
                                console.log(` [Vue] Added routes to the deep scan queue: ${fullUrl}`);
                            }
                        }
                    }
                });

                console.log(` [Vue] Static route analysis stats: ${results.vueRoutes.length} routes`);
            }
        } catch (staticError) {
            console.warn(' [Vue] Static route analysis failed:', staticError.message);
        }
    }


    if (typeof window.VueDetectorBridge !== 'undefined') {
        try {
            const vueBridge = new window.VueDetectorBridge();
            const vueResult = await vueBridge.detect();

            if (vueResult && vueResult.detected) {
                console.log(' [Vue] Vue Runtime detection succeeded:', vueResult.framework);


                if (vueResult.routes && Array.isArray(vueResult.routes)) {
                    vueResult.routes.forEach(route => {
                        const routePath = route.path || route.fullPath || '';
                        if (!routePath) return;


                        let fullUrl = '';
                        try {
                            const urlObj = new URL(sourceUrl);


                            let basePath = urlObj.pathname;


                            if (/\.(js|html|css|json|vue)(\?.*)?$/i.test(basePath)) {
                                basePath = basePath.substring(0, basePath.lastIndexOf('/') + 1);
                            }


                            const assetDirs = ['assets', 'dist', 'js', 'css', 'static', 'build', 'public'];
                            const pathParts = basePath.split('/').filter(Boolean);

                            while (pathParts.length > 0) {
                                const lastPart = pathParts[pathParts.length - 1].toLowerCase();
                                if (assetDirs.includes(lastPart)) {
                                    pathParts.pop();
                                } else {
                                    break;
                                }
                            }

                            basePath = '/' + pathParts.join('/');
                            if (!basePath.endsWith('/')) {
                                basePath += '/';
                            }

                            if (routePath.startsWith('#')) {
                                fullUrl = `${urlObj.origin}${basePath}${routePath}`;
                            } else {

                                fullUrl = `${urlObj.origin}${basePath}#${routePath}`;
                            }
                        } catch (e) {
                            fullUrl = routePath;
                        }


                        const isDuplicate = results.vueRoutes.some(r => {
                            const existingPath = r.path || r.value;
                            const existingFullUrl = r.fullUrl || '';
                            return existingPath === routePath || (fullUrl && existingFullUrl === fullUrl);
                        });

                        if (isDuplicate) return;

                        const vueRoute = {
                            value: fullUrl || routePath,
                            path: routePath,
                            fullUrl: fullUrl,
                            name: route.name || '',
                            meta: route.meta || {},
                            sourceUrl: sourceUrl,
                            source: 'runtime',
                            extractedAt: new Date().toISOString()
                        };

                        results.vueRoutes.push(vueRoute);


                        if (fullUrl && fullUrl.startsWith('http')) {
                            if (!results.urls) {
                                results.urls = [];
                            }

                            if (!results.urls.some(u => (typeof u === 'object' ? u.value : u) === fullUrl)) {
                                results.urls.push({
                                    value: fullUrl,
                                    sourceUrl: sourceUrl,
                                    type: 'vue-route-runtime',
                                    extractedAt: new Date().toISOString()
                                });
                                console.log(` [Vue] Added runtime routes to the deep scan queue: ${fullUrl}`);
                            }
                        }
                    });
                }

                results.vueDetection = {
                    detected: true,
                    framework: vueResult.framework,
                    routeCount: vueResult.routes?.length || 0,
                    modifiedRoutes: vueResult.modifiedRoutes || []
                };

                console.log(` [Vue] Runtime route stats: ${results.vueRoutes.length} routes`);
            }
        } catch (vueError) {
            console.warn(' [Vue] Vue Runtime detection failed:', vueError.message);
        }
    }

    return results;
}


function mergeASTResults(regexResults, astDetections, sourceUrl) {
    const merged = { ...regexResults };


    const allExistingValues = new Set();
    Object.values(merged).forEach(arr => {
        if (Array.isArray(arr)) {
            arr.forEach(item => {
                const v = typeof item === 'object' ? item.value : item;
                if (v) allExistingValues.add(v);
            });
        }
    });

    for (const detection of astDetections) {

        const value = detection.value;
        if (!value) continue;

        let resultKey;

        if (detection.type === 'api_endpoint') {
            if (patternExtractor && typeof patternExtractor.isJunkApiEndpoint === 'function' && patternExtractor.isJunkApiEndpoint(value)) {
                continue;
            }
            if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('//')) {
                resultKey = 'absoluteApis';
            } else if (value.startsWith('/')) {
                resultKey = 'relativeApis';
            } else {
                resultKey = 'absoluteApis';
            }
        } else if (detection.type === 'credential') {
            if (patternExtractor && typeof patternExtractor.isJunkCredentialValue === 'function' && patternExtractor.isJunkCredentialValue(value)) {
                continue;
            }
            resultKey = 'credentials';
        } else {
            continue;
        }

        if (!merged[resultKey]) {
            merged[resultKey] = [];
        }


        if (allExistingValues.has(value)) {
            continue;
        }


        const exists = merged[resultKey].some(item =>
            (typeof item === 'object' ? item.value : item) === value
        );

        if (!exists) {
            merged[resultKey].push({
                value: value,
                sourceUrl: sourceUrl,
                extractedAt: new Date().toISOString(),
                pageTitle: document.title || 'Deep Scan',
                confidence: detection.confidence || 0.8,
                context: detection.context,
                source: 'ast'
            });
            allExistingValues.add(value);
        }
    }

    return merged;
}


async function enhanceRelativePathsWithIndexedDB(results, currentSourceUrl) {


    if (!results.relativeApis || results.relativeApis.length === 0) {

        return;
    }

    try {

        const baseUrl = scanConfig?.baseUrl || window.location.origin;
        console.log(' [DEBUG] Base URL:', baseUrl);


        let allScanData = [];


        try {
            const currentScanData = await window.IndexedDBManager.loadScanResults(baseUrl);
            if (currentScanData && currentScanData.results) {
                allScanData.push(currentScanData);
                console.log(' [DEBUG] Retrieved scan results for the current domain');
            }
        } catch (e) {
            console.warn(' Failed to get scan results for the current domain:', e);
        }


        try {
            const allResults = await window.IndexedDBManager.getAllScanResults();
            if (allResults && Array.isArray(allResults)) {
                allScanData = allScanData.concat(allResults);
                console.log(' [DEBUG] Retrieved all scan results, total', allResults.length);
            }
        } catch (e) {
            console.warn(' Failed to get all scan results:', e);
        }

        if (allScanData.length === 0) {
            console.log(' No IndexedDB data found, falling back to plain URL joining');
            return;
        }


        const sourceUrlToBasePath = new Map();
        const itemToSourceUrlMap = new Map();

        console.log(' [DEBUG] Analysing IndexedDB data, total', allScanData.length, 'data sources');


        allScanData.forEach((scanData, dataIndex) => {
            if (!scanData.results) return;









            Object.entries(scanData.results).forEach(([category, items]) => {
                if (!Array.isArray(items)) return;

                items.forEach(item => {
                    if (typeof item === 'object' && item !== null && item.sourceUrl) {

                        const itemSourceUrl = item.sourceUrl;
                        const itemValue = item.value || item.text || item.content;

                        if (itemValue && itemSourceUrl) {
                            try {
                                const sourceUrlObj = new URL(itemSourceUrl);

                                const basePath = sourceUrlObj.pathname.substring(0, sourceUrlObj.pathname.lastIndexOf('/') + 1);
                                const fullBasePath = `${sourceUrlObj.protocol}//${sourceUrlObj.host}${basePath}`;

                                sourceUrlToBasePath.set(itemSourceUrl, fullBasePath);
                                itemToSourceUrlMap.set(itemValue, itemSourceUrl);


                            } catch (e) {

                            }
                        }
                    } else if (typeof item === 'string') {

                        const fallbackSourceUrl = scanData.sourceUrl || scanData.url;
                        if (fallbackSourceUrl) {
                            try {
                                const sourceUrlObj = new URL(fallbackSourceUrl);
                                const basePath = sourceUrlObj.pathname.substring(0, sourceUrlObj.pathname.lastIndexOf('/') + 1);
                                const fullBasePath = `${sourceUrlObj.protocol}//${sourceUrlObj.host}${basePath}`;

                                sourceUrlToBasePath.set(fallbackSourceUrl, fullBasePath);
                                itemToSourceUrlMap.set(item, fallbackSourceUrl);

                                console.log(` [DEBUG] Fallback mapping: "${item}" -> "${fallbackSourceUrl}" -> "${fullBasePath}"`);
                            } catch (e) {
                                console.warn(' Invalid fallback sourceUrl:', fallbackSourceUrl, e);
                            }
                        }
                    }
                });
            });
        });

        console.log(' [DEBUG] Mapping built:', {
            sourceUrlToBasePath: sourceUrlToBasePath.size,
            itemToSourceUrlMap: itemToSourceUrlMap.size
        });


        const enhancedRelativeApis = [];

        for (const apiItem of results.relativeApis) {
            const apiValue = typeof apiItem === 'object' ? apiItem.value : apiItem;

            if (String(apiValue ?? '').trim() === '/') {
                console.log(' [Filter] Skipping invalid relative path "/"');
                continue;
            }
            let apiSourceUrl = typeof apiItem === 'object' ? apiItem.sourceUrl : currentSourceUrl;



            let resolvedUrl = null;
            let usedSourceUrl = null;


            if (itemToSourceUrlMap.has(apiValue)) {
                const exactSourceUrl = itemToSourceUrlMap.get(apiValue);
                if (sourceUrlToBasePath.has(exactSourceUrl)) {
                    const basePath = sourceUrlToBasePath.get(exactSourceUrl);
                    resolvedUrl = resolveRelativePath(apiValue, basePath);
                    usedSourceUrl = exactSourceUrl;
                    console.log(' [Exact match] Found the exact source of the item:', apiValue, '->', resolvedUrl, '(src:', exactSourceUrl, ')');
                }
            }


            if (!resolvedUrl && apiSourceUrl && sourceUrlToBasePath.has(apiSourceUrl)) {
                const basePath = sourceUrlToBasePath.get(apiSourceUrl);
                resolvedUrl = resolveRelativePath(apiValue, basePath);
                usedSourceUrl = apiSourceUrl;
                console.log(' [Direct match] Using the API item sourceUrl:', apiValue, '->', resolvedUrl, '(src:', apiSourceUrl, ')');
            }


            if (!resolvedUrl && sourceUrlToBasePath.size > 0) {
                const targetDomain = baseUrl ? new URL(baseUrl).hostname : null;

                for (const [sourceUrl, basePath] of sourceUrlToBasePath.entries()) {
                    try {
                        const sourceDomain = new URL(sourceUrl).hostname;
                        if (targetDomain && sourceDomain === targetDomain) {
                            const testUrl = resolveRelativePath(apiValue, basePath);
                            if (testUrl) {
                                resolvedUrl = testUrl;
                                usedSourceUrl = sourceUrl;

                                break;
                            }
                        }
                    } catch (e) {

                    }
                }
            }


            if (!resolvedUrl) {
                try {
                    if (apiValue.startsWith('./')) {
                        resolvedUrl = baseUrl + apiValue.substring(1);
                    } else if (apiValue.startsWith('../')) {

                        const upLevels = (apiValue.match(/\.\.\//g) || []).length;
                        const remainingPath = apiValue.replace(/\.\.\//g, '');
                        const baseUrlObj = new URL(baseUrl);
                        const pathParts = baseUrlObj.pathname.split('/').filter(p => p);


                        for (let i = 0; i < upLevels && pathParts.length > 0; i++) {
                            pathParts.pop();
                        }

                        resolvedUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}/${pathParts.join('/')}${pathParts.length > 0 ? '/' : ''}${remainingPath}`;
                    } else if (!apiValue.startsWith('/') && !apiValue.startsWith('http')) {
                        resolvedUrl = baseUrl + '/' + apiValue;
                    } else {
                        resolvedUrl = apiValue;
                    }


                    resolvedUrl = resolvedUrl.replace(/\/+/g, '/').replace(':/', '://');
                    usedSourceUrl = baseUrl;

                    console.log(' [Fallback resolve] Joining with the base URL:', apiValue, '->', resolvedUrl);
                } catch (e) {
                    resolvedUrl = apiValue;
                    usedSourceUrl = currentSourceUrl;
                    console.warn(' [Parse failed] Keeping the original value:', apiValue, e.message);
                }
            }


            if (typeof apiItem === 'object') {
                enhancedRelativeApis.push({
                    ...apiItem,
                    resolvedUrl: resolvedUrl,
                    actualSourceUrl: usedSourceUrl || apiItem.sourceUrl
                });
            } else {
                enhancedRelativeApis.push({
                    value: apiItem,
                    sourceUrl: usedSourceUrl || currentSourceUrl,
                    resolvedUrl: resolvedUrl,
                    actualSourceUrl: usedSourceUrl
                });
            }
        }


        results.relativeApis = enhancedRelativeApis;

        console.log(' [Smart Resolve] Relative path resolution complete, processed', enhancedRelativeApis.length, 'relative paths');
        console.log(' [Smart Resolve] Resolution stats:', {
            Total: enhancedRelativeApis.length,
            resolved: enhancedRelativeApis.filter(item => item.resolvedUrl && item.resolvedUrl !== item.value).length,
            usedIndexedDBData: enhancedRelativeApis.filter(item => item.actualSourceUrl && item.actualSourceUrl !== currentSourceUrl).length
        });

    } catch (error) {
        console.error(' Smart relative path resolution failed:', error);

    }
}


function resolveRelativePath(relativePath, basePath) {
    try {
        if (!relativePath || !basePath) {
            console.warn(' Invalid relative path resolution parameters:', { relativePath, basePath });
            return null;
        }

        console.log(` [Resolve] Resolving relative path: "${relativePath}" based on "${basePath}"`);


        if (!basePath.endsWith('/')) {
            basePath += '/';
        }

        let resolvedPath;

        if (relativePath.startsWith('./')) {

            resolvedPath = basePath + relativePath.substring(2);
            console.log(` [Resolve] Current-directory resolve: "${relativePath}" -> "${resolvedPath}"`);
        } else if (relativePath.startsWith('../')) {

            const upLevels = (relativePath.match(/\.\.\//g) || []).length;
            const remainingPath = relativePath.replace(/\.\.\//g, '');

            console.log(` [Resolve] Parent-directory resolve: up ${upLevels} levels, remaining path: "${remainingPath}"`);

            try {
                const baseUrlObj = new URL(basePath);
                const pathParts = baseUrlObj.pathname.split('/').filter(p => p);

                console.log(` [Resolve] Base path segments:`, pathParts);


                for (let i = 0; i < upLevels && pathParts.length > 0; i++) {
                    pathParts.pop();
                }

                console.log(` [Resolve] Path segments after moving up:`, pathParts);

                resolvedPath = `${baseUrlObj.protocol}//${baseUrlObj.host}/${pathParts.join('/')}${pathParts.length > 0 ? '/' : ''}${remainingPath}`;
                console.log(` [Resolve] Parent-directory final resolve: "${relativePath}" -> "${resolvedPath}"`);
            } catch (e) {
                console.warn(' Parent-directory resolve failed, using the simple method:', e);

                const baseUrl = basePath.split('/').slice(0, 3).join('/');
                resolvedPath = baseUrl + '/' + remainingPath;
            }
        } else if (!relativePath.startsWith('/') && !relativePath.startsWith('http')) {

            resolvedPath = basePath + relativePath;
            console.log(` [Resolve] Relative path resolve: "${relativePath}" -> "${resolvedPath}"`);
        } else {

            resolvedPath = relativePath;
            console.log(` [Resolve] already an absolute path: "${relativePath}"`);
        }


        const cleanedPath = resolvedPath.replace(/\/+/g, '/').replace(':/', '://');

        if (cleanedPath !== resolvedPath) {
            console.log(` [Resolve] Path cleanup: "${resolvedPath}" -> "${cleanedPath}"`);
        }

        console.log(` [Resolve] Relative path resolution complete: "${relativePath}" -> "${cleanedPath}"`);
        return cleanedPath;

    } catch (error) {
        console.warn(' Relative path resolution failed:', error, { relativePath, basePath });
        return null;
    }
}


function convertRelativeApisToAbsolute(results) {










}



function throttledUpdateDisplay() {
    const now = Date.now();
    if (now - lastUpdateTime < UPDATE_THROTTLE) {

        if (updateTimer) {
            clearTimeout(updateTimer);
        }
        updateTimer = setTimeout(() => {
            performDisplayUpdate();
        }, UPDATE_THROTTLE);
        return;
    }

    performDisplayUpdate();
}


function performDisplayUpdate() {
    if (isUpdating) return;

    isUpdating = true;
    lastUpdateTime = Date.now();
    displayUpdateCount++;

    try {

        const updateFn = () => {
            try {
                updateResultsDisplayVirtual();
                updateStatusDisplay();
            } finally {
                isUpdating = false;
            }
        };

        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(updateFn, { timeout: 500 });
        } else {
            requestAnimationFrame(updateFn);
        }
    } catch (error) {
        console.error('Failed to update the display:', error);
        isUpdating = false;
    }
}


function batchMergeResults(newResults) {
    let hasNewData = false;


    if (!pendingResults['domains']) {
        pendingResults['domains'] = new Map();
    }


    const urlContainingKeys = [
        'urls',
        'absoluteApis',
        'jsFiles',
        'cssFiles',
        'images',
        'vueRoutes',
        'webpackChunks',
        'githubUrls',
        'webhookUrls'
    ];


    Object.keys(newResults).forEach(key => {
        if (!pendingResults[key]) {
            pendingResults[key] = new Map();
        }

        if (Array.isArray(newResults[key])) {
            newResults[key].forEach(item => {
                if (item) {

                    if (key === 'relativeApis') {
                        const raw = (typeof item === 'object' ? (item.value || item.url || item.path || item.content) : item);
                        if (String(raw ?? '').trim() === '/') {

                            return;
                        }
                    }

                    const itemKey = typeof item === 'object' ? (item.value || item.url || item.path || item.fullUrl) : item;
                    const itemData = typeof item === 'object' ? item : { value: item, sourceUrl: 'unknown' };

                    if (itemKey == null) return;
                    if (!pendingResults[key].has(itemKey)) {
                        pendingResults[key].set(itemKey, itemData);
                        hasNewData = true;


                        if (urlContainingKeys.includes(key) && itemKey) {

                            const urlToExtract = itemKey.startsWith('http') ? itemKey :
                                                 (item.fullUrl && item.fullUrl.startsWith('http') ? item.fullUrl : null);

                            if (urlToExtract) {
                                const extractedDomain = extractDomainFromUrl(urlToExtract);
                                if (extractedDomain && !pendingResults['domains'].has(extractedDomain)) {
                                    pendingResults['domains'].set(extractedDomain, {
                                        value: extractedDomain,
                                        sourceUrl: itemData.sourceUrl || 'unknown',
                                        extractedAt: new Date().toISOString(),
                                        extractedFrom: key
                                    });
                                    console.log(` [Deep Scan] from ${key} extract domain: ${extractedDomain}`);
                                }
                            }
                        }
                    }
                }
            });
        }
    });


    if (hasNewData) {
        throttledUpdateDisplay();
    }

    return hasNewData;
}


function extractDomainFromUrl(url) {
    if (!url || typeof url !== 'string') {
        return null;
    }

    try {

        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return null;
        }


        let domain = url.replace(/^https?:\/\//, '');


        domain = domain.replace(/^www\./, '');


        domain = domain.split('/')[0];
        domain = domain.split('?')[0];
        domain = domain.split('#')[0];
        domain = domain.split(':')[0];


        domain = domain.toLowerCase().trim();


        if (!domain || domain.length < 3 || !domain.includes('.')) {
            return null;
        }


        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(domain)) {
            return null;
        }


        const blacklist = ['w3.org', 'w3schools.com', 'mozilla.org', 'github.com',
                          'stackoverflow.com', 'vuejs.org', 'reactjs.org', 'angular.io'];
        if (blacklist.some(b => domain.includes(b))) {
            return null;
        }

        return domain;
    } catch (error) {
        return null;
    }
}


function flushPendingResults() {
    Object.keys(pendingResults).forEach(key => {
        if (!scanResults[key]) {
            scanResults[key] = [];
        }


        const existingKeys = new Set();
        scanResults[key].forEach(item => {
            const itemKey = typeof item === 'object' ? item.value : item;
            existingKeys.add(itemKey);
        });


        pendingResults[key].forEach((itemData, itemKey) => {

            if (key === 'relativeApis' && String(itemKey ?? '').trim() === '/') {

                return;
            }
            if (!existingKeys.has(itemKey)) {
                scanResults[key].push(itemData);
            }
        });


        pendingResults[key].clear();
    });
}


async function initializePage() {


    if (typeof chrome === 'undefined' || !chrome.storage) {
        console.error(' Chrome Extension API unavailable');
        return;
    }

    await loadFilters();

    try {

        let baseUrl = '';
        if (window.opener) {
            try {

                baseUrl = window.opener.location.origin;
            } catch (e) {

                console.warn('Cannot get the URL from opener, using the default');
            }
        }


        let deepScanConfig = null;
        if (baseUrl) {
            deepScanConfig = await window.IndexedDBManager.loadDeepScanState(baseUrl);
        }


        if (!deepScanConfig) {
            console.warn(' No scan config found for the given URL, trying all available configs...');
            const allConfigs = await window.IndexedDBManager.getAllDeepScanStates();
            if (allConfigs && allConfigs.length > 0) {

                deepScanConfig = allConfigs[allConfigs.length - 1];
                console.log(' Found an available config:', deepScanConfig.baseUrl);
            }
        }

        if (!deepScanConfig) throw new Error('No scan config found');
        scanConfig = deepScanConfig;

        maxConcurrency = scanConfig.concurrency || 8;
        requestTimeout  = (scanConfig.timeout * 1000) || 5000;

        await loadVendorJsFilterSettings();

        updateConfigDisplay();
        initializeScanResults();
    } catch (err) {
        console.error(' Initialization failed:', err);
    }


    document.getElementById('startBtn')?.addEventListener('click', startScan);
    document.getElementById('pauseBtn')?.addEventListener('click', pauseScan);
    document.getElementById('stopBtn')?.addEventListener('click', stopScan);
    document.getElementById('exportBtn')?.addEventListener('click', exportResults);
    document.getElementById('toggleAllBtn')?.addEventListener('click', toggleAllCategories);


    const logSection = document.getElementById('logSection');
    if (logSection) {
        let scrollTimeout;
        logSection.addEventListener('scroll', () => {
            logSection.isUserScrolling = true;
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                logSection.isUserScrolling = false;
            }, 1000);
        });


        logSection.style.willChange = 'scroll-position';
        logSection.style.transform = 'translateZ(0)';
    }


    chrome.runtime.onMessage.addListener((msg, sender, reply) => {
        if (msg.action === 'stopDeepScan') {
            stopScan();
            reply({ success: true });
        }
    });


    initASTSystem().then(() => {
        console.log(' AST system initialized, ready to scan');

        setTimeout(startScan, 500);
    }).catch(err => {
        console.warn(' AST system initialization failed, falling back to regex mode:', err.message);

        setTimeout(startScan, 500);
    });
}


async function initASTSystem() {
    console.log(' [AST] Initializing AST system...');

    try {

        console.log(' [AST] Checking dependencies:');
        console.log('  - window.acorn:', !!window.acorn);
        console.log('  - window.ASTExtractor:', !!window.ASTExtractor);
        console.log('  - window.ASTBridge:', !!window.ASTBridge);
        console.log('  - window.astBridge:', !!window.astBridge);
        console.log('  - window.initASTExtractor:', typeof window.initASTExtractor);


        if (window.astBridge) {
            console.log(' [AST] Initializing with ASTBridge...');
            const initResult = await window.astBridge.init();

            if (initResult && window.astBridge.isAvailable()) {
                console.log(' [AST] ASTBridge initialized successfully');
                console.log(' [AST] visitors registered:', window.astBridge.extractor?.getVisitors()?.map(v => v.name) || []);
                return true;
            } else {
                console.warn(' [AST] ASTBridge initialization returned false or is unavailable');
            }
        }


        if (typeof window.initASTExtractor === 'function') {
            console.log(' [AST] Initializing with initASTExtractor...');
            await window.initASTExtractor();

            if (window.astExtractor) {
                console.log(' [AST] ASTExtractor initialized successfully');
                return true;
            }
        }

        console.warn(' [AST] AST module not loaded or failed to initialize, using regex extraction only');
        return false;

    } catch (error) {
        console.error(' [AST] AST system initialization failed:', error);
        console.warn(' [AST] will use regex extraction only');
        return false;
    }
}


function updateConfigDisplay() {
    if (!scanConfig) return;

    document.getElementById('maxDepthDisplay').textContent = scanConfig.maxDepth || 2;
    document.getElementById('concurrencyDisplay').textContent = scanConfig.concurrency || 8;
    document.getElementById('timeoutDisplay').textContent = scanConfig.timeout || 5;

    const scanTypes = [];
    if (scanConfig.scanJsFiles) scanTypes.push('JS Files');
    if (scanConfig.scanHtmlFiles) scanTypes.push('HTML Page');
    if (scanConfig.scanApiFiles) scanTypes.push('API Endpoints');

    document.getElementById('scanTypesDisplay').textContent = scanTypes.join(', ') || 'All';
    document.getElementById('scanInfo').textContent = `Target: ${scanConfig.baseUrl}`;
}


function initializeScanResults() {
    scanResults = {
        absoluteApis: [],
        relativeApis: [],
        moduleApis: [],
        domains: [],
        urls: [],
        images: [],
        jsFiles: [],
        cssFiles: [],
        vueFiles: [],
        vueRoutes: [],
        vueSensitiveRoutes: [],
        sourceMapSources: [],
        sourceMapFiles: [],
        emails: [],
        phoneNumbers: [],
        ipAddresses: [],
        sensitiveKeywords: [],
        comments: [],
        paths: [],
        parameters: [],
        credentials: [],
        cookies: [],
        idKeys: [],
        companies: [],
        jwts: [],
        githubUrls: [],
        bearerTokens: [],
        basicAuth: [],
        authHeaders: [],
        wechatAppIds: [],
        awsKeys: [],
        googleApiKeys: [],
        githubTokens: [],
        gitlabTokens: [],
        webhookUrls: [],
        idCards: [],
        cryptoUsage: [],

        webpackChunks: [],
        webpackSourceMaps: [],
        webpackDefineConstants: []
    };
}



async function performWebpackScan() {
    addLogEntry(' [Webpack] Starting Webpack detection...', 'info');

    try {

        if (scanConfig.initialResults?.webpackDetection) {
            const webpackResult = scanConfig.initialResults.webpackDetection;
            if (webpackResult.detected) {
                addLogEntry(` [Webpack] Detected from the basic scan results Webpack ${webpackResult.version || 'unknown'}`, 'success');
                processWebpackResult(webpackResult);
                return;
            }
        }



        const baseUrl = scanConfig.baseUrl;
        if (baseUrl) {
            try {
                addLogEntry(` [Webpack] Trying to detect from the target page Webpack: ${baseUrl}`, 'info');
                const pageContent = await fetchUrlContent(baseUrl);

                if (pageContent) {
                    const webpackResult = detectWebpackFromContent(pageContent, baseUrl);
                    if (webpackResult.detected) {
                        addLogEntry(` [Webpack] Detected from page content Webpack`, 'success');
                        processWebpackResult(webpackResult);
                        return;
                    }
                }
            } catch (fetchError) {
                addLogEntry(` [Webpack] Failed to get page content: ${fetchError.message}`, 'warning');
            }
        }

        addLogEntry(' [Webpack] No Webpack bundling detected', 'info');

    } catch (error) {
        console.error('[Webpack] Scan failed:', error);
        addLogEntry(` [Webpack] Scan failed: ${error.message}`, 'error');
    }
}


function detectWebpackFromContent(content, sourceUrl) {
    const result = {
        detected: false,
        version: null,
        buildMode: 'unknown',
        chunks: [],
        sourceMaps: [],
        defineConstants: [],
        apiEndpoints: []
    };

    try {

        const webpackPatterns = [
            /webpackJsonp/,
            /webpackChunk/,
            /__webpack_require__/,
            /__webpack_modules__/,
            /webpack\/runtime/,
            /\/\*\!\s*\*{3,}\s*\*!\s*webpack/i
        ];

        for (const pattern of webpackPatterns) {
            if (pattern.test(content)) {
                result.detected = true;
                break;
            }
        }

        if (!result.detected) {
            return result;
        }


        if (content.includes('webpackChunk')) {
            result.version = '5';
        } else if (content.includes('webpackJsonp')) {
            result.version = '4';
        } else {
            const versionMatch = content.match(/webpack\s*[v\/]?(\d+(?:\.\d+)*)/i);
            if (versionMatch) {
                result.version = versionMatch[1];
            }
        }


        if (content.includes('production') || content.includes('.min.js')) {
            result.buildMode = 'production';
        } else if (content.includes('development') || content.includes('devtool')) {
            result.buildMode = 'development';
        }


        if (typeof ChunkAnalyzer !== 'undefined') {
            try {
                const chunkAnalyzer = new ChunkAnalyzer({
                    baseUrl: sourceUrl,
                    debug: false
                });
                const chunkRefs = chunkAnalyzer.extractChunkReferences(content, sourceUrl);

                if (chunkRefs && chunkRefs.length > 0) {
                    result.chunks = chunkRefs.map(ref => ({
                        url: ref.url,
                        type: ref.type || 'async',
                        chunkId: ref.chunkId,
                        source: ref.source
                    }));
                    console.log('[Webpack] ChunkAnalyzer Extracted', result.chunks.length, ' chunks');
                }
            } catch (e) {
                console.warn('[Webpack] ChunkAnalyzer extraction failed, using the fallback method:', e);
            }
        }


        if (result.chunks.length === 0) {

            const functionMatch = content.match(/([a-zA-Z]\.[a-zA-Z])\s*\+\s*["']([^"']+)["']/);
            let basePath = '';
            if (functionMatch) {
                basePath = functionMatch[2];
            }


            const chunkMapMatch = content.match(/return.*?\((\{\s*"[^}]+\})\s*.*?(\{\s*"[^}]+\})\[[a-zA-Z]\]\s*\+\s*"(.*?\.js)"/);
            if (chunkMapMatch) {
                const hashMap = chunkMapMatch[2];
                const suffix = chunkMapMatch[3];
                const hashEntries = hashMap.match(/"[^"]+"\s*:\s*"[^"]+"/g) || [];

                hashEntries.forEach(entry => {
                    const parts = entry.replace(/"/g, '').split(':').map(s => s.trim());
                    if (parts.length === 2) {
                        const chunkName = parts[0];
                        const hash = parts[1];
                        const jsPath = basePath + chunkName + '.' + hash + suffix;
                        result.chunks.push({ url: jsPath, type: 'async' });
                    }
                });
            }


            const simpleMapPattern = /\{(\s*\d+\s*:\s*"[a-f0-9]+"\s*,?\s*)+\}/g;
            let simpleMatch;
            while ((simpleMatch = simpleMapPattern.exec(content)) !== null) {
                const mapStr = simpleMatch[0];
                const itemPattern = /(\d+)\s*:\s*"([a-f0-9]+)"/g;
                let itemMatch;

                while ((itemMatch = itemPattern.exec(mapStr)) !== null) {
                    const chunkId = itemMatch[1];
                    const hash = itemMatch[2];
                    const jsPath = basePath + chunkId + '.' + hash + '.js';
                    result.chunks.push({ url: jsPath, type: 'async', chunkId: chunkId });
                }
            }


            const chunkPatterns = [
                /["']([^"']*?(?:chunk|bundle|vendor|main|app)[^"']*?\.js)["']/gi,
                /src=["']([^"']+\.js)["']/gi,
                /["'](\/?(?:static|assets|dist|js)\/[^"']+\.js)["']/gi
            ];

            for (const pattern of chunkPatterns) {
                let match;
                while ((match = pattern.exec(content)) !== null) {
                    const chunkUrl = match[1];
                    if (chunkUrl && !chunkUrl.includes('node_modules')) {
                        result.chunks.push({ url: chunkUrl, type: 'chunk' });
                    }
                }
            }
        }


        const seenUrls = new Set();
        result.chunks = result.chunks.filter(chunk => {
            if (!chunk.url || seenUrls.has(chunk.url)) return false;
            seenUrls.add(chunk.url);
            return true;
        });


        const sourceMapPattern = /\/\/[#@]\s*sourceMappingURL=([^\s\n]+)/g;
        let smMatch;
        while ((smMatch = sourceMapPattern.exec(content)) !== null) {
            const mapUrl = smMatch[1];
            if (mapUrl && !mapUrl.startsWith('data:')) {
                result.sourceMaps.push({
                    sourceMapUrl: mapUrl,
                    jsFile: sourceUrl,
                    isInline: false
                });
            }
        }


        const definePattern = /process\.env\.([A-Z_][A-Z0-9_]*)\s*(?:===?|!==?)\s*["']([^"']+)["']/gi;
        let defineMatch;
        while ((defineMatch = definePattern.exec(content)) !== null) {
            result.defineConstants.push({
                name: `process.env.${defineMatch[1]}`,
                value: defineMatch[2]
            });
        }

        console.log('[Webpack] Content detection result:', {
            detected: result.detected,
            version: result.version,
            chunks: result.chunks.length,
            sourceMaps: result.sourceMaps.length
        });

    } catch (error) {
        console.warn('[Webpack] Content detection failed:', error);
    }

    return result;
}


function processWebpackResult(webpackResult) {
    try {
        if (!webpackResult || !webpackResult.detected) {
            return;
        }


        if (webpackResult.chunks && webpackResult.chunks.length > 0) {
            addLogEntry(` [Webpack] Found ${webpackResult.chunks.length} chunk files`, 'info');


            const baseUrl = scanConfig.baseUrl;
            for (const chunk of webpackResult.chunks) {
                let chunkUrl = chunk.url;


                if (chunkUrl && !chunkUrl.startsWith('http')) {
                    try {
                        chunkUrl = new URL(chunkUrl, baseUrl).href;
                    } catch (e) {

                    }
                }

                if (chunkUrl) {
                    scanResults.webpackChunks.push({
                        value: chunkUrl,
                        type: chunk.type || 'chunk',
                        source: 'webpack',
                        extractedAt: new Date().toISOString()
                    });


                    if (!chunkUrl.startsWith('data:')) {
                        pendingUrls.add(chunkUrl);
                    }
                }
            }
        }


        if (webpackResult.sourceMaps && webpackResult.sourceMaps.length > 0) {
            addLogEntry(` [Webpack] Found ${webpackResult.sourceMaps.length} Source Maps`, 'info');

            const baseUrl = scanConfig.baseUrl;
            for (const sm of webpackResult.sourceMaps) {
                let mapUrl = sm.sourceMapUrl;


                if (mapUrl && !mapUrl.startsWith('http') && !mapUrl.startsWith('data:')) {
                    try {
                        mapUrl = new URL(mapUrl, baseUrl).href;
                    } catch (e) {

                    }
                }

                if (mapUrl) {
                    scanResults.webpackSourceMaps.push({
                        value: mapUrl,
                        jsFile: sm.jsFile,
                        isInline: sm.isInline || false,
                        source: 'webpack',
                        extractedAt: new Date().toISOString()
                    });


                    if (!sm.isInline && !mapUrl.startsWith('data:')) {
                        pendingUrls.add(mapUrl);
                        addLogEntry(` [Webpack] Added Source Map to scan queue: ${mapUrl}`, 'info');
                    }
                }
            }
        }


        if (webpackResult.defineConstants && webpackResult.defineConstants.length > 0) {
            addLogEntry(` [Webpack] Found ${webpackResult.defineConstants.length} DefinePlugin constants`, 'info');
            for (const c of webpackResult.defineConstants) {
                scanResults.webpackDefineConstants.push({
                    value: `${c.name}: ${c.value}`,
                    name: c.name,
                    source: 'webpack',
                    extractedAt: new Date().toISOString()
                });
            }
        }


        if (webpackResult.apiEndpoints && webpackResult.apiEndpoints.length > 0) {
            addLogEntry(` [Webpack] Found ${webpackResult.apiEndpoints.length} API endpoints`, 'info');
            for (const endpoint of webpackResult.apiEndpoints) {
                if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
                    if (!scanResults.absoluteApis.some(a => (typeof a === 'object' ? a.value : a) === endpoint)) {
                        scanResults.absoluteApis.push({
                            value: endpoint,
                            source: 'webpack',
                            extractedAt: new Date().toISOString()
                        });
                    }
                } else if (endpoint.startsWith('/')) {
                    if (!scanResults.relativeApis.some(a => (typeof a === 'object' ? a.value : a) === endpoint)) {
                        scanResults.relativeApis.push({
                            value: endpoint,
                            source: 'webpack',
                            extractedAt: new Date().toISOString()
                        });
                    }
                }
            }
        }


        throttledUpdateDisplay();

    } catch (error) {
        console.error('[Webpack] Failed to process results:', error);
        addLogEntry(` [Webpack] Failed to process results: ${error.message}`, 'error');
    }
}


async function startScan() {
    if (isScanRunning) return;


    isScanRunning = true;
    isPaused = false;
    currentDepth = 0;
    scannedUrls.clear();
    pendingUrls.clear();
    urlContentCache.clear();


    startMemoryCleanup();


    updateButtonStates();
    updateStatusDisplay();


    document.getElementById('loadingDiv').style.display = 'none';

    try {

        await performWebpackScan();


        const initialUrls = await collectInitialUrls();

        addLogEntry(` Collected ${initialUrls.length} initial scan URL`, 'info');

        if (initialUrls.length === 0) {
            addLogEntry(' No scannable URL', 'warning');
            return;
        }


        if (initialUrls.length > 0) {
            const urlsToShow = initialUrls.slice(0, 5);
            addLogEntry(` Initial scan targets: ${urlsToShow.join(', ')}${initialUrls.length > 5 ? ` (${initialUrls.length} URLs total)` : ''}`, 'info');
        }


        addLogEntry(` Scan config - max depth: ${scanConfig.maxDepth}, Concurrency: ${scanConfig.concurrency}, Timeout: ${scanConfig.timeout}ms`, 'info');


        await performLayeredScan(initialUrls);


        completeScan();

    } catch (error) {
        console.error(' Scan failed:', error);
        addLogEntry(` Scan failed: ${error.message}`, 'error');
    } finally {
        isScanRunning = false;
        updateButtonStates();
    }
}

function pauseScan() {
    isPaused = !isPaused;
    const pauseBtn = document.getElementById('pauseBtn');
    pauseBtn.textContent = isPaused ? 'Resume Scan' : 'Pause Scan';

    if (isPaused) {
        addLogEntry('⏸ Scan paused', 'warning');
        addLogEntry(` State at pause: scanned${scannedUrls.size}URLs, current depth${currentDepth}`, 'info');
    } else {
        addLogEntry('▶ Scan resumed', 'success');
    }
}

function stopScan() {
    isScanRunning = false;
    isPaused = false;


    stopMemoryCleanup();

    addLogEntry('⏹ Scan stopped by the user', 'warning');
    addLogEntry(` State at stop: scanned${scannedUrls.size}URLs, current depth${currentDepth}`, 'info');
    updateButtonStates();
    completeScan();
}


async function collectInitialUrls() {


    const urls = new Set();

    try {

        if (!scanConfig.initialResults) {
            console.warn(' No basic scan results in the deep scan config, scanning the current page instead');
            urls.add(scanConfig.baseUrl);
            return Array.from(urls);
        }

        const initialResults = scanConfig.initialResults;

        console.log(' [DEBUG] Basic scan result stats:', {
            absoluteApis: initialResults.absoluteApis?.length || 0,
            jsFiles: initialResults.jsFiles?.length || 0,
            urls: initialResults.urls?.length || 0,
            domains: initialResults.domains?.length || 0,
            emails: initialResults.emails?.length || 0
        });


        Object.keys(initialResults).forEach(key => {
            if (scanResults[key] && Array.isArray(initialResults[key])) {
                scanResults[key] = [...initialResults[key]];
            }
        });


        if (scanConfig.scanJsFiles && initialResults.jsFiles) {

            for (const jsFile of initialResults.jsFiles) {

                const url = typeof jsFile === 'object' ? jsFile.value : jsFile;
                const sourceUrl = typeof urlItem === 'object' ? urlItem.sourceUrl : null;
                const fullUrl = await resolveUrl(url, scanConfig.baseUrl, sourceUrl);
                if (fullUrl && await isSameDomain(fullUrl, scanConfig.baseUrl)) {
                    urls.add(fullUrl);

                }
            }
        }


        if (scanConfig.scanHtmlFiles && initialResults.urls) {

            for (const urlItem of initialResults.urls) {

                const url = typeof urlItem === 'object' ? urlItem.value : urlItem;
                const sourceUrl = typeof urlItem === 'object' ? urlItem.sourceUrl : null;
                const fullUrl = await resolveUrl(url, scanConfig.baseUrl, sourceUrl);
                if (fullUrl && await isSameDomain(fullUrl, scanConfig.baseUrl) && isValidPageUrl(fullUrl)) {
                    urls.add(fullUrl);

                }
            }
        }


        if (scanConfig.scanApiFiles) {

            if (initialResults.absoluteApis) {

                for (const apiItem of initialResults.absoluteApis) {

                    const api = typeof apiItem === 'object' ? apiItem.value : apiItem;
                    const sourceUrl = typeof apiItem === 'object' ? apiItem.sourceUrl : null;
                    const fullUrl = await resolveUrl(api, scanConfig.baseUrl, sourceUrl);
                    if (fullUrl && await isSameDomain(fullUrl, scanConfig.baseUrl)) {
                        urls.add(fullUrl);

                    }
                }
            }


            if (initialResults.relativeApis) {

                for (const apiItem of initialResults.relativeApis) {

                    const api = typeof apiItem === 'object' ? apiItem.value : apiItem;
                    const sourceUrl = typeof apiItem === 'object' ? apiItem.sourceUrl : null;
                    const fullUrl = await resolveUrl(api, scanConfig.baseUrl, sourceUrl);
                    if (fullUrl && await isSameDomain(fullUrl, scanConfig.baseUrl)) {
                        urls.add(fullUrl);

                    }
                }
            }
        }


        if (urls.size === 0) {
            console.warn(' No URLs collected from the basic scan results, adding the current page');
            urls.add(scanConfig.baseUrl);
        }



        return Array.from(urls);

    } catch (error) {
        console.error(' Failed to collect initial URLs:', error);

        urls.add(scanConfig.baseUrl);
        return Array.from(urls);
    }
}


async function performLayeredScan(initialUrls) {
    let currentUrls = [...initialUrls];

    for (let depth = 1; depth <= scanConfig.maxDepth && isScanRunning; depth++) {
        currentDepth = depth;

        if (currentUrls.length === 0) {

            break;
        }


        addLogEntry(` Starting layer ${depth} scan, URL count: ${currentUrls.length}`, 'info');


        if (currentUrls.length > 0) {
            const urlsToShow = currentUrls.slice(0, 3);
            addLogEntry(` Layer ${depth} scan targets: ${urlsToShow.join(', ')}${currentUrls.length > 3 ? ` (${currentUrls.length} URLs total)` : ''}`, 'info');
        }


        const newUrls = await scanUrlBatch(currentUrls, depth);


        currentUrls = newUrls.filter(url => !scannedUrls.has(url));


        addLogEntry(` Layer ${depth} scan complete, found ${currentUrls.length} new URLs`, 'success');


        if (currentUrls.length > 0 && depth < scanConfig.maxDepth) {
            addLogEntry(` Preparing layer ${depth + 1} scan, ${currentUrls.length} URLs pending`, 'info');
        }


        updateResultsDisplay();
        updateStatusDisplay();
    }
}


async function scanUrlBatch(urls, depth) {
    const newUrls = new Set();
    let processedCount = 0;
    const totalUrls = urls.length;


    const queue = [...urls];
    const activeWorkers = new Set();


    let lastDisplayUpdate = 0;
    const displayUpdateInterval = 500;

    const processQueue = async () => {
        while (queue.length > 0 && isScanRunning && !isPaused) {
            const url = queue.shift();

            if (scannedUrls.has(url)) {
                processedCount++;
                updateProgressDisplay(processedCount, totalUrls, `Layer ${depth} scan`);
                continue;
            }

            scannedUrls.add(url);

            const workerPromise = (async () => {
                try {

                    let content;
                    if (urlContentCache.has(url)) {
                        content = urlContentCache.get(url);
                    } else {
                        content = await fetchUrlContent(url);
                        if (content) {
                            urlContentCache.set(url, content);
                        }
                    }

                        if (content) {

                            const extractedData = await extractFromContent(content, url);
                            const hasNewData = mergeResults(extractedData);


                            if (hasNewData && processedCount % 20 === 0) {
                                throttledUpdateDisplay();
                            }


                            const discoveredUrls = await collectUrlsFromContent(content, scanConfig.baseUrl, extractedData);
                            discoveredUrls.forEach(newUrl => newUrls.add(newUrl));
                        }
                    } catch (error) {
                        console.error(`Scan ${url} Failed:`, error);
                    } finally {
                        processedCount++;

                        if (processedCount % 20 === 0 || processedCount === totalUrls) {
                            updateProgressDisplay(processedCount, totalUrls, `Layer ${depth} scan`);
                        }
                        activeWorkers.delete(workerPromise);
                    }
            })();

            activeWorkers.add(workerPromise);


            if (activeWorkers.size >= maxConcurrency) {
                await Promise.race(Array.from(activeWorkers));
            }


            if (processedCount % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    };

    await processQueue();


    if (activeWorkers.size > 0) {
        await Promise.all(Array.from(activeWorkers));
    }

    return Array.from(newUrls);
}


async function fetchUrlContent(url) {
    try {


        const requestOptions = {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml,text/javascript,application/javascript,text/css,*/*',
                'Cache-Control': 'no-cache'
            },
            timeout: requestTimeout
        };

        const response = await makeRequestViaBackground(url, requestOptions);

        if (!response.ok) {
            console.warn(`HTTP ${response.status} for ${url}`);
            return null;
        }

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('image/') ||
            contentType.includes('audio/') ||
            contentType.includes('video/') ||
            contentType.includes('application/octet-stream') ||
            contentType.includes('application/zip') ||
            contentType.includes('application/pdf')) {
            return null;
        }

        const text = await response.text();
        return text;

    } catch (error) {
        console.error(`Cannot access ${url}:`, error);
        return null;
    }
}


async function makeRequestViaBackground(url, options = {}) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            action: 'makeRequest',
            url: url,
            options: options
        }, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else if (response && response.success) {
                const mockHeaders = new Map(Object.entries(response.data.headers || {}));

                resolve({
                    ok: response.data.status >= 200 && response.data.status < 300,
                    status: response.data.status,
                    statusText: response.data.statusText,
                    headers: {
                        get: (name) => mockHeaders.get(name.toLowerCase()),
                        has: (name) => mockHeaders.has(name.toLowerCase()),
                        entries: () => mockHeaders.entries(),
                        keys: () => mockHeaders.keys(),
                        values: () => mockHeaders.values()
                    },
                    text: () => Promise.resolve(response.data.text),
                    json: () => {
                        try {
                            return Promise.resolve(JSON.parse(response.data.text));
                        } catch (e) {
                            return Promise.reject(new Error('Invalid JSON'));
                        }
                    },
                    url: response.data.url
                });
            } else {
                reject(new Error(response?.error || 'Request failed'));
            }
        });
    });
}



async function collectSourceMapUrls(content, baseUrl, urls) {
    if (!content) return;

    try {

        const patterns = [
            /\/\/[#@]\s*sourceMappingURL=([^\s\n]+)/g,
            /\/\*[#@]\s*sourceMappingURL=([^\s*]+)\s*\*\//g
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const sourceMapUrl = match[1];

                if (!sourceMapUrl) continue;


                if (sourceMapUrl.startsWith('data:')) {
                    console.log(' [SourceMap] Found an inline Source Map, parsing directly');

                    continue;
                }


                const fullUrl = await resolveUrl(sourceMapUrl, baseUrl);
                if (fullUrl && await isSameDomain(fullUrl, baseUrl)) {
                    urls.add(fullUrl);
                    console.log(` [SourceMap] Added Source Map to scan queue: ${fullUrl}`);


                    if (!scanResults.sourceMapFiles) {
                        scanResults.sourceMapFiles = [];
                    }
                    const exists = scanResults.sourceMapFiles.some(
                        item => (typeof item === 'object' ? item.value : item) === fullUrl
                    );
                    if (!exists) {
                        scanResults.sourceMapFiles.push({
                            value: fullUrl,
                            sourceUrl: baseUrl,
                            extractedAt: new Date().toISOString()
                        });
                    }
                }
            }
        }
    } catch (error) {
        console.warn(' [SourceMap] Failed to extract Source Map URL:', error.message);
    }
}



async function collectUrlsFromContent(content, baseUrl, extractedData = null) {
    const urls = new Set();

    try {

        if (!extractedData) {
            extractedData = await extractFromContent(content, baseUrl);
        }


        if (scanConfig.scanJsFiles && extractedData.jsFiles) {
            for (const jsFileItem of extractedData.jsFiles) {
                const jsFile = typeof jsFileItem === 'object' ? jsFileItem.value : jsFileItem;
                const sourceUrl = typeof jsFileItem === 'object' ? jsFileItem.sourceUrl : null;
                const fullUrl = await resolveUrl(jsFile, baseUrl, sourceUrl);
                if (vendorJsFilterEnabled && isVendorJsUrl(fullUrl)) continue;
                if (fullUrl && await isSameDomain(fullUrl, baseUrl)) {
                    urls.add(fullUrl);


                    const mapUrl = fullUrl + '.map';
                    if (await isSameDomain(mapUrl, baseUrl)) {
                        urls.add(mapUrl);
                        console.log(` [SourceMap] Auto-added Source Map: ${mapUrl}`);
                    }
                }
            }
        }


        if (extractedData.vueFiles && extractedData.vueFiles.length > 0) {
            console.log(` [Vue] Found ${extractedData.vueFiles.length} Vue files`);
            for (const vueFileItem of extractedData.vueFiles) {
                const vueFile = typeof vueFileItem === 'object' ? vueFileItem.value : vueFileItem;
                const sourceUrl = typeof vueFileItem === 'object' ? vueFileItem.sourceUrl : null;
                const fullUrl = await resolveUrl(vueFile, baseUrl, sourceUrl);
                if (fullUrl && await isSameDomain(fullUrl, baseUrl)) {
                    urls.add(fullUrl);
                    console.log(` [Vue] Added Vue file to the scan queue: ${fullUrl}`);
                }
            }
        }


        if (extractedData.sourceMapSources && extractedData.sourceMapSources.length > 0) {
            console.log(` [SourceMap] Found ${extractedData.sourceMapSources.length} source file references`);
        }


        await collectSourceMapUrls(content, baseUrl, urls);


        if (extractedData.vueRoutes && extractedData.vueRoutes.length > 0) {
            console.log(` [Vue] Found ${extractedData.vueRoutes.length} Vue routes, added to the deep scan queue`);
            for (const routeItem of extractedData.vueRoutes) {
                const routeUrl = typeof routeItem === 'object' ? (routeItem.fullUrl || routeItem.value) : routeItem;
                if (routeUrl && routeUrl.startsWith('http') && await isSameDomain(routeUrl, baseUrl)) {
                    urls.add(routeUrl);
                    console.log(` [Vue] Added route to the scan queue: ${routeUrl}`);
                }
            }
        }


        if (scanConfig.scanHtmlFiles && extractedData.urls) {
            for (const urlItem of extractedData.urls) {
                const url = typeof urlItem === 'object' ? urlItem.value : urlItem;
                const sourceUrl = typeof urlItem === 'object' ? urlItem.sourceUrl : null;
                const fullUrl = await resolveUrl(url, baseUrl, sourceUrl);
                if (fullUrl && await isSameDomain(fullUrl, baseUrl) && isValidPageUrl(fullUrl)) {
                    urls.add(fullUrl);
                }
            }
        }


        if (scanConfig.scanApiFiles) {
            if (extractedData.absoluteApis) {
                for (const apiItem of extractedData.absoluteApis) {
                    const api = typeof apiItem === 'object' ? apiItem.value : apiItem;
                    const sourceUrl = typeof apiItem === 'object' ? apiItem.sourceUrl : null;
                    const fullUrl = await resolveUrl(api, baseUrl, sourceUrl);
                    if (fullUrl && await isSameDomain(fullUrl, baseUrl)) {
                        urls.add(fullUrl);
                    }
                }
            }

            if (extractedData.relativeApis) {
                for (const apiItem of extractedData.relativeApis) {

                    let fullUrl;
                    if (typeof apiItem === 'object' && apiItem.resolvedUrl) {
                        fullUrl = apiItem.resolvedUrl;

                    } else {
                        const api = typeof apiItem === 'object' ? apiItem.value : apiItem;
                        const sourceUrl = typeof apiItem === 'object' ? apiItem.sourceUrl : null;
                        fullUrl = await resolveUrl(api, baseUrl, sourceUrl);

                    }

                    if (fullUrl && await isSameDomain(fullUrl, baseUrl)) {
                        urls.add(fullUrl);
                    }
                }
            }
        }
    } catch (error) {
        console.error(' Failed to collect URLs from content:', error);
    }

    return Array.from(urls);
}


function mergeResults(newResults) {

    return batchMergeResults(newResults);
}


async function saveResultsToStorage() {
    try {

        let domainKey = 'unknown__results';
        if (scanConfig?.baseUrl) {
            try {
                const hostname = new URL(scanConfig.baseUrl).hostname;
                domainKey = `${hostname}__results`;
            } catch (e) {
                console.warn('Failed to parse the domain, using the default key:', e);
            }
        }




        const existingResults = await window.IndexedDBManager.loadScanResults(scanConfig.baseUrl) || {};


        const mergedResults = { ...existingResults };


        Object.keys(scanResults).forEach(key => {
            if (!mergedResults[key]) {
                mergedResults[key] = [];
            }


            const existingKeys = new Set();
            mergedResults[key].forEach(item => {
                const itemKey = typeof item === 'object' ? item.value : item;
                existingKeys.add(itemKey);
            });


            scanResults[key].forEach(item => {
                if (item) {
                    const itemKey = typeof item === 'object' ? item.value : item;

                    if (key === 'relativeApis' && String(itemKey ?? '').trim() === '/') {

                        return;
                    }
                    if (!existingKeys.has(itemKey)) {
                        mergedResults[key].push(item);
                        existingKeys.add(itemKey);
                    }
                }
            });
        });


        mergedResults.scanMetadata = {
            ...existingResults.scanMetadata,
            lastScanType: 'deep',
            deepScanComplete: true,
            deepScanTimestamp: Date.now(),
            deepScanUrl: scanConfig.baseUrl,
            totalScanned: scannedUrls.size
        };


        const pageTitle = scanConfig.pageTitle || document.title || 'Deep Scan Results';

        await window.IndexedDBManager.saveScanResults(scanConfig.baseUrl, mergedResults, scanConfig.baseUrl, pageTitle);



        console.log(' Merged result stats:', {
            Total: Object.values(mergedResults).reduce((sum, arr) => {
                return sum + (Array.isArray(arr) ? arr.length : 0);
            }, 0),
            deepScanContribution: Object.values(scanResults).reduce((sum, arr) => sum + (arr?.length || 0), 0)
        });

    } catch (error) {
        console.error(' Failed to save results:', error);
    }
}


async function completeScan() {



    flushPendingResults();

    const totalResults = Object.values(scanResults).reduce((sum, arr) => sum + (arr?.length || 0), 0);
    const totalScanned = scannedUrls.size;

    addLogEntry(' Deep scan complete!', 'success');
    addLogEntry(` Scan stats: scanned ${totalScanned} files, extracted ${totalResults} items`, 'success');


    const nonEmptyCategories = Object.entries(scanResults).filter(([key, items]) => items && items.length > 0);
    if (nonEmptyCategories.length > 0) {
        const topCategories = nonEmptyCategories
            .sort(([,a], [,b]) => b.length - a.length)
            .slice(0, 5)
            .map(([key, items]) => `${key}: ${items.length}`);
        addLogEntry(` Key findings: ${topCategories.join(', ')}`, 'success');
    }


    const scanDuration = Date.now() - (scanConfig.timestamp || Date.now());
    const durationText = scanDuration > 60000 ?
        `${Math.floor(scanDuration / 60000)}m${Math.floor((scanDuration % 60000) / 1000)}s` :
        `${Math.floor(scanDuration / 1000)}s`;
    addLogEntry(`⏱ Scan duration: ${durationText}`, 'info');


    await saveResultsToStorage();


    try {
        chrome.runtime.sendMessage({
            action: 'deepScanComplete',
            data: {
                results: scanResults,
                totalScanned: totalScanned,
                totalResults: totalResults,
                baseUrl: scanConfig.baseUrl
            }
        }, (response) => {
            if (chrome.runtime.lastError) {

            } else {

            }
        });
    } catch (error) {

    }


    performDisplayUpdate();


    const progressText = document.getElementById('progressText');
    if (progressText) {
        progressText.textContent = ' Deep scan complete!';
        progressText.classList.add('success');
    }

    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
        progressBar.style.width = '100%';
    }


    updateButtonStates();


    stopMemoryCleanup();


    setTimeout(() => {
        cleanupMemory();
    }, 5000);
}


function cleanupMemory() {



    if (urlContentCache.size > 100) {
        const entries = Array.from(urlContentCache.entries());
        const toKeep = entries.slice(-100);
        urlContentCache.clear();
        toKeep.forEach(([key, value]) => urlContentCache.set(key, value));

    }


    Object.keys(pendingResults).forEach(key => {
        if (pendingResults[key]) {
            pendingResults[key].clear();
        }
    });


    updateQueue.length = 0;


    if (updateTimer) {
        clearTimeout(updateTimer);
        updateTimer = null;
    }


}


function updateButtonStates() {
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');

    if (isScanRunning) {
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        stopBtn.disabled = false;
        startBtn.textContent = 'Scanning...';
        pauseBtn.textContent = isPaused ? 'Resume Scan' : 'Pause Scan';
    } else {
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        startBtn.textContent = 'Start Scan';
        pauseBtn.textContent = 'Pause Scan';
    }
}

function updateStatusDisplay() {
    document.getElementById('currentDepth').textContent = currentDepth;
    document.getElementById('scannedUrls').textContent = scannedUrls.size;
    document.getElementById('pendingUrls').textContent = pendingUrls.size;

    const totalResults = Object.values(scanResults).reduce((sum, arr) => sum + (arr?.length || 0), 0);
    document.getElementById('totalResults').textContent = totalResults;
}

function updateProgressDisplay(current, total, stage) {

    if (updateProgressDisplay.pending) return;
    updateProgressDisplay.pending = true;


    requestAnimationFrame(() => {
        const progressText = document.getElementById('progressText');
        const progressBar = document.getElementById('progressBar');

        if (progressText && progressBar) {
            const percentage = total > 0 ? (current / total) * 100 : 0;
            progressText.textContent = `${stage}: ${current}/${total} (${percentage.toFixed(1)}%)`;
            progressBar.style.width = `${percentage}%`;
        }

        updateProgressDisplay.pending = false;
    });
}

function updateResultsDisplay() {

    flushPendingResults();




    if (displayUpdateCount % 10 === 0) {



        if (scanResults.absoluteApis?.length > 0) {

        }
        if (scanResults.relativeApis?.length > 0) {

        }
    }


    const categoryMapping = {
        absoluteApis: { containerId: 'absoluteApisResult', countId: 'absoluteApisCount', listId: 'absoluteApisList' },
        relativeApis: { containerId: 'relativeApisResult', countId: 'relativeApisCount', listId: 'relativeApisList' },
        moduleApis: { containerId: 'modulePathsResult', countId: 'modulePathsCount', listId: 'modulePathsList' },
        domains: { containerId: 'domainsResult', countId: 'domainsCount', listId: 'domainsList' },
        urls: { containerId: 'urlsResult', countId: 'urlsCount', listId: 'urlsList' },
        images: { containerId: 'imagesResult', countId: 'imagesCount', listId: 'imagesList' },
        jsFiles: { containerId: 'jsFilesResult', countId: 'jsFilesCount', listId: 'jsFilesList' },
        cssFiles: { containerId: 'cssFilesResult', countId: 'cssFilesCount', listId: 'cssFilesList' },
        vueFiles: { containerId: 'vueFilesResult', countId: 'vueFilesCount', listId: 'vueFilesList' },
        vueRoutes: { containerId: 'vueRoutesResult', countId: 'vueRoutesCount', listId: 'vueRoutesList' },
        sourceMapSources: { containerId: 'sourceMapSourcesResult', countId: 'sourceMapSourcesCount', listId: 'sourceMapSourcesList' },
        sourceMapFiles: { containerId: 'sourceMapFilesResult', countId: 'sourceMapFilesCount', listId: 'sourceMapFilesList' },
        emails: { containerId: 'emailsResult', countId: 'emailsCount', listId: 'emailsList' },
        phoneNumbers: { containerId: 'phoneNumbersResult', countId: 'phoneNumbersCount', listId: 'phoneNumbersList' },
        ipAddresses: { containerId: 'ipAddressesResult', countId: 'ipAddressesCount', listId: 'ipAddressesList' },
        sensitiveKeywords: { containerId: 'sensitiveKeywordsResult', countId: 'sensitiveKeywordsCount', listId: 'sensitiveKeywordsList' },
        comments: { containerId: 'commentsResult', countId: 'commentsCount', listId: 'commentsList' },
        paths: { containerId: 'pathsResult', countId: 'pathsCount', listId: 'pathsList' },
        parameters: { containerId: 'parametersResult', countId: 'parametersCount', listId: 'parametersList' },
        credentials: { containerId: 'credentialsResult', countId: 'credentialsCount', listId: 'credentialsList' },
        cookies: { containerId: 'cookiesResult', countId: 'cookiesCount', listId: 'cookiesList' },
        idKeys: { containerId: 'idKeysResult', countId: 'idKeysCount', listId: 'idKeysList' },
        companies: { containerId: 'companiesResult', countId: 'companiesCount', listId: 'companiesList' },
        jwts: { containerId: 'jwtsResult', countId: 'jwtsCount', listId: 'jwtsList' },
        githubUrls: { containerId: 'githubUrlsResult', countId: 'githubUrlsCount', listId: 'githubUrlsList' },
        bearerTokens: { containerId: 'bearerTokensResult', countId: 'bearerTokensCount', listId: 'bearerTokensList' },
        basicAuth: { containerId: 'basicAuthResult', countId: 'basicAuthCount', listId: 'basicAuthList' },
        authHeaders: { containerId: 'authHeadersResult', countId: 'authHeadersCount', listId: 'authHeadersList' },
        wechatAppIds: { containerId: 'wechatAppIdsResult', countId: 'wechatAppIdsCount', listId: 'wechatAppIdsList' },
        awsKeys: { containerId: 'awsKeysResult', countId: 'awsKeysCount', listId: 'awsKeysList' },
        googleApiKeys: { containerId: 'googleApiKeysResult', countId: 'googleApiKeysCount', listId: 'googleApiKeysList' },
        githubTokens: { containerId: 'githubTokensResult', countId: 'githubTokensCount', listId: 'githubTokensList' },
        gitlabTokens: { containerId: 'gitlabTokensResult', countId: 'gitlabTokensCount', listId: 'gitlabTokensList' },
        webhookUrls: { containerId: 'webhookUrlsResult', countId: 'webhookUrlsCount', listId: 'webhookUrlsList' },
        idCards: { containerId: 'idCardsResult', countId: 'idCardsCount', listId: 'idCardsList' },
        cryptoUsage: { containerId: 'cryptoUsageResult', countId: 'cryptoUsageCount', listId: 'cryptoUsageList' },

        webpackChunks: { containerId: 'webpackChunksResult', countId: 'webpackChunksCount', listId: 'webpackChunksList' },
        webpackSourceMaps: { containerId: 'webpackSourceMapsResult', countId: 'webpackSourceMapsCount', listId: 'webpackSourceMapsList' },
        webpackDefineConstants: { containerId: 'webpackDefineConstantsResult', countId: 'webpackDefineConstantsCount', listId: 'webpackDefineConstantsList' }
    };


    Object.keys(categoryMapping).forEach(key => {
        const items = scanResults[key] || [];
        const mapping = categoryMapping[key];


        if (displayUpdateCount % 20 === 0) {

        }

        if (items.length > 0) {

            const resultDiv = document.getElementById(mapping.containerId);
            if (resultDiv) {
                resultDiv.style.display = 'block';
            }


            const countElement = document.getElementById(mapping.countId);
            if (countElement && countElement.textContent !== items.length.toString()) {
                countElement.textContent = items.length;
            }


            const listElement = document.getElementById(mapping.listId);
            if (listElement) {
                const currentItemCount = listElement.children.length;
                if (currentItemCount !== items.length) {

                    const fragment = document.createDocumentFragment();
                    items.forEach((item, index) => {
                        const li = document.createElement('li');
                        li.className = 'result-item';


                        let displayValue = '';
                        let titleValue = '';
                        const sourceUrl = (typeof item === 'object' && item !== null) ? item.sourceUrl : null;

                        if (typeof item === 'object' && item !== null) {
                            const itemValue = item.value || item.url || item.path || item.content || '';
                            const itemSourceUrl = item.sourceUrl || 'Unknown';

                            displayValue = String(itemValue);

                            if (key === 'relativeApis' && item.resolvedUrl) {
                                displayValue += `  ${item.resolvedUrl}`;
                                titleValue = `raw value: ${itemValue}
Smart Resolve: ${item.resolvedUrl}
Source: ${itemSourceUrl}`;
                            } else {
                                titleValue = `Source: ${itemSourceUrl}`;
                            }

                            if (!itemValue) {
                                displayValue = JSON.stringify(item);
                                titleValue = displayValue;
                            }
                        } else {
                            displayValue = String(item);
                            titleValue = displayValue;
                        }

                        li.textContent = displayValue;
                        li.title = titleValue;


                        li.style.cursor = 'pointer';
                        li.addEventListener('contextmenu', (e) => {
                            showContextMenu(e, item, sourceUrl);
                        });

                        fragment.appendChild(li);
                    });


                    listElement.innerHTML = '';
                    listElement.appendChild(fragment);
                }
            }
        }
    });



    Object.keys(scanResults).forEach(key => {
        if (key.startsWith('custom_') && scanResults[key]?.length > 0) {

            createCustomResultCategory(key, scanResults[key]);
        }
    });


    Object.keys(scanResults).forEach(key => {

        if (!categoryMapping[key] && !key.startsWith('custom_') && scanResults[key]?.length > 0) {

            createCustomResultCategory(key, scanResults[key]);
        }
    });
}

function createCustomResultCategory(key, items) {
    const resultsSection = document.getElementById('resultsSection');
    if (!resultsSection) return;

    let resultDiv = document.getElementById(key + 'Result');
    if (!resultDiv) {
        resultDiv = document.createElement('div');
        resultDiv.id = key + 'Result';
        resultDiv.className = 'result-category';

        const title = document.createElement('h3');

        const prefixText = document.createTextNode(' ');
        const nameText = document.createTextNode(key.replace('custom_', 'Custom-'));
        const openParen = document.createTextNode(' (');
        const countSpan = document.createElement('span');
        countSpan.id = `${key}Count`;
        countSpan.textContent = '0';
        const closeParen = document.createTextNode(')');

        title.appendChild(prefixText);
        title.appendChild(nameText);
        title.appendChild(openParen);
        title.appendChild(countSpan);
        title.appendChild(closeParen);

        const list = document.createElement('ul');
        list.id = key + 'List';
        list.className = 'result-list';

        resultDiv.appendChild(title);
        resultDiv.appendChild(list);
        resultsSection.appendChild(resultDiv);
    }

    resultDiv.style.display = 'block';

    const countElement = document.getElementById(key + 'Count');
    if (countElement) {
        countElement.textContent = items.length;
    }

    const listElement = document.getElementById(key + 'List');
    if (listElement) {
        listElement.innerHTML = '';
        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'result-item';


            let displayValue = '';
            let titleValue = '';
            const sourceUrl = (typeof item === 'object' && item !== null) ? item.sourceUrl : null;

            if (typeof item === 'object' && item !== null) {
                const itemValue = item.value || item.url || item.path || item.content || '';
                const itemSourceUrl = item.sourceUrl || 'Unknown';

                displayValue = String(itemValue);

                if (key === 'relativeApis' && item.resolvedUrl) {
                    displayValue += `  ${item.resolvedUrl}`;
                    titleValue = `raw value: ${itemValue}
Smart Resolve: ${item.resolvedUrl}
Source: ${itemSourceUrl}`;
                } else {
                    titleValue = `Source: ${itemSourceUrl}`;
                }

                if (!itemValue) {
                    displayValue = JSON.stringify(item);
                    titleValue = displayValue;
                }
            } else {
                displayValue = String(item);
                titleValue = displayValue;
            }

            li.textContent = displayValue;
            li.title = titleValue;


            li.style.cursor = 'pointer';
            li.addEventListener('contextmenu', (e) => {
                showContextMenu(e, item, sourceUrl);
            });

            listElement.appendChild(li);
        });
    }
}

function addLogEntry(message, type = 'info') {
    const logSection = document.getElementById('logSection');
    if (!logSection) return;


    if (type === 'info') {

        const lowerMessage = message.toLowerCase();
        if (lowerMessage.includes('fetched content') ||
            lowerMessage.includes('skipping non-text content') ||
            lowerMessage.includes('no new data found') ||
            lowerMessage.includes('found') ||
            lowerMessage.includes('extracted') ||
            lowerMessage.includes('scan target') ||
            lowerMessage.includes('preparing layer')) {
            return;
        }
    }


    if (type === 'warning') {
        const now = Date.now();
        if (now - lastLogTime < LOG_THROTTLE) {
            return;
        }
        lastLogTime = now;
    }

    if (!logEntries) {
        logEntries = [];
    }


    if (!logBuffer) {
        logBuffer = [];
    }
    logBuffer.push({ message, type, time: new Date().toLocaleTimeString() });


    if (!logFlushTimer) {
        logFlushTimer = setTimeout(() => {
            flushLogBuffer();
            logFlushTimer = null;
        }, 1000);
    }
}


function flushLogBuffer() {
    if (!logBuffer || logBuffer.length === 0) return;


    logEntries.push(...logBuffer);
    logBuffer = [];


    if (logEntries.length > maxLogEntries) {
        logEntries = logEntries.slice(-maxLogEntries);
    }


    updateLogDisplayVirtual();
}


function updateLogDisplay() {
    const logSection = document.getElementById('logSection');
    if (!logSection || !logEntries) return;


    if (updateLogDisplay.pending) return;
    updateLogDisplay.pending = true;


    const recentLogs = logEntries.slice(-20);


    const currentLogCount = logSection.children.length;
    if (currentLogCount === recentLogs.length) {
        updateLogDisplay.pending = false;
        return;
    }


    setTimeout(() => {

        const fragment = document.createDocumentFragment();
        recentLogs.forEach(log => {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry ${log.type}`;
            logEntry.textContent = `[${log.time}] ${log.message}`;
            fragment.appendChild(logEntry);
        });


        requestAnimationFrame(() => {
            logSection.innerHTML = '';
            logSection.appendChild(fragment);


            if (!logSection.isUserScrolling) {
                logSection.scrollTop = logSection.scrollHeight;
            }

            updateLogDisplay.pending = false;
        });
    }, 100);
}




function resolveRelativePath(relativePath, basePath) {
    try {
        if (!relativePath || !basePath) return null;


        if (!basePath.endsWith('/')) {
            basePath += '/';
        }


        const resolved = new URL(relativePath, basePath);
        return resolved.href;
    } catch (error) {
        console.warn('Relative path resolution failed:', error);
        return null;
    }
}

async function resolveUrl(url, baseUrl, sourceUrl = null) {
    try {
        if (!url) return null;




        if (url.startsWith('http://') || url.startsWith('https://')) {

            return url;
        }

        if (url.startsWith('//')) {
            const result = new URL(baseUrl).protocol + url;

            return result;
        }


        if (sourceUrl && (url.startsWith('./') || url.startsWith('../') || !url.startsWith('/'))) {


            try {

                let allScanData = [];


                try {
                    if (window.IndexedDBManager && window.IndexedDBManager.loadScanResults) {
                        const currentData = await window.IndexedDBManager.loadScanResults(baseUrl);
                        if (currentData && currentData.results) {
                            allScanData.push(currentData);

                        }
                    }
                } catch (error) {
                    console.warn('Failed to get IndexedDB data for the current domain:', error);
                }


                try {
                    if (window.IndexedDBManager && window.IndexedDBManager.getAllScanResults) {
                        const allData = await window.IndexedDBManager.getAllScanResults();
                        if (Array.isArray(allData)) {
                            allScanData = allScanData.concat(allData);

                        }
                    }
                } catch (error) {
                    console.warn('Failed to get all IndexedDB data:', error);
                }

                if (allScanData.length > 0) {

                    const sourceUrlToBasePath = new Map();




                    allScanData.forEach((scanData, dataIndex) => {
                        if (!scanData.results) return;


                        Object.values(scanData.results).forEach(items => {
                            if (Array.isArray(items)) {
                                items.forEach(item => {
                                    if (typeof item === 'object' && item.sourceUrl) {
                                        try {
                                            const sourceUrlObj = new URL(item.sourceUrl);

                                            const basePath = sourceUrlObj.pathname.substring(0, sourceUrlObj.pathname.lastIndexOf('/') + 1);
                                            const correctBaseUrl = `${sourceUrlObj.protocol}//${sourceUrlObj.host}${basePath}`;
                                            sourceUrlToBasePath.set(item.sourceUrl, correctBaseUrl);


                                        } catch (e) {

                                        }
                                    }
                                });
                            }
                        });


                        if (scanData.sourceUrl) {
                            try {
                                const sourceUrlObj = new URL(scanData.sourceUrl);
                                const basePath = sourceUrlObj.pathname.substring(0, sourceUrlObj.pathname.lastIndexOf('/') + 1);
                                const correctBaseUrl = `${sourceUrlObj.protocol}//${sourceUrlObj.host}${basePath}`;
                                sourceUrlToBasePath.set(scanData.sourceUrl, correctBaseUrl);


                            } catch (e) {

                            }
                        }
                    });




                    if (sourceUrlToBasePath.has(sourceUrl)) {
                        const correctBasePath = sourceUrlToBasePath.get(sourceUrl);
                        const resolvedUrl = resolveRelativePath(url, correctBasePath);
                        if (resolvedUrl) {

                            return resolvedUrl;
                        }
                    }


                    const targetDomain = baseUrl ? new URL(baseUrl).hostname : null;
                    if (targetDomain) {
                        for (const [storedSourceUrl, basePath] of sourceUrlToBasePath.entries()) {
                            try {
                                const sourceDomain = new URL(storedSourceUrl).hostname;
                                if (sourceDomain === targetDomain) {
                                    const testUrl = resolveRelativePath(url, basePath);
                                    if (testUrl) {

                                        return testUrl;
                                    }
                                }
                            } catch (e) {

                            }
                        }
                    }


                    for (const [storedSourceUrl, basePath] of sourceUrlToBasePath.entries()) {
                        const testUrl = resolveRelativePath(url, basePath);
                        if (testUrl) {

                            return testUrl;
                        }
                    }
                }



            } catch (error) {

            }
        }


        try {
            const resolvedUrl = new URL(url, baseUrl).href;

            return resolvedUrl;
        } catch (error) {
            console.warn('Default URL parsing failed:', error);
            return null;
        }

    } catch (error) {
        console.warn('URL Parsing failed completely:', error);
        return null;
    }
}


async function isSameDomain(url, baseUrl) {
    try {
        const urlObj = new URL(url);
        const baseUrlObj = new URL(baseUrl);


        const domainSettings = await getDomainScanSettings();




        if (domainSettings.allowAllDomains) {

            addLogEntry(` All domains allowed: ${urlObj.hostname}`, 'info');
            return true;
        }


        if (domainSettings.allowSubdomains) {
            const baseHostname = baseUrlObj.hostname;
            const urlHostname = urlObj.hostname;


            const isSameOrSubdomain = urlHostname === baseHostname ||
                                    urlHostname.endsWith('.' + baseHostname) ||
                                    baseHostname.endsWith('.' + urlHostname);

            if (isSameOrSubdomain) {


                return true;
            }
        }


        const isSame = urlObj.hostname === baseUrlObj.hostname;
        if (isSame) {

        } else {

        }
        return isSame;

    } catch (error) {
        console.error('[Deep Scan] Domain check failed:', error);
        return false;
    }
}


async function getDomainScanSettings() {
    try {

        if (typeof window.SettingsManager !== 'undefined' && window.SettingsManager.getDomainScanSettings) {
            return await window.SettingsManager.getDomainScanSettings();
        }


        const result = await chrome.storage.local.get(['domainScanSettings']);
        const domainSettings = result.domainScanSettings || {
            allowSubdomains: false,
            allowAllDomains: false
        };

        return domainSettings;
    } catch (error) {
        console.error('[Deep Scan] Failed to get domain scan settings:', error);

        return {
            allowSubdomains: false,
            allowAllDomains: false
        };
    }
}

function isValidPageUrl(url) {
    if (!url || url.startsWith('#') || url.startsWith('javascript:') || url.startsWith('mailto:')) {
        return false;
    }


    const resourceExtensions = /\.(css|png|jpg|jpeg|gif|svg|ico|woff|ttf|eot|woff2|pdf|zip)$/i;
    return !resourceExtensions.test(url.toLowerCase());
}


function getSpecialFileType(url) {
    if (!url) return null;
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.endsWith('.vue')) return 'vue';
    if (lowerUrl.endsWith('.map') || lowerUrl.includes('.js.map')) return 'sourcemap';
    if (lowerUrl.endsWith('.ts') || lowerUrl.endsWith('.tsx')) return 'typescript';

    return null;
}


function exportResults() {
    const modal = document.getElementById('exportModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function toggleAllCategories() {
    const categories = document.querySelectorAll('.result-category');
    const hasVisible = Array.from(categories).some(cat => cat.style.display !== 'none');

    categories.forEach(category => {
        category.style.display = hasVisible ? 'none' : 'block';
    });
}


document.addEventListener('DOMContentLoaded', initializePage);


document.addEventListener('click', (e) => {
    if (e.target.id === 'closeExportModal' || e.target.id === 'exportModal') {
        document.getElementById('exportModal').style.display = 'none';
    }

    if (e.target.id === 'exportJSON') {
        exportAsJSON();
        document.getElementById('exportModal').style.display = 'none';
    }

    if (e.target.id === 'exportXLS') {
        exportAsExcel();
        document.getElementById('exportModal').style.display = 'none';
    }
});

async function exportAsJSON() {
    try {
        const filename = await generateFileName('json');
        const dataStr = JSON.stringify(scanResults, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = filename;
        link.click();

        addLogEntry(` JSON Export successful: ${filename}`, 'success');
    } catch (error) {
        addLogEntry(` JSON Export failed: ${error.message}`, 'error');
    }
}

async function exportAsExcel() {
    try {
        const filename = await generateFileName('xlsx');


        const hasData = Object.keys(scanResults).some(key =>
            scanResults[key] && Array.isArray(scanResults[key]) && scanResults[key].length > 0
        );

        if (!hasData) {
            addLogEntry(` No data to export`, 'warning');
            return;
        }


        let xlsContent = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>Spectre-DeepScan</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1"/>
   <Interior ss:Color="#D4EDF9" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
  <Style ss:ID="Data">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
 </Styles>`;


        const categories = Object.keys(scanResults);
        let dataExported = false;

        categories.forEach(category => {
            const items = scanResults[category];
            if (Array.isArray(items) && items.length > 0) {
                dataExported = true;
                const sheetName = sanitizeSheetName(category);

                xlsContent += `
 <Worksheet ss:Name="${escapeXml(sheetName)}">
  <Table>
   <Column ss:Width="50"/>
   <Column ss:Width="400"/>
   <Column ss:Width="120"/>
   <Column ss:Width="350"/>
   <Column ss:Width="220"/>
   <Column ss:Width="160"/>
   <Row>
    <Cell ss:StyleID="Header"><Data ss:Type="String">No.</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Content</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">category</Data></Cell>
   <Cell ss:StyleID="Header"><Data ss:Type="String">Source URL</Data></Cell>
   <Cell ss:StyleID="Header"><Data ss:Type="String">Page Title</Data></Cell>
   <Cell ss:StyleID="Header"><Data ss:Type="String">Extracted At</Data></Cell>
   </Row>`;

                items.forEach((item, index) => {
                    const normalized = normalizeExportItem(item, category);
                    const extractedTime = normalized.extractedAt ? new Date(normalized.extractedAt).toLocaleString('en-US') : '';

                    xlsContent += `
   <Row>
    <Cell ss:StyleID="Data"><Data ss:Type="Number">${index + 1}</Data></Cell>
    <Cell ss:StyleID="Data"><Data ss:Type="String">${escapeXml(normalized.value)}</Data></Cell>
    <Cell ss:StyleID="Data"><Data ss:Type="String">${escapeXml(category)}</Data></Cell>
    <Cell ss:StyleID="Data"><Data ss:Type="String">${escapeXml(normalized.sourceUrl)}</Data></Cell>
    <Cell ss:StyleID="Data"><Data ss:Type="String">${escapeXml(normalized.pageTitle)}</Data></Cell>
    <Cell ss:StyleID="Data"><Data ss:Type="String">${escapeXml(extractedTime)}</Data></Cell>
   </Row>`;
                });

                xlsContent += `
  </Table>
 </Worksheet>`;
            }
        });


        if (!dataExported) {
            xlsContent += `
 <Worksheet ss:Name="No data">
  <Table>
   <Column ss:Width="200"/>
   <Row>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Note</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="Data"><Data ss:Type="String">No data found</Data></Cell>
   </Row>
  </Table>
 </Worksheet>`;
        }

        xlsContent += `
</Workbook>`;


        const blob = new Blob([xlsContent], {
            type: 'application/vnd.ms-excel;charset=utf-8'
        });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.xls`;
        a.click();

        URL.revokeObjectURL(url);

        addLogEntry(` Excel file exported successfully: ${filename}.xls`, 'success');

    } catch (error) {
        addLogEntry(` Excel Export failed: ${error.message}`, 'error');
        console.error('Excel Export error:', error);
    }
}


function normalizeExportItem(item, category) {
    if (item == null) {
        return {
            value: '',
            category,
            sourceUrl: '',
            pageTitle: '',
            extractedAt: ''
        };
    }

    if (typeof item !== 'object') {
        return {
            value: String(item),
            category,
            sourceUrl: '',
            pageTitle: '',
            extractedAt: ''
        };
    }

    const candidates = [item.value, item.text, item.content, item.url, item.path, item.name];
    let displayValue = candidates.find(val => val !== undefined && val !== null);

    if (displayValue === undefined || displayValue === null) {
        displayValue = JSON.stringify(item);
    } else if (typeof displayValue === 'object') {
        try {
            displayValue = JSON.stringify(displayValue);
        } catch (e) {
            displayValue = String(displayValue);
        }
    }

    return {
        value: String(displayValue),
        category,
        sourceUrl: item.sourceUrl || '',
        pageTitle: item.pageTitle || '',
        extractedAt: item.extractedAt || ''
    };
}


function sanitizeSheetName(name) {

    let sanitized = name.replace(/[\\\/\?\*\[\]:]/g, '_');

    if (sanitized.length > 31) {
        sanitized = sanitized.substring(0, 28) + '...';
    }
    return sanitized || 'Unnamed';
}


function escapeXml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}


async function generateFileName(extension = 'json') {
    let domain = 'deep-scan';

    try {

        if (scanConfig && scanConfig.baseUrl) {
            const url = new URL(scanConfig.baseUrl);
            domain = url.hostname;

        } else {

            if (window.location && window.location.href) {
                const urlParams = new URLSearchParams(window.location.search);
                const targetUrl = urlParams.get('url');
                if (targetUrl) {
                    const url = new URL(targetUrl);
                    domain = url.hostname;

                }
            }
        }
    } catch (e) {


        domain = `deep-scan_${Date.now()}`;
    }


    domain = domain.replace(/[^a-zA-Z0-9.-]/g, '_');


    const randomNum = Math.floor(100000 + Math.random() * 900000);

    return `${domain}__${randomNum}`;
}


function updateResultsDisplayVirtual() {

    flushPendingResults();

    const categoryMapping = {
        absoluteApis: { containerId: 'absoluteApisResult', countId: 'absoluteApisCount', listId: 'absoluteApisList' },
        relativeApis: { containerId: 'relativeApisResult', countId: 'relativeApisCount', listId: 'relativeApisList' },
        moduleApis: { containerId: 'modulePathsResult', countId: 'modulePathsCount', listId: 'modulePathsList' },
        domains: { containerId: 'domainsResult', countId: 'domainsCount', listId: 'domainsList' },
        urls: { containerId: 'urlsResult', countId: 'urlsCount', listId: 'urlsList' },
        images: { containerId: 'imagesResult', countId: 'imagesCount', listId: 'imagesList' },
        jsFiles: { containerId: 'jsFilesResult', countId: 'jsFilesCount', listId: 'jsFilesList' },
        cssFiles: { containerId: 'cssFilesResult', countId: 'cssFilesCount', listId: 'cssFilesList' },
        vueFiles: { containerId: 'vueFilesResult', countId: 'vueFilesCount', listId: 'vueFilesList' },
        vueRoutes: { containerId: 'vueRoutesResult', countId: 'vueRoutesCount', listId: 'vueRoutesList' },
        sourceMapSources: { containerId: 'sourceMapSourcesResult', countId: 'sourceMapSourcesCount', listId: 'sourceMapSourcesList' },
        sourceMapFiles: { containerId: 'sourceMapFilesResult', countId: 'sourceMapFilesCount', listId: 'sourceMapFilesList' },
        emails: { containerId: 'emailsResult', countId: 'emailsCount', listId: 'emailsList' },
        phoneNumbers: { containerId: 'phoneNumbersResult', countId: 'phoneNumbersCount', listId: 'phoneNumbersList' },
        ipAddresses: { containerId: 'ipAddressesResult', countId: 'ipAddressesCount', listId: 'ipAddressesList' },
        sensitiveKeywords: { containerId: 'sensitiveKeywordsResult', countId: 'sensitiveKeywordsCount', listId: 'sensitiveKeywordsList' },
        comments: { containerId: 'commentsResult', countId: 'commentsCount', listId: 'commentsList' },
        paths: { containerId: 'pathsResult', countId: 'pathsCount', listId: 'pathsList' },
        parameters: { containerId: 'parametersResult', countId: 'parametersCount', listId: 'parametersList' },
        credentials: { containerId: 'credentialsResult', countId: 'credentialsCount', listId: 'credentialsList' },
        cookies: { containerId: 'cookiesResult', countId: 'cookiesCount', listId: 'cookiesList' },
        idKeys: { containerId: 'idKeysResult', countId: 'idKeysCount', listId: 'idKeysList' },
        companies: { containerId: 'companiesResult', countId: 'companiesCount', listId: 'companiesList' },
        jwts: { containerId: 'jwtsResult', countId: 'jwtsCount', listId: 'jwtsList' },
        githubUrls: { containerId: 'githubUrlsResult', countId: 'githubUrlsCount', listId: 'githubUrlsList' },
        bearerTokens: { containerId: 'bearerTokensResult', countId: 'bearerTokensCount', listId: 'bearerTokensList' },
        basicAuth: { containerId: 'basicAuthResult', countId: 'basicAuthCount', listId: 'basicAuthList' },
        authHeaders: { containerId: 'authHeadersResult', countId: 'authHeadersCount', listId: 'authHeadersList' },
        wechatAppIds: { containerId: 'wechatAppIdsResult', countId: 'wechatAppIdsCount', listId: 'wechatAppIdsList' },
        awsKeys: { containerId: 'awsKeysResult', countId: 'awsKeysCount', listId: 'awsKeysList' },
        googleApiKeys: { containerId: 'googleApiKeysResult', countId: 'googleApiKeysCount', listId: 'googleApiKeysList' },
        githubTokens: { containerId: 'githubTokensResult', countId: 'githubTokensCount', listId: 'githubTokensList' },
        gitlabTokens: { containerId: 'gitlabTokensResult', countId: 'gitlabTokensCount', listId: 'gitlabTokensList' },
        webhookUrls: { containerId: 'webhookUrlsResult', countId: 'webhookUrlsCount', listId: 'webhookUrlsList' },
        idCards: { containerId: 'idCardsResult', countId: 'idCardsCount', listId: 'idCardsList' },
        cryptoUsage: { containerId: 'cryptoUsageResult', countId: 'cryptoUsageCount', listId: 'cryptoUsageList' },

        webpackChunks: { containerId: 'webpackChunksResult', countId: 'webpackChunksCount', listId: 'webpackChunksList' },
        webpackSourceMaps: { containerId: 'webpackSourceMapsResult', countId: 'webpackSourceMapsCount', listId: 'webpackSourceMapsList' },
        webpackDefineConstants: { containerId: 'webpackDefineConstantsResult', countId: 'webpackDefineConstantsCount', listId: 'webpackDefineConstantsList' }
    };


    const defaultRender = (itemData) => {
        const li = document.createElement('div');
        li.className = 'result-item';
        li.style.display = 'block';
        li.style.boxSizing = 'border-box';
        li.style.width = '100%';
        li.style.whiteSpace = 'normal';
        li.style.wordBreak = 'break-word';
        li.style.overflowWrap = 'anywhere';
        li.style.cursor = 'pointer';


        let displayText = '';
        let sourceUrl = null;
        let originalItem = itemData;

        if (typeof itemData === 'object' && itemData !== null) {
            displayText = itemData.displayText || itemData.value || itemData.url || itemData.path || itemData.content || JSON.stringify(itemData);
            sourceUrl = itemData.sourceUrl || null;
            originalItem = itemData.originalItem || itemData;
        } else {
            displayText = String(itemData);
        }

        li.textContent = displayText;
        if (sourceUrl) {
            li.title = 'Source: ' + sourceUrl;
        }


        li.addEventListener('contextmenu', (e) => {
            showContextMenu(e, originalItem, sourceUrl);
        });

        return li;
    };

    Object.keys(categoryMapping).forEach(key => {
        const mapping = categoryMapping[key];
        const itemsRaw = scanResults[key] || [];


        const resultDiv = document.getElementById(mapping.containerId);
        if (resultDiv) {
            resultDiv.style.display = itemsRaw.length > 0 ? 'block' : resultDiv.style.display;

            resultDiv.style.willChange = 'transform';
            resultDiv.style.transform = resultDiv.style.transform || 'translateZ(0)';
        }


        const countEl = document.getElementById(mapping.countId);
        if (countEl) countEl.textContent = String(itemsRaw.length);



        const isTrivialSlash = (it) => {
            if (typeof it === 'object' && it) {
                const raw = (it.value || it.url || it.path || it.content || '').trim();
                return raw === '/';
            }
            return String(it || '').trim() === '/';
        };


        const toRenderData = (it) => {
            if (typeof it === 'object' && it) {
                const val = it.value || it.url || it.path || it.content || '';
                let displayText;
                if (key === 'relativeApis' && it.resolvedUrl) {
                    displayText = `${String(val)} -> ${String(it.resolvedUrl)}`;
                } else {
                    displayText = String(val || JSON.stringify(it));
                }
                return {
                    displayText: displayText,
                    sourceUrl: it.sourceUrl || null,
                    originalItem: it
                };
            }
            return {
                displayText: String(it),
                sourceUrl: null,
                originalItem: it
            };
        };

        const prevCount = __lastRenderedCounts[key] || 0;
        let itemsText = __renderedTextCache[key];


        if (!Array.isArray(itemsText) || itemsText.length > itemsRaw.length || prevCount > itemsRaw.length) {
            const filteredRaw = key === 'relativeApis' ? itemsRaw.filter(it => !isTrivialSlash(it)) : itemsRaw;
            itemsText = filteredRaw.map(toRenderData);
            __renderedTextCache[key] = itemsText;
            __lastRenderedCounts[key] = itemsText.length;
            updateVirtualList(mapping.listId, itemsText, {
                itemHeight: 24,
                buffer: 8,
                renderItem: defaultRender
            });
        } else if (itemsRaw.length > prevCount) {

            let newSliceRaw = itemsRaw.slice(prevCount);
            if (key === 'relativeApis') {
                newSliceRaw = newSliceRaw.filter(it => !isTrivialSlash(it));
            }
            const newSlice = newSliceRaw.map(toRenderData);
            itemsText.push(...newSlice);
            __lastRenderedCounts[key] = itemsRaw.length;
            updateVirtualListAppend(mapping.listId, newSlice, {
                itemHeight: 24,
                buffer: 8,
                renderItem: defaultRender
            });
        } else {

        }
    });


    Object.keys(scanResults).forEach(key => {
        if (key.startsWith('custom_') && Array.isArray(scanResults[key]) && scanResults[key].length > 0) {
            createCustomResultCategory(key, scanResults[key]);
        }
    });
    Object.keys(scanResults).forEach(key => {
        if (!categoryMapping[key] && !key.startsWith('custom_') && Array.isArray(scanResults[key]) && scanResults[key].length > 0) {
            createCustomResultCategory(key, scanResults[key]);
        }
    });
}


function updateLogDisplayVirtual() {
    const logSection = document.getElementById('logSection');
    if (!logSection || !logEntries) return;


    logSection.style.willChange = 'transform';
    logSection.style.transform = logSection.style.transform || 'translateZ(0)';


    const recentLogs = logEntries.slice(-maxLogEntries);


    const shouldStickToBottom = !logSection.isUserScrolling &&
        (logSection.scrollTop + logSection.clientHeight >= logSection.scrollHeight - 4);

    const frag = document.createDocumentFragment();
    for (const l of recentLogs) {
        const div = document.createElement('div');
        div.className = 'log-entry';

        div.style.display = 'block';
        div.style.boxSizing = 'border-box';
        div.style.width = '100%';
        div.style.whiteSpace = 'normal';
        div.style.wordBreak = 'break-word';
        div.style.overflowWrap = 'anywhere';
        div.textContent = `[${l.time}] ${l.message}`;
        frag.appendChild(div);
    }

    logSection.innerHTML = '';
    logSection.appendChild(frag);

    if (shouldStickToBottom) {
        logSection.scrollTop = logSection.scrollHeight;
    }
}




function createContextMenu(item, sourceUrl) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.cssText = `
        position: fixed;
        background: #2c3e50;
        color: #ecf0f1;
        border: 1px solid #34495e;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10001;
        min-width: 180px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const menuItems = [
        {
            text: 'Copy content',
            icon: '',
            action: () => {
                let textToCopy;
                if (typeof item === 'object' && item !== null) {
                    textToCopy = item.value || item.text || item.content || item.url || item.path || JSON.stringify(item);
                } else {
                    textToCopy = String(item);
                }

                navigator.clipboard.writeText(textToCopy).then(() => {
                    showContextMenuNotification('Content copied to clipboard');
                }).catch(() => {

                    const textarea = document.createElement('textarea');
                    textarea.value = textToCopy;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    showContextMenuNotification('Content copied to clipboard');
                });
            }
        },
        {
            text: 'Copy source location',
            icon: '',
            action: () => {
                const locationUrl = sourceUrl || (typeof item === 'object' ? item.sourceUrl : null);
                if (locationUrl) {
                    navigator.clipboard.writeText(locationUrl).then(() => {
                        showContextMenuNotification('Source URL copied to clipboard');
                    }).catch(() => {
                        const textarea = document.createElement('textarea');
                        textarea.value = locationUrl;
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textarea);
                        showContextMenuNotification('Source URL copied to clipboard');
                    });
                } else {
                    showContextMenuNotification('Source location not found URL', 'error');
                }
            }
        },
        {
            text: 'Open source page',
            icon: '',
            action: () => {
                const locationUrl = sourceUrl || (typeof item === 'object' ? item.sourceUrl : null);
                if (locationUrl) {
                    window.open(locationUrl, '_blank');
                } else {
                    showContextMenuNotification('Source page not found URL', 'error');
                }
            }
        }
    ];

    menuItems.forEach((menuItem, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.style.cssText = `
            padding: 10px 14px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 14px;
            transition: background-color 0.15s ease;
            ${index === 0 ? 'border-top-left-radius: 5px; border-top-right-radius: 5px;' : ''}
            ${index === menuItems.length - 1 ? 'border-bottom-left-radius: 5px; border-bottom-right-radius: 5px;' : ''}
        `;

        const textSpan = document.createElement('span');
        textSpan.textContent = menuItem.text;

        itemDiv.appendChild(textSpan);

        itemDiv.addEventListener('mouseenter', () => {
            itemDiv.style.backgroundColor = '#34495e';
        });

        itemDiv.addEventListener('mouseleave', () => {
            itemDiv.style.backgroundColor = 'transparent';
        });

        itemDiv.addEventListener('click', () => {
            menuItem.action();
            menu.remove();
        });

        menu.appendChild(itemDiv);
    });

    return menu;
}


function showContextMenu(e, item, sourceUrl) {
    e.preventDefault();


    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    const menu = createContextMenu(item, sourceUrl);
    document.body.appendChild(menu);


    const rect = menu.getBoundingClientRect();
    let left = e.clientX;
    let top = e.clientY;


    if (left + rect.width > window.innerWidth) {
        left = window.innerWidth - rect.width - 10;
    }
    if (top + rect.height > window.innerHeight) {
        top = window.innerHeight - rect.height - 10;
    }

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';


    const closeMenu = (event) => {
        if (!menu.contains(event.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };

    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 0);
}


function showContextMenuNotification(message, type = 'success') {

    const existingNotification = document.querySelector('.context-menu-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'context-menu-notification';

    const bgColor = type === 'error' ? '#ff4757' : '#2ed573';

    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10002;
        animation: slideIn 0.3s ease;
    `;

    notification.textContent = message;
    document.body.appendChild(notification);


    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}


(function addContextMenuStyles() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(20px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        @keyframes slideOut {
            from {
                opacity: 1;
                transform: translateX(0);
            }
            to {
                opacity: 0;
                transform: translateX(20px);
            }
        }
    `;
    document.head.appendChild(style);
})();

