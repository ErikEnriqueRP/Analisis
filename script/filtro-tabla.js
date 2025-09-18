let activeFilters = {};

function getFullYearFromString(dateString) {
    if (!dateString || typeof dateString !== 'string') {
        return null;
    }
    const parts = dateString.split(/[/ -]/);
    if (parts.length < 3) {
        return null;
    }
    const yearPart = parts[parts.length - 1];
    const yearNum = parseInt(yearPart, 10);
    if (isNaN(yearNum)) {
        return null;
    }
    if (yearPart.length === 2) {
        return yearNum > 50 ? 1900 + yearNum : 2000 + yearNum;
    }
    return yearNum;
}

function openFilterModal(columnName) {
    const modal = document.getElementById('filterModal');
    const title = document.getElementById('filterModalTitle');
    const optionsContainer = document.getElementById('filterOptions');
    const searchInput = document.getElementById('filterSearchInput');

    title.textContent = `Filtrar por: ${columnName}`;
    modal.dataset.currentColumn = columnName;
    optionsContainer.innerHTML = '';
    searchInput.value = '';

    const currentFilter = activeFilters[columnName] || new Set();

    if (columnName.toLowerCase() === "creada" || columnName.toLowerCase() === "actualizada") {
        const groupedByYear = {};
        fullData.forEach(row => {
            const dateStr = row[columnName];
            const year = getFullYearFromString(dateStr);
            if (year && dateStr) {
                if (!groupedByYear[year]) {
                    groupedByYear[year] = new Set();
                }
                groupedByYear[year].add(dateStr);
            }
        });

        const sortedYears = Object.keys(groupedByYear).sort((a, b) => b - a);

        sortedYears.forEach(year => {
            const yearWrapper = document.createElement('div');
            yearWrapper.className = 'year-group';
            
            const header = document.createElement('button');
            header.className = 'accordion-year-header';
            header.innerHTML = `<span>${year}</span> <button class="select-year-btn">Seleccionar Año</button>`;
            
            const panel = document.createElement('div');
            panel.className = 'date-panel';

            const sortedDates = Array.from(groupedByYear[year]).sort((a, b) => new Date(a.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$2/$1/$3')) - new Date(b.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$2/$1/$3')));

            sortedDates.forEach(date => {
                const isChecked = currentFilter.size === 0 || currentFilter.has(date);
                panel.innerHTML += `<label><input type="checkbox" value="${date}" ${isChecked ? 'checked' : ''}>${date}</label>`;
            });

            yearWrapper.appendChild(header);
            yearWrapper.appendChild(panel);
            optionsContainer.appendChild(yearWrapper);
        });

        document.querySelectorAll('.accordion-year-header').forEach(header => {
            header.querySelector('span').addEventListener('click', () => {
                header.classList.toggle('active');
                const panel = header.nextElementSibling;
                panel.classList.toggle('show');
            });
        });

        document.querySelectorAll('.select-year-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const panel = button.parentElement.nextElementSibling;
                const checkboxes = panel.querySelectorAll('input[type="checkbox"]');
                const shouldSelect = Array.from(checkboxes).filter(cb => cb.checked).length < checkboxes.length;
                checkboxes.forEach(cb => cb.checked = shouldSelect);
            });
        });

    } else {
        const uniqueValues = [...new Set(fullData.map(row => row[columnName] || ''))].sort();
        uniqueValues.forEach(value => {
            const isChecked = currentFilter.size === 0 || currentFilter.has(value);
            optionsContainer.innerHTML += `<label><input type="checkbox" value="${value}" ${isChecked ? 'checked' : ''}>${value === '' ? '(Vacío)' : value}</label>`;
        });
    }

    searchInput.oninput = () => {
        const searchTerm = searchInput.value.toLowerCase();
        optionsContainer.querySelectorAll('label').forEach(label => {
            const text = label.textContent.toLowerCase();
            label.style.display = text.includes(searchTerm) ? '' : 'none';
        });

        if (columnName.toLowerCase() === "creada" || columnName.toLowerCase() === "actualizada") {
            optionsContainer.querySelectorAll('.year-group').forEach(group => {
                const hasVisibleLabels = group.querySelector('label[style=""]');
                group.style.display = hasVisibleLabels ? '' : 'none';
            });
        }
    };

    document.getElementById('selectAllBtn').onclick = () => optionsContainer.querySelectorAll('input[type="checkbox"]').forEach(chk => chk.checked = true);
    document.getElementById('deselectAllBtn').onclick = () => optionsContainer.querySelectorAll('input[type="checkbox"]').forEach(chk => chk.checked = false);
    modal.style.display = 'block';
}

function handleApplyFilter() {
    const modal = document.getElementById('filterModal');
    const columnName = modal.dataset.currentColumn;
    const selectedValues = new Set();
    document.querySelectorAll('#filterOptions input:checked').forEach(checkbox => {
        selectedValues.add(checkbox.value);
    });

    const uniqueValuesCount = [...new Set(fullData.map(row => row[columnName] || ''))].length;
    if (selectedValues.size === uniqueValuesCount || selectedValues.size === 0) {
        delete activeFilters[columnName];
    } else {
        activeFilters[columnName] = selectedValues;
    }

    modal.style.display = 'none';
    currentPage = 1;
    applyActiveFilters();
    updateAvailableFilterOptions();
    displayPage();
    updateFilterIcons();
}

function applyActiveFilters() {
    const filterKeys = Object.keys(activeFilters);

    if (filterKeys.length === 0) {
        filteredData = [...fullData];
        return;
    }

    filteredData = fullData.filter(row => {
        return filterKeys.every(columnName => {
            const filterValues = activeFilters[columnName];
            if (filterValues.size === 0) return true;
            
            const cellValue = row[columnName] || '';

            if (columnName.toLowerCase() === "creada" || columnName.toLowerCase() === "actualizada") {
                const sampleValue = [...filterValues][0];

                if (filterValues.size === 1 && /^\d{4}$/.test(sampleValue)) {
                    const filterYear = parseInt(sampleValue, 10);
                    const cellYear = getFullYearFromString(cellValue);
                    return cellYear === filterYear;
                } else {
                    return filterValues.has(cellValue);
                }
            } else {
                return filterValues.has(cellValue);
            }
        });
    });
}

function updateAvailableFilterOptions() {
    const quickFilterConfig = {
        'area': 'Area',
        'prioridad': 'Prioridad',
        'estado': 'Estado',
        'resolucion': 'Resolucion'
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

function updateFilterIcons() {
    document.querySelectorAll('.filter-icon').forEach(icon => {
        const columnName = icon.dataset.column;
        if (activeFilters[columnName] && activeFilters[columnName].size > 0) {
            icon.classList.add('active');
        } else {
            icon.classList.remove('active');
        }
    });
}