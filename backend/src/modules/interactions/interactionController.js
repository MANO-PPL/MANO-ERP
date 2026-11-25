import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';
import interactionService from './interactionService.js';

const parsePositiveId = (value, field) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
        throw new AppError(`${field} must be a positive integer`, 400);
    }
    return id;
};

export const listInteractions = catchAsync(async (req, res) => {
    const query = { ...req.query };
    if (req.params.id) query.contact_id = parsePositiveId(req.params.id, 'Party ID');
    const result = await interactionService.listInteractions(req.user.org_id, query);
    res.json({ success: true, ...result });
});

export const addInteraction = catchAsync(async (req, res) => {
    const contactId = parsePositiveId(req.params.id || req.body.contact_id, 'Party ID');
    const newId = await interactionService.createInteraction(req.user.org_id, {
        ...req.body,
        contact_id: contactId,
        interacted_by: req.user?.id
    });
    res.status(201).json({ success: true, message: 'Interaction added successfully', id: newId });
});

export const deleteInteraction = catchAsync(async (req, res) => {
    const contactId = parsePositiveId(req.params.id || req.query.contact_id, 'Party ID');
    const interactionId = parsePositiveId(req.params.interactionId, 'Interaction ID');
    await interactionService.deleteInteraction(req.user.org_id, contactId, interactionId);
    res.json({ success: true, message: 'Interaction deleted successfully' });
});

export default {
    listInteractions,
    addInteraction,
    deleteInteraction
};
