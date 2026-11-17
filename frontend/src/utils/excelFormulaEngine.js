import * as formulajs from '@formulajs/formulajs';
import { Parser } from '@fortune-sheet/formula-parser';
import { EXCEL_FORMULAS_CATALOG, FORMULA_CATEGORIES } from './excelFormulasCatalog.js';

// Pre-create and configure a singleton Parser with all FormulaJS functions registered
let sharedParser = null;

const createConfiguredParser = (context = {}) => {
    const parser = new Parser();

    // 1. Register ALL open-source FormulaJS functions
    Object.keys(formulajs).forEach((fnName) => {
        const fn = formulajs[fnName];
        if (typeof fn === 'function') {
            const upper = fnName.toUpperCase();
            parser.setFunction(upper, (params) => {
                return fn(...params);
            });
            if (upper !== fnName) {
                parser.setFunction(fnName, (params) => {
                    return fn(...params);
                });
            }
        }
    });

    // 2. Also hook into callFunction for case-insensitive or dotted function names
    parser.on('callFunction', (name, params, done) => {
        if (typeof done !== 'function') return;
        const upper = (name || '').toUpperCase().replace(/\./g, '');
        const fn = formulajs[upper] || formulajs[name] || formulajs[(name || '').toUpperCase()];
        if (typeof fn === 'function') {
            try {
                const res = fn(...params);
                done(res);
            } catch {
                // let parser proceed
            }
        }
    });

    // 3. Register cell reference resolver: callCellValue(cellCoord, options, done)
    parser.on('callCellValue', (cellCoord, optionsOrDone, maybeDone) => {
        const done = typeof maybeDone === 'function' ? maybeDone : (typeof optionsOrDone === 'function' ? optionsOrDone : null);
        if (!done) return;

        const label = (cellCoord.label || '').toUpperCase();
        if (typeof context === 'function') {
            const val = context(label, cellCoord);
            done(val !== undefined ? val : 0);
            return;
        }

        if (context && typeof context === 'object') {
            if (context[label] !== undefined) {
                const val = context[label];
                const num = Number(val);
                done(!isNaN(num) && val !== '' && val !== null ? num : val);
                return;
            }
            // Check case-insensitive match
            const matchKey = Object.keys(context).find(k => k.toUpperCase() === label);
            if (matchKey && context[matchKey] !== undefined) {
                const val = context[matchKey];
                const num = Number(val);
                done(!isNaN(num) && val !== '' && val !== null ? num : val);
                return;
            }
        }
        done(0);
    });

    // 4. Register range resolver: callRangeValue(startCell, endCell, options, done)
    parser.on('callRangeValue', (startCell, endCell, optionsOrDone, maybeDone) => {
        const done = typeof maybeDone === 'function' ? maybeDone : (typeof optionsOrDone === 'function' ? optionsOrDone : null);
        if (!done) return;

        const startLabel = (startCell.label || '').toUpperCase();
        const endLabel = (endCell.label || '').toUpperCase();
        const rangeKey = `${startLabel}:${endLabel}`;

        if (context && typeof context === 'object' && context[rangeKey] !== undefined) {
            done(context[rangeKey]);
            return;
        }

        // Dynamically build matrix from individual cell values in context
        if (startCell.row && endCell.row && startCell.column && endCell.column && context && typeof context === 'object') {
            const minR = Math.min(startCell.row.index, endCell.row.index);
            const maxR = Math.max(startCell.row.index, endCell.row.index);
            const minC = Math.min(startCell.column.index, endCell.column.index);
            const maxC = Math.max(startCell.column.index, endCell.column.index);
            const matrix = [];

            for (let r = minR; r <= maxR; r++) {
                const rowArr = [];
                for (let c = minC; c <= maxC; c++) {
                    let colLetter = '';
                    let tempC = c;
                    while (tempC >= 0) {
                        colLetter = String.fromCharCode((tempC % 26) + 65) + colLetter;
                        tempC = Math.floor(tempC / 26) - 1;
                    }
                    const cellKey = `${colLetter}${r + 1}`;
                    const val = context[cellKey] !== undefined ? context[cellKey] : 0;
                    const num = Number(val);
                    rowArr.push(!isNaN(num) && val !== '' && val !== null ? num : val);
                }
                matrix.push(rowArr);
            }
            done(matrix);
            return;
        }

        done([[]]);
    });

    return parser;
};

