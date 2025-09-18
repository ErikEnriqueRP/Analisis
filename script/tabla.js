let currentPage = 1;
let fullData = [];
let filteredData = [];
let headers = [];
const rowsPerPage = 100;

    function displayPage() {
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const paginatedData = filteredData.slice(startIndex, endIndex);
        renderTable(paginatedData);
        renderPaginationControls();
    }
    
    function renderTable(dataToRender) {
        const tableContainer = document.getElementById('csvTableContainer');
        if (!tableContainer) return;
        let tableHTML = '<table><thead><tr>';
        headers.forEach((h, i) => {
            const filterIsActive = activeFilters[h.name] && activeFilters[h.name].size > 0;
            tableHTML += `<th class="${h.visible ? '' : 'column-hidden'}" data-index="${i}">${h.name} <span class="filter-icon ${filterIsActive ? 'active' : ''}" data-column="${h.name}">▼</span></th>`;
        });
        tableHTML += '</tr></thead><tbody>';
        if (dataToRender.length === 0) {
            const columnCount = headers.filter(h => h.visible).length;
            tableHTML += `<tr><td colspan="${columnCount}" style="text-align:center; padding: 2rem;">No hay resultados.</td></tr>`;
        } else {
            dataToRender.forEach(row => {
                tableHTML += '<tr>';
                headers.forEach((h, i) => {
                    const cellData = h.name ? (row[h.name] || '') : '';
                    tableHTML += `<td class="${h.visible ? '' : 'column-hidden'}" data-index="${i}">${cellData}</td>`;
                });
                tableHTML += '</tr>';
            });
        }
        tableHTML += '</tbody></table>';
        tableContainer.innerHTML = tableHTML;
        document.querySelectorAll('.filter-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                openFilterModal(e.target.dataset.column);
            });
        });
    }

    function renderPaginationControls() {
        const controlsContainer = document.getElementById('pagination-controls');
        if (!controlsContainer) return;
        const totalPages = Math.ceil(filteredData.length / rowsPerPage);
        controlsContainer.innerHTML = '';

        if (totalPages <= 1) return;

        controlsContainer.innerHTML = `
            <button id="prevPageBtn" ${currentPage === 1 ? 'disabled' : ''}>&laquo; Anterior</button>
            <span>Página ${currentPage} de ${totalPages} (${filteredData.length} filas)</span>
            <button id="nextPageBtn" ${currentPage === totalPages ? 'disabled' : ''}>Siguiente &raquo;</button>
        `;

        document.getElementById('prevPageBtn').addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                displayPage();
            }
        });
        document.getElementById('nextPageBtn').addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                displayPage();
            }
        });
    }

