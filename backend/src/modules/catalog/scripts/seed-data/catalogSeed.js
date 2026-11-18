/**
 * ============================================================================
 * Module 2: Catalog Dev Seed Data Definitions
 * ============================================================================
 * Provides realistic master resources, rates, activities, and composition norms
 * for construction catalog seeding and testing.
 * All descriptions are explicitly labeled as sample dev data.
 */

export const SEED_RESOURCES = [
    {
        code: 'MAT-CEM-OPC53',
        name: 'Cement OPC 53',
        kind: 'material',
        baseUnitCode: 'kg',
        description: '(sample) 53 Grade Ordinary Portland Cement conforming to IS 269',
        conversion: {
            fromUnitCode: 'bag',
            toUnitCode: 'kg',
            factor: '50.0000000000',
            reason: 'Standard 50kg cement bag packaging',
        },
    },
    {
        code: 'MAT-SAND-RIV',
        name: 'River Sand',
        kind: 'material',
        baseUnitCode: 'm3',
        description: '(sample) Coarse screened natural river sand Zone II for plastering and concrete',
        conversion: {
            fromUnitCode: 'cft',
            toUnitCode: 'm3',
            factor: '0.0283000000',
            reason: 'Standard cubic foot to cubic meter volumetric conversion for river sand',
        },
    },
    {
        code: 'MAT-AGG-20',
        name: 'Aggregate 20mm',
        kind: 'material',
        baseUnitCode: 'm3',
        description: '(sample) 20mm nominal size graded crushed granite stone aggregate',
    },
    {
        code: 'MAT-BRICK-RED',
        name: 'Red Brick',
        kind: 'material',
        baseUnitCode: 'nos',
        description: '(sample) Standard modular clay burnt red brick Class 7.5',
    },
    {
        code: 'MAT-STL-TMT',
        name: 'TMT Steel Rebar',
        kind: 'material',
        baseUnitCode: 'kg',
        description: '(sample) High yield strength Fe 500D TMT reinforcement steel bars',
    },
    {
        code: 'LAB-MASON',
        name: 'Mason',
        kind: 'labour',
        baseUnitCode: 'hr',
        description: '(sample) First-class skilled brick, plaster, and stonework artisan',
    },
    {
        code: 'LAB-HELPER',
        name: 'Helper',
        kind: 'labour',
        baseUnitCode: 'hr',
        description: '(sample) Unskilled construction labourer for material handling and mixing',
    },
    {
        code: 'LAB-CARP',
        name: 'Carpenter',
        kind: 'labour',
        baseUnitCode: 'hr',
        description: '(sample) Formwork and shuttering skilled carpenter',
    },
    {
        code: 'EQP-JCB',
        name: 'JCB Excavator',
        kind: 'equipment',
        baseUnitCode: 'hr',
        description: '(sample) JCB 3DX backhoe loader inclusive of operator, diesel, and maintenance',
    },
];

export const SEED_RATES = [
    // Cement: 380/bag from 2026-04-01, then 410/bag from 2026-10-01
    {
        resourceCode: 'MAT-CEM-OPC53',
        rate: '380.0000',
        unitCode: 'bag',
        effectiveFrom: '2026-04-01',
        note: 'Q1 baseline supplier contract rate',
    },
    {
        resourceCode: 'MAT-CEM-OPC53',
        rate: '410.0000',
        unitCode: 'bag',
        effectiveFrom: '2026-10-01',
        note: 'Q3 post-monsoon price escalation',
    },
    // Sand: 1800/m3
    {
        resourceCode: 'MAT-SAND-RIV',
        rate: '1800.0000',
        unitCode: 'm3',
        effectiveFrom: '2026-04-01',
        note: 'Quarry pit head rate with local transit',
    },
    // Aggregate: 1500/m3
    {
        resourceCode: 'MAT-AGG-20',
        rate: '1500.0000',
        unitCode: 'm3',
        effectiveFrom: '2026-04-01',
        note: 'Crusher supply rate at stockyard',
    },
    // Brick: 9/nos
    {
        resourceCode: 'MAT-BRICK-RED',
        rate: '9.0000',
        unitCode: 'nos',
        effectiveFrom: '2026-04-01',
        note: 'Direct kiln supply per piece',
    },
    // Steel: 62/kg
    {
        resourceCode: 'MAT-STL-TMT',
        rate: '62.0000',
        unitCode: 'kg',
        effectiveFrom: '2026-04-01',
        note: 'Primary mill distributor price per kg',
    },
    // Mason: 800/day (day = 8 hr -> 100/hr)
    {
        resourceCode: 'LAB-MASON',
        rate: '800.0000',
        unitCode: 'day',
        effectiveFrom: '2026-04-01',
        note: 'Daily wage for 8-hour shift skilled mason',
    },
    // Helper: 60/hr
    {
        resourceCode: 'LAB-HELPER',
        rate: '60.0000',
        unitCode: 'hr',
        effectiveFrom: '2026-04-01',
        note: 'Standard hourly labour rate',
    },
    // Carpenter: 90/hr
    {
        resourceCode: 'LAB-CARP',
        rate: '90.0000',
        unitCode: 'hr',
        effectiveFrom: '2026-04-01',
        note: 'Skilled shuttering carpenter hourly rate',
    },
    // JCB: 1400/hr
    {
        resourceCode: 'EQP-JCB',
        rate: '1400.0000',
        unitCode: 'hr',
        effectiveFrom: '2026-04-01',
        note: 'Hourly wet-lease rate including operator and diesel',
    },
];

export const SEED_ACTIVITIES = [
    {
        code: 'ACT-EXC',
        name: 'Excavation in soil',
        outputUnitCode: 'm3',
        description: '(sample) Mechanical excavation in ordinary soil up to 1.5m depth',
        norms: [
            { resourceCode: 'EQP-JCB', qtyPerUnit: '0.150000', unitCode: 'hr', wastagePct: '0.000', effectiveFrom: '2026-04-01', note: 'JCB machine output: ~6.67 m3/hr' },
            { resourceCode: 'LAB-HELPER', qtyPerUnit: '0.500000', unitCode: 'hr', wastagePct: '0.000', effectiveFrom: '2026-04-01', note: 'Manual dressing, trimming, and spoil clearance' },
        ],
    },
    {
        code: 'ACT-BRK-115',
        name: 'Brickwork 1:4, 115mm',
        outputUnitCode: 'm2',
        description: '(sample) Half-brick partition wall (115mm thick) in cement mortar 1:4',
        norms: [
            { resourceCode: 'MAT-BRICK-RED', qtyPerUnit: '50.000000', unitCode: 'nos', wastagePct: '5.000', effectiveFrom: '2026-04-01', note: 'Nominal brick count with breakage allowance' },
            { resourceCode: 'MAT-CEM-OPC53', qtyPerUnit: '0.030000', unitCode: 'bag', wastagePct: '3.000', effectiveFrom: '2026-04-01', note: 'Mortar cement requirement per m2' },
            { resourceCode: 'MAT-SAND-RIV', qtyPerUnit: '0.004000', unitCode: 'm3', wastagePct: '5.000', effectiveFrom: '2026-04-01', note: 'Mortar river sand requirement per m2' },
            { resourceCode: 'LAB-MASON', qtyPerUnit: '0.800000', unitCode: 'hr', wastagePct: '0.000', effectiveFrom: '2026-04-01', note: 'Skilled mason laying and alignment' },
            { resourceCode: 'LAB-HELPER', qtyPerUnit: '0.800000', unitCode: 'hr', wastagePct: '0.000', effectiveFrom: '2026-04-01', note: 'Mortar mixing and brick soaking' },
        ],
    },
    {
        code: 'ACT-RCC-M25',
        name: 'RCC slab M25',
        outputUnitCode: 'm3',
        description: '(sample) M25 grade reinforced cement concrete in suspended floor/roof slabs',
        norms: [
            { resourceCode: 'MAT-CEM-OPC53', qtyPerUnit: '8.000000', unitCode: 'bag', wastagePct: '2.000', effectiveFrom: '2026-04-01', note: '400 kg cement per m3 concrete' },
            { resourceCode: 'MAT-SAND-RIV', qtyPerUnit: '0.450000', unitCode: 'm3', wastagePct: '5.000', effectiveFrom: '2026-04-01', note: 'Fine aggregate volume' },
            { resourceCode: 'MAT-AGG-20', qtyPerUnit: '0.900000', unitCode: 'm3', wastagePct: '5.000', effectiveFrom: '2026-04-01', note: 'Coarse 20mm aggregate volume' },
            { resourceCode: 'MAT-STL-TMT', qtyPerUnit: '90.000000', unitCode: 'kg', wastagePct: '3.000', effectiveFrom: '2026-04-01', note: 'Average slab reinforcement detailing' },
            { resourceCode: 'LAB-CARP', qtyPerUnit: '6.000000', unitCode: 'hr', wastagePct: '0.000', effectiveFrom: '2026-04-01', note: 'Staging, shuttering, and prop erection' },
            { resourceCode: 'LAB-MASON', qtyPerUnit: '3.000000', unitCode: 'hr', wastagePct: '0.000', effectiveFrom: '2026-04-01', note: 'Pouring, compaction, and screed finishing' },
            { resourceCode: 'LAB-HELPER', qtyPerUnit: '8.000000', unitCode: 'hr', wastagePct: '0.000', effectiveFrom: '2026-04-01', note: 'Vibrator handling, curing, and concrete transport' },
        ],
    },
];
