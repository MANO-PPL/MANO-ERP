import React from 'react';
import { CalendarDays, ChevronRight, FileText, Users } from 'lucide-react';
import { MobileCard } from '../../../components/MobileCard';

const CATEGORIES = [
    {
        key: 'directory',
        name: 'Project Directory & Org Chart',
        desc: 'Directory of project parties, personnel roles & responsibilities, and automated organization chart.',
        icon: Users,
        type: 'Single Instance',
        getMeta: (counts) => {
            if (counts.directory == null && counts.parties == null) return 'Not loaded';
            const dirCount = counts.directory || 0;
            const partyCount = counts.parties || 0;
            return `${dirCount} contact${dirCount === 1 ? '' : 's'} · ${partyCount} part${partyCount === 1 ? 'y' : 'ies'}`;
        }
    },
    {
        key: 'summary',
        name: 'Project Summary',
        desc: 'High-level project scope summary, milestones, and active status updates.',
        icon: FileText,
        type: 'Single Instance',
        getMeta: (counts) => {
            if (counts.summary == null) return 'Not loaded';
            const count = counts.summary || 0;
            return `${count} milestone${count === 1 ? '' : 's'}`;
        }
    },
    {
        key: 'meetings',
        name: 'Project Meetings, Agendas & MoM',
        desc: 'Draft meeting agendas, notify invited members, and record Minutes of Meetings (MoM).',
        icon: CalendarDays,
        type: 'Episodic',
        getMeta: (counts) => {
            if (counts.meetings == null) return 'Not loaded';
            const count = counts.meetings || 0;
            return `${count} meeting${count === 1 ? '' : 's'}`;
        }
    }
];

export default function MobileGeneralDocumentsHub({ counts = {}, onSelect }) {
    return (
        <div data-m6-view="hub" className="w-full min-w-0 space-y-2 px-2 sm:px-3 pb-24">
            {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const meta = cat.getMeta(counts);
                const isSingleInstance = cat.type === 'Single Instance';

                return (
                    <MobileCard
                        key={cat.key}
                        as="button"
                        type="button"
                        onClick={() => onSelect(cat.key)}
                        className="group flex flex-col justify-between p-3 text-left transition-all active:scale-[0.99] hover:border-blue-500/40"
                    >
                        <div className="space-y-2">
                            {/* Header row: Icon & Type Badge */}
                            <div className="flex items-center justify-between">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-400">
                                    <Icon size={18} />
                                </div>
                                <span
                                    className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                                        isSingleInstance
                                            ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400'
                                            : 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-400'
                                    }`}
                                >
                                    {cat.type}
                                </span>
                            </div>

                            {/* Body: Title and Description */}
                            <div className="space-y-0.5">
                                <h3 className="text-xs font-semibold uppercase tracking-tight text-gray-900 group-hover:text-blue-600 dark:text-gh-text dark:group-hover:text-blue-400 transition-colors">
                                    {cat.name}
                                </h3>
                                <p className="text-[11px] font-normal leading-relaxed text-gray-500 dark:text-gh-muted line-clamp-2">
                                    {cat.desc}
                                </p>
                            </div>
                        </div>

                        {/* Footer row: Meta info and Action */}
                        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 dark:border-gh-border">
                            <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500">
                                {meta}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-blue-600 group-hover:translate-x-0.5 transition-transform dark:text-blue-400">
                                Open Document
                                <ChevronRight size={12} />
                            </span>
                        </div>
                    </MobileCard>
                );
            })}
        </div>
    );
}
