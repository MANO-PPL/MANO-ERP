import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';

export async function getSectors(orgId) {
    return await db('crm_sectors').where('org_id', orgId).select('*');
}

export async function findOrCreateSector(orgId, sectorName) {
    if (!sectorName || !sectorName.trim()) return null;
    const trimmed = sectorName.trim();

    const existing = await db('crm_sectors').where({ sector_name: trimmed, org_id: orgId }).first();
    if (existing) return existing.sector_id;

    const [newId] = await db('crm_sectors').insert({ sector_name: trimmed, org_id: orgId });
    return newId;
}

export async function createSector(orgId, sectorName) {
    if (!sectorName) throw new AppError('Sector name is required', 400);
    const existing = await db('crm_sectors').where({ sector_name: sectorName, org_id: orgId }).first();
    if (existing) throw new AppError('Sector already exists', 400);
    const [newId] = await db('crm_sectors').insert({ sector_name: sectorName, org_id: orgId });
    return newId;
}

export async function deleteSector(orgId, sectorId) {
    if (!sectorId) throw new AppError('Sector ID is required', 400);
    // Check if in use
    const inUse = await db('crm_contacts').where({ sector_id: sectorId, org_id: orgId }).first();
    if (inUse) throw new AppError('Cannot delete: This Sector is currently assigned to one or more contacts.', 400);

    return await db('crm_sectors').where({ sector_id: sectorId, org_id: orgId }).delete();
}

export default {
    getSectors,
    findOrCreateSector,
    createSector,
    deleteSector
};
