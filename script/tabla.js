// --- VARIABLES DE ESTADO ---
// Variables para el estado de la paginación
let currentPage = 1;
const rowsPerPage = 50; // ¡Puedes cambiar esto! 25, 50, o 100 son buenos valores.

// Almacena TODOS los datos del CSV. Nunca se modifica después de la carga inicial.
let fullData = [];
// Almacena solo los datos que coinciden con los filtros actuales.
let filteredData = [];

// Variables para el resto de la aplicación
let headers = [];
let myPieChart = null;
let leftColumnConfig = JSON.parse(localStorage.getItem('leftColumnConfig') || 'null') || { enabled: false, source: '', numChars: 2, concat: '', newName: '' };
let chartImageDataUrl = null;
let chartAggregatedData = null;
let activeFilters = {};

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    const csvData = localStorage.getItem('csvData');
    const csvFileName = localStorage.getItem('csvFileName');

    if (csvData) {
        document.querySelector('h1').textContent = `Tabla de JIRAS: ${csvFileName || 'Archivo Cargado'}`;
        parseAndDisplayCSV(csvData);
        setupEventListeners();
    } else {
        const tableContainer = document.getElementById('csvTableContainer');
        const controls = document.querySelector('.controls-wrapper');
        tableContainer.innerHTML = `<p style="text-align:center; color: #555; font-size: 1.1em;">No se ha cargado ningún archivo CSV. <br>Por favor, <a href="index.html" style="color: #3498db; text-decoration: none;">regresa a la página de inicio</a> para subir uno.</p>`;
        if (controls) controls.style.display = 'none';
    }
});

function setupEventListeners() {
    document.getElementById('resetFiltersBtn').addEventListener('click', resetAllFilters);
    document.getElementById('exportBtn').addEventListener('click', exportToExcelWithChart);
    document.getElementById('manageColumnsBtn').addEventListener('click', openColumnsModal);
    document.getElementById('createChartBtn').addEventListener('click', openChartModal);
    document.getElementById('createDashboardBtn').addEventListener('click', navigateToDashboard);
    document.getElementById('addLeftColumnBtn').addEventListener('click', handleAddLeftColumn);
    document.getElementById('generateChartBtn').addEventListener('click', generateChartFromFilteredData);

    document.querySelectorAll('.modal .close-button').forEach(btn => {
        btn.onclick = () => btn.closest('.modal').style.display = 'none';
    });
    window.onclick = e => {
        if (e.target.classList.contains('modal')) e.target.style.display = 'none';
    };
    document.getElementById('applyFilterBtn').addEventListener('click', handleApplyFilter);
    document.getElementById('cancelFilterBtn').addEventListener('click', () => document.getElementById('filterModal').style.display = 'none');
}

function parseAndDisplayCSV(csvData) {
    const lines = csvData.trim().split(/\r?\n/);
    const headerLine = lines[0];
    if (!headerLine) return;
    headers = headerLine.split(',').map(h => ({ name: h.trim(), visible: true }));
    fullData = lines.slice(1).map(line => {
        if (!line.trim()) return null;
        const values = line.split(',');
        let rowData = {};
        headers.forEach((header, index) => {
            rowData[header.name] = values[index] ? values[index].trim() : '';
        });
        return rowData;
    }).filter(Boolean);

    if (leftColumnConfig && leftColumnConfig.enabled && leftColumnConfig.source) {
        applyLeftColumn(leftColumnConfig, false);
    }

    // La primera vez, los datos filtrados son todos los datos.
    filteredData = [...fullData];
    displayPage(); // Llamamos a la nueva función principal de renderizado.
}

// --- LÓGICA DE RENDERIZADO Y PAGINACIÓN ---

/**
 * Función principal que orquesta el filtrado, la paginación y el renderizado.
 */
function displayPage() {
    applyActiveFilters(); // Primero, actualiza el array `filteredData` en memoria.

    // Calcula qué porción (slice) de los datos filtrados se debe mostrar.
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    renderTable(paginatedData);      // Dibuja solo la porción de la tabla para la página actual.
    renderPaginationControls();      // Dibuja los botones "Anterior" y "Siguiente".
}

/**
 * Dibuja la tabla en el HTML, pero SOLO con las filas que se le pasan.
 * @param {Array} dataToRender El array de objetos a renderizar (ej. 50 filas).
 */
function renderTable(dataToRender) {
    const tableContainer = document.getElementById('csvTableContainer');
    let tableHTML = '<table><thead><tr>';
    headers.forEach((h, i) => {
        const filterIsActive = activeFilters[h.name] && activeFilters[h.name].size > 0;
        tableHTML += `<th class="${h.visible ? '' : 'column-hidden'}" data-index="${i}">
                        ${h.name} 
                        <span class="filter-icon ${filterIsActive ? 'active' : ''}" data-column="${h.name}">▼</span>
                      </th>`;
    });
    tableHTML += '</tr></thead><tbody>';

    if (dataToRender.length === 0) {
        const columnCount = headers.filter(h => h.visible).length;
        tableHTML += `<tr><td colspan="${columnCount}" style="text-align:center; padding: 2rem;">No hay resultados que coincidan con los filtros.</td></tr>`;
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

    // Vuelve a añadir los listeners a los iconos de filtro después de cada redibujado.
    document.querySelectorAll('.filter-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            openFilterModal(e.target.dataset.column);
        });
    });
}

/**
 * Dibuja los botones de paginación y el contador de páginas.
 */
function renderPaginationControls() {
    const controlsContainer = document.getElementById('pagination-controls');
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    controlsContainer.innerHTML = '';

    if (totalPages <= 1) return; // No se necesitan controles si todo cabe en una página.

    let buttonsHTML = `
        <button id="prevPageBtn" ${currentPage === 1 ? 'disabled' : ''}>&laquo; Anterior</button>
        <span>Página ${currentPage} de ${totalPages} (${filteredData.length} filas)</span>
        <button id="nextPageBtn" ${currentPage === totalPages ? 'disabled' : ''}>Siguiente &raquo;</button>
    `;

    controlsContainer.innerHTML = buttonsHTML;

    // Añade listeners a los nuevos botones.
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


// --- LÓGICA DE FILTRADO ---

/**
 * Filtra el array `fullData` y actualiza `filteredData` basado en `activeFilters`.
 * Esta función NO toca el HTML, solo manipula datos en memoria, por lo que es muy rápida.
 */
function applyActiveFilters() {
    const filterKeys = Object.keys(activeFilters);

    if (filterKeys.length === 0) {
        filteredData = [...fullData];
        return;
    }

    filteredData = fullData.filter(row => {
        // La fila debe cumplir con TODOS los filtros activos.
        return filterKeys.every(columnName => {
            const filterValues = activeFilters[columnName];
            const cellValue = row[columnName] || '';
            return filterValues.has(cellValue);
        });
    });
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
    currentPage = 1; // Siempre vuelve a la primera página después de aplicar un nuevo filtro.
    displayPage();
    updateFilterIcons();
}

function resetAllFilters() {
    activeFilters = {};
    currentPage = 1; // Vuelve a la primera página.
    displayPage();
    updateFilterIcons();
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

    const uniqueValues = [...new Set(fullData.map(row => row[columnName] || ''))].sort();
    const currentFilter = activeFilters[columnName] || new Set(uniqueValues);

    const renderOptions = (values) => {
        optionsContainer.innerHTML = '';
        values.forEach(value => {
            const isChecked = currentFilter.has(value);
            const checkboxHTML = `
                <label>
                    <input type="checkbox" value="${value}" ${isChecked ? 'checked' : ''}>
                    ${value === '' ? '(Vacío)' : value}
                </label>`;
            optionsContainer.innerHTML += checkboxHTML;
        });
    };

    renderOptions(uniqueValues);

    searchInput.oninput = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const filteredValues = uniqueValues.filter(v => v.toLowerCase().includes(searchTerm));
        renderOptions(filteredValues);
    };

    document.getElementById('selectAllBtn').onclick = () => {
        optionsContainer.querySelectorAll('input').forEach(chk => chk.checked = true);
    };
    document.getElementById('deselectAllBtn').onclick = () => {
        optionsContainer.querySelectorAll('input').forEach(chk => chk.checked = false);
    };
    modal.style.display = 'block';
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

// --- OTRAS FUNCIONES (Exportar, Gráficos, Columnas) ---

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
            if (h.visible) { exportRow[h.name] = row[h.name]; }
        });
        return exportRow;
    });
    worksheet.addRows(dataToExport);
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8E44AD' } };
    
    // Aquí puedes añadir la lógica para agregar el gráfico si es necesario.
    
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

    // El gráfico se genera a partir de TODOS los datos filtrados, no solo de la página actual.
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
            if (value !== 0) {
                acc[category] = (acc[category] || 0) + value;
            }
            return acc;
        }, {});
    }

    chartAggregatedData = aggregatedData;
    drawPieChart(aggregatedData, valueCol === '__count__' ? 'Conteo' : valueCol);
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
        document.querySelectorAll(`[data-index='${index}']`).forEach(el => {
            el.classList.toggle("column-hidden", !isVisible);
        });
        displayPage(); // Vuelve a dibujar la página actual con las columnas actualizadas
    }
}

function openChartModal() {
    const catSelect = document.getElementById('categoryColumn');
    const valSelect = document.getElementById('valueColumn');
    catSelect.innerHTML = "";
    valSelect.innerHTML = "";
    if (fullData.length === 0) return;
    valSelect.innerHTML = '<option value="__count__">(Contar Registros)</option>';
    const visibleHeaders = headers.filter(h => h.visible);
    visibleHeaders.forEach(h => {
        catSelect.innerHTML += `<option value="${h.name}">${h.name}</option>`;
        let isColumnNumeric = true;
        let hasAnyValue = false;
        for (const row of fullData) {
            const value = row[h.name];
            if (value && value.trim() !== "") {
                hasAnyValue = true;
                if (isNaN(Number(String(value).replace(/,/g, "")))) {
                    isColumnNumeric = false;
                    break;
                }
            }
        }
        if (hasAnyValue && isColumnNumeric) {
            valSelect.innerHTML += `<option value="${h.name}">${h.name}</option>`;
        }
    });
    document.getElementById('chartModal').style.display = "block";
}


function handleAddLeftColumn() {
    const source = document.getElementById('leftSourceColumn').value;
    const numChars = parseInt(document.getElementById('leftNumChars').value) || 2;
    const concat = document.getElementById('leftConcatColumn').value || '';
    const newName = (document.getElementById('leftNewColumnName').value || `IZQ_${source}`).trim();
    const auto = document.getElementById('leftAutoApply').checked;
    if (!source || !newName) {
        alert("La columna base y el nuevo nombre son obligatorios.");
        return;
    }
    leftColumnConfig = { enabled: auto, source, numChars, concat, newName };
    localStorage.setItem('leftColumnConfig', JSON.stringify(leftColumnConfig));
    applyLeftColumn(leftColumnConfig, true);
    document.getElementById('columnsModal').style.display = 'none';
}


function applyLeftColumn(cfg, rerender) {
    if (!cfg || !cfg.source) return;

    const newName = cfg.newName || `IZQ_${cfg.source}`;
    const numChars = parseInt(cfg.numChars) || 2;

    if (!headers.some(h => h.name === newName)) {
        headers.push({ name: newName, visible: true });
    }
    fullData.forEach(row => {
        const src = row[cfg.source] || '';
        const leftPart = src.substring(0, Math.max(0, numChars));
        const concatPart = cfg.concat ? (row[cfg.concat] || '') : '';
        row[newName] = concatPart ? `${leftPart}_${concatPart}` : leftPart;
    });

    if (rerender) {
        // Reinicia los filtros y la página para mostrar la nueva columna
        filteredData = [...fullData];
        currentPage = 1;
        displayPage();
    }
}

function drawPieChart(data, valueColName) {
    const canvas = document.getElementById('pieChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const labels = Object.keys(data);
    const values = Object.values(data);

    if (myPieChart) {
        myPieChart.destroy();
    }

    myPieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: valueColName,
                data: values,
                backgroundColor: ['#3498db', '#2ecc71', '#f1c40f', '#e74c3c', '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#7f8c8d', '#c0392b'],
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
                legend: {
                    position: 'right',
                    align: 'center',
                    labels: {
                        generateLabels: function(chart) {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                const total = chart.getDatasetMeta(0).total || 1;
                                return data.labels.map((label, i) => {
                                    const meta = chart.getDatasetMeta(0);
                                    const style = meta.controller.getStyle(i);
                                    const value = chart.config.data.datasets[0].data[i];
                                    const percentage = ((value / total) * 100).toFixed(2);
                                    return { text: `${label}: ${percentage}%`, fillStyle: style.backgroundColor, strokeStyle: style.borderColor, lineWidth: style.borderWidth, hidden: isNaN(data.datasets[0].data[i]) || meta.data[i].hidden, index: i };
                                });
                            }
                            return [];
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            let value = context.raw || 0;
                            let total = context.chart.getDatasetMeta(0).total;
                            if (total === 0) return `${label}: 0`;
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

function navigateToDashboard() {
    if (tableData.length > 0) {
        sessionStorage.setItem('csvData', JSON.stringify(tableData));
        window.location.href = 'vaTablas.html';
    } else {
        alert("No hay datos para llevar al dashboard.");
    }
}