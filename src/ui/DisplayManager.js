class DisplayManager {
    constructor(srcMiner) {
        this.srcMiner = srcMiner;
    }

    async displayResults() {

        if (this.srcMiner.results && Object.keys(this.srcMiner.results).length > 0) {
            this.srcMiner.saveResults();
        }


        if (!this.srcMiner.results || Object.keys(this.srcMiner.results).length === 0) {

            await this.srcMiner.loadResults();
            if (!this.srcMiner.results || Object.keys(this.srcMiner.results).length === 0) {

            }
        }

        const resultsDiv = document.getElementById('results');


        const baseCategories = [
            { key: 'customApis', title: 'Custom API Paths', icon: '' },
            { key: 'absoluteApis', title: 'Absolute Path API', icon: '/' },
            { key: 'relativeApis', title: 'Relative Path API', icon: '~' },

            { key: 'vueRoutes', title: 'Vue Routes', icon: 'Vue' },
            { key: 'modulePaths', title: 'Module Paths', icon: './' },
            { key: 'domains', title: 'Domains', icon: '' },
            { key: 'subdomains', title: 'Subdomains', icon: 'sub' },
            { key: 'urls', title: 'Full URL', icon: 'http' },
            { key: 'parameters', title: 'Parameters', icon: 'param' },
            { key: 'ports', title: 'Ports', icon: 'port' },
            { key: 'jsFiles', title: 'JS Files', icon: '.js' },
            { key: 'cssFiles', title: 'CSS Files', icon: '.css' },
            { key: 'vueFiles', title: 'Vue Files', icon: '.vue' },
            { key: 'images', title: 'Image Files', icon: '' },
            { key: 'audios', title: 'Audio Files', icon: '' },
            { key: 'videos', title: 'Video Files', icon: '' },
            { key: 'emails', title: 'Email Addresses', icon: '@' },
            { key: 'phoneNumbers', title: 'Phone Numbers', icon: '' },
            { key: 'ipAddresses', title: 'IP Addresses', icon: 'IP' },
            { key: 'credentials', title: 'Credentials', icon: '' },
            { key: 'jwts', title: 'JWT Token', icon: '' },
            { key: 'bearerTokens', title: 'Bearer Token', icon: 'Bearer' },
            { key: 'basicAuth', title: 'Basic Auth', icon: 'Basic' },
            { key: 'authHeaders', title: 'Authorization Header', icon: 'Auth' },
            { key: 'wechatAppIds', title: 'WeChat AppID', icon: 'wx' },
            { key: 'awsKeys', title: 'AWS Keys', icon: 'AWS' },
            { key: 'googleApiKeys', title: 'Google API Key', icon: 'G' },
            { key: 'githubTokens', title: 'GitHub Token', icon: 'GH' },
            { key: 'gitlabTokens', title: 'GitLab Token', icon: 'GL' },
            { key: 'webhookUrls', title: 'Webhook URLs', icon: 'Hook' },
            { key: 'idCards', title: 'ID Card Numbers', icon: '' },
            { key: 'cryptoUsage', title: 'Crypto Algorithms', icon: 'Crypto' },
            { key: 'githubUrls', title: 'GitHub Links', icon: '' },
            { key: 'companies', title: 'Companies', icon: '' },
            { key: 'cookies', title: 'Cookie Info', icon: '' },
            { key: 'idKeys', title: 'ID Keys', icon: '' },
            { key: 'sensitiveKeywords', title: 'Sensitive Keywords', icon: '' },
            { key: 'comments', title: 'Code Comments', icon: '<!--' }
        ];


        let categories = [...baseCategories];
        try {
            const result = await chrome.storage.local.get(['customRegexConfigs']);
            if (result.customRegexConfigs) {


                let configsToProcess = [];


                if (Array.isArray(result.customRegexConfigs)) {

                    configsToProcess = result.customRegexConfigs;

                } else if (typeof result.customRegexConfigs === 'object') {

                    configsToProcess = Object.entries(result.customRegexConfigs).map(([key, config]) => ({
                        key: `custom_${key}`,
                        name: config.name,
                        pattern: config.pattern,
                        createdAt: config.createdAt
                    }));

                }

                if (configsToProcess.length > 0) {
                    configsToProcess.forEach((config, index) => {
                        if (config.key && config.name) {
                            categories.push({
                                key: config.key,
                                title: config.name,
                                icon: ''
                            });

                        }
                    });


                } else {

                }
            } else {

            }
        } catch (error) {
            console.error(' DisplayManager Unified build failed to load the dynamic custom regex config:', error);
        }






        await this.loadFiltersIfNeeded();


        const filteredResults = await this.applyFiltersToResults(this.srcMiner.results);


        if (filteredResults) {
            const dynamicCustomKeys = Object.keys(filteredResults).filter(key =>
                key.startsWith('custom_') &&
                !categories.some(cat => cat.key === key)
            );

            if (dynamicCustomKeys.length > 0) {



                try {
                    const result = await chrome.storage.local.get(['customRegexConfigs']);
                    const customConfigs = result.customRegexConfigs || {};

                    dynamicCustomKeys.forEach(key => {
                        let displayName = key.replace('custom_', 'Custom regex-');


                        const configKey = key.replace('custom_', '');


                        if (Array.isArray(customConfigs)) {

                            const config = customConfigs.find(c => c.key === key);
                            if (config && config.name) {
                                displayName = config.name;
                            }
                        } else if (typeof customConfigs === 'object') {

                            if (customConfigs[configKey] && customConfigs[configKey].name) {
                                displayName = customConfigs[configKey].name;
                            }
                        }

                        categories.push({
                            key: key,
                            title: displayName,
                            icon: ''
                        });

                    });
                } catch (error) {
                    console.error(' Failed to get the custom regex config name:', error);

                    dynamicCustomKeys.forEach(key => {
                        const displayName = key.replace('custom_', 'Custom regex-');
                        categories.push({
                            key: key,
                            title: displayName,
                            icon: ''
                        });

                    });
                }
            }
        }

        resultsDiv.innerHTML = '';
        let totalCount = 0;
        const frag = document.createDocumentFragment();

        categories.forEach(category => {
            const items = filteredResults[category.key] || [];
            totalCount += items.length;
            if (items.length > 0) {
                frag.appendChild(this.createCategoryDiv(category, items));
            }
        });
        resultsDiv.appendChild(frag);


        if (totalCount === 0) {
            resultsDiv.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #8b5cf6;">
                    <h3>Scan complete</h3>
                    <p>No extractable information found on the current page</p>
                    <p style="font-size: 12px; margin-top: 10px; opacity: 0.7;">
                        This may be because:<br>
                        • the page has little content<br>
                        • the information is encrypted or obfuscated<br>
                        • the page uses complex dynamic loading<br>
                        • Try a deep scan to find more
                    </p>
                </div>
            `;
        }


        const scanMode = this.srcMiner.deepScanRunning ? 'Deep scanning' : 'Standard scan';
        const scannedCount = this.srcMiner.scannedUrls ? this.srcMiner.scannedUrls.size : 1;
        const currentDepth = this.srcMiner.currentDepth || 0;
        const maxDepth = this.srcMiner.maxDepth || 2;


        const realtimeIndicator = this.srcMiner.deepScanRunning ?
            '<span style="color: #8b5cf6; animation: pulse 1s infinite;">●</span> Live updating' : '';

        document.getElementById('stats').innerHTML = `
            <div>Found <strong>${totalCount}</strong> items ${realtimeIndicator}</div>
            <div style="margin-top: 5px; font-size: 11px; opacity: 0.7;">
                Scan mode: ${scanMode} | Scanned: ${scannedCount} files
                ${this.srcMiner.deepScanRunning ? ` | depth: ${currentDepth}/${maxDepth}` : ''}<br>
                Last updated: ${new Date().toLocaleTimeString()}
            </div>
        `;


        if (!document.getElementById('realtimeStyles')) {
            const style = document.createElement('style');
            style.id = 'realtimeStyles';
            style.textContent = `
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    getItemText(item) {
        if (typeof item === 'object' && item !== null) {
            return item.fullUrl || item.url || item.value || item.path || item.content || item.name || JSON.stringify(item);
        }
        return String(item);
    }

    createCategoryDiv(category, items) {
        const RENDER_CAP = 200;

        const div = document.createElement('div');
        div.className = 'category';
        div.dataset.categoryKey = category.key;

        const header = document.createElement('div');
        header.className = 'category-header';

        const headerActions = document.createElement('div');
        headerActions.style.display = 'flex';
        headerActions.style.gap = '5px';
        headerActions.style.alignItems = 'center';

        const content = document.createElement('div');
        content.className = 'category-content';
        content._items = items;

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'btn toggle-btn';
        toggleBtn.textContent = 'Expand/Collapse';
        toggleBtn.title = 'Expand or collapse the content';
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            content.classList.toggle('collapsed');
        });
        headerActions.appendChild(toggleBtn);

        const batchViewBtn = document.createElement('button');
        batchViewBtn.className = 'btn batch-view-btn';
        batchViewBtn.textContent = 'View all';
        batchViewBtn.title = 'View all content in a new window';
        batchViewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showBatchViewOnly(category.title, items);
        });
        headerActions.appendChild(batchViewBtn);

        const copyAllBtn = document.createElement('button');
        copyAllBtn.className = 'btn copy-all-btn';
        copyAllBtn.textContent = 'Copy all';
        copyAllBtn.title = 'Copy all content';
        copyAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyAllItems(category.key, items);
        });
        headerActions.appendChild(copyAllBtn);

        const countBadge = document.createElement('span');
        countBadge.className = 'count-badge';
        countBadge.textContent = items.length;
        headerActions.appendChild(countBadge);

        header.innerHTML = `<span class="category-title">${this.escapeHtml(category.title)}</span>`;
        header.appendChild(headerActions);

        const shown = items.length > RENDER_CAP ? items.slice(0, RENDER_CAP) : items;
        let html = '';
        for (let i = 0; i < shown.length; i++) {
            html += `<div class="item" data-i="${i}" title="Click to copy">${this.escapeHtml(this.getItemText(shown[i]))}</div>`;
        }
        content.innerHTML = html;

        if (items.length > RENDER_CAP) {
            const more = document.createElement('div');
            more.className = 'item item-more';
            more.textContent = `Showing first ${RENDER_CAP} of ${items.length} entries · click to view all`;
            more.addEventListener('click', () => this.showBatchViewOnly(category.title, items));
            content.appendChild(more);
        }

        content.addEventListener('click', (e) => {
            const row = e.target.closest('.item');
            if (!row || row.classList.contains('item-more')) return;
            const i = parseInt(row.dataset.i, 10);
            if (isNaN(i)) return;
            const text = this.getItemText(content._items[i]);
            navigator.clipboard.writeText(text).then(() => {
                row.classList.add('copied');
                setTimeout(() => row.classList.remove('copied'), 1000);
            });
        });

        content.addEventListener('contextmenu', (e) => {
            const row = e.target.closest('.item');
            if (!row || row.classList.contains('item-more')) return;
            const i = parseInt(row.dataset.i, 10);
            if (isNaN(i)) return;
            e.preventDefault();
            const existing = document.querySelector('.context-menu');
            if (existing) existing.remove();
            const menu = this.createContextMenu(content._items[i]);
            document.body.appendChild(menu);
            const rect = menu.getBoundingClientRect();
            let left = e.clientX;
            let top = e.clientY;
            if (left + rect.width > window.innerWidth) left = window.innerWidth - rect.width - 10;
            if (top + rect.height > window.innerHeight) top = window.innerHeight - rect.height - 10;
            menu.style.left = left + 'px';
            menu.style.top = top + 'px';
            const closeMenu = (ev) => {
                if (!menu.contains(ev.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            };
            setTimeout(() => document.addEventListener('click', closeMenu), 0);
        });

        let hoverTimer = null;
        let tooltip = null;
        let tipRow = null;
        const clearTip = () => {
            if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
            if (tooltip) { tooltip.remove(); tooltip = null; }
            tipRow = null;
        };
        content.addEventListener('mouseover', (e) => {
            const row = e.target.closest('.item');
            if (!row || row === tipRow || row.classList.contains('item-more')) return;
            clearTip();
            tipRow = row;
            const i = parseInt(row.dataset.i, 10);
            if (isNaN(i)) return;
            hoverTimer = setTimeout(async () => {
                try {
                    const info = await this.getItemLocationInfo(category.key, content._items[i]);
                    if (info && tipRow === row) {
                        tooltip = this.createTooltip(info);
                        document.body.appendChild(tooltip);
                        this.positionTooltip(tooltip, row);
                    }
                } catch (err) {}
            }, 500);
        });
        content.addEventListener('mouseout', (e) => {
            const row = e.target.closest('.item');
            const to = e.relatedTarget;
            if (row && (!to || !row.contains(to))) clearTip();
        });
        content.addEventListener('mousemove', (e) => {
            if (tooltip && tipRow) this.positionTooltip(tooltip, tipRow, e);
        });

        header.addEventListener('click', () => {
            content.classList.toggle('collapsed');
        });

        div.appendChild(header);
        div.appendChild(content);

        return div;
    }


    showBatchViewOnly(title, items) {

        let modal = document.getElementById('batchViewModal');
        if (!modal) {

            modal = document.createElement('div');
            modal.id = 'batchViewModal';
            modal.style.display = 'none';
            modal.style.position = 'fixed';
            modal.style.zIndex = '1000';
            modal.style.left = '0';
            modal.style.top = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.backgroundColor = 'rgba(0,0,0,0.7)';

            const modalContent = document.createElement('div');
            modalContent.style.backgroundColor = 'rgb(23, 22, 46)';
            modalContent.style.margin = '15% auto';
            modalContent.style.padding = '20px';
            modalContent.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            modalContent.style.width = '80%';
            modalContent.style.maxWidth = '600px';
            modalContent.style.borderRadius = '10px';
            modalContent.style.boxShadow = '0px 0px 15px 8px rgba(0, 0, 0, 0.8)';
            modalContent.style.transition = 'all 0.3s';

            const modalHeader = document.createElement('div');
            modalHeader.style.display = 'flex';
            modalHeader.style.justifyContent = 'space-between';
            modalHeader.style.alignItems = 'center';
            modalHeader.style.marginBottom = '15px';

            const modalTitle = document.createElement('h3');
            modalTitle.style.margin = '0';
            modalTitle.style.color = '#8b5cf6';
            modalTitle.style.fontSize = '18px';
            modalTitle.style.fontWeight = '600';

            const closeBtn = document.createElement('button');
            closeBtn.id = 'closeBatchViewBtn';
            closeBtn.textContent = '×';
            closeBtn.style.background = 'none';
            closeBtn.style.border = 'none';
            closeBtn.style.color = '#ccc';
            closeBtn.style.fontSize = '24px';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.transition = 'all 0.3s';
            closeBtn.style.width = '30px';
            closeBtn.style.height = '30px';
            closeBtn.style.display = 'flex';
            closeBtn.style.justifyContent = 'center';
            closeBtn.style.alignItems = 'center';
            closeBtn.style.borderRadius = '50%';

            closeBtn.onmouseover = () => {
                closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                closeBtn.style.color = '#fff';
            };

            closeBtn.onmouseout = () => {
                closeBtn.style.backgroundColor = 'transparent';
                closeBtn.style.color = '#ccc';
            };

            const resultsContainer = document.createElement('div');
            resultsContainer.id = 'batchViewResults';

            modalHeader.appendChild(modalTitle);
            modalHeader.appendChild(closeBtn);
            modalContent.appendChild(modalHeader);
            modalContent.appendChild(resultsContainer);
            modal.appendChild(modalContent);
            document.body.appendChild(modal);


            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        const resultsContainer = document.getElementById('batchViewResults');
        const modalTitle = modal.querySelector('h3');

        modalTitle.textContent = title;
        const BATCH_CAP = 2000;
        const viewItems = items.length > BATCH_CAP ? items.slice(0, BATCH_CAP) : items;
        resultsContainer.innerHTML = `<h4>${title} (${items.length} items${items.length > BATCH_CAP ? `, showing only the first ${BATCH_CAP}; use Copy all for the complete data` : ''})</h4>`;

        const list = document.createElement('div');
        list.style.maxHeight = '400px';
        list.style.overflowY = 'auto';
        list.style.padding = '10px';
        list.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        list.style.borderRadius = '8px';
        list.style.marginTop = '10px';
        list.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';

        viewItems.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'result-item';



            if (typeof item === 'object' && item !== null) {

                if (item.fullUrl || item.url || item.value || item.path || item.content || item.name) {
                    itemDiv.textContent = item.fullUrl || item.url || item.value || item.path || item.content || item.name || JSON.stringify(item);
                } else {
                    itemDiv.textContent = JSON.stringify(item);
                }
            } else {

                itemDiv.textContent = String(item);
            }

            itemDiv.style.padding = '8px 10px';
            itemDiv.style.margin = '3px 0';
            itemDiv.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
            itemDiv.style.wordBreak = 'break-all';
            itemDiv.style.transition = 'all 0.3s';
            itemDiv.style.borderRadius = '4px';
            itemDiv.style.cursor = 'pointer';


            let tooltip = null;

            itemDiv.onmouseover = async (e) => {
                itemDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                itemDiv.style.transform = 'translateX(3px)';


                if (!tooltip) {
                    tooltip = document.createElement('div');
                    tooltip.style.position = 'fixed';
                    tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
                    tooltip.style.color = '#fff';
                    tooltip.style.padding = '8px 12px';
                    tooltip.style.borderRadius = '6px';
                    tooltip.style.fontSize = '12px';
                    tooltip.style.zIndex = '10000';
                    tooltip.style.maxWidth = '300px';
                    tooltip.style.wordWrap = 'break-word';
                    tooltip.style.border = '1px solid rgba(255, 255, 255, 0.2)';
                    tooltip.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                    tooltip.style.pointerEvents = 'none';
                    document.body.appendChild(tooltip);
                }


                try {
                    const locationInfo = await this.getItemLocationInfo(item);
                    tooltip.innerHTML = `
                        <div style="font-weight: bold; color: #8b5cf6; margin-bottom: 4px;">Source info</div>
                        <div><strong>Page:</strong> ${locationInfo.pageTitle}</div>
                        <div><strong>URL:</strong> ${locationInfo.sourceUrl}</div>
                        <div><strong>Time:</strong> ${new Date(locationInfo.extractedAt).toLocaleString('en-US')}</div>
                    `;
                } catch (error) {
                    tooltip.innerHTML = `
                        <div style="font-weight: bold; color: #ff6b6b; margin-bottom: 4px;">Source info</div>
                        <div>Failed to get source info</div>
                    `;
                }


                const rect = itemDiv.getBoundingClientRect();
                tooltip.style.left = (rect.left + 10) + 'px';
                tooltip.style.top = (rect.top - tooltip.offsetHeight - 10) + 'px';


                const tooltipRect = tooltip.getBoundingClientRect();
                if (tooltipRect.left < 0) {
                    tooltip.style.left = '10px';
                }
                if (tooltipRect.right > window.innerWidth) {
                    tooltip.style.left = (window.innerWidth - tooltipRect.width - 10) + 'px';
                }
                if (tooltipRect.top < 0) {
                    tooltip.style.top = (rect.bottom + 10) + 'px';
                }
            };

            itemDiv.onmouseout = () => {
                itemDiv.style.backgroundColor = 'transparent';
                itemDiv.style.transform = 'translateX(0)';


                if (tooltip) {
                    document.body.removeChild(tooltip);
                    tooltip = null;
                }
            };


            itemDiv.addEventListener('contextmenu', (e) => {
                e.preventDefault();


                const existingMenu = document.querySelector('.context-menu');
                if (existingMenu) {
                    existingMenu.remove();
                }

                const menu = this.createContextMenu(item);
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
            });

            list.appendChild(itemDiv);
        });

        resultsContainer.appendChild(list);
        modal.style.display = 'block';
    }


    copyAllItems(categoryKey, items) {
        if (!items || items.length === 0) return;



        const processedItems = items.map(item => {
            if (typeof item === 'object' && item !== null) {

                if (item.fullUrl || item.url || item.value || item.path || item.content || item.name) {
                    return item.fullUrl || item.url || item.value || item.path || item.content || item.name || JSON.stringify(item);
                } else {
                    return JSON.stringify(item);
                }
            } else {

                return String(item);
            }
        });

        const text = processedItems.join('\n');
        navigator.clipboard.writeText(text).then(() => {

            const categoryDiv = document.querySelector(`.category[data-category-key="${categoryKey}"]`);
            if (categoryDiv) {
                const copyBtn = categoryDiv.querySelector('.copy-all-btn');
                if (copyBtn) {
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = ' Copied';
                    setTimeout(() => {
                        copyBtn.textContent = originalText;
                    }, 2000);
                }
            }
        });
    }


    async testAllApis(categoryKey, items) {
        if (!items || items.length === 0) return;


        const testTab = document.querySelector('.nav-tab[data-page="test"]');
        if (testTab) {
            testTab.click();
        }


        setTimeout(() => {

            const categorySelect = document.getElementById('categorySelect');
            if (categorySelect) {
                categorySelect.value = categoryKey;


                const changeEvent = new Event('change', { bubbles: true });
                categorySelect.dispatchEvent(changeEvent);
            }


            if (this.srcMiner.apiTester) {

                const concurrencyInput = document.getElementById('apiConcurrency');
                const timeoutInput = document.getElementById('apiTimeout');
                const concurrency = concurrencyInput ? parseInt(concurrencyInput.value) : 8;
                const timeout = timeoutInput ? parseInt(timeoutInput.value) * 1000 : 5000;


                const method = document.getElementById('requestMethod')?.value || 'GET';



                const baseApiPathInput = document.getElementById('baseApiPath');
                const rawBaseApiPaths = baseApiPathInput ? baseApiPathInput.value.trim() : '';
                const customBaseApiPaths = this.srcMiner.apiTester.normalizeMultipleBaseApiPaths(rawBaseApiPaths);


                if (rawBaseApiPaths) {
                    const originalPaths = rawBaseApiPaths.split('\n').map(p => p.trim()).filter(p => p);
                    const normalizedPaths = customBaseApiPaths;


                    originalPaths.forEach((originalPath, index) => {
                        const normalizedPath = normalizedPaths[index];
                        if (originalPath && originalPath !== normalizedPath) {

                        }
                    });

                    if (customBaseApiPaths.length > 1) {

                    }
                }


                const customApiPathsInput = document.getElementById('customApiPaths');
                const customApiPaths = customApiPathsInput ? customApiPathsInput.value.trim() : '';


                if (customApiPaths) {
                    const customPaths = this.srcMiner.apiTester.parseCustomApiPaths(customApiPaths);
                    items = this.srcMiner.apiTester.mergeAndDeduplicateItems(items, customPaths);

                }

                this.srcMiner.apiTester.testSelectedCategory(categoryKey, items, method, concurrency, timeout, customBaseApiPaths);

            } else {
                this.showNotification('API Tester not initialized, cannot run the test', 'error');
            }
        }, 100);
    }


    showApiTestResults(results) {

        let modal = document.getElementById('apiTestResultsModal');
        if (!modal) {

            modal = document.createElement('div');
            modal.id = 'apiTestResultsModal';
            modal.style.display = 'none';
            modal.style.position = 'fixed';
            modal.style.zIndex = '1000';
            modal.style.left = '0';
            modal.style.top = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.backgroundColor = 'rgba(0,0,0,0.7)';

            const modalContent = document.createElement('div');
            modalContent.style.backgroundColor = 'rgb(23, 22, 46)';
            modalContent.style.margin = '5% auto';
            modalContent.style.padding = '20px';
            modalContent.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            modalContent.style.width = '90%';
            modalContent.style.maxWidth = '800px';
            modalContent.style.borderRadius = '10px';
            modalContent.style.maxHeight = '80vh';
            modalContent.style.overflowY = 'auto';
            modalContent.style.boxShadow = '0px 0px 15px 8px rgba(0, 0, 0, 0.8)';
            modalContent.style.transition = 'all 0.3s';

            const modalHeader = document.createElement('div');
            modalHeader.style.display = 'flex';
            modalHeader.style.justifyContent = 'space-between';
            modalHeader.style.alignItems = 'center';
            modalHeader.style.marginBottom = '15px';

            const modalTitle = document.createElement('h3');
            modalTitle.textContent = 'API Test Results';
            modalTitle.style.margin = '0';
            modalTitle.style.color = '#8b5cf6';
            modalTitle.style.fontSize = '18px';
            modalTitle.style.fontWeight = '600';

            const closeBtn = document.createElement('button');
            closeBtn.textContent = '×';
            closeBtn.style.background = 'none';
            closeBtn.style.border = 'none';
            closeBtn.style.color = '#ccc';
            closeBtn.style.fontSize = '24px';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.transition = 'all 0.3s';
            closeBtn.style.width = '30px';
            closeBtn.style.height = '30px';
            closeBtn.style.display = 'flex';
            closeBtn.style.justifyContent = 'center';
            closeBtn.style.alignItems = 'center';
            closeBtn.style.borderRadius = '50%';

            closeBtn.onmouseover = () => {
                closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                closeBtn.style.color = '#fff';
            };

            closeBtn.onmouseout = () => {
                closeBtn.style.backgroundColor = 'transparent';
                closeBtn.style.color = '#ccc';
            };

            const resultsContainer = document.createElement('div');
            resultsContainer.id = 'apiTestResultsContainer';

            modalHeader.appendChild(modalTitle);
            modalHeader.appendChild(closeBtn);
            modalContent.appendChild(modalHeader);
            modalContent.appendChild(resultsContainer);
            modal.appendChild(modalContent);
            document.body.appendChild(modal);


            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        const resultsContainer = document.getElementById('apiTestResultsContainer');
        resultsContainer.innerHTML = '';


        const summary = document.createElement('div');
        summary.style.marginBottom = '20px';
        summary.style.padding = '15px';
        summary.style.backgroundColor = 'rgba(139, 92, 246, 0.1)';
        summary.style.borderRadius = '8px';
        summary.style.border = '1px solid rgba(139, 92, 246, 0.2)';
        summary.style.transition = 'all 0.3s';

        const successCount = results.filter(r => r.success).length;
        const failCount = results.length - successCount;

        summary.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px; color: #8b5cf6;">Test Summary:</div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>Total:</span>
                <span style="font-weight: 600;">${results.length} APIs</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>Success:</span>
                <span style="color: #8b5cf6; font-weight: 600;">${successCount}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>Failed:</span>
                <span style="color: #f44336; font-weight: 600;">${failCount}</span>
            </div>
        `;

        summary.onmouseover = () => {
            summary.style.backgroundColor = 'rgba(139, 92, 246, 0.15)';
            summary.style.transform = 'translateY(-2px)';
            summary.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.1)';
        };

        summary.onmouseout = () => {
            summary.style.backgroundColor = 'rgba(139, 92, 246, 0.1)';
            summary.style.transform = 'translateY(0)';
            summary.style.boxShadow = 'none';
        };

        resultsContainer.appendChild(summary);


        const detailsContainer = document.createElement('div');

        results.forEach((result, index) => {
            const resultItem = document.createElement('div');
            resultItem.style.marginBottom = '15px';
            resultItem.style.padding = '12px';
            resultItem.style.border = '1px solid ' + (result.success ? 'rgba(139, 92, 246, 0.3)' : 'rgba(244, 67, 54, 0.3)');
            resultItem.style.borderRadius = '8px';
            resultItem.style.backgroundColor = result.success ? 'rgba(139, 92, 246, 0.1)' : 'rgba(244, 67, 54, 0.1)';
            resultItem.style.transition = 'all 0.3s';

            const statusColor = result.success ? '#8b5cf6' : '#f44336';
            const statusText = result.success ? 'Success' : 'Failed';
            const statusCode = result.status || 'N/A';

            resultItem.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <div style="font-weight: bold; word-break: break-all; max-width: 80%;">${index + 1}. ${result.url}</div>
                    <div style="color: ${statusColor}; font-weight: 600; white-space: nowrap;">${statusText} (${statusCode})</div>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 5px;">
                    <div>
                        <span style="color: #888;">Method:</span>
                        <span style="color: #fff; font-weight: 500;">${result.method}</span>
                    </div>
                    <div>
                        <span style="color: #888;">Time:</span>
                        <span style="color: #fff; font-weight: 500;">${result.time}ms</span>
                    </div>
                </div>
            `;

            resultItem.onmouseover = () => {
                resultItem.style.transform = 'translateY(-2px)';
                resultItem.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.2)';
                resultItem.style.borderColor = result.success ? 'rgba(139, 92, 246, 0.5)' : 'rgba(244, 67, 54, 0.5)';
            };

            resultItem.onmouseout = () => {
                resultItem.style.transform = 'translateY(0)';
                resultItem.style.boxShadow = 'none';
                resultItem.style.borderColor = result.success ? 'rgba(139, 92, 246, 0.3)' : 'rgba(244, 67, 54, 0.3)';
            };


            if (result.data) {
                const dataContainer = document.createElement('div');
                dataContainer.style.marginTop = '10px';

                const dataToggle = document.createElement('button');
                dataToggle.textContent = 'Show response data';
                dataToggle.style.background = 'rgba(139, 92, 246, 0.2)';
                dataToggle.style.border = '1px solid #8b5cf6';
                dataToggle.style.borderRadius = '6px';
                dataToggle.style.padding = '5px 10px';
                dataToggle.style.fontSize = '12px';
                dataToggle.style.color = '#8b5cf6';
                dataToggle.style.cursor = 'pointer';
                dataToggle.style.marginBottom = '8px';
                dataToggle.style.transition = 'all 0.3s';

                const dataContent = document.createElement('pre');
                dataContent.style.display = 'none';
                dataContent.style.maxHeight = '200px';
                dataContent.style.overflowY = 'auto';
                dataContent.style.padding = '10px';
                dataContent.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
                dataContent.style.borderRadius = '8px';
                dataContent.style.fontSize = '12px';
                dataContent.style.whiteSpace = 'pre-wrap';
                dataContent.style.wordBreak = 'break-all';
                dataContent.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                dataContent.style.transition = 'all 0.3s';

                dataToggle.onmouseover = () => {
                    dataToggle.style.background = 'rgba(139, 92, 246, 0.3)';
                    dataToggle.style.transform = 'translateY(-1px)';
                };

                dataToggle.onmouseout = () => {
                    dataToggle.style.background = 'rgba(139, 92, 246, 0.2)';
                    dataToggle.style.transform = 'translateY(0)';
                };

                try {

                    if (typeof result.data === 'string') {
                        try {
                            const jsonData = JSON.parse(result.data);
                            dataContent.textContent = JSON.stringify(jsonData, null, 2);
                        } catch (e) {
                            dataContent.textContent = result.data;
                        }
                    } else {
                        dataContent.textContent = JSON.stringify(result.data, null, 2);
                    }
                } catch (e) {
                    dataContent.textContent = 'Cannot display the response data';
                }

                dataToggle.addEventListener('click', () => {
                    if (dataContent.style.display === 'none') {
                        dataContent.style.display = 'block';
                        dataToggle.textContent = 'Hide response data';
                    } else {
                        dataContent.style.display = 'none';
                        dataToggle.textContent = 'Show response data';
                    }
                });

                dataContainer.appendChild(dataToggle);
                dataContainer.appendChild(dataContent);
                resultItem.appendChild(dataContainer);
            }

            detailsContainer.appendChild(resultItem);
        });

        resultsContainer.appendChild(detailsContainer);


        modal.style.display = 'block';
    }


    showNotification(message, type = 'info') {

        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;


        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '4px';
        notification.style.zIndex = '1000';
        notification.style.fontSize = '14px';


        switch (type) {
            case 'success':
                notification.style.backgroundColor = 'rgba(139, 92, 246, 0.9)';
                notification.style.color = 'white';
                break;
            case 'error':
                notification.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
                notification.style.color = 'white';
                break;
            case 'warning':
                notification.style.backgroundColor = 'rgba(255, 152, 0, 0.9)';
                notification.style.color = 'white';
                break;
            default:
                notification.style.backgroundColor = 'rgba(139, 92, 246, 0.9)';
                notification.style.color = 'white';
        }


        document.body.appendChild(notification);


        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.5s';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 500);
        }, 3000);
    }


    async loadFiltersIfNeeded() {
        try {

            if (window.domainPhoneFilter && window.apiFilter) {

                return;
            }




            if (typeof chrome !== 'undefined' && chrome.runtime) {

                if (!window.domainPhoneFilter) {
                    await this.loadFilterScript('filters/domainfilter.js');


                    if (typeof DomainPhoneFilter !== 'undefined') {
                        window.domainPhoneFilter = new DomainPhoneFilter();

                    }
                }


                if (!window.apiFilter) {
                    await this.loadFilterScript('filters/apifilter.js');

                }


            } else {
                console.warn(' Not an extension environment, cannot load filters');
            }
        } catch (error) {
            console.error(' Failed to load filters:', error);
        }
    }


    async loadFilterScript(scriptPath) {
        return new Promise((resolve, reject) => {
            try {
                const script = document.createElement('script');
                script.src = chrome.runtime.getURL(scriptPath);

                script.onload = () => {

                    resolve();
                };

                script.onerror = (error) => {
                    console.error(` script load failed: ${scriptPath}`, error);
                    reject(error);
                };

                document.head.appendChild(script);


                setTimeout(() => {
                    resolve();
                }, 3000);
            } catch (error) {
                console.warn(` Failed to load scripts: ${scriptPath}`, error);
                resolve();
            }
        });
    }


    async applyFiltersToResults(results) {

        const filteredResults = JSON.parse(JSON.stringify(results));

        try {

            if (!window.domainPhoneFilter && !window.apiFilter) {

                return filteredResults;
            }




            if (window.domainPhoneFilter) {

                if (filteredResults.domains && filteredResults.domains.length > 0) {

                    filteredResults.domains = window.domainPhoneFilter.filterDomains(filteredResults.domains);

                }


                if (filteredResults.subdomains && filteredResults.subdomains.length > 0) {

                    filteredResults.subdomains = window.domainPhoneFilter.filterDomains(filteredResults.subdomains);

                }


                if (filteredResults.emails && filteredResults.emails.length > 0) {

                    filteredResults.emails = window.domainPhoneFilter.filterEmails(filteredResults.emails);

                }


                if (filteredResults.phoneNumbers && filteredResults.phoneNumbers.length > 0) {

                    filteredResults.phoneNumbers = window.domainPhoneFilter.filterPhones(filteredResults.phoneNumbers, true);

                }
            }


            if (window.apiFilter && typeof window.apiFilter.filterAPIs === 'function') {

                if (filteredResults.absoluteApis && filteredResults.absoluteApis.length > 0) {

                    filteredResults.absoluteApis = window.apiFilter.filterAPIs(filteredResults.absoluteApis, true);

                }


                if (filteredResults.relativeApis && filteredResults.relativeApis.length > 0) {

                    filteredResults.relativeApis = window.apiFilter.filterAPIs(filteredResults.relativeApis, false);

                }
            }



        } catch (error) {
            console.error(' Error while applying filters:', error);
        }

        return filteredResults;
    }


    async addUrlLocationTooltip(element, item, category = null) {
        let tooltip = null;
        let hoverTimeout = null;

        element.addEventListener('mouseenter', () => {

            hoverTimeout = setTimeout(async () => {
                try {
                    const locationInfo = await this.getItemLocationInfo(category, item);
                    if (locationInfo) {
                        tooltip = this.createTooltip(locationInfo);
                        document.body.appendChild(tooltip);
                        this.positionTooltip(tooltip, element);
                    }
                } catch (error) {
                    console.error('[DisplayManager] Failed to get location info:', error);
                }
            }, 500);
        });

        element.addEventListener('mouseleave', () => {
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                hoverTimeout = null;
            }
            if (tooltip) {
                document.body.removeChild(tooltip);
                tooltip = null;
            }
        });

        element.addEventListener('mousemove', (e) => {
            if (tooltip) {
                this.positionTooltip(tooltip, element, e);
            }
        });
    }


    async getItemLocationInfo(categoryOrItem, item = null) {
        try {

            let category = null;
            let actualItem = null;

            if (item === null) {

                actualItem = categoryOrItem;
                category = null;
            } else {

                category = categoryOrItem;
                actualItem = item;
            }


            if (typeof actualItem === 'object' && actualItem !== null) {

                if (actualItem.sourceUrl && !actualItem.sourceUrl.startsWith('chrome-extension://')) {
                    return {
                        sourceUrl: actualItem.sourceUrl,
                        pageTitle: actualItem.pageTitle || document.title || 'Scan results',
                        extractedAt: actualItem.extractedAt || new Date().toISOString()
                    };
                }
            }


            const indexedDBManager = this.srcMiner?.indexedDBManager || window.IndexedDBManager || window.indexedDBManager;
            if (!indexedDBManager) {
                console.warn('[DisplayManager] IndexedDBManager not initialized, returning current page info');
                return {
                    sourceUrl: window.location.href.startsWith('chrome-extension://') ? 'Scan target page' : window.location.href,
                    pageTitle: document.title || 'Scan results',
                    extractedAt: new Date().toISOString()
                };
            }

            try {

                const allResults = await indexedDBManager.getAllData('scanResults');

                if (allResults && allResults.length > 0) {

                    const searchValue = typeof actualItem === 'object' && actualItem !== null ?
                        (actualItem.value || actualItem.text || actualItem.content || JSON.stringify(actualItem)) :
                        String(actualItem);


                    for (const result of allResults.reverse()) {
                        if (result.results) {

                            const categoriesToSearch = category ? [category] : Object.keys(result.results);

                            for (const searchCategory of categoriesToSearch) {
                                const categoryData = result.results[searchCategory];

                                if (Array.isArray(categoryData)) {
                                    for (const dataItem of categoryData) {
                                        let itemValue = null;
                                        let itemSourceUrl = null;
                                        let itemPageTitle = null;
                                        let itemExtractedAt = null;

                                        if (typeof dataItem === 'object' && dataItem !== null) {

                                            itemValue = dataItem.value || dataItem.text || dataItem.content;
                                            itemSourceUrl = dataItem.sourceUrl;
                                            itemPageTitle = dataItem.pageTitle;
                                            itemExtractedAt = dataItem.extractedAt;
                                        } else {

                                            itemValue = String(dataItem);
                                            itemSourceUrl = result.sourceUrl;
                                            itemPageTitle = result.pageTitle;
                                            itemExtractedAt = result.extractedAt;
                                        }


                                        if (itemValue === searchValue) {

                                            const finalSourceUrl = itemSourceUrl && !itemSourceUrl.startsWith('chrome-extension://') ?
                                                itemSourceUrl :
                                                (result.sourceUrl && !result.sourceUrl.startsWith('chrome-extension://') ?
                                                    result.sourceUrl :
                                                    'Scan target page');

                                            return {
                                                sourceUrl: finalSourceUrl,
                                                pageTitle: itemPageTitle || result.pageTitle || 'Scan results',
                                                extractedAt: itemExtractedAt || result.extractedAt || result.timestamp || new Date().toISOString()
                                            };
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (dbError) {
                console.warn('[DisplayManager] IndexedDB query failed:', dbError);
            }


            const currentUrl = window.location.href;
            return {
                sourceUrl: currentUrl.startsWith('chrome-extension://') ? 'Scan target page' : currentUrl,
                pageTitle: document.title || 'Scan results',
                extractedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('[DisplayManager] Error while getting location info:', error);

            const currentUrl = window.location.href;
            return {
                sourceUrl: currentUrl.startsWith('chrome-extension://') ? 'Data source unknown' : currentUrl,
                pageTitle: document.title || 'Scan results',
                extractedAt: new Date().toISOString()
            };
        }
    }


    findItemWithSourceUrl(item, results) {
        if (!results) return null;


        const itemStr = typeof item === 'object' && item !== null ?
            (item.text || item.content || item.value || JSON.stringify(item)) :
            String(item);


        const searchInObject = (obj) => {
            if (Array.isArray(obj)) {
                for (const element of obj) {
                    if (typeof element === 'string') {
                        if (element === itemStr) {

                            return null;
                        }
                    } else if (typeof element === 'object' && element !== null) {

                        const elementStr = element.text || element.content || element.value || JSON.stringify(element);
                        if (elementStr === itemStr) {

                            return element;
                        }

                        const found = searchInObject(element);
                        if (found) return found;
                    }
                }
            } else if (typeof obj === 'object' && obj !== null) {
                for (const value of Object.values(obj)) {
                    const found = searchInObject(value);
                    if (found) return found;
                }
            }
            return null;
        };

        return searchInObject(results);
    }


    isItemInResults(item, results) {
        return this.findItemWithSourceUrl(item, results) !== null;
    }


    createTooltip(locationInfo) {
        const tooltip = document.createElement('div');
        tooltip.className = 'url-location-tooltip';
        tooltip.style.cssText = `
            position: absolute;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 10px;
            border-radius: 6px;
            font-size: 12px;
            max-width: 300px;
            word-wrap: break-word;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;

        const formatDate = (dateStr) => {
            try {
                const date = new Date(dateStr);
                return date.toLocaleString('en-US');
            } catch (error) {
                return 'just now';
            }
        };


        const pageTitle = locationInfo.pageTitle || document.title || 'Current page';
        const sourceUrl = locationInfo.sourceUrl || window.location.href;
        const extractedAt = locationInfo.extractedAt || new Date().toISOString();
        const scanId = locationInfo.scanId || 'current-session';


        const displayUrl = sourceUrl.length > 50 ? sourceUrl.substring(0, 47) + '...' : sourceUrl;
        const displayTitle = pageTitle.length > 30 ? pageTitle.substring(0, 27) + '...' : pageTitle;

        tooltip.innerHTML = `
            <div style="margin-bottom: 5px;"><strong>Extracted from:</strong></div>
            <div style="margin-bottom: 3px;">${displayTitle}</div>
            <div style="margin-bottom: 3px;">${displayUrl}</div>
            <div style="margin-bottom: 3px;">${formatDate(extractedAt)}</div>
        `;

        return tooltip;
    }


    positionTooltip(tooltip, element, mouseEvent = null) {
        const tooltipRect = tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;

        let left, top;

        if (mouseEvent) {

            left = mouseEvent.pageX - tooltipRect.width / 2;
            top = mouseEvent.pageY - tooltipRect.height - 15;
        } else {

            const rect = element.getBoundingClientRect();
            left = rect.left + scrollX + rect.width / 2 - tooltipRect.width / 2;
            top = rect.top + scrollY - tooltipRect.height - 15;
        }



        if (left + tooltipRect.width > viewportWidth + scrollX) {
            left = viewportWidth + scrollX - tooltipRect.width - 10;
        }
        if (left < scrollX + 10) {
            left = scrollX + 10;
        }


        if (top < scrollY + 10) {
            if (mouseEvent) {
                top = mouseEvent.pageY + 15;
            } else {
                const rect = element.getBoundingClientRect();
                top = rect.bottom + scrollY + 15;
            }
        }


        if (top + tooltipRect.height > viewportHeight + scrollY) {
            top = viewportHeight + scrollY - tooltipRect.height - 10;
        }

        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }


    addContextMenu(element, item) {
        element.addEventListener('contextmenu', async (e) => {
            e.preventDefault();


            const existingMenu = document.querySelector('.context-menu');
            if (existingMenu) {
                existingMenu.remove();
            }

            const menu = this.createContextMenu(item);
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
        });
    }


    createContextMenu(item) {
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.cssText = `
            position: absolute;
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
                        if (item.hasOwnProperty('text') || item.hasOwnProperty('content') || item.hasOwnProperty('value')) {
                            textToCopy = item.text || item.content || item.value || JSON.stringify(item);
                        } else {
                            textToCopy = JSON.stringify(item);
                        }
                    } else {
                        textToCopy = item;
                    }

                    navigator.clipboard.writeText(textToCopy).then(() => {
                        this.showNotification('Content copied to clipboard');
                    });
                }
            },
            {
                text: 'Copy source location',
                icon: '',
                action: async () => {
                    const locationInfo = await this.getItemLocationInfo(item);
                    if (locationInfo && locationInfo.sourceUrl) {
                        navigator.clipboard.writeText(locationInfo.sourceUrl).then(() => {
                            this.showNotification('Source URL copied to clipboard');
                        });
                    } else {
                        this.showNotification('Source location not found URL', 'error');
                    }
                }
            },
            {
                text: 'Open source page',
                icon: '',
                action: async () => {
                    const locationInfo = await this.getItemLocationInfo(item);
                    if (locationInfo && locationInfo.sourceUrl) {
                        window.open(locationInfo.sourceUrl, '_blank');
                    } else {
                        this.showNotification('Source page not found URL', 'error');
                    }
                }
            }
        ];

        menuItems.forEach((menuItem, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = `
                padding: 8px 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                ${index === 0 ? 'border-top-left-radius: 4px; border-top-right-radius: 4px;' : ''}
                ${index === menuItems.length - 1 ? 'border-bottom-left-radius: 4px; border-bottom-right-radius: 4px;' : ''}
            `;

            itemDiv.innerHTML = `<span>${menuItem.icon}</span><span>${menuItem.text}</span>`;

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


    showNotification(message, type = 'success') {

        const existingNotification = document.querySelector('.phantom-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.className = 'phantom-notification';

        const bgColor = type === 'error' ? '#ff4757' : '#a78bfa';

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${bgColor};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 10002;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            animation: slideInRight 0.3s ease-out;
        `;


        if (!document.querySelector('#phantom-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'phantom-notification-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOutRight {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        notification.textContent = message;
        document.body.appendChild(notification);


        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 3000);
    }


    escapeHtml(text) {
        if (!text || typeof text !== 'string') {
            return text;
        }

        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
