import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, AlignLeft, Zap, Filter, Search, Plus, Pencil, Trash2, X, Check, GripVertical } from 'lucide-react';
import CustomDatePicker from '../../components/CustomDatePicker';

const Tasks = ({ setExtraBreadcrumbs, projectPermissions, isAdmin }) => {
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

    // Initialize all as expanded by default as requested
    const [expandedLists, setExpandedLists] = useState({
        'A quick way to get started! (2)': true,
        'ok': true,
        'Basics of Tasks and Milestones (12)': true
    });
    const [addingTaskInList, setAddingTaskInList] = useState(null);
    const [activeToolbarDropdown, setActiveToolbarDropdown] = useState(null);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [newTask, setNewTask] = useState({
        name: '',
        owner: 'Nice Bike',
        status: 'ongoing',
        startDate: '',
        dueDate: '',
        priority: 'Medium'
    });

    const [editingTask, setEditingTask] = useState(null);
    const [editingTarget, setEditingTarget] = useState(null); // { groupIdx, taskIdx }
    const [hoveredRow, setHoveredRow] = useState(null); // { groupIdx, taskIdx }

    // Move taskData to state to make it dynamic
    const [taskData, setTaskData] = useState([
        {
            listName: 'A quick way to get started! (2)',
            tasks: [
                { id: 'EZ1-T16', name: 'Use E-Mail Alias to add status, tasks, forum posts, su...', owner: 'Nice Bike', status: 'Open', statusColor: 'bg-green-100 dark:bg-green-400 text-green-800 dark:text-black', startDate: '03-22-2026', dueDate: '03-24-2026', dueNotice: '(1 / day(s) to go)', duration: '3 days', priority: 'High', priorityColor: 'text-red-600 dark:text-red-500' },
                { id: 'F71-T17', name: 'Click the \'Users\' icon on the top menu to invite peopl...', owner: 'Nice Bike', status: 'Open', statusColor: 'bg-green-100 dark:bg-green-400 text-green-800 dark:text-black', startDate: '03-24-2026', dueDate: '03-26-2026', dueNotice: '(19 day(s) to go)', duration: '3 days', priority: 'Low', priorityColor: 'text-green-600 dark:text-green-500' }
            ]
        },
        {
            listName: 'ok',
            tasks: []
        },
        {
            listName: 'Basics of Tasks and Milestones (12)',
            tasks: [
                { id: 'EZ1-T3', name: 'The Start & End (Due) dates can be provided for tasks.', owner: 'Nice Bike', status: 'To be Tested', statusColor: 'bg-yellow-100 dark:bg-yellow-400 text-yellow-800 dark:text-black', startDate: '02-24-2026', dueDate: '02-26-2026', dueNotice: '(1 day(s) ago)', duration: '3 days', priority: 'Medium', priorityColor: 'text-orange-600 dark:text-orange-500' },
                { id: 'EZ1-T4', name: 'The priority level can be set for a task. The diamond-...', owner: 'Nice Bike', status: 'To be Tested', statusColor: 'bg-yellow-100 dark:bg-yellow-400 text-yellow-800 dark:text-black', startDate: '02-26-2026', dueDate: '02-28-2026', dueNotice: '(1 day(s) to go)', duration: '3 days', priority: 'High', priorityColor: 'text-red-600 dark:text-red-500' },
                { id: 'EZ1-T5', name: 'Click on the task name to see the complete details o...', owner: 'Nice Bike', status: 'In Review', statusColor: 'bg-blue-100 dark:bg-blue-400 text-blue-800 dark:text-black', startDate: '02-28-2026', dueDate: '03-02-2026', dueNotice: '(1 day(s) to go)', duration: '3 days', priority: 'None', priorityColor: 'text-gray-400 dark:text-gray-500' },
                { id: 'EZ1-T6', name: 'This is a subtask.', owner: 'Nice Bike', status: 'In Review', statusColor: 'bg-blue-100 dark:bg-blue-400 text-blue-800 dark:text-black', startDate: '03-02-2026', dueDate: '03-04-2026', dueNotice: '(3 day(s) to go)', duration: '3 days', priority: 'Low', priorityColor: 'text-green-600 dark:text-green-500' },
                { id: 'EZ1-T7', name: 'Attachments and Discussions can be associated wit...', owner: 'Nice Bike', status: 'In Review', statusColor: 'bg-blue-100 dark:bg-blue-400 text-blue-800 dark:text-black', startDate: '03-04-2026', dueDate: '03-06-2026', dueNotice: '(5 day(s) to go)', duration: '3 days', priority: 'High', priorityColor: 'text-red-600 dark:text-red-500' },
                { id: 'EZ1-T8', name: 'Click the \'Import Tasks\' option available at the top ri...', owner: 'Nice Bike', status: 'In Review', statusColor: 'bg-blue-100 dark:bg-blue-400 text-blue-800 dark:text-black', startDate: '03-06-2026', dueDate: '03-08-2026', dueNotice: '(6 day(s) to go)', duration: '3 days', priority: 'None', priorityColor: 'text-gray-400 dark:text-gray-500' },
                { id: 'EZ1-T9', name: 'Click the \'Export Tasks\' option at the top right corner...', owner: 'Nice Bike', status: 'In Progress', statusColor: 'bg-cyan-100 dark:bg-cyan-400 text-cyan-800 dark:text-black', startDate: '03-08-2026', dueDate: '03-10-2026', dueNotice: '(7 day(s) to go)', duration: '3 days', priority: 'Medium', priorityColor: 'text-orange-600 dark:text-orange-500' },
                { id: 'EZ1-T10', name: 'This task is a recurring one.', owner: 'Nice Bike', status: 'In Progress', statusColor: 'bg-cyan-100 dark:bg-cyan-400 text-cyan-800 dark:text-black', startDate: '03-10-2026', dueDate: '03-12-2026', dueNotice: '(9 day(s) to go)', duration: '3 days', priority: 'Low', priorityColor: 'text-green-600 dark:text-green-500' },
                { id: 'EZ1-T11', name: 'The bell symbol at the end of the task name indicate...', owner: 'Nice Bike', status: 'In Progress', statusColor: 'bg-cyan-100 dark:bg-cyan-400 text-cyan-800 dark:text-black', startDate: '03-12-2026', dueDate: '03-14-2026', dueNotice: '(11 day(s) to go)', duration: '3 days', priority: 'High', priorityColor: 'text-red-600 dark:text-red-500' },
                { id: 'EZ1-T12', name: 'Time can be logged for a task using the timer option ...', owner: 'Nice Bike', status: 'In Progress', statusColor: 'bg-cyan-100 dark:bg-cyan-400 text-cyan-800 dark:text-black', startDate: '03-14-2026', dueDate: '03-16-2026', dueNotice: '(11 day(s) to go)', duration: '3 days', priority: 'None', priorityColor: 'text-gray-400 dark:text-gray-500' },
                { id: 'EZ1-T13', name: 'Click the \'Reorder Task List\' option on the top right o...', owner: 'Nice Bike', status: 'In Progress', statusColor: 'bg-cyan-100 dark:bg-cyan-400 text-cyan-800 dark:text-black', startDate: '03-16-2026', dueDate: '03-18-2026', dueNotice: '(13 day(s) to go)', duration: '3 days', priority: 'High', priorityColor: 'text-red-600 dark:text-red-500' },
                { id: 'EZ1-T15', name: 'Change the percentage completion to \'100\' to mark ...', owner: 'Nice Bike', status: 'Open', statusColor: 'bg-green-100 dark:bg-green-400 text-green-800 dark:text-black', startDate: '03-20-2026', dueDate: '03-22-2026', dueNotice: '(16 day(s) to go)', duration: '3 days', priority: 'High', priorityColor: 'text-red-600 dark:text-red-500' },
            ]
        }
    ]);

    const statusOptions = [
        { label: 'ongoing', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
        { label: 'completed', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
        { label: 'hold', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' }
    ];

    const priorityOptions = [
        { label: 'High', color: 'text-red-600 dark:text-red-500' },
        { label: 'Medium', color: 'text-orange-600 dark:text-orange-500' },
        { label: 'Low', color: 'text-green-600 dark:text-green-500' },
        { label: 'None', color: 'text-gray-400 dark:text-gray-500' }
    ];

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
            owner: 'Nice Bike',
            status: 'ongoing',
            startDate: new Date().toISOString().split('T')[0],
            dueDate: new Date().toISOString().split('T')[0],
            priority: 'Medium'
        });
    };

    const handleSaveTask = (listName) => {
        console.log('Saving task to', listName, newTask);
        setAddingTaskInList(null);
        setActiveDropdown(null);
    };

    const handleOptionSelect = (type, value) => {
        if (editingTask) {
            setEditingTask(prev => ({ ...prev, [type]: value }));
        } else {
            setNewTask(prev => ({ ...prev, [type]: value }));
        }
        setActiveDropdown(null);
    };

    const handleEditClick = (groupIdx, taskIdx, task, targetField = 'name') => {
        if (!canWrite) return;
        setEditingTask({ ...task });
        setEditingTarget({ groupIdx, taskIdx });
        setActiveDropdown(targetField);
    };

    const handleUpdateTask = () => {
        if (!editingTarget) return;
        const { groupIdx, taskIdx } = editingTarget;
        const newData = [...taskData];
        newData[groupIdx].tasks[taskIdx] = { ...editingTask };
        setTaskData(newData);
        setEditingTask(null);
        setEditingTarget(null);
    };

    const handleDeleteTask = (groupIdx, taskIdx) => {
        const newData = [...taskData];
        newData[groupIdx].tasks.splice(taskIdx, 1);
        setTaskData(newData);
    };

    const handleAddHeading = () => {
        const newHeadingName = `New Task Heading ${taskData.length + 1}`;
        setTaskData(prev => [
            {
                listName: newHeadingName,
                tasks: []
            },
            ...prev
        ]);
        // Auto-expand the new heading
        setExpandedLists(prev => ({ ...prev, [newHeadingName]: true }));
    };


    const filteredTaskData = taskData.map(group => ({
        ...group,
        tasks: group.tasks.filter(task => {
            const matchesStatus = statusFilter === 'All' || task.status.toLowerCase() === statusFilter.toLowerCase();
            const matchesPriority = priorityFilter === 'All' || task.priority === priorityFilter;
            return matchesStatus && matchesPriority;
        })
    }));

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117] transition-colors">
            {/* Toolbar */}
            <div className="flex justify-between items-center px-5 py-2 border-b border-gray-200 dark:border-gh-border bg-white dark:bg-[#0d1117]">
                <div className="flex items-center space-x-4">
                    {/* Status Filter */}
                    <div className="relative">
                        <div
                            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md border ${activeToolbarDropdown === 'statusFilter' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-gh-border'} bg-white dark:bg-[#161b22] text-[12px] font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:border-gray-300 dark:hover:border-gh-border-hover transition-all`}
                            onClick={() => setActiveToolbarDropdown(activeToolbarDropdown === 'statusFilter' ? null : 'statusFilter')}
                        >
                            <span className="text-gray-500 dark:text-gray-400">Status:</span>
                            <span className="text-blue-600 dark:text-blue-400 capitalize">{statusFilter}</span>
                            <ChevronDown size={14} className={`text-gray-400 transition-transform ${activeToolbarDropdown === 'statusFilter' ? 'rotate-180 text-blue-500' : ''}`} />
                        </div>
                        {activeToolbarDropdown === 'statusFilter' && (
                            <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-700 rounded-md shadow-2xl py-1 z-[110] anim-fade-in flex flex-col overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
                                <div className={`px-3 py-2 text-[12px] font-semibold cursor-pointer transition-colors ${statusFilter === 'All' ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-blue-600 dark:hover:text-white'}`} onClick={() => { setStatusFilter('All'); setActiveToolbarDropdown(null); }}>All</div>
                                {statusOptions.map(opt => (
                                    <div key={opt.label} className={`px-3 py-2 text-[12px] font-semibold cursor-pointer transition-colors ${statusFilter === opt.label ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-blue-600 dark:hover:text-white'}`} onClick={() => { setStatusFilter(opt.label); setActiveToolbarDropdown(null); }}>
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
                            onClick={() => setActiveToolbarDropdown(activeToolbarDropdown === 'priorityFilter' ? null : 'priorityFilter')}
                        >
                            <span className="text-gray-500 dark:text-gray-400">Priority:</span>
                            <span className="text-blue-600 dark:text-blue-400">{priorityFilter}</span>
                            <ChevronDown size={14} className={`text-gray-400 transition-transform ${activeToolbarDropdown === 'priorityFilter' ? 'rotate-180 text-blue-500' : ''}`} />
                        </div>
                        {activeToolbarDropdown === 'priorityFilter' && (
                            <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-700 rounded-md shadow-2xl py-1 z-[110] anim-fade-in flex flex-col overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
                                <div className={`px-3 py-2 text-[12px] font-semibold cursor-pointer transition-colors ${priorityFilter === 'All' ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-blue-600 dark:hover:text-white'}`} onClick={() => { setPriorityFilter('All'); setActiveToolbarDropdown(null); }}>All</div>
                                {priorityOptions.map(opt => (
                                    <div key={opt.label} className={`px-3 py-2 text-[12px] font-semibold cursor-pointer transition-colors ${priorityFilter === opt.label ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-blue-600 dark:hover:text-white'}`} onClick={() => { setPriorityFilter(opt.label); setActiveToolbarDropdown(null); }}>
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
                            <Plus size={14} className="mr-1" /> Add Task
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
                            <th className="px-4 py-3 font-semibold uppercase text-xs">Owner</th>
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
                                <tr className={`border-b border-gray-200 dark:border-gh-border transition-colors ${expandedLists[group.listName] ? 'bg-blue-50/10 dark:bg-gh-bg' : 'bg-[#fcfcfc] dark:bg-[#161b22]/50'}`}>
                                    <td colSpan={11} className="py-2 px-4">
                                        <div
                                            className="flex items-center justify-between group cursor-pointer text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                                            onClick={() => toggleList(group.listName)}
                                        >
                                            <div className="flex items-center space-x-2">
                                                {expandedLists[group.listName] ? (
                                                    <ChevronDown size={14} className="opacity-80 text-blue-600 dark:text-blue-400" />
                                                ) : (
                                                    <ChevronRight size={14} className="opacity-70" />
                                                )}
                                                <span className={`font-semibold text-sm ${expandedLists[group.listName] ? 'text-blue-600 dark:text-blue-400' : ''}`}>{group.listName}</span>
                                            </div>
                                        </div>

                                        {/* Group Inline Actions - only visible when expanded */}
                                        {expandedLists[group.listName] && canWrite && (
                                            <div className="flex items-center space-x-3 mt-3 ml-6 text-[12px] text-gray-400 dark:text-gray-500 font-medium">
                                                <span
                                                    className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer transition-all"
                                                    onClick={() => handleAddTaskClick(group.listName)}
                                                >
                                                    Add task list
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
                                    <tr className="bg-blue-50/20 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/30 anim-fade-in relative">
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
                                            <div className="flex items-center space-x-2">
                                                <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-[9px] font-bold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                                    <span>NB</span>
                                                </div>
                                                <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">Nice Bike</span>
                                            </div>
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
                                                        {statusOptions.map(opt => (
                                                            <div
                                                                key={opt.label}
                                                                className={`px-3 py-2 text-[11px] font-bold cursor-pointer transition-colors flex items-center justify-between ${newTask.status === opt.label ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-blue-600 dark:hover:text-white'}`}
                                                                onClick={() => handleOptionSelect('status', opt.label)}
                                                            >
                                                                <span>{opt.label}</span>
                                                                {newTask.status === opt.label && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-400">-</td>
                                        <td className="px-4 py-3">
                                            <div className="w-40 scale-[0.85] origin-left">
                                                <CustomDatePicker
                                                    value={newTask.startDate}
                                                    onChange={(e) => setNewTask({ ...newTask, startDate: e.target.value })}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="w-40 scale-[0.85] origin-left">
                                                <CustomDatePicker
                                                    value={newTask.dueDate}
                                                    onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500">Auto</td>
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
                                                                    onClick={() => handleOptionSelect('priority', opt.label)}
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
                                                        onClick={() => handleSaveTask(group.listName)}
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
                                    const isEditing = editingTarget?.groupIdx === groupIdx && editingTarget?.taskIdx === taskIdx;
                                    const isHovered = hoveredRow?.groupIdx === groupIdx && hoveredRow?.taskIdx === taskIdx;

                                    if (isEditing) {
                                        return (
                                            <tr key={taskIdx} className="bg-blue-50/10 dark:bg-blue-900/5 border-b border-gray-100 dark:border-gh-border/30 relative h-[42px]">
                                                <td className="px-3 py-2 text-center text-gray-400 dark:text-gray-600">
                                                    <GripVertical size={14} className="mx-auto" />
                                                </td>
                                                <td className="px-4 py-2 font-mono text-gray-500 dark:text-gray-400">{task.id}</td>
                                                <td className="px-2 py-1">
                                                    {activeDropdown === 'name' ? (
                                                        <input
                                                            type="text"
                                                            autoFocus
                                                            className="w-full bg-[#f6f8fa] dark:bg-[#161b22] border border-blue-500 ring-1 ring-blue-500/20 rounded-md px-2 py-1 text-sm outline-none shadow-sm dark:text-white transition-all"
                                                            value={editingTask.name}
                                                            onChange={(e) => setEditingTask({ ...editingTask, name: e.target.value })}
                                                            onKeyDown={(e) => e.key === 'Enter' && handleUpdateTask()}
                                                        />
                                                    ) : (
                                                        <div
                                                            className="px-2 py-1 rounded-md bg-[#f6f8fa] dark:bg-[#161b22] border border-gray-200 dark:border-gh-border shadow-sm cursor-pointer truncate max-w-[400px] text-gray-900 dark:text-gray-200 font-medium"
                                                            onClick={() => setActiveDropdown('name')}
                                                        >
                                                            {editingTask.name}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="flex items-center space-x-2">
                                                        <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-gray-400 to-gray-600 dark:from-gray-500 dark:to-gray-700 flex items-center justify-center text-[9px] font-bold text-white shadow-sm"><span>{editingTask.owner.charAt(0)}</span></div>
                                                        <span className="text-gray-600 dark:text-gray-300">{editingTask.owner}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 relative">
                                                    <div
                                                        className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer bg-[#f6f8fa] dark:bg-[#161b22] border border-gray-200 dark:border-gh-border shadow-sm w-fit`}
                                                        onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'status' ? null : 'status'); }}
                                                    >
                                                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold min-w-[90px] inline-block text-center shadow-sm ${editingTask.statusColor}`}>
                                                            {editingTask.status}
                                                        </span>
                                                    </div>
                                                    {activeDropdown === 'status' && (
                                                        <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-700 rounded-md shadow-2xl py-1 z-50 anim-fade-in flex flex-col overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
                                                            {statusOptions.map(opt => (
                                                                <div
                                                                    key={opt.label}
                                                                    className="px-3 py-2 text-[12px] font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer flex items-center justify-between hover:text-blue-600 dark:hover:text-white transition-colors"
                                                                    onClick={(e) => { e.stopPropagation(); handleOptionSelect('status', opt.label); }}
                                                                >
                                                                    <span className="capitalize">{opt.label}</span>
                                                                    {editingTask.status === opt.label && <Check size={12} className="text-blue-500" />}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 text-gray-400 dark:text-gray-500">-</td>
                                                <td className="px-4 py-2 relative">
                                                    <div
                                                        className={`px-2 py-1 rounded-md bg-[#f6f8fa] dark:bg-[#161b22] border border-gray-200 dark:border-gh-border shadow-sm cursor-pointer w-fit`}
                                                        onClick={() => setActiveDropdown(activeDropdown === 'startDate' ? null : 'startDate')}
                                                    >
                                                        <span className="text-gray-600 dark:text-gray-400">{editingTask.startDate}</span>
                                                    </div>
                                                    {activeDropdown === 'startDate' && (
                                                        <div className="absolute top-full left-0 mt-1 z-50">
                                                            <CustomDatePicker
                                                                value={editingTask.startDate}
                                                                onChange={(date) => {
                                                                    setEditingTask(prev => ({ ...prev, startDate: date }));
                                                                    setActiveDropdown(null);
                                                                }}
                                                                onClose={() => setActiveDropdown(null)}
                                                            />
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 relative">
                                                    <div
                                                        className={`px-2 py-1 rounded-md bg-[#f6f8fa] dark:bg-[#161b22] border border-gray-200 dark:border-gh-border shadow-sm cursor-pointer w-fit`}
                                                        onClick={() => setActiveDropdown(activeDropdown === 'dueDate' ? null : 'dueDate')}
                                                    >
                                                        <div className="flex items-center space-x-2">
                                                            <span className="text-gray-700 dark:text-gray-300 font-medium">{editingTask.dueDate}</span>
                                                            <span className={`text-[10px] font-medium ${editingTask.dueNotice?.includes('ago') ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-500'}`}>{editingTask.dueNotice}</span>
                                                        </div>
                                                    </div>
                                                    {activeDropdown === 'dueDate' && (
                                                        <div className="absolute top-full left-0 mt-1 z-50">
                                                            <CustomDatePicker
                                                                value={editingTask.dueDate}
                                                                onChange={(date) => {
                                                                    setEditingTask(prev => ({ ...prev, dueDate: date }));
                                                                    setActiveDropdown(null);
                                                                }}
                                                                onClose={() => setActiveDropdown(null)}
                                                            />
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{editingTask.duration}</td>
                                                <td className={`px-4 py-2 relative ${editingTask.priorityColor} font-semibold`}>
                                                    <div
                                                        className={`flex items-center space-x-1 px-2 py-1 rounded-md bg-[#f6f8fa] dark:bg-[#161b22] border border-gray-200 dark:border-gh-border shadow-sm cursor-pointer w-fit`}
                                                        onClick={() => setActiveDropdown(activeDropdown === 'priority' ? null : 'priority')}
                                                    >
                                                        {editingTask.priority !== 'None' && <span className="font-bold">!</span>}
                                                        <span className="ml-1">{editingTask.priority}</span>
                                                    </div>
                                                    {activeDropdown === 'priority' && (
                                                        <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gray-700 rounded-md shadow-2xl py-1 z-50 anim-fade-in flex flex-col overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
                                                            {priorityOptions.map(opt => (
                                                                <div
                                                                    key={opt.label}
                                                                    className={`px-3 py-2 text-[12px] font-semibold ${opt.color} hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer flex items-center justify-between transition-colors`}
                                                                    onClick={(e) => { e.stopPropagation(); handleOptionSelect('priority', opt.label); }}
                                                                >
                                                                    <span>{opt.label}</span>
                                                                    {editingTask.priority === opt.label && <Check size={12} className="text-blue-500" />}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 text-center bg-gray-50/50 dark:bg-white/5">
                                                    <div className="flex items-center justify-center space-x-2">
                                                        <button
                                                            onClick={handleUpdateTask}
                                                            className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded shadow-sm transition-all transform active:scale-95"
                                                            title="Save"
                                                        >
                                                            <Check size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => { setEditingTarget(null); setEditingTask(null); setActiveDropdown(null); }}
                                                            className="p-1.5 bg-gray-200 dark:bg-gh-border/50 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gh-border transition-all transform active:scale-95"
                                                            title="Cancel"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }

                                    return (
                                        <tr
                                            key={taskIdx}
                                            className="hover:bg-blue-50/10 dark:hover:bg-gh-hover transition-colors group/row border-b border-gray-50 dark:border-gh-border/30 relative h-[42px]"
                                            onMouseEnter={() => setHoveredRow({ groupIdx, taskIdx })}
                                            onMouseLeave={() => setHoveredRow(null)}
                                        >
                                            <td className="px-3 py-2 text-center">
                                                <GripVertical size={14} className="text-gray-300 dark:text-gh-border group-hover/row:text-blue-500 transition-colors mx-auto cursor-grab active:cursor-grabbing" />
                                            </td>
                                            <td className="px-4 py-2 font-mono text-gray-500 dark:text-gray-400">{task.id}</td>
                                            <td className="px-2 py-1 text-gray-900 dark:text-gray-200 font-medium">
                                                <div
                                                    className={`group/name flex items-center justify-between border border-transparent rounded-md px-2 py-1.5 transition-all duration-200 ${isHovered ? 'bg-[#f6f8fa] dark:bg-[#161b22] border-gray-200 dark:border-gh-border shadow-sm' : ''}`}
                                                    onClick={() => handleEditClick(groupIdx, taskIdx, task, 'name')}
                                                >
                                                    <div className="truncate max-w-[400px] cursor-pointer">
                                                        {task.name}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="flex items-center space-x-2">
                                                    <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-gray-400 to-gray-600 dark:from-gray-500 dark:to-gray-700 flex items-center justify-center text-[9px] font-bold text-white shadow-sm"><span className="z-10">{task.owner.charAt(0)}</span></div>
                                                    <span className="text-gray-600 dark:text-gray-300">{task.owner}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 relative">
                                                <div
                                                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${isHovered ? 'bg-[#f6f8fa] dark:bg-[#161b22] border border-gray-200 dark:border-gh-border shadow-sm' : 'border border-transparent'}`}
                                                    onClick={() => handleEditClick(groupIdx, taskIdx, task, 'status')}
                                                >
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold min-w-[90px] inline-block text-center shadow-sm ${task.statusColor}`}>
                                                        {task.status}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-gray-400 dark:text-gray-500">-</td>
                                            <td className="px-4 py-2 relative">
                                                <div
                                                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${isHovered ? 'bg-[#f6f8fa] dark:bg-[#161b22] border border-gray-200 dark:border-gh-border shadow-sm' : 'border border-transparent'}`}
                                                    onClick={() => handleEditClick(groupIdx, taskIdx, task, 'startDate')}
                                                >
                                                    <span className="text-gray-600 dark:text-gray-400">{task.startDate}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 relative">
                                                <div
                                                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${isHovered ? 'bg-[#f6f8fa] dark:bg-[#161b22] border border-gray-200 dark:border-gh-border shadow-sm' : 'border border-transparent'}`}
                                                    onClick={() => handleEditClick(groupIdx, taskIdx, task, 'dueDate')}
                                                >
                                                    <div className="flex items-center space-x-2">
                                                        <span className="text-gray-700 dark:text-gray-300 font-medium">{task.dueDate}</span>
                                                        <span className={`text-[10px] font-medium ${task.dueNotice?.includes('ago') ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-500'}`}>{task.dueNotice}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{task.duration}</td>
                                            <td className={`px-4 py-2 relative ${task.priorityColor} font-semibold`}>
                                                <div
                                                    className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-all cursor-pointer ${isHovered ? 'bg-[#f6f8fa] dark:bg-[#161b22] border border-gray-200 dark:border-gh-border shadow-sm' : 'border border-transparent'}`}
                                                    onClick={() => handleEditClick(groupIdx, taskIdx, task, 'priority')}
                                                >
                                                    {task.priority !== 'None' && <span className="font-bold">!</span>}
                                                    <span className="ml-1">{task.priority}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-center group-hover/row:bg-gray-50 dark:group-hover/row:bg-white/5 transition-colors">
                                                {canWrite && (
                                                    <div className="flex items-center justify-center space-x-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleEditClick(groupIdx, taskIdx, task, 'name')}
                                                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-all"
                                                            title="Edit Task"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteTask(groupIdx, taskIdx); }}
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
                                    <tr className="bg-white dark:bg-[#0d1117]">
                                        <td colSpan={11} className="py-8 text-center text-gray-400 dark:text-gray-500 text-xs italic">
                                            No tasks in this list. Click 'Add task list' below to get started.
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
