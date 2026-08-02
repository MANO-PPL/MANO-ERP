import catchAsync from '../../utils/catchAsync.js';
import userService from './userService.js';
import departmentService from './departmentService.js';
import designationService from './designationService.js';
import sectorService from '../shared/sectorService.js';
import jobNatureService from '../shared/jobNatureService.js';
import AppError from '../../utils/AppError.js';
import S3Service from '../shared/s3Service.js';
import ExcelJS from 'exceljs';
import { PassThrough } from 'stream';
import { db } from '../../config/database.js';


export const listUsers = catchAsync(async (req, res) => {
    const users = await userService.getUsersByOrg(req.user.org_id);
    res.json({ success: true, users });
});

export const getUser = catchAsync(async (req, res) => {
    const user = await userService.getUserById(req.user.org_id, req.params.user_id);
    res.json({ success: true, user });
});

export const listDepartments = catchAsync(async (req, res) => {
    const data = await departmentService.getDepartments(req.user.org_id);
    res.json({ success: true, departments: data });
});

export const listDesignations = catchAsync(async (req, res) => {
    const data = await designationService.getDesignations(req.user.org_id);
    res.json({ success: true, designations: data });
});

export const createDepartment = catchAsync(async (req, res) => {
    const newId = await departmentService.createDepartment(req.user.org_id, req.body.dept_name);
    res.status(201).json({ success: true, message: 'Department created', dept_id: newId });
});

export const createDesignation = catchAsync(async (req, res) => {
    const newId = await designationService.createDesignation(req.user.org_id, req.body.desg_name);
    res.status(201).json({ success: true, message: 'Designation created', desg_id: newId });
});

// Sectors
export const listSectors = catchAsync(async (req, res) => {
    const data = await sectorService.getSectors(req.user.org_id);
    res.json({ success: true, sectors: data });
});

export const createSector = catchAsync(async (req, res) => {
    const newId = await sectorService.createSector(req.user.org_id, req.body.sector_name);
    res.status(201).json({ success: true, message: 'Sector created', sector_id: newId });
});

// Job Natures
export const listJobNatures = catchAsync(async (req, res) => {
    const data = await jobNatureService.getJobNatures(req.user.org_id);
    res.json({ success: true, job_natures: data });
});

export const createJobNature = catchAsync(async (req, res) => {
    const newId = await jobNatureService.createJobNature(req.user.org_id, req.body.job_name);
    res.status(201).json({ success: true, message: 'Job Nature created', job_id: newId });
});

export const deleteSector = catchAsync(async (req, res) => {
    const { id } = req.params;
    await sectorService.deleteSector(req.user.org_id, id);
    res.json({ success: true, message: 'Sector deleted successfully' });
});

export const deleteJobNature = catchAsync(async (req, res) => {
    const { id } = req.params;
    await jobNatureService.deleteJobNature(req.user.org_id, id);
    res.json({ success: true, message: 'Job Nature deleted successfully' });
});

export const deleteDepartment = catchAsync(async (req, res) => {
    const { id } = req.params;
    await departmentService.deleteDepartment(req.user.org_id, id);
    res.json({ success: true, message: 'Department deleted successfully' });
});

export const deleteDesignation = catchAsync(async (req, res) => {
    const { id } = req.params;
    await designationService.deleteDesignation(req.user.org_id, id);
    res.json({ success: true, message: 'Designation deleted successfully' });
});

export const createUser = catchAsync(async (req, res) => {
    const { project_ids, project_permissions, ...userData } = req.body;
    const newUserId = await userService.createUser(req.user.org_id, userData);

    if (project_ids && Array.isArray(project_ids) && project_ids.length > 0) {
        const permsObj = project_permissions ? (typeof project_permissions === 'string' ? JSON.parse(project_permissions) : project_permissions) : {};
        const inserts = project_ids.map(pid => ({
            project_id: pid,
            user_id: newUserId,
            org_id: req.user.org_id,
            project_permissions: JSON.stringify(permsObj)
        }));
        await db('proj_members').insert(inserts);
    }

    res.status(201).json({ success: true, message: 'User created', user_id: newUserId });
});

