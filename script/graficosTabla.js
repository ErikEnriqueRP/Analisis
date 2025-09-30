Chart.register(ChartDataLabels);
let myPieChart = null;

function openChartModalForTable(tableInfo, data, headers) {
    const modal = document.getElementById('chartModal');
    const saveChartBtn = document.getElementById('saveChartBtn');
    document.getElementById('chartModalTitle').textContent = `Crear Gráfico para: ${tableInfo.name}`;

    const catSelect = document.getElementById('categoryColumn');
    const valSelect = document.getElementById('valueColumn');
    catSelect.innerHTML = "";
    valSelect.innerHTML = '<option value="__count__">(Contar Registros)</option>';

    headers.forEach(h => {
        catSelect.innerHTML += `<option value="${h}">${h}</option>`;
        let isNumeric = data.some(row => row[h] && !isNaN(Number(String(row[h]).replace(/,/g, ""))));
        if (isNumeric) {
            valSelect.innerHTML += `<option value="${h}">${h}</option>`;
        }
    });

    document.getElementById('generateChartBtn').onclick = () => {
        generateChart(data);
    };

    saveChartBtn.onclick = () => {
        saveCurrentChart(tableInfo.id, data);
    };

    modal.style.display = 'flex';
}

function generateChart(data) {
    const categoryCol = document.getElementById('categoryColumn').value;
    const valueCol = document.getElementById('valueColumn').value;

    if (!categoryCol || !valueCol) {
        alert("Por favor, selecciona ambas columnas.");
        return null;
    }

    let aggregatedData = {};
    const isStateChart = categoryCol === 'Estado';

    data.forEach(row => {
        let category;
        if (isStateChart) {
            category = mapStatusToGroup(row[categoryCol] || '');
        } else {
            category = row[categoryCol] || 'Sin categoría';
        }
        aggregatedData[category] = (aggregatedData[category] || 0) + (valueCol === '__count__' ? 1 : (parseFloat(String(row[valueCol]).replace(/,/g, '')) || 0));
    });
    
    const canvas = document.getElementById('pieChart');
    const legendContainer = document.getElementById('chart-legend');
    if (!canvas || !legendContainer) return;

    const ctx = canvas.getContext('2d');
    if (myPieChart) myPieChart.destroy();

    const total = Object.values(aggregatedData).reduce((sum, value) => sum + value, 0);
    const labels = Object.keys(aggregatedData);
    const values = Object.values(aggregatedData);
    
    let chartColors;
    if (isStateChart) {
        const stateColorMap = {
            'Abiertos': '#3498db',
            'Finalizada': '#2ecc71',
            'Cancelado': '#e74c3c'
        };
        chartColors = labels.map(label => stateColorMap[label] || '#bdc3c7');
    } else {
        chartColors = ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
    }
    
    myPieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: valueCol === '__count__' ? 'Conteo' : valueCol,
                data: values,
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
                    font: { weight: 'bold', size: 14 },
                    textStrokeColor: 'black',
                    textStrokeWidth: 2,
                    formatter: (value, ctx) => {
                        const percentage = (value / total * 100);
                        if (percentage < 5) return null;
                        return percentage.toFixed(1) + '%';
                    }
                }
            }
        }
    });

    legendContainer.innerHTML = '';
    const ul = document.createElement('ul');
    labels.forEach((label, index) => {
        const value = values[index];
        const percentage = total > 0 ? (value / total * 100).toFixed(2) : 0;
        const color = myPieChart.data.datasets[0].backgroundColor[index];
        
        const li = document.createElement('li');
        li.innerHTML = `<span class="legend-swatch" style="background-color: ${color}"></span><span>${label}: ${value.toLocaleString()} (${percentage}%)</span>`;
        ul.appendChild(li);
        
    });
    legendContainer.appendChild(ul);

    return { aggregatedData };
}

function saveCurrentChart(tableId, tableData) {
    const chartResult = generateChart(tableData);
    if (!chartResult) {
        return;
    }

    setTimeout(() => {
        const categoryCol = document.getElementById('categoryColumn').value;
        const valueCol = document.getElementById('valueColumn').value;

        const chartTitle = prompt("Introduce un nombre para este gráfico:", `Gráfico de ${categoryCol}`);
        if (!chartTitle || chartTitle.trim() === "") {
            alert("Guardado cancelado. Se necesita un nombre.");
            return;
        }

        const newChart = {
            id: Date.now(),
            title: chartTitle.trim(),
            categoryCol: categoryCol,
            valueCol: valueCol,
        };

        const savedTables = JSON.parse(localStorage.getItem('savedTables') || '[]');
        const tableToUpdate = savedTables.find(table => table.id === tableId);

        if (tableToUpdate) {
            if (!tableToUpdate.charts) {
                tableToUpdate.charts = [];
            }
            tableToUpdate.charts.push(newChart);
            localStorage.setItem('savedTables', JSON.stringify(savedTables));

            renderSingleSavedChart(newChart, tableData, tableId);
            document.getElementById('chartModal').style.display = 'none';
        }
    }, 50);
}