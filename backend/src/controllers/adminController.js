import catchAsync from '../utils/catchAsync.js';
import userService from '../services/userService.js';
import AppError from '../utils/AppError.js';
import { db} from '../config/database.js';
import bcrypt from 'bcrypt';
import EventBus from '../utils/EventBus.js';
import { getEventSource } from '../utils/clientInfo.js';
import S3Service from '../services/s3Service.js';
import ExcelJS from 'exceljs';
import { PassThrough } from 'stream';

export const listUsers = catchAsync(async (req, res) => {
    if (req.user.user_type !== 'admin' && req.user.user_type !== 'hr') {
        throw new AppError('Only admin and HR can access user Data', 403);
    }
    const users = await userService.getUsersByOrg(req.user.org_id);
    res.json({ success: true, users });
});

export const getUser = catchAsync(async (req, res) => {
    if (req.user.user_type !== 'admin' && req.user.user_type !== 'hr') {
        throw new AppError('Only admin and HR can access user Data', 403);
    }
    const user = await userService.getUserById(req.user.org_id, req.params.user_id);
    res.json({ success: true, user });
});

export const listDepartments = catchAsync(async (req, res) => {
    const data = await userService.getDepartments(req.user.org_id);
    res.json({ success: true, departments: data });
});

export const listDesignations = catchAsync(async (req, res) => {
    const data = await userService.getDesignations(req.user.org_id);
    res.json({ success: true, designations: data });
});

export const createDepartment = catchAsync(async (req, res) => {
    if (req.user.user_type !== 'admin' && req.user.user_type !== 'hr') {
        throw new AppError('Only admin and HR can create departments', 403);
    }
    const newId = await userService.createDepartment(req.user.org_id, req.body.dept_name);
    res.status(201).json({ success: true, message: 'Department created', dept_id: newId });
});

export const createDesignation = catchAsync(async (req, res) => {
    if (req.user.user_type !== 'admin' && req.user.user_type !== 'hr') {
        throw new AppError('Only admin and HR can create designations', 403);
    }
    const newId = await userService.createDesignation(req.user.org_id, req.body.desg_name);
    res.status(201).json({ success: true, message: 'Designation created', desg_id: newId });
});

export const createUser = catchAsync(async (req, res) => {
    if (req.user.user_type !== 'admin' && req.user.user_type !== 'hr') {
        throw new AppError('Only admin and HR can create users', 403);
    }
    const newUserId = await userService.createUser(req.user, req.body);
    res.status(201).json({ success: true, message: 'User created', user_id: newUserId });
});

export const updateUser = catchAsync(async (req, res) => {
    if (req.user.user_type !== 'admin' && req.user.user_type !== 'hr') {
        throw new AppError('Only admin and HR can update user data', 403);
    }

    const { user_id } = req.params;
    if (!user_id || isNaN(parseInt(user_id))) {
        throw new AppError('Invalid User ID', 400);
    }

    const ALLOWED_UPDATE_FIELDS = new Set([
        'user_name', 'user_password', 'email', 'phone_no', 'desg_id', 'dept_id', 'user_type'
    ]);

    const updates = {};

    // Check duplicates
    if (req.body.email) {
        const existing = await db('users')
            .where({ email: req.body.email })
            .andWhereNot({ user_id })
            .first();
        if (existing) throw new AppError('Email is already taken', 400);
    }

    if (req.body.phone_no && req.body.phone_no.trim() !== '') {
        const existing = await db('users')
            .where({ phone_no: req.body.phone_no.trim() })
            .andWhereNot({ user_id })
            .first();
        if (existing) throw new AppError('Mobile number is already taken', 400);
    }

    for (const key of Object.keys(req.body)) {
        if (ALLOWED_UPDATE_FIELDS.has(key)) {
            if (key === 'user_password') {
                if (req.body.user_password && req.body.user_password.trim() !== '') {
                    updates.user_password = await bcrypt.hash(req.body.user_password, 12);
                }
            } else if (key === 'phone_no') {
                if (req.body.phone_no && req.body.phone_no.trim() !== '') {
                    updates.phone_no = req.body.phone_no.trim();
                } else {
                    updates.phone_no = null;
                }
            } else {
                if (['desg_id', 'dept_id'].includes(key) && req.body[key] === '') {
                    updates[key] = null;
                } else {
                    updates[key] = req.body[key];
                }
            }
        }
    }

    // Handle profile image if uploaded (req.file.buffer)
    if (req.file && req.file.buffer) {
        const fileBuffer = req.file.buffer;
        const ext = (req.file.originalname && req.file.originalname.split('.').pop()) || 'jpg';
        const fileName = `profile_${user_id}_${Date.now()}.${ext}`;
        const key = `profiles/${user_id}/${fileName}`;
        const contentType = req.file.mimetype || 'application/octet-stream';
        const url = await S3Service.uploadFile(fileBuffer, fileName, `profiles/${user_id}`, contentType);
        updates.profile_image_url = url;
    }

    await db.transaction(async (trx) => {
        if (Object.keys(updates).length > 0) {
            const affected = await trx('users')
                .where('user_id', user_id)
                .andWhere('org_id', req.user.org_id)
                .update(updates);

            if (affected === 0) throw new AppError('User not found or unauthorized', 404);
        }
    });

    res.json({ success: true, message: 'User updated successfully' });
});

