import bcrypt from 'bcrypt';
import AppError from '../../utils/AppError.js';
import { db } from '../../config/database.js';
import { normalizeUserType } from '../../utils/userUtils.js';

export { normalizeUserType };

export function validateSystemPermissions(permissions) {
    if (!permissions) return null;
    let parsed = permissions;
    if (typeof permissions === 'string') {
        try {
            parsed = JSON.parse(permissions);
        } catch (e) {
            throw new AppError('Invalid system_permissions JSON string format', 400);
        }
    }
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new AppError('system_permissions must be a JSON object', 400);
    }
    const ALLOWED_LEVELS = new Set(['none', 'view', 'edit']);
    const sanitized = {};
    for (const [module, level] of Object.entries(parsed)) {
        if (!level || typeof level !== 'string' || !ALLOWED_LEVELS.has(level.toLowerCase())) {
            throw new AppError(`Invalid permission level '${level}' for module '${module}'. Must be 'none', 'view', or 'edit'.`, 400);
        }
        sanitized[module] = level.toLowerCase();
    }
    return sanitized;
}

// Retrieve all users for an organization
export async function getUsersByOrg(orgId) {
    return await db('iam_users as u')
        .leftJoin('iam_designations as d', 'u.desg_id', 'd.desg_id')
        .leftJoin('iam_departments as dep', 'u.dept_id', 'dep.dept_id')
        .select(
            'u.user_id',
            'u.user_name',
            'u.email',
            'u.phone_no',
            'u.user_type',
            'd.desg_name',
            'd.desg_id',
            'dep.dept_name',
            'dep.dept_id',
            'u.profile_image_url',
            'u.user_code',
            'u.system_permissions',
            'u.created_at',
            'u.updated_at'
        )
        .where('u.org_id', orgId);
}

// Retrieve single user by id within an org
export async function getUserById(orgId, userId) {
    const user = await db('iam_users as u')
        .leftJoin('iam_designations as d', 'u.desg_id', 'd.desg_id')
        .leftJoin('iam_departments as dep', 'u.dept_id', 'dep.dept_id')
        .select(
            'u.user_id',
            'u.user_name',
            'u.email',
            'u.phone_no',
            'u.user_type',
            'u.desg_id',
            'u.dept_id',
            'u.org_id',
            'u.profile_image_url',
            'u.user_code',
            'u.system_permissions',
            'u.created_at',
            'u.updated_at',
            'd.desg_name',
            'dep.dept_name'
        )
        .where('u.user_id', userId)
        .andWhere('u.org_id', orgId)
        .first();

    if (!user) {
        throw new AppError('User not found', 404);
    }

    // Fetch assigned projects
    const projects = await db('proj_members')
        .where({ user_id: userId, org_id: orgId })
        .select('project_id');
    user.assigned_projects = projects.map(p => p.project_id);

    return user;
}

export async function createUser(org_id, userData) {
    const {
        user_name,
        user_password,
        email,
        phone_no,
        desg_id,
        dept_id,
        user_type,
        profile_image_url,
        system_permissions
    } = userData;

    if (!user_name || !user_password || !email) {
        throw new AppError('Missing required fields (Name, Password, Email)', 400);
    }

    const typeToSave = normalizeUserType(user_type);

    const existingEmail = await db('iam_users').where({ email }).first();
    if (existingEmail) throw new AppError('Email is already taken', 400);

    const phoneToSave = phone_no && phone_no.trim() !== '' ? phone_no.trim() : null;
    if (phoneToSave) {
        const existingPhone = await db('iam_users').where({ phone_no: phoneToSave }).first();
        if (existingPhone) throw new AppError('Mobile number is already taken', 400);
    }

    const hashedPassword = await bcrypt.hash(user_password, 12);
    let newUserId;

    await db.transaction(async (trx) => {
        const org = await trx('org_organizations')
            .where({ org_id: org_id })
            .forUpdate()
            .first();

        if (!org) throw new AppError('Organization not found', 404);

        const nextNumber = org.last_user_number + 1;
        const userCode = `${org.org_code}-${String(nextNumber).padStart(3, '0')}`;

        await trx('org_organizations')
            .where({ org_id: org_id })
            .update({ last_user_number: nextNumber });

        const validatedPerms = system_permissions ? validateSystemPermissions(system_permissions) : null;

        const [id] = await trx('iam_users').insert({
            user_name,
            user_password: hashedPassword,
            email,
            phone_no: phoneToSave,
            desg_id,
            dept_id,
            user_type: typeToSave,
            org_id: org_id,
            user_code: userCode,
            profile_image_url,
            system_permissions: validatedPerms ? JSON.stringify(validatedPerms) : null
        });
        newUserId = id;
    });

    return newUserId;
}

