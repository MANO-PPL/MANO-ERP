import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';

/**
 * Fetch data for the Project Organization Chart
 * Aggregates project info, vendors, and directory data.
 */
export async function getProjectOrgChart(projectId) {
    if (!projectId) throw new AppError('projectId is required', 400);

    // 1. Fetch Basic Project Details
    const project = await db('proj_projects')
        .select([
            'id',
            'name as project_name',
            'location as project_location',
            'metadata'
        ])
        .where('id', projectId)
        .first();

    if (!project) throw new AppError('Project not found', 404);

    // Parse metadata to extract employer/client if it exists
    let clientName = null;
    if (project.metadata) {
        try {
            const meta = typeof project.metadata === 'string' ? JSON.parse(project.metadata) : project.metadata;
            clientName = meta.employer || meta.client_name || meta.client || null;
        } catch (e) {
            console.error('[orgService] Metadata parse error:', e.message);
        }
    }

    // 2. Fetch Vendors (Project Vendors + Contacts Join)
    const vendors = await db('pdoc_vendors as pv')
        .leftJoin('crm_contacts as c', function () {
            this.on('pv.vendors_id', 'c.id').andOn('c.type', db.raw("'vendor'"));
        })
        .leftJoin('crm_job_nature as jn', 'c.job_nature_id', 'jn.job_id')
        .where('pv.project_id', projectId)
        .select([
            'pv.pv_id',
            'pv.vendors_id as vendor_id',
            'c.name as company_name',
            'jn.job_name as job_nature',
            'c.mobile',
            'c.email'
        ])
        .orderBy('c.name', 'asc');

    // 3. Fetch Directory (Project Directory + Contacts Join)
    const directory = await db('pdoc_directory as pd')
        .leftJoin('pdoc_vendors as pv', 'pd.pv_id', 'pv.pv_id')
        .leftJoin('crm_contacts as c', 'pv.vendors_id', 'c.id')
        .leftJoin('crm_job_nature as jn', 'c.job_nature_id', 'jn.job_id')
        .where('pd.project_id', projectId)
        .select([
            'pd.pd_id',
            'pv.vendors_id as vendor_id',
            'c.name as company_name',
            'jn.job_name as job_nature',
            'pd.contact_person',
            'pd.designation',
            'pd.responsibilities',
            'pd.mobile_no',
            'pd.email',
            'pd.address_line'
        ])
        .orderBy('pd.created_at', 'desc');

    return {
        client_name: clientName,
        project_name: project.project_name,
        project_location: project.project_location,
        vendors,
        directory
    };
}

export default {
    getProjectOrgChart
};
