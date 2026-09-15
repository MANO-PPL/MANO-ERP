export const QUALITY_VIEWS = Object.freeze(['hub', 'control', 'methodology', 'matrix', 'assurance-plan', 'check-snag']);
export const QUALITY_STATUSES = Object.freeze(['ALL', 'PENDING', 'FIXED', 'APPROVED']);

export const resolveQualityView = (value) => QUALITY_VIEWS.includes(value) ? value : 'hub';

export const isAccessDenied = (error) => Number(error?.response?.status || error?.status) === 403;

// Requests are deliberately scoped to their project and workspace.  A late response
// can therefore never update the replacement project after route navigation.
export const createQualityRequestGuard = () => {
    let generation = 0;
    return {
        begin(projectId, workspace) { generation += 1; return { generation, projectId: String(projectId), workspace }; },
        isCurrent(token, projectId, workspace) {
            return token?.generation === generation && token.projectId === String(projectId) && token.workspace === workspace;
        },
        invalidate() { generation += 1; },
    };
};

export const observationFormData = ({ location, note, photos = [], clearPhotos = false, mode = 'create' }) => {
    const data = new FormData();
    if (mode === 'fix') data.append('note', note?.trim() || '');
    else {
        data.append('location', location?.trim() || '');
        data.append('note', note?.trim() || '');
        if (clearPhotos) data.append('clearPhotos', 'true');
    }
    photos.forEach(({ file, label }, index) => {
        if (file) { data.append('photos', file); data.append('labels', label || `Photo ${index + 1}`); }
    });
    return data;
};

// Existing server photos are not re-posted by the desktop workflow.  They stay
// intact unless the user deliberately removes every existing defect photo.
export const observationPhotoState = (item) => {
    const source = item || {};
    const photos = Array.isArray(source.before_photos) ? source.before_photos : [];
    const fallback = source.before_photo_url ? [source.before_photo_url] : [];
    return [...new Set([...photos, ...fallback].filter(Boolean))];
};

// The current ERP only accepts a clear-all marker; it has no per-photo removal
// payload.  The desktop drawer therefore clears only when its original photo
// collection has been reduced to nothing.
export const shouldClearObservationPhotos = ({ mode = 'create', existingPhotos = [], retainedExistingPhotos = existingPhotos, keepExisting = true }) => (
    mode === 'edit' && existingPhotos.length > 0 && (!keepExisting || retainedExistingPhotos.length === 0)
);

export const documentPreviewUrl = (doc, kind) => {
    const url = doc?.file_url;
    if (!url) return null;
    const type = String(doc.file_type || '').toLowerCase();
    if (['heic', 'heif'].includes(type)) return url;
    if (['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'].includes(type)) return url;
    if (['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'].includes(type)) {
        if (kind === 'checklist' && ['pptx', 'ppt'].includes(type)) return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}`;
        return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    }
    return url;
};
