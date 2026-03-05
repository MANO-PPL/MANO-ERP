import catchAsync from '../utils/catchAsync.js';
import userService from '../services/userService.js';
import departmentService from '../services/departmentService.js';
import designationService from '../services/designationService.js';
import AppError from '../utils/AppError.js';
import S3Service from '../services/s3Service.js';
import ExcelJS from 'exceljs';
import { PassThrough } from 'stream';

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

export const createUser = catchAsync(async (req, res) => {
    const newUserId = await userService.createUser(req.user, req.body);
    res.status(201).json({ success: true, message: 'User created', user_id: newUserId });
});

export const updateUser = catchAsync(async (req, res) => {
    const { user_id } = req.params;
    if (!user_id || isNaN(parseInt(user_id))) {
        throw new AppError('Invalid User ID', 400);
    }

    const updatePayload = { ...req.body };

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
    createDepartment,
    createDesignation,
    createUser,
    updateUser,
    deleteUser,
    bulkValidate,
    bulkUpload,
    bulkJson
};
