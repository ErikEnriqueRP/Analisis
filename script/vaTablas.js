document.addEventListener('DOMContentLoaded', () => {
    const mainCsvData = localStorage.getItem('csvData');
    const savedTablesData = localStorage.getItem('savedTables');
    const container = document.getElementById('dashboard-container');
    const deleteAllBtn = document.getElementById('deleteAllTablesBtn');
    const exportAllBtn = document.getElementById('exportAllBtn');

    if (!mainCsvData) {
        container.innerHTML = '<p class="error-msg">No se encontraron datos base. Por favor, <a href="index.html">carga un archivo CSV</a> primero.</p>';
        if (deleteAllBtn) deleteAllBtn.style.display = 'none';
        return;
    }

    const savedTables = JSON.parse(savedTablesData || '[]');

    if (savedTables.length === 0) {
        container.innerHTML = '<p class="info-msg">Aún no has guardado ninguna tabla. Ve a la <a href="tabla.html">página de la tabla</a> para filtrar y guardar una vista.</p>';
        if (deleteAllBtn) deleteAllBtn.style.display = 'none';
        if (exportAllBtn) exportAllBtn.style.display = 'none'; 
        return;
    }

    if (deleteAllBtn) {
        deleteAllBtn.style.display = 'inline-block';
        deleteAllBtn.addEventListener('click', deleteAllTables);
    }

    if (exportAllBtn) { 
        exportAllBtn.style.display = 'inline-block';
        exportAllBtn.addEventListener('click', exportAllTablesToExcel);
    }

    Papa.parse(mainCsvData, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            let fullData = results.data;
            let headers = results.meta.fields;

            const processedResult = applyAreaAndCustomColumns(fullData, headers);
            fullData = processedResult.processedData;
            headers = processedResult.updatedHeaders;

            savedTables.forEach(table => {
                const filtered = applySavedFilters(fullData, table.filters);
                const tableCard = createTableCard(table, filtered, headers);
                container.appendChild(tableCard);
            });
        }
    });
});

function applySavedFilters(data, filters) {
    const filterKeys = Object.keys(filters);
    if (filterKeys.length === 0) {
        return data;
    }
    return data.filter(row => {
        return filterKeys.every(columnName => {
            const filterValues = new Set(filters[columnName]);
            if (filterValues.size === 0) return true;
            const cellValue = row[columnName] || '';
            return filterValues.has(cellValue);
        });
    });
}

function createTableCard(tableInfo, data, headers) {
    const card = document.createElement('div');
    card.className = 'table-card';

    const header = document.createElement('div');
    header.className = 'accordion-header';

    const titleWrapper = document.createElement('div');
    titleWrapper.className = 'header-title-wrapper';
    titleWrapper.innerHTML = `<span>${tableInfo.name}</span> <span class="row-count">(${data.length} filas)</span>`;

    const cardActions = document.createElement('div');
    cardActions.className = 'card-actions';

    const chartBtn = document.createElement('button');
    chartBtn.className = 'btn-card-action btn-chart';
    chartBtn.textContent = '📈';
    chartBtn.title = 'Crear gráfico con estos datos';
    chartBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        openChartModalForTable(tableInfo, data, headers);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-card-action btn-delete-single';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Borrar esta tabla';
    deleteBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        deleteSingleTable(tableInfo.id);
    });

    cardActions.appendChild(chartBtn);
    cardActions.appendChild(deleteBtn);

    header.appendChild(titleWrapper);
    header.appendChild(cardActions);

    const panel = document.createElement('div');
    panel.className = 'accordion-panel';

    panel.dataset.currentPage = 1;
    const rowsPerPage = 50;

    const tableContainer = document.createElement('div');
    tableContainer.id = `table-container-${tableInfo.id}`;

    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination-controls';
    paginationContainer.id = `pagination-controls-${tableInfo.id}`;

    const chartsContainer = document.createElement('div');
    chartsContainer.className = 'saved-charts-container';
    chartsContainer.id = `charts-for-${tableInfo.id}`;

    panel.appendChild(tableContainer);
    panel.appendChild(paginationContainer);
    panel.appendChild(chartsContainer);

    header.addEventListener('click', () => {
        header.classList.toggle('active');
        if (panel.style.maxHeight) {
            panel.style.maxHeight = null;
        } else {
            if (!panel.dataset.hasBeenRendered) {
                renderTablePage(tableInfo.id, data, headers, rowsPerPage);
                if (tableInfo.charts && tableInfo.charts.length > 0) {
                    tableInfo.charts.forEach(chart => renderSingleSavedChart(chart, data, tableInfo.id));
                }
                panel.dataset.hasBeenRendered = "true";
            }
            panel.style.maxHeight = panel.scrollHeight + "px";
        }
    });

    card.appendChild(header);
    card.appendChild(panel);
    return card;
}

