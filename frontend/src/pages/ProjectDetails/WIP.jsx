import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Users, User, Briefcase, CheckCircle, Clock, AlertCircle, Plus, ChevronRight, Search, Layout, Filter, MoreVertical, Check, X, Info, Calendar, Tag, Flag, AlignLeft, Zap } from 'lucide-react';
import { projectApi } from '../../services/projectApi';
import { tasksApi } from '../../services/tasksApi';
import { toast } from 'react-toastify';
import PageSkeleton from '../../components/PageSkeleton';

const WIP = ({ setExtraBreadcrumbs, projectPermissions, isAdmin, user }) => {
    const { id: projectId } = useParams();
    const canWrite = isAdmin || (projectPermissions && projectPermissions['WIP'] >= 2);
    
    const [searchParams, setSearchParams] = useSearchParams();
    const [employees, setEmployees] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAssigning, setIsAssigning] = useState(false);
    const [selectedTaskForDetails, setSelectedTaskForDetails] = useState(null);

    // Selected Employee State
    const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);

    const isUserAdmin = ['admin', 'super admin', 'superadmin', 'super_admin'].includes(user?.user_type?.toLowerCase());

    const columns = [
        { id: 'open', title: 'Open', color: 'text-gray-500 border-gray-200 dark:border-gray-800' },
        { id: 'in progress', title: 'In Progress', color: 'text-blue-500 border-blue-100 dark:border-blue-900/30' },
        { id: 'on hold', title: 'On Hold', color: 'text-orange-500 border-orange-100 dark:border-orange-900/30' },
        { id: 'completed', title: 'Completed', color: 'text-green-500 border-green-100 dark:border-green-900/30' },
        { id: 'cancelled', title: 'Cancelled', color: 'text-red-500 border-red-100 dark:border-red-900/30' }
    ];

    // Drag and Drop Card State
    const [draggedCardId, setDraggedCardId] = useState(null);

    // Lock status editing in the details modal and drag drop for admins viewing another member's board
    const isSelf = user?.user_id === selectedEmployeeId;
    const canDragAndDrop = !isUserAdmin && isSelf;

    const flattenTasks = (categories) => {
        let flat = [];
        categories.forEach(cat => {
            cat.tasks.forEach(t => {
                flat.push({
                    ...t,
                    categoryId: cat.id,
                    categoryName: cat.listName
                });
            });
        });
        return flat;
    };

    const fetchTasks = async () => {
        try {
            const res = await tasksApi.getTasks(projectId);
            if (res.success) {
                setTasks(flattenTasks(res.categories));
            }
        } catch (err) {
            console.error("Failed to load tasks:", err);
            toast.error("Failed to load tasks");
        }
    };

    const fetchMembers = async () => {
        try {
            const res = await projectApi.getProjectMembers(projectId);
            if (res.success) {
                const mapped = res.members.map(m => {
                    const initials = m.user_name ? m.user_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
                    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-pink-500', 'bg-orange-500', 'bg-indigo-500', 'bg-teal-500'];
                    const color = colors[m.user_id % colors.length];
                    return {
                        id: m.user_id,
                        name: m.user_name,
                        role: m.user_type || 'Employee',
                        initials,
                        color
                    };
                });
                setEmployees(mapped);

                // Determine default selected employee
                if (!isUserAdmin) {
                    setSelectedEmployeeId(user?.user_id);
                } else {
                    const paramId = parseInt(searchParams.get('emp'));
                    if (paramId && mapped.some(e => e.id === paramId)) {
                        setSelectedEmployeeId(paramId);
                    } else if (mapped.length > 0) {
                        setSelectedEmployeeId(mapped[0].id);
                    }
                }
            }
        } catch (err) {
            console.error("Failed to load members:", err);
            toast.error("Failed to load project members");
        }
    };

    const loadWIPData = async () => {
        setLoading(true);
        await Promise.all([fetchTasks(), fetchMembers()]);
        setLoading(false);
    };

    useEffect(() => {
        loadWIPData();
    }, [projectId]);

    // Handle selecting member from sidebar (Admin only)
    const handleSelectEmployee = (id) => {
        setSelectedEmployeeId(id);
        const newParams = new URLSearchParams(searchParams);
        newParams.set('emp', id);
        setSearchParams(newParams);
    };

    // Breadcrumb title synchronization
    useEffect(() => {
        if (employees.length > 0 && selectedEmployeeId) {
            const emp = employees.find(e => e.id === selectedEmployeeId);
            if (emp) {
                setExtraBreadcrumbs([
                    { label: 'Work in Progress' },
                    { label: emp.name }
                ]);
            }
        }
    }, [selectedEmployeeId, employees, setExtraBreadcrumbs]);

    const selectedEmployee = employees.find(e => e.id === selectedEmployeeId) || { name: 'Employee', initials: 'E', color: 'bg-blue-500', role: '' };
    const employeeTasks = tasks.filter(t => t.assigneeIds && t.assigneeIds.includes(selectedEmployeeId));
    const unassignedTasks = tasks.filter(t => !t.assigneeIds || !t.assigneeIds.includes(selectedEmployeeId));

    // DRAG CARD FOR WORKERS
    const handleCardDragStart = (e, taskId) => {
        setDraggedCardId(taskId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleCardDrop = async (e, targetStatus) => {
        e.preventDefault();
        if (!draggedCardId) return;

        const previousTasks = JSON.parse(JSON.stringify(tasks));
        
        // Find task
        const taskIdx = tasks.findIndex(t => t.id === draggedCardId);
        if (taskIdx === -1) return;

        const oldStatus = tasks[taskIdx].status;
        if (oldStatus.toLowerCase() === targetStatus.toLowerCase()) return;

        // Update state optimistically
        setTasks(currentTasks => currentTasks.map(t => t.id === draggedCardId ? { ...t, status: targetStatus } : t));

        try {
            await tasksApi.updateTask(projectId, draggedCardId, { status: targetStatus });
            toast.success(`Task moved to ${targetStatus}`);
        } catch (err) {
            console.error("Failed to update status:", err);
            toast.error("Failed to update task status. Reverting.");
            setTasks(previousTasks);
        } finally {
            setDraggedCardId(null);
        }
    };

    // OPTIMISTIC TASK ASSIGNMENT
    const handleAssignTask = async (taskId) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const previousTasks = JSON.parse(JSON.stringify(tasks));
        const newAssigneeIds = [...(task.assigneeIds || []), selectedEmployeeId];

        setTasks(currentTasks => currentTasks.map(t => t.id === taskId ? { ...t, assigneeIds: newAssigneeIds } : t));

        try {
            await tasksApi.updateTaskAssignees(projectId, taskId, { assigneeIds: newAssigneeIds });
            toast.success("Task assigned successfully");
        } catch (err) {
            console.error("Failed to assign task:", err);
            toast.error("Failed to assign task. Reverting.");
            setTasks(previousTasks);
        }
    };

    // OPTIMISTIC TASK UNASSIGNMENT WITH CONFIRMATION
    const handleUnassignTaskClick = async (e, task) => {
        e.stopPropagation(); // Prevent opening Details sidebar
        const confirm = window.confirm(`Are you sure you want to unassign "${task.name}" from ${selectedEmployee.name}?`);
        if (!confirm) return;

        const previousTasks = JSON.parse(JSON.stringify(tasks));
        const newAssigneeIds = (task.assigneeIds || []).filter(id => id !== selectedEmployeeId);

        setTasks(currentTasks => currentTasks.map(t => t.id === task.id ? { ...t, assigneeIds: newAssigneeIds } : t));

        try {
            await tasksApi.updateTaskAssignees(projectId, task.id, { assigneeIds: newAssigneeIds });
            toast.success("Task unassigned successfully");
        } catch (err) {
            console.error("Failed to unassign task:", err);
            toast.error("Failed to unassign task. Reverting.");
            setTasks(previousTasks);
        }
    };

    const handleStatusUpdate = async (taskId, newStatus) => {
        const previousTasks = JSON.parse(JSON.stringify(tasks));
        setTasks(currentTasks => currentTasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

        try {
            await tasksApi.updateTask(projectId, taskId, { status: newStatus });
            toast.success(`Task status updated to ${newStatus}`);
        } catch (err) {
            console.error("Failed to update status:", err);
            toast.error("Failed to update task status. Reverting.");
            setTasks(previousTasks);
        }
    };

    const getStatusIcon = (status) => {
        switch (status?.toLowerCase()) {
            case 'completed': return <CheckCircle className="text-green-500" size={16} />;
            case 'in progress': return <Clock className="text-blue-500" size={16} />;
            case 'on hold': return <AlertCircle className="text-orange-500" size={16} />;
            case 'cancelled': return <X className="text-red-500" size={16} />;
            default: return <Clock className="text-gray-400" size={16} />;
        }
    };

    if (loading) {
        return <PageSkeleton variant="table" />;
    }

    return (
        <div className="flex-1 flex flex-col md:flex-row bg-white dark:bg-[#0d1117] h-full overflow-hidden text-left">
            {/* Sidebar - Employee List (Only visible for Admin/PM roles) */}
            {isUserAdmin && (
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
                                onClick={() => handleSelectEmployee(employee.id)}
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
                                        {tasks.filter(t => t.assigneeIds && t.assigneeIds.includes(employee.id)).length}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Panel - Task Assignment & Updates */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117] h-full text-left">
                {/* Employee Header */}
                <div className="px-8 py-6 border-b border-gray-100 dark:border-gh-border bg-white dark:bg-[#0d1117] flex justify-between items-center text-left">
                    <div className="flex items-center text-left">
                        <div className={`w-16 h-16 rounded-2xl ${selectedEmployee.color} flex items-center justify-center text-white text-2xl font-bold shadow-xl transform transition-transform hover:scale-105`}>
                            {selectedEmployee.initials}
                        </div>
                        <div className="ml-5 text-left">
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                                {isSelf ? 'My Workspace' : selectedEmployee.name}
                                {!isUserAdmin && <span className="ml-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs px-2.5 py-1 rounded-full font-bold">Personal Workspace</span>}
                            </h1>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1 uppercase tracking-widest">{selectedEmployee.role || 'Project Member'}</p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-3">
                        {isUserAdmin && canWrite && (
                            <button
                                onClick={() => setIsAssigning(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center shadow-lg shadow-blue-500/25 transform active:scale-95"
                            >
                                <Plus size={16} className="mr-1.5" /> Assign Task
                            </button>
                        )}
                    </div>
                </div>

                {/* Revamped Kanban Columns */}
                <div className="flex-1 overflow-x-auto p-6 bg-gray-50/30 dark:bg-white/5 h-full">
                    <div className="flex space-x-4 h-full items-start pb-4 min-w-[1400px]">
                        {columns.map(column => {
                            const columnTasks = employeeTasks.filter(t => t.status?.toLowerCase() === column.id);
                            return (
                                <div 
                                    key={column.id} 
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => handleCardDrop(e, column.id)}
                                    className="flex flex-col w-[300px] h-[calc(100vh-270px)] bg-[#f6f8fa] dark:bg-[#161b22] rounded-2xl border border-gray-200 dark:border-gh-border shadow-sm overflow-hidden flex-shrink-0"
                                >
                                    {/* Column Header */}
                                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gh-border bg-white dark:bg-gh-bg">
                                        <div className="flex items-center space-x-2">
                                            <span className={`w-2.5 h-2.5 rounded-full ${
                                                column.id === 'open' ? 'bg-gray-400' :
                                                column.id === 'in progress' ? 'bg-blue-500' :
                                                column.id === 'on hold' ? 'bg-orange-500' :
                                                column.id === 'completed' ? 'bg-green-500' : 'bg-red-500'
                                            }`} />
                                            <span className="font-bold text-gray-800 dark:text-gray-200 capitalize text-sm">{column.title}</span>
                                        </div>
                                        <span className="bg-gray-200 dark:bg-gh-border px-2 py-0.5 rounded-full text-xs font-bold text-gray-600 dark:text-gray-400">
                                            {columnTasks.length}
                                        </span>
                                    </div>

                                    {/* Column Cards List */}
                                    <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                                        {columnTasks.map(task => (
                                            <div 
                                                key={task.id}
                                                draggable={canDragAndDrop}
                                                onDragStart={(e) => handleCardDragStart(e, task.id)}
                                                onClick={() => setSelectedTaskForDetails(task)}
                                                className={`p-4 bg-white dark:bg-[#0d1117] rounded-xl border border-gray-200 dark:border-gh-border shadow-sm hover:shadow-md dark:hover:border-blue-500/50 transition-all group/card relative ${canDragAndDrop ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                                            >
                                                {/* Header */}
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-[10px] font-mono text-gray-400">{task.task_code || task.id}</span>
                                                    <span className="text-[10px] font-semibold text-gray-400 capitalize max-w-[150px] truncate">{task.categoryName}</span>
                                                </div>
                                                
                                                {/* Name */}
                                                <h4 className="font-semibold text-gray-950 dark:text-gray-100 text-left text-sm mb-3 leading-snug line-clamp-2">
                                                    {task.name}
                                                </h4>

                                                {/* Meta Info */}
                                                <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                                                    <div className="flex items-center space-x-1">
                                                        <span>Due:</span>
                                                        <span className="font-medium text-gray-700 dark:text-gray-300">{task.dueDate || '-'}</span>
                                                    </div>
                                                    <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] uppercase ${
                                                        task.priority === 'High' ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400' :
                                                        task.priority === 'Medium' ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400' :
                                                        task.priority === 'Low' ? 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400' :
                                                        'bg-gray-50 text-gray-500 dark:bg-gray-950/30 dark:text-gray-400'
                                                    }`}>
                                                        {task.priority}
                                                    </span>
                                                </div>

                                                {/* Unassign button (hover only, admin only) */}
                                                {isUserAdmin && canWrite && (
                                                    <button
                                                        onClick={(e) => handleUnassignTaskClick(e, task)}
                                                        className="absolute -top-1.5 -right-1.5 opacity-0 group-hover/card:opacity-100 p-1 bg-red-100 dark:bg-red-950 hover:bg-red-200 dark:hover:bg-red-900 text-red-600 dark:text-red-200 rounded-full transition-opacity shadow-md z-10 border border-white dark:border-gh-border"
                                                        title="Unassign Task"
                                                    >
                                                        <X size={10} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}

                                        {columnTasks.length === 0 && (
                                            <div className="h-24 flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-gh-border rounded-xl text-gray-400 dark:text-gray-600 text-xs italic">
                                                No tasks in this status
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
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
                                            <span className="text-[10px] font-mono text-gray-400">{task.task_code || task.id}</span>
                                            <span className="text-[10px] font-semibold text-gray-400">{task.categoryName}</span>
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

            {/* Task Details Side Drawer */}
            {selectedTaskForDetails && (
                <div className="fixed inset-0 z-[100] flex justify-end overflow-hidden anim-fade-in group/drawer">
                    <div
                        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity duration-500 ease-in-out"
                        onClick={() => setSelectedTaskForDetails(null)}
                    ></div>

                    <div className="relative w-full max-w-xl bg-white/90 dark:bg-[#0d1117]/90 backdrop-blur-2xl shadow-[-20px_0_50px_-20px_rgba(0,0,0,0.3)] transform transition-transform duration-500 ease-out translate-x-0 border-l border-white/20 dark:border-white/5 flex flex-col h-full text-left">
                        {/* Drawer Header */}
                        <div className={`relative h-48 flex flex-col justify-end p-8 overflow-hidden`}>
                            <div className={`absolute inset-0 opacity-20 dark:opacity-30 mix-blend-overlay pointer-events-none`}>
                                <div className={`absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl ${selectedTaskForDetails.priority === 'High' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                            </div>

                            <div className={`absolute inset-0 transition-colors duration-700 ${
                                selectedTaskForDetails.status?.toLowerCase() === 'completed' ? 'bg-gradient-to-br from-green-600/90 to-emerald-800/90' :
                                selectedTaskForDetails.status?.toLowerCase() === 'in progress' ? 'bg-gradient-to-br from-blue-600/90 to-indigo-800/90' :
                                selectedTaskForDetails.status?.toLowerCase() === 'on hold' ? 'bg-gradient-to-br from-orange-500/90 to-red-600/90' :
                                'bg-gradient-to-br from-gray-700/90 to-gray-900/90'
                            }`}></div>

                            <button
                                onClick={() => setSelectedTaskForDetails(null)}
                                className="absolute top-6 right-6 p-2.5 bg-gray-200 dark:bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-md z-10 hover:rotate-95"
                            >
                                <X size={20} />
                            </button>

                            <div className="relative z-10 text-white text-left">
                                <div className="flex items-center space-x-2 mb-3">
                                    <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-mono font-bold tracking-[0.2em] uppercase ring-1 ring-white/30 shadow-lg">
                                        {selectedTaskForDetails.task_code || selectedTaskForDetails.id}
                                    </span>
                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-lg ${
                                        selectedTaskForDetails.priority === 'High' ? 'bg-red-500/80' : 'bg-gray-500/80'
                                    }`}>
                                        <Flag size={10} className="inline mr-1.5" />
                                        {selectedTaskForDetails.priority} Priority
                                    </span>
                                </div>
                                <h2 className="text-3xl font-bold tracking-tight leading-none drop-shadow-2xl text-left">{selectedTaskForDetails.name}</h2>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8 text-left">
                            {/* Status Indicator Bar */}
                            <div className="flex flex-col space-y-2">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest text-left">Status Transition</h3>
                                <div className="flex items-center justify-between p-1 bg-gray-100 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 shadow-inner">
                                    {['open', 'in progress', 'on hold', 'completed', 'cancelled'].map(s => (
                                        <button
                                            key={s}
                                            onClick={canDragAndDrop ? () => {
                                                handleStatusUpdate(selectedTaskForDetails.id, s);
                                                setSelectedTaskForDetails({ ...selectedTaskForDetails, status: s });
                                            } : undefined}
                                            className={`flex-1 flex items-center justify-center space-x-1.5 py-3 px-1 rounded-xl text-[10px] font-bold transition-all ${
                                                selectedTaskForDetails.status?.toLowerCase() === s
                                                    ? 'bg-white dark:bg-gh-border text-blue-600 dark:text-blue-400 shadow-md scale-105'
                                                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                            } ${!canDragAndDrop ? 'cursor-not-allowed opacity-60' : ''}`}
                                            disabled={!canDragAndDrop}
                                            title={!canDragAndDrop ? 'Only assigned employees can change task status' : ''}
                                        >
                                            {getStatusIcon(s)}
                                            <span className="hidden sm:inline capitalize">{s}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Section: Context */}
                            <section className="text-left">
                                <h3 className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-3 flex items-center text-left">
                                    <AlignLeft size={14} className="mr-3" />
                                    The Mission / Category
                                </h3>
                                <div className="bg-gray-50 dark:bg-white/5 p-5 rounded-2xl border border-gray-100 dark:border-white/10 text-left">
                                    <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">CATEGORY: {selectedTaskForDetails.categoryName}</p>
                                    <p className="text-gray-800 dark:text-gray-200 text-sm font-medium leading-relaxed opacity-90 text-left">
                                        {selectedTaskForDetails.description || 'No description provided.'}
                                    </p>
                                </div>
                            </section>

                            {/* Section: Timeline & Details */}
                            <div className="grid grid-cols-2 gap-4 text-left">
                                <div className="bg-[#f8fafc] dark:bg-white/5 p-5 rounded-2xl border border-gray-100 dark:border-white/10 text-left">
                                    <Calendar className="text-blue-500 mb-3" size={20} />
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 text-left">Timeline Schedule</h4>
                                    <div className="space-y-3 text-left">
                                        <div className="flex flex-col text-left">
                                            <span className="text-[9px] text-gray-500">START DATE</span>
                                            <span className="text-xs font-semibold text-gray-900 dark:text-white mt-1">{selectedTaskForDetails.startDate || '-'}</span>
                                        </div>
                                        <div className="flex flex-col text-left">
                                            <span className="text-[9px] text-gray-500">DEADLINE</span>
                                            <span className="text-xs font-semibold text-gray-900 dark:text-white mt-1">{selectedTaskForDetails.dueDate || '-'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-[#f8fafc] dark:bg-white/5 p-5 rounded-2xl border border-gray-100 dark:border-white/10 text-left">
                                    <Layout className="text-purple-500 mb-3" size={20} />
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 text-left">Work Attributes</h4>
                                    <div className="space-y-3 text-left">
                                        <div className="flex flex-col text-left">
                                            <span className="text-[9px] text-gray-500">DURATION</span>
                                            <span className="text-xs font-semibold text-gray-900 dark:text-white mt-1">{selectedTaskForDetails.duration}</span>
                                        </div>
                                        <div className="flex flex-col text-left">
                                            <span className="text-[9px] text-gray-500">IDENTIFIER</span>
                                            <span className="text-xs font-mono font-semibold text-gray-900 dark:text-white mt-1">{selectedTaskForDetails.id}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Drawer Footer */}
                        <div className="px-8 py-6 bg-gray-100 dark:bg-white/5 border-t border-gray-200 dark:border-white/10 flex items-center justify-end">
                            <button
                                onClick={() => setSelectedTaskForDetails(null)}
                                className="px-6 py-3 bg-gray-900 dark:bg-white hover:scale-105 active:scale-95 text-white dark:text-gray-900 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
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
