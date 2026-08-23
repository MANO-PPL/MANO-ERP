import * as XLSX from 'xlsx';
import { locale } from '@fortune-sheet/core';

export const ALL_FONTS = [
    'Poppins',
    'Inter',
    'Roboto',
    'Segoe UI',
    'Calibri',
    'Arial',
    'Open Sans',
    'Lato',
    'Montserrat',
    'Georgia',
    'Times New Roman',
    'Trebuchet MS',
    'Verdana',
    'Tahoma',
    'Helvetica Neue',
    'Cambria',
    'Century Gothic',
    'Courier New',
    'Consolas',
    'Impact',
    'Comic Sans MS',
    'Arial Black'
];

/**
 * Registers expanded font list with FortuneSheet's locale dictionary
 */
export const registerCustomFonts = () => {
    try {
        const loc = locale({ lang: 'en' });
        if (loc) {
            loc.fontarray = ALL_FONTS;
            loc.fontjson = {};
            ALL_FONTS.forEach((font, idx) => {
                loc.fontjson[font.toLowerCase()] = idx;
            });
        }
    } catch (e) {
        console.warn('Failed to register custom fonts for FortuneSheet:', e);
    }
};

// Immediately register fonts
registerCustomFonts();

/**
 * Converts a 0-indexed column number to Excel column letter (0 -> A, 27 -> AB)
 */
export const colIndexToLetter = (colIndex) => {
    let temp = colIndex;
    let letter = '';
    while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
    }
    return letter;
};

/**
 * Converts Excel column letter to 0-indexed column number ('A' -> 0, 'Z' -> 25, 'AA' -> 26)
 */
export const letterToColIndex = (letter) => {
    let col = 0;
    const clean = letter.toUpperCase();
    for (let i = 0; i < clean.length; i++) {
        col = col * 26 + (clean.charCodeAt(i) - 64);
    }
    return col - 1;
};

/**
 * Generates initial construction ERP templates with formulas, cell formatting, and colors
 */
export const getConstructionTemplates = (projectName = 'Construction Project', projectCode = 'PRJ-001') => {
    const today = new Date().toISOString().split('T')[0];

    return [
        {
            id: 'blank',
            name: 'Blank Workbook',
            description: 'Start with a clean, empty spreadsheet for custom calculations and data.',
            icon: 'FileSpreadsheet',
            badge: 'Blank',
            badgeColor: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
            sheets: [
                {
                    name: 'Sheet1',
                    id: 'sheet_1',
                    status: 1,
                    order: 0,
                    row: 60,
                    column: 26,
                    celldata: []
                }
            ]
        },
        {
            id: 'boq',
            name: 'Bill of Quantities (BOQ)',
            description: 'Itemized civil, structural, finishing, and MEP line items with automated rate × quantity calculations.',
            icon: 'Calculator',
            badge: 'Essential',
            badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
            sheets: [
                {
                    name: 'Bill of Quantities',
                    id: 'sheet_boq',
                    status: 1,
                    order: 0,
                    row: 60,
                    column: 26,
                    config: {
                        columnlen: {
                            0: 85,
                            1: 300,
                            2: 85,
                            3: 110,
                            4: 130,
                            5: 150,
                            6: 200
                        },
                        rowlen: {
                            0: 36,
                            1: 26,
                            3: 30
                        },
                        merge: {
                            "0_0": { r: 0, c: 0, rs: 1, cs: 7 },
                            "1_0": { r: 1, c: 0, rs: 1, cs: 7 }
                        }
                    },
                    celldata: [
                        // Title Header
                        { r: 0, c: 0, v: { v: 'BILL OF QUANTITIES (BOQ)', m: 'BILL OF QUANTITIES (BOQ)', bl: 1, fs: 14, fc: '#1e3a8a', bg: '#dbeafe', ht: 1, vt: 1 } },
                        { r: 1, c: 0, v: { v: `Project: ${projectName} (${projectCode}) | Date: ${today}`, m: `Project: ${projectName} (${projectCode}) | Date: ${today}`, bl: 1, fs: 10, fc: '#475569', bg: '#f1f5f9', ht: 1, vt: 1 } },
                        
                        // Table Headers (Row 3)
                        { r: 3, c: 0, v: { v: 'Item No.', m: 'Item No.', bl: 1, fs: 10, fc: '#ffffff', bg: '#2563eb', ht: 1, vt: 1 } },
                        { r: 3, c: 1, v: { v: 'Description of Work', m: 'Description of Work', bl: 1, fs: 10, fc: '#ffffff', bg: '#2563eb', ht: 0, vt: 1 } },
                        { r: 3, c: 2, v: { v: 'Unit', m: 'Unit', bl: 1, fs: 10, fc: '#ffffff', bg: '#2563eb', ht: 1, vt: 1 } },
                        { r: 3, c: 3, v: { v: 'Quantity', m: 'Quantity', bl: 1, fs: 10, fc: '#ffffff', bg: '#2563eb', ht: 2, vt: 1 } },
                        { r: 3, c: 4, v: { v: 'Unit Rate (₹)', m: 'Unit Rate (₹)', bl: 1, fs: 10, fc: '#ffffff', bg: '#2563eb', ht: 2, vt: 1 } },
                        { r: 3, c: 5, v: { v: 'Total Amount (₹)', m: 'Total Amount (₹)', bl: 1, fs: 10, fc: '#ffffff', bg: '#2563eb', ht: 2, vt: 1 } },
                        { r: 3, c: 6, v: { v: 'Remarks / Specification', m: 'Remarks / Specification', bl: 1, fs: 10, fc: '#ffffff', bg: '#2563eb', ht: 0, vt: 1 } },

                        // Row 4: Section 1.0 Substructure
                        { r: 4, c: 0, v: { v: '1.0', m: '1.0', bl: 1, fc: '#1e293b', bg: '#e2e8f0', ht: 1 } },
                        { r: 4, c: 1, v: { v: 'SUBSTRUCTURE & EARTHWORKS', m: 'SUBSTRUCTURE & EARTHWORKS', bl: 1, fc: '#1e293b', bg: '#e2e8f0' } },
                        { r: 4, c: 2, v: { v: '', m: '', bg: '#e2e8f0' } },
                        { r: 4, c: 3, v: { v: '', m: '', bg: '#e2e8f0' } },
                        { r: 4, c: 4, v: { v: '', m: '', bg: '#e2e8f0' } },
                        { r: 4, c: 5, v: { v: '', m: '', bg: '#e2e8f0' } },
                        { r: 4, c: 6, v: { v: '', m: '', bg: '#e2e8f0' } },

                        // Items
                        { r: 5, c: 0, v: { v: '1.1', m: '1.1', ht: 1 } },
                        { r: 5, c: 1, v: { v: 'Site clearance and topsoil excavation up to 150mm depth', m: 'Site clearance and topsoil excavation up to 150mm depth' } },
                        { r: 5, c: 2, v: { v: 'SQM', m: 'SQM', ht: 1 } },
                        { r: 5, c: 3, v: { v: 1250, m: '1,250', ct: { fa: '#,##0', t: 'n' }, ht: 2 } },
                        { r: 5, c: 4, v: { v: 85, m: '₹85.00', ct: { fa: '₹#,##0.00', t: 'n' }, ht: 2 } },
                        { r: 5, c: 5, v: { f: '=D6*E6', v: 106250, m: '₹106,250.00', ct: { fa: '₹#,##0.00', t: 'n' }, bl: 1, ht: 2 } },
                        { r: 5, c: 6, v: { v: 'Including disposal to designated yard', m: 'Including disposal to designated yard' } },

                        { r: 6, c: 0, v: { v: '1.2', m: '1.2', ht: 1 } },
                        { r: 6, c: 1, v: { v: 'Foundation excavation in all types of soil & rock', m: 'Foundation excavation in all types of soil & rock' } },
                        { r: 6, c: 2, v: { v: 'CUM', m: 'CUM', ht: 1 } },
                        { r: 6, c: 3, v: { v: 480, m: '480', ct: { fa: '#,##0', t: 'n' }, ht: 2 } },
                        { r: 6, c: 4, v: { v: 240, m: '₹240.00', ct: { fa: '₹#,##0.00', t: 'n' }, ht: 2 } },
                        { r: 6, c: 5, v: { f: '=D7*E7', v: 115200, m: '₹115,200.00', ct: { fa: '₹#,##0.00', t: 'n' }, bl: 1, ht: 2 } },
                        { r: 6, c: 6, v: { v: 'Up to 3m depth including shoring', m: 'Up to 3m depth including shoring' } },

                        { r: 7, c: 0, v: { v: '1.3', m: '1.3', ht: 1 } },
                        { r: 7, c: 1, v: { v: 'PCC (1:4:8) for foundation leveling course (100mm thick)', m: 'PCC (1:4:8) for foundation leveling course (100mm thick)' } },
                        { r: 7, c: 2, v: { v: 'CUM', m: 'CUM', ht: 1 } },
                        { r: 7, c: 3, v: { v: 65, m: '65', ct: { fa: '#,##0', t: 'n' }, ht: 2 } },
                        { r: 7, c: 4, v: { v: 4200, m: '₹4,200.00', ct: { fa: '₹#,##0.00', t: 'n' }, ht: 2 } },
                        { r: 7, c: 5, v: { f: '=D8*E8', v: 273000, m: '₹273,000.00', ct: { fa: '₹#,##0.00', t: 'n' }, bl: 1, ht: 2 } },
                        { r: 7, c: 6, v: { v: 'Grade M7.5 plain cement concrete', m: 'Grade M7.5 plain cement concrete' } },

                        // Row 8: Section 2.0 Superstructure
                        { r: 8, c: 0, v: { v: '2.0', m: '2.0', bl: 1, fc: '#1e293b', bg: '#e2e8f0', ht: 1 } },
                        { r: 8, c: 1, v: { v: 'CONCRETE & REINFORCEMENT (RCC)', m: 'CONCRETE & REINFORCEMENT (RCC)', bl: 1, fc: '#1e293b', bg: '#e2e8f0' } },
                        { r: 8, c: 2, v: { v: '', m: '', bg: '#e2e8f0' } },
                        { r: 8, c: 3, v: { v: '', m: '', bg: '#e2e8f0' } },
                        { r: 8, c: 4, v: { v: '', m: '', bg: '#e2e8f0' } },
                        { r: 8, c: 5, v: { v: '', m: '', bg: '#e2e8f0' } },
                        { r: 8, c: 6, v: { v: '', m: '', bg: '#e2e8f0' } },

                        { r: 9, c: 0, v: { v: '2.1', m: '2.1', ht: 1 } },
                        { r: 9, c: 1, v: { v: 'RCC M25 grade concrete in columns, beams & slabs', m: 'RCC M25 grade concrete in columns, beams & slabs' } },
                        { r: 9, c: 2, v: { v: 'CUM', m: 'CUM', ht: 1 } },
                        { r: 9, c: 3, v: { v: 320, m: '320', ct: { fa: '#,##0', t: 'n' }, ht: 2 } },
                        { r: 9, c: 4, v: { v: 6800, m: '₹6,800.00', ct: { fa: '₹#,##0.00', t: 'n' }, ht: 2 } },
                        { r: 9, c: 5, v: { f: '=D10*E10', v: 2176000, m: '₹2,176,000.00', ct: { fa: '₹#,##0.00', t: 'n' }, bl: 1, ht: 2 } },
                        { r: 9, c: 6, v: { v: 'RMC supplied and pumped into formwork', m: 'RMC supplied and pumped into formwork' } },

                        { r: 10, c: 0, v: { v: '2.2', m: '2.2', ht: 1 } },
                        { r: 10, c: 1, v: { v: 'Fe550D TMT Reinforcement steel cutting, bending & placing', m: 'Fe550D TMT Reinforcement steel cutting, bending & placing' } },
                        { r: 10, c: 2, v: { v: 'MT', m: 'MT', ht: 1 } },
                        { r: 10, c: 3, v: { v: 28.5, m: '28.5', ct: { fa: '#,##0.00', t: 'n' }, ht: 2 } },
                        { r: 10, c: 4, v: { v: 64000, m: '₹64,000.00', ct: { fa: '₹#,##0.00', t: 'n' }, ht: 2 } },
                        { r: 10, c: 5, v: { f: '=D11*E11', v: 1824000, m: '₹1,824,000.00', ct: { fa: '₹#,##0.00', t: 'n' }, bl: 1, ht: 2 } },
                        { r: 10, c: 6, v: { v: 'Primary structural grade steel including binding wire', m: 'Primary structural grade steel including binding wire' } },

                        { r: 11, c: 0, v: { v: '2.3', m: '2.3', ht: 1 } },
                        { r: 11, c: 1, v: { v: 'Centering and shuttering with film-faced ply formwork', m: 'Centering and shuttering with film-faced ply formwork' } },
                        { r: 11, c: 2, v: { v: 'SQM', m: 'SQM', ht: 1 } },
                        { r: 11, c: 3, v: { v: 1450, m: '1,450', ct: { fa: '#,##0', t: 'n' }, ht: 2 } },
                        { r: 11, c: 4, v: { v: 460, m: '₹460.00', ct: { fa: '₹#,##0.00', t: 'n' }, ht: 2 } },
                        { r: 11, c: 5, v: { f: '=D12*E12', v: 667000, m: '₹667,000.00', ct: { fa: '₹#,##0.00', t: 'n' }, bl: 1, ht: 2 } },
                        { r: 11, c: 6, v: { v: 'Smooth finish formwork with staging props', m: 'Smooth finish formwork with staging props' } },

                        // Totals Row
                        { r: 13, c: 0, v: { v: '', m: '' } },
                        { r: 13, c: 1, v: { v: 'SUBTOTAL (CIVIL & RCC)', m: 'SUBTOTAL (CIVIL & RCC)', bl: 1, fc: '#0f172a', ht: 2 } },
                        { r: 13, c: 2, v: { v: '', m: '' } },
                        { r: 13, c: 3, v: { v: '', m: '' } },
                        { r: 13, c: 4, v: { v: '', m: '' } },
                        { r: 13, c: 5, v: { f: '=SUM(F6:F12)', v: 5161450, m: '₹5,161,450.00', ct: { fa: '₹#,##0.00', t: 'n' }, bl: 1, bg: '#fef08a', ht: 2 } },
                        { r: 13, c: 6, v: { v: '', m: '' } },

                        { r: 14, c: 1, v: { v: 'GST / Tax (18%)', m: 'GST / Tax (18%)', bl: 1, ht: 2 } },
                        { r: 14, c: 5, v: { f: '=F14*0.18', v: 929061, m: '₹929,061.00', ct: { fa: '₹#,##0.00', t: 'n' }, bl: 1, ht: 2 } },

                        { r: 15, c: 1, v: { v: 'GRAND TOTAL AMOUNT (INR)', m: 'GRAND TOTAL AMOUNT (INR)', bl: 1, fs: 11, fc: '#1e3a8a', bg: '#bfdbfe', ht: 2 } },
                        { r: 15, c: 5, v: { f: '=F14+F15', v: 6090511, m: '₹6,090,511.00', ct: { fa: '₹#,##0.00', t: 'n' }, bl: 1, fs: 11, fc: '#1e3a8a', bg: '#bfdbfe', ht: 2 } }
                    ]
                }
            ]
        },
        {
            id: 'cost_estimator',
            name: 'Project Budget & Cost Estimator',
            description: 'Comprehensive cost modeling breakdown for Material, Labor, Plant & Machinery, Subcontracts, Contingencies & Margins.',
            icon: 'TrendingUp',
            badge: 'Financial',
            badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
            sheets: [
                {
                    name: 'Project Budget Model',
                    id: 'sheet_budget',
                    status: 1,
                    order: 0,
                    row: 50,
                    column: 20,
                    config: {
                        columnlen: {
                            0: 85,
                            1: 280,
                            2: 150,
                            3: 150,
                            4: 140,
                            5: 120,
                            6: 200
                        },
                        rowlen: {
                            0: 36,
                            1: 26,
                            3: 30
                        },
                        merge: {
                            "0_0": { r: 0, c: 0, rs: 1, cs: 7 },
                            "1_0": { r: 1, c: 0, rs: 1, cs: 7 }
                        }
                    },
                    celldata: [
                        { r: 0, c: 0, v: { v: 'PROJECT BUDGET & COST ESTIMATOR', m: 'PROJECT BUDGET & COST ESTIMATOR', bl: 1, fs: 14, fc: '#065f46', bg: '#d1fae5', ht: 1, vt: 1 } },
                        { r: 1, c: 0, v: { v: `Project: ${projectName} | Code: ${projectCode} | Date: ${today}`, m: `Project: ${projectName} | Code: ${projectCode} | Date: ${today}`, bl: 1, fs: 10, fc: '#475569', bg: '#f1f5f9', ht: 1, vt: 1 } },

                        { r: 3, c: 0, v: { v: 'Cost Code', m: 'Cost Code', bl: 1, fc: '#ffffff', bg: '#059669', ht: 1, vt: 1 } },
                        { r: 3, c: 1, v: { v: 'Cost Head / Category', m: 'Cost Head / Category', bl: 1, fc: '#ffffff', bg: '#059669', ht: 0, vt: 1 } },
                        { r: 3, c: 2, v: { v: 'Estimated Budget (₹)', m: 'Estimated Budget (₹)', bl: 1, fc: '#ffffff', bg: '#059669', ht: 2, vt: 1 } },
                        { r: 3, c: 3, v: { v: 'Actual Spent to Date (₹)', m: 'Actual Spent to Date (₹)', bl: 1, fc: '#ffffff', bg: '#059669', ht: 2, vt: 1 } },
                        { r: 3, c: 4, v: { v: 'Variance (₹)', m: 'Variance (₹)', bl: 1, fc: '#ffffff', bg: '#059669', ht: 2, vt: 1 } },
                        { r: 3, c: 5, v: { v: '% Budget Used', m: '% Budget Used', bl: 1, fc: '#ffffff', bg: '#059669', ht: 2, vt: 1 } },
                        { r: 3, c: 6, v: { v: 'Status / Notes', m: 'Status / Notes', bl: 1, fc: '#ffffff', bg: '#059669', ht: 0, vt: 1 } },

                        { r: 4, c: 0, v: { v: 'MAT-100', m: 'MAT-100', ht: 1 } },
                        { r: 4, c: 1, v: { v: 'Raw Materials (Cement, Steel, Aggregates, Bricks)', m: 'Raw Materials (Cement, Steel, Aggregates, Bricks)' } },
                        { r: 4, c: 2, v: { v: 4500000, m: '₹4,500,000', ct: { fa: '₹#,##0', t: 'n' }, ht: 2 } },
                        { r: 4, c: 3, v: { v: 3850000, m: '₹3,850,000', ct: { fa: '₹#,##0', t: 'n' }, ht: 2 } },
                        { r: 4, c: 4, v: { f: '=C5-D5', v: 650000, m: '₹650,000', ct: { fa: '₹#,##0', t: 'n' }, bl: 1, ht: 2 } },
                        { r: 4, c: 5, v: { f: '=D5/C5', v: 0.855, m: '85.6%', ct: { fa: '0.0%', t: 'n' }, ht: 2 } },
                        { r: 4, c: 6, v: { v: 'On Track - Steel order delivered', m: 'On Track - Steel order delivered' } },

                        { r: 5, c: 0, v: { v: 'LAB-200', m: 'LAB-200', ht: 1 } },
                        { r: 5, c: 1, v: { v: 'Direct Labor & Site Workforce', m: 'Direct Labor & Site Workforce' } },
                        { r: 5, c: 2, v: { v: 1800000, m: '₹1,800,000', ct: { fa: '₹#,##0', t: 'n' }, ht: 2 } },
                        { r: 5, c: 3, v: { v: 1620000, m: '₹1,620,000', ct: { fa: '₹#,##0', t: 'n' }, ht: 2 } },
                        { r: 5, c: 4, v: { f: '=C6-D6', v: 180000, m: '₹180,000', ct: { fa: '₹#,##0', t: 'n' }, bl: 1, ht: 2 } },
                        { r: 5, c: 5, v: { f: '=D6/C6', v: 0.9, m: '90.0%', ct: { fa: '0.0%', t: 'n' }, ht: 2 } },
                        { r: 5, c: 6, v: { v: 'Bi-weekly wage disbursements', m: 'Bi-weekly wage disbursements' } },

                        { r: 6, c: 0, v: { v: 'P&E-300', m: 'P&E-300', ht: 1 } },
                        { r: 6, c: 1, v: { v: 'Plant & Heavy Equipment Rentals (Excavator, Crane, RMC)', m: 'Plant & Heavy Equipment Rentals (Excavator, Crane, RMC)' } },
                        { r: 6, c: 2, v: { v: 1200000, m: '₹1,200,000', ct: { fa: '₹#,##0', t: 'n' }, ht: 2 } },
                        { r: 6, c: 3, v: { v: 980000, m: '₹980,000', ct: { fa: '₹#,##0', t: 'n' }, ht: 2 } },
                        { r: 6, c: 4, v: { f: '=C7-D7', v: 220000, m: '₹220,000', ct: { fa: '₹#,##0', t: 'n' }, bl: 1, ht: 2 } },
                        { r: 6, c: 5, v: { f: '=D7/C7', v: 0.816, m: '81.7%', ct: { fa: '0.0%', t: 'n' }, ht: 2 } },
                        { r: 6, c: 6, v: { v: 'Crane demobilized after slab 3', m: 'Crane demobilized after slab 3' } },

                        { r: 7, c: 0, v: { v: 'SUB-400', m: 'SUB-400', ht: 1 } },
                        { r: 7, c: 1, v: { v: 'Specialized Subcontractors (HVAC, Electrical, Plumbing)', m: 'Specialized Subcontractors (HVAC, Electrical, Plumbing)' } },
                        { r: 7, c: 2, v: { v: 2400000, m: '₹2,400,000', ct: { fa: '₹#,##0', t: 'n' }, ht: 2 } },
                        { r: 7, c: 3, v: { v: 1750000, m: '₹1,750,000', ct: { fa: '₹#,##0', t: 'n' }, ht: 2 } },
                        { r: 7, c: 4, v: { f: '=C8-D8', v: 650000, m: '₹650,000', ct: { fa: '₹#,##0', t: 'n' }, bl: 1, ht: 2 } },
                        { r: 7, c: 5, v: { f: '=D8/C8', v: 0.729, m: '72.9%', ct: { fa: '0.0%', t: 'n' }, ht: 2 } },
                        { r: 7, c: 6, v: { v: 'Milestone 2 pending signoff', m: 'Milestone 2 pending signoff' } },

                        { r: 8, c: 0, v: { v: 'OVH-500', m: 'OVH-500', ht: 1 } },
                        { r: 8, c: 1, v: { v: 'Site Overheads & Supervision', m: 'Site Overheads & Supervision' } },
                        { r: 8, c: 2, v: { v: 600000, m: '₹600,000', ct: { fa: '₹#,##0', t: 'n' }, ht: 2 } },
                        { r: 8, c: 3, v: { v: 490000, m: '₹490,000', ct: { fa: '₹#,##0', t: 'n' }, ht: 2 } },
                        { r: 8, c: 4, v: { f: '=C9-D9', v: 110000, m: '₹110,000', ct: { fa: '₹#,##0', t: 'n' }, bl: 1, ht: 2 } },
                        { r: 8, c: 5, v: { f: '=D9/C9', v: 0.817, m: '81.7%', ct: { fa: '0.0%', t: 'n' }, ht: 2 } },
                        { r: 8, c: 6, v: { v: 'Site electricity & testing fees', m: 'Site electricity & testing fees' } },

                        // Total Budget
                        { r: 10, c: 1, v: { v: 'TOTAL PROJECT BUDGET', m: 'TOTAL PROJECT BUDGET', bl: 1, fs: 11, fc: '#065f46', bg: '#a7f3d0', ht: 2 } },
                        { r: 10, c: 2, v: { f: '=SUM(C5:C9)', v: 10500000, m: '₹10,500,000', ct: { fa: '₹#,##0', t: 'n' }, bl: 1, fs: 11, bg: '#a7f3d0', ht: 2 } },
                        { r: 10, c: 3, v: { f: '=SUM(D5:D9)', v: 8690000, m: '₹8,690,000', ct: { fa: '₹#,##0', t: 'n' }, bl: 1, fs: 11, bg: '#a7f3d0', ht: 2 } },
                        { r: 10, c: 4, v: { f: '=SUM(E5:E9)', v: 1810000, m: '₹1,810,000', ct: { fa: '₹#,##0', t: 'n' }, bl: 1, fs: 11, bg: '#a7f3d0', ht: 2 } },
                        { r: 10, c: 5, v: { f: '=D11/C11', v: 0.828, m: '82.8%', ct: { fa: '0.0%', t: 'n' }, bl: 1, fs: 11, bg: '#a7f3d0', ht: 2 } },
                        { r: 10, c: 6, v: { v: 'Healthy Variance Remaining', m: 'Healthy Variance Remaining', bl: 1, fs: 10, bg: '#a7f3d0' } }
                    ]
                }
            ]
        },
        {
            id: 'material_takeoff',
            name: 'Material Takeoff & Procurement Tracker',
            description: 'Bill of materials, spec tracking, required quantities, purchase order status, and vendor assignment.',
            icon: 'Package',
            badge: 'Procurement',
            badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
            sheets: [
                {
                    name: 'Material Takeoff',
                    id: 'sheet_materials',
                    status: 1,
                    order: 0,
                    row: 50,
                    column: 20,
                    config: {
                        columnlen: {
                            0: 95,
                            1: 240,
                            2: 190,
                            3: 85,
                            4: 110,
                            5: 120,
                            6: 140,
                            7: 160,
                            8: 120
                        },
                        rowlen: {
                            0: 36,
                            1: 26,
                            3: 30
                        },
                        merge: {
                            "0_0": { r: 0, c: 0, rs: 1, cs: 9 },
                            "1_0": { r: 1, c: 0, rs: 1, cs: 9 }
                        }
                    },
                    celldata: [
                        { r: 0, c: 0, v: { v: 'MATERIAL TAKEOFF & PROCUREMENT LOG', m: 'MATERIAL TAKEOFF & PROCUREMENT LOG', bl: 1, fs: 14, fc: '#78350f', bg: '#fef3c7', ht: 1, vt: 1 } },
                        { r: 1, c: 0, v: { v: `Project: ${projectName} (${projectCode}) | Date: ${today}`, m: `Project: ${projectName} (${projectCode}) | Date: ${today}`, bl: 1, fs: 10, fc: '#475569', bg: '#f1f5f9', ht: 1, vt: 1 } },

                        { r: 3, c: 0, v: { v: 'Material Code', m: 'Material Code', bl: 1, fc: '#ffffff', bg: '#d97706', ht: 1, vt: 1 } },
                        { r: 3, c: 1, v: { v: 'Material Description', m: 'Material Description', bl: 1, fc: '#ffffff', bg: '#d97706', ht: 0, vt: 1 } },
                        { r: 3, c: 2, v: { v: 'Specification / Grade', m: 'Specification / Grade', bl: 1, fc: '#ffffff', bg: '#d97706', ht: 0, vt: 1 } },
                        { r: 3, c: 3, v: { v: 'Unit', m: 'Unit', bl: 1, fc: '#ffffff', bg: '#d97706', ht: 1, vt: 1 } },
                        { r: 3, c: 4, v: { v: 'Takeoff Qty', m: 'Takeoff Qty', bl: 1, fc: '#ffffff', bg: '#d97706', ht: 2, vt: 1 } },
                        { r: 3, c: 5, v: { v: 'Unit Rate (₹)', m: 'Unit Rate (₹)', bl: 1, fc: '#ffffff', bg: '#d97706', ht: 2, vt: 1 } },
                        { r: 3, c: 6, v: { v: 'Estimated Cost (₹)', m: 'Estimated Cost (₹)', bl: 1, fc: '#ffffff', bg: '#d97706', ht: 2, vt: 1 } },
                        { r: 3, c: 7, v: { v: 'Assigned Vendor', m: 'Assigned Vendor', bl: 1, fc: '#ffffff', bg: '#d97706', ht: 0, vt: 1 } },
                        { r: 3, c: 8, v: { v: 'PO Status', m: 'PO Status', bl: 1, fc: '#ffffff', bg: '#d97706', ht: 1, vt: 1 } },

                        { r: 4, c: 0, v: { v: 'M-CEM-01', m: 'M-CEM-01', ht: 1 } },
                        { r: 4, c: 1, v: { v: 'OPC 53 Grade Cement', m: 'OPC 53 Grade Cement' } },
                        { r: 4, c: 2, v: { v: 'IS 12269 certified 50kg bags', m: 'IS 12269 certified 50kg bags' } },
                        { r: 4, c: 3, v: { v: 'Bags', m: 'Bags', ht: 1 } },
                        { r: 4, c: 4, v: { v: 3400, m: '3,400', ct: { fa: '#,##0', t: 'n' }, ht: 2 } },
                        { r: 4, c: 5, v: { v: 390, m: '₹390', ct: { fa: '₹#,##0', t: 'n' }, ht: 2 } },
                        { r: 4, c: 6, v: { f: '=E5*F5', v: 1326000, m: '₹1,326,000', ct: { fa: '₹#,##0', t: 'n' }, bl: 1, ht: 2 } },
                        { r: 4, c: 7, v: { v: 'UltraTech Cement Ltd', m: 'UltraTech Cement Ltd' } },
                        { r: 4, c: 8, v: { v: 'Delivered', m: 'Delivered', bl: 1, fc: '#15803d', ht: 1 } },

                        { r: 5, c: 0, v: { v: 'M-STL-02', m: 'M-STL-02', ht: 1 } },
                        { r: 5, c: 1, v: { v: 'TMT Reinforcement Bars', m: 'TMT Reinforcement Bars' } },
                        { r: 5, c: 2, v: { v: 'Fe550D (8mm to 32mm)', m: 'Fe550D (8mm to 32mm)' } },
                        { r: 5, c: 3, v: { v: 'MT', m: 'MT', ht: 1 } },
                        { r: 5, c: 4, v: { v: 45, m: '45.0', ct: { fa: '#,##0.0', t: 'n' }, ht: 2 } },
                        { r: 5, c: 5, v: { v: 64500, m: '₹64,500', ct: { fa: '₹#,##0', t: 'n' }, ht: 2 } },
                        { r: 5, c: 6, v: { f: '=E6*F6', v: 2902500, m: '₹2,902,500', ct: { fa: '₹#,##0', t: 'n' }, bl: 1, ht: 2 } },
                        { r: 5, c: 7, v: { v: 'Tata Tiscon Steel', m: 'Tata Tiscon Steel' } },
                        { r: 5, c: 8, v: { v: 'In Transit', m: 'In Transit', bl: 1, fc: '#ca8a04', ht: 1 } },

                        { r: 6, c: 0, v: { v: 'M-SND-03', m: 'M-SND-03', ht: 1 } },
                        { r: 6, c: 1, v: { v: 'Manufactured Sand (M-Sand)', m: 'Manufactured Sand (M-Sand)' } },
                        { r: 6, c: 2, v: { v: 'Zone II washed plaster sand', m: 'Zone II washed plaster sand' } },
                        { r: 6, c: 3, v: { v: 'CFT', m: 'CFT', ht: 1 } },
                        { r: 6, c: 4, v: { v: 8500, m: '8,500', ct: { fa: '#,##0', t: 'n' }, ht: 2 } },
                        { r: 6, c: 5, v: { v: 65, m: '₹65', ct: { fa: '₹#,##0', t: 'n' }, ht: 2 } },
                        { r: 6, c: 6, v: { f: '=E7*F7', v: 552500, m: '₹552,500', ct: { fa: '₹#,##0', t: 'n' }, bl: 1, ht: 2 } },
                        { r: 6, c: 7, v: { v: 'Kaveri Aggregates', m: 'Kaveri Aggregates' } },
                        { r: 6, c: 8, v: { v: 'Active PO', m: 'Active PO', bl: 1, fc: '#2563eb', ht: 1 } },

                        { r: 8, c: 1, v: { v: 'TOTAL ESTIMATED PROCUREMENT COST', m: 'TOTAL ESTIMATED PROCUREMENT COST', bl: 1, fc: '#78350f', bg: '#fde68a', ht: 2 } },
                        { r: 8, c: 6, v: { f: '=SUM(G5:G7)', v: 4781000, m: '₹4,781,000', ct: { fa: '₹#,##0', t: 'n' }, bl: 1, fs: 11, fc: '#78350f', bg: '#fde68a', ht: 2 } }
                    ]
                }
            ]
        },
        {
            id: 'dpr_log',
            name: 'Daily Progress Report (DPR) Log',
            description: 'Site daily progress tracking, execution targets vs achievements, manpower, weather, and delays tracker.',
            icon: 'ClipboardList',
            badge: 'Site Ops',
            badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
            sheets: [
                {
                    name: 'DPR Execution Log',
                    id: 'sheet_dpr',
                    status: 1,
                    order: 0,
                    row: 45,
                    column: 20,
                    config: {
                        columnlen: {
                            0: 105,
                            1: 170,
                            2: 260,
                            3: 85,
                            4: 105,
                            5: 115,
                            6: 125,
                            7: 105,
                            8: 200
                        },
                        rowlen: {
                            0: 36,
                            1: 26,
                            3: 30
                        },
                        merge: {
                            "0_0": { r: 0, c: 0, rs: 1, cs: 9 },
                            "1_0": { r: 1, c: 0, rs: 1, cs: 9 }
                        }
                    },
                    celldata: [
                        { r: 0, c: 0, v: { v: 'DAILY PROGRESS REPORT (DPR) EXECUTION LOG', m: 'DAILY PROGRESS REPORT (DPR) EXECUTION LOG', bl: 1, fs: 14, fc: '#581c87', bg: '#f3e8ff', ht: 1, vt: 1 } },
                        { r: 1, c: 0, v: { v: `Project: ${projectName} | Code: ${projectCode} | Current Date: ${today}`, m: `Project: ${projectName} | Code: ${projectCode} | Current Date: ${today}`, bl: 1, fs: 10, fc: '#475569', bg: '#f1f5f9', ht: 1, vt: 1 } },

                        { r: 3, c: 0, v: { v: 'Date', m: 'Date', bl: 1, fc: '#ffffff', bg: '#7e22ce', ht: 1, vt: 1 } },
                        { r: 3, c: 1, v: { v: 'Location / Grid', m: 'Location / Grid', bl: 1, fc: '#ffffff', bg: '#7e22ce', ht: 0, vt: 1 } },
                        { r: 3, c: 2, v: { v: 'Activity Description', m: 'Activity Description', bl: 1, fc: '#ffffff', bg: '#7e22ce', ht: 0, vt: 1 } },
                        { r: 3, c: 3, v: { v: 'Unit', m: 'Unit', bl: 1, fc: '#ffffff', bg: '#7e22ce', ht: 1, vt: 1 } },
                        { r: 3, c: 4, v: { v: 'Target Qty', m: 'Target Qty', bl: 1, fc: '#ffffff', bg: '#7e22ce', ht: 2, vt: 1 } },
                        { r: 3, c: 5, v: { v: 'Executed Today', m: 'Executed Today', bl: 1, fc: '#ffffff', bg: '#7e22ce', ht: 2, vt: 1 } },
                        { r: 3, c: 6, v: { v: 'Cumulative Qty', m: 'Cumulative Qty', bl: 1, fc: '#ffffff', bg: '#7e22ce', ht: 2, vt: 1 } },
                        { r: 3, c: 7, v: { v: '% Completion', m: '% Completion', bl: 1, fc: '#ffffff', bg: '#7e22ce', ht: 2, vt: 1 } },
                        { r: 3, c: 8, v: { v: 'Weather / Site Remarks', m: 'Weather / Site Remarks', bl: 1, fc: '#ffffff', bg: '#7e22ce', ht: 0, vt: 1 } },

                        { r: 4, c: 0, v: { v: today, m: today, ht: 1 } },
                        { r: 4, c: 1, v: { v: 'Tower A - 3rd Floor', m: 'Tower A - 3rd Floor' } },
                        { r: 4, c: 2, v: { v: 'Slab RCC M25 Concreting Pour', m: 'Slab RCC M25 Concreting Pour' } },
                        { r: 4, c: 3, v: { v: 'CUM', m: 'CUM', ht: 1 } },
                        { r: 4, c: 4, v: { v: 65, m: '65', ct: { fa: '#,##0', t: 'n' }, ht: 2 } },
                        { r: 4, c: 5, v: { v: 60, m: '60', ct: { fa: '#,##0', t: 'n' }, ht: 2 } },
                        { r: 4, c: 6, v: { v: 180, m: '180', ct: { fa: '#,##0', t: 'n' }, bl: 1, ht: 2 } },
                        { r: 4, c: 7, v: { f: '=F5/E5', v: 0.923, m: '92.3%', ct: { fa: '0.0%', t: 'n' }, bl: 1, ht: 2 } },
                        { r: 4, c: 8, v: { v: 'Clear skies. RMC transit delay of 40 mins.', m: 'Clear skies. RMC transit delay of 40 mins.' } },

                        { r: 5, c: 0, v: { v: today, m: today, ht: 1 } },
                        { r: 5, c: 1, v: { v: 'Tower B - 1st Floor', m: 'Tower B - 1st Floor' } },
                        { r: 5, c: 2, v: { v: 'AAC Block Masonry 200mm thick', m: 'AAC Block Masonry 200mm thick' } },
                        { r: 5, c: 3, v: { v: 'SQM', m: 'SQM', ht: 1 } },
                        { r: 5, c: 4, v: { v: 120, m: '120', ct: { fa: '#,##0', t: 'n' }, ht: 2 } },
                        { r: 5, c: 5, v: { v: 115, m: '115', ct: { fa: '#,##0', t: 'n' }, ht: 2 } },
                        { r: 5, c: 6, v: { v: 350, m: '350', ct: { fa: '#,##0', t: 'n' }, bl: 1, ht: 2 } },
                        { r: 5, c: 7, v: { f: '=F6/E6', v: 0.958, m: '95.8%', ct: { fa: '0.0%', t: 'n' }, bl: 1, ht: 2 } },
                        { r: 5, c: 8, v: { v: '6 Masons + 8 Helpers active.', m: '6 Masons + 8 Helpers active.' } }
                    ]
                }
            ]
        },
        {
            id: 'subcontractor_billing',
            name: 'Subcontractor RA Bill & Payment Certificate',
            description: 'Measurement sheet tracking, previous vs current quantities, retention deductions, GST, and net payable.',
            icon: 'FileText',
            badge: 'Billing',
            badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
            sheets: [
                {
                    name: 'RA Bill Certificate',
                    id: 'sheet_rabill',
                    status: 1,
                    order: 0,
                    row: 45,
                    column: 20,
                    config: {
                        columnlen: {
                            0: 85,
                            1: 260,
                            2: 75,
                            3: 100,
                            4: 100,
                            5: 105,
                            6: 115,
                            7: 135,
                            8: 150
                        },
                        rowlen: {
                            0: 36,
                            1: 26,
                            3: 30
                        },
                        merge: {
                            "0_0": { r: 0, c: 0, rs: 1, cs: 9 },
                            "1_0": { r: 1, c: 0, rs: 1, cs: 9 }
                        }
                    },
                    celldata: [
                        { r: 0, c: 0, v: { v: 'SUBCONTRACTOR RUNNING ACCOUNT (RA) BILL CERTIFICATE', m: 'SUBCONTRACTOR RUNNING ACCOUNT (RA) BILL CERTIFICATE', bl: 1, fs: 14, fc: '#312e81', bg: '#e0e7ff', ht: 1, vt: 1 } },
                        { r: 1, c: 0, v: { v: `Project: ${projectName} (${projectCode}) | Subcontractor: Apex MEP Works | Bill No: RA-04 | Date: ${today}`, m: `Project: ${projectName} (${projectCode}) | Subcontractor: Apex MEP Works | Bill No: RA-04 | Date: ${today}`, bl: 1, fs: 10, fc: '#475569', bg: '#f1f5f9', ht: 1, vt: 1 } },

                        { r: 3, c: 0, v: { v: 'Item No.', m: 'Item No.', bl: 1, fc: '#ffffff', bg: '#4f46e5', ht: 1, vt: 1 } },
                        { r: 3, c: 1, v: { v: 'Description of Work Item', m: 'Description of Work Item', bl: 1, fc: '#ffffff', bg: '#4f46e5', ht: 0, vt: 1 } },
                        { r: 3, c: 2, v: { v: 'Unit', m: 'Unit', bl: 1, fc: '#ffffff', bg: '#4f46e5', ht: 1, vt: 1 } },
                        { r: 3, c: 3, v: { v: 'Agreed Qty', m: 'Agreed Qty', bl: 1, fc: '#ffffff', bg: '#4f46e5', ht: 2, vt: 1 } },
                        { r: 3, c: 4, v: { v: 'Previous Qty', m: 'Previous Qty', bl: 1, fc: '#ffffff', bg: '#4f46e5', ht: 2, vt: 1 } },
                        { r: 3, c: 5, v: { v: 'This Bill Qty', m: 'This Bill Qty', bl: 1, fc: '#ffffff', bg: '#4f46e5', ht: 2, vt: 1 } },
                        { r: 3, c: 6, v: { v: 'Rate (₹)', m: 'Rate (₹)', bl: 1, fc: '#ffffff', bg: '#4f46e5', ht: 2, vt: 1 } },
                        { r: 3, c: 7, v: { v: 'This Bill Amt (₹)', m: 'This Bill Amt (₹)', bl: 1, fc: '#ffffff', bg: '#4f46e5', ht: 2, vt: 1 } },
                        { r: 3, c: 8, v: { v: 'Cumulative Amt (₹)', m: 'Cumulative Amt (₹)', bl: 1, fc: '#ffffff', bg: '#4f46e5', ht: 2, vt: 1 } },

                        { r: 4, c: 0, v: { v: 'E-01', m: 'E-01', ht: 1 } },
                        { r: 4, c: 1, v: { v: 'Conduit laying & wiring in ceiling slab (FRLS 2.5 sqmm)', m: 'Conduit laying & wiring in ceiling slab (FRLS 2.5 sqmm)' } },
                        { r: 4, c: 2, v: { v: 'RMT', m: 'RMT', ht: 1 } },
                        { r: 4, c: 3, v: { v: 4500, m: '4,500', ct: { fa: '#,##0', t: 'n' }, ht: 2 } },
                        { r: 4, c: 4, v: { v: 2200, m: '2,200', ct: { fa: '#,##0', t: 'n' }, ht: 2 } },
                        { r: 4, c: 5, v: { v: 850, m: '850', ct: { fa: '#,##0', t: 'n' }, ht: 2 } },
                        { r: 4, c: 6, v: { v: 140, m: '₹140.00', ct: { fa: '₹#,##0.00', t: 'n' }, ht: 2 } },
                        { r: 4, c: 7, v: { f: '=F5*G5', v: 119000, m: '₹119,000.00', ct: { fa: '₹#,##0.00', t: 'n' }, bl: 1, ht: 2 } },
                        { r: 4, c: 8, v: { f: '=(E5+F5)*G5', v: 427000, m: '₹427,000.00', ct: { fa: '₹#,##0.00', t: 'n' }, ht: 2 } },

                        { r: 5, c: 0, v: { v: 'P-02', m: 'P-02', ht: 1 } },
                        { r: 5, c: 1, v: { v: 'CPVC Internal waterline plumbing piping 25mm dia', m: 'CPVC Internal waterline plumbing piping 25mm dia' } },
                        { r: 5, c: 2, v: { v: 'RMT', m: 'RMT', ht: 1 } },
                        { r: 5, c: 3, v: { v: 1800, m: '1,800', ct: { fa: '#,##0', t: 'n' }, ht: 2 } },
                        { r: 5, c: 4, v: { v: 900, m: '900', ct: { fa: '#,##0', t: 'n' }, ht: 2 } },
                        { r: 5, c: 5, v: { v: 420, m: '420', ct: { fa: '#,##0', t: 'n' }, ht: 2 } },
                        { r: 5, c: 6, v: { v: 260, m: '₹260.00', ct: { fa: '₹#,##0.00', t: 'n' }, ht: 2 } },
                        { r: 5, c: 7, v: { f: '=F6*G6', v: 109200, m: '₹109,200.00', ct: { fa: '₹#,##0.00', t: 'n' }, bl: 1, ht: 2 } },
                        { r: 5, c: 8, v: { f: '=(E6+F6)*G6', v: 343200, m: '₹343,200.00', ct: { fa: '₹#,##0.00', t: 'n' }, ht: 2 } },

                        // Totals & Deductions
                        { r: 7, c: 1, v: { v: 'GROSS BILL AMOUNT (THIS RA BILL)', m: 'GROSS BILL AMOUNT (THIS RA BILL)', bl: 1, fc: '#312e81', bg: '#e0e7ff', ht: 2 } },
                        { r: 7, c: 7, v: { f: '=SUM(H5:H6)', v: 228200, m: '₹228,200.00', ct: { fa: '₹#,##0.00', t: 'n' }, bl: 1, bg: '#e0e7ff', ht: 2 } },

                        { r: 8, c: 1, v: { v: 'Less: Retention Money (5%)', m: 'Less: Retention Money (5%)', bl: 1, fc: '#b91c1c', ht: 2 } },
                        { r: 8, c: 7, v: { f: '=-H8*0.05', v: -11410, m: '-₹11,410.00', ct: { fa: '₹#,##0.00', t: 'n' }, bl: 1, fc: '#b91c1c', ht: 2 } },

                        { r: 9, c: 1, v: { v: 'Add: GST (18%)', m: 'Add: GST (18%)', bl: 1, ht: 2 } },
                        { r: 9, c: 7, v: { f: '=H8*0.18', v: 41076, m: '₹41,076.00', ct: { fa: '₹#,##0.00', t: 'n' }, bl: 1, ht: 2 } },

                        { r: 10, c: 1, v: { v: 'NET AMOUNT PAYABLE TO SUBCONTRACTOR', m: 'NET AMOUNT PAYABLE TO SUBCONTRACTOR', bl: 1, fs: 11, fc: '#312e81', bg: '#c7d2fe', ht: 2 } },
                        { r: 10, c: 7, v: { f: '=H8+H9+H10', v: 257866, m: '₹257,866.00', ct: { fa: '₹#,##0.00', t: 'n' }, bl: 1, fs: 11, fc: '#312e81', bg: '#c7d2fe', ht: 2 } }
                    ]
                }
            ]
        },
        {
            id: 'equipment_timesheet',
            name: 'Plant & Equipment Timesheet Tracker',
            description: 'Log heavy machinery working hours, idle time, diesel fuel consumption, operator signoff, and hiring charges.',
            icon: 'Grid',
            badge: 'Machinery',
            badgeColor: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
            sheets: [
                {
                    name: 'Equipment Timesheet',
                    id: 'sheet_equipment',
                    status: 1,
                    order: 0,
                    row: 45,
                    column: 20,
                    config: {
                        columnlen: {
                            0: 95,
                            1: 140,
                            2: 170,
                            3: 130,
                            4: 90,
                            5: 85,
                            6: 105,
                            7: 110,
                            8: 140
                        },
                        rowlen: {
                            0: 36,
                            1: 26,
                            3: 30
                        },
                        merge: {
                            "0_0": { r: 0, c: 0, rs: 1, cs: 9 },
                            "1_0": { r: 1, c: 0, rs: 1, cs: 9 }
                        }
                    },
                    celldata: [
                        { r: 0, c: 0, v: { v: 'PLANT & MACHINERY UTILIZATION LOG', m: 'PLANT & MACHINERY UTILIZATION LOG', bl: 1, fs: 14, fc: '#115e59', bg: '#ccfbf1', ht: 1, vt: 1 } },
                        { r: 1, c: 0, v: { v: `Project: ${projectName} (${projectCode}) | Log Date: ${today}`, m: `Project: ${projectName} (${projectCode}) | Log Date: ${today}`, bl: 1, fs: 10, fc: '#475569', bg: '#f1f5f9', ht: 1, vt: 1 } },

                        { r: 3, c: 0, v: { v: 'Asset ID', m: 'Asset ID', bl: 1, fc: '#ffffff', bg: '#0d9488', ht: 1, vt: 1 } },
                        { r: 3, c: 1, v: { v: 'Equipment Type', m: 'Equipment Type', bl: 1, fc: '#ffffff', bg: '#0d9488', ht: 0, vt: 1 } },
                        { r: 3, c: 2, v: { v: 'Make / Model / Reg No', m: 'Make / Model / Reg No', bl: 1, fc: '#ffffff', bg: '#0d9488', ht: 0, vt: 1 } },
                        { r: 3, c: 3, v: { v: 'Operator Name', m: 'Operator Name', bl: 1, fc: '#ffffff', bg: '#0d9488', ht: 0, vt: 1 } },
                        { r: 3, c: 4, v: { v: 'Work Hrs', m: 'Work Hrs', bl: 1, fc: '#ffffff', bg: '#0d9488', ht: 2, vt: 1 } },
                        { r: 3, c: 5, v: { v: 'Idle Hrs', m: 'Idle Hrs', bl: 1, fc: '#ffffff', bg: '#0d9488', ht: 2, vt: 1 } },
                        { r: 3, c: 6, v: { v: 'Diesel (Ltrs)', m: 'Diesel (Ltrs)', bl: 1, fc: '#ffffff', bg: '#0d9488', ht: 2, vt: 1 } },
                        { r: 3, c: 7, v: { v: 'Hire Rate/Hr (₹)', m: 'Hire Rate/Hr (₹)', bl: 1, fc: '#ffffff', bg: '#0d9488', ht: 2, vt: 1 } },
                        { r: 3, c: 8, v: { v: 'Total Cost (₹)', m: 'Total Cost (₹)', bl: 1, fc: '#ffffff', bg: '#0d9488', ht: 2, vt: 1 } },

                        { r: 4, c: 0, v: { v: 'EQ-EXC-01', m: 'EQ-EXC-01', ht: 1 } },
                        { r: 4, c: 1, v: { v: 'Hydraulic Excavator', m: 'Hydraulic Excavator' } },
                        { r: 4, c: 2, v: { v: 'JCB 205NHD (KA-04-E-1234)', m: 'JCB 205NHD (KA-04-E-1234)' } },
                        { r: 4, c: 3, v: { v: 'Ramesh Kumar', m: 'Ramesh Kumar' } },
                        { r: 4, c: 4, v: { v: 7.5, m: '7.5', ct: { fa: '0.0', t: 'n' }, ht: 2 } },
                        { r: 4, c: 5, v: { v: 0.5, m: '0.5', ct: { fa: '0.0', t: 'n' }, ht: 2 } },
                        { r: 4, c: 6, v: { v: 65, m: '65', ct: { fa: '#,##0', t: 'n' }, ht: 2 } },
                        { r: 4, c: 7, v: { v: 1850, m: '₹1,850', ct: { fa: '₹#,##0', t: 'n' }, ht: 2 } },
                        { r: 4, c: 8, v: { f: '=E5*H5', v: 13875, m: '₹13,875', ct: { fa: '₹#,##0', t: 'n' }, bl: 1, ht: 2 } },

                        { r: 5, c: 0, v: { v: 'EQ-TM-02', m: 'EQ-TM-02', ht: 1 } },
                        { r: 5, c: 1, v: { v: 'Transit Concrete Mixer', m: 'Transit Concrete Mixer' } },
                        { r: 5, c: 2, v: { v: 'Tata 2518 (KA-04-T-8899)', m: 'Tata 2518 (KA-04-T-8899)' } },
                        { r: 5, c: 3, v: { v: 'Sunil Gowda', m: 'Sunil Gowda' } },
                        { r: 5, c: 4, v: { v: 6.0, m: '6.0', ct: { fa: '0.0', t: 'n' }, ht: 2 } },
                        { r: 5, c: 5, v: { v: 1.0, m: '1.0', ct: { fa: '0.0', t: 'n' }, ht: 2 } },
                        { r: 5, c: 6, v: { v: 45, m: '45', ct: { fa: '#,##0', t: 'n' }, ht: 2 } },
                        { r: 5, c: 7, v: { v: 1400, m: '₹1,400', ct: { fa: '₹#,##0', t: 'n' }, ht: 2 } },
                        { r: 5, c: 8, v: { f: '=E6*H6', v: 8400, m: '₹8,400', ct: { fa: '₹#,##0', t: 'n' }, bl: 1, ht: 2 } },

                        // Totals
                        { r: 7, c: 1, v: { v: 'TOTAL MACHINERY CHARGES TODAY', m: 'TOTAL MACHINERY CHARGES TODAY', bl: 1, fc: '#115e59', bg: '#99f6e4', ht: 2 } },
                        { r: 7, c: 4, v: { f: '=SUM(E5:E6)', v: 13.5, m: '13.5 hrs', ct: { fa: '0.0', t: 'n' }, bl: 1, bg: '#99f6e4', ht: 2 } },
                        { r: 7, c: 6, v: { f: '=SUM(G5:G6)', v: 110, m: '110 L', ct: { fa: '#,##0', t: 'n' }, bl: 1, bg: '#99f6e4', ht: 2 } },
                        { r: 7, c: 8, v: { f: '=SUM(I5:I6)', v: 22275, m: '₹22,275', ct: { fa: '₹#,##0', t: 'n' }, bl: 1, fs: 11, bg: '#99f6e4', ht: 2 } }
                    ]
                }
            ]
        }
    ];
};

/**
 * Exports FortuneSheet data to an Excel (.xlsx) file using SheetJS (xlsx)
 */
export const exportToXLSX = (sheets, fileName = 'Spreadsheet.xlsx') => {
    try {
        if (!sheets || !Array.isArray(sheets) || sheets.length === 0) {
            throw new Error('No sheet data available to export');
        }

        const wb = XLSX.utils.book_new();

        sheets.forEach((sheet, idx) => {
            const sheetName = (sheet.name || `Sheet${idx + 1}`).substring(0, 31).replace(/[:\/\\?*\[\]]/g, '_');
            const dataMatrix = [];

            // If celldata exists (FortuneSheet standard storage)
            if (Array.isArray(sheet.celldata) && sheet.celldata.length > 0) {
                let maxR = 0;
                let maxC = 0;

                sheet.celldata.forEach(cellObj => {
                    if (cellObj && typeof cellObj.r === 'number' && typeof cellObj.c === 'number') {
                        if (cellObj.r > maxR) maxR = cellObj.r;
                        if (cellObj.c > maxC) maxC = cellObj.c;
                    }
                });

                // Initialize empty 2D matrix
                for (let r = 0; r <= Math.max(maxR, 20); r++) {
                    const rowArr = [];
                    for (let c = 0; c <= Math.max(maxC, 10); c++) {
                        rowArr.push('');
                    }
                    dataMatrix.push(rowArr);
                }

                // Populate with values and formulas
                sheet.celldata.forEach(cellObj => {
                    if (cellObj && typeof cellObj.r === 'number' && typeof cellObj.c === 'number' && cellObj.v) {
                        const val = cellObj.v;
                        if (val.f) {
                            // Formula
                            dataMatrix[cellObj.r][cellObj.c] = val.v !== undefined ? val.v : '';
                        } else if (val.v !== undefined && val.v !== null) {
                            dataMatrix[cellObj.r][cellObj.c] = val.v;
                        } else if (val.m !== undefined) {
                            dataMatrix[cellObj.r][cellObj.c] = val.m;
                        }
                    }
                });
            } else if (Array.isArray(sheet.data) && sheet.data.length > 0) {
                // If 2D matrix already
                sheet.data.forEach(row => {
                    const rowArr = [];
                    (row || []).forEach(cell => {
                        if (cell && typeof cell === 'object') {
                            rowArr.push(cell.v !== undefined && cell.v !== null ? cell.v : (cell.m || ''));
                        } else {
                            rowArr.push(cell !== undefined && cell !== null ? cell : '');
                        }
                    });
                    dataMatrix.push(rowArr);
                });
            } else {
                // Default empty grid
                dataMatrix.push(['']);
            }

            const ws = XLSX.utils.aoa_to_sheet(dataMatrix);

            // Handle column widths if defined
            if (sheet.config && sheet.config.columnlen) {
                const cols = [];
                Object.keys(sheet.config.columnlen).forEach(cIdx => {
                    const px = sheet.config.columnlen[cIdx];
                    cols[parseInt(cIdx, 10)] = { wch: Math.max(Math.round(px / 8), 8) };
                });
                ws['!cols'] = cols;
            }

            // Handle merged cells if defined
            if (sheet.config && sheet.config.merge) {
                const merges = [];
                Object.values(sheet.config.merge).forEach(m => {
                    if (m && typeof m.r === 'number' && typeof m.c === 'number' && m.rs && m.cs) {
                        merges.push({
                            s: { r: m.r, c: m.c },
                            e: { r: m.r + m.rs - 1, c: m.c + m.cs - 1 }
                        });
                    }
                });
                if (merges.length > 0) {
                    ws['!merges'] = merges;
                }
            }

            // Handle formulas from celldata
            if (Array.isArray(sheet.celldata)) {
                sheet.celldata.forEach(cellObj => {
                    if (cellObj && cellObj.v && cellObj.v.f) {
                        const cellRef = XLSX.utils.encode_cell({ r: cellObj.r, c: cellObj.c });
                        if (ws[cellRef]) {
                            const formula = String(cellObj.v.f).replace(/^=/, '');
                            ws[cellRef].f = formula;
                        }
                    }
                });
            } else if (Array.isArray(sheet.data)) {
                sheet.data.forEach((row, rIdx) => {
                    (row || []).forEach((cell, cIdx) => {
                        if (cell && typeof cell === 'object' && cell.f) {
                            const cellRef = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
                            if (ws[cellRef]) {
                                const formula = String(cell.f).replace(/^=/, '');
                                ws[cellRef].f = formula;
                            }
                        }
                    });
                });
            }

            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });

        const safeFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
        XLSX.writeFile(wb, safeFileName);
        return { success: true, fileName: safeFileName };
    } catch (err) {
        console.error('Failed to export to XLSX:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Exports active sheet to CSV format
 */
export const exportToCSV = (sheets, activeSheetIndex = 0, fileName = 'Spreadsheet.csv') => {
    try {
        if (!sheets || !Array.isArray(sheets) || sheets.length === 0) {
            throw new Error('No sheet data available to export');
        }

        const sheet = sheets[activeSheetIndex] || sheets[0];
        const dataMatrix = [];

        if (Array.isArray(sheet.celldata) && sheet.celldata.length > 0) {
            let maxR = 0;
            let maxC = 0;

            sheet.celldata.forEach(cellObj => {
                if (cellObj && typeof cellObj.r === 'number' && typeof cellObj.c === 'number') {
                    if (cellObj.r > maxR) maxR = cellObj.r;
                    if (cellObj.c > maxC) maxC = cellObj.c;
                }
            });

            for (let r = 0; r <= maxR; r++) {
                const rowArr = [];
                for (let c = 0; c <= maxC; c++) {
                    rowArr.push('');
                }
                dataMatrix.push(rowArr);
            }

            sheet.celldata.forEach(cellObj => {
                if (cellObj && typeof cellObj.r === 'number' && typeof cellObj.c === 'number' && cellObj.v) {
                    const val = cellObj.v;
                    dataMatrix[cellObj.r][cellObj.c] = val.m !== undefined ? val.m : (val.v !== undefined ? val.v : '');
                }
            });
        } else if (Array.isArray(sheet.data) && sheet.data.length > 0) {
            sheet.data.forEach(row => {
                const rowArr = [];
                (row || []).forEach(cell => {
                    if (cell && typeof cell === 'object') {
                        rowArr.push(cell.m !== undefined ? cell.m : (cell.v !== undefined ? cell.v : ''));
                    } else {
                        rowArr.push(cell !== undefined && cell !== null ? cell : '');
                    }
                });
                dataMatrix.push(rowArr);
            });
        }

        const ws = XLSX.utils.aoa_to_sheet(dataMatrix.length > 0 ? dataMatrix : [['']]);
        const csvContent = XLSX.utils.sheet_to_csv(ws);

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const safeFileName = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
        link.setAttribute('href', url);
        link.setAttribute('download', safeFileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        return { success: true, fileName: safeFileName };
    } catch (err) {
        console.error('Failed to export to CSV:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Imports an Excel (.xlsx, .xls) or CSV (.csv) file and converts it into FortuneSheet format
 * with intelligent column auto-fit, number/date formatting, and header styling.
 */
export const importFromFile = async (file) => {
    return new Promise((resolve, reject) => {
        try {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, {
                        type: 'array',
                        cellDates: true,
                        cellFormula: true,
                        cellStyles: true,
                        cellNF: true
                    });

                    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                        throw new Error('No sheets found in the uploaded workbook.');
                    }

                    const fortuneSheets = [];
                    const baseTimestamp = Date.now();

                    workbook.SheetNames.forEach((name, index) => {
                        const worksheet = workbook.Sheets[name];
                        if (!worksheet) return;

                        const range = worksheet['!ref']
                            ? XLSX.utils.decode_range(worksheet['!ref'])
                            : { s: { r: 0, c: 0 }, e: { r: 30, c: 15 } };

                        const celldata = [];
                        const colWidths = {};
                        const colMaxChars = {};
                        const rowHeights = {};
                        let maxR = Math.max(range.e.r, 0);
                        let maxC = Math.max(range.e.c, 0);

                        // Read all cells from worksheet keys
                        Object.keys(worksheet).forEach((cellRef) => {
                            if (cellRef.startsWith('!')) return;

                            try {
                                const { r, c } = XLSX.utils.decode_cell(cellRef);
                                if (r > maxR) maxR = r;
                                if (c > maxC) maxC = c;

                                const cell = worksheet[cellRef];
                                if (!cell) return;

                                const cellVal = {};

                                // Value & formatted representation
                                if (cell.v instanceof Date) {
                                    const dateStr = cell.w || cell.v.toISOString().split('T')[0];
                                    cellVal.v = dateStr;
                                    cellVal.m = dateStr;
                                    cellVal.ct = { fa: cell.z || 'yyyy-mm-dd', t: 'd' };
                                    cellVal.ht = 1; // Center align dates
                                } else if (cell.v !== undefined && cell.v !== null) {
                                    cellVal.v = cell.v;
                                    cellVal.m = cell.w !== undefined ? String(cell.w) : String(cell.v);
                                } else if (cell.w !== undefined) {
                                    cellVal.v = cell.w;
                                    cellVal.m = String(cell.w);
                                }

                                // Formulas
                                if (cell.f) {
                                    cellVal.f = String(cell.f).startsWith('=') ? String(cell.f) : `=${cell.f}`;
                                }

                                // Data Types & Alignment
                                if (cell.t === 'n') {
                                    const isInt = Number.isInteger(cell.v);
                                    if (cell.w && (cell.w.includes('₹') || cell.w.includes('$') || cell.w.includes('€') || cell.w.includes('£') || cell.w.includes('Rs.'))) {
                                        cellVal.ct = { fa: cell.z || '₹#,##0.00', t: 'n' };
                                    } else if (cell.w && cell.w.includes('%')) {
                                        cellVal.ct = { fa: cell.z || '0.00%', t: 'n' };
                                    } else if (cell.z) {
                                        cellVal.ct = { fa: cell.z, t: 'n' };
                                    } else {
                                        cellVal.ct = { fa: isInt ? '#,##0' : '#,##0.00', t: 'n' };
                                    }
                                    cellVal.ht = 2; // Right align numbers
                                } else if (cell.t === 'b') {
                                    cellVal.ct = { fa: 'General', t: 'b' };
                                    cellVal.ht = 1;
                                } else if (cell.t === 's' && !cellVal.ct) {
                                    cellVal.ct = { fa: '@', t: 's' };
                                }

                                // Style extraction if present (bold, font color, background)
                                if (cell.s) {
                                    if (cell.s.font?.bold) cellVal.bl = 1;
                                    if (cell.s.font?.italic) cellVal.it = 1;
                                    if (cell.s.font?.sz) cellVal.fs = Math.round(cell.s.font.sz);
                                    if (cell.s.font?.color?.rgb) cellVal.fc = `#${cell.s.font.color.rgb.substring(0, 6)}`;
                                    if (cell.s.fill?.fgColor?.rgb) cellVal.bg = `#${cell.s.fill.fgColor.rgb.substring(0, 6)}`;
                                }

                                // Track text length for auto-fit column widths
                                const textLen = String(cellVal.m || cellVal.v || '').length;
                                colMaxChars[c] = Math.max(colMaxChars[c] || 0, textLen);

                                celldata.push({ r, c, v: cellVal });
                            } catch (cellErr) {
                                console.warn('Error reading cell ' + cellRef, cellErr);
                            }
                        });

                        // Calculate optimal auto-fit column widths
                        for (let c = 0; c <= maxC; c++) {
                            const maxChars = colMaxChars[c] || 10;
                            // Optimal character width calculation + padding
                            const calculatedWidth = Math.min(Math.max(Math.round(maxChars * 8.5 + 28), 90), 380);
                            colWidths[c] = calculatedWidth;
                        }

                        // Override with worksheet explicit column widths if defined
                        if (Array.isArray(worksheet['!cols'])) {
                            worksheet['!cols'].forEach((col, cIdx) => {
                                if (col && col.wch) {
                                    colWidths[cIdx] = Math.max(Math.round(col.wch * 8), 85);
                                } else if (col && col.wpx) {
                                    colWidths[cIdx] = Math.max(col.wpx, 85);
                                }
                            });
                        }

                        // Handle row heights if defined or default header row height
                        if (Array.isArray(worksheet['!rows'])) {
                            worksheet['!rows'].forEach((row, rIdx) => {
                                if (row && row.hpx) {
                                    rowHeights[rIdx] = Math.max(row.hpx, 24);
                                } else if (row && row.hpt) {
                                    rowHeights[rIdx] = Math.max(Math.round(row.hpt * 1.33), 24);
                                }
                            });
                        }
                        if (!rowHeights[0]) {
                            rowHeights[0] = 30; // Clean header height
                        }

                        // Merged cells
                        const mergeObj = {};
                        if (Array.isArray(worksheet['!merges'])) {
                            worksheet['!merges'].forEach(m => {
                                const rs = m.e.r - m.s.r + 1;
                                const cs = m.e.c - m.s.c + 1;
                                mergeObj[`${m.s.r}_${m.s.c}`] = {
                                    r: m.s.r,
                                    c: m.s.c,
                                    rs,
                                    cs
                                };
                            });
                        }

                        // Auto-style header row (r === 0) if it consists of text headers
                        celldata.forEach(cellItem => {
                            if (cellItem.r === 0 && cellItem.v && typeof cellItem.v.v === 'string' && cellItem.v.v.trim() !== '') {
                                if (!cellItem.v.bl) cellItem.v.bl = 1;
                                if (!cellItem.v.vt) cellItem.v.vt = 1;
                                if (!cellItem.v.bg && !worksheet['!merges']?.length) {
                                    cellItem.v.bg = '#f8fafc';
                                }
                            }
                        });

                        fortuneSheets.push({
                            name: name || `Sheet${index + 1}`,
                            id: `imported_sheet_${index + 1}_${baseTimestamp}_${Math.random().toString(36).substring(2, 6)}`,
                            status: index === 0 ? 1 : 0,
                            order: index,
                            row: Math.max(maxR + 35, 60),
                            column: Math.max(maxC + 10, 26),
                            config: {
                                columnlen: colWidths,
                                rowlen: rowHeights,
                                merge: mergeObj
                            },
                            celldata
                        });
                    });

                    resolve({
                        success: true,
                        sheets: fortuneSheets,
                        workbookName: file.name.replace(/\.[^/.]+$/, '')
                    });
                } catch (err) {
                    console.error('Error parsing excel file in memory:', err);
                    reject(err);
                }
            };

            reader.onerror = (err) => reject(err);
            reader.readAsArrayBuffer(file);
        } catch (err) {
            reject(err);
        }
    });
};

/**
 * Storage helpers for persisting workbooks in localStorage
 */
const STORAGE_PREFIX = 'mano_spreadsheet_';

export const getSavedWorkbooksList = (projectId = null) => {
    try {
        const key = projectId ? `${STORAGE_PREFIX}list_proj_${projectId}` : `${STORAGE_PREFIX}list_global`;
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        return JSON.parse(raw);
    } catch (e) {
        console.error('Failed to get saved workbooks list:', e);
        return [];
    }
};

export const getWorkbookById = (workbookId) => {
    try {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}wb_${workbookId}`);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        console.error('Failed to get workbook by ID:', e);
        return null;
    }
};

export const saveWorkbook = (workbookData, projectId = null) => {
    try {
        const id = workbookData.id || `wb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const updatedWb = {
            ...workbookData,
            id,
            projectId: projectId || null,
            updatedAt: new Date().toISOString()
        };

        // Save workbook content
        localStorage.setItem(`${STORAGE_PREFIX}wb_${id}`, JSON.stringify(updatedWb));

        // Update index list
        const listKey = projectId ? `${STORAGE_PREFIX}list_proj_${projectId}` : `${STORAGE_PREFIX}list_global`;
        const currentList = getSavedWorkbooksList(projectId);
        const existingIdx = currentList.findIndex(item => item.id === id);

        const summaryItem = {
            id,
            name: updatedWb.name || 'Untitled Spreadsheet',
            projectId: projectId || null,
            sheetCount: (updatedWb.sheets || []).length || 1,
            templateId: updatedWb.templateId || 'custom',
            updatedAt: updatedWb.updatedAt
        };

        let newList;
        if (existingIdx >= 0) {
            newList = [...currentList];
            newList[existingIdx] = summaryItem;
        } else {
            newList = [summaryItem, ...currentList];
        }

        localStorage.setItem(listKey, JSON.stringify(newList));
        return { success: true, workbook: updatedWb };
    } catch (e) {
        console.error('Failed to save workbook:', e);
        return { success: false, error: e.message };
    }
};

export const deleteWorkbook = (workbookId, projectId = null) => {
    try {
        localStorage.removeItem(`${STORAGE_PREFIX}wb_${workbookId}`);

        const listKey = projectId ? `${STORAGE_PREFIX}list_proj_${projectId}` : `${STORAGE_PREFIX}list_global`;
        const currentList = getSavedWorkbooksList(projectId);
        const newList = currentList.filter(item => item.id !== workbookId);
        localStorage.setItem(listKey, JSON.stringify(newList));
        return { success: true };
    } catch (e) {
        console.error('Failed to delete workbook:', e);
        return { success: false, error: e.message };
    }
};
