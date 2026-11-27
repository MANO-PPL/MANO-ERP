import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';
import { getProjectParties } from '../parties/partyService.js';
import { fetchProjectDirectory } from '../directory/directoryService.js';

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

    // 2. Fetch Parties and Directory via their project services
    const [{ parties: rawParties }, { directory }] = await Promise.all([
        getProjectParties(projectId),
        fetchProjectDirectory(projectId)
    ]);

    const parties = rawParties.map(p => ({
        ...p,
        company_name: p.name
    }));

    if (!clientName && parties.length > 0) {
        const clientParty = parties.find(p => (p.category || '').toLowerCase() === 'client');
        if (clientParty) clientName = clientParty.company_name;
    }

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
