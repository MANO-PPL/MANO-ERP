import { parseProjectMetadata } from '../../Projects/projectModel.js';

export function normalizePhases(project) {
    const metadata = parseProjectMetadata(project?.metadata);
    return Array.isArray(metadata.phases) ? metadata.phases.map((phase, index) => ({ ...phase, id: phase.id ?? `phase-${index}` })) : [];
}

export function phaseStatus(phase) {
    const progress = Number(phase?.progress) || 0;
    return progress >= 100 ? 'COMPLETED' : progress > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';
}

export function phaseMetrics(phases = []) {
    const totalWeight = phases.reduce((sum, phase) => sum + (Number(phase.weight) || 0), 0);
    const completion = phases.reduce((sum, phase) => sum + (Number(phase.progress) || 0) * ((Number(phase.weight) || 0) / 100), 0);
    return { totalWeight: Math.round(totalWeight * 10) / 10, completion: Math.round(completion), completed: phases.filter((phase) => Number(phase.progress) === 100).length };
}

export function buildPhasesProjectPayload(project, phases) {
    const metadata = parseProjectMetadata(project?.metadata); const metrics = phaseMetrics(phases);
    return {
        name: project.name, location: project.location ?? null, status: project.status,
        project_code: project.project_code ?? null, start_date: project.start_date ?? null, end_date: project.end_date ?? null,
        metadata: { ...metadata, phases, completion: metrics.completion },
    };
}
