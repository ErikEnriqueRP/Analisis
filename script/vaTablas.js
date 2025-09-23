document.addEventListener('DOMContentLoaded', () => {
    const mainCsvData = localStorage.getItem('csvData');
    const savedTablesData = localStorage.getItem('savedTables');
    const container = document.getElementById('dashboard-container');
    const deleteAllBtn = document.getElementById('deleteAllTablesBtn');

    if (!mainCsvData) {
        container.innerHTML = '<p class="error-msg">No se encontraron datos base. Por favor, <a href="index.html">carga un archivo CSV</a> primero.</p>';
        if (deleteAllBtn) deleteAllBtn.style.display = 'none';
        return;
    }

    const savedTables = JSON.parse(savedTablesData || '[]');

    if (savedTables.length === 0) {
        container.innerHTML = '<p class="info-msg">Aún no has guardado ninguna tabla. Ve a la <a href="tabla.html">página de la tabla</a> para filtrar y guardar una vista.</p>';
        if (deleteAllBtn) deleteAllBtn.style.display = 'none';
        return;
    }

    if (deleteAllBtn) {
        deleteAllBtn.style.display = 'inline-block';
        deleteAllBtn.addEventListener('click', deleteAllTables);
    }

    Papa.parse(mainCsvData, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            const fullData = results.data;
            const headers = results.meta.fields;

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

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete-single';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Borrar esta tabla';
    deleteBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        deleteSingleTable(tableInfo.id);
    });

    header.appendChild(titleWrapper);
    header.appendChild(deleteBtn);

    const panel = document.createElement('div');
    panel.className = 'accordion-panel';

    panel.dataset.currentPage = 1;
    const rowsPerPage = 50;

    const tableContainer = document.createElement('div');
    tableContainer.id = `table-container-${tableInfo.id}`;

    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination-controls';
    paginationContainer.id = `pagination-controls-${tableInfo.id}`;

    panel.appendChild(tableContainer);
    panel.appendChild(paginationContainer);

    header.addEventListener('click', () => {
        header.classList.toggle('active');
        if (panel.style.maxHeight) {
            panel.style.maxHeight = null;
        } else {
            if (!panel.dataset.hasBeenRendered) {
                renderTablePage(tableInfo.id, data, headers, rowsPerPage);
                panel.dataset.hasBeenRendered = "true";
            }
            panel.style.maxHeight = panel.scrollHeight + "px";
        }
    });

    card.appendChild(header);
    card.appendChild(panel);
    return card;
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