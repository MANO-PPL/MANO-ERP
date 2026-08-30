import * as formulajs from '@formulajs/formulajs';
import { Parser } from '@fortune-sheet/formula-parser';
import { EXCEL_FORMULAS_CATALOG, FORMULA_CATEGORIES } from './excelFormulasCatalog.js';

// Shared Parser instance
let sharedParser = null;

const getParser = () => {
    if (!sharedParser) {
        sharedParser = new Parser();
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
 * Safely evaluates any Excel formula string using open-source calculation engines.
 * 
 * @param {string} formulaStr - The formula string (e.g. "=SUM(10, 20, 30)" or "IF(5 > 2, 'YES', 'NO')")
 * @param {Object} context - Optional cell reference resolver or custom variables { A1: 10, B1: 20 }
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

    try {
        const parser = new Parser();

        // Register custom cell reference resolver if context contains variables
        if (context && Object.keys(context).length > 0) {
            parser.on('callCellValue', (cellCoord, done) => {
                const label = cellCoord.label ? cellCoord.label.toUpperCase() : null;
                if (label && context[label] !== undefined) {
                    done(context[label]);
                } else {
                    done(0);
                }
            });

            parser.on('callRangeValue', (startCell, endCell, done) => {
                const rangeLabel = `${startCell.label}:${endCell.label}`.toUpperCase();
                if (context[rangeLabel] !== undefined) {
                    done(context[rangeLabel]);
                } else {
                    done([[]]);
                }
            });
        }

        const parseResult = parser.parse(cleanFormula);
        const durationMs = Number((performance.now() - startTime).toFixed(2));

        if (parseResult.error) {
            // Check if it can be directly evaluated via formulajs function call
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
        // Fallback to direct FormulaJS execution
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
        const mathParser = getParser();
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
