import api from './api';

/**
 * Service to format and save DPR data as a parent-child Transaction Voucher
 * into txn_transactions (Header) and txn_transaction_lines (Lines).
 */
export const dprApi = {
    /**
     * Map DPR form state to general ledger transaction creation payload
     */
    buildLedgerPayload: ({
        projectId,
        orgId = 1,
        reportDate,
        weather,
        siteCondition,
        timeSlots,
        labourRows,
        todayRows,
        tomorrowRows,
        eventsList,
        remarksList,
        distribution,
        preparedBy,
        projectParties = [],
        projectResources = [],
        isConfirmed = true
    }) => {
        // Map party names to pv_id
        const findPartyId = (partyName) => {
            if (!partyName) return null;
            const found = projectParties.find(p => (p.name || p.party_name || '').toLowerCase() === partyName.toLowerCase());
            return found ? (found.pv_id || found.id || found.project_party_id) : null;
        };

        // Fallback default party ID if specific agency isn't matched
        const fallbackPartyId = projectParties.length > 0
            ? (projectParties[0].pv_id || projectParties[0].id || projectParties[0].project_party_id)
            : 1;

        // Map resource names to resource_id
        const findResourceId = (itemName) => {
            if (!itemName) return null;
            const found = projectResources.find(r => (r.name || r.resource_name || '').toLowerCase() === itemName.toLowerCase());
            return found ? (found.id || found.resource_id) : null;
        };

        const lines = [];

        // 1. Labour Report Lines
        if (Array.isArray(labourRows)) {
            labourRows.forEach(row => {
                if (!row.agency) return;
                const pId = findPartyId(row.agency) || fallbackPartyId;
                const totalHeadcount = Object.keys(row)
                    .filter(k => k !== 'agency' && k !== 'remarks')
                    .reduce((sum, k) => sum + (parseInt(row[k]) || 0), 0);

                lines.push({
                    party_id: pId,
                    project_resource_id: null,
                    signed_qty: totalHeadcount,
                    role: 'EXECUTOR',
                    notes: JSON.stringify({
                        section: 'LABOUR',
                        agencyName: row.agency,
                        counts: row,
                        remarks: row.remarks || ''
                    })
                });
            });
        }

        // 2. Today's Progress Lines
        if (Array.isArray(todayRows)) {
            todayRows.forEach(row => {
                if (!row.item && !row.description) return;
                const resId = findResourceId(row.item);
                const qty = parseFloat(row.qty) || 0;

                lines.push({
                    party_id: fallbackPartyId,
                    project_resource_id: resId,
                    signed_qty: qty,
                    role: 'EXECUTOR',
                    notes: JSON.stringify({
                        section: 'TODAY_PROGRESS',
                        itemName: row.item,
                        description: row.description,
                        unit: row.unit
                    })
                });
            });
        }

        // 3. Tomorrow's Planning Lines
        if (Array.isArray(tomorrowRows)) {
            tomorrowRows.forEach(row => {
                if (!row.item && !row.description) return;
                const resId = findResourceId(row.item);
                const qty = parseFloat(row.qty) || 0;

                lines.push({
                    party_id: fallbackPartyId,
                    project_resource_id: resId,
                    signed_qty: qty,
                    role: 'EXECUTOR',
                    notes: JSON.stringify({
                        section: 'TOMORROW_PLAN',
                        itemName: row.item,
                        description: row.description,
                        unit: row.unit
                    })
                });
            });
        }

        // 4. Events Lines
        if (Array.isArray(eventsList)) {
            eventsList.filter(Boolean).forEach(evt => {
                lines.push({
                    party_id: fallbackPartyId,
                    project_resource_id: null,
                    signed_qty: 0,
                    role: 'EXECUTOR',
                    notes: JSON.stringify({
                        section: 'EVENT',
                        content: evt
                    })
                });
            });
        }

        // Fallback dummy line if lines array is empty to meet ledger minimum 1 line
        if (lines.length === 0) {
            lines.push({
                party_id: fallbackPartyId,
                project_resource_id: null,
                signed_qty: 0,
                role: 'EXECUTOR',
                notes: JSON.stringify({ section: 'EMPTY_HEADER' })
            });
        }

        // Header metadata
        const remarksObj = {
            weather: weather || 'sunny',
            siteCondition: siteCondition || 'dry',
            timeSlots: timeSlots || [],
            distribution: distribution || 'GLOWMEX',
            preparedBy: preparedBy || 'SITE ENGINEER',
            remarksList: remarksList || []
        };

        return {
            org_id: orgId,
            project_id: projectId,
            txn_type: 'DAILY_PROGRESS',
            txn_date: reportDate,
            status: isConfirmed ? 'CONFIRMED' : 'DRAFT',
            remarks: JSON.stringify(remarksObj),
            lines
        };
    },

    /**
     * Save / Post DPR Transaction to general ledger backend API
     */
    saveDPR: async (dprFormData) => {
        const payload = dprApi.buildLedgerPayload(dprFormData);
        const response = await api.post('/ledger/transactions', payload);
        return response.data;
    },

    /**
     * Parse raw transaction header & lines into frontend DPR report state object
     */
    parseTxnToReport: (txn) => {
        if (!txn) return null;
        let remarksObj = {};
        try {
            remarksObj = typeof txn.remarks === 'string' ? JSON.parse(txn.remarks) : (txn.remarks || {});
        } catch {}

        const lines = txn.lines || [];
        const labourData = [];
        const todayProgress = [];
        const tomorrowPlan = [];
        const eventsList = [];

        lines.forEach(l => {
            let notesObj = {};
            try {
                notesObj = typeof l.notes === 'string' ? JSON.parse(l.notes) : (l.notes || {});
            } catch {}

            if (notesObj.section === 'LABOUR') {
                labourData.push(notesObj.counts || { agency: notesObj.agencyName || 'Agency', remarks: notesObj.remarks || '' });
            } else if (notesObj.section === 'TODAY_PROGRESS') {
                todayProgress.push({
                    item: notesObj.itemName || '',
                    qty: l.signed_qty || 0,
                    unit: notesObj.unit || '',
                    description: notesObj.description || ''
                });
            } else if (notesObj.section === 'TOMORROW_PLAN') {
                tomorrowPlan.push({
                    item: notesObj.itemName || '',
                    qty: l.signed_qty || 0,
                    unit: notesObj.unit || '',
                    description: notesObj.description || ''
                });
            } else if (notesObj.section === 'EVENT') {
                if (notesObj.content) eventsList.push(notesObj.content);
            }
        });

        const dateStr = txn.txn_date ? String(txn.txn_date).split('T')[0] : new Date().toISOString().split('T')[0];

        return {
            id: txn.id,
            date: dateStr,
            summary: remarksObj.summaryNotes || `DPR for ${dateStr}. ${todayProgress.length} progress items recorded.`,
            completion: 100,
            personnel: labourData.reduce((acc, row) => acc + Object.keys(row).filter(k => k !== 'agency' && k !== 'remarks').reduce((s, k) => s + (parseInt(row[k]) || 0), 0), 0),
            readiness: 'Optimal',
            audit: {
                createdAt: txn.created_at || new Date().toISOString(),
                createdBy: remarksObj.preparedBy || 'SITE ENGINEER',
                lastUpdated: txn.updated_at || new Date().toISOString(),
                formTiming: 'Recorded',
                approval: {
                    status: txn.status || 'CONFIRMED',
                    by: 'Project Director',
                    date: txn.updated_at || new Date().toISOString()
                }
            },
            weather: remarksObj.weather || 'sunny',
            siteCondition: remarksObj.siteCondition || 'dry',
            timeSlots: remarksObj.timeSlots || [],
            labourData,
            todayProgress,
            tomorrowPlan,
            eventsList,
            remarksList: remarksObj.remarksList || [],
            distribution: remarksObj.distribution || 'GLOWMEX',
            preparedBy: remarksObj.preparedBy || 'SITE ENGINEER'
        };
    },

    /**
     * List DPRs for a project
     */
    listDPRs: async (projectId) => {
        try {
            const response = await api.get('/ledger/transactions', {
                params: {
                    project_id: projectId,
                    txn_type: 'DAILY_PROGRESS'
                }
            });
            const data = response.data?.data || response.data || [];
            if (Array.isArray(data)) {
                return data.map(dprApi.parseTxnToReport).filter(Boolean);
            }
            return [];
        } catch {
            return [];
        }
    },

    /**
     * Fetch single DPR voucher by transaction ID
     */
    getDPRById: async (transactionId) => {
        const response = await api.get(`/ledger/transactions/${transactionId}`);
        const data = response.data?.data || response.data;
        return dprApi.parseTxnToReport(data);
    }
};
