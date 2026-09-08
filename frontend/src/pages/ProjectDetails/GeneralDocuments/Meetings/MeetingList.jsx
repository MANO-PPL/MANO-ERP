import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
    Calendar,
    Plus,
    Clock,
    MapPin,
    Users,
    ArrowLeft,
    Search,
    Trash2,
    FileText,
    ChevronRight,
    Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { generalDocsApi } from '../../../../services/generalDocsApi';
import ConfirmModal from '../../../../components/ConfirmModal';
import { toast } from 'react-toastify';

export const STATUS_CONFIG = {
    scheduled: {
        label: 'Scheduled',
        badge: 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50',
        dot: 'bg-blue-500'
    },
    completed: {
        label: 'Completed',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/50',
        dot: 'bg-emerald-500'
    },
    postponed: {
        label: 'Postponed',
        badge: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50',
        dot: 'bg-amber-500'
    },
    cancelled: {
        label: 'Cancelled',
        badge: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800/50',
        dot: 'bg-rose-500'
    }
};

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
                { label: 'Project Meetings' }
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
            meetingSubject: meeting.subject || `Meeting #${meeting.meeting_no}`
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
        <div className="flex-1 flex flex-col bg-[#fafafa] dark:bg-[#0d1117] font-sans text-gray-900 dark:text-gray-200 transition-colors overflow-hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-6 py-4 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#161b22] z-20">
                <div className="flex items-center space-x-3.5">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-1.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 rounded-lg transition-all active:scale-95 cursor-pointer"
                        title="Back to General Documents"
                    >
                        <ArrowLeft size={17} />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                            Project Meetings
                        </h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Manage schedules, invited participants, and discussion points.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    {canWrite && (
                        <button
                            onClick={() => onSelect('new')}
                            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-4 py-2 rounded-lg font-bold text-xs transition-all shadow-sm cursor-pointer"
                        >
                            <Plus size={15} />
                            <span>New Meeting</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="px-6 py-3 border-b border-gray-200/80 dark:border-white/5 bg-gray-50/50 dark:bg-[#161b22]/50 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Search Bar */}
                    <div className="relative w-64 md:w-72">
                        <Search
                            size={14}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                        />
                        <input
                            type="text"
                            placeholder="Search meetings by subject, venue, #..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-8.5 pr-3 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                        />
                    </div>

                    {/* Status Filter Tabs */}
                    <div className="flex items-center bg-gray-200/60 dark:bg-white/5 p-0.5 rounded-lg text-xs">
                        {[
                            { key: 'all', label: 'All', count: statusCounts.all },
                            { key: 'scheduled', label: 'Scheduled', count: statusCounts.scheduled },
                            { key: 'completed', label: 'Completed', count: statusCounts.completed },
                            { key: 'postponed', label: 'Postponed', count: statusCounts.postponed },
                            { key: 'cancelled', label: 'Cancelled', count: statusCounts.cancelled }
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setStatusFilter(tab.key)}
                                className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1.5 ${
                                    statusFilter === tab.key
                                        ? 'bg-white dark:bg-[#161b22] text-gray-900 dark:text-white shadow-xs'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                    statusFilter === tab.key
                                        ? 'bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-gray-200'
                                        : 'bg-gray-200/70 dark:bg-white/5 text-gray-400'
                                }`}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="text-xs font-bold text-gray-400">
                    Showing: <span className="text-gray-700 dark:text-gray-200">{filteredMeetings.length}</span>
                </div>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto p-6">
                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center space-y-3">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Loading project meetings...</p>
                    </div>
                ) : filteredMeetings.length === 0 ? (
                    <div className="h-72 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
                            <FileText size={24} />
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">No Meetings Found</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-1 mb-4">
                            {searchQuery
                                ? 'No meetings match your active search.'
                                : 'There are no meetings scheduled for this project yet.'}
                        </p>
                        {canWrite && !searchQuery && (
                            <button
                                onClick={() => onSelect('new')}
                                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-sm cursor-pointer"
                            >
                                <Plus size={14} />
                                <span>Create Meeting</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3 max-w-5xl mx-auto">
                        {filteredMeetings.map((meeting, i) => {
                            const dateStr = meeting.date ? new Date(meeting.date).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                            }) : 'Date not set';
                            const statusCfg = STATUS_CONFIG[meeting.status] || STATUS_CONFIG.scheduled;

                            return (
                                <motion.div
                                    key={meeting.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2, delay: i * 0.03 }}
                                    onClick={() => onSelect(meeting.id)}
                                    className="group relative bg-white dark:bg-[#161b22] border border-gray-200/80 dark:border-white/10 hover:border-blue-500/40 dark:hover:border-blue-500/40 rounded-xl p-4.5 shadow-2xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-4"
                                >
                                    {/* Left Details */}
                                    <div className="flex items-start gap-4 flex-1 min-w-0">
                                        {/* Meeting Number Badge */}
                                        <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-black text-sm flex items-center justify-center border border-blue-200/60 dark:border-blue-800/40 shrink-0">
                                            #{meeting.meeting_no || i + 1}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2.5 flex-wrap">
                                                <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                    {meeting.subject || 'Untitled Meeting'}
                                                </h3>
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${statusCfg.badge}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`}></span>
                                                    {statusCfg.label}
                                                </span>
                                            </div>

                                            {/* Metadata chips */}
                                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                                                <span className="flex items-center gap-1">
                                                    <Calendar size={13} className="text-gray-400" />
                                                    <span>{dateStr}</span>
                                                </span>

                                                {meeting.time && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={13} className="text-gray-400" />
                                                        <span>{meeting.time}</span>
                                                    </span>
                                                )}

                                                {meeting.venue && (
                                                    <span className="flex items-center gap-1 truncate max-w-[200px]">
                                                        <MapPin size={13} className="text-gray-400 shrink-0" />
                                                        <span className="truncate">{meeting.venue}</span>
                                                    </span>
                                                )}

                                                <span className="flex items-center gap-1">
                                                    <Users size={13} className="text-gray-400" />
                                                    <span>{meeting.participants_count || 0} Attendees</span>
                                                </span>

                                                <span className="flex items-center gap-1">
                                                    <FileText size={13} className="text-gray-400" />
                                                    <span>{meeting.agenda_count || 0} Agenda • {meeting.mom_count || 0} MoM</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        {canWrite && (
                                            <button
                                                onClick={(e) => handleDeleteClick(e, meeting)}
                                                className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                                                title="Delete Meeting"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        )}
                                        <ChevronRight size={18} className="text-gray-400 group-hover:translate-x-0.5 transition-transform" />
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
                title="Delete Meeting?"
                message={`Are you sure you want to delete "${deleteModal.meetingSubject}"? This will permanently delete this meeting record.`}
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
