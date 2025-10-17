function parseSpanishDate(dateString) {
    if (!dateString || typeof dateString !== 'string') return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return new Date(dateString + 'T00:00:00Z');
    }

    const monthMap = {
        'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11,
        'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
        'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
    };

    const parts = dateString.toLowerCase().replace(/ de /g, ' ').split(/[/ -]/);
    if (parts.length !== 3) return null;

    let day, month, year;
    const part0 = parseInt(parts[0], 10);
    const part2 = parseInt(parts[2], 10);

    if (!isNaN(part0) && part0 >= 1 && part0 <= 31) day = part0;

    if (!isNaN(part2)) {
        if (parts[2].length === 2) {
            year = part2 >= 70 ? 1900 + part2 : 2000 + part2;
        } else if (parts[2].length === 4) {
            year = part2;
        }
    }

    const monthPart = parts[1];
    if (monthMap[monthPart] !== undefined) {
        month = monthMap[monthPart];
    } else {
        const monthNum = parseInt(monthPart, 10);
        if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
            month = monthNum - 1;
        }
    }
    
    if (day !== undefined && month !== undefined && year !== undefined) {
        return new Date(Date.UTC(year, month, day));
    }

    return null;
}

function formatDateToDDMMYYYY(date) {
    if (!date || !(date instanceof Date) || isNaN(date)) return '';
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
}

function preprocessCSVData(csvText) {
    const parsedData = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false
    });

    const data = parsedData.data;
    const headers = parsedData.meta.fields;
    const dateColumns = headers.filter(h => ["creada", "actualizada"].includes(h.toLowerCase()));

    data.forEach(row => {
        dateColumns.forEach(colName => {
            const cellValue = row[colName];
            if (cellValue && typeof cellValue === 'string') {
                const dateObject = parseSpanishDate(cellValue.split(' ')[0]);
                row[colName] = formatDateToDDMMYYYY(dateObject) || cellValue;
            }
        });

        const summaryColumnName = 'Resumen';
        let summaryValue = row[summaryColumnName];
        if (summaryValue && typeof summaryValue === 'string' && summaryValue.length > 0) {
            let firstChar = summaryValue[0], secondChar = summaryValue.length > 1 ? summaryValue[1] : '';
            const rest = summaryValue.substring(2);
            if (isNaN(parseInt(firstChar, 10))) firstChar = firstChar.toUpperCase();
            if (isNaN(parseInt(secondChar, 10))) secondChar = secondChar.toUpperCase();
            row[summaryColumnName] = firstChar + secondChar + rest;
        }
    });

    return Papa.unparse(data, { header: true });
}