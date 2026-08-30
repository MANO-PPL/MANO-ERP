/**
 * Excel Formulas Metadata Catalog
 * Comprehensive definitions for Excel formulas across all categories:
 * - Math & Trigonometry
 * - Statistical
 * - Logical
 * - Text & String
 * - Date & Time
 * - Lookup & Reference
 * - Financial
 * - Engineering & Information
 * - Construction & ERP Specific
 */

export const FORMULA_CATEGORIES = [
    { id: 'all', name: 'All Formulas', icon: 'Sparkles', color: 'blue' },
    { id: 'math', name: 'Math & Trigonometry', icon: 'Calculator', color: 'emerald' },
    { id: 'stats', name: 'Statistical', icon: 'BarChart2', color: 'indigo' },
    { id: 'logical', name: 'Logical', icon: 'GitBranch', color: 'amber' },
    { id: 'text', name: 'Text & String', icon: 'Type', color: 'purple' },
    { id: 'datetime', name: 'Date & Time', icon: 'Calendar', color: 'sky' },
    { id: 'lookup', name: 'Lookup & Reference', icon: 'Search', color: 'pink' },
    { id: 'financial', name: 'Financial', icon: 'DollarSign', color: 'green' },
    { id: 'engineering', name: 'Engineering & Info', icon: 'Cpu', color: 'cyan' },
    { id: 'construction', name: 'Construction & ERP', icon: 'HardHat', color: 'orange' }
];

export const EXCEL_FORMULAS_CATALOG = [
    // ══════════════════════════════════════════════════════════════════════════
    // MATH & TRIGONOMETRY
    // ══════════════════════════════════════════════════════════════════════════
    {
        name: 'SUM',
        category: 'math',
        syntax: 'SUM(number1, [number2], ...)',
        description: 'Adds all numbers in a range of cells or comma-separated values.',
        args: [
            { name: 'number1', type: 'number|range', description: 'The first number or range to add', required: true, example: '10' },
            { name: 'number2', type: 'number|range', description: 'Additional numbers or ranges to add', required: false, example: '25' },
            { name: 'number3', type: 'number|range', description: 'Additional numbers or ranges to add', required: false, example: '65' }
        ],
        returns: 'Sum of all provided numbers',
        example: '=SUM(10, 25, 65)',
        tags: ['total', 'add', 'plus', 'math', 'aggregate']
    },
    {
        name: 'SUMIF',
        category: 'math',
        syntax: 'SUMIF(range, criteria, [sum_range])',
        description: 'Adds the cells specified by a given condition or criteria.',
        args: [
            { name: 'range', type: 'range', description: 'The range of cells evaluated by the criteria', required: true, example: '10, 20, 30, 40' },
            { name: 'criteria', type: 'string|number', description: 'The condition criteria (e.g. ">20")', required: true, example: '">20"' },
            { name: 'sum_range', type: 'range', description: 'The actual cells to sum (if different from range)', required: false, example: '10, 20, 30, 40' }
        ],
        returns: 'Filtered sum matching condition',
        example: '=SUMIF(10, 20, 30, 40, ">20")',
        tags: ['conditional sum', 'filter add', 'criteria']
    },
    {
        name: 'SUMIFS',
        category: 'math',
        syntax: 'SUMIFS(sum_range, criteria_range1, criteria1, ...)',
        description: 'Adds the cells in a range that meet multiple criteria.',
        args: [
            { name: 'sum_range', type: 'range', description: 'One or more cells to sum', required: true, example: '100, 200, 300' },
            { name: 'criteria_range1', type: 'range', description: 'The first range to evaluate', required: true, example: '1, 2, 1' },
            { name: 'criteria1', type: 'any', description: 'The criteria for range 1', required: true, example: '1' }
        ],
        returns: 'Sum of cells matching all criteria',
        example: '=SUMIFS(100, 200, 300, 1, 2, 1, 1)',
        tags: ['multi criteria sum', 'conditional sum']
    },
    {
        name: 'PRODUCT',
        category: 'math',
        syntax: 'PRODUCT(number1, [number2], ...)',
        description: 'Multiplies all the numbers given as arguments and returns the product.',
        args: [
            { name: 'number1', type: 'number', description: 'First number or range to multiply', required: true, example: '5' },
            { name: 'number2', type: 'number', description: 'Second number to multiply', required: true, example: '12' },
            { name: 'number3', type: 'number', description: 'Additional number to multiply', required: false, example: '2' }
        ],
        returns: 'Product of all numbers',
        example: '=PRODUCT(5, 12, 2)',
        tags: ['multiply', 'product', 'math', 'times']
    },
    {
        name: 'SUMPRODUCT',
        category: 'math',
        syntax: 'SUMPRODUCT(array1, [array2], ...)',
        description: 'Multiplies corresponding components in the given arrays, and returns the sum of those products.',
        args: [
            { name: 'array1', type: 'array', description: 'The first array whose components you want to multiply and sum', required: true, example: '[2, 4, 6]' },
            { name: 'array2', type: 'array', description: 'The second array to multiply and sum', required: true, example: '[10, 20, 30]' }
        ],
        returns: 'Sum of the multiplied products',
        example: '=SUMPRODUCT([2, 4, 6], [10, 20, 30])',
        tags: ['weighted average', 'matrix sum', 'multiply add']
    },
    {
        name: 'ROUND',
        category: 'math',
        syntax: 'ROUND(number, num_digits)',
        description: 'Rounds a number to a specified number of digits.',
        args: [
            { name: 'number', type: 'number', description: 'The number you want to round', required: true, example: '125.768' },
            { name: 'num_digits', type: 'number', description: 'The number of decimal places to round to', required: true, example: '2' }
        ],
        returns: 'Rounded number',
        example: '=ROUND(125.768, 2)',
        tags: ['decimal', 'precision', 'round', 'currency']
    },
    {
        name: 'ROUNDUP',
        category: 'math',
        syntax: 'ROUNDUP(number, num_digits)',
        description: 'Rounds a number up, away from zero.',
        args: [
            { name: 'number', type: 'number', description: 'The number to round up', required: true, example: '76.12' },
            { name: 'num_digits', type: 'number', description: 'Decimal digits to round up to', required: true, example: '0' }
        ],
        returns: 'Rounded up number',
        example: '=ROUNDUP(76.12, 0)',
        tags: ['ceil', 'round up', 'buffer']
    },
    {
        name: 'ROUNDDOWN',
        category: 'math',
        syntax: 'ROUNDDOWN(number, num_digits)',
        description: 'Rounds a number down, toward zero.',
        args: [
            { name: 'number', type: 'number', description: 'The number to round down', required: true, example: '76.89' },
            { name: 'num_digits', type: 'number', description: 'Decimal digits to round down to', required: true, example: '0' }
        ],
        returns: 'Rounded down number',
        example: '=ROUNDDOWN(76.89, 0)',
        tags: ['floor', 'round down', 'truncate']
    },
    {
        name: 'CEILING',
        category: 'math',
        syntax: 'CEILING(number, significance)',
        description: 'Rounds a number up to the nearest multiple of significance.',
        args: [
            { name: 'number', type: 'number', description: 'The value you want to round', required: true, example: '24.3' },
            { name: 'significance', type: 'number', description: 'The multiple to which you want to round', required: true, example: '5' }
        ],
        returns: 'Number rounded up to nearest multiple',
        example: '=CEILING(24.3, 5)',
        tags: ['batching', 'pack size', 'rounding']
    },
    {
        name: 'FLOOR',
        category: 'math',
        syntax: 'FLOOR(number, significance)',
        description: 'Rounds a number down to the nearest multiple of significance.',
        args: [
            { name: 'number', type: 'number', description: 'The numeric value to round', required: true, example: '24.8' },
            { name: 'significance', type: 'number', description: 'The multiple to which you want to round', required: true, example: '5' }
        ],
        returns: 'Number rounded down to nearest multiple',
        example: '=FLOOR(24.8, 5)',
        tags: ['batching', 'round down', 'multiple']
    },
    {
        name: 'ABS',
        category: 'math',
        syntax: 'ABS(number)',
        description: 'Returns the absolute value of a number (a number without its sign).',
        args: [
            { name: 'number', type: 'number', description: 'The real number for which you want the absolute value', required: true, example: '-158.45' }
        ],
        returns: 'Positive magnitude of number',
        example: '=ABS(-158.45)',
        tags: ['absolute', 'magnitude', 'positive', 'variance']
    },
    {
        name: 'SQRT',
        category: 'math',
        syntax: 'SQRT(number)',
        description: 'Returns the positive square root of a positive number.',
        args: [
            { name: 'number', type: 'number', description: 'The number for which you want the square root', required: true, example: '144' }
        ],
        returns: 'Square root of number',
        example: '=SQRT(144)',
        tags: ['square root', 'root', 'geometry']
    },
    {
        name: 'POWER',
        category: 'math',
        syntax: 'POWER(number, power)',
        description: 'Returns the result of a number raised to a power.',
        args: [
            { name: 'number', type: 'number', description: 'The base number', required: true, example: '12' },
            { name: 'power', type: 'number', description: 'The exponent power', required: true, example: '2' }
        ],
        returns: 'Base raised to power exponent',
        example: '=POWER(12, 2)',
        tags: ['exponent', 'power', 'squared', 'cubed']
    },
    {
        name: 'MOD',
        category: 'math',
        syntax: 'MOD(number, divisor)',
        description: 'Returns the remainder after a number is divided by a divisor.',
        args: [
            { name: 'number', type: 'number', description: 'The number for which you want to find the remainder', required: true, example: '17' },
            { name: 'divisor', type: 'number', description: 'The divisor number', required: true, example: '5' }
        ],
        returns: 'Remainder of division',
        example: '=MOD(17, 5)',
        tags: ['remainder', 'modulo', 'even odd']
    },
    {
        name: 'INT',
        category: 'math',
        syntax: 'INT(number)',
        description: 'Rounds a number down to the nearest integer.',
        args: [
            { name: 'number', type: 'number', description: 'The real number to round down to an integer', required: true, example: '89.75' }
        ],
        returns: 'Integer part of number',
        example: '=INT(89.75)',
        tags: ['integer', 'truncate', 'whole number']
    },
    {
        name: 'TRUNC',
        category: 'math',
        syntax: 'TRUNC(number, [num_digits])',
        description: 'Truncates a number to an integer or specified number of decimal digits.',
        args: [
            { name: 'number', type: 'number', description: 'The number to truncate', required: true, example: '8.915' },
            { name: 'num_digits', type: 'number', description: 'Precision of truncation', required: false, example: '1' }
        ],
        returns: 'Truncated number',
        example: '=TRUNC(8.915, 1)',
        tags: ['truncate', 'strip decimals']
    },
    {
        name: 'RAND',
        category: 'math',
        syntax: 'RAND()',
        description: 'Returns an evenly distributed random real number between 0 and 1.',
        args: [],
        returns: 'Random decimal between 0 and 1',
        example: '=RAND()',
        tags: ['random', 'simulation', 'monte carlo']
    },
    {
        name: 'RANDBETWEEN',
        category: 'math',
        syntax: 'RANDBETWEEN(bottom, top)',
        description: 'Returns a random integer number between the numbers you specify.',
        args: [
            { name: 'bottom', type: 'number', description: 'The smallest integer', required: true, example: '10' },
            { name: 'top', type: 'number', description: 'The largest integer', required: true, example: '100' }
        ],
        returns: 'Random integer within range',
        example: '=RANDBETWEEN(10, 100)',
        tags: ['random integer', 'sample', 'dice']
    },
    {
        name: 'PI',
        category: 'math',
        syntax: 'PI()',
        description: 'Returns the value of pi accurate to 15 digits (3.14159265358979).',
        args: [],
        returns: '3.14159265358979',
        example: '=PI()',
        tags: ['pi', 'circle', 'circumference', 'area']
    },
    {
        name: 'EXP',
        category: 'math',
        syntax: 'EXP(number)',
        description: 'Returns e raised to the power of a given number (Euler constant e ≈ 2.7182818).',
        args: [
            { name: 'number', type: 'number', description: 'The exponent applied to base e', required: true, example: '2' }
        ],
        returns: 'e^number',
        example: '=EXP(2)',
        tags: ['euler', 'exponential', 'growth']
    },
    {
        name: 'LN',
        category: 'math',
        syntax: 'LN(number)',
        description: 'Returns the natural logarithm of a number.',
        args: [
            { name: 'number', type: 'number', description: 'The positive real number', required: true, example: '10' }
        ],
        returns: 'Natural log of number',
        example: '=LN(10)',
        tags: ['logarithm', 'natural log']
    },
    {
        name: 'LOG10',
        category: 'math',
        syntax: 'LOG10(number)',
        description: 'Returns the base-10 logarithm of a number.',
        args: [
            { name: 'number', type: 'number', description: 'The positive real number', required: true, example: '1000' }
        ],
        returns: 'Base 10 log',
        example: '=LOG10(1000)',
        tags: ['log10', 'decibel', 'order of magnitude']
    },
    {
        name: 'FACT',
        category: 'math',
        syntax: 'FACT(number)',
        description: 'Returns the factorial of a number (n!).',
        args: [
            { name: 'number', type: 'number', description: 'The non-negative integer for factorial', required: true, example: '5' }
        ],
        returns: 'Factorial product (1*2*...*n)',
        example: '=FACT(5)',
        tags: ['factorial', 'permutations', 'math']
    },
    {
        name: 'COMBIN',
        category: 'math',
        syntax: 'COMBIN(number, number_chosen)',
        description: 'Returns the number of combinations for a given number of items.',
        args: [
            { name: 'number', type: 'number', description: 'The number of items (n)', required: true, example: '8' },
            { name: 'number_chosen', type: 'number', description: 'The number of items in each combination (k)', required: true, example: '3' }
        ],
        returns: 'n choose k combinations count',
        example: '=COMBIN(8, 3)',
        tags: ['combinations', 'probability', 'n choose k']
    },
    {
        name: 'GCD',
        category: 'math',
        syntax: 'GCD(number1, [number2], ...)',
        description: 'Returns the greatest common divisor of two or more integers.',
        args: [
            { name: 'number1', type: 'number', description: 'First integer', required: true, example: '24' },
            { name: 'number2', type: 'number', description: 'Second integer', required: true, example: '36' }
        ],
        returns: 'Greatest common factor',
        example: '=GCD(24, 36)',
        tags: ['gcd', 'greatest common divisor', 'factors']
    },
    {
        name: 'LCM',
        category: 'math',
        syntax: 'LCM(number1, [number2], ...)',
        description: 'Returns the least common multiple of integers.',
        args: [
            { name: 'number1', type: 'number', description: 'First integer', required: true, example: '12' },
            { name: 'number2', type: 'number', description: 'Second integer', required: true, example: '18' }
        ],
        returns: 'Least common multiple',
        example: '=LCM(12, 18)',
        tags: ['lcm', 'least common multiple']
    },
    {
        name: 'RADIANS',
        category: 'math',
        syntax: 'RADIANS(angle)',
        description: 'Converts degrees to radians.',
        args: [
            { name: 'angle', type: 'number', description: 'An angle in degrees', required: true, example: '180' }
        ],
        returns: 'Angle in radians',
        example: '=RADIANS(180)',
        tags: ['degrees to radians', 'trig']
    },
    {
        name: 'DEGREES',
        category: 'math',
        syntax: 'DEGREES(angle)',
        description: 'Converts radians to degrees.',
        args: [
            { name: 'angle', type: 'number', description: 'An angle in radians', required: true, example: '3.14159265' }
        ],
        returns: 'Angle in degrees',
        example: '=DEGREES(3.14159265)',
        tags: ['radians to degrees', 'trig']
    },
    {
        name: 'SIN',
        category: 'math',
        syntax: 'SIN(number)',
        description: 'Returns the sine of the given angle in radians.',
        args: [
            { name: 'number', type: 'number', description: 'The angle in radians for which you want the sine', required: true, example: '0.5' }
        ],
        returns: 'Sine value (-1 to 1)',
        example: '=SIN(0.5)',
        tags: ['sine', 'trigonometry', 'surveying']
    },
    {
        name: 'COS',
        category: 'math',
        syntax: 'COS(number)',
        description: 'Returns the cosine of the given angle in radians.',
        args: [
            { name: 'number', type: 'number', description: 'The angle in radians for which you want the cosine', required: true, example: '0' }
        ],
        returns: 'Cosine value',
        example: '=COS(0)',
        tags: ['cosine', 'trigonometry']
    },
    {
        name: 'TAN',
        category: 'math',
        syntax: 'TAN(number)',
        description: 'Returns the tangent of an angle in radians.',
        args: [
            { name: 'number', type: 'number', description: 'The angle in radians', required: true, example: '0.785398' }
        ],
        returns: 'Tangent slope value',
        example: '=TAN(0.785398)',
        tags: ['tangent', 'slope', 'grade', 'elevation']
    },
    {
        name: 'SUBTOTAL',
        category: 'math',
        syntax: 'SUBTOTAL(function_num, ref1, [ref2], ...)',
        description: 'Returns a subtotal in a list or database (e.g. 9 for SUM, 1 for AVERAGE, 2 for COUNT).',
        args: [
            { name: 'function_num', type: 'number', description: 'Function code (9=SUM, 1=AVERAGE, 2=COUNT, 4=MAX, 5=MIN)', required: true, example: '9' },
            { name: 'ref1', type: 'number|range', description: 'The first range or values to subtotal', required: true, example: '10' },
            { name: 'ref2', type: 'number|range', description: 'Additional values to subtotal', required: false, example: '20' },
            { name: 'ref3', type: 'number|range', description: 'Additional values to subtotal', required: false, example: '30' }
        ],
        returns: 'Subtotal value',
        example: '=SUBTOTAL(9, 10, 20, 30)',
        tags: ['subtotal', 'filtered sum', 'table total']
    },

    // ══════════════════════════════════════════════════════════════════════════
    // STATISTICAL
    // ══════════════════════════════════════════════════════════════════════════
    {
        name: 'AVERAGE',
        category: 'stats',
        syntax: 'AVERAGE(number1, [number2], ...)',
        description: 'Returns the average (arithmetic mean) of its arguments.',
        args: [
            { name: 'number1', type: 'number', description: 'The first number or range', required: true, example: '20' },
            { name: 'number2', type: 'number', description: 'Additional numbers or ranges', required: false, example: '40' },
            { name: 'number3', type: 'number', description: 'Additional numbers or ranges', required: false, example: '60' }
        ],
        returns: 'Arithmetic mean',
        example: '=AVERAGE(20, 40, 60)',
        tags: ['mean', 'average', 'stats']
    },
    {
        name: 'AVERAGEIF',
        category: 'stats',
        syntax: 'AVERAGEIF(range, criteria, [average_range])',
        description: 'Returns the average of all cells in a range that meet a given criteria.',
        args: [
            { name: 'range', type: 'range', description: 'One or more cells to average', required: true, example: '15, 25, 35, 45' },
            { name: 'criteria', type: 'string', description: 'The condition criteria', required: true, example: '">20"' }
        ],
        returns: 'Filtered average',
        example: '=AVERAGEIF(15, 25, 35, 45, ">20")',
        tags: ['conditional average', 'filtered mean']
    },
    {
        name: 'AVERAGEIFS',
        category: 'stats',
        syntax: 'AVERAGEIFS(average_range, criteria_range1, criteria1, ...)',
        description: 'Returns the average of all cells that meet multiple criteria.',
        args: [
            { name: 'average_range', type: 'range', description: 'The range of cells to average', required: true, example: '10, 20, 30, 40' },
            { name: 'criteria_range1', type: 'range', description: 'First range to evaluate', required: true, example: '1, 1, 2, 2' },
            { name: 'criteria1', type: 'any', description: 'Criteria 1', required: true, example: '1' }
        ],
        returns: 'Multi-criteria average',
        example: '=AVERAGEIFS(10, 20, 30, 40, 1, 1, 2, 2, 1)',
        tags: ['multi average', 'filtered mean']
    },
    {
        name: 'COUNT',
        category: 'stats',
        syntax: 'COUNT(value1, [value2], ...)',
        description: 'Counts the number of cells that contain numbers and numbers in the list of arguments.',
        args: [
            { name: 'value1', type: 'any', description: 'The first item or range', required: true, example: '10' },
            { name: 'value2', type: 'any', description: 'Additional items', required: false, example: '"test"' },
            { name: 'value3', type: 'any', description: 'Additional items', required: false, example: '42' }
        ],
        returns: 'Count of numeric entries',
        example: '=COUNT(10, "test", 42)',
        tags: ['count', 'numeric count', 'tally']
    },
    {
        name: 'COUNTA',
        category: 'stats',
        syntax: 'COUNTA(value1, [value2], ...)',
        description: 'Counts the number of cells that are not empty in a range or argument list.',
        args: [
            { name: 'value1', type: 'any', description: 'First argument', required: true, example: '"Concrete"' },
            { name: 'value2', type: 'any', description: 'Additional arguments', required: false, example: '"Steel"' },
            { name: 'value3', type: 'any', description: 'Additional arguments', required: false, example: '100' }
        ],
        returns: 'Count of non-blank entries',
        example: '=COUNTA("Concrete", "Steel", 100)',
        tags: ['non empty', 'populated', 'count all']
    },
    {
        name: 'COUNTIF',
        category: 'stats',
        syntax: 'COUNTIF(range, criteria)',
        description: 'Counts the number of cells within a range that meet the given condition.',
        args: [
            { name: 'range', type: 'range', description: 'The range of cells to evaluate', required: true, example: '10, 20, 30, 20, 20' },
            { name: 'criteria', type: 'any', description: 'The matching condition', required: true, example: '20' }
        ],
        returns: 'Frequency of matching entries',
        example: '=COUNTIF(10, 20, 30, 20, 20, 20)',
        tags: ['conditional count', 'frequency', 'tally']
    },
    {
        name: 'COUNTIFS',
        category: 'stats',
        syntax: 'COUNTIFS(criteria_range1, criteria1, ...)',
        description: 'Applies criteria to cells across multiple ranges and counts the number of times all criteria are met.',
        args: [
            { name: 'criteria_range1', type: 'range', description: 'First range to evaluate', required: true, example: '1, 2, 1, 2' },
            { name: 'criteria1', type: 'any', description: 'Criteria for range 1', required: true, example: '1' }
        ],
        returns: 'Multi-criteria count',
        example: '=COUNTIFS(1, 2, 1, 2, 1)',
        tags: ['multi count', 'filter count']
    },
    {
        name: 'MAX',
        category: 'stats',
        syntax: 'MAX(number1, [number2], ...)',
        description: 'Returns the largest value in a set of values.',
        args: [
            { name: 'number1', type: 'number', description: 'First number or range', required: true, example: '15' },
            { name: 'number2', type: 'number', description: 'Additional numbers or ranges', required: false, example: '95' },
            { name: 'number3', type: 'number', description: 'Additional numbers or ranges', required: false, example: '42' }
        ],
        returns: 'Highest value',
        example: '=MAX(15, 95, 42)',
        tags: ['maximum', 'highest', 'peak', 'ceiling']
    },
    {
        name: 'MIN',
        category: 'stats',
        syntax: 'MIN(number1, [number2], ...)',
        description: 'Returns the smallest number in a set of values.',
        args: [
            { name: 'number1', type: 'number', description: 'First number or range', required: true, example: '15' },
            { name: 'number2', type: 'number', description: 'Additional numbers or ranges', required: false, example: '95' },
            { name: 'number3', type: 'number', description: 'Additional numbers or ranges', required: false, example: '4' }
        ],
        returns: 'Smallest value',
        example: '=MIN(15, 95, 4)',
        tags: ['minimum', 'lowest', 'bottom']
    },
    {
        name: 'MEDIAN',
        category: 'stats',
        syntax: 'MEDIAN(number1, [number2], ...)',
        description: 'Returns the median (middle value) of the given numbers.',
        args: [
            { name: 'number1', type: 'number', description: 'First number or range', required: true, example: '10' },
            { name: 'number2', type: 'number', description: 'Second number', required: true, example: '25' },
            { name: 'number3', type: 'number', description: 'Third number', required: true, example: '100' }
        ],
        returns: 'Middle value in sorted dataset',
        example: '=MEDIAN(10, 25, 100)',
        tags: ['median', 'middle', 'statistics']
    },
    {
        name: 'MODE.SNGL',
        category: 'stats',
        syntax: 'MODE.SNGL(number1, [number2], ...)',
        description: 'Returns the most frequently occurring value in an array or range.',
        args: [
            { name: 'number1', type: 'number', description: 'Numbers to calculate mode', required: true, example: '5' },
            { name: 'number2', type: 'number', description: 'Additional numbers', required: true, example: '7' },
            { name: 'number3', type: 'number', description: 'Additional numbers', required: true, example: '5' }
        ],
        returns: 'Most common value',
        example: '=MODE.SNGL(5, 7, 5)',
        tags: ['mode', 'frequent', 'common']
    },
    {
        name: 'STDEV.S',
        category: 'stats',
        syntax: 'STDEV.S(number1, [number2], ...)',
        description: 'Estimates standard deviation based on a sample.',
        args: [
            { name: 'number1', type: 'number', description: 'First number or sample range', required: true, example: '10' },
            { name: 'number2', type: 'number', description: 'Second number', required: true, example: '12' },
            { name: 'number3', type: 'number', description: 'Third number', required: true, example: '23' }
        ],
        returns: 'Sample standard deviation',
        example: '=STDEV.S(10, 12, 23)',
        tags: ['standard deviation', 'variance', 'dispersion', 'sigma']
    },
    {
        name: 'VAR.S',
        category: 'stats',
        syntax: 'VAR.S(number1, [number2], ...)',
        description: 'Estimates variance based on a sample.',
        args: [
            { name: 'number1', type: 'number', description: 'First number', required: true, example: '10' },
            { name: 'number2', type: 'number', description: 'Second number', required: true, example: '15' },
            { name: 'number3', type: 'number', description: 'Third number', required: true, example: '25' }
        ],
        returns: 'Sample variance value',
        example: '=VAR.S(10, 15, 25)',
        tags: ['variance', 'dispersion', 'spread']
    },
    {
        name: 'LARGE',
        category: 'stats',
        syntax: 'LARGE(array, k)',
        description: 'Returns the k-th largest value in a data set (e.g. 1st, 2nd, 3rd highest).',
        args: [
            { name: 'array', type: 'array', description: 'Array or range of data', required: true, example: '[10, 50, 80, 20]' },
            { name: 'k', type: 'number', description: 'Position from highest (1=max, 2=second max)', required: true, example: '2' }
        ],
        returns: 'The k-th largest number',
        example: '=LARGE([10, 50, 80, 20], 2)',
        tags: ['ranking', 'top', 'runner up']
    },
    {
        name: 'SMALL',
        category: 'stats',
        syntax: 'SMALL(array, k)',
        description: 'Returns the k-th smallest value in a data set.',
        args: [
            { name: 'array', type: 'array', description: 'Array or range of data', required: true, example: '[10, 50, 80, 20]' },
            { name: 'k', type: 'number', description: 'Position from lowest (1=min)', required: true, example: '1' }
        ],
        returns: 'The k-th smallest number',
        example: '=SMALL([10, 50, 80, 20], 1)',
        tags: ['ranking', 'lowest', 'bottom']
    },
    {
        name: 'PERCENTILE.INC',
        category: 'stats',
        syntax: 'PERCENTILE.INC(array, k)',
        description: 'Returns the k-th percentile of values in a range, where k is in the range 0..1 inclusive.',
        args: [
            { name: 'array', type: 'array', description: 'Array of data points', required: true, example: '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]' },
            { name: 'k', type: 'number', description: 'The percentile value from 0 to 1 (e.g. 0.9 for 90th percentile)', required: true, example: '0.9' }
        ],
        returns: 'Percentile threshold value',
        example: '=PERCENTILE.INC([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)',
        tags: ['percentile', 'benchmark', 'distribution']
    },
    {
        name: 'RANK.EQ',
        category: 'stats',
        syntax: 'RANK.EQ(number, ref, [order])',
        description: 'Returns the rank of a number in a list of numbers (order 0=descending, 1=ascending).',
        args: [
            { name: 'number', type: 'number', description: 'The number whose rank you want to find', required: true, example: '75' },
            { name: 'ref', type: 'array', description: 'Array or list of numbers', required: true, example: '[50, 75, 90, 60]' },
            { name: 'order', type: 'number', description: '0 for descending (highest=1), 1 for ascending', required: false, example: '0' }
        ],
        returns: 'Rank integer position',
        example: '=RANK.EQ(75, [50, 75, 90, 60], 0)',
        tags: ['rank', 'leaderboard', 'position']
    },
    {
        name: 'CORREL',
        category: 'stats',
        syntax: 'CORREL(array1, array2)',
        description: 'Returns the correlation coefficient between two measurement data sets.',
        args: [
            { name: 'array1', type: 'array', description: 'First dataset array', required: true, example: '[1, 2, 3, 4, 5]' },
            { name: 'array2', type: 'array', description: 'Second dataset array', required: true, example: '[2, 4, 5, 8, 10]' }
        ],
        returns: 'Pearson correlation coefficient (-1 to 1)',
        example: '=CORREL([1, 2, 3, 4, 5], [2, 4, 5, 8, 10])',
        tags: ['correlation', 'r value', 'regression', 'trend']
    },

    // ══════════════════════════════════════════════════════════════════════════
    // LOGICAL
    // ══════════════════════════════════════════════════════════════════════════
    {
        name: 'IF',
        category: 'logical',
        syntax: 'IF(logical_test, value_if_true, [value_if_false])',
        description: 'Checks whether a condition is met, returning one value if TRUE and another if FALSE.',
        args: [
            { name: 'logical_test', type: 'boolean', description: 'Condition evaluated to TRUE or FALSE', required: true, example: '10 > 5' },
            { name: 'value_if_true', type: 'any', description: 'Value returned if condition is TRUE', required: true, example: '"Passed"' },
            { name: 'value_if_false', type: 'any', description: 'Value returned if condition is FALSE', required: false, example: '"Failed"' }
        ],
        returns: 'Branch result value',
        example: '=IF(10 > 5, "Passed", "Failed")',
        tags: ['conditional', 'decision', 'branch', 'ternary']
    },
    {
        name: 'IFS',
        category: 'logical',
        syntax: 'IFS(logical_test1, value_if_true1, [logical_test2, value_if_true2], ...)',
        description: 'Checks multiple conditions and returns the value corresponding to the first TRUE condition.',
        args: [
            { name: 'logical_test1', type: 'boolean', description: 'First condition', required: true, example: '85 >= 90' },
            { name: 'value_if_true1', type: 'any', description: 'Value if test 1 is true', required: true, example: '"Grade A"' },
            { name: 'logical_test2', type: 'boolean', description: 'Second condition', required: true, example: '85 >= 75' },
            { name: 'value_if_true2', type: 'any', description: 'Value if test 2 is true', required: true, example: '"Grade B"' },
            { name: 'logical_test3', type: 'boolean', description: 'Default condition', required: true, example: 'TRUE' },
            { name: 'value_if_true3', type: 'any', description: 'Default fallback value', required: true, example: '"Grade C"' }
        ],
        returns: 'First matching condition value',
        example: '=IFS(85 >= 90, "Grade A", 85 >= 75, "Grade B", TRUE, "Grade C")',
        tags: ['multi if', 'switch', 'grading', 'brackets']
    },
    {
        name: 'IFERROR',
        category: 'logical',
        syntax: 'IFERROR(value, value_if_error)',
        description: 'Returns a fallback value if a formula evaluates to an error; otherwise returns the formula result.',
        args: [
            { name: 'value', type: 'any', description: 'Expression checked for error', required: true, example: '100 / 0' },
            { name: 'value_if_error', type: 'any', description: 'Fallback value if error occurs', required: true, example: '0' }
        ],
        returns: 'Result or fallback error value',
        example: '=IFERROR(100 / 0, 0)',
        tags: ['error handling', 'fallback', 'safe divide', 'div/0']
    },
    {
        name: 'IFNA',
        category: 'logical',
        syntax: 'IFNA(value, value_if_na)',
        description: 'Returns a fallback value if expression resolves to #N/A; otherwise returns the result.',
        args: [
            { name: 'value', type: 'any', description: 'Expression checked for #N/A', required: true, example: '10' },
            { name: 'value_if_na', type: 'any', description: 'Fallback value if #N/A', required: true, example: '"Not Found"' }
        ],
        returns: 'Result or #N/A fallback value',
        example: '=IFNA(10, "Not Found")',
        tags: ['na fallback', 'not available', 'lookup default']
    },
    {
        name: 'AND',
        category: 'logical',
        syntax: 'AND(logical1, [logical2], ...)',
        description: 'Returns TRUE if all of its arguments are TRUE; returns FALSE if one or more are FALSE.',
        args: [
            { name: 'logical1', type: 'boolean', description: 'First condition', required: true, example: '10 > 5' },
            { name: 'logical2', type: 'boolean', description: 'Second condition', required: true, example: '20 < 50' }
        ],
        returns: 'TRUE if all conditions are satisfied',
        example: '=AND(10 > 5, 20 < 50)',
        tags: ['boolean and', 'conjunction', 'all true']
    },
    {
        name: 'OR',
        category: 'logical',
        syntax: 'OR(logical1, [logical2], ...)',
        description: 'Returns TRUE if any argument is TRUE; returns FALSE if all arguments are FALSE.',
        args: [
            { name: 'logical1', type: 'boolean', description: 'First condition', required: true, example: '10 < 5' },
            { name: 'logical2', type: 'boolean', description: 'Second condition', required: true, example: '20 < 50' }
        ],
        returns: 'TRUE if at least one condition is satisfied',
        example: '=OR(10 < 5, 20 < 50)',
        tags: ['boolean or', 'disjunction', 'any true']
    },
    {
        name: 'NOT',
        category: 'logical',
        syntax: 'NOT(logical)',
        description: 'Reverses the logic of its argument (returns TRUE for FALSE and FALSE for TRUE).',
        args: [
            { name: 'logical', type: 'boolean', description: 'Boolean expression to negate', required: true, example: '5 > 10' }
        ],
        returns: 'Inverted boolean value',
        example: '=NOT(5 > 10)',
        tags: ['boolean not', 'invert', 'negation']
    },
    {
        name: 'XOR',
        category: 'logical',
        syntax: 'XOR(logical1, [logical2], ...)',
        description: 'Returns a logical Exclusive OR of all arguments (TRUE if an odd number of arguments evaluate to TRUE).',
        args: [
            { name: 'logical1', type: 'boolean', description: 'First condition', required: true, example: 'TRUE' },
            { name: 'logical2', type: 'boolean', description: 'Second condition', required: true, example: 'FALSE' }
        ],
        returns: 'Exclusive OR boolean',
        example: '=XOR(TRUE, FALSE)',
        tags: ['exclusive or', 'xor', 'logic']
    },
    {
        name: 'SWITCH',
        category: 'logical',
        syntax: 'SWITCH(expression, val1, result1, [val2, result2], ..., [default])',
        description: 'Evaluates an expression against a list of values and returns the matching result.',
        args: [
            { name: 'expression', type: 'any', description: 'Expression to match', required: true, example: '2' },
            { name: 'val1', type: 'any', description: 'First match target', required: true, example: '1' },
            { name: 'result1', type: 'any', description: 'First return value', required: true, example: '"Low"' },
            { name: 'val2', type: 'any', description: 'Second match target', required: true, example: '2' },
            { name: 'result2', type: 'any', description: 'Second return value', required: true, example: '"Medium"' },
            { name: 'default', type: 'any', description: 'Default fallback', required: false, example: '"High"' }
        ],
        returns: 'Matched outcome value',
        example: '=SWITCH(2, 1, "Low", 2, "Medium", "High")',
        tags: ['switch case', 'lookup', 'mapping']
    },

    // ══════════════════════════════════════════════════════════════════════════
    // TEXT & STRING
    // ══════════════════════════════════════════════════════════════════════════
    {
        name: 'CONCATENATE',
        category: 'text',
        syntax: 'CONCATENATE(text1, [text2], ...)',
        description: 'Joins two or more text strings into one string.',
        args: [
            { name: 'text1', type: 'string', description: 'First text string', required: true, example: '"Project "' },
            { name: 'text2', type: 'string', description: 'Second text string', required: true, example: '"Tower-A"' }
        ],
        returns: 'Combined single text string',
        example: '=CONCATENATE("Project ", "Tower-A")',
        tags: ['join text', 'combine', 'merge strings', 'concat']
    },
    {
        name: 'TEXTJOIN',
        category: 'text',
        syntax: 'TEXTJOIN(delimiter, ignore_empty, text1, [text2], ...)',
        description: 'Combines text from multiple items with a custom delimiter between each item.',
        args: [
            { name: 'delimiter', type: 'string', description: 'Separator delimiter string', required: true, example: '", "' },
            { name: 'ignore_empty', type: 'boolean', description: 'Ignore empty values if TRUE', required: true, example: 'TRUE' },
            { name: 'text1', type: 'string', description: 'First text item', required: true, example: '"Cement"' },
            { name: 'text2', type: 'string', description: 'Second text item', required: true, example: '"Sand"' },
            { name: 'text3', type: 'string', description: 'Third text item', required: true, example: '"Aggregate"' }
        ],
        returns: 'Joined delimited text',
        example: '=TEXTJOIN(", ", TRUE, "Cement", "Sand", "Aggregate")',
        tags: ['join delimiter', 'csv join', 'text combine']
    },
    {
        name: 'LEFT',
        category: 'text',
        syntax: 'LEFT(text, [num_chars])',
        description: 'Returns characters from the start of a text string.',
        args: [
            { name: 'text', type: 'string', description: 'Source text string', required: true, example: '"PRJ-2026-001"' },
            { name: 'num_chars', type: 'number', description: 'Number of characters to extract', required: false, example: '3' }
        ],
        returns: 'Substring from beginning',
        example: '=LEFT("PRJ-2026-001", 3)',
        tags: ['substring', 'prefix', 'left slice']
    },
    {
        name: 'RIGHT',
        category: 'text',
        syntax: 'RIGHT(text, [num_chars])',
        description: 'Returns characters from the end of a text string.',
        args: [
            { name: 'text', type: 'string', description: 'Source text string', required: true, example: '"PRJ-2026-001"' },
            { name: 'num_chars', type: 'number', description: 'Number of characters to extract from end', required: false, example: '3' }
        ],
        returns: 'Substring from end',
        example: '=RIGHT("PRJ-2026-001", 3)',
        tags: ['suffix', 'tail', 'right slice']
    },
    {
        name: 'MID',
        category: 'text',
        syntax: 'MID(text, start_num, num_chars)',
        description: 'Returns characters from the middle of a text string given starting position and length.',
        args: [
            { name: 'text', type: 'string', description: 'Source text string', required: true, example: '"PRJ-2026-001"' },
            { name: 'start_num', type: 'number', description: '1-based start index', required: true, example: '5' },
            { name: 'num_chars', type: 'number', description: 'Character count to extract', required: true, example: '4' }
        ],
        returns: 'Extracted middle substring',
        example: '=MID("PRJ-2026-001", 5, 4)',
        tags: ['slice', 'extract substring', 'middle']
    },
    {
        name: 'LEN',
        category: 'text',
        syntax: 'LEN(text)',
        description: 'Returns the number of characters in a text string.',
        args: [
            { name: 'text', type: 'string', description: 'The text string', required: true, example: '"MANO-ERP"' }
        ],
        returns: 'Character length integer',
        example: '=LEN("MANO-ERP")',
        tags: ['length', 'character count', 'size']
    },
    {
        name: 'TRIM',
        category: 'text',
        syntax: 'TRIM(text)',
        description: 'Removes leading and trailing whitespace from text.',
        args: [
            { name: 'text', type: 'string', description: 'Text to trim', required: true, example: '"   Site Office   "' }
        ],
        returns: 'Cleaned text',
        example: '=TRIM("   Site Office   ")',
        tags: ['clean whitespace', 'strip spaces', 'sanitization']
    },
    {
        name: 'UPPER',
        category: 'text',
        syntax: 'UPPER(text)',
        description: 'Converts text to uppercase.',
        args: [
            { name: 'text', type: 'string', description: 'Source text', required: true, example: '"mano erp"' }
        ],
        returns: 'Uppercase text string',
        example: '=UPPER("mano erp")',
        tags: ['uppercase', 'capital', 'caps']
    },
    {
        name: 'LOWER',
        category: 'text',
        syntax: 'LOWER(text)',
        description: 'Converts text to lowercase.',
        args: [
            { name: 'text', type: 'string', description: 'Source text', required: true, example: '"SUPERVISOR"' }
        ],
        returns: 'Lowercase text string',
        example: '=LOWER("SUPERVISOR")',
        tags: ['lowercase', 'small letters']
    },
    {
        name: 'PROPER',
        category: 'text',
        syntax: 'PROPER(text)',
        description: 'Capitalizes the first letter of each word.',
        args: [
            { name: 'text', type: 'string', description: 'Source text', required: true, example: '"john doe contractor"' }
        ],
        returns: 'Title-cased text string',
        example: '=PROPER("john doe contractor")',
        tags: ['titlecase', 'name formatting', 'proper casing']
    },
    {
        name: 'SUBSTITUTE',
        category: 'text',
        syntax: 'SUBSTITUTE(text, old_text, new_text, [instance_num])',
        description: 'Replaces occurrences of old text with new text.',
        args: [
            { name: 'text', type: 'string', description: 'Source text', required: true, example: '"Quarter 1, 2026"' },
            { name: 'old_text', type: 'string', description: 'Text to replace', required: true, example: '"1"' },
            { name: 'new_text', type: 'string', description: 'Replacement string', required: true, example: '"2"' }
        ],
        returns: 'Replaced text string',
        example: '=SUBSTITUTE("Quarter 1, 2026", "1", "2")',
        tags: ['replace text', 'substitute', 'string replacement']
    },
    {
        name: 'REPT',
        category: 'text',
        syntax: 'REPT(text, number_times)',
        description: 'Repeats text a given number of times.',
        args: [
            { name: 'text', type: 'string', description: 'The text to repeat', required: true, example: '"★"' },
            { name: 'number_times', type: 'number', description: 'Number of repetitions', required: true, example: '5' }
        ],
        returns: 'Repeated string',
        example: '=REPT("★", 5)',
        tags: ['repeat string', 'pattern', 'rating']
    },
    {
        name: 'EXACT',
        category: 'text',
        syntax: 'EXACT(text1, text2)',
        description: 'Checks whether two text strings are exactly identical (case-sensitive).',
        args: [
            { name: 'text1', type: 'string', description: 'First string', required: true, example: '"Cement"' },
            { name: 'text2', type: 'string', description: 'Second string', required: true, example: '"Cement"' }
        ],
        returns: 'TRUE if exact match, FALSE otherwise',
        example: '=EXACT("Cement", "Cement")',
        tags: ['case sensitive compare', 'exact match']
    },

    // ══════════════════════════════════════════════════════════════════════════
    // DATE & TIME
    // ══════════════════════════════════════════════════════════════════════════
    {
        name: 'TODAY',
        category: 'datetime',
        syntax: 'TODAY()',
        description: 'Returns the current date.',
        args: [],
        returns: 'Current system date',
        example: '=TODAY()',
        tags: ['current date', 'today', 'now']
    },
    {
        name: 'NOW',
        category: 'datetime',
        syntax: 'NOW()',
        description: 'Returns the current date and time.',
        args: [],
        returns: 'Current timestamp with time',
        example: '=NOW()',
        tags: ['timestamp', 'current time', 'clock']
    },
    {
        name: 'DATE',
        category: 'datetime',
        syntax: 'DATE(year, month, day)',
        description: 'Constructs a date object from year, month, and day integers.',
        args: [
            { name: 'year', type: 'number', description: 'Four-digit year (e.g. 2026)', required: true, example: '2026' },
            { name: 'month', type: 'number', description: 'Month integer (1 to 12)', required: true, example: '8' },
            { name: 'day', type: 'number', description: 'Day of month (1 to 31)', required: true, example: '30' }
        ],
        returns: 'Constructed date object',
        example: '=DATE(2026, 8, 30)',
        tags: ['make date', 'construct date', 'calendar']
    },
    {
        name: 'DATEDIF',
        category: 'datetime',
        syntax: 'DATEDIF(start_date, end_date, unit)',
        description: 'Calculates the difference between two dates in "Y" (Years), "M" (Months), or "D" (Days).',
        args: [
            { name: 'start_date', type: 'date|string', description: 'Starting date', required: true, example: '"2026-01-01"' },
            { name: 'end_date', type: 'date|string', description: 'Ending date', required: true, example: '"2026-08-30"' },
            { name: 'unit', type: 'string', description: '"Y"=Years, "M"=Months, "D"=Days', required: true, example: '"D"' }
        ],
        returns: 'Difference in specified units',
        example: '=DATEDIF("2026-01-01", "2026-08-30", "D")',
        tags: ['date difference', 'duration', 'days between', 'milestone elapsed']
    },
    {
        name: 'DAYS',
        category: 'datetime',
        syntax: 'DAYS(end_date, start_date)',
        description: 'Returns the number of calendar days between two dates.',
        args: [
            { name: 'end_date', type: 'date|string', description: 'End date', required: true, example: '"2026-12-31"' },
            { name: 'start_date', type: 'date|string', description: 'Start date', required: true, example: '"2026-08-30"' }
        ],
        returns: 'Number of calendar days',
        example: '=DAYS("2026-12-31", "2026-08-30")',
        tags: ['calendar days', 'days count', 'project duration']
    },
    {
        name: 'EDATE',
        category: 'datetime',
        syntax: 'EDATE(start_date, months)',
        description: 'Returns the date shifted by the specified number of months.',
        args: [
            { name: 'start_date', type: 'date|string', description: 'Start date', required: true, example: '"2026-08-30"' },
            { name: 'months', type: 'number', description: 'Months offset (+ or -)', required: true, example: '6' }
        ],
        returns: 'Shifted date by months',
        example: '=EDATE("2026-08-30", 6)',
        tags: ['month shift', 'warranty expiry', 'milestone date']
    },
    {
        name: 'EOMONTH',
        category: 'datetime',
        syntax: 'EOMONTH(start_date, months)',
        description: 'Returns the last day of the month before or after start_date.',
        args: [
            { name: 'start_date', type: 'date|string', description: 'Start date', required: true, example: '"2026-08-15"' },
            { name: 'months', type: 'number', description: 'Months offset (0 = current month)', required: true, example: '0' }
        ],
        returns: 'Last date of target month',
        example: '=EOMONTH("2026-08-15", 0)',
        tags: ['end of month', 'month end billing', 'cut off']
    },
    {
        name: 'NETWORKDAYS',
        category: 'datetime',
        syntax: 'NETWORKDAYS(start_date, end_date, [holidays])',
        description: 'Returns the number of whole working days between dates (excluding weekends).',
        args: [
            { name: 'start_date', type: 'date|string', description: 'Start date', required: true, example: '"2026-08-01"' },
            { name: 'end_date', type: 'date|string', description: 'End date', required: true, example: '"2026-08-31"' }
        ],
        returns: 'Count of business work days',
        example: '=NETWORKDAYS("2026-08-01", "2026-08-31")',
        tags: ['work days', 'business days', 'schedule duration', 'labor days']
    },
    {
        name: 'YEAR',
        category: 'datetime',
        syntax: 'YEAR(serial_number)',
        description: 'Returns the year of a date as a four-digit integer.',
        args: [
            { name: 'serial_number', type: 'date|string', description: 'Date to extract year from', required: true, example: '"2026-08-30"' }
        ],
        returns: 'Year integer',
        example: '=YEAR("2026-08-30")',
        tags: ['year', 'date parts']
    },
    {
        name: 'MONTH',
        category: 'datetime',
        syntax: 'MONTH(serial_number)',
        description: 'Returns the month of a date as an integer from 1 to 12.',
        args: [
            { name: 'serial_number', type: 'date|string', description: 'Date to extract month from', required: true, example: '"2026-08-30"' }
        ],
        returns: 'Month integer (1-12)',
        example: '=MONTH("2026-08-30")',
        tags: ['month', 'date parts']
    },
    {
        name: 'DAY',
        category: 'datetime',
        syntax: 'DAY(serial_number)',
        description: 'Returns the day of the month as an integer from 1 to 31.',
        args: [
            { name: 'serial_number', type: 'date|string', description: 'Date to extract day from', required: true, example: '"2026-08-30"' }
        ],
        returns: 'Day integer (1-31)',
        example: '=DAY("2026-08-30")',
        tags: ['day', 'date parts']
    },

    // ══════════════════════════════════════════════════════════════════════════
    // LOOKUP & REFERENCE
    // ══════════════════════════════════════════════════════════════════════════
    {
        name: 'VLOOKUP',
        category: 'lookup',
        syntax: 'VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])',
        description: 'Looks for a value in the leftmost column and returns a value from the same row in the specified column.',
        args: [
            { name: 'lookup_value', type: 'any', description: 'Value to search for', required: true, example: '"Cement-53"' },
            { name: 'table_array', type: 'range|array', description: 'Table matrix data', required: true, example: '[["Cement-43", 340], ["Cement-53", 380], ["Steel-TMT", 62000]]' },
            { name: 'col_index_num', type: 'number', description: 'Column index to return (1-indexed)', required: true, example: '2' },
            { name: 'range_lookup', type: 'boolean', description: 'Exact match (FALSE) or approximate (TRUE)', required: false, example: 'FALSE' }
        ],
        returns: 'Matched cell value from column',
        example: '=VLOOKUP("Cement-53", [["Cement-43", 340], ["Cement-53", 380], ["Steel-TMT", 62000]], 2, FALSE)',
        tags: ['vertical lookup', 'match table', 'search column', 'price lookup']
    },
    {
        name: 'HLOOKUP',
        category: 'lookup',
        syntax: 'HLOOKUP(lookup_value, table_array, row_index_num, [range_lookup])',
        description: 'Looks for a value in the top row of a table and returns a value in the same column from a specified row.',
        args: [
            { name: 'lookup_value', type: 'any', description: 'Value to search for in the top row', required: true, example: '"Q1"' },
            { name: 'table_array', type: 'range|array', description: 'Table matrix data', required: true, example: '[["Q1", "Q2"], [150000, 220000]]' },
            { name: 'row_index_num', type: 'number', description: 'Row index to return (1-indexed)', required: true, example: '2' },
            { name: 'range_lookup', type: 'boolean', description: 'Exact match (FALSE)', required: false, example: 'FALSE' }
        ],
        returns: 'Matched horizontal lookup value',
        example: '=HLOOKUP("Q1", [["Q1", "Q2"], [150000, 220000]], 2, FALSE)',
        tags: ['horizontal lookup', 'hlookup', 'row search']
    },
    {
        name: 'INDEX',
        category: 'lookup',
        syntax: 'INDEX(array, row_num, [column_num])',
        description: 'Returns the value at the given row and column coordinates in a table or array.',
        args: [
            { name: 'array', type: 'range|array', description: 'Range or array constant', required: true, example: '[[10, 20], [30, 40]]' },
            { name: 'row_num', type: 'number', description: 'Row index', required: true, example: '2' },
            { name: 'column_num', type: 'number', description: 'Column index', required: false, example: '1' }
        ],
        returns: 'Value at coordinates',
        example: '=INDEX([[10, 20], [30, 40]], 2, 1)',
        tags: ['index match', 'matrix lookup', 'coordinate lookup']
    },
    {
        name: 'MATCH',
        category: 'lookup',
        syntax: 'MATCH(lookup_value, lookup_array, [match_type])',
        description: 'Returns the relative position of an item in an array matching a specified value.',
        args: [
            { name: 'lookup_value', type: 'any', description: 'Value to find', required: true, example: '"Steel"' },
            { name: 'lookup_array', type: 'array', description: 'Search list array', required: true, example: '["Sand", "Steel", "Bricks"]' },
            { name: 'match_type', type: 'number', description: '0 for exact match, 1 for less than, -1 for greater than', required: false, example: '0' }
        ],
        returns: 'Relative 1-based index position',
        example: '=MATCH("Steel", ["Sand", "Steel", "Bricks"], 0)',
        tags: ['find index', 'position', 'lookup match']
    },
    {
        name: 'CHOOSE',
        category: 'lookup',
        syntax: 'CHOOSE(index_num, value1, [value2], ...)',
        description: 'Returns a value from a list of arguments corresponding to the index number.',
        args: [
            { name: 'index_num', type: 'number', description: 'Index position to select (1-based)', required: true, example: '2' },
            { name: 'value1', type: 'any', description: 'First choice', required: true, example: '"Draft"' },
            { name: 'value2', type: 'any', description: 'Second choice', required: true, example: '"In Progress"' },
            { name: 'value3', type: 'any', description: 'Third choice', required: true, example: '"Completed"' }
        ],
        returns: 'Selected item from index',
        example: '=CHOOSE(2, "Draft", "In Progress", "Completed")',
        tags: ['pick from list', 'option index', 'switch']
    },

    // ══════════════════════════════════════════════════════════════════════════
    // FINANCIAL
    // ══════════════════════════════════════════════════════════════════════════
    {
        name: 'PMT',
        category: 'financial',
        syntax: 'PMT(rate, nper, pv, [fv], [type])',
        description: 'Calculates the periodic payment for a loan with constant payments and interest rate.',
        args: [
            { name: 'rate', type: 'number', description: 'Interest rate per period (e.g. 0.09/12)', required: true, example: '0.09/12' },
            { name: 'nper', type: 'number', description: 'Total number of payment periods', required: true, example: '36' },
            { name: 'pv', type: 'number', description: 'Principal loan present value', required: true, example: '500000' }
        ],
        returns: 'Periodic payment amount',
        example: '=PMT(0.09/12, 36, 500000)',
        tags: ['loan emi', 'payment', 'mortgage', 'monthly instalment', 'finance']
    },
    {
        name: 'PV',
        category: 'financial',
        syntax: 'PV(rate, nper, pmt, [fv], [type])',
        description: 'Returns the present value of an investment (worth of future payments today).',
        args: [
            { name: 'rate', type: 'number', description: 'Interest rate per period', required: true, example: '0.08/12' },
            { name: 'nper', type: 'number', description: 'Number of payment periods', required: true, example: '24' },
            { name: 'pmt', type: 'number', description: 'Payment made each period', required: true, example: '-15000' }
        ],
        returns: 'Present discounted value',
        example: '=PV(0.08/12, 24, -15000)',
        tags: ['present value', 'discounted cash flow', 'valuation']
    },
    {
        name: 'FV',
        category: 'financial',
        syntax: 'FV(rate, nper, pmt, [pv], [type])',
        description: 'Returns the future value of an investment based on periodic payments and constant interest.',
        args: [
            { name: 'rate', type: 'number', description: 'Interest rate per period', required: true, example: '0.07/12' },
            { name: 'nper', type: 'number', description: 'Total payment periods', required: true, example: '60' },
            { name: 'pmt', type: 'number', description: 'Payment made each period', required: true, example: '-10000' }
        ],
        returns: 'Future accumulated value',
        example: '=FV(0.07/12, 60, -10000)',
        tags: ['future value', 'savings', 'compounding growth']
    },
    {
        name: 'NPV',
        category: 'financial',
        syntax: 'NPV(rate, value1, [value2], ...)',
        description: 'Calculates the net present value of an investment using a discount rate and cash flows.',
        args: [
            { name: 'rate', type: 'number', description: 'Discount rate over one period', required: true, example: '0.1' },
            { name: 'value1', type: 'number', description: 'Initial investment / cash flow', required: true, example: '-100000' },
            { name: 'value2', type: 'number', description: 'Period 1 cash flow', required: true, example: '40000' },
            { name: 'value3', type: 'number', description: 'Period 2 cash flow', required: true, example: '80000' }
        ],
        returns: 'Net present value',
        example: '=NPV(0.1, -100000, 40000, 80000)',
        tags: ['npv', 'discount rate', 'capital budgeting', 'roi']
    },
    {
        name: 'IRR',
        category: 'financial',
        syntax: 'IRR(values, [guess])',
        description: 'Returns the internal rate of return for a series of periodic cash flows.',
        args: [
            { name: 'values', type: 'array', description: 'Array of cash flows (first is usually negative investment)', required: true, example: '[-100000, 35000, 45000, 55000]' }
        ],
        returns: 'Internal rate of return %',
        example: '=IRR([-100000, 35000, 45000, 55000])',
        tags: ['irr', 'internal rate of return', 'yield', 'profitability']
    },
    {
        name: 'RATE',
        category: 'financial',
        syntax: 'RATE(nper, pmt, pv, [fv], [type], [guess])',
        description: 'Returns the interest rate per period of an annuity.',
        args: [
            { name: 'nper', type: 'number', description: 'Total number of payment periods', required: true, example: '48' },
            { name: 'pmt', type: 'number', description: 'Payment amount per period', required: true, example: '-2000' },
            { name: 'pv', type: 'number', description: 'Present value loan amount', required: true, example: '80000' }
        ],
        returns: 'Periodic interest rate',
        example: '=RATE(48, -2000, 80000)',
        tags: ['interest rate', 'yield', 'apr']
    },
    {
        name: 'NPER',
        category: 'financial',
        syntax: 'NPER(rate, pmt, pv, [fv], [type])',
        description: 'Returns the number of periods for an investment based on periodic payments and constant interest.',
        args: [
            { name: 'rate', type: 'number', description: 'Interest rate per period', required: true, example: '0.12/12' },
            { name: 'pmt', type: 'number', description: 'Payment made each period', required: true, example: '-1000' },
            { name: 'pv', type: 'number', description: 'Present value loan amount', required: true, example: '10000' }
        ],
        returns: 'Number of payment periods',
        example: '=NPER(0.12/12, -1000, 10000)',
        tags: ['number of periods', 'loan tenure', 'payoff duration']
    },
    {
        name: 'SLN',
        category: 'financial',
        syntax: 'SLN(cost, salvage, life)',
        description: 'Returns the straight-line depreciation of an asset for one period.',
        args: [
            { name: 'cost', type: 'number', description: 'Initial cost of asset (e.g. excavator, truck)', required: true, example: '2500000' },
            { name: 'salvage', type: 'number', description: 'Value at the end of depreciation', required: true, example: '500000' },
            { name: 'life', type: 'number', description: 'Number of periods (useful life in years)', required: true, example: '5' }
        ],
        returns: 'Annual straight-line depreciation',
        example: '=SLN(2500000, 500000, 5)',
        tags: ['depreciation', 'straight line', 'asset valuation', 'equipment']
    },

    // ══════════════════════════════════════════════════════════════════════════
    // ENGINEERING & INFORMATION
    // ══════════════════════════════════════════════════════════════════════════
    {
        name: 'ISBLANK',
        category: 'engineering',
        syntax: 'ISBLANK(value)',
        description: 'Returns TRUE if the value is blank/empty, otherwise returns FALSE.',
        args: [
            { name: 'value', type: 'any', description: 'Value to test', required: true, example: '""' }
        ],
        returns: 'Boolean TRUE/FALSE',
        example: '=ISBLANK("")',
        tags: ['empty check', 'is blank', 'validation']
    },
    {
        name: 'ISNUMBER',
        category: 'engineering',
        syntax: 'ISNUMBER(value)',
        description: 'Returns TRUE if the value refers to a number, otherwise returns FALSE.',
        args: [
            { name: 'value', type: 'any', description: 'Value to test', required: true, example: '450.25' }
        ],
        returns: 'Boolean TRUE/FALSE',
        example: '=ISNUMBER(450.25)',
        tags: ['numeric check', 'is number', 'type check']
    },
    {
        name: 'ISTEXT',
        category: 'engineering',
        syntax: 'ISTEXT(value)',
        description: 'Returns TRUE if the value is text, otherwise returns FALSE.',
        args: [
            { name: 'value', type: 'any', description: 'Value to test', required: true, example: '"Contractor"' }
        ],
        returns: 'Boolean TRUE/FALSE',
        example: '=ISTEXT("Contractor")',
        tags: ['text check', 'string check']
    },
    {
        name: 'ISERROR',
        category: 'engineering',
        syntax: 'ISERROR(value)',
        description: 'Returns TRUE if value is any error (#N/A, #VALUE!, #REF!, #DIV/0!, etc.).',
        args: [
            { name: 'value', type: 'any', description: 'Value to test for error', required: true, example: '100 / 0' }
        ],
        returns: 'Boolean TRUE/FALSE',
        example: '=ISERROR(100 / 0)',
        tags: ['error detector', 'validation']
    },
    {
        name: 'CONVERT',
        category: 'engineering',
        syntax: 'CONVERT(number, from_unit, to_unit)',
        description: 'Converts a number from one measurement system to another (e.g. "m" to "ft", "kg" to "lbm").',
        args: [
            { name: 'number', type: 'number', description: 'Value to convert', required: true, example: '100' },
            { name: 'from_unit', type: 'string', description: 'Source unit ("m", "ft", "kg")', required: true, example: '"m"' },
            { name: 'to_unit', type: 'string', description: 'Target unit ("ft", "in", "cm")', required: true, example: '"ft"' }
        ],
        returns: 'Converted unit quantity',
        example: '=CONVERT(100, "m", "ft")',
        tags: ['unit conversion', 'meters to feet', 'measurements', 'engineering']
    },
    {
        name: 'DELTA',
        category: 'engineering',
        syntax: 'DELTA(number1, [number2])',
        description: 'Tests whether two values are equal (returns 1 if equal, 0 if not equal).',
        args: [
            { name: 'number1', type: 'number', description: 'First number', required: true, example: '42' },
            { name: 'number2', type: 'number', description: 'Second number (defaults to 0)', required: false, example: '42' }
        ],
        returns: '1 if equal, 0 otherwise',
        example: '=DELTA(42, 42)',
        tags: ['kronecker delta', 'equality test', 'engineering']
    },

    // ══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTION & ERP SPECIFIC FORMULAS
    // ══════════════════════════════════════════════════════════════════════════
    {
        name: 'STEEL_WEIGHT',
        category: 'construction',
        syntax: '=(diameter^2 / 162) * length',
        description: 'Calculates structural steel rebar weight in Kilograms (kg) from diameter (in mm) and length (in meters). Standard Civil formula: D²/162 * L.',
        args: [
            { name: 'diameter_mm', type: 'number', description: 'Rebar diameter in millimeters (e.g. 8, 10, 12, 16, 20, 25, 32)', required: true, example: '16' },
            { name: 'length_m', type: 'number', description: 'Total length in meters', required: true, example: '12' }
        ],
        returns: 'Weight in kg',
        example: '=(POWER(16, 2) / 162) * 12',
        tags: ['steel rebar', 'tmt bar weight', 'civil engineering', 'd2/162', 'takeoff']
    },
    {
        name: 'CONCRETE_VOLUME',
        category: 'construction',
        syntax: '=length * width * depth',
        description: 'Calculates concrete volume in Cubic Meters (cum / m³) for slab, footing, or beam.',
        args: [
            { name: 'length', type: 'number', description: 'Length in meters', required: true, example: '15' },
            { name: 'width', type: 'number', description: 'Width in meters', required: true, example: '8' },
            { name: 'depth', type: 'number', description: 'Thickness or depth in meters', required: true, example: '0.15' }
        ],
        returns: 'Volume in m³ (Cubic Meters)',
        example: '=PRODUCT(15, 8, 0.15)',
        tags: ['concrete cubic meter', 'slab volume', 'casting', 'cum']
    },
    {
        name: 'MATERIAL_WITH_WASTAGE',
        category: 'construction',
        syntax: '=net_quantity * (1 + wastage_rate)',
        description: 'Calculates gross procurement quantity including standard job-site wastage/scrap buffer.',
        args: [
            { name: 'net_quantity', type: 'number', description: 'Net theoretical quantity required', required: true, example: '500' },
            { name: 'wastage_rate', type: 'number', description: 'Wastage percentage in decimal (e.g. 0.05 for 5% wastage)', required: true, example: '0.05' }
        ],
        returns: 'Gross procurement quantity',
        example: '=PRODUCT(500, 1 + 0.05)',
        tags: ['wastage buffer', 'scrap allowance', 'procurement qty']
    },
    {
        name: 'GST_TAX_BREAKDOWN',
        category: 'construction',
        syntax: '=base_amount * (gst_rate / 100)',
        description: 'Computes GST / VAT tax amount and gross total for vendor invoices and client billing.',
        args: [
            { name: 'base_amount', type: 'number', description: 'Taxable subtotal base value (in ₹)', required: true, example: '150000' },
            { name: 'gst_rate', type: 'number', description: 'GST rate percentage (e.g. 18 for 18% GST)', required: true, example: '18' }
        ],
        returns: 'Tax liability amount',
        example: '=PRODUCT(150000, 18 / 100)',
        tags: ['gst tax', 'vat', 'invoice tax', 'billing', '18% gst']
    },
    {
        name: 'RETENTION_DEDUCTION',
        category: 'construction',
        syntax: '=gross_bill_amount * (1 - retention_rate)',
        description: 'Calculates net contractor payable amount after deducting security retention withholding (e.g. 5% or 10%).',
        args: [
            { name: 'gross_bill_amount', type: 'number', description: 'Gross certified RA bill amount', required: true, example: '450000' },
            { name: 'retention_rate', type: 'number', description: 'Retention percentage in decimal (e.g. 0.05 for 5%)', required: true, example: '0.05' }
        ],
        returns: 'Net payable after retention',
        example: '=PRODUCT(450000, 1 - 0.05)',
        tags: ['retention withholding', 'contractor bill', 'ra bill', 'security deposit']
    },
    {
        name: 'LABOR_MANDAYS_COST',
        category: 'construction',
        syntax: '=workers_count * days_worked * daily_wage_rate',
        description: 'Calculates total labor cost from headcount, days, and agreed daily wage.',
        args: [
            { name: 'workers_count', type: 'number', description: 'Number of workers deployed', required: true, example: '14' },
            { name: 'days_worked', type: 'number', description: 'Number of work days', required: true, example: '26' },
            { name: 'daily_wage_rate', type: 'number', description: 'Daily wage rate per worker (₹)', required: true, example: '750' }
        ],
        returns: 'Total payroll labor cost',
        example: '=PRODUCT(14, 26, 750)',
        tags: ['mandays', 'labor payroll', 'site wage', 'muster roll']
    },
    {
        name: 'PROFIT_MARGIN_PCT',
        category: 'construction',
        syntax: '=(revenue - cost) / revenue',
        description: 'Calculates the gross profit margin percentage of a contract or item.',
        args: [
            { name: 'revenue', type: 'number', description: 'Contract revenue / selling price', required: true, example: '1200000' },
            { name: 'cost', type: 'number', description: 'Direct project execution cost', required: true, example: '950000' }
        ],
        returns: 'Margin in decimal (multiply by 100 for %)',
        example: '=(1200000 - 950000) / 1200000',
        tags: ['profit margin', 'markup', 'contract profitability']
    }
];

export default EXCEL_FORMULAS_CATALOG;
