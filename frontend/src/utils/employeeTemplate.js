import * as XLSX from 'xlsx';

export const EMPLOYEE_TEMPLATE_SAMPLE_ROWS = [
    {
        Name: 'John Doe',
        Email: 'john.doe@company.com',
        Phone: '9123456780',
        Department: 'Engineering',
        Designation: 'Senior Developer',
        Password: 'Password123'
    },
    {
        Name: 'Sarah Jenkins',
        Email: 'sarah.j@company.com',
        Phone: '9123456781',
        Department: 'Human Resources',
        Designation: 'HR Specialist',
        Password: 'Password123'
    },
    {
        Name: 'Michael Chang',
        Email: 'michael.c@company.com',
        Phone: '9123456782',
        Department: 'Finance',
        Designation: 'Accountant',
        Password: 'Password123'
    }
];

export function downloadEmployeeTemplate(format = 'xlsx') {
    if (typeof window === 'undefined') return;

    if (format === 'csv') {
        const headers = ['Name', 'Email', 'Phone', 'Department', 'Designation', 'Password'];
        const csvRows = [
            headers.join(','),
            ...EMPLOYEE_TEMPLATE_SAMPLE_ROWS.map(row => [
                `"${row.Name}"`,
                `"${row.Email}"`,
                `"${row.Phone}"`,
                `"${row.Department}"`,
                `"${row.Designation}"`,
                `"${row.Password}"`
            ].join(','))
        ];
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'employee_bulk_upload_template.csv';
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        return;
    }

    // Default: XLSX
    const worksheet = XLSX.utils.json_to_sheet(EMPLOYEE_TEMPLATE_SAMPLE_ROWS);
    worksheet['!cols'] = [
        { wch: 22 }, // Name
        { wch: 28 }, // Email
        { wch: 18 }, // Phone
        { wch: 22 }, // Department
        { wch: 24 }, // Designation
        { wch: 18 }  // Password
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');
    XLSX.writeFile(workbook, 'employee_bulk_upload_template.xlsx');
}

