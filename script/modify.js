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
data.forEach(row => {
        headers.forEach(colName => {
            let cellValue = row[colName];
            if (cellValue && typeof cellValue === 'string' && cellValue.length > 0) {
                let firstChar = cellValue[0];
                let secondChar = cellValue.length > 1 ? cellValue[1] : '';
                const rest = cellValue.substring(2);

                if (isNaN(parseInt(firstChar, 10))) {
                    firstChar = firstChar.toUpperCase();
                }

                if (isNaN(parseInt(secondChar, 10))) {
                    secondChar = secondChar.toUpperCase();
                }
                cellValue = firstChar + secondChar + rest;
            }
            
            if (dateColumns.includes(colName) && cellValue && typeof cellValue === 'string' && cellValue.includes(' ')) {
                cellValue = cellValue.split(' ')[0];
            }
            row[colName] = cellValue;
        });
    });
    const newCsvText = Papa.unparse(data, {
        header: true
    });

    return newCsvText;
}