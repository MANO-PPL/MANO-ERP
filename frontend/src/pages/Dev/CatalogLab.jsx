import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
    Package,
    Wrench,
    HardHat,
    Truck,
    Plus,
    Edit2,
    Trash2,
    Archive,
    RotateCcw,
    ArrowRightLeft,
    AlertTriangle,
    ShieldCheck,
    ShieldAlert,
    Clock,
    Calculator,
    Download,
    RefreshCw,
    History,
    Lock,
    Terminal,
    Play,
    CheckCircle2,
    XCircle,
    Loader2,
    X,
    Search,
    Scale,
    GitCompare,
    Sparkles
} from 'lucide-react';

const API_BASE = '/dev/catalog';

const CATALOG_SPEC_CASES = [
    { num: 1, name: 'Create a master material with a base unit' },
    { num: 2, name: 'Duplicate code in the same scope' },
    { num: 3, name: 'Same code in two different projects, and same code as a master' },
    { num: 4, name: "Change a resource's kind" },
    { num: 5, name: 'Convert g to kg and cft to m3' },
    { num: 6, name: 'Convert kg to bag with no conversion' },
    { num: 7, name: 'Define 1 bag = 50 kg for cement, convert both ways' },
    { num: 8, name: 'setRate on a resource with no rate' },
    { num: 9, name: 'setRate with a later date' },
    { num: 10, name: 'setRate with a date inside a past period' },
    { num: 11, name: 'getRate on the day before, the day of, and the day after a change' },
    { num: 12, name: 'getRate with no rate in force' },
    { num: 13, name: "setRate in a unit with no link to the base unit's category" },
    { num: 14, name: 'getRate inUnit bag for a resource priced per kg, with a conversion' },
    { num: 15, name: 'correctRate with and without a reason' },
    { num: 16, name: 'removeRate on a past rate and a future rate' },
    { num: 17, name: 'importResource into a project' },
    { num: 18, name: 'Import the same master again (idempotent)' },
    { num: 19, name: 'Import with asNewVariant and a different code' },
    { num: 20, name: 'Import from a project row' },
    { num: 21, name: 'Rename and re-rate a project copy' },
    { num: 22, name: 'Edit a master rate' },
    { num: 23, name: 'getSyncDiff, then acceptSync with only the rate selected' },
    { num: 24, name: 'Create an activity with an output unit' },
    { num: 25, name: 'setNorm with a resource from another scope' },
    { num: 26, name: 'setNorm in an incompatible unit' },
    { num: 27, name: 'Overlapping norm periods' },
    { num: 28, name: 'importActivity reuses existing project resource copies' },
    { num: 29, name: 'importActivity twice (idempotent)' },
    { num: 30, name: 'computeActivityCost with norms in different units and a rate change mid-year' },
    { num: 31, name: 'computeActivityCost with one missing rate' },
    { num: 32, name: 'Excavation (labour + equipment only) and empty-norm activity' },
    { num: 33, name: 'expectedUsage for 20 m2 of brickwork on a given date' },
    { num: 34, name: 'Archive a resource, then add it to a new norm' },
    { num: 35, name: 'Delete a resource used by a norm or registered check' },
    { num: 36, name: 'Delete an unused resource' },
    { num: 37, name: 'Two simultaneous setRate calls for the same resource' },
    { num: 38, name: 'Two simultaneous imports of the same master' },
    { num: 39, name: 'Corrupt rows by direct SQL, then run checkIntegrity' },
    { num: 40, name: 'assertProjectScoped with the wrong project' },
    { num: 41, name: 'expectedUsage with wastage percentage and unit conversion' },
    { num: 42, name: 'computeActivityCost uses gross quantity for line amount and total' },
    { num: 43, name: 'Default 0 leaves results unchanged, out-of-range wastage is rejected' },
    { num: 44, name: 'importActivity copies wastage_pct, getSyncDiff detects it and acceptSync updates it' },
];