export const updateUser = catchAsync(async (req, res) => {
    const { user_id } = req.params;
    if (!user_id || isNaN(parseInt(user_id))) {
        throw new AppError('Invalid User ID', 400);
    }

    const { project_ids, project_permissions, ...userData } = req.body;
    const updatePayload = { ...userData };

    // Handle profile image if uploaded (req.file.buffer)
    if (req.file && req.file.buffer) {
        const fileBuffer = req.file.buffer;
        const ext = (req.file.originalname && req.file.originalname.split('.').pop()) || 'jpg';
        const fileName = `profile_${user_id}_${Date.now()}.${ext}`;
        const contentType = req.file.mimetype || 'application/octet-stream';
        const url = await S3Service.uploadFile(fileBuffer, fileName, `profiles/${user_id}`, contentType);
        updatePayload.profile_image_url = url;
    }

    await userService.updateUser(req.user.org_id, user_id, updatePayload);

    if (project_ids !== undefined && Array.isArray(project_ids)) {
        const permsObj = project_permissions ? (typeof project_permissions === 'string' ? JSON.parse(project_permissions) : project_permissions) : {};
        const permsJson = JSON.stringify(permsObj);

        // Sync proj_members table
        const existing = await db('proj_members')
            .where({ user_id: user_id, org_id: req.user.org_id })
            .select('project_id');
        const existingIds = existing.map(e => e.project_id);

        const toAdd = project_ids.filter(id => !existingIds.includes(id));
        const toRemove = existingIds.filter(id => !project_ids.includes(id));
        const toKeep = existingIds.filter(id => project_ids.includes(id));

        if (toRemove.length > 0) {
            await db('proj_members')
                .where({ user_id: user_id, org_id: req.user.org_id })
                .whereIn('project_id', toRemove)
                .del();
        }

        if (toAdd.length > 0) {
            const inserts = toAdd.map(pid => ({
                project_id: pid,
                user_id: user_id,
                org_id: req.user.org_id,
                project_permissions: permsJson
            }));
            await db('proj_members').insert(inserts);
        }

        if (toKeep.length > 0) {
            await db('proj_members')
                .where({ user_id: user_id, org_id: req.user.org_id })
                .whereIn('project_id', toKeep)
                .update({ project_permissions: permsJson });
        }
    }

    res.json({ success: true, message: 'User updated successfully' });
});

export const deleteUser = catchAsync(async (req, res) => {
    const { user_id } = req.params;
    if (!user_id || isNaN(parseInt(user_id))) throw new AppError('Invalid User ID', 400);
    if (parseInt(user_id) === req.user.user_id) throw new AppError('You cannot delete your own account', 400);

    await userService.forceDelete(req.user.org_id, user_id);

    res.json({ success: true, message: 'User deleted successfully' });
});

export const bulkValidate = catchAsync(async (req, res) => {
    const { users } = req.body;
    if (!users || !Array.isArray(users)) throw new AppError('Invalid users list', 400);

    const response = await userService.bulkValidateUsers(req.user.org_id, users);
    res.json({ success: true, validation: response });
});

export const bulkUpload = catchAsync(async (req, res) => {
    if (!req.file) throw new AppError('Please upload a CSV or Excel file', 400);

    const workbook = new ExcelJS.Workbook();
    const buffer = req.file.buffer;
    const mimeType = req.file.mimetype;
    const originalName = (req.file.originalname || '').toLowerCase();

    if (mimeType.includes('csv') || originalName.endsWith('.csv')) {
        const bufferStream = new PassThrough();
        bufferStream.end(buffer);
        await workbook.csv.read(bufferStream);
    } else {
        await workbook.xlsx.load(buffer);
    }

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) throw new AppError('Invalid or empty file', 400);

    const headerMap = {};
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
        const val = cell.value ? cell.value.toString().toLowerCase().trim() : '';
        headerMap[val] = colNumber;
    });

    const getVal = (row, key) => {
        const col = headerMap[key];
        if (!col) return null;
        const cell = row.getCell(col);
        return cell.value ? cell.value.toString().trim() : null;
    };

    const rowsData = [];
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip headers

        const record = {};
        for (const [key, colNum] of Object.entries(headerMap)) {
            const cell = row.getCell(colNum);
            record[key] = cell.value ? cell.value.toString().trim() : null;
        }

        rowsData.push(record);
    });

    const results = await userService.bulkInsertUsers(req.user.org_id, rowsData);

    res.json({ success: true, report: results });
});

export const bulkJson = catchAsync(async (req, res) => {
    const { users } = req.body;
    if (!users || !Array.isArray(users) || users.length === 0) throw new AppError('Invalid data provided', 400);

    const results = await userService.bulkInsertUsers(req.user.org_id, users);

    res.json({ ok: true, report: results });
});

export default {
    listUsers,
    getUser,
    listDepartments,
    listDesignations,
    listSectors,
    listJobNatures,
    createDepartment,
    createDesignation,
    createSector,
    createJobNature,
    deleteSector,
    deleteJobNature,
    deleteDepartment,
    deleteDesignation,
    createUser,
    updateUser,
    deleteUser,
    bulkValidate,
    bulkUpload,
    bulkJson
};
