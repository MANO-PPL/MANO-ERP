const ARCHIVED_STATUSES = new Set(['archived', 'completed', 'complete']);

export function parseProjectMetadata(value) {
    if (!value) return {};
    if (typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value !== 'string') return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

export function toDateInput(value) {
    if (!value) return '';
    return String(value).split('T')[0];
}

function titleCaseStatus(value) {
    return String(value || 'active')
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}

function booleanArchiveFlag(project, metadata) {
    const value = project?.is_archived ?? project?.archived ?? metadata?.is_archived ?? metadata?.archived;
    if (typeof value === 'string') return ['true', '1', 'yes'].includes(value.toLowerCase());
    return value === true || value === 1;
}

export function isArchivedProject(project) {
    const metadata = parseProjectMetadata(project?.metadata);
    return booleanArchiveFlag(project, metadata)
        || ARCHIVED_STATUSES.has(String(project?.status || '').toLowerCase().trim());
}

export function normalizeProject(project) {
    const metadata = parseProjectMetadata(project?.metadata);
    const phases = Array.isArray(metadata.phases) ? metadata.phases : [];
    const completedPhases = phases.filter((phase) => Number(phase?.progress) === 100).length;
    const status = String(project?.status || 'active').toLowerCase();

    return {
        id: project?.id,
        code: project?.project_code || (project?.id == null ? '' : String(project.id)),
        name: project?.name || 'Untitled project',
        location: project?.location || '',
        status,
        statusLabel: titleCaseStatus(status),
        archived: isArchivedProject({ ...project, metadata }),
        owner: project?.employer || metadata.employer || metadata.client || 'System',
        client: project?.employer || metadata.client || '',
        description: metadata.description || project?.description || '',
        completion: Number.isFinite(Number(metadata.completion)) ? Number(metadata.completion) : 0,
        memberCount: Number(project?.member_count || 0),
        totalPhases: phases.length,
        completedPhases,
        issues: metadata.issues || 'None',
        tags: Array.isArray(metadata.tags) ? metadata.tags : [],
        startDate: toDateInput(project?.start_date),
        endDate: toDateInput(project?.end_date),
        logoUrl: project?.logo_url || metadata.logo_url || '',
        metadata,
        raw: project,
    };
}

export function filterProjects(projects, { collection = 'active', query = '', status = [], owners = [], issues = [] } = {}) {
    const needle = query.trim().toLowerCase();
    return projects.filter((project) => {
        if (collection === 'archived' ? !project.archived : project.archived) return false;
        const matchesQuery = !needle || [project.name, project.code, project.owner]
            .some((value) => String(value || '').toLowerCase().includes(needle));
        return matchesQuery
            && (status.length === 0 || status.includes(project.status))
            && (owners.length === 0 || owners.includes(project.owner))
            && (issues.length === 0 || issues.includes(project.issues));
    });
}

export function buildCreateProjectPayload(form, user, memberIds = []) {
    const payload = {
        name: String(form.name || '').trim(),
        status: form.status || 'active',
        member_ids: [...new Set(memberIds.map(Number).filter(Number.isFinite))],
        metadata: {
            description: String(form.description || '').trim(),
            employer: user?.organization_name || user?.user_name || 'System',
        },
    };
    const code = String(form.projectCode || '').trim();
    const location = String(form.location || '').trim();
    if (code) payload.project_code = code;
    if (location) payload.location = location;
    if (form.startDate) payload.start_date = form.startDate;
    if (form.endDate) payload.end_date = form.endDate;
    return payload;
}

export function buildUpdateProjectPayload(form, metadata = {}) {
    return {
        name: String(form.name || '').trim(),
        project_code: String(form.projectCode || '').trim() || null,
        location: String(form.location || '').trim() || null,
        start_date: form.startDate || null,
        end_date: form.endDate || null,
        metadata: {
            ...parseProjectMetadata(metadata),
            description: String(form.description || '').trim(),
        },
    };
}

export function buildProjectMetadataPatch(project, changes) {
    return { metadata: { ...parseProjectMetadata(project?.metadata), ...changes } };
}

export function getCreatedProjectId(response) {
    return response?.project_id ?? response?.project?.id ?? response?.project?.project_id ?? null;
}
