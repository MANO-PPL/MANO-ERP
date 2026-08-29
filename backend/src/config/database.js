import './config.js';
import knex from 'knex';

const rawUser = process.env.DB_ADMIN_USER || process.env.DB_USER || 'root';
const rawPassword = process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD || '';
const rawDatabase = process.env.DB_NAME || 'MANO-ERP';
const rawHost = process.env.DB_HOST || '127.0.0.1';
const rawPort = process.env.DB_PORT || 3307;

const user = String(rawUser).replace(/^["']|["']$/g, '');
const password = String(rawPassword).replace(/^["']|["']$/g, '');
const database = String(rawDatabase).replace(/^["']|["']$/g, '');
const host = String(rawHost).replace(/^["']|["']$/g, '');
const port = Number(String(rawPort).replace(/^["']|["']$/g, ''));

export const db = knex({
    client: 'mysql2',
    connection: {
        host,
        user,
        password,
        database,
        port,
        timezone: 'Z',
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000
    },
    pool: {
        min: 2,
        max: 20,
    },
    acquireConnectionTimeout: 30000,
});

export default db;


