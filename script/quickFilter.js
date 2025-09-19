    
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
        
        const getUniqueYears = (colName) => {
            if (!headers.some(h => h.name === colName)) return [];
            const yearSet = new Set();
            fullData.forEach(row => {
                const year = getFullYearFromString(row[colName]);
                if (year) yearSet.add(year);
            });
            return Array.from(yearSet).sort((a, b) => b - a);
        };

        const createdYears = getUniqueYears(createdColName);
        const updatedYears = getUniqueYears(updatedColName);

        if (createdYears.length > 0) anoContainer.appendChild(createSubmenu("Creada", createdYears, createdColName));
        if (updatedYears.length > 0) anoContainer.appendChild(createSubmenu("Actualizada", updatedYears, updatedColName));
    }
    }

    function createSubmenu(title, years, columnName) {
    const container = document.createElement('div');
    container.className = 'submenu-container';
    
    const titleLink = document.createElement('a');
    titleLink.href = '#';
    titleLink.textContent = title + ' ▶';
    
    container.appendChild(titleLink);
    
    const submenu = document.createElement('div');
    submenu.className = 'submenu';
    
    years.forEach(year => {
        const yearLink = document.createElement('a');
        yearLink.href = '#';
        yearLink.textContent = year;
        yearLink.addEventListener('click', () => applyQuickFilter(columnName, year));
        submenu.appendChild(yearLink);
    });
    
    container.appendChild(submenu);
    return container;
    }

    function applyQuickFilter(columnName, value) {
    if (columnName.includes("Fecha_")) {
        const newFilter = new Set();
        newFilter.add(value.toString());
        activeFilters[columnName] = newFilter;
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
    const quickFilterConfig = {
        'area': 'Area',
        'prioridad': 'Prioridad',
        'estado': 'Estado',
    };
    const availableOptions = {};
    Object.values(quickFilterConfig).forEach(columnName => {
        if(headers.some(h => h.name === columnName)) {
            availableOptions[columnName] = new Set(filteredData.map(row => row[columnName]));
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