export const deleteUser = catchAsync(async (req, res) => {
    if (req.user.user_type !== 'admin' && req.user.user_type !== 'hr') {
        throw new AppError('Only admin and HR can delete users', 403);
    }

    const { user_id } = req.params;
    if (!user_id || isNaN(parseInt(user_id))) throw new AppError('Invalid User ID', 400);
    if (parseInt(user_id) === req.user.user_id) throw new AppError('You cannot delete your own account', 400);

    const affected = await db('users')
        .where('user_id', user_id)
        .andWhere('org_id', req.user.org_id)
        .del();

    if (affected === 0) throw new AppError('User not found', 404);
    res.json({ success: true, message: 'User deleted successfully' });
});

export const bulkValidate = catchAsync(async (req, res) => {
    if (req.user.user_type !== 'admin' && req.user.user_type !== 'hr') throw new AppError('Only admin and HR can perform bulk operations', 403);

    const { users } = req.body;
    if (!users || !Array.isArray(users)) throw new AppError('Invalid users list', 400);

    const response = { duplicates: [], new_departments: [], new_designations: [], valid_count: 0 };

    const inputEmails = new Set();
    const inputPhones = new Set();
    const inputDepts = new Set();
    const inputDesgs = new Set();

    users.forEach((u) => {
        const email = u['Email'] || u['email'];
        const phone = u['Phone'] || u['phone'] || u['phone_no'];
        const dept = u['Department'] || u['department'] || u['dept'];
        const desg = u['Designation'] || u['designation'] || u['role'] || u['Role'];
        if (email) inputEmails.add(email);
        if (phone) inputPhones.add(phone.toString().trim());
        if (dept) inputDepts.add(dept.toLowerCase());
        if (desg) inputDesgs.add(desg.toLowerCase());
    });

    if (inputEmails.size > 0) {
        const existingUsers = await db('users').whereIn('email', Array.from(inputEmails)).select('email', 'user_id');
        const existingEmailSet = new Set(existingUsers.map(u => u.email));

        let existingPhoneSet = new Set();
        if (inputPhones.size > 0) {
            const existingPhones = await db('users').whereIn('phone_no', Array.from(inputPhones)).select('phone_no');
            existingPhoneSet = new Set(existingPhones.map(u => u.phone_no));
        }

        users.forEach((u, index) => {
            const rowNum = index + 1;
            const email = u['Email'] || u['email'];
            const phone = u['Phone'] || u['phone'] || u['phone_no'];
            let isDuplicate = false;
            if (email && existingEmailSet.has(email)) {
                response.duplicates.push({ row: rowNum, email, reason: 'Email already exists' });
                isDuplicate = true;
            }
            if (phone && existingPhoneSet.has(phone.toString().trim())) {
                response.duplicates.push({ row: rowNum, phone, reason: 'Phone number already exists' });
                isDuplicate = true;
            }
            if (!isDuplicate) response.valid_count++;
        });
    } else {
        response.valid_count = users.length;
    }

    // Departments
    if (inputDepts.size > 0) {
        const existingDepts = await db('departments').where('org_id', req.user.org_id).whereIn(db.raw('LOWER(dept_name)'), Array.from(inputDepts)).select('dept_name');
        const existingDeptSet = new Set(existingDepts.map(d => d.dept_name.toLowerCase()));
        inputDepts.forEach(d => { if (!existingDeptSet.has(d)) response.new_departments.push(d); });
    }

    // Designations
    if (inputDesgs.size > 0) {
        const existingDesgs = await db('designations').where('org_id', req.user.org_id).whereIn(db.raw('LOWER(desg_name)'), Array.from(inputDesgs)).select('desg_name');
        const existingDesgSet = new Set(existingDesgs.map(d => d.desg_name.toLowerCase()));
        inputDesgs.forEach(d => { if (!existingDesgSet.has(d)) response.new_designations.push(d); });
    }

    res.json({ success: true, validation: response });
});

