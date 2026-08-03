/**
 * Formats a date string, Date object, or timestamp into ordinal format:
 * e.g., "2nd August 2026", "1st January 2026", "23rd March 2026"
 * 
 * @param {string | Date | number} dateInput 
 * @returns {string} Formatted date string
 */
export const formatOrdinalDate = (dateInput) => {
    if (!dateInput) return 'N/A';
    if (typeof dateInput === 'string' && dateInput.trim() === '') return 'N/A';

    let d;
    if (dateInput instanceof Date) {
        d = dateInput;
    } else if (typeof dateInput === 'string') {
        // Handle YYYY-MM-DD cleanly without timezone shift issues
        const cleanStr = dateInput.split('T')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
            const [y, m, dayVal] = cleanStr.split('-').map(Number);
            d = new Date(y, m - 1, dayVal);
        } else {
            d = new Date(dateInput);
        }
    } else {
        d = new Date(dateInput);
    }

    if (!d || isNaN(d.getTime())) {
        return String(dateInput);
    }

    const day = d.getDate();
    const year = d.getFullYear();
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = months[d.getMonth()];

    let suffix = 'th';
    const j = day % 10;
    const k = day % 100;
    if (j === 1 && k !== 11) {
        suffix = 'st';
    } else if (j === 2 && k !== 12) {
        suffix = 'nd';
    } else if (j === 3 && k !== 13) {
        suffix = 'rd';
    }

    return `${day}${suffix} ${monthName} ${year}`;
};

export const formatDate = formatOrdinalDate;
