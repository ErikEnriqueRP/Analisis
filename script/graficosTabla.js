let myPieChart = null;

function openChartModalForTable(data, headers, tableName) {
    const modal = document.getElementById('chartModal');
    document.getElementById('chartModalTitle').textContent = `Crear Gráfico para: ${tableName}`;

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

    modal.style.display = 'flex';
}

function generateChart(data) {
    const categoryCol = document.getElementById('categoryColumn').value;
    const valueCol = document.getElementById('valueColumn').value;

    let aggregatedData;
    if (valueCol === '__count__') {
        aggregatedData = data.reduce((acc, row) => {
            const category = row[categoryCol] || 'Sin categoría';
            acc[category] = (acc[category] || 0) + 1;
            return acc;
        }, {});
    } else {
        aggregatedData = data.reduce((acc, row) => {
            const category = row[categoryCol] || 'Sin categoría';
            const value = parseFloat(String(row[valueCol]).replace(/,/g, '')) || 0;
            acc[category] = (acc[category] || 0) + value;
            return acc;
        }, {});
    }

    const canvas = document.getElementById('pieChart');
    const ctx = canvas.getContext('2d');
    if (myPieChart) myPieChart.destroy();

    myPieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(aggregatedData),
            datasets: [{
                label: valueCol === '__count__' ? 'Conteo' : valueCol,
                data: Object.values(aggregatedData),
                backgroundColor: ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#1abc9c'],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } }
        }
    });
}