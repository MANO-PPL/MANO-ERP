import React from 'react';
import ResourceConversionsTab from '../../Resources/ResourceConversionsTab';

export const ProjectResourceConversionsTab = ({
    initialResourceId,
    resources,
    onRefreshResources,
    showToast
}) => {
    return (
        <ResourceConversionsTab
            initialResourceId={initialResourceId}
            resources={resources}
            onRefreshResources={onRefreshResources}
            showToast={showToast}
        />
    );
};

export default ProjectResourceConversionsTab;