export const bulkUpload = catchAsync(async (req, res) => {
    if (req.user.user_type !== 'admin' && req.user.user_type !== 'hr') throw new AppError('Only admin and HR can perform bulk operations', 403);
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
    worksheet.eachRow((row, rowNumber) => { if (rowNumber === 1) return; rowsData.push({ row, rowNumber }); });

    const results = { total_processed: 0, success_count: 0, failure_count: 0, errors: [] };

    await db.transaction(async (trx) => {
        const org = await trx('organizations').where({ org_id: req.user.org_id }).forUpdate().first();
        if (!org) throw new AppError('Organization not found', 404);

        let nextUserNumber = org.last_user_number;

        // Collect unique departments/designations
        const uniqueDepts = new Set();
        const uniqueDesgs = new Set();
        for (const { row } of rowsData) {
            const dept = getVal(row, 'department') || getVal(row, 'dept');
            const desg = getVal(row, 'designation') || getVal(row, 'role');
            if (dept) uniqueDepts.add(dept);
            if (desg) uniqueDesgs.add(desg);
        }

        const deptMap = {};
        const desgMap = {};

        for (const deptName of uniqueDepts) {
            let dept = await trx('departments').where({ dept_name: deptName, org_id: req.user.org_id }).first();
            if (!dept) {
                const [newId] = await trx('departments').insert({ dept_name: deptName, org_id: req.user.org_id });
                deptMap[deptName.toLowerCase()] = newId;
            } else {
                deptMap[deptName.toLowerCase()] = dept.dept_id;
            }
        }

        for (const desgName of uniqueDesgs) {
            let desg = await trx('designations').where({ desg_name: desgName, org_id: req.user.org_id }).first();
            if (!desg) {
                const [newId] = await trx('designations').insert({ desg_name: desgName, org_id: req.user.org_id });
                desgMap[desgName.toLowerCase()] = newId;
            } else {
                desgMap[desgName.toLowerCase()] = desg.desg_id;
            }
        }

        for (const { row, rowNumber } of rowsData) {
            results.total_processed++;
            const name = getVal(row, 'name') || getVal(row, 'user_name');
            const email = getVal(row, 'email');
            const phone = getVal(row, 'phone') || getVal(row, 'phone_no');
            const deptName = getVal(row, 'department') || getVal(row, 'dept');
            const desgName = getVal(row, 'designation') || getVal(row, 'role');
            const password = getVal(row, 'password') || `${name}-${req.user.org_id}`;
            const type = getVal(row, 'type') || 'employee';

            if (!name || !email) { results.failure_count++; results.errors.push(`Row ${rowNumber}: Missing Name or Email`); continue; }

            const existing = await trx('users').where({ email }).orWhere({ phone_no: phone }).first();
            if (existing) { results.failure_count++; results.errors.push(`Row ${rowNumber}: Duplicate Email/Phone`); continue; }

            const hashedPassword = await bcrypt.hash(password, 10);
            const deptId = deptName ? deptMap[deptName.toLowerCase()] : null;
            const desgId = desgName ? desgMap[desgName.toLowerCase()] : null;

            nextUserNumber++;
            const userCode = `${org.org_code || org.org_name}-${String(nextUserNumber).padStart(3, '0')}`;

            await trx('users').insert({ org_id: req.user.org_id, user_name: name, user_code: userCode, email, phone_no: phone || '', user_password: hashedPassword, user_type: type, dept_id: deptId, desg_id: desgId });
            results.success_count++;
        }

        await trx('organizations').where({ org_id: req.user.org_id }).update({ last_user_number: nextUserNumber });
    });

    res.json({ success: true, report: results });
});