const KIND_BADGE = {
    material: { label: 'Material', icon: Package, cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' },
    labour: { label: 'Labour', icon: HardHat, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
    equipment: { label: 'Equipment', icon: Truck, cls: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' },
};

export default function CatalogLab() {
    const { user } = useAuth();
    const orgId = user?.org_id || 1;
    const todayIso = new Date().toISOString().slice(0, 10);

    // Scope switcher: 'master' | 'project'
    const [scopeMode, setScopeMode] = useState('master');
    const [projectId, setProjectId] = useState(1);

    // Active workspace tab
    const [activeTab, setActiveTab] = useState('resources'); // 'resources' | 'activities' | 'units' | 'import_sync' | 'calculator'

    // Core Data
    const [units, setUnits] = useState([]);
    const [resources, setResources] = useState([]);
    const [masterResources, setMasterResources] = useState([]);
    const [activities, setActivities] = useState([]);
    const [masterActivities, setMasterActivities] = useState([]);

    // Data-loading states (for clearing old data & showing loading skeletons immediately)
    const [loadingResources, setLoadingResources] = useState(false);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [loadingUnits, setLoadingUnits] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [loadingChangeLog, setLoadingChangeLog] = useState(false);
    const [loadingSync, setLoadingSync] = useState(false);

    // Filters
    const [kindFilter, setKindFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [searchText, setSearchText] = useState('');

    // Selected items
    const [selectedResource, setSelectedResource] = useState(null);
    const [selectedRates, setSelectedRates] = useState([]);
    const [selectedConversions, setSelectedConversions] = useState([]);
    const [selectedActivity, setSelectedActivity] = useState(null);

    // Rate query tester
    const [rateQueryDate, setRateQueryDate] = useState(todayIso);
    const [rateQueryUnitId, setRateQueryUnitId] = useState('');
    const [rateQueryResult, setRateQueryResult] = useState(undefined);

    // Free unit converter
    const [convQty, setConvQty] = useState('1');
    const [convFromUnitId, setConvFromUnitId] = useState('');
    const [convToUnitId, setConvToUnitId] = useState('');
    const [convResourceId, setConvResourceId] = useState('');
    const [convOutput, setConvOutput] = useState(null);

    // Cost & Expected Usage Calculator
    const [calcActivityId, setCalcActivityId] = useState('');
    const [calcDate, setCalcDate] = useState(todayIso);
    const [calcOutputQty, setCalcOutputQty] = useState('20');
    const [calcCostResult, setCalcCostResult] = useState(null);
    const [calcUsageResult, setCalcUsageResult] = useState(null);

    // Import & Sync
    const [importEntity, setImportEntity] = useState('resource');
    const [importMasterId, setImportMasterId] = useState('');
    const [importAsVariant, setImportAsVariant] = useState(false);
    const [importCode, setImportCode] = useState('');
    const [importName, setImportName] = useState('');
    const [syncTargetType, setSyncTargetType] = useState('resource');
    const [syncTargetId, setSyncTargetId] = useState('');
    const [syncStatus, setSyncStatus] = useState(null);
    const [syncDiff, setSyncDiff] = useState(null);
    const [syncSelection, setSyncSelection] = useState({ fields: [], rates: false, conversions: false, norms: false });

    // Housekeeping: Change Log, In-Use Simulator, Integrity, Call Log
    const [changeLogEntity, setChangeLogEntity] = useState('resource');
    const [changeLogId, setChangeLogId] = useState('');
    const [changeLogs, setChangeLogs] = useState([]);
    const [simInUse, setSimInUse] = useState({ resourceIds: [], activityIds: [] });
    const [violations, setViolations] = useState([]);
    const [callLogs, setCallLogs] = useState([]);

    // Modals & Loading
    const [loadingKeys, setLoadingKeys] = useState(new Set());
    const [activeModal, setActiveModal] = useState(null);
    const [modalData, setModalData] = useState({});

    // Test Suite Modal State
    const [testReport, setTestReport] = useState(null);
    const [resultsByCase, setResultsByCase] = useState({});
    const [testFilter, setTestFilter] = useState('all');
    const [expandedFailures, setExpandedFailures] = useState(new Set());

    const isKeyLoading = (key) => loadingKeys.has(key);
    const setKeyLoading = (key, isLoading) => {
        setLoadingKeys(prev => {
            const next = new Set(prev);
            if (isLoading) next.add(key);
            else next.delete(key);
            return next;
        });
    };

    const logCall = (method, endpoint, payload, result, status = 'SUCCESS', duration = 0) => {
        setCallLogs(prev => [
            {
                id: Date.now() + Math.random(),
                time: new Date().toLocaleTimeString(),
                method,
                endpoint,
                payload,
                result,
                status,
                duration: `${duration}ms`,
            },
            ...prev.slice(0, 49),
        ]);
    };

    const callApi = async (method, url, data = null, params = null) => {
        const start = performance.now();
        try {
            const config = { method, url };
            if (data !== null && data !== undefined) config.data = data;
            if (params !== null && params !== undefined) config.params = params;
            const res = await api(config);
            const duration = Math.round(performance.now() - start);
            logCall(method.toUpperCase(), url, data || params, res.data, 'SUCCESS', duration);
            return res.data;
        } catch (err) {
            const duration = Math.round(performance.now() - start);
            const resData = err.response?.data;
            const errObj = resData?.error;
            const code = (errObj && errObj.code) || (err.response ? `HTTP_${err.response.status}` : 'ERROR');
            const message = (errObj && errObj.message) || resData?.message || err.message;
            const errData = { code, message };
            logCall(method.toUpperCase(), url, data || params, errData, `FAIL: ${code}`, duration);
            throw errData;
        }
    };

    const scopeParams = useMemo(() => {
        if (scopeMode === 'master') return { scope: 'master' };
        return { projectId: Number(projectId) || 1 };
    }, [scopeMode, projectId]);

    // Data loaders
    const loadUnits = async () => {
        setLoadingUnits(true);
        try {
            const res = await callApi('get', `${API_BASE}/units`);
            setUnits(res.data || []);
        } catch (_) {
            setUnits([]);
        } finally {
            setLoadingUnits(false);
        }
    };

    const loadResources = async () => {
        setLoadingResources(true);
        setResources([]); // Immediately clear old data
        try {
            const res = await callApi('get', `${API_BASE}/resources`, null, {
                ...scopeParams,
                kind: kindFilter || undefined,
                status: statusFilter || undefined,
                search: searchText || undefined,
            });
            setResources(res.data || []);
        } catch (_) {
            setResources([]);
        } finally {
            setLoadingResources(false);
        }
    };

    const loadActivities = async () => {
        setLoadingActivities(true);
        setActivities([]); // Immediately clear old data
        try {
            const res = await callApi('get', `${API_BASE}/activities`, null, {
                ...scopeParams,
                status: statusFilter || undefined,
                search: searchText || undefined,
            });
            setActivities(res.data || []);
        } catch (_) {
            setActivities([]);
        } finally {
            setLoadingActivities(false);
        }
    };

    const loadMasters = async () => {
        try {
            const [rRes, aRes] = await Promise.all([
                callApi('get', `${API_BASE}/resources`, null, { scope: 'master' }),
                callApi('get', `${API_BASE}/activities`, null, { scope: 'master' }),
            ]);
            setMasterResources(rRes.data || []);
            setMasterActivities(aRes.data || []);
        } catch (_) {}
    };

    const loadInUseSim = async () => {
        try {
            const res = await callApi('get', `${API_BASE}/in-use-simulator`);
            setSimInUse(res.data || { resourceIds: [], activityIds: [] });
        } catch (_) {}
    };

    const loadResourceDetails = async (resRow) => {
        if (!resRow) {
            setSelectedRates([]);
            setSelectedConversions([]);
            setLoadingDetails(false);
            return;
        }
        setLoadingDetails(true);
        setSelectedRates([]); // Immediately vanish old resource rates
        setSelectedConversions([]); // Immediately vanish old resource conversions
        try {
            const [rRes, cRes] = await Promise.all([
                callApi('get', `${API_BASE}/resources/${resRow.id}/rates`),
                callApi('get', `${API_BASE}/resources/${resRow.id}/conversions`),
            ]);
            setSelectedRates(rRes.data || []);
            setSelectedConversions(cRes.data || []);
            setChangeLogEntity('resource');
            setChangeLogId(String(resRow.id));
            loadChangeLog('resource', resRow.id);
        } catch (_) {
            setSelectedRates([]);
            setSelectedConversions([]);
        } finally {
            setLoadingDetails(false);
        }
    };

    const loadChangeLog = async (entity, id) => {
        if (!entity || !id) {
            setChangeLogs([]);
            return;
        }
        setKeyLoading('load_changelog', true);
        setLoadingChangeLog(true);
        setChangeLogs([]); // Immediately vanish old change logs
        try {
            const res = await callApi('get', `${API_BASE}/changelog/${entity}/${id}`);
            setChangeLogs(res.data || []);
        } catch (_) {
            setChangeLogs([]);
        } finally {
            setLoadingChangeLog(false);
            setKeyLoading('load_changelog', false);
        }
    };

    const refreshAll = async () => {
        if (isKeyLoading('refresh_all')) return;
        setKeyLoading('refresh_all', true);
        try {
            await Promise.all([loadUnits(), loadResources(), loadActivities(), loadMasters(), loadInUseSim()]);
        } finally {
            setKeyLoading('refresh_all', false);
        }
    };

    useEffect(() => {
        loadUnits();
        loadMasters();
        loadInUseSim();
    }, [orgId]);

    useEffect(() => {
        setSelectedResource(null);
        setSelectedActivity(null);
        setSelectedRates([]);
        setSelectedConversions([]);
        loadResources();
        loadActivities();
    }, [scopeMode, projectId, kindFilter, statusFilter, searchText]);

    useEffect(() => {
        if (selectedResource) {
            loadResourceDetails(selectedResource);
        } else {
            setSelectedRates([]);
            setSelectedConversions([]);
        }
    }, [selectedResource?.id]);

    // Handlers: Units
    const handleSeedUnits = async () => {
        setKeyLoading('seed_units', true);
        try {
            await callApi('post', `${API_BASE}/units/seed`);
            await loadUnits();
        } catch (err) {
            alert(`Global Units Sync Error (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading('seed_units', false);
        }
    };

    const handleCreateUnit = async (e) => {
        e.preventDefault();
        setKeyLoading('modal_submit', true);
        try {
            await callApi('post', `${API_BASE}/units`, {
                code: modalData.code,
                name: modalData.name,
                category: modalData.category,
                toBaseFactor: modalData.toBaseFactor,
                isBase: Boolean(modalData.isBase),
            });
            setActiveModal(null);
            await loadUnits();
        } catch (err) {
            alert(`Create Unit Error (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading('modal_submit', false);
        }
    };

    const handleConvertUnits = async (e) => {
        e.preventDefault();
        if (isKeyLoading('convert_units')) return;
        setKeyLoading('convert_units', true);
        setConvOutput(null); // Clear previous result immediately
        try {
            const res = await callApi('post', `${API_BASE}/units/convert`, {
                qty: convQty,
                fromUnitId: Number(convFromUnitId),
                toUnitId: Number(convToUnitId),
                resourceId: convResourceId ? Number(convResourceId) : null,
            });
            setConvOutput({ ok: true, value: res.data.result });
        } catch (err) {
            setConvOutput({ ok: false, error: `${err.code}: ${err.message}` });
        } finally {
            setKeyLoading('convert_units', false);
        }
    };

    // Handlers: Resources
    const handleCreateResource = async (e) => {
        e.preventDefault();
        setKeyLoading('modal_submit', true);
        try {
            await callApi('post', `${API_BASE}/resources`, {
                projectId: scopeMode === 'project' ? Number(projectId) : null,
                kind: modalData.kind || 'material',
                code: modalData.code,
                name: modalData.name,
                baseUnitId: Number(modalData.baseUnitId),
                description: modalData.description || null,
            });
            setActiveModal(null);
            await Promise.all([loadResources(), loadMasters()]);
        } catch (err) {
            alert(`Error (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading('modal_submit', false);
        }
    };

    const handleUpdateResource = async (e) => {
        e.preventDefault();
        setKeyLoading('modal_submit', true);
        try {
            const res = await callApi('put', `${API_BASE}/resources/${modalData.id}`, {
                code: modalData.code,
                name: modalData.name,
                kind: modalData.kind,
                baseUnitId: Number(modalData.baseUnitId),
                description: modalData.description || null,
            });
            setActiveModal(null);
            await Promise.all([loadResources(), loadMasters()]);
            if (selectedResource?.id === modalData.id) setSelectedResource(res.data);
        } catch (err) {
            alert(`Error (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading('modal_submit', false);
        }
    };

    const handleResourceArchiveToggle = async (r) => {
        const key = `archive_res_${r.id}`;
        if (isKeyLoading(key)) return;
        setKeyLoading(key, true);
        try {
            const path = r.status === 'archived' ? 'restore' : 'archive';
            const res = await callApi('post', `${API_BASE}/resources/${r.id}/${path}`);
            await Promise.all([loadResources(), loadMasters()]);
            if (selectedResource?.id === r.id) setSelectedResource(res.data);
        } catch (err) {
            alert(`Error (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading(key, false);
        }
    };

    const handleDeleteResource = async (r) => {
        const key = `delete_res_${r.id}`;
        if (isKeyLoading(key)) return;
        if (!window.confirm(`Delete resource "${r.name}" (${r.code})?`)) return;
        setKeyLoading(key, true);
        try {
            await callApi('delete', `${API_BASE}/resources/${r.id}`);
            if (selectedResource?.id === r.id) setSelectedResource(null);
            await Promise.all([loadResources(), loadMasters()]);
        } catch (err) {
            alert(`Delete Blocked (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading(key, false);
        }
    };

    // Handlers: Rates
    const handleAddRate = async (e) => {
        e.preventDefault();
        setKeyLoading('modal_submit', true);
        try {
            await callApi('post', `${API_BASE}/resources/${selectedResource.id}/rates`, {
                rate: modalData.rate,
                unitId: Number(modalData.unitId),
                effectiveFrom: modalData.effectiveFrom,
                note: modalData.note || null,
            });
            setActiveModal(null);
            await loadResourceDetails(selectedResource);
        } catch (err) {
            alert(`Rate Error (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading('modal_submit', false);
        }
    };

    const handleCorrectRate = async (e) => {
        e.preventDefault();
        setKeyLoading('modal_submit', true);
        try {
            await callApi('put', `${API_BASE}/rates/${modalData.rateId}`, {
                patch: {
                    rate: modalData.rate,
                    unitId: Number(modalData.unitId),
                    note: modalData.note,
                },
                reason: modalData.reason,
            });
            setActiveModal(null);
            await loadResourceDetails(selectedResource);
        } catch (err) {
            alert(`Correct Rate Error (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading('modal_submit', false);
        }
    };

    const handleRemoveRate = async (rateRow) => {
        const key = `remove_rate_${rateRow.id}`;
        if (isKeyLoading(key)) return;
        const reason = window.prompt('Reason for removing future rate:', 'Cancelled');
        if (!reason) return;
        setKeyLoading(key, true);
        try {
            await callApi('delete', `${API_BASE}/rates/${rateRow.id}`, { reason });
            await loadResourceDetails(selectedResource);
        } catch (err) {
            alert(`Remove Rate Error (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading(key, false);
        }
    };

    const handleQueryRate = async () => {
        if (!selectedResource || isKeyLoading('query_rate')) return;
        setKeyLoading('query_rate', true);
        try {
            const res = await callApi('get', `${API_BASE}/resources/${selectedResource.id}/rate`, null, {
                date: rateQueryDate,
                inUnit: rateQueryUnitId || undefined,
            });
            setRateQueryResult(res.data);
        } catch (err) {
            setRateQueryResult({ error: `${err.code}: ${err.message}` });
        } finally {
            setKeyLoading('query_rate', false);
        }
    };

    // Handlers: Conversions
    const handleAddConversion = async (e) => {
        e.preventDefault();
        setKeyLoading('modal_submit', true);
        try {
            await callApi('post', `${API_BASE}/resources/${selectedResource.id}/conversions`, {
                fromUnitId: Number(modalData.fromUnitId),
                toUnitId: Number(modalData.toUnitId),
                factor: modalData.factor,
            });
            setActiveModal(null);
            await loadResourceDetails(selectedResource);
        } catch (err) {
            alert(`Conversion Error (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading('modal_submit', false);
        }
    };

    const handleRemoveConversion = async (convId) => {
        const key = `remove_conv_${convId}`;
        if (isKeyLoading(key)) return;
        setKeyLoading(key, true);
        try {
            await callApi('delete', `${API_BASE}/conversions/${convId}`);
            await loadResourceDetails(selectedResource);
        } catch (err) {
            alert(`Remove Conversion Error (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading(key, false);
        }
    };

    // Handlers: Activities & Norms
    const handleCreateActivity = async (e) => {
        e.preventDefault();
        setKeyLoading('modal_submit', true);
        try {
            const created = await callApi('post', `${API_BASE}/activities`, {
                projectId: scopeMode === 'project' ? Number(projectId) : null,
                code: modalData.code,
                name: modalData.name,
                outputUnitId: Number(modalData.outputUnitId),
                description: modalData.description || null,
            });
            setActiveModal(null);
            await Promise.all([loadActivities(), loadMasters()]);
            setSelectedActivity(created.data);
        } catch (err) {
            alert(`Activity Error (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading('modal_submit', false);
        }
    };

    const handleCreateExcavationSample = async () => {
        if (isKeyLoading('seed_excavation')) return;
        const m3 = units.find(u => u.code === 'm3');
        const hr = units.find(u => u.code === 'hr');
        if (!m3 || !hr) {
            alert('Units not loaded. Please ensure global units are present.');
            return;
        }
        setKeyLoading('seed_excavation', true);
        try {
            const ts = String(Date.now()).slice(-4);
            const op = await callApi('post', `${API_BASE}/resources`, {
                projectId: scopeMode === 'project' ? Number(projectId) : null,
                kind: 'labour',
                code: `LAB-OP-${ts}`,
                name: `Excavator Operator ${ts}`,
                baseUnitId: hr.id,
            });
            const eq = await callApi('post', `${API_BASE}/resources`, {
                projectId: scopeMode === 'project' ? Number(projectId) : null,
                kind: 'equipment',
                code: `EQ-JCB-${ts}`,
                name: `JCB 3DX ${ts}`,
                baseUnitId: hr.id,
            });
            await callApi('post', `${API_BASE}/resources/${op.data.id}/rates`, { rate: 150, unitId: hr.id, effectiveFrom: '2026-01-01' });
            await callApi('post', `${API_BASE}/resources/${eq.data.id}/rates`, { rate: 1200, unitId: hr.id, effectiveFrom: '2026-01-01' });

            const act = await callApi('post', `${API_BASE}/activities`, {
                projectId: scopeMode === 'project' ? Number(projectId) : null,
                code: `EXC-${ts}`,
                name: `Excavation (No Material) ${ts}`,
                outputUnitId: m3.id,
            });
            await callApi('post', `${API_BASE}/activities/${act.data.id}/norms`, {
                resourceId: op.data.id, qtyPerUnit: 0.2, unitId: hr.id, effectiveFrom: '2026-01-01',
            });
            await callApi('post', `${API_BASE}/activities/${act.data.id}/norms`, {
                resourceId: eq.data.id, qtyPerUnit: 0.1, unitId: hr.id, effectiveFrom: '2026-01-01',
            });
            const refreshed = await callApi('get', `${API_BASE}/activities/${act.data.id}`);
            await Promise.all([loadResources(), loadActivities(), loadMasters()]);
            setSelectedActivity(refreshed.data);
        } catch (err) {
            alert(`Sample Error (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading('seed_excavation', false);
        }
    };

    const handleSetNorm = async (e) => {
        e.preventDefault();
        setKeyLoading('modal_submit', true);
        try {
            await callApi('post', `${API_BASE}/activities/${selectedActivity.id}/norms`, {
                resourceId: Number(modalData.resourceId),
                qtyPerUnit: modalData.qtyPerUnit,
                unitId: Number(modalData.unitId),
                wastagePct: modalData.wastagePct !== undefined && modalData.wastagePct !== '' ? Number(modalData.wastagePct) : 0,
                effectiveFrom: modalData.effectiveFrom,
                note: modalData.note || null,
            });
            setActiveModal(null);
            const refreshed = await callApi('get', `${API_BASE}/activities/${selectedActivity.id}`);
            setSelectedActivity(refreshed.data);
            await loadActivities();
        } catch (err) {
            alert(`Norm Error (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading('modal_submit', false);
        }
    };

    const handleCorrectNorm = async (e) => {
        e.preventDefault();
        setKeyLoading('modal_submit', true);
        try {
            await callApi('put', `${API_BASE}/norms/${modalData.normId}`, {
                patch: {
                    qtyPerUnit: modalData.qtyPerUnit,
                    unitId: Number(modalData.unitId),
                    wastagePct: modalData.wastagePct !== undefined && modalData.wastagePct !== '' ? Number(modalData.wastagePct) : 0,
                    note: modalData.note,
                },
                reason: modalData.reason,
            });
            setActiveModal(null);
            const refreshed = await callApi('get', `${API_BASE}/activities/${selectedActivity.id}`);
            setSelectedActivity(refreshed.data);
            await loadActivities();
        } catch (err) {
            alert(`Correct Norm Error (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading('modal_submit', false);
        }
    };

    const handleRemoveNorm = async (normId) => {
        const key = `remove_norm_${normId}`;
        if (isKeyLoading(key)) return;
        const reason = window.prompt('Reason for removing future norm:', 'Cancelled');
        if (!reason) return;
        setKeyLoading(key, true);
        try {
            await callApi('delete', `${API_BASE}/norms/${normId}`, { reason });
            const refreshed = await callApi('get', `${API_BASE}/activities/${selectedActivity.id}`);
            setSelectedActivity(refreshed.data);
            await loadActivities();
        } catch (err) {
            alert(`Remove Norm Error (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading(key, false);
        }
    };

    const handleDeleteActivity = async (a) => {
        const key = `delete_act_${a.id}`;
        if (isKeyLoading(key)) return;
        if (!window.confirm(`Delete activity "${a.name}" (${a.code})?`)) return;
        setKeyLoading(key, true);
        try {
            await callApi('delete', `${API_BASE}/activities/${a.id}`);
            if (selectedActivity?.id === a.id) setSelectedActivity(null);
            await Promise.all([loadActivities(), loadMasters()]);
        } catch (err) {
            alert(`Delete Blocked (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading(key, false);
        }
    };

    // Handlers: Calculator
    const handleCalculateCostAndUsage = async (e) => {
        e.preventDefault();
        if (!calcActivityId) return;
        setKeyLoading('calc', true);
        try {
            const [costRes, usageRes] = await Promise.all([
                callApi('get', `${API_BASE}/activities/${calcActivityId}/cost`, null, { date: calcDate }),
                callApi('get', `${API_BASE}/activities/${calcActivityId}/expected-usage`, null, { outputQty: calcOutputQty, date: calcDate }),
            ]);
            setCalcCostResult(costRes.data);
            setCalcUsageResult(usageRes.data);
        } catch (err) {
            alert(`Calc Error (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading('calc', false);
        }
    };

    // Handlers: Import & Sync
    const handleImport = async (e) => {
        e.preventDefault();
        if (!importMasterId) return;
        setKeyLoading('import_btn', true);
        try {
            const endpoint = importEntity === 'resource' ? `${API_BASE}/resources/import` : `${API_BASE}/activities/import`;
            await callApi('post', endpoint, {
                masterId: Number(importMasterId),
                projectId: Number(projectId),
                asNewVariant: importAsVariant,
                code: importCode || undefined,
                name: importName || undefined,
            });
            setScopeMode('project');
            await Promise.all([loadResources(), loadActivities()]);
        } catch (err) {
            alert(`Import Error (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading('import_btn', false);
        }
    };

    const handleInspectSync = async () => {
        if (!syncTargetId || isKeyLoading('sync_inspect')) return;
        const prefix = syncTargetType === 'resource' ? 'resources' : 'activities';
        setKeyLoading('sync_inspect', true);
        setSyncStatus(null);
        setSyncDiff(null);
        try {
            const statusRes = await callApi('get', `${API_BASE}/${prefix}/${syncTargetId}/sync-status`);
            setSyncStatus(statusRes.data);
            if (statusRes.data?.hasMaster) {
                const diffRes = await callApi('get', `${API_BASE}/${prefix}/${syncTargetId}/sync-diff`);
                setSyncDiff(diffRes.data);
                setSyncSelection({ fields: [], rates: false, conversions: false, norms: false });
            } else {
                setSyncDiff(null);
            }
        } catch (err) {
            alert(`Sync Error (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading('sync_inspect', false);
        }
    };

    const handleAcceptSync = async () => {
        if (!syncTargetId || isKeyLoading('sync_accept')) return;
        const prefix = syncTargetType === 'resource' ? 'resources' : 'activities';
        setKeyLoading('sync_accept', true);
        try {
            await callApi('post', `${API_BASE}/${prefix}/${syncTargetId}/sync-accept`, {
                selection: syncSelection,
                reason: 'Accepted from Catalog Lab Sync Panel',
            });
            await handleInspectSync();
            await Promise.all([loadResources(), loadActivities()]);
        } catch (err) {
            alert(`Accept Sync Error (${err.code}): ${err.message}`);
        } finally {
            setKeyLoading('sync_accept', false);
        }
    };

    // Handlers: In-Use Simulator, Integrity, Tests
    const handleToggleInUse = async (entity, id) => {
        const key = `toggle_sim_${entity}_${id}`;
        if (isKeyLoading(key)) return;
        setKeyLoading(key, true);
        try {
            const res = await callApi('post', `${API_BASE}/in-use-simulator`, { entity, id });
            setSimInUse({ resourceIds: res.data.resourceIds, activityIds: res.data.activityIds });
        } catch (err) {
            alert(`Simulator Error: ${err.message}`);
        } finally {
            setKeyLoading(key, false);
        }
    };

    const handleCheckIntegrity = async () => {
        setKeyLoading('integrity', true);
        try {
            const res = await callApi('get', `${API_BASE}/integrity`);
            setViolations(res.data || []);
            if (res.data?.length === 0) {
                alert('Integrity Check PASSED: 0 violations found!');
            }
        } catch (err) {
            alert(`Integrity Error: ${err.message}`);
        } finally {
            setKeyLoading('integrity', false);
        }
    };

    const handleRepairUnits = async () => {
        setKeyLoading('repair_units', true);
        try {
            const res = await callApi('post', `${API_BASE}/units/repair`);
            alert(`Repaired ${res.data.restoredCount} system unit(s). Database rows restored to sovereign constants.`);
            await handleCheckIntegrity();
            await loadUnits();
        } catch (err) {
            alert(`Repair Error: ${err.message}`);
        } finally {
            setKeyLoading('repair_units', false);
        }
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
                            setTestReport(r => ({
                                total: 40,
                                passed: executed.filter(x => x.status === 'PASS').length,
                                failed: executed.filter(x => x.status === 'FAIL').length,
                                durationMs: (r?.durationMs || 0) + single.durationMs,
                                results: CATALOG_SPEC_CASES.map(c => next[c.num]).filter(Boolean),
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
            console.error('Failed to run catalog test suite:', err);
        } finally {
            setKeyLoading(loadingKey, false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 md:p-6 font-sans">
            {/* Top Bar */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <Package className="text-indigo-500" size={24} />
                        <h1 className="text-xl font-bold tracking-tight">Catalog Lab — Module 2 Engine Tester</h1>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-semibold">
                            DEV ONLY
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Exercises <code className="font-mono">/api/dev/catalog/*</code> (units, resources, effective-dated rates, activities, norms, sync, cost, usage & integrity).
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Scope Switcher */}
                    <div className="flex items-center bg-gray-100 dark:bg-gray-900 rounded-lg p-1 border border-gray-200 dark:border-gray-700 text-xs">
                        <button
                            onClick={() => setScopeMode('master')}
                            className={`px-3 py-1 rounded-md font-semibold transition-colors ${scopeMode === 'master' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}
                        >
                            Master Catalog
                        </button>
                        <button
                            onClick={() => setScopeMode('project')}
                            className={`px-3 py-1 rounded-md font-semibold transition-colors ${scopeMode === 'project' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}
                        >
                            Project Copy
                        </button>
                    </div>

                    {scopeMode === 'project' && (
                        <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-900 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs">
                            <span className="text-gray-500 font-semibold">Project ID:</span>
                            <input
                                type="number"
                                value={projectId}
                                onChange={e => setProjectId(e.target.value)}
                                className="w-16 bg-transparent font-mono font-bold text-center outline-none"
                            />
                        </div>
                    )}

                    <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-900 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs">
                        <Lock size={12} className="text-amber-500" />
                        <span className="text-gray-500 font-semibold">Org:</span>
                        <span className="font-mono font-bold">{orgId}</span>
                    </div>

                    <button
                        onClick={handleSeedUnits}
                        disabled={isKeyLoading('seed_units')}
                        title="Ensure global physical units (kg, m, hr, etc.) exist once in database without per-org duplication."
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 disabled:opacity-50"
                    >
                        {isKeyLoading('seed_units') ? <Loader2 size={13} className="animate-spin" /> : <Scale size={13} />}
                        Sync Global Units
                    </button>

                    <button
                        onClick={handleCheckIntegrity}
                        disabled={isKeyLoading('integrity')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 disabled:opacity-50"
                    >
                        {isKeyLoading('integrity') ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                        Check Integrity
                    </button>

                    <button
                        onClick={() => handleRunTestSuite()}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-900 dark:bg-gray-700 hover:bg-gray-800 text-white flex items-center gap-1.5"
                    >
                        <Terminal size={13} />
                        Run 44 Spec Tests
                    </button>

                    <button
                        onClick={refreshAll}
                        disabled={isKeyLoading('refresh_all')}
                        className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                        title="Refresh All"
                    >
                        <RefreshCw size={15} className={isKeyLoading('refresh_all') ? 'animate-spin text-indigo-500' : ''} />
                    </button>
                </div>
            </div>

            {/* Integrity Violations Banner */}
            {violations.length > 0 && (
                <div className="mb-5 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800">
                    <div className="flex items-center justify-between gap-2 text-red-700 dark:text-red-300 font-bold text-sm mb-2">
                        <div className="flex items-center gap-2">
                            <ShieldAlert size={18} />
                            <span>Integrity Check Reported {violations.length} Violation(s)</span>
                        </div>
                        {violations.some(v => v.type === 'SYSTEM_UNIT_TAMPERED' || v.type === 'SYSTEM_UNIT_MISSING') && (
                            <button
                                onClick={handleRepairUnits}
                                disabled={isKeyLoading('repair_units')}
                                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {isKeyLoading('repair_units') ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                Auto-Repair Global Units
                            </button>
                        )}
                    </div>
                    <ul className="space-y-1 text-xs font-mono text-red-700 dark:text-red-300">
                        {violations.map((v, idx) => (
                            <li key={idx}>[{v.type}] {v.entity ? `(${v.entity} #${v.id || 'N/A'}):` : ''} {v.details}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex flex-wrap gap-2 mb-5">
                {[
                    { id: 'resources', label: 'Resources, Rates & Conversions', icon: Package },
                    { id: 'activities', label: 'Activities & Norms', icon: Wrench },
                    { id: 'calculator', label: 'Cost & Expected Usage', icon: Calculator },
                    { id: 'import_sync', label: 'Import & Master Sync', icon: GitCompare },
                    { id: 'units', label: 'Units & Free Converter', icon: Scale },
                ].map(t => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id)}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all border ${
                                activeTab === t.id
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                        >
                            <Icon size={14} />
                            <span>{t.label}</span>
                        </button>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                {/* Main Workspace (8 cols) */}
                <div className="xl:col-span-8 space-y-5">
                    {/* TAB 1: RESOURCES */}
                    {activeTab === 'resources' && (
                        <div className="space-y-5">
                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="relative">
                                            <Search size={13} className="absolute left-2.5 top-2 text-gray-400" />
                                            <input
                                                type="text"
                                                value={searchText}
                                                onChange={e => setSearchText(e.target.value)}
                                                placeholder="Search code or name..."
                                                className="pl-7 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                            />
                                        </div>
                                        <select
                                            value={kindFilter}
                                            onChange={e => setKindFilter(e.target.value)}
                                            className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                        >
                                            <option value="">All Kinds</option>
                                            <option value="material">Material</option>
                                            <option value="labour">Labour</option>
                                            <option value="equipment">Equipment</option>
                                        </select>
                                        <select
                                            value={statusFilter}
                                            onChange={e => setStatusFilter(e.target.value)}
                                            className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                        >
                                            <option value="">All Status</option>
                                            <option value="active">Active</option>
                                            <option value="archived">Archived</option>
                                        </select>
                                    </div>

                                    <button
                                        onClick={() => {
                                            setModalData({ kind: 'material', code: '', name: '', baseUnitId: units[0]?.id || '', description: '' });
                                            setActiveModal('create_resource');
                                        }}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
                                    >
                                        <Plus size={14} /> New {scopeMode === 'master' ? 'Master' : 'Project'} Resource
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500">
                                                <th className="py-2 px-2">ID</th>
                                                <th className="py-2 px-2">Code</th>
                                                <th className="py-2 px-2">Name</th>
                                                <th className="py-2 px-2">Kind</th>
                                                <th className="py-2 px-2">Base Unit</th>
                                                <th className="py-2 px-2">Ver / Sync</th>
                                                <th className="py-2 px-2">Status</th>
                                                <th className="py-2 px-2 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loadingResources && (
                                                <tr>
                                                    <td colSpan={8} className="py-8 text-center text-gray-500">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Loader2 size={16} className="animate-spin text-indigo-500" />
                                                            <span>Loading resources...</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                            {!loadingResources && resources.length === 0 && (
                                                <tr>
                                                    <td colSpan={8} className="py-6 text-center text-gray-400">
                                                        No resources in this scope. Click "New Resource" or import from Master.
                                                    </td>
                                                </tr>
                                            )}
                                            {!loadingResources && resources.map(r => {
                                                const kb = KIND_BADGE[r.kind] || KIND_BADGE.material;
                                                const isSim = simInUse.resourceIds.includes(r.id);
                                                const isBehind = r.parent_id && r.master_version > (r.synced_version || 0);
                                                const isArchiveLoading = isKeyLoading(`archive_res_${r.id}`);
                                                const isDeleteLoading = isKeyLoading(`delete_res_${r.id}`);
                                                const isSimLoading = isKeyLoading(`toggle_sim_resource_${r.id}`);
                                                return (
                                                    <tr
                                                        key={r.id}
                                                        onClick={() => setSelectedResource(r)}
                                                        className={`border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 ${selectedResource?.id === r.id ? 'bg-indigo-50 dark:bg-indigo-950/30' : ''}`}
                                                    >
                                                        <td className="py-2 px-2 font-mono">#{r.id}</td>
                                                        <td className="py-2 px-2 font-mono font-semibold">{r.code}</td>
                                                        <td className="py-2 px-2 font-medium">
                                                            {r.name}
                                                            {isSim && (
                                                                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">IN USE</span>
                                                            )}
                                                            {isBehind && (
                                                                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold">MASTER CHANGED</span>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-2">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${kb.cls}`}>{kb.label}</span>
                                                        </td>
                                                        <td className="py-2 px-2 font-mono">{r.base_unit_code}</td>
                                                        <td className="py-2 px-2 font-mono text-[11px]">
                                                            v{r.version}{r.parent_id ? ` (sync v${r.synced_version})` : ''}
                                                        </td>
                                                        <td className="py-2 px-2">
                                                            <span className={`text-[10px] font-bold uppercase ${r.status === 'archived' ? 'text-gray-400' : 'text-emerald-600'}`}>
                                                                {r.status}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-2 text-right space-x-1" onClick={e => e.stopPropagation()}>
                                                            <button
                                                                onClick={() => handleToggleInUse('resource', r.id)}
                                                                disabled={isSimLoading}
                                                                className={`p-1 rounded text-[10px] font-bold disabled:opacity-50 ${isSim ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                                                                title="Toggle In-Use Simulator (registerUsageCheck)"
                                                            >
                                                                {isSimLoading ? <Loader2 size={11} className="animate-spin inline" /> : (isSim ? 'Used' : 'Use?')}
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setModalData({
                                                                        id: r.id, code: r.code, name: r.name, kind: r.kind,
                                                                        baseUnitId: r.base_unit_id, description: r.description || '',
                                                                    });
                                                                    setActiveModal('edit_resource');
                                                                }}
                                                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                                                title="Edit"
                                                            >
                                                                <Edit2 size={13} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleResourceArchiveToggle(r)}
                                                                disabled={isArchiveLoading}
                                                                className="p-1 text-amber-600 hover:bg-amber-50 rounded disabled:opacity-50"
                                                                title={r.status === 'archived' ? 'Restore' : 'Archive'}
                                                            >
                                                                {isArchiveLoading ? <Loader2 size={13} className="animate-spin inline" /> : (r.status === 'archived' ? <RotateCcw size={13} /> : <Archive size={13} />)}
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteResource(r)}
                                                                disabled={isDeleteLoading}
                                                                className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                                                                title="Delete"
                                                            >
                                                                {isDeleteLoading ? <Loader2 size={13} className="animate-spin inline" /> : <Trash2 size={13} />}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Selected Resource: Rate Timeline & Conversions */}
                            {selectedResource && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {/* Rate Timeline */}
                                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-sm font-bold flex items-center gap-1.5">
                                                <Clock size={15} className="text-indigo-500" />
                                                Rate Timeline — {selectedResource.code}
                                            </h3>
                                            <button
                                                onClick={() => {
                                                    setModalData({ rate: '', unitId: selectedResource.base_unit_id, effectiveFrom: todayIso, note: '' });
                                                    setActiveModal('add_rate');
                                                }}
                                                className="px-2.5 py-1 rounded text-xs font-semibold bg-indigo-600 text-white flex items-center gap-1"
                                            >
                                                <Plus size={12} /> Set Rate
                                            </button>
                                        </div>

                                        <div className="space-y-2 mb-4">
                                            {loadingDetails && (
                                                <div className="py-4 text-center text-gray-500 text-xs flex items-center justify-center gap-2">
                                                    <Loader2 size={14} className="animate-spin text-indigo-500" />
                                                    <span>Loading rates...</span>
                                                </div>
                                            )}
                                            {!loadingDetails && selectedRates.length === 0 && (
                                                <p className="text-xs text-gray-400 py-3">No rates defined yet.</p>
                                            )}
                                            {!loadingDetails && selectedRates.map(rt => {
                                                const isRemoveLoading = isKeyLoading(`remove_rate_${rt.id}`);
                                                return (
                                                    <div key={rt.id} className="p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between text-xs">
                                                        <div>
                                                            <div className="font-mono font-bold text-sm">
                                                                {rt.rate} <span className="text-gray-500">/ {rt.unit_code}</span>
                                                            </div>
                                                            <div className="text-[11px] text-gray-500 font-mono">
                                                                {rt.effective_from} → {rt.effective_to || 'open'}
                                                            </div>
                                                            {rt.note && <div className="text-[11px] text-gray-400 italic">{rt.note}</div>}
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => {
                                                                    setModalData({ rateId: rt.id, rate: rt.rate, unitId: rt.unit_id, note: rt.note || '', reason: '' });
                                                                    setActiveModal('correct_rate');
                                                                }}
                                                                className="px-2 py-1 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 text-[11px] font-semibold"
                                                            >
                                                                Correct
                                                            </button>
                                                            <button
                                                                onClick={() => handleRemoveRate(rt)}
                                                                disabled={isRemoveLoading}
                                                                className="p-1 text-red-500 hover:bg-red-50 rounded disabled:opacity-50"
                                                                title="Remove future rate"
                                                            >
                                                                {isRemoveLoading ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Lookup Rate on Date */}
                                        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                                            <div className="text-[11px] font-bold text-gray-500 mb-1.5">Query Effective Rate (getRate)</div>
                                            <div className="flex flex-wrap gap-1.5">
                                                <input
                                                    type="date"
                                                    value={rateQueryDate}
                                                    onChange={e => setRateQueryDate(e.target.value)}
                                                    className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                                />
                                                <select
                                                    value={rateQueryUnitId}
                                                    onChange={e => setRateQueryUnitId(e.target.value)}
                                                    className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                                >
                                                    <option value="">Rate Unit (default)</option>
                                                    {units.map(u => <option key={u.id} value={u.id}>{u.code}</option>)}
                                                </select>
                                                <button
                                                    onClick={handleQueryRate}
                                                    disabled={isKeyLoading('query_rate')}
                                                    className="px-2.5 py-1 rounded bg-gray-800 text-white text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                                                >
                                                    {isKeyLoading('query_rate') ? <Loader2 size={11} className="animate-spin" /> : null}
                                                    Lookup
                                                </button>
                                            </div>
                                            {rateQueryResult !== undefined && (
                                                <div className="mt-2 p-2 rounded bg-gray-100 dark:bg-gray-950 font-mono text-xs">
                                                    {rateQueryResult === null
                                                        ? 'null (no rate in force)'
                                                        : rateQueryResult.error
                                                        ? <span className="text-red-500">{rateQueryResult.error}</span>
                                                        : `${rateQueryResult.rate} / ${rateQueryResult.unit_code}`}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Per-resource Conversions */}
                                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-sm font-bold flex items-center gap-1.5">
                                                <ArrowRightLeft size={15} className="text-indigo-500" />
                                                Conversions — {selectedResource.code}
                                            </h3>
                                            <button
                                                onClick={() => {
                                                    const bag = units.find(u => u.code === 'bag');
                                                    setModalData({
                                                        fromUnitId: bag?.id || units[0]?.id || '',
                                                        toUnitId: selectedResource.base_unit_id,
                                                        factor: '50',
                                                    });
                                                    setActiveModal('add_conversion');
                                                }}
                                                className="px-2.5 py-1 rounded text-xs font-semibold bg-indigo-600 text-white flex items-center gap-1"
                                            >
                                                <Plus size={12} /> Add Conversion
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            {loadingDetails && (
                                                <div className="py-4 text-center text-gray-500 text-xs flex items-center justify-center gap-2">
                                                    <Loader2 size={14} className="animate-spin text-indigo-500" />
                                                    <span>Loading conversions...</span>
                                                </div>
                                            )}
                                            {!loadingDetails && selectedConversions.length === 0 && (
                                                <p className="text-xs text-gray-400 py-3">
                                                    No per-resource conversions (e.g., 1 bag = 50 kg).
                                                </p>
                                            )}
                                            {!loadingDetails && selectedConversions.map(c => {
                                                const isRemoveConvLoading = isKeyLoading(`remove_conv_${c.id}`);
                                                return (
                                                    <div key={c.id} className="p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between text-xs">
                                                        <div className="font-mono">
                                                            <span className="font-bold">1 {c.from_unit_code}</span> = <span className="font-bold text-indigo-600">{c.factor} {c.to_unit_code}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemoveConversion(c.id)}
                                                            disabled={isRemoveConvLoading}
                                                            className="p-1 text-red-500 hover:bg-red-50 rounded disabled:opacity-50"
                                                        >
                                                            {isRemoveConvLoading ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 2: ACTIVITIES & NORMS */}
                    {activeTab === 'activities' && (
                        <div className="space-y-5">
                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                                    <h2 className="text-sm font-bold">Activities ({activities.length})</h2>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleCreateExcavationSample}
                                            disabled={isKeyLoading('seed_excavation')}
                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 disabled:opacity-50"
                                        >
                                            {isKeyLoading('seed_excavation') ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                                            <span>{isKeyLoading('seed_excavation') ? 'Seeding...' : 'Seed Excavation Sample (No Material)'}</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                setModalData({ code: '', name: '', outputUnitId: units.find(u => u.code === 'm2')?.id || units[0]?.id || '', description: '' });
                                                setActiveModal('create_activity');
                                            }}
                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
                                        >
                                            <Plus size={14} /> New Activity
                                        </button>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500">
                                                <th className="py-2 px-2">ID</th>
                                                <th className="py-2 px-2">Code</th>
                                                <th className="py-2 px-2">Name</th>
                                                <th className="py-2 px-2">Output Unit</th>
                                                <th className="py-2 px-2">Norms</th>
                                                <th className="py-2 px-2">Ver</th>
                                                <th className="py-2 px-2 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loadingActivities && (
                                                <tr>
                                                    <td colSpan={7} className="py-8 text-center text-gray-500">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Loader2 size={16} className="animate-spin text-indigo-500" />
                                                            <span>Loading activities...</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                            {!loadingActivities && activities.length === 0 && (
                                                <tr>
                                                    <td colSpan={7} className="py-6 text-center text-gray-400">
                                                        No activities in this scope.
                                                    </td>
                                                </tr>
                                            )}
                                            {!loadingActivities && activities.map(a => {
                                                const isSim = simInUse.activityIds.includes(a.id);
                                                const isDeleteLoading = isKeyLoading(`delete_act_${a.id}`);
                                                const isSimLoading = isKeyLoading(`toggle_sim_activity_${a.id}`);
                                                return (
                                                    <tr
                                                        key={a.id}
                                                        onClick={() => {
                                                            setSelectedActivity(a);
                                                            setChangeLogEntity('activity');
                                                            setChangeLogId(String(a.id));
                                                            loadChangeLog('activity', a.id);
                                                        }}
                                                        className={`border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 ${selectedActivity?.id === a.id ? 'bg-indigo-50 dark:bg-indigo-950/30' : ''}`}
                                                    >
                                                        <td className="py-2 px-2 font-mono">#{a.id}</td>
                                                        <td className="py-2 px-2 font-mono font-semibold">{a.code}</td>
                                                        <td className="py-2 px-2 font-medium">
                                                            {a.name}
                                                            {isSim && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">IN USE</span>}
                                                        </td>
                                                        <td className="py-2 px-2 font-mono">{a.output_unit_code}</td>
                                                        <td className="py-2 px-2 font-mono">{(a.norms || []).length}</td>
                                                        <td className="py-2 px-2 font-mono">v{a.version}</td>
                                                        <td className="py-2 px-2 text-right space-x-1" onClick={e => e.stopPropagation()}>
                                                            <button
                                                                onClick={() => handleToggleInUse('activity', a.id)}
                                                                disabled={isSimLoading}
                                                                className={`p-1 rounded text-[10px] font-bold disabled:opacity-50 ${isSim ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                                                            >
                                                                {isSimLoading ? <Loader2 size={11} className="animate-spin inline" /> : (isSim ? 'Used' : 'Use?')}
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteActivity(a)}
                                                                disabled={isDeleteLoading}
                                                                className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                                                            >
                                                                {isDeleteLoading ? <Loader2 size={13} className="animate-spin inline" /> : <Trash2 size={13} />}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Selected Activity Norms */}
                            {selectedActivity && (
                                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-bold">
                                            Norms for {selectedActivity.code} — {selectedActivity.name} (per 1 {selectedActivity.output_unit_code})
                                        </h3>
                                        <button
                                            onClick={() => {
                                                setModalData({
                                                    resourceId: resources[0]?.id || '',
                                                    qtyPerUnit: '1',
                                                    unitId: resources[0]?.base_unit_id || units[0]?.id || '',
                                                    wastagePct: '0',
                                                    effectiveFrom: todayIso,
                                                    note: '',
                                                });
                                                setActiveModal('add_norm');
                                            }}
                                            className="px-2.5 py-1 rounded text-xs font-semibold bg-indigo-600 text-white flex items-center gap-1"
                                        >
                                            <Plus size={12} /> Add Norm
                                        </button>
                                    </div>
                                    {(selectedActivity.norms || []).length === 0 ? (
                                        <p className="text-xs text-gray-400">No norms defined (zero cost, complete).</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {selectedActivity.norms.map(n => {
                                                const isRemoveNormLoading = isKeyLoading(`remove_norm_${n.id}`);
                                                return (
                                                    <div key={n.id} className="p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between text-xs">
                                                        <div>
                                                            <span className="font-mono font-bold">{n.resource_code}</span> — {n.resource_name}
                                                            <span className="ml-2 px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-mono font-bold">
                                                                {n.qty_per_unit} {n.unit_code}
                                                            </span>
                                                            <span className={`ml-2 px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${Number(n.wastage_pct) > 0 ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                                                +{n.wastage_pct ?? 0}% waste
                                                            </span>
                                                            <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                                                                {n.effective_from} → {n.effective_to || 'open'}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => {
                                                                    setModalData({
                                                                        normId: n.id,
                                                                        qtyPerUnit: n.qty_per_unit,
                                                                        unitId: n.unit_id,
                                                                        wastagePct: n.wastage_pct ?? 0,
                                                                        note: n.note || '',
                                                                        reason: ''
                                                                    });
                                                                    setActiveModal('correct_norm');
                                                                }}
                                                                className="px-2 py-1 rounded bg-amber-100 text-amber-800 text-[11px] font-semibold"
                                                            >
                                                                Correct
                                                            </button>
                                                            <button
                                                                onClick={() => handleRemoveNorm(n.id)}
                                                                disabled={isRemoveNormLoading}
                                                                className="p-1 text-red-500 hover:bg-red-50 rounded disabled:opacity-50"
                                                            >
                                                                {isRemoveNormLoading ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 3: COST & EXPECTED USAGE CALCULATOR */}
                    {activeTab === 'calculator' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
                            <h2 className="text-sm font-bold flex items-center gap-2">
                                <Calculator size={16} className="text-indigo-500" />
                                Activity Cost & Expected Usage Calculator
                            </h2>
                            <form onSubmit={handleCalculateCostAndUsage} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                <div className="md:col-span-2">
                                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Activity</label>
                                    <select
                                        value={calcActivityId}
                                        onChange={e => setCalcActivityId(e.target.value)}
                                        className="w-full p-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                        required
                                    >
                                        <option value="">Select activity...</option>
                                        {activities.map(a => (
                                            <option key={a.id} value={a.id}>{a.code} — {a.name} ({a.output_unit_code})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">As-Of Date</label>
                                    <input
                                        type="date"
                                        value={calcDate}
                                        onChange={e => setCalcDate(e.target.value)}
                                        className="w-full p-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Output Qty</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            step="any"
                                            value={calcOutputQty}
                                            onChange={e => setCalcOutputQty(e.target.value)}
                                            className="w-full p-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                            required
                                        />
                                        <button
                                            type="submit"
                                            disabled={isKeyLoading('calc')}
                                            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shrink-0 flex items-center gap-1.5 disabled:opacity-50"
                                        >
                                            {isKeyLoading('calc') ? <Loader2 size={13} className="animate-spin" /> : null}
                                            Compute
                                        </button>
                                    </div>
                                </div>
                            </form>

                            {calcCostResult && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold">Cost Per 1 {calcCostResult.outputUnitCode}</span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${calcCostResult.incomplete ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {calcCostResult.incomplete ? 'INCOMPLETE' : 'COMPLETE'}
                                            </span>
                                        </div>
                                        <div className="text-2xl font-mono font-bold text-indigo-600 mb-2">
                                            {calcCostResult.total}
                                        </div>
                                        {calcCostResult.warnings?.length > 0 && (
                                            <div className="mb-2 p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-300 text-[11px] text-amber-800 dark:text-amber-300">
                                                {calcCostResult.warnings.map((w, i) => <div key={i}>⚠ {w.message}</div>)}
                                            </div>
                                        )}
                                        <div className="space-y-1 text-xs">
                                            {calcCostResult.lines.map((l, i) => (
                                                <div key={i} className="p-2 rounded bg-gray-50 dark:bg-gray-900 font-mono space-y-1 border border-gray-100 dark:border-gray-800">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-bold">{l.resourceCode} ({l.resourceName || l.kind})</span>
                                                        <span className="font-bold text-indigo-600">{l.amount ?? 'MISSING'}</span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-1 text-[11px] text-gray-500 border-t border-gray-200 dark:border-gray-700 pt-1">
                                                        <div>Net: <span className="text-gray-700 dark:text-gray-300 font-semibold">{l.netQty ?? l.qty} {l.unitCode}</span></div>
                                                        <div>Waste: <span className="text-amber-600 font-semibold">+{l.wastagePct ?? 0}%</span></div>
                                                        <div>Gross: <span className="text-gray-700 dark:text-gray-300 font-semibold">{l.grossQty ?? l.qty} {l.unitCode}</span></div>
                                                    </div>
                                                    <div className="text-[10px] text-gray-400">
                                                        Rate: {l.rate !== null && l.rate !== undefined ? `${l.rate} per ${l.unitCode}` : '—'}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {calcUsageResult && (
                                        <div>
                                            <div className="text-xs font-bold mb-2">
                                                 Expected Usage for {calcUsageResult.outputQty} {calcUsageResult.outputUnitCode} (in Base Units)
                                            </div>
                                            <div className="space-y-1.5 text-xs">
                                                {calcUsageResult.items.length === 0 && <p className="text-gray-400">No resource usage.</p>}
                                                {calcUsageResult.items.map((it, i) => (
                                                    <div key={i} className="p-2 rounded bg-gray-50 dark:bg-gray-900 font-mono space-y-1 border border-gray-100 dark:border-gray-800">
                                                        <div className="flex justify-between items-center">
                                                            <span className="font-bold">{it.resourceCode} ({it.resourceName})</span>
                                                            <span className="font-bold text-emerald-600">{it.grossQty ?? it.qty} {it.unitCode} (Gross)</span>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-1 text-[11px] text-gray-500 border-t border-gray-200 dark:border-gray-700 pt-1">
                                                            <div>Net: <span className="text-gray-700 dark:text-gray-300 font-semibold">{it.netQty ?? it.qty}</span></div>
                                                            <div>Allowance: <span className="text-amber-600 font-semibold">+{it.allowanceQty ?? 0}</span></div>
                                                            <div>Gross: <span className="text-emerald-600 font-semibold">{it.grossQty ?? it.qty}</span></div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 4: IMPORT & SYNC */}
                    {activeTab === 'import_sync' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* Import Panel */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                                <h2 className="text-sm font-bold flex items-center gap-1.5">
                                    <Download size={15} className="text-indigo-500" />
                                    Import Master → Project #{projectId}
                                </h2>
                                <form onSubmit={handleImport} className="space-y-2.5 text-xs">
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => { setImportEntity('resource'); setImportMasterId(''); }}
                                            className={`flex-1 py-1.5 rounded font-semibold ${importEntity === 'resource' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-900'}`}
                                        >
                                            Master Resource
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setImportEntity('activity'); setImportMasterId(''); }}
                                            className={`flex-1 py-1.5 rounded font-semibold ${importEntity === 'activity' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-900'}`}
                                        >
                                            Master Activity
                                        </button>
                                    </div>
                                    <select
                                        value={importMasterId}
                                        onChange={e => setImportMasterId(e.target.value)}
                                        className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                        required
                                    >
                                        <option value="">Select master...</option>
                                        {(importEntity === 'resource' ? masterResources : masterActivities).map(m => (
                                            <option key={m.id} value={m.id}>#{m.id} {m.code} — {m.name} (v{m.version})</option>
                                        ))}
                                    </select>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={importAsVariant}
                                            onChange={e => setImportAsVariant(e.target.checked)}
                                        />
                                        <span>Create as new variant (<code>asNewVariant</code>)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={importCode}
                                        onChange={e => setImportCode(e.target.value)}
                                        placeholder="Optional override code"
                                        className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                    />
                                    <input
                                        type="text"
                                        value={importName}
                                        onChange={e => setImportName(e.target.value)}
                                        placeholder="Optional override name"
                                        className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                    />
                                    <button
                                        type="submit"
                                        disabled={isKeyLoading('import_btn')}
                                        className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                                    >
                                        Import into Project #{projectId}
                                    </button>
                                </form>
                            </div>

                            {/* Sync Panel */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3 text-xs">
                                <h2 className="text-sm font-bold flex items-center gap-1.5">
                                    <GitCompare size={15} className="text-indigo-500" />
                                    Sync Panel (Project Copy vs Master)
                                </h2>
                                <div className="flex gap-2">
                                    <select
                                        value={syncTargetType}
                                        onChange={e => { setSyncTargetType(e.target.value); setSyncTargetId(''); setSyncDiff(null); }}
                                        className="p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                    >
                                        <option value="resource">Resource</option>
                                        <option value="activity">Activity</option>
                                    </select>
                                    <input
                                        type="number"
                                        value={syncTargetId}
                                        onChange={e => setSyncTargetId(e.target.value)}
                                        placeholder="Project Copy ID"
                                        className="flex-1 p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                    />
                                    <button
                                        onClick={handleInspectSync}
                                        disabled={isKeyLoading('sync_inspect')}
                                        className="px-3 py-2 rounded bg-gray-800 text-white font-semibold flex items-center gap-1 disabled:opacity-50"
                                    >
                                        {isKeyLoading('sync_inspect') ? <Loader2 size={12} className="animate-spin" /> : null}
                                        <span>Diff</span>
                                    </button>
                                </div>

                                {isKeyLoading('sync_inspect') && (
                                    <div className="p-3 text-center text-gray-500 font-mono flex items-center justify-center gap-2">
                                        <Loader2 size={14} className="animate-spin text-indigo-500" />
                                        <span>Checking sync status...</span>
                                    </div>
                                )}

                                {syncStatus && (
                                    <div className={`p-2 rounded font-mono ${syncStatus.isBehind ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'}`}>
                                        Status: <strong>{syncStatus.status}</strong> | Master v{syncStatus.masterVersion ?? '—'} vs Synced v{syncStatus.syncedVersion ?? '—'}
                                    </div>
                                )}

                                {syncDiff && (
                                    <div className="space-y-2">
                                        {Object.entries(syncDiff.fields).map(([k, v]) => (
                                            <label key={k} className="flex items-center justify-between p-1.5 rounded bg-gray-50 dark:bg-gray-900">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={syncSelection.fields.includes(k)}
                                                        onChange={e => {
                                                            setSyncSelection(s => ({
                                                                ...s,
                                                                fields: e.target.checked ? [...s.fields, k] : s.fields.filter(x => x !== k),
                                                            }));
                                                        }}
                                                    />
                                                    <span className="font-mono font-bold">{k}</span>
                                                </div>
                                                <span className={`font-mono ${v.changed ? 'text-rose-600' : 'text-gray-400'}`}>
                                                    {String(v.project ?? '—')} → {String(v.master ?? '—')}
                                                </span>
                                            </label>
                                        ))}
                                        {syncDiff.rates && (
                                            <label className="flex items-center justify-between p-1.5 rounded bg-gray-50 dark:bg-gray-900">
                                                <span className="flex items-center gap-2 font-bold">
                                                    <input
                                                        type="checkbox"
                                                        checked={syncSelection.rates}
                                                        onChange={e => setSyncSelection(s => ({ ...s, rates: e.target.checked }))}
                                                    />
                                                    Rates ({syncDiff.rates.project.length} → {syncDiff.rates.master.length})
                                                </span>
                                                <span className={syncDiff.rates.changed ? 'text-rose-600 font-bold' : 'text-gray-400'}>
                                                    {syncDiff.rates.changed ? 'CHANGED' : 'Same'}
                                                </span>
                                            </label>
                                        )}
                                        {syncDiff.conversions && (
                                            <label className="flex items-center justify-between p-1.5 rounded bg-gray-50 dark:bg-gray-900">
                                                <span className="flex items-center gap-2 font-bold">
                                                    <input
                                                        type="checkbox"
                                                        checked={syncSelection.conversions}
                                                        onChange={e => setSyncSelection(s => ({ ...s, conversions: e.target.checked }))}
                                                    />
                                                    Conversions ({syncDiff.conversions.project.length} → {syncDiff.conversions.master.length})
                                                </span>
                                                <span className={syncDiff.conversions.changed ? 'text-rose-600 font-bold' : 'text-gray-400'}>
                                                    {syncDiff.conversions.changed ? 'CHANGED' : 'Same'}
                                                </span>
                                            </label>
                                        )}
                                        {syncDiff.norms && (
                                            <label className="flex items-center justify-between p-1.5 rounded bg-gray-50 dark:bg-gray-900">
                                                <span className="flex items-center gap-2 font-bold">
                                                    <input
                                                        type="checkbox"
                                                        checked={syncSelection.norms}
                                                        onChange={e => setSyncSelection(s => ({ ...s, norms: e.target.checked }))}
                                                    />
                                                    Norms ({syncDiff.norms.project.length} → {syncDiff.norms.master.length})
                                                </span>
                                                <span className={syncDiff.norms.changed ? 'text-rose-600 font-bold' : 'text-gray-400'}>
                                                    {syncDiff.norms.changed ? 'CHANGED' : 'Same'}
                                                </span>
                                            </label>
                                        )}
                                        <button
                                            onClick={handleAcceptSync}
                                            disabled={isKeyLoading('sync_accept')}
                                            className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                                        >
                                            {isKeyLoading('sync_accept') ? <Loader2 size={13} className="animate-spin" /> : null}
                                            <span>{isKeyLoading('sync_accept') ? 'Accepting Sync...' : 'Accept Selected Sync'}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 5: UNITS & FREE CONVERTER */}
                    {activeTab === 'units' && (
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                            <div className="md:col-span-7 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-sm font-bold">Units Catalog ({units.length} available)</h2>
                                    <button
                                        onClick={() => {
                                            setModalData({ code: '', name: '', category: 'time', toBaseFactor: '1', isBase: false });
                                            setActiveModal('create_unit');
                                        }}
                                        className="px-2.5 py-1 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1"
                                    >
                                        <Plus size={13} /> New Custom Unit
                                    </button>
                                </div>
                                <div className="overflow-x-auto max-h-96">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500">
                                                <th className="py-1.5 px-2">Code</th>
                                                <th className="py-1.5 px-2">Name</th>
                                                <th className="py-1.5 px-2">Category</th>
                                                <th className="py-1.5 px-2">Scope</th>
                                                <th className="py-1.5 px-2">Factor</th>
                                                <th className="py-1.5 px-2">Base</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loadingUnits && (
                                                <tr>
                                                    <td colSpan={6} className="py-8 text-center text-gray-500">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Loader2 size={16} className="animate-spin text-indigo-500" />
                                                            <span>Loading units...</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                            {!loadingUnits && units.map(u => (
                                                <tr key={u.id} className="border-b border-gray-100 dark:border-gray-800">
                                                    <td className="py-1.5 px-2 font-mono font-bold">{u.code}</td>
                                                    <td className="py-1.5 px-2">{u.name}</td>
                                                    <td className="py-1.5 px-2 capitalize">{u.category}</td>
                                                    <td className="py-1.5 px-2">
                                                        {u.org_id === null ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                                                                Global Standard
                                                            </span>
                                                        ) : (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                                                Org Custom
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-1.5 px-2 font-mono">{u.to_base_factor}</td>
                                                    <td className="py-1.5 px-2 font-medium text-amber-600 dark:text-amber-400">{u.is_base ? '★ Base' : ''}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="md:col-span-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                                <h2 className="text-sm font-bold mb-3">Free Unit Converter</h2>
                                <form onSubmit={handleConvertUnits} className="space-y-2.5 text-xs">
                                    <input
                                        type="number"
                                        step="any"
                                        value={convQty}
                                        onChange={e => setConvQty(e.target.value)}
                                        placeholder="Quantity"
                                        className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                        required
                                    />
                                    <select
                                        value={convFromUnitId}
                                        onChange={e => setConvFromUnitId(e.target.value)}
                                        className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                        required
                                    >
                                        <option value="">From unit...</option>
                                        {units.map(u => <option key={u.id} value={u.id}>{u.code} ({u.category})</option>)}
                                    </select>
                                    <select
                                        value={convToUnitId}
                                        onChange={e => setConvToUnitId(e.target.value)}
                                        className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                        required
                                    >
                                        <option value="">To unit...</option>
                                        {units.map(u => <option key={u.id} value={u.id}>{u.code} ({u.category})</option>)}
                                    </select>
                                    <select
                                        value={convResourceId}
                                        onChange={e => setConvResourceId(e.target.value)}
                                        className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                    >
                                        <option value="">No resource (same category only)</option>
                                        {resources.map(r => <option key={r.id} value={r.id}>#{r.id} {r.code} — {r.name}</option>)}
                                    </select>
                                    <button
                                        type="submit"
                                        disabled={isKeyLoading('convert_units')}
                                        className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    >
                                        {isKeyLoading('convert_units') ? <Loader2 size={13} className="animate-spin" /> : null}
                                        <span>{isKeyLoading('convert_units') ? 'Converting...' : 'Convert'}</span>
                                    </button>
                                </form>
                                {isKeyLoading('convert_units') && (
                                    <div className="mt-3 p-2.5 rounded bg-gray-100 dark:bg-gray-950 font-mono text-xs flex items-center justify-center gap-2 text-gray-500">
                                        <Loader2 size={13} className="animate-spin text-indigo-500" />
                                        <span>Calculating exact conversion...</span>
                                    </div>
                                )}
                                {!isKeyLoading('convert_units') && convOutput && (
                                    <div className={`mt-3 p-2.5 rounded font-mono text-xs ${convOutput.ok ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950/30 text-red-600'}`}>
                                        {convOutput.ok ? `Result: ${convOutput.value}` : convOutput.error}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Sidebar: Change Log Viewer & Service Call Log (4 cols) */}
                <div className="xl:col-span-4 space-y-5">
                    {/* Change Log Viewer */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold flex items-center gap-1.5">
                                <History size={15} className="text-indigo-500" />
                                Change Log Viewer
                            </h3>
                        </div>
                        <div className="flex gap-1.5 mb-3 text-xs">
                            <select
                                value={changeLogEntity}
                                onChange={e => setChangeLogEntity(e.target.value)}
                                className="p-1.5 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                            >
                                <option value="resource">resource</option>
                                <option value="activity">activity</option>
                                <option value="rate">rate</option>
                                <option value="norm">norm</option>
                                <option value="conversion">conversion</option>
                            </select>
                            <input
                                type="number"
                                value={changeLogId}
                                onChange={e => setChangeLogId(e.target.value)}
                                placeholder="Entity ID"
                                className="w-24 p-1.5 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                            />
                            <button
                                onClick={() => loadChangeLog(changeLogEntity, changeLogId)}
                                disabled={isKeyLoading('load_changelog')}
                                className="px-2.5 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-white font-semibold flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {isKeyLoading('load_changelog') ? <Loader2 size={12} className="animate-spin" /> : null}
                                Load
                            </button>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto text-[11px]">
                            {loadingChangeLog && (
                                <div className="py-6 text-center text-gray-500 flex items-center justify-center gap-2">
                                    <Loader2 size={14} className="animate-spin text-indigo-500" />
                                    <span>Loading changes...</span>
                                </div>
                            )}
                            {!loadingChangeLog && changeLogs.length === 0 && <p className="text-gray-400">Select a row or enter entity/ID.</p>}
                            {!loadingChangeLog && changeLogs.map(log => (
                                <div key={log.id} className="p-2 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 font-mono">
                                    <div className="flex justify-between font-bold">
                                        <span className="text-indigo-600">{log.action}</span>
                                        <span className="text-gray-400">{String(log.at).slice(0, 19).replace('T', ' ')}</span>
                                    </div>
                                    {log.reason && <div className="text-amber-600">reason: {log.reason}</div>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Service Call Log */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-bold flex items-center gap-1.5">
                                <Terminal size={15} className="text-emerald-500" />
                                Service Call Log ({callLogs.length})
                            </h3>
                            <button onClick={() => setCallLogs([])} className="text-[11px] text-gray-400 hover:text-gray-600">
                                Clear
                            </button>
                        </div>
                        <div className="space-y-1.5 max-h-80 overflow-y-auto font-mono text-[11px]">
                            {callLogs.length === 0 && <p className="text-gray-400">No calls recorded yet.</p>}
                            {callLogs.map(c => (
                                <div key={c.id} className="p-2 rounded bg-gray-950 text-gray-200 border border-gray-800">
                                    <div className="flex justify-between">
                                        <span>
                                            <span className="text-indigo-400 font-bold">{c.method}</span> {c.endpoint.replace('/dev/catalog', '')}
                                        </span>
                                        <span className={c.status === 'SUCCESS' ? 'text-emerald-400' : 'text-red-400'}>
                                            {c.status} ({c.duration})
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {(activeModal === 'create_resource' || activeModal === 'edit_resource') && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <form
                        onSubmit={activeModal === 'create_resource' ? handleCreateResource : handleUpdateResource}
                        className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-5 space-y-3 text-xs"
                    >
                        <h3 className="text-sm font-bold">{activeModal === 'create_resource' ? 'New Resource' : 'Edit Resource'}</h3>
                        <select
                            value={modalData.kind}
                            onChange={e => setModalData({ ...modalData, kind: e.target.value })}
                            className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                        >
                            <option value="material">material</option>
                            <option value="labour">labour</option>
                            <option value="equipment">equipment</option>
                        </select>
                        <input
                            type="text"
                            value={modalData.code}
                            onChange={e => setModalData({ ...modalData, code: e.target.value })}
                            placeholder="Code (e.g. MAT-CEM-01)"
                            className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                            required
                        />
                        <input
                            type="text"
                            value={modalData.name}
                            onChange={e => setModalData({ ...modalData, name: e.target.value })}
                            placeholder="Name"
                            className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                            required
                        />
                        <select
                            value={modalData.baseUnitId}
                            onChange={e => setModalData({ ...modalData, baseUnitId: e.target.value })}
                            className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                            required
                        >
                            {units.map(u => <option key={u.id} value={u.id}>{u.code} — {u.name} ({u.category})</option>)}
                        </select>
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setActiveModal(null)} className="px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700">Cancel</button>
                            <button type="submit" disabled={isKeyLoading('modal_submit')} className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 disabled:opacity-50">
                                {isKeyLoading('modal_submit') ? <Loader2 size={13} className="animate-spin" /> : null}
                                Save
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {(activeModal === 'add_rate' || activeModal === 'correct_rate') && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <form
                        onSubmit={activeModal === 'add_rate' ? handleAddRate : handleCorrectRate}
                        className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-5 space-y-3 text-xs"
                    >
                        <h3 className="text-sm font-bold">{activeModal === 'add_rate' ? 'Set Rate' : 'Correct Past Rate'}</h3>
                        <input
                            type="number"
                            step="any"
                            value={modalData.rate}
                            onChange={e => setModalData({ ...modalData, rate: e.target.value })}
                            placeholder="Rate value"
                            className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                            required
                        />
                        <select
                            value={modalData.unitId}
                            onChange={e => setModalData({ ...modalData, unitId: e.target.value })}
                            className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                        >
                            {units.map(u => <option key={u.id} value={u.id}>{u.code} ({u.category})</option>)}
                        </select>
                        {activeModal === 'add_rate' ? (
                            <input
                                type="date"
                                value={modalData.effectiveFrom}
                                onChange={e => setModalData({ ...modalData, effectiveFrom: e.target.value })}
                                className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                required
                            />
                        ) : (
                            <input
                                type="text"
                                value={modalData.reason}
                                onChange={e => setModalData({ ...modalData, reason: e.target.value })}
                                placeholder="Reason (required)"
                                className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                required
                            />
                        )}
                        <input
                            type="text"
                            value={modalData.note}
                            onChange={e => setModalData({ ...modalData, note: e.target.value })}
                            placeholder="Optional note"
                            className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                        />
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setActiveModal(null)} className="px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700">Cancel</button>
                            <button type="submit" disabled={isKeyLoading('modal_submit')} className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 disabled:opacity-50">
                                {isKeyLoading('modal_submit') ? <Loader2 size={13} className="animate-spin" /> : null}
                                Submit
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {activeModal === 'add_conversion' && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <form onSubmit={handleAddConversion} className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-5 space-y-3 text-xs">
                        <h3 className="text-sm font-bold">Define Per-Resource Conversion (1 From = Factor × To)</h3>
                        <select
                            value={modalData.fromUnitId}
                            onChange={e => setModalData({ ...modalData, fromUnitId: e.target.value })}
                            className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                        >
                            {units.map(u => <option key={u.id} value={u.id}>{u.code} ({u.category})</option>)}
                        </select>
                        <select
                            value={modalData.toUnitId}
                            onChange={e => setModalData({ ...modalData, toUnitId: e.target.value })}
                            className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                        >
                            {units.map(u => <option key={u.id} value={u.id}>{u.code} ({u.category})</option>)}
                        </select>
                        <input
                            type="number"
                            step="any"
                            value={modalData.factor}
                            onChange={e => setModalData({ ...modalData, factor: e.target.value })}
                            placeholder="Factor (e.g. 50)"
                            className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                            required
                        />
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setActiveModal(null)} className="px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700">Cancel</button>
                            <button type="submit" disabled={isKeyLoading('modal_submit')} className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 disabled:opacity-50">
                                {isKeyLoading('modal_submit') ? <Loader2 size={13} className="animate-spin" /> : null}
                                Save
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {activeModal === 'create_activity' && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <form onSubmit={handleCreateActivity} className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-5 space-y-3 text-xs">
                        <h3 className="text-sm font-bold">New Activity</h3>
                        <input
                            type="text"
                            value={modalData.code}
                            onChange={e => setModalData({ ...modalData, code: e.target.value })}
                            placeholder="Code (e.g. ACT-BW-01)"
                            className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                            required
                        />
                        <input
                            type="text"
                            value={modalData.name}
                            onChange={e => setModalData({ ...modalData, name: e.target.value })}
                            placeholder="Activity Name"
                            className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                            required
                        />
                        <select
                            value={modalData.outputUnitId}
                            onChange={e => setModalData({ ...modalData, outputUnitId: e.target.value })}
                            className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                        >
                            {units.map(u => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}
                        </select>
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setActiveModal(null)} className="px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700">Cancel</button>
                            <button type="submit" disabled={isKeyLoading('modal_submit')} className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 disabled:opacity-50">
                                {isKeyLoading('modal_submit') ? <Loader2 size={13} className="animate-spin" /> : null}
                                Create
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {(activeModal === 'add_norm' || activeModal === 'correct_norm') && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <form
                        onSubmit={activeModal === 'add_norm' ? handleSetNorm : handleCorrectNorm}
                        className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-5 space-y-3 text-xs"
                    >
                        <h3 className="text-sm font-bold">{activeModal === 'add_norm' ? 'Set Activity Norm' : 'Correct Norm'}</h3>
                        {activeModal === 'add_norm' && (
                            <select
                                value={modalData.resourceId}
                                onChange={e => setModalData({ ...modalData, resourceId: e.target.value })}
                                className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                required
                            >
                                {resources.map(r => <option key={r.id} value={r.id}>{r.code} — {r.name} ({r.kind})</option>)}
                            </select>
                        )}
                        <input
                            type="number"
                            step="any"
                            value={modalData.qtyPerUnit}
                            onChange={e => setModalData({ ...modalData, qtyPerUnit: e.target.value })}
                            placeholder="Qty per unit of output"
                            className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                            required
                        />
                        <select
                            value={modalData.unitId}
                            onChange={e => setModalData({ ...modalData, unitId: e.target.value })}
                            className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                        >
                            {units.map(u => <option key={u.id} value={u.id}>{u.code} ({u.category})</option>)}
                        </select>
                        <div>
                            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Allowed Wastage % (0 - 100)</label>
                            <input
                                type="number"
                                step="any"
                                min="0"
                                max="100"
                                value={modalData.wastagePct ?? '0'}
                                onChange={e => setModalData({ ...modalData, wastagePct: e.target.value })}
                                placeholder="Wastage % (default 0)"
                                className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 font-mono"
                            />
                        </div>
                        {activeModal === 'add_norm' ? (
                            <input
                                type="date"
                                value={modalData.effectiveFrom}
                                onChange={e => setModalData({ ...modalData, effectiveFrom: e.target.value })}
                                className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                required
                            />
                        ) : (
                            <input
                                type="text"
                                value={modalData.reason}
                                onChange={e => setModalData({ ...modalData, reason: e.target.value })}
                                placeholder="Reason (required)"
                                className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                required
                            />
                        )}
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setActiveModal(null)} className="px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700">Cancel</button>
                            <button type="submit" disabled={isKeyLoading('modal_submit')} className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 disabled:opacity-50">
                                {isKeyLoading('modal_submit') ? <Loader2 size={13} className="animate-spin" /> : null}
                                Submit
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Create Custom Unit Modal */}
            {activeModal === 'create_unit' && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <form
                        onSubmit={handleCreateUnit}
                        className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-5 space-y-3 text-xs"
                    >
                        <h3 className="text-sm font-bold">New Custom Organization Unit</h3>
                        <p className="text-[11px] text-gray-500">
                            Create an operational unit for Org #{orgId}. Cannot conflict with global standard units (e.g. kg, m, hr).
                        </p>
                        <div>
                            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Unit Code (max 20 chars)</label>
                            <input
                                type="text"
                                value={modalData.code}
                                onChange={e => setModalData({ ...modalData, code: e.target.value })}
                                placeholder="e.g. cshift, pallet, bigha"
                                className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 font-mono"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Unit Name</label>
                            <input
                                type="text"
                                value={modalData.name}
                                onChange={e => setModalData({ ...modalData, name: e.target.value })}
                                placeholder="e.g. 10-Hour Custom Shift"
                                className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Physical Category</label>
                            <select
                                value={modalData.category}
                                onChange={e => setModalData({ ...modalData, category: e.target.value })}
                                className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                            >
                                <option value="time">Time (Base: hr)</option>
                                <option value="count">Count (Base: nos)</option>
                                <option value="weight">Weight (Base: kg)</option>
                                <option value="volume">Volume (Base: m3)</option>
                                <option value="length">Length (Base: m)</option>
                                <option value="area">Area (Base: m2)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Factor to Category Base</label>
                            <input
                                type="number"
                                step="any"
                                value={modalData.toBaseFactor}
                                onChange={e => setModalData({ ...modalData, toBaseFactor: e.target.value })}
                                placeholder="e.g. 10 (1 cshift = 10 hr)"
                                className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                required
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setActiveModal(null)}
                                className="px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isKeyLoading('modal_submit')}
                                className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5"
                            >
                                {isKeyLoading('modal_submit') ? <Loader2 size={13} className="animate-spin" /> : null}
                                Create Custom Unit
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* 40-Case Test Suite Runner Modal */}
            {activeModal === 'test_suite' && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-gray-900 text-gray-100 rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-gray-700 max-h-[88vh] flex flex-col">
                        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                                    <Terminal size={20} />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                                        Catalog Spec Test Suite
                                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                                            40 Cases
                                        </span>
                                    </h2>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        Real MySQL verification of all 15 invariants, conversions, effective dates, sync & concurrency
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleRunTestSuite()}
                                    disabled={isKeyLoading('test_suite')}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                                >
                                    {isKeyLoading('test_suite') ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} className="fill-current" />}
                                    <span>{isKeyLoading('test_suite') ? 'Running All...' : 'Run All (40)'}</span>
                                </button>
                                <button onClick={() => setActiveModal(null)} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-3 py-3.5 border-b border-gray-800 text-xs">
                            <div className="bg-gray-800/60 rounded-lg p-2.5 border border-gray-700/50">
                                <span className="text-gray-400 block text-[11px]">Executed</span>
                                <span className="text-lg font-bold text-white font-mono">{Object.keys(resultsByCase).length} / 40</span>
                            </div>
                            <div className="bg-emerald-950/40 rounded-lg p-2.5 border border-emerald-800/40">
                                <span className="text-emerald-400 block text-[11px]">Passed</span>
                                <span className="text-lg font-bold text-emerald-300 font-mono">{Object.values(resultsByCase).filter(r => r.status === 'PASS').length}</span>
                            </div>
                            <div className="bg-gray-800/40 rounded-lg p-2.5 border border-gray-700/50">
                                <span className="text-red-400 block text-[11px]">Failed</span>
                                <span className="text-lg font-bold text-red-400 font-mono">{Object.values(resultsByCase).filter(r => r.status === 'FAIL').length}</span>
                            </div>
                            <div className="bg-gray-800/60 rounded-lg p-2.5 border border-gray-700/50">
                                <span className="text-gray-400 block text-[11px]">Duration</span>
                                <span className="text-lg font-bold text-indigo-300 font-mono">{testReport?.durationMs || 0}ms</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-3 pb-2 text-xs">
                            {['all', 'pass', 'fail'].map(f => (
                                <button
                                    key={f}
                                    onClick={() => setTestFilter(f)}
                                    className={`px-2.5 py-1 rounded-md font-semibold uppercase ${testFilter === f ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto bg-black/60 rounded-xl p-3 border border-gray-800 font-mono text-xs space-y-1.5 min-h-[300px]">
                            {CATALOG_SPEC_CASES.map(c => {
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
                                    <div key={t.num} className={`p-2 rounded-lg border ${isPass ? 'bg-gray-900/60 border-gray-800' : isFail ? 'bg-red-950/30 border-red-900/60' : 'bg-gray-900/30 border-gray-800/40 text-gray-400'}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 truncate pr-2">
                                                {isPass ? <CheckCircle2 size={14} className="text-emerald-400 shrink-0" /> : isFail ? <XCircle size={14} className="text-red-400 shrink-0" /> : <span className="w-3.5 h-3.5 rounded-full border border-gray-600 inline-block shrink-0" />}
                                                <span className="text-gray-400 font-bold shrink-0">Case {t.num}:</span>
                                                <span className="truncate">{t.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 text-[11px]">
                                                {t.durationMs !== null && <span className="text-gray-500">{t.durationMs}ms</span>}
                                                {isFail && (
                                                    <button
                                                        onClick={() => setExpandedFailures(prev => {
                                                            const next = new Set(prev);
                                                            if (next.has(t.num)) next.delete(t.num); else next.add(t.num);
                                                            return next;
                                                        })}
                                                        className="text-blue-400 underline text-[10px]"
                                                    >
                                                        {isExpanded ? 'Hide' : 'Inspect'}
                                                    </button>
                                                )}
                                                <button
                                                    disabled={isCaseLoading || isKeyLoading('test_suite')}
                                                    onClick={() => handleRunTestSuite(t.num)}
                                                    className="px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700"
                                                >
                                                    {isCaseLoading ? '...' : 'Run'}
                                                </button>
                                            </div>
                                        </div>
                                        {isFail && isExpanded && t.error && (
                                            <div className="mt-2 p-2 bg-black/70 rounded border border-red-900 text-red-300 whitespace-pre-wrap text-[11px]">
                                                {t.error.message}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

