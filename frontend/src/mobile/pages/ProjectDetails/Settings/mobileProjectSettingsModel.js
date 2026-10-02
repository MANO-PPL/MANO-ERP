import { parseProjectMetadata, toDateInput } from '../../Projects/projectModel.js';

export const PROJECT_STATUS_OPTIONS = Object.freeze([
    { value: 'active', label: 'Active - Ongoing Work' }, { value: 'completed', label: 'Completed - Handed Over' },
    { value: 'on-hold', label: 'On Hold - Temporarily Paused' }, { value: 'archived', label: 'Archived - Closed Record' },
]);

export function projectSettingsForm(project = {}) {
    const metadata = parseProjectMetadata(project.metadata);
    return { name: project.name || '', projectCode: String(project.project_code || project.id || ''), description: metadata.description || '', location: project.location || '', startDate: toDateInput(project.start_date), endDate: toDateInput(project.end_date), status: project.status || 'active' };
}

export function buildProjectSettingsPayload(project, form) {
    return { name: form.name.trim(), project_code: form.projectCode.trim() || null, location: form.location.trim() || null, status: form.status, start_date: form.startDate || null, end_date: form.endDate || null, metadata: { ...parseProjectMetadata(project.metadata), description: form.description.trim() } };
}

export function validateProjectLogo(file) {
    if (!file) return '';
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) return 'Please select a PNG, JPG, WEBP, or SVG image.';
    if (file.size > 5 * 1024 * 1024) return 'Logo file size must be less than 5MB.';
    return '';
}

export async function saveProjectSettingsWorkflow({ project, form, logoFile, removeLogo, projectService }) {
    const payload = buildProjectSettingsPayload(project, form);
    const base = await projectService.updateProject(project.id, payload);
    if (base?.success === false) throw new Error(base.message || 'Project settings could not be saved.');
    try {
        if (logoFile) {
            const logo = await projectService.uploadProjectLogo(project.id, logoFile);
            if (logo?.success === false) throw new Error(logo.message || 'Logo upload failed.');
        } else if (removeLogo) {
            const removed = await projectService.updateProject(project.id, { ...payload, logo_url: null });
            if (removed?.success === false) throw new Error(removed.message || 'Logo removal failed.');
        }
    } catch (error) {
        return { success: true, partial: true, error, payload };
    }
    return { success: true, partial: false, payload };
}
