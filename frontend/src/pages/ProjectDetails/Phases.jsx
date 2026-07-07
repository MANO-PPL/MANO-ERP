import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Trash2, ChevronUp, ChevronDown, Check, X, Pencil, Calendar, Percent, Milestone } from 'lucide-react';
import { projectApi } from '../../services/projectApi';
import CustomDatePicker from '../../components/CustomDatePicker';
import CustomInput from '../../components/CustomInput';

const Phases = ({ setExtraBreadcrumbs, canWrite }) => {
    const { id: projectId } = useParams();
    const [project, setProject] = useState(null);
    const [phases, setPhases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Edit states
    const [editingIdx, setEditingIdx] = useState(null);
    const [editForm, setEditForm] = useState(null);
    const [isAdding, setIsAdding] = useState(false);
    const [addForm, setAddForm] = useState({
        name: '',
        startDate: '',
        endDate: '',
        weight: '0',
        progress: '0'
    });

    useEffect(() => {
        setExtraBreadcrumbs([
            { label: 'Phases' }
        ]);
        fetchProjectData();
    }, [projectId, setExtraBreadcrumbs]);

    const fetchProjectData = async () => {
        try {
            setLoading(true);
            const res = await projectApi.getProject(projectId);
            if (res.success && res.project) {
                setProject(res.project);
                let meta = {};
                if (res.project.metadata) {
                    meta = typeof res.project.metadata === 'string' ? JSON.parse(res.project.metadata) : res.project.metadata;
                }
                setPhases(meta.phases || []);
            }
        } catch (error) {
            console.error("Failed to fetch project for phases", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveToDatabase = async (updatedPhases) => {
        if (!project) return;
        setIsSaving(true);
        try {
            // Calculate overall weighted completion
            const overallProgress = updatedPhases.reduce((acc, p) => {
                const progress = parseFloat(p.progress) || 0;
                const weight = parseFloat(p.weight) || 0;
                return acc + (progress * (weight / 100));
            }, 0);

            let meta = {};
            if (project.metadata) {
                meta = typeof project.metadata === 'string' ? JSON.parse(project.metadata) : project.metadata;
            }

            const updatedPayload = {
                name: project.name,
                location: project.location,
                status: project.status,
                project_code: project.project_code,
                start_date: project.start_date,
                end_date: project.end_date,
                metadata: {
                    ...meta,
                    phases: updatedPhases,
                    completion: Math.round(overallProgress)
                }
            };

            const res = await projectApi.updateProject(project.id, updatedPayload);
            if (res.success) {
                // Refresh local project state
                setProject(prev => ({
                    ...prev,
                    metadata: updatedPayload.metadata
                }));
            }
        } catch (error) {
            console.error("Failed to save phases to database", error);
            alert("Failed to save changes.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddPhase = async () => {
        if (!addForm.name) return alert("Phase Name is required.");
        const newPhase = {
            id: Date.now(),
            name: addForm.name,
            startDate: addForm.startDate,
            endDate: addForm.endDate,
            weight: parseFloat(addForm.weight) || 0,
            progress: parseFloat(addForm.progress) || 0
        };

        const newPhases = [...phases, newPhase];
        setPhases(newPhases);
        setIsAdding(false);
        setAddForm({ name: '', startDate: '', endDate: '', weight: '0', progress: '0' });
        await handleSaveToDatabase(newPhases);
    };

    const handleEditClick = (idx, phase) => {
        setEditingIdx(idx);
        setEditForm({ ...phase });
    };

    const handleSaveEdit = async () => {
        if (!editForm.name) return alert("Phase Name is required.");
        const updatedPhases = [...phases];
        updatedPhases[editingIdx] = {
            ...editForm,
            weight: parseFloat(editForm.weight) || 0,
            progress: parseFloat(editForm.progress) || 0
        };
        setPhases(updatedPhases);
        setEditingIdx(null);
        setEditForm(null);
        await handleSaveToDatabase(updatedPhases);
    };

    const handleDeletePhase = async (idx) => {
        if (!window.confirm("Are you sure you want to delete this phase?")) return;
        const updatedPhases = phases.filter((_, i) => i !== idx);
        setPhases(updatedPhases);
        await handleSaveToDatabase(updatedPhases);
    };

    const handleMovePhase = async (idx, direction) => {
        const targetIdx = idx + direction;
        if (targetIdx < 0 || targetIdx >= phases.length) return;
        const updatedPhases = [...phases];
        const temp = updatedPhases[idx];
        updatedPhases[idx] = updatedPhases[targetIdx];
        updatedPhases[targetIdx] = temp;
        setPhases(updatedPhases);
        await handleSaveToDatabase(updatedPhases);
    };

    const totalWeight = phases.reduce((acc, p) => acc + (parseFloat(p.weight) || 0), 0);
    const overallProgress = phases.reduce((acc, p) => {
        const progress = parseFloat(p.progress) || 0;
        const weight = parseFloat(p.weight) || 0;
        return acc + (progress * (weight / 100));
    }, 0);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-transparent">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-transparent overflow-hidden text-left font-sans">
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                
                {/* Header Metrics Card */}
                <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/5 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Milestone className="text-blue-500" size={20} />
                            Project Phases & Roadmap
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Define project roadmap phases, weightages, and update schedule progress.
                        </p>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="text-center md:text-right">
                            <span className="block text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Overall Progress</span>
                            <span className="text-3xl font-black text-blue-600 dark:text-blue-400">{Math.round(overallProgress)}%</span>
                        </div>
                        <div className="h-10 w-px bg-gray-200 dark:bg-white/10" />
                        <div className="text-center md:text-right">
                            <span className="block text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Sum of Weights</span>
                            <span className={`text-xl font-bold ${totalWeight === 100 ? 'text-green-500' : 'text-amber-500'}`}>
                                {totalWeight}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Weight Alert Banner */}
                {phases.length > 0 && totalWeight !== 100 && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/20 rounded-xl px-5 py-3.5 flex items-center justify-between">
                        <span className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                            ⚠️ Sum of phase weights is currently <strong>{totalWeight}%</strong>. For progress to calculate accurately, phase weights should add up to <strong>100%</strong>.
                        </span>
                    </div>
                )}

                {/* Add Phase Form Toggle */}
                {!isAdding && editingIdx === null && canWrite && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm w-fit"
                    >
                        <Plus size={16} />
                        <span>Add Project Phase</span>
                    </button>
                )}

                {/* Add Phase Card */}
                {isAdding && (
                    <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/5 rounded-2xl p-6 shadow-md space-y-4 max-w-2xl anim-fade-in">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">Create New Phase</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <CustomInput
                                    label="Phase Name"
                                    value={addForm.name}
                                    onChange={(e) => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g., Brickwork & Partitioning"
                                />
                            </div>
                            <CustomDatePicker
                                label="Target Start Date"
                                value={addForm.startDate}
                                onChange={(val) => setAddForm(prev => ({ ...prev, startDate: val.target.value }))}
                            />
                            <CustomDatePicker
                                label="Target End Date"
                                value={addForm.endDate}
                                onChange={(val) => setAddForm(prev => ({ ...prev, endDate: val.target.value }))}
                            />
                            <CustomInput
                                label="Weightage (%)"
                                type="number"
                                value={addForm.weight}
                                onChange={(e) => setAddForm(prev => ({ ...prev, weight: e.target.value }))}
                            />
                            <CustomInput
                                label="Initial Progress (%)"
                                type="number"
                                value={addForm.progress}
                                onChange={(e) => setAddForm(prev => ({ ...prev, progress: e.target.value }))}
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setIsAdding(false)}
                                className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddPhase}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-all shadow-sm"
                            >
                                Create Phase
                            </button>
                        </div>
                    </div>
                )}

                {/* Phases Timeline List */}
                <div className="space-y-4 max-w-4xl">
                    {phases.length === 0 ? (
                        <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/5 rounded-2xl py-12 text-center shadow-sm">
                            <Milestone className="mx-auto text-gray-300 dark:text-gray-600 mb-3" size={40} />
                            <p className="text-gray-500 dark:text-gray-400 font-medium">No phases configured yet.</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Configure project phases to track timeline and dynamic progress.</p>
                        </div>
                    ) : (
                        phases.map((phase, idx) => {
                            const isEditing = editingIdx === idx;
                            
                            // Render Phase Card
                            return (
                                <div
                                    key={phase.id}
                                    className={`bg-white dark:bg-[#161b22] border rounded-2xl shadow-sm transition-all duration-300 relative overflow-hidden flex flex-col md:flex-row
                                    ${isEditing ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-gray-200 dark:border-white/5'}`}
                                >
                                    {/* Left Accent indicator */}
                                    <div className={`w-1.5 self-stretch ${phase.progress === 100 ? 'bg-green-500' : phase.progress > 0 ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-700'}`} />

                                    <div className="flex-1 p-5 md:p-6 flex flex-col justify-between gap-4">
                                        {isEditing ? (
                                            /* Edit Form Mode */
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="col-span-2">
                                                        <CustomInput
                                                            label="Phase Name"
                                                            value={editForm.name}
                                                            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                                        />
                                                    </div>
                                                    <CustomDatePicker
                                                        label="Start Date"
                                                        value={editForm.startDate}
                                                        onChange={(val) => setEditForm(prev => ({ ...prev, startDate: val.target.value }))}
                                                    />
                                                    <CustomDatePicker
                                                        label="End Date"
                                                        value={editForm.endDate}
                                                        onChange={(val) => setEditForm(prev => ({ ...prev, endDate: val.target.value }))}
                                                    />
                                                    <CustomInput
                                                        label="Weightage (%)"
                                                        type="number"
                                                        value={editForm.weight}
                                                        onChange={(e) => setEditForm(prev => ({ ...prev, weight: e.target.value }))}
                                                    />
                                                    <div className="flex flex-col">
                                                        <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                                            Progress ({editForm.progress}%)
                                                        </label>
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max="100"
                                                            value={editForm.progress}
                                                            onChange={(e) => setEditForm(prev => ({ ...prev, progress: e.target.value }))}
                                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 mt-2"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex justify-end gap-2 pt-2">
                                                    <button
                                                        onClick={() => { setEditingIdx(null); setEditForm(null); }}
                                                        className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={handleSaveEdit}
                                                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg"
                                                    >
                                                        Apply Changes
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Normal Display Mode */
                                            <div className="flex flex-col gap-4">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <h4 className="text-base font-bold text-gray-900 dark:text-white">
                                                            {phase.name}
                                                        </h4>
                                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mt-1.5 font-medium">
                                                            <span className="flex items-center gap-1.5">
                                                                <Calendar size={13} />
                                                                {phase.startDate ? new Date(phase.startDate).toLocaleDateString() : 'N/A'} - {phase.endDate ? new Date(phase.endDate).toLocaleDateString() : 'N/A'}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Percent size={13} />
                                                                Weight: {phase.weight}%
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider
                                                    ${phase.progress === 100 ? 'bg-green-100 text-green-700 dark:bg-green-950/20 dark:text-green-400' : phase.progress > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}`}>
                                                        {phase.progress === 100 ? 'Completed' : phase.progress > 0 ? 'In Progress' : 'Not Started'}
                                                    </span>
                                                </div>

                                                {/* Progress Bar & percentage */}
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between items-center text-xs font-semibold">
                                                        <span className="text-gray-400">Progress</span>
                                                        <span className="text-gray-700 dark:text-gray-300">{phase.progress}%</span>
                                                    </div>
                                                    <div className="w-full bg-gray-100 dark:bg-white/5 h-2 rounded-full overflow-hidden flex">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-300 ${phase.progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                                            style={{ width: `${phase.progress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons Panel (Right side) */}
                                    {!isEditing && editingIdx === null && canWrite && (
                                        <div className="flex md:flex-col border-t md:border-t-0 md:border-l border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01]">
                                            {/* Move Up */}
                                            <button
                                                onClick={() => handleMovePhase(idx, -1)}
                                                disabled={idx === 0}
                                                className="flex-1 md:flex-none p-3 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white disabled:opacity-30 transition-colors"
                                                title="Move Up"
                                            >
                                                <ChevronUp size={16} />
                                            </button>
                                            
                                            {/* Move Down */}
                                            <button
                                                onClick={() => handleMovePhase(idx, 1)}
                                                disabled={idx === phases.length - 1}
                                                className="flex-1 md:flex-none p-3 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white disabled:opacity-30 transition-colors"
                                                title="Move Down"
                                            >
                                                <ChevronDown size={16} />
                                            </button>

                                            {/* Edit */}
                                            <button
                                                onClick={() => handleEditClick(idx, phase)}
                                                className="flex-1 md:flex-none p-3 flex items-center justify-center text-gray-400 hover:text-blue-500 transition-colors"
                                                title="Edit Phase"
                                            >
                                                <Pencil size={15} />
                                            </button>

                                            {/* Delete */}
                                            <button
                                                onClick={() => handleDeletePhase(idx)}
                                                className="flex-1 md:flex-none p-3 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                                                title="Delete Phase"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

            </div>
        </div>
    );
};

export default Phases;