export const bulkJson = catchAsync(async (req, res) => {
    if (req.user.user_type !== 'admin') throw new AppError('Only admin can perform bulk operations', 403);
    const { users } = req.body;
    if (!users || !Array.isArray(users) || users.length === 0) throw new AppError('Invalid data provided', 400);

    const results = { total_processed: 0, success_count: 0, failure_count: 0, errors: [] };

    await db.transaction(async (trx) => {
        const uniqueDepts = new Set();
        const uniqueDesgs = new Set();
        for (const row of users) {
            const dept = row['Department'] || row['department'] || row['dept'];
            const desg = row['Designation'] || row['designation'] || row['role'] || row['Role'];
            if (dept) uniqueDepts.add(dept);
            if (desg) uniqueDesgs.add(desg);
        }

        const deptMap = {};
        const desgMap = {};
        for (const deptName of uniqueDepts) {
            if (!deptName) continue;
            let dept = await trx('departments').where({ dept_name: deptName, org_id: req.user.org_id }).first();
            if (!dept) { const [newId] = await trx('departments').insert({ dept_name: deptName, org_id: req.user.org_id }); deptMap[deptName.toLowerCase()] = newId; } else { deptMap[deptName.toLowerCase()] = dept.dept_id; }
        }
        for (const desgName of uniqueDesgs) {
            if (!desgName) continue;
            let desg = await trx('designations').where({ desg_name: desgName, org_id: req.user.org_id }).first();
            if (!desg) { const [newId] = await trx('designations').insert({ desg_name: desgName, org_id: req.user.org_id }); desgMap[desgName.toLowerCase()] = newId; } else { desgMap[desgName.toLowerCase()] = desg.desg_id; }
        }

        const org = await trx('organizations').where({ org_id: req.user.org_id }).forUpdate().first();
        if (!org) throw new AppError('Organization not found', 404);
        let nextUserNumber = org.last_user_number;

        let rowNumber = 0;
        for (const row of users) {
            rowNumber++; results.total_processed++;
            const name = row['Name'] || row['name'] || row['user_name'];
            const email = row['Email'] || row['email'];
            const phoneRaw = row['Phone'] || row['phone'] || row['phone_no'];
            const phone = phoneRaw ? phoneRaw.toString().trim() : null;
            const deptName = row['Department'] || row['department'] || row['dept'];
            const desgName = row['Designation'] || row['designation'] || row['role'] || row['Role'];
            const password = row['Password'] || row['password'] || `${name}-${req.user.org_id}`;
            const type = 'employee';

            if (!name || !email) { results.failure_count++; results.errors.push(`Row ${rowNumber}: Missing Name or Email`); continue; }

            try {
                let duplicateQuery = trx('users').where({ email });
                if (phone) duplicateQuery = duplicateQuery.orWhere({ phone_no: phone });
                const existing = await duplicateQuery.first();
                if (existing) { results.failure_count++; results.errors.push(`Row ${rowNumber}: Duplicate Email/Phone (${email})`); continue; }

                const hashedPassword = await bcrypt.hash(password, 10);
                const deptId = deptName ? deptMap[deptName.toLowerCase()] : null;
                const desgId = desgName ? desgMap[desgName.toLowerCase()] : null;
                nextUserNumber++;
                const userCode = `${org.org_code}-${String(nextUserNumber).padStart(3, '0')}`;
                await trx('users').insert({ org_id: req.user.org_id, user_name: name, user_code: userCode, email, phone_no: phone, user_password: hashedPassword, user_type: type, dept_id: deptId, desg_id: desgId });
                results.success_count++;
            } catch (err) {
                results.failure_count++; results.errors.push(`Row ${rowNumber}: ${err.message}`);
            }
        }

        await trx('organizations').where({ org_id: req.user.org_id }).update({ last_user_number: nextUserNumber });
    });

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
