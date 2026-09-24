import React from 'react';
import { motion } from 'framer-motion';
import {
    Users,
    Building2,
    Building,
    User,
    Focus,
    Phone,
    Mail
} from 'lucide-react';
import MeasuredChildrenRow from './MeasuredChildrenRow';
import {
    CATEGORY_BADGE_STYLES,
    CHART_LINE_W,
    CHART_STEM_H
} from '../constants';

// ─── Org Chart Interactive Node Component ────────────────────────────────────
// Renders ONLY the node card + a vertical stem + MeasuredChildrenRow.
// ─────────────────────────────────────────────────────────────────────────────
const OrgChartNode = React.memo(({
    node,
    onSelect,
    selectedNodeId,
    level = 0,
    isFirst = true,
    isLast = true,
    parentHasMany = false,
    hasDraggedRef,
    searchQuery = ''
}) => {
    if (!node) return null;

    const isProject = node.type === 'project';
    const isClient = node.type === 'client' || (node.category || '').toLowerCase() === 'client';
    const isParty = node.type === 'party';
    const isPerson = node.type === 'person';
    const isTeamBranch = node.type === 'team-branch';
    const isPartiesBranch = node.type === 'parties-branch';
    const isSelected = selectedNodeId === node.id;
    const hasChildren = node.children && node.children.length > 0;

    const isSearchMatch = Boolean(
        searchQuery &&
        searchQuery.trim() &&
        (
            (node.name && node.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) ||
            (node.role && node.role.toLowerCase().includes(searchQuery.trim().toLowerCase())) ||
            (node.party_name && node.party_name.toLowerCase().includes(searchQuery.trim().toLowerCase())) ||
            (node.responsibilities && node.responsibilities.toLowerCase().includes(searchQuery.trim().toLowerCase()))
        )
    );

    // ── Slim branch pill for "Team" / "Parties" group nodes ──
    if (isTeamBranch || isPartiesBranch) {
        return (
            <div className="flex flex-col items-center flex-shrink-0">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className={`
                        px-3.5 py-1.5 rounded-full border transition-all select-none flex items-center gap-1.5 shadow-sm cursor-pointer font-medium
                        ${isTeamBranch
                            ? 'bg-blue-50/90 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50 hover:bg-blue-100'
                            : 'bg-indigo-50/90 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-100'
                        }
                        ${isSearchMatch ? 'ring-2 ring-amber-400 dark:ring-amber-300 animate-pulse' : ''}
                    `}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (hasDraggedRef && hasDraggedRef.current) return;
                        onSelect(node);
                    }}
                >
                    {isTeamBranch ? (
                        <Users size={12} className="text-blue-600 dark:text-blue-400 shrink-0" />
                    ) : (
                        <Building2 size={12} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                    )}
                    <span className="text-[10px] font-medium">{node.name}</span>
                    {node.role && (
                        <span
                            className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${isTeamBranch
                                    ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200'
                                    : 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200'
                                }`}
                        >
                            {node.role}
                        </span>
                    )}
                </motion.div>

                {hasChildren && (
                    <>
                        <div
                            className="bg-slate-400 dark:bg-slate-500 flex-shrink-0"
                            style={{ width: `${CHART_LINE_W}px`, height: `${CHART_STEM_H}px` }}
                        />
                        <MeasuredChildrenRow
                            childNodes={node.children}
                            level={level}
                            onSelect={onSelect}
                            selectedNodeId={selectedNodeId}
                            hasDraggedRef={hasDraggedRef}
                            searchQuery={searchQuery}
                        />
                    </>
                )}
            </div>
        );
    }

    // ── Main node card ──
    return (
        <div className="flex flex-col items-center flex-shrink-0">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                onClick={(e) => {
                    e.stopPropagation();
                    if (hasDraggedRef && hasDraggedRef.current) return;
                    onSelect(node);
                }}
                className={`
                    relative select-none cursor-pointer text-left rounded-2xl border transition-all duration-200
                    ${isProject
                        ? 'bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 text-white border-blue-400/40 shadow-xl shadow-blue-500/25 min-w-[260px]'
                        : isClient
                            ? 'bg-gradient-to-br from-emerald-50 to-teal-50/70 dark:from-[#09231b] dark:to-[#0f3428] text-slate-900 dark:text-white border border-emerald-400/60 dark:border-emerald-500/30 shadow-md shadow-emerald-500/10 min-w-[240px]'
                            : isParty
                                ? 'bg-white dark:bg-[#161b22] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-md min-w-[220px]'
                                : 'bg-white dark:bg-[#1a2130] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-md min-w-[200px]'
                    }
                    ${isSelected ? 'ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-2 ring-offset-white dark:ring-offset-black scale-[1.03] z-10 shadow-xl' : 'hover:scale-[1.02]'}
                    ${isSearchMatch ? 'ring-3 ring-amber-400 dark:ring-amber-300 ring-offset-2 ring-offset-white dark:ring-offset-black shadow-xl shadow-amber-500/30' : ''}
                `}
            >
                {isProject && (
                    <div className="absolute top-0 inset-x-0 h-1 rounded-t-2xl bg-gradient-to-r from-blue-300 via-white/40 to-indigo-300 opacity-60" />
                )}

                <div className="px-4 py-3.5 space-y-2">
                    {/* Header: type badge + member count */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {isProject && <Focus size={14} className="text-blue-200 shrink-0" />}
                            {isClient && <Building size={14} className="text-emerald-500 dark:text-emerald-400 shrink-0" />}
                            {isParty && <Building2 size={13} className="text-indigo-500 dark:text-indigo-400 shrink-0" />}
                            {isPerson && <User size={12} className="text-blue-500 dark:text-blue-400 shrink-0" />}
                            {!isPerson && (
                                <span
                                    className={`text-[9px] font-medium px-2 py-0.5 rounded-full border ${isProject
                                            ? 'bg-white/20 text-white border-white/30'
                                            : isClient
                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300/60 dark:border-emerald-700/50'
                                                : (CATEGORY_BADGE_STYLES[node.category] || 'bg-gray-100 text-gray-700 border-gray-200')
                                        }`}
                                >
                                    {isProject ? 'Project' : node.category || 'Party'}
                                </span>
                            )}
                        </div>

                        {(isParty || isClient) && node.memberCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-medium text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/40 shrink-0">
                                <Users size={9} />
                                <span>{node.memberCount}</span>
                            </span>
                        )}
                    </div>

                    {/* Name & Role */}
                    <div className="space-y-0.5">
                        <h4
                            className={`font-semibold leading-snug line-clamp-2 ${isProject
                                    ? 'text-white text-sm'
                                    : isClient
                                        ? 'text-emerald-950 dark:text-emerald-50 text-xs'
                                        : 'text-slate-900 dark:text-white text-xs'
                                }`}
                            title={node.name}
                        >
                            {node.name || 'Untitled'}
                        </h4>

                        {node.role &&
                            node.role.toLowerCase() !== (node.category || '').toLowerCase() &&
                            node.role.toLowerCase() !== (node.name || '').toLowerCase() && (
                            <p
                                className={`text-[10px] font-normal leading-tight ${isProject
                                        ? 'text-blue-100'
                                        : isClient
                                            ? 'text-emerald-700 dark:text-emerald-400'
                                            : isPerson
                                                ? 'text-blue-600 dark:text-blue-400'
                                                : 'text-slate-500 dark:text-slate-400'
                                    }`}
                            >
                                {node.role}
                            </p>
                        )}
                    </div>

                    {/* Responsibilities */}
                    {node.responsibilities && (
                        <div className="border-t border-slate-100 dark:border-white/5 pt-1.5">
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-normal line-clamp-2 leading-relaxed italic">
                                {node.responsibilities}
                            </p>
                        </div>
                    )}

                    {/* Contact info */}
                    {(node.phone || node.email) && (
                        <div className="border-t border-slate-100 dark:border-white/5 pt-1.5 flex items-center gap-2 text-[9px] text-slate-500 dark:text-slate-400 truncate">
                            {node.phone && (
                                <span className="flex items-center gap-1 truncate">
                                    <Phone size={9} className="text-slate-400 shrink-0" />
                                    {node.phone}
                                </span>
                            )}
                            {node.phone && node.email && <span className="text-slate-300 dark:text-slate-600">•</span>}
                            {node.email && (
                                <span className="flex items-center gap-1 truncate">
                                    <Mail size={9} className="text-slate-400 shrink-0" />
                                    {node.email}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>

            {/* ── Outgoing: vertical stem → MeasuredChildrenRow ── */}
            {hasChildren && (
                <>
                    <div
                        className="bg-slate-400 dark:bg-slate-500 flex-shrink-0"
                        style={{ width: `${CHART_LINE_W}px`, height: `${CHART_STEM_H}px` }}
                    />
                    <MeasuredChildrenRow
                        childNodes={node.children}
                        level={level}
                        onSelect={onSelect}
                        selectedNodeId={selectedNodeId}
                        hasDraggedRef={hasDraggedRef}
                        searchQuery={searchQuery}
                    />
                </>
            )}
        </div>
    );
});

export default OrgChartNode;