document.addEventListener('DOMContentLoaded', () => { 
    let myPieChart = null;
    let chartImageDataUrl = null;

    let leftColumnConfig = JSON.parse(localStorage.getItem('leftColumnConfig') || 'null') || {
        enabled: false, source: '', numChars: 2, concat: '', newName: ''
    };

    function  initialize() {
        const csvData = localStorage.getItem('csvData');
        const csvFileName = localStorage.getItem('csvFileName');
        const tableContainer = document.getElementById('csvTableContainer');
        const controls = document.querySelector('.controls-wrapper');

        if (csvData && tableContainer) {
            document.querySelector('h1').textContent = `Tabla de JIRAS: ${csvFileName || 'Archivo Cargado'}`;
            parseAndDisplayCSV(csvData);
            setupEventListeners();
        } else if (tableContainer) {
            tableContainer.innerHTML = `<p style="text-align:center; color: #555; font-size: 1.1em;">No se ha cargado ningún archivo CSV. <br>Por favor, <a href="index.html" style="color: #3498db; text-decoration: none;">regresa a la página de inicio</a> para subir uno.</p>`;
            if (controls) controls.style.display = 'none';
        }
    }

    initialize();

    function  setupEventListeners() {
        document.getElementById('resetFiltersBtn').addEventListener('click', resetAllFilters);
        document.getElementById('exportBtn').addEventListener('click', exportToExcelWithChart);
        document.getElementById('btn-gestionar-columnas').addEventListener('click', openColumnsModal);
        document.getElementById('btn-crear-grafico').addEventListener('click', openChartModal);
        document.getElementById('btn-crear-tablas-link').addEventListener('click', navigateToDashboard);

        const applyFilterBtn = document.getElementById('applyFilterBtn');
        if (applyFilterBtn) applyFilterBtn.addEventListener('click', handleApplyFilter);
        const cancelFilterBtn = document.getElementById('cancelFilterBtn');
        if (cancelFilterBtn) cancelFilterBtn.addEventListener('click', () => document.getElementById('filterModal').style.display = 'none');
        const generateChartBtn = document.getElementById('generateChartBtn');
        if (generateChartBtn) generateChartBtn.addEventListener('click', generateChartFromFilteredData);
        const applyLeftColumnBtn = document.getElementById('applyLeftColumnBtn');
        if (applyLeftColumnBtn) applyLeftColumnBtn.addEventListener('click', handleAddLeftColumn);
        
        document.querySelectorAll('.dropdown-btn').forEach(button => {
            button.addEventListener('click', function (event) {
                event.stopPropagation();
                const content = this.nextElementSibling;
                const isVisible = content.classList.contains('show');
                closeAllDropdowns();
                if (!isVisible) content.classList.add('show');
            });
        });
        window.addEventListener('click', function (event) {
            if (!event.target.matches('.dropdown-btn')) closeAllDropdowns();
        });
    }

    function closeAllDropdowns() {
        document.querySelectorAll('.dropdown-content').forEach(content => {
            content.classList.remove('show');
        });
    }

    function  parseAndDisplayCSV(csvData) {
        Papa.parse(csvData, {
            header: true,
            skipEmptyLines: true,
            complete: function (results) {
                headers = results.meta.fields.map(h => ({ name: h.trim(), visible: true }));
                fullData = results.data;
                if (leftColumnConfig && leftColumnConfig.enabled && leftColumnConfig.source) {
                    applyLeftColumn(leftColumnConfig, false);
                }
                filteredData = [...fullData];
                populateQuickFilters();
                displayPage();
            },
            error: function (error) {
                console.error("Error al parsear el CSV:", error);
                alert("Hubo un error al leer el archivo CSV.");
            }
        });
    }

    function populateQuickFilters() {
    const filtersConfig = {
        'ano': { containerId: 'quick-filter-ano', createdCol: 'Fecha_creada', updatedCol: 'Fecha_actualizada' },
        'area': { containerId: 'quick-filter-area', column: 'Area' },
        'prioridad': { containerId: 'quick-filter-prioridad', column: 'Prioridad' },
        'estado': { containerId: 'quick-filter-estado', column: 'Estado' },
        'resolucion': { containerId: 'quick-filter-resolucion', column: 'Resolucion' }
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
                if (year) {
                    yearSet.add(year);
                }
            });
            return Array.from(yearSet).sort((a, b) => b - a);
        };

        const createdYears = getUniqueYears(createdColName);
        const updatedYears = getUniqueYears(updatedColName);
        if (createdYears.length > 0) anoContainer.appendChild(createSubmenu("Creada", createdYears, createdColName));
        if (updatedYears.length > 0) anoContainer.appendChild(createSubmenu("Actualizada", updatedYears, updatedColName));
    }
    ['area', 'prioridad', 'estado', 'resolucion'].forEach(key => {
        const config = filtersConfig[key];
        const container = document.getElementById(config.containerId);
        if (container && headers.some(h => h.name === config.column)) {
            container.innerHTML = '';
            const uniqueValues = [...new Set(fullData.map(row => row[config.column] || ''))].sort();
            uniqueValues.forEach(value => {
                if (value) {
                    const link = document.createElement('a');
                    link.href = '#';
                    link.textContent = value;
                    link.onclick = () => applyQuickFilter(config.column, value);
                    container.appendChild(link);
                }
            });
        }
    });
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
            yearLink.onclick = () => applyQuickFilter(columnName, year, true);
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

    async function exportToExcelWithChart() {
        if (filteredData.length === 0) {
            alert("No hay datos filtrados para exportar.");
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Datos Filtrados');
        const visibleHeaders = headers.filter(h => h.visible).map(h => ({ header: h.name, key: h.name, width: 20 }));
        worksheet.columns = visibleHeaders;

        const dataToExport = filteredData.map(row => {
            let exportRow = {};
            headers.forEach(h => {
                if (h.visible) exportRow[h.name] = row[h.name];
            });
            return exportRow;
        });
        worksheet.addRows(dataToExport);

        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8E44AD' } };

        if (chartImageDataUrl) {
            const imageId = workbook.addImage({ base64: chartImageDataUrl, extension: 'png' });
            worksheet.addImage(imageId, {
                tl: { col: 1, row: filteredData.length + 3 },
                br: { col: 8, row: filteredData.length + 23 }
            });
        }

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), 'datos_con_grafico.xlsx');
    }

    function generateChartFromFilteredData() {
        const categoryCol = document.getElementById('categoryColumn').value;
        const valueCol = document.getElementById('valueColumn').value;
        if (!categoryCol || !valueCol) {
            alert('Por favor, selecciona ambas columnas.');
            return;
        }

        let aggregatedData;
        if (valueCol === '__count__') {
            aggregatedData = filteredData.reduce((acc, row) => {
                const category = row[categoryCol] || 'Sin categoría';
                acc[category] = (acc[category] || 0) + 1;
                return acc;
            }, {});
        } else {
            aggregatedData = filteredData.reduce((acc, row) => {
                const category = row[categoryCol] || 'Sin categoría';
                const value = parseFloat(String(row[valueCol]).replace(/,/g, '')) || 0;
                if (value !== 0) acc[category] = (acc[category] || 0) + value;
                return acc;
            }, {});
        }
        drawPieChart(aggregatedData, valueCol === '__count__' ? 'Conteo' : valueCol);
    }

    function drawPieChart(data, valueColName) {
        const canvas = document.getElementById('pieChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (myPieChart) myPieChart.destroy();

        myPieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(data),
                datasets: [{
                    label: valueColName,
                    data: Object.values(data),
                    backgroundColor: ['#3498db', '#2ecc71', '#f1c40f', '#e74c3c', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'],
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    onComplete: () => { if (myPieChart) chartImageDataUrl = myPieChart.toBase64Image('image/png'); }
                },
                plugins: {
                    legend: { position: 'right' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                let value = context.raw || 0;
                                let total = context.chart.getDatasetMeta(0).total || 1;
                                let percentage = (value / total * 100).toFixed(2);
                                return `${label}: ${value.toLocaleString()} (${percentage}%)`;
                            }
                        }
                    },
                    datalabels: { display: false }
                }
            }
        });
    }

    function openColumnsModal() {
        const list = document.getElementById('columnsList');
        list.innerHTML = "";
        headers.forEach((h, i) => {
            list.innerHTML += `<label><input type="checkbox" data-index="${i}" ${h.visible ? "checked" : ""}> ${h.name}</label>`;
        });

        const sourceSelect = document.getElementById('leftSourceColumn');
        const concatSelect = document.getElementById('leftConcatColumn');
        sourceSelect.innerHTML = "";
        concatSelect.innerHTML = '<option value="">-- Ninguna --</option>';
        headers.forEach(h => {
            const option = `<option value="${h.name}">${h.name}</option>`;
            sourceSelect.innerHTML += option;
            concatSelect.innerHTML += option;
        });

        sourceSelect.value = leftColumnConfig.source || "";
        concatSelect.value = leftColumnConfig.concat || "";
        document.getElementById('leftNumChars').value = leftColumnConfig.numChars || 2;
        document.getElementById('leftNewColumnName').value = leftColumnConfig.newName || "";
        document.getElementById('leftAutoApply').checked = !!leftColumnConfig.enabled;

        list.onchange = e => {
            if (e.target.type === "checkbox") {
                toggleColumn(parseInt(e.target.dataset.index), e.target.checked);
            }
        };
        document.getElementById('columnsModal').style.display = "block";
    }

    function toggleColumn(index, isVisible) {
        if (headers[index]) {
            headers[index].visible = isVisible;
            displayPage();
        }
    }
    
    function handleAddLeftColumn() {
        leftColumnConfig = {
            enabled: document.getElementById('leftAutoApply').checked,
            source: document.getElementById('leftSourceColumn').value,
            numChars: parseInt(document.getElementById('leftNumChars').value) || 2,
            concat: document.getElementById('leftConcatColumn').value || '',
            newName: (document.getElementById('leftNewColumnName').value || `IZQ_${source}`).trim()
        };

        if (!leftColumnConfig.source || !leftColumnConfig.newName) {
            alert("La columna base y el nuevo nombre son obligatorios.");
            return;
        }

        localStorage.setItem('leftColumnConfig', JSON.stringify(leftColumnConfig));
        applyLeftColumn(leftColumnConfig, true);
        document.getElementById('columnsModal').style.display = 'none';
    }

    function applyLeftColumn(cfg, rerender) {
        if (!cfg || !cfg.source) return;

        const newName = cfg.newName || `IZQ_${cfg.source}`;
        if (!headers.some(h => h.name === newName)) {
            headers.push({ name: newName, visible: true });
        }

        fullData.forEach(row => {
            const src = row[cfg.source] || '';
            const leftPart = src.substring(0, Math.max(0, cfg.numChars));
            const concatPart = cfg.concat ? (row[cfg.concat] || '') : '';
            row[newName] = concatPart ? `${leftPart}_${concatPart}` : leftPart;
        });

        if (rerender) {
            applyActiveFilters();
            currentPage = 1;
            displayPage();
        }
    }

    function openChartModal() {
        const catSelect = document.getElementById('categoryColumn');
        const valSelect = document.getElementById('valueColumn');
        catSelect.innerHTML = "";
        valSelect.innerHTML = '<option value="__count__">(Contar Registros)</option>';

        const visibleHeaders = headers.filter(h => h.visible);
        visibleHeaders.forEach(h => {
            catSelect.innerHTML += `<option value="${h.name}">${h.name}</option>`;
            let isNumeric = fullData.some(row => row[h.name] && !isNaN(Number(String(row[h.name]).replace(/,/g, ""))));
            if (isNumeric) {
                valSelect.innerHTML += `<option value="${h.name}">${h.name}</option>`;
            }
        });
        document.getElementById('chartModal').style.display = "block";
    }

    function navigateToDashboard() {
        if (filteredData.length > 0) {
            sessionStorage.setItem('csvDataForDashboard', JSON.stringify(filteredData));
            window.location.href = 'vaTablas.html';
        } else {
            alert("No hay datos para llevar al dashboard.");
        }
    }
});