function renderSingleSavedChart(chartInfo, tableData, tableId) {
    const chartsContainer = document.getElementById(`charts-for-${tableId}`);
    if (!chartsContainer) return;

    const chartCard = document.createElement('div');
    chartCard.className = 'chart-card';
    chartCard.id = `chart-card-${chartInfo.id}`;

    const chartHeader = document.createElement('div');
    chartHeader.className = 'chart-card-header';
    chartHeader.innerHTML = `<h4>${chartInfo.title}</h4>`;

    const deleteChartBtn = document.createElement('button');
    deleteChartBtn.className = 'btn-delete-single';
    deleteChartBtn.textContent = '×';
    deleteChartBtn.title = 'Borrar este gráfico';
    deleteChartBtn.onclick = () => deleteSingleChart(tableId, chartInfo.id);

    chartHeader.appendChild(deleteChartBtn);

    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'chart-card-body';
    const canvas = document.createElement('canvas');
    canvas.id = `canvas-${chartInfo.id}`;
    canvasContainer.appendChild(canvas);

    chartCard.appendChild(chartHeader);
    chartCard.appendChild(canvasContainer);
    chartsContainer.appendChild(chartCard);

    let aggregatedData;
    if (chartInfo.valueCol === '__count__') {
        aggregatedData = tableData.reduce((acc, row) => {
            const category = row[chartInfo.categoryCol] || 'Sin categoría';
            acc[category] = (acc[category] || 0) + 1;
            return acc;
        }, {});
    } else {
        aggregatedData = tableData.reduce((acc, row) => {
            const category = row[chartInfo.categoryCol] || 'Sin categoría';
            const value = parseFloat(String(row[chartInfo.valueCol]).replace(/,/g, '')) || 0;
            acc[category] = (acc[category] || 0) + value;
            return acc;
        }, {});
    }

    new Chart(canvas.getContext('2d'), {
        type: 'pie',
        data: {
            labels: Object.keys(aggregatedData),
            datasets: [{
                data: Object.values(aggregatedData),
                backgroundColor: ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#1abc9c'],
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function deleteSingleChart(tableId, chartId) {
    if (!confirm("¿Estás seguro de que quieres borrar este gráfico?")) return;

    const savedTables = JSON.parse(localStorage.getItem('savedTables') || '[]');
    const tableToUpdate = savedTables.find(table => table.id === tableId);

    if (tableToUpdate && tableToUpdate.charts) {
        tableToUpdate.charts = tableToUpdate.charts.filter(chart => chart.id !== chartId);
        localStorage.setItem('savedTables', JSON.stringify(savedTables));
        document.getElementById(`chart-card-${chartId}`).remove();
    }
}

function renderTablePage(tableId, data, headers, rowsPerPage) {
    const panel = document.querySelector(`#pagination-controls-${tableId}`).parentElement;
    const tableContainer = document.querySelector(`#table-container-${tableId}`);
    if (!panel || !tableContainer) return;

    const currentPage = parseInt(panel.dataset.currentPage, 10);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedData = data.slice(startIndex, endIndex);

    let tableHTML = '<table><thead><tr>';
    headers.forEach(h => { tableHTML += `<th>${h}</th>`; });
    tableHTML += '</tr></thead><tbody>';

    if (paginatedData.length > 0) {
        paginatedData.forEach(row => {
            tableHTML += '<tr>';
            headers.forEach(h => { tableHTML += `<td>${row[h] || ''}</td>`; });
            tableHTML += '</tr>';
        });
    } else {
        tableHTML += `<tr><td colspan="${headers.length}" class="no-data-cell">No hay datos.</td></tr>`;
    }

    tableHTML += '</tbody></table>';
    tableContainer.innerHTML = tableHTML;

    renderPaginationControls(tableId, data, headers, rowsPerPage);

    if (panel.style.maxHeight) {
        panel.style.maxHeight = panel.scrollHeight + "px";
    }
}

function renderPaginationControls(tableId, data, headers, rowsPerPage) {
    const panel = document.querySelector(`#pagination-controls-${tableId}`).parentElement;
    const paginationContainer = document.querySelector(`#pagination-controls-${tableId}`);
    if (!panel || !paginationContainer) return;

    const currentPage = parseInt(panel.dataset.currentPage, 10);
    const totalPages = Math.ceil(data.length / rowsPerPage);

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    paginationContainer.innerHTML = `
        <button class="btn-pagination" id="prev-${tableId}" ${currentPage === 1 ? 'disabled' : ''}>&laquo; Anterior</button>
        <span>Página ${currentPage} de ${totalPages}</span>
        <button class="btn-pagination" id="next-${tableId}" ${currentPage === totalPages ? 'disabled' : ''}>Siguiente &raquo;</button>
    `;

    document.getElementById(`prev-${tableId}`).addEventListener('click', () => {
        panel.dataset.currentPage = currentPage - 1;
        renderTablePage(tableId, data, headers, rowsPerPage);
    });

    document.getElementById(`next-${tableId}`).addEventListener('click', () => {
        panel.dataset.currentPage = currentPage + 1;
        renderTablePage(tableId, data, headers, rowsPerPage);
    });
}

function deleteSingleTable(tableId) {
    if (!confirm('¿Estás seguro de que quieres borrar esta tabla guardada?')) {
        return;
    }
    const savedTables = JSON.parse(localStorage.getItem('savedTables') || '[]');
    const updatedTables = savedTables.filter(table => table.id !== tableId);
    localStorage.setItem('savedTables', JSON.stringify(updatedTables));
    location.reload();
}

function deleteAllTables() {
    if (confirm('¿Estás seguro de que quieres borrar TODAS las tablas guardadas? Esta acción no se puede deshacer.')) {
        localStorage.removeItem('savedTables');
        alert('Todas las tablas guardadas han sido borradas.');
        location.reload();
    }
}

function applyAreaAndCustomColumns(data, currentHeaders) {
    const numCharsForArea = 2;
    const areaColumnName = 'Area';
    const summaryColumnName = 'Resumen';

    if (currentHeaders.some(h => h === summaryColumnName) && !currentHeaders.some(h => h === areaColumnName)) {
        currentHeaders.unshift(areaColumnName);
    }
    data.forEach(row => {
        const sourceValue = row[summaryColumnName] || '';
        row[areaColumnName] = sourceValue.substring(0, numCharsForArea);
    });

    const leftColumnConfig = JSON.parse(localStorage.getItem('leftColumnConfig') || 'null');
    if (leftColumnConfig && leftColumnConfig.enabled && leftColumnConfig.source && leftColumnConfig.newName) {
        const newName = leftColumnConfig.newName.trim();
        if (currentHeaders.some(h => h === leftColumnConfig.source) && !currentHeaders.some(h => h === newName)) {
            currentHeaders.push(newName);
        }
        data.forEach(row => {
            const src = row[leftColumnConfig.source] || '';
            const leftPart = src.substring(0, Math.max(0, leftColumnConfig.numChars));
            const concatPart = leftColumnConfig.concat && row[leftColumnConfig.concat] ? (row[leftColumnConfig.concat] || '') : '';
            row[newName] = concatPart ? `${leftPart}_${concatPart}` : leftPart;
        });
    }

    return { processedData: data, updatedHeaders: currentHeaders };
}

async function exportAllTablesToExcel() {
    const savedTables = JSON.parse(localStorage.getItem('savedTables') || '[]');
    const mainCsvData = localStorage.getItem('csvData');

    if (savedTables.length === 0 || !mainCsvData) {
        alert("No hay tablas guardadas o datos base para exportar.");
        return;
    }

    const parsedData = await new Promise(resolve => {
        Papa.parse(mainCsvData, {
            header: true,
            skipEmptyLines: true,
            complete: results => resolve(results)
        });
    });

    let fullData = parsedData.data;
    let headers = parsedData.meta.fields;

    const processedResult = applyAreaAndCustomColumns(fullData, headers);
    fullData = processedResult.processedData;
    headers = processedResult.updatedHeaders;

    const workbook = new ExcelJS.Workbook();

    for (const table of savedTables) {
        const sheetName = table.name.replace(/[\\/*?[\]:]/g, "").substring(0, 31);
        const worksheet = workbook.addWorksheet(sheetName);

        const dataForSheet = applySavedFilters(fullData, table.filters);

        worksheet.columns = headers.map(h => ({ header: h, key: h, width: 20 }));
        worksheet.addRows(dataForSheet);

        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF34495E' } };

        if (table.charts && table.charts.length > 0) {
            let chartRowStart = worksheet.rowCount + 3;

            for (const chartInfo of table.charts) {
                const fullDataUrl = await generateChartImage(chartInfo, dataForSheet);

                if (fullDataUrl && fullDataUrl.startsWith('data:image/png;base64,')) {
                    const base64Image = fullDataUrl.split(',')[1];
                    if (base64Image) {
                        const imageId = workbook.addImage({
                            base64: base64Image,
                            extension: 'png',
                        });

                        worksheet.addImage(imageId, {
                            tl: { col: 1, row: chartRowStart },
                            br: { col: 9, row: chartRowStart + 20 }
                        });
                        
                        chartRowStart += 22;
                    }
                }
            }
        }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'Tablas_JIRAS.xlsx');
}

async function generateChartImage(chartInfo, tableData) {
    const container = document.createElement('div');
    container.style.width = '600px';
    container.style.height = '400px';
    container.style.position = 'absolute';
    container.style.top = '-9999px';
    container.style.left = '-9999px';

    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    document.body.appendChild(container);

    let aggregatedData;
    if (chartInfo.valueCol === '__count__') {
        aggregatedData = tableData.reduce((acc, row) => {
            const category = row[chartInfo.categoryCol] || 'Sin categoría';
            acc[category] = (acc[category] || 0) + 1;
            return acc;
        }, {});
    } else {
        aggregatedData = tableData.reduce((acc, row) => {
            const category = row[chartInfo.categoryCol] || 'Sin categoría';
            const value = parseFloat(String(row[chartInfo.valueCol]).replace(/,/g, '')) || 0;
            acc[category] = (acc[category] || 0) + value;
            return acc;
        }, {});
    }
    new Chart(canvas, {
        type: 'pie',
        data: {
            labels: Object.keys(aggregatedData),
            datasets: [{
                data: Object.values(aggregatedData),
                backgroundColor: ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#1abc9c'],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1, 
            },
            plugins: {
                title: { display: true, text: chartInfo.title, font: { size: 16 } },
                datalabels: { display: false }
            }
        }
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    try {
        const dataUrl = await domtoimage.toPng(container);
        return dataUrl;
    } catch (error) {
        console.error('No se pudo generar la imagen del gráfico:', error);
        return null; 
    } finally {
        document.body.removeChild(container);
    }
}