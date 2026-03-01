import bcrypt from 'bcrypt';
import AppError from '../utils/AppError.js';
import { db } from '../config/database.js';

// Retrieve all users for an organization
export async function getUsersByOrg(orgId) {
    return await db('users as u')
        .leftJoin('designations as d', 'u.desg_id', 'd.desg_id')
        .leftJoin('departments as dep', 'u.dept_id', 'dep.dept_id')
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
            'u.profile_image_url'
        )
        .where('u.org_id', orgId);
}

// Retrieve single user by id within an org
export async function getUserById(orgId, userId) {
    const user = await db('users as u')
        .leftJoin('designations as d', 'u.desg_id', 'd.desg_id')
        .leftJoin('departments as dep', 'u.dept_id', 'dep.dept_id')
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
            'd.desg_name',
            'dep.dept_name'
        )
        .where('u.user_id', userId)
        .andWhere('u.org_id', orgId)
        .first();

    if (!user) {
        throw new AppError('User not found', 404);
    }
    return user;
}

// Departments and designations
export async function getDepartments(orgId) {
    return await db('departments').where('org_id', orgId).select('*');
}

export async function getDesignations(orgId) {
    return await db('designations').where('org_id', orgId).select('*');
}

export async function createDepartment(orgId, dept_name) {
    if (!dept_name) throw new AppError('Department name is required', 400);
    const [newId] = await db('departments').insert({ dept_name, org_id: orgId });
    return newId;
}

export async function createDesignation(orgId, desg_name) {
    if (!desg_name) throw new AppError('Designation name is required', 400);
    const existing = await db('designations')
        .where({ desg_name, org_id: orgId })
        .first();
    if (existing) throw new AppError('Designation already exists', 400);
    const [newId] = await db('designations').insert({ desg_name, org_id: orgId });
    return newId;
}

export async function createUser(currentUser, userData) {
    const {
        user_name,
        user_password,
        email,
        phone_no,
        desg_id,
        dept_id,
        user_type
    } = userData;

    if (!user_name || !user_password || !email) {
        throw new AppError('Missing required fields (Name, Password, Email)', 400);
    }

    const existingEmail = await db('users').where({ email }).first();
    if (existingEmail) throw new AppError('Email is already taken', 400);

    const phoneToSave = phone_no && phone_no.trim() !== '' ? phone_no.trim() : null;
    if (phoneToSave) {
        const existingPhone = await db('users').where({ phone_no: phoneToSave }).first();
        if (existingPhone) throw new AppError('Mobile number is already taken', 400);
    }

    const hashedPassword = await bcrypt.hash(user_password, 12);
    let newUserId;

    await db.transaction(async (trx) => {
        const org = await trx('organizations')
            .where({ org_id: currentUser.org_id })
            .forUpdate()
            .first();

        if (!org) throw new AppError('Organization not found', 404);

        const nextNumber = org.last_user_number + 1;
        const userCode = `${org.org_code}-${String(nextNumber).padStart(3, '0')}`;

        await trx('organizations')
            .where({ org_id: currentUser.org_id })
            .update({ last_user_number: nextNumber });

        const [id] = await trx('users').insert({
            user_name,
            user_password: hashedPassword,
            email,
            phone_no: phoneToSave,
            desg_id,
            dept_id,
            user_type,
            org_id: currentUser.org_id,
            user_code: userCode
        });
        newUserId = id;
    });

    return newUserId;
}

export default {
    getUsersByOrg,
    getUserById,
    getDepartments,
    getDesignations,
    createDepartment,
    createDesignation,
    createUser
};
