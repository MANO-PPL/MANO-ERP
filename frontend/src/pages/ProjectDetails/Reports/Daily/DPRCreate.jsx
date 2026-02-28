import React, { useState } from 'react';
import {
    ArrowLeft,
    Sun,
    CloudRain,
    Cloud,
    Wind,
    Plus,
    Trash2,
    Clock,
    MapPin,
    Briefcase,
    History,
    Calendar,
    ChevronDown,
    Save,
    Send,
    CheckCircle,
    Activity,
    Users,
    Zap,
    PlusCircle,
    X,
    Download,
    MessageSquare,
    Eye
} from 'lucide-react';
import CustomInput from '../../../../components/CustomInput';
import CustomSelect from '../../../../components/CustomSelect';

const DPRCreate = ({ onBack, initialData = null, isReadOnly = false }) => {
    // State for all form fields - Initialize from initialData if editing/viewing
    const [projectData] = useState({
        projectName: initialData?.projectName || 'New Airport Terminal - Phase 1',
        employer: initialData?.employer || 'Airports Authority of India',
        contractNo: initialData?.contractNo || 'AAI/ENGG/2026/089',
        location: initialData?.location || 'Chennai, Tamil Nadu',
        startDate: initialData?.startDate || '2026-02-01',
        endDate: initialData?.endDate || '2027-01-31',
        description: initialData?.description || 'Construction of the new International terminal with glass facade and steel roof structure.',
        metrics: initialData?.metrics || {
            total: 365,
            passed: 27,
            balance: 338
        }
    });

    const [weather, setWeather] = useState(initialData?.weather || 'sunny');
    const [timeSlots, setTimeSlots] = useState(initialData?.timeSlots || [{ id: 1, from: '08:00', to: '11:00' }]);

    const [labourData, setLabourData] = useState(initialData?.labourData || [
        { id: 1, agency: '"U" Know Urban', mason: 2, carpenter: 4, plumber: 0, painter: 0, remarks: '' },
        { id: 2, agency: 'SW Design Studio', mason: 0, carpenter: 0, plumber: 3, painter: 1, remarks: '' },
        { id: 3, agency: 'T Apple', mason: 5, carpenter: 2, plumber: 0, painter: 0, remarks: '' },
    ]);

    const [todayProgress, setTodayProgress] = useState(initialData?.todayProgress || [
        { id: 1, item: 'Excavation for footings', remarks: 'Sector A completed', unit: 'Cum', qty: 45 },
    ]);

    const [tomorrowPlan, setTomorrowPlan] = useState(initialData?.tomorrowPlan || [
        { id: 1, item: 'PCC for footings', remarks: 'Ready for pouring', unit: 'Cum', qty: 15 },
    ]);

    const [events, setEvents] = useState(initialData?.events || []);
    const [generalRemarks, setGeneralRemarks] = useState(initialData?.generalRemarks || '');

    const addTimeSlot = () => {
        if (isReadOnly) return;
        setTimeSlots([...timeSlots, { id: Date.now(), from: '', to: '' }]);
    };
    const removeTimeSlot = (id) => {
        if (isReadOnly) return;
        setTimeSlots(timeSlots.filter(s => s.id !== id));
    };

    const addLabourRow = () => {
        if (isReadOnly) return;
        setLabourData([...labourData, { id: Date.now(), agency: '', mason: 0, carpenter: 0, plumber: 0, painter: 0, remarks: '' }]);
    };

    const addProgressItem = () => {
        if (isReadOnly) return;
        setTodayProgress([...todayProgress, { id: Date.now(), item: '', remarks: '', unit: '', qty: 0 }]);
    };
    const addPlanItem = () => {
        if (isReadOnly) return;
        setTomorrowPlan([...tomorrowPlan, { id: Date.now(), item: '', remarks: '', unit: '', qty: 0 }]);
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-[#0d1117] text-gray-700 dark:text-gray-300 anim-fade-in w-full">
            {/* Header Area */}
            <div className="sticky top-0 z-30 bg-white/80 dark:bg-[#161b22]/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Daily Progress Report</h2>
                        <div className="flex items-center space-x-2 mt-0.5 text-[10px] text-gray-500 font-medium uppercase tracking-widest">
                            <Calendar size={12} />
                            <span>Friday, 27 February 2026</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    {isReadOnly ? (
                        <>
                            <button className="px-5 py-2.5 bg-white/5 hover:bg-gray-200 dark:bg-white/10 text-gray-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center space-x-2">
                                <Download size={16} />
                                <span>Export PDF</span>
                            </button>
                            <button onClick={onBack} className="px-6 py-2.5 bg-gray-600 hover:bg-gray-700 text-gray-900 dark:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center space-x-2">
                                <X size={16} />
                                <span>Close</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <button className="px-5 py-2 hover:bg-white/5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-md text-xs font-semibold tracking-wide transition-all flex items-center space-x-2 border border-gray-300 dark:border-transparent">
                                <Save size={16} />
                                <span>Save Draft</span>
                            </button>
                            <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-bold tracking-wide transition-all shadow-lg shadow-blue-500/20 flex items-center space-x-2 active:scale-95">
                                <Send size={16} />
                                <span>Generate & Close</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                {/* Project Details Section */}
                <section className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-200 dark:border-white/5 p-8 relative overflow-hidden group">

                    <h3 className="text-[11px] font-bold text-blue-400 uppercase tracking-[0.2em] mb-8 flex items-center">
                        <Briefcase size={14} className="mr-3" />
                        Project Identity & Context
                    </h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-y-8 gap-x-12 relative z-10">
                        {/* Details Grid */}
                        <div className="space-y-6">
                            {[
                                { label: 'Project Name', value: projectData.projectName },
                                { label: 'Contract Number', value: projectData.contractNo },
                                { label: 'Commencement Date', value: projectData.startDate },
                                { label: 'Project Description', value: projectData.description, fullWidth: true },
                            ].map((item, idx) => (
                                <div key={idx} className={item.fullWidth ? "col-span-full" : ""}>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">{item.label}</p>
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-relaxed">{item.value}</p>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-6 lg:border-l border-white/5 lg:pl-12">
                            {[
                                { label: 'Client / Employer', value: projectData.employer },
                                { label: 'Site Location', value: projectData.location },
                                { label: 'Target Completion', value: projectData.endDate },
                            ].map((item, idx) => (
                                <div key={idx}>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">{item.label}</p>
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Performance Metrics Row */}
                    <div className="grid grid-cols-3 gap-6 mt-12 bg-gray-50 dark:bg-[#0d1117]/50 rounded-2xl p-6 border border-white/5">
                        {[
                            { label: 'Project Duration', value: projectData.metrics.total, sub: 'Total Days', color: 'text-gray-400' },
                            { label: 'Timeline Progress', value: projectData.metrics.passed, sub: 'Days Elapsed', color: 'text-blue-400' },
                            { label: 'Remaining Window', value: projectData.metrics.balance, sub: 'Days to Deadline', color: 'text-orange-400' },
                        ].map((metric, i) => (
                            <div key={i} className="text-center group/stat">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">{metric.label}</p>
                                <p className={`text-4xl font-bold ${metric.color} tracking-tighter transition-transform group-hover/stat:scale-110`}>{metric.value}</p>
                                <p className="text-[9px] font-medium text-gray-600 uppercase tracking-tighter mt-1">{metric.sub}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Environmental Section */}
                    <div className="lg:col-span-4 bg-white dark:bg-[#161b22] rounded-2xl border border-gray-200 dark:border-white/5 p-8 flex flex-col">
                        <h3 className="text-[11px] font-bold text-yellow-500 uppercase tracking-[0.2em] mb-8 flex items-center">
                            <Sun size={14} className="mr-3" />
                            Site Environment
                        </h3>

                        <div className="space-y-10 flex-1 flex flex-col justify-center">
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-6 text-center">Weather Condition</p>
                                <div className="flex justify-between items-center bg-gray-50 dark:bg-[#0d1117] p-2 rounded-xl border border-white/5 shadow-inner">
                                    {[
                                        { id: 'sunny', icon: Sun, color: 'text-yellow-500 bg-yellow-500/10' },
                                        { id: 'rainy', icon: CloudRain, color: 'text-blue-500 bg-blue-500/10' },
                                        { id: 'cloudy', icon: Cloud, color: 'text-gray-400 bg-gray-400/10' },
                                        { id: 'windy', icon: Wind, color: 'text-cyan-500 bg-cyan-500/10' },
                                    ].map((w) => (
                                        <button
                                            key={w.id}
                                            onClick={() => !isReadOnly && setWeather(w.id)}
                                            className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl transition-all ${weather === w.id ? `${w.color} shadow-lg scale-105 ring-1 ring-white/10` : 'text-gray-600 hover:text-gray-400'} ${isReadOnly ? 'cursor-default' : ''}`}
                                        >
                                            <w.icon size={24} strokeWidth={weather === w.id ? 2 : 1.5} />
                                            <span className="text-[8px] font-bold uppercase mt-2 tracking-widest">{w.id}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-center">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Active Time Slots</p>
                                    {!isReadOnly && (
                                        <button onClick={addTimeSlot} className="p-1.5 bg-blue-600/10 text-blue-500 rounded-lg hover:bg-blue-600 hover:text-gray-900 dark:text-white transition-all">
                                            <PlusCircle size={16} />
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    {timeSlots.map((slot) => (
                                        <div key={slot.id} className="flex items-center space-x-3 bg-gray-50 dark:bg-[#0d1117] p-3 rounded-xl border border-white/5 group">
                                            <Clock size={14} className="text-gray-600" />
                                            {isReadOnly ? (
                                                <div className="flex items-center space-x-2 text-xs font-medium text-gray-300">
                                                    <span>{slot.from}</span>
                                                    <span className="text-gray-600">—</span>
                                                    <span>{slot.to}</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <input type="time" className="bg-transparent border-none outline-none text-xs text-gray-300 w-full" defaultValue={slot.from} />
                                                    <span className="text-gray-600">—</span>
                                                    <input type="time" className="bg-transparent border-none outline-none text-xs text-gray-300 w-full" defaultValue={slot.to} />
                                                    <button
                                                        onClick={() => removeTimeSlot(slot.id)}
                                                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-red-500 transition-all"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Labor Tracking Section */}
                    <div className="lg:col-span-8 bg-white dark:bg-[#161b22] rounded-2xl border border-gray-200 dark:border-white/5 p-8 overflow-hidden">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-[11px] font-bold text-blue-400 uppercase tracking-[0.2em] flex items-center">
                                <Users size={14} className="mr-3" />
                                Workforce & Logistics
                            </h3>
                            {!isReadOnly && (
                                <button onClick={addLabourRow} className="text-xs font-bold text-blue-500 hover:text-blue-400 uppercase tracking-widest hover:underline flex items-center transition-colors">
                                    <Plus size={14} className="mr-1" />
                                    Add Agency
                                </button>
                            )}
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-[#0d1117] border-b border-white/5">
                                        <th className="px-5 py-4 text-[9px] font-bold text-gray-500 uppercase tracking-widest">Contractor Agency</th>
                                        <th className="px-5 py-4 text-[9px] font-bold text-gray-500 uppercase tracking-widest text-center">Mason</th>
                                        <th className="px-5 py-4 text-[9px] font-bold text-gray-500 uppercase tracking-widest text-center">Carpenter</th>
                                        <th className="px-5 py-4 text-[9px] font-bold text-gray-500 uppercase tracking-widest text-center">Plumber</th>
                                        <th className="px-5 py-4 text-[9px] font-bold text-gray-500 uppercase tracking-widest text-center">Painter</th>
                                        <th className="px-5 py-4 text-[9px] font-bold text-gray-500 uppercase tracking-widest text-center">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {labourData.map((row) => (
                                        <tr key={row.id} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-5 py-4">
                                                {isReadOnly ? (
                                                    <span className="text-xs font-medium text-gray-300">{row.agency}</span>
                                                ) : (
                                                    <input className="bg-transparent w-full text-xs font-medium text-gray-300 outline-none" placeholder="Agency Name..." defaultValue={row.agency} />
                                                )}
                                            </td>
                                            {['mason', 'carpenter', 'plumber', 'painter'].map(trade => (
                                                <td key={trade} className="px-5 py-4 text-center">
                                                    {isReadOnly ? (
                                                        <span className="text-xs text-gray-400">{row[trade]}</span>
                                                    ) : (
                                                        <input type="number" className="bg-gray-50 dark:bg-[#0d1117] w-14 p-1.5 rounded-lg text-xs text-center border border-white/5 outline-none focus:border-blue-500" defaultValue={row[trade]} />
                                                    )}
                                                </td>
                                            ))}
                                            <td className="px-5 py-4">
                                                {isReadOnly ? (
                                                    <span className="text-[10px] text-gray-500 italic">{row.remarks || '—'}</span>
                                                ) : (
                                                    <input className="bg-transparent w-full text-[10px] text-gray-500 outline-none italic" placeholder="Observations..." defaultValue={row.remarks} />
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Progress Tracking Modules */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Today's Progress */}
                    <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-200 dark:border-white/5 p-8 group/progress">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-[11px] font-bold text-green-400 uppercase tracking-[0.2em] flex items-center">
                                <Activity size={14} className="mr-3" />
                                Today's Project Progression
                            </h3>
                            {!isReadOnly && (
                                <button onClick={addProgressItem} className="p-2 bg-green-500/10 text-green-500 rounded-xl hover:bg-green-500 hover:text-gray-900 dark:text-white transition-all opacity-0 group-hover/progress:opacity-100">
                                    <Plus size={16} />
                                </button>
                            )}
                        </div>

                        <div className="space-y-4">
                            {todayProgress.length > 0 ? todayProgress.map((item) => (
                                <div key={item.id} className="bg-gray-50 dark:bg-[#0d1117] p-5 rounded-xl border border-white/5 hover:border-green-500/30 transition-all space-y-4 text-left">
                                    <div className="flex justify-between gap-4">
                                        {isReadOnly ? (
                                            <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{item.item}</span>
                                        ) : (
                                            <input className="bg-transparent flex-1 text-sm font-bold text-gray-800 dark:text-gray-200 outline-none" defaultValue={item.item} placeholder="Task title..." />
                                        )}
                                        <div className="flex items-center space-x-2">
                                            {isReadOnly ? (
                                                <span className="text-xs font-bold text-green-500">{item.qty} {item.unit}</span>
                                            ) : (
                                                <>
                                                    <input className="bg-gray-50 dark:bg-[#161b22] w-16 p-2 rounded-lg text-xs text-center outline-none" defaultValue={item.qty} placeholder="Qty" />
                                                    <input className="bg-gray-50 dark:bg-[#161b22] w-14 p-2 rounded-lg text-xs text-center outline-none" defaultValue={item.unit} placeholder="Unit" />
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {isReadOnly ? (
                                        <p className="text-xs text-gray-500 font-normal leading-relaxed">{item.remarks}</p>
                                    ) : (
                                        <textarea className="bg-transparent w-full text-xs text-gray-500 outline-none" rows={1} defaultValue={item.remarks} placeholder="Progress remarks..." />
                                    )}
                                </div>
                            )) : (
                                <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-2xl opacity-50">
                                    <Clock size={32} className="mb-4" />
                                    <p className="text-xs">No progress items added yet today.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tomorrow's Planning */}
                    <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-200 dark:border-white/5 p-8 group/plan">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-[11px] font-bold text-indigo-400 uppercase tracking-[0.2em] flex items-center">
                                <History size={14} className="mr-3" />
                                Strategic Planning (Next 24h)
                            </h3>
                            {!isReadOnly && (
                                <button onClick={addPlanItem} className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl hover:bg-indigo-500 hover:text-gray-900 dark:text-white transition-all opacity-0 group-hover/plan:opacity-100">
                                    <Plus size={16} />
                                </button>
                            )}
                        </div>

                        <div className="space-y-4">
                            {tomorrowPlan.length > 0 ? tomorrowPlan.map((item) => (
                                <div key={item.id} className="bg-gray-50 dark:bg-[#0d1117] p-5 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-all space-y-4 text-left">
                                    <div className="flex justify-between gap-4">
                                        {isReadOnly ? (
                                            <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{item.item}</span>
                                        ) : (
                                            <input className="bg-transparent flex-1 text-sm font-bold text-gray-800 dark:text-gray-200 outline-none" defaultValue={item.item} placeholder="Plan objective..." />
                                        )}
                                        <div className="flex items-center space-x-2">
                                            {isReadOnly ? (
                                                <span className="text-xs font-bold text-indigo-400">{item.qty} {item.unit}</span>
                                            ) : (
                                                <>
                                                    <input className="bg-gray-50 dark:bg-[#161b22] w-16 p-2 rounded-lg text-xs text-center outline-none" defaultValue={item.qty} placeholder="Qty" />
                                                    <input className="bg-gray-50 dark:bg-[#161b22] w-14 p-2 rounded-lg text-xs text-center outline-none" defaultValue={item.unit} placeholder="Unit" />
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {isReadOnly ? (
                                        <p className="text-xs text-gray-500 font-normal leading-relaxed">{item.remarks}</p>
                                    ) : (
                                        <textarea className="bg-transparent w-full text-xs text-gray-500 outline-none" rows={1} defaultValue={item.remarks} placeholder="Resource requirements..." />
                                    )}
                                </div>
                            )) : (
                                <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-2xl opacity-50">
                                    <Zap size={32} className="mb-4" />
                                    <p className="text-xs text-center">Define high-impact objectives for<br />tomorrow's work schedule.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Final Observations Section */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-12 p-8 space-y-8 bg-blue-600/5">
                        <div className="flex justify-between items-center text-left">
                            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] flex items-center">
                                <Activity size={14} className="mr-3" />
                                Project Director's Observations
                            </h3>
                        </div>

                        {isReadOnly ? (
                            <div className="p-6 bg-gray-100 dark:bg-[#0a0d11] rounded-xl border border-white/5">
                                <p className="text-xs text-gray-400 font-normal leading-relaxed italic">{generalRemarks || 'No additional remarks recorded for this period.'}</p>
                            </div>
                        ) : (
                            <textarea
                                className="w-full bg-gray-50 dark:bg-[#0d1117] rounded-2xl border border-white/5 p-6 text-sm text-gray-300 focus:border-blue-500/50 outline-none transition-all resize-none min-h-[120px] shadow-inner font-medium"
                                placeholder="Capture site observations, critical bottlenecks, or specialized instructions here..."
                                value={generalRemarks}
                                onChange={(e) => setGeneralRemarks(e.target.value)}
                            ></textarea>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10 p-2 text-left">
                            <div>
                                <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3">Prepared / Recorded By</p>
                                <div className="bg-gray-50 dark:bg-[#0d1117] p-4 rounded-xl border border-white/5 flex items-center mb-2">
                                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 mr-4">
                                        <Users size={18} />
                                    </div>
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">Mano Projects Pvt. Ltd.</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3">Verified / Distributed To</p>
                                <button className="w-full bg-gray-50 dark:bg-[#0d1117] p-4 rounded-xl border border-dashed border-white/20 text-gray-500 text-xs font-medium hover:border-blue-500/40 hover:text-blue-400 transition-all flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed" disabled={isReadOnly}>
                                    <PlusCircle size={18} className="mr-3 group-hover:scale-110 transition-transform" />
                                    {isReadOnly ? 'Verification Processed' : 'Assign Verification Recipient'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Submit Trigger - Extra Large */}
                {!isReadOnly && (
                    <div className="pt-8 pb-12 flex justify-center">
                        <button className="flex items-center px-16 py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-base font-semibold transition-all active:scale-95 border border-transparent">
                            <span className="relative flex items-center">
                                Finalize Daily Progress Report
                                <CheckCircle size={20} className="ml-4" />
                            </span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DPRCreate;