const getSharedParser = () => {
    if (!sharedParser) {
        sharedParser = createConfiguredParser({});
    }
    return sharedParser;
};

/**
 * Format any calculation result into human-readable representation.
 */
export const formatFormulaResult = (result) => {
    if (result === null || result === undefined) return 'null';
    if (typeof result === 'boolean') return result ? 'TRUE' : 'FALSE';
    if (typeof result === 'number') {
        if (isNaN(result)) return '#NUM!';
        if (!isFinite(result)) return '#DIV/0!';
        // Format decimal numbers cleanly
        if (Number.isInteger(result)) {
            return result.toLocaleString('en-IN');
        }
        return Number(result.toFixed(6).replace(/\.?0+$/, '')).toLocaleString('en-IN', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 6
        });
    }
    if (result instanceof Date) {
        return result.toISOString().split('T')[0];
    }
    if (Array.isArray(result)) {
        if (result.length > 0 && Array.isArray(result[0])) {
            return `[${result.map(row => `[${row.map(c => formatFormulaResult(c)).join(', ')}]`).join(', ')}]`;
        }
        return `[${result.map(c => formatFormulaResult(c)).join(', ')}]`;
    }
    if (typeof result === 'object') {
        try {
            return JSON.stringify(result);
        } catch {
            return String(result);
        }
    }
    return String(result);
};

/**
 * Replace bracketed column references like [rate] or [qty] with their values from context
 */
const resolveBracketVariables = (formulaStr, context = {}) => {
    if (!formulaStr || !context || typeof context !== 'object') return formulaStr;
    return formulaStr.replace(/\[([a-zA-Z0-9_]+)\]/g, (match, key) => {
        if (context[key] !== undefined) {
            const val = context[key];
            const num = Number(val);
            return !isNaN(num) && val !== '' && val !== null ? String(num) : JSON.stringify(val);
        }
        // Case insensitive match
        const foundKey = Object.keys(context).find(k => k.toLowerCase() === key.toLowerCase());
        if (foundKey && context[foundKey] !== undefined) {
            const val = context[foundKey];
            const num = Number(val);
            return !isNaN(num) && val !== '' && val !== null ? String(num) : JSON.stringify(val);
        }
        return match;
    });
};

/**
 * Safely evaluates any Excel formula string using open-source calculation engines (@formulajs and @fortune-sheet/formula-parser).
 * 
 * @param {string} formulaStr - The formula string (e.g. "=SUM(10, 20, 30)" or "=IF(5 > 2, 'YES', 'NO')" or "=100*1.18")
 * @param {Object} context - Optional cell reference resolver or custom variables { A1: 10, B1: 20, rate: 500 }
 * @returns {Object} { success: boolean, result: any, formattedResult: string, error: string|null, durationMs: number }
 */
