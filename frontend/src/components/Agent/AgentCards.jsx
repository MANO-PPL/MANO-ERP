import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleHelp, Info, ShieldAlert } from 'lucide-react';
import { isExpired } from './agentModel.js';

const cardClass = 'rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-gh-border dark:bg-gh-subtle';
const buttonClass = 'rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gh-border dark:hover:bg-gh-hover';

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
                    <button type="button" className={`${buttonClass} ${confirmation.riskLevel === 'DESTRUCTIVE' ? 'border-red-400 text-red-700 dark:text-red-300' : 'text-blue-700 dark:text-blue-300'}`}
                        disabled={inactive || expired} onClick={() => onDecision(confirmation.confirmationId, 'confirm')}>{busy ? 'Sending decision…' : preview ? 'Confirm preview' : 'Confirm'}</button>
                </div>}
        </div>
    </AgentActionCard>;
}

export function AgentResultCard({ result, preview = false }) {
    preview = preview || result.simulation === true;
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
            <ul className="mt-2 divide-y divide-gray-100 dark:divide-gh-border">{result.items.map((item, index) => <li key={index} className="break-words py-2 text-xs"><span className="font-medium">{item.label}</span>{item.detail && <p className="mt-1 text-gray-500 dark:text-gh-muted">{item.detail}</p>}</li>)}</ul>
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
