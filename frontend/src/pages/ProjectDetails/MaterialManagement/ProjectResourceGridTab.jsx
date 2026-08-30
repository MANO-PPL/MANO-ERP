import React from 'react';
import ProjectResourceList from './ProjectResourceList';

export const ProjectResourceGridTab = ({
    projectId,
    setExtraBreadcrumbs,
    canWrite,
    showToast,
    onRefreshResources
}) => {
    return (
        <ProjectResourceList
            projectId={projectId}
            setExtraBreadcrumbs={setExtraBreadcrumbs}
            canWrite={canWrite}
            showToast={showToast}
            onRefreshResources={onRefreshResources}
        />
    );
};

export default ProjectResourceGridTab;
