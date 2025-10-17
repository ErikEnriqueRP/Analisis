Chart.register(ChartDataLabels);

function parseSpanishDate(dateString) {
    if (!dateString) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return new Date(dateString);
    const monthMap = {'ene':0,'feb':1,'mar':2,'abr':3,'may':4,'jun':5,'jul':6,'ago':7,'sep':8,'oct':9,'nov':10,'dic':11,'enero':0,'febrero':1,'marzo':2,'abril':3,'mayo':4,'junio':5,'julio':6,'agosto':7,'septiembre':8,'octubre':9,'noviembre':10,'diciembre':11};
    const parts = dateString.toLowerCase().replace(/ de /g, ' ').split(/[/ -]/);
    if (parts.length < 3) return null;
    let day, month, year;
    for (const part of parts) {
        if (monthMap[part] !== undefined) month = monthMap[part];
        else if (part.length === 4 && !isNaN(part)) year = parseInt(part, 10);
        else if (part.length <= 2 && !isNaN(part)) day = parseInt(part, 10);
    }
    if (day !== undefined && month !== undefined && year !== undefined) return new Date(Date.UTC(year, month, day));
    return null;
}

function getFullYearFromString(dateString) {
    if (!dateString) return null;
    const date = parseSpanishDate(dateString);
    return date ? date.getUTCFullYear() : null;
}

function getMonthFromString(dateString) {
    if (!dateString) return null;
    const date = parseSpanishDate(dateString);
    return date ? date.getUTCMonth() : null;
}

const defaultVisibleColumns = ['Area','Clave de incidencia','Resumen','Prioridad','Estado','Creada','Actualizada'];

function getChartColors(isStateChart, labels) {
    if (isStateChart) {
        const stateColorMap = { 'Abiertos': '#3498db', 'Finalizada': '#2ecc71', 'Cancelado': '#e74c3c' };
        return labels.map(label => stateColorMap[label] || '#bdc3c7');
    }
    return ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
}

