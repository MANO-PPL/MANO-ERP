import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';

export async function getSectors(orgId) {
    const list = await db('crm_sectors')
        .where({ org_id: orgId })
        .orderBy('sector_name', 'asc')
        .select('*');

    const seen = new Set();
    const uniqueList = [];
    for (const item of list) {
        const key = (item.sector_name || '').trim().toLowerCase();
        if (key && !seen.has(key)) {
            seen.add(key);
            uniqueList.push(item);
        }
    }
    return uniqueList;
}

export async function findOrCreateSector(orgId, sectorName, connection = db) {
    if (!sectorName || !sectorName.trim()) return null;
    const trimmed = sectorName.trim();

    const existing = await connection('crm_sectors')
        .whereRaw('LOWER(sector_name) = ?', [trimmed.toLowerCase()])
        .where({ org_id: orgId })
        .first();

    if (existing) return existing.id;

    const [newId] = await connection('crm_sectors').insert({ sector_name: trimmed, org_id: orgId });
    return newId;
}

export async function createSector(orgId, sectorName) {
    if (!sectorName || !sectorName.trim()) throw new AppError('Sector name is required', 400);
    const trimmed = sectorName.trim();
    const existing = await db('crm_sectors')
        .whereRaw('LOWER(sector_name) = ?', [trimmed.toLowerCase()])
        .where({ org_id: orgId })
        .first();

    if (existing) return existing.id;

    const [newId] = await db('crm_sectors').insert({ sector_name: trimmed, org_id: orgId });
    return newId;
}

export async function deleteSector(orgId, sectorId) {
    if (!sectorId) throw new AppError('Sector ID is required', 400);
    const inUse = await db('crm_contacts').where({ sector_id: sectorId, org_id: orgId }).first();
    if (inUse) throw new AppError('Cannot delete: This Sector is currently assigned to one or more contacts.', 400);

    return await db('crm_sectors').where({ id: sectorId, org_id: orgId }).delete();
}

export default {
    getSectors,
    findOrCreateSector,
    createSector,
    deleteSector
};

