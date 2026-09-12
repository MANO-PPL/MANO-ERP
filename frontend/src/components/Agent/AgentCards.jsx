import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, CircleHelp, Info, ShieldAlert, ArrowUpRight } from 'lucide-react';
import { isExpired } from './agentModel.js';
import { AgentChartCard, AgentMultiChartCard } from './AgentCharts.jsx';
import { AgentExecutiveCard } from './AgentExecutiveCard.jsx';
import { AgentApprovalCard } from './AgentApprovalCard.jsx';
import { AgentExportCard } from './AgentExportCard.jsx';
export { AgentChartCard, AgentMultiChartCard } from './AgentCharts.jsx';
export { AgentExecutiveCard } from './AgentExecutiveCard.jsx';
export { AgentApprovalCard } from './AgentApprovalCard.jsx';
/**
 * Visual card dispatcher for interactive agent responses including action cards,
 * metric charts, executive summaries, and approvals.
 */
const cardClass = 'rounded-xl border border-gray-200/90 bg-white p-3 text-xs shadow-2xs dark:border-gh-border dark:bg-gh-subtle';
const buttonClass = 'rounded-lg border border-gray-300/90 px-3 py-1.5 text-xs font-semibold hover:bg-gray-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gh-border dark:hover:bg-gh-hover';

export function AgentProvenance({ provenance }) {
    const entries = Array.isArray(provenance) ? provenance.filter(entry => entry && typeof entry.label === 'string') : [];
    if (!entries.length) return null;
    return <details className="mt-3 border-t border-gray-200 pt-2 text-xs text-gray-500 dark:border-gh-border dark:text-gh-muted">
        <summary className="cursor-pointer rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">Why this answer?</summary>
        <ul className="mt-2 space-y-2">
            {entries.map((entry, index) => <li key={index} className="break-words">
                <span className="font-medium">{entry.label}</span>
                {typeof entry.tool === 'string' && <span> · Tool: {entry.tool}</span>}
                {typeof entry.entityId === 'string' && <span> · Reference: {entry.entityId}</span>}
                {typeof entry.timestamp === 'string' && <span> · {entry.timestamp}</span>}
            </li>)}
        </ul>
    </details>;
}

function Fields({ fields }) {
    return <dl className="mt-3 space-y-2">
        {fields.map((field, index) => <div key={index} className="min-w-0 border-t border-gray-100 pt-2 dark:border-gh-border">
            <dt className="text-xs text-gray-500 dark:text-gh-muted">{field.label}</dt>
            <dd className="mt-1 break-words">
                {field.before !== undefined || field.after !== undefined ? <div className="grid grid-cols-2 gap-3">
                    <span><span className="block text-[11px] text-gray-500 dark:text-gh-muted">Current</span>{field.before ?? 'Not supplied'}</span>
                    <span><span className="block text-[11px] text-gray-500 dark:text-gh-muted">Proposed</span>{field.after ?? 'Not supplied'}</span>
                </div> : (field.value ?? 'Not supplied')}
            </dd>
        </div>)}
    </dl>;
}

