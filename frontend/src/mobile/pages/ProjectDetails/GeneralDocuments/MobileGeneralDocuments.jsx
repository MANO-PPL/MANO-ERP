import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { generalDocsApi } from '../../../../services/generalDocsApi';
import MobilePageHeader from '../../../components/MobilePageHeader';
import MobileEmptyState from '../../../components/MobileEmptyState';
import MobileLoadingState from '../../../components/MobileLoadingState';
import MobileGeneralDocumentsHub from './MobileGeneralDocumentsHub';
import MobileProjectParties from './MobileProjectParties';
import MobileProjectDirectory from './MobileProjectDirectory';
import MobileProjectSummary from './MobileProjectSummary';
import MobileProjectMeetings from './MobileProjectMeetings';
import MobileOrganisationChart from './MobileOrganisationChart';
import { areAllForbidden, createGeneralDocumentsRequestGuard, resolveGeneralDocumentsView } from './mobileGeneralDocumentsModel';

export default function MobileGeneralDocuments({ projectId, canWrite, isAdmin, services = {} }) {
    const api = services.docs || generalDocsApi; const [search, setSearch] = useSearchParams(); const view = resolveGeneralDocumentsView(search.get('view'));
    const [counts, setCounts] = useState({}); const [loading, setLoading] = useState(view === 'hub'); const [error, setError] = useState(null); const [hubReload, setHubReload] = useState(0); const guard = useRef(createGeneralDocumentsRequestGuard());
    const setView = useCallback((next) => { const params = new URLSearchParams(search); if (next === 'hub') params.delete('view'); else params.set('view', next); setSearch(params); }, [search, setSearch]);
    useEffect(() => { if (view !== 'hub') return; const token = guard.current.begin(projectId, 'hub'); setLoading(true); setError(null); Promise.allSettled([api.getParties(projectId), api.getDirectory(projectId), api.getSummaries(projectId), api.getMeetings(projectId), api.getOrgChart(projectId)]).then((results) => { if (!guard.current.isCurrent(token)) return; const [parties, directory, summaries, meetings, organisation] = results.map((result) => result.status === 'fulfilled' ? result.value : null); setCounts({ parties: parties?.count ?? parties?.parties?.length, directory: directory?.count ?? directory?.directory?.length, summary: summaries?.summaries?.length, meetings: meetings?.count ?? meetings?.meetings?.length, organisation: organisation?.parties?.length }); if (results.every((result) => result.status === 'rejected')) setError(areAllForbidden(results) ? 'Access denied by the current ERP permission policy.' : 'General Documents could not be loaded.'); }).finally(() => { if (guard.current.isCurrent(token)) setLoading(false); }); }, [api, hubReload, projectId, view]);
    const props = useMemo(() => ({ projectId, canWrite, isAdmin, api, onBack: () => setView('hub') }), [api, canWrite, isAdmin, projectId, setView]);
    let content;
    if (view === 'hub') content = loading ? <MobileLoadingState label="Loading General Documents" rows={4} /> : error ? <MobileEmptyState title="General Documents unavailable" description={error} action={<button type="button" onClick={() => setHubReload((value) => value + 1)} className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white">Try again</button>} /> : <MobileGeneralDocumentsHub counts={counts} onSelect={setView} />;
    else if (view === 'parties') content = <MobileProjectParties {...props} />;
    else if (view === 'directory') content = <MobileProjectDirectory {...props} />;
    else if (view === 'summary') content = <MobileProjectSummary {...props} />;
    else if (view === 'meetings') content = <MobileProjectMeetings {...props} />;
    else content = <MobileOrganisationChart {...props} />;
    return <section data-m6-module="General Documents" className="min-w-0"><MobilePageHeader eyebrow="PROJECT WORKSPACE" title={view === 'hub' ? 'General Documents' : view.replace(/\b\w/g, (letter) => letter.toUpperCase())} description={view === 'hub' ? 'Project records, contacts, meetings, and organisation.' : undefined} onBack={view === 'hub' ? undefined : () => setView('hub')} />{content}</section>;
}
