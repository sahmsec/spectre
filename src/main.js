class ILoveYouTranslucent7 {
    constructor() {
        this.results = {};
        this.deepScanRunning = false;
        this.scannedUrls = new Set();
        this.pendingUrls = new Set();
        this.deepScanResults = {};
        this.currentDepth = 0;
        this.maxDepth = 2;
        this.concurrency = 3;


        this.settingsManager = new SettingsManager();
        window.SettingsManager = this.settingsManager;

        this.basicScanner = new BasicScanner(this);
        this.deepScanner = new DeepScanner(this);
        this.displayManager = new DisplayManager(this);
        this.apiTester = new ApiTester(this);
        this.exportManager = new ExportManager(this);
        this.contentExtractor = new ContentExtractor();
        this.patternExtractor = new PatternExtractor();
        this.jsInjector = new JSInjector();

        this.init();
    }

    init() {

        this.initNavigation();


        this.initEventListeners();


        this.initDataSync();


        this.initMessageListeners();


        this.loadResults();
        this.autoScanIfNeeded();
    }


    initMessageListeners() {

        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'updateScanResults' ||
                message.action === 'scanProgress' ||
                message.action === 'scanComplete' ||
                message.action === 'scanError') {


                if (this.deepScanner) {
                    return this.deepScanner.handleScanWindowMessage(message, sender, sendResponse);
                }
            }
        });
    }


    initDataSync() {

        window.addEventListener('focus', () => {

            this.loadResults().then(() => {
                if (Object.keys(this.results).length > 0) {
                    this.displayResults();
                }
            });
        });


        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {

                this.loadResults().then(() => {
                    if (Object.keys(this.results).length > 0) {
                        this.displayResults();
                    }
                });
            }
        });


        setInterval(() => {
            this.checkDataIntegrity();
        }, 5000);
    }


    async checkDataIntegrity() {
        try {

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url) {
                return;
            }

            const urlObj = new URL(tab.url);
            const hostname = urlObj.hostname;
            const fullUrl = `https://${hostname}`;


            if (!window.indexedDBManager) {
                window.indexedDBManager = new IndexedDBManager();
            }


            const scanDataWrapper = await window.indexedDBManager.loadScanResults(fullUrl);
            const scanData = scanDataWrapper ? scanDataWrapper.results : null;


            const deepScanDataWrapper = await window.indexedDBManager.loadDeepScanResults(fullUrl);
            const deepScanData = deepScanDataWrapper ? deepScanDataWrapper.results : null;


            if ((scanData || deepScanData) && Object.keys(this.results || {}).length === 0) {

                await this.loadResults();
                if (Object.keys(this.results).length > 0) {
                    this.displayResults();
                }
            }
        } catch (error) {
            console.error('Data integrity check failed:', error);
        }
    }

    initEventListeners() {
        document.getElementById('scanBtn').addEventListener('click', () => this.startScan());
        document.getElementById('deepScanBtn').addEventListener('click', () => this.toggleDeepScan());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearResults());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportResults());


        const toggleButtonsBtn = document.getElementById('toggleButtonsBtn');
        if (toggleButtonsBtn) {
            toggleButtonsBtn.addEventListener('click', () => this.toggleScanButtons());
        }


        const batchRequestBtn = document.getElementById('batchRequestBtn');
        if (batchRequestBtn) {
            batchRequestBtn.addEventListener('click', () => this.batchRequestTest());
        }


        const addCustomApiBtn = document.getElementById('addCustomApiBtn');
        if (addCustomApiBtn) {
            addCustomApiBtn.addEventListener('click', () => this.addCustomApiPaths());
        }


        const closeModalBtn = document.getElementById('closeModalBtn');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                document.getElementById('requestResultModal').style.display = 'none';
            });
        }


        const toggleExpandBtn = document.getElementById('toggleExpandBtn');
        if (toggleExpandBtn) {
            toggleExpandBtn.addEventListener('click', () => {
                const resultItems = document.querySelectorAll('.result-item');
                resultItems.forEach(item => {
                    item.classList.toggle('collapsed');
                });
            });
        }

        const batchViewBtn = document.getElementById('batchViewBtn');
        if (batchViewBtn) {
            batchViewBtn.addEventListener('click', () => {
                const modal = document.getElementById('requestResultModal');
                const resultsContainer = document.getElementById('requestResults');
                resultsContainer.innerHTML = '';


                const resultItems = document.querySelectorAll('.result-item');
                resultItems.forEach(item => {
                    const clone = item.cloneNode(true);
                    clone.classList.remove('collapsed');
                    resultsContainer.appendChild(clone);
                });

                modal.style.display = 'block';
            });
        }


        const copyAllResultsBtn = document.getElementById('copyAllResultsBtn');
        if (copyAllResultsBtn) {
            copyAllResultsBtn.addEventListener('click', () => {
                const results = document.getElementById('requestResults').innerText;
                navigator.clipboard.writeText(results).then(() => {
                    const textSpan = copyAllResultsBtn.querySelector('.text');
                    if (textSpan) {
                        textSpan.textContent = ' Copied';
                        setTimeout(() => {
                            textSpan.textContent = 'Copy All Results';
                        }, 2000);
                    }
                });
            });
        }
    }


    initNavigation() {
        const navTabs = document.querySelectorAll('.nav-tab');
        const pages = document.querySelectorAll('.page');

        navTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetPage = tab.dataset.page;


                navTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');


                pages.forEach(page => {
                    page.classList.remove('active');
                    const pageId = `${targetPage}-page`;
                    if (page.id === pageId) {
                        page.classList.add('active');
                    }
                });


                this.handlePageSwitch(targetPage);
            });
        });
    }


    handlePageSwitch(pageName) {
        switch (pageName) {
            case 'scan':

                this.loadResults().then(() => {
                    if (Object.keys(this.results).length > 0) {
                        this.displayResults();
                    }
                });
                break;
            case 'deep':

                this.loadResults().then(() => {
                    this.restoreDeepScanUI();
                });
                break;
            case 'test':

                this.loadResults().then(() => {
                    this.updateCategorySelect();
                });
                break;
            case 'settings':

                if (this.settingsManager) {
                    this.settingsManager.loadSettings();
                }

                this.initCustomRegexModal();

                this.loadCustomRegexList();
                break;
            case 'js-injection':

                this.initJSInjectPage();
                break;
            case 'about':

                break;
        }
    }


    restoreDeepScanUI() {
        if (this.deepScanRunning) {
            const deepScanBtn = document.getElementById('deepScanBtn');
            const deepScanBtnText = deepScanBtn?.querySelector('.text');
            const configDiv = document.getElementById('deepScanConfig');
            const progressDiv = document.getElementById('deepScanProgress');

            if (deepScanBtnText) {
                deepScanBtnText.textContent = '⏹ Stop Scan';
            }
            if (deepScanBtn) {
                deepScanBtn.style.background = 'rgba(239, 68, 68, 0.3)';
                deepScanBtn.style.color = '#fff';
            }
            if (configDiv) {
                configDiv.style.display = 'block';
            }
            if (progressDiv) {
                progressDiv.style.display = 'block';
            }
        }


        if (this.deepScanResults && Object.keys(this.deepScanResults).length > 0) {
            this.results = this.deepScanResults;
            this.displayResults();
        }
    }


    updateCategorySelect() {
        const categorySelect = document.getElementById('categorySelect');
        if (!categorySelect || !this.results) return;


        const defaultOption = categorySelect.querySelector('option[value=""]');
        categorySelect.innerHTML = '';
        if (defaultOption) {
            categorySelect.appendChild(defaultOption);
        }


        const categories = [
            { key: 'customApis', title: 'Custom API Paths' },
            { key: 'absoluteApis', title: 'Absolute Path API' },
            { key: 'relativeApis', title: 'Relative Path API' },
            { key: 'vueRoutes', title: 'Vue Routes' },
            { key: 'jsFiles', title: 'JS Files' },
            { key: 'urls', title: 'Full URL' },
            { key: 'domains', title: 'Domains' },
            { key: 'paths', title: 'Path' }
        ];

        categories.forEach(category => {
            const items = this.results[category.key] || [];
            if (items.length > 0) {
                const option = document.createElement('option');
                option.value = category.key;
                option.textContent = `${category.title} (${items.length})`;
                categorySelect.appendChild(option);
            }
        });
    }


    resetDeepScanUI() {
        const deepScanBtn = document.getElementById('deepScanBtn');
        const deepScanBtnText = deepScanBtn?.querySelector('.text');
        const configDiv = document.getElementById('deepScanConfig');
        const progressDiv = document.getElementById('deepScanProgress');

        if (deepScanBtnText) {
            deepScanBtnText.textContent = ' Start Deep Scan';
        }
        if (deepScanBtn) {
            deepScanBtn.style.background = 'rgba(139, 92, 246, 0.3)';
            deepScanBtn.style.color = '#8b5cf6';
        }
        if (configDiv) {
            configDiv.style.display = 'none';
        }
        if (progressDiv) {
            progressDiv.style.display = 'none';
            progressDiv.innerHTML = '';
        }


        const maxDepthInput = document.getElementById('maxDepth');
        const concurrencyInput = document.getElementById('concurrency');
        if (maxDepthInput) maxDepthInput.value = '2';
        if (concurrencyInput) concurrencyInput.value = '3';
    }


    showNotification(message, type = 'info') {

        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;


        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.padding = '10px 15px';
        notification.style.borderRadius = '6px';
        notification.style.zIndex = '10000';
        notification.style.fontSize = '12px';
        notification.style.fontWeight = '500';
        notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        notification.style.animation = 'slideIn 0.3s ease';


        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#8b5cf6';
                notification.style.color = '#fff';
                break;
            case 'error':
                notification.style.backgroundColor = '#e74c3c';
                notification.style.color = '#fff';
                break;
            case 'warning':
                notification.style.backgroundColor = '#f39c12';
                notification.style.color = '#fff';
                break;
            default:
                notification.style.backgroundColor = '#8b5cf6';
                notification.style.color = '#fff';
        }


        document.body.appendChild(notification);


        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }


    async startScan(silent = false) {

        if (this.patternExtractor) {
            await this.patternExtractor.loadCustomPatterns();

        }
        try {
            return await this.basicScanner.startScan(silent);
        } finally {
            this.collapseScanButtons();
        }
    }

    collapseScanButtons() {
        const scanButtonsContainer = document.getElementById('scanButtonsContainer');
        const toggleButton = document.getElementById('toggleButtonsBtn');
        if (!scanButtonsContainer || !toggleButton) return;
        if (scanButtonsContainer.classList.contains('collapsed')) return;

        scanButtonsContainer.classList.add('collapsed');
        toggleButton.classList.add('collapsed');
        const toggleIcon = toggleButton.querySelector('.toggle-icon');
        const toggleText = toggleButton.querySelector('.toggle-text');
        if (toggleIcon) toggleIcon.textContent = '▼';
        if (toggleText) toggleText.textContent = 'Show buttons';
        const resultsContainer = document.getElementById('results');
        if (resultsContainer) resultsContainer.classList.add('expanded');
    }

    toggleDeepScan() {
        return this.deepScanner.toggleDeepScan();
    }

    displayResults() {
        return this.displayManager.displayResults();
    }

    async batchRequestTest() {
        return await this.apiTester.batchRequestTest();
    }


    addCustomApiPaths() {
        const customApiPathsInput = document.getElementById('customApiPaths');
        if (!customApiPathsInput) {
            console.error('Custom API path input box not found');
            return;
        }

        const customApiPaths = customApiPathsInput.value.trim();
        if (!customApiPaths) {
            alert('Please enter custom API paths, one per line');
            return;
        }


        const paths = this.apiTester.parseCustomApiPaths(customApiPaths);
        if (paths.length === 0) {
            alert('Please enter a valid API path');
            return;
        }


        if (!this.results.customApis) {
            this.results.customApis = [];
        }


        const existingSet = new Set(this.results.customApis);
        let addedCount = 0;

        paths.forEach(path => {
            if (!existingSet.has(path)) {
                this.results.customApis.push(path);
                existingSet.add(path);
                addedCount++;
            }
        });


        this.saveResults();


        this.displayResults();


        const message = `Successfully added ${addedCount} custom API paths to the scan results:\n${paths.join('\n')}`;
        alert(message);


        customApiPathsInput.value = '';


    }

    exportResults() {
        return this.exportManager.exportResults();
    }



    toggleScanButtons() {
        const scanButtonsContainer = document.getElementById('scanButtonsContainer');
        const toggleButton = document.getElementById('toggleButtonsBtn');
        const toggleIcon = toggleButton.querySelector('.toggle-icon');
        const toggleText = toggleButton.querySelector('.toggle-text');
        const resultsContainer = document.getElementById('results');

        if (scanButtonsContainer && toggleButton) {
            const isCollapsed = scanButtonsContainer.classList.contains('collapsed');

            if (isCollapsed) {

                scanButtonsContainer.classList.remove('collapsed');
                toggleIcon.textContent = '▲';
                toggleText.textContent = 'Hide buttons';
                toggleButton.classList.remove('collapsed');


                if (resultsContainer) {
                    resultsContainer.classList.remove('expanded');
                }
            } else {

                scanButtonsContainer.classList.add('collapsed');
                toggleIcon.textContent = '▼';
                toggleText.textContent = 'Show buttons';
                toggleButton.classList.add('collapsed');


                if (resultsContainer) {
                    resultsContainer.classList.add('expanded');
                }
            }
        }
    }


    initCustomRegexModal() {
        const addCustomRegexBtn = document.getElementById('addCustomRegexBtn');
        const customRegexModal = document.getElementById('customRegexModal');
        const closeCustomRegexModal = document.getElementById('closeCustomRegexModal');
        const confirmCustomRegexBtn = document.getElementById('confirmCustomRegexBtn');
        const cancelCustomRegexBtn = document.getElementById('cancelCustomRegexBtn');


        if (addCustomRegexBtn) {
            addCustomRegexBtn.addEventListener('click', () => {
                if (customRegexModal) {
                    customRegexModal.style.display = 'block';

                    document.getElementById('customRegexName').value = '';
                    document.getElementById('customRegexKey').value = '';
                    document.getElementById('customRegexPattern').value = '';
                }
            });
        }


        if (closeCustomRegexModal) {
            closeCustomRegexModal.addEventListener('click', () => {
                if (customRegexModal) {
                    customRegexModal.style.display = 'none';
                }
            });
        }


        if (cancelCustomRegexBtn) {
            cancelCustomRegexBtn.addEventListener('click', () => {
                if (customRegexModal) {
                    customRegexModal.style.display = 'none';
                }
            });
        }


        if (confirmCustomRegexBtn) {
            confirmCustomRegexBtn.addEventListener('click', () => {
                this.handleCustomRegexSubmit();
            });
        }


        if (customRegexModal) {
            customRegexModal.addEventListener('click', (e) => {
                if (e.target === customRegexModal) {
                    customRegexModal.style.display = 'none';
                }
            });
        }
    }



    async handleCustomRegexSubmit() {
        const nameInput = document.getElementById('customRegexName');
        const keyInput = document.getElementById('customRegexKey');
        const patternInput = document.getElementById('customRegexPattern');
        const modal = document.getElementById('customRegexModal');

        if (!nameInput || !keyInput || !patternInput) {
            this.showNotification('Input element not found', 'error');
            return;
        }

        const name = nameInput.value.trim();
        const key = keyInput.value.trim();
        const pattern = patternInput.value.trim();


        if (!name) {
            this.showNotification('Please enter a display name', 'warning');
            nameInput.focus();
            return;
        }

        if (!key) {
            this.showNotification('Please enter a storage key', 'warning');
            keyInput.focus();
            return;
        }

        if (!pattern) {
            this.showNotification('Please enter a regular expression', 'warning');
            patternInput.focus();
            return;
        }


        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) {
            this.showNotification('The storage key may contain only letters, digits and underscores, and must start with a letter', 'warning');
            keyInput.focus();
            return;
        }


        try {
            new RegExp(pattern);
        } catch (error) {
            this.showNotification('Invalid regular expression format: ' + error.message, 'error');
            patternInput.focus();
            return;
        }


        try {

            const customConfigs = await this.settingsManager.getCustomRegexConfigs();


            if (customConfigs[key]) {
                this.showNotification(`Storage Key "${key}" already exists, please use another key`, 'warning');
                keyInput.focus();
                return;
            }


            const existingNames = Object.values(customConfigs).map(config => config.name);
            if (existingNames.includes(name)) {
                this.showNotification(`Display Name "${name}" already exists, please use another name`, 'warning');
                nameInput.focus();
                return;
            }


            await this.saveCustomRegexConfig(name, key, pattern);


            if (modal) {
                modal.style.display = 'none';
            }
            this.showNotification(`Custom regex "${name}" added successfully`, 'success');

        } catch (error) {
            console.error('Failed to check for duplicates or save the config:', error);
            this.showNotification('Operation failed: ' + error.message, 'error');
        }
    }


    async saveCustomRegexConfig(name, key, pattern) {
        try {

            await this.settingsManager.saveCustomRegexConfig(key, {
                name: name,
                pattern: pattern,
                createdAt: Date.now()
            });




            if (this.patternExtractor) {
                await this.patternExtractor.loadCustomPatterns();
            }


            this.loadCustomRegexList();

        } catch (error) {
            console.error(' Failed to save custom regex config:', error);
            throw error;
        }
    }


    async loadCustomRegexList() {
        try {
            const customConfigs = await this.settingsManager.getCustomRegexConfigs();


            let listContainer = document.getElementById('customRegexList');
            if (!listContainer) {

                const addRegexBtn = document.getElementById('addCustomRegexBtn');
                if (addRegexBtn) {
                    listContainer = document.createElement('div');
                    listContainer.id = 'customRegexList';
                    listContainer.className = 'api-test-section';
                    listContainer.innerHTML = `
                        <div class="config-title">Custom regex configs added</div>
                        <div id="customRegexItems"></div>
                    `;
                    addRegexBtn.parentNode.insertBefore(listContainer, addRegexBtn);
                }
            }

            const itemsContainer = document.getElementById('customRegexItems');
            if (!itemsContainer) return;


            itemsContainer.innerHTML = '';


            if (Object.keys(customConfigs).length === 0) {
                itemsContainer.innerHTML = `
                    <div style="text-align: center; color: #888; padding: 20px; font-size: 12px;">
                        No custom regex configs yet<br>
                        Click the "Add Custom Regex" button above to add a config
                    </div>
                `;
                return;
            }


            Object.entries(customConfigs).forEach(([key, config]) => {
                const configItem = document.createElement('div');
                configItem.className = 'custom-regex-item';
                configItem.style.cssText = `
                    background: rgba(60, 46, 120, 0.22);
                    border: 1px solid rgba(167, 139, 250, 0.30);
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 10px;
                    transition: all 0.3s;
                `;

                const createdDate = config.createdAt ? new Date(config.createdAt).toLocaleString() : 'Unknown';

                configItem.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #8b5cf6; font-size: 14px; margin-bottom: 4px;">
                                <input type="text" class="edit-name-input" value="${config.name}" style="
                                    background: transparent;
                                    border: none;
                                    color: #8b5cf6;
                                    font-weight: 600;
                                    font-size: 14px;
                                    width: 100%;
                                    outline: none;
                                    border-bottom: 1px solid transparent;
                                    transition: all 0.2s;
                                " readonly>
                            </div>
                            <div style="font-size: 12px; color: #888; margin-bottom: 4px;">
                                Key: <span style="color: #ccc; font-family: monospace;">${key}</span>
                            </div>
                            <div style="font-size: 12px; color: #888; margin-bottom: 8px;">
                                Created: ${createdDate}
                            </div>
                            <div style="position: relative;">
                                <textarea class="edit-pattern-textarea" style="
                                    font-size: 12px;
                                    color: #ccc;
                                    font-family: monospace;
                                    background: rgba(0,0,0,0.3);
                                    padding: 6px;
                                    border-radius: 4px;
                                    word-break: break-all;
                                    width: 100%;
                                    border: 1px solid transparent;
                                    resize: vertical;
                                    min-height: 40px;
                                    outline: none;
                                    transition: all 0.2s;
                                " readonly>${config.pattern}</textarea>
                            </div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 5px; margin-left: 10px;">
                            <button class="edit-custom-regex-btn" data-key="${key}" style="
                                background: rgba(139, 92, 246, 0.3);
                                border: 1px solid rgba(139, 92, 246, 0.5);
                                color: #8b5cf6;
                                padding: 4px 8px;
                                border-radius: 4px;
                                font-size: 12px;
                                cursor: pointer;
                                transition: all 0.2s;
                                white-space: nowrap;
                            ">Edit</button>
                            <button class="save-custom-regex-btn" data-key="${key}" style="
                                background: rgba(52, 152, 219, 0.3);
                                border: 1px solid rgba(52, 152, 219, 0.5);
                                color: #8b5cf6;
                                padding: 4px 8px;
                                border-radius: 4px;
                                font-size: 12px;
                                cursor: pointer;
                                transition: all 0.2s;
                                white-space: nowrap;
                                display: none;
                            ">Save</button>
                            <button class="cancel-edit-regex-btn" data-key="${key}" style="
                                background: rgba(149, 165, 166, 0.3);
                                border: 1px solid rgba(149, 165, 166, 0.5);
                                color: #95a5a6;
                                padding: 4px 8px;
                                border-radius: 4px;
                                font-size: 12px;
                                cursor: pointer;
                                transition: all 0.2s;
                                white-space: nowrap;
                                display: none;
                            ">Cancel</button>
                            <button class="delete-custom-regex-btn" data-key="${key}" style="
                                background: rgba(231, 76, 60, 0.3);
                                border: 1px solid rgba(231, 76, 60, 0.5);
                                color: #e74c3c;
                                padding: 4px 8px;
                                border-radius: 4px;
                                font-size: 12px;
                                cursor: pointer;
                                transition: all 0.2s;
                                white-space: nowrap;
                            ">Delete</button>
                        </div>
                    </div>
                `;


                configItem.addEventListener('mouseenter', () => {
                    configItem.style.transform = 'translateY(-2px)';
                    configItem.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.4)';
                    configItem.style.borderColor = 'rgba(167, 139, 250, 0.28)';
                });

                configItem.addEventListener('mouseleave', () => {
                    configItem.style.transform = 'translateY(0)';
                    configItem.style.boxShadow = 'none';
                    configItem.style.borderColor = 'rgba(90, 90, 90, 0.3)';
                });


                const editBtn = configItem.querySelector('.edit-custom-regex-btn');
                const saveBtn = configItem.querySelector('.save-custom-regex-btn');
                const cancelBtn = configItem.querySelector('.cancel-edit-regex-btn');
                const deleteBtn = configItem.querySelector('.delete-custom-regex-btn');
                const nameInput = configItem.querySelector('.edit-name-input');
                const patternTextarea = configItem.querySelector('.edit-pattern-textarea');


                let originalName = config.name;
                let originalPattern = config.pattern;


                editBtn.addEventListener('click', () => {

                    nameInput.removeAttribute('readonly');
                    patternTextarea.removeAttribute('readonly');
                    nameInput.style.borderBottom = '1px solid #8b5cf6';
                    patternTextarea.style.border = '1px solid #8b5cf6';
                    patternTextarea.style.background = 'rgba(0,0,0,0.5)';


                    editBtn.style.display = 'none';
                    saveBtn.style.display = 'block';
                    cancelBtn.style.display = 'block';


                    nameInput.focus();
                });


                saveBtn.addEventListener('click', async () => {
                    const newName = nameInput.value.trim();
                    const newPattern = patternTextarea.value.trim();


                    if (!newName) {
                        this.showNotification('Please enter a display name', 'warning');
                        nameInput.focus();
                        return;
                    }

                    if (!newPattern) {
                        this.showNotification('Please enter a regular expression', 'warning');
                        patternTextarea.focus();
                        return;
                    }


                    try {
                        new RegExp(newPattern);
                    } catch (error) {
                        this.showNotification('Invalid regular expression format: ' + error.message, 'error');
                        patternTextarea.focus();
                        return;
                    }


                    const customConfigs = await this.settingsManager.getCustomRegexConfigs();
                    const existingNames = Object.entries(customConfigs)
                        .filter(([k, v]) => k !== key)
                        .map(([k, v]) => v.name);

                    if (existingNames.includes(newName)) {
                        this.showNotification(`Display Name "${newName}" already exists, please use another name`, 'warning');
                        nameInput.focus();
                        return;
                    }

                    try {

                        await this.settingsManager.saveCustomRegexConfig(key, {
                            name: newName,
                            pattern: newPattern,
                            createdAt: customConfigs[key]?.createdAt || Date.now(),
                            updatedAt: Date.now()
                        });


                        this.showNotification(`Custom regex config "${newName}" updated`, 'success');


                        if (this.patternExtractor) {
                            await this.patternExtractor.loadCustomPatterns();
                        }


                        this.loadCustomRegexList();

                    } catch (error) {
                        console.error(' Failed to update custom regex config:', error);
                        this.showNotification('Failed to update config: ' + error.message, 'error');
                    }
                });


                cancelBtn.addEventListener('click', () => {

                    nameInput.value = originalName;
                    patternTextarea.value = originalPattern;


                    nameInput.setAttribute('readonly', true);
                    patternTextarea.setAttribute('readonly', true);
                    nameInput.style.borderBottom = '1px solid transparent';
                    patternTextarea.style.border = '1px solid transparent';
                    patternTextarea.style.background = 'rgba(0,0,0,0.3)';


                    editBtn.style.display = 'block';
                    saveBtn.style.display = 'none';
                    cancelBtn.style.display = 'none';
                });


                deleteBtn.addEventListener('click', () => this.deleteCustomRegexConfig(key, config.name));


                editBtn.addEventListener('mouseenter', () => {
                    editBtn.style.background = 'rgba(139, 92, 246, 0.5)';
                    editBtn.style.borderColor = 'rgba(139, 92, 246, 0.7)';
                });
                editBtn.addEventListener('mouseleave', () => {
                    editBtn.style.background = 'rgba(139, 92, 246, 0.3)';
                    editBtn.style.borderColor = 'rgba(139, 92, 246, 0.5)';
                });

                saveBtn.addEventListener('mouseenter', () => {
                    saveBtn.style.background = 'rgba(52, 152, 219, 0.5)';
                    saveBtn.style.borderColor = 'rgba(52, 152, 219, 0.7)';
                });
                saveBtn.addEventListener('mouseleave', () => {
                    saveBtn.style.background = 'rgba(52, 152, 219, 0.3)';
                    saveBtn.style.borderColor = 'rgba(52, 152, 219, 0.5)';
                });

                cancelBtn.addEventListener('mouseenter', () => {
                    cancelBtn.style.background = 'rgba(149, 165, 166, 0.5)';
                    cancelBtn.style.borderColor = 'rgba(149, 165, 166, 0.7)';
                });
                cancelBtn.addEventListener('mouseleave', () => {
                    cancelBtn.style.background = 'rgba(149, 165, 166, 0.3)';
                    cancelBtn.style.borderColor = 'rgba(149, 165, 166, 0.5)';
                });

                deleteBtn.addEventListener('mouseenter', () => {
                    deleteBtn.style.background = 'rgba(231, 76, 60, 0.5)';
                    deleteBtn.style.borderColor = 'rgba(231, 76, 60, 0.7)';
                });
                deleteBtn.addEventListener('mouseleave', () => {
                    deleteBtn.style.background = 'rgba(231, 76, 60, 0.3)';
                    deleteBtn.style.borderColor = 'rgba(231, 76, 60, 0.5)';
                });

                itemsContainer.appendChild(configItem);
            });

        } catch (error) {
            console.error(' Failed to load the custom regex config list:', error);
        }
    }


    async deleteCustomRegexConfig(key, name) {
        if (!confirm(`Delete the custom regex config "${name}" ? This cannot be undone.`)) {
            return;
        }

        try {

            await this.settingsManager.deleteCustomRegexConfig(key);


            this.showNotification(`Custom regex config "${name}" deleted`, 'success');


            if (this.patternExtractor) {
                await this.patternExtractor.loadCustomPatterns();
            }


            this.loadCustomRegexList();

        } catch (error) {
            console.error(' Failed to delete custom regex config:', error);
            this.showNotification('Failed to delete config: ' + error.message, 'error');
        }
    }


    async autoScanIfNeeded() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });


            if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {

                return;
            }


            this.updateCurrentDomain(tab.url);

            const urlObj = new URL(tab.url);
            const fullUrl = `https://${urlObj.hostname}`;


            if (!window.indexedDBManager) {
                window.indexedDBManager = new IndexedDBManager();
            }

            const scanDataWrapper = await window.indexedDBManager.loadScanResults(fullUrl);
            const scanData = scanDataWrapper ? scanDataWrapper.results : null;


            const now = Date.now();
            const lastScanTime = scanDataWrapper ? scanDataWrapper.timestamp : 0;
            const fiveMinutes = 5 * 60 * 1000;

            if (now - lastScanTime > fiveMinutes) {
                setTimeout(() => {
                    this.startScan(true);
                }, 2000);
            }
        } catch (error) {
            console.error('Auto-scan check failed:', error);
        }
    }

    updateCurrentDomain(url) {
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname;
            const protocol = urlObj.protocol;
            const port = urlObj.port ? `:${urlObj.port}` : '';

            const domainDisplay = document.getElementById('currentDomain');
            if (domainDisplay) {
                domainDisplay.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 12px; opacity: 0.8;">Scanning:</span>
                        <span style="color: #8b5cf6; font-weight: 600;">${protocol}//${domain}${port}</span>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Failed to update the domain display:', error);
        }
    }

    async clearResults() {

        if (!confirm('Clear the scan data for the current page? This cannot be undone.')) {
            return;
        }

        try {

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url) {
                this.showNotification('Cannot get the current page URL', 'error');
                return;
            }

            const pageKey = this.getPageStorageKey(tab.url);


            this.results = {};
            this.deepScanResults = {};
            this.scannedUrls = new Set();
            this.pendingUrls = new Set();
            this.currentDepth = 0;
            this.deepScanRunning = false;


            document.getElementById('results').innerHTML = '';
            document.getElementById('stats').textContent = '';


            if (!window.indexedDBManager) {
                window.indexedDBManager = new IndexedDBManager();
            }

            const urlObj = new URL(tab.url);
            const hostname = urlObj.hostname;
            const fullUrl = `https://${hostname}`;


            await window.indexedDBManager.deleteScanResults(fullUrl);


            await window.indexedDBManager.deleteDeepScanData(fullUrl);


            this.resetDeepScanUI();


            this.showNotification(`Page ${tab.url} scan data cleared`, 'success');



        } catch (error) {
            console.error(' Failed to clear data:', error);
            this.showNotification('Failed to clear data: ' + error.message, 'error');
        }
    }


    getPageStorageKey(url) {
        try {
            const urlObj = new URL(url);

            const key = urlObj.hostname;

            return key.replace(/[^a-zA-Z0-9._-]/g, '_');
        } catch (error) {
            console.error('Failed to generate storage key:', error);

            return url.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
        }
    }

    async saveResults() {
        try {

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url) {
                console.warn(' Cannot get the current page URL, skipping save');
                return;
            }

            const urlObj = new URL(tab.url);
            const hostname = urlObj.hostname;

            const fullUrl = `https://${hostname}`;


            if (!window.indexedDBManager) {
                window.indexedDBManager = new IndexedDBManager();
            }


            if (this.results && Object.keys(this.results).length > 0) {
                await window.indexedDBManager.saveScanResults(fullUrl, this.results);

            }


            if (this.deepScanResults && Object.keys(this.deepScanResults).length > 0) {
                await window.indexedDBManager.saveDeepScanResults(fullUrl, this.deepScanResults);


            }


            const deepState = {
                running: this.deepScanRunning,
                scannedUrls: Array.from(this.scannedUrls || []),
                currentDepth: this.currentDepth,
                maxDepth: this.maxDepth,
                concurrency: this.concurrency
            };

            await window.indexedDBManager.saveDeepScanState(fullUrl, deepState);


        } catch (error) {
            console.error(' Failed to save data:', error);
        }
    }

    async loadResults() {
        try {

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url) {
                console.warn(' Cannot get the current page URL, skipping load');
                return;
            }

            const urlObj = new URL(tab.url);
            const hostname = urlObj.hostname;
            const pageKey = this.getPageStorageKey(tab.url);




            if (!window.indexedDBManager) {
                window.indexedDBManager = new IndexedDBManager();
            }


            const fullUrl = `https://${hostname}`;
            const loadedDataWrapper = await window.indexedDBManager.loadScanResults(fullUrl);
            const indexedDBResults = loadedDataWrapper ? loadedDataWrapper.results : null;


            const deepScanDataWrapper = await window.indexedDBManager.loadDeepScanResults(fullUrl);
            const deepScanResults = deepScanDataWrapper ? deepScanDataWrapper.results : null;


            let bestResults = null;
            let bestSource = '';


            const sources = [
                { data: deepScanResults, name: 'deepScanResults' },
                { data: indexedDBResults, name: 'scanResults' }
            ];

            for (const source of sources) {
                if (source.data && typeof source.data === 'object') {
                    const itemCount = Object.values(source.data).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
                    if (itemCount > 0 && (!bestResults || itemCount > Object.values(bestResults).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0))) {
                        bestResults = source.data;
                        bestSource = source.name;
                    }
                }
            }

            if (bestResults) {
                this.results = bestResults;
                this.deepScanResults = bestResults;

                this.displayResults();
            } else {

            }


            const deepState = await window.indexedDBManager.loadDeepScanState(fullUrl);
            if (deepState) {
                this.deepScanRunning = deepState.running || false;
                this.scannedUrls = new Set(deepState.scannedUrls || []);
                this.currentDepth = deepState.currentDepth || 0;
                this.maxDepth = deepState.maxDepth || 2;
                this.concurrency = deepState.concurrency || 3;






            }
        } catch (error) {
            console.error(' Failed to load results:', error);
        }
    }


    initJSInjectPage() {
        if (this.jsInjector) {

            window.jsInjector = this.jsInjector;

            setTimeout(() => {
                this.jsInjector.init();
            }, 100);
        }
    }
}

