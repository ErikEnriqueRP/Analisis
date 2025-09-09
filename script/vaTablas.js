// Variable global para almacenar todos los datos del CSV.
let fullData = [];
// Variable global para almacenar las cabeceras (nombres de las columnas).
let headers = [];
// Variable global para mantener un registro de las tablas que el usuario ha creado.
let customTables = [];
// Variable temporal para saber en qué tabla se está creando un gráfico.
let activeTableIdForChart = null;

document.addEventListener('DOMContentLoaded', () => {
    loadDataFromSession();
    setupEventListeners();
});

function loadDataFromSession() {
    const storedData = sessionStorage.getItem('csvData');
    if (storedData) {
        fullData = JSON.parse(storedData);
        if (fullData.length > 0) {
            headers = Object.keys(fullData[0]);
        }
    } else {
        document.getElementById('dashboard-container').innerHTML = 
            '<p>No se han cargado datos. Por favor, <a href="index.html">vuelva a la página de inicio</a> para cargar un archivo CSV.</p>';
        document.getElementById('createTableBtn').disabled = true;
        document.getElementById('exportAllBtn').disabled = true;
    }
}

function setupEventListeners() {
    document.getElementById('createTableBtn').addEventListener('click', openCreateTableModal);
    document.getElementById('exportAllBtn').addEventListener('click', exportAllToExcel);
    
    document.getElementById('saveNewTableBtn').addEventListener('click', createNewCustomTable);
    document.getElementById('generateChartBtn').addEventListener('click', generateChartForActiveTable);

    document.querySelectorAll('.modal .close-button').forEach(button => {
        button.addEventListener('click', (event) => {
            event.target.closest('.modal').style.display = 'none';
        });
    });
}

function openCreateTableModal() {
    const modal = document.getElementById('createTableModal');
    const columnsListDiv = document.getElementById('modalColumnsList');
    columnsListDiv.innerHTML = '';
    document.getElementById('newTableName').value = '';

    headers.forEach(header => {
        columnsListDiv.innerHTML += `
            <label>
                <input type="checkbox" value="${header}" checked>
                ${header}
            </label>
        `;
    });
    modal.style.display = 'flex';
}

function createNewCustomTable() {
    const tableName = document.getElementById('newTableName').value.trim();
    if (!tableName) {
        alert("Por favor, ingrese un nombre para la tabla.");
        return;
    }
    const selectedColumns = Array.from(document.querySelectorAll('#modalColumnsList input:checked'))
                                 .map(checkbox => checkbox.value);
    if (selectedColumns.length === 0) {
        alert("Debe seleccionar al menos una columna.");
        return;
    }

    const newTableObject = {
        id: `table-${Date.now()}`,
        name: tableName,
        columns: selectedColumns,
        data: fullData.map(row => {
            let newRow = {};
            selectedColumns.forEach(col => {
                newRow[col] = row[col];
            });
            return newRow;
        }),
        chartInstance: null,
        chartImageDataUrl: null
    };

    customTables.push(newTableObject);
    renderTableCard(newTableObject);
    document.getElementById('createTableModal').style.display = 'none';
}

