import catchAsync from '../../../utils/catchAsync.js';
import AppError from '../../../utils/AppError.js';
import agendaService from './agendaService.js';
import { db } from '../../../config/database.js';

/* -------------------------------------------------------
   1. LIST AGENDAS — GET /:id/agendas
-------------------------------------------------------- */
export const listAgendas = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) throw new AppError('Invalid project_id', 400);

    const result = await agendaService.fetchProjectAgendas(projectId);
    res.json({ success: true, ...result });
});

/* -------------------------------------------------------
   2. DETAIL AGENDA — GET /:id/agendas/:agenda_id
-------------------------------------------------------- */
export const getAgenda = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    const agendaId = parseInt(req.params.agenda_id, 10);
    
    if (isNaN(projectId) || isNaN(agendaId)) {
        throw new AppError('Invalid project_id or agenda_id', 400);
    }

    const agenda = await agendaService.fetchAgendaById(projectId, agendaId);
    res.json({ success: true, agenda });
});

/* -------------------------------------------------------
   3. CREATE AGENDA — POST /:id/agendas
-------------------------------------------------------- */
export const createAgenda = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) throw new AppError('project_id must be a number', 400);

    // Validate required fields
    const { subject, venue, date, meeting_no } = req.body;
    if (!subject || !venue || !date || !meeting_no) {
        throw new AppError('subject, venue, date, and meeting_no are required', 400);
    }

    // Ensure project exists
    const project = await db('projects').where('id', projectId).first();
    if (!project) throw new AppError('Project not found', 404);

    const result = await agendaService.createAgenda(projectId, req.body);
    
    res.status(201).json({ 
        success: true, 
        message: 'Agenda created successfully', 
        agenda_id: result.agenda_id 
    });
});

/* -------------------------------------------------------
   4. UPDATE AGENDA — PUT /:id/agendas/:agenda_id
-------------------------------------------------------- */
export const updateAgenda = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    const agendaId = parseInt(req.params.agenda_id, 10);
    
    if (isNaN(projectId) || isNaN(agendaId)) {
        throw new AppError('project_id and agenda_id are required and must be numbers', 400);
    }

    if (Object.keys(req.body).length === 0) {
        throw new AppError('No data provided to update', 400);
    }

    await agendaService.updateAgenda(projectId, agendaId, req.body);
    
    res.json({ 
        success: true, 
        message: 'Agenda updated successfully'
    });
});

/* -------------------------------------------------------
   5. DELETE AGENDA — DELETE /:id/agendas/:agenda_id
-------------------------------------------------------- */
export const deleteAgenda = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    const agendaId = parseInt(req.params.agenda_id, 10);
    
    if (isNaN(projectId) || isNaN(agendaId)) {
        throw new AppError('project_id and agenda_id are required and must be numbers', 400);
    }

    await agendaService.deleteAgenda(projectId, agendaId);
    
    res.json({ 
        success: true, 
        message: 'Agenda deleted successfully'
    });
});

export default {
    listAgendas,
    getAgenda,
    createAgenda,
    updateAgenda,
    deleteAgenda
};
