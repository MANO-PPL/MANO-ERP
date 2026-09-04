import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { workflowApi } from '../services/workflowApi';
import {
    Shield, CheckCircle2, AlertCircle, Clock, Play,
    Send, Check, RotateCcw, X, Lock, Unlock, Loader2, Save,
    History, FileText, ChevronRight, UserCheck,
    MessageSquare, AlertTriangle, ArrowRight, Eye, CheckCheck
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-toastify';

const WorkflowPanel = ({ projectId, templateName, instanceId: propInstanceId, onStateChange, onRefreshContent, onActionComplete }) => {
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

    const lastEmittedStateRef = useRef(null);
    const loadedDocKeyRef = useRef('');

    // Modals & Version History Drawer states
    const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalAction, setModalAction] = useState(''); // 'submit', 'approve', 'request-revision', 'reject', 'cancel'
    const [comments, setComments] = useState('');
    const [changesSummary, setChangesSummary] = useState('');

    const triggerRefresh = (silent = true) => {
        if (onRefreshContent) onRefreshContent(silent);
        if (onActionComplete) onActionComplete(silent);
    };

    const loadWorkflowData = async (silent = false) => {
        if (!projectId || !templateName) {
            setLoading(false);
            return;
        }

        const key = `${projectId}-${templateName}-${propInstanceId || ''}`;
        const isNewDoc = loadedDocKeyRef.current !== key;

        if (isNewDoc && !silent) {
            setLoading(true);
        }

        try {
            const res = await workflowApi.getTemplateWorkflowStatus(projectId, templateName, propInstanceId);
            if (res && res.success) {
                setTemplate(res.template || { name: templateName, doc_type: 'singleton' });
                setTemplateDetail(res.templateDetail);
                setInstance(res.instance);
                setCurrentCycle(res.instance?.current_cycle || null);
                setVersions(res.versions || []);
                setAllCycles(res.allCycles || []);
                loadedDocKeyRef.current = key;
                setLoadedKey(key);
            }
        } catch (error) {
            console.error('Error loading workflow status:', error);
            // Default fallback template so the workflow bar is always visible and functional
            setTemplate({ name: templateName, doc_type: 'singleton' });
        } finally {
            setLoading(false);
        }
    };

    const loadInstanceData = async (instId, silent = false) => {
        await loadWorkflowData(silent);
    };

    useEffect(() => {
        if (!projectId || !templateName) {
            setLoading(false);
            return;
        }

        if (propInstanceId && instance && String(propInstanceId) === String(instance.instance_id)) {
            return;
        }

        const key = `${projectId}-${templateName}-${propInstanceId || ''}`;
        if (loadedDocKeyRef.current === key && instance) {
            return;
        }

        loadWorkflowData();
    }, [projectId, templateName, propInstanceId]);

    // Push states to parent document component safely without redundant state updates
    useEffect(() => {
        if (!onStateChange) return;

        let nextState;
        if (loading) {
            nextState = { mode: 'read', cycleId: null, loading: true };
        } else if (!instance) {
            nextState = { mode: 'read', cycleId: null, loading: false, notConfigured: false, notInitialized: true };
        } else if (currentCycle) {
            const currentUserId = user?.id ?? user?.id;
            const isHolder = String(currentCycle.current_holder_id) === String(currentUserId);
            const isEditingState = ['drafting', 'revision_requested'].includes(currentCycle.status);

            if (isHolder && isEditingState) {
                nextState = { mode: 'edit', cycleId: currentCycle.cycle_id, instanceId: instance.instance_id, loading: false };
            } else {
                nextState = { mode: 'read', cycleId: currentCycle.cycle_id || null, instanceId: instance.instance_id, loading: false };
            }
        } else {
            nextState = { mode: 'read', cycleId: null, instanceId: instance.instance_id, loading: false };
        }

        const prev = lastEmittedStateRef.current;
        if (
            prev &&
            prev.mode === nextState.mode &&
            prev.cycleId === nextState.cycleId &&
            prev.instanceId === nextState.instanceId &&
            prev.loading === nextState.loading &&
            prev.notConfigured === nextState.notConfigured &&
            prev.notInitialized === nextState.notInitialized
        ) {
            return;
        }

        lastEmittedStateRef.current = nextState;
        onStateChange(nextState);
    }, [loading, instance, currentCycle, user, onStateChange]);

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

    // Initiate approval revision cycle (Google Docs "Edit" / "Start Revision")
    const handleStartRevision = async () => {
        if (!instance) {
            await handleInitializeInstance();
            return;
        }
        try {
            setActionLoading(true);
            const res = await workflowApi.initiateCycle(instance.instance_id);
            if (res.success) {
                toast.success('Drafting mode enabled. Make your edits and submit for approval.');
                await loadInstanceData(instance.instance_id, true);
                triggerRefresh(true);
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
                triggerRefresh(true);
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
                toast.success('Draft saved successfully');
                await loadInstanceData(instance.instance_id, true);
                triggerRefresh(true);
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
                toast.success(`Workflow ${modalAction === 'submit' ? 'submitted for approval' : modalAction} successfully`);
                setModalOpen(false);
                await loadInstanceData(instance.instance_id, true);
                triggerRefresh(true);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || `Failed to ${modalAction}`);
        } finally {
            setActionLoading(false);
        }
    };

    // Determine state
    const currentUserId = user?.id ?? user?.id;
    const isHolder = String(currentCycle?.current_holder_id) === String(currentUserId);
    const isCycleAuthor = String(currentCycle?.initiated_by) === String(currentUserId);

    const documentRoles = templateDetail?.document_roles || [];
    const reporterRoles = documentRoles.filter(role => role.role === 'reporter');
    const isUserReporter = reporterRoles.length > 0
        ? reporterRoles.some(role => String(role.id) === String(currentUserId))
        : true; // Default allow write / initiate

    const latestVersionNumber = versions.length > 0 ? `v${versions[0].version_number}.0` : 'v1.0';

    if (loading) {
        return (
            <div className="flex items-center gap-2 select-none">
                <div className="h-7 w-28 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse" />
                <div className="h-7 w-36 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse" />
            </div>
        );
    }

    // Status Badge Configuration (Google Docs / Google Sheets Style)
    let statusBadge = {
        label: 'Approved & Live',
        version: latestVersionNumber,
        icon: <CheckCircle2 size={13} className="text-emerald-500" />,
        badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
        helperText: 'Document is published and verified.',
        isDrafting: false,
        isInReview: false
    };

    if (currentCycle) {
        if (currentCycle.status === 'drafting') {
            statusBadge = {
                label: 'Draft in Progress',
                version: `${latestVersionNumber} (Draft)`,
                icon: <Unlock size={13} className="text-blue-500" />,
                badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
                helperText: isHolder ? 'Editing in draft mode. Changes will be saved.' : `Locked by ${currentCycle.holder_name || 'author'} for editing.`,
                isDrafting: true,
                isInReview: false
            };
        } else if (currentCycle.status === 'in_review') {
            statusBadge = {
                label: `Review Pending (Level ${currentCycle.current_level || 1})`,
                version: `${latestVersionNumber} (Review)`,
                icon: <Clock size={13} className="text-amber-500 animate-spin" style={{ animationDuration: '4s' }} />,
                badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
                helperText: isHolder ? 'Action required: Review and approve changes.' : `Awaiting approval from ${currentCycle.holder_name || 'reviewers'}.`,
                isDrafting: false,
                isInReview: true
            };
        } else if (currentCycle.status === 'revision_requested') {
            statusBadge = {
                label: 'Revision Requested',
                version: `${latestVersionNumber} (Needs Revision)`,
                icon: <AlertTriangle size={13} className="text-orange-500" />,
                badgeClass: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200 dark:border-orange-500/30',
                helperText: isHolder ? `Feedback: "${currentCycle.last_comments || 'Please revise document'}"` : `Pending revisions from ${currentCycle.holder_name}.`,
                isDrafting: false,
                isInReview: false
            };
        }
    }

    return (
        <>
            {/* Version History & Google Docs Approval Controls */}
            <div className="flex items-center gap-2">
                {/* Version History Button (Positioned directly to the left of Request Approval / Edit) */}
                <button
                    type="button"
                    onClick={() => setIsHistoryDrawerOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-white/5 border border-gray-200 dark:border-white/10 transition cursor-pointer"
                    title="View version history"
                >
                    <History size={13} />
                    <span>Version history ({versions.length})</span>
                </button>

                {/* State 1: Live / No Active Draft -> Start Revision / Request Approval */}
                {!currentCycle && (
                    <button
                        disabled={actionLoading}
                        onClick={handleStartRevision}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                        <Play size={12} />
                        <span>Request Approval / Edit</span>
                    </button>
                )}

                {/* State 2: Active Draft & Current User is Author -> Submit for Approval & Save */}
                {currentCycle && currentCycle.status === 'drafting' && isHolder && (
                    <>
                        <button
                            disabled={actionLoading}
                            onClick={() => openCommentModal('submit')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-xs disabled:opacity-50 cursor-pointer"
                        >
                            <Send size={12} />
                            <span>Submit for Review</span>
                        </button>
                        <button
                            disabled={actionLoading}
                            onClick={handleSaveDraftChanges}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                            <Save size={12} />
                            <span>Save Draft</span>
                        </button>
                        <button
                            disabled={actionLoading}
                            onClick={() => openCommentModal('cancel')}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition cursor-pointer"
                            title="Discard Draft"
                        >
                            <X size={14} />
                        </button>
                    </>
                )}

                {/* State 3: Revision Requested */}
                {currentCycle && currentCycle.status === 'revision_requested' && (
                    isCycleAuthor ? (
                        <>
                            <button
                                disabled={actionLoading}
                                onClick={handleClaimRevision}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-xs disabled:opacity-50 cursor-pointer"
                            >
                                <RotateCcw size={12} />
                                <span>Claim Revision & Edit</span>
                            </button>
                            <button
                                disabled={actionLoading}
                                onClick={() => openCommentModal('cancel')}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-white/5 dark:text-gray-300 rounded-lg text-xs font-semibold transition cursor-pointer"
                            >
                                <X size={12} />
                                <span>Cancel</span>
                            </button>
                        </>
                    ) : (
                        <span className="text-xs text-gray-400 font-medium">
                            Awaiting author revision...
                        </span>
                    )
                )}

                {/* State 4: In Review & Current User is Reviewer/Approver */}
                {currentCycle && currentCycle.status === 'in_review' && (
                    isHolder || isUserAdmin ? (
                        <div className="flex items-center gap-1.5">
                            <button
                                disabled={actionLoading}
                                onClick={() => openCommentModal('approve')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-xs disabled:opacity-50 cursor-pointer"
                            >
                                <Check size={12} />
                                <span>Approve</span>
                            </button>
                            <button
                                disabled={actionLoading}
                                onClick={() => openCommentModal('request-revision')}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-xs disabled:opacity-50 cursor-pointer"
                            >
                                <AlertTriangle size={12} />
                                <span>Request Revision</span>
                            </button>
                            <button
                                disabled={actionLoading}
                                onClick={() => openCommentModal('reject')}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-xs disabled:opacity-50 cursor-pointer"
                            >
                                <X size={12} />
                                <span>Reject</span>
                            </button>
                        </div>
                    ) : (
                        <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                            <Lock size={12} /> Locked in review
                        </span>
                    )
                )}
            </div>

            {/* Google Docs Style Slide-Over Version History Drawer */}
            <AnimatePresence>
                {isHistoryDrawerOpen && (
                    <div className="fixed inset-0 z-[8500] overflow-hidden">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsHistoryDrawerOpen(false)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
                        />
                        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
                            <motion.div
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 26, stiffness: 280 }}
                                className="w-screen max-w-md bg-white dark:bg-[#161b22] border-l border-gray-200 dark:border-white/10 shadow-2xl flex flex-col h-full overflow-hidden text-left select-none"
                            >
                                {/* Drawer Header */}
                                <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/70 dark:bg-white/[0.02]">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-500/20">
                                            <History size={18} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Version History</h3>
                                            <p className="text-[11px] text-gray-400">{templateName} snapshot revisions</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsHistoryDrawerOpen(false)}
                                        className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                {/* Version List */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                    {versions.length === 0 ? (
                                        <div className="py-20 text-center text-gray-400 text-xs flex flex-col items-center justify-center space-y-2">
                                            <FileText size={32} className="opacity-30" />
                                            <p className="font-semibold">No version snapshots recorded yet</p>
                                            <p className="text-[11px] text-gray-400">Current live document is active as initial revision.</p>
                                        </div>
                                    ) : (
                                        versions.map((ver, idx) => (
                                            <div
                                                key={ver.version_id || idx}
                                                className={`p-3.5 rounded-xl border transition-all ${idx === 0
                                                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-500/30'
                                                        : 'bg-white dark:bg-[#0d1117]/60 border-gray-200/80 dark:border-white/5'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                                                        Version {ver.version_number}.0
                                                    </span>
                                                    {idx === 0 && (
                                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500 text-white uppercase tracking-wider">
                                                            Current Live
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-gray-500 dark:text-gray-400 space-y-0.5">
                                                    <div>Approved by: <span className="font-semibold text-gray-700 dark:text-gray-300">{ver.created_by_name || 'System / Admin'}</span></div>
                                                    <div>Date: {ver.approved_at ? new Date(ver.approved_at).toLocaleString() : new Date(ver.created_at || Date.now()).toLocaleDateString()}</div>
                                                    {ver.changes_summary && (
                                                        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1 bg-gray-50 dark:bg-white/5 p-2 rounded-lg">
                                                            "{ver.changes_summary}"
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Drawer Footer */}
                                <div className="px-6 py-3 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] flex items-center justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setIsHistoryDrawerOpen(false)}
                                        className="px-4 py-1.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 font-semibold rounded-lg text-xs hover:bg-gray-200 transition cursor-pointer"
                                    >
                                        Close
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                )}
            </AnimatePresence>

            {/* Google Docs Style Submit / Action Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
                    <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-left">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white capitalize">
                                {modalAction === 'submit' ? 'Request Approval' : `${modalAction.replace('-', ' ')}`}
                            </h3>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {modalAction === 'submit' && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Summary of Changes</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Updated project parties and subcontractor contacts"
                                    value={changesSummary}
                                    onChange={e => setChangesSummary(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs outline-none focus:border-blue-500 text-gray-900 dark:text-white font-medium"
                                />
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Notes / Review Comments</label>
                            <textarea
                                placeholder="Add any details or instructions for reviewers..."
                                rows={3}
                                value={comments}
                                onChange={e => setComments(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs outline-none focus:border-blue-500 text-gray-900 dark:text-white resize-none font-medium"
                            />
                        </div>

                        <div className="flex justify-end gap-2 text-xs pt-2">
                            <button
                                onClick={() => setModalOpen(false)}
                                className="px-4 py-2 border border-gray-200 dark:border-white/10 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 cursor-pointer transition"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={actionLoading}
                                onClick={handleExecuteAction}
                                className={`px-4 py-2 text-white font-bold rounded-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs ${modalAction === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                                        modalAction === 'request-revision' ? 'bg-amber-600 hover:bg-amber-700' :
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
        </>
    );
};

export default WorkflowPanel;
