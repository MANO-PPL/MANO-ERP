import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { workflowApi } from '../services/workflowApi';
import { 
    Shield, CheckCircle2, AlertCircle, Clock, Play, 
    Send, Check, RotateCcw, X, Lock, Unlock, Loader2, Save 
} from 'lucide-react';
import { toast } from 'react-toastify';

const WorkflowPanel = ({ projectId, templateName, instanceId: propInstanceId, onStateChange, onRefreshContent }) => {
    const { user, isAdmin: isUserAdmin } = useAuth();
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [template, setTemplate] = useState(null);
    const [instance, setInstance] = useState(null);
    const [currentCycle, setCurrentCycle] = useState(null);
    const [allCycles, setAllCycles] = useState([]);
    const [versions, setVersions] = useState([]);
    const [templateDetail, setTemplateDetail] = useState(null);
    const [loadedKey, setLoadedKey] = useState('');

    // Modals & Comment states
    const [modalOpen, setModalOpen] = useState(false);
    const [modalAction, setModalAction] = useState(''); // 'submit', 'approve', 'request-revision', 'reject', 'cancel'
    const [comments, setComments] = useState('');
    const [changesSummary, setChangesSummary] = useState('');

    const loadWorkflowData = async (silent = false) => {
        const key = `${projectId}-${templateName}`;
        const isNewDoc = loadedKey !== key;

        if (isNewDoc && !silent) {
            setLoading(true);
            setTemplate(null);
            setInstance(null);
            setCurrentCycle(null);
        }

        try {
            const res = await workflowApi.getTemplateWorkflowStatus(projectId, templateName, propInstanceId);
            if (res.success) {
                if (res.notConfigured) {
                    setTemplate(null);
                    setTemplateDetail(null);
                    setInstance(null);
                    setCurrentCycle(null);
                    setVersions([]);
                    setAllCycles([]);
                } else {
                    setTemplate(res.template);
                    setTemplateDetail(res.templateDetail);
                    setInstance(res.instance);
                    setCurrentCycle(res.instance?.current_cycle || null);
                    setVersions(res.versions || []);
                    setAllCycles(res.allCycles || []);
                }
                setLoadedKey(key);
            }
        } catch (error) {
            console.error('Error loading workflow status:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadInstanceData = async (instId, silent = false) => {
        await loadWorkflowData(silent);
    };

    useEffect(() => {
        if (projectId && templateName) {
            // Avoid redundant fetches if the instance ID matches the currently loaded instance
            if (propInstanceId && instance && propInstanceId === instance.instance_id) {
                return;
            }
            loadWorkflowData();
        }
    }, [projectId, templateName, propInstanceId]);

    // Push states to parent document component
    useEffect(() => {
        if (!onStateChange) return;

        if (loading) {
            onStateChange({ mode: 'read', cycleId: null, loading: true });
            return;
        }

        if (!template || !instance) {
            onStateChange({ mode: 'read', cycleId: null, loading: false, notConfigured: !template, notInitialized: !!template && !instance });
            return;
        }

        // If a cycle is active and current user is holder:
        if (currentCycle) {
            const isHolder = currentCycle.current_holder_id === user?.user_id || currentCycle.current_holder_id === user?.id;
            const isEditingState = ['drafting', 'revision_requested'].includes(currentCycle.status);
            
            if (isHolder && isEditingState) {
                onStateChange({ mode: 'edit', cycleId: currentCycle.cycle_id, instanceId: instance.instance_id, loading: false });
                return;
            }
        }

        onStateChange({ mode: 'read', cycleId: currentCycle?.cycle_id || null, instanceId: instance.instance_id, loading: false });
    }, [loading, template, instance, currentCycle, user]);

    // Handle initializing singleton document instance
    const handleInitializeInstance = async () => {
        if (!template) return;
        try {
            setActionLoading(true);
            const res = await workflowApi.createInstance(projectId, {
                document_id: template.document_id,
                title: templateName
            });
            if (res.success) {
                toast.success('Document workflow initialized successfully');
                await loadWorkflowData();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to initialize document workflow');
        } finally {
            setActionLoading(false);
        }
    };

    // Initiate approval cycle
    const handleStartRevision = async () => {
        if (!instance) return;
        try {
            setActionLoading(true);
            const res = await workflowApi.initiateCycle(instance.instance_id);
            if (res.success) {
                toast.success('New draft cycle initiated');
                await loadInstanceData(instance.instance_id, true);
                if (onRefreshContent) onRefreshContent(true);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to start revision');
        } finally {
            setActionLoading(false);
        }
    };

    // Claim revision
    const handleClaimRevision = async () => {
        if (!currentCycle) return;
        try {
            setActionLoading(true);
            const res = await workflowApi.claimRevision(currentCycle.cycle_id);
            if (res.success) {
                toast.success('Revision cycle claimed successfully');
                await loadInstanceData(instance.instance_id, true);
                if (onRefreshContent) onRefreshContent(true);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to claim revision');
        } finally {
            setActionLoading(false);
        }
    };

    // Save draft changes
    const handleSaveDraftChanges = async () => {
        if (!currentCycle) return;
        try {
            setActionLoading(true);
            const res = await workflowApi.saveDraft(currentCycle.cycle_id, {});
            if (res.success) {
                toast.success('Draft changes saved successfully');
                await loadInstanceData(instance.instance_id, true);
                if (onRefreshContent) onRefreshContent(true);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save changes');
        } finally {
            setActionLoading(false);
        }
    };

    // Open modals for comments
    const openCommentModal = (action) => {
        setModalAction(action);
        setComments('');
        setChangesSummary('');
        setModalOpen(true);
    };

    // Execute cycle change actions
    const handleExecuteAction = async () => {
        if (!currentCycle) return;
        try {
            setActionLoading(true);
            let res;
            if (modalAction === 'submit') {
                res = await workflowApi.submitDraft(currentCycle.cycle_id, {
                    changes_summary: changesSummary,
                    comments
                });
            } else if (modalAction === 'approve') {
                res = await workflowApi.submitDraft(currentCycle.cycle_id, {
                    comments
                });
            } else if (modalAction === 'request-revision') {
                res = await workflowApi.requestRevision(currentCycle.cycle_id, comments);
            } else if (modalAction === 'reject') {
                res = await workflowApi.rejectCycle(currentCycle.cycle_id, comments);
            } else if (modalAction === 'cancel') {
                res = await workflowApi.cancelCycle(currentCycle.cycle_id, comments);
            }

            if (res && res.success) {
                toast.success(`Cycle ${modalAction} completed successfully`);
                setModalOpen(false);
                await loadInstanceData(instance.instance_id, true);
                if (onRefreshContent) onRefreshContent(true);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || `Failed to ${modalAction}`);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[72px] p-4 bg-gray-50/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl flex items-center justify-center text-xs text-gray-500">
                <Loader2 size={14} className="animate-spin mr-2" /> Loading approval workflow panel...
            </div>
        );
    }

    if (!template) {
        return (
            <div className="min-h-[72px] p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-2xl flex items-center justify-between text-xs text-yellow-600 dark:text-yellow-400">
                <div className="flex items-center gap-2">
                    <AlertCircle size={15} />
                    <span>Approval workflow is not yet configured for this section. Please configure it in the Approvals tab.</span>
                </div>
            </div>
        );
    }

    if (!instance) {
        if (template.doc_type === 'singleton') {
            return (
                <div className="min-h-[72px] p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-center justify-between text-xs text-blue-600 dark:text-blue-400">
                    <div className="flex items-center gap-2">
                        <span>Workflow setup ready. The document template needs to be initialized.</span>
                    </div>
                    <button
                        disabled={actionLoading}
                        onClick={handleInitializeInstance}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold transition-all active:scale-95 text-[11px] disabled:opacity-50 cursor-pointer"
                    >
                        {actionLoading ? 'Initializing...' : 'Initialize Document'}
                    </button>
                </div>
            );
        } else {
            return null; // Episodic workflows only show banner once detail instance is open
        }
    }

    // Determine workflow state elements
    const currentUserId = user?.user_id ?? user?.id;
    const isHolder = String(currentCycle?.current_holder_id) === String(currentUserId);
    const isCycleAuthor = String(currentCycle?.initiated_by) === String(currentUserId);

    const documentRoles = templateDetail?.document_roles || [];
    const reporterRoles = documentRoles.filter(role => role.role === 'reporter');
    const isUserReporter = reporterRoles.length > 0
        ? reporterRoles.some(role => String(role.user_id) === String(currentUserId))
        : isUserAdmin;

    let badgeColor = 'bg-gray-100 text-gray-800 dark:bg-white/5 dark:text-gray-400';
    let statusText = 'Finalized / Read Only';
    let statusDesc = instance?.latest_approved_version_id
        ? 'Latest approved content is published and locked. Revisions must be initiated by a reporter.'
        : 'Latest approved content is published and visible.';
    let icon = null;

    if (currentCycle) {
        if (currentCycle.status === 'drafting') {
            badgeColor = 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30';
            statusText = isHolder ? 'Drafting Mode (You)' : 'Drafting Mode';
            statusDesc = isHolder 
                ? 'You are currently drafting revisions. Edits will save as draft content.'
                : `Locked by ${currentCycle.holder_name || 'author'} for editing.`;
            icon = null;
        } else if (currentCycle.status === 'in_review') {
            badgeColor = 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30';
            statusText = isHolder ? 'Pending Your Review' : 'In Review';
            statusDesc = isHolder 
                ? 'Review is pending your action. You can Approve, Reject, or Request Revision.'
                : `Level ${currentCycle.current_level}: Pending review from ${currentCycle.holder_name}.`;
            icon = <Clock size={16} className="text-yellow-500 animate-spin" style={{ animationDuration: '3s' }} />;
        } else if (currentCycle.status === 'revision_requested') {
            badgeColor = 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30';
            statusText = isHolder ? 'Revision Required (You)' : 'Revision Required';
            statusDesc = isHolder 
                ? `Revision requested: "${currentCycle.last_comments || 'No comments'}"`
                : `Pending revision claim by author. Current holder: ${currentCycle.holder_name}.`;
            icon = <AlertCircle size={16} className="text-orange-500 animate-pulse" />;
        }
    }

    return (
        <div className="min-h-[72px] mb-4 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden anim-fade-in text-left">
            <div className="px-5 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight">{templateName} Workflow</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}>
                                {statusText}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
                            {icon}
                            <span>{statusDesc}</span>
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    {!currentCycle && (!instance?.latest_approved_version_id || isUserReporter) && (
                        <button
                            disabled={actionLoading}
                            onClick={handleStartRevision}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                            <Play size={12} /> Start Revision
                        </button>
                    )}

                    {currentCycle && currentCycle.status === 'drafting' && isHolder && (
                        <>
                            <button
                                disabled={actionLoading}
                                onClick={() => openCommentModal('submit')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                                <Send size={12} /> Submit Approval
                            </button>
                            <button
                                disabled={actionLoading}
                                onClick={handleSaveDraftChanges}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                                <Save size={12} /> Save Changes
                            </button>
                            <button
                                disabled={actionLoading}
                                onClick={() => openCommentModal('cancel')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-gray-300 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                                <X size={12} /> Cancel Draft
                            </button>
                        </>
                    )}

                {currentCycle && currentCycle.status === 'revision_requested' && (
                    isCycleAuthor ? (
                            <>
                                <button
                                    disabled={actionLoading}
                                    onClick={handleClaimRevision}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                                >
                                    <RotateCcw size={12} /> Claim Revision
                                </button>
                                <button
                                    disabled={actionLoading}
                                    onClick={() => openCommentModal('cancel')}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-gray-300 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                                >
                                    <X size={12} /> Cancel Cycle
                                </button>
                            </>
                        ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                Waiting for the reporter who started this cycle to claim the revision.
                            </span>
                        )
                    )}

                    {currentCycle && currentCycle.status === 'in_review' && isHolder && (
                        <>
                            <button
                                disabled={actionLoading}
                                onClick={() => openCommentModal('approve')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                                <Check size={12} /> Approve
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Comment popup Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-xs">
                    <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-2xl w-[420px] p-6 shadow-2xl space-y-4 animate-scale-in text-left">
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white capitalize">
                                {modalAction === 'submit' ? 'Submit changes for approval' : `${modalAction} cycle`}
                            </h3>
                            <p className="text-xs text-gray-400 mt-1">Please enter details or comments regarding your action.</p>
                        </div>

                        {modalAction === 'submit' && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Changes Summary</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Added new subcontractor contacts"
                                    value={changesSummary}
                                    onChange={e => setChangesSummary(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs outline-none focus:border-blue-500 text-gray-900 dark:text-white"
                                />
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Comments / Notes</label>
                            <textarea
                                placeholder="Write any remarks here..."
                                rows={3}
                                value={comments}
                                onChange={e => setComments(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs outline-none focus:border-blue-500 text-gray-900 dark:text-white resize-none"
                            />
                        </div>

                        <div className="flex justify-end gap-2 text-xs">
                            <button
                                onClick={() => setModalOpen(false)}
                                className="px-4 py-2 border border-gray-200 dark:border-white/10 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={actionLoading}
                                onClick={handleExecuteAction}
                                className={`px-4 py-2 text-white font-bold rounded-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer ${
                                    modalAction === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                                    modalAction === 'request-revision' ? 'bg-orange-600 hover:bg-orange-700' :
                                    modalAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' :
                                    'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                {actionLoading ? 'Processing...' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {actionLoading && (
                <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm transition-all">
                    <div className="flex flex-col items-center space-y-4 p-8 bg-[#161b22]/95 border border-white/10 rounded-2xl shadow-2xl animate-scale-in">
                        <div className="relative w-16 h-16 flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                            <div className="absolute inset-2 rounded-full border-4 border-b-emerald-500 border-t-transparent border-r-transparent border-l-transparent animate-spin" style={{ animationDirection: 'reverse' }}></div>
                            <div className="w-6 h-6 rounded-full bg-blue-500/20 animate-pulse"></div>
                        </div>
                        <div className="text-center space-y-1">
                            <h3 className="text-sm font-bold text-white tracking-wide">Processing Workflow Action</h3>
                            <p className="text-xs text-gray-400">Please wait while the system updates the database...</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkflowPanel;
