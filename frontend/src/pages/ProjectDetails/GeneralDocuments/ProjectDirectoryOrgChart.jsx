import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    UserPlus,
    FileSpreadsheet,
    Network
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import api from '../../../services/api';
import { generalDocsApi } from '../../../services/generalDocsApi';
import { ExcelGrid } from '../../../components/ExcelGrid';
import CompanyPersonnelSubGrid from './CompanyPersonnelSubGrid';
import { toast } from 'react-toastify';

// Modular imports
import { CATEGORY_OPTIONS } from './projectDirectoryOrgChart/constants';
import { buildOrgChartTree } from './projectDirectoryOrgChart/orgChartTreeBuilder';
import { getDirectoryColumns } from './projectDirectoryOrgChart/components/DirectoryGridColumns';
import CrmLinkModal from './projectDirectoryOrgChart/components/CrmLinkModal';
import OrgChartCanvas from './projectDirectoryOrgChart/components/OrgChartCanvas';

export const ProjectDirectoryOrgChart = ({
    initialTab = 'directory',
    onBack,
    setExtraBreadcrumbs,
    canWrite = true
}) => {
    const { id: projectId } = useParams();

    // Active View Mode: 'directory' (Spreadsheet via ExcelGrid) or 'chart' (Automated Org Chart)
    const [activeTab, setActiveTab] = useState(initialTab === 'chart' ? 'chart' : 'directory');

    // Data states
    const [gridRows, setGridRows] = useState([]);
    const [allJobNatures, setAllJobNatures] = useState([]);
    const [projectDetails, setProjectDetails] = useState({ name: '', location: '', client_name: '' });
    const [isLoading, setIsLoading] = useState(true);

    // Expandable Personnel Sub-Grid State & Deleted Personnel IDs
    const [expandedRowIds, setExpandedRowIds] = useState(new Set());
    const deletedPersonnelIdsRef = useRef(new Set());

    // Undo / Redo History Stacks
    const undoStackRef = useRef([]);
    const redoStackRef = useRef([]);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    const gridRowsRef = useRef(gridRows);
    gridRowsRef.current = gridRows;
    const expandedRowIdsRef = useRef(expandedRowIds);
    expandedRowIdsRef.current = expandedRowIds;

    const pushHistorySnapshot = useCallback(() => {
        const snapshot = {
            gridRows: JSON.parse(JSON.stringify(gridRowsRef.current)),
            expandedRowIds: Array.from(expandedRowIdsRef.current),
            deletedPersonnelIds: Array.from(deletedPersonnelIdsRef.current)
        };
        undoStackRef.current.push(snapshot);
        if (undoStackRef.current.length > 50) undoStackRef.current.shift();
        redoStackRef.current = [];
        setCanUndo(true);
        setCanRedo(false);
    }, []);

    const handleUndo = useCallback(() => {
        if (undoStackRef.current.length === 0) return;
        const previousSnapshot = undoStackRef.current.pop();
        const currentSnapshot = {
            gridRows: JSON.parse(JSON.stringify(gridRowsRef.current)),
            expandedRowIds: Array.from(expandedRowIdsRef.current),
            deletedPersonnelIds: Array.from(deletedPersonnelIdsRef.current)
        };
        redoStackRef.current.push(currentSnapshot);
        if (redoStackRef.current.length > 50) redoStackRef.current.shift();

        setGridRows(previousSnapshot.gridRows);
        setExpandedRowIds(new Set(previousSnapshot.expandedRowIds));
        deletedPersonnelIdsRef.current = new Set(previousSnapshot.deletedPersonnelIds || []);
        setCanUndo(undoStackRef.current.length > 0);
        setCanRedo(true);
        toast.info('Reverted last change');
    }, []);

    const handleRedo = useCallback(() => {
        if (redoStackRef.current.length === 0) return;
        const nextSnapshot = redoStackRef.current.pop();
        const currentSnapshot = {
            gridRows: JSON.parse(JSON.stringify(gridRowsRef.current)),
            expandedRowIds: Array.from(expandedRowIdsRef.current),
            deletedPersonnelIds: Array.from(deletedPersonnelIdsRef.current)
        };
        undoStackRef.current.push(currentSnapshot);
        if (undoStackRef.current.length > 50) undoStackRef.current.shift();

        setGridRows(nextSnapshot.gridRows);
        setExpandedRowIds(new Set(nextSnapshot.expandedRowIds));
        deletedPersonnelIdsRef.current = new Set(nextSnapshot.deletedPersonnelIds || []);
        setCanUndo(true);
        setCanRedo(redoStackRef.current.length > 0);
        toast.info('Restored change');
    }, []);

    // Filters
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');

    // Available CRM Contacts linking Drawer
    const [isLinkCrmModalOpen, setIsLinkCrmModalOpen] = useState(false);
    const [availableContacts, setAvailableContacts] = useState([]);
    const [isLinking, setIsLinking] = useState(false);

    // Org Chart View Mode State
    const [orgChartViewMode, setOrgChartViewMode] = useState('full'); // 'full' | 'governance' | 'company'
    const [focusedCompany, setFocusedCompany] = useState('');

    // Update breadcrumbs
    useEffect(() => {
        if (setExtraBreadcrumbs) {
            setExtraBreadcrumbs([
                { label: 'Project Directory & Org Chart' }
            ]);
        }
    }, [setExtraBreadcrumbs, projectId]);

    // Fetch Job Natures
    const fetchMetadata = async () => {
        try {
            const res = await api.get('/admin/job-natures');
            if (res.data?.success) {
                setAllJobNatures(res.data.job_natures || []);
            }
        } catch (err) {
            console.error('Failed to fetch job natures:', err);
        }
    };

    // Fetch Available CRM Contacts for linking
    const fetchAvailableCrmContacts = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await generalDocsApi.getAvailableParties(projectId, { limit: 1000 });
            setAvailableContacts(res.parties || []);
        } catch (err) {
            console.error('Failed to fetch CRM contacts:', err);
        }
    }, [projectId]);

    // Fetch Project Directory & Parties Data
    const fetchData = useCallback(async () => {
        if (!projectId) return;
        setIsLoading(true);
        try {
            const [dirRes, partiesRes, orgRes] = await Promise.all([
                generalDocsApi.getDirectory(projectId),
                generalDocsApi.getParties(projectId),
                generalDocsApi.getOrgChart(projectId)
            ]);

            const dirList = dirRes.directory || [];
            const partyList = partiesRes.parties || [];

            if (orgRes) {
                const orgData = orgRes.data || orgRes;
                setProjectDetails({
                    name: orgData.project_name || 'Project',
                    location: orgData.project_location || '',
                    client_name: orgData.client_name || ''
                });
            }

            // Group directory items by company/party
            const partyMap = new Map();

            dirList.forEach((d) => {
                const partyKey = d.party_id
                    ? `party_${d.party_id}`
                    : (d.company_name || 'unassigned').trim().toLowerCase();

                if (!partyMap.has(partyKey)) {
                    partyMap.set(partyKey, {
                        id: d.party_id ? `party_row_${d.party_id}` : `dir_row_${d.id}`,
                        pd_id: d.id,
                        party_id: d.party_id || null,
                        name: d.company_name || '',
                        category: d.category || 'Contractor',
                        job_name: d.job_nature || '',
                        address: d.address_line || '',
                        personnel: []
                    });
                }

                const party = partyMap.get(partyKey);
                if (d.contact_person || d.designation || d.id) {
                    party.personnel.push({
                        id: d.id,
                        pd_id: d.id,
                        party_id: d.party_id,
                        contact_person: d.contact_person || '',
                        designation: d.designation || '',
                        responsibilities: d.responsibilities || '',
                        telephone_no: d.mobile_no || '',
                        email: d.email || '',
                        address: d.address_line || ''
                    });
                }
            });

            // Also ensure any parties imported without directory persons yet still show up in the grid
            partyList.forEach((p) => {
                const partyKey = `party_${p.id}`;
                if (!partyMap.has(partyKey)) {
                    partyMap.set(partyKey, {
                        id: `party_row_${p.id}`,
                        party_id: p.id,
                        name: p.name || p.company_name || '',
                        category: p.category || 'Contractor',
                        job_name: p.job_name || p.job_nature || '',
                        address: p.address || '',
                        personnel: []
                    });
                }
            });

            // Set primary contact person fields on each row for the main grid display
            const mappedRows = Array.from(partyMap.values()).map((p) => {
                const primary = p.personnel[0] || {};
                return {
                    ...p,
                    contact_person: primary.contact_person || '',
                    designation: primary.designation || '',
                    responsibilities: primary.responsibilities || '',
                    telephone_no: primary.telephone_no || '',
                    email: primary.email || ''
                };
            });

            setGridRows(mappedRows);
        } catch (err) {
            console.error('Failed to load project directory & parties:', err);
            toast.error('Failed to load project directory data');
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        fetchMetadata();
        fetchData();
        fetchAvailableCrmContacts();
    }, [fetchData, fetchAvailableCrmContacts]);

    // Filtered rows for ExcelGrid
    const filteredGridRows = useMemo(() => {
        if (selectedCategoryFilter === 'All') return gridRows;
        return gridRows.filter(
            (r) => (r.category || '').toLowerCase() === selectedCategoryFilter.toLowerCase()
        );
    }, [gridRows, selectedCategoryFilter]);

    // Forward-fill helper: look upwards in gridRows to find the nearest non-blank company name
    const getParentCompanyName = useCallback((rowIndex) => {
        for (let i = rowIndex - 1; i >= 0; i--) {
            const row = gridRows[i];
            const name = (row?.name || row?.company_name || '').trim();
            if (name) {
                return name;
            }
        }
        return null;
    }, [gridRows]);

    // Distinct parties extracted from rows
    const uniqueParties = useMemo(() => {
        const map = new Map();
        gridRows.forEach((r, idx) => {
            const name = (r.name || r.company_name || getParentCompanyName(idx) || '').trim();
            if (name && !map.has(name.toLowerCase())) {
                map.set(name.toLowerCase(), {
                    id: r.party_id || r.id,
                    name: name,
                    category: r.category || 'Contractor',
                    job_name: r.job_name || '',
                    address: r.address || ''
                });
            }
        });
        return Array.from(map.values());
    }, [gridRows, getParentCompanyName]);

    // Count how many personnel belong to each company name
    const partyMemberCounts = useMemo(() => {
        const counts = {};
        gridRows.forEach((r, idx) => {
            const name = (r.name || r.company_name || getParentCompanyName(idx) || '').trim();
            if (name) {
                const count = r.personnel && r.personnel.length > 0 ? r.personnel.length : (r.contact_person ? 1 : 0);
                counts[name] = (counts[name] || 0) + count;
            }
        });
        return counts;
    }, [gridRows, getParentCompanyName]);

    // Unique temporary ID generator guaranteeing no duplicate React keys
    const getUniqueTempId = useCallback((prefix = 'temp_party') => {
        const rand = Math.random().toString(36).substring(2, 9);
        return `${prefix}_${Date.now()}_${rand}`;
    }, []);

    // Add a new company row (with default personnel entry)
    const handleAddCompany = useCallback(() => {
        pushHistorySnapshot();
        const newRowId = getUniqueTempId('temp_party');
        const newRow = {
            id: newRowId,
            party_id: null,
            name: '',
            category: 'Contractor',
            job_name: '',
            contact_person: '',
            designation: '',
            responsibilities: '',
            telephone_no: '',
            email: '',
            address: '',
            personnel: [
                {
                    id: getUniqueTempId('temp_person'),
                    contact_person: '',
                    designation: '',
                    responsibilities: '',
                    telephone_no: '',
                    email: ''
                }
            ],
            _status: 'new'
        };
        setGridRows((prev) => [newRow, ...prev]);
        setExpandedRowIds((prev) => new Set([...prev, newRowId]));
    }, [pushHistorySnapshot, getUniqueTempId]);

    // Handle "+ Add Row" from ExcelGrid
    const handleAddRows = useCallback((count = 1, position = 'top') => {
        pushHistorySnapshot();
        const newRows = Array.from({ length: count }).map(() => {
            const newRowId = getUniqueTempId('temp_party');
            return {
                id: newRowId,
                party_id: null,
                name: '',
                company_name: '',
                category: 'Contractor',
                job_name: '',
                contact_person: '',
                designation: '',
                responsibilities: '',
                telephone_no: '',
                email: '',
                address: '',
                personnel: [
                    {
                        id: getUniqueTempId('temp_person'),
                        contact_person: '',
                        designation: '',
                        responsibilities: '',
                        telephone_no: '',
                        email: ''
                    }
                ],
                _status: 'new'
            };
        });
        if (position === 'bottom') {
            setGridRows((prev) => [...prev, ...newRows]);
        } else {
            setGridRows((prev) => [...newRows, ...prev]);
        }
    }, [pushHistorySnapshot, getUniqueTempId]);

    // Update personnel list for a specific company
    const handleUpdatePersonnel = useCallback((rowId, updatedPersonnel, isAtomic = false) => {
        if (isAtomic) {
            pushHistorySnapshot();
        }
        setGridRows((prev) =>
            prev.map((row) => {
                if (row.id === rowId) {
                    const primary = updatedPersonnel[0] || {};
                    return {
                        ...row,
                        _status: row._status === 'new' ? 'new' : 'modified',
                        personnel: updatedPersonnel,
                        contact_person: primary.contact_person || '',
                        designation: primary.designation || '',
                        responsibilities: primary.responsibilities || '',
                        telephone_no: primary.telephone_no || '',
                        email: primary.email || ''
                    };
                }
                return row;
            })
        );
    }, [pushHistorySnapshot]);

    // Track deleted person ID for backend deletion
    const handleDeletePerson = useCallback((personId) => {
        if (personId && !String(personId).startsWith('temp_')) {
            deletedPersonnelIdsRef.current.add(personId);
        }
    }, []);

    // Handle cell change from ExcelGrid
    const handleCellChange = useCallback((rowIndex, colKey, value, isAtomic = false, rowObj = null) => {
        const targetRow = rowObj || filteredGridRows[rowIndex];
        if (!targetRow) return;

        if (isAtomic) {
            pushHistorySnapshot();
        }

        setGridRows((prev) =>
            prev.map((row) => {
                if (row.id === targetRow.id) {
                    const updated = {
                        ...row,
                        [colKey]: value,
                        _status: row._status === 'new' ? 'new' : 'modified'
                    };
                    if (colKey === 'name') {
                        updated.company_name = value;
                        if (updated.personnel && updated.personnel.length > 0) {
                            updated.personnel = updated.personnel.map((p) => ({
                                ...p,
                                company_name: value
                            }));
                        }
                    } else if (
                        colKey === 'contact_person' ||
                        colKey === 'designation' ||
                        colKey === 'responsibilities' ||
                        colKey === 'telephone_no' ||
                        colKey === 'email'
                    ) {
                        const personnelList = Array.isArray(updated.personnel) && updated.personnel.length > 0
                            ? [...updated.personnel]
                            : [{
                                id: getUniqueTempId('temp_person'),
                                party_id: updated.party_id || null,
                                contact_person: '',
                                designation: '',
                                responsibilities: '',
                                telephone_no: '',
                                email: '',
                                address: updated.address || ''
                            }];

                        personnelList[0] = {
                            ...personnelList[0],
                            [colKey]: value
                        };
                        updated.personnel = personnelList;
                    }
                    return updated;
                }
                return row;
            })
        );
    }, [filteredGridRows, pushHistorySnapshot, getUniqueTempId]);

    // Quick save personnel for a specific company directly from subgrid
    const handleSaveCompanyPersonnel = useCallback(async (rowId) => {
        const targetRow = gridRows.find((r) => r.id === rowId);
        if (!targetRow) return;

        const items = [];
        if (targetRow.personnel && targetRow.personnel.length > 0) {
            targetRow.personnel.forEach((p) => {
                if (!p.contact_person && !p.designation) return;
                items.push({
                    id: p.id && !String(p.id).startsWith('temp_') ? Number(p.id) : null,
                    party_id: targetRow.party_id || null,
                    name: targetRow.name,
                    company_name: targetRow.name,
                    category: targetRow.category || 'Contractor',
                    job_nature: targetRow.job_name || '',
                    contact_person: p.contact_person || '',
                    designation: p.designation || '',
                    responsibilities: p.responsibilities || '',
                    mobile_no: p.telephone_no || '',
                    email: p.email || '',
                    address_line: targetRow.address || ''
                });
            });
        }

        await generalDocsApi.syncDirectory(projectId, {
            items,
            deleted_ids: Array.from(deletedPersonnelIdsRef.current)
        });

        deletedPersonnelIdsRef.current.clear();
        await fetchData();
    }, [gridRows, projectId, fetchData]);

    // Quick Add Person to specific row's company: expands sub-grid and appends new person
    const handleQuickAddPersonToRow = useCallback((rowIndex) => {
        const row = filteredGridRows[rowIndex];
        if (!row) return;
        const rowId = row.id;

        pushHistorySnapshot();
        setExpandedRowIds((prev) => new Set([...prev, rowId]));

        setGridRows((prev) =>
            prev.map((r) => {
                if (r.id === rowId) {
                    const currentPersonnel = r.personnel || [];
                    const newPerson = {
                        id: getUniqueTempId('temp_person'),
                        party_id: r.party_id || null,
                        contact_person: '',
                        designation: '',
                        responsibilities: '',
                        telephone_no: '',
                        email: '',
                        address: r.address || ''
                    };
                    return {
                        ...r,
                        _status: r._status === 'new' ? 'new' : 'modified',
                        personnel: [...currentPersonnel, newPerson]
                    };
                }
                return r;
            })
        );
    }, [filteredGridRows, pushHistorySnapshot, getUniqueTempId]);

    // Jump from Org Chart node to Directory spreadsheet and expand company subgrid
    const handleJumpToCompanyPersonnel = useCallback((companyName, shouldAddNew = false) => {
        if (!companyName) {
            setActiveTab('directory');
            return;
        }
        const target = gridRows.find(
            (r) => (r.name || '').trim().toLowerCase() === companyName.trim().toLowerCase()
        );
        if (target) {
            setExpandedRowIds((prev) => new Set([...prev, target.id]));
            if (shouldAddNew) {
                const currentPersonnel = target.personnel || [];
                const newPerson = {
                    id: `temp_person_${Date.now()}_${currentPersonnel.length}`,
                    party_id: target.party_id || null,
                    contact_person: '',
                    designation: '',
                    responsibilities: '',
                    telephone_no: '',
                    email: '',
                    address: target.address || ''
                };
                setGridRows((prev) =>
                    prev.map((r) =>
                        r.id === target.id
                            ? {
                                ...r,
                                _status: r._status === 'new' ? 'new' : 'modified',
                                personnel: [...currentPersonnel, newPerson]
                            }
                            : r
                    )
                );
            }
        }
        setActiveTab('directory');
    }, [gridRows]);

    // Column Definitions for ExcelGrid
    const columns = useMemo(() => {
        return getDirectoryColumns({
            allJobNatures,
            availableContacts,
            partyMemberCounts,
            getParentCompanyName,
            handleQuickAddPersonToRow,
            canWrite,
            setExpandedRowIds
        });
    }, [
        allJobNatures,
        availableContacts,
        partyMemberCounts,
        getParentCompanyName,
        handleQuickAddPersonToRow,
        canWrite
    ]);

    // Batch Save Handler connecting directly to syncDirectory backend API
    const handleSaveGridBatch = async (payload) => {
        const { allRows, deleted } = payload;
        const itemsToSync = [];
        let lastKnownCompany = '';

        (allRows || []).forEach((gridRow, rowIndex) => {
            const stateRow = gridRows.find((r) => r.id === gridRow.id) || {};
            const row = {
                ...stateRow,
                ...gridRow,
                personnel: (Array.isArray(stateRow.personnel) && stateRow.personnel.length > 0)
                    ? stateRow.personnel
                    : (Array.isArray(gridRow.personnel) && gridRow.personnel.length > 0 ? gridRow.personnel : [])
            };

            let companyName = (row.name || row.company_name || '').trim();
            if (!companyName && typeof getParentCompanyName === 'function') {
                companyName = (getParentCompanyName(rowIndex) || '').trim();
            }
            if (!companyName && lastKnownCompany) {
                companyName = lastKnownCompany;
            }
            if (companyName) {
                lastKnownCompany = companyName;
            }

            if (!companyName && (!row.personnel || row.personnel.length === 0) && !row.contact_person) return;

            // Collect all personnel entries for this company
            let personnelList = Array.isArray(row.personnel) && row.personnel.length > 0
                ? [...row.personnel]
                : [];

            // If main row has contact details, ensure personnel[0] reflects them
            const hasMainPerson = Boolean(
                (row.contact_person || '').trim() ||
                (row.designation || '').trim() ||
                (row.responsibilities || '').trim() ||
                (row.telephone_no || '').trim() ||
                (row.email || '').trim()
            );

            if (personnelList.length === 0) {
                if (hasMainPerson) {
                    personnelList.push({
                        id: row.pd_id && !String(row.pd_id).startsWith('temp_') ? Number(row.pd_id) : null,
                        party_id: row.party_id || null,
                        contact_person: row.contact_person || '',
                        designation: row.designation || '',
                        responsibilities: row.responsibilities || '',
                        telephone_no: row.telephone_no || '',
                        email: row.email || '',
                        address: row.address || ''
                    });
                }
            } else {
                const primary = personnelList[0];
                personnelList[0] = {
                    ...primary,
                    contact_person: (row.contact_person !== undefined && row.contact_person !== '') ? row.contact_person : (primary.contact_person || ''),
                    designation: (row.designation !== undefined && row.designation !== '') ? row.designation : (primary.designation || ''),
                    responsibilities: (row.responsibilities !== undefined && row.responsibilities !== '') ? row.responsibilities : (primary.responsibilities || ''),
                    telephone_no: (row.telephone_no !== undefined && row.telephone_no !== '') ? row.telephone_no : (primary.telephone_no || ''),
                    email: (row.email !== undefined && row.email !== '') ? row.email : (primary.email || ''),
                    address: row.address || primary.address || ''
                };
            }

            const validPersonnel = personnelList.filter(
                (p) => (p.contact_person || '').trim() || (p.designation || '').trim() || (p.responsibilities || '').trim()
            );

            if (validPersonnel.length > 0) {
                validPersonnel.forEach((p) => {
                    itemsToSync.push({
                        id: p.id && !String(p.id).startsWith('temp_') ? Number(p.id) : null,
                        party_id: row.party_id || null,
                        name: companyName,
                        company_name: companyName,
                        category: row.category || 'Contractor',
                        job_name: row.job_name || '',
                        contact_person: p.contact_person || '',
                        designation: p.designation || '',
                        responsibilities: p.responsibilities || '',
                        telephone_no: p.telephone_no || '',
                        email: p.email || '',
                        address: row.address || ''
                    });
                });
            } else if (companyName) {
                // Sync company entry even if personnel details are not filled yet
                itemsToSync.push({
                    id: row.pd_id && !String(row.pd_id).startsWith('temp_') ? Number(row.pd_id) : null,
                    party_id: row.party_id || null,
                    name: companyName,
                    company_name: companyName,
                    category: row.category || 'Contractor',
                    job_name: row.job_name || '',
                    contact_person: row.contact_person || '',
                    designation: row.designation || '',
                    responsibilities: row.responsibilities || '',
                    telephone_no: row.telephone_no || '',
                    email: row.email || '',
                    address: row.address || ''
                });
            }
        });

        const allDeletedIds = Array.from(
            new Set([...(deleted || []), ...Array.from(deletedPersonnelIdsRef.current)])
        );

        await generalDocsApi.syncDirectory(projectId, {
            items: itemsToSync,
            deleted_ids: allDeletedIds
        });

        deletedPersonnelIdsRef.current.clear();
        toast.success('Directory and organization chart data synced successfully');
        await fetchData();
        await fetchAvailableCrmContacts();
    };

    // Commit linking CRM contacts from Drawer
    const handleCommitLinkContacts = async (selectedIds) => {
        if (!selectedIds || selectedIds.length === 0) return;
        setIsLinking(true);
        try {
            await generalDocsApi.addParties(projectId, selectedIds);
            toast.success(`Linked ${selectedIds.length} parties from CRM into project`);
            setIsLinkCrmModalOpen(false);
            await fetchData();
            await fetchAvailableCrmContacts();
        } catch (err) {
            console.error('Failed to link CRM contacts:', err);
            toast.error(err.response?.data?.message || 'Failed to link CRM contacts');
        } finally {
            setIsLinking(false);
        }
    };

    // Automatically generate Org Chart Tree from active grid rows with proper party and member hierarchy
    const orgChartTree = useMemo(() => {
        return buildOrgChartTree(
            gridRows,
            projectDetails,
            orgChartViewMode,
            focusedCompany,
            getParentCompanyName
        );
    }, [gridRows, projectDetails, orgChartViewMode, focusedCompany, getParentCompanyName]);

    // Global Keyboard Listener for Ctrl+Z (Undo) and Ctrl+Y (Redo) in Directory view
    useEffect(() => {
        if (activeTab !== 'directory') return;

        const handleKeyDown = (e) => {
            const isCtrlOrCmd = e.ctrlKey || e.metaKey;
            if (!isCtrlOrCmd) return;

            const key = e.key.toLowerCase();
            const activeElem = document.activeElement;
            const isInput =
                activeElem &&
                (activeElem.tagName === 'INPUT' ||
                    activeElem.tagName === 'TEXTAREA' ||
                    activeElem.tagName === 'SELECT');

            // Ctrl + Z: Undo
            if (key === 'z' && !e.shiftKey) {
                if (isInput) {
                    const val = activeElem.value || '';
                    const initVal = activeElem.dataset.initialValue || '';
                    if (val === '' || val === initVal) {
                        e.preventDefault();
                        e.stopPropagation();
                        activeElem.blur();
                        handleUndo();
                        return;
                    }
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                handleUndo();
                return;
            }

            // Ctrl + Y or Ctrl + Shift + Z: Redo
            if (key === 'y' || (key === 'z' && e.shiftKey)) {
                if (isInput) {
                    const val = activeElem.value || '';
                    const initVal = activeElem.dataset.initialValue || '';
                    if (val === '' || val === initVal) {
                        e.preventDefault();
                        e.stopPropagation();
                        activeElem.blur();
                        handleRedo();
                        return;
                    }
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                handleRedo();
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [activeTab, handleUndo, handleRedo]);

    return (
        <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden bg-white dark:bg-black font-sans text-left">
            {/* ─── Minimal Top Header with View Switcher in Right Corner ─── */}
            <div className="px-3 py-1.5 border-b border-gray-200 dark:border-white/10 shrink-0 bg-white dark:bg-black flex items-center justify-end">
                <div className="bg-gray-100 dark:bg-white/5 p-0.5 rounded-lg flex items-center border border-gray-200/60 dark:border-white/10">
                    <button
                        type="button"
                        onClick={() => setActiveTab('directory')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                            activeTab === 'directory'
                                ? 'bg-white dark:bg-[#161616] text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <FileSpreadsheet size={13} />
                        <span>Directory</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('chart')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                            activeTab === 'chart'
                                ? 'bg-white dark:bg-[#161616] text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <Network size={13} />
                        <span>Organisation Chart</span>
                    </button>
                </div>
            </div>

            {/* ─── Main Workspace View ─── */}
            <div className="flex-1 min-h-0 relative overflow-hidden bg-white dark:bg-black">
                {activeTab === 'directory' ? (
                    <ExcelGrid
                        data={filteredGridRows}
                        columns={columns}
                        primaryKey="id"
                        entityName="Project Directory"
                        canWrite={canWrite}
                        isLoading={isLoading}
                        onSave={handleSaveGridBatch}
                        onRefresh={fetchData}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        canUndo={canUndo}
                        canRedo={canRedo}
                        onAddRows={handleAddRows}
                        onCellChange={handleCellChange}
                        renderExpandedRow={(row, rowIndex, { collapse }) => (
                            <CompanyPersonnelSubGrid
                                companyRow={row}
                                onUpdatePersonnel={handleUpdatePersonnel}
                                onDeletePerson={handleDeletePerson}
                                onSavePersonnel={handleSaveCompanyPersonnel}
                                canWrite={canWrite}
                                onCollapse={collapse}
                            />
                        )}
                        expandedRowIds={expandedRowIds}
                        onToggleExpandRow={(rowId) => {
                            setExpandedRowIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(rowId)) next.delete(rowId);
                                else next.add(rowId);
                                return next;
                            });
                        }}
                        emptyMessage="No directory records or parties linked to this project"
                        extraFilters={
                            <div className="flex items-center gap-1.5 py-0.5">
                                {['All', ...CATEGORY_OPTIONS].map((cat) => {
                                    const isSelected = selectedCategoryFilter === cat;
                                    return (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => setSelectedCategoryFilter(cat)}
                                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-tight whitespace-nowrap transition-all cursor-pointer border ${
                                                isSelected
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                    : 'bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:border-blue-400'
                                            }`}
                                        >
                                            {cat}
                                        </button>
                                    );
                                })}
                            </div>
                        }
                        customActions={
                            <div className="flex items-center gap-1.5">
                                {canWrite && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleAddCompany}
                                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                            title="Add a new company and manage its team members directly in the grid"
                                        >
                                            <span>+ Add Company & Team</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setIsLinkCrmModalOpen(true)}
                                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                        >
                                            <UserPlus size={13} className="stroke-[2.5]" />
                                            <span>Import from CRM</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        }
                    />
                ) : (
                    <OrgChartCanvas
                        orgChartTree={orgChartTree}
                        orgChartViewMode={orgChartViewMode}
                        setOrgChartViewMode={setOrgChartViewMode}
                        focusedCompany={focusedCompany}
                        setFocusedCompany={setFocusedCompany}
                        uniqueParties={uniqueParties}
                        canWrite={canWrite}
                        onJumpToCompany={handleJumpToCompanyPersonnel}
                        onAddCompany={() => {
                            handleAddCompany();
                            setActiveTab('directory');
                        }}
                        onSwitchToDirectory={() => setActiveTab('directory')}
                    />
                )}
            </div>

            {/* ─── CRM Contact Linking Modal / Drawer ─── */}
            <CrmLinkModal
                isOpen={isLinkCrmModalOpen}
                onClose={() => setIsLinkCrmModalOpen(false)}
                availableContacts={availableContacts}
                onLinkContacts={handleCommitLinkContacts}
                isLinking={isLinking}
            />
        </div>
    );
};

export default ProjectDirectoryOrgChart;
