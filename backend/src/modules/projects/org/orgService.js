import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';

/**
 * Fetch data for the Project Organization Chart
 * Aggregates project info, parties, and directory data.
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

    // 2. Fetch Parties (Project Parties + Contacts Join)
    const parties = await db('proj_parties as pp')
        .leftJoin('crm_contacts as c', 'pp.contact_id', 'c.id')
        .leftJoin('crm_job_nature as jn', 'c.job_nature_id', 'jn.job_id')
        .where('pp.project_id', projectId)
        .select([
            'pp.id as pv_id',
            'pp.id as id',
            'pp.contact_id as party_id',
            'pp.contact_id as contact_id',
            'c.name as company_name',
            'c.category',
            'jn.job_name as job_nature',
            'c.mobile',
            'c.email'
        ])
        .orderBy('c.name', 'asc');

    if (!clientName && parties && parties.length > 0) {
        const clientParty = parties.find(p => (p.category || '').toLowerCase() === 'client');
        if (clientParty) clientName = clientParty.company_name;
    }

    // 3. Fetch Directory (Project Directory + Contacts Join)
    const directory = await db('proj_directory as pd')
        .leftJoin('proj_parties as pp', 'pd.party_id', 'pp.id')
        .leftJoin('crm_contacts as c', 'pp.contact_id', 'c.id')
        .leftJoin('crm_job_nature as jn', 'c.job_nature_id', 'jn.job_id')
        .where('pd.project_id', projectId)
        .select([
            'pd.pd_id',
            'pd.party_id as pv_id',
            'pd.party_id as party_id',
            'pp.contact_id as contact_id',
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
        parties,
        directory
    };
}

export default {
    getProjectOrgChart
};
