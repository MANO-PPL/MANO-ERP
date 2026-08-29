import React, { useState, useMemo } from 'react';
import { ExcelGrid } from '../../../../components/ExcelGrid';
import { AlertOctagon, Eye } from 'lucide-react';

const diffDays = (d1, d2) => {
    if (!d1 || !d2) return 0;
    const a = new Date(d1);
    const b = new Date(d2);
    if (isNaN(a) || isNaN(b)) return 0;
    const diff = Math.ceil((a - b) / (1000 * 60 * 60 * 24));
    return diff;
};

export const HindranceReport = ({ setExtraBreadcrumbs, onBack }) => {
    const [rows, setRows] = useState([
        {
            id: 1,
            description: 'Mobilisation of Excavator',
            plannedStart: '2025-12-03',
            plannedFinish: '2025-12-04',
            plannedDays: 2,
            actualStart: '2025-12-04',
            actualFinish: '2025-12-06',
            actualDays: 3,
            responsibleStart: 'Vira Buildtech',
            remarksStart: 'Mobilisation delay',
            responsibleFinish: 'Vira Buildtech',
            remarksEnd: 'Personal Issue'
        },
        {
            id: 2,
            description: 'Testing',
            plannedStart: '2025-12-11',
            plannedFinish: '2025-12-12',
            plannedDays: 2,
            actualStart: '2025-12-14',
            actualFinish: '2025-12-17',
            actualDays: 4,
            responsibleStart: 'Mano',
            remarksStart: 'Delay in bike',
            responsibleFinish: 'Mano',
            remarksEnd: 'No API given'
        },
        {
            id: 3,
            description: 'Database Setup',
            plannedStart: '2025-12-12',
            plannedFinish: '2025-12-15',
            plannedDays: 4,
            actualStart: '2025-12-13',
            actualFinish: '',
            actualDays: 0,
            responsibleStart: 'Mano',
            remarksStart: '',
            responsibleFinish: 'Mano',
            remarksEnd: 'No database created'
        }
    ]);

    const columns = useMemo(
        () => [
            {
                key: 'description',
                label: 'Description of Items',
                required: true,
                width: '220px',
                minWidth: '200px'
            },
            {
                key: 'plannedStart',
                label: 'Planned Start',
                type: 'date',
                width: '130px',
                minWidth: '120px'
            },
            {
                key: 'plannedFinish',
                label: 'Planned Finish',
                type: 'date',
                width: '130px',
                minWidth: '120px'
            },
            {
                key: 'plannedDays',
                label: 'Planned Days',
                type: 'number',
                width: '110px',
                minWidth: '100px',
                align: 'center'
            },
            {
                key: 'actualStart',
                label: 'Actual Start',
                type: 'date',
                width: '130px',
                minWidth: '120px'
            },
            {
                key: 'actualFinish',
                label: 'Actual Finish',
                type: 'date',
                width: '130px',
                minWidth: '120px'
            },
            {
                key: 'actualDays',
                label: 'Actual Days',
                type: 'number',
                width: '110px',
                minWidth: '100px',
                align: 'center'
            },
            {
                key: 'delayStart',
                label: 'Delayed (Start)',
                width: '120px',
                minWidth: '110px',
                align: 'center',
                readOnly: true,
                renderCell: (_, row) => {
                    const delay = diffDays(row.actualStart, row.plannedStart);
                    return (
                        <span
                            className={`font-bold text-xs ${
                                delay > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                        >
                            {delay > 0 ? `+${delay}d` : `${delay}d`}
                        </span>
                    );
                }
            },
            {
                key: 'responsibleStart',
                label: 'Responsible (Start)',
                width: '160px',
                minWidth: '140px'
            },
            {
                key: 'remarksStart',
                label: 'Remarks (Start)',
                width: '160px',
                minWidth: '140px'
            },
            {
                key: 'delayFinish',
                label: 'Delayed (Finish)',
                width: '120px',
                minWidth: '110px',
                align: 'center',
                readOnly: true,
                renderCell: (_, row) => {
                    const delay = diffDays(row.actualFinish, row.plannedFinish);
                    return (
                        <span
                            className={`font-bold text-xs ${
                                delay > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                        >
                            {delay > 0 ? `+${delay}d` : `${delay}d`}
                        </span>
                    );
                }
            },
            {
                key: 'responsibleFinish',
                label: 'Responsible (Finish)',
                width: '160px',
                minWidth: '140px'
            },
            {
                key: 'remarksEnd',
                label: 'Remarks (Finish)',
                width: '160px',
                minWidth: '140px'
            }
        ],
        []
    );

    const handleSaveBatch = async (payload) => {
        const { allRows, deleted } = payload;
        const remaining = (allRows || []).filter((r) => !deleted.includes(r.id));
        setRows(remaining);
    };

    return (
        <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden bg-white dark:bg-[#0d1117]">
            <ExcelGrid
                data={rows}
                columns={columns}
                primaryKey="id"
                entityName="Hindrances"
                canWrite={true}
                isLoading={false}
                onSave={handleSaveBatch}
                emptyMessage="No hindrances recorded yet"
            />
        </div>
    );
};

export default HindranceReport;