export function AgentActionCard({ action, preview = false, children }) {
    const destructive = action.riskLevel === 'DESTRUCTIVE';
    const Icon = destructive ? ShieldAlert : Info;
    return <section className={`${cardClass} ${destructive ? 'border-red-300 dark:border-red-800' : ''}`} aria-label={`${preview ? 'Simulation' : 'Proposed action'}: ${action.title}`}>
        <div className={`mb-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold ${destructive ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
            <Icon size={15} aria-hidden="true" />
            <span>{preview || action.simulation ? 'Simulation · Proposed' : 'Proposed action'}</span>
            <span className="rounded border border-current px-1.5 py-0.5">{action.riskLevel.replace('_', ' ')}</span>
        </div>
        <h3 className="break-words font-semibold">{action.title}</h3>
        {action.description && <p className="mt-1 break-words text-xs leading-relaxed text-gray-500 dark:text-gh-muted">{action.description}</p>}
        {destructive && <p className="mt-2 text-xs font-semibold text-red-700 dark:text-red-300">Destructive action — review carefully. Changes may be irreversible.</p>}
        {action.riskLevel === 'BULK_WRITE' && <p className="mt-2 text-xs">Affected records: {action.affectedRecords ?? 'Not supplied'}</p>}
        <Fields fields={action.fields} />
        {children}
    </section>;
}

export function AgentConfirmationCard({ message, pending, busy, onDecision, preview }) {
    const confirmation = message.confirmation;
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        if (!confirmation.expiresAt || message.decision || message.unavailable) return;
        setNow(Date.now());
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [confirmation.expiresAt, message.decision, message.unavailable]);
    const expired = isExpired(confirmation, now);
    const inactive = busy || !!message.decision || message.unavailable || pending?.confirmationId !== confirmation.confirmationId;
    return <AgentActionCard action={confirmation} preview={preview}>
        <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gh-border">
            <p className="text-xs font-semibold">Confirmation required</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gh-muted">{preview ? 'Preview only. These buttons cannot change ERP data.' : 'This action may modify ERP data. Review the supplied details before confirming.'}</p>
            {confirmation.expiresAt && !expired && <p className="mt-2 text-xs text-gray-500 dark:text-gh-muted">Expires {new Date(confirmation.expiresAt).toLocaleString()}</p>}
            {expired && !message.decision && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300" role="status">Confirmation expired. Cancel this proposal and request a new one.</p>}
            {message.unavailable && <p className="mt-2 text-xs">This confirmation is no longer available.</p>}
            {message.decision ? <p className="mt-2 text-xs font-medium">{preview ? `Preview ${message.decision === 'confirm' ? 'confirmed' : 'cancelled'}. No ERP action occurred.`
                : message.decision === 'cancel' ? 'Proposal cancelled.' : 'Confirmation recorded. Execution is not yet confirmed.'}</p>
                : <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button type="button" className={buttonClass} disabled={inactive} onClick={() => onDecision(confirmation.confirmationId, 'cancel')}>{preview ? 'Cancel preview' : 'Cancel'}</button>
                    <button type="button" className={`${buttonClass} ${confirmation.riskLevel === 'DESTRUCTIVE' ? 'border-red-400 text-red-700 dark:text-red-300' : confirmation.riskLevel === 'BULK_WRITE' ? 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600 shadow-sm' : 'text-blue-700 dark:text-blue-300'}`}
                        disabled={inactive || expired} onClick={() => onDecision(confirmation.confirmationId, 'confirm')}>
                        {busy ? 'Sending decision…' : preview ? 'Confirm preview' : confirmation.riskLevel === 'BULK_WRITE' ? `Confirm Import (${confirmation.affectedRecords ?? ''} vendors)` : 'Confirm'}
                    </button>
                </div>}
        </div>
    </AgentActionCard>;
}

export function AgentResultCard({ result, preview = false, onPrompt }) {
    const navigate = useNavigate();
    preview = preview || result.simulation === true;
    if (result.kind === 'chart') {
        return <AgentChartCard chart={result} preview={preview} />;
    }
    if (result.kind === 'multi_chart') {
        return <AgentMultiChartCard multiChart={result} preview={preview} />;
    }
    if (result.kind === 'briefing') {
        return <AgentExecutiveCard briefing={result} preview={preview} onPrompt={onPrompt} />;
    }
    if (result.kind === 'approval_queue') {
        return <AgentApprovalCard queue={result} onPrompt={onPrompt} preview={preview} />;
    }
    if (result.kind === 'excel_export') {
        return <AgentExportCard exportData={result} preview={preview} />;
    }
    const execution = result.kind === 'execution';
    const success = execution && result.outcome === 'success';
    const Icon = execution && success && !preview ? CheckCircle2 : result.kind === 'warning' || execution ? AlertTriangle : Info;
    return <section className={cardClass} aria-label={`${preview ? 'Simulation: ' : ''}${result.title}`}>
        {preview && <p className="mb-2 text-[11px] font-semibold text-amber-700 dark:text-amber-300">Simulation · Test fixture · No ERP data</p>}
        <h3 className={`flex items-start gap-2 font-semibold ${success && !preview ? 'text-emerald-700 dark:text-emerald-300' : ''}`}><Icon className="mt-0.5 shrink-0" size={16} aria-hidden="true" />{result.title}</h3>
        {result.kind === 'summary' && <Fields fields={result.fields} />}
        {(result.kind === 'warning' || execution) && <p className="mt-2 break-words text-xs leading-relaxed">{result.text}</p>}
        {result.kind === 'list' && <>
            {result.count !== undefined && <p className="mt-1 text-xs text-gray-500 dark:text-gh-muted">{result.count} results</p>}
            <ul className="mt-2 divide-y divide-gray-100 dark:divide-gh-border">
                {result.items.map((item, index) => (
                    <li key={index} className="flex items-start justify-between gap-2 py-2 text-xs">
                        <div className="min-w-0 flex-1">
                            <span className="font-medium text-gray-800 dark:text-gray-200">{item.label}</span>
                            {item.detail && <p className="mt-1 text-gray-500 dark:text-gh-muted break-words text-[11px]">{item.detail}</p>}
                        </div>
                        {item.route && (
                            <button
                                type="button"
                                onClick={() => !preview && item.route && navigate(item.route)}
                                className="group inline-flex items-center gap-1 shrink-0 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-600 shadow-2xs hover:border-blue-400 hover:bg-blue-50/70 hover:text-blue-600 transition-all dark:border-gh-border dark:bg-gh-subtle dark:text-gray-300 dark:hover:border-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
                                title={`Teleport to ${item.label}`}
                            >
                                <span>Teleport</span>
                                <ArrowUpRight size={12} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                            </button>
                        )}
                    </li>
                ))}
            </ul>
        </>}
        {result.kind === 'table' && <div className="mt-2 overflow-x-auto rounded focus-visible:outline focus-visible:outline-blue-500" tabIndex={0} role="region" aria-label={`${result.title} table`}>
            <table className="w-full text-left text-xs"><thead><tr>{result.columns.map((column, index) => <th key={index} scope="col" className="border-b border-gray-200 p-2 dark:border-gh-border">{column}</th>)}</tr></thead>
                <tbody>{result.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td className="border-b border-gray-100 p-2 dark:border-gh-border" key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table>
        </div>}
    </section>;
}

export function AgentErrorCard({ error, onRetry, retryDisabled }) {
    return <section className={`${cardClass} border-amber-300 dark:border-amber-800`} aria-label="Assistant error">
        <p className="flex items-start gap-2 text-xs leading-relaxed"><CircleHelp size={17} className="shrink-0 text-amber-600" aria-hidden="true" />{error.message}</p>
        {error.retryable && <button type="button" className={`${buttonClass} mt-3`} onClick={onRetry} disabled={retryDisabled}>Retry request</button>}
    </section>;
}
