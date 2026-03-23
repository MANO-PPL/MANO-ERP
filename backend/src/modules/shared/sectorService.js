import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';

export async function getSectors() {
    return await db('sectors').select('*');
}

export async function findOrCreateSector(sectorName) {
    if (!sectorName || !sectorName.trim()) return null;
    const trimmed = sectorName.trim();

    const existing = await db('sectors').where('sector_name', trimmed).first();
    if (existing) return existing.sector_id;

    const [newId] = await db('sectors').insert({ sector_name: trimmed });
    return newId;
}

export async function createSector(sectorName) {
    if (!sectorName) throw new AppError('Sector name is required', 400);
    const existing = await db('sectors').where({ sector_name: sectorName }).first();
    if (existing) throw new AppError('Sector already exists', 400);
    const [newId] = await db('sectors').insert({ sector_name: sectorName });
    return newId;
}

export async function deleteSector(sectorId) {
    if (!sectorId) throw new AppError('Sector ID is required', 400);
    // Check if in use
    const inUse = await db('contacts').where('sector_id', sectorId).first();
    if (inUse) throw new AppError('Cannot delete: This Sector is currently assigned to one or more contacts.', 400);

    return await db('sectors').where({ sector_id: sectorId }).delete();
}

export default {
    getSectors,
    findOrCreateSector,
    createSector,
    deleteSector
};
