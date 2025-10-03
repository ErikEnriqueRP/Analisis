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

function mapPriorityToGroup(priority) {
    if (!priority) {
        return 'Prioridad Regular';
    }
    const lowerCasePriority = priority.toLowerCase();

    const highPriorities = ['medium', 'lowest', 'high'];
    if (highPriorities.includes(lowerCasePriority)) {
        return 'Estandar';
    }

    return 'Highest';
}