export async function setActive(orgId, userId) {
    throw new AppError('status tracking not yet configured in DB', 501);
}

export async function setInactive(orgId, userId) {
    throw new AppError('status tracking not yet configured in DB', 501);
}

export async function markForDelete(orgId, userId) {
    throw new AppError('status tracking not yet configured in DB', 501);
}

export async function forceDelete(orgId, userId) {
    const affected = await db('iam_users')
        .where({ user_id: userId, org_id: orgId })
        .del();
    if (affected === 0) throw new AppError('User not found', 404);
    return true;
}

export async function updateUser(orgId, userId, updateData) {
    const ALLOWED_UPDATE_FIELDS = new Set([
        'user_name', 'user_password', 'email', 'phone_no', 'desg_id', 'dept_id', 'user_type', 'profile_image_url', 'system_permissions'
    ]);

    const updates = {};

    // Check duplicates
    if (updateData.email) {
        const existing = await db('iam_users')
            .where({ email: updateData.email })
            .andWhereNot({ user_id: userId })
            .first();
        if (existing) throw new AppError('Email is already taken', 400);
    }

    if (updateData.phone_no && updateData.phone_no.trim() !== '') {
        const existing = await db('iam_users')
            .where({ phone_no: updateData.phone_no.trim() })
            .andWhereNot({ user_id: userId })
            .first();
        if (existing) throw new AppError('Mobile number is already taken', 400);
    }

    for (const key of Object.keys(updateData)) {
        if (ALLOWED_UPDATE_FIELDS.has(key)) {
            if (key === 'user_password') {
                if (updateData.user_password && updateData.user_password.trim() !== '') {
                    updates.user_password = await bcrypt.hash(updateData.user_password, 12);
                }
            } else if (key === 'phone_no') {
                if (updateData.phone_no && updateData.phone_no.trim() !== '') {
                    updates.phone_no = updateData.phone_no.trim();
                } else {
                    updates.phone_no = null;
                }
            } else if (key === 'user_type') {
                updates.user_type = normalizeUserType(updateData.user_type);
            } else if (key === 'system_permissions') {
                const validatedPerms = updateData.system_permissions ? validateSystemPermissions(updateData.system_permissions) : null;
                updates.system_permissions = validatedPerms ? JSON.stringify(validatedPerms) : null;
            } else {
                if (['desg_id', 'dept_id'].includes(key) && updateData[key] === '') {
                    updates[key] = null;
                } else {
                    updates[key] = updateData[key];
                }
            }
        }
    }

    if (Object.keys(updates).length > 0) {
        const affected = await db('iam_users')
            .where('user_id', userId)
            .andWhere('org_id', orgId)
            .update(updates);

        if (affected === 0) throw new AppError('User not found or unauthorized', 404);
    }

    return true;
}

