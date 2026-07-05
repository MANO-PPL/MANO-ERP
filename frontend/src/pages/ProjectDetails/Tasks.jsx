import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, AlignLeft, Zap, Filter, Search, Plus, Pencil, Trash2, X, Check, GripVertical } from 'lucide-react';
import CustomDatePicker from '../../components/CustomDatePicker';
import { tasksApi } from '../../services/tasksApi';
import { projectApi } from '../../services/projectApi';
import { toast } from 'react-toastify';
import PageSkeleton from '../../components/PageSkeleton';

const Tasks = ({ setExtraBreadcrumbs, projectPermissions, isAdmin }) => {
    const { id: projectId } = useParams();
    const canWrite = isAdmin || (projectPermissions && projectPermissions['Tasks'] >= 2);

    useEffect(() => {
        setExtraBreadcrumbs([{ label: 'Tasks' }]);
    }, [setExtraBreadcrumbs]);

    const [searchParams, setSearchParams] = useSearchParams();
    const statusFilter = searchParams.get('status') || 'All';
    const priorityFilter = searchParams.get('priority') || 'All';

    const setStatusFilter = (status) => {
        const newParams = new URLSearchParams(searchParams);
        if (status === 'All') newParams.delete('status');
        else newParams.set('status', status);
        setSearchParams(newParams);
    };

    const setPriorityFilter = (priority) => {
        const newParams = new URLSearchParams(searchParams);
        if (priority === 'All') newParams.delete('priority');
        else newParams.set('priority', priority);
        setSearchParams(newParams);
    };

    const [taskData, setTaskData] = useState([]);
    const [projectMembers, setProjectMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedLists, setExpandedLists] = useState({});
    
    const [addingTaskInList, setAddingTaskInList] = useState(null); // categoryName
    const [editingCategory, setEditingCategory] = useState(null); // { id, name }
    const [editingTaskName, setEditingTaskName] = useState(null); // { id, name }
    const [activeToolbarDropdown, setActiveToolbarDropdown] = useState(null);
    const [activeDropdown, setActiveDropdown] = useState(null); // { taskId, field }
    const [newTask, setNewTask] = useState({
        name: '',
        status: 'open',
        startDate: '',
        dueDate: '',
        priority: 'Medium'
    });

    const [hoveredRow, setHoveredRow] = useState(null); // { groupIdx, taskIdx }
    const [hoveredCategory, setHoveredCategory] = useState(null); // categoryId
    
    // Drag and Drop State
    const [draggedItem, setDraggedItem] = useState(null); // { groupIdx, taskIdx }

    const statusOptions = [
        { label: 'open', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800/60 dark:text-gray-400' },
        { label: 'in progress', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
        { label: 'on hold', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
        { label: 'completed', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
        { label: 'cancelled', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' }
    ];

    const priorityOptions = [
        { label: 'High', color: 'text-red-600 dark:text-red-500' },
        { label: 'Medium', color: 'text-orange-600 dark:text-orange-500' },
        { label: 'Low', color: 'text-green-600 dark:text-green-500' },
        { label: 'None', color: 'text-gray-400 dark:text-gray-500' }
    ];

    // Global listener to close dropdowns on outer click
    useEffect(() => {
        const handleGlobalClick = () => {
            setActiveDropdown(null);
            setActiveToolbarDropdown(null);
        };
        document.addEventListener('click', handleGlobalClick);
        return () => document.removeEventListener('click', handleGlobalClick);
    }, []);

    const getStatusColor = (status) => {
        const found = statusOptions.find(opt => opt.label.toLowerCase() === status?.toLowerCase());
        return found ? found.color : 'bg-gray-100 text-gray-800 dark:bg-gray-800/60 dark:text-gray-400';
    };

    const getPriorityColor = (priority) => {
        const found = priorityOptions.find(opt => opt.label.toLowerCase() === priority?.toLowerCase());
        return found ? found.color : 'text-gray-400 dark:text-gray-500';
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

    const fetchTasks = async () => {
        try {
            const res = await tasksApi.getTasks(projectId);
            if (res.success) {
                setTaskData(res.categories);
                // Expand all categories by default on initial load
                const expanded = {};
                res.categories.forEach(c => {
                    expanded[c.listName] = true;
                });
                setExpandedLists(prev => ({ ...expanded, ...prev }));
            }
        } catch (err) {
            console.error("Failed to load tasks:", err);
            toast.error("Failed to load tasks");
        }
    };

    const fetchProjectMembers = async () => {
        try {
            const res = await projectApi.getProjectMembers(projectId);
            if (res.success) {
                setProjectMembers(res.members);
            }
        } catch (err) {
            console.error("Failed to load project members:", err);
        }
    };

    const initializeData = async () => {
        setLoading(true);
        await Promise.all([fetchTasks(), fetchProjectMembers()]);
        setLoading(false);
    };

    useEffect(() => {
        initializeData();
    }, [projectId]);

    const toggleList = (listName) => {
        setExpandedLists(prev => ({
            ...prev,
            [listName]: !prev[listName]
        }));
    };

    const handleAddTaskClick = (listName) => {
        setAddingTaskInList(listName);
        setNewTask({
            name: '',
            status: 'open',
            startDate: new Date().toISOString().split('T')[0],
            dueDate: new Date().toISOString().split('T')[0],
            priority: 'Medium'
        });
    };

    // OPTIMISTIC TASK CREATION
    const handleSaveTask = async (categoryId) => {
        if (!newTask.name.trim()) {
            return toast.error('Task name is required');
        }

        const previousTaskData = JSON.parse(JSON.stringify(taskData));
        const tempId = `temp-${Date.now()}`;
        
        let calculatedDurationVal = null;
        if (newTask.startDate && newTask.dueDate) {
            const start = new Date(newTask.startDate);
            const end = new Date(newTask.dueDate);
            if (end >= start) {
                calculatedDurationVal = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            }
        }

        const tempTask = {
            id: tempId,
            task_code: 'T-New',
            name: newTask.name,
            owner: 'Nice Bike',
            status: newTask.status,
            startDate: newTask.startDate || '',
            dueDate: newTask.dueDate || '',
            duration: calculatedDurationVal ? `${calculatedDurationVal} days` : 'Auto',
            priority: newTask.priority,
            assigneeIds: []
        };

        // Update state optimistically
        setTaskData(currentData => currentData.map(group => {
            if (group.id === categoryId) {
                return {
                    ...group,
                    tasks: [...group.tasks, tempTask]
                };
            }
            return group;
        }));
        setAddingTaskInList(null);

        try {
            const res = await tasksApi.createTask(projectId, {
                category_id: categoryId,
                name: newTask.name,
                status: newTask.status,
                priority: newTask.priority,
                start_date: newTask.startDate || null,
                due_date: newTask.dueDate || null,
                duration: calculatedDurationVal
            });

            if (res.success) {
                // Replace temp task with server task
                setTaskData(currentData => currentData.map(group => {
                    if (group.id === categoryId) {
                        return {
                            ...group,
                            tasks: group.tasks.map(t => t.id === tempId ? res.task : t)
                        };
                    }
                    return group;
                }));
            }
        } catch (err) {
            console.error("Failed to create task:", err);
            toast.error("Failed to create task. Reverting changes.");
            setTaskData(previousTaskData);
        }
    };

    const handleOptionSelect = (taskId, type, value) => {
        handleSaveTaskField(taskId, type, value);
        setActiveDropdown(null);
    };

    // OPTIMISTIC TASK UPDATE (INLINE AUTO-SAVE)
    const handleSaveTaskField = async (taskId, field, value) => {
        let foundTask = null;
        let categoryIdx = -1;
        let taskIdx = -1;

        taskData.forEach((cat, cIdx) => {
            const tIdx = cat.tasks.findIndex(t => t.id === taskId);
            if (tIdx > -1) {
                foundTask = cat.tasks[tIdx];
                categoryIdx = cIdx;
                taskIdx = tIdx;
            }
        });

        if (!foundTask) return;

        // Check if value actually changed
        if (foundTask[field] === value) return;

        const previousTaskData = JSON.parse(JSON.stringify(taskData));

        // Update locally first
        const updatedData = [...taskData];
        const taskToUpdate = { ...updatedData[categoryIdx].tasks[taskIdx] };
        taskToUpdate[field] = value;

        // Recalculate duration if date fields changed
        if (field === 'startDate' || field === 'dueDate') {
            taskToUpdate.duration = getDurationText(taskToUpdate.startDate, taskToUpdate.dueDate);
        }

        updatedData[categoryIdx].tasks[taskIdx] = taskToUpdate;
        setTaskData(updatedData);

        try {
            let payloadField = field;
            if (field === 'startDate') payloadField = 'start_date';
            if (field === 'dueDate') payloadField = 'due_date';

            let durationVal = undefined;
            if (field === 'startDate' || field === 'dueDate') {
                if (taskToUpdate.startDate && taskToUpdate.dueDate) {
                    const s = new Date(taskToUpdate.startDate);
                    const d = new Date(taskToUpdate.dueDate);
                    if (d >= s) {
                        durationVal = Math.ceil((d - s) / (1000 * 60 * 60 * 24)) + 1;
                    }
                }
            }

            const apiPayload = {
                [payloadField]: value || null
            };
            if (durationVal !== undefined) {
                apiPayload.duration = durationVal;
            }

            await tasksApi.updateTask(projectId, taskId, apiPayload);
        } catch (err) {
            console.error("Failed to save field:", err);
            toast.error("Failed to save update. Reverting.");
            setTaskData(previousTaskData);
        }
    };

    // OPTIMISTIC TASK DELETE
    const handleDeleteTask = async (taskId) => {
        if (!window.confirm('Are you sure you want to delete this task?')) return;
        
        const previousTaskData = JSON.parse(JSON.stringify(taskData));

        // Remove locally
        setTaskData(currentData => currentData.map(group => ({
            ...group,
            tasks: group.tasks.filter(t => t.id !== taskId)
        })));

        try {
            await tasksApi.deleteTask(projectId, taskId);
            toast.success('Task deleted');
        } catch (err) {
            toast.error('Failed to delete task. Reverting.');
            setTaskData(previousTaskData);
        }
    };

    // OPTIMISTIC CATEGORY LIST CREATION
    const handleAddHeading = async () => {
        const previousTaskData = JSON.parse(JSON.stringify(taskData));
        const tempId = `temp-${Date.now()}`;
        const defaultName = `New Category List`;

        const newCategory = {
            id: tempId,
            listName: defaultName,
            tasks: []
        };

        setTaskData(prev => [newCategory, ...prev]);
        setExpandedLists(prev => ({ ...prev, [defaultName]: true }));
        setEditingCategory({ id: tempId, name: defaultName });

        try {
            const res = await tasksApi.createCategory(projectId, { name: defaultName });
            if (res.success) {
                // Swap temp id with server id
                setTaskData(currentData => currentData.map(c => c.id === tempId ? { ...c, id: res.category.id } : c));
                setEditingCategory({ id: res.category.id, name: defaultName });
            }
        } catch (err) {
            toast.error('Failed to create category. Reverting.');
            setTaskData(previousTaskData);
        }
    };

    // OPTIMISTIC CATEGORY LIST RENAME
    const handleSaveCategoryName = async () => {
        if (!editingCategory || !editingCategory.name.trim()) {
            setEditingCategory(null);
            return;
        }

        const previousTaskData = JSON.parse(JSON.stringify(taskData));
        const categoryId = editingCategory.id;
        const newName = editingCategory.name;

        // Update locally
        setTaskData(currentData => currentData.map(c => c.id === categoryId ? { ...c, listName: newName } : c));
        setEditingCategory(null);

        try {
            await tasksApi.updateCategory(projectId, categoryId, { name: newName });
        } catch (err) {
            toast.error('Failed to rename category. Reverting.');
            setTaskData(previousTaskData);
        }
    };

    // OPTIMISTIC CATEGORY LIST DELETE
    const handleDeleteCategoryClick = async (group) => {
        if (group.tasks && group.tasks.length > 0) {
            const confirm = window.confirm(`This category contains ${group.tasks.length} tasks. Deleting it will delete all tasks inside it. Are you sure you want to proceed?`);
            if (!confirm) return;
        }

        const previousTaskData = JSON.parse(JSON.stringify(taskData));

        // Delete locally
        setTaskData(currentData => currentData.filter(c => c.id !== group.id));

        try {
            await tasksApi.deleteCategory(projectId, group.id);
            toast.success('Category deleted successfully');
        } catch (err) {
            toast.error('Failed to delete category. Reverting.');
            setTaskData(previousTaskData);
        }
    };

    // DRAG AND DROP HANDLERS
    const handleDragStart = (e, groupIdx, taskIdx) => {
        setDraggedItem({ groupIdx, taskIdx });
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
    };

    const handleDragOver = (e, groupIdx, taskIdx) => {
        e.preventDefault();
    };

    const handleDrop = async (e, targetGroupIdx, targetTaskIdx) => {
        e.preventDefault();
        if (!draggedItem) return;

        const { groupIdx: sourceGroupIdx, taskIdx: sourceTaskIdx } = draggedItem;

        // If dropped on the exact same location, stop
        if (sourceGroupIdx === targetGroupIdx && sourceTaskIdx === targetTaskIdx) {
            setDraggedItem(null);
            return;
        }

        const previousTaskData = JSON.parse(JSON.stringify(taskData));
        const updatedData = [...taskData];

        // Retrieve and remove dragged task
        const [taskToMove] = updatedData[sourceGroupIdx].tasks.splice(sourceTaskIdx, 1);

        // Place inside destination category list
        updatedData[targetGroupIdx].tasks.splice(targetTaskIdx, 0, taskToMove);

        // Re-index sort order counts
        updatedData[targetGroupIdx].tasks = updatedData[targetGroupIdx].tasks.map((t, idx) => ({
            ...t,
            sort_order: (idx + 1) * 10
        }));

        if (sourceGroupIdx !== targetGroupIdx) {
            updatedData[sourceGroupIdx].tasks = updatedData[sourceGroupIdx].tasks.map((t, idx) => ({
                ...t,
                sort_order: (idx + 1) * 10
            }));
        }

        setTaskData(updatedData);
        setDraggedItem(null);

        try {
            const reorderItems = [];
            
            // Gather all sorting numbers for DB
            updatedData[targetGroupIdx].tasks.forEach(t => {
                if (t.id && !t.id.toString().startsWith('temp-')) {
                    reorderItems.push({ id: t.id, sort_order: t.sort_order });
                }
            });

            if (sourceGroupIdx !== targetGroupIdx) {
                updatedData[sourceGroupIdx].tasks.forEach(t => {
                    if (t.id && !t.id.toString().startsWith('temp-')) {
                        reorderItems.push({ id: t.id, sort_order: t.sort_order });
                    }
                });

                // Update category target in database first
                const targetCategoryId = updatedData[targetGroupIdx].id;
                await tasksApi.updateTask(projectId, taskToMove.id, { category_id: targetCategoryId });
            }

            // Sync sort orders in DB
            await tasksApi.reorder(projectId, {
                type: 'task',
                items: reorderItems
            });
        } catch (err) {
            console.error("Failed to reorder tasks:", err);
            toast.error("Failed to save drag reordering. Reverting.");
            setTaskData(previousTaskData);
        }
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
    };

    const renderTaskAssignees = (assigneeIds) => {
        if (!assigneeIds || assigneeIds.length === 0) {
            return <span className="text-[11px] text-gray-400 italic">Unassigned</span>;
        }

        const assignedUsers = projectMembers.filter(m => assigneeIds.includes(m.user_id));

        if (assignedUsers.length === 0) {
            return <span className="text-[11px] text-gray-400 italic">Unassigned</span>;
        }

        return (
            <div className="flex -space-x-1.5 overflow-hidden w-fit">
                {assignedUsers.slice(0, 3).map((user) => {
                    const initials = user.user_name
                        ? user.user_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                        : 'U';
                    return (
                        <div 
                            key={user.user_id}
                            className="w-5 h-5 rounded-full bg-blue-500 border border-white dark:border-[#0d1117] flex items-center justify-center text-[8px] font-bold text-white shadow-sm cursor-help"
                            title={user.user_name}
                        >
                            {initials}
                        </div>
                    );
                })}
                {assignedUsers.length > 3 && (
                    <div 
                        className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-800 border border-white dark:border-[#0d1117] flex items-center justify-center text-[8px] font-bold text-gray-600 dark:text-gray-400 shadow-sm"
                        title={`${assignedUsers.length - 3} more`}
                    >
                        +{assignedUsers.length - 3}
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        return <PageSkeleton variant="table" />;
    }

    const filteredTaskData = taskData.map(group => ({
        ...group,
        tasks: group.tasks.filter(task => {
            const matchesStatus = statusFilter === 'All' || task.status.toLowerCase() === statusFilter.toLowerCase();
            const matchesPriority = priorityFilter === 'All' || task.priority === priorityFilter;
            return matchesStatus && matchesPriority;
        })
    }));

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117] transition-colors h-full text-left">
            {/* Toolbar */}
            <div className="flex justify-between items-center px-5 py-2 border-b border-gray-200 dark:border-gh-border bg-[#f9fafb] dark:bg-gh-bg">
                <div className="flex items-center space-x-4">
                    {/* Status Filter */}
                    <div className="relative">
                        <div
                            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md border ${activeToolbarDropdown === 'statusFilter' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-gh-border'} bg-white dark:bg-[#161b22] text-[12px] font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:border-gray-300 dark:hover:border-gh-border-hover transition-all`}
                            onClick={(e) => { e.stopPropagation(); setActiveToolbarDropdown(activeToolbarDropdown === 'statusFilter' ? null : 'statusFilter'); }}
                        >
                            <span className="text-gray-500 dark:text-gray-400">Status:</span>
                            <span className="text-blue-600 dark:text-blue-400 capitalize">{statusFilter}</span>
                            <ChevronDown size={14} className={`text-gray-400 transition-transform ${activeToolbarDropdown === 'statusFilter' ? 'rotate-180 text-blue-500' : ''}`} />
                        </div>
                        {activeToolbarDropdown === 'statusFilter' && (
                            <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-700 rounded-md shadow-2xl py-1 z-[110] anim-fade-in flex flex-col overflow-hidden divide-y divide-gray-100 dark:divide-gray-800" onClick={(e) => e.stopPropagation()}>
                                <div className={`px-3 py-2 text-[12px] font-semibold cursor-pointer transition-colors ${statusFilter === 'All' ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-blue-600 dark:hover:text-white'}`} onClick={() => setStatusFilter('All')}>All</div>
                                {statusOptions.map(opt => (
                                    <div key={opt.label} className={`px-3 py-2 text-[12px] font-semibold cursor-pointer transition-colors ${statusFilter === opt.label ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-blue-600 dark:hover:text-white'}`} onClick={() => setStatusFilter(opt.label)}>
                                        {opt.label.charAt(0).toUpperCase() + opt.label.slice(1)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Priority Filter */}
                    <div className="relative">
                        <div
                            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md border ${activeToolbarDropdown === 'priorityFilter' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-gh-border'} bg-white dark:bg-[#161b22] text-[12px] font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:border-gray-300 dark:hover:border-gh-border-hover transition-all`}
                            onClick={(e) => { e.stopPropagation(); setActiveToolbarDropdown(activeToolbarDropdown === 'priorityFilter' ? null : 'priorityFilter'); }}
                        >
                            <span className="text-gray-500 dark:text-gray-400">Priority:</span>
                            <span className="text-blue-600 dark:text-blue-400">{priorityFilter}</span>
                            <ChevronDown size={14} className={`text-gray-400 transition-transform ${activeToolbarDropdown === 'priorityFilter' ? 'rotate-180 text-blue-500' : ''}`} />
                        </div>
                        {activeToolbarDropdown === 'priorityFilter' && (
                            <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-700 rounded-md shadow-2xl py-1 z-[110] anim-fade-in flex flex-col overflow-hidden divide-y divide-gray-100 dark:divide-gray-800" onClick={(e) => e.stopPropagation()}>
                                <div className={`px-3 py-2 text-[12px] font-semibold cursor-pointer transition-colors ${priorityFilter === 'All' ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-blue-600 dark:hover:text-white'}`} onClick={() => setPriorityFilter('All')}>All</div>
                                {priorityOptions.map(opt => (
                                    <div key={opt.label} className={`px-3 py-2 text-[12px] font-semibold cursor-pointer transition-colors ${priorityFilter === opt.label ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-blue-600 dark:hover:text-white'}`} onClick={() => setPriorityFilter(opt.label)}>
                                        {opt.label}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    {canWrite && (
                        <button
                            onClick={handleAddHeading}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-[11px] font-bold transition flex items-center shadow-lg shadow-blue-500/20 transform active:scale-95"
                        >
                            <Plus size={14} className="mr-1" /> Add Category
                        </button>
                    )}
                </div>
            </div>

            {/* Table View */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left whitespace-nowrap text-[13px] border-collapse bg-white dark:bg-[#0d1117]">
                    <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-gray-500 dark:text-gray-400 sticky top-0 z-10 border-b border-gray-200 dark:border-gh-border tracking-wide">
                        <tr>
                            <th className="px-3 py-2 w-6"></th>
                            <th className="px-4 py-3 font-semibold uppercase text-xs">ID</th>
                            <th className="px-4 py-3 font-semibold uppercase text-xs">Task Name</th>
                            <th className="px-4 py-3 font-semibold uppercase text-xs">Assignee</th>
                            <th className="px-4 py-3 font-semibold uppercase text-xs">Status</th>
                            <th className="px-4 py-3 font-semibold uppercase text-xs">Tags</th>
                            <th className="px-4 py-3 font-semibold uppercase text-xs min-w-[100px]">Start Date</th>
                            <th className="px-4 py-3 font-semibold uppercase text-xs min-w-[160px]">Due Date</th>
                            <th className="px-4 py-3 font-semibold uppercase text-xs">Duration</th>
                            <th className="px-4 py-3 font-semibold uppercase text-xs">Priority</th>
                            <th className="px-4 py-3 font-semibold uppercase text-xs text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gh-border">
                        {filteredTaskData.map((group, groupIdx) => (
                            <React.Fragment key={groupIdx}>
                                {/* Group Header */}
                                <tr 
                                    className={`border-b border-gray-200 dark:border-gh-border transition-colors ${expandedLists[group.listName] ? 'bg-blue-50/10 dark:bg-gh-bg' : 'bg-[#fcfcfc] dark:bg-[#161b22]/50'} group/cat`}
                                    onMouseEnter={() => setHoveredCategory(group.id)}
                                    onMouseLeave={() => setHoveredCategory(null)}
                                >
                                    <td colSpan={11} className="py-2 px-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                <div 
                                                    className="flex items-center space-x-2 cursor-pointer text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                                                    onClick={() => toggleList(group.listName)}
                                                >
                                                    {expandedLists[group.listName] ? (
                                                        <ChevronDown size={14} className="opacity-80 text-blue-600 dark:text-blue-400" />
                                                    ) : (
                                                        <ChevronRight size={14} className="opacity-70" />
                                                    )}
                                                </div>
                                                
                                                {editingCategory && editingCategory.id === group.id ? (
                                                    <input
                                                        type="text"
                                                        autoFocus
                                                        className="bg-white dark:bg-[#161b22] border border-blue-500 rounded-md px-2 py-0.5 text-sm outline-none dark:text-white focus:ring-2 focus:ring-blue-500/20"
                                                        value={editingCategory.name}
                                                        onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleSaveCategoryName();
                                                            else if (e.key === 'Escape') setEditingCategory(null);
                                                        }}
                                                        onBlur={handleSaveCategoryName}
                                                    />
                                                ) : (
                                                    <div className="flex items-center space-x-3">
                                                        <span 
                                                            className={`font-semibold text-sm cursor-pointer ${expandedLists[group.listName] ? 'text-blue-600 dark:text-blue-400' : ''}`}
                                                            onClick={() => toggleList(group.listName)}
                                                        >
                                                            {group.listName}
                                                        </span>
                                                        {canWrite && hoveredCategory === group.id && (
                                                            <div className="flex items-center space-x-1.5 opacity-100 transition-opacity">
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); setEditingCategory({ id: group.id, name: group.listName }); }} 
                                                                    className="p-1 text-gray-400 hover:text-blue-500 rounded transition-colors"
                                                                    title="Rename List"
                                                                >
                                                                    <Pencil size={12} />
                                                                </button>
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteCategoryClick(group); }} 
                                                                    className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                                                                    title="Delete List"
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Group Inline Actions - only visible when expanded */}
                                        {expandedLists[group.listName] && canWrite && (
                                            <div className="flex items-center space-x-3 mt-3 ml-6 text-[12px] text-gray-400 dark:text-gray-500 font-medium">
                                                <span
                                                    className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer transition-all"
                                                    onClick={() => handleAddTaskClick(group.listName)}
                                                >
                                                    Add Task
                                                </span>
                                                <span className="text-gray-300 dark:text-gray-600">|</span>
                                                <div className="flex items-center space-x-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-all">
                                                    <Zap size={12} className="text-blue-500" />
                                                    <span>Suggestions</span>
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                                
                                {/* Inline Add Task Row */}
                                {expandedLists[group.listName] && addingTaskInList === group.listName && (
                                    <tr className="bg-blue-50/20 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/30 anim-fade-in relative z-[60]">
                                        <td className="px-3 py-3 text-center">
                                            <GripVertical size={14} className="text-gray-400 dark:text-gray-600 mx-auto" />
                                        </td>
                                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">NEW</td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                autoFocus
                                                placeholder="What needs to be done?"
                                                className="w-full bg-white dark:bg-[#161b22] border border-blue-300 dark:border-blue-700 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm dark:text-white transition-all placeholder:text-gray-500"
                                                value={newTask.name}
                                                onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-xs text-gray-400 italic">Unassigned</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="relative">
                                                <div
                                                    className={`flex items-center justify-between bg-white dark:bg-[#161b22] border ${activeDropdown === 'status' ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-lg shadow-blue-500/10' : 'border-gray-200 dark:border-gh-border'} rounded-md px-3 py-1.5 text-[11px] font-bold cursor-pointer transition-all duration-200 hover:border-gray-300 dark:hover:border-gh-border-hover w-28 group`}
                                                    onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'status' ? null : 'status'); }}
                                                >
                                                    <span className="text-gray-900 dark:text-white capitalize">{newTask.status}</span>
                                                    <ChevronDown size={14} className={`text-gray-400 transition-transform ${activeDropdown === 'status' ? 'rotate-180 text-blue-500' : ''}`} />
                                                </div>

                                                {activeDropdown === 'status' && (
                                                    <div className="absolute top-full left-0 mt-1.5 w-full bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-700 rounded-md shadow-2xl py-1 z-[100] anim-fade-in divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
                                                        {statusOptions.filter(opt => ['open', 'on hold', 'cancelled'].includes(opt.label)).map(opt => (
                                                            <div
                                                                key={opt.label}
                                                                className={`px-3 py-2 text-[11px] font-bold cursor-pointer transition-colors flex items-center justify-between ${newTask.status === opt.label ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-blue-600 dark:hover:text-white'}`}
                                                                onClick={() => handleOptionSelect(null, 'status', opt.label)}
                                                            >
                                                                <span className="capitalize">{opt.label}</span>
                                                                {newTask.status === opt.label && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-400">-</td>
                                        <td className="px-4 py-3">
                                            <div className="w-32 scale-[0.9] origin-left">
                                                <CustomDatePicker
                                                    value={newTask.startDate}
                                                    onChange={(e) => setNewTask({ ...newTask, startDate: e.target.value })}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="w-32 scale-[0.9] origin-left">
                                                <CustomDatePicker
                                                    value={newTask.dueDate}
                                                    onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 font-medium">
                                            {getDurationText(newTask.startDate, newTask.dueDate)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center space-x-3">
                                                <div className="relative">
                                                    <div
                                                        className={`flex items-center justify-between bg-white dark:bg-[#161b22] border ${activeDropdown === 'priority' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-gh-border'} rounded-md px-2 py-1.5 text-[11px] font-semibold w-24 cursor-pointer transition-all duration-200 hover:border-gray-300 dark:hover:border-gh-border-hover`}
                                                        onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'priority' ? null : 'priority'); }}
                                                    >
                                                        <div className="flex items-center space-x-1.5">
                                                            {newTask.priority !== 'None' && <span className={`font-black ${newTask.priority === 'High' ? 'text-red-500' : newTask.priority === 'Medium' ? 'text-orange-500' : 'text-green-500'}`}>!</span>}
                                                            <span className="text-gray-900 dark:text-white">{newTask.priority}</span>
                                                        </div>
                                                        <ChevronDown size={14} className={`text-gray-400 transition-transform ${activeDropdown === 'priority' ? 'rotate-180 text-blue-500' : ''}`} />
                                                    </div>

                                                    {activeDropdown === 'priority' && (
                                                        <div className="absolute top-full mt-1.5 left-0 w-28 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-700 rounded-md shadow-2xl py-1 z-[100] anim-fade-in flex flex-col overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
                                                            {priorityOptions.map(opt => (
                                                                <div
                                                                    key={opt.label}
                                                                    className={`px-3 py-1.5 text-[11px] font-semibold cursor-pointer transition-colors flex items-center space-x-2 ${newTask.priority === opt.label ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-blue-600 dark:hover:text-white'}`}
                                                                    onClick={() => handleOptionSelect(null, 'priority', opt.label)}
                                                                >
                                                                    {opt.label !== 'None' && <span className={`font-black ${opt.label === 'High' ? 'text-red-500' : opt.label === 'Medium' ? 'text-orange-500' : 'text-green-500'}`}>!</span>}
                                                                    <span>{opt.label}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center space-x-1 ml-2">
                                                    <button
                                                        onClick={() => handleSaveTask(group.id)}
                                                        className="px-3 py-1 bg-blue-600 text-white rounded-md text-[11px] font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => { setAddingTaskInList(null); setActiveDropdown(null); }}
                                                        className="px-3 py-1 bg-gray-100 dark:bg-[#21262d] text-gray-600 dark:text-gray-300 rounded-md text-[11px] font-bold hover:bg-gray-200 dark:hover:bg-[#30363d] transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}

                                {/* Tasks within Group - show only if expanded */}
                                {expandedLists[group.listName] && group.tasks.map((task, taskIdx) => {
                                    const isDragged = draggedItem?.groupIdx === groupIdx && draggedItem?.taskIdx === taskIdx;
                                    const dragClass = isDragged ? 'opacity-40 bg-blue-50/10 dark:bg-white/5' : '';

                                    return (
                                        <tr
                                            key={taskIdx}
                                            draggable={canWrite}
                                            onDragStart={(e) => handleDragStart(e, groupIdx, taskIdx)}
                                            onDragOver={(e) => handleDragOver(e, groupIdx, taskIdx)}
                                            onDragEnd={handleDragEnd}
                                            onDrop={(e) => handleDrop(e, groupIdx, taskIdx)}
                                            className={`hover:bg-blue-50/5 dark:hover:bg-gh-hover/50 transition-colors group/row border-b border-gray-50 dark:border-gh-border/30 relative h-[42px] ${dragClass}`}
                                            onMouseEnter={() => setHoveredRow({ groupIdx, taskIdx })}
                                            onMouseLeave={() => setHoveredRow(null)}
                                        >
                                            <td className="px-3 py-2 text-center w-8 cursor-grab active:cursor-grabbing">
                                                <GripVertical size={14} className="text-gray-300 dark:text-gh-border group-hover/row:text-blue-500 transition-colors mx-auto" />
                                            </td>
                                            <td className="px-4 py-2 font-mono text-gray-500 dark:text-gray-400 w-16">{task.task_code || task.id}</td>
                                            
                                            {/* Task Name Cell */}
                                            <td className="px-2 py-1">
                                                {editingTaskName && editingTaskName.id === task.id ? (
                                                    <input
                                                        type="text"
                                                        autoFocus
                                                        className="bg-white dark:bg-[#161b22] border border-blue-500 rounded px-2 py-1 text-sm outline-none w-full max-w-[400px] font-medium dark:text-white"
                                                        value={editingTaskName.name}
                                                        onChange={(e) => setEditingTaskName({ ...editingTaskName, name: e.target.value })}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                handleSaveTaskField(task.id, 'name', editingTaskName.name);
                                                                setEditingTaskName(null);
                                                            } else if (e.key === 'Escape') {
                                                                setEditingTaskName(null);
                                                            }
                                                        }}
                                                        onBlur={() => {
                                                            handleSaveTaskField(task.id, 'name', editingTaskName.name);
                                                            setEditingTaskName(null);
                                                        }}
                                                    />
                                                ) : (
                                                    <div
                                                        className={`px-2 py-0.5 rounded border border-transparent transition-colors hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer flex items-center justify-between w-fit max-w-[400px] truncate group/name text-gray-900 dark:text-gray-200 font-medium`}
                                                        onClick={() => setEditingTaskName({ id: task.id, name: task.name })}
                                                    >
                                                        <span>{task.name}</span>
                                                        <Pencil size={12} className="opacity-0 group-hover/name:opacity-50 ml-2 text-gray-400 transition-opacity" />
                                                    </div>
                                                )}
                                            </td>

                                            <td className="px-4 py-2 w-28">
                                                {renderTaskAssignees(task.assigneeIds)}
                                            </td>

                                            {/* Status Badge Cell */}
                                            <td className="px-4 py-2 relative w-32">
                                                <div 
                                                    className="cursor-pointer hover:scale-[1.02] transition-transform w-fit"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveDropdown(activeDropdown?.taskId === task.id && activeDropdown?.field === 'status' ? null : { taskId: task.id, field: 'status' });
                                                    }}
                                                >
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold min-w-[90px] inline-block text-center shadow-sm capitalize ${getStatusColor(task.status)}`}>
                                                        {task.status}
                                                    </span>
                                                </div>
                                                {activeDropdown?.taskId === task.id && activeDropdown?.field === 'status' && (
                                                    <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-700 rounded-md shadow-2xl py-1 z-[100] anim-fade-in flex flex-col overflow-hidden divide-y divide-gray-100 dark:divide-gray-800" onClick={(e) => e.stopPropagation()}>
                                                        {statusOptions.filter(opt => ['open', 'on hold', 'cancelled'].includes(opt.label)).map(opt => (
                                                            <div
                                                                key={opt.label}
                                                                className="px-3 py-2 text-[12px] font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer flex items-center justify-between hover:text-blue-600 dark:hover:text-white transition-colors"
                                                                onClick={() => handleOptionSelect(task.id, 'status', opt.label)}
                                                            >
                                                                <span className="capitalize">{opt.label}</span>
                                                                {task.status === opt.label && <Check size={12} className="text-blue-500" />}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>

                                            <td className="px-4 py-2 text-gray-400 dark:text-gray-500">-</td>

                                            {/* Start Date Cell */}
                                            <td className="px-2 py-1 w-36">
                                                <div className="w-32 scale-[0.9] origin-left">
                                                    <CustomDatePicker
                                                        value={task.startDate}
                                                        onChange={(e) => handleSaveTaskField(task.id, 'startDate', e.target.value)}
                                                    />
                                                </div>
                                            </td>

                                            {/* Due Date Cell */}
                                            <td className="px-2 py-1 w-36">
                                                <div className="w-32 scale-[0.9] origin-left">
                                                    <CustomDatePicker
                                                        value={task.dueDate}
                                                        onChange={(e) => handleSaveTaskField(task.id, 'dueDate', e.target.value)}
                                                    />
                                                </div>
                                            </td>

                                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400 w-20">{task.duration}</td>

                                            {/* Priority Badge Cell */}
                                            <td className="px-4 py-2 relative w-28">
                                                <div 
                                                    className="cursor-pointer hover:scale-[1.02] transition-transform w-fit"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveDropdown(activeDropdown?.taskId === task.id && activeDropdown?.field === 'priority' ? null : { taskId: task.id, field: 'priority' });
                                                    }}
                                                >
                                                    <div className={`flex items-center space-x-1 px-2 py-1 rounded bg-transparent ${getPriorityColor(task.priority)} font-semibold`}>
                                                        {task.priority !== 'None' && <span className="font-bold">!</span>}
                                                        <span className="ml-1">{task.priority}</span>
                                                    </div>
                                                </div>
                                                {activeDropdown?.taskId === task.id && activeDropdown?.field === 'priority' && (
                                                    <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-700 rounded-md shadow-2xl py-1 z-[100] anim-fade-in flex flex-col overflow-hidden divide-y divide-gray-100 dark:divide-gray-800" onClick={(e) => e.stopPropagation()}>
                                                        {priorityOptions.map(opt => (
                                                            <div
                                                                key={opt.label}
                                                                className={`px-3 py-2 text-[12px] font-semibold ${opt.color} hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer flex items-center justify-between transition-colors`}
                                                                onClick={() => handleOptionSelect(task.id, 'priority', opt.label)}
                                                            >
                                                                <span>{opt.label}</span>
                                                                {task.priority === opt.label && <Check size={12} className="text-blue-500" />}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Action Column */}
                                            <td className="px-4 py-2 text-center w-20">
                                                {canWrite && (
                                                    <div className="flex items-center justify-center space-x-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => setEditingTaskName({ id: task.id, name: task.name })}
                                                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-all"
                                                            title="Edit Task"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                                                            title="Delete Task"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {expandedLists[group.listName] && group.tasks.length === 0 && (
                                    <tr 
                                        className="bg-white dark:bg-[#0d1117]"
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => handleDrop(e, groupIdx, 0)}
                                    >
                                        <td colSpan={11} className="py-8 text-center text-gray-400 dark:text-gray-500 text-xs italic">
                                            No tasks in this list. Drag tasks here or click 'Add Task' to get started.
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Tasks;
