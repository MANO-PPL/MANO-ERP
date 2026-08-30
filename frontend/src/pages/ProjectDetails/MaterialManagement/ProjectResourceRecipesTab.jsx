import React from 'react';
import ResourceRecipesTab from '../../Resources/ResourceRecipesTab';

export const ProjectResourceRecipesTab = ({
    initialResourceId,
    resources,
    availableComponents,
    initialProjectId,
    onRefreshResources,
    showToast
}) => {
    return (
        <ResourceRecipesTab
            initialResourceId={initialResourceId}
            resources={resources}
            availableComponents={availableComponents}
            initialProjectId={initialProjectId}
            onRefreshResources={onRefreshResources}
            showToast={showToast}
        />
    );
};

export default ProjectResourceRecipesTab;