function renderTableCard(tableObject) {
    const dashboardContainer = document.getElementById('dashboard-container');
    const card = document.createElement('div');
    card.className = 'table-card';
    card.id = tableObject.id;

    card.innerHTML = `
        <div class="table-card-header">
            <h3>${tableObject.name}</h3>
            <div class="table-card-controls">
                <button class="btn-create-chart btn btn-purple btn-small">Crear Gráfico</button>
                <button class="btn-delete-table btn btn-red btn-small">Borrar</button>
            </div>
        </div>
        <div class="table-container">
            <table>
                <thead><tr>${tableObject.columns.map(col => `<th>${col}</th>`).join('')}</tr></thead>
                <tbody>${tableObject.data.map(row => `<tr>${tableObject.columns.map(col => `<td>${row[col] || ''}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>
        </div>
        <div class="chart-container-card" style="height: 400px; margin-top: 1rem;">
            <canvas id="chart-${tableObject.id}"></canvas>
        </div>
    `;

    dashboardContainer.appendChild(card);
    
    card.querySelector('.btn-delete-table').addEventListener('click', () => deleteTableCard(tableObject.id));
    card.querySelector('.btn-create-chart').addEventListener('click', () => openChartModal(tableObject.id));
}

function deleteTableCard(tableId) {
    if (!confirm("¿Está seguro de que desea eliminar esta tabla?")) return;

    const tableIndex = customTables.findIndex(table => table.id === tableId);
    if (tableIndex > -1) {
        const tableObject = customTables[tableIndex];
        if (tableObject.chartInstance) {
            tableObject.chartInstance.destroy();
        }
        customTables.splice(tableIndex, 1);
    }
    
    document.getElementById(tableId)?.remove();
}

function openChartModal(tableId) {
    activeTableIdForChart = tableId;
    const tableObject = customTables.find(t => t.id === tableId);
    if (!tableObject) return;

    const catSelect = document.getElementById('categoryColumn');
    const valSelect = document.getElementById('valueColumn');
    catSelect.innerHTML = '';
    valSelect.innerHTML = '<option value="__count__">(Contar Registros)</option>';

    tableObject.columns.forEach(header => {
        catSelect.innerHTML += `<option value="${header}">${header}</option>`;
        
        let isColumnNumeric = true;
        let hasAnyValue = false;
        for (const row of tableObject.data) {
            const value = row[header];
            if (value && String(value).trim() !== '') {
                hasAnyValue = true;
                if (isNaN(String(value).replace(/,/g, ''))) {
                    isColumnNumeric = false;
                    break;
                }
            }
        }
        
        if (hasAnyValue && isColumnNumeric) {
            valSelect.innerHTML += `<option value="${header}">${header}</option>`;
        }
    });

    document.getElementById('chartModal').style.display = 'flex';
}

function generateChartForActiveTable() {
    if (!activeTableIdForChart) return;
    const tableObject = customTables.find(t => t.id === activeTableIdForChart);
    if (!tableObject) return;

    const categoryCol = document.getElementById('categoryColumn').value;
    const valueCol = document.getElementById('valueColumn').value;
    if (!categoryCol || !valueCol) {
        alert('Por favor, selecciona ambas columnas.');
        return;
    }

    let aggregatedData;
    if (valueCol === '__count__') {
        aggregatedData = tableObject.data.reduce((acc, row) => {
            const category = row[categoryCol] || 'Sin categoría';
            acc[category] = (acc[category] || 0) + 1;
            return acc;
        }, {});
    } else {
        aggregatedData = tableObject.data.reduce((acc, row) => {
            const category = row[categoryCol] || 'Sin categoría';
            const value = parseFloat(String(row[valueCol]).replace(/,/g, '')) || 0;
            if (value !== 0) {
                acc[category] = (acc[category] || 0) + value;
            }
            return acc;
        }, {});
    }
    
    drawPieChart(tableObject, aggregatedData, valueCol === '__count__' ? 'Conteo' : valueCol);
    document.getElementById('chartModal').style.display = 'none';
    activeTableIdForChart = null;
}

function drawPieChart(tableObject, data, valueColName) {
    const canvasId = `chart-${tableObject.id}`;
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    if (tableObject.chartInstance) {
        tableObject.chartInstance.destroy();
    }

    const chart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(data),
            datasets: [{
                label: valueColName,
                data: Object.values(data),
                backgroundColor: ['#3498db', '#2ecc71', '#f1c40f', '#e74c3c', '#9b59b6', '#1abc9c'],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                onComplete: () => {
                    tableObject.chartImageDataUrl = chart.toBase64Image('image/png');
                }
            },
            plugins: {
                legend: { position: 'right' },
                datalabels: {
                    formatter: (value, context) => {
                        const total = context.chart.getDatasetMeta(0).total || 1;
                        const percentage = (value / total * 100).toFixed(2);
                        return `${percentage}%`;
                    },
                    color: '#fff',
                    font: { weight: 'bold' }
                }
            }
        },
        plugins: [ChartDataLabels]
    });

    tableObject.chartInstance = chart;
}

async function exportAllToExcel() {
    if (customTables.length === 0) {
        alert("No hay tablas para exportar. Por favor, cree al menos una tabla.");
        return;
    }

    const workbook = new ExcelJS.Workbook();

    for (const tableObject of customTables) {
        const worksheet = workbook.addWorksheet(tableObject.name.replace(/[\*\[\]\:\?\\\/]/g, '').substring(0, 31));

        worksheet.columns = tableObject.columns.map(colName => ({
            header: colName,
            key: colName,
            width: 20
        }));
        worksheet.addRows(tableObject.data);

        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8E44AD' } };

        if (tableObject.chartImageDataUrl) {
            const imageId = workbook.addImage({
                base64: tableObject.chartImageDataUrl.split(',')[1],
                extension: 'png',
            });

            const dataEndRow = tableObject.data.length + 1;
            worksheet.addImage(imageId, {
                tl: { col: 0.5, row: dataEndRow + 2 },
                ext: { width: 500, height: 300 }
            });
        }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'Dashboard_Reporte.xlsx');
}