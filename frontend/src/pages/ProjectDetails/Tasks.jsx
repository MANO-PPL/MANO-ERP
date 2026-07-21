import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { 
    ChevronDown, ChevronRight, Filter, Search, Plus, Pencil, Trash2, X, Check, GripVertical, 
    LayoutList, LayoutGrid, Clock, AlertCircle, CheckCircle2, UserPlus, Calendar, ArrowRight, 
    Tag, SlidersHorizontal, Layers, Sparkles, AlertTriangle, User, MoreVertical
} from 'lucide-react';
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
    const viewMode = searchParams.get('view') || 'list'; // 'list' or 'board'

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

    const setViewMode = (view) => {
        const newParams = new URLSearchParams(searchParams);
        if (view === 'list') newParams.delete('view');
        else newParams.set('view', view);
        setSearchParams(newParams);
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [quickStatFilter, setQuickStatFilter] = useState('all'); // 'all', 'completed', 'in_progress', 'high_priority', 'overdue'

    const [taskData, setTaskData] = useState([]);
    const [projectMembers, setProjectMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedLists, setExpandedLists] = useState({});
    
    const [addingTaskInList, setAddingTaskInList] = useState(null); // categoryName
    const [editingCategory, setEditingCategory] = useState(null); // { id, name }
    const [editingTaskName, setEditingTaskName] = useState(null); // { id, name }
    const [activeToolbarDropdown, setActiveToolbarDropdown] = useState(null);
    const [activeDropdown, setActiveDropdown] = useState(null); // { taskId, field }
    const [assigneePopoverTaskId, setAssigneePopoverTaskId] = useState(null);
    const [selectedTaskForDrawer, setSelectedTaskForDrawer] = useState(null);

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
    const [draggedBoardTaskId, setDraggedBoardTaskId] = useState(null);

    const statusOptions = [
        { label: 'open', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800/60 dark:text-gray-400 border border-gray-200 dark:border-gray-700' },
        { label: 'in progress', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50' },
        { label: 'on hold', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border border-orange-200 dark:border-orange-800/50' },
        { label: 'completed', color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800/50' },
        { label: 'cancelled', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800/50' }
    ];

    const priorityOptions = [
        { label: 'High', color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/40' },
        { label: 'Medium', color: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/40' },
        { label: 'Low', color: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/40' },
        { label: 'None', color: 'text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700' }
    ];

    const boardColumns = [
        { id: 'open', label: 'Open', color: 'text-gray-600 dark:text-gray-400', accent: 'bg-gray-400' },
        { id: 'in progress', label: 'In Progress', color: 'text-blue-600 dark:text-blue-400', accent: 'bg-blue-500' },
        { id: 'on hold', label: 'On Hold', color: 'text-orange-600 dark:text-orange-400', accent: 'bg-orange-500' },
        { id: 'completed', label: 'Completed', color: 'text-green-600 dark:text-green-400', accent: 'bg-green-500' },
        { id: 'cancelled', label: 'Cancelled', color: 'text-red-600 dark:text-red-400', accent: 'bg-red-500' }
    ];

    // Global listener to close dropdowns on outer click
    useEffect(() => {
        const handleGlobalClick = () => {
            setActiveDropdown(null);
            setActiveToolbarDropdown(null);
            setAssigneePopoverTaskId(null);
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

    const fetchTasks = async () => {
        try {
            const res = await tasksApi.getTasks(projectId);
            if (res.success) {
                setTaskData(res.categories);
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
                setTaskData(currentData => currentData.map(group => {
                    if (group.id === categoryId) {
                        return {
                            ...group,
                            tasks: group.tasks.map(t => t.id === tempId ? res.task : t)
                        };
                    }
                    return group;
                }));
                toast.success('Task created successfully');
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
        if (foundTask[field] === value) return;

        const previousTaskData = JSON.parse(JSON.stringify(taskData));

        const updatedData = [...taskData];
        const taskToUpdate = { ...updatedData[categoryIdx].tasks[taskIdx] };
        taskToUpdate[field] = value;

        if (field === 'startDate' || field === 'dueDate') {
            taskToUpdate.duration = getDurationText(taskToUpdate.startDate, taskToUpdate.dueDate);
        }

        updatedData[categoryIdx].tasks[taskIdx] = taskToUpdate;
        setTaskData(updatedData);

        if (selectedTaskForDrawer?.id === taskId) {
            setSelectedTaskForDrawer(prev => prev ? { ...prev, [field]: value } : null);
        }

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

    // OPTIMISTIC ASSIGNEE TOGGLE
    const handleToggleAssignee = async (taskId, memberUserId) => {
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

        const currentAssignees = foundTask.assigneeIds || [];
        const isAssigned = currentAssignees.includes(memberUserId);
        const updatedAssigneeIds = isAssigned
            ? currentAssignees.filter(id => id !== memberUserId)
            : [...currentAssignees, memberUserId];

        const previousTaskData = JSON.parse(JSON.stringify(taskData));

        const updatedData = [...taskData];
        updatedData[categoryIdx].tasks[taskIdx] = {
            ...foundTask,
            assigneeIds: updatedAssigneeIds
        };
        setTaskData(updatedData);

        if (selectedTaskForDrawer?.id === taskId) {
            setSelectedTaskForDrawer(prev => prev ? { ...prev, assigneeIds: updatedAssigneeIds } : null);
        }

        try {
            await tasksApi.updateTaskAssignees(projectId, taskId, { assigneeIds: updatedAssigneeIds });
        } catch (err) {
            console.error("Failed to update assignees:", err);
            toast.error("Failed to update assignees. Reverting.");
            setTaskData(previousTaskData);
        }
    };

    // OPTIMISTIC TASK DELETE
    const handleDeleteTask = async (taskId) => {
        if (!window.confirm('Are you sure you want to delete this task?')) return;
        
        const previousTaskData = JSON.parse(JSON.stringify(taskData));

        setTaskData(currentData => currentData.map(group => ({
            ...group,
            tasks: group.tasks.filter(t => t.id !== taskId)
        })));

        if (selectedTaskForDrawer?.id === taskId) {
            setSelectedTaskForDrawer(null);
        }

        try {
            await tasksApi.deleteTask(projectId, taskId);
            toast.success('Task deleted successfully');
        } catch (err) {
            toast.error('Failed to delete task. Reverting.');
            setTaskData(previousTaskData);
        }
    };

    // OPTIMISTIC CATEGORY CREATION
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
                setTaskData(currentData => currentData.map(c => c.id === tempId ? { ...c, id: res.category.id } : c));
                setEditingCategory({ id: res.category.id, name: defaultName });
                toast.success('Category created');
            }
        } catch (err) {
            toast.error('Failed to create category. Reverting.');
            setTaskData(previousTaskData);
        }
    };

    // OPTIMISTIC CATEGORY RENAME
    const handleSaveCategoryName = async () => {
        if (!editingCategory || !editingCategory.name.trim()) {
            setEditingCategory(null);
            return;
        }

        const previousTaskData = JSON.parse(JSON.stringify(taskData));
        const categoryId = editingCategory.id;
        const newName = editingCategory.name;

        setTaskData(currentData => currentData.map(c => c.id === categoryId ? { ...c, listName: newName } : c));
        setEditingCategory(null);

        try {
            await tasksApi.updateCategory(projectId, categoryId, { name: newName });
        } catch (err) {
            toast.error('Failed to rename category. Reverting.');
            setTaskData(previousTaskData);
        }
    };

    // OPTIMISTIC CATEGORY DELETE
    const handleDeleteCategoryClick = async (group) => {
        if (group.tasks && group.tasks.length > 0) {
            const confirm = window.confirm(`This category contains ${group.tasks.length} tasks. Deleting it will delete all tasks inside it. Are you sure you want to proceed?`);
            if (!confirm) return;
        }

        const previousTaskData = JSON.parse(JSON.stringify(taskData));

        setTaskData(currentData => currentData.filter(c => c.id !== group.id));

        try {
            await tasksApi.deleteCategory(projectId, group.id);
            toast.success('Category deleted successfully');
        } catch (err) {
            toast.error('Failed to delete category. Reverting.');
            setTaskData(previousTaskData);
        }
    };

    // LIST VIEW DRAG AND DROP HANDLERS
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

        if (sourceGroupIdx === targetGroupIdx && sourceTaskIdx === targetTaskIdx) {
            setDraggedItem(null);
            return;
        }

        const previousTaskData = JSON.parse(JSON.stringify(taskData));
        const updatedData = [...taskData];

        const [taskToMove] = updatedData[sourceGroupIdx].tasks.splice(sourceTaskIdx, 1);
        updatedData[targetGroupIdx].tasks.splice(targetTaskIdx, 0, taskToMove);

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

                const targetCategoryId = updatedData[targetGroupIdx].id;
                await tasksApi.updateTask(projectId, taskToMove.id, { category_id: targetCategoryId });
            }

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
        setDraggedBoardTaskId(null);
    };

    // KANBAN BOARD DRAG & DROP
    const handleBoardCardDragStart = (e, taskId) => {
        setDraggedBoardTaskId(taskId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', taskId);
    };

    const handleBoardColumnDrop = (e, newStatus) => {
        e.preventDefault();
        if (draggedBoardTaskId) {
            handleSaveTaskField(draggedBoardTaskId, 'status', newStatus);
            setDraggedBoardTaskId(null);
        }
    };

    const renderTaskAssignees = (taskId, assigneeIds) => {
        const assignedUsers = projectMembers.filter(m => (assigneeIds || []).includes(m.user_id));
        const isOpen = assigneePopoverTaskId === taskId;

        return (
            <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                <div 
                    className="flex items-center space-x-1 cursor-pointer group/assignee px-1 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                    onClick={() => setAssigneePopoverTaskId(isOpen ? null : taskId)}
                    title="Click to assign members"
                >
                    {assignedUsers.length > 0 ? (
                        <div className="flex -space-x-1.5 overflow-hidden">
                            {assignedUsers.slice(0, 3).map((user) => {
                                const initials = user.user_name
                                    ? user.user_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                                    : 'U';
                                return (
                                    <div 
                                        key={user.user_id}
                                        className="w-6 h-6 rounded-full bg-blue-600 border border-white dark:border-[#0d1117] flex items-center justify-center text-[9px] font-bold text-white shadow-xs"
                                        title={user.user_name}
                                    >
                                        {initials}
                                    </div>
                                );
                            })}
                            {assignedUsers.length > 3 && (
                                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-800 border border-white dark:border-[#0d1117] flex items-center justify-center text-[9px] font-bold text-gray-600 dark:text-gray-400 shadow-xs">
                                    +{assignedUsers.length - 3}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center space-x-1 text-gray-400 hover:text-blue-500 text-[11px] italic">
                            <UserPlus size={13} />
                            <span>Unassigned</span>
                        </div>
                    )}
                </div>

                {/* Assignee Popover Dropdown */}
                {isOpen && (
                    <div 
                        className="absolute top-full left-0 mt-1.5 w-60 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl py-2 z-[130] anim-fade-in text-left divide-y divide-gray-100 dark:divide-gray-800"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex justify-between items-center">
                            <span>Assign Team Members</span>
                            <button onClick={() => setAssigneePopoverTaskId(null)} className="hover:text-gray-700 dark:hover:text-white">
                                <X size={12} />
                            </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto py-1 divide-y divide-gray-50 dark:divide-gray-800/40">
                            {projectMembers.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-gray-400 italic">No members in project</div>
                            ) : (
                                projectMembers.map(member => {
                                    const isAssigned = (assigneeIds || []).includes(member.user_id);
                                    const initials = member.user_name
                                        ? member.user_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                                        : 'U';
                                    return (
                                        <div
                                            key={member.user_id}
                                            className={`px-3 py-1.5 text-xs flex items-center justify-between cursor-pointer transition-colors ${isAssigned ? 'bg-blue-50/70 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                                            onClick={() => handleToggleAssignee(taskId, member.user_id)}
                                        >
                                            <div className="flex items-center space-x-2 truncate">
                                                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[8px] font-bold text-white shrink-0">
                                                    {initials}
                                                </div>
                                                <span className="truncate">{member.user_name}</span>
                                            </div>
                                            {isAssigned && <Check size={14} className="text-blue-500 shrink-0" />}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        return <PageSkeleton variant="table" />;
    }

    // STATS CALCULATION
    const allTasks = taskData.flatMap(group => group.tasks || []);
    const totalTasksCount = allTasks.length;
    const completedTasksCount = allTasks.filter(t => t.status?.toLowerCase() === 'completed').length;
    const inProgressCount = allTasks.filter(t => t.status?.toLowerCase() === 'in progress').length;
    const highPriorityCount = allTasks.filter(t => t.priority === 'High').length;
    const overdueCount = allTasks.filter(isTaskOverdue).length;
    const completionPercentage = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

    // FILTERING LOGIC
    const filteredTaskData = taskData.map(group => {
        const matchingTasks = (group.tasks || []).filter(task => {
            const matchesStatus = statusFilter === 'All' || task.status?.toLowerCase() === statusFilter.toLowerCase();
            const matchesPriority = priorityFilter === 'All' || task.priority === priorityFilter;

            let matchesSearch = true;
            if (searchTerm.trim()) {
                const query = searchTerm.toLowerCase();
                const taskName = task.name?.toLowerCase() || '';
                const taskCode = (task.task_code || task.id || '').toString().toLowerCase();
                const catName = group.listName?.toLowerCase() || '';
                const assignedMembers = projectMembers.filter(m => (task.assigneeIds || []).includes(m.user_id));
                const assigneeNames = assignedMembers.map(m => m.user_name?.toLowerCase() || '').join(' ');
                matchesSearch = taskName.includes(query) || taskCode.includes(query) || catName.includes(query) || assigneeNames.includes(query);
            }

            let matchesQuickStat = true;
            if (quickStatFilter === 'completed') matchesQuickStat = task.status?.toLowerCase() === 'completed';
            else if (quickStatFilter === 'in_progress') matchesQuickStat = task.status?.toLowerCase() === 'in progress';
            else if (quickStatFilter === 'high_priority') matchesQuickStat = task.priority === 'High';
            else if (quickStatFilter === 'overdue') matchesQuickStat = isTaskOverdue(task);

            return matchesStatus && matchesPriority && matchesSearch && matchesQuickStat;
        });

        return {
            ...group,
            tasks: matchingTasks
        };
    });

    const flattenedFilteredTasks = filteredTaskData.flatMap(g => g.tasks.map(t => ({ ...t, categoryName: g.listName, categoryId: g.id })));

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117] transition-colors h-full text-left font-sans">
            
            {/* STATS OVERVIEW BAR */}
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gh-border bg-[#f9fafb] dark:bg-gh-bg">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    
                    {/* Total Tasks Card */}
                    <div 
                        onClick={() => { setQuickStatFilter('all'); setStatusFilter('All'); setPriorityFilter('All'); }}
                        className={`p-3 rounded-lg border transition-all cursor-pointer ${quickStatFilter === 'all' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-xs ring-1 ring-blue-500/20' : 'border-gray-200 dark:border-gh-border bg-white dark:bg-[#161b22] hover:border-gray-300 dark:hover:border-gray-700'}`}
                    >
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
                            <span>Total Tasks</span>
                            <Layers size={14} className="text-blue-500" />
                        </div>
                        <div className="mt-1.5 flex items-baseline justify-between">
                            <span className="text-xl font-bold text-gray-900 dark:text-white">{totalTasksCount}</span>
                            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{taskData.length} Lists</span>
                        </div>
                    </div>

                    {/* Completed Tasks Card */}
                    <div 
                        onClick={() => setQuickStatFilter(quickStatFilter === 'completed' ? 'all' : 'completed')}
                        className={`p-3 rounded-lg border transition-all cursor-pointer ${quickStatFilter === 'completed' ? 'border-green-500 bg-green-50/50 dark:bg-green-900/20 shadow-xs ring-1 ring-green-500/20' : 'border-gray-200 dark:border-gh-border bg-white dark:bg-[#161b22] hover:border-gray-300 dark:hover:border-gray-700'}`}
                    >
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
                            <span>Completed</span>
                            <CheckCircle2 size={14} className="text-green-500" />
                        </div>
                        <div className="mt-1.5 flex items-baseline justify-between">
                            <span className="text-xl font-bold text-green-600 dark:text-green-400">{completedTasksCount}</span>
                            <span className="text-[11px] font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-950/60 px-1.5 py-0.5 rounded">
                                {completionPercentage}%
                            </span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1 mt-2 overflow-hidden">
                            <div className="bg-green-500 h-1 rounded-full transition-all duration-500" style={{ width: `${completionPercentage}%` }}></div>
                        </div>
                    </div>

                    {/* In Progress Card */}
                    <div 
                        onClick={() => setQuickStatFilter(quickStatFilter === 'in_progress' ? 'all' : 'in_progress')}
                        className={`p-3 rounded-lg border transition-all cursor-pointer ${quickStatFilter === 'in_progress' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-xs ring-1 ring-blue-500/20' : 'border-gray-200 dark:border-gh-border bg-white dark:bg-[#161b22] hover:border-gray-300 dark:hover:border-gray-700'}`}
                    >
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
                            <span>In Progress</span>
                            <Clock size={14} className="text-blue-500" />
                        </div>
                        <div className="mt-1.5 flex items-baseline justify-between">
                            <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{inProgressCount}</span>
                            <span className="text-[10px] text-gray-400">Active</span>
                        </div>
                    </div>

                    {/* High Priority Card */}
                    <div 
                        onClick={() => setQuickStatFilter(quickStatFilter === 'high_priority' ? 'all' : 'high_priority')}
                        className={`p-3 rounded-lg border transition-all cursor-pointer ${quickStatFilter === 'high_priority' ? 'border-red-500 bg-red-50/50 dark:bg-red-900/20 shadow-xs ring-1 ring-red-500/20' : 'border-gray-200 dark:border-gh-border bg-white dark:bg-[#161b22] hover:border-gray-300 dark:hover:border-gray-700'}`}
                    >
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
                            <span>High Priority</span>
                            <AlertCircle size={14} className="text-red-500" />
                        </div>
                        <div className="mt-1.5 flex items-baseline justify-between">
                            <span className="text-xl font-bold text-red-600 dark:text-red-400">{highPriorityCount}</span>
                            <span className="text-[10px] text-red-500 font-medium">Urgent</span>
                        </div>
                    </div>

                    {/* Overdue Card */}
                    <div 
                        onClick={() => setQuickStatFilter(quickStatFilter === 'overdue' ? 'all' : 'overdue')}
                        className={`p-3 rounded-lg border transition-all cursor-pointer col-span-2 sm:col-span-1 ${quickStatFilter === 'overdue' ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-900/20 shadow-xs ring-1 ring-amber-500/20' : 'border-gray-200 dark:border-gh-border bg-white dark:bg-[#161b22] hover:border-gray-300 dark:hover:border-gray-700'}`}
                    >
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
                            <span>Overdue</span>
                            <AlertTriangle size={14} className="text-amber-500" />
                        </div>
                        <div className="mt-1.5 flex items-baseline justify-between">
                            <span className={`text-xl font-bold ${overdueCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500'}`}>{overdueCount}</span>
                            {overdueCount > 0 && <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-100 dark:bg-amber-950 px-1 rounded">Attention</span>}
                        </div>
                    </div>

                </div>
            </div>

            {/* CONTROL TOOLBAR */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-2.5 border-b border-gray-200 dark:border-gh-border bg-white dark:bg-[#0d1117] gap-3">
                
                {/* Left: View Switcher & Search */}
                <div className="flex flex-wrap items-center gap-3">
                    
                    {/* View Switcher Toggle */}
                    <div className="flex items-center bg-gray-100 dark:bg-[#161b22] p-0.5 rounded-lg border border-gray-200 dark:border-gh-border">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'list' ? 'bg-white dark:bg-[#21262d] text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                        >
                            <LayoutList size={14} />
                            <span>List View</span>
                        </button>
                        <button
                            onClick={() => setViewMode('board')}
                            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'board' ? 'bg-white dark:bg-[#21262d] text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                        >
                            <LayoutGrid size={14} />
                            <span>Board View</span>
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative min-w-[220px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search tasks, codes, assignees..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-8 py-1.5 text-xs bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-lg outline-none focus:border-blue-500 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-gray-900 dark:text-white transition-all placeholder:text-gray-400"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                <X size={13} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Right: Filters & Action Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                    
                    {/* Status Filter */}
                    <div className="relative">
                        <div
                            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border ${activeToolbarDropdown === 'statusFilter' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-gh-border'} bg-white dark:bg-[#161b22] text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 transition-all`}
                            onClick={(e) => { e.stopPropagation(); setActiveToolbarDropdown(activeToolbarDropdown === 'statusFilter' ? null : 'statusFilter'); }}
                        >
                            <span className="text-gray-400">Status:</span>
                            <span className="text-blue-600 dark:text-blue-400 capitalize">{statusFilter}</span>
                            <ChevronDown size={14} className={`text-gray-400 transition-transform ${activeToolbarDropdown === 'statusFilter' ? 'rotate-180 text-blue-500' : ''}`} />
                        </div>
                        {activeToolbarDropdown === 'statusFilter' && (
                            <div className="absolute top-full right-0 mt-1 w-44 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl py-1 z-[110] anim-fade-in flex flex-col overflow-hidden divide-y divide-gray-100 dark:divide-gray-800" onClick={(e) => e.stopPropagation()}>
                                <div className={`px-3 py-2 text-xs font-semibold cursor-pointer transition-colors ${statusFilter === 'All' ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`} onClick={() => setStatusFilter('All')}>All Statuses</div>
                                {statusOptions.map(opt => (
                                    <div key={opt.label} className={`px-3 py-2 text-xs font-semibold cursor-pointer transition-colors capitalize ${statusFilter === opt.label ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`} onClick={() => setStatusFilter(opt.label)}>
                                        {opt.label}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Priority Filter */}
                    <div className="relative">
                        <div
                            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border ${activeToolbarDropdown === 'priorityFilter' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-gh-border'} bg-white dark:bg-[#161b22] text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 transition-all`}
                            onClick={(e) => { e.stopPropagation(); setActiveToolbarDropdown(activeToolbarDropdown === 'priorityFilter' ? null : 'priorityFilter'); }}
                        >
                            <span className="text-gray-400">Priority:</span>
                            <span className="text-blue-600 dark:text-blue-400">{priorityFilter}</span>
                            <ChevronDown size={14} className={`text-gray-400 transition-transform ${activeToolbarDropdown === 'priorityFilter' ? 'rotate-180 text-blue-500' : ''}`} />
                        </div>
                        {activeToolbarDropdown === 'priorityFilter' && (
                            <div className="absolute top-full right-0 mt-1 w-40 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl py-1 z-[110] anim-fade-in flex flex-col overflow-hidden divide-y divide-gray-100 dark:divide-gray-800" onClick={(e) => e.stopPropagation()}>
                                <div className={`px-3 py-2 text-xs font-semibold cursor-pointer transition-colors ${priorityFilter === 'All' ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`} onClick={() => setPriorityFilter('All')}>All Priorities</div>
                                {priorityOptions.map(opt => (
                                    <div key={opt.label} className={`px-3 py-2 text-xs font-semibold cursor-pointer transition-colors ${priorityFilter === opt.label ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`} onClick={() => setPriorityFilter(opt.label)}>
                                        {opt.label}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Clear Filters indicator */}
                    {(statusFilter !== 'All' || priorityFilter !== 'All' || searchTerm || quickStatFilter !== 'all') && (
                        <button
                            onClick={() => { setStatusFilter('All'); setPriorityFilter('All'); setSearchTerm(''); setQuickStatFilter('all'); }}
                            className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 font-medium underline cursor-pointer"
                        >
                            Reset Filters
                        </button>
                    )}

                    {/* Add Category Button */}
                    {canWrite && (
                        <button
                            onClick={handleAddHeading}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center shadow-xs active:scale-95 cursor-pointer"
                        >
                            <Plus size={14} className="mr-1" /> Add Category
                        </button>
                    )}
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 overflow-auto">
                {viewMode === 'list' ? (
                    
                    /* LIST / TABLE VIEW */
                    <table className="w-full text-left whitespace-nowrap text-xs border-collapse bg-white dark:bg-[#0d1117]">
                        <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-gray-500 dark:text-gray-400 sticky top-0 z-10 border-b border-gray-200 dark:border-gh-border tracking-wide font-semibold">
                            <tr>
                                <th className="px-3 py-2.5 w-6"></th>
                                <th className="px-4 py-2.5 uppercase text-[10px] tracking-wider">ID</th>
                                <th className="px-4 py-2.5 uppercase text-[10px] tracking-wider min-w-[220px]">Task Name</th>
                                <th className="px-4 py-2.5 uppercase text-[10px] tracking-wider min-w-[130px]">Assignee</th>
                                <th className="px-4 py-2.5 uppercase text-[10px] tracking-wider">Status</th>
                                <th className="px-4 py-2.5 uppercase text-[10px] tracking-wider min-w-[110px]">Start Date</th>
                                <th className="px-4 py-2.5 uppercase text-[10px] tracking-wider min-w-[160px]">Due Date</th>
                                <th className="px-4 py-2.5 uppercase text-[10px] tracking-wider">Duration</th>
                                <th className="px-4 py-2.5 uppercase text-[10px] tracking-wider">Priority</th>
                                <th className="px-4 py-2.5 uppercase text-[10px] tracking-wider text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gh-border/50">
                            {filteredTaskData.map((group, groupIdx) => {
                                const totalGroupTasks = group.tasks.length;
                                const completedGroupTasks = group.tasks.filter(t => t.status?.toLowerCase() === 'completed').length;
                                const isExpanded = expandedLists[group.listName];

                                return (
                                    <React.Fragment key={groupIdx}>
                                        {/* Group Header Row */}
                                        <tr 
                                            className={`border-b border-gray-200 dark:border-gh-border transition-colors ${isExpanded ? 'bg-blue-50/20 dark:bg-[#161b22]/70' : 'bg-[#fcfcfc] dark:bg-[#161b22]/30'} group/cat`}
                                            onMouseEnter={() => setHoveredCategory(group.id)}
                                            onMouseLeave={() => setHoveredCategory(null)}
                                        >
                                            <td colSpan={10} className="py-2.5 px-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-3">
                                                        <div 
                                                            className="flex items-center space-x-2 cursor-pointer text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                                                            onClick={() => toggleList(group.listName)}
                                                        >
                                                            {isExpanded ? (
                                                                <ChevronDown size={15} className="text-blue-600 dark:text-blue-400" />
                                                            ) : (
                                                                <ChevronRight size={15} className="text-gray-400" />
                                                            )}
                                                        </div>
                                                        
                                                        {editingCategory && editingCategory.id === group.id ? (
                                                            <input
                                                                type="text"
                                                                autoFocus
                                                                className="bg-white dark:bg-[#161b22] border border-blue-500 rounded px-2 py-0.5 text-xs outline-none dark:text-white focus:ring-2 focus:ring-blue-500/20"
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
                                                                    className={`font-semibold text-xs cursor-pointer ${isExpanded ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}
                                                                    onClick={() => toggleList(group.listName)}
                                                                >
                                                                    {group.listName}
                                                                </span>
                                                                
                                                                {/* Category Progress Pill */}
                                                                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700">
                                                                    {completedGroupTasks}/{totalGroupTasks} Completed
                                                                </span>

                                                                {canWrite && hoveredCategory === group.id && (
                                                                    <div className="flex items-center space-x-1 opacity-100 transition-opacity">
                                                                        <button 
                                                                            onClick={(e) => { e.stopPropagation(); setEditingCategory({ id: group.id, name: group.listName }); }} 
                                                                            className="p-1 text-gray-400 hover:text-blue-500 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                                                            title="Rename Category"
                                                                        >
                                                                            <Pencil size={12} />
                                                                        </button>
                                                                        <button 
                                                                            onClick={(e) => { e.stopPropagation(); handleDeleteCategoryClick(group); }} 
                                                                            className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                                                            title="Delete Category"
                                                                        >
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Right Add Task Inline */}
                                                    {isExpanded && canWrite && (
                                                        <button
                                                            onClick={() => handleAddTaskClick(group.listName)}
                                                            className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center space-x-1 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all cursor-pointer"
                                                        >
                                                            <Plus size={13} />
                                                            <span>Add Task</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        
                                        {/* Inline Add Task Inputs */}
                                        {isExpanded && addingTaskInList === group.listName && (
                                            <tr className="bg-blue-50/30 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-900/40 anim-fade-in relative z-[60]">
                                                <td className="px-3 py-2.5 text-center">
                                                    <GripVertical size={14} className="text-gray-400 dark:text-gray-600 mx-auto" />
                                                </td>
                                                <td className="px-4 py-2.5 text-gray-400 font-mono text-[11px]">NEW</td>
                                                <td className="px-4 py-2.5">
                                                    <input
                                                        type="text"
                                                        autoFocus
                                                        placeholder="Task description..."
                                                        className="w-full bg-white dark:bg-[#161b22] border border-blue-400 dark:border-blue-700 rounded-md px-2.5 py-1 text-xs focus:ring-2 focus:ring-blue-500 outline-none shadow-xs dark:text-white transition-all placeholder:text-gray-400"
                                                        value={newTask.name}
                                                        onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleSaveTask(group.id);
                                                            else if (e.key === 'Escape') setAddingTaskInList(null);
                                                        }}
                                                    />
                                                </td>
                                                <td className="px-4 py-2.5 text-gray-400 italic text-[11px]">Unassigned</td>
                                                <td className="px-4 py-2.5">
                                                    <select
                                                        value={newTask.status}
                                                        onChange={(e) => setNewTask({ ...newTask, status: e.target.value })}
                                                        className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-md px-2 py-1 text-xs capitalize text-gray-900 dark:text-white outline-none"
                                                    >
                                                        {statusOptions.map(opt => (
                                                            <option key={opt.label} value={opt.label}>{opt.label}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <div className="w-[135px]">
                                                        <CustomDatePicker
                                                            value={newTask.startDate}
                                                            onChange={(e) => setNewTask({ ...newTask, startDate: e.target.value })}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <div className="w-[135px]">
                                                        <CustomDatePicker
                                                            value={newTask.dueDate}
                                                            onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5 text-gray-500 font-medium">
                                                    {getDurationText(newTask.startDate, newTask.dueDate)}
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <select
                                                        value={newTask.priority}
                                                        onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                                                        className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-md px-2 py-1 text-xs text-gray-900 dark:text-white outline-none"
                                                    >
                                                        {priorityOptions.map(opt => (
                                                            <option key={opt.label} value={opt.label}>{opt.label}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-4 py-2.5 text-center">
                                                    <div className="flex items-center justify-center space-x-1.5">
                                                        <button
                                                            onClick={() => handleSaveTask(group.id)}
                                                            className="px-2.5 py-1 bg-blue-600 text-white rounded text-[11px] font-bold hover:bg-blue-700 transition-all cursor-pointer"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={() => setAddingTaskInList(null)}
                                                            className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded text-[11px] font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}

                                        {/* Tasks in List */}
                                        {isExpanded && group.tasks.map((task, taskIdx) => {
                                            const isDragged = draggedItem?.groupIdx === groupIdx && draggedItem?.taskIdx === taskIdx;
                                            const overdue = isTaskOverdue(task);

                                            return (
                                                <tr
                                                    key={task.id || taskIdx}
                                                    draggable={canWrite}
                                                    onDragStart={(e) => handleDragStart(e, groupIdx, taskIdx)}
                                                    onDragOver={(e) => handleDragOver(e, groupIdx, taskIdx)}
                                                    onDragEnd={handleDragEnd}
                                                    onDrop={(e) => handleDrop(e, groupIdx, taskIdx)}
                                                    className={`hover:bg-blue-50/20 dark:hover:bg-gh-hover/60 transition-colors group/row border-b border-gray-100 dark:border-gh-border/30 ${isDragged ? 'opacity-40 bg-blue-50 dark:bg-white/5' : ''}`}
                                                    onMouseEnter={() => setHoveredRow({ groupIdx, taskIdx })}
                                                    onMouseLeave={() => setHoveredRow(null)}
                                                >
                                                    {/* Drag handle */}
                                                    <td className="px-3 py-2 text-center w-8 cursor-grab active:cursor-grabbing">
                                                        <GripVertical size={14} className="text-gray-300 dark:text-gray-600 group-hover/row:text-blue-500 transition-colors mx-auto" />
                                                    </td>

                                                    {/* Task Code */}
                                                    <td className="px-4 py-2 font-mono text-[11px] text-gray-500 dark:text-gray-400 w-16">
                                                        {task.task_code || task.id}
                                                    </td>

                                                    {/* Task Name Cell */}
                                                    <td className="px-4 py-2 max-w-[320px]">
                                                        {editingTaskName && editingTaskName.id === task.id ? (
                                                            <input
                                                                type="text"
                                                                autoFocus
                                                                className="bg-white dark:bg-[#161b22] border border-blue-500 rounded px-2 py-0.5 text-xs outline-none w-full font-medium dark:text-white"
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
                                                            <div className="flex items-center space-x-2">
                                                                <span 
                                                                    className={`font-medium text-xs text-gray-900 dark:text-gray-200 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 truncate ${task.status?.toLowerCase() === 'completed' ? 'line-through opacity-60' : ''}`}
                                                                    onClick={() => setSelectedTaskForDrawer(task)}
                                                                >
                                                                    {task.name}
                                                                </span>
                                                                {canWrite && (
                                                                    <button 
                                                                        onClick={() => setEditingTaskName({ id: task.id, name: task.name })}
                                                                        className="opacity-0 group-hover/row:opacity-100 p-0.5 text-gray-400 hover:text-blue-500 rounded transition-opacity"
                                                                    >
                                                                        <Pencil size={11} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Assignees Column */}
                                                    <td className="px-4 py-2">
                                                        {renderTaskAssignees(task.id, task.assigneeIds)}
                                                    </td>

                                                    {/* Status Badge */}
                                                    <td className="px-4 py-2 relative">
                                                        <div 
                                                            className="cursor-pointer inline-block"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveDropdown(activeDropdown?.taskId === task.id && activeDropdown?.field === 'status' ? null : { taskId: task.id, field: 'status' });
                                                            }}
                                                        >
                                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block capitalize ${getStatusColor(task.status)}`}>
                                                                {task.status}
                                                            </span>
                                                        </div>

                                                        {activeDropdown?.taskId === task.id && activeDropdown?.field === 'status' && (
                                                            <div className="absolute top-full left-0 mt-1 w-36 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl py-1 z-[100] anim-fade-in flex flex-col overflow-hidden divide-y divide-gray-100 dark:divide-gray-800" onClick={(e) => e.stopPropagation()}>
                                                                {statusOptions.map(opt => (
                                                                    <div
                                                                        key={opt.label}
                                                                        className="px-3 py-1.5 text-xs font-semibold capitalize text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer flex items-center justify-between transition-colors"
                                                                        onClick={() => handleOptionSelect(task.id, 'status', opt.label)}
                                                                    >
                                                                        <span>{opt.label}</span>
                                                                        {task.status?.toLowerCase() === opt.label && <Check size={13} className="text-blue-500" />}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Start Date */}
                                                    <td className="px-4 py-1">
                                                        <div className="w-[135px]">
                                                            <CustomDatePicker
                                                                value={task.startDate}
                                                                onChange={(e) => handleSaveTaskField(task.id, 'startDate', e.target.value)}
                                                            />
                                                        </div>
                                                    </td>

                                                    {/* Due Date & Overdue Tag */}
                                                    <td className="px-4 py-1">
                                                        <div className="flex items-center space-x-1.5">
                                                            <div className="w-[135px]">
                                                                <CustomDatePicker
                                                                    value={task.dueDate}
                                                                    onChange={(e) => handleSaveTaskField(task.id, 'dueDate', e.target.value)}
                                                                />
                                                            </div>
                                                            {overdue && (
                                                                <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 px-1.5 py-0.5 rounded-full flex items-center shrink-0">
                                                                    Overdue
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Duration */}
                                                    <td className="px-4 py-2 text-gray-500 font-medium text-[11px]">
                                                        {task.duration}
                                                    </td>

                                                    {/* Priority Badge */}
                                                    <td className="px-4 py-2 relative">
                                                        <div 
                                                            className="cursor-pointer inline-block"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveDropdown(activeDropdown?.taskId === task.id && activeDropdown?.field === 'priority' ? null : { taskId: task.id, field: 'priority' });
                                                            }}
                                                        >
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getPriorityColor(task.priority)}`}>
                                                                {task.priority}
                                                            </span>
                                                        </div>

                                                        {activeDropdown?.taskId === task.id && activeDropdown?.field === 'priority' && (
                                                            <div className="absolute top-full left-0 mt-1 w-32 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl py-1 z-[100] anim-fade-in flex flex-col overflow-hidden divide-y divide-gray-100 dark:divide-gray-800" onClick={(e) => e.stopPropagation()}>
                                                                {priorityOptions.map(opt => (
                                                                    <div
                                                                        key={opt.label}
                                                                        className={`px-3 py-1.5 text-xs font-semibold ${opt.color} hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer flex items-center justify-between transition-colors`}
                                                                        onClick={() => handleOptionSelect(task.id, 'priority', opt.label)}
                                                                    >
                                                                        <span>{opt.label}</span>
                                                                        {task.priority === opt.label && <Check size={13} className="text-blue-500" />}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="px-4 py-2 text-center">
                                                        <div className="flex items-center justify-center space-x-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => setSelectedTaskForDrawer(task)}
                                                                className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-all cursor-pointer"
                                                                title="View Task Details"
                                                            >
                                                                <SlidersHorizontal size={13} />
                                                            </button>
                                                            {canWrite && (
                                                                <button
                                                                    onClick={() => handleDeleteTask(task.id)}
                                                                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all cursor-pointer"
                                                                    title="Delete Task"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {/* Empty State within Group */}
                                        {isExpanded && group.tasks.length === 0 && (
                                            <tr className="bg-white dark:bg-[#0d1117]">
                                                <td colSpan={10} className="py-6 text-center text-gray-400 dark:text-gray-500 text-xs italic">
                                                    No tasks in this list. Click 'Add Task' above to add one.
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    
                    /* KANBAN BOARD VIEW */
                    <div className="p-5 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 h-full items-start overflow-x-auto min-w-[1000px]">
                        {boardColumns.map(col => {
                            const columnTasks = flattenedFilteredTasks.filter(t => t.status?.toLowerCase() === col.id);

                            return (
                                <div
                                    key={col.id}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => handleBoardColumnDrop(e, col.id)}
                                    className="bg-gray-50/70 dark:bg-[#161b22]/60 border border-gray-200 dark:border-gh-border rounded-xl flex flex-col max-h-full overflow-hidden shadow-2xs"
                                >
                                    {/* Column Header */}
                                    <div className="px-3.5 py-3 border-b border-gray-200 dark:border-gh-border/60 flex items-center justify-between bg-white/50 dark:bg-[#161b22]/90">
                                        <div className="flex items-center space-x-2">
                                            <span className={`w-2.5 h-2.5 rounded-full ${col.accent}`}></span>
                                            <span className="font-bold text-xs text-gray-800 dark:text-gray-200">{col.label}</span>
                                            <span className="text-[10px] font-bold text-gray-500 bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">
                                                {columnTasks.length}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Cards Container */}
                                    <div className="p-3 flex-1 overflow-y-auto space-y-3 min-h-[300px]">
                                        {columnTasks.length === 0 ? (
                                            <div className="h-32 flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg text-xs text-gray-400 italic">
                                                Drop tasks here
                                            </div>
                                        ) : (
                                            columnTasks.map(task => {
                                                const overdue = isTaskOverdue(task);

                                                return (
                                                    <div
                                                        key={task.id}
                                                        draggable={canWrite}
                                                        onDragStart={(e) => handleBoardCardDragStart(e, task.id)}
                                                        onDragEnd={handleDragEnd}
                                                        onClick={() => setSelectedTaskForDrawer(task)}
                                                        className="p-3.5 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg shadow-xs hover:shadow-md hover:border-blue-400 dark:hover:border-blue-600 transition-all cursor-pointer group relative"
                                                    >
                                                        {/* Top Row: Category Tag & Task Code */}
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

                                                        {/* Bottom Row: Priority, Due Date, Assignees */}
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

                                                            {/* Assignee Avatar Stack */}
                                                            {renderTaskAssignees(task.id, task.assigneeIds)}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* TASK DETAILS SLIDE-OVER DRAWER */}
            {selectedTaskForDrawer && (
                <div className="fixed inset-0 z-[150] overflow-hidden">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity anim-fade-in"
                        onClick={() => setSelectedTaskForDrawer(null)}
                    ></div>

                    <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
                        <div className="w-screen max-w-md bg-white dark:bg-[#161b22] shadow-2xl border-l border-gray-200 dark:border-gh-border flex flex-col text-left">
                            
                            {/* Drawer Header */}
                            <div className="px-5 py-4 border-b border-gray-200 dark:border-gh-border flex items-center justify-between bg-gray-50 dark:bg-[#0d1117]">
                                <div className="flex items-center space-x-2">
                                    <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                                        {selectedTaskForDrawer.task_code || selectedTaskForDrawer.id}
                                    </span>
                                    <span className="text-gray-300 dark:text-gray-600">|</span>
                                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                        {selectedTaskForDrawer.categoryName || 'Task Details'}
                                    </span>
                                </div>
                                <button 
                                    onClick={() => setSelectedTaskForDrawer(null)}
                                    className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Drawer Body */}
                            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
                                
                                {/* Task Name Input */}
                                <div>
                                    <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px] tracking-wider">
                                        Task Title
                                    </label>
                                    <input
                                        type="text"
                                        value={selectedTaskForDrawer.name || ''}
                                        onChange={(e) => {
                                            const updatedName = e.target.value;
                                            setSelectedTaskForDrawer(prev => ({ ...prev, name: updatedName }));
                                            handleSaveTaskField(selectedTaskForDrawer.id, 'name', updatedName);
                                        }}
                                        className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                                    />
                                </div>

                                {/* Status & Priority Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    
                                    {/* Status Selector */}
                                    <div>
                                        <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px] tracking-wider">
                                            Status
                                        </label>
                                        <select
                                            value={selectedTaskForDrawer.status || 'open'}
                                            onChange={(e) => {
                                                const updatedStatus = e.target.value;
                                                setSelectedTaskForDrawer(prev => ({ ...prev, status: updatedStatus }));
                                                handleSaveTaskField(selectedTaskForDrawer.id, 'status', updatedStatus);
                                            }}
                                            className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg px-3 py-2 text-xs font-semibold capitalize text-gray-900 dark:text-white outline-none"
                                        >
                                            {statusOptions.map(opt => (
                                                <option key={opt.label} value={opt.label}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Priority Selector */}
                                    <div>
                                        <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px] tracking-wider">
                                            Priority
                                        </label>
                                        <select
                                            value={selectedTaskForDrawer.priority || 'Medium'}
                                            onChange={(e) => {
                                                const updatedPriority = e.target.value;
                                                setSelectedTaskForDrawer(prev => ({ ...prev, priority: updatedPriority }));
                                                handleSaveTaskField(selectedTaskForDrawer.id, 'priority', updatedPriority);
                                            }}
                                            className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg px-3 py-2 text-xs font-semibold text-gray-900 dark:text-white outline-none"
                                        >
                                            {priorityOptions.map(opt => (
                                                <option key={opt.label} value={opt.label}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Assignees Multi-Select */}
                                <div>
                                    <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1.5 uppercase text-[10px] tracking-wider">
                                        Assigned Team Members
                                    </label>
                                    <div className="bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                                        {projectMembers.length === 0 ? (
                                            <p className="text-gray-400 italic">No members assigned to project</p>
                                        ) : (
                                            projectMembers.map(member => {
                                                const isAssigned = (selectedTaskForDrawer.assigneeIds || []).includes(member.user_id);
                                                return (
                                                    <div 
                                                        key={member.user_id}
                                                        onClick={() => handleToggleAssignee(selectedTaskForDrawer.id, member.user_id)}
                                                        className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${isAssigned ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                                    >
                                                        <div className="flex items-center space-x-2">
                                                            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white">
                                                                {member.user_name ? member.user_name.slice(0, 2).toUpperCase() : 'U'}
                                                            </div>
                                                            <span className="font-medium text-gray-900 dark:text-gray-200">{member.user_name}</span>
                                                        </div>
                                                        {isAssigned && <Check size={14} className="text-blue-500" />}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                {/* Dates & Duration */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px] tracking-wider">
                                            Start Date
                                        </label>
                                        <CustomDatePicker
                                            value={selectedTaskForDrawer.startDate || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setSelectedTaskForDrawer(prev => ({ ...prev, startDate: val }));
                                                handleSaveTaskField(selectedTaskForDrawer.id, 'startDate', val);
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px] tracking-wider">
                                            Due Date
                                        </label>
                                        <CustomDatePicker
                                            value={selectedTaskForDrawer.dueDate || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setSelectedTaskForDrawer(prev => ({ ...prev, dueDate: val }));
                                                handleSaveTaskField(selectedTaskForDrawer.id, 'dueDate', val);
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Duration Display */}
                                <div>
                                    <label className="block text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase text-[10px] tracking-wider">
                                        Estimated Duration
                                    </label>
                                    <div className="p-2.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg text-gray-700 dark:text-gray-300 font-semibold">
                                        {getDurationText(selectedTaskForDrawer.startDate, selectedTaskForDrawer.dueDate)}
                                    </div>
                                </div>

                            </div>

                            {/* Drawer Footer */}
                            <div className="p-4 border-t border-gray-200 dark:border-gh-border bg-gray-50 dark:bg-[#0d1117] flex items-center justify-between">
                                {canWrite && (
                                    <button
                                        onClick={() => handleDeleteTask(selectedTaskForDrawer.id)}
                                        className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 flex items-center space-x-1 px-3 py-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                                    >
                                        <Trash2 size={14} />
                                        <span>Delete Task</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => setSelectedTaskForDrawer(null)}
                                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs ml-auto cursor-pointer"
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

export default Tasks;
