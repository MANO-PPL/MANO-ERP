import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initCatalogSchema() {
    const sqlPath = path.join(__dirname, 'sql', '002_catalog_schema.sql');
    const rawSql = fs.readFileSync(sqlPath, 'utf8');

    // Strip single-line comments and split statements by semicolon
    const cleanedSql = rawSql
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n');

    const statements = cleanedSql
        .split(';')
        .map(s => s.trim())
        .filter(Boolean);

    console.log(`[Catalog Schema] Executing ${statements.length} DDL statements from ${sqlPath}...`);

    for (const stmt of statements) {
        await db.raw(stmt);
    }

    const [tables] = await db.raw("SHOW TABLES LIKE 'cat_%'");
    const created = tables.map(r => Object.values(r)[0]);
    console.log(`[Catalog Schema] Verified tables (${created.length}): ${created.join(', ')}`);
}

initCatalogSchema()
    .then(async () => {
        await db.destroy();
        process.exit(0);
    })
    .catch(async err => {
        console.error('[Catalog Schema] Initialization failed:', err);
        await db.destroy();
        process.exit(1);
    });

