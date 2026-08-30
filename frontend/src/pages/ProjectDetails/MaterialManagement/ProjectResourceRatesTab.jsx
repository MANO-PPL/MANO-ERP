import React from 'react';
import ResourceRatesTab from '../../Resources/ResourceRatesTab';

export const ProjectResourceRatesTab = ({
    initialResourceId,
    resources,
    initialProjectId,
    onRefreshResources,
    showToast
}) => {
    return (
        <ResourceRatesTab
            initialResourceId={initialResourceId}
            resources={resources}
            initialProjectId={initialProjectId}
            onRefreshResources={onRefreshResources}
            showToast={showToast}
        />
    );
};

export default ProjectResourceRatesTab;
