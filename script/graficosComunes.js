function mapStatusToGroup(status) {
    if (!status) {
        return 'Abiertos';
    }
    const lowerCaseStatus = status.toLowerCase();

    const finalizadosKeywords = ['finalizada', 'cerrado', 'resuelto'];
    if (finalizadosKeywords.some(keyword => lowerCaseStatus.includes(keyword))) {
        return 'Finalizada';
    }

    const canceladosKeywords = ['cancelado'];
    if (canceladosKeywords.some(keyword => lowerCaseStatus.includes(keyword))) {
        return 'Cancelado';
    }

    return 'Abiertos';
}