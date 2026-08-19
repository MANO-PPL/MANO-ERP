import './config.js';
import knex from 'knex';


export const db = knex({
    client: 'mysql2',
    connection: {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'mano_erp',
        port: process.env.DB_PORT || 3307,
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

