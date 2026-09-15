import React from 'react';
import { CheckSquare, MoreVertical } from 'lucide-react';
import { MobileCard } from '../../../components/MobileCard';
import { isTaskOverdue } from './mobileTaskModel';

export default function MobileTaskCard({ task, category, selected, selectionMode, members = [], onOpen, onToggle }) {
    const assignees = members.filter((member) => (task.assigneeIds || []).map(String).includes(String(member.id)));
    return <MobileCard as="article" className={`p-0 overflow-hidden ${selected ? 'ring-2 ring-blue-500' : ''}`}>
        <button type="button" onClick={() => selectionMode ? onToggle?.() : onOpen?.()} className="min-h-14 w-full p-4 text-left">
            <div className="flex items-start gap-3">
                {selectionMode && <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 dark:border-gh-border'}`}>{selected && <CheckSquare size={15} />}</span>}
                <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">{category}</span><span className="font-mono text-[10px] text-gray-400">{task.task_code || task.id}</span></span><strong className="mt-1 block break-words text-sm text-gray-950 dark:text-gh-text">{task.name}</strong></span>
                {!selectionMode && <MoreVertical size={18} className="shrink-0 text-gray-400" />}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold"><span className="rounded-full bg-gray-100 px-2 py-1 capitalize dark:bg-gh-hover">{task.status}</span><span className="rounded-full bg-gray-100 px-2 py-1 dark:bg-gh-hover">{task.priority}</span>{isTaskOverdue(task) && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">Overdue</span>}</div>
            <p className="mt-2 truncate text-[11px] text-gray-500 dark:text-gh-muted">{assignees.length ? assignees.map((member) => member.name).join(', ') : 'Unassigned'} · Due {task.dueDate || 'not set'}</p>
        </button>
    </MobileCard>;
}