export async function bulkValidateUsers(orgId, users) {
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
        const existingUsers = await db('iam_users').whereIn('email', Array.from(inputEmails)).select('email', 'user_id');
        const existingEmailSet = new Set(existingUsers.map(u => u.email));

        let existingPhoneSet = new Set();
        if (inputPhones.size > 0) {
            const existingPhones = await db('iam_users').whereIn('phone_no', Array.from(inputPhones)).select('phone_no');
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

    if (inputDepts.size > 0) {
        const existingDepts = await db('iam_departments').where('org_id', orgId).whereIn(db.raw('LOWER(dept_name)'), Array.from(inputDepts)).select('dept_name');
        const existingDeptSet = new Set(existingDepts.map(d => d.dept_name.toLowerCase()));
        inputDepts.forEach(d => { if (!existingDeptSet.has(d)) response.new_departments.push(d); });
    }

    if (inputDesgs.size > 0) {
        const existingDesgs = await db('iam_designations').where('org_id', orgId).whereIn(db.raw('LOWER(desg_name)'), Array.from(inputDesgs)).select('desg_name');
        const existingDesgSet = new Set(existingDesgs.map(d => d.desg_name.toLowerCase()));
        inputDesgs.forEach(d => { if (!existingDesgSet.has(d)) response.new_designations.push(d); });
    }

    return response;
}

export async function bulkInsertUsers(orgId, users) {
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
            let dept = await trx('iam_departments').where({ dept_name: deptName, org_id: orgId }).first();
            if (!dept) {
                const [newId] = await trx('iam_departments').insert({ dept_name: deptName, org_id: orgId });
                deptMap[deptName.toLowerCase()] = newId;
            } else {
                deptMap[deptName.toLowerCase()] = dept.dept_id;
            }
        }
        for (const desgName of uniqueDesgs) {
            if (!desgName) continue;
            let desg = await trx('iam_designations').where({ desg_name: desgName, org_id: orgId }).first();
            if (!desg) {
                const [newId] = await trx('iam_designations').insert({ desg_name: desgName, org_id: orgId });
                desgMap[desgName.toLowerCase()] = newId;
            } else {
                desgMap[desgName.toLowerCase()] = desg.desg_id;
            }
        }

        const org = await trx('org_organizations').where({ org_id: orgId }).forUpdate().first();
        if (!org) throw new AppError('Organization not found', 404);
        let nextUserNumber = org.last_user_number;

        let rowNumber = 0;
        for (const row of users) {
            rowNumber++;
            results.total_processed++;
            const name = row['Name'] || row['name'] || row['user_name'];
            const email = row['Email'] || row['email'];
            const phoneRaw = row['Phone'] || row['phone'] || row['phone_no'];
            const phone = phoneRaw ? phoneRaw.toString().trim() : null;
            const deptName = row['Department'] || row['department'] || row['dept'];
            const desgName = row['Designation'] || row['designation'] || row['role'] || row['Role'];
            const password = row['Password'] || row['password'] || `${name}-${orgId}`;
            const type = 'employee';

            if (!name || !email) { results.failure_count++; results.errors.push(`Row ${rowNumber}: Missing Name or Email`); continue; }

            try {
                let duplicateQuery = trx('iam_users').where({ email });
                if (phone) duplicateQuery = duplicateQuery.orWhere({ phone_no: phone });
                const existing = await duplicateQuery.first();
                if (existing) { results.failure_count++; results.errors.push(`Row ${rowNumber}: Duplicate Email/Phone (${email})`); continue; }

                const hashedPassword = await bcrypt.hash(password, 10);
                const deptId = deptName ? deptMap[deptName.toLowerCase()] : null;
                const desgId = desgName ? desgMap[desgName.toLowerCase()] : null;
                nextUserNumber++;
                const userCode = `${org.org_code}-${String(nextUserNumber).padStart(3, '0')}`;
                await trx('iam_users').insert({
                    org_id: orgId,
                    user_name: name,
                    user_code: userCode,
                    email,
                    phone_no: phone,
                    user_password: hashedPassword,
                    user_type: type,
                    dept_id: deptId,
                    desg_id: desgId
                });
                results.success_count++;
            } catch (err) {
                results.failure_count++; results.errors.push(`Row ${rowNumber}: ${err.message}`);
            }
        }

        await trx('org_organizations').where({ org_id: orgId }).update({ last_user_number: nextUserNumber });
    });

    return results;
}

export default {
    getUsersByOrg,
    getUserById,
    createUser,
    setActive,
    setInactive,
    markForDelete,
    forceDelete,
    updateUser,
    bulkValidateUsers,
    bulkInsertUsers
};
