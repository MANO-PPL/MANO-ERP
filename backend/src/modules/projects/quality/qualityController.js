import catchAsync from '../../../utils/catchAsync.js';
import AppError from '../../../utils/AppError.js';
import qualityService from './qualityService.js';

// Helper to extract project ID from route params
const getProjectId = (req) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) {
        throw new AppError('Invalid Project ID', 400);
    }
    return parseInt(id);
};

// Helper to extract observation ID from route params
const getObsId = (req) => {
    const { obsId } = req.params;
    if (!obsId || isNaN(parseInt(obsId))) {
        throw new AppError('Invalid Observation ID', 400);
    }
    return parseInt(obsId);
};

export const listObservations = catchAsync(async (req, res) => {
    const projectId = getProjectId(req);
    const observations = await qualityService.getObservations(projectId);
    res.json({
        success: true,
        observations
    });
});

const parseLabels = (body) => {
    if (!body) return [];
    if (body.labels) {
        if (Array.isArray(body.labels)) return body.labels;
        try {
            const parsed = JSON.parse(body.labels);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) {
            return [body.labels];
        }
    }
    const extracted = [];
    Object.keys(body).forEach(key => {
        if (key.startsWith('label_') || key.startsWith('photo_label_')) {
            extracted.push(body[key]);
        }
    });
    return extracted;
};

export const createObservation = catchAsync(async (req, res) => {
    const projectId = getProjectId(req);
    const { location, note } = req.body;
    const files = req.files || (req.file ? [req.file] : []);
    const labels = parseLabels(req.body);

    const result = await qualityService.createObservation(projectId, {
        location,
        note,
        files,
        labels,
        userId: req.user.id
    });

    res.status(201).json({
        success: true,
        message: 'Observation created successfully',
        ...result
    });
});

export const updateObservation = catchAsync(async (req, res) => {
    const projectId = getProjectId(req);
    const obsId = getObsId(req);
    const { location, note, clearPhotos, clearPhoto } = req.body;
    const files = req.files || (req.file ? [req.file] : []);
    const labels = parseLabels(req.body);

    const result = await qualityService.updateObservation(projectId, obsId, {
        location,
        note,
        files,
        labels,
        clearPhotos: clearPhotos || clearPhoto
    }, req.user.id);

    res.json({
        success: true,
        message: 'Observation updated successfully',
        ...result
    });
});

export const submitFix = catchAsync(async (req, res) => {
    const projectId = getProjectId(req);
    const obsId = getObsId(req);
    const { note } = req.body;
    const files = req.files || (req.file ? [req.file] : []);
    const labels = parseLabels(req.body);

    const result = await qualityService.submitFix(projectId, obsId, {
        note,
        files,
        labels
    }, req.user.id);

    res.json({
        success: true,
        message: 'Rectification evidence submitted successfully',
        ...result
    });
});

export const approveFix = catchAsync(async (req, res) => {
    const projectId = getProjectId(req);
    const obsId = getObsId(req);

    const result = await qualityService.approveFix(projectId, obsId, req.user.id);

    res.json({
        success: true,
        message: 'Observation approved successfully',
        ...result
    });
});

export const deleteObservation = catchAsync(async (req, res) => {
    const projectId = getProjectId(req);
    const obsId = getObsId(req);

    const result = await qualityService.deleteObservation(projectId, obsId);

    res.json({
        success: true,
        message: 'Observation deleted successfully',
        ...result
    });
});

export const listMethodologies = catchAsync(async (req, res) => {
    const projectId = getProjectId(req);
    const methodologies = await qualityService.getMethodologies(projectId);
    res.json({
        success: true,
        methodologies
    });
});

export const createMethodology = catchAsync(async (req, res) => {
    const projectId = getProjectId(req);
    const { title } = req.body;
    const file = req.file;

    const result = await qualityService.createMethodology(projectId, {
        title,
        file,
        userId: req.user.id
    });

    res.status(201).json({
        success: true,
        message: 'Methodology document uploaded successfully',
        methodology: result
    });
});

export const deleteMethodology = catchAsync(async (req, res) => {
    const projectId = getProjectId(req);
    const { docId } = req.params;
    if (!docId || isNaN(parseInt(docId))) {
        throw new AppError('Invalid Document ID', 400);
    }

    const result = await qualityService.deleteMethodology(projectId, parseInt(docId));

    res.json({
        success: true,
        message: 'Methodology document deleted successfully',
        ...result
    });
});

export const listChecklists = catchAsync(async (req, res) => {
    const projectId = getProjectId(req);
    const checklists = await qualityService.getChecklists(projectId);
    res.json({
        success: true,
        checklists
    });
});

export const createChecklist = catchAsync(async (req, res) => {
    const projectId = getProjectId(req);
    const { title } = req.body;
    const file = req.file;

    const result = await qualityService.createChecklist(projectId, {
        title,
        file,
        userId: req.user.id
    });

    res.status(201).json({
        success: true,
        message: 'Checklist document uploaded successfully',
        checklist: result
    });
});

export const deleteChecklist = catchAsync(async (req, res) => {
    const projectId = getProjectId(req);
    const { docId } = req.params;
    if (!docId || isNaN(parseInt(docId))) {
        throw new AppError('Invalid Document ID', 400);
    }

    const result = await qualityService.deleteChecklist(projectId, parseInt(docId));

    res.json({
        success: true,
        message: 'Checklist document deleted successfully',
        ...result
    });
});

export default {
    listObservations,
    createObservation,
    updateObservation,
    submitFix,
    approveFix,
    deleteObservation,
    listMethodologies,
    createMethodology,
    deleteMethodology,
    listChecklists,
    createChecklist,
    deleteChecklist
};


