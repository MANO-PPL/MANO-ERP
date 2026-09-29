import React, { useEffect, useRef, useState } from 'react';
import api from '../../../../services/api';
import MobileBottomSheet from '../../../components/MobileBottomSheet';
import MobileLoadingState from '../../../components/MobileLoadingState';
import MobileEmptyState from '../../../components/MobileEmptyState';
import { createReportsRequestGuard, enrichAIRequest } from './mobileReportsModel';

export default function MobileReportsAISheet({ open, onClose, report, project, projectId, service }) {
    const client = service || { analyze: async (payload) => (await api.post('/ai/analyze-report', payload)).data };
    const [state, setState] = useState({ loading: false, data: null, error: null }); const guard = useRef(createReportsRequestGuard());
    const run = async () => { const token = guard.current.begin(projectId); setState({ loading: true, data: null, error: null }); try { const response = await client.analyze(enrichAIRequest(report, project)); const data = response?.data?.data || response?.data || response?.analysis || response; if (guard.current.isCurrent(token, projectId)) setState({ loading: false, data, error: null }); } catch (error) { if (guard.current.isCurrent(token, projectId)) setState({ loading: false, data: null, error }); } };
    useEffect(() => { guard.current.invalidate(projectId); setState({ loading: false, data: null, error: null }); if (open && report) run(); }, [open, projectId, report]);
    const points = state.data?.insights || state.data?.points || [];
    return <MobileBottomSheet open={open} onClose={onClose} title="AI Summary" description="Reports analysis; separate from the MANO Agent.">{state.loading ? <MobileLoadingState label="Analyzing report" rows={3}/> : state.error ? <MobileEmptyState title="Analysis unavailable" description={state.error?.response?.data?.message || state.error?.message || 'The report could not be analyzed.'} action={<button type="button" onClick={run} className="min-h-11 rounded-xl bg-blue-600 px-4 font-bold text-white">Retry</button>}/> : state.data ? <div className="space-y-3">{report?.isSynthetic && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">AI analysis is based on synthetic demonstration data.</p>}<section className="rounded-2xl bg-blue-50 p-4 dark:bg-blue-950/30"><h3 className="text-sm font-black">Executive Summary</h3><p className="mt-2 text-sm">{state.data.executiveSummary || state.data.summary || String(state.data)}</p></section>{points.map((point, index) => <div key={index} className="rounded-xl border p-3 text-sm dark:border-gh-border"><h3 className="font-bold">{typeof point === 'string' ? '' : point.title || ''}</h3><p>{typeof point === 'string' ? point : point.content || point.text || point.insight || ''}</p></div>)}<button type="button" onClick={run} className="min-h-11 w-full rounded-xl border font-bold dark:border-gh-border">Regenerate</button></div> : null}</MobileBottomSheet>;
}