export const evaluateFormula = (formulaStr, context = {}) => {
    const startTime = performance.now();
    if (!formulaStr || typeof formulaStr !== 'string') {
        return {
            success: false,
            result: null,
            formattedResult: '#VALUE!',
            error: 'Empty or invalid formula input',
            durationMs: 0
        };
    }

    let cleanFormula = formulaStr.trim();
    if (cleanFormula.startsWith('=')) {
        cleanFormula = cleanFormula.substring(1).trim();
    }

    if (!cleanFormula) {
        return {
            success: true,
            result: '',
            formattedResult: '',
            error: null,
            durationMs: 0
        };
    }

    // Resolve column aliases like [rate] * [quantity]
    cleanFormula = resolveBracketVariables(cleanFormula, context);

    try {
        const hasCustomContext = context && (typeof context === 'function' || Object.keys(context).length > 0);
        const parser = hasCustomContext ? createConfiguredParser(context) : getSharedParser();

        const parseResult = parser.parse(cleanFormula);
        const durationMs = Number((performance.now() - startTime).toFixed(2));

        if (parseResult.error) {
            // Fallback 1: Try direct FormulaJS function call
            const directRes = tryDirectFormulaJS(cleanFormula);
            if (directRes.success) {
                return {
                    success: true,
                    result: directRes.result,
                    formattedResult: formatFormulaResult(directRes.result),
                    error: null,
                    durationMs
                };
            }

            // Fallback 2: Try basic algebraic math evaluation
            const mathRes = trySafeMathEvaluation(cleanFormula, context);
            if (mathRes.success) {
                return {
                    success: true,
                    result: mathRes.result,
                    formattedResult: formatFormulaResult(mathRes.result),
                    error: null,
                    durationMs
                };
            }

            return {
                success: false,
                result: null,
                formattedResult: `#${String(parseResult.error)}`,
                error: `Formula calculation error: ${parseResult.error}`,
                durationMs
            };
        }

        return {
            success: true,
            result: parseResult.result,
            formattedResult: formatFormulaResult(parseResult.result),
            error: null,
            durationMs
        };
    } catch (err) {
        // Fallback 1: Direct FormulaJS execution
        const directRes = tryDirectFormulaJS(cleanFormula);
        const durationMs = Number((performance.now() - startTime).toFixed(2));
        if (directRes.success) {
            return {
                success: true,
                result: directRes.result,
                formattedResult: formatFormulaResult(directRes.result),
                error: null,
                durationMs
            };
        }

        // Fallback 2: Safe math expression
        const mathRes = trySafeMathEvaluation(cleanFormula, context);
        if (mathRes.success) {
            return {
                success: true,
                result: mathRes.result,
                formattedResult: formatFormulaResult(mathRes.result),
                error: null,
                durationMs
            };
        }

        return {
            success: false,
            result: null,
            formattedResult: '#ERROR!',
            error: err.message || 'Evaluation syntax error',
            durationMs
        };
    }
};

/**
 * Attempts safe mathematical evaluation for expressions like `100 * 1.18` or `1250 + 350 - 50`
 */
const trySafeMathEvaluation = (cleanFormula, context = {}) => {
    try {
        let expr = cleanFormula.trim();
        // Replace cell references if present
        if (context && typeof context === 'object') {
            expr = expr.replace(/\b([A-Za-z]+[0-9]+)\b/g, (match, label) => {
                const uLabel = label.toUpperCase();
                if (context[uLabel] !== undefined) {
                    const num = Number(context[uLabel]);
                    return !isNaN(num) ? String(num) : '0';
                }
                return match;
            });
        }

        // Only allow safe math tokens: numbers, operators, parens, decimal points, spaces
        if (/^[\d\s+\-*/().^%,]+$/.test(expr)) {
            // Replace ^ with ** for JS exponentiation
            const jsExpr = expr.replace(/\^/g, '**').replace(/%/g, '/100');
            // Safe Function constructor with no scope access
            // eslint-disable-next-line no-new-func
            const res = Function(`"use strict"; return (${jsExpr});`)();
            if (typeof res === 'number' && !isNaN(res)) {
                return { success: true, result: res };
            }
        }
        return { success: false };
    } catch {
        return { success: false };
    }
};

/**
 * Attempts direct evaluation of a FormulaJS function (e.g. DATEDIF, SUMIFS, CONCAT, PMT)
 */
const tryDirectFormulaJS = (cleanFormula) => {
    try {
        const match = cleanFormula.match(/^([A-Za-z0-9_.]+)\s*\((.*)\)$/s);
        if (!match) return { success: false };

        const fnName = match[1].toUpperCase().replace(/\./g, '');
        const rawArgs = match[2];

        const targetFn = formulajs[fnName] || formulajs[match[1].toUpperCase()];
        if (typeof targetFn !== 'function') return { success: false };

        // Parse arguments safely
        const parsedArgs = parseArgumentList(rawArgs);
        const result = targetFn(...parsedArgs);
        return { success: true, result };
    } catch {
        return { success: false };
    }
};

/**
 * Helper to parse comma-separated arguments, honoring nested brackets and strings
 */
