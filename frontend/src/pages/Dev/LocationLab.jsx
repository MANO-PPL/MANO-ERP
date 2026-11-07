import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
    FolderTree,
    Plus,
    FolderPlus,
    Edit2,
    Trash2,
    Archive,
    RotateCcw,
    ArrowRightLeft,
    AlertTriangle,
    Wrench,
    Clock,
    Layers,
    Tag,
    ShieldAlert,
    FileSpreadsheet,
    Eye,
    ChevronRight,
    ChevronDown,
    RefreshCw,
    Activity,
    Info,
    X,
    Loader2,
    BookOpen,
    ShieldCheck,
    Terminal,
    Lock,
    Play,
    CheckCircle2,
    XCircle
} from 'lucide-react';

// Isolated Dev Lab API Base
const API_BASE = '/dev/locations';

const LOCATION_SPEC_CASES = [
    { num: 1, name: 'Create a root' },
    { num: 2, name: 'Create a child under a root' },
    { num: 3, name: 'Create a location 8 levels deep, then a 9th' },
    { num: 4, name: 'Two roots with the same name' },
    { num: 5, name: 'Same name differing only in case, same parent' },
    { num: 6, name: 'Same name under two different parents' },
    { num: 7, name: 'Parent from another project' },
    { num: 8, name: 'Type from another organization' },
    { num: 9, name: 'Create under an archived parent' },
    { num: 10, name: 'Move a floor with 20 descendants to another tower' },
    { num: 11, name: 'Move a location under itself' },
    { num: 12, name: 'Move a location under its own grandchild' },
    { num: 13, name: 'Move to a parent that makes the tree too deep' },
    { num: 14, name: 'Move creating a sibling name clash' },
    { num: 15, name: 'Two simultaneous moves forming cycle' },
    { num: 16, name: 'Archive then restore' },
    { num: 17, name: 'Delete a location with children' },
    { num: 18, name: 'Delete a location reported in use by usage check' },
    { num: 19, name: 'Delete a free leaf' },
    { num: 20, name: 'Delete a type that is in use' },
    { num: 21, name: 'getSubtree and getDescendantIds prefix exactness' },
    { num: 22, name: 'getAncestors of a deep unit' },
    { num: 23, name: 'ensurePath idempotency' },
    { num: 24, name: 'Corrupt paths, checkIntegrity, and rebuildPaths' },
    { num: 25, name: 'Rename a location' }
];

