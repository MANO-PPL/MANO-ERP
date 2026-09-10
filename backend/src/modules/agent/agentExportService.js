import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { fail } from './agentValidation.js';

// 30-minute time-to-live for temporary generated reports
const TTL_MS = 30 * 60 * 1000;
const exportsMap = new Map();

function sweep() {
    const now = Date.now();
    for (const [id, item] of exportsMap.entries()) {
        if (now - item.createdAt > TTL_MS) {
            exportsMap.delete(id);
        }
    }
}
setInterval(sweep, 5 * 60 * 1000).unref();

export function getExportedDataset(downloadId, orgId) {
    const item = exportsMap.get(downloadId);
    if (!item || Number(item.orgId) !== Number(orgId)) {
        return null;
    }
    return item;
}

export function createExportService({ db, approvalService }) {
    return {
        async generateExcelReport(orgId, { entity = 'vendors', query, limit = 200, title } = {}, conn = db) {
            const cleanEntity = String(entity || 'vendors').toLowerCase().trim();
            let reportTitle = title || `MANO-ERP ${cleanEntity.toUpperCase()} DIRECTORY`;
            let columns = [];
            let rows = [];

            // 1. Fetch Data according to entity type
            if (cleanEntity === 'vendors') {
                reportTitle = title || 'MANO-ERP VENDORS DIRECTORY REPORT';
                columns = ['ID', 'Vendor Name', 'Category', 'Contact Person', 'Mobile', 'Email', 'Location', 'GST No'];
                let q = conn('crm_contacts')
                    .where('org_id', orgId)
                    .where(function () {
                        this.whereNull('category')
                            .orWhereRaw('LOWER(??) NOT IN (?, ?)', ['category', 'client', 'pmc']);
                    })
                    .select('id', 'name', 'category', 'contact_person', 'mobile', 'email', 'location', 'gst_no')
                    .orderBy('name', 'asc');

                if (query) {
                    q = q.where(function () {
                        this.whereILike('name', `%${query}%`)
                            .orWhereILike('location', `%${query}%`)
                            .orWhereILike('category', `%${query}%`);
                    });
                }
                const contacts = await q.limit(limit);
                rows = contacts.map(c => [
                    c.id,
                    c.name || 'Unnamed Vendor',
                    c.category || 'Supplier',
                    c.contact_person || '-',
                    c.mobile || '-',
                    c.email || '-',
                    c.location || '-',
                    c.gst_no || '-'
                ]);
            } else if (cleanEntity === 'clients') {
                reportTitle = title || 'MANO-ERP CLIENTS DIRECTORY REPORT';
                columns = ['ID', 'Client Name', 'Category', 'Contact Person', 'Mobile', 'Email', 'Location', 'GST No'];
                let q = conn('crm_contacts')
                    .where('org_id', orgId)
                    .whereRaw('LOWER(??) = ?', ['category', 'client'])
                    .select('id', 'name', 'category', 'contact_person', 'mobile', 'email', 'location', 'gst_no')
                    .orderBy('name', 'asc');

                if (query) {
                    q = q.where(function () {
                        this.whereILike('name', `%${query}%`)
                            .orWhereILike('location', `%${query}%`);
                    });
                }
                const contacts = await q.limit(limit);
                rows = contacts.map(c => [
                    c.id,
                    c.name || 'Unnamed Client',
                    c.category || 'Client',
                    c.contact_person || '-',
                    c.mobile || '-',
                    c.email || '-',
                    c.location || '-',
                    c.gst_no || '-'
                ]);
            } else if (cleanEntity === 'projects') {
                reportTitle = title || 'MANO-ERP PROJECTS STATUS REPORT';
                columns = ['ID', 'Project Code', 'Project Name', 'Status', 'Start Date', 'End Date', 'Location'];
                let q = conn('proj_projects')
                    .where('org_id', orgId)
                    .select('id', 'code', 'name', 'status', 'start_date', 'end_date', 'location')
                    .orderBy('name', 'asc');

                if (query) {
                    q = q.where(function () {
                        this.whereILike('name', `%${query}%`)
                            .orWhereILike('code', `%${query}%`)
                            .orWhereILike('status', `%${query}%`);
                    });
                }
                const projects = await q.limit(limit);
                rows = projects.map(p => [
                    p.id,
                    p.code || `PRJ-${p.id}`,
                    p.name || 'Project',
                    p.status || 'Active',
                    p.start_date ? new Date(p.start_date).toISOString().slice(0, 10) : '-',
                    p.end_date ? new Date(p.end_date).toISOString().slice(0, 10) : '-',
                    p.location || '-'
                ]);
            } else if (cleanEntity === 'materials' || cleanEntity === 'resources') {
                reportTitle = title || 'MANO-ERP MATERIALS & RATES CATALOG';
                columns = ['ID', 'Resource Code', 'Resource Name', 'Type', 'Base Unit', 'Active Rate (₹)', 'Effective Date'];
                let q = conn('res_resources as r')
                    .leftJoin('res_rates as rr', function () {
                        this.on('r.id', '=', 'rr.resource_id').andOn('rr.is_active', '=', conn.raw('1'));
                    })
                    .where('r.org_id', orgId)
                    .select('r.id', 'r.code', 'r.name', 'r.type', 'r.base_unit_code', 'rr.rate', 'rr.effective_from')
                    .orderBy('r.name', 'asc');

                if (query) {
                    q = q.where(function () {
                        this.whereILike('r.name', `%${query}%`)
                            .orWhereILike('r.code', `%${query}%`);
                    });
                }
                const materials = await q.limit(limit);
                rows = materials.map(m => [
                    m.id,
                    m.code || `RES-${m.id}`,
                    m.name || 'Resource',
                    m.type || 'material',
                    m.base_unit_code || 'unit',
                    m.rate ? Number(m.rate).toFixed(2) : 'No active rate',
                    m.effective_from ? new Date(m.effective_from).toISOString().slice(0, 10) : '-'
                ]);
            } else if (cleanEntity === 'approvals') {
                reportTitle = title || 'MANO-ERP PENDING APPROVALS QUEUE REPORT';
                columns = ['ID', 'Type', 'Item Title', 'Project', 'Status', 'Severity / Level', 'Submitted By', 'Submitted At'];
                let pendingItems = [];
                if (approvalService) {
                    const queue = await approvalService.listPendingApprovals(orgId, { limit }, conn);
                    pendingItems = queue.items;
                }
                rows = pendingItems.map(item => [
                    item.id,
                    item.itemType === 'qaqc_observation' ? 'Quality Observation' : (item.itemType === 'document_cycle' ? 'Document Cycle' : 'Milestone Task'),
                    item.title || 'Approval Item',
                    item.projectName || 'Project',
                    item.status || 'Pending',
                    item.severity || 'Normal',
                    item.submittedBy || 'Team Member',
                    item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : '-'
                ]);
            } else if (cleanEntity === 'transactions') {
                reportTitle = title || 'MANO-ERP TRANSACTIONS REGISTER REPORT';
                columns = ['ID', 'Transaction Type', 'Project Name', 'Project Code', 'Date', 'Status', 'Remarks'];
                let q = conn('txn_transactions as t')
                    .leftJoin('proj_projects as p', 't.project_id', 'p.id')
                    .where('t.org_id', orgId)
                    .select('t.id', 't.txn_type', 't.txn_date', 't.created_at', 't.status', 't.remarks', 'p.name as project_name', 'p.code as project_code')
                    .orderBy('t.id', 'desc');

                if (query) {
                    q = q.where(function () {
                        this.whereILike('t.txn_type', `%${query}%`)
                            .orWhereILike('t.status', `%${query}%`)
                            .orWhereILike('p.name', `%${query}%`);
                    });
                }
                const txns = await q.limit(limit);
                rows = txns.map(t => {
                    let cleanRemarks = t.remarks;
                    if (cleanRemarks && typeof cleanRemarks === 'string' && cleanRemarks.startsWith('{')) {
                        try {
                            const parsed = JSON.parse(cleanRemarks);
                            if (Array.isArray(parsed.remarksList) && parsed.remarksList.filter(Boolean).length > 0) {
                                cleanRemarks = parsed.remarksList.filter(Boolean).join('; ');
                            } else if (parsed.distribution) {
                                cleanRemarks = `Distribution: ${parsed.distribution}`;
                            }
                        } catch { /* keep */ }
                    }
                    return [
                        t.id,
                        (t.txn_type || 'General').replace(/_/g, ' '),
                        t.project_name || '-',
                        t.project_code || '-',
                        t.txn_date ? new Date(t.txn_date).toISOString().slice(0, 10) : (t.created_at ? new Date(t.created_at).toISOString().slice(0, 10) : '-'),
                        t.status || 'CONFIRMED',
                        cleanRemarks || '-'
                    ];
                });
            } else if (cleanEntity === 'billing' || cleanEntity === 'bills' || cleanEntity === 'invoices') {
                reportTitle = title || 'MANO-ERP BILLING & INVOICING REGISTER REPORT';
                columns = ['ID', 'Document / Invoice Type', 'Project Name', 'Project Code', 'Date', 'Status', 'Remarks'];
                let q = conn('txn_transactions as t')
                    .leftJoin('proj_projects as p', 't.project_id', 'p.id')
                    .where('t.org_id', orgId)
                    .select('t.id', 't.txn_type', 't.txn_date', 't.created_at', 't.status', 't.remarks', 'p.name as project_name', 'p.code as project_code')
                    .orderBy('t.id', 'desc');

                if (query) {
                    q = q.where(function () {
                        this.whereILike('t.txn_type', `%${query}%`)
                            .orWhereILike('t.status', `%${query}%`)
                            .orWhereILike('p.name', `%${query}%`);
                    });
                }
                const txns = await q.limit(limit);
                rows = txns.map(t => {
                    let cleanRemarks = t.remarks;
                    if (cleanRemarks && typeof cleanRemarks === 'string' && cleanRemarks.startsWith('{')) {
                        try {
                            const parsed = JSON.parse(cleanRemarks);
                            if (Array.isArray(parsed.remarksList) && parsed.remarksList.filter(Boolean).length > 0) {
                                cleanRemarks = parsed.remarksList.filter(Boolean).join('; ');
                            } else if (parsed.distribution) {
                                cleanRemarks = `Distribution: ${parsed.distribution}`;
                            }
                        } catch { /* keep */ }
                    }
                    return [
                        t.id,
                        (t.txn_type || 'Billing').replace(/_/g, ' '),
                        t.project_name || '-',
                        t.project_code || '-',
                        t.txn_date ? new Date(t.txn_date).toISOString().slice(0, 10) : (t.created_at ? new Date(t.created_at).toISOString().slice(0, 10) : '-'),
                        t.status || 'CONFIRMED',
                        cleanRemarks || '-'
                    ];
                });
            } else {
                fail('validation_error', 'unsupported_export_entity');
            }

            // 2. Build Styled Excel Workbook
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'MANO-ERP AI Assistant';
            workbook.lastModifiedBy = 'MANO-ERP Agent';
            workbook.created = new Date();
            workbook.modified = new Date();

            const sheetName = cleanEntity.charAt(0).toUpperCase() + cleanEntity.slice(1, 25);
            const worksheet = workbook.addWorksheet(sheetName, {
                views: [{ showGridLines: true }]
            });

            const colCount = Math.max(columns.length, 1);

            // Title Banner (Row 1)
            worksheet.mergeCells(1, 1, 1, colCount);
            const titleCell = worksheet.getCell(1, 1);
            titleCell.value = reportTitle;
            titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
            titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Slate 900
            titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
            worksheet.getRow(1).height = 30;

            // Subtitle / Metadata (Row 2)
            worksheet.mergeCells(2, 1, 2, colCount);
            const metaCell = worksheet.getCell(2, 1);
            metaCell.value = `Generated on: ${new Date().toLocaleString()} | Total Records: ${rows.length} | Confidential - Internal ERP Document`;
            metaCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF94A3B8' } }; // Slate 400
            metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Slate 800
            metaCell.alignment = { vertical: 'middle', horizontal: 'center' };
            worksheet.getRow(2).height = 20;

            // Blank Row 3
            worksheet.getRow(3).height = 10;

            // Column Header Row (Row 4)
            const headerRow = worksheet.getRow(4);
            headerRow.values = columns;
            headerRow.height = 24;
            headerRow.eachCell((cell) => {
                cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Slate 800
                cell.alignment = { vertical: 'middle', horizontal: 'left' };
                cell.border = {
                    bottom: { style: 'medium', color: { argb: 'FF3B82F6' } } // Blue 500 accent
                };
            });

            // Data Rows (Row 5+)
            rows.forEach((rowValues, idx) => {
                const dataRow = worksheet.addRow(rowValues);
                dataRow.height = 20;
                const isEven = idx % 2 === 0;
                const fillColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC'; // Alternating zebra tint

                dataRow.eachCell((cell, colIndex) => {
                    cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF1E293B' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
                    cell.border = {
                        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                    };
                    if (colIndex === 1) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else {
                        cell.alignment = { vertical: 'middle', horizontal: 'left' };
                    }
                });
            });

            // Auto-compute column widths
            columns.forEach((colName, index) => {
                let maxLen = String(colName).length;
                for (const row of rows) {
                    const valStr = String(row[index] ?? '');
                    if (valStr.length > maxLen) maxLen = valStr.length;
                }
                const column = worksheet.getColumn(index + 1);
                column.width = Math.min(Math.max(maxLen + 4, 12), 40);
            });

            // 3. Stage generated buffer in memory
            const buffer = await workbook.xlsx.writeBuffer();
            const downloadId = randomUUID();
            const dateStamp = new Date().toISOString().slice(0, 10);
            const filename = `MANO_${cleanEntity.charAt(0).toUpperCase() + cleanEntity.slice(1)}_Report_${dateStamp}.xlsx`;

            exportsMap.set(downloadId, {
                buffer: Buffer.from(buffer),
                filename,
                orgId: Number(orgId),
                createdAt: Date.now()
            });

            return {
                kind: 'excel_export',
                downloadId,
                downloadUrl: `/api/agent/export/${downloadId}`,
                filename,
                entity: cleanEntity,
                title: reportTitle,
                rowCount: rows.length,
                columnCount: columns.length,
                fileSizeBytes: buffer.length,
                columns,
                sampleRows: rows.slice(0, 3)
            };
        }
    };
}
