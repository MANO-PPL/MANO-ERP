import React, { useState } from 'react';
import { Filter, X, Calendar, CheckCircle, Clock, Award, Briefcase, Zap, Flag, AlignLeft } from 'lucide-react';

const TeamContribution = () => {
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    const employees = [
        {
            id: 1,
            name: 'Nice Bike',
            role: 'Full Stack Developer',
            initials: 'NB',
            color: 'from-blue-500 to-indigo-600',
            tasks: 3,
            completed: 1,
            efficiency: 94,
            contribution: 'High',
            history: [
                { id: 'TASK-1', name: 'Design System Implementation', date: '2026-02-27', status: 'Completed', impact: 'Core' },
                { id: 'TASK-5', name: 'Auth Module Debugging', date: '2026-02-25', status: 'Completed', impact: 'High' },
                { id: 'TASK-9', name: 'S3 Integration Service', date: '2026-02-20', status: 'Completed', impact: 'Critical' },
            ]
        },
        {
            id: 2,
            name: 'Mano Bharathii',
            role: 'Project Manager',
            initials: 'MB',
            color: 'from-purple-500 to-pink-600',
            tasks: 2,
            completed: 1,
            efficiency: 88,
            contribution: 'Critical',
            history: [
                { id: 'PM-402', name: 'Resource Allocation Q1', date: '2026-02-26', status: 'Completed', impact: 'Critical' },
                { id: 'PM-390', name: 'Client Stakeholder Meeting', date: '2026-02-22', status: 'Completed', impact: 'High' },
            ]
        },
        {
            id: 3,
            name: 'John Doe',
            role: 'Frontend Engineer',
            initials: 'JD',
            color: 'from-emerald-500 to-teal-600',
            tasks: 4,
            completed: 0,
            efficiency: 76,
            contribution: 'Medium',
            history: [
                { id: 'FE-112', name: 'Main Dashboard UI', date: '2026-02-24', status: 'In Progress', impact: 'High' },
                { id: 'FE-105', name: 'Reports Filtering Logic', date: '2026-02-18', status: 'Completed', impact: 'Medium' },
            ]
        },
        {
            id: 4,
            name: 'Jane Smith',
            role: 'UI/UX Designer',
            initials: 'JS',
            color: 'from-orange-500 to-red-600',
            tasks: 1,
            completed: 0,
            efficiency: 92,
            contribution: 'High',
            history: [
                { id: 'DS-201', name: 'Premium Icon Set Design', date: '2026-02-23', status: 'Completed', impact: 'High' },
            ]
        },
    ];

    return (
        <div className="space-y-4 anim-fade-in text-left w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {employees.map(emp => (
                    <div key={emp.id} className="p-8 bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-white/5 hover:border-blue-500/30 transition-all group shadow-sm hover:shadow-md">
                        <div className="flex items-center mb-8">
                            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${emp.color} flex items-center justify-center text-white text-base font-medium shadow-lg shadow-blue-500/20`}>
                                {emp.initials || emp.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div className="ml-5 overflow-hidden">
                                <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">{emp.name}</h4>
                                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-medium truncate mt-1">{emp.role}</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between text-[10px] font-medium text-gray-400 uppercase tracking-widest mb-2.5">
                                    <span>Contribution level</span>
                                    <span className="text-blue-500">{emp.contribution}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-gray-50/50 dark:bg-white/[0.02] rounded-2xl border border-gray-100 dark:border-white/5 text-left">
                                    <p className="text-[9px] font-medium text-gray-400 uppercase tracking-widest mb-1">WIP Tasks</p>
                                    <p className="text-xl font-medium text-gray-900 dark:text-white">{emp.tasks}</p>
                                </div>
                                <div className="p-4 bg-gray-50/50 dark:bg-white/[0.02] rounded-2xl border border-gray-100 dark:border-white/5 text-left">
                                    <p className="text-[9px] font-medium text-gray-400 uppercase tracking-widest mb-1">Efficiency</p>
                                    <p className="text-xl font-medium text-green-500">{emp.efficiency}%</p>
                                </div>
                            </div>

                            <button
                                onClick={() => setSelectedEmployee(emp)}
                                className="w-full py-3.5 text-[10px] font-medium uppercase tracking-widest text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/50 rounded-2xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all active:scale-95"
                            >
                                View Full History
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Premium History Drawer */}
            {selectedEmployee && (
                <div className="fixed inset-0 z-[100] flex justify-end overflow-hidden anim-fade-in group/drawer">
                    <div
                        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity duration-500 ease-in-out"
                        onClick={() => setSelectedEmployee(null)}
                    ></div>

                    <div className="relative w-full max-w-xl bg-white/95 dark:bg-[#0d1117]/95 backdrop-blur-2xl shadow-[-20px_0_50px_-20px_rgba(0,0,0,0.3)] transform transition-transform duration-500 ease-out translate-x-0 border-l border-white/20 dark:border-white/5 flex flex-col h-full">

                        {/* Premium Header with Dynamic Gradient */}
                        <div className={`relative h-48 flex flex-col justify-end p-8 overflow-hidden`}>
                            {/* Abstract Background Elements */}
                            <div className="absolute inset-0 opacity-20 dark:opacity-30 mix-blend-overlay pointer-events-none">
                                <div className={`absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl bg-blue-500`}></div>
                                <div className={`absolute -bottom-24 -left-24 w-64 h-64 rounded-full blur-3xl bg-purple-500`}></div>
                            </div>

                            <div className={`absolute inset-0 bg-gradient-to-br ${selectedEmployee.color} opacity-90`}></div>

                            <button
                                onClick={() => setSelectedEmployee(null)}
                                className="absolute top-6 right-6 p-2.5 bg-gray-200 dark:bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-md z-10 hover:rotate-90"
                            >
                                <X size={20} />
                            </button>

                            <div className="relative z-10 text-white">
                                <div className="flex items-center space-x-2 mb-3">
                                    <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-mono font-bold tracking-[0.2em] uppercase ring-1 ring-white/30 shadow-lg">
                                        EMP-ID: {selectedEmployee.id}
                                    </span>
                                    <span className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-lg bg-blue-500/80">
                                        <Award size={10} className="inline mr-1.5" />
                                        {selectedEmployee.contribution} Level
                                    </span>
                                </div>
                                <h2 className="text-4xl font-bold tracking-tight leading-none drop-shadow-2xl">{selectedEmployee.name}</h2>
                                <p className="text-white/80 text-sm mt-3 font-medium uppercase tracking-widest">{selectedEmployee.role}</p>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-10">
                            {/* Stats Overview */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 dark:bg-white/5 p-6 rounded-3xl border border-gray-100 dark:border-white/10">
                                    <Zap className="text-yellow-500 mb-3" size={20} />
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Efficiency</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedEmployee.efficiency}%</p>
                                </div>
                                <div className="bg-gray-50 dark:bg-white/5 p-6 rounded-3xl border border-gray-100 dark:border-white/10">
                                    <CheckCircle className="text-green-500 mb-3" size={20} />
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tasks Done</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedEmployee.history.length}</p>
                                </div>
                            </div>

                            {/* History Timeline */}
                            <section>
                                <h3 className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-6 flex items-center">
                                    <AlignLeft size={14} className="mr-3" />
                                    Project Audit Trail
                                </h3>
                                <div className="space-y-4">
                                    {selectedEmployee.history.map((item, idx) => (
                                        <div key={idx} className="group relative bg-white dark:bg-white/5 p-5 rounded-2xl border border-gray-100 dark:border-white/10 hover:border-blue-500/30 transition-all shadow-sm">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center space-x-3">
                                                    <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-white/5 px-2 py-0.5 rounded-lg border border-gray-100 dark:border-white/5">
                                                        {item.id}
                                                    </span>
                                                    <span className={`text-[10px] font-bold uppercase ${item.status === 'Completed' ? 'text-green-500' : 'text-blue-500'}`}>
                                                        {item.status}
                                                    </span>
                                                </div>
                                                <div className="flex items-center text-gray-400 text-[10px] font-medium">
                                                    <Calendar size={12} className="mr-1.5" />
                                                    {item.date}
                                                </div>
                                            </div>
                                            <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-tight mb-2">{item.name}</h4>
                                            <div className="flex items-center space-x-2">
                                                <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                                                    Impact: {item.impact}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-8 bg-gray-50 dark:bg-white/5 border-t border-gray-100 dark:border-white/10 flex items-center justify-end">
                            <button
                                onClick={() => setSelectedEmployee(null)}
                                className="px-10 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl text-xs font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-500/10"
                            >
                                Close History
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamContribution;
