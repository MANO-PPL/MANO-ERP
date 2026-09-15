import React from 'react';
import { List } from 'lucide-react';
import MobilePageHeader from '../../components/MobilePageHeader';

export default function MobileProjectHeader({ project, projectId, activeModule, onBack, onOpenModules }) {
    const subtitle = [project?.project_code || projectId, project?.status, project?.location].filter(Boolean).join(' · ');
    return <MobilePageHeader
        eyebrow="Project workspace"
        title={project?.name || 'Project'}
        subtitle={subtitle || 'Project details'}
        onBack={onBack}
        actions={<button type="button" aria-label="Open project modules" onClick={onOpenModules} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm dark:border-gh-border dark:bg-gh-subtle dark:text-gh-muted"><List size={20} aria-hidden="true" /></button>}
    />;
}