const fs = require('fs');

const file = './DPRCreate.jsx';
let content = fs.readFileSync(file, 'utf8');

const dateFunction = `
    // Calculate formatted date from initialData
    const getFormattedDate = () => {
        const reportDate = initialData?.date ? new Date(initialData.date) : new Date('2026-02-27');
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const dayName = days[reportDate.getDay()];
        const monthName = months[reportDate.getMonth()];
        const date = reportDate.getDate();
        const year = reportDate.getFullYear();
        return \`\${dayName}, \${date} \${monthName} \${year}\`;
    };`;

// Find where to insert the function (after generalRemarks state)
const insertPoint = content.indexOf('const [generalRemarks, setGeneralRemarks] = useState(initialData?.generalRemarks || \'\');');
if (insertPoint !== -1) {
    const endOfLine = content.indexOf('\n', insertPoint);
    content = content.substring(0, endOfLine + 1) + dateFunction + content.substring(endOfLine + 1);
}

// Replace the hardcoded date
content = content.replace('<span>Friday, 27 February 2026</span>', '<span>{getFormattedDate()}</span>');

fs.writeFileSync(file, content, 'utf8');
console.log('✅ Date fix applied successfully!');
