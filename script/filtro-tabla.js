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

function parseSpanishDate(dateString) {
    if (!dateString) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return new Date(dateString);
    }
    const monthMap = {
        'ene': 11, 'feb': 10, 'mar': 9, 'abr': 8, 'may': 7, 'jun': 6,
        'jul': 5, 'ago': 4, 'sep': 3, 'oct': 2, 'nov': 1, 'dic': 0,
        'enero': 11, 'febrero': 10, 'marzo': 9, 'abril': 8, 'mayo': 7, 'junio': 6,
        'julio': 5, 'agosto': 4, 'septiembre': 3, 'octubre': 2, 'noviembre': 1, 'diciembre': 0
    };

    const parts = dateString.toLowerCase().replace(/ de /g, ' ').split(/[/ -]/);
    if (parts.length < 3) return null;

    let day, month, year;

    for (const part of parts) {
        if (monthMap[part] !== undefined) {
            month = monthMap[part];
        } else if (part.length === 4 && !isNaN(part)) {
            year = parseInt(part, 10);
        } else if (part.length <= 2 && !isNaN(part)) {
            day = parseInt(part, 10);
        }
    }

    if (day && month !== undefined && year) {
        return new Date(Date.UTC(year, month, day));
    }
    return null;
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
    const otherFilterKeys = Object.keys(activeFilters).filter(k => k !== columnName);
    let sourceData = fullData;

    if (otherFilterKeys.length > 0) {
        sourceData = fullData.filter(row => {
            return otherFilterKeys.every(key => {
                const filterValues = activeFilters[key];
                const cellValue = row[key] || '';
                return filterValues.has(cellValue);
            });
        });
    }

    if (columnName.toLowerCase() === "creada" || columnName.toLowerCase() === "actualizada") {
        const groupedByYear = {};
        sourceData.forEach(row => {
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

            const sortedDates = Array.from(groupedByYear[year]).sort((a, b) => {
                const dateA = parseSpanishDate(a);
                const dateB = parseSpanishDate(b);
                if (!dateA || !dateB) return 0;
                return dateA - dateB;
            });
            
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
                header.nextElementSibling.classList.toggle('show');
            });
        });

        document.querySelectorAll('.select-year-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const panel = button.parentElement.nextElementSibling;
                const checkboxes = panel.querySelectorAll('input[type="checkbox"]');
                const shouldSelect = Array.from(checkboxes).some(cb => !cb.checked);
                checkboxes.forEach(cb => cb.checked = shouldSelect);
            });
        });

    } else {
        const uniqueValues = [...new Set(sourceData.map(row => row[columnName] || ''))].sort();
        if (uniqueValues.length === 0) {
            optionsContainer.innerHTML = '<p style="text-align:center; color:#888;">No hay opciones disponibles con los filtros actuales.</p>';
        } else {
            uniqueValues.forEach(value => {
                const isChecked = currentFilter.size === 0 || currentFilter.has(value);
                optionsContainer.innerHTML += `<label><input type="checkbox" value="${value}" ${isChecked ? 'checked' : ''}>${value === '' ? '(Vacío)' : value}</label>`;
            });
        }
    }

    searchInput.oninput = () => {
        const searchTerm = searchInput.value.toLowerCase();
        optionsContainer.querySelectorAll('label').forEach(label => {
            label.style.display = label.textContent.toLowerCase().includes(searchTerm) ? '' : 'none';
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