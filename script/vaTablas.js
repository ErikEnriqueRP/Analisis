let tableData = [];
let headers = [];
let myPieChart = null;
let leftColumnConfig = JSON.parse(localStorage.getItem('leftColumnConfig') || 'null') || { enabled: false, source: '', numChars: 2, concat: '', newName: '' };
let chartImageDataUrl = null;
let chartAggregatedData = null;
let activeFilters = {};

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
    tableData = lines.slice(1).map(line => {
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
    
    renderTable();
}

function renderTable() {
    const tableContainer = document.getElementById('csvTableContainer');
    if (headers.length === 0) {
        tableContainer.innerHTML = "<p>Carga un archivo CSV para comenzar.</p>";
        return;
    }
    let tableHTML = '<table><thead><tr>';
    headers.forEach((h, i) => {
        const filterIsActive = activeFilters[h.name] && activeFilters[h.name].size > 0;
        tableHTML += `<th class="${h.visible ? '' : 'column-hidden'}" data-index="${i}">
                        ${h.name} 
                        <span class="filter-icon ${filterIsActive ? 'active' : ''}" data-column="${h.name}">▼</span>
                      </th>`;
    });
    tableHTML += '</tr></thead><tbody>';

    tableData.forEach(row => {
        tableHTML += '<tr>';
        headers.forEach((h, i) => {
            const cellData = h.name ? (row[h.name] || '') : '';
            tableHTML += `<td class="${h.visible ? '' : 'column-hidden'}" data-index="${i}">${cellData}</td>`;
        });
        tableHTML += '</tr>';
    });
    tableHTML += '</tbody></table>';
    tableContainer.innerHTML = tableHTML;
    
    document.querySelectorAll('.filter-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            openFilterModal(e.target.dataset.column);
        });
    });

    applyActiveFilters(); 
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

    const uniqueValues = [...new Set(tableData.map(row => row[columnName] || ''))].sort();
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

function handleApplyFilter() {
    const modal = document.getElementById('filterModal');
    const columnName = modal.dataset.currentColumn;
    const selectedValues = new Set();
    
    document.querySelectorAll('#filterOptions input:checked').forEach(checkbox => {
        selectedValues.add(checkbox.value);
    });

    const uniqueValuesCount = [...new Set(tableData.map(row => row[columnName] || ''))].length;
    if (selectedValues.size === uniqueValuesCount || selectedValues.size === 0) {
        delete activeFilters[columnName];
    } else {
        activeFilters[columnName] = selectedValues;
    }
    
    modal.style.display = 'none';
    applyActiveFilters();
    updateFilterIcons();
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

function applyActiveFilters() {
    const rows = document.querySelectorAll('#csvTableContainer tbody tr');
    const filterKeys = Object.keys(activeFilters);

    rows.forEach((row, rowIndex) => {
        const rowData = tableData[rowIndex];
        let isVisible = true;

        if (filterKeys.length > 0) {
            for (const columnName of filterKeys) {
                const filterValues = activeFilters[columnName];
                const cellValue = rowData[columnName] || '';
                if (!filterValues.has(cellValue)) {
                    isVisible = false;
                    break; 
                }
            }
        }
        
        row.style.display = isVisible ? '' : 'none';
    });
}

function resetAllFilters() {
    activeFilters = {};
    applyActiveFilters();
    updateFilterIcons();
}

async function exportToExcelWithChart() {
    const filteredDataForExport = tableData.filter(row => {
        const filterKeys = Object.keys(activeFilters);
        if (filterKeys.length === 0) return true;

        return filterKeys.every(columnName => {
            const filterValues = activeFilters[columnName];
            const cellValue = row[columnName] || '';
            return filterValues.has(cellValue);
        });
    });

    if (filteredDataForExport.length === 0) { alert("No hay datos visibles para exportar."); return; }
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Datos Filtrados');
    
    const visibleHeaders = headers.filter(h => h.visible).map(h => ({ header: h.name, key: h.name, width: 20 }));
    worksheet.columns = visibleHeaders;
    const dataToExport = filteredDataForExport.map(row => {
        let exportRow = {};
        headers.forEach(h => {
            if (h.visible) {
                exportRow[h.name] = row[h.name];
            }
        });
        return exportRow;
    });
    worksheet.addRows(dataToExport);
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8E44AD' } };
    const mainTableEndRow = dataToExport.length + 1;
    if (chartImageDataUrl) {
        const imageId = workbook.addImage({ base64: chartImageDataUrl.split(',')[1], extension: 'png' });
        worksheet.addImage(imageId, { tl: { col: 0.5, row: mainTableEndRow + 2 }, ext: { width: 500, height: 300 } });
    }
    if (chartAggregatedData) {
        const startCol = 8;
        const titleCell = worksheet.getCell(mainTableEndRow + 2, startCol);
        titleCell.value = 'Resumen del Gráfico';
        titleCell.font = { bold: true, size: 14 };
        titleCell.alignment = { vertical: 'middle' };
        const headersRow = worksheet.getRow(mainTableEndRow + 3);
        headersRow.getCell(startCol).value = 'Categoría';
        headersRow.getCell(startCol + 1).value = 'Valor Total';
        headersRow.getCell(startCol + 2).value = 'Porcentaje';
        headersRow.font = { bold: true };
        const total = Object.values(chartAggregatedData).reduce((sum, val) => sum + val, 0);
        let currentRowNum = mainTableEndRow + 4;
        for (const [category, value] of Object.entries(chartAggregatedData)) {
            const dataRow = worksheet.getRow(currentRowNum);
            dataRow.getCell(startCol).value = category;
            const valueCell = dataRow.getCell(startCol + 1);
            valueCell.value = value;
            valueCell.numFmt = '#,##0';
            const percentCell = dataRow.getCell(startCol + 2);
            percentCell.value = total > 0 ? value / total : 0;
            percentCell.numFmt = '0.00%';
            currentRowNum++;
        }
        worksheet.getColumn(startCol).width = 25;
        worksheet.getColumn(startCol + 1).width = 15;
        worksheet.getColumn(startCol + 2).width = 15;
    }
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'datos_con_grafico.xlsx');
}

function openColumnsModal() {
    const list = document.getElementById('columnsList');
    list.innerHTML = '';
    headers.forEach((h, i) => {
        list.innerHTML += `<label><input type="checkbox" data-index="${i}" ${h.visible ? 'checked' : ''}> ${h.name}</label>`;
    });

    const sourceSelect = document.getElementById('leftSourceColumn');
    const concatSelect = document.getElementById('leftConcatColumn');
    sourceSelect.innerHTML = '';
    concatSelect.innerHTML = '<option value="">-- Ninguna --</option>';

    headers.forEach(h => {
        const option = `<option value="${h.name}">${h.name}</option>`;
        sourceSelect.innerHTML += option;
        concatSelect.innerHTML += option;
    });

    sourceSelect.value = leftColumnConfig.source || '';
    concatSelect.value = leftColumnConfig.concat || '';
    document.getElementById('leftNumChars').value = leftColumnConfig.numChars || 2;
    document.getElementById('leftNewColumnName').value = leftColumnConfig.newName || '';
    document.getElementById('leftAutoApply').checked = !!leftColumnConfig.enabled;

    list.onchange = e => {
        if (e.target.type === 'checkbox') {
            toggleColumn(parseInt(e.target.dataset.index), e.target.checked);
        }
    };

    document.getElementById('columnsModal').style.display = 'block';
}

function toggleColumn(index, isVisible) {
    if(headers[index]) {
        headers[index].visible = isVisible;
        document.querySelectorAll(`[data-index='${index}']`).forEach(el => {
            el.classList.toggle('column-hidden', !isVisible);
        });
        applyActiveFilters();
    }
}

function openChartModal() {
    const catSelect = document.getElementById('categoryColumn');
    const valSelect = document.getElementById('valueColumn');
    catSelect.innerHTML = '';
    valSelect.innerHTML = '';
    
    if (tableData.length === 0) return;

    valSelect.innerHTML = '<option value="__count__">(Contar Registros)</option>';
    const visibleHeaders = headers.filter(h => h.visible);

    visibleHeaders.forEach(h => {
        catSelect.innerHTML += `<option value="${h.name}">${h.name}</option>`;
        
        let isColumnNumeric = true;
        let hasAnyValue = false;
        for (const row of tableData) {
            const value = row[h.name];
            if (value && value.trim() !== '') {
                hasAnyValue = true;
                if (isNaN(Number(String(value).replace(/,/g, '')))) { 
                    isColumnNumeric = false;
                    break;
                }
            }
        }
        
        if (hasAnyValue && isColumnNumeric) {
            valSelect.innerHTML += `<option value="${h.name}">${h.name}</option>`;
        }
    });

    document.getElementById('chartModal').style.display = 'block';
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

    const headerExists = headers.some(h => h.name === newName);
    if (!headerExists) {
        headers.push({ name: newName, visible: true });
    }
    
    tableData.forEach(row => {
        const src = row[cfg.source] || '';
        const leftPart = src.substring(0, Math.max(0, numChars));
        const concatPart = cfg.concat ? (row[cfg.concat] || '') : '';
        row[newName] = concatPart ? `${leftPart}_${concatPart}` : leftPart;
    });

    if (rerender) {
        renderTable();
    }
}

function generateChartFromFilteredData() {
    const categoryCol = document.getElementById('categoryColumn').value;
    const valueCol = document.getElementById('valueColumn').value;
    if (!categoryCol || !valueCol) { alert('Por favor, selecciona ambas columnas.'); return; }
    const filteredDataForChart = tableData.filter(row => {
        const filterKeys = Object.keys(activeFilters);
        if (filterKeys.length === 0) return true;
        return filterKeys.every(columnName => {
            const filterValues = activeFilters[columnName];
            const cellValue = row[columnName] || '';
            return filterValues.has(cellValue);
        });
    });

    let aggregatedData;

    if (valueCol === '__count__') {
        aggregatedData = filteredDataForChart.reduce((acc, row) => {
            const category = row[categoryCol] || 'Sin categoría';
            acc[category] = (acc[category] || 0) + 1;
            return acc;
        }, {});
    } else {
        aggregatedData = filteredDataForChart.reduce((acc, row) => {
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