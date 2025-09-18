function preprocessCSVData(csvText) {
    const parsedData = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true
    });

    const data = parsedData.data;
    const headers = parsedData.meta.fields;

    const targetDateColumns = ["creada", "actualizada"];
    const dateColumns = headers.filter(h => targetDateColumns.includes(h.toLowerCase()));
    if (dateColumns.length === 0) {
        console.warn("No se encontraron las columnas 'Creada' o 'Actualizada' para modificar.");
        return csvText;
    }

    console.log("Columnas de fecha encontradas y modificadas:", dateColumns);

    data.forEach(row => {
        dateColumns.forEach(colName => {
            const cellValue = row[colName];

            if (cellValue && typeof cellValue === 'string' && cellValue.includes(' ')) {
                row[colName] = cellValue.split(' ')[0];
            }
        });
    });

    const newCsvText = Papa.unparse(data, {
        header: true
    });

    return newCsvText;
}