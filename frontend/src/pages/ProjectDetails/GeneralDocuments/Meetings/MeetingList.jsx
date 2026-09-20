import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
    Calendar,
    Plus,
    Clock,
    MapPin,
    Users,
    Search,
    Trash2,
    FileText,
    ChevronRight,
    Loader2,
    Check
} from 'lucide-react';
import { motion } from 'framer-motion';
import { generalDocsApi } from '../../../../services/generalDocsApi';
import ConfirmModal from '../../../../components/ConfirmModal';
import { toast } from 'react-toastify';
// STATUS_CONFIG lives in constants.js — imported for local use and re-exported
// so any other file that does `import { STATUS_CONFIG } from './MeetingList'` still works.
import { STATUS_CONFIG } from './constants';
export { STATUS_CONFIG };

const MeetingList = ({ onBack, setExtraBreadcrumbs, onSelect, canWrite }) => {
    const { id: projectId } = useParams();
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Delete modal state
    const [deleteModal, setDeleteModal] = useState({
        isOpen: false,
        meetingId: null,
        meetingSubject: ''
    });

    useEffect(() => {
        if (setExtraBreadcrumbs) {
            setExtraBreadcrumbs([
                { label: 'General Documents', onClick: onBack },
                { label: 'Project Meetings & MoM' }
            ]);
        }

        fetchMeetings();
    }, [projectId]);

    const fetchMeetings = async () => {
        try {
            setLoading(true);
            const data = await generalDocsApi.getMeetings(projectId);
            if (data && data.meetings) {
                setMeetings(data.meetings);
            } else {
                setMeetings([]);
            }
        } catch (err) {
            console.error('Failed to fetch Meetings:', err);
            setMeetings([]);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = (e, meeting) => {
        e.stopPropagation();
        setDeleteModal({
            isOpen: true,
            meetingId: meeting.id,
            meetingSubject: meeting.subject || 'Untitled Meeting'
        });
    };

    const handleConfirmDelete = async () => {
        try {
            await generalDocsApi.deleteMeeting(projectId, deleteModal.meetingId);
            toast.success('Meeting deleted successfully');
            setDeleteModal({ isOpen: false, meetingId: null, meetingSubject: '' });
            fetchMeetings();
        } catch (err) {
            console.error('Failed to delete meeting:', err);
            toast.error(err.response?.data?.message || 'Failed to delete meeting');
        }
    };

    const statusCounts = useMemo(() => {
        const counts = { all: meetings.length, scheduled: 0, completed: 0, postponed: 0, cancelled: 0 };
        meetings.forEach(m => {
            const st = m.status || 'scheduled';
            if (counts[st] !== undefined) counts[st]++;
        });
        return counts;
    }, [meetings]);

    const filteredMeetings = useMemo(() => {
        return meetings.filter(m => {
            const currentStatus = m.status || 'scheduled';
            if (statusFilter !== 'all' && currentStatus !== statusFilter) {
                return false;
            }
            const query = searchQuery.toLowerCase();
            return (
                (m.subject || '').toLowerCase().includes(query) ||
                (m.venue || '').toLowerCase().includes(query) ||
                currentStatus.toLowerCase().includes(query) ||
                String(m.meeting_no || '').includes(query)
            );
        });
    }, [meetings, searchQuery, statusFilter]);

    return (
        <div className="flex-1 flex flex-col h-full bg-[#fafafa] dark:bg-[#0d1117] font-sans text-gray-900 dark:text-gray-200 transition-colors overflow-hidden">

            {/* Filter Toolbar */}
            <div className="px-4 py-2.5 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1117] flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Search Bar */}
                    <div className="relative w-56 sm:w-64">
                        <Search
                            size={14}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                        />
                        <input
                            type="text"
                            placeholder="Search meetings..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full h-8 pl-8 pr-3 bg-gray-50/80 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                        />
                    </div>

                    {/* Status Filter Tabs */}
                    <div className="inline-flex items-center bg-gray-100 dark:bg-white/5 p-1 rounded-lg border border-gray-200/80 dark:border-white/10 gap-1 select-none">
                        {[
                            { key: 'all', label: 'All', count: statusCounts.all },
                            { key: 'scheduled', label: 'Scheduled', count: statusCounts.scheduled },
                            { key: 'completed', label: 'Completed', count: statusCounts.completed },
                            { key: 'postponed', label: 'Postponed', count: statusCounts.postponed },
                            { key: 'cancelled', label: 'Cancelled', count: statusCounts.cancelled }
                        ].map(tab => {
                            const isSelected = statusFilter === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setStatusFilter(tab.key)}
                                    className={`h-7 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 leading-none ${
                                        isSelected
                                            ? 'bg-white dark:bg-[#161b22] text-gray-900 dark:text-white shadow-xs border border-gray-200/80 dark:border-white/10'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'
                                    }`}
                                >
                                    <span className="flex items-center justify-center">{tab.label}</span>
                                    <span className={`text-[11px] font-bold px-1.5 py-0.5 min-w-[18px] rounded-full inline-flex items-center justify-center text-center transition-colors ${
                                        isSelected
                                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                            : 'bg-gray-200/70 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                                    }`}>
                                        {tab.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <span>Showing:</span>
                        <span className="text-gray-900 dark:text-white font-bold">{filteredMeetings.length}</span>
                    </div>
                    {canWrite && (
                        <button
                            type="button"
                            onClick={() => onSelect('new')}
                            className="h-8 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-lg text-xs font-bold transition-all shadow-xs hover:shadow-sm cursor-pointer inline-flex items-center justify-center gap-1.5 leading-none"
                        >
                            <Plus size={14} className="stroke-[2.5]" />
                            <span className="flex items-center justify-center">New Meeting</span>
                        </button>
                    )}
                </div>
            </div>

            {/* List Body - Full Width 2-Column Tightly Packed Grid */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-2.5 custom-scrollbar">
                {loading ? (
                    <div className="h-36 flex flex-col items-center justify-center space-y-1.5">
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-normal">Loading meetings...</p>
                    </div>
                ) : filteredMeetings.length === 0 ? (
                    <div className="h-36 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-lg flex flex-col items-center justify-center p-3 text-center">
                        <div className="w-7 h-7 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-1.5">
                            <FileText size={15} />
                        </div>
                        <h3 className="text-xs font-semibold text-gray-900 dark:text-white">No Meetings Found</h3>
                        <p className="text-[10.5px] text-gray-500 dark:text-gray-400 max-w-xs mt-0.5">
                            {searchQuery
                                ? 'No meetings match your active search.'
                                : 'There are no meetings scheduled for this project yet.'}
                        </p>
                    </div>
                ) : (
                    /* 2 Meetings / MoMs Per Row tightly packed */
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 w-full">
                        {filteredMeetings.map((meeting, i) => {
                            const dateStr = meeting.date ? new Date(meeting.date).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                            }) : 'Date not set';
                            const statusCfg = STATUS_CONFIG[meeting.status] || STATUS_CONFIG.scheduled;
                            const hasMom = (meeting.mom_count || 0) > 0;
                            const hasAgenda = (meeting.agenda_count || 0) > 0;

                            return (
                                <motion.div
                                    key={meeting.id}
                                    initial={{ opacity: 0, y: 3 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.1, delay: i * 0.015 }}
                                    onClick={() => onSelect(meeting.id)}
                                    className="group relative bg-white dark:bg-[#161b22] border border-gray-200/80 dark:border-white/10 hover:border-blue-500/40 dark:hover:border-blue-500/40 rounded-md p-2 sm:p-2.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between gap-1.5"
                                >
                                    {/* Top Row: Badges, Subject, Delete */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            {/* Status & Lifecycle Badges */}
                                            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-medium border uppercase tracking-wider ${statusCfg.badge}`}>
                                                    <span className={`w-1 h-1 rounded-full ${statusCfg.dot}`}></span>
                                                    {statusCfg.label}
                                                </span>

                                                {hasMom ? (
                                                    <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                                                        <Check size={9} strokeWidth={2.5} />
                                                        <span>MoM Recorded</span>
                                                    </span>
                                                ) : hasAgenda ? (
                                                    <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.2 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
                                                        <Clock size={9} />
                                                        <span>MoM Pending</span>
                                                    </span>
                                                ) : null}
                                            </div>

                                            {/* Subject */}
                                            <h3 className="text-xs sm:text-[12.5px] font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
                                                {meeting.subject || 'Untitled Meeting'}
                                            </h3>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1 shrink-0">
                                            {canWrite && (
                                                <button
                                                    onClick={(e) => handleDeleteClick(e, meeting)}
                                                    className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                                                    title="Delete Meeting"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            )}
                                            <ChevronRight size={13} className="text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </div>

                                    {/* Bottom Details Bar */}
                                    <div className="pt-1.5 border-t border-gray-100 dark:border-white/5 flex items-center gap-2 text-[10.5px] text-gray-500 dark:text-gray-400 flex-wrap font-normal">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={10.5} className="text-gray-400" />
                                            <span>{dateStr}</span>
                                        </span>

                                        {meeting.time && (
                                            <span className="flex items-center gap-1">
                                                <Clock size={10.5} className="text-gray-400" />
                                                <span>{meeting.time}</span>
                                            </span>
                                        )}

                                        {meeting.venue && (
                                            <span className="flex items-center gap-1 truncate max-w-[130px] sm:max-w-[160px]">
                                                <MapPin size={10.5} className="text-gray-400 shrink-0" />
                                                <span className="truncate">{meeting.venue}</span>
                                            </span>
                                        )}

                                        <span className="flex items-center gap-1">
                                            <Users size={10.5} className="text-gray-400" />
                                            <span>{meeting.participants_count || 0}</span>
                                        </span>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={deleteModal.isOpen}
                title="Delete Meeting Record?"
                message={`Are you sure you want to delete "${deleteModal.meetingSubject}"? This will permanently delete both the Agenda and MoM records for this meeting.`}
                confirmText="Delete Meeting"
                cancelText="Cancel"
                variant="danger"
                onConfirm={handleConfirmDelete}
                onClose={() => setDeleteModal({ isOpen: false, meetingId: null, meetingSubject: '' })}
            />
        </div>
    );
};

export default MeetingList;
