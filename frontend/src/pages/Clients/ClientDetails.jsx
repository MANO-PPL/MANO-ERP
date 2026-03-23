import React, { useState } from 'react';
import { X, Copy, Plus, Calendar, MessageSquare, Phone, Mail, MapPin, Users, Send, Clock } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';

const ClientDetails = ({ isOpen, onClose, client, onUpdate }) => {
    const [isLogging, setIsLogging] = useState(false);
    const [interactionForm, setInteractionForm] = useState({
        type: 'Call',
        interaction_date: new Date().toISOString().split('T')[0],
        follow_up_date: '',
        remarks: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedTypeView, setSelectedTypeView] = useState('Call');
    
    React.useEffect(() => {
        if (client?.interactions?.[0]?.type) {
            setSelectedTypeView(client.interactions[0].type);
        }
    }, [client]);

    if (!isOpen || !client) return null;

    const filteredHistory = client.interactions?.filter(i => i.type?.toLowerCase() === selectedTypeView?.toLowerCase());

    const handleInteractionSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const response = await api.post(`/clients/${client.id}/interactions`, interactionForm);
            if (response.data.success) {
                toast.success('Interaction logged!');
                setIsLogging(false);
                setInteractionForm({
                    type: 'Call',
                    interaction_date: new Date().toISOString().split('T')[0],
                    follow_up_date: '',
                    remarks: ''
                });
                if (onUpdate) onUpdate();
            }
        } catch (error) {
            console.error('Error logging interaction:', error);
            toast.error('Failed to log interaction');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopy = () => {
        const detailsText = `
Company: ${client.name}
Category: ${client.category}
Contact Person: ${client.contact_person}
Designation: ${client.designation || '-'}
Nature of Job: ${client.job_name}
Contact No: ${client.contact_no}
Email: ${client.email}
Location: ${client.location || '-'}
Website: ${client.website || 'NA'}
Address: ${client.address}
Reference: ${client.reference || '-'}
        `.trim();
        navigator.clipboard.writeText(detailsText);
        toast.info('Details copied to clipboard');
    };

    return (
        <div className="fixed inset-0 z-[5000] flex justify-end p-0 sm:p-0 anim-fade-in text-left">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="relative w-full max-w-2xl bg-white dark:bg-[#0d1117] shadow-2xl border-l border-gray-200 dark:border-white/10 overflow-hidden flex flex-col h-full anim-slide-left">

                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 dark:border-white/5 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{client.name}</h2>
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-500 uppercase tracking-wider">{client.category || 'CLIENT'}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Sector</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-200">{client.sector_name || '-'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Responsibility</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-200">{client.responsibility || '-'}</p>
                        </div>

                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Nature of Job</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-200">{client.job_name || '-'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Contact No</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-200">{client.contact_no || '-'}</p>
                        </div>

                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Email</p>
                            <a href={`mailto:${client.email}`} className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">{client.email || '-'}</a>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Location</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-200">{client.location || '-'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Website</p>
                            {client.website && client.website !== 'NA' ? (
                                <a href={client.website.startsWith('http') ? client.website : `https://${client.website}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                                    {client.website}
                                </a>
                            ) : (
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-200">NA</p>
                            )}
                        </div>
                    </div>


                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-2">Address</p>
                        <div className="p-3 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-lg text-sm text-gray-800 dark:text-gray-300">
                            {client.address || '-'}
                        </div>
                    </div>

                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-2">Remarks / Notes</p>
                        <div className="p-3 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-lg text-sm text-gray-800 dark:text-gray-300">
                            {client.remarks || '-'}
                        </div>
                    </div>

                    {/* Interaction History & Logger */}
                    <div className="pt-6 border-t border-gray-100 dark:border-white/5">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-3">
                                <h3 className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Interactions</h3>
                                <select 
                                    className="bg-transparent border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 outline-none focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer"
                                    value={selectedTypeView}
                                    onChange={(e) => setSelectedTypeView(e.target.value)}
                                >
                                    <option value="Call">CALL</option>
                                    <option value="WhatsApp">WHATSAPP</option>
                                    <option value="Email">EMAIL</option>
                                    <option value="Site Visit">SITE VISIT</option>
                                    <option value="Meeting">MEETING</option>
                                </select>
                            </div>
                            <button 
                                onClick={() => setIsLogging(!isLogging)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isLogging ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20'}`}
                            >
                                {isLogging ? <X size={14} /> : <Plus size={14} />}
                                <span>{isLogging ? 'Cancel' : 'Log Interaction'}</span>
                            </button>
                        </div>

                        {isLogging && (
                            <form onSubmit={handleInteractionSubmit} className="mb-6 p-4 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl space-y-4 anim-fade-in">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Type</label>
                                        <select 
                                            className="w-full bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            value={interactionForm.type}
                                            onChange={(e) => setInteractionForm({...interactionForm, type: e.target.value})}
                                        >
                                            <option value="Call">Call</option>
                                            <option value="WhatsApp">WhatsApp</option>
                                            <option value="Email">Email</option>
                                            <option value="Site Visit">Site Visit</option>
                                            <option value="Meeting">Meeting</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Date</label>
                                        <input 
                                            type="date"
                                            className="w-full bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            value={interactionForm.interaction_date}
                                            onChange={(e) => setInteractionForm({...interactionForm, interaction_date: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Follow-up Date</label>
                                        <input 
                                            type="date"
                                            className="w-full bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            value={interactionForm.follow_up_date}
                                            onChange={(e) => setInteractionForm({...interactionForm, follow_up_date: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Remarks</label>
                                    <textarea 
                                        className="w-full bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none h-20"
                                        placeholder="Enter details about the interaction..."
                                        value={interactionForm.remarks}
                                        onChange={(e) => setInteractionForm({...interactionForm, remarks: e.target.value})}
                                    ></textarea>
                                </div>
                                <button 
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70"
                                >
                                    {isSubmitting ? 'Logging...' : <><Send size={16} /> Save Interaction</>}
                                </button>
                            </form>
                        )}

                        <div className="space-y-4">
                            <Separator label={`${selectedTypeView} History`} />

                            {filteredHistory && filteredHistory.length > 0 ? (
                                <div className="space-y-4 pb-4">
                                    {filteredHistory.map((interaction, i) => (
                                        <div key={i} className="group p-4 bg-gray-50/50 dark:bg-white/[0.01] border border-gray-100 dark:border-white/5 rounded-2xl hover:border-blue-100 dark:hover:border-blue-500/20 transition-all anim-fade-in shadow-sm hover:shadow-blue-500/5">
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="p-1.5 bg-blue-600 rounded-lg text-white shadow-sm">
                                                    {interaction.type?.toLowerCase() === 'call' && <Phone size={12} />}
                                                    {interaction.type?.toLowerCase() === 'whatsapp' && <MessageSquare size={12} />}
                                                    {interaction.type?.toLowerCase() === 'email' && <Mail size={12} />}
                                                    {interaction.type?.toLowerCase() === 'site visit' && <MapPin size={12} />}
                                                    {interaction.type?.toLowerCase() === 'meeting' && <Users size={12} />}
                                                </div>
                                                <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">{interaction.type}</span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-3 mb-4">
                                                <div className="p-2.5 bg-white dark:bg-[#0d1117]/50 border border-gray-100 dark:border-white/10 rounded-xl text-center">
                                                    <p className="text-[9px] uppercase tracking-widest text-gray-400 font-black mb-1">Interaction</p>
                                                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{new Date(interaction.interaction_date).toLocaleDateString()}</p>
                                                </div>
                                                <div className="p-2.5 bg-blue-50/50 dark:bg-blue-500/5 border border-blue-100/50 dark:border-blue-500/10 rounded-xl text-center">
                                                    <p className="text-[9px] uppercase tracking-widest text-blue-500/60 font-black mb-1">Follow up</p>
                                                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400">{interaction.follow_up_date ? new Date(interaction.follow_up_date).toLocaleDateString() : '-'}</p>
                                                </div>
                                                <div className="p-2.5 bg-white dark:bg-[#0d1117]/50 border border-gray-100 dark:border-white/10 rounded-xl text-center">
                                                    <p className="text-[9px] uppercase tracking-widest text-gray-400 font-black mb-1">By</p>
                                                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{interaction.interacted_by_name || 'System'}</p>
                                                </div>
                                            </div>
                                            <div className="p-3 bg-white dark:bg-[#0d1117]/50 border border-gray-100 dark:border-white/10 rounded-xl">
                                                <p className="text-[9px] uppercase tracking-widest text-gray-400 font-black mb-1.5">Remarks</p>
                                                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                                                    {interaction.remarks || 'No remarks recorded.'}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 border-2 border-dashed border-gray-100 dark:border-white/5 rounded-3xl">
                                    <p className="text-sm text-gray-400 font-medium italic">No {selectedTypeView} sessions recorded yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-white/5 flex justify-between items-center">
                    <p className="text-[10px] text-gray-400 font-medium italic">Showing all history for {client.name}</p>
                    <button
                        onClick={handleCopy}
                        className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Copy size={16} />
                        <span>Copy Details</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

const Separator = ({ label }) => (
    <div className="relative flex items-center py-4">
        <div className="flex-grow border-t border-gray-100 dark:border-white/5"></div>
        <span className="flex-shrink mx-4 text-[9px] font-black text-gray-300 dark:text-gray-600 uppercase tracking-[0.2em]">{label}</span>
        <div className="flex-grow border-t border-gray-100 dark:border-white/5"></div>
    </div>
);

export default ClientDetails;
