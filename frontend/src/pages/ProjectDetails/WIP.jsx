import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, User, Briefcase, CheckCircle, Clock, AlertCircle, Plus, ChevronRight, Search, Layout, Filter, MoreVertical, Check, X, Info, Calendar, Tag, Flag, AlignLeft, Zap } from 'lucide-react';

const WIP = ({ setExtraBreadcrumbs, projectPermissions, isAdmin }) => {
    const canWrite = isAdmin || (projectPermissions && projectPermissions['WIP'] >= 2);
    const [searchParams, setSearchParams] = useSearchParams();
    const selectedEmployeeId = parseInt(searchParams.get('emp')) || 2;

    const setSelectedEmployeeId = React.useCallback((id) => {
        const newParams = new URLSearchParams(searchParams);
        newParams.set('emp', id);
        setSearchParams(newParams);
    }, [searchParams, setSearchParams]);
    // Mock Data for Employees
    const [employees] = React.useState([
        { id: 1, name: 'Nice Bike', role: 'Full Stack Developer', initials: 'NB', color: 'bg-blue-500' },
        { id: 2, name: 'Mano Bharathii', role: 'Project Manager', initials: 'MB', color: 'bg-purple-500' },
        { id: 3, name: 'John Doe', role: 'Frontend Engineer', initials: 'JD', color: 'bg-green-500' },
        { id: 4, name: 'Jane Smith', role: 'UI/UX Designer', initials: 'JS', color: 'bg-pink-500' },
        { id: 5, name: 'Alex Johnson', role: 'QA Engineer', initials: 'AJ', color: 'bg-orange-500' },
    ]);

    useEffect(() => {
        const emp = employees.find(e => e.id === selectedEmployeeId);
        if (emp) {
            setExtraBreadcrumbs([
                { label: 'Work in Progress' },
                { label: emp.name }
            ]);
        }
    }, [selectedEmployeeId, setExtraBreadcrumbs, employees]);

    // Mock Data for Tasks
    const [tasks, setTasks] = useState([
        { id: 'TASK-1', name: 'Design System Implementation', status: 'In Progress', priority: 'High', assigneeIds: [1], description: 'Establish a consistent set of design patterns and components for the ERP suite.', startDate: '2026-02-01', dueDate: '2026-02-15' },
        { id: 'TASK-2', name: 'API Documentation', status: 'To Do', priority: 'Medium', assigneeIds: [1, 3], description: 'Document all REST endpoints for the module using Swagger/OpenAPI.', startDate: '2026-02-10', dueDate: '2026-02-20' },
        { id: 'TASK-3', name: 'Database Schema Review', status: 'Completed', priority: 'High', assigneeIds: [2], description: 'Review the current normalized schema against performance requirements.', startDate: '2026-01-25', dueDate: '2026-01-30' },
        { id: 'TASK-4', name: 'User Authentication Flow', status: 'On Hold', priority: 'High', assigneeIds: [3, 2], description: 'Implement OAuth2 and JWT-based authentication for secure access.', startDate: '2026-02-05', dueDate: '2026-02-28' },
        { id: 'TASK-5', name: 'Landing Page Responsiveness', status: 'In Progress', priority: 'Medium', assigneeIds: [4], description: 'Ensure the landing page works perfectly across mobile, tablet, and desktop.', startDate: '2026-02-12', dueDate: '2026-02-18' },
        { id: 'TASK-6', name: 'Unit Testing for Auth', status: 'To Do', priority: 'Low', assigneeIds: [], description: 'Write unit tests for the newly implemented auth services.', startDate: '2026-03-01', dueDate: '2026-03-05' },
        { id: 'TASK-7', name: 'Security Audit', status: 'To Do', priority: 'High', assigneeIds: [], description: 'Perform a comprehensive security sweep across all active modules.', startDate: '2026-03-10', dueDate: '2026-03-20' },
        { id: 'TASK-8', name: 'Performance Optimization', status: 'To Do', priority: 'Medium', assigneeIds: [], description: 'Optimize slow queries and front-end bundle sizes.', startDate: '2026-03-15', dueDate: '2026-03-25' },
    ]);

    const [searchTerm, setSearchTerm] = useState('');
    const [isAssigning, setIsAssigning] = useState(false);
    const [selectedTaskForDetails, setSelectedTaskForDetails] = useState(null);



    const selectedEmployee = employees.find(e => e.id === selectedEmployeeId) || employees[0];
    const employeeTasks = tasks.filter(t => t.assigneeIds.includes(selectedEmployeeId));
    const unassignedTasks = tasks.filter(t => t.assigneeIds.length === 0);

    const handleStatusUpdate = (taskId, newStatus) => {
        setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    };

    const handleAssignTask = (taskId) => {
        setTasks(tasks.map(t => {
            if (t.id === taskId) {
                // Add employee if not already assigned
                const newAssignees = t.assigneeIds.includes(selectedEmployeeId)
                    ? t.assigneeIds
                    : [...t.assigneeIds, selectedEmployeeId];
                return { ...t, assigneeIds: newAssignees, status: t.status === 'To Do' && newAssignees.length > 0 ? 'To Do' : t.status };
            }
            return t;
        }));
        setIsAssigning(false);
    };

    const handleUnassignTask = (taskId, empId) => {
        setTasks(tasks.map(t => t.id === taskId
            ? { ...t, assigneeIds: t.assigneeIds.filter(id => id !== empId) }
            : t
        ));
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Completed': return <CheckCircle className="text-green-500" size={16} />;
            case 'In Progress': return <Clock className="text-blue-500" size={16} />;
            case 'On Hold': return <AlertCircle className="text-orange-500" size={16} />;
            default: return <Clock className="text-gray-400" size={16} />;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Completed': return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800';
            case 'In Progress': return 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800';
            case 'On Hold': return 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800';
            default: return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gh-border';
        }
    };

    return (
        <div className="flex-1 flex flex-col md:flex-row bg-white dark:bg-[#0d1117] h-full overflow-hidden">
            {/* Sidebar - Employee List */}
            <div className="w-full md:w-80 border-r border-gray-200 dark:border-gh-border flex flex-col bg-[#f6f8fa] dark:bg-[#161b22]">
                <div className="p-4 border-b border-gray-200 dark:border-gh-border">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                        <input
                            type="text"
                            placeholder="Find an employee..."
                            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-gh-border rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="px-3 py-2 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Assigned Employees ({employees.length})
                    </div>
                    {employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase())).map(employee => (
                        <button
                            key={employee.id}
                            onClick={() => setSelectedEmployeeId(employee.id)}
                            className={`w-full flex items-center p-3 transition-colors ${selectedEmployeeId === employee.id ? 'bg-white dark:bg-[#0d1117] border-l-4 border-blue-500 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-white/5 border-l-4 border-transparent'}`}
                        >
                            <div className={`w-10 h-10 rounded-full ${employee.color} flex items-center justify-center text-white font-bold text-sm shadow-md`}>
                                {employee.initials}
                            </div>
                            <div className="ml-3 text-left overflow-hidden">
                                <p className={`text-sm font-semibold truncate ${selectedEmployeeId === employee.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-200'}`}>
                                    {employee.name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{employee.role}</p>
                            </div>
                            <div className="ml-auto">
                                <span className="bg-gray-200 dark:bg-gh-border px-2 py-0.5 rounded-full text-[10px] font-bold dark:text-gray-300">
                                    {tasks.filter(t => t.assigneeIds.includes(employee.id)).length}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Panel - Task Assignment & Updates */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117]">
                {/* Employee Header */}
                <div className="px-8 py-6 border-b border-gray-100 dark:border-gh-border bg-white dark:bg-[#0d1117] flex justify-between items-center text-left">
                    <div className="flex items-center text-left">
                        <div className={`w-16 h-16 rounded-2xl ${selectedEmployee.color} flex items-center justify-center text-white text-2xl font-bold shadow-xl transform transition-transform hover:scale-105`}>
                            {selectedEmployee.initials}
                        </div>
                        <div className="ml-5">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedEmployee.name}</h2>
                            <p className="text-gray-500 dark:text-gray-400 flex items-center mt-1">
                                <Briefcase size={14} className="mr-1.5" />
                                {selectedEmployee.role}
                            </p>
                        </div>
                    </div>

                    {canWrite && (
                        <button
                            onClick={() => setIsAssigning(true)}
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                        >
                            <Plus size={18} />
                            <span>Assign New Task</span>
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                    {/* Active Tasks Section */}
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center">
                                <Clock size={16} className="mr-2" />
                                Active Workspace
                            </h3>
                            <span className="text-xs text-blue-500 font-bold bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                {employeeTasks.length} Assigned
                            </span>
                        </div>

                        {employeeTasks.length > 0 ? (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                {employeeTasks.map(task => (
                                    <div
                                        key={task.id}
                                        onClick={() => setSelectedTaskForDetails(task)}
                                        className="group relative bg-[#f9fafb] dark:bg-[#161b22] border border-gray-200 dark:border-gh-border p-5 rounded-xl hover:shadow-xl hover:border-blue-400/50 dark:hover:border-blue-500/50 transition-all duration-300 cursor-pointer"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">{task.id}</span>
                                            <div className="flex items-center space-x-1">
                                                {canWrite && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleUnassignTask(task.id, selectedEmployeeId);
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 transition-all"
                                                        title="Unassign Task"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setSelectedTaskForDetails(task)}
                                                    className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-all"
                                                    title="View Task Details"
                                                >
                                                    <Info size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        <h4 className="text-base font-bold text-gray-900 dark:text-gray-200 mb-4 leading-snug text-left">{task.name}</h4>

                                        <div className="flex items-center justify-between mt-auto">
                                            <div className="flex items-center space-x-2">
                                                <span className={`px-2 py-1 rounded text-[10px] font-extrabold uppercase ${task.priority === 'High' ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : task.priority === 'Medium' ? 'text-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'text-green-500 bg-green-50 dark:bg-green-900/20'}`}>
                                                    {task.priority}
                                                </span>
                                                <div className="flex -space-x-2 overflow-hidden">
                                                    {task.assigneeIds.map(id => {
                                                        const emp = employees.find(e => e.id === id);
                                                        return emp ? (
                                                            <div
                                                                key={id}
                                                                className={`w-6 h-6 rounded-full border-2 border-white dark:border-[#161b22] ${emp.color} flex items-center justify-center text-[8px] text-white font-bold shadow-sm`}
                                                                title={emp.name}
                                                            >
                                                                {emp.initials}
                                                            </div>
                                                        ) : null;
                                                    })}
                                                </div>
                                                <span className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-semibold shadow-sm tracking-tight ${getStatusColor(task.status)}`}>
                                                    {getStatusIcon(task.status)}
                                                    <span>{task.status}</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-gray-200 dark:border-gh-border rounded-2xl bg-gray-50/50 dark:bg-transparent">
                                <Layout className="text-gray-300 dark:text-gray-700 mb-4" size={48} />
                                <p className="text-gray-500 dark:text-gray-400 font-medium">No tasks assigned to {selectedEmployee.name} yet.</p>
                                {canWrite && (
                                    <button
                                        onClick={() => setIsAssigning(true)}
                                        className="mt-4 text-blue-600 dark:text-blue-400 text-sm font-bold hover:underline"
                                    >
                                        Assign their first task
                                    </button>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            </div>

            {/* Slide-out Panel for Unassigned Tasks */}
            {isAssigning && (
                <div className="fixed inset-0 z-50 overflow-hidden anim-fade-in text-left">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsAssigning(false)}></div>
                    <div className="absolute inset-y-0 right-0 max-w-md w-full bg-white dark:bg-[#0d1117] shadow-2xl transform transition-transform duration-300 translate-x-0 border-l border-gray-200 dark:border-gh-border text-left">
                        <div className="flex flex-col h-full text-left">
                            <div className="px-6 py-6 border-b border-gray-200 dark:border-gh-border flex justify-between items-center bg-[#f6f8fa] dark:bg-gray-50 dark:bg-[#161b22]">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Unassigned Pool</h2>
                                    <p className="text-xs text-gray-500 mt-1">Assign tasks to <b>{selectedEmployee.name}</b></p>
                                </div>
                                <button onClick={() => setIsAssigning(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors">
                                    <X size={20} className="text-gray-500" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-left">
                                {unassignedTasks.length > 0 ? unassignedTasks.map(task => (
                                    <div key={task.id} className="p-4 border border-gray-100 dark:border-gh-border rounded-xl bg-[#f9fafb] dark:bg-[#161b22] hover:border-blue-500 transition-all cursor-pointer group shadow-sm text-left">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-mono text-gray-400">{task.id}</span>
                                            <span className={`text-[10px] font-extrabold ${task.priority === 'High' ? 'text-red-500' : 'text-orange-500'}`}>{task.priority}</span>
                                        </div>
                                        <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-4 text-left">{task.name}</h4>
                                        <button
                                            onClick={() => handleAssignTask(task.id)}
                                            className="w-full py-2 bg-white dark:bg-gh-bg border border-blue-500 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                        >
                                            Assign to {selectedEmployee.initials}
                                        </button>
                                    </div>
                                )) : (
                                    <div className="text-center py-20">
                                        <CheckCircle className="mx-auto text-gray-200 dark:text-gray-700 mb-4" size={64} />
                                        <p className="text-gray-500 dark:text-gray-400">All tasks are currently assigned!</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Task Details Side Drawer - PREMIUM REDESIGN */}
            {selectedTaskForDetails && (
                <div className="fixed inset-0 z-[100] flex justify-end overflow-hidden anim-fade-in group/drawer">
                    <div
                        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity duration-500 ease-in-out"
                        onClick={() => setSelectedTaskForDetails(null)}
                    ></div>

                    <div className="relative w-full max-w-xl bg-white/90 dark:bg-[#0d1117]/90 backdrop-blur-2xl shadow-[-20px_0_50px_-20px_rgba(0,0,0,0.3)] transform transition-transform duration-500 ease-out translate-x-0 border-l border-white/20 dark:border-white/5 flex flex-col h-full">

                        {/* Premium Header with Dynamic Gradient */}
                        <div className={`relative h-48 flex flex-col justify-end p-8 overflow-hidden`}>
                            {/* Abstract Background Elements */}
                            <div className={`absolute inset-0 opacity-20 dark:opacity-30 mix-blend-overlay pointer-events-none`}>
                                <div className={`absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl ${selectedTaskForDetails.priority === 'High' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                                <div className={`absolute -bottom-24 -left-24 w-64 h-64 rounded-full blur-3xl ${selectedTaskForDetails.status === 'Completed' ? 'bg-green-500' : 'bg-purple-500'}`}></div>
                            </div>

                            <div className={`absolute inset-0 transition-colors duration-700 ${selectedTaskForDetails.status === 'Completed' ? 'bg-gradient-to-br from-green-600/90 to-emerald-800/90' :
                                selectedTaskForDetails.status === 'In Progress' ? 'bg-gradient-to-br from-blue-600/90 to-indigo-800/90' :
                                    selectedTaskForDetails.status === 'On Hold' ? 'bg-gradient-to-br from-orange-500/90 to-red-600/90' :
                                        'bg-gradient-to-br from-gray-700/90 to-gray-900/90'
                                }`}></div>

                            <button
                                onClick={() => setSelectedTaskForDetails(null)}
                                className="absolute top-6 right-6 p-2.5 bg-gray-200 dark:bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-md z-10 hover:rotate-90"
                            >
                                <X size={20} />
                            </button>

                            <div className="relative z-10 text-white">
                                <div className="flex items-center space-x-2 mb-3">
                                    <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-mono font-bold tracking-[0.2em] uppercase ring-1 ring-white/30 shadow-lg">
                                        {selectedTaskForDetails.id}
                                    </span>
                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-lg ${selectedTaskForDetails.priority === 'High' ? 'bg-red-500/80' : 'bg-gray-500/80'
                                        }`}>
                                        <Flag size={10} className="inline mr-1.5" />
                                        {selectedTaskForDetails.priority} Priority
                                    </span>
                                </div>
                                <h2 className="text-4xl font-bold tracking-tight leading-none drop-shadow-2xl">{selectedTaskForDetails.name}</h2>
                            </div>
                        </div>

                        {/* Content Area - Premium Grid */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-10">

                            {/* Status Indicator Bar */}
                            <div className="flex items-center justify-between p-1 bg-gray-100 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 shadow-inner">
                                {['To Do', 'In Progress', 'Completed', 'On Hold'].map(s => (
                                    <button
                                        key={s}
                                        onClick={canWrite ? () => {
                                            handleStatusUpdate(selectedTaskForDetails.id, s);
                                            setSelectedTaskForDetails({ ...selectedTaskForDetails, status: s });
                                        } : undefined}
                                        className={`flex-1 flex items-center justify-center space-x-2 py-3 px-2 rounded-xl text-xs font-bold transition-all ${selectedTaskForDetails.status === s
                                            ? 'bg-white dark:bg-gh-border text-blue-600 dark:text-blue-400 shadow-md scale-105 ring-1 ring-blue-500/20'
                                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white/50 dark:hover:bg-white/5'
                                            }`}
                                    >
                                        {getStatusIcon(s)}
                                        <span className="hidden sm:inline">{s}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Section: Project Context */}
                            <section>
                                <h3 className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-4 flex items-center">
                                    <AlignLeft size={14} className="mr-3" />
                                    The Mission
                                </h3>
                                <div className="relative group">
                                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
                                    <div className="relative bg-white dark:bg-white/5 p-6 rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm">
                                        <p className="text-gray-800 dark:text-gray-200 text-lg font-medium leading-relaxed italic opacity-90">
                                            "{selectedTaskForDetails.description || 'Our next big milestone awaits objective definition.'}"
                                        </p>
                                    </div>
                                </div>
                            </section>

                            {/* Section: Timeline & Details */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="bg-[#f8fafc] dark:bg-white/5 p-6 rounded-3xl border border-gray-100 dark:border-white/10 hover:shadow-lg transition-shadow">
                                    <Calendar className="text-blue-500 mb-4" size={24} />
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Timeline Schedule</h4>
                                    <div className="space-y-4">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-gray-500">IGNITION DATE</span>
                                            <span className="text-sm font-semibold text-gray-900 dark:text-white mt-1 transition-colors hover:text-blue-500">{selectedTaskForDetails.startDate}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-gray-500">DEADLINE</span>
                                            <span className="text-sm font-semibold text-gray-900 dark:text-white mt-1 transition-colors hover:text-red-500">{selectedTaskForDetails.dueDate}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-[#f8fafc] dark:bg-white/5 p-6 rounded-3xl border border-gray-100 dark:border-white/10 hover:shadow-lg transition-shadow">
                                    <Layout className="text-purple-500 mb-4" size={24} />
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Task Attributes</h4>
                                    <div className="space-y-4">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-gray-500">ASSIGNED TO</span>
                                            <div className="mt-2 space-y-2">
                                                {selectedTaskForDetails.assigneeIds.map(id => {
                                                    const emp = employees.find(e => e.id === id);
                                                    return emp ? (
                                                        <div key={id} className="flex items-center group/member">
                                                            <div className={`w-6 h-6 rounded-full ${emp.color} flex items-center justify-center text-[8px] text-white mr-2 shadow-sm`}>
                                                                {emp.initials}
                                                            </div>
                                                            <span className="text-sm font-semibold text-gray-900 dark:text-white mt-1 flex items-center text-left">{emp.name}</span>
                                                            {canWrite && (
                                                                <button
                                                                    onClick={() => {
                                                                        handleUnassignTask(selectedTaskForDetails.id, id);
                                                                        setSelectedTaskForDetails({
                                                                            ...selectedTaskForDetails,
                                                                            assigneeIds: selectedTaskForDetails.assigneeIds.filter(aid => aid !== id)
                                                                        });
                                                                    }}
                                                                    className="ml-auto opacity-0 group-hover/member:opacity-100 p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : null;
                                                })}
                                                {selectedTaskForDetails.assigneeIds.length === 0 && (
                                                    <span className="text-sm font-medium text-gray-400 italic">No one assigned yet</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-gray-500">IDENTIFIER</span>
                                            <span className="text-sm font-mono font-semibold text-gray-900 dark:text-white mt-1 truncate">{selectedTaskForDetails.id}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Premium Footer */}
                        <div className="px-8 py-8 bg-gray-100 dark:bg-white/5 border-t border-gray-200 dark:border-white/10 flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                            </div>
                            <button
                                onClick={() => setSelectedTaskForDetails(null)}
                                className="px-10 py-4 bg-gradient-to-r from-gray-900 to-gray-800 dark:from-white dark:to-gray-200 text-white dark:text-gray-900 rounded-2xl text-sm font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-blue-500/20 ring-4 ring-white/10 dark:ring-black/10"
                            >
                                Dismiss Details
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WIP;