document.addEventListener('DOMContentLoaded', () => {
    const mainCsvData = localStorage.getItem('csvData');
    const savedTablesData = localStorage.getItem('savedTables');
    const container = document.getElementById('dashboard-container');
    const deleteAllBtn = document.getElementById('deleteAllTablesBtn');
    const exportAllBtn = document.getElementById('exportAllBtn');

    if (!mainCsvData) {
        container.innerHTML = '<p class="error-msg">No se encontraron datos base. Por favor, <a href="index.html">carga un archivo CSV</a> primero.</p>';
        if (deleteAllBtn) deleteAllBtn.style.display = 'none';
        if (exportAllBtn) exportAllBtn.style.display = 'none';
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

function applySavedFilters(data, filters) {
    const filterKeys = Object.keys(filters);
    if (filterKeys.length === 0) return data;

    return data.filter(row => {
        return filterKeys.every(columnName => {
            const filterValues = new Set(filters[columnName]);
            if (filterValues.size === 0) return true;
            
            const cellValue = row[columnName] || '';
            const sampleValue = [...filterValues][0];

            const isDateColumn = (columnName.toLowerCase() === "creada" || columnName.toLowerCase() === "actualizada");

            if (isDateColumn && typeof sampleValue === 'string') {
                if (sampleValue.includes('-')) {
                    const [filterYear, filterMonth] = sampleValue.split('-').map(Number);
                    const cellYear = getFullYearFromString(cellValue);
                    const cellMonth = getMonthFromString(cellValue);
                    return cellYear === filterYear && cellMonth === filterMonth;
                }
                
                if (/^\d{4}$/.test(sampleValue)) {
                    const filterYear = parseInt(sampleValue, 10);
                    const cellYear = getFullYearFromString(cellValue);
                    return cellYear === filterYear;
                }
            }
            
            return filterValues.has(cellValue);
        });
    });
}

function createTableCard(tableInfo, data, headers) {
    const card = document.createElement('div');
    card.className = 'table-card';
    const initialVisibleColumns = tableInfo.visibleColumns || defaultVisibleColumns;
    card.dataset.visibleColumns = JSON.stringify(initialVisibleColumns);

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
    const controlsWrapper = document.createElement('div');
    controlsWrapper.className = 'table-card-controls';
    const toggleColumnsBtn = document.createElement('button');
    toggleColumnsBtn.className = 'btn btn-blue';
    toggleColumnsBtn.textContent = initialVisibleColumns.length === headers.length ? 'Mostrar Predeterminadas' : 'Mostrar Todo';
    toggleColumnsBtn.onclick = () => {
        const currentVisible = JSON.parse(card.dataset.visibleColumns);
        if (currentVisible.length === headers.length) { 
            card.dataset.visibleColumns = JSON.stringify(defaultVisibleColumns);
            toggleColumnsBtn.textContent = 'Mostrar Todo';
        } else {
            card.dataset.visibleColumns = JSON.stringify(headers);
            toggleColumnsBtn.textContent = 'Mostrar Predeterminadas';
        }
        renderTablePage(tableInfo.id, data, headers, rowsPerPage);
    };
    controlsWrapper.appendChild(toggleColumnsBtn);

    const tableContainer = document.createElement('div');
    tableContainer.id = `table-container-${tableInfo.id}`;

    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination-controls';
    paginationContainer.id = `pagination-controls-${tableInfo.id}`;

    const chartsContainer = document.createElement('div');
    chartsContainer.className = 'saved-charts-container';
    chartsContainer.id = `charts-for-${tableInfo.id}`;

    panel.appendChild(controlsWrapper);
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

function aggregateChartData(chartInfo, tableData) {
    let aggregatedData = {};
    const categoryCol = chartInfo.categoryCol;

    tableData.forEach(row => {
        let category;
        if (categoryCol === 'Estado') {
            category = mapStatusToGroup(row['Estado']);
        } else if (categoryCol === 'Prioridad') {
            category = mapPriorityToGroup(row['Prioridad']);
        } else {
            category = row[categoryCol] || 'Sin categoría';
        }
        
        if (chartInfo.valueCol === '__count__') {
            aggregatedData[category] = (aggregatedData[category] || 0) + 1;
        } else {
            const value = parseFloat(String(row[chartInfo.valueCol]).replace(/,/g, '')) || 0;
            aggregatedData[category] = (aggregatedData[category] || 0) + value;
        }
    });
    return aggregatedData;
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
    canvasContainer.appendChild(canvas);
    const chartFooter = document.createElement('div');
    chartFooter.className = 'chart-card-footer';
    const detailsBtn = document.createElement('button');
    detailsBtn.className = 'btn-view-details';
    detailsBtn.textContent = 'Ver Detalles';
    detailsBtn.onclick = () => showChartDetails(chartInfo, tableData);
    chartFooter.appendChild(detailsBtn);
    chartCard.appendChild(chartHeader);
    chartCard.appendChild(canvasContainer);
    chartCard.appendChild(chartFooter);
    chartsContainer.appendChild(chartCard);
    const aggregatedData = aggregateChartData(chartInfo, tableData);
    const total = Object.values(aggregatedData).reduce((sum, value) => sum + value, 0);
    const labels = Object.keys(aggregatedData);
    const isStateChart = chartInfo.categoryCol === 'Estado';
    const chartColors = getChartColors(isStateChart, labels);
    new Chart(canvas.getContext('2d'), {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: Object.values(aggregatedData),
                backgroundColor: chartColors,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: {
                    display: true,
                    color: '#fff',
                    font: { weight: 'bold', size: 12 },
                    textStrokeColor: 'black',
                    textStrokeWidth: 2,
                    formatter: (value, ctx) => {
                        const percentage = (value / total * 100);
                        if (percentage < 8) return null;
                        return percentage.toFixed(0) + '%';
                    }
                }
            }
        }
    });
}

async function showChartDetails(chartInfo, tableData) {
    const modal = document.getElementById('chartDetailModal');
    const title = document.getElementById('chartDetailTitle');
    const image = document.getElementById('chartDetailImage');
    const legendContainer = document.getElementById('chartDetailLegend');
    title.textContent = chartInfo.title;
    image.src = '';
    legendContainer.innerHTML = '<p>Generando vista...</p>';
    modal.style.display = 'flex';
    const imageUrl = await generateChartImage(chartInfo, tableData);
    image.src = imageUrl;
    const aggregatedData = aggregateChartData(chartInfo, tableData);
    const total = Object.values(aggregatedData).reduce((sum, value) => sum + value, 0);
    const labels = Object.keys(aggregatedData);
    const isStateChart = chartInfo.categoryCol === 'Estado';
    const chartColors = getChartColors(isStateChart, labels);
    let legendHtml = '<ul>';
    labels.forEach((label, index) => {
        const value = aggregatedData[label];
        const percentage = total > 0 ? (value / total * 100).toFixed(2) : 0;
        const color = chartColors[index];
        legendHtml += `<li><span class="legend-swatch" style="background-color: ${color}"></span><span>${label}: ${value.toLocaleString()} (${percentage}%)</span></li>`;
    });
    legendHtml += '</ul>';
    legendContainer.innerHTML = legendHtml;
}

function deleteSingleChart(tableId, chartId) {
    if (!confirm("¿Estás seguro de que quieres borrar este gráfico?")) return;
    const savedTables = JSON.parse(localStorage.getItem('savedTables') || '[]');
    const tableToUpdate = savedTables.find(table => table.id === tableId);
    if (tableToUpdate && tableToUpdate.charts) {
        tableToUpdate.charts = tableToUpdate.charts.filter(chart => chart.id !== chartId);
        localStorage.setItem('savedTables', JSON.stringify(savedTables));
        const chartCardElement = document.getElementById(`chart-card-${chartId}`);
        if (chartCardElement) {
            chartCardElement.remove();
        }
    }
}

function renderTablePage(tableId, data, headers, rowsPerPage) {
    const card = document.querySelector(`#table-container-${tableId}`).closest('.table-card');
    const panel = card.querySelector('.accordion-panel');
    const tableContainer = card.querySelector(`#table-container-${tableId}`);
    if (!panel || !tableContainer) return;
    const visibleColumns = JSON.parse(card.dataset.visibleColumns);
    const visibleHeaders = headers.filter(h => visibleColumns.includes(h));
    const currentPage = parseInt(panel.dataset.currentPage, 10);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedData = data.slice(startIndex, endIndex);
    let tableHTML = '<table><thead><tr>';
    visibleHeaders.forEach(h => { tableHTML += `<th>${h}</th>`; });
    tableHTML += '</tr></thead><tbody>';
    if (paginatedData.length > 0) {
        paginatedData.forEach(row => {
            tableHTML += '<tr>';
            visibleHeaders.forEach(h => { tableHTML += `<td>${row[h] || ''}</td>`; });
            tableHTML += '</tr>';
        });
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
    paginationContainer.innerHTML = `<button class="btn-pagination" id="prev-${tableId}" ${currentPage === 1 ? 'disabled' : ''}>&laquo; Anterior</button><span>Página ${currentPage} de ${totalPages}</span><button class="btn-pagination" id="next-${tableId}" ${currentPage === totalPages ? 'disabled' : ''}>Siguiente &raquo;</button>`;
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
    const usedSheetNames = new Set();
    for (const table of savedTables) {
        let baseSheetName = table.name.replace(/[\\/*?[\]:]/g, "").substring(0, 26);
        let uniqueSheetName = baseSheetName;
        let counter = 1;
        while (usedSheetNames.has(uniqueSheetName)) {
            uniqueSheetName = `${baseSheetName} (${counter})`;
            counter++;
        }
        usedSheetNames.add(uniqueSheetName);
        const worksheet = workbook.addWorksheet(uniqueSheetName);
        const dataForSheet = applySavedFilters(fullData, table.filters);
        const cardElement = document.querySelector(`#charts-for-${table.id}`)?.closest('.table-card');
        let visibleColumnsForExport;
        if (cardElement && cardElement.dataset.visibleColumns) {
            visibleColumnsForExport = JSON.parse(cardElement.dataset.visibleColumns);
        } else {
            visibleColumnsForExport = table.visibleColumns || defaultVisibleColumns;
        }
        const visibleHeadersForExport = headers.filter(h => visibleColumnsForExport.includes(h));
        worksheet.columns = visibleHeadersForExport.map(h => ({ header: h, key: h, width: 20 }));
        const dataToExport = dataForSheet.map(row => {
            let exportRow = {};
            visibleHeadersForExport.forEach(h => {
                exportRow[h] = row[h];
            });
            return exportRow;
        });
        worksheet.addRows(dataToExport);
        visibleHeadersForExport.forEach((header, index) => {
            const cell = worksheet.getCell(1, index + 1);
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF34495E' } };
        });
        if (table.charts && table.charts.length > 0) {
            let chartRowStart = worksheet.rowCount + 3;
            for (const chartInfo of table.charts) {
                const aggregatedData = aggregateChartData(chartInfo, dataForSheet);
                const total = Object.values(aggregatedData).reduce((sum, val) => sum + val, 0);
                const fullDataUrl = await generateChartImage(chartInfo, dataForSheet);
                if (fullDataUrl && fullDataUrl.startsWith('data:image/png;base64,')) {
                    const base64Image = fullDataUrl.split(',')[1];
                    if (base64Image) {
                        const imageId = workbook.addImage({ base64: base64Image, extension: 'png' });
                        worksheet.addImage(imageId, {
                            tl: { col: 0, row: chartRowStart }, 
                            br: { col: 4, row: chartRowStart + 18 }
                        });
                    }
                }
                const dataTableStartRow = chartRowStart + 1;
                const dataTableStartCol = 5; 

                //const titleCell = worksheet.getCell(dataTableStartRow - 1, dataTableStartCol);
                //titleCell.value = chartInfo.title;
                //titleCell.font = { bold: true, size: 14 };
                const headerRow = worksheet.getRow(dataTableStartRow);
                const headerStyle = {
                    font: { bold: true, color: { argb: 'FFFFFFFF' } },
                    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } },
                    alignment: { horizontal: 'center' }
                };
                headerRow.getCell(dataTableStartCol).value = 'Categoría';
                headerRow.getCell(dataTableStartCol + 1).value = 'Valor';
                headerRow.getCell(dataTableStartCol + 2).value = 'Porcentaje';
                headerRow.getCell(dataTableStartCol).style = headerStyle;
                headerRow.getCell(dataTableStartCol + 1).style = headerStyle;
                headerRow.getCell(dataTableStartCol + 2).style = headerStyle;
                let currentRowNum = dataTableStartRow + 1;
                Object.entries(aggregatedData).forEach(([label, value]) => {
                    const percentage = total > 0 ? (value / total) : 0;
                    const row = worksheet.getRow(currentRowNum);
                    row.getCell(dataTableStartCol).value = label;
                    row.getCell(dataTableStartCol + 1).value = value;
                    row.getCell(dataTableStartCol + 2).value = percentage;
                    row.getCell(dataTableStartCol + 2).numFmt = '0.00%';
                    currentRowNum++;
                });
                const totalRow = worksheet.getRow(currentRowNum);
                totalRow.getCell(dataTableStartCol).value = 'Total';
                totalRow.getCell(dataTableStartCol + 1).value = total;
                totalRow.getCell(dataTableStartCol + 2).value = 1;
                totalRow.font = { bold: true };
                totalRow.getCell(dataTableStartCol + 2).numFmt = '0.00%';
                worksheet.getColumn(dataTableStartCol).width = 20;
                worksheet.getColumn(dataTableStartCol + 1).width = 12;
                worksheet.getColumn(dataTableStartCol + 2).width = 12;
                
                chartRowStart += 22;
            }
        }
    }
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'TablasGuardadas_ConGraficos.xlsx');
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

    const aggregatedData = aggregateChartData(chartInfo, tableData);
    const labels = Object.keys(aggregatedData);
    const isStateChart = chartInfo.categoryCol === 'Estado';
    const chartColors = getChartColors(isStateChart, labels);
    const total = Object.values(aggregatedData).reduce((sum, value) => sum + value, 0);

    new Chart(canvas, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: Object.values(aggregatedData),
                backgroundColor: chartColors,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 1 },
            plugins: {
                
                title: { display: true, text: chartInfo.title, font: { size: 16 } },
                datalabels: {
                    display: true,
                    color: '#fff',
                    font: { weight: 'bold' },
                    formatter: (value, ctx) => {
                        const percentage = (value / total * 100);
                        if (percentage < 4) return null;
                        return percentage.toFixed(1) + '%';
                    }
                }
            }
        }
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    try {
        const dataUrl = await domtoimage.toPng(canvas); 
        return dataUrl;
    } catch (error) {
        console.error('No se pudo generar la imagen del gráfico:', error);
        return null;
    } finally {
        document.body.removeChild(container);
    }
}

function parseSpanishDate(dateString) {
    if (!dateString) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return new Date(dateString);
    const monthMap = {'ene':0,'feb':1,'mar':2,'abr':3,'may':4,'jun':5,'jul':6,'ago':7,'sep':8,'oct':9,'nov':10,'dic':11,'enero':0,'febrero':1,'marzo':2,'abril':3,'mayo':4,'junio':5,'julio':6,'agosto':7,'septiembre':8,'octubre':9,'noviembre':10,'diciembre':11};
    
    const parts = dateString.toLowerCase().replace(/ de /g, ' ').split(/[/ -]/);
    if (parts.length < 3) return null;

    let day, month, year;
    let yearPart = parts[2];
    let dayPart = parts[0];
    let monthPart = parts[1];

    let yearNum = parseInt(yearPart, 10);
    if (!isNaN(yearNum)) {
        if (yearPart.length === 2) {
            year = yearNum > 50 ? 1900 + yearNum : 2000 + yearNum;
        } else if (yearPart.length === 4) {
            year = yearNum;
        }
    }

    if (monthMap[monthPart] !== undefined) {
        month = monthMap[monthPart];
    } else {
        let monthNum = parseInt(monthPart, 10);
        if (!isNaN(monthNum)) {
            month = monthNum - 1;
        }
    }

    let dayNum = parseInt(dayPart, 10);
    if (!isNaN(dayNum)) {
        day = dayNum;
    }

    if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year) {
        return new Date(Date.UTC(year, month, day));
    }

    return null;
}