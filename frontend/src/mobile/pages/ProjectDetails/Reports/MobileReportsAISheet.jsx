import React, { useEffect, useRef, useState } from 'react';
import api from '../../../../services/api';
import MobileBottomSheet from '../../../components/MobileBottomSheet';
import MobileLoadingState from '../../../components/MobileLoadingState';
import MobileEmptyState from '../../../components/MobileEmptyState';
import { createReportsRequestGuard, enrichAIRequest } from './mobileReportsModel';

export default function MobileReportsAISheet({ open, onClose, report, project, projectId, service }) {
    const client = service || { analyze: async (payload) => (await api.post('/ai/analyze-report', payload)).data };
    const [state, setState] = useState({ loading: false, data: null, error: null });
    const guard = useRef(createReportsRequestGuard());

    const run = async () => {
        const token = guard.current.begin(projectId);
        setState({ loading: true, data: null, error: null });
        try {
            const response = await client.analyze(enrichAIRequest(report, project));
            const data = response?.data?.data || response?.data || response?.analysis || response;
            if (guard.current.isCurrent(token, projectId)) {
                setState({ loading: false, data, error: null });
            }
        } catch (error) {
            if (guard.current.isCurrent(token, projectId)) {
                setState({ loading: false, data: null, error });
            }
        }
    };

    useEffect(() => {
        guard.current.invalidate(projectId);
        setState({ loading: false, data: null, error: null });
        if (open && report) run();
    }, [open, projectId, report]);

    const points = state.data?.insights || state.data?.points || [];

    return (
        <MobileBottomSheet open={open} onClose={onClose} title="AI Summary" description="Reports analysis; separate from the MANO Agent.">
            {state.loading ? (
                <MobileLoadingState rows={3} />
            ) : state.error ? (
                <MobileEmptyState
                    title="Analysis unavailable"
                    description={state.error?.response?.data?.message || state.error?.message || 'The report could not be analyzed.'}
                    action={
                        <button
                            type="button"
                            onClick={run}
                            className="min-h-9 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                            Retry
                        </button>
                    }
                />
            ) : state.data ? (
                <div className="space-y-2">
                    {report?.isSynthetic && (
                        <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                            AI analysis is based on synthetic demonstration data.
                        </p>
                    )}
                    <section className="rounded-xl bg-blue-50 p-2.5 dark:bg-blue-950/30">
                        <h3 className="text-xs font-semibold text-gray-900 dark:text-gh-text">Executive Summary</h3>
                        <p className="mt-1 text-xs font-normal leading-relaxed text-gray-700 dark:text-gh-text">
                            {state.data.executiveSummary || state.data.summary || String(state.data)}
                        </p>
                    </section>
                    {points.map((point, index) => (
                        <div key={index} className="rounded-lg border border-gray-200 p-2.5 text-xs font-normal dark:border-gh-border">
                            {typeof point !== 'string' && point?.title && (
                                <h4 className="mb-0.5 font-semibold text-gray-900 dark:text-gh-text">{point.title}</h4>
                            )}
                            <p className="text-gray-700 dark:text-gh-text">
                                {typeof point === 'string' ? point : point.content || point.text || point.insight || ''}
                            </p>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={run}
                        className="min-h-9 w-full rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gh-border dark:text-gh-text dark:hover:bg-gh-card"
                    >
                        Regenerate
                    </button>
                </div>
            ) : null}
        </MobileBottomSheet>
    );
}
