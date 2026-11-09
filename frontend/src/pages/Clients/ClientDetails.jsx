import React, { useState, useEffect, useMemo } from 'react';
import { X, Copy, Plus, Phone, Mail, Globe, Send, Clock, Check, Edit3, User } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import CustomDatePicker from '../../components/CustomDatePicker';
import CustomSelect from '../../components/CustomSelect';

const INTERACTION_TYPES = ['All', 'Call', 'WhatsApp', 'Email', 'Site Visit', 'Meeting'];
const typeOptions = INTERACTION_TYPES.slice(1).map(t => ({ label: t, value: t }));

const ClientDetails = ({ isOpen, onClose, client, onUpdate, onEdit }) => {
    const [copiedAll, setCopiedAll] = useState(false);
    const [copiedField, setCopiedField] = useState(null);
    const [isLogging, setIsLogging] = useState(false);
    const [activeTab, setActiveTab] = useState('All');
    const [localInteractions, setLocalInteractions] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expandedId, setExpandedId] = useState(null);
    const [form, setForm] = useState({
        type: 'Call',
        interaction_date: new Date().toISOString().split('T')[0],
        follow_up_date: '',
        remarks: ''
    });

    useEffect(() => {
        setLocalInteractions(client?.interactions || []);
    }, [client]);

    const filteredHistory = useMemo(() => {
        if (activeTab === 'All') return localInteractions;
        return localInteractions.filter(i => i.type?.toLowerCase() === activeTab.toLowerCase());
    }, [localInteractions, activeTab]);

    const typeCounts = useMemo(() => {
        const counts = { All: localInteractions.length };
        INTERACTION_TYPES.slice(1).forEach(type => {
            counts[type] = localInteractions.filter(i => i.type?.toLowerCase() === type.toLowerCase()).length;
        });
        return counts;
    }, [localInteractions]);

    if (!isOpen || !client) return null;

    const handleCopy = (text, label) => {
        if (!text || text === '-' || text === 'NA') return;
        navigator.clipboard.writeText(text);
        setCopiedField(label);
        setTimeout(() => setCopiedField(null), 2000);
        toast.info(`${label} copied!`);
    };

    const handleCopyAll = () => {
        const lines = [
            `Client: ${client.name || ''}`,
            client.category && `Category: ${client.category}`,
            (client.sector_name || client.sector) && `Sector: ${client.sector_name || client.sector}`,
            client.responsibility && `Responsibility: ${client.responsibility}`,
            (client.job_name || client.job_nature) && `Job: ${client.job_name || client.job_nature}`,
            client.location && `Location: ${client.location}`,
            client.contact_person && `Contact: ${client.contact_person}${client.designation ? ` (${client.designation})` : ''}`,
            client.contact_no && `Phone: ${client.contact_no}`,
            client.email && `Email: ${client.email}`,
            client.website && `Website: ${client.website}`,
            client.address && `Address: ${client.address}`,
            client.remarks && `Remarks: ${client.remarks}`
        ].filter(Boolean).join('\n');

        navigator.clipboard.writeText(lines);
        setCopiedAll(true);
        setTimeout(() => setCopiedAll(false), 2000);
        toast.info('Client details copied!');
    };

    const handleInteractionSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await api.post(`/clients/${client.id}/interactions`, form);
            if (res.data.success) {
                toast.success('Interaction logged!');
                setLocalInteractions(prev => [{ ...form, id: res.data.id, interacted_by_name: 'You' }, ...prev]);
                setIsLogging(false);
                setForm({ type: 'Call', interaction_date: new Date().toISOString().split('T')[0], follow_up_date: '', remarks: '' });
                if (onUpdate) onUpdate();
            }
        } catch (error) {
            console.error('Error logging interaction:', error);
            toast.error('Failed to log interaction');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getFollowUpStatus = (dateStr) => {
        if (!dateStr) return null;
        const target = new Date(dateStr);
        if (isNaN(target.getTime())) return null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetDate = new Date(target);
        targetDate.setHours(0, 0, 0, 0);

        const diffDays = Math.round((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return {
                type: 'passed',
                color: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200/60 dark:border-rose-500/20',
                label: 'Passed'
            };
        }
        if (diffDays <= 3) {
            return {
                type: 'urgent',
                color: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200/60 dark:border-amber-500/20',
                label: diffDays === 0 ? 'Today' : `${diffDays}d left`
            };
        }
        return {
            type: 'upcoming',
            color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-500/20',
            label: 'Upcoming'
        };
    };

    const companyFields = [
        { label: 'Sector', value: client.sector_name || client.sector },
        { label: 'Responsibility', value: client.responsibility },
        { label: 'Nature of Job', value: client.job_name || client.job_nature },
        { label: 'Location', value: client.location }
    ];

    const contactItems = [
        {
            label: 'Contact Person',
            value: client.contact_person,
            displayValue: client.contact_person,
            subText: client.designation,
            Icon: User
        },
        {
            label: 'Phone',
            value: client.contact_no,
            displayValue: client.contact_no,
            href: `tel:${client.contact_no}`,
            Icon: Phone
        },
        {
            label: 'Email',
            value: client.email,
            displayValue: client.email,
            href: `mailto:${client.email}`,
            Icon: Mail
        },
        {
            label: 'Website',
            value: client.website,
            displayValue: client.website,
            href: client.website?.startsWith('http') ? client.website : `https://${client.website}`,
            Icon: Globe,
            target: '_blank'
        }
    ];

    return (
        <div className="fixed inset-0 z-[5000] flex justify-end anim-fade-in text-left">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs cursor-pointer" onClick={onClose} />

            <div className="relative w-full max-w-xl bg-white dark:bg-[#0d1117] shadow-2xl border-l border-gray-200/80 dark:border-white/10 flex flex-col h-full anim-slide-left z-10">
                {/* 1. Header */}
                <div className="px-5 py-3 border-b border-gray-200/80 dark:border-white/10 flex items-center justify-between shrink-0">
                    <div className="min-w-0 pr-3">
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded">
                            {client.category || 'CLIENT'}
                        </span>
                        <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate mt-1">
                            {client.name}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-5">
                    {/* 2. Company Information */}
                    <div>
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2.5">
                            Company Information
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            {companyFields.map(({ label, value }) => (
                                <div key={label}>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">{label}</p>
                                    <p className="text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-200 break-words">{value || 'Not specified'}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 3. Contact Information (2x2 Grid) */}
                    <div>
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2.5">
                            Contact Information
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {contactItems.map(({ label, value, displayValue, subText, href, Icon, target }) => {
                                const isValid = Boolean(value && value !== '-' && value !== 'NA');
                                return (
                                    <div
                                        key={label}
                                        className="p-2.5 rounded-lg bg-gray-50/70 dark:bg-white/[0.02] border border-gray-100/80 dark:border-white/5 flex flex-col justify-between min-h-[58px]"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-1.5 text-gray-400">
                                                <Icon size={12} className="text-blue-500 shrink-0" />
                                                <span className="text-[10px] font-semibold uppercase tracking-wider">
                                                    {label}
                                                </span>
                                            </div>
                                            {isValid && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(value, label)}
                                                    title={`Copy ${label}`}
                                                    className="p-1 -mr-1 -mt-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer rounded transition"
                                                >
                                                    {copiedField === label ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                                </button>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            {isValid ? (
                                                href ? (
                                                    <a
                                                        href={href}
                                                        target={target}
                                                        rel="noopener noreferrer"
                                                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline truncate block"
                                                        title={displayValue}
                                                    >
                                                        {displayValue}
                                                    </a>
                                                ) : (
                                                    <span className="text-xs font-semibold text-gray-900 dark:text-white truncate block" title={displayValue}>
                                                        {displayValue}
                                                        {subText && (
                                                            <span className="text-[11px] font-normal text-gray-500 dark:text-gray-400 ml-1">
                                                                • {subText}
                                                            </span>
                                                        )}
                                                    </span>
                                                )
                                            ) : (
                                                <span className="text-xs text-gray-400">Not specified</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 4. Address & Notes */}
                    <div>
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2.5">
                            Address & Notes
                        </h3>
                        <div className="space-y-2.5">
                            <div>
                                <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Address</span>
                                    {client.address && (
                                        <button onClick={() => handleCopy(client.address, 'Address')} className="text-[10px] text-gray-400 hover:text-blue-600 flex items-center gap-1 cursor-pointer">
                                            {copiedField === 'Address' ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                            <span>{copiedField === 'Address' ? 'Copied' : 'Copy'}</span>
                                        </button>
                                    )}
                                </div>
                                <div className="p-2.5 bg-gray-50/70 dark:bg-white/[0.02] rounded-lg text-xs sm:text-sm text-gray-800 dark:text-gray-300">
                                    {client.address || 'No address provided.'}
                                </div>
                            </div>
                            <div>
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-0.5">Remarks / Notes</span>
                                <div className="p-2.5 bg-gray-50/70 dark:bg-white/[0.02] rounded-lg text-xs sm:text-sm text-gray-800 dark:text-gray-300">
                                    {client.remarks || 'No remarks recorded.'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 5. Interactions & History */}
                    <div>
                        <div className="flex items-center justify-between mb-2.5">
                            <div className="flex items-center gap-2">
                                <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    Interactions & History
                                </h3>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300">
                                    {localInteractions.length}
                                </span>
                            </div>
                            <button
                                onClick={() => setIsLogging(!isLogging)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition ${
                                    isLogging ? 'bg-red-50 text-red-600 dark:bg-red-500/10' : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 hover:bg-blue-100'
                                }`}
                            >
                                {isLogging ? <X size={12} /> : <Plus size={12} />}
                                <span>{isLogging ? 'Cancel' : 'Log'}</span>
                            </button>
                        </div>

                        {/* Inline Form */}
                        {isLogging && (
                            <form onSubmit={handleInteractionSubmit} className="mb-3 p-3 bg-gray-50 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/10 rounded-lg space-y-2.5 anim-fade-in">
                                <div className="grid grid-cols-2 gap-2.5">
                                    <CustomSelect label="TYPE" options={typeOptions} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} />
                                    <CustomDatePicker label="DATE" value={form.interaction_date} onChange={e => setForm({ ...form, interaction_date: e.target.value })} />
                                </div>
                                <CustomDatePicker label="FOLLOW UP DATE" value={form.follow_up_date} onChange={e => setForm({ ...form, follow_up_date: e.target.value })} />
                                <textarea
                                    className="w-full bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-md p-2 text-xs text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 outline-none resize-none h-16"
                                    placeholder="Enter remarks..."
                                    value={form.remarks}
                                    onChange={e => setForm({ ...form, remarks: e.target.value })}
                                />
                                <div className="flex justify-end gap-2">
                                    <button type="button" onClick={() => setIsLogging(false)} className="px-2.5 py-1 text-xs text-gray-500 cursor-pointer">Cancel</button>
                                    <button type="submit" disabled={isSubmitting} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold disabled:opacity-50 cursor-pointer">
                                        {isSubmitting ? 'Saving...' : 'Save'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Tabs */}
                        <div className="flex gap-1 overflow-x-auto pb-1 mb-2.5 custom-scrollbar">
                            {INTERACTION_TYPES.map(type => (
                                <button
                                    key={type}
                                    onClick={() => setActiveTab(type)}
                                    className={`px-2 py-1 rounded text-xs font-medium shrink-0 cursor-pointer transition ${
                                        activeTab === type
                                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 font-semibold'
                                            : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                                    }`}
                                >
                                    {type} {typeCounts[type] ? `(${typeCounts[type]})` : ''}
                                </button>
                            ))}
                        </div>

                        {/* History Table */}
                        {filteredHistory.length > 0 ? (
                            <div className="overflow-x-auto -mx-1 px-1 custom-scrollbar">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-gray-200/80 dark:border-white/10 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                            <th className="py-2 pr-2.5 font-semibold whitespace-nowrap">Type</th>
                                            <th className="py-2 px-2 font-semibold whitespace-nowrap">Date</th>
                                            <th className="py-2 px-2 font-semibold min-w-[130px]">Description</th>
                                            <th className="py-2 px-2 font-semibold whitespace-nowrap">Follow-up</th>
                                            <th className="py-2 pl-2 font-semibold whitespace-nowrap">By</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                        {filteredHistory.map((item, i) => {
                                            const rowKey = item.id || i;
                                            const isExpanded = expandedId === rowKey;
                                            const followUp = getFollowUpStatus(item.follow_up_date);
                                            return (
                                                <React.Fragment key={rowKey}>
                                                    <tr
                                                        onClick={() => item.remarks && setExpandedId(isExpanded ? null : rowKey)}
                                                        className={`hover:bg-gray-50/70 dark:hover:bg-white/[0.02] transition-colors ${item.remarks ? 'cursor-pointer' : ''}`}
                                                        title={item.remarks ? (isExpanded ? 'Click to collapse' : 'Click to view full description') : ''}
                                                    >
                                                        <td className="py-2.5 pr-2.5 whitespace-nowrap">
                                                            <span className="font-semibold text-gray-900 dark:text-gray-100 text-xs">
                                                                {item.type}
                                                            </span>
                                                        </td>
                                                        <td className="py-2.5 px-2 whitespace-nowrap text-gray-500 dark:text-gray-400 text-xs">
                                                            {item.interaction_date ? new Date(item.interaction_date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) : ''}
                                                        </td>
                                                        <td className="py-2.5 px-2 text-gray-700 dark:text-gray-300 text-xs max-w-[160px] truncate" title={item.remarks}>
                                                            {item.remarks || <span className="text-gray-400 italic">No description</span>}
                                                        </td>
                                                        <td className="py-2.5 px-2 whitespace-nowrap">
                                                            {followUp ? (
                                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${followUp.color}`} title={followUp.label}>
                                                                    <Clock size={10} className="shrink-0" />
                                                                    {new Date(item.follow_up_date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                                                            )}
                                                        </td>
                                                        <td className="py-2.5 pl-2 whitespace-nowrap text-gray-500 dark:text-gray-400 text-xs truncate max-w-[90px]" title={item.interacted_by_name || 'System'}>
                                                            {item.interacted_by_name || 'System'}
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr className="bg-blue-50/25 dark:bg-blue-500/[0.03]">
                                                            <td colSpan={5} className="py-2.5 px-3 text-xs border-b border-gray-100 dark:border-white/5">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="space-y-1 min-w-0 flex-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Full Description / Remarks</span>
                                                                            {item.follow_up_date && (
                                                                                <span className={`text-[10px] font-semibold ${
                                                                                    followUp?.type === 'passed' ? 'text-rose-600 dark:text-rose-400' :
                                                                                    followUp?.type === 'urgent' ? 'text-amber-600 dark:text-amber-400' :
                                                                                    'text-emerald-600 dark:text-emerald-400'
                                                                                }`}>
                                                                                    • Follow-up: {new Date(item.follow_up_date).toLocaleDateString()} ({followUp?.label})
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                                                                            {item.remarks}
                                                                        </p>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setExpandedId(null);
                                                                        }}
                                                                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-0.5"
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 py-3 text-center italic">No interactions recorded.</p>
                        )}
                    </div>
                </div>

                {/* 6. Footer */}
                <div className="px-5 py-3 border-t border-gray-200/80 dark:border-white/10 flex items-center justify-end gap-2 shrink-0">
                    <button
                        onClick={handleCopyAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                        {copiedAll ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                        <span>{copiedAll ? 'Copied' : 'Copy Details'}</span>
                    </button>
                    <button
                        onClick={() => onEdit?.(client)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition active:scale-[0.98] cursor-pointer"
                    >
                        <Edit3 size={13} />
                        <span>Edit Client</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ClientDetails;
