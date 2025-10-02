    function populateQuickFilters() {
    const filtersConfig = {
        'ano': { containerId: 'quick-filter-ano', createdCol: 'Creada', updatedCol: 'Actualizada' },
        'area': { containerId: 'quick-filter-area', column: 'Area' },
        'prioridad': { containerId: 'quick-filter-prioridad', column: 'Prioridad' },
        'estado': { containerId: 'quick-filter-estado', column: 'Estado' },
    };
    const anoContainer = document.getElementById(filtersConfig.ano.containerId);
    if (anoContainer) {
        anoContainer.innerHTML = '';
        const createdColName = filtersConfig.ano.createdCol;
        const updatedColName = filtersConfig.ano.updatedCol; 
        
        const getUniqueYearMonthMap = (colName) => {
            if (!headers.some(h => h.name === colName)) return {};
            const yearMonthMap = {};
            fullData.forEach(row => {
                const year = getFullYearFromString(row[colName]);
                const month = getMonthFromString(row[colName]);
                if (year !== null && month !== null) {
                    if (!yearMonthMap[year]) {
                        yearMonthMap[year] = new Set();
                    }
                    yearMonthMap[year].add(month);
                }
            });
            return yearMonthMap;
        };

        const createdYearMonths = getUniqueYearMonthMap(createdColName);
        const updatedYearMonths = getUniqueYearMonthMap(updatedColName);

        if (Object.keys(createdYearMonths).length > 0) anoContainer.appendChild(createYearMonthSubmenu("Creada", createdYearMonths, createdColName));
        if (Object.keys(updatedYearMonths).length > 0) anoContainer.appendChild(createYearMonthSubmenu("Actualizada", updatedYearMonths, updatedColName));
    }

    Object.keys(filtersConfig).forEach(key => {
        if (key === 'ano') return;

        const config = filtersConfig[key];
        const container = document.getElementById(config.containerId);
        const columnName = config.column;

        if (container && headers.some(h => h.name === columnName)) {
            container.innerHTML = '';

            const uniqueValues = [...new Set(fullData.map(row => row[columnName] || ''))].sort();

            uniqueValues.forEach(value => {
                if (value === '') return;

                const filterLink = document.createElement('a');
                filterLink.href = '#';
                filterLink.textContent = value;
                
                filterLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    applyQuickFilter(columnName, value);
                });

                container.appendChild(filterLink);
            });
        }
    });
    }

    function createYearMonthSubmenu(title, yearMonthMap, columnName) {
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const container = document.createElement('div');
    container.className = 'submenu-container';
    container.dataset.column = columnName;

    const titleLink = document.createElement('a');
    titleLink.href = '#';
    titleLink.textContent = title + ' ▶';
    container.appendChild(titleLink);
    
    const yearSubmenu = document.createElement('div');
    yearSubmenu.className = 'submenu';
    
    const sortedYears = Object.keys(yearMonthMap).sort((a, b) => b - a);

    sortedYears.forEach(year => {
        const yearContainer = document.createElement('div');
        yearContainer.className = 'submenu-container';

        const yearLink = document.createElement('a');
        yearLink.href = '#';
        yearLink.textContent = year + ' ▶';
        yearLink.dataset.year = year; 
        yearContainer.appendChild(yearLink);

        const monthSubmenu = document.createElement('div');
        monthSubmenu.className = 'submenu';

        const sortedMonths = Array.from(yearMonthMap[year]).sort((a, b) => a - b);
        
        sortedMonths.forEach(month => {
            const monthLink = document.createElement('a');
            monthLink.href = '#';
            monthLink.textContent = monthNames[month];

            monthLink.dataset.year = year;
            monthLink.dataset.month = month;
            monthLink.addEventListener('click', () => applyQuickFilter(columnName, `${year}-${month}`));
            monthSubmenu.appendChild(monthLink);
        });

        yearContainer.appendChild(monthSubmenu);
        yearSubmenu.appendChild(yearContainer);
    });
    
    container.appendChild(yearSubmenu);
    return container;
    }

    function applyQuickFilter(columnName, value) {
    const isDateFilter = (columnName.toLowerCase() === 'creada' || columnName.toLowerCase() === 'actualizada');
    if (isDateFilter) {
        const currentFilter = activeFilters[columnName];
        if (currentFilter && currentFilter.has(value)) {
            delete activeFilters[columnName];
        } else {
            activeFilters[columnName] = new Set([value]);
        }
    } else {
        const currentFilter = activeFilters[columnName] || new Set();
        if (currentFilter.has(value)) {
            currentFilter.delete(value);
        } else {
            currentFilter.add(value);
        }
        activeFilters[columnName] = currentFilter;
        if (currentFilter.size === 0) {
            delete activeFilters[columnName];
        }
    }
    
    applyActiveFilters();
    currentPage = 1;
    updateAvailableFilterOptions(); 
    displayPage();
    updateFilterIcons();
    closeAllDropdowns();
    }   

    function resetAllFilters() {
    activeFilters = {};
    currentPage = 1;
    applyActiveFilters();
    updateAvailableFilterOptions();
    displayPage();
    updateFilterIcons();
    }

    function updateAvailableFilterOptions() {
    const quickFilterConfig = { 'area': 'Area', 'prioridad': 'Prioridad', 'estado': 'Estado' };
    const availableOptions = {};
    Object.values(quickFilterConfig).forEach(columnName => {
        if (headers.some(h => h.name === columnName)) {
            availableOptions[columnName] = new Set(filteredData.map(row => row[columnName] || ''));
        }
    });
    Object.keys(quickFilterConfig).forEach(key => {
        const columnName = quickFilterConfig[key];
        const container = document.getElementById(`quick-filter-${key}`);
        if (container) {
            const links = container.getElementsByTagName('a');
            for (let link of links) {
                if (availableOptions[columnName] && availableOptions[columnName].has(link.textContent)) {
                    link.classList.remove('disabled');
                } else {
                    link.classList.add('disabled');
                }
            }
        }
    });
    const availableYearMonthMap = { 'Creada': {}, 'Actualizada': {} };
    filteredData.forEach(row => {
        ['Creada', 'Actualizada'].forEach(colName => {
            const year = getFullYearFromString(row[colName]);
            const month = getMonthFromString(row[colName]);
            if (year !== null && month !== null) {
                if (!availableYearMonthMap[colName][year]) {
                    availableYearMonthMap[colName][year] = new Set();
                }
                availableYearMonthMap[colName][year].add(month);
            }
        });
    });

    const anoContainer = document.getElementById('quick-filter-ano');
    if (!anoContainer) return;

    anoContainer.querySelectorAll('[data-column]').forEach(mainContainer => {
        const colName = mainContainer.dataset.column;
        const availableMap = availableYearMonthMap[colName];
        mainContainer.querySelectorAll('a[data-year]').forEach(yearLink => {
            const year = yearLink.dataset.year;
            if (availableMap[year]) {
                yearLink.classList.remove('disabled');
            } else {
                yearLink.classList.add('disabled');
            }
        });

        mainContainer.querySelectorAll('a[data-month]').forEach(monthLink => {
            const year = parseInt(monthLink.dataset.year, 10);
            const month = parseInt(monthLink.dataset.month, 10);
            if (availableMap[year] && availableMap[year].has(month)) {
                monthLink.classList.remove('disabled');
            } else {
                monthLink.classList.add('disabled');
            }
        });
    });
    }

    function setupSubmenuToggles() {
    const submenuToggles = document.querySelectorAll('.submenu-container > a');

    submenuToggles.forEach(toggle => {
        if (toggle.dataset.listenerAttached) return;

        toggle.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation(); 

            const parentContainer = this.closest('.submenu-container');
            const thisSubmenu = parentContainer.querySelector('.submenu');
            const isVisible = thisSubmenu.classList.contains('show-submenu');
            const siblingContainers = [...parentContainer.parentElement.children].filter(el => el !== parentContainer);
            siblingContainers.forEach(container => {
                const submenu = container.querySelector('.submenu');
                if (submenu) {
                    submenu.classList.remove('show-submenu');
                }
            });
            if (!isVisible) {
                thisSubmenu.classList.add('show-submenu');
            }
        });
        toggle.dataset.listenerAttached = 'true';
    });
    }

    function createYearMonthSubmenu(title, yearMonthMap, columnName) {
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    
    const container = document.createElement('div');
    container.className = 'submenu-container';
    
    const titleLink = document.createElement('a');
    titleLink.href = '#';
    titleLink.textContent = title + ' ▶';
    container.appendChild(titleLink);
    
    const yearSubmenu = document.createElement('div');
    yearSubmenu.className = 'submenu';
    
    const sortedYears = Object.keys(yearMonthMap).sort((a, b) => b - a);

    sortedYears.forEach(year => {
        const yearContainer = document.createElement('div');
        yearContainer.className = 'submenu-container';

        const yearLink = document.createElement('a');
        yearLink.href = '#';
        yearLink.textContent = year + ' ▶';
        yearContainer.appendChild(yearLink);

        const monthSubmenu = document.createElement('div');
        monthSubmenu.className = 'submenu';

        const sortedMonths = Array.from(yearMonthMap[year]).sort((a, b) => a - b);
        
        sortedMonths.forEach(month => {
            const monthLink = document.createElement('a');
            monthLink.href = '#';
            monthLink.textContent = monthNames[month];
            monthLink.addEventListener('click', () => applyQuickFilter(columnName, `${year}-${month}`));
            monthSubmenu.appendChild(monthLink);
        });

        yearContainer.appendChild(monthSubmenu);
        yearSubmenu.appendChild(yearContainer);
    });
    
    container.appendChild(yearSubmenu);
    return container;
    }