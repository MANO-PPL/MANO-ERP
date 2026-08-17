import React, { useEffect } from 'react';
import ProjectResourceList from './ProjectResourceList';

const MaterialManagementIndex = ({ setExtraBreadcrumbs, canWrite }) => {
    useEffect(() => {
        if (setExtraBreadcrumbs) {
            setExtraBreadcrumbs([]);
        }
    }, [setExtraBreadcrumbs]);

    return (
        <ProjectResourceList
            setExtraBreadcrumbs={setExtraBreadcrumbs}
            canWrite={canWrite}
        />
    );
};

export default MaterialManagementIndex;