const CURRENT_VERSION = 'v1.8.1';

function compareVersion(v1, v2) {
    const arr1 = v1.replace(/^v/, '').split('.').map(Number);
    const arr2 = v2.replace(/^v/, '').split('.').map(Number);
    for (let i = 0; i < Math.max(arr1.length, arr2.length); i++) {
        const num1 = arr1[i] || 0;
        const num2 = arr2[i] || 0;
        if (num1 < num2) return -1;
        if (num1 > num2) return 1;
    }
    return 0;
}

function showUpdateModal(release) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999;
        background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;
    `;
    modal.innerHTML = `
        <div style="background:#222;padding:30px 24px;border-radius:12px;max-width:350px;color:#fff;text-align:center;box-shadow:0 0 20px #000;">
            <h2 style="color:#8b5cf6;">Xuan8a1 notice: a new version is available:${release.tag_name}</h2>
            <div style="margin:12px 0 18px 0;font-size:13px;">${release.name || ''}</div>
            <div style="margin-bottom:12px;font-size:12px;color:#ccc;">${release.body || ''}</div>
            <a href="${release.html_url}" target="_blank" style="display:inline-block;padding:8px 18px;background:#8b5cf6;color:#222;border-radius:6px;text-decoration:none;font-weight:bold;">Download</a>
            <br><button style="margin-top:18px;padding:6px 18px;background:#444;color:#fff;border:none;border-radius:6px;cursor:pointer;" id="closeUpdateModal">Close</button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#closeUpdateModal').onclick = () => modal.remove();
}

