// ─── Project-level defaults ────────────────────────────────────────────────
export const PROJECT_DEFAULTS = {
    slabArea: 139749,   // Sqft
    gstRate: 0.18,       // 18%
};

// ─── Helper to create a line item ─────────────────────────────────────────
const item = (id, srNo, description, unit, qty, matRate, labRate, totalOverride = null, remarks = '') => ({
    id: String(id),
    srNo,
    description,
    unit,
    quantity: qty,
    materialRate: matRate,
    labourRate: labRate,
    totalRateOverride: totalOverride,
    remarks,
});

// ─── Seed sections (from MANO Web Site & ERP - Budget.csv) ────────────────
export const BUDGET_SECTIONS = [
    {
        id: 'civil',
        srNo: '1',
        name: 'Civil Works',
        iconKey: 'HardHat',
        items: [
            item('c1', '1.1', 'Pile Work (Incl. Labour + Material)', 'No', 54, 0, 0, 94587.23),
            item('c2', '1.2', 'Shore Pile Work (Incl. Labour + Material)', 'No', 88, 0, 0, 26000.00),
            item('c3', '1.3', 'Anti-Termite Treatment', 'Sqm', 2528, 0, 73, null, 'No quantity backup'),
            item('c4', '1.4', 'Civil Package (Excavn, RCC, BW, Plaster)', 'Sqft', 139749, 0, 1575, null, 'WO rate 1155 + Cash 420'),
            item('c5', '1.5a', 'Shahabadi WP – Lift + Pump Room + UGT', 'Sqft', 12897.75, 75.73, 44.27, null),
            item('c6', '1.5b', 'Internal Waterproofing (Lift + UGT + Pump Room)', 'Sqft', 9503.14, 0, 80, null),
            item('c7', '1.5c', 'Brickbat WP Terrace (w/o China Mosaic)', 'Sqft', 5228.39, 0, 150, null),
            item('c8', '1.5d', 'Balcony Living + Kitchen (Brickbat)', 'Sqft', 3491.39, 0, 150, null),
            item('c9', '1.5e', 'Chemical Coating – Toilet', 'Sqft', 746.78, 0, 40, null),
            item('c10', '1.5f', 'Core Packing – Toilet', 'Nos', 1000, 0, 380, null),
            item('c11', '1.5g', 'Plaster on Walls (WP)', 'Sqft', 25990.63, 0, 45, null),
            item('c12', '1.5h', 'Base Coat with Screeding', 'Sqft', 746.78, 0, 58, null),
            item('c13', '1.5i', 'PU Coating on Mother Slab', 'Sqft', 13949.17, 0, 60, null),
            item('c14', '1.5j', 'Brickbat WP LMR & OHT', 'Sqft', 1075.11, 0, 150, null),
            item('c15', '1.5k', 'Internal WP Inside OHT-Brickbat', 'Sqft', 859.41, 0, 80, null),
            item('c16', '1.6', 'Trimix Flooring', 'Sqft', 0, 0, 120, null, 'No quantity backup'),
        ],
    },
    {
        id: 'elec',
        srNo: '2',
        name: 'Electrification',
        iconKey: 'Zap',
        items: [
            item('e1', '2', 'Electrification (Labour + Material)', 'Sqft', 139749, 0, 0, 250),
        ],
    },
    {
        id: 'plumb',
        srNo: '3',
        name: 'Plumbing & Sanitation',
        iconKey: 'Droplets',
        items: [
            item('p1', '3.1', 'Toilets (Attached + Store + Mid Landing) – Concealed / Downtake / Terrace Looping', 'Nos', 308, 0, 45000, null),
            item('p2', '3.2', 'Pump & Panels', 'Sqft', 139749, 0, 15, null),
            item('p3', '3.3', 'CP Fittings (Toilet & Kitchen)', 'Nos', 308, 0, 175000, null),
        ],
    },
    {
        id: 'fire',
        srNo: '4',
        name: 'Fire Fighting',
        iconKey: 'Flame',
        items: [
            item('f1', '4', 'Fire Fighting incl. FF Pumps', 'Sqft', 139749, 0, 0, 130),
        ],
    },
    {
        id: 'finishes',
        srNo: '5',
        name: 'Civil Finishes',
        iconKey: 'PenTool',
        items: [
            item('fn1', '5.a1', 'Window Frame – White Spotted Marble (150mm)', 'Sqft', 5671.22, 60, 75, null),
            item('fn2', '5.a2', 'Window Frame – Granite (75mm)', 'Sqft', 2918.36, 160, 75, null),
            item('fn3', '5.a3', 'Aluminium Sliding Window (Dark Grey PPF Coated)', 'Sqft', 12394.93, 0, 600, null),
            item('fn4', '5.a4', 'Ventilator', 'Sqft', 1313.64, 0, 350, null),
            item('fn5', '5.b1', 'D1 – Living Room Door Frame (Teakwood)', 'No', 83, 4625, 0, null),
            item('fn6', '5.b2', 'D2 – Master Bedroom Door Frame (Teakwood)', 'No', 130, 3800, 0, null),
            item('fn7', '5.b3', 'D3 – Toilet / Store Door Frame (Granite)', 'RFT', 5808.88, 285, 90, null),
            item('fn8', '5.b4', 'D4 – Masterbedroom Frame (Teakwood)', 'No', 62, 3800, 0, null),
            item('fn9', '5.b5', 'D6 – Elec. Meter Room Frame', 'No', 3, 0, 0, 15000),
            item('fn10', '5.b6', 'D7 – Fitness Centre Frame', 'No', 1, 0, 0, 40000),
            item('fn11', '5.b7', 'D8 – Bath/WC Door Frame', 'No', 8, 3000, 2000, null),
            item('fn12', '5.c1', 'Flooring – 600×1200 Vitrified Tile', 'Sqft', 87733.63, 50, 70, null),
            item('fn13', '5.c2', 'Skirting – Vitrified Tile 75mm High', 'Rft', 23029.01, 15, 35, null),
            item('fn14', '5.c3', 'Dado – 600×1200 Vitrified Tile', 'Sqft', 31454.33, 50, 70, null),
            item('fn15', '5.c4', 'Kitchen Platform (Granite)', 'Sqft', 6495.64, 250, 325, null),
            item('fn16', '5.c5', 'Vertical Support (White Marble)', 'Sqft', 3890.78, 80, 0, null),
            item('fn17', '5.d1', 'D1 Shutter – Flush Door (Veneer Melamine) + Hardware', 'Sqft', 2373.46, 730, 100, null),
            item('fn18', '5.d2', 'D2 Shutter – Flush Door (Laminate) + Hardware', 'Sqft', 3148.47, 550, 100, null),
            item('fn19', '5.d3', 'D3 Shutter – Flush Door (Laminate) + Hardware', 'Sqft', 6236.39, 525, 100, null),
            item('fn20', '5.d4', 'D4 Shutter – MB (Laminate)', 'Sqft', 1662.23, 525, 100, null),
            item('fn21', '5.d5', 'D5 – Staircase FRD', 'Sqft', 721.19, 750, 100, null),
            item('fn22', '5.e1', 'Metal False Ceiling in Toilets', 'Sqft', 10936.46, 0, 150, null),
            item('fn23', '5.f1', 'Painting – Internal Wall (Luster)', 'Sqft', 339740.37, 0, 35, null),
            item('fn24', '5.f2', 'Painting – Ceiling (Plastic)', 'Sqft', 84870.20, 0, 24, null),
            item('fn25', '5.g1', 'Staircase (Tread, Riser, Mid Landing) – Marble', 'Sqft', 4758.23, 125, 75, null),
            item('fn26', '5.g2', 'External Paint (Texture)', 'Sqft', 185061.33, 0, 45, null),
        ],
    },
    {
        id: 'facade',
        srNo: '6',
        name: 'Façade & Lobby',
        iconKey: 'Building2',
        items: [
            item('fa1', '6.1', 'Façade – Aluminium Fins (1F–3F Slab)', 'Sq.ft', 10511.83, 0, 325, null),
            item('fa2', '6.2', 'Entrance Lobby', 'No', 1, 0, 0, 1500000),
            item('fa3', '6.3', 'Railing for Staircase (M.S., 1m ht)', 'Sqft', 1307.18, 0, 350, null),
            item('fa4', '6.4', 'Glass Railing for Balcony (1m ht)', 'Sqft', 3556.43, 0, 1250, null),
        ],
    },
    {
        id: 'equip',
        srNo: '7',
        name: 'Equipment',
        iconKey: 'Settings2',
        items: [
            item('eq1', '7.1a', 'Lift 1 – PE01-PE02 (3.20×2.67m)', 'Nos', 1, 0, 0, 3860000),
            item('eq2', '7.1b', 'Lift 2 – PE-03 (3.06×2.67m)', 'Nos', 1, 0, 0, 3860000),
            item('eq3', '7.1c', 'Fireman Lift (1.70×1.80m)', 'Nos', 1, 0, 0, 2400000),
            item('eq4', '7.2', 'Mechanical Car Parking (Stacker)', 'Nos', 8, 0, 0, 2980000),
            item('eq5', '7.4', 'VDP & CCTV', 'LS', 1, 0, 0, 750000),
            item('eq6', '7.5', 'Gates', 'Nos', 2, 0, 0, 250000),
            item('eq7', '7.6', 'DG Set 550 KVA', 'LS', 1, 0, 0, 5500000),
            item('eq8', '7.8', 'Gym Equipments (Treadmill, Elliptical, Bike, etc.)', 'LS', 1, 0, 0, 2139865),
        ],
    },
    {
        id: 'landscape',
        srNo: '8',
        name: 'Landscape',
        iconKey: 'Trees',
        items: [
            item('l1', '8.1', 'Ground Floor Landscaping', 'LS', 1, 0, 0, 1700000),
            item('l2', '8.2', 'Top Terrace Landscaping', 'LS', 1, 0, 0, 1200000),
        ],
    },
    {
        id: 'consult',
        srNo: '9',
        name: 'Consultancy',
        iconKey: 'Users',
        items: [
            item('co1', '9.1', 'Architect', 'Sqft', 139749, 0, 14, null),
            item('co2', '9.2', 'RCC Consultant', 'Sqft', 139749, 0, 6, null),
            item('co3', '9.3', 'MEP Consultant', 'Sqft', 139749, 0, 8.60, null),
            item('co4', '9.4', 'Project Management Consultant', 'Sqft', 139749, 0, 50, null),
            item('co5', '9.5', 'Liaoning Consultant', 'Sqft', 139749, 0, 40, null),
            item('co6', '9.6', 'Landscape Consultant', 'LS', 1, 0, 0, 350000),
        ],
    },
    {
        id: 'misc',
        srNo: '10',
        name: 'Miscellaneous',
        iconKey: 'Package',
        items: [
            item('m1', '10', 'Letter Box, Name Plates, Boards, Phone, EPBX & TV, Dept. Labour', 'Sqft', 139749, 0, 100, null),
        ],
    },
    {
        id: 'contingency',
        srNo: '11',
        name: 'Contingency',
        iconKey: 'AlertTriangle',
        items: [
            item('ct1', '11', 'Variance in Specs / Additional Qty (Contingency)', 'Sqft', 139749, 0, 100, null),
        ],
    },
];
