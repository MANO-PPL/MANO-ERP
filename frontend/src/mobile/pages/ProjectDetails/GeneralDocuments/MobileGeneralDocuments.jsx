import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { generalDocsApi } from '../../../../services/generalDocsApi';
import MobilePageHeader from '../../../components/MobilePageHeader';
import MobileEmptyState from '../../../components/MobileEmptyState';
import MobileLoadingState from '../../../components/MobileLoadingState';
import MobileGeneralDocumentsHub from './MobileGeneralDocumentsHub';
import MobileProjectDirectoryOrgChart from './MobileProjectDirectoryOrgChart';
import MobileProjectSummary from './MobileProjectSummary';
import MobileProjectMeetings from './MobileProjectMeetings';
import { areAllForbidden, createGeneralDocumentsRequestGuard, resolveGeneralDocumentsView } from './mobileGeneralDocumentsModel';

export default function MobileGeneralDocuments({ projectId, canWrite, isAdmin, services = {} }) {
    const api = services.docs || generalDocsApi;
    const [search, setSearch] = useSearchParams();
    const rawView = search.get('view');
    const view = resolveGeneralDocumentsView(rawView);

    const [counts, setCounts] = useState({});
    const [loading, setLoading] = useState(view === 'hub');
    const [error, setError] = useState(null);
    const [hubReload, setHubReload] = useState(0);
    const guard = useRef(createGeneralDocumentsRequestGuard());

    const setView = useCallback((next) => {
        const params = new URLSearchParams(search);
        if (next === 'hub') params.delete('view');
        else params.set('view', next);
        setSearch(params);
    }, [search, setSearch]);

    useEffect(() => {
        if (view !== 'hub') return;
        const token = guard.current.begin(projectId, 'hub');
        setLoading(true);
        setError(null);
        Promise.allSettled([
            api.getParties(projectId),
            api.getDirectory(projectId),
            api.getSummaries(projectId),
            api.getMeetings(projectId)
        ]).then((results) => {
            if (!guard.current.isCurrent(token)) return;
            const [parties, directory, summaries, meetings] = results.map((result) =>
                result.status === 'fulfilled' ? result.value : null
            );
            setCounts({
                parties: parties?.count ?? parties?.parties?.length ?? 0,
                directory: directory?.count ?? directory?.directory?.length ?? 0,
                summary: summaries?.summaries?.length ?? 0,
                meetings: meetings?.count ?? meetings?.meetings?.length ?? 0
            });
            if (results.every((result) => result.status === 'rejected')) {
                setError(areAllForbidden(results) ? 'Access denied by the current ERP permission policy.' : 'General Documents could not be loaded.');
            }
        }).finally(() => {
            if (guard.current.isCurrent(token)) setLoading(false);
        });
    }, [api, hubReload, projectId, view]);

    const props = useMemo(() => ({
        projectId,
        canWrite,
        isAdmin,
        api,
        onBack: () => setView('hub')
    }), [api, canWrite, isAdmin, projectId, setView]);

    let content;
    if (view === 'hub') {
        content = loading ? (
            <div className="w-full min-w-0 space-y-2 px-2 sm:px-3 pb-24">
                <MobileLoadingState rows={3} showSearch={false} />
            </div>
        ) : error ? (
            <div className="w-full min-w-0 px-2 sm:px-3 pb-24">
                <MobileEmptyState
                    title="General Documents unavailable"
                    description={error}
                    action={
                        <button
                            type="button"
                            onClick={() => setHubReload((value) => value + 1)}
                            className="min-h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white"
                        >
                            Try again
                        </button>
                    }
                />
            </div>
        ) : (
            <MobileGeneralDocumentsHub counts={counts} onSelect={setView} />
        );
    } else if (view === 'directory' || view === 'org-chart') {
        content = (
            <MobileProjectDirectoryOrgChart
                initialTab={view === 'org-chart' ? 'chart' : 'directory'}
                {...props}
            />
        );
    } else if (view === 'summary') {
        content = <MobileProjectSummary {...props} />;
    } else {
        content = <MobileProjectMeetings {...props} />;
    }

    const headerTitle = useMemo(() => {
        if (view === 'hub') return 'General Documents';
        if (view === 'directory' || view === 'org-chart') return 'Project Directory & Org Chart';
        if (view === 'summary') return 'Project Summary';
        if (view === 'meetings') return 'Project Meetings, Agendas & MoM';
        return 'General Documents';
    }, [view]);

    return (
        <section data-m6-module="General Documents" className="w-full min-w-0">
            <MobilePageHeader
                eyebrow="PROJECT WORKSPACE"
                title={headerTitle}
                description={view === 'hub' ? 'Project directory, summary, and meetings & MoM.' : undefined}
                onBack={view === 'hub' ? undefined : () => setView('hub')}
            />
            {content}
        </section>
    );
}
