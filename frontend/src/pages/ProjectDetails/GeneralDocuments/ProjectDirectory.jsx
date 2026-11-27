import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Info, X, Clock, ArrowLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { generalDocsApi } from '../../../services/generalDocsApi';
import { workflowApi } from '../../../services/workflowApi';
import { toast } from 'react-toastify';
import { ExcelGrid } from '../../../components/ExcelGrid';

const ProjectDirectory = ({ onBack, setExtraBreadcrumbs = () => {}, isReadOnly = false }) => {
    const { id: projectId } = useParams();

    const [contacts, setContacts] = useState([]);
    const [projectParties, setProjectParties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [auditTrail, setAuditTrail] = useState([]);
    const [workflowState] = useState({
        instanceId: null,
        cycleId: null,
        canEdit: true,
        notConfigured: false,
        loading: false
    });

    const isEditable = workflowState.canEdit && !isReadOnly;

    const fetchLogs = useCallback(async (instanceId) => {
        if (!instanceId) return;
        try {
            const res = await workflowApi.getInstanceLogs(instanceId);
            if (res.success && res.logs) {
                const mappedLogs = res.logs.map((log) => {
                    let actionText = log.action;
                    let logType = 'update';
                    if (log.action === 'cycle_initiated') {
                        actionText = `Revision cycle V${log.version_number} started`;
                        logType = 'create';
                    } else if (log.action === 'submitted') {
                        actionText = `Submitted for Level ${log.level_order} Approval`;
                    } else if (log.action === 'revision_requested') {
                        actionText = `Revision requested at Level ${log.level_order}`;
                        logType = 'cancel';
                    } else if (log.action === 'approved') {
                        actionText = `Approved and sealed V${log.version_number}`;
                        logType = 'create';
                    } else if (log.action === 'rejected') {
                        actionText = `Rejected at Level ${log.level_order}`;
                        logType = 'cancel';
                    } else if (log.action === 'cycle_cancelled') {
                        actionText = 'Cycle cancelled';
                        logType = 'cancel';
                    } else if (log.action === 'draft_saved') {
                        actionText = 'Draft content auto-saved';
                    }
                    if (log.comments) actionText += ` (${log.comments})`;
                    return {
                        id: log.log_id,
                        action: actionText,
                        user: log.acted_by_name || 'System User',
                        timestamp: new Date(log.acted_at).toLocaleString(),
                        type: logType
                    };
                });
                setAuditTrail(mappedLogs);
            }
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        }
    }, []);

    useEffect(() => {
        if (isInfoOpen && workflowState.instanceId) {
            fetchLogs(workflowState.instanceId);
        }
    }, [isInfoOpen, workflowState.instanceId, fetchLogs]);

    useEffect(() => {
        setExtraBreadcrumbs([{ label: 'Project Directory' }]);
    }, [setExtraBreadcrumbs, projectId]);

    const fetchProjectParties = useCallback(async () => {
        try {
            const data = await generalDocsApi.getParties(projectId);
            if (data?.parties) {
                setProjectParties(data.parties);
                return data.parties;
            }
        } catch (error) {
            console.error('Failed to fetch project parties:', error);
        }
        return [];
    }, [projectId]);

    const mapDirectoryRows = useCallback((rows, partiesList = []) => (
        rows.map((c) => {
            const partyKey = c.pv_id || c.party_id;
            const matchedParty = partiesList.find((p) => (p.pv_id || p.id) == partyKey);
            return {
                id: c.pd_id || c.id,
                party_id: partyKey || null,
                pv_id: partyKey || null,
                contact_id: c.contact_id || matchedParty?.contact_id || null,
                company_name: matchedParty?.name || c.company_name || '',
                category: matchedParty?.category || c.category || '',
                job_nature: matchedParty?.job_nature || c.job_nature || '',
                contact_person: c.contact_person || '',
                designation: c.designation || '',
                responsibilities: c.responsibilities || '',
                mobile_no: c.mobile_no || '',
                email: c.email || '',
                address_line: c.address_line || ''
            };
        })
    ), []);

    const fetchDirectory = useCallback(async (partiesList = projectParties, silent = false) => {
        const list = Array.isArray(partiesList) ? partiesList : projectParties;
        try {
            if (!silent) setLoading(true);

            if (workflowState?.instanceId && !workflowState.notConfigured) {
                try {
                    let rows = [];
                    let cycleParties = [];
                    if (workflowState.cycleId) {
                        try {
                            const res = await workflowApi.getDraftContent(workflowState.instanceId);
                            rows = res.content_tables?.proj_directory || res.content_tables?.pdoc_directory || [];
                            cycleParties = res.content_tables?.proj_parties || res.content_tables?.pdoc_vendors || [];
                        } catch {
                            const res = await workflowApi.getApprovedContent(workflowState.instanceId);
                            rows = res.content?.proj_directory || res.content?.pdoc_directory || [];
                            cycleParties = res.content?.proj_parties || res.content?.pdoc_vendors || [];
                        }
                    } else {
                        const res = await workflowApi.getApprovedContent(workflowState.instanceId);
                        rows = res.content?.proj_directory || res.content?.pdoc_directory || [];
                        cycleParties = res.content?.proj_parties || res.content?.pdoc_vendors || [];
                    }
                    const effectiveParties = cycleParties.length > 0 ? cycleParties : list;
                    if (cycleParties.length > 0) setProjectParties(cycleParties);
                    setContacts(mapDirectoryRows(rows, effectiveParties));
                    return;
                } catch (err) {
                    console.log('Falling back to base directory API:', err);
                }
            }

            const data = await generalDocsApi.getDirectory(projectId);
            setContacts(mapDirectoryRows(data?.directory || [], list));
        } catch (error) {
            console.error('Failed to fetch directory:', error);
            toast.error('Failed to load project directory');
        } finally {
            setLoading(false);
        }
    }, [projectId, projectParties, workflowState, mapDirectoryRows]);

    useEffect(() => {
        const load = async () => {
            if (workflowState.loading) return;
            const partiesList = await fetchProjectParties();
            await fetchDirectory(partiesList);
        };
        load();
    }, [projectId, workflowState.loading, workflowState.instanceId, workflowState.cycleId]);

    const partyByName = useMemo(() => {
        const map = new Map();
        projectParties.forEach((p) => {
            if (p.name) map.set(p.name.trim().toLowerCase(), p);
        });
        return map;
    }, [projectParties]);

    const columns = useMemo(() => [
        {
            key: 'company_name',
            label: 'Company Name',
            type: 'dropdown',
            options: projectParties.map((p) => p.name).filter(Boolean),
            width: 210,
            aliases: ['company name', 'company', 'party', 'organization', 'name']
        },
        {
            key: 'category',
            label: 'Category',
            width: 120,
            aliases: ['category', 'type']
        },
        {
            key: 'job_nature',
            label: 'Nature of Job',
            width: 150,
            aliases: ['nature of job', 'job nature', 'trade', 'scope']
        },
        {
            key: 'contact_person',
            label: 'Contact Person',
            required: true,
            width: 170,
            aliases: ['contact person', 'person', 'poc', 'contact']
        },
        {
            key: 'designation',
            label: 'Designation',
            width: 140,
            aliases: ['designation', 'role', 'title']
        },
        {
            key: 'responsibilities',
            label: 'Responsibilities',
            width: 210,
            aliases: ['responsibilities', 'department', 'responsibility']
        },
        {
            key: 'mobile_no',
            label: 'Mobile No',
            width: 140,
            aliases: ['mobile no', 'mobile', 'phone', 'contact no', 'telephone']
        },
        {
            key: 'email',
            label: 'Email ID',
            width: 190,
            aliases: ['email', 'email id', 'mail']
        },
        {
            key: 'address_line',
            label: 'Address',
            width: 230,
            aliases: ['address', 'address line', 'location']
        }
    ], [projectParties]);

    const enrichItemWithParty = useCallback((item) => {
        const matched = item.company_name ? partyByName.get(String(item.company_name).trim().toLowerCase()) : null;
        const partyId = item.party_id || item.pv_id || matched?.pv_id || matched?.id || null;
        return {
            ...item,
            party_id: partyId,
            pv_id: partyId,
            contact_id: item.contact_id || matched?.contact_id || null,
            category: item.category || matched?.category || undefined,
            job_nature: item.job_nature || matched?.job_nature || undefined
        };
    }, [partyByName]);

    const handleSaveGridBatch = async ({ created = [], updated = [], deleted = [] }) => {
        try {
            if (workflowState?.cycleId) {
                for (const id of deleted) {
                    if (!String(id).startsWith('temp_')) {
                        await workflowApi.deleteDirectoryDraft(workflowState.cycleId, id);
                    }
                }
                for (const row of created) {
                    const enriched = enrichItemWithParty(row);
                    await workflowApi.addDirectoryDraft(workflowState.cycleId, {
                        party_id: enriched.party_id,
                        pv_id: enriched.pv_id,
                        contact_person: enriched.contact_person,
                        designation: enriched.designation,
                        responsibilities: enriched.responsibilities,
                        mobile_no: enriched.mobile_no,
                        email: enriched.email,
                        address_line: enriched.address_line
                    });
                }
                for (const row of updated) {
                    const enriched = enrichItemWithParty(row);
                    await workflowApi.updateDirectoryDraft(workflowState.cycleId, row.id, {
                        party_id: enriched.party_id,
                        pv_id: enriched.pv_id,
                        contact_person: enriched.contact_person,
                        designation: enriched.designation,
                        responsibilities: enriched.responsibilities,
                        mobile_no: enriched.mobile_no,
                        email: enriched.email,
                        address_line: enriched.address_line
                    });
                }
            } else {
                const realDeleted = deleted.filter((id) => !String(id).startsWith('temp_'));
                const items = [...created, ...updated].map(enrichItemWithParty);
                await generalDocsApi.syncDirectory(projectId, {
                    items,
                    deleted_ids: realDeleted
                });
            }
            toast.success('Project directory saved successfully');
            await fetchDirectory(projectParties, true);
        } catch (error) {
            console.error('Failed to save project directory:', error);
            toast.error(error.response?.data?.message || 'Failed to save project directory');
            throw error;
        }
    };

    const handleDeleteRow = async (row) => {
        if (!row?.id || String(row.id).startsWith('temp_')) return;
        try {
            if (workflowState?.cycleId) {
                await workflowApi.deleteDirectoryDraft(workflowState.cycleId, row.id);
            } else {
                await generalDocsApi.deleteDirectoryItem(projectId, row.id);
            }
            toast.success('Contact removed from directory');
            await fetchDirectory(projectParties, true);
        } catch (error) {
            console.error('Failed to delete directory item:', error);
            toast.error(error.response?.data?.message || 'Failed to delete directory item');
        }
    };

    return (
        <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden bg-white dark:bg-[#0d1117]">
            {/* Compact Header Bar */}
            <div className="px-4 py-2.5 border-b border-gray-200 dark:border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button
                            type="button"
                            onClick={onBack}
                            className="p-1.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 rounded-lg transition cursor-pointer"
                            title="Back to list"
                        >
                            <ArrowLeft size={16} />
                        </button>
                    )}
                    <div>
                        <h1 className="text-base font-bold text-gray-900 dark:text-white leading-tight">Project Directory</h1>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">Manage all project-related contacts and parties.</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setIsInfoOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 rounded-lg transition cursor-pointer text-xs font-semibold"
                    title="View Audit Trail"
                >
                    <Info size={14} />
                    <span>Audit Trails</span>
                </button>
            </div>

            {/* Centralized ExcelGrid Component */}
            <ExcelGrid
                data={contacts}
                columns={columns}
                primaryKey="id"
                entityName="Project Directory"
                canWrite={isEditable}
                isLoading={loading}
                onSave={handleSaveGridBatch}
                onRefresh={() => fetchDirectory(projectParties, false)}
                onDeleteRow={handleDeleteRow}
                allowAddColumn={false}
                emptyMessage="No contacts found in project directory"
            />

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
                                {auditTrail.length === 0 ? (
                                    <p className="text-xs text-gray-400 text-center py-6">No workflow audit logs recorded.</p>
                                ) : (
                                    auditTrail.map((log) => (
                                        <div key={log.id} className="relative pl-8 pb-2">
                                            <div className="absolute left-3 top-2 bottom-0 w-[1px] bg-gray-200 dark:bg-white/10" />
                                            <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-white dark:border-[#0d1117] z-10 flex items-center justify-center ${
                                                log.type === 'create' ? 'bg-green-500/20 text-green-400' :
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
                                    ))
                                )}
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

export default ProjectDirectory;
