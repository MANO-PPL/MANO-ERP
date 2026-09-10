import { db as defaultDb } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';

/**
 * Format a Date or date string to YYYY-MM-DD cleanly.
 */
function formatDate(dateVal) {
    if (!dateVal) return null;
    try {
        const d = new Date(dateVal);
        if (Number.isNaN(d.getTime())) return null;
        return d.toISOString().split('T')[0];
    } catch {
        return null;
    }
}

/**
 * Aggregates a 360-degree executive briefing for a project:
 * - Core metadata & status
 * - Task counts, overdue flags, completion percentage
 * - Key stakeholders (Client, Contractors, Consultants)
 * - Assigned staff & team members
 * - Timeline elapsed & schedule health status
 * - Quick action teleport links
 *
 * @param {number} orgId - Organization ID for tenant isolation
 * @param {number} projectId - ID of the project
 * @param {object} [connection] - Optional Knex connection/mock for testing
 * @returns {Promise<Array<object>>} Single-element array with kind: 'briefing'
 */
export async function getProjectExecutiveBriefing(orgId, projectId, connection = null) {
    const knex = connection || defaultDb;
    if (!projectId) throw new AppError('projectId is required', 400);

    // 1. Fetch project core details with strict tenant isolation
    const project = await knex('proj_projects')
        .where({ id: projectId, org_id: orgId })
        .first();

    if (!project) {
        throw new AppError('Project not found', 404);
    }

    // 2. Fetch and aggregate tasks
    const tasks = await knex('proj_tasks')
        .where({ project_id: projectId })
        .select('id', 'name', 'status', 'priority', 'start_date', 'due_date');

    const totalTasks = tasks.length;
    let completedTasks = 0;
    let inProgressTasks = 0;
    let pendingTasks = 0;
    let overdueTasks = 0;
    let highPriorityTasks = 0;

    const now = Date.now();

    for (const task of tasks) {
        const status = String(task.status || '').toLowerCase().trim();
        const isDone = ['completed', 'done', 'finished'].includes(status);

        if (isDone) {
            completedTasks++;
        } else if (['in_progress', 'in progress', 'ongoing', 'working'].includes(status)) {
            inProgressTasks++;
        } else {
            pendingTasks++;
        }

        // Overdue check for non-completed tasks
        if (!isDone && task.due_date) {
            const dueTime = new Date(task.due_date).getTime();
            if (!Number.isNaN(dueTime) && dueTime < now) {
                overdueTasks++;
            }
        }

        // High priority check for non-completed tasks
        const priority = String(task.priority || '').toLowerCase().trim();
        if (!isDone && ['high', 'urgent', 'critical'].includes(priority)) {
            highPriorityTasks++;
        }
    }

    const taskCompletionRate = totalTasks > 0
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0;

    // 3. Fetch project parties & contacts
    let parties = [];
    try {
        parties = await knex('proj_parties as pp')
            .join('crm_contacts as c', 'pp.contact_id', 'c.id')
            .where('pp.project_id', projectId)
            .select(
                'c.id as contact_id',
                'c.name',
                'c.category',
                'c.mobile',
                'c.email'
            )
            .orderBy('c.name', 'asc');
    } catch {
        parties = [];
    }

    let clientName = null;
    const clientParty = parties.find(p => String(p.category || '').toLowerCase() === 'client');
    if (clientParty) {
        clientName = clientParty.name;
    }

    // 4. Fetch assigned team members
    let members = [];
    try {
        members = await knex('proj_members as pm')
            .join('iam_users as u', 'pm.user_id', 'u.id')
            .where('pm.project_id', projectId)
            .select('u.id', 'u.name', 'u.email', 'u.role', 'u.user_type')
            .orderBy('u.name', 'asc');
    } catch {
        members = [];
    }

    // 5. Timeline elapsed and schedule health computation
    let elapsedPercent = null;
    let healthStatus = 'Active';
    let healthColor = 'blue';

    const startDateStr = formatDate(project.start_date);
    const endDateStr = formatDate(project.end_date);

    if (project.start_date && project.end_date) {
        const startTime = new Date(project.start_date).getTime();
        const endTime = new Date(project.end_date).getTime();

        if (!Number.isNaN(startTime) && !Number.isNaN(endTime) && endTime > startTime) {
            const rawElapsed = ((now - startTime) / (endTime - startTime)) * 100;
            elapsedPercent = Math.min(100, Math.max(0, Math.round(rawElapsed)));

            if (overdueTasks > 0 || taskCompletionRate < elapsedPercent - 20) {
                healthStatus = 'Delayed';
                healthColor = 'red';
            } else if (taskCompletionRate < elapsedPercent - 10) {
                healthStatus = 'At Risk';
                healthColor = 'amber';
            } else {
                healthStatus = 'On Track';
                healthColor = 'green';
            }
        }
    }

    if (elapsedPercent === null) {
        if (overdueTasks > 0) {
            healthStatus = 'Needs Attention';
            healthColor = 'amber';
        } else {
            healthStatus = 'Active';
            healthColor = 'green';
        }
    }

    // 6. Extract project phases from metadata
    let meta = {};
    if (project.metadata) {
        try {
            meta = typeof project.metadata === 'string' ? JSON.parse(project.metadata) : project.metadata;
        } catch {
            meta = {};
        }
    }
    const rawPhases = Array.isArray(meta.phases) ? meta.phases : [];
    const phases = rawPhases.map((p, idx) => ({
        id: p.id || idx + 1,
        name: p.name || `Phase ${idx + 1}`,
        progress: Number(p.progress || 0),
        weight: Number(p.weight || 0),
        startDate: p.startDate || null,
        endDate: p.endDate || null,
        status: Number(p.progress || 0) >= 100 ? 'Completed' : (Number(p.progress || 0) > 0 ? 'In Progress' : 'Not Started')
    }));

    // 7. Assemble compact briefing record
    return [{
        kind: 'briefing',
        title: project.name ? `${project.name} Executive Briefing` : `Project #${project.id} Executive Briefing`,
        projectId: Number(project.id),
        projectName: project.name,
        projectCode: project.project_code || null,
        status: project.status || 'active',
        location: project.location || null,
        completion: meta.completion !== undefined ? Number(meta.completion) : taskCompletionRate,
        timeline: {
            startDate: startDateStr,
            endDate: endDateStr,
            elapsedPercent,
            health: healthStatus,
            healthColor
        },
        phases,
        tasks: {
            total: totalTasks,
            completed: completedTasks,
            inProgress: inProgressTasks,
            pending: pendingTasks,
            overdue: overdueTasks,
            highPriority: highPriorityTasks,
            completionRate: taskCompletionRate
        },
        stakeholders: {
            clientName,
            partiesCount: parties.length,
            keyParties: parties.slice(0, 5).map(p => ({
                name: p.name,
                category: p.category || 'Partner',
                mobile: p.mobile || null
            }))
        },
        team: {
            memberCount: members.length,
            keyMembers: members.slice(0, 5).map(m => ({
                name: m.name,
                role: m.role || m.user_type || 'Member'
            }))
        },
        quickLinks: [
            { label: 'Dashboard', path: `/projects/${project.id}` },
            { label: 'Tasks', path: `/projects/${project.id}?tab=tasks` },
            { label: 'Parties', path: `/projects/${project.id}?tab=parties` },
            { label: 'Drawings', path: `/projects/${project.id}?tab=drawings` }
        ]
    }];
}
