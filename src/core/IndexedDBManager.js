class IndexedDBManager {
    constructor() {
        this.dbName = 'PhantomScanDB';
        this.dbVersion = 2;
        this.db = null;
        this.storeName = 'scanResults';
    }


    async init() {
        if (this.db) {
            return this.db;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error(' IndexedDB open failed:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;

                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log(' IndexedDB upgrading...');


                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, {
                        keyPath: 'id',
                        autoIncrement: false
                    });


                    store.createIndex('domain', 'domain', { unique: false });
                    store.createIndex('url', 'url', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });


                }


                if (!db.objectStoreNames.contains('jsScripts')) {
                    const jsStore = db.createObjectStore('jsScripts', {
                        keyPath: 'id',
                        autoIncrement: false
                    });


                    jsStore.createIndex('timestamp', 'timestamp', { unique: false });

                    console.log(' JS script object store and indexes created');
                }
            };
        });
    }


    generateStorageKey(url) {
        try {
            const urlObj = new URL(url);

            const key = urlObj.hostname;
            return key.replace(/[^a-zA-Z0-9._-]/g, '_');
        } catch (error) {
            console.error('Failed to generate storage key:', error);
            return url.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
        }
    }


    async saveScanResults(url, results, sourceUrl = null, pageTitle = null) {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const urlObj = new URL(url);
            const storageKey = this.generateStorageKey(url);


            const actualSourceUrl = sourceUrl || url;
            const actualPageTitle = pageTitle || document.title || urlObj.hostname;
            const currentTime = new Date().toISOString();


            const transformedResults = this.dedupeResults(results, actualSourceUrl, currentTime, actualPageTitle);

            const data = {
                id: storageKey,
                domain: urlObj.hostname,
                url: url,
                results: transformedResults,
                sourceUrl: actualSourceUrl,
                pageTitle: actualPageTitle,
                extractedAt: currentTime,
                timestamp: Date.now(),
                lastSave: Date.now()
            };

            const request = store.put(data);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {

                    resolve(true);
                };

                request.onerror = () => {
                    console.error(' Failed to save scan results:', request.error);
                    reject(request.error);
                };
            });

        } catch (error) {
            console.error(' IndexedDB Save operation failed:', error);
            throw error;
        }
    }


    async loadScanResults(url) {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);

            const storageKey = this.generateStorageKey(url);
            const request = store.get(storageKey);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const result = request.result;
                    if (result) {

                        resolve({
                            results: result.results || {},
                            timestamp: result.timestamp,
                            lastSave: result.lastSave
                        });
                    } else {

                        resolve(null);
                    }
                };

                request.onerror = () => {
                    console.error(' Failed to read scan results:', request.error);
                    reject(request.error);
                };
            });

        } catch (error) {
            console.error(' IndexedDB Read operation failed:', error);
            throw error;
        }
    }


    async deleteScanResults(url) {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const storageKey = this.generateStorageKey(url);
            const request = store.delete(storageKey);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    console.log(` Scan results deleted from IndexedDB: ${storageKey}`);
                    resolve(true);
                };

                request.onerror = () => {
                    console.error(' Failed to delete scan results:', request.error);
                    reject(request.error);
                };
            });

        } catch (error) {
            console.error(' IndexedDB Delete operation failed:', error);
            throw error;
        }
    }


    async getAllScanResults() {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);

            const request = store.getAll();

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const results = request.result || [];
                    console.log(` Retrieved all scan results, total ${results.length} records`);
                    resolve(results);
                };

                request.onerror = () => {
                    console.error(' Failed to get all scan results:', request.error);
                    reject(request.error);
                };
            });

        } catch (error) {
            console.error(' IndexedDB Get-all operation failed:', error);
            throw error;
        }
    }


    async getScanResultsByDomain(domain) {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('domain');

            const request = index.getAll(domain);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const results = request.result || [];
                    console.log(` Retrieved domain ${domain} scan results, total ${results.length} records`);
                    resolve(results);
                };

                request.onerror = () => {
                    console.error(' Failed to get scan results by domain:', request.error);
                    reject(request.error);
                };
            });

        } catch (error) {
            console.error(' IndexedDB Query-by-domain operation failed:', error);
            throw error;
        }
    }


    async clearAllScanResults() {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const request = store.clear();

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    console.log(' All IndexedDB scan results cleared');
                    resolve(true);
                };

                request.onerror = () => {
                    console.error(' Failed to clear scan results:', request.error);
                    reject(request.error);
                };
            });

        } catch (error) {
            console.error(' IndexedDB Clear operation failed:', error);
            throw error;
        }
    }


    async getStats() {
        try {
            const allResults = await this.getAllScanResults();

            const stats = {
                totalRecords: allResults.length,
                domains: new Set(allResults.map(r => r.domain)).size,
                totalDataSize: 0,
                oldestRecord: null,
                newestRecord: null
            };

            if (allResults.length > 0) {

                stats.totalDataSize = allResults.reduce((size, record) => {
                    return size + JSON.stringify(record).length;
                }, 0);


                const timestamps = allResults.map(r => r.timestamp).sort((a, b) => a - b);
                stats.oldestRecord = new Date(timestamps[0]);
                stats.newestRecord = new Date(timestamps[timestamps.length - 1]);
            }

            return stats;

        } catch (error) {
            console.error(' Failed to get IndexedDB statistics:', error);
            return {
                totalRecords: 0,
                domains: 0,
                totalDataSize: 0,
                oldestRecord: null,
                newestRecord: null
            };
        }
    }


    async saveDeepScanResults(url, results, sourceUrl = null, pageTitle = null) {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const urlObj = new URL(url);
            const storageKey = this.generateStorageKey(url) + '__deep';


            const actualSourceUrl = sourceUrl || window.location.href || url;
            const actualPageTitle = pageTitle || document.title || urlObj.hostname;
            const currentTime = new Date().toISOString();


            const dedupedResults = this.dedupeResults(results, actualSourceUrl, currentTime, actualPageTitle);

            const data = {
                id: storageKey,
                domain: urlObj.hostname,
                url: url,
                results: dedupedResults,
                sourceUrl: actualSourceUrl,
                pageTitle: actualPageTitle,
                extractedAt: currentTime,
                type: 'deepScan',
                timestamp: Date.now(),
                lastSave: Date.now()
            };

            const request = store.put(data);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {

                    resolve(true);
                };

                request.onerror = () => {

                    reject(request.error);
                };
            });

        } catch (error) {
            console.error(' IndexedDB Failed to save deep scan results:', error);
            throw error;
        }
    }


    async loadDeepScanResults(url) {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);

            const storageKey = this.generateStorageKey(url) + '__deep';
            const request = store.get(storageKey);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const result = request.result;
                    if (result) {

                        resolve({
                            results: result.results || {},
                            timestamp: result.timestamp,
                            lastSave: result.lastSave
                        });
                    } else {

                        resolve(null);
                    }
                };

                request.onerror = () => {
                    console.error(' Failed to read deep scan results:', request.error);
                    reject(request.error);
                };
            });

        } catch (error) {
            console.error(' IndexedDB Failed to read deep scan results:', error);
            throw error;
        }
    }


    async saveDeepScanState(url, state) {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const urlObj = new URL(url);
            const storageKey = this.generateStorageKey(url) + '__state';

            const data = {
                id: storageKey,
                domain: urlObj.hostname,
                url: url,
                state: state,
                type: 'deepScanState',
                timestamp: Date.now(),
                lastSave: Date.now()
            };

            const request = store.put(data);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {

                    resolve(true);
                };

                request.onerror = () => {
                    console.error(' Failed to save deep scan state:', request.error);
                    reject(request.error);
                };
            });

        } catch (error) {
            console.error(' IndexedDB Failed to save deep scan state:', error);
            throw error;
        }
    }


    async loadDeepScanState(url) {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);

            const storageKey = this.generateStorageKey(url) + '__state';
            const request = store.get(storageKey);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const result = request.result;
                    if (result) {

                        resolve(result.state || {});
                    } else {
                        console.log(` IndexedDB no deep scan state found in: ${storageKey}`);
                        resolve(null);
                    }
                };

                request.onerror = () => {

                    reject(request.error);
                };
            });

        } catch (error) {
            console.error(' IndexedDB Failed to read deep scan state:', error);
            throw error;
        }
    }


    async deleteDeepScanData(url) {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const baseKey = this.generateStorageKey(url);
            const keysToDelete = [
                baseKey + '__deep',
                baseKey + '__state'
            ];

            const promises = keysToDelete.map(key => {
                return new Promise((resolve, reject) => {
                    const request = store.delete(key);
                    request.onsuccess = () => resolve(key);
                    request.onerror = () => reject(request.error);
                });
            });

            await Promise.all(promises);
            console.log(` Deep scan data deleted from IndexedDB: ${baseKey}`);
            return true;

        } catch (error) {
            console.error(' IndexedDB Failed to delete deep scan data:', error);
            throw error;
        }
    }


    async getAllDeepScanStates() {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const allData = request.result || [];

                    const deepScanStates = allData
                        .filter(item => item.id && item.id.endsWith('__state') && item.type === 'deepScanState')
                        .map(item => item.state)
                        .filter(state => state && state.baseUrl)
                        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

                    console.log(` Get all deep scan states: found ${deepScanStates.length} configs`);
                    resolve(deepScanStates);
                };
                request.onerror = () => {
                    console.error(' Failed to get all deep scan states:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error(' Failed to get all deep scan states:', error);
            return [];
        }
    }




    async saveJSScripts(scripts) {
        try {
            await this.init();

            const transaction = this.db.transaction(['jsScripts'], 'readwrite');
            const store = transaction.objectStore('jsScripts');

            return new Promise((resolve, reject) => {
                const request = store.put({
                    id: 'savedScripts',
                    scripts: scripts,
                    timestamp: Date.now()
                });

                request.onsuccess = () => {
                    console.log(' JS scripts saved, total', scripts.length, 'scripts');
                    resolve();
                };
                request.onerror = () => {
                    console.error(' JS Failed to save scripts:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error(' JS Failed to save scripts:', error);
            throw error;
        }
    }


    async loadJSScripts() {
        try {

            await this.init();

            const transaction = this.db.transaction(['jsScripts'], 'readonly');
            const store = transaction.objectStore('jsScripts');

            return new Promise((resolve, reject) => {
                const request = store.get('savedScripts');

                request.onsuccess = () => {
                    const result = request.result;


                    if (result && result.scripts) {


                        resolve(result.scripts);
                    } else {
                        console.log(' IndexedDB no JS script data found in, returning an empty array');
                        resolve([]);
                    }
                };
                request.onerror = () => {
                    console.error(' JS script load failed:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error(' JS script load failed:', error);
            return [];
        }
    }


    async clearJSScripts() {
        try {
            await this.init();

            const transaction = this.db.transaction(['jsScripts'], 'readwrite');
            const store = transaction.objectStore('jsScripts');

            return new Promise((resolve, reject) => {
                const request = store.delete('savedScripts');

                request.onsuccess = () => {
                    console.log(' JS scripts cleared');
                    resolve();
                };
                request.onerror = () => {
                    console.error(' JS Failed to clear scripts:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error(' JS Failed to clear scripts:', error);
            throw error;
        }
    }


    async getRecentScanResults(limit = 10) {
        try {
            await this.init();

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);

            return new Promise((resolve, reject) => {
                const request = store.getAll();

                request.onsuccess = () => {
                    const results = request.result || [];

                    const sortedResults = results.sort((a, b) => {
                        const timeA = new Date(a.extractedAt || a.timestamp || 0).getTime();
                        const timeB = new Date(b.extractedAt || b.timestamp || 0).getTime();
                        return timeB - timeA;
                    });


                    const limitedResults = sortedResults.slice(0, limit);
                    resolve(limitedResults);
                };

                request.onerror = () => {
                    console.error(' Failed to get recent scan results:', request.error);
                    reject(request.error);
                };
            });

        } catch (error) {
            console.error(' Get-recent-results operation failed:', error);
            return [];
        }
    }


    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.log(' IndexedDB connection closed');
        }
    }


    dedupeResults(results, sourceUrl, currentTime, pageTitle) {
        if (!results || typeof results !== 'object') {
            return results;
        }

        const dedupedResults = {};

        for (const [key, value] of Object.entries(results)) {
            if (Array.isArray(value)) {

                const seen = new Set();
                const deduped = [];

                for (const item of value) {
                    let itemValue, itemObj;

                    if (typeof item === 'string') {
                        itemValue = item;
                        itemObj = {
                            value: item,
                            sourceUrl: sourceUrl,
                            extractedAt: currentTime,
                            pageTitle: pageTitle
                        };
                    } else if (typeof item === 'object' && item !== null) {
                        itemValue = item.value || JSON.stringify(item);
                        itemObj = {
                            ...item,
                            sourceUrl: item.sourceUrl || sourceUrl,
                            extractedAt: item.extractedAt || currentTime,
                            pageTitle: item.pageTitle || pageTitle
                        };
                    } else {
                        continue;
                    }


                    if (itemValue && !seen.has(itemValue)) {

                        if ((key === 'absoluteApis' || key === 'relativeApis') && this.isInvalidPath(itemValue)) {
                            continue;
                        }
                        seen.add(itemValue);
                        deduped.push(itemObj);
                    }
                }

                dedupedResults[key] = deduped;
            } else {

                dedupedResults[key] = value;
            }
        }


        if (dedupedResults.absoluteApis && dedupedResults.relativeApis) {
            const absoluteValues = new Set(dedupedResults.absoluteApis.map(item =>
                typeof item === 'object' ? item.value : item
            ));
            dedupedResults.relativeApis = dedupedResults.relativeApis.filter(item => {
                const value = typeof item === 'object' ? item.value : item;
                return !absoluteValues.has(value);
            });
        }

        return dedupedResults;
    }


    isInvalidPath(path) {
        if (!path || typeof path !== 'string') return true;


        if (/\/this\.[_a-zA-Z]/.test(path)) return true;


        if (/\/[_a-zA-Z]+\/[gimsuvy]+$/.test(path)) return true;


        if (/\/[A-Za-z0-9]{50,}/.test(path)) return true;


        if (/\/[a-zA-Z]+\._[a-zA-Z]/.test(path)) return true;


        if (/^\/\d+$/.test(path) || /^\/[a-zA-Z]$/.test(path)) return true;


        if (/\/[A-Z]{10,}/.test(path)) return true;


        if (/\/[A-Za-z]\.[A-Za-z][A-Za-z]*(?:\(|\/|$)/.test(path)) return true;


        const segments = path.split('/');
        if (segments.some(seg => seg.length > 100)) return true;


        if (/^\/[a-zA-Z]\/[a-zA-Z]$/.test(path)) return true;

        return false;
    }
}


const indexedDBManager = new IndexedDBManager();


window.IndexedDBManager = indexedDBManager;