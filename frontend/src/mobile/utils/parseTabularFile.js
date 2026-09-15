import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export function isSupportedTabularFile(file) {
    if (!file) return false;
    const name = String(file.name || '').toLowerCase();
    return name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls') ||
        file.type === 'text/csv' ||
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

export function parseTabularFile(file) {
    if (!isSupportedTabularFile(file)) {
        return Promise.reject(new Error('Choose a CSV, XLSX, or XLS file.'));
    }

    const name = String(file.name || '').toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        return file.arrayBuffer().then((buffer) => {
            const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            if (!worksheet) throw new Error('The workbook does not contain a worksheet.');
            const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
            if (rows.length === 0) throw new Error('The uploaded file contains no data rows.');
            return rows;
        });
    }

    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: ({ data, errors }) => {
                if (errors?.length) return reject(new Error(errors[0].message || 'Failed to parse CSV file.'));
                if (!data?.length) return reject(new Error('The uploaded file contains no data rows.'));
                resolve(data);
            },
            error: (error) => reject(error),
        });
    });
}
