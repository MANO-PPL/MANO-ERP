import { UNIT_REGISTRY } from '../../services/unitRegistry.js';

/**
 * List all standard predefined units, sorted by type then name.
 * @param {string} [unitType] - Optional filter by unit_type category
 */
export async function getUnits(unitType = null) {
    let unitsList = Object.entries(UNIT_REGISTRY).map(([code, unit]) => ({
        id: code,
        name: unit.name,
        symbol: unit.symbol,
        unit_type: unit.type,
        conversion_factor: unit.factor
    }));

    if (unitType) {
        unitsList = unitsList.filter(u => u.unit_type === unitType);
    }

    // Sort by type then name for easy dropdown grouping
    unitsList.sort((a, b) => {
        if (a.unit_type !== b.unit_type) {
            return a.unit_type.localeCompare(b.unit_type);
        }
        return a.name.localeCompare(b.name);
    });

    return unitsList;
}

export default {
    getUnits
};
