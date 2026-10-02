import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, FileText, Layers, MapPin, Users } from 'lucide-react';
import { generalDocsApi } from '../../../../services/generalDocsApi';
import { projectApi } from '../../../../services/projectApi';
import { tasksApi } from '../../../../services/tasksApi';
import { MobileCard, MobileStatCard } from '../../../components/MobileCard';
import MobileEmptyState from '../../../components/MobileEmptyState';
import MobileLoadingState from '../../../components/MobileLoadingState';
import { getProjectPermissionLevel } from '../mobileProjectModules';
import { projectDashboardSummary, STATIC_DRAWING_DISCIPLINES, STATIC_FINANCIAL_SUMMARY } from './mobileProjectDashboardModel';

export default function MobileProjectDashboard({ project, permissions, visibleModules = [], isAdmin, onSelectModule, services = {} }) {
    const taskService = services.tasks || tasksApi; const memberService = services.projects || projectApi; const docs = services.docs || generalDocsApi;
    const taskRead = isAdmin || getProjectPermissionLevel(permissions, 'Tasks') >= 1; const docsRead = isAdmin || getProjectPermissionLevel(permissions, 'General Documents') >= 1;
    const [state, setState] = useState({ loading: true, categories: [], members: [], directory: [], parties: [], meetings: [], errors: {} });
    const requestRef = useRef(null); const generationRef = useRef(0);
    useEffect(() => {
        const sameRequest = requestRef.current
            && String(requestRef.current.projectId) === String(project.id)
            && requestRef.current.taskService === taskService
            && requestRef.current.memberService === memberService
            && requestRef.current.docs === docs
            && requestRef.current.taskRead === taskRead
            && requestRef.current.docsRead === docsRead;
        if (sameRequest) return;
        const generation = ++generationRef.current; const requestedProjectId = project.id;
        setState({ loading: true, categories: [], members: [], directory: [], parties: [], meetings: [], errors: {} });
        const fetchMeetings = () => {
            if (typeof docs.getMeetings === 'function') return docs.getMeetings(requestedProjectId);
            if (typeof docs.getMoms === 'function') return docs.getMoms(requestedProjectId);
            return Promise.resolve(null);
        };
        const jobs = [
            taskRead ? taskService.getTasks(requestedProjectId) : Promise.resolve(null),
            memberService.getProjectMembers(requestedProjectId),
            docsRead ? docs.getDirectory(requestedProjectId) : Promise.resolve(null),
            docsRead ? docs.getParties(requestedProjectId) : Promise.resolve(null),
            docsRead ? fetchMeetings() : Promise.resolve(null)
        ];
        const request = Promise.allSettled(jobs).then((results) => {
            if (generation !== generationRef.current || String(requestedProjectId) !== String(project.id)) return;
            const errors = {}; ['tasks', 'members', 'directory', 'parties', 'meetings'].forEach((key, index) => { if (results[index].status === 'rejected') errors[key] = results[index].reason; });
            const meetingsData = results[4]?.value?.meetings || results[4]?.value?.moms || (Array.isArray(results[4]?.value) ? results[4]?.value : []);
            setState({
                loading: false,
                categories: results[0].value?.categories || [],
                members: results[1].value?.members || [],
                directory: results[2].value?.directory || [],
                parties: results[3].value?.parties || [],
                meetings: Array.isArray(meetingsData) ? meetingsData : [],
                errors
            });
        }).finally(() => { if (requestRef.current?.promise === request) requestRef.current = null; });
        requestRef.current = { projectId: requestedProjectId, taskService, memberService, docs, taskRead, docsRead, promise: request };
    }, [docs, docsRead, memberService, project.id, taskRead, taskService]);
    const summary = useMemo(() => projectDashboardSummary(project, state.categories), [project, state.categories]);
    const navigate = (module) => onSelectModule?.(module);
    if (state.loading) return <MobileLoadingState label="Loading project dashboard" rows={4} />;
    const sectionError = (key) => state.errors[key] && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">This section is unavailable under the current ERP response.</p>;
    return <div data-m5-module="Dashboard" className="w-full min-w-0 space-y-2 px-2 sm:px-3 pb-24">
        <MobileCard className="bg-gradient-to-br from-slate-950 to-blue-950 text-white p-3"><p className="text-[10px] font-normal uppercase text-blue-300">{project.project_code || project.id} · {project.status || 'active'}</p><h2 className="mt-1 text-base font-bold">{project.name}</h2><p className="mt-1.5 flex items-center gap-1 text-[11px] font-normal text-slate-300"><MapPin size={13} />{project.location || 'Location not set'}</p><p className="mt-0.5 text-[11px] font-normal text-slate-300">Employer / Owner: <span className="font-semibold text-white">{summary.owner}</span></p></MobileCard>
        <div className="grid grid-cols-2 gap-2"><MobileStatCard label="Project completion" value={`${summary.completion}%`} icon={Activity} /><MobileStatCard label="Tasks completed" value={`${summary.taskStats.completed}/${summary.taskStats.total}`} detail={taskRead ? `${summary.taskStats.inProgress} in progress` : 'Tasks permission required'} icon={CheckCircle2} tone="green" /><MobileStatCard label="Team" value={state.members.length || project.memberCount || 0} detail={`${state.directory.length} contacts · ${state.parties.length} parties`} icon={Users} /><MobileStatCard label="Health" value={summary.issues === 'None' ? 'Healthy' : summary.issues} icon={AlertTriangle} tone={summary.issues === 'None' ? 'green' : 'amber'} /></div>
        {sectionError('tasks')}{sectionError('members')}{sectionError('directory')}{sectionError('parties')}
        <MobileCard><div className="flex items-center justify-between"><h3 className="text-xs font-semibold text-gray-900 dark:text-gh-text">Project phases</h3><button onClick={() => navigate('Phases')} className="min-h-8 text-xs font-normal text-blue-600">View phases</button></div><div className="mt-2 space-y-2">{summary.phases.map((phase, index) => <div key={phase.id || `${phase.name}-${index}`}><div className="flex justify-between gap-3 text-xs"><span className="truncate font-normal">{phase.name}</span><span className="font-semibold">{Number(phase.progress) || 0}%</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gh-hover"><div className="h-full bg-blue-600" style={{ width: `${Math.min(100, Number(phase.progress) || 0)}%` }} /></div></div>)}</div></MobileCard>
        <MobileCard><h3 className="text-xs font-semibold text-gray-900 dark:text-gh-text">Financial & budget summary</h3><p className="mt-0.5 text-[11px] font-normal text-gray-500">Static dashboard summary from the current ERP presentation.</p><div className="mt-2 grid grid-cols-2 gap-2 text-xs">{Object.entries(STATIC_FINANCIAL_SUMMARY).slice(0, 4).map(([key, value]) => <div key={key} className="rounded-xl bg-gray-50 p-2.5 dark:bg-gh-hover"><span className="block font-normal text-gray-500">{key.replace(/([A-Z])/g, ' $1')}</span><span className="mt-0.5 block font-semibold text-gray-900 dark:text-gh-text">{value}</span></div>)}</div></MobileCard>
        <MobileCard><h3 className="text-xs font-semibold text-gray-900 dark:text-gh-text">Drawings & technical documents</h3><p className="mt-0.5 text-[11px] font-normal text-gray-500">Static discipline summary from the current ERP presentation.</p><div className="mt-2 space-y-1.5">{STATIC_DRAWING_DISCIPLINES.map((item) => <div key={item.name} className="flex justify-between text-xs"><span className="font-normal text-gray-600 dark:text-gh-muted">{item.name}</span><span className="font-semibold">{item.approved}/{item.total} approved</span></div>)}</div></MobileCard>
        <MobileCard><h3 className="text-xs font-semibold text-gray-900 dark:text-gh-text">Assigned team</h3>{state.members.length ? <div className="mt-2 space-y-1.5">{state.members.slice(0, 5).map((member) => <div key={member.user_id ?? member.id} className="rounded-xl bg-gray-50 p-2.5 text-xs dark:bg-gh-hover"><span className="font-semibold text-gray-900 dark:text-gh-text">{member.user_name || member.name || 'Project member'}</span><span className="ml-2 font-normal text-gray-500">{member.user_type || 'Employee'}</span></div>)}</div> : <MobileEmptyState icon={Users} title="No assigned team" />}</MobileCard>
        <MobileCard>
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gray-900 dark:text-gh-text">Recent meetings (MoM)</h3>
                {docsRead && (
                    <button onClick={() => navigate('General Documents')} className="min-h-8 text-xs font-normal text-blue-600 dark:text-blue-400">
                        View MoMs
                    </button>
                )}
            </div>
            {state.meetings.length ? (
                <div className="mt-2 space-y-1.5">
                    {state.meetings.slice(0, 4).map((meeting, idx) => (
                        <div key={meeting.id || idx} className="rounded-xl bg-gray-50 p-2.5 text-xs dark:bg-gh-hover">
                            <div className="flex justify-between font-normal">
                                <span className="truncate font-semibold text-gray-900 dark:text-gh-text">{meeting.title || `Meeting #${meeting.id}`}</span>
                                <span className="ml-2 shrink-0 font-mono text-[10px] text-gray-400">
                                    {meeting.meeting_date ? new Date(meeting.meeting_date).toLocaleDateString() : 'Recent'}
                                </span>
                            </div>
                            <p className="mt-0.5 truncate text-[11px] font-normal text-gray-500 dark:text-gh-muted">
                                {meeting.location || meeting.attendees || 'Site Progress Review'}
                            </p>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="mt-1.5 text-xs font-normal text-gray-400">No meeting minutes recorded yet</p>
            )}
        </MobileCard>
        <div className="grid grid-cols-2 gap-2">{[['Tasks', Layers], ['WIP', Activity], ['Phases', FileText], ['Settings', Users]].filter(([name]) => visibleModules.some((module) => module.key === name)).map(([name, Icon]) => <button key={name} onClick={() => navigate(name)} className="min-h-10 rounded-xl border border-gray-200 bg-white px-3 text-left text-xs font-normal dark:border-gh-border dark:bg-gh-subtle"><Icon size={15} className="mr-2 inline text-blue-600" />{name}</button>)}</div>
    </div>;
}
