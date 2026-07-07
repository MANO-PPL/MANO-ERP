import React, { useEffect, useState } from 'react';
import { Plus, Edit2, GripVertical, Trash2, Info, X, Clock, ArrowLeft } from 'lucide-react';
import { Reorder, AnimatePresence, motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { generalDocsApi } from '../../../services/generalDocsApi';

const ResizableInput = ({ value, onChange, autoFocus, className = "", minW = "60px" }) => (
    <div className="inline-grid w-fit max-w-full items-center align-middle relative">
        <span className={`invisible col-start-1 row-start-1 whitespace-pre pointer-events-none min-h-[26px] flex items-center ${className}`} style={{ minWidth: minW }}>
            {value || ' '}
        </span>
        <input
            autoFocus={autoFocus}
            className={`absolute inset-0 w-full h-full bg-white dark:bg-[#161b22] border border-blue-500/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded outline-none shadow-sm dark:text-white transition-all ${className}`}
            value={value || ''}
            onChange={onChange}
        />
    </div>
);

const ResizableTextarea = ({ value, onChange, autoFocus, className = "", minW = "100px", minH = "60px" }) => (
    <div className="inline-grid w-fit max-w-full align-top relative">
        <span className={`invisible col-start-1 row-start-1 whitespace-pre-wrap break-words ${className}`} style={{ minWidth: minW, minHeight: minH }}>
            {value ? value + ' ' : ' '}
        </span>
        <textarea
            autoFocus={autoFocus}
            className={`absolute inset-0 w-full h-full bg-white dark:bg-[#161b22] border border-blue-500/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded outline-none shadow-sm dark:text-white resize-none overflow-hidden ${className}`}
            value={value || ''}
            onChange={onChange}
        />
    </div>
);

const StaffRoles = ({ onBack, setExtraBreadcrumbs, canWrite }) => {
    const { id: projectId } = useParams();
    const [staffs, setStaffs] = useState([]);
    const [loading, setLoading] = useState(true);

    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState(null);
    const [hoveredRow, setHoveredRow] = useState(null);
    const [isInfoOpen, setIsInfoOpen] = useState(false);

    const auditTrail = [
        { id: 1, action: "API Connected Session", user: "Active User", timestamp: new Date().toLocaleString(), type: "update" },
    ];

    useEffect(() => {
        setExtraBreadcrumbs([
            { label: 'General Documents', onClick: onBack },
            { label: "MANO's Staff Role & Responsibilities" }
        ]);
        fetchStaff();
    }, [onBack, setExtraBreadcrumbs, projectId]);

    const fetchStaff = async () => {
        try {
            setLoading(true);
            const data = await generalDocsApi.getStaff(projectId);
            if (data && data.staff) {
                const mappedStaff = data.staff.map(s => ({
                    id: s.psrr_id,
                    name: s.name,
                    designation: s.designation,
                    responsibilities: s.responsibilities,
                    phone: s.mobile,
                    email: s.email
                }));
                setStaffs(mappedStaff);
            }
        } catch (error) {
            console.error("Failed to fetch staff:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = () => {
        if (!canWrite) return;
        const newRecord = {
            id: `new-${Date.now()}`,
            name: '',
            designation: '',
            responsibilities: '',
            phone: '',
            email: '',
            isNew: true
        };
        setStaffs([...staffs, newRecord]);
        setEditingId(newRecord.id);
        setEditData(newRecord);
    };

    const handleEdit = (staff) => {
        if (!canWrite) return;
        setEditingId(staff.id);
        setEditData({ ...staff });
    };

    const handleSave = async () => {
        try {
            const payload = {
                name: editData.name,
                designation: editData.designation,
                responsibilities: editData.responsibilities,
                mobile: editData.phone,
                email: editData.email
            };
            
            if (editData.isNew) {
                await generalDocsApi.addStaff(projectId, payload);
            } else {
                await generalDocsApi.updateStaff(projectId, editData.id, payload);
            }
            await fetchStaff();
            setEditingId(null);
            setEditData(null);
        } catch (error) {
            console.error("Failed to save staff record:", error);
        }
    };

    const handleCancel = () => {
        if (editData?.isNew) {
            setStaffs(prev => prev.filter(s => s.id !== editData.id));
        }
        setEditingId(null);
        setEditData(null);
    };

    const handleDelete = async (id) => {
        try {
            await generalDocsApi.deleteStaff(projectId, id);
            await fetchStaff();
        } catch (error) {
            console.error("Failed to delete staff record:", error);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins text-left relative">
            {/* Toolbar Area */}
            <div className="flex justify-between items-center px-8 py-4 border-b border-gray-100 dark:border-white/5 bg-white dark:bg-[#0d1117] z-20">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 rounded-lg transition-all active:scale-95 group"
                        title="Back to list"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-medium text-gray-900 dark:text-white">MANO's Staff Role &amp; Responsibilities</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Roles and responsibilities of the staff members.</p>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    {canWrite && (
                        <>
                            <button className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-white/10 rounded-md text-[12px] font-medium transition-all">
                                <Edit2 size={16} />
                                <span>Edit</span>
                            </button>
                            <button onClick={handleAdd} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[12px] font-medium shadow-lg shadow-blue-500/20 transition-all active:scale-95">
                                <Plus size={16} />
                                <span>Add staff</span>
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setIsInfoOpen(true)}
                        className="p-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-white/10 rounded-md transition-all active:scale-95"
                        title="View Audit Trail"
                    >
                        <Info size={18} />
                    </button>
                </div>
            </div>

            {/* List View - Task Theme Style */}
            <div className="flex-1 overflow-auto custom-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center h-48 opacity-50 dark:text-white">Loading data...</div>
                ) : (
                    <div className="min-w-full inline-block align-middle pb-20">
                        <table className="w-full text-left whitespace-nowrap text-[13px] border-collapse bg-white dark:bg-[#0d1117]">
                            <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-gray-500 dark:text-gray-400 sticky top-0 z-10 border-b border-gray-200 dark:border-white/5 tracking-wide">
                                <tr>
                                    <th className="px-3 py-3 w-6 text-center"></th>
                                    <th className="px-4 py-3 font-medium capitalize text-[10px] tracking-widest border-r border-gray-100 dark:border-white/5 w-16 text-center">S. no.</th>
                                    <th className="px-4 py-3 font-medium capitalize text-[10px] tracking-widest border-r border-gray-100 dark:border-white/5">Staff name</th>
                                    <th className="px-4 py-3 font-medium capitalize text-[10px] tracking-widest border-r border-gray-100 dark:border-white/5">Role / Designation</th>
                                    <th className="px-4 py-3 font-medium capitalize text-[10px] tracking-widest border-r border-gray-100 dark:border-white/5 whitespace-normal">Responsibilities</th>
                                    <th className="px-4 py-3 font-medium capitalize text-[10px] tracking-widest border-r border-gray-100 dark:border-white/5">Mobile no</th>
                                    <th className="px-4 py-3 font-medium capitalize text-[10px] tracking-widest border-r border-gray-100 dark:border-white/5">Email id</th>
                                    {canWrite && <th className="px-4 py-3 font-medium capitalize text-[10px] tracking-widest text-center">Actions</th>}
                                </tr>
                            </thead>
                            <Reorder.Group axis="y" values={staffs} onReorder={canWrite ? setStaffs : () => {}} as="tbody" className="divide-y divide-gray-100 dark:divide-white/[0.03]">
                                <AnimatePresence initial={false}>
                                    {staffs.map((staff, idx) => {
                                        const isEditing = editingId === staff.id;
                                        return (
                                            <Reorder.Item
                                                key={staff.id}
                                                value={staff}
                                                as="tr"
                                                onMouseEnter={() => setHoveredRow(staff.id)}
                                                onMouseLeave={() => setHoveredRow(null)}
                                                className={`${isEditing ? 'bg-blue-50/10 dark:bg-blue-900/5' : 'hover:bg-blue-50/10 dark:hover:bg-blue-900/10'} transition-colors group/row h-[60px] cursor-default relative`}
                                            >
                                                <td className="px-3 py-2 text-center w-6 min-w-[40px]">
                                                    <div className="flex items-center justify-center">
                                                        <GripVertical size={14} className="text-gray-300 dark:text-gray-700 group-hover/row:text-blue-500 transition-colors cursor-grab active:cursor-grabbing" />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 text-gray-500 dark:text-gray-600 font-mono text-[11px] border-r border-gray-100 dark:border-white/[0.03] text-center w-16">
                                                    {String(idx + 1)}
                                                </td>

                                                {/* Name of Person Field */}
                                                <td className="px-4 py-2 border-r border-gray-100 dark:border-white/[0.03]" onClick={() => !isEditing && handleEdit(staff)}>
                                                    {isEditing ? (
                                                        <ResizableInput
                                                            autoFocus
                                                            className="px-2 py-1 text-xs"
                                                            value={editData.name}
                                                            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                                        />
                                                    ) : (
                                                        <span className="text-gray-900 dark:text-gray-200 cursor-pointer font-medium">
                                                            {staff.name || '-'}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Designation Field */}
                                                <td className="px-4 py-2 border-r border-gray-100 dark:border-white/[0.03]" onClick={() => !isEditing && handleEdit(staff)}>
                                                    {isEditing ? (
                                                        <ResizableInput
                                                            className="px-2 py-1 text-xs"
                                                            value={editData.designation}
                                                            onChange={(e) => setEditData({ ...editData, designation: e.target.value })}
                                                        />
                                                    ) : (
                                                        <span className="text-gray-600 dark:text-gray-400 cursor-pointer">{staff.designation || '-'}</span>
                                                    )}
                                                </td>

                                                {/* Responsibilities Field */}
                                                <td className="px-4 py-2 border-r border-gray-100 dark:border-white/[0.03] whitespace-pre-wrap leading-relaxed" onClick={() => !isEditing && handleEdit(staff)}>
                                                    {isEditing ? (
                                                        <ResizableTextarea
                                                            className="px-2 py-1 text-xs"
                                                            minW="200px"
                                                            value={editData.responsibilities}
                                                            onChange={(e) => setEditData({ ...editData, responsibilities: e.target.value })}
                                                        />
                                                    ) : (
                                                        <span className="text-gray-600 dark:text-gray-400 cursor-pointer inline-block w-full">{staff.responsibilities || '-'}</span>
                                                    )}
                                                </td>

                                                {/* Mobile Field */}
                                                <td className="px-4 py-2 border-r border-gray-100 dark:border-white/[0.03]" onClick={() => !isEditing && handleEdit(staff)}>
                                                    {isEditing ? (
                                                        <ResizableInput
                                                            className="px-2 py-1 text-xs"
                                                            value={editData.phone}
                                                            onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                                                        />
                                                    ) : (
                                                        <span className="text-gray-600 dark:text-gray-400 cursor-pointer">{staff.phone || '-'}</span>
                                                    )}
                                                </td>

                                                {/* Email Field */}
                                                <td className="px-4 py-2 border-r border-gray-100 dark:border-white/[0.03]" onClick={() => !isEditing && handleEdit(staff)}>
                                                    {isEditing ? (
                                                        <ResizableInput
                                                            className="px-2 py-1 text-xs"
                                                            minW="100px"
                                                            value={editData.email}
                                                            onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                                                        />
                                                    ) : (
                                                        <span className="text-blue-500 hover:underline cursor-pointer">{!staff.email || staff.email === '-' ? '' : staff.email}</span>
                                                    )}
                                                </td>

                                                    {canWrite && (
                                                        <td className="px-4 py-2 text-center min-w-[120px]">
                                                            {isEditing ? (
                                                                <div className="flex items-center justify-center space-x-2">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleSave(); }}
                                                                        className="px-2.5 py-1 bg-blue-600 text-white rounded text-[11px] font-medium hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
                                                                    >
                                                                        Save
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleCancel(); }}
                                                                        className="px-2.5 py-1 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded text-[11px] font-medium hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className={`flex items-center justify-center space-x-3 transition-opacity duration-200 opacity-100`}>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleEdit(staff); }}
                                                                        className="text-gray-400 hover:text-blue-500 transition-colors p-1"
                                                                        title="Edit"
                                                                    >
                                                                        <Edit2 size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleDelete(staff.id); }}
                                                                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    )}
                                            </Reorder.Item>
                                        );
                                    })}
                                </AnimatePresence>
                            </Reorder.Group>
                        </table>
                    </div>
                )}
            </div>

            {/* Audit Trail Drawer */}
            <AnimatePresence>
                {isInfoOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsInfoOpen(false)}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 h-full w-[380px] bg-white dark:bg-[#0d1117] border-l border-gray-200 dark:border-white/10 shadow-2xl z-[101] flex flex-col"
                        >
                            <div className="p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-[#161b22]">
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-blue-500/10 rounded-lg">
                                        <Info size={20} className="text-blue-400" />
                                    </div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Audit trail & history</h2>
                                </div>
                                <button
                                    onClick={() => setIsInfoOpen(false)}
                                    className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all outline-none"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                                {auditTrail.map((log) => (
                                    <div key={log.id} className="relative pl-8 pb-2">
                                        <div className="absolute left-3 top-2 bottom-0 w-[1px] bg-gray-200 dark:bg-white/10" />
                                        <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-white dark:border-[#0d1117] z-10 flex items-center justify-center ${log.type === 'create' ? 'bg-green-500/20 text-green-400' :
                                            log.type === 'update' ? 'bg-blue-500/20 text-blue-400' :
                                                'bg-purple-500/20 text-purple-400'
                                            }`}>
                                            <div className="w-1.5 h-1.5 rounded-full bg-current" />
                                        </div>

                                        <div className="space-y-1">
                                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight">
                                                {log.action}
                                            </p>
                                            <div className="flex items-center space-x-2 text-[11px] text-gray-500">
                                                <span className="font-medium text-gray-400">{log.user}</span>
                                                <span>•</span>
                                                <div className="flex items-center space-x-1">
                                                    <Clock size={10} />
                                                    <span>{log.timestamp}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-6 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#161b22]/50">
                                <button
                                    onClick={() => setIsInfoOpen(false)}
                                    className="w-full py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-md text-sm font-bold transition-all outline-none border border-gray-300 dark:border-white/10"
                                >
                                    Close panel
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default StaffRoles;
