import React from 'react';
import { CheckSquare, MoreVertical } from 'lucide-react';
import { MobileCard } from '../../../components/MobileCard';
import { isTaskOverdue } from './mobileTaskModel';

export default function MobileTaskCard({ task, category, selected, selectionMode, members = [], onOpen, onToggle }) {
    const assignees = members.filter((member) => (task.assigneeIds || []).map(String).includes(String(member.id)));
    return <MobileCard as="article" className={`p-0 overflow-hidden ${selected ? 'ring-2 ring-blue-500' : ''}`}>
        <button type="button" onClick={() => selectionMode ? onToggle?.() : onOpen?.()} className="min-h-11 w-full p-2.5 sm:p-3 text-left">
            <div className="flex items-start gap-2.5">
                {selectionMode && <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 dark:border-gh-border'}`}>{selected && <CheckSquare size={13} />}</span>}
                <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-1.5"><span className="text-[10px] font-normal uppercase tracking-wider text-blue-600 dark:text-blue-400">{category}</span><span className="font-mono text-[10px] text-gray-400">{task.task_code || task.id}</span></span><strong className="mt-0.5 block break-words text-xs font-semibold text-gray-900 dark:text-gh-text">{task.name}</strong></span>
                {!selectionMode && <MoreVertical size={16} className="shrink-0 text-gray-400" />}
            </div>
            <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-normal"><span className="rounded bg-gray-100 px-1.5 py-0.5 capitalize dark:bg-gh-hover text-gray-600 dark:text-gh-muted">{task.status}</span><span className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gh-hover text-gray-600 dark:text-gh-muted">{task.priority}</span>{isTaskOverdue(task) && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">Overdue</span>}</div>
            <p className="mt-1.5 truncate text-[11px] font-normal text-gray-500 dark:text-gh-muted">{assignees.length ? assignees.map((member) => member.name).join(', ') : 'Unassigned'} · Due {task.dueDate || 'not set'}</p>
        </button>
    </MobileCard>;
}