async function checkForUpdate() {
    try {
        const lastShown = localStorage.getItem('phantom_update_last_shown');
        const now = Date.now();
        if (lastShown && now - Number(lastShown) < 24 * 60 * 60 * 1000) return;

        const res = await fetch('https://www.cn-fnst.top/huanying/');
        if (!res.ok) return;
        const releases = await res.json();
        if (!Array.isArray(releases) || releases.length === 0) return;

        let maxRelease = releases[0];
        for (const r of releases) {
            if (compareVersion(maxRelease.tag_name, r.tag_name) < 0) {
                maxRelease = r;
            }
        }
        if (compareVersion(CURRENT_VERSION, maxRelease.tag_name) < 0) {
            showUpdateModal(maxRelease);
            localStorage.setItem('phantom_update_last_shown', now);
        }
    } catch (e) {}
}


async function initASTSystem() {
    console.log(' [AST] Initializing AST system...');

    try {

        if (!window.acorn) {
            console.warn(' [AST] acorn not loaded');
            return false;
        }


        if (window.astBridge) {
            console.log(' [AST] Initializing with ASTBridge...');
            const initResult = await window.astBridge.init();

            if (initResult && window.astBridge.isAvailable()) {
                console.log(' [AST] ASTBridge initialized successfully');
                return true;
            }
        }


        if (typeof window.initASTExtractor === 'function') {
            console.log(' [AST] Initializing with initASTExtractor...');
            await window.initASTExtractor();
            console.log(' [AST] ASTExtractor initialized successfully');
            return true;
        }

        console.warn(' [AST] AST module not loaded');
        return false;

    } catch (error) {
        console.error(' [AST] AST system initialization failed:', error);
        return false;
    }
}


document.addEventListener('DOMContentLoaded', async () => {

    await initASTSystem();



    window.srcMiner = new ILoveYouTranslucent7();
    checkForUpdate();
});