export default function LocationLab() {
    const { user } = useAuth();

    // Security: Organization is strictly locked to logged-in user's tenant
    const orgId = user?.org_id || 1;

    // Pickers (Freely editable to test cross-tenant and validation error handling)
    const [projectId, setProjectId] = useState(1);

    // State
    const [tree, setTree] = useState([]);
    const [types, setTypes] = useState([]);
    const [selectedNode, setSelectedNode] = useState(null);
    const [expandedNodeIds, setExpandedNodeIds] = useState(new Set());
    const [ancestors, setAncestors] = useState([]);
    const [descendantIds, setDescendantIds] = useState([]);
    const [violations, setViolations] = useState([]);
    const [callLogs, setCallLogs] = useState([]);
    const [includeArchived, setIncludeArchived] = useState(true);

    // Granular Loading State: only the specific button/action being executed is paused
    const [loadingKeys, setLoadingKeys] = useState(new Set());

    // Dialogs / Form Modals
    const [activeModal, setActiveModal] = useState(null); // 'info' | 'create_root' | 'create_child' | 'rename' | 'move' | 'types' | 'bulk_paste'
    const [modalData, setModalData] = useState({});

    // Bulk Paste
    const [bulkText, setBulkText] = useState("Tower A / Floor 1 / Unit 101\nTower A / Floor 1 / Unit 102\nTower A / Floor 2 / Unit 201\nTower B / Floor 1 / Office A");
    const [bulkProgress, setBulkProgress] = useState('');

    // In-Use Simulator set of location IDs
    const [simulatedInUseIds, setSimulatedInUseIds] = useState(new Set());

    // Integration Test Suite State
    const [testReport, setTestReport] = useState(null);
    const [resultsByCase, setResultsByCase] = useState({});
    const [testFilter, setTestFilter] = useState('all'); // 'all' | 'pass' | 'fail'
    const [expandedFailures, setExpandedFailures] = useState(new Set());

    // Helper for granular button loading
    const isKeyLoading = (key) => loadingKeys.has(key);
    const setKeyLoading = (key, isLoading) => {
        setLoadingKeys(prev => {
            const next = new Set(prev);
            if (isLoading) next.add(key);
            else next.delete(key);
            return next;
        });
    };

    const handleRunTestSuite = async (caseNum = null) => {
        const isSingle = caseNum !== null && caseNum !== undefined && caseNum !== 'all';
        const loadingKey = isSingle ? `test_case_${caseNum}` : 'test_suite';
        if (isKeyLoading(loadingKey) || isKeyLoading('test_suite')) return;
        setKeyLoading(loadingKey, true);
        setActiveModal('test_suite');
        try {
            const payload = isSingle ? { caseNum: Number(caseNum) } : {};
            const res = await callApi('post', `${API_BASE}/run-tests`, payload);
            const report = res.data;
            if (report) {
                if (isSingle) {
                    const single = report.results?.[0];
                    if (single) {
                        setResultsByCase(prev => {
                            const next = { ...prev, [single.num]: single };
                            const executed = Object.values(next);
                            const passed = executed.filter(x => x.status === 'PASS').length;
                            const failed = executed.filter(x => x.status === 'FAIL').length;
                            setTestReport(r => ({
                                total: 25,
                                passed,
                                failed,
                                durationMs: (r?.durationMs || 0) + single.durationMs,
                                results: LOCATION_SPEC_CASES.map(c => next[c.num]).filter(Boolean)
                            }));
                            return next;
                        });
                    }
                } else {
                    const map = {};
                    (report.results || []).forEach(r => { map[r.num] = r; });
                    setResultsByCase(map);
                    setTestReport(report);
                }
            }
        } catch (err) {
            console.error('Failed to run test suite:', err);
        } finally {
            setKeyLoading(loadingKey, false);
        }
    };

    // -------------------------------------------------------------
    // Logging Helper
    // -------------------------------------------------------------
    const logCall = (method, endpoint, payload, result, status = 'OK', duration = 0) => {
        setCallLogs(prev => [
            {
                id: Date.now() + Math.random(),
                time: new Date().toLocaleTimeString(),
                method,
                endpoint,
                payload,
                result,
                status,
                duration: `${duration}ms`
            },
            ...prev.slice(0, 49) // retain last 50 calls
        ]);
    };

    const callApi = async (method, url, data = null, params = null) => {
        const start = performance.now();
        try {
            const config = { method, url };
            if (data !== null && data !== undefined) {
                config.data = data;
            }
            if (params !== null && params !== undefined) {
                config.params = params;
            }
            const res = await api(config);
            const duration = Math.round(performance.now() - start);
            logCall(method.toUpperCase(), url, data || params, res.data, 'SUCCESS', duration);
            return res.data;
        } catch (err) {
            const duration = Math.round(performance.now() - start);
            const resData = err.response?.data;
            const errObj = resData?.error;

            let code = 'ERROR';
            let message = err.message;

            if (errObj && typeof errObj === 'object') {
                code = errObj.code || 'ERROR';
                message = errObj.message || err.message;
            } else if (typeof errObj === 'string') {
                message = errObj;
                code = err.response ? `HTTP_${err.response.status}` : 'ERROR';
            } else if (resData?.message) {
                message = resData.message;
                code = err.response ? `HTTP_${err.response.status}` : 'ERROR';
            }

            const errData = { code, message };
            logCall(method.toUpperCase(), url, data || params, errData, `FAIL: ${code}`, duration);
            throw errData;
        }
    };

    // -------------------------------------------------------------
    // Fetch Data
    // -------------------------------------------------------------
    const loadTypes = async () => {
        try {
            const res = await callApi('get', `${API_BASE}/types`);
            setTypes(res.data || []);
        } catch (e) {
            console.error('Failed to load types:', e);
        }
    };

    const loadTree = async () => {
        if (!projectId || isKeyLoading('tree')) return;
        setKeyLoading('tree', true);
        try {
            const res = await callApi('get', `${API_BASE}/tree`, null, {
                projectId,
                includeArchived
            });
            setTree(res.data || []);
            // Auto-expand all top-level nodes if empty
            if (res.data && res.data.length > 0) {
                setExpandedNodeIds(prev => {
                    const next = new Set(prev);
                    res.data.forEach(r => next.add(r.id));
                    return next;
                });
            }
        } catch (e) {
            setTree([]);
            setSelectedNode(null);
            console.error('Failed to load tree:', e);
        } finally {
            setKeyLoading('tree', false);
        }
    };

    const loadNodeDetails = async (node) => {
        if (!node) return;
        try {
            const [ancRes, descRes] = await Promise.all([
                callApi('get', `${API_BASE}/${node.id}/ancestors`),
                callApi('get', `${API_BASE}/${node.id}/descendants`)
            ]);
            setAncestors(ancRes.data || []);
            setDescendantIds(descRes.data || []);
        } catch (e) {
            console.error('Failed to load node inspect info:', e);
        }
    };

    useEffect(() => {
        loadTypes();
        loadTree();
        setSelectedNode(null);
        setAncestors([]);
        setDescendantIds([]);
        setViolations([]);
    }, [orgId, projectId, includeArchived]);

    useEffect(() => {
        if (selectedNode) {
            loadNodeDetails(selectedNode);
        }
    }, [selectedNode?.id]);

    // -------------------------------------------------------------
    // Tree Handlers
    // -------------------------------------------------------------
    const toggleExpand = (id) => {
        setExpandedNodeIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelectNode = (node) => {
        setSelectedNode(node);
    };

    // -------------------------------------------------------------
    // CRUD Operations
    // -------------------------------------------------------------
    const handleCreateLocation = async (e) => {
        e.preventDefault();
        if (isKeyLoading('modal_submit')) return;

        setKeyLoading('modal_submit', true);
        try {
            await callApi('post', API_BASE, {
                projectId,
                parentId: modalData.parentId || null,
                typeId: Number(modalData.typeId),
                name: modalData.name,
                code: modalData.code || null,
                sortOrder: Number(modalData.sortOrder || 0)
            });
            setActiveModal(null);
            setModalData({});
            await loadTree();
        } catch (err) {
            alert(`Error (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading('modal_submit', false);
        }
    };

    const handleUpdateLocation = async (e) => {
        e.preventDefault();
        if (isKeyLoading('modal_submit')) return;

        setKeyLoading('modal_submit', true);
        try {
            await callApi('put', `${API_BASE}/${modalData.id}`, {
                name: modalData.name,
                code: modalData.code || null,
                typeId: Number(modalData.typeId),
                sortOrder: Number(modalData.sortOrder || 0)
            });
            setActiveModal(null);
            setModalData({});
            await loadTree();
            if (selectedNode?.id === modalData.id) {
                const updated = await callApi('get', `${API_BASE}/${modalData.id}`);
                setSelectedNode(updated.data);
            }
        } catch (err) {
            alert(`Error (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading('modal_submit', false);
        }
    };

    const handleMoveLocation = async (e) => {
        e.preventDefault();
        if (isKeyLoading('modal_submit')) return;

        setKeyLoading('modal_submit', true);
        try {
            await callApi('post', `${API_BASE}/${modalData.id}/move`, {
                newParentId: modalData.newParentId ? Number(modalData.newParentId) : null,
                sortOrder: modalData.sortOrder ? Number(modalData.sortOrder) : 0
            });
            setActiveModal(null);
            setModalData({});
            await loadTree();
            if (selectedNode?.id === modalData.id) {
                const updated = await callApi('get', `${API_BASE}/${modalData.id}`);
                setSelectedNode(updated.data);
            }
        } catch (err) {
            alert(`Move Error (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading('modal_submit', false);
        }
    };

    const handleArchiveToggle = async (node) => {
        const key = `archive_${node.id}`;
        if (isKeyLoading(key)) return;

        const isCurrentlyArchived = node.status === 'archived';
        let cascade = false;
        if (!isCurrentlyArchived) {
            cascade = window.confirm("Archive all descendants recursively as well? (Cancel for parent only)");
        }

        setKeyLoading(key, true);
        try {
            if (isCurrentlyArchived) {
                await callApi('post', `${API_BASE}/${node.id}/restore`);
            } else {
                await callApi('post', `${API_BASE}/${node.id}/archive`, { cascade });
            }
            await loadTree();
            if (selectedNode?.id === node.id) {
                const updated = await callApi('get', `${API_BASE}/${node.id}`);
                setSelectedNode(updated.data);
            }
        } catch (err) {
            alert(`Archive Error (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading(key, false);
        }
    };

    const handleDelete = async (node) => {
        const key = `delete_${node.id}`;
        if (isKeyLoading(key)) return;

        if (simulatedInUseIds.has(node.id)) {
            alert(`Simulation Guard: Location #${node.id} is marked as [IN USE] by another module! Delete rejected (LOC_IN_USE).`);
            logCall('DELETE', `${API_BASE}/${node.id}`, null, { code: 'LOC_IN_USE', message: 'Simulated usage hook blocked deletion' }, 'FAIL: LOC_IN_USE', 10);
            return;
        }

        if (!window.confirm(`Permanently delete "${node.name}" (#${node.id})?`)) return;

        setKeyLoading(key, true);
        try {
            await callApi('delete', `${API_BASE}/${node.id}`);
            if (selectedNode?.id === node.id) setSelectedNode(null);
            await loadTree();
        } catch (err) {
            alert(`Delete Error (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading(key, false);
        }
    };

    // -------------------------------------------------------------
    // Integrity & Repair
    // -------------------------------------------------------------
    const handleCheckIntegrity = async () => {
        if (isKeyLoading('check_integrity')) return;

        setKeyLoading('check_integrity', true);
        try {
            const res = await callApi('get', `${API_BASE}/integrity`, null, { projectId });
            setViolations(res.data || []);
            if (res.data?.length === 0) {
                alert('🎉 Invariant Integrity Check PASSED! Zero violations found.');
            }
        } catch (err) {
            alert(`Integrity Check Error: ${err.message}`);
        } finally {
            setKeyLoading('check_integrity', false);
        }
    };

    const handleRebuildPaths = async () => {
        if (isKeyLoading('rebuild_paths')) return;

        if (!window.confirm('Recompute path and depth for every node in this project from parent_id?')) return;

        setKeyLoading('rebuild_paths', true);
        try {
            const res = await callApi('post', `${API_BASE}/rebuild-paths`, { projectId });
            alert(`Repair Completed! Repaired ${res.data?.repairedCount || 0} node path(s).`);
            await loadTree();
            await handleCheckIntegrity();
        } catch (err) {
            alert(`Rebuild Error: ${err.message}`);
        } finally {
            setKeyLoading('rebuild_paths', false);
        }
    };

    // -------------------------------------------------------------
    // Bulk Importer (ensurePath)
    // -------------------------------------------------------------
    const handleRunBulkImport = async () => {
        if (isKeyLoading('bulk_import')) return;

        if (!bulkText.trim()) return;
        const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) return;

        if (types.length === 0) {
            alert('Please seed or create types first before running bulk import!');
            return;
        }

        setKeyLoading('bulk_import', true);

        // Infer default types by index or names (site, tower, floor, unit, room)
        const typeSite = types.find(t => t.code === 'site') || types[0];
        const typeTower = types.find(t => t.code === 'tower') || types[0];
        const typeFloor = types.find(t => t.code === 'floor') || types[0];
        const typeUnit = types.find(t => t.code === 'unit') || types[0];
        const hierarchyTypes = [typeTower, typeFloor, typeUnit];

        let successCount = 0;
        try {
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                setBulkProgress(`Line ${i + 1}/${lines.length}...`);

                const rawParts = line.split('/').map(p => p.trim()).filter(Boolean);
                if (rawParts.length === 0) continue;

                const segments = rawParts.map((partName, idx) => {
                    const assignedType = hierarchyTypes[Math.min(idx, hierarchyTypes.length - 1)] || types[0];
                    return {
                        name: partName,
                        typeId: assignedType.id
                    };
                });

                try {
                    await callApi('post', `${API_BASE}/ensure-path`, {
                        projectId,
                        segments
                    });
                    successCount++;
                } catch (err) {
                    console.error(`Error importing line "${line}":`, err);
                }
            }

            alert(`Bulk Import finished: ${successCount}/${lines.length} lines processed successfully.`);
            await loadTree();
            setActiveModal(null);
        } finally {
            setKeyLoading('bulk_import', false);
            setBulkProgress('');
        }
    };

    // -------------------------------------------------------------
    // Seed Types
    // -------------------------------------------------------------
    const handleSeedTypes = async () => {
        if (isKeyLoading('seed_types')) return;

        setKeyLoading('seed_types', true);
        try {
            await callApi('post', `${API_BASE}/types/seed`);
            await loadTypes();
            alert('Standard location types seeded successfully!');
        } catch (err) {
            alert(`Seed Error: ${err.message}`);
        } finally {
            setKeyLoading('seed_types', false);
        }
    };

    // Flatten all nodes for quick dropdown selector
    const flattenNodes = (nodes) => {
        let result = [];
        nodes.forEach(n => {
            result.push(n);
            if (n.children && n.children.length > 0) {
                result = result.concat(flattenNodes(n.children));
            }
        });
        return result;
    };
    const allLocations = flattenNodes(tree);

    // -------------------------------------------------------------
    // Recursive Tree Node Renderer
    // -------------------------------------------------------------
    const renderNode = (node) => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedNodeIds.has(node.id);
        const isSelected = selectedNode?.id === node.id;
        const isArchived = node.status === 'archived';
        const isInUse = simulatedInUseIds.has(node.id);

        const isArchivingThis = isKeyLoading(`archive_${node.id}`);
        const isDeletingThis = isKeyLoading(`delete_${node.id}`);

        return (
            <div key={node.id} className="select-none text-sm">
                <div
                    onClick={() => handleSelectNode(node)}
                    className={`flex items-center justify-between px-2.5 py-1.5 my-0.5 rounded-md cursor-pointer transition-colors ${
                        isSelected
                            ? 'bg-blue-600 text-white font-medium'
                            : isArchived
                            ? 'bg-gray-100 text-gray-400 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-500'
                            : 'hover:bg-blue-50 text-gray-800 dark:text-gray-200 dark:hover:bg-gray-800'
                    }`}
                >
                    <div className="flex items-center gap-1.5 min-w-0">
                        {hasChildren ? (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExpand(node.id);
                                }}
                                className="p-0.5 hover:bg-black/10 rounded"
                            >
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                        ) : (
                            <span className="w-4" />
                        )}

                        <span className="truncate">
                            {node.name}
                        </span>

                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full uppercase tracking-wider font-semibold ${
                            isSelected
                                ? 'bg-blue-700 text-blue-100'
                                : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                            {node.type_name || node.type_code || 'Node'}
                        </span>

                        {isArchived && (
                            <span className="text-[10px] px-1 bg-amber-200 text-amber-800 rounded">
                                archived
                            </span>
                        )}

                        {isInUse && (
                            <span className="text-[10px] px-1 bg-purple-200 text-purple-800 rounded flex items-center gap-0.5">
                                <ShieldAlert size={10} /> in use
                            </span>
                        )}

                        {(isArchivingThis || isDeletingThis) && (
                            <Loader2 size={12} className="animate-spin text-blue-400 ml-1" />
                        )}
                    </div>

                    {/* Actions Menu */}
                    <div className="flex items-center gap-1 opacity-80 hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                        <button
                            title="Add Child"
                            onClick={() => {
                                setModalData({ parentId: node.id, parentName: node.name, typeId: types[0]?.id });
                                setActiveModal('create_child');
                            }}
                            className="p-1 hover:bg-black/10 rounded"
                        >
                            <FolderPlus size={13} />
                        </button>
                        <button
                            title="Rename / Edit"
                            onClick={() => {
                                setModalData({
                                    id: node.id,
                                    name: node.name,
                                    code: node.code || '',
                                    typeId: node.type_id,
                                    sortOrder: node.sort_order
                                });
                                setActiveModal('rename');
                            }}
                            className="p-1 hover:bg-black/10 rounded"
                        >
                            <Edit2 size={13} />
                        </button>
                        <button
                            title="Move Subtree"
                            onClick={() => {
                                setModalData({ id: node.id, name: node.name, currentParentId: node.parent_id });
                                setActiveModal('move');
                            }}
                            className="p-1 hover:bg-black/10 rounded"
                        >
                            <ArrowRightLeft size={13} />
                        </button>
                        <button
                            title={isArchived ? "Restore" : "Archive"}
                            disabled={isArchivingThis}
                            onClick={() => handleArchiveToggle(node)}
                            className="p-1 hover:bg-black/10 rounded disabled:opacity-40"
                        >
                            {isArchivingThis ? (
                                <Loader2 size={13} className="animate-spin text-amber-600" />
                            ) : isArchived ? (
                                <RotateCcw size={13} />
                            ) : (
                                <Archive size={13} />
                            )}
                        </button>
                        <button
                            title="Delete"
                            disabled={isDeletingThis}
                            onClick={() => handleDelete(node)}
                            className="p-1 hover:bg-red-500 hover:text-white rounded text-red-500 disabled:opacity-40"
                        >
                            {isDeletingThis ? (
                                <Loader2 size={13} className="animate-spin text-red-600" />
                            ) : (
                                <Trash2 size={13} />
                            )}
                        </button>
                    </div>
                </div>

                {hasChildren && isExpanded && (
                    <div className="pl-4 border-l border-gray-200 dark:border-gray-700 ml-2.5">
                        {node.children.map(child => renderNode(child))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 md:p-6 font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800 gap-4">
                <div>
                    <div className="flex items-center gap-2.5">
                        <FolderTree className="text-blue-600" size={26} />
                        <h1 className="text-2xl font-bold tracking-tight">Location Lab (Module 1 Spec Engine)</h1>
                        {/* Info Button */}
                        <button
                            onClick={() => setActiveModal('info')}
                            title="About this Lab, Architecture & Integration Contract"
                            className="p-1.5 text-blue-600 hover:text-blue-700 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 rounded-full transition-colors border border-blue-200 dark:border-blue-900"
                        >
                            <Info size={16} />
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                        <span>Isolated developer testing suite exercising the core Location Service engine via</span>
                        <code className="text-blue-600 dark:text-blue-400 font-mono text-[11px] bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded">
                            /api/dev/locations
                        </code>
                    </p>
                </div>

                {/* Context & Tenant Locking */}
                <div className="flex items-center gap-3">
                    {/* Read-only Org Badge (Security: locked to JWT session) */}
                    <div className="flex items-center gap-1.5 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-2.5 py-1.5 shadow-sm" title="Tenant Organization locked from verified JWT session">
                        <Lock size={12} className="text-gray-400" />
                        <span className="font-semibold text-gray-500">Org:</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200 font-mono">#{orgId}</span>
                    </div>

                    {/* Project Selector (Freely editable to test error handling & cross-org limits) */}
                    <div className="flex items-center gap-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-2.5 py-1.5 shadow-sm">
                        <span className="font-semibold text-gray-500">Project ID:</span>
                        <input
                            type="number"
                            value={projectId || ''}
                            onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')}
                            placeholder="e.g. 1"
                            className="w-16 bg-transparent outline-none font-bold text-gray-800 dark:text-gray-200"
                            title="Enter any Project ID to test valid or cross-org/error scenarios"
                        />
                    </div>

                    <button
                        onClick={loadTree}
                        disabled={isKeyLoading('tree')}
                        className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-50"
                        title="Reload Tree"
                    >
                        <RefreshCw size={16} className={isKeyLoading('tree') ? 'animate-spin text-blue-600' : ''} />
                    </button>
                </div>
            </div>

            {/* Quick Actions Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => {
                            setModalData({ typeId: types[0]?.id });
                            setActiveModal('create_root');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                    >
                        <Plus size={14} /> Add Root Location
                    </button>

                    <button
                        onClick={() => setActiveModal('bulk_paste')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                    >
                        <FileSpreadsheet size={14} /> Bulk Paste (ensurePath)
                    </button>

                    <button
                        onClick={() => setActiveModal('types')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                    >
                        <Tag size={14} /> Manage Types ({types.length})
                    </button>

                    {/* Seed Types: Only this button pauses while seeding */}
                    <button
                        disabled={isKeyLoading('seed_types')}
                        onClick={handleSeedTypes}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200 rounded-lg text-xs font-medium disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isKeyLoading('seed_types') ? (
                            <Loader2 size={14} className="animate-spin text-blue-600" />
                        ) : (
                            <Layers size={14} />
                        )}
                        <span>{isKeyLoading('seed_types') ? 'Seeding Types...' : 'Seed Default Types'}</span>
                    </button>

                    {/* Run Automated Test Suite (25 Cases) */}
                    <button
                        disabled={isKeyLoading('test_suite')}
                        onClick={handleRunTestSuite}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                        title="Execute the full 25-case Location Spec integration test suite"
                    >
                        {isKeyLoading('test_suite') ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <Play size={14} className="fill-current" />
                        )}
                        <span>{isKeyLoading('test_suite') ? 'Running 25 Tests...' : 'Run Test Suite (25)'}</span>
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer mr-2">
                        <input
                            type="checkbox"
                            checked={includeArchived}
                            onChange={(e) => setIncludeArchived(e.target.checked)}
                            className="rounded text-blue-600"
                        />
                        Show Archived
                    </label>

                    {/* Check Invariants: Only this button pauses while checking */}
                    <button
                        disabled={isKeyLoading('check_integrity')}
                        onClick={handleCheckIntegrity}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isKeyLoading('check_integrity') ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <AlertTriangle size={14} />
                        )}
                        <span>{isKeyLoading('check_integrity') ? 'Checking Invariants...' : 'Check Invariants'}</span>
                    </button>

                    {/* Rebuild Paths: Only this button pauses while rebuilding */}
                    <button
                        disabled={isKeyLoading('rebuild_paths')}
                        onClick={handleRebuildPaths}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isKeyLoading('rebuild_paths') ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <Wrench size={14} />
                        )}
                        <span>{isKeyLoading('rebuild_paths') ? 'Rebuilding Paths...' : 'Rebuild Paths (Repair)'}</span>
                    </button>
                </div>
            </div>

            {/* Invariant Violations Alert Banner */}
            {violations.length > 0 && (
                <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-200">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 font-bold text-sm">
                            <AlertTriangle size={18} className="text-red-600" />
                            <span>{violations.length} Integrity Violations Detected!</span>
                        </div>
                        <button
                            disabled={isKeyLoading('rebuild_paths')}
                            onClick={handleRebuildPaths}
                            className="px-2.5 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded font-medium shadow-sm disabled:opacity-50"
                        >
                            {isKeyLoading('rebuild_paths') ? 'Repairing...' : 'Auto-Repair With rebuildPaths()'}
                        </button>
                    </div>
                    <ul className="list-disc pl-5 text-xs space-y-1">
                        {violations.map((v, idx) => (
                            <li key={idx}>
                                <span className="font-semibold">{v.type}:</span> {v.details} (Location #{v.locationId})
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Main 3-Column Studio Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
                {/* COLUMN 1: Tree View (4 cols) */}
                <div className="lg:col-span-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col h-[750px]">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FolderTree size={16} className="text-blue-500" />
                            <span className="font-bold text-xs uppercase tracking-wider text-gray-600 dark:text-gray-300">
                                Hierarchy Tree ({allLocations.length})
                            </span>
                            {isKeyLoading('tree') && <Loader2 size={13} className="animate-spin text-blue-500" />}
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setExpandedNodeIds(new Set(allLocations.map(n => n.id)))}
                                className="text-[11px] text-blue-600 hover:underline px-1"
                            >
                                Expand All
                            </button>
                            <span className="text-gray-300 dark:text-gray-600">|</span>
                            <button
                                onClick={() => setExpandedNodeIds(new Set())}
                                className="text-[11px] text-blue-600 hover:underline px-1"
                            >
                                Collapse
                            </button>
                        </div>
                    </div>

                    <div className="p-3 flex-1 overflow-y-auto">
                        {isKeyLoading('tree') && tree.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-xs gap-2">
                                <Loader2 size={22} className="animate-spin text-blue-600" />
                                <span>Loading tree structure...</span>
                            </div>
                        ) : tree.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-center text-gray-400">
                                <FolderTree size={36} className="mb-2 opacity-30" />
                                <p className="text-xs font-medium">No locations in Project #{projectId || '—'}</p>
                                <p className="text-[11px] mt-1 text-gray-400">
                                    Click "Add Root Location" or "Bulk Paste" to begin.
                                </p>
                            </div>
                        ) : (
                            tree.map(node => renderNode(node))
                        )}
                    </div>
                </div>

                {/* COLUMN 2: Node Inspector & Hierarchy Tools (4 cols) */}
                <div className="lg:col-span-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col h-[750px] overflow-hidden">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Eye size={16} className="text-indigo-500" />
                            <span className="font-bold text-xs uppercase tracking-wider text-gray-600 dark:text-gray-300">
                                Node Inspector
                            </span>
                        </div>
                        {selectedNode && (
                            <span className="text-[11px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 font-mono">
                                #{selectedNode.id}
                            </span>
                        )}
                    </div>

                    <div className="p-4 flex-1 overflow-y-auto space-y-4">
                        {selectedNode ? (
                            <>
                                {/* Raw Database Row Attributes */}
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                                        Raw Row Fields (Single Source of Truth)
                                    </h3>
                                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700 font-mono text-xs space-y-1.5">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">id:</span>
                                            <span className="font-bold">{selectedNode.id}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">parent_id:</span>
                                            <span className="font-bold">{selectedNode.parent_id ?? 'NULL (Root)'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">name:</span>
                                            <span className="font-bold text-blue-600 dark:text-blue-400">{selectedNode.name}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">path:</span>
                                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedNode.path}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">depth:</span>
                                            <span className="font-bold">{selectedNode.depth}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">type:</span>
                                            <span>{selectedNode.type_name} ({selectedNode.type_code})</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">status:</span>
                                            <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                                                selectedNode.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                                            }`}>
                                                {selectedNode.status}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">code:</span>
                                            <span>{selectedNode.code || 'NULL'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">sort_order:</span>
                                            <span>{selectedNode.sort_order}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* In-Use Simulator Protection Toggle */}
                                <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <ShieldAlert size={16} className="text-purple-600" />
                                            <div>
                                                <p className="text-xs font-bold text-purple-900 dark:text-purple-200">
                                                    In-Use Simulation Hook
                                                </p>
                                                <p className="text-[10px] text-purple-700 dark:text-purple-300">
                                                    Protects location from deletion via registerUsageCheck()
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSimulatedInUseIds(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(selectedNode.id)) next.delete(selectedNode.id);
                                                    else next.add(selectedNode.id);
                                                    return next;
                                                });
                                            }}
                                            className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                                                simulatedInUseIds.has(selectedNode.id)
                                                    ? 'bg-purple-700 text-white'
                                                    : 'bg-white border border-purple-300 text-purple-700 hover:bg-purple-100'
                                            }`}
                                        >
                                            {simulatedInUseIds.has(selectedNode.id) ? 'PROTECTED (In Use)' : 'Free (Not In Use)'}
                                        </button>
                                    </div>
                                </div>

                                {/* Ancestor Breadcrumb */}
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                                        Ancestors (getAncestors - Breadcrumb)
                                    </h3>
                                    {ancestors.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic">None (This node is a root).</p>
                                    ) : (
                                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                            {ancestors.map((anc, idx) => (
                                                <React.Fragment key={anc.id}>
                                                    <span
                                                        onClick={() => setSelectedNode(anc)}
                                                        className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 cursor-pointer font-medium"
                                                    >
                                                        {anc.name} (#{anc.id})
                                                    </span>
                                                    {idx < ancestors.length - 1 && <ChevronRight size={12} className="text-gray-400" />}
                                                </React.Fragment>
                                            ))}
                                            <ChevronRight size={12} className="text-gray-400" />
                                            <span className="font-bold text-blue-600">{selectedNode.name}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Descendants ID List */}
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                                        Subtree Descendants (getDescendantIds: {descendantIds.length})
                                    </h3>
                                    <div className="p-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-mono break-words">
                                        [{descendantIds.join(', ')}]
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        Includes itself. Used for one-query roll-ups by other modules (progress, stock, documents).
                                    </p>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 text-center text-gray-400">
                                <Info size={32} className="mb-2 opacity-30" />
                                <p className="text-xs">Select any location from the tree to inspect its raw row and hierarchy graph.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* COLUMN 3: Real-Time API Call Log (4 cols) */}
                <div className="lg:col-span-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col h-[750px] overflow-hidden">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Activity size={16} className="text-emerald-500" />
                            <span className="font-bold text-xs uppercase tracking-wider text-gray-600 dark:text-gray-300">
                                Live Service API Call Log ({callLogs.length})
                            </span>
                        </div>
                        <button
                            onClick={() => setCallLogs([])}
                            className="text-[11px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                        >
                            Clear
                        </button>
                    </div>

                    <div className="p-3 flex-1 overflow-y-auto space-y-2 font-mono text-xs">
                        {callLogs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-center text-gray-400">
                                <Clock size={32} className="mb-2 opacity-30" />
                                <p className="text-xs">No API calls recorded yet.</p>
                            </div>
                        ) : (
                            callLogs.map(log => {
                                const isSuccess = log.status === 'SUCCESS';
                                return (
                                    <div
                                        key={log.id}
                                        className={`p-2.5 rounded-lg border ${
                                            isSuccess
                                                ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800'
                                                : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                                    log.method === 'GET' ? 'bg-blue-100 text-blue-700' :
                                                    log.method === 'POST' ? 'bg-emerald-100 text-emerald-700' :
                                                    log.method === 'PUT' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                    {log.method}
                                                </span>
                                                <span className="text-[11px] font-semibold truncate max-w-[170px]" title={log.endpoint}>
                                                    {log.endpoint}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                                                <span>{log.duration}</span>
                                                <span>{log.time}</span>
                                            </div>
                                        </div>

                                        <div className="text-[11px]">
                                            <span className={`font-semibold ${isSuccess ? 'text-emerald-600' : 'text-red-600'}`}>
                                                [{log.status}]
                                            </span>
                                        </div>

                                        {log.payload && (
                                            <div className="mt-1 text-[10px] text-gray-500 overflow-x-auto truncate">
                                                Payload: {JSON.stringify(log.payload)}
                                            </div>
                                        )}
                                        {!isSuccess && log.result && (
                                            <div className="mt-1 text-[10px] text-red-600 dark:text-red-400 font-medium break-words">
                                                {log.result.message || (typeof log.result === 'string' ? log.result : JSON.stringify(log.result))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* MODALS / DIALOGS */}

            {/* 0. Information Modal ('ℹ️') */}
            {activeModal === 'info' && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between pb-3.5 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-2.5">
                                <BookOpen className="text-blue-600" size={22} />
                                <h2 className="text-lg font-bold">About Location Lab & Architecture Guide</h2>
                            </div>
                            <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600 p-1">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-1 flex-1 overflow-y-auto mt-4 space-y-4 text-xs leading-relaxed text-gray-700 dark:text-gray-300">
                            {/* Notice Banner */}
                            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200">
                                <div className="flex items-center gap-2 font-bold text-sm mb-1">
                                    <AlertTriangle size={16} className="text-amber-600" />
                                    <span>Developer Test Harness Notice</span>
                                </div>
                                <p>
                                    This page is a <strong>diagnostic and developer test lab</strong> designed to verify Module 1's hierarchy invariants, atomic subtree moves, and path repair functions. It calls the isolated test route <code className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1 rounded">/api/dev/locations</code>.
                                </p>
                                <p className="mt-1">
                                    This is <strong>not the end-user production screen</strong> or standard API. End-users in modules like DPR, Procurement, or Quality select locations via standard dropdowns and tree pickers.
                                </p>
                            </div>

                            {/* Section 1: Endpoints */}
                            <div className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                                <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                                    <Terminal size={15} className="text-purple-600" />
                                    API Endpoint Architecture
                                </h3>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>
                                        <strong>Production Endpoints (<code className="text-blue-600 font-mono">/api/locations/*</code>)</strong>: Minimal, high-performance CRUD and hierarchy queries used by business modules.
                                    </li>
                                    <li>
                                        <strong>Dev Lab Endpoints (<code className="text-purple-600 font-mono">/api/dev/locations/*</code>)</strong>: Includes test and diagnostic tools (<code className="font-mono">checkIntegrity</code>, <code className="font-mono">rebuildPaths</code>, <code className="font-mono">ensurePath</code>, and vocabulary seeder). Protected by multi-level clearance.
                                    </li>
                                </ul>
                            </div>

                            {/* Section 2: Integration Contract for Other Modules */}
                            <div className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                                <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                                    <ShieldCheck size={15} className="text-emerald-600" />
                                    Integration Contract for Other Modules
                                </h3>
                                <div className="space-y-1.5">
                                    <p><strong>1. Store ONLY location_id:</strong> Never duplicate location names or hierarchy paths into other tables (DPR, stock entries, etc.).</p>
                                    <p><strong>2. Roll-Ups (Never Walk the Tree):</strong> Always use <code className="font-mono bg-gray-200 dark:bg-gray-800 px-1 rounded">getDescendantIds()</code> or an SQL range scan using index (<code className="font-mono bg-gray-200 dark:bg-gray-800 px-1 rounded">WHERE path LIKE '/1/5/%'</code>).</p>
                                    <p><strong>3. Delete Protection Hooks:</strong> Register a usage check with <code className="font-mono bg-gray-200 dark:bg-gray-800 px-1 rounded">registerUsageCheck()</code> as soon as your module references a location so active locations cannot be deleted.</p>
                                    <p><strong>4. Soft-Archive vs. Delete:</strong> Non-leaf locations or locations in use by other modules can be archived, but never permanently deleted.</p>
                                </div>
                            </div>

                            {/* Section 3: Technical Highlights */}
                            <div className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700 space-y-1.5">
                                <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                                    <Layers size={15} className="text-blue-600" />
                                    Database Hierarchy Guarantees
                                </h3>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li><strong>Single Source of Truth:</strong> <code className="font-mono">parent_id</code> is the definitive hierarchy. <code className="font-mono">path</code> and <code className="font-mono">depth</code> are indexed materialized copies.</li>
                                    <li><strong>Self-Healing:</strong> If paths are corrupted, <code className="font-mono">rebuildPaths()</code> recomputes the entire tree strictly from <code className="font-mono">parent_id</code>.</li>
                                    <li><strong>Atomic Moves:</strong> Moving any branch locks the subtree with <code className="font-mono">SELECT ... FOR UPDATE</code> and rewrites all descendant paths and depths in a single SQL statement.</li>
                                    <li><strong>Sibling Uniqueness:</strong> Handled by stored generated column <code className="font-mono">parent_key = IFNULL(parent_id, 0)</code>, comparing roots as parent 0.</li>
                                </ul>
                            </div>
                        </div>

                        <div className="flex justify-end pt-3.5 border-t border-gray-200 dark:border-gray-700 mt-2">
                            <button
                                onClick={() => setActiveModal(null)}
                                className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 1. Create Location Modal (Root or Child) */}
            {(activeModal === 'create_root' || activeModal === 'create_child') && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-base font-bold">
                                {activeModal === 'create_root' ? 'Create Root Location' : `Create Child Under "${modalData.parentName}"`}
                            </h2>
                            <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateLocation} className="mt-4 space-y-3.5">
                            <div>
                                <label className="block text-xs font-semibold mb-1">Location Name *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Tower A, Floor 3, Unit 301"
                                    value={modalData.name || ''}
                                    onChange={(e) => setModalData({ ...modalData, name: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold mb-1">Vocabulary Type *</label>
                                <select
                                    required
                                    value={modalData.typeId || ''}
                                    onChange={(e) => setModalData({ ...modalData, typeId: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    {types.map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.name} ({t.code})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold mb-1">Code (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. TWR-A"
                                        value={modalData.code || ''}
                                        onChange={(e) => setModalData({ ...modalData, code: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1">Sort Order</label>
                                    <input
                                        type="number"
                                        value={modalData.sortOrder || 0}
                                        onChange={(e) => setModalData({ ...modalData, sortOrder: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm outline-none"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={() => setActiveModal(null)}
                                    className="px-4 py-2 rounded-lg text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isKeyLoading('modal_submit')}
                                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-wait"
                                >
                                    {isKeyLoading('modal_submit') && <Loader2 size={13} className="animate-spin" />}
                                    <span>{isKeyLoading('modal_submit') ? 'Saving...' : 'Save Location'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 2. Rename / Edit Modal */}
            {activeModal === 'rename' && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-base font-bold">Edit Location #{modalData.id}</h2>
                            <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateLocation} className="mt-4 space-y-3.5">
                            <div>
                                <label className="block text-xs font-semibold mb-1">Location Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={modalData.name || ''}
                                    onChange={(e) => setModalData({ ...modalData, name: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold mb-1">Vocabulary Type</label>
                                <select
                                    value={modalData.typeId || ''}
                                    onChange={(e) => setModalData({ ...modalData, typeId: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none"
                                >
                                    {types.map(t => (
                                        <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold mb-1">Code</label>
                                    <input
                                        type="text"
                                        value={modalData.code || ''}
                                        onChange={(e) => setModalData({ ...modalData, code: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1">Sort Order</label>
                                    <input
                                        type="number"
                                        value={modalData.sortOrder || 0}
                                        onChange={(e) => setModalData({ ...modalData, sortOrder: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm outline-none"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={() => setActiveModal(null)}
                                    className="px-4 py-2 rounded-lg text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isKeyLoading('modal_submit')}
                                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-wait"
                                >
                                    {isKeyLoading('modal_submit') && <Loader2 size={13} className="animate-spin" />}
                                    <span>{isKeyLoading('modal_submit') ? 'Saving...' : 'Save Changes'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 3. Move Subtree Modal */}
            {activeModal === 'move' && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-base font-bold">Move Subtree: "{modalData.name}"</h2>
                            <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleMoveLocation} className="mt-4 space-y-3.5">
                            <p className="text-xs text-gray-500">
                                Moving this location will atomically rewrite the path and depth of this node and all of its descendants.
                            </p>

                            <div>
                                <label className="block text-xs font-semibold mb-1">Target New Parent</label>
                                <select
                                    value={modalData.newParentId || ''}
                                    onChange={(e) => setModalData({ ...modalData, newParentId: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none"
                                >
                                    <option value="">[Make Root - No Parent]</option>
                                    {allLocations
                                        .filter(loc => loc.id !== modalData.id)
                                        .map(loc => (
                                            <option key={loc.id} value={loc.id}>
                                                {'-- '.repeat(loc.depth - 1)}{loc.name} (#{loc.id})
                                            </option>
                                        ))}
                                </select>
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={() => setActiveModal(null)}
                                    className="px-4 py-2 rounded-lg text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isKeyLoading('modal_submit')}
                                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-wait"
                                >
                                    {isKeyLoading('modal_submit') && <Loader2 size={13} className="animate-spin" />}
                                    <span>{isKeyLoading('modal_submit') ? 'Moving...' : 'Execute Move'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 4. Bulk Paste Importer Modal */}
            {activeModal === 'bulk_paste' && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-base font-bold flex items-center gap-2">
                                <FileSpreadsheet size={18} className="text-emerald-500" />
                                Bulk Paste Importer (ensurePath)
                            </h2>
                            <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="mt-4 space-y-3">
                            <p className="text-xs text-gray-500">
                                Paste slash-delimited paths (one per line). Missing intermediate levels are created idempotently:
                            </p>

                            <textarea
                                rows={8}
                                value={bulkText}
                                onChange={(e) => setBulkText(e.target.value)}
                                className="w-full p-3 font-mono text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-emerald-500"
                            />

                            <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                                <span className="text-xs font-semibold text-emerald-600">
                                    {bulkProgress}
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setActiveModal(null)}
                                        className="px-4 py-2 rounded-lg text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isKeyLoading('bulk_import')}
                                        onClick={handleRunBulkImport}
                                        className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-wait"
                                    >
                                        {isKeyLoading('bulk_import') && <Loader2 size={13} className="animate-spin" />}
                                        <span>{isKeyLoading('bulk_import') ? 'Importing...' : 'Run ensurePath() Import'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 5. Vocabulary / Type Manager Modal */}
            {activeModal === 'types' && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-base font-bold flex items-center gap-2">
                                <Tag size={18} className="text-indigo-500" />
                                Type Vocabulary Manager (Org #{orgId})
                            </h2>
                            <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-1 flex-1 overflow-y-auto mt-3 space-y-3">
                            <div className="space-y-1.5">
                                {types.map(t => {
                                    const isDeletingType = isKeyLoading(`delete_type_${t.id}`);
                                    return (
                                        <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs">
                                            <div>
                                                <span className="font-bold">{t.name}</span>
                                                <span className="text-gray-400 ml-2 font-mono">({t.code})</span>
                                            </div>
                                            <button
                                                disabled={isDeletingType}
                                                onClick={async () => {
                                                    const key = `delete_type_${t.id}`;
                                                    if (isKeyLoading(key)) return;
                                                    if (!window.confirm(`Delete type "${t.name}"?`)) return;
                                                    setKeyLoading(key, true);
                                                    try {
                                                        await callApi('delete', `${API_BASE}/types/${t.id}`);
                                                        await loadTypes();
                                                    } catch (err) {
                                                        alert(`Error (${err.code}): ${err.message}`);
                                                    } finally {
                                                        setKeyLoading(key, false);
                                                    }
                                                }}
                                                className="text-red-500 hover:text-red-700 p-1 disabled:opacity-40"
                                                title="Delete Type"
                                            >
                                                {isDeletingType ? (
                                                    <Loader2 size={13} className="animate-spin text-red-600" />
                                                ) : (
                                                    <Trash2 size={13} />
                                                )}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Add New Type Form */}
                            <div className="p-3 bg-gray-100 dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-700 mt-4">
                                <h3 className="text-xs font-bold mb-2">Add New Vocabulary Type</h3>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <input
                                        type="text"
                                        placeholder="Name (e.g. Wing)"
                                        id="new_type_name"
                                        className="p-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Code (e.g. wing)"
                                        id="new_type_code"
                                        className="p-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                    />
                                </div>
                                <button
                                    type="button"
                                    disabled={isKeyLoading('create_type')}
                                    onClick={async () => {
                                        if (isKeyLoading('create_type')) return;
                                        const nameEl = document.getElementById('new_type_name');
                                        const codeEl = document.getElementById('new_type_code');
                                        if (!nameEl.value || !codeEl.value) {
                                            alert('Please enter both name and code.');
                                            return;
                                        }
                                        setKeyLoading('create_type', true);
                                        try {
                                            await callApi('post', `${API_BASE}/types`, {
                                                name: nameEl.value.trim(),
                                                code: codeEl.value.trim()
                                            });
                                            nameEl.value = '';
                                            codeEl.value = '';
                                            await loadTypes();
                                        } catch (err) {
                                            alert(`Error (${err.code}): ${err.message}`);
                                        } finally {
                                            setKeyLoading('create_type', false);
                                        }
                                    }}
                                    className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-wait"
                                >
                                    {isKeyLoading('create_type') && <Loader2 size={13} className="animate-spin" />}
                                    <span>{isKeyLoading('create_type') ? 'Adding Type...' : 'Add Type'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-end pt-3 border-t border-gray-200 dark:border-gray-700 mt-2">
                            <button
                                type="button"
                                onClick={() => setActiveModal(null)}
                                className="px-4 py-2 rounded-lg text-xs font-semibold bg-gray-200 dark:bg-gray-700 hover:bg-gray-300"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 6. Integration Test Suite Runner Modal ('test_suite') */}
            {activeModal === 'test_suite' && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-gray-900 text-gray-100 rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-gray-700 max-h-[88vh] flex flex-col font-sans">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                                    <Terminal size={20} />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                                        Location Spec Test Suite
                                        <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                                            25 Cases
                                        </span>
                                    </h2>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        Automated verification of hierarchy invariants, atomic subtree moves & delete hooks
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleRunTestSuite()}
                                    disabled={isKeyLoading('test_suite')}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                                >
                                    {isKeyLoading('test_suite') ? (
                                        <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                        <Play size={13} className="fill-current" />
                                    )}
                                    <span>{isKeyLoading('test_suite') ? 'Running All...' : 'Run All (25)'}</span>
                                </button>
                                <button
                                    onClick={() => setActiveModal(null)}
                                    className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Summary / Stats Header */}
                        <div className="grid grid-cols-4 gap-3 py-3.5 border-b border-gray-800 text-xs">
                            <div className="bg-gray-800/60 rounded-lg p-2.5 border border-gray-700/50">
                                <span className="text-gray-400 block text-[11px]">Executed</span>
                                <span className="text-lg font-bold text-white font-mono">{Object.keys(resultsByCase).length} / 25</span>
                            </div>
                            <div className="bg-emerald-950/40 rounded-lg p-2.5 border border-emerald-800/40">
                                <span className="text-emerald-400 block text-[11px]">Passed</span>
                                <span className="text-lg font-bold text-emerald-300 font-mono">{Object.values(resultsByCase).filter(r => r.status === 'PASS').length}</span>
                            </div>
                            <div className={`rounded-lg p-2.5 border ${Object.values(resultsByCase).filter(r => r.status === 'FAIL').length > 0 ? 'bg-red-950/40 border-red-800/50' : 'bg-gray-800/40 border-gray-700/50'}`}>
                                <span className={`${Object.values(resultsByCase).filter(r => r.status === 'FAIL').length > 0 ? 'text-red-400' : 'text-gray-400'} block text-[11px]`}>Failed</span>
                                <span className={`text-lg font-bold font-mono ${Object.values(resultsByCase).filter(r => r.status === 'FAIL').length > 0 ? 'text-red-400' : 'text-gray-400'}`}>{Object.values(resultsByCase).filter(r => r.status === 'FAIL').length}</span>
                            </div>
                            <div className="bg-gray-800/60 rounded-lg p-2.5 border border-gray-700/50">
                                <span className="text-gray-400 block text-[11px]">Execution Time</span>
                                <span className="text-lg font-bold text-indigo-300 font-mono">{testReport?.durationMs || Object.values(resultsByCase).reduce((a, b) => a + (b.durationMs || 0), 0)}ms</span>
                            </div>
                        </div>

                        {/* Filter Tabs & Quick Info */}
                        <div className="flex items-center justify-between pt-3 pb-2 text-xs">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setTestFilter('all')}
                                    className={`px-2.5 py-1 rounded-md font-semibold ${testFilter === 'all' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
                                >
                                    All (25)
                                </button>
                                <button
                                    onClick={() => setTestFilter('pass')}
                                    className={`px-2.5 py-1 rounded-md font-semibold ${testFilter === 'pass' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
                                >
                                    Passed ({Object.values(resultsByCase).filter(r => r.status === 'PASS').length})
                                </button>
                                {Object.values(resultsByCase).filter(r => r.status === 'FAIL').length > 0 && (
                                    <button
                                        onClick={() => setTestFilter('fail')}
                                        className={`px-2.5 py-1 rounded-md font-semibold ${testFilter === 'fail' ? 'bg-red-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
                                    >
                                        Failed ({Object.values(resultsByCase).filter(r => r.status === 'FAIL').length})
                                    </button>
                                )}
                            </div>
                            <span className="text-[11px] text-gray-500">
                                Click "Run" on any case to test individually
                            </span>
                        </div>

                        {/* Interactive Console Stream */}
                        <div className="flex-1 overflow-y-auto mt-2 bg-black/60 rounded-xl p-3 border border-gray-800 font-mono text-xs space-y-1.5 min-h-[320px]">
                            {isKeyLoading('test_suite') && (
                                <div className="flex items-center justify-center p-3 mb-2 bg-emerald-950/40 border border-emerald-800/50 rounded-lg text-emerald-300 gap-2">
                                    <Loader2 size={16} className="animate-spin text-emerald-400" />
                                    <span className="text-xs">Running all 25 live database test cases...</span>
                                </div>
                            )}

                            {LOCATION_SPEC_CASES.map(c => {
                                const executed = resultsByCase[c.num];
                                return executed ? { ...c, ...executed } : { ...c, status: 'IDLE', durationMs: null, error: null };
                            })
                            .filter(t => testFilter === 'all' || (testFilter === 'pass' && t.status === 'PASS') || (testFilter === 'fail' && t.status === 'FAIL'))
                            .map(t => {
                                const isPass = t.status === 'PASS';
                                const isFail = t.status === 'FAIL';
                                const isCaseLoading = isKeyLoading(`test_case_${t.num}`);
                                const isExpanded = expandedFailures.has(t.num);
                                return (
                                    <div
                                        key={t.num}
                                        className={`p-2 rounded-lg border transition-colors ${
                                            isPass
                                                ? 'bg-gray-900/60 border-gray-800/80 hover:bg-gray-900'
                                                : isFail
                                                ? 'bg-red-950/30 border-red-900/60 hover:bg-red-950/50'
                                                : 'bg-gray-900/30 border-gray-800/40 hover:bg-gray-900/60 text-gray-400'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 truncate pr-2">
                                                {isPass ? (
                                                    <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                                                ) : isFail ? (
                                                    <XCircle size={15} className="text-red-400 shrink-0" />
                                                ) : (
                                                    <span className="w-3.5 h-3.5 rounded-full border border-gray-600 inline-block shrink-0" />
                                                )}
                                                <span className="text-gray-400 text-[11px] font-bold shrink-0">
                                                    Case {t.num}:
                                                </span>
                                                <span className={`text-[12px] truncate ${isPass ? 'text-gray-200' : isFail ? 'text-red-200 font-semibold' : 'text-gray-400'}`}>
                                                    {t.name}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 text-[11px] text-gray-400">
                                                {t.durationMs !== null && (
                                                    <span className="font-mono text-gray-500">{t.durationMs}ms</span>
                                                )}
                                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                                    isPass
                                                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                                        : isFail
                                                        ? 'bg-red-950 text-red-400 border border-red-800'
                                                        : 'bg-gray-800 text-gray-500 border border-gray-700'
                                                }`}>
                                                    {t.status}
                                                </span>
                                                {isFail && (
                                                    <button
                                                        onClick={() => {
                                                            setExpandedFailures(prev => {
                                                                const next = new Set(prev);
                                                                if (next.has(t.num)) next.delete(t.num);
                                                                else next.add(t.num);
                                                                return next;
                                                            });
                                                        }}
                                                        className="text-blue-400 underline text-[10px]"
                                                    >
                                                        {isExpanded ? 'Hide' : 'Inspect'}
                                                    </button>
                                                )}
                                                <button
                                                    title={`Run Case ${t.num} individually`}
                                                    disabled={isCaseLoading || isKeyLoading('test_suite')}
                                                    onClick={() => handleRunTestSuite(t.num)}
                                                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 text-[11px] font-medium transition-colors disabled:opacity-50"
                                                >
                                                    {isCaseLoading ? (
                                                        <Loader2 size={11} className="animate-spin text-blue-400" />
                                                    ) : (
                                                        <Play size={10} className="fill-current text-blue-400" />
                                                    )}
                                                    <span>{isCaseLoading ? 'Testing...' : 'Run'}</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Expanded Failure Stack */}
                                        {isFail && isExpanded && t.error && (
                                            <div className="mt-2 p-2.5 bg-black/70 rounded border border-red-900/80 text-[11px] text-red-300 font-mono whitespace-pre-wrap">
                                                <div className="font-bold text-red-400 mb-1">{t.error.message}</div>
                                                <div className="text-[10px] text-gray-400 overflow-x-auto">{t.error.stack}</div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-between pt-3.5 border-t border-gray-800 mt-3 text-xs text-gray-400">
                            <span className="text-[11px]">
                                Tests run in isolated test tenant (#9991, #9992) and clean up automatically.
                            </span>
                            <button
                                type="button"
                                onClick={() => setActiveModal(null)}
                                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-white transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
