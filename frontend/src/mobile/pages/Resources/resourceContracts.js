export const resourceBulkUploadRequests = (service) => Object.freeze({
    validateRequest: service.bulkValidate,
    importRequest: service.bulkJson,
});

export const resourceRateServices = (resourceService, projectService) => Object.freeze({
    master: Object.freeze({
        resolved: resourceService.getResolvedRate,
        add: resourceService.addRate,
        update: resourceService.updateRate,
        history: resourceService.getRateHistory,
        clear: resourceService.clearManualRate,
    }),
    project: Object.freeze({
        resolved: projectService.getResolvedResourceRate,
        add: projectService.addResourceRate,
        update: projectService.updateResourceRate,
        history: projectService.getResourceRateHistory,
        clear: projectService.clearResourceRate,
    }),
});
