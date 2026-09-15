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
    const [state, setState] = useState({ loading: true, categories: [], members: [], directory: [], parties: [], errors: {} });
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
        setState({ loading: true, categories: [], members: [], directory: [], parties: [], errors: {} });
        const jobs = [taskRead ? taskService.getTasks(requestedProjectId) : Promise.resolve(null), memberService.getProjectMembers(requestedProjectId), docsRead ? docs.getDirectory(requestedProjectId) : Promise.resolve(null), docsRead ? docs.getParties(requestedProjectId) : Promise.resolve(null)];
        const request = Promise.allSettled(jobs).then((results) => {
            if (generation !== generationRef.current || String(requestedProjectId) !== String(project.id)) return;
            const errors = {}; ['tasks', 'members', 'directory', 'parties'].forEach((key, index) => { if (results[index].status === 'rejected') errors[key] = results[index].reason; });
            setState({ loading: false, categories: results[0].value?.categories || [], members: results[1].value?.members || [], directory: results[2].value?.directory || [], parties: results[3].value?.parties || [], errors });
        }).finally(() => { if (requestRef.current?.promise === request) requestRef.current = null; });
        requestRef.current = { projectId: requestedProjectId, taskService, memberService, docs, taskRead, docsRead, promise: request };
    }, [docs, docsRead, memberService, project.id, taskRead, taskService]);
    const summary = useMemo(() => projectDashboardSummary(project, state.categories), [project, state.categories]);
    const navigate = (module) => onSelectModule?.(module);
    if (state.loading) return <MobileLoadingState label="Loading project dashboard" rows={4} />;
    const sectionError = (key) => state.errors[key] && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">This section is unavailable under the current ERP response.</p>;
    return <div data-m5-module="Dashboard" className="min-w-0 space-y-4 px-4 pb-28">
        <MobileCard className="bg-gradient-to-br from-slate-950 to-blue-950 text-white"><p className="text-[10px] font-bold uppercase text-blue-300">{project.project_code || project.id} · {project.status || 'active'}</p><h2 className="mt-2 text-xl font-black">{project.name}</h2><p className="mt-2 flex items-center gap-1 text-xs text-slate-300"><MapPin size={14} />{project.location || 'Location not set'}</p><p className="mt-1 text-xs text-slate-300">Employer / Owner: <b className="text-white">{summary.owner}</b></p></MobileCard>
        <div className="grid grid-cols-2 gap-3"><MobileStatCard label="Project completion" value={`${summary.completion}%`} icon={Activity} /><MobileStatCard label="Tasks completed" value={`${summary.taskStats.completed}/${summary.taskStats.total}`} detail={taskRead ? `${summary.taskStats.inProgress} in progress` : 'Tasks permission required'} icon={CheckCircle2} tone="green" /><MobileStatCard label="Team" value={state.members.length || project.memberCount || 0} detail={`${state.directory.length} contacts · ${state.parties.length} parties`} icon={Users} /><MobileStatCard label="Health" value={summary.issues === 'None' ? 'Healthy' : summary.issues} icon={AlertTriangle} tone={summary.issues === 'None' ? 'green' : 'amber'} /></div>
        {sectionError('tasks')}{sectionError('members')}{sectionError('directory')}{sectionError('parties')}
        <MobileCard><div className="flex items-center justify-between"><h3 className="text-sm font-black">Project phases</h3><button onClick={() => navigate('Phases')} className="min-h-11 text-xs font-bold text-blue-600">View phases</button></div><div className="space-y-3">{summary.phases.map((phase, index) => <div key={phase.id || `${phase.name}-${index}`}><div className="flex justify-between gap-3 text-xs"><span className="truncate font-semibold">{phase.name}</span><span>{Number(phase.progress) || 0}%</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gh-hover"><div className="h-full bg-blue-600" style={{ width: `${Math.min(100, Number(phase.progress) || 0)}%` }} /></div></div>)}</div></MobileCard>
        <MobileCard><h3 className="text-sm font-black">Financial & budget summary</h3><p className="mt-1 text-[11px] text-gray-500">Static dashboard summary from the current ERP presentation.</p><div className="mt-3 grid grid-cols-2 gap-3 text-xs">{Object.entries(STATIC_FINANCIAL_SUMMARY).slice(0, 4).map(([key, value]) => <div key={key} className="rounded-xl bg-gray-50 p-3 dark:bg-gh-hover"><span className="block text-gray-500">{key.replace(/([A-Z])/g, ' $1')}</span><b className="mt-1 block">{value}</b></div>)}</div></MobileCard>
        <MobileCard><h3 className="text-sm font-black">Drawings & technical documents</h3><p className="mt-1 text-[11px] text-gray-500">Static discipline summary from the current ERP presentation.</p><div className="mt-3 space-y-2">{STATIC_DRAWING_DISCIPLINES.map((item) => <div key={item.name} className="flex justify-between text-xs"><span>{item.name}</span><b>{item.approved}/{item.total} approved</b></div>)}</div></MobileCard>
        <MobileCard><h3 className="text-sm font-black">Assigned team</h3>{state.members.length ? <div className="mt-3 space-y-2">{state.members.slice(0, 5).map((member) => <div key={member.user_id ?? member.id} className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-gh-hover"><b>{member.user_name || member.name || 'Project member'}</b><span className="ml-2 text-xs text-gray-500">{member.user_type || 'Employee'}</span></div>)}</div> : <MobileEmptyState icon={Users} title="No assigned team" />}</MobileCard>
        <MobileCard><h3 className="text-sm font-black">Recent meetings</h3><p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gh-muted">Recent meeting minutes are unavailable here because the current frontend service has no equivalent method. No meeting data has been fabricated.</p></MobileCard>
        <div className="grid grid-cols-2 gap-2">{[['Tasks', Layers], ['WIP', Activity], ['Phases', FileText], ['Settings', Users]].filter(([name]) => visibleModules.some((module) => module.key === name)).map(([name, Icon]) => <button key={name} onClick={() => navigate(name)} className="min-h-12 rounded-xl border border-gray-200 bg-white px-3 text-left text-sm font-bold dark:border-gh-border dark:bg-gh-subtle"><Icon size={16} className="mr-2 inline text-blue-600" />{name}</button>)}</div>
    </div>;
}
