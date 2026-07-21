import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { 
    Users, User, Briefcase, CheckCircle, Clock, AlertCircle, Plus, ChevronRight, 
    Search, Filter, X, Check, Calendar, Tag, Flag, AlignLeft, GripVertical, 
    Layers, AlertTriangle, UserPlus, SlidersHorizontal, Trash2
} from 'lucide-react';
import { projectApi } from '../../services/projectApi';
import { tasksApi } from '../../services/tasksApi';
import CustomDatePicker from '../../components/CustomDatePicker';
import { toast } from 'react-toastify';
import PageSkeleton from '../../components/PageSkeleton';

const WIP = ({ setExtraBreadcrumbs, projectPermissions, isAdmin, user }) => {
    const { id: projectId } = useParams();
    const canWrite = isAdmin || (projectPermissions && projectPermissions['WIP'] >= 2);
    
    const [searchParams, setSearchParams] = useSearchParams();
    const [employees, setEmployees] = useState([]);
    const [categories, setCategories] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [boardSearchTerm, setBoardSearchTerm] = useState('');
    const [isAssigning, setIsAssigning] = useState(false);
    const [selectedTaskForDetails, setSelectedTaskForDetails] = useState(null);
    const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);

    // Quick Task Creation State
    const [quickTaskForm, setQuickTaskForm] = useState({
        name: '',
        category_id: '',
        status: 'in progress',
        priority: 'Medium',
        startDate: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0]
    });

    // Selected Employee State
    const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);

    const isUserAdmin = ['admin', 'super admin', 'superadmin', 'super_admin'].includes(user?.user_type?.toLowerCase());

    const columns = [
        { id: 'open', title: 'Open', color: 'text-gray-500', accent: 'bg-gray-400', border: 'border-gray-200 dark:border-gray-700' },
        { id: 'in progress', title: 'In Progress', color: 'text-blue-500', accent: 'bg-blue-500', border: 'border-blue-200 dark:border-blue-800/50' },
        { id: 'on hold', title: 'On Hold', color: 'text-orange-500', accent: 'bg-orange-500', border: 'border-orange-200 dark:border-orange-800/50' },
        { id: 'completed', title: 'Completed', color: 'text-green-500', accent: 'bg-green-500', border: 'border-green-200 dark:border-green-800/50' },
        { id: 'cancelled', title: 'Cancelled', color: 'text-red-500', accent: 'bg-red-500', border: 'border-red-200 dark:border-red-800/50' }
    ];

    const priorityOptions = [
        { label: 'High', color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/40' },
        { label: 'Medium', color: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/40' },
        { label: 'Low', color: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/40' },
        { label: 'None', color: 'text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700' }
    ];

    // Drag and Drop Card State
    const [draggedCardId, setDraggedCardId] = useState(null);

    const isSelf = user?.user_id === selectedEmployeeId;
    const canDragAndDrop = isUserAdmin || isSelf;

    const flattenTasks = (categoryData) => {
        let flat = [];
        categoryData.forEach(cat => {
            (cat.tasks || []).forEach(t => {
                flat.push({
                    ...t,
                    categoryId: cat.id,
                    categoryName: cat.listName
                });
            });
        });
        return flat;
    };

    const fetchTasksData = async () => {
        try {
            const res = await tasksApi.getTasks(projectId);
            if (res.success) {
                setCategories(res.categories || []);
                setTasks(flattenTasks(res.categories || []));
                if ((res.categories || []).length > 0 && !quickTaskForm.category_id) {
                    setQuickTaskForm(prev => ({ ...prev, category_id: res.categories[0].id }));
                }
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
                    const colors = ['bg-blue-600', 'bg-purple-600', 'bg-green-600', 'bg-pink-600', 'bg-orange-600', 'bg-indigo-600', 'bg-teal-600'];
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
        await Promise.all([fetchTasksData(), fetchMembers()]);
        setLoading(false);
    };

    useEffect(() => {
        loadWIPData();
    }, [projectId]);

    const handleSelectEmployee = (id) => {
        setSelectedEmployeeId(id);
        const newParams = new URLSearchParams(searchParams);
        newParams.set('emp', id);
        setSearchParams(newParams);
    };

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

    const selectedEmployee = employees.find(e => e.id === selectedEmployeeId) || { name: 'Employee', initials: 'E', color: 'bg-blue-600', role: '' };
    
    // Employee assigned tasks & unassigned tasks
    const rawEmployeeTasks = tasks.filter(t => (t.assigneeIds || []).includes(selectedEmployeeId));
    const unassignedTasks = tasks.filter(t => !t.assigneeIds || t.assigneeIds.length === 0);

    // Board filtered tasks
    const employeeTasks = rawEmployeeTasks.filter(t => {
        if (!boardSearchTerm.trim()) return true;
        const q = boardSearchTerm.toLowerCase();
        return (
            (t.name || '').toLowerCase().includes(q) ||
            (t.task_code || t.id || '').toString().toLowerCase().includes(q) ||
            (t.categoryName || '').toLowerCase().includes(q)
        );
    });

    const isTaskOverdue = (task) => {
        if (!task.dueDate || task.status?.toLowerCase() === 'completed' || task.status?.toLowerCase() === 'cancelled') return false;
        const due = new Date(task.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return due < today;
    };

    const getDurationText = (startStr, endStr) => {
        if (!startStr || !endStr) return 'Auto';
        const start = new Date(startStr);
        const end = new Date(endStr);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'Auto';
        if (end < start) return 'Invalid range';
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        return `${days} day${days > 1 ? 's' : ''}`;
    };

    const getPriorityColor = (priority) => {
        const found = priorityOptions.find(opt => opt.label.toLowerCase() === priority?.toLowerCase());
        return found ? found.color : 'text-gray-400 dark:text-gray-500';
    };

    // DRAG AND DROP KANBAN CARD
    const handleCardDragStart = (e, taskId) => {
        setDraggedCardId(taskId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', taskId);
    };

    const handleCardDrop = async (e, targetStatus) => {
        e.preventDefault();
        if (!draggedCardId) return;

        const previousTasks = JSON.parse(JSON.stringify(tasks));
        const taskIdx = tasks.findIndex(t => t.id === draggedCardId);
        if (taskIdx === -1) return;

        const oldStatus = tasks[taskIdx].status;
        if (oldStatus.toLowerCase() === targetStatus.toLowerCase()) return;

        // Optimistic update
        setTasks(currentTasks => currentTasks.map(t => t.id === draggedCardId ? { ...t, status: targetStatus } : t));

        try {
            await tasksApi.updateTask(projectId, draggedCardId, { status: targetStatus });
            toast.success(`Moved to ${targetStatus}`);
        } catch (err) {
            console.error("Failed to update status:", err);
            toast.error("Failed to update status. Reverting.");
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
            toast.success(`Task assigned to ${selectedEmployee.name}`);
        } catch (err) {
            console.error("Failed to assign task:", err);
            toast.error("Failed to assign task. Reverting.");
            setTasks(previousTasks);
        }
    };

    // OPTIMISTIC TASK UNASSIGNMENT
    const handleUnassignTaskClick = async (e, task) => {
        e.stopPropagation();
        const confirm = window.confirm(`Unassign "${task.name}" from ${selectedEmployee.name}?`);
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

    // OPTIMISTIC TASK FIELD SAVE (From Drawer)
    const handleSaveTaskField = async (taskId, field, value) => {
        const previousTasks = JSON.parse(JSON.stringify(tasks));

        setTasks(currentTasks => currentTasks.map(t => {
            if (t.id === taskId) {
                const updated = { ...t, [field]: value };
                if (field === 'startDate' || field === 'dueDate') {
                    updated.duration = getDurationText(updated.startDate, updated.dueDate);
                }
                return updated;
            }
            return t;
        }));

        if (selectedTaskForDetails?.id === taskId) {
            setSelectedTaskForDetails(prev => prev ? { ...prev, [field]: value } : null);
        }

        try {
            let payloadField = field;
            if (field === 'startDate') payloadField = 'start_date';
            if (field === 'dueDate') payloadField = 'due_date';

            await tasksApi.updateTask(projectId, taskId, { [payloadField]: value || null });
        } catch (err) {
            console.error("Failed to save field:", err);
            toast.error("Failed to save change. Reverting.");
            setTasks(previousTasks);
        }
    };

    // QUICK TASK CREATION FOR THIS EMPLOYEE
    const handleCreateQuickTask = async (e) => {
        e.preventDefault();
        if (!quickTaskForm.name.trim()) return toast.error('Task title is required');
        if (!quickTaskForm.category_id) return toast.error('Category is required');

        try {
            let calculatedDurationVal = null;
            if (quickTaskForm.startDate && quickTaskForm.dueDate) {
                const start = new Date(quickTaskForm.startDate);
                const end = new Date(quickTaskForm.dueDate);
                if (end >= start) {
                    calculatedDurationVal = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
                }
            }

            const res = await tasksApi.createTask(projectId, {
                category_id: quickTaskForm.category_id,
                name: quickTaskForm.name,
                status: quickTaskForm.status,
                priority: quickTaskForm.priority,
                start_date: quickTaskForm.startDate || null,
                due_date: quickTaskForm.dueDate || null,
                duration: calculatedDurationVal
            });

            if (res.success && res.task) {
                // Assign to current employee
                await tasksApi.updateTaskAssignees(projectId, res.task.id, { assigneeIds: [selectedEmployeeId] });
                
                toast.success('Task created and assigned!');
                setIsQuickCreateOpen(false);
                setQuickTaskForm(prev => ({ ...prev, name: '' }));
                fetchTasksData();
            }
        } catch (err) {
            console.error("Failed to create task:", err);
            toast.error("Failed to create task");
        }
    };

    if (loading) {
        return <PageSkeleton variant="table" />;
    }

    // STATS FOR SELECTED EMPLOYEE
    const totalEmployeeTasks = rawEmployeeTasks.length;
    const completedCount = rawEmployeeTasks.filter(t => t.status?.toLowerCase() === 'completed').length;
    const inProgressCount = rawEmployeeTasks.filter(t => t.status?.toLowerCase() === 'in progress').length;
    const onHoldCount = rawEmployeeTasks.filter(t => t.status?.toLowerCase() === 'on hold').length;
    const overdueCount = rawEmployeeTasks.filter(isTaskOverdue).length;
    const completionPercentage = totalEmployeeTasks > 0 ? Math.round((completedCount / totalEmployeeTasks) * 100) : 0;

    return (
        <div className="flex-1 flex flex-col md:flex-row bg-white dark:bg-[#0d1117] h-full overflow-hidden text-left font-sans">
            
            {/* EMPLOYEE SIDEBAR (Admins/PMs) */}
            {isUserAdmin && (
                <div className="w-full md:w-72 border-r border-gray-200 dark:border-gh-border flex flex-col bg-[#f9fafb] dark:bg-gh-bg shrink-0">
                    
                    {/* Search Input */}
                    <div className="p-3 border-b border-gray-200 dark:border-gh-border bg-white dark:bg-[#0d1117]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                            <input
                                type="text"
                                placeholder="Find team member..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-7 py-1.5 bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-lg text-xs focus:ring-1 focus:ring-blue-500 outline-none text-gray-900 dark:text-white transition-all placeholder:text-gray-400"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Employee List */}
                    <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gh-border/40">
                        <div className="px-3.5 py-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            Team Members ({employees.length})
                        </div>
                        {employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase())).map(employee => {
                            const empAssignedCount = tasks.filter(t => (t.assigneeIds || []).includes(employee.id)).length;
                            const isSelected = selectedEmployeeId === employee.id;

                            return (
                                <button
                                    key={employee.id}
                                    onClick={() => handleSelectEmployee(employee.id)}
                                    className={`w-full flex items-center p-3 text-left transition-all ${isSelected ? 'bg-white dark:bg-[#0d1117] border-l-3 border-blue-500 shadow-2xs' : 'hover:bg-gray-100 dark:hover:bg-white/5 border-l-3 border-transparent'}`}
                                >
                                    <div className={`w-8 h-8 rounded-full ${employee.color} flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs`}>
                                        {employee.initials}
                                    </div>
                                    <div className="ml-2.5 overflow-hidden">
                                        <p className={`text-xs font-semibold truncate ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-200'}`}>
                                            {employee.name}
                                        </p>
                                        <p className="text-[10px] text-gray-400 truncate">{employee.role}</p>
                                    </div>
                                    <div className="ml-auto shrink-0">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isSelected ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                                            {empAssignedCount}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* MAIN WORKSPACE PANEL */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117] text-left">
                
                {/* Workspace Header & Actions */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gh-border bg-[#f9fafb] dark:bg-gh-bg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-3">
                        <div className={`w-11 h-11 rounded-xl ${selectedEmployee.color} flex items-center justify-center text-white text-base font-bold shadow-xs shrink-0`}>
                            {selectedEmployee.initials}
                        </div>
                        <div>
                            <div className="flex items-center space-x-2">
                                <h1 className="text-base font-bold text-gray-900 dark:text-white">
                                    {isSelf ? 'My Workspace' : `${selectedEmployee.name}'s Workstation`}
                                </h1>
                                {!isUserAdmin && (
                                    <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] px-2 py-0.5 rounded-md font-bold">
                                        Personal Workspace
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                                {selectedEmployee.role || 'Team Member'} • {totalEmployeeTasks} Assigned Tasks
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2.5">
                        
                        {/* Board Search */}
                        <div className="relative min-w-[180px]">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search tasks..."
                                value={boardSearchTerm}
                                onChange={(e) => setBoardSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-lg outline-none focus:border-blue-500 text-gray-900 dark:text-white transition-all placeholder:text-gray-400"
                            />
                            {boardSearchTerm && (
                                <button onClick={() => setBoardSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                    <X size={12} />
                                </button>
                            )}
                        </div>

                        {canWrite && (
                            <>
                                <button
                                    onClick={() => setIsQuickCreateOpen(true)}
                                    className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center shadow-xs cursor-pointer"
                                >
                                    <Plus size={14} className="mr-1" /> New Task
                                </button>
                                
                                <button
                                    onClick={() => setIsAssigning(true)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center shadow-xs active:scale-95 cursor-pointer"
                                >
                                    <UserPlus size={14} className="mr-1.5" /> Assign Task
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* WORKLOAD SUMMARY STATS CARDS */}
                <div className="px-6 py-2.5 border-b border-gray-200 dark:border-gh-border bg-white dark:bg-[#0d1117]">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div className="p-2.5 rounded-lg border border-gray-200 dark:border-gh-border bg-gray-50/50 dark:bg-[#161b22]">
                            <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Assigned</div>
                            <div className="text-base font-bold text-gray-900 dark:text-white mt-0.5">{totalEmployeeTasks}</div>
                        </div>

                        <div className="p-2.5 rounded-lg border border-gray-200 dark:border-gh-border bg-gray-50/50 dark:bg-[#161b22]">
                            <div className="text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase">Completed</div>
                            <div className="text-base font-bold text-green-600 dark:text-green-400 mt-0.5 flex items-center justify-between">
                                <span>{completedCount}</span>
                                <span className="text-[10px] font-bold bg-green-100 dark:bg-green-950 px-1 rounded">{completionPercentage}%</span>
                            </div>
                        </div>

                        <div className="p-2.5 rounded-lg border border-gray-200 dark:border-gh-border bg-gray-50/50 dark:bg-[#161b22]">
                            <div className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase">In Progress</div>
                            <div className="text-base font-bold text-blue-600 dark:text-blue-400 mt-0.5">{inProgressCount}</div>
                        </div>

                        <div className="p-2.5 rounded-lg border border-gray-200 dark:border-gh-border bg-gray-50/50 dark:bg-[#161b22]">
                            <div className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 uppercase">On Hold</div>
                            <div className="text-base font-bold text-orange-600 dark:text-orange-400 mt-0.5">{onHoldCount}</div>
                        </div>

                        <div className="p-2.5 rounded-lg border border-gray-200 dark:border-gh-border bg-gray-50/50 dark:bg-[#161b22] col-span-2 sm:col-span-1">
                            <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase">Overdue</div>
                            <div className={`text-base font-bold mt-0.5 ${overdueCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500'}`}>
                                {overdueCount}
                            </div>
                        </div>
                    </div>
                </div>

                {/* KANBAN COLUMNS BOARD */}
                <div className="flex-1 overflow-x-auto p-5 bg-[#f9fafb] dark:bg-gh-bg">
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 h-full items-start min-w-[1000px]">
                        {columns.map(col => {
                            const columnTasks = employeeTasks.filter(t => t.status?.toLowerCase() === col.id);

                            return (
                                <div
                                    key={col.id}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => handleCardDrop(e, col.id)}
                                    className="bg-gray-100/70 dark:bg-[#161b22]/70 border border-gray-200 dark:border-gh-border rounded-xl flex flex-col max-h-full overflow-hidden shadow-2xs"
                                >
                                    {/* Column Header */}
                                    <div className="px-3.5 py-2.5 border-b border-gray-200 dark:border-gh-border/60 flex items-center justify-between bg-white dark:bg-[#161b22]">
                                        <div className="flex items-center space-x-2">
                                            <span className={`w-2.5 h-2.5 rounded-full ${col.accent}`}></span>
                                            <span className="font-bold text-xs text-gray-800 dark:text-gray-200 capitalize">{col.title}</span>
                                            <span className="text-[10px] font-bold text-gray-500 bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">
                                                {columnTasks.length}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Column Cards Container */}
                                    <div className="p-3 flex-1 overflow-y-auto space-y-3 min-h-[350px]">
                                        {columnTasks.length === 0 ? (
                                            <div className="h-32 flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg text-xs text-gray-400 italic">
                                                No tasks in {col.title}
                                            </div>
                                        ) : (
                                            columnTasks.map(task => {
                                                const overdue = isTaskOverdue(task);

                                                return (
                                                    <div
                                                        key={task.id}
                                                        draggable={canDragAndDrop}
                                                        onDragStart={(e) => handleCardDragStart(e, task.id)}
                                                        onClick={() => setSelectedTaskForDetails(task)}
                                                        className={`p-3.5 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg shadow-xs hover:shadow-md hover:border-blue-400 dark:hover:border-blue-600 transition-all group relative text-left ${canDragAndDrop ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                                                    >
                                                        {/* Top Row: Category Tag & Code */}
                                                        <div className="flex items-center justify-between text-[10px] text-gray-400 mb-2">
                                                            <span className="font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded truncate max-w-[120px]">
                                                                {task.categoryName}
                                                            </span>
                                                            <span className="font-mono">{task.task_code || task.id}</span>
                                                        </div>

                                                        {/* Task Name */}
                                                        <h4 className="font-semibold text-xs text-gray-900 dark:text-gray-100 leading-snug mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                            {task.name}
                                                        </h4>

                                                        {/* Meta Details */}
                                                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gh-border/40 text-[11px]">
                                                            <div className="flex items-center space-x-1.5">
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${getPriorityColor(task.priority)}`}>
                                                                    {task.priority}
                                                                </span>
                                                                {overdue && (
                                                                    <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/80 px-1 rounded">
                                                                        Overdue
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="text-[10px] text-gray-400 font-medium">
                                                                Due: {task.dueDate || '-'}
                                                            </div>
                                                        </div>

                                                        {/* Hover Unassign Action (Admin/PM) */}
                                                        {isUserAdmin && canWrite && (
                                                            <button
                                                                onClick={(e) => handleUnassignTaskClick(e, task)}
                                                                className="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 p-1 bg-red-100 dark:bg-red-950 hover:bg-red-200 dark:hover:bg-red-900 text-red-600 dark:text-red-300 rounded-full transition-opacity shadow-xs z-10 border border-white dark:border-gh-border cursor-pointer"
                                                                title="Unassign Task"
                                                            >
                                                                <X size={11} />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* UNASSIGNED POOL SLIDE-OVER DRAWER */}
            {isAssigning && (
                <div className="fixed inset-0 z-[150] overflow-hidden">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity anim-fade-in" onClick={() => setIsAssigning(false)}></div>

                    <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
                        <div className="w-screen max-w-md bg-white dark:bg-[#161b22] shadow-2xl border-l border-gray-200 dark:border-gh-border flex flex-col text-left">
                            
                            <div className="px-5 py-4 border-b border-gray-200 dark:border-gh-border flex items-center justify-between bg-gray-50 dark:bg-[#0d1117]">
                                <div>
                                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">Unassigned Task Pool</h2>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Assign tasks to <b>{selectedEmployee.name}</b></p>
                                </div>
                                <button onClick={() => setIsAssigning(false)} className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {unassignedTasks.length > 0 ? unassignedTasks.map(task => (
                                    <div key={task.id} className="p-3.5 border border-gray-200 dark:border-gh-border rounded-lg bg-gray-50/50 dark:bg-[#0d1117] hover:border-blue-500 transition-all text-left">
                                        <div className="flex justify-between items-start mb-1.5 text-[10px] text-gray-400">
                                            <span className="font-mono">{task.task_code || task.id}</span>
                                            <span className="font-semibold text-blue-600 dark:text-blue-400">{task.categoryName}</span>
                                        </div>
                                        <h4 className="font-semibold text-xs text-gray-900 dark:text-white mb-3">{task.name}</h4>
                                        <button
                                            onClick={() => handleAssignTask(task.id)}
                                            className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold transition-all shadow-xs cursor-pointer"
                                        >
                                            Assign to {selectedEmployee.name.split(' ')[0]}
                                        </button>
                                    </div>
                                )) : (
                                    <div className="py-20 text-center text-gray-400 dark:text-gray-500 text-xs italic">
                                        <CheckCircle className="mx-auto text-green-500 mb-2" size={32} />
                                        All tasks are currently assigned!
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* QUICK NEW TASK MODAL */}
            {isQuickCreateOpen && (
                <div className="fixed inset-0 z-[150] overflow-hidden flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setIsQuickCreateOpen(false)}></div>
                    <div className="relative w-full max-w-md bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl shadow-2xl p-5 z-10 text-left">
                        
                        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gh-border mb-4">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Create Task for {selectedEmployee.name}</h3>
                            <button onClick={() => setIsQuickCreateOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateQuickTask} className="space-y-4 text-xs">
                            <div>
                                <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px]">Task Title</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Enter task name..."
                                    value={quickTaskForm.name}
                                    onChange={(e) => setQuickTaskForm({ ...quickTaskForm, name: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white outline-none focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px]">Category List</label>
                                <select
                                    value={quickTaskForm.category_id}
                                    onChange={(e) => setQuickTaskForm({ ...quickTaskForm, category_id: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white outline-none"
                                >
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.listName}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px]">Initial Status</label>
                                    <select
                                        value={quickTaskForm.status}
                                        onChange={(e) => setQuickTaskForm({ ...quickTaskForm, status: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white outline-none capitalize"
                                    >
                                        {columns.map(col => (
                                            <option key={col.id} value={col.id}>{col.title}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px]">Priority</label>
                                    <select
                                        value={quickTaskForm.priority}
                                        onChange={(e) => setQuickTaskForm({ ...quickTaskForm, priority: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white outline-none"
                                    >
                                        {priorityOptions.map(opt => (
                                            <option key={opt.label} value={opt.label}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px]">Start Date</label>
                                    <CustomDatePicker
                                        value={quickTaskForm.startDate}
                                        onChange={(e) => setQuickTaskForm({ ...quickTaskForm, startDate: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px]">Due Date</label>
                                    <CustomDatePicker
                                        value={quickTaskForm.dueDate}
                                        onChange={(e) => setQuickTaskForm({ ...quickTaskForm, dueDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="pt-3 border-t border-gray-200 dark:border-gh-border flex justify-end space-x-2">
                                <button
                                    type="button"
                                    onClick={() => setIsQuickCreateOpen(false)}
                                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs"
                                >
                                    Create Task
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* TASK DETAILS SLIDE-OVER DRAWER */}
            {selectedTaskForDetails && (
                <div className="fixed inset-0 z-[150] overflow-hidden">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity anim-fade-in" onClick={() => setSelectedTaskForDetails(null)}></div>

                    <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
                        <div className="w-screen max-w-md bg-white dark:bg-[#161b22] shadow-2xl border-l border-gray-200 dark:border-gh-border flex flex-col text-left">
                            
                            {/* Header */}
                            <div className="px-5 py-4 border-b border-gray-200 dark:border-gh-border flex items-center justify-between bg-gray-50 dark:bg-[#0d1117]">
                                <div className="flex items-center space-x-2">
                                    <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                                        {selectedTaskForDetails.task_code || selectedTaskForDetails.id}
                                    </span>
                                    <span className="text-gray-300 dark:text-gray-600">|</span>
                                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                        {selectedTaskForDetails.categoryName || 'Task Details'}
                                    </span>
                                </div>
                                <button onClick={() => setSelectedTaskForDetails(null)} className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
                                <div>
                                    <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px]">Task Title</label>
                                    <input
                                        type="text"
                                        value={selectedTaskForDetails.name || ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setSelectedTaskForDetails(prev => ({ ...prev, name: val }));
                                            handleSaveTaskField(selectedTaskForDetails.id, 'name', val);
                                        }}
                                        className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px]">Status</label>
                                        <select
                                            value={selectedTaskForDetails.status || 'open'}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setSelectedTaskForDetails(prev => ({ ...prev, status: val }));
                                                handleSaveTaskField(selectedTaskForDetails.id, 'status', val);
                                            }}
                                            className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg px-3 py-2 text-xs font-semibold capitalize text-gray-900 dark:text-white outline-none"
                                        >
                                            {columns.map(col => (
                                                <option key={col.id} value={col.id}>{col.title}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px]">Priority</label>
                                        <select
                                            value={selectedTaskForDetails.priority || 'Medium'}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setSelectedTaskForDetails(prev => ({ ...prev, priority: val }));
                                                handleSaveTaskField(selectedTaskForDetails.id, 'priority', val);
                                            }}
                                            className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg px-3 py-2 text-xs font-semibold text-gray-900 dark:text-white outline-none"
                                        >
                                            {priorityOptions.map(opt => (
                                                <option key={opt.label} value={opt.label}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px]">Start Date</label>
                                        <CustomDatePicker
                                            value={selectedTaskForDetails.startDate || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setSelectedTaskForDetails(prev => ({ ...prev, startDate: val }));
                                                handleSaveTaskField(selectedTaskForDetails.id, 'startDate', val);
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px]">Due Date</label>
                                        <CustomDatePicker
                                            value={selectedTaskForDetails.dueDate || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setSelectedTaskForDetails(prev => ({ ...prev, dueDate: val }));
                                                handleSaveTaskField(selectedTaskForDetails.id, 'dueDate', val);
                                            }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px]">Duration</label>
                                    <div className="p-2.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg text-gray-700 dark:text-gray-300 font-semibold">
                                        {getDurationText(selectedTaskForDetails.startDate, selectedTaskForDetails.dueDate)}
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-gray-200 dark:border-gh-border bg-gray-50 dark:bg-[#0d1117] flex justify-end">
                                <button
                                    onClick={() => setSelectedTaskForDetails(null)}
                                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                                >
                                    Done
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default WIP;
