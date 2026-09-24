export const CATEGORY_OPTIONS = [
    'Client',
    'PMC',
    'Contractor',
    'Consultant',
    'Supplier'
];

export const DEFAULT_JOB_NATURES = [
    'Civil Works',
    'Structural Works',
    'Heavy Civil Infrastructure',
    'MEP (Mechanical, Electrical, Plumbing)',
    'HVAC Services',
    'Electrical Works',
    'Plumbing & Drainage',
    'Architecture & Design',
    'Interior Fitout',
    'Façade & Glazing',
    'Waterproofing',
    'Fire Fighting & Life Safety',
    'Project Management / PMC',
    'Geotechnical & Piling',
    'Landscaping & External Works',
    'Steel Fabrication & Erection',
    'Painting & Finishing',
    'Quality & Testing / QA-QC',
    'Safety & Environmental / HSE',
    'Material Supplier / Trading'
];

export const CATEGORY_BADGE_STYLES = {
    Client: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-500/20',
    PMC: 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400 border-violet-200/80 dark:border-violet-500/20',
    Contractor: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200/80 dark:border-amber-500/20',
    Consultant: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-400 border-cyan-200/80 dark:border-cyan-500/20',
    Supplier: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200/80 dark:border-blue-500/20'
};

export const CATEGORY_BORDER_TOP = {
    Client: 'border-t-4 border-t-emerald-500',
    PMC: 'border-t-4 border-t-violet-500',
    Contractor: 'border-t-4 border-t-amber-500',
    Consultant: 'border-t-4 border-t-cyan-500',
    Supplier: 'border-t-4 border-t-blue-500'
};

export const COLUMN_ALIASES = {
    name: ['company name', 'party name', 'name', 'vendor name', 'client name', 'firm', 'agency', 'contractor name'],
    category: ['category', 'party category', 'type', 'role', 'classification'],
    job_name: ['nature of job', 'job nature', 'scope of work', 'scope', 'trade', 'nature', 'work nature', 'service', 'job'],
    contact_person: ['contact person', 'contact name', 'person name', 'poc', 'representative', 'person', 'contact'],
    designation: ['designation', 'position', 'title', 'job title', 'role / designation', 'role'],
    responsibilities: ['responsibilities', 'responsibility', 'duties', 'scope of responsibility', 'key responsibilities'],
    telephone_no: ['contact no', 'phone no', 'mobile no', 'telephone', 'phone', 'mobile', 'cell', 'contact number', 'telephone no', 'tel'],
    email: ['email id', 'email', 'e-mail', 'mail', 'email address', 'mail id'],
    address: ['address', 'office address', 'site address', 'full address', 'street', 'location', 'address_line']
};

export const CHART_STEM_H = 22;   // px: vertical stem out of parent card
export const CHART_DROP_H = 22;   // px: vertical drop from bus bar into child
export const CHART_LINE_W = 2;    // px: line stroke width
export const CHART_ARROW_W = 10;  // px: arrowhead triangle base
export const CHART_ARROW_H = 6;   // px: arrowhead triangle height