const parseArgumentList = (argsStr) => {
    if (!argsStr || !argsStr.trim()) return [];

    const args = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    let bracketDepth = 0;
    let parenDepth = 0;

    for (let i = 0; i < argsStr.length; i++) {
        const ch = argsStr[i];

        if ((ch === '"' || ch === "'") && !inQuotes) {
            inQuotes = true;
            quoteChar = ch;
            current += ch;
        } else if (ch === quoteChar && inQuotes) {
            inQuotes = false;
            current += ch;
        } else if (!inQuotes && (ch === '[' || ch === '{')) {
            bracketDepth++;
            current += ch;
        } else if (!inQuotes && (ch === ']' || ch === '}')) {
            bracketDepth--;
            current += ch;
        } else if (!inQuotes && ch === '(') {
            parenDepth++;
            current += ch;
        } else if (!inQuotes && ch === ')') {
            parenDepth--;
            current += ch;
        } else if (!inQuotes && ch === ',' && bracketDepth === 0 && parenDepth === 0) {
            args.push(evalArgToken(current.trim()));
            current = '';
        } else {
            current += ch;
        }
    }

    if (current.trim()) {
        args.push(evalArgToken(current.trim()));
    }

    return args;
};

/**
 * Convert string argument token to parsed JS value
 */
const evalArgToken = (token) => {
    if (!token) return '';
    if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
        return token.slice(1, -1);
    }
    if (token.toUpperCase() === 'TRUE') return true;
    if (token.toUpperCase() === 'FALSE') return false;
    if (!isNaN(Number(token))) return Number(token);

    // Try array constant e.g. [1, 2, 3] or [[1, 2], [3, 4]]
    if (token.startsWith('[') && token.endsWith(']')) {
        try {
            return JSON.parse(token.replace(/'/g, '"'));
        } catch {
            return token;
        }
    }

    // Try evaluating simple math expression e.g. 0.09/12 or 16^2
    try {
        const mathParser = getSharedParser();
        const res = mathParser.parse(token);
        if (!res.error && res.result !== undefined) {
            return res.result;
        }
    } catch {
        // Fallback
    }

    return token;
};

/**
 * Executes a formula by name directly with arguments.
 */
export const executeFunctionByName = (funcName, args = []) => {
    if (!funcName) return null;
    const cleanName = funcName.toUpperCase().replace(/\./g, '');
    const fn = formulajs[cleanName] || formulajs[funcName.toUpperCase()];

    if (typeof fn === 'function') {
        try {
            return fn(...args);
        } catch (err) {
            return `#ERROR: ${err.message}`;
        }
    }

    // Try via parser
    const formulaString = `=${funcName}(${args.map(a => typeof a === 'string' ? `"${a}"` : a).join(', ')})`;
    const res = evaluateFormula(formulaString);
    return res.success ? res.result : res.formattedResult;
};

/**
 * Generates formatted formula string e.g. =SUM(A1, B1) or =VLOOKUP("val", A1:B10, 2, FALSE)
 */
export const buildFormulaString = (funcName, args = []) => {
    if (!funcName) return '';
    const cleanArgs = args.filter(a => a !== undefined && a !== null && String(a).trim() !== '');
    return `=${funcName.toUpperCase()}(${cleanArgs.join(', ')})`;
};

/**
 * Filter formulas across all metadata catalog entries.
 */
export const searchFormulas = (query = '', categoryId = 'all') => {
    const q = (query || '').trim().toLowerCase();

    return EXCEL_FORMULAS_CATALOG.filter(item => {
        const matchCategory = categoryId === 'all' || item.category === categoryId;
        if (!matchCategory) return false;

        if (!q) return true;

        return (
            item.name.toLowerCase().includes(q) ||
            item.syntax.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q) ||
            (item.tags && item.tags.some(t => t.toLowerCase().includes(q)))
        );
    });
};

export { EXCEL_FORMULAS_CATALOG, FORMULA_CATEGORIES, formulajs };
export default {
    evaluateFormula,
    formatFormulaResult,
    executeFunctionByName,
    buildFormulaString,
    searchFormulas,
    EXCEL_FORMULAS_CATALOG,
    FORMULA_CATEGORIES